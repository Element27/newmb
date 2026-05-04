import { Request, Response } from "express";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  deleteSession,
  getSession,
} from "./sessionStore";
import { getSupabaseAnon } from "../config/supabase";

function parseCookies(rawCookieHeader?: string) {
  const result: Record<string, string> = {};
  if (!rawCookieHeader) return result;

  rawCookieHeader.split(";").forEach((entry) => {
    const [rawKey, ...rawValue] = entry.trim().split("=");
    if (!rawKey) return;
    result[rawKey] = decodeURIComponent(rawValue.join("="));
  });

  return result;
}

export function getSessionTokenFromRequest(req: Request) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

export function getAuthenticatedUser(req: Request) {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  const session = getSession(token);
  if (!session) return null;
  return session.user;
}

function getBearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header || Array.isArray(header)) return null;
  const raw = String(header).trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return null;
  const token = raw.slice(7).trim();
  return token || null;
}

export async function requireAuthenticatedUser(req: Request, res: Response) {
  const bearer = getBearerToken(req);
  if (bearer) {
    console.log(`[auth] found bearer token (starts with ${bearer.slice(0, 10)}...)`);
    const supabase = getSupabaseAnon();
    if (!supabase) {
      console.error("[auth] supabase client not configured for bearer validation");
      res.status(500).json({ ok: false, error: "Supabase auth is not configured" });
      return null;
    }

    const { data, error } = await supabase.auth.getUser(bearer);
    if (error) {
      console.warn(`[auth] bearer verification failed: ${error.message}`);
    } else if (data?.user?.id) {
      console.log(`[auth] authenticated via bearer: ${data.user.id}`);
      return {
        id: data.user.id,
        email: data.user.email || null,
      };
    }
  }

  const user = getAuthenticatedUser(req);
  if (user?.id) {
    console.log(`[auth] authenticated via session cookie: ${user.id}`);
    return user;
  }

  console.log("[auth] No valid authentication found (missing/invalid bearer and cookie)");
  res.status(401).json({ ok: false, error: "Unauthorized" });
  return null;
}

export function setSessionCookie(res: Response, token: string) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(req: Request, res: Response) {
  const token = getSessionTokenFromRequest(req);
  if (token) deleteSession(token);

  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}
