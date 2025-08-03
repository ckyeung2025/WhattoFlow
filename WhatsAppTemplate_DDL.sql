-- WhatsApp 訊息模板表
CREATE TABLE WhatsAppTemplates (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500),
    Category NVARCHAR(100) DEFAULT 'General',
    TemplateType NVARCHAR(50) NOT NULL DEFAULT 'Text', -- Text, Media, Interactive, Template
    Content NVARCHAR(MAX) NOT NULL, -- JSON 格式存儲模板內容
    Variables NVARCHAR(MAX), -- JSON 格式存儲變數定義
    Status NVARCHAR(20) DEFAULT 'Active', -- Active, Inactive, Draft
    Language NVARCHAR(10) DEFAULT 'zh-TW',
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedBy NVARCHAR(100),
    CompanyId UNIQUEIDENTIFIER,
    IsDeleted BIT DEFAULT 0,
    Version INT DEFAULT 1
);

-- 創建索引
CREATE INDEX IX_WhatsAppTemplates_Status ON WhatsAppTemplates(Status);
CREATE INDEX IX_WhatsAppTemplates_Category ON WhatsAppTemplates(Category);
CREATE INDEX IX_WhatsAppTemplates_CreatedAt ON WhatsAppTemplates(CreatedAt);
CREATE INDEX IX_WhatsAppTemplates_CompanyId ON WhatsAppTemplates(CompanyId);

-- 模板使用記錄表
CREATE TABLE WhatsAppTemplateUsage (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TemplateId UNIQUEIDENTIFIER NOT NULL,
    WorkflowId UNIQUEIDENTIFIER,
    NodeId NVARCHAR(100), -- 流程節點 ID
    UsedAt DATETIME2 DEFAULT GETUTCDATE(),
    UsedBy NVARCHAR(100),
    Variables NVARCHAR(MAX), -- 實際使用的變數值
    Status NVARCHAR(20) DEFAULT 'Sent', -- Sent, Failed, Pending
    MessageId NVARCHAR(200), -- WhatsApp API 返回的訊息 ID
    FOREIGN KEY (TemplateId) REFERENCES WhatsAppTemplates(Id)
);

-- 創建索引
CREATE INDEX IX_WhatsAppTemplateUsage_TemplateId ON WhatsAppTemplateUsage(TemplateId);
CREATE INDEX IX_WhatsAppTemplateUsage_WorkflowId ON WhatsAppTemplateUsage(WorkflowId);
CREATE INDEX IX_WhatsAppTemplateUsage_UsedAt ON WhatsAppTemplateUsage(UsedAt);

-- 插入示例數據
INSERT INTO WhatsAppTemplates (Name, Description, Category, TemplateType, Content, Variables, Language, CreatedBy, UpdatedBy) VALUES
('歡迎訊息', '新客戶歡迎訊息模板', 'Welcome', 'Text', 
'{"type": "text", "content": "您好！歡迎使用我們的服務。\n\n您的訂單編號：{{orderNumber}}\n預計送達時間：{{deliveryDate}}\n\n如有任何問題，請隨時聯繫我們。"}', 
'[{"name": "orderNumber", "type": "string", "description": "訂單編號"}, {"name": "deliveryDate", "type": "date", "description": "送達日期"}]',
'zh-TW', 'System', 'System'),

('訂單確認', '訂單確認訊息模板', 'Order', 'Text',
'{"type": "text", "content": "您的訂單已確認！\n\n📦 訂單詳情：\n商品：{{productName}}\n數量：{{quantity}}\n總價：{{totalAmount}}\n\n🚚 配送資訊：\n地址：{{address}}\n電話：{{phone}}\n\n感謝您的購買！"}',
'[{"name": "productName", "type": "string", "description": "商品名稱"}, {"name": "quantity", "type": "number", "description": "數量"}, {"name": "totalAmount", "type": "currency", "description": "總金額"}, {"name": "address", "type": "string", "description": "配送地址"}, {"name": "phone", "type": "phone", "description": "聯絡電話"}]',
'zh-TW', 'System', 'System'),

('促銷活動', '促銷活動訊息模板', 'Marketing', 'Media',
'{"type": "media", "content": "🎉 限時優惠！\n\n{{promotionTitle}}\n\n💡 優惠內容：\n{{promotionDetails}}\n\n⏰ 活動期間：{{startDate}} - {{endDate}}\n\n立即點擊連結搶購：{{promotionLink}}", "mediaUrl": "{{imageUrl}}", "mediaType": "image"}',
'[{"name": "promotionTitle", "type": "string", "description": "促銷標題"}, {"name": "promotionDetails", "type": "text", "description": "促銷詳情"}, {"name": "startDate", "type": "date", "description": "開始日期"}, {"name": "endDate", "type": "date", "description": "結束日期"}, {"name": "promotionLink", "type": "url", "description": "促銷連結"}, {"name": "imageUrl", "type": "url", "description": "圖片連結"}]',
'zh-TW', 'System', 'System'),

('客服回覆', '客服自動回覆模板', 'Support', 'Interactive',
'{"type": "interactive", "content": "您好！我是客服助手。\n\n請選擇您需要的服務：\n\n1️⃣ 訂單查詢\n2️⃣ 退換貨申請\n3️⃣ 產品諮詢\n4️⃣ 聯繫人工客服", "buttons": [{"text": "訂單查詢", "value": "order_query"}, {"text": "退換貨", "value": "return_exchange"}, {"text": "產品諮詢", "value": "product_info"}, {"text": "人工客服", "value": "human_service"}]}',
'[]',
'zh-TW', 'System', 'System');