// views/scripts/weekly-business.js (V5.2 - Side Panel Editor & Final Polish)

let currentWeekData = null; 
let allWeeksSummary = [];

/**
 * 載入並渲染週間業務的主頁面
 */
async function loadWeeklyBusinessPage() {
    // 【Bug 修復】檢查是否存在從儀表板跳轉過來的 weekId 參數
    const targetWeekId = sessionStorage.getItem('navigateToWeekId');
    if (targetWeekId) {
        sessionStorage.removeItem('navigateToWeekId'); // 用完後立即清除，避免影響正常導航
        await navigateToWeeklyDetail(targetWeekId);
        return; // 終止函式，直接顯示詳細頁面
    }

    // 如果沒有 targetWeekId，則正常載入列表頁
    const container = document.getElementById('page-weekly-business');
    if (!container) return;
    container.innerHTML = `<div class="loading show"><div class="spinner"></div><p>載入週次列表中...</p></div>`;

    try {
        const result = await authedFetch(`/api/business/weekly/summary`);
        if (!result.success) throw new Error(result.error);
        
        allWeeksSummary = result.data || [];
        renderWeekListPage();
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            container.innerHTML = `<div class="alert alert-error">載入週次列表失敗: ${error.message}</div>`;
        }
    }
}

/**
 * 渲染週次列表的畫面
 */
function renderWeekListPage() {
    const container = document.getElementById('page-weekly-business');
    
    const today = new Date();
    const currentMonth = today.toLocaleString('zh-TW', { month: 'long' });
    const weekOfMonth = Math.ceil(today.getDate() / 7);
    const todayInfo = `<p class="current-date-info">今天是：${today.toLocaleDateString('zh-TW')}，${currentMonth}第 ${weekOfMonth} 週</p>`;

    let html = `
        <div class="dashboard-widget">
            <div class="widget-header">
                <div>
                    <h2 class="widget-title">週間業務總覽</h2>
                    ${todayInfo}
                </div>
                <button class="action-btn primary" onclick="showAddWeekModal()">＋ 編輯/新增週次紀錄</button>
            </div>
            <div class="widget-content">
    `;

    const currentWeekId = getWeekIdForDate(new Date());

    if (allWeeksSummary.length === 0) {
        html += '<div class="alert alert-info" style="text-align:center;">尚無任何業務週報，請點擊右上角新增</div>';
    } else {
        html += '<div class="week-list">';
        allWeeksSummary.forEach(week => {
            const isCurrent = week.id === currentWeekId;
            const currentWeekLabel = isCurrent ? '<span class="current-week-label">(本週)</span>' : '';
            
            html += `
                <div class="week-list-item ${isCurrent ? 'current-week' : ''}" onclick="navigateToWeeklyDetail('${week.id}')">
                    <div class="week-info">
                        <div class="week-title">${week.title} ${currentWeekLabel}</div>
                        <div class="week-daterange">${week.dateRange}</div>
                    </div>
                    <div class="week-entry-count">${week.summaryCount} 筆摘要</div>
                    <div class="week-arrow">›</div>
                </div>
            `;
        });
        html += '</div>';
    }

    html += '</div></div>';
    container.innerHTML = html;

    if (!document.getElementById('weekly-business-styles')) {
        const style = document.createElement('style');
        style.id = 'weekly-business-styles';
        style.innerHTML = `
            .current-date-info { color: var(--text-primary); margin-top: 5px; font-size: 1.1rem; font-weight: 600; }
            .week-list-item { display: flex; align-items: center; padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background-color 0.2s ease; border-left: 4px solid transparent; }
            .week-list-item:hover { background-color: var(--glass-bg); }
            .week-list-item.current-week { border-left-color: var(--accent-green); background-color: rgba(34, 197, 94, 0.05); }
            .week-info { flex: 1; }
            .week-title { font-weight: 600; }
            .current-week-label { color: var(--accent-green); font-size: 0.85em; font-weight: 700; margin-left: 8px; }
            .week-daterange { color: var(--text-muted); font-size: 0.9rem; margin-top: 4px; }
            .week-entry-count { font-size: 0.9rem; background: var(--primary-bg); padding: 4px 10px; border-radius: 1rem; }
            .week-arrow { font-size: 1.5rem; color: var(--text-muted); margin-left: 1rem; }
        `;
        document.head.appendChild(style);
    }
}

