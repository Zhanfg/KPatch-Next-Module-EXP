import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { iconSvg } from '../icons.js';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const kpm = read('../page/kpm.js');
const patch = read('../page/patch.js');
const css = read('../styles.css');
for (const [name, src] of Object.entries({html,kpm,patch})) {
    assert.ok(!/<md-icon(?:\s|>)/.test(src), name + ': must not depend on font-based md-icon elements');
    assert.ok(!/material-icons|material-symbols|Material Symbols|&#x[eE][0-9a-fA-F]{3,}|font-family:\s*['"]?Material/i.test(src),
        name + ': contains icon font dependency');
}
const navigation = ['home','KPM','exclude','settings'];
for (const id of navigation) {
    const start = html.indexOf('id="' + id + '"');
    const end = html.indexOf('bottom-bar-item-text', start);
    assert.ok(start >= 0 && end > start, 'Missing navigation item ' + id);
    const block = html.slice(start,end);
    const icons = [...block.matchAll(/<svg\b[^>]*class="[^"]*kp-icon[^"]*"[^>]*>/g)];
    assert.equal(icons.length,2,id + ' should have normal + selected SVG paths');
    assert.ok(icons[1][0].includes('slot="selected"'),id + ' selected icon slot');
}
assert.ok(!css.includes('md-icon {') && !css.includes('md-icon[slot='),'no font-icon CSS selectors');
assert.ok(css.includes('.bottom-bar-item > .kp-icon'),'SVG nav sizing missing');
for (const name of ['tune','power','delete','close']) {
    const markup = iconSvg(name);
    assert.match(markup, /^<svg\b/);
    assert.ok(markup.includes('viewBox="0 0 24 24"'));
    assert.ok(markup.includes('</svg>'));
}
assert.ok(kpm.includes("isEmbeddedModule(module) ? 'power' : 'delete'"), 'Manual exit must use power SVG, not delete');
assert.ok(kpm.includes("${iconSvg('tune')}"),'KPM control icon SVG missing');
assert.ok(patch.includes("${iconSvg('tune')}"),'Patch control icon SVG missing');
assert.match(kpm,/class="control kpm-action"/,'KPM action button must keep visible label');
assert.match(kpm,/class="unload kpm-action"/,'KPM exit button must keep visible label');
assert.match(patch,/class="control kpm-action"/,'Patch config button must keep visible label');
assert.match(patch,/class="unload kpm-action kpm-danger"/,'Patch remove button must keep visible label');
console.log('Portable SVG icons and labeled actions: source checks passed');
