import { createClient } from "@/lib/supabase/server";
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await supabase.from("conversations").select("id,title,updated_at,provider,model").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "Could not load conversations." }, { status: 500 });
  return Response.json({ conversations: data });
}