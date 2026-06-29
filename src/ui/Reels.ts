import { Container, Graphics, Text } from 'pixi.js';
import type { SymbolId } from '../config/symbols';
import { SYMBOLS } from '../config/symbols';
import type { Position, PrizeCell } from '../types/slot';
import { CELL, COLS, ROWS, SPIN, SEPARATOR, fontFamily, colors } from './theme';
import { makeSymbolSprite } from './SymbolSprite';

/** Random filler symbols shown while a reel is mid-spin (cosmetic only). */
const FILLERS = 10;

function randomSymbol(): SymbolId {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInQuad(t: number): number {
  return t * t;
}

function formatCash(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cellCenter(reel: number, row: number): { x: number; y: number } {
  return { x: reel * CELL.width + CELL.width / 2, y: row * CELL.height + CELL.height / 2 };
}

/** Where a prize badge sits within a cell (lower third). */
const BADGE_DY = CELL.height * 0.28;

/** A small value pill shown on a Prize symbol (and flown into the Wild on collect). */
function makeBadge(text: string): Container {
  const badge = new Container();
  const w = 64;
  const h = 26;
  const bg = new Graphics()
    .roundRect(-w / 2, -h / 2, w, h, h / 2)
    .fill({ color: 0x0a0e18, alpha: 0.92 })
    .roundRect(-w / 2, -h / 2, w, h, h / 2)
    .stroke({ width: 2, color: colors.accent });
  const label = new Text({
    text,
    style: { fill: colors.accent, fontFamily, fontSize: 16, fontWeight: '800' },
  });
  label.anchor.set(0.5);
  badge.addChild(bg, label);
  return badge;
}

/** A symbol tile: the sprite, plus an optional value badge baked in (for prizes). */
function makeSymbolTile(id: SymbolId, badgeText?: string): { tile: Container; badge?: Container } {
  const tile = new Container();
  tile.addChild(makeSymbolSprite(id));
  let badge: Container | undefined;
  if (badgeText) {
    badge = makeBadge(badgeText);
    badge.position.set(0, BADGE_DY);
    tile.addChild(badge);
  }
  return { tile, badge };
}

interface FlyingBadge {
  node: Container;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  duration: number;
  arrived: boolean;
}

interface Glow {
  node: Graphics;
  elapsed: number;
  duration: number;
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
  /** Row -> badge text for the landed (visible) prize cells. */
  private prizeByRow = new Map<number, string>();
  /** Row -> the badge node currently shown, so collect can detach it. */
  private prizeBadges = new Map<number, Container>();

  constructor(initial: SymbolId[]) {
    super();
    const mask = new Graphics().rect(0, 0, CELL.width, ROWS * CELL.height).fill(0xffffff);
    this.addChild(this.strip, mask);
    this.mask = mask;
    this.set(initial);
  }

  set(symbols: SymbolId[], prizeByRow?: Map<number, string>): void {
    this.spinning = false;
    this.resolve?.();
    this.resolve = undefined;
    this.prizeByRow = prizeByRow ?? new Map();
    this.build(symbols.slice(0, ROWS));
    this.strip.y = 0;
  }

  spinTo(target: SymbolId[], durationMs: number, prizeByRow: Map<number, string>): Promise<void> {
    this.target = target.slice(0, ROWS);
    this.prizeByRow = prizeByRow;
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

  /** Detach (hide) the baked prize badge at a row, so it can fly to the Wild. */
  hidePrizeBadge(row: number): void {
    const badge = this.prizeBadges.get(row);
    if (badge) badge.visible = false;
  }

  private build(symbols: SymbolId[]): void {
    this.strip.removeChildren();
    this.prizeBadges.clear();
    symbols.forEach((id, i) => {
      const { tile, badge } = makeSymbolTile(id, this.prizeByRow.get(i));
      tile.x = CELL.width / 2;
      tile.y = i * CELL.height + CELL.height / 2;
      this.strip.addChild(tile);
      if (badge) this.prizeBadges.set(i, badge);
    });
  }
}

/** The full reel set: columns + layers for lock/win highlights and collect FX. */
export class Reels extends Container {
  private readonly columns: ReelColumn[] = [];
  private readonly highlights = new Container();
  private readonly winLayer = new Container();
  private readonly fxLayer = new Container();
  private winPulse = 0;
  private flying: FlyingBadge[] = [];
  private glows: Glow[] = [];
  private collectResolve?: () => void;
  private collectPrizes: PrizeCell[] = [];
  private collectWilds: Position[] = [];
  private collectBet = 1;
  private collectPassIndex = 0;

  constructor(initialGrid: SymbolId[][]) {
    super();
    for (let col = 0; col < COLS; col++) {
      const column = new ReelColumn(initialGrid[col] ?? []);
      column.x = col * CELL.width;
      this.addChild(column);
      this.columns.push(column);
    }
    this.drawSeparators();
    this.addChild(this.highlights, this.winLayer, this.fxLayer);
  }

  update(dtMs: number): void {
    for (const column of this.columns) column.update(dtMs);

    if (this.winLayer.children.length > 0) {
      this.winPulse += dtMs;
      this.winLayer.alpha = 0.55 + 0.45 * (Math.sin(this.winPulse / 220) * 0.5 + 0.5);
    }

    this.updateFlying(dtMs);
    this.updateGlows(dtMs);
  }

  /** Snap to a board. `prizes` bake value badges onto the prize cells. */
  setGrid(grid: SymbolId[][], prizes: PrizeCell[] = [], betPerLine = 1): void {
    this.highlights.removeChildren();
    this.clearWins();
    this.clearCollectFx();
    const byColumn = this.prizeMaps(prizes, betPerLine);
    grid.forEach((column, i) => this.columns[i]?.set(column, byColumn[i]));
  }

  /** Animated spin: reels scroll and land staggered, prize values baked into the tiles. */
  spin(grid: SymbolId[][], prizes: PrizeCell[], betPerLine: number): Promise<void> {
    this.highlights.removeChildren();
    this.clearWins();
    this.clearCollectFx();
    const byColumn = this.prizeMaps(prizes, betPerLine);
    return Promise.all(
      this.columns.map((column, i) =>
        column.spinTo(grid[i] ?? [], SPIN.baseMs + i * SPIN.staggerMs, byColumn[i]),
      ),
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

  /** Outline + pulse the winning cells (Spin Results: "the winning payline is animated"). */
  showWins(positions: Position[]): void {
    this.clearWins();
    for (const pos of positions) {
      const marker = new Graphics()
        .roundRect(pos.reel * CELL.width + 3, pos.row * CELL.height + 3, CELL.width - 6, CELL.height - 6, 10)
        .stroke({ width: 4, color: colors.accent });
      this.winLayer.addChild(marker);
    }
  }

  clearWins(): void {
    this.winLayer.removeChildren();
    this.winPulse = 0;
    this.winLayer.alpha = 1;
  }

  /**
   * Free spins: every Wild collects all the prizes. With multiple Wilds we run
   * one pass per Wild (copies fly into that Wild and pop a glow); the badges
   * stay on the horses until the final Wild's pass removes them.
   */
  collectIntoWild(prizes: PrizeCell[], wilds: Position[], betPerLine: number): Promise<void> {
    this.clearCollectFx();
    if (prizes.length === 0 || wilds.length === 0) return Promise.resolve();
    this.collectPrizes = prizes;
    this.collectWilds = wilds;
    this.collectBet = betPerLine;
    this.collectPassIndex = 0;
    this.startCollectPass(0);
    return new Promise((resolve) => (this.collectResolve = resolve));
  }

  /** Launch one collection pass: a copy of every prize flies into wild #index. */
  private startCollectPass(index: number): void {
    const wild = this.collectWilds[index];
    const target = cellCenter(wild.reel, wild.row);
    const stagger = 70;
    const duration = 360;
    // On the final pass the badge leaves the horse for good: hide it now so the
    // flying copy reads as the badge itself travelling into the last Wild.
    if (index >= this.collectWilds.length - 1) {
      for (const prize of this.collectPrizes) this.columns[prize.reel]?.hidePrizeBadge(prize.row);
    }
    this.flying = this.collectPrizes.map((prize, i) => {
      const node = makeBadge(formatCash(prize.value * this.collectBet));
      const fromX = prize.reel * CELL.width + CELL.width / 2;
      const fromY = prize.row * CELL.height + CELL.height / 2 + BADGE_DY;
      node.position.set(fromX, fromY);
      this.fxLayer.addChild(node);
      return { node, fromX, fromY, toX: target.x, toY: target.y, elapsed: -i * stagger, duration, arrived: false };
    });
  }

  /** Reset any in-flight collect FX (called when a new spin starts). */
  clearCollectFx(): void {
    this.fxLayer.removeChildren();
    this.flying = [];
    this.glows = [];
    this.collectPrizes = [];
    this.collectWilds = [];
    this.collectPassIndex = 0;
    this.collectResolve?.();
    this.collectResolve = undefined;
  }

  private prizeMaps(prizes: PrizeCell[], betPerLine: number): Map<number, string>[] {
    const maps = this.columns.map(() => new Map<number, string>());
    for (const prize of prizes) maps[prize.reel]?.set(prize.row, formatCash(prize.value * betPerLine));
    return maps;
  }

  private updateFlying(dtMs: number): void {
    if (this.flying.length === 0) return;
    let allArrived = true;
    for (const badge of this.flying) {
      if (badge.arrived) continue;
      badge.elapsed += dtMs;
      if (badge.elapsed < 0) {
        allArrived = false;
        continue;
      }
      const t = Math.min(1, badge.elapsed / badge.duration);
      const e = easeInQuad(t);
      badge.node.x = badge.fromX + (badge.toX - badge.fromX) * e;
      badge.node.y = badge.fromY + (badge.toY - badge.fromY) * e;
      badge.node.scale.set(1 - 0.45 * t);
      if (t >= 1) {
        badge.arrived = true;
        this.fxLayer.removeChild(badge.node);
        this.spawnGlow(badge.toX, badge.toY);
      } else {
        allArrived = false;
      }
    }
    if (allArrived) {
      this.flying = [];
      const isLastPass = this.collectPassIndex >= this.collectWilds.length - 1;
      if (isLastPass) {
        // Badges already left the horses at the start of this pass.
        const done = this.collectResolve;
        this.collectResolve = undefined;
        done?.();
      } else {
        this.collectPassIndex += 1;
        this.startCollectPass(this.collectPassIndex);
      }
    }
  }

  private updateGlows(dtMs: number): void {
    if (this.glows.length === 0) return;
    this.glows = this.glows.filter((glow) => {
      glow.elapsed += dtMs;
      const t = Math.min(1, glow.elapsed / glow.duration);
      glow.node.scale.set(0.4 + t * 1.3);
      glow.node.alpha = 1 - t;
      if (t >= 1) {
        this.fxLayer.removeChild(glow.node);
        return false;
      }
      return true;
    });
  }

  private spawnGlow(x: number, y: number): void {
    const ring = new Graphics().circle(0, 0, CELL.width * 0.42).stroke({ width: 5, color: colors.accent });
    ring.position.set(x, y);
    this.fxLayer.addChild(ring);
    this.glows.push({ node: ring, elapsed: 0, duration: 320 });
  }

  /** Thin vertical dividers between the reels (COLS - 1 of them). */
  private drawSeparators(): void {
    const separators = new Graphics();
    const height = ROWS * CELL.height;
    for (let i = 1; i < COLS; i++) {
      separators.rect(i * CELL.width - SEPARATOR.width / 2, 0, SEPARATOR.width, height);
    }
    separators.fill({ color: SEPARATOR.color });
    this.addChild(separators);
  }
}
