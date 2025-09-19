// views/scripts/main.js

// ==================== 全域變數 & 核心設定 ====================
let systemConfig = {};
let currentUser = '';

// 頁面設定，定義每個頁面的標題和載入函式
const pageConfig = {
    'dashboard': { title: '儀表板', subtitle: '以機會為核心的客戶關係管理平台', loadFn: () => window.dashboardManager.refresh(), loaded: true },
    'contacts': { title: '潛在客戶管理', subtitle: '管理所有來自名片或其他來源的潛在客戶', loadFn: loadContacts, loaded: false },
    'opportunities': { title: '機會案件管理', subtitle: '追蹤與管理所有進行中的機會案件', loadFn: loadOpportunities, loaded: false },
    'announcements': { title: '佈告欄管理', subtitle: '新增與管理團隊的公告訊息', loadFn: loadAnnouncementsPage, loaded: false }, // 【新增】
    'companies': { title: '公司管理', subtitle: '檢視與管理所有客戶公司', loadFn: loadCompaniesListPage, loaded: false },
    'interactions': { title: '互動總覽', subtitle: '檢視所有機會案件的互動紀錄', loadFn: loadAllInteractionsPage, loaded: false },
    'weekly-business': { title: '週間業務管理', subtitle: '新增與管理團隊的週間業務項目', loadFn: loadWeeklyBusinessPage, loaded: false },
    'events': { title: '事件紀錄列表', subtitle: '查看所有機會案件的詳細事件報告', loadFn: loadEventLogsPage, loaded: false },
    'follow-up': { title: '待追蹤列表', subtitle: '查看超過7天未聯繫的機會案件', loadFn: loadFollowUpPage, loaded: false },
    'company-details': { title: '公司詳細資料', subtitle: '查看公司的完整關聯資訊', loadFn: loadCompanyDetailsPage, loaded: true },
    'opportunity-details': { title: '機會詳細資料', subtitle: '檢視機會的所有關聯資訊', loadFn: loadOpportunityDetailPage, loaded: true }
};

// ==================== 應用程式初始化 ====================
/**
 * CRM 系統的主初始化函式
 */
async function initializeCRM() {
    console.log('🚀 [Main] TFC CRM系統初始化...');
    try {
        await loadSystemConfig();
        
        setupNavigation();
        
        displayCurrentUser();

        // 呼叫各自模組的初始化函式
        await window.dashboardManager.refresh(); 
        // 【修正】地圖初始化現在也移到 dashboardManager 內部處理，確保順序正確
        // await window.mapManager.initialize(); 
        window.kanbanBoardManager.initialize();
        
        console.log('✅ [Main] TFC CRM系統載入完成！');
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('❌ [Main] 系統初始化失敗:', error);
            showNotification('系統初始化失敗，請重新整理頁面', 'error');
        }
    }
}

/**
 * 載入並快取系統設定
 */
async function loadSystemConfig() {
    try {
        systemConfig = await authedFetch('/api/config');
        updateAllDropdowns();
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('❌ [Main] 載入系統設定失敗:', error);
            systemConfig = {};
        }
    }
}

// ==================== 導航與使用者管理 ====================

/**
 * 設定側邊欄的導航點擊事件
 */
function setupNavigation() {
    const navContainer = document.querySelector('.sidebar-nav');
    const statsContainer = document.querySelector('.stats-grid');

    const handleNavigation = (e) => {
        const target = e.target.closest('[data-page]');
        if (target) {
            e.preventDefault();
            const pageName = target.dataset.page;
            navigateTo(pageName);
        }
    };
    
    if(navContainer) navContainer.addEventListener('click', handleNavigation);
    if(statsContainer) statsContainer.addEventListener('click', handleNavigation);
}

/**
 * 導航到指定的頁面
 * @param {string} pageName - 目標頁面的鍵名
 * @param {object} [params={}] - 傳遞給頁面載入函式的參數
 */
