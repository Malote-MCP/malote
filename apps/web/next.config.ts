import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: ["@malote/db", "@malote/mcp"],
  serverExternalPackages: ["pg", "sigstore"],
  // One origin for the panel: the enclave only accepts token calls from https://malote.io.
  redirects: async () => [
    { source: "/:path*", has: [{ type: "host", value: "www.malote.io" }], destination: "https://malote.io/:path*", permanent: true },
  ],
};

export default config;
