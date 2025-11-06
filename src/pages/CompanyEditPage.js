import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Form, Input, Avatar, Button, message, Upload, Tooltip, Card, Row, Col, Typography, Modal, Divider, Tag, Space, Tabs, Alert } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, SafetyOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';
import zhTC from '../locales/zh-TC';
import en from '../locales/en';

const CompanyEditPage = () => {
  const [form] = Form.useForm();
  const [logoUrl, setLogoUrl] = useState('');
  const [originalData, setOriginalData] = useState(null); // 保存原始數據，用於確保未進入的 tab 字段不會丟失
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const navigate = useNavigate();
  const { Title } = Typography;
  const { currentLanguage, t } = useLanguage();
  const locale = currentLanguage === 'zh-TC' ? zhTC.companyEdit : en.companyEdit;

  useEffect(() => {
    if (!id) return;
    fetch(`/api/companies/${id}`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    })
      .then(res => res.json())
      .then(data => {
        // 保存原始數據
        setOriginalData(data);
        setTimeout(() => {
          form.setFieldsValue({
            name: data.name,
            email: data.email,
            address: data.address,
            phone: data.phone,
            website: data.website,
            wA_API_Key: data.wA_API_Key,
            wA_PhoneNo_ID: data.wA_PhoneNo_ID,
            wA_Business_Account_ID: data.wA_Business_Account_ID,
            wA_VerifyToken: data.wA_VerifyToken,
            wA_WebhookToken: data.wA_WebhookToken,
            wA_WebhookUrl: data.wA_WebhookToken ? `${window.location.origin}/api/MetaWebhook/${data.wA_WebhookToken}` : '',
            // WhatsApp 菜單設置
            wA_WelcomeMessage: data.wA_WelcomeMessage,
            wA_NoFunctionMessage: data.wA_NoFunctionMessage,
            wA_MenuTitle: data.wA_MenuTitle,
            wA_MenuFooter: data.wA_MenuFooter,
            wA_MenuButton: data.wA_MenuButton,
            wA_SectionTitle: data.wA_SectionTitle,
            wA_DefaultOptionDescription: data.wA_DefaultOptionDescription,
            wA_InputErrorMessage: data.wA_InputErrorMessage,
            wA_FallbackMessage: data.wA_FallbackMessage,
            wA_SystemErrorMessage: data.wA_SystemErrorMessage,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            logoUrl: data.logoUrl,
          });
          setLogoUrl(data.logoUrl || '');
        }, 0);
      });
  }, [form, id]);

  // 監聽 Webhook Token 變化，自動更新 URL
  useEffect(() => {
    const webhookToken = form.getFieldValue('wA_WebhookToken');
    if (webhookToken) {
      const webhookUrl = `${window.location.origin}/api/MetaWebhook/${webhookToken}`;
      form.setFieldsValue({ wA_WebhookUrl: webhookUrl });
    }
  }, [form.getFieldValue('wA_WebhookToken')]);

  const handleSave = async () => {
    try {
      const formValues = form.getFieldsValue();
      
      // 合併原始數據，確保未進入過的 tab 的字段不會丟失
      // 優先使用表單中的值（已修改的），如果沒有則使用原始數據的值
      const values = {
        // 基本資料
        name: formValues.name ?? originalData?.name,
        email: formValues.email ?? originalData?.email,
        address: formValues.address ?? originalData?.address,
        phone: formValues.phone ?? originalData?.phone,
        website: formValues.website ?? originalData?.website,
        logoUrl: logoUrl,
        
        // API 設置
        wA_API_Key: formValues.wA_API_Key ?? originalData?.wA_API_Key,
        wA_PhoneNo_ID: formValues.wA_PhoneNo_ID ?? originalData?.wA_PhoneNo_ID,
        wA_Business_Account_ID: formValues.wA_Business_Account_ID ?? originalData?.wA_Business_Account_ID,
        wA_VerifyToken: formValues.wA_VerifyToken ?? originalData?.wA_VerifyToken,
        wA_WebhookToken: formValues.wA_WebhookToken ?? originalData?.wA_WebhookToken,
        
        // WhatsApp 菜單設置 - 確保這些字段不會因為未進入 tab 而丟失
        wA_WelcomeMessage: formValues.wA_WelcomeMessage ?? originalData?.wA_WelcomeMessage,
        wA_NoFunctionMessage: formValues.wA_NoFunctionMessage ?? originalData?.wA_NoFunctionMessage,
        wA_MenuTitle: formValues.wA_MenuTitle ?? originalData?.wA_MenuTitle,
        wA_MenuFooter: formValues.wA_MenuFooter ?? originalData?.wA_MenuFooter,
        wA_MenuButton: formValues.wA_MenuButton ?? originalData?.wA_MenuButton,
        wA_SectionTitle: formValues.wA_SectionTitle ?? originalData?.wA_SectionTitle,
        wA_DefaultOptionDescription: formValues.wA_DefaultOptionDescription ?? originalData?.wA_DefaultOptionDescription,
        wA_InputErrorMessage: formValues.wA_InputErrorMessage ?? originalData?.wA_InputErrorMessage,
        wA_FallbackMessage: formValues.wA_FallbackMessage ?? originalData?.wA_FallbackMessage,
        wA_SystemErrorMessage: formValues.wA_SystemErrorMessage ?? originalData?.wA_SystemErrorMessage,
      };
      
      await fetch(`/api/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
        body: JSON.stringify(values)
      });
      message.success(t('companyEdit.saveSuccess'));
      navigate('/company-user-admin');
    } catch {
      message.error(t('companyEdit.saveFailed'));
    }
  };

  // 驗證 Token 權限
  const handleValidateToken = async () => {
    try {
      // 獲取表單中當前的值
      const waApiKey = form.getFieldValue('wA_API_Key');
      const waBusinessAccountId = form.getFieldValue('wA_Business_Account_ID');
      const waPhoneNoId = form.getFieldValue('wA_PhoneNo_ID');

      // 驗證必填欄位
      if (!waApiKey) {
        message.warning(t('companyEdit.apiKeyRequired'));
        return;
      }

      if (!waBusinessAccountId) {
        message.warning(t('companyEdit.businessAccountIdRequired'));
        return;
      }

      message.loading(t('companyEdit.validateTokenLoading'), 0);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapptokenvalidation/validate-permissions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // 檢查 HTTP 狀態碼
      if (!response.ok) {
        message.destroy();
        const errorResult = await response.json();
        console.error('❌ Token 驗證 API 錯誤:', errorResult);
        
        Modal.error({
          title: t('companyEdit.validateTokenError'),
          content: errorResult.error || errorResult.message || t('companyEdit.validateTokenErrorMsg')
        });
        return;
      }
      
      const result = await response.json();
      message.destroy();

      // 調試：打印 API 響應
      console.log('🔍 Token 驗證 API 響應:', result);

      if (result.success) {
        Modal.info({
          title: t('companyEdit.validateTokenCheckResult'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('companyEdit.tokenStatus')}</strong>{result.tokenValid ? t('companyEdit.tokenValid') : t('companyEdit.tokenInvalid')}</p>
              {result.company && <p><strong>{t('companyEdit.companyLabel')}</strong>{result.company.name}</p>}
              <Divider />
              
              {result.capabilities && (
                <>
                  <p><strong>{t('companyEdit.capabilitiesTitle')}</strong></p>
                  <ul>
                    <li>{t('companyEdit.sendMessageLabel')}{result.capabilities.canSendMessages ? t('companyEdit.available') : t('companyEdit.unavailable')}</li>
                    <li>{t('companyEdit.receiveWebhookLabel')}{result.capabilities.canReceiveWebhooks ? t('companyEdit.available') : t('companyEdit.unavailable')}</li>
                    <li>{t('companyEdit.manageTemplatesLabel')}{result.capabilities.canManageTemplates ? t('companyEdit.available') : t('companyEdit.unavailable')}</li>
                    <li>{t('companyEdit.createFlowLabel')}{result.capabilities.canCreateFlows ? t('companyEdit.available') : t('companyEdit.unavailable')}</li>
                  </ul>
                  <Divider />
                </>
              )}
              
              {result.permissions && result.permissions.length > 0 && (
                <>
                  <p><strong>{t('companyEdit.permissionsTitle')}</strong></p>
                  <ul>
                    {result.permissions.map((p, i) => (
                      <li key={i}>
                        {p.permission}: <Tag color={p.status === 'granted' ? 'green' : 'red'}>{p.status}</Tag>
                      </li>
                    ))}
                  </ul>
                  <Divider />
                </>
              )}
              
              {result.recommendations && result.recommendations.length > 0 && (
                <>
                  <p><strong>{t('companyEdit.recommendationsTitle')}</strong></p>
                  <ul>
                    {result.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )
        });
      } else {
        Modal.error({
          title: t('companyEdit.validateTokenFailed'),
          content: result.error || t('companyEdit.permissionCheckFailed')
        });
      }
    } catch (error) {
      message.destroy();
      Modal.error({
        title: t('companyEdit.validateTokenError'),
        content: error.message || t('companyEdit.validateTokenCheckError')
      });
    }
  };

  // 上傳公司頭像
  const handleUpload = async ({ file }) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('/api/companies/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: 'Bearer ' + token
        }
      });
      if (res.data.url) {
        setLogoUrl(res.data.url);
        message.success(t('companyEdit.uploadSuccess'));
      } else {
        message.error(t('companyEdit.uploadFailed'));
      }
    } catch {
      message.error(t('companyEdit.uploadFailed'));
    }
  };

  return (
    <div style={{ 
      width: '100%',
      height: '100%',
      overflow: 'visible'
    }}>
      <div style={{ 
        maxWidth: 1100, 
        margin: '32px auto', 
        padding: '16px 16px 64px 16px',
        position: 'relative'
      }}>
      <Row gutter={[32, 16]} justify="center" align="top">
        {/* 左側：公司基本資料 */}
        <Col xs={24} md={15}>
          <Card
            style={{ borderRadius: 16, boxShadow: '0 2px 12px #eee', minHeight: 600 }}
            bodyStyle={{ padding: 32 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Upload
                showUploadList={false}
                customRequest={handleUpload}
                accept="image/*"
              >
                <Avatar
                  src={logoUrl}
                  size={96}
                  style={{ marginBottom: 8, cursor: 'pointer', background: '#f0f0f0' }}
                  icon={!logoUrl && <span style={{ fontSize: 48, color: '#bbb' }}>+</span>}
                />
                <div style={{ color: '#888', fontSize: 14, fontWeight: 500 }}>{t('companyEdit.uploadLogo')}</div>
              </Upload>
            </div>
            <Title level={5} style={{ textAlign: 'center', marginBottom: 24, letterSpacing: 2, color: '#7234CF' }}>{t('companyEdit.basicInfo')}</Title>
            <Form form={form} layout="vertical">
              <Form.Item name="name" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.name')}</span>}>
                <Input style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="email" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.email')}</span>}>
                <Input style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="address" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.address')}</span>}>
                <Input style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="phone" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.phone')}</span>}>
                <Input style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="website" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.website')}</span>}>
                <Input style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="createdAt" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.createdAt')}</span>}>
                <Input disabled style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="updatedAt" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.updatedAt')}</span>}>
                <Input disabled style={{ width: '100%' }} />
              </Form.Item>
            </Form>
          </Card>
        </Col>
        {/* 右側：WhatsApp 設定 */}
        <Col xs={24} md={9}>
          <Card
            style={{ 
              borderRadius: 16, 
              boxShadow: '0 2px 12px #eee',
              minHeight: 600
            }}
            bodyStyle={{ 
              padding: 24
            }}
          >
            <Title level={5} style={{ color: '#7234CF', marginBottom: 24, letterSpacing: 2 }}>{t('companyEdit.whatsappSetting')}</Title>
            
            <Tabs
              defaultActiveKey="1"
              items={[
                {
                  key: '1',
                  label: t('companyEdit.apiSettings'),
                  children: (
                    <Form form={form} layout="vertical" style={{ paddingRight: '8px' }}>
                      <Form.Item name="wA_API_Key" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.waApiKey')}</span>}>
                        <Input style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="wA_PhoneNo_ID" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.waPhoneNoId')}</span>}>
                        <Input style={{ width: '100%' }} placeholder={t('companyEdit.phoneNoIdPlaceholder')} />
                      </Form.Item>
                      <Form.Item name="wA_Business_Account_ID" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.waBusinessAccountId')}</span>}>
                        <Input 
                          style={{ width: '100%' }} 
                          placeholder={t('companyEdit.businessAccountIdPlaceholder')}
                          suffix={
                            <Tooltip title={t('companyEdit.waBusinessAccountIdTooltip')}>
                              <span style={{ color: '#666', fontSize: '12px' }}>{t('companyEdit.waBusinessAccountIdSuffix')}</span>
                            </Tooltip>
                          }
                        />
                      </Form.Item>
                      
                      {/* 重要警告提示 */}
                      <Alert
                        message={t('companyEdit.configWarningTitle')}
                        description={
                          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                            <div style={{ marginBottom: '4px' }}>
                              <strong>{t('companyEdit.configWarningDescription')}</strong>
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                              {t('companyEdit.configWarningPhoneIdUse')}
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                              {t('companyEdit.configWarningBusinessIdUse')}
                            </div>
                            <div style={{ color: '#ff4d4f', marginTop: '8px' }}>
                              {t('companyEdit.configWarningMismatchTitle')}
                              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                <li>{t('companyEdit.configWarningMismatchItem1')}</li>
                                <li>{t('companyEdit.configWarningMismatchItem2')}</li>
                              </ul>
                            </div>
                            <div style={{ marginTop: '8px', color: '#1890ff' }}>
                              {t('companyEdit.configWarningSolution')}
                            </div>
                          </div>
                        }
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16, marginTop: 8 }}
                      />
                      
                      {/* 驗證 Token 權限按鈕 */}
                      <Form.Item>
                        <Button 
                          icon={<SafetyOutlined />}
                          onClick={handleValidateToken}
                          style={{ width: '100%' }}
                          type="dashed"
                        >
                          {t('companyEdit.validateTokenButton')}
                        </Button>
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                          {t('companyEdit.validateTokenHint')}
                        </div>
                      </Form.Item>
                      
                      <Divider style={{ margin: '16px 0' }} />
                      
                      <Form.Item name="wA_VerifyToken" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.waVerifyToken')}</span>}>
                        <Input style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="wA_WebhookToken" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.webhookToken')}</span>}>
                        <Input 
                          style={{ width: '100%' }} 
                          placeholder={t('companyEdit.webhookTokenPlaceholder')}
                          suffix={
                            <Button 
                              type="text" 
                              size="small" 
                              onClick={() => {
                                const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                                form.setFieldsValue({ 
                                  wA_WebhookToken: newToken,
                                  wA_WebhookUrl: `${window.location.origin}/api/MetaWebhook/${newToken}`
                                });
                                message.success(t('companyEdit.tokenGenerated'));
                              }}
                            >
                              {t('companyEdit.regenerateToken')}
                            </Button>
                          }
                        />
                      </Form.Item>
                      <Form.Item name="wA_WebhookUrl" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.webhookUrl')}</span>}>
                        <Input 
                          style={{ width: '100%' }} 
                          placeholder={t('companyEdit.webhookUrlPlaceholder')}
                          suffix={
                            <Button 
                              type="text" 
                              size="small" 
                              onClick={() => {
                                const webhookUrl = form.getFieldValue('wA_WebhookUrl');
                                if (webhookUrl) {
                                  navigator.clipboard.writeText(webhookUrl);
                                  message.success(t('companyEdit.webhookUrlCopied'));
                                } else {
                                  message.error(t('companyEdit.generateTokenFirst'));
                                }
                              }}
                            >
                              {t('companyEdit.copyWebhookUrl')}
                            </Button>
                          }
                        />
                      </Form.Item>
                    </Form>
                  ),
                },
                {
                  key: '2',
                  label: t('companyEdit.chatbotMenuConfig'),
                  children: (
                    <Form form={form} layout="vertical" style={{ paddingRight: '8px' }}>
                      <div style={{ marginBottom: '16px', padding: '12px', background: '#f6f8fa', borderRadius: '6px', fontSize: '12px', color: '#666' }}>
                        💡 {t('companyEdit.menuConfigHint')}
                      </div>
                      
                      <Form.Item 
                        name="wA_WelcomeMessage" 
                        label={<span style={{ fontWeight: 600 }}>{t('companyEdit.welcomeMessage')}</span>}
                        tooltip={t('companyEdit.welcomeMessageTooltip')}
                      >
                        <Input.TextArea 
                          rows={3} 
                          placeholder={t('companyEdit.welcomeMessagePlaceholder')}
                          style={{ width: '100%' }} 
                        />
                      </Form.Item>

                      <Form.Item 
                        name="wA_NoFunctionMessage" 
                        label={<span style={{ fontWeight: 600 }}>{t('companyEdit.noFunctionMessage')}</span>}
                        tooltip={t('companyEdit.noFunctionMessageTooltip')}
                      >
                        <Input.TextArea 
                          rows={3} 
                          placeholder={t('companyEdit.noFunctionMessagePlaceholder')}
                          style={{ width: '100%' }} 
                        />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item 
                            name="wA_MenuTitle" 
                            label={<span style={{ fontWeight: 600 }}>{t('companyEdit.menuTitle')}</span>}
                            tooltip={t('companyEdit.menuTitleTooltip')}
                          >
                            <Input placeholder={t('companyEdit.menuTitlePlaceholder')} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item 
                            name="wA_MenuButton" 
                            label={<span style={{ fontWeight: 600 }}>{t('companyEdit.menuButton')}</span>}
                            tooltip={t('companyEdit.menuButtonTooltip')}
                          >
                            <Input placeholder={t('companyEdit.menuButtonPlaceholder')} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item 
                        name="wA_MenuFooter" 
                        label={<span style={{ fontWeight: 600 }}>{t('companyEdit.menuFooter')}</span>}
                        tooltip={t('companyEdit.menuFooterTooltip')}
                      >
                        <Input placeholder={t('companyEdit.menuFooterPlaceholder')} style={{ width: '100%' }} />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item 
                            name="wA_SectionTitle" 
                            label={<span style={{ fontWeight: 600 }}>{t('companyEdit.sectionTitle')}</span>}
                            tooltip={t('companyEdit.sectionTitleTooltip')}
                          >
                            <Input placeholder={t('companyEdit.sectionTitlePlaceholder')} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item 
                            name="wA_DefaultOptionDescription" 
                            label={<span style={{ fontWeight: 600 }}>{t('companyEdit.defaultOptionDescription')}</span>}
                            tooltip={t('companyEdit.defaultOptionDescriptionTooltip')}
                          >
                            <Input placeholder={t('companyEdit.defaultOptionDescriptionPlaceholder')} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item 
                        name="wA_InputErrorMessage" 
                        label={<span style={{ fontWeight: 600 }}>{t('companyEdit.inputErrorMessage')}</span>}
                        tooltip={t('companyEdit.inputErrorMessageTooltip')}
                      >
                        <Input.TextArea 
                          rows={2} 
                          placeholder={t('companyEdit.inputErrorMessagePlaceholder')}
                          style={{ width: '100%' }} 
                        />
                      </Form.Item>

                      <Form.Item 
                        name="wA_FallbackMessage" 
                        label={<span style={{ fontWeight: 600 }}>{t('companyEdit.fallbackMessage')}</span>}
                        tooltip={t('companyEdit.fallbackMessageTooltip')}
                      >
                        <Input.TextArea 
                          rows={2} 
                          placeholder={t('companyEdit.fallbackMessagePlaceholder')}
                          style={{ width: '100%' }} 
                        />
                      </Form.Item>

                      <Form.Item 
                        name="wA_SystemErrorMessage" 
                        label={<span style={{ fontWeight: 600 }}>{t('companyEdit.systemErrorMessage')}</span>}
                        tooltip={t('companyEdit.systemErrorMessageTooltip')}
                      >
                        <Input.TextArea 
                          rows={2} 
                          placeholder={t('companyEdit.systemErrorMessagePlaceholder')}
                          style={{ width: '100%' }} 
                        />
                      </Form.Item>
                    </Form>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
      {/* 左上角返回與儲存按鈕 */}
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, display: 'flex', gap: 8 }}>
        <Tooltip title={t('companyEdit.back')}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/company-user-admin')}
            type="primary"
            size="middle"
            style={{ borderRadius: 8, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            aria-label={t('companyEdit.back')}
          />
        </Tooltip>
        <Tooltip title={t('companyEdit.save')}>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSave}
            type="primary"
            size="middle"
            style={{ borderRadius: 8, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            aria-label={t('companyEdit.save')}
          />
        </Tooltip>
      </div>
      </div>
    </div>
  );
};

export default CompanyEditPage; 