async function navigateTo(pageName, params = {}) {
    if (!pageConfig[pageName]) {
        console.error(`[Main] 未知的頁面: ${pageName}`);
        return;
    }

    // 【修正】增加一個通用的機制來處理待辦動作
    if (params.weekId) { // 週間業務的特殊處理
        sessionStorage.setItem('navigateToWeekId', params.weekId);
    } else {
        sessionStorage.removeItem('navigateToWeekId');
    }
    if (params.pendingAction) { // 事件紀錄的特殊處理
        sessionStorage.setItem('pendingAction', params.pendingAction);
    } else {
        sessionStorage.removeItem('pendingAction');
    }
    
    const isDetailPage = pageName.includes('-details');

    if (!isDetailPage) {
        document.getElementById('page-title').textContent = pageConfig[pageName].title;
        document.getElementById('page-subtitle').textContent = pageConfig[pageName].subtitle;

        document.querySelectorAll('.nav-list .nav-item').forEach(item => item.classList.remove('active'));
        const activeNavItem = document.querySelector(`.nav-link[data-page="${pageName}"]`);
        if (activeNavItem) activeNavItem.closest('.nav-item').classList.add('active');
    }

    document.querySelectorAll('.page-view').forEach(page => page.style.display = 'none');
    const currentPageView = document.getElementById(`page-${pageName}`);
    currentPageView.style.display = 'block';
    
    if (pageConfig[pageName].loadFn) {
        if (isDetailPage || !pageConfig[pageName].loaded) {
            const paramKey = Object.keys(params)[0];
            await pageConfig[pageName].loadFn(params[paramKey]);
            if (!isDetailPage) pageConfig[pageName].loaded = true;
        }
    }
}


/**
 * 顯示當前登入的使用者名稱
 */
function displayCurrentUser() {
    const userDisplay = document.getElementById('user-display-name');
    if (!userDisplay) return;
    
    const userName = localStorage.getItem('crmCurrentUserName');
    
    if (userName) {
        userDisplay.textContent = `👤 ${userName}`;
        currentUser = userName;
    } else {
        userDisplay.textContent = `👤 使用者`;
        currentUser = '系統';
    }
}

function getCurrentUser() {
    return localStorage.getItem('crmCurrentUserName') || '系統';
}

/**
 * 登出系統
 */
function logout() {
    localStorage.removeItem('crm-token');
    localStorage.removeItem('crmCurrentUserName');
    showNotification('您已成功登出', 'success');
    setTimeout(() => { window.location.href = '/'; }, 1000);
}

// ==================== 全域輔助函式 ====================

/**
 * 載入所有 HTML 模態框組件
 */
async function loadHTMLComponents() {
    // 【新增】 'announcement-modals'
    const components = ['contact-modals', 'opportunity-modals', 'meeting-modals', 'system-modals', 'event-log-modal', 'event-log-views', 'link-contact-modal', 'link-opportunity-modal', 'announcement-modals'];
    try {
        const htmls = await Promise.all(components.map(c => fetch(`${c}.html`).then(res => res.text())));
        document.getElementById('modal-container').innerHTML = htmls.join('');
    } catch (error) { console.error('❌ [Main] 載入模態框組件失敗:', error); }
}

/**
 * 更新所有頁面中的下拉選單
 */
function updateAllDropdowns() {
    const dropdownMappings = { 
        'opportunity-type': '機會種類', 'upgrade-opportunity-type': '機會種類', 
        'current-stage': '機會階段', 'upgrade-current-stage': '機會階段', 
        'opportunity-source': '機會來源', 'assignee': '團隊成員', 
        'upgrade-assignee': '團隊成員', 'interaction-event-type': '互動類型',
        'map-opportunity-filter': '機會種類' 
    };
    Object.entries(dropdownMappings).forEach(([elementId, configKey]) => {
        const element = document.getElementById(elementId);
        if (element && systemConfig[configKey]) {
            const firstOptionHTML = element.querySelector('option[value=""]') ? element.querySelector('option[value=""]').outerHTML : '<option value="">請選擇...</option>';
            element.innerHTML = firstOptionHTML;
            element.innerHTML += systemConfig[configKey].map(item => `<option value="${item.value}">${item.note || item.value}</option>`).join('');
        }
    });
}