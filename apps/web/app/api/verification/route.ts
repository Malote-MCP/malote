import { verifyBuild } from "@/lib/build-provenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const listRoot = "https://raw.githubusercontent.com/Malote-MCP/malote/main/infra/gcp/allowed-digests";
const cache = new Map<string, { expires: number; value: Awaited<ReturnType<typeof verifyBuild>> }>();

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const digest = params.get("digest") ?? "";
  const env = params.get("env") ?? "production";
  const headers = { "Cache-Control": "no-store" };
  if (!["production", "staging"].includes(env)) return Response.json({ error: "Ambiente inválido." }, { status: 400, headers });
  const key = `${env}:${digest}`;
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) return Response.json({ error: "Digest inválido." }, { status: 400, headers });
  try {
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return Response.json(cached.value, { headers });
    const list = await fetch(`${listRoot}/${env}.txt`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
    if (!list.ok) throw new Error("Lista pública indisponível.");
    const allowed = (await list.text()).split("\n").some(line => line.trim().split(/\s+/).at(-1) === digest);
    if (!allowed) return Response.json({ error: "Imagem ausente da lista pública do ambiente." }, { status: 422, headers });
    const response = await fetch(`https://api.github.com/repos/Malote-MCP/malote/attestations/${digest}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Proveniência do GitHub indisponível.");
    const { attestations } = await response.json();
    for (const attestation of (attestations ?? []).slice(0, 10)) {
      try {
        const value = await verifyBuild(attestation.bundle, digest);
        if (cache.size > 32) cache.clear();
        cache.set(key, { expires: Date.now() + 300_000, value });
        return Response.json(value, { headers });
      } catch { /* Another bundle may be from a different workflow; it cannot turn the check green. */ }
    }
    return Response.json({ error: "Nenhuma proveniência assinada válida para esta imagem." }, { status: 422, headers });
  } catch {
    return Response.json({ error: "Não foi possível verificar a proveniência agora." }, { status: 503, headers });
  }
}
