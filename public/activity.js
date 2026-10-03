import {activityProgress, parseDate, shiftDate, validDate, weekday} from './model.js';

// Week columns start on Monday. Colors represent the fraction of scheduled steps completed.
export function activityLevel(progress) {
    if (!progress.total || !progress.done) return 0;
    if (progress.complete) return 4;
    return Math.min(3, Math.max(1, Math.ceil(progress.done / progress.total * 3)));
}

export function activityRange(data, from, to, today) {
    if (!validDate(from) || !validDate(to) || from > to) throw new Error('Invalid activity range.');
    const start = shiftDate(from, -((weekday(from) + 6) % 7));
    const end = shiftDate(to, 6 - ((weekday(to) + 6) % 7));
    const days = [];
    let completedTasks = 0, activeDays = 0, perfectDays = 0;
    for (let day = start; day <= end; day = shiftDate(day, 1)) {
        const inRange = day >= from && day <= to;
        const future = day > today;
        const progress = inRange ? activityProgress(data, day) : {done: 0, total: 0, complete: false, routines: 0};
        if (inRange && !future) {
            completedTasks += progress.done;
            if (progress.done) activeDays++;
            if (progress.complete) perfectDays++;
        }
        days.push({day, inRange, future, progress, level: future ? 0 : activityLevel(progress)});
    }
    const months = [];
    for (let column = 0; column < days.length / 7; column++) {
        const week = days.slice(column * 7, column * 7 + 7);
        const first = week.find(d => d.inRange && (d.day.endsWith('-01') || d.day === from));
        if (first) months.push({
            column,
            label: new Intl.DateTimeFormat('en', {month: 'short', timeZone: 'UTC'}).format(parseDate(first.day))
        });
    }
    return {days, months, columns: days.length / 7, completedTasks, activeDays, perfectDays};
}
