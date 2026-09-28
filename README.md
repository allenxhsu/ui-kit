# ui-kit

The shared interface for the toolkit apps in `ClaudWorkSpace`: **Heptabase**,
**IDEF0**, **SysML**, **Project**, **Pyramid**, **Profiler**, **Hypermail**,
**Metropolis** (the `MindMap` folder), **Flow** and the coming **BOM** app. It
gives them one sci-fi HUD look, with brushed-metal panels, chamfered controls,
lit edges, corner brackets and HUD typography. The same kit works whether an
app is built with React, plain HTML, or SwiftUI.

It is the suite's only cross-framework UI layer: CSS classes, design tokens,
light-DOM web components and the generated `SCTheme.swift`. The other shared
jobs live in sibling repos: `../sync-kit` (record sync) and `../shell-kit`
(the Swift WKWebView shell). Nothing of theirs belongs here.

```
ui-kit/
  tokens/tokens.json         single source of truth: palettes, fonts, spacing, app colours
  scripts/build-tokens.mjs   regenerates css/tokens.css + swift/SCTheme.swift
  scripts/copy-into.mjs      refreshes or checks an app's vendored copy of the kit
  css/kit.css                one stylesheet: fonts + tokens + base + components + mac
  css/mac.css                the macOS skin: the same classes, the platform's shapes
  js/theme.js                runtime: skin, palette, appearance, effects (no dependencies)
  js/theme-picker.js         <sc-theme-picker>     the same appearance controls everywhere
  js/sync-status.js          <sc-sync-status>      sync readout, driven by sync-kit's window events
  js/toast.js                <sc-toast>            toast region with ScToast.show()
  js/dialog.js               <sc-dialog>           modal that resolves to the pressed button
  js/command-palette.js      <sc-command-palette>  ⌘K with fuzzy search
  js/portal-bar.js           <sc-portal-bar>       the Portal's bar: app switcher, account, sign in / out
  js/*.d.ts                  types, one per module
  adapters/                  map each existing app's own CSS variables onto the kit
  swift/SCTheme.swift        the same palette for SwiftUI apps
  fonts/                     Orbitron, Exo 2, Share Tech Mono (OFL, bundled for offline)
  template/                  starter app shell + live gallery of every component
```

See it:

```bash
cd /Users/allenxu/Documents/ClaudWorkSpace/ui-kit && npm run serve
```

Then open <http://localhost:8130/template/>. The Components view is the
gallery; Settings switches the palette.

---

## How it switches on

`js/theme.js` sets `data-sc` on `<html>` before first paint, and all the CSS
keys off it and three companions:

| Attribute | Values | Effect |
| --- | --- | --- |
| `data-sc` | `""` / `"mac"` | The HUD skin or the macOS skin |
| `data-race` | `steel` `crystal` `chitin` under the HUD, `light` `dark` under macOS | Palette |
| `data-app` | `heptabase` `idef0` `sysml` `project` `pyramid` `profiler` `hypermail` `metropolis` `flow` `bom` | The app's identity colour (`--sc-app`) |
| `data-sc-effects="off"` | | Removes the scanlines and glow overlays |

Every app shows appearance preferences through the same `<sc-theme-picker>`:
Interface (HUD or macOS), then the HUD's palette and effects or the
macOS skin's appearance (Auto, Light, Dark). They are stored under `ui-kit.*`
in localStorage, so apps served from the same origin share one choice.

**Palettes**

| | Panels | Accent | Secondary |
| --- | --- | --- | --- |
| Steel (default) | brushed steel | cyan | amber |
| Crystal | deep crystal blue | bright cyan | warm gold |
| Chitin | dark chitin | violet | acid orange |

The palettes use neutral names on purpose. The look is inspired by sci-fi
strategy-game HUDs, but options and labels shouldn't use any game's faction
names or other trademarks. Values stored under the kit's first names migrate
automatically.

