import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { clientEnv } from "@/lib/env/client";

const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback", "/p"];

/**
 * Refreshes the Supabase session on every request and gates admin routes.
 * Public buyer pages (Phase 3+) are added to PUBLIC_PATHS as they land.
 *
 * If Supabase isn't configured (e.g. `npm run dev`/CI with no env vars —
 * see CLAUDE.md), this fails open rather than crashing every request: no
 * auth gate, but the app still boots and /api/health can report the gap.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (
    !clientEnv.NEXT_PUBLIC_SUPABASE_URL ||
    !clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Required: this call refreshes the session and must not be removed or
  // reordered relative to reading the cookies above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/api/") ||
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
