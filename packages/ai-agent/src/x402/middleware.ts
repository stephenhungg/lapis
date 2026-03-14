import type { Request, Response, NextFunction } from "express";

type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void;

const passthrough: ExpressMiddleware = (_req, _res, next) => next();

// x402 paywall middleware for monetizing report access
// wraps the full report endpoint at $0.05 per request
export async function createX402Middleware(): Promise<ExpressMiddleware> {
  const walletAddress = process.env.X402_WALLET_ADDRESS;

  if (!walletAddress) {
    console.warn("  WARNING: X402_WALLET_ADDRESS not set. Paywall disabled.\n");
    return passthrough;
  }

  try {
    const { paymentMiddleware } = await import("x402-express");

    return paymentMiddleware(
      walletAddress as `0x${string}`,
      {
        "GET /report/:id": {
          price: "$0.05",
          network: "base-sepolia",
          config: {
            description: "Access full PublicRound startup report card",
          },
        },
      },
      { url: "https://x402.org/facilitator" }
    );
  } catch (err) {
    console.warn("  WARNING: x402-express failed to initialize. Paywall disabled.");
    console.warn(`  Error: ${(err as Error).message}\n`);
    return passthrough;
  }
}