/**
 * 導航到指定週次的詳細頁面
 */
async function navigateToWeeklyDetail(weekId) {
    const container = document.getElementById('page-weekly-business');
    container.innerHTML = `<div class="loading show"><div class="spinner"></div><p>載入 ${weekId} 的週報詳情中...</p></div>`;

    try {
        const result = await authedFetch(`/api/business/weekly/details/${weekId}`);
        currentWeekData = result.data;
        renderWeeklyDetailView();
    } catch (error) {
       if (error.message !== 'Unauthorized') {
            container.innerHTML = `<div class="alert alert-error">載入週報詳情失敗: ${error.message}</div>`;
        }
    }
}

/**
 * 渲染週間業務的詳細/編輯模式畫面 (格子視圖)
 */
function renderWeeklyDetailView() {
    const container = document.getElementById('page-weekly-business');
    
    const pageTitle = (systemConfig['頁面標題']?.find(item => item.value === '週間業務標題')?.note) || '週間業務重點摘要';
    const themes = systemConfig['週間業務主題'] || [{value: 'IoT', note: 'IoT'}, {value: 'DT', note: 'DT'}];
    
    const daysData = {};
    currentWeekData.days.forEach(day => {
        daysData[day.dayIndex] = {};
        themes.forEach(theme => {
            daysData[day.dayIndex][theme.value] = currentWeekData.entries.filter(e => e.day == day.dayIndex && e.category === theme.value);
        });
    });
    
    let newWeekNotice = currentWeekData.entries.length === 0 ? `<div class="alert alert-info">這是新的空白週報，請點擊下方的「+ 新增紀錄」按鈕來建立第一筆內容。</div>` : '';

    const prevWeekId = getAdjacentWeekId(currentWeekData.id, -1);
    const nextWeekId = getAdjacentWeekId(currentWeekData.id, 1);

    let html = `
        <div class="dashboard-widget">
            <div class="widget-header">
                <div>
                    <h2 class="widget-title">${pageTitle}</h2>
                    <p style="color: var(--text-secondary); margin-top: 5px; font-size: 1.2rem; font-weight: 600;">${currentWeekData.title} ${currentWeekData.dateRange}</p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="action-btn secondary" onclick="navigateToWeeklyDetail('${prevWeekId}')">< 上一週</button>
                    <button class="action-btn secondary" onclick="loadWeeklyBusinessPage()">返回總覽</button>
                    <button class="action-btn secondary" onclick="navigateToWeeklyDetail('${nextWeekId}')">下一週 ></button>
                </div>
            </div>
            <div class="widget-content">
                ${newWeekNotice}
                <div class="weekly-detail-grid">
                    <div class="grid-header"></div>
                    ${themes.map(theme => `<div class="grid-header">${theme.note}</div>`).join('')}
                    
                    ${currentWeekData.days.map(dayInfo => `
                        <div class="grid-day-label">${['週一', '週二', '週三', '週四', '週五'][dayInfo.dayIndex - 1]}<br><span style="font-size: 0.8rem; color: var(--text-muted);">(${dayInfo.displayDate})</span></div>
                        ${themes.map(theme => `
                            <div class="grid-cell" id="cell-${dayInfo.dayIndex}-${theme.value}">
                                ${renderCellContent(daysData[dayInfo.dayIndex][theme.value], dayInfo, theme)}
                            </div>
                        `).join('')}
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    
    if (!document.getElementById('weekly-detail-styles')) {
        const style = document.createElement('style');
        style.id = 'weekly-detail-styles';
        style.innerHTML = `
            .weekly-detail-grid { display: grid; grid-template-columns: 100px repeat(${themes.length}, 1fr); gap: 8px; }
            .grid-header, .grid-day-label { padding: 10px; font-weight: 600; text-align: center; background-color: var(--primary-bg); border-radius: 8px; line-height: 1.4; }
            .grid-cell { background-color: var(--primary-bg); border-radius: 8px; padding: 10px; min-height: 120px; display: flex; flex-direction: column; gap: 8px; }
            .entry-card-read { position: relative; background: var(--secondary-bg); padding: 8px; border-radius: 4px; border-left: 3px solid var(--accent-blue); }
            .entry-card-read.category-iot { border-left-color: var(--accent-blue); }
            .entry-card-read.category-dt { border-left-color: var(--accent-purple); }
            .entry-card-read .edit-btn { position: absolute; top: 5px; right: 5px; display: none; padding: 2px 6px; }
            .entry-card-read:hover .edit-btn { display: block; }
            .entry-card-topic { font-weight: 600; font-size: 0.9rem; }
            .entry-card-participants { font-size: 0.8rem; color: var(--text-muted); }
            .entry-card-summary { font-size: 0.85rem; white-space: pre-wrap; margin-top: 5px; color: var(--text-secondary); }
            .add-entry-btn { background: transparent; border: 1px dashed var(--border-color); color: var(--text-muted); width: 100%; padding: 8px; border-radius: 4px; cursor: pointer; transition: all 0.2s ease; margin-top: auto; }
            .add-entry-btn:hover { background: var(--glass-bg); color: var(--text-primary); }
            .participants-checkbox-group { display: flex; flex-direction: column; gap: 5px; max-height: 120px; overflow-y: auto; background: var(--primary-bg); padding: 8px; border-radius: 4px; }
        `;
        document.head.appendChild(style);
    }
}

