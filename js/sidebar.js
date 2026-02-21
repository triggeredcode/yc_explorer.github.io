// ══════════════════════════════════════════
//  TREE VIEW (sidebar)
// ══════════════════════════════════════════
function buildTree() {
    const container = document.getElementById('tree-view');
    container.innerHTML = '';
    const industries = [...new Set(rawCompanies.map(c => c.industry))].sort();

    industries.forEach(ind => {
        const companies = rawCompanies.filter(c => c.industry === ind);
        const subs = {};
        companies.forEach(c => {
            if (!subs[c.subLabel]) subs[c.subLabel] = [];
            subs[c.subLabel].push(c);
        });

        // Industry row
        const indDiv = document.createElement('div');
        indDiv.className = 'cat-item flex items-center justify-between px-3 py-2 rounded-lg border border-transparent';
        indDiv.dataset.industry = ind;
        indDiv.innerHTML = `
            <span class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${industryColors[ind] || '#768390'}"></span>
                <span class="text-xs font-semibold text-slate-200">${ind}</span>
            </span>
            <div class="flex items-center gap-2">
                <button class="copy-btn tree-copy-btn" data-copy-industry="${ind}" title="Copy ${ind} JSON" onclick="event.stopPropagation();copyIndustryJSON('${ind.replace(/'/g, "\\'")}')">
                    <i class="fa-regular fa-copy"></i>
                </button>
                <span class="text-[10px] text-slate-500">${companies.length}</span>
                <i class="fa-solid fa-chevron-right text-[8px] text-slate-600 transition-transform duration-200 ind-arrow"></i>
            </div>
        `;
        container.appendChild(indDiv);

        // Sub-industries (collapsed by default)
        const subsContainer = document.createElement('div');
        subsContainer.className = 'pl-5 hidden subs-container';
        subsContainer.dataset.industry = ind;

        Object.keys(subs).sort().forEach(sub => {
            const subDiv = document.createElement('div');
            subDiv.className = 'sub-item flex items-center justify-between px-3 py-1.5 rounded-md';
            subDiv.dataset.sub = sub;
            subDiv.dataset.industry = ind;
            const visitedCount = subs[sub].filter(c => visitedSet.has(c.id)).length;
            subDiv.innerHTML = `
                <span class="text-[11px] text-slate-400 truncate">${sub}</span>
                <div class="flex items-center gap-1.5">
                    <button class="copy-btn tree-copy-btn" title="Copy JSON" onclick="event.stopPropagation();copySubIndustryJSON('${ind.replace(/'/g, "\\'")}','${sub.replace(/'/g, "\\'")}')">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <span class="text-[9px] text-slate-600">${visitedCount}/${subs[sub].length}</span>
                </div>
            `;
            subDiv.onclick = (e) => {
                e.stopPropagation();
                drillSubIndustry(ind, sub);
            };
            subsContainer.appendChild(subDiv);
        });
        container.appendChild(subsContainer);

        // Toggle sub-industries
        indDiv.onclick = () => {
            const arrow = indDiv.querySelector('.ind-arrow');
            const isOpen = !subsContainer.classList.contains('hidden');
            // Close all others
            document.querySelectorAll('.subs-container').forEach(s => s.classList.add('hidden'));
            document.querySelectorAll('.ind-arrow').forEach(a => a.style.transform = '');
            if (!isOpen) {
                subsContainer.classList.remove('hidden');
                arrow.style.transform = 'rotate(90deg)';
            }
            drillIndustry(isOpen ? null : ind);
        };
    });
}

// ══════════════════════════════════════════
//  LIST VIEW (sidebar)
// ══════════════════════════════════════════
function buildList() {
    renderList();
}

function renderList() {
    const container = document.getElementById('list-view');
    container.innerHTML = '';

    filteredList.forEach((c, idx) => {
        const row = document.createElement('div');
        row.className = 'company-row flex items-center gap-2.5 px-3 py-2' + 
            (visitedSet.has(c.id) ? ' visited-row' : '') +
            (currentIndex === idx ? ' active-row' : '');
        row.dataset.idx = idx;
        row.innerHTML = `
            <img src="${c.logo}" class="w-7 h-7 rounded-md bg-slate-800 object-contain flex-shrink-0" onerror="this.style.display='none'">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold text-slate-200 truncate">${c.name}</span>
                    ${c.isHiring ? '<span class="hiring-dot w-1.5 h-1.5 rounded-full flex-shrink-0"></span>' : ''}
                    ${starredSet.has(c.id) ? '<i class="fa-solid fa-star text-[8px] text-yellow-500"></i>' : ''}
                    ${notesMap[c.id] ? '<i class="fa-solid fa-note-sticky text-[8px] text-amber-500" title="Has notes"></i>' : ''}
                </div>
                <p class="text-[10px] text-slate-500 truncate">${c.description}</p>
            </div>
            ${c._score != null ? `<span class="text-[9px] font-semibold text-blue-400" title="Relevance">${c._score}</span>` : ''}
            ${visitedSet.has(c.id) ? '<i class="fa-solid fa-check text-[9px] text-slate-600"></i>' : '<span class="w-1.5 h-1.5 rounded-full bg-blue-500/60 flex-shrink-0"></span>'}
        `;
        row.onclick = () => {
            if (compareMode) addToCompare(c.id);
            else selectCompanyByIndex(idx);
        };
        container.appendChild(row);
    });
}

// ══════════════════════════════════════════
//  TAB SWITCHING
// ══════════════════════════════════════════
const TAB_ACTIVE = 'flex-1 text-[10px] font-semibold uppercase tracking-wider py-1.5 rounded-md text-blue-400 bg-blue-500/10';
const TAB_INACTIVE = 'flex-1 text-[10px] font-semibold uppercase tracking-wider py-1.5 rounded-md text-slate-500 hover:text-slate-300';
function switchTab(mode) {
    sidebarMode = mode;
    document.getElementById('tree-view').classList.toggle('hidden', mode !== 'tree');
    document.getElementById('list-view').classList.toggle('hidden', mode !== 'list');
    document.getElementById('insights-view').classList.toggle('hidden', mode !== 'insights');
    document.getElementById('tab-tree').className = mode === 'tree' ? TAB_ACTIVE : TAB_INACTIVE;
    document.getElementById('tab-list').className = mode === 'list' ? TAB_ACTIVE : TAB_INACTIVE;
    document.getElementById('tab-insights').className = mode === 'insights' ? TAB_ACTIVE : TAB_INACTIVE;
    if (mode === 'list') renderList();
    if (mode === 'insights') buildInsights();
}
