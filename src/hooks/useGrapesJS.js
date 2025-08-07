import { useEffect, useState } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import 'grapesjs-preset-webpage';
import 'grapesjs-plugin-forms';

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

const useGrapesJS = (containerRef, initialHtmlContent) => {
  const [editor, setEditor] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [languageResources, setLanguageResources] = useState(null);

  useEffect(() => {
    if (!containerRef.current || editor) return;

    console.log('🚀 開始初始化 GrapesJS 編輯器...');
    
    // 獲取用戶語言設置
    const userLanguage = localStorage.getItem('language') || 'zh-TC';
    
    // 載入語言資源並初始化編輯器
    loadLanguageResources(userLanguage).then(resources => {
      setLanguageResources(resources);
      
      try {
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
            
            /* 提示框樣式 */
            .edit-tip {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: #fff;
              border: 2px solid #007bff;
              border-radius: 8px;
              padding: 20px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.3);
              z-index: 10000;
              max-width: 300px;
              text-align: center;
              font-family: Arial, sans-serif;
            }
            
            .edit-tip h4 {
              margin: 0 0 10px 0;
              color: #007bff;
            }
            
            .edit-tip p {
              margin: 0 0 15px 0;
              color: #666;
            }
            
            .edit-tip button {
              background: #007bff;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            }
            
            .edit-tip button:hover {
              background: #0056b3;
            }
            
            .edit-tip .close-btn {
              position: absolute;
              top: 10px;
              right: 10px;
              background: none;
              border: none;
              font-size: 18px;
              cursor: pointer;
              color: #999;
            }
            
            .edit-tip .close-btn:hover {
              color: #333;
            }
            
            /* 取消選中提示樣式 */
            .deselect-tip {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #fff;
              border: 2px solid #ffc107;
              border-radius: 8px;
              padding: 15px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.3);
              z-index: 10000;
              max-width: 250px;
              text-align: center;
              font-family: Arial, sans-serif;
            }
            
            .deselect-tip h5 {
              margin: 0 0 8px 0;
              color: #ffc107;
            }
            
            .deselect-tip p {
              margin: 0;
              color: #666;
              font-size: 12px;
            }
          `,
        });

        // 添加自定義區塊
        addCustomBlocks(grapesEditor);
        
        // 添加編輯功能
        addEditFunctionality(grapesEditor);
        
        // 添加取消選中功能
        addDeselectFunctionality(grapesEditor);
        
        // 設置面板標籤翻譯
        setPanelLabels(grapesEditor, resources);

        setEditor(grapesEditor);
        setIsReady(true);
        
        console.log('✅ GrapesJS 編輯器初始化成功');
        
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
  }, [containerRef.current]);

  return { editor, isReady, languageResources };
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
    media: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h1.75L17.81 9.94l-1.75-1.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 1.75 1.75 1.83-1.83z"/></svg>'
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
    content: '<textarea placeholder="Enter your message here"></textarea>',
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
    content: '<input type="date" />',
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

// 設置 GrapesJS 內建面板標籤翻譯
const setPanelLabels = (editor, resources) => {
  const t = resources.eformDesigner?.grapesJs || {};
  
  // 設置面板標籤
  const panels = editor.Panels;
  if (panels) {
    // 設置圖層面板標籤
    const layersPanel = panels.getPanel('layers');
    if (layersPanel) {
      const layersButton = layersPanel.get('buttons').at(0);
      if (layersButton) {
        layersButton.set('label', t.layers || 'Layers');
      }
    }
    
    // 設置樣式面板標籤
    const stylesPanel = panels.getPanel('styles');
    if (stylesPanel) {
      const stylesButton = stylesPanel.get('buttons').at(0);
      if (stylesButton) {
        stylesButton.set('label', t.styles || 'Styles');
      }
    }
    
    // 設置屬性面板標籤
    const traitsPanel = panels.getPanel('traits');
    if (traitsPanel) {
      const traitsButton = traitsPanel.get('buttons').at(0);
      if (traitsButton) {
        traitsButton.set('label', t.traits || 'Traits');
      }
    }
    
    // 設置區塊面板標籤
    const blocksPanel = panels.getPanel('blocks');
    if (blocksPanel) {
      const blocksButton = blocksPanel.get('buttons').at(0);
      if (blocksButton) {
        blocksButton.set('label', t.blocks || 'Blocks');
      }
    }
  }
  
  // 設置設備管理器標籤
  const deviceManager = editor.DeviceManager;
  if (deviceManager) {
    // 設置設備選擇器標籤
    const deviceButton = deviceManager.getDeviceButton();
    if (deviceButton) {
      deviceButton.set('label', t.device || 'Device');
    }
    
    // 設置設備名稱
    const devices = deviceManager.getAll();
    devices.forEach(device => {
      const deviceName = device.get('name');
      if (deviceName === 'Desktop') {
        device.set('name', t.desktop || 'Desktop');
      } else if (deviceName === 'Tablet') {
        device.set('name', t.tablet || 'Tablet');
      } else if (deviceName === 'Mobile Landscape') {
        device.set('name', t.mobileLandscape || 'Mobile Landscape');
      } else if (deviceName === 'Mobile Portrait') {
        device.set('name', t.mobilePortrait || 'Mobile Portrait');
      }
    });
  }
  
  // 設置設備選擇器標籤（通過 DOM 操作）
  setTimeout(() => {
    // 嘗試多個可能的選擇器
    const selectors = [
      '.gjs-devices-c',
      '.gjs-devices',
      '.gjs-devices-c .gjs-devices-label',
      '.gjs-devices .gjs-devices-label',
      '[data-id="device"]',
      '.gjs-pn-views-container .gjs-devices-c'
    ];
    
    selectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        // 如果是容器元素，查找標籤元素
        const labelElement = element.querySelector('.gjs-devices-label') || element;
        if (labelElement && labelElement.textContent === 'Device') {
          labelElement.textContent = t.device || 'Device';
          console.log('✅ 已翻譯設備標籤:', t.device || 'Device');
        }
      }
    });
    
    // 監聽 DOM 變化，確保新添加的元素也被翻譯
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // 元素節點
            const deviceLabels = node.querySelectorAll && node.querySelectorAll('.gjs-devices-label');
            if (deviceLabels) {
              deviceLabels.forEach(label => {
                if (label.textContent === 'Device') {
                  label.textContent = t.device || 'Device';
                }
              });
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }, 100);
  
  console.log('✅ 已設置 GrapesJS 面板標籤翻譯');
};

// 創建提示框函數
const showEditTip = (editor) => {
  // 移除現有的提示框
  const existingTip = document.querySelector('.edit-tip');
  if (existingTip) {
    existingTip.remove();
  }
  
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
  
  // 創建提示框
  const tip = document.createElement('div');
  tip.className = 'edit-tip';
  tip.innerHTML = `
    <button class="close-btn" onclick="this.parentElement.remove()">×</button>
    <h4>✏️ ${t.editTip ? '編輯提示' : 'Edit Tip'}</h4>
    <p>${t.editTip || 'Please click the edit button above the component to modify this input field properties.'}</p>
    <button onclick="this.parentElement.remove()">${t.editTip ? '知道了' : 'Got it'}</button>
  `;
  
  document.body.appendChild(tip);
  
  // 3秒後自動關閉
  setTimeout(() => {
    if (tip.parentElement) {
      tip.remove();
    }
  }, 3000);
};

// 創建取消選中提示函數
const showDeselectTip = (editor) => {
  // 移除現有的提示框
  const existingTip = document.querySelector('.deselect-tip');
  if (existingTip) {
    existingTip.remove();
  }
  
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
  
  // 創建提示框
  const tip = document.createElement('div');
  tip.className = 'deselect-tip';
  tip.innerHTML = `
    <h5>🔍 ${t.deselectTip ? '選擇提示' : 'Selection Tip'}</h5>
    <p>${t.deselectTip || 'Press ESC key or click on blank area to deselect'}</p>
  `;
  
  document.body.appendChild(tip);
  
  // 2秒後自動關閉
  setTimeout(() => {
    if (tip.parentElement) {
      tip.remove();
    }
  }, 2000);
};

const addEditFunctionality = (editor) => {
  // 為組件添加編輯工具欄
  editor.on('component:selected', function(component) {
    console.log('🎯 組件被選中:', component);
    
    const toolbar = component.get('toolbar') || [];
    const hasEditButton = toolbar.some(item => item.command === 'edit-component');
    
    if (!hasEditButton) {
      const newToolbar = [
        ...toolbar,
        {
          attributes: { class: 'gjs-toolbar-item' },
          command: 'edit-component',
          label: '✏️',
          togglable: false,
          active: false,
          id: 'edit-component'
        }
      ];
      component.set('toolbar', newToolbar);
    }
  });
  
  // 為新添加的 input 和 textarea 添加提示功能
  editor.on('component:add', function(component) {
    const el = component.getEl();
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      // 監聽輸入事件，顯示提示
      const handleInput = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 恢復原始值
        el.value = el.getAttribute('data-original-value') || '';
        
        // 顯示提示
        showEditTip(editor);
        
        return false;
      };
      
      // 監聽焦點事件
      const handleFocus = function(e) {
        // 保存原始值
        if (!el.getAttribute('data-original-value')) {
          el.setAttribute('data-original-value', el.value || '');
        }
      };
      
      // 監聽點擊事件
      const handleClick = function(e) {
        // 保存原始值
        if (!el.getAttribute('data-original-value')) {
          el.setAttribute('data-original-value', el.value || '');
        }
      };
      
      // 監聽鍵盤事件
      const handleKeydown = function(e) {
        // 允許一些基本操作（如 Tab 鍵）
        if (e.key === 'Tab' || e.key === 'Escape') {
          return true;
        }
        
        // 阻止其他輸入
        e.preventDefault();
        e.stopPropagation();
        
        // 顯示提示
        showEditTip(editor);
        
        return false;
      };
      
      // 添加事件監聽器
      el.addEventListener('input', handleInput, true);
      el.addEventListener('focus', handleFocus, true);
      el.addEventListener('click', handleClick, true);
      el.addEventListener('keydown', handleKeydown, true);
      el.addEventListener('keypress', handleInput, true);
      el.addEventListener('paste', handleInput, true);
      el.addEventListener('cut', handleInput, true);
      
      console.log('🚫 新組件添加輸入提示:', el.tagName, '組件ID:', component.getId());
    }
  });
  
  // 為現有的 input 和 textarea 添加提示功能
  editor.on('component:selected', function(component) {
    const el = component.getEl();
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      // 檢查是否已經添加過事件監聽器
      if (el.getAttribute('data-has-tip-handlers')) {
        return;
      }
      
      // 標記已添加事件監聽器
      el.setAttribute('data-has-tip-handlers', 'true');
      
      // 監聽輸入事件，顯示提示
      const handleInput = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 恢復原始值
        el.value = el.getAttribute('data-original-value') || '';
        
        // 顯示提示
        showEditTip(editor);
        
        return false;
      };
      
      // 監聽焦點事件
      const handleFocus = function(e) {
        // 保存原始值
        if (!el.getAttribute('data-original-value')) {
          el.setAttribute('data-original-value', el.value || '');
        }
      };
      
      // 監聽點擊事件
      const handleClick = function(e) {
        // 保存原始值
        if (!el.getAttribute('data-original-value')) {
          el.setAttribute('data-original-value', el.value || '');
        }
      };
      
      // 監聽鍵盤事件
      const handleKeydown = function(e) {
        // 允許一些基本操作（如 Tab 鍵）
        if (e.key === 'Tab' || e.key === 'Escape') {
          return true;
        }
        
        // 阻止其他輸入
        e.preventDefault();
        e.stopPropagation();
        
        // 顯示提示
        showEditTip(editor);
        
        return false;
      };
      
      // 添加事件監聽器
      el.addEventListener('input', handleInput, true);
      el.addEventListener('focus', handleFocus, true);
      el.addEventListener('click', handleClick, true);
      el.addEventListener('keydown', handleKeydown, true);
      el.addEventListener('keypress', handleInput, true);
      el.addEventListener('paste', handleInput, true);
      el.addEventListener('cut', handleInput, true);
      
      console.log('🚫 現有組件添加輸入提示:', el.tagName, '組件ID:', component.getId());
    }
  });
  
  // 註冊編輯命令
  editor.Commands.add('edit-component', {
    run: function(editor, sender, options) {
      console.log('🚀 編輯命令被觸發');
      
      const component = editor.getSelected();
      if (!component) {
        console.log('❌ 沒有選中的組件');
        return;
      }
      
      // 觸發自定義事件，讓父組件處理
      editor.trigger('edit-component-requested', component);
    }
  });
};

// 添加取消選中功能
const addDeselectFunctionality = (editor) => {
  // 監聽組件選中事件
  editor.on('component:selected', function(component) {
    const el = component.getEl();
    
    // 檢查是否選中了 body 元素
    if (el && el.tagName === 'BODY') {
      console.log('⚠️ 檢測到 body 被選中，顯示取消選中提示');
      showDeselectTip(editor);
    }
  });
  
  // 添加 ESC 鍵取消選中功能
  editor.on('component:selected', function(component) {
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
    
    // 清理函數
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
  
  // 添加點擊空白區域取消選中功能
  editor.on('component:selected', function(component) {
    const canvas = editor.Canvas.getFrameEl();
    
    const handleCanvasClick = function(e) {
      // 檢查點擊的是否是空白區域（不是組件）
      const target = e.target;
      
      // 如果點擊的是 canvas 本身或 body 元素，取消選中
      if (target === canvas || target.tagName === 'BODY' || target.classList.contains('gjs-cv-canvas')) {
        console.log('🔍 點擊空白區域取消選中');
        editor.select(null);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    canvas.addEventListener('click', handleCanvasClick);
    
    // 清理函數
    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
    };
  });
  
  // 添加取消選中命令
  editor.Commands.add('deselect', {
    run: function(editor, sender, options) {
      console.log('🔍 執行取消選中命令');
      editor.select(null);
    }
  });
};

export default useGrapesJS; 