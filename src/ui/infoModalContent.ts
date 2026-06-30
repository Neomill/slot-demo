import type { InfoModalTab } from "./InfoModal";

/**
 * Placeholder INFO / PAYTABLE copy for the three tabs. Plain strings (the modal
 * word-wraps + scrolls them); swap these out for the real paytable content
 * later. Kept long enough that the Pays tab demonstrates scrolling.
 */
export const INFO_MODAL_TABS: InfoModalTab[] = [
  {
    label: "Pays",
    content: [
      "SCATTER",
      "3 or more anywhere triggers Free Spins. Scatters pay anywhere on the reels and do not need to land on a payline.",
      "",
      "WILD",
      "Substitutes for all symbols except Scatter to complete winning combinations. Wilds appear during Free Spins.",
      "",
      "STABLE BADGE",
      "Appears on the reels during the Hold & Respin feature. Collect badges to win prizes — each carries a bet multiplier.",
      "",
      "PRIZE SYMBOLS",
      "Blue, Red and Gold prize horses carry multiplier values. Three or more on a payline pay the summed prize value.",
      "",
      "HIGH SYMBOLS",
      "The jockey, cap, binoculars and horseshoe symbols pay the most for 3, 4 or 5 of a kind on an active payline.",
      "",
      "ROYALS",
      "Ace, King, Queen, Jack and Ten are the low-paying symbols. They pay for 3, 4 or 5 of a kind, left to right.",
      "",
      "All wins are paid left to right on consecutive reels of an active payline. Only the highest win per payline is paid.",
    ].join("\n"),
  },
  {
    label: "Payline",
    content: [
      "PAYLINES",
      "Wins are evaluated across 25 fixed paylines. Symbols must land on consecutive reels starting from the leftmost reel.",
      "",
      "TOTAL BET",
      "The total bet is the per-line bet multiplied by the number of paylines. Higher bets increase the total possible win.",
      "",
      "Payline wins are multiplied by the bet-per-line value. Wins on multiple active paylines are added together.",
    ].join("\n"),
  },
  {
    label: "Rules",
    content: [
      "HOW TO PLAY",
      "Choose your bet and press Spin to start the race. Hold Spin to set up Autospins.",
      "",
      "FREE SPINS",
      "3+ Scatter symbols award Free Spins with Wilds and rising multipliers. Collecting Wilds can retrigger the feature.",
      "",
      "HOLD & RESPIN",
      "Land 5 Trophy symbols to trigger Hold & Respin. Trophies lock and respins reset to 3 each time a new one lands.",
      "",
      "Malfunction voids all pays and plays. The game's return to player and full rules are available from your operator.",
    ].join("\n"),
  },
];
