export function createAPIClient(fetchImpl = (...args) => fetch(...args)) {
    let generation = 0;
    return {
        get generation() {
            return generation;
        },
        invalidate() {
            generation++;
        },
        async request(path, options = {}) {
            const started = generation, controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const assertCurrent = () => {
                if (started !== generation) throw Object.assign(new Error('Your sign-in changed. Please try again.'), {code: 'SESSION_CHANGED'});
            };
            try {
                const response = await fetchImpl(path, {
                    credentials: 'same-origin',
                    cache: 'no-store', ...options,
                    signal: controller.signal
                });
                assertCurrent();
                if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Please sign in again to reconnect your account.');
                const result = await response.json();
                assertCurrent();
                if (!response.ok) throw Object.assign(new Error(result.error || 'Something went wrong. Please try again.'), {status: response.status});
                return result;
            } catch (error) {
                assertCurrent();
                if (error.name === 'AbortError') throw new Error('The connection timed out. Refresh to check whether your changes were saved.');
                if (error instanceof TypeError) throw new Error('Could not connect. Check your internet connection and try again.');
                throw error;
            } finally {
                clearTimeout(timer);
            }
        }
    };
}
