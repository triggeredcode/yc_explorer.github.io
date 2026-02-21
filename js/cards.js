// ══════════════════════════════════════════
//  COMPANY SELECTION & NAVIGATION
// ══════════════════════════════════════════
function selectCompanyById(id) {
    const idx = filteredList.findIndex(c => c.id === id);
    if (idx === -1) {
        // Company not in filtered list — clear filters first
        activeIndustry = null; activeSubIndustry = null;
        Object.keys(activeFilters).forEach(k => activeFilters[k] = false);
        document.getElementById('search-input').value = '';
        recomputeFilteredList();
        const newIdx = filteredList.findIndex(c => c.id === id);
        if (newIdx !== -1) selectCompanyByIndex(newIdx);
    } else {
        selectCompanyByIndex(idx);
    }
}

function selectCompanyByIndex(idx) {
    if (idx < 0 || idx >= filteredList.length) return;
    currentIndex = idx;
    const c = filteredList[idx];
    window._lastSelectedCompanyId = c.id; // Track for filter persistence

    // Mark visited
    visitedSet.add(c.id);
    localStorage.setItem('yc-visited', JSON.stringify([...visitedSet]));

    // Update visuals
    showMiniCard(c);
    updateNavigator(c, idx);
    highlightGraphNode(c.id);
    applyVisitedVisuals();
    updateAllCounts();
    updateListHighlight();

    // Scroll list into view
    const row = document.querySelector(`.company-row[data-idx="${idx}"]`);
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function navigateNext() {
    if (filteredList.length === 0) return;
    selectCompanyByIndex((currentIndex + 1) % filteredList.length);
}

function navigatePrev() {
    if (filteredList.length === 0) return;
    selectCompanyByIndex((currentIndex - 1 + filteredList.length) % filteredList.length);
}

// ══════════════════════════════════════════
//  MINI CARD (compact preview)
// ══════════════════════════════════════════
function showMiniCard(c) {
    hideExpandedCard();
    isExpanded = false;
    const el = document.getElementById('mini-card');
    el.classList.remove('hidden');
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });

    document.getElementById('mc-logo').src = c.logo;
    document.getElementById('mc-name').textContent = c.name;
    document.getElementById('mc-oneliner').textContent = c.description || 'No description';
    document.getElementById('mc-industry').textContent = c.industry;
    document.getElementById('mc-industry').style.background = (industryColors[c.industry] || '#768390') + '20';
    document.getElementById('mc-industry').style.color = industryColors[c.industry] || '#768390';
    document.getElementById('mc-location').textContent = c.location || '';
    document.getElementById('mc-hiring').classList.toggle('hidden', !c.isHiring);
    updateMiniStarBtn(c.id);

    document.getElementById('mc-star').onclick = () => { toggleStar(c.id); updateMiniStarBtn(c.id); };
    document.getElementById('mc-expand').onclick = () => expandCard();
    document.getElementById('mc-similar').onclick = () => findSimilar(c.id);
    document.getElementById('mc-close').onclick = () => closePanels();
}

function updateMiniStarBtn(id) {
    const btn = document.getElementById('mc-star');
    const s = starredSet.has(id);
    btn.innerHTML = `<i class="fa-${s ? 'solid' : 'regular'} fa-star text-sm ${s ? 'text-yellow-400' : ''}"></i>`;
}

function hideMiniCard() {
    const el = document.getElementById('mini-card');
    el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
    setTimeout(() => el.classList.add('hidden'), 200);
}

