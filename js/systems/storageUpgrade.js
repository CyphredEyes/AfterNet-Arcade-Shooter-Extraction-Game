import { state, STASH_BASE } from '../core/state.js';

export function getStashUpgradePrice(offset = 0) {
  const level = (state.stashUpgradeLevel || 0) + offset;
  return Math.round(STASH_BASE.upgradeBasePrice *
    Math.pow(STASH_BASE.upgradePriceMultiplier, level));
}

export function canAffordUpgrade() {
  return (state.credits || 0) >= getStashUpgradePrice();
}

export function executeStashUpgrade() {
  const price = getStashUpgradePrice();
  if ((state.credits || 0) < price) {
    return { ok: false, reason: 'Not enough credits.' };
  }

  state.credits -= price;
  state.stash.rows += STASH_BASE.rowsPerUpgrade;
  state.stashUpgradeLevel = (state.stashUpgradeLevel || 0) + 1;

  window.dispatchEvent(new CustomEvent('currency:delta', {
    detail: { type: 'credits', delta: -price },
  }));
  window.dispatchEvent(new CustomEvent('inventory:changed'));
  window.dispatchEvent(new CustomEvent('storage:changed'));

  return {
    ok: true,
    newRows: state.stash.rows,
    newPrice: getStashUpgradePrice(),
  };
}