export const SCHEMA = 1;
export const ICONS = ['sun', 'moon', 'leaf', 'book', 'activity', 'coffee', 'heart', 'target'];
export const COLORS = ['orange', 'green', 'blue', 'purple'];
export const emptyData = (timezone = 'Europe/Bratislava') => ({schema: SCHEMA, timezone, routines: [], checks: {}, notes: []});

export function dateKey(date = new Date(), timezone) {
    if (timezone) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(date);
        return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k).value).join('-');
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const parseDate = key => new Date(`${key}T12:00:00Z`);

export function shiftDate(key, days) {
    const d = parseDate(key);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export const weekday = key => parseDate(key).getUTCDay();

export function validDate(key) {
    return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(+parseDate(key)) && parseDate(key).toISOString().slice(0, 10) === key;
}

export const revisionAt = (r, day) => r.versions.filter(v => v.from <= day).at(-1);
export const isWeekly = v => v?.frequency === 'weekly';
export const isScheduled = (r, day) => day >= r.createdOn && (!r.archivedOn || day < r.archivedOn) && !!revisionAt(r, day) && (isWeekly(revisionAt(r, day)) || revisionAt(r, day).days.includes(weekday(day)));
export const weekStart = day => shiftDate(day, -((weekday(day) + 6) % 7));

// A weekly target is fixed by the first active weekly revision in that week.
export function weeklyProgress(data, r, day) {
    const from = weekStart(day), to = shiftDate(from, 6);
    let done = 0, target = 0;
    for (let d = from; d <= to; d = shiftDate(d, 1)) {
        if (!isScheduled(r, d) || !isWeekly(revisionAt(r, d))) continue;
        target ||= revisionAt(r, d).weeklyTarget;
        if (routineProgress(data, r, d).complete) done++;
    }
    return {from, to, done, target, complete: target > 0 && done >= target};
}

export function weeklyHistory(data, r, today, from = r.createdOn) {
    const weeks = [];
    for (let d = weekStart(from); d <= today; d = shiftDate(d, 7)) {
        const p = weeklyProgress(data, r, d);
        if (p.target) weeks.push(p);
    }
    let current = 0, best = 0;
    for (const w of weeks) {
        if (w.complete) { current++; best = Math.max(best, current); }
        else if (w.to < today) current = 0;
    }
    return {weeks, current, best};
}
export const checkKey = (rid, tid) => `${rid}:${tid}`;
export const taskDone = (data, day, rid, tid) => data.checks[day]?.[checkKey(rid, tid)] === true;

export function routineProgress(data, r, day) {
    if (!isScheduled(r, day)) return {done: 0, total: 0, complete: false};
    const tasks = revisionAt(r, day).tasks;
    const done = tasks.filter(t => taskDone(data, day, r.id, t.id)).length;
    return {done, total: tasks.length, complete: tasks.length > 0 && done === tasks.length};
}

export function dayProgress(data, day, onlyId) {
    const rs = data.routines.filter(r => (!onlyId || r.id === onlyId) && isScheduled(r, day) && !isWeekly(revisionAt(r, day)));
    const results = rs.map(r => routineProgress(data, r, day));
    return {
        done: results.reduce((s, r) => s + r.done, 0),
        total: results.reduce((s, r) => s + r.total, 0),
        routines: rs.length,
        complete: results.length > 0 && results.every(r => r.complete)
    };
}

export function activityProgress(data, day) {
    const daily = dayProgress(data, day);
    const extra = data.routines.filter(r => isWeekly(revisionAt(r, day))).map(r => routineProgress(data, r, day)).filter(p => p.done > 0);
    return {...daily, done: daily.done + extra.reduce((n,p) => n + p.done, 0), total: daily.total + extra.reduce((n,p) => n + p.total, 0), routines: daily.routines + extra.length,
        complete: (daily.routines > 0 || extra.length > 0) && (!daily.routines || daily.complete) && extra.every(p => p.complete)};
}

export function streaks(data, today, onlyId) {
    const rs = data.routines.filter(r => !onlyId || r.id === onlyId);
    const start = rs.map(r => r.createdOn).sort()[0];
    if (!start || start > today) return {current: 0, best: 0, completedDays: 0};
    let run = 0, best = 0, completedDays = 0;
    for (let day = start; day <= today; day = shiftDate(day, 1)) {
        const p = dayProgress(data, day, onlyId);
        if (!p.total) continue;
        if (p.complete) {
            run++;
            completedDays++;
            best = Math.max(best, run);
        } else if (day !== today) run = 0;
    }
    return {current: run, best, completedDays};
}

function ensure(ok, message) {
    if (!ok) throw new Error(message);
}

const idValid = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);

