import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Input, 
  Row, 
  Col, 
  Statistic, 
  Badge,
  Tooltip,
  Modal,
  message,
  Spin,
  Empty,
  Typography,
  Descriptions,
  Alert,
  Select,
  Divider
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { Search } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

const PendingTasksPage = () => {
  console.log('🔄 PendingTasksPage 組件被載入');
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pendingEforms, setPendingEforms] = useState([]);
  const [selectedEform, setSelectedEform] = useState(null);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [processingEform, setProcessingEform] = useState(null);
  const [statistics, setStatistics] = useState({
    total: 0,
    pending: 0,
    overdue: 0,
    urgent: 0
  });
  const [filters, setFilters] = useState({
    searchText: '',
    priority: 'all',
    dateRange: null
  });

  useEffect(() => {
    loadPendingEforms();
    loadStatistics();
  }, []);

  useEffect(() => {
    loadPendingEforms();
  }, [filters]);

  const loadPendingEforms = async () => {
    setLoading(true);
    try {
      // 構建查詢參數
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50'
      });

      if (filters.searchText) {
        params.append('search', filters.searchText);
      }

      if (filters.priority !== 'all') {
        params.append('priority', filters.priority);
      }

      console.log('載入待處理事項，查詢參數:', params.toString());

      const response = await fetch(`/api/eforminstances/pending?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`載入待處理事項失敗: ${response.status}`);
      }

      const data = await response.json();
      console.log('載入到的待處理事項:', data);
      
      // 轉換數據格式以匹配前端期望的結構
      const formattedData = data.data?.map(item => ({
        id: item.id,
        formName: item.formName,
        instanceName: item.instanceName,
        status: item.status,
        priority: item.priority || 'Medium',
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        dueDate: item.dueDate,
        workflowInstanceId: item.workflowInstanceId,
        userMessage: item.userMessage,
        formData: {} // 實際表單數據需要通過單獨的 API 獲取
      })) || [];
      
      setPendingEforms(formattedData);
      setStatistics(prev => ({ 
        ...prev, 
        total: data.total || 0,
        pending: formattedData.length
      }));
      
    } catch (error) {
      console.error('載入待處理事項失敗:', error);
      message.error('載入待處理事項失敗: ' + error.message);
      
      // 如果 API 失敗，使用空數組
      setPendingEforms([]);
      setStatistics(prev => ({ 
        ...prev, 
        total: 0,
        pending: 0
      }));
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      console.log('載入統計數據');
      
      const response = await fetch('/api/eforminstances/statistics/pending', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`載入統計數據失敗: ${response.status}`);
      }

      const data = await response.json();
      console.log('載入到的統計數據:', data);
      
      setStatistics(data);
    } catch (error) {
      console.error('載入統計數據失敗:', error);
      
      // 如果 API 失敗，使用默認值
      setStatistics({
        total: 0,
        pending: 0,
        overdue: 0,
        urgent: 0
      });
    }
  };

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, searchText: value }));
  };

  const handlePriorityFilter = (value) => {
    setFilters(prev => ({ ...prev, priority: value }));
  };

  const handleViewEform = async (eform) => {
    console.log('查看表單:', eform);
    navigate(`/eform-instance/${eform.id}`);
  };

  const handleApprove = (eform) => {
    setSelectedEform(eform);
    setApproveModalVisible(true);
    setApprovalNote('');
  };

  const handleReject = (eform) => {
    setSelectedEform(eform);
    setRejectModalVisible(true);
    setApprovalNote('');
  };

  const processApproval = async (action) => {
    if (!selectedEform) return;

    setProcessingEform(selectedEform.id);
    try {
      console.log(`處理 ${action} 操作，表單 ID: ${selectedEform.id}`);
      
      const response = await fetch(`/api/eforminstances/${selectedEform.id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          note: approvalNote,
          approvedBy: localStorage.getItem('username') || 'current_user'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '操作失敗' }));
        throw new Error(errorData.error || `${action} 操作失敗`);
      }

      const result = await response.json();
      console.log(`${action} 操作結果:`, result);
      
      message.success(result.message || `${action === 'approve' ? '批准' : '拒絕'} 操作成功`);
      
      // 重新載入數據
      await Promise.all([
        loadPendingEforms(),
        loadStatistics()
      ]);
      
      // 關閉彈窗
      setApproveModalVisible(false);
      setRejectModalVisible(false);
      setSelectedEform(null);
      setApprovalNote('');
    } catch (error) {
      console.error(`${action} 操作失敗:`, error);
      message.error(`${action === 'approve' ? '批准' : '拒絕'} 操作失敗: ` + error.message);
    } finally {
      setProcessingEform(null);
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

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getStatusTag = (status, dueDate) => {
    const isOverdueStatus = isOverdue(dueDate);
    const color = isOverdueStatus ? 'error' : 'warning';
    const text = isOverdueStatus ? '逾期' : '待處理';
    
    return (
      <Tag color={color} icon={<ClockCircleOutlined />}>
        {text}
      </Tag>
    );
  };

  const columns = [
    {
      title: '表單名稱',
      dataIndex: 'formName',
      key: 'formName',
      width: 200,
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.instanceName}
          </Text>
        </div>
      )
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status, record) => getStatusTag(status, record.dueDate)
    },
    {
      title: '優先級',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority) => (
        <Tag color={getPriorityColor(priority)}>
          {getPriorityText(priority)}
        </Tag>
      )
    },
    {
      title: '申請人',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
      render: (text) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      )
    },
    {
      title: '申請時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: '截止時間',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 150,
      render: (date, record) => {
        const isOverdueStatus = isOverdue(date);
        return (
          <Text type={isOverdueStatus ? 'danger' : 'secondary'}>
            {dayjs(date).format('MM-DD HH:mm')}
          </Text>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="批准">
            <Button 
              type="primary"
              icon={<CheckCircleOutlined />} 
              onClick={(e) => {
                e.stopPropagation(); // 阻止行點擊事件
                handleApprove(record);
              }}
              style={{ 
                backgroundColor: '#52c41a',
                borderColor: '#52c41a',
                minWidth: '60px',
                height: '32px'
              }}
              size="small"
            >
              批准
            </Button>
          </Tooltip>
          
          <Tooltip title="拒絕">
            <Button 
              type="primary"
              danger
              icon={<CloseCircleOutlined />} 
              onClick={(e) => {
                e.stopPropagation(); // 阻止行點擊事件
                handleReject(record);
              }}
              style={{ 
                minWidth: '60px',
                height: '32px'
              }}
              size="small"
            >
              拒絕
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ padding: '24px' }}>
        {/* 頁面標題 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>
            <ClockCircleOutlined style={{ marginRight: 12, color: '#faad14' }} />
            待處理事項
          </Title>
          <Text type="secondary">
            處理等待決策的表單申請
          </Text>
        </div>

        {/* 統計卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="總待處理"
                value={statistics.total}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="待審批"
                value={statistics.pending}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="逾期項目"
                value={statistics.overdue}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="緊急項目"
                value={statistics.urgent}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 篩選和搜索 */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={8}>
              <Search
                placeholder="搜尋表單名稱、申請人..."
                value={filters.searchText}
                onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                onSearch={handleSearch}
                style={{ width: '100%' }}
              />
            </Col>
            
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="優先級"
                value={filters.priority}
                onChange={handlePriorityFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">全部</Option>
                <Option value="High">高</Option>
                <Option value="Medium">中</Option>
                <Option value="Low">低</Option>
              </Select>
            </Col>
            
            <Col xs={24} sm={12} md={4}>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={loadPendingEforms}
                loading={loading}
              >
                刷新
              </Button>
            </Col>
          </Row>
        </Card>

        {/* 待處理事項列表 */}
        <Card>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text strong>待處理事項列表</Text>
              <Badge count={pendingEforms.length} showZero />
            </Space>
          </div>
          
          <Table
            columns={columns}
            dataSource={pendingEforms}
            rowKey="id"
            loading={loading}
            onRow={(record) => ({
              onClick: () => handleViewEform(record),
              style: { cursor: 'pointer' }
            })}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `第 ${range[0]}-${range[1]} 項，共 ${total} 項`
            }}
            scroll={{ x: 1000 }}
            locale={{
              emptyText: (
                <Empty 
                  description="暫無待處理事項" 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        </Card>


        {/* 批准確認彈窗 */}
        <Modal
          title="批准申請"
          visible={approveModalVisible}
          onOk={() => processApproval('approve')}
          onCancel={() => setApproveModalVisible(false)}
          confirmLoading={processingEform === selectedEform?.id}
          okText="確認批准"
          cancelText="取消"
          okButtonProps={{ 
            type: 'primary',
            style: { backgroundColor: '#52c41a', borderColor: '#52c41a' }
          }}
        >
          <Alert
            message="確認批准"
            description={`您確定要批准「${selectedEform?.formName}」嗎？`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div>
            <Text strong>申請人：</Text>
            <Text>{selectedEform?.createdBy}</Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text strong>申請時間：</Text>
            <Text>{selectedEform?.createdAt ? dayjs(selectedEform.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
          </div>
          <Divider />
          <div>
            <Text strong>批准備註：</Text>
            <Input.TextArea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder="請輸入批准備註（可選）"
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>
        </Modal>

        {/* 拒絕確認彈窗 */}
        <Modal
          title="拒絕申請"
          visible={rejectModalVisible}
          onOk={() => processApproval('reject')}
          onCancel={() => setRejectModalVisible(false)}
          confirmLoading={processingEform === selectedEform?.id}
          okText="確認拒絕"
          cancelText="取消"
          okButtonProps={{ 
            type: 'primary',
            danger: true
          }}
        >
          <Alert
            message="確認拒絕"
            description={`您確定要拒絕「${selectedEform?.formName}」嗎？`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div>
            <Text strong>申請人：</Text>
            <Text>{selectedEform?.createdBy}</Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text strong>申請時間：</Text>
            <Text>{selectedEform?.createdAt ? dayjs(selectedEform.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
          </div>
          <Divider />
          <div>
            <Text strong>拒絕原因：</Text>
            <Input.TextArea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder="請輸入拒絕原因（必填）"
              rows={3}
              style={{ marginTop: 8 }}
              required
            />
          </div>
        </Modal>
      </Content>
    </Layout>
  );
};

export default PendingTasksPage;
