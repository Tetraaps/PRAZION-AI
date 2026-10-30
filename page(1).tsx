import LoginPanel from "@/components/login-panel";

export default function LoginPage() {
  return <main className="app-glow min-h-screen grid place-items-center px-5 py-12">
    <div className="w-full max-w-md">
      <div className="mb-9 flex flex-col items-center text-center">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-blue-400/30 bg-blue-500/10 shadow-[0_0_55px_#3b82f622]">
          <span className="text-3xl font-black tracking-tighter text-blue-300">P<span className="text-white">A</span></span>
        </div>
        <p className="text-sm font-semibold tracking-[.28em] text-blue-300">PRAZION AI</p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Intelligence beyond boundaries.</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">One platform. Multiple minds. Infinite possibilities.</p>
      </div>
      <LoginPanel />
      <p className="mt-6 text-center text-xs leading-5 text-[var(--muted)]">By continuing, you agree to use PRAZION AI responsibly. Messages and attachments may be processed by the AI provider you select to fulfill your request.</p>
    </div>
  </main>;
}