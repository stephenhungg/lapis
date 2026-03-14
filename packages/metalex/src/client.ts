import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

export function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
}

export function getWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: base,
    transport: http(BASE_RPC_URL),
  });
}

export function getBaseExplorerUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

export function getContractExplorerUrl(address: string): string {
  return `https://basescan.org/address/${address}`;
}
