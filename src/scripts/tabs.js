// Helper to add timeout to promises
const withTimeout = (promise, timeoutMs) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        )
    ]);
};

export let runPerTab = async (f) => {
    const tabs = await chrome.tabs.query({});
    // Use Promise.allSettled instead of Promise.all to not fail on individual errors
    const results = await Promise.allSettled(tabs.map(f));
    // Return only successful results, filter out failures
    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
};

export let getTabContent = async (tab) => {
    const tabInfo = {
        id: tab.id,
        title: tab.title || '',
        url: tab.url || '',
        text: ''
    };

    // Only scrape content from http/https pages
    if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        try {
            // Add 1 second timeout to prevent hanging
            const results = await withTimeout(
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        // Get first 2000 chars, clean up whitespace
                        const text = document.body.innerText || '';
                        return text.substring(0, 2000).replace(/\s+/g, ' ').trim();
                    },
                }),
                1000 // 1 second timeout
            );
            tabInfo.text = results[0].result || '';
        } catch (error) {
            // Silently fail for tabs where we can't inject scripts or timeout
            console.log(`Failed to scrape tab ${tab.id} (${tab.url}):`, error.message);
        }
    }

    return tabInfo;
};
