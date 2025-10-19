// Searches browser history and normalizes items to match tab data structure
// Note: manifest needs the "history" permission.

export async function getHistoryItems(query, { maxResults = 20 } = {}) {
    try {
        // Allow empty query to fetch recent history
        const results = await chrome.history.search({
            text: query || '',
            maxResults,
            startTime: 0
        });

        // Normalize to match tab data structure
        return (results || []).map((item) => ({
            id: `history-${item.url}`, // Use URL as unique ID for history items
            title: item.title || item.url || '',
            url: item.url || '',
            text: '', // History items don't have page content
            isHistory: true, // Mark as history item
            lastVisitTime: item.lastVisitTime || 0
        }));
    } catch (error) {
        console.error('Failed to search history:', error);
        return [];
    }
}