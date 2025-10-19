import { fuzzySearch } from "../scripts/fuzzySearch.js";
import { runPerTab, getTabContent } from "../scripts/tabs.js";

chrome.omnibox.setDefaultSuggestion({ description: "Search your tabs" });

// when typing
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    // Store the query so other parts of extension can read it
    chrome.storage.local.set({ lastOmniboxQuery: text });

    const tabData = await runPerTab((tab) => {
        return getTabContent(tab);
    });

    const results = fuzzySearch(text, tabData);

    if (results.length > 0) {
        // Set the top match as the default suggestion
        chrome.omnibox.setDefaultSuggestion({
            description: `${results[0].title || results[0].url}`
        });

        // Store the top match ID for when user presses enter without selecting
        chrome.storage.local.set({ topMatchId: results[0].id });

        // Show remaining matches as suggestions
        const matches = results.slice(1, 7).map((t) => ({
            content: String(t.id),
            description: `${t.title || t.url}`,
        }));
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

    // Check if text is a tab ID (from clicking a suggestion)
    let tabId = Number(text);

    // If not a valid number, use the top match from storage
    if (Number.isNaN(tabId)) {
        const storage = await chrome.storage.local.get('topMatchId');
        tabId = storage.topMatchId;
    }

    // Activate selected tab and switch to its window
    if (tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            await chrome.windows.update(tab.windowId, { focused: true });
            await chrome.tabs.update(tabId, { active: true });
        } catch (error) {
            console.error('Failed to switch to tab:', error);
        }
    }
});
