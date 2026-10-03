// Variables used by Scriptable.
// icon-color: deep-orange; icon-glyph: fire;
// Ember 1.2 — private, read-only Home Screen widgets.
// Save this file in iCloud Drive / Scriptable, then run it in Scriptable once.
// The widget key is stored in iOS Keychain, never in the script or widget parameter.

const APP_URL = 'http://127.0.0.1:8123';
const KEY_NAME = 'ember-widget:' + APP_URL;
const fm = FileManager.local();
const cacheFile = fm.joinPath(fm.cacheDirectory(), 'ember-widget-v1.json');
const COLORS = ['282a2d', '613821', 'a25a2f', 'df864e', 'ffba83'];
const accent = new Color('ffad7b');
const muted = new Color('a5a5a7');
const white = new Color('f2f1ed');

function clearCache() {
    if (fm.fileExists(cacheFile)) fm.remove(cacheFile);
}

async function connect() {
    const prompt = new Alert();
    prompt.title = 'Connect Ember';
    prompt.message = 'In Ember → Settings → Connect widget, create a key. Paste it here. It can only read your progress.';
    prompt.addSecureTextField('Widget key');
    prompt.addAction('Connect');
    prompt.addCancelAction('Cancel');
    if (await prompt.presentAlert() < 0) return false;
    const token = prompt.textFieldValue(0).trim();
    if (!/^[a-f0-9]{64}$/.test(token)) {
        const error = new Alert();
        error.title = 'Invalid key';
        error.message = 'Copy the complete key from Ember Settings.';
        error.addAction('OK');
        await error.presentAlert();
        return false;
    }
    try {
        const data = await fetchProgress(token);
        Keychain.set(KEY_NAME, token);
        clearCache();
        saveCache(data);
        return true;
    } catch (failure) {
        const error = new Alert();
        error.title = 'Could not connect';
        error.message = failure.message;
        error.addAction('OK');
        await error.presentAlert();
        return false;
    }
}

function validData(data) {
    return data && data.schema === 1 && typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) &&
        Number.isFinite(Date.parse(data.generatedAt)) && data.progress && Number.isInteger(data.progress.done) &&
        Number.isInteger(data.progress.total) && data.progress.done >= 0 && data.progress.total >= data.progress.done &&
        data.streak && Number.isInteger(data.streak.current) && data.streak.current >= 0 &&
        Array.isArray(data.routines) && data.routines.length <= 100 &&
        data.routines.every(r => typeof r.name === 'string' && Number.isInteger(r.done) && Number.isInteger(r.total) && r.done >= 0 && r.total >= r.done) &&
        Array.isArray(data.activity) && data.activity.length === 84 &&
        data.activity.every(d => Number.isInteger(d.level) && d.level >= 0 && d.level <= 4 && typeof d.future === 'boolean');
}

function saveCache(data) {
    try {
        fm.writeString(cacheFile, JSON.stringify({origin: APP_URL, data}));
    } catch { /* A cache failure must not hide fresh data. */
    }
}

async function fetchProgress(token) {
    const req = new Request(APP_URL + '/api/widget');
    req.headers = {Authorization: 'Bearer ' + token, Accept: 'application/json'};
    req.timeoutInterval = 12;
    // Never forward a widget credential through a redirect to another service.
    req.onRedirect = () => null;
    const raw = await req.loadString();
    const status = req.response && req.response.statusCode;
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error('Ember is behind a sign-in page. Finish email sign-in setup before connecting Scriptable.');
    }
    if (status === 401 && typeof data?.error === 'string') {
        const error = new Error('Widget disconnected. Create a new key in Ember Settings, then run this script.');
        error.invalidKey = true;
        throw error;
    }
    if (status !== 200) throw new Error('Could not sync. Check your connection and try again.');
    if (!validData(data)) throw new Error('Ember returned an unexpected response. Try downloading the latest script.');
    return data;
}

async function loadProgress() {
    if (!Keychain.contains(KEY_NAME)) return {error: 'Run this script in Scriptable to connect your widget.'};
    try {
        const data = await fetchProgress(Keychain.get(KEY_NAME));
        saveCache(data);
        return {data, cached: false};
    } catch (failure) {
        if (failure.invalidKey) {
            Keychain.remove(KEY_NAME);
            clearCache();
            return {error: failure.message};
        }
        try {
            const cached = JSON.parse(fm.readString(cacheFile));
            if (cached.origin === APP_URL && validData(cached.data)) return {data: cached.data, cached: true};
        } catch { /* No usable local snapshot. */
        }
        return {error: failure.message || 'Could not sync. Open Ember and check your connection.'};
    }
}

function text(container, value, size, color = white, weight = 'regular') {
    const item = container.addText(String(value));
    item.font = weight === 'bold' ? Font.boldSystemFont(size) : weight === 'medium' ? Font.mediumSystemFont(size) : Font.systemFont(size);
    item.textColor = color;
    item.lineLimit = 1;
    item.minimumScaleFactor = 0.75;
    return item;
}

function flame(container, size) {
    const symbol = SFSymbol.named('flame.fill');
    const item = container.addImage(symbol.image);
    item.imageSize = new Size(size, size);
    item.tintColor = accent;
}

