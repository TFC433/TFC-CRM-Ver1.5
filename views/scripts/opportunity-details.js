// views/scripts/opportunity-details.js
// 職責：管理「機會詳細資料」頁面的所有顯示與互動邏輯

// ==================== 全域變數 (此頁面專用) ====================
let interactionsDataCache = []; // 用於暫存互動紀錄以供編輯
let opportunityDetailPageTemplate = ''; // 用於快取詳細頁面的HTML模板
let currentDetailOpportunityId = null; // 用於儲存當前詳細頁的機會ID


// ==================== 主要載入與渲染函式 ====================

/**
 * 載入並渲染機會詳細頁面的主函式
 * @param {string} opportunityId - 機會ID
 */
async function loadOpportunityDetailPage(opportunityId) {
    currentDetailOpportunityId = opportunityId;
    const container = document.getElementById('page-opportunity-details');
    container.innerHTML = `<div class="loading show" style="padding-top: 50px;"><div class="spinner"></div><p>正在載入機會詳細資料...</p></div>`;

    if (!opportunityDetailPageTemplate) {
        try {
            opportunityDetailPageTemplate = await fetch('opportunity-detail-page.html').then(res => res.text());
        } catch (error) {
            container.innerHTML = `<div class="alert alert-error">頁面模板載入失敗: ${error.message}</div>`;
            return;
        }
    }

    try {
        const result = await authedFetch(`/api/opportunities/${opportunityId}/details`);
        if (!result.success) throw new Error(result.error);
        
        const { opportunityInfo, interactions, eventLogs, linkedContacts, parentOpportunity, childOpportunities } = result.data;
        interactionsDataCache = interactions || [];

        container.innerHTML = opportunityDetailPageTemplate;
        document.getElementById('page-title').textContent = opportunityInfo.opportunityName;
        document.getElementById('page-subtitle').textContent = '機會詳細資料與關聯活動';

        // 依序渲染頁面各個區塊
        renderOpportunitySummaryCard(opportunityInfo);
        renderAssociatedContacts(opportunityInfo, linkedContacts);
        document.getElementById('add-associated-contact-btn').addEventListener('click', () => showLinkContactModal(opportunityInfo.opportunityId));
        renderAssociatedOpportunities({ opportunityInfo, parentOpportunity, childOpportunities });
        renderOpportunityFullDetails(opportunityInfo);
        renderInteractionTab(opportunityInfo, interactions);
        renderEventLogsTab(eventLogs);

        setupOpportunityDetailTabs();
        updateAllDropdowns();

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            document.getElementById('page-title').textContent = '錯誤';
            container.innerHTML = `<div class="alert alert-error">載入機會詳細資料失敗: ${error.message}</div>`;
        }
    }
}

/**
 * 渲染頂部的摘要資訊卡片
 * @param {object} opp - 機會案件資料物件
 */
function renderOpportunitySummaryCard(opp) {
    const container = document.getElementById('opportunity-summary-card');
    const stageNote = (systemConfig['機會階段'] || []).find(s => s.value === opp.currentStage)?.note || opp.currentStage;
    const encodedCompanyName = encodeURIComponent(opp.customerCompany);

    container.innerHTML = `
        <div class="summary-item">
            <span class="summary-label">客戶公司</span>
            <span class="summary-value"><a href="#" class="text-link" onclick="event.preventDefault(); navigateTo('company-details', { companyName: '${encodedCompanyName}' })">${opp.customerCompany}</a></span>
        </div>
        <div class="summary-item">
            <span class="summary-label">主要聯絡人</span>
            <span class="summary-value">${opp.mainContact}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">負責業務</span>
            <span class="summary-value">${opp.assignee}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">目前階段</span>
            <span class="summary-value">${stageNote}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">機會價值</span>
            <span class="summary-value">${opp.opportunityValue || '未填寫'}</span>
        </div>
        
        <div style="position: absolute; top: 16px; right: 16px;">
            <button class="action-btn small warn" onclick="editOpportunity('${opp.opportunityId}')">✏️ 編輯</button>
        </div>
    `;
}

/**
 * 渲染詳細頁面中的頁籤內容
 */
