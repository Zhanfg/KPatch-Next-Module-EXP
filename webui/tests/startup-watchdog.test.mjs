import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const match = html.match(/<!-- Independent boot watchdog[^]*?<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'Independent inline watchdog must exist ahead of module script');
const compiled = new vm.Script(match[1], {filename:'startup-watchdog.js'});
const moduleTag = html.indexOf('<script src="index.js" type="module">');
assert.ok(html.indexOf('<!-- Independent boot watchdog') < moduleTag);
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
    const body = {children:[],appendChild(x){this.children.push(x);dom[x.id]=x;x.remove=()=>{delete dom[x.id];this.children=this.children.filter(el=>el!==x)};}};
    const document = {
        body,
        getElementById:id=>id==='splash'?dom.splash:dom[id]||null,
        createElement:tag=>({tag,style:{},appendChild(child){this.children=(this.children||[]).concat(child)},setAttribute(){}}),
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
    const watchdog = env.timerFns.find(x=>x.ms===6000);
    watchdog.fn();
    assert.equal(env.document.getElementById('kp-startup-recovery'),null,'successful startup must not show failure UI');
}
{
    const env=mock();
    env.timerFns.find(x=>x.ms===6000).fn();
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
    // Reproduces the user's screenshot in r5: home screen loaded successfully,
    // then optional Exclude/KPM setup errors triggered the fatal recovery panel.
    const env = mock();
    env.window.__kpStartup.ready();
    env.window.__kpStartup.fail('exclude-init');
    env.window.__kpStartup.fail('kpm-init');
    assert.equal(env.document.getElementById('kp-startup-recovery'),null,
        'A subpage error after ready() must not obscure the working homepage');
    assert.equal(env.window.__kpStartupWarnings.length,2);
    assert.ok(env.window.__kpStartupWarnings.includes('exclude-init'));
}
{
    // If an import failed first but a retry later completed initialization,
    // the recovery overlay must be removed rather than lingering over the UI.
    const env=mock();
    env.window.__kpStartup.fail('bundle-load');
    assert.ok(env.document.getElementById('kp-startup-recovery'));
    env.window.__kpStartup.ready();
    assert.equal(env.document.getElementById('kp-startup-recovery'),null);
}
assert.ok(js.includes("initPage('exclude-init'"), 'Exclude must initialize independently');
assert.ok(js.includes("initPage('kpm-init'"), 'KPM must initialize independently');
assert.ok(!js.includes("window.__kpStartup?.fail();\n        }\n    });"),
    'Optional page failures must not raise the global startup failure overlay');
assert.ok(js.indexOf('window.__kpStartup?.ready()') < js.indexOf('getMaxChunkSize()).catch('),
    'Native ARG_MAX probe must run after startup is acknowledged');
console.log('Startup watchdog: ready, stalled, bundle failure and nonfatal page failure PASS');
