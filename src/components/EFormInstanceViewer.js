import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Card, 
  Button, 
  Space, 
  message, 
  Tag, 
  Spin, 
  Alert, 
  Descriptions, 
  Typography,
  Divider,
  Row,
  Col
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const EFormInstanceViewer = ({ 
  visible, 
  eform, 
  onClose, 
  onApprove, 
  onReject, 
  showActions = true 
}) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [eformDetails, setEformDetails] = useState(null);

  useEffect(() => {
    if (visible && eform) {
      loadEformDetails();
    }
  }, [visible, eform]);

  const loadEformDetails = async () => {
    if (!eform) return;
    
    setLoading(true);
    try {
      // 如果有 eform.id，嘗試從 API 載入詳細信息
      if (eform.id && eform.id.startsWith('eform-')) {
        const response = await fetch(`/api/eforminstances/${eform.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setEformDetails(data);
        } else {
          // 如果 API 失敗，使用傳入的 eform 數據
          setEformDetails(eform);
        }
      } else {
        // 直接使用傳入的 eform 數據
        setEformDetails(eform);
      }
    } catch (error) {
      console.error('載入表單詳情失敗:', error);
      // 使用傳入的 eform 數據作為後備
      setEformDetails(eform);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'orange';
      case 'Approved': return 'green';
      case 'Rejected': return 'red';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Pending': return '待審批';
      case 'Approved': return '已批准';
      case 'Rejected': return '已拒絕';
      default: return status;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'red';
      case 'Medium': return 'orange';
      case 'Low': return 'green';
      default: return 'default';
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'High': return '高';
      case 'Medium': return '中';
      case 'Low': return '低';
      default: return priority;
    }
  };

  const renderFormData = (formData) => {
    if (!formData || typeof formData !== 'object') {
      return <Text type="secondary">暫無表單數據</Text>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Object.entries(formData).map(([key, value]) => (
          <div key={key} style={{ 
            display: 'flex', 
            padding: '8px 12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            border: '1px solid #e8e8e8'
          }}>
            <div style={{ 
              minWidth: '120px', 
              fontWeight: '600',
              color: '#595959'
            }}>
              {key}:
            </div>
            <div style={{ 
              flex: 1,
              wordBreak: 'break-all'
            }}>
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!visible || !eform) {
    return null;
  }

  const currentEform = eformDetails || eform;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span>表單詳情</span>
          <Tag color={getStatusColor(currentEform.status)}>
            {getStatusText(currentEform.status)}
          </Tag>
          {currentEform.priority && (
            <Tag color={getPriorityColor(currentEform.priority)}>
              {getPriorityText(currentEform.priority)}
            </Tag>
          )}
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={
        showActions && currentEform.status === 'Pending' ? (
          <Space>
            <Button onClick={onClose}>
              關閉
            </Button>
            <Button 
              type="primary"
              danger
              icon={<CloseCircleOutlined />}
              onClick={onReject}
            >
              拒絕
            </Button>
            <Button 
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={onApprove}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              批准
            </Button>
          </Space>
        ) : (
          <Button onClick={onClose}>
            關閉
          </Button>
        )
      }
      width={800}
      style={{ top: 20 }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>載入表單詳情中...</div>
        </div>
      ) : (
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* 基本信息 */}
          <Card 
            title="基本信息" 
            size="small" 
            style={{ marginBottom: '16px' }}
          >
            <Descriptions column={2} size="small">
              <Descriptions.Item label="表單名稱">
                <Text strong>{currentEform.formName}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="實例名稱">
                {currentEform.instanceName}
              </Descriptions.Item>
              <Descriptions.Item label="申請人">
                <Space>
                  <UserOutlined />
                  {currentEform.createdBy}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="申請時間">
                <Space>
                  <CalendarOutlined />
                  {currentEform.createdAt ? 
                    dayjs(currentEform.createdAt).format('YYYY-MM-DD HH:mm:ss') : 
                    '-'
                  }
                </Space>
              </Descriptions.Item>
              {currentEform.dueDate && (
                <Descriptions.Item label="截止時間">
                  <Space>
                    <CalendarOutlined />
                    {dayjs(currentEform.dueDate).format('YYYY-MM-DD HH:mm:ss')}
                  </Space>
                </Descriptions.Item>
              )}
              {currentEform.workflowInstanceId && (
                <Descriptions.Item label="工作流程實例">
                  <Text code>{currentEform.workflowInstanceId}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* 用戶訊息 */}
          {currentEform.userMessage && (
            <Card 
              title="用戶訊息" 
              size="small" 
              style={{ marginBottom: '16px' }}
            >
              <div style={{ 
                padding: '12px',
                backgroundColor: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: '6px',
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                {currentEform.userMessage}
              </div>
            </Card>
          )}

          {/* 表單數據 */}
          <Card 
            title="表單數據" 
            size="small" 
            style={{ marginBottom: '16px' }}
          >
            {renderFormData(currentEform.formData)}
          </Card>

          {/* 審批信息 */}
          {(currentEform.approvalBy || currentEform.approvalAt || currentEform.approvalNote) && (
            <Card 
              title="審批信息" 
              size="small" 
              style={{ marginBottom: '16px' }}
            >
              <Descriptions column={2} size="small">
                {currentEform.approvalBy && (
                  <Descriptions.Item label="審批人">
                    <Space>
                      <UserOutlined />
                      {currentEform.approvalBy}
                    </Space>
                  </Descriptions.Item>
                )}
                {currentEform.approvalAt && (
                  <Descriptions.Item label="審批時間">
                    <Space>
                      <CalendarOutlined />
                      {dayjs(currentEform.approvalAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Space>
                  </Descriptions.Item>
                )}
              </Descriptions>
              {currentEform.approvalNote && (
                <div style={{ marginTop: '12px' }}>
                  <Text strong>審批備註：</Text>
                  <div style={{ 
                    marginTop: '8px',
                    padding: '12px',
                    backgroundColor: '#fff7e6',
                    border: '1px solid #ffd591',
                    borderRadius: '6px',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}>
                    {currentEform.approvalNote}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* 狀態提醒 */}
          {currentEform.status === 'Pending' && currentEform.dueDate && 
           new Date(currentEform.dueDate) < new Date() && (
            <Alert
              message="逾期提醒"
              description={`此表單已逾期，截止時間為 ${dayjs(currentEform.dueDate).format('YYYY-MM-DD HH:mm:ss')}`}
              type="warning"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default EFormInstanceViewer;
