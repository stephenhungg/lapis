# Lapis

**AI-powered startup valuations settled on XRPL.**

AI strips startups naked, the crowd prices them via prediction markets, and token holders get real equity on XRPL.

## What It Does

- **AI Analysis** -- Submit any GitHub repo. Claude analyzes code quality, team strength, traction, and social presence. An adversarial AI auditor red-teams the results.
- **Prediction Markets** -- The AI seeds a valuation market. The crowd places bets to reach consensus on what the startup is worth.
- **XRPL Settlement** -- When the market closes, the agent automatically issues MPT equity tokens, creates vesting escrows with crypto-conditions, and pays platform fees in RLUSD. All on-chain.
- **Continuous Monitoring** -- The agent watches repos for changes and re-analyzes. Score drops trigger escrow alerts.

## Quick Start

```bash
git clone https://github.com/stephenhungg/lapis.git
cd lapis
npm install

# Set up environment
cp packages/ai-agent/.env.example packages/ai-agent/.env
# Edit packages/ai-agent/.env -- add your ANTHROPIC_API_KEY and GITHUB_TOKEN

# Build shared types
npm run build

# Start the AI agent server
npm run dev:agent
```

In another terminal:
```bash
# Run the demo
./scripts/demo.sh https://github.com/expressjs/express
```

## XRPL Setup

```bash
cd packages/xrpl-contracts

# Generate and fund testnet wallets
npm run setup

# Copy FOUNDER_SEED and AGENT_SEED to packages/ai-agent/.env

# Run the XRPL demo (micropayment -> MPT -> escrow -> release)
npm run demo
```

## API Reference

All endpoints on `http://localhost:3001`:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/analyze` | Submit GitHub URL for AI analysis |
| `GET` | `/report/:id/score` | Poll analysis status + scores |
| `GET` | `/report/:id` | Full report card |
| `POST` | `/market/:reportId` | Open prediction market |
| `POST` | `/market/:id/bet` | Place a valuation bet |
| `POST` | `/market/:id/settle` | Close market + settle on XRPL |
| `GET` | `/market/:id` | Get market data |
| `POST` | `/monitor/:reportId` | Start watching a repo |
| `GET` | `/xrpl/status` | XRPL wallets and settlements |
| `POST` | `/xrpl/escrow/:id/release` | Release a vesting escrow |
| `GET` | `/health` | Health check |

## Project Structure

```
lapis/
  packages/
    shared/              # Shared TypeScript types
    ai-agent/            # Express server -- analysis, markets, XRPL settlement
      src/
        analysis/        # Claude API scoring + adversarial audit
        polymarket/      # Polymarket sentiment + local prediction market
        scrapers/        # GitHub (Octokit) + social (mock)
        xrpl/            # On-chain settlement + micropayment paywall
      api/routes.ts      # All endpoints
    xrpl-contracts/      # XRPL primitives (MPT, escrow, payments)
      src/
      scripts/           # setup + demo
      tests/
  apps/
    web/                 # Next.js frontend
  scripts/demo.sh        # Terminal demo
  docs/                  # Architecture docs
```

## Tech Stack

- TypeScript (ES2022, ESM)
- Express 4
- Claude API (Anthropic SDK)
- Octokit (GitHub REST API)
- xrpl.js v4 (XRPL WebSocket)
- Polymarket Gamma API
- Next.js (frontend)

## Hackathon Tracks

- **Ripple** -- XRPL native features: MPT equity tokens, vesting escrows with crypto-conditions, RLUSD stablecoin, XRP micropayment paywall
- **Polymarket** -- Real market sentiment data influencing AI analysis
- **Best Overall** -- Full-stack AI agent with agentic monitoring loop

---

Built at BabHacks 2026.
