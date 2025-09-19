// views/scripts/contacts.js

// ==================== 全域變數 ====================
let contactsData = [];
let selectedContactForUpgrade = null;

// ==================== 主要功能函式 ====================

async function loadContacts(page = 1, query = '') {
    const container = document.getElementById('page-contacts');
    if (!container) return;

    // Step 1: Render the page layout shell
    container.innerHTML = `
        <div id="contacts-dashboard-container" class="dashboard-grid-flexible" style="margin-bottom: 24px;">
            <div class="loading show" style="grid-column: span 12;"><div class="spinner"></div></div>
        </div>
        <div class="dashboard-widget">
            <div class="widget-header"><h2 class="widget-title">潛在客戶列表</h2></div>
            <div class="search-pagination" style="padding: 0 1.5rem; margin-bottom: 1rem;">
                <input type="text" class="search-box" id="contacts-page-search" placeholder="搜尋姓名或公司..." onkeyup="searchContactsEvent(event)" value="${query}">
                <div class="pagination" id="contacts-page-pagination"></div>
            </div>
            <div id="contacts-page-content">
                <div class="loading show"><div class="spinner"></div><p>載入潛在客戶資料中...</p></div>
            </div>
        </div>
    `;
    
    document.getElementById('contacts-page-search').addEventListener('keyup', searchContactsEvent);

    // Step 2: Fetch data in parallel and render content
    try {
        const [dashboardResult, listResult] = await Promise.all([
            authedFetch(`/api/contacts/dashboard`),
            authedFetch(`/api/contacts?page=${page}&q=${encodeURIComponent(query)}`)
        ]);

        // Render charts
        if (dashboardResult.success) {
            renderContactsDashboard(dashboardResult.data.chartData);
        } else {
            document.getElementById('contacts-dashboard-container').innerHTML = `<div class="alert alert-error" style="grid-column: span 12;">圖表資料載入失敗</div>`;
        }

        // Render list
        contactsData = listResult.data || [];
        document.getElementById('contacts-page-content').innerHTML = renderContactsTable(contactsData);
        renderPagination('contacts-page-pagination', listResult.pagination, 'loadContacts');

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error(`❌ 載入潛在客戶失敗:`, error);
            document.getElementById('contacts-dashboard-container').innerHTML = '';
            document.getElementById('contacts-page-content').innerHTML = `<div class="alert alert-error">載入資料失敗: ${error.message}</div>`;
        }
    }
}

function searchContactsEvent(event) {
    if (!event || event.type !== 'keyup' || event.key === 'Enter') {
         const query = document.getElementById('contacts-page-search').value;
         handleSearch(() => loadContacts(1, query));
    }
}

// ==================== 圖表渲染函式 ====================
function getHighchartsThemeOptions() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    const rootStyle = getComputedStyle(document.documentElement);
    const textColorPrimary = rootStyle.getPropertyValue('--text-primary').trim();
    const textColorSecondary = rootStyle.getPropertyValue('--text-secondary').trim();
    const gridLineColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0';

    return {
        colors: ['#4f8df7', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'],
        chart: { 
            backgroundColor: 'transparent' 
        },
        title: { 
            style: { color: textColorPrimary } 
        },
        xAxis: { 
            labels: { style: { color: textColorSecondary } }, 
            lineColor: gridLineColor, 
            tickColor: gridLineColor 
        },
        yAxis: { 
            gridLineColor: gridLineColor, 
            labels: { style: { color: textColorSecondary } }, 
            title: { style: { color: textColorPrimary } } 
        },
        legend: { 
            itemStyle: { color: textColorSecondary }, 
            itemHoverStyle: { color: textColorPrimary } 
        },
        tooltip: { 
            backgroundColor: isDark ? 'rgba(37, 40, 54, 0.85)' : 'rgba(255, 255, 255, 0.85)', 
            style: { color: textColorPrimary } 
        },
        credits: { 
            enabled: false 
        },
        textColors: {
            primary: textColorPrimary,
            secondary: textColorSecondary
        }
    };
}

function renderContactsDashboard(chartData) {
    const container = document.getElementById('contacts-dashboard-container');
    container.innerHTML = `
        <div class="dashboard-widget grid-col-12">
            <div class="widget-header"><h2 class="widget-title">潛在客戶增加趨勢 (近30天)</h2></div>
            <div id="contacts-trend-chart" class="widget-content" style="height: 300px;"></div>
        </div>
    `;
    renderContactsTrendChart(chartData.trend);
}

