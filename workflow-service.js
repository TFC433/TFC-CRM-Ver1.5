// workflow-service.js - 核心業務流程模組 (已重構為依賴注入)
const config = require('./config');

class WorkflowService {
    /**
     * @param {object} writers - 包含所有 writer 實例的物件
     * @param {object} readers - 包含所有 reader 實例的物件
     * @param {import('googleapis').google.sheets_v4.Sheets} sheets - 已認證的 Google Sheets API 實例
     */
    constructor(writers, readers, sheets) {
        // 【重構】明確注入需要的 Writer 和 Reader 模組
        if (!writers || !readers || !sheets) {
            throw new Error('WorkflowService 需要 writers, readers, 和 Sheets API 的實例');
        }
        this.companyWriter = writers.companyWriter;
        this.contactWriter = writers.contactWriter;
        this.opportunityWriter = writers.opportunityWriter;
        this.interactionWriter = writers.interactionWriter;
        
        this.contactReader = readers.contactReader; // 需要用來讀取原始名片資料

        this.sheets = sheets;
        this.config = config;
    }

    /**
     * 從潛在客戶升級為機會案件的完整流程
     * @param {number} contactRowIndex - 原始名片資料中的列索引
     * @param {object} opportunityData - 從前端傳來的機會案件資料
     * @returns {Promise<object>} - 包含成功訊息和已建立機會的物件
     */
    async upgradeContactToOpportunity(contactRowIndex, opportunityData) {
        console.log('📈 [WorkflowService] **啟動[升級]流程...**');
        
        // 【重構】使用 contactReader 來獲取資料
        const allSourceContacts = await this.contactReader.getContacts(9999); // 獲取所有未升級的潛在客戶
        const sourceContact = allSourceContacts.find(c => c.rowIndex === contactRowIndex);

        if (!sourceContact) {
            throw new Error(`在 "原始名片資料" 中找不到指定的聯絡人 (rowIndex: ${contactRowIndex})`);
        }
        
        const fullOpportunityData = {
            ...opportunityData,
            customerCompany: sourceContact.company,
            mainContact: sourceContact.name,
            contactPhone: sourceContact.mobile || sourceContact.phone,
        };
        
        const createdOpportunity = await this._createFullOpportunityWorkflow(fullOpportunityData, sourceContact);
        
        return {
            success: true,
            message: '客戶升級成功，並已同步更新所有相關資料表。',
            data: createdOpportunity
        };
    }
    
    /**
     * 手動建立新機會案件的完整流程
     * @param {object} opportunityData - 從前端傳來的機會案件資料
     * @returns {Promise<object>} - 包含成功訊息和已建立機會的物件
     */
    async createOpportunity(opportunityData) {
        console.log('🎯 [WorkflowService] **啟動[新增]流程...**');
        
        const contactSourceInfo = {
            name: opportunityData.mainContact,
            company: opportunityData.customerCompany,
            phone: opportunityData.contactPhone,
            email: '', 
            position: ''
        };

        const createdOpportunity = await this._createFullOpportunityWorkflow(opportunityData, contactSourceInfo);
        
        return {
            success: true,
            message: '機會建立成功，並已同步更新所有相關資料表。',
            data: createdOpportunity
        };
    }

    /**
     * 內部使用的核心機會建立工作流程
     * @private
     * @param {object} opportunityData - 完整的機會資料
     * @param {object} contactSourceInfo - 聯絡人來源資訊
     * @returns {Promise<object>} - 已建立的機會案件物件
     */
    async _createFullOpportunityWorkflow(opportunityData, contactSourceInfo) {
        const modifier = opportunityData.assignee || '系統';
        console.log(`⚙️ [WorkflowService] **執行統一的核心機會建立流程 (操作者: ${modifier})...**`);
        
        // 【重構】呼叫注入的專職 Writer
        const companyData = await this.companyWriter.getOrCreateCompany(opportunityData.customerCompany, contactSourceInfo, modifier, opportunityData);
        console.log(`   - 步驟 1/6: 公司資料處理完畢 (ID: ${companyData.id})`);

        const contactData = await this.contactWriter.getOrCreateContact(contactSourceInfo, companyData, modifier);
        console.log(`   - 步驟 2/6: 聯絡人資料處理完畢 (ID: ${contactData.id})`);

        console.log('   - 步驟 3/6: 準備寫入機會案件...');
        const now = new Date().toISOString();
        const opportunityId = `OPP${Date.now()}`;
        
        const rowData = [
            opportunityId, opportunityData.opportunityName || '', opportunityData.customerCompany || '',
            opportunityData.mainContact || '', opportunityData.contactPhone || '', opportunityData.assignee || '',
            opportunityData.opportunityType || '', opportunityData.opportunitySource || '', 
            opportunityData.currentStage || this.config.CONSTANTS.DEFAULT_VALUES.OPPORTUNITY_STAGE,
            now, opportunityData.expectedCloseDate || '', opportunityData.opportunityValue || '',
            this.config.CONSTANTS.DEFAULT_VALUES.OPPORTUNITY_STATUS, 
            '', now, opportunityData.notes || '',
            modifier,
            opportunityData.parentOpportunityId || ''
        ];

        const response = await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.config.SPREADSHEET_ID, 
            range: `${this.config.SHEETS.OPPORTUNITIES}!A:R`,
            valueInputOption: 'USER_ENTERED', 
            resource: { values: [rowData] }
        });

        // 【重構】建立機會後，應清除機會列表的快取
        this.opportunityWriter.opportunityReader.invalidateCache('opportunities');

        const updatedRange = response.data.updates.updatedRange;
        const match = updatedRange.match(/!A(\d+)/);
        const newRowIndex = match ? parseInt(match[1]) : null;

        const createdOpportunity = {
            rowIndex: newRowIndex, opportunityId: rowData[0], opportunityName: rowData[1],
            customerCompany: rowData[2], mainContact: rowData[3], contactPhone: rowData[4],
            assignee: rowData[5], opportunityType: rowData[6], opportunitySource: rowData[7],
            currentStage: rowData[8], createdTime: rowData[9], expectedCloseDate: rowData[10],
            opportunityValue: rowData[11], currentStatus: rowData[12], driveFolderLink: rowData[13],
            lastUpdateTime: rowData[14], notes: rowData[15], lastModifier: rowData[16],
            parentOpportunityId: rowData[17]
        };
        console.log(`   - 步驟 3/6: 機會案件資料已寫入 (ID: ${createdOpportunity.opportunityId})`);

        const interactionData = {
            opportunityId: createdOpportunity.opportunityId,
            eventType: '系統事件',
            eventTitle: contactSourceInfo.rowIndex ? '從潛在客戶升級為機會' : '手動建立新機會',
            contentSummary: contactSourceInfo.rowIndex ?
                `將 "原始名片資料" 中的 ${contactSourceInfo.name} (${contactSourceInfo.company}) 升級為正式機會。` :
                `手動建立新的機會案件 "${createdOpportunity.opportunityName}"。`,
            recorder: modifier,
        };
        await this.interactionWriter.createInteraction(interactionData);
        console.log(`   - 步驟 4/6: 初始互動紀錄已建立`);

        await this.opportunityWriter.linkContactToOpportunity(
            createdOpportunity.opportunityId,
            contactData.id,
            modifier
        );
        console.log(`   - 步驟 5/6: 主要聯絡人關聯已建立`);
        
        if (contactSourceInfo.rowIndex) {
            await this.contactWriter.updateContactStatus(
                contactSourceInfo.rowIndex, 
                this.config.CONSTANTS.CONTACT_STATUS.UPGRADED
            );
            console.log(`   - 步驟 6/6: 已回寫原始名片狀態為 "已升級"`);
        }

        console.log('✅ [WorkflowService] **核心機會建立流程執行成功!**');
        return createdOpportunity;
    }
}

module.exports = WorkflowService;