'use strict';
const toggle = document.getElementById('greeting');
const status = document.getElementById('save-state');
const greeting = document.getElementById('greeting-text');
let lastSaved = true;
const enhance = document.getElementById('enhance-page');
const inspect = document.getElementById('inspect-page');
const pageStatus = document.getElementById('page-status');
async function applyPage(enabled) {
  await window.bridge.page.cleanup();
  if (enabled) {
    await window.bridge.page.addStyle({ id: 'widget', file: 'page-widget.css' });
    await window.bridge.page.runScript('page-widget.js', { enabled: true });
  }
}
function render(value) { toggle.checked = value; greeting.hidden = !value; }
async function initialize() {
  try {
    const info = await window.bridge.info();
    const saved = await window.bridge.storage.get('showGreeting');
    lastSaved = typeof saved === 'boolean' ? saved : true;
    render(lastSaved);
    document.getElementById('host-state').textContent = `${info.adapter.toUpperCase()} ADAPTER · Electron ${info.electron} · Isolated renderer`;
    status.textContent = saved === null ? 'Ready · stored on this device when changed' : 'Restored from this device';
    toggle.disabled = false;
    enhance.checked = (await window.bridge.storage.get('enhancePage')) === true;
    enhance.disabled = false; inspect.disabled = false;
    pageStatus.textContent = enhance.checked ? 'Widget enabled · restored on page loads' : 'Ready · changes affect the app page';
  } catch (error) { status.textContent = `Could not load settings: ${error.message}`; }
}
toggle.addEventListener('change', async () => {
  toggle.disabled = true;
  const next = toggle.checked;
  status.textContent = 'Saving…';
  try {
    await window.bridge.storage.set('showGreeting', next);
    lastSaved = next; render(next); status.textContent = 'Saved on this device';
  } catch { render(lastSaved); status.textContent = 'Could not save. Your last setting was kept.'; }
  finally { toggle.disabled = false; }
});
initialize();
enhance.addEventListener('change', async () => {
  enhance.disabled = true;
  const next = enhance.checked;
  try {
    await window.bridge.storage.set('enhancePage', next);
    await applyPage(next);
    pageStatus.textContent = next ? 'Widget added to app HTML · setting saved' : 'Widget and styles removed · setting saved';
  } catch (error) {
    enhance.checked = !next;
    await window.bridge.storage.set('enhancePage', !next).catch(() => {});
    pageStatus.textContent = `Could not apply: ${error.message}`;
  } finally { enhance.disabled = false; }
});
inspect.addEventListener('click', async () => {
  inspect.disabled = true;
  try { const page = await window.bridge.page.info(); const headings = await window.bridge.page.query('h1'); pageStatus.textContent = `${page.title || 'App page'} · ${headings.length} main headings`; }
  catch (error) { pageStatus.textContent = `Page unavailable: ${error.message}`; }
  finally { inspect.disabled = false; }
});
