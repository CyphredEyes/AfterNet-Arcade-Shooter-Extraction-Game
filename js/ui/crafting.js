/* ===================================================================
   Crafting UI
   =================================================================== */

import { state } from '../core/state.js';
import { BLUEPRINTS } from '../data/itemDB.js';
import { RECIPES, CRAFT_CATEGORIES } from '../data/recipesDB.js';
import { getMaxCraftable, craftRecipe, countInStash } from '../systems/craftingSystem.js';
import { showToast } from './toast.js';

const STAT_LABELS = {
  attack: 'Attack', defense: 'Defense', speed: 'Speed',
  firerate: 'Fire Rate', shieldDelay: 'Shield Delay',
  gunOverloadDelay: 'Gun Overload Delay',
};
const STAT_BETTER_DIRECTION = {
  attack: 'higher', defense: 'higher', speed: 'higher',
  firerate: 'higher', shieldDelay: 'lower', gunOverloadDelay: 'lower',
};

let activeCategory = 'components';   // default

/* -------------------------------------------------------------------
   Entry
   ------------------------------------------------------------------- */
export function renderCrafting() {
  renderCategorySidebar();
  renderRecipeList();
}

/* -------------------------------------------------------------------
   Sidebar
   ------------------------------------------------------------------- */
function renderCategorySidebar() {
  const host = document.getElementById('craftCategoryBody');
  if (!host) return;
  host.innerHTML = '';

  for (const cat of CRAFT_CATEGORIES) {
    const recipes = Object.values(RECIPES).filter(r => r.category === cat.key);
    const readyCount = recipes.filter(r => getMaxCraftable(r.key) > 0).length;

    const el = document.createElement('div');
    el.className = 'craft-category-item' + (cat.key === activeCategory ? ' active' : '');

    el.innerHTML = `
      <div class="craft-category-icon">${cat.icon}</div>
      <div class="craft-category-info">
        <div class="craft-category-name">${cat.label}</div>
        <div class="craft-category-sub">${recipes.length} recipe${recipes.length === 1 ? '' : 's'}</div>
      </div>
      ${readyCount > 0 ? `<div class="craft-category-ready" title="${readyCount} ready to craft"></div>` : ''}
    `;

    el.addEventListener('click', () => {
      activeCategory = cat.key;
      renderCrafting();
    });

    host.appendChild(el);
  }
}

/* -------------------------------------------------------------------
   Recipe list
   ------------------------------------------------------------------- */
function renderRecipeList() {
  const titleEl = document.getElementById('craftCategoryTitle');
  const countEl = document.getElementById('craftRecipeCount');
  const host    = document.getElementById('craftRecipeList');
  if (!host) return;

  const cat = CRAFT_CATEGORIES.find(c => c.key === activeCategory);
  const recipes = Object.values(RECIPES).filter(r => r.category === activeCategory);

  if (titleEl) titleEl.textContent = cat ? cat.label : 'SELECT A CATEGORY';
  if (countEl) countEl.textContent = cat
    ? `${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`
    : '';

  host.innerHTML = '';

  if (recipes.length === 0) {
    host.innerHTML = '<div class="craft-empty">No recipes in this category.</div>';
    return;
  }

  /* ---- Group by recipe.group ---- */
  const groups = new Map();
  for (const r of recipes) {
    const g = r.group || 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }

  for (const list of groups.values()) {
    list.sort((a, b) => (a.tier || 0) - (b.tier || 0));
  }

  /* ---- Render each group as a section ---- */
  for (const [groupName, list] of groups) {
    const section = document.createElement('div');
    section.className = 'craft-group-section';

    const header = document.createElement('div');
    header.className = 'craft-group-header';
    header.textContent = groupName;
    section.appendChild(header);

    const listWrap = document.createElement('div');
    listWrap.className = 'craft-group-list';
    for (const recipe of list) {
      listWrap.appendChild(buildRecipeCard(recipe));
    }
    section.appendChild(listWrap);

    host.appendChild(section);
  }
}

/* -------------------------------------------------------------------
   Recipe card
   ------------------------------------------------------------------- */
