// ── Cooking ──
const RECIPES = [
  {
    id: 1, name: 'Spaghetti Bolognese', emoji: '🍝', time: '40 min', serves: 4,
    ingredients: ['pasta','minced beef','tomato','onion','garlic','olive oil','red wine','basil'],
    steps: ['Cook pasta per packet.','Brown mince with onion and garlic.','Add tomato, wine, simmer 20 min.','Season, toss with pasta, serve.'],
  },
  {
    id: 2, name: 'Scrambled Eggs', emoji: '🍳', time: '10 min', serves: 2,
    ingredients: ['eggs','butter','milk','salt','pepper'],
    steps: ['Whisk eggs with milk and seasoning.','Melt butter on low heat.','Add eggs, stir gently until just set.','Serve immediately.'],
  },
  {
    id: 3, name: 'Chicken Stir-Fry', emoji: '🥢', time: '25 min', serves: 3,
    ingredients: ['chicken breast','soy sauce','garlic','ginger','capsicum','broccoli','sesame oil','rice'],
    steps: ['Cook rice.','Slice chicken, marinate in soy and ginger.','Stir-fry chicken until golden.','Add veggies, toss, serve over rice.'],
  },
  {
    id: 4, name: 'Avocado Toast', emoji: '🥑', time: '8 min', serves: 1,
    ingredients: ['bread','avocado','lemon','salt','chilli flakes','eggs'],
    steps: ['Toast bread.','Mash avocado with lemon and salt.','Spread on toast, top with chilli.','Add a fried egg if desired.'],
  },
  {
    id: 5, name: 'Tomato Soup', emoji: '🍅', time: '30 min', serves: 4,
    ingredients: ['tomato','onion','garlic','vegetable stock','cream','basil','olive oil'],
    steps: ['Sauté onion and garlic.','Add tomatoes and stock, simmer 20 min.','Blend until smooth.','Stir in cream and basil, serve.'],
  },
  {
    id: 6, name: 'Banana Smoothie', emoji: '🍌', time: '5 min', serves: 1,
    ingredients: ['banana','milk','honey','vanilla','yoghurt'],
    steps: ['Add all ingredients to blender.','Blend until smooth.','Pour and serve immediately.'],
  },
  {
    id: 7, name: 'Garlic Bread', emoji: '🥖', time: '15 min', serves: 4,
    ingredients: ['bread','butter','garlic','parsley'],
    steps: ['Mix butter with minced garlic and parsley.','Spread on sliced bread.','Bake at 180°C for 10 minutes until golden.'],
  },
  {
    id: 8, name: 'Caesar Salad', emoji: '🥗', time: '15 min', serves: 2,
    ingredients: ['lettuce','parmesan','croutons','caesar dressing','lemon','garlic'],
    steps: ['Tear lettuce into bowl.','Add croutons and parmesan.','Toss with dressing and lemon juice.','Serve immediately.'],
  },
];

function findMatchingRecipes(pantry) {
  if (!pantry.length) return RECIPES;
  const norm = pantry.map(i => i.toLowerCase().trim());
  return RECIPES
    .map(r => {
      const matched = r.ingredients.filter(ing => norm.some(p => ing.includes(p) || p.includes(ing)));
      return { ...r, matchCount: matched.length, matchPct: Math.round(matched.length / r.ingredients.length * 100) };
    })
    .filter(r => r.matchCount > 0)
    .sort((a,b) => b.matchPct - a.matchPct);
}

