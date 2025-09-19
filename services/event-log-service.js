// services/event-log-service.js

/**
 * 專門負責處理與「事件紀錄」相關的業務邏輯
 */
class EventLogService {
    /**
     * @param {object} services - 包含所有已初始化服務的容器
     */
    constructor(services) {
        this.dataWriter = services.dataWriter;
        this.eventLogReader = services.eventLogReader;
    }

    /**
     * 建立一筆事件紀錄，並自動產生對應的互動紀錄
     * @param {object} eventData 
     * @returns {Promise<object>}
     */
    async createEventLog(eventData) {
        const result = await this.dataWriter.createEventLog(eventData);
        if (!result.success) {
            throw new Error("建立事件紀錄失敗");
        }

        try {
            console.log('📝 [EventLogService] 自動建立關聯的互動紀錄...');
            const interactionData = {
                opportunityId: eventData.opportunityId,
                interactionTime: result.createdTime,
                eventType: '事件報告',
                eventTitle: eventData.eventName || '建立事件紀錄報告',
                contentSummary: `已建立事件報告: "${eventData.eventName}". [點此查看報告](event_log_id=${result.eventId})`,
                recorder: eventData.creator,
                participants: `${eventData.ourParticipants || ''} (我方), ${eventData.clientParticipants || ''} (客戶方)`
            };
            await this.dataWriter.createInteraction(interactionData);
            console.log('✅ [EventLogService] 已成功建立關聯的互動紀錄');
        } catch (interactionError) {
            console.warn('⚠️ [EventLogService] 建立關聯的互動紀錄失敗:', interactionError);
        }
        
        return result;
    }

    /**
     * 更新一筆事件紀錄，並自動產生對應的互動紀錄
     * @param {string} eventId 
     * @param {object} eventData 
     * @param {string} modifier 
     * @returns {Promise<object>}
     */
    async updateEventLog(eventId, eventData, modifier) {
        const result = await this.dataWriter.updateEventLog(eventId, eventData, modifier);
        if (!result.success) {
            throw new Error("更新事件紀錄失敗");
        }

        try {
            const eventLog = await this.eventLogReader.getEventLogById(eventId);
            if (eventLog) {
                console.log('📝 [EventLogService] 自動建立事件更新的互動紀錄...');
                const interactionData = {
                    opportunityId: eventLog.opportunityId,
                    eventType: '系統事件',
                    eventTitle: '更新事件報告',
                    contentSummary: `更新了事件報告: "${eventData.eventName || eventLog.eventName}". [點此查看報告](event_log_id=${eventId})`,
                    recorder: modifier,
                };
                await this.dataWriter.createInteraction(interactionData);
                console.log('✅ [EventLogService] 已成功建立事件更新的互動紀錄');
            }
        } catch (interactionError) {
            console.warn('⚠️ [EventLogService] 建立事件更新的互動紀錄失敗:', interactionError);
        }
        
        return result;
    }
}

module.exports = EventLogService;