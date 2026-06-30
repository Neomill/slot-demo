import {
  Assets,
  Container,
  Sprite,
  Text,
  TextStyle,
  type Texture,
} from "pixi.js";
import type { InfoModalTab } from "./InfoModal";
import type { SymbolId } from "../config/symbols";
import { INFO_TABS, INFO_PAYLINES, SYMBOL_TEXTURES } from "../assets/manifest";
import { fontFamily } from "./theme";

/** Columns in the payline grid; the 15 diagrams fall into 3 × 5. */
const PAYLINE_COLS = 3;
const PAYLINE_COL_GAP = 16;
const PAYLINE_ROW_GAP = 16;

/**
 * Lay the 15 payline diagrams out as an evenly-spaced 3-column grid that fits
 * the given content width (the rows overflow the viewport and scroll). Built
 * lazily — invoked after the textures have preloaded.
 */
function buildPaylineGrid(width: number): Container {
  const grid = new Container();
  const usable = width - 14; // leave room for the scrollbar on the right
  const cellW = (usable - PAYLINE_COL_GAP * (PAYLINE_COLS - 1)) / PAYLINE_COLS;
  const first = Assets.get<Texture>(INFO_PAYLINES[0]);
  const cellH = (first.height / first.width) * cellW; // keep the diagram's aspect

  INFO_PAYLINES.forEach((url, i) => {
    const col = i % PAYLINE_COLS;
    const row = Math.floor(i / PAYLINE_COLS);
    const sprite = new Sprite(Assets.get<Texture>(url));
    sprite.width = cellW;
    sprite.height = cellH;
    sprite.position.set(
      col * (cellW + PAYLINE_COL_GAP),
      row * (cellH + PAYLINE_ROW_GAP),
    );
    grid.addChild(sprite);
  });
  return grid;
}

// --- Pays tab (symbol art + payouts) ---------------------------------------
const PAYS_ICON = 52; // symbol art box (px) in a payout row
const PAYS_COL_GOLD = 0xf3d27a; // section headings
const PAYS_COL_NAME = 0xe9d8a6; // symbol name + pays line
const PAYS_COL_BODY = 0xc9d6e6; // descriptive paragraphs

const paysHeadingStyle = new TextStyle({
  fill: PAYS_COL_GOLD,
  fontFamily,
  fontSize: 22,
  fontWeight: "700",
  letterSpacing: 1,
});
const paysRowStyle = new TextStyle({
  fill: PAYS_COL_NAME,
  fontFamily,
  fontSize: 18,
  fontWeight: "700",
});
const paysBodyStyle = (width: number): TextStyle =>
  new TextStyle({
    fill: PAYS_COL_BODY,
    fontFamily,
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 23,
    wordWrap: true,
    wordWrapWidth: width,
  });

/** A symbol's art, fit (aspect-preserved) into a `box`×`box` square, centred. */
function paysIcon(id: SymbolId, box: number): Sprite {
  const tex = Assets.get<Texture>(SYMBOL_TEXTURES[id]);
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5);
  sprite.scale.set(Math.min(box / tex.width, box / tex.height));
  return sprite;
}

/**
 * The Pays tab as a visual layout: the actual symbol art beside each payout, so
 * players can see what every entry refers to. Pay multiples come straight from
 * PAYTABLE / prizeConfig / bonusConfig. Built lazily once textures have loaded.
 */
