/**
 * authFetch — drop-in replacement for fetch() that:
 *  1. Attaches the stored JWT to every request automatically
 *  2. On any 401 Unauthorized response, clears the session and redirects to /login
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5005";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("mediqueue_session");
    if (!raw) return null;
    return JSON.parse(raw)?.accessToken ?? null;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("mediqueue_session");
    window.location.href = "/login";
  }
}

export async function authFetch(
  path: string,
  init: RequestInit = {}
): Promise<any> {
  const token = getToken();

  if (!token) {
    redirectToLogin();
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Session expired. Please log in again.");
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
  return json;
}

/** Non-authenticated fetch — only redirects on 401, no token required */
export async function publicFetch(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Session expired.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
  return json;
}
