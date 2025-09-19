// views/scripts/events.js (重構為分頁儀表板模式)

// 全域變數，用於儲存頁面數據和模板
let eventLogPageData = {};
let eventFormTemplate = '';

// ==================== 主流程與視圖管理 ====================

/**
 * 載入並渲染事件紀錄頁面 (主入口函式)
 */
async function loadEventLogsPage() {
    // 預載入 HTML 模板
    await preloadEventTemplates();
    
    // 檢查是否有待辦動作 (例如從其他頁面跳轉過來新增事件)
    const pendingAction = sessionStorage.getItem('pendingAction');
    if (pendingAction === 'createEventLog') {
        sessionStorage.removeItem('pendingAction');
        await showEventLogForCreation();
    } else {
        // 顯示儀表板和列表的主視圖
        await showDashboardAndListView();
    }
}

/**
 * 顯示儀表板和列表的主視圖
 */
async function showDashboardAndListView() {
    const pageContainer = document.getElementById('page-events');
    const dashboardContainer = document.getElementById('event-log-dashboard-container');
    const listContainer = document.getElementById('event-log-list-container');
    
    // 切換視圖
    switchView('dashboard');

    // 顯示主容器的載入動畫
    dashboardContainer.innerHTML = '<div class="loading show"><div class="spinner"></div></div>';
    listContainer.innerHTML = '<div class="loading show"><div class="spinner"></div><p>載入紀錄中...</p></div>';
    
    try {
        const result = await authedFetch('/api/events/dashboard');
        if (!result.success) throw new Error(result.details || '讀取資料失敗');
        
        eventLogPageData = result.data;

        // 渲染圖表和列表
        renderEventsDashboardCharts(eventLogPageData.chartData);
        renderEventLogList(eventLogPageData.eventList);

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('❌ 載入事件紀錄儀表板失敗:', error);
            dashboardContainer.innerHTML = '';
            listContainer.innerHTML = `<div class="alert alert-error">讀取事件列表失敗: ${error.message}</div>`;
        }
    }
}

/**
 * 根據傳入的視圖名稱，管理容器的顯示與隱藏
 * @param {'dashboard' | 'form'} viewName - 要顯示的視圖名稱
 */
function switchView(viewName) {
    const dashboardContainer = document.getElementById('event-log-dashboard-container');
    const listContainer = document.getElementById('event-log-list-container');
    const formContainer = document.getElementById('event-log-form-container');
    const reportContainer = document.getElementById('event-log-report-container');

    // 全部隱藏
    [dashboardContainer, listContainer, formContainer, reportContainer].forEach(c => c.style.display = 'none');

    // 根據名稱顯示對應的容器
    if (viewName === 'dashboard') {
        dashboardContainer.style.display = 'grid'; // 儀表板使用 grid 佈局
        listContainer.style.display = 'block';
    } else if (viewName === 'form') {
        formContainer.style.display = 'block';
    }
}

// ==================== 圖表渲染函式 ====================

function renderEventsDashboardCharts(chartData) {
    const container = document.getElementById('event-log-dashboard-container');
    container.className = 'dashboard-grid-flexible'; 
    container.innerHTML = `
        <div class="dashboard-widget grid-col-4">
            <div class="widget-header"><h2 class="widget-title">事件趨勢 (近30天)</h2></div>
            <div id="event-trend-chart" class="widget-content" style="height: 300px;"></div>
        </div>
        <div class="dashboard-widget grid-col-4">
            <div class="widget-header"><h2 class="widget-title">下單機率分佈</h2></div>
            <div id="event-probability-chart" class="widget-content" style="height: 300px;"></div>
        </div>
        <div class="dashboard-widget grid-col-4">
            <div class="widget-header"><h2 class="widget-title">客戶規模分佈</h2></div>
            <div id="event-size-chart" class="widget-content" style="height: 300px;"></div>
        </div>
    `;
    
    setTimeout(() => {
        if (typeof Highcharts !== 'undefined') {
            renderEventsTrendChart(chartData.trend);
            renderEventsProbabilityChart(chartData.probability);
            renderEventsSizeChart(chartData.size);
        }
    }, 0);
}

// 【移除】重複的 getHighchartsThemeOptions 函式