function buildPaysContent(width: number): Container {
  const root = new Container();
  const textWidth = width - 14; // leave room for the scrollbar
  let y = 0;

  const heading = (text: string): void => {
    if (y > 0) y += 12; // breathing room before a new section
    const t = new Text({ text, style: paysHeadingStyle });
    t.position.set(0, y);
    root.addChild(t);
    y += t.height + 8;
  };

  const body = (text: string): void => {
    const t = new Text({ text, style: paysBodyStyle(textWidth) });
    t.position.set(0, y);
    root.addChild(t);
    y += t.height + 6;
  };

  // A symbol's art on the left, its name + pays on one line beside it.
  const row = (id: SymbolId, text: string): void => {
    const icon = paysIcon(id, PAYS_ICON);
    icon.position.set(PAYS_ICON / 2, y + PAYS_ICON / 2);
    const label = new Text({ text, style: paysRowStyle });
    label.anchor.set(0, 0.5);
    label.position.set(PAYS_ICON + 14, y + PAYS_ICON / 2);
    root.addChild(icon, label);
    y += PAYS_ICON + 8;
  };

  heading("PAYING SYMBOLS");
  body(
    "Values are for 3 / 4 / 5 of a kind, as a multiplier of the bet per line. Symbols pay left to right on consecutive reels of an active payline.",
  );
  row("jocky", "JOCKEY — 15 / 40 / 120");
  row("shoehorse", "HORSESHOE — 10 / 25 / 80");
  row("binoculars", "BINOCULARS — 8 / 20 / 60");
  row("cap", "CAP — 5 / 15 / 50");
  row("ten", "TEN — 4 / 10 / 30");
  row("jack", "JACK — 3 / 8 / 25");
  row("queen", "QUEEN — 3 / 8 / 20");
  row("king", "KING — 2 / 6 / 15");
  row("ace", "ACE — 2 / 5 / 12");

  heading("PRIZE HORSES");
  body(
    "Each Prize horse lands carrying a random value (a multiplier of the bet per line). 3 or more on a payline pay the summed value in the main game; during Free Spins, every Wild collects all Prize symbols on the reels.",
  );
  row("bluehorse", "BLUE — ×0.5 or ×0.75");
  row("redhorse", "RED — ×1 or ×1.5");
  row("goldhorse", "GOLD — ×2.5 or ×5");

  heading("WILD");
  row("wild", "WILD");
  body(
    "Substitutes for all symbols except Bonus and Prize symbols to complete a winning combination. Wilds appear only during Free Spins.",
  );

  heading("BONUS (SCATTER)");
  row("bonus", "BONUS");
  body(
    "3 Bonus symbols anywhere on a main-game spin award 10 Free Spins. Bonus symbols do not pay a coin value — they trigger the feature.",
  );

  heading("TROPHY");
  row("trophy", "TROPHY");
  body(
    "5 Trophy symbols on a main-game spin trigger Hold & Respin. Each locked Trophy is worth ×2, ×5, ×10, ×20 or ×50 the bet per line, all collected when the feature ends.",
  );

  body(
    "Only the highest win is paid per payline; wins on multiple active paylines are added together.",
  );

  return root;
}

/**
 * INFO / PAYTABLE content for the three tabs: Pays (symbol art + payouts) and
 * Payline (the 25-line grid) are built lazily from art; Rules is plain copy.
 */