function renderCooking() {
  const el = document.getElementById('section-cooking');
  el.innerHTML = `
    <div class="page-header">
      <h1>Cooking</h1>
      <p>Tell me what's in your fridge and I'll suggest what to cook.</p>
    </div>

    <div class="cooking-layout">
      <div class="pantry-section">
        <div class="card">
          <div class="section-title">Your Pantry</div>
          <p class="text-muted text-sm">Add ingredients you have available.</p>
          <div class="pantry-input-row">
            <input type="text" id="pantry-input" placeholder="e.g. eggs" />
            <button class="btn btn-primary" id="add-pantry-btn">Add</button>
          </div>
          <div class="pantry-tags" id="pantry-tags"></div>
          <button class="btn btn-ghost w-full mt-12" id="find-recipes-btn">Find Recipes →</button>
        </div>
      </div>

      <div>
        <div class="section-title" style="margin-bottom:14px" id="recipes-label">
          ${(window.state.pantry||[]).length ? 'Matching Recipes' : 'All Recipes'}
        </div>
        <div class="recipe-grid" id="recipe-grid"></div>
      </div>
    </div>
  `;

  renderPantryTags();
  renderRecipeGrid(findMatchingRecipes(window.state.pantry || []));
  bindCookingEvents();
}

function bindCookingEvents() {
  document.getElementById('add-pantry-btn').addEventListener('click', addPantryItem);
  document.getElementById('pantry-input').addEventListener('keydown', e => { if (e.key === 'Enter') addPantryItem(); });
  document.getElementById('find-recipes-btn').addEventListener('click', () => {
    const matches = findMatchingRecipes(window.state.pantry || []);
    renderRecipeGrid(matches);
    const lbl = document.getElementById('recipes-label');
    if (lbl) lbl.textContent = matches.length + ' matching recipe' + (matches.length !== 1 ? 's' : '');
  });
}

function addPantryItem() {
  const input = document.getElementById('pantry-input');
  const val   = input.value.trim().toLowerCase();
  if (!val) return;
  if (!window.state.pantry) window.state.pantry = [];
  if (!window.state.pantry.includes(val)) {
    window.state.pantry.push(val);
    saveState();
  }
  input.value = '';
  renderPantryTags();
}

function removePantryItem(item) {
  window.state.pantry = (window.state.pantry || []).filter(i => i !== item);
  saveState();
  renderPantryTags();
}

function renderPantryTags() {
  const el = document.getElementById('pantry-tags');
  if (!el) return;
  const items = window.state.pantry || [];
  el.innerHTML = items.map(i => `
    <span class="pantry-tag">
      ${i}
      <button onclick="removePantryItem('${i}')" title="Remove">✕</button>
    </span>`).join('') || `<span class="text-muted text-sm">Nothing added yet.</span>`;
}

function renderRecipeGrid(recipes) {
  const el = document.getElementById('recipe-grid');
  if (!el) return;

  if (!recipes.length) {
    el.innerHTML = `<div class="no-recipes">No matches found — try adding more ingredients!</div>`;
    return;
  }

  el.innerHTML = recipes.map(r => `
    <div class="recipe-card" data-id="${r.id}">
      <div class="recipe-img">${r.emoji}</div>
      <div class="recipe-body">
        <div class="recipe-name">${r.name}</div>
        <div class="recipe-meta">${r.time} · serves ${r.serves}</div>
        ${r.matchPct !== undefined ? `
          <div class="recipe-match">
            <span class="badge badge-green">${r.matchPct}% match</span>
          </div>` : ''}
      </div>
    </div>`).join('');

  el.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', () => {
      const recipe = RECIPES.find(r => r.id === +card.dataset.id);
      if (recipe) openRecipeModal(recipe);
    });
  });
}

function openRecipeModal(recipe) {
  const overlay = document.createElement('div');
  overlay.className = 'recipe-modal-overlay';
  overlay.style.position = 'fixed';
  overlay.innerHTML = `
    <div class="recipe-modal">
      <div class="recipe-modal-img" style="position:relative">
        <span>${recipe.emoji}</span>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <div class="recipe-modal-body">
        <h2>${recipe.name}</h2>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <span class="badge badge-orange">${recipe.time}</span>
          <span class="badge badge-blue">Serves ${recipe.serves}</span>
        </div>
        <div class="recipe-ingredients">
          <h4>Ingredients</h4>
          <ul>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
        </div>
        <div class="recipe-steps">
          <h4>Method</h4>
          <ol>${recipe.steps.map(s => `<li>${s}</li>`).join('')}</ol>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('modal-close').addEventListener('click', () => overlay.remove());
}
