# HashtagsPage 優化總結

## 📋 概述

本文檔總結了對 `HashtagsPage.js` 的優化，將其轉換為具有列寬調整、服務器端排序和分頁功能的標準表格頁面。

## 🎯 優化目標

- ✅ **列寬調整**: 支持拖拽調整列寬
- ✅ **服務器端排序**: 真正的數據庫排序
- ✅ **分頁功能**: 支持分頁和頁面大小調整
- ✅ **搜索功能**: 服務器端搜索
- ✅ **時區顯示**: 正確的時間顯示

## 🔧 前端修改

### 1. 導入和組件

```javascript
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

// ResizableTitle 組件
const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[30, 0]}
      handle={
        <span
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px', cursor: 'col-resize', zIndex: 1, userSelect: 'none' }}
          onClick={e => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ position: 'relative' }} />
    </Resizable>
  );
};
```

### 2. 狀態管理

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
  description: 250,
  usage: 120,
  color: 120,
  createdAt: 150,
  updatedAt: 150,
  actions: 150
});
```

### 3. 列定義更新

```javascript
const baseColumns = React.useMemo(() => [
  {
    title: t('hashtags.tagName'),
    dataIndex: 'name',
    key: 'name',
    width: columnWidths.name,
    sorter: true,
    sortDirections: ['ascend', 'descend'],
    // ... render 函數
  },
  // ... 其他列
], [t, userTimezoneOffset, hashtagStats, columnWidths]);
```

### 4. 事件處理函數

```javascript
// 列寬調整處理函數
const handleResize = (index) => (e, { size }) => {
  const columnKeys = Object.keys(columnWidths);
  const columnKey = columnKeys[index];
  if (columnKey) {
    setColumnWidths(prev => ({
      ...prev,
      [columnKey]: size.width
    }));
  }
};

// 表格變更處理函數
const handleTableChange = (pagination, filters, sorter) => {
  // 處理排序
  if (sorter && sorter.field) {
    const newSortField = sorter.field;
    const newSortOrder = sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : '';
    
    setSortField(newSortField);
    setSortOrder(newSortOrder);
  } else {
    setSortField('');
    setSortOrder('');
  }
  
  // 處理分頁
  if (pagination.current !== currentPage) {
    setCurrentPage(pagination.current);
  }
  if (pagination.pageSize !== pageSize) {
    setPageSize(pagination.pageSize);
    setCurrentPage(1); // 重置到第一頁
  }
};
```

### 5. API 調用更新

```javascript
const loadHashtags = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const params = {
      page: currentPage,
      pageSize: pageSize,
      search: searchTerm || undefined,
      sortField: sortField || undefined,
      sortOrder: sortOrder || undefined
    };
    
    const response = await hashtagApi.getHashtags(params);
    
    // 處理新的 API 響應格式
    const hashtagsData = response?.data || response || [];
    setHashtags(hashtagsData);
    setTotalCount(response?.total || hashtagsData.length);
    
    // ... 載入統計數據
  } catch (err) {
    setError(t('hashtags.loadError') + ': ' + (err.response?.data || err.message));
  } finally {
    setLoading(false);
  }
};
```

### 6. 表格組件更新

```javascript
<Table
  columns={resizableColumns}
  dataSource={hashtags}
  rowKey="id"
  loading={loading}
  onChange={handleTableChange}
  components={components}
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
  scroll={{ x: 1200, y: 'calc(100vh - 300px)' }}
  sticky={{ offsetHeader: 0 }}
  // ... 其他配置
/>
```

## 🔧 後台修改

### 1. 控制器更新

```csharp
[HttpGet("hashtags")]
public async Task<IActionResult> GetHashtags(
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20,
    [FromQuery] string? search = null,
    [FromQuery] string? sortField = null,
    [FromQuery] string? sortOrder = null)
{
    try
    {
        var companyId = GetCurrentCompanyId();
        if (companyId == Guid.Empty)
            return Unauthorized("無法識別公司資訊");

        var (hashtags, totalCount) = await _contactListService.GetHashtagsAsync(companyId, page, pageSize, search, sortField, sortOrder);
        
        return Ok(new {
            data = hashtags,
            total = totalCount,
            page = page,
            pageSize = pageSize,
            totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
        });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "獲取標籤列表失敗");
        return StatusCode(500, "獲取標籤列表失敗");
    }
}
```

### 2. 服務層更新

```csharp
public async Task<(List<ContactHashtag> hashtags, int totalCount)> GetHashtagsAsync(
    Guid companyId, 
    int page = 1, 
    int pageSize = 20, 
    string? search = null, 
    string? sortField = null, 
    string? sortOrder = null)
{
    var query = _context.ContactHashtags
        .Where(h => h.CompanyId == companyId && h.IsActive);

    // 搜索過濾
    if (!string.IsNullOrEmpty(search))
    {
        query = query.Where(h => 
            h.Name.Contains(search) || 
            (h.Description != null && h.Description.Contains(search)));
    }

    // 獲取總數
    var totalCount = await query.CountAsync();

    // 排序
    if (!string.IsNullOrEmpty(sortField) && !string.IsNullOrEmpty(sortOrder))
    {
        switch (sortField.ToLower())
        {
            case "name":
                query = sortOrder.ToLower() == "desc" 
                    ? query.OrderByDescending(h => h.Name)
                    : query.OrderBy(h => h.Name);
                break;
            case "description":
                query = sortOrder.ToLower() == "desc" 
                    ? query.OrderByDescending(h => h.Description)
                    : query.OrderBy(h => h.Description);
                break;
            case "color":
                query = sortOrder.ToLower() == "desc" 
                    ? query.OrderByDescending(h => h.Color)
                    : query.OrderBy(h => h.Color);
                break;
            case "createdat":
                query = sortOrder.ToLower() == "desc" 
                    ? query.OrderByDescending(h => h.CreatedAt)
                    : query.OrderBy(h => h.CreatedAt);
                break;
            case "updatedat":
                query = sortOrder.ToLower() == "desc" 
                    ? query.OrderByDescending(h => h.UpdatedAt)
                    : query.OrderBy(h => h.UpdatedAt);
                break;
            default:
                query = query.OrderBy(h => h.Name);
                break;
        }
    }
    else
    {
        query = query.OrderBy(h => h.Name);
    }

    // 分頁
    var hashtags = await query
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();

    return (hashtags, totalCount);
}
```

### 3. API 客戶端更新

```javascript
// 獲取標籤列表
getHashtags: async (params = {}) => {
  const response = await apiClient.get('/api/contactlist/hashtags', { params });
  return response.data;
},
```

## 📚 工具更新

### 1. tableSnippets.js

添加了 `hashtagsConfig` 配置，包含：
- 列寬配置
- 列定義模板
- API 調用模板

### 2. tableConfigs.js

添加了 `hashtagsConfig` 配置，包含：
- 功能選項
- 列配置
- API 配置
- 語言鍵模板

## 🎯 功能特性

### ✅ 列寬調整
- 支持拖拽調整列寬
- 最小寬度限制 (30px)
- 視覺反饋 (col-resize 光標)

### ✅ 服務器端排序
- 支持按名稱、描述、顏色、創建時間、更新時間排序
- 升序/降序切換
- 真正的數據庫排序

### ✅ 分頁功能
- 支持分頁導航
- 頁面大小調整 (10, 20, 50, 100)
- 快速跳轉
- 總數顯示

### ✅ 搜索功能
- 服務器端搜索
- 支持按名稱和描述搜索
- 實時搜索

### ✅ 時區顯示
- 正確的時間顯示
- 支持用戶時區設置
- 創建時間和更新時間顯示

## 🔍 測試要點

1. **列寬調整**: 拖拽列標題邊界調整寬度
2. **排序功能**: 點擊列標題進行排序
3. **分頁功能**: 測試分頁導航和頁面大小調整
4. **搜索功能**: 輸入搜索詞進行搜索
5. **時區顯示**: 檢查時間顯示是否正確

## 📝 注意事項

1. **API 響應格式**: 後台返回 `{ data, total, page, pageSize, totalPages }` 格式
2. **列寬狀態**: 使用 `columnWidths` 狀態管理列寬
3. **排序狀態**: 使用 `sortField` 和 `sortOrder` 狀態管理排序
4. **分頁狀態**: 使用 `currentPage` 和 `pageSize` 狀態管理分頁
5. **搜索狀態**: 使用 `searchTerm` 狀態管理搜索

## ⚠️ 重要說明

**ContactHashtag 模型限制**: `ContactHashtag` 模型只有 `CreatedAt` 欄位，沒有 `UpdatedAt` 欄位。因此：
- 只顯示 `CreatedAt` 時間
- 後台排序時，`updatedAt` 排序會使用 `CreatedAt` 代替
- 前端只顯示一個時間列

### 🔧 模型限制處理

由於 `ContactHashtag` 模型沒有 `UpdatedAt` 欄位，我們進行了以下調整：

1. **後台排序邏輯**:
```csharp
case "updatedat":
    // ContactHashtag 沒有 UpdatedAt 欄位，使用 CreatedAt 代替
    query = sortOrder.ToLower() == "desc" 
        ? query.OrderByDescending(h => h.CreatedAt)
        : query.OrderBy(h => h.CreatedAt);
    break;
```

2. **前端列定義**: 移除了 `updatedAt` 列，只保留 `createdAt` 列

3. **列寬配置**: 更新了 `columnWidths` 狀態，移除了 `updatedAt` 相關配置

## 🎉 總結

`HashtagsPage.js` 已成功優化為具有完整功能的標準表格頁面，包括列寬調整、服務器端排序、分頁和搜索功能。所有功能都與其他優化的頁面保持一致，提供了良好的用戶體驗。由於 `ContactHashtag` 模型的限制，只顯示創建時間，但這不影響整體功能的完整性。
