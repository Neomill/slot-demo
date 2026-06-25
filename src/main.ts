import "./style.css";
import { Game } from "./game/Game";
import { GameState } from "./core/GameState";
import { GameEvent } from "./types/events";
import { gameConfig } from "./config/gameConfig";
import type { SymbolId } from "./config/symbols";

// Phase 1: the game runs headless. This entry point wires the engine to the
// console so the full flow (balance, bets, spins, wins, errors) is observable
// without any rendering. The PixiJS view layer subscribes to these same events
// in a later phase.

const game = new Game();

game.events.on(GameEvent.StateChange, ({ from, to }) => {
  console.debug(
    `%c[state] ${GameState[from]} → ${GameState[to]}`,
    "color:#e6b45c",
  );
});
game.events.on(GameEvent.BalanceChange, ({ balance, delta, reason }) => {
  const sign = delta >= 0 ? "+" : "";
  console.info(
    `[balance] ${sign}${delta} (${reason}) → ${balance} ${gameConfig.currency}`,
  );
});
game.events.on(GameEvent.BetChange, ({ betPerLine, stake }) => {
  console.info(
    `[bet] ${betPerLine}/line · stake ${stake} ${gameConfig.currency}`,
  );
});
game.events.on(GameEvent.SpinStart, ({ stake }) => {
  console.info(`[spin] staked ${stake} ${gameConfig.currency}…`);
});
game.events.on(GameEvent.SpinResult, ({ result }) => {
  console.group("[spin] result");
  printGrid(result.grid);
  for (const win of result.lineWins) {
    console.log(
      `payline ${win.payline}: ${win.count}× ${win.symbol} = ${win.amount}`,
    );
  }
  console.log(`total win: ${result.totalWin}`);
  console.groupEnd();
});
game.events.on(GameEvent.SpinSettled, ({ totalWin, balance }) => {
  console.info(
    `[spin] settled — won ${totalWin}, balance ${balance} ${gameConfig.currency}`,
  );
});
game.events.on(GameEvent.SpinRejected, ({ reason }) => {
  console.warn(`[spin] rejected: ${reason}`);
});
game.events.on(GameEvent.SpinError, ({ message }) => {
  console.error(`[spin] error: ${message}`);
});

void game.init().then(() => {
  console.info("%cEngine ready.", "color:#5ec98a");
});

// @debug
// Expose for hands-on testing from the browser console.
(window as unknown as { game: Game }).game = game;

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.innerHTML = `
    <div class="boot">
      <h1>Slot Demo — engine running headless</h1>
      <p>No UI yet, by design. Open the console and drive the engine:</p>
      <pre>await game.spin()
game.setBet(5)
game.balance</pre>
    </div>
  `;
}

function printGrid(grid: SymbolId[][]): void {
  const rows = grid[0]?.length ?? 0;
  for (let row = 0; row < rows; row++) {
    console.log(grid.map((column) => column[row].padEnd(7)).join(" "));
  }
}
