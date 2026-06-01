import http from "node:http";
import { authUrl, exchangeCodeForToken, googleCredsFromEnv } from "@jobagent/google";

/**
 * One-time Google sign-in: opens a local callback server, prints the consent URL, and stores
 * the refresh token to config/google-token.json. Run after setting GOOGLE_CLIENT_ID/SECRET.
 *   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… pnpm --filter @jobagent/worker oauth:google
 */
const creds = googleCredsFromEnv();
if (!creds) {
  console.log("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first (see CLAUDE.md → Google setup).");
  process.exit(1);
}

const cbUrl = new URL(creds.redirectUri);
const port = Number(cbUrl.port || "4100");

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (u.pathname !== cbUrl.pathname) {
    res.statusCode = 404;
    res.end("not found");
    return;
  }
  const code = u.searchParams.get("code");
  if (!code) {
    res.end("No authorization code received.");
    return;
  }
  try {
    await exchangeCodeForToken(creds, code);
    res.end("✅ Google connected. Token saved. You can close this tab.");
    console.log("\n✅ Token saved → config/google-token.json. Gmail/Calendar tools are now live.");
  } catch (e) {
    res.end("Token exchange failed: " + (e instanceof Error ? e.message : String(e)));
    console.error("token exchange failed:", e);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 200);
  }
});

server.listen(port, () => {
  console.log(`\n1) Open this URL in your browser and approve access:\n\n${authUrl(creds)}\n`);
  console.log(`2) Waiting for Google to redirect to ${creds.redirectUri} ...`);
});
