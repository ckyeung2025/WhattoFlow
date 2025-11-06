import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Input,
  Modal,
  Form,
  Select,
  message,
  Tag,
  Space,
  Typography,
  Popconfirm,
  Alert,
  Row,
  Col
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  CopyOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { canAccessPhoneVerificationAdmin } from '../utils/permissionUtils';
import { Spin, Typography as AntTypography } from 'antd';

const { Title, Text } = Typography;
const { Text: AntText } = AntTypography;
const { TextArea } = Input;
const { Option } = Select;

const CompanyPhoneVerificationAdminPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // 獲取當前公司信息
  const [companyInfo, setCompanyInfo] = useState(null);
  const [hasPhoneNumberId, setHasPhoneNumberId] = useState(false);
  
  // 表單數據
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  // 獲取用戶信息並檢查權限
  const getUserInfo = () => {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}');
    } catch (e) {
      console.error('解析 userInfo 失敗:', e);
      return {};
    }
  };

  const [userInfo, setUserInfo] = useState(() => getUserInfo());
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);

  // 如果 userInfo 沒有 roles，嘗試從 API 重新獲取
  useEffect(() => {
    const fetchUserInfo = async () => {
      const currentUserInfo = getUserInfo();
      if (!currentUserInfo.roles || currentUserInfo.roles.length === 0) {
        setLoadingUserInfo(true);
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            setLoadingUserInfo(false);
            return;
          }
          
          const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.ok) {
            const userData = await response.json();
            const updatedUserInfo = {
              ...currentUserInfo,
              ...userData,
              company_id: userData.company_id || currentUserInfo.company_id || currentUserInfo.companyId || currentUserInfo.companyID,
              roles: userData.roles || []
            };
            setUserInfo(updatedUserInfo);
            localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
          }
        } catch (error) {
          console.error('獲取用戶信息失敗:', error);
        } finally {
          setLoadingUserInfo(false);
        }
      }
    };
    
    fetchUserInfo();
  }, []);

  // 檢查是否有權限訪問
  const hasAccess = canAccessPhoneVerificationAdmin(userInfo);

  // 當有權限時，載入公司信息
  useEffect(() => {
    if (hasAccess && !loadingUserInfo) {
      loadCompanyInfo();
    }
  }, [hasAccess, loadingUserInfo]);

  // 當 selectedCompanyId 改變時，載入驗證記錄
  useEffect(() => {
    if (selectedCompanyId && hasAccess) {
      loadVerifications();
    }
  }, [selectedCompanyId, hasAccess]);

  // 如果正在載入用戶信息，顯示加載中
  if (loadingUserInfo) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <p style={{ marginTop: '16px' }}>正在載入用戶權限信息...</p>
      </div>
    );
  }

  // 如果沒有權限，顯示無權限提示
  if (!hasAccess) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Title level={3}>無權限訪問</Title>
        <AntText type="secondary">
          您沒有權限訪問此頁面。只有 Tenant_Admin 可以訪問電話號碼驗證管理。
        </AntText>
        <p style={{ marginTop: '16px', color: '#999', fontSize: '12px' }}>
          當前用戶角色: {userInfo?.roles?.length > 0 
            ? userInfo.roles.map(r => typeof r === 'string' ? r : r.name).join(', ') 
            : '無'}
        </p>
      </div>
    );
  }

  // 載入公司信息
  const loadCompanyInfo = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      if (userInfo.company_id) {
        const companyId = userInfo.company_id;
        setSelectedCompanyId(companyId);
        
        // 載入完整的公司信息以檢查 WA_PhoneNo_ID
        try {
          const companyResponse = await fetch(`/api/companies/${companyId}`, {
            headers: {
              Authorization: 'Bearer ' + localStorage.getItem('token')
            }
          });
          if (companyResponse.ok) {
            const companyData = await companyResponse.json();
            setCompanyInfo(companyData);
            // 檢查是否有 WA_PhoneNo_ID
            setHasPhoneNumberId(!!companyData.wA_PhoneNo_ID);
          } else {
            // 如果載入失敗，使用基本信息
            setCompanyInfo({ id: companyId, name: userInfo.company_name || t('phoneVerification.currentCompanyPlaceholder') });
            setHasPhoneNumberId(false);
          }
        } catch (error) {
          console.error('載入公司信息失敗:', error);
          // 如果出錯，使用基本信息
          setCompanyInfo({ id: companyId, name: userInfo.company_name || t('phoneVerification.currentCompanyPlaceholder') });
          setHasPhoneNumberId(false);
        }
      } else {
        console.warn('無法獲取公司 ID');
        message.warning(t('phoneVerification.cannotGetCompanyInfo'));
      }
    } catch (error) {
      console.error('載入公司信息失敗:', error);
      message.error(t('phoneVerification.loadCompanyInfoFailed'));
    }
  };

  // 載入驗證記錄
  const loadVerifications = async () => {
    if (!selectedCompanyId) {
      console.warn(t('phoneVerification.cannotLoadVerifications'));
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/companyphoneverification/company/${selectedCompanyId}`);
      if (response.ok) {
        const data = await response.json();
        setVerifications(data);
      } else {
        const errorData = await response.json().catch(() => ({ error: t('phoneVerification.loadFailed') }));
        message.error(errorData.error || t('phoneVerification.loadVerificationsFailed'));
        setVerifications([]);
      }
    } catch (error) {
      console.error('載入驗證記錄失敗:', error);
      message.error(t('phoneVerification.loadFailed'));
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  };

  // 處理上傳憑證
  const handleUpload = async (values) => {
    try {
      const response = await fetch('/api/companyphoneverification/upload-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          phoneNumber: values.phoneNumber && values.phoneNumber.trim() ? values.phoneNumber.trim() : null,
          certificate: values.certificate && values.certificate.trim() ? values.certificate.trim() : null,
          createdBy: JSON.parse(localStorage.getItem('userInfo') || '{}').account || 'admin'
        })
      });

      const data = await response.json();

      if (response.ok) {
        message.success(t('phoneVerification.uploadSuccess'));
        setUploadModalVisible(false);
        form.resetFields();
        loadVerifications();
        
        // 顯示驗證 URL
        Modal.success({
          title: t('phoneVerification.uploadSuccessTitle'),
          width: 600,
          content: (
            <div>
              <p>{t('phoneVerification.uploadSuccessMessage')}</p>
              <Alert
                message={t('phoneVerification.verificationUrl')}
                description={
                  <div>
                    <p style={{ marginBottom: 8 }}>
                      <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4 }}>
                        {data.verificationUrl}
                      </code>
                    </p>
                    <Button
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(data.verificationUrl);
                        message.success(t('phoneVerification.urlCopied'));
                      }}
                    >
                      {t('phoneVerification.copyUrlButton')}
                    </Button>
                  </div>
                }
                type="info"
                showIcon
              />
            </div>
          )
        });
      } else {
        const errorMsg = data.error || data.message || t('phoneVerification.uploadFailed');
        console.error('上傳憑證失敗:', errorMsg, data);
        message.error(errorMsg);
      }
    } catch (error) {
      console.error('上傳憑證失敗:', error);
      message.error(t('phoneVerification.uploadFailed') + ': ' + (error.message || t('phoneVerification.unknownError')));
    }
  };

  // 獲取狀態標籤
  const getStatusTag = (status) => {
    const statusMap = {
      Pending: { color: 'default', icon: <ClockCircleOutlined />, text: t('phoneVerification.statusPending') },
      Requested: { color: 'processing', icon: <ClockCircleOutlined />, text: t('phoneVerification.statusRequested') },
      Verified: { color: 'success', icon: <CheckCircleOutlined />, text: t('phoneVerification.statusVerified') },
      Expired: { color: 'warning', icon: <ClockCircleOutlined />, text: t('phoneVerification.statusExpired') },
      Failed: { color: 'error', icon: <CloseCircleOutlined />, text: t('phoneVerification.statusFailed') }
    };
    
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color} icon={statusInfo.icon}>{statusInfo.text}</Tag>;
  };

  // 複製驗證 URL
  const copyVerificationUrl = (verificationId) => {
    const baseUrl = window.location.origin;
    const verificationUrl = `${baseUrl}/phone-verification/${verificationId}`;
    navigator.clipboard.writeText(verificationUrl);
    message.success(t('phoneVerification.verificationUrlCopied'));
  };

  // 查看詳情
  const viewDetails = async (verificationId) => {
    try {
      const response = await fetch(`/api/companyphoneverification/${verificationId}`);
      if (response.ok) {
        const data = await response.json();
        Modal.info({
          title: t('phoneVerification.detailTitle'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('phoneVerification.detailPhoneNumber')}</strong>{data.phoneNumber}</p>
              <p><strong>{t('phoneVerification.detailStatus')}</strong>{getStatusTag(data.status)}</p>
              <p><strong>{t('phoneVerification.detailCertificateExpiry')}</strong>{data.certificateExpiry ? new Date(data.certificateExpiry).toLocaleString('zh-TW') : t('phoneVerification.na')}</p>
              <p><strong>{t('phoneVerification.detailCodeExpiry')}</strong>{data.codeExpiry ? new Date(data.codeExpiry).toLocaleString('zh-TW') : t('phoneVerification.na')}</p>
              <p><strong>{t('phoneVerification.detailVerificationMethod')}</strong>{data.codeMethod || t('phoneVerification.na')}</p>
              <p><strong>{t('phoneVerification.detailPhoneNumberId')}</strong>{data.phoneNumberId || t('phoneVerification.na')}</p>
              <p><strong>{t('phoneVerification.detailCreatedAt')}</strong>{new Date(data.createdAt).toLocaleString('zh-TW')}</p>
              <p><strong>{t('phoneVerification.detailUpdatedAt')}</strong>{data.updatedAt ? new Date(data.updatedAt).toLocaleString('zh-TW') : t('phoneVerification.na')}</p>
              {data.errorMessage && (
                <p><strong>{t('phoneVerification.detailErrorMessage')}</strong><span style={{ color: '#ff4d4f' }}>{data.errorMessage}</span></p>
              )}
              <div style={{ marginTop: 16 }}>
                <strong>{t('phoneVerification.detailVerificationUrl')}</strong>
                <div style={{ marginTop: 8 }}>
                  <Input
                    value={`${window.location.origin}/phone-verification/${verificationId}`}
                    readOnly
                    suffix={
                      <Button
                        type="text"
                        icon={<CopyOutlined />}
                        onClick={() => copyVerificationUrl(verificationId)}
                      />
                    }
                  />
                </div>
              </div>
            </div>
          )
        });
      }
    } catch (error) {
      console.error('查看詳情失敗:', error);
      message.error(t('phoneVerification.loadDetailsFailed'));
    }
  };

  const columns = [
    {
      title: t('phoneVerification.phoneNumber'),
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
    },
    {
      title: t('phoneVerification.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
    },
    {
      title: t('phoneVerification.certificateExpiry'),
      dataIndex: 'certificateExpiry',
      key: 'certificateExpiry',
      render: (date) => date ? new Date(date).toLocaleString('zh-TW') : t('phoneVerification.na'),
    },
    {
      title: t('phoneVerification.codeExpiry'),
      dataIndex: 'codeExpiry',
      key: 'codeExpiry',
      render: (date) => date ? new Date(date).toLocaleString('zh-TW') : t('phoneVerification.na'),
    },
    {
      title: t('phoneVerification.phoneNumberId'),
      dataIndex: 'phoneNumberId',
      key: 'phoneNumberId',
      render: (id) => id || '-',
    },
    {
      title: t('phoneVerification.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('zh-TW'),
    },
    {
      title: t('phoneVerification.actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => viewDetails(record.id)}
          >
            {t('phoneVerification.view')}
          </Button>
          <Button
            type="link"
            icon={<CopyOutlined />}
            onClick={() => copyVerificationUrl(record.id)}
          >
            {t('phoneVerification.copyUrl')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 頁面標題 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadVerifications}
              loading={loading}
            >
              {t('phoneVerification.refresh')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUploadModalVisible(true)}
              disabled={!selectedCompanyId}
            >
              {t('phoneVerification.uploadCertificate')}
            </Button>
          </Space>
        </Col>
        <Col>
          <Title level={2} style={{ margin: 0, textAlign: 'right' }}>
            {t('phoneVerification.title')}
          </Title>
          <Text type="secondary" style={{ textAlign: 'right', display: 'block' }}>
            {t('phoneVerification.pageDescription')}
          </Text>
        </Col>
      </Row>

      <Card>
        {companyInfo && (
          <Alert
            message={t('phoneVerification.currentCompany', { name: companyInfo.name })}
            type="info"
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          columns={columns}
          dataSource={verifications}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => t('phoneVerification.totalRecords', { total }),
          }}
        />
      </Card>

      {/* 上傳憑證模態框 */}
      <Modal
        title={t('phoneVerification.uploadModalTitle')}
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpload}
        >
          <Form.Item
            label={t('phoneVerification.company')}
            required
          >
            <Input
              value={companyInfo?.name || t('phoneVerification.currentCompanyPlaceholder')}
              disabled
            />
          </Form.Item>

          <Form.Item
            label={t('phoneVerification.phoneNumber')}
            name="phoneNumber"
            rules={[
              // 如果 Company.WA_PhoneNo_ID 存在，電話號碼為可選
              // 如果不存在，則為必需
              hasPhoneNumberId 
                ? {
                    validator: (_, value) => {
                      // 如果為空，驗證通過（可選）
                      if (!value || value.trim() === '') {
                        return Promise.resolve();
                      }
                      // 如果有值，驗證格式
                      const pattern = /^\+?[0-9]{8,15}$/;
                      if (!pattern.test(value)) {
                        return Promise.reject(new Error(t('phoneVerification.phoneNumberInvalid')));
                      }
                      return Promise.resolve();
                    }
                  }
                : [
                    { required: true, message: t('phoneVerification.phoneNumberRequired') },
                    { 
                      pattern: /^\+?[0-9]{8,15}$/, 
                      message: t('phoneVerification.phoneNumberInvalid')
                    }
                  ]
            ]}
            help={hasPhoneNumberId ? t('phoneVerification.phoneNumberOptional') : t('phoneVerification.phoneNumberRequiredWhenNoId')}
            normalize={(value) => {
              // 移除所有空格和特殊字符（除了數字和+號）
              if (!value) return value;
              // 移除所有非數字和+號的字符
              let cleaned = value.replace(/[^\d+]/g, '');
              
              // 檢查是否有重複的國家代碼（例如：85285296062000）
              // 如果號碼以 852852 開頭，移除第一個 852
              if (cleaned.match(/^852852/)) {
                cleaned = cleaned.replace(/^852/, '');
                console.warn(t('phoneVerification.duplicateCountryCodeDetected'));
              }
              
              return cleaned;
            }}
          >
            <Input
              placeholder={hasPhoneNumberId ? t('phoneVerification.phoneNumberPlaceholderOptional') : t('phoneVerification.phoneNumberPlaceholderRequired')}
              addonBefore="+"
              style={{ paddingLeft: '12px' }}
            />
          </Form.Item>

          <Form.Item
            label={t('phoneVerification.certificate')}
            name="certificate"
            rules={[
              { required: true, message: t('phoneVerification.certificateRequired') },
              { min: 100, message: t('phoneVerification.certificateFormatError') }
            ]}
            help={t('phoneVerification.certificateHelp')}
          >
            <TextArea
              rows={6}
              placeholder={t('phoneVerification.certificatePlaceholder')}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('phoneVerification.submit')}
              </Button>
              <Button onClick={() => {
                setUploadModalVisible(false);
                form.resetFields();
              }}>
                {t('phoneVerification.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CompanyPhoneVerificationAdminPage;

