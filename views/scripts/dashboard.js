// views/scripts/dashboard.js

const dashboardManager = {
    kanbanRawData: {},

    async refresh(force = false) {
        console.log(`🔄 [Dashboard] 執行儀表板刷新... (強制: ${force})`);
        showLoading('正在同步儀表板資料...');
        
        const dashboardApiUrl = force ? `/api/dashboard?t=${Date.now()}` : '/api/dashboard';

        try {
            const [dashboardResult, announcementResult] = await Promise.all([
                authedFetch(dashboardApiUrl),
                authedFetch('/api/announcements')
            ]);

            if (!dashboardResult.success) throw new Error(dashboardResult.details || '獲取儀表板資料失敗');
            
            const data = dashboardResult.data;
            this.kanbanRawData = data.kanbanData || {};

            this.renderStats(data.stats);
            
            if(announcementResult.success) {
                this.renderAnnouncementsWidget(announcementResult.data);
            }

            this.populateKanbanFilter();
            this.filterAndRenderKanban();
            
            const activityWidget = document.querySelector('#activity-feed-widget .widget-content');
            if (activityWidget) activityWidget.innerHTML = this.renderActivityFeed(data.recentActivity || []);

            const weeklyBusinessWidget = document.getElementById('weekly-business-widget');
            if (weeklyBusinessWidget) this.renderWeeklyBusinessWidget(data.weeklyBusiness || [], data.thisWeekInfo);

            if (window.mapManager) {
                await window.mapManager.update();
            }

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                console.error("[Dashboard] 刷新儀表板時發生錯誤:", error);
                showNotification("儀表板刷新失敗", "error");
            }
        } finally {
            hideLoading();
            console.log('✅ [Dashboard] 儀表板刷新完成');
        }
    },

    async forceRefresh() {
        showLoading('正在強制同步所有資料...');
        try {
            await authedFetch('/api/cache/invalidate', { method: 'POST' });
            showNotification('後端快取已清除，正在重新載入...', 'info');
            await this.refresh(true);
            showNotification('所有資料已強制同步！', 'success');
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                console.error("[Dashboard] 強制刷新失敗:", error);
                showNotification("強制刷新失敗，請稍後再試。", "error");
            }
        } finally {
            hideLoading();
        }
    },
    
    renderStats(stats = {}) {
        document.getElementById('contacts-count').textContent = stats.contactsCount || 0;
        document.getElementById('opportunities-count').textContent = stats.opportunitiesCount || 0;
        document.getElementById('event-logs-count').textContent = stats.eventLogsCount || 0;
        document.getElementById('followup-count').textContent = stats.followUpCount || 0;
    },

    renderAnnouncementsWidget(announcements) {
        const container = document.querySelector('#announcement-widget .widget-content');
        const header = document.querySelector('#announcement-widget .widget-header');
        if (!container || !header) return;

        const oldBtn = header.querySelector('.action-btn');
        if(oldBtn) oldBtn.remove();
        
        const viewAllBtn = document.createElement('button');
        viewAllBtn.className = 'action-btn secondary';
        viewAllBtn.textContent = '查看更多公告'; // 【調整】修改按鈕文字
        viewAllBtn.onclick = () => navigateTo('announcements');
        header.appendChild(viewAllBtn);

        if (!announcements || announcements.length === 0) {
            container.innerHTML = `<div class="alert alert-info" style="text-align: center;">目前沒有公告</div>`;
            return;
        }

        let html = '<div class="announcement-list">';
        // 【調整】只顯示最多 1 筆
        announcements.slice(0, 1).forEach(item => {
            const isPinnedIcon = item.isPinned ? '<span class="pinned-icon" title="置頂公告">📌</span>' : '';
            // 【調整】加入發佈人與調整結構
            html += `
                <div class="announcement-item" onclick="navigateTo('announcements')">
                    <div class="announcement-header">
                        <h4 class="announcement-title">${isPinnedIcon}${item.title}</h4>
                        <span class="announcement-creator">👤 ${item.creator}</span>
                    </div>
                    <p class="announcement-content">${item.content.substring(0, 150)}...</p>
                    <div class="announcement-footer">
                        <span class="announcement-time">發佈於 ${formatDateTime(item.lastUpdateTime)}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;

        if (!document.getElementById('announcement-styles')) {
            const style = document.createElement('style');
            style.id = 'announcement-styles';
            // 【調整】新增樣式
            style.innerHTML = `
                .announcement-item { padding: 1rem; border-radius: var(--rounded-lg); cursor: pointer; transition: background-color 0.2s ease; border: 1px solid var(--border-color); }
                .announcement-item:hover { background-color: var(--glass-bg); }
                .announcement-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; gap: 1rem; }
                .announcement-title { font-weight: 600; color: var(--text-primary); margin: 0; }
                .pinned-icon { margin-right: 0.5rem; }
                .announcement-creator { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); background: var(--glass-bg); padding: 2px 8px; border-radius: 1rem; flex-shrink: 0; }
                .announcement-content { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin: 0; }
                .announcement-footer { margin-top: 0.75rem; text-align: right; }
                .announcement-time { font-size: 0.8rem; color: var(--text-muted); }
            `;
            document.head.appendChild(style);
        }
    },

    populateKanbanFilter() {
        const filterSelect = document.getElementById('kanban-type-filter');
        if (!filterSelect || !systemConfig['機會種類']) return;
        
        filterSelect.innerHTML = '<option value="all">所有種類</option>';
        systemConfig['機會種類'].forEach(type => {
            filterSelect.innerHTML += `<option value="${type.value}">${type.note || type.value}</option>`;
        });
    },

    filterAndRenderKanban() {
        const filterValue = document.getElementById('kanban-type-filter')?.value || 'all';
        if (!this.kanbanRawData || Object.keys(this.kanbanRawData).length === 0) {
             this.renderKanban({});
             return;
        }

        const filteredData = JSON.parse(JSON.stringify(this.kanbanRawData));
        if (filterValue !== 'all') {
            Object.keys(filteredData).forEach(stageId => {
                const filteredOpps = filteredData[stageId].opportunities.filter(opp => opp.opportunityType === filterValue);
                filteredData[stageId].opportunities = filteredOpps;
                filteredData[stageId].count = filteredOpps.length;
            });
        }
        this.renderKanban(filteredData);
    },

    renderKanban(stagesData) {
        const kanbanBoard = document.getElementById('kanban-board');
        if (!kanbanBoard || !stagesData || !systemConfig['機會階段']) {
            kanbanBoard.innerHTML = '<div class="loading show"><div class="spinner"></div><p>載入看板設定中...</p></div>';
            return;
        }
        
        let html = '';
        systemConfig['機會階段'].forEach(stageInfo => {
            const stageId = stageInfo.value;
            const stage = stagesData[stageId] || { name: stageInfo.note, opportunities: [], count: 0 };
            const opportunities = stage.opportunities || [];
            
            html += `<div class="kanban-column" data-stage-id="${stageId}">
                        <div class="kanban-header">
                            <div class="kanban-title">${stage.name}</div>
                            <div class="kanban-count">${stage.count}</div>
                        </div>
                        <div class="opportunities-list">`;
            
            opportunities.slice(0, 5).forEach(opp => {
                const typeNote = systemConfig['機會種類']?.find(t => t.value === opp.opportunityType)?.note || opp.opportunityType;
                html += `<div id="opp-card-${opp.opportunityId}" class="kanban-card" draggable="true" ondragstart="kanbanBoardManager.drag(event)" onclick="navigateTo('opportunity-details', { opportunityId: '${opp.opportunityId}' })">
                            <div class="card-title">${opp.opportunityName}</div>
                            <div class="card-company">🏢 ${opp.customerCompany}</div>
                            <div class="card-tags">
                                <span class="card-tag assignee">👤 ${opp.assignee}</span>
                                ${opp.opportunityType ? `<span class="card-tag type">📖 ${typeNote || ''}</span>` : ''}
                            </div>
                            ${opp.opportunityValue ? `<div class="card-value">💰 ${opp.opportunityValue}</div>` : ''}
                        </div>`;
            });
            
            if (opportunities.length > 5) {
                html += `<button class="expand-btn" onclick="dashboardManager.expandStage('${stageId}')">展開 (+${opportunities.length - 5})</button>`;
            }
            html += `</div></div>`;
        });
        kanbanBoard.innerHTML = html;
    },

    expandStage(stageId) {
        const stageData = this.kanbanRawData[stageId];
        if (!stageData) {
            showNotification('找不到該階段的資料', 'error');
            return;
        }

        const modalTitle = document.getElementById('kanban-expand-title');
        const modalContent = document.getElementById('kanban-expand-content');
        if (!modalTitle || !modalContent) return;

        modalTitle.textContent = `階段: ${stageData.name}`;
        
        if (typeof renderOpportunitiesTable === 'function') {
            modalContent.innerHTML = renderOpportunitiesTable(stageData.opportunities);
        } else {
            modalContent.innerHTML = '<div class="alert alert-error">無法渲染機會列表</div>';
        }
        
        showModal('kanban-expand-modal');
    },

    renderActivityFeed(feedData) {
        if (!feedData || feedData.length === 0) return '<div class="alert alert-info">尚無最新動態</div>';
        
        const iconMap = { '系統事件': '⚙️', '會議討論': '📅', '事件報告': '📝', '電話聯繫': '📞', '郵件溝通': '📧', 'new_contact': '👤' };
        let html = '<ul class="activity-feed-list">';

        feedData.forEach(item => {
            html += `<li class="activity-feed-item">`;
            if (item.type === 'interaction') {
                const interaction = item.data;
                const icon = iconMap[interaction.eventType] || '🔔';
                html += `<div class="feed-icon">${icon}</div>
                         <div class="feed-content">
                            <div class="feed-text"><strong>${interaction.recorder}</strong> 在 <strong>${interaction.opportunityName}</strong> ${interaction.eventTitle ? `建立了${interaction.eventTitle}` : `新增了一筆${interaction.eventType}`}</div>
                            <div class="feed-summary">${interaction.contentSummary}</div>
                            <div class="feed-time">${formatDateTime(interaction.interactionTime)}</div>
                         </div>`;
            } else if (item.type === 'new_contact') {
                const contact = item.data;
                html += `<div class="feed-icon">${iconMap['new_contact']}</div>
                         <div class="feed-content">
                            <div class="feed-text"><strong>新增潛在客戶:</strong> ${contact.name || '(無姓名)'}</div>
                            <div class="feed-summary">🏢 ${contact.company || '(無公司資訊)'}</div>
                            <div class="feed-time">${formatDateTime(contact.createdTime)}</div>
                         </div>`;
            }
            html += `</li>`;
        });
        html += '</ul>';
        return html;
    },

    renderWeeklyBusinessWidget(entries, weekInfo) {
        const widget = document.getElementById('weekly-business-widget');
        if (!widget) return;

        const container = widget.querySelector('.widget-content');
        const header = widget.querySelector('.widget-header');
        const titleEl = header.querySelector('.widget-title');

        if (weekInfo && weekInfo.title) {
            titleEl.innerHTML = `本週業務重點 <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">${weekInfo.title}</span>`;
        }

        let button = header.querySelector('.action-btn');
        if (!button) {
            button = document.createElement('button');
            button.className = 'action-btn small secondary';
            header.appendChild(button);
        }
        button.textContent = '查看週報';
        button.onclick = () => weekInfo && weekInfo.weekId ? navigateTo('weekly-business', { weekId: weekInfo.weekId }) : null;
        button.disabled = !(weekInfo && weekInfo.weekId);

        const themes = systemConfig['週間業務主題'] || [{value: 'IoT', note: 'IoT'}, {value: 'DT', note: 'DT'}];
        let gridHtml = `<div class="weekly-grid-container">
                            <div class="weekly-grid-header">
                                <div class="day-label-placeholder"></div>
                                ${themes.map(theme => `<div class="topic-header ${theme.value.toLowerCase()}">${theme.note}</div>`).join('')}
                            </div>
                            <div class="weekly-grid-body">`;
        
        const days = ['週一', '週二', '週三', '週四', '週五'];
        days.forEach((day, index) => {
            const dayIndex = index + 1;
            gridHtml += `<div class="weekly-day-row">
                            <div class="day-label">${day}</div>
                            ${themes.map(theme => `<div class="topic-cell" id="wb-dash-${dayIndex}-${theme.value.toLowerCase()}"></div>`).join('')}
                         </div>`;
        });
        gridHtml += '</div></div>';
        container.innerHTML = gridHtml;

        if (entries && entries.length > 0) {
            entries.forEach(entry => {
                try {
                    const [y, m, d] = entry['日期'].split('-').map(Number);
                    const entryDate = new Date(Date.UTC(y, m - 1, d));
                    const entryDayOfWeek = entryDate.getUTCDay();

                    if (entryDayOfWeek >= 1 && entryDayOfWeek <= 5) {
                        const category = (entry['分類'] || themes[0].value).toLowerCase();
                        const cell = document.getElementById(`wb-dash-${entryDayOfWeek}-${category}`);
                        if (cell) {
                            cell.innerHTML += `<div class="wb-item">
                                <div class="wb-topic">${entry['主題']}</div>
                                <div class="wb-participants">👤 ${entry['參與人員'] || 'N/A'}</div>
                            </div>`;
                        }
                    }
                } catch (e) { console.warn('渲染儀表板業務紀錄時出錯:', entry, e); }
            });
        }
    }
};

// 將 manager 掛載到 window，以便 HTML 中的 onclick 可以呼叫
window.dashboardManager = dashboardManager;