**The macOS skin.** `data-sc="mac"` draws the same markup the way a standard
Mac app does: system fonts in place of Orbitron, sentence-case labels, rounded
corners in place of chamfers and brackets, no scanlines or glow, soft shadows,
a segmented control for tabs, and accent-filled selection in menus and the
command palette. Its two palettes, `light` and `dark`, are races in
`tokens/tokens.json` like the HUD's, each with its own status colours (Apple's
system red, orange, green and teal, which read correctly on those surfaces).
Auto follows `prefers-color-scheme` and re-applies when the system flips.
Everything lives in `css/mac.css`, keyed off `html[data-sc="mac"]`, so an app
that uses tokens and kit classes gets it with no change; the adapters carry a
short macOS block where they had HUD-specific shapes. The house rules at the
end describe the HUD; under the macOS skin the platform's own conventions
replace rules 1, 2 and 5, while 3 and 4 still hold.

**App identity.** Each app has one display name, one two-letter mark and one
colour, `--sc-app`, used for its brand mark, in the Portal's app switcher, and
wherever another app shows its objects: a Heptabase object is purple in
Metropolis, and so is Heptabase's own brand badge. The first four colours
match the source colours Metropolis already used; the rest were placed so
every pair of apps sits at least 28° apart in hue.

| App | Mark | Colour | | App | Mark | Colour |
| --- | --- | --- | --- | --- | --- | --- |
| heptabase | HB | `#a48df0` | | profiler | PR | `#c173de` |
| idef0 | A0 | `#6aa8e6` | | hypermail | HM | `#e873d1` |
| sysml | SY | `#82cb4d` | | metropolis | MP | `#3cbba7` |
| project | PP | `#55c364` | | flow | FL | `#e9677d` |
| pyramid | PY | `#e09a5a` | | bom | BM | `#ced24b` |

Flow (`flow`) replaced the never-used Habit app (`habit`), which is retired;
its hue slot went to Flow.

All three live under `apps.<id>` in `tokens/tokens.json` as
`{ name, mark, color }`, and that file is the only place they are kept: the
Portal builds its roster from it (`import apps from 'ui-kit/tokens.json'`, or
read the file), the Launcher's catalogue reads it the same way, and SwiftUI
apps get the list as `SCApps.all` in `swift/SCTheme.swift`. Adding an app
means one entry there, its id in `APPS` in `js/theme.js` and `AppId` in
`js/theme.d.ts`, then `npm run tokens`.

---

## Adopting it

### One source, two ways in

This folder is the source. How an app consumes it depends on whether it has a
build step.

**Bundled apps (Vite: Heptabase, Hypermail)** depend on it as a `file:` package
and import subpaths:

```json
"dependencies": { "ui-kit": "file:../ui-kit" }
```

Point at `../ui-kit`, never at another app's copy. With Vite, allow the linked
folder: `server: { fs: { allow: ['..'] } }`.

**No-build apps (IDEF0, SysML, Project, Metropolis)** serve and bundle their
own repo folder, so each keeps a verbatim copy at `<app>/ui-kit/`. From the
app's folder:

```bash
node ../ui-kit/scripts/copy-into.mjs ./ui-kit          # refresh the copy
node ../ui-kit/scripts/copy-into.mjs --check ./ui-kit  # verify it; exit 1 on drift
```

The copy holds `css/ js/ fonts/ tokens/ adapters/ swift/` (the same set as
`package.json` "files", so it matches what `npm install` would ship) plus a
`COPY.md` naming the source commit and date. `template/`, `scripts/` and the
kit's own README are not copied. Refreshing mirrors those directories, so a
file the kit dropped disappears from the copy too; nothing outside them is
touched.

The rules that keep the copies honest:

- Never edit a copy. Change the kit here, then refresh from the app.
- Each app refreshes its own copy from its own repo, in its own session. This
  repo never writes into a sibling; `npm run check-copies` here only reports.
- The app's build and serve scripts run `--check` and stop on drift, so a
  stale copy cannot ship. `--check` copies nothing, compares by content, and
  lists every drifted file as `M` (changed), `+` (missing from the copy) or
  `-` (stale in the copy). Exit 0 means current, 1 drift, 2 a target it
  cannot handle.
- A clone without `../ui-kit` beside it cannot run the check; its script should
  say so and carry on, because the copy is all the app needs to run. IDEF0's
  `scripts/vendor-ui-kit.sh` shows the shape.

**Single-file apps (Pyramid)** inline the CSS and a port of `theme.js` by hand;
see the next section.

### Inside the Portal

The Portal serves every app on one origin under `/<app>/` behind Sign in with
Google, offline-capable, syncing through sync-kit with a session cookie. An app
running there mounts the bar above its shell:

