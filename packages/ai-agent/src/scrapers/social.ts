import type { SocialData } from "@publicround/shared";

// mock implementation for hackathon
// TODO: replace with real Twitter/X API integration
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export async function scrapeSocial(handle?: string): Promise<SocialData | null> {
  if (!handle) return null;

  const seed = hashString(handle);

  return {
    platform: "twitter",
    handle,
    followers: 500 + (seed % 50000),
    recentPostCount: 5 + (seed % 60),
    avgEngagement: 10 + (seed % 500),
  };
}
