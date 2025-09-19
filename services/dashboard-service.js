// services/dashboard-service.js

/**
 * 專門負責處理所有儀表板資料組合的業務邏輯
 */
class DashboardService {
    /**
     * @param {object} services - 包含所有已初始化服務的容器
     */
    constructor(services) {
        this.config = services.config;
        this.opportunityReader = services.opportunityReader;
        this.contactReader = services.contactReader;
        this.interactionReader = services.interactionReader;
        this.eventLogReader = services.eventLogReader;
        this.systemReader = services.systemReader;
        this.weeklyBusinessReader = services.weeklyBusinessReader;
        this.calendarService = services.calendarService;
        this.dateHelpers = services.dateHelpers; // 假設 dateHelpers 也被加入容器
    }

    async getDashboardData() {
        console.log('📊 [DashboardService] 執行主儀表板資料整合...');
        const [
            opportunities, 
            contacts, 
            interactions, 
            calendarData, 
            eventLogs, 
            systemConfig, 
            weeklyBusiness
        ] = await Promise.all([
            this.opportunityReader.getOpportunities(),
            this.contactReader.getContacts(),
            this.interactionReader.getInteractions(),
            this.calendarService.getThisWeekEvents(),
            this.eventLogReader.getEventLogs(),
            this.systemReader.getSystemConfig(),
            this.weeklyBusinessReader.getAllWeeklyBusiness('', 1, true)
        ]);
        
        const stats = {
            contactsCount: contacts.length,
            opportunitiesCount: opportunities.length,
            eventLogsCount: eventLogs.length,
            todayEventsCount: calendarData.todayCount,
            weekEventsCount: calendarData.weekCount
        };

        const followUps = this._getFollowUpOpportunities(opportunities, interactions);
        stats.followUpCount = followUps.length;
        
        const kanbanData = this._prepareKanbanData(opportunities, systemConfig);
        const recentActivity = this._prepareRecentActivity(interactions, contacts, opportunities, 5);

        const today = new Date();
        const thisWeekId = this.dateHelpers.getWeekId(today);
        const weekInfo = this.dateHelpers.getWeekInfo(thisWeekId);

        const thisWeeksEntries = (weeklyBusiness.data || []).filter(entry => entry.weekId === thisWeekId);
        
        const thisWeekInfo = {
            weekId: thisWeekId,
            title: `(${weekInfo.month}第${weekInfo.weekOfMonth}週，${weekInfo.shortDateRange})`
        };

        return {
            stats,
            kanbanData,
            followUpList: followUps.slice(0, 5),
            todaysAgenda: calendarData.todayEvents,
            recentActivity,
            weeklyBusiness: thisWeeksEntries,
            thisWeekInfo
        };
    }

    async getEventsDashboardData() {
        const [eventLogs, opportunities] = await Promise.all([
            this.eventLogReader.getEventLogs(),
            this.opportunityReader.getOpportunities(),
        ]);
        
        const opportunityMap = new Map(opportunities.map(opp => [opp.opportunityId, opp.opportunityName]));

        const eventList = eventLogs.map(log => ({
            ...log,
            opportunityName: opportunityMap.get(log.opportunityId) || log.opportunityId
        }));

        return {
            eventList,
            chartData: {
                trend: this._prepareTrendData(eventLogs),
                probability: this._prepareProbabilityData(eventLogs),
                size: this._prepareSizeData(eventLogs),
            }
        };
    }

    async getOpportunitiesDashboardData() {
        const [opportunities, systemConfig] = await Promise.all([
            this.opportunityReader.getOpportunities(),
            this.systemReader.getSystemConfig(),
        ]);

        return {
            chartData: {
                trend: this._prepareTrendData(opportunities),
                source: this._prepareOpportunitySourceData(opportunities),
                type: this._prepareOpportunityTypeData(opportunities),
                stage: this._prepareOpportunityStageData(opportunities, systemConfig),
            }
        };
    }

    async getContactsDashboardData() {
        const contacts = await this.contactReader.getContacts();
        return {
            chartData: {
                trend: this._prepareTrendData(contacts),
            }
        };
    }