function renderEventsTrendChart(data) {
    Highcharts.chart('event-trend-chart', {
        ...getHighchartsThemeOptions(),
        chart: { type: 'line', ...getHighchartsThemeOptions().chart },
        title: { text: '' },
        xAxis: { categories: data.map(d => d[0].substring(5)) },
        yAxis: { title: { text: '數量' } },
        legend: { enabled: false },
        series: [{ name: '事件數', data: data.map(d => d[1]), color: getHighchartsThemeOptions().colors[0] }]
    });
}

function renderEventsProbabilityChart(data) {
    const themeOptions = getHighchartsThemeOptions();
    Highcharts.chart('event-probability-chart', {
        ...themeOptions,
        chart: { type: 'pie', ...themeOptions.chart },
        title: { text: '' },
        tooltip: { pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b> ({point.y} 件)' },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: { 
                    enabled: true,
                    format: '<b>{point.name}</b>: {point.percentage:.1f} %',
                    distance: 20,
                    connectorColor: themeOptions.textColors.secondary,
                    style: {
                        color: themeOptions.textColors.secondary,
                        textOutline: 'none'
                    }
                },
                showInLegend: false
            }
        },
        series: [{ name: '佔比', data: data }]
    });
}

function renderEventsSizeChart(data) {
     Highcharts.chart('event-size-chart', {
        ...getHighchartsThemeOptions(),
        chart: { type: 'bar', ...getHighchartsThemeOptions().chart },
        title: { text: '' },
        xAxis: { categories: data.map(d => d[0]) },
        yAxis: { min: 0, title: { text: '事件數量' } },
        legend: { enabled: false },
        series: [{ name: '數量', data: data.map(d => d[1]), color: getHighchartsThemeOptions().colors[1] }]
    });
}


// ==================== 列表、表單、報告的顯示函式 ====================

function renderEventLogList(eventList) {
    const container = document.getElementById('event-log-list-container');
    let listHtml = `
        <div class="dashboard-widget" style="margin-top: 24px;">
            <div class="widget-header">
                <h2 class="widget-title">事件紀錄明細</h2>
                <button class="action-btn primary" onclick="showEventLogForCreation()">📝 新增事件紀錄</button>
            </div>
            <div class="widget-content">
                <table class="data-table">
                    <thead>
                        <tr><th>建立時間</th><th>事件名稱</th><th>關聯機會</th><th>建立者</th><th>操作</th></tr>
                    </thead>
                    <tbody>`;
    
    if (!eventList || eventList.length === 0) {
        listHtml += '<tr><td colspan="5" style="text-align: center; padding: 20px;">尚無任何事件紀錄</td></tr>';
    } else {
        eventList.forEach(event => {
            listHtml += `
                <tr>
                    <td data-label="建立時間">${formatDateTime(event.createdTime)}</td>
                    <td data-label="事件名稱"><strong>${event.eventName || '(未命名)'}</strong></td>
                    <td data-label="關聯機會">${event.opportunityName}</td>
                    <td data-label="建立者">${event.creator}</td>
                    <td data-label="操作">
                        <button class="action-btn small info" onclick="showEventLogReport('${event.eventId}')">📄 查看報告</button>
                    </td>
                </tr>`;
        });
    }
    
    listHtml += '</tbody></table></div></div>';
    container.innerHTML = listHtml;
}


