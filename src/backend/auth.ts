// In-browser auth: accounts with salted SHA-256 password hashes, stored locally.
import { table, saveDb, uuid } from "./db";

const SESSION_KEY = "sc_local_session_v1";

export type LocalUser = {
  id: string;
  email: string;
  created_at: string;
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
};
export type LocalSession = { access_token: string; refresh_token: string; expires_at: number; token_type: "bearer"; user: LocalUser };

type Listener = (event: string, session: LocalSession | null) => void;
const listeners = new Set<Listener>();

const has = () => typeof window !== "undefined";

async function hash(password: string, salt: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readSession(): LocalSession | null {
  if (!has()) return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
function writeSession(s: LocalSession | null, event: string) {
  if (!has()) return;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
  listeners.forEach((fn) => setTimeout(() => fn(event, s), 0));
}

const publicUser = (u: any): LocalUser => ({
  id: u.id, email: u.email, created_at: u.created_at,
  user_metadata: u.user_metadata ?? {}, app_metadata: { provider: "email" },
});

function makeSession(u: any): LocalSession {
  return {
    access_token: "local-" + uuid(), refresh_token: uuid(), token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365, user: publicUser(u),
  };
}

const err = (message: string) => ({ message, name: "AuthError", status: 400 });
const unsupported = (what: string) => ({ data: { user: null, session: null }, error: err(`${what} isn't available — this app stores accounts only in this browser.`) });

export const auth = {
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, any> } }) {
    email = email.trim().toLowerCase();
    if (!email || !password) return { data: { user: null, session: null }, error: err("Email and password are required") };
    if (password.length < 6) return { data: { user: null, session: null }, error: err("Password should be at least 6 characters") };
    const users = table("auth_users");
    if (users.some((u) => u.email === email)) return { data: { user: null, session: null }, error: err("User already registered") };
    const salt = uuid();
    const u = { id: uuid(), email, salt, password_hash: await hash(password, salt), created_at: new Date().toISOString(), user_metadata: options?.data ?? {} };
    users.push(u);
    const now = new Date().toISOString();
    table("profiles").push({ id: u.id, email, full_name: u.user_metadata.full_name ?? null, avatar_url: null, created_at: now, updated_at: now });
    // The first account on this device becomes the admin.
    if (users.length === 1) table("user_roles").push({ id: uuid(), user_id: u.id, role: "admin", created_at: now });
    table("user_roles").push({ id: uuid(), user_id: u.id, role: "user", created_at: now });
    saveDb();
    const session = makeSession(u);
    writeSession(session, "SIGNED_IN");
    return { data: { user: session.user, session }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const u = table("auth_users").find((x) => x.email === email.trim().toLowerCase());
    if (!u || (await hash(password, u.salt)) !== u.password_hash)
      return { data: { user: null, session: null }, error: err("Invalid login credentials") };
    const session = makeSession(u);
    writeSession(session, "SIGNED_IN");
    return { data: { user: session.user, session }, error: null };
  },

  async signOut() { writeSession(null, "SIGNED_OUT"); return { error: null }; },

  async getSession() { return { data: { session: readSession() }, error: null }; },

  async getUser() { const s = readSession(); return { data: { user: s?.user ?? null }, error: null }; },

  async updateUser(attrs: { password?: string; email?: string; data?: Record<string, any> }) {
    const s = readSession();
    if (!s) return { data: { user: null }, error: err("Not signed in") };
    const u = table("auth_users").find((x) => x.id === s.user.id);
    if (!u) return { data: { user: null }, error: err("User not found") };
    if (attrs.password) { u.salt = uuid(); u.password_hash = await hash(attrs.password, u.salt); }
    if (attrs.email) u.email = attrs.email.trim().toLowerCase();
    if (attrs.data) u.user_metadata = { ...u.user_metadata, ...attrs.data };
    saveDb();
    const next = { ...s, user: publicUser(u) };
    writeSession(next, "USER_UPDATED");
    return { data: { user: next.user }, error: null };
  },

  onAuthStateChange(cb: Listener) {
    listeners.add(cb);
    setTimeout(() => cb("INITIAL_SESSION", readSession()), 0);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },

  async resetPasswordForEmail() { return { data: null, error: err("Password reset emails aren't available — accounts are stored only in this browser.") }; },
  async signInWithOtp() { return unsupported("Email codes"); },
  async verifyOtp() { return unsupported("Email codes"); },
  async signInWithOAuth() { return { data: { provider: null, url: null }, error: err("Google/GitHub sign-in isn't available — use email and password.") }; },

  mfa: {
    async listFactors() { return { data: { all: [], totp: [], phone: [] }, error: null }; },
    async getAuthenticatorAssuranceLevel() { return { data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [] }, error: null }; },
    async enroll() { return { data: null, error: err("Two-factor authentication isn't available in this browser-only version.") }; },
    async challenge() { return { data: null, error: err("Two-factor authentication isn't available.") }; },
    async verify() { return { data: null, error: err("Two-factor authentication isn't available.") }; },
    async challengeAndVerify() { return { data: null, error: err("Two-factor authentication isn't available.") }; },
    async unenroll() { return { data: null, error: null }; },
  },
};
