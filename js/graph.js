// ══════════════════════════════════════════
//  GRAPH with Hierarchical Cluster Visualization
// ══════════════════════════════════════════

// Distinct color palettes for each depth level
const DEPTH_PALETTES = [
    // Level 0 (Industry) - bold primary colors
    ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
    // Level 1 (SubIndustry) - medium saturation
    ['#60a5fa', '#f87171', '#4ade80', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#a3e635'],
    // Level 2 (Cluster) - lighter tones
    ['#93c5fd', '#fca5a5', '#86efac', '#fcd34d', '#c4b5fd', '#f9a8d4', '#67e8f9', '#bef264'],
    // Level 3+ (Deep clusters) - pastel
    ['#bfdbfe', '#fecaca', '#bbf7d0', '#fde68a', '#ddd6fe', '#fbcfe8', '#a5f3fc', '#d9f99d']
];

// Track expanded clusters
let expandedClusters = new Set();
let clusterTree = null;

function initGraph() {
    // Build the hierarchical cluster tree
    clusterTree = buildClusterTree();
    
    // Everything is always expanded - no collapse option
    expandedClusters = new Set(['root']);
    function expandAll(node) {
        expandedClusters.add(node.id);
        if (node.children) {
            node.children.forEach(expandAll);
        }
    }
    expandAll(clusterTree);
    
    renderGraph();
}

function buildClusterTree() {
    const root = {
        id: 'root',
        name: 'YC W26',
        type: 'root',
        depth: 0,
        children: [],
        companies: [...rawCompanies]
    };
    
    // Group by industry
    const industries = [...new Set(rawCompanies.map(c => c.industry))].sort();
    
    industries.forEach((ind, indIdx) => {
        const indCompanies = rawCompanies.filter(c => c.industry === ind);
        const industryNode = {
            id: `ind-${ind}`,
            name: ind,
            type: 'industry',
            depth: 1,
            color: DEPTH_PALETTES[0][indIdx % DEPTH_PALETTES[0].length],
            parent: root,
            children: [],
            companies: indCompanies
        };
        
        // Group by sub-industry
        const subs = [...new Set(indCompanies.map(c => c.subLabel))].sort();
        
        subs.forEach((sub, subIdx) => {
            const subCompanies = indCompanies.filter(c => c.subLabel === sub);
            const subColor = DEPTH_PALETTES[1][(indIdx * 3 + subIdx) % DEPTH_PALETTES[1].length];
            
            const subNode = {
                id: `sub-${ind}-${sub}`,
                name: sub,
                type: 'subindustry',
                depth: 2,
                color: subColor,
                parent: industryNode,
                children: [],
                companies: subCompanies,
                industry: ind
            };
            
            // Recursively cluster if similarity data available and enough companies
            if (isSimilarityReady() && subCompanies.length > 8) {
                buildDeepClusters(subNode, subCompanies, 3, indIdx * 10 + subIdx);
            }
            
            industryNode.children.push(subNode);
        });
        
        root.children.push(industryNode);
    });
    
    return root;
}

function buildDeepClusters(parentNode, companies, depth, colorSeed) {
    if (companies.length <= 6 || depth > 5) return;
    
    const variance = computeSimilarityVariance(companies);
    if (variance < 15) return;
    
    const numClusters = Math.min(Math.max(2, Math.ceil(companies.length / 10)), 4);
    const clusters = clusterBySimilarity(companies, numClusters);
    
    if (clusters.length <= 1) return;
    
    // Only add cluster children if we got meaningful splits
    const validClusters = clusters.filter(c => c.length >= 2);
    if (validClusters.length <= 1) return;
    
    validClusters.forEach((clusterCompanies, idx) => {
        const palette = DEPTH_PALETTES[Math.min(depth, DEPTH_PALETTES.length - 1)];
        const clusterNode = {
            id: `${parentNode.id}-c${idx}`,
            name: `Cluster ${idx + 1}`,
            type: 'cluster',
            depth: depth,
            color: palette[(colorSeed + idx) % palette.length],
            parent: parentNode,
            children: [],
            companies: clusterCompanies,
            industry: parentNode.industry
        };
        
        // Recurse deeper
        buildDeepClusters(clusterNode, clusterCompanies, depth + 1, colorSeed * 3 + idx);
        
        parentNode.children.push(clusterNode);
    });
}

function renderGraph() {
    const container = document.getElementById('graph-container');
    container.innerHTML = '';
    
    const W = window.innerWidth;
    const H = window.innerHeight;
    
    const svg = d3.select(container).append('svg').attr('width', W).attr('height', H);
    const g = svg.append('g');
    const zoomBehavior = d3.zoom().scaleExtent([0.08, 5]).on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoomBehavior);
    
    document.getElementById('reset-view-btn').onclick = () => {
        svg.transition().duration(600).call(zoomBehavior.transform, d3.zoomIdentity);
    };
    
    // Collect visible nodes based on expansion state
    const { nodes, links } = collectVisibleNodes();
    
    const sim = d3.forceSimulation(nodes)
        .alphaDecay(0.025)
        .velocityDecay(0.5)
        .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
            if (d.source.type === 'root') return 250;
            if (d.source.type === 'industry') return 100;
            if (d.source.type === 'subindustry' || d.source.type === 'cluster') return 25;
            return 18;
        }).strength(d => {
            if (d.source.type === 'root') return 0.2;
            if (d.source.type === 'industry') return 0.5;
            if (d.source.type === 'subindustry' || d.source.type === 'cluster') return 1;
            return 0.8;
        }))
        .force('charge', d3.forceManyBody().strength(d => {
            if (d.type === 'root') return -2000;
            if (d.type === 'industry') return -800;
            if (d.type === 'subindustry') return -300;
            if (d.type === 'cluster') return -150;
            return -10;
        }))
        .force('center', d3.forceCenter(W / 2 + 140, H / 2))
        .force('collision', d3.forceCollide().radius(d => {
            if (d.type === 'root') return 35;
            if (d.type === 'industry') return 20;
            if (d.type === 'subindustry' || d.type === 'cluster') return 12;
            return 6;
        }).strength(0.7));
    
    // Render hulls layer (behind everything)
    const hullsG = g.append('g').attr('class', 'hulls-layer');
    
    // Render links - all links visible but startup links are subtle
    const linkEl = g.append('g').selectAll('line').data(links).enter().append('line')
        .attr('class', 'link')
        .attr('stroke', d => {
            if (d.target.type === 'startup') return 'rgba(100,100,100,0.08)';
            return 'rgba(88,166,255,0.2)';
        })
        .attr('stroke-width', d => {
            if (d.source.type === 'root') return 2;
            if (d.target.type === 'startup') return 0.5;
            return 1.5;
        });
    
    // Render nodes
    const nodeEl = g.append('g').selectAll('g').data(nodes).enter().append('g')
        .attr('class', d => `node ${d.type}`)
        .style('cursor', 'pointer');
    
    // Node circles for root, industry, startup only (no subindustry/cluster circles)
    nodeEl.filter(d => d.type !== 'subindustry' && d.type !== 'cluster')
        .append('circle')
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => getNodeFill(d))
        .attr('stroke', d => getNodeStroke(d))
        .attr('stroke-width', d => d.type === 'root' ? 3 : d.type === 'startup' ? 1 : 2)
        .style('filter', d => {
            if (d.type === 'root') return 'drop-shadow(0 0 20px rgba(88,166,255,0.5))';
            if (d.type === 'industry') return `drop-shadow(0 0 10px ${d.color}60)`;
            return 'none';
        });
    
    // Labels for root
    nodeEl.filter(d => d.type === 'root').append('text')
        .attr('dy', 50).attr('text-anchor', 'middle')
        .attr('fill', '#e6edf3').style('font-size', '14px').style('font-weight', '800')
        .text('YC W26');
    
    // Labels for industry
    nodeEl.filter(d => d.type === 'industry').append('text')
        .attr('dy', d => getNodeRadius(d) + 16).attr('text-anchor', 'middle')
        .attr('class', 'cat-label').text(d => d.name);
    
    // Labels for subindustry/cluster (no circle - label only)
    nodeEl.filter(d => d.type === 'subindustry' || d.type === 'cluster').append('text')
        .attr('dy', 5).attr('text-anchor', 'middle')
        .attr('class', 'sub-label')
        .attr('fill', d => d.color)
        .style('font-weight', '600')
        .text(d => truncateLabel(d.name, 18));
    
    // Icons for startups: show letter immediately, swap in logo once cached
    nodeEl.filter(d => d.type === 'startup').each(function(d) {
        const el = d3.select(this);
        el.append('text')
            .attr('class', 'startup-letter')
            .attr('dy', 3).attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .style('font-size', '6px').style('font-weight', '700')
            .text(d.name ? d.name.charAt(0).toUpperCase() : '?');
    });
    lazyLoadStartupIcons(nodeEl.filter(d => d.type === 'startup'));
    
    nodeEl.on('click', (e, d) => {
        e.stopPropagation();
        handleNodeClick(e, d);
    });
    nodeEl.filter(d => d.type !== 'startup').call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.15).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
    
    // Z-order: sort nodes so smaller ones render on top
    const typeOrder = { startup: 4, cluster: 3, subindustry: 2, industry: 1, root: 0 };
    nodeEl.sort((a, b) => (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0));
    
    // Update positions on tick
    sim.on('tick', () => {
        linkEl.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
              .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        nodeEl.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Draw hulls after simulation settles
    sim.on('end', () => {
        setTimeout(() => drawHulls(hullsG, nodes), 100);
    });
    
    // Store reference
    window._graph = { svg, g, sim, nodeEl, linkEl, nodes, links, zoomBehavior, hullsG };
    applyVisitedVisuals();
    applyStarredVisuals();
}

function collectVisibleNodes() {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    
    function traverse(node, parentId, parentType) {
        // Add this node
        const nodeData = {
            ...node,
            children: node.children // Keep reference for expansion check
        };
        nodes.push(nodeData);
        nodeMap.set(node.id, nodeData);
        
        // Add link from parent
        if (parentId) {
            links.push({ source: parentId, target: node.id });
        }
        
        // If this node is expanded, show its children
        if (expandedClusters.has(node.id) && node.children && node.children.length > 0) {
            node.children.forEach(child => traverse(child, node.id, node.type));
        } else if (expandedClusters.has(node.id) && (!node.children || node.children.length === 0)) {
            // Leaf cluster node - show its companies as startup nodes
            node.companies.forEach(company => {
                const startupNode = {
                    ...company,
                    id: `n-${company.id}`,
                    nodeId: `n-${company.id}`,
                    type: 'startup',
                    depth: node.depth + 1,
                    color: node.color,
                    parent: node
                };
                nodes.push(startupNode);
                // Add link to position startup around its parent
                links.push({ source: node.id, target: startupNode.id });
            });
        }
    }
    
    traverse(clusterTree, null, null);
    return { nodes, links };
}

function handleNodeClick(e, d) {
    e.stopPropagation();
    
    if (d.type === 'startup') {
        const raw = d.id.replace('n-', '');
        const cid = isNaN(raw) ? raw : Number(raw);
        if (typeof compareMode !== 'undefined' && compareMode) {
            addToCompare(cid);
        } else {
            selectCompanyById(cid);
        }
        return;
    }
    
    if (d.type === 'root') return;
    highlightCluster(d.id);
}

function getNodeRadius(d) {
    if (d.type === 'root') return 32;
    if (d.type === 'industry') {
        const count = d.companies.length;
        return Math.max(18, Math.min(28, 12 + count * 0.15));
    }
    if (d.type === 'subindustry') {
        const count = d.companies.length;
        return Math.max(12, Math.min(20, 8 + count * 0.2));
    }
    if (d.type === 'cluster') {
        const count = d.companies.length;
        return Math.max(8, Math.min(16, 6 + count * 0.25));
    }
    return 5; // startup
}

function getNodeFill(d) {
    if (d.type === 'root') return '#1e293b';
    if (d.type === 'startup') return d.color || '#64748b';
    // For clusters, show fill based on expansion state
    if (expandedClusters.has(d.id)) {
        return d.color + '30'; // Lighter when expanded
    }
    return d.color + '80'; // Solid when collapsed (shows company count)
}

function getNodeStroke(d) {
    if (d.type === 'root') return '#58a6ff';
    if (d.type === 'startup') return 'rgba(0,0,0,0.3)';
    return d.color;
}

function drawHulls(hullsG, nodes) {
    hullsG.selectAll('*').remove();
    
    // Draw hulls around expanded clusters that have visible startup children
    const expandedNodes = nodes.filter(n => 
        expandedClusters.has(n.id) && 
        n.type !== 'root' && 
        n.type !== 'startup'
    );
    
    expandedNodes.forEach(clusterNode => {
        // Find all startup nodes that belong to this cluster
        const clusterStartups = nodes.filter(n => 
            n.type === 'startup' && 
            n.parent && 
            n.parent.id === clusterNode.id
        );
        
        if (clusterStartups.length < 3) return;
        
        const points = clusterStartups.map(n => [n.x, n.y]);
        const hull = d3.polygonHull(points);
        if (!hull) return;
        
        const centroid = d3.polygonCentroid(hull);
        const expanded = hull.map(p => {
            const dx = p[0] - centroid[0];
            const dy = p[1] - centroid[1];
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            return [p[0] + (dx / dist) * 20, p[1] + (dy / dist) * 20];
        });
        
        const pathD = smoothPolygon(expanded);
        
        hullsG.append('path')
            .attr('class', 'graph-hull')
            .attr('d', pathD)
            .attr('fill', clusterNode.color)
            .attr('stroke', clusterNode.color)
            .attr('fill-opacity', 0.08)
            .attr('stroke-opacity', 0.3)
            .attr('stroke-width', 1.5)
            .style('opacity', 0)
            .transition()
            .duration(300)
            .style('opacity', 1);
    });
}

function truncateLabel(text, maxLen) {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen - 2) + '..' : text;
}

