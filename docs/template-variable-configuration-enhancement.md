# Meta 模板變數配置增強

## 問題描述

在使用 Meta 官方模板時遇到以下錯誤：
```
Meta API 發送失敗: BadRequest - {"error":{"message":"(#132000) Number of parameters does not match the expected number of params","type":"OAuthException","code":132000,"error_data":{"messaging_product":"whatsapp","details":"body: number of localizable_params (0) does not match the expected number of params (1)"},"fbtrace_id":"A7yfOqTUnmxHZ00UNJE9z7H"}}
```

**根本原因：** Meta 模板 `dn_notify` 定義了 1 個參數，但系統沒有正確傳入對應的變數值。

## 解決方案

### 1. 新增模板變數配置組件

創建了 `TemplateVariableConfigComponent.js`，提供更強大的模板變數配置功能：

#### 功能特點：
- **參數名稱配置**：支持數字參數 (1, 2, 3...) 或命名參數 (customer_name, order_id)
- **變數來源選擇**：
  - 流程變數：從工作流程定義的流程變數中選擇
  - 數據集欄位：從 DataSet Query 節點的查詢結果中選擇
- **智能提示**：顯示可用的流程變數和數據集欄位
- **Meta 模板優化**：特別針對 Meta 官方模板提供配置提示

#### UI 結構：
```
模板變數配置
├── Meta 模板提示信息
├── 添加模板變數按鈕
├── 變數配置卡片
│   ├── 參數名稱輸入框
│   ├── 變數來源選擇 (流程變數/數據集欄位)
│   ├── 具體變數選擇下拉框
│   └── 刪除按鈕
└── 可用變數提示區域
```

### 2. 後端邏輯增強

#### 新增方法：
- `ProcessTemplateVariableConfigAsync()`：處理新的模板變數配置
- 支持從流程變數和數據集欄位中獲取值
- 自動解析變數來源並替換為實際值

#### 數據結構：
```csharp
public class WorkflowNodeData
{
    // 現有屬性...
    [JsonPropertyName("templateVariables")]
    public List<object> TemplateVariables { get; set; } // 新的模板變數配置
}
```

#### 變數配置格式：
```json
{
  "id": "var_17598",
  "parameterName": "1", // Meta 模板參數名
  "sourceType": "process", // process 或 dataset
  "sourceId": "process-var-id", // 流程變數 ID 或數據集欄位名
  "sourceDisplayName": "CustomerName (流程變數)", // 顯示名稱
  "value": "" // 實際值（運行時填充）
}
```

### 3. Meta 模板參數類型支持

#### 數字參數（推薦）：
- 格式：`{{1}}`, `{{2}}`, `{{3}}`...
- 符合 WhatsApp 標準格式
- 適用於所有 Meta 官方模板

#### 命名參數：
- 格式：`{{customer_name}}`, `{{order_id}}`
- 更易讀，但需要正確的變數名映射
- 需要確保變數名與 Meta 模板定義一致

### 4. 向後兼容性

系統同時支持：
- **新配置**：`templateVariables` 數組格式
- **舊配置**：`variables` 字典格式

優先使用新配置，如果沒有則回退到舊配置。

## 使用方式

### 1. 配置 Meta 模板變數

1. 選擇 Meta 官方模板（如 `dn_notify`）
2. 點擊「添加模板變數」
3. 輸入參數名稱（如 `1` 表示第一個參數）
4. 選擇變數來源：
   - **流程變數**：從工作流程變數中選擇
   - **數據集欄位**：從 DataSet Query 結果中選擇
5. 選擇具體的變數或欄位

### 2. 變數來源說明

#### 流程變數：
- 來源：工作流程定義中創建的流程變數
- 格式：`${process.VariableName}`
- 用途：存儲工作流程執行過程中的動態值

#### 數據集欄位：
- 來源：DataSet Query 節點的查詢結果
- 格式：`${FieldName}`
- 用途：從數據庫查詢結果中獲取值

### 3. Meta 模板配置示例

對於 `dn_notify` 模板（需要 1 個參數）：

```json
{
  "templateVariables": [
    {
      "id": "var_1",
      "parameterName": "1",
      "sourceType": "dataset",
      "sourceId": "CustomerWhatsappNo",
      "sourceDisplayName": "CustomerWhatsappNo (OEB Customer 查詢)"
    }
  ]
}
```

## 技術實現

### 前端組件：
- `TemplateVariableConfigComponent.js`：模板變數配置組件
- `MessageModeTabsComponent.js`：集成新組件
- 語言資源：新增相關翻譯

### 後端服務：
- `WorkflowEngine.cs`：新增 `ProcessTemplateVariableConfigAsync` 方法
- `WorkflowNodeData`：新增 `TemplateVariables` 屬性
- 向後兼容：同時支持新舊配置格式

### 數據流程：
1. 用戶在 UI 中配置模板變數
2. 前端保存 `templateVariables` 配置到節點數據
3. 工作流程執行時，後端解析配置
4. 根據 `sourceType` 和 `sourceId` 獲取實際值
5. 將值傳遞給 Meta API

## 優勢

1. **精確配置**：明確指定每個 Meta 模板參數的變數來源
2. **類型安全**：支持數字和命名參數，自動適配 Meta 模板
3. **來源豐富**：支持流程變數和數據集欄位兩種來源
4. **用戶友好**：提供下拉選擇和智能提示
5. **向後兼容**：不影響現有的模板配置

## 測試建議

1. **Meta 模板測試**：
   - 使用 `dn_notify` 模板測試數字參數
   - 使用其他 Meta 模板測試多參數情況

2. **變數來源測試**：
   - 測試流程變數來源
   - 測試數據集欄位來源
   - 測試混合來源配置

3. **向後兼容測試**：
   - 確保現有的 `variables` 配置仍然有效
   - 測試新舊配置的切換

## 總結

這個增強解決了 Meta 模板參數傳遞的問題，提供了更強大和靈活的模板變數配置功能。用戶現在可以：

- 精確配置每個 Meta 模板參數
- 從多種來源選擇變數值
- 享受更好的用戶體驗和錯誤提示
- 保持與現有配置的兼容性

這將大大提高 Meta 官方模板的使用成功率和用戶體驗。
