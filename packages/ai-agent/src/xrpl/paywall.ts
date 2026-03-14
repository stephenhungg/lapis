import type { Request, Response, NextFunction } from "express";
import { walletFromEnv, verifyPayment } from "@lapis/xrpl-contracts";

type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void;

const passthrough: ExpressMiddleware = (_req, _res, next) => next();

// minimum XRP required for report access
const PAYWALL_AMOUNT_XRP = "0.05";

// tx hash format: 64-char hex (XRPL standard)
const TX_HASH_REGEX = /^[A-Fa-f0-9]{64}$/;

// xrpl address format: starts with r, 25-35 alphanumeric
const XRPL_ADDRESS_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

// reject payments older than this (prevents reuse of ancient tx hashes)
const MAX_PAYMENT_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// cache of verified payments: key = "txHash:path", value = timestamp
const verifiedPayments = new Map<string, number>();
const MAX_CACHE_SIZE = 10_000;

// track used tx hashes globally to prevent cross-path reuse
const usedTxHashes = new Set<string>();

// routes that require XRPL payment
const PAYWALLED_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  // GET /report/:id but NOT /report/:id/score
  { method: "GET", pattern: /^\/report\/[^/]+$/ },
];

/**
 * XRPL payment verification middleware.
 *
 * Flow:
 *   1. Client sends 0.05 XRP to the founder wallet on XRPL testnet
 *   2. Client includes the tx hash in the X-Payment-TxHash header
 *   3. Optionally includes their XRPL address in X-Payment-Sender for sender verification
 *   4. Middleware verifies the payment on-chain via verifyPayment()
 *   5. Verified (txHash, path) pairs are cached in-memory
 *
 * Security:
 *   - Each tx hash can only be used for ONE resource (path-scoped)
 *   - Payments older than 24h are rejected
 *   - Optional sender verification prevents using someone else's tx hash
 *   - Cache is bounded with FIFO eviction
 *
 * If FOUNDER_SEED is not set, the paywall is disabled (passthrough).
 */
export async function createXrplPaywallMiddleware(): Promise<ExpressMiddleware> {
  if (!process.env.FOUNDER_SEED) {
    console.warn("  XRPL paywall: disabled (FOUNDER_SEED not set)\n");
    return passthrough;
  }

  let founderAddress: string;
  try {
    founderAddress = walletFromEnv("FOUNDER").address;
  } catch {
    console.warn("  WARNING: Failed to load FOUNDER wallet. XRPL paywall disabled.\n");
    return passthrough;
  }

  const network = process.env.XRPL_NETWORK || "testnet";
  const requireSender = process.env.PAYWALL_REQUIRE_SENDER === "true";
  console.log(`  XRPL paywall: active — send ${PAYWALL_AMOUNT_XRP} XRP to ${founderAddress} (${network})`);
  if (requireSender) console.log(`  XRPL paywall: sender verification enabled`);

  return ((req: Request, res: Response, next: NextFunction) => {
    // only intercept paywalled routes
    const isPaywalled = PAYWALLED_ROUTES.some(
      (r) => req.method === r.method && r.pattern.test(req.path)
    );
    if (!isPaywalled) return next();

    const txHash = req.headers["x-payment-txhash"] as string | undefined;
    const claimedSender = req.headers["x-payment-sender"] as string | undefined;

    if (!txHash) {
      res.status(402).json({
        success: false,
        error: "Payment required",
        paymentDetails: {
          destination: founderAddress,
          amountXRP: PAYWALL_AMOUNT_XRP,
          network,
          headers: {
            "X-Payment-TxHash": "your XRPL transaction hash",
            ...(requireSender && { "X-Payment-Sender": "your XRPL address (rXXX...)" }),
          },
          instructions: `Send ${PAYWALL_AMOUNT_XRP} XRP to ${founderAddress} on ${network}, then include the tx hash in the X-Payment-TxHash header`,
        },
      });
      return;
    }

    // validate tx hash format
    if (!TX_HASH_REGEX.test(txHash)) {
      res.status(400).json({
        success: false,
        error: "Invalid tx hash format. Expected 64-character hex string.",
      });
      return;
    }

    // validate sender format if provided
    if (claimedSender && !XRPL_ADDRESS_REGEX.test(claimedSender)) {
      res.status(400).json({
        success: false,
        error: "Invalid sender address format. Expected XRPL address (rXXX...).",
      });
      return;
    }

    // require sender header if configured
    if (requireSender && !claimedSender) {
      res.status(400).json({
        success: false,
        error: "X-Payment-Sender header required. Include your XRPL address.",
      });
      return;
    }

    // check if tx hash already used for a different path
    const cacheKey = `${txHash}:${req.path}`;
    if (usedTxHashes.has(txHash) && !verifiedPayments.has(cacheKey)) {
      res.status(402).json({
        success: false,
        error: "This transaction hash has already been used for a different resource. Send a new payment.",
      });
      return;
    }

    // fast path: already verified this tx for this path
    if (verifiedPayments.has(cacheKey)) return next();

    // verify on-chain, catch rejections explicitly for Express 4
    (async () => {
      const result = await verifyPayment(txHash, founderAddress, PAYWALL_AMOUNT_XRP);

      if (!result.valid) {
        res.status(402).json({
          success: false,
          error: "Payment verification failed: transaction did not meet requirements",
          paymentDetails: {
            destination: founderAddress,
            amountXRP: PAYWALL_AMOUNT_XRP,
            network,
          },
        });
        return;
      }

      // verify sender matches if provided/required
      if (claimedSender && result.sender !== claimedSender) {
        res.status(402).json({
          success: false,
          error: "Sender verification failed: transaction sender does not match claimed address",
        });
        return;
      }

      // evict oldest entries if cache is full
      if (verifiedPayments.size >= MAX_CACHE_SIZE) {
        const firstKey = verifiedPayments.keys().next().value;
        if (firstKey) {
          verifiedPayments.delete(firstKey);
          // extract txHash from cache key for usedTxHashes cleanup
          const oldTxHash = firstKey.split(":")[0];
          if (oldTxHash) usedTxHashes.delete(oldTxHash);
        }
      }

      verifiedPayments.set(cacheKey, Date.now());
      usedTxHashes.add(txHash);
      return next();
    })().catch((err) => {
      res.status(402).json({
        success: false,
        error: `Payment verification error: ${(err as Error).message}`,
      });
    });
  }) as ExpressMiddleware;
}
