// ══════════════════════════════════════════
//  PRE-COMPUTED SIMILARITY DATA ACCESS
// ══════════════════════════════════════════

let _similarityData = null;
let _similarityReady = false;
let _currentClusterLevel = 25;  // Default cluster granularity

function initSimilarityData() {
    if (typeof YC_SIMILARITY_DATA !== 'undefined') {
        _similarityData = YC_SIMILARITY_DATA;
        _similarityReady = true;
        
        // Set default cluster level from meta if available
        if (_similarityData.meta?.defaultClusterLevel) {
            _currentClusterLevel = _similarityData.meta.defaultClusterLevel;
        }
        
        // Similarity data loaded successfully
    } else {
        console.warn('YC_SIMILARITY_DATA not found, similarity features disabled');
    }
}

function isSimilarityReady() {
    return _similarityReady && _similarityData !== null;
}

function getSimilarity(idA, idB) {
    if (!_similarityData) return 0;
    const a = Math.min(idA, idB);
    const b = Math.max(idA, idB);
    return _similarityData.similarities[a]?.[b] || _similarityData.similarities[b]?.[a] || 0;
}

function getTopSimilar(companyId, n = 10, minScore = 15) {
    if (!_similarityData) return [];
    const top = _similarityData.topSimilar[companyId];
    if (!top) return [];
    return top
        .filter(([id, score]) => score >= minScore)
        .slice(0, n)
        .map(([id, score]) => ({ id, score }));
}

function getSimilarityEdges(threshold = 25, maxEdges = 5000) {
    if (!_similarityData || !_similarityData.similarities) {
        console.warn('No similarity data available');
        return [];
    }
    
    const edges = [];
    const similarities = _similarityData.similarities;
    
    for (const sourceId in similarities) {
        const neighbors = similarities[sourceId];
        for (const targetId in neighbors) {
            const score = neighbors[targetId];
            // Only add each edge once (source < target)
            if (score >= threshold && parseInt(sourceId) < parseInt(targetId)) {
                edges.push({
                    source: parseInt(sourceId),
                    target: parseInt(targetId),
                    score: score
                });
            }
        }
    }
    
    // Sort by score descending
    edges.sort((a, b) => b.score - a.score);
    
    return edges.slice(0, maxEdges);
}

function getAvailableClusterLevels() {
    if (!_similarityData) return [];
    return _similarityData.meta.clusterLevels || [];
}

function setClusterLevel(level) {
    const levels = getAvailableClusterLevels();
    if (levels.includes(level)) {
        _currentClusterLevel = level;
    }
}

function getCurrentClusterLevel() {
    return _currentClusterLevel;
}

function getClusters(level = null) {
    if (!_similarityData || !_similarityData.clusters) return [];
    const l = String(level || _currentClusterLevel);  // Convert to string for object key
    return _similarityData.clusters[l]?.clusters || [];
}

function getCompanyCluster(companyId, level = null) {
    if (!_similarityData || !_similarityData.clusters) return null;
    const l = String(level || _currentClusterLevel);
    const mapping = _similarityData.clusters[l]?.companyToCluster;
    if (!mapping) return null;
    const clusterId = mapping[companyId];
    if (clusterId === undefined) return null;
    return getClusters(l).find(c => c.id === clusterId);
}

function getClusterById(clusterId, level = null) {
    if (!_similarityData || !_similarityData.clusters) return null;
    const l = String(level || _currentClusterLevel);
    return getClusters(l).find(c => c.id === clusterId);
}

function getClusterCompanies(clusterId, level = null) {
    const cluster = getClusterById(clusterId, level);
    if (!cluster) return [];
    return cluster.companies;
}

function getSimilarityMeta() {
    if (!_similarityData) return null;
    return _similarityData.meta;
}

function getCompanyProjection(companyId) {
    if (!_similarityData || !_similarityData.projection) return null;
    return _similarityData.projection[companyId] || null;
}

function getAllProjections() {
    if (!_similarityData || !_similarityData.projection) return {};
    return _similarityData.projection;
}

function initSimilarityComputation() {
    initSimilarityData();
}
