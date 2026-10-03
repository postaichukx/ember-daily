import {isWeekly} from './model.js';
import {completionBuckets, PERIODS, routineStatistics, weeklyStatistics} from './statistics.js';

export function renderStatistics({data, today, period, routineId, icon, esc, format}) {
    const s = routineStatistics(data, today, period, routineId), buckets = completionBuckets(s.days);
    const width = n => s.scheduled ? n / s.scheduled * 100 : 0;
    const selected = data.routines.find(r => r.id === routineId);
    const name = selected?.versions.at(-1).name || 'All routines';
    const weekly = weeklyStatistics(data, today, period, routineId);
    const onlyWeekly = (selected && selected.versions.every(isWeekly)) || (!s.scheduled && weekly.length > 0);
    const max = Math.max(1, ...buckets.map(b => b.scheduled));
    return `<header class="page-heading statistics-heading"><div><h1>Statistics<span class="brand-dot">.</span></h1><p>Daily routines and weekly goals.</p></div><label class="period-picker"><span class="sr-only">Statistics period</span><select id="stats-period" data-focus-key="stats-period">${PERIODS.map(p => `<option value="${p.value}" ${p.value === period ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label></header>
  <div class="routine-filters" role="group" aria-label="Filter statistics by routine"><button data-stats-routine="all" data-focus-key="filter-all" aria-pressed="${routineId === 'all'}" class="routine-filter ${routineId === 'all' ? 'selected' : ''}">${icon('routines')}<span>All routines</span></button>${data.routines.map(r => {
        const v = r.versions.at(-1);
        return `<button class="routine-filter ${v.color} ${r.id === routineId ? 'selected' : ''}" data-stats-routine="${r.id}" data-focus-key="filter-${r.id}" aria-pressed="${r.id === routineId}">${icon(v.icon)}<span>${esc(v.name)}${r.archivedOn ? '<small>Archived</small>' : ''}</span></button>`;
    }).join('')}</div>
  ${renderWeeklyStatistics(weekly, esc)}
  ${onlyWeekly ? '' : `<div class="statistics-context"><h2>${esc(name)}${weekly.length ? ' · Daily schedule' : ''}</h2><span>${s.activeDays} scheduled ${s.activeDays === 1 ? 'day' : 'days'}</span></div>
  ${!s.scheduled ? '<div class="notice">No scheduled routines in this period. Your stats will appear as you go.</div>' : ''}
  <div class="statistics-grid"><section class="stat-card completion-card"><h3>Completion</h3><div class="stat-value">${s.percent === null ? '—' : s.percent + '%'}<span>${s.completed} of ${s.scheduled} routines</span></div><div class="completion-bar" role="img" aria-label="${s.completed} completed, ${s.missed} missed, ${s.pending} remaining today"><i class="completed" style="width:${width(s.completed)}%"></i><i class="missed" style="width:${width(s.missed)}%"></i><i class="pending" style="width:${width(s.pending)}%"></i></div><div class="completion-key"><span><i class="completed"></i>${s.completed} completed</span><span><i class="missed"></i>${s.missed} missed</span>${s.pending ? `<span><i class="pending"></i>${s.pending} left today</span>` : ''}</div><p class="stat-note">A routine counts when every step is done. Rest days are excluded.</p></section>
  <section class="stat-card"><h3>${icon('flame')}Streak</h3><div class="stat-value">${s.current}<span>${s.current === 1 ? 'day' : 'days'} · current streak</span></div><div class="stat-secondary"><strong>${s.best}</strong><span>Best in this period</span></div><p class="stat-note">Current streak can start before this period. Rest days keep it going.</p></section>
  <section class="stat-card"><h3>Completed routines</h3><div class="stat-value">${s.completed}<span>in this period</span></div><div class="stat-secondary"><strong>${s.average.toFixed(1)}</strong><span>Average per scheduled day</span></div></section>
  <section class="stat-card"><h3>${routineId === 'all' ? 'Perfect days' : 'Completed days'}</h3><div class="stat-value">${s.perfectDays}<span>of ${s.activeDays} scheduled days</span></div><p class="stat-note">${routineId === 'all' ? 'Every planned routine finished.' : 'Every step of this routine finished.'}</p></section>
  <section class="stat-card trend-card"><div class="chart-heading"><h3>Completions over time</h3><span>${buckets.length && s.days.length > buckets.length ? 'Grouped days' : 'Daily'}</span></div><div class="completion-chart" role="img" aria-label="Completed routines by ${s.days.length > buckets.length ? 'group of days' : 'day'}. Exact values in the table below.">${buckets.map(b => `<div class="chart-column" title="${format(b.from, {
        month: 'short',
        day: 'numeric'
    })}${b.to === b.from ? '' : ' – ' + format(b.to, {
        month: 'short',
        day: 'numeric'
    })}: ${b.completed} of ${b.scheduled}"><div class="chart-planned" style="height:${b.scheduled / max * 100}%"><div style="height:${b.scheduled ? b.completed / b.scheduled * 100 : 0}%"></div></div></div>`).join('')}</div><div class="chart-labels"><span>${format(s.from, {
        month: 'short',
        day: 'numeric'
    })}</span><span>${format(today, {
        month: 'short',
        day: 'numeric'
    })}</span></div><p class="stat-note">Filled bars show completed routines; muted bars show the schedule.</p><details class="chart-values"><summary>View exact counts</summary><div class="table-scroll"><table><caption>Routine completions</caption><thead><tr><th scope="col">Period</th><th scope="col">Completed</th><th scope="col">Scheduled</th></tr></thead><tbody>${buckets.map(b => `<tr><th scope="row">${esc(b.from)}${b.to === b.from ? '' : ' – ' + esc(b.to)}</th><td>${b.completed}</td><td>${b.scheduled}</td></tr>`).join('')}</tbody></table></div></details></section></div>`}`;
}

function renderWeeklyStatistics(rows, esc) {
    if (!rows.length) return '';
    return `<section class="weekly-statistics"><h2>Weekly goals</h2><p class="stat-note">Whole Monday–Sunday weeks overlapping this period. The current week stays open until Sunday ends. Daily streaks are tracked separately.</p><div class="notes-grid">${rows.map(r => `<article class="stat-card"><h3>${esc(r.name)}</h3><div class="stat-value">${r.completedWeeks}<span>of ${r.weeks.length} weekly goals reached</span></div><div class="stat-secondary"><strong>${r.current}</strong><span>week streak · best ${r.best}</span></div><p class="stat-note">${r.completions} ${r.completions === 1 ? 'completion' : 'completions'} · ${r.missedWeeks} missed weeks</p><details class="chart-values"><summary>View weeks</summary><ul class="week-results">${r.weeks.slice().reverse().map(w => `<li><span>${w.from} – ${w.to}</span><strong>${w.done} / ${w.target}${w.complete ? ' ✓' : ''}</strong></li>`).join('')}</ul></details></article>`).join('')}</div></section>`;
}
