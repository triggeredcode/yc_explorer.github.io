// ══════════════════════════════════════════
//  AI CO-RESEARCHER CHAT
// ══════════════════════════════════════════

let _pendingOpenChat = false;
let _currentAITab = 'prompts';

// ── Prompt definitions ──
const PROMPTS = {
    'find-gap': 'What startup ideas or market gaps are NOT represented in this YC W26 batch? What problems are being overlooked? List at least 5 specific ideas with reasoning.',
    'roast-idea': 'I have an idea: [DESCRIBE YOUR IDEA HERE]. How does it compare to companies in this batch? Who are the closest competitors? What are the risks and how would I differentiate?',
    'build-thesis': 'What are the 5 strongest emerging themes across this batch? Which sub-industries are overrepresented vs underrepresented? Where would a contrarian bet make sense?',
    'who-to-talk': 'I\'m working on: [DESCRIBE YOUR PROJECT HERE]. Which 5-10 companies in this batch would be the best to talk to as partners, competitors to study, or adjacent plays? Explain why for each.',
    'whats-missing': null // built dynamically
};

function getWhatsNearPrompt() {
    if (currentIndex >= 0 && filteredList[currentIndex]) {
        const c = filteredList[currentIndex];
        return `Company "${c.name}" does: ${c.description}. Industry: ${c.industry} > ${c.subLabel}. Tags: ${(c.tags || []).join(', ')}.\n\nWhat adjacent problems in this space is nobody in the batch solving? What's missing near this company?`;
    }
    return 'Looking at the overall batch, what areas have surprisingly few companies? What gaps exist in the least crowded sub-industries?';
}

// ── Settings ──
function loadAISettings() {
    aiProvider = localStorage.getItem('yc-ai-provider') || 'openai';
    aiApiKey = localStorage.getItem('yc-ai-key') || '';
    const providerSelect = document.getElementById('ai-provider-select');
    const apiKeyInput = document.getElementById('ai-api-key-input');
    if (providerSelect) providerSelect.value = aiProvider;
    if (apiKeyInput) apiKeyInput.value = aiApiKey;
}

function saveAISettings() {
    const providerSelect = document.getElementById('ai-provider-select');
    const apiKeyInput = document.getElementById('ai-api-key-input');
    if (providerSelect) aiProvider = providerSelect.value;
    if (apiKeyInput) aiApiKey = apiKeyInput.value;
    localStorage.setItem('yc-ai-provider', aiProvider);
    localStorage.setItem('yc-ai-key', aiApiKey);
    closeSettingsDrawer();
    showToast('AI settings saved');
    updateChatKeyState();
    if (_pendingOpenChat && aiApiKey) {
        _pendingOpenChat = false;
        switchAITab('chat');
    }
}

function openSettingsDrawer() {
    loadAISettings();
    document.getElementById('settings-drawer').classList.add('show');
}

function closeSettingsDrawer() {
    document.getElementById('settings-drawer').classList.remove('show');
}

function testAIConnection() {
    const keyInput = document.getElementById('ai-api-key-input');
    const providerSelect = document.getElementById('ai-provider-select');
    const key = keyInput ? keyInput.value : '';
    const provider = providerSelect ? providerSelect.value : 'openai';
    if (!key) { showToast('Please enter an API key'); return; }
    if (provider === 'openai' && !key.startsWith('sk-')) { showToast('OpenAI keys start with sk-'); return; }
    if (provider === 'gemini' && key.length < 20) { showToast('Gemini key looks too short'); return; }
    showToast('Key format looks valid');
}

// ── Tab switching ──
function switchAITab(tab) {
    _currentAITab = tab;
    document.getElementById('ai-prompts-view').classList.toggle('hidden', tab !== 'prompts');
    document.getElementById('ai-chat-view').classList.toggle('hidden', tab !== 'chat');
    document.getElementById('ai-tab-prompts').classList.toggle('ai-tab-active', tab === 'prompts');
    document.getElementById('ai-tab-chat').classList.toggle('ai-tab-active', tab === 'chat');
    if (tab === 'chat') {
        updateChatKeyState();
        renderWelcomeIfEmpty();
    }
}

function updateChatKeyState() {
    const noKey = document.getElementById('ai-chat-no-key');
    if (noKey) noKey.classList.toggle('hidden', !!aiApiKey);
}

