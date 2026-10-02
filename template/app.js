/**
 * Template app logic: navigation between views, and the views themselves.
 *
 * Deliberately framework-free so it drops into the no-build apps (IDEF0,
 * SysML, Project, Metropolis) as-is. A React app keeps the same markup and
 * class names inside its components; see ../README.md.
 */

import {
  APPEARANCES,
  APPEARANCE_LABELS,
  RACES,
  RACE_LABELS,
  SKINS,
  SKIN_LABELS,
  setAppearance,
  setRace,
  setSkin,
} from '../js/theme.js';
import { ScToast } from '../js/toast.js';
import { ScDialog } from '../js/dialog.js';

const NAV = [
  { id: 'overview', label: 'Overview', glyph: '◈', tint: 'var(--sc-accent)', count: null },
  { id: 'components', label: 'Components', glyph: '▣', tint: 'var(--sc-app)', count: 23 },
  { id: 'settings', label: 'Settings', glyph: '⚙', tint: 'var(--sc-accent-2)', count: null },
];

const WORKSPACE = ['Market entry recommendation', 'Q3 supplier review', 'Process gap analysis', 'Hiring plan 2027'];

const history = [];
const future = [];
let current = 'overview';

const $ = (sel) => document.querySelector(sel);

function renderNav() {
  $('#nav').innerHTML = NAV.map(
    (n) => `
      <button class="sc-nav-item ${n.id === current ? 'is-active' : ''}" data-view="${n.id}">
        <span class="sc-nav-icon" style="--tint:${n.tint}">${n.glyph}</span>
        <span class="sc-nav-label">${n.label}</span>
        ${n.count ? `<span class="sc-badge">${n.count}</span>` : ''}
      </button>`,
  ).join('');

  $('#workspace-list').innerHTML = WORKSPACE.map(
    (w, i) => `<div class="sc-list-item ${i === 0 ? 'is-active' : ''}"><span class="sc-faint">▸</span>${w}</div>`,
  ).join('');
}

function go(view, record = true) {
  if (view === current) return;
  if (record) {
    history.push(current);
    future.length = 0;
  }
  current = view;
  render();
}

function render() {
  renderNav();
  $('#view-title').textContent = NAV.find((n) => n.id === current)?.label ?? '';
  $('#view').innerHTML = VIEWS[current]();
  $('#view').scrollTop = 0;
  mountPortalDemos();
  mountConnectionsDemos();
}

// ---------------------------------------------------------------------------
// Portal bar demo. The bar at the top of the shell fetches ./portal-me.json
// for real; the three in the gallery get a stub fetch so every state shows
// without a Portal: 200 with the roster, 401, and a network failure.

const ROSTER = fetch('./portal-me.json').then((r) => r.json());

const CONNECTIONS = {
  providers: [
    { id: 'google', name: 'Google', configured: true, features: ['calendar', 'drive', 'sheets'],
      accounts: [{ id: 'you@gmail.com', label: 'you@gmail.com', connectedAt: Date.now() - 86400000 * 12, features: ['calendar'] }] },
    { id: 'strava', name: 'Strava', configured: true, features: ['activities'],
      accounts: [{ id: '1234', label: 'Allen Xu', connectedAt: Date.now() - 3600000, features: ['activities'] }] },
  ],
};

function mountConnectionsDemos() {
  document.querySelectorAll('[data-connections-demo]').forEach((slot) => {
    const kind = slot.dataset.connectionsDemo;
    const el = document.createElement('sc-connections');
    el.setAttribute('features', 'calendar,drive');
    el.request = async () => (kind === 'signed-out'
      ? new Response('{"error":"unauthorized"}', { status: 401 })
      : new Response(JSON.stringify(CONNECTIONS), { status: 200, headers: { 'content-type': 'application/json' } }));
    el.open = (url) => { alert(`Would open ${url}`); return true; };
    slot.replaceChildren(el);
  });
}

