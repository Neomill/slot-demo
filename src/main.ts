import "./style.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import { Game } from "./game/Game";
import { SlotScene } from "./ui/SlotScene";

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) throw new Error("Missing #app container");

const game = new Game();
const scene = new SlotScene(game);
void scene.init(container).then(() => {
  // Fade out the text loader once assets, fonts and audio are ready.
  const loader = document.querySelector("#loader");
  loader?.classList.add("hidden");
  loader?.addEventListener("transitionend", () => loader.remove(), {
    once: true,
  });
});

// Drive from the console:
//   await game.spin()        · base spin
//   game.buyBonus('mega')    · then loop: await game.spin()  (free spins)
//   game.buyHoldAndRespin()  · buy straight into Hold & Respin (3x the bet)
//   game.debugTriggerHoldAndRespin()  · jump in free (debug)
// (Or trigger Hold & Respin naturally by landing 5 trophies on a base spin.)
(window as unknown as { game: Game }).game = game;
console.info(
  "%cSlot ready — try game.spin() or game.debugTriggerHoldAndRespin()",
  "color:#5ec98a",
);
