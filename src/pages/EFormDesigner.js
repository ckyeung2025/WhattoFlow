import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeftOutlined, SaveOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { Button, Space, message, Typography, Input } from 'antd';
import { EFormDesignerEdit, EFormDesignerUpload, EFormDesignerAI } from '../components/EFormDesigner';
import useGrapesJS from '../hooks/useGrapesJS';
import { useLanguage } from '../contexts/LanguageContext';

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
  
  // 編輯相關狀態
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  
  // GrapesJS 相關
  const editorRef = useRef(null);
  const { editor: grapesEditor, isReady: isEditorReady } = useGrapesJS(editorRef, htmlContent);

  // 監聽編輯器事件
  useEffect(() => {
    if (grapesEditor) {
      // 監聽編輯組件請求
      grapesEditor.on('edit-component-requested', (component) => {
        setSelectedComponent(component);
        setEditModalVisible(true);
      });
      
      // 監聽內容變化
      grapesEditor.on('component:update', () => {
        const html = grapesEditor.getHtml();
        const css = grapesEditor.getCss();
        setHtmlContent(`<style>${css}</style>${html}`);
      });
    }
  }, [grapesEditor]);

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

        {/* 編輯器區域 */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div
            ref={editorRef}
            style={{ 
              height: '100%', 
              width: '100%',
              backgroundColor: '#f5f5f5'
            }}
          />
        </div>
      </div>

      {/* 模態框組件 */}
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

      <EFormDesignerEdit
        visible={editModalVisible}
        component={selectedComponent}
        editor={grapesEditor}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedComponent(null);
        }}
        onSave={() => {
          setEditModalVisible(false);
          setSelectedComponent(null);
          // 更新 HTML 內容
          if (grapesEditor) {
            const html = grapesEditor.getHtml();
            const css = grapesEditor.getCss();
            setHtmlContent(`<style>${css}</style>${html}`);
          }
        }}
      />
    </div>
  );
};

export default EFormDesigner; 