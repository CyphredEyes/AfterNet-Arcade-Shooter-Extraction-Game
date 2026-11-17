import { state } from '../core/state.js';

/* Tiers: 0 (0-24), 1 (25-49), 2 (50-74), 3 (75+) */
export function getReputationTier(contactId) {
  const rep = state.contacts?.[contactId]?.reputation ?? 0;
  if (rep >= 75) return 3;
  if (rep >= 50) return 2;
  if (rep >= 25) return 1;
  return 0;
}

export function adjustReputation(contactId, delta) {
  if (!state.contacts?.[contactId]) return;
  const cur = state.contacts[contactId].reputation || 0;
  state.contacts[contactId].reputation = Math.max(0, Math.min(100, cur + delta));
  window.dispatchEvent(new CustomEvent('contacts:changed'));
}

export function getReputation(contactId) {
  return state.contacts?.[contactId]?.reputation ?? 0;
}