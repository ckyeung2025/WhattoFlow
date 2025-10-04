import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Input, 
  Select, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  Badge,
  Tooltip,
  Modal,
  message,
  Spin,
  Empty,
  Typography,
  Divider,
  Timeline,
  Descriptions,
  Tabs,
  Alert,
  Switch,
  TimePicker,
  DatePicker
} from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  StopOutlined, 
  ReloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  BarChartOutlined,
  SettingOutlined,
  DownloadOutlined,
  FilterOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
  SyncOutlined as SyncOutlinedIcon,
  MessageOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  FolderOutlined,
  FileImageOutlined,
  FileOutlined,
  LeftOutlined,
  RightOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined as ResetOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { useLanguage } from '../contexts/LanguageContext';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import WhatsAppChat from '../components/WhatsAppChat';

dayjs.extend(duration);

const { Header, Content } = Layout;
const { Search } = Input;
const { Option } = Select;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

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

const WorkflowMonitorPage = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState([]);
  const [selectedInstances, setSelectedInstances] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: 'all',
    workflowName: '',
    startDateRange: null,
    endDateRange: null,
    searchText: ''
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [statistics, setStatistics] = useState({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    waiting: 0,
    averageExecutionTime: 0,
    successRate: 0
  });
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [selectedChatInstance, setSelectedChatInstance] = useState(null);
  const [messageSendModalVisible, setMessageSendModalVisible] = useState(false);
  const [selectedMessageSend, setSelectedMessageSend] = useState(null);
  const [messageSendDetailModalVisible, setMessageSendDetailModalVisible] = useState(false);
  const [selectedMessageSendDetail, setSelectedMessageSendDetail] = useState(null);
  
  // 表格列寬調整相關狀態
  const [resizableColumns, setResizableColumns] = useState([]);

  // 載入真實數據
  useEffect(() => {
    loadInstances();
    loadStatistics();
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadInstances();
        loadStatistics();
      }, refreshInterval * 1000);
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // 當篩選條件改變時，重新載入數據
  useEffect(() => {
    loadInstances();
  }, [filters, pagination.current, pagination.pageSize]);

  const loadInstances = async (sortBy = 'startedAt', sortOrder = 'desc') => {
    console.log(t('workflowMonitor.startLoadingInstances', { sortBy, sortOrder }));
    setLoading(true);
    try {
      // 構建查詢參數
      const params = new URLSearchParams({
        page: pagination.current,
        pageSize: pagination.pageSize,
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }

      if (filters.searchText) {
        params.append('search', filters.searchText);
      }

      if (filters.startDateRange && filters.startDateRange.length === 2) {
        params.append('startDateFrom', filters.startDateRange[0].toISOString());
        params.append('startDateTo', filters.startDateRange[1].toISOString());
      }

      if (filters.endDateRange && filters.endDateRange.length === 2) {
        params.append('endDateFrom', filters.endDateRange[0].toISOString());
        params.append('endDateTo', filters.endDateRange[1].toISOString());
      }

      const url = `/api/workflowexecutions/monitor?${params}`;
      console.log(t('workflowMonitor.requestUrl'), url);
      console.log(t('workflowMonitor.requestParams'), Object.fromEntries(params));
      console.log(t('workflowMonitor.currentPaginationParams'), { current: pagination.current, pageSize: pagination.pageSize });

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadInstancesFailed'));
      }

      const data = await response.json();
      console.log(t('workflowMonitor.dataFromMonitorApi'), data);
      console.log(t('workflowMonitor.instanceDataStructure'), data.data);
      console.log(t('workflowMonitor.paginationInfo'), { page: data.page, pageSize: data.pageSize, total: data.total });
      
      // 檢查第一個實例是否包含 InputJson 字段
      if (data.data && data.data.length > 0) {
        const firstInstance = data.data[0];
        console.log(t('workflowMonitor.firstInstanceCompleteData'), firstInstance);
        console.log(t('workflowMonitor.inputJsonField'), firstInstance.inputJson);
        console.log(t('workflowMonitor.inputJsonType'), typeof firstInstance.inputJson);
        if (firstInstance.inputJson) {
          try {
            const parsedInput = JSON.parse(firstInstance.inputJson);
            console.log(t('workflowMonitor.parsedInputJson'), parsedInput);
          } catch (parseError) {
            console.error(t('workflowMonitor.parseInputJsonFailed'), parseError);
          }
        }
      }
      
      setInstances(data.data);
      setPagination(prev => ({ 
        ...prev, 
        total: data.total,
        current: data.page,
        pageSize: data.pageSize
      }));
    } catch (error) {
      message.error(t('workflowMonitor.loadInstancesFailed') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch('/api/workflowexecutions/monitor/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadStatisticsFailed'));
      }

      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error(t('workflowMonitor.loadStatisticsFailed'), error);
    }
  };

  const handleStatusFilter = (value) => {
    setFilters(prev => ({ ...prev, status: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, searchText: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleStartDateRangeChange = (dates) => {
    setFilters(prev => ({ ...prev, startDateRange: dates }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleEndDateRangeChange = (dates) => {
    setFilters(prev => ({ ...prev, endDateRange: dates }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleInstanceAction = async (action, instance) => {
    try {
      const response = await fetch(`/api/workflowexecutions/${instance.id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('workflowMonitor.operationFailed'));
      }

      const result = await response.json();
      message.success(result.message || t('workflowMonitor.operationSuccess', { action }));
      
      // 重新載入數據
      loadInstances();
      loadStatistics();
    } catch (error) {
      message.error(t('workflowMonitor.operationFailed', { action }) + ': ' + error.message);
    }
  };

  const handleViewDetails = async (instance) => {
    try {
      const response = await fetch(`/api/workflowexecutions/${instance.id}/details`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadDetailsFailed'));
      }

      const details = await response.json();
      setSelectedInstance(details);
      setDetailModalVisible(true);
    } catch (error) {
      message.error(t('workflowMonitor.loadDetailsFailed') + ': ' + error.message);
    }
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      running: { color: 'processing', icon: <SyncOutlinedIcon spin />, text: t('workflowMonitor.statusRunning') },
      completed: { color: 'success', icon: <CheckCircleFilled />, text: t('workflowMonitor.statusCompleted') },
      failed: { color: 'error', icon: <CloseCircleFilled />, text: t('workflowMonitor.statusFailed') },
      waiting: { color: 'warning', icon: <ClockCircleFilled />, text: t('workflowMonitor.statusWaiting') },
      paused: { color: 'default', icon: <PauseCircleOutlined />, text: t('workflowMonitor.statusPaused') },
      cancelled: { color: 'default', icon: <StopOutlined />, text: t('workflowMonitor.statusCancelled') }
    };
    
    const config = statusConfig[status.toLowerCase()] || statusConfig.running;
    
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const getDurationText = (duration) => {
    if (!duration) return '-';
    if (duration < 60) return `${Math.round(duration)} ${t('workflowMonitor.minutes')}`;
    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    return `${hours} ${t('workflowMonitor.hours')} ${minutes} ${t('workflowMonitor.minutes')}`;
  };

  // 打開 WhatsApp 對話框
  const handleOpenChat = (instance) => {
    console.log(t('workflowMonitor.openWhatsAppChat'), instance);
    console.log(t('workflowMonitor.instanceId'), instance.id);
    console.log(t('workflowMonitor.inputJsonField'), instance.inputJson);
    console.log(t('workflowMonitor.inputJsonType'), typeof instance.inputJson);
    
    if (instance.inputJson) {
      try {
        const parsedInput = JSON.parse(instance.inputJson);
        console.log(t('workflowMonitor.parsedInputJson'), parsedInput);
        console.log(t('workflowMonitor.availableFields'), Object.keys(parsedInput));
      } catch (parseError) {
        console.error(t('workflowMonitor.parseInputJsonFailed'), parseError);
      }
    } else {
      console.warn(t('workflowMonitor.noInputJsonField'));
      console.log(t('workflowMonitor.availableFields'), Object.keys(instance));
    }
    
    setSelectedChatInstance(instance);
    setChatModalVisible(true);
  };

  // 處理發送消息
  const handleSendMessage = (message) => {
    console.log(t('workflowMonitor.sendMessage'), message);
    // 這裡可以添加額外的邏輯，比如更新實例狀態等
  };

  // 查看消息發送詳情
  const handleViewMessageSend = async (messageSendId) => {
    try {
      const response = await fetch(`/api/workflowmessagesend/${messageSendId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadMessageSendDetailsFailed'));
      }

      const data = await response.json();
      setSelectedMessageSend(data.data);
      setMessageSendModalVisible(true);
    } catch (error) {
      message.error(t('workflowMonitor.loadMessageSendDetailsFailed') + ': ' + error.message);
    }
  };

  // 查看消息發送詳細狀態（包含收件人詳情）
  const handleViewMessageSendDetail = async (messageSendId) => {
    try {
      const response = await fetch(`/api/workflowmessagesend/${messageSendId}/detail`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadMessageSendStatusFailed'));
      }

      const data = await response.json();
      setSelectedMessageSendDetail(data.data);
      setMessageSendDetailModalVisible(true);
    } catch (error) {
      message.error(t('workflowMonitor.loadMessageSendStatusFailed') + ': ' + error.message);
    }
  };

  // 表格列寬調整處理
  const handleResize = index => (e, { size }) => {
    const nextColumns = [...resizableColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setResizableColumns(nextColumns);
  };

  // 表格變化處理（包括排序）
  const handleTableChange = (paginationInfo, filters, sorter) => {
    console.log(t('workflowMonitor.tableChange'), { paginationInfo, filters, sorter });
    console.log(t('workflowMonitor.sorterDetails'), {
      field: sorter?.field,
      order: sorter?.order,
      columnKey: sorter?.columnKey,
      column: sorter?.column
    });
    
    // 處理分頁
    if (paginationInfo) {
      console.log(t('workflowMonitor.paginationChange'), paginationInfo);
      setPagination(prev => ({ 
        ...prev, 
        current: paginationInfo.current, 
        pageSize: paginationInfo.pageSize 
      }));
    }
    
    // 處理排序
    if (sorter && sorter.field) {
      console.log(t('workflowMonitor.sortField'), sorter.field, t('workflowMonitor.sortOrder'), sorter.order);
      // 重新載入數據以應用排序
      loadInstances(sorter.field, sorter.order);
    } else if (paginationInfo) {
      // 只有分頁變更時
      console.log(t('workflowMonitor.paginationOnlyDefaultSort'));
      loadInstances();
    }
  };

  // 基礎表格列定義
  const baseColumns = [
    {
      title: t('workflowMonitor.instanceId'),
      dataIndex: 'id',
      key: 'id',
      width: 120,
      ellipsis: true,
      sorter: true,
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: t('workflowMonitor.workflowName'),
      dataIndex: 'workflowName',
      key: 'workflowName',
      width: 200,
      ellipsis: true,
      sorter: true,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: t('workflowMonitor.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: true,
      render: (status) => getStatusTag(status)
    },
    {
      title: t('workflowMonitor.currentStep'),
      dataIndex: 'currentStep',
      key: 'currentStep',
      width: 120,
      sorter: true,
      render: (step, record) => {
        if (record.status === 'running' && step !== null) {
          return (
            <div>
              <Text>{step}</Text>
              <Progress 
                percent={Math.min((step / record.stepCount) * 100, 100)} 
                size="small" 
                showInfo={false}
                strokeColor="#1890ff"
              />
            </div>
          );
        }
        return step || '-';
      }
    },
    {
      title: t('workflowMonitor.startedAt'),
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 150,
      sorter: true,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: t('workflowMonitor.duration'),
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      sorter: true,
      render: (duration, record) => {
        if (record.status === 'running') {
          const runningDuration = dayjs.duration(dayjs().diff(dayjs(record.startedAt))).asMinutes();
          return getDurationText(runningDuration);
        }
        return getDurationText(duration);
      }
    },
    {
      title: t('workflowMonitor.createdBy'),
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
      sorter: true
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 250, // 增加寬度以容納新按鈕
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('workflowMonitor.viewDetails')}>
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          
          {/* WhatsApp 對話按鈕 */}
          <Tooltip title={t('workflowMonitor.whatsappChat')}>
            <Button 
              type="text" 
              icon={<MessageOutlined />} 
              onClick={() => handleOpenChat(record)}
              style={{ color: '#25d366' }}
            />
          </Tooltip>
          
          {record.status === 'running' && (
            <>
              <Tooltip title={t('workflowMonitor.pause')}>
                <Button 
                  type="text" 
                  icon={<PauseCircleOutlined />} 
                  onClick={() => handleInstanceAction('pause', record)}
                />
              </Tooltip>
              <Tooltip title={t('workflowMonitor.cancel')}>
                <Button 
                  type="text" 
                  icon={<StopOutlined />} 
                  onClick={() => handleInstanceAction('cancel', record)}
                />
              </Tooltip>
            </>
          )}
          
          {record.status === 'failed' && (
            <Tooltip title={t('workflowMonitor.retry')}>
              <Button 
                type="text" 
                icon={<ReloadOutlined />} 
                onClick={() => handleInstanceAction('retry', record)}
              />
            </Tooltip>
          )}
          
          {(record.status === 'waiting' || record.status === 'paused') && (
            <Tooltip title={t('workflowMonitor.resume')}>
              <Button 
                type="text" 
                icon={<PlayCircleOutlined />} 
                onClick={() => handleInstanceAction('resume', record)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  // 初始化可調整列寬的列配置
  useEffect(() => {
    if (resizableColumns.length === 0) {
      setResizableColumns(
        baseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
      );
    }
  }, [baseColumns, resizableColumns.length]);

  // 合併列配置，添加調整功能
  const mergedColumns = resizableColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handleResize(index),
    }),
  }));

  // 表格組件配置
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ padding: '24px' }}>
        {/* 頁面標題 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>
            <BarChartOutlined style={{ marginRight: 12, color: '#1890ff' }} />
            {t('workflowMonitor.runningAppsTitle')}
          </Title>
          <Text type="secondary">
            {t('workflowMonitor.runningAppsDescription')}
          </Text>
        </div>

        {/* 統計卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('workflowMonitor.totalInstancesCount')}
                value={statistics.total}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('workflowMonitor.runningCount')}
                value={statistics.running}
                prefix={<SyncOutlinedIcon spin />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('workflowMonitor.completedCount')}
                value={statistics.completed}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('workflowMonitor.successRate')}
                value={statistics.successRate}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 篩選和搜索 */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={6}>
              <Select
                placeholder={t('workflowMonitor.selectStatus')}
                value={filters.status}
                onChange={handleStatusFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">{t('workflowMonitor.filterAll')}</Option>
                <Option value="running">{t('workflowMonitor.filterRunning')}</Option>
                <Option value="completed">{t('workflowMonitor.filterCompleted')}</Option>
                <Option value="failed">{t('workflowMonitor.filterFailed')}</Option>
                <Option value="waiting">{t('workflowMonitor.filterWaiting')}</Option>
              </Select>
            </Col>
            
            <Col xs={24} sm={12} md={6}>
              <RangePicker
                placeholder={[t('workflowMonitor.startDateRange'), t('workflowMonitor.startDateRange')]}
                value={filters.startDateRange}
                onChange={handleStartDateRangeChange}
                style={{ width: '100%' }}
              />
            </Col>
            
            <Col xs={24} sm={12} md={6}>
              <RangePicker
                placeholder={[t('workflowMonitor.endDateRange'), t('workflowMonitor.endDateRange')]}
                value={filters.endDateRange}
                onChange={handleEndDateRangeChange}
                style={{ width: '100%' }}
              />
            </Col>
            
            <Col xs={24} sm={12} md={6}>
              <Search
                placeholder={t('workflowMonitor.searchPlaceholder')}
                value={filters.searchText}
                onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                onSearch={handleSearch}
                style={{ width: '100%' }}
              />
            </Col>
            
            <Col xs={24} sm={12} md={6}>
              <Space>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={loadInstances}
                  loading={loading}
                >
                  {t('workflowMonitor.refresh')}
                </Button>
                
                <Tooltip title={t('workflowMonitor.autoRefreshSettings')}>
                  <Button 
                    icon={<SettingOutlined />}
                    onClick={() => {/* 打開設置彈窗 */}}
                  />
                </Tooltip>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 實例列表 */}
        <Card>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text strong>{t('workflowMonitor.instanceList')}</Text>
              <Badge count={instances.length} showZero />
              
              {selectedInstances.length > 0 && (
                <Text type="secondary">
                  {t('workflowMonitor.selectedInstances', { count: selectedInstances.length })}
                </Text>
              )}
            </Space>
          </div>
          
          <Table
            components={components}
            columns={mergedColumns}
            dataSource={instances}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                t('workflowMonitor.paginationTotal', { start: range[0], end: range[1], total })
            }}
            rowSelection={{
              selectedRowKeys: selectedInstances.map(i => i.id),
              onChange: (selectedRowKeys, selectedRows) => {
                setSelectedInstances(selectedRows);
              }
            }}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
          />
        </Card>

        {/* 實例詳情彈窗 */}
        <Modal
          title={t('workflowMonitor.instanceDetails')}
          visible={detailModalVisible}
          onCancel={() => setDetailModalVisible(false)}
          footer={null}
          width={800}
        >
          {selectedInstance && (
            <InstanceDetailModal 
              instance={selectedInstance} 
              onClose={() => setDetailModalVisible(false)}
              onViewMessageSend={handleViewMessageSend}
              onViewMessageSendDetail={handleViewMessageSendDetail}
            />
          )}
        </Modal>

        {/* WhatsApp 對話框 */}
        <WhatsAppChat
          visible={chatModalVisible}
          onClose={() => setChatModalVisible(false)}
          instance={selectedChatInstance}
          onSendMessage={handleSendMessage}
        />

        {/* 消息發送詳情模態框 */}
        <Modal
          title={t('workflowMonitor.messageSendDetails')}
          visible={messageSendModalVisible}
          onCancel={() => setMessageSendModalVisible(false)}
          footer={null}
          width={1000}
        >
          {selectedMessageSend && (
            <MessageSendDetailModal 
              messageSend={selectedMessageSend} 
              onClose={() => setMessageSendModalVisible(false)}
            />
          )}
        </Modal>

        {/* 消息發送詳細狀態模態框 */}
        <Modal
          title={t('workflowMonitor.messageSendStatusDetails')}
          visible={messageSendDetailModalVisible}
          onCancel={() => setMessageSendDetailModalVisible(false)}
          footer={null}
          width={1200}
        >
          {selectedMessageSendDetail && (
            <MessageSendStatusDetailModal 
              messageSend={selectedMessageSendDetail} 
              onClose={() => setMessageSendDetailModalVisible(false)}
              onViewMessageSend={handleViewMessageSend}
              onViewMessageSendDetail={handleViewMessageSendDetail}
            />
          )}
        </Modal>
      </Content>
    </Layout>
  );
};

// 實例詳情組件
const InstanceDetailModal = ({ instance, onClose, onViewMessageSend, onViewMessageSendDetail }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('basic');
  const [eformInstances, setEformInstances] = useState([]);
  const [loadingEforms, setLoadingEforms] = useState(false);
  const [processVariables, setProcessVariables] = useState([]);
  const [loadingProcessVariables, setLoadingProcessVariables] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loadingMediaFiles, setLoadingMediaFiles] = useState(false);
  const [messageValidations, setMessageValidations] = useState([]);
  const [loadingMessageValidations, setLoadingMessageValidations] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxFile, setLightboxFile] = useState(null);
  const [lightboxFiles, setLightboxFiles] = useState([]);
  const [lightboxCurrentIndex, setLightboxCurrentIndex] = useState(0);
  const [lightboxTransform, setLightboxTransform] = useState({
    rotate: 0,
    scale: 1,
    flipH: false,
    flipV: false
  });

  // 載入表單實例數據
  useEffect(() => {
    if (activeTab === 'forms') {
      loadEformInstances();
    }
  }, [activeTab, instance.id]);

  // 載入流程變量數據
  useEffect(() => {
    if (activeTab === 'variables') {
      loadProcessVariables();
    }
  }, [activeTab, instance.id]);

  // 載入媒體文件數據
  useEffect(() => {
    if (activeTab === 'media') {
      loadMediaFiles();
    }
  }, [activeTab, instance.id]);

  // 載入消息驗證數據
  useEffect(() => {
    if (activeTab === 'history') {
      loadMessageValidations();
    }
  }, [activeTab, instance.id]);

  // 鍵盤快捷鍵支持
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!lightboxVisible) return;
      
      switch (event.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          if (lightboxFiles.length > 1) {
            goToPrevious();
          }
          break;
        case 'ArrowRight':
          if (lightboxFiles.length > 1) {
            goToNext();
          }
          break;
        case 'r':
        case 'R':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            rotateImage('right');
          }
          break;
        case 'l':
        case 'L':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            rotateImage('left');
          }
          break;
        case 'h':
        case 'H':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            flipImage('horizontal');
          }
          break;
        case 'v':
        case 'V':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            flipImage('vertical');
          }
          break;
        case '+':
        case '=':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            zoomImage('in');
          }
          break;
        case '-':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            zoomImage('out');
          }
          break;
        case '0':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            resetTransform();
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxVisible, lightboxFiles, lightboxFile]);

  const loadEformInstances = async () => {
    try {
      setLoadingEforms(true);
      console.log(t('workflowMonitor.loadingEformInstances', { instanceId: instance.id }));
      
      const response = await fetch(`/api/workflowexecutions/${instance.id}/eform-instances`);
      console.log(t('workflowMonitor.apiResponseStatus'), response.status);
      console.log(t('workflowMonitor.apiResponseStatusText'), response.statusText);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(t('workflowMonitor.apiEndpointNotExists'));
          // 如果 API 端點不存在，顯示提示信息
          setEformInstances([]);
          message.warning(t('workflowMonitor.eformApiNotImplemented'));
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(t('workflowMonitor.loadedEformData'), data);
      setEformInstances(data);
    } catch (error) {
      console.error(t('workflowMonitor.loadEformInstancesFailed'), error);
      
      // 根據錯誤類型顯示不同的提示信息
      if (error.message.includes('404')) {
        message.error(t('workflowMonitor.eformApiNotExists'));
      } else if (error.message.includes('500')) {
        message.error(t('workflowMonitor.backendServerError'));
      } else {
        message.error(t('workflowMonitor.loadEformInstancesFailed') + ': ' + error.message);
      }
      
      setEformInstances([]);
    } finally {
      setLoadingEforms(false);
    }
  };

  const loadProcessVariables = async () => {
    try {
      setLoadingProcessVariables(true);
      console.log(t('workflowMonitor.loadingProcessVariables', { instanceId: instance.id }));
      
      const response = await fetch(`/api/processvariables/instance-values/${instance.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(t('workflowMonitor.processVariablesApiNotExists'));
          setProcessVariables([]);
          message.warning(t('workflowMonitor.processVariablesApiNotImplemented'));
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(t('workflowMonitor.loadedProcessVariablesData'), data);
      setProcessVariables(data.data || []);
    } catch (error) {
      console.error(t('workflowMonitor.loadProcessVariablesFailed'), error);
      
      if (error.message.includes('404')) {
        message.error(t('workflowMonitor.processVariablesApiNotExists'));
      } else if (error.message.includes('500')) {
        message.error(t('workflowMonitor.backendServerError'));
      } else {
        message.error(t('workflowMonitor.loadProcessVariablesFailed') + ': ' + error.message);
      }
      
      setProcessVariables([]);
    } finally {
      setLoadingProcessVariables(false);
    }
  };

  const loadMediaFiles = async () => {
    try {
      setLoadingMediaFiles(true);
      console.log(t('workflowMonitor.loadingMediaFiles', { instanceId: instance.id }));
      
      const response = await fetch(`/api/workflowexecutions/${instance.id}/media-files`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(t('workflowMonitor.mediaFilesApiNotExists'));
          setMediaFiles([]);
          message.warning(t('workflowMonitor.mediaFilesApiNotImplemented'));
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(t('workflowMonitor.loadedMediaFilesData'), data);
      setMediaFiles(data.data || []);
    } catch (error) {
      console.error(t('workflowMonitor.loadMediaFilesFailed'), error);
      
      if (error.message.includes('404')) {
        message.error(t('workflowMonitor.mediaFilesApiNotExists'));
      } else if (error.message.includes('500')) {
        message.error(t('workflowMonitor.backendServerError'));
      } else {
        message.error(t('workflowMonitor.loadMediaFilesFailed') + ': ' + error.message);
      }
      
      setMediaFiles([]);
    } finally {
      setLoadingMediaFiles(false);
    }
  };

  const loadMessageValidations = async () => {
    try {
      setLoadingMessageValidations(true);
      console.log('加載消息驗證記錄...', instance.id);
      
      const response = await fetch(`/api/workflowexecutions/${instance.id}/message-validations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        console.log('消息驗證記錄 API 調用失敗:', response.status);
        setMessageValidations([]);
        return;
      }
      
      const data = await response.json();
      console.log('已載入消息驗證記錄:', data);
      setMessageValidations(data.data || []);
    } catch (error) {
      console.error('載入消息驗證記錄失敗:', error);
      setMessageValidations([]);
    } finally {
      setLoadingMessageValidations(false);
    }
  };

  const getEformStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'orange';
      case 'Approved': return 'green';
      case 'Rejected': return 'red';
      default: return 'default';
    }
  };

  const getEformStatusText = (status) => {
    switch (status) {
      case 'Pending': return t('workflowMonitor.eformStatusPending');
      case 'Approved': return t('workflowMonitor.eformStatusApproved');
      case 'Rejected': return t('workflowMonitor.eformStatusRejected');
      default: return status;
    }
  };

  const formatVariableValue = (value, dataType) => {
    if (value === null || value === undefined) {
      return '-';
    }

    switch (dataType.toLowerCase()) {
      case 'datetime':
        return new Date(value).toLocaleString('zh-TW');
      case 'boolean':
        return value ? t('workflowMonitor.yes') : t('workflowMonitor.no');
      case 'json':
        try {
          return JSON.stringify(JSON.parse(value), null, 2);
        } catch {
          return value.toString();
        }
      default:
        return value.toString();
    }
  };

  const getDataTypeColor = (dataType) => {
    switch (dataType.toLowerCase()) {
      case 'string': return 'blue';
      case 'int': 
      case 'decimal': return 'green';
      case 'datetime': return 'purple';
      case 'boolean': return 'orange';
      case 'text': return 'cyan';
      case 'json': return 'magenta';
      default: return 'default';
    }
  };

  // 媒體文件相關函數
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'svg':
      case 'tiff':
      case 'ico':
        return <FileImageOutlined style={{ color: '#52c41a' }} />;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'flv':
      case 'webm':
      case 'mkv':
      case 'm4v':
      case '3gp':
        return <VideoCameraOutlined style={{ color: '#1890ff' }} />;
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'aac':
      case 'flac':
      case 'm4a':
      case 'wma':
        return <FileOutlined style={{ color: '#fa8c16' }} />;
      default:
        return <FileOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  const getFileType = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'svg':
      case 'tiff':
      case 'ico':
        return 'image';
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'flv':
      case 'webm':
      case 'mkv':
      case 'm4v':
      case '3gp':
        return 'video';
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'aac':
      case 'flac':
      case 'm4a':
      case 'wma':
        return 'audio';
      default:
        return 'document';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const groupFilesByFolder = (files) => {
    const grouped = {};
    files.forEach(file => {
      const folder = file.folderPath || 'root';
      if (!grouped[folder]) {
        grouped[folder] = [];
      }
      grouped[folder].push(file);
    });
    return grouped;
  };

  // Lightbox 相關函數
  const openLightbox = (file, allFiles = []) => {
    const imageVideoFiles = allFiles.filter(f => {
      const fileType = getFileType(f.fileName);
      return fileType === 'image' || fileType === 'video';
    });
    
    const currentIndex = imageVideoFiles.findIndex(f => f.id === file.id);
    
    setLightboxFiles(imageVideoFiles);
    setLightboxFile(file);
    setLightboxCurrentIndex(currentIndex >= 0 ? currentIndex : 0);
    setLightboxTransform({
      rotate: 0,
      scale: 1,
      flipH: false,
      flipV: false
    });
    setLightboxVisible(true);
  };

  const closeLightbox = () => {
    setLightboxVisible(false);
    setLightboxFile(null);
    setLightboxFiles([]);
    setLightboxCurrentIndex(0);
    setLightboxTransform({
      rotate: 0,
      scale: 1,
      flipH: false,
      flipV: false
    });
  };

  const goToPrevious = () => {
    if (lightboxFiles.length > 0) {
      const newIndex = lightboxCurrentIndex > 0 ? lightboxCurrentIndex - 1 : lightboxFiles.length - 1;
      setLightboxCurrentIndex(newIndex);
      setLightboxFile(lightboxFiles[newIndex]);
      setLightboxTransform({
        rotate: 0,
        scale: 1,
        flipH: false,
        flipV: false
      });
    }
  };

  const goToNext = () => {
    if (lightboxFiles.length > 0) {
      const newIndex = lightboxCurrentIndex < lightboxFiles.length - 1 ? lightboxCurrentIndex + 1 : 0;
      setLightboxCurrentIndex(newIndex);
      setLightboxFile(lightboxFiles[newIndex]);
      setLightboxTransform({
        rotate: 0,
        scale: 1,
        flipH: false,
        flipV: false
      });
    }
  };

  const rotateImage = (direction) => {
    setLightboxTransform(prev => ({
      ...prev,
      rotate: prev.rotate + (direction === 'left' ? -90 : 90)
    }));
  };

  const flipImage = (direction) => {
    setLightboxTransform(prev => ({
      ...prev,
      flipH: direction === 'horizontal' ? !prev.flipH : prev.flipH,
      flipV: direction === 'vertical' ? !prev.flipV : prev.flipV
    }));
  };

  const zoomImage = (direction) => {
    setLightboxTransform(prev => ({
      ...prev,
      scale: direction === 'in' 
        ? Math.min(prev.scale * 1.2, 5) 
        : Math.max(prev.scale / 1.2, 0.1)
    }));
  };

  const resetTransform = () => {
    setLightboxTransform({
      rotate: 0,
      scale: 1,
      flipH: false,
      flipV: false
    });
  };

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={t('workflowMonitor.basicInfo')} key="basic">
          <Descriptions bordered column={2}>
            <Descriptions.Item label={t('workflowMonitor.instanceId')}>{instance.id}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.workflowName')}>{instance.workflowName}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.status')}>
              {instance.status?.toLowerCase() === 'running' ? (
                <Tag color="processing" icon={<SyncOutlinedIcon spin />}>
                  {t('workflowMonitor.statusRunning')}
                </Tag>
              ) : instance.status?.toLowerCase() === 'completed' ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  {instance.status}
                </Tag>
              ) : instance.status?.toLowerCase() === 'waiting' || instance.status?.toLowerCase() === 'waitingforqrcode' ? (
                <Tag color="warning" icon={<ClockCircleOutlined />}>
                  {instance.status}
                </Tag>
              ) : instance.status?.toLowerCase() === 'failed' || instance.status?.toLowerCase() === 'error' ? (
                <Tag color="error" icon={<CloseCircleOutlined />}>
                  {instance.status}
                </Tag>
              ) : (
                <Tag color="default">
                  {instance.status}
                </Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.currentStep')}>
              {instance.currentStep || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.startedAt')}>
              {dayjs(instance.startedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.endedAt')}>
              {instance.endedAt ? dayjs(instance.endedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.duration')}>
              {instance.duration ? `${Math.round(instance.duration)} ${t('workflowMonitor.minutes')}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.createdBy')}>{instance.createdBy}</Descriptions.Item>
          </Descriptions>
          
          {instance.errorMessage && (
            <Alert
              message={t('workflowMonitor.errorMessage')}
              description={instance.errorMessage}
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.executionHistory')} key="history">
          <Timeline>
            <Timeline.Item color="green">
              <p>{t('workflowMonitor.workflowStarted')}</p>
              <p>{dayjs(instance.startedAt).format('YYYY-MM-DD HH:mm:ss')}</p>
            </Timeline.Item>
            {instance.stepExecutions && instance.stepExecutions.length > 0 ? (
              instance.stepExecutions.map((step, index) => {
                // 調試信息：檢查步驟數據結構
                console.log(t('workflowMonitor.stepData', { stepNumber: index + 1 }), step);
                console.log(t('workflowMonitor.stepAvailableFields', { stepNumber: index + 1 }), Object.keys(step));
                console.log('🔍 Step Type Fields:', {
                  stepType: step.stepType,
                  nodeType: step.nodeType,
                  type: step.type,
                  taskType: step.taskType,
                  stepName: step.stepName,
                  nodeName: step.nodeName
                });
                console.log(t('workflowMonitor.stepOutputJson', { stepNumber: index + 1 }), step.outputJson);
                console.log(t('workflowMonitor.stepOutputJsonCapital', { stepNumber: index + 1 }), step.OutputJson);
                console.log(t('workflowMonitor.stepOutput', { stepNumber: index + 1 }), step.output);
                console.log(t('workflowMonitor.stepErrorMessage', { stepNumber: index + 1 }), step.errorMessage);
                
                // 解析 OutputJson 來判斷是否為錯誤
                let outputData = null;
                let isError = false;
                let displayMessage = '';
                
                // 嘗試多個可能的字段名稱
                const jsonContent = step.outputJson || step.OutputJson || step.output;
                
                if (jsonContent) {
                  try {
                    outputData = JSON.parse(jsonContent);
                    console.log(t('workflowMonitor.stepParsedData', { stepNumber: index + 1 }), outputData);
                    
                    // 優先檢查 success 字段
                    if (outputData.success === true) {
                      isError = false;
                      displayMessage = outputData.message || t('workflowMonitor.operationSuccess');
                      console.log(t('workflowMonitor.stepDetectedSuccess', { stepNumber: index + 1 }));
                    }
                    // 檢查是否包含錯誤信息
                    else if (outputData.error) {
                      isError = true;
                      displayMessage = outputData.error;
                      console.log(t('workflowMonitor.stepDetectedError', { stepNumber: index + 1 }));
                    } 
                    // 檢查 message 字段
                    else if (outputData.message) {
                      // 檢查是否為成功的狀態更新消息
                      if (outputData.message.includes("User replied, continuing workflow") || 
                          outputData.message.includes("EForm sent successfully") ||
                          outputData.message.includes("Form already processed") ||
                          outputData.message.includes("waiting for approval") ||
                          outputData.message.includes("Waiting for user reply")) {
                        isError = false;
                        displayMessage = outputData.message;
                        console.log(t('workflowMonitor.stepDetectedSuccessMessage', { stepNumber: index + 1 }));
                      } else {
                        // 默認情況下，message 字段通常表示信息，不是錯誤
                        isError = false;
                        displayMessage = outputData.message;
                        console.log(t('workflowMonitor.stepDetectedNormalMessage', { stepNumber: index + 1 }));
                      }
                    }
                    // 檢查是否為 switch 節點的正常輸出（包含 selectedPaths 等字段）
                    else if (outputData.selectedPaths || outputData.selectedPath || outputData.evaluatedAt) {
                      isError = false;
                      displayMessage = JSON.stringify(outputData, null, 2);
                      console.log(t('workflowMonitor.stepDetectedSwitchOutput', { stepNumber: index + 1 }));
                    }
                    // 如果沒有明確的字段，檢查整個 JSON 內容
                    else {
                      // 如果沒有明確的錯誤標識，通常不是錯誤
                      isError = false;
                      displayMessage = JSON.stringify(outputData, null, 2);
                      console.log(t('workflowMonitor.stepNoClearFields', { stepNumber: index + 1 }));
                    }
                  } catch (parseError) {
                    console.error(t('workflowMonitor.stepParseJsonFailed', { stepNumber: index + 1 }), parseError);
                    // 如果解析失敗，將原始內容作為普通信息顯示
                    displayMessage = jsonContent;
                    isError = false; // 解析失敗不一定是錯誤
                  }
                } else {
                  console.log(t('workflowMonitor.stepNoJsonContentField', { stepNumber: index + 1 }));
                }
                
                console.log(t('workflowMonitor.stepFinalResult', { stepNumber: index + 1 }), { isError, displayMessage });
                
                // 檢查是否為發送消息的節點
                const isMessageSendNode = (step.stepName && (
                  step.stepName.includes('sendWhatsApp') || 
                  step.stepName.includes('sendWhatsAppTemplate') ||
                  step.stepName.includes('sendEForm')
                )) || (step.stepType && (
                  step.stepType.includes('sendWhatsApp') || 
                  step.stepType.includes('sendWhatsAppTemplate') ||
                  step.stepType.includes('sendEForm')
                ));
                
                // 調試信息
                if (step.stepName && step.stepName.includes('sendWhatsApp')) {
                  console.log(t('workflowMonitor.stepIsSendWhatsAppNode', { stepNumber: index + 1, stepName: step.stepName }), {
                    stepName: step.stepName,
                    stepType: step.stepType,
                    status: step.status,
                    isMessageSendNode: isMessageSendNode,
                    outputData: outputData,
                    hasMessageSendId: outputData && outputData.messageSendId
                  });
                }

                // 優先使用 taskName，如果沒有則使用 stepName
                const displayName = step.taskName || step.stepName || `${t('workflowMonitor.step')} ${index + 1}`;
                const nodeType = step.stepType || step.nodeType || step.type;
                
                // 查找該步驟的用戶回覆（waitReply 或 waitForQRCode）
                // 使用 step.stepIndex 而不是數組索引 index
                const stepValidations = messageValidations.filter(mv => mv.stepIndex === step.stepIndex);
                const isWaitNode = nodeType === 'waitReply' || nodeType === 'waitForQRCode' || nodeType === 'waitforqrcode';
                
                // 調試日誌
                if (isWaitNode) {
                  console.log(`🔍 等待節點 "${displayName}" (stepIndex: ${step.stepIndex}):`, {
                    nodeType,
                    stepIndex: step.stepIndex,
                    totalValidations: messageValidations.length,
                    matchedValidations: stepValidations.length,
                    validations: stepValidations
                  });
                }

                return (
                  <Timeline.Item 
                    key={step.id} 
                    color={(step.status === 'Completed' || step.status === 'completed') ? 'green' : (step.status === 'Failed' || step.status === 'failed') ? 'red' : 'blue'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <Text strong style={{ fontSize: '15px' }}>
                            {displayName}
                          </Text>
                          {nodeType && (
                            <Tag color="blue">
                              {nodeType}
                            </Tag>
                          )}
                        </div>
                        <p>{t('workflowMonitor.stepStatus')}: {step.status}</p>
                        <p>{t('workflowMonitor.stepStartTime')}: {step.startedAt ? dayjs(step.startedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</p>
                        {step.endedAt && (
                          <p>{t('workflowMonitor.stepEndTime')}: {dayjs(step.endedAt).format('YYYY-MM-DD HH:mm:ss')}</p>
                        )}
                        
                        {/* 顯示用戶回覆（waitReply 或 waitForQRCode 節點） */}
                        {isWaitNode && stepValidations.length > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <Text strong style={{ color: '#1890ff' }}>{t('workflowMonitor.userReplies')}:</Text>
                            
                            {/* 按驗證狀態分組顯示 */}
                            {(() => {
                              // 分組：有效的和無效的
                              const validValidations = stepValidations.filter(v => v.isValid);
                              const invalidValidations = stepValidations.filter(v => !v.isValid);
                              
                              const renderValidationGroup = (validations, isValid, nodeType) => {
                                if (validations.length === 0) return null;
                                
                                // 分離文本消息和圖片消息
                                const textValidations = validations.filter(v => v.messageType === 'text');
                                const imageValidations = validations.filter(v => v.messageType === 'image');
                                
                                // 判斷是否為 QR Code 節點
                                const isQRCodeNode = nodeType === 'waitForQRCode' || nodeType === 'waitforqrcode';
                                
                                // 為 QR Code 節點的 invalid 使用不同的樣式（橙色）
                                const bgColor = isValid ? '#f6ffed' : (isQRCodeNode ? '#fff7e6' : '#fff2f0');
                                const borderColor = isValid ? '#b7eb8f' : (isQRCodeNode ? '#ffd591' : '#ffccc7');
                                
                                return (
                                  <div 
                                    style={{
                                      marginTop: '8px',
                                      padding: '12px',
                                      backgroundColor: bgColor,
                                      border: `1px solid ${borderColor}`,
                                      borderRadius: '6px'
                                    }}
                                  >
                                    {/* 文本消息 */}
                                    {textValidations.map((validation, idx) => (
                                      <div key={validation.id} style={{ marginBottom: idx < textValidations.length - 1 ? '8px' : '0' }}>
                                        <Text>{validation.userMessage}</Text>
                                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                                          {dayjs(validation.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                                        </div>
                                      </div>
                                    ))}
                                    
                                    {/* 圖片消息 - 網格顯示 */}
                                    {imageValidations.length > 0 && (
                                      <div style={{ marginTop: textValidations.length > 0 ? '12px' : '0' }}>
                                        {/* 顯示所有 QR Code 結果和 Caption */}
                                        <div style={{ marginBottom: '8px' }}>
                                          {imageValidations.map((validation, idx) => {
                                            try {
                                              const processedData = validation.processedData ? JSON.parse(validation.processedData) : null;
                                              
                                              // waitForQRCode 節點：userMessage = QR Code 值，caption 在 processedData 中
                                              // waitReply 節點：userMessage = caption（圖片文字說明），processedData 可能沒有 caption
                                              let qrCodeValue = null;
                                              let caption = null;
                                              
                                              if (isQRCodeNode) {
                                                // QR Code 節點
                                                qrCodeValue = validation.userMessage;
                                                caption = processedData?.caption || '';
                                              } else {
                                                // waitReply 節點：直接使用 userMessage 作為文字說明
                                                caption = validation.userMessage || '';
                                              }
                                              
                                              return (
                                                <div key={validation.id} style={{ marginBottom: '4px' }}>
                                                  {/* 只在 waitForQRCode 節點顯示 QR Code 標籤 */}
                                                  {isQRCodeNode && qrCodeValue && (
                                                    <Tag color="green">QR Code: {qrCodeValue}</Tag>
                                                  )}
                                                  
                                                  {/* 顯示 Caption（圖片文字說明） */}
                                                  {caption && (
                                                    <Text style={{ marginLeft: (isQRCodeNode && qrCodeValue) ? '8px' : '0' }}>
                                                      <strong>{t('workflowMonitor.caption')}</strong>
                                                      {caption}
                                                    </Text>
                                                  )}
                                                  
                                                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                                                    {dayjs(validation.createdAt).format('HH:mm:ss')}
                                                  </span>
                                                </div>
                                              );
                                            } catch (e) {
                                              // 解析失敗時的後備顯示
                                              const displayText = validation.userMessage;
                                              return displayText ? (
                                                <div key={validation.id} style={{ marginBottom: '4px' }}>
                                                  {/* waitReply 節點直接顯示文字，不加標籤 */}
                                                  {isQRCodeNode ? (
                                                    <Tag color="green">QR Code: {displayText}</Tag>
                                                  ) : (
                                                    <Text>{displayText}</Text>
                                                  )}
                                                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                                                    {dayjs(validation.createdAt).format('HH:mm:ss')}
                                                  </span>
                                                </div>
                                              ) : null;
                                            }
                                          })}
                                        </div>
                                        
                                        {/* 圖片網格 - 響應式布局 */}
                                        <div style={{ 
                                          display: 'flex',
                                          flexWrap: 'wrap',
                                          gap: '8px',
                                          marginTop: '8px'
                                        }}>
                                          {imageValidations.map((validation) => (
                                            <div
                                              key={validation.id}
                                              style={{
                                                width: '100px',
                                                height: '100px',
                                                border: '1px solid #d9d9d9',
                                                borderRadius: '4px',
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                transition: 'transform 0.2s, box-shadow 0.2s'
                                              }}
                                              onClick={() => {
                                                // 點擊打開 Lightbox，顯示所有圖片
                                                const allImages = imageValidations.map(v => ({
                                                  id: v.id,
                                                  fileName: `reply_${v.id}.jpg`,
                                                  filePath: v.mediaUrl,
                                                  fileSize: 0,
                                                  createdAt: v.createdAt
                                                }));
                                                const currentIndex = imageValidations.findIndex(v => v.id === validation.id);
                                                openLightbox(allImages[currentIndex], allImages);
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.boxShadow = 'none';
                                              }}
                                            >
                                              <img
                                                src={validation.mediaUrl}
                                                alt="User reply"
                                                style={{
                                                  width: '100%',
                                                  height: '100%',
                                                  objectFit: 'cover'
                                                }}
                                                onError={(e) => {
                                                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5JbWFnZTwvdGV4dD48L3N2Zz4=';
                                                }}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* 驗證狀態標籤 */}
                                    <div style={{ 
                                      marginTop: '12px',
                                      paddingTop: '8px',
                                      borderTop: '1px solid ' + (isValid ? '#d9f7be' : (isQRCodeNode ? '#ffe7ba' : '#ffccc7'))
                                    }}>
                                      {/* 根據節點類型顯示不同的標籤 */}
                                      {isValid ? (
                                        <Tag color="success">
                                          {t('workflowMonitor.validationPassed')}
                                        </Tag>
                                      ) : (
                                        <Tag color={isQRCodeNode ? 'orange' : 'error'}>
                                          {isQRCodeNode ? t('workflowMonitor.others') : t('workflowMonitor.validationFailed')}
                                        </Tag>
                                      )}
                                      <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                                        {validations.length} {validations.length === 1 ? t('workflowMonitor.reply') : t('workflowMonitor.replies')}
                                      </span>
                                    </div>
                                  </div>
                                );
                              };
                              
                              return (
                                <>
                                  {renderValidationGroup(validValidations, true, nodeType)}
                                  {renderValidationGroup(invalidValidations, false, nodeType)}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      {/* ✅ sendWhatsApp、waitReply、waitForQRCode 節點都可能發送消息 */}
                      {(isMessageSendNode || isWaitNode) && (step.status === 'Completed' || step.status === 'completed') && (
                        <Space style={{ marginLeft: '16px' }}>
                          <Button 
                            type="default" 
                            size="small" 
                            icon={<BarChartOutlined />}
                            onClick={async () => {
                              try {
                                let messageSendId = null;
                                
                                // 對於 sendWhatsApp 節點，優先從 outputData 獲取
                                if (isMessageSendNode && outputData && outputData.messageSendId) {
                                  messageSendId = outputData.messageSendId;
                                  console.log('從 outputData 獲取 messageSendId:', messageSendId);
                                } else {
                                  // ✅ 對於所有節點，使用 stepExecutionId 查找
                                  console.log('📞 使用 stepExecutionId 查詢 messageSendId:', step.id);
                                  
                                  const response = await fetch(`/api/workflowexecutions/step/${step.id}/message-send-id`, {
                                    headers: {
                                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                                    }
                                  });
                                  
                                  if (response.ok) {
                                    const data = await response.json();
                                    messageSendId = data.messageSendId;
                                    console.log('✅ 從 API 獲取 messageSendId:', messageSendId);
                                  } else {
                                    console.warn('❌ 找不到消息發送記錄，stepExecutionId:', step.id);
                                    message.warning(t('workflowMonitor.cannotFindMessageSendId'));
                                    return;
                                  }
                                }
                                
                                // 打開消息發送狀態模態框
                                if (messageSendId) {
                                  onViewMessageSendDetail(messageSendId);
                                } else {
                                  message.warning(t('workflowMonitor.cannotFindMessageSendId'));
                                }
                              } catch (error) {
                                console.error('查詢消息發送記錄時發生錯誤:', error);
                                message.error('查詢消息發送記錄失敗');
                              }
                            }}
                          >
                            {t('workflowMonitor.viewMessageSendStatus')}
                          </Button>
                        </Space>
                      )}
                    </div>
                    
                    {/* 顯示輸出信息，正確區分錯誤和正常信息 */}
                    {displayMessage && (
                      <div style={{ 
                        marginTop: '8px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        backgroundColor: isError ? '#fff2f0' : '#f6ffed',
                        border: `1px solid ${isError ? '#ffccc7' : '#b7eb8f'}`,
                        color: isError ? '#cf1322' : '#389e0d'
                      }}>
                        <strong>{isError ? t('workflowMonitor.error') + ': ' : t('workflowMonitor.information') + ': '}</strong>
                        {displayMessage}
                        
                        {/* 如果有額外的輸出數據，顯示更多信息 */}
                        {outputData && outputData.timestamp && (
                          <div style={{ 
                            marginTop: '4px', 
                            fontSize: '12px', 
                            opacity: 0.7 
                          }}>
                            {t('workflowMonitor.time')}: {new Date(outputData.timestamp).toLocaleString('zh-TW')}
                          </div>
                        )}
                        
                        {outputData && outputData.userResponse && (
                          <div style={{ 
                            marginTop: '4px', 
                            fontSize: '12px', 
                            opacity: 0.7 
                          }}>
                            {t('workflowMonitor.userResponse')}: {outputData.userResponse}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* 智能處理 errorMessage 字段，只顯示真正的錯誤信息 */}
                    {step.errorMessage && (
                      (() => {
                        // 檢查 errorMessage 是否與 outputJson 內容相同，如果相同則不顯示（避免重複）
                        const jsonContent = step.outputJson || step.OutputJson || step.output;
                        if (jsonContent && step.errorMessage === jsonContent) {
                          console.log(t('workflowMonitor.stepErrorMessageSameAsOutputJson', { stepNumber: index + 1 }));
                          return null; // 不顯示重複內容
                        }
                        
                        // 檢查 errorMessage 是否包含成功的狀態更新消息
                        try {
                          const errorData = JSON.parse(step.errorMessage);
                          // 如果 errorMessage 包含 success: true 或特定的成功消息，則不顯示
                          if (errorData.success === true || 
                              (errorData.message && (
                                errorData.message.includes("User replied, continuing workflow") ||
                                errorData.message.includes("EForm sent successfully") ||
                                errorData.message.includes("Form already processed") ||
                                errorData.message.includes("waiting for approval") ||
                                errorData.message.includes("Waiting for user reply")
                              )) ||
                              // 檢查是否為 switch 節點的正常輸出
                              errorData.selectedPaths || errorData.selectedPath || errorData.evaluatedAt) {
                            console.log(t('workflowMonitor.stepErrorMessageContainsSuccess', { stepNumber: index + 1 }));
                            return null; // 不顯示
                          }
                        } catch (parseError) {
                          // 如果解析失敗，可能是純文本錯誤信息，正常顯示
                          console.log(t('workflowMonitor.stepErrorMessageParseFailed', { stepNumber: index + 1 }));
                        }
                        
                        // 顯示真正的錯誤信息
                        return (
                          <p style={{ color: 'red' }}>{t('workflowMonitor.error')}: {step.errorMessage}</p>
                        );
                      })()
                    )}
                  </Timeline.Item>
                );
              })
            ) : (
              <Timeline.Item color="blue">
                <p>{t('workflowMonitor.noStepExecutionRecords')}</p>
              </Timeline.Item>
            )}
            {instance.status === 'completed' && (
              <Timeline.Item color="green">
                <p>{t('workflowMonitor.workflowCompleted')}</p>
                <p>{dayjs(instance.endedAt).format('YYYY-MM-DD HH:mm:ss')}</p>
              </Timeline.Item>
            )}
          </Timeline>
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.processVariables')} key="variables">
          {loadingProcessVariables ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingProcessVariables')}</p>
            </div>
          ) : processVariables.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {processVariables.map((variable) => (
                <Card 
                  key={variable.variableName}
                  size="small"
                  style={{ 
                    border: '1px solid #e8e8e8',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    gap: '16px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        marginBottom: '12px' 
                      }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                          {variable.displayName || variable.variableName}
                        </h4>
                        <Tag color={getDataTypeColor(variable.dataType)}>
                          {variable.dataType}
                        </Tag>
                        {variable.isRequired && (
                          <Tag color="red">{t('workflowMonitor.required')}</Tag>
                        )}
                        {variable.hasValue ? (
                          <Tag color="green">{t('workflowMonitor.hasValue')}</Tag>
                        ) : (
                          <Tag color="default">{t('workflowMonitor.noValue')}</Tag>
                        )}
                      </div>
                      
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        fontSize: '14px'
                      }}>
                        <div>
                          <strong style={{ color: '#595959' }}>{t('workflowMonitor.variableName')}:</strong>
                          <div style={{ 
                            marginTop: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            border: '1px solid #e8e8e8'
                          }}>
                            {variable.variableName}
                          </div>
                        </div>
                        
                        <div>
                          <strong style={{ color: '#595959' }}>{t('workflowMonitor.dataType')}:</strong>
                          <div style={{ 
                            marginTop: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            border: '1px solid #e8e8e8'
                          }}>
                            {variable.dataType}
                          </div>
                        </div>
                        
                        {variable.description && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.description')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '8px 12px',
                              backgroundColor: '#f6ffed',
                              border: '1px solid #b7eb8f',
                              borderRadius: '6px',
                              fontSize: '14px',
                              lineHeight: '1.5'
                            }}>
                              {variable.description}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <strong style={{ color: '#595959' }}>{t('workflowMonitor.currentValue')}:</strong>
                          <div style={{ 
                            marginTop: '4px',
                            padding: '8px 12px',
                            backgroundColor: variable.hasValue ? '#f6ffed' : '#fff7e6',
                            border: `1px solid ${variable.hasValue ? '#b7eb8f' : '#ffd591'}`,
                            borderRadius: '6px',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            wordBreak: 'break-all'
                          }}>
                            {formatVariableValue(variable.value, variable.dataType)}
                          </div>
                        </div>
                        
                        {variable.defaultValue && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.defaultValue')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {variable.defaultValue}
                            </div>
                          </div>
                        )}
                        
                        {variable.setAt && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.setAt')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {new Date(variable.setAt).toLocaleString('zh-TW')}
                            </div>
                          </div>
                        )}
                        
                        {variable.setBy && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.setBy')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {variable.setBy}
                            </div>
                          </div>
                        )}
                        
                        {variable.sourceType && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.sourceType')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {variable.sourceType}
                            </div>
                          </div>
                        )}
                        
                        {variable.sourceReference && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.sourceReference')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8',
                              wordBreak: 'break-all'
                            }}>
                              {variable.sourceReference}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Empty 
              description={t('workflowMonitor.noProcessVariables')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.receivedMedia')} key="media">
          {loadingMediaFiles ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingMediaFiles')}</p>
            </div>
          ) : mediaFiles.length > 0 ? (
            <div>
              <div style={{ 
                marginBottom: '16px',
                paddingBottom: '8px',
                borderBottom: '1px solid #f0f0f0'
              }}>
                <Text strong style={{ fontSize: '16px' }}>
                  {t('workflowMonitor.totalFiles')}: {mediaFiles.length}
                </Text>
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '16px'
              }}>
                {mediaFiles.map((file) => {
                        const fileType = getFileType(file.fileName);
                        const isImage = fileType === 'image';
                        const isVideo = fileType === 'video';
                        const isAudio = fileType === 'audio';
                        const isDocument = fileType === 'document';
                        
                        return (
                          <Card
                            key={file.id}
                            size="small"
                            hoverable
                            style={{ 
                              border: '1px solid #e8e8e8',
                              borderRadius: '8px',
                              overflow: 'hidden'
                            }}
                            bodyStyle={{ padding: '8px' }}
                          >
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              alignItems: 'center',
                              textAlign: 'center'
                            }}>
                              {/* 文件預覽 */}
                              <div 
                                style={{ 
                                  width: '100%', 
                                  height: '120px',
                                  backgroundColor: '#f5f5f5',
                                  borderRadius: '6px',
                                  marginBottom: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  position: 'relative',
                                  cursor: (isImage || isVideo) ? 'pointer' : 'default'
                                }}
                                onClick={() => {
                                  if (isImage || isVideo) {
                                    openLightbox(file, mediaFiles);
                                  }
                                }}
                              >
                                {isImage ? (
                                  <img
                                    src={file.filePath}
                                    alt={file.fileName}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      borderRadius: '4px'
                                    }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : isVideo ? (
                                  <video
                                    src={file.filePath}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      borderRadius: '4px'
                                    }}
                                    controls={false}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                
                                {/* 備用圖標 */}
                                <div style={{ 
                                  display: isImage || isVideo ? 'none' : 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '100%',
                                  height: '100%',
                                  backgroundColor: '#f0f0f0'
                                }}>
                                  {getFileIcon(file.fileName)}
                                </div>
                              </div>
                              
                              {/* 文件信息 */}
                              <div style={{ width: '100%' }}>
                                <Text 
                                  strong 
                                  style={{ 
                                    fontSize: '12px',
                                    display: 'block',
                                    marginBottom: '4px',
                                    wordBreak: 'break-all',
                                    lineHeight: '1.2'
                                  }}
                                  title={file.fileName}
                                >
                                  {file.fileName.length > 20 ? 
                                    file.fileName.substring(0, 20) + '...' : 
                                    file.fileName
                                  }
                                </Text>
                                
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '11px',
                                  color: '#666'
                                }}>
                                  <span>{formatFileSize(file.fileSize || 0)}</span>
                                  <Tag 
                                    color={isImage ? 'green' : isVideo ? 'blue' : isAudio ? 'orange' : 'default'}
                                    style={{ fontSize: '10px', margin: 0 }}
                                  >
                                    {isImage ? t('workflowMonitor.image') : 
                                     isVideo ? t('workflowMonitor.video') : 
                                     isAudio ? t('workflowMonitor.audio') :
                                     t('workflowMonitor.document')}
                                  </Tag>
                                </div>
                                
                                {file.createdAt && (
                                  <div style={{ 
                                    fontSize: '10px', 
                                    color: '#999',
                                    marginTop: '4px'
                                  }}>
                                    {new Date(file.createdAt).toLocaleDateString('zh-TW')}
                                  </div>
                                )}
                                
                                {/* 操作按鈕 */}
                                <div style={{ 
                                  marginTop: '8px',
                                  display: 'flex',
                                  gap: '4px',
                                  justifyContent: 'center'
                                }}>
                                  <Button 
                                    type="text" 
                                    size="small"
                                    icon={<EyeOutlined />}
                                    onClick={() => {
                                      if (isImage || isVideo) {
                                        openLightbox(file, mediaFiles);
                                      } else {
                                        // 對於非圖片/視頻文件，在新標籤頁中打開
                                        window.open(file.filePath, '_blank');
                                      }
                                    }}
                                    style={{ fontSize: '10px', padding: '2px 6px' }}
                                  >
                                    {t('workflowMonitor.view')}
                                  </Button>
                                  <Button 
                                    type="text" 
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={() => {
                                      // 下載文件
                                      const link = document.createElement('a');
                                      link.href = file.filePath;
                                      link.download = file.fileName;
                                      link.click();
                                    }}
                                    style={{ fontSize: '10px', padding: '2px 6px' }}
                                  >
                                    {t('workflowMonitor.download')}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
              </div>
            </div>
          ) : (
            <Empty 
              description={t('workflowMonitor.noMediaFiles')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.formInstances')} key="forms">
          {loadingEforms ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingEformInstances')}</p>
            </div>
          ) : eformInstances.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {eformInstances.map((eform) => (
                <Card 
                  key={eform.id}
                  size="small"
                  style={{ 
                    border: '1px solid #e8e8e8',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    gap: '16px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        marginBottom: '12px' 
                      }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                          {eform.formName || t('workflowMonitor.unnamedForm')}
                        </h4>
                        <Tag color={getEformStatusColor(eform.status)}>
                          {getEformStatusText(eform.status)}
                        </Tag>
                      </div>
                      
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        fontSize: '14px'
                      }}>
                        <div>
                          <strong style={{ color: '#595959' }}>{t('workflowMonitor.instanceName')}:</strong>
                          <div style={{ 
                            marginTop: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            border: '1px solid #e8e8e8'
                          }}>
                            {eform.instanceName || '-'}
                          </div>
                        </div>
                        
                        <div>
                          <strong style={{ color: '#595959' }}>{t('workflowMonitor.createdAt')}:</strong>
                          <div style={{ 
                            marginTop: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            border: '1px solid #e8e8e8'
                          }}>
                            {eform.createdAt ? new Date(eform.createdAt).toLocaleString('zh-TW') : '-'}
                          </div>
                        </div>
                        
                        {eform.userMessage && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.userInput')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '8px 12px',
                              backgroundColor: '#f6ffed',
                              border: '1px solid #b7eb8f',
                              borderRadius: '6px',
                              fontSize: '14px',
                              lineHeight: '1.5'
                            }}>
                              {eform.userMessage}
                            </div>
                          </div>
                        )}
                        
                        {eform.approvalBy && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.approvalBy')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {eform.approvalBy}
                            </div>
                          </div>
                        )}
                        
                        {eform.approvalAt && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.approvalAt')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {new Date(eform.approvalAt).toLocaleString('zh-TW')}
                            </div>
                          </div>
                        )}
                        
                        {eform.approvalNote && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.approvalNote')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '8px 12px',
                              backgroundColor: '#fff7e6',
                              border: '1px solid #ffd591',
                              borderRadius: '6px',
                              fontSize: '14px',
                              lineHeight: '1.5'
                            }}>
                              {eform.approvalNote}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ flexShrink: 0 }}>
                      <Button 
                        type="primary" 
                        size="small"
                        onClick={() => {
                          // 在新標籤頁中打開表單詳情
                          window.open(`/eform-instance/${eform.id}`, '_blank');
                        }}
                        style={{ 
                          backgroundColor: '#1890ff',
                          borderColor: '#1890ff'
                        }}
                      >
                        {t('workflowMonitor.viewDetails')}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Empty 
              description={t('workflowMonitor.noEformInstances')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>
      </Tabs>
      
      {/* Lightbox 組件 */}
      <Modal
        title={lightboxFile ? lightboxFile.fileName : ''}
        visible={lightboxVisible}
        onCancel={closeLightbox}
        footer={null}
        width="95%"
        style={{ top: 10 }}
        bodyStyle={{ 
          padding: 0, 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '85vh',
          backgroundColor: '#000',
          position: 'relative'
        }}
        closable={false}
      >
        {lightboxFile && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center',
            width: '100%',
            height: '100%',
            position: 'relative'
          }}>
            {/* 關閉按鈕 */}
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={closeLightbox}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 1000,
                color: '#fff',
                fontSize: '20px',
                width: '40px',
                height: '40px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: 'none'
              }}
            />
            
            {/* 導航按鈕 */}
            {lightboxFiles.length > 1 && (
              <>
                <Button
                  type="text"
                  icon={<LeftOutlined />}
                  onClick={goToPrevious}
                  style={{
                    position: 'absolute',
                    left: 20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    color: '#fff',
                    fontSize: '24px',
                    width: '50px',
                    height: '50px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    border: 'none'
                  }}
                />
                <Button
                  type="text"
                  icon={<RightOutlined />}
                  onClick={goToNext}
                  style={{
                    position: 'absolute',
                    right: 20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    color: '#fff',
                    fontSize: '24px',
                    width: '50px',
                    height: '50px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    border: 'none'
                  }}
                />
              </>
            )}
            
            {/* 媒體內容 */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              transform: `
                rotate(${lightboxTransform.rotate}deg) 
                scale(${lightboxTransform.scale}) 
                scaleX(${lightboxTransform.flipH ? -1 : 1}) 
                scaleY(${lightboxTransform.flipV ? -1 : 1})
              `,
              transition: 'transform 0.3s ease'
            }}>
              {getFileType(lightboxFile.fileName) === 'image' ? (
                <img
                  src={lightboxFile.filePath}
                  alt={lightboxFile.fileName}
                  style={{
                    maxWidth: '90%',
                    maxHeight: '80vh',
                    objectFit: 'contain'
                  }}
                />
              ) : getFileType(lightboxFile.fileName) === 'video' ? (
                <video
                  src={lightboxFile.filePath}
                  controls
                  style={{
                    maxWidth: '90%',
                    maxHeight: '80vh'
                  }}
                />
              ) : null}
            </div>
            
            {/* 工具欄 */}
            {getFileType(lightboxFile.fileName) === 'image' && (
              <div style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '8px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '8px 16px',
                borderRadius: '8px',
                zIndex: 1000
              }}>
                <Button
                  type="text"
                  icon={<RotateLeftOutlined />}
                  onClick={() => rotateImage('left')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.rotateLeft')}
                />
                <Button
                  type="text"
                  icon={<RotateRightOutlined />}
                  onClick={() => rotateImage('right')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.rotateRight')}
                />
                <Button
                  type="text"
                  icon={<SwapOutlined />}
                  onClick={() => flipImage('horizontal')}
                  style={{ 
                    color: '#fff',
                    transform: lightboxTransform.flipH ? 'scaleX(-1)' : 'none'
                  }}
                  title={t('workflowMonitor.flipHorizontal')}
                />
                <Button
                  type="text"
                  icon={<SwapOutlined />}
                  onClick={() => flipImage('vertical')}
                  style={{ 
                    color: '#fff',
                    transform: lightboxTransform.flipV ? 'scaleY(-1)' : 'none'
                  }}
                  title={t('workflowMonitor.flipVertical')}
                />
                <Button
                  type="text"
                  icon={<ZoomInOutlined />}
                  onClick={() => zoomImage('in')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.zoomIn')}
                />
                <Button
                  type="text"
                  icon={<ZoomOutOutlined />}
                  onClick={() => zoomImage('out')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.zoomOut')}
                />
                <Button
                  type="text"
                  icon={<ResetOutlined />}
                  onClick={resetTransform}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.reset')}
                />
              </div>
            )}
            
            {/* 文件信息 */}
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: 20,
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              zIndex: 1000
            }}>
              {lightboxFiles.length > 1 && (
                <div>{lightboxCurrentIndex + 1} / {lightboxFiles.length}</div>
              )}
              <div>{formatFileSize(lightboxFile.fileSize || 0)}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// 消息發送詳情組件
const MessageSendDetailModal = ({ messageSend, onClose }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('basic');
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // 載入收件人數據
  useEffect(() => {
    if (messageSend && messageSend.recipients) {
      setRecipients(messageSend.recipients);
    }
  }, [messageSend]);

  const getStatusTag = (status) => {
    const statusConfig = {
      Pending: { color: 'default', text: t('workflowMonitor.statusPending') },
      InProgress: { color: 'processing', text: t('workflowMonitor.statusInProgress') },
      Completed: { color: 'success', text: t('workflowMonitor.statusCompleted') },
      Failed: { color: 'error', text: t('workflowMonitor.statusFailed') },
      PartiallyFailed: { color: 'warning', text: t('workflowMonitor.statusPartiallyFailed') }
    };
    
    const config = statusConfig[status] || statusConfig.Pending;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getRecipientStatusTag = (status) => {
    const statusConfig = {
      Pending: { color: 'default', text: t('workflowMonitor.statusPending') },
      Sent: { color: 'processing', text: t('workflowMonitor.statusSent') },
      Delivered: { color: 'success', text: t('workflowMonitor.statusDelivered') },
      Read: { color: 'success', text: t('workflowMonitor.statusRead') },
      Failed: { color: 'error', text: t('workflowMonitor.statusFailed') },
      Retrying: { color: 'warning', text: t('workflowMonitor.statusRetrying') }
    };
    
    const config = statusConfig[status] || statusConfig.Pending;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getRecipientTypeTag = (type) => {
    const typeConfig = {
      User: { color: 'blue', text: t('workflowMonitor.recipientTypeUser') },
      Contact: { color: 'green', text: t('workflowMonitor.recipientTypeContact') },
      Group: { color: 'orange', text: t('workflowMonitor.recipientTypeGroup') },
      Hashtag: { color: 'purple', text: t('workflowMonitor.recipientTypeHashtag') },
      Initiator: { color: 'red', text: t('workflowMonitor.recipientTypeInitiator') }
    };
    
    const config = typeConfig[type] || typeConfig.User;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={t('workflowMonitor.basicInfo')} key="basic">
          <Descriptions bordered column={2}>
            <Descriptions.Item label={t('workflowMonitor.messageSendId')}>{messageSend.id}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.workflowExecutionId')}>{messageSend.workflowExecutionId}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.nodeId')}>{messageSend.nodeId}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.nodeType')}>{messageSend.nodeType}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.messageType')}>{messageSend.messageType}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.status')}>{getStatusTag(messageSend.status)}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.totalRecipients')}>{messageSend.totalRecipients}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.successCount')}>{messageSend.successCount}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.failedCount')}>{messageSend.failedCount}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.startedAt')}>
              {dayjs(messageSend.startedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.completedAt')}>
              {messageSend.completedAt ? dayjs(messageSend.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.createdBy')}>{messageSend.createdBy}</Descriptions.Item>
          </Descriptions>
          
          {messageSend.messageContent && (
            <div style={{ marginTop: 16 }}>
              <Text strong>{t('workflowMonitor.messageContent')}:</Text>
              <div style={{ 
                marginTop: 8,
                padding: 12,
                backgroundColor: '#f5f5f5',
                borderRadius: 6,
                border: '1px solid #d9d9d9',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {messageSend.messageContent}
              </div>
            </div>
          )}
          
          {messageSend.errorMessage && (
            <Alert
              message={t('workflowMonitor.errorMessage')}
              description={messageSend.errorMessage}
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.recipientDetails')} key="recipients">
          {loadingRecipients ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingRecipientDetails')}</p>
            </div>
          ) : recipients.length > 0 ? (
            <Table
              dataSource={recipients}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 800 }}
              columns={[
                {
                  title: t('workflowMonitor.recipient'),
                  dataIndex: 'recipientName',
                  key: 'recipientName',
                  width: 200,
                  render: (text, record) => (
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{text}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{record.phoneNumber}</div>
                    </div>
                  )
                },
                {
                  title: t('workflowMonitor.type'),
                  dataIndex: 'recipientType',
                  key: 'recipientType',
                  width: 100,
                  render: (type) => getRecipientTypeTag(type)
                },
                {
                  title: t('workflowMonitor.status'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (status) => getRecipientStatusTag(status)
                },
                {
                  title: t('workflowMonitor.whatsAppMessageId'),
                  dataIndex: 'whatsAppMessageId',
                  key: 'whatsAppMessageId',
                  width: 200,
                  ellipsis: true,
                  render: (text) => text || '-'
                },
                {
                  title: t('workflowMonitor.sentAt'),
                  dataIndex: 'sentAt',
                  key: 'sentAt',
                  width: 150,
                  render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.deliveredAt'),
                  dataIndex: 'deliveredAt',
                  key: 'deliveredAt',
                  width: 150,
                  render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.readAt'),
                  dataIndex: 'readAt',
                  key: 'readAt',
                  width: 150,
                  render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.errorMessage'),
                  dataIndex: 'errorMessage',
                  key: 'errorMessage',
                  width: 200,
                  ellipsis: true,
                  render: (text) => text || '-'
                }
              ]}
            />
          ) : (
            <Empty 
              description={t('workflowMonitor.noRecipientRecords')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>
      </Tabs>
    </div>
  );
};

// 消息發送詳細狀態組件
const MessageSendStatusDetailModal = ({ messageSend, onClose, onViewMessageSend, onViewMessageSendDetail }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [statistics, setStatistics] = useState({
    total: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    pending: 0
  });

  // 載入收件人數據
  useEffect(() => {
    if (messageSend && messageSend.recipients) {
      setRecipients(messageSend.recipients);
      calculateStatistics(messageSend.recipients);
    }
  }, [messageSend]);

  const calculateStatistics = (recipientsData) => {
    const stats = {
      total: recipientsData.length,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      pending: 0
    };

    recipientsData.forEach(recipient => {
      switch (recipient.status) {
        case 'Sent':
          stats.sent++;
          break;
        case 'Delivered':
          stats.delivered++;
          break;
        case 'Read':
          stats.read++;
          break;
        case 'Failed':
          stats.failed++;
          break;
        case 'Pending':
        default:
          stats.pending++;
          break;
      }
    });

    setStatistics(stats);
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      Pending: { color: 'default', text: t('workflowMonitor.statusPending') },
      InProgress: { color: 'processing', text: t('workflowMonitor.statusInProgress') },
      Completed: { color: 'success', text: t('workflowMonitor.statusCompleted') },
      Failed: { color: 'error', text: t('workflowMonitor.statusFailed') },
      PartiallyFailed: { color: 'warning', text: t('workflowMonitor.statusPartiallyFailed') }
    };
    
    const config = statusConfig[status] || statusConfig.Pending;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getRecipientStatusTag = (status) => {
    const statusConfig = {
      Pending: { color: 'default', text: t('workflowMonitor.statusPending') },
      Sent: { color: 'processing', text: t('workflowMonitor.statusSent') },
      Delivered: { color: 'success', text: t('workflowMonitor.statusDelivered') },
      Read: { color: 'success', text: t('workflowMonitor.statusRead') },
      Failed: { color: 'error', text: t('workflowMonitor.statusFailed') },
      Retrying: { color: 'warning', text: t('workflowMonitor.statusRetrying') }
    };
    
    const config = statusConfig[status] || statusConfig.Pending;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getRecipientTypeTag = (type) => {
    const typeConfig = {
      User: { color: 'blue', text: t('workflowMonitor.recipientTypeUser') },
      Contact: { color: 'green', text: t('workflowMonitor.recipientTypeContact') },
      Group: { color: 'orange', text: t('workflowMonitor.recipientTypeGroup') },
      Hashtag: { color: 'purple', text: t('workflowMonitor.recipientTypeHashtag') },
      Initiator: { color: 'red', text: t('workflowMonitor.recipientTypeInitiator') },
      PhoneNumber: { color: 'cyan', text: t('workflowMonitor.recipientTypePhoneNumber') }
    };
    
    const config = typeConfig[type] || typeConfig.User;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={t('workflowMonitor.sendOverview')} key="overview">
          {/* 統計卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.totalRecipients')}
                  value={statistics.total}
                  prefix={<MessageOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.sent')}
                  value={statistics.sent}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.delivered')}
                  value={statistics.delivered}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.read')}
                  value={statistics.read}
                  prefix={<EyeOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.failed')}
                  value={statistics.failed}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.pending')}
                  value={statistics.pending}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 基本信息 */}
          <Card title={t('workflowMonitor.sendBasicInfo')} style={{ marginBottom: 16 }}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label={t('workflowMonitor.messageSendId')}>{messageSend.id}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.workflowExecutionId')}>{messageSend.workflowExecutionId}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.nodeId')}>{messageSend.nodeId}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.nodeType')}>{messageSend.nodeType}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.messageType')}>{messageSend.messageType}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.status')}>{getStatusTag(messageSend.status)}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.totalRecipients')}>{messageSend.totalRecipients}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.successCount')}>{messageSend.successCount}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.failedCount')}>{messageSend.failedCount}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.startedAt')}>
                {dayjs(messageSend.startedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.completedAt')}>
                {messageSend.completedAt ? dayjs(messageSend.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.createdBy')}>{messageSend.createdBy}</Descriptions.Item>
            </Descriptions>
            
            {messageSend.messageContent && (
              <div style={{ marginTop: 16 }}>
                <Text strong>{t('workflowMonitor.messageContent')}:</Text>
                <div style={{ 
                  marginTop: 8,
                  padding: 12,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 6,
                  border: '1px solid #d9d9d9',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {messageSend.messageContent}
                </div>
              </div>
            )}
            
            {messageSend.errorMessage && (
              <Alert
                message={t('workflowMonitor.errorMessage')}
                description={messageSend.errorMessage}
                type="error"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.recipientDetails')} key="recipients">
          {loadingRecipients ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingRecipientDetails')}</p>
            </div>
          ) : recipients.length > 0 ? (
            <Table
              dataSource={recipients}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1000 }}
              columns={[
                {
                  title: t('workflowMonitor.recipient'),
                  dataIndex: 'recipientName',
                  key: 'recipientName',
                  width: 200,
                  render: (text, record) => (
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{text || t('workflowMonitor.unnamed')}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{record.phoneNumber}</div>
                    </div>
                  )
                },
                {
                  title: t('workflowMonitor.type'),
                  dataIndex: 'recipientType',
                  key: 'recipientType',
                  width: 100,
                  render: (type) => getRecipientTypeTag(type)
                },
                {
                  title: t('workflowMonitor.status'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (status) => getRecipientStatusTag(status)
                },
                {
                  title: t('workflowMonitor.whatsAppMessageId'),
                  dataIndex: 'whatsAppMessageId',
                  key: 'whatsAppMessageId',
                  width: 200,
                  ellipsis: true,
                  render: (text) => text || '-'
                },
                {
                  title: t('workflowMonitor.sentAt'),
                  dataIndex: 'sentAt',
                  key: 'sentAt',
                  width: 150,
                  render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.deliveredAt'),
                  dataIndex: 'deliveredAt',
                  key: 'deliveredAt',
                  width: 150,
                  render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.readAt'),
                  dataIndex: 'readAt',
                  key: 'readAt',
                  width: 150,
                  render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.retryCount'),
                  dataIndex: 'retryCount',
                  key: 'retryCount',
                  width: 80,
                  render: (count, record) => (
                    <div>
                      <Text>{count || 0}</Text>
                      {record.maxRetries && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          / {record.maxRetries}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  title: t('workflowMonitor.errorMessage'),
                  dataIndex: 'errorMessage',
                  key: 'errorMessage',
                  width: 200,
                  ellipsis: true,
                  render: (text) => text || '-'
                }
              ]}
            />
          ) : (
            <Empty 
              description={t('workflowMonitor.noRecipientRecords')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>

        <TabPane tab={t('workflowMonitor.statusAnalysis')} key="analysis">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title={t('workflowMonitor.sendStatusDistribution')} style={{ height: '300px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('workflowMonitor.read')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Progress 
                        percent={statistics.total > 0 ? Math.round((statistics.read / statistics.total) * 100) : 0} 
                        size="small" 
                        strokeColor="#52c41a"
                        style={{ width: '100px' }}
                      />
                      <span>{statistics.read}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('workflowMonitor.delivered')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Progress 
                        percent={statistics.total > 0 ? Math.round((statistics.delivered / statistics.total) * 100) : 0} 
                        size="small" 
                        strokeColor="#52c41a"
                        style={{ width: '100px' }}
                      />
                      <span>{statistics.delivered}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('workflowMonitor.sent')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Progress 
                        percent={statistics.total > 0 ? Math.round((statistics.sent / statistics.total) * 100) : 0} 
                        size="small" 
                        strokeColor="#1890ff"
                        style={{ width: '100px' }}
                      />
                      <span>{statistics.sent}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('workflowMonitor.failed')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Progress 
                        percent={statistics.total > 0 ? Math.round((statistics.failed / statistics.total) * 100) : 0} 
                        size="small" 
                        strokeColor="#ff4d4f"
                        style={{ width: '100px' }}
                      />
                      <span>{statistics.failed}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('workflowMonitor.pending')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Progress 
                        percent={statistics.total > 0 ? Math.round((statistics.pending / statistics.total) * 100) : 0} 
                        size="small" 
                        strokeColor="#faad14"
                        style={{ width: '100px' }}
                      />
                      <span>{statistics.pending}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title={t('workflowMonitor.timeAnalysis')} style={{ height: '300px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <Text strong>{t('workflowMonitor.sendStartTime')}:</Text>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {dayjs(messageSend.startedAt).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                  </div>
                  <div>
                    <Text strong>{t('workflowMonitor.sendCompleteTime')}:</Text>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {messageSend.completedAt ? dayjs(messageSend.completedAt).format('YYYY-MM-DD HH:mm:ss') : t('workflowMonitor.inProgress')}
                    </div>
                  </div>
                  <div>
                    <Text strong>{t('workflowMonitor.totalSendTime')}:</Text>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {messageSend.completedAt ? 
                        `${dayjs.duration(dayjs(messageSend.completedAt).diff(dayjs(messageSend.startedAt))).asMinutes().toFixed(1)} ${t('workflowMonitor.minutes')}` : 
                        t('workflowMonitor.inProgress')
                      }
                    </div>
                  </div>
                  <div>
                    <Text strong>{t('workflowMonitor.successRate')}:</Text>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {statistics.total > 0 ? 
                        `${((statistics.sent / statistics.total) * 100).toFixed(1)}%` : 
                        '0%'
                      }
                    </div>
                  </div>
                  <div>
                    <Text strong>{t('workflowMonitor.deliveryRate')}:</Text>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {statistics.total > 0 ? 
                        `${((statistics.delivered / statistics.total) * 100).toFixed(1)}%` : 
                        '0%'
                      }
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default WorkflowMonitorPage;
