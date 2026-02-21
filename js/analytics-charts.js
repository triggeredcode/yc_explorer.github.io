// ══════════════════════════════════════════
//  ANALYTICS CHARTS - D3 Visualizations
// ══════════════════════════════════════════

function renderAnalyticsCharts() {
    const grid = document.querySelector('.analytics-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Industry x Subindustry Heatmap
    renderHeatmap(grid);
    
    // Team Size Distribution
    renderTeamSizeChart(grid);
    
    // Hiring Trends
    renderHiringChart(grid);
    
    // Tag Co-occurrence
    renderTagChart(grid);
    
    // Geographic Distribution
    renderLocationChart(grid);
    
    // Similarity Clusters
    renderClusterChart(grid);
}

function renderHeatmap(container) {
    const panel = document.createElement('div');
    panel.className = 'analytics-panel';
    panel.style.gridColumn = '1 / -1'; // Full width
    
    const title = document.createElement('div');
    title.className = 'analytics-panel-title';
    title.textContent = 'Industry × Subindustry Matrix';
    
    const chartContainer = document.createElement('div');
    chartContainer.className = 'analytics-chart-container';
    chartContainer.style.height = '400px';
    
    panel.appendChild(title);
    panel.appendChild(chartContainer);
    container.appendChild(panel);
    
    const matrix = getQueryResult('industrySubindustryMatrix');
    const industries = Object.keys(matrix).sort();
    const subindustries = new Set();
    industries.forEach(ind => {
        Object.keys(matrix[ind]).forEach(sub => subindustries.add(sub));
    });
    const subList = Array.from(subindustries).sort();
    
    const margin = { top: 80, right: 20, bottom: 100, left: 150 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const xScale = d3.scaleBand()
        .domain(subList)
        .range([0, width])
        .padding(0.05);
    
    const yScale = d3.scaleBand()
        .domain(industries)
        .range([0, height])
        .padding(0.05);
    
    const maxCount = Math.max(...industries.map(ind => 
        Math.max(...Object.values(matrix[ind] || {}))
    ));
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, maxCount]);
    
    g.selectAll('.cell')
        .data(industries.flatMap(ind => 
            subList.map(sub => ({
                industry: ind,
                subindustry: sub,
                count: matrix[ind]?.[sub] || 0
            }))
        ))
        .enter()
        .append('rect')
        .attr('class', 'heatmap-cell')
        .attr('x', d => xScale(d.subindustry))
        .attr('y', d => yScale(d.industry))
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .attr('fill', d => d.count > 0 ? colorScale(d.count) : 'rgba(255,255,255,0.02)')
        .attr('stroke', 'rgba(255,255,255,0.1)')
        .style('cursor', d => d.count > 0 ? 'pointer' : 'default')
        .on('click', (e, d) => {
            if (d.count > 0) {
                drillIndustry(d.industry);
                drillSubIndustry(d.industry, d.subindustry);
                switchView('graph');
            }
        })
        .append('title')
        .text(d => `${d.industry} × ${d.subindustry}: ${d.count} companies`);
    
    // X axis
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
        .style('font-size', '9px')
        .style('fill', '#8b949e');
    
    // Y axis
    g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', '10px')
        .style('fill', '#c9d1d9');
}

function renderTeamSizeChart(container) {
    const panel = document.createElement('div');
    panel.className = 'analytics-panel';
    
    const title = document.createElement('div');
    title.className = 'analytics-panel-title';
    title.textContent = 'Team Size Distribution';
    
    const chartContainer = document.createElement('div');
    chartContainer.className = 'analytics-chart-container';
    
    panel.appendChild(title);
    panel.appendChild(chartContainer);
    container.appendChild(panel);
    
    const data = getQueryResult('teamSizeDistribution');
    const mean = rawCompanies.reduce((sum, c) => sum + (c.teamSize || 0), 0) / rawCompanies.length;
    const sorted = data.sort((a, b) => {
        const order = ['Unknown', '1-2', '3-5', '6-10', '11-20', '21+'];
        return order.indexOf(a.bucket) - order.indexOf(b.bucket);
    });
    
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const xScale = d3.scaleBand()
        .domain(sorted.map(d => d.bucket))
        .range([0, width])
        .padding(0.2);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(sorted, d => d.count)])
        .nice()
        .range([height, 0]);
    
    g.selectAll('.bar')
        .data(sorted)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.bucket))
        .attr('y', d => yScale(d.count))
        .attr('width', xScale.bandwidth())
        .attr('height', d => height - yScale(d.count))
        .attr('fill', '#58a6ff')
        .attr('opacity', 0.8);
    
    g.selectAll('.bar-label')
        .data(sorted)
        .enter()
        .append('text')
        .attr('x', d => xScale(d.bucket) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.count) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#e6edf3')
        .text(d => d.count);
    
    g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', '10px')
        .style('fill', '#8b949e');
    
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-size', '10px')
        .style('fill', '#8b949e');
    
    title.innerHTML += ` <span style="font-size: 10px; color: #8b949e; font-weight: normal;">(Mean: ${mean.toFixed(1)})</span>`;
}

