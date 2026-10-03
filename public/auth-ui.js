const escape = value => String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

export function createAuthUI({root, icon, request, onSuccess}) {
    let email = '', challenge = '', error = '', pending = false, retryAt = 0, mode = 'email';

    function show(nextMode = mode) {
        mode = nextMode;
        root.innerHTML = `<main id="main" class="auth-page"><a class="brand" href="#today" aria-label="Ember">${icon('flame')}<span>ember<span class="brand-dot">.</span></span></a><section class="auth-card" aria-labelledby="auth-title"><div class="auth-spark">${icon('flame')}</div><span class="eyebrow">YOUR DAILY RHYTHM</span><h1 id="auth-title">${challenge ? 'Check your inbox.' : 'Keep your spark.'}</h1><p>${challenge ? `Enter the 6-digit code sent to <strong>${escape(email)}</strong>. It expires in 10 minutes.` : 'Your routines, together in one place. Sign in to pick up where you left off.'}</p>${mode === 'platform' ? '<a class="button primary" target="_top" href="/signin-with-chatgpt?return_to=%2F">Sign in with ChatGPT</a>' : `<form id="email-login-form"><label class="field-label" for="login-value">${challenge ? 'Sign-in code' : 'Email address'}</label><input id="login-value" name="${challenge ? 'code' : 'email'}" type="${challenge ? 'text' : 'email'}" ${challenge ? 'inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code"' : 'autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="254"'} value="${challenge ? '' : escape(email)}" placeholder="${challenge ? '000000' : 'you@example.com'}" required ${pending ? 'disabled' : ''}><p class="form-error" id="login-error" role="alert">${escape(error)}</p><button class="button primary" type="submit" ${pending ? 'disabled' : ''}>${pending ? 'Please wait…' : challenge ? 'Verify & sign in' : 'Send sign-in code'}${icon('chevron')}</button></form>${challenge ? '<div class="auth-links"><button type="button" data-auth="change">Change email</button><button type="button" data-auth="resend">Resend code</button></div><p class="auth-help">Can’t find it? Check Spam. If this address has access, you’ll receive an email.</p>' : '<p class="auth-help">No password to remember. Only the owner’s email has access.</p>'}`}</section><p class="auth-footer">Small steps. Lasting change.</p></main>`;
        updateCooldown();
    }

    function updateCooldown() {
        const button = root.querySelector('[data-auth="resend"]');
        if (!button) return;
        const seconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
        button.disabled = pending || seconds > 0;
        button.textContent = seconds ? `Resend in ${seconds}s` : 'Resend code';
        const change = root.querySelector('[data-auth="change"]');
        if (change) change.disabled = pending;
    }

    async function send() {
        const result = await request('/api/auth/request-code', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email})
        });
        challenge = result.challenge;
        retryAt = Date.now() + result.retryAfter * 1000;
    }

    root.addEventListener('submit', async event => {
        if (event.target.id !== 'email-login-form') return;
        event.preventDefault();
        if (pending) return;
        const value = root.querySelector('#login-value').value.trim();
        if (!challenge) email = value.toLowerCase();
        const verifying = !!challenge;
        pending = true;
        error = '';
        show();
        try {
            if (verifying) {
                await request('/api/auth/verify-code', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({email, challenge, code: value})
                });
                pending = false;
                await onSuccess();
                return;
            }
            await send();
        } catch (e) {
            error = e.message;
        }
        pending = false;
        show();
        root.querySelector('#login-value')?.focus();
    });
    root.addEventListener('click', async event => {
        const button = event.target.closest('[data-auth]');
        if (!button || button.disabled || pending) return;
        if (button.dataset.auth === 'change') {
            challenge = '';
            error = '';
            show();
            root.querySelector('#login-value')?.focus();
            return;
        }
        pending = true;
        error = '';
        show();
        try {
            await send();
        } catch (e) {
            error = e.message;
        }
        pending = false;
        show();
        root.querySelector('#login-value')?.focus();
    });
    setInterval(updateCooldown, 1000);
    return {
        show, reset() {
            email = '';
            challenge = '';
            error = '';
            pending = false;
            retryAt = 0;
        }
    };
}
