import test from 'node:test';
import assert from 'node:assert/strict';
import {activityLevel,activityRange} from '../public/activity.js';
import {emptyData,applyAction,weekday} from '../public/model.js';

test('Calendar includes each year day exactly once in Monday-first week columns',()=>{
 const grid=activityRange(emptyData(),'2026-01-01','2026-12-31','2026-09-12');
 const days=grid.days.filter(d=>d.inRange);
 assert.equal(days.length,365);assert.equal(new Set(days.map(d=>d.day)).size,365);
 assert.equal(weekday(grid.days[0].day),1);assert.equal(weekday(grid.days.at(-1).day),0);
 assert.equal(grid.days.length%7,0);assert.equal(grid.months.length,12);
 assert.equal(grid.months[0].label,'Jan');assert.equal(grid.months.at(-1).label,'Dec');
});
test('Leap-day appears and 54-column leap years retain every day',()=>{
 const grid=activityRange(emptyData(),'2012-01-01','2012-12-31','2026-09-12');
 assert.equal(grid.days.filter(d=>d.inRange).length,366);assert.equal(grid.columns,54);
 assert.equal(grid.days.filter(d=>d.day==='2012-02-29').length,1);
});
test('Color levels distinguish empty, partial and fully completed days',()=>{
 assert.equal(activityLevel({done:0,total:0,complete:false}),0);
 assert.equal(activityLevel({done:1,total:10,complete:false}),1);
 assert.equal(activityLevel({done:5,total:10,complete:false}),2);
 assert.equal(activityLevel({done:9,total:10,complete:false}),3);
 assert.equal(activityLevel({done:10,total:10,complete:true}),4);
});
test('Activity summaries count only actual completions inside the displayed period',()=>{
 let data=applyAction(emptyData(),{type:'save-routine',id:'r',version:{name:'Routine',icon:'sun',color:'orange',days:[0,1,2,3,4,5,6],tasks:[{id:'a',title:'A'},{id:'b',title:'B'}]}},'2025-12-31');
 for(const [day,ids] of [['2025-12-31',['a','b']],['2026-01-01',['a']],['2026-01-02',['a','b']]])for(const taskId of ids)data=applyAction(data,{type:'check',routineId:'r',taskId,day,done:true},'2026-01-02');
 const before=JSON.stringify(data),grid=activityRange(data,'2026-01-01','2026-12-31','2026-01-02');
 assert.equal(grid.completedTasks,3);assert.equal(grid.activeDays,2);assert.equal(grid.perfectDays,1);
 assert.equal(grid.days.find(d=>d.day==='2026-01-03').future,true);assert.equal(grid.days.find(d=>d.day==='2026-01-03').level,0);
 assert.equal(JSON.stringify(data),before);
});
test('A 12-week sidebar range contains 84 cells, including a year boundary',()=>{
 const grid=activityRange(emptyData(),'2025-10-20','2026-01-11','2026-01-08');
 assert.equal(grid.columns,12);assert.equal(grid.days.length,84);assert.equal(grid.days[0].day,'2025-10-20');assert.equal(grid.days.at(-1).day,'2026-01-11');
});
test('Malformed date ranges fail instead of producing misleading calendars',()=>{
 assert.throws(()=>activityRange(emptyData(),'2026-02-31','2026-03-01','2026-09-12'));
 assert.throws(()=>activityRange(emptyData(),'2026-12-31','2026-01-01','2026-09-12'));
});
