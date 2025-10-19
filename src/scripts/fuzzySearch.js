import Fuse from "../../lib/fuse.mjs";

/**
 * Fuzzy search webpage objects by query.
 * @param {string} query - The search text from omnibox or user input.
 * @param {Array<Object>} data - Array of webpage objects {title, url, text, id}.
 * @returns {Array<Object>} Ranked Fuse.js results with match scores.
 */
export function fuzzySearch(query, data) {
    if (!query || !Array.isArray(data)) return [];

    const fuse = new Fuse(data, {
        includeScore: true,
        shouldSort: true,
        threshold: 0.6, // higher = more results (0.0 = exact, 1.0 = match anything)
        ignoreLocation: true, // Don't penalize matches based on position in text
        keys: [
            { name: "title", weight: 0.4 },
            { name: "text", weight: 0.4 },
            { name: "url", weight: 0.2 },
        ],
    });

    const results = fuse.search(query);

    // Map Fuse.js results and adjust scores for history items
    return results.map((r) => {
        const item = {
            score: r.score,
            ...r.item,
        };

        // Penalize history items by increasing their score (worse ranking)
        // History items need stricter matching and rank lower
        if (item.isHistory) {
            item.score = Math.min(1.0, item.score * 1.5); // Make score 50% worse
        }

        return item;
    }).sort((a, b) => a.score - b.score); // Re-sort by adjusted scores
}