function buildRecipeCard(recipe) {
  const bp = BLUEPRINTS[recipe.key];
  const maxCraftable = getMaxCraftable(recipe.key);
  const canCraft = maxCraftable > 0;

  const card = document.createElement('div');
  card.className = 'craft-recipe-card' + (canCraft ? '' : ' insufficient');

  /* ---- Image ---- */
  const imgWrap = document.createElement('div');
  imgWrap.className = 'craft-recipe-img';
  const imgSrc = (bp?.img !== undefined)
    ? bp.img
    : `/img/items/${recipe.key}.png`;
  const img = document.createElement('img');
  img.src = imgSrc;
  img.alt = bp?.name || recipe.key;
  img.onerror = () => { img.remove(); };
  imgWrap.appendChild(img);
  card.appendChild(imgWrap);

  /* ---- Info (name + desc + stats) ---- */
  const info = document.createElement('div');
  info.className = 'craft-recipe-info';

  const name = document.createElement('div');
  name.className = 'craft-recipe-name';
  name.textContent = bp?.name || recipe.key;
  info.appendChild(name);

  const desc = document.createElement('div');
  desc.className = 'craft-recipe-desc';
  desc.textContent = bp?.description || '';
  info.appendChild(desc);

  const statPills = buildStatPills(bp);
  if (statPills.length > 0) {
    const statRow = document.createElement('div');
    statRow.className = 'craft-recipe-stats';
    for (const pill of statPills) {
      const el = document.createElement('span');
      el.className = `craft-stat-pill ${pill.kind}`;
      el.textContent = pill.text;
      statRow.appendChild(el);
    }
    info.appendChild(statRow);
  }

  card.appendChild(info);

  /* ---- Actions ---- */
  const actions = document.createElement('div');
  actions.className = 'craft-recipe-actions';

  const craftOneBtn = document.createElement('button');
  craftOneBtn.className = 'craft-btn';
  craftOneBtn.textContent = 'CRAFT 1';
  craftOneBtn.disabled = !canCraft;
  craftOneBtn.addEventListener('click', () => doCraft(recipe.key, 1));
  actions.appendChild(craftOneBtn);

  if (maxCraftable > 1) {
    const craftMaxBtn = document.createElement('button');
    craftMaxBtn.className = 'craft-btn max';
    craftMaxBtn.textContent = `CRAFT ×${maxCraftable}`;
    craftMaxBtn.addEventListener('click', () => doCraft(recipe.key, maxCraftable));
    actions.appendChild(craftMaxBtn);
  }

  card.appendChild(actions);

  /* ---- Ingredients (full width) ---- */
  const ingWrap = document.createElement('div');
  ingWrap.className = 'craft-recipe-ingredients';

  for (const ing of recipe.ingredients) {
    const ingBp = BLUEPRINTS[ing.key];
    const have = countInStash(ing.key);
    const ok = have >= ing.count;

    const pill = document.createElement('div');
    pill.className = `craft-ingredient ${ok ? 'ok' : 'missing'}`;

    const ingImgSrc = (ingBp?.img !== undefined)
      ? ingBp.img
      : `/img/items/${ing.key}.png`;
    const img = document.createElement('img');
    img.className = 'craft-ing-img';
    img.src = ingImgSrc;
    img.onerror = () => { img.style.visibility = 'hidden'; };
    pill.appendChild(img);

    const label = document.createElement('span');
    label.className = 'craft-ingredient-label';
    label.textContent = `${ing.count}× ${ingBp?.name || ing.key}`;
    pill.appendChild(label);

    const haveEl = document.createElement('span');
    haveEl.className = 'craft-ingredient-have';
    haveEl.textContent = `${have}/${ing.count}`;
    pill.appendChild(haveEl);

    ingWrap.appendChild(pill);
  }
  card.appendChild(ingWrap);

  return card;
}

/* -------------------------------------------------------------------
   Stat pills
   ------------------------------------------------------------------- */
function buildStatPills(bp) {
  const pills = [];
  if (!bp) return pills;

  if (bp.stats?.multipliers) {
    for (const [key, value] of Object.entries(bp.stats.multipliers)) {
      if (value === 1) continue;
      const label = STAT_LABELS[key] || key;
      const dir   = STAT_BETTER_DIRECTION[key] || 'higher';
      const pct   = Math.round((value - 1) * 100);
      const improved = dir === 'higher' ? value > 1 : value < 1;
      const sign = pct > 0 ? '+' : '';
      pills.push({
        text: `${label} ${sign}${pct}%`,
        kind: improved ? 'positive' : 'negative',
      });
    }
  }

  if (bp.internalCols && bp.internalRows) {
    pills.push({
      text: `${bp.internalCols}×${bp.internalRows} grid`,
      kind: 'info',
    });
  }

  if (bp.internalHardware) {
    const slots = Object.values(bp.internalHardware);
    const cells = slots.reduce((s, slot) => s + slot.cols * slot.rows, 0);
    pills.push({ text: `${slots.length} slots`, kind: 'info' });
    pills.push({ text: `${cells} cells`,       kind: 'info' });
  }

  return pills;
}

/* -------------------------------------------------------------------
   Craft execution
   ------------------------------------------------------------------- */
function doCraft(recipeKey, qty) {
  const result = craftRecipe(recipeKey, qty);
  if (!result.ok) {
    showToast(result.reason || 'Craft failed.', { type: 'warning' });
    return;
  }

  const bp = BLUEPRINTS[RECIPES[recipeKey].key];
  showToast(
    `Crafted ${result.produced}× ${bp?.name || recipeKey}` +
      (result.crafted > 1 ? ` (${result.crafted} cycles)` : ''),
    { type: 'success', icon: '✓' },
  );

  renderCrafting();
}

/* -------------------------------------------------------------------
   Auto-refresh on stash changes while the panel is visible
   ------------------------------------------------------------------- */
window.addEventListener('storage:changed', () => {
  const panel = document.getElementById('craftingPanel');
  if (panel && panel.classList.contains('active')) {
    renderCrafting();
  }
});