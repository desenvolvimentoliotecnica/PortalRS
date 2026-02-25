import { legacyFetch } from "@/server/legacy/fetch";

export async function GET() {
  const res = await legacyFetch("/api/health", {
    headers: { Accept: "application/json" },
    forwardCookies: false,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

