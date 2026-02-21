// ══════════════════════════════════════════
//  FIND SIMILAR
// ══════════════════════════════════════════
const STOPWORDS = new Set('a an the and or but in on at to for of with by from as is was are were been be have has had do does did will would could should may might must can this that these those it its'.split(' '));

function tokenize(text) {
    if (!text || typeof text !== 'string') return new Set();
    const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w));
    return new Set(words);
}

function jaccard(setA, setB) {
    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;
    let inter = 0;
    setA.forEach(x => { if (setB.has(x)) inter++; });
    return inter / (setA.size + setB.size - inter);
}

function computeSimilarity(a, b) {
    if (a.id === b.id) return 0;
    let tagSim = 0;
    const tagsA = new Set((a.tags || []).map(t => t.toLowerCase()));
    const tagsB = new Set((b.tags || []).map(t => t.toLowerCase()));
    if (tagsA.size || tagsB.size) tagSim = jaccard(tagsA, tagsB);
    const subSame = (a.subLabel === b.subLabel) ? 1 : 0;
    const indSame = (a.industry === b.industry) ? 1 : 0;
    const textA = tokenize((a.description || '') + ' ' + (a.longDescription || ''));
    const textB = tokenize((b.description || '') + ' ' + (b.longDescription || ''));
    const textSim = textA.size || textB.size ? jaccard(textA, textB) : 0;
    return 0.4 * tagSim + 0.25 * subSame + 0.1 * indSame + 0.25 * textSim;
}

function findSimilar(companyId, topN) {
    topN = topN || 15;
    const company = rawCompanies.find(c => c.id === companyId);
    if (!company) return;
    
    // Try to use pre-computed semantic similarity if available
    if (typeof isSimilarityReady === 'function' && isSimilarityReady()) {
        const topSimilar = getTopSimilar(companyId, topN, 20); // minScore 20%
        if (topSimilar.length > 0) {
            const scored = topSimilar.map(s => {
                const c = rawCompanies.find(co => co.id === s.id);
                return c ? { company: c, score: s.score / 100 } : null;
            }).filter(Boolean);
            showSimilarPanel(scored, true);
            return;
        }
    }
    
    // Fallback to basic Jaccard similarity
    const scored = rawCompanies
        .filter(c => c.id !== companyId)
        .map(c => ({ company: c, score: computeSimilarity(company, c) }))
        .sort((x, y) => y.score - x.score)
        .slice(0, topN);
    showSimilarPanel(scored, false);
}

function showSimilarPanel(results, isSemantic = false) {
    const panel = document.getElementById('similar-panel');
    const title = panel?.querySelector('.similar-panel-title');
    const body = document.getElementById('similar-panel-body');
    
    // Update title based on similarity type
    if (title) {
        title.innerHTML = isSemantic 
            ? '<i class="fa-solid fa-brain text-purple-400 mr-2"></i>AI-Powered Similar'
            : '<i class="fa-solid fa-link text-blue-400 mr-2"></i>Similar Companies';
    }
    
    body.innerHTML = '';
    results.forEach(({ company: c, score }) => {
        const row = document.createElement('div');
        row.className = 'similar-row';
        const scoreColor = score >= 0.7 ? 'text-green-400 bg-green-400/15' : 
                          score >= 0.5 ? 'text-blue-400 bg-blue-400/15' : 
                          'text-slate-400 bg-slate-400/15';
        row.innerHTML = `
            <img src="${c.logo}" class="w-9 h-9 rounded-lg bg-slate-800 object-contain flex-shrink-0" onerror="this.style.display='none'">
            <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-slate-200 truncate">${c.name}</div>
                <div class="text-[10px] text-slate-500 truncate">${c.description || ''}</div>
            </div>
            <span class="similar-score ${scoreColor}">${Math.round(score * 100)}%</span>
        `;
        row.onclick = () => { selectCompanyById(c.id); closeSimilarPanel(); };
        body.appendChild(row);
    });
    panel.classList.add('show');
}

function closeSimilarPanel() {
    document.getElementById('similar-panel').classList.remove('show');
}
