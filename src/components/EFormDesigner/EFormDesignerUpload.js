import React, { useState } from 'react';
import { Modal, Upload, Alert, Spin, message } from 'antd';
import { FileWordOutlined, FileExcelOutlined, FilePdfOutlined, FileImageOutlined } from '@ant-design/icons';
import { useLanguage } from '../../contexts/LanguageContext';

const EFormDesignerUpload = ({ 
  visible, 
  uploadType, 
  onClose, 
  onSuccess,
  isUploading,
  setIsUploading 
}) => {
  const { t } = useLanguage();
  
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
        message.success(`✅ ${t('eformDesigner.wordUploadSuccess')}`);
        onSuccess(result.htmlContent, result.formName || t('eformDesigner.formCreatedFromWord'));
        onClose();
      } else {
        message.error(`❌ ${t('eformDesigner.uploadFailed')}${result.error || t('eformDesigner.unknownError')}`);
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      if (error.name === 'AbortError') {
        message.error(`❌ ${t('eformDesigner.requestTimeoutWordFileConversion')}`);
      } else {
        message.error(`❌ ${t('eformDesigner.uploadFailed')}${error.message}`);
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
        message.success(`✅ ${t('eformDesigner.excelUploadSuccess')}`);
        onSuccess(result.htmlContent, result.formName || t('eformDesigner.formCreatedFromExcel'));
        onClose();
      } else {
        message.error(`❌ ${t('eformDesigner.uploadFailed')}${result.error || t('eformDesigner.unknownError')}`);
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      if (error.name === 'AbortError') {
        message.error(`❌ ${t('eformDesigner.requestTimeoutExcelFileConversion')}`);
      } else {
        message.error(`❌ ${t('eformDesigner.uploadFailed')}${error.message}`);
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
        message.success(`✅ ${t('eformDesigner.pdfUploadSuccess')}`);
        onSuccess(result.htmlContent, result.formName || t('eformDesigner.formCreatedFromPdf'));
        onClose();
      } else {
        message.error(`❌ ${t('eformDesigner.uploadFailed')}${result.error || t('eformDesigner.unknownError')}`);
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      if (error.name === 'AbortError') {
        message.error(`❌ ${t('eformDesigner.requestTimeoutPdfFileConversion')}`);
      } else {
        message.error(`❌ ${t('eformDesigner.uploadFailed')}${error.message}`);
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

      if (result.success) {
        message.success(`✅ ${t('eformDesigner.imageUploadSuccess')}`);
        // 使用 filePath 構建圖片 URL，因為後端返回的是 filePath
        const imageUrl = `/Uploads/FormsFiles/${result.fileName}`;
        const imageHtml = `<img src="${imageUrl}" alt="${file.name}" style="max-width: 100%; height: auto;" />`;
        onSuccess(imageHtml, null, true); // 第三個參數表示是圖片插入
        onClose();
      } else {
        message.error(`❌ ${t('eformDesigner.uploadFailed')}${result.error || t('eformDesigner.unknownError')}`);
      }
    } catch (error) {
      console.error('❌ 上傳錯誤:', error);
      if (error.name === 'AbortError') {
        message.error(`❌ ${t('eformDesigner.requestTimeoutImageUpload')}`);
      } else {
        message.error(`❌ ${t('eformDesigner.uploadFailed')}${error.message}`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const getUploadConfig = () => {
    switch (uploadType) {
      case 'word':
        return {
          title: t('eformDesigner.createFormFromWordFile'),
          icon: <FileWordOutlined style={{ color: '#1890ff' }} />,
          accept: '.doc,.docx',
          description: t('eformDesigner.uploadWordFileDescription'),
          alertType: 'info',
          uploadHandler: handleWordUpload,
          fileTypes: t('eformDesigner.supportsDocAndDocxFormats'),
          dragText: t('eformDesigner.clickOrDragWordFileHere'),
          processingText: t('eformDesigner.processingWordFile')
        };
      case 'excel':
        return {
          title: t('eformDesigner.createFormFromExcelFile'),
          icon: <FileExcelOutlined style={{ color: '#52c41a' }} />,
          accept: '.xls,.xlsx',
          description: t('eformDesigner.uploadExcelFileDescription'),
          alertType: 'success',
          uploadHandler: handleExcelUpload,
          fileTypes: t('eformDesigner.supportsXlsAndXlsxFormats'),
          dragText: t('eformDesigner.clickOrDragExcelFileHere'),
          processingText: t('eformDesigner.processingExcelFile')
        };
      case 'pdf':
        return {
          title: t('eformDesigner.createFormFromPdfFile'),
          icon: <FilePdfOutlined style={{ color: '#ff4d4f' }} />,
          accept: '.pdf',
          description: t('eformDesigner.uploadPdfFileDescription'),
          alertType: 'warning',
          uploadHandler: handlePdfUpload,
          fileTypes: t('eformDesigner.supportsPdfFormat'),
          dragText: t('eformDesigner.clickOrDragPdfFileHere'),
          processingText: t('eformDesigner.processingPdfFile')
        };
      case 'image':
        return {
          title: t('eformDesigner.imageUpload'),
          icon: <FileImageOutlined style={{ color: '#722ed1' }} />,
          accept: '.jpg,.jpeg,.png,.gif,.bmp,.webp',
          description: t('eformDesigner.uploadImageDescription'),
          alertType: 'info',
          uploadHandler: handleImageUpload,
          fileTypes: t('eformDesigner.supportsJpgPngGifBmpWebpFormats'),
          dragText: t('eformDesigner.clickOrDragImageHere'),
          processingText: t('eformDesigner.uploadingImage')
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
              {isUploading ? config.processingText : config.dragText}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {config.fileTypes}
            </div>
          </div>
        </Upload.Dragger>
        
        {isUploading && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '8px', color: '#666' }}>
              {config.processingText}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EFormDesignerUpload; 