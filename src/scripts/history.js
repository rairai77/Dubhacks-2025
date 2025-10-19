// Small helper that searches history and normalizes items to the same shape
// returned by getTabContent: { html, text, title, url }
// Note: manifest needs the "history" permission.

async function searchHistory(keywords, { maxResults = 100, startTime = 0 } = {}) {
    if (!keywords) return [];
    return new Promise((resolve, reject) => {
        chrome.history.search(
            { text: keywords, maxResults, startTime },
            (results) => {
                if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                resolve(results || []);
            }
        );
    });
}

function normalizeHistoryItem(item) {
    return {
        // history items don't contain page source/text, keep empty to match tab shape
        html: "",
        text: "",
        title: item.title || "",
        url: item.url || "",
    };
}

async function runPerHistory(keywords, f, options = {}) {
    const items = await searchHistory(keywords, options);
    const normalized = items.map(normalizeHistoryItem);
    const calls = normalized.map((n) => {
        try {
            return f(n);
        } catch (err) {
            return Promise.reject(err);
        }
    });
    return Promise.all(calls);
}