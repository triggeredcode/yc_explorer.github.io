// ══════════════════════════════════════════
//  STARRING
// ══════════════════════════════════════════
function toggleStar(id) {
    if (starredSet.has(id)) starredSet.delete(id);
    else starredSet.add(id);
    localStorage.setItem('yc-starred', JSON.stringify([...starredSet]));
    applyStarredVisuals();
    updateAllCounts();
    if (sidebarMode === 'list') renderList();
}

// ══════════════════════════════════════════
//  COUNTS
// ══════════════════════════════════════════
function updateAllCounts() {
    document.getElementById('total-count').textContent = rawCompanies.length;
    document.getElementById('starred-count').textContent = starredSet.size;
    document.getElementById('unvisited-count').textContent = rawCompanies.length - visitedSet.size;
    document.getElementById('visited-stat').textContent = visitedSet.size;
    document.getElementById('hiring-stat').textContent = rawCompanies.filter(c => c.isHiring).length;
    document.getElementById('export-count').textContent = `(${filteredList.length})`;
    const notesCount = Object.keys(notesMap).length;
    const notesEl = document.getElementById('notes-count');
    if (notesEl) notesEl.textContent = notesCount;

    // Update tree sub-counts
    document.querySelectorAll('.sub-item').forEach(el => {
        const ind = el.dataset.industry;
        const sub = el.dataset.sub;
        const all = rawCompanies.filter(c => c.industry === ind && c.subLabel === sub);
        const visited = all.filter(c => visitedSet.has(c.id)).length;
        el.querySelector('.text-\\[9px\\]').textContent = `${visited}/${all.length}`;
    });
}

// ══════════════════════════════════════════
//  EXPORT FIELDS (advanced copy)
// ══════════════════════════════════════════
const EXPORT_FIELD_GROUPS = [
    { title: 'Identity', keys: ['id', 'name', 'slug', 'logo', 'yc_url'] },
    { title: 'Content', keys: ['one_liner', 'long_description'] },
    { title: 'Classification', keys: ['industry', 'subindustry', 'sub_label', 'tags', 'industries'] },
    { title: 'Meta', keys: ['team_size', 'is_hiring', 'status', 'stage', 'batch', 'website', 'location', 'regions'] },
    { title: 'Personal', keys: ['_starred', '_visited', '_notes'] }
];
const ALL_EXPORT_KEYS = EXPORT_FIELD_GROUPS.flatMap(g => g.keys);

const DEFAULT_EXPORT_KEYS = ['name', 'one_liner', 'long_description', 'industry', 'subindustry'];

function getSelectedFields() {
    try {
        const stored = JSON.parse(localStorage.getItem('yc-export-fields') || 'null');
        if (stored && typeof stored === 'object') {
            const set = new Set();
            ALL_EXPORT_KEYS.forEach(k => { if (stored[k] !== false) set.add(k); });
            return set;
        }
    } catch (_) {}
    return new Set(DEFAULT_EXPORT_KEYS);
}

function saveExportFields(selected) {
    const obj = {};
    ALL_EXPORT_KEYS.forEach(k => { obj[k] = selected.has(k); });
    localStorage.setItem('yc-export-fields', JSON.stringify(obj));
}

function openExportModal() {
    document.getElementById('export-modal').classList.add('show');
    renderExportModal();
}

function closeExportModal() {
    document.getElementById('export-modal').classList.remove('show');
}

function exportModalSelectAll(selected) {
    const obj = {};
    ALL_EXPORT_KEYS.forEach(k => { obj[k] = selected; });
    localStorage.setItem('yc-export-fields', JSON.stringify(obj));
    renderExportModal();
}

function renderExportModal() {
    const selected = getSelectedFields();
    const container = document.getElementById('export-field-groups');
    container.innerHTML = '';
    EXPORT_FIELD_GROUPS.forEach(group => {
        const div = document.createElement('div');
        div.className = 'export-field-group';
        div.innerHTML = `<div class="export-field-group-title">${group.title}</div><div class="export-field-grid"></div>`;
        const grid = div.querySelector('.export-field-grid');
        group.keys.forEach(key => {
            const label = document.createElement('label');
            label.className = 'export-field-label';
            const checked = selected.has(key);
            label.innerHTML = `<input type="checkbox" data-export-key="${key}" ${checked ? 'checked' : ''}> <span>${key}</span>`;
            label.querySelector('input').onchange = () => {
                if (label.querySelector('input').checked) selected.add(key);
                else selected.delete(key);
                saveExportFields(selected);
                updateExportPreview();
            };
            grid.appendChild(label);
        });
        container.appendChild(div);
    });
    updateExportPreview();
}

function updateExportPreview() {
    const pre = document.getElementById('export-preview');
    if (!rawCompanies.length) { pre.textContent = 'No data'; return; }
    const selected = getSelectedFields();
    if (selected.size === 0) { pre.textContent = '(no fields selected)'; return; }
    const sample = cleanCompanyForExport(rawCompanies[0]);
    pre.textContent = JSON.stringify(sample, null, 2);
}

function exportModalCopyJSON() {
    const label = getFilterLabel();
    copyJSON(filteredList, label);
    closeExportModal();
}

function exportModalDownloadCSV() {
    downloadFilteredCSV();
    closeExportModal();
}

