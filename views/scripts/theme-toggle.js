// ==================== 主題切換功能 ==================== 
class ThemeManager {
    constructor() {
        this.theme = this.getStoredTheme() || this.getSystemTheme();
        this.init();
    }

    // 初始化主題管理器
    init() {
        this.createToggleButton();
        this.applyTheme(this.theme);
        this.bindEvents();
        console.log(`🎨 主題管理器初始化完成 - 當前主題: ${this.theme}`);
    }

    // 獲取儲存的主題
    getStoredTheme() {
        return localStorage.getItem('crm-theme');
    }

    // 獲取系統主題偏好
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }

    // 儲存主題到本地存儲
    setStoredTheme(theme) {
        localStorage.setItem('crm-theme', theme);
    }

    // 應用主題
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.theme = theme;
        this.setStoredTheme(theme);
        this.updateToggleButton();
        
        // 觸發自定義事件
        const event = new CustomEvent('themeChanged', { 
            detail: { theme: theme } 
        });
        document.dispatchEvent(event);
        
        console.log(`✨ 主題已切換至: ${theme}`);
    }

    // 切換主題
    toggleTheme() {
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        
        // 添加切換動畫
        this.animateThemeTransition();
    }

    // 主題切換動畫
    animateThemeTransition() {
        const toggleBtn = document.querySelector('.theme-toggle');
        if (toggleBtn) {
            toggleBtn.style.transform = 'scale(0.8) rotate(180deg)';
            setTimeout(() => {
                toggleBtn.style.transform = 'scale(1) rotate(0deg)';
            }, 200);
        }
    }

    // 創建主題切換按鈕
    createToggleButton() {
        // 檢查是否已經存在切換按鈕
        if (document.querySelector('.theme-toggle')) {
            return;
        }

        const toggleButton = document.createElement('button');
        toggleButton.className = 'theme-toggle';
        toggleButton.setAttribute('aria-label', '切換主題');
        toggleButton.setAttribute('title', '切換明暗主題');
        
        // SVG 圖標
        toggleButton.innerHTML = `
            <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
        `;

        document.body.appendChild(toggleButton);
    }

    // 更新切換按鈕狀態
    updateToggleButton() {
        const toggleBtn = document.querySelector('.theme-toggle');
        if (toggleBtn) {
            const title = this.theme === 'dark' ? '切換至明亮主題' : '切換至暗色主題';
            toggleBtn.setAttribute('title', title);
            toggleBtn.setAttribute('aria-label', title);
        }
    }

    // 綁定事件監聽器
    bindEvents() {
        // 主題切換按鈕點擊事件
        document.addEventListener('click', (e) => {
            if (e.target.closest('.theme-toggle')) {
                e.preventDefault();
                this.toggleTheme();
            }
        });

        // 鍵盤快捷鍵 (Ctrl/Cmd + Shift + L)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                this.toggleTheme();
            }
        });

        // 監聽系統主題變化
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
            mediaQuery.addEventListener('change', (e) => {
                if (!this.getStoredTheme()) {
                    const systemTheme = e.matches ? 'light' : 'dark';
                    this.applyTheme(systemTheme);
                }
            });
        }

        // 監聽存儲變化（多標籤頁同步）
        window.addEventListener('storage', (e) => {
            if (e.key === 'crm-theme' && e.newValue !== this.theme) {
                this.applyTheme(e.newValue || this.getSystemTheme());
            }
        });
    }

    // 獲取當前主題
    getCurrentTheme() {
        return this.theme;
    }

    // 檢查是否為暗色主題
    isDarkTheme() {
        return this.theme === 'dark';
    }

    // 檢查是否為明亮主題
    isLightTheme() {
        return this.theme === 'light';
    }

    // 強制設置主題
    setTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            this.applyTheme(theme);
        } else {
            console.warn('⚠️ 無效的主題值:', theme);
        }
    }

    // 重置為系統主題
    resetToSystemTheme() {
        localStorage.removeItem('crm-theme');
        const systemTheme = this.getSystemTheme();
        this.applyTheme(systemTheme);
        console.log(`🔄 已重置為系統主題: ${systemTheme}`);
    }

    // 獲取主題相關的CSS變數值
    getThemeVariable(variableName) {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(`--${variableName}`)
            .trim();
    }

    // 設置主題相關的CSS變數
    setThemeVariable(variableName, value) {
        document.documentElement.style.setProperty(`--${variableName}`, value);
    }

    // 導出主題設定
    exportThemeSettings() {
        return {
            currentTheme: this.theme,
            storedTheme: this.getStoredTheme(),
            systemTheme: this.getSystemTheme(),
            timestamp: new Date().toISOString()
        };
    }

    // 銷毀主題管理器
    destroy() {
        const toggleBtn = document.querySelector('.theme-toggle');
        if (toggleBtn) {
            toggleBtn.remove();
        }
        console.log('🗑️ 主題管理器已銷毀');
    }
}

