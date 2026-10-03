import {
 COLORS,
 dateKey,
 dayProgress,
 activityProgress,
 emptyData,
 ICONS,
 isScheduled,
 isWeekly,
 weeklyProgress,
 parseDate,
 revisionAt,
 routineProgress,
 shiftDate,
 streaks,
 taskDone,
 validateData,
 weekday
} from './model.js';
import {renderNotes, noteEditor} from './notes-view.js';
import {renderStatistics} from './statistics-view.js';
import {activityRange} from './activity.js';
import {createAuthUI} from './auth-ui.js';
import {createAPIClient} from './network.js';

const api = createAPIClient(), request = api.request;
const paths = {
    flame: 'M13 2c1 6-5 7-3 12 1-2 2-3 4-5 1 3 5 4 4 8-1 7-13 7-14-1-1-5 5-9 9-14Z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
    moon: 'M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z',
    leaf: 'M20 3C8 2 3 7 5 15s15 7 15-12ZM5 21 16 9',
    book: 'M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Zm0 0v15',
    activity: 'M2 12h5l3-9 4 18 3-9h5',
    coffee: 'M4 8h12v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8Zm12 1h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3M2 22h17',
    heart: 'M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 3 10 8 15 5-5 13-10 8-15Z',
    target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    today: 'M8 2v4m8-4v4M4 9h16M5 4h14a1 1 0 0 1 1 1v15H4V5a1 1 0 0 1 1-1ZM8 14l3 3 5-5',
    calendar: 'M8 2v4m8-4v4M4 9h16M5 4h14a1 1 0 0 1 1 1v15H4V5a1 1 0 0 1 1-1ZM8 13h1m6 0h1m-8 4h1m6 0h1',
    routines: 'M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01',
    notes: 'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h5',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 2h6l1 3 3 1 3 5-2 2 0 3-4 4-3-1-3 1-5-3v-3L2 11l2-5 3-1Z',
    plus: 'M12 5v14M5 12h14',
    check: 'm5 12 4 4L19 6',
    chevron: 'm9 5 7 7-7 7',
    arrow: 'M19 12H5m7-7-7 7 7 7',
    close: 'm6 6 12 12M6 18 18 6',
    edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    archive: 'M3 3h18v5H3V3Zm2 5v13h14V8M9 12h6',
    download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    upload: 'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',
    phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 17h4',
    cloud: 'M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-12-1 4.5 4.5 0 0 0 0 9Z',
    refresh: 'M20 7v5h-5M4 17v-5h5m10-4a7 7 0 0 0-12-3L4 8m16 8-3 3a7 7 0 0 1-12-3',
    up: 'm6 15 6-6 6 6',
    down: 'm6 9 6 6 6-6',
    logout: 'M10 4H4v16h6m4-4 4-4-4-4m-5 4h12'
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.target}"/></svg>`;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));
const uid = () => crypto.randomUUID();
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekOrder = [1, 2, 3, 4, 5, 6, 0];
const format = (day, options) => new Intl.DateTimeFormat('en-GB', {...options, timeZone: 'UTC'}).format(parseDate(day));
const dayLabel = day => format(day, {weekday: 'long', month: 'long', day: 'numeric'});
let data = emptyData(), revision = -1, user = {}, ready = false, busy = false, loadError = '',
    page = ['today', 'calendar', 'statistics', 'routines', 'notes', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
let today = dateKey(new Date(), data.timezone), selected = today, calendarYear = Number(today.slice(0, 4)), toastTimer,
    editor = null, pendingImport = null, refreshing = false;
let statsPeriod = '28', statsRoutine = 'all';
const expandedRoutines = new Set();
const app = document.querySelector('#app'), modalRoot = document.querySelector('#modal-root');
let authMode = 'email', needsLogin = false, widgetKey = '';
const authUI = createAuthUI({
    root: app, icon, request, onSuccess: async () => {
        api.invalidate();
        needsLogin = false;
        ready = false;
        busy = false;
        refreshing = false;
        revision = -1;
        authUI.reset();
        render();
        await refresh(true);
    }
});
const announce = message => {
    const toast = document.querySelector('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 4000);
};
const activeRoutines = () => data.routines.filter(r => !r.archivedOn);

function navigate(p) {
    page = p;
    location.hash = p;
    if (p === 'today') selected = today;
    if (p === 'calendar') calendarYear = Number(selected.slice(0, 4));
    render();
    window.scrollTo({top: 0});
}

const actionButton = (action, label, ic, cls = '') => `<button class="${cls}" data-action="${action}">${ic ? icon(ic) : ''}<span>${label}</span></button>`;

function nav(mobile = false) {
    return `<nav class="${mobile ? 'bottom-nav' : ''}" aria-label="${mobile ? 'Mobile navigation' : 'Main navigation'}">${['today', 'calendar', 'statistics', 'routines', 'notes', 'settings'].map((p, i) => `<button data-nav="${p}" class="${page === p ? 'active' : ''}" ${page === p ? 'aria-current="page"' : ''}>${icon(p === 'statistics' ? 'activity' : p)}<span>${['Today', 'Calendar', 'Statistics', mobile ? 'Routines' : 'My routines', 'Notes', 'Settings'][i]}</span></button>`).join('')}</nav>`;
}

function render() {
    if (needsLogin) {
        authUI.show(authMode);
        return;
    }
    const focused = document.activeElement;
    const focusKey = focused?.closest('#app') ? focused?.dataset?.focusKey : null;
    const oldHeatmap = document.querySelector('.heatmap-scroll[data-period]');
    const oldPeriod = oldHeatmap?.dataset.period, oldScroll = oldHeatmap?.scrollLeft;
    const filterScroll = document.querySelector('.routine-filters')?.scrollLeft || 0;
    if (statsRoutine !== 'all' && !data.routines.some(r => r.id === statsRoutine)) statsRoutine = 'all';
    const stats = ready ? streaks(data, today) : {current: 0, best: 0, completedDays: 0};
    app.innerHTML = `<div class="shell ${page === 'calendar' || page === 'statistics' || page === 'notes' ? 'calendar-view' : ''} ${page}-view"><aside class="sidebar"><a class="brand" href="#today" aria-label="Ember home">${icon('flame')}<span>ember<span class="brand-dot">.</span></span></a>${nav()}<div class="side-bottom"><div class="sync-state ${!navigator.onLine ? 'is-offline' : ''}">${icon('cloud')}<span>${busy ? 'Saving…' : !navigator.onLine ? 'Offline' : ready ? 'Synced with your account' : 'Connecting…'}</span></div></div><button class="mobile-settings icon-button" data-nav="settings" aria-label="Settings">${icon('settings')}</button></aside><main id="main">${!ready ? loadView() : content(stats)}</main><aside class="insights"><h2>Your rhythm</h2>${calendarGrid(true)}<div class="insight-divider"></div><div class="section-title small"><h3>This week</h3><span>MON — SUN</span></div>${weekChart()}<div class="insight-stats"><div><strong>${stats.best}</strong><span>Best streak</span></div><div><strong>${stats.completedDays}</strong><span>Perfect days</span></div></div><button class="text-link stats-link" data-nav="statistics">View statistics ${icon('chevron')}</button></aside></div>${nav(true)}`;
    const filters = document.querySelector('.routine-filters');
    if (filters) filters.scrollLeft = filterScroll;
    if (focusKey) Array.from(app.querySelectorAll('[data-focus-key]')).find(el => el.dataset.focusKey === focusKey)?.focus({preventScroll: true});
    const heatmap = document.querySelector('.heatmap-scroll[data-period]');
    if (heatmap) {
        if (oldPeriod === heatmap.dataset.period) heatmap.scrollLeft = oldScroll;
        else revealActivityDate(selected);
    }
    if (!navigator.onLine && ready) {
        app.querySelector('main').insertAdjacentHTML('afterbegin', '<div class="notice">You’re offline. Reconnect to load or save changes.</div>');
    }
}

function loadView() {
    return `<header class="page-heading"><div><h1>Your daily rhythm<span class="brand-dot">.</span></h1></div></header><div class="empty-state">${icon(loadError ? 'cloud' : 'flame')}<h2>${loadError ? 'Let’s reconnect.' : 'Getting your routines…'}</h2><p>${esc(loadError || 'Just a moment while we sync your progress.')}</p>${loadError ? '<button class="button primary" data-action="refresh">Try again</button>' : ''}</div>`;
}

function content(stats) {
    if (page === 'notes') return renderNotes({notes: data.notes, esc, icon});
    if (page === 'statistics') return statisticsView();
    if (page === 'settings') return settingsView();
    if (page === 'routines') return routinesView();
    if (page === 'calendar') return `<header class="page-heading"><div><h1>Your calendar<span class="brand-dot">.</span></h1><p>Your activity and completion history.</p></div><button class="button secondary" data-action="jump-today">Today</button></header><section class="calendar-card activity-card">${calendarGrid(false)}</section><section class="selected-day" aria-label="Selected day"><div class="section-title"><div><span class="eyebrow">${selected === today ? 'TODAY' : format(selected, {weekday: 'long'}).toUpperCase()}</span><h2>${format(selected, {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })}</h2></div><span class="day-result ${dayProgress(data, selected).complete ? 'accent' : ''}">${selected > today ? 'Upcoming' : dayProgress(data, selected).total ? `${dayProgress(data, selected).done} / ${dayProgress(data, selected).total} steps` : 'Rest day'}</span></div>${routineList(selected)}</section>`;
    const p = dayProgress(data, selected),
        completed = data.routines.filter(r => !isWeekly(revisionAt(r, selected)) && routineProgress(data, r, selected).complete).length;
    return `${weekStrip()}<header class="page-heading"><div><h1>${selected === today ? 'Today' : selected > today ? 'Coming up' : 'Your day'}<span class="brand-dot">.</span></h1><p>${p.complete ? 'Daily routines complete.' : p.routines ? `${p.routines} ${p.routines === 1 ? 'routine' : 'routines'} planned` : 'A little room for yourself.'}</p></div><button class="button primary" data-action="new">${icon('plus')}<span>New routine</span></button></header>${p.routines ? `<div class="daily-overview"><section class="daily-progress" aria-label="Daily progress"><div><span>${completed} of ${p.routines} daily routines complete</span><strong>${p.routines ? Math.round(completed / p.routines * 100) : 0}%</strong></div><div class="progress-track" role="progressbar" aria-label="Routines completed" aria-valuenow="${p.routines ? Math.round(completed / p.routines * 100) : 0}" aria-valuemin="0" aria-valuemax="100"><div style="width:${p.routines ? completed / p.routines * 100 : 0}%"></div></div></section><button class="streak-compact ${dayProgress(data, today).complete ? 'lit' : ''}" data-nav="statistics" aria-label="Current streak: ${stats.current} ${stats.current === 1 ? 'day' : 'days'}. Open statistics">${icon('flame')}<span><strong>${stats.current} ${stats.current === 1 ? 'day' : 'days'}</strong><small>Current streak</small></span></button></div>` : ''}<h2 class="sr-only">Your routines</h2>${routineList(selected)}${p.complete ? `<div class="day-complete">${icon('check')}<span>Daily routines checked off.</span></div>` : ''}`;
}

function weekStrip() {
    const start = shiftDate(selected, -((weekday(selected) + 6) % 7));
    return `<div class="week-strip" aria-label="Choose a day"><button class="icon-button" data-week="-7" aria-label="Previous week">${icon('chevron', 'rotate')}</button><div class="week-days">${Array.from({length: 7}, (_, i) => {
        const d = shiftDate(start, i), p = dayProgress(data, d);
        return `<button class="week-day ${d === selected ? 'selected' : ''} ${d === today ? 'is-today' : ''}" data-date="${d}" data-focus-key="day-${d}" aria-label="${dayLabel(d)}${p.complete ? ', complete' : ''}" aria-pressed="${d === selected}"><span>${dayNames[weekday(d)]}</span><strong>${Number(d.slice(-2))}</strong><i class="${p.complete ? 'complete' : p.done ? 'partial' : ''}">${p.complete ? icon('check') : ''}</i></button>`;
    }).join('')}</div><button class="icon-button" data-week="7" aria-label="Next week">${icon('chevron')}</button></div>`;
}

function routineList(day, weekly = false) {
    if (!weekly) return routineList(day, 'daily') + routineList(day, 'weekly');
    const rs = data.routines.filter(r => isScheduled(r, day) && isWeekly(revisionAt(r, day)) === (weekly === 'weekly'));
    if (!rs.length && (weekly === 'weekly' || data.routines.some(r => isScheduled(r, day)))) return '';
    if (!rs.length) {
        if (!activeRoutines().length && day === today) return `<section class="empty-state"><div class="empty-icon">${icon('flame')}</div><h2>Make room for a good habit.</h2><p>Build a routine from small, doable steps.<br>Finish them all to keep your streak alive.</p><button class="button primary" data-action="new">${icon('plus')}Create your first routine</button><div class="starter-label">OR START WITH SOMETHING SIMPLE</div><div class="starter-options"><button data-template="morning">${icon('sun')}Morning reset</button><button data-template="evening">${icon('moon')}Evening wind-down</button></div></section>`;
        return `<section class="empty-state compact"><div class="empty-icon">${icon('leaf')}</div><h2>${day < today ? 'A quiet day.' : 'Room to breathe.'}</h2><p>No routines scheduled${day === today ? ' today' : ' for this day'}. Rest days keep your streak safe.</p>${day === today ? '<button class="button secondary" data-action="new">Add a routine</button>' : ''}</section>`;
    }
    return `${weekly === 'weekly' ? '<div class="section-title weekly-heading"><div><h2>This week</h2><p>Any day, at your pace · Mon–Sun</p></div></div>' : ''}<div class="routine-list">${rs.map(r => {
        const v = revisionAt(r, day), p = routineProgress(data, r, day), open = expandedRoutines.has(r.id),
            single = v.tasks.length === 1;
        const wp = isWeekly(v) ? weeklyProgress(data, r, day) : null;
        const schedule = wp ? `${wp.done} of ${wp.target} this week${wp.complete ? ' · Goal reached' : ''}` : isWeekly(v) ? `${v.weeklyTarget} times per week` : v.days.length === 7 ? 'Every day' : weekOrder.filter(d => v.days.includes(d)).map(d => dayNames[d]).join(', ');
        return `<section class="routine-card ${v.color} ${p.complete ? 'is-complete' : ''}"><div class="routine-top"><button class="routine-open" data-expand="${r.id}" data-focus-key="expand-${r.id}" aria-expanded="${open}" aria-controls="steps-${r.id}" aria-label="${open ? 'Hide' : 'Show'} steps for ${esc(v.name)}"><span class="routine-icon ${v.color}">${icon(v.icon)}</span><span class="routine-heading"><h3>${esc(v.name)}</h3><span>${schedule}${single ? '' : ` · ${p.done}/${p.total}`}</span></span></button><button class="routine-toggle" ${single ? `data-check="${r.id}" data-task="${v.tasks[0].id}" data-day="${day}" role="checkbox" aria-checked="${p.complete}" aria-label="${esc(v.name)}: ${esc(v.tasks[0].title)}"` : `data-expand="${r.id}" aria-expanded="${open}" aria-controls="steps-${r.id}" aria-label="${open ? 'Hide' : 'Show'} steps for ${esc(v.name)}"`} data-focus-key="toggle-${r.id}" ${single && (day > today || busy || !navigator.onLine) ? 'disabled' : ''}>${icon(p.complete ? 'check' : open && !single ? 'down' : 'plus')}</button></div><div id="steps-${r.id}" class="routine-detail" ${open ? '' : 'hidden'}><div class="task-list">${v.tasks.map(t => {
            const done = taskDone(data, day, r.id, t.id);
            return `<button class="task-row ${done ? 'done' : ''}" role="checkbox" aria-checked="${done}" aria-label="${esc(t.title)}" data-check="${r.id}" data-task="${t.id}" data-day="${day}" data-focus-key="task-${r.id}-${t.id}" ${day > today || busy || !navigator.onLine ? 'disabled' : ''}><span class="task-check">${done ? icon('check') : ''}</span><span>${esc(t.title)}</span></button>`;
        }).join('')}</div><div class="routine-actions"><button data-routine-stats="${r.id}">${icon('activity')}Statistics</button>${!r.archivedOn ? `<button data-edit="${r.id}">${icon('edit')}Edit routine</button>` : ''}<button class="delete-routine" data-delete-routine="${r.id}">${icon('trash')}Delete routine</button></div></div></section>`;
    }).join('')}</div>`;
}

function calendarGrid(mini) {
    const year = mini ? Number(today.slice(0, 4)) : calendarYear;
    const to = mini ? shiftDate(today, 6 - ((weekday(today) + 6) % 7)) : `${year}-12-31`;
    const from = mini ? shiftDate(to, -83) : `${year}-01-01`;
    const activity = activityRange(data, from, to, today);
    const focusDay = selected >= from && selected <= to ? selected : today >= from && today <= to ? today : from;
    const yearControls = `<div class="activity-year"><button class="icon-button" data-year="-1" aria-label="Previous year" ${year <= 2000 ? 'disabled' : ''}>${icon('chevron', 'rotate')}</button><span>${year}</span><button class="icon-button" data-year="1" aria-label="Next year" ${year >= Number(today.slice(0, 4)) + 1 ? 'disabled' : ''}>${icon('chevron')}</button></div>`;
    const legend = `<div class="heatmap-scale" aria-label="Completion scale: no tasks, low, medium, high, all tasks"><span>Less</span>${[0, 1, 2, 3, 4].map(level => `<i class="heat-cell level-${level}" aria-hidden="true"></i>`).join('')}<span>More</span></div>`;
    return `<div class="activity ${mini ? 'mini-activity' : ''}"><div class="activity-heading">${mini ? `<span>Last 12 weeks</span><button class="icon-button" data-nav="calendar" aria-label="Open calendar">${icon('chevron')}</button>` : `<div><span class="eyebrow">YOUR YEAR, ONE DAY AT A TIME</span><h2>${activity.completedTasks} <span>${activity.completedTasks === 1 ? 'step' : 'steps'} completed</span></h2></div>${yearControls}`}</div><div class="heatmap-layout"><div class="heatmap-weekdays" aria-hidden="true">${['Mon', '', 'Wed', '', 'Fri', '', ''].map(label => `<span>${label}</span>`).join('')}</div><div class="heatmap-scroll" ${!mini ? `data-period="${year}" tabindex="0" aria-label="Scroll through ${year} activity"` : ''}><div class="heatmap-chart" style="--weeks:${activity.columns}"><div class="heatmap-months" aria-hidden="true">${activity.months.map(m => `<span style="grid-column:${m.column + 1}">${m.label}</span>`).join('')}</div><div class="heatmap-days" role="group" aria-label="${mini ? 'Last 12 weeks' : year} activity">${activity.days.map(({
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             day,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             inRange,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             future,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             progress,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             level
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         }) => {
        if (!inRange) return '<span class="heat-cell outside" aria-hidden="true"></span>';
        const description = `${dayLabel(day)} ${day.slice(0, 4)}, ${future ? 'upcoming' : progress.total ? `${progress.done} of ${progress.total} steps completed${progress.complete ? ', day complete' : ''}` : 'no routines scheduled'}`;
        return `<button class="heat-cell level-${level} ${future ? 'future' : ''} ${day === today ? 'is-today' : ''} ${day === selected && !mini ? 'selected' : ''}" data-date="${day}" data-heatmap="${mini ? 'mini' : 'year'}" ${mini ? 'data-open-calendar="true"' : ''} aria-label="${esc(description)}" title="${esc(description)}" aria-pressed="${day === selected}" tabindex="${day === focusDay ? 0 : -1}"></button>`;
    }).join('')}</div></div></div></div><div class="activity-footer">${mini ? '' : `<p><strong>${activity.activeDays}</strong> active ${activity.activeDays === 1 ? 'day' : 'days'} <span>·</span> <strong>${activity.perfectDays}</strong> perfect ${activity.perfectDays === 1 ? 'day' : 'days'}</p>`}${mini ? '' : legend}</div>${mini ? '' : '<p class="heatmap-help">Each square is a day. Brighter means more of your steps completed.<span class="swipe-hint"> Swipe to explore the year.</span></p>'}</div>`;
}

function revealActivityDate(day) {
    const scroll = document.querySelector('.heatmap-scroll[data-period]');
    const cell = scroll?.querySelector(`[data-date="${day}"]`);
    if (cell) {
        const offset = cell.getBoundingClientRect().left - scroll.getBoundingClientRect().left + scroll.scrollLeft;
        scroll.scrollLeft = offset - scroll.clientWidth * .68;
    }
}

function selectActivityDay(day, focus = false) {
    selected = day;
    calendarYear = Number(day.slice(0, 4));
    page = 'calendar';
    location.hash = 'calendar';
    render();
    if (focus) {
        const cell = document.querySelector(`[data-heatmap="year"][data-date="${day}"]`);
        cell?.focus({preventScroll: true});
        cell?.scrollIntoView({block: 'nearest', inline: 'nearest'});
    }
}

function weekChart() {
    const start = shiftDate(today, -((weekday(today) + 6) % 7));
    return `<div class="week-chart">${Array.from({length: 7}, (_, i) => {
        const d = shiftDate(start, i), p = activityProgress(data, d), percent = p.total ? p.done / p.total * 100 : 0;
        return `<button data-date="${d}" data-open-calendar="true" aria-label="${dayLabel(d)}, ${Math.round(percent)} percent complete"><div class="bar-track"><div style="height:${percent}%" class="${p.complete ? 'complete' : ''}"></div></div><span class="${d === today ? 'accent' : ''}">${dayNames[weekday(d)][0]}</span></button>`;
    }).join('')}</div>`;
}

function statisticsView() {
    return renderStatistics({data, today, period: statsPeriod, routineId: statsRoutine, icon, esc, format});
}

function routinesView() {
    const active = activeRoutines(), archived = data.routines.filter(r => r.archivedOn);
    return `<header class="page-heading"><div><h1>My routines<span class="brand-dot">.</span></h1><p>Manage your routines and weekly goals.</p></div><button class="button primary" data-action="new">${icon('plus')}<span>New routine</span></button></header><div class="section-title"><h2>Active routines</h2><span>${active.length} ${active.length === 1 ? 'routine' : 'routines'}</span></div>${active.length ? active.map(r => manageCard(r)).join('') : routineList(today)}${archived.length ? `<details class="archived"><summary>Archived routines <span>${archived.length}</span></summary>${archived.map(r => manageCard(r, true)).join('')}</details>` : ''}`;
}

function manageCard(r, archived = false) {
    const v = r.versions.at(-1), s = streaks(data, today, r.id);
    return `<section class="manage-card"><div class="routine-icon ${v.color}">${icon(v.icon)}</div><div class="routine-heading"><h3>${esc(v.name)}</h3><span>${v.tasks.length} ${v.tasks.length === 1 ? 'step' : 'steps'} · ${archived ? `Archived ${format(r.archivedOn, {
        day: 'numeric',
        month: 'short'
    })}` : isWeekly(v) ? `${v.weeklyTarget} times per week` : v.days.length === 7 ? 'Every day' : weekOrder.filter(d => v.days.includes(d)).map(d => dayNames[d]).join(', ')}</span></div>${!archived ? `<button class="icon-button" data-edit="${r.id}" aria-label="Edit ${esc(v.name)}">${icon('edit')}</button><button class="icon-button" data-archive="${r.id}" aria-label="Archive ${esc(v.name)}">${icon('archive')}</button>` : `<span class="muted">Best: ${s.best}</span>`}<button class="icon-button delete-routine" data-delete-routine="${r.id}" aria-label="Delete ${esc(v.name)}">${icon('trash')}</button></section>`;
}

function settingsView() {
    return `<header class="page-heading"><div><h1>Make it yours<span class="brand-dot">.</span></h1><p>Account, appearance and backups.</p></div></header><section class="settings-card"><h2>Appearance</h2><p>Choose your preferred theme.</p><div class="theme-options" role="group" aria-label="Color theme">${['dark', 'light'].map(theme => `<button class="theme-choice" data-theme-choice="${theme}" aria-pressed="${window.EmberTheme.get() === theme}"><span class="theme-swatch ${theme}" aria-hidden="true"></span>${theme === 'dark' ? 'Dark' : 'Light'}</button>`).join('')}</div><p class="settings-meta">Saved on this device.</p></section><section class="settings-card"><h2>${icon('cloud')}Your account</h2><p class="account-email">${esc(user.email || 'Your account')}</p><p>Your routines and progress sync when you’re online. Use the same ${authMode === 'email' ? 'email address' : 'ChatGPT account'} on your phone and computer.</p><div class="settings-actions"><button class="button secondary" data-action="refresh">${icon('refresh')}Sync now</button>${authMode === 'email' ? '<button class="text-link" data-action="signout">Sign out</button>' : '<a class="text-link" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a>'}</div><div class="settings-meta">Day boundary: ${esc(data.timezone)}<br>A day runs from midnight to midnight in this time zone.</div></section><section class="settings-card"><h2>${icon('phone')}Ember on your iPhone</h2><ol class="install-steps"><li>Open this page in <strong>Safari</strong>.</li><li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Turn on <strong>Open as Web App</strong>, if shown, and tap <strong>Add</strong>.</li></ol><p>Open Ember from its new icon and sign in with the same account. An internet connection is needed to load and save your routines.</p><button class="button secondary" data-action="copy-link">Copy app link</button></section><section class="settings-card widget-setup"><h2>${icon('phone')}Your home screen, a little brighter</h2><p>Add an Ember widget with Scriptable. See your streak, today’s progress and 12 weeks of activity.</p><div class="widget-example">${icon('flame')}<div><strong>${streaks(data, today).current} day streak</strong><span>${dayProgress(data, today).done} / ${dayProgress(data, today).total} steps today</span></div></div><ol><li>Install Scriptable from the App Store.</li><li>Download the script below and save it to <strong>iCloud Drive → Scriptable</strong>.</li><li>${authMode === 'email' ? 'Tap <strong>Connect widget</strong> below and copy your widget key. Run Ember-Widget in Scriptable and paste it when asked.' : 'Finish email sign-in setup before connecting the widget. Then create a widget key here and paste it into Scriptable.'}</li><li>Add a Scriptable widget to your Home Screen and select <strong>Ember-Widget</strong>.</li></ol><div class="settings-actions"><a class="button secondary" href="/Ember-Widget.js" download="Ember-Widget.js">Download script</a>${authMode === 'email' ? '<button class="button primary" data-action="widget-connect">Connect widget</button><button class="text-link" data-action="widget-revoke">Revoke widget access</button>' : ''}</div>${authMode !== 'email' ? '<p role="status">Widget connection will be available after email sign-in is activated. You can download the script now.</p>' : ''}<p>Small, medium and large widgets are supported. iOS decides when widgets refresh. Tap the widget to open Ember.</p></section><section class="settings-card"><h2>${icon('download')}Your data, with you</h2><p>Keep a backup of your routines, notes and full history. Importing a backup replaces the current data on all your devices.</p><div class="settings-actions"><button class="button secondary" data-action="export">${icon('download')}Export backup</button><button class="button secondary" data-action="import">${icon('upload')}Import backup</button></div></section><section class="settings-card"><h2>${icon('flame')}How your streak works</h2><p>A daily routine earns a day when you finish all its steps. Your main streak grows when you finish every daily routine scheduled that day. Weekly goals are tracked separately: complete them on any days, once per day, from Monday to Sunday.</p><p>Planned rest days are skipped. A missed scheduled day breaks the streak. Today stays open until midnight. You can correct past days in Calendar; future days cannot be checked off.</p><p>Edits apply from today. Archiving stops a routine from today and keeps its earlier history.</p></section><p class="app-version">ember. · Version 1.3</p>`;
}

function acceptState(result) {
    if (result.revision >= revision) {
        data = result.data;
        revision = result.revision;
        today = dateKey(new Date(), data.timezone);
    }
    if (result.user) user = result.user;
    ready = true;
    loadError = '';
}

function requireLogin() {
    api.invalidate();
    busy = false;
    refreshing = false;
    needsLogin = true;
    ready = false;
    data = emptyData();
    revision = -1;
    user = {};
    widgetKey = '';
    modalRoot.innerHTML = '';
    editor = null;
    pendingImport = null;
    render();
}

async function refresh(silent = false) {
    if (busy || refreshing || needsLogin) return;
    const generation = api.generation;
    refreshing = true;
    try {
        const result = await request('/api/state');
        const changed = !ready || result.revision > revision;
        acceptState(result);
        if (changed && !document.querySelector('dialog[open]')) render();
        if (!silent) announce('Everything is up to date.');
    } catch (e) {
        if (e.code === 'SESSION_CHANGED') return;
        if (e.status === 401) requireLogin(); else if (!ready) {
            loadError = e.message;
            render();
        } else if (!silent) announce(e.message);
    } finally {
        if (generation === api.generation) refreshing = false;
    }
}

async function mutate(action) {
    const generation = api.generation, focusKey = document.activeElement?.dataset?.focusKey;
    if (busy) throw new Error('Please wait for the current save.');
    if (!navigator.onLine) throw new Error('Reconnect to save your changes.');
    busy = true;
    document.querySelectorAll('[data-check]').forEach(b => b.disabled = true);
    try {
        const result = await request('/api/actions', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(action)
        });
        acceptState(result);
        return result;
    } catch (e) {
        if (e.status === 401) requireLogin();
        throw e;
    } finally {
        if (generation === api.generation) {
            busy = false;
            render();
            if (focusKey && document.activeElement === document.body) Array.from(app.querySelectorAll('[data-focus-key]')).find(el => el.dataset.focusKey === focusKey)?.focus({preventScroll: true});
        }
    }
}

function showDialog(html) {
    modalRoot.innerHTML = `<dialog aria-labelledby="dialog-title">${html}</dialog>`;
    const dialog = modalRoot.querySelector('dialog');
    dialog.addEventListener('click', e => {
        if (e.target === dialog) {
            const r = dialog.getBoundingClientRect();
            if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
        }
    });
    dialog.addEventListener('cancel', e => {
        if (busy) e.preventDefault();
    });
    dialog.showModal();
}

function closeDialog() {
    if (busy) return;
    widgetKey = '';
    const dialog = modalRoot.querySelector('dialog');
    dialog?.close();
    modalRoot.innerHTML = '';
    editor = null;
    pendingImport = null;
}

function openEditor(id, template) {
    const r = data.routines.find(r => r.id === id), v = r?.versions.at(-1);
    const presets = {
        morning: {
            name: 'Morning reset',
            icon: 'sun',
            color: 'orange',
            titles: ['Drink a glass of water', 'Stretch for 5 minutes', 'Set one intention']
        },
        evening: {
            name: 'Evening wind-down',
            icon: 'moon',
            color: 'purple',
            titles: ['Put my phone away', 'Read 10 pages', 'Write one good thing about today']
        }
    };
    const p = presets[template];
    editor = {
        id: r?.id || uid(),
        expectedVersion: v ? JSON.stringify(v) : undefined,
        frequency: v?.frequency || 'daily',
        weeklyTarget: v?.weeklyTarget || 3,
        days: [...(v?.days || [0, 1, 2, 3, 4, 5, 6])],
        icon: v?.icon || p?.icon || 'sun',
        color: v?.color || p?.color || 'orange',
        tasks: v ? structuredClone(v.tasks) : (p?.titles || ['']).map(title => ({id: uid(), title})),
        name: v?.name || p?.name || '',
        existing: !!r
    };
    showDialog(`<form id="routine-form"><div class="dialog-top"><div><span class="eyebrow">BUILD YOUR RHYTHM</span><h2 id="dialog-title">${r ? 'Edit routine' : 'A new beginning.'}</h2></div><button type="button" class="icon-button" data-action="close" aria-label="Close editor">${icon('close')}</button></div><div class="dialog-body"><label class="field-label" for="routine-name">Routine name</label><input id="routine-name" name="name" placeholder="e.g. Morning reset" maxlength="60" required value="${esc(editor.name)}" autocomplete="off"><fieldset><legend>Make it recognizable</legend><div class="icon-options">${ICONS.map(i => `<button type="button" data-icon="${i}" class="icon-option ${editor.icon === i ? 'selected' : ''}" aria-label="${i}" aria-pressed="${editor.icon === i}">${icon(i)}</button>`).join('')}</div><div class="color-options">${COLORS.map(c => `<button type="button" data-color="${c}" class="color-option ${c} ${editor.color === c ? 'selected' : ''}" aria-label="${c}" aria-pressed="${editor.color === c}">${editor.color === c ? icon('check') : ''}</button>`).join('')}</div></fieldset><fieldset><legend>Repeat</legend><div class="repeat-mode"><button type="button" data-frequency="daily" aria-pressed="${editor.frequency === 'daily'}">Specific days</button><button type="button" data-frequency="weekly" aria-pressed="${editor.frequency === 'weekly'}">Times per week</button></div><div id="daily-schedule" ${editor.frequency === 'weekly' ? 'hidden' : ''}><div class="schedule-options">${weekOrder.map(d => `<button type="button" data-schedule="${d}" class="${editor.days.includes(d) ? 'selected' : ''}" aria-pressed="${editor.days.includes(d)}">${dayNames[d]}</button>`).join('')}</div><p class="field-hint">Rest days won’t break your streak.</p></div><div id="weekly-schedule" ${editor.frequency !== 'weekly' ? 'hidden' : ''}><label class="field-label" for="weekly-target">Weekly goal</label><select id="weekly-target">${Array.from({length:7}, (_, i) => `<option value="${i+1}" ${editor.weeklyTarget === i+1 ? 'selected' : ''}>${i+1} ${i ? 'times' : 'time'} per week</option>`).join('')}</select><p class="field-hint">Choose any days, Monday to Sunday. All steps count as one completion, at most once per day. Weekly goals have their own streak. Goal changes apply next week if the week has already started.</p></div></fieldset><div class="step-heading"><span class="field-label">Steps</span><span class="muted">Small enough to start.</span></div><div id="task-inputs"></div><button type="button" class="add-step" data-action="add-step">${icon('plus')}Add a step</button><p class="field-hint">Finish every step to complete this routine.</p><p class="form-error" role="alert" id="form-error"></p></div><div class="dialog-footer"><p>${r ? 'Changes apply from today. Past days stay unchanged.' : 'Your first day starts today.'}</p><button class="button primary" type="submit" id="save-routine">${r ? 'Save changes' : 'Create routine'}${icon('chevron')}</button></div></form>`);
    renderTaskInputs();
}

function renderTaskInputs() {
    document.querySelector('#task-inputs').innerHTML = editor.tasks.map((t, i) => `<div class="task-input" data-task-id="${t.id}"><span>${String(i + 1).padStart(2, '0')}</span><input aria-label="Step ${i + 1}" placeholder="e.g. Drink a glass of water" value="${esc(t.title)}" maxlength="120" required><div class="task-input-actions"><button type="button" class="icon-button" data-move="${i}" data-direction="-1" aria-label="Move step ${i + 1} up" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button><button type="button" class="icon-button" data-remove-step="${i}" aria-label="Remove step ${i + 1}" ${editor.tasks.length === 1 ? 'disabled' : ''}>${icon('close')}</button></div></div>`).join('');
}

function readTaskInputs() {
    document.querySelectorAll('.task-input').forEach(row => {
        const t = editor.tasks.find(t => t.id === row.dataset.taskId);
        if (t) t.title = row.querySelector('input').value;
    });
}

function deleteRoutineDialog(id) {
    const r = data.routines.find(r => r.id === id);
    if (!r) return;
    showDialog(`<div class="confirm-dialog"><div class="empty-icon">${icon('trash')}</div><h2 id="dialog-title">Delete ${esc(r.versions.at(-1).name)}?</h2><p>This permanently deletes the routine and all its completed steps from your history, calendar and statistics on every device. It cannot be undone.</p><p>To keep its history, use Archive instead.</p><div class="form-error" role="alert"></div><div class="settings-actions"><button class="button secondary" data-action="close" autofocus>Keep routine</button><button class="button danger" data-confirm-delete-routine="${id}" data-delete-version="${esc(JSON.stringify(r.versions.at(-1)))}">Delete permanently</button></div></div>`);
}

function archiveDialog(id) {
    const r = data.routines.find(r => r.id === id);
    if (!r) return;
    showDialog(`<div class="confirm-dialog"><div class="empty-icon">${icon('archive')}</div><h2 id="dialog-title">Archive ${esc(r.versions.at(-1).name)}?</h2><p>It will leave your schedule from today. Earlier days and your history will stay in the calendar.</p><div class="form-error" role="alert"></div><div class="settings-actions"><button class="button secondary" data-action="close">Keep routine</button><button class="button primary" data-confirm-archive="${id}">Archive routine</button></div></div>`);
}

function downloadBackup() {
    const blob = new Blob([JSON.stringify({exportedAt: new Date().toISOString(), ...data}, null, 2)], {type: 'application/json'}),
        url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = `ember-backup-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Backup exported. Keep it somewhere safe.');
}

async function importBackup(file) {
    if (!file) return;
    try {
        if (file.size > 2200000) throw new Error('Choose a backup smaller than 2 MB.');
        const parsed = validateData(JSON.parse(await file.text()), today);
        pendingImport = parsed;
        showDialog(`<div class="confirm-dialog"><div class="empty-icon">${icon('upload')}</div><h2 id="dialog-title">Restore this backup?</h2><p>${parsed.routines.length} ${parsed.routines.length === 1 ? 'routine' : 'routines'} and ${Object.keys(parsed.checks).length} days of history. This replaces your current data on every device.</p><p>Export your current data first if you want to keep it.</p><div class="form-error" role="alert"></div><div class="settings-actions"><button class="button secondary" data-action="close">Cancel</button><button class="button primary" data-action="confirm-import">Replace and restore</button></div></div>`);
    } catch (e) {
        announce(e instanceof SyntaxError ? 'This file is not a valid Ember backup.' : e.message);
    }
}

document.addEventListener('click', async event => {
    const b = event.target.closest('button');
    if (!b || b.disabled) return;
    try {
        if (b.dataset.themeChoice) {
            window.EmberTheme.set(b.dataset.themeChoice);
            return;
        }
        if (b.dataset.noteEdit) {
            const note = data.notes.find(n => n.id === b.dataset.noteEdit);
            showDialog(noteEditor(note, esc, icon));
            return;
        }
        if (b.dataset.noteArchive) {
            const note = data.notes.find(n => n.id === b.dataset.noteArchive);
            await mutate({type: 'archive-note', id: note.id, expectedRevision: note.revision, archived: !note.archived});
            announce(note.archived ? 'Note restored.' : 'Note archived. You can restore it below.');
            return;
        }
        if (b.dataset.frequency) {
            editor.frequency = b.dataset.frequency;
            document.querySelectorAll('[data-frequency]').forEach(x => x.setAttribute('aria-pressed', x === b));
            document.querySelector('#daily-schedule').hidden = editor.frequency === 'weekly';
            document.querySelector('#weekly-schedule').hidden = editor.frequency !== 'weekly';
            return;
        }
        if (b.dataset.expand) {
            const id = b.dataset.expand;
            expandedRoutines.has(id) ? expandedRoutines.delete(id) : expandedRoutines.add(id);
            render();
            return;
        }
        if (b.dataset.routineStats) {
            statsRoutine = b.dataset.routineStats;
            navigate('statistics');
            return;
        }
        if (b.dataset.statsRoutine) {
            statsRoutine = b.dataset.statsRoutine;
            render();
            return;
        }
        if (b.dataset.nav) {
            navigate(b.dataset.nav);
            return;
        }
        if (b.dataset.date) {
            if (b.dataset.heatmap || b.dataset.openCalendar) selectActivityDay(b.dataset.date, !!b.dataset.heatmap); else {
                selected = b.dataset.date;
                calendarYear = Number(selected.slice(0, 4));
                render();
            }
            return;
        }
        if (b.dataset.week) {
            selected = shiftDate(selected, Number(b.dataset.week));
            render();
            return;
        }
        if (b.dataset.year) {
            calendarYear += Number(b.dataset.year);
            selected = calendarYear === Number(today.slice(0, 4)) ? today : `${calendarYear}-01-01`;
            render();
            return;
        }
        if (b.dataset.check) {
            const done = !taskDone(data, b.dataset.day, b.dataset.check, b.dataset.task);
            await mutate({type: 'check', day: b.dataset.day, routineId: b.dataset.check, taskId: b.dataset.task, done});
            if (done && routineProgress(data, data.routines.find(r => r.id === b.dataset.check), b.dataset.day).complete) announce('Routine complete. A spark well earned.');
            return;
        }
        if (b.dataset.edit) {
            openEditor(b.dataset.edit);
            return;
        }
        if (b.dataset.template) {
            openEditor(null, b.dataset.template);
            return;
        }
        if (b.dataset.deleteRoutine) {
            deleteRoutineDialog(b.dataset.deleteRoutine);
            return;
        }
        if (b.dataset.confirmDeleteRoutine) {
            b.disabled = true;
            await mutate({type: 'delete-routine', id: b.dataset.confirmDeleteRoutine, expectedVersion: b.dataset.deleteVersion});
            expandedRoutines.delete(b.dataset.confirmDeleteRoutine);
            closeDialog();
            announce('Routine and its history deleted.');
            return;
        }
        if (b.dataset.archive) {
            archiveDialog(b.dataset.archive);
            return;
        }
        if (b.dataset.confirmArchive) {
            b.disabled = true;
            await mutate({type: 'archive', id: b.dataset.confirmArchive});
            closeDialog();
            announce('Routine archived. Your past days are safe.');
            return;
        }
        if (b.dataset.icon) {
            editor.icon = b.dataset.icon;
            document.querySelectorAll('[data-icon]').forEach(x => {
                x.classList.toggle('selected', x === b);
                x.setAttribute('aria-pressed', x === b);
            });
            return;
        }
        if (b.dataset.color) {
            editor.color = b.dataset.color;
            document.querySelectorAll('[data-color]').forEach(x => {
                x.classList.toggle('selected', x === b);
                x.setAttribute('aria-pressed', x === b);
                x.innerHTML = x === b ? icon('check') : '';
            });
            return;
        }
        if (b.dataset.schedule !== undefined) {
            const d = Number(b.dataset.schedule);
            editor.days = editor.days.includes(d) ? editor.days.filter(x => x !== d) : [...editor.days, d];
            b.classList.toggle('selected', editor.days.includes(d));
            b.setAttribute('aria-pressed', editor.days.includes(d));
            return;
        }
        if (b.dataset.removeStep !== undefined) {
            readTaskInputs();
            editor.tasks.splice(Number(b.dataset.removeStep), 1);
            renderTaskInputs();
            return;
        }
        if (b.dataset.move !== undefined) {
            readTaskInputs();
            const i = Number(b.dataset.move), j = i + Number(b.dataset.direction);
            [editor.tasks[i], editor.tasks[j]] = [editor.tasks[j], editor.tasks[i]];
            renderTaskInputs();
            return;
        }
        switch (b.dataset.action) {
            case 'new-note':
                showDialog(noteEditor({id: uid()}, esc, icon));
                break;
            case 'signout':
                b.disabled = true;
                await request('/api/auth/logout', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: '{}'
                });
                authUI.reset();
                requireLogin();
                break;
            case 'widget-connect':
                showDialog(`<div class="confirm-dialog"><h2 id="dialog-title">Connect Scriptable</h2><p>The key lets your widget read progress. It cannot change routines or sign in to Ember. Creating a new key replaces the previous one.</p><div class="form-error" role="alert"></div><div class="settings-actions"><button class="button secondary" data-action="close">Cancel</button><button class="button primary" data-action="widget-create">Create widget key</button></div></div>`);
                break;
            case 'widget-create': {
                b.disabled = true;
                const result = await request('/api/widget-token', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({action: 'create'})
                });
                widgetKey = result.token;
                showDialog(`<div class="confirm-dialog"><h2 id="dialog-title">Your widget key</h2><p>Copy this key into Scriptable when it asks. It is shown once and expires in one year. Keep it private.</p><div class="widget-key" id="widget-key">${esc(widgetKey)}</div><div class="form-error" role="alert"></div><div class="settings-actions"><button class="button primary" data-action="widget-copy">Copy key</button><button class="button secondary" data-action="close">Done</button></div></div>`);
                break;
            }
            case 'widget-copy':
                try {
                    await navigator.clipboard.writeText(widgetKey);
                    announce('Widget key copied.');
                } catch {
                    announce('Select the key above and copy it manually.');
                }
                break;
            case 'widget-revoke':
                showDialog(`<div class="confirm-dialog"><h2 id="dialog-title">Disconnect your widget?</h2><p>Your widget will stop receiving updates. You can reconnect it with a new key anytime.</p><div class="form-error" role="alert"></div><div class="settings-actions"><button class="button secondary" data-action="close">Keep connected</button><button class="button primary" data-action="widget-revoke-confirm">Disconnect widget</button></div></div>`);
                break;
            case 'widget-revoke-confirm':
                b.disabled = true;
                await request('/api/widget-token', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({action: 'revoke'})
                });
                closeDialog();
                announce('Widget access revoked.');
                break;
            case 'new':
                openEditor();
                break;
            case 'close':
                closeDialog();
                break;
            case 'refresh':
                await refresh();
                break;
            case 'jump-today':
                selected = today;
                calendarYear = Number(today.slice(0, 4));
                render();
                revealActivityDate(today);
                break;
            case 'add-step':
                if (editor.tasks.length >= 20) {
                    announce('A routine can have up to 20 steps.');
                    break;
                }
                readTaskInputs();
                editor.tasks.push({id: uid(), title: ''});
                renderTaskInputs();
                document.querySelector('.task-input:last-child input').focus();
                break;
            case 'export':
                downloadBackup();
                break;
            case 'import':
                document.querySelector('#backup-file').value = '';
                document.querySelector('#backup-file').click();
                break;
            case 'confirm-import':
                b.disabled = true;
                await mutate({type: 'import', data: pendingImport});
                closeDialog();
                selected = today;
                calendarYear = Number(today.slice(0, 4));
                render();
                announce('Backup restored and synced.');
                break;
            case 'copy-link':
                try {
                    await navigator.clipboard.writeText(location.origin + '/');
                    announce('App link copied.');
                } catch {
                    announce('Copy the address from your browser’s address bar.');
                }
                break;
        }
    } catch (e) {
        if (e.code === 'SESSION_CHANGED') return;
        if (e.status === 401) {
            requireLogin();
            return;
        }
        b.disabled = false;
        const error = document.querySelector('dialog .form-error');
        if (error) {
            error.textContent = e.message;
            b.disabled = false;
        } else announce(e.message);
    }
});
document.addEventListener('keydown', event => {
    const cell = event.target.closest('[data-heatmap]');
    if (!cell) return;
    const offsets = {ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1};
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const day = shiftDate(cell.dataset.date, offsets[event.key]);
    const grid = cell.closest('.heatmap-days'), next = grid.querySelector(`[data-date="${day}"]`);
    if (!next) return;
    for (const button of grid.querySelectorAll('button')) button.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
});
document.addEventListener('change', event => {
    if (event.target.id === 'stats-period') {
        statsPeriod = event.target.value;
        render();
    }
});
document.addEventListener('submit', async event => {
    if (event.target.id === 'note-form') {
        event.preventDefault();
        if (busy) return;
        const form = event.target, button = form.querySelector('[type=submit]');
        try {
            button.disabled = true;
            await mutate({type: 'save-note', id: form.dataset.noteId, expectedRevision: Number(form.dataset.revision), title: form.querySelector('#note-title').value.trim(), body: form.querySelector('#note-body').value});
            closeDialog();
            announce('Note saved.');
        } catch (error) {
            button.disabled = false;
            form.querySelector('.form-error').textContent = error.message;
        }
        return;
    }
    if (event.target.id !== 'routine-form') return;
    event.preventDefault();
    if (busy) return;
    readTaskInputs();
    const button = document.querySelector('#save-routine');
    try {
        document.querySelector('#form-error').textContent = '';
        if (editor.frequency !== 'weekly' && !editor.days.length) throw new Error('Choose at least one day for your routine.');
        if (editor.tasks.some(t => !t.title.trim())) throw new Error('Give every step a title.');
        button.disabled = true;
        button.textContent = 'Saving…';
        await mutate({
            type: 'save-routine',
            id: editor.id,
            expectedVersion: editor.expectedVersion,
            version: {
                name: document.querySelector('#routine-name').value.trim(),
                icon: editor.icon,
                color: editor.color,
                days: editor.frequency === 'weekly' ? [0,1,2,3,4,5,6] : editor.days,
                frequency: editor.frequency,
                ...(editor.frequency === 'weekly' ? {weeklyTarget: Number(document.querySelector('#weekly-target').value)} : {}),
                tasks: editor.tasks
            }
        });
        closeDialog();
        announce('Your routine is ready. One step at a time.');
    } catch (e) {
        if (!editor) {
            announce(e.message);
            return;
        }
        document.querySelector('#form-error').textContent = e.message;
        button.disabled = false;
        button.textContent = editor.existing ? 'Save changes' : 'Create routine';
    }
});
document.addEventListener('change', event => {
    if (event.target.id === 'backup-file') importBackup(event.target.files[0]);
});
window.addEventListener('hashchange', () => {
    const p = location.hash.slice(1);
    if (['today', 'calendar', 'statistics', 'routines', 'notes', 'settings'].includes(p) && p !== page) {
        page = p;
        render();
    }
});
window.addEventListener('online', () => {
    render();
    refresh(true);
});
window.addEventListener('offline', render);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        const next = dateKey(new Date(), data.timezone);
        if (next !== today) {
            if (selected === today) selected = next;
            today = next;
            calendarYear = Number(today.slice(0, 4));
            render();
        }
        refresh(true);
    }
});
setInterval(() => {
    if (!document.hidden) {
        const next = dateKey(new Date(), data.timezone);
        if (next !== today) {
            if (selected === today) selected = next;
            today = next;
            render();
        }
        refresh(true);
    }
}, 30000);
render();
(async () => {
    try {
        const config = await request('/api/auth/config');
        authMode = config.mode;
        await refresh(true);
    } catch (e) {
        loadError = e.message;
        render();
    }
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {
});
const modelContext = document.modelContext;
if (modelContext?.registerTool) {
    try {
        Promise.resolve(modelContext.registerTool({
            name: 'get_ember_day',
            title: 'Read Ember daily progress',
            description: 'Read scheduled routines and completion counts for a calendar day.',
            inputSchema: {
                type: 'object',
                properties: {date: {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$'}},
                required: ['date'],
                additionalProperties: false
            },
            annotations: {readOnlyHint: true, untrustedContentHint: true},
            execute(input) {
                if (!ready) throw new Error('Routines are still loading.');
                if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(+parseDate(input.date)) || parseDate(input.date).toISOString().slice(0, 10) !== input.date) throw new Error('Use a valid date in YYYY-MM-DD format.');
                return {
                    date: input.date, ...dayProgress(data, input.date),
                    routines: data.routines.filter(r => isScheduled(r, input.date)).map(r => ({name: revisionAt(r, input.date).name, ...routineProgress(data, r, input.date)}))
                };
            }
        })).catch(() => {
        });
    } catch {
    }
}
