// config.js (已加入追蹤欄位與封存狀態)
module.exports = {
    // 環境設定
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3001,
    
    // Google Sheets 設定
    SPREADSHEET_ID: process.env.SPREADSHEET_ID || '1zHnSV9YxA3_IHlLlvUlIQI4CYz56-HFCA3Jpnk4I8U0',
    
    // Google Drive 設定
    DRIVE_FOLDER_ID: process.env.DRIVE_FOLDER_ID || '1Y_jbl2AmDIcLcuSKhLysKUheXz4SVbuG',
    
    // Google Calendar 設定
    CALENDAR_ID: process.env.CALENDAR_ID || 'c66cf51d93c97155e3f5286a5a454af560a300b256d9ca635a8c6eb52a62c5c7@group.calendar.google.com',
    TEAM_CALENDAR_NAME: 'TFC CRM測試日曆',
    TIMEZONE: 'Asia/Taipei',
    
    // 工作表名稱定義
    SHEETS: {
        CONTACTS: '原始名片資料',
        CONTACT_LIST: '聯絡人總表',
        COMPANY_LIST: '公司總表',
        OPPORTUNITIES: '機會案件工作表',
        INTERACTIONS: '互動紀錄工作表',
        SYSTEM_CONFIG: '系統設定工作表',
        CALENDAR_SYNC: '日曆整合工作表',
        EVENT_LOGS: '事件紀錄總表',
        OPPORTUNITY_CONTACT_LINK: '機會-聯絡人關聯表',
        WEEKLY_BUSINESS: '週間業務工作表',
        ANNOUNCEMENTS: '佈告欄' // 【新增】
    },
    
    // 【新增】佈告欄欄位
    ANNOUNCEMENT_FIELDS: {
        ID: 0, 
        TITLE: 1, 
        CONTENT: 2, 
        CREATOR: 3, 
        CREATE_TIME: 4, 
        LAST_UPDATE_TIME: 5, 
        STATUS: 6, 
        IS_PINNED: 7
    },

    // 【新增】機會-聯絡人關聯表欄位
    OPP_CONTACT_LINK_FIELDS: {
        LINK_ID: 0, 
        OPPORTUNITY_ID: 1, 
        CONTACT_ID: 2, 
        CREATE_TIME: 3, 
        STATUS: 4, 
        CREATOR: 5
    },

    // 原始名片資料欄位對應 (25欄，Y欄為狀態)
    CONTACT_FIELDS: {
        TIME: 0, NAME: 1, COMPANY: 2, POSITION: 3, DEPARTMENT: 4, PHONE: 5, MOBILE: 6, FAX: 7, EMAIL: 8, WEBSITE: 9, ADDRESS: 10, CONFIDENCE: 11, PROCESSING_TIME: 12, DRIVE_LINK: 13, SMART_FILENAME: 14, LOCAL_PATH: 15, RAW_TEXT: 16, AI_PARSING: 17, AI_CONFIDENCE: 18, DATA_SOURCE: 19, LINE_USER_ID: 20, USER_NICKNAME: 21, USER_TAG: 22, ORIGINAL_ID: 23, STATUS: 24
    },
    
    // 機會案件工作表欄位 (17欄)
    OPPORTUNITY_FIELDS: [
        '機會ID', '機會名稱', '客戶公司', '主要聯絡人', '聯絡人電話',
        '負責業務', '機會種類', '機會來源', '目前階段', '建立時間', 
        '預計結案日', '機會價值', '目前狀態', 'Drive資料夾連結', 
        '最後更新時間', '備註', '最後變更者','母機會ID'
    ],
    
    // 互動紀錄工作表欄位 (12欄)
    INTERACTION_FIELDS: [
        '互動ID', '機會ID', '互動時間', '互動類型', '事件標題', '內容摘要',
        '參與人員', '下次行動', '附件連結', 'Calendar事件ID', '記錄人', '建立時間'
    ],
    
    // 事件紀錄工作表欄位 (23欄)
    EVENT_LOG_FIELDS: [
        '事件ID', '事件名稱', '機會ID', '建立者', '建立時間', '下單機率', '可能下單數量',
        '銷售管道', '洽談攜帶人員', '拜訪對象', '公司規模', '拜訪地點',
        '生產線特徵', '生產現況紀錄', 'IoT現況紀錄', '需求摘要註解',
        '痛點分類', '痛點詳細說明', '系統架構描述', '外部系統串接',
        '硬體規模', '客戶對FANUC期望', '痛點補充說明'
    ],
    
    // 系統設定工作表欄位 (5欄)
    SYSTEM_CONFIG_FIELDS: [
        '設定類型', '設定項目', '顯示順序', '啟用狀態', '備註'
    ],
    
    // 聯絡人總表欄位 (13欄)
    CONTACT_LIST_FIELDS: [
        '聯絡人ID', '來源ID', '姓名', '公司ID', '部門', 
        '職稱', '手機', '公司電話', 'Email', '建立時間', '最後更新時間',
        '建立者', '最後變更者'
    ],
    
    // 【修改】公司總表欄位增加至 10 欄
    COMPANY_LIST_FIELDS: [
        '公司ID', '公司名稱', '公司電話', '地址', '建立時間', '最後更新時間',
        '縣市', '建立者', '最後變更者', '公司簡介'
    ],
    
    // 日曆整合工作表欄位 (8欄)
    CALENDAR_SYNC_FIELDS: [
        '紀錄ID', '機會ID', 'Calendar事件ID', '事件標題',
        '開始時間', '結束時間', '建立時間', '建立者'
    ],
    
    // 【結構修改】更新週間業務工作表欄位以匹配新的 Schema
    WEEKLY_BUSINESS_FIELDS: [
        '日期', 'Week ID', '分類', '主題', '參與人員', 
        '重點摘要', '待辦事項', '建立時間', '最後更新時間', 
        '建立者', '紀錄ID'
    ],

    // 分頁設定
    PAGINATION: {
        CONTACTS_PER_PAGE: 20,
        OPPORTUNITIES_PER_PAGE: 10,
        INTERACTIONS_PER_PAGE: 15,
        KANBAN_CARDS_PER_STAGE: 5
    },
    
    // Follow-up 設定
    FOLLOW_UP: {
        DAYS_THRESHOLD: 7,
        ACTIVE_STAGES: ['01_初步接觸', '02_需求確認', '03_提案報價', '04_談判修正']
    },
    
    // Calendar 事件命名格式
    CALENDAR_EVENT: {
        TITLE_FORMAT: '[{assignee}][{stage}] {company} - {description}',
        DEFAULT_DURATION: 60,
        REMINDER_MINUTES: 15
    },
    
    // 系統常數
    CONSTANTS: {
        OPPORTUNITY_STATUS: {
            ACTIVE: '進行中',
            COMPLETED: '已完成', 
            CANCELLED: '已取消',
            ARCHIVED: '已封存'
        },
        // 【新增】潛在客戶狀態，用於標記已升級的資料
        CONTACT_STATUS: {
            UPGRADED: '已升級'
        },
        DEFAULT_VALUES: {
            OPPORTUNITY_VALUE: '',
            OPPORTUNITY_STAGE: '01_初步接觸',
            OPPORTUNITY_STATUS: '進行中',
            INTERACTION_DURATION: 30
        }
    },
    
    // 錯誤訊息
    ERROR_MESSAGES: {
        AUTH_FAILED: 'Google認證失敗，請檢查設定',
        SHEET_NOT_FOUND: '找不到指定的工作表',
        INVALID_DATA: '資料格式不正確',
        NETWORK_ERROR: '網路連線錯誤，請稍後再試',
        PERMISSION_DENIED: '權限不足，請聯絡管理員'
    },
    
    // 成功訊息
    SUCCESS_MESSAGES: {
        OPPORTUNITY_CREATED: '機會案件建立成功',
        CONTACT_UPGRADED: '聯絡人升級成功',
        EVENT_CREATED: 'Calendar事件建立成功',
        DATA_UPDATED: '資料更新成功'
    },

    // ===== 認證相關設定 (更新 HASH) =====
    AUTH: {
        // 用於簽發 JWT 的密鑰，請保密
        JWT_SECRET: 'a_very_secret_and_long_key_for_tfc_crm_jwt_signature',
        JWT_EXPIRES_IN: '8h' // Token 有效期 8 小時
    }
};