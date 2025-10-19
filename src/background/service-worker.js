import { fuzzySearch } from "../scripts/fuzzySearch.js";
import { runPerTab, getTabContent } from "../scripts/tabs.js";
import { getHistoryItems } from "../scripts/history.js";

chrome.omnibox.setDefaultSuggestion({ description: "Search your tabs" });

// Cache for omnibox session data
let cachedTabData = null;
let cachedHistoryData = null;

// Reset cache when user starts typing (first input)
chrome.omnibox.onInputStarted.addListener(() => {
    cachedTabData = null;
    cachedHistoryData = null;
});

// when typing
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    // Store the query so other parts of extension can read it
    chrome.storage.local.set({ lastOmniboxQuery: text });

    // Get both tabs and history items (use cache if available)
    if (!cachedTabData || !cachedHistoryData) {
        [cachedTabData, cachedHistoryData] = await Promise.all([
            runPerTab((tab) => getTabContent(tab)),
            getHistoryItems(text, { maxResults: 20 })
        ]);
    }

    // Combine tabs and history for searching
    const allData = [...cachedTabData, ...cachedHistoryData];

    const results = fuzzySearch(text, allData);

    if (results.length > 0) {
        // Set the top match as the default suggestion
        const topMatch = results[0];
        const description = topMatch.isHistory
            ? `[History] ${topMatch.title || topMatch.url}`
            : `${topMatch.title || topMatch.url}`;

        chrome.omnibox.setDefaultSuggestion({ description });

        // Store the top match info for when user presses enter without selecting
        chrome.storage.local.set({
            topMatchId: topMatch.id,
            topMatchIsHistory: topMatch.isHistory || false,
            topMatchUrl: topMatch.url
        });

        // Show remaining matches as suggestions
        const matches = results.slice(1, 7).map((t) => {
            const description = t.isHistory
                ? `[History] ${t.title || t.url}`
                : `${t.title || t.url}`;
            return {
                content: String(t.id),
                description
            };
        });
        suggest(matches);
    } else {
        chrome.omnibox.setDefaultSuggestion({ description: "No matching tabs" });
        suggest([]);
    }
});

// when you press enter
chrome.omnibox.onInputEntered.addListener(async (text) => {
    // Store final query
    chrome.storage.local.set({ lastOmniboxQuery: text });

    // Check if text is a tab ID (number) or history ID (string starting with "history-")
    const isHistoryId = typeof text === 'string' && text.startsWith('history-');
    const tabId = Number(text);

    if (isHistoryId) {
        // Extract URL from history ID
        const url = text.replace('history-', '');
        // Open history item in current tab
        chrome.tabs.update({ url });
    } else if (!Number.isNaN(tabId)) {
        // It's a tab ID, switch to it
        try {
            // Get current tab to check if it's a new tab
            const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const isNewTab = currentTab && (
                currentTab.url === 'chrome://newtab/' ||
                currentTab.url === 'chrome://new-tab-page/' ||
                currentTab.url === 'about:newtab' ||
                currentTab.url === 'edge://newtab/'
            );

            const tab = await chrome.tabs.get(tabId);
            await chrome.windows.update(tab.windowId, { focused: true });
            await chrome.tabs.update(tabId, { active: true });

            // Close the new tab after switching
            if (isNewTab && currentTab.id !== tabId) {
                chrome.tabs.remove(currentTab.id);
            }
        } catch (error) {
            console.error('Failed to switch to tab:', error);
        }
    } else {
        // Use the top match from storage (default suggestion)
        const storage = await chrome.storage.local.get(['topMatchId', 'topMatchIsHistory', 'topMatchUrl']);

        if (storage.topMatchIsHistory) {
            // Open history URL in current tab
            chrome.tabs.update({ url: storage.topMatchUrl });
        } else if (storage.topMatchId) {
            // Switch to tab
            try {
                // Get current tab to check if it's a new tab
                const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const isNewTab = currentTab && (
                    currentTab.url === 'chrome://newtab/' ||
                    currentTab.url === 'chrome://new-tab-page/' ||
                    currentTab.url === 'about:newtab' ||
                    currentTab.url === 'edge://newtab/'
                );

                const tab = await chrome.tabs.get(storage.topMatchId);
                await chrome.windows.update(tab.windowId, { focused: true });
                await chrome.tabs.update(storage.topMatchId, { active: true });

                // Close the new tab after switching
                if (isNewTab && currentTab.id !== storage.topMatchId) {
                    chrome.tabs.remove(currentTab.id);
                }
            } catch (error) {
                console.error('Failed to switch to tab:', error);
            }
        }
    }
});
