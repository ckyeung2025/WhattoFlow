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
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
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

// ResizableTitle 元件
const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[30, 0]}
      handle={
        <span
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px', cursor: 'col-resize', zIndex: 1, userSelect: 'none' }}
          onClick={e => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ position: 'relative' }} />
    </Resizable>
  );
};

const PendingTasksPage = () => {
  console.log('🔄 PendingTasksPage component loaded');
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
      // Build query parameters
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

      console.log('Loading pending tasks, query parameters:', params.toString());

      const response = await fetch(`/api/eforminstances/pending?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load pending tasks: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded pending tasks:', data);
      
      // Convert data format to match frontend expected structure
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
        formData: {} // Actual form data needs to be obtained through separate API
      })) || [];
      
      setPendingEforms(formattedData);
      setStatistics(prev => ({ 
        ...prev, 
        total: data.total || 0,
        pending: formattedData.length
      }));
      
    } catch (error) {
      console.error('Failed to load pending tasks:', error);
      message.error(t('pendingTasks.loadPendingTasksFailed') + ': ' + error.message);
      
      // If API fails, use empty array
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
      console.log('Loading statistics');
      
      const response = await fetch('/api/eforminstances/statistics/pending', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load statistics: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded statistics:', data);
      
      setStatistics(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
      
      // If API fails, use default values
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
    console.log('View form:', eform);
    // Open in new browser tab
    window.open(`/eform-instance/${eform.id}`, '_blank');
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
      console.log(`Processing ${action} operation, form ID: ${selectedEform.id}`);
      
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
        const errorData = await response.json().catch(() => ({ error: 'Operation failed' }));
        throw new Error(errorData.error || `${action} operation failed`);
      }

      const result = await response.json();
      console.log(`${action} operation result:`, result);
      
      message.success(result.message || t(`pendingTasks.${action === 'approve' ? 'approveSuccess' : 'rejectSuccess'}`));
      
      // Reload data
      await Promise.all([
        loadPendingEforms(),
        loadStatistics()
      ]);
      
      // Close modal
      setApproveModalVisible(false);
      setRejectModalVisible(false);
      setSelectedEform(null);
      setApprovalNote('');
    } catch (error) {
      console.error(`${action} operation failed:`, error);
      message.error(t(`pendingTasks.${action === 'approve' ? 'approveFailed' : 'rejectFailed'}`) + ': ' + error.message);
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
      case 'High': return t('pendingTasks.high');
      case 'Medium': return t('pendingTasks.medium');
      case 'Low': return t('pendingTasks.low');
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
    const text = isOverdueStatus ? t('pendingTasks.overdue') : t('pendingTasks.pending');
    
    return (
      <Tag color={color} icon={<ClockCircleOutlined />}>
        {text}
      </Tag>
    );
  };

  // columns 狀態化與寬度調整
  const baseColumns = [
    {
      title: t('pendingTasks.formName'),
      dataIndex: 'formName',
      key: 'formName',
      width: 200,
      sorter: (a, b) => a.formName.localeCompare(b.formName),
      sortDirections: ['ascend', 'descend'],
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
      title: t('pendingTasks.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: (a, b) => {
        const getStatusValue = (record) => {
          if (isOverdue(record.dueDate)) return 0; // Overdue first
          return 1; // Pending
        };
        return getStatusValue(a) - getStatusValue(b);
      },
      sortDirections: ['ascend', 'descend'],
      render: (status, record) => getStatusTag(status, record.dueDate)
    },
    {
      title: t('pendingTasks.priority'),
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      sorter: (a, b) => {
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      },
      sortDirections: ['ascend', 'descend'],
      render: (priority) => (
        <Tag color={getPriorityColor(priority)}>
          {getPriorityText(priority)}
        </Tag>
      )
    },
    {
      title: t('pendingTasks.applicant'),
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
      sorter: (a, b) => a.createdBy.localeCompare(b.createdBy),
      sortDirections: ['ascend', 'descend'],
      render: (text) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      )
    },
    {
      title: t('pendingTasks.applicationTime'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      sortDirections: ['ascend', 'descend'],
      render: (date) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: t('pendingTasks.dueDate'),
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 150,
      sorter: (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
      sortDirections: ['ascend', 'descend'],
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
      title: t('pendingTasks.action'),
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('pendingTasks.approveTooltip')}>
            <Button 
              type="primary"
              icon={<CheckCircleOutlined />} 
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click event
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
              {t('pendingTasks.approve')}
            </Button>
          </Tooltip>
          
          <Tooltip title={t('pendingTasks.rejectTooltip')}>
            <Button 
              type="primary"
              danger
              icon={<CloseCircleOutlined />} 
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click event
                handleReject(record);
              }}
              style={{ 
                minWidth: '60px',
                height: '32px'
              }}
              size="small"
            >
              {t('pendingTasks.reject')}
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  const [resizableColumns, setResizableColumns] = useState(
    baseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
  );

  const handleResize = index => (e, { size }) => {
    const nextColumns = [...resizableColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setResizableColumns(nextColumns);
  };

  const mergedColumns = resizableColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handleResize(index),
    }),
  }));

  const components = {
    header: {
      cell: ResizableTitle,
    },
  };


  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ padding: '24px' }}>
        {/* Page Title */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>
            <ClockCircleOutlined style={{ marginRight: 12, color: '#faad14' }} />
            {t('pendingTasks.title')}
          </Title>
          <Text type="secondary">
            {t('pendingTasks.description')}
          </Text>
        </div>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('pendingTasks.totalPending')}
                value={statistics.total}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('pendingTasks.pendingApproval')}
                value={statistics.pending}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('pendingTasks.overdueItems')}
                value={statistics.overdue}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('pendingTasks.urgentItems')}
                value={statistics.urgent}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filter and Search */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={8}>
              <Search
                placeholder={t('pendingTasks.searchPlaceholder')}
                value={filters.searchText}
                onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                onSearch={handleSearch}
                style={{ width: '100%' }}
              />
            </Col>
            
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder={t('pendingTasks.priorityPlaceholder')}
                value={filters.priority}
                onChange={handlePriorityFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">{t('pendingTasks.all')}</Option>
                <Option value="High">{t('pendingTasks.high')}</Option>
                <Option value="Medium">{t('pendingTasks.medium')}</Option>
                <Option value="Low">{t('pendingTasks.low')}</Option>
              </Select>
            </Col>
            
            <Col xs={24} sm={12} md={4}>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={loadPendingEforms}
                loading={loading}
              >
                {t('pendingTasks.refresh')}
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Pending Tasks List */}
        <Card>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text strong>{t('pendingTasks.pendingTasksList')}</Text>
              <Badge count={pendingEforms.length} showZero />
            </Space>
          </div>
          
          <Table
            components={components}
            columns={mergedColumns}
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
                t('pendingTasks.pageRange', { start: range[0], end: range[1], total })
            }}
            scroll={{ x: 1000 }}
            locale={{
              emptyText: (
                <Empty 
                  description={t('pendingTasks.noPendingTasks')} 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        </Card>


        {/* Approval Confirmation Modal */}
        <Modal
          title={t('pendingTasks.approveApplication')}
          visible={approveModalVisible}
          onOk={() => processApproval('approve')}
          onCancel={() => setApproveModalVisible(false)}
          confirmLoading={processingEform === selectedEform?.id}
          okText={t('pendingTasks.confirmApprove')}
          cancelText={t('pendingTasks.cancel')}
          okButtonProps={{ 
            type: 'primary',
            style: { backgroundColor: '#52c41a', borderColor: '#52c41a' }
          }}
        >
          <Alert
            message={t('pendingTasks.confirmApproval')}
            description={`${t('pendingTasks.confirmApproval')}「${selectedEform?.formName}」？`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div>
            <Text strong>{t('pendingTasks.applicantLabel')}</Text>
            <Text>{selectedEform?.createdBy}</Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text strong>{t('pendingTasks.applicationTimeLabel')}</Text>
            <Text>{selectedEform?.createdAt ? dayjs(selectedEform.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
          </div>
          <Divider />
          <div>
            <Text strong>{t('pendingTasks.approvalNote')}：</Text>
            <Input.TextArea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder={t('pendingTasks.approvalNotePlaceholder')}
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>
        </Modal>

        {/* Rejection Confirmation Modal */}
        <Modal
          title={t('pendingTasks.rejectApplication')}
          visible={rejectModalVisible}
          onOk={() => processApproval('reject')}
          onCancel={() => setRejectModalVisible(false)}
          confirmLoading={processingEform === selectedEform?.id}
          okText={t('pendingTasks.confirmReject')}
          cancelText={t('pendingTasks.cancel')}
          okButtonProps={{ 
            type: 'primary',
            danger: true
          }}
        >
          <Alert
            message={t('pendingTasks.confirmRejection')}
            description={`${t('pendingTasks.confirmRejection')}「${selectedEform?.formName}」？`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div>
            <Text strong>{t('pendingTasks.applicantLabel')}</Text>
            <Text>{selectedEform?.createdBy}</Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text strong>{t('pendingTasks.applicationTimeLabel')}</Text>
            <Text>{selectedEform?.createdAt ? dayjs(selectedEform.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
          </div>
          <Divider />
          <div>
            <Text strong>{t('pendingTasks.rejectionReason')}：</Text>
            <Input.TextArea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder={t('pendingTasks.rejectionReasonPlaceholder')}
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
