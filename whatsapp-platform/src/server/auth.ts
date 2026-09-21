import "server-only";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getEnv } from "./env";
import { withSystemClient } from "./db";
import type { OrgRole } from "./permissions";

const SESSION_COOKIE = "wap_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export interface SessionPayload {
  userId: string;
  [key: string]: unknown;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionCookie(userId: string): Promise<void> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Reads and verifies the session cookie. Returns null if absent/invalid/expired. */
export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export interface CurrentOrgContext {
  userId: string;
  organizationId: string;
  role: OrgRole;
  permissionOverrides: string[];
  isPlatformAdmin: boolean;
}

/**
 * Resolves the caller's organization membership entirely server-side from the
 * session cookie + database. The active organizationId is NEVER taken from a
 * client-supplied header, query param, or body field.
 */
export async function requireOrgContext(organizationId: string): Promise<CurrentOrgContext> {
  const session = await readSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }

  return withSystemClient(async (client) => {
    const userResult = await client.query<{ is_platform_admin: boolean }>(
      "SELECT is_platform_admin FROM users WHERE id = $1",
      [session.userId]
    );
    const user = userResult.rows[0];
    if (!user) throw new Error("UNAUTHENTICATED");

    const memberResult = await client.query<{ role: OrgRole; permissions: string[] }>(
      "SELECT role, permissions FROM organization_members WHERE user_id = $1 AND organization_id = $2",
      [session.userId, organizationId]
    );
    const member = memberResult.rows[0];
    if (!member && !user.is_platform_admin) {
      throw new Error("FORBIDDEN");
    }

    return {
      userId: session.userId,
      organizationId,
      role: member?.role ?? "VIEWER",
      permissionOverrides: member?.permissions ?? [],
      isPlatformAdmin: user.is_platform_admin,
    };
  });
}
