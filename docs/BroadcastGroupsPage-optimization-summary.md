# BroadcastGroupsPage.js 優化總結

## 📋 優化概述

本次優化將 `BroadcastGroupsPage.js` 升級為標準表格頁面，添加了列寬調整和服務器端排序功能，提升了用戶體驗和數據處理效率。

## 🔧 主要改進

### 1. 後端 API 優化
- **文件**: `Controllers/ContactListController.cs`
- **改進**: 添加分頁和排序參數支持
  ```csharp
  [HttpGet("groups")]
  public async Task<IActionResult> GetBroadcastGroups(
      [FromQuery] int page = 1,
      [FromQuery] int pageSize = 20,
      [FromQuery] string? search = null,
      [FromQuery] string? sortField = null,
      [FromQuery] string? sortOrder = null)
  ```

- **文件**: `Services/ContactListService.cs`
- **改進**: 實現動態排序邏輯
  ```csharp
  public async Task<(List<BroadcastGroup> groups, int totalCount)> GetBroadcastGroupsAsync(
      Guid companyId, 
      int page = 1, 
      int pageSize = 20, 
      string? search = null, 
      string? sortField = null, 
      string? sortOrder = null)
  ```

### 2. 前端功能增強

#### 列寬調整功能
- **導入**: `react-resizable` 庫
- **組件**: `ResizableTitle` 組件
- **狀態**: `columnWidths` 狀態管理
- **處理**: `handleResize` 函數

#### 服務器端排序
- **狀態**: `sortField`, `sortOrder` 狀態
- **處理**: `handleTableChange` 函數
- **API**: 動態參數傳遞

#### 分頁功能
- **狀態**: `currentPage`, `pageSize`, `totalCount`
- **配置**: 完整的分頁配置
- **處理**: 分頁變更處理

### 3. 表格組件升級

#### 新的 Table 屬性
```javascript
<Table
  columns={resizableColumns}
  dataSource={groups}
  rowKey="id"
  loading={loading}
  onChange={handleTableChange}
  components={{
    header: {
      cell: ResizableTitle,
    },
  }}
  pagination={{
    current: currentPage,
    pageSize: pageSize,
    total: totalCount,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => 
      t('common.pageRange', { start: range[0], end: range[1], total }),
    pageSizeOptions: ['10', '20', '50', '100'],
  }}
  scroll={{ x: 1200, y: 'calc(100vh - 400px)' }}
  sticky={{ offsetHeader: 0 }}
/>
```

#### 列定義優化
```javascript
const baseColumns = React.useMemo(() => [
  {
    title: t('broadcastGroups.groupName'),
    dataIndex: 'name',
    key: 'name',
    width: columnWidths.name,
    sorter: true,
    sortDirections: ['ascend', 'descend'],
    // ... render function
  },
  // ... 其他列
], [t, userTimezoneOffset, columnWidths]);
```

## 📊 功能對比

| 功能 | 優化前 | 優化後 |
|------|--------|--------|
| 列寬調整 | ❌ | ✅ |
| 服務器端排序 | ❌ | ✅ |
| 分頁控制 | 基礎 | 完整 |
| 時區顯示 | ✅ | ✅ |
| 響應式設計 | 基礎 | 增強 |
| 性能優化 | 基礎 | 優化 |

## 🛠️ 技術實現

### 1. 狀態管理
```javascript
// 分頁和排序狀態
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(20);
const [totalCount, setTotalCount] = useState(0);
const [sortField, setSortField] = useState('');
const [sortOrder, setSortOrder] = useState('');

// 列寬狀態
const [columnWidths, setColumnWidths] = useState({
  name: 200,
  color: 120,
  contactCount: 120,
  createdAt: 150,
  updatedAt: 150,
  actions: 150
});
```

### 2. 事件處理
```javascript
// 表格變更處理
const handleTableChange = (pagination, filters, sorter) => {
  // 處理排序
  if (sorter && sorter.field) {
    const newSortField = sorter.field;
    const newSortOrder = sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : '';
    
    setSortField(newSortField);
    setSortOrder(newSortOrder);
  }
  
  // 處理分頁
  if (pagination.current !== currentPage) {
    setCurrentPage(pagination.current);
  }
  if (pagination.pageSize !== pageSize) {
    setPageSize(pagination.pageSize);
    setCurrentPage(1);
  }
};
```

### 3. API 集成
```javascript
const loadGroups = async () => {
  const params = {
    page: currentPage,
    pageSize: pageSize,
    search: undefined,
    sortField: sortField || undefined,
    sortOrder: sortOrder || undefined
  };
  
  const response = await broadcastGroupApi.getGroups(params);
  // ... 處理響應
};
```

## 📚 代碼片段庫更新

### 新增片段
- `paginationState`: 分頁狀態管理
- `paginationHandler`: 分頁處理函數
- `paginationParams`: 分頁 API 參數
- `paginationConfig`: 分頁組件配置

### 配置文件更新
- 添加 `broadcastGroupsConfig` 配置
- 支持服務器端排序功能
- 完整的列定義和語言鍵

## 🎯 用戶體驗提升

1. **列寬調整**: 用戶可以根據需要調整列寬，提高數據可讀性
2. **服務器端排序**: 真正的數據庫排序，支持大量數據
3. **分頁控制**: 完整的分頁功能，包括頁面大小選擇
4. **響應式設計**: 表格支持橫向滾動和粘性標題
5. **性能優化**: 減少前端數據處理，提高響應速度

## 🔄 兼容性

- ✅ 向後兼容現有功能
- ✅ 保持原有的 CRUD 操作
- ✅ 時區顯示功能完整保留
- ✅ 語言包支持完整

## 📈 性能提升

- **數據加載**: 服務器端分頁減少數據傳輸
- **排序性能**: 數據庫級排序比前端排序更高效
- **內存使用**: 分頁加載減少內存佔用
- **響應速度**: 優化的 API 調用提升響應速度

## 🚀 未來擴展

本次優化為後續功能擴展奠定了基礎：
- 搜索功能可以輕鬆添加
- 批量操作可以快速實現
- 更多排序選項可以簡單擴展
- 篩選功能可以無縫集成

---

**優化完成時間**: 2025-01-24  
**影響範圍**: BroadcastGroupsPage.js, ContactListController.cs, ContactListService.cs  
**代碼片段庫**: 已更新 tableSnippets.js 和 tableConfigs.js