function heatmap(days, width) {
    const ctx = new DrawContext();
    ctx.size = new Size(width, 70);
    ctx.opaque = false;
    ctx.respectScreenScale = true;
    const gap = 3, cell = Math.min(8, (width - 33) / 12), step = cell + gap;
    days.forEach((day, i) => {
        ctx.setFillColor(new Color(day.future ? '202123' : COLORS[day.level]));
        const path = new Path();
        path.addRoundedRect(new Rect(Math.floor(i / 7) * step, (i % 7) * 10, cell, cell), 2, 2);
        ctx.addPath(path);
        ctx.fillPath();
    });
    return ctx.getImage();
}

function progressBar(progress, width) {
    const ctx = new DrawContext();
    ctx.size = new Size(width, 5);
    ctx.opaque = false;
    ctx.respectScreenScale = true;
    ctx.setFillColor(new Color('36312e'));
    ctx.fillRect(new Rect(0, 0, width, 5));
    if (progress.total) {
        ctx.setFillColor(accent);
        ctx.fillRect(new Rect(0, 0, width * progress.done / progress.total, 5));
    }
    return ctx.getImage();
}

function makeWidget(result, family) {
    const widget = new ListWidget();
    const gradient = new LinearGradient();
    gradient.colors = [new Color('29211c'), new Color('151618')];
    gradient.locations = [0, 1];
    widget.backgroundGradient = gradient;
    widget.setPadding(family === 'medium' ? 12 : 16, 16, 12, 16);
    widget.url = APP_URL + '/#today';
    // This is the earliest requested refresh; iOS controls the actual schedule.
    widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    if (result.error) {
        flame(widget, 26);
        widget.addSpacer(10);
        text(widget, 'ember.', 20, white, 'bold');
        widget.addSpacer(7);
        const detail = text(widget, result.error, 12, muted);
        detail.lineLimit = 5;
        return widget;
    }
    const data = result.data, small = family === 'small', large = family === 'large';
    const heading = widget.addStack();
    heading.centerAlignContent();
    text(heading, 'ember.', 15, white, 'bold');
    heading.addSpacer();
    flame(heading, 17);
    widget.addSpacer(small ? 8 : family === 'medium' ? 6 : 10);
    const body = widget.addStack();
    body.centerAlignContent();
    const stats = body.addStack();
    stats.layoutVertically();
    const number = stats.addStack();
    number.bottomAlignContent();
    text(number, data.streak.current, small ? 37 : 39, accent, 'bold');
    number.addSpacer(5);
    text(number, data.streak.current === 1 ? 'day' : 'days', 13, muted);
    number.addSpacer();
    stats.addSpacer(4);
    text(stats, data.progress.total ? `${data.progress.done} / ${data.progress.total} steps` : 'Rest day', 13, white, 'medium');
    stats.addSpacer(6);
    const bar = stats.addImage(progressBar(data.progress, small ? 112 : 108));
    bar.imageSize = new Size(small ? 112 : 108, 5);
    if (!small) {
        body.addSpacer();
        const history = body.addStack();
        history.layoutVertically();
        text(history, 'LAST 12 WEEKS', 9, muted, 'medium');
        history.addSpacer(6);
        const grid = history.addImage(heatmap(data.activity, 129));
        grid.imageSize = new Size(129, 70);
    }
    if (large) {
        widget.addSpacer(17);
        text(widget, 'YOUR ROUTINES', 10, muted, 'medium');
        widget.addSpacer(8);
        data.routines.slice(0, 4).forEach(r => {
            const row = widget.addStack();
            row.centerAlignContent();
            const name = text(row, r.name, 13, white, 'medium');
            name.lineLimit = 1;
            row.addSpacer();
            text(row, `${r.done}/${r.total}`, 12, r.complete ? accent : muted);
            widget.addSpacer(7);
        });
        if (data.routines.length > 4) text(widget, `+${data.routines.length - 4} more in Ember`, 11, muted);
        if (!data.routines.length) text(widget, 'Room to breathe today.', 13, muted);
    }
    widget.addSpacer();
    const date = new Date(data.generatedAt);
    const stamp = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    text(widget, result.cached ? `Saved ${data.date.slice(5)} · ${stamp}` : `${data.date.slice(5)} · Updated ${stamp}`, small ? 9 : 10, muted);
    return widget;
}

async function main() {
    let family = config.widgetFamily || 'medium';
    if (config.runsInApp) {
        if (!Keychain.contains(KEY_NAME)) {
            if (!await connect()) return;
        } else {
            const menu = new Alert();
            menu.title = 'Ember widget';
            menu.message = 'Preview your widget or replace its key.';
            menu.addAction('Small preview');
            menu.addAction('Medium preview');
            menu.addAction('Large preview');
            menu.addAction('Replace widget key');
            menu.addCancelAction('Cancel');
            const selected = await menu.presentSheet();
            if (selected < 0) return;
            if (selected === 3) {
                if (!await connect()) return;
                family = 'medium';
            } else family = ['small', 'medium', 'large'][selected];
        }
    }
    const result = await loadProgress();
    const widget = makeWidget(result, family);
    Script.setWidget(widget);
    if (config.runsInApp) {
        if (family === 'small') await widget.presentSmall(); else if (family === 'large') await widget.presentLarge(); else await widget.presentMedium();
    }
}

await main();
Script.complete();
