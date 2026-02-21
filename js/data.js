// ══════════════════════════════════════════
//  LOAD DATA
// ══════════════════════════════════════════
function loadData() {
    rawCompanies = YC_COMPANIES_DATA.map(hit => ({
        id: hit.id,
        name: hit.name || '',
        slug: hit.slug || '',
        logo: hit.small_logo_thumb_url || '',
        website: hit.website || '',
        location: hit.all_locations || '',
        longDescription: hit.long_description || '',
        description: hit.one_liner || '',
        teamSize: hit.team_size || 0,
        industry: hit.industry || 'Other',
        subindustry: hit.subindustry || '',
        tags: hit.tags || [],
        industries: hit.industries || [],
        isHiring: hit.isHiring || false,
        status: hit.status || 'Active',
        stage: hit.stage || '',
        batch: hit.batch || 'Winter 2026',
        regions: hit.regions || [],
        nonprofit: hit.nonprofit || false,
        top_company: hit.top_company || false
    }));

    // Parse subindustry into clean sub-label
    rawCompanies.forEach(c => {
        // subindustry is like "B2B -> Engineering, Product and Design"
        const parts = (c.subindustry || '').split('->').map(s => s.trim());
        c.subLabel = parts.length > 1 ? parts[parts.length - 1] : (c.industries.length > 1 ? c.industries[1] : c.industry);
    });

    filteredList = [...rawCompanies];
    try {
        notesMap = JSON.parse(localStorage.getItem('yc-notes') || '{}');
    } catch (_) { notesMap = {}; }
    document.getElementById('loading').style.display = 'none';
    buildTree();
    buildList();
    initGraph();
    updateAllCounts();
}
