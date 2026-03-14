# @lapis/xrpl-contracts

XRPL blockchain logic for Lapis. Handles equity token issuance (MPT), vesting escrow, and payment verification.

## Setup

```bash
npm install
cp .env.example .env
npm run setup     # generates 3 wallets, funds via testnet faucet, writes .env
```

## Demo (live stage)

```bash
npm run demo
```

Runs the full flow end-to-end on testnet:
1. Verifies XRPL micropayment (0.05 XRP report access)
2. Issues equity MPT with royalty flags
3. Authorizes investors, transfers shares
4. Locks shares in vesting escrow (30s cliff in demo mode)
5. Agent auto-releases escrow when cliff passes

## Structure

```
src/
  client.ts    — singleton XRPL client (testnet)
  wallet.ts    — wallet generation, funding, balance queries
  types.ts     — TypeScript interfaces
  mpt.ts       — equity token issuance + holder management
  escrow.ts    — vesting escrow create/release/cancel
  payments.ts  — XRP payments + XRPL paywall verification
scripts/
  setup-testnet.ts   — fund wallets, write .env
  demo.ts            — full live demo
tests/
  payments.test.ts
  mpt.test.ts
  escrow.test.ts
```

## Key XRPL primitives

| Feature | Primitive | Purpose |
|---------|-----------|---------|
| Equity token | `MPTokenIssuanceCreate` | Shares as on-chain instrument |
| Royalties | `TransferFee` on MPT | Founder earns on secondary sales |
| Vesting lock | `EscrowCreate` (MPT) | Shares locked until cliff/condition |
| Trustee release | `EscrowFinish` | Agent submits when condition met |
| Report access | `Payment` + `verifyPayment` | XRPL micropayment verification |

## Tests

```bash
npm test
```

Integration tests run against testnet. Faucet funding takes ~10s.

## Network

Always testnet during development. Never commit `.env`.