function renderInteractionTab(opp, interactions) {
    const historyList = document.getElementById('interaction-history-list');
    const form = document.getElementById('new-interaction-form');
    
    form.reset();
    document.getElementById('interaction-opportunity-id').value = opp.opportunityId;
    document.getElementById('interaction-edit-rowIndex').value = '';
    document.getElementById('interaction-submit-btn').textContent = '💾 新增紀錄';
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('interaction-time').value = now.toISOString().slice(0, 16);

    if (interactions.length > 0) {
        historyList.innerHTML = interactions.map(renderSingleInteractionItem).join('');
    } else {
        historyList.innerHTML = '<div class="alert alert-info" style="text-align:center;">尚無互動紀錄</div>';
    }
}

function renderEventLogsTab(eventLogs) {
    const container = document.getElementById('opportunity-event-logs-list');
    if (eventLogs.length === 0) {
        container.innerHTML = '<div class="alert alert-info">此機會尚無相關的事件報告</div>';
        return;
    }
    let tableHtml = `<table class="data-table"><thead><tr><th>建立時間</th><th>事件名稱</th><th>建立者</th><th>操作</th></tr></thead><tbody>`;
    eventLogs.forEach(log => {
        tableHtml += `
            <tr>
                <td data-label="建立時間">${formatDateTime(log.createdTime)}</td>
                <td data-label="事件名稱">${log.eventName}</td>
                <td data-label="建立者">${log.creator}</td>
                <td data-label="操作"><button class="action-btn small info" onclick="showEventLogReport('${log.eventId}')">📄 查看報告</button></td>
            </tr>
        `;
    });
    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}

