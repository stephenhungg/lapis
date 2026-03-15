import { getPublicClient, getWalletClient, getBaseExplorerUrl, getContractExplorerUrl } from "./client.js";
import type { SAFEDeployParams, SAFEDeployResult, SAFELinkResult, SAFEOnChainStatus } from "./types.js";
import artifact from "./abi/SAFEAgreement.json" with { type: "json" };

const abi = artifact.abi;
const bytecode = artifact.bytecode as `0x${string}`;

/**
 * Deploy a new SAFEAgreement contract to Base.
 * The deployer (agent) becomes the contract's `agent` role.
 */
export async function deploySAFE(
  agentPrivateKey: `0x${string}`,
  params: SAFEDeployParams
): Promise<SAFEDeployResult> {
  const walletClient = getWalletClient(agentPrivateKey);
  const publicClient = getPublicClient();

  const termsStruct = {
    companyName: params.companyName,
    valuationCapUSD: BigInt(params.valuationCapUSD),
    discountRateBps: BigInt(params.discountRateBps),
    investmentAmountUSD: BigInt(params.investmentAmountUSD),
    governingLaw: params.governingLaw,
    disputeResolution: params.disputeResolution,
  };

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [
      params.founderEvmAddress,
      params.documentHash,
      termsStruct,
      params.investorAddresses,
      params.xrplNetwork,
      params.founderXrplAddress,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });

  if (!receipt.contractAddress) {
    throw new Error(`Contract deployment failed: no contract address in receipt (tx: ${hash})`);
  }

  return {
    contractAddress: receipt.contractAddress,
    transactionHash: hash,
    blockNumber: Number(receipt.blockNumber),
    documentHash: params.documentHash,
    explorerUrl: getContractExplorerUrl(receipt.contractAddress),
  };
}

/**
 * Link an XRPL MPT issuance ID to the SAFE contract (bidirectional cross-chain link).
 * Can only be called once by the agent.
 */
export async function linkXRPL(
  agentPrivateKey: `0x${string}`,
  contractAddress: `0x${string}`,
  mptIssuanceId: string
): Promise<SAFELinkResult> {
  const walletClient = getWalletClient(agentPrivateKey);
  const publicClient = getPublicClient();

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "linkXRPL",
    args: [mptIssuanceId],
  });

  await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });

  return {
    transactionHash: hash,
    mptIssuanceId,
    explorerUrl: getBaseExplorerUrl(hash),
  };
}

/**
 * Mark the SAFE as settled on Base (after XRPL escrows are created).
 */
export async function settleSAFE(
  agentPrivateKey: `0x${string}`,
  contractAddress: `0x${string}`
): Promise<`0x${string}`> {
  const walletClient = getWalletClient(agentPrivateKey);
  const publicClient = getPublicClient();

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "settle",
    args: [],
  });

  await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
  return hash;
}

/**
 * Read the current status of a SAFE contract (read-only, no gas).
 */
export async function readSAFEStatus(
  contractAddress: `0x${string}`
): Promise<SAFEOnChainStatus> {
  const publicClient = getPublicClient();

  const result = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: "getStatus",
    args: [],
  }) as [number, bigint, bigint, `0x${string}`, string];

  return {
    status: result[0],
    createdAt: result[1].toString(),
    confirmedAt: result[2].toString(),
    documentHash: result[3],
    mptIssuanceId: result[4],
  };
}

/**
 * Read the cross-chain link data from the contract.
 */
export async function readCrossChainLink(
  contractAddress: `0x${string}`
): Promise<{ xrplMptIssuanceId: string; xrplNetwork: string; founderXrplAddress: string }> {
  const publicClient = getPublicClient();

  const result = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: "getCrossChainLink",
    args: [],
  }) as { xrplMptIssuanceId: string; xrplNetwork: string; founderXrplAddress: string };

  return result;
}
