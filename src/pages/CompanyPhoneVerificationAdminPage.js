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
  Alert
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

const { Title } = Typography;
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

  useEffect(() => {
    loadCompanyInfo();
  }, []);

  // 當 selectedCompanyId 改變時，載入驗證記錄
  useEffect(() => {
    if (selectedCompanyId) {
      loadVerifications();
    }
  }, [selectedCompanyId]);

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
            setCompanyInfo({ id: companyId, name: userInfo.company_name || '當前公司' });
            setHasPhoneNumberId(false);
          }
        } catch (error) {
          console.error('載入公司信息失敗:', error);
          // 如果出錯，使用基本信息
          setCompanyInfo({ id: companyId, name: userInfo.company_name || '當前公司' });
          setHasPhoneNumberId(false);
        }
      } else {
        console.warn('無法獲取公司 ID');
        message.warning('無法獲取公司信息，請重新登入');
      }
    } catch (error) {
      console.error('載入公司信息失敗:', error);
      message.error('載入公司信息失敗');
    }
  };

  // 載入驗證記錄
  const loadVerifications = async () => {
    if (!selectedCompanyId) {
      console.warn('無法載入驗證記錄：公司 ID 為空');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/companyphoneverification/company/${selectedCompanyId}`);
      if (response.ok) {
        const data = await response.json();
        setVerifications(data);
      } else {
        const errorData = await response.json().catch(() => ({ error: '載入失敗' }));
        message.error(errorData.error || '載入驗證記錄失敗');
        setVerifications([]);
      }
    } catch (error) {
      console.error('載入驗證記錄失敗:', error);
      message.error('載入失敗');
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
        message.success('憑證已上傳');
        setUploadModalVisible(false);
        form.resetFields();
        loadVerifications();
        
        // 顯示驗證 URL
        Modal.success({
          title: '上傳成功',
          width: 600,
          content: (
            <div>
              <p>憑證已成功上傳，請將以下 URL 發送給客戶：</p>
              <Alert
                message="驗證 URL"
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
                        message.success('URL 已複製到剪貼板');
                      }}
                    >
                      複製 URL
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
        const errorMsg = data.error || data.message || '上傳失敗';
        console.error('上傳憑證失敗:', errorMsg, data);
        message.error(errorMsg);
      }
    } catch (error) {
      console.error('上傳憑證失敗:', error);
      message.error('上傳失敗: ' + (error.message || '未知錯誤'));
    }
  };

  // 獲取狀態標籤
  const getStatusTag = (status) => {
    const statusMap = {
      Pending: { color: 'default', icon: <ClockCircleOutlined />, text: '待處理' },
      Requested: { color: 'processing', icon: <ClockCircleOutlined />, text: '已請求驗證碼' },
      Verified: { color: 'success', icon: <CheckCircleOutlined />, text: '已驗證' },
      Expired: { color: 'warning', icon: <ClockCircleOutlined />, text: '已過期' },
      Failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失敗' }
    };
    
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color} icon={statusInfo.icon}>{statusInfo.text}</Tag>;
  };

  // 複製驗證 URL
  const copyVerificationUrl = (verificationId) => {
    const baseUrl = window.location.origin;
    const verificationUrl = `${baseUrl}/phone-verification/${verificationId}`;
    navigator.clipboard.writeText(verificationUrl);
    message.success('驗證 URL 已複製到剪貼板');
  };

  // 查看詳情
  const viewDetails = async (verificationId) => {
    try {
      const response = await fetch(`/api/companyphoneverification/${verificationId}`);
      if (response.ok) {
        const data = await response.json();
        Modal.info({
          title: '驗證記錄詳情',
          width: 600,
          content: (
            <div>
              <p><strong>電話號碼：</strong>{data.phoneNumber}</p>
              <p><strong>狀態：</strong>{getStatusTag(data.status)}</p>
              <p><strong>憑證過期時間：</strong>{data.certificateExpiry ? new Date(data.certificateExpiry).toLocaleString('zh-TW') : 'N/A'}</p>
              <p><strong>驗證碼過期時間：</strong>{data.codeExpiry ? new Date(data.codeExpiry).toLocaleString('zh-TW') : 'N/A'}</p>
              <p><strong>驗證方式：</strong>{data.codeMethod || 'N/A'}</p>
              <p><strong>Phone Number ID：</strong>{data.phoneNumberId || 'N/A'}</p>
              <p><strong>創建時間：</strong>{new Date(data.createdAt).toLocaleString('zh-TW')}</p>
              <p><strong>更新時間：</strong>{data.updatedAt ? new Date(data.updatedAt).toLocaleString('zh-TW') : 'N/A'}</p>
              {data.errorMessage && (
                <p><strong>錯誤信息：</strong><span style={{ color: '#ff4d4f' }}>{data.errorMessage}</span></p>
              )}
              <div style={{ marginTop: 16 }}>
                <strong>驗證 URL：</strong>
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
      message.error('載入詳情失敗');
    }
  };

  const columns = [
    {
      title: '電話號碼',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
    },
    {
      title: '憑證過期時間',
      dataIndex: 'certificateExpiry',
      key: 'certificateExpiry',
      render: (date) => date ? new Date(date).toLocaleString('zh-TW') : 'N/A',
    },
    {
      title: '驗證碼過期時間',
      dataIndex: 'codeExpiry',
      key: 'codeExpiry',
      render: (date) => date ? new Date(date).toLocaleString('zh-TW') : 'N/A',
    },
    {
      title: 'Phone Number ID',
      dataIndex: 'phoneNumberId',
      key: 'phoneNumberId',
      render: (id) => id || '-',
    },
    {
      title: '創建時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('zh-TW'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => viewDetails(record.id)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<CopyOutlined />}
            onClick={() => copyVerificationUrl(record.id)}
          >
            複製 URL
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>WhatsApp 電話號碼驗證管理</Title>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadVerifications}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUploadModalVisible(true)}
              disabled={!selectedCompanyId}
            >
              上傳憑證
            </Button>
          </Space>
        </div>

        {companyInfo && (
          <Alert
            message={`當前公司：${companyInfo.name}`}
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
            showTotal: (total) => `共 ${total} 條記錄`,
          }}
        />
      </Card>

      {/* 上傳憑證模態框 */}
      <Modal
        title="上傳憑證和電話號碼"
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
            label="公司"
            required
          >
            <Input
              value={companyInfo?.name || '當前公司'}
              disabled
            />
          </Form.Item>

          <Form.Item
            label="電話號碼"
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
                        return Promise.reject(new Error('請輸入有效的電話號碼（例如：+85296062000 或 85296062000）'));
                      }
                      return Promise.resolve();
                    }
                  }
                : [
                    { required: true, message: '請輸入電話號碼（Company.WA_PhoneNo_ID 未配置）' },
                    { 
                      pattern: /^\+?[0-9]{8,15}$/, 
                      message: '請輸入有效的電話號碼（例如：+85296062000 或 85296062000）'
                    }
                  ]
            ]}
            help={hasPhoneNumberId ? "可選：如果留空，系統將從 Meta API 或 Company.Phone 自動獲取" : "必需：因為 Company.WA_PhoneNo_ID 未配置"}
            normalize={(value) => {
              // 移除所有空格和特殊字符（除了數字和+號）
              if (!value) return value;
              // 移除所有非數字和+號的字符
              let cleaned = value.replace(/[^\d+]/g, '');
              
              // 檢查是否有重複的國家代碼（例如：85285296062000）
              // 如果號碼以 852852 開頭，移除第一個 852
              if (cleaned.match(/^852852/)) {
                cleaned = cleaned.replace(/^852/, '');
                console.warn('檢測到重複的國家代碼，已自動移除');
              }
              
              return cleaned;
            }}
          >
            <Input
              placeholder={hasPhoneNumberId ? "可選：留空將自動從 Meta API 獲取" : "例如：+85296062000 或 85296062000"}
              addonBefore="+"
              style={{ paddingLeft: '12px' }}
            />
          </Form.Item>

          <Form.Item
            label="數碼憑證 (Base64)"
            name="certificate"
            rules={[
              { required: true, message: '請輸入憑證' },
              { min: 100, message: '憑證格式可能不正確' }
            ]}
            help="請從 Meta Business Suite 複製 base64 編碼的數碼憑證"
          >
            <TextArea
              rows={6}
              placeholder="請粘貼 base64 編碼的憑證..."
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => {
                setUploadModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CompanyPhoneVerificationAdminPage;

