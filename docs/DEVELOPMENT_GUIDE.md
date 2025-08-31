# WhattoFlow 開發指南

## 🚀 **快速開始**

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

## 🏗️ **項目結構**

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

## 🔄 **開發工作流**

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

## 🧠 **核心概念**

### **1. 多租戶架構**
- **公司隔離**: 每個公司有獨立的數據空間
- **權限控制**: 基於用戶角色的權限管理
- **配置管理**: 公司級別的系統配置

### **2. 工作流引擎**
- **流程定義**: 使用 JSON 格式定義工作流
- **節點類型**: 支持多種業務節點
- **執行引擎**: 異步執行工作流實例
- **流程變量**: Process Variables 支持動態數據管理

### **3. 數據集管理**
- **數據源**: 支持多種數據源類型
- **欄位定義**: 動態欄位配置
- **數據同步**: 定時和手動數據同步
- **工作流集成**: 在流程中查詢和更新數據集

### **4. 流程變量系統**
- **變量定義**: 支持多種數據類型 (string, int, decimal, datetime, boolean, json)
- **變量映射**: DataSet、eForm、外部 API 的雙向數據映射
- **Tag 語法**: 支持 ${variable} 語法在消息和表單中使用
- **實時監控**: 流程執行時的變量值追蹤

## 🔌 **API 開發**

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

### **2. 流程變量 API 開發**
```csharp
[ApiController]
[Route("api/[controller]")]
public class ProcessVariablesController : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> SetVariable([FromBody] SetVariableRequest request)
    {
        try
        {
            // 根據變量類型設置對應的值欄位
            var variableValue = new ProcessVariableValue
            {
                WorkflowExecutionId = request.WorkflowExecutionId,
                VariableName = request.VariableName,
                DataType = request.DataType,
                StringValue = request.DataType == "string" ? request.Value : null,
                NumericValue = request.DataType == "decimal" ? decimal.Parse(request.Value) : null,
                DateValue = request.DataType == "datetime" ? DateTime.Parse(request.Value) : null,
                BooleanValue = request.DataType == "boolean" ? bool.Parse(request.Value) : null,
                JsonValue = request.DataType == "json" ? request.Value : null
            };
            
            // 保存到數據庫
            await _context.ProcessVariableValues.AddAsync(variableValue);
            await _context.SaveChangesAsync();
            
            return Ok(new { success = true, data = variableValue });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }
}
```

## 🎨 **前端開發**

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

### **2. 流程變量管理組件**
```jsx
import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Space } from 'antd';

const ProcessVariableForm = ({ variable, onSave }) => {
  const [form] = Form.useForm();
  const [dataType, setDataType] = useState(variable?.dataType || 'string');

  const handleDataTypeChange = (value) => {
    setDataType(value);
    form.setFieldsValue({ 
      defaultValue: '',
      jsonSchema: value === 'json' ? '{}' : undefined
    });
  };

  return (
    <Form form={form} layout="vertical" onFinish={onSave}>
      <Form.Item name="variableName" label="變量名稱" rules={[{ required: true }]}>
        <Input placeholder="例如: customer_name" />
      </Form.Item>
      
      <Form.Item name="dataType" label="數據類型" rules={[{ required: true }]}>
        <Select onChange={handleDataTypeChange}>
          <Select.Option value="string">字串</Select.Option>
          <Select.Option value="int">整數</Select.Option>
          <Select.Option value="decimal">小數</Select.Option>
          <Select.Option value="datetime">日期時間</Select.Option>
          <Select.Option value="boolean">布林值</Select.Option>
          <Select.Option value="json">JSON</Select.Option>
        </Select>
      </Form.Item>
      
      {dataType === 'json' && (
        <Form.Item name="jsonSchema" label="JSON Schema">
          <Input.TextArea rows={4} placeholder="定義 JSON 結構..." />
        </Form.Item>
      )}
      
      <Form.Item>
        <Button type="primary" htmlType="submit">保存變量</Button>
      </Form.Item>
    </Form>
  );
};
```

### **3. Switch 節點配置組件**
```jsx
import React, { useState } from 'react';
import { Form, Input, Select, Button, Card, Space, Switch } from 'antd';

const SwitchNodeConfig = ({ nodeData, onSave }) => {
  const [form] = Form.useForm();
  const [conditions, setConditions] = useState(nodeData?.conditions || []);

  const addCondition = () => {
    const newCondition = {
      id: `condition_${Date.now()}`,
      name: '',
      type: 'variable_check',
      config: {},
      targetNode: '',
      isDefault: false
    };
    setConditions([...conditions, newCondition]);
  };

  return (
    <div>
      <h3>Switch 節點配置</h3>
      
      {conditions.map((condition, index) => (
        <Card key={condition.id} size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="條件名稱">
            <Input 
              value={condition.name}
              onChange={(e) => {
                const newConditions = [...conditions];
                newConditions[index].name = e.target.value;
                setConditions(newConditions);
              }}
            />
          </Form.Item>
          
          <Form.Item label="條件類型">
            <Select 
              value={condition.type}
              onChange={(value) => {
                const newConditions = [...conditions];
                newConditions[index].type = value;
                setConditions(newConditions);
              }}
            >
              <Select.Option value="variable_check">變量檢查</Select.Option>
              <Select.Option value="expression">表達式</Select.Option>
              <Select.Option value="dataset_query">數據集查詢</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item label="目標節點">
            <Input 
              value={condition.targetNode}
              onChange={(e) => {
                const newConditions = [...conditions];
                newConditions[index].targetNode = e.target.value;
                setConditions(newConditions);
              }}
            />
          </Form.Item>
          
          <Form.Item label="默認分支">
            <Switch 
              checked={condition.isDefault}
              onChange={(checked) => {
                const newConditions = [...conditions];
                newConditions[index].isDefault = checked;
                setConditions(newConditions);
              }}
            />
          </Form.Item>
        </Card>
      ))}
      
      <Button type="dashed" onClick={addCondition} block>
        添加條件
      </Button>
      
      <Button type="primary" onClick={() => onSave({ conditions })} style={{ marginTop: 16 }}>
        保存配置
      </Button>
    </div>
  );
};
```

