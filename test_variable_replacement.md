# 變數替換功能測試指南

## 功能概述
已實作完整的流程變數替換功能，支援 `${變數名}` 語法在所有節點中使用。

## 已實作的功能

### 1. 後端變數替換服務
- ✅ `VariableReplacementService` - 核心變數替換服務
- ✅ `VariableReplacementController` - API 控制器
- ✅ 支援 `${變數名}` 語法
- ✅ 支援多種數據類型 (string, int, decimal, boolean, datetime, json)

### 2. 工作流引擎整合
- ✅ `WorkflowEngine` 整合 `IVariableReplacementService`
- ✅ 發送 WhatsApp 訊息節點支援變數替換
- ✅ 發送 WhatsApp 模板節點支援變數替換
- ✅ Switch 條件節點支援條件值中的變數替換

### 3. 前端變數編輯界面
- ✅ 發送 WhatsApp 訊息節點變數語法提示
- ✅ WhatsApp 模板節點變數編輯界面
- ✅ Switch 條件節點變數語法提示
- ✅ 變數語法驗證和視覺提示

## 測試步驟

### 1. 測試發送 WhatsApp 訊息節點
1. 建立一個工作流程
2. 添加「發送 WhatsApp 訊息」節點
3. 在訊息內容中輸入：`您好 ${userName}，您的訂單 ${orderNumber} 已確認`
4. 觀察變數標籤的點擊插入功能
5. 執行工作流程，檢查實際發送的訊息是否正確替換變數

### 2. 測試 WhatsApp 模板節點
1. 添加「發送 WhatsApp 模板」節點
2. 選擇一個模板
3. 在變數編輯界面添加變數：
   - 變數名：`customerName`，值：`張三`
   - 變數名：`orderAmount`，值：`${totalAmount}`
4. 觀察變數值輸入框的語法驗證提示（✓ 標記）
5. 執行工作流程測試

### 3. 測試 Switch 條件節點
1. 添加「Switch」節點
2. 設定條件：`${userType} equals ${expectedUserType}`
3. 執行工作流程，檢查條件評估是否正確

### 4. 測試 API 端點
```bash
# 測試變數替換預覽
curl -X POST http://localhost:5000/api/variablereplacement/preview \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello ${userName}, your order ${orderNumber} is ready"}'

# 測試實際變數替換
curl -X POST http://localhost:5000/api/variablereplacement/replace \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello ${userName}", "workflowExecutionId": 123}'
```

## 預期結果
- 所有 `${變數名}` 表達式都能正確替換為對應的 PV 值
- 前端變數編輯界面提供直觀的語法提示和驗證
- 工作流程執行時變數替換正常運作
- 支援巢狀變數替換（變數值中包含其他變數）

## 注意事項
- 變數名稱區分大小寫
- 未找到的變數會保持原始格式 `${變數名}`
- 所有節點類型都支援變數替換功能
- 條件值中的變數也會被替換
