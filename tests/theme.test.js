import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/theme.js',import.meta.url),'utf8');
function setup(saved,blocked=false){
 const listeners={},root={dataset:{}},meta={},buttons=['dark','light'].map(theme=>({dataset:{themeChoice:theme},setAttribute(k,v){this[k]=v;}}));
 const storage=new Map([['ember-appearance',saved]]);
 const window={addEventListener:(key,fn)=>listeners[key]=fn};
 vm.runInNewContext(source,{window,document:{documentElement:root,querySelector:()=>({setAttribute:(k,v)=>meta[k]=v}),querySelectorAll:()=>buttons},localStorage:{getItem(k){if(blocked)throw Error();return storage.get(k);},setItem(k,v){if(blocked)throw Error();storage.set(k,v);}}});
 return {window,root,meta,buttons,storage,listeners};
}
test('Theme restores before rendering and updates browser color and accessible selection',()=>{const t=setup('light');assert.equal(t.root.dataset.theme,'light');assert.equal(t.meta.content,'#f8f6f2');assert.equal(t.buttons[1]['aria-pressed'],'true');t.window.EmberTheme.set('dark');assert.equal(t.storage.get('ember-appearance'),'dark');assert.equal(t.buttons[0]['aria-pressed'],'true');});
test('Unavailable storage and invalid values do not prevent using Ember',()=>{const t=setup('wrong',true);assert.equal(t.root.dataset.theme,'dark');t.window.EmberTheme.set('light');assert.equal(t.root.dataset.theme,'light');});
test('Appearance synchronizes across tabs, including resetting storage',()=>{const t=setup('dark');t.listeners.storage({key:'ember-appearance',newValue:'light'});assert.equal(t.root.dataset.theme,'light');t.listeners.storage({key:null,newValue:null});assert.equal(t.root.dataset.theme,'dark');});
