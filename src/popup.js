import { CONFIG } from "./config.js";

const statusDiv = document.getElementById("status");
const contentDiv = document.getElementById("content");

// Show status message
function showStatus(message, type = "loading") {
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.style.display = "block";
}

function hideStatus() {
    statusDiv.style.display = "none";
}

function showContent(text) {
    contentDiv.textContent = text;
    contentDiv.style.display = "block";
}

function hideContent() {
    contentDiv.style.display = "none";
}

// Helper to add timeout to promises
const withTimeout = (promise, timeoutMs) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), timeoutMs)
        ),
    ]);
};

// Get tab data with limited content
async function getTabsData() {
    const tabs = await chrome.tabs.query({});

    // Process tabs in parallel with Promise.allSettled to handle failures gracefully
    const results = await Promise.allSettled(
        tabs.map(async (tab) => {
            const data = {
                id: tab.id,
                title: tab.title || "",
                url: tab.url || "",
                content: "",
            };

            // Only scrape content from http/https pages
            if (
                tab.url &&
                (tab.url.startsWith("http://") ||
                    tab.url.startsWith("https://"))
            ) {
                try {
                    // Add 1 second timeout per tab
                    const results = await withTimeout(
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: () => {
                                // Get first 100 characters of text content
                                const text = document.body.innerText || "";
                                return text
                                    .substring(0, 100)
                                    .replace(/\s+/g, " ")
                                    .trim();
                            },
                        }),
                        1000 // 1 second timeout
                    );
                    data.content = results[0].result || "";
                } catch (error) {
                    // Skip tabs where we can't inject scripts or timeout
                    console.log(
                        `Failed to scrape tab ${tab.id}:`,
                        error.message
                    );
                }
            }

            return data;
        })
    );

    // Return only successful results
    return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

// Call Gemini API to group tabs
async function groupTabsWithAI(tabsData) {
    const apiKey = CONFIG.GEMINI_API_KEY;

    if (!apiKey || apiKey === "your_gemini_api_key_here") {
        throw new Error("Please set your Gemini API key in src/config.js");
    }

    const prompt = `Analyze these browser tabs and group them into logical categories.
Return a JSON array of groups, where each group has a "name" and "tabIds" array.
No tabs should be in a group of their own - if tabs do not fit into another group they should go into a general catchall misc. group.
Group names should be short for easy display, you may use both acronyms and abbreviations, DO NOT use slashes, "/", "&", or "\\"
Tab group names should be one or two words maximum they do not need to be overly specific, be succinct

Tabs:
${tabsData
    .map(
        (t) =>
            `ID: ${t.id}, Title: ${t.title}, URL: ${t.url}, Content: ${t.content}`
    )
    .join("\n")}

Return ONLY valid JSON in this format:
[
  {
    "name": "Group Name",
    "tabIds": [1, 2, 3],
    "color": "blue"
  }
]

Available colors: blue, red, yellow, green, pink, purple, cyan, orange, grey`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
        );
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        throw new Error("Could not parse AI response");
    }

    return JSON.parse(jsonMatch[0]);
}

// Apply grouping to tabs
async function applyTabGroups(groups) {
    for (const group of groups) {
        if (group.tabIds && group.tabIds.length > 0) {
            try {
                const groupId = await chrome.tabs.group({
                    tabIds: group.tabIds,
                });

                await chrome.tabGroups.update(groupId, {
                    title: group.name,
                    color: group.color || "grey",
                });
            } catch (error) {
                console.error(`Failed to group: ${group.name}`, error);
            }
        }
    }
}

// Main AI grouping function
async function performAIGrouping() {
    try {
        showStatus("Analyzing tabs...", "loading");

        const tabsData = await getTabsData();
        showStatus(`Calling AI to group ${tabsData.length} tabs...`, "loading");

        const groups = await groupTabsWithAI(tabsData);
        showStatus("Applying groups...", "loading");

        await applyTabGroups(groups);

        showStatus(
            `Successfully created ${groups.length} tab groups!`,
            "success"
        );
        showContent(JSON.stringify(groups, null, 2));

        setTimeout(() => {
            hideStatus();
            hideContent();
        }, 5000);
    } catch (error) {
        showStatus(`Error: ${error.message}`, "error");
        console.error("AI Grouping error:", error);
    }
}

// Event listeners
document
    .getElementById("aiGroupTabs")
    .addEventListener("click", performAIGrouping);
