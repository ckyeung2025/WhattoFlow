-- =============================================
-- 密碼遷移腳本：將明文密碼轉換為 BCrypt Hash
-- 
-- 注意：此腳本需要配合 C# 應用程序執行，因為 BCrypt hash 需要在應用層生成
-- 此 SQL 腳本僅用於查詢和標記需要更新的記錄
-- 
-- 執行方式：
-- 1. 先執行此腳本查看需要更新的用戶數量
-- 2. 使用 C# 應用程序中的 MigratePasswordsController 來實際執行遷移
-- =============================================

-- 查看需要遷移的用戶（密碼不是 BCrypt hash 格式的）
SELECT 
    id,
    account,
    name,
    email,
    CASE 
        WHEN password_hash IS NULL THEN 'NULL'
        WHEN password_hash LIKE '$2a$%' OR password_hash LIKE '$2b$%' OR password_hash LIKE '$2x$%' OR password_hash LIKE '$2y$%' THEN '已 Hash'
        ELSE '需要遷移（明文）'
    END AS password_status,
    LEN(password_hash) AS password_length,
    created_at
FROM [dbo].[users]
WHERE password_hash IS NOT NULL
    AND password_hash NOT LIKE '$2a$%'
    AND password_hash NOT LIKE '$2b$%'
    AND password_hash NOT LIKE '$2x$%'
    AND password_hash NOT LIKE '$2y$%'
ORDER BY created_at DESC;

-- 統計需要遷移的用戶數量
SELECT 
    COUNT(*) AS total_users_to_migrate,
    COUNT(CASE WHEN password_hash IS NULL THEN 1 END) AS null_passwords,
    COUNT(CASE WHEN password_hash IS NOT NULL 
               AND password_hash NOT LIKE '$2a$%'
               AND password_hash NOT LIKE '$2b$%'
               AND password_hash NOT LIKE '$2x$%'
               AND password_hash NOT LIKE '$2y$%' THEN 1 END) AS plaintext_passwords
FROM [dbo].[users];

-- =============================================
-- 警告：不要直接在此 SQL 中執行 UPDATE，因為：
-- 1. BCrypt hash 需要在應用層使用正確的算法生成
-- 2. 需要知道原始明文密碼才能正確 hash
-- 3. 直接 UPDATE 會導致密碼無法驗證
-- 
-- 請使用 C# 應用程序中的 MigratePasswordsController 來執行遷移
-- =============================================