function renderHiringChart(container) {
    const panel = document.createElement('div');
    panel.className = 'analytics-panel';
    
    const title = document.createElement('div');
    title.className = 'analytics-panel-title';
    title.textContent = 'Hiring by Industry';
    
    const chartContainer = document.createElement('div');
    chartContainer.className = 'analytics-chart-container';
    
    panel.appendChild(title);
    panel.appendChild(chartContainer);
    container.appendChild(panel);
    
    const data = getQueryResult('hiringByIndustry').slice(0, 10);
    
    const margin = { top: 20, right: 40, bottom: 60, left: 80 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const xScale = d3.scaleBand()
        .domain(data.map(d => d.industry))
        .range([0, width])
        .padding(0.2);
    
    const yScale = d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0]);
    
    g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.industry))
        .attr('y', d => yScale(d.pct))
        .attr('width', xScale.bandwidth())
        .attr('height', d => height - yScale(d.pct))
        .attr('fill', '#3fb950')
        .attr('opacity', 0.8)
        .on('click', (e, d) => {
            drillIndustry(d.industry);
            switchView('graph');
        })
        .style('cursor', 'pointer');
    
    g.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('x', d => xScale(d.industry) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.pct) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#e6edf3')
        .text(d => `${d.pct}%`);
    
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(d => d + '%'))
        .selectAll('text')
        .style('font-size', '10px')
        .style('fill', '#8b949e');
    
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
        .style('font-size', '9px')
        .style('fill', '#8b949e');
}

function renderTagChart(container) {
    const panel = document.createElement('div');
    panel.className = 'analytics-panel';
    
    const title = document.createElement('div');
    title.className = 'analytics-panel-title';
    title.textContent = 'Top Tags';
    
    const chartContainer = document.createElement('div');
    chartContainer.className = 'analytics-chart-container';
    chartContainer.style.height = '400px';
    chartContainer.style.overflowY = 'auto';
    
    panel.appendChild(title);
    panel.appendChild(chartContainer);
    container.appendChild(panel);
    
    const tagCounts = {};
    rawCompanies.forEach(c => {
        (c.tags || []).forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });
    
    const data = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    
    const margin = { top: 20, right: 20, bottom: 20, left: 100 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const barHeight = 20;
    const height = data.length * (barHeight + 5);
    
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', Math.max(height, 300) + margin.top + margin.bottom);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .range([0, width]);
    
    const yScale = d3.scaleBand()
        .domain(data.map(d => d.tag))
        .range([0, height])
        .padding(0.1);
    
    g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', d => yScale(d.tag))
        .attr('width', d => xScale(d.count))
        .attr('height', yScale.bandwidth())
        .attr('fill', '#a371f7')
        .attr('opacity', 0.8);
    
    g.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('x', d => xScale(d.count) + 5)
        .attr('y', d => yScale(d.tag) + yScale.bandwidth() / 2)
        .attr('dy', '0.35em')
        .style('font-size', '10px')
        .style('fill', '#e6edf3')
        .text(d => d.count);
    
    g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', '10px')
        .style('fill', '#c9d1d9');
}

function renderLocationChart(container) {
    const panel = document.createElement('div');
    panel.className = 'analytics-panel';
    
    const title = document.createElement('div');
    title.className = 'analytics-panel-title';
    title.textContent = 'Top Locations';
    
    const chartContainer = document.createElement('div');
    chartContainer.className = 'analytics-chart-container';
    
    panel.appendChild(title);
    panel.appendChild(chartContainer);
    container.appendChild(panel);
    
    const data = getQueryResult('locationBreakdown');
    
    const margin = { top: 20, right: 20, bottom: 60, left: 100 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const barHeight = 20;
    const height = Math.min(data.length * (barHeight + 5), 300);
    
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .range([0, width]);
    
    const yScale = d3.scaleBand()
        .domain(data.map(d => d.location))
        .range([0, height])
        .padding(0.1);
    
    g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', d => yScale(d.location))
        .attr('width', d => xScale(d.count))
        .attr('height', yScale.bandwidth())
        .attr('fill', '#ffa657')
        .attr('opacity', 0.8);
    
    g.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('x', d => xScale(d.count) + 5)
        .attr('y', d => yScale(d.location) + yScale.bandwidth() / 2)
        .attr('dy', '0.35em')
        .style('font-size', '10px')
        .style('fill', '#e6edf3')
        .text(d => d.count);
    
    g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', '10px')
        .style('fill', '#c9d1d9');
}

function renderClusterChart(container) {
    const panel = document.createElement('div');
    panel.className = 'analytics-panel';
    
    const title = document.createElement('div');
    title.className = 'analytics-panel-title';
    title.textContent = 'Similarity Clusters';
    
    const chartContainer = document.createElement('div');
    chartContainer.className = 'analytics-chart-container';
    chartContainer.style.height = '400px';
    chartContainer.style.overflowY = 'auto';
    
    panel.appendChild(title);
    panel.appendChild(chartContainer);
    container.appendChild(panel);
    
    if (!isSimilarityReady()) {
        chartContainer.innerHTML = '<div class="text-center py-20 text-slate-500">Similarity data not available</div>';
        return;
    }
    
    const clusters = getQueryResult('clusterAnalysis', 25);
    
    const list = document.createElement('div');
    list.style.padding = '8px';
    
    clusters.forEach(cl => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.03); border-radius: 6px; cursor: pointer; transition: background 0.15s;';
        item.onmouseover = () => item.style.background = 'rgba(255,255,255,0.06)';
        item.onmouseout = () => item.style.background = 'rgba(255,255,255,0.03)';
        item.onclick = () => {
            // Filter to cluster companies using proper filter function
            const ids = new Set(cl.companies);
            clearAllFilters();
            applyClusterFilter(ids, cl.label);
            switchView('graph');
        };
        
        const label = cl.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        item.innerHTML = `
            <div style="font-weight: 600; color: #e6edf3; margin-bottom: 4px;">${label}</div>
            <div style="font-size: 11px; color: #8b949e;">${cl.size} companies</div>
        `;
        
        list.appendChild(item);
    });
    
    chartContainer.appendChild(list);
}
