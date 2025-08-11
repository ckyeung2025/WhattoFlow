import { useEffect, useState, useCallback } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import 'grapesjs-preset-webpage';
import 'grapesjs-plugin-forms';

// 導入編輯器組件
import React from 'react';
import ReactDOM from 'react-dom/client'; // 使用新版本的 ReactDOM
import {
  TextInputEditor,
  TextAreaEditor,
  SelectEditor,
  RadioEditor,
  CheckboxEditor,
  ButtonEditor,
  LabelEditor
} from '../components/EFormDesigner/editors';

// 動態載入語言資源
const loadLanguageResources = async (language) => {
  try {
    let resources;
    switch (language) {
      case 'zh-SC':
        resources = await import('../locales/zh-SC.js');
        return resources.default;
      case 'zh-TC':
        resources = await import('../locales/zh-TC.js');
        return resources.default;
      case 'en':
        resources = await import('../locales/en.js');
        return resources.default;
      default:
        resources = await import('../locales/zh-TC.js');
        return resources.default;
    }
  } catch (error) {
    console.error('載入語言資源失敗:', error);
    // 返回默認的繁體中文
    return {
      eformDesigner: {
        welcomeMessage: '歡迎使用表單設計器',
        welcomeDescription: '請從左側面板拖拽組件到此處開始設計您的表單。',
        exampleInput: '示例輸入框',
        exampleInputPlaceholder: '請輸入...'
      }
    };
  }
};

