// data/weekly-business-reader.js

const BaseReader = require('./base-reader');

/**
 * 專門負責讀取所有與「週間業務」相關資料的類別
 */
class WeeklyBusinessReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
    }

    /**
     * 取得所有週間業務紀錄
     * @returns {Promise<Array<object>>}
     */
    async getAllWeeklyBusinessEntries() {
        const cacheKey = 'weeklyBusiness';
        const range = `${this.config.SHEETS.WEEKLY_BUSINESS}!A:K`;
        
        const fieldKeys = [
            '日期', 'weekId', 'category', '主題', '參與人員', 
            '重點摘要', '待辦事項', 'createdTime', 'lastUpdateTime',
            '建立者', 'recordId'
        ];

        const rowParser = (row, index) => {
            const entry = { rowIndex: index + 2 };
            fieldKeys.forEach((key, i) => {
                entry[key] = row[i] || '';
            });
            return entry;
        };

        const sorter = (a, b) => new Date(b['日期']) - new Date(a['日期']);

        return this._fetchAndCache(cacheKey, range, rowParser, sorter);
    }

    /**
     * 搜尋所有週間業務紀錄並分頁
     * @param {string} query 
     * @param {number} [page=1] 
     * @param {boolean} [fetchAll=false] 
     * @returns {Promise<object>}
     */
    async getAllWeeklyBusiness(query, page = 1, fetchAll = false) {
        const allEntries = await this.getAllWeeklyBusinessEntries();
        
        let filteredEntries = allEntries;
        if (query) {
            const searchTerm = query.toLowerCase();
            filteredEntries = allEntries.filter(entry =>
                Object.values(entry).some(value => 
                    String(value).toLowerCase().includes(searchTerm)
                )
            );
        }

        if (fetchAll) {
            return { data: filteredEntries, pagination: {} };
        }

        const pageSize = this.config.PAGINATION.CONTACTS_PER_PAGE;
        const startIndex = (page - 1) * pageSize;
        const paginatedData = filteredEntries.slice(startIndex, startIndex + pageSize);

        return {
            data: paginatedData,
            pagination: {
                current: page,
                total: Math.ceil(filteredEntries.length / pageSize),
                totalItems: filteredEntries.length,
                hasNext: (startIndex + pageSize) < filteredEntries.length,
                hasPrev: page > 1,
            },
        };
    }
}

module.exports = WeeklyBusinessReader;