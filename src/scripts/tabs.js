export let runPerTab = async (f) => {
    const tabs = await chrome.tabs.query({});
    return await Promise.all(tabs.map(f));
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
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Get first 2000 chars, clean up whitespace
                    const text = document.body.innerText || '';
                    return text.substring(0, 2000).replace(/\s+/g, ' ').trim();
                },
            });
            tabInfo.text = results[0].result || '';
        } catch (error) {
            // Silently fail for tabs where we can't inject scripts
        }
    }

    return tabInfo;
};