function renderCellContent(entries, dayInfo, theme) {
    let contentHtml = entries.map(entry => {
        const entryJsonString = JSON.stringify(entry).replace(/'/g, "&apos;");
        const categoryClass = entry['分類'] ? `category-${entry['分類'].toLowerCase()}` : '';
        return `
            <div class="entry-card-read ${categoryClass}" id="entry-${entry.recordId}">
                <button class="action-btn small warn edit-btn" onclick='openWeeklyBusinessEditorPanel(${JSON.stringify(dayInfo)}, ${JSON.stringify(theme)}, ${entryJsonString})'>✏️</button>
                <div class="entry-card-topic">${entry['主題']}</div>
                <div class="entry-card-participants">👤 ${entry['參與人員']}</div>
                ${entry['重點摘要'] ? `<div class="entry-card-summary">${entry['重點摘要']}</div>` : ''}
            </div>
        `;
    }).join('');
    contentHtml += `<button class="add-entry-btn" onclick='openWeeklyBusinessEditorPanel(${JSON.stringify(dayInfo)}, ${JSON.stringify(theme)}, null)'>+ 新增紀錄</button>`;
    return contentHtml;
}

function openWeeklyBusinessEditorPanel(dayInfo, theme, entry) {
    const isNew = !entry;
    const panelContainer = document.getElementById('slide-out-panel-container');
    const backdrop = document.getElementById('panel-backdrop');

    let participantsCheckboxes = '';
    const selectedParticipants = isNew ? new Set() : new Set((entry['參與人員'] || '').split(',').map(p => p.trim()));

    if (systemConfig['團隊成員']) {
        systemConfig['團隊成員'].forEach(member => {
            const checked = selectedParticipants.has(member.note) ? 'checked' : '';
            participantsCheckboxes += `
                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                    <input type="checkbox" name="participants" value="${member.note}" ${checked}>
                    ${member.note}
                </label>
            `;
        });
    }

    const panelHTML = `
        <div class="slide-out-panel" id="weekly-business-editor-panel">
            <div class="panel-header">
                <h2 class="panel-title">${isNew ? '新增' : '編輯'}紀錄</h2>
                <button class="close-btn" onclick="closeWeeklyBusinessEditorPanel()">&times;</button>
            </div>
            <div class="panel-content">
                <form id="wb-panel-form">
                    <p style="background:var(--primary-bg); padding: 8px; border-radius: 4px; margin-bottom: 1rem;">
                        <strong>日期:</strong> ${dayInfo.date} (${theme.note})
                    </p>
                    <input type="hidden" name="recordId" value="${isNew ? '' : entry.recordId}">
                    <input type="hidden" name="rowIndex" value="${isNew ? '' : entry.rowIndex}">
                    <input type="hidden" name="date" value="${dayInfo.date}">
                    <input type="hidden" name="category" value="${theme.value}">
                    <div class="form-group">
                        <label class="form-label">主題 *</label>
                        <input type="text" name="topic" class="form-input" required value="${isNew ? '' : entry['主題']}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">參與人員</label>
                        <div class="participants-checkbox-group">${participantsCheckboxes}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">重點摘要</label>
                        <textarea name="summary" class="form-textarea" rows="5">${isNew ? '' : entry['重點摘要']}</textarea>
                    </div>
                     <div class="form-group">
                        <label class="form-label">待辦事項</label>
                        <textarea name="actionItems" class="form-textarea" rows="3">${isNew ? '' : entry['待辦事項']}</textarea>
                    </div>
                    <div class="btn-group">
                         ${!isNew ? `<button type="button" class="action-btn danger" style="margin-right: auto;" onclick="confirmDeleteWeeklyBusinessEntry('${entry.recordId}', '${entry.rowIndex}', '${(entry['主題'] || '').replace(/'/g, "\\'")}')">刪除</button>` : ''}
                        <button type="button" class="action-btn secondary" onclick="closeWeeklyBusinessEditorPanel()">取消</button>
                        <button type="submit" class="submit-btn">儲存</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    panelContainer.innerHTML = panelHTML;

    document.getElementById('wb-panel-form').addEventListener('submit', handleSaveWeeklyEntry);
    
    requestAnimationFrame(() => {
        backdrop.classList.add('is-open');
        document.getElementById('weekly-business-editor-panel').classList.add('is-open');
    });
    backdrop.onclick = closeWeeklyBusinessEditorPanel;
}

