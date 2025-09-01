# WorkflowEngineController 重構文檔

## 重構目標
消除 `WorkflowEngineController` 和 `WorkflowExecutionsController` 之間的功能重疊，統一工作流程執行管理的 API 端點。

## 重構內容

### 1. 合併的功能

#### 從 WorkflowEngineController 合併到 WorkflowExecutionsController：
- ✅ `StartWorkflow()` - 手動啟動工作流程
- ✅ `GetStatistics()` - 獲取工作流程引擎統計信息
- ✅ `StartWorkflowRequest` 模型

#### 保留在 WorkflowExecutionsController 的現有功能：
- ✅ `Start()` - 啟動工作流程
- ✅ `Get()` - 獲取執行記錄
- ✅ `Resume()` - 恢復工作流程
- ✅ `GetMonitorData()` - 監控數據
- ✅ `GetMonitorStatistics()` - 監控統計信息
- ✅ `GetInstanceDetails()` - 獲取實例詳情
- ✅ `PauseInstance()` - 暫停實例
- ✅ `ResumeInstance()` - 恢復實例
- ✅ `CancelInstance()` - 取消實例
- ✅ `RetryInstance()` - 重試實例
- ✅ `GetEformInstances()` - 獲取表單實例

### 2. 移除的功能

#### 從 WorkflowEngineController 移除（因為功能重疊）：
- ❌ `GetWorkflows()` - 工作流程列表（WorkflowDefinitionsController 已有）
- ❌ `GetWorkflow()` - 工作流程詳情（WorkflowDefinitionsController 已有）
- ❌ `GetExecutions()` - 執行記錄列表（WorkflowExecutionsController.monitor 已有）
- ❌ `GetExecution()` - 執行記錄詳情（WorkflowExecutionsController.Get 已有）

### 3. 保留的服務層

#### WorkflowEngine 服務層保持不變：
- ✅ `ExecuteWorkflowAsync()` - 核心執行邏輯
- ✅ `ExecuteWorkflow()` - 從 Controller 調用的方法
- ✅ `ExecuteNodeRecursively()` - 節點執行邏輯
- ✅ `WorkflowExecutionResult` 模型

## 新的 API 架構

### WorkflowExecutionsController - 統一的工作流程執行管理
```
POST /api/workflowexecutions/start                    - 啟動工作流程
POST /api/workflowexecutions/workflow/{id}/start      - 手動啟動工作流程
GET  /api/workflowexecutions/{id}                     - 獲取執行記錄
POST /api/workflowexecutions/{id}/resume              - 恢復工作流程
GET  /api/workflowexecutions/monitor                  - 監控數據
GET  /api/workflowexecutions/monitor/statistics       - 監控統計信息
GET  /api/workflowexecutions/statistics               - 工作流程引擎統計信息
GET  /api/workflowexecutions/{id}/details             - 獲取實例詳情
POST /api/workflowexecutions/{id}/pause               - 暫停實例
POST /api/workflowexecutions/{id}/resume              - 恢復實例
POST /api/workflowexecutions/{id}/cancel              - 取消實例
POST /api/workflowexecutions/{id}/retry               - 重試實例
GET  /api/workflowexecutions/{id}/eform-instances     - 獲取表單實例
```

### WorkflowDefinitionsController - 工作流程定義管理
```
POST /api/workflowdefinitions/{id}/start              - 啟動工作流程（保持現有）
GET  /api/workflowdefinitions                         - 獲取工作流程列表
GET  /api/workflowdefinitions/{id}                    - 獲取工作流程詳情
POST /api/workflowdefinitions                         - 創建工作流程
PUT  /api/workflowdefinitions/{id}                    - 更新工作流程
DELETE /api/workflowdefinitions/{id}                  - 刪除工作流程
```

## 重構結果

### ✅ 優點
1. **消除功能重疊** - 不再有多個 Controller 提供相同的功能
2. **統一 API 設計** - 工作流程執行相關的 API 都集中在 WorkflowExecutionsController
3. **清晰的職責分工** - 每個 Controller 職責明確
4. **保持向後兼容** - 前端調用不需要修改
5. **減少代碼重複** - 消除了重複的實現

### 🔄 影響範圍
- **前端** - 無影響，因為本來就沒有調用 WorkflowEngineController
- **後台其他組件** - 無影響，因為沒有其他組件調用 WorkflowEngineController
- **WorkflowEngine 服務層** - 無影響，保持不變
- **WorkflowDefinitionsController** - 無影響，保持現有功能

## 文件變更

### 新增文件
- `docs/WorkflowEngineController_Refactor.md` - 本文檔

### 修改文件
- `Controllers/WorkflowExecutionsController.cs` - 添加合併的功能

### 刪除文件
- `Controllers/WorkflowEngineController.cs` - 完全移除

## 測試建議

### 需要測試的功能
1. ✅ 手動啟動工作流程 (`POST /api/workflowexecutions/workflow/{id}/start`)
2. ✅ 獲取統計信息 (`GET /api/workflowexecutions/statistics`)
3. ✅ 所有現有的 WorkflowExecutionsController 功能
4. ✅ WorkflowDefinitionsController 的啟動功能

### 測試重點
- 確保合併後的功能與原 WorkflowEngineController 功能一致
- 確保現有功能不受影響
- 確保錯誤處理和日誌記錄正常工作