const useGrapesJS = (containerRef, initialHtmlContent, onEditorReady) => {
  const [editor, setEditor] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [languageResources, setLanguageResources] = useState(null);

  console.log('🚀 useGrapesJS: Hook 初始化，參數:', {
    hasContainerRef: !!containerRef,
    hasInitialHtmlContent: !!initialHtmlContent,
    hasOnEditorReady: !!onEditorReady,
    onEditorReadyType: onEditorReady ? typeof onEditorReady : 'null'
  });

  useEffect(() => {
    console.log('🔍 useGrapesJS: useEffect 觸發，條件檢查:', {
      hasContainerRef: !!containerRef.current,
      hasEditor: !!editor,
      containerRefCurrent: containerRef.current
    });
    
    if (!containerRef.current || editor) {
      console.log('⚠️ useGrapesJS: 條件不滿足，退出初始化');
      return;
    }

    console.log('🚀 開始初始化 GrapesJS 編輯器...');
    
    // 獲取用戶語言設置
    const userLanguage = localStorage.getItem('language') || 'zh-TC';
    console.log('🌐 用戶語言:', userLanguage);
    
    // 載入語言資源並初始化編輯器
    loadLanguageResources(userLanguage).then(resources => {
      console.log('✅ 語言資源載入成功:', resources);
      setLanguageResources(resources);
      
      try {
        console.log('🔧 開始創建 GrapesJS 實例...');
        const grapesEditor = grapesjs.init({
          container: containerRef.current,
          height: '100%',
          width: 'auto',
          storageManager: false,
          plugins: ['gjs-preset-webpage'],
          pluginsOpts: {
            'gjs-preset-webpage': {}
          },
          canvas: {
            styles: [
              'https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css',
            ],
            scripts: [
              'https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js',
            ],
          },
          // 設備管理器配置
          deviceManager: {
            devices: [
              {
                name: resources.eformDesigner?.grapesJs?.desktop || 'Desktop',
                width: '',
              },
              {
                name: resources.eformDesigner?.grapesJs?.tablet || 'Tablet',
                width: '768px',
                widthMedia: '992px',
              },
              {
                name: resources.eformDesigner?.grapesJs?.mobileLandscape || 'Mobile Landscape',
                width: '568px',
                widthMedia: '768px',
              },
              {
                name: resources.eformDesigner?.grapesJs?.mobilePortrait || 'Mobile Portrait',
                width: '320px',
                widthMedia: '480px',
              },
            ],
          },
          // 樣式管理器配置
          styleManager: {
            sectors: [
              {
                name: resources.eformDesigner?.grapesJs?.general || 'General',
                open: false,
                buildProps: [
                  'display',
                  'float',
                  'position',
                  'top',
                  'right',
                  'left',
                  'bottom',
                ],
                properties: [
                  {
                    property: 'display',
                    type: 'select',
                    defaults: 'block',
                    options: [
                      { value: 'block', name: resources.eformDesigner?.grapesJs?.block || 'Block' },
                      { value: 'inline', name: resources.eformDesigner?.grapesJs?.inline || 'Inline' },
                      { value: 'inline-block', name: resources.eformDesigner?.grapesJs?.inlineBlock || 'Inline Block' },
                      { value: 'flex', name: resources.eformDesigner?.grapesJs?.flex || 'Flex' },
                      { value: 'grid', name: resources.eformDesigner?.grapesJs?.grid || 'Grid' },
                    ],
                  },
                  {
                    property: 'float',
                    type: 'select',
                    defaults: 'none',
                    options: [
                      { value: 'none', name: resources.eformDesigner?.grapesJs?.none || 'None' },
                      { value: 'left', name: resources.eformDesigner?.grapesJs?.left || 'Left' },
                      { value: 'right', name: resources.eformDesigner?.grapesJs?.right || 'Right' },
                    ],
                  },
                  {
                    property: 'position',
                    type: 'select',
                    defaults: 'static',
                    options: [
                      { value: 'static', name: resources.eformDesigner?.grapesJs?.static || 'Static' },
                      { value: 'relative', name: resources.eformDesigner?.grapesJs?.relative || 'Relative' },
                      { value: 'absolute', name: resources.eformDesigner?.grapesJs?.absolute || 'Absolute' },
                      { value: 'fixed', name: resources.eformDesigner?.grapesJs?.fixed || 'Fixed' },
                    ],
                  },
                  {
                    property: 'top',
                    type: 'integer',
                    defaults: 'auto',
                    units: ['px', '%', 'em', 'rem'],
                  },
                  {
                    property: 'right',
                    type: 'integer',
                    defaults: 'auto',
                    units: ['px', '%', 'em', 'rem'],
                  },
                  {
                    property: 'left',
                    type: 'integer',
                    defaults: 'auto',
                    units: ['px', '%', 'em', 'rem'],
                  },
                  {
                    property: 'bottom',
                    type: 'integer',
                    defaults: 'auto',
                    units: ['px', '%', 'em', 'rem'],
                  },
                ],
              },
            ],
          },
          components: initialHtmlContent.trim() ? initialHtmlContent : `
            <div class="container">
              <div class="row">
                <div class="col-md-12">
                  <h1>${resources.eformDesigner?.welcomeMessage || '歡迎使用表單設計器'}</h1>
                  <p>${resources.eformDesigner?.welcomeDescription || '請從左側面板拖拽組件到此處開始設計您的表單。'}</p>
                  <div class="form-group">
                    <label for="exampleInput">${resources.eformDesigner?.exampleInput || '示例輸入框'}</label>
                    <input type="text" class="form-control" id="exampleInput" placeholder="${resources.eformDesigner?.exampleInputPlaceholder || '請輸入...'}">
                  </div>
                </div>
              </div>
            </div>
          `,
          style: `
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background-color: #f5f5f5; 
            }
            .container { 
              max-width: 800px; 
              margin: 0 auto; 
              background: white; 
              padding: 20px; 
              border-radius: 8px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            }
            
            /* Light Theme 自定義樣式 */
            .gjs-pn-views-container {
              background-color: #f8f9fa !important;
              border-color: #dee2e6 !important;
            }
            
            .gjs-pn-panel {
              background-color: #ffffff !important;
              border-color: #dee2e6 !important;
            }
            
            .gjs-pn-views {
              background-color: #f8f9fa !important;
            }
            
            .gjs-pn-btn {
              background-color: #ffffff !important;
              color: #495057 !important;
              border-color: #dee2e6 !important;
            }
            
            .gjs-pn-btn:hover {
              background-color: #e9ecef !important;
              color: #212529 !important;
            }
            
            .gjs-pn-btn.gjs-pn-active {
              background-color: #007bff !important;
              color: #ffffff !important;
            }
            
            .gjs-cv-canvas {
              background-color: #ffffff !important;
            }
            
            .gjs-block {
              background-color: #ffffff !important;
              border-color: #dee2e6 !important;
              color: #495057 !important;
            }
            
            .gjs-block:hover {
              background-color: #e9ecef !important;
            }
            
            .gjs-block-category {
              background-color: #f8f9fa !important;
              color: #495057 !important;
            }
            
            .gjs-layer-title {
              background-color: #ffffff !important;
              color: #495057 !important;
            }
            
            .gjs-layer-vis {
              background-color: #ffffff !important;
              color: #495057 !important;
            }
            
            .gjs-layer-caret {
              color: #495057 !important;
            }
            
            .gjs-property {
              background-color: #ffffff !important;
              color: #495057 !important;
            }
            
            .gjs-property input {
              background-color: #ffffff !important;
              color: #495057 !important;
              border-color: #dee2e6 !important;
            }
            
            .gjs-property select {
              background-color: #ffffff !important;
              color: #495057 !important;
              border-color: #dee2e6 !important;
            }
            
            .gjs-toolbar {
              background-color: #ffffff !important;
              border-color: #dee2e6 !important;
            }
            
            .gjs-toolbar-item {
              background-color: #ffffff !important;
              color: #495057 !important;
              border-color: #dee2e6 !important;
            }
            
            .gjs-toolbar-item:hover {
              background-color: #e9ecef !important;
            }
            
            .gjs-toolbar-item.gjs-active {
              background-color: #007bff !important;
              color: #ffffff !important;
            }
            
            /* input 和 textarea 的樣式 */
            .gjs-cv-canvas input,
            .gjs-cv-canvas textarea {
              background-color: #f8f9fa !important;
              color: #6c757d !important;
              border: 1px solid #dee2e6 !important;
              padding: 8px !important;
              font-size: 14px !important;
              line-height: 1.4 !important;
              opacity: 0.8 !important;
              cursor: text !important;
            }
            
            .gjs-cv-canvas input:hover,
            .gjs-cv-canvas textarea:hover {
              background-color: #e9ecef !important;
              border-color: #adb5bd !important;
            }
            
            /* 當組件被選中時，顯示提示樣式 */
            .gjs-selected input,
            .gjs-selected textarea {
              border: 2px solid #007bff !important;
              background-color: #f0f8ff !important;
            }
            
            /* 日期輸入框的格式提示 */
            .gjs-cv-canvas input[type="date"] {
              position: relative;
            }
            
            .gjs-cv-canvas input[type="date"]::before {
              content: "📅 格式: " attr(data-date-format);
              position: absolute;
              top: -25px;
              left: 0;
              background: rgba(0, 123, 255, 0.9);
              color: white;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 11px;
              white-space: nowrap;
              pointer-events: none;
              z-index: 1000;
              font-weight: 500;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              animation: fadeIn 0.3s ease-in-out;
              opacity: 0.9;
              transition: opacity 0.2s ease;
            }
            
            .gjs-cv-canvas input[type="date"]:hover::before {
              opacity: 1;
            }
            
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-5px); }
              to { opacity: 0.9; transform: translateY(0); }
            }
            
            /* 當日期輸入框被選中時，顯示更詳細的格式信息 */
            .gjs-selected input[type="date"]::after {
              content: "📅 當前格式: " attr(data-date-format);
              position: absolute;
              top: -45px;
              left: 0;
              background: rgba(0, 123, 255, 1);
              color: white;
              padding: 6px 10px;
              border-radius: 6px;
              font-size: 12px;
              white-space: nowrap;
              pointer-events: none;
              z-index: 1001;
              font-weight: bold;
              box-shadow: 0 4px 8px rgba(0,0,0,0.3);
              border: 2px solid rgba(255,255,255,0.3);
              animation: slideIn 0.3s ease-in-out;
              opacity: 1;
              transition: all 0.2s ease;
            }
            
            .gjs-selected input[type="date"]:hover::after {
              transform: translateY(-2px) scale(1.05);
              box-shadow: 0 6px 12px rgba(0,0,0,0.4);
            }
            
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            
            /* 確保工具欄可以點擊 */
            .gjs-toolbar {
              pointer-events: auto !important;
              z-index: 1001 !important;
            }
            
            .gjs-toolbar-item {
              pointer-events: auto !important;
              cursor: pointer !important;
              z-index: 1002 !important;
            }
            
            /* 確保選中的組件容器可以接收點擊事件 */
            .gjs-selected {
              pointer-events: auto !important;
            }
            
            /* 日期輸入框的額外樣式 */
            .gjs-cv-canvas input[type="date"] {
              border: 2px solid #e8f4fd !important;
              background-color: #f8fbff !important;
              color: #1890ff !important;
              font-weight: 500 !important;
              position: relative !important;
              min-height: 32px !important;
              transition: all 0.2s ease !important;
              cursor: pointer !important;
            }
            
            .gjs-cv-canvas input[type="date"]:hover {
              border-color: #1890ff !important;
              background-color: #f0f8ff !important;
              transform: translateY(-1px) !important;
              box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15) !important;
            }
            
            .gjs-selected input[type="date"] {
              border-color: #1890ff !important;
              background-color: #e6f7ff !important;
              box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2) !important;
              transform: scale(1.02) !important;
            }
            
            /* 日期輸入框的圖標樣式 */
            .gjs-cv-canvas input[type="date"]::-webkit-calendar-picker-indicator {
              background-color: #1890ff !important;
              border-radius: 3px !important;
              padding: 2px !important;
              cursor: pointer !important;
              transition: all 0.2s ease !important;
              filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1)) !important;
            }
            
            .gjs-cv-canvas input[type="date"]::-webkit-calendar-picker-indicator:hover {
              background-color: #40a9ff !important;
              transform: scale(1.1) !important;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)) !important;
            }
            
            /* 日期輸入框的圖標樣式 - Firefox */
            .gjs-cv-canvas input[type="date"]::-moz-calendar-picker-indicator {
              background-color: #1890ff !important;
              border-radius: 3px !important;
              padding: 2px !important;
              cursor: pointer !important;
              transition: all 0.2s ease !important;
              filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1)) !important;
            }
            
            .gjs-cv-canvas input[type="date"]::-moz-calendar-picker-indicator:hover {
              background-color: #40a9ff !important;
              transform: scale(1.1) !important;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)) !important;
            }
            
            /* 日期輸入框的圖標樣式 - Edge */
            .gjs-cv-canvas input[type="date"]::-ms-clear,
            .gjs-cv-canvas input[type="date"]::-ms-expand {
              background-color: #1890ff !important;
              border-radius: 3px !important;
              padding: 2px !important;
              cursor: pointer !important;
              transition: all 0.2s ease !important;
            }
            
            /* 日期輸入框的響應式樣式 */
            @media (max-width: 768px) {
              .gjs-cv-canvas input[type="date"]::before {
                font-size: 10px !important;
                padding: 2px 6px !important;
                top: -20px !important;
              }
              
              .gjs-selected input[type="date"]::after {
                font-size: 11px !important;
                padding: 4px 8px !important;
                top: -35px !important;
              }
            }
            
            /* 日期輸入框的打印樣式 */
            @media print {
              .gjs-cv-canvas input[type="date"]::before,
              .gjs-cv-canvas input[type="date"]::after {
                display: none !important;
              }
            }
            
            /* 日期輸入框的深色主題支持 */
            @media (prefers-color-scheme: dark) {
              .gjs-cv-canvas input[type="date"] {
                background-color: #1f1f1f !important;
                color: #ffffff !important;
                border-color: #404040 !important;
              }
              
              .gjs-cv-canvas input[type="date"]:hover {
                background-color: #2a2a2a !important;
                border-color: #1890ff !important;
              }
              
              .gjs-selected input[type="date"] {
                background-color: #0d1419 !important;
                border-color: #1890ff !important;
              }
            }
            
            /* 日期輸入框的高對比度模式支持 */
            @media (prefers-contrast: high) {
              .gjs-cv-canvas input[type="date"] {
                border-width: 3px !important;
                border-color: #000000 !important;
                background-color: #ffffff !important;
                color: #000000 !important;
              }
              
              .gjs-cv-canvas input[type="date"]:hover {
                border-color: #1890ff !important;
                background-color: #f0f8ff !important;
              }
            }
            
            /* 日期輸入框的減少動畫模式支持 */
            @media (prefers-reduced-motion: reduce) {
              .gjs-cv-canvas input[type="date"]::before,
              .gjs-cv-canvas input[type="date"]::after {
                animation: none !important;
                transition: none !important;
              }
              
              .gjs-cv-canvas input[type="date"]:hover {
                transform: none !important;
              }
              
              .gjs-selected input[type="date"] {
                transform: none !important;
              }
            }
            
            /* 日期輸入框的焦點可見性支持 */
            @media (prefers-reduced-motion: no-preference) {
              .gjs-cv-canvas input[type="date"]:focus-visible {
                outline: 3px solid #1890ff !important;
                outline-offset: 2px !important;
              }
            }
            
            /* 日期輸入框的錯誤狀態樣式 */
            .gjs-cv-canvas input[type="date"].error {
              border-color: #ff4d4f !important;
              background-color: #fff2f0 !important;
              color: #ff4d4f !important;
            }
            
            .gjs-cv-canvas input[type="date"].error::before {
              content: "❌ 格式錯誤: " attr(data-date-format) !important;
              background-color: rgba(255, 77, 79, 0.9) !important;
            }
            
            /* 日期輸入框的成功狀態樣式 */
            .gjs-cv-canvas input[type="date"].success {
              border-color: #52c41a !important;
              background-color: #f6ffed !important;
              color: #52c41a !important;
            }
            
            .gjs-cv-canvas input[type="date"].success::before {
              content: "✅ 格式正確: " attr(data-date-format) !important;
              background-color: rgba(82, 196, 0.9) !important;
            }
            
            /* 日期輸入框的警告狀態樣式 */
            .gjs-cv-canvas input[type="date"].warning {
              border-color: #faad14 !important;
              background-color: #fffbe6 !important;
              color: #faad14 !important;
            }
            
            .gjs-cv-canvas input[type="date"].warning::before {
              content: "⚠️ 格式警告: " attr(data-date-format) !important;
              background-color: rgba(250, 173, 20, 0.9) !important;
            }
            
            /* 日期輸入框的信息狀態樣式 */
            .gjs-cv-canvas input[type="date"].info {
              border-color: #1890ff !important;
              background-color: #e6f7ff !important;
              color: #1890ff !important;
            }
            
            .gjs-cv-canvas input[type="date"].info::before {
              content: "ℹ️ 格式信息: " attr(data-date-format) !important;
              background-color: rgba(24, 144, 255, 0.9) !important;
            }
            
            /* 日期輸入框的加載狀態樣式 */
            .gjs-cv-canvas input[type="date"].loading {
              border-color: #d9d9d9 !important;
              background-color: #fafafa !important;
              color: #bfbfbf !important;
              cursor: wait !important;
            }
            
            .gjs-cv-canvas input[type="date"].loading::before {
              content: "⏳ 載入中..." !important;
              background-color: rgba(0, 0, 0, 0.6) !important;
              animation: pulse 1.5s ease-in-out infinite !important;
            }
            
            @keyframes pulse {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
            
            /* 日期輸入框的驗證狀態樣式 */
            .gjs-cv-canvas input[type="date"].validating {
              border-color: #faad14 !important;
              background-color: #fffbe6 !important;
              color: #faad14 !important;
            }
            
            .gjs-cv-canvas input[type="date"].validating::before {
              content: "🔍 驗證中..." !important;
              background-color: rgba(250, 173, 20, 0.9) !important;
              animation: spin 1s linear infinite !important;
            }
            
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            
            /* 日期輸入框的完成狀態樣式 */
            .gjs-cv-canvas input[type="date"].completed {
              border-color: #52c41a !important;
              background-color: #f6ffed !important;
              color: #52c41a !important;
            }
            
            .gjs-cv-canvas input[type="date"].completed::before {
              content: "🎉 完成: " attr(data-date-format) !important;
              background-color: rgba(82, 196, 26, 0.9) !important;
              animation: bounce 0.6s ease-in-out !important;
            }
            
            @keyframes bounce {
              0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
              40% { transform: translateY(-5px); }
              60% { transform: translateY(-3px); }
            }
            
            /* 日期輸入框的焦點樣式 */
            .gjs-cv-canvas input[type="date"]:focus {
              outline: none !important;
              border-color: #1890ff !important;
              box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.1) !important;
              transform: scale(1.01) !important;
            }
            
            /* 日期輸入框的幫助提示樣式 */
            .gjs-cv-canvas input[type="date"].help {
              border-color: #722ed1 !important;
              background-color: #f9f0ff !important;
              color: #722ed1 !important;
            }
            
            .gjs-cv-canvas input[type="date"].help::before {
              content: "💡 幫助: " attr(data-date-format) !important;
              background-color: rgba(114, 46, 209, 0.9) !important;
            }
            
            /* 日期輸入框的禁用樣式 */
            .gjs-cv-canvas input[type="date"]:disabled {
              background-color: #f5f5f5 !important;
              color: #999 !important;
              cursor: not-allowed !important;
              opacity: 0.6 !important;
            }
            
            /* 日期輸入框的只讀樣式 */
            .gjs-cv-canvas input[type="date"][readonly] {
              background-color: #fafafa !important;
              color: #666 !important;
              cursor: default !important;
            }
            
            /* 移除所有 modal 相關樣式，只保留右側面板功能 */
          `,
        });
        
        console.log('✅ GrapesJS 實例創建成功:', grapesEditor);
        
        // 添加自定義功能
        addCustomBlocks(grapesEditor);
        addEditFunctionality(grapesEditor);
        addDeselectFunctionality(grapesEditor);
        
        // 隱藏 Style Manager、Settings 和 Layer Manager 按鈕，並默認打開 blocks 面板
        setTimeout(() => {
          try {
            const styleManagerBtn = document.querySelector('.gjs-pn-btn[title="Open Style Manager"]');
            const settingsBtn = document.querySelector('.gjs-pn-btn[title="Settings"]');
            const layerManagerBtn = document.querySelector('.gjs-pn-btn[title="Open Layer Manager"]');
            
            if (styleManagerBtn) {
              styleManagerBtn.style.display = 'none';
              console.log('✅ Style Manager 按鈕已隱藏');
            }
            
            if (settingsBtn) {
              settingsBtn.style.display = 'none';
              console.log('✅ Settings 按鈕已隱藏');
            }
            
            if (layerManagerBtn) {
              layerManagerBtn.style.display = 'none';
              console.log('✅ Layer Manager 按鈕已隱藏');
            }
            
            // 默認打開 blocks 面板
            const blocksBtn = document.querySelector('.gjs-pn-btn[title="Open Blocks"]');
            if (blocksBtn) {
              blocksBtn.click();
              console.log('✅ 默認打開 blocks 面板');
            } else {
              console.log('⚠️ 未找到 blocks 按鈕');
            }
          } catch (error) {
            console.warn('⚠️ 隱藏按鈕或打開 blocks 面板時出錯:', error);
          }
        }, 100);

        console.log('🔧 設置編輯器狀態...');
        setEditor(grapesEditor);
        setIsReady(true);
        
        console.log('✅ GrapesJS 編輯器初始化成功');
        console.log('🎧 檢查 onEditorReady 回調:', {
          hasOnEditorReady: !!onEditorReady,
          onEditorReadyType: onEditorReady ? typeof onEditorReady : 'null'
        });
        
        // 通知父組件編輯器已準備好
        if (onEditorReady) {
          console.log('🎧 調用 onEditorReady 回調...');
          try {
            onEditorReady(grapesEditor);
            console.log('✅ onEditorReady 回調調用成功');
          } catch (error) {
            console.error('❌ onEditorReady 回調調用失敗:', error);
          }
        } else {
          console.log('⚠️ 沒有 onEditorReady 回調，跳過調用');
        }
        
      } catch (error) {
        console.error('❌ GrapesJS 初始化失敗:', error);
        setIsReady(false);
      }
    }).catch(error => {
      console.error('❌ 載入語言資源失敗:', error);
      setIsReady(false);
    });

    return () => {
      if (editor) {
        console.log('🧹 清理 GrapesJS 編輯器');
        editor.destroy();
      }
    };
  }, [initialHtmlContent, onEditorReady]);

  // 添加 setContent 方法來支持外部內容更新
  const setContent = useCallback((htmlContent) => {
    if (editor && htmlContent) {
      console.log('🔄 設置新內容到編輯器開始');
      console.log('📝 原始內容長度:', htmlContent.length);
      console.log('📝 原始內容前100字符:', htmlContent.substring(0, 100) + '...');
      
      try {
        // 分離 HTML 和 CSS
        let html = htmlContent;
        let css = '';
        
        console.log('🔍 檢查是否包含樣式標籤...');
        console.log('🔍 包含 <style> 標籤:', htmlContent.includes('<style>'));
        
        // 檢查是否包含樣式標籤
        if (htmlContent.includes('<style>')) {
          console.log('🔍 開始解析樣式標籤...');
          const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/);
          if (styleMatch) {
            css = styleMatch[1];
            html = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
            console.log('✅ 樣式解析成功');
            console.log('🎨 CSS 內容長度:', css.length);
            console.log('📄 HTML 內容長度:', html.length);
          } else {
            console.log('⚠️ 樣式標籤匹配失敗');
          }
        } else {
          console.log('ℹ️ 未檢測到樣式標籤，使用原始內容作為 HTML');
        }
        
        // 設置 HTML 內容
        console.log('🔄 開始設置 HTML 內容...');
        console.log('🔄 調用 editor.setComponents()...');
        editor.setComponents(html);
        console.log('✅ HTML 內容設置完成');
        
        // 設置 CSS 樣式
        if (css) {
          console.log('🔄 開始設置 CSS 樣式...');
          console.log('🔄 調用 editor.setStyle()...');
          editor.setStyle(css);
          console.log('✅ CSS 樣式設置完成');
        } else {
          console.log('ℹ️ 無 CSS 樣式需要設置');
        }
        
        // 驗證設置結果
        console.log('🔍 驗證設置結果...');
        const currentHtml = editor.getHtml();
        const currentCss = editor.getCss();
        console.log('📊 當前編輯器 HTML 長度:', currentHtml.length);
        console.log('📊 當前編輯器 CSS 長度:', currentCss.length);
        
        console.log('✅ 內容設置成功完成');
      } catch (error) {
        console.error('❌ 設置內容時發生錯誤:', error);
        console.error('❌ 錯誤堆疊:', error.stack);
        
        // 如果分離失敗，嘗試直接設置
        console.log('🔄 嘗試備用方法：直接設置原始內容...');
        try {
          editor.setComponents(htmlContent);
          console.log('✅ 備用方法成功');
        } catch (fallbackError) {
          console.error('❌ 備用方法也失敗:', fallbackError);
        }
      }
    } else {
      console.log('⚠️ setContent 調用失敗：', {
        hasEditor: !!editor,
        hasContent: !!htmlContent,
        contentLength: htmlContent ? htmlContent.length : 0
      });
    }
  }, [editor]);

  return { 
    editor, 
    isReady, 
    languageResources, 
    setContent 
  };
};

