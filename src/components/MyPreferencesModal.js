import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Form, Input, Button, Select, Upload, message, Avatar } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';

const { TabPane } = Tabs;

const MyPreferencesModal = ({ visible, onClose, userInfo, onUserInfoUpdate, showUserAdminFields = false }) => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const { changeLanguage, currentLanguage } = useLanguage();

  // 同步 userInfo 到表單
  useEffect(() => {
    console.log('userInfo:', userInfo); // debug 印出 userInfo 結構
    if (userInfo && visible) {
      form.resetFields();
      form.setFieldsValue({
        account: userInfo.account || userInfo.user_account || '',
        name: userInfo.name || '',
        email: userInfo.email || '',
        phone: userInfo.phone || '',
        language: userInfo.language || 'zh-TC',
        timezone: userInfo.timezone || 'Asia/Hong_Kong',
        avatar_url: userInfo.avatar_url || '',
        is_active: typeof userInfo.is_active !== 'undefined' ? userInfo.is_active : (typeof userInfo.isActive !== 'undefined' ? userInfo.isActive : undefined),
        is_owner: typeof userInfo.is_owner !== 'undefined' ? userInfo.is_owner : (typeof userInfo.isOwner !== 'undefined' ? userInfo.isOwner : undefined),
      });
      setAvatarUrl(userInfo.avatar_url || '');
    }
  }, [userInfo, visible, form]);

  useEffect(() => {
    if (!visible) {
      form.resetFields();
    }
  }, [visible, form]);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({ language: currentLanguage });
    }
  }, [currentLanguage, visible, form]);

  const handleUpload = async ({ file }) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('/api/users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: 'Bearer ' + token
        }
      });
      if (res.data.success) {
        setAvatarUrl(res.data.url);
        form.setFieldsValue({ avatar_url: res.data.url });
        message.success('頭像上傳成功');
      } else {
        message.error(res.data.message || '頭像上傳失敗');
      }
    } catch (e) {
      message.error('頭像上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');
      
      // 構建與 AuthController UpdateMe 端點匹配的 payload
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        language: values.language,
        timezone: values.timezone,
        avatarUrl: avatarUrl
      };
      
      // 如果密碼有填寫，則添加到 payload
      if (values.password_hash) {
        payload.PasswordHash = values.password_hash;
      }
      
      // 使用 /api/auth/me 端點更新用戶信息
      await axios.put('/api/auth/me', payload, {
        headers: { Authorization: 'Bearer ' + token }
      });
      
      // 重新取得最新 userInfo
      const res = await axios.get('/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token }
      });
      
      if (res.data) {
        if (typeof onUserInfoUpdate === 'function') {
          onUserInfoUpdate(res.data);
          // 主動刷新表單欄位
          form.setFieldsValue({
            name: res.data.name || '',
            email: res.data.email || '',
            phone: res.data.phone || '',
            language: res.data.language || 'zh-TC',
            timezone: res.data.timezone || 'Asia/Hong_Kong',
            avatar_url: res.data.avatar_url || ''
          });
        }
        localStorage.setItem('userInfo', JSON.stringify(res.data));
      }
      // 立即切換語言
      changeLanguage(values.language);
      setTimeout(() => {
        message.success('個人資料已更新');
        onClose();
      }, 100);
    } catch (e) {
      // 驗證失敗或 API 失敗
      console.error('更新用戶信息失敗:', e);
      message.error('更新用戶信息失敗');
    }
  };

  return (
    <Modal
      title="My Preferences"
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      okText="儲存"
      cancelText="取消"
      destroyOnClose={false}
    >
      <Tabs defaultActiveKey="1">
        <TabPane tab="基本資料" key="1">
          <Form form={form} layout="vertical">
            <Form.Item label="頭像" name="avatar_url">
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
                    <Button icon={<UploadOutlined />}>上傳頭像</Button>
                  )}
                </Upload>
              </div>
            </Form.Item>
            <Form.Item label="帳號" name="account">
              <Input disabled />
            </Form.Item>
            <Form.Item label="名稱" name="name" rules={[{ required: true, message: '請輸入名稱' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ required: true, message: '請輸入 Email' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="電話" name="phone">
              <Input />
            </Form.Item>
            {showUserAdminFields && (
              <Form.Item label="啟用" name="is_active" valuePropName="checked">
                <Input type="checkbox" style={{ width: 20, height: 20 }} />
              </Form.Item>
            )}
            {showUserAdminFields && (
              <Form.Item label="主帳號" name="is_owner" valuePropName="checked">
                <Input type="checkbox" style={{ width: 20, height: 20 }} />
              </Form.Item>
            )}
            <Form.Item label="語言" name="language">
              <Select
                options={[
                  { value: 'zh-TC', label: '繁體中文' },
                  { value: 'zh-SC', label: '简体中文' },
                  { value: 'en', label: 'English' }
                ]}
              />
            </Form.Item>
            <Form.Item label="時區" name="timezone">
              <Select
                options={[
                  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong' },
                  { value: 'Asia/Taipei', label: 'Asia/Taipei' },
                  { value: 'UTC', label: 'UTC' }
                ]}
              />
            </Form.Item>
            <Form.Item label="密碼" name="password_hash" rules={[{ min: 6, message: '密碼至少 6 碼' }]}>
              <Input.Password autoComplete="new-password" placeholder="如需修改請輸入新密碼" />
            </Form.Item>
          </Form>
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default MyPreferencesModal;