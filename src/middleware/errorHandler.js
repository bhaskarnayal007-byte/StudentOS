/**
 * Last stop for anything thrown in a route. Express 5 forwards rejected async
 * handlers here automatically, so routes don't need try/catch just to report.
 */
export default function errorHandler(err, _req, res, _next) {
  const status = err.status ?? 500;

  // Log the real thing server-side; send the client only what's safe. A raw
  // 500 message can leak table names, keys, or stack details.
  if (status >= 500) console.error(err);

  res.status(status).json({
    error: status >= 500 ? "Internal server error" : err.message,
  });
}
