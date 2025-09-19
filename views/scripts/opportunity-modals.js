// views/scripts/opportunity-modals.js
// 職責：管理所有與「機會」相關的彈出視窗的顯示與互動邏輯

// ==================== 全域變數 (Modal 專用) ====================
let allSearchedContacts = [];
let companySearchTimeout;

// ==================== Modal 顯示/控制函式 ====================

async function showNewOpportunityModal() {
    showModal('new-opportunity-modal');
    document.getElementById('new-opportunity-form').reset();
    document.getElementById('search-company-input').value = '';
    
    const searchResults = document.getElementById('company-search-results');
    if(searchResults) {
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
    }
    
    document.getElementById('main-contact').innerHTML = '<option value="">請先搜尋並選擇公司...</option>';
    document.getElementById('assignee').value = getCurrentUser();

    const existingRadio = document.querySelector('input[name="contact-source"][value="existing"]');
    if (existingRadio) existingRadio.checked = true;
    const manualRadio = document.querySelector('input[name="contact-source"][value="manual"]');
    if (manualRadio) manualRadio.checked = false;

    toggleContactInput(); 

    const searchInput = document.getElementById('search-company-input');
    searchInput.removeEventListener('keyup', handleCompanySearch);
    searchInput.addEventListener('keyup', handleCompanySearch);
}

async function editOpportunity(opportunityId) {
    let opportunity = null;

    if (window.opportunitiesData && opportunitiesData.length > 0) {
        opportunity = opportunitiesData.find(opp => opp.opportunityId === opportunityId);
    }

    if (!opportunity && window.kanbanRawData && Object.keys(kanbanRawData).length > 0) {
        for (const stageId in kanbanRawData) {
            const foundOpp = kanbanRawData[stageId].opportunities.find(o => o.opportunityId === opportunityId);
            if (foundOpp) {
                opportunity = foundOpp;
                break;
            }
        }
    }
    
    if (!opportunity) {
        try {
            showLoading('正在獲取最新資料...');
            const result = await authedFetch(`/api/opportunities?q=${opportunityId}`);
            if (result.data && result.data.length > 0) {
                opportunity = result.data[0];
            }
        } catch(error) {
             if (error.message !== 'Unauthorized') {
                showNotification('遠端獲取資料失敗', 'error');
             }
             hideLoading();
             return;
        } finally {
            hideLoading();
        }
    }

    if (!opportunity) {
        showNotification('找不到該筆機會的資料，請嘗試刷新頁面', 'error');
        return;
    }
    
    showModal('edit-opportunity-modal');
    document.getElementById('edit-opportunity-rowIndex').value = opportunity.rowIndex;
    document.getElementById('edit-opportunity-name').value = opportunity.opportunityName;
    document.getElementById('edit-customer-company').value = opportunity.customerCompany;
    document.getElementById('edit-main-contact').value = opportunity.mainContact;
    document.getElementById('edit-expected-close-date').value = opportunity.expectedCloseDate;
    document.getElementById('edit-opportunity-value').value = opportunity.opportunityValue;
    document.getElementById('edit-opportunity-notes').value = opportunity.notes;
    populateSelect('edit-opportunity-type', systemConfig['機會種類'], opportunity.opportunityType);
    populateSelect('edit-opportunity-source', systemConfig['機會來源'], opportunity.opportunitySource);
    populateSelect('edit-current-stage', systemConfig['機會階段'], opportunity.currentStage);
    populateSelect('edit-assignee', systemConfig['團隊成員'], opportunity.assignee);
    populateCountyDropdown('edit-company-county');
    document.querySelector('#edit-company-county option').textContent = '如需修改請選擇新縣市...';
}

function showLinkContactModal(opportunityId) {
    showModal('link-contact-modal');
    const container = document.getElementById('link-contact-content-container');
    const tabs = document.querySelectorAll('.link-contact-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderLinkContactTabContent(tab.dataset.tab, container);
        });
    });

    renderLinkContactTabContent('from-potential', container);
}

