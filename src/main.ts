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
void scene.init(container);

// Drive from the console:
//   await game.spin()        · base spin
//   game.setChance2x(true)   · then spin for denser scatters at 2x cost
//   game.buyBonus('mega')    · then loop: await game.spin()  (free spins)
// Trigger Hold & Respin by landing 5 trophies on a base spin.
(window as unknown as { game: Game }).game = game;
console.info("%cSlot ready — try game.spin()", "color:#5ec98a");
