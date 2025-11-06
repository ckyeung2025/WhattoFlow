-- Contact List 功能 Demo 數據
-- 請在執行前確保已創建相關表結構

-- 1. 插入廣播群組數據
INSERT INTO [dbo].[broadcast_groups] (
    [id], [company_id], [name], [description], [color], [is_active], 
    [created_at], [created_by]
) VALUES 
-- 群組 1: VIP 客戶
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 'VIP 客戶', '高價值客戶群組', '#ff6b6b', 1, GETUTCDATE(), 'admin'),

-- 群組 2: 一般客戶
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '一般客戶', '普通客戶群組', '#4ecdc4', 1, GETUTCDATE(), 'admin'),

-- 群組 3: 潛在客戶
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '潛在客戶', '潛在客戶群組', '#45b7d1', 1, GETUTCDATE(), 'admin'),

-- 群組 4: 合作夥伴
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '合作夥伴', '合作夥伴群組', '#96ceb4', 1, GETUTCDATE(), 'admin'),

-- 群組 5: 員工
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '內部員工', '公司內部員工群組', '#feca57', 1, GETUTCDATE(), 'admin');

-- 2. 插入標籤數據
INSERT INTO [dbo].[contact_hashtags] (
    [id], [company_id], [name], [description], [color], [is_active], 
    [created_at], [created_by]
) VALUES 
-- 標籤 1: 重要客戶
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '重要客戶', '標記為重要客戶', '#e74c3c', 1, GETUTCDATE(), 'admin'),

-- 標籤 2: 新客戶
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '新客戶', '新註冊的客戶', '#2ecc71', 1, GETUTCDATE(), 'admin'),

-- 標籤 3: 活躍用戶
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '活躍用戶', '經常使用的活躍用戶', '#3498db', 1, GETUTCDATE(), 'admin'),

-- 標籤 4: 待跟進
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '待跟進', '需要跟進的客戶', '#f39c12', 1, GETUTCDATE(), 'admin'),

-- 標籤 5: 已成交
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '已成交', '已完成交易的客戶', '#9b59b6', 1, GETUTCDATE(), 'admin'),

-- 標籤 6: 投訴客戶
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '投訴客戶', '有投訴記錄的客戶', '#e67e22', 1, GETUTCDATE(), 'admin'),

-- 標籤 7: 推薦客戶
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '推薦客戶', '通過推薦來的客戶', '#1abc9c', 1, GETUTCDATE(), 'admin'),

-- 標籤 8: 企業客戶
(NEWID(), (SELECT TOP 1 [id] FROM [dbo].[Companies]), 
 '企業客戶', '企業級客戶', '#34495e', 1, GETUTCDATE(), 'admin');

-- 3. 插入聯絡人數據
DECLARE @CompanyId UNIQUEIDENTIFIER = (SELECT TOP 1 [id] FROM [dbo].[Companies]);
DECLARE @VipGroupId UNIQUEIDENTIFIER = (SELECT TOP 1 [id] FROM [dbo].[broadcast_groups] WHERE [name] = 'VIP 客戶');
DECLARE @NormalGroupId UNIQUEIDENTIFIER = (SELECT TOP 1 [id] FROM [dbo].[broadcast_groups] WHERE [name] = '一般客戶');
DECLARE @PotentialGroupId UNIQUEIDENTIFIER = (SELECT TOP 1 [id] FROM [dbo].[broadcast_groups] WHERE [name] = '潛在客戶');
DECLARE @PartnerGroupId UNIQUEIDENTIFIER = (SELECT TOP 1 [id] FROM [dbo].[broadcast_groups] WHERE [name] = '合作夥伴');

INSERT INTO [dbo].[contact_lists] (
    [id], [company_id], [name], [title], [occupation], [whatsapp_number], [email], 
    [company], [department], [position], [hashtags], [broadcast_group_id], 
    [is_active], [created_at], [created_by]
) VALUES 
-- VIP 客戶
(NEWID(), @CompanyId, '張志明', '總經理', '企業家', '+852-9123-4567', 'zhang@vipcompany.com', 
 'VIP 科技公司', '管理層', 'CEO', '重要客戶,已成交,活躍用戶', @VipGroupId, 1, 'admin'),

(NEWID(), @CompanyId, '李美華', '副總裁', '高階主管', '+852-9234-5678', 'li@vipcompany.com', 
 'VIP 科技公司', '營運部', 'COO', '重要客戶,活躍用戶', @VipGroupId, 1, 'admin'),

(NEWID(), @CompanyId, '王建國', '董事長', '企業家', '+852-9345-6789', 'wang@vipcompany.com', 
 'VIP 投資集團', '董事會', 'Chairman', '重要客戶,已成交', @VipGroupId, 1, 'admin'),

