import { Assets, Container, Sprite, Text, type Texture } from "pixi.js";
import { spinTitleStyle } from "./styles";

/**
 * The primary action button: the spin-button art with "SPIN"
 * lettering overlaid. Hover / press feedback and an enabled state; reports taps
 * via callback.
 */
export class SpinButton extends Container {
  private enabled = true;

  constructor(
    texture: string,
    width: number,
    height: number,
    onPress: () => void,
  ) {
    super();

    const sprite = new Sprite(Assets.get<Texture>(texture));
    sprite.anchor.set(0.5);
    sprite.width = width;
    sprite.height = height;

    const title = new Text({ text: "SPIN", style: spinTitleStyle() });
    title.anchor.set(0.5);

    this.addChild(sprite, title);

    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointerover", () => this.enabled && this.scale.set(1.05));
    this.on("pointerout", () => this.scale.set(1));
    this.on("pointerdown", () => this.enabled && this.scale.set(0.95));
    this.on("pointerup", () => this.enabled && this.scale.set(1.05));
    this.on("pointerupoutside", () => this.scale.set(1));
    this.on("pointertap", () => this.enabled && onPress());
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.alpha = enabled ? 1 : 0.5;
    this.eventMode = enabled ? "static" : "none";
    if (!enabled) this.scale.set(1);
  }
}
