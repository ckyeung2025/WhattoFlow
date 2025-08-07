import React, { useEffect, useRef } from 'react';

const StudioTest = () => {
  const editorRef = useRef(null);

  useEffect(() => {
    const initGrapesJS = async () => {
      try {
        // 動態導入原生的 GrapesJS
        const grapesjs = await import('grapesjs');
        await import('grapesjs/dist/css/grapes.min.css');
        
        console.log('GrapesJS 載入成功:', grapesjs);
        
        if (editorRef.current) {
          const editor = grapesjs.default.init({
            container: editorRef.current,
            height: '100%',
            width: 'auto',
            storageManager: false,
            // 不使用插件，手動配置
            // plugins: ['grapesjs-preset-webpage'],
            // pluginsOpts: {
            //   'grapesjs-preset-webpage': {}
            // },
            // 添加基本的組件作為起始內容
            components: `
              <div style="padding: 20px;">
                <h1>歡迎使用 GrapesJS 編輯器</h1>
                <p>這是一個測試頁面，您可以開始編輯內容。</p>
                <p>左側面板包含各種 HTML 控件，可以拖拽到編輯區域。</p>
              </div>
            `,
            // 添加基本的樣式
            style: `
              body { margin: 0; font-family: Arial, sans-serif; }
              h1 { color: #333; }
              p { color: #666; }
            `
          });
          
          // 手動添加更多基本區塊
          const blockManager = editor.BlockManager;
          
          // 佈局元素
          blockManager.add('section', {
            label: 'Section',
            category: 'Layout',
            content: '<section class="section"><h2>This is a section</h2><p>This is a box</p></section>',
            media: '<svg viewBox="0 0 24 24"><path d="M2 20h20V4H2v16zm18-2V6H4v12h16z"/></svg>'
          });
          
          blockManager.add('div', {
            label: 'Div',
            category: 'Layout',
            content: '<div class="div-block"><p>This is a div block</p></div>',
            media: '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm16 16V5H5v14h14z"/></svg>'
          });
          
          blockManager.add('container', {
            label: 'Container',
            category: 'Layout',
            content: '<div class="container"><div class="container-content"></div></div>',
            media: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/></svg>'
          });
          
          // 文字元素
          blockManager.add('text', {
            label: 'Text',
            category: 'Basic',
            content: '<div data-gjs-type="text">Insert your text here</div>',
            media: '<svg viewBox="0 0 24 24"><path d="M2.5 4v3h5v12h3V7h5V4H2.5zM21.5 9h-9v3h3v7h3v-7h3V9z"/></svg>'
          });
          
          blockManager.add('heading', {
            label: 'Heading',
            category: 'Basic',
            content: '<h2>Insert your heading here</h2>',
            media: '<svg viewBox="0 0 24 24"><path d="M6 3h2v18H6zm3.5 12l3-6 3 6H9.5z"/></svg>'
          });
          
          blockManager.add('paragraph', {
            label: 'Paragraph',
            category: 'Basic',
            content: '<p>Insert your paragraph here</p>',
            media: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h1.75L17.81 9.94l-1.75-1.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 1.75 1.75 1.83-1.83z"/></svg>'
          });
          
          // 媒體元素
          blockManager.add('image', {
            label: 'Image',
            category: 'Media',
            content: { type: 'image' },
            media: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>'
          });
          
          blockManager.add('video', {
            label: 'Video',
            category: 'Media',
            content: '<video controls><source src="" type="video/mp4">Your browser does not support the video tag.</video>',
            media: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>'
          });
          
          // 表單元素
          blockManager.add('form', {
            label: 'Form',
            category: 'Forms',
            content: '<form class="form"><input type="text" placeholder="Enter text here" /></form>',
            media: '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>'
          });
          
          blockManager.add('input', {
            label: 'Input',
            category: 'Forms',
            content: '<input type="text" placeholder="Enter text here" />',
            media: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/></svg>'
          });
          
          blockManager.add('button', {
            label: 'Button',
            category: 'Forms',
            content: '<button class="button">Click me</button>',
            media: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>'
          });
          
          blockManager.add('textarea', {
            label: 'Textarea',
            category: 'Forms',
            content: '<textarea placeholder="Enter your message here"></textarea>',
            media: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/></svg>'
          });
          
          // 列表元素
          blockManager.add('list', {
            label: 'List',
            category: 'Basic',
            content: '<ul><li>List item 1</li><li>List item 2</li><li>List item 3</li></ul>',
            media: '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>'
          });
          
          // 引用元素
          blockManager.add('quote', {
            label: 'Quote',
            category: 'Basic',
            content: '<blockquote><p>This is a quote</p><cite>- Author</cite></blockquote>',
            media: '<svg viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>'
          });
          
          // 連結元素
          blockManager.add('link', {
            label: 'Link',
            category: 'Basic',
            content: '<a href="#" class="link">Click here</a>',
            media: '<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>'
          });
          
          // 表格元素
          blockManager.add('table', {
            label: 'Table',
            category: 'Basic',
            content: '<table><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>',
            media: '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/></svg>'
          });
          
          console.log('GrapesJS 編輯器已初始化');
          console.log('編輯器實例:', editor);
          console.log('可用的區塊:', editor.BlockManager.getAll());
        }
        
      } catch (error) {
        console.error('初始化 GrapesJS 失敗:', error);
      }
    };

    initGrapesJS();
  }, []);

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', borderBottom: '1px solid #ccc', backgroundColor: '#f5f5f5' }}>
        <h2 style={{ margin: 0, color: '#333' }}>GrapesJS HTML 編輯器</h2>
        <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
          免費版本 - 包含完整的 HTML 拖放控件功能
        </p>
      </div>
      <div 
        ref={editorRef}
        style={{ 
          flex: 1,
          border: '1px solid #ccc'
        }}
      />
    </div>
  );
};

export default StudioTest; 