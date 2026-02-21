// ══════════════════════════════════════════
//  ANALYTICS ENGINE - Query Resolver
// ══════════════════════════════════════════

const _queryCache = new Map();

// ── Query Functions ──

const QUERIES = {
    // Distribution queries
    teamSizeDistribution: () => {
        const dist = {};
        rawCompanies.forEach(c => {
            const size = c.teamSize || 0;
            const bucket = size === 0 ? 'Unknown' : 
                          size <= 2 ? '1-2' :
                          size <= 5 ? '3-5' :
                          size <= 10 ? '6-10' :
                          size <= 20 ? '11-20' : '21+';
            dist[bucket] = (dist[bucket] || 0) + 1;
        });
        return Object.entries(dist).map(([bucket, count]) => ({ bucket, count }));
    },
    
    hiringByIndustry: () => {
        const byIndustry = {};
        rawCompanies.forEach(c => {
            if (!byIndustry[c.industry]) {
                byIndustry[c.industry] = { total: 0, hiring: 0 };
            }
            byIndustry[c.industry].total++;
            if (c.isHiring) byIndustry[c.industry].hiring++;
        });
        return Object.entries(byIndustry).map(([industry, data]) => ({
            industry,
            total: data.total,
            hiring: data.hiring,
            pct: Math.round((data.hiring / data.total) * 100)
        })).sort((a, b) => b.pct - a.pct);
    },
    
    locationBreakdown: () => {
        const byLocation = {};
        rawCompanies.forEach(c => {
            const loc = c.location || 'Unknown';
            byLocation[loc] = (byLocation[loc] || 0) + 1;
        });
        return Object.entries(byLocation)
            .map(([location, count]) => ({ location, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
    },
    
    tagCoOccurrence: () => {
        const tagPairs = new Map();
        rawCompanies.forEach(c => {
            const tags = c.tags || [];
            for (let i = 0; i < tags.length; i++) {
                for (let j = i + 1; j < tags.length; j++) {
                    const pair = [tags[i], tags[j]].sort().join('|');
                    tagPairs.set(pair, (tagPairs.get(pair) || 0) + 1);
                }
            }
        });
        return Array.from(tagPairs.entries())
            .map(([pair, count]) => ({ pair: pair.split('|'), count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 30);
    },
    
    // Gap analysis
    industrySubindustryMatrix: () => {
        const matrix = {};
        rawCompanies.forEach(c => {
            const ind = c.industry || 'Other';
            const sub = c.subLabel || 'Other';
            if (!matrix[ind]) matrix[ind] = {};
            matrix[ind][sub] = (matrix[ind][sub] || 0) + 1;
        });
        return matrix;
    },
    
    sparseCategories: () => {
        const matrix = QUERIES.industrySubindustryMatrix();
        const sparse = [];
        Object.entries(matrix).forEach(([industry, subs]) => {
            Object.entries(subs).forEach(([sub, count]) => {
                if (count <= 3) {
                    sparse.push({ industry, sub, count });
                }
            });
        });
        return sparse.sort((a, b) => a.count - b.count);
    },
    
    tagIndustryGaps: () => {
        const tagByIndustry = {};
        rawCompanies.forEach(c => {
            const ind = c.industry || 'Other';
            (c.tags || []).forEach(tag => {
                if (!tagByIndustry[tag]) tagByIndustry[tag] = {};
                tagByIndustry[tag][ind] = (tagByIndustry[tag][ind] || 0) + 1;
            });
        });
        const gaps = [];
        Object.entries(tagByIndustry).forEach(([tag, industries]) => {
            const inds = Object.keys(industries);
            if (inds.length === 1 && industries[inds[0]] <= 2) {
                gaps.push({ tag, industry: inds[0], count: industries[inds[0]] });
            }
        });
        return gaps.sort((a, b) => a.count - b.count);
    },
    
    // Similarity-based
    clusterAnalysis: (level = 25) => {
        if (!isSimilarityReady()) return [];
        const clusters = getClusters(level);
        return clusters.map(cl => ({
            id: cl.id,
            label: cl.label,
            size: cl.size,
            companies: cl.companies.slice(0, 10) // Top 10 for preview
        }));
    },
    
    outlierCompanies: () => {
        if (!isSimilarityReady()) return [];
        const outliers = [];
        rawCompanies.forEach(c => {
            const similar = getTopSimilar(c.id, 5, 20);
            if (similar.length === 0 || similar[0].score < 30) {
                outliers.push({ id: c.id, name: c.name, maxSimilarity: similar[0]?.score || 0 });
            }
        });
        return outliers.sort((a, b) => a.maxSimilarity - b.maxSimilarity).slice(0, 20);
    },
    
    // Trend queries
    hiringVsTeamSize: () => {
        const buckets = {};
        rawCompanies.forEach(c => {
            const size = c.teamSize || 0;
            const bucket = size === 0 ? 'Unknown' : 
                          size <= 2 ? '1-2' :
                          size <= 5 ? '3-5' :
                          size <= 10 ? '6-10' :
                          size <= 20 ? '11-20' : '21+';
            if (!buckets[bucket]) buckets[bucket] = { total: 0, hiring: 0 };
            buckets[bucket].total++;
            if (c.isHiring) buckets[bucket].hiring++;
        });
        return Object.entries(buckets).map(([bucket, data]) => ({
            bucket,
            total: data.total,
            hiring: data.hiring,
            pct: Math.round((data.hiring / data.total) * 100)
        }));
    },
    
    topCompanyProfile: () => {
        const top = rawCompanies.filter(c => c.top_company);
        return {
            count: top.length,
            avgTeamSize: Math.round(top.reduce((sum, c) => sum + (c.teamSize || 0), 0) / top.length || 0),
            hiringPct: Math.round((top.filter(c => c.isHiring).length / top.length) * 100 || 0)
        };
    }
};

// ── Query Runner ──

function runQuery(queryName, params = {}) {
    const cacheKey = `${queryName}:${JSON.stringify(params)}`;
    if (_queryCache.has(cacheKey)) {
        return _queryCache.get(cacheKey);
    }
    
    const queryFn = QUERIES[queryName];
    if (!queryFn) {
        console.warn(`Unknown query: ${queryName}`);
        return null;
    }
    
    const result = queryFn(params);
    _queryCache.set(cacheKey, result);
    return result;
}

function getQueryResult(queryName, params = {}) {
    return runQuery(queryName, params);
}

function clearQueryCache() {
    _queryCache.clear();
}

// Note: Query cache is cleared when needed, but queries operate on rawCompanies
// to show batch-wide analytics, not filtered results. This is intentional.
