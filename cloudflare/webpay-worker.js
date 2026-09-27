const UPSTREAM = "https://www.innova-space-edu.cl";

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const upstream = new URL(UPSTREAM);
    upstream.pathname = incoming.pathname === "/" ? "/webpay.html" : incoming.pathname;
    upstream.search = incoming.search;

    const headers = new Headers(request.headers);
    headers.set("host", upstream.host);

    const response = await fetch(new Request(upstream.toString(), {
      method: request.method,
      headers,
      body: ["GET","HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "follow"
    }));

    const outHeaders = new Headers(response.headers);
    outHeaders.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    outHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders
    });
  }
};