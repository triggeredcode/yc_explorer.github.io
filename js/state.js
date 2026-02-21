// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
let rawCompanies = [];

// Safely parse localStorage arrays with fallback
function safeParseSet(key) {
    try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        return new Set(Array.isArray(data) ? data : []);
    } catch (e) {
        console.warn(`Failed to parse ${key} from localStorage, resetting`);
        localStorage.removeItem(key);
        return new Set();
    }
}

let starredSet = safeParseSet('yc-starred');
let visitedSet = safeParseSet('yc-visited');
let currentIndex = -1;       // index into filteredList
let filteredList = [];        // current working list of companies
let isExpanded = false;
let activeFilters = { starred: false, unvisited: false, hiring: false, hasNotes: false };
let activeIndustry = null;
let activeSubIndustry = null;
let sidebarMode = 'tree';    // 'tree' | 'list'
let notesMap = {};           // companyId -> note text (loaded from localStorage)
let compareSet = new Set();   // company ids for comparison (max 3)
let compareMode = false;

const industryColors = {
    "B2B": "#58a6ff", "Industrials": "#3fb950", "Fintech": "#a371f7",
    "Consumer": "#f85149", "Healthcare": "#39d3d3",
    "Real Estate and Construction": "#d29922", "Government": "#768390", "Education": "#f778ba"
};

// AI Chat state
let aiChatHistory = [];
let aiProvider = localStorage.getItem('yc-ai-provider') || 'openai';
let aiApiKey = localStorage.getItem('yc-ai-key') || '';
