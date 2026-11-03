import { verify } from "sigstore";

const repository = "https://github.com/Malote-MCP/malote";
const workflow = ".github/workflows/publish-worker.yml";
export const signerIdentity = "^https://github\\.com/Malote-MCP/malote/\\.github/workflows/publish-worker\\.yml@refs/heads/main$";

type Statement = {
  _type?: string;
  subject?: { name?: string; digest?: { sha256?: string } }[];
  predicateType?: string;
  predicate?: {
    buildDefinition?: {
      buildType?: string;
      externalParameters?: { workflow?: { repository?: string; path?: string; ref?: string } };
      resolvedDependencies?: { uri?: string; digest?: { gitCommit?: string } }[];
    };
    runDetails?: { metadata?: { invocationId?: string } };
  };
};

/** Only use the statement after verifying its signature and the expected workflow identity. */
export async function verifyBuild(bundle: Parameters<typeof verify>[0], digest: string) {
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error("Digest inválido.");
  await verify(bundle, {
    certificateIssuer: "https://token.actions.githubusercontent.com",
    certificateIdentityURI: signerIdentity,
    timeout: 5000,
    retry: 0,
    tufCachePath: "/tmp/malote-sigstore",
  });
  if (bundle.dsseEnvelope?.payloadType !== "application/vnd.in-toto+json") throw new Error("Formato de prova inválido.");
  const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, "base64").toString()) as Statement;
  const definition = statement.predicate?.buildDefinition;
  const source = definition?.externalParameters?.workflow;
  const commit = definition?.resolvedDependencies?.find(d => d.uri === `git+${repository}@refs/heads/main`)?.digest?.gitCommit;
  const buildUrl = statement.predicate?.runDetails?.metadata?.invocationId;
  if (
    statement._type !== "https://in-toto.io/Statement/v1" ||
    statement.predicateType !== "https://slsa.dev/provenance/v1" ||
    definition?.buildType !== "https://actions.github.io/buildtypes/workflow/v1" ||
    !statement.subject?.some(s => s.name === "ghcr.io/malote-mcp/malote/worker" && s.digest?.sha256 === digest.slice(7)) ||
    source?.repository !== repository || source?.path !== workflow || source?.ref !== "refs/heads/main" ||
    !commit || !/^[a-f0-9]{40}$/.test(commit) ||
    !buildUrl || !/^https:\/\/github\.com\/Malote-MCP\/malote\/actions\/runs\/\d+(\/attempts\/\d+)?$/.test(buildUrl)
  ) throw new Error("A proveniência não liga esta imagem ao workflow público do Malote.");
  return { digest, commit, commitUrl: `${repository}/commit/${commit}`, buildUrl };
}