// ==================== 主題相關工具函數 ====================

// 獲取當前主題顏色值
function getThemeColors() {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    
    return {
        primaryBg: computedStyle.getPropertyValue('--primary-bg').trim(),
        secondaryBg: computedStyle.getPropertyValue('--secondary-bg').trim(),
        textPrimary: computedStyle.getPropertyValue('--text-primary').trim(),
        textSecondary: computedStyle.getPropertyValue('--text-secondary').trim(),
        accentBlue: computedStyle.getPropertyValue('--accent-blue').trim(),
        accentGreen: computedStyle.getPropertyValue('--accent-green').trim(),
        accentOrange: computedStyle.getPropertyValue('--accent-orange').trim(),
        accentRed: computedStyle.getPropertyValue('--accent-red').trim()
    };
}

// 檢查是否支援深色模式
function supportsDarkMode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// 檢查是否支援明亮模式
function supportsLightMode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}

// 為特定元素應用主題類別
function applyThemeToElement(element, theme) {
    if (!element) return;
    
    element.classList.remove('theme-dark', 'theme-light');
    element.classList.add(`theme-${theme}`);
}

// 主題變化時的回調函數管理
class ThemeCallbackManager {
    constructor() {
        this.callbacks = new Set();
        this.setupThemeListener();
    }

    // 註冊主題變化回調
    register(callback) {
        if (typeof callback === 'function') {
            this.callbacks.add(callback);
            return () => this.callbacks.delete(callback); // 返回取消註冊函數
        }
    }

    // 設置主題變化監聽器
    setupThemeListener() {
        document.addEventListener('themeChanged', (e) => {
            this.callbacks.forEach(callback => {
                try {
                    callback(e.detail.theme, getThemeColors());
                } catch (error) {
                    console.error('主題變化回調執行錯誤:', error);
                }
            });
        });
    }

    // 清除所有回調
    clear() {
        this.callbacks.clear();
    }
}

// ==================== 全域實例和初始化 ====================

// 創建全域主題管理器實例
let themeManager = null;
let themeCallbackManager = null;

// 初始化主題系統
function initializeThemeSystem() {
    try {
        themeManager = new ThemeManager();
        themeCallbackManager = new ThemeCallbackManager();
        
        // 將主題管理器掛載到 window 對象，方便除錯
        if (typeof window !== 'undefined') {
            window.themeManager = themeManager;
            window.getThemeColors = getThemeColors;
        }
        
        console.log('🎨 主題系統初始化完成');
        return themeManager;
    } catch (error) {
        console.error('❌ 主題系統初始化失敗:', error);
        return null;
    }
}

// 等待 DOM 載入完成後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeThemeSystem);
} else {
    initializeThemeSystem();
}

// ==================== 導出 API ====================
// 為了支援模組化使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ThemeManager,
        ThemeCallbackManager,
        getThemeColors,
        supportsDarkMode,
        supportsLightMode,
        applyThemeToElement,
        initializeThemeSystem
    };
}

// 為了支援 ES6 模組
if (typeof window !== 'undefined') {
    window.ThemeSystem = {
        ThemeManager,
        ThemeCallbackManager,
        getThemeColors,
        supportsDarkMode,
        supportsLightMode,
        applyThemeToElement,
        initializeThemeSystem
    };
}

// ==================== 主題切換相關的實用函數 ====================

// 平滑主題切換動畫
function smoothThemeTransition(duration = 300) {
    const css = `
        *, *::before, *::after {
            transition: background-color ${duration}ms ease, 
                       color ${duration}ms ease, 
                       border-color ${duration}ms ease,
                       box-shadow ${duration}ms ease !important;
        }
    `;
    
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    
    setTimeout(() => {
        document.head.removeChild(style);
    }, duration);
}

// 主題切換時執行平滑動畫
document.addEventListener('themeChanged', () => {
    smoothThemeTransition(300);
});

// 調試用：顯示當前主題資訊
function debugThemeInfo() {
    if (themeManager) {
        console.table({
            '當前主題': themeManager.getCurrentTheme(),
            '儲存的主題': themeManager.getStoredTheme(),
            '系統主題': themeManager.getSystemTheme(),
            '是否為暗色主題': themeManager.isDarkTheme(),
            '支援深色模式': supportsDarkMode(),
            '主題顏色': getThemeColors()
        });
    }
}

// 將調試函數掛載到 window
if (typeof window !== 'undefined') {
    window.debugThemeInfo = debugThemeInfo;
}