// ── System prompt builder ──
function buildSystemPrompt() {
    const MAX_COMPANIES_IN_PROMPT = 400;
    let prompt = `You are an AI co-researcher analyzing Y Combinator Winter 2026 batch. There are ${rawCompanies.length} companies total.\n\n`;

    const industryMap = {};
    rawCompanies.forEach(c => {
        if (!industryMap[c.industry]) industryMap[c.industry] = {};
        if (!industryMap[c.industry][c.subLabel]) industryMap[c.industry][c.subLabel] = [];
        industryMap[c.industry][c.subLabel].push(c);
    });

    prompt += `## Companies (sample of up to ${MAX_COMPANIES_IN_PROMPT}):\n\n`;
    let count = 0;
    for (const ind of Object.keys(industryMap).sort()) {
        if (count >= MAX_COMPANIES_IN_PROMPT) break;
        prompt += `### ${ind}\n`;
        for (const sub of Object.keys(industryMap[ind]).sort()) {
            if (count >= MAX_COMPANIES_IN_PROMPT) break;
            const companies = industryMap[ind][sub];
            prompt += `${sub} (${companies.length}): `;
            const entries = [];
            for (const c of companies) {
                if (count >= MAX_COMPANIES_IN_PROMPT) break;
                entries.push(c.name + (c.description ? ` - ${c.description}` : ''));
                count++;
            }
            prompt += entries.join('; ') + '\n';
        }
    }
    if (count < rawCompanies.length) {
        prompt += `\n(Showing ${count} of ${rawCompanies.length}. Ask for specific industries to see more.)\n`;
    }

    const subMap = {};
    rawCompanies.forEach(c => {
        const key = c.industry + '||' + c.subLabel;
        if (!subMap[key]) subMap[key] = { industry: c.industry, sub: c.subLabel, count: 0 };
        subMap[key].count++;
    });
    const nicheSubs = Object.values(subMap).filter(s => s.count <= 5);
    prompt += `\n## Stats:\n`;
    prompt += `- ${Object.keys(industryMap).length} industries, ${Object.keys(subMap).length} sub-industries\n`;
    prompt += `- ${nicheSubs.length} sub-industries with ≤5 companies (whitespace opportunities)\n`;
    prompt += `- ${rawCompanies.filter(c => c.isHiring).length} companies hiring\n`;

    if (starredSet.size > 0) {
        prompt += `\n## User's Starred:\n`;
        starredSet.forEach(id => {
            const c = rawCompanies.find(x => x.id === id);
            if (c) prompt += `- ${c.name} (${c.industry} > ${c.subLabel})\n`;
        });
    }
    if (Object.keys(notesMap).length > 0) {
        prompt += `\n## User's Notes:\n`;
        Object.entries(notesMap).forEach(([id, note]) => {
            // notesMap keys are strings from localStorage; company IDs may be numbers
            const numId = Number(id);
            const c = rawCompanies.find(x => x.id === numId || x.id === id);
            if (c) prompt += `- ${c.name}: ${note}\n`;
        });
    }
    if (activeIndustry || activeSubIndustry || Object.values(activeFilters).some(v => v)) {
        prompt += `\n## Current Filter:\n`;
        if (activeIndustry) prompt += `- Industry: ${activeIndustry}\n`;
        if (activeSubIndustry) prompt += `- Sub-industry: ${activeSubIndustry}\n`;
        if (activeFilters.starred) prompt += `- Showing starred only\n`;
        if (activeFilters.unvisited) prompt += `- Showing unvisited only\n`;
        if (activeFilters.hiring) prompt += `- Showing hiring only\n`;
    }
    if (currentIndex >= 0 && filteredList[currentIndex]) {
        const c = filteredList[currentIndex];
        prompt += `\n## Selected Company:\n`;
        prompt += `- ${c.name} (${c.industry} > ${c.subLabel})\n`;
        prompt += `- ${c.description || 'No description'}\n`;
        if (c.longDescription) prompt += `- Detail: ${c.longDescription.substring(0, 300)}\n`;
        if (c.tags && c.tags.length) prompt += `- Tags: ${c.tags.join(', ')}\n`;
    }

    prompt += `\nProvide concise, actionable insights. Use markdown formatting. Focus on gaps, patterns, and opportunities.`;
    return prompt;
}

// ── Copy prompt for external AI ──
function copyBatchContext() {
    const context = buildSystemPrompt();
    navigator.clipboard.writeText(context);
    showToast(`Batch context copied (~${Math.round(context.length / 4)} tokens)`);
}

function copyPromptForExternal(promptType) {
    const context = buildSystemPrompt();
    const userPrompt = promptType === 'whats-missing' ? getWhatsNearPrompt() : PROMPTS[promptType];
    const full = context + '\n\n---\n\nUser question:\n' + userPrompt;
    navigator.clipboard.writeText(full);
    showToast('Full prompt copied — paste into any AI');
}

