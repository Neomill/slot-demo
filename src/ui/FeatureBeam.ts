import { BlurFilter, Container, Graphics } from "pixi.js";
import { WILD_CHARGE as W } from "./theme";

interface Pt {
  x: number;
  y: number;
}

/** Point on the quadratic bezier from p0 → p2 with control p1 at parameter t. */
function quad(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/** One feature beam in flight: spline geometry + the layers that draw it. */
interface Beam {
  from: Pt;
  ctrl: Pt;
  to: Pt;
  elapsed: number;
  arrived: boolean;
  fading: boolean;
  fadeElapsed: number;
  sparkAccum: number;
  onArrive?: () => void;
  edge: Graphics; // blue, blurred, additive — the soft outer glow
  core: Graphics; // gold, crisp — the bright inner line
  head: Graphics; // bright travelling tip
}

/** A gold spark thrown off the beam head (and burst on impact). */
interface Spark {
  node: Graphics;
  vx: number;
  vy: number;
  elapsed: number;
  life: number;
}

/** How many segments the spline is sampled into when drawn. */
const SEGMENTS = 32;

/**
 * The Wild Charge beam (Free Spins). A curved bezier "feature energy" beam fired
 * from a Wild up to the next lock on the multiplier ladder — gold core, soft blue
 * edge, trailing gold sparks — exactly how modern slots telegraph progression.
 *
 * Lives in stage (global) coordinates, so `fire` takes screen-space endpoints.
 * `fire` resolves the instant the beam head ARRIVES (so the lock's charge can
 * begin on impact); the beam then fades out on its own. Pure presentation.
 */
export class FeatureBeam extends Container {
  private beams: Beam[] = [];
  private sparks: Spark[] = [];
  private readonly sparkLayer = new Container();

  constructor() {
    super();
    this.eventMode = "none";
    this.addChild(this.sparkLayer); // sparks sit above the beam lines
  }

  /** Fire a beam from `from` to `to`. Resolves when the head reaches `to`. */
  fire(from: Pt, to: Pt): Promise<void> {
    // Bow the control point perpendicular to the straight line for a curved arc.
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ctrl = {
      x: mx + (-dy / len) * W.beamCurve,
      y: my + (dx / len) * W.beamCurve,
    };

    const edge = new Graphics();
    edge.blendMode = "add";
    edge.filters = [new BlurFilter({ strength: 9, quality: 2 })];

    const core = new Graphics();
    core.blendMode = "add";

    const head = new Graphics()
      .circle(0, 0, W.beamCoreWidth * 1.8)
      .fill({ color: W.beamCoreColor });
    head.blendMode = "add";
    head.filters = [new BlurFilter({ strength: 6, quality: 2 })];

    // Beam lines below the spark layer; head above the lines but below sparks.
    this.addChildAt(edge, 0);
    this.addChildAt(core, 1);
    this.addChildAt(head, 2);

    const beam: Beam = {
      from,
      ctrl,
      to,
      elapsed: 0,
      arrived: false,
      fading: false,
      fadeElapsed: 0,
      sparkAccum: 0,
      edge,
      core,
      head,
    };
    this.beams.push(beam);
    return new Promise((resolve) => (beam.onArrive = resolve));
  }

  update(dtMs: number): void {
    this.updateBeams(dtMs);
    this.updateSparks(dtMs);
  }

  /** Drop every beam and spark (called when leaving Free Spins). */
  clear(): void {
    for (const b of this.beams) {
      b.edge.destroy();
      b.core.destroy();
      b.head.destroy();
      b.onArrive?.();
    }
    this.beams = [];
    for (const s of this.sparks) s.node.destroy();
    this.sparks = [];
  }

  private updateBeams(dtMs: number): void {
    if (this.beams.length === 0) return;
    this.beams = this.beams.filter((b) => {
      if (b.fading) return this.fadeBeam(b, dtMs);

      b.elapsed += dtMs;
      const t = Math.min(1, b.elapsed / W.beamTravelMs);
      this.drawBeam(b, t);

      const headPt = quad(b.from, b.ctrl, b.to, t);
      b.head.position.set(headPt.x, headPt.y);

      // Throw sparks off the travelling head at a steady cadence.
      b.sparkAccum += dtMs;
      while (b.sparkAccum >= W.sparkEveryMs) {
        b.sparkAccum -= W.sparkEveryMs;
        this.spawnSpark(headPt);
      }

      if (t >= 1 && !b.arrived) {
        b.arrived = true;
        b.fading = true;
        const done = b.onArrive;
        b.onArrive = undefined;
        for (let i = 0; i < 10; i++) this.spawnSpark(b.to); // impact burst
        done?.();
      }
      return true;
    });
  }

  private fadeBeam(b: Beam, dtMs: number): boolean {
    b.fadeElapsed += dtMs;
    const ft = Math.min(1, b.fadeElapsed / W.beamFadeMs);
    const a = 1 - ft;
    b.edge.alpha = a;
    b.core.alpha = a;
    b.head.alpha = a;
    if (ft >= 1) {
      b.edge.destroy();
      b.core.destroy();
      b.head.destroy();
      return false;
    }
    return true;
  }

  /** Redraw the spline from the source up to the head's parameter `t`. */
  private drawBeam(b: Beam, t: number): void {
    const steps = Math.max(1, Math.floor(SEGMENTS * t));
    const pts: Pt[] = [];
    for (let i = 0; i <= steps; i++)
      pts.push(quad(b.from, b.ctrl, b.to, i / SEGMENTS));
    pts.push(quad(b.from, b.ctrl, b.to, t)); // exact head position

    b.edge.clear();
    b.core.clear();
    b.edge.moveTo(pts[0].x, pts[0].y);
    b.core.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      b.edge.lineTo(pts[i].x, pts[i].y);
      b.core.lineTo(pts[i].x, pts[i].y);
    }
    b.edge.stroke({
      width: W.beamEdgeWidth,
      color: W.beamEdgeColor,
      alpha: 0.55,
      cap: "round",
      join: "round",
    });
    b.core.stroke({
      width: W.beamCoreWidth,
      color: W.beamCoreColor,
      alpha: 0.95,
      cap: "round",
      join: "round",
    });
  }

  private spawnSpark(at: Pt): void {
    const node = new Graphics()
      .circle(0, 0, 2 + Math.random() * 2)
      .fill({ color: W.sparkColor });
    node.position.set(at.x, at.y);
    node.blendMode = "add";
    this.sparkLayer.addChild(node);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.03 + Math.random() * 0.08; // px/ms
    this.sparks.push({
      node,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.02, // a slight upward drift
      elapsed: 0,
      life: 240 + Math.random() * 220,
    });
  }

  private updateSparks(dtMs: number): void {
    if (this.sparks.length === 0) return;
    this.sparks = this.sparks.filter((s) => {
      s.elapsed += dtMs;
      const t = s.elapsed / s.life;
      if (t >= 1) {
        s.node.destroy();
        return false;
      }
      s.node.x += s.vx * dtMs;
      s.node.y += s.vy * dtMs;
      s.vy += 0.0004 * dtMs; // gravity
      s.node.alpha = 1 - t;
      s.node.scale.set(1 - 0.5 * t);
      return true;
    });
  }
}
