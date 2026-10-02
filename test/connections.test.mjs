// <sc-connections> renders from a model, so the model and the markup can be
// checked in Node: what the server's list becomes, what each state looks
// like, and the addresses the buttons send a person to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConnections, renderConnections, startUrl, describeFeatures } from '../js/connections.js';

const SERVER = {
  providers: [
    { id: 'google', name: 'Google', configured: true, features: ['calendar', 'drive', 'sheets'],
      accounts: [{ id: 'me@gmail.com', label: 'me@gmail.com', connectedAt: 1758000000000, features: ['calendar'] }] },
    { id: 'strava', name: 'Strava', configured: false, features: ['activities'], accounts: [] },
  ],
};

test('the server list becomes a model, defensively', () => {
  const m = normalizeConnections(SERVER);
  assert.equal(m.length, 2);
  assert.deepEqual(m[1], { id: 'strava', name: 'Strava', configured: false, features: ['activities'], accounts: [] });
  assert.equal(normalizeConnections(null), null, 'not a list: nothing');
  assert.equal(normalizeConnections({ providers: 'x' }), null);
  assert.deepEqual(normalizeConnections({ providers: [{ id: 'strava' }] })[0], { id: 'strava', name: 'strava', configured: false, features: [], accounts: [] }, 'missing fields fall back');
  assert.deepEqual(normalizeConnections({ providers: [{ id: 'google', accounts: [{ id: 'a' }, null] }] })[0].accounts, [{ id: 'a', label: 'a', connectedAt: null, features: [] }]);
});

test('each provider is a block: accounts with their features, a Connect button, Disconnect per account', () => {
  const html = renderConnections({ state: 'ready', providers: normalizeConnections(SERVER) }, { origin: '', features: { google: ['calendar'] } });
  assert.match(html, /data-provider="google"/);
  assert.match(html, /me@gmail\.com/);
  assert.match(html, /Calendar/, 'features are named for people');
  assert.match(html, /data-disconnect="google" data-account="me@gmail\.com"/);
  assert.match(html, /data-connect="google"[^>]*>Connect another Google account/);
  assert.match(html, /data-connect="strava"[^>]*disabled/, 'a provider the server is not set up for cannot be started');
  assert.match(html, /not set up for Strava/);
});

test('a Google account connected for the calendar is offered Drive when the app asks for it', () => {
  const html = renderConnections({ state: 'ready', providers: normalizeConnections(SERVER) }, { origin: '', features: { google: ['calendar', 'drive'] } });
  assert.match(html, /data-connect="google" data-features="calendar,drive"[^>]*>Add Drive/);
  const same = renderConnections({ state: 'ready', providers: normalizeConnections(SERVER) }, { origin: '', features: { google: ['calendar'] } });
  assert.doesNotMatch(same, /Add Drive/);
});

test('only the providers asked for are shown', () => {
  const html = renderConnections({ state: 'ready', providers: normalizeConnections(SERVER) }, { origin: '', providers: ['strava'] });
  assert.doesNotMatch(html, /data-provider="google"/);
  assert.match(html, /data-provider="strava"/);
});

test('loading, signed out, unavailable and error each read differently', () => {
  assert.match(renderConnections({ state: 'loading', providers: null }, {}), /Asking your sync server/);
  const out = renderConnections({ state: 'unauthorized', providers: null }, {});
  assert.match(out, /Sign in/);
  assert.match(out, /href="\/\?next=/);
  assert.match(renderConnections({ state: 'unavailable', providers: null }, {}), /no sync server/i);
  assert.match(renderConnections({ state: 'error', providers: null, error: 'boom' }, {}), /boom/);
  assert.match(renderConnections({ state: 'error', providers: null, error: 'boom' }, {}), /data-refresh/);
});

test('the start address carries the features asked for, on the server named', () => {
  assert.equal(startUrl('https://host', 'strava'), 'https://host/connect/strava/start');
  assert.equal(startUrl('', 'google', ['calendar', 'drive']), '/connect/google/start?features=calendar%2Cdrive');
  assert.equal(describeFeatures(['calendar', 'drive', 'sheets', 'activities', 'odd']), 'Calendar, Drive, Sheets, Activities, odd');
});