```html
<script type="module" src="ui-kit/js/portal-bar.js"></script>
<sc-portal-bar app="idef0"></sc-portal-bar>
<div class="sc-shell">…</div>
```

The bar fetches `/auth/me` (attribute `src` to change it) and shows the app
switcher, the account and Sign out (POST `/logout`, then reload). It never
blocks the app: it renders first from the last roster cached in localStorage
under `toolkit.session`, and while offline or after a 401 it keeps that
roster and shows a Sign in link to `/?next=<current path>`. The shell under
it gives up the bar's height through the `sc-portal-bar + .sc-shell` rule
(`--sc-portal-bar`, 36px). sync-kit reads the same key and the same shape,
`{ email, workspaces, apps: [{ id, name, mark, color, path }] }`; neither
kit imports the other.

`<sc-sync-status>` knows the two Portal cases: a `lastError` whose code is
`unauthorized` turns the error text into the same Sign in link, and while
`navigator.onLine` is false an error reads as Offline.

### A single-file app with no filesystem access (Pyramid)

Pyramid (`ClaudWorkSpace/../Pyramid`, or wherever its own repo lives — see its
own README) ships as one self-contained HTML file, published two ways: as a
Claude artifact and as a native macOS app that bundles the page at build time.
Neither host can `<link>` a sibling folder, so the usual adoption paths
don't apply. Instead Pyramid inlines a verbatim copy of `tokens.css` +
`base.css` + `components.css` + `adapters/pyramid.css` directly into its own
`<style>` blocks, and a plain (non-module) port of `theme.js`'s logic into its
own `<script>` — same localStorage keys (`ui-kit.*`), same `data-sc` /
`data-race` / `data-app` / `data-sc-effects` attribute contract, same
`ui-kit:change` event, just no `import`. `adapters/pyramid.css` here stays the
canonical source; re-copy it into Pyramid's HTML by hand when it changes.

**The one gotcha this ran into:** Pyramid's own dark-mode selectors
(`:root:not([data-theme="light"])`, `:root[data-theme="dark"]`) sit at CSS
specificity (0,0,2,0). A naive `html[data-sc] { --accent: var(--sc-accent); }`
adapter block is only (0,0,1,1) and silently loses that fight — the custom
properties never actually change and nothing looks wrong until you inspect
computed styles. Any adapter for an app with its own `:root`-level dark-mode
rules should write its token remap as `:root[data-sc] { … }` to match or beat
that specificity, not `html[data-sc]`.

### An existing no-build app (IDEF0, SysML, Project, Metropolis)

Add the vendored copy and the app's adapter. Nothing in the app's own CSS has
to change:

```html
<link rel="stylesheet" href="ui-kit/css/kit.css">
<link rel="stylesheet" href="ui-kit/adapters/idef0.css">
<script type="module">
  import { initTheme } from './ui-kit/js/theme.js';
  initTheme({ app: 'idef0' });
</script>
<script type="module" src="ui-kit/js/theme-picker.js"></script>
```

The adapter maps the app's existing variables (`--ink`, `--panel`, `--accent`, …)
onto kit tokens, so every existing screen restyles at once. From there, screens
can move to `sc-*` components one at a time. The web components load the same
way, one `<script type="module">` each.

Notes:
- **IDEF0:** the adapter themes the on-screen diagram sheet dark. Before shipping,
  confirm that SVG/PNG/PDF export sets its own sheet colours and doesn't read
  `--sheet`.
- **Metropolis** (folder `MindMap/`): its Node server needs to serve the `ui-kit`
  folder, or a copy can go under `app/ui/`. Metropolis already has its own HUD
  skin in `app/ui/styles.css`. On adoption, trim it to Metropolis-only shapes, or
  it will fight the adapter over the same variables. The adapter leaves the source
  colours (`--osm`, `--str`, `--yt`) and the validated chart palette (`--viz-*`) untouched.

### A bundled app (Heptabase, Hypermail)

```bash
npm install ../ui-kit
```

```ts
import { initTheme, detectMacDesktop } from 'ui-kit/theme';
import 'ui-kit/theme-picker';
import 'ui-kit/toast';
import 'ui-kit/css/kit.css';
import 'ui-kit/adapters/heptabase.css';

initTheme({ app: 'heptabase', macInset: detectMacDesktop() });
```

