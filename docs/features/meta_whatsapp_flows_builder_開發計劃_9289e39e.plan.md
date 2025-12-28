---
name: Meta WhatsApp Flows Builder 開發計劃
overview: 擴展現有的 eFormDefinitions 系統，添加 Meta WhatsApp Flows Builder 功能。包括：1) 數據庫擴展添加 formType 字段；2) 前端添加表單類型選擇和新的 MetaFlowBuilder 組件；3) 後端添加 Meta Flows API 集成服務；4) 實現 WYSIWYG 編輯器和 JSON 生成功能。
todos:
  - id: db_migration
    content: 創建數據庫遷移腳本，添加 form_type、meta_flow_id 等字段到 eFormDefinitions 表
    status: completed
  - id: update_models
    content: 更新 eFormDefinition.cs 模型和 PurpleRiceDbContext.cs，添加新字段映射
    status: completed
    dependencies:
      - db_migration
  - id: meta_flows_service
    content: 創建 WhatsAppMetaFlowsService.cs，實現與 Meta Flows API 的交互（創建、更新、獲取、刪除、發布）
    status: completed
    dependencies:
      - update_models
  - id: update_controller
    content: 擴展 EFormDefinitionsController.cs，添加 MetaFlows 類型的處理邏輯
    status: completed
    dependencies:
      - meta_flows_service
  - id: meta_flow_models
    content: 創建 MetaFlowModels.cs，定義 Meta Flow 相關的請求/響應模型
    status: completed
  - id: form_type_modal
    content: 修改 EFormListPage.js，添加表單類型選擇 Modal 和邏輯
    status: in_progress
  - id: meta_flow_builder_base
    content: 創建 MetaFlowBuilder.js 基礎組件框架（工具欄、布局、狀態管理）
    status: pending
    dependencies:
      - form_type_modal
  - id: flow_canvas
    content: 實現 FlowCanvas.js 可視化編輯器（使用 React Flow 或類似庫）
    status: pending
    dependencies:
      - meta_flow_builder_base
  - id: component_palette
    content: 實現 ComponentPalette.js 組件庫面板（顯示所有可拖放的組件）
    status: pending
    dependencies:
      - flow_canvas
  - id: component_text_heading
    content: 實現 TextHeading 組件編輯器和渲染器（text 屬性）
    status: pending
    dependencies:
      - component_palette
  - id: component_text_body
    content: 實現 TextBody 組件編輯器和渲染器（text 屬性，支持動態數據）
    status: pending
    dependencies:
      - component_palette
  - id: component_footer
    content: 實現 Footer 組件編輯器和渲染器（label, on-click-action 必須包含 complete 或 navigate）
    status: pending
    dependencies:
      - component_palette
  - id: component_button
    content: 實現 Button 組件編輯器和渲染器（id, label, on-click-action: navigate/data_exchange/open_url）
    status: pending
    dependencies:
      - component_palette
  - id: component_input
    content: 實現 Input 組件編輯器和渲染器（id, label, input_type: text/email/phone/number/password, placeholder, required, on-click-action）
    status: pending
    dependencies:
      - component_palette
  - id: component_textarea
    content: 實現 TextArea 組件編輯器和渲染器（id, label, placeholder, required, on-click-action）
    status: pending
    dependencies:
      - component_palette
  - id: component_select
    content: 實現 Select/Dropdown 組件編輯器和渲染器（id, label, options: [{id, title}], on-click-action）
    status: pending
    dependencies:
      - component_palette
  - id: component_checkbox_group
    content: 實現 CheckboxGroup 組件編輯器和渲染器（id, label, options: [{id, title}], on-click-action）
    status: pending
    dependencies:
      - component_palette
  - id: component_radio_buttons_group
    content: 實現 RadioButtonsGroup 組件編輯器和渲染器（id, label, options: [{id, title}], on-click-action）
    status: pending
    dependencies:
      - component_palette
  - id: component_image
    content: 實現 Image 組件編輯器和渲染器（id, url, alt, on-click-action）
    status: pending
    dependencies:
      - component_palette
  - id: component_video
    content: 實現 Video 組件編輯器和渲染器（id, url, thumbnail_url, on-click-action）
    status: pending
    dependencies:
      - component_palette
  - id: component_document
    content: 實現 Document 組件編輯器和渲染器（id, url, filename, on-click-action）
    status: pending
    dependencies:
      - component_palette
  - id: component_date_picker
    content: 實現 DatePicker 組件編輯器和渲染器（id, label, placeholder, required, on-click-action）
    status: pending
    dependencies:
      - component_palette
  - id: component_time_picker
    content: 實現 TimePicker 組件編輯器和渲染器（id, label, placeholder, required, on-click-action）
    status: pending
    dependencies:
      - component_palette
  - id: component_embedded_link
    content: 實現 EmbeddedLink 組件編輯器和渲染器（text, on-click-action: open_url）
    status: pending
    dependencies:
      - component_palette
  - id: component_opt_in
    content: 實現 OptIn 組件編輯器和渲染器（label, name, on-click-action: open_url）
    status: pending
    dependencies:
      - component_palette
  - id: component_switch
    content: 實現 Switch 組件編輯器和渲染器（用於條件渲染，cases: [{key, components}]）
    status: pending
    dependencies:
      - component_palette
  - id: property_editor
    content: 實現 ComponentPropertyEditor.js 屬性編輯面板（根據組件類型動態顯示屬性表單）
    status: pending
    dependencies:
      - component_opt_in
  - id: json_utils_structure
    content: 研究並確認官方 Flow JSON 結構（version, screens, layout, children 格式）
    status: pending
  - id: json_utils_generate
    content: 實現 generateMetaFlowJson - 嚴格按照官方格式生成 JSON（使用正確的組件類型名稱：Button, Input, Select, CheckboxGroup, RadioButtonsGroup 等）
    status: pending
    dependencies:
      - json_utils_structure
  - id: json_utils_parse
    content: 實現 parseMetaFlowJson - 解析官方格式的 JSON（支持 layout.children 格式）
    status: pending
    dependencies:
      - json_utils_structure
  - id: json_utils_validate
    content: 實現 validateMetaFlowJson - 驗證 JSON 格式（檢查組件類型、必需屬性、on-click-action 格式等）
    status: pending
    dependencies:
      - json_utils_generate
  - id: fix_component_types
    content: 修復 metaFlowUtils.js 中的組件類型名稱（button→Button, text_input→Input, select→Select, checkbox→CheckboxGroup, radio→RadioButtonsGroup, textarea→TextArea, image→Image）
    status: completed
    dependencies:
      - json_utils_structure
  - id: api_integration
    content: 在 MetaFlowBuilder 中集成 Meta API 調用（保存、加載、錯誤處理）
    status: pending
    dependencies:
      - json_utils_validate
      - property_editor
      - fix_component_types
  - id: edit_flow_logic
    content: 實現編輯現有 MetaFlows 表單的邏輯（從 Meta API 獲取最新版本）
    status: pending
    dependencies:
      - api_integration
