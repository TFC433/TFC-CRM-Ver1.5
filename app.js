// app.js - CRM系統主程式 (已重構為分層架構並加入完整錯誤處理)
const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const config = require('./config');
const initializeCoreServices = require('./services/service-container');
const initializeBusinessServices = require('./services');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiFlash = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

const app = express();

// 中間件設定
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static('views'));

// ==================== 伺服器啟動函式 ====================
async function startServer() {
    try {
        const coreServices = await initializeCoreServices();
        const services = initializeBusinessServices(coreServices);
        
        app.set('services', services);
        console.log('✅ 所有服務已注入，準備設定 API 路由...');

        // 統一的錯誤處理函式
        const handleApiError = (res, error) => {
            console.error('❌ API 執行錯誤:', error.message);
            res.status(500).json({ success: false, error: '伺服器內部錯誤', details: error.message });
        };

        // ==================== 公開路由 (不需登入) ====================
        app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
        app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));

        app.get('/health', async (req, res) => {
            try {
                const { authService } = app.get('services');
                const healthStatus = await authService.checkAuthStatus();
                res.json({ status: 'ok', timestamp: new Date().toISOString(), services: healthStatus });
            } catch (error) { handleApiError(res, error); }
        });

        // ==================== 登入 API (不需登入) ====================
        app.post('/api/login', async (req, res) => {
            try {
                const { systemReader } = app.get('services');
                const { username, password } = req.body;
                if (!username || !password) {
                    return res.status(400).json({ success: false, message: '請輸入帳號和密碼' });
                }
                const allUsers = await systemReader.getUsers();
                const user = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
                if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
                    return res.status(401).json({ success: false, message: '帳號或密碼錯誤' });
                }
                const token = jwt.sign({ username: user.username, name: user.displayName }, config.AUTH.JWT_SECRET, { expiresIn: config.AUTH.JWT_EXPIRES_IN });
                res.json({ success: true, token, name: user.displayName });
            } catch (error) { handleApiError(res, error); }
        });

        // ==================== API 守衛 (Middleware) ====================
        const verifyToken = (req, res, next) => {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) return res.status(403).json({ message: '未提供Token' });
            jwt.verify(token, config.AUTH.JWT_SECRET, (err, user) => {
                if (err) return res.status(401).json({ message: 'Token無效' });
                req.user = user;
                next();
            });
        };
        app.use('/api', verifyToken);

        // ==================== 受保護的 API 路由 ====================
        const { 
            dashboardService, opportunityService, companyService, eventLogService, 
            weeklyBusinessService, workflowService, calendarService, dataWriter, 
            contactReader, opportunityReader, companyReader, interactionReader, 
            systemReader, weeklyBusinessReader, eventLogReader,
            announcementReader, announcementWriter // 【新增】
        } = services;

        // --- 儀表板 & 地圖 APIs ---
        app.get('/api/dashboard', async (req, res) => { try { res.json({ success: true, data: await dashboardService.getDashboardData() }); } catch (error) { handleApiError(res, error); } });
        app.get('/api/opportunities/dashboard', async (req, res) => { try { res.json({ success: true, data: await dashboardService.getOpportunitiesDashboardData() }); } catch (error) { handleApiError(res, error); } });
        app.get('/api/contacts/dashboard', async (req, res) => { try { res.json({ success: true, data: await dashboardService.getContactsDashboardData() }); } catch (error) { handleApiError(res, error); } });
        app.get('/api/events/dashboard', async (req, res) => { try { res.json({ success: true, data: await dashboardService.getEventsDashboardData() }); } catch (error) { handleApiError(res, error); } });
        app.get('/api/opportunities/by-county', async (req, res) => { try { res.json(await opportunityReader.getOpportunitiesByCounty(req.query.opportunityType)); } catch (error) { handleApiError(res, error); } });

        // --- 聯絡人 & 公司 API ---
        app.get('/api/contacts', async (req, res) => { try { res.json(await contactReader.searchContacts(req.query.q, parseInt(req.query.page || 1))); } catch (error) { handleApiError(res, error); } });
        app.get('/api/contact-list', async (req, res) => { try { res.json(await contactReader.searchContactList(req.query.q, parseInt(req.query.page || 1))); } catch (error) { handleApiError(res, error); } });
        app.post('/api/contacts/:rowIndex/upgrade', async (req, res) => { try { res.json(await workflowService.upgradeContactToOpportunity(parseInt(req.params.rowIndex), req.body)); } catch (error) { handleApiError(res, error); } });
        app.put('/api/contacts/:contactId', async (req, res) => { try { res.json(await dataWriter.updateContact(req.params.contactId, req.body, req.user.name)); } catch (error) { handleApiError(res, error); } });
        app.get('/api/companies', async (req, res) => { try { res.json({ success: true, data: await companyReader.getCompanyList() }); } catch (error) { handleApiError(res, error); } });
        app.get('/api/companies/:companyName/details', async (req, res) => { try { res.json({ success: true, data: await companyService.getCompanyDetails(decodeURIComponent(req.params.companyName)) }); } catch (error) { handleApiError(res, error); } });
        app.put('/api/companies/:companyName', async (req, res) => { try { res.json(await dataWriter.updateCompany(decodeURIComponent(req.params.companyName), req.body, req.user.name)); } catch (error) { handleApiError(res, error); } });

        // --- 機會 API ---
        app.get('/api/opportunities', async (req, res) => {
            try {
                const { q, page = 1, assignee, type, stage } = req.query;
                const filters = { assignee, type, stage };
                Object.keys(filters).forEach(key => (filters[key] === undefined || filters[key] === '') && delete filters[key]);
                res.json(await opportunityReader.searchOpportunities(q, parseInt(page), filters));
            } catch (error) { handleApiError(res, error); }
        });
        app.get('/api/opportunities/:opportunityId/details', async (req, res) => { try { res.json({ success: true, data: await opportunityService.getOpportunityDetails(req.params.opportunityId) }); } catch (error) { handleApiError(res, error); } });
        app.post('/api/opportunities', async (req, res) => { try { res.json(await workflowService.createOpportunity(req.body)); } catch (error) { handleApiError(res, error); } });
        app.put('/api/opportunities/:rowIndex', async (req, res) => { try { res.json(await opportunityService.updateOpportunity(parseInt(req.params.rowIndex), req.body, req.user.name)); } catch (error) { handleApiError(res, error); } });
        app.put('/api/opportunities/batch', async (req, res) => { try { res.json(await dataWriter.batchUpdateOpportunities(req.body.updates)); } catch (error) { handleApiError(res, error); } });
        app.delete('/api/opportunities/:rowIndex', async (req, res) => { try { res.json(await dataWriter.deleteOpportunity(parseInt(req.params.rowIndex), req.user.name)); } catch (error) { handleApiError(res, error); } });
        app.post('/api/opportunities/:opportunityId/contacts', async (req, res) => { try { res.json(await opportunityService.addContactToOpportunity(req.params.opportunityId, req.body, req.user.name)); } catch (error) { handleApiError(res, error); } });
        app.delete('/api/opportunities/:opportunityId/contacts/:contactId', async (req, res) => { try { res.json(await dataWriter.deleteContactLink(req.params.opportunityId, req.params.contactId)); } catch (error) { handleApiError(res, error); } });
        
        // --- 互動 & 事件 API ---
        app.get('/api/interactions/all', async (req, res) => { try { res.json(await interactionReader.searchAllInteractions(req.query.q, parseInt(req.query.page || 1))); } catch (error) { handleApiError(res, error); } });
        app.post('/api/interactions', async (req, res) => { try { res.json(await dataWriter.createInteraction(req.body)); } catch (error) { handleApiError(res, error); } });
        app.put('/api/interactions/:rowIndex', async (req, res) => { try { res.json(await dataWriter.updateInteraction(parseInt(req.params.rowIndex), req.body, req.user.name)); } catch (error) { handleApiError(res, error); } });
        app.post('/api/events', async (req, res) => { try { res.json(await eventLogService.createEventLog(req.body)); } catch (error) { handleApiError(res, error); } });
        app.get('/api/events/:eventId', async (req, res) => { try { const data = await eventLogReader.getEventLogById(req.params.eventId); res.json({ success: !!data, data }); } catch (error) { handleApiError(res, error); } });
        app.put('/api/events/:eventId', async (req, res) => { try { res.json(await eventLogService.updateEventLog(req.params.eventId, req.body, req.user.name)); } catch (error) { handleApiError(res, error); } });

        // --- 週間業務 API ---
        app.get('/api/business/weekly/summary', async (req, res) => { try { res.json({ success: true, data: await weeklyBusinessService.getWeeklyBusinessByWeek() }); } catch (error) { handleApiError(res, error); } });
        app.get('/api/business/weekly/week-options', async (req, res) => { try { res.json({ success: true, data: await weeklyBusinessService.getWeekOptions() }); } catch (error) { handleApiError(res, error); } });
        app.get('/api/business/weekly/details/:weekId', async (req, res) => { try { res.json({ success: true, data: await weeklyBusinessService.getWeeklyDetails(req.params.weekId) }); } catch (error) { handleApiError(res, error); } });
        app.get('/api/business/weekly/all', async (req, res) => { try { res.json(await weeklyBusinessReader.getAllWeeklyBusiness(req.query.q, parseInt(req.query.page || 1))); } catch (error) { handleApiError(res, error); } });
        app.post('/api/business/weekly', async (req, res) => { try { res.json(await weeklyBusinessService.createWeeklyBusinessEntry({ ...req.body, creator: req.user.name })); } catch (error) { handleApiError(res, error); } });
        app.put('/api/business/weekly/:recordId', async (req, res) => { try { res.json(await weeklyBusinessService.updateWeeklyBusinessEntry(req.params.recordId, { ...req.body, creator: req.user.name })); } catch (error) { handleApiError(res, error); } });
        app.delete('/api/business/weekly/:recordId', async (req, res) => { try { res.json(await dataWriter.deleteWeeklyBusinessEntry(req.params.recordId, req.body.rowIndex)); } catch (error) { handleApiError(res, error); } });

        // --- 【新增】佈告欄 API ---
        app.get('/api/announcements', async (req, res) => { try { const data = await announcementReader.getAnnouncements(); res.json({ success: true, data }); } catch (error) { handleApiError(res, error); } });
        app.post('/api/announcements', async (req, res) => { try { const data = { ...req.body, creator: req.user.name }; const result = await announcementWriter.createAnnouncement(data); res.json(result); } catch (error) { handleApiError(res, error); } });
        app.put('/api/announcements/:id', async (req, res) => { try { const result = await announcementWriter.updateAnnouncement(req.params.id, req.body); res.json(result); } catch (error) { handleApiError(res, error); } });
        app.delete('/api/announcements/:id', async (req, res) => { try { const result = await announcementWriter.deleteAnnouncement(req.params.id); res.json(result); } catch (error) { handleApiError(res, error); } });

        // --- Calendar & 系統 API ---
        app.post('/api/calendar/events', async (req, res) => { try { res.json(await calendarService.createCalendarEvent(req.body)); } catch (error) { handleApiError(res, error); } });
        app.get('/api/config', async (req, res) => { try { res.json(await systemReader.getSystemConfig()); } catch (error) { handleApiError(res, error); } });
        app.post('/api/cache/invalidate', async (req, res) => { try { systemReader.invalidateCache(); res.json({ success: true, message: '後端快取已清除' }); } catch (error) { handleApiError(res, error); } });
        
        // --- AI API ---
        app.post('/api/companies/:companyName/generate-profile', async (req, res) => {
            try {
                const { companyName } = req.params;
                const { userKeywords } = req.body;
                const researchPrompt = `你是一位市場研究員，請提供關於台灣公司「${decodeURIComponent(companyName)}」的詳細背景資料。使用者線索：「${userKeywords || '無'}」。請整合官網、新聞等資訊，涵蓋其主要業務、核心產品、產業地位與特色。`;
                const researchResult = await geminiFlash.generateContent(researchPrompt);
                const researchText = await researchResult.response.text();
                
                const formattingPrompt = `根據以下「原始文本」，提取資訊並生成一個 JSON 物件，格式為: {"introduction": "...", "industry": "...", "products_services": "...", "key_features": "..."}。你的回應只能是JSON。原始文本:\n---\n${researchText}\n---`;
                const formatResult = await geminiFlash.generateContent(formattingPrompt);
                const jsonText = (await formatResult.response.text()).match(/\{[\s\S]*\}/)[0];
                res.json({ success: true, data: JSON.parse(jsonText) });
            } catch (error) { handleApiError(res, error); }
        });

        // ==================== 錯誤處理 ====================
        app.use((req, res) => res.status(404).json({ error: 'API端點不存在' }));
        app.use((err, req, res, next) => { console.error('💥 伺服器錯誤:', err.stack); res.status(500).json({ error: '伺服器內部錯誤' }); });

        // ==================== 伺服器啟動 ====================
        app.listen(config.PORT, () => { console.log(`🚀 CRM 系統已在 http://localhost:${config.PORT} 啟動`); });

    } catch (error) {
        console.error('❌ 系統啟動失敗:', error.message);
        process.exit(1);
    }
}

startServer();