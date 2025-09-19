// views/scripts/utils.js

// ==================== 全域變數與設定 ====================
let searchDebounceTimer;
let zIndexCounter = 1100;
// 【新增】用於儲存確認對話框回呼函式的全域變數
window.confirmActionCallback = null;


/**
 * 經過認證的 fetch 函式，會自動附加 JWT Token
 * @param {string} url - API 的 URL
 * @param {object} [options={}] - fetch 的選項
 * @returns {Promise<any>} - 回傳 API 的 JSON 結果
 */
async function authedFetch(url, options = {}) {
    const token = localStorage.getItem('crm-token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('crm-token');
        showNotification('您的登入已過期，請重新登入。', 'error');
        setTimeout(() => { window.location.href = '/'; }, 2000);
        throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.message || 'API 請求失敗');
    }

    return response.json();
}

// ==================== 通用模態框與UI控制 ====================

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        zIndexCounter++;
        modal.style.zIndex = zIndexCounter;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    } else {
        console.error(`未找到ID為 "${modalId}" 的模態框`);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        const anyModalOpen = document.querySelector('.modal[style*="display: block"]');
        if (!anyModalOpen) {
            document.body.style.overflow = 'auto';
        }
    }
}

/**
 * 【新增】顯示自訂的確認對話框
 * @param {string} message - 要顯示在對話框中的訊息
 * @param {Function} callback - 當使用者點擊確認後要執行的函式
 */
function showConfirmDialog(message, callback) {
    const confirmMessageEl = document.getElementById('confirm-message');
    if (confirmMessageEl) {
        confirmMessageEl.textContent = message;
        window.confirmActionCallback = callback;
        showModal('confirm-dialog');
    } else {
        // Fallback to native confirm if custom dialog not found
        if (confirm(message)) {
            callback();
        }
    }
}

/**
 * 【新增】執行儲存的回呼函式，由確認按鈕觸發
 */
function executeConfirmAction() {
    if (typeof window.confirmActionCallback === 'function') {
        window.confirmActionCallback();
    }
    closeModal('confirm-dialog');
    window.confirmActionCallback = null; // 清除回呼
}

function openPanel(modalId) {
    const panelContainer = document.getElementById('slide-out-panel-container');
    const backdrop = document.getElementById('panel-backdrop');
    const sourceModal = document.getElementById(modalId);

    if (!panelContainer || !backdrop || !sourceModal) {
        console.error('開啟 Panel 所需的元素不完整。');
        return;
    }

    const title = sourceModal.querySelector('.modal-title')?.textContent || '詳細資訊';
    const content = sourceModal.querySelector('.modal-content')?.innerHTML || '';

    const panelHTML = `
        <div class="slide-out-panel" id="active-panel">
            <div class="panel-content">
                ${content}
            </div>
        </div>`;
    
    panelContainer.innerHTML = panelHTML;
    
    const newCloseBtn = panelContainer.querySelector('.close-btn');
    if (newCloseBtn) {
        newCloseBtn.setAttribute('onclick', 'closePanel()');
    }
    
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
        const panel = document.getElementById('active-panel');
        backdrop.classList.add('is-open');
        if(panel) panel.classList.add('is-open');
    });

    backdrop.onclick = () => closePanel();
}

function closePanel() {
    const panelContainer = document.getElementById('slide-out-panel-container');
    const panel = document.getElementById('active-panel');
    const backdrop = document.getElementById('panel-backdrop');

    if (panel && backdrop) {
        panel.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        
        setTimeout(() => {
            panelContainer.innerHTML = '';
            document.body.style.overflow = 'auto';
        }, 400);
    }
}

function showLoading(message = '處理中...') {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        document.getElementById('loading-message').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showNotification(message, type = 'info', duration = 3000) {
    const notificationArea = document.getElementById('notification-area');
    const template = document.getElementById('notification-template');
    if (!notificationArea || !template) return;

    const notification = template.content.cloneNode(true).firstElementChild;
    const iconMap = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    
    notification.classList.add(type);
    notification.querySelector('.notification-icon').textContent = iconMap[type];
    notification.querySelector('.notification-message').textContent = message;
    
    const closeBtn = notification.querySelector('.notification-close');
    
    const removeNotification = () => {
        notification.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    };

    closeBtn.onclick = removeNotification;
    
    notificationArea.appendChild(notification);
    
    setTimeout(removeNotification, duration);
}

// ==================== 通用資料處理函式 ====================

function renderPagination(containerId, pagination, loadFnName, filters = {}) {
    const paginationElement = document.getElementById(containerId);
    if (!paginationElement) return;

    let html = '';
    if (pagination && pagination.total > 1) {
        const searchBox = document.getElementById(`${containerId.replace('-pagination', '')}-search`);
        const query = searchBox ? searchBox.value.replace(/'/g, "\\'") : '';
        const filtersJson = JSON.stringify(filters).replace(/'/g, "\\'");

        html += `<button ${!pagination.hasPrev ? 'disabled' : ''} onclick="${loadFnName}(${pagination.current - 1}, '${query}', ${filtersJson})">‹ 上一頁</button>`;
        html += `<span>第 ${pagination.current} / ${pagination.total} 頁</span>`;
        html += `<button ${!pagination.hasNext ? 'disabled' : ''} onclick="${loadFnName}(${pagination.current + 1}, '${query}', ${filtersJson})">下一頁 ›</button>`;
    }
    paginationElement.innerHTML = html;
}

function handleSearch(searchFunction) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        searchFunction();
    }, 400);
}

// ==================== 通用工具函式 ====================
function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return new Intl.DateTimeFormat('zh-TW', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(date).replace(/\//g, '-');
    } catch (error) {
        return dateString;
    }
}

window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal(event.target.id);
    }
});

function detectCountyFromAddress(address) {
    if (!address || typeof address !== 'string') return null;
    const counties = ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市', '基隆市', '新竹市', '嘉義市', '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣'];
    for (let county of counties) {
        if (address.includes(county) || address.includes(county.replace('臺', '台'))) {
            return county;
        }
    }
    return null;
}

function populateCountyFromAddress(dataObject, countySelectId) {
    const countySelect = document.getElementById(countySelectId);
    if (!countySelect) return;
    countySelect.selectedIndex = 0;
    if (!dataObject || !dataObject.address) return;
    const detectedCounty = detectCountyFromAddress(dataObject.address);
    if (detectedCounty) {
        for (let option of countySelect.options) {
            if (option.value === detectedCounty) {
                option.selected = true;
                showNotification(`已自動辨識縣市：${detectedCounty}`, 'info', 2000);
                break;
            }
        }
    }
}

/**
 * 【新增】共用的 Highcharts 圖表主題設定
 * @returns {object} Highcharts 的主題選項物件
 */
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