async function showEventLogForCreation() {
    if (document.getElementById('page-events').style.display === 'none') {
        sessionStorage.setItem('pendingAction', 'createEventLog');
        await navigateTo('events');
        return;
    }

    switchView('form');
    const formContainer = document.getElementById('event-log-form-container');
    
    formContainer.innerHTML = `
        <div class="dashboard-widget">
            <div class="widget-header">
                 <h2 class="widget-title">新增事件紀錄</h2>
                 <button class="action-btn secondary" onclick="showDashboardAndListView()">返回列表</button>
            </div>
            <div class="widget-content">${eventFormTemplate}</div>
        </div>
    `;

    const form = document.getElementById('event-log-form');
    form.reset();
    document.getElementById('event-log-eventId').value = '';
    document.getElementById('event-log-modal-title').textContent = '新增事件紀錄';
    document.getElementById('event-log-submit-btn').textContent = '💾 儲存事件紀錄';
    
    const opportunitySelector = document.getElementById('event-log-opportunity-selector');
    const opportunityInfo = document.getElementById('event-log-opportunity-info');
    const opportunitySelect = document.getElementById('event-log-select-opportunity');

    opportunitySelector.style.display = 'block';
    opportunityInfo.style.display = 'none';

    opportunitySelect.innerHTML = '<option value="">載入機會列表中...</option>';
    opportunitySelect.disabled = true;

    try {
        const result = await authedFetch('/api/opportunities?page=1&limit=999');
        if (result.data) {
            opportunitySelect.innerHTML = '<option value="">請選擇一個機會案件...</option>';
            result.data.forEach(opp => {
                opportunitySelect.innerHTML += `<option value="${opp.opportunityId}">${opp.opportunityName} (${opp.customerCompany})</option>`;
            });
            opportunitySelect.disabled = false;
        } else {
            throw new Error('無法載入機會列表');
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') showNotification('載入機會列表失敗', 'error');
    }
    
    opportunitySelect.onchange = () => {
        document.getElementById('event-log-opportunityId').value = opportunitySelect.value;
    };
}


async function showEventLogForEditing(eventId) {
    closeModal('event-log-report-modal');
    switchView('form');
    const formContainer = document.getElementById('event-log-form-container');
    formContainer.innerHTML = '<div class="loading show"><div class="spinner"></div></div>';
    
    try {
        const result = await authedFetch(`/api/events/${eventId}`);
        if (!result.success) throw new Error(result.details || '載入事件資料失敗');
        
        const eventData = result.data;
        formContainer.innerHTML = `
            <div class="dashboard-widget">
                <div class="widget-header">
                     <h2 class="widget-title">編輯事件紀錄</h2>
                     <button class="action-btn secondary" onclick="showEventLogReport('${eventId}')">返回報告</button>
                </div>
                <div class="widget-content">${eventFormTemplate}</div>
            </div>
        `;
        populateEventLogForm(eventData);

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            showNotification(error.message, 'error');
            showDashboardAndListView();
        }
    }
}

async function showEventLogReport(eventId) {
    const modalContent = document.getElementById('event-log-report-content');
    if (!modalContent) {
        console.error('Event log report modal content area not found!');
        return;
    }
    modalContent.innerHTML = '<div class="loading show"><div class="spinner"></div><p>載入報告中...</p></div>';
    showModal('event-log-report-modal');

    try {
        const result = await authedFetch(`/api/events/${eventId}`);
        if (!result.success) throw new Error(result.error || '找不到該筆紀錄');
        
        const eventData = result.data;
        
        const reportHTML = renderEventLogReportHTML(eventData);
        modalContent.innerHTML = reportHTML;
        
        document.getElementById('edit-event-log-btn').onclick = () => showEventLogForEditing(eventId);
        document.getElementById('save-report-as-pdf-btn').onclick = () => exportReportToPdf(eventData);

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            modalContent.innerHTML = `<div class="alert alert-error">讀取事件報告失敗: ${error.message}</div>`;
        }
    }
}


// ==================== 資料填充與渲染輔助 ====================

function populateEventLogForm(eventData) {
    const form = document.getElementById('event-log-form');
    form.reset();

    document.getElementById('event-log-modal-title').textContent = '📝 編輯事件紀錄';
    document.getElementById('event-log-submit-btn').textContent = '💾 儲存變更';
    document.getElementById('event-log-eventId').value = eventData.eventId;
    document.getElementById('event-log-opportunityId').value = eventData.opportunityId;

    document.getElementById('event-log-opportunity-selector').style.display = 'none';
    const infoDiv = document.getElementById('event-log-opportunity-info');
    infoDiv.style.display = 'block';
    const opportunityName = (eventLogPageData.eventList.find(e => e.eventId === eventData.eventId) || {}).opportunityName || eventData.opportunityId;
    infoDiv.innerHTML = `關聯機會：<strong>${opportunityName}</strong> (編輯模式下無法變更)`;

    document.getElementById('event-name').value = eventData.eventName || '';
    document.getElementById('potential-quantity').value = eventData.potentialQuantity || '';
    document.getElementById('our-participants').value = eventData.ourParticipants || '';
    document.getElementById('client-participants').value = eventData.clientParticipants || '';
    document.getElementById('visit-place').value = eventData.visitPlace || '';
    document.getElementById('production-status').value = eventData.productionStatus || '';
    document.getElementById('iot-status').value = eventData.iotStatus || '';
    document.getElementById('summary-notes').value = eventData.summaryNotes || '';
    document.getElementById('pain-point-details').value = eventData.painPointDetails || '';
    document.getElementById('system-architecture').value = eventData.systemArchitecture || '';
    document.getElementById('external-systems').value = eventData.externalSystems || '';
    document.getElementById('hardware-scale').value = eventData.hardwareScale || '';
    document.getElementById('pain-point-notes').value = eventData.painPointNotes || '';

    if (eventData.orderProbability) form.querySelector(`input[name="orderProbability"][value="${eventData.orderProbability}"]`).checked = true;
    if (eventData.salesChannel) form.querySelector(`input[name="salesChannel"][value="${eventData.salesChannel}"]`).checked = true;
    if (eventData.companySize) form.querySelector(`input[name="companySize"][value="${eventData.companySize}"]`).checked = true;
    if (eventData.fanucExpectation) form.querySelector(`input[name="fanucExpectation"][value="${eventData.fanucExpectation}"]`).checked = true;

    const lineFeatures = eventData.lineFeatures ? eventData.lineFeatures.split(',').map(s => s.trim()) : [];
    lineFeatures.forEach(val => {
        const el = form.querySelector(`#line-features input[value="${val}"]`);
        if (el) el.checked = true;
    });
    const painPoints = eventData.painPoints ? eventData.painPoints.split(',').map(s => s.trim()) : [];
    painPoints.forEach(val => {
        const el = form.querySelector(`#pain-points input[value="${val}"]`);
        if (el) el.checked = true;
    });
}

