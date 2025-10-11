# 導覽視頻設置指南

## 概述
導覽系統已預留視頻播放位置，支援 YouTube 視頻嵌入。目前顯示佔位符，等待您提供演示視頻。

## 如何添加視頻

### 1. 準備 YouTube 視頻
- 錄製各步驟的操作演示視頻
- 上傳到 YouTube（建議設為公開或未列出）
- 確保視頻清晰，操作步驟明確

### 2. 獲取嵌入 URL
1. 打開 YouTube 視頻頁面
2. 點擊「分享」按鈕
3. 選擇「嵌入」選項
4. 複製提供的 `<iframe>` 代碼中的 `src` 屬性值
5. URL 格式應為：`https://www.youtube.com/embed/VIDEO_ID`

### 3. 配置視頻 URL
編輯文件：`src/components/OnboardingTour/videoConfig.js`

```javascript
export const VIDEO_URLS = {
  // 步驟 0: 儀表板演示
  0: 'https://www.youtube.com/embed/YOUR_DASHBOARD_VIDEO_ID',
  
  // 步驟 1: 訊息模版管理演示
  1: 'https://www.youtube.com/embed/YOUR_TEMPLATE_VIDEO_ID',
  
  // 步驟 2: 數據集管理演示
  2: 'https://www.youtube.com/embed/YOUR_DATASET_VIDEO_ID',
  
  // 步驟 3: 表單管理演示
  3: 'https://www.youtube.com/embed/YOUR_FORM_VIDEO_ID',
  
  // 步驟 4: 工作流程設計演示
  4: 'https://www.youtube.com/embed/YOUR_WORKFLOW_VIDEO_ID'
};
```

### 4. 視頻建議規格
- **解析度**：1920x1080 或更高
- **時長**：每步驟 2-5 分鐘
- **內容**：清晰的屏幕錄製，包含語音說明
- **格式**：MP4（YouTube 自動轉換）

## 各步驟視頻內容建議

### 步驟 0：儀表板演示
- 展示儀表板主界面
- 點擊各功能模組按鈕
- 查看統計數據和狀態
- 演示導航到不同功能頁面

### 步驟 1：訊息模版管理
- 創建內部模板
- 填寫模板內容和變量
- 提交 Meta 官方模板審核
- 管理模板狀態

### 步驟 2：數據集管理
- 創建新的數據集
- 配置數據源連接
- 測試數據連接
- 查看數據預覽

### 步驟 3：表單管理
- 使用 AI 生成表單
- 手動調整表單欄位
- 拖拽調整佈局
- 保存和預覽表單

### 步驟 4：工作流程設計
- 創建新工作流程
- 添加各種節點（開始、訊息、等待、條件等）
- 連接節點形成流程
- 配置節點參數

## 測試
添加視頻 URL 後：
1. 重新啟動應用程序
2. 點擊火箭按鈕啟動導覽
3. 在各步驟中點擊「開始演示」
4. 確認視頻正常播放

## 注意事項
- 確保 YouTube 視頻設為公開或未列出（嵌入需要）
- 視頻 URL 必須是嵌入格式，不是普通觀看 URL
- 建議使用清晰的語音說明，讓用戶更容易理解
- 可以為每個步驟錄製多個短視頻，選擇最佳版本


