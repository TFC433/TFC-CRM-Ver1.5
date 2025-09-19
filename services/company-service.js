// services/company-service.js

/**
 * 專門負責處理與「公司」相關的複雜業務邏輯
 */
class CompanyService {
    /**
     * @param {object} services - 包含所有已初始化服務的容器
     */
    constructor(services) {
        this.companyReader = services.companyReader;
        this.contactReader = services.contactReader;
        this.opportunityReader = services.opportunityReader;
    }

    /**
     * 高效獲取公司的完整詳細資料
     * @param {string} companyName 
     * @returns {Promise<object>}
     */
    async getCompanyDetails(companyName) {
        const [allCompanies, allContacts, allOpportunities, allPotentialContacts] = await Promise.all([
            this.companyReader.getCompanyList(),
            this.contactReader.getContactList(),
            this.opportunityReader.getOpportunities(),
            this.contactReader.getContacts() // 潛在客戶
        ]);

        const normalizedCompanyName = companyName.toLowerCase().trim();

        const company = allCompanies.find(c => c.companyName.toLowerCase().trim() === normalizedCompanyName);
        if (!company) {
            // 如果在正式公司列表找不到，則嘗試從潛在客戶中尋找，回傳一個特殊標記的物件
            const potentialMatch = allPotentialContacts.find(pc => pc.company && pc.company.toLowerCase().trim() === normalizedCompanyName);
            if (potentialMatch) {
                return {
                    companyInfo: { companyName: potentialMatch.company, isPotential: true },
                    contacts: [],
                    opportunities: [],
                    potentialContacts: allPotentialContacts.filter(pc => pc.company && pc.company.toLowerCase().trim() === normalizedCompanyName)
                };
            }
            throw new Error(`找不到公司: ${companyName}`);
        }

        // 在記憶體中進行篩選
        const relatedContacts = allContacts.filter(c => c.companyId === company.companyId);
        const relatedOpportunities = allOpportunities.filter(o => o.customerCompany.toLowerCase().trim() === normalizedCompanyName);
        const relatedPotentialContacts = allPotentialContacts.filter(pc => 
            pc.company && pc.company.toLowerCase().trim() === normalizedCompanyName
        );

        console.log(`✅ [CompanyService] 公司資料整合完畢: ${relatedContacts.length} 位聯絡人, ${relatedOpportunities.length} 個機會, ${relatedPotentialContacts.length} 位潛在聯絡人`);
        
        return {
            companyInfo: company,
            contacts: relatedContacts,
            opportunities: relatedOpportunities,
            potentialContacts: relatedPotentialContacts
        };
    }
}

module.exports = CompanyService;