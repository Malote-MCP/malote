/**
 * When an enclave serves MCP, tokens and media, the web app must not: those routes would put tokens
 * and decrypted content back into a process outside the enclave.
 */
export function movedToEnclave() {
  const url = process.env.ENCLAVE_URL;
  if (!url) return null;
  return Response.json({ error: `Este endpoint foi movido para o enclave: ${url}` }, { status: 410 });
}