function mountPortalDemos() {
  document.querySelectorAll('[data-portal-demo]').forEach(async (slot) => {
    const kind = slot.dataset.portalDemo;
    const roster = await ROSTER;
    const bar = document.createElement('sc-portal-bar');
    bar.setAttribute('app', 'pyramid');
    bar.fetch = async () => {
      if (kind === 'signed-out') return new Response('{"error":"unauthorized"}', { status: 401 });
      if (kind === 'offline') throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify(roster), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    slot.replaceChildren(bar);
  });
}

// The readouts key off navigator.onLine and the online/offline events; the
// gallery fakes both so the offline states can be seen on a connected machine.
function setOffline(off) {
  if (off) Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  else delete navigator.onLine;
  window.dispatchEvent(new Event(off ? 'offline' : 'online'));
}

// ---------------------------------------------------------------------------
// Sync status demo. In a real app sync-kit dispatches these events itself;
// the readouts (sidebar foot and gallery) only listen.

let sync = { phase: 'idle', lastSyncAt: Date.now() - 2 * 60_000, pulled: 3, pushed: 1, label: 'pyramid' };
let syncNowCount = 0;

const SYNC_DEMO = {
  idle: () => ({ phase: 'idle', lastSyncAt: Date.now() - 2 * 60_000, pulled: 3, pushed: 1, label: 'pyramid' }),
  syncing: () => ({ ...sync, phase: 'syncing' }),
  error: () => ({ ...sync, phase: 'error', lastError: { code: 'http', message: 'HTTP 503 from sync server' } }),
  unauthorized: () => ({ ...sync, phase: 'error', lastError: { code: 'unauthorized', message: 'Session expired' } }),
  never: () => ({ phase: 'idle' }),
  // The two label shapes real apps produce: none at all, and a long one.
  unlabelled: () => ({ phase: 'idle', lastSyncAt: Date.now() - 40_000, pulled: 12, pushed: 0 }),
  long: () => ({ ...sync, phase: 'idle', label: 'market-entry-workspace · sync-server.internal.example' }),
};

function publishSync(status) {
  sync = status;
  window.dispatchEvent(new CustomEvent('sync-kit:status', { detail: status }));
}

window.addEventListener('sync-kit:sync-now', () => {
  syncNowCount += 1;
  const log = $('#sync-log');
  if (log) log.textContent = `sync-kit:sync-now × ${syncNowCount}`;
  publishSync({ ...sync, phase: 'syncing' });
  setTimeout(() => publishSync({ phase: 'idle', lastSyncAt: Date.now(), pulled: 2, pushed: 1, label: sync.label }), 1200);
});

// ---------------------------------------------------------------------------
// Toasts and dialogs.

const TOASTS = {
  info: () => ScToast.show('Sync complete with 3 devices'),
  success: () => ScToast.show('Model exported', { tone: 'success' }),
  warning: () => ScToast.show('Decomposition has only two boxes', { tone: 'warning' }),
  danger: () => ScToast.show('Arrow enters a box on its output side', { tone: 'danger' }),
  action: () =>
    ScToast.show('Card archived', {
      action: { label: 'Undo', onSelect: () => ScToast.show('Card restored', { tone: 'success' }) },
    }),
};

function logDialog(id) {
  const log = $('#dialog-log');
  if (log) log.textContent = `resolved: ${id}`;
}

async function openNewDialog() {
  const input = $('#new-title');
  input.value = '';
  const id = await $('#new-dialog').open();
  logDialog(id);
  if (id === 'create') {
    const title = input.value.trim() || 'Untitled';
    WORKSPACE.unshift(title);
    render();
    ScToast.show(`Created “${title}”`, { tone: 'success' });
  }
}

async function confirmDelete() {
  const id = await ScDialog.open({
    heading: 'Delete pyramid?',
    body: `<p style="margin:0">“${WORKSPACE[0]}” will be removed from this workspace. This cannot be undone.</p>`,
    buttons: [
      { id: 'cancel', label: 'Cancel', kind: 'ghost' },
      { id: 'delete', label: 'Delete', kind: 'danger' },
    ],
  });
  logDialog(id);
  if (id === 'delete') {
    ScToast.show('Pyramid deleted', {
      tone: 'warning',
      action: { label: 'Undo', onSelect: () => ScToast.show('Pyramid restored', { tone: 'success' }) },
    });
  }
}

// ---------------------------------------------------------------------------
// Command palette: ⌘K, or the header button.

const palette = document.querySelector('sc-command-palette');
palette.commands = [
  { id: 'new', label: 'New pyramid', shortcut: '⌘N', group: 'Actions' },
  { id: 'sync', label: 'Sync now', group: 'Actions' },
  { id: 'toast', label: 'Show a toast', group: 'Actions' },
  ...NAV.map((n) => ({ id: `go:${n.id}`, label: `Go to ${n.label}`, shortcut: `g ${n.label[0].toLowerCase()}`, group: 'Navigate' })),
  { id: 'collapse', label: 'Toggle sidebar', shortcut: '⌘\\', group: 'View' },
  ...SKINS.map((s) => ({ id: `skin:${s}`, label: `Interface: ${SKIN_LABELS[s]}`, group: 'Appearance' })),
  ...RACES.map((r) => ({ id: `race:${r}`, label: `HUD palette: ${RACE_LABELS[r]}`, group: 'Appearance' })),
  ...APPEARANCES.map((m) => ({ id: `appearance:${m}`, label: `macOS appearance: ${APPEARANCE_LABELS[m]}`, group: 'Appearance' })),
];
palette.addEventListener('sc-command', (e) => {
  const { id } = e.detail;
  const log = $('#command-log');
  if (log) log.textContent = `sc-command: ${id}`;
  if (id === 'new') openNewDialog();
  else if (id === 'sync') window.dispatchEvent(new CustomEvent('sync-kit:sync-now'));
  else if (id === 'toast') ScToast.show('Hello from the palette');
  else if (id === 'collapse') $('#shell').classList.toggle('is-collapsed');
  else if (id.startsWith('go:')) go(id.slice(3));
  else if (id.startsWith('race:')) setRace(id.slice(5));
  else if (id.startsWith('skin:')) setSkin(id.slice(5));
  else if (id.startsWith('appearance:')) setAppearance(id.slice(11));
});

// ---------------------------------------------------------------------------

const VIEWS = {
  overview: () => `
    <div class="sc-alert sc-alert--warning" style="margin-bottom:20px">
      <strong>Transmission</strong> Two claims in “Market entry recommendation” have no supporting evidence.
    </div>
    <div class="grid">
      ${[
        ['Claims', '42', 72],
        ['Evidence', '118', 88],
        ['Open issues', '7', 18],
      ]
        .map(
          ([label, value, pct]) => `
        <section class="sc-panel sc-panel--lit sc-brackets demo">
          <div class="sc-label">${label}</div>
          <div class="stat sc-glow-text">${value}</div>
          <div class="sc-meter" style="margin-top:10px"><span style="--value:${pct}%"></span></div>
        </section>`,
        )
        .join('')}
    </div>
    <div class="sc-section-title">Recent</div>
    <div class="grid">
      ${WORKSPACE.map(
        (w) => `
        <article class="sc-card sc-brackets sc-brackets--hover">
          <div class="sc-label">Pyramid</div>
          <h3 style="margin:6px 0 8px;font-size:14px">${w}</h3>
          <p class="sc-muted" style="margin:0 0 10px">Governing thought, three key lines, supporting evidence.</p>
          <div class="row"><span class="sc-pill">Draft</span><span class="sc-pill" style="--tint:var(--sc-accent-2)">Review</span></div>
        </article>`,
      ).join('')}
    </div>`,

  components: () => `
    <div class="stack">
      <section class="sc-panel demo">
        <h2>Buttons</h2>
        <div class="row">
          <button class="sc-button sc-button--primary">Primary</button>
          <button class="sc-button">Default</button>
          <button class="sc-button sc-button--ghost">Ghost</button>
          <button class="sc-button sc-button--danger">Delete</button>
          <button class="sc-button" disabled>Disabled</button>
          <button class="sc-button sc-button--icon" title="Add">+</button>
          <button class="sc-button sc-button--sm">Small</button>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Form</h2>
        <div class="grid">
          <label class="sc-field"><span>Title</span><input class="sc-input" placeholder="Name this pyramid"></label>
          <label class="sc-field"><span>Type</span>
            <select class="sc-select"><option>Recommendation</option><option>Analysis</option></select>
          </label>
          <label class="sc-field" style="grid-column:1/-1"><span>Governing thought</span>
            <textarea class="sc-textarea" rows="3" placeholder="The one sentence the reader must accept"></textarea>
          </label>
          <label class="row"><input type="checkbox" class="sc-check" checked> <span>Check evidence on save</span></label>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Tabs, badges, pills, readouts</h2>
        <div class="sc-tabs" style="margin-bottom:16px">
          <button class="sc-tab is-active">Table</button><button class="sc-tab">Board</button><button class="sc-tab">+ View</button>
        </div>
        <div class="row" style="margin-bottom:14px">
          <span class="sc-badge">12</span><span class="sc-badge sc-badge--alert">99+</span>
          <span class="sc-pill">Use case</span>
          <span class="sc-pill" style="--tint:var(--sc-accent-2)">Workflow</span>
          <span class="sc-pill" style="--tint:var(--sc-success)">Introduction</span>
          <span class="sc-pill" style="--tint:var(--sc-danger)">Blocked</span>
          <span class="sc-kbd">⌘ K</span>
        </div>
        <div class="row" style="gap:24px">
          <span class="sc-resource"><span class="sc-resource-icon"></span>1,284</span>
          <span class="sc-resource sc-resource--alt"><span class="sc-resource-icon"></span>312</span>
          <div class="sc-meter" style="width:220px"><span style="--value:64%"></span></div>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Table</h2>
        <table class="sc-table">
          <thead><tr><th>Name</th><th>Type</th><th>Updated</th></tr></thead>
          <tbody>
            <tr><td>Heptabase: Getting Started</td><td><span class="sc-pill" style="--tint:var(--sc-success)">Introduction</span></td><td class="sc-mono sc-muted">2026-09-14</td></tr>
            <tr><td>Project Research Workflow</td><td><span class="sc-pill" style="--tint:var(--sc-accent-2)">Workflow</span></td><td class="sc-mono sc-muted">2026-09-12</td></tr>
            <tr><td>Left Sidebar</td><td><span class="sc-pill">UI Logic</span></td><td class="sc-mono sc-muted">2026-09-02</td></tr>
          </tbody>
        </table>
      </section>

      <section class="sc-panel demo">
        <h2>Alerts</h2>
        <div class="stack">
          <div class="sc-alert"><strong>Info</strong> Sync complete with 3 devices.</div>
          <div class="sc-alert sc-alert--success"><strong>Success</strong> Model exported.</div>
          <div class="sc-alert sc-alert--warning"><strong>Warning</strong> Decomposition has only two boxes.</div>
          <div class="sc-alert sc-alert--danger"><strong>Error</strong> Arrow enters a box on its output side.</div>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Menu</h2>
        <div class="sc-menu" style="width:220px">
          <button class="sc-menu-item">Rename</button>
          <button class="sc-menu-item">Pin to top</button>
          <div class="sc-menu-sep"></div>
          <button class="sc-menu-item is-danger">Delete</button>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Dialog <span class="sc-faint">&lt;sc-dialog&gt;</span></h2>
        <p class="sc-muted" style="margin-top:0"><code>await dialog.open()</code> resolves to the id of the pressed button; Esc, ✕ and the backdrop resolve <code>cancel</code>.</p>
        <div class="row">
          <button class="sc-button sc-button--primary" data-action="dialog">Open dialog</button>
          <button class="sc-button sc-button--danger" data-action="confirm">One-off confirm</button>
          <span class="sc-mono sc-faint" id="dialog-log">resolved: —</span>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Toasts <span class="sc-faint">&lt;sc-toast&gt;</span></h2>
        <p class="sc-muted" style="margin-top:0"><code>ScToast.show(text, { tone, action, duration })</code>; the region is bottom-right.</p>
        <div class="row">
          <button class="sc-button" data-toast="info">Info</button>
          <button class="sc-button" data-toast="success">Success</button>
          <button class="sc-button" data-toast="warning">Warning</button>
          <button class="sc-button" data-toast="danger">Danger</button>
          <button class="sc-button sc-button--primary" data-toast="action">With action</button>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Command palette <span class="sc-faint">&lt;sc-command-palette&gt;</span></h2>
        <p class="sc-muted" style="margin-top:0">Fuzzy search over <code>commands</code>; ↓ ↑ Enter Esc; dispatches <code>sc-command</code> with the id.</p>
        <div class="row">
          <button class="sc-button" data-action="palette">Open</button>
          <span class="sc-kbd">⌘ K</span>
          <span class="sc-mono sc-faint" id="command-log">sc-command: —</span>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Portal bar <span class="sc-faint">&lt;sc-portal-bar&gt;</span></h2>
        <p class="sc-muted" style="margin-top:0">Mounted above the shell inside the Portal (the one at the top of this page). Fetches <code>/auth/me</code>; offline or signed out it renders from the roster cached under <code>toolkit.session</code>.</p>
        <div class="stack">
          <div><div class="sc-label" style="margin-bottom:6px">Signed in</div><div data-portal-demo="online"></div></div>
          <div><div class="sc-label" style="margin-bottom:6px">Signed out (401)</div><div data-portal-demo="signed-out"></div></div>
          <div><div class="sc-label" style="margin-bottom:6px">Offline (fetch failed)</div><div data-portal-demo="offline"></div></div>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Connections <span class="sc-faint">&lt;sc-connections&gt;</span></h2>
        <p class="sc-muted" style="margin-top:0">Settings ▸ Connections: the sync server's <code>/connect</code> list — Google and Strava, the accounts connected, the features each was granted. The buttons open the provider's consent screen. Here the server is a stub.</p>
        <div class="stack">
          <div><div class="sc-label" style="margin-bottom:6px">Connected, Drive not yet granted</div><div data-connections-demo="ready"></div></div>
          <div><div class="sc-label" style="margin-bottom:6px">Signed out (401)</div><div data-connections-demo="signed-out"></div></div>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Sync status <span class="sc-faint">&lt;sc-sync-status&gt;</span></h2>
        <p class="sc-muted" style="margin-top:0">Listens for <code>sync-kit:status</code> on window; its button dispatches <code>sync-kit:sync-now</code>. The sidebar foot shows the same element.</p>
        <div class="stack">
          <div class="row" style="padding:8px 12px;border:1px solid var(--sc-line)"><sc-sync-status style="flex:1"></sc-sync-status></div>
          <div class="row" style="padding:8px 12px;border:1px solid var(--sc-line)"><sc-sync-status no-button></sc-sync-status><span class="sc-faint">(no-button)</span></div>
          <div class="row">
            <span class="sc-label">Simulate</span>
            <button class="sc-button sc-button--sm" data-sync="idle">Idle</button>
            <button class="sc-button sc-button--sm" data-sync="syncing">Syncing</button>
            <button class="sc-button sc-button--sm" data-sync="error">Error</button>
            <button class="sc-button sc-button--sm" data-sync="unauthorized">Unauthorized</button>
            <button class="sc-button sc-button--sm" data-sync="never">Never synced</button>
            <button class="sc-button sc-button--sm" data-sync="unlabelled">No label</button>
            <button class="sc-button sc-button--sm" data-sync="long">Long label</button>
            <span class="sc-mono sc-faint" id="sync-log">sync-kit:sync-now × ${syncNowCount}</span>
          </div>
          <div class="row">
            <span class="sc-label">Network</span>
            <button class="sc-button sc-button--sm" data-net="offline">Go offline</button>
            <button class="sc-button sc-button--sm" data-net="online">Back online</button>
            <span class="sc-faint">(fakes navigator.onLine; an error then reads as Offline, and the portal bars follow)</span>
          </div>
        </div>
      </section>

      <section class="sc-panel demo">
        <h2>Current palette</h2>
        <div class="swatch-row">
          ${['void', 'bg', 'panel', 'panel-2', 'raised', 'line', 'line-strong', 'text', 'text-2', 'accent', 'accent-2', 'app']
            .map((k) => `<div class="swatch" style="background:var(--sc-${k});color:${['text', 'text-2', 'accent', 'accent-2', 'app'].includes(k) ? 'var(--sc-void)' : 'var(--sc-text)'}">${k}</div>`)
            .join('')}
        </div>
        <div class="sc-section-title">App identity colours</div>
        <div class="swatch-row">
          ${['heptabase', 'idef0', 'sysml', 'project', 'pyramid', 'profiler', 'hypermail', 'metropolis', 'flow', 'bom']
            .map((app) => `<div class="swatch" style="background:var(--sc-app-${app});color:var(--sc-void)">${app}</div>`)
            .join('')}
        </div>
      </section>
    </div>`,

  settings: () => `
    <section class="sc-panel sc-panel--lit demo" style="max-width:560px">
      <h2>Appearance</h2>
      <p class="sc-muted" style="margin-top:0">Shared by every toolkit app served from this origin.</p>
      <sc-theme-picker></sc-theme-picker>
    </section>`,
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-view], [data-action], [data-sync], [data-toast], [data-net]');
  if (!el) return;
  if (el.dataset.view) go(el.dataset.view);
  if (el.dataset.sync) publishSync(SYNC_DEMO[el.dataset.sync]());
  if (el.dataset.net === 'offline') {
    setOffline(true);
    publishSync({ ...sync, phase: 'error', lastError: { code: 'network', message: 'Failed to fetch' } });
  }
  if (el.dataset.net === 'online') {
    setOffline(false);
    publishSync(SYNC_DEMO.idle());
  }
  if (el.dataset.toast) TOASTS[el.dataset.toast]();
  const action = el.dataset.action;
  if (action === 'collapse') $('#shell').classList.toggle('is-collapsed');
  if (action === 'dialog') openNewDialog();
  if (action === 'confirm') confirmDelete();
  if (action === 'palette') palette.open();
  if (action === 'back' && history.length) {
    future.push(current);
    go(history.pop(), false);
  }
  if (action === 'forward' && future.length) {
    history.push(current);
    go(future.pop(), false);
  }
});

publishSync(sync);
render();
