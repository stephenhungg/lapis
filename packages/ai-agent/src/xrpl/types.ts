import type { EquityToken, VestingEscrow } from "@lapis/xrpl-contracts";

export interface SettlementResult {
  marketId: string;
  reportId: string;
  companyName: string;
  consensusValuationM: number; // millions USD
  valuationCapXRP: string;
  equityToken: EquityToken;
  escrows: ParticipantEscrow[];
  rlusdFeeHash: string | null;
  rlusdTrustLineHash: string | null;
  settledAt: string;
  explorerLinks: string[];
  /** MetaLEX SAFE agreement on Base (present if BASE_PRIVATE_KEY set) */
  safe?: {
    contractAddress: string;
    documentHash: string;
    deployTxHash: string;
    linkTxHash: string | null;
    settleTxHash: string | null;
    baseSepoliaExplorerUrl: string;
    documentPreview: string;
  };
}

export interface ParticipantEscrow {
  userId: string;
  xrplAddress: string;
  escrow: VestingEscrow;
  sharesAllocated: string;
  condition: string;
  explorerLink: string;
}

export interface SettlementConfig {
  totalEquityShares: number;
  vestingCliffDays: number;
  cancelAfterDays: number;
  platformFeeBps: number; // 250 = 2.5%
  royaltyBps: number; // secondary transfer fee
  xrpUsdRate: number; // hardcoded for hackathon
  safeDiscountRateBps: number; // SAFE discount rate
  safeGoverningLaw: string;
  safeDisputeResolution: string;
}

export const DEFAULT_SETTLEMENT_CONFIG: SettlementConfig = {
  totalEquityShares: 10_000_000,
  vestingCliffDays: 90,
  cancelAfterDays: 365,
  platformFeeBps: 250,
  royaltyBps: 100,
  xrpUsdRate: 0.5,
  safeDiscountRateBps: 2000, // 20%
  safeGoverningLaw: "Delaware, USA",
  safeDisputeResolution: "Arbitration - JAMS",
};
