# WhatoFlow 系統概覽

## 🎯 **系統簡介**

WhatoFlow 是一個企業級的工作流管理平台，專注於 WhatsApp 業務流程自動化、表單管理和數據處理。系統採用現代化的微服務架構，支持多租戶、多語言，並提供完整的業務流程設計和執行能力。

## 🏗️ **系統架構**

### **後端技術棧**
- **框架**: .NET 8.0 Web API
- **數據庫**: Microsoft SQL Server (MSSQL) + ERP 數據庫
- **ORM**: Entity Framework Core 8.0
- **認證**: JWT Bearer Token
- **日誌**: 自定義 LoggingService 支持文件日誌
- **文檔處理**: LibreOffice 集成、OpenXML 支持、iTextSharp PDF 生成

### **前端技術棧**
- **框架**: React 18 + Ant Design 5.x
- **路由**: React Router v6
- **狀態管理**: React Context + Hooks
- **國際化**: 自定義 LanguageContext (支持 zh-TC, zh-SC, en)
- **圖表**: ECharts + ReactECharts
- **工作流設計**: React Flow
- **表單設計**: GrapesJS

### **系統服務**
- **工作流引擎**: WorkflowEngine 服務
- **PDF 服務**: PdfService 支持圖片轉 PDF
- **文檔轉換**: DocumentConverterService 支持多格式轉換
- **送貨管理**: DeliveryService 支持 QR Code 掃描
- **用戶會話**: UserSessionService 管理用戶狀態
- **消息驗證**: IMessageValidator 接口實現

## 🚀 **核心功能模組**

### **1. 工作流管理系統**
- **工作流定義**: 視覺化設計器 (React Flow)
- **工作流執行**: 實時執行引擎
- **步驟追蹤**: WorkflowStepExecution 詳細記錄
- **狀態管理**: 運行、等待、完成、錯誤等狀態
- **流程變量**: Process Variables 支持動態數據管理
- **條件分支**: Switch 節點支持複雜業務邏輯

### **2. WhatsApp 業務流程**
- **Meta Webhook 集成**: 實時消息處理
- **工作流觸發**: 基於消息的自動化流程
- **AI 輔助**: Grok-3 模型集成
- **消息驗證**: 防重複處理機制
- **QR Code 處理**: 智能識別和數據提取
- **流程變量注入**: 支持 ${variable} 語法在消息中使用

### **3. E-Form 表單系統**
- **表單設計**: GrapesJS 視覺化設計器
- **表單實例**: 動態表單渲染和數據收集
- **工作流集成**: 表單與工作流無縫結合
- **文件上傳**: 支持多種文檔格式
- **變量映射**: 表單數據與流程變量雙向映射

### **4. 數據集管理**
- **多數據源**: SQL、Excel、CSV 等
- **參數化查詢**: 動態參數支持
- **公司隔離**: 多租戶數據安全
- **實時數據**: 動態數據更新
- **工作流集成**: 支持在流程中查詢和更新數據集

### **5. 送貨管理系統**
- **QR Code 掃描**: 簽收單據識別
- **PDF 生成**: 自動生成送貨單據
- **狀態追蹤**: 完整送貨流程記錄
- **圖片處理**: 簽收單據圖片管理

### **6. 流程變量系統**
- **變量定義**: 支持多種數據類型 (string, int, decimal, datetime, boolean, json)
- **動態映射**: DataSet、eForm、外部 API 數據映射
- **Tag 語法**: 支持 ${variable} 語法在消息和表單中使用
- **JSON 支持**: 複雜數據結構的存儲和處理
- **實時監控**: 流程執行時的變量值追蹤

### **7. 智能節點系統**
- **QR Code 節點**: 等待和處理 QR Code 圖片
- **Switch 節點**: 條件分支和路徑選擇
- **DataSet 節點**: 查詢和更新數據集
- **變量映射節點**: 數據轉換和映射處理

## 🔐 **安全與權限**

### **認證授權**
- JWT Token 認證
- 基於角色的權限控制 (RBAC)
- 公司級數據隔離
- 用戶會話管理

### **數據安全**
- 參數化查詢防 SQL 注入
- 文件上傳類型驗證
- 敏感數據加密存儲
- 審計日誌記錄

## 📊 **監控與日誌**

### **系統監控**
- 工作流執行狀態實時監控
- 流程變量值實時追蹤
- 性能指標收集
- 錯誤追蹤和報告
- 用戶活動審計

### **日誌系統**
- 結構化日誌記錄
- 多級別日誌 (Info, Warning, Error)
- 日誌文件輪轉管理
- 集中化日誌查詢

## 🚀 **部署與擴展**

### **部署要求**
- .NET 8.0 Runtime
- SQL Server 2019+
- LibreOffice (文檔轉換)
- 足夠的磁盤空間 (文件上傳)

### **性能優化**
- 數據庫連接池
- 異步處理支持
- 緩存機制
- 負載均衡準備

---

**最後更新**: 2025年8月31日  
**系統版本**: v2.1  
**新增功能**: 流程變量系統、Switch節點、QR Code處理、DataSet工作流集成
