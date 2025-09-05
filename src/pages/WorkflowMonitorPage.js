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
  MessageOutlined
} from '@ant-design/icons';
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
    dateRange: null,
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

  const loadInstances = async () => {
    setLoading(true);
    try {
      // 構建查詢參數
      const params = new URLSearchParams({
        page: pagination.current,
        pageSize: pagination.pageSize
      });

      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }

      if (filters.searchText) {
        params.append('search', filters.searchText);
      }

      if (filters.dateRange && filters.dateRange.length === 2) {
        params.append('startDate', filters.dateRange[0].toISOString());
        params.append('endDate', filters.dateRange[1].toISOString());
      }

      console.log('發送請求到:', `/api/workflowexecutions/monitor?${params}`);
      console.log('當前分頁參數:', { current: pagination.current, pageSize: pagination.pageSize });

      const response = await fetch(`/api/workflowexecutions/monitor?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('載入實例失敗');
      }

      const data = await response.json();
      console.log('從監控 API 獲取到的數據:', data);
      console.log('實例數據結構:', data.data);
      console.log('分頁信息:', { page: data.page, pageSize: data.pageSize, total: data.total });
      
      // 檢查第一個實例是否包含 InputJson 字段
      if (data.data && data.data.length > 0) {
        const firstInstance = data.data[0];
        console.log('第一個實例的完整數據:', firstInstance);
        console.log('InputJson 字段:', firstInstance.inputJson);
        console.log('InputJson 類型:', typeof firstInstance.inputJson);
        if (firstInstance.inputJson) {
          try {
            const parsedInput = JSON.parse(firstInstance.inputJson);
            console.log('解析後的 InputJson:', parsedInput);
          } catch (parseError) {
            console.error('解析 InputJson 失敗:', parseError);
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
      message.error('載入實例失敗: ' + error.message);
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
        throw new Error('載入統計數據失敗');
      }

      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('載入統計數據失敗:', error);
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

  const handleDateRangeChange = (dates) => {
    setFilters(prev => ({ ...prev, dateRange: dates }));
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
        throw new Error(errorData.error || '操作失敗');
      }

      const result = await response.json();
      message.success(result.message || `${action} 操作成功`);
      
      // 重新載入數據
      loadInstances();
      loadStatistics();
    } catch (error) {
      message.error(`${action} 操作失敗: ` + error.message);
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
        throw new Error('載入詳情失敗');
      }

      const details = await response.json();
      setSelectedInstance(details);
      setDetailModalVisible(true);
    } catch (error) {
      message.error('載入詳情失敗: ' + error.message);
    }
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      running: { color: 'processing', icon: <SyncOutlinedIcon spin />, text: '運行中' },
      completed: { color: 'success', icon: <CheckCircleFilled />, text: '已完成' },
      failed: { color: 'error', icon: <CloseCircleFilled />, text: '失敗' },
      waiting: { color: 'warning', icon: <ClockCircleFilled />, text: '等待中' },
      paused: { color: 'default', icon: <PauseCircleOutlined />, text: '已暫停' },
      cancelled: { color: 'default', icon: <StopOutlined />, text: '已取消' }
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
    if (duration < 60) return `${Math.round(duration)} 分鐘`;
    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    return `${hours} 小時 ${minutes} 分鐘`;
  };

  // 打開 WhatsApp 對話框
  const handleOpenChat = (instance) => {
    console.log('打開 WhatsApp 對話框，實例數據:', instance);
    console.log('實例 ID:', instance.id);
    console.log('InputJson 字段:', instance.inputJson);
    console.log('InputJson 類型:', typeof instance.inputJson);
    
    if (instance.inputJson) {
      try {
        const parsedInput = JSON.parse(instance.inputJson);
        console.log('解析後的 InputJson:', parsedInput);
        console.log('可用的字段:', Object.keys(parsedInput));
      } catch (parseError) {
        console.error('解析 InputJson 失敗:', parseError);
      }
    } else {
      console.warn('實例中沒有 InputJson 字段');
      console.log('可用的字段:', Object.keys(instance));
    }
    
    setSelectedChatInstance(instance);
    setChatModalVisible(true);
  };

  // 處理發送消息
  const handleSendMessage = (message) => {
    console.log('發送消息:', message);
    // 這裡可以添加額外的邏輯，比如更新實例狀態等
  };

  const columns = [
    {
      title: '實例 ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: '流程名稱',
      dataIndex: 'workflowName',
      key: 'workflowName',
      width: 200,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getStatusTag(status)
    },
    {
      title: '當前步驟',
      dataIndex: 'currentStep',
      key: 'currentStep',
      width: 120,
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
      title: '開始時間',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 150,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '執行時間',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      render: (duration, record) => {
        if (record.status === 'running') {
          const runningDuration = dayjs.duration(dayjs().diff(dayjs(record.startedAt))).asMinutes();
          return getDurationText(runningDuration);
        }
        return getDurationText(duration);
      }
    },
    {
      title: '創建者',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100
    },
    {
      title: '操作',
      key: 'action',
      width: 250, // 增加寬度以容納新按鈕
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看詳情">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          
          {/* WhatsApp 對話按鈕 */}
          <Tooltip title="WhatsApp 對話">
            <Button 
              type="text" 
              icon={<MessageOutlined />} 
              onClick={() => handleOpenChat(record)}
              style={{ color: '#25d366' }}
            />
          </Tooltip>
          
          {record.status === 'running' && (
            <>
              <Tooltip title="暫停">
                <Button 
                  type="text" 
                  icon={<PauseCircleOutlined />} 
                  onClick={() => handleInstanceAction('pause', record)}
                />
              </Tooltip>
              <Tooltip title="取消">
                <Button 
                  type="text" 
                  icon={<StopOutlined />} 
                  onClick={() => handleInstanceAction('cancel', record)}
                />
              </Tooltip>
            </>
          )}
          
          {record.status === 'failed' && (
            <Tooltip title="重試">
              <Button 
                type="text" 
                icon={<ReloadOutlined />} 
                onClick={() => handleInstanceAction('retry', record)}
              />
            </Tooltip>
          )}
          
          {(record.status === 'waiting' || record.status === 'paused') && (
            <Tooltip title="恢復">
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

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ padding: '24px' }}>
        {/* 頁面標題 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>
            <BarChartOutlined style={{ marginRight: 12, color: '#1890ff' }} />
            {t('workflowMonitor.title')}
          </Title>
          <Text type="secondary">
            監控和管理您的 WhatsApp 工作流程實例
          </Text>
        </div>

        {/* 統計卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="總實例數"
                value={statistics.total}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="運行中"
                value={statistics.running}
                prefix={<SyncOutlinedIcon spin />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="已完成"
                value={statistics.completed}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="成功率"
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
                placeholder="選擇狀態"
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
                placeholder={['開始日期', '結束日期']}
                value={filters.dateRange}
                onChange={handleDateRangeChange}
                style={{ width: '100%' }}
              />
            </Col>
            
            <Col xs={24} sm={12} md={6}>
              <Search
                placeholder="搜尋流程名稱、實例 ID..."
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
                  刷新
                </Button>
                
                <Tooltip title="自動刷新設置">
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
              <Text strong>實例列表</Text>
              <Badge count={instances.length} showZero />
              
              {selectedInstances.length > 0 && (
                <Text type="secondary">
                  已選擇 {selectedInstances.length} 個實例
                </Text>
              )}
            </Space>
          </div>
          
          <Table
            columns={columns}
            dataSource={instances}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, current: page, pageSize }));
              },
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `第 ${range[0]}-${range[1]} 項，共 ${total} 項`
            }}
            rowSelection={{
              selectedRowKeys: selectedInstances.map(i => i.id),
              onChange: (selectedRowKeys, selectedRows) => {
                setSelectedInstances(selectedRows);
              }
            }}
            scroll={{ x: 1200 }}
          />
        </Card>

        {/* 實例詳情彈窗 */}
        <Modal
          title="實例詳情"
          visible={detailModalVisible}
          onCancel={() => setDetailModalVisible(false)}
          footer={null}
          width={800}
        >
          {selectedInstance && (
            <InstanceDetailModal 
              instance={selectedInstance} 
              onClose={() => setDetailModalVisible(false)}
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
      </Content>
    </Layout>
  );
};

// 實例詳情組件
const InstanceDetailModal = ({ instance, onClose }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('basic');
  const [eformInstances, setEformInstances] = useState([]);
  const [loadingEforms, setLoadingEforms] = useState(false);

  // 載入表單實例數據
  useEffect(() => {
    if (activeTab === 'forms') {
      loadEformInstances();
    }
  }, [activeTab, instance.id]);

  const loadEformInstances = async () => {
    try {
      setLoadingEforms(true);
      console.log(`正在載入工作流程實例 ID: ${instance.id} 的表單實例`);
      
      const response = await fetch(`/api/workflowexecutions/${instance.id}/eform-instances`);
      console.log('API 響應狀態:', response.status);
      console.log('API 響應狀態文本:', response.statusText);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('API 端點不存在，請檢查後端控制器');
          // 如果 API 端點不存在，顯示提示信息
          setEformInstances([]);
          message.warning('表單實例 API 端點尚未實現，請聯繫開發人員');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('載入到的表單實例數據:', data);
      setEformInstances(data);
    } catch (error) {
      console.error('載入表單實例失敗:', error);
      
      // 根據錯誤類型顯示不同的提示信息
      if (error.message.includes('404')) {
        message.error('表單實例 API 端點不存在，請檢查後端配置');
      } else if (error.message.includes('500')) {
        message.error('後端服務器錯誤，請檢查日誌');
      } else {
        message.error(`載入表單實例失敗: ${error.message}`);
      }
      
      setEformInstances([]);
    } finally {
      setLoadingEforms(false);
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
      case 'Pending': return '待審批';
      case 'Approved': return '已批准';
      case 'Rejected': return '已拒絕';
      default: return status;
    }
  };

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="基本信息" key="basic">
          <Descriptions bordered column={2}>
            <Descriptions.Item label="實例 ID">{instance.id}</Descriptions.Item>
            <Descriptions.Item label="流程名稱">{instance.workflowName}</Descriptions.Item>
            <Descriptions.Item label="狀態">
              {instance.status === 'running' ? (
                <Tag color="processing" icon={<SyncOutlinedIcon spin />}>
                  運行中
                </Tag>
              ) : (
                <Tag color={instance.status === 'completed' ? 'success' : 'error'}>
                  {instance.status}
                </Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="當前步驟">
              {instance.currentStep || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="開始時間">
              {dayjs(instance.startedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="結束時間">
              {instance.endedAt ? dayjs(instance.endedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="執行時間">
              {instance.duration ? `${Math.round(instance.duration)} 分鐘` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="創建者">{instance.createdBy}</Descriptions.Item>
          </Descriptions>
          
          {instance.errorMessage && (
            <Alert
              message="錯誤信息"
              description={instance.errorMessage}
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </TabPane>
        
        <TabPane tab="執行歷史" key="history">
          <Timeline>
            <Timeline.Item color="green">
              <p>流程啟動</p>
              <p>{dayjs(instance.startedAt).format('YYYY-MM-DD HH:mm:ss')}</p>
            </Timeline.Item>
            {instance.stepExecutions && instance.stepExecutions.length > 0 ? (
              instance.stepExecutions.map((step, index) => {
                // 調試信息：檢查步驟數據結構
                console.log(`步驟 ${index + 1} 數據:`, step);
                console.log(`步驟 ${index + 1} 可用字段:`, Object.keys(step));
                console.log(`步驟 ${index + 1} outputJson:`, step.outputJson);
                console.log(`步驟 ${index + 1} OutputJson:`, step.OutputJson);
                console.log(`步驟 ${index + 1} output:`, step.output);
                console.log(`步驟 ${index + 1} errorMessage:`, step.errorMessage);
                
                // 解析 OutputJson 來判斷是否為錯誤
                let outputData = null;
                let isError = false;
                let displayMessage = '';
                
                // 嘗試多個可能的字段名稱
                const jsonContent = step.outputJson || step.OutputJson || step.output;
                
                if (jsonContent) {
                  try {
                    outputData = JSON.parse(jsonContent);
                    console.log(`步驟 ${index + 1} 解析後的數據:`, outputData);
                    
                    // 優先檢查 success 字段
                    if (outputData.success === true) {
                      isError = false;
                      displayMessage = outputData.message || '操作成功';
                      console.log(`步驟 ${index + 1} 檢測到 success: true，標記為非錯誤`);
                    }
                    // 檢查是否包含錯誤信息
                    else if (outputData.error) {
                      isError = true;
                      displayMessage = outputData.error;
                      console.log(`步驟 ${index + 1} 檢測到 error 字段，標記為錯誤`);
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
                        console.log(`步驟 ${index + 1} 檢測到成功消息，標記為非錯誤`);
                      } else {
                        // 默認情況下，message 字段通常表示信息，不是錯誤
                        isError = false;
                        displayMessage = outputData.message;
                        console.log(`步驟 ${index + 1} 檢測到普通消息，標記為非錯誤`);
                      }
                    }
                    // 如果沒有明確的字段，檢查整個 JSON 內容
                    else {
                      // 如果沒有明確的錯誤標識，通常不是錯誤
                      isError = false;
                      displayMessage = JSON.stringify(outputData, null, 2);
                      console.log(`步驟 ${index + 1} 沒有明確字段，標記為非錯誤`);
                    }
                  } catch (parseError) {
                    console.error(`步驟 ${index + 1} 解析 JSON 失敗:`, parseError);
                    // 如果解析失敗，將原始內容作為普通信息顯示
                    displayMessage = jsonContent;
                    isError = false; // 解析失敗不一定是錯誤
                  }
                } else {
                  console.log(`步驟 ${index + 1} 沒有找到 JSON 內容字段`);
                }
                
                console.log(`步驟 ${index + 1} 最終判斷結果:`, { isError, displayMessage });
                
                return (
                  <Timeline.Item 
                    key={step.id} 
                    color={step.status === 'completed' ? 'green' : step.status === 'failed' ? 'red' : 'blue'}
                  >
                    <p>執行步驟: {step.stepName || `步驟 ${index + 1}`}</p>
                    <p>狀態: {step.status}</p>
                    <p>開始時間: {step.startedAt ? dayjs(step.startedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</p>
                    {step.endedAt && (
                      <p>完成時間: {dayjs(step.endedAt).format('YYYY-MM-DD HH:mm:ss')}</p>
                    )}
                    
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
                        <strong>{isError ? '錯誤: ' : '信息: '}</strong>
                        {displayMessage}
                        
                        {/* 如果有額外的輸出數據，顯示更多信息 */}
                        {outputData && outputData.timestamp && (
                          <div style={{ 
                            marginTop: '4px', 
                            fontSize: '12px', 
                            opacity: 0.7 
                          }}>
                            時間: {new Date(outputData.timestamp).toLocaleString('zh-TW')}
                          </div>
                        )}
                        
                        {outputData && outputData.userResponse && (
                          <div style={{ 
                            marginTop: '4px', 
                            fontSize: '12px', 
                            opacity: 0.7 
                          }}>
                            用戶回應: {outputData.userResponse}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* 智能處理 errorMessage 字段，只顯示真正的錯誤信息 */}
                    {step.errorMessage && (
                      (() => {
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
                              ))) {
                            console.log(`步驟 ${index + 1} errorMessage 包含成功信息，不顯示為錯誤`);
                            return null; // 不顯示
                          }
                        } catch (parseError) {
                          // 如果解析失敗，可能是純文本錯誤信息，正常顯示
                          console.log(`步驟 ${index + 1} errorMessage 解析失敗，作為純文本錯誤顯示`);
                        }
                        
                        // 顯示真正的錯誤信息
                        return (
                          <p style={{ color: 'red' }}>錯誤: {step.errorMessage}</p>
                        );
                      })()
                    )}
                  </Timeline.Item>
                );
              })
            ) : (
              <Timeline.Item color="blue">
                <p>暫無步驟執行記錄</p>
              </Timeline.Item>
            )}
            {instance.status === 'completed' && (
              <Timeline.Item color="green">
                <p>流程完成</p>
                <p>{dayjs(instance.endedAt).format('YYYY-MM-DD HH:mm:ss')}</p>
              </Timeline.Item>
            )}
          </Timeline>
        </TabPane>
        
        <TabPane tab="表單實例" key="forms">
          {loadingEforms ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>載入表單實例中...</p>
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
                          {eform.formName || '未命名表單'}
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
                          <strong style={{ color: '#595959' }}>實例名稱:</strong>
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
                          <strong style={{ color: '#595959' }}>創建時間:</strong>
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
                            <strong style={{ color: '#595959' }}>用戶輸入:</strong>
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
                            <strong style={{ color: '#595959' }}>審批人:</strong>
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
                            <strong style={{ color: '#595959' }}>審批時間:</strong>
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
                            <strong style={{ color: '#595959' }}>審批備註:</strong>
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
                        查看詳情
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Empty 
              description="暫無表單實例" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default WorkflowMonitorPage;