---

# M

eta WhatsApp Flows Builder 開發計劃

## 概述

擴展現有的 eFormDefinitions 系統，添加對 Meta WhatsApp Flows 的支持。系統將支持兩種表單類型：

- **HTML**: 現有的 HTML 表單設計器（`EFormDesigner.js`）
- **MetaFlows**: 新的 Meta WhatsApp Flows JSON 設計器（`MetaFlowBuilder.js`）

## 數據庫變更

### 1. 擴展 eFormDefinitions 表

**文件**: `Database/Add_FormType_To_eFormDefinitions.sql`添加新字段：

- `form_type` (NVARCHAR(20)): 表單類型，值為 'HTML' 或 'MetaFlows'，默認 'HTML'
- `meta_flow_id` (NVARCHAR(255)): Meta Flow ID（從 Meta API 返回）
- `meta_flow_version` (NVARCHAR(50)): Meta Flow 版本號
- `meta_flow_status` (NVARCHAR(50)): Meta Flow 狀態（draft, published 等）
- `meta_flow_json` (NVARCHAR(MAX)): Meta Flow 的完整 JSON 定義
- `meta_flow_metadata` (NVARCHAR(MAX)): Meta API 返回的其他元數據（JSON 格式）

### 2. 更新 C# 模型

**文件**: `Models/eFormDefinition.cs`添加屬性：

