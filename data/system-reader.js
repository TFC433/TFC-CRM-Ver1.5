// data/system-reader.js

const BaseReader = require('./base-reader');

/**
 * 專門負責讀取系統級資料的類別 (系統設定、使用者)
 */
class SystemReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
    }

    /**
     * 取得系統設定工作表內容
     * @returns {Promise<object>}
     */
    async getSystemConfig() {
        const cacheKey = 'systemConfig';
        const now = Date.now();
        
        // 【修正】將 cache 和 CACHE_DURATION 改為 this.cache 和 this.CACHE_DURATION
        if (this.cache[cacheKey] && this.cache[cacheKey].data && (now - this.cache[cacheKey].timestamp < this.CACHE_DURATION)) {
            console.log(`✅ [Cache] 從快取讀取 ${cacheKey}...`);
            return this.cache[cacheKey].data;
        }

        console.log(`🔄 [API] 從 Google Sheet 讀取 ${cacheKey}...`);
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.SPREADSHEET_ID,
                range: `${this.config.SHEETS.SYSTEM_CONFIG}!A:E`,
            });
            
            const rows = response.data.values || [];
            if (rows.length <= 1) return {};
            
            const settings = {};
            rows.slice(1).forEach(row => {
                const [type, item, order, enabled] = row;
                if (enabled === 'TRUE' && type && item) {
                    if (!settings[type]) settings[type] = [];
                    settings[type].push({ value: item, note: row[4] || item, order: parseInt(order) || 99 });
                }
            });
            
            Object.keys(settings).forEach(type => settings[type].sort((a, b) => a.order - b.order));
            
            // 【修正】使用 this.cache
            this.cache[cacheKey] = { data: settings, timestamp: now };
            return settings;

        } catch (error) {
            console.error('❌ [DataReader] 讀取系統設定失敗:', error);
            return this.config.DEFAULT_SETTINGS || {};
        }
    }

    /**
     * 取得使用者名冊
     * @returns {Promise<Array<object>>}
     */
    async getUsers() {
        const cacheKey = 'users';
        const range = '使用者名冊!A:C';

        const rowParser = (row) => ({
            username: row[0],
            passwordHash: row[1],
            displayName: row[2]
        });

        const allUsers = await this._fetchAndCache(cacheKey, range, rowParser);
        return allUsers.filter(user => user.username && user.passwordHash);
    }
}

module.exports = SystemReader;