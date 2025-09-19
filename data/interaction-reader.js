// data/interaction-reader.js

const BaseReader = require('./base-reader');

/**
 * 專門負責讀取所有與「互動紀錄」相關資料的類別
 */
class InteractionReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
    }

    /**
     * 取得所有互動紀錄
     * @returns {Promise<Array<object>>}
     */
    async getInteractions() {
        const cacheKey = 'interactions';
        const range = `${this.config.SHEETS.INTERACTIONS}!A:L`;

        const rowParser = (row, index) => ({
            rowIndex: index + 2,
            interactionId: row[0] || '',
            opportunityId: row[1] || '',
            interactionTime: row[2] || '',
            eventType: row[3] || '',
            eventTitle: row[4] || '',
            contentSummary: row[5] || '',
            participants: row[6] || '',
            nextAction: row[7] || '',
            attachmentLink: row[8] || '',
            calendarEventId: row[9] || '',
            recorder: row[10] || '',
            createdTime: row[11] || ''
        });

        const sorter = (a, b) => {
            const dateA = new Date(a.interactionTime);
            const dateB = new Date(b.interactionTime);
            if (isNaN(dateB)) return -1;
            if (isNaN(dateA)) return 1;
            return dateB - dateA;
        };

        return this._fetchAndCache(cacheKey, range, rowParser, sorter);
    }

    /**
     * 取得最新的幾筆互動紀錄
     * @param {{limit: number}} options
     * @returns {Promise<Array<object>>}
     */
    async getRecentInteractions({ limit = 10 }) {
        const allInteractions = await this.getInteractions();
        return allInteractions.slice(0, limit);
    }

    /**
     * 搜尋所有互動紀錄並分頁
     * @param {string} query 
     * @param {number} [page=1] 
     * @returns {Promise<object>}
     */
    async searchAllInteractions(query, page = 1) {
        const [allInteractions, allOpportunities] = await Promise.all([
            this.getInteractions(),
            this.getOpportunities() // 依賴 OpportunityReader
        ]);

        const opportunityNameMap = new Map(allOpportunities.map(opp => [opp.opportunityId, opp.opportunityName]));

        let interactions = allInteractions.map(interaction => ({
            ...interaction,
            opportunityName: opportunityNameMap.get(interaction.opportunityId) || '未知機會'
        }));

        if (query) {
            const searchTerm = query.toLowerCase();
            interactions = interactions.filter(i =>
                (i.contentSummary && i.contentSummary.toLowerCase().includes(searchTerm)) ||
                (i.eventTitle && i.eventTitle.toLowerCase().includes(searchTerm)) ||
                (i.opportunityName && i.opportunityName.toLowerCase().includes(searchTerm)) ||
                (i.recorder && i.recorder.toLowerCase().includes(searchTerm))
            );
        }
        
        const pageSize = this.config.PAGINATION.INTERACTIONS_PER_PAGE;
        const startIndex = (page - 1) * pageSize;
        const paginated = interactions.slice(startIndex, startIndex + pageSize);
        
        return {
            data: paginated,
            pagination: { 
                current: page, 
                total: Math.ceil(interactions.length / pageSize), 
                totalItems: interactions.length, 
                hasNext: (startIndex + pageSize) < interactions.length, 
                hasPrev: page > 1 
            }
        };
    }

    // Phase 2 中，這個方法會被移除，改為依賴注入
    async getOpportunities() {
        const OpportunityReader = require('./opportunity-reader'); // 臨時引用
        const opportunityReader = new OpportunityReader(this.sheets);
        return opportunityReader.getOpportunities();
    }
}

module.exports = InteractionReader;