-- 一般客戶
(NEWID(), @CompanyId, '陳小明', '經理', '中階主管', '+852-9456-7890', 'chen@normal.com', 
 '一般貿易公司', '銷售部', 'Sales Manager', '活躍用戶', @NormalGroupId, 1, 'admin'),

(NEWID(), @CompanyId, '林小芳', '專員', '一般員工', '+852-9567-8901', 'lin@normal.com', 
 '一般貿易公司', '行政部', 'Admin', '新客戶', @NormalGroupId, 1, 'admin'),

(NEWID(), @CompanyId, '黃大偉', '主任', '中階主管', '+852-9678-9012', 'huang@normal.com', 
 '一般貿易公司', '財務部', 'Finance Manager', '活躍用戶', @NormalGroupId, 1, 'admin'),

-- 潛在客戶
(NEWID(), @CompanyId, '劉小強', '採購經理', '中階主管', '+852-9789-0123', 'liu@potential.com', 
 '潛在客戶公司', '採購部', 'Procurement Manager', '待跟進,新客戶', @PotentialGroupId, 1, 'admin'),

(NEWID(), @CompanyId, '吳小紅', '業務代表', '一般員工', '+852-9890-1234', 'wu@potential.com', 
 '潛在客戶公司', '業務部', 'Sales Rep', '待跟進', @PotentialGroupId, 1, 'admin'),

-- 合作夥伴
(NEWID(), @CompanyId, '鄭合作', '總監', '高階主管', '+852-9901-2345', 'zheng@partner.com', 
 '合作夥伴公司', '策略部', 'Strategy Director', '已成交,活躍用戶', @PartnerGroupId, 1, 'admin'),

(NEWID(), @CompanyId, '何夥伴', '經理', '中階主管', '+852-9012-3456', 'he@partner.com', 
 '合作夥伴公司', '合作部', 'Partnership Manager', '活躍用戶', @PartnerGroupId, 1, 'admin'),

-- 更多樣化的聯絡人
(NEWID(), @CompanyId, '蔡企業', '總經理', '企業家', '+852-9123-4568', 'cai@enterprise.com', 
 '企業客戶公司', '管理層', 'CEO', '企業客戶,重要客戶,已成交', @VipGroupId, 1, 'admin'),

(NEWID(), @CompanyId, '謝推薦', '經理', '中階主管', '+852-9234-5679', 'xie@referral.com', 
 '推薦客戶公司', '業務部', 'Business Manager', '推薦客戶,新客戶', @NormalGroupId, 1, 'admin'),

(NEWID(), @CompanyId, '許投訴', '客服主管', '中階主管', '+852-9345-6780', 'xu@complaint.com', 
 '投訴客戶公司', '客服部', 'Customer Service Manager', '投訴客戶,待跟進', @NormalGroupId, 1, 'admin'),

(NEWID(), @CompanyId, '蘇活躍', '專員', '一般員工', '+852-9456-7891', 'su@active.com', 
 '活躍用戶公司', '技術部', 'Tech Specialist', '活躍用戶,新客戶', @NormalGroupId, 1, 'admin'),

(NEWID(), @CompanyId, '潘成交', '總監', '高階主管', '+852-9567-8902', 'pan@deal.com', 
 '成交客戶公司', '銷售部', 'Sales Director', '已成交,重要客戶', @VipGroupId, 1, 'admin'),

-- 一些沒有群組的聯絡人
(NEWID(), @CompanyId, '錢無群', '專員', '一般員工', '+852-9678-9013', 'qian@nogroup.com', 
 '無群組公司', '行政部', 'Admin', '新客戶', NULL, 1, 'admin'),

(NEWID(), @CompanyId, '孫測試', '測試員', '一般員工', '+852-9789-0124', 'sun@test.com', 
 '測試公司', '測試部', 'Tester', '待跟進', NULL, 1, 'admin');

-- 4. 插入廣播發送記錄數據
DECLARE @BroadcastGroupId UNIQUEIDENTIFIER = (SELECT TOP 1 [id] FROM [dbo].[broadcast_groups] WHERE [name] = 'VIP 客戶');

INSERT INTO [dbo].[broadcast_sends] (
    [id], [company_id], [broadcast_group_id], [workflow_execution_id], [message_content], 
    [total_contacts], [sent_count], [failed_count], [status], 
    [started_at], [completed_at], [created_at], [created_by]
) VALUES 
-- 已完成的廣播
(NEWID(), @CompanyId, @BroadcastGroupId, NULL, '親愛的 VIP 客戶，感謝您的支持！我們有新的優惠活動，請查看詳情。', 
 3, 3, 0, 'Completed', GETUTCDATE(), DATEADD(MINUTE, 5, GETUTCDATE()), GETUTCDATE(), 'admin'),

