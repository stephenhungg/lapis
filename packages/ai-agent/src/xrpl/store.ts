import type { SettlementResult } from "./types.js";
import { redisGet, redisSet, redisGetAll } from "../redis.js";

const SETTLEMENT_PREFIX = "settlement:";
const FULFILLMENT_PREFIX = "fulfillment:";

export async function saveSettlement(
  marketId: string,
  result: SettlementResult
): Promise<void> {
  await redisSet(SETTLEMENT_PREFIX + marketId, result);
}

export async function getSettlement(
  marketId: string
): Promise<SettlementResult | undefined> {
  return redisGet<SettlementResult>(SETTLEMENT_PREFIX + marketId);
}

export async function getSettlementByReport(
  reportId: string
): Promise<SettlementResult | undefined> {
  const all = await redisGetAll<SettlementResult>(SETTLEMENT_PREFIX + "*");
  return all.find((s) => s.reportId === reportId);
}

export async function getAllSettlements(): Promise<SettlementResult[]> {
  return redisGetAll<SettlementResult>(SETTLEMENT_PREFIX + "*");
}

export async function storeFulfillment(
  ownerAddress: string,
  sequence: number,
  fulfillment: string
): Promise<void> {
  await redisSet(FULFILLMENT_PREFIX + `${ownerAddress}:${sequence}`, fulfillment);
}

export async function getFulfillment(
  ownerAddress: string,
  sequence: number
): Promise<string | undefined> {
  return redisGet<string>(FULFILLMENT_PREFIX + `${ownerAddress}:${sequence}`);
}