function showLinkOpportunityModal(currentOppId, currentOppRowIndex) {
    showModal('link-opportunity-modal');
    const searchInput = document.getElementById('search-opportunity-to-link-input');
    const resultsContainer = document.getElementById('opportunity-to-link-results');
    
    const performSearch = async (query) => {
        resultsContainer.innerHTML = '<div class="loading show"><div class="spinner"></div></div>';
        try {
            const result = await authedFetch(`/api/opportunities?q=${encodeURIComponent(query)}`);
            const opportunities = result.data.filter(opp => opp.opportunityId !== currentOppId);

            if (opportunities.length > 0) {
                resultsContainer.innerHTML = opportunities.map(opp => `
                    <div class="kanban-card" style="cursor: pointer;" onclick='handleLinkOpportunity(${currentOppRowIndex}, "${opp.opportunityId}")'>
                        <div class="card-title">${opp.opportunityName}</div>
                        <div class="card-company">${opp.customerCompany}</div>
                    </div>
                `).join('');
            } else {
                resultsContainer.innerHTML = `<div class="alert alert-warning">找不到符合的機會</div>`;
            }
        } catch(error) {
            if(error.message !== 'Unauthorized') resultsContainer.innerHTML = `<div class="alert alert-error">搜尋失敗</div>`;
        }
    };
    
    searchInput.onkeyup = (e) => handleSearch(() => performSearch(e.target.value.trim()));
    performSearch(''); // 立即執行一次空搜尋以載入預設列表
}


// ==================== Modal 內部輔助與事件處理 ====================

function handleCompanySearch() {
    const query = document.getElementById('search-company-input').value.trim();
    clearTimeout(companySearchTimeout);
    companySearchTimeout = setTimeout(() => {
        if (query.length >= 1) searchCompanies(query);
        else document.getElementById('company-search-results').style.display = 'none';
    }, 400);
}

async function searchCompanies(query) {
    try {
        const result = await authedFetch(`/api/contacts?q=${encodeURIComponent(query)}`);
        allSearchedContacts = result.data || [];
        renderCompanySearchResults(allSearchedContacts);
    } catch (error) { 
        if (error.message !== 'Unauthorized') console.error('❌ 搜尋公司失敗:', error);
    }
}

function renderCompanySearchResults(contacts) {
    const resultsContainer = document.getElementById('company-search-results');
    if (contacts.length === 0) {
        resultsContainer.innerHTML = '<div class="company-result-item" style="cursor: default;">未找到匹配的公司</div>';
        resultsContainer.style.display = 'block';
        return;
    }
    const companiesMap = new Map();
    contacts.forEach(contact => {
        if (contact.company && !companiesMap.has(contact.company)) {
            companiesMap.set(contact.company, contact);
        }
    });
    let html = '<div class="company-results">';
    companiesMap.forEach((firstContact, companyName) => {
        html += `<div class="company-result-item" onclick='selectCompany(${JSON.stringify(companyName)}, ${JSON.stringify(firstContact)})'>${companyName}</div>`;
    });
    html += '</div>';
    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
}

function selectCompany(companyName, firstContactData) {
    document.getElementById('search-company-input').value = companyName;
    document.getElementById('company-search-results').style.display = 'none';
    populateCountyFromAddress(firstContactData, 'existing-company-county');
    
    const contactSelect = document.getElementById('main-contact');
    const companyContacts = allSearchedContacts.filter(c => c.company === companyName);
    contactSelect.innerHTML = '<option value="">請選擇聯絡人...</option>';
    companyContacts.forEach(contact => {
        const option = document.createElement('option');
        option.value = JSON.stringify({ name: contact.name, phone: contact.phone || contact.mobile, email: contact.email });
        option.textContent = `${contact.name} (${contact.position || '職位未知'})`;
        contactSelect.appendChild(option);
    });
}

function toggleContactInput() {
    const contactSource = document.querySelector('input[name="contact-source"]:checked').value;
    const existingSection = document.getElementById('existing-contact-section');
    const manualSection = document.getElementById('manual-contact-section');
    const manualCompanyInput = document.getElementById('customer-company');

    if (contactSource === 'existing') {
        existingSection.style.display = 'block';
        manualSection.style.display = 'none';
        manualCompanyInput.required = false;
    } else { // manual
        existingSection.style.display = 'none';
        manualSection.style.display = 'block';
        manualCompanyInput.required = true;
    }
}

function populateCountyDropdown(selectId) {
    const counties = ["臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣"];
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">請選擇縣市...</option>';
    counties.forEach(county => {
        select.innerHTML += `<option value="${county}">${county}</option>`;
    });
}

function populateSelect(selectId, options, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">請選擇...</option>';
    (options || []).forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.note || option.value;
        if (option.value === selectedValue) optionElement.selected = true;
        select.appendChild(optionElement);
    });
}

