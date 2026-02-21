// ══════════════════════════════════════════
//  ALTERNATIVE VIEWS: Table, Analytics, Cards
// ══════════════════════════════════════════

let currentView = 'graph';
let tableSortCol = 'name';
let tableSortDir = 'asc';
let tablePage = 0;
const TABLE_PAGE_SIZE = 50;
let cardsRendered = 0;
const CARDS_PAGE_SIZE = 48;
let _cardsObserver = null;
let _sidebarCollapsed = false;

const CLUSTER_COLORS = [
    '#58a6ff', '#3fb950', '#f85149', '#a371f7', '#d29922',
    '#f778ba', '#39d3d3', '#8b949e', '#7ee787', '#79c0ff',
    '#ffa657', '#ff7b72', '#d2a8ff', '#a5d6ff', '#ffc658',
    '#ff9580', '#bbd6fb', '#aff5b4', '#ffc8a8', '#c9d1d9',
    '#56d4dd', '#e3b341', '#8957e5', '#db6d28', '#6cb6ff',
    '#8ddb8c', '#f9826c', '#b392f0', '#ffdf5d', '#f97583'
];

// ── View switching ──
function switchView(viewName) {
    if (viewName === currentView) return;
    currentView = viewName;

    // Hide all views
    document.getElementById('graph-container').style.display = viewName === 'graph' ? '' : 'none';
    document.getElementById('table-view-container').classList.toggle('hidden', viewName !== 'table');
    document.getElementById('analytics-view-container').classList.toggle('hidden', viewName !== 'analytics');
    document.getElementById('cards-view-container').classList.toggle('hidden', viewName !== 'cards');

    // Update active button
    document.querySelectorAll('.view-switch-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.view === viewName);
    });

    // Render the selected view
    if (viewName === 'table') renderTableView();
    if (viewName === 'analytics') renderAnalyticsView();
    if (viewName === 'cards') { cardsRendered = 0; renderCardsView(); }
}

function refreshCurrentView() {
    if (currentView === 'table') { tablePage = 0; renderTableView(); }
    else if (currentView === 'analytics') renderAnalyticsView();
    else if (currentView === 'cards') { cardsRendered = 0; renderCardsView(); }
}

// ── Sidebar collapse ──
function toggleSidebar() {
    _sidebarCollapsed = !_sidebarCollapsed;
    const sidebar = document.getElementById('left-sidebar');
    const expandBtn = document.getElementById('sidebar-expand-btn');
    sidebar.classList.toggle('collapsed', _sidebarCollapsed);
    document.body.classList.toggle('sidebar-collapsed', _sidebarCollapsed);
    expandBtn.classList.toggle('show', _sidebarCollapsed);

    setTimeout(() => {
        if (window._graph) {
            const W = window.innerWidth, H = window.innerHeight;
            window._graph.svg.attr('width', W).attr('height', H);
            const cx = _sidebarCollapsed ? W / 2 : W / 2 + 170;
            window._graph.sim.force('center', d3.forceCenter(cx, H / 2)).alpha(0.1).restart();
        }
    }, 300);
}

// ══════════════════════════════════════════
//  TABLE VIEW
// ══════════════════════════════════════════
const TABLE_COLUMNS = [
    { key: 'star', label: '★', width: '30px', sortable: false },
    { key: 'name', label: 'Company', width: 'auto', sortable: true },
    { key: 'description', label: 'One-liner', width: '35%', sortable: true },
    { key: 'industry', label: 'Industry', width: 'auto', sortable: true },
    { key: 'subLabel', label: 'Sub', width: 'auto', sortable: true },
    { key: 'location', label: 'Location', width: 'auto', sortable: true },
    { key: 'teamSize', label: 'Team', width: '60px', sortable: true },
    { key: 'isHiring', label: 'Hiring', width: '50px', sortable: true },
    { key: 'tags', label: 'Tags', width: '20%', sortable: false }
];