    // 內部輔助函式 (從 google-services.js 遷移過來)
    _getFollowUpOpportunities(opportunities, interactions) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - this.config.FOLLOW_UP.DAYS_THRESHOLD);

        return opportunities.filter(opp => {
            if (opp.currentStatus !== '進行中' || !this.config.FOLLOW_UP.ACTIVE_STAGES.includes(opp.currentStage)) {
                return false;
            }
            const oppInteractions = interactions.filter(i => i.opportunityId === opp.opportunityId);
            if (oppInteractions.length === 0) {
                const createdDate = new Date(opp.createdTime);
                return createdDate < sevenDaysAgo;
            }
            const lastInteractionDate = new Date(oppInteractions.sort((a,b) => new Date(b.interactionTime) - new Date(a.interactionTime))[0].interactionTime);
            return lastInteractionDate < sevenDaysAgo;
        });
    }
    
    _prepareKanbanData(opportunities, systemConfig) {
        const stages = systemConfig['機會階段'] || [];
        const stageGroups = {};
        stages.forEach(stage => { stageGroups[stage.value] = { name: stage.note || stage.value, opportunities: [], count: 0 }; });
        opportunities.forEach(opp => {
            if (opp.currentStatus === '進行中') {
                const stageKey = opp.currentStage;
                if (stageGroups[stageKey]) {
                    stageGroups[stageKey].opportunities.push(opp);
                    stageGroups[stageKey].count++;
                }
            }
        });
        return stageGroups;
    }
    
    _prepareRecentActivity(interactions, contacts, opportunities, limit) {
        const interactionFeed = interactions.map(item => ({ type: 'interaction', timestamp: new Date(item.interactionTime || item.createdTime), data: item }));
        const contactFeed = contacts.map(item => ({ type: 'new_contact', timestamp: new Date(item.createdTime), data: item }));

        const combinedFeed = [...interactionFeed, ...contactFeed]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);

        const opportunityMap = new Map(opportunities.map(opp => [opp.opportunityId, opp.opportunityName]));
        
        return combinedFeed.map(item => {
            if (item.type === 'interaction') {
                return { ...item, data: { ...item.data, opportunityName: opportunityMap.get(item.data.opportunityId) || '未知機會' }};
            }
            return item;
        });
    }

    _prepareTrendData(data, days = 30) {
        const trend = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            trend[date.toISOString().split('T')[0]] = 0;
        }

        data.forEach(item => {
            if (item.createdTime) {
                try {
                    const itemDate = new Date(item.createdTime);
                    const dateString = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).toISOString().split('T')[0];
                    if (trend.hasOwnProperty(dateString)) trend[dateString]++;
                } catch(e) { /* ignore */ }
            }
        });
        return Object.entries(trend).sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB));
    }

    _prepareProbabilityData(eventLogs) {
        const counts = eventLogs.reduce((acc, log) => {
            const key = log.orderProbability || '未填寫';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([name, y]) => ({ name, y }));
    }

    _prepareSizeData(eventLogs) {
        const counts = eventLogs.reduce((acc, log) => {
            const key = log.companySize || '未填寫';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
    }

    _prepareOpportunitySourceData(opportunities) {
        const counts = opportunities.reduce((acc, opp) => {
            const key = opp.opportunitySource || '未填寫';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([name, y]) => ({ name, y }));
    }

    _prepareOpportunityTypeData(opportunities) {
        const counts = opportunities.reduce((acc, opp) => {
            const key = opp.opportunityType || '未分類';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([name, y]) => ({ name, y }));
    }

    _prepareOpportunityStageData(opportunities, systemConfig) {
        const stageMapping = new Map((systemConfig['機會階段'] || []).map(item => [item.value, item.note]));
        const counts = opportunities.reduce((acc, opp) => {
            if (opp.currentStatus === '進行中') {
                const key = stageMapping.get(opp.currentStage) || opp.currentStage || '未分類';
                acc[key] = (acc[key] || 0) + 1;
            }
            return acc;
        }, {});
        return Object.entries(counts);
    }
}

module.exports = DashboardService;