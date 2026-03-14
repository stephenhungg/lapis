export {
  searchPolymarket,
  getMarket,
  getIndustrySentiment,
  detectIndustry,
} from "./client.js";
export type {
  PolymarketEvent,
  PolymarketMarket,
  MarketSentiment,
  IndustrySentiment,
} from "./client.js";
export {
  createMarket,
  placeBet,
  closeMarket,
  getMarketById,
  getMarketByReport,
  estimateValuation,
} from "./market.js";
export type { ValuationMarket, MarketBet } from "./market.js";
