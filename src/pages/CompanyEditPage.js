import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Form, Input, Avatar, Button, message, Upload, Tooltip, Card, Row, Col, Typography } from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';
import zhTC from '../locales/zh-TC';
import en from '../locales/en';

const CompanyEditPage = () => {
  const [form] = Form.useForm();
  const [logoUrl, setLogoUrl] = useState('');
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
        setTimeout(() => {
          form.setFieldsValue({
            name: data.name,
            email: data.email,
            address: data.address,
            phone: data.phone,
            website: data.website,
            wA_API_Key: data.wA_API_Key,
            wA_PhoneNo_ID: data.wA_PhoneNo_ID,
            wA_VerifyToken: data.wA_VerifyToken,
            wA_WebhookToken: data.wA_WebhookToken,
            wA_WebhookUrl: data.wA_WebhookToken ? `${window.location.origin}/api/MetaWebhook/${data.wA_WebhookToken}` : '',
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
      const values = form.getFieldsValue();
      values.logoUrl = logoUrl;
      await fetch(`/api/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
        body: JSON.stringify(values)
      });
      message.success('儲存成功');
      navigate('/company-user-admin');
    } catch {
      message.error('儲存失敗');
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
        message.success('上傳成功');
      } else {
        message.error('上傳失敗');
      }
    } catch {
      message.error('上傳失敗');
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '32px auto', padding: 16, position: 'relative' }}>
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
            style={{ borderRadius: 16, boxShadow: '0 2px 12px #eee', minHeight: 300 }}
            bodyStyle={{ padding: 32 }}
          >
            <Title level={5} style={{ color: '#7234CF', marginBottom: 24, letterSpacing: 2 }}>{t('companyEdit.whatsappSetting')}</Title>
            <Form form={form} layout="vertical">
              <Form.Item name="wA_API_Key" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.waApiKey')}</span>}>
                <Input style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="wA_PhoneNo_ID" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.waPhoneNoId')}</span>}>
                <Input style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="wA_VerifyToken" label={<span style={{ fontWeight: 600 }}>{t('companyEdit.waVerifyToken')}</span>}>
                <Input style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="wA_WebhookToken" label={<span style={{ fontWeight: 600 }}>Webhook Token</span>}>
                <Input 
                  style={{ width: '100%' }} 
                  placeholder="自動生成的唯一 Token"
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
                        message.success('新的 Token 已生成，URL 已更新');
                      }}
                    >
                      重新生成
                    </Button>
                  }
                />
              </Form.Item>
              <Form.Item name="wA_WebhookUrl" label={<span style={{ fontWeight: 600 }}>Meta Webhook URL</span>}>
                <Input 
                  style={{ width: '100%' }} 
                  placeholder="例如: https://your-domain.com/api/MetaWebhook/your-token"
                  suffix={
                    <Button 
                      type="text" 
                      size="small" 
                      onClick={() => {
                        const webhookUrl = form.getFieldValue('wA_WebhookUrl');
                        if (webhookUrl) {
                          navigator.clipboard.writeText(webhookUrl);
                          message.success('Webhook URL 已複製到剪貼簿');
                        } else {
                          message.error('請先生成 Webhook Token');
                        }
                      }}
                    >
                      複製
                    </Button>
                  }
                />
              </Form.Item>
            </Form>
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
            aria-label="返回"
          />
        </Tooltip>
        <Tooltip title={t('companyEdit.save')}>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSave}
            type="primary"
            size="middle"
            style={{ borderRadius: 8, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            aria-label="儲存"
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default CompanyEditPage; 