function closeWeeklyBusinessEditorPanel() {
    const panel = document.getElementById('weekly-business-editor-panel');
    const backdrop = document.getElementById('panel-backdrop');
    if (panel) panel.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
}

async function handleSaveWeeklyEntry(event) {
    event.preventDefault();
    const form = event.target;
    
    const recordId = form.querySelector('[name="recordId"]').value;
    const isNew = !recordId;
    
    const selectedParticipants = Array.from(form.querySelectorAll('[name="participants"]:checked')).map(cb => cb.value);

    const entryData = {
        date: form.querySelector('[name="date"]').value,
        category: form.querySelector('[name="category"]').value,
        topic: form.querySelector('[name="topic"]').value,
        participants: selectedParticipants.join(','),
        summary: form.querySelector('[name="summary"]').value,
        actionItems: form.querySelector('[name="actionItems"]').value,
        rowIndex: form.querySelector('[name="rowIndex"]').value 
    };

    if (!entryData.topic) {
        showNotification('主題為必填項目', 'warning');
        return;
    }
    
    showLoading('正在儲存...');
    try {
        const url = isNew ? '/api/business/weekly' : `/api/business/weekly/${recordId}`;
        const method = isNew ? 'POST' : 'PUT';
        const result = await authedFetch(url, { method, body: JSON.stringify(entryData) });
        if (!result.success) throw new Error(result.error);
        
        const [y, m, d] = entryData.date.split('-').map(Number);
        const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

        const newEntryForState = {
            '日期': entryData.date,
            'Week ID': getWeekIdForDate(new Date(entryData.date)),
            '分類': entryData.category,
            '主題': entryData.topic,
            '參與人員': entryData.participants,
            '重點摘要': entryData.summary,
            '待辦事項': entryData.actionItems,
            '建立者': isNew ? getCurrentUser() : (currentWeekData.entries.find(e=>e.recordId === recordId)?.['建立者'] || getCurrentUser()),
            '紀錄ID': isNew ? result.data.recordId : recordId,
            'rowIndex': isNew ? result.data.rowIndex : entryData.rowIndex,
            'day': dayOfWeek
        };
        
        if (isNew) {
            currentWeekData.entries.push(newEntryForState);
        } else {
            const index = currentWeekData.entries.findIndex(e => e.recordId === recordId);
            if (index !== -1) currentWeekData.entries[index] = { ...currentWeekData.entries[index], ...newEntryForState };
        }
        
        closeWeeklyBusinessEditorPanel();
        renderWeeklyDetailView();
        showNotification('儲存成功！', 'success');

        authedFetch(`/api/business/weekly/summary`).then(res => { allWeeksSummary = res.data || []; });

    } catch (error) {
        if (error.message !== 'Unauthorized') showNotification(`儲存失敗: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// ==================== 輔助函式 ====================
function getWeekIdForDate(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

function getAdjacentWeekId(currentWeekId, direction) {
    const [year, week] = currentWeekId.split('-W').map(Number);
    const d = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    d.setUTCDate(d.getUTCDate() + (7 * direction));
    return getWeekIdForDate(d);
}

function confirmDeleteWeeklyBusinessEntry(recordId, rowIndex, topic) {
    const message = `您確定要永久刪除這筆業務紀錄嗎？\n\n主題：${topic}`;
    showConfirmDialog(message, async () => {
        showLoading('正在刪除...');
        try {
            const result = await authedFetch(`/api/business/weekly/${recordId}`, { 
                method: 'DELETE',
                body: JSON.stringify({ rowIndex: rowIndex })
            });

            if (result.success) {
                currentWeekData.entries = currentWeekData.entries.filter(e => e.recordId != recordId);
                closeWeeklyBusinessEditorPanel();
                renderWeeklyDetailView();
                showNotification('紀錄已刪除', 'success');
            } else {
                throw new Error(result.details || '刪除失敗');
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') showNotification(`刪除失敗: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });
}

