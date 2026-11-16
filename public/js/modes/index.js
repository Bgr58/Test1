import * as ring from './ring.js';
import * as plinko from './plinko.js';
import * as football from './football.js';
import * as race from './race.js';

export const MODES = [ring, plinko, football, race];

export function getMode(id) {
  return MODES.find((m) => m.meta.id === id) || MODES[0];
}
