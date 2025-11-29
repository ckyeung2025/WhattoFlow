import React, { useEffect } from 'react';
import { Modal, Form, Input, Switch, InputNumber, Typography, Divider, Alert, Space, Checkbox, Select, Button, Spin, message } from 'antd';
import { MailOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Paragraph, Text } = Typography;

// 圖檔圖標組件（支持圖片的標記）
const ImageFileIcon = ({ style = {} }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 640 640" 
    style={{ 
      width: '14px', 
      height: '14px', 
      display: 'inline-block',
      verticalAlign: 'middle',
      marginLeft: '4px',
      ...style 
    }}
  >
    <path 
      d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96zM224 176C250.5 176 272 197.5 272 224C272 250.5 250.5 272 224 272C197.5 272 176 250.5 176 224C176 197.5 197.5 176 224 176zM368 288C376.4 288 384.1 292.4 388.5 299.5L476.5 443.5C481 450.9 481.2 460.2 477 467.8C472.8 475.4 464.7 480 456 480L184 480C175.1 480 166.8 475 162.7 467.1C158.6 459.2 159.2 449.6 164.3 442.3L220.3 362.3C224.8 355.9 232.1 352.1 240 352.1C247.9 352.1 255.2 355.9 259.7 362.3L286.1 400.1L347.5 299.6C351.9 292.5 359.6 288.1 368 288.1z" 
      fill="currentColor"
    />
  </svg>
);

