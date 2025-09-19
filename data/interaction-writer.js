// data/interaction-writer.js

const BaseWriter = require('./base-writer');

class InteractionWriter extends BaseWriter {
    /**
     * @param {import('googleapis').google.sheets_v4.Sheets} sheets 
     * @param {import('./interaction-reader')} interactionReader 
     */
    constructor(sheets, interactionReader) {
        super(sheets);
        if (!interactionReader) {
            throw new Error('InteractionWriter 需要 InteractionReader 的實例');
        }
        this.interactionReader = interactionReader;
    }

    async createInteraction(interactionData) {
        console.log('📝 [InteractionWriter] 建立互動記錄...');
        const now = new Date().toISOString();
        const interactionId = `INT${Date.now()}`;
        
        const rowData = [
            interactionId, interactionData.opportunityId || '',
            interactionData.interactionTime || now, interactionData.eventType || '',
            interactionData.eventTitle || '', interactionData.contentSummary || '',
            interactionData.participants || '', interactionData.nextAction || '',
            interactionData.attachmentLink || '', interactionData.calendarEventId || '',
            interactionData.recorder || '', now
        ];
        
        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: `${this.config.SHEETS.INTERACTIONS}!A:L`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [rowData] }
        });
        
        this.interactionReader.invalidateCache('interactions');
        console.log('✅ [InteractionWriter] 互動記錄建立成功:', interactionId);
        return { success: true, interactionId, data: rowData };
    }

    async updateInteraction(rowIndex, updateData, modifier) {
        if (isNaN(parseInt(rowIndex)) || rowIndex <= 1) throw new Error(`無效的 rowIndex: ${rowIndex}`);
        console.log(`📝 [InteractionWriter] 更新互動紀錄 - Row: ${rowIndex} by ${modifier}`);
        const range = `${this.config.SHEETS.INTERACTIONS}!A${rowIndex}:L${rowIndex}`;

        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.config.SPREADSHEET_ID, range: range,
        });

        const currentRow = response.data.values ? response.data.values[0] : [];
        if(currentRow.length === 0) throw new Error(`在 ${rowIndex} 列找不到互動紀錄`);

        if(updateData.interactionTime !== undefined) currentRow[2] = updateData.interactionTime;
        if(updateData.eventType !== undefined) currentRow[3] = updateData.eventType;
        if(updateData.contentSummary !== undefined) currentRow[5] = updateData.contentSummary;
        if(updateData.nextAction !== undefined) currentRow[7] = updateData.nextAction;
        currentRow[10] = modifier;

        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.config.SPREADSHEET_ID, range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [currentRow] }
        });

        this.interactionReader.invalidateCache('interactions');
        console.log('✅ [InteractionWriter] 互動紀錄更新成功');
        return { success: true };
    }
}

module.exports = InteractionWriter;