import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeftOutlined, SaveOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Space, message, Typography, Input } from 'antd';
import { EFormDesignerUpload, EFormDesignerAI } from '../components/EFormDesigner';
import useGrapesJS from '../hooks/useGrapesJS';
import { useLanguage } from '../contexts/LanguageContext';
import {
  TextInputEditor,
  TextAreaEditor,
  SelectEditor,
  RadioEditor,
  CheckboxEditor,
  ButtonEditor,
  LabelEditor
} from '../components/EFormDesigner/editors';

// 添加紫色返回按鈕的 hover 樣式
const purpleButtonStyle = `
  .purple-back-button:hover {
    background-color: #8c4dd4 !important;
    border-color: #8c4dd4 !important;
  }
`;

const { Title } = Typography;

const EFormDesigner = ({ initialSchema, onSave, onBack }) => {
  const { t } = useLanguage();
  
  // 基本狀態
  const [htmlContent, setHtmlContent] = useState(initialSchema?.htmlCode || initialSchema?.html || '');
  const [formName, setFormName] = useState(initialSchema?.name || t('eformDesigner.newForm'));
  const [formDescription, setFormDescription] = useState(initialSchema?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  
  // 上傳相關狀態
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadType, setUploadType] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // AI 相關狀態
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  
  // 編輯相關狀態 - 改為右側面板
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  
  // GrapesJS 相關
  const editorRef = useRef(null);
  console.log(' EFormDesigner: 開始調用 useGrapesJS...');

  const { editor: grapesEditor, isReady: isEditorReady } = useGrapesJS(
    editorRef, 
    htmlContent,
    (readyEditor) => {
      // 當編輯器準備好時，設置事件監聽器
      console.log('🎧 編輯器準備好，開始設置事件監聽器...');
      console.log('🎧 編輯器實例:', readyEditor);
      console.log('🎧 編輯器方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(readyEditor)));
      
      // 檢查編輯器是否有 on 方法
      if (typeof readyEditor.on === 'function') {
        console.log('✅ 編輯器有 on 方法，可以設置事件監聽器');
        
        // 監聽編輯組件請求
        readyEditor.on('edit-component-requested', (component) => {
          // 添加安全檢查
          if (!component || !component.get || typeof component.get !== 'function') {
            console.warn('⚠️ edit-component-requested: 組件無效或已被銷毀');
            return;
          }
          
          try {
            const tagName = component.get('tagName');
            const componentId = component.getId();
            
            console.log('📱 收到編輯組件請求:', component);
            console.log('📱 組件標籤:', tagName);
            console.log('📱 組件ID:', componentId);
            
            // 使用函數式更新確保狀態正確更新
            setSelectedComponent(component);
            setEditPanelOpen(true);
            
            console.log('✅ 右側面板狀態已設置為開啟');
            console.log('🔍 當前 editPanelOpen 狀態:', true);
            console.log('🔍 當前 selectedComponent:', component);
          } catch (error) {
            console.error('❌ edit-component-requested 事件處理錯誤:', error);
            console.error('❌ 組件狀態:', {
              hasGet: !!component.get,
              getType: typeof component.get,
              component: component
            });
          }
        });
        
        // 監聽內容變化
        readyEditor.on('component:update', () => {
          console.log('🔄 組件更新事件觸發，重新獲取 HTML 內容');
          const html = readyEditor.getHtml();
          const css = readyEditor.getCss();
          const newContent = `<style>${css}</style>${html}`;
          console.log('🔄 新的 HTML 內容長度:', newContent.length);
          setHtmlContent(newContent);
        });
        
        // 監聽編輯器內容更新事件
        readyEditor.on('component:update', () => {
          console.log('🔄 編輯器內容更新事件觸發');
          // 這個事件會在組件更新後觸發，確保 HTML 內容是最新的
        });
        
        // 監聽日期格式更新事件
        readyEditor.on('date-format-updated', (data) => {
          console.log('📅 日期格式已更新:', data);
          // 觸發重新渲染
          const html = readyEditor.getHtml();
          const css = readyEditor.getCss();
          setHtmlContent(`<style>${css}</style>${html}`);
        });
        
        console.log('✅ 編輯器事件監聽器設置完成');
      } else {
        console.error('❌ 編輯器沒有 on 方法，無法設置事件監聽器');
        console.error('❌ 編輯器類型:', typeof readyEditor);
        console.error('❌ 編輯器原型:', Object.getPrototypeOf(readyEditor));
      }
    }
  );

  // 使用 useEffect 來監聽 grapesEditor 的變化，確保事件監聽器被正確設置
  useEffect(() => {
    if (grapesEditor && isEditorReady) {
      console.log(' useEffect: 編輯器已準備好，設置事件監聽器');
      
      // 處理編輯請求
      const handleEditRequest = (component) => {
        // 添加安全檢查
        if (!component || !component.get || typeof component.get !== 'function') {
          console.warn('⚠️ handleEditRequest: 組件無效或已被銷毀');
          return;
        }
        
        try {
          const tagName = component.get('tagName');
          const componentId = component.getId();
          
          console.log('📱 處理編輯組件請求:', tagName, componentId);
          
          // 確保 editFormData 已初始化
          if (!component.get('editFormData')) {
            console.log('🔧 編輯請求時初始化 editFormData');
            // 這裡我們需要調用 useGrapesJS 中的 initializeFormData 函數
            // 但由於我們在 EFormDesigner 中，我們需要手動初始化
            const attributes = component.getAttributes();
            
            if (tagName.toLowerCase() === 'textarea') {
              // 優先從 DOM 元素獲取 textContent，這是最可靠的方法
              let textareaValue = '';
              try {
                const el = component.getEl ? component.getEl() : null;
                if (el) {
                  textareaValue = el.textContent || el.innerText || '';
                  console.log('✅ 從 DOM 獲取 textarea 內容:', textareaValue);
                }
                
                // 如果 DOM 方法失敗，嘗試其他方法
                if (!textareaValue) {
                  textareaValue = component.get('content') || '';
                  console.log('⚠️ 使用備用方法獲取 textarea 內容:', textareaValue);
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
              console.log('✅ textarea editFormData 已初始化:', textareaData);
            } else if (tagName.toLowerCase() === 'input') {
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
              
              const inputType = attributes.type || 'text';
              const inputData = {
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
                inputData.dateFormat = attributes['data-date-format'] || 'YYYY-MM-DD';
              }
              
              component.set('editFormData', inputData);
              console.log('✅ input editFormData 已初始化:', inputData);
            }
          }
          
          // 使用函數式更新確保狀態正確更新
          setSelectedComponent(component);
          setEditPanelOpen(true);
          
          console.log('✅ 右側面板狀態已設置為開啟');
          console.log('🔍 當前 editPanelOpen 狀態:', true);
          console.log('🔍 當前 selectedComponent:', component);
        } catch (error) {
          console.error('❌ handleEditRequest 發生錯誤:', error);
          console.error('❌ 組件狀態:', {
            hasGet: !!component.get,
            getType: typeof component.get,
            component: component
          });
        }
      };
      
      // 監聽內容變化
      const handleComponentUpdate = () => {
        console.log('🔄 useEffect: 組件更新事件觸發，重新獲取 HTML 內容');
        const html = grapesEditor.getHtml();
        const css = grapesEditor.getCss();
        const newContent = `<style>${css}</style>${html}`;
        console.log('🔄 useEffect: 新的 HTML 內容長度:', newContent.length);
        setHtmlContent(newContent);
      };
      
      // 監聽編輯器內容更新事件
      const handleEditorUpdate = () => {
        console.log('🔄 useEffect: 編輯器內容更新事件觸發');
        // 這個事件會在組件更新後觸發，確保 HTML 內容是最新的
      };
      
      // 綁定事件監聽器
      grapesEditor.on('edit-component-requested', handleEditRequest);
      grapesEditor.on('component:update', handleComponentUpdate);
      grapesEditor.on('component:update', handleEditorUpdate);
      
      console.log('✅ useEffect: 事件監聽器設置完成');
      
      // 清理函數
      return () => {
        console.log(' useEffect: 清理事件監聽器');
        grapesEditor.off('edit-component-requested', handleEditRequest);
        grapesEditor.off('component:update', handleComponentUpdate);
        grapesEditor.off('component:update', handleEditorUpdate);
      };
    }
  }, [grapesEditor, isEditorReady]);

  // 添加調試日誌
  console.log(' EFormDesigner 渲染狀態:', {
    editPanelOpen,
    selectedComponent: !!selectedComponent,
    grapesEditor: !!grapesEditor,
    isEditorReady
  });

  // 移除原來的 useEffect，因為我們現在使用 onEditorReady 回調

  // 工具欄收合切換
  const toggleToolbar = () => {
    setIsToolbarCollapsed(!isToolbarCollapsed);
  };

  // 處理上傳成功
  const handleUploadSuccess = (htmlContent, formName, isImage = false) => {
    if (isImage) {
      // 圖片插入到當前選中的組件
      if (grapesEditor) {
        const selected = grapesEditor.getSelected();
        if (selected) {
          selected.components().add(htmlContent);
        }
      }
    } else {
      // 替換整個內容
      setHtmlContent(htmlContent);
      if (formName) {
        setFormName(formName);
      }
      if (grapesEditor) {
        grapesEditor.setComponents(htmlContent);
      }
    }
  };

  // 處理 AI 生成成功
  const handleAiSuccess = (htmlContent, formName) => {
    setHtmlContent(htmlContent);
    if (formName) {
      setFormName(formName);
    }
    if (grapesEditor) {
      grapesEditor.setComponents(htmlContent);
    }
  };

  // 打開上傳模態框
  const openUploadModal = (type) => {
    setUploadType(type);
    setUploadModalVisible(true);
  };

  // 打開 AI 模態框
  const openAiModal = () => {
    setAiModalVisible(true);
  };

  // 保存表單
  const handleSave = async () => {
    if (!htmlContent.trim()) {
      message.warning('請先設計表單內容');
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = !!initialSchema?.id;
      const formData = {
        name: formName,
        description: formDescription,
        htmlCode: htmlContent,
        status: 'A', // Active
        rStatus: 'A' // Active
      };

      // 如果是編輯模式，添加 updatedAt
      if (isEditing) {
        formData.updatedAt = new Date().toISOString();
      }

      console.log('📤 發送保存請求:', formData);

      const token = localStorage.getItem('token');
      const url = isEditing ? `/api/eforms/${initialSchema.id}` : '/api/eforms';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      console.log('📥 收到響應:', response.status, response.statusText);

      // 檢查響應狀態
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 檢查響應內容類型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ 非 JSON 響應:', text);
        throw new Error('服務器返回非 JSON 格式響應');
      }

      const result = await response.json();
      console.log('📥 解析響應:', result);

      // 後端直接返回表單對象，沒有 success 字段
      if (result && result.id) {
        message.success('✅ 表單保存成功！');
        // 只調用 onSave 回調，不傳遞數據，避免重複保存
        onSave && onSave();
      } else {
        message.error('❌ 保存失敗: 響應格式錯誤');
      }
    } catch (error) {
      console.error('❌ 保存錯誤:', error);
      
      if (error.name === 'SyntaxError') {
        message.error('❌ 服務器響應格式錯誤，請檢查網絡連接');
      } else if (error.message.includes('Failed to fetch')) {
        message.error('❌ 網絡連接失敗，請檢查網絡設置');
      } else {
        message.error('❌ 保存失敗: ' + error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 樣式 */}
      <style>{purpleButtonStyle}</style>
      
      {/* 頂部工具欄 */}
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid #e8e8e8', 
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            className="purple-back-button"
            style={{ 
              backgroundColor: '#722ed1', 
              borderColor: '#722ed1',
              color: 'white',
              height: '32px',
              width: '32px',
              padding: '0'
            }}
          />
          <Button
            icon={<SaveOutlined />}
            type="primary"
            onClick={handleSave}
            loading={isSaving}
            style={{
              height: '32px',
              width: '32px',
              padding: '0'
            }}
          />
        </div>
        
        <Title level={4} style={{ margin: 0 }}>{t('eformDesigner.title')}</Title>
      </div>

      {/* 主要內容區域 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* 左側工具欄 */}
        <div style={{ 
          width: isToolbarCollapsed ? '0px' : '250px', 
          borderRight: isToolbarCollapsed ? 'none' : '1px solid #e8e8e8',
          backgroundColor: '#fafafa',
          padding: isToolbarCollapsed ? '0px' : '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
          overflow: 'hidden',
          opacity: isToolbarCollapsed ? 0 : 1,
          visibility: isToolbarCollapsed ? 'hidden' : 'visible'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h4>{t('eformDesigner.formInfo')}</h4>
            <div style={{ marginBottom: '12px' }}>
              <label>{t('eformDesigner.formName')}:</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('eformDesigner.formNamePlaceholder')}
                style={{ marginTop: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>{t('eformDesigner.formDescription')}:</label>
              <Input.TextArea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('eformDesigner.formDescriptionPlaceholder')}
                rows={3}
                style={{ marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4>{t('eformDesigner.uploadFile')}</h4>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                onClick={() => openUploadModal('word')}
                style={{ width: '100%' }}
              >
                📄 {t('eformDesigner.createFromWordFile')}
              </Button>
              <Button 
                onClick={() => openUploadModal('excel')}
                style={{ width: '100%' }}
              >
                📊 {t('eformDesigner.createFromExcelFile')}
              </Button>
              <Button 
                onClick={() => openUploadModal('pdf')}
                style={{ width: '100%' }}
              >
                📑 {t('eformDesigner.createFromPdfFile')}
              </Button>
              <Button 
                onClick={() => openUploadModal('image')}
                style={{ width: '100%' }}
              >
                🖼️ {t('eformDesigner.uploadImage')}
              </Button>
            </Space>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4>{t('eformDesigner.aiGenerate')}</h4>
            <Button
              onClick={openAiModal}
              style={{ width: '100%' }}
              type="primary"
            >
              🤖 {t('eformDesigner.aiGenerateForm')}
            </Button>
          </div>
        </div>

        {/* 工具欄切換按鈕 */}
        <div style={{
          position: 'absolute',
          left: isToolbarCollapsed ? '0px' : '250px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1000,
          transition: 'left 0.3s ease'
        }}>
          <Button
            icon={isToolbarCollapsed ? <UpOutlined /> : <UpOutlined rotate={180} />}
            onClick={toggleToolbar}
            type="primary"
            size="small"
            style={{
              borderRadius: isToolbarCollapsed ? '0 4px 4px 0' : '4px 0 0 4px',
              boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
              border: '1px solid #e8e8e8',
              borderLeft: isToolbarCollapsed ? 'none' : '1px solid #e8e8e8',
              borderRight: isToolbarCollapsed ? '1px solid #e8e8e8' : 'none'
            }}
          />
        </div>

        {/* 編輯器區域 - 調整寬度以適應右側面板 */}
        <div style={{ 
          flex: 1, 
          position: 'relative',
          width: editPanelOpen ? 'calc(100% - 340px)' : '100%',
          transition: 'width 0.3s ease'
        }}>
          <div
            ref={editorRef}
            style={{ 
              height: '100%', 
              width: '100%',
              backgroundColor: '#f5f5f5'
            }}
          />
        </div>

        {/* 右側編輯面板 - 替換提示信息為實際編輯器 */}
        {editPanelOpen && (
          <div style={{
            width: '340px',
            borderLeft: '1px solid #e8e8e8',
            backgroundColor: 'white',
            overflowY: 'auto',
            boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
            position: 'relative',
            zIndex: 100
          }}>
            {/* 編輯器標題 */}
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid #e8e8e8',
              backgroundColor: '#fafafa'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>
                編輯組件: {selectedComponent?.get('tagName')?.toUpperCase() || '未知'}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
                組件 ID: {selectedComponent?.getId() || 'N/A'}
              </p>
            </div>

            {/* 編輯器內容 */}
            <div style={{ padding: '20px' }}>
              {selectedComponent && (
                <ComponentEditor 
                  component={selectedComponent}
                  grapesEditor={grapesEditor}
                  onClose={() => setEditPanelOpen(false)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 模態框組件 - 保留上傳和AI功能 */}
      <EFormDesignerUpload
        visible={uploadModalVisible}
        uploadType={uploadType}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={handleUploadSuccess}
        isUploading={isUploading}
        setIsUploading={setIsUploading}
      />

      <EFormDesignerAI
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        onSuccess={handleAiSuccess}
        htmlContent={htmlContent}
        isGenerating={isAiGenerating}
        setIsGenerating={setIsAiGenerating}
      />
    </div>
  );
};

// 組件編輯器組件
const ComponentEditor = ({ component, grapesEditor, onClose }) => {
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // 根據組件類型初始化表單數據
  useEffect(() => {
    console.log('🔍 ComponentEditor useEffect 觸發，組件:', component);
    
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ ComponentEditor useEffect: 組件無效或已被銷毀');
      return;
    }
    
    try {
      const tagName = component.get('tagName');
      if (!tagName) {
        console.warn('⚠️ ComponentEditor useEffect: 組件標籤名稱無效');
        return;
      }
      
      const attributes = component.getAttributes();
      
      console.log('🔍 組件標籤:', tagName);
      console.log('🔍 組件屬性:', attributes);
      
      // 優先檢查是否有 editFormData
      const editFormData = component.get('editFormData');
      if (editFormData) {
        console.log('✅ 使用 editFormData:', editFormData);
        setFormData(editFormData);
        return;
      }
      
      console.log('⚠️ 沒有 editFormData，使用屬性初始化');
      
      switch (tagName.toLowerCase()) {
        case 'input':
          const inputType = attributes.type || 'text';
          if (inputType === 'radio') {
            setFormData({
              type: inputType,
              placeholder: attributes.placeholder || '',
              value: attributes.value || '',
              name: attributes.name || '',
              required: attributes.required || false,
              disabled: attributes.disabled || false,
              options: []
            });
          } else if (inputType === 'checkbox') {
            setFormData({
              type: inputType,
              placeholder: attributes.placeholder || '',
              value: attributes.value || '',
              name: attributes.name || '',
              required: attributes.required || false,
              disabled: attributes.disabled || false,
              checked: attributes.checked || false
            });
          } else {
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
            
            const inputFormData = {
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
              inputFormData.dateFormat = attributes['data-date-format'] || 'YYYY-MM-DD';
            }
            
            console.log('🔧 input 組件數據初始化:', inputFormData);
            setFormData(inputFormData);
          }
          break;
          
        case 'textarea':
          // 優先從 DOM 元素獲取 textContent，這是最可靠的方法
          let textareaValue = '';
          try {
            const el = component.getEl ? component.getEl() : null;
            if (el) {
              console.log('🔍 textarea DOM 元素:', el);
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
          console.log('🔧 textarea 組件數據初始化:', textareaData);
          setFormData(textareaData);
          break;
          
        case 'select':
          console.log('🔍 處理 Select 組件...');
          setFormData({
            name: attributes.name || '',
            required: attributes.required || false,
            disabled: attributes.disabled || false,
            multiple: attributes.multiple || false,
            size: attributes.size || '1',
            options: []
          });
          
          // 優先使用 editFormData 中的選項（如果有的話）
          const editFormData = component.get('editFormData');
          console.log('🔍 editFormData:', editFormData);
          
          if (editFormData && editFormData.options && editFormData.options.length > 0) {
            console.log('✅ 使用 editFormData 中的選項:', editFormData.options);
            setFormData(prev => ({ ...prev, options: editFormData.options }));
          } else {
            // 如果沒有 editFormData，則手動解析選項
            console.log('⚠️ 沒有 editFormData，手動解析選項');
            const options = component.get('components');
            console.log('🔍 組件子元素:', options);
            
            if (options && options.length > 0) {
              const parsedOptions = options.map(option => {
                let text = '';
                const value = option.getAttributes().value || '';
                const selected = option.getAttributes().selected || false;
                
                console.log('🔍 解析 option:', { value, selected });
                
                // 優先從 DOM 元素獲取文字內容
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
                
                // 如果文字為空但 value 有值，使用 value 作為文字
                if (!text && value) {
                  text = value;
                  console.log('🔄 使用 value 作為文字:', text);
                }
                
                const result = {
                  value: value,
                  text: text.trim(),
                  selected: selected
                };
                
                console.log('🔍 option 解析結果:', result);
                return result;
              });
              console.log('✅ 手動解析的選項:', parsedOptions);
              setFormData(prev => ({ ...prev, options: parsedOptions }));
            }
          }
          break;
          
        case 'button':
          setFormData({
            type: attributes.type || 'button',
            value: component.get('content') || '',
            name: attributes.name || '',
            disabled: attributes.disabled || false,
            form: attributes.form || '',
            formaction: attributes.formaction || '',
            formmethod: attributes.formmethod || 'get',
            formnovalidate: attributes.formnovalidate || false
          });
          break;
          
        case 'label':
          setFormData({
            for: attributes.for || '',
            value: component.get('content') || '',
            required: attributes.required || false
          });
          break;
          
        default:
          setFormData({
            tagName: tagName,
            content: component.get('content') || '',
            ...attributes
          });
          break;
      }
    } catch (error) {
      console.error('❌ ComponentEditor useEffect 發生錯誤:', error);
      console.error('❌ 組件狀態:', {
        hasGet: !!component.get,
        getType: typeof component.get,
        component: component
      });
    }
  }, [component]);

  // 處理表單變化
  const handleFormChange = (field, value) => {
    console.log('📝 表單字段變更:', field, value);
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      console.log('📝 更新後的表單數據:', newData);
      
      // 同時更新組件的 editFormData 以保持一致性
      if (component && component.get && typeof component.get === 'function') {
        try {
          const currentEditFormData = component.get('editFormData') || {};
          currentEditFormData[field] = value;
          component.set('editFormData', currentEditFormData);
          console.log('✅ editFormData 已同步:', currentEditFormData);
          
          // 如果是 textarea 的內容變更，立即同步到組件的 content 屬性
          if (component.get('tagName')?.toLowerCase() === 'textarea') {
            if (field === 'defaultValue' || field === 'value') {
              const contentToSync = value || '';
              console.log('🔄 立即同步 textarea 內容到組件:', contentToSync);
              
              // 更新組件的 content 屬性
              component.set('content', contentToSync);
              
              // 同時更新 innerHTML 和 textContent 屬性
              try {
                component.set('innerHTML', contentToSync);
                component.set('textContent', contentToSync);
                console.log('✅ textarea 組件內容屬性已同步');
              } catch (error) {
                console.warn('⚠️ 同步組件內容屬性時出錯:', error);
              }
              
              // 強制更新 DOM 元素
              const el = component.getEl();
              if (el) {
                el.textContent = contentToSync;
                console.log('✅ textarea DOM 元素內容已同步');
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ 同步 editFormData 時出錯:', error);
        }
      }
      
      return newData;
    });
  };

  // 保存更改
  const handleSave = async () => {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ handleSave: 組件無效或已被銷毀');
      message.error('無法保存：組件無效或已被銷毀');
      return;
    }
    
    setIsLoading(true);
    try {
      // 根據組件類型更新屬性
      const tagName = component.get('tagName');
      if (!tagName) {
        throw new Error('組件標籤名稱無效');
      }
      
      switch (tagName.toLowerCase()) {
        case 'input':
          if (formData.type === 'radio' || formData.type === 'checkbox') {
            // 更新 radio/checkbox 組件
            component.setAttributes({
              type: formData.type,
              name: formData.name,
              value: formData.value,
              required: formData.required,
              disabled: formData.disabled
            });
            
            if (formData.type === 'checkbox') {
              component.setAttributes({ checked: formData.checked });
            }
          } else {
            // 更新普通 input 組件
            const attributes = {
              type: formData.type,
              placeholder: formData.placeholder,
              value: formData.value,
              name: formData.name,
              required: formData.required,
              disabled: formData.disabled,
              readonly: formData.readonly,
              maxlength: formData.maxlength,
              minlength: formData.minlength,
              pattern: formData.pattern,
              title: formData.title
            };
            
            // 如果是日期類型，保存日期格式信息
            if (formData.type === 'date' && formData.dateFormat) {
              attributes['data-date-format'] = formData.dateFormat;
            }
            
            component.setAttributes(attributes);
          }
          break;
          
        case 'textarea':
          console.log('💾 保存 textarea 組件:', formData);
          
          // 獲取要保存的內容值（優先使用 defaultValue，其次使用 value）
          const contentToSave = formData.defaultValue || formData.value || '';
          console.log(' textarea 要保存的內容:', contentToSave);
          
          // 強制更新 DOM 元素（在設置組件內容之前）
          const el = component.getEl();
          if (el) {
            el.textContent = contentToSave;
            console.log('✅ textarea DOM 元素內容已更新:', contentToSave);
          }
          
          // 更新組件內容 - 使用多種方法確保內容被正確設置
          component.set('content', contentToSave);
          
          // 同時設置 innerHTML 和 textContent 屬性
          try {
            component.set('innerHTML', contentToSave);
            component.set('textContent', contentToSave);
            console.log('✅ textarea 組件 innerHTML 和 textContent 已設置');
          } catch (error) {
            console.warn('⚠️ 設置 innerHTML/textContent 時出錯:', error);
          }
          
          // 更新屬性
          component.setAttributes({
            placeholder: formData.placeholder,
            name: formData.name,
            required: formData.required,
            disabled: formData.disabled,
            readonly: formData.readonly,
            rows: formData.rows,
            cols: formData.cols,
            maxlength: formData.maxlength,
            minlength: formData.minlength
          });
          
          // 同時更新 editFormData 以保持一致性
          const currentEditFormData = component.get('editFormData') || {};
          currentEditFormData.defaultValue = contentToSave;
          currentEditFormData.value = contentToSave;
          component.set('editFormData', currentEditFormData);
          
          // 強制觸發組件重新渲染
          try {
            // 觸發組件內容變化事件
            component.trigger('change:content');
            console.log('✅ textarea 組件 change:content 事件已觸發');
            
            // 觸發組件更新事件
            component.trigger('component:update');
            console.log('✅ textarea 組件 component:update 事件已觸發');
            
            // 觸發組件重新渲染事件
            component.trigger('change:attributes');
            console.log('✅ textarea 組件 change:attributes 事件已觸發');
            
            // 觸發組件重新渲染事件
            component.trigger('change:innerHTML');
            console.log('✅ textarea 組件 change:innerHTML 事件已觸發');
          } catch (error) {
            console.warn('⚠️ 觸發組件事件時出錯:', error);
          }
          
          // 強制編輯器更新，確保 HTML 代碼同步
          if (grapesEditor && grapesEditor.refresh) {
            try {
              // 使用 setTimeout 避免在事件處理器中直接調用 refresh
              setTimeout(() => {
                if (grapesEditor && !grapesEditor.isDestroyed) {
                  // 強制重新設置組件內容
                  const selectedComponent = grapesEditor.getSelected();
                  if (selectedComponent && selectedComponent.get('tagName') === 'textarea') {
                    console.log(' 強制重新設置 textarea 組件內容...');
                    
                    // 使用多種方法設置內容
                    selectedComponent.set('content', contentToSave);
                    selectedComponent.set('innerHTML', contentToSave);
                    selectedComponent.set('textContent', contentToSave);
                    
                    // 強制觸發內容變化事件
                    selectedComponent.trigger('change:content');
                    selectedComponent.trigger('change:innerHTML');
                    
                    console.log('✅ textarea 組件內容已強制重新設置');
                  }
                  
                  // 刷新整個編輯器
                  grapesEditor.refresh();
                  console.log('✅ GrapesJS 編輯器已刷新，HTML 代碼已同步');
                  
                  // 驗證更新結果
                  const updatedHtml = grapesEditor.getHtml();
                  console.log('🔍 更新後的 HTML 內容:', updatedHtml);
                  
                  // 檢查 textarea 是否包含正確的內容
                  if (updatedHtml.includes(contentToSave)) {
                    console.log('✅ HTML 中已包含正確的 textarea 內容:', contentToSave);
                  } else {
                    console.warn('⚠️ HTML 中未包含正確的 textarea 內容:', contentToSave);
                    
                    // 如果仍然沒有內容，嘗試更強力的方法
                    console.log('🔍 嘗試更強力的內容更新方法...');
                    
                    // 重新創建組件 - 使用正確的 GrapesJS API
                    const parent = selectedComponent.parent();
                    
                    if (parent && parent.components) {
                      // 獲取組件在父組件中的索引
                      let componentIndex = 0;
                      const components = parent.components();
                      for (let i = 0; i < components.length; i++) {
                        if (components[i] === selectedComponent) {
                          componentIndex = i;
                          break;
                        }
                      }
                      
                      // 創建新的 textarea 組件
                      const newTextareaHtml = `<textarea placeholder="${formData.placeholder || ''}" name="${formData.name || ''}" rows="${formData.rows || '4'}" cols="${formData.cols || '50'}" maxlength="${formData.maxlength || ''}" minlength="${formData.minlength || ''}" id="${selectedComponent.getId()}">${contentToSave}</textarea>`;
                      
                      // 替換舊組件
                      parent.components().remove(selectedComponent);
                      parent.components().add(newTextareaHtml, { at: componentIndex });
                      
                      console.log('✅ textarea 組件已重新創建，內容:', contentToSave);
                      
                      // 再次刷新編輯器
                      grapesEditor.refresh();
                      const finalHtml = grapesEditor.getHtml();
                      console.log('🔍 重新創建後的 HTML 內容:', finalHtml);
                    }
                  }
                }
              }, 100);
            } catch (error) {
              console.warn('⚠️ 刷新編輯器時出錯:', error);
            }
          }
          
          console.log('✅ textarea 組件保存完成');
          break;
          
        case 'select':
          component.setAttributes({
            name: formData.name,
            required: formData.required,
            disabled: formData.disabled,
            multiple: formData.multiple,
            size: formData.size
          });
          
          // 更新選項 - 修復 option 組件創建問題
          if (formData.options && formData.options.length > 0) {
            // 清空現有選項
            component.components().reset();
            
            // 使用正確的 GrapesJS 方法創建 option 組件
            formData.options.forEach(option => {
              // 創建 option 組件的 HTML 字符串
              const optionHtml = `<option value="${option.value || ''}" ${option.selected ? 'selected' : ''}>${option.text || ''}</option>`;
              
              // 使用 addComponent 方法添加組件
              component.components().add(optionHtml);
            });
          }
          break;
          
        case 'button':
          component.setAttributes({
            type: formData.type,
            name: formData.name,
            disabled: formData.disabled,
            form: formData.form,
            formaction: formData.formaction,
            formmethod: formData.formmethod,
            formnovalidate: formData.formnovalidate
          });
          component.set('content', formData.value);
          break;
          
        case 'label':
          component.setAttributes({
            for: formData.for,
            required: formData.required
          });
          component.set('content', formData.value);
          break;
          
        default:
          // 更新通用屬性
          Object.keys(formData).forEach(key => {
            if (key !== 'tagName' && key !== 'content') {
              component.setAttributes({ [key]: formData[key] });
            }
          });
          
          if (formData.content !== undefined) {
            component.set('content', formData.content);
          }
          break;
      }
      

      
      // 強制重新渲染編輯器內容
      if (component.get('tagName').toLowerCase() === 'textarea') {
        console.log('🔄 強制更新 textarea 內容:', {
          defaultValue: formData.defaultValue,
          value: formData.value,
          finalContent: formData.defaultValue || formData.value || ''
        });
        
        // 確保 DOM 元素也被更新
        const el = component.getEl();
        if (el) {
          el.textContent = formData.defaultValue || formData.value || '';
          console.log('✅ DOM 元素內容已更新');
        }
        
        // 同時更新 editFormData 以保持一致性
        const currentEditFormData = component.get('editFormData') || {};
        currentEditFormData.defaultValue = formData.defaultValue || formData.value || '';
        currentEditFormData.value = formData.defaultValue || formData.value || '';
        component.set('editFormData', currentEditFormData);
        console.log('✅ textarea editFormData 已同步:', currentEditFormData);
        

        
        // 強制重新渲染編輯器
        if (component.editor) {
          component.editor.refresh();
        }
        
        // 延遲觸發編輯器刷新，確保所有變更都已應用
        setTimeout(() => {
          if (grapesEditor && grapesEditor.refresh) {
            grapesEditor.refresh();
          }
        }, 200);
      }
      
      message.success('組件已成功更新！');
      onClose();
    } catch (error) {
      console.error('保存組件失敗:', error);
      message.error('保存失敗，請重試');
    } finally {
      setIsLoading(false);
    }
  };

  // 根據組件類型渲染對應的編輯器
  const renderEditor = () => {
    // 添加安全檢查
    if (!component || !component.get || typeof component.get !== 'function') {
      console.warn('⚠️ renderEditor: 組件無效或已被銷毀');
      return <div>無法編輯：組件無效或已被銷毀</div>;
    }
    
    try {
      const tagName = component.get('tagName');
      if (!tagName) {
        console.warn('⚠️ renderEditor: 組件標籤名稱無效');
        return <div>無法編輯：組件標籤名稱無效</div>;
      }
      
      switch (tagName.toLowerCase()) {
        case 'input':
          const inputType = component.getAttributes().type || 'text';
          if (inputType === 'radio') {
            return <RadioEditor formData={formData} onFormChange={handleFormChange} />;
          } else if (inputType === 'checkbox') {
            return <CheckboxEditor formData={formData} onFormChange={handleFormChange} />;
          } else {
            return <TextInputEditor formData={formData} onFormChange={handleFormChange} />;
          }
        
        case 'textarea':
          return <TextAreaEditor formData={formData} onFormChange={handleFormChange} />;
          
        case 'select':
          return <SelectEditor formData={formData} onFormChange={handleFormChange} />;
          
        case 'button':
          return <ButtonEditor formData={formData} onFormChange={handleFormChange} />;
          
        case 'label':
          return <LabelEditor formData={formData} onFormChange={handleFormChange} />;
          
        default:
          return <TextInputEditor formData={formData} onFormChange={handleFormChange} />;
      }
    } catch (error) {
      console.error('❌ renderEditor 發生錯誤:', error);
      console.error('❌ 組件狀態:', {
        hasGet: !!component.get,
        getType: typeof component.get,
        component: component
      });
      return <div>編輯器載入失敗，請重試</div>;
    }
  };

  return (
    <div>
      {/* 編輯器內容 */}
      {renderEditor()}
      
      {/* 操作按鈕 */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        justifyContent: 'flex-end', 
        marginTop: '20px', 
        paddingTop: '16px', 
        borderTop: '1px solid #e8e8e8' 
      }}>
        <Button onClick={onClose}>
          取消
        </Button>
        <Button 
          type="primary" 
          onClick={handleSave}
          loading={isLoading}
        >
          保存
        </Button>
      </div>
    </div>
  );
};

export default EFormDesigner; 