function smoothPolygon(points) {
    if (points.length < 3) return '';
    return d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveCardinalClosed.tension(0.7))(points);
}

function computeSimilarityVariance(companies) {
    if (companies.length < 2 || !isSimilarityReady()) return 0;
    
    const similarities = [];
    const sampleSize = Math.min(companies.length, 15);
    for (let i = 0; i < sampleSize; i++) {
        for (let j = i + 1; j < sampleSize; j++) {
            const sim = getSimilarity(companies[i].id, companies[j].id);
            if (sim > 0) similarities.push(sim);
        }
    }
    
    if (similarities.length < 3) return 0;
    
    const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const variance = similarities.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / similarities.length;
    return Math.sqrt(variance);
}

function clusterBySimilarity(companies, numClusters = 3) {
    if (!isSimilarityReady() || companies.length < numClusters) {
        return [companies];
    }
    
    const ids = companies.map(c => c.id);
    const clusters = [];
    const assigned = new Set();
    
    // Initialize with most dissimilar companies as centroids
    const centroids = [];
    for (let i = 0; i < numClusters && centroids.length < companies.length; i++) {
        let bestId = null;
        let maxMinDist = -1;
        
        ids.forEach(id => {
            if (assigned.has(id)) return;
            let minDist = centroids.length === 0 ? 100 : Infinity;
            centroids.forEach(cid => {
                const sim = getSimilarity(id, cid);
                const dist = 100 - sim;
                if (dist < minDist) minDist = dist;
            });
            if (minDist > maxMinDist) {
                maxMinDist = minDist;
                bestId = id;
            }
        });
        
        if (bestId) {
            centroids.push(bestId);
            assigned.add(bestId);
        }
    }
    
    centroids.forEach((cid, idx) => {
        clusters[idx] = [companies.find(c => c.id === cid)];
    });
    
    ids.forEach(id => {
        if (assigned.has(id)) return;
        let bestCluster = 0;
        let maxSim = -1;
        centroids.forEach((cid, idx) => {
            const sim = getSimilarity(id, cid);
            if (sim > maxSim) {
                maxSim = sim;
                bestCluster = idx;
            }
        });
        clusters[bestCluster].push(companies.find(c => c.id === id));
        assigned.add(id);
    });
    
    return clusters.filter(c => c && c.length > 0);
}

