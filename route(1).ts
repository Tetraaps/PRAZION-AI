import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
const updateSchema = z.object({ title: z.string().trim().min(1).max(120).optional() });
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { data: conversation } = await supabase.from("conversations").select("id,title,provider,model").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
  const { data: messages, error } = await supabase.from("messages").select("id,role,content,created_at,provider,model").eq("conversation_id", id).eq("user_id", user.id).order("created_at", { ascending: true });
  if (error) return Response.json({ error: "Could not load messages." }, { status: 500 });
  return Response.json({ conversation, messages });
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || !body.data.title) return Response.json({ error: "A valid title is required." }, { status: 400 });
  const { data, error } = await supabase.from("conversations").update({ title: body.data.title }).eq("id", id).eq("user_id", user.id).select("id,title").maybeSingle();
  if (error || !data) return Response.json({ error: "Could not update conversation." }, { status: 404 });
  return Response.json({ conversation: data });
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { error } = await supabase.from("conversations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return Response.json({ error: "Could not delete conversation." }, { status: 500 });
  return Response.json({ ok: true });
}