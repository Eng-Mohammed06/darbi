const TOKEN_KEY = 'darbi.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/** Thrown for any non-2xx response; `code` is the API's machine-readable error. */
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? body?.error ?? `HTTP ${status}`);
    this.status = status;
    this.code = body?.error;
    this.body = body;
  }
}

/** fetch wrapper: attaches the token, parses JSON, throws ApiError on failure. */
export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';

  const token = getToken();
  if (auth && token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return null;

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    // An expired or tampered token should drop the session rather than leave
    // the UI in a half-logged-in state.
    if (res.status === 401 && token) clearToken();
    throw new ApiError(res.status, payload);
  }
  return payload;
}
