# @lapis/ai-agent

Express server (port 3001) that orchestrates the full Lapis pipeline: scrape -> analyze -> market -> settle on XRPL.

## Source Map

| File | Purpose |
|------|---------|
| `src/server.ts` | Entry point. Loads .env, wires cors + json + XRPL paywall middleware + router |
| `src/pipeline.ts` | Orchestrates scrape -> analyze -> audit. Fire-and-forget from route handler |
| `src/store.ts` | In-memory Map for ReportCard objects. createReport, getReport, updateReport |
| `src/monitor.ts` | setInterval polling loop. Re-scrapes, re-analyzes, auto-adjusts market bets on changes |
| `src/analysis/scorer.ts` | Calls Claude API. Retry once on JSON parse failure. Exports CLAUDE_MODEL constant |
| `src/analysis/adversarial.ts` | Red-team audit via second Claude call. Finds red flags, computes trust score |
| `src/analysis/prompts.ts` | SYSTEM_PROMPT + buildAnalysisPrompt. Includes Polymarket sentiment context |
| `src/polymarket/client.ts` | Real Polymarket Gamma API. detectIndustry + getIndustrySentiment |
| `src/polymarket/market.ts` | Local prediction market (Map). createMarket, placeBet, closeMarket, estimateValuation |
| `src/scrapers/github.ts` | Octokit scraper. Parallel: repo, languages, commits, contributors, CI check |
| `src/scrapers/social.ts` | Mock social data. Deterministic output seeded by handle hash |
| `src/xrpl/paywall.ts` | XRPL micropayment paywall. Verifies XRP payment via on-chain tx hash, caches verified hashes |
| `src/xrpl/settle.ts` | Core settlement: market close -> MPT issuance -> escrows -> RLUSD. Has mutex lock |
| `src/xrpl/rlusd.ts` | RLUSD trust line setup + issued currency payment helpers |
| `src/xrpl/store.ts` | In-memory settlement + fulfillment (crypto-condition) storage |
| `src/xrpl/monitor-hook.ts` | Reacts to score changes. Alerts on >15pt drops, could cancel escrows |
| `src/xrpl/types.ts` | SettlementResult, ParticipantEscrow, SettlementConfig interfaces |
| `api/routes.ts` | All Express route handlers. Single router, 14 endpoints |

## Key Patterns

- **Fire-and-forget pipeline**: POST /analyze returns 201 immediately. Pipeline runs async. Poll /report/:id/score
- **ApiResponse<T>**: All routes return `{ success: true, data: T }` or `{ success: false, error: string }`
- **Serial XRPL settlement**: Escrows created one at a time (sequence number constraint). Max 5 participants
- **Monitor -> XRPL hook**: score changes trigger `onScoreChange()` which checks for escrow adjustments
- **Non-critical stages**: Polymarket sentiment and adversarial audit fail gracefully without blocking

## Adding a New Endpoint

1. Add route to `api/routes.ts` following the `ApiResponse<T>` pattern
2. Import business logic from `src/` (don't put logic in routes)
3. Add startup log line in `src/server.ts`
4. If async XRPL work: wrap in try/catch, return partial results on failure

## Running

```
npm run dev      # tsx watch src/server.ts
npm run build    # tsc
npm run start    # node dist/src/server.js
```
