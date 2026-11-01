import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { queueBootOptions, getQueuedBootOptions, clearQueuedBootOptions, showKpmControlDialog } from '../kpm-control.js';
import { installImeViewportGuard } from '../viewport.js';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

clearQueuedBootOptions();
queueBootOptions('Nohello', 'pre-kernel-init', '--safe');
assert.deepEqual(getQueuedBootOptions('Nohello'), {event: 'pre-kernel-init', args: '--safe'});
assert.throws(() => queueBootOptions('Nohello', 'invalid-event', ''), RangeError);
clearQueuedBootOptions();
assert.equal(getQueuedBootOptions('Nohello'), null);

const selectorMap = new Map();
for (const key of ['#kpm-runtime-section','#kpm-embed-section','#kpm-ctl0-input','#kpm-event-select','#kpm-args-input','.confirm-runtime','.confirm-embed','.cancel','#kpm-embed-hint','[slot="headline"]']) {
    selectorMap.set(key, {hidden:false,disabled:false,value:'',textContent:'',onclick:null,oninput:null});
}
let closed=0,shown=0,issued=0;
const dialog={querySelector:(sel)=>selectorMap.get(sel),show(){shown++},close(){closed++}};
globalThis.document={getElementById:(id)=>id==='control-dialog'?dialog:null};
globalThis.CustomEvent=class {constructor(type){this.type=type}};
globalThis.window={dispatchEvent(e){if(e.type==='kpm:open-patch')issued++}};

let controlArgs=[];
showKpmControlDialog({moduleName:'Nohello',mode:'runtime',embedAvailable:true,
    event:'pre-kernel-init',embedArgs:'boot-only',
    onRuntime:async arg=>controlArgs.push(arg)});
assert.equal(selectorMap.get('#kpm-runtime-section').hidden,false);
assert.equal(selectorMap.get('#kpm-embed-section').hidden,false);
const ctl=selectorMap.get('#kpm-ctl0-input');
ctl.value='ctl0-only';ctl.oninput();
await selectorMap.get('.confirm-runtime').onclick();
assert.deepEqual(controlArgs,['ctl0-only']);
assert.equal(issued,0);
showKpmControlDialog({moduleName:'Nohello',mode:'runtime',embedAvailable:true,
    event:'pre-kernel-init',embedArgs:'boot-only'});
selectorMap.get('#kpm-event-select').value='post-kernel-init';
selectorMap.get('#kpm-args-input').value='embed-only';
selectorMap.get('.confirm-embed').onclick();
assert.equal(issued,1);
assert.deepEqual(getQueuedBootOptions('Nohello'),{event:'post-kernel-init',args:'embed-only'});
assert.deepEqual(controlArgs,['ctl0-only'],'embed save must not execute ctl0');

let saved;
showKpmControlDialog({moduleName:'Nohello',mode:'embed',event:'paging-init',embedArgs:'x',
    onEmbed:(event,args)=>{saved={event,args}}});
assert.equal(selectorMap.get('#kpm-runtime-section').hidden,true);
assert.equal(selectorMap.get('.confirm-runtime').hidden,true);
selectorMap.get('.confirm-embed').onclick();
assert.deepEqual(saved,{event:'paging-init',args:'x'});
assert.equal(shown,3);
assert.equal(closed,3);

const listeners = new Map(), winListeners = new Map();
let keyboardVisible=false,occlusion='';
const fakeInput={matches:(s)=>s.includes('input'),closest:()=>null};
const classes={toggle:(name,enabled)=>{if(name==='kp-ime-visible')keyboardVisible=enabled}};
const vv={height:800,offsetTop:0,addEventListener:(evt,fn)=>listeners.set(evt,fn)};
globalThis.window={
    innerHeight:800,innerWidth:393,visualViewport:vv,
    addEventListener:(evt,fn)=>winListeners.set(evt,fn)
};
globalThis.document={
    documentElement:{classList:classes,style:{setProperty:(name,value)=>{if(name==='--kp-ime-occlusion')occlusion=value}}},
    activeElement:null,addEventListener:(evt,fn)=>listeners.set(evt,fn),
};
globalThis.requestAnimationFrame=cb=>cb();
installImeViewportGuard();
assert.equal(keyboardVisible,false);
document.activeElement=fakeInput;
listeners.get('focusin')({target:fakeInput,composedPath:()=>[fakeInput]});
vv.height=500;
listeners.get('resize')();
assert.equal(keyboardVisible,true,'IME must be detected on visual viewport shrink');
assert.equal(occlusion,'300px');
vv.height=800;listeners.get('resize')();
assert.equal(keyboardVisible,false,'navigation must return when keyboard closes');

const html=read('../index.html');
const patch=read('../page/patch.js');
const kpm=read('../page/kpm.js');
const css=read('../styles.css');
assert.ok(html.includes('id="kpm-ctl0-input"') && html.includes('id="kpm-event-select"'));
assert.ok(!html.includes('id="kpm-option-dialog"'),'duplicate modal must be removed');
assert.ok(!patch.includes("getElementById('kpm-option-dialog')"));
assert.ok(patch.includes('getQueuedBootOptions(extra.name)'));
assert.ok(kpm.includes('embedAvailable: isEmbeddedModule(module)'));
assert.ok(css.includes('html.kp-ime-visible .bottom-bar'));
console.log('Unified KPM control + IME guard: PASS');
