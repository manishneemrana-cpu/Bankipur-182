import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { config, useSupabase } from "../config.js";
import { repo } from "./repo.js";

declare module "express-serve-static-core" {
  interface Request { accountId: string }
}

const sb = useSupabase ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } }) : null;

/**
 * Supabase configured -> require a valid user JWT (`Authorization: Bearer <access_token>`),
 * map the user to their account. Not configured (local dev) -> fixed dev account.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    if (!sb) {
      await repo.ensureAccount(config.DEV_ACCOUNT_ID);
      req.accountId = config.DEV_ACCOUNT_ID;
      return next();
    }
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Missing bearer token" });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: "Invalid token" });
    req.accountId = await repo.accountForOwner(data.user.id);
    next();
  } catch (e) {
    next(e);
  }
}
