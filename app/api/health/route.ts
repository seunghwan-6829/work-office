export async function GET() {
  return Response.json({
    ok: true,
    service: "premiere-srt-asset-orchestrator",
    timestamp: new Date().toISOString()
  });
}