function renderEventLogReportHTML(event) {
    const createInfoItem = (label, value, isPreformatted = false) => {
        if (!value || value.trim() === '') return '';
        const valueHTML = isPreformatted ? `<pre>${value}</pre>` : `<div class="info-value-box">${value.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
        return `<div class="info-item"><div class="info-label">${label}</div><div class="info-value">${valueHTML}</div></div>`;
    };
    const createOptionGroup = (label, allOptions, selectedValuesStr) => {
        if (!selectedValuesStr) return '';
        const selectedSet = new Set((selectedValuesStr.split(',')).map(s => s.trim()));
        const html = allOptions.map(opt => `<div class="option-item ${selectedSet.has(opt) ? 'selected' : ''}">${opt}</div>`).join('');
        return `<div class="info-item"><div class="info-label">${label}</div><div class="info-value"><div class="option-group">${html}</div></div></div>`;
    };
    
    const opportunityName = (eventLogPageData.eventList.find(e => e.eventId === event.eventId) || {}).opportunityName || event.opportunityId;

    return `<div class="report-view" id="pdf-content">
        <div class="report-header">
             <h2 class="report-title">${event.eventName || '未命名事件'}</h2>
             <div class="header-meta-info" style="justify-content:space-between; width:100%;">
                <span><strong>關聯機會:</strong> ${opportunityName}</span>
                <span><strong>建立者:</strong> ${event.creator || 'N/A'}</span>
                <span><strong>建立時間:</strong> ${formatDateTime(event.createdTime)}</span>
            </div>
        </div>
        <div class="report-container">
            <div class="report-column">
                <div class="report-section">
                    <h3 class="section-title">會議與銷售評估</h3>
                    ${createInfoItem('我方參與者', event.ourParticipants)}
                    ${createInfoItem('客戶與會者', event.clientParticipants)}
                    ${createInfoItem('會議地點', event.visitPlace)}
                    ${createOptionGroup('銷售管道', ['SI', '經銷商', 'TFC'], event.salesChannel)}
                    ${createOptionGroup('公司規模', ['超大100+', '大50-99', '中20-49', '小19以下'], event.companySize)}
                    ${createInfoItem('預估下單數量', event.potentialQuantity)}
                    ${createOptionGroup('客戶對 FANUC 期望', ['Yes', 'Probably', 'Maybe', 'No'], event.fanucExpectation)}
                    ${createInfoItem('需求摘要註解', event.summaryNotes)}
                </div>
            </div>
            <div class="report-column">
                <div class="report-section">
                    <h3 class="section-title">技術現況與痛點</h3>
                    ${createOptionGroup('生產線特徵', ['工具機', 'ROBOT', '傳產機', 'PLC'], event.lineFeatures)}
                    ${createInfoItem('生產概況', event.productionStatus)}
                    ${createInfoItem('IoT 概況', event.iotStatus)}
                    ${createOptionGroup('痛點分類', ['Monitoring', 'Improve OEE', 'Reduce Man-hours', 'Others'], event.painPoints)}
                    ${createInfoItem('痛點與導入目的', event.painPointDetails)}
                    ${createInfoItem('系統架構', event.systemArchitecture, true)}
                    ${createInfoItem('外部系統串接', event.externalSystems)}
                    ${createInfoItem('硬體/信號數', event.hardwareScale)}
                    ${createInfoItem('痛點補充說明', event.painPointNotes)}
                </div>
            </div>
        </div>
    </div>`;
}

async function exportReportToPdf(event) {
    showLoading('正在產生 PDF，請稍候...');
    
    const reportElement = document.getElementById('pdf-content');
    
    try {
        const options = {
            margin: [20, 20, 20, 20],
            filename: `事件報告-${event.eventName || '未命名'}-${event.eventId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
        };
        await html2pdf().from(reportElement).set(options).save();
    } catch (error) {
        console.error("PDF生成失敗:", error);
        showNotification("PDF 產生失敗，請再試一次。", "error");
    } finally {
        hideLoading();
    }
}


