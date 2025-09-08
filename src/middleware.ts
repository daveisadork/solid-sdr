import { createMiddleware } from "vinxi/http";

export default createMiddleware(async (c, next) => {
  const res = await next(c);
  const h = new Headers(res.headers);
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Embedder-Policy", "require-corp");
  h.set("Cross-Origin-Resource-Policy", "same-origin");
  return new Response(res.body, { status: res.status, headers: h });
});
