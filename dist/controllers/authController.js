"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.session = exports.logout = exports.authCallback = exports.sendMagicLink = exports.login = exports.signup = void 0;
const supabase_1 = require("../config/supabase");
const httpSession_1 = require("../auth/httpSession");
const sessionStore_1 = require("../auth/sessionStore");
function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}
function normalizePassword(password) {
    return String(password || "");
}
function getFrontendOrigin() {
    return process.env.CORS_ORIGIN || "http://localhost:3000";
}
function getMagicCallbackUrl() {
    const apiOrigin = process.env.API_PUBLIC_ORIGIN || "http://localhost:3001";
    const next = encodeURIComponent(`${getFrontendOrigin()}/onboarding`);
    return `${apiOrigin}/api/auth/callback?next=${next}`;
}
function sanitizeNextUrl(input) {
    const fallback = `${getFrontendOrigin()}/onboarding`;
    const next = String(input || "").trim();
    if (!next)
        return fallback;
    const origin = getFrontendOrigin();
    if (next.startsWith(origin))
        return next;
    return fallback;
}
function maskToken(value) {
    if (!value)
        return "";
    if (value.length <= 10)
        return `${value.slice(0, 2)}***`;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
function logCallbackParams(req) {
    if (process.env.NODE_ENV === "production")
        return;
    const query = req.query;
    const code = String(query.code || "");
    const tokenHash = String(query.token_hash || "");
    const next = String(query.next || "");
    const type = String(query.type || "");
    console.log("[auth/callback] received query", {
        path: req.originalUrl || req.url,
        keys: Object.keys(query),
        type,
        hasCode: Boolean(code),
        hasTokenHash: Boolean(tokenHash),
        codePreview: maskToken(code),
        tokenHashPreview: maskToken(tokenHash),
        nextPreview: next ? `${next.slice(0, 100)}${next.length > 100 ? "..." : ""}` : "",
    });
}
const signup = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = normalizePassword(req.body.password);
    const name = String(req.body.name || "").trim();
    if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Email and password are required" });
    }
    const supabase = (0, supabase_1.getSupabaseAnon)();
    if (!supabase) {
        return res.status(500).json({ ok: false, error: "Supabase auth is not configured" });
    }
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { name },
        },
    });
    if (signUpError) {
        return res.status(400).json({ ok: false, error: signUpError.message });
    }
    if (signUpData.session && signUpData.user) {
        const session = (0, sessionStore_1.createSession)({
            id: signUpData.user.id,
            email: signUpData.user.email || email,
        });
        (0, httpSession_1.setSessionCookie)(res, session.token);
        return res.json({
            ok: true,
            user: { id: signUpData.user.id, email: signUpData.user.email || email },
        });
    }
    // If email confirmation is required, signup can succeed without an immediate session.
    return res.status(202).json({
        ok: true,
        requiresEmailConfirmation: true,
        message: "Check your email to confirm your account, then sign in.",
    });
};
exports.signup = signup;
const login = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = normalizePassword(req.body.password);
    if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Email and password are required" });
    }
    const supabase = (0, supabase_1.getSupabaseAnon)();
    if (!supabase) {
        return res.status(500).json({ ok: false, error: "Supabase auth is not configured" });
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
        return res.status(401).json({ ok: false, error: error?.message || "Invalid credentials" });
    }
    const session = (0, sessionStore_1.createSession)({
        id: data.user.id,
        email: data.user.email || email,
    });
    (0, httpSession_1.setSessionCookie)(res, session.token);
    return res.json({
        ok: true,
        user: { id: data.user.id, email: data.user.email || email },
    });
};
exports.login = login;
const sendMagicLink = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || "").trim();
    if (!email) {
        return res.status(400).json({ ok: false, error: "Email is required" });
    }
    const supabase = (0, supabase_1.getSupabaseAnon)();
    if (!supabase) {
        return res.status(500).json({ ok: false, error: "Supabase auth is not configured" });
    }
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true,
            emailRedirectTo: getMagicCallbackUrl(),
            data: {
                name,
            },
        },
    });
    if (error) {
        return res.status(400).json({ ok: false, error: error.message });
    }
    return res.json({
        ok: true,
        message: "Magic link sent. Check your inbox to continue.",
    });
};
exports.sendMagicLink = sendMagicLink;
const authCallback = async (req, res) => {
    logCallbackParams(req);
    const tokenHash = String(req.query.token_hash || "");
    const code = String(req.query.code || "");
    const type = String(req.query.type || "magiclink");
    const next = sanitizeNextUrl(req.query.next);
    if (!tokenHash && !code) {
        return res.redirect(`${next}?auth_error=missing_token`);
    }
    const supabase = (0, supabase_1.getSupabaseAnon)();
    if (!supabase) {
        return res.redirect(`${next}?auth_error=misconfigured`);
    }
    let resolvedUser = null;
    if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data?.user) {
            resolvedUser = {
                id: data.user.id,
                email: data.user.email || null,
            };
        }
    }
    if (!resolvedUser && tokenHash) {
        const tryTypes = Array.from(new Set([type, "magiclink", "email", "signup"]));
        for (const tryType of tryTypes) {
            const { data, error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: tryType,
            });
            if (!error && data?.user) {
                resolvedUser = {
                    id: data.user.id,
                    email: data.user.email || null,
                };
                break;
            }
        }
    }
    if (!resolvedUser) {
        return res.redirect(`${next}?auth_error=invalid_or_expired_link`);
    }
    const session = (0, sessionStore_1.createSession)({
        id: resolvedUser.id,
        email: resolvedUser.email || null,
    });
    (0, httpSession_1.setSessionCookie)(res, session.token);
    return res.redirect(`${next}?verified=1`);
};
exports.authCallback = authCallback;
const logout = async (req, res) => {
    (0, httpSession_1.clearSessionCookie)(req, res);
    return res.json({ ok: true });
};
exports.logout = logout;
const session = async (req, res) => {
    const user = (0, httpSession_1.getAuthenticatedUser)(req);
    if (!user)
        return res.json({ ok: true, user: null });
    return res.json({ ok: true, user });
};
exports.session = session;