// ══════════════════════════════════════════
//  EXPANDED CARD
// ══════════════════════════════════════════
function expandCard() {
    if (currentIndex < 0 || !filteredList[currentIndex]) return;
    const c = filteredList[currentIndex];
    isExpanded = true;
    hideMiniCard();

    const el = document.getElementById('expanded-card');
    el.classList.remove('hidden');
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });

    document.getElementById('ec-logo').src = c.logo;
    document.getElementById('ec-name').textContent = c.name;
    document.getElementById('ec-oneliner').textContent = c.description;
    document.getElementById('ec-hiring').classList.toggle('hidden', !c.isHiring);
    document.getElementById('ec-location').textContent = c.location || 'Not specified';
    document.getElementById('ec-team').textContent = c.teamSize > 0 ? c.teamSize + ' people' : 'Not specified';
    document.getElementById('ec-stage').textContent = c.stage || '-';
    document.getElementById('ec-status').textContent = c.status || '-';

    // Long description
    const ldWrap = document.getElementById('ec-long-desc-wrap');
    if (c.longDescription && c.longDescription !== c.description) {
        ldWrap.classList.remove('hidden');
        document.getElementById('ec-long-desc').textContent = c.longDescription;
    } else { ldWrap.classList.add('hidden'); }

    // Tags
    const tagsWrap = document.getElementById('ec-tags-wrap');
    const tagsEl = document.getElementById('ec-tags');
    tagsEl.innerHTML = '';
    if (c.tags.length) {
        tagsWrap.classList.remove('hidden');
        c.tags.forEach(t => {
            const s = document.createElement('span');
            s.className = 'tag-pill';
            s.textContent = t;
            s.onclick = () => { document.getElementById('search-input').value = t; recomputeFilteredList(); };
            tagsEl.appendChild(s);
        });
    } else { tagsWrap.classList.add('hidden'); }

    // Industries
    const indWrap = document.getElementById('ec-industries-wrap');
    const indEl = document.getElementById('ec-industries');
    indEl.innerHTML = '';
    if (c.industries.length > 1) {
        indWrap.classList.remove('hidden');
        c.industries.slice(1).forEach(i => {
            const s = document.createElement('span');
            s.className = 'text-[10px] px-2 py-0.5 rounded bg-slate-800/50 text-slate-400 border border-slate-700/50';
            s.textContent = i;
            indEl.appendChild(s);
        });
    } else { indWrap.classList.add('hidden'); }

    // Notes
    const notesEl = document.getElementById('ec-notes');
    notesEl.value = notesMap[c.id] || '';
    notesEl.oninput = () => {
        const v = notesEl.value.trim();
        if (v) notesMap[c.id] = v;
        else delete notesMap[c.id];
        localStorage.setItem('yc-notes', JSON.stringify(notesMap));
        if (sidebarMode === 'list') renderList();
        updateAllCounts();
    };

    // Website
    const wb = document.getElementById('ec-website');
    if (c.website) { wb.href = c.website; wb.style.opacity = '1'; wb.style.pointerEvents = 'auto'; }
    else { wb.href = '#'; wb.style.opacity = '0.4'; wb.style.pointerEvents = 'none'; }
    document.getElementById('ec-yc-link').href = `https://www.ycombinator.com/companies/${c.slug}`;

    updateExpandedStarBtn(c.id);
    document.getElementById('ec-star').onclick = () => { toggleStar(c.id); updateExpandedStarBtn(c.id); };
    document.getElementById('ec-collapse').onclick = () => collapseCard();
    document.getElementById('ec-close').onclick = () => closePanels();
    document.getElementById('ec-similar').onclick = () => findSimilar(c.id);
    document.getElementById('ec-copy-json').onclick = () => copySingleCompanyJSON(c.id);
}

function updateExpandedStarBtn(id) {
    const btn = document.getElementById('ec-star');
    const s = starredSet.has(id);
    btn.innerHTML = `<i class="fa-${s ? 'solid' : 'regular'} fa-star ${s ? 'text-yellow-400' : ''}"></i>`;
}

function hideExpandedCard() {
    const el = document.getElementById('expanded-card');
    el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
    setTimeout(() => el.classList.add('hidden'), 200);
}

function collapseCard() {
    hideExpandedCard();
    if (currentIndex >= 0 && filteredList[currentIndex]) {
        isExpanded = false;
        setTimeout(() => showMiniCard(filteredList[currentIndex]), 150);
    }
}

function closePanels() {
    hideMiniCard();
    hideExpandedCard();
    isExpanded = false;
    currentIndex = -1;
    window._lastSelectedCompanyId = undefined;
    document.getElementById('navigator').style.opacity = '0';
    unhighlightGraph();
    updateListHighlight();
}

// ══════════════════════════════════════════
//  NAVIGATOR BAR
// ══════════════════════════════════════════
function updateNavigator(c, idx) {
    const el = document.getElementById('navigator');
    el.style.opacity = '1';
    document.getElementById('nav-name').textContent = c.name;
    document.getElementById('nav-pos').textContent = `${idx + 1} of ${filteredList.length}` +
        (visitedSet.has(c.id) ? '' : ' · new');

    updateNavStarBtn(c.id);
    document.getElementById('nav-prev').onclick = navigatePrev;
    document.getElementById('nav-next').onclick = navigateNext;
    document.getElementById('nav-star').onclick = () => {
        toggleStar(c.id);
        updateNavStarBtn(c.id);
        if (!isExpanded) updateMiniStarBtn(c.id);
        else updateExpandedStarBtn(c.id);
    };
    document.getElementById('nav-expand').onclick = () => {
        if (isExpanded) collapseCard(); else expandCard();
    };
}

function updateNavStarBtn(id) {
    const btn = document.getElementById('nav-star');
    const s = starredSet.has(id);
    btn.innerHTML = `<i class="fa-${s ? 'solid' : 'regular'} fa-star text-xs ${s ? 'text-yellow-400' : ''}"></i>`;
}
