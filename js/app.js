// ══════════════════════════════════════════
//  EVENT LISTENERS & INIT
// ══════════════════════════════════════════
function setupEvents() {
    // Search
    document.getElementById('search-input').addEventListener('input', () => recomputeFilteredList());

    // Filter toggles
    document.getElementById('filter-starred').onclick = () => {
        activeFilters.starred = !activeFilters.starred;
        document.getElementById('filter-starred').classList.toggle('active-star', activeFilters.starred);
        recomputeFilteredList();
    };
    document.getElementById('filter-unvisited').onclick = () => {
        activeFilters.unvisited = !activeFilters.unvisited;
        document.getElementById('filter-unvisited').classList.toggle('active-unvisited', activeFilters.unvisited);
        recomputeFilteredList();
    };
    document.getElementById('filter-hiring').onclick = () => {
        activeFilters.hiring = !activeFilters.hiring;
        document.getElementById('filter-hiring').classList.toggle('active', activeFilters.hiring);
        recomputeFilteredList();
    };
    document.getElementById('filter-notes').onclick = () => {
        activeFilters.hasNotes = !activeFilters.hasNotes;
        document.getElementById('filter-notes').classList.toggle('active-notes', activeFilters.hasNotes);
        recomputeFilteredList();
    };

    // Clear all filters
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    if (clearFiltersBtn) clearFiltersBtn.onclick = clearAllFilters;

    // Sidebar tabs
    document.getElementById('tab-tree').onclick = () => switchTab('tree');
    document.getElementById('tab-list').onclick = () => switchTab('list');
    document.getElementById('tab-insights').onclick = () => switchTab('insights');

    // Clear visited
    document.getElementById('clear-visited').onclick = () => {
        visitedSet.clear();
        localStorage.removeItem('yc-visited');
        applyVisitedVisuals();
        updateAllCounts();
        if (sidebarMode === 'list') renderList();
        buildTree();
    };

    // View switcher
    document.querySelectorAll('.view-switch-btn').forEach(btn => {
        btn.onclick = () => switchView(btn.dataset.view);
    });


    // Sidebar collapse/expand
    document.getElementById('sidebar-collapse-btn').onclick = toggleSidebar;
    document.getElementById('sidebar-expand-btn').onclick = toggleSidebar;

    // Compare mode
    document.getElementById('compare-mode-btn').onclick = toggleCompareMode;

    // AI Chat (always opens now)
    document.getElementById('ai-chat-btn').onclick = openAIChat;
    document.getElementById('ai-chat-close').onclick = closeAIChat;
    document.getElementById('ai-chat-settings').onclick = openSettingsDrawer;
    document.getElementById('ai-chat-send').onclick = () => {
        const input = document.getElementById('ai-chat-input');
        if (input.value.trim()) {
            sendMessage(input.value);
            input.value = '';
        }
    };
    document.getElementById('ai-chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('ai-chat-send').click();
        }
    });

    // Prompt card buttons (copy + use for each card)
    const promptCards = [
        { id: 'prompt-card-find-gap', type: 'find-gap' },
        { id: 'prompt-card-roast-idea', type: 'roast-idea' },
        { id: 'prompt-card-build-thesis', type: 'build-thesis' },
        { id: 'prompt-card-who-to-talk', type: 'who-to-talk' },
        { id: 'prompt-card-whats-missing', type: 'whats-missing' }
    ];
    promptCards.forEach(({ id, type }) => {
        const card = document.getElementById(id);
        if (!card) return;
        const copyBtn = card.querySelector('.prompt-copy-btn');
        const useBtn = card.querySelector('.prompt-use-btn');
        if (copyBtn) copyBtn.onclick = () => copyPromptForExternal(type);
        if (useBtn) useBtn.onclick = () => sendFromPromptCard(type);
    });

    // Copy batch context button
    const copyCtxBtn = document.getElementById('copy-batch-context');
    if (copyCtxBtn) copyCtxBtn.onclick = copyBatchContext;

    // Custom prompt buttons
    const customCopy = document.getElementById('custom-prompt-copy');
    const customSend = document.getElementById('custom-prompt-send');
    if (customCopy) customCopy.onclick = copyCustomPromptForExternal;
    if (customSend) customSend.onclick = sendCustomPrompt;

    // Copy data + prompt for external AI
    const copyDataPrompt = document.getElementById('copy-data-plus-prompt');
    if (copyDataPrompt) copyDataPrompt.onclick = copyFilteredDataPlusPrompt;

    document.getElementById('ai-chat-clear').onclick = clearChat;

    // Settings drawer
    document.getElementById('settings-save').onclick = saveAISettings;
    document.getElementById('settings-cancel').onclick = closeSettingsDrawer;
    document.getElementById('settings-test').onclick = testAIConnection;
    document.getElementById('settings-drawer').onclick = (e) => {
        if (e.target.id === 'settings-drawer') closeSettingsDrawer();
    };

    // Share button
    document.getElementById('share-view-btn').onclick = shareCurrentView;

    // Shortcuts panel
    document.getElementById('shortcuts-toggle').onclick = () => {
        document.getElementById('shortcuts-panel').classList.toggle('hidden');
    };

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            if (e.key === 'Escape') e.target.blur();
            return;
        }

        switch (e.key) {
            case 'ArrowRight': case 'j': case 'J': navigateNext(); e.preventDefault(); break;
            case 'ArrowLeft': case 'k': case 'K': navigatePrev(); e.preventDefault(); break;
            case 's': case 'S':
                if (currentIndex >= 0 && filteredList[currentIndex]) {
                    const c = filteredList[currentIndex];
                    toggleStar(c.id);
                    updateNavStarBtn(c.id);
                    if (isExpanded) updateExpandedStarBtn(c.id);
                    else updateMiniStarBtn(c.id);
                }
                break;
            case 'e': case 'E':
                if (currentIndex >= 0) { if (isExpanded) collapseCard(); else expandCard(); }
                break;
            case 'Escape': closePanels(); break;
            case '/': document.getElementById('search-input').focus(); e.preventDefault(); break;
            case '1': switchView('graph'); e.preventDefault(); break;
            case '2': switchView('table'); e.preventDefault(); break;
            case '3': switchView('analytics'); e.preventDefault(); break;
            case '4': switchView('cards'); e.preventDefault(); break;
        }
    });

    // Window resize
    window.addEventListener('resize', () => {
        if (window._graph) {
            window._graph.svg.attr('width', window.innerWidth).attr('height', window.innerHeight);
            window._graph.sim.force('center', d3.forceCenter(window.innerWidth / 2 + 140, window.innerHeight / 2)).restart();
        }
    });
}

function clearAllFilters() {
    activeIndustry = null;
    activeSubIndustry = null;
    Object.keys(activeFilters).forEach(k => activeFilters[k] = false);
    document.getElementById('search-input').value = '';
    document.getElementById('filter-starred').classList.remove('active-star');
    document.getElementById('filter-unvisited').classList.remove('active-unvisited');
    document.getElementById('filter-hiring').classList.remove('active');
    document.getElementById('filter-notes').classList.remove('active-notes');
    document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sub-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.subs-container').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.ind-arrow').forEach(a => a.style.transform = '');
    recomputeFilteredList();
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
setupEvents();
loadData();
initSimilarityComputation(); // Pre-compute similarity matrix in background
decodeHashToState();