function renderLinkContactTabContent(tabName, container) {
    let html = '';
    if (tabName === 'from-potential') {
        html = `
            <div class="form-group">
                <label class="form-label">搜尋名片 (潛在客戶)</label>
                <input type="text" class="form-input" id="search-potential-contact-input" placeholder="輸入姓名或公司進行搜尋...">
            </div>
            <div id="potential-contact-results" class="search-result-list" style="max-height: 300px; overflow-y: auto;"></div>
        `;
        container.innerHTML = html;
        document.getElementById('search-potential-contact-input').addEventListener('keyup', (e) => handleSearch(() => searchAndRenderContacts('potential', e.target.value)));
        searchAndRenderContacts('potential', '');

    } else if (tabName === 'from-existing') {
        html = `
            <div class="form-group">
                <label class="form-label">搜尋已建檔聯絡人</label>
                <input type="text" class="form-input" id="search-existing-contact-input" placeholder="輸入姓名或公司進行搜尋...">
            </div>
            <div id="existing-contact-results" class="search-result-list" style="max-height: 300px; overflow-y: auto;"></div>
        `;
        container.innerHTML = html;
        document.getElementById('search-existing-contact-input').addEventListener('keyup', (e) => handleSearch(() => searchAndRenderContacts('existing', e.target.value)));
        searchAndRenderContacts('existing', '');

    } else if (tabName === 'create-new') {
        html = `
            <form id="create-and-link-contact-form">
                <div class="form-row">
                    <div class="form-group"><label class="form-label">姓名 *</label><input type="text" class="form-input" name="name" required></div>
                    <div class="form-group"><label class="form-label">職位</label><input type="text" class="form-input" name="position"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">手機</label><input type="text" class="form-input" name="mobile"></div>
                    <div class="form-group"><label class="form-label">公司電話</label><input type="text" class="form-input" name="phone"></div>
                </div>
                <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" name="email"></div>
                <button type="submit" class="submit-btn">建立並關聯</button>
            </form>
        `;
        container.innerHTML = html;
        document.getElementById('create-and-link-contact-form').addEventListener('submit', handleCreateAndLinkContact);
    }
}

async function searchAndRenderContacts(type, query) {
    const resultsContainer = document.getElementById(type === 'potential' ? 'potential-contact-results' : 'existing-contact-results');
    if (query === null) {
         resultsContainer.innerHTML = '';
         return;
    }
    resultsContainer.innerHTML = '<div class="loading show"><div class="spinner"></div></div>';
    
    const apiUrl = type === 'existing' 
        ? `/api/contact-list?q=${encodeURIComponent(query)}` 
        : `/api/contacts?q=${encodeURIComponent(query)}`;

    try {
        const result = await authedFetch(apiUrl);
        
        if (result.data && result.data.length > 0) {
            resultsContainer.innerHTML = result.data.map(contact => {
                const companyDisplay = contact.companyName || contact.company || '公司未知';
                return `
                    <div class="kanban-card" style="cursor: pointer;" onclick='handleLinkContact(${JSON.stringify(contact)}, "${type}")'>
                        <div class="card-title">${contact.name}</div>
                        <div class="card-company">${companyDisplay} - ${contact.position || '職位未知'}</div>
                    </div>
                `;
            }).join('');
        } else {
            resultsContainer.innerHTML = '<div class="alert alert-info">找不到符合的聯絡人</div>';
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            resultsContainer.innerHTML = '<div class="alert alert-error">搜尋時發生錯誤</div>';
        }
    }
}

