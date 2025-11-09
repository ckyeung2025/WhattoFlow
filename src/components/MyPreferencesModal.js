import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Form, Input, Button, Select, Upload, message, Avatar } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import apiClient from '../services/apiClient';
import { useLanguage } from '../contexts/LanguageContext';
import { GMT_OFFSET_OPTIONS, normalizeGMTOffsetString, getTimezoneValueByGMTOffset } from '../configs/timezones';

const { TabPane } = Tabs;

const MyPreferencesModal = ({ visible, onClose, userInfo, onUserInfoUpdate, showUserAdminFields = false }) => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const { changeLanguage, currentLanguage, t } = useLanguage();

  // 同步 userInfo 到表單
  useEffect(() => {
    console.log('userInfo:', userInfo); // debug 印出 userInfo 結構
    if (userInfo && visible && form) {
      form.resetFields();
      form.setFieldsValue({
        account: userInfo.account || userInfo.user_account || '',
        name: userInfo.name || '',
        email: userInfo.email || '',
        phone: userInfo.phone || '',
        language: userInfo.language || 'zh-TC',
        timezone: normalizeGMTOffsetString(userInfo.timezone),
        avatar_url: userInfo.avatar_url || '',
        is_active: typeof userInfo.is_active !== 'undefined' ? userInfo.is_active : (typeof userInfo.isActive !== 'undefined' ? userInfo.isActive : undefined),
        is_owner: typeof userInfo.is_owner !== 'undefined' ? userInfo.is_owner : (typeof userInfo.isOwner !== 'undefined' ? userInfo.isOwner : undefined),
      });
      setAvatarUrl(userInfo.avatar_url || '');
    }
  }, [userInfo, visible, form]);

  useEffect(() => {
    if (visible && form) {
      form.setFieldsValue({ language: currentLanguage });
    }
  }, [currentLanguage, visible, form]);

  const handleUpload = async ({ file }) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiClient.post('/api/users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data.success) {
        setAvatarUrl(res.data.url);
        form.setFieldsValue({ avatar_url: res.data.url });
        message.success(t('preferences.avatarUploadSuccess'));
      } else {
        message.error(res.data.message || t('preferences.avatarUploadFailed'));
      }
    } catch (e) {
      message.error(t('preferences.avatarUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const normalizedTimezone = normalizeGMTOffsetString(values.timezone);
      const timezoneForSave = getTimezoneValueByGMTOffset(normalizedTimezone);
      
      // 構建與 AuthController UpdateMe 端點匹配的 payload
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        language: values.language,
        timezone: timezoneForSave,
        AvatarUrl: avatarUrl
      };
      
      // 如果密碼有填寫，則添加到 payload
      if (values.password_hash) {
        payload.PasswordHash = values.password_hash;
      }
      
      // 使用 /api/auth/me 端點更新用戶信息
      await apiClient.put('/api/auth/me', payload);
      
      // 重新取得最新 userInfo
      const res = await apiClient.get('/api/auth/me');
      
      if (res.data) {
        if (typeof onUserInfoUpdate === 'function') {
          onUserInfoUpdate(res.data);
          // 主動刷新表單欄位
          form.setFieldsValue({
            name: res.data.name || '',
            email: res.data.email || '',
            phone: res.data.phone || '',
            language: res.data.language || 'zh-TC',
            timezone: normalizeGMTOffsetString(res.data.timezone),
            avatar_url: res.data.avatar_url || ''
          });
        }
        localStorage.setItem('userInfo', JSON.stringify(res.data));
      }
      // 立即切換語言
      changeLanguage(values.language);
      setTimeout(() => {
        message.success(t('preferences.updateSuccess'));
        onClose();
      }, 100);
    } catch (e) {
      // 驗證失敗或 API 失敗
      console.error('更新用戶信息失敗:', e);
      message.error(t('preferences.updateFailed'));
    }
  };

  return (
    <Modal
      title={t('preferences.title')}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      okText={t('preferences.save')}
      cancelText={t('preferences.cancel')}
      destroyOnHidden={false}
    >
      <Tabs defaultActiveKey="1">
        <TabPane tab={t('preferences.basicInfo')} key="1">
          <Form form={form} layout="vertical">
            <Form.Item label={t('preferences.avatar')} name="avatar_url">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
                <Upload
                  name="file"
                  showUploadList={false}
                  customRequest={handleUpload}
                  accept="image/*"
                  disabled={uploading}
                >
                  {avatarUrl ? (
                    <Avatar src={avatarUrl} size={96} style={{ marginBottom: 8 }} />
                  ) : (
                    <Button icon={<UploadOutlined />}>{t('preferences.uploadAvatar')}</Button>
                  )}
                </Upload>
              </div>
            </Form.Item>
            <Form.Item label={t('preferences.account')} name="account">
              <Input disabled />
            </Form.Item>
            <Form.Item label={t('preferences.name')} name="name" rules={[{ required: true, message: t('preferences.name') + ' ' + t('common.required') }]}>
              <Input />
            </Form.Item>
            <Form.Item label={t('preferences.email')} name="email" rules={[{ required: true, message: t('preferences.email') + ' ' + t('common.required') }]}>
              <Input />
            </Form.Item>
            <Form.Item label={t('preferences.phone')} name="phone">
              <Input />
            </Form.Item>
            {showUserAdminFields && (
              <Form.Item label={t('preferences.isActive')} name="is_active" valuePropName="checked">
                <Input type="checkbox" style={{ width: 20, height: 20 }} />
              </Form.Item>
            )}
            {showUserAdminFields && (
              <Form.Item label={t('preferences.isOwner')} name="is_owner" valuePropName="checked">
                <Input type="checkbox" style={{ width: 20, height: 20 }} />
              </Form.Item>
            )}
            <Form.Item label={t('preferences.language')} name="language">
              <Select
                options={[
                  { value: 'zh-TC', label: '繁體中文' },
                  { value: 'zh-SC', label: '简体中文' },
                  { value: 'en', label: 'English' }
                ]}
              />
            </Form.Item>
            <Form.Item label={t('preferences.timezone')} name="timezone">
              <Select
                showSearch
                placeholder={t('preferences.selectTimezone')}
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={GMT_OFFSET_OPTIONS}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label={t('preferences.password')} name="password_hash" rules={[{ min: 6, message: t('preferences.password') + ' ' + t('common.minLength', { min: 6 }) }]}>
              <Input.Password autoComplete="new-password" placeholder={t('preferences.passwordPlaceholder')} />
            </Form.Item>
          </Form>
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default MyPreferencesModal;