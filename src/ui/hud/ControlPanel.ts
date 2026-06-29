import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import { CONTROL } from '../../assets/manifest';
import { BAR } from './layout';

/**
 * The control-bar background, drawn as a 3-slice: fixed left/right edge art with
 * a stretched centre between them. Decorative only — no interaction.
 */
export class ControlPanel extends Container {
  constructor(x: number, width: number) {
    super();
    const { top, height, edgeWidth } = BAR;

    const center = new Sprite(Assets.get<Texture>(CONTROL.center));
    center.position.set(x + edgeWidth, top);
    center.width = width - edgeWidth * 2;
    center.height = height;

    const left = new Sprite(Assets.get<Texture>(CONTROL.leftEdge));
    left.position.set(x, top);
    left.width = edgeWidth;
    left.height = height;

    const right = new Sprite(Assets.get<Texture>(CONTROL.rightEdge));
    right.position.set(x + width - edgeWidth, top);
    right.width = edgeWidth;
    right.height = height;

    // Centre first so the edge caps overlap it cleanly.
    this.addChild(center, left, right);
  }
}
