export const runtime = "nodejs";

function isAllowedUrl(target: string) {
  try {
    const url = new URL(target);
    const host = url.hostname.toLowerCase();
    return host === 'fal.media' || host.endsWith('.fal.media');
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target || !isAllowedUrl(target)) {
    return new Response("Invalid or disallowed url", { status: 400 });
  }

  const headers: Record<string, string> = {};
  const range = request.headers.get("range");
  if (range) {
    headers.Range = range;
  }

  const upstream = await fetch(target, { headers });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Upstream fetch failed", { status: upstream.status });
  }

  const responseHeaders = new Headers();
  const passthroughHeaders = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ];
  passthroughHeaders.forEach((name) => {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  });

  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  responseHeaders.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges"
  );
  responseHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
  responseHeaders.set("Cache-Control", "public, max-age=3600");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
