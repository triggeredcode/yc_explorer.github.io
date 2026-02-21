// ══════════════════════════════════════════
//  INSIGHTS ENGINE
// ══════════════════════════════════════════
function buildInsights() {
    const container = document.getElementById('insights-view');
    container.innerHTML = '';

    // ── 1. Industry breakdown (sorted smallest first) ──
    const industryMap = {};
    rawCompanies.forEach(c => {
        if (!industryMap[c.industry]) industryMap[c.industry] = [];
        industryMap[c.industry].push(c);
    });
    const industries = Object.entries(industryMap).sort((a, b) => a[1].length - b[1].length);

    // ── 2. Sub-industry breakdown ──
    const subMap = {};
    rawCompanies.forEach(c => {
        const key = c.industry + '||' + c.subLabel;
        if (!subMap[key]) subMap[key] = { industry: c.industry, sub: c.subLabel, companies: [] };
        subMap[key].companies.push(c);
    });
    const sortedSubs = Object.values(subMap).sort((a, b) => a.companies.length - b.companies.length);

    // ── 3. Tag frequency ──
    const tagCount = {};
    rawCompanies.forEach(c => (c.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const sortedTags = Object.entries(tagCount).sort((a, b) => a[1] - b[1]);

    // ── Render: Overview ──
    container.innerHTML += `
        <div class="rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-3">
            <p class="text-[9px] uppercase font-bold text-blue-400 tracking-widest mb-2"><i class="fa-solid fa-chart-pie mr-1"></i> Batch Overview</p>
            <div class="grid grid-cols-3 gap-2 text-center">
                <div><p class="text-lg font-bold text-white">${rawCompanies.length}</p><p class="text-[9px] text-slate-500">Total</p></div>
                <div><p class="text-lg font-bold text-green-400">${rawCompanies.filter(c=>c.isHiring).length}</p><p class="text-[9px] text-slate-500">Hiring</p></div>
                <div><p class="text-lg font-bold text-purple-400">${industries.length}</p><p class="text-[9px] text-slate-500">Industries</p></div>
            </div>
            <div class="mt-2 pt-2 border-t border-white/5 grid grid-cols-3 gap-2 text-center">
                <div><p class="text-lg font-bold text-cyan-400">${sortedSubs.length}</p><p class="text-[9px] text-slate-500">Sub-cats</p></div>
                <div><p class="text-lg font-bold text-yellow-400">${sortedTags.length}</p><p class="text-[9px] text-slate-500">Uniq Tags</p></div>
                <div><p class="text-lg font-bold text-orange-400">${rawCompanies.filter(c=>c.teamSize<=2).length}</p><p class="text-[9px] text-slate-500">Solo/Duo</p></div>
            </div>
        </div>`;

    // ── Render: Industry Saturation ──
    const maxInd = Math.max(...industries.map(i => i[1].length));
    let indHTML = `<div class="rounded-lg border border-white/5 bg-slate-900/30 p-3">
        <div class="flex items-center justify-between mb-2">
            <p class="text-[9px] uppercase font-bold text-slate-400 tracking-widest"><i class="fa-solid fa-ranking-star mr-1"></i> Industry Saturation <span class="text-slate-600">(least crowded first)</span></p>
        </div>
        <div class="space-y-1.5">`;
    industries.forEach(([ind, comps]) => {
        const pct = (comps.length / maxInd * 100).toFixed(0);
        const hiring = comps.filter(c => c.isHiring).length;
        const color = industryColors[ind] || '#768390';
        const escapedInd = ind.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        indHTML += `
            <div class="group cursor-pointer" onclick="drillIndustry('${escapedInd}');switchTab('tree')">
                <div class="flex items-center justify-between mb-0.5">
                    <span class="text-[11px] font-semibold text-slate-200 group-hover:text-white">${ind}</span>
                    <span class="text-[10px] text-slate-500">${comps.length} <span class="text-slate-600 text-[9px]">co</span> · ${hiring} <span class="text-green-500/60 text-[9px]">hiring</span></span>
                </div>
                <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full rounded-full" style="width:${pct}%;background:${color}"></div>
                </div>
            </div>`;
    });
    indHTML += '</div></div>';
    container.innerHTML += indHTML;

    // ── Render: Least Explored Sub-industries ──
    const nicheThreshold = 5;
    const nicheSubs = sortedSubs.filter(s => s.companies.length <= nicheThreshold);
    let nicheHTML = `<div class="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
        <div class="flex items-center justify-between mb-1">
            <p class="text-[9px] uppercase font-bold text-emerald-400 tracking-widest"><i class="fa-solid fa-gem mr-1"></i> Least Crowded Sub-industries</p>
            <button class="copy-btn" onclick="event.stopPropagation();copyNicheSubs()"><i class="fa-regular fa-copy"></i> JSON</button>
        </div>
        <p class="text-[10px] text-slate-500 mb-3">${nicheSubs.length} sub-categories with ≤${nicheThreshold} companies — potential whitespace</p>
        <div class="space-y-2">`;

    nicheSubs.forEach(sg => {
        const color = industryColors[sg.industry] || '#768390';
        const hiring = sg.companies.filter(c => c.isHiring).length;
        const escapedInd = sg.industry.replace(/'/g, "\\'");
        const escapedSub = sg.sub.replace(/'/g, "\\'");
        nicheHTML += `
            <div class="rounded-md border border-white/5 bg-slate-900/40 p-2.5 hover:bg-slate-800/40 transition-colors">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-1.5 cursor-pointer" onclick="drillSubIndustry('${escapedInd}','${escapedSub}');switchTab('list')">
                        <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${color}"></span>
                        <span class="text-[11px] font-semibold text-slate-200">${sg.sub}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="copy-btn" onclick="event.stopPropagation();copySubIndustryJSON('${escapedInd}','${escapedSub}')" title="Copy JSON"><i class="fa-regular fa-copy"></i></button>
                        ${hiring > 0 ? `<span class="text-[9px] text-green-400"><i class="fa-solid fa-briefcase"></i> ${hiring}</span>` : ''}
                        <span class="text-[10px] font-bold text-white bg-slate-700 px-1.5 py-0.5 rounded">${sg.companies.length}</span>
                    </div>
                </div>
                <p class="text-[9px] text-slate-500 mb-1.5">${sg.industry}</p>
                <div class="space-y-1">`;
        sg.companies.forEach(c => {
            nicheHTML += `
                    <div class="flex items-start gap-2 py-0.5">
                        <img src="${c.logo}" class="w-5 h-5 rounded bg-slate-800 object-contain flex-shrink-0 mt-0.5" onerror="this.style.display='none'">
                        <div class="min-w-0">
                            <span class="text-[10px] font-semibold text-slate-300">${c.name}</span>
                            ${c.isHiring ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-green-500 ml-1"></span>' : ''}
                            ${starredSet.has(c.id) ? '<i class="fa-solid fa-star text-[7px] text-yellow-500 ml-0.5"></i>' : ''}
                            <p class="text-[9px] text-slate-500 leading-tight">${c.description}</p>
                        </div>
                    </div>`;
        });
        nicheHTML += '</div></div>';
    });
    nicheHTML += '</div></div>';
    container.innerHTML += nicheHTML;

    // ── Render: Rare/Niche Tags ──
    const rareTags = sortedTags.filter(([t, c]) => c <= 3);
    let rareHTML = `<div class="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
        <p class="text-[9px] uppercase font-bold text-amber-400 tracking-widest mb-1"><i class="fa-solid fa-fingerprint mr-1"></i> Niche Tags <span class="text-slate-600">(≤3 companies)</span></p>
        <p class="text-[10px] text-slate-500 mb-2">${rareTags.length} unique niche tags — areas with very few players</p>
        <div class="flex flex-wrap gap-1">`;
    rareTags.forEach(([tag, cnt]) => {
        const opacity = cnt === 1 ? '1' : cnt === 2 ? '0.8' : '0.65';
        rareHTML += `<span class="tag-pill text-[9px]" style="opacity:${opacity}" onclick="document.getElementById('search-input').value='${tag.replace(/'/g, "\\'")}';recomputeFilteredList();switchTab('list')">${tag} <span class="text-slate-600">${cnt}</span></span>`;
    });
    rareHTML += '</div></div>';
    container.innerHTML += rareHTML;

    // ── Render: Biggest (most saturated) Sub-industries ──
    const bigSubs = [...sortedSubs].reverse().slice(0, 10);
    let bigHTML = `<div class="rounded-lg border border-red-500/15 bg-red-500/5 p-3">
        <div class="flex items-center justify-between mb-1">
            <p class="text-[9px] uppercase font-bold text-red-400 tracking-widest"><i class="fa-solid fa-fire mr-1"></i> Most Crowded Sub-industries</p>
        </div>
        <p class="text-[10px] text-slate-500 mb-2">Highest competition — harder to stand out</p>
        <div class="space-y-1">`;
    bigSubs.forEach(sg => {
        const color = industryColors[sg.industry] || '#768390';
        const escapedInd = sg.industry.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedSub = sg.sub.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        bigHTML += `
            <div class="flex items-center justify-between py-1 cursor-pointer hover:bg-white/[0.02] rounded px-1"
                 onclick="drillSubIndustry('${escapedInd}','${escapedSub}');switchTab('list')">
                <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${color}"></span>
                    <span class="text-[11px] text-slate-300">${sg.sub}</span>
                    <span class="text-[9px] text-slate-600">${sg.industry}</span>
                </div>
                <span class="text-[10px] font-bold text-red-400">${sg.companies.length}</span>
            </div>`;
    });
    bigHTML += '</div></div>';
    container.innerHTML += bigHTML;

    // ── Render: Top Tags ──
    const topTags = [...sortedTags].reverse().slice(0, 15);
    let topHTML = `<div class="rounded-lg border border-white/5 bg-slate-900/30 p-3">
        <p class="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-2"><i class="fa-solid fa-hashtag mr-1"></i> Most Common Tags</p>
        <div class="space-y-1">`;
    topTags.forEach(([tag, cnt]) => {
        const pct = (cnt / rawCompanies.length * 100).toFixed(0);
        topHTML += `
            <div class="flex items-center gap-2 cursor-pointer hover:bg-white/[0.02] rounded py-0.5 px-1"
                 onclick="document.getElementById('search-input').value='${tag.replace(/'/g, "\\'")}';recomputeFilteredList();switchTab('list')">
                <span class="text-[11px] text-slate-300 flex-1">${tag}</span>
                <div class="w-24 h-1 bg-slate-800 rounded-full overflow-hidden flex-shrink-0">
                    <div class="h-full bg-blue-500/60 rounded-full" style="width:${pct}%"></div>
                </div>
                <span class="text-[10px] text-slate-500 w-8 text-right">${cnt}</span>
            </div>`;
    });
    topHTML += '</div></div>';
    container.innerHTML += topHTML;

    // ── Render: Hiring hotspots ──
    const hiringBySub = {};
    rawCompanies.filter(c => c.isHiring).forEach(c => {
        const key = c.industry + '||' + c.subLabel;
        if (!hiringBySub[key]) hiringBySub[key] = { industry: c.industry, sub: c.subLabel, count: 0 };
        hiringBySub[key].count++;
    });
    const hiringHotspots = Object.values(hiringBySub).sort((a, b) => b.count - a.count).slice(0, 10);
    let hiringHTML = `<div class="rounded-lg border border-green-500/15 bg-green-500/5 p-3">
        <div class="flex items-center justify-between mb-2">
            <p class="text-[9px] uppercase font-bold text-green-400 tracking-widest"><i class="fa-solid fa-briefcase mr-1"></i> Hiring Hotspots</p>
            <button class="copy-btn" onclick="event.stopPropagation();copyJSON(rawCompanies.filter(c=>c.isHiring),'Hiring')"><i class="fa-regular fa-copy"></i> JSON</button>
        </div>
        <div class="space-y-1">`;
    hiringHotspots.forEach(h => {
        const escapedInd = h.industry.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedSub = h.sub.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        hiringHTML += `
            <div class="flex items-center justify-between py-0.5 cursor-pointer hover:bg-white/[0.02] rounded px-1"
                 onclick="drillSubIndustry('${escapedInd}','${escapedSub}');switchTab('list')">
                <span class="text-[11px] text-slate-300">${h.sub} <span class="text-[9px] text-slate-600">${h.industry}</span></span>
                <span class="text-[10px] font-semibold text-green-400">${h.count} hiring</span>
            </div>`;
    });
    hiringHTML += '</div></div>';
    container.innerHTML += hiringHTML;
}
