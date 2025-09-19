// services/service-container.js (已重構為注入所有模組)

const { google } = require('googleapis');
const AuthService = require('../auth-service');
const WorkflowService = require('../workflow-service');
const CalendarService = require('../calendar-service');

// 從 data/index.js 一次性引入所有資料層模組
const { 
    OpportunityReader, ContactReader, CompanyReader, InteractionReader,
    EventLogReader, SystemReader, WeeklyBusinessReader, AnnouncementReader, // 【新增】
    CompanyWriter, ContactWriter, OpportunityWriter, InteractionWriter,
    EventLogWriter, WeeklyBusinessWriter, AnnouncementWriter // 【新增】
} = require('../data');

// 這是應用程式服務的單例容器
const services = {};

/**
 * 初始化所有應用程式服務。這個函式在應用程式啟動時只會執行一次。
 */
async function initializeServices() {
    if (services.isInitialized) {
        return services;
    }

    console.log('🔧 [Service Container] 正在初始化所有服務...');

    // 1. 認證服務 (最底層)
    const authService = new AuthService();
    const authClient = await authService.getOAuthClient();
    
    // 2. Google API 實例
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    // 3. 資料讀取層 (Readers) - 將 sheets 實例注入
    const opportunityReader = new OpportunityReader(sheets);
    const contactReader = new ContactReader(sheets);
    const companyReader = new CompanyReader(sheets);
    const interactionReader = new InteractionReader(sheets);
    const eventLogReader = new EventLogReader(sheets);
    const systemReader = new SystemReader(sheets);
    const weeklyBusinessReader = new WeeklyBusinessReader(sheets);
    const announcementReader = new AnnouncementReader(sheets); // 【新增】

    const readers = {
        opportunityReader, contactReader, companyReader, interactionReader,
        eventLogReader, systemReader, weeklyBusinessReader, announcementReader // 【新增】
    };

    // 4. 資料寫入層 (Writers) - 注入 sheets 和對應的 reader
    const companyWriter = new CompanyWriter(sheets, companyReader);
    const contactWriter = new ContactWriter(sheets, contactReader);
    const opportunityWriter = new OpportunityWriter(sheets, opportunityReader, contactReader);
    const interactionWriter = new InteractionWriter(sheets, interactionReader);
    const eventLogWriter = new EventLogWriter(sheets, eventLogReader);
    const weeklyBusinessWriter = new WeeklyBusinessWriter(sheets, weeklyBusinessReader);
    const announcementWriter = new AnnouncementWriter(sheets, announcementReader); // 【新增】

    const writers = {
        companyWriter, contactWriter, opportunityWriter, interactionWriter,
        eventLogWriter, weeklyBusinessWriter, announcementWriter // 【新增】
    };
    
    // 5. 工作流與日曆服務 (注入 writers 和 readers)
    const workflowService = new WorkflowService(writers, readers, sheets);
    const calendarService = new CalendarService(authClient);

    // 6. 將所有服務實例儲存到容器中，以便 app.js 使用
    Object.assign(services, {
        authService,
        sheets,
        calendar,
        ...readers,
        ...writers, // 也將 writer 實例直接暴露出去，給簡單的 API 使用
        workflowService,
        calendarService,
        isInitialized: true
    });

    console.log('✅ [Service Container] 所有服務初始化完成！');
    return services;
}

// 匯出一個函式，它回傳一個 Promise，解析後是已初始化的服務容器
module.exports = initializeServices;