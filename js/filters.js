// ══════════════════════════════════════════
//  FILTERING & DRILL
// ══════════════════════════════════════════
function searchScore(c, query) {
    if (!query) return 0;
    const q = query.toLowerCase();
    let score = 0;
    if (c.name.toLowerCase() === q) score += 100;
    else if (c.name.toLowerCase().includes(q)) score += 50;
    if ((c.tags || []).some(t => t.toLowerCase() === q)) score += 40;
    else if ((c.tags || []).some(t => t.toLowerCase().includes(q))) score += 25;
    if ((c.subLabel || '').toLowerCase().includes(q)) score += 30;
    if ((c.description || '').toLowerCase().includes(q)) score += 20;
    if ((c.longDescription || '').toLowerCase().includes(q)) score += 10;
    return score;
}

function recomputeFilteredList() {
    let list = [...rawCompanies];
    const search = document.getElementById('search-input').value.toLowerCase().trim();

    if (search) {
        list = list.map(c => {
            const score = searchScore(c, search);
            return { ...c, _score: score };
        }).filter(c => c._score > 0).sort((a, b) => (b._score || 0) - (a._score || 0));
    } else {
        list = list.map(c => ({ ...c, _score: null }));
    }
    if (activeIndustry) list = list.filter(c => c.industry === activeIndustry);
    if (activeSubIndustry) list = list.filter(c => c.subLabel === activeSubIndustry);
    if (activeFilters.starred) list = list.filter(c => starredSet.has(c.id));
    if (activeFilters.unvisited) list = list.filter(c => !visitedSet.has(c.id));
    if (activeFilters.hiring) list = list.filter(c => c.isHiring);
    if (activeFilters.hasNotes) list = list.filter(c => notesMap[c.id]);

    filteredList = list;
    renderList();
    applyGraphFilters();
    updateAllCounts();
    updateFilterCountBar();
    refreshCurrentView();
    updatePromptExportCount();

    // Keep current selection if company is still in filtered list
    if (currentIndex >= 0) {
        const prevCompanyId = window._lastSelectedCompanyId;
        if (prevCompanyId !== undefined && filteredList.length > 0) {
            const newIdx = filteredList.findIndex(c => c.id === prevCompanyId);
            if (newIdx !== -1) {
                currentIndex = newIdx;
            } else {
                // Company no longer in filtered list, clamp index
                currentIndex = Math.min(currentIndex, filteredList.length - 1);
            }
        } else if (filteredList.length === 0) {
            currentIndex = -1;
        }
    }
    
    // Update URL hash state
    if (typeof encodeStateToHash === 'function') {
        encodeStateToHash();
    }
}

function drillIndustry(ind) {
    activeIndustry = ind;
    activeSubIndustry = null;
    document.querySelectorAll('.cat-item').forEach(el => el.classList.toggle('active', el.dataset.industry === ind));
    document.querySelectorAll('.sub-item').forEach(el => el.classList.remove('active'));
    recomputeFilteredList();
    
    // Expand the graph to show this industry
    if (typeof expandToIndustry === 'function') {
        expandToIndustry(ind);
    }
    zoomToCluster('ind-' + ind);
}

function drillSubIndustry(ind, sub) {
    activeIndustry = ind;
    activeSubIndustry = sub;
    document.querySelectorAll('.sub-item').forEach(el => {
        el.classList.toggle('active', el.dataset.sub === sub && el.dataset.industry === ind);
    });
    recomputeFilteredList();
    
    // Expand the graph to show this subindustry
    if (typeof expandToSubIndustry === 'function') {
        expandToSubIndustry(ind, sub);
    }
    zoomToCluster('sub-' + ind + '-' + sub);
}