// Public API functions
function highlightGraphNode(id) {
    if (!window._graph) return;
    const { nodeEl } = window._graph;
    nodeEl.select('circle')
        .attr('stroke-width', d => {
            const nodeId = d.nodeId || d.id;
            if (nodeId === id || nodeId === `n-${id}`) return 4;
            return d.type === 'root' ? 3 : d.type === 'startup' ? 1 : 2;
        });
}

function unhighlightGraph() {
    if (!window._graph) return;
    const { nodeEl } = window._graph;
    nodeEl.select('circle')
        .attr('stroke-width', d => d.type === 'root' ? 3 : d.type === 'startup' ? 1 : 2);
}

function applyVisitedVisuals() {
    if (!window._graph) return;
    window._graph.nodeEl.classed('visited-node', d => {
        if (d.type !== 'startup') return false;
        const companyId = d.id.replace('n-', '');
        return visitedSet.has(companyId);
    });
}

function applyStarredVisuals() {
    if (!window._graph) return;
    window._graph.nodeEl.classed('starred-node', d => {
        if (d.type !== 'startup') return false;
        const companyId = d.id.replace('n-', '');
        return starredSet.has(companyId);
    });
}

function updateListHighlight() {
    document.querySelectorAll('.company-row').forEach(r => {
        const idx = parseInt(r.dataset.idx);
        r.classList.toggle('active-row', idx === currentIndex);
        const c = filteredList[idx];
        if (c) r.classList.toggle('visited-row', visitedSet.has(c.id));
    });
}

