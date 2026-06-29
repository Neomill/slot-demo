import { Assets, Sprite, type Texture } from 'pixi.js';
import type { SymbolId } from '../config/symbols';
import { SYMBOL_TEXTURES } from '../assets/manifest';
import { CELL, CELL_PADDING } from './theme';

/**
 * The art seam: one symbol id -> a Sprite, centered in its cell and scaled to
 * fit (aspect-preserving) within the cell minus padding. Assets must already be
 * preloaded (see SlotScene). To change the look, only this function changes.
 */
export function makeSymbolSprite(id: SymbolId): Sprite {
  const texture = Assets.get<Texture>(SYMBOL_TEXTURES[id]);
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5); // centered -> position at the cell's center

  const maxWidth = CELL.width - CELL_PADDING * 2;
  const maxHeight = CELL.height - CELL_PADDING * 2;
  const scale = Math.min(maxWidth / texture.width, maxHeight / texture.height);
  sprite.scale.set(scale);

  return sprite;
}