async function handleLinkContact(contactData, type) {
    showLoading('正在關聯聯絡人...');

    const payload = {
        name: contactData.name,
        position: contactData.position,
        mobile: contactData.mobile,
        phone: contactData.phone,
        email: contactData.email,
        rowIndex: contactData.rowIndex, 
        company: contactData.companyName || contactData.company,
        contactId: contactData.contactId
    };

    try {
        const result = await authedFetch(`/api/opportunities/${currentDetailOpportunityId}/contacts`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!result.success) throw new Error(result.error || '後端處理失敗');
        
        showNotification('聯絡人關聯成功！', 'success');
        closeModal('link-contact-modal');
        await loadOpportunityDetailPage(currentDetailOpportunityId);
    } catch (error) {
        if (error.message !== 'Unauthorized') showNotification(`關聯失敗: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function handleCreateAndLinkContact(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const contactData = Object.fromEntries(formData.entries());
    await handleLinkContact(contactData, 'new');
}

async function handleLinkOpportunity(currentOppRowIndex, parentOppId) {
    showLoading('正在建立關聯...');
    try {
        const updateData = { parentOpportunityId: parentOppId };
        const result = await authedFetch(`/api/opportunities/${currentOppRowIndex}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });

        if (result.success) {
            showNotification('母機會關聯成功！', 'success');
            closeModal('link-opportunity-modal');
            await loadOpportunityDetailPage(currentDetailOpportunityId);
        } else {
            throw new Error(result.error || '關聯失敗');
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') showNotification(`關聯失敗: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}


// ==================== 表單提交監聽 ====================

document.addEventListener('submit', async function(e) {
    if (e.target.id === 'new-opportunity-form') {
        e.preventDefault();
        
        try {
            const contactSource = document.querySelector('input[name="contact-source"]:checked').value;
            
            if (contactSource === 'existing') {
                const companyName = document.getElementById('search-company-input').value;
                const selectedContactJSON = document.getElementById('main-contact').value;
                if (!companyName || !selectedContactJSON) {
                    throw new Error("請先搜尋公司，並從下拉選單中選擇一位聯絡人");
                }
            } else { 
                const companyName = document.getElementById('customer-company').value;
                if (!companyName) throw new Error("手動輸入模式下，客戶公司為必填項");
            }

            showLoading('正在建立機會案件...');

            let opportunityData = {
                opportunityName: document.getElementById('opportunity-name').value,
                opportunityType: document.getElementById('opportunity-type').value,
                opportunitySource: document.getElementById('opportunity-source').value,
                currentStage: document.getElementById('current-stage').value,
                assignee: document.getElementById('assignee').value,
                expectedCloseDate: document.getElementById('expected-close-date').value,
                opportunityValue: document.getElementById('opportunity-value').value,
                notes: document.getElementById('opportunity-notes').value
            };

            if (contactSource === 'existing') {
                opportunityData.customerCompany = document.getElementById('search-company-input').value;
                opportunityData.county = document.getElementById('existing-company-county').value;
                const contactData = JSON.parse(document.getElementById('main-contact').value);
                opportunityData.mainContact = contactData.name;
                opportunityData.contactPhone = contactData.phone;
            } else {
                opportunityData.customerCompany = document.getElementById('customer-company').value;
                opportunityData.mainContact = document.getElementById('manual-contact').value;
                opportunityData.contactPhone = document.getElementById('manual-phone').value;
                opportunityData.county = document.getElementById('company-county').value;
            }

            const result = await authedFetch('/api/opportunities', { method: 'POST', body: JSON.stringify(opportunityData) });
            
            if (result.success && result.data) {
                closeModal('new-opportunity-modal');
                if(window.pageConfig) {
                    window.pageConfig.opportunities.loaded = false;
                    window.pageConfig.dashboard.loaded = false; 
                }
                showNotification(result.message || '機會案件建立成功！', 'success');
                 navigateTo('opportunities');
            } else {
                throw new Error(result.details || '建立失敗，後端未回傳有效資料');
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') showNotification(`建立機會失敗: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    }

    if (e.target.id === 'edit-opportunity-form') {
        e.preventDefault();
        showLoading('正在儲存編輯...');
        try {
            const rowIndex = document.getElementById('edit-opportunity-rowIndex').value;
            const modifier = getCurrentUser();
            const companyName = document.getElementById('edit-customer-company').value;
            const newCounty = document.getElementById('edit-company-county').value;
            const updateOpportunityData = { opportunityName: document.getElementById('edit-opportunity-name').value, opportunityType: document.getElementById('edit-opportunity-type').value, opportunitySource: document.getElementById('edit-opportunity-source').value, currentStage: document.getElementById('edit-current-stage').value, assignee: document.getElementById('edit-assignee').value, expectedCloseDate: document.getElementById('edit-expected-close-date').value, opportunityValue: document.getElementById('edit-opportunity-value').value, notes: document.getElementById('edit-opportunity-notes').value, modifier: modifier };
            
            const promises = [authedFetch(`/api/opportunities/${rowIndex}`, { method: 'PUT', body: JSON.stringify(updateOpportunityData) })];
            
            if (newCounty) {
                const encodedCompanyName = encodeURIComponent(companyName);
                promises.push(authedFetch(`/api/companies/${encodedCompanyName}`, { method: 'PUT', body: JSON.stringify({ county: newCounty }) }));
            }
            
            await Promise.all(promises);

            closeModal('edit-opportunity-modal');
            
            // 【修改】判斷當前頁面，決定刷新還是導航
            const detailPage = document.getElementById('page-opportunity-details');
            if (detailPage && detailPage.style.display === 'block' && window.currentDetailOpportunityId) {
                await loadOpportunityDetailPage(window.currentDetailOpportunityId); // 刷新詳細頁
            } else {
                if(window.pageConfig) {
                    window.pageConfig.opportunities.loaded = false;
                    window.pageConfig.dashboard.loaded = false;
                }
                navigateTo('opportunities'); // 導航到列表頁
            }
            
            showNotification('機會案件與公司資訊更新成功！', 'success');
        } catch (error) {
            if (error.message !== 'Unauthorized') showNotification(`更新失敗: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    }
});