function exportModalCopyMarkdown() {
    copyFilteredMarkdown();
    closeExportModal();
}

// ══════════════════════════════════════════
//  EXPORT / COPY UTILITIES
// ══════════════════════════════════════════
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

function cleanCompanyForExport(c) {
    const selected = getSelectedFields();
    const full = {
        id: c.id,
        name: c.name,
        slug: c.slug,
        website: c.website || null,
        location: c.location || null,
        one_liner: c.description || null,
        long_description: c.longDescription || null,
        industry: c.industry,
        subindustry: c.subindustry || null,
        sub_label: c.subLabel || null,
        tags: c.tags || [],
        industries: c.industries || [],
        team_size: c.teamSize || 0,
        is_hiring: c.isHiring || false,
        status: c.status || null,
        stage: c.stage || null,
        batch: c.batch || null,
        regions: c.regions || [],
        logo: c.logo || null,
        yc_url: `https://www.ycombinator.com/companies/${c.slug}`,
        _starred: starredSet.has(c.id),
        _visited: visitedSet.has(c.id),
        _notes: (typeof notesMap !== 'undefined' && notesMap[c.id]) ? notesMap[c.id] : null
    };
    const out = {};
    selected.forEach(k => { if (full.hasOwnProperty(k)) out[k] = full[k]; });
    return out;
}

function copyJSON(companies, label) {
    if (!companies.length) { showToast('No companies to copy'); return; }
    const selected = getSelectedFields();
    if (selected.size === 0) { showToast('Select at least one field in Export settings'); return; }
    const data = companies.map(cleanCompanyForExport);
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        showToast(`Copied ${data.length} companies as JSON — ${label}`);
    }).catch(() => {
        const w = window.open('', '_blank');
        if (w) { w.document.write(`<pre>${json.replace(/</g, '&lt;')}</pre>`); }
        showToast('Opened JSON in new tab');
    });
}

function copyFilteredJSON() {
    const label = getFilterLabel();
    copyJSON(filteredList, label);
}

function copyIndustryJSON(industry) {
    const companies = rawCompanies.filter(c => c.industry === industry);
    copyJSON(companies, industry);
}

function copySubIndustryJSON(industry, sub) {
    const companies = rawCompanies.filter(c => c.industry === industry && c.subLabel === sub);
    copyJSON(companies, `${industry} > ${sub}`);
}

function copySingleCompanyJSON(companyId) {
    const c = rawCompanies.find(co => co.id === companyId);
    if (!c) return;
    const selected = getSelectedFields();
    if (selected.size === 0) { showToast('Select at least one field in Export settings'); return; }
    const data = cleanCompanyForExport(c);
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
        showToast(`Copied ${c.name} JSON`);
    });
}

function downloadFilteredCSV() {
    if (!filteredList.length) { showToast('No companies to export'); return; }
    const selected = getSelectedFields();
    const headers = ALL_EXPORT_KEYS.filter(k => selected.has(k));
    if (headers.length === 0) { showToast('Select at least one field in Export settings'); return; }
    const rows = filteredList.map(c => {
        const row = cleanCompanyForExport(c);
        return headers.map(h => {
            const v = row[h];
            if (v === null || v === undefined) return '';
            if (Array.isArray(v)) return `"${v.join(', ').replace(/"/g, '""')}"`;
            return `"${String(v).replace(/"/g, '""')}"`;
        });
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yc_w26_${getFilterLabel().replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${filteredList.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded CSV — ${filteredList.length} companies`);
}

function copyFilteredMarkdown() {
    if (!filteredList.length) { showToast('No companies to copy'); return; }
    let md = `| # | Name | One-liner | Industry | Sub | Hiring | Website |\n`;
    md += `|---|------|-----------|----------|-----|--------|----------|\n`;
    filteredList.forEach((c, i) => {
        const name = starredSet.has(c.id) ? `**${c.name}** ⭐` : c.name;
        const hiring = c.isHiring ? '✅' : '';
        const web = c.website ? `[Link](${c.website})` : '-';
        md += `| ${i+1} | ${name} | ${c.description || '-'} | ${c.industry} | ${c.subLabel} | ${hiring} | ${web} |\n`;
    });
    navigator.clipboard.writeText(md).then(() => {
        showToast(`Copied Markdown table — ${filteredList.length} rows`);
    });
}

function copyNicheSubs() {
    const subMap = {};
    rawCompanies.forEach(c => {
        const key = c.industry + '||' + c.subLabel;
        if (!subMap[key]) subMap[key] = { industry: c.industry, sub: c.subLabel, companies: [] };
        subMap[key].companies.push(c);
    });
    const niche = Object.values(subMap).filter(s => s.companies.length <= 5);
    const nicheCompanies = niche.flatMap(s => s.companies);
    copyJSON(nicheCompanies, `Niche (≤5 per sub)`);
}

function getFilterLabel() {
    const parts = [];
    if (activeIndustry) parts.push(activeIndustry);
    if (activeSubIndustry) parts.push(activeSubIndustry);
    if (activeFilters.starred) parts.push('Starred');
    if (activeFilters.unvisited) parts.push('Unvisited');
    if (activeFilters.hiring) parts.push('Hiring');
    const search = document.getElementById('search-input').value.trim();
    if (search) parts.push(`"${search}"`);
    return parts.length ? parts.join(' + ') : 'All';
}
