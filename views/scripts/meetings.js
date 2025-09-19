// views/scripts/meetings.js

// ==================== 主要功能函式 ====================

// 顯示建立會議模態框
async function showNewMeetingModal() {
    showModal('new-meeting-modal');
    await loadOpportunitiesForMeeting();
    
    // 設定預設會議開始時間為下一個整點
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    now.setSeconds(0);
    // 格式化為 YYYY-MM-DDTHH:MM
    const localDateTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    document.getElementById('meeting-start-time').value = localDateTime;

    // 重置表單
    document.getElementById('new-meeting-form').reset();
    document.getElementById('meeting-start-time').value = localDateTime; // 再次設定，因為 reset() 會清空
    document.getElementById('manual-meeting-info').style.display = 'none';
}

// 顯示本週活動模態框
async function showWeekEventsModal() {
    showModal('week-events-modal');
    await loadWeekEvents();
}

// ==================== 資料載入與渲染 ====================

// 載入機會案件列表以供會議模態框選擇
async function loadOpportunitiesForMeeting() {
    try {
        const result = await authedFetch('/api/opportunities');
        
        const meetingOpportunitySelect = document.getElementById('meeting-opportunity');
        meetingOpportunitySelect.innerHTML = `
            <option value="">選擇相關機會...</option>
            <option value="manual">手動輸入客戶資訊</option>
        `;
        
        (result.data || []).forEach(opp => {
            const option = document.createElement('option');
            // 將機會的必要資訊打包成JSON字串存入value
            option.value = JSON.stringify({
                opportunityId: opp.opportunityId,
                company: opp.customerCompany,
                assignee: opp.assignee,
                stage: opp.currentStage
            });
            option.textContent = `${opp.opportunityName} (${opp.customerCompany})`;
            meetingOpportunitySelect.appendChild(option);
        });
        
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('❌ 載入會議用機會案件失敗:', error);
            showNotification('載入機會選項失敗', 'error');
        }
    }
}

// 根據選擇的機會，自動填寫會議標題
function updateMeetingInfo() {
    const selectedValue = document.getElementById('meeting-opportunity').value;
    const manualGroup = document.getElementById('manual-meeting-info');
    const titleInput = document.getElementById('meeting-title');
    
    if (selectedValue === 'manual') {
        manualGroup.style.display = 'block';
        titleInput.value = '';
    } else {
        manualGroup.style.display = 'none';
        if (selectedValue) {
            try {
                const oppData = JSON.parse(selectedValue);
                const stageNote = systemConfig['機會階段']?.find(s => s.value === oppData.stage)?.note || oppData.stage;
                titleInput.value = `[${oppData.assignee}][${stageNote}] ${oppData.company} - 業務討論`;
            } catch (error) {
                console.error('解析機會資料失敗:', error);
                titleInput.value = '';
            }
        } else {
             titleInput.value = '';
        }
    }
}

// 載入並渲染本週活動
async function loadWeekEvents() {
    const content = document.getElementById('week-events-content');
    content.innerHTML = '<div class="loading show"><div class="spinner"></div><p>載入本週活動中...</p></div>';
    try {
        const result = await authedFetch('/api/calendar/week');
        content.innerHTML = renderWeekEvents(result);
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('❌ 載入本週活動失敗:', error);
            content.innerHTML = '<div class="alert alert-error">載入本週活動失敗</div>';
        }
    }
}

function renderWeekEvents(data) {
    const events = data.allEvents || [];
    let html = `
        <div class="alert alert-info">
            📊 本週共有 ${data.weekCount} 個活動，其中今日有 ${data.todayCount} 個。
        </div>`;

    if (events.length === 0) {
        html += '<div class="alert alert-warning" style="text-align: center;">本週沒有安排活動</div>';
    } else {
        html += '<div class="events-list">';
        events.forEach(event => {
            const startTime = new Date(event.start.dateTime || event.start.date);
            const isToday = startTime.toDateString() === new Date().toDateString();
            
            html += `
                <div class="event-item" style="padding: 15px; border-bottom: 1px solid #e9ecef; ${isToday ? 'background: #fff3cd;' : ''}">
                    <strong>${event.summary || '無標題'}</strong>
                    ${isToday ? '<span style="color: #856404; font-weight: bold; margin-left: 10px; font-size: 0.8em; vertical-align: middle;">今日</span>' : ''}
                    <br>
                    <small>📅 ${formatDateTime(startTime)}</small><br>
                    ${event.location ? `<small>📍 ${event.location}</small><br>` : ''}
                </div>
            `;
        });
        html += '</div>';
    }
    return html;
}

// ==================== 表單提交 ====================
document.addEventListener('DOMContentLoaded', function() {
    const newMeetingForm = document.getElementById('new-meeting-form');
    if (newMeetingForm) {
        newMeetingForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            showLoading('正在建立會議...');
            try {
                const selectedOpportunity = document.getElementById('meeting-opportunity').value;
                let eventData = {
                    title: document.getElementById('meeting-title').value,
                    // 【修改 #1】將本地時間轉為 ISO 字串
                    startTime: new Date(document.getElementById('meeting-start-time').value).toISOString(),
                    duration: parseInt(document.getElementById('meeting-duration').value),
                    location: document.getElementById('meeting-location').value,
                    description: document.getElementById('meeting-description').value
                };
                
                if (selectedOpportunity && selectedOpportunity !== 'manual') {
                    const oppData = JSON.parse(selectedOpportunity);
                    eventData.opportunityId = oppData.opportunityId;
                    eventData.assignee = oppData.assignee;
                }
                
                const result = await authedFetch('/api/calendar/events', {
                    method: 'POST',
                    body: JSON.stringify(eventData)
                });
                
                hideLoading();
                
                if (result.success) {
                    showNotification('會議事件建立成功！', 'success');
                    closeModal('new-meeting-modal');
                    await loadSystemStats(); // 更新儀表板統計
                    
                    if (document.getElementById('create-interaction-record').checked && eventData.opportunityId) {
                        showNotification('互動紀錄已同步建立', 'info', 2000);
                    }
                } else {
                    throw new Error(result.details || '建立會議失敗');
                }
            } catch (error) {
                hideLoading();
                if (error.message !== 'Unauthorized') {
                    console.error('❌ 建立會議失敗:', error);
                    showNotification(`建立會議失敗: ${error.message}`, 'error');
                }
            }
        });
    }
});

// ==================== 快捷功能 ====================
// 讓機會列表中的按鈕可以快速帶入機會資訊來建立會議
function quickCreateMeeting(opportunityId) {
    showNewMeetingModal().then(() => {
        const select = document.getElementById('meeting-opportunity');
        // 遍歷選項找到對應的機會
        for (let option of select.options) {
            if (option.value && option.value !== 'manual') {
                try {
                    const data = JSON.parse(option.value);
                    if (data.opportunityId === opportunityId) {
                        select.value = option.value;
                        updateMeetingInfo(); // 觸發自動填寫
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }
    });
}