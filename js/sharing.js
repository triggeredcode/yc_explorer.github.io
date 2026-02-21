// ══════════════════════════════════════════
//  SHARING AND URL STATE
// ══════════════════════════════════════════

function encodeStateToHash() {
    const parts = [];
    if (activeIndustry) parts.push(`industry=${encodeURIComponent(activeIndustry)}`);
    if (activeSubIndustry) parts.push(`sub=${encodeURIComponent(activeSubIndustry)}`);
    const search = document.getElementById('search-input').value.trim();
    if (search) parts.push(`search=${encodeURIComponent(search)}`);
    if (activeFilters.starred) parts.push('starred=1');
    if (activeFilters.unvisited) parts.push('unvisited=1');
    if (activeFilters.hiring) parts.push('hiring=1');
    if (activeFilters.hasNotes) parts.push('notes=1');
    
    const hash = parts.length ? '#' + parts.join('&') : '';
    if (window.location.hash !== hash) {
        window.history.replaceState(null, '', window.location.pathname + hash);
    }
}

function decodeHashToState() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    
    const params = new URLSearchParams(hash);
    
    if (params.has('industry')) {
        activeIndustry = decodeURIComponent(params.get('industry'));
    }
    if (params.has('sub')) {
        activeSubIndustry = decodeURIComponent(params.get('sub'));
    }
    if (params.has('search')) {
        document.getElementById('search-input').value = decodeURIComponent(params.get('search'));
    }
    if (params.has('starred')) {
        activeFilters.starred = params.get('starred') === '1';
        document.getElementById('filter-starred')?.classList.toggle('active-star', activeFilters.starred);
    }
    if (params.has('unvisited')) {
        activeFilters.unvisited = params.get('unvisited') === '1';
        document.getElementById('filter-unvisited')?.classList.toggle('active-unvisited', activeFilters.unvisited);
    }
    if (params.has('hiring')) {
        activeFilters.hiring = params.get('hiring') === '1';
        document.getElementById('filter-hiring')?.classList.toggle('active', activeFilters.hiring);
    }
    if (params.has('notes')) {
        activeFilters.hasNotes = params.get('notes') === '1';
        document.getElementById('filter-notes')?.classList.toggle('active-notes', activeFilters.hasNotes);
    }
    
    // Apply state
    recomputeFilteredList();
}

function shareCurrentView() {
    encodeStateToHash();
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard');
}

// Listen for hash changes (back/forward buttons)
window.addEventListener('hashchange', () => {
    decodeHashToState();
});