## 🗄️ **數據庫開發**

### **1. Entity Framework 配置**
```csharp
public class PurpleRiceDbContext : DbContext
{
    public DbSet<ProcessVariableDefinition> ProcessVariableDefinitions { get; set; }
    public DbSet<ProcessVariableValue> ProcessVariableValues { get; set; }
    public DbSet<VariableMapping> VariableMappings { get; set; }
    public DbSet<SwitchNodeCondition> SwitchNodeConditions { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // 流程變量定義配置
        modelBuilder.Entity<ProcessVariableDefinition>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.VariableName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.DataType).IsRequired().HasMaxLength(50);
            entity.Property(e => e.JsonSchema).HasColumnType("nvarchar(max)");
            
            // 索引配置
            entity.HasIndex(e => e.WorkflowDefinitionId);
            entity.HasIndex(e => e.VariableName);
        });

        // 流程變量值配置
        modelBuilder.Entity<ProcessVariableValue>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.VariableName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.DataType).IsRequired().HasMaxLength(50);
            entity.Property(e => e.JsonValue).HasColumnType("nvarchar(max)");
            
            // 索引配置
            entity.HasIndex(e => e.WorkflowExecutionId);
            entity.HasIndex(e => e.VariableName);
            entity.HasIndex(e => e.SetAt);
        });
    }
}
```

### **2. 流程變量模型設計**
```csharp
public class ProcessVariableDefinition
{
    public Guid Id { get; set; }
    public int WorkflowDefinitionId { get; set; }
    public string VariableName { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string DataType { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsRequired { get; set; } = false;
    public string? DefaultValue { get; set; }
    public string? ValidationRules { get; set; }
    public string? JsonSchema { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string? UpdatedBy { get; set; }
}

public class ProcessVariableValue
{
    public Guid Id { get; set; }
    public int WorkflowExecutionId { get; set; }
    public string VariableName { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    
    // 值存儲（根據 data_type 選擇對應的欄位）
    public string? StringValue { get; set; }
    public decimal? NumericValue { get; set; }
    public DateTime? DateValue { get; set; }
    public bool? BooleanValue { get; set; }
    public string? TextValue { get; set; }
    public string? JsonValue { get; set; }
    
    public DateTime SetAt { get; set; }
    public string? SetBy { get; set; }
    public string? SourceType { get; set; }
    public string? SourceReference { get; set; }
}
```

## 🔧 **工作流節點開發**

### **1. 新節點類型註冊**
```csharp
public class WorkflowNodeTypeRegistry
{
    private readonly Dictionary<string, IWorkflowNodeHandler> _handlers;
    
    public WorkflowNodeTypeRegistry()
    {
        _handlers = new Dictionary<string, IWorkflowNodeHandler>
        {
            { "waitQRCode", new QRCodeNodeHandler() },
            { "switch", new SwitchNodeHandler() },
            { "datasetQuery", new DataSetQueryNodeHandler() },
            { "datasetUpdate", new DataSetUpdateNodeHandler() }
        };
    }
    
    public IWorkflowNodeHandler GetHandler(string nodeType)
    {
        return _handlers.TryGetValue(nodeType, out var handler) ? handler : null;
    }
}
```

### **2. QR Code 節點處理器**
```csharp
public class QRCodeNodeHandler : IWorkflowNodeHandler
{
    public async Task<WorkflowNodeResult> ExecuteAsync(WorkflowNodeContext context)
    {
        try
        {
            var nodeData = context.NodeData;
            var qrCodeConfig = JsonSerializer.Deserialize<QRCodeConfig>(nodeData.ToString());
            
            // 等待 QR Code 圖片
            var qrCodeResult = await WaitForQRCode(context.WorkflowExecutionId, qrCodeConfig);
            
            // 處理 QR Code 數據
            var extractedData = ProcessQRCode(qrCodeResult);
            
            // 映射到流程變量
            await MapToProcessVariables(context.WorkflowExecutionId, extractedData, qrCodeConfig.FieldMappings);
            
            // 執行數據集查詢（如果配置了）
            if (qrCodeConfig.DatasetLookup?.Enabled == true)
            {
                await ExecuteDatasetLookup(context, extractedData, qrCodeConfig.DatasetLookup);
            }
            
            return new WorkflowNodeResult { Success = true, Data = extractedData };
        }
        catch (Exception ex)
        {
            return new WorkflowNodeResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}
```

---

**文檔版本**: 2.1.0  
**最後更新**: 2025年8月31日  
**維護者**: 開發團隊