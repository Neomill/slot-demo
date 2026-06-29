import { Container, Graphics } from 'pixi.js';
import type { SymbolId } from '../config/symbols';
import { SYMBOLS } from '../config/symbols';
import { CELL, COLS, ROWS, SPIN, SEPARATOR, colors } from './theme';
import { makeSymbolSprite } from './SymbolSprite';

/** Random filler symbols shown while a reel is mid-spin (cosmetic only). */
const FILLERS = 10;

function randomSymbol(): SymbolId {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** One reel column: a vertical strip of symbols, masked to the visible rows. */
class ReelColumn extends Container {
  private readonly strip = new Container();
  private spinning = false;
  private elapsed = 0;
  private duration = 0;
  private fromY = 0;
  private target: SymbolId[] = [];
  private resolve?: () => void;

  constructor(initial: SymbolId[]) {
    super();
    const mask = new Graphics().rect(0, 0, CELL.width, ROWS * CELL.height).fill(0xffffff);
    this.addChild(this.strip, mask);
    this.mask = mask;
    this.set(initial);
  }

  /** Snap to a set of symbols (no animation). */
  set(symbols: SymbolId[]): void {
    this.spinning = false;
    this.resolve?.();
    this.resolve = undefined;
    this.build(symbols.slice(0, ROWS));
    this.strip.y = 0;
  }

  /** Scroll down and land on `target`, resolving when settled. */
  spinTo(target: SymbolId[], durationMs: number): Promise<void> {
    this.target = target.slice(0, ROWS);
    const strip: SymbolId[] = [...this.target];
    for (let i = 0; i < FILLERS; i++) strip.push(randomSymbol());
    this.build(strip);
    this.fromY = -FILLERS * CELL.height;
    this.strip.y = this.fromY;
    this.elapsed = 0;
    this.duration = durationMs;
    this.spinning = true;
    return new Promise((resolve) => (this.resolve = resolve));
  }

  update(dtMs: number): void {
    if (!this.spinning) return;
    this.elapsed += dtMs;
    const t = Math.min(1, this.elapsed / this.duration);
    this.strip.y = this.fromY * (1 - easeOutCubic(t));
    if (t >= 1) {
      this.spinning = false;
      this.build(this.target);
      this.strip.y = 0;
      const done = this.resolve;
      this.resolve = undefined;
      done?.();
    }
  }

  private build(symbols: SymbolId[]): void {
    this.strip.removeChildren();
    symbols.forEach((id, row) => {
      const sprite = makeSymbolSprite(id);
      // Centered anchor -> place at the cell's center, both axes.
      sprite.x = CELL.width / 2;
      sprite.y = row * CELL.height + CELL.height / 2;
      this.strip.addChild(sprite);
    });
  }
}

/** The full reel set: COLS columns plus a layer for lock highlights. */
export class Reels extends Container {
  private readonly columns: ReelColumn[] = [];
  private readonly highlights = new Container();

  constructor(initialGrid: SymbolId[][]) {
    super();
    for (let col = 0; col < COLS; col++) {
      const column = new ReelColumn(initialGrid[col] ?? []);
      column.x = col * CELL.width;
      this.addChild(column);
      this.columns.push(column);
    }
    this.drawSeparators();
    this.addChild(this.highlights);
  }

  /** Thin vertical dividers between the reels (COLS - 1 of them). */
  private drawSeparators(): void {
    const separators = new Graphics();
    const height = ROWS * CELL.height;
    for (let i = 1; i < COLS; i++) {
      // Centered on the column boundary so the 1px line stays crisp.
      separators.rect(i * CELL.width - SEPARATOR.width / 2, 0, SEPARATOR.width, height);
    }
    separators.fill({ color: SEPARATOR.color });
    this.addChild(separators);
  }

  update(dtMs: number): void {
    for (const column of this.columns) column.update(dtMs);
  }

  setGrid(grid: SymbolId[][]): void {
    this.highlights.removeChildren();
    grid.forEach((column, i) => this.columns[i]?.set(column));
  }

  /** Animated spin (base + free spins): reels scroll and land staggered L→R. */
  spin(grid: SymbolId[][]): Promise<void> {
    this.highlights.removeChildren();
    return Promise.all(
      this.columns.map((column, i) => column.spinTo(grid[i] ?? [], SPIN.baseMs + i * SPIN.staggerMs)),
    ).then(() => undefined);
  }

  /** Hold & Respin: snap to the board and outline the locked cells. */
  showLocked(grid: SymbolId[][], locked: boolean[][]): void {
    this.setGrid(grid);
    for (let reel = 0; reel < locked.length; reel++) {
      for (let row = 0; row < locked[reel].length; row++) {
        if (!locked[reel][row]) continue;
        const marker = new Graphics()
          .rect(reel * CELL.width, row * CELL.height, CELL.width, CELL.height)
          .stroke({ color: colors.lock, width: 5 });
        this.highlights.addChild(marker);
      }
    }
  }
}