function validVersion(v) {
    ensure(v && validDate(v.from), 'Invalid routine date.');
    ensure(typeof v.name === 'string' && v.name.trim().length > 0 && v.name.length <= 60, 'Give your routine a name (up to 60 characters).');
    ensure(ICONS.includes(v.icon) && COLORS.includes(v.color), 'Choose a valid icon and color.');
    ensure(Array.isArray(v.days) && v.days.length > 0 && v.days.length <= 7 && new Set(v.days).size === v.days.length && v.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6), 'Choose at least one day.');
    ensure(v.frequency === undefined || v.frequency === 'daily' || v.frequency === 'weekly', 'Choose a valid repeat mode.');
    if (isWeekly(v)) ensure(Number.isInteger(v.weeklyTarget) && v.weeklyTarget >= 1 && v.weeklyTarget <= 7, 'Choose between 1 and 7 times per week.');
    ensure(Array.isArray(v.tasks) && v.tasks.length > 0 && v.tasks.length <= 20, 'Add between 1 and 20 steps.');
    ensure(new Set(v.tasks.map(t => t.id)).size === v.tasks.length && v.tasks.every(t => idValid(t.id) && typeof t.title === 'string' && t.title.trim().length > 0 && t.title.length <= 120), 'Each step needs a unique ID and a title (up to 120 characters).');
}

export function validateData(input, today = '9999-12-31') {
    ensure(input && input.schema === SCHEMA, 'This is not a supported Ember backup.');
    try {
        new Intl.DateTimeFormat('en', {timeZone: input.timezone}).format();
    } catch {
        throw new Error('Invalid time zone.');
    }
    ensure(typeof input.timezone === 'string', 'Invalid time zone.');
    ensure(Array.isArray(input.routines) && input.routines.length <= 100, 'A backup can contain up to 100 routines.');
    const ids = new Set();
    for (const r of input.routines) {
        ensure(idValid(r.id) && !ids.has(r.id), 'Invalid or duplicate routine ID.');
        ids.add(r.id);
        ensure(validDate(r.createdOn) && r.createdOn >= '2000-01-01' && r.createdOn <= today, 'Invalid routine start date.');
        ensure(r.archivedOn === null || (validDate(r.archivedOn) && r.archivedOn >= r.createdOn && r.archivedOn <= today), 'Invalid archive date.');
        ensure(Array.isArray(r.versions) && r.versions.length > 0 && r.versions.length <= 10000, 'Invalid routine history.');
        let prev = '';
        for (const v of r.versions) {
            validVersion(v);
            ensure(v.from > prev && v.from >= r.createdOn && v.from <= today, 'Invalid routine history order.');
            prev = v.from;
        }
        ensure(r.versions[0].from === r.createdOn, 'Missing initial routine version.');
    }
    ensure(input.checks && typeof input.checks === 'object' && !Array.isArray(input.checks), 'Invalid completion history.');
    for (const [day, checks] of Object.entries(input.checks)) {
        ensure(validDate(day) && day >= '2000-01-01' && day <= today, 'Invalid completion date.');
        ensure(checks && typeof checks === 'object' && !Array.isArray(checks), 'Invalid daily completions.');
        for (const [key, value] of Object.entries(checks)) {
            const [rid, tid, ...extra] = key.split(':');
            ensure(idValid(rid) && idValid(tid) && !extra.length && ids.has(rid) && value === true, 'Invalid step completion.');
            const r = input.routines.find(r => r.id === rid);
            ensure(r.versions.some(v => v.tasks.some(t => t.id === tid)), 'Unknown step in history.');
        }
    }
    const notes = input.notes ?? [];
    ensure(Array.isArray(notes) && notes.length <= 500, 'You can keep up to 500 notes, including archived notes.');
    const noteIds = new Set();
    for (const note of notes) {
        ensure(idValid(note.id) && !noteIds.has(note.id), 'Invalid or duplicate note ID.');
        noteIds.add(note.id);
        ensure(typeof note.title === 'string' && note.title.trim().length > 0 && note.title.length <= 120, 'Give your note a title (up to 120 characters).');
        ensure(typeof note.body === 'string' && note.body.length <= 20000, 'Notes can contain up to 20,000 characters.');
        ensure(validDate(note.createdOn) && validDate(note.updatedOn) && note.createdOn <= note.updatedOn && note.updatedOn <= today, 'Invalid note date.');
        ensure(Number.isInteger(note.revision) && note.revision > 0 && typeof note.archived === 'boolean', 'Invalid note revision.');
    }
    const result = {
        schema: SCHEMA,
        timezone: input.timezone,
        routines: input.routines.map(r => ({
            id: r.id,
            createdOn: r.createdOn,
            archivedOn: r.archivedOn,
            versions: r.versions.map(v => ({
                from: v.from,
                name: v.name.trim(),
                icon: v.icon,
                color: v.color,
                days: [...v.days],
                ...(v.frequency ? {frequency: v.frequency} : {}),
                ...(isWeekly(v) ? {weeklyTarget: v.weeklyTarget} : {}),
                tasks: v.tasks.map(t => ({id: t.id, title: t.title.trim()}))
            }))
        })),
        checks: JSON.parse(JSON.stringify(input.checks)),
        notes: notes.map(n => ({id: n.id, title: n.title.trim(), body: n.body, createdOn: n.createdOn, updatedOn: n.updatedOn, revision: n.revision, archived: n.archived}))
    };
    ensure(JSON.stringify(result).length <= 2000000, 'Your backup exceeds the 2 MB limit.');
    return result;
}

