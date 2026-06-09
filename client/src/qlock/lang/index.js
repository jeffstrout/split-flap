// QLOCKTWO language registry.
import { en } from './en.js';
import { ar } from './ar.js';

export const LANGUAGES = { en, ar };
export const LANGUAGE_IDS = Object.keys(LANGUAGES);

export function getLanguage(id) {
  return LANGUAGES[id] || en;
}