function zoomToCluster(nodeId) {
    if (!window._graph) return;
    const { nodes, svg, zoomBehavior } = window._graph;
    
    // Try exact match first, then prefix match for sub-cluster IDs
    let targetNode = nodes.find(n => (n.nodeId || n.id) === nodeId);
    
    // If not found and this is a sub-industry, try to find any sub-cluster with this prefix
    if (!targetNode && nodeId.startsWith('sub-')) {
        targetNode = nodes.find(n => {
            const nid = n.nodeId || n.id;
            return nid === nodeId || nid.startsWith(nodeId + '-cluster');
        });
    }
    
    if (!targetNode || targetNode.x === undefined || targetNode.y === undefined) return;
    
    const W = window.innerWidth;
    const H = window.innerHeight;
    const scale = 1.5;
    const translateX = W / 2 - targetNode.x * scale;
    const translateY = H / 2 - targetNode.y * scale;
    
    const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    svg.transition().duration(600).call(zoomBehavior.transform, transform);
}

// Clear all active filters
function clearAllFilters() {
    activeIndustry = null;
    activeSubIndustry = null;
    activeFilters.starred = false;
    activeFilters.unvisited = false;
    activeFilters.hiring = false;
    activeFilters.hasNotes = false;
    document.getElementById('search-input').value = '';
    document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sub-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.filter-btn').forEach(el => {
        el.classList.remove('active', 'active-star', 'active-unvisited', 'active-notes');
    });
}

// Apply a custom cluster filter (for analytics click-through)
let activeClusterFilter = null;
let activeClusterLabel = null;

function applyClusterFilter(companyIds, label) {
    activeClusterFilter = companyIds;
    activeClusterLabel = label;
    recomputeFilteredListWithCluster();
}

function recomputeFilteredListWithCluster() {
    if (!activeClusterFilter) {
        recomputeFilteredList();
        return;
    }
    
    let list = [...rawCompanies].filter(c => activeClusterFilter.has(c.id));
    filteredList = list;
    renderList();
    applyGraphFilters();
    updateAllCounts();
    updateFilterCountBar();
    refreshCurrentView();
    updatePromptExportCount();
    
    // Update URL hash state
    if (typeof encodeStateToHash === 'function') {
        encodeStateToHash();
    }
}

function applyGraphFilters() {
    if (!window._graph) return;
    const { nodeEl, linkEl } = window._graph;
    const visibleIds = new Set(filteredList.map(c => c.id));
    const hasFilter = activeIndustry || activeSubIndustry || activeFilters.starred || activeFilters.unvisited || activeFilters.hiring || activeFilters.hasNotes || document.getElementById('search-input').value.trim();

    nodeEl.classed('dimmed', d => {
        if (!hasFilter) return false;
        if (d.type === 'root') return false;
        if (d.type === 'startup') {
            const raw = (d.id || '').replace('n-', '');
            const cid = isNaN(raw) ? raw : Number(raw);
            return !visibleIds.has(cid);
        }
        if (d.type === 'industry') return activeIndustry ? d.name !== activeIndustry : false;
        if (d.type === 'subindustry') {
            if (activeIndustry && d.industry !== activeIndustry) return true;
            if (activeSubIndustry && d.name !== activeSubIndustry) return true;
            return false;
        }
        return false;
    });

    linkEl.classed('dimmed', d => {
        if (!hasFilter) return false;
        const t = d.target;
        if (t.type === 'startup') {
            const raw = (t.id || '').replace('n-', '');
            const cid = isNaN(raw) ? raw : Number(raw);
            return !visibleIds.has(cid);
        }
        if (t.type === 'subindustry' && activeIndustry && t.industry !== activeIndustry) return true;
        if (t.type === 'industry' && activeIndustry && t.name !== activeIndustry) return true;
        return false;
    });
}

function updateFilterCountBar() {
    const bar = document.getElementById('filter-count-bar');
    const filteredEl = document.getElementById('filtered-count');
    const totalEl = document.getElementById('filtered-total');
    if (!bar || !filteredEl || !totalEl) return;

    const isFiltered = filteredList.length !== rawCompanies.length;
    bar.classList.toggle('hidden', !isFiltered);
    if (isFiltered) {
        filteredEl.textContent = filteredList.length;
        totalEl.textContent = rawCompanies.length;
    }
}
