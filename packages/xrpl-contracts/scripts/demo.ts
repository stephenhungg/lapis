/**
 * Lapis — Live Stage Demo
 *
 * Flow:
 *   1. Load funded wallets from .env
 *   2. Issue equity MPT (founder)
 *   3. Authorize + opt-in investors
 *   4. Transfer shares into time-locked vesting escrow
 *   5. Simulate vesting cliff passing
 *   6. Agent releases escrow (condition met)
 *
 * Run: npm run demo
 */
import "dotenv/config"
import { walletFromEnv, getBalance } from "../src/wallet.js"
import { issueEquityToken, authorizeHolder, holderOptIn, transferEquityShares } from "../src/mpt.js"
import { createVestingEscrow, releaseEscrow, rippleTimeFromUnix } from "../src/escrow.js"
import { sendPayment, verifyPayment } from "../src/payments.js"
import { disconnect, getExplorerUrl } from "../src/client.js"
import fs from "fs"
import path from "path"

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function separator(label: string) {
  console.log(`\n${"─".repeat(60)}`)
  console.log(`  ${label}`)
  console.log("─".repeat(60))
}

async function main() {
  console.log("🎬 Lapis — Live Demo Starting\n")

  const founder = walletFromEnv("FOUNDER")
  const investor1 = walletFromEnv("INVESTOR1")
  const investor2 = walletFromEnv("INVESTOR2")

  console.log(`Founder  : ${founder.address}`)
  console.log(`Investor1: ${investor1.address}`)
  console.log(`Investor2: ${investor2.address}`)

  separator("STEP 1 — Check balances")

  const [fb, i1b, i2b] = await Promise.all([
    getBalance(founder.address),
    getBalance(investor1.address),
    getBalance(investor2.address),
  ])
  console.log(`Founder  : ${fb} XRP`)
  console.log(`Investor1: ${i1b} XRP`)
  console.log(`Investor2: ${i2b} XRP`)

  separator("STEP 2 — XRPL micropayment (0.05 XRP report access)")

  const paymentHash = await sendPayment(investor1, {
    destination: founder.address,
    amountXRP: "0.05",
    destinationTag: 1001,
    memo: "Lapis:report_access:startup_xyz",
  })

  const verification = await verifyPayment(
    paymentHash,
    founder.address,
    "0.05",
    1001
  )
  console.log(`Payment valid: ${verification.valid}`)
  console.log(`Delivered: ${verification.deliveredXRP} XRP`)

  separator("STEP 3 — Issue equity MPT (crowd priced at $8M → 1,000,000 shares)")

  const equityToken = await issueEquityToken(founder, {
    founderAddress: founder.address,
    companyName: "StartupXYZ",
    valuationCapXRP: "8000000",
    totalEquityShares: "1000000",
    transferable: false,
    royaltyBps: 500,
  })

  console.log(`MPT ID: ${equityToken.mptIssuanceId}`)

  separator("STEP 4 — Authorize investors and transfer shares")

  await holderOptIn(investor1, equityToken.mptIssuanceId)
  await holderOptIn(investor2, equityToken.mptIssuanceId)

  await authorizeHolder(founder, equityToken.mptIssuanceId, investor1.address)
  await authorizeHolder(founder, equityToken.mptIssuanceId, investor2.address)

  await transferEquityShares(founder, equityToken.mptIssuanceId, investor1.address, "50000")
  await transferEquityShares(founder, equityToken.mptIssuanceId, investor2.address, "30000")

  separator("STEP 5 — Lock shares in vesting escrow (1-year cliff)")

  const vestingCliff = new Date(Date.now() + 30 * 1000)
  const cancelAfter = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)

  // XRP escrow: locks investor's capital (10 XRP) payable to founder upon vesting
  // MPT shares are already held by investor — escrow enforces the payment side of the SAFE
  const escrow = await createVestingEscrow(founder, {
    beneficiaryAddress: investor1.address,
    mptIssuanceId: "",
    sharesAmount: "10",
    vestingCliffDate: vestingCliff,
    cancelAfterDate: cancelAfter,
  })

  console.log(`Escrow sequence: ${escrow.escrowSequence}`)
  console.log(`Cliff in: 30 seconds (demo mode)`)

  separator("STEP 6 — Waiting for vesting cliff...")

  process.stdout.write("  Counting down: ")
  for (let i = 30; i > 0; i--) {
    process.stdout.write(`${i} `)
    await sleep(1000)
  }
  console.log("\n")

  separator("STEP 7 — Agent releases escrow (condition met)")

  const releaseTx = await releaseEscrow(founder, escrow)

  console.log(`\n🎉 Equity unlocked for ${investor1.address}`)
  console.log(`   Tx: ${releaseTx}`)

  separator("DEMO COMPLETE")

  console.log(`\nSummary:`)
  console.log(`  Company    : ${equityToken.companyName}`)
  console.log(`  MPT ID     : ${equityToken.mptIssuanceId}`)
  console.log(`  Total shares issued: ${equityToken.totalShares}`)
  console.log(`  Royalty on secondary transfers: ${equityToken.royaltyBps / 100}%`)
  console.log(`  Escrow sequence: ${escrow.escrowSequence}`)
  console.log(`\n  Explorer: https://testnet.xrpl.org/accounts/${founder.address}`)

  const envPath = path.resolve(process.cwd(), ".env")
  let envContent = fs.readFileSync(envPath, "utf8")
  envContent = envContent
    .replace(/^MPT_ISSUANCE_ID=.*$/m, `MPT_ISSUANCE_ID=${equityToken.mptIssuanceId}`)
    .replace(/^ESCROW_SEQUENCE=.*$/m, `ESCROW_SEQUENCE=${escrow.escrowSequence}`)
  fs.writeFileSync(envPath, envContent)
  console.log(`\n.env updated with MPT_ISSUANCE_ID and ESCROW_SEQUENCE`)

  await disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
