# Lapis — XRPL Architecture

## Overview

XRPL provides the equity and payment settlement layer for Lapis. Every financial primitive in the platform maps to a native XRPL transaction type — no custom smart contract language, no gas wars, 3–5 second finality on testnet.

---

## How Each Platform Step Maps to XRPL

### Step 1: AI Report Card Access (0.05 XRP via XRPL)

**Primitive:** `Payment` transaction + on-chain verification

The XRPL paywall middleware (in `packages/ai-agent/src/xrpl/paywall.ts`) intercepts HTTP requests and requires a proof-of-payment before serving the AI-generated startup report card. The flow:

1. Client sends 0.05 XRP to the founder wallet on XRPL testnet
2. Client includes the tx hash in the `X-Payment-TxHash` request header
3. Middleware calls `verifyPayment()` from `@lapis/xrpl-contracts` which:
   - Fetches the transaction by hash from the ledger
   - Checks `meta.delivered_amount` (NOT `Amount` — partial payment attack prevention)
   - Verifies destination address match
   - Confirms `validated: true` (not just submitted)
4. Verified tx hashes are cached in-memory for instant repeat access

This is the information gate. Without paying 0.05 XRP, you don't get the data. Without the data, the prediction market is noise. No external facilitators, no EVM chains — pure XRPL.

---

### Step 2: Prediction Market (Polymarket)

XRPL is not involved here. The prediction market runs on Polymarket (handled by `packages/ai-agent/src/polymarket/`). The market output — a consensus valuation — becomes the input to Step 3.

---

### Step 3: Equity Token Issuance (MPT)

**Primitive:** `MPTokenIssuanceCreate`

When the market settles on a valuation (e.g. $8M), the founder issues an MPT representing equity in the company. Critical flags set at issuance time (irreversible after first holder):

| Flag | Value | Effect |
|------|-------|--------|
| `tfMPTRequireAuth` | required | Founder must authorize each investor — KYC/accreditation gate |
| `tfMPTCanEscrow` | required | Shares can be locked in vesting escrow |
| `tfMPTCanLock` | required | Founder can freeze individual holdings if needed |
| `tfMPTCanTransfer` | founder's choice | Whether shares can trade on secondary market |
| `tfMPTCanTrade` | founder's choice | Whether shares can list on XRPL DEX |
| `TransferFee` | 0–50000 bps | Royalty on every secondary transfer — impossible in TradFi |

**Holder onboarding flow:**
1. Founder calls `MPTokenAuthorize` (issuer side) to admit each investor address
2. Investor calls `MPTokenAuthorize` (holder side) to opt in
3. Founder sends shares via `Payment` with MPT amount

**Why MPT over issued currencies (TrustLines)?**
- No trust line required from holder — lower reserve cost
- `tfMPTRequireAuth` gives the issuer a compliance gate by default
- `tfMPTCanEscrow` enables native vesting — the key feature for equity

---

### Step 4: Vesting Escrow

**Primitive:** `EscrowCreate` (MPT)

Shares are locked in escrow immediately after issuance. Two release mechanisms:

**Time-based (vesting cliff):**
```
FinishAfter = rippleTime of cliff date
CancelAfter = rippleTime of safety expiry
```
Anyone (including the agent) can call `EscrowFinish` after `FinishAfter`. No human unlock required.

**Condition-based (conversion trigger):**
```
Condition = PREIMAGE-SHA-256 crypto-condition
Fulfillment = submitted by the agent when trigger fires
```
The agent holds the fulfillment preimage. When a SAFE conversion event is confirmed (MetaLex webhook, on-chain signal), the agent calls `EscrowFinish` with the fulfillment. This is a trustless trustee.

**Why this matters:** In TradFi, vesting is enforced by a cap table spreadsheet and a lawyer. Here it's enforced by the ledger. The agent is the trustee, not a person.

---

### Step 5: Legal Anchor (MetaLex on Base)

Outside XRPL scope. The SAFE is deployed on Base via MetaLex and its hash is written into the MPT `Metadata` field at issuance, creating a bidirectional link between the on-chain token and the legal document.

---

## Data Flow Diagram

```
[Founder lists startup]
         │
         ▼
[AI Agent analyzes: GitHub, revenue, socials]
         │
         ▼
[Report Card published] ──► [Anyone pays 0.05 XRP to read it]
         │                            │
         ▼                            ▼
[Prediction Market opens]   [XRPL Payment + verifyPayment()]
         │
         ▼
[Market settles: $8M valuation]
         │
         ▼
[Founder issues MPT on XRPL]
   - tfMPTRequireAuth
   - tfMPTCanEscrow
   - TransferFee = royalty bps
         │
         ▼
[Investors authorized + opt in]
         │
         ▼
[Shares transferred into EscrowCreate]
   - FinishAfter = vesting cliff
   - OR Condition = crypto-condition
         │
         ▼
[Agent monitors conditions]
         │
    condition met?
         │
         ▼
[Agent calls EscrowFinish]
   - Time-based: no extra data needed
   - Conditional: submits Fulfillment
         │
         ▼
[Investor holds liquid equity MPT]
```

---

## Security Notes

- `delivered_amount` always checked over `Amount` (partial payment attack)
- Seeds stored in `.env`, never committed, never sent over network
- All transactions use `autofill()` for automatic `LastLedgerSequence`
- `submitAndWait()` everywhere — never trust submission result alone
- Mainnet endpoints are never hardcoded — config-driven via `XRPL_NETWORK`

---

## Testnet Setup

```bash
cd packages/xrpl-contracts
npm install
npm run setup    # generates wallets, funds via faucet
npm run demo     # full end-to-end flow
```

Explorer: https://testnet.xrpl.org
