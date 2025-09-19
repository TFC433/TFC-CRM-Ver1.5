// calendar-service.js - 日曆服務模組
const { google } = require('googleapis');
const config = require('./config');

class CalendarService {
    /**
     * @param {google.auth.OAuth2} authClient - 已認證的 Google OAuth2 用戶端
     */
    constructor(authClient) {
        if (!authClient) {
            throw new Error('CalendarService 需要一個已認證的 authClient');
        }
        this.calendar = google.calendar({ version: 'v3', auth: authClient });
        this.config = config;
    }

    /**
     * 建立日曆事件
     * @param {object} eventData - 事件資料
     * @returns {Promise<object>} - 包含事件ID和連結的物件
     */
    async createCalendarEvent(eventData) {
        try {
            console.log(`📅 [CalendarService] 準備建立日曆事件: ${eventData.title}`);
            const startTime = new Date(eventData.startTime);
            if (isNaN(startTime.getTime())) {
                throw new Error(`無效的開始時間格式: ${eventData.startTime}`);
            }
    
            const durationMinutes = parseInt(eventData.duration, 10) || 60;
            const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    
            const event = {
                summary: eventData.title,
                description: eventData.description || '',
                start: { dateTime: startTime.toISOString(), timeZone: this.config.TIMEZONE },
                end: { dateTime: endTime.toISOString(), timeZone: this.config.TIMEZONE },
                location: eventData.location || '',
            };
    
            const response = await this.calendar.events.insert({
                calendarId: this.config.CALENDAR_ID,
                resource: event,
            });
            
            console.log('✅ [CalendarService] 日曆事件建立成功:', response.data.id);
            return { success: true, eventId: response.data.id, eventUrl: response.data.htmlLink };
        } catch (error) {
            console.error('❌ [CalendarService] 建立Calendar事件失敗:', error.response ? error.response.data.error : error.message);
            throw error;
        }
    }

    /**
     * 取得本週的日曆事件
     * @returns {Promise<object>} - 包含今日和本週事件統計及列表的物件
     */
    async getThisWeekEvents() {
        try {
            const now = new Date();
            const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            
            const response = await this.calendar.events.list({
                calendarId: this.config.CALENDAR_ID,
                timeMin: startOfWeek.toISOString(),
                timeMax: endOfWeek.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            
            const events = response.data.items || [];
            const today = new Date().toDateString();
            const todayEvents = events.filter(event => new Date(event.start.dateTime || event.start.date).toDateString() === today);
            
            return {
                todayCount: todayEvents.length,
                weekCount: events.length,
                todayEvents: todayEvents.slice(0, 3),
                allEvents: events
            };
        } catch (error) {
            console.error('❌ [CalendarService] 讀取Calendar事件失敗:', error);
            return { todayCount: 0, weekCount: 0, todayEvents: [], allEvents: [] };
        }
    }
}

module.exports = CalendarService;