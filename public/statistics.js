import {isScheduled, isWeekly, revisionAt, weeklyHistory, routineProgress, shiftDate, streaks} from './model.js';

export const PERIODS = [{value: '7', label: 'Last 7 days'}, {value: '28', label: 'Last 28 days'}, {
    value: '90',
    label: 'Last 90 days'
}, {value: 'all', label: 'All time'}];

// Count routine occurrences, not individual steps. Today remains open until midnight.
export function routineStatistics(data, today, period = '28', routineId = 'all') {
    const routines = data.routines.filter(r => routineId === 'all' || r.id === routineId);
    const first = routines.map(r => r.createdOn).sort()[0] || today;
    const requested = period === 'all' ? first : shiftDate(today, 1 - Number(PERIODS.find(p => p.value === period)?.value || 28));
    const from = requested > first ? requested : first;
    const days = [];
    let completed = 0, scheduled = 0, missed = 0, pending = 0, activeDays = 0, perfectDays = 0, run = 0, best = 0;
    for (let day = from; day <= today; day = shiftDate(day, 1)) {
        const planned = routines.filter(r => isScheduled(r, day) && !isWeekly(revisionAt(r, day)));
        const done = planned.filter(r => routineProgress(data, r, day).complete).length;
        days.push({day, completed: done, scheduled: planned.length});
        scheduled += planned.length;
        completed += done;
        if (day === today) pending += planned.length - done; else missed += planned.length - done;
        if (planned.length) {
            activeDays++;
            if (done === planned.length) {
                perfectDays++;
                run++;
                best = Math.max(best, run);
            } else if (day !== today) run = 0;
        }
    }
    const current = streaks(data, today, routineId === 'all' ? undefined : routineId).current;
    return {
        from, to: today, completed, scheduled, missed, pending, activeDays, perfectDays, current, best,
        percent: scheduled ? Math.round(completed / scheduled * 100) : null,
        average: activeDays ? completed / activeDays : 0, days
    };
}

// At most 14 evenly spaced groups, including the final day; no invented points.
export function completionBuckets(days, maxBars = 14) {
    const size = Math.max(1, Math.ceil(days.length / maxBars)), buckets = [];
    for (let i = 0; i < days.length; i += size) {
        const group = days.slice(i, i + size);
        buckets.push({
            from: group[0].day,
            to: group.at(-1).day,
            completed: group.reduce((s, d) => s + d.completed, 0),
            scheduled: group.reduce((s, d) => s + d.scheduled, 0)
        });
    }
    return buckets;
}

// Weekly goals are evaluated over whole Monday–Sunday weeks that overlap the filter.
export function weeklyStatistics(data, today, period = '28', routineId = 'all') {
    const from = period === 'all' ? null : shiftDate(today, 1 - Number(PERIODS.find(p => p.value === period)?.value || 28));
    return data.routines.filter(r => (routineId === 'all' || r.id === routineId) && r.versions.some(isWeekly)).map(r => {
        const all = weeklyHistory(data, r, today);
        const weeks = all.weeks.filter(w => !from || w.to >= from);
        return {id: r.id, name: r.versions.at(-1).name, ...all, weeks,
            completedWeeks: weeks.filter(w => w.complete).length,
            missedWeeks: weeks.filter(w => !w.complete && w.to < today).length,
            completions: weeks.reduce((n, w) => n + w.done, 0)};
    });
}