```csharp
[Column("form_type")]
[StringLength(20)]
public string FormType { get; set; } = "HTML";

[Column("meta_flow_id")]
[StringLength(255)]
public string? MetaFlowId { get; set; }

[Column("meta_flow_version")]
[StringLength(50)]
public string? MetaFlowVersion { get; set; }

[Column("meta_flow_status")]
[StringLength(50)]
public string? MetaFlowStatus { get; set; }

[Column("meta_flow_json")]
public string? MetaFlowJson { get; set; }

[Column("meta_flow_metadata")]
public string? MetaFlowMetadata { get; set; }
```



### 3. 更新 DbContext

**文件**: `Data/PurpleRiceDbContext.cs`在 `eFormDefinitions` 的配置中添加新字段映射。

## 後端開發

### 1. 創建 Meta Flows API 服務

**文件**: `Services/WhatsAppMetaFlowsService.cs`實現以下方法：

- `CreateFlowAsync(Guid companyId, MetaFlowCreateRequest request)`: 創建 Flow 並提交到 Meta API
- `UpdateFlowAsync(Guid companyId, string flowId, MetaFlowUpdateRequest request)`: 更新 Flow
- `GetFlowAsync(Guid companyId, string flowId)`: 從 Meta API 獲取 Flow
- `DeleteFlowAsync(Guid companyId, string flowId)`: 刪除 Flow
- `PublishFlowAsync(Guid companyId, string flowId)`: 發布 Flow

使用現有的 `WhatsAppApiConfig` 和 Company 表的配置（`WA_Business_Account_ID`, `WA_API_Key`）。Meta Flows API 端點：

- 創建: `POST https://graph.facebook.com/{version}/{business-account-id}/flows`
- 獲取: `GET https://graph.facebook.com/{version}/{flow-id}`
- 更新: `POST https://graph.facebook.com/{version}/{flow-id}`
- 發布: `POST https://graph.facebook.com/{version}/{flow-id}/publish`

### 2. 擴展 EFormDefinitionsController

**文件**: `Controllers/EFormDefinitionsController.cs`修改現有方法：

- `Create`: 根據 `formType` 決定是否調用 Meta API
- `Update`: 如果是 MetaFlows 類型，先更新到 Meta API，成功後再更新數據庫
- `Get`: 如果是 MetaFlows 類型，可選從 Meta API 獲取最新版本

添加新方法：

- `GetMetaFlowFromApi(Guid id)`: 從 Meta API 獲取最新版本

### 3. 創建 Meta Flow 相關模型

**文件**: `Models/MetaFlowModels.cs`定義：

- `MetaFlowCreateRequest`: 創建請求模型
- `MetaFlowUpdateRequest`: 更新請求模型
- `MetaFlowResponse`: Meta API 響應模型
- `MetaFlowScreen`: Screen 組件模型
- `MetaFlowComponent`: 組件模型（Button, TextInput, etc.）

## 前端開發

### 1. 修改 EFormListPage

**文件**: `src/pages/EFormListPage.js`修改 `handleAdd` 函數，添加表單類型選擇 Modal：

