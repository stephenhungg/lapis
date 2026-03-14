# Lapis

AI-powered startup valuations settled on XRPL. Hackathon project (BabHacks 2026).

## Architecture

npm workspaces monorepo with 3 packages:

| Package | Name | Purpose |
|---------|------|---------|
| `packages/shared` | `@lapis/shared` | Shared TypeScript types (ReportCard, GitHubData, etc) |
| `packages/ai-agent` | `@lapis/ai-agent` | Express server (port 3001) - analysis, markets, XRPL settlement |
| `packages/xrpl-contracts` | `@lapis/xrpl-contracts` | XRPL primitives - MPT tokens, escrows, payments, wallets |
| `apps/web` | web | Next.js frontend (separate team) |

## Data Flow

```
1. POST /analyze {githubUrl}
   -> scrapeGitHub (Octokit) + scrapeSocial (mock) in parallel
   -> fetch Polymarket sentiment (real API, non-critical)
   -> Claude API analysis (scorer.ts) -> scores {codeQuality, teamStrength, traction, socialPresence, overall}
   -> adversarial audit (second Claude call, non-critical)
   -> ReportCard stored in-memory

2. POST /market/:reportId
   -> agent seeds market with estimateValuation(overall_score) -> $0.5M-$50M range
   -> crowd bets via POST /market/:id/bet -> consensus = volume-weighted average

3. POST /market/:id/settle (the money route)
   -> close market -> load XRPL wallets
   -> issueEquityToken (MPT with company metadata)
   -> for each participant: fund wallet, holderOptIn, authorizeHolder, createVestingEscrow with crypto-condition
   -> setupTrustLine (RLUSD) + sendRlusdPayment (platform fee)
   -> return SettlementResult with explorer links
```

## Tech Stack

- TypeScript ES2022, `"type": "module"`, Node16 moduleResolution
- **All imports must use `.js` extension** (ESM requirement)
- `tsx watch` for dev, `tsc` for build
- Express 4 with typed `ApiResponse<T>` wrapper
- Claude API via `@anthropic-ai/sdk` (model: `claude-sonnet-4-20250514`, configurable via CLAUDE_MODEL env)
- Octokit for GitHub REST API
- xrpl v4.6.0 for XRPL transactions
- In-memory storage (Maps) -- state lost on server restart

## Build Order

shared must compile first (ai-agent references its types):
```
npm run build    # builds shared then ai-agent (sequenced in root package.json)
npm run dev:agent  # runs tsx watch on ai-agent (no build needed for dev)
```

## Environment Variables

### packages/ai-agent/.env
| Var | Required | Purpose |
|-----|----------|---------|
| `ANTHROPIC_API_KEY` | yes | Claude API key for analysis |
| `GITHUB_TOKEN` | yes | GitHub REST API (higher rate limits) |
| `PORT` | no | Server port (default: 3001) |
| `FOUNDER_SEED` | for XRPL | XRPL testnet wallet seed (issues MPTs, creates escrows) |
| `AGENT_SEED` | for XRPL | AI agent's XRPL wallet (receives fees, releases escrows) |
| `XRPL_NETWORK` | no | testnet (default), devnet, mainnet |
| `RLUSD_ISSUER` | no | RLUSD issuer address (has default) |
| `CLAUDE_MODEL` | no | Override Claude model (default: claude-sonnet-4-20250514) |

### packages/xrpl-contracts/.env
| Var | Required | Purpose |
|-----|----------|---------|
| `FOUNDER_SEED` | for demo | Founder wallet |
| `INVESTOR1_SEED` | for demo | First investor wallet |
| `INVESTOR2_SEED` | for demo | Second investor wallet |

Generate XRPL testnet wallets: `cd packages/xrpl-contracts && npm run setup`

## API Endpoints (port 3001)

| Method | Path | Description |
|--------|------|-------------|
| POST | /analyze | Submit GitHub URL for AI analysis |
| GET | /report/:id/score | Poll analysis status + scores (free) |
| GET | /report/:id | Full report card (XRPL paywalled — send 0.05 XRP, include tx hash in X-Payment-TxHash header) |
| POST | /market/:reportId | Open prediction market for a report |
| POST | /market/:id/bet | Place a valuation bet |
| POST | /market/:id/close | Close market, finalize consensus |
| POST | /market/:id/settle | **Close + settle on XRPL** (MPT + escrows + RLUSD) |
| GET | /market/:id | Get market data |
| POST | /monitor/:reportId | Start watching repo for changes |
| DELETE | /monitor/:reportId | Stop watching |
| GET | /monitor | List monitored repos |
| GET | /xrpl/status | Wallet balances, settlements |
| POST | /xrpl/escrow/:id/release | Release a vesting escrow |
| GET | /health | Health check |

## Common Gotchas

- **ESM imports**: all import paths need `.js` extension, even for `.ts` files
- **In-memory state**: restarting the server loses all reports, markets, settlements
- **RLUSD on testnet**: trust line tx succeeds but payment fails with `tecPATH_DRY` (no RLUSD balance) -- expected
- **Settlement mutex**: concurrent settlements queue up (XRPL sequence number constraint)
- **Participant cap**: settlement limits to 5 participants for demo speed (~30s on testnet)
- **Pipeline is fire-and-forget**: POST /analyze returns 201 immediately, poll /report/:id/score
- **Polymarket + adversarial are non-critical**: pipeline completes even if they fail
- **XRPL holderOptIn before authorizeHolder**: must opt-in first or you get tecOBJECT_NOT_FOUND

## Custom Commands

- `/setup` -- first-time environment setup (checks deps, .env, builds)
- `/demo` -- full end-to-end demo (analyze -> market -> settle on XRPL)
- `/status` -- check server health, XRPL wallets, active monitors
