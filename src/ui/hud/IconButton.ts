import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { hudColors as C } from '../theme';

export interface IconButtonOptions {
  /** Texture URL (from the CONTROL manifest). */
  texture: string;
  /** Rendered width/height of the (square) button. */
  diameter: number;
  onPress: () => void;
}

/**
 * A circular sprite button — menu, turbo, and the bet steppers. Owns its own
 * hover / press feedback and enabled / active state; reports clicks via callback
 * and knows nothing about the game.
 */
export class IconButton extends Container {
  private enabled = true;
  private readonly glow: Graphics;

  constructor({ texture, diameter, onPress }: IconButtonOptions) {
    super();

    this.glow = new Graphics()
      .circle(0, 0, diameter / 2 + 4)
      .stroke({ width: 3, color: C.goldBright });
    this.glow.visible = false;

    const sprite = new Sprite(Assets.get<Texture>(texture));
    sprite.anchor.set(0.5);
    sprite.width = diameter;
    sprite.height = diameter;

    this.addChild(this.glow, sprite);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerover', () => this.enabled && this.scale.set(1.08));
    this.on('pointerout', () => this.scale.set(1));
    this.on('pointerdown', () => this.enabled && this.scale.set(0.92));
    this.on('pointerup', () => this.enabled && this.scale.set(1.08));
    this.on('pointerupoutside', () => this.scale.set(1));
    this.on('pointertap', () => this.enabled && onPress());
  }

  /** Dim and disable input (e.g. while a spin is resolving). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.alpha = enabled ? 1 : 0.4;
    this.eventMode = enabled ? 'static' : 'none';
    if (!enabled) this.scale.set(1);
  }

  /** Toggle the gold ring (used to show turbo / chance-x2 is on). */
  setActive(active: boolean): void {
    this.glow.visible = active;
  }
}
