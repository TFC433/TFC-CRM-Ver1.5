// data/contact-reader.js

const BaseReader = require('./base-reader');

/**
 * 專門負責讀取所有與「聯絡人」相關資料的類別
 * (包含潛在客戶、已建檔聯絡人、關聯等)
 */
class ContactReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
    }

    /**
     * 取得原始名片資料 (潛在客戶)
     * @param {number} [limit=2000] - 讀取上限
     * @returns {Promise<Array<object>>}
     */
    async getContacts(limit = 2000) {
        const cacheKey = 'contacts';
        const range = `${this.config.SHEETS.CONTACTS}!A:Y`;

        const rowParser = (row, index) => ({
            rowIndex: index + 2,
            createdTime: row[this.config.CONTACT_FIELDS.TIME] || '',
            name: row[this.config.CONTACT_FIELDS.NAME] || '',
            company: row[this.config.CONTACT_FIELDS.COMPANY] || '',
            position: row[this.config.CONTACT_FIELDS.POSITION] || '',
            department: row[this.config.CONTACT_FIELDS.DEPARTMENT] || '',
            phone: row[this.config.CONTACT_FIELDS.PHONE] || '',
            mobile: row[this.config.CONTACT_FIELDS.MOBILE] || '',
            email: row[this.config.CONTACT_FIELDS.EMAIL] || '',
            website: row[this.config.CONTACT_FIELDS.WEBSITE] || '',
            address: row[this.config.CONTACT_FIELDS.ADDRESS] || '',
            confidence: row[this.config.CONTACT_FIELDS.CONFIDENCE] || '',
            driveLink: row[this.config.CONTACT_FIELDS.DRIVE_LINK] || '',
            status: row[this.config.CONTACT_FIELDS.STATUS] || ''
        });
        
        const sorter = (a, b) => {
            const dateA = new Date(a.createdTime);
            const dateB = new Date(b.createdTime);
            if (isNaN(dateB)) return -1;
            if (isNaN(dateA)) return 1;
            return dateB - dateA;
        };

        const allData = await this._fetchAndCache(cacheKey, range, rowParser, sorter);
        
        const filteredData = allData.filter(contact => 
            (contact.name || contact.company) && 
            contact.status !== this.config.CONSTANTS.CONTACT_STATUS.UPGRADED
        );
        
        return filteredData.slice(0, limit);
    }

    /**
     * 取得聯絡人總表 (已建檔聯絡人)
     * @returns {Promise<Array<object>>}
     */
    async getContactList() {
        const cacheKey = 'contactList';
        const range = `${this.config.SHEETS.CONTACT_LIST}!A:M`;

        const rowParser = (row) => ({
            contactId: row[0] || '',
            sourceId: row[1] || '',
            name: row[2] || '',
            companyId: row[3] || '',
            department: row[4] || '',
            position: row[5] || '',
            mobile: row[6] || '',
            phone: row[7] || '',
            email: row[8] || ''
        });

        return this._fetchAndCache(cacheKey, range, rowParser);
    }
    
    /**
     * 讀取並快取所有的「機會-聯絡人」關聯
     * @returns {Promise<Array<object>>}
     */
    async getAllOppContactLinks() {
        const cacheKey = 'oppContactLinks';
        const range = `${this.config.SHEETS.OPPORTUNITY_CONTACT_LINK}!A:F`;

        const rowParser = (row) => ({
            linkId: row[this.config.OPP_CONTACT_LINK_FIELDS.LINK_ID] || '',
            opportunityId: row[this.config.OPP_CONTACT_LINK_FIELDS.OPPORTUNITY_ID] || '',
            contactId: row[this.config.OPP_CONTACT_LINK_FIELDS.CONTACT_ID] || '',
            createTime: row[this.config.OPP_CONTACT_LINK_FIELDS.CREATE_TIME] || '',
            status: row[this.config.OPP_CONTACT_LINK_FIELDS.STATUS] || '',
            creator: row[this.config.OPP_CONTACT_LINK_FIELDS.CREATOR] || '',
        });

        return this._fetchAndCache(cacheKey, range, rowParser);
    }

    /**
     * 根據機會 ID 取得關聯的聯絡人詳細資料
     * @param {string} opportunityId 
     * @returns {Promise<Array<object>>}
     */
    async getLinkedContacts(opportunityId) {
        const allLinks = await this.getAllOppContactLinks();
        const linkedContactIds = new Set();
        
        for (const link of allLinks) {
            if (link.opportunityId === opportunityId && link.status === 'active') {
                linkedContactIds.add(link.contactId);
            }
        }
        
        if (linkedContactIds.size === 0) return [];
        
        const [allContacts, allCompanies] = await Promise.all([
            this.getContactList(),
            this.getCompanyList() // 依賴 CompanyReader
        ]);

        const companyNameMap = new Map(allCompanies.map(c => [c.companyId, c.companyName]));

        const linkedContacts = allContacts
            .filter(contact => linkedContactIds.has(contact.contactId))
            .map(contact => ({
                ...contact,
                companyName: companyNameMap.get(contact.companyId) || contact.companyId
            }));
        
        return linkedContacts;
    }

    /**
     * 搜尋潛在客戶並分頁
     * @param {string} query 
     * @param {number} [page=1] 
     * @returns {Promise<object>}
     */
    async searchContacts(query, page = 1) {
        let contacts = await this.getContacts();
        if (query) {
            const searchTerm = query.toLowerCase();
            contacts = contacts.filter(c =>
                (c.name && c.name.toLowerCase().includes(searchTerm)) ||
                (c.company && c.company.toLowerCase().includes(searchTerm))
            );
        }
        const pageSize = this.config.PAGINATION.CONTACTS_PER_PAGE;
        const startIndex = (page - 1) * pageSize;
        const paginated = contacts.slice(startIndex, startIndex + pageSize);
        return {
            data: paginated,
            pagination: { current: page, total: Math.ceil(contacts.length / pageSize), totalItems: contacts.length, hasNext: (startIndex + pageSize) < contacts.length, hasPrev: page > 1 }
        };
    }

    /**
     * 搜尋已建檔聯絡人並分頁
     * @param {string} query 
     * @param {number} [page=1] 
     * @returns {Promise<object>}
     */
    async searchContactList(query, page = 1) {
        const [allContacts, allCompanies] = await Promise.all([
            this.getContactList(),
            this.getCompanyList() // 依賴 CompanyReader
        ]);
    
        const companyNameMap = new Map(allCompanies.map(c => [c.companyId, c.companyName]));
    
        let contacts = allContacts.map(contact => ({
            ...contact,
            companyName: companyNameMap.get(contact.companyId) || contact.companyId 
        }));
    
        if (query) {
            const searchTerm = query.toLowerCase();
            contacts = contacts.filter(c =>
                (c.name && c.name.toLowerCase().includes(searchTerm)) ||
                (c.companyName && c.companyName.toLowerCase().includes(searchTerm))
            );
        }
        
        const pageSize = this.config.PAGINATION.CONTACTS_PER_PAGE;
        const startIndex = (page - 1) * pageSize;
        const paginated = contacts.slice(startIndex, startIndex + pageSize);
        return {
            data: paginated,
            pagination: { current: page, total: Math.ceil(contacts.length / pageSize), totalItems: contacts.length, hasNext: (startIndex + pageSize) < contacts.length, hasPrev: page > 1 }
        };
    }

    // Phase 2 中，這個方法會被移除，改為依賴注入
    async getCompanyList() {
        const CompanyReader = require('./company-reader'); // 臨時引用
        const companyReader = new CompanyReader(this.sheets);
        return companyReader.getCompanyList();
    }
}

module.exports = ContactReader;