function showAddWeekModal() {
    const today = new Date();
    const prevWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const currentWeekId = getWeekIdForDate(today);

    const weekOptions = [
        { id: getWeekIdForDate(prevWeek), label: '上一週' },
        { id: currentWeekId, label: '本週' },
        { id: getWeekIdForDate(nextWeek), label: '下一週' }
    ];
    
    const existingWeekIds = new Set(allWeeksSummary.map(w => w.id));

    let optionsHtml = '';
    weekOptions.forEach(opt => {
        const disabled = existingWeekIds.has(opt.id);
        const selected = opt.id === currentWeekId ? 'selected' : '';
        optionsHtml += `<option value="${opt.id}" ${disabled ? 'disabled' : ''} ${selected}>${opt.label} ${disabled ? '(已有紀錄)' : ''}</option>`;
    });

    const modalContainer = document.getElementById('modal-container');
    const existingModal = document.getElementById('add-week-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="add-week-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2 class="modal-title">選擇週次</h2>
                    <button class="close-btn" onclick="document.getElementById('add-week-modal').remove()">&times;</button>
                </div>
                <div class="form-group">
                    <label class="form-label">請選擇要編輯或新增紀錄的週次：</label>
                    <div class="select-wrapper">
                        <select id="add-week-select" class="form-select">${optionsHtml}</select>
                    </div>
                </div>
                <button class="submit-btn" onclick="confirmAddWeek()">前往</button>
            </div>
        </div>
    `;
    modalContainer.insertAdjacentHTML('beforeend', modalHtml);
}

function confirmAddWeek() {
    const select = document.getElementById('add-week-select');
    const selectedWeekId = select.value;
    if (selectedWeekId) {
        const modal = document.getElementById('add-week-modal');
        if(modal) modal.remove();
        navigateToWeeklyDetail(selectedWeekId);
    }
}