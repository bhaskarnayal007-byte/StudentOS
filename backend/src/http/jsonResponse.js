// JSON responses for the Worker: one error shape, CORS for the app's own
// origins, and the security headers helmet used to add on Express.

/** Thrown anywhere in a route; index.js turns it into a JSON response. */
export class HttpError extends Error {
  constructor(status, message, extraHeaders = {}) {
    super(message);
    this.status = status;
    this.extraHeaders = extraHeaders;
  }
}

export function json(status, body, headers = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * Last stop for anything thrown. Log the real thing; send the client only
 * what's safe, since a raw 500 message can leak table names or keys.
 */
export function errorResponse(err) {
  const status = err.status ?? 500;
  // A 5xx we raised on purpose (the shared AI pool is empty, a provider is
  // down) keeps its message; only the unexpected ones are logged and hidden.
  const safe = status < 500 || err instanceof HttpError;
  if (!safe) console.error(err);
  return json(
    status,
    { error: safe ? err.message : "Internal server error", ...(err.code && { code: err.code }) },
    err.extraHeaders,
  );
}

/**
 * FRONTEND_URL (comma-separated) plus the Android app, which Capacitor serves
 * from https://localhost.
 */
function allowedOrigins(env) {
  const listed = (env.FRONTEND_URL ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return [...listed, "https://localhost"];
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

/** CORS headers for this request's origin, or none if it isn't one of ours. */
export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Expose-Headers": "Retry-After, X-AI-Provider",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** A copy of `response` with the security and CORS headers added. */
export function withHeaders(response, cors) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...cors })) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}
