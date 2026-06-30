import type { SymbolId } from './symbols';

/** One reel-strip set per game mode / modifier. */
export type ReelSetId = 'base' | 'freeSpins' | 'holdAndRespin';

/**
 * A spin lands each reel on a random strip offset and reads `rows` consecutive
 * symbols (wrapping). Symbol frequency here is the only place odds live.
 *
 * - base:          royals + horses + sparse bonus (scatter) + sparse trophy, NO wild
 * - freeSpins:     royals + horses + wild, no bonus/trophy
 * - holdAndRespin: royal fillers + frequent trophy (respins land/lock trophies)
 */
export const REEL_SETS: Record<ReelSetId, SymbolId[][]> = {
  base: [
    ['goldhorse', 'ten', 'jack', 'bonus', 'queen', 'redhorse', 'king', 'ace', 'trophy', 'bluehorse', 'ten', 'jocky', 'cap', 'binoculars'],
    ['ace', 'jocky', 'queen', 'bonus', 'ten', 'shoehorse', 'king', 'redhorse', 'trophy', 'jack', 'goldhorse', 'cap', 'ten', 'bluehorse'],
    ['king', 'ten', 'redhorse', 'jack', 'bonus', 'queen', 'goldhorse', 'ace', 'shoehorse', 'trophy', 'jocky', 'ten', 'binoculars', 'cap'],
    ['queen', 'bluehorse', 'ace', 'ten', 'trophy', 'jack', 'king', 'redhorse', 'cap', 'jocky', 'ten', 'goldhorse', 'shoehorse', 'bonus'],
    ['jack', 'king', 'ten', 'goldhorse', 'ace', 'bonus', 'queen', 'bluehorse', 'trophy', 'jocky', 'cap', 'redhorse', 'binoculars', 'ace'],
  ],
  freeSpins: [
    // Reel 1 carries no Prize symbols (prizes appear on reels 2-5).
    ['jocky', 'wild', 'ten', 'jack', 'queen', 'shoehorse', 'king', 'wild', 'ace', 'cap', 'ten', 'jocky', 'cap', 'binoculars'],
    ['ace', 'jocky', 'wild', 'queen', 'ten', 'shoehorse', 'king', 'redhorse', 'jack', 'wild', 'goldhorse', 'cap', 'ten', 'bluehorse'],
    ['king', 'ten', 'redhorse', 'wild', 'jack', 'queen', 'goldhorse', 'ace', 'shoehorse', 'wild', 'jocky', 'ten', 'binoculars', 'cap'],
    ['queen', 'bluehorse', 'ace', 'ten', 'wild', 'jack', 'king', 'redhorse', 'cap', 'jocky', 'wild', 'goldhorse', 'shoehorse', 'queen'],
    ['jack', 'king', 'wild', 'ten', 'goldhorse', 'ace', 'queen', 'bluehorse', 'wild', 'jocky', 'cap', 'redhorse', 'binoculars', 'ace'],
  ],
  holdAndRespin: [
    ['trophy', 'ten', 'jack', 'trophy', 'queen', 'king', 'trophy', 'ace', 'ten', 'trophy', 'cap', 'jack', 'trophy', 'queen'],
    ['ten', 'trophy', 'queen', 'king', 'trophy', 'ace', 'jack', 'trophy', 'ten', 'cap', 'trophy', 'king', 'ace', 'trophy'],
    ['trophy', 'king', 'ten', 'trophy', 'jack', 'queen', 'trophy', 'ace', 'cap', 'trophy', 'ten', 'king', 'trophy', 'jack'],
    ['queen', 'trophy', 'ace', 'ten', 'trophy', 'jack', 'king', 'trophy', 'cap', 'ten', 'trophy', 'queen', 'ace', 'trophy'],
    ['jack', 'king', 'trophy', 'ten', 'trophy', 'ace', 'queen', 'trophy', 'ten', 'cap', 'trophy', 'king', 'trophy', 'ace'],
  ],
};
