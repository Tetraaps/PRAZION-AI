"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { Bot, ChevronDown, FileUp, Menu, MessageSquarePlus, PanelLeftClose, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, Square, Trash2, X, LogOut, SunMoon, Copy, Paperclip } from "lucide-react";

type Conversation = { id: string; title: string; updated_at: string };
type Message = { id?: string; role: "user" | "assistant"; content: string };
type UserInfo = { id: string; email: string; name: string; avatar: string };
const suggestions = [
  ["Explain a complex topic", "Explain a complex topic step by step, using a simple analogy and an example."],
  ["Analyze an image", "Help me analyze an image. I will attach it and would like a detailed, evidence-based explanation."],
  ["Summarize a document", "Summarize this document into key points, important details, and actionable takeaways."],
  ["Help me write code", "Help me write clean, maintainable code. First clarify the goal, then propose an implementation."],
  ["Brainstorm new ideas", "Help me brainstorm original ideas. Give me a range of options and explain the trade-offs."],
  ["Solve a problem step by step", "Help me solve this problem step by step and explain why each step works."]
];
export default function ChatWorkspace({ user, initialConversations }: { user: UserInfo; initialConversations: Conversation[] }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<"openai"|"anthropic">(process.env.NEXT_PUBLIC_DEFAULT_PROVIDER === "anthropic" ? "anthropic" : "openai");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [light, setLight] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachmentNote, setAttachmentNote] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  async function refreshConversations() {
    const r = await fetch("/api/conversations"); if (r.ok) { const d = await r.json(); setConversations(d.conversations ?? []); }
  }
  function newChat() { setActiveId(null); setMessages([]); setInput(""); setError(""); setAttachmentNote(""); setFile(null); setDrawer(false); }
  async function openConversation(id: string) {
    setError(""); setDrawer(false);
    const r = await fetch(`/api/conversations/${id}`);
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? "Could not open conversation."); return; }
    setActiveId(id); setMessages(d.messages ?? []);
  }
  async function removeConversation(id: string) {
    const r = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!r.ok) { setError("Could not delete conversation."); return; }
    setConversations(prev => prev.filter(c => c.id !== id)); if (activeId === id) newChat();
  }
  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); window.location.href = "/login"; }
  async function sendMessage(text = input) {
    const content = text.trim(); if ((!content && !file) || busy) return;
    setError(""); setInput(""); setBusy(true);
    let actual = content;
    if (file) {
      setUploading(true);
      const fd = new FormData(); fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await up.json().catch(() => ({}));
      setUploading(false);
      if (!up.ok) { setError(upData.error ?? "Upload failed."); setBusy(false); return; }
      setAttachmentNote(`Uploaded ${file.name}. File storage is active; document extraction and model context for attachments must be enabled before asking questions about its contents.`);
      actual = `${content}\n\n[Attachment uploaded: ${file.name}. This starter stores the file privately but does not yet extract its content into the model context.]`.trim();
      setFile(null);
    }
    const optimistic = [...messages, { role: "user" as const, content: actual }, { role: "assistant" as const, content: "" }];
    setMessages(optimistic);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: activeId ?? undefined, message: actual, provider }), signal: controller.signal });
      if (!response.ok || !response.body) {
        const d = await response.json().catch(() => ({})); throw new Error(d.error ?? "AI request failed.");
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let finalId = activeId;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n"); buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find(l => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === "delta") setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content + event.text } : m));
          if (event.type === "done") { finalId = event.conversationId; setActiveId(finalId); }
          if (event.type === "error") throw new Error(event.message);
        }
      }
      await refreshConversations();
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") setError("Generation stopped.");
      else setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages(prev => prev.filter((m, i) => !(i === prev.length - 1 && m.role === "assistant" && !m.content)));
    } finally { setBusy(false); abortRef.current = null; }
  }
  const history = conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  const sidebar = <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] p-4">
    <div className="mb-7 flex items-center gap-3 px-1">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-400/30 bg-blue-500/10 font-black tracking-tighter text-blue-300">P<span className="text-white">A</span></div>
      <div><div className="text-sm font-bold tracking-[.18em]">PRAZION AI</div><div className="mt-1 text-[10px] tracking-wider text-[var(--muted)]">INTELLIGENCE BEYOND BOUNDARIES</div></div>
      <button className="ml-auto rounded-lg p-2 text-[var(--muted)] hover:bg-white/5 md:hidden" onClick={() => setDrawer(false)} aria-label="Close navigation"><X size={18}/></button>
    </div>
    <button onClick={newChat} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"><Plus size={17}/> New chat</button>
    <label className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-black/10 px-3 py-2.5"><Search size={16} className="text-[var(--muted)]"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations" className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"/></label>
    <div className="mt-6 flex items-center justify-between px-2 text-xs font-semibold text-[var(--muted)]"><span>RECENT</span><span>{history.length}</span></div>
    <div className="soft-scroll mt-2 flex-1 space-y-1 overflow-y-auto">
      {history.map(c => <div key={c.id} className={`group flex items-center gap-1 rounded-xl ${activeId===c.id ? "bg-blue-500/10 text-blue-200" : "text-[var(--muted)] hover:bg-white/5"}`}>
        <button onClick={() => openConversation(c.id)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left text-sm"><MessageSquarePlus size={15} className="shrink-0"/><span className="truncate">{c.title}</span></button>
        <button onClick={() => removeConversation(c.id)} className="mr-1 rounded-lg p-2 opacity-0 hover:text-red-300 group-hover:opacity-100" aria-label="Delete conversation"><Trash2 size={14}/></button>
      </div>)}
      {!history.length && <p className="px-3 py-5 text-xs leading-5 text-[var(--muted)]">Your saved conversations will appear here.</p>}
    </div>
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <button onClick={() => setLight(!light)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-white/5"><SunMoon size={16}/> {light ? "Switch to dark theme" : "Switch to light theme"}</button>
      <button onClick={signOut} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-white/5"><LogOut size={16}/> Sign out</button>
      <div className="mt-3 flex items-center gap-3 rounded-xl p-2">
        {user.avatar ? <img src={user.avatar} alt="" className="h-9 w-9 rounded-full"/> : <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-200">{user.name.slice(0,1).toUpperCase()}</div>}
        <div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-[var(--muted)]">{user.email}</p></div>
      </div>
    </div>
  </aside>;
  return <main className={`${light ? "light" : ""} h-[100dvh] overflow-hidden bg-[var(--bg)] text-[var(--text)]`}>
    <div className="flex h-full">
      <div className="hidden md:block">{sidebar}</div>
      {drawer && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Close navigation backdrop" onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/60"/><div className="relative h-full w-[min(86vw,320px)]">{sidebar}</div></div>}
      <section className="app-glow flex min-w-0 flex-1 flex-col">
        <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--border)]/70 px-4 sm:px-7">
          <div className="flex items-center gap-3"><button onClick={() => setDrawer(true)} className="rounded-lg p-2 hover:bg-white/5 md:hidden" aria-label="Open navigation"><Menu size={19}/></button><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-blue-300"/> Workspace</div></div>
          <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs"><Bot size={15} className="text-blue-300"/><select value={provider} onChange={e => setProvider(e.target.value as "openai"|"anthropic")} className="max-w-[150px] bg-transparent outline-none"><option value="openai">OpenAI · configured model</option><option value="anthropic">Anthropic · configured model</option></select><ChevronDown size={13} className="text-[var(--muted)]"/></label>
        </header>
        <div className="soft-scroll flex-1 overflow-y-auto px-4 py-8 sm:px-8">
          <div className="mx-auto max-w-3xl">
            {!messages.length ? <div className="flex min-h-[55vh] flex-col justify-center">
              <div className="mb-7 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-400/25 bg-blue-500/10 text-lg font-black text-blue-300 shadow-[0_0_45px_#3b82f61a]">P<span className="text-white">A</span></div><div><p className="text-xs font-semibold tracking-[.25em] text-blue-300">PRAZION AI</p><p className="mt-1 text-xs text-[var(--muted)]">One Platform. Multiple Minds. Infinite Possibilities.</p></div></div>
              <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">What can we explore today?</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">Your ideas, files, questions, and possibilities — all in one place.</p>
              <div className="mt-9 grid gap-3 sm:grid-cols-2">{suggestions.map(([title, prompt]) => <button key={title} onClick={() => setInput(prompt)} className="group rounded-2xl border border-[var(--border)] bg-[var(--panel)]/75 p-4 text-left transition hover:border-blue-400/50 hover:bg-blue-500/5"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{title}</span><span className="text-blue-300 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100">↗</span></div><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{prompt}</p></button>)}</div>
            </div> : <div className="space-y-8 pb-8">{messages.map((m,i) => <article key={`${i}-${m.role}`} className="flex gap-3 sm:gap-4"><div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${m.role==="assistant" ? "bg-blue-500/15 text-blue-300" : "bg-white/10 text-[var(--text)]"}`}>{m.role==="assistant" ? <Sparkles size={16}/> : <span className="text-xs font-bold">YOU</span>}</div><div className="min-w-0 flex-1"><div className="mb-2 text-xs font-semibold text-[var(--muted)]">{m.role==="assistant" ? "PRAZION AI" : "YOU"}</div><div className="markdown text-sm sm:text-[15px]">{m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : busy && i===messages.length-1 ? <span className="inline-flex items-center gap-2 text-[var(--muted)]"><span className="h-2 w-2 animate-pulse rounded-full bg-blue-400"/>Thinking…</span> : null}</div>{m.role==="assistant" && m.content && <button onClick={() => navigator.clipboard.writeText(m.content)} className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--muted)] hover:bg-white/5"><Copy size={13}/> Copy</button>}</div></article>)}</div>}
            {error && <div role="alert" className="my-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
            {attachmentNote && <div className="my-4 rounded-xl border border-blue-400/25 bg-blue-500/5 px-4 py-3 text-xs leading-5 text-blue-100"><ShieldCheck size={14} className="mr-2 inline"/>{attachmentNote}</div>}
            <div ref={bottomRef}/>
          </div>
        </div>
        <div className="shrink-0 px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 sm:px-8">
          <div className="mx-auto max-w-3xl">
            {file && <div className="mb-2 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs"><span className="flex min-w-0 items-center gap-2 truncate"><Paperclip size={14}/>{file.name} · {(file.size/1024).toFixed(0)} KB</span><button onClick={() => setFile(null)} aria-label="Remove attachment"><X size={15}/></button></div>}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-2 shadow-xl shadow-black/10 focus-within:border-blue-400/50">
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }} placeholder="Message PRAZION AI…" rows={2} className="max-h-40 min-h-[54px] w-full resize-y bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-[var(--muted)]"/>
              <div className="flex items-center justify-between px-1 pb-1">
                <div className="flex items-center gap-1"><label className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--muted)] hover:bg-white/5"><FileUp size={16}/><span className="hidden sm:inline">Attach file</span><input type="file" className="hidden" accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.txt,.csv,.xlsx" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label><span className="hidden text-[10px] text-[var(--muted)] sm:inline">Enter to send · Shift+Enter for newline</span></div>
                {busy ? <button onClick={() => abortRef.current?.abort()} aria-label="Stop generation" className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] hover:bg-white/5"><Square size={14}/></button> : <button onClick={() => sendMessage()} disabled={!input.trim()&&!file||uploading} aria-label="Send message" className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"><Send size={16}/></button>}
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] leading-4 text-[var(--muted)]">AI can make mistakes. Verify important information. Your content may be processed by the selected AI provider.</p>
          </div>
        </div>
      </section>
    </div>
  </main>;
    }