```javascript
const [formTypeModalVisible, setFormTypeModalVisible] = useState(false);

const handleAdd = () => {
  setFormTypeModalVisible(true);
};

const handleFormTypeSelect = (formType) => {
  setFormTypeModalVisible(false);
  if (formType === 'HTML') {
    setEditingId(null);
    setDesignerOpen(true);
  } else if (formType === 'MetaFlows') {
    setEditingId(null);
    setMetaFlowBuilderOpen(true);
  }
};
```

在表格中添加 `formType` 列顯示，修改 `handleEdit` 根據 `formType` 打開對應的設計器。

### 2. 創建 MetaFlowBuilder 組件

**文件**: `src/pages/MetaFlowBuilder.js`主要功能：

- **WYSIWYG 編輯器**: 使用 React Flow 或類似的可視化庫構建 Flow
- **Screen 管理**: 添加/刪除/編輯 Screen
- **組件庫**: 拖放組件（Button, TextInput, TextArea, Select, Checkbox, Radio, Image, etc.）
- **屬性編輯**: 右側面板編輯選中組件的屬性
- **JSON 預覽**: 實時顯示生成的 JSON
- **Meta API 集成**: 保存時先提交到 Meta API，成功後再保存到數據庫

組件結構：

```javascript
MetaFlowBuilder
├── Toolbar (保存、返回、預覽)
├── Left Panel (組件庫、Screen 列表)
├── Center Canvas (Flow 可視化編輯器)
├── Right Panel (屬性編輯器)
└── Bottom Panel (JSON 預覽，可選)
```



### 3. 創建 Meta Flow 組件庫

**文件**: `src/components/MetaFlowBuilder/`目錄結構：

- `FlowCanvas.js`: 主要的 Flow 可視化編輯器
- `ScreenNode.js`: Screen 節點組件
- `ComponentPalette.js`: 組件庫面板（顯示所有可拖放的組件）
- `ComponentPropertyEditor.js`: 屬性編輯器（根據組件類型動態顯示屬性表單）
- `JsonPreview.js`: JSON 預覽組件
- `components/`: 各種組件渲染器和編輯器
  - `TextHeadingRenderer.js` / `TextHeadingEditor.js`
  - `TextBodyRenderer.js` / `TextBodyEditor.js`
  - `FooterRenderer.js` / `FooterEditor.js`
  - `ButtonRenderer.js` / `ButtonEditor.js`
  - `InputRenderer.js` / `InputEditor.js`（不是 TextInput）
  - `TextAreaRenderer.js` / `TextAreaEditor.js`
  - `SelectRenderer.js` / `SelectEditor.js`
  - `CheckboxGroupRenderer.js` / `CheckboxGroupEditor.js`
  - `RadioButtonsGroupRenderer.js` / `RadioButtonsGroupEditor.js`
  - `ImageRenderer.js` / `ImageEditor.js`
  - `VideoRenderer.js` / `VideoEditor.js`
  - `DocumentRenderer.js` / `DocumentEditor.js`
  - `DatePickerRenderer.js` / `DatePickerEditor.js`
  - `TimePickerRenderer.js` / `TimePickerEditor.js`
  - `EmbeddedLinkRenderer.js` / `EmbeddedLinkEditor.js`
  - `OptInRenderer.js` / `OptInEditor.js`
  - `SwitchRenderer.js` / `SwitchEditor.js`

### 4. 創建 Meta Flow 工具函數

**文件**: `src/utils/metaFlowUtils.js`包含：

- `generateMetaFlowJson(flowData)`: 將編輯器數據轉換為 Meta Flow JSON
- `parseMetaFlowJson(json)`: 將 Meta Flow JSON 解析為編輯器數據
- `validateMetaFlowJson(json)`: 驗證 JSON 格式
- `getDefaultScreen()`: 生成默認 Screen
- `getDefaultComponent(type)`: 生成默認組件

### 5. Meta Flow JSON 結構參考

根據 [Meta WhatsApp Flows API 官方文檔](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson)，Flow JSON 結構如下：

#### 頂層結構

