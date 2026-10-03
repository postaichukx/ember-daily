import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,applyAction} from '../public/model.js';
import {routineStatistics,completionBuckets} from '../public/statistics.js';
const start='2026-09-07',today='2026-09-15';
function routine(data,id,days=[0,1,2,3,4,5,6],created=start,tasks=['a']){
 return applyAction(data,{type:'save-routine',id,version:{name:id,icon:'sun',color:'orange',days,tasks:tasks.map(id=>({id,title:id}))}},created);
}
function done(data,day,id,taskId='a'){return applyAction(data,{type:'check',day,routineId:id,taskId,done:true},today);}
test('statistics count fully completed routines, not steps; today is pending not missed',()=>{
 let d=routine(routine(emptyData(),'one'),'two',[0,1,2,3,4,5,6],start,['a','b']);
 d=done(done(d,today,'one'),today,'two');
 const s=routineStatistics(d,today,'7');
 assert.equal(s.scheduled,14);assert.equal(s.completed,1);assert.equal(s.percent,7);
 assert.equal(s.missed,12);assert.equal(s.pending,1);assert.equal(s.perfectDays,0);
 d=done(d,today,'two','b');assert.equal(routineStatistics(d,today,'7').completed,2);
});
test('rest days and dates before creation are excluded',()=>{
 let d=routine(emptyData(),'weekdays',[1,2,3,4,5],'2026-09-11');d=done(d,'2026-09-11','weekdays');
 const s=routineStatistics(d,today,'28');
 assert.equal(s.activeDays,3);assert.equal(s.scheduled,3);assert.equal(s.completed,1);assert.equal(s.average,1/3);assert.equal(s.missed,1);assert.equal(s.pending,1);
});
test('historical schedules and archived routines still count on their actual days',()=>{
 let d=routine(emptyData(),'r');
 d=applyAction(d,{type:'save-routine',id:'r',expectedVersion:JSON.stringify(d.routines[0].versions.at(-1)),version:{name:'r',icon:'sun',color:'orange',days:[1],tasks:[{id:'a',title:'a'}]}},'2026-09-10');
 d=applyAction(d,{type:'archive',id:'r'},'2026-09-14');
 assert.equal(routineStatistics(d,today,'all').scheduled,3);
 assert.equal(routineStatistics(d,today,'all','r').scheduled,3);
});
test('current streak can cross the filter boundary, period best cannot',()=>{
 let d=routine(emptyData(),'r');for(let i=7;i<=15;i++)d=done(d,`2026-09-${String(i).padStart(2,'0')}`,'r');
 const s=routineStatistics(d,today,'7');assert.equal(s.current,9);assert.equal(s.best,7);assert.equal(s.completed,7);assert.equal(s.perfectDays,7);assert.equal(s.percent,100);
});
test('routine filter changes denominator and respects independent streaks',()=>{
 let d=routine(routine(emptyData(),'one'),'two');d=done(d,today,'one');
 assert.equal(routineStatistics(d,today,'7','one').scheduled,7);
 assert.equal(routineStatistics(d,today,'7','one').completed,1);
 assert.equal(routineStatistics(d,today,'7','two').completed,0);
});
test('empty and entirely resting ranges have no fake percent or non-finite numbers',()=>{
 for(const d of [emptyData(),routine(emptyData(),'r',[0],today)]){
  const s=routineStatistics(d,today);assert.equal(s.percent,null);assert.equal(s.average,0);assert.equal(s.completed,0);
 }
});
test('undo is reflected immediately in statistics',()=>{
 let d=done(routine(emptyData(),'r'),today,'r');assert.equal(routineStatistics(d,today).completed,1);
 d=applyAction(d,{type:'check',day:today,routineId:'r',taskId:'a',done:false},today);
 assert.equal(routineStatistics(d,today).completed,0);assert.equal(routineStatistics(d,today).pending,1);
});
test('buckets cover each date exactly once, conserve counts, and include final day',()=>{
 const days=Array.from({length:90},(_,i)=>({day:String(i),completed:i%3,scheduled:3}));
 const bs=completionBuckets(days);assert.ok(bs.length<=14);assert.equal(bs[0].from,'0');assert.equal(bs.at(-1).to,'89');
 assert.equal(bs.reduce((s,b)=>s+b.completed,0),days.reduce((s,d)=>s+d.completed,0));assert.equal(bs.reduce((s,b)=>s+b.scheduled,0),270);assert.deepEqual(completionBuckets([]),[]);
});
