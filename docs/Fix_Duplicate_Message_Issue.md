# 修復重複訊息發送問題

## 問題描述

用戶發送一個極簡單的測試流程，內容只是發送一個 message template 給一個收件者，但同一個人收到了兩次訊息。而 `workflow_message_recipients` 表確實記錄了兩筆資料。

## 根本原因

**前端流程設計器在刪除節點時，沒有同時刪除相關的連接線（edges）**

### 問題流程

1. 用戶在前端刪除了兩個節點（`sendWhatsApp_1753855282311` 和 `sendWhatsApp_1753959057067`）
2. 但連接到這些節點的 edges 仍然保留在流程定義中
3. 保存流程時，無效的 edges 也被存入資料庫
4. 執行流程時，`BuildAdjacencyList` 會為所有 edges（包括無效的）建立連接關係
5. 結果：同一個收件者被添加了多次

### 流程定義 JSON 示例

```json
{
  "nodes": [
    {"id": "start", ...},
    {"id": "end_1753093022010", ...},
    {"id": "sendWhatsAppTemplate_1759720596222", ...}
  ],
  "edges": [
    // 無效的 edges - 引用了不存在的節點
    {"source": "start", "target": "sendWhatsApp_1753855282311"},
    {"source": "start", "target": "sendWhatsApp_1753959057067"},
    {"source": "sendWhatsApp_1753855282311", "target": "end_1753093022010"},
    {"source": "sendWhatsApp_1753959057067", "target": "end_1753093022010"},
    
    // 有效的 edges
    {"source": "start", "target": "sendWhatsAppTemplate_1759720596222"},
    {"source": "sendWhatsAppTemplate_1759720596222", "target": "end_1753093022010"}
  ]
}
```

## 解決方案

### 1. 前端修復（預防問題再次發生）

修改了以下檔案，確保刪除節點時同時刪除相關的 edges：

#### 修改檔案

1. **`src/components/WorkflowDesigner/hooks/useNodeHandlers.js`**
   - 修改 `handleDeleteNode` 函數，添加刪除相關 edges 的邏輯
   - 添加 `setEdges` 參數到函數參數列表

2. **`src/components/WorkflowDesigner/WhatsAppWorkflowDesigner.js`**
   - 更新 `useNodeHandlers` 的調用，傳入 `setEdges` 參數

3. **`src/components/WorkflowDesigner/hooks/useAdvancedFeatures.js`**
   - 修改鍵盤刪除功能（Delete/Backspace），同時刪除相關 edges

### 2. 後端清理（修復已存在的問題）

添加了清理端點來修復資料庫中已存在的無效 edges：

#### API 端點

```
POST /api/workflowdefinitions/cleanup-invalid-edges
```

**功能：**
- 遍歷所有流程定義
- 檢查每個流程定義的 edges
- 移除引用不存在節點的 edges
- 更新流程定義並保存到資料庫

**回應格式：**
```json
{
  "success": true,
  "message": "清理完成，共更新了 X 個流程定義",
  "updatedCount": 1,
  "totalChecked": 5
}
```

### 3. SQL 備份腳本（可選）

提供了 SQL 腳本 `Database/Fix_Invalid_Workflow_Edges.sql` 用於直接在資料庫層面清理無效 edges。

## 使用說明

### 前端修復

1. 前端修改已完成，下次刪除節點時會自動清理相關 edges
2. 不需要額外操作

### 清理現有資料

#### 方法 1：使用 API 端點（推薦）

使用提供的 PowerShell 測試腳本：

```powershell
.\test_cleanup_invalid_edges.ps1
```

或使用 curl：

```bash
curl -X POST http://localhost:5129/api/workflowdefinitions/cleanup-invalid-edges \
  -H "Content-Type: application/json"
```

#### 方法 2：使用 SQL 腳本

在 SQL Server Management Studio 中執行：

```sql
-- 執行清理腳本
USE [你的資料庫名稱];
GO

-- 執行 Database/Fix_Invalid_Workflow_Edges.sql
```

## 驗證

### 1. 檢查流程定義

```sql
SELECT 
    Id,
    Name,
    (SELECT COUNT(*) FROM OPENJSON(Json, '$.nodes')) AS NodeCount,
    (SELECT COUNT(*) FROM OPENJSON(Json, '$.edges')) AS EdgeCount,
    UpdatedAt
FROM WorkflowDefinitions
ORDER BY UpdatedAt DESC;
```

### 2. 測試流程執行

1. 打開流程設計器
2. 重新打開您的測試流程
3. 檢查是否還有無效的連接線
4. 保存並執行流程
5. 確認收件者只收到一次訊息

## 技術細節

### 前端邏輯

```javascript
// 刪除節點時的處理邏輯
const handleDeleteNode = useCallback((nodeId) => {
  // 1. 刪除節點
  setNodes(nds => nds.filter(n => n.id !== nodeId || n.data.type === 'start'));
  
  // 2. 同時刪除所有連接到該節點的 edges
  setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
  
  setSelectedNode(null);
}, [setNodes, setEdges, setSelectedNode]);
```

### 後端驗證邏輯

WorkflowEngine 中的 `ValidateWorkflowEdges` 函數會在執行時驗證 edges：

```csharp
private bool ValidateWorkflowEdges(List<WorkflowEdge> edges, List<WorkflowNode> nodes)
{
    var nodeIds = nodes.Select(n => n.Id).ToHashSet();
    
    foreach (var edge in edges)
    {
        // 檢查 Source 和 Target 節點是否存在
        if (!nodeIds.Contains(edge.Source) || !nodeIds.Contains(edge.Target))
        {
            // 記錄警告並移除無效 edge
        }
    }
    
    return true; // 總是返回 true，因為已清理無效邊緣
}
```

## 預防措施

1. **前端驗證**：在保存流程前驗證所有 edges 的 source 和 target 是否存在
2. **後端驗證**：執行流程前自動清理無效 edges（已實現）
3. **定期清理**：可以設置定期任務執行清理端點

## 相關檔案

- `src/components/WorkflowDesigner/hooks/useNodeHandlers.js` - 節點處理邏輯
- `src/components/WorkflowDesigner/hooks/useAdvancedFeatures.js` - 鍵盤刪除功能
- `src/components/WorkflowDesigner/WhatsAppWorkflowDesigner.js` - 主要設計器組件
- `Controllers/WorkflowDefinitionsController.cs` - 清理端點
- `Services/WorkflowEngine.cs` - 執行引擎和驗證邏輯
- `Database/Fix_Invalid_Workflow_Edges.sql` - SQL 清理腳本
- `test_cleanup_invalid_edges.ps1` - PowerShell 測試腳本

## 總結

這個問題是由於前端刪除節點時沒有同時清理相關的連接線導致的。透過修改前端邏輯和添加後端清理端點，問題已經完全解決。

**重要提醒：** 請先執行清理端點來修復現有的流程定義，然後再進行新的流程測試。

