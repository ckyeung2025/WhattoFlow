import React, { useEffect } from 'react';
import { Modal, Form, Input, Switch, InputNumber, Typography, Divider, Alert, Space, Checkbox, Select, Button, Spin } from 'antd';

const { TextArea } = Input;
const { Paragraph, Text } = Typography;

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
        apiKey: ''
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
      } catch (error) {
        // normalizeJson throws "invalid" when JSON parsing失敗
        return;
      }

      onSubmit(normalizedValues);
    });
  };

  const supportedModels = React.useMemo(() => {
    if (!provider?.supportedModels) {
      return [];
    }

    try {
      const parsed = JSON.parse(provider.supportedModels);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to parse supported models', error);
    }

    return [];
  }, [provider]);

  const isAiCategory = provider?.category === 'AI';

  const handleResetSettings = () => {
    if (provider?.defaultSettingsJson) {
      form.setFieldsValue({ settingsJson: formatJson(provider.defaultSettingsJson) });
    } else {
      form.setFieldsValue({ settingsJson: '' });
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
                {provider.description || t('apiProviders.noDescription')}
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

            <Form.Item name="apiUrl" label={t('apiProviders.form.apiUrl')} rules={[{ required: true, message: t('apiProviders.form.apiUrlRequired') }]}> 
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
                      options={supportedModels.map(model => ({ value: model, label: model }))}
                      placeholder={provider.defaultModel || t('apiProviders.form.modelPlaceholder')}
                      allowClear
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

            <Form.Item label={t('apiProviders.form.authConfigJson')} tooltip={t('apiProviders.form.authConfigTip')}>
              <Form.Item name="authConfigJson" noStyle>
                <TextArea rows={3} placeholder='{ "tenantId": "...", "clientId": "..." }' allowClear />
              </Form.Item>
            </Form.Item>

            <Form.Item label={t('apiProviders.form.settingsJson')} tooltip={t('apiProviders.form.settingsJsonTip')}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Form.Item name="settingsJson" noStyle>
                  <TextArea rows={4} placeholder='{ "temperature": 0.8 }' allowClear />
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
          </Form>
          </Space>
        )}
      </Spin>
    </Modal>
  );
};

export default ApiProviderSettingsModal;

