# ContactListPage.js 優化總結

## 🎯 優化目標
將 `ContactListPage.js` 優化為標準表格，添加列調整大小和真實數據庫排序功能。

## ✅ 已完成的優化

### 1. **添加 Resizable 功能**
- ✅ 導入 `react-resizable` 庫
- ✅ 創建 `ResizableTitle` 組件
- ✅ 添加列寬度狀態管理 `columnWidths`
- ✅ 實現 `handleResize` 函數處理列寬度調整
- ✅ 配置表格組件使用 `ResizableTitle`

### 2. **實現真實數據庫排序**
- ✅ 添加排序狀態管理：`sortField` 和 `sortOrder`
- ✅ 更新 `loadContacts` 函數，將排序參數傳遞給 API
- ✅ 實現 `handleTableChange` 函數處理表格變化
- ✅ 為所有可排序列添加 `sorter: true` 和 `sortDirections`
- ✅ 更新 `useEffect` 依賴項包含排序狀態

### 3. **優化列定義結構**
- ✅ 重構列定義為 `baseColumns` 和 `resizableColumns`
- ✅ 使用 `React.useMemo` 優化性能
- ✅ 為每列設置動態寬度
- ✅ 添加表格組件配置

### 4. **增強表格功能**
- ✅ 添加水平滾動：`scroll={{ x: 1200 }}`
- ✅ 添加垂直滾動：`scroll={{ y: 'calc(100vh - 400px)' }}`
- ✅ 添加粘性表頭：`sticky={{ offsetHeader: 0 }}`
- ✅ 增強分頁選項：`pageSizeOptions: ['10', '20', '50', '100']`
- ✅ 啟用分頁大小選擇器：`showSizeChanger: true`

## 🔧 技術實現細節

### 列寬度管理
```javascript
const [columnWidths, setColumnWidths] = useState({
  select: 50,
  name: 200,
  contact: 200,
  company: 180,
  broadcastGroup: 150,
  hashtags: 200,
  createdAt: 150,
  updatedAt: 150,
  actions: 100
});
```

### 排序狀態管理
```javascript
const [sortField, setSortField] = useState('');
const [sortOrder, setSortOrder] = useState('');
```

### API 參數傳遞
```javascript
const params = {
  page: currentPage,
  pageSize: pageSize,
  search: searchTerm || undefined,
  broadcastGroupId: selectedGroup || undefined,
  hashtagFilter: selectedHashtag || undefined,
  sortField: sortField || undefined,      // 新增
  sortOrder: sortOrder || undefined      // 新增
};
```

### 表格變化處理
```javascript
const handleTableChange = (pagination, filters, sorter) => {
  // 處理排序
  if (sorter && sorter.field) {
    setSortField(sorter.field);
    setSortOrder(sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : '');
  } else {
    setSortField('');
    setSortOrder('');
  }
  
  // 處理分頁
  if (pagination.current !== currentPage) {
    setCurrentPage(pagination.current);
  }
};
```

## 📊 支持的排序字段

| 字段 | 數據庫字段 | 排序支持 |
|------|------------|----------|
| 姓名 | `name` | ✅ |
| 聯絡信息 | `whatsAppNumber`, `email` | ✅ |
| 公司 | `companyName` | ✅ |
| 群組 | `broadcastGroupId` | ✅ |
| 創建時間 | `createdAt` | ✅ |
| 更新時間 | `updatedAt` | ✅ |

## 🎨 用戶體驗改進

### 1. **列調整大小**
- 每列都可以通過拖拽邊界調整寬度
- 最小寬度限制為 30px
- 調整後的寬度會保存到狀態中

### 2. **排序功能**
- 點擊列標題進行排序
- 支持升序、降序、無排序三種狀態
- 排序狀態會傳遞給後端 API

### 3. **響應式設計**
- 表格支持水平滾動
- 表頭固定，內容可滾動
- 適應不同屏幕尺寸

### 4. **分頁增強**
- 支持多種分頁大小：10、20、50、100
- 快速跳轉到指定頁面
- 顯示當前頁範圍和總數

## 🔄 後端 API 要求

為了支持新的排序功能，後端 API 需要處理以下參數：

```javascript
// GET /api/contactlist
{
  page: 1,
  pageSize: 20,
  search: "搜索詞",
  broadcastGroupId: "群組ID",
  hashtagFilter: "標籤名",
  sortField: "name",        // 排序字段
  sortOrder: "asc"          // 排序方向: asc/desc
}
```

## 🚀 使用方式

### 1. **列調整大小**
- 將鼠標懸停在列邊界
- 拖拽調整列寬度
- 調整後的寬度會自動保存

### 2. **排序操作**
- 點擊列標題進行排序
- 再次點擊切換排序方向
- 第三次點擊取消排序

### 3. **分頁操作**
- 使用分頁器導航
- 選擇每頁顯示數量
- 快速跳轉到指定頁面

## 📝 注意事項

1. **性能優化**：使用 `React.useMemo` 避免不必要的重新渲染
2. **狀態管理**：排序和分頁狀態會觸發數據重新載入
3. **API 兼容性**：確保後端 API 支持新的排序參數
4. **響應式設計**：表格在不同屏幕尺寸下都能正常顯示

## 🎉 優化效果

- ✅ **列調整大小**：用戶可以根據需要調整列寬度
- ✅ **真實排序**：支持數據庫級別的排序，提高性能
- ✅ **更好的 UX**：粘性表頭、滾動優化、分頁增強
- ✅ **標準化**：符合企業級表格的標準功能
- ✅ **可維護性**：代碼結構清晰，易於擴展

這個優化後的 `ContactListPage.js` 現在具備了標準企業級表格的所有核心功能，可以作為其他頁面的參考模板。
