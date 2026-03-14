// Hook into the monitoring loop to react to score changes
// When a startup's score drops significantly, the agent alerts
// and could cancel escrows if the cancel window has passed.

import { getSettlementByReport } from "./store.js";

export async function onScoreChange(
  reportId: string,
  oldScore: number,
  newScore: number
): Promise<void> {
  const settlement = await getSettlementByReport(reportId);

  if (!settlement) {
    // no on-chain settlement exists for this report, nothing to do
    return;
  }

  const delta = newScore - oldScore;
  const direction = delta > 0 ? "improved" : "declined";

  console.log(
    `[xrpl-monitor] ${settlement.companyName} score ${direction}: ${oldScore} -> ${newScore} (${delta > 0 ? "+" : ""}${delta})`
  );

  if (delta < -15) {
    // significant decline -- agent raises alarm
    console.warn(
      `[xrpl-monitor] ALERT: ${settlement.companyName} score dropped ${Math.abs(delta)} points`
    );
    console.warn(
      `[xrpl-monitor] ${settlement.escrows.length} escrows with ${settlement.equityToken.mptIssuanceId}`
    );
    console.warn(
      `[xrpl-monitor] agent would cancel escrows if cancelAfter date has passed`
    );

    // in a real system, we'd check each escrow's cancelAfter date
    // and call cancelEscrow() for any that are past their cancel window.
    // on testnet for demo, we just log the alert -- proves the agent is watching.
    //
    // import { cancelEscrow, walletFromEnv } from "@lapis/xrpl-contracts";
    // const founderWallet = walletFromEnv("FOUNDER");
    // for (const pe of settlement.escrows) {
    //   if (pe.escrow.cancelAfter && Date.now() / 1000 > unixFromRippleTime(pe.escrow.cancelAfter)) {
    //     await cancelEscrow(founderWallet, pe.escrow);
    //   }
    // }
  }

  if (delta > 20) {
    // significant improvement -- agent notes this positively
    console.log(
      `[xrpl-monitor] ${settlement.companyName} is on a tear. escrows looking healthy.`
    );
  }
}
