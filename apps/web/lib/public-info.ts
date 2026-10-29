// Link to the hosted service when the landing page is previewed without backend credentials.
export const repositoryUrl = "https://github.com/Malote-MCP/malote";

export const transparencyUrl = new URL(
  "/api/transparency",
  process.env.PUBLIC_URL ?? "https://malote.io",
).href;
