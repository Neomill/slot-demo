import type { SymbolId } from '../config/symbols';

/**
 * The reels' plan for a Free Spins anticipation cinematic, derived purely from a
 * predetermined board. Presentation only — it tells the reels which columns to
 * tease and where the triggering Scatter lands; it never changes the outcome.
 */
export interface AnticipationPlan {
  /** Reel at which the second Scatter has landed (anticipation starts after it). */
  twoAt: number;
  /** First reel after `twoAt` that lands a Scatter — the 3rd, completing the
   *  trigger. -1 when only two Scatters are on the board (a "near miss"). */
  triggerReel: number;
  /** Reels that play the extended/teasing spin, left → right. */
  anticipationReels: number[];
  /** Rows holding a Scatter, per reel (so a landing reel can bounce them). */
  scatterRowsByReel: number[][];
}

/**
 * Decide whether a board earns the anticipation cinematic, and how.
 *
 * The rule mirrors a player's eye: once exactly two Scatters have landed and at
 * least one reel is still to stop, every remaining reel that *could* complete a
 * 3+ Scatter trigger is teased one at a time. Returns `null` when there's no
 * suspense to play — fewer than two Scatters land, the second lands on the last
 * reel, or the count jumps straight past two (e.g. three at once), which reads
 * as an instant hit rather than a build-up.
 *
 * @param grid    board as grid[reel][row]
 * @param scatter the Scatter symbol id
 * @param cols    number of reels
 */
export function planAnticipation(
  grid: SymbolId[][],
  scatter: SymbolId,
  cols: number,
): AnticipationPlan | null {
  const scatterRowsByReel: number[][] = [];
  for (let reel = 0; reel < cols; reel++) {
    const rows: number[] = [];
    const column = grid[reel] ?? [];
    for (let row = 0; row < column.length; row++) {
      if (column[row] === scatter) rows.push(row);
    }
    scatterRowsByReel.push(rows);
  }

  // Find the reel that brings the running Scatter count to exactly two.
  let cumulative = 0;
  let twoAt = -1;
  for (let reel = 0; reel < cols; reel++) {
    const before = cumulative;
    cumulative += scatterRowsByReel[reel].length;
    if (before < 2 && cumulative >= 2) {
      // A clean stop at two earns the tease; a jump past two (0→3, 1→3) doesn't.
      if (cumulative === 2) twoAt = reel;
      break;
    }
  }

  // No second Scatter, or it landed on the final reel: nothing left to tease.
  if (twoAt < 0 || twoAt >= cols - 1) return null;

  // The trigger lands on the first later reel holding a Scatter (if any).
  let triggerReel = -1;
  for (let reel = twoAt + 1; reel < cols; reel++) {
    if (scatterRowsByReel[reel].length > 0) {
      triggerReel = reel;
      break;
    }
  }

  // Tease from the reel after the second Scatter up to (and including) the reel
  // that completes the trigger; with no third Scatter, tease to the last reel.
  const lastTease = triggerReel >= 0 ? triggerReel : cols - 1;
  const anticipationReels: number[] = [];
  for (let reel = twoAt + 1; reel <= lastTease; reel++) anticipationReels.push(reel);

  return { twoAt, triggerReel, anticipationReels, scatterRowsByReel };
}
