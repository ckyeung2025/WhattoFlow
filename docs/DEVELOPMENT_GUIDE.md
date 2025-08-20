# WhattoFlow 開發指南

## �� **快速開始**

### **環境要求**
- **後端**: .NET 8.0 SDK, SQL Server 2019+
- **前端**: Node.js 18+, npm 或 yarn
- **數據庫**: SQL Server Express 或更高版本
- **文檔轉換**: LibreOffice (自動安裝腳本提供)

### **安裝步驟**

#### **1. 克隆項目**
```bash
git clone [repository-url]
cd WhattoFlow
```

#### **2. 後端設置**
```bash
# 還原 NuGet 包
dotnet restore

# 更新數據庫
dotnet ef database update

# 啟動應用
dotnet run
```

#### **3. 前端設置**
```bash
# 安裝依賴
npm install

# 啟動開發服務器
npm start
```

#### **4. 安裝 LibreOffice**
```powershell
# 使用自動安裝腳本
.\InstallLibreOffice.ps1
```

## ��️ **項目結構**

### **後端結構**
```
WhattoFlow/
├── Controllers/           # API 控制器
├── Models/               # 數據模型
├── Services/             # 業務邏輯服務
├── Data/                 # 數據上下文
├── Program.cs            # 應用程序入口
└── appsettings.json     # 配置文件
```

### **前端結構**
```
src/
├── components/           # 可重用組件
├── pages/               # 頁面組件
├── contexts/            # React Context
├── hooks/               # 自定義 Hooks
├── locales/             # 國際化文件
└── App.js               # 主應用組件
```

##  **開發工作流**

### **1. 功能開發流程**
1. **需求分析**: 明確功能需求和業務邏輯
2. **數據模型設計**: 設計數據庫表結構
3. **後端 API 開發**: 實現業務邏輯和 API 端點
4. **前端界面開發**: 實現用戶界面和交互邏輯
5. **測試驗證**: 功能測試和集成測試
6. **代碼審查**: 代碼質量和安全性檢查

### **2. 代碼規範**
- **命名規範**: 使用 PascalCase (C#) 和 camelCase (JavaScript)
- **文件組織**: 按功能模組組織文件
- **註釋規範**: 關鍵邏輯必須添加註釋
- **錯誤處理**: 統一的異常處理機制

##  **核心概念**

### **1. 多租戶架構**
- **公司隔離**: 每個公司有獨立的數據空間
- **權限控制**: 基於用戶角色的權限管理
- **配置管理**: 公司級別的系統配置

### **2. 工作流引擎**
- **流程定義**: 使用 JSON 格式定義工作流
- **節點類型**: 支持多種業務節點
- **執行引擎**: 異步執行工作流實例

### **3. 數據集管理**
- **數據源**: 支持多種數據源類型
- **欄位定義**: 動態欄位配置
- **數據同步**: 定時和手動數據同步

##  **API 開發**

### **1. 控制器結構**
```csharp
[ApiController]
[Route("api/[controller]")]
public class ExampleController : ControllerBase
{
    private readonly IExampleService _service;
    private readonly LoggingService _loggingService;

    public ExampleController(IExampleService service, 
                           Func<string, LoggingService> loggingServiceFactory)
    {
        _service = service;
        _loggingService = loggingServiceFactory("ExampleController");
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        try
        {
            var result = await _service.GetDataAsync();
            return Ok(new { success = true, data = result });
        }
        catch (Exception ex)
        {
            _loggingService.LogError($"獲取數據失敗: {ex.Message}", ex);
            return BadRequest(new { success = false, message = ex.Message });
        }
    }
}
```

##  **前端開發**

### **1. 組件開發**
```jsx
import React, { useState, useEffect } from 'react';
import { Button, message } from 'antd';
import { useLanguage } from '../contexts/LanguageContext';

const ExampleComponent = ({ data, onSave }) => {
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(data);
      message.success(t('common.saveSuccess'));
    } catch (error) {
      message.error(t('common.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      type="primary" 
      loading={loading}
      onClick={handleSave}
    >
      {t('common.save')}
    </Button>
  );
};

export default ExampleComponent;
```

## ️ **數據庫開發**

### **1. Entity Framework 配置**
```csharp
public class PurpleRiceDbContext : DbContext
{
    public DbSet<Example> Examples { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Example>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            
            // 索引配置
            entity.HasIndex(e => e.CompanyId);
            entity.HasIndex(e => e.CreatedAt);
        });
    }
}
```

---

**文檔版本**: 1.0.0  
**最後更新**: 2025年8月20日  
**維護者**: 開發團隊
```