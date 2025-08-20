# E-Form 表單系統

## 🎯 **功能概述**

WhattoFlow 系統的 E-Form 表單系統是一個強大的表單設計和管理平台，支持多種表單設計引擎，包括 GrapesJS 和 Form.io，並整合了 AI 輔助功能。

## ��️ **系統架構**

### **1. 雙引擎設計**
- **GrapesJS**: 基於 HTML 的視覺化表單設計器
- **Form.io**: 專業的表單構建和渲染引擎
- **AI 輔助**: 整合 XAI (Grok-3) 智能表單生成

### **2. 核心組件**
- **表單設計器**: 拖拽式表單構建
- **表單實例**: 動態表單渲染
- **數據收集**: 表單數據存儲和管理
- **文件處理**: 支持多種文檔格式上傳

## �� **GrapesJS 設計器**

### **1. 功能特點**
- **拖拽式設計**: 直觀的組件拖拽操作
- **組件庫**: 豐富的預設組件
- **響應式設計**: 支持移動端和桌面端
- **自定義樣式**: 靈活的 CSS 樣式定制

### **2. 支持的組件類型**
```javascript
// 基本輸入組件
const basicComponents = [
  'text-input',      // 文本輸入
  'textarea',        // 多行文本
  'select',          // 下拉選擇
  'radio',           // 單選按鈕
  'checkbox',        // 複選框
  'button'           // 按鈕
];

// 佈局組件
const layoutComponents = [
  'panel',           // 面板
  'fieldset',        // 字段集
  'container',       // 容器
  'grid'             // 網格佈局
];

// 高級組件
const advancedComponents = [
  'date-picker',     // 日期選擇器
  'file-upload',     // 文件上傳
  'signature',       // 簽名組件
  'table'            // 表格組件
];
```

### **3. 組件編輯器**
```javascript
// 文本輸入編輯器
const TextInputEditor = {
  model: {
    defaults: {
      tagName: 'input',
      type: 'text',
      placeholder: '請輸入...',
      required: false,
      attributes: { class: 'form-control' }
    }
  },
  
  view: {
    onRender() {
      // 渲染邏輯
    }
  }
};

// 註冊組件
editor.Components.addType('text-input', TextInputEditor);
```

## 📋 **Form.io 引擎**

### **1. 功能特點**
- **專業表單構建**: 企業級表單解決方案
- **複雜佈局**: 支持矩陣和表格佈局
- **驗證規則**: 強大的表單驗證
- **條件邏輯**: 動態表單顯示

### **2. 表單定義結構**
```json
{
  "components": [
    {
      "type": "textfield",
      "label": "姓名",
      "key": "name",
      "input": true,
      "validate": {
        "required": true,
        "minLength": 2
      }
    },
    {
      "type": "email",
      "label": "電子郵件",
      "key": "email",
      "input": true,
      "validate": {
        "required": true,
        "email": true
      }
    },
    {
      "type": "select",
      "label": "部門",
      "key": "department",
      "input": true,
      "data": {
        "values": [
          {"label": "技術部", "value": "tech"},
          {"label": "市場部", "value": "marketing"},
          {"label": "人事部", "value": "hr"}
        ]
      }
    }
  ]
}
```

### **3. 矩陣/表格功能**
```json
{
  "type": "datagrid",
  "label": "工作經驗",
  "key": "workExperience",
  "input": true,
  "components": [
    {
      "type": "textfield",
      "label": "公司名稱",
      "key": "company"
    },
    {
      "type": "textfield",
      "label": "職位",
      "key": "position"
    },
    {
      "type": "date",
      "label": "開始日期",
      "key": "startDate"
    },
    {
      "type": "date",
      "label": "結束日期",
      "key": "endDate"
    }
  ]
}
```

## 🤖 **AI 輔助功能**

### **1. XAI 集成**
- **模型**: Grok-3
- **功能**: 智能表單生成
- **輸入**: 自然語言描述
- **輸出**: 完整的 HTML 表單

### **2. AI 提示詞**
```javascript
const aiPrompts = {
  systemPrompt: `你是一個專業的 HTML 表單設計師。請生成完整的 HTML 表單，包含完整的 DOCTYPE、html、head、body 標籤和內嵌 CSS 樣式。
  
  要求：
  - 必須包含完整的 HTML 結構：<!DOCTYPE html>、<html>、<head>、<body>
  - 在 <head> 中內嵌完整的 CSS 樣式表
  - 使用 HTML table 元素組織表單結構
  - 表格標題行使用背景色和白色文字
  - 包含輸入欄位、標籤、按鈕等完整表單元素
  - 響應式設計，支持移動設備
  - 只使用 HTML 和 CSS，不使用 JavaScript
  - 表單必須自包含，不依賴外部資源`,
  
  formAnalysisPrompt: `請把我附上的HTML，和人類自然語言輸入，分析出人類輸入的 message 有那些對應值，及匹配到 form 中的欄位，作為html固定值的重新再回應輸出到系統，如輸入關於日期的值欠了年份請用現在年份補充後才放進HTML。`
};
```

### **3. AI 表單生成流程**
```javascript
const generateFormWithAI = async (description) => {
  try {
    const response = await fetch('/api/ai/generate-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: description,
        systemPrompt: aiPrompts.systemPrompt
      })
    });
    
    const result = await response.json();
    if (result.success) {
      return result.htmlContent;
    }
  } catch (error) {
    console.error('AI 表單生成失敗:', error);
  }
};
```

## �� **文件處理功能**

### **1. 支持的文件格式**
- **Word 文檔**: .doc, .docx
- **Excel 表格**: .xls, .xlsx
- **PowerPoint**: .ppt, .pptx
- **PDF 文件**: .pdf
- **圖片文件**: .jpg, .png, .gif
- **純文本**: .txt

