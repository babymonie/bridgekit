'use strict';

const filters = document.querySelector('.filters');
const search = document.querySelector('#search');
const app = document.querySelector('#app');
const results = document.querySelector('#results');
const cards = [...document.querySelectorAll('.plugin')];

function filterPlugins() {
  const terms = search.value.toLowerCase().trim().split(/\s+/);
  let visible = 0;

  for (const card of cards) {
    const matchesApp = !app.value || card.dataset.apps.split(' ').includes(app.value);
    const searchable = card.textContent.toLowerCase();
    card.hidden = !matchesApp || !terms.every(term => searchable.includes(term));
    if (!card.hidden) visible++;
  }

  results.textContent = visible === 0 ? 'No plugins match your filters.'
    : `${visible} ${visible === 1 ? 'plugin' : 'plugins'}`;
}

filters.hidden = false;
search.addEventListener('input', filterPlugins);
app.addEventListener('change', filterPlugins);
filterPlugins();
