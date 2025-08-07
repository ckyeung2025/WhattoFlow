import React, { useState } from 'react';
import { Modal, Upload, Alert, Spin, message } from 'antd';
import { FileWordOutlined, FileExcelOutlined, FilePdfOutlined, FileImageOutlined } from '@ant-design/icons';

const EFormDesignerUpload = ({ 
  visible, 
  uploadType, 
  onClose, 
  onSuccess,
  isUploading,
  setIsUploading 
}) => {
  
  const handleWordUpload = async (file) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch('/api/FormsUpload/word', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (result.success) {
        message.success('✅ Word 文件已成功轉換！');
        onSuccess(result.htmlContent, result.formName || '從 Word 創建的表單');
        onClose();
      } else {
        message.error('❌ 轉換失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      if (error.name === 'AbortError') {
        message.error('❌ 請求超時，Word 文件轉換需要較長時間，請稍後再試或檢查網絡連接');
      } else {
        message.error('❌ 上傳失敗: ' + error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleExcelUpload = async (file) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch('/api/FormsUpload/excel', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (result.success) {
        message.success('✅ Excel 文件已成功轉換！');
        onSuccess(result.htmlContent, result.formName || '從 Excel 創建的表單');
        onClose();
      } else {
        message.error('❌ 轉換失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      if (error.name === 'AbortError') {
        message.error('❌ 請求超時，Excel 文件轉換需要較長時間，請稍後再試或檢查網絡連接');
      } else {
        message.error('❌ 上傳失敗: ' + error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handlePdfUpload = async (file) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch('/api/FormsUpload/pdf', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (result.success) {
        message.success('✅ PDF 文件已成功轉換！');
        onSuccess(result.htmlContent, result.formName || '從 PDF 創建的表單');
        onClose();
      } else {
        message.error('❌ 轉換失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      if (error.name === 'AbortError') {
        message.error('❌ 請求超時，PDF 文件轉換需要較長時間，請稍後再試或檢查網絡連接');
      } else {
        message.error('❌ 上傳失敗: ' + error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (file) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch('/api/FormsUpload/image', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (result.uploaded) {
        message.success('✅ 圖片已成功上傳！');
        const imageHtml = `<img src="${result.url}" alt="${file.name}" style="max-width: 100%; height: auto;" />`;
        onSuccess(imageHtml, null, true); // 第三個參數表示是圖片插入
        onClose();
      } else {
        message.error('❌ 上傳失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      if (error.name === 'AbortError') {
        message.error('❌ 請求超時，圖片上傳需要較長時間，請稍後再試或檢查網絡連接');
      } else {
        message.error('❌ 上傳失敗: ' + error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const getUploadConfig = () => {
    switch (uploadType) {
      case 'word':
        return {
          title: '從 Word 文件創建表單',
          icon: <FileWordOutlined style={{ color: '#1890ff' }} />,
          accept: '.doc,.docx',
          description: '上傳 Word 文件 (.doc, .docx)，系統會自動轉換為 HTML 格式並載入到編輯器中。支持文字、表格、圖片等內容。',
          alertType: 'info',
          uploadHandler: handleWordUpload,
          fileTypes: '.doc 和 .docx 格式，文件大小不超過 50MB'
        };
      case 'excel':
        return {
          title: '從 Excel 文件創建表單',
          icon: <FileExcelOutlined style={{ color: '#52c41a' }} />,
          accept: '.xls,.xlsx',
          description: '上傳 Excel 文件 (.xls, .xlsx)，系統會自動轉換為 HTML 格式並載入到編輯器中。支持表格、圖表等內容。',
          alertType: 'success',
          uploadHandler: handleExcelUpload,
          fileTypes: '.xls 和 .xlsx 格式，文件大小不超過 50MB'
        };
      case 'pdf':
        return {
          title: '從 PDF 文件創建表單',
          icon: <FilePdfOutlined style={{ color: '#ff4d4f' }} />,
          accept: '.pdf',
          description: '上傳 PDF 文件 (.pdf)，系統會自動轉換為 HTML 格式並載入到編輯器中。支持文字、圖片等內容。',
          alertType: 'warning',
          uploadHandler: handlePdfUpload,
          fileTypes: '.pdf 格式，文件大小不超過 50MB'
        };
      case 'image':
        return {
          title: '上傳圖片',
          icon: <FileImageOutlined style={{ color: '#722ed1' }} />,
          accept: '.jpg,.jpeg,.png,.gif,.bmp,.webp',
          description: '上傳圖片文件，系統會自動將圖片插入到編輯器中。支持 JPG、PNG、GIF 等格式。',
          alertType: 'info',
          uploadHandler: handleImageUpload,
          fileTypes: 'JPG、PNG、GIF、BMP、WebP 格式，文件大小不超過 10MB'
        };
      default:
        return null;
    }
  };

  const config = getUploadConfig();
  if (!config) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {config.icon}
          {config.title}
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <div style={{ padding: '20px 0' }}>
        <Alert
          message={config.title}
          description={config.description}
          type={config.alertType}
          showIcon
          style={{ marginBottom: '20px' }}
        />
        
        <Upload.Dragger
          name="file"
          accept={config.accept}
          beforeUpload={(file) => {
            config.uploadHandler(file);
            return false;
          }}
          showUploadList={false}
          disabled={isUploading}
        >
          <div style={{ padding: '40px 20px' }}>
            {React.cloneElement(config.icon, { 
              style: { fontSize: '48px', marginBottom: '16px' } 
            })}
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
              {isUploading ? '正在處理...' : '點擊或拖拽文件到此處'}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              支持 {config.fileTypes}
            </div>
          </div>
        </Upload.Dragger>
        
        {isUploading && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '8px', color: '#666' }}>
              正在處理文件，請稍候...
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EFormDesignerUpload; 