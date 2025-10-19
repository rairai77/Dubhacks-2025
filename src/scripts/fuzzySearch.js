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
    // Map Fuse.js results to cleaner output
    return results.map((r) => ({
        score: r.score,
        ...r.item,
    }));
}
