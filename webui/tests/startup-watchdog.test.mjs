import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const match = html.match(/<!-- Standalone startup monitor[^]*?<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'Independent inline watchdog must exist ahead of module script');
const compiled = new vm.Script(match[1], {filename:'startup-watchdog.js'});
const moduleTag = html.indexOf('<script src="index.js" type="module">');
assert.ok(html.indexOf('<!-- Standalone startup monitor') < moduleTag);
assert.ok(js.indexOf('window.__kpStartup?.ready()') < js.indexOf('Promise.resolve().then(() => updateStatus())'),
    'Splash must be released before device native commands start');
assert.ok(js.indexOf('window.__kpStartup?.ready()') < js.indexOf('Promise.resolve().then(() => initInfo())'),
    'Splash must be released before device metadata probe');

function mock() {
    const timerFns = [];
    const events = {};
    const dom = {};
    const splash = {classList:{items:[],add(x){this.items.push(x)}},remove(){dom.splash=null}};
    dom.splash = splash;
    const body = {children:[],appendChild(x){this.children.push(x);dom[x.id]=x}};
    const document = {
        body,
        getElementById:id=>id==='splash'?dom.splash:dom[id]||null,
        createElement:tag=>({tag,style:{},dataset:{},appendChild(child){this.children=(this.children||[]).concat(child)},setAttribute(){},remove(){delete dom[this.id]}}),
        addEventListener:(name,fn)=>events[name]=fn,
    };
    const window = {addEventListener:(name,fn)=>events[name]=fn};
    const location = {reload(){}};
    compiled.runInNewContext({window,document,location,setTimeout:(fn,ms)=>{timerFns.push({fn,ms});return timerFns.length}});
    return {window,document,dom,splash,events,timerFns};
}
{
    const env = mock();
    assert.equal(env.dom.splash!==null,true);
    env.window.__kpStartup.ready();
    assert.ok(env.splash.classList.items.includes('exit'));
    const watchdog = env.timerFns.find(x=>x.ms===10000);
    watchdog.fn();
    assert.equal(env.document.getElementById('kp-startup-recovery'),null,'successful startup must not show failure UI');
}
{
    const env=mock();
    env.timerFns.find(x=>x.ms===10000).fn();
    assert.ok(env.splash.classList.items.includes('exit'));
    assert.ok(env.document.getElementById('kp-startup-recovery'),'stalled JS must show recovery prompt');
}
{
    const env=mock();
    env.events.error({filename:'https://host/webroot/assets/index-deadbeef.js'});
    assert.ok(env.splash.classList.items.includes('exit'));
    assert.ok(env.document.getElementById('kp-startup-recovery'),'bundle load failure must show recovery');
}
{
    const env = mock();
    env.timerFns.find(x=>x.ms===10000).fn();
    assert.ok(env.document.getElementById('kp-startup-recovery'), 'timeout must be reported');
    // A late successful JS startup must clear a false-positive timeout card.
    env.window.__kpStartup.ready();
    assert.equal(env.document.getElementById('kp-startup-recovery'), null, 'late startup clears timeout banner');
}
{
    const env = mock();
    env.window.__kpStartup.ready();
    env.window.__kpStartup.warn('ime');
    assert.equal(env.document.getElementById('kp-startup-recovery')?.dataset.stage,'ime');
    assert.equal(env.splash.classList.items.includes('exit'), true);
}
assert.ok(js.indexOf('window.__kpStartup?.ready()') < js.indexOf("setup('ime'"),
    'A throwing IME helper must not prevent splash release');
assert.ok(js.includes("setup('navigation'"), 'navigation setup must be isolated');
console.log('Startup monitor: early ready, timeout, late-success, warning and bundle-error paths PASS');
