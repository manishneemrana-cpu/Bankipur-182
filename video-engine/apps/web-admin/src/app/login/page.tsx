"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authEnabled, supabase } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState<string | null>(null);

  if (!authEnabled) {
    return <p className="card p-6 text-sm">Supabase Auth isn’t configured (<code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>), so the app runs in single-account dev mode. <a className="underline" href="/">Continue</a></p>;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const sb = supabase()!;
    const { error } = mode === "in" ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password });
    if (error) return setMsg(error.message);
    if (mode === "up") return setMsg("Check your email to confirm your account, then sign in.");
    router.replace("/");
  }
  return (
    <form onSubmit={submit} className="card mx-auto mt-16 max-w-sm space-y-4 p-6">
      <h1 className="font-display text-2xl font-bold text-ink">{mode === "in" ? "Sign in" : "Create account"}</h1>
      <div><label className="label">Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label className="label">Password</label><input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <button className="btn w-full justify-center">{mode === "in" ? "Sign in" : "Sign up"}</button>
      <button type="button" className="w-full text-center text-sm text-slate-500 underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Need an account?" : "Have an account?"}</button>
    </form>
  );
}
