# Lapis

**AI-powered startup valuations settled on XRPL.**

*AI strips a startup naked. The crowd prices it. The protocol gives you real equity with the terms locked on-chain.*

**Live:** [lapis.bet](https://lapis.bet) | **API:** [lapis-api-production.up.railway.app](https://lapis-api-production.up.railway.app/health)

---

## The Problem

Startup fundraising is broken in two ways. On the VC side, valuations are decided by a handful of people based on vibes and network. On the crypto side, token holders take all the risk but get zero equity. There's no transparency, no fair pricing, and no path from speculation to ownership.

## The Solution

Lapis is a platform where startups are forced to be transparent, the crowd prices them with real data, and token holders can convert to real equity with the terms enforced on-chain.

## How It Works

### 1. AI Analysis (the information layer)
A founder connects their GitHub and socials. The AI agent analyzes everything -- code quality, team strength, traction, social presence -- and publishes a standardized **Report Card**. An adversarial AI auditor red-teams the results. This replaces a VC associate spending 2 weeks doing due diligence behind closed doors.

### 2. Crowd Pricing (the market)
A prediction market opens: *"What is this startup worth?"* Unlike random speculation, bettors have **real data** from the AI report card. The market converges on a consensus valuation. This replaces one VC partner pulling a number out of thin air.

### 3. On-Chain Settlement (the equity)
One click settles the deal across two chains:

| Step | What Happens | XRPL Primitive |
|------|-------------|----------------|
| SAFE agreement deploys on Base | Legal anchor via MetaLEX pattern | -- |
| MPT equity token minted | Company shares with auth + transfer controls | **MPTokenIssuanceCreate** |
| Investors authorized | KYC/accreditation gate | **MPTokenAuthorize** (tfMPTRequireAuth) |
| Vesting escrows created | Shares locked with crypto-conditions | **EscrowCreate** (PREIMAGE-SHA-256) |
| RLUSD platform fee | Stablecoin payment to agent | **TrustSet** + **Payment** (RLUSD) |
| Cross-chain link | Base contract ↔ XRPL MPT metadata | Bidirectional |

Token holders now have real equity with vesting enforced by the ledger, not a lawyer.

---

## XRPL Primitives Used

This project combines **6 XRPL primitives** into a single cohesive settlement flow:

### Multi-Purpose Tokens (MPT)
- **MPTokenIssuanceCreate** with flags:
  - `tfMPTRequireAuth` -- founder must authorize each holder (KYC/accreditation gate)
  - `tfMPTCanEscrow` -- shares can be locked in vesting escrows
  - `tfMPTCanLock` -- founder can freeze holdings if needed
  - `tfMPTCanTransfer` + `tfMPTCanTrade` -- secondary market trading
  - `TransferFee` -- royalty on every secondary transfer (impossible in TradFi)
- **MPTokenAuthorize** -- holder opt-in + issuer authorization flow
- **Payment** with MPT amount -- share transfers

### Token Escrow with Crypto-Conditions
- **EscrowCreate** with `PREIMAGE-SHA-256` conditions
  - `FinishAfter` = vesting cliff (90 days default)
  - `CancelAfter` = safety expiry (365 days)
  - `Condition` = crypto-condition hash (agent holds the fulfillment preimage)
- **EscrowFinish** -- agent releases when conversion conditions are met
- The AI agent acts as a **trustless trustee** -- vesting is enforced by the ledger

### RLUSD Stablecoin
- **TrustSet** -- trust line setup for RLUSD issued currency
- **Payment** -- platform fee in RLUSD (USD-denominated stablecoin on XRPL)

### XRP Payments
- **Payment** -- micropayment verification for x402 report access ($0.05 XRP)
- `delivered_amount` always checked over `Amount` (partial payment attack prevention)

---

## Cross-Chain Architecture

Settlement creates a **bidirectional link** between two chains:

```
XRPL (Equity Layer)                    Base (Legal Layer)
┌─────────────────────┐                ┌─────────────────────┐
│ MPT Equity Token    │───metadata───→ │ SAFEAgreement.sol   │
│                     │                │                     │
│ Metadata: {         │                │ crossChain: {       │
│   safeContract: 0x… │                │   xrplMptId: "00…"  │
│   safeChain: "base" │                │   xrplNetwork: …    │
│ }                   │                │ }                   │
│                     │←──linkXRPL()───│                     │
│ Vesting Escrows     │                │ SAFE Terms          │
│ RLUSD Fee           │                │ Document Hash       │
└─────────────────────┘                └─────────────────────┘
         ↕                                      ↕
   XRPL Explorer                         BaseScan Explorer
```

MPT metadata stores the Base contract address. The Base contract stores the XRPL MPT issuance ID. Verifiable from either chain.

---

## Live Demo

### Frontend
Visit [lapis.bet](https://lapis.bet):
1. Submit a GitHub URL → watch AI analyze in real-time
2. See scores, strengths, red flags
3. Open a prediction market → place bets on valuation
4. Settle on XRPL → real MPT, real escrows, real explorer links

### API (deployed on Railway)
```bash
# 1. Submit a repo for analysis
curl -X POST https://lapis-api-production.up.railway.app/analyze \
  -H "Content-Type: application/json" \
  -d '{"githubUrl": "https://github.com/vercel/next.js", "twitterHandle": "vercel"}'

# 2. Poll until complete
curl https://lapis-api-production.up.railway.app/report/REPORT_ID/score

# 3. Get full AI report
curl https://lapis-api-production.up.railway.app/report/REPORT_ID

# 4. Open prediction market
curl -X POST https://lapis-api-production.up.railway.app/market/REPORT_ID

# 5. Place a bet (with your XRPL address for equity delivery)
curl -X POST https://lapis-api-production.up.railway.app/market/MARKET_ID/bet \
  -H "Content-Type: application/json" \
  -d '{"userId": "investor-1", "valuation": 30, "amount": 500, "xrplAddress": "rYourXRPLAddress..."}'

# 6. Settle on-chain (~30s)
curl -X POST https://lapis-api-production.up.railway.app/market/MARKET_ID/settle

# 7. Check your portfolio
curl https://lapis-api-production.up.railway.app/portfolio/investor-1

# 8. Verify on-chain SAFE
curl https://lapis-api-production.up.railway.app/safe/MARKET_ID
```

---

## Quick Start (Local)

```bash
git clone https://github.com/stephenhungg/lapis.git
cd lapis
npm install

# Set up environment
cp packages/ai-agent/.env.example packages/ai-agent/.env
# Edit .env: add ANTHROPIC_API_KEY, GITHUB_TOKEN, XAI_API_KEY

# Generate XRPL testnet wallets
cd packages/xrpl-contracts && npm run setup
# Copy FOUNDER_SEED and AGENT_SEED to packages/ai-agent/.env

# Build all packages
cd ../.. && npm run build

# Start the server
npm run dev:agent
```

## Project Structure

```
lapis/
  packages/
    shared/              # Shared TypeScript types (ReportCard, GitHubData, etc.)
    ai-agent/            # Express server (port 3001)
      src/
        analysis/        # Claude API scoring + adversarial audit
        polymarket/      # Prediction market engine
        scrapers/        # GitHub (Octokit) + X/Twitter (Grok API)
        xrpl/            # Settlement orchestrator + RLUSD + escrow store
      api/routes.ts      # 17 API endpoints
    xrpl-contracts/      # XRPL primitives (MPT, escrow, payments, wallets)
    metalex/             # MetaLEX SAFE on Base (Solidity + viem)
      contracts/         # SAFEAgreement.sol
      src/               # Deploy, link, settle, document generation
    cli/                 # Command-line interface
  apps/
    web/                 # Next.js frontend (lapis.bet)
```

## Tech Stack

- **TypeScript** (ES2022, ESM, strict mode)
- **Express 4** with typed ApiResponse<T> wrapper
- **Claude API** (Anthropic SDK) -- analysis + adversarial audit
- **Grok API** (xAI) -- real-time X/Twitter social data
- **Octokit** -- GitHub REST API scraping
- **xrpl.js v4** -- XRPL WebSocket client
- **viem** -- Base EVM interaction
- **Solidity 0.8.24** -- SAFEAgreement contract (compiled with solc)
- **Next.js 15** -- frontend
- **Redis** -- persistent storage
- **Railway** -- backend deployment
- **Vercel** -- frontend deployment

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/analyze` | Submit GitHub URL for AI analysis |
| `GET` | `/report/:id/score` | Poll analysis status + scores |
| `GET` | `/report/:id` | Full AI report card |
| `POST` | `/market/:reportId` | Open prediction market |
| `POST` | `/market/:id/bet` | Place bet (accepts optional xrplAddress) |
| `POST` | `/market/:id/settle` | Settle on XRPL + Base (~30s) |
| `GET` | `/market/:id` | Market data + all bets |
| `GET` | `/markets` | List all markets |
| `GET` | `/portfolio/:userId` | User's equity positions + active bets |
| `GET` | `/portfolio/wallet/:address` | Equity by XRPL address + on-chain holdings |
| `GET` | `/safe/:marketId` | SAFE agreement status (on-chain verified) |
| `POST` | `/monitor/:reportId` | Start watching repo for changes |
| `DELETE` | `/monitor/:reportId` | Stop watching |
| `GET` | `/monitor` | List monitored repos |
| `GET` | `/xrpl/status` | Wallet balances + all settlements |
| `POST` | `/xrpl/escrow/:id/release` | Release a vesting escrow |
| `GET` | `/health` | Health check |

## Hackathon Tracks

### Ripple ($4k)
**6 XRPL primitives** in one settlement flow: MPTokenIssuanceCreate (with auth, escrow, transfer, royalty flags), MPTokenAuthorize, EscrowCreate (PREIMAGE-SHA-256 crypto-conditions), EscrowFinish, TrustSet (RLUSD), Payment (RLUSD + XRP). The AI agent acts as a trustless trustee holding escrow fulfillment preimages.

### Polymarket ($2k)
Real Polymarket Gamma API sentiment data feeds into AI analysis context. Local prediction market engine for startup valuations with volume-weighted consensus.

### Best Overall ($2k)
Full-stack AI agent protocol: scraping, analysis, adversarial audit, prediction markets, cross-chain settlement (XRPL + Base), continuous monitoring with agentic loop, 17 API endpoints, deployed frontend + backend.

---

Built at BabHacks 2026.