function renderTableView() {
    const thead = document.getElementById('data-table-head');
    const tbody = document.getElementById('data-table-body');
    const pagination = document.getElementById('table-pagination');

    if (!filteredList.length) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-12 text-slate-500">No companies match current filters</td></tr>';
        pagination.innerHTML = '';
        return;
    }

    thead.innerHTML = '<tr>' + TABLE_COLUMNS.map(col => {
        let cls = '';
        if (col.sortable && col.key === tableSortCol) cls = tableSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc';
        const style = col.width !== 'auto' ? ` style="width:${col.width}"` : '';
        return `<th class="${cls}" data-col="${col.key}"${style}>${col.label}</th>`;
    }).join('') + '</tr>';

    thead.querySelectorAll('th').forEach(th => {
        const col = TABLE_COLUMNS.find(c => c.key === th.dataset.col);
        if (!col || !col.sortable) return;
        th.onclick = () => {
            if (tableSortCol === col.key) tableSortDir = tableSortDir === 'asc' ? 'desc' : 'asc';
            else { tableSortCol = col.key; tableSortDir = 'asc'; }
            renderTableView();
        };
    });

    const sorted = [...filteredList].sort((a, b) => {
        let va = a[tableSortCol], vb = b[tableSortCol];
        if (va == null) va = '';
        if (vb == null) vb = '';
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (typeof va === 'boolean') { va = va ? 1 : 0; vb = vb ? 1 : 0; }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return tableSortDir === 'asc' ? cmp : -cmp;
    });

    const totalPages = Math.ceil(sorted.length / TABLE_PAGE_SIZE);
    if (tablePage >= totalPages) tablePage = Math.max(0, totalPages - 1);
    const start = tablePage * TABLE_PAGE_SIZE;
    const pageData = sorted.slice(start, start + TABLE_PAGE_SIZE);

    tbody.innerHTML = '';
    pageData.forEach(c => {
        const tr = document.createElement('tr');
        const globalIdx = filteredList.indexOf(c);
        tr.dataset.companyId = c.id;
        if (visitedSet.has(c.id)) tr.classList.add('table-row-visited');
        if (globalIdx === currentIndex) tr.classList.add('table-row-active');
        tr.onclick = () => {
            if (compareMode) addToCompare(c.id);
            else selectCompanyById(c.id);
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('table-row-active'));
            tr.classList.add('table-row-active');
        };

        tr.innerHTML = `
            <td>${starredSet.has(c.id) ? '<span class="table-star">★</span>' : ''}</td>
            <td><div class="flex items-center gap-2"><img src="${c.logo}" class="w-5 h-5 rounded bg-slate-800 object-contain flex-shrink-0"><span class="font-medium text-white">${escHtml(c.name)}</span></div></td>
            <td class="text-slate-400" title="${escHtml(c.description || '')}">${escHtml(c.description || '-')}</td>
            <td><span style="color:${industryColors[c.industry] || '#768390'}">${escHtml(c.industry)}</span></td>
            <td class="text-slate-500">${escHtml(c.subLabel)}</td>
            <td class="text-slate-500">${escHtml(c.location || '-')}</td>
            <td class="text-center">${c.teamSize || '-'}</td>
            <td class="text-center">${c.isHiring ? '<span class="table-hiring"></span>' : ''}</td>
            <td>${(c.tags || []).slice(0, 3).map(t => `<span class="table-tag">${escHtml(t)}</span>`).join('')}${c.tags?.length > 3 ? `<span class="text-slate-600 text-[9px]"> +${c.tags.length - 3}</span>` : ''}</td>
        `;
        tbody.appendChild(tr);
    });

    renderTablePagination(totalPages, sorted.length);
}

function renderTablePagination(totalPages, total) {
    const el = document.getElementById('table-pagination');
    if (totalPages <= 1) { el.innerHTML = `<span class="text-slate-500">${total} companies</span>`; return; }
    let html = `<span class="text-slate-500">${total} companies</span>`;
    html += `<button class="table-page-btn" onclick="tableGoPage(${tablePage - 1})" ${tablePage === 0 ? 'disabled style="opacity:0.3"' : ''}>‹ Prev</button>`;
    const maxButtons = 7;
    let startP = Math.max(0, tablePage - Math.floor(maxButtons / 2));
    let endP = Math.min(totalPages, startP + maxButtons);
    if (endP - startP < maxButtons) startP = Math.max(0, endP - maxButtons);
    for (let i = startP; i < endP; i++) {
        html += `<button class="table-page-btn ${i === tablePage ? 'active' : ''}" onclick="tableGoPage(${i})">${i + 1}</button>`;
    }
    html += `<button class="table-page-btn" onclick="tableGoPage(${tablePage + 1})" ${tablePage >= totalPages - 1 ? 'disabled style="opacity:0.3"' : ''}>Next ›</button>`;
    el.innerHTML = html;
}

