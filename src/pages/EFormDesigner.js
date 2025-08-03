import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeftOutlined, SaveOutlined, EyeOutlined, CodeOutlined, FormOutlined, EditOutlined, UpOutlined, DownOutlined, FileWordOutlined, FileExcelOutlined, FilePdfOutlined, FileImageOutlined, RobotOutlined } from '@ant-design/icons';
import { Button, Space, message, Card, Alert, Typography, Spin, Input, Modal, Upload, Switch } from 'antd';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import 'grapesjs-preset-webpage';
import 'grapesjs-plugin-forms';

// 添加紫色返回按鈕的 hover 樣式
const purpleButtonStyle = `
  .purple-back-button:hover {
    background-color: #8c4dd4 !important;
    border-color: #8c4dd4 !important;
  }
`;

const { Title } = Typography;
const { TextArea } = Input;

const EFormDesigner = ({ initialSchema, onSave, onBack }) => {
  const [htmlContent, setHtmlContent] = useState(initialSchema?.htmlCode || initialSchema?.html || '');
  const [formName, setFormName] = useState(initialSchema?.name || '新表單');
  const [formDescription, setFormDescription] = useState(initialSchema?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [editorType, setEditorType] = useState('grapesjs'); // 只使用 GrapesJS
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isWordUploadModalVisible, setIsWordUploadModalVisible] = useState(false);
  const [isExcelUploadModalVisible, setIsExcelUploadModalVisible] = useState(false);
  const [isPdfUploadModalVisible, setIsPdfUploadModalVisible] = useState(false);
  const [isImageUploadModalVisible, setIsImageUploadModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAiModalVisible, setIsAiModalVisible] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [includeCurrentHtml, setIncludeCurrentHtml] = useState(() => {
    // 如果初始有內容，默認勾選包含當前 HTML
    const initialContent = initialSchema?.htmlCode || initialSchema?.html || '';
    return initialContent.trim().length > 0;
  });
  
  // GrapesJS 相關狀態
  const [grapesEditor, setGrapesEditor] = useState(null);
  const editorRef = useRef(null);

  // 監聽 htmlContent 變化，當有內容時自動勾選包含當前 HTML
  useEffect(() => {
    if (htmlContent.trim()) {
      setIncludeCurrentHtml(true);
    }
  }, [htmlContent]);
  
  // 初始化 GrapesJS
  useEffect(() => {
    console.log('🔍 useEffect 觸發 - editorType:', editorType, 'grapesEditor:', grapesEditor);
    console.log('🔍 editorRef.current:', editorRef.current);
    console.log('🔍 isEditorReady:', isEditorReady);
    
    if (editorRef.current && !grapesEditor && editorType === 'grapesjs') {
      console.log('🚀 開始初始化 GrapesJS 編輯器...');
      
      try {
        const editor = grapesjs.init({
          container: editorRef.current,
          height: '100%',
          width: 'auto',
          storageManager: false,
          // 啟用基本插件
          plugins: ['gjs-preset-webpage'],
          pluginsOpts: {
            'gjs-preset-webpage': {
              // 基本配置
            }
          },
          canvas: {
            styles: [
              'https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css',
            ],
            scripts: [
              'https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js',
            ],
          },
          // 更好的初始組件
          components: htmlContent.trim() ? htmlContent : `
            <div class="container">
              <div class="row">
                <div class="col-md-12">
                  <h1>歡迎使用表單設計器</h1>
                  <p>請從左側面板拖拽組件到此處開始設計您的表單。</p>
                  <div class="form-group">
                    <label for="exampleInput">示例輸入框</label>
                    <input type="text" class="form-control" id="exampleInput" placeholder="請輸入...">
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
          `,
        });
        
        console.log('✅ GrapesJS 編輯器初始化成功');
        
        // 監聽內容變化
        editor.on('component:selected', function(component) {
          console.log('選中組件:', component);
        });
        
        editor.on('component:update', function(component) {
          const html = editor.getHtml();
          const css = editor.getCss();
          setHtmlContent(`<style>${css}</style>${html}`);
          console.log('內容已更新');
        });
        
        // 監聽整個編輯器的變化
        editor.on('change:selectedComponent', function() {
          const html = editor.getHtml();
          const css = editor.getCss();
          setHtmlContent(`<style>${css}</style>${html}`);
        });
        
        setGrapesEditor(editor);
        setIsEditorReady(true);
        
        // 如果有初始 HTML 內容，載入它
        if (htmlContent.trim()) {
          console.log('📝 載入初始 HTML 內容...');
          editor.setComponents(htmlContent);
          console.log('✅ 初始內容載入完成');
        }
        
      } catch (error) {
        console.error('❌ GrapesJS 初始化失敗:', error);
        setIsEditorReady(false);
        message.error('GrapesJS 編輯器初始化失敗，請檢查控制台錯誤信息');
      }
    } else {
      console.log('⏭️ 跳過初始化 - 條件不滿足');
      console.log('  - editorRef.current:', !!editorRef.current);
      console.log('  - !grapesEditor:', !grapesEditor);
      console.log('  - editorType === grapesjs:', editorType === 'grapesjs');
    }
    
    return () => {
      if (grapesEditor) {
        console.log('🧹 清理 GrapesJS 編輯器');
        grapesEditor.destroy();
      }
    };
  }, [editorType, editorRef.current]);

  // 工具欄收合切換
  const toggleToolbar = () => {
    setIsToolbarCollapsed(!isToolbarCollapsed);
  };





  // Word 文件上傳處理
  const handleWordUpload = async (file) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // 創建 AbortController 用於超時控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分鐘超時

      const response = await fetch('/api/FormsUpload/word', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (result.success) {
        message.success('✅ Word 文件已成功轉換！');
        setHtmlContent(result.htmlContent);
        setFormName(result.formName || '從 Word 創建的表單');
        setIsWordUploadModalVisible(false);
        
        // 如果使用 GrapesJS，更新編輯器內容
        if (grapesEditor && editorType === 'grapesjs') {
          grapesEditor.setComponents(result.htmlContent);
        }
      } else {
        message.error('❌ 轉換失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      
      // 處理不同類型的錯誤
      if (error.name === 'AbortError') {
        message.error('❌ 請求超時，Word 文件轉換需要較長時間，請稍後再試或檢查網絡連接');
      } else if (error.message.includes('timeout')) {
        message.error('❌ 請求超時，請稍後再試');
      } else {
        message.error('❌ 上傳失敗: ' + error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Excel 文件上傳處理
  const handleExcelUpload = async (file) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // 創建 AbortController 用於超時控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分鐘超時

      const response = await fetch('/api/FormsUpload/excel', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (result.success) {
        message.success('✅ Excel 文件已成功轉換！');
        setHtmlContent(result.htmlContent);
        setFormName(result.formName || '從 Excel 創建的表單');
        setIsExcelUploadModalVisible(false);
        
        // 如果使用 GrapesJS，更新編輯器內容
        if (grapesEditor && editorType === 'grapesjs') {
          grapesEditor.setComponents(result.htmlContent);
        }
      } else {
        message.error('❌ 轉換失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      
      // 處理不同類型的錯誤
      if (error.name === 'AbortError') {
        message.error('❌ 請求超時，Excel 文件轉換需要較長時間，請稍後再試或檢查網絡連接');
      } else if (error.message.includes('timeout')) {
        message.error('❌ 請求超時，請稍後再試');
      } else {
        message.error('❌ 上傳失敗: ' + error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // PDF 文件上傳處理
  const handlePdfUpload = async (file) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // 創建 AbortController 用於超時控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分鐘超時

      const response = await fetch('/api/FormsUpload/pdf', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (result.success) {
        message.success('✅ PDF 文件已成功轉換！');
        setHtmlContent(result.htmlContent);
        setFormName(result.formName || '從 PDF 創建的表單');
        setIsPdfUploadModalVisible(false);
        
        // 如果使用 GrapesJS，更新編輯器內容
        if (grapesEditor && editorType === 'grapesjs') {
          grapesEditor.setComponents(result.htmlContent);
        }
      } else {
        message.error('❌ 轉換失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      
      // 處理不同類型的錯誤
      if (error.name === 'AbortError') {
        message.error('❌ 請求超時，PDF 文件轉換需要較長時間，請稍後再試或檢查網絡連接');
      } else if (error.message.includes('timeout')) {
        message.error('❌ 請求超時，請稍後再試');
      } else {
        message.error('❌ 上傳失敗: ' + error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Image 文件上傳處理
  const handleImageUpload = async (file) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // 創建 AbortController 用於超時控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分鐘超時（圖片上傳較快）

      const response = await fetch('/api/FormsUpload/image', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (result.uploaded) {
        message.success('✅ 圖片已成功上傳！');
        // 將圖片插入到編輯器中
        const imageHtml = `<img src="${result.url}" alt="${file.name}" style="max-width: 100%; height: auto;" />`;
        
        if (grapesEditor && editorType === 'grapesjs') {
          // 在 GrapesJS 中插入圖片
          const component = grapesEditor.addComponent(imageHtml);
          grapesEditor.select(component);
        } else {
          // 在 HTML 編輯器中插入圖片
          setHtmlContent(htmlContent + imageHtml);
        }
        
        setIsImageUploadModalVisible(false);
      } else {
        message.error('❌ 上傳失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      
      // 處理不同類型的錯誤
      if (error.name === 'AbortError') {
        message.error('❌ 請求超時，圖片上傳需要較長時間，請稍後再試或檢查網絡連接');
      } else if (error.message.includes('timeout')) {
        message.error('❌ 請求超時，請稍後再試');
      } else {
        message.error('❌ 上傳失敗: ' + error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // AI 生成表單處理
  const handleAiGenerateForm = async () => {
    if (!aiPrompt.trim()) {
      message.warning('請輸入您的需求描述');
      return;
    }

    setIsAiGenerating(true);
    try {
      // 準備請求數據
      const requestData = {
        prompt: aiPrompt.trim(),
        includeCurrentHtml: includeCurrentHtml
      };

      // 如果選擇包含當前 HTML，則添加當前內容
      if (includeCurrentHtml && htmlContent.trim()) {
        requestData.CurrentHtml = htmlContent.trim();
        console.log('📤 傳送當前 HTML 內容給 AI:', htmlContent.substring(0, 200) + '...');
      } else {
        console.log('📤 不包含當前 HTML，生成全新表單');
      }

      // 創建 AbortController 用於超時控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分鐘超時

      const response = await fetch('/api/FormsUpload/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (result.success) {
        message.success('✅ AI 已成功生成表單！');
        setHtmlContent(result.htmlContent);
        setFormName(result.formName || 'AI 生成的表單');
        setIsAiModalVisible(false);
        setAiPrompt('');
        
        // 如果使用 GrapesJS，更新編輯器內容
        if (grapesEditor && editorType === 'grapesjs') {
          grapesEditor.setComponents(result.htmlContent);
        }
      } else {
        message.error('❌ 生成失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ AI 生成錯誤:', error);
      
      // 處理不同類型的錯誤
      if (error.name === 'AbortError') {
        message.error('❌ 請求超時，AI 生成需要較長時間，請稍後再試或檢查網絡連接');
      } else if (error.message.includes('timeout')) {
        message.error('❌ 請求超時，請稍後再試');
      } else {
        message.error('❌ 生成失敗: ' + error.message);
      }
    } finally {
      setIsAiGenerating(false);
    }
  };















  // 保存表單
  const handleSave = async () => {
    if (!htmlContent.trim()) {
      message.warning('請先編寫表單內容');
      return;
    }

    if (!formName.trim()) {
      message.warning('請輸入表單名稱');
      return;
    }

    setIsSaving(true);
    try {
      // 如果使用 GrapesJS，從編輯器獲取最新內容
      let finalHtmlContent = htmlContent;
      if (grapesEditor && editorType === 'grapesjs') {
        const html = grapesEditor.getHtml();
        const css = grapesEditor.getCss();
        finalHtmlContent = `<style>${css}</style>${html}`;
      }

      const formData = {
        id: initialSchema?.id || `form_${Date.now()}`,
        name: formName.trim(),
        description: formDescription.trim(),
        html: finalHtmlContent,
        createdAt: initialSchema?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: (initialSchema?.version || 0) + 1,
        metadata: {
          editor: 'GrapesJS',
          mode: 'visual-edit',
          contentLength: finalHtmlContent.length,
          hasImages: finalHtmlContent.includes('<img'),
          hasTables: finalHtmlContent.includes('<table'),
          lastModified: new Date().toLocaleString('zh-TW')
        }
      };

      console.log('💾 保存的表單數據:', formData);

      // 如果沒有提供 onSave 回調，則使用本地存儲作為備用
      if (onSave) {
        await onSave(formData);
        message.success('✅ 表單已成功保存');
      } else {
        // 本地存儲備用方案
        const savedForms = JSON.parse(localStorage.getItem('savedForms') || '[]');
        const existingIndex = savedForms.findIndex(form => form.id === formData.id);
        
        if (existingIndex >= 0) {
          savedForms[existingIndex] = formData;
        } else {
          savedForms.push(formData);
        }
        
        localStorage.setItem('savedForms', JSON.stringify(savedForms));
        message.success('✅ 表單已保存到本地存儲');
        console.log('💾 本地存儲的表單列表:', savedForms);
      }
    } catch (error) {
      console.error('❌ 保存錯誤:', error);
      message.error('❌ 保存失敗: ' + (error.message || '未知錯誤'));
    } finally {
      setIsSaving(false);
    }
  };

          // TinyMCE 配置 - 完全允許所有內容


  return (
    <>
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f5',
        overflow: 'hidden',
        position: 'relative'
      }}>
        
        {/* 浮動展開按鈕 - 當工具欄收合時顯示 */}
        {isToolbarCollapsed && (
          <div style={{
            position: 'fixed',
            top: '10px',
            right: '20px',
            zIndex: 1000,
            backgroundColor: '#fff',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            padding: '8px',
            border: '1px solid #e8e8e8'
          }}>
            <Button
              type="text"
              icon={<DownOutlined />}
              onClick={toggleToolbar}
              title="展開工具欄"
              style={{ color: '#666' }}
            />
          </div>
        )}
        <style>{purpleButtonStyle}</style>
      {/* Header */}
      <div style={{
        display: isToolbarCollapsed ? 'none' : 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e8e8e8',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        flexShrink: 0,
        gap: '16px',
        flexWrap: 'wrap'
      }}>
                          {/* 返回按鈕和保存按鈕 */}
         <Button 
           type="primary" 
           icon={<ArrowLeftOutlined />} 
           onClick={onBack} 
           title="返回" 
           style={{ 
             backgroundColor: '#722ed1', 
             borderColor: '#722ed1'
           }} 
           className="purple-back-button"
         />
         
         <Button
           type="primary"
           icon={<SaveOutlined />}
           onClick={handleSave}
           loading={isSaving}
           title={isSaving ? '保存中...' : '儲存設計'}
         />
         
         <Button
           type="primary"
           icon={<RobotOutlined />}
           onClick={() => setIsAiModalVisible(true)}
           title="AI 生成表單"
         />
         
         <Button
           type="primary"
           icon={<FileWordOutlined />}
           onClick={() => setIsWordUploadModalVisible(true)}
           title="從 Word 文件創建"
         />
         
         <Button
           type="primary"
           icon={<FileExcelOutlined />}
           onClick={() => setIsExcelUploadModalVisible(true)}
           title="從 Excel 文件創建"
         />
         
         <Button
           type="primary"
           icon={<FilePdfOutlined />}
           onClick={() => setIsPdfUploadModalVisible(true)}
           title="從 PDF 文件創建"
         />
         
         <Button
           type="primary"
           icon={<FileImageOutlined />}
           onClick={() => setIsImageUploadModalVisible(true)}
           title="上傳圖片"
         />
         
         {/* 表單信息輸入 */}
         <Space size="small">
           <Input
             placeholder="表單名稱"
             value={formName}
             onChange={(e) => setFormName(e.target.value)}
             style={{ width: 180 }}
             size="small"
           />
           <Input
             placeholder="表單描述"
             value={formDescription}
             onChange={(e) => setFormDescription(e.target.value)}
             style={{ width: 200 }}
             size="small"
           />
         </Space>
         

         
         {/* 工具欄收合按鈕 */}
         <Button
           type="text"
           icon={isToolbarCollapsed ? <DownOutlined /> : <UpOutlined />}
           onClick={toggleToolbar}
           title={isToolbarCollapsed ? '展開工具欄' : '收合工具欄'}
           style={{ color: '#666' }}
         />
      </div>

      {/* Word 文件上傳 Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileWordOutlined style={{ color: '#1890ff' }} />
            從 Word 文件創建表單
          </div>
        }
        open={isWordUploadModalVisible}
        onCancel={() => setIsWordUploadModalVisible(false)}
        footer={null}
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <Alert
            message="📄 Word 文件轉換"
            description="上傳 Word 文件 (.doc, .docx)，系統會自動轉換為 HTML 格式並載入到編輯器中。支持文字、表格、圖片等內容。"
            type="info"
            showIcon
            style={{ marginBottom: '20px' }}
          />
          
          <Upload.Dragger
            name="file"
            accept=".doc,.docx"
            beforeUpload={(file) => {
              handleWordUpload(file);
              return false; // 阻止自動上傳
            }}
            showUploadList={false}
            disabled={isUploading}
          >
            <div style={{ padding: '40px 20px' }}>
              <FileWordOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                {isUploading ? '正在轉換...' : '點擊或拖拽 Word 文件到此處'}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                支持 .doc 和 .docx 格式，文件大小不超過 50MB
              </div>
            </div>
          </Upload.Dragger>
          
          {isUploading && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '8px', color: '#666' }}>
                正在處理 Word 文件，請稍候...
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Excel 文件上傳 Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileExcelOutlined style={{ color: '#52c41a' }} />
            從 Excel 文件創建表單
          </div>
        }
        open={isExcelUploadModalVisible}
        onCancel={() => setIsExcelUploadModalVisible(false)}
        footer={null}
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <Alert
            message="📊 Excel 文件轉換"
            description="上傳 Excel 文件 (.xls, .xlsx)，系統會自動轉換為 HTML 格式並載入到編輯器中。支持表格、圖表等內容。"
            type="success"
            showIcon
            style={{ marginBottom: '20px' }}
          />
          
          <Upload.Dragger
            name="file"
            accept=".xls,.xlsx"
            beforeUpload={(file) => {
              handleExcelUpload(file);
              return false; // 阻止自動上傳
            }}
            showUploadList={false}
            disabled={isUploading}
          >
            <div style={{ padding: '40px 20px' }}>
              <FileExcelOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                {isUploading ? '正在轉換...' : '點擊或拖拽 Excel 文件到此處'}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                支持 .xls 和 .xlsx 格式，文件大小不超過 50MB
              </div>
            </div>
          </Upload.Dragger>
          
          {isUploading && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '8px', color: '#666' }}>
                正在處理 Excel 文件，請稍候...
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* PDF 文件上傳 Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FilePdfOutlined style={{ color: '#ff4d4f' }} />
            從 PDF 文件創建表單
          </div>
        }
        open={isPdfUploadModalVisible}
        onCancel={() => setIsPdfUploadModalVisible(false)}
        footer={null}
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <Alert
            message="📋 PDF 文件轉換"
            description="上傳 PDF 文件 (.pdf)，系統會自動轉換為 HTML 格式並載入到編輯器中。支持文字、圖片等內容。"
            type="warning"
            showIcon
            style={{ marginBottom: '20px' }}
          />
          
          <Upload.Dragger
            name="file"
            accept=".pdf"
            beforeUpload={(file) => {
              handlePdfUpload(file);
              return false; // 阻止自動上傳
            }}
            showUploadList={false}
            disabled={isUploading}
          >
            <div style={{ padding: '40px 20px' }}>
              <FilePdfOutlined style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                {isUploading ? '正在轉換...' : '點擊或拖拽 PDF 文件到此處'}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                支持 .pdf 格式，文件大小不超過 50MB
              </div>
            </div>
          </Upload.Dragger>
          
          {isUploading && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '8px', color: '#666' }}>
                正在處理 PDF 文件，請稍候...
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Image 文件上傳 Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileImageOutlined style={{ color: '#722ed1' }} />
            上傳圖片
          </div>
        }
        open={isImageUploadModalVisible}
        onCancel={() => setIsImageUploadModalVisible(false)}
        footer={null}
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <Alert
            message="🖼️ 圖片上傳"
            description="上傳圖片文件，系統會自動將圖片插入到編輯器中。支持 JPG、PNG、GIF 等格式。"
            type="info"
            showIcon
            style={{ marginBottom: '20px' }}
          />
          
          <Upload.Dragger
            name="file"
            accept=".jpg,.jpeg,.png,.gif,.bmp,.webp"
            beforeUpload={(file) => {
              handleImageUpload(file);
              return false; // 阻止自動上傳
            }}
            showUploadList={false}
            disabled={isUploading}
          >
            <div style={{ padding: '40px 20px' }}>
              <FileImageOutlined style={{ fontSize: '48px', color: '#722ed1', marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                {isUploading ? '正在上傳...' : '點擊或拖拽圖片到此處'}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                支持 JPG、PNG、GIF、BMP、WebP 格式，文件大小不超過 10MB
              </div>
            </div>
          </Upload.Dragger>
          
          {isUploading && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '8px', color: '#666' }}>
                正在上傳圖片，請稍候...
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* AI 生成表單 Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RobotOutlined style={{ color: '#1890ff' }} />
            AI 生成表單
          </div>
        }
        open={isAiModalVisible}
        onCancel={() => setIsAiModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsAiModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="generate"
            type="primary"
            onClick={handleAiGenerateForm}
            loading={isAiGenerating}
            disabled={!aiPrompt.trim()}
          >
            {isAiGenerating ? '生成中...' : '生成表單'}
          </Button>
        ]}
        width={600}
      >
        <div style={{ padding: '20px 0' }}>
          <Alert
            message="🤖 AI 智能生成"
            description="描述您需要的表單類型和要求，AI 將為您生成相應的 HTML 表單。適合用於審批流程、申請表單等。"
            type="info"
            showIcon
            style={{ marginBottom: '20px' }}
          />
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              需求描述：
            </label>
            <Input.TextArea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="例如：我需要一個請假申請表單，包含員工信息、請假類型、開始日期、結束日期、請假原因等欄位..."
              rows={6}
              style={{ fontSize: '14px' }}
            />
          </div>

          {/* 只有當編輯器有內容時才顯示包含當前 HTML 的選項 */}
          {htmlContent.trim() && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                包含當前 HTML：
              </label>
              <Switch
                checked={includeCurrentHtml}
                onChange={(checked) => setIncludeCurrentHtml(checked)}
                style={{ marginBottom: '16px' }}
              />
              <Alert
                message={includeCurrentHtml ? "✅ 將基於當前內容修改" : "🔄 將生成全新表單"}
                description={
                  includeCurrentHtml 
                    ? `AI 將基於您當前的表單內容進行修改和優化。當前內容長度：${htmlContent.length} 字符`
                    : "AI 將根據您的描述生成全新的表單，不會使用當前編輯器中的內容"
                }
                type={includeCurrentHtml ? "success" : "info"}
                showIcon
                style={{ marginTop: '16px' }}
              />
            </div>
          )}
          
          {isAiGenerating && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '8px', color: '#666' }}>
                AI 正在生成表單，請稍候...
              </div>
            </div>
          )}
        </div>
      </Modal>



      {/* Editor Area */}
      <div style={{
        flex: 1,
        backgroundColor: '#fff',
        padding: '24px',
        overflow: 'auto',
        minHeight: 0
      }}>
                {/* GrapesJS 視覺化編輯器 */}
        <div style={{ height: '100%', width: '100%' }}>
          {(() => {
            console.log('🎨 渲染 GrapesJS 編輯器區域');
            console.log('  - isEditorReady:', isEditorReady);
            console.log('  - editorType:', editorType);
            console.log('  - editorRef.current:', editorRef.current);
            
            // 總是渲染容器，但根據狀態顯示不同內容
            return (
              <div 
                ref={editorRef}
                style={{ 
                  height: '100%',
                  width: '100%',
                  border: '1px solid #e8e8e8',
                  backgroundColor: '#fafafa'
                }}
              >
                {!isEditorReady ? (
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    textAlign: 'center',
                    padding: '40px'
                  }}>
                    <div>
                      <Spin size="large" />
                      <div style={{ marginTop: '16px', color: '#666' }}>
                        正在載入 GrapesJS 編輯器...
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                        編輯器類型: {editorType} | 容器: {editorRef.current ? '已準備' : '未準備'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '100%' }}>
                    {/* GrapesJS 將在這裡渲染 */}
                    <div style={{ 
                      width: '100%', 
                      height: '100%',
                      backgroundColor: 'transparent'
                    }}>
                      {/* 編輯器已準備好，GrapesJS 會自動接管這個容器 */}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
       </div>
     </div>
     </>
   );
 };

export default EFormDesigner; 