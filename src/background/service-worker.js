import { fuzzySearch } from "../scripts/fuzzySearch.js";
import { runPerTab, getTabContent } from "../scripts/tabs.js";
import { getHistoryItems } from "../scripts/history.js";

console.log('TabTrap service worker loaded');

chrome.omnibox.setDefaultSuggestion({ description: "Search your tabs" });

// Cache for omnibox session data
let cachedTabData = null;
let cachedHistoryData = null;
let lastQuery = '';
let pendingUpdate = false;

// Pre-fetch data when user starts typing (don't block on it)
chrome.omnibox.onInputStarted.addListener(async () => {
    console.log('Omnibox started, pre-fetching data');
    cachedTabData = null;
    cachedHistoryData = null;
    lastQuery = '';
    pendingUpdate = false;

    try {
        [cachedTabData, cachedHistoryData] = await Promise.all([
            runPerTab((tab) => getTabContent(tab)),
            getHistoryItems('', { maxResults: 20 })
        ]);
        console.log('Pre-fetch complete:', cachedTabData.length, 'tabs');

        // Trigger update if user is still waiting
        if (pendingUpdate && lastQuery !== '') {
            console.log('Data loaded, triggering update for:', lastQuery);
            chrome.omnibox.setDefaultSuggestion({
                description: `Search for "${lastQuery}"...`
            });
        }
    } catch (error) {
        console.error('Pre-fetch error:', error);
    }
});

// when typing
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    console.log('Omnibox input changed:', text);
    lastQuery = text;

    try {
        // Store the query so other parts of extension can read it
        chrome.storage.local.set({ lastOmniboxQuery: text });

        // If data isn't ready yet, show a loading message and mark pending
        if (!cachedTabData || !cachedHistoryData) {
            console.log('Data not ready yet, showing loading message');
            pendingUpdate = true;
            chrome.omnibox.setDefaultSuggestion({ description: "Loading tabs..." });
            suggest([]);

            // Poll for data and update when ready (with timeout)
            const startTime = Date.now();
            const pollInterval = setInterval(() => {
                if (cachedTabData && cachedHistoryData) {
                    clearInterval(pollInterval);
                    console.log('Data ready, re-running search');
                    // Manually trigger the search logic
                    performSearch(text, suggest);
                } else if (Date.now() - startTime > 5000) {
                    // Timeout after 5 seconds
                    clearInterval(pollInterval);
                    console.log('Timeout waiting for data');
                }
            }, 100); // Check every 100ms

            return;
        }

        performSearch(text, suggest);
    } catch (error) {
        console.error('Error in onInputChanged:', error);
        chrome.omnibox.setDefaultSuggestion({ description: "Error: " + error.message });
        suggest([]);
    }
});

// Extract search logic into separate function
function performSearch(text, suggest) {
    try {
        // Combine tabs and history for searching
        const allData = [...cachedTabData, ...cachedHistoryData];

        console.log('All data count:', allData.length, '(tabs:', cachedTabData.length, 'history:', cachedHistoryData.length, ')');
        const results = fuzzySearch(text, allData);
        console.log('Search results count:', results.length);
        console.log('Top 3 results:', results.slice(0, 3).map(r => ({ title: r.title, score: r.score, isHistory: r.isHistory })));

        if (results.length > 0) {
            // Helper function to escape XML special characters
            const escapeXml = (text) => {
                if (!text) return '';
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
            };

            // Helper function to highlight exact matches in text
            const highlightMatch = (text, query) => {
                if (!text || !query) return escapeXml(text);
                const lowerText = text.toLowerCase();
                const lowerQuery = query.toLowerCase();
                const index = lowerText.indexOf(lowerQuery);

                if (index === -1) return escapeXml(text);

                // Build highlighted string with <match> tags
                const before = escapeXml(text.substring(0, index));
                const match = escapeXml(text.substring(index, index + query.length));
                const after = escapeXml(text.substring(index + query.length));

                return `${before}<match>${match}</match>${after}`;
            };

            // Set the top match as the default suggestion
            const topMatch = results[0];
            const topTitle = topMatch.title || topMatch.url;
            const topHighlighted = highlightMatch(topTitle, text);
            const topDescription = topMatch.isHistory
                ? `[History] ${topHighlighted}`
                : topHighlighted;

            chrome.omnibox.setDefaultSuggestion({ description: topDescription });

            // Store the top match info for when user presses enter without selecting
            chrome.storage.local.set({
                topMatchId: topMatch.id,
                topMatchIsHistory: topMatch.isHistory || false,
                topMatchUrl: topMatch.url
            });

            // Show remaining matches as suggestions
            const matches = results.slice(1, 7).map((t) => {
                const title = t.title || t.url;
                const highlighted = highlightMatch(title, text);
                const description = t.isHistory
                    ? `[History] ${highlighted}`
                    : highlighted;
                return {
                    content: String(t.id),
                    description
                };
            });
            console.log('Calling suggest with', matches.length, 'matches');
            suggest(matches);
        } else {
            console.log('No results, showing no matching tabs');
            chrome.omnibox.setDefaultSuggestion({ description: "No matching tabs" });
            suggest([]);
        }
    } catch (error) {
        console.error('Error in performSearch:', error);
        chrome.omnibox.setDefaultSuggestion({ description: "Error: " + error.message });
        suggest([]);
    }
}

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
