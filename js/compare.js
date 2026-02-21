// ══════════════════════════════════════════
//  COMPARE MODE
// ══════════════════════════════════════════
function toggleCompareMode() {
    compareMode = !compareMode;
    document.getElementById('compare-mode-btn').classList.toggle('bg-blue-500/20', compareMode);
    document.getElementById('compare-mode-btn').classList.toggle('text-blue-400', compareMode);
    const tray = document.getElementById('compare-tray');
    if (compareMode) {
        tray.classList.add('show');
        renderCompareTray();
    } else {
        tray.classList.remove('show');
        compareSet.clear();
    }
}

function addToCompare(companyId) {
    if (compareSet.size >= 3 && !compareSet.has(companyId)) return;
    compareSet.add(companyId);
    renderCompareTray();
}

function removeFromCompare(companyId) {
    compareSet.delete(companyId);
    renderCompareTray();
}

function renderCompareTray() {
    const container = document.getElementById('compare-tray-items');
    container.innerHTML = '';
    compareSet.forEach(id => {
        const c = rawCompanies.find(x => x.id === id);
        if (!c) return;
        const div = document.createElement('div');
        div.className = 'compare-tray-item';
        div.innerHTML = `<img src="${c.logo}" onerror="this.style.display='none'"><span class="text-xs font-semibold text-slate-200">${c.name}</span><button type="button" class="text-slate-500 hover:text-red-400 text-[10px]" onclick="event.stopPropagation();removeFromCompare(${id})"><i class="fa-solid fa-xmark"></i></button>`;
        container.appendChild(div);
    });
    document.getElementById('compare-open-btn').disabled = compareSet.size < 2;
}

const COMPARE_FIELDS = ['name', 'description', 'industry', 'subLabel', 'tags', 'location', 'teamSize', 'isHiring', 'website', 'status', 'stage'];

function showComparison() {
    if (compareSet.size < 2) return;
    const companies = [...compareSet].map(id => rawCompanies.find(c => c.id === id)).filter(Boolean);
    const container = document.getElementById('compare-table-container');
    let html = '<table class="compare-table"><thead><tr><th>Field</th>';
    companies.forEach(c => { html += `<th>${c.name}</th>`; });
    html += '</tr></thead><tbody>';
    COMPARE_FIELDS.forEach(field => {
        const key = field === 'subLabel' ? 'subLabel' : field;
        const values = companies.map(c => {
            let v = c[key];
            if (key === 'tags' && Array.isArray(v)) v = v.join(', ');
            return v !== undefined && v !== null && v !== '' ? String(v) : '—';
        });
        const allSame = values.every(v => v === values[0]);
        html += '<tr>';
        html += `<td class="font-semibold text-slate-400">${field}</td>`;
        values.forEach((v, i) => {
            html += `<td class="${allSame ? 'same' : 'diff'}">${v.replace(/</g, '&lt;')}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
    document.getElementById('compare-overlay').classList.add('show');
}

function closeCompareOverlay() {
    document.getElementById('compare-overlay').classList.remove('show');
}