function renderOpportunityFullDetails(opp) {
    const container = document.getElementById('opportunity-full-details-list');
    const typeNote = (systemConfig['機會種類'] || []).find(t => t.value === opp.opportunityType)?.note || opp.opportunityType;
    const sourceNote = (systemConfig['機會來源'] || []).find(s => s.value === opp.opportunitySource)?.note || opp.opportunitySource;
    const stageNote = (systemConfig['機會階段'] || []).find(s => s.value === opp.currentStage)?.note || opp.currentStage;
    
    const details = {
        '機會 ID': opp.opportunityId, '機會名稱': opp.opportunityName,
        '客戶公司': opp.customerCompany, '主要聯絡人': opp.mainContact,
        '聯絡人電話': opp.contactPhone, '負責業務': opp.assignee,
        '機會種類': typeNote, '機會來源': sourceNote,
        '目前階段': stageNote, '建立時間': formatDateTime(opp.createdTime),
        '預計結案日': opp.expectedCloseDate || '-', '機會價值': opp.opportunityValue || '-',
        '目前狀態': opp.currentStatus, 'Drive 資料夾': opp.driveFolderLink ? `<a href="${opp.driveFolderLink}" target="_blank" class="text-link">點此前往</a>` : '-',
        '最後更新時間': formatDateTime(opp.lastUpdateTime), '最後變更者': opp.lastModifier,
        '母機會ID': opp.parentOpportunityId || '-',
        '備註': opp.notes || '-'
    };

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1rem;">
            ${Object.entries(details).map(([key, value]) => `
                <div class="summary-item">
                    <span class="summary-label">${key}</span>
                    <span class="summary-value" style="font-size: 1rem;">${value || '-'}</span>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * 綁定詳細頁面頁籤的切換事件
 */
function setupOpportunityDetailTabs() {
    const tabs = document.querySelectorAll('#opportunity-detail-tabs .tab-link');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            contents.forEach(content => content.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`tab-content-${tab.dataset.tab}`).classList.add('active');
        });
    });
}

// ==================== 互動與關聯功能 ====================

function renderSingleInteractionItem(item) {
    let summaryHTML = item.contentSummary || '';
    const linkRegex = /\[(.*?)\]\(event_log_id=(.*?)\)/g;
    
    summaryHTML = summaryHTML.replace(linkRegex, (fullMatch, text, eventId) => {
        return `<a href="#" class="text-link" onclick="event.preventDefault(); showEventLogReport('${eventId}')">${text}</a>`;
    });

    return `
        <div class="interaction-item" id="interaction-${item.interactionId}">
            <div class="interaction-header">
                <div>
                    <span class="interaction-time">${formatDateTime(item.interactionTime)}</span>
                    <span class="interaction-type" style="font-weight:bold; margin-left: 8px;">${item.eventType}</span>
                </div>
                <button class="action-btn small warn" style="padding: 2px 6px; font-size: 0.7rem;" onclick="showInteractionForEditing('${item.interactionId}')">✏️ 編輯</button>
            </div>
            <div class="interaction-summary">${summaryHTML}</div>
            ${item.nextAction ? `<div class="interaction-next-action"><strong>下次行動:</strong> ${item.nextAction}</div>` : ''}
        </div>
    `;
}

function showInteractionForEditing(interactionId) {
    const item = interactionsDataCache.find(i => i.interactionId === interactionId);
    if (!item) {
        showNotification('找不到該筆互動紀錄資料', 'error');
        return;
    }

    document.getElementById('interaction-edit-rowIndex').value = item.rowIndex;
    
    const interactionTime = new Date(item.interactionTime);
    interactionTime.setMinutes(interactionTime.getMinutes() - interactionTime.getTimezoneOffset());
    document.getElementById('interaction-time').value = interactionTime.toISOString().slice(0, 16);
    
    document.getElementById('interaction-event-type').value = item.eventType;
    document.getElementById('interaction-summary').value = item.contentSummary;
    document.getElementById('interaction-next-action').value = item.nextAction;
    
    document.getElementById('interaction-submit-btn').textContent = '💾 儲存變更';
    
    document.getElementById('new-interaction-form').scrollIntoView({ behavior: 'smooth' });
}

// 監聽詳細頁面中的互動表單提交
document.addEventListener('submit', async function(e) {
    if (e.target.id === 'new-interaction-form') {
        e.preventDefault();
        const rowIndex = document.getElementById('interaction-edit-rowIndex').value;
        const isEditMode = !!rowIndex;
        const opportunityId = document.getElementById('interaction-opportunity-id').value;
        
        showLoading(isEditMode ? '正在更新互動紀錄...' : '正在新增互動紀錄...');
        try {
            const interactionData = {
                interactionTime: new Date(document.getElementById('interaction-time').value).toISOString(),
                eventType: document.getElementById('interaction-event-type').value,
                contentSummary: document.getElementById('interaction-summary').value,
                nextAction: document.getElementById('interaction-next-action').value,
                modifier: getCurrentUser()
            };

            const url = isEditMode ? `/api/interactions/${rowIndex}` : '/api/interactions';
            const method = isEditMode ? 'PUT' : 'POST';
            if (!isEditMode) {
                interactionData.opportunityId = opportunityId;
                interactionData.recorder = getCurrentUser();
            }

            const result = await authedFetch(url, { method: method, body: JSON.stringify(interactionData) });

            if (result.success) {
                await loadOpportunityDetailPage(opportunityId); // 直接刷新整個詳細頁面以確保資料同步
                showNotification(isEditMode ? '互動紀錄更新成功！' : '互動紀錄新增成功！', 'success');
            } else {
                throw new Error(result.details || '操作失敗');
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') showNotification(`操作失敗: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    }
});


// SECTION: 關聯聯絡人功能 (Associated Contacts)

