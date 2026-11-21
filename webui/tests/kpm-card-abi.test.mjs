import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../page/kpm.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../../.github/workflows/build.yaml', import.meta.url), 'utf8');

const begin = source.indexOf('function escapeHtml(value) {');
const end = source.indexOf('function getLoadModeTag(module) {', begin);
assert.ok(begin >= 0 && end > begin, 'ABI helper should be available');
const getAbiBadge = runInNewContext(source.slice(begin, end) + '\ngetAbiBadge;');

assert.match(getAbiBadge({ abi: '1' }), />ABI 1<\/span>/);
assert.match(getAbiBadge({ abi: undefined }), />legacy<\/span>/);
assert.match(getAbiBadge({ abi: '' }), />legacy<\/span>/);
assert.match(getAbiBadge({ abi: 'v1.0' }), />unknown<\/span>/);
assert.match(getAbiBadge({ abi: '<script>' }), />unknown<\/span>/);
assert.doesNotMatch(getAbiBadge({ version: '1.8.3.7' }), /ABI 1/);

assert.ok(source.includes('allKpms.forEach((module, index) => {'));
assert.ok(source.includes('const enabledSwitch = module.installed'));
assert.ok(source.includes('class="module-card-status"'));
assert.ok(source.includes('class="module-card-action-buttons"'));
assert.ok(source.includes('aria-labelledby="kpm-switch-${index}"'));
assert.ok(source.includes("item.querySelector('.control').onclick"));
assert.ok(source.includes("item.querySelector('.unload').onclick"));
assert.ok(source.includes("item.querySelector('.installed-toggle')"));
assert.ok(css.includes('--md-filled-tonal-icon-button-container-width: 48px'));
assert.ok(css.includes('.module-card-title-row'));
assert.ok(css.includes('.kpm-abi-badge'));
assert.ok(css.includes('.module-switch-setting'));
assert.ok(workflow.includes('e8286dea5e4e78e25f4a57178635d3b0ae00d577'));
console.log('KPM ABI metadata, M3 layout, control/remove/switch preservation: PASS');
