-- 為 companies 表添加 WA_VerifyToken 列
ALTER TABLE companies ADD WA_VerifyToken NVARCHAR(500) NULL;

-- 更新現有記錄，設置默認的 VerifyToken 值
UPDATE companies SET WA_VerifyToken = 'TEST001' WHERE WA_VerifyToken IS NULL;

-- 顯示更新結果
SELECT id, name, WA_API_Key, WA_PhoneNo_ID, WA_VerifyToken FROM companies; 