const addCustomBlocks = (editor) => {
  const blockManager = editor.BlockManager;
  
  // 獲取語言資源
  const userLanguage = localStorage.getItem('language') || 'zh-TC';
  let resources;
  
  // 根據語言設置獲取對應的翻譯
  switch (userLanguage) {
    case 'zh-SC':
      resources = require('../locales/zh-SC.js').default;
      break;
    case 'zh-TC':
      resources = require('../locales/zh-TC.js').default;
      break;
    case 'en':
      resources = require('../locales/en.js').default;
      break;
    default:
      resources = require('../locales/zh-TC.js').default;
  }
  
  const t = resources.eformDesigner?.grapesJs || {};
  
  // 佈局元素
  blockManager.add('section', {
    label: t.section || 'Section',
    category: t.layout || 'Layout',
    content: '<section class="section"><h2>This is a section</h2><p>This is a box</p></section>',
    media: '<svg viewBox="0 0 24 24"><path d="M2 20h20V4H2v16zm18-2V6H4v12h16z"/></svg>'
  });
  
  blockManager.add('div', {
    label: t.div || 'Div',
    category: t.layout || 'Layout',
    content: '<div class="div-block"><p>This is a div block</p></div>',
    media: '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm16 16V5H5v14h14z"/></svg>'
  });
  
  blockManager.add('container', {
    label: t.container || 'Container',
    category: t.layout || 'Layout',
    content: '<div class="container"><div class="container-content"></div></div>',
    media: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/></svg>'
  });
  
  // 文字元素
  blockManager.add('text', {
    label: t.text || 'Text',
    category: t.basic || 'Basic',
    content: '<div data-gjs-type="text">Insert your text here</div>',
    media: '<svg viewBox="0 0 24 24"><path d="M2.5 4v3h5v12h3V7h5V4H2.5zM21.5 9h-9v3h3v7h3v-7h3V9z"/></svg>'
  });
  
  blockManager.add('heading', {
    label: t.heading || 'Heading',
    category: t.basic || 'Basic',
    content: '<h2>Insert your heading here</h2>',
    media: '<svg viewBox="0 0 24 24"><path d="M6 3h2v18H6zm3.5 12l3-6 3 6H9.5z"/></svg>'
  });
  
  blockManager.add('paragraph', {
    label: t.paragraph || 'Paragraph',
    category: t.basic || 'Basic',
    content: '<p>Insert your paragraph here</p>',
    media: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>'
  });
  
  // 表單元素
  blockManager.add('form', {
    label: t.form || 'Form',
    category: t.forms || 'Forms',
    content: '<form class="form"><input type="text" placeholder="Enter text here" /></form>',
    media: '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>'
  });
  
  blockManager.add('input', {
    label: t.input || 'Input',
    category: t.forms || 'Forms',
    content: '<input type="text" placeholder="Enter text here" />',
    media: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/></svg>'
  });
  
  blockManager.add('button', {
    label: t.button || 'Button',
    category: t.forms || 'Forms',
    content: '<button class="button">Click me</button>',
    media: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>'
  });
  
  blockManager.add('textarea', {
    label: t.textarea || 'Textarea',
    category: t.forms || 'Forms',
    content: '<textarea placeholder="請輸入您的訊息" rows="4" cols="50"></textarea>',
    media: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/></svg>'
  });
  
  // 更多表單控件
  blockManager.add('select', {
    label: t.select || 'Select',
    category: t.forms || 'Forms',
    content: '<select><option value="">請選擇...</option><option value="option1">選項 1</option><option value="option2">選項 2</option><option value="option3">選項 3</option></select>',
    media: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>'
  });
  
  blockManager.add('radio', {
    label: t.radio || 'Radio',
    category: t.forms || 'Forms',
    content: '<div><label><input type="radio" name="radio1" value="option1" /> 選項 1</label><br/><label><input type="radio" name="radio1" value="option2" /> 選項 2</label><br/><label><input type="radio" name="radio1" value="option3" /> 選項 3</label></div>',
    media: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
  });
  
  blockManager.add('checkbox', {
    label: t.checkbox || 'Checkbox',
    category: t.forms || 'Forms',
    content: '<div><label><input type="checkbox" value="check1" /> 選項 1</label><br/><label><input type="checkbox" value="check2" /> 選項 2</label><br/><label><input type="checkbox" value="check3" /> 選項 3</label></div>',
    media: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
  });
  
  blockManager.add('file-upload', {
    label: t.fileUpload || 'File Upload',
    category: t.forms || 'Forms',
    content: '<input type="file" />',
    media: '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>'
  });
  
  blockManager.add('email', {
    label: t.email || 'Email',
    category: t.forms || 'Forms',
    content: '<input type="email" placeholder="請輸入電子郵件" />',
    media: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>'
  });
  
  blockManager.add('password', {
    label: t.password || 'Password',
    category: t.forms || 'Forms',
    content: '<input type="password" placeholder="請輸入密碼" />',
    media: '<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>'
  });
  
  blockManager.add('number', {
    label: t.number || 'Number',
    category: t.forms || 'Forms',
    content: '<input type="number" placeholder="請輸入數字" />',
    media: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>'
  });
  
  blockManager.add('date', {
    label: t.date || 'Date',
    category: t.forms || 'Forms',
    content: '<input type="date" data-date-format="YYYY-MM-DD" />',
    media: '<svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>'
  });
  
  blockManager.add('time', {
    label: t.time || 'Time',
    category: t.forms || 'Forms',
    content: '<input type="time" />',
    media: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>'
  });
  
  blockManager.add('url', {
    label: t.url || 'URL',
    category: t.forms || 'Forms',
    content: '<input type="url" placeholder="請輸入網址" />',
    media: '<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1s1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>'
  });
  
  blockManager.add('tel', {
    label: t.tel || 'Phone',
    category: t.forms || 'Forms',
    content: '<input type="tel" placeholder="請輸入電話號碼" />',
    media: '<svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>'
  });
  
  blockManager.add('label', {
    label: t.label || 'Label',
    category: t.forms || 'Forms',
    content: '<label for="input1">標籤文字</label>',
    media: '<svg viewBox="0 0 24 24"><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/></svg>'
  });
  
  blockManager.add('fieldset', {
    label: t.fieldset || 'Fieldset',
    category: t.forms || 'Forms',
    content: '<fieldset><legend>群組標題</legend><input type="text" placeholder="群組內輸入框" /></fieldset>',
    media: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>'
  });
  
  console.log('✅ 已添加 27 個自定義區塊');
};