With Vite, allow the linked folder: `server: { fs: { allow: ['..'] } }`.
Heptabase adds `src/theme/hud.css` for shapes that are specific to its own
components, such as whiteboard cards and section plates.

### A SwiftUI app (IDEF0 macOS, HomeOrg)

Add `swift/SCTheme.swift` to the target (IDEF0 copies it from its vendored
`ui-kit/swift/` into the Mac target with its own vendor script). `SCRace`
carries the three HUD palettes and the two macOS appearances, `.light` and
`.dark`, so a native window can match a web view exactly:

```swift
@AppStorage("ui-kit.race") var race: SCRace = .steel

var body: some View {
  content
    .foregroundStyle(race.palette.text)
    .background(race.palette.bg)
    .tint(race.palette.accent)
}

Text("WORKSPACE").font(SCFont.display(11, weight: .semibold))
Circle().fill(SCAppColor.flow)
```

Bundle the TTF versions of Orbitron, Exo 2 and Share Tech Mono (Google Fonts, OFL).
The woff2 files in `fonts/` only work on the web.

---

## Components

All classes use the `sc-` prefix. Stateful classes use `is-` (`is-active`,
`is-collapsed`). The gallery in `template/` renders every one of these.

| Area | Classes |
| --- | --- |
| Shell | `sc-shell` `sc-sidebar` `sc-titlebar` `sc-brand` `sc-brand-mark` `sc-nav` `sc-nav-item` `sc-nav-icon` `sc-sidebar-foot` `sc-main` `sc-header` `sc-header-title` `sc-content` |
| Surfaces | `sc-panel` (`--raised` `--glass` `--lit`) `sc-card` `sc-brackets` (`--hover`) `sc-chamfer` `sc-hexgrid` `sc-starfield` |
| Controls | `sc-button` (`--primary` `--ghost` `--danger` `--icon` `--sm`) `sc-input` `sc-select` `sc-textarea` `sc-check` `sc-field` |
| Navigation | `sc-tabs` `sc-tab` `sc-list-item` `sc-menu` `sc-menu-item` `sc-menu-sep` |
| Data | `sc-table` `sc-badge` (`--alert`) `sc-pill` `sc-resource` (`--alt`) `sc-meter` `sc-kbd` |
| Feedback | `sc-alert` (`--warning` `--danger` `--success`) `sc-overlay` `sc-dialog` `sc-dialog-head` `sc-dialog-body` `sc-dialog-foot` `sc-toast-item` `sc-boot` |
| Palette | `sc-palette-input` `sc-palette-results` `sc-palette-group` `sc-palette-item` `sc-palette-label` `sc-palette-empty` |
| Sync | `sc-sync-dot` `sc-sync-phase` `sc-sync-detail` `sc-sync-action` |
| Portal | `sc-portal-home` `sc-portal-apps` `sc-portal-app` `sc-portal-account` `sc-portal-avatar` `sc-portal-email` |
| Type | `sc-display` `sc-label` `sc-section-title` `sc-mono` `sc-glow-text` `sc-muted` `sc-faint` |

Colouring a single instance: `sc-pill`, `sc-nav-icon` and `sc-alert` read `--tint`,
so `style="--tint: var(--sc-accent-2)"` recolours just that element.

### Web components

