/**
 * Lapis — Demo Seed Script
 *
 * Populates the running server with real data for demo purposes.
 * Analyzes 3 GitHub repos, opens markets, places bets from fake users,
 * and optionally settles one on XRPL.
 *
 * Usage:
 *   npm run seed                    # seed without settlement
 *   npm run seed -- --settle        # seed + settle first market on XRPL
 *
 * Prerequisites:
 *   - Server must be running (npm run dev)
 *   - ANTHROPIC_API_KEY and GITHUB_TOKEN set in .env
 *   - For --settle: FOUNDER_SEED and AGENT_SEED set in .env
 */

const API = process.env.LAPIS_API_URL || "http://localhost:3001";
const SETTLE = process.argv.includes("--settle");

// ── repos to analyze ─────────────────────────────────────────────
const REPOS = [
  {
    githubUrl: "https://github.com/ripple/rippled",
    bets: [
      { userId: "alice", valuation: 25, amount: 500 },
      { userId: "bob", valuation: 18, amount: 300 },
      { userId: "charlie", valuation: 30, amount: 200 },
    ],
  },
  {
    githubUrl: "https://github.com/anthropics/anthropic-sdk-python",
    bets: [
      { userId: "alice", valuation: 40, amount: 400 },
      { userId: "dave", valuation: 35, amount: 250 },
    ],
  },
  {
    githubUrl: "https://github.com/vercel/next.js",
    bets: [
      { userId: "bob", valuation: 45, amount: 600 },
      { userId: "eve", valuation: 50, amount: 350 },
      { userId: "charlie", valuation: 42, amount: 150 },
    ],
  },
];

// ── helpers ──────────────────────────────────────────────────────

async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json() as { success: boolean; data: T; error?: string };
  if (!json.success) throw new Error(json.error || `API error: ${res.status}`);
  return json.data;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function separator(label: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(60));
}

// ── poll until report is complete ────────────────────────────────

async function waitForReport(
  reportId: string,
  repoName: string
): Promise<void> {
  const maxAttempts = 60; // 2 minutes max
  for (let i = 0; i < maxAttempts; i++) {
    const data = await api<{
      status: string;
      scores: Record<string, number> | null;
      error: string | null;
    }>(`/report/${reportId}/score`);

    if (data.status === "complete" && data.scores) {
      console.log(`  ${repoName} — done (overall: ${data.scores.overall})`);
      return;
    }
    if (data.status === "error") {
      throw new Error(`Analysis failed for ${repoName}: ${data.error}`);
    }

    process.stdout.write(`  ${repoName} — ${data.status}...`);
    process.stdout.write("\r");
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for ${repoName}`);
}

// ── main ─────────────────────────────────────────────────────────

async function main() {
  console.log("\n  Lapis Demo Seed\n");

  // check server is up
  try {
    await api<{ status: string }>("/health");
    console.log("  Server is running\n");
  } catch {
    console.error("  ERROR: Server not reachable at", API);
    console.error("  Start it first: npm run dev:agent\n");
    process.exit(1);
  }

  // ── Step 1: Analyze repos ──────────────────────────────────────
  separator("STEP 1 — Submitting repos for analysis");

  const reports: { id: string; githubUrl: string; repoName: string }[] = [];

  for (const repo of REPOS) {
    const data = await api<{ id: string; status: string }>("/analyze", {
      method: "POST",
      body: JSON.stringify({ githubUrl: repo.githubUrl }),
    });
    const repoName = repo.githubUrl.split("/").slice(-2).join("/");
    reports.push({ id: data.id, githubUrl: repo.githubUrl, repoName });
    console.log(`  Submitted ${repoName} — id: ${data.id}`);
  }

  // ── Step 2: Wait for all to complete ───────────────────────────
  separator("STEP 2 — Waiting for analysis (this takes ~30s per repo)");

  await Promise.all(
    reports.map((r) => waitForReport(r.id, r.repoName))
  );

  console.log("\n  All analyses complete");

  // ── Step 3: Open markets ───────────────────────────────────────
  separator("STEP 3 — Opening prediction markets");

  const markets: { marketId: string; repoName: string; reportId: string }[] = [];

  for (const report of reports) {
    const data = await api<{ id: string; agentValuation: number | null }>(
      `/market/${report.id}`,
      { method: "POST" }
    );
    markets.push({
      marketId: data.id,
      repoName: report.repoName,
      reportId: report.id,
    });
    console.log(
      `  ${report.repoName} — market: ${data.id} (agent seed: $${data.agentValuation?.toFixed(1)}M)`
    );
  }

  // ── Step 4: Place bets ─────────────────────────────────────────
  separator("STEP 4 — Placing bets");

  for (let i = 0; i < REPOS.length; i++) {
    const repo = REPOS[i];
    const market = markets[i];

    for (const bet of repo.bets) {
      await api(`/market/${market.marketId}/bet`, {
        method: "POST",
        body: JSON.stringify(bet),
      });
      console.log(
        `  ${market.repoName} — ${bet.userId} bet $${bet.amount} at $${bet.valuation}M`
      );
    }
  }

  // show consensus
  console.log("");
  for (const market of markets) {
    const data = await api<{ consensusValuation: number | null }>(
      `/market/${market.marketId}`
    );
    console.log(
      `  ${market.repoName} consensus: $${data.consensusValuation?.toFixed(1)}M`
    );
  }

  // ── Step 5: Settle (optional) ──────────────────────────────────
  if (SETTLE) {
    separator("STEP 5 — Settling first market on XRPL");

    const target = markets[0];
    console.log(`  Settling ${target.repoName}...`);
    console.log(`  (this takes ~30s on testnet)\n`);

    try {
      const data = await api<{
        companyName: string;
        consensusValuationM: number;
        equityToken: { mptIssuanceId: string };
        escrows: { userId: string; explorerLink: string }[];
        safe?: { contractAddress: string; baseSepoliaExplorerUrl: string };
        explorerLinks: string[];
      }>(`/market/${target.marketId}/settle`, { method: "POST" });

      console.log(`  Company: ${data.companyName}`);
      console.log(`  Valuation: $${data.consensusValuationM}M`);
      console.log(`  MPT ID: ${data.equityToken.mptIssuanceId}`);

      if (data.safe) {
        console.log(`  SAFE: ${data.safe.baseSepoliaExplorerUrl}`);
      }

      console.log(`  Escrows:`);
      for (const e of data.escrows) {
        console.log(`    ${e.userId}: ${e.explorerLink}`);
      }

      console.log(`\n  Explorer links:`);
      for (const link of data.explorerLinks) {
        console.log(`    ${link}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Settlement failed: ${msg}`);
      console.error(
        `  Make sure FOUNDER_SEED and AGENT_SEED are set in packages/ai-agent/.env`
      );
    }
  }

  // ── Done ───────────────────────────────────────────────────────
  separator("SEED COMPLETE");

  console.log(`\n  Data ready at ${API}`);
  console.log(`  Reports: ${reports.length}`);
  console.log(`  Markets: ${markets.length}`);
  if (SETTLE) console.log(`  Settled: 1`);
  console.log(`\n  Open ${API.replace("localhost", "localhost")}/health to verify\n`);
  console.log(`  Frontend: https://lapis.bet/dashboard\n`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