// 移除不再需要的通用表單組件創建函數，因為這些功能現在在右側面板中處理

const addEditFunctionality = (editor) => {
  console.log('🔧 開始添加編輯功能...');
  
  // 初始化表單數據函數 - 保留用於右側面板
  const initializeFormData = (component) => {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ initializeFormData: 組件無效或已被銷毀');
      return;
    }
    
    try {
      const tagName = component.get('tagName');
      if (!tagName) {
        console.warn('⚠️ initializeFormData: 組件標籤名稱無效');
        return;
      }
      
      console.log('🔧 初始化表單數據:', tagName);
      
      // 根據組件類型初始化不同的表單數據
      const attributes = component.getAttributes();
      
      switch (tagName.toLowerCase()) {
        case 'input':
          // 將數據存儲到組件本身，供右側面板使用
          const inputType = attributes.type || 'text';
          
          // 優先獲取實際顯示的內容
          let inputValue = '';
          try {
            // 優先從 DOM 元素獲取 value 屬性，這是最可靠的方法
            const el = component.getEl ? component.getEl() : null;
            if (el) {
              inputValue = el.value || el.getAttribute('value') || '';
              console.log('✅ 從 DOM 獲取 input value:', inputValue);
            }
            
            // 如果 DOM 方法失敗，嘗試其他方法
            if (!inputValue) {
              inputValue = component.get('content') || attributes.value || '';
              console.log('⚠️ 使用備用方法獲取 input value:', inputValue);
            }
          } catch (error) {
            console.warn('⚠️ 獲取 input value 時出錯:', error);
            inputValue = attributes.value || '';
          }
          
          const editFormData = {
            type: inputType,
            placeholder: attributes.placeholder || '',
            value: inputValue,
            name: attributes.name || '',
            required: attributes.required || false,
            disabled: attributes.disabled || false,
            readonly: attributes.readonly || false,
            maxlength: attributes.maxlength || '',
            minlength: attributes.minlength || '',
            pattern: attributes.pattern || '',
            title: attributes.title || ''
          };
          
          // 如果是日期類型，添加日期格式信息
          if (inputType === 'date') {
            editFormData.dateFormat = attributes['data-date-format'] || 'YYYY-MM-DD';
          }
          
          component.set('editFormData', editFormData);
          console.log('🔧 input 組件數據初始化完成:', editFormData);
          break;
          
        case 'textarea':
          // 優先從 DOM 元素獲取 textContent，這是最可靠的方法
          let textareaValue = '';
          try {
            const el = component.getEl ? component.getEl() : null;
            if (el) {
              console.log(' textarea DOM 元素:', el);
              console.log('🔍 textarea DOM 元素標籤:', el.tagName);
              console.log('🔍 textarea DOM 元素 innerHTML:', el.innerHTML);
              console.log('🔍 textarea DOM 元素 textContent:', el.textContent);
              console.log('🔍 textarea DOM 元素 innerText:', el.innerText);
              
              // 嘗試多種方法獲取內容
              textareaValue = el.textContent || el.innerText || el.innerHTML || '';
              
              // 如果內容為空，嘗試從組件的其他屬性獲取
              if (!textareaValue) {
                textareaValue = component.get('content') || component.get('innerHTML') || '';
                console.log('⚠️ 從組件屬性獲取 textarea 內容:', textareaValue);
              }
              
              // 如果仍然為空，嘗試從組件的子組件獲取
              if (!textareaValue) {
                try {
                  const components = component.get('components');
                  if (components && components.length > 0) {
                    // textarea 的內容通常存儲在子組件中
                    const firstChild = components[0];
                    if (firstChild && firstChild.get && typeof firstChild.get === 'function') {
                      textareaValue = firstChild.get('content') || '';
                      console.log('⚠️ 從子組件獲取 textarea 內容:', textareaValue);
                    }
                  }
                } catch (childError) {
                  console.warn('⚠️ 獲取子組件內容時出錯:', childError);
                }
              }
              
              console.log('✅ 最終獲取的 textarea 內容:', textareaValue);
            } else {
              console.warn('⚠️ textarea 組件沒有 DOM 元素');
            }
            
            // 如果 DOM 方法失敗，嘗試其他方法
            if (!textareaValue) {
              textareaValue = component.get('content') || component.get('innerHTML') || '';
              console.log('⚠️ 使用備用方法獲取 textarea 內容:', textareaValue);
            }
            
            // 最後的備用方案：檢查子組件
            if (!textareaValue) {
              try {
                const components = component.get('components');
                if (components && components.length > 0) {
                  const firstChild = components[0];
                  if (firstChild && firstChild.get && typeof firstChild.get === 'function') {
                    textareaValue = firstChild.get('content') || '';
                    console.log('⚠️ 最終備用方案：從子組件獲取 textarea 內容:', textareaValue);
                  }
                }
              } catch (finalChildError) {
                console.warn('⚠️ 最終備用方案獲取子組件內容時出錯:', finalChildError);
              }
            }
          } catch (error) {
            console.warn('⚠️ 獲取 textarea 內容時出錯:', error);
            textareaValue = component.get('content') || '';
          }
          
          const textareaData = {
            placeholder: attributes.placeholder || '',
            value: textareaValue,
            defaultValue: textareaValue, // 確保 defaultValue 和 value 一致
            name: attributes.name || '',
            required: attributes.required || false,
            disabled: attributes.disabled || false,
            readonly: attributes.readonly || false,
            rows: attributes.rows || '4',
            cols: attributes.cols || '50',
            maxlength: attributes.maxlength || '',
            minlength: attributes.minlength || ''
          };
          
          component.set('editFormData', textareaData);
          console.log('🔧 textarea 組件數據初始化完成:', textareaData);
          break;
          
        case 'select':
          const options = component.get('components');
          let selectOptions = [];
          if (options && options.length > 0) {
            selectOptions = options.map(option => {
              let text = '';
              let value = '';
              let selected = false;
              
              try {
                // 優先從 DOM 元素獲取文字內容，這是最可靠的方法
                const el = option.getEl ? option.getEl() : null;
                if (el) {
                  text = el.textContent || el.innerText || '';
                  console.log('✅ 從 DOM 獲取文字:', text);
                }
                
                // 如果 DOM 方法失敗，嘗試其他方法
                if (!text) {
                  text = option.get('content') || option.get('innerHTML') || option.get('text') || '';
                  console.log('⚠️ 使用備用方法獲取文字:', text);
                }
                
                // 獲取 value 和 selected 屬性
                value = option.getAttributes().value || '';
                selected = option.getAttributes().selected || false;
                
                // 如果文字為空但 value 有值，使用 value 作為文字
                if (!text && value) {
                  text = value;
                  console.log('🔄 使用 value 作為文字:', text);
                }
                
                console.log('🔍 Select option 解析結果:', {
                  value: value,
                  text: text.trim(),
                  selected: selected
                });
                
                return {
                  value: value,
                  text: text.trim(),
                  selected: selected
                };
              } catch (optionError) {
                console.warn('⚠️ 解析 select option 時出錯:', optionError);
                return {
                  value: '',
                  text: '選項',
                  selected: false
                };
              }
            });
          }
          
          component.set('editFormData', {
            name: attributes.name || '',
            required: attributes.required || false,
            disabled: attributes.disabled || false,
            multiple: attributes.multiple || false,
            size: attributes.size || '1',
            options: selectOptions
          });
          console.log('🔧 select 組件數據初始化完成，選項數量:', selectOptions.length);
          break;
          
        case 'button':
          component.set('editFormData', {
            type: attributes.type || 'button',
            value: component.get('content') || '',
            name: attributes.name || '',
            disabled: attributes.disabled || false,
            form: attributes.form || '',
            formaction: attributes.formaction || '',
            formmethod: attributes.formmethod || 'get',
            formnovalidate: attributes.formnovalidate || false
          });
          console.log('🔧 button 組件數據初始化完成');
          break;
          
        case 'label':
          component.set('editFormData', {
            for: attributes.for || '',
            value: component.get('content') || '',
            required: attributes.required || false
          });
          console.log('🔧 label 組件數據初始化完成');
          break;
          
        default:
          component.set('editFormData', {
            tagName: tagName,
            content: component.get('content') || '',
            ...attributes
          });
          console.log('🔧 默認組件數據初始化完成:', tagName);
          break;
      }
    } catch (error) {
      console.error('❌ initializeFormData 發生錯誤:', error);
      console.error('❌ 組件狀態:', {
        hasGet: !!component.get,
        getType: typeof component.get,
        component: component
      });
    }
  };

  // 移除所有 modal 相關函數
  // const createEditModal = () => { ... } - 已移除
  // const showEditModal = () => { ... } - 已移除
  // const hideEditModal = () => { ... } - 已移除
  // const renderEditForm = () => { ... } - 已移除

  // 移除所有 update*Component 函數，因為這些邏輯將在右側面板中處理
  // const updateInputComponent = async () => { ... } - 已移除
  // const updateTextareaComponent = async () => { ... } - 已移除
  // const updateSelectComponent = async () => { ... } - 已移除
  // const updateButtonComponent = async () => { ... } - 已移除
  // const updateLabelComponent = async () => { ... } - 已移除

  // 移除 handleFormChange 和 handleSave 函數，因為這些邏輯將在右側面板中處理
  // const handleFormChange = (field, value) => { ... } - 已移除
  // const handleSave = async () => { ... } - 已移除

  // 使用 GrapesJS 官方方法添加編輯按鈕到組件工具欄
  const addEditButtonToToolbar = (component) => {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ addEditButtonToToolbar: 組件無效或已被銷毀');
      return;
    }
    
    try {
      // 獲取組件的工具欄
      const toolbar = component.get('toolbar');
      
      // 檢查是否已經有編輯按鈕
      if (toolbar && toolbar.some(item => item.command === 'edit-component')) {
        return;
      }
      
      // 創建編輯按鈕配置
      const editButton = {
        attributes: { class: 'gjs-edit-btn-toolbar' },
        command: 'edit-component',
        label: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>`,
        title: '編輯組件',
        // 使用白色圖標，與其他工具欄按鈕保持一致
        style: {
          color: '#ffffff', // 改為白色圖標
          fontSize: '14px',
          padding: '4px',
          cursor: 'pointer',
          backgroundColor: '#1890ff', // 藍色背景
          border: 'none',
          borderRadius: '4px',
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: '0.9',
          transition: 'opacity 0.2s ease'
        }
      };
      
      // 將編輯按鈕添加到組件工具欄
      if (toolbar) {
        toolbar.push(editButton);
      } else {
        component.set('toolbar', [editButton]);
      }
      
      const tagName = component.get('tagName');
      const componentId = component.getId();
      console.log('✅ 編輯按鈕已添加到組件工具欄:', tagName, componentId);
    } catch (error) {
      console.error('❌ addEditButtonToToolbar 發生錯誤:', error);
      console.error('❌ 組件狀態:', {
        hasGet: !!component.get,
        getType: typeof component.get,
        component: component
      });
    }
  };

  // 為所有現有組件添加編輯按鈕到工具欄
  const addEditButtonsToAllComponentsToolbar = () => {
    try {
      const allComponents = editor.DomComponents.getComponents();
      let validComponents = 0;
      let invalidComponents = 0;
      
      allComponents.forEach(component => {
        // 添加安全檢查
        if (component && component.get && typeof component.get === 'function') {
          addEditButtonToToolbar(component);
          validComponents++;
        } else {
          console.warn('⚠️ 發現無效組件，跳過添加編輯按鈕:', component);
          invalidComponents++;
        }
      });
      
      console.log('✅ 已為所有現有組件添加編輯按鈕到工具欄');
      console.log(`📊 有效組件: ${validComponents}, 無效組件: ${invalidComponents}`);
    } catch (error) {
      console.error('❌ addEditButtonsToAllComponentsToolbar 發生錯誤:', error);
    }
  };

  // 監聽組件選中事件
  editor.on('component:selected', function(component) {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ component:selected: 組件無效或已被銷毀');
      return;
    }
    
    try {
      const tagName = component.get('tagName');
      const componentId = component.getId();
      console.log(' 組件被選中:', tagName, componentId);
      
      // 為選中的組件添加編輯按鈕到工具欄（如果還沒有的話）
      addEditButtonToToolbar(component);
      
      // 如果是 textarea 組件，確保內容正確顯示
      if (tagName.toLowerCase() === 'textarea') {
        // 確保 editFormData 已初始化
        if (!component.get('editFormData')) {
          console.log('🔧 textarea 組件選中，初始化 editFormData');
          initializeFormData(component);
        }
        
        const content = component.get('content');
        const el = component.getEl();
        if (el) {
          console.log('🔍 textarea 組件選中，檢查內容:', {
            componentContent: content,
            domContent: el.textContent,
            attributes: component.getAttributes(),
            editFormData: component.get('editFormData')
          });
          
          // 如果 DOM 內容與組件內容不一致，將 DOM 內容同步到組件
          if (content !== el.textContent) {
            console.log('🔄 同步 textarea 內容，DOM 與組件不一致');
            const domContent = el.textContent || '';
            
            // 將 DOM 內容同步到組件的 content 屬性
            component.set('content', domContent);
            
            // 同時更新其他相關屬性
            try {
              component.set('innerHTML', domContent);
              component.set('textContent', domContent);
              console.log('✅ textarea 組件內容屬性已同步到 DOM 內容:', domContent);
            } catch (error) {
              console.warn('⚠️ 同步組件內容屬性時出錯:', error);
            }
            
            // 更新 editFormData 以保持一致性
            const currentEditFormData = component.get('editFormData') || {};
            currentEditFormData.defaultValue = domContent;
            currentEditFormData.value = domContent;
            component.set('editFormData', currentEditFormData);
            console.log('✅ textarea editFormData 已同步到 DOM 內容:', domContent);
          }
        }
      }
    } catch (error) {
      console.error('❌ component:selected 事件處理錯誤:', error);
      console.error('❌ 組件狀態:', {
        hasGet: !!component.get,
        getType: typeof component.get,
        component: component
      });
    }
  });

  // 監聽組件取消選中事件
  editor.on('component:deselected', function(component) {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ component:deselected: 組件無效或已被銷毀');
      return;
    }
    
    try {
      const tagName = component.get('tagName');
      const componentId = component.getId();
      console.log(' 組件取消選中:', tagName, componentId);
      
      // 工具欄按鈕會自動隱藏，不需要額外處理
    } catch (error) {
      console.error('❌ component:deselected 事件處理錯誤:', error);
      console.error('❌ 組件狀態:', {
        hasGet: !!component.get,
        getType: typeof component.get,
        component: component
      });
    }
  });

  // 監聽新組件添加事件
  editor.on('component:add', function(component) {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ component:add: 組件無效或已被銷毀');
      return;
    }
    
    try {
      console.log(' 新組件被添加:', component.get('tagName'), component.getId());
      
      // 如果是日期輸入框，確保設置默認的日期格式
      if (component.get('tagName').toLowerCase() === 'input' && 
          component.getAttributes().type === 'date') {
        const currentFormat = component.getAttributes()['data-date-format'];
        if (!currentFormat) {
          console.log('📅 為新添加的日期輸入框設置默認格式');
          component.setAttributes({ 'data-date-format': 'YYYY-MM-DD' });
        }
      }
      
      // 如果是 textarea，確保內容正確顯示
      if (component.get('tagName').toLowerCase() === 'textarea') {
        // 初始化 editFormData
        console.log('🔧 新添加的 textarea 組件，初始化 editFormData');
        initializeFormData(component);
        
        const content = component.get('content');
        const el = component.getEl();
        
        // 即使沒有內容也要同步，確保 DOM 和組件狀態一致
        if (el) {
          console.log('🔄 新添加的 textarea 組件，同步內容:', {
            componentContent: content,
            domContent: el.textContent
          });
          
          // 如果內容不一致，強制同步
          if (content !== el.textContent) {
            el.textContent = content || '';
            console.log('✅ textarea DOM 內容已同步:', content || '');
            
            // 同時更新 editFormData 以保持一致性
            const currentEditFormData = component.get('editFormData') || {};
            currentEditFormData.defaultValue = content || '';
            currentEditFormData.value = content || '';
            component.set('editFormData', currentEditFormData);
            console.log('✅ textarea editFormData 已同步:', currentEditFormData);
          }
          

          

        }
      }
      
      // 為新添加的組件添加編輯按鈕到工具欄
      setTimeout(() => {
        // 在延遲後再次檢查組件是否仍然有效
        if (component && component.get && typeof component.get === 'function') {
          addEditButtonToToolbar(component);
        } else {
          console.warn('⚠️ component:add setTimeout: 組件在延遲期間變為無效');
        }
      }, 100); // 稍微延遲確保組件完全初始化
    } catch (error) {
      console.error('❌ component:add 事件處理錯誤:', error);
      console.error('❌ 組件狀態:', {
        hasGet: !!component.get,
        getType: typeof component.get,
        component: component
      });
    }
  });

    // 監聽組件更新事件
  editor.on('component:update', function(component) {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ component:update: 組件無效或已被銷毀');
      return;
    }
    
    try {
      console.log(' 組件被更新:', component.get('tagName'), component.getId());
      
      // 確保編輯按鈕仍然存在於工具欄
      const toolbar = component.get('toolbar');
      if (toolbar && !toolbar.some(item => item.command === 'edit-component')) {
        addEditButtonToToolbar(component);
      }
      
      // 如果是日期輸入框，更新格式顯示
      if (component.get('tagName').toLowerCase() === 'input' && 
          component.getAttributes().type === 'date') {
        const dateFormat = component.getAttributes()['data-date-format'] || 'YYYY-MM-DD';
        console.log('📅 日期輸入框格式已更新:', dateFormat);
      }
      
      // 如果是 textarea，只在必要時同步內容，避免無限循環
      if (component.get('tagName').toLowerCase() === 'textarea') {
        const content = component.get('content');
        const el = component.getEl();
        if (el && content !== undefined && content !== null) {
          // 只在 DOM 內容為空且組件內容不為空時才同步
          if (el.textContent === '' && content !== '') {
            console.log('🔄 textarea 內容為空，同步組件內容到 DOM:', content);
            el.textContent = content;
          }
        }
      }
      
      // 移除自動刷新，避免無限循環
      // setTimeout(() => {
      //   if (editor && !editor.isDestroyed && editor.refresh) {
      //     editor.refresh();
      //   }
      // }, 50);
    } catch (error) {
      console.error('❌ component:update 事件處理錯誤:', error);
      console.error('❌ 組件狀態:', {
        hasGet: !!component.get,
        getType: typeof component.get,
        component: component
      });
    }
  });

  // 監聽編輯命令 - 簡化為只觸發事件
  editor.Commands.add('edit-component', {
    run: function(editor, sender, options) {
      console.log('🔧 編輯命令被觸發');
      console.log(' 發送者:', sender);
      console.log(' 選項:', options);
      
      const component = options.component || editor.getSelected();
      
      // 添加安全檢查，確保組件存在且有效
      if (!component) {
        console.warn('⚠️ 沒有選中的組件，無法編輯');
        return;
      }
      
      // 檢查組件是否仍然有效
      if (!component.get || typeof component.get !== 'function') {
        console.warn('⚠️ 組件無效或已被銷毀，無法編輯');
        return;
      }
      
      try {
        const tagName = component.get('tagName');
        const componentId = component.getId();
        
        if (!tagName) {
          console.warn('⚠️ 組件標籤名稱無效，無法編輯');
          return;
        }
        
        console.log(' 開始編輯組件:', tagName, 'ID:', componentId);
        
        // 初始化表單數據並存儲到組件
        initializeFormData(component);
        
        // 如果是 textarea 組件，記錄詳細信息
        if (tagName.toLowerCase() === 'textarea') {
          const editFormData = component.get('editFormData');
          console.log('🔧 textarea 編輯數據初始化完成:', editFormData);
        }
        
        // 只觸發自定義事件供 EFormDesigner 監聽，不創建 modal
        editor.trigger('edit-component-requested', component);
      } catch (error) {
        console.error('❌ 編輯組件時發生錯誤:', error);
        console.error('❌ 組件狀態:', {
          hasGet: !!component.get,
          getType: typeof component.get,
          component: component
        });
      }
    }
  });

  // 添加日期格式更新命令
  editor.Commands.add('update-date-format', {
    run: function(editor, sender, options) {
      const { component, newFormat } = options;
      
      // 添加安全檢查
      if (!component || !component.get || typeof component.get !== 'function') {
        console.warn('⚠️ update-date-format: 組件無效或已被銷毀');
        return;
      }
      
      if (!newFormat) {
        console.warn('⚠️ update-date-format: 新格式未提供');
        return;
      }
      
      try {
        console.log('📅 更新日期格式:', newFormat);
        component.setAttributes({ 'data-date-format': newFormat });
        
        // 觸發自定義事件
        editor.trigger('date-format-updated', { component, format: newFormat });
      } catch (error) {
        console.error('❌ update-date-format 命令執行錯誤:', error);
        console.error('❌ 組件狀態:', {
          hasGet: !!component.get,
          getType: typeof component.get,
          component: component
        });
      }
    }
  });

  // 為所有現有組件添加編輯按鈕到工具欄
  setTimeout(() => {
    try {
      // 檢查編輯器是否仍然有效
      if (editor && typeof editor.DomComponents === 'object') {
        addEditButtonsToAllComponentsToolbar();
      } else {
        console.warn('⚠️ 編輯器在延遲期間變為無效，跳過添加編輯按鈕');
      }
    } catch (error) {
      console.error('❌ 延遲添加編輯按鈕時發生錯誤:', error);
    }
  }, 500); // 延遲確保編輯器完全初始化
  
  console.log('✅ 編輯功能已設置（僅右側面板，無 modal）');

  // 在 addEditFunctionality 函數中添加對 change:content 事件的監聽
  editor.on('component:change:content', function(component) {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ component:change:content: 組件無效或已被銷毀');
      return;
    }
    
    try {
      const tagName = component.get('tagName');
      const componentId = component.getId();
      console.log(' 組件內容變化:', tagName, componentId);
      
      // 如果是 textarea 組件，確保 DOM 同步
      if (tagName.toLowerCase() === 'textarea') {
        // 修復：從組件獲取 content 值
        const content = component.get('content');
        const el = component.getEl();
        if (el) {
          console.log('🔄 textarea 內容變化，同步 DOM:', {
            componentContent: content,
            domContent: el.textContent
          });
          
          // 如果 DOM 內容與組件內容不一致，強制同步
          if (content !== el.textContent) {
            el.textContent = content || '';
            console.log('✅ textarea DOM 內容已同步:', content || '');
          }
          
          // 強制觸發 DOM 更新事件
          try {
            const event = new Event('input', { bubbles: true });
            el.dispatchEvent(event);
            console.log('✅ textarea DOM input 事件已觸發');
          } catch (eventError) {
            console.warn('⚠️ 觸發 DOM 事件時出錯:', eventError);
          }
        }
        
        // 強制更新組件的 innerHTML 和 textContent 屬性
        try {
          // 修復：使用從組件獲取的 content 值
          component.set('innerHTML', content || '');
          component.set('textContent', content || '');
          console.log('✅ textarea 組件 innerHTML 和 textContent 已強制更新');
        } catch (setError) {
          console.warn('⚠️ 強制更新 innerHTML/textContent 時出錯:', setError);
        }
      }
      
      // 觸發編輯器更新以確保 HTML 代碼同步
      setTimeout(() => {
        if (editor && !editor.isDestroyed && editor.refresh) {
          editor.refresh();
          console.log('✅ 編輯器已刷新，HTML 代碼已同步');
        }
      }, 50);
    } catch (error) {
      console.error('❌ component:change:content 事件處理錯誤:', error);
    }
  });

  // 添加對組件屬性變化的監聽
  editor.on('component:change:attributes', function(component) {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ component:change:attributes: 組件無效或已被銷毀');
      return;
    }
    
    try {
      const tagName = component.get('tagName');
      if (tagName.toLowerCase() === 'textarea') {
        console.log(' textarea 屬性變化，強制更新內容');
        
        // 強制觸發內容更新
        const content = component.get('content');
        if (content) {
          component.trigger('change:content');
          console.log('✅ textarea 內容更新事件已觸發');
        }
      }
    } catch (error) {
      console.error('❌ component:change:attributes 事件處理錯誤:', error);
    }
  });

  // 移除重複的 component:update 監聽器，避免無限循環
  // 這個監聽器會導致 textarea 內容被不斷重置
  // 已經在第一個監聽器中處理了 textarea 的內容同步
};

// 添加取消選中功能
const addDeselectFunctionality = (editor) => {
  // 監聽組件選中事件
  editor.on('component:selected', function(component) {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ addDeselectFunctionality component:selected: 組件無效或已被銷毀');
      return;
    }
    
    try {
      const el = component.getEl();
      
      // 檢查是否選中了 body 元素
      if (el && el.tagName === 'BODY') {
        console.log('⚠️ 檢測到 body 被選中，自動取消選中');
        editor.select(null);
      }
    } catch (error) {
      console.error('❌ addDeselectFunctionality component:selected 事件處理錯誤:', error);
      console.error('❌ 組件狀態:', {
        hasGet: !!component.get,
        getType: typeof component.get,
        component: component
      });
    }
  });
  
  // 添加 ESC 鍵取消選中功能
  const handleKeydown = function(e) {
    if (e.key === 'Escape') {
      console.log('🔍 ESC 鍵取消選中');
      editor.select(null);
      e.preventDefault();
      e.stopPropagation();
    }
  };
  
  // 添加全局鍵盤事件監聽器
  document.addEventListener('keydown', handleKeydown);
  
  // 添加點擊空白區域取消選中功能
  const handleCanvasClick = function(e) {
    // 檢查點擊的是否是空白區域（不是組件）
    const target = e.target;
    
    // 如果點擊的是 canvas 本身或 body 元素，取消選中
    if (target.tagName === 'BODY' || target.classList.contains('gjs-cv-canvas')) {
      console.log('🔍 點擊空白區域取消選中');
      editor.select(null);
      e.preventDefault();
      e.stopPropagation();
    }
  };
  
  // 監聽組件選中事件來設置 canvas 點擊監聽器
  editor.on('component:selected', function(component) {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ addDeselectFunctionality canvas setup component:selected: 組件無效或已被銷毀');
      return;
    }
    
    try {
      const canvas = editor.Canvas.getFrameEl();
      if (canvas) {
        canvas.addEventListener('click', handleCanvasClick);
      }
    } catch (error) {
      console.error('❌ addDeselectFunctionality canvas setup component:selected 事件處理錯誤:', error);
      console.error('❌ 組件狀態:', {
        hasGet: !!component.get,
        getType: typeof component.get,
        component: component
      });
    }
  });
  
  // 添加取消選中命令
  editor.Commands.add('deselect', {
    run: function(editor, sender, options) {
      console.log('🔍 執行取消選中命令');
      editor.select(null);
    }
  });
  
  // 返回清理函數
  return () => {
    document.removeEventListener('keydown', handleKeydown);
  };
};

export default useGrapesJS; 