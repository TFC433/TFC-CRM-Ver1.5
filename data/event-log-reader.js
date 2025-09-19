// data/event-log-reader.js

const BaseReader = require('./base-reader');

/**
 * 專門負責讀取所有與「事件紀錄」相關資料的類別
 */
class EventLogReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
    }

    /**
     * 取得所有事件紀錄
     * @returns {Promise<Array<object>>}
     */
    async getEventLogs() {
        const cacheKey = 'eventLogs';
        const range = `${this.config.SHEETS.EVENT_LOGS}!A:W`;

        const camelCaseHeaders = [
            'eventId', 'eventName', 'opportunityId', 'creator', 'createdTime', 'orderProbability', 
            'potentialQuantity', 'salesChannel', 'ourParticipants', 'clientParticipants', 
            'companySize', 'visitPlace', 'lineFeatures', 'productionStatus', 'iotStatus', 
            'summaryNotes', 'painPoints', 'painPointDetails', 'systemArchitecture', 
            'externalSystems', 'hardwareScale', 'fanucExpectation', 'painPointNotes'
        ];

        const rowParser = (row, index) => {
            const log = { rowIndex: index + 2 };
            camelCaseHeaders.forEach((header, i) => {
                log[header] = row[i] || '';
            });
            return log;
        };

        const sorter = (a, b) => {
            const dateA = new Date(a.createdTime);
            const dateB = new Date(b.createdTime);
            if (isNaN(dateB)) return -1;
            if (isNaN(dateA)) return 1;
            return dateB - dateA;
        };

        return this._fetchAndCache(cacheKey, range, rowParser, sorter);
    }

    /**
     * 根據 ID 取得單筆事件紀錄
     * @param {string} eventId 
     * @returns {Promise<object|null>}
     */
    async getEventLogById(eventId) {
        const allLogs = await this.getEventLogs();
        return allLogs.find(log => log.eventId === eventId) || null;
    }
}

module.exports = EventLogReader;