-- 進行中的廣播
(NEWID(), @CompanyId, @BroadcastGroupId, NULL, '重要通知：系統將於今晚進行維護，預計停機 2 小時。', 
 3, 1, 0, 'Sending', GETUTCDATE(), NULL, GETUTCDATE(), 'admin'),

-- 待發送的廣播
(NEWID(), @CompanyId, @BroadcastGroupId, NULL, '歡迎加入我們的 VIP 客戶群組！', 
 3, 0, 0, 'Pending', NULL, NULL, GETUTCDATE(), 'admin');

-- 5. 插入廣播發送詳情數據
DECLARE @CompletedBroadcastId UNIQUEIDENTIFIER = (SELECT TOP 1 [id] FROM [dbo].[broadcast_sends] WHERE [status] = 'Completed');
DECLARE @SendingBroadcastId UNIQUEIDENTIFIER = (SELECT TOP 1 [id] FROM [dbo].[broadcast_sends] WHERE [status] = 'Sending');

-- 檢查是否成功獲取到廣播記錄 ID
IF @CompletedBroadcastId IS NOT NULL AND @SendingBroadcastId IS NOT NULL
BEGIN

-- 為已完成的廣播添加詳情
INSERT INTO [dbo].[broadcast_send_details] (
    [id], [broadcast_send_id], [contact_id], [whatsapp_message_id], [status], 
    [sent_at], [error_message], [created_at], [created_by]
) VALUES 
-- 已完成廣播的詳情
(NEWID(), @CompletedBroadcastId, (SELECT TOP 1 [id] FROM [dbo].[contact_lists] WHERE [name] = '張志明'), 
 NULL, 'Sent', GETUTCDATE(), NULL, GETUTCDATE(), 'admin'),

(NEWID(), @CompletedBroadcastId, (SELECT TOP 1 [id] FROM [dbo].[contact_lists] WHERE [name] = '李美華'), 
 NULL, 'Sent', GETUTCDATE(), NULL, GETUTCDATE(), 'admin'),

(NEWID(), @CompletedBroadcastId, (SELECT TOP 1 [id] FROM [dbo].[contact_lists] WHERE [name] = '王建國'), 
 NULL, 'Sent', GETUTCDATE(), NULL, GETUTCDATE(), 'admin'),

-- 進行中廣播的詳情
(NEWID(), @SendingBroadcastId, (SELECT TOP 1 [id] FROM [dbo].[contact_lists] WHERE [name] = '張志明'), 
 NULL, 'Sent', GETUTCDATE(), NULL, GETUTCDATE(), 'admin'),

(NEWID(), @SendingBroadcastId, (SELECT TOP 1 [id] FROM [dbo].[contact_lists] WHERE [name] = '李美華'), 
 NULL, 'Pending', NULL, NULL, GETUTCDATE(), 'admin'),

(NEWID(), @SendingBroadcastId, (SELECT TOP 1 [id] FROM [dbo].[contact_lists] WHERE [name] = '王建國'), 
 NULL, 'Pending', NULL, NULL, GETUTCDATE(), 'admin');

-- 6. 顯示插入結果統計
SELECT '廣播群組' as [表名], COUNT(*) as [記錄數] FROM [dbo].[broadcast_groups]
UNION ALL
SELECT '聯絡人標籤', COUNT(*) FROM [dbo].[contact_hashtags]
UNION ALL
SELECT '聯絡人列表', COUNT(*) FROM [dbo].[contact_lists]
UNION ALL
SELECT '廣播發送', COUNT(*) FROM [dbo].[broadcast_sends]
UNION ALL
SELECT '廣播發送詳情', COUNT(*) FROM [dbo].[broadcast_send_details];

-- 7. 顯示聯絡人分組統計
SELECT 
    bg.name as [群組名稱],
    COUNT(cl.id) as [聯絡人數量],
    bg.color as [群組顏色]
FROM [dbo].[broadcast_groups] bg
LEFT JOIN [dbo].[contact_lists] cl ON bg.id = cl.broadcast_group_id
GROUP BY bg.id, bg.name, bg.color
ORDER BY COUNT(cl.id) DESC;

-- 8. 顯示標籤使用統計
SELECT 
    ch.name as [標籤名稱],
    COUNT(cl.id) as [使用次數],
    ch.color as [標籤顏色]
FROM [dbo].[contact_hashtags] ch
LEFT JOIN [dbo].[contact_lists] cl ON CHARINDEX(ch.name, cl.hashtags) > 0
GROUP BY ch.id, ch.name, ch.color
ORDER BY COUNT(cl.id) DESC;

END; -- 結束 IF 語句
