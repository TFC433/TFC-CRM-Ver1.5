// data/base-reader.js

const config = require('../config');

// 集中管理所有資料的快取狀態
const cache = {
    opportunities: { data: null, timestamp: 0 },
    contacts: { data: null, timestamp: 0 }, // 潛在客戶
    interactions: { data: null, timestamp: 0 },
    eventLogs: { data: null, timestamp: 0 },
    systemConfig: { data: null, timestamp: 0 },
    companyList: { data: null, timestamp: 0 },
    contactList: { data: null, timestamp: 0 }, // 已建檔聯絡人
    users: { data: null, timestamp: 0 },
    weeklyBusiness: { data: null, timestamp: 0 },
    oppContactLinks: { data: null, timestamp: 0 }
};
const CACHE_DURATION = 60 * 1000; // 快取 60 秒

/**
 * 所有 Reader 的基礎類別，負責處理通用的快取邏輯和 API 互動
 */
class BaseReader {
    /**
     * @param {import('googleapis').google.sheets_v4.Sheets} sheets - 已認證的 Google Sheets API 實例
     */
    constructor(sheets) {
        if (!sheets) {
            throw new Error('BaseReader 需要一個已認證的 Sheets API 實例');
        }
        this.sheets = sheets;
        this.config = config;
        // 【修正】將 cache 和 CACHE_DURATION 附加到實例上，以便子類別可以存取
        this.cache = cache;
        this.CACHE_DURATION = CACHE_DURATION;
    }

    /**
     * 使指定的快取失效
     * @param {string} [key=null] - 要失效的快取鍵名 (e.g., 'opportunities')。若為 null，則清除所有快取。
     */
    invalidateCache(key = null) {
        if (key && this.cache[key]) {
            this.cache[key].timestamp = 0;
            console.log(`✅ [Cache] 快取已失效: ${key}`);
        } else if (key === null) {
            Object.keys(this.cache).forEach(k => this.cache[k].timestamp = 0);
            console.log('✅ [Cache] 所有快取已失效');
        }
    }

    /**
     * [核心方法] 執行 "先讀快取，若無則從 API 獲取並存入快取" 的流程
     * @protected
     * @param {string} cacheKey - 在 cache 物件中的鍵名
     * @param {string} range - 要讀取的 Google Sheet 範圍 (e.g., 'Sheet1!A:Z')
     * @param {(row: any[], index: number) => object} rowParser - 用於將單行陣列資料解析為物件的函式
     * @param {(a: object, b: object) => number} [sorter=null] - (可選) 用於排序結果陣列的比較函式
     * @returns {Promise<Array<object>>}
     */
    async _fetchAndCache(cacheKey, range, rowParser, sorter = null) {
        const now = Date.now();
        // 【修正】使用 this.cache 和 this.CACHE_DURATION
        if (this.cache[cacheKey] && this.cache[cacheKey].data && (now - this.cache[cacheKey].timestamp < this.CACHE_DURATION)) {
            console.log(`✅ [Cache] 從快取讀取 ${cacheKey}...`);
            return this.cache[cacheKey].data;
        }

        console.log(`🔄 [API] 從 Google Sheet 讀取 ${cacheKey}...`);
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.SPREADSHEET_ID,
                range: range,
            });

            const rows = response.data.values || [];
            if (rows.length <= 1) { // 假設第一行為標頭
                this.cache[cacheKey] = { data: [], timestamp: now };
                return [];
            }
            
            let data = rows.slice(1).map(rowParser);

            if (sorter) {
                data = data.sort(sorter);
            }
            
            this.cache[cacheKey] = { data, timestamp: now };
            return data;

        } catch (error) {
            console.error(`❌ [DataReader] 讀取 ${range} 時發生錯誤:`, error);
            if (error.code === 400 && error.message.includes('Unable to parse range')) {
                 console.warn(`⚠️ [DataReader] 工作表或範圍不存在: ${range}，將回傳空陣列。`);
                 return [];
            }
            throw error;
        }
    }
    
    /**
     * 在指定範圍內根據欄位值查找特定列 (此為低效能操作，應盡量避免)
     * @param {string} range - 工作表與範圍, e.g., 'Sheet1!A:B'
     * @param {number} columnIndex - 要比對的欄位索引 (0-based)
     * @param {string} value - 要尋找的值
     * @returns {Promise<object|null>} - 包含 rowData 和 rowIndex 的物件，或 null
     */
    async findRowByValue(range, columnIndex, value) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.SPREADSHEET_ID,
                range: range,
            });
            const rows = response.data.values || [];
            for (let i = 1; i < rows.length; i++) { // 從 1 開始忽略標頭
                if (rows[i][columnIndex] && rows[i][columnIndex].toLowerCase() === value.toLowerCase()) {
                    return { rowData: rows[i], rowIndex: i + 1 }; // rowIndex 是 1-based
                }
            }
            return null;
        } catch (error) {
            if (error.code === 400 && error.message.includes('Unable to parse range')) {
                 console.warn(`⚠️ [DataReader] 工作表或範圍不存在: ${range}，將其視為找不到。`);
                 return null;
            }
            console.error(`❌ [DataReader] 在 ${range} 查找時發生錯誤:`, error.message);
            throw error;
        }
    }
}

module.exports = BaseReader;