export function applyAction(data, action, today) {
    ensure(action && typeof action === 'object', 'Invalid action.');
    if (action.type === 'import') return validateData(action.data, today);
    const next = structuredClone(data);
    if (action.type === 'save-note' || action.type === 'archive-note') {
        ensure(idValid(action.id), 'Invalid note ID.');
        next.notes ??= [];
        const note = next.notes.find(n => n.id === action.id);
        ensure(note ? action.expectedRevision === note.revision : action.expectedRevision === 0, 'This note changed on another device. Reopen it before saving.');
        if (action.type === 'archive-note') {
            ensure(note && typeof action.archived === 'boolean', 'Note not found.');
            note.archived = action.archived;
            note.updatedOn = today;
            note.revision++;
        } else {
            ensure(!note?.archived, 'Restore this note before editing.');
            const value = {id: action.id, title: action.title, body: action.body, createdOn: note?.createdOn || today, updatedOn: today, revision: (note?.revision || 0) + 1, archived: false};
            if (note) Object.assign(note, value); else next.notes.push(value);
        }
    } else if (action.type === 'check') {
        ensure(validDate(action.day) && action.day <= today, 'Future days cannot be completed.');
        const r = next.routines.find(r => r.id === action.routineId);
        ensure(r && isScheduled(r, action.day), 'This routine is not scheduled for that day.');
        ensure(revisionAt(r, action.day).tasks.some(t => t.id === action.taskId) && typeof action.done === 'boolean', 'Invalid step.');
        next.checks[action.day] ??= {};
        const key = checkKey(r.id, action.taskId);
        if (action.done) next.checks[action.day][key] = true; else delete next.checks[action.day][key];
        if (!Object.keys(next.checks[action.day]).length) delete next.checks[action.day];
    } else if (action.type === 'save-routine') {
        ensure(idValid(action.id), 'Invalid routine ID.');
        const v = {...action.version, from: today};
        validVersion(v);
        const r = next.routines.find(r => r.id === action.id);
        if (r) {
            ensure(!r.archivedOn, 'This routine is archived.');
            ensure(action.expectedVersion === JSON.stringify(r.versions.at(-1)), 'This routine changed on another device. Close the editor, refresh, and try again.');
            r.versions = r.versions.filter(v => v.from !== today);
            r.versions.push(v);
            // Retain removed task IDs in older revisions; same-day removed checks are no longer meaningful.
            if (next.checks[today]) for (const key of Object.keys(next.checks[today])) if (key.startsWith(r.id + ':') && !v.tasks.some(t => checkKey(r.id, t.id) === key)) delete next.checks[today][key];
        } else {
            ensure(action.expectedVersion === undefined, 'This routine was deleted on another device. Close the editor and refresh.');
            ensure(next.routines.length < 100, 'You can keep up to 100 routines, including archived ones.');
            next.routines.push({id: action.id, createdOn: today, archivedOn: null, versions: [v]});
        }
    } else if (action.type === 'delete-routine') {
        ensure(idValid(action.id), 'Invalid routine ID.');
        const r = next.routines.find(r => r.id === action.id);
        if (r) {
            ensure(action.expectedVersion === JSON.stringify(r.versions.at(-1)), 'This routine changed on another device. Reopen the deletion dialog.');
            next.routines = next.routines.filter(r => r.id !== action.id);
            for (const [day, checks] of Object.entries(next.checks)) {
                for (const key of Object.keys(checks)) if (key.startsWith(action.id + ':')) delete checks[key];
                if (!Object.keys(checks).length) delete next.checks[day];
            }
        }
    } else if (action.type === 'archive') {
        const r = next.routines.find(r => r.id === action.id);
        ensure(r, 'Routine not found.');
        if (!r.archivedOn) r.archivedOn = today;
    } else throw new Error('Unknown action.');
    return validateData(next, today);
}
