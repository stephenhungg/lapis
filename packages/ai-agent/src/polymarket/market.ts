// Local prediction market simulation for PublicRound
// Since Polymarket doesn't support programmatic market creation,
// we run our own simple prediction market for startup valuations.

export interface MarketBet {
  userId: string;
  valuation: number; // in millions
  amount: number; // bet size in USD
  timestamp: string;
}

export interface ValuationMarket {
  id: string;
  reportId: string;
  githubUrl: string;
  status: "open" | "closed";
  bets: MarketBet[];
  consensusValuation: number | null; // weighted average in millions
  openedAt: string;
  closedAt: string | null;
  // agent's seed position
  agentValuation: number | null;
  agentConfidence: number | null;
}

const markets = new Map<string, ValuationMarket>();

export function createMarket(
  reportId: string,
  githubUrl: string,
  agentValuation?: number,
  agentConfidence?: number
): ValuationMarket {
  const market: ValuationMarket = {
    id: `mkt_${reportId.slice(0, 8)}`,
    reportId,
    githubUrl,
    status: "open",
    bets: [],
    consensusValuation: agentValuation || null,
    openedAt: new Date().toISOString(),
    closedAt: null,
    agentValuation: agentValuation || null,
    agentConfidence: agentConfidence || null,
  };

  // if agent has a valuation, place a seed bet
  if (agentValuation && agentConfidence) {
    market.bets.push({
      userId: "ai-agent",
      valuation: agentValuation,
      amount: agentConfidence, // confidence as bet weight
      timestamp: new Date().toISOString(),
    });
  }

  markets.set(market.id, market);
  return market;
}

export function placeBet(
  marketId: string,
  userId: string,
  valuation: number,
  amount: number
): ValuationMarket {
  const market = markets.get(marketId);
  if (!market) throw new Error(`Market not found: ${marketId}`);
  if (market.status !== "open") throw new Error("Market is closed");

  market.bets.push({
    userId,
    valuation,
    amount,
    timestamp: new Date().toISOString(),
  });

  // recalculate consensus as volume-weighted average
  const totalWeight = market.bets.reduce((sum, b) => sum + b.amount, 0);
  if (totalWeight > 0) {
    market.consensusValuation =
      market.bets.reduce((sum, b) => sum + b.valuation * b.amount, 0) / totalWeight;
  }

  return market;
}

export function closeMarket(marketId: string): ValuationMarket {
  const market = markets.get(marketId);
  if (!market) throw new Error(`Market not found: ${marketId}`);

  market.status = "closed";
  market.closedAt = new Date().toISOString();
  return market;
}

export function getMarketById(marketId: string): ValuationMarket | undefined {
  return markets.get(marketId);
}

export function getMarketByReport(reportId: string): ValuationMarket | undefined {
  for (const market of markets.values()) {
    if (market.reportId === reportId) return market;
  }
  return undefined;
}

// estimate a valuation from the report scores
// this is what the agent uses to seed the market
export function estimateValuation(overallScore: number): {
  valuation: number;
  confidence: number;
} {
  // map 0-100 score to $0.5M - $50M range (exponential)
  // higher scores = exponentially higher valuations
  const base = 0.5; // $500K minimum
  const valuation = base * Math.pow(1.05, overallScore);
  const rounded = Math.round(valuation * 10) / 10;

  // confidence is higher when score is more extreme (very high or very low)
  const distFromMiddle = Math.abs(overallScore - 50);
  const confidence = 50 + distFromMiddle;

  return { valuation: rounded, confidence };
}
