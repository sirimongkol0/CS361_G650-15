// Login token storage shared by the API client (lib/api.ts) and the session
// context (lib/role-context.tsx), kept separate so neither imports the other.
//
// Per-tab storage: the token disappears when the tab is closed and is never
// shared with other sites. It expires on the server after 60 minutes anyway.

const TOKEN_KEY = "pcsms_access_token";

export function readToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function writeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/* The session context registers what to do when the API rejects the token
 * (expired or revoked): sign out and send the user to the login page. */
let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized() {
  unauthorizedHandler?.();
}