// Highlight a cluster - dim other nodes, don't re-render
let activeHighlight = null;

function highlightCluster(clusterId) {
    if (!window._graph) return;
    const { nodeEl, linkEl, nodes } = window._graph;
    
    // Toggle off if same cluster clicked again
    if (activeHighlight === clusterId) {
        clearHighlight();
        return;
    }
    
    activeHighlight = clusterId;
    
    // Find the cluster node
    const clusterNode = nodes.find(n => n.id === clusterId);
    if (!clusterNode) { clearHighlight(); return; }
    
    // Collect ALL visible node IDs that belong to this cluster (including descendants)
    const visibleIds = new Set();
    visibleIds.add(clusterId);
    
    // Add parent chain (root, industry)
    let p = clusterNode.parent;
    while (p) { visibleIds.add(p.id); p = p.parent; }
    
    // Add all child cluster nodes and startup nodes recursively
    function addDescendants(nodeId) {
        nodes.forEach(n => {
            if (n.parent && n.parent.id === nodeId) {
                visibleIds.add(n.id);
                addDescendants(n.id);
            }
        });
    }
    addDescendants(clusterId);
    
    // Also add startups from this cluster's companies
    if (clusterNode.companies) {
        clusterNode.companies.forEach(c => visibleIds.add(`n-${c.id}`));
    }
    
    // Apply dim/highlight classes
    nodeEl.classed('dimmed', d => !visibleIds.has(d.id));
    nodeEl.classed('highlighted', d => d.id === clusterId);
    linkEl.classed('dimmed', d => {
        const sid = typeof d.source === 'object' ? d.source.id : d.source;
        const tid = typeof d.target === 'object' ? d.target.id : d.target;
        return !visibleIds.has(sid) || !visibleIds.has(tid);
    });
}