```json
{
  "version": "7.3",
  "screens": [
    {
      "id": "SCREEN_ID",
      "title": "Screen Title",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          // 組件列表
        ]
      }
    }
  ]
}
```

#### Screen 結構

```json
{
  "id": "SCREEN_ID",
  "terminal": false,
  "success": true,
  "title": "Screen Title",
  "refresh_on_back": false,
  "data": {
    "field_name": {
      "type": "string",
      "__example__": "example value"
    }
  },
  "layout": {
    "type": "SingleColumnLayout",
    "children": [
      // 組件列表
    ]
  }
}
```

#### 支持的組件類型（layout.children 中）

根據 [官方組件文檔](https://developers.facebook.com/docs/whatsapp/flows/reference/components)：

1. **TextHeading** - 標題文本
   ```json
   {
     "type": "TextHeading",
     "text": "標題文本"
   }
   ```

2. **TextBody** - 正文文本（支持動態數據）
   ```json
   {
     "type": "TextBody",
     "text": "正文文本或 ${data.field_name}"
   }
   ```

3. **Footer** - 頁腳（必須有 on-click-action）
   ```json
   {
     "type": "Footer",
     "label": "繼續",
     "on-click-action": {
       "name": "complete",
       "payload": {}
     }
   }
   ```

4. **Button** - 按鈕
   ```json
   {
     "type": "Button",
     "id": "button_id",
     "label": "按鈕文字",
     "on-click-action": {
       "name": "navigate",
       "next": {
         "type": "screen",
         "name": "NEXT_SCREEN"
       },
       "payload": {}
     }
   }
   ```

5. **Input** - 輸入框（不是 TextInput）
   ```json
   {
     "type": "Input",
     "id": "input_id",
     "label": "標籤",
     "input_type": "text",
     "placeholder": "提示文字",
     "required": true,
     "on-click-action": {
       "name": "data_exchange",
       "payload": {}
     }
   }
   ```

6. **TextArea** - 多行輸入
   ```json
   {
     "type": "TextArea",
     "id": "textarea_id",
     "label": "標籤",
     "placeholder": "提示文字",
     "required": true,
     "on-click-action": {
       "name": "data_exchange",
       "payload": {}
     }
   }
   ```

7. **Select** 或 **Dropdown** - 下拉選擇
   ```json
   {
     "type": "Select",
     "id": "select_id",
     "label": "標籤",
     "options": [
       {
         "id": "option_1",
         "title": "選項 1"
       }
     ],
     "on-click-action": {
       "name": "data_exchange",
       "payload": {}
     }
   }
   ```

8. **CheckboxGroup** - 複選框組（不是 checkbox）
   ```json
   {
     "type": "CheckboxGroup",
     "id": "checkbox_id",
     "label": "標籤",
     "options": [
       {
         "id": "option_1",
         "title": "選項 1"
       }
     ],
     "on-click-action": {
       "name": "data_exchange",
       "payload": {}
     }
   }
   ```

9. **RadioButtonsGroup** - 單選框組（不是 radio）
   ```json
   {
     "type": "RadioButtonsGroup",
     "id": "radio_id",
     "label": "標籤",
     "options": [
       {
         "id": "option_1",
         "title": "選項 1"
       }
     ],
     "on-click-action": {
       "name": "data_exchange",
       "payload": {}
     }
   }
   ```

10. **Image** - 圖片
    ```json
    {
      "type": "Image",
      "id": "image_id",
      "url": "https://example.com/image.jpg",
      "alt": "圖片描述",
      "on-click-action": {
        "name": "open_url",
        "url": "https://example.com"
      }
    }
    ```

11. **Video** - 視頻
    ```json
    {
      "type": "Video",
      "id": "video_id",
      "url": "https://example.com/video.mp4",
      "thumbnail_url": "https://example.com/thumb.jpg",
      "on-click-action": {
        "name": "open_url",
        "url": "https://example.com"
      }
    }
    ```

12. **Document** - 文檔
    ```json
    {
      "type": "Document",
      "id": "doc_id",
      "url": "https://example.com/doc.pdf",
      "filename": "document.pdf",
      "on-click-action": {
        "name": "data_exchange",
        "payload": {}
      }
    }
    ```

13. **DatePicker** - 日期選擇器
    ```json
    {
      "type": "DatePicker",
      "id": "date_id",
      "label": "選擇日期",
      "placeholder": "請選擇日期",
      "required": true,
      "on-click-action": {
        "name": "data_exchange",
        "payload": {}
      }
    }
    ```

14. **TimePicker** - 時間選擇器
    ```json
    {
      "type": "TimePicker",
      "id": "time_id",
      "label": "選擇時間",
      "placeholder": "請選擇時間",
      "required": true,
      "on-click-action": {
        "name": "data_exchange",
        "payload": {}
      }
    }
    ```

15. **EmbeddedLink** - 嵌入式鏈接
    ```json
    {
      "type": "EmbeddedLink",
      "text": "點擊這裡",
      "on-click-action": {
        "name": "open_url",
        "url": "https://example.com"
      }
    }
    ```

16. **OptIn** - 選擇加入
    ```json
    {
      "type": "OptIn",
      "label": "我同意條款",
      "name": "terms_agreement",
      "on-click-action": {
        "name": "open_url",
        "url": "https://example.com/terms"
      }
    }
    ```

17. **Switch** - 條件渲染
    ```json
    {
      "type": "Switch",
      "key": "${form.field_name}",
      "cases": [
        {
          "key": "value1",
          "components": [
            {
              "type": "TextBody",
              "text": "顯示內容 1"
            }
          ]
        }
      ]
    }
    ```

#### Actions 類型

- `navigate` - 導航到下一屏
- `data_exchange` - 發送數據到 Data Endpoint
- `complete` - 完成流程（僅用於 Footer）
- `open_url` - 打開 URL（僅用於 EmbeddedLink 和 OptIn）
- `update_data` - 更新屏幕狀態（Flow JSON 6.0+）

#### 重要注意事項

1. **組件類型名稱必須使用大寫開頭的駝峰式命名（PascalCase）**
2. **layout.children 中使用組件，不是 data.actions**
3. **Footer 必須有 on-click-action**
4. **Button 不能使用 complete action，只能使用 navigate/data_exchange/open_url**
5. **complete action 只能用於 Footer**
6. **navigate action 的 next 必須是對象：`{ "type": "screen", "name": "SCREEN_ID" }`**



## 實現步驟

1. **數據庫遷移**: 創建 SQL 腳本添加新字段
2. **後端模型更新**: 更新 C# 模型和 DbContext
3. **Meta Flows 服務**: 實現與 Meta API 的交互
4. **控制器擴展**: 更新 EFormDefinitionsController
5. **前端基礎結構**: 創建 MetaFlowBuilder 組件框架
6. **Flow 編輯器**: 實現可視化編輯器
7. **組件庫**: 實現各種組件的編輯器
8. **JSON 生成**: 實現數據到 JSON 的轉換
9. **Meta API 集成**: 實現保存和加載邏輯
10. **測試和優化**: 測試完整流程

## 技術棧

- **前端**: React, React Flow (或類似的 Flow 編輯器庫), Ant Design
- **後端**: C# ASP.NET Core, Entity Framework Core
- **API**: Meta Graph API (WhatsApp Flows)
- **數據庫**: Microsoft SQL Server

## 注意事項

1. Meta API 認證使用 Company 表中的 `WA_API_Key`
2. 保存流程：先提交到 Meta API → 成功後保存到數據庫
3. 編輯流程：從數據庫獲取記錄 → 使用 `meta_flow_id` 從 Meta API 獲取最新版本
4. 錯誤處理：Meta API 失敗時不保存到數據庫，顯示錯誤信息