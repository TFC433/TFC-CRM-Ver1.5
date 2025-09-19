// views/scripts/opportunities.js
// 職責：管理「機會案件列表頁」的圖表、篩選、列表渲染與操作

// ==================== 全域變數 (此頁面專用) ====================
let opportunitiesData = [];
let currentOpportunityPage = 1;

// ==================== 主要功能函式 (分頁渲染) ====================

async function loadOpportunities(page = 1, query = '', filters = {}) {
    currentOpportunityPage = page;
    const container = document.getElementById('page-opportunities');
    if (!container) return;

    // 渲染頁面骨架與篩選器
    container.innerHTML = `
        <div id="opportunities-dashboard-container" class="dashboard-grid-flexible" style="margin-bottom: 24px;">
            <div class="loading show" style="grid-column: span 12;"><div class="spinner"></div></div>
        </div>
        <div class="dashboard-widget">
            <div class="widget-header">
                <h2 class="widget-title">機會案件列表</h2>
            </div>
            
            <div class="filters-container" style="padding: 0 1.5rem 1rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
                <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                    <div class="select-wrapper">
                        <select id="opp-filter-assignee" class="form-select"><option value="">所有業務</option></select>
                    </div>
                </div>
                <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                    <div class="select-wrapper">
                        <select id="opp-filter-type" class="form-select"><option value="">所有種類</option></select>
                    </div>
                </div>
                <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                    <div class="select-wrapper">
                        <select id="opp-filter-stage" class="form-select"><option value="">所有階段</option></select>
                    </div>
                </div>
                <button class="action-btn primary" onclick="applyOpportunityFilters()">🔍 篩選</button>
                <button class="action-btn secondary" onclick="resetOpportunityFilters()">🔄 重設</button>
            </div>

            <div class="search-pagination" style="padding: 0 1.5rem; margin-bottom: 1rem;">
                <input type="text" class="search-box" id="opportunities-page-search" placeholder="依名稱/公司搜尋..." onkeyup="searchOpportunitiesEvent(event)" value="${query}">
                <div class="pagination" id="opportunities-page-pagination"></div>
            </div>
            <div id="opportunities-page-content" class="widget-content">
                <div class="loading show"><div class="spinner"></div><p>載入機會資料中...</p></div>
            </div>
        </div>
    `;
    
    populateOpportunityFilters();
    // 復原篩選器的值
    if (filters.assignee) document.getElementById('opp-filter-assignee').value = filters.assignee;
    if (filters.type) document.getElementById('opp-filter-type').value = filters.type;
    if (filters.stage) document.getElementById('opp-filter-stage').value = filters.stage;

    document.getElementById('opportunities-page-search').addEventListener('keyup', searchOpportunitiesEvent);

    const queryParams = new URLSearchParams({
        page: page,
        q: query
    });
    if (filters.assignee) queryParams.append('assignee', filters.assignee);
    if (filters.type) queryParams.append('type', filters.type);
    if (filters.stage) queryParams.append('stage', filters.stage);
    const listApiUrl = `/api/opportunities?${queryParams.toString()}`;

    try {
        const [dashboardResult, listResult] = await Promise.all([
            authedFetch(`/api/opportunities/dashboard`),
            authedFetch(listApiUrl) 
        ]);

        if (dashboardResult.success) {
            renderOpportunityCharts(dashboardResult.data.chartData);
        } else {
            document.getElementById('opportunities-dashboard-container').innerHTML = `<div class="alert alert-error" style="grid-column: span 12;">圖表資料載入失敗</div>`;
        }
        
        opportunitiesData = listResult.data || [];
        document.getElementById('opportunities-page-content').innerHTML = renderOpportunitiesTable(opportunitiesData);
        renderPagination('opportunities-page-pagination', listResult.pagination, 'loadOpportunities', filters);

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('❌ 載入機會案件頁面失敗:', error);
            document.getElementById('opportunities-dashboard-container').innerHTML = '';
            document.getElementById('opportunities-page-content').innerHTML = `<div class="alert alert-error">載入機會案件失敗: ${error.message}</div>`;
        }
    }
}

function searchOpportunitiesEvent(event) {
    if (!event || event.type !== 'keyup' || event.key === 'Enter') {
        applyOpportunityFilters();
    }
}

