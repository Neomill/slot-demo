import { Container, Text } from 'pixi.js';
import { CONTROL } from '../../assets/manifest';
import { IconButton } from './IconButton';
import { labelStyle, valueStyle } from './styles';
import { BUTTON, TEXT_DY } from './layout';
import { fitWidth } from './text';

/**
 * The BET readout with its − / + steppers. The steppers are anchored to the
 * edges of a fixed value slot, so they sit a constant distance from the centre
 * and never move as the value's width changes — the value is fit into the slot
 * instead. Everything is centred on the component origin.
 */
export class BetControl extends Container {
  private readonly value: Text;
  private readonly minus: IconButton;
  private readonly plus: IconButton;
  private readonly slotWidth: number;

  constructor(slotWidth: number, stepGap: number, onStep: (direction: 1 | -1) => void) {
    super();
    this.slotWidth = slotWidth;

    const label = new Text({ text: 'BET', style: labelStyle() });
    label.anchor.set(0.5);
    label.y = TEXT_DY.label;

    this.value = new Text({ text: '0.00', style: valueStyle() });
    this.value.anchor.set(0.5);
    this.value.y = TEXT_DY.value;

    // Stepper centre = half the slot + the gap + the stepper's own radius.
    const stepX = slotWidth / 2 + stepGap + BUTTON.step / 2;
    this.minus = new IconButton({
      texture: CONTROL.subtract,
      diameter: BUTTON.step,
      onPress: () => onStep(-1),
    });
    this.plus = new IconButton({
      texture: CONTROL.add,
      diameter: BUTTON.step,
      onPress: () => onStep(1),
    });
    this.minus.position.set(-stepX, TEXT_DY.value);
    this.plus.position.set(stepX, TEXT_DY.value);

    this.addChild(label, this.value, this.minus, this.plus);
  }

  setValue(text: string): void {
    this.value.text = text;
    fitWidth(this.value, this.slotWidth);
  }

  setEnabled(enabled: boolean): void {
    this.minus.setEnabled(enabled);
    this.plus.setEnabled(enabled);
  }
}