function renderContactsTrendChart(data) {
    Highcharts.chart('contacts-trend-chart', {
        ...getHighchartsThemeOptions(),
        chart: { type: 'area', ...getHighchartsThemeOptions().chart },
        title: { text: '' },
        xAxis: { categories: data.map(d => d[0].substring(5)) },
        yAxis: { title: { text: '數量' } },
        legend: { enabled: false },
        plotOptions: {
            area: {
                fillColor: {
                    linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                    stops: [
                        [0, Highcharts.color(getHighchartsThemeOptions().colors[0]).setOpacity(0.5).get('rgba')],
                        [1, Highcharts.color(getHighchartsThemeOptions().colors[0]).setOpacity(0).get('rgba')]
                    ]
                },
                marker: { radius: 2 },
                lineWidth: 2,
                states: { hover: { lineWidth: 3 } },
                threshold: null
            }
        },
        series: [{ name: '新增客戶數', data: data.map(d => d[1]), color: getHighchartsThemeOptions().colors[0] }]
    });
}


// ==================== 專用渲染函式 ====================

function renderContactsTable(data) {
    if (!data || data.length === 0) {
        return '<div class="alert alert-info" style="text-align:center; margin-top: 20px;">沒有找到聯絡人資料</div>';
    }

    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>姓名</th><th>公司</th><th>職位</th><th>聯絡方式</th><th>建立時間</th><th>操作</th>
                </tr>
            </thead>
            <tbody>`;
    data.forEach(contact => {
        const driveLinkBtn = contact.driveLink
            ? `<a href="${contact.driveLink}" target="_blank" class="action-btn small info" title="查看原始名片">💳 名片</a>`
            : '';

        tableHTML += `
            <tr>
                <td data-label="姓名"><strong>${contact.name || '-'}</strong></td>
                <td data-label="公司">${contact.company || '-'}</td>
                <td data-label="職位">${contact.position || '-'}</td>
                <td data-label="聯絡方式">
                    ${contact.mobile ? `<div>📱 ${contact.mobile}</div>` : ''}
                    ${contact.phone ? `<div>📞 ${contact.phone}</div>` : ''}
                    ${contact.email ? `<div>📧 ${contact.email}</div>` : ''}
                </td>
                <td data-label="建立時間">${formatDateTime(contact.createdTime)}</td>
                <td data-label="操作">
                    <div class="action-buttons-container">
                        ${driveLinkBtn}
                        <button class="action-btn small primary" onclick="startUpgradeContact(${contact.rowIndex})">📈 升級</button>
                    </div>
                </td>
            </tr>
        `;
    });
    tableHTML += '</tbody></table>';
    return tableHTML;
}

// ==================== 升級聯絡人相關功能 ====================
let upgradeSearchTimeout;

async function showUpgradeContactModal() {
    showModal('upgrade-contact-modal');
    const assigneeSelect = document.getElementById('upgrade-assignee');
    if (assigneeSelect) {
        assigneeSelect.value = getCurrentUser();
    }
    await loadContactsForUpgrade();
}

async function loadContactsForUpgrade(page = 1, query = '') {
    try {
        const listElement = document.getElementById('upgrade-contacts-list');
        listElement.innerHTML = '<div class="loading show"><div class="spinner"></div></div>';
        
        const result = await authedFetch(`/api/contacts?page=${page}&q=${encodeURIComponent(query)}`);
        
        renderUpgradeContactsList(result.data || []);
        renderPagination('upgrade-contacts-pagination', result.pagination, 'loadContactsForUpgrade');

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('❌ 載入升級聯絡人失敗:', error);
            document.getElementById('upgrade-contacts-list').innerHTML = 
                '<div class="alert alert-error">載入聯絡人失敗</div>';
        }
    }
}

function renderUpgradeContactsList(contacts) {
    let html = '';
    if (contacts.length === 0) {
        html = '<div class="alert alert-warning">沒有找到符合的聯絡人</div>';
    } else {
        contacts.forEach(contact => {
            html += `
                <div class="kanban-card" onclick='selectContactForUpgrade(${JSON.stringify(contact)})' 
                     style="border-left: 3px solid var(--accent-green); margin-bottom: 10px; cursor: pointer;">
                    <div class="card-title">${contact.name || '無姓名'}</div>
                    <div class="card-company">🏢 ${contact.company || '無公司'}</div>
                    <div class="card-assignee">📞 ${contact.mobile || contact.phone || '無電話'}</div>
                </div>
            `;
        });
    }
    document.getElementById('upgrade-contacts-list').innerHTML = html;
}

function searchContactsForUpgrade() {
    clearTimeout(upgradeSearchTimeout);
    upgradeSearchTimeout = setTimeout(() => {
        const query = document.getElementById('upgrade-search').value;
        loadContactsForUpgrade(1, query);
    }, 400);
}

function selectContactForUpgrade(contact) {
    selectedContactForUpgrade = contact;
    closeModal('upgrade-contact-modal');
    showModal('upgrade-confirm-modal');
    
    const driveLinkHTML = contact.driveLink
        ? `<p><strong>原始名片:</strong> <a href="${contact.driveLink}" target="_blank" class="text-link">點此查看名片照片</a></p>`
        : '';

    document.getElementById('selected-contact-info').innerHTML = `
        <h4>📋 選中的聯絡人</h4>
        <p><strong>姓名:</strong> ${contact.name || '-'}</p>
        <p><strong>公司:</strong> ${contact.company || '-'}</p>
        <p><strong>職位:</strong> ${contact.position || '-'}</p>
        <p><strong>電話:</strong> ${contact.mobile || contact.phone || '-'}</p>
        ${driveLinkHTML}
    `;
    
    const opportunityName = contact.company ? `${contact.company} 合作機會` : '新機會案件';
    document.getElementById('upgrade-opportunity-name').value = opportunityName;
    
    document.getElementById('upgrade-assignee').value = getCurrentUser();

    populateCountyFromAddress(contact, 'upgrade-company-county');
}


/**
 * 【修改】升級此函式，使其能處理 rowIndex 或 contact 物件
 * @param {number | object} contactOrRowIndex - 聯絡人的 rowIndex 或完整的 contact 物件
 */
function startUpgradeContact(contactOrRowIndex) {
    let contact = null;

    if (typeof contactOrRowIndex === 'object' && contactOrRowIndex !== null) {
        // 如果傳入的是物件 (來自 companies.js)
        contact = contactOrRowIndex;
    } else {
        // 如果傳入的是數字 (來自 contacts.js 的主列表)
        contact = contactsData.find(c => c.rowIndex === contactOrRowIndex);
    }

    if (contact) {
        selectContactForUpgrade(contact);
    } else {
        showNotification('找不到對應的聯絡人資料', 'error');
    }
}

// ==================== 升級表單提交 ====================
document.addEventListener('submit', async function(e) {
    if (e.target.id === 'upgrade-form') {
        e.preventDefault();
        
        if (!selectedContactForUpgrade) {
            showNotification('請先選擇要升級的聯絡人', 'warning');
            return;
        }
        
        showLoading('正在升級聯絡人並同步所有資料...');
        
        try {
            const opportunityData = {
                opportunityName: document.getElementById('upgrade-opportunity-name').value,
                opportunityType: document.getElementById('upgrade-opportunity-type').value,
                currentStage: document.getElementById('upgrade-current-stage').value,
                assignee: document.getElementById('upgrade-assignee').value,
                expectedCloseDate: document.getElementById('upgrade-expected-close-date').value,
                opportunityValue: document.getElementById('upgrade-opportunity-value').value,
                notes: document.getElementById('upgrade-notes').value,
                county: document.getElementById('upgrade-company-county').value
            };
            
            const result = await authedFetch(`/api/contacts/${selectedContactForUpgrade.rowIndex}/upgrade`, {
                method: 'POST',
                body: JSON.stringify(opportunityData)
            });
            
            if (result.success) {
                closeModal('upgrade-confirm-modal');
                
                // 標記儀表板和聯絡人頁面需要重新載入
                if(window.pageConfig) {
                    window.pageConfig.contacts.loaded = false;
                    window.pageConfig.dashboard.loaded = false;
                }

                showNotification(result.message || '聯絡人升級成功！', 'success', 4000);
                selectedContactForUpgrade = null;
                // 升級後跳轉到機會案件頁面，讓使用者看到新成果
                navigateTo('opportunities'); 
            } else {
                throw new Error(result.details || '升級失敗');
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                console.error('❌ 升級聯絡人失敗:', error);
                showNotification('升級失敗: ' + error.message, 'error');
            }
        } finally {
            hideLoading();
        }
    }
});