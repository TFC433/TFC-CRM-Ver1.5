// views/scripts/companies.js

// =============================================
// SECTION 1: 公司列表頁面 (Company List Page)
// =============================================

/**
 * 載入並渲染公司列表頁面的主函式
 */
async function loadCompaniesListPage() {
    const container = document.getElementById('page-companies');
    if (!container) return;

    // 1. 渲染頁面基本骨架
    container.innerHTML = `
        <div class="dashboard-widget">
            <div class="widget-header">
                <h2 class="widget-title">公司總覽</h2>
            </div>
            <div class="search-pagination" style="padding: 0 1.5rem 1rem;">
                <input type="text" class="search-box" id="company-list-search" placeholder="搜尋公司名稱...">
            </div>
            <div id="companies-list-content" class="widget-content">
                <div class="loading show"><div class="spinner"></div><p>載入公司列表中...</p></div>
            </div>
        </div>
    `;

    // 2. 獲取數據並渲染
    try {
        const result = await authedFetch(`/api/companies`);
        if (!result.success) throw new Error(result.error || '無法獲取公司列表');
        
        const allCompanies = result.data || [];
        
        window.allCompaniesData = allCompanies; 
        
        document.getElementById('companies-list-content').innerHTML = renderCompaniesTable(allCompanies);

        document.getElementById('company-list-search').addEventListener('keyup', handleCompanyListSearch);

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('載入公司列表失敗:', error);
            document.getElementById('companies-list-content').innerHTML = `<div class="alert alert-error">載入公司列表失敗: ${error.message}</div>`;
        }
    }
}

/**
 * 渲染公司列表的表格
 * @param {Array<object>} companies - 公司資料陣列
 * @returns {string} HTML 表格字串
 */
function renderCompaniesTable(companies) {
    if (!companies || companies.length === 0) {
        return '<div class="alert alert-info" style="text-align:center;">系統中尚無任何公司資料</div>';
    }

    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>公司名稱</th>
                    <th>公司電話</th>
                    <th>縣市</th>
                    <th>地址</th>
                </tr>
            </thead>
            <tbody>`;

    companies.forEach(company => {
        const encodedCompanyName = encodeURIComponent(company.companyName);
        tableHTML += `
            <tr>
                <td data-label="公司名稱">
                    <a href="#" class="text-link" onclick="event.preventDefault(); navigateTo('company-details', { companyName: '${encodedCompanyName}' })">
                        <strong>${company.companyName || '-'}</strong>
                    </a>
                </td>
                <td data-label="公司電話">${company.phone || '-'}</td>
                <td data-label="縣市">${company.county || '-'}</td>
                <td data-label="地址">${company.address || '-'}</td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    return tableHTML;
}

/**
 * 處理公司列表頁面的搜尋事件
 */
function handleCompanyListSearch() {
    const query = document.getElementById('company-list-search').value.toLowerCase();
    const filteredCompanies = window.allCompaniesData.filter(company => 
        company.companyName.toLowerCase().includes(query)
    );
    document.getElementById('companies-list-content').innerHTML = renderCompaniesTable(filteredCompanies);
}


// =============================================
// SECTION 2: 公司詳細資訊頁面 (Company Detail Page)
// =============================================

/**
 * 載入並渲染公司詳細資料頁面的主函式
 * @param {string} encodedCompanyName - URL編碼過的公司名稱
 */
async function loadCompanyDetailsPage(encodedCompanyName) {
    const container = document.getElementById('page-company-details');
    const companyName = decodeURIComponent(encodedCompanyName);
    if (!container) return;

    container.innerHTML = `<div class="loading show" style="padding-top: 100px;"><div class="spinner"></div><p>正在載入 ${companyName} 的詳細資料...</p></div>`;

    try {
        const result = await authedFetch(`/api/companies/${encodedCompanyName}/details`);
        if (!result.success) throw new Error(result.error || '無法載入公司資料');

        const { companyInfo, contacts = [], opportunities = [], potentialContacts = [] } = result.data;
        
        document.getElementById('page-title').textContent = companyInfo.companyName;
        document.getElementById('page-subtitle').textContent = '公司詳細資料與關聯活動';

        container.innerHTML = `
            <div class="dashboard-grid-flexible">
                ${renderCompanyInfoCard(companyInfo)}

                <div class="dashboard-widget grid-col-12">
                    <div class="widget-header"><h2 class="widget-title">已建檔聯絡人 (${contacts.length})</h2></div>
                    <div class="widget-content">${renderCompanyContactsTable(contacts)}</div>
                </div>

                <div class="dashboard-widget grid-col-12">
                    <div class="widget-header"><h2 class="widget-title">潛在聯絡人 (${potentialContacts.length})</h2></div>
                    <div class="widget-content">${renderPotentialContactsTable(potentialContacts)}</div>
                </div>

                <div class="dashboard-widget grid-col-12">
                    <div class="widget-header"><h2 class="widget-title">相關機會案件 (${opportunities.length})</h2></div>
                    <div class="widget-content">${renderCompanyOpportunitiesTable(opportunities)}</div>
                </div>
            </div>
        `;

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('載入公司詳細資料失敗:', error);
            document.getElementById('page-title').textContent = '錯誤';
            container.innerHTML = `<div class="alert alert-error">載入公司資料失敗: ${error.message}</div>`;
        }
    }
}

