import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData, applyAction, validateData, weeklyProgress, weeklyHistory, dayProgress, streaks, activityProgress} from '../public/model.js';
import {routineStatistics, weeklyStatistics} from '../public/statistics.js';
const start='2026-09-07', today='2026-09-20';
const version={name:'Move',icon:'activity',color:'green',days:[0,1,2,3,4,5,6],frequency:'weekly',weeklyTarget:3,tasks:[{id:'a',title:'Walk'},{id:'b',title:'Stretch'}]};
const create=(v=version)=>applyAction(emptyData(),{type:'save-routine',id:'move',version:v},start);
const check=(d,day,taskId,done=true)=>applyAction(d,{type:'check',routineId:'move',day,taskId,done},today);
function finish(d,day){return check(check(d,day,'a'),day,'b');}
test('weekly goals count complete days once, allow any weekday and undo',()=>{
 let d=create(); d=check(d,start,'a'); assert.equal(weeklyProgress(d,d.routines[0],start).done,0);
 for(const day of ['2026-09-07','2026-09-10','2026-09-13'])d=finish(d,day);
 d=finish(d,start);assert.deepEqual(weeklyProgress(d,d.routines[0],start),{from:start,to:'2026-09-13',done:3,target:3,complete:true});
 d=check(d,start,'b',false);assert.equal(weeklyProgress(d,d.routines[0],start).complete,false);
 assert.equal(weeklyProgress(d,d.routines[0],'2026-09-14').done,0);
});
test('weekly goals never become seven daily obligations or break daily streaks',()=>{
 let d=create();d=applyAction(d,{type:'save-routine',id:'daily',version:{...version,frequency:'daily',days:[1],tasks:[{id:'x',title:'Read'}]}},start);
 d=applyAction(d,{type:'check',day:start,routineId:'daily',taskId:'x',done:true},today);
 assert.equal(dayProgress(d,start).total,1);assert.equal(streaks(d,'2026-09-09').current,1);
 assert.equal(routineStatistics(d,'2026-09-13','all').scheduled,1);
 assert.equal(routineStatistics(d,today,'all','move').scheduled,0);
 d=finish(d,'2026-09-08');assert.equal(activityProgress(d,'2026-09-08').done,2);
});
test('weekly streak remains open this week, breaks after a missed week; period includes whole overlapping weeks',()=>{
 let d=create();for(const day of ['2026-09-07','2026-09-09','2026-09-11'])d=finish(d,day);
 assert.equal(weeklyHistory(d,d.routines[0],'2026-09-20').current,1);
 assert.equal(weeklyHistory(d,d.routines[0],'2026-09-21').current,0);
 const s=weeklyStatistics(d,'2026-09-13','7')[0];assert.equal(s.completedWeeks,1);assert.equal(s.completions,3);
});
test('midweek edits preserve this week target, next week uses new target',()=>{
 let d=create();d=applyAction(d,{type:'save-routine',id:'move',expectedVersion:JSON.stringify(d.routines[0].versions[0]),version:{...version,weeklyTarget:5}},'2026-09-10');
 assert.equal(weeklyProgress(d,d.routines[0],'2026-09-11').target,3);assert.equal(weeklyProgress(d,d.routines[0],'2026-09-14').target,5);
 for(const target of [0,8,1.5,'3'])assert.throws(()=>create({...version,weeklyTarget:target}));
 assert.throws(()=>check(d,'2026-09-21','a'),/Future/);
});
test('old backups gain notes without losing history; new backups roundtrip both features',()=>{
 const old=emptyData();delete old.notes;assert.deepEqual(validateData(old).notes,[]);
 const d=applyAction(create(),{type:'save-note',id:'n',expectedRevision:0,title:'Idea',body:'Line one\n<script>plain text</script>'},start);
 assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))),d);
 assert.equal(d.routines[0].versions[0].weeklyTarget,3);
});
test('notes have conflict protection and reversible archive',()=>{
 let d=applyAction(emptyData(),{type:'save-note',id:'n',expectedRevision:0,title:'Plan',body:'First'},start);
 d=applyAction(d,{type:'save-note',id:'n',expectedRevision:1,title:'Plan',body:'Second'},start);
 assert.throws(()=>applyAction(d,{type:'save-note',id:'n',expectedRevision:1,title:'Plan',body:'Lost update'},start),/another device/);
 d=applyAction(d,{type:'archive-note',id:'n',expectedRevision:2,archived:true},start);assert.equal(d.notes[0].body,'Second');
 d=applyAction(d,{type:'archive-note',id:'n',expectedRevision:3,archived:false},start);assert.equal(d.notes[0].archived,false);
 assert.throws(()=>applyAction(d,{type:'save-note',id:'n',expectedRevision:4,title:'',body:'x'},start));
 assert.throws(()=>applyAction(d,{type:'save-note',id:'n',expectedRevision:4,title:'a',body:'x'.repeat(20001)},start));
});
