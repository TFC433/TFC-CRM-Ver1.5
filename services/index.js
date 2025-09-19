// services/index.js

const config = require('../config');
const DashboardService = require('./dashboard-service');
const OpportunityService = require('./opportunity-service');
const CompanyService = require('./company-service');
const EventLogService = require('./event-log-service');
const WeeklyBusinessService = require('./weekly-business-service');

// 從 google-services.js 遷移過來的日期輔助函式
const dateHelpers = {
    getWeekId: (d) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    },
    getWeekInfo: (weekId) => {
        const [year, week] = weekId.split('-W').map(Number);
        const d = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
        const day = d.getUTCDay() || 7;
        if (day !== 1) d.setUTCDate(d.getUTCDate() - day + 1);
        const start = d;
        const end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 4);
        const weekOfMonth = Math.ceil(start.getUTCDate() / 7);
        const month = start.toLocaleString('zh-TW', { month: 'long', timeZone: 'UTC' });
        const formatDate = (dt) => `${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${String(dt.getUTCDate()).padStart(2, '0')}`;
        const days = Array.from({length: 5}, (_, i) => {
            const dayDate = new Date(start);
            dayDate.setUTCDate(start.getUTCDate() + i);
            return { dayIndex: i + 1, date: dayDate.toISOString().split('T')[0], displayDate: formatDate(dayDate) };
        });
        return {
            title: `${year}年 ${month}, 第 ${weekOfMonth} 週`,
            dateRange: `(${formatDate(start)} - ${formatDate(end)})`,
            month, weekOfMonth, shortDateRange: `${formatDate(start)} - ${formatDate(end)}`, days
        };
    }
};

/**
 * 初始化所有業務邏輯服務
 * @param {object} coreServices - 從 service-container 初始化的核心服務 (readers, writers, etc.)
 * @returns {object} - 包含所有業務邏輯服務實例的物件
 */
function initializeBusinessServices(coreServices) {
    // 將 config 和 dateHelpers 加入核心服務，方便傳遞
    const servicesWithUtils = { ...coreServices, config, dateHelpers };

    const dashboardService = new DashboardService(servicesWithUtils);
    const opportunityService = new OpportunityService(servicesWithUtils);
    const companyService = new CompanyService(servicesWithUtils);
    const eventLogService = new EventLogService(servicesWithUtils);
    const weeklyBusinessService = new WeeklyBusinessService(servicesWithUtils);

    return {
        dashboardService,
        opportunityService,
        companyService,
        eventLogService,
        weeklyBusinessService,
        // 也把 workflowService 和 calendarService 從 core 提出來，方便 app.js 使用
        workflowService: coreServices.workflowService,
        calendarService: coreServices.calendarService,
        // 把 dataWriter 和讀者也傳出去，給那些還沒完全遷移的簡單 API 使用
        dataWriter: coreServices.dataWriter,
        contactReader: coreServices.contactReader,
        opportunityReader: coreServices.opportunityReader,
        companyReader: coreServices.companyReader,
        interactionReader: coreServices.interactionReader,
        systemReader: coreServices.systemReader,
        weeklyBusinessReader: coreServices.weeklyBusinessReader,
        eventLogReader: coreServices.eventLogReader,
        announcementReader: coreServices.announcementReader,
        // 【修正】在此處加入 announcementWriter
        announcementWriter: coreServices.announcementWriter
    };
}

module.exports = initializeBusinessServices;