function tableGoPage(page) {
    tablePage = Math.max(0, page);
    renderTableView();
    document.querySelector('.alt-view-inner')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ══════════════════════════════════════════
//  ANALYTICS VIEW
// ══════════════════════════════════════════

function renderAnalyticsView() {
    const container = document.getElementById('analytics-view-container');
    if (!container) return;
    
    const grid = container.querySelector('.analytics-grid');
    if (!grid) return;
    
    // Show loading state
    grid.innerHTML = '<div class="text-center py-20 text-slate-500"><div class="viz-loading mx-auto mb-4"></div>Computing analytics...</div>';
    
    // Use setTimeout to allow UI to update, then render charts
    setTimeout(() => {
        if (typeof renderAnalyticsCharts === 'function') {
            renderAnalyticsCharts();
        } else {
            grid.innerHTML = '<div class="text-center py-20 text-slate-500">Analytics charts not available</div>';
        }
    }, 50);
}

// ══════════════════════════════════════════
//  CARDS VIEW (infinite scroll)
// ══════════════════════════════════════════
function initCardsObserver() {
    if (_cardsObserver) _cardsObserver.disconnect();
    const sentinel = document.getElementById('cards-sentinel');
    const container = document.getElementById('cards-view-container');
    if (!sentinel || !container) return;

    _cardsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && cardsRendered < filteredList.length) {
                appendCardsBatch();
            }
        });
    }, { root: container, rootMargin: '200px' });

    _cardsObserver.observe(sentinel);
}

function renderCardsView() {
    const grid = document.getElementById('cards-grid');
    const sentinel = document.getElementById('cards-sentinel');

    while (grid.firstChild && grid.firstChild !== sentinel) {
        grid.removeChild(grid.firstChild);
    }
    if (!sentinel) return;
    cardsRendered = 0;

    if (!filteredList.length) {
        const empty = document.createElement('div');
        empty.className = 'col-span-full flex items-center justify-center py-20 text-slate-500 text-sm';
        empty.textContent = 'No companies match current filters';
        grid.insertBefore(empty, sentinel);
        return;
    }

    appendCardsBatch();
    initCardsObserver();
}

function appendCardsBatch() {
    const grid = document.getElementById('cards-grid');
    const sentinel = document.getElementById('cards-sentinel');
    if (!sentinel) return;

    const end = Math.min(cardsRendered + CARDS_PAGE_SIZE, filteredList.length);
    const fragment = document.createDocumentFragment();

    for (let i = cardsRendered; i < end; i++) {
        const c = filteredList[i];
        const card = document.createElement('div');
        card.className = 'company-card';
        card.dataset.companyId = c.id;
        if (visitedSet.has(c.id)) card.classList.add('card-visited');

        const color = industryColors[c.industry] || '#768390';
        card.innerHTML = `
            ${starredSet.has(c.id) ? '<span class="company-card-starred"><i class="fa-solid fa-star"></i></span>' : ''}
            <div class="flex items-center gap-3 mb-2">
                <img src="${c.logo}" class="company-card-logo">
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-white truncate">${escHtml(c.name)}</p>
                    <span class="company-card-industry" style="background:${color}20;color:${color}">${escHtml(c.industry)}</span>
                </div>
                ${c.isHiring ? '<span class="table-hiring flex-shrink-0"></span>' : ''}
            </div>
            <p class="text-[11px] text-slate-400 leading-relaxed line-clamp-2 mb-2">${escHtml(c.description || 'No description')}</p>
            <div class="flex items-center justify-between">
                <span class="text-[10px] text-slate-600">${escHtml(c.subLabel)}</span>
                <span class="text-[10px] text-slate-600">${escHtml(c.location || '')}</span>
            </div>
            ${(c.tags || []).length ? `<div class="flex flex-wrap gap-1 mt-2">${c.tags.slice(0, 4).map(t => `<span class="table-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
        `;

        card.onclick = () => {
            if (compareMode) addToCompare(c.id);
            else selectCompanyById(c.id);
        };
        fragment.appendChild(card);
    }
    cardsRendered = end;

    grid.insertBefore(fragment, sentinel);
}
