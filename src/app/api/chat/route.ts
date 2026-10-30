OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const schema = z.obimportject({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(30000),
  provider: z.enum(["openai", "anthropic"]).optional(),
  model: z.string().max(100).optional()
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request. Check your message and try again." }, { status: 400 });

  const { message } = parsed.data;
  const provider = parsed.data.provider ?? (process.env.DEFAULT_AI_PROVIDER === "anthropic" ? "anthropic" : "openai");
  const model = parsed.data.model ?? (provider === "openai" ? process.env.DEFAULT_OPENAI_MODEL : process.env.DEFAULT_ANTHROPIC_MODEL);
  if (!model) return Response.json({ error: `No ${provider} model is configured.` }, { status: 503 });
  if (provider === "openai" && !process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI is not configured. Add OPENAI_API_KEY to the server environment." }, { status: 503 });
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Anthropic is not configured. Add ANTHROPIC_API_KEY to the server environment." }, { status: 503 });

  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const { data } = await supabase.from("conversations").select("id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
    if (!data) return Response.json({ error: "Conversation not found." }, { status: 404 });
  } else {
    const title = message.slice(0, 64) + (message.length > 64 ? "…" : "");
    const { data, error } = await supabase.from("conversations").insert({ user_id: user.id, title, provider, model }).select("id").single();
    if (error || !data) return Response.json({ error: "Could not create conversation. Check your database setup." }, { status: 500 });
    conversationId = data.id;
  }

  const { error: saveUserError } = await supabase.from("messages").insert({ conversation_id: conversationId, user_id: user.id, role: "user", content: message, provider, model });
  if (saveUserError) return Response.json({ error: "Could not save your message." }, { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      let full = "";
      try {
        if (provider === "openai") {
          const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000, maxRetries: 1 });
          const result = await client.chat.completions.create({
            model, stream: true,
            messages: [{ role: "system", content: "You are PRAZION AI, a helpful, accurate assistant. Be transparent about uncertainty and never claim to have processed files that were not provided." }, { role: "user", content: message }]
          });
          for await (const chunk of result) {
            const text = chunk.choices[0]?.delta?.content;
            if (typeof text === "string" && text) { full += text; send({ type: "delta", text }); }
          }
        } else {
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000, maxRetries: 1 });
          const result = await client.messages.create({ model, max_tokens: 4096, stream: true, system: "You are PRAZION AI, a helpful, accurate assistant. Be transparent about uncertainty and never claim to have processed files that were not provided.", messages: [{ role: "user", content: message }] });
          for await (const event of result) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") { full += event.delta.text; send({ type: "delta", text: event.delta.text }); }
          }
        }
        const { error: saveError } = await supabase.from("messages").insert({ conversation_id: conversationId, user_id: user.id, role: "assistant", content: full, provider, model });
        if (saveError) throw new Error("Response received, but saving it failed. Refresh the conversation before retrying.");
        await supabase.from("conversations").update({ updated_at: new Date().toISOString(), provider, model }).eq("id", conversationId).eq("user_id", user.id);
        send({ type: "done", conversationId, provider, model });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "AI request failed." });
      } finally { controller.close(); }
    }
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
                                                                                      }
