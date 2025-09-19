// views/scripts/interactions.js

/**
 * 載入並渲染所有互動紀錄頁面的主函式
 * @param {number} [page=1] - 要載入的頁碼
 * @param {string} [query=''] - 搜尋關鍵字
 */
async function loadAllInteractionsPage(page = 1, query = '') {
    const container = document.getElementById('page-interactions');
    if (!container) return;

    // 步驟 1: 渲染頁面基本骨架
    container.innerHTML = `
        <div class="dashboard-widget">
            <div class="widget-header">
                <h2 class="widget-title">所有互動紀錄</h2>
            </div>
            <div class="search-pagination" style="padding: 0 1.5rem 1rem;">
                <input type="text" class="search-box" id="all-interactions-search" placeholder="搜尋內容、機會名稱、記錄人..." value="${query}">
                <div class="pagination" id="all-interactions-pagination"></div>
            </div>
            <div id="all-interactions-content" class="widget-content">
                <div class="loading show"><div class="spinner"></div><p>載入互動總覽中...</p></div>
            </div>
        </div>
    `;

    // 綁定搜尋事件
    document.getElementById('all-interactions-search').addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            const newQuery = event.target.value;
            loadAllInteractionsPage(1, newQuery);
        }
    });

    // 步驟 2: 獲取數據並渲染
    try {
        const result = await authedFetch(`/api/interactions/all?page=${page}&q=${encodeURIComponent(query)}`);
        
        document.getElementById('all-interactions-content').innerHTML = renderAllInteractionsTable(result.data || []);
        renderPagination('all-interactions-pagination', result.pagination, 'loadAllInteractionsPage');

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('載入所有互動紀錄失敗:', error);
            document.getElementById('all-interactions-content').innerHTML = `<div class="alert alert-error">載入紀錄失敗: ${error.message}</div>`;
        }
    }
}

/**
 * 渲染所有互動紀錄的表格
 * @param {Array<object>} interactions - 互動紀錄資料陣列
 * @returns {string} HTML 表格字串
 */
function renderAllInteractionsTable(interactions) {
    if (!interactions || interactions.length === 0) {
        return '<div class="alert alert-info" style="text-align:center;">找不到符合條件的互動紀錄</div>';
    }

    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>互動時間</th>
                    <th>關聯機會</th>
                    <th>標題 / 摘要</th>
                    <th>記錄人</th>
                </tr>
            </thead>
            <tbody>`;

    interactions.forEach(item => {
        let summaryHTML = item.contentSummary || '';
        // 讓摘要中的報告連結可以點擊
        const linkRegex = /\[(.*?)\]\(event_log_id=(.*?)\)/g;
        summaryHTML = summaryHTML.replace(linkRegex, (fullMatch, text, eventId) => {
            return `<a href="#" class="text-link" onclick="event.preventDefault(); showEventLogReport('${eventId}')">${text}</a>`;
        });

        tableHTML += `
            <tr>
                <td data-label="互動時間" style="white-space: nowrap;">${formatDateTime(item.interactionTime)}</td>
                <td data-label="關聯機會">
                    <a href="#" class="text-link" onclick="event.preventDefault(); navigateTo('opportunity-details', { opportunityId: '${item.opportunityId}' })">
                        ${item.opportunityName}
                    </a>
                </td>
                <td data-label="標題 / 摘要">
                    <strong>${item.eventTitle || item.eventType}</strong>
                    <p style="color: var(--text-muted); margin-top: 4px; font-size: 0.8rem;">${summaryHTML}</p>
                </td>
                <td data-label="記錄人">${item.recorder || '-'}</td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    return tableHTML;
}