# 免費 MSI/安裝工具比較

## 需求分析
你需要：
1. ✅ 自定義安裝目錄選擇（圖形化）
2. ✅ 自定義 .NET 後端端口
3. ✅ 自定義 Node.js 前端端口
4. ✅ 自定義主程序數據庫連接字符串

## 工具比較

### 1. **Inno Setup** ⭐⭐⭐⭐⭐（強烈推薦）
- **免費**：完全免費開源
- **格式**：EXE（不是 MSI，但功能更完整）
- **優點**：
  - 強大的圖形化腳本編輯器
  - 內建目錄選擇對話框
  - 支援自定義輸入框（端口、連接字符串）
  - 易於學習和使用
  - 文檔完善，社區活躍
- **缺點**：
  - 生成 EXE 而非 MSI（但功能更強大）
  - 需要學習 Pascal 腳本語法（但很簡單）
- **適合場景**：需要完整 UI 和靈活配置

### 2. **NSIS (Nullsoft Scriptable Install System)** ⭐⭐⭐⭐
- **免費**：完全免費開源
- **格式**：EXE（不是 MSI）
- **優點**：
  - 非常靈活和強大
  - 支援自定義 UI 界面
  - 腳本語言簡單
  - 體積小，安裝速度快
- **缺點**：
  - 學習曲線較陡
  - 也是 EXE 而非 MSI
  - 文檔不如 Inno Setup 友好
- **適合場景**：需要極高自定義度

### 3. **WiX Toolset v3.x** ⭐⭐⭐
- **免費**：完全免費開源
- **格式**：MSI
- **優點**：
  - 真正的 MSI 格式
  - v3.x 版本 UI 擴展更穩定
  - XML 配置，版本控制友好
- **缺點**：
  - v6.0 有 UI 問題（你目前遇到的）
  - v3.x 是舊版本，但可能更穩定
  - 學習曲線較陡
- **適合場景**：必須使用 MSI 格式

### 4. **Advanced Installer Free Edition** ⭐⭐⭐
- **免費**：有免費版本（功能受限）
- **格式**：MSI
- **優點**：
  - 圖形化界面
  - 真正的 MSI
  - 易於使用
- **缺點**：
  - 免費版功能受限（可能不支援自定義屬性）
  - 不是完全開源

## 推薦方案

### 🏆 最佳選擇：**Inno Setup**

**為什麼選擇 Inno Setup？**
1. ✅ 完全免費且功能完整
2. ✅ 內建目錄選擇對話框（不需額外擴展）
3. ✅ 支援自定義輸入框，完美滿足你的需求：
   - 目錄選擇
   - 端口輸入（.NET 和 Node.js）
   - 數據庫連接字符串輸入
4. ✅ 學習曲線平緩，文檔完善
5. ✅ 社區活躍，範例豐富

**範例腳本結構：**
```pascal
[Setup]
AppName=WhatoFlow
DefaultDirName={pf}\WhatoFlow

[Code]
var
  DotNetPortPage: TInputQueryWizardPage;
  NodePortPage: TInputQueryWizardPage;
  DatabaseConnPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  // 創建自定義端口輸入頁面
  DotNetPortPage := CreateInputQueryPage(wpSelectDir,
    'Backend Port', 'Enter .NET backend port:',
    'Please enter the port number for the .NET backend (default: 64213):');
  DotNetPortPage.Add('Port:', False);
  DotNetPortPage.Values[0] := '64213';

  // Node.js 端口頁面
  NodePortPage := CreateInputQueryPage(DotNetPortPage.ID,
    'Frontend Port', 'Enter React frontend port:',
    'Please enter the port number for the React frontend (default: 3000):');
  NodePortPage.Add('Port:', False);
  NodePortPage.Values[0] := '3000';

  // 數據庫連接字符串頁面
  DatabaseConnPage := CreateInputQueryPage(NodePortPage.ID,
    'Database Connection', 'Enter database connection string:',
    'Please enter the main database connection string:');
  DatabaseConnPage.Add('Connection String:', True);
end;
```

### 📋 實施建議

**選項 A：遷移到 Inno Setup（推薦）**
- 時間：1-2 小時
- 難度：簡單
- 結果：完整功能，圖形化 UI

**選項 B：使用 WiX + PowerShell GUI**
- 時間：30 分鐘
- 難度：中等
- 結果：保持 MSI 格式，但需要額外的 PowerShell 腳本

**選項 C：降級到 WiX v3.x**
- 時間：1 小時
- 難度：中等
- 結果：真正的 MSI，但需要測試兼容性

## 我的建議

由於你需要：
- 目錄選擇 ✅
- 端口配置 ✅
- 數據庫連接字符串 ✅

**Inno Setup 是最佳選擇**，因為：
1. 完全免費且功能完整
2. 內建所有你需要的 UI 元素
3. 不需要處理擴展或版本問題
4. 生成的 EXE 安裝程序同樣專業

**雖然不是 MSI 格式，但：**
- EXE 安裝程序更靈活
- 用戶體驗可能更好
- 對於你的需求，EXE vs MSI 沒有實質區別

## 下一步

如果你想使用 Inno Setup，我可以幫你：
1. 創建 Inno Setup 腳本文件
2. 配置目錄選擇
3. 配置端口輸入框
4. 配置數據庫連接字符串輸入
5. 整合到現有的建置流程中

你希望我開始創建 Inno Setup 腳本嗎？




