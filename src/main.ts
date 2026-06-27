import "./style.css";
import { Game } from "./game/Game";
import { GameState } from "./core/GameState";
import { GameMode } from "./core/GameMode";
import { GameEvent } from "./types/events";
import { gameConfig } from "./config/gameConfig";
import type { SymbolId } from "./config/symbols";

// Headless harness: the engine runs without any rendering and reports its full
// flow — base spins, bonuses, free spins, hold & respin — to the console. The
// PixiJS view layer (src/ui) subscribes to these same events.

const game = new Game();

game.events.on(GameEvent.StateChange, ({ from, to }) => {
  console.debug(`%c[state] ${GameState[from]} → ${GameState[to]}`, "color:#8893ad");
});
game.events.on(GameEvent.ModeChange, ({ from, to }) => {
  console.info(`%c[mode] ${GameMode[from]} → ${GameMode[to]}`, "color:#e6b45c");
});
game.events.on(GameEvent.BalanceChange, ({ balance, delta, reason }) => {
  const sign = delta >= 0 ? "+" : "";
  console.info(`[balance] ${sign}${delta} (${reason}) → ${balance} ${gameConfig.currency}`);
});
game.events.on(GameEvent.BetChange, ({ betPerLine, stake }) => {
  console.info(`[bet] ${betPerLine}/line · stake ${stake} ${gameConfig.currency}`);
});
game.events.on(GameEvent.ChanceChange, ({ enabled }) => {
  console.info(`[chance×2] ${enabled ? "enabled" : "disabled"}`);
});
game.events.on(GameEvent.SpinStart, ({ stake }) => {
  console.info(`[spin] staked ${stake} ${gameConfig.currency}…`);
});
game.events.on(GameEvent.SpinResult, ({ result }) => {
  console.group(`[spin] result · ${GameMode[result.mode]} · ×${result.multiplier}`);
  printGrid(result.grid);
  for (const win of result.lineWins) {
    console.log(`payline ${win.payline}: ${win.count}× ${win.symbol} = ${win.amount}`);
  }
  console.log(`win: ${result.totalWin}`);
  console.groupEnd();
});
game.events.on(GameEvent.SpinSettled, ({ totalWin, balance }) => {
  console.info(`[spin] settled — won ${totalWin}, balance ${balance} ${gameConfig.currency}`);
});
game.events.on(GameEvent.SpinRejected, ({ reason }) => {
  console.warn(`[spin] rejected: ${reason}`);
});
game.events.on(GameEvent.SpinError, ({ message }) => {
  console.error(`[spin] error: ${message}`);
});

// --- bonus flow ---
game.events.on(GameEvent.BonusBought, ({ tier, cost, spins }) => {
  console.info(`%c[buy] ${tier} for ${cost} → ${spins} free spins`, "color:#b08cf0");
});
game.events.on(GameEvent.FreeSpinsStart, ({ spins, trigger }) => {
  console.info(`%c[free spins] start: ${spins} spins (${trigger})`, "color:#5ec98a");
});
game.events.on(GameEvent.WildsCollected, ({ count, wildCounter, multiplier, awardedSpins }) => {
  console.info(`[wilds] +${count} (total ${wildCounter}) → ×${multiplier}, +${awardedSpins} spins`);
});
game.events.on(GameEvent.FreeSpinsEnd, ({ totalWin }) => {
  console.info(`%c[free spins] end — total ${totalWin} ${gameConfig.currency}`, "color:#5ec98a");
});
game.events.on(GameEvent.HoldRespinStart, ({ respins, lockedBonus }) => {
  console.info(`%c[hold & respin] start: ${lockedBonus} locked, ${respins} respins`, "color:#6aa6f0");
});
game.events.on(GameEvent.HoldRespinUpdate, ({ remainingRespins, newBonus }) => {
  console.info(`[hold & respin] ${newBonus > 0 ? `+${newBonus} locked, ` : ""}${remainingRespins} respins left`);
});
game.events.on(GameEvent.HoldRespinEnd, ({ totalWin }) => {
  console.info(`%c[hold & respin] end — total ${totalWin} ${gameConfig.currency}`, "color:#6aa6f0");
});

void game.init().then(() => {
  console.info("%cEngine ready.", "color:#5ec98a");
});

// @debug — drive the engine from the console.
(window as unknown as { game: Game }).game = game;

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.innerHTML = `
    <div class="boot">
      <h1>Slot Demo — engine running headless</h1>
      <p>Open the console and drive the engine:</p>
      <pre>await game.spin()
game.setChance2x(true)
game.buyBonus('mega')   // then loop: await game.spin()
game.getState()</pre>
    </div>
  `;
}

function printGrid(grid: SymbolId[][]): void {
  const rows = grid[0]?.length ?? 0;
  for (let row = 0; row < rows; row++) {
    console.log(grid.map((column) => column[row].padEnd(7)).join(" "));
  }
}
