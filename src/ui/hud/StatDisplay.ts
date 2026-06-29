import { Container, Text } from 'pixi.js';
import { labelStyle, valueStyle } from './styles';
import { TEXT_DY } from './layout';
import { fitWidth } from './text';

/**
 * A labelled numeric readout (caption above a value), used for BALANCE and WIN.
 * Both texts are centred on the component origin, so callers position it by its
 * centre. The value is fit to a fixed slot width so it never spills sideways.
 */
export class StatDisplay extends Container {
  private readonly value: Text;
  private readonly captionText: Text;
  private readonly slotWidth: number;

  constructor(caption: string, slotWidth: number, valueColor?: number) {
    super();
    this.slotWidth = slotWidth;

    const label = new Text({ text: caption, style: labelStyle() });
    label.anchor.set(0.5);
    label.y = TEXT_DY.label;
    this.captionText = label;

    this.value = new Text({ text: '0.00', style: valueStyle(valueColor) });
    this.value.anchor.set(0.5);
    this.value.y = TEXT_DY.value;

    this.addChild(label, this.value);
  }

  setValue(text: string): void {
    this.value.text = text;
    fitWidth(this.value, this.slotWidth);
  }

  /** Change the caption above the value (e.g. WIN -> TOTAL WIN in a bonus). */
  setCaption(text: string): void {
    this.captionText.text = text;
    fitWidth(this.captionText, this.slotWidth);
  }
}
