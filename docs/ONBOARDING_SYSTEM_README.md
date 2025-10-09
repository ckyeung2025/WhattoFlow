# WhattoFlow 小精靈/初心者導覽系統

## 🎯 概述

WhattoFlow 小精靈導覽系統是一個遊戲化的新手引導平台，幫助新用戶快速掌握 WhattoFlow 的核心功能。系統採用現代化的 UI 設計，包含動畫效果、成就系統和進度追蹤。

## ✨ 主要功能

### 🎮 遊戲化體驗
- **關卡系統**: 5個主要關卡，逐步學習系統功能
- **成就系統**: 完成任務獲得成就徽章和積分
- **進度追蹤**: 實時顯示學習進度和完成率
- **慶祝動畫**: 完成成就時的粒子效果和慶祝動畫

### 🎨 視覺設計
- **現代化 UI**: 漸層背景、毛玻璃效果、圓角設計
- **動畫效果**: 粒子系統、脈衝動畫、滑動過渡
- **響應式設計**: 適配桌面和移動設備
- **主題一致性**: 延續 WhattoFlow 的紫色主題

### 🌐 國際化支持
- **多語言**: 支持繁體中文、簡體中文、英文
- **動態切換**: 實時語言切換，無需重啟
- **完整翻譯**: 所有導覽文本都有對應翻譯

## 🏗️ 系統架構

### 核心組件
```
src/
├── components/
│   ├── OnboardingTour/           # 導覽核心組件
│   │   ├── OnboardingTour.js     # 主導覽組件
│   │   ├── TourStep.js          # 單步導覽組件
│   │   ├── ProgressBar.js       # 進度條組件
│   │   ├── AchievementBadge.js   # 成就徽章組件
│   │   ├── FloatingGuide.js     # 浮動引導組件
│   │   ├── OverlayMask.js       # 遮罩層組件
│   │   └── OnboardingTour.css   # 樣式文件
│   ├── OnboardingAnimations/    # 動畫組件
│   │   └── ParticleEffect.js    # 粒子效果組件
│   └── OnboardingTrigger.js     # 導覽觸發器
├── hooks/
│   └── useOnboardingTour.js     # 導覽狀態管理
├── pages/
│   └── OnboardingManagementPage.js # 導覽管理頁面
└── locales/
    ├── onboarding-zh-TC.json    # 繁體中文文本
    └── onboarding-en.json       # 英文文本
```

### 狀態管理
- **useOnboardingTour Hook**: 管理導覽狀態、進度、成就
- **localStorage 持久化**: 保存用戶進度，支持斷點續傳
- **實時同步**: 狀態變更實時反映到 UI

## 🚀 使用方法

### 啟動導覽
1. **自動觸發**: 新用戶登入後會看到右下角的火箭按鈕
2. **手動啟動**: 點擊側邊菜單的「新手導覽」進入管理頁面
3. **URL 訪問**: 直接訪問 `/onboarding` 路徑

### 導覽流程
1. **歡迎界面**: 系統功能介紹和導覽說明
2. **系統概覽**: 了解界面佈局和主要功能
3. **工作流創建**: 學習創建和設計工作流程
4. **表單設計**: 掌握電子表單設計技巧
5. **數據集管理**: 學習數據源設置和查詢
6. **WhatsApp 集成**: 完成 WhatsApp 業務流程設置

### 成就系統
- **工作流新手**: 創建第一個工作流 (100分)
- **表單大師**: 設計第一個電子表單 (150分)
- **數據巫師**: 設置第一個數據集 (200分)
- **WhatsApp 專家**: 完成 WhatsApp 集成 (250分)
- **導覽完成者**: 完成所有導覽步驟 (500分)

## 🎨 自定義配置

### 修改導覽步驟
在 `src/hooks/useOnboardingTour.js` 中修改 `TOUR_STEPS` 數組：

```javascript
const TOUR_STEPS = [
  {
    id: 'custom-step',
    title: '自定義步驟',
    description: '步驟描述',
    target: '.target-element',
    achievements: ['custom-achievement']
  }
];
```

### 添加新成就
在 `src/hooks/useOnboardingTour.js` 中修改 `ACHIEVEMENTS` 對象：

```javascript
const ACHIEVEMENTS = {
  'custom-achievement': {
    id: 'custom-achievement',
    title: '自定義成就',
    description: '成就描述',
    icon: '🎯',
    points: 100,
    type: 'custom',
    unlockCondition: 'custom-action'
  }
};
```

### 修改動畫效果
在 `src/components/OnboardingAnimations/ParticleEffect.js` 中自定義粒子效果：

```javascript
// 添加新的粒子類型
class CustomParticle {
  constructor(canvasWidth, canvasHeight) {
    // 自定義粒子邏輯
  }
}
```

## 🔧 開發指南

### 添加新語言
1. 創建新的語言文件：`src/locales/onboarding-[lang].json`
2. 在 `src/contexts/LanguageContext.js` 中導入並添加到 `locales` 對象
3. 確保所有文本都有對應翻譯

### 擴展導覽功能
1. **新組件**: 在 `src/components/OnboardingTour/` 中創建新組件
2. **新動畫**: 在 `src/components/OnboardingAnimations/` 中添加動畫效果
3. **新頁面**: 在 `src/pages/` 中創建導覽相關頁面

### 調試模式
開發模式下會顯示重置按鈕，方便測試：
- 位置：左下角
- 功能：重置所有導覽進度
- 僅在 `NODE_ENV === 'development'` 時顯示

## 📱 響應式設計

### 桌面端 (≥768px)
- 全屏模態框 (900px 寬度)
- 雙欄佈局 (步驟說明 + 視覺演示)
- 完整的動畫效果

### 移動端 (<768px)
- 適配屏幕寬度的模態框
- 單欄佈局
- 簡化的動畫效果
- 觸控友好的交互

## 🎯 最佳實踐

### 性能優化
- **懶加載**: 動畫資源按需加載
- **防抖動**: 避免頻繁的狀態更新
- **內存管理**: 及時清理事件監聽器和動畫

### 用戶體驗
- **非侵入式**: 不影響正常使用流程
- **可跳過**: 用戶隨時可以跳過導覽
- **斷點續傳**: 支持中斷後繼續
- **視覺反饋**: 豐富的動畫和狀態提示

### 可維護性
- **模組化設計**: 組件職責單一，易於維護
- **類型安全**: 使用 PropTypes 或 TypeScript
- **文檔完整**: 詳細的註釋和使用說明

## 🐛 故障排除

### 常見問題
1. **導覽不顯示**: 檢查 localStorage 中的進度狀態
2. **動畫卡頓**: 降低粒子密度或關閉動畫效果
3. **語言切換失效**: 確認語言文件正確導入
4. **樣式錯亂**: 檢查 CSS 類名衝突

### 調試工具
- **控制台日誌**: 詳細的狀態變更日誌
- **localStorage 檢查**: 查看 `whattoflow-onboarding-progress`
- **React DevTools**: 檢查組件狀態和 props

## 📈 未來規劃

### 功能擴展
- **個性化導覽**: 根據用戶角色定制導覽內容
- **視頻教程**: 集成視頻教學內容
- **互動練習**: 添加實際操作練習
- **進度分析**: 詳細的學習進度分析

### 技術優化
- **TypeScript 支持**: 完整的類型定義
- **單元測試**: 組件和 Hook 的測試覆蓋
- **性能監控**: 導覽性能指標收集
- **A/B 測試**: 不同導覽策略的效果對比

---

**版本**: 1.0.0  
**最後更新**: 2025年1月  
**維護者**: WhattoFlow 開發團隊


