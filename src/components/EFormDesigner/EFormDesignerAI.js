import React, { useState } from 'react';
import { Modal, Input, Button, Alert, Spin, Switch, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const EFormDesignerAI = ({ 
  visible, 
  onClose, 
  onSuccess,
  htmlContent,
  isGenerating,
  setIsGenerating 
}) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [includeCurrentHtml, setIncludeCurrentHtml] = useState(() => {
    const initialContent = htmlContent || '';
    return initialContent.trim().length > 0;
  });

  const handleAiGenerateForm = async () => {
    if (!aiPrompt.trim()) {
      message.warning('請輸入您的需求描述');
      return;
    }

    setIsGenerating(true);
    try {
      const requestData = {
        prompt: aiPrompt.trim(),
        includeCurrentHtml: includeCurrentHtml
      };

      if (includeCurrentHtml && htmlContent.trim()) {
        requestData.CurrentHtml = htmlContent.trim();
        console.log('📤 傳送當前 HTML 內容給 AI:', htmlContent.substring(0, 200) + '...');
      } else {
        console.log('📤 不包含當前 HTML，生成全新表單');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

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
        onSuccess(result.htmlContent, result.formName || 'AI 生成的表單');
        setAiPrompt('');
        onClose();
      } else {
        message.error('❌ 生成失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ AI 生成錯誤:', error);
      if (error.name === 'AbortError') {
        message.error('❌ 請求超時，AI 生成需要較長時間，請稍後再試或檢查網絡連接');
      } else {
        message.error('❌ 生成失敗: ' + error.message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RobotOutlined style={{ color: '#1890ff' }} />
          AI 生成表單
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="generate"
          type="primary"
          onClick={handleAiGenerateForm}
          loading={isGenerating}
          disabled={!aiPrompt.trim()}
        >
          {isGenerating ? '生成中...' : '生成表單'}
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
          <TextArea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="例如：我需要一個請假申請表單，包含員工信息、請假類型、開始日期、結束日期、請假原因等欄位..."
            rows={6}
            style={{ fontSize: '14px' }}
          />
        </div>

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
        
        {isGenerating && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '8px', color: '#666' }}>
              AI 正在生成表單，請稍候...
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EFormDesignerAI; 