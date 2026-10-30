import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatWorkspace from "@/components/chat-workspace";

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle();
  const { data: conversations } = await supabase.from("conversations").select("id,title,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50);
  return <ChatWorkspace user={{ id: user.id, email: user.email ?? "", name: profile?.display_name ?? user.user_metadata?.full_name ?? "User", avatar: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? "" }} initialConversations={conversations ?? []}/>;
}
