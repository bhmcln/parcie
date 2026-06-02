// Proxies a solve request to the FastAPI engine. Keeps the browser same-origin
// (no CORS) and the engine URL server-side. Set ENGINE_URL to point elsewhere;
// defaults to the local uvicorn dev server.
const ENGINE_URL = process.env.ENGINE_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const body = await request.text();

  let res: Response;
  try {
    res = await fetch(`${ENGINE_URL}/solve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  } catch {
    return Response.json(
      { error: `engine unreachable at ${ENGINE_URL}. Is uvicorn running?` },
      { status: 502 },
    );
  }

  // Pass the engine's response through unchanged (including 422 on bad config).
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
