"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { NotificationRow } from "@ave/shared-types";
import { api } from "@/lib/api";
import { authEnabled, supabase } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Projects" },
  { href: "/projects/new", label: "New project" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [notes, setNotes] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (path === "/login") return;
    let alive = true;
    const load = () => api.notifications().then((n) => alive && setNotes(n)).catch(() => undefined);
    load();
    const t = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, [path]);

  if (path === "/login") return null;
  const unread = notes.filter((n) => !n.read).length;
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <Link href="/" className="font-display text-lg font-bold tracking-wide">Reel<span className="text-gold">Engine</span></Link>
        <nav className="flex gap-1 text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 ${path === l.href ? "bg-white/15" : "hover:bg-white/10"}`}>{l.label}</Link>
          ))}
        </nav>
        <div className="relative ml-auto flex items-center gap-3">
          <button aria-label="Notifications" className="relative rounded-lg px-3 py-1.5 hover:bg-white/10" onClick={() => { setOpen((o) => !o); if (!open && unread) api.markRead().then(() => setNotes((n) => n.map((x) => ({ ...x, read: true })))); }}>
            🔔{unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">{unread}</span>}
          </button>
          {open && (
            <div className="absolute right-0 top-11 w-80 rounded-xl border border-line bg-white p-2 text-sm text-slate-800 shadow-xl">
              {notes.length === 0 && <p className="p-3 text-slate-500">No notifications yet.</p>}
              {notes.slice(0, 8).map((n) => (
                <Link key={n.id} href={n.projectId ? `/projects/${n.projectId}` : "/"} onClick={() => setOpen(false)} className="block rounded-lg p-3 hover:bg-slate-50">
                  <div className={n.kind === "project_failed" ? "text-red-600" : ""}>{n.message}</div>
                  <div className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</div>
                </Link>
              ))}
            </div>
          )}
          {authEnabled && <button className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10" onClick={async () => { await supabase()?.auth.signOut(); router.push("/login"); }}>Sign out</button>}
        </div>
      </div>
    </header>
  );
}
