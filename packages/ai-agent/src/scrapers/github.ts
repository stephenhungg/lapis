import { Octokit } from "@octokit/rest";
import type { GitHubData, CommitSummary, ContributorSummary } from "@publicround/shared";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || undefined,
});

function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export async function scrapeGitHub(repoUrl: string): Promise<GitHubData> {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [repoInfo, languages, commits, contributors, rootContents, ciCheck] =
    await Promise.all([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.repos.listLanguages({ owner, repo }),
      octokit.rest.repos.listCommits({ owner, repo, since: thirtyDaysAgo, per_page: 100 }).catch(() => ({ data: [] })),
      octokit.rest.repos.listContributors({ owner, repo, per_page: 10 }).catch(() => ({ data: [] })),
      octokit.rest.repos.getContent({ owner, repo, path: "" }).catch(() => ({ data: [] })),
      octokit.rest.repos.getContent({ owner, repo, path: ".github/workflows" }).catch(() => null),
    ]);

  const rootFiles = Array.isArray(rootContents.data)
    ? rootContents.data.map((f: { name: string }) => f.name.toLowerCase())
    : [];

  const commitData = Array.isArray(commits.data) ? commits.data : [];
  const recentCommits: CommitSummary[] = commitData.map((c) => ({
    sha: c.sha ?? "",
    message: c.commit?.message?.split("\n")[0] ?? "",
    date: c.commit?.author?.date ?? "",
    author: c.commit?.author?.name ?? c.author?.login ?? "unknown",
  }));

  const contribData = Array.isArray(contributors.data) ? contributors.data : [];
  const contributorList: ContributorSummary[] = (
    contribData as Array<{ login?: string; contributions?: number }>
  ).map((c) => ({
    login: c.login ?? "unknown",
    contributions: c.contributions ?? 0,
  }));

  return {
    owner,
    repo,
    stars: repoInfo.data.stargazers_count,
    forks: repoInfo.data.forks_count,
    openIssues: repoInfo.data.open_issues_count,
    languages: languages.data as Record<string, number>,
    totalCommits: recentCommits.length,
    recentCommits,
    contributors: contributorList,
    createdAt: repoInfo.data.created_at,
    updatedAt: repoInfo.data.updated_at,
    description: repoInfo.data.description,
    hasReadme: rootFiles.some((f: string) => f.startsWith("readme")),
    hasLicense: rootFiles.some((f: string) => f.startsWith("license")),
    hasCi: ciCheck !== null,
  };
}
