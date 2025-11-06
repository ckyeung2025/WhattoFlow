# 密碼 Hash 遷移指南

## 概述

系統已實現密碼 hash 功能，使用 BCrypt 算法對密碼進行安全存儲。所有新密碼在保存時會自動進行 hash，舊的明文密碼會在用戶登入時自動轉換為 hash 格式。

## 功能說明

### 1. 自動 Hash 功能

- **登入時自動遷移**：當用戶使用明文密碼登入時，系統會自動將明文密碼轉換為 hash 並更新數據庫
- **創建用戶時自動 Hash**：創建新用戶時，如果提供的是明文密碼，會自動進行 hash
- **更新密碼時自動 Hash**：更新用戶密碼時，如果提供的是明文密碼，會自動進行 hash

### 2. 密碼驗證

- 支持驗證 BCrypt hash 密碼
- 兼容舊的明文密碼（用於遷移期間）
- 登入時會自動檢測並遷移明文密碼

## 使用方式

### 檢查需要遷移的用戶

使用 API 端點檢查需要遷移的用戶數量：

```bash
GET /api/migratepasswords/check
```

響應示例：
```json
{
  "totalUsers": 100,
  "nullPasswords": 5,
  "hashedPasswords": 80,
  "plaintextPasswords": 15,
  "needsMigration": true
}
```

### 查看需要遷移的用戶列表

```bash
GET /api/migratepasswords/users-to-migrate
```

### 手動重置用戶密碼（用於遷移）

如果需要手動為用戶重置密碼：

```bash
POST /api/migratepasswords/reset-password/{userId}
Content-Type: application/json

{
  "newPassword": "新密碼"
}
```

## SQL 查詢

### 查看需要遷移的用戶

執行 `Database/Migrate_Passwords_To_Hash.sql` 中的查詢來查看需要遷移的用戶：

```sql
-- 查看需要遷移的用戶
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
```

## 遷移策略

### 自動遷移（推薦）

系統會在用戶登入時自動將明文密碼轉換為 hash。這是最安全的方式，因為：

1. 不需要知道原始明文密碼
2. 用戶在登入時自動完成遷移
3. 不會影響用戶體驗

### 手動遷移

如果需要批量重置密碼：

1. 使用 `GET /api/migratepasswords/users-to-migrate` 獲取需要遷移的用戶列表
2. 為每個用戶使用 `POST /api/migratepasswords/reset-password/{userId}` 重置密碼
3. 通知用戶使用新密碼登入

## 安全注意事項

1. **不要直接更新數據庫**：不要直接在 SQL 中執行 UPDATE 來更新密碼，因為 BCrypt hash 需要在應用層生成
2. **保護 API 端點**：`MigratePasswordsController` 應該只允許管理員訪問
3. **記錄操作**：所有密碼相關操作都會記錄在日誌中
4. **定期檢查**：定期使用檢查 API 查看是否還有需要遷移的用戶

## 技術細節

### BCrypt 配置

- **Work Factor**: 12（平衡安全性和性能）
- **算法**: BCrypt (Blowfish)
- **Hash 格式**: `$2a$`, `$2b$`, `$2x$`, `$2y$`

### 兼容性

- 系統會自動檢測密碼是否已經是 hash 格式
- 如果是明文，會在保存時自動 hash
- 如果是 hash，會直接使用（不重複 hash）

## 相關文件

- `Services/PasswordService.cs` - 密碼處理服務
- `Controllers/MigratePasswordsController.cs` - 密碼遷移控制器
- `Database/Migrate_Passwords_To_Hash.sql` - SQL 查詢腳本
- `Controllers/AuthController.cs` - 登入邏輯（包含自動遷移）
- `Controllers/UserController.cs` - 用戶管理（包含自動 hash）
- `Controllers/UsersController.cs` - 用戶管理（包含自動 hash）

