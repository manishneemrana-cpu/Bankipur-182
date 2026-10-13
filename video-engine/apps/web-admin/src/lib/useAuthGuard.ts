"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authEnabled, supabase } from "./auth";

/** Redirect to /login when Supabase Auth is enabled and there's no session. Returns true when OK to load data. */
export function useAuthGuard(): boolean {
  const router = useRouter();
  const [ok, setOk] = useState(!authEnabled);
  useEffect(() => {
    if (!authEnabled) return;
    supabase()!.auth.getSession().then(({ data }) => (data.session ? setOk(true) : router.replace("/login")));
  }, [router]);
  return ok;
}
