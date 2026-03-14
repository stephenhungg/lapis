# @lapis/xrpl-contracts

Low-level XRPL transaction builders. Stateless library consumed by ai-agent for on-chain settlement.

## Source Map

| File | Purpose |
|------|---------|
| `src/client.ts` | Singleton WebSocket client. `getClient(network)` auto-connects. `disconnect()` cleanup |
| `src/wallet.ts` | `generateWallet`, `walletFromSeed`, `walletFromEnv(prefix)`, `fundWallet` (testnet faucet) |
| `src/mpt.ts` | MPTokenIssuanceCreate, authorizeHolder, holderOptIn, transferEquityShares, getMptHoldings |
| `src/escrow.ts` | EscrowCreate/Finish/Cancel, generateCryptoCondition (PREIMAGE-SHA-256), time helpers |
| `src/payments.ts` | XRP Payment, verifyPayment (for XRPL paywall), createPaymentChannel |
| `src/types.ts` | Network configs, StartupRound, EquityToken, VestingEscrow, PaymentVerification |

## Key Patterns

- All txns: `client.autofill(tx)` -> `wallet.sign(prepared)` -> `client.submitAndWait(blob)` -> check `tesSUCCESS`
- `walletFromEnv("FOUNDER")` loads `FOUNDER_SEED` from environment
- MPT: **holderOptIn FIRST, then authorizeHolder** (or you get tecOBJECT_NOT_FOUND)
- Crypto-conditions: uses node:crypto SHA-256 to hash DER-encoded preimage fulfillment
- Escrow with `mptIssuanceId: ""` uses XRP amount; non-empty uses MPT amount object
- Singleton client per process. Call `disconnect()` when done

## Scripts

- `npm run setup` -- generate 3 wallets, fund via faucet, populate .env
- `npm run demo` -- full flow: payment -> MPT issue -> authorize -> escrow -> wait -> release
- `npm test` -- vitest against testnet (slow, ~30s due to faucet funding)

## Testing Locally

```
npm run setup     # first time: generates wallets
npm run demo      # runs full 7-step demo on testnet
npm test          # vitest: mpt, escrow, payments tests
```
