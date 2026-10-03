import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,applyAction,validateData,dayProgress} from '../public/model.js';
const day='2026-10-04';
function seed(){let d=emptyData();for(const id of ['r','r-long']){d=applyAction(d,{type:'save-routine',id,version:{name:id,icon:'sun',color:'orange',days:[0,1,2,3,4,5,6],tasks:[{id:'s',title:'Step'}]}},day);d=applyAction(d,{type:'check',routineId:id,taskId:'s',day,done:true},day);}return d;}
const remove=(d,id)=>applyAction(d,{type:'delete-routine',id,expectedVersion:JSON.stringify(d.routines.find(r=>r.id===id)?.versions.at(-1))},day);
test('deleting removes only the chosen routine and all its checks; stats and backups remain valid',()=>{let d=seed();d=remove(d,'r');assert.equal(d.routines.length,1);assert.deepEqual(d.checks[day],{'r-long:s':true});assert.equal(dayProgress(d,day).done,1);assert.deepEqual(validateData(d),d);d=remove(d,'r-long');assert.deepEqual(d.checks,{});assert.equal(dayProgress(d,day).done,0);assert.deepEqual(remove(d,'r-long'),d);});
test('archived routines can be deleted; stale deletion does not remove an edited routine',()=>{let d=seed();assert.throws(()=>applyAction(d,{type:'delete-routine',id:'r',expectedVersion:'stale'},day),/another device/);d=applyAction(d,{type:'archive',id:'r'},day);d=remove(d,'r');assert.equal(d.routines.some(r=>r.id==='r'),false);});

test('a stale editor cannot recreate a routine deleted on another device',()=>{const d=seed(),r=d.routines[0],v=r.versions.at(-1);assert.throws(()=>applyAction(remove(d,r.id),{type:'save-routine',id:r.id,expectedVersion:JSON.stringify(v),version:v},day),/deleted on another device/);});