Six custom elements, all built the same way: light DOM (no shadow root, so
they inherit the page's kit styles and any app can restyle them), no
dependencies, kit classes only, one `.d.ts` beside each module, and a place in
the gallery. Load one with `<script type="module" src="ui-kit/js/toast.js">`
in a no-build app or `import 'ui-kit/toast'` in a bundled one; the class is
also exported (`ScToast`, `ScDialog`, …) for the static APIs.

| Element | Module | What it does |
| --- | --- | --- |
| `<sc-theme-picker>` | `js/theme-picker.js` | Interface (HUD or macOS), palette, effects and appearance controls. Writes through `theme.js`, stays in sync across tabs. |
| `<sc-sync-status>` | `js/sync-status.js` | Sync readout: phase dot, "Synced 4 min ago · ↓3 ↑1", Sync now. Driven by `sync-kit:status` events on `window` (or `el.status = …`); its button dispatches `sync-kit:sync-now`. A `lastError` code of `unauthorized` shows a Sign in link instead of the error; offline, an error reads as Offline. Never imports sync-kit. `no-button` hides the button. |
| `<sc-portal-bar>` | `js/portal-bar.js` | The Portal's bar above the shell: app switcher from the roster (marks in identity colours, current app lit, links to `/<id>/`), account, Sign out. `src` (default `/auth/me`), `app`. Renders from the `toolkit.session` cache first; offline or on 401 it shows Sign in and never blocks the app. |
| `<sc-toast>` | `js/toast.js` | Toast region, bottom-right. `ScToast.show(text, { tone, action, duration })` returns `{ dismiss }`; the region is created on first use if the page has none. |
| `<sc-dialog>` | `js/dialog.js` | Modal on the `sc-overlay` / `sc-dialog` markup. Children are the body; `heading` and `buttons="id:label:kind,…"` (or `.buttons`) render the chrome. `await el.open()` resolves to the pressed button id; Esc, ✕ and the backdrop resolve `cancel`. `ScDialog.open({ heading, body, buttons })` for one-offs. |
| `<sc-command-palette>` | `js/command-palette.js` | ⌘K. `el.commands = [{ id, label, shortcut, group }]`; fuzzy filter; ↓ ↑ (⌃N ⌃P) Enter Esc as in Hypermail's palette; dispatches `sc-command` with `{ id, command }`. `hotkey="k"` binds ⌘K / ⌃K. |

The other half of the sync contract, what sync-kit dispatches and listens
for, is documented in `../sync-kit/README.md#showing-the-status`; the two READMEs
describe the same events and neither kit imports the other.

**From React 18.** React writes attributes, not properties, on custom elements,
so set the object-valued inputs (`status`, `commands`, `buttons`) through a
ref inside an effect, and subscribe to the events with `addEventListener` in
the same effect. Each file's header shows the exact effect. Anything that is
just a call (`ScToast.show`, `ScDialog.open`) needs no ref at all. Hypermail
keeps its own React command palette; `<sc-command-palette>` is for the apps
without a bundler.

### Tokens

Use variables, never raw colours, so all three palettes work:

- surfaces: `--sc-void` `--sc-bg` `--sc-panel` `--sc-panel-2` `--sc-raised` `--sc-sunken`
- lines: `--sc-line` `--sc-line-strong`
- text: `--sc-text` `--sc-text-2` `--sc-text-3`
- accents: `--sc-accent` `--sc-accent-2` `--sc-glow` `--sc-app`
- app colours: `--sc-app-heptabase` … `--sc-app-bom`, one per app, for showing another app's objects
- layout: `--sc-portal-bar` (the Portal bar's height)
- status: `--sc-danger` `--sc-warning` `--sc-success` `--sc-info`
- alpha: every colour also has an `-rgb` triplet, e.g. `rgb(var(--sc-accent-rgb) / 0.2)`
- fonts: `--sc-font-display` `--sc-font-ui` `--sc-font-mono` (the system faces under the macOS skin)
- shape: `--sc-radius` (2px under the HUD, 6px under macOS) `--sc-chamfer` `--sc-bracket`

To change a colour, edit `tokens/tokens.json` and run `npm run tokens` (or
`node scripts/build-tokens.mjs`). A race may carry its own `status` block,
as the macOS ones do; otherwise the shared status colours apply. The build is idempotent, so running it twice
changes nothing. Never hand-edit `css/tokens.css` or `swift/SCTheme.swift`.

---

## Rules that keep the apps consistent

These describe the HUD skin. Under the macOS skin the platform's conventions
replace 1, 2 and 5; 3 and 4 always hold.

1. **Pressable things are chamfered, and framing things get brackets.** Don't
   round corners.
2. **Orbitron is for labels, buttons and headings only.** Anything read at
   length (notes, descriptions, table cells) uses Exo 2.
3. **One glowing element per region.** The active item and the primary action
   glow; nothing else does.
4. **Status colours carry meaning.** Don't use `--sc-danger` for decoration.
5. **Keep the effects subtle.** Scanlines stay at their opacity, and everything
   decorative respects `data-sc-effects="off"` and `prefers-reduced-motion`.