export const INFO_MODAL_TABS: InfoModalTab[] = [
  {
    label: "Pays",
    icon: INFO_TABS.pays,
    content: buildPaysContent,
  },
  {
    label: "Payline",
    icon: INFO_TABS.payline,
    content: buildPaylineGrid,
  },
  {
    label: "Rules",
    icon: INFO_TABS.rules,
    content: [
      "HOW TO PLAY",
      "The game features win lines",
      "-Choose the bet size using the buttons in the Total Bet field",
      "-Higher bets increase the total win.",
      "-The selected bet value is displayed in the corresponding field.",
      "-To start the reels spinning, click the Spin button.",
      "",
      "BONUS SYMBOL",
      "Landing 3 or more Bonus symbols in a single spin triggers the Free Spins feature.",
      "If a winning combination is formed during the same spin that triggers Free Spins, the win is paid before the Free Spins round begins.",
      "3+ Scatter symbols award Free Spins with Wilds and rising multipliers. Collecting Wilds can retrigger the feature.",
      "",
      "FREEE SPINS",
      "The number of awarded Free Spins depends on how many Bonus symbols triggered the feature.",
      "3 Bonus symbols: 10 Free Spins.",
      "4 Bonus symbols: 15 Free Spins.",
      "5 Bonus symbols: 20 Free Spins.",
      "Free Spins are played at the same bet as the triggering spin.",
      "",
      "WILD SYMBOL",
      "Wild symbols appear only during Free Spins.",
      "Wild substitutes for any symbol to complete a winning combination except:",
      "- Bonus symbols.",
      "- Prize symbols.",
      "",
      "RETRIGGER DURING FREE SPINS",
      "Every 4th Wild symbol that is part of a winning combination retriggers the feature and awards 10 additional Free Spins.",
      "The feature can be retriggered up to 3 times.",
      "Retrigger multipliers:",
      "First retrigger: ×2.",
      "Second retrigger: ×3.",
      "Third retrigger: ×10.",
      "The multiplier applies to the total win of each Free Spin.",
      "Additional Free Spins are played after the initial Free Spins have ended.",
      "",
      "PRIZE SYMBOLS",
      "There are three types of Prize symbols.",
      "",
      "BLUE PRIZE SYMBOL",
      "Possible values:",
      "- ×0.5.",
      "- ×0.75.",
      "",
      "RED PRIZE SYMBOL",
      "Possible values:",
      "- ×1.",
      "- ×1.5.",
      "",
      "GOLD PRIZE SYMBOL",
      "Possible values:",
      "- ×2.5.",
      "- ×5.",
      "",
      "PRIZE SYMBOLS IN THE MAIN GAME",
      "If 3 or more Prize symbols appear on a payline during the main game, the total value of all Prize symbols is paid.",
      "",
      "WILDS COLLECT PRIZES",
      "During Free Spins:",
      "- Prize symbols appear on reels 2–5.",
      "- Prize symbols pay only when a Wild symbol is present.",
      "- Each Wild collects and pays the total value of all Prize symbols on the reels.",
      "",
      "HOLD & RESPIN",
      "A Trophy symbol can appear on any reel during the main game.",
      "Landing 5 or more Trophy symbols on a single main-game spin triggers the Hold & Respin feature.",
      "When the feature begins:",
      "- Every Trophy symbol locks in its current position.",
      "- All remaining positions respin.",
      "- The respin counter is set to 3.",
      "On each respin:",
      "- Only the unlocked positions spin; locked Trophy symbols stay in place.",
      "- If one or more new Trophy symbols land, they lock and the respin counter is reset to 3.",
      "- If no new Trophy symbol lands, the respin counter decreases by 1.",
      "The feature ends when the respin counter reaches 0, after which play returns to the main game.",
      ,
      "",
      "BUY BONUS",
      "Players can purchase a bonus(free spin)",
      "",
      "BUY HOLD & RESPIN",
      "Players can buy directly into the Hold & Respin feature from the main game.",
      "The purchase price is 3× the current total bet and is displayed on the Buy Hold & Respin button.",
      "If the bet changes, the price changes accordingly.",
      "Buying lands the trigger's worth of Trophy symbols and enters Hold & Respin immediately, played exactly as a naturally triggered feature.",
      "The respin counter starts at 3.",
      "Buy Hold & Respin is available only during the main game.",
      "",
      "SPIN RESULTS",
      "If a winning combination is formed on any active payline:",
      "- The winning payline is animated.",
      "- The win amount is displayed in the Total Win field.",
      "The following payout rules apply:",
      "- All symbols pay from left to right on consecutive reels of an active payline.",
      "- Wins on multiple active paylines are added together.",
      "- Payouts are made according to the paytable.",
      "- Payline wins are multiplied by the bet per line value.",
      "- Only the highest-paying win is paid on each active payline.",
      "- A spin may trigger the Free Spins feature.",
    ].join("\n"),
  },
];
