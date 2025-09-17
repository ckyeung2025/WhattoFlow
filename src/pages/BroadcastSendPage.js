import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  Select, 
  Space, 
  Typography, 
  Row, 
  Col,
  Progress,
  Modal,
  Table,
  Tag,
  Alert,
  Spin,
  Statistic,
  message
} from 'antd';
import { 
  SendOutlined, 
  UserOutlined, 
  EyeOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  MessageOutlined,
  FilterOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  RotateLeftOutlined
} from '@ant-design/icons';
import { broadcastApi, broadcastGroupApi, hashtagApi, contactApi } from '../services/contactApi';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const BroadcastSendPage = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // 選項數據
  const [groups, setGroups] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  // 預覽數據
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // 廣播狀態
  const [broadcastStatus, setBroadcastStatus] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);

  // 載入選項數據
  const loadOptions = async () => {
    try {
      const [groupsResponse, hashtagsResponse] = await Promise.all([
        broadcastGroupApi.getGroups(),
        hashtagApi.getHashtags()
      ]);
      setGroups(groupsResponse || []);
      setHashtags(hashtagsResponse || []);
      // TODO: 載入 WhatsApp 模板
      setTemplates([]);
    } catch (err) {
      console.error('載入選項數據失敗：', err);
    }
  };

  // 初始載入
  useEffect(() => {
    loadOptions();
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  // 預覽廣播目標
  const handlePreview = async () => {
    const values = form.getFieldsValue();
    if (!values.broadcastGroupId && !values.hashtagFilter) {
      message.error('請選擇群組或標籤');
      return;
    }

    try {
      const previewData = await broadcastApi.previewBroadcast({
        broadcastGroupId: values.broadcastGroupId || undefined,
        hashtagFilter: values.hashtagFilter || undefined
      });
      setPreviewData(previewData);
      setShowPreview(true);
    } catch (err) {
      message.error('預覽失敗：' + (err.response?.data || err.message));
    }
  };

  // 發送廣播
  const handleSendBroadcast = async (values) => {
    if (!values.messageContent?.trim()) {
      message.error('請輸入訊息內容');
      return;
    }

    if (!values.broadcastGroupId && !values.hashtagFilter) {
      message.error('請選擇群組或標籤');
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await broadcastApi.sendBroadcast(values);
      message.success(`廣播已開始發送，目標 ${result.totalContacts} 位聯絡人`);
      
      // 開始輪詢狀態
      if (result.broadcastId) {
        startStatusPolling(result.broadcastId);
      }
    } catch (err) {
      message.error('發送廣播失敗：' + (err.response?.data || err.message));
    } finally {
      setIsSending(false);
    }
  };

  // 開始狀態輪詢
  const startStatusPolling = (broadcastId) => {
    const interval = setInterval(async () => {
      try {
        const status = await broadcastApi.getBroadcastStatus(broadcastId);
        setBroadcastStatus(status);
        
        if (status.status === 'Completed' || status.status === 'Failed' || status.status === 'Cancelled') {
          clearInterval(interval);
          setPollingInterval(null);
        }
      } catch (err) {
        console.error('獲取廣播狀態失敗：', err);
      }
    }, 2000);
    
    setPollingInterval(interval);
  };

  // 取消廣播
  const handleCancelBroadcast = async () => {
    if (!broadcastStatus?.broadcastId) return;

    try {
      await broadcastApi.cancelBroadcast(broadcastStatus.broadcastId);
      message.success('廣播已取消');
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    } catch (err) {
      message.error('取消廣播失敗：' + (err.response?.data || err.message));
    }
  };

  // 獲取狀態圖標
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'Sending': return <PlayCircleOutlined style={{ color: '#1890ff' }} />;
      case 'Completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'Failed': return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      case 'Cancelled': return <PauseCircleOutlined style={{ color: '#8c8c8c' }} />;
      default: return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  // 獲取進度百分比
  const getProgressPercentage = () => {
    if (!broadcastStatus || !broadcastStatus.totalContacts) return 0;
    return (broadcastStatus.sentCount / broadcastStatus.totalContacts) * 100;
  };

  // 預覽表格列定義
  const previewColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '聯絡方式',
      key: 'contact',
      render: (_, record) => (
        <div>
          {record.whatsappNumber && (
            <div style={{ fontSize: '12px', color: '#52c41a' }}>
              📱 {record.whatsappNumber}
            </div>
          )}
          {record.email && (
            <div style={{ fontSize: '12px', color: '#1890ff' }}>
              ✉️ {record.email}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: '標籤',
      dataIndex: 'hashtags',
      key: 'hashtags',
      render: (hashtags) => (
        <Space wrap>
          {hashtags ? hashtags.split(',').map((tag, index) => (
            <Tag key={index} color="blue">#{tag.trim()}</Tag>
          )) : '-'}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 頁面標題 */}
      <Row style={{ marginBottom: '24px' }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>廣播發送</Title>
          <Text type="secondary">向聯絡人群組發送廣播訊息</Text>
        </Col>
      </Row>

      {/* 訊息提示 */}
      {error && (
        <Alert 
          message="錯誤" 
          description={error} 
          type="error" 
          closable 
          onClose={() => setError(null)}
          style={{ marginBottom: '16px' }}
        />
      )}
      {success && (
        <Alert 
          message="成功" 
          description={success} 
          type="success" 
          closable 
          onClose={() => setSuccess(null)}
          style={{ marginBottom: '16px' }}
        />
      )}

      <Row gutter={24}>
        <Col span={16}>
          {/* 廣播設定 */}
          <Card 
            title={
              <Space>
                <MessageOutlined />
                廣播設定
              </Space>
            }
            style={{ marginBottom: '16px' }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSendBroadcast}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="broadcastGroupId"
                    label="廣播群組"
                  >
                    <Select placeholder="選擇群組" allowClear>
                      {groups.map(group => (
                        <Option key={group.id} value={group.id}>
                          {group.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="hashtagFilter"
                    label="標籤篩選"
                  >
                    <Select placeholder="選擇標籤" allowClear>
                      {hashtags.map(hashtag => (
                        <Option key={hashtag.id} value={hashtag.name}>
                          #{hashtag.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="messageContent"
                label="訊息內容"
                rules={[{ required: true, message: '請輸入訊息內容' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="請輸入要發送的訊息內容..."
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button 
                    icon={<EyeOutlined />}
                    onClick={handlePreview}
                  >
                    預覽目標
                  </Button>
                  <Button 
                    type="primary"
                    htmlType="submit"
                    icon={<SendOutlined />}
                    loading={isSending}
                  >
                    {isSending ? '發送中...' : '發送廣播'}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          {/* 廣播狀態 */}
          {broadcastStatus && (
            <Card 
              title={
                <Space>
                  {getStatusIcon(broadcastStatus.status)}
                  廣播狀態
                </Space>
              }
              style={{ marginBottom: '16px' }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: '16px' }}>
                    <Text type="secondary">狀態</Text>
                    <div>
                      <Tag color={
                        broadcastStatus.status === 'Completed' ? 'success' : 
                        broadcastStatus.status === 'Failed' ? 'error' : 
                        broadcastStatus.status === 'Sending' ? 'processing' : 'default'
                      }>
                        {broadcastStatus.status}
                      </Tag>
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: '16px' }}>
                    <Text type="secondary">進度</Text>
                    <div>
                      {broadcastStatus.sentCount} / {broadcastStatus.totalContacts}
                    </div>
                    <Progress 
                      percent={getProgressPercentage()} 
                      status={broadcastStatus.status === 'Failed' ? 'exception' : 'active'}
                    />
                  </div>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="成功發送"
                    value={broadcastStatus.sentCount}
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="發送失敗"
                    value={broadcastStatus.failedCount}
                    prefix={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
                    valueStyle={{ color: '#f5222d' }}
                  />
                </Col>
              </Row>

              {broadcastStatus.status === 'Sending' && (
                <div style={{ textAlign: 'right', marginTop: '16px' }}>
                  <Button 
                    danger
                    icon={<PauseCircleOutlined />}
                    onClick={handleCancelBroadcast}
                  >
                    取消廣播
                  </Button>
                </div>
              )}
            </Card>
          )}
        </Col>

        <Col span={8}>
          {/* 統計資訊 */}
          <Card 
            title="統計資訊"
            style={{ marginBottom: '16px' }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                background: '#f0f2f5', 
                borderRadius: '50%', 
                width: '60px', 
                height: '60px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 16px' 
              }}>
                <UserOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
              </div>
              <Statistic
                title="目標聯絡人數量"
                value={previewData?.totalCount || 0}
                valueStyle={{ fontSize: '24px' }}
              />
            </div>
          </Card>

          {/* 快速操作 */}
          <Card title="快速操作">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                block
                icon={<UserOutlined />}
                onClick={() => window.location.href = '/contacts'}
              >
                管理聯絡人
              </Button>
              <Button 
                block
                icon={<FilterOutlined />}
                onClick={() => window.location.href = '/broadcast-groups'}
              >
                管理群組
              </Button>
              <Button 
                block
                icon={<FilterOutlined />}
                onClick={() => window.location.href = '/hashtags'}
              >
                管理標籤
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 預覽模態框 */}
      <Modal
        title="預覽廣播目標"
        open={showPreview}
        onCancel={() => setShowPreview(false)}
        footer={[
          <Button key="close" onClick={() => setShowPreview(false)}>
            關閉
          </Button>
        ]}
        width={800}
      >
        {previewData && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>找到 {previewData.totalCount} 位符合條件的聯絡人</Text>
            </div>
            
            <Table
              columns={previewColumns}
              dataSource={previewData.preview}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
              }}
              size="small"
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default BroadcastSendPage;