const ApiProviderSettingsModal = ({
  open,
  provider,
  onCancel,
  onSubmit,
  loading,
  fetching,
  t
}) => {
  const [form] = Form.useForm();

  const formatJson = React.useCallback((value) => {
    if (!value || typeof value !== 'string') {
      return '';
    }

    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return value;
    }
  }, []);

  const normalizeJson = React.useCallback((value) => {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }

    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed);
    } catch (error) {
      throw new Error('invalid');
    }
  }, []);

  const authTypeOptions = React.useMemo(() => ([
    { value: 'apiKey', label: t('apiProviders.form.authTypeOptions.apiKey') },
    { value: 'bearerToken', label: t('apiProviders.form.authTypeOptions.bearerToken') },
    { value: 'serviceAccount', label: t('apiProviders.form.authTypeOptions.serviceAccount') },
    { value: 'oauth', label: t('apiProviders.form.authTypeOptions.oauth') }
  ]), [t]);

  useEffect(() => {
    if (provider) {
      // Debug log for verifying provider payload passed into modal
      // eslint-disable-next-line no-console
      console.log('[ApiProviderSettingsModal] received provider', provider);

      const settingsJson = formatJson(provider.settingsJson || provider.defaultSettingsJson || '');
      const extraHeadersJson = formatJson(provider.extraHeadersJson);
      const authConfigJson = formatJson(provider.authConfigJson);

      // 解析 authConfigJson 為獨立欄位（用於 Email Server）
      let tenantId = '';
      let clientId = '';
      let clientSecret = '';
      if (authConfigJson) {
        try {
          const parsed = JSON.parse(authConfigJson);
          tenantId = parsed.tenantId || '';
          clientId = parsed.clientId || '';
          clientSecret = parsed.clientSecret || '';
        } catch (e) {
          // 忽略解析錯誤
        }
      }

      // 解析 settingsJson 為獨立欄位（用於 Email Server）
      let fromEmail = '';
      let replyTo = '';
      let saveToSentItems = true;
      if (settingsJson) {
        try {
          const parsed = JSON.parse(settingsJson);
          fromEmail = parsed.fromEmail || '';
          replyTo = parsed.replyTo || '';
          saveToSentItems = parsed.saveToSentItems !== undefined ? parsed.saveToSentItems : true;
        } catch (e) {
          // 忽略解析錯誤
        }
      }

      form.setFieldsValue({
        active: provider.active,
        apiUrl: provider.apiUrl,
        model: provider.model,
        temperature: provider.temperature,
        topP: provider.topP,
        enableStreaming: provider.enableStreaming,
        extraHeadersJson,
        authType: provider.authType || provider.defaultAuthType || 'apiKey',
        authConfigJson,
        settingsJson,
        clearApiKey: false,
        apiKey: '',
        // Email Server 專用欄位
        tenantId,
        clientId,
        clientSecret,
        fromEmail,
        replyTo,
        saveToSentItems
      });
    } else {
      form.resetFields();
    }
  }, [provider, form, formatJson]);

  const validateJsonField = React.useCallback((fieldName, value) => {
    if (!value || value.trim().length === 0) {
      form.setFields([{ name: fieldName, errors: [] }]);
      return true;
    }

    try {
      JSON.parse(value);
      form.setFields([{ name: fieldName, errors: [] }]);
      return true;
    } catch (error) {
      form.setFields([{ name: fieldName, errors: [t('apiProviders.form.jsonInvalid')] }]);
      return false;
    }
  }, [form, t]);

  const handleOk = () => {
    form.validateFields().then(values => {
      // 如果是 Email Server 類型，從獨立欄位構建 JSON
      if (isEmailServerCategory) {
        // 構建 authConfigJson
        const authConfig = {
          tenantId: values.tenantId || '',
          clientId: values.clientId || '',
          clientSecret: values.clientSecret || ''
        };
        values.authConfigJson = JSON.stringify(authConfig);

        // 構建 settingsJson
        const settings = {
          fromEmail: values.fromEmail || '',
          replyTo: values.replyTo || '',
          saveToSentItems: values.saveToSentItems !== undefined ? values.saveToSentItems : true
        };
        values.settingsJson = JSON.stringify(settings);
      }

      const targets = [
        ['extraHeadersJson', values.extraHeadersJson],
        ['authConfigJson', values.authConfigJson],
        ['settingsJson', values.settingsJson]
      ];

      for (const [field, content] of targets) {
        if (!validateJsonField(field, content)) {
          return;
        }
      }

      let normalizedValues;

      try {
        normalizedValues = {
          ...values,
          extraHeadersJson: normalizeJson(values.extraHeadersJson),
          authConfigJson: normalizeJson(values.authConfigJson),
          settingsJson: normalizeJson(values.settingsJson)
        };
        // 移除臨時欄位，只保留後端需要的欄位
        delete normalizedValues.tenantId;
        delete normalizedValues.clientId;
        delete normalizedValues.clientSecret;
        delete normalizedValues.fromEmail;
        delete normalizedValues.replyTo;
        delete normalizedValues.saveToSentItems;
      } catch (error) {
        // normalizeJson throws "invalid" when JSON parsing失敗
        return;
      }

      onSubmit(normalizedValues);
    }).catch(error => {
      // 處理表單驗證錯誤
      if (error?.errorFields) {
        // Ant Design 驗證錯誤，已經在表單中顯示錯誤訊息，不需要額外處理
        // 這裡只是為了避免未捕獲的錯誤導致頁面崩潰
        return;
      }
      // 其他未預期的錯誤
      console.error('Unexpected error during form validation:', error);
    });
  };

  // xAI (Grok) 所有可用模型列表（根據官方文檔）
  const xaiAllModels = React.useMemo(() => [
    { value: 'grok-code-fast-1', label: 'grok-code-fast-1', supportsVision: false },
    { value: 'grok-4-fast-reasoning', label: 'grok-4-fast-reasoning', supportsVision: true },
    { value: 'grok-4-fast-non-reasoning', label: 'grok-4-fast-non-reasoning', supportsVision: true },
    { value: 'grok-4-0709', label: 'grok-4-0709', supportsVision: true },
    { value: 'grok-3-mini', label: 'grok-3-mini', supportsVision: false },
    { value: 'grok-3', label: 'grok-3', supportsVision: false },
    { value: 'grok-2-vision-1212', label: 'grok-2-vision-1212', supportsVision: true },
    { value: 'grok-2-1212', label: 'grok-2-1212', supportsVision: false }
  ], []);

  const supportedModels = React.useMemo(() => {
    // 如果是 xai provider，返回所有可用模型
    if (provider?.providerKey === 'xai') {
      return xaiAllModels.map(model => ({
        value: model.value,
        label: model.supportsVision ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {model.label}
            <ImageFileIcon style={{ color: '#1890ff' }} />
          </span>
        ) : model.label,
        // 添加 searchText 用於搜索過濾
        searchText: model.label
      }));
    }

    // 其他 provider 從 supportedModels 讀取
    if (!provider?.supportedModels) {
      return [];
    }

    try {
      const parsed = JSON.parse(provider.supportedModels);
      if (Array.isArray(parsed)) {
        return parsed.map(model => ({ value: model, label: model }));
      }
    } catch (error) {
      console.warn('Failed to parse supported models', error);
    }

    return [];
  }, [provider, xaiAllModels]);

  const isAiCategory = provider?.category === 'AI';
  const isEmailServerCategory = provider?.category === 'EmailServer';
  const [testingEmail, setTestingEmail] = React.useState(false);
  const [testEmailModalOpen, setTestEmailModalOpen] = React.useState(false);
  const [testEmailForm] = Form.useForm();

  const handleResetSettings = () => {
    if (provider?.defaultSettingsJson) {
      form.setFieldsValue({ settingsJson: formatJson(provider.defaultSettingsJson) });
    } else {
      form.setFieldsValue({ settingsJson: '' });
    }
  };

  const handleTestEmailClick = async () => {
    try {
      // 先驗證基本配置欄位
      await form.validateFields([
        'tenantId',
        'clientId',
        'clientSecret',
        'fromEmail'
      ]);

      // 設置測試郵件表單的預設值
      const formValues = form.getFieldsValue();
      testEmailForm.setFieldsValue({
        toEmail: formValues.fromEmail, // 預設發給自己
        subject: t('apiProviders.form.testEmailSubject'),
        body: t('apiProviders.form.testEmailBody')
      });

      // 打開測試郵件彈窗
      setTestEmailModalOpen(true);
    } catch (error) {
      if (error.errorFields) {
        message.error(t('apiProviders.form.testEmailValidationError'));
      }
    }
  };

  const handleTestEmailSubmit = async () => {
    try {
      const testValues = await testEmailForm.validateFields();
      const formValues = form.getFieldsValue();

      setTestingEmail(true);
      setTestEmailModalOpen(false);

      const token = localStorage.getItem('token');
      if (!token) {
        message.error(t('common.loginRequired'));
        return;
      }

      // 構建測試請求
      const testRequest = {
        tenantId: formValues.tenantId,
        clientId: formValues.clientId,
        clientSecret: formValues.clientSecret,
        fromEmail: formValues.fromEmail,
        replyTo: formValues.replyTo || formValues.fromEmail,
        toEmail: testValues.toEmail,
        subject: testValues.subject,
        body: testValues.body
      };

      const response = await fetch(`/api/apiproviders/test-email/${provider.providerKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(testRequest)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t('apiProviders.form.testEmailFailed'));
      }

      message.success(t('apiProviders.form.testEmailSuccess'));
      testEmailForm.resetFields();
    } catch (error) {
      console.error('Test email failed:', error);
      if (error.errorFields) {
        // 表單驗證錯誤
        message.error(t('apiProviders.form.testEmailValidationError'));
        setTestEmailModalOpen(true); // 保持彈窗打開
      } else {
        message.error(error.message || t('apiProviders.form.testEmailFailed'));
      }
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      okButtonProps={{ disabled: fetching || !provider }}
      title={provider ? t('apiProviders.modal.title', { name: provider.displayName }) : t('apiProviders.modal.loadingTitle')}
      okText={t('apiProviders.modal.save')}
      cancelText={t('apiProviders.modal.cancel')}
      width={640}
    >
      <Spin spinning={fetching} tip={t('common.loading')}>
        {provider && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            message={provider.displayName}
            description={
              <Paragraph style={{ marginBottom: 0 }}>
                {t(`apiProviders.description.${provider.providerKey}`, provider.description) || provider.description || t('apiProviders.noDescription')}
              </Paragraph>
            }
            showIcon
          />

          <div className="api-provider-modal__defaults">
            <Paragraph>
              <Text strong>{t('apiProviders.modal.defaultUrl')}:</Text>
              <br />
              <Text code>{provider.defaultApiUrl}</Text>
            </Paragraph>
            {provider.defaultModel && (
              <Paragraph>
                <Text strong>{t('apiProviders.modal.defaultModel')}:</Text>
                <br />
                <Text code>{provider.defaultModel}</Text>
              </Paragraph>
            )}
          </div>

          <Divider />

          <Form
            layout="vertical"
            form={form}
            requiredMark={false}
          >
            <Form.Item name="active" label={t('apiProviders.form.active')} valuePropName="checked">
              <Switch checkedChildren={t('apiProviders.status.active')} unCheckedChildren={t('apiProviders.status.inactive')} />
            </Form.Item>

            <Form.Item 
              name="apiUrl" 
              label={t('apiProviders.form.apiUrl')} 
              rules={[{ required: true, message: t('apiProviders.form.apiUrlRequired') }]}
              tooltip={isEmailServerCategory ? t('apiProviders.form.apiUrlEmailServerTip') : undefined}
            > 
              <Input placeholder={provider.defaultApiUrl} />
            </Form.Item>

            <Form.Item name="authType" label={t('apiProviders.form.authType')} tooltip={t('apiProviders.form.authTypeTip')}>
              <Select
                options={authTypeOptions}
                placeholder={t('apiProviders.form.authTypePlaceholder')}
                allowClear
              />
            </Form.Item>

            {isAiCategory && (
              <>
                {supportedModels.length > 0 ? (
                  <Form.Item name="model" label={t('apiProviders.form.model')} rules={[{ required: true, message: t('apiProviders.form.modelRequired') }]}> 
                    <Select
                      options={supportedModels}
                      placeholder={provider.defaultModel || t('apiProviders.form.modelPlaceholder')}
                      allowClear
                      showSearch
                      filterOption={(input, option) => {
                        // 如果 option 有 searchText，使用它；否則嘗試從 label 提取文本
                        const searchText = option?.searchText || 
                          (typeof option?.label === 'string' ? option.label : option?.value || '');
                        return searchText.toLowerCase().includes(input.toLowerCase());
                      }}
                    />
                  </Form.Item>
                ) : (
                  <Form.Item name="model" label={t('apiProviders.form.model')}>
                    <Input placeholder={provider.defaultModel || t('apiProviders.form.modelPlaceholder')} />
                  </Form.Item>
                )}

                <Form.Item name="temperature" label={t('apiProviders.form.temperature')} tooltip={t('apiProviders.form.temperatureTip')}>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={provider.temperatureMin ?? 0}
                    max={provider.temperatureMax ?? 2}
                    step={0.1}
                  />
                </Form.Item>

                <Form.Item name="topP" label={t('apiProviders.form.topP')} tooltip={t('apiProviders.form.topPTip')}>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </Form.Item>

                <Form.Item name="enableStreaming" label={t('apiProviders.form.enableStreaming')} valuePropName="checked">
                  <Switch disabled={!provider.definitionEnableStreaming} />
                </Form.Item>
              </>
            )}

            <Form.Item label={t('apiProviders.form.apiKey')}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {provider.hasApiKey && (
                  <Text type="secondary">{t('apiProviders.form.maskedKey', { key: provider.maskedApiKey })}</Text>
                )}
                <Form.Item name="apiKey" noStyle>
                  <Input.Password placeholder={t('apiProviders.form.apiKeyPlaceholder')} visibilityToggle allowClear />
                </Form.Item>
                {provider.hasApiKey && (
                  <Form.Item name="clearApiKey" valuePropName="checked" noStyle>
                    <Checkbox>{t('apiProviders.form.clearApiKey')}</Checkbox>
                  </Form.Item>
                )}
              </Space>
            </Form.Item>

            <Form.Item label={t('apiProviders.form.extraHeaders')} tooltip={t('apiProviders.form.extraHeadersTip')}>
              <Form.Item name="extraHeadersJson" noStyle>
                <TextArea rows={3} placeholder='{ "X-Custom-Header": "value" }' allowClear />
              </Form.Item>
            </Form.Item>

            {isEmailServerCategory ? (
              <>
                <Divider orientation="left">{t('apiProviders.form.oauthConfig')}</Divider>
                <Form.Item 
                  name="tenantId" 
                  label={t('apiProviders.form.tenantId')}
                  rules={[{ required: true, message: t('apiProviders.form.tenantIdRequired') }]}
                  tooltip={t('apiProviders.form.tenantIdTip')}
                >
                  <Input placeholder="your-tenant-id" allowClear />
                </Form.Item>

                <Form.Item 
                  name="clientId" 
                  label={t('apiProviders.form.clientId')}
                  rules={[{ required: true, message: t('apiProviders.form.clientIdRequired') }]}
                  tooltip={t('apiProviders.form.clientIdTip')}
                >
                  <Input placeholder="your-client-id" allowClear />
                </Form.Item>

                <Form.Item 
                  name="clientSecret" 
                  label={t('apiProviders.form.clientSecret')}
                  rules={[{ required: true, message: t('apiProviders.form.clientSecretRequired') }]}
                  tooltip={t('apiProviders.form.clientSecretTip')}
                >
                  <Input.Password placeholder="your-client-secret" visibilityToggle allowClear />
                </Form.Item>

                <Divider orientation="left">{t('apiProviders.form.emailSettings')}</Divider>
                <Form.Item 
                  name="fromEmail" 
                  label={t('apiProviders.form.fromEmail')}
                  rules={[
                    { required: true, message: t('apiProviders.form.fromEmailRequired') },
                    { type: 'email', message: t('apiProviders.form.fromEmailInvalid') }
                  ]}
                  tooltip={t('apiProviders.form.fromEmailTip')}
                >
                  <Input placeholder="sender@example.com" allowClear />
                </Form.Item>

                <Form.Item 
                  name="replyTo" 
                  label={t('apiProviders.form.replyTo')}
                  rules={[{ type: 'email', message: t('apiProviders.form.replyToInvalid') }]}
                  tooltip={t('apiProviders.form.replyToTip')}
                >
                  <Input placeholder="reply@example.com" allowClear />
                </Form.Item>

                <Form.Item 
                  name="saveToSentItems" 
                  label={t('apiProviders.form.saveToSentItems')} 
                  valuePropName="checked"
                  tooltip={t('apiProviders.form.saveToSentItemsTip')}
                >
                  <Switch checkedChildren={t('apiProviders.form.enabled')} unCheckedChildren={t('apiProviders.form.disabled')} />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    icon={<MailOutlined />}
                    onClick={handleTestEmailClick}
                    loading={testingEmail}
                    block
                  >
                    {t('apiProviders.form.testEmail')}
                  </Button>
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item 
                  label={t('apiProviders.form.authConfigJson')} 
                  tooltip={t('apiProviders.form.authConfigTip')}
                >
                  <Form.Item name="authConfigJson" noStyle>
                    <TextArea 
                      rows={3} 
                      placeholder='{ "tenantId": "...", "clientId": "..." }' 
                      allowClear 
                    />
                  </Form.Item>
                </Form.Item>

                <Form.Item 
                  label={t('apiProviders.form.settingsJson')} 
                  tooltip={t('apiProviders.form.settingsJsonTip')}
                >
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <Form.Item name="settingsJson" noStyle>
                      <TextArea 
                        rows={4} 
                        placeholder='{ "temperature": 0.8 }' 
                        allowClear 
                      />
                    </Form.Item>
                    <Space size="small">
                      <Button size="small" onClick={handleResetSettings} disabled={!provider?.defaultSettingsJson}>
                        {t('apiProviders.form.resetSettings')}
                      </Button>
                      {provider?.defaultSettingsJson && (
                        <Text type="secondary">{t('apiProviders.form.resetSettingsHint')}</Text>
                      )}
                    </Space>
                  </Space>
                </Form.Item>
              </>
            )}
          </Form>
          </Space>
        )}
      </Spin>

      {/* 測試郵件彈窗 */}
      <Modal
        open={testEmailModalOpen}
        onCancel={() => {
          setTestEmailModalOpen(false);
          testEmailForm.resetFields();
        }}
        onOk={handleTestEmailSubmit}
        confirmLoading={testingEmail}
        title={t('apiProviders.form.testEmailModalTitle')}
        okText={t('apiProviders.form.sendTestEmail')}
        cancelText={t('apiProviders.modal.cancel')}
        width={600}
      >
        <Form
          form={testEmailForm}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="toEmail"
            label={t('apiProviders.form.testEmailTo')}
            rules={[
              { required: true, message: t('apiProviders.form.testEmailToRequired') },
              { type: 'email', message: t('apiProviders.form.testEmailToInvalid') }
            ]}
            tooltip={t('apiProviders.form.testEmailToTip')}
          >
            <Input placeholder="recipient@example.com" allowClear />
          </Form.Item>

          <Form.Item
            name="subject"
            label={t('apiProviders.form.testEmailSubjectLabel')}
            rules={[{ required: true, message: t('apiProviders.form.testEmailSubjectRequired') }]}
          >
            <Input placeholder={t('apiProviders.form.testEmailSubject')} allowClear />
          </Form.Item>

          <Form.Item
            name="body"
            label={t('apiProviders.form.testEmailBodyLabel')}
            rules={[{ required: true, message: t('apiProviders.form.testEmailBodyRequired') }]}
          >
            <TextArea
              rows={6}
              placeholder={t('apiProviders.form.testEmailBody')}
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
};

export default ApiProviderSettingsModal;