function copyFilteredDataPlusPrompt() {
    if (!filteredList.length) { showToast('No companies in current filter'); return; }
    const selected = getSelectedFields();
    if (selected.size === 0) { showToast('Select at least one field in Export settings'); return; }
    const textarea = document.getElementById('custom-prompt-input');
    const userQuestion = textarea ? textarea.value.trim() : '';
    const data = filteredList.map(cleanCompanyForExport);
    let block = `Here is data on ${data.length} YC W26 companies (filtered from ${rawCompanies.length} total):\n\n`;
    block += '```json\n' + JSON.stringify(data, null, 1) + '\n```\n\n';
    if (userQuestion) {
        block += `Question: ${userQuestion}`;
    } else {
        block += 'Analyze these companies. What patterns, gaps, and opportunities do you see?';
    }
    navigator.clipboard.writeText(block).then(() => {
        showToast(`Copied ${data.length} companies + prompt`);
    });
}

function copyCustomPromptForExternal() {
    const textarea = document.getElementById('custom-prompt-input');
    const text = textarea ? textarea.value.trim() : '';
    if (!text) { showToast('Type a question first'); return; }
    const context = buildSystemPrompt();
    const full = context + '\n\n---\n\nUser question:\n' + text;
    navigator.clipboard.writeText(full);
    showToast('Full prompt copied — paste into any AI');
}

// ── Chat interface ──
function openAIChat() {
    document.getElementById('ai-chat-panel').classList.add('show');
    updateContextTokenEst();
    updateWhatsNearContext();
}

function closeAIChat() {
    document.getElementById('ai-chat-panel').classList.remove('show');
}

function updateContextTokenEst() {
    const el = document.getElementById('context-token-est');
    if (el && rawCompanies.length) {
        const est = buildSystemPrompt().length / 4;
        el.textContent = `(~${Math.round(est / 1000)}k tokens)`;
    }
}

function updateWhatsNearContext() {
    const el = document.getElementById('prompt-missing-context');
    if (el) {
        if (currentIndex >= 0 && filteredList[currentIndex]) {
            el.textContent = `Near: ${filteredList[currentIndex].name}`;
        } else {
            el.textContent = 'Gap analysis around selected company';
        }
    }
}

function renderWelcomeIfEmpty() {
    const body = document.getElementById('ai-chat-body');
    if (body && body.children.length === 0) {
        body.innerHTML = `
            <div class="text-center py-8 px-4">
                <i class="fa-solid fa-brain text-3xl text-blue-500/30 mb-3"></i>
                <p class="text-sm text-slate-400 mb-1">Ask anything about the YC W26 batch</p>
                <p class="text-[10px] text-slate-600 leading-relaxed">The AI has context on all ${rawCompanies.length} companies, your starred items, notes, and current filters.</p>
                ${!aiApiKey ? '<p class="text-[10px] text-blue-400 mt-3">Add your API key in <strong>settings</strong> to start chatting, or use the <strong>Prompts</strong> tab to copy for external AI.</p>' : ''}
            </div>
        `;
    }
}

function sendMessage(text) {
    if (!text.trim()) return;
    if (!aiApiKey) {
        showToast('Add API key in settings first');
        openSettingsDrawer();
        _pendingOpenChat = true;
        return;
    }

    // Clear welcome
    const body = document.getElementById('ai-chat-body');
    if (body && body.querySelector('.text-center')) body.innerHTML = '';

    renderMessage('user', text);
    showAILoading();

    const systemPrompt = buildSystemPrompt();
    const messages = [
        { role: 'system', content: systemPrompt },
        ...aiChatHistory.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: text }
    ];

    aiChatHistory.push({ role: 'user', content: text });
    streamResponse(messages);
}

function sendFromPromptCard(promptType) {
    const text = promptType === 'whats-missing' ? getWhatsNearPrompt() : PROMPTS[promptType];
    switchAITab('chat');
    setTimeout(() => sendMessage(text), 100);
}

function sendCustomPrompt() {
    const textarea = document.getElementById('custom-prompt-input');
    const text = textarea ? textarea.value.trim() : '';
    if (!text) { showToast('Type a question first'); return; }
    switchAITab('chat');
    setTimeout(() => sendMessage(text), 100);
}

