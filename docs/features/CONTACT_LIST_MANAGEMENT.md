# Contact List 聯絡人管理系統

## 📋 **功能概覽**

Contact List 聯絡人管理系統是 WhatoFlow 平台的核心功能之一，提供完整的聯絡人管理、廣播群組管理和批量訊息發送能力。系統支持多租戶架構，每個公司擁有獨立的聯絡人數據庫，並提供豐富的篩選、搜尋和分類功能。

## 🏗️ **系統架構**

### **數據模型**

#### 1. ContactList (聯絡人)
```csharp
public class ContactList
{
    public Guid Id { get; set; }                    // 主鍵
    public Guid CompanyId { get; set; }             // 公司ID (多租戶)
    public string Name { get; set; }                // 姓名 (必填)
    public string? Title { get; set; }              // 職稱
    public string? Occupation { get; set; }         // 職業
    public string? WhatsAppNumber { get; set; }     // WhatsApp 號碼
    public string? Email { get; set; }              // 電子郵件
    public string? CompanyName { get; set; }        // 公司名稱
    public string? Department { get; set; }        // 部門
    public string? Position { get; set; }           // 職位
    public string? Hashtags { get; set; }           // 標籤 (逗號分隔)
    public Guid? BroadcastGroupId { get; set; }    // 廣播群組ID
    public bool IsActive { get; set; }              // 是否啟用
    public DateTime CreatedAt { get; set; }         // 創建時間
    public DateTime? UpdatedAt { get; set; }        // 更新時間
    public string CreatedBy { get; set; }           // 創建者
    public string? UpdatedBy { get; set; }          // 更新者
}
```

#### 2. BroadcastGroup (廣播群組)
```csharp
public class BroadcastGroup
{
    public Guid Id { get; set; }                    // 主鍵
    public Guid CompanyId { get; set; }             // 公司ID
    public string Name { get; set; }                // 群組名稱
    public string? Description { get; set; }        // 描述
    public string? Color { get; set; }              // 顏色 (#FF5733)
    public bool IsActive { get; set; }              // 是否啟用
    public DateTime CreatedAt { get; set; }         // 創建時間
    public DateTime? UpdatedAt { get; set; }        // 更新時間
    public string CreatedBy { get; set; }           // 創建者
    public string? UpdatedBy { get; set; }          // 更新者
}
```

#### 3. ContactHashtag (聯絡人標籤)
```csharp
public class ContactHashtag
{
    public Guid Id { get; set; }                    // 主鍵
    public Guid CompanyId { get; set; }             // 公司ID
    public string Name { get; set; }                // 標籤名稱
    public string? Color { get; set; }              // 顏色
    public string? Description { get; set; }        // 描述
    public bool IsActive { get; set; }              // 是否啟用
    public DateTime CreatedAt { get; set; }          // 創建時間
    public string CreatedBy { get; set; }           // 創建者
}
```

#### 4. BroadcastSend (廣播發送記錄)
```csharp
public class BroadcastSend
{
    public Guid Id { get; set; }                    // 主鍵
    public Guid CompanyId { get; set; }             // 公司ID
    public int? WorkflowExecutionId { get; set; }   // 工作流執行ID
    public Guid? BroadcastGroupId { get; set; }     // 廣播群組ID
    public string? HashtagFilter { get; set; }      // 標籤篩選
    public string? MessageContent { get; set; }     // 訊息內容
    public Guid? TemplateId { get; set; }           // 模板ID
    public int TotalContacts { get; set; }          // 總聯絡人數
    public int SentCount { get; set; }              // 已發送數
    public int FailedCount { get; set; }            // 失敗數
    public string Status { get; set; }              // 狀態
    public DateTime StartedAt { get; set; }          // 開始時間
    public DateTime? CompletedAt { get; set; }       // 完成時間
    public string CreatedBy { get; set; }           // 創建者
    public string? ErrorMessage { get; set; }       // 錯誤訊息
}
```

