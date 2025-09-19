// data/company-reader.js

const BaseReader = require('./base-reader');

/**
 * 專門負責讀取所有與「公司總表」相關資料的類別
 */
class CompanyReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
    }

    /**
     * 取得公司總表列表
     * @returns {Promise<Array<object>>}
     */
    async getCompanyList() {
        const cacheKey = 'companyList';
        const range = `${this.config.SHEETS.COMPANY_LIST}!A:J`;

        const rowParser = (row) => ({
            companyId: row[0] || '',
            companyName: row[1] || '',
            phone: row[2] || '',
            address: row[3] || '',
            createdTime: row[4] || '',
            lastUpdateTime: row[5] || '',
            county: row[6] || '',
            creator: row[7] || '',
            lastModifier: row[8] || '',
            introduction: row[9] || ''
        });

        return this._fetchAndCache(cacheKey, range, rowParser);
    }
}

module.exports = CompanyReader;