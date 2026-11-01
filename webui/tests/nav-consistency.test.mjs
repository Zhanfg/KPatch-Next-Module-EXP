import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const nav = html.split('<div class="bottom-bar">')[1]?.split('<!-- Dialog -->')[0];
assert.ok(nav, 'Bottom navigation is required');
function item(id) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const marker = new RegExp('<div class="bottom-bar-item[^"]*" id="' + escaped + '"');
    const match = marker.exec(nav);
    assert.ok(match, 'Missing nav entry ' + id);
    const start = match.index;
    const next = nav.indexOf('<div class="bottom-bar-item', start + match[0].length);
    const part = nav.slice(start, next < 0 ? nav.length : next);
    assert.equal((part.match(/<md-icon(?:\s|>)/g) || []).length, 2, id + ': both icon states needed');
    assert.equal((part.match(/<svg\s/g) || []).length, 2, id + ': both states must be SVG');
    return part;
}
for (const id of ['home', 'KPM', 'exclude', 'settings']) item(id);
const kpm = item('KPM');
assert.equal((kpm.match(/viewBox="0 0 24 24"/g)||[]).length, 2);
assert.equal((kpm.match(/M19 10h-1V7/g)||[]).length, 2,
    'Puzzle outlines must share the same symmetrical geometry');
const exclude = item('exclude');
assert.equal((exclude.match(/<circle[^>]+fill="none"/g)||[]).length,2,
    'Excluded app icon must stay outlined in normal and selected states');
assert.equal((exclude.match(/stroke="currentColor"/g)||[]).length,4,
    'Both circle and slash must use foreground color, never inverse fill');
assert.ok(!exclude.includes('stroke="var(--md-sys-color-secondary-container'),
    'No inverse-color prohibited icon');
assert.ok(css.includes('.bottom-bar-item > md-icon > svg'));
assert.ok(css.includes('place-items: center'));
assert.ok(css.includes('--md-icon-size: 24px'));
assert.ok(!html.includes('kp-startup-recovery'), 'Do not reintroduce startup recovery overlays');
console.log('Navigation selected/normal states, SVG alignment and no-inverse icons: PASS');
