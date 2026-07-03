const WORKER_ORIGIN = "https://memos-cloudflare-worker.lyle.workers.dev";

export function proxyToWorker({ request }) {
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, WORKER_ORIGIN);
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", sourceUrl.host);
  headers.set("x-forwarded-proto", sourceUrl.protocol.replace(":", ""));

  return fetch(
    new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    }),
  );
}