// ==================== 事件監聽與其他 ====================

document.addEventListener('submit', async function(e) {
    if (e.target.id === 'event-log-form') {
        e.preventDefault();
        
        const eventId = document.getElementById('event-log-eventId').value;
        const isEditMode = !!eventId;
        
        showLoading(isEditMode ? '正在更新紀錄...' : '正在儲存紀錄...');

        try {
            const form = document.getElementById('event-log-form');
            const opportunityId = document.getElementById('event-log-opportunityId').value;
            if (!opportunityId) throw new Error('請先選擇一個關聯的機會案件');

            const eventData = {
                opportunityId: opportunityId,
                eventName: document.getElementById('event-name').value,
                creator: getCurrentUser(),
                modifier: getCurrentUser(),
                orderProbability: form.querySelector('input[name="orderProbability"]:checked')?.value || '',
                potentialQuantity: document.getElementById('potential-quantity').value,
                salesChannel: form.querySelector('input[name="salesChannel"]:checked')?.value || '',
                ourParticipants: document.getElementById('our-participants').value,
                clientParticipants: document.getElementById('client-participants').value,
                companySize: form.querySelector('input[name="companySize"]:checked')?.value || '',
                visitPlace: document.getElementById('visit-place').value,
                lineFeatures: Array.from(form.querySelectorAll('#line-features input:checked')).map(el => el.value),
                productionStatus: document.getElementById('production-status').value,
                iotStatus: document.getElementById('iot-status').value,
                summaryNotes: document.getElementById('summary-notes').value,
                painPoints: Array.from(form.querySelectorAll('#pain-points input:checked')).map(el => el.value),
                painPointDetails: document.getElementById('pain-point-details').value,
                systemArchitecture: document.getElementById('system-architecture').value,
                externalSystems: document.getElementById('external-systems').value,
                hardwareScale: document.getElementById('hardware-scale').value,
                fanucExpectation: form.querySelector('input[name="fanucExpectation"]:checked')?.value || '',
                painPointNotes: document.getElementById('pain-point-notes').value
            };
            
            const url = isEditMode ? `/api/events/${eventId}` : '/api/events';
            const method = isEditMode ? 'PUT' : 'POST';

            const result = await authedFetch(url, { method, body: JSON.stringify(eventData) });
            hideLoading();

            if (result.success) {
                showNotification(isEditMode ? '事件紀錄更新成功！' : '事件紀錄儲存成功！', 'success');
                if (isEditMode) {
                    await showEventLogReport(eventId);
                } else {
                    await showDashboardAndListView();
                }
            } else {
                throw new Error(result.details || '操作失敗');
            }
        } catch (error) {
            hideLoading();
            if (error.message !== 'Unauthorized') {
                showNotification(`操作失敗: ${error.message}`, 'error');
            }
        }
    }
});


async function preloadEventTemplates() {
    try {
        if (!eventFormTemplate) {
            const formHtml = await fetch('event-log-modal.html').then(res => res.text());
            const formParser = new DOMParser();
            const formDoc = formParser.parseFromString(formHtml, 'text/html');
            eventFormTemplate = formDoc.querySelector('.modal-content').innerHTML;
        }
    } catch (error) {
        console.error("Failed to preload event templates:", error);
        showNotification("頁面組件載入失敗，部分功能可能異常", "error");
    }
}