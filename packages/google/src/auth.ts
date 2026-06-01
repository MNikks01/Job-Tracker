import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { google, type Auth } from "googleapis";

/** Walk up from cwd to the monorepo root (pnpm-workspace.yaml) so the token path is stable
 * regardless of which package directory a command runs from. */
function repoRoot(start: string = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return start;
}

/** Least-privilege Google scopes (docs/security/security-design.md §2). */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export interface GoogleCreds {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function googleCredsFromEnv(env: NodeJS.ProcessEnv = process.env): GoogleCreds | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI ?? "http://localhost:4100/oauth/callback",
  };
}

function tokenPath(): string {
  return process.env.GOOGLE_TOKEN_FILE ?? resolve(repoRoot(), "config/google-token.json");
}

export function makeOAuth(creds: GoogleCreds): Auth.OAuth2Client {
  return new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
}

/** URL the operator visits to grant access (offline = returns a refresh token). */
export function authUrl(creds: GoogleCreds): string {
  return makeOAuth(creds).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });
}

export async function exchangeCodeForToken(creds: GoogleCreds, code: string): Promise<void> {
  const client = makeOAuth(creds);
  const { tokens } = await client.getToken(code);
  saveToken(tokens);
}

export function saveToken(tokens: unknown): void {
  writeFileSync(tokenPath(), JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function hasToken(): boolean {
  return existsSync(tokenPath());
}

/**
 * An authenticated OAuth2 client (refreshes access tokens automatically via the stored
 * refresh token), or null if creds/token aren't configured yet. Persists refreshed tokens.
 */
export function authedClient(creds: GoogleCreds): Auth.OAuth2Client | null {
  if (!hasToken()) return null;
  const client = makeOAuth(creds);
  const tokens = JSON.parse(readFileSync(tokenPath(), "utf8"));
  client.setCredentials(tokens);
  client.on("tokens", (t) => {
    // Persist refreshed access tokens (keep the existing refresh_token if not returned).
    const merged = { ...tokens, ...t };
    saveToken(merged);
  });
  return client;
}

/** Convenience: build an authed client straight from env, or null. */
export function authedClientFromEnv(): Auth.OAuth2Client | null {
  const creds = googleCredsFromEnv();
  return creds ? authedClient(creds) : null;
}