/**
 * 渲染公司基本資訊卡片 (包含編輯與 Gemini 功能)
 * @param {object} companyInfo - 公司資料物件
 * @returns {string} HTML 字串
 */
function renderCompanyInfoCard(companyInfo) {
    if (!companyInfo) return `<div class="dashboard-widget grid-col-12"><div class="alert alert-warning">找不到公司基本資料</div></div>`;

    const encodedCompanyName = encodeURIComponent(companyInfo.companyName);
    
    if (companyInfo.isPotential) {
        return `
        <div class="dashboard-widget grid-col-12">
             <div class="widget-header"><h2 class="widget-title">公司基本資料 (潛在)</h2></div>
             <div class="alert alert-info">此公司來自潛在客戶名單，尚未建立正式檔案。請先將其任一潛在聯絡人升級為機會案件，系統將自動建立公司檔案。</div>
        </div>`;
    }

    const introductionHTML = (companyInfo.introduction || '-').replace(/\n/g, '<br>');

    return `
        <div class="dashboard-widget grid-col-12">
            <div class="widget-header">
                <h2 class="widget-title">公司基本資料</h2>
                <div id="company-info-buttons" style="display:flex; gap: 0.5rem;">
                    <button class="action-btn small warn" onclick="toggleCompanyEditMode(true, '${encodedCompanyName}')">✏️ 編輯</button>
                </div>
            </div>

            <div class="widget-content">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="company-keywords-input" class="form-label" style="font-size: 0.8rem; color: var(--text-muted);">AI 生成線索 (選填，提供已知業務關鍵字可大幅提高準確率)</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" id="company-keywords-input" class="form-input" placeholder="例如：CNC控制器、自動化設備、線性滑軌...">
                        <button class="action-btn primary" id="generate-profile-btn" onclick="generateCompanyProfile('${encodedCompanyName}')" style="white-space: nowrap;">✨ AI 生成簡介</button>
                    </div>
                </div>

                <div id="company-info-content">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                        <div><strong>公司 ID:</strong> ${companyInfo.companyId || '-'}</div>
                        <div><strong>電話:</strong> <span class="editable-field" data-field="phone">${companyInfo.phone || '-'}</span></div>
                        <div><strong>縣市:</strong> <span class="editable-field" data-field="county">${companyInfo.county || '-'}</span></div>
                        <div><strong>地址:</strong> <span class="editable-field" data-field="address">${companyInfo.address || '-'}</span></div>
                        <div><strong>建立時間:</strong> ${formatDateTime(companyInfo.createdTime)}</div>
                        <div><strong>最後更新:</strong> ${formatDateTime(companyInfo.lastUpdateTime)}</div>
                    </div>
                    <hr style="margin: 1.5rem 0; border-color: var(--border-color);">
                    <div>
                        <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem;">公司簡介</h3>
                        <div class="editable-field" data-field="introduction" style="font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary); white-space: pre-wrap; min-height: 50px;">${introductionHTML}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}


/**
 * 渲染公司旗下的聯絡人表格
 * @param {Array<object>} contacts - 聯絡人陣列
 * @returns {string} HTML 表格字串
 */
function renderCompanyContactsTable(contacts) {
    if (!contacts || contacts.length === 0) return '<div class="alert alert-info" style="text-align:center;">該公司尚無已建檔的聯絡人</div>';
    
    let tableHTML = `<table class="data-table"><thead><tr><th>姓名</th><th>職位</th><th>部門</th><th>手機</th><th>公司電話</th><th>Email</th><th>操作</th></tr></thead><tbody>`;

    contacts.forEach(contact => {
        const contactJsonString = JSON.stringify(contact).replace(/'/g, "&apos;");
        tableHTML += `
            <tr>
                <td data-label="姓名"><strong>${contact.name || '-'}</strong></td>
                <td data-label="職位">${contact.position || '-'}</td>
                <td data-label="部門">${contact.department || '-'}</td>
                <td data-label="手機">${contact.mobile || '-'}</td>
                <td data-label="公司電話">${contact.phone || '-'}</td>
                <td data-label="Email">${contact.email || '-'}</td>
                <td data-label="操作">
                    <button class="action-btn small warn" onclick='showEditContactModal(${contactJsonString})'>✏️ 編輯</button>
                </td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    return tableHTML;
}