function renderAssociatedContacts(opportunityInfo, linkedContacts) {
    const container = document.getElementById('associated-contacts-list');
    if (!linkedContacts || linkedContacts.length === 0) {
        container.innerHTML = '<div class="alert alert-info">此機會尚無關聯聯絡人。</div>';
        return;
    }

    let tableHTML = `<table class="data-table"><thead><tr><th>姓名</th><th>公司</th><th>職位</th><th>聯絡方式</th><th>角色</th><th>操作</th></tr></thead><tbody>`;
    linkedContacts.forEach(contact => {
        const isMainContact = (contact.name === opportunityInfo.mainContact);
        const contactJsonString = JSON.stringify(contact).replace(/'/g, "&apos;");
        
        const unlinkButton = !isMainContact 
            ? `<button class="action-btn small danger" onclick="confirmUnlinkContact('${opportunityInfo.opportunityId}', '${contact.contactId}', '${contact.name}')">🗑️ 刪除關聯</button>` 
            : '';

        tableHTML += `
            <tr>
                <td data-label="姓名"><strong>${contact.name}</strong></td>
                <td data-label="公司">${contact.companyName || '-'}</td>
                <td data-label="職位">${contact.position || '-'}</td>
                <td data-label="聯絡方式">${contact.mobile || contact.phone || '-'}</td>
                <td data-label="角色">${isMainContact ? '<span class="card-tag assignee">主要聯絡人</span>' : '一般聯絡人'}</td>
                <td data-label="操作">
                    <div class="action-buttons-container">
                        <button class="action-btn small warn" onclick='showEditContactModalInOpp(${contactJsonString})'>✏️ 編輯</button>
                        ${unlinkButton}
                    </div>
                </td>
            </tr>
        `;
    });
    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

function showEditContactModalInOpp(contact) {
    const oldModal = document.getElementById('edit-contact-modal-container');
    if (oldModal) oldModal.remove();

    const modalContainer = document.createElement('div');
    modalContainer.id = 'edit-contact-modal-container';
    
    modalContainer.innerHTML = `
        <div id="edit-contact-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">編輯聯絡人: ${contact.name}</h2>
                    <button class="close-btn" onclick="document.getElementById('edit-contact-modal-container').remove()">&times;</button>
                </div>
                <form id="edit-opp-contact-form">
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
    document.getElementById('edit-opp-contact-form').addEventListener('submit', handleSaveOppContact);
}

async function handleSaveOppContact(e) {
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
            document.getElementById('edit-contact-modal-container').remove();
            await loadOpportunityDetailPage(currentDetailOpportunityId);
        } else {
            throw new Error(result.error || '儲存失敗');
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') showNotification(`儲存失敗: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// 【修改】更新確認訊息以符合硬刪除邏輯
function confirmUnlinkContact(opportunityId, contactId, contactName) {
    const message = `您確定要將聯絡人 "${contactName}" 從這個機會案件中移除關聯嗎？\n\n(注意：此操作將永久刪除這條關聯紀錄，但不會刪除聯絡人本身的檔案)`;
    showConfirmDialog(message, async () => {
        showLoading('正在刪除關聯...');
        try {
            const result = await authedFetch(`/api/opportunities/${opportunityId}/contacts/${contactId}`, {
                method: 'DELETE'
            });
            if (result.success) {
                showNotification('聯絡人關聯已刪除', 'success');
                await loadOpportunityDetailPage(opportunityId);
            } else {
                throw new Error(result.error || '刪除關聯失敗');
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                showNotification(`刪除關聯失敗: ${error.message}`, 'error');
            }
        } finally {
            hideLoading();
        }
    });
}

// SECTION: 關聯機會功能 (Associated Opportunities)

function renderAssociatedOpportunities(details) {
    const container = document.getElementById('associated-opportunities-list');
    const { opportunityInfo, parentOpportunity, childOpportunities } = details;
    let html = '';

    if (parentOpportunity) {
        html += `
            <div class="summary-item" style="margin-bottom: 1rem;">
                <span class="summary-label">母機會</span>
                <span class="summary-value" style="font-size: 1rem;">
                    <a href="#" class="text-link" onclick="event.preventDefault(); navigateTo('opportunity-details', { opportunityId: '${parentOpportunity.opportunityId}' })">${parentOpportunity.opportunityName}</a>
                </span>
            </div>
        `;
    } else {
        document.getElementById('add-associated-opportunity-btn').textContent = '+ 設定母機會';
        document.getElementById('add-associated-opportunity-btn').onclick = () => showLinkOpportunityModal(opportunityInfo.opportunityId, opportunityInfo.rowIndex);
    }

    if (childOpportunities && childOpportunities.length > 0) {
        html += `<div class="summary-item"><span class="summary-label">子機會 (${childOpportunities.length})</span></div>`;
        html += `<ul style="list-style: none; padding-left: 1rem; margin-top: 0.5rem;">`;
        childOpportunities.forEach(child => {
            html += `<li style="margin-bottom: 0.5rem;"><a href="#" class="text-link" onclick="event.preventDefault(); navigateTo('opportunity-details', { opportunityId: '${child.opportunityId}' })">${child.opportunityName}</a></li>`;
        });
        html += `</ul>`;
    }

    if (!html) {
        html = '<div class="alert alert-info">尚無關聯機會。</div>';
    }

    container.innerHTML = html;
    
    const addButton = document.getElementById('add-associated-opportunity-btn');
    if (parentOpportunity) {
        addButton.style.display = 'none';
    } else {
        addButton.style.display = 'flex';
    }
}