### **2. 文件上傳組件**
```jsx
const FileUploadComponent = () => {
  const [uploading, setUploading] = useState(false);
  
  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/forms-upload/document', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      if (result.success) {
        // 處理上傳成功
        message.success('文件上傳成功');
      }
    } catch (error) {
      message.error('上傳失敗');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <Upload
      accept=".doc,.docx,.xls,.xlsx,.pdf,.jpg,.png,.gif,.txt"
      beforeUpload={(file) => {
        handleUpload(file);
        return false; // 阻止自動上傳
      }}
    >
      <Button icon={<UploadOutlined />} loading={uploading}>
        上傳文件
      </Button>
    </Upload>
  );
};
```

## ��️ **數據存儲**

### **1. 表單定義表**
```sql
CREATE TABLE eFormDefinitions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    company_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(255),
    html_code NVARCHAR(MAX) NOT NULL, -- 儲存整個 HTML+JS
    form_definition NVARCHAR(MAX),    -- Form.io JSON 定義
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME,
    created_user_id UNIQUEIDENTIFIER NOT NULL,
    updated_user_id UNIQUEIDENTIFIER,
    status NVARCHAR(20) DEFAULT 'Active'
);
```

### **2. 表單實例表**
```sql
CREATE TABLE eFormInstances (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    form_definition_id UNIQUEIDENTIFIER NOT NULL,
    company_id UNIQUEIDENTIFIER NOT NULL,
    status NVARCHAR(20) DEFAULT 'Draft',
    submitted_at DATETIME,
    submitted_by UNIQUEIDENTIFIER,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME
);
```

### **3. 表單數據表**
```sql
CREATE TABLE eFormData (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    instance_id UNIQUEIDENTIFIER NOT NULL,
    field_key NVARCHAR(100) NOT NULL,
    field_value NVARCHAR(MAX),
    field_type NVARCHAR(50),
    created_at DATETIME DEFAULT GETDATE()
);
```

## �� **技術實現**

### **1. 前端架構**
```jsx
// EFormDesigner 組件
const EFormDesigner = ({ initialSchema, onSave, onBack }) => {
  const [htmlContent, setHtmlContent] = useState('');
  const [formName, setFormName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // GrapesJS 編輯器引用
  const editorRef = useRef(null);
  
  // 使用自定義 Hook
  const { editor: grapesEditor, isReady: isEditorReady } = useGrapesJS(
    editorRef, 
    htmlContent,
    (readyEditor) => {
      // 設置事件監聽器
      readyEditor.on('edit-component-requested', (component) => {
        // 處理組件編輯請求
      });
      
      readyEditor.on('component:selected', (component) => {
        // 處理組件選擇
      });
    }
  );
  
  return (
    <div className="eform-designer">
      <div className="toolbar">
        <Button onClick={onBack} icon={<ArrowLeftOutlined />}>
          返回
        </Button>
        <Button 
          type="primary" 
          onClick={handleSave}
          loading={isSaving}
          icon={<SaveOutlined />}
        >
          保存
        </Button>
      </div>
      
      <div ref={editorRef} className="editor-container" />
    </div>
  );
};
```

### **2. 後端 API**
```csharp
[ApiController]
[Route("api/eforms")]
public class EFormDefinitionsController : ControllerBase
{
    private readonly PurpleRiceDbContext _context;
    private readonly LoggingService _loggingService;
    
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEFormRequest request)
    {
        try
        {
            var eform = new eFormDefinition
            {
                Id = Guid.NewGuid(),
                CompanyId = GetCurrentUserCompanyId(),
                Name = request.Name,
                Description = request.Description,
                HtmlCode = request.HtmlCode,
                FormDefinition = request.FormDefinition,
                CreatedUserId = GetCurrentUserId(),
                CreatedAt = DateTime.UtcNow,
                Status = "Active"
            };
            
            _context.eFormDefinitions.Add(eform);
            await _context.SaveChangesAsync();
            
            return Ok(new { success = true, data = eform });
        }
        catch (Exception ex)
        {
            _loggingService.LogError(ex, "創建表單定義失敗");
            return BadRequest(new { success = false, message = ex.Message });
        }
    }
}
```

## �� **使用流程**

### **1. 創建表單**
1. 選擇表單設計器（GrapesJS 或 Form.io）
2. 設計表單佈局和組件
3. 配置組件屬性和驗證規則
4. 預覽表單效果
5. 保存表單定義

### **2. 部署表單**
1. 設置表單狀態為 Active
2. 配置表單權限和訪問控制
3. 生成表單訪問鏈接
4. 分發給目標用戶

### **3. 數據收集**
1. 用戶填寫表單
2. 系統驗證輸入數據
3. 保存表單實例和數據
4. 發送通知和後續處理

## ⚠️ **注意事項**

### **1. 性能考慮**
- 大表單可能需要分頁處理
- 圖片和文件上傳需要大小限制
- 複雜驗證規則可能影響響應速度

### **2. 安全考慮**
- 文件上傳需要類型驗證
- 表單數據需要 XSS 防護
- 權限控制要嚴格實施

### **3. 兼容性**
- 不同瀏覽器的表單渲染差異
- 移動端和桌面端的響應式設計
- 舊版本瀏覽器的降級處理

## �� **未來改進**

### **1. 功能增強**
- 更多組件類型支持
- 高級驗證規則
- 條件邏輯編輯器
- 工作流集成

### **2. 性能優化**
- 組件懶加載
- 表單緩存機制
- 批量數據處理
- 異步驗證

### **3. 用戶體驗**
- 拖拽排序優化
- 實時預覽
- 模板庫
- 協作編輯

---

**最後更新**: 2025年8月20日
**系統版本**: v2.0
