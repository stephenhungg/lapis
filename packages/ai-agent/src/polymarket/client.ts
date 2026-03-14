// Polymarket API client for reading real prediction market data
// Used as a macro sentiment layer for startup analysis
// No auth needed for read-only endpoints

const GAMMA_API = "https://gamma-api.polymarket.com";

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  markets: PolymarketMarket[];
}

export interface PolymarketMarket {
  id: string;
  question: string;
  outcomePrices: string; // JSON string like "[0.65, 0.35]"
  volume: string;
  active: boolean;
}

export interface MarketSentiment {
  question: string;
  yesPrice: number; // 0-1, probability of "yes"
  volume: string;
}

export interface IndustrySentiment {
  industry: string;
  relatedMarkets: MarketSentiment[];
  overallSentiment: "bullish" | "bearish" | "neutral";
  sentimentScore: number; // -100 to 100
}

// search polymarket for related events (no auth needed)
export async function searchPolymarket(query: string): Promise<PolymarketEvent[]> {
  try {
    const res = await fetch(
      `${GAMMA_API}/events?title_contains=${encodeURIComponent(query)}&active=true&limit=5`
    );
    if (!res.ok) return [];
    return (await res.json()) as PolymarketEvent[];
  } catch {
    return [];
  }
}

// get a specific market's data
export async function getMarket(marketId: string): Promise<PolymarketMarket | null> {
  try {
    const res = await fetch(`${GAMMA_API}/markets/${marketId}`);
    if (!res.ok) return null;
    return (await res.json()) as PolymarketMarket;
  } catch {
    return null;
  }
}

// detect industry from github data
export function detectIndustry(
  description: string | null,
  languages: Record<string, number>,
  repoName: string
): string[] {
  const text = `${description || ""} ${repoName}`.toLowerCase();
  const langs = Object.keys(languages).map((l) => l.toLowerCase());
  const industries: string[] = [];

  // AI / ML
  if (
    text.match(/\b(ai|artificial intelligence|machine learning|ml|llm|gpt|neural|deep learning|nlp|computer vision)\b/) ||
    langs.includes("jupyter notebook") ||
    langs.includes("python")
  ) {
    industries.push("AI");
  }

  // Crypto / Blockchain / DeFi
  if (
    text.match(/\b(crypto|blockchain|defi|web3|token|nft|dao|ethereum|solana|xrpl|smart contract)\b/) ||
    langs.includes("solidity") ||
    langs.includes("rust")
  ) {
    industries.push("crypto");
  }

  // Fintech
  if (text.match(/\b(fintech|payment|banking|finance|trading|investment|lending)\b/)) {
    industries.push("fintech");
  }

  // Climate / Energy
  if (text.match(/\b(climate|energy|solar|carbon|sustainability|green|renewable|ev|electric vehicle)\b/)) {
    industries.push("climate");
  }

  // Healthcare
  if (text.match(/\b(health|medical|biotech|pharma|drug|clinical|patient|diagnosis)\b/)) {
    industries.push("healthcare");
  }

  // SaaS / Developer Tools
  if (text.match(/\b(saas|api|developer|devtool|infrastructure|cloud|platform)\b/)) {
    industries.push("tech");
  }

  // default to tech if nothing detected
  if (industries.length === 0) industries.push("tech");

  return industries;
}

// map industries to polymarket search queries
const INDUSTRY_QUERIES: Record<string, string[]> = {
  AI: ["artificial intelligence", "AI regulation", "OpenAI", "AI safety"],
  crypto: ["cryptocurrency", "bitcoin", "ethereum", "crypto regulation", "DeFi"],
  fintech: ["banking", "financial regulation", "interest rates", "recession"],
  climate: ["climate", "energy", "carbon", "renewable"],
  healthcare: ["healthcare", "FDA", "biotech", "pharmaceutical"],
  tech: ["technology", "tech regulation", "startup", "Silicon Valley"],
};

// fetch real polymarket sentiment for detected industries
export async function getIndustrySentiment(
  description: string | null,
  languages: Record<string, number>,
  repoName: string
): Promise<IndustrySentiment[]> {
  const industries = detectIndustry(description, languages, repoName);
  const results: IndustrySentiment[] = [];

  for (const industry of industries) {
    const queries = INDUSTRY_QUERIES[industry] || [industry];
    const allMarkets: MarketSentiment[] = [];

    // search polymarket for each query (parallel within industry)
    const searchResults = await Promise.all(
      queries.map((q) => searchPolymarket(q))
    );

    for (const events of searchResults) {
      for (const event of events) {
        if (!event.markets) continue;
        for (const market of event.markets) {
          if (!market.active) continue;
          try {
            const prices = JSON.parse(market.outcomePrices || "[]");
            const yesPrice = typeof prices[0] === "number" ? prices[0] : parseFloat(prices[0]) || 0.5;
            allMarkets.push({
              question: market.question,
              yesPrice,
              volume: market.volume,
            });
          } catch {
            // skip markets with unparseable prices
          }
        }
      }
    }

    // deduplicate by question
    const seen = new Set<string>();
    const unique = allMarkets.filter((m) => {
      if (seen.has(m.question)) return false;
      seen.add(m.question);
      return true;
    });

    // take top 5 by volume
    const top = unique
      .sort((a, b) => parseFloat(b.volume || "0") - parseFloat(a.volume || "0"))
      .slice(0, 5);

    // compute overall sentiment from yes prices
    // >0.5 avg = bullish on the industry, <0.5 = bearish
    const avgYes = top.length > 0
      ? top.reduce((sum, m) => sum + m.yesPrice, 0) / top.length
      : 0.5;

    const sentimentScore = Math.round((avgYes - 0.5) * 200); // -100 to 100

    results.push({
      industry,
      relatedMarkets: top,
      overallSentiment: sentimentScore > 15 ? "bullish" : sentimentScore < -15 ? "bearish" : "neutral",
      sentimentScore,
    });
  }

  return results;
}
