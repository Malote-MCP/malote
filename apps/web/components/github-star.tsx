import { repositoryUrl } from "@/lib/public-info";

const apiUrl = repositoryUrl.replace("https://github.com/", "https://api.github.com/repos/");

/** Real star count from GitHub, refreshed at most hourly; null when GitHub can't be reached. */
async function starCount(): Promise<number | null> {
  try {
    const res = await fetch(apiUrl, {
      headers: { accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const { stargazers_count } = (await res.json()) as { stargazers_count?: number };
    return typeof stargazers_count === "number" ? stargazers_count : null;
  } catch {
    return null;
  }
}

function formatCount(n: number) {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
}

export async function GitHubStar() {
  const stars = await starCount();
  const label =
    stars === null
      ? "Malote no GitHub. Abrir repositório em nova aba."
      : `Malote no GitHub: ${stars} ${stars === 1 ? "estrela" : "estrelas"}. Abrir repositório em nova aba.`;
  return (
    <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" className="site-github-star" aria-label={label}>
      <span className="site-github-star-mark" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.31-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 0Z" />
        </svg>
      </span>
      {stars !== null && (
        <span className="site-github-star-count" aria-hidden="true">
          {formatCount(stars)}
        </span>
      )}
    </a>
  );
}