function renderPotentialContactsTable(potentialContacts) {
    if (!potentialContacts || potentialContacts.length === 0) return '<div class="alert alert-info" style="text-align:center;">在潛在客戶池中沒有找到該公司的聯絡人</div>';
    
    let tableHTML = `<table class="data-table"><thead><tr><th>姓名</th><th>職位</th><th>聯絡方式</th><th>建立時間</th><th>操作</th></tr></thead><tbody>`;
    potentialContacts.forEach(contact => {
        const driveLinkBtn = contact.driveLink ? `<a href="${contact.driveLink}" target="_blank" class="action-btn small info" title="查看原始名片">💳 名片</a>` : '';
        tableHTML += `
            <tr>
                <td data-label="姓名"><strong>${contact.name || '-'}</strong></td>
                <td data-label="職位">${contact.position || '-'}</td>
                <td data-label="聯絡方式">${contact.mobile ? `<div>📱 ${contact.mobile}</div>` : ''}${contact.phone ? `<div>📞 ${contact.phone}</div>` : ''}</td>
                <td data-label="建立時間">${formatDateTime(contact.createdTime)}</td>
                <td data-label="操作">
                    <div class="action-buttons-container">
                        ${driveLinkBtn}
                        <button class="action-btn small primary" onclick='startUpgradeContact(${contact.rowIndex})'>📈 升級</button>
                    </div>
                </td>
            </tr>`;
    });
    tableHTML += '</tbody></table>';
    return tableHTML;
}

function renderCompanyOpportunitiesTable(opportunities) {
    if (!opportunities || opportunities.length === 0) return '<div class="alert alert-info" style="text-align:center;">該公司尚無相關機會案件</div>';
    if (typeof renderOpportunitiesTable === 'function') {
        return renderOpportunitiesTable(opportunities);
    }
    return '<div class="alert alert-warning">機會列表渲染函式不可用</div>';
}

// =============================================
// SECTION 3: 編輯與 Gemini 功能實作
// =============================================

/**
 * 呼叫後端 API，使用 Gemini 生成公司簡介
 * @param {string} encodedCompanyName - URL編碼過的公司名稱
 */
