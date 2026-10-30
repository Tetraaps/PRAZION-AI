"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Chrome, ShieldCheck } from "lucide-react";

export default function LoginPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn() {
    setBusy(true); setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/app` }
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start Google sign-in.");
      setBusy(false);
    }
  }
  return <section className="glass rounded-3xl p-7 shadow-2xl shadow-black/20">
    <h2 className="text-lg font-semibold">Welcome to your workspace</h2>
    <p className="mt-2 text-sm text-[var(--muted)]">Sign in to save conversations and access your files across devices.</p>
    <button onClick={signIn} disabled={busy} className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--accent)] px-4 py-3.5 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60">
      <Chrome size={19}/>{busy ? "Connecting…" : "Continue with Google"}
    </button>
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    <div className="mt-6 flex items-start gap-2 border-t border-[var(--border)] pt-5 text-xs leading-5 text-[var(--muted)]"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-blue-300"/>Your Google password is handled by Google. PRAZION AI never asks you to enter it directly.</div>
  </section>;
}