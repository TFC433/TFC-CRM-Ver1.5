// services/opportunity-service.js

/**
 * 專門負責處理與「機會案件」相關的複雜業務邏輯
 */
class OpportunityService {
    /**
     * @param {object} services - 包含所有已初始化服務的容器
     */
    constructor(services) {
        this.config = services.config;
        // Readers
        this.opportunityReader = services.opportunityReader;
        this.interactionReader = services.interactionReader;
        this.eventLogReader = services.eventLogReader;
        this.contactReader = services.contactReader;
        this.systemReader = services.systemReader;
        // 【修正】注入具體的 Writer 模組
        this.companyWriter = services.companyWriter;
        this.contactWriter = services.contactWriter;
        this.opportunityWriter = services.opportunityWriter;
        this.interactionWriter = services.interactionWriter;
    }

    /**
     * 高效獲取機會案件的完整詳細資料
     * @param {string} opportunityId 
     * @returns {Promise<object>}
     */
    async getOpportunityDetails(opportunityId) {
        const [
            allOpportunities, 
            interactionsFromCache, 
            eventLogsFromCache, 
            linkedContactsFromCache
        ] = await Promise.all([
            this.opportunityReader.getOpportunities(),
            this.interactionReader.getInteractions(),
            this.eventLogReader.getEventLogs(),
            this.contactReader.getLinkedContacts(opportunityId)
        ]);
        
        const opportunityInfo = allOpportunities.find(opp => opp.opportunityId === opportunityId);
        if (!opportunityInfo) {
            throw new Error(`找不到機會ID為 ${opportunityId} 的案件`);
        }
        
        const interactions = interactionsFromCache.filter(i => i.opportunityId === opportunityId);
        const eventLogs = eventLogsFromCache.filter(log => log.opportunityId === opportunityId);

        let parentOpportunity = null;
        if (opportunityInfo.parentOpportunityId) {
            parentOpportunity = allOpportunities.find(opp => opp.opportunityId === opportunityInfo.parentOpportunityId) || null;
        }
        const childOpportunities = allOpportunities.filter(opp => opp.parentOpportunityId === opportunityId);

        console.log(`✅ [OpportunityService] 機會資料整合完畢: ${interactions.length} 筆互動, ${eventLogs.length} 筆事件, ${linkedContactsFromCache.length} 位聯絡人`);
        
        return {
            opportunityInfo,
            interactions,
            eventLogs,
            linkedContacts: linkedContactsFromCache,
            parentOpportunity,
            childOpportunities
        };
    }

    /**
     * 更新機會案件，並在階段變更時自動新增互動紀錄
     * @param {number} rowIndex 
     * @param {object} updateData 
     * @param {string} modifier 
     * @returns {Promise<object>}
     */
    async updateOpportunity(rowIndex, updateData, modifier) {
        const opportunities = await this.opportunityReader.getOpportunities();
        const originalOpportunity = opportunities.find(o => o.rowIndex === rowIndex);
        const oldStage = originalOpportunity ? originalOpportunity.currentStage : null;

        // 【修正】呼叫具體的 opportunityWriter
        const updateResult = await this.opportunityWriter.updateOpportunity(rowIndex, updateData, modifier);
        
        const newStage = updateData.currentStage;
        if (newStage && oldStage && newStage !== oldStage) {
            try {
                const systemConfig = await this.systemReader.getSystemConfig();
                const stageMapping = new Map((systemConfig['機會階段'] || []).map(item => [item.value, item.note]));
                const oldStageName = stageMapping.get(oldStage) || oldStage;
                const newStageName = stageMapping.get(newStage) || newStage;
                
                const interactionData = {
                    opportunityId: updateResult.data.opportunityId,
                    eventType: '系統事件',
                    eventTitle: '看板階段變更',
                    contentSummary: `階段從【${oldStageName}】更新為【${newStageName}】`,
                    recorder: modifier,
                };
                // 【修正】呼叫具體的 interactionWriter
                await this.interactionWriter.createInteraction(interactionData);
            } catch (interactionError) {
                console.warn('⚠️ [OpportunityService] 建立階段變更的互動紀錄失敗:', interactionError);
            }
        }
        return updateResult;
    }
    
    /**
     * 將一個聯絡人關聯到機會案件的工作流
     * @param {string} opportunityId 
     * @param {object} contactData 
     * @param {string} modifier 
     * @returns {Promise<object>}
     */
    async addContactToOpportunity(opportunityId, contactData, modifier) {
        let contactToLink;

        if (contactData.contactId) {
            contactToLink = { id: contactData.contactId, name: contactData.name };
        } else {
            if (!contactData.company) throw new Error("無法關聯聯絡人：缺少公司名稱。");
            
            // 【修正】呼叫具體的 Writer
            const contactCompanyData = await this.companyWriter.getOrCreateCompany(contactData.company, contactData, modifier, {});
            contactToLink = await this.contactWriter.getOrCreateContact(contactData, contactCompanyData, modifier);

            if (contactData.rowIndex) {
                await this.contactWriter.updateContactStatus(
                    contactData.rowIndex,
                    this.config.CONSTANTS.CONTACT_STATUS.UPGRADED
                );
            }
        }

        const linkResult = await this.opportunityWriter.linkContactToOpportunity(opportunityId, contactToLink.id, modifier);
        return { success: true, message: '聯絡人關聯成功', data: { contact: contactToLink, link: linkResult } };
    }
}

module.exports = OpportunityService;