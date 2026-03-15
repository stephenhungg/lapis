/**
 * Standalone MetaLEX SAFE demo on Base.
 * Run: npm run demo
 *
 * Requires BASE_PRIVATE_KEY env var with testnet ETH on Base.
 */
import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

import {
  deploySAFE,
  linkXRPL,
  settleSAFE,
  readSAFEStatus,
  readCrossChainLink,
  generateSAFEDocument,
  getContractExplorerUrl,
} from "../src/index.js";

const PRIVATE_KEY = process.env.BASE_PRIVATE_KEY as `0x${string}`;
if (!PRIVATE_KEY) {
  console.error("BASE_PRIVATE_KEY not set in .env");
  process.exit(1);
}

async function main() {
  console.log("=== MetaLEX SAFE Demo (Base) ===\n");

  // 1. Generate SAFE document
  console.log("1. Generating SAFE document...");
  const safeDoc = generateSAFEDocument({
    companyName: "Demo Corp",
    valuationCapUSD: 8_000_000,
    discountRateBps: 2000,
    investmentAmountUSD: 200_000,
    founderXrplAddress: "rDemoFounderXRPLAddress",
    investorCount: 3,
    consensusValuationM: 8,
    reportSummary: "Strong code quality, active team, growing traction",
    governingLaw: "Delaware, USA",
    disputeResolution: "Arbitration - JAMS",
  });
  console.log(`   Document hash: ${safeDoc.hash}`);
  console.log(`   Document length: ${safeDoc.text.length} chars\n`);

  // 2. Deploy SAFE contract
  console.log("2. Deploying SAFE contract to Base...");
  const deployResult = await deploySAFE(PRIVATE_KEY, {
    founderEvmAddress: PRIVATE_KEY.slice(0, 42) as `0x${string}`, // placeholder
    documentHash: safeDoc.hash,
    companyName: "Demo Corp",
    valuationCapUSD: 8_000_000,
    discountRateBps: 2000,
    investmentAmountUSD: 200_000,
    governingLaw: "Delaware, USA",
    disputeResolution: "Arbitration - JAMS",
    investorAddresses: [],
    xrplNetwork: "testnet",
    founderXrplAddress: "rDemoFounderXRPLAddress",
  });
  console.log(`   Contract: ${deployResult.contractAddress}`);
  console.log(`   TX: ${deployResult.transactionHash}`);
  console.log(`   Block: ${deployResult.blockNumber}`);
  console.log(`   Explorer: ${deployResult.explorerUrl}\n`);

  // 3. Read initial status
  console.log("3. Reading on-chain status...");
  let status = await readSAFEStatus(deployResult.contractAddress);
  console.log(`   Status: ${["Proposed", "Confirmed", "Settled", "Voided"][status.status]}`);
  console.log(`   Document hash: ${status.documentHash}`);
  console.log(`   MPT ID: ${status.mptIssuanceId || "(not linked yet)"}\n`);

  // 4. Link XRPL MPT
  const fakeMptId = "00000001DEADBEEF00000000000000000000000000000000";
  console.log(`4. Linking XRPL MPT ID: ${fakeMptId}...`);
  const linkResult = await linkXRPL(PRIVATE_KEY, deployResult.contractAddress, fakeMptId);
  console.log(`   TX: ${linkResult.transactionHash}`);
  console.log(`   Explorer: ${linkResult.explorerUrl}\n`);

  // 5. Verify cross-chain link
  console.log("5. Verifying cross-chain link...");
  const crossChain = await readCrossChainLink(deployResult.contractAddress);
  console.log(`   XRPL MPT ID: ${crossChain.xrplMptIssuanceId}`);
  console.log(`   XRPL Network: ${crossChain.xrplNetwork}`);
  console.log(`   Founder XRPL: ${crossChain.founderXrplAddress}\n`);

  // 6. Settle
  console.log("6. Marking SAFE as settled...");
  const settleTxHash = await settleSAFE(PRIVATE_KEY, deployResult.contractAddress);
  console.log(`   TX: ${settleTxHash}\n`);

  // 7. Final status
  console.log("7. Final on-chain status...");
  status = await readSAFEStatus(deployResult.contractAddress);
  console.log(`   Status: ${["Proposed", "Confirmed", "Settled", "Voided"][status.status]}`);
  console.log(`   MPT ID: ${status.mptIssuanceId}\n`);

  console.log("=== Demo Complete ===");
  console.log(`Contract: ${getContractExplorerUrl(deployResult.contractAddress)}`);
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