function clearHighlight() {
    activeHighlight = null;
    if (window._graph) {
        window._graph.nodeEl.classed('dimmed', false).classed('highlighted', false);
        window._graph.linkEl.classed('dimmed', false);
    }
}

// Filter graph to show only specific industry/subindustry - NO re-render, just dim
function expandToIndustry(industryName) {
    if (!industryName) {
        clearHighlight();
        return;
    }
    highlightCluster(`ind-${industryName}`);
}

function expandToSubIndustry(industryName, subName) {
    highlightCluster(`sub-${industryName}-${subName}`);
}

// Progressive icon loader: loads logos in small batches to avoid flooding the network
const _logoCache = new Map();
function lazyLoadStartupIcons(startupSelection) {
    const BATCH = 20;
    const DELAY = 80;
    const pending = [];

    startupSelection.each(function(d) {
        if (d.logo) pending.push({ el: this, d });
    });

    function loadBatch(start) {
        if (start >= pending.length) return;
        const slice = pending.slice(start, start + BATCH);
        slice.forEach(({ el, d }) => {
            if (_logoCache.get(d.logo) === 'fail') return;
            if (_logoCache.get(d.logo) === 'ok') {
                swapIcon(el, d);
                return;
            }
            const img = new Image();
            img.onload = () => {
                _logoCache.set(d.logo, 'ok');
                swapIcon(el, d);
            };
            img.onerror = () => { _logoCache.set(d.logo, 'fail'); };
            img.src = d.logo;
        });
        setTimeout(() => loadBatch(start + BATCH), DELAY);
    }

    function swapIcon(el, d) {
        const g = d3.select(el);
        g.select('.startup-letter').remove();
        g.append('image')
            .attr('href', d.logo)
            .attr('x', -5).attr('y', -5)
            .attr('width', 10).attr('height', 10)
            .attr('clip-path', 'circle(5px)')
            .style('opacity', 0)
            .transition().duration(200)
            .style('opacity', 1);
    }

    loadBatch(0);
}
