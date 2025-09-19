// services/weekly-business-service.js

/**
 * 專門負責處理與「週間業務」相關的業務邏輯
 */
class WeeklyBusinessService {
    /**
     * @param {object} services - 包含所有已初始化服務的容器
     */
    constructor(services) {
        this.weeklyBusinessReader = services.weeklyBusinessReader;
        this.dataWriter = services.dataWriter;
        this.dateHelpers = services.dateHelpers;
    }

    /**
     * 按週次聚合業務紀錄
     * @returns {Promise<Array<object>>}
     */
    async getWeeklyBusinessByWeek() {
        const allEntriesResult = await this.weeklyBusinessReader.getAllWeeklyBusiness('', 1, true);
        const allEntries = allEntriesResult.data || [];
        
        const weeks = new Map();

        allEntries.forEach(entry => {
            try {
                const weekId = entry.weekId;
                if (!weekId || !/^\d{4}-W\d{2}$/.test(weekId)) return;

                if (!weeks.has(weekId)) {
                    weeks.set(weekId, {
                        id: weekId,
                        ...this.dateHelpers.getWeekInfo(weekId),
                        entries: []
                    });
                }
                
                const dateString = entry['日期'];
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return;

                const [year, month, day] = dateString.split('-').map(Number);
                const entryDateUTC = new Date(Date.UTC(year, month - 1, day));
                if (isNaN(entryDateUTC.getTime())) return;

                const dayOfWeek = entryDateUTC.getUTCDay();
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    entry.day = dayOfWeek;
                    weeks.get(weekId).entries.push(entry);
                }
            } catch(e) {
                console.warn(`⚠️ [WeeklyBusinessService] 解析業務紀錄時發生錯誤: `, entry, e);
            }
        });
        
        const sortedWeeks = Array.from(weeks.values()).sort((a, b) => b.id.localeCompare(a.id));
        
        sortedWeeks.forEach(week => {
            week.summaryCount = week.entries.filter(e => e['重點摘要'] && e['重點摘要'].trim() !== '').length;
        });

        return sortedWeeks;
    }

    /**
     * 獲取單一週的詳細資料
     * @param {string} weekId 
     * @returns {Promise<object>}
     */
    async getWeeklyDetails(weekId) {
        const allWeeks = await this.getWeeklyBusinessByWeek();
        const weekData = allWeeks.find(week => week.id === weekId);
        if (weekData) {
            return weekData;
        }
        // 如果找不到，也回傳一個帶有正確日期資訊的空週報
        return {
            id: weekId,
            ...this.dateHelpers.getWeekInfo(weekId),
            entries: []
        };
    }
    
    /**
     * 產生「新增週報」時的選項
     * @returns {Promise<Array<object>>}
     */
    async getWeekOptions() {
        const today = new Date();
        const prevWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        const allWeeks = await this.getWeeklyBusinessByWeek();
        const existingWeekIds = new Set(allWeeks.map(w => w.id));

        const options = [
            { id: this.dateHelpers.getWeekId(prevWeek), label: '上一週' },
            { id: this.dateHelpers.getWeekId(today),    label: '本週' },
            { id: this.dateHelpers.getWeekId(nextWeek), label: '下一週' }
        ];

        options.forEach(opt => {
            opt.disabled = existingWeekIds.has(opt.id);
        });

        return options;
    }

    /**
     * 建立一筆週間業務紀錄 (包含 weekId 計算)
     * @param {object} data 
     * @returns {Promise<object>}
     */
    async createWeeklyBusinessEntry(data) {
        const entryDate = new Date(data.date);
        const weekId = this.dateHelpers.getWeekId(entryDate);
        const fullData = { ...data, weekId };
        return this.dataWriter.createWeeklyBusinessEntry(fullData);
    }

    /**
     * 更新一筆週間業務紀錄 (包含 weekId 計算)
     * @param {string} recordId 
     * @param {object} data 
     * @returns {Promise<object>}
     */
    async updateWeeklyBusinessEntry(recordId, data) {
        const entryDate = new Date(data.date);
        const weekId = this.dateHelpers.getWeekId(entryDate);
        const fullData = { ...data, weekId };
        return this.dataWriter.updateWeeklyBusinessEntry(recordId, fullData);
    }
}

module.exports = WeeklyBusinessService;