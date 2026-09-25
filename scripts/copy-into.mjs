#!/usr/bin/env node
/**
 * Copies the kit into an app that vendors it, or checks that such a copy is
 * still current.
 *
 *   node scripts/copy-into.mjs <target-dir>...           refresh each copy
 *   node scripts/copy-into.mjs --check <target-dir>...   copy nothing, list drift
 *
 * <target-dir> is the copy itself (../IDEF0/ui-kit), not the app folder.
 *
 * The no-build apps (IDEF0, SysML, Project, Metropolis) serve and bundle their
 * own repo folder, so each keeps a verbatim copy of the kit. Nothing else
 * checks that those copies match this folder; this script is that check.
 *
 * What is managed is package.json "files": css/ js/ fonts/ tokens/ adapters/
 * swift/. A copy therefore holds exactly what `npm install ../ui-kit` would.
 * template/, scripts/, README.md, package.json and .git are never copied.
 *
 * Refreshing mirrors each managed directory: new and changed files are
 * written, files the source no longer has are deleted, nothing outside those
 * directories is touched, and COPY.md records where the copy came from.
 *
 * --check compares by content (file times never count as drift), prints every
 * drifted file as M (differs), + (missing from the copy) or - (stale, gone from
 * the source), and exits 1 when any target drifts. 0 means every copy is
 * current. 2 is a usage error or a target that cannot be handled. COPY.md is
 * not compared (it carries a date); a missing one is noted, not drift.
 *
 * App build scripts run the check so a stale copy cannot ship. Each app
 * refreshes its copy from its own repo, in its own session.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
/** The managed set is package.json "files", so a copy and an npm install ship the same thing. */
const MANAGED = pkg.files;
const IGNORED = new Set(['.DS_Store']);

const args = process.argv.slice(2);
const check = args.includes('--check');
const targets = args.filter((a) => !a.startsWith('-'));
const badFlags = args.filter((a) => a.startsWith('-') && a !== '--check');

if (targets.length === 0 || badFlags.length) {
  console.error(
    [
      'usage: node scripts/copy-into.mjs [--check] <target-dir>...',
      '',
      '  <target-dir>  the vendored copy itself, e.g. ../IDEF0/ui-kit',
      '  --check       copy nothing; list drift and exit 1 if any copy is out of date',
      '',
      `  managed: ${MANAGED.map((d) => `${d}/`).join(' ')}`,
    ].join('\n'),
  );
  process.exit(2);
}

/** Relative paths of every file under dir, sorted. Empty when dir is missing. */
function listFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

function sameContent(a, b) {
  const x = fs.readFileSync(a);
  const y = fs.readFileSync(b);
  return x.length === y.length && x.equals(y);
}

/** Every difference between the source and one copy: [{ mark: 'M' | '+' | '-', file }]. */
function drift(target) {
  const out = [];
  for (const dir of MANAGED) {
    const src = new Set(listFiles(path.join(ROOT, dir)));
    const dst = new Set(listFiles(path.join(target, dir)));
    for (const f of [...new Set([...src, ...dst])].sort()) {
      const file = `${dir}/${f}`;
      if (!dst.has(f)) out.push({ mark: '+', file });
      else if (!src.has(f)) out.push({ mark: '-', file });
      else if (!sameContent(path.join(ROOT, file), path.join(target, file))) out.push({ mark: 'M', file });
    }
  }
  return out;
}

function git(...argv) {
  try {
    return execFileSync('git', ['-C', ROOT, ...argv], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function copyMd(target) {
  const commit = git('rev-parse', '--short', 'HEAD') || 'unknown';
  const dirty = git('status', '--porcelain', '--', ...MANAGED) !== '';
  const appDir = path.dirname(target);
  // Relative when the source is a near sibling (../ui-kit), absolute otherwise.
  const rel = (p) => {
    const r = path.relative(appDir, p) || '.';
    if (r.split(path.sep).filter((seg) => seg === '..').length > 2) return p;
    return r.startsWith('.') ? r : `./${r}`;
  };
  const script = rel(path.join(ROOT, 'scripts/copy-into.mjs'));
  return [
    `# Vendored copy of ${pkg.name}`,
    '',
    `Do not edit anything in this folder. The source is \`${rel(ROOT)}\`; change it`,
    'there and refresh this copy. Only the directories listed below are managed,',
    'and a refresh replaces them wholesale.',
    '',
    `- Package: ${pkg.name} ${pkg.version}`,
    `- Source commit: ${commit}${dirty ? ' + uncommitted changes' : ''}`,
    `- Copied: ${new Date().toISOString()}`,
    `- Contents: ${MANAGED.map((d) => `${d}/`).join(' ')}`,
    '',
    `From \`${path.basename(appDir)}/\` (the folder that holds this copy):`,
    '',
    `    node ${script} ${rel(target)}            # refresh`,
    `    node ${script} --check ${rel(target)}    # verify; exit 1 on drift`,
    '',
  ].join('\n');
}

function pruneEmptyDirs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = path.join(dir, entry.name);
    pruneEmptyDirs(p);
    if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
  }
}

/** Mirrors the managed set into target and writes COPY.md. Returns the drift it removed. */
function refresh(target) {
  const before = drift(target);
  for (const dir of MANAGED) {
    const srcDir = path.join(ROOT, dir);
    const dstDir = path.join(target, dir);
    const files = listFiles(srcDir);
    fs.mkdirSync(dstDir, { recursive: true });
    for (const f of files) {
      fs.mkdirSync(path.dirname(path.join(dstDir, f)), { recursive: true });
      fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
    }
    const keep = new Set(files);
    for (const f of listFiles(dstDir)) if (!keep.has(f)) fs.rmSync(path.join(dstDir, f));
    pruneEmptyDirs(dstDir);
  }
  fs.writeFileSync(path.join(target, 'COPY.md'), copyMd(target));
  return before;
}

let exit = 0;
for (const t of targets) {
  const target = path.resolve(t);
  const real = fs.existsSync(target) ? fs.realpathSync(target) : target;
  if (real === ROOT || real.startsWith(ROOT + path.sep)) {
    console.error(`${t}: is the source itself; refusing to copy the kit onto it`);
    exit = 2;
    continue;
  }
  if (fs.existsSync(target) && !fs.statSync(target).isDirectory()) {
    console.error(`${t}: not a directory`);
    exit = 2;
    continue;
  }

  if (check) {
    if (!fs.existsSync(target)) {
      console.error(`${t}: no such directory`);
      exit = 2;
      continue;
    }
    const d = drift(target);
    const note = fs.existsSync(path.join(target, 'COPY.md')) ? '' : ' (no COPY.md: never refreshed by this script)';
    if (d.length === 0) {
      console.log(`${t}: up to date${note}`);
      continue;
    }
    console.log(`${t}: ${d.length} file${d.length === 1 ? '' : 's'} differ${note}`);
    for (const { mark, file } of d) console.log(`  ${mark} ${file}`);
    if (exit === 0) exit = 1;
  } else {
    const d = refresh(target);
    const count = (mark) => d.filter((x) => x.mark === mark).length;
    console.log(`${t}: refreshed (${count('M')} updated, ${count('+')} added, ${count('-')} removed)`);
  }
}

if (check && exit === 1) {
  console.log(`\nout of date. Refresh from each app's own repo:  node ${path.relative(process.cwd(), path.join(ROOT, 'scripts/copy-into.mjs'))} <target-dir>`);
}
process.exit(exit);