function showAILoading() {
    const body = document.getElementById('ai-chat-body');
    const loader = document.createElement('div');
    loader.id = 'ai-loading-indicator';
    loader.className = 'ai-message';
    loader.innerHTML = '<span class="text-slate-500 text-xs">Thinking...</span>';
    body.appendChild(loader);
    loader.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function removeAILoading() {
    const loader = document.getElementById('ai-loading-indicator');
    if (loader) loader.remove();
}

// ── Simple markdown to HTML ──
function renderMarkdown(text) {
    let html = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        // Code blocks (``` ... ```)
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Blockquote
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // Unordered list items
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Numbered list items
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
    // Paragraphs for remaining text blocks
    html = html.replace(/\n\n/g, '</p><p>');
    if (!html.startsWith('<')) html = '<p>' + html + '</p>';

    return html;
}

function streamResponse(messages) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-message';
    messageDiv.innerHTML = '<div class="ai-message-content"></div><div class="ai-message-actions"></div>';

    removeAILoading();
    document.getElementById('ai-chat-body').appendChild(messageDiv);

    const contentDiv = messageDiv.querySelector('.ai-message-content');
    const actionsDiv = messageDiv.querySelector('.ai-message-actions');

    if (aiProvider === 'openai') {
        streamOpenAI(messages, contentDiv, actionsDiv, messageDiv);
    } else if (aiProvider === 'gemini') {
        streamGemini(messages, contentDiv, actionsDiv, messageDiv);
    }
}

function onStreamDone(contentDiv, actionsDiv, fullResponse) {
    aiChatHistory.push({ role: 'assistant', content: fullResponse });
    contentDiv.innerHTML = renderMarkdown(fullResponse);
    addMessageActions(actionsDiv, fullResponse);
}

function streamOpenAI(messages, contentDiv, actionsDiv, messageDiv) {
    let fullResponse = '';

    fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, stream: true, temperature: 0.7 })
    })
    .then(response => {
        if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function readChunk() {
            reader.read().then(({ done, value }) => {
                if (done) { onStreamDone(contentDiv, actionsDiv, fullResponse); return; }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') return;
                    try {
                        const data = JSON.parse(trimmed.slice(6));
                        const delta = data.choices?.[0]?.delta?.content;
                        if (delta) {
                            fullResponse += delta;
                            contentDiv.textContent = fullResponse;
                            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }
                    } catch (e) {}
                });
                readChunk();
            });
        }
        readChunk();
    })
    .catch(err => {
        removeAILoading();
        contentDiv.textContent = `Error: ${err.message}`;
        showToast('AI request failed');
    });
}

function streamGemini(messages, contentDiv, actionsDiv, messageDiv) {
    let fullResponse = '';
    const geminiMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));
    const systemText = messages.find(m => m.role === 'system')?.content || '';

    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:streamGenerateContent?key=${aiApiKey}&alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: geminiMessages,
            systemInstruction: { parts: [{ text: systemText }] },
            generationConfig: { temperature: 0.7 }
        })
    })
    .then(response => {
        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function readChunk() {
            reader.read().then(({ done, value }) => {
                if (done) { onStreamDone(contentDiv, actionsDiv, fullResponse); return; }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) return;
                    try {
                        const data = JSON.parse(trimmed.slice(6));
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            fullResponse += text;
                            contentDiv.textContent = fullResponse;
                            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }
                    } catch (e) {}
                });
                readChunk();
            });
        }
        readChunk();
    })
    .catch(err => {
        removeAILoading();
        contentDiv.textContent = `Error: ${err.message}`;
        showToast('AI request failed');
    });
}

function renderMessage(role, content) {
    const div = document.createElement('div');
    div.className = role === 'user' ? 'user-message' : 'ai-message';
    div.textContent = content;
    document.getElementById('ai-chat-body').appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function addMessageActions(actionsDiv, content) {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'share-btn';
    shareBtn.innerHTML = '<i class="fa-solid fa-share"></i> Share';
    shareBtn.onclick = () => shareInsight(content);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'share-btn';
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
    copyBtn.onclick = () => { navigator.clipboard.writeText(content); showToast('Copied'); };

    actionsDiv.appendChild(shareBtn);
    actionsDiv.appendChild(copyBtn);
}

function clearChat() {
    aiChatHistory = [];
    document.getElementById('ai-chat-body').innerHTML = '';
    renderWelcomeIfEmpty();
}

function updatePromptExportCount() {
    const el = document.getElementById('prompt-export-count');
    if (el) el.textContent = filteredList.length;
}

function shareInsight(messageContent) {
    const insight = messageContent.substring(0, 200).trim();
    const tweet = `${insight}...\n\nBuilt with YC W26 Explorer`;
    navigator.clipboard.writeText(tweet);
    showToast('Insight copied to clipboard');
}
