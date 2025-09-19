// data/event-log-writer.js

const BaseWriter = require('./base-writer');

class EventLogWriter extends BaseWriter {
    /**
     * @param {import('googleapis').google.sheets_v4.Sheets} sheets 
     * @param {import('./event-log-reader')} eventLogReader 
     */
    constructor(sheets, eventLogReader) {
        super(sheets);
        if (!eventLogReader) {
            throw new Error('EventLogWriter 需要 EventLogReader 的實例');
        }
        this.eventLogReader = eventLogReader;
    }

    async createEventLog(eventData) {
        console.log(`📝 [EventLogWriter] 建立新的事件紀錄 (機會ID: ${eventData.opportunityId})...`);
        const now = new Date().toISOString();
        const eventId = `EVT${Date.now()}`;

        const rowData = [
            eventId, eventData.eventName || '', eventData.opportunityId || '', eventData.creator || '', now,
            eventData.orderProbability || '', eventData.potentialQuantity || '',
            eventData.salesChannel || '', eventData.ourParticipants || '',
            eventData.clientParticipants || '', eventData.companySize || '',
            eventData.visitPlace || '', (eventData.lineFeatures || []).join(', '),
            eventData.productionStatus || '', eventData.iotStatus || '',
            eventData.summaryNotes || '', (eventData.painPoints || []).join(', '),
            eventData.painPointDetails || '', eventData.systemArchitecture || '',
            eventData.externalSystems || '', eventData.hardwareScale || '',
            eventData.fanucExpectation || '', eventData.painPointNotes || ''
        ];

        if (rowData.length !== this.config.EVENT_LOG_FIELDS.length) {
            throw new Error(`欄位數量不匹配！應為 ${this.config.EVENT_LOG_FIELDS.length}，實際為 ${rowData.length}`);
        }

        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: `${this.config.SHEETS.EVENT_LOGS}!A:W`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [rowData] }
        });
        
        this.eventLogReader.invalidateCache('eventLogs');
        return { success: true, eventId: eventId, createdTime: now };
    }

    async updateEventLog(eventId, updateData, modifier) {
        console.log(`📝 [EventLogWriter] 更新事件紀錄 - ID: ${eventId} by ${modifier}`);
        const range = `${this.config.SHEETS.EVENT_LOGS}!A:W`;
        
        const eventRow = await this.eventLogReader.findRowByValue(range, 0, eventId);
        if (!eventRow) throw new Error(`找不到事件ID為 ${eventId} 的紀錄`);

        const { rowIndex, rowData: currentRow } = eventRow;
        
        // 【修正】使用逐一賦值的方式取代錯誤的 Object.assign
        const newRow = [...currentRow]; // 建立一個當前列的複本

        // 根據 updateData 物件的內容，更新 newRow 陣列中對應索引的值
        if (updateData.eventName !== undefined) newRow[1] = updateData.eventName;
        if (updateData.orderProbability !== undefined) newRow[5] = updateData.orderProbability;
        if (updateData.potentialQuantity !== undefined) newRow[6] = updateData.potentialQuantity;
        if (updateData.salesChannel !== undefined) newRow[7] = updateData.salesChannel;
        if (updateData.ourParticipants !== undefined) newRow[8] = updateData.ourParticipants;
        if (updateData.clientParticipants !== undefined) newRow[9] = updateData.clientParticipants;
        if (updateData.companySize !== undefined) newRow[10] = updateData.companySize;
        if (updateData.visitPlace !== undefined) newRow[11] = updateData.visitPlace;
        if (updateData.lineFeatures !== undefined) newRow[12] = (updateData.lineFeatures || []).join(', ');
        if (updateData.productionStatus !== undefined) newRow[13] = updateData.productionStatus;
        if (updateData.iotStatus !== undefined) newRow[14] = updateData.iotStatus;
        if (updateData.summaryNotes !== undefined) newRow[15] = updateData.summaryNotes;
        if (updateData.painPoints !== undefined) newRow[16] = (updateData.painPoints || []).join(', ');
        if (updateData.painPointDetails !== undefined) newRow[17] = updateData.painPointDetails;
        if (updateData.systemArchitecture !== undefined) newRow[18] = updateData.systemArchitecture;
        if (updateData.externalSystems !== undefined) newRow[19] = updateData.externalSystems;
        if (updateData.hardwareScale !== undefined) newRow[20] = updateData.hardwareScale;
        if (updateData.fanucExpectation !== undefined) newRow[21] = updateData.fanucExpectation;
        if (updateData.painPointNotes !== undefined) newRow[22] = updateData.painPointNotes;

        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: `${this.config.SHEETS.EVENT_LOGS}!A${rowIndex}:W${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [newRow] }
        });

        this.eventLogReader.invalidateCache('eventLogs');
        console.log('✅ [EventLogWriter] 事件紀錄更新成功');
        return { success: true };
    }
}

module.exports = EventLogWriter;