#### 5. BroadcastSendDetail (廣播發送詳情)
```csharp
public class BroadcastSendDetail
{
    public Guid Id { get; set; }                    // 主鍵
    public Guid BroadcastSendId { get; set; }      // 廣播發送ID
    public Guid ContactId { get; set; }             // 聯絡人ID
    public int? WhatsAppMessageId { get; set; }    // WhatsApp訊息ID
    public string Status { get; set; }              // 狀態
    public DateTime? SentAt { get; set; }          // 發送時間
    public string? ErrorMessage { get; set; }      // 錯誤訊息
}
```

### **數據庫設計**

#### 主要表格
- `contact_lists` - 聯絡人主表
- `broadcast_groups` - 廣播群組表
- `contact_hashtags` - 聯絡人標籤表
- `broadcast_sends` - 廣播發送記錄表
- `broadcast_send_details` - 廣播發送詳情表

#### 關鍵特性
- **多租戶支持**: 所有表格都有 `company_id` 欄位
- **軟刪除**: 使用 `is_active` 欄位標記刪除狀態
- **審計追蹤**: 記錄創建者、更新者、創建時間、更新時間
- **外鍵約束**: 確保數據完整性
- **索引優化**: 針對常用查詢欄位建立索引

## 🚀 **核心功能**

### **1. 聯絡人管理**

#### **CRUD 操作**
- **創建聯絡人**: 支持完整的聯絡人信息錄入
- **讀取聯絡人**: 分頁查詢、搜尋、篩選
- **更新聯絡人**: 支持部分更新和完整更新
- **刪除聯絡人**: 軟刪除，保留歷史記錄

#### **搜尋與篩選**
- **全文搜尋**: 支持姓名、郵箱、電話、公司、部門、職位搜尋
- **群組篩選**: 按廣播群組篩選聯絡人
- **標籤篩選**: 按標籤篩選聯絡人
- **狀態篩選**: 按啟用/停用狀態篩選

#### **批量操作**
- **批量刪除**: 支持選擇多個聯絡人進行批量刪除
- **批量匯入**: 支持 Excel/CSV 格式的批量匯入
- **批量匯出**: 支持聯絡人數據的批量匯出

### **2. 廣播群組管理**

#### **群組功能**
- **創建群組**: 支持群組名稱、描述、顏色設定
- **群組分類**: 按顏色和用途進行群組分類
- **聯絡人分配**: 將聯絡人分配到特定群組
- **群組統計**: 顯示每個群組的聯絡人數量

#### **群組操作**
- **編輯群組**: 修改群組信息和設定
- **刪除群組**: 軟刪除群組（保留歷史記錄）
- **群組預覽**: 查看群組內的聯絡人列表

### **3. 標籤管理**

#### **標籤系統**
- **動態標籤**: 支持動態創建和管理標籤
- **標籤分類**: 按顏色和用途進行標籤分類
- **標籤應用**: 為聯絡人添加多個標籤
- **標籤篩選**: 按標籤快速篩選聯絡人

#### **標籤操作**
- **快速添加**: 在聯絡人編輯頁面快速添加標籤
- **標籤移除**: 支持移除聯絡人的標籤
- **標籤統計**: 顯示每個標籤的使用頻率

### **4. 廣播發送系統**

#### **發送功能**
- **群組廣播**: 向指定群組發送訊息
- **標籤廣播**: 向具有特定標籤的聯絡人發送訊息
- **自定義廣播**: 手動選擇聯絡人進行廣播
- **模板廣播**: 使用預設模板進行廣播

#### **發送管理**
- **發送狀態**: 實時追蹤發送進度和狀態
- **發送詳情**: 查看每個聯絡人的發送結果
- **錯誤處理**: 記錄發送失敗的原因和重試機制
- **發送歷史**: 保存完整的發送記錄

## 🎨 **用戶界面**

### **前端技術棧**
- **React 18**: 現代化前端框架
- **Ant Design 5.x**: 企業級 UI 組件庫
- **React Router v6**: 前端路由管理
- **Axios**: HTTP 客戶端
- **React Context**: 狀態管理

### **主要頁面**

#### **1. 聯絡人列表頁面** (`ContactListPage.js`)
- **功能**: 聯絡人的主要管理界面
- **特性**: 
  - 分頁表格顯示聯絡人
  - 搜尋和篩選功能
  - 批量操作支持
  - 響應式設計
- **組件**: Table, Search, Select, Button, Modal

#### **2. 聯絡人編輯頁面** (`ContactEditPage.js`)
- **功能**: 新增/編輯聯絡人
- **特性**:
  - 表單驗證
  - 實時預覽
  - 快速標籤添加
  - 響應式布局
- **組件**: Form, Input, Select, Card, Tag

#### **3. 廣播群組頁面** (`BroadcastGroupsPage.js`)
- **功能**: 廣播群組管理
- **特性**:
  - 群組列表顯示
  - 群組創建和編輯
  - 顏色標識
  - 聯絡人統計

#### **4. 標籤管理頁面** (`HashtagsPage.js`)
- **功能**: 標籤管理
- **特性**:
  - 標籤列表顯示
  - 標籤創建和編輯
  - 顏色標識
  - 使用統計

#### **5. 廣播發送頁面** (`BroadcastSendPage.js`)
- **功能**: 廣播發送管理
- **特性**:
  - 發送記錄列表
  - 發送狀態追蹤
  - 發送詳情查看
  - 錯誤處理

### **API 服務** (`contactApi.js`)

#### **API 客戶端配置**
- **認證**: 自動添加 JWT Token
- **攔截器**: 請求/響應日誌記錄
- **錯誤處理**: 統一的錯誤處理機制
- **基礎 URL**: 環境變量配置

#### **主要 API 方法**
```javascript
// 聯絡人 API
contactApi.getContacts(params)           // 獲取聯絡人列表
contactApi.getContact(id)                 // 獲取單一聯絡人
contactApi.createContact(contact)         // 創建聯絡人
contactApi.updateContact(id, contact)     // 更新聯絡人
contactApi.deleteContact(id)              // 刪除聯絡人

// 廣播群組 API
broadcastGroupApi.getGroups()             // 獲取群組列表
broadcastGroupApi.createGroup(group)      // 創建群組
broadcastGroupApi.updateGroup(id, group)  // 更新群組
broadcastGroupApi.deleteGroup(id)         // 刪除群組

// 標籤 API
hashtagApi.getHashtags()                 // 獲取標籤列表
hashtagApi.createHashtag(hashtag)        // 創建標籤
hashtagApi.updateHashtag(id, hashtag)    // 更新標籤
hashtagApi.deleteHashtag(id)              // 刪除標籤

// 廣播 API
broadcastApi.getBroadcasts(params)        // 獲取廣播記錄
broadcastApi.sendBroadcast(data)          // 發送廣播
broadcastApi.getBroadcastDetails(id)      // 獲取廣播詳情
```

## 🔧 **後端服務**

### **控制器** (`ContactListController.cs`)

#### **主要端點**
```csharp
[HttpGet]                    // GET /api/contactlist
[HttpGet("{id}")]           // GET /api/contactlist/{id}
[HttpPost]                  // POST /api/contactlist
[HttpPut("{id}")]           // PUT /api/contactlist/{id}
[HttpDelete("{id}")]        // DELETE /api/contactlist/{id}
[HttpGet("groups")]          // GET /api/contactlist/groups
[HttpGet("hashtags")]       // GET /api/contactlist/hashtags
[HttpPost("import")]        // POST /api/contactlist/import
[HttpPost("export")]        // POST /api/contactlist/export
```

#### **安全特性**
- **JWT 認證**: 所有端點都需要認證
- **多租戶**: 自動過濾公司數據
- **參數驗證**: 完整的輸入驗證
- **錯誤處理**: 統一的錯誤響應格式

### **服務層** (`ContactListService.cs`)

#### **核心方法**
```csharp
// 聯絡人管理
GetContactsAsync()           // 獲取聯絡人列表
GetContactAsync()            // 獲取單一聯絡人
CreateContactAsync()         // 創建聯絡人
UpdateContactAsync()         // 更新聯絡人
DeleteContactAsync()         // 刪除聯絡人

// 廣播群組管理
GetBroadcastGroupsAsync()    // 獲取廣播群組
CreateBroadcastGroupAsync()  // 創建廣播群組
UpdateBroadcastGroupAsync()  // 更新廣播群組
DeleteBroadcastGroupAsync()  // 刪除廣播群組

// 標籤管理
GetContactHashtagsAsync()    // 獲取聯絡人標籤
CreateContactHashtagAsync()  // 創建聯絡人標籤
UpdateContactHashtagAsync()  // 更新聯絡人標籤
DeleteContactHashtagAsync()  // 刪除聯絡人標籤

// 廣播發送
GetBroadcastSendsAsync()     // 獲取廣播發送記錄
SendBroadcastAsync()         // 發送廣播
GetBroadcastDetailsAsync()   // 獲取廣播詳情
```

#### **業務邏輯**
- **數據驗證**: 完整的業務規則驗證
- **事務處理**: 確保數據一致性
- **日誌記錄**: 詳細的操作日誌
- **性能優化**: 高效的數據庫查詢

## 🌐 **國際化支持**

### **支持語言**
- **繁體中文** (zh-TC)
- **簡體中文** (zh-SC)  
- **英文** (en)

### **翻譯鍵結構**
```javascript
contactList: {
  title: '聯絡人管理',
  description: '管理您的聯絡人列表和廣播群組',
  name: '姓名',
  title: '職稱',
  contactInfo: '聯絡資訊',
  company: '公司/部門',
  group: '群組',
  tags: '標籤',
  actions: '操作',
  // ... 更多翻譯鍵
}
```

### **動態翻譯**
- **實時切換**: 支持運行時語言切換
- **上下文感知**: 根據用戶偏好自動選擇語言
- **完整覆蓋**: 所有 UI 文字都有對應翻譯

## 🔐 **安全與權限**

### **認證授權**
- **JWT Token**: 基於 Token 的認證機制
- **多租戶隔離**: 公司級數據隔離
- **角色權限**: 基於角色的訪問控制
- **會話管理**: 安全的用戶會話管理

### **數據安全**
- **輸入驗證**: 完整的輸入數據驗證
- **SQL 注入防護**: 參數化查詢
- **XSS 防護**: 前端輸入過濾
- **CSRF 防護**: 跨站請求偽造防護

### **審計追蹤**
- **操作日誌**: 記錄所有 CRUD 操作
- **用戶追蹤**: 記錄操作者信息
- **時間戳**: 精確的操作時間記錄
- **數據變更**: 記錄數據變更歷史

## 📊 **性能優化**

### **數據庫優化**
- **索引策略**: 針對常用查詢建立索引
- **分頁查詢**: 避免大量數據載入
- **查詢優化**: 高效的 SQL 查詢
- **連接池**: 數據庫連接池管理

### **前端優化**
- **組件懶載入**: 按需載入組件
- **數據緩存**: 適當的數據緩存策略
- **虛擬滾動**: 大量數據的虛擬滾動
- **防抖處理**: 搜尋輸入的防抖處理

### **API 優化**
- **響應壓縮**: Gzip 響應壓縮
- **緩存策略**: HTTP 緩存頭設置
- **異步處理**: 非阻塞的異步操作
- **批量操作**: 支持批量數據處理

## 🚀 **部署與維護**

### **部署要求**
- **.NET 8.0**: 後端運行環境
- **SQL Server**: 數據庫服務器
- **Node.js**: 前端構建環境
- **Web Server**: IIS 或 Nginx

### **配置管理**
- **環境變量**: 敏感信息環境變量配置
- **配置文件**: 應用配置管理
- **數據庫連接**: 數據庫連接字符串配置
- **日誌配置**: 日誌級別和輸出配置

### **監控與維護**
- **健康檢查**: 系統健康狀態監控
- **性能監控**: 系統性能指標監控
- **錯誤追蹤**: 錯誤日誌和追蹤
- **備份策略**: 數據備份和恢復

## 📈 **未來規劃**

### **功能擴展**
- **AI 標籤**: 基於 AI 的自動標籤建議
- **智能分組**: 自動聯絡人分組
- **批量匯入**: 更多格式的批量匯入支持
- **API 集成**: 第三方系統集成

### **技術升級**
- **微服務**: 向微服務架構演進
- **容器化**: Docker 容器化部署
- **雲原生**: 雲原生架構支持
- **實時通信**: WebSocket 實時通信

---

**最後更新**: 2025年1月15日  
**功能版本**: v1.0  
**狀態**: 已完成基礎功能開發