async function generateCompanyProfile(encodedCompanyName) {
    const genButton = document.getElementById('generate-profile-btn');
    genButton.textContent = '生成中...';
    genButton.disabled = true;

    try {
        const contentDiv = document.getElementById('company-info-content');
        const address = contentDiv.querySelector('[data-field="address"]').textContent;
        const userKeywords = document.getElementById('company-keywords-input').value;

        const result = await authedFetch(`/api/companies/${encodedCompanyName}/generate-profile`, {
            method: 'POST',
            body: JSON.stringify({ address, website: '', userKeywords }),
        });

        if (result.success && result.data) {
            toggleCompanyEditMode(true, encodedCompanyName, result.data);
            showNotification('AI 簡介已生成，請審核後儲存。', 'success');
        } else {
            throw new Error(result.error || '生成失敗');
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') showNotification(`生成簡介失敗: ${error.message}`, 'error');
    } finally {
        genButton.textContent = '✨ AI 生成簡介';
        genButton.disabled = false;
    }
}


/**
 * 切換公司資訊的編輯模式
 * @param {boolean} isEditing - 是否進入編輯模式
 * @param {string} encodedCompanyName - URL編碼過的公司名稱
 * @param {object|null} aiData - (可選) AI生成的資料，用於直接填充表單
 */
function toggleCompanyEditMode(isEditing, encodedCompanyName, aiData = null) {
    const contentDiv = document.getElementById('company-info-content');
    const buttonsDiv = document.getElementById('company-info-buttons');
    const fields = contentDiv.querySelectorAll('.editable-field');

    if (isEditing) {
        fields.forEach(field => {
            const fieldName = field.dataset.field;
            let currentValue = field.textContent === '-' ? '' : field.textContent;
            
            if (aiData && aiData[fieldName]) {
                currentValue = aiData[fieldName];
            }
            
            field.setAttribute('data-original-value', field.innerHTML);

            if (fieldName === 'county') {
                const counties = ["臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣"];
                let selectHTML = `<select class="form-select" style="padding: 4px 8px;"><option value="">請選擇</option>`;
                counties.forEach(c => {
                    selectHTML += `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`;
                });
                selectHTML += `</select>`;
                field.innerHTML = selectHTML;
            } else if (fieldName === 'introduction') {
                const fullIntroText = aiData ? `【業務簡介】\n${aiData.introduction}\n\n【主要產業】\n${aiData.industry}\n\n【核心產品/服務】\n${aiData.products_services}\n\n【公司特色】\n${aiData.key_features}` : currentValue;
                field.innerHTML = `<textarea class="form-textarea" style="height: 200px;">${fullIntroText}</textarea>`;
            } else {
                field.innerHTML = `<input type="text" class="form-input" style="padding: 4px 8px;" value="${currentValue}">`;
            }
        });
        buttonsDiv.innerHTML = `
            <button class="action-btn small secondary" onclick="toggleCompanyEditMode(false, '${encodedCompanyName}')">取消</button>
            <button class="action-btn small primary" onclick="saveCompanyInfo('${encodedCompanyName}')">💾 儲存</button>
        `;
    } else { // 取消編輯
        fields.forEach(field => {
            field.innerHTML = field.getAttribute('data-original-value') || '-';
        });
        buttonsDiv.innerHTML = `
            <button class="action-btn small" onclick="generateCompanyProfile('${encodedCompanyName}')" title="使用 AI 生成或更新公司簡介">✨ AI 生成簡介</button>
            <button class="action-btn small warn" onclick="toggleCompanyEditMode(true, '${encodedCompanyName}')">✏️ 編輯</button>
        `;
    }
}

/**
 * 儲存公司資訊的變更
 * @param {string} encodedCompanyName - URL編碼過的公司名稱
 */
async function saveCompanyInfo(encodedCompanyName) {
    const contentDiv = document.getElementById('company-info-content');
    const fields = contentDiv.querySelectorAll('.editable-field');
    const updateData = {};

    fields.forEach(field => {
        const fieldName = field.dataset.field;
        const input = field.querySelector('input, select, textarea');
        if (input) {
            updateData[fieldName] = input.value;
        }
    });

    showLoading('正在儲存公司資料...');
    try {
        const result = await authedFetch(`/api/companies/${encodedCompanyName}`, {
            method: 'PUT',
            body: JSON.stringify(updateData),
        });

        if (result.success) {
            showNotification('公司資料更新成功！', 'success');
            navigateTo('company-details', { companyName: encodedCompanyName });
        } else {
            throw new Error(result.error || '儲存失敗');
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') showNotification(`儲存失敗: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function showEditContactModal(contact) {
    const modalContainer = document.createElement('div');
    modalContainer.id = 'edit-contact-modal-container';
    
    modalContainer.innerHTML = `
        <div id="edit-contact-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">編輯聯絡人: ${contact.name}</h2>
                    <button class="close-btn" onclick="closeEditContactModal()">&times;</button>
                </div>
                <form id="edit-contact-form">
                    <input type="hidden" id="edit-contact-id" value="${contact.contactId}">
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">部門</label><input type="text" class="form-input" id="edit-contact-department" value="${contact.department || ''}"></div>
                        <div class="form-group"><label class="form-label">職位</label><input type="text" class="form-input" id="edit-contact-position" value="${contact.position || ''}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">手機</label><input type="text" class="form-input" id="edit-contact-mobile" value="${contact.mobile || ''}"></div>
                        <div class="form-group"><label class="form-label">公司電話</label><input type="text" class="form-input" id="edit-contact-phone" value="${contact.phone || ''}"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="edit-contact-email" value="${contact.email || ''}"></div>
                    <button type="submit" class="submit-btn">💾 儲存變更</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalContainer);
    document.getElementById('edit-contact-form').addEventListener('submit', handleSaveContact);
}

function closeEditContactModal() {
    const modalContainer = document.getElementById('edit-contact-modal-container');
    if (modalContainer) {
        modalContainer.remove();
    }
}

async function handleSaveContact(e) {
    e.preventDefault();
    const contactId = document.getElementById('edit-contact-id').value;
    const updateData = {
        department: document.getElementById('edit-contact-department').value,
        position: document.getElementById('edit-contact-position').value,
        mobile: document.getElementById('edit-contact-mobile').value,
        phone: document.getElementById('edit-contact-phone').value,
        email: document.getElementById('edit-contact-email').value,
    };

    showLoading('正在儲存聯絡人資料...');
    try {
        const result = await authedFetch(`/api/contacts/${contactId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });

        if (result.success) {
            showNotification('聯絡人資料更新成功！', 'success');
            closeEditContactModal();
            const companyName = document.querySelector('#page-title').textContent;
            navigateTo('company-details', { companyName: encodeURIComponent(companyName) });
        } else {
            throw new Error(result.error || '儲存失敗');
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') showNotification(`儲存失敗: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}