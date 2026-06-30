import { BlurFilter, ColorMatrixFilter, Container, Graphics, Text } from 'pixi.js';
import type { SymbolId } from '../config/symbols';
import { SYMBOLS, SCATTER } from '../config/symbols';
import type { LineWin, Position, PrizeCell } from '../types/slot';
import { ANTICIPATION, CELL, COLS, ROWS, SPIN, SEPARATOR, WIN_FX, HOLD_RESPIN_FX, fontFamily, colors } from './theme';
import { makeSymbolSprite } from './SymbolSprite';
import { planAnticipation, type AnticipationPlan } from './anticipation';
import type { WinFxParams } from './winFx';
import { ShimmerFilter } from './filters/ShimmerFilter';
import { PAYLINES } from '../config/paylines';

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Random filler symbols shown while a reel is mid-spin (cosmetic only). */
const FILLERS = 10;

function randomSymbol(): SymbolId {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

type Easing = (t: number) => number;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Longer fast phase, sharper settle — the deliberate "extended spin" feel. */
function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * Overshoots past the stop then settles back — the reel lets the Scatter slip a
 * hair past the payline before pulling it home (the spec's near-miss tease).
 */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInQuad(t: number): number {
  return t * t;
}

/** Scatter landing bounce: 1 → 0.92 → 1.08 → 1 over the bounce window. */
function bounceScale(elapsed: number): number {
  const t = Math.min(1, elapsed / ANTICIPATION.bounceMs);
  if (t < 0.33) return 1 - 0.08 * (t / 0.33);
  if (t < 0.66) return 0.92 + 0.16 * ((t - 0.33) / 0.33);
  return 1.08 - 0.08 * ((t - 0.66) / 0.34);
}

/** A smooth 0 → 1 → 0 bump (half-sine), for a symbol pop's scale and lift. */
function bump(t: number): number {
  return Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
}

function formatCash(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Stable key for a board cell (de-dupes positions shared across paylines). */
function cellKey(reel: number, row: number): string {
  return `${reel}:${row}`;
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

/** Scene-level effects the reels ask for during the anticipation cinematic. */
export interface CinematicHooks {
  /** Dim/restore the background (focus the reels). */
  dim(active: boolean): void;
  /** Flash a full-screen bloom as the triggering Scatter lands. */
  bloom(): void;
}

/** A landed tile mid-bounce (the Scatter's squash-and-stretch on arrival). */
interface Bounce {
  tile: Container;
  elapsed: number;
}

/** An expanding gold shockwave ring. */
interface Shockwave {
  node: Graphics;
  elapsed: number;
}

/** One winning symbol mid-pop: scale + lift bump over its activation window. */
interface SymbolPop {
  tile: Container;
  baseY: number;
  elapsed: number;
  duration: number;
  popScale: number;
  liftPx: number;
}

/** A payline being traced left → right along a win path. */
interface PaylineTrace {
  node: Graphics;
  points: { x: number; y: number }[];
  elapsed: number;
  drawMs: number;
  width: number;
  color: number;
  alpha: number;
}

/** A soft inner glow blooming behind a winning symbol (blurred, additive). */
interface SoftGlow {
  node: Graphics;
  elapsed: number;
  duration: number;
  peak: number;
}

/** A single shimmer sweep playing over a winning symbol (custom GPU filter). */
interface Shimmer {
  tile: Container;
  filter: ShimmerFilter;
  elapsed: number;
  duration: number;
}

/** Live state while an anticipation cinematic plays out. */
interface AntState {
  plan: AnticipationPlan;
  hooks: CinematicHooks;
  landed: Set<number>;
  breathe: number;
  shake: number;
  /** Reels base position, captured the first frame we shake it. */
  baseX: number;
  baseY: number;
  shaking: boolean;
}

/** One unlocked cell mid-respin: a single-cell strip scrolling to its target. */
interface CellSpin {
  reel: number;
  row: number;
  container: Container;
  strip: Container;
  elapsed: number;
  duration: number;
  fromY: number;
  arrived: boolean;
  /** This cell rolled a trophy — outline it the moment it lands. */
  locksOnLand: boolean;
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
  private easing: Easing = easeOutCubic;
  /** |Δy| on the last frame — drives the spinning reel's motion blur. */
  private lastSpeed = 0;
  private blur?: BlurFilter;
  private blurOn = false;
  /** Row -> badge text for the landed (visible) prize cells. */
  private prizeByRow = new Map<number, string>();
  /** Row -> the badge node currently shown, so collect can detach it. */
  private prizeBadges = new Map<number, Container>();
  /** Row -> the landed tile, so Hold & Respin can hide a cell while it respins. */
  private tilesByRow = new Map<number, Container>();

  constructor(initial: SymbolId[]) {
    super();
    const mask = new Graphics().rect(0, 0, CELL.width, ROWS * CELL.height).fill(0xffffff);
    this.addChild(this.strip, mask);
    this.mask = mask;
    this.set(initial);
  }

  get isSpinning(): boolean {
    return this.spinning;
  }

  /** Pixels scrolled on the last frame — used to size the motion blur. */
  get speed(): number {
    return this.lastSpeed;
  }

  set(symbols: SymbolId[], prizeByRow?: Map<number, string>): void {
    this.spinning = false;
    this.resolve?.();
    this.resolve = undefined;
    this.prizeByRow = prizeByRow ?? new Map();
    this.setBlur(0);
    this.build(symbols.slice(0, ROWS));
    this.strip.y = 0;
  }

  spinTo(
    target: SymbolId[],
    durationMs: number,
    prizeByRow: Map<number, string>,
    easing: Easing = easeOutCubic,
  ): Promise<void> {
    this.target = target.slice(0, ROWS);
    this.prizeByRow = prizeByRow;
    this.easing = easing;
    const strip: SymbolId[] = [...this.target];
    for (let i = 0; i < FILLERS; i++) strip.push(randomSymbol());
    this.build(strip);
    this.fromY = -FILLERS * CELL.height;
    this.strip.y = this.fromY;
    this.lastSpeed = 0;
    this.elapsed = 0;
    this.duration = durationMs;
    this.spinning = true;
    return new Promise((resolve) => (this.resolve = resolve));
  }

  update(dtMs: number): void {
    if (!this.spinning) return;
    this.elapsed += dtMs;
    const t = Math.min(1, this.elapsed / this.duration);
    const prevY = this.strip.y;
    this.strip.y = this.fromY * (1 - this.easing(t));
    this.lastSpeed = Math.abs(this.strip.y - prevY);
    if (t >= 1) {
      this.spinning = false;
      this.lastSpeed = 0;
      this.setBlur(0);
      this.build(this.target);
      this.strip.y = 0;
      const done = this.resolve;
      this.resolve = undefined;
      done?.();
    }
  }

  /** Vertical-only motion blur on the scrolling strip (0 disables it). */
  setBlur(strength: number): void {
    if (strength <= 0.05) {
      if (this.blurOn) {
        this.strip.filters = [];
        this.blurOn = false;
      }
      return;
    }
    if (!this.blur) {
      this.blur = new BlurFilter({ strength: 0, quality: 3 });
      this.blur.strengthX = 0;
    }
    this.blur.strengthY = strength;
    if (!this.blurOn) {
      this.strip.filters = [this.blur];
      this.blurOn = true;
    }
  }

  /** The landed tile at a visible row, so a feature can bounce/animate it. */
  getTile(row: number): Container | undefined {
    return this.tilesByRow.get(row);
  }

  /** Detach (hide) the baked prize badge at a row, so it can fly to the Wild. */
  hidePrizeBadge(row: number): void {
    const badge = this.prizeBadges.get(row);
    if (badge) badge.visible = false;
  }

  /** Hold & Respin: hide/show a landed cell while a respin spinner plays over it. */
  setRowVisible(row: number, visible: boolean): void {
    const tile = this.tilesByRow.get(row);
    if (tile) tile.visible = visible;
  }

  private build(symbols: SymbolId[]): void {
    this.strip.removeChildren();
    this.prizeBadges.clear();
    this.tilesByRow.clear();
    symbols.forEach((id, i) => {
      const { tile, badge } = makeSymbolTile(id, this.prizeByRow.get(i));
      tile.x = CELL.width / 2;
      tile.y = i * CELL.height + CELL.height / 2;
      this.strip.addChild(tile);
      if (badge) this.prizeBadges.set(i, badge);
      if (i < ROWS) this.tilesByRow.set(i, tile);
    });
  }
}

/** The full reel set: columns + layers for lock/win highlights and collect FX. */
export class Reels extends Container {
  private readonly columns: ReelColumn[] = [];
  private readonly respinLayer = new Container();
  private readonly highlights = new Container();
  private readonly winLayer = new Container();
  private readonly fxLayer = new Container();
  // --- Win presentation (focus → payline → activation → finish) ---
  /** Shared dim filter on every non-winning tile; its `alpha` is the focus blend. */
  private dimFilter?: ColorMatrixFilter;
  private dimmedTiles: Container[] = [];
  private focus = 0; // current dim blend, 0 (clear) → 1 (fully dimmed)
  private focusTarget = 0;
  private focusFadeMs: number = WIN_FX.focusInMs;
  private pops: SymbolPop[] = [];
  private traces: PaylineTrace[] = [];
  private softGlows: SoftGlow[] = [];
  private shimmers: Shimmer[] = [];
  private winShakeAmp = 0;
  private winShakeElapsed = 0;
  private winShakeMs = 0;
  private winShakeBaseX = 0;
  /** Bumped on every teardown so a still-awaiting presentation aborts cleanly. */
  private winToken = 0;
  private flying: FlyingBadge[] = [];
  private glows: Glow[] = [];
  private bounces: Bounce[] = [];
  private shockwaves: Shockwave[] = [];
  /** The breathing gold outline on the active anticipation reel. */
  private antOutline?: Graphics;
  private ant: AntState | null = null;
  private respins: CellSpin[] = [];
  private respinResolve?: () => void;
  private collectResolve?: () => void;
  private collectPrizes: PrizeCell[] = [];
  private collectWilds: Position[] = [];
  private collectBet = 1;
  private collectPassIndex = 0;
  /** The board currently on screen, so a respin can scroll out of the right symbol. */
  private displayed: SymbolId[][] = [];

  constructor(initialGrid: SymbolId[][]) {
    super();
    for (let col = 0; col < COLS; col++) {
      const column = new ReelColumn(initialGrid[col] ?? []);
      column.x = col * CELL.width;
      this.addChild(column);
      this.columns.push(column);
    }
    this.displayed = initialGrid.map((column) => [...column]);
    this.drawSeparators();
    this.addChild(this.respinLayer, this.highlights, this.winLayer, this.fxLayer);
  }

  update(dtMs: number): void {
    for (const column of this.columns) column.update(dtMs);

    this.updateRespins(dtMs);
    this.updateFlying(dtMs);
    this.updateGlows(dtMs);
    this.updateAnticipation(dtMs);
    this.updateBounces(dtMs);
    this.updateShockwaves(dtMs);
    // Win presentation.
    this.updateFocus(dtMs);
    this.updateTraces(dtMs);
    this.updatePops(dtMs);
    this.updateSoftGlows(dtMs);
    this.updateShimmers(dtMs);
    this.updateWinShake(dtMs);
  }

  /** Snap to a board. `prizes` bake value badges onto the prize cells. */
  setGrid(grid: SymbolId[][], prizes: PrizeCell[] = [], betPerLine = 1): void {
    this.highlights.removeChildren();
    this.clearWins();
    this.clearCollectFx();
    const byColumn = this.prizeMaps(prizes, betPerLine);
    grid.forEach((column, i) => this.columns[i]?.set(column, byColumn[i]));
    this.displayed = grid.map((column) => [...column]);
  }

  /**
   * Animated spin: reels scroll and land staggered, prize values baked into the
   * tiles. When `hooks` are supplied (base spins only) and the board earns it,
   * the spin plays the Free Spins anticipation cinematic — extended teasing
   * reels, a breathing gold outline, camera shake, motion blur, and a bounce +
   * shockwave + bloom as the triggering Scatter lands. The reels only reveal the
   * predetermined board; the cinematic never changes the outcome.
   */
  spin(
    grid: SymbolId[][],
    prizes: PrizeCell[],
    betPerLine: number,
    hooks?: CinematicHooks,
  ): Promise<void> {
    this.highlights.removeChildren();
    this.clearWins();
    this.clearCollectFx();
    this.clearRespins();
    this.endAnticipation();
    const byColumn = this.prizeMaps(prizes, betPerLine);
    this.displayed = grid.map((column) => [...column]);

    const plan = hooks ? planAnticipation(grid, SCATTER, COLS) : null;
    if (plan && hooks) return this.spinAnticipated(grid, byColumn, plan, hooks);

    return Promise.all(
      this.columns.map((column, i) =>
        column.spinTo(grid[i] ?? [], SPIN.baseMs + i * SPIN.staggerMs, byColumn[i]),
      ),
    ).then(() => undefined);
  }

  /**
   * The cinematic spin. Every reel starts together, but the teasing reels are
   * given long, escalating durations so they stop one at a time, left → right,
   * after the others. As each reel lands we count Scatters and fire the matching
   * effects; `updateAnticipation` drives the per-frame outline/shake/blur.
   */
  private spinAnticipated(
    grid: SymbolId[][],
    byColumn: Map<number, string>[],
    plan: AnticipationPlan,
    hooks: CinematicHooks,
  ): Promise<void> {
    this.ant = {
      plan,
      hooks,
      landed: new Set(),
      breathe: 0,
      shake: 0,
      baseX: this.x,
      baseY: this.y,
      shaking: false,
    };

    const spins = this.columns.map((column, reel) => {
      const antIndex = plan.anticipationReels.indexOf(reel);
      const duration =
        antIndex >= 0
          ? ANTICIPATION.baseMs + antIndex * ANTICIPATION.stepMs
          : SPIN.baseMs + reel * SPIN.staggerMs;
      const easing =
        reel === plan.triggerReel ? easeOutBack : antIndex >= 0 ? easeOutQuint : easeOutCubic;
      return column
        .spinTo(grid[reel] ?? [], duration, byColumn[reel], easing)
        .then(() => this.onAnticipationLand(reel));
    });

    return Promise.all(spins).then(() => this.endAnticipation());
  }

  /** Fire the landing effects for one reel and advance the anticipation. */
  private onAnticipationLand(reel: number): void {
    const a = this.ant;
    if (!a) return;
    a.landed.add(reel);
    this.columns[reel]?.setBlur(0);

    // The second Scatter just landed — focus the board on the reels.
    if (reel === a.plan.twoAt) a.hooks.dim(true);

    // The Scatter that completes the 3+ trigger: bounce it, burst a shockwave,
    // and bloom the screen.
    if (reel === a.plan.triggerReel) {
      for (const row of a.plan.scatterRowsByReel[reel]) {
        const tile = this.columns[reel]?.getTile(row);
        if (tile) this.bounces.push({ tile, elapsed: 0 });
        const c = cellCenter(reel, row);
        this.spawnShockwave(c.x, c.y);
      }
      a.hooks.bloom();
    }

    // Once every teasing reel has stopped, lift the dim and end the build-up.
    if (a.plan.anticipationReels.every((r) => a.landed.has(r))) a.hooks.dim(false);
  }

  /** Per-frame: breathing outline on the active reel, camera shake, motion blur. */
  private updateAnticipation(dtMs: number): void {
    const a = this.ant;
    if (!a) return;
    a.breathe += dtMs;

    // The active reel is the leftmost teasing reel still spinning — but only
    // once the second Scatter has actually landed.
    let active = -1;
    if (a.landed.has(a.plan.twoAt)) {
      for (const reel of a.plan.anticipationReels) {
        if (!a.landed.has(reel)) {
          active = reel;
          break;
        }
      }
    }

    if (active >= 0) {
      const cycle = Math.sin((a.breathe / ANTICIPATION.breatheMs) * Math.PI * 2) * 0.5 + 0.5;
      const alpha =
        ANTICIPATION.breatheMin + (ANTICIPATION.breatheMax - ANTICIPATION.breatheMin) * cycle;
      this.showAntOutline(active, alpha);

      // Subtle camera shake on the reels (≈ ±1px) while a reel teases.
      a.shake += dtMs;
      if (!a.shaking) {
        a.baseX = this.x;
        a.baseY = this.y;
        a.shaking = true;
      }
      const dx = Math.sin((a.shake / 1000) * Math.PI * 2 * ANTICIPATION.shakeHz) * ANTICIPATION.shakeAmp;
      this.position.set(a.baseX + dx, a.baseY);
    } else {
      this.hideAntOutline();
      this.stopShake(a);
    }

    // Motion blur tracks each teasing reel's scroll speed, so it fades to zero
    // as the reel eases to a stop.
    for (const reel of a.plan.anticipationReels) {
      const column = this.columns[reel];
      if (!column) continue;
      column.setBlur(column.isSpinning ? Math.min(ANTICIPATION.blurMax, column.speed * 0.4) : 0);
    }
  }

  private showAntOutline(reel: number, alpha: number): void {
    if (!this.antOutline) {
      this.antOutline = new Graphics()
        .roundRect(2, 2, CELL.width - 4, ROWS * CELL.height - 4, 10)
        .stroke({ width: ANTICIPATION.outlineWidth, color: ANTICIPATION.outlineColor });
      this.fxLayer.addChild(this.antOutline);
    }
    this.antOutline.visible = true;
    this.antOutline.x = reel * CELL.width;
    this.antOutline.alpha = alpha;
  }

  private hideAntOutline(): void {
    if (!this.antOutline) return;
    this.fxLayer.removeChild(this.antOutline);
    this.antOutline.destroy();
    this.antOutline = undefined;
  }

  private stopShake(a: AntState): void {
    if (!a.shaking) return;
    this.position.set(a.baseX, a.baseY);
    a.shaking = false;
  }

  /** Tear down all cinematic state, restoring the reels to a neutral pose. */
  private endAnticipation(): void {
    const a = this.ant;
    if (!a) return;
    this.stopShake(a);
    this.hideAntOutline();
    for (const reel of a.plan.anticipationReels) this.columns[reel]?.setBlur(0);
    this.ant = null;
  }

  private updateBounces(dtMs: number): void {
    if (this.bounces.length === 0) return;
    this.bounces = this.bounces.filter((b) => {
      b.elapsed += dtMs;
      if (b.elapsed >= ANTICIPATION.bounceMs) {
        b.tile.scale.set(1);
        return false;
      }
      b.tile.scale.set(bounceScale(b.elapsed));
      return true;
    });
  }

  private spawnShockwave(x: number, y: number): void {
    const ring = new Graphics()
      .circle(0, 0, ANTICIPATION.shockwaveRadius)
      .stroke({ width: 4, color: ANTICIPATION.outlineColor });
    ring.position.set(x, y);
    ring.scale.set(0);
    this.fxLayer.addChild(ring);
    this.shockwaves.push({ node: ring, elapsed: 0 });
  }

  private updateShockwaves(dtMs: number): void {
    if (this.shockwaves.length === 0) return;
    this.shockwaves = this.shockwaves.filter((s) => {
      s.elapsed += dtMs;
      const t = Math.min(1, s.elapsed / ANTICIPATION.shockwaveMs);
      s.node.scale.set(t);
      s.node.alpha = 1 - t;
      if (t >= 1) {
        this.fxLayer.removeChild(s.node);
        return false;
      }
      return true;
    });
  }

  /**
   * Hold & Respin "Golden Freeze" — the recognition moment as the feature
   * triggers. Every non-trophy tile fades back; each locked trophy stays lit,
   * blooms a soft gold glow, bursts a shockwave, and bounces. The board gives a
   * short shake. Resolves once the beat has held, restoring the dimmed tiles.
   */
  async playTrophyFreeze(locked: boolean[][]): Promise<void> {
    const dimmed: Container[] = [];
    for (let reel = 0; reel < COLS; reel++) {
      for (let row = 0; row < ROWS; row++) {
        const tile = this.columns[reel]?.getTile(row);
        if (!tile) continue;
        if (locked[reel]?.[row]) {
          const c = cellCenter(reel, row);
          this.spawnGoldGlow(c.x, c.y, HOLD_RESPIN_FX.freezeGlowPeak, HOLD_RESPIN_FX.freezeHoldMs);
          this.spawnShockwave(c.x, c.y);
          this.bounces.push({ tile, elapsed: 0 });
        } else {
          tile.alpha = HOLD_RESPIN_FX.freezeDimAlpha;
          dimmed.push(tile);
        }
      }
    }
    this.startWinShake(HOLD_RESPIN_FX.freezeShakeAmp, HOLD_RESPIN_FX.freezeShakeMs);
    await wait(HOLD_RESPIN_FX.freezeHoldMs);
    for (const tile of dimmed) tile.alpha = 1;
  }

  /** A blurred, additive gold disc that blooms (0 → peak → 0) at a board point. */
  private spawnGoldGlow(x: number, y: number, peak: number, duration: number): void {
    const node = new Graphics().circle(0, 0, CELL.width * 0.4).fill({ color: colors.accent });
    node.position.set(x, y);
    node.alpha = 0;
    node.blendMode = 'add';
    node.filters = [new BlurFilter({ strength: 14, quality: 2 })];
    this.winLayer.addChild(node);
    this.softGlows.push({ node, elapsed: 0, duration, peak });
  }

  /** Hold & Respin: snap to the board and outline the locked cells. */
  showLocked(grid: SymbolId[][], locked: boolean[][]): void {
    this.clearRespins();
    this.setGrid(grid);
    this.outlineLocked(locked);
  }

  /**
   * Hold & Respin: spin every cell that wasn't already locked, landing it on
   * whatever it rolled — a trophy lands naturally like any other symbol, and
   * only gets outlined once it arrives. Cells locked before the respin hold in
   * place. Resolves once every spinning cell has landed.
   *
   * @param heldBefore  cells locked before this respin (stay put, outlined now)
   * @param lockedAfter cells locked after — a `true` not in `heldBefore` is a
   *                    trophy that just landed and gets outlined on arrival.
   */
  respin(
    grid: SymbolId[][],
    heldBefore: boolean[][],
    lockedAfter: boolean[][],
    prizes: PrizeCell[] = [],
    betPerLine = 1,
  ): Promise<void> {
    this.clearRespins();
    const onScreen = this.displayed; // symbols currently shown — capture before setGrid
    // Bake trophy value badges onto the (final) board; spinners cover moving cells.
    this.setGrid(grid, prizes, betPerLine);
    const badges = this.prizeMaps(prizes, betPerLine); // reel -> row -> value text

    for (let reel = 0; reel < grid.length; reel++) {
      for (let row = 0; row < (grid[reel]?.length ?? 0); row++) {
        if (heldBefore[reel]?.[row]) {
          this.addLockMarker(reel, row); // already-locked trophy: hold and outline
          continue;
        }
        const locksOnLand = lockedAfter[reel]?.[row] === true;
        const current = onScreen[reel]?.[row] ?? grid[reel][row];
        // A landing trophy carries its value badge as it scrolls in (not popped on).
        const badgeText = badges[reel]?.get(row);
        this.respins.push(
          this.spinCell(reel, row, grid[reel][row], current, reel * SPIN.staggerMs, locksOnLand, badgeText),
        );
      }
    }

    if (this.respins.length === 0) return Promise.resolve();
    return new Promise((resolve) => (this.respinResolve = resolve));
  }

  private outlineLocked(locked: boolean[][]): void {
    for (let reel = 0; reel < locked.length; reel++) {
      for (let row = 0; row < locked[reel].length; row++) {
        if (locked[reel][row]) this.addLockMarker(reel, row);
      }
    }
  }

  private addLockMarker(reel: number, row: number): void {
    const marker = new Graphics()
      .rect(reel * CELL.width, row * CELL.height, CELL.width, CELL.height)
      .stroke({ color: colors.lock, width: 5 });
    this.highlights.addChild(marker);
  }

  /** Build a single-cell scroller that starts on `current` and lands on `target`. */
  private spinCell(
    reel: number,
    row: number,
    target: SymbolId,
    current: SymbolId,
    delayMs: number,
    locksOnLand: boolean,
    badgeText?: string,
  ): CellSpin {
    const container = new Container();
    container.x = reel * CELL.width;
    container.y = row * CELL.height;
    const mask = new Graphics().rect(0, 0, CELL.width, CELL.height).fill(0xffffff);
    const strip = new Container();
    container.addChild(strip, mask);
    container.mask = mask;

    // Top -> bottom: [target, fillers..., current]. The strip starts shifted up so
    // `current` (the symbol already on screen) shows first, then scrolls down past
    // the fillers and settles on `target` — a continuous spin, no symbol jump. The
    // target carries its value badge (if any) so it arrives with the value on it.
    const ids: SymbolId[] = [target];
    for (let i = 0; i < FILLERS; i++) ids.push(randomSymbol());
    ids.push(current);
    ids.forEach((id, i) => {
      const tile = i === 0 && badgeText ? makeSymbolTile(id, badgeText).tile : makeSymbolSprite(id);
      tile.x = CELL.width / 2;
      tile.y = i * CELL.height + CELL.height / 2;
      strip.addChild(tile);
    });

    const fromY = -(ids.length - 1) * CELL.height; // bottom tile (current) in view
    strip.y = fromY;
    this.respinLayer.addChild(container);
    this.columns[reel]?.setRowVisible(row, false);
    return { reel, row, container, strip, elapsed: -delayMs, duration: SPIN.baseMs, fromY, arrived: false, locksOnLand };
  }

  private updateRespins(dtMs: number): void {
    if (this.respins.length === 0) return;
    let allArrived = true;
    for (const cell of this.respins) {
      if (cell.arrived) continue;
      cell.elapsed += dtMs;
      if (cell.elapsed < 0) {
        allArrived = false; // still in its stagger delay
        continue;
      }
      const t = Math.min(1, cell.elapsed / cell.duration);
      cell.strip.y = cell.fromY * (1 - easeOutCubic(t));
      if (t >= 1) {
        cell.arrived = true;
        this.columns[cell.reel]?.setRowVisible(cell.row, true);
        this.respinLayer.removeChild(cell.container);
        if (cell.locksOnLand) {
          // A trophy just landed and locks — impact: outline, shockwave, bloom.
          this.addLockMarker(cell.reel, cell.row);
          const c = cellCenter(cell.reel, cell.row);
          this.spawnShockwave(c.x, c.y);
          this.spawnGoldGlow(c.x, c.y, HOLD_RESPIN_FX.lockGlowPeak, HOLD_RESPIN_FX.lockGlowMs);
        }
      } else {
        allArrived = false;
      }
    }
    if (allArrived) {
      this.respins = [];
      const done = this.respinResolve;
      this.respinResolve = undefined;
      done?.();
    }
  }

  /** Tear down any in-flight respin spinners (called before a new board lands). */
  clearRespins(): void {
    for (const cell of this.respins) {
      this.columns[cell.reel]?.setRowVisible(cell.row, true);
      this.respinLayer.removeChild(cell.container);
    }
    this.respins = [];
    this.respinResolve?.();
    this.respinResolve = undefined;
  }

  /**
   * Present a winning spin (see soundIdea.md → "SLOT WIN & BONUS FX SYSTEM"),
   * following the spec's "one emotion per moment" cadence:
   *
   *   1. Focus     — dim the non-winning symbols (a ColorMatrix shader filter).
   *   2. Reveal    — trace each payline left → right in soft amber.
   *   3. Activate  — pop each winning symbol in turn, with a soft inner glow
   *                  (blurred additive) and a single shimmer sweep (custom GPU
   *                  filter), reels ordered left → right.
   *   4. (big FX)  — at/above the intensity gates: a brief camera shake, and a
   *                  full-screen bloom flash via the supplied `onBloom` hook.
   *   5. Finish    — hold the lit win, then restore the board smoothly.
   *
   * Resolves once the whole sequence has settled. Effects never stack — each
   * step is timed against the next so the board reads cleanly. All timing/scale
   * comes from `params` (see winFxParams); the presentation never changes the
   * outcome it's showing.
   */
  async playWinPresentation(
    lineWins: LineWin[],
    params: WinFxParams,
    onBloom?: () => void,
  ): Promise<void> {
    this.clearWins();
    if (lineWins.length === 0 || params.intensity <= 0) return;

    const token = this.winToken;
    const aborted = (): boolean => this.winToken !== token;

    // The winning cells, de-duped (a cell can sit on several paylines), ordered
    // left → right then top → bottom for a clean sequential cascade.
    const winning = new Map<string, Position>();
    for (const win of lineWins) {
      for (const pos of win.positions) winning.set(cellKey(pos.reel, pos.row), pos);
    }
    const order = [...winning.values()].sort((a, b) => a.reel - b.reel || a.row - b.row);

    // STEP 1 — Focus: dim everything that didn't win.
    this.beginFocus(winning, params);
    await wait(params.focusInMs);
    if (aborted()) return;

    // STEP 2 — Reveal: trace every winning payline at once, left → right.
    for (const win of lineWins) this.tracePayline(win, params);
    await wait(params.lineDrawMs);
    if (aborted()) return;

    // STEP 4 (big wins) — a single camera shake + bloom as the symbols light up.
    if (params.bigFx) this.startWinShake(params.shakeAmp, params.shakeMs);
    if (params.bloom) onBloom?.();

    // STEP 3 — Activate: pop each winning symbol in turn (glow + shimmer).
    for (const pos of order) {
      if (aborted()) return;
      this.activateSymbol(pos.reel, pos.row, params);
      await wait(params.stepMs);
    }

    // STEP 5 — Finish: hold the lit win, then restore.
    await wait(params.holdMs);
    if (aborted()) return;
    this.endFocus(params);
    await wait(params.focusOutMs);
    if (aborted()) return;
    this.clearWins();
  }

  /** STEP 1: apply the shared dim filter to every tile that isn't a winner. */
  private beginFocus(winning: Map<string, Position>, params: WinFxParams): void {
    if (!this.dimFilter) this.dimFilter = new ColorMatrixFilter();
    const filter = this.dimFilter;
    // Build the target look (desaturate, then darken); `alpha` blends it in/out.
    filter.saturate(params.dimSaturate, false);
    filter.brightness(params.dimBrightness, true);
    filter.alpha = this.focus; // continue from wherever a prior fade left it

    this.dimmedTiles = [];
    for (let reel = 0; reel < COLS; reel++) {
      for (let row = 0; row < ROWS; row++) {
        if (winning.has(cellKey(reel, row))) continue;
        const tile = this.columns[reel]?.getTile(row);
        if (!tile) continue;
        tile.filters = [filter];
        this.dimmedTiles.push(tile);
      }
    }

    this.focusTarget = 1;
    this.focusFadeMs = params.focusInMs;
  }

  /** STEP 5: begin easing the dim back out (tiles are detached once it hits 0). */
  private endFocus(params: WinFxParams): void {
    this.focusTarget = 0;
    this.focusFadeMs = params.focusOutMs;
  }

  private updateFocus(dtMs: number): void {
    if (!this.dimFilter || this.focus === this.focusTarget) return;
    const step = Math.min(1, dtMs / Math.max(1, this.focusFadeMs));
    this.focus += (this.focusTarget - this.focus) * step;
    if (Math.abs(this.focus - this.focusTarget) < 0.01) this.focus = this.focusTarget;
    this.dimFilter.alpha = this.focus;
    if (this.focus === 0) this.detachDim();
  }

  /** Drop the dim filter off every tile (focus fully lifted). */
  private detachDim(): void {
    for (const tile of this.dimmedTiles) tile.filters = [];
    this.dimmedTiles = [];
  }

  /**
   * STEP 2: a soft amber line traced left → right along the win's payline. The
   * line spans the *whole* payline (every reel), not just the paying cells, so
   * it reads as one continuous path rather than a segment that begins mid-board.
   * Only the winning symbols pop (see activateSymbol) — the line just shows the
   * shape. Falls back to the paying cells if the payline index is unknown.
   */
  private tracePayline(win: LineWin, params: WinFxParams): void {
    const pattern = PAYLINES[win.payline] as number[] | undefined;
    const points = pattern
      ? pattern.map((row, reel) => cellCenter(reel, row))
      : win.positions
          .slice()
          .sort((a, b) => a.reel - b.reel)
          .map((p) => cellCenter(p.reel, p.row));
    if (points.length < 2) return;
    const node = new Graphics();
    this.winLayer.addChild(node);
    this.traces.push({
      node,
      points,
      elapsed: 0,
      drawMs: params.lineDrawMs,
      width: params.lineWidth,
      color: params.lineColor,
      alpha: params.lineAlpha,
    });
  }

  private updateTraces(dtMs: number): void {
    if (this.traces.length === 0) return;
    for (const trace of this.traces) {
      trace.elapsed += dtMs;
      const frac = Math.min(1, trace.elapsed / trace.drawMs);
      this.drawTrace(trace, frac);
    }
  }

  /** Redraw a payline up to `frac` of its total length (a left → right wipe). */
  private drawTrace(trace: PaylineTrace, frac: number): void {
    const { node, points } = trace;
    node.clear();
    let total = 0;
    const segs: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      segs.push(len);
      total += len;
    }
    const target = total * frac;
    node.moveTo(points[0].x, points[0].y);
    let acc = 0;
    for (let i = 0; i < segs.length; i++) {
      if (acc + segs[i] <= target) {
        node.lineTo(points[i + 1].x, points[i + 1].y);
        acc += segs[i];
      } else {
        const t = (target - acc) / segs[i];
        node.lineTo(
          points[i].x + (points[i + 1].x - points[i].x) * t,
          points[i].y + (points[i + 1].y - points[i].y) * t,
        );
        break;
      }
    }
    node.stroke({ width: trace.width, color: trace.color, alpha: trace.alpha, cap: 'round', join: 'round' });
  }

  /** STEP 3: pop one winning symbol — scale + lift, soft glow, shimmer sweep. */
  private activateSymbol(reel: number, row: number, params: WinFxParams): void {
    const tile = this.columns[reel]?.getTile(row);
    if (!tile) return;

    this.pops.push({
      tile,
      baseY: tile.y,
      elapsed: 0,
      duration: params.activationMs,
      popScale: params.popScale,
      liftPx: params.liftPx,
    });

    const c = cellCenter(reel, row);
    this.spawnSoftGlow(c.x, c.y, params);
    this.spawnShimmer(tile, params);
  }

  private updatePops(dtMs: number): void {
    if (this.pops.length === 0) return;
    this.pops = this.pops.filter((pop) => {
      pop.elapsed += dtMs;
      const t = pop.elapsed / pop.duration;
      if (t >= 1) {
        pop.tile.scale.set(1);
        pop.tile.y = pop.baseY;
        return false;
      }
      const b = bump(t);
      pop.tile.scale.set(1 + (pop.popScale - 1) * b);
      pop.tile.y = pop.baseY - pop.liftPx * b;
      return true;
    });
  }

  /** A blurred, additive amber disc that blooms behind a symbol (inner glow). */
  private spawnSoftGlow(x: number, y: number, params: WinFxParams): void {
    const node = new Graphics().circle(0, 0, CELL.width * 0.34).fill({ color: colors.accent });
    node.position.set(x, y);
    node.alpha = 0;
    node.blendMode = 'add';
    node.filters = [new BlurFilter({ strength: 12, quality: 2 })];
    this.winLayer.addChild(node);
    this.softGlows.push({ node, elapsed: 0, duration: params.activationMs, peak: params.glowAlpha });
  }

  private updateSoftGlows(dtMs: number): void {
    if (this.softGlows.length === 0) return;
    this.softGlows = this.softGlows.filter((glow) => {
      glow.elapsed += dtMs;
      const t = glow.elapsed / glow.duration;
      if (t >= 1) {
        this.winLayer.removeChild(glow.node);
        glow.node.destroy();
        return false;
      }
      glow.node.alpha = glow.peak * bump(t);
      return true;
    });
  }

  /** A single shimmer pass over a symbol, driven by the custom GPU filter. */
  private spawnShimmer(tile: Container, params: WinFxParams): void {
    const filter = new ShimmerFilter();
    filter.progress = 0;
    tile.filters = [filter];
    this.shimmers.push({ tile, filter, elapsed: 0, duration: params.shimmerMs });
  }

  private updateShimmers(dtMs: number): void {
    if (this.shimmers.length === 0) return;
    this.shimmers = this.shimmers.filter((s) => {
      s.elapsed += dtMs;
      const t = Math.min(1, s.elapsed / s.duration);
      s.filter.progress = t;
      if (t >= 1) {
        s.tile.filters = [];
        return false;
      }
      return true;
    });
  }

  /** STEP 4 (big wins): a brief, decaying horizontal camera shake on the reels. */
  private startWinShake(amp: number, ms: number): void {
    if (amp <= 0) return;
    this.winShakeBaseX = this.x;
    this.winShakeAmp = amp;
    this.winShakeMs = ms;
    this.winShakeElapsed = 0;
  }

  private updateWinShake(dtMs: number): void {
    if (this.winShakeAmp <= 0) return;
    this.winShakeElapsed += dtMs;
    const t = this.winShakeElapsed / this.winShakeMs;
    if (t >= 1) {
      this.x = this.winShakeBaseX;
      this.winShakeAmp = 0;
      return;
    }
    const decay = 1 - t;
    const dx = Math.sin((this.winShakeElapsed / 1000) * Math.PI * 2 * WIN_FX.shakeHz) * this.winShakeAmp * decay;
    this.x = this.winShakeBaseX + dx;
  }

  /** Tear down the whole win presentation, restoring the board to a neutral pose. */
  clearWins(): void {
    this.winToken++;

    // Restore any popped symbols, then clear the line/glow/shimmer layer.
    for (const pop of this.pops) {
      pop.tile.scale.set(1);
      pop.tile.y = pop.baseY;
    }
    this.pops = [];
    for (const s of this.shimmers) s.tile.filters = [];
    this.shimmers = [];
    this.traces = [];
    this.softGlows = [];
    for (const child of this.winLayer.removeChildren()) child.destroy();

    // Lift the focus dim immediately and detach it from the tiles.
    this.focus = 0;
    this.focusTarget = 0;
    if (this.dimFilter) this.dimFilter.alpha = 0;
    this.detachDim();

    // Stop any win shake and restore the reels' x.
    if (this.winShakeAmp > 0) this.x = this.winShakeBaseX;
    this.winShakeAmp = 0;
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
    this.fxLayer.removeChildren(); // also drops the anticipation outline + shockwaves
    this.flying = [];
    this.glows = [];
    this.antOutline = undefined;
    this.shockwaves = [];
    this.bounces = [];
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