async function loadFollowUpPage() {
    const container = document.getElementById('page-follow-up');
    if (!container) return;

    container.innerHTML = '<div class="loading show"><div class="spinner"></div><p>載入待追蹤清單中...</p></div>';
    
    try {
        const result = await authedFetch('/api/dashboard');
        const followUps = result.data.followUpList || [];
        
        if (followUps.length === 0) {
            container.innerHTML = '<div class="alert alert-success">🎉 目前沒有需要Follow-up的機會！</div>';
        } else {
            let html = `<div class="alert alert-warning">⚠️ 以下機會超過7天未聯繫，建議盡快跟進：</div>
            <table class="data-table"><thead><tr><th>機會名稱</th><th>客戶公司</th><th>負責業務</th><th>最後更新</th><th>操作</th></tr></thead><tbody>`;
            followUps.forEach(opp => {
                html += `<tr>
                    <td data-label="機會名稱">${opp.opportunityName}</td>
                    <td data-label="客戶公司">${opp.customerCompany}</td>
                    <td data-label="負責業務">${opp.assignee}</td>
                    <td data-label="最後更新">${formatDateTime(opp.lastUpdateTime || opp.createdTime)}</td>
                    <td data-label="操作"><button class="action-btn small" onclick="navigateTo('opportunity-details', { opportunityId: '${opp.opportunityId}' })">📋 詳情</button></td>
                </tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('❌ 載入待追蹤清單失敗:', error);
            container.innerHTML = '<div class="alert alert-error">載入待追蹤清單失敗</div>';
        }
    }
}

// ==================== 圖表渲染函式 ====================
function renderOpportunityCharts(chartData) {
    const container = document.getElementById('opportunities-dashboard-container');
    container.innerHTML = `
        <div class="dashboard-widget grid-col-3">
            <div class="widget-header"><h2 class="widget-title">機會趨勢 (近30天)</h2></div>
            <div id="opp-trend-chart" class="widget-content" style="height: 250px;"></div>
        </div>
        <div class="dashboard-widget grid-col-3">
            <div class="widget-header"><h2 class="widget-title">機會來源分佈</h2></div>
            <div id="opp-source-chart" class="widget-content" style="height: 250px;"></div>
        </div>
        <div class="dashboard-widget grid-col-3">
            <div class="widget-header"><h2 class="widget-title">機會種類分佈</h2></div>
            <div id="opp-type-chart" class="widget-content" style="height: 250px;"></div>
        </div>
        <div class="dashboard-widget grid-col-3">
            <div class="widget-header"><h2 class="widget-title">機會階段分佈</h2></div>
            <div id="opp-stage-chart" class="widget-content" style="height: 250px;"></div>
        </div>
    `;

    setTimeout(() => {
        if (Highcharts) {
            renderOppTrendChart(chartData.trend);
            renderOppSourceChart(chartData.source);
            renderOppTypeChart(chartData.type);
            renderOppStageChart(chartData.stage);
        }
    }, 0);
}

function renderOppTrendChart(data) {
    Highcharts.chart('opp-trend-chart', {
        ...getHighchartsThemeOptions(),
        chart: { type: 'line', ...getHighchartsThemeOptions().chart },
        title: { text: '' },
        xAxis: { categories: data.map(d => d[0].substring(5)) },
        yAxis: { title: { text: '數量' } },
        legend: { enabled: false },
        series: [{ name: '機會數', data: data.map(d => d[1]), color: getHighchartsThemeOptions().colors[0] }]
    });
}

function renderOppSourceChart(data) {
    const themeOptions = getHighchartsThemeOptions();
    Highcharts.chart('opp-source-chart', {
        ...themeOptions,
        chart: { type: 'pie', ...themeOptions.chart },
        title: { text: '' },
        tooltip: { pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b> ({point.y} 件)' },
        plotOptions: { pie: { allowPointSelect: true, cursor: 'pointer', dataLabels: { enabled: true, format: '<b>{point.name}</b>: {point.percentage:.1f} %', distance: 20, connectorColor: themeOptions.textColors.secondary, style: { color: themeOptions.textColors.secondary, textOutline: 'none' } }, showInLegend: false } },
        series: [{ name: '來源', data: data }]
    });
}

function renderOppTypeChart(data) {
    const themeOptions = getHighchartsThemeOptions();
    Highcharts.chart('opp-type-chart', {
        ...themeOptions,
        chart: { type: 'pie', ...themeOptions.chart },
        title: { text: '' },
        tooltip: { pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b> ({point.y} 件)' },
        plotOptions: { pie: { allowPointSelect: true, cursor: 'pointer', dataLabels: { enabled: true, format: '<b>{point.name}</b>: {point.percentage:.1f} %', distance: 20, connectorColor: themeOptions.textColors.secondary, style: { color: themeOptions.textColors.secondary, textOutline: 'none' } }, showInLegend: false } },
        series: [{ name: '種類', data: data }]
    });
}

function renderOppStageChart(data) {
    Highcharts.chart('opp-stage-chart', {
        ...getHighchartsThemeOptions(),
        chart: { type: 'bar', ...getHighchartsThemeOptions().chart },
        title: { text: '' },
        xAxis: { categories: data.map(d => d[0]), title: { text: null } },
        yAxis: { min: 0, title: { text: '案件數量', align: 'high' } },
        legend: { enabled: false },
        series: [{ name: '數量', data: data.map(d => d[1]), color: getHighchartsThemeOptions().colors[1] }]
    });
}

// ==================== 列表頁渲染與操作 ====================

function renderOpportunitiesTable(opportunities) {
    if (!opportunities || opportunities.length === 0) { return '<div class="alert alert-info" style="text-align:center;">暫無機會案件資料</div>'; }
    let html = `<table class="data-table"><thead><tr><th>機會名稱</th><th>客戶公司</th><th>負責業務</th><th>目前階段</th><th>操作</th></tr></thead><tbody>`;
    
    const stageNotes = new Map((systemConfig['機會階段'] || []).map(s => [s.value, s.note]));

    opportunities.forEach(opp => {
        const stageDisplayName = stageNotes.get(opp.currentStage) || opp.currentStage;
        const companyName = opp.customerCompany;
        const encodedCompanyName = encodeURIComponent(companyName);
        const companyCell = companyName 
            ? `<td data-label="客戶公司"><a href="#" class="text-link" onclick="event.preventDefault(); navigateTo('company-details', { companyName: '${encodedCompanyName}' })">${companyName}</a></td>`
            : `<td data-label="客戶公司">-</td>`;

        html += `
            <tr>
                <td data-label="機會名稱">
                    <a href="#" class="text-link" onclick="event.preventDefault(); navigateTo('opportunity-details', { opportunityId: '${opp.opportunityId}' })">
                        <strong>${opp.opportunityName}</strong>
                    </a>
                </td>
                ${companyCell}
                <td data-label="負責業務">${opp.assignee}</td>
                <td data-label="目前階段">${stageDisplayName}</td>
                <td data-label="操作">
                    <div class="action-buttons-container">
                        <button class="action-btn small info" onclick="navigateTo('opportunity-details', { opportunityId: '${opp.opportunityId}' })">📋 詳情</button>
                        <button class="action-btn small" onclick="showEventLogModalByOpp('${opp.opportunityId}')">📝 事件</button>
                        <button class="action-btn small warn" onclick="editOpportunity('${opp.opportunityId}')">✏️ 編輯</button>
                        <button class="action-btn small danger" onclick="confirmDeleteOpportunity(${opp.rowIndex}, '${opp.opportunityName.replace(/'/g, "\\'")}')">🗑️ 刪除</button>
                        <button class="action-btn small secondary" onclick="quickCreateMeeting('${opp.opportunityId}')">📅 會議</button>
                    </div>
                </td>
            </tr>`;
    });
    html += '</tbody></table>';
    return html;
}

function populateOpportunityFilters() {
    populateSelect('opp-filter-assignee', systemConfig['團隊成員']);
    populateSelect('opp-filter-type', systemConfig['機會種類']);
    populateSelect('opp-filter-stage', systemConfig['機會階段']);
}

function applyOpportunityFilters() {
    const query = document.getElementById('opportunities-page-search').value;
    const filters = {
        assignee: document.getElementById('opp-filter-assignee').value,
        type: document.getElementById('opp-filter-type').value,
        stage: document.getElementById('opp-filter-stage').value,
    };
    loadOpportunities(1, query, filters);
}

function resetOpportunityFilters() {
    document.getElementById('opportunities-page-search').value = '';
    document.getElementById('opp-filter-assignee').value = '';
    document.getElementById('opp-filter-type').value = '';
    document.getElementById('opp-filter-stage').value = '';
    loadOpportunities(1, '', {});
}

// 【修改】將 confirmArchiveOpportunity 整個函式替換為 confirmDeleteOpportunity
async function confirmDeleteOpportunity(rowIndex, opportunityName) {
    const message = `您確定要永久刪除機會案件 "${opportunityName}" 嗎？\n此操作無法復原！`;
    
    showConfirmDialog(message, async () => {
        showLoading('正在刪除...');
        try {
            // 【修改】API 路由和請求方法
            const result = await authedFetch(`/api/opportunities/${rowIndex}`, {
                method: 'DELETE'
            });
            
            if (result.success) {
                showNotification('機會案件已成功刪除', 'success');
                pageConfig.opportunities.loaded = false;
                await navigateTo('opportunities');
            } else {
                throw new Error(result.details || '刪除操作失敗');
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                showNotification(`刪除失敗: ${error.message}`, 'error');
            }
        } finally {
            hideLoading();
        }
    });
}

function quickCreateMeeting(opportunityId) {
    showNewMeetingModal().then(() => {
        const select = document.getElementById('meeting-opportunity');
        for (let option of select.options) {
            if (option.value && option.value !== 'manual') {
                try {
                    const data = JSON.parse(option.value);
                    if (data.opportunityId === opportunityId) {
                        select.value = option.value;
                        updateMeetingInfo();
                        break;
                    }
                } catch (e) { continue; }
            }
        }
    });
}

// ==================== 儀表板拖曳功能 ====================
function initializeKanbanDragAndDrop() {
    const kanbanBoard = document.getElementById('kanban-board');
    if (!kanbanBoard) return;
    kanbanBoard.removeEventListener('dragover', handleDragOver);
    kanbanBoard.removeEventListener('drop', handleDrop);
    kanbanBoard.addEventListener('dragover', handleDragOver);
    kanbanBoard.addEventListener('drop', handleDrop);
}

function handleDragOver(event) {
    event.preventDefault();
}

function handleDrop(event) {
    event.preventDefault();
    const opportunityId = event.dataTransfer.getData("text/plain");
    const targetColumn = event.target.closest('.kanban-column');

    if (targetColumn && opportunityId) {
        const newStageId = targetColumn.dataset.stageId;
        handleOpportunityStageChange(opportunityId, newStageId);
    }
}

async function handleOpportunityStageChange(opportunityId, newStageId) {
    let opportunity;
    let oldStageId;

    for (const stageId in kanbanRawData) {
        const foundOpp = kanbanRawData[stageId].opportunities.find(o => o.opportunityId === opportunityId);
        if (foundOpp) {
            opportunity = foundOpp;
            oldStageId = stageId;
            break;
        }
    }

    if (!opportunity || oldStageId === newStageId) {
        return; 
    }

    showLoading('正在更新階段...');
    try {
        const updateResult = await authedFetch(`/api/opportunities/${opportunity.rowIndex}`, {
            method: 'PUT',
            body: JSON.stringify({ currentStage: newStageId, modifier: getCurrentUser() })
        });

        if (updateResult.success) {
            // 前端手動更新看板資料，避免重新請求 API
            const oldStageOpportunities = kanbanRawData[oldStageId].opportunities;
            const oppIndex = oldStageOpportunities.findIndex(o => o.opportunityId === opportunityId);
            if (oppIndex > -1) {
                oldStageOpportunities.splice(oppIndex, 1);
            }
            
            opportunity.currentStage = newStageId;
            kanbanRawData[newStageId].opportunities.unshift(opportunity);
            
            filterAndRenderKanban(); // 重新渲染看板

            showNotification(`機會 "${opportunity.opportunityName}" 已更新階段`, 'success');
        } else {
            throw new Error(updateResult.details || '更新失敗');
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('❌ 拖曳更新階段失敗:', error);
            showNotification('更新階段失敗，將還原操作', 'error');
            filterAndRenderKanban(); // 失敗時也重新渲染以還原外觀
        }
    } finally {
        hideLoading();
    }
}