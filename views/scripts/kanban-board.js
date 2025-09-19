// views/scripts/kanban-board.js

const kanbanBoardManager = {
    initialize() {
        const kanbanBoard = document.getElementById('kanban-board');
        if (!kanbanBoard) return;

        // 移除舊的監聽器以防重複綁定
        kanbanBoard.removeEventListener('dragover', this.handleDragOver);
        kanbanBoard.removeEventListener('drop', this.handleDrop.bind(this));
        
        // 綁定新的監聽器
        kanbanBoard.addEventListener('dragover', this.handleDragOver);
        kanbanBoard.addEventListener('drop', this.handleDrop.bind(this));
        console.log('✅ [Kanban] 拖曳功能已初始化');
    },

    drag(event) {
        event.dataTransfer.setData("text/plain", event.target.id.replace('opp-card-', ''));
    },

    handleDragOver(event) {
        event.preventDefault();
    },

    handleDrop(event) {
        event.preventDefault();
        const opportunityId = event.dataTransfer.getData("text/plain");
        const targetColumn = event.target.closest('.kanban-column');

        if (targetColumn && opportunityId) {
            const newStageId = targetColumn.dataset.stageId;
            this.handleOpportunityStageChange(opportunityId, newStageId);
        }
    },

    async handleOpportunityStageChange(opportunityId, newStageId) {
        const kanbanData = window.dashboardManager.kanbanRawData;
        let opportunity;
        let oldStageId;

        for (const stageId in kanbanData) {
            const foundOpp = kanbanData[stageId].opportunities.find(o => o.opportunityId === opportunityId);
            if (foundOpp) {
                opportunity = foundOpp;
                oldStageId = stageId;
                break;
            }
        }

        if (!opportunity || oldStageId === newStageId) {
            return;
        }

        showLoading('正在更新階段...');
        try {
            const updateResult = await authedFetch(`/api/opportunities/${opportunity.rowIndex}`, {
                method: 'PUT',
                body: JSON.stringify({ currentStage: newStageId, modifier: getCurrentUser() })
            });

            if (updateResult.success) {
                // 直接在前端更新資料狀態，避免重新請求 API
                const oldStageOpportunities = kanbanData[oldStageId].opportunities;
                const oppIndex = oldStageOpportunities.findIndex(o => o.opportunityId === opportunityId);
                if (oppIndex > -1) {
                    oldStageOpportunities.splice(oppIndex, 1);
                }
                
                opportunity.currentStage = newStageId;
                kanbanData[newStageId].opportunities.unshift(opportunity);
                
                // 呼叫 dashboardManager 重新渲染看板
                window.dashboardManager.filterAndRenderKanban();
                showNotification(`機會 "${opportunity.opportunityName}" 已更新階段`, 'success');
            } else {
                throw new Error(updateResult.details || '更新失敗');
            }
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                showNotification('更新階段失敗，將還原操作', 'error');
                // 失敗時也重新渲染以還原外觀
                window.dashboardManager.filterAndRenderKanban();
            }
        } finally {
            hideLoading();
        }
    }
};

// 將 manager 掛載到 window，以便 HTML 中的 ondragstart 可以呼叫
window.kanbanBoardManager = kanbanBoardManager;