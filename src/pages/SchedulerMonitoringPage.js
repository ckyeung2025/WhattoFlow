import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Table, 
  Space, 
  Typography, 
  Row, 
  Col,
  Select, 
  DatePicker,
  Input,
  Tag,
  Divider,
  Statistic,
  message
} from 'antd';
import { 
  ArrowLeftOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const SchedulerMonitoringPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    scheduleType: 'all',
    status: 'all',
    dateRange: null,
    keyword: ''
  });

  useEffect(() => {
    loadExecutions();
  }, []);

  // 載入執行記錄
  const loadExecutions = async () => {
    try {
      setLoading(true);
      // TODO: 實現 API 調用
      // const response = await schedulerMonitoringApi.getExecutions(filters);
      // setExecutions(response.executions || []);
      
      // 模擬數據
      const mockData = [
        {
          id: '1',
          scheduleType: 'retry_monitoring',
          relatedName: '訂單審批流程',
          status: 'Success',
          totalItems: 5,
          successCount: 5,
          failedCount: 0,
          message: '發送 5 個重試訊息',
          startedAt: '2025-10-27T10:00:00Z',
          completedAt: '2025-10-27T10:00:01Z',
          executionDurationMs: 1000
        },
        {
          id: '2',
          scheduleType: 'contact_import',
          relatedName: 'test7',
          status: 'Success',
          totalItems: 50,
          successCount: 50,
          failedCount: 0,
          message: '成功匯入 50 筆聯絡人',
          startedAt: '2025-10-27T09:54:00Z',
          completedAt: '2025-10-27T09:54:05Z',
          executionDurationMs: 5000
        }
      ];
      
      setExecutions(mockData);
    } catch (error) {
      message.error('載入記錄失敗：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 獲取排程類型標籤
  const getScheduleTypeTag = (type) => {
    const tags = {
      retry_monitoring: { color: 'blue', text: '重試監控' },
      overdue_monitoring: { color: 'orange', text: '逾期監控' },
      dataset_sync: { color: 'green', text: '數據集同步' },
      contact_import: { color: 'purple', text: '聯絡人匯入' }
    };
    const tag = tags[type] || { color: 'default', text: type };
    return <Tag color={tag.color}>{tag.text}</Tag>;
  };

  // 獲取狀態標籤
  const getStatusTag = (status) => {
    const tags = {
      Success: { color: 'success', text: '成功' },
      Failed: { color: 'error', text: '失敗' },
      Partial: { color: 'warning', text: '部分成功' },
      Running: { color: 'processing', text: '執行中' },
      Skipped: { color: 'default', text: '已跳過' }
    };
    const tag = tags[status] || { color: 'default', text: status };
    return <Tag color={tag.color}>{tag.text}</Tag>;
  };

  // 統計數據
  const stats = {
    total: executions.length,
    success: executions.filter(e => e.status === 'Success').length,
    failed: executions.filter(e => e.status === 'Failed').length,
    running: executions.filter(e => e.status === 'Running').length
  };

  const columns = [
    {
      title: '排程類型',
      dataIndex: 'scheduleType',
      key: 'scheduleType',
      width: 150,
      render: (type) => getScheduleTypeTag(type)
    },
    {
      title: '關聯目標',
      dataIndex: 'relatedName',
      key: 'relatedName',
      width: 200,
      ellipsis: true
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status)
    },
    {
      title: '處理結果',
      key: 'result',
      width: 200,
      render: (record) => {
        if (record.status === 'Running') return <Text type="secondary">執行中...</Text>;
        return `${record.successCount}/${record.totalItems} 成功`;
      }
    },
    {
      title: '訊息',
      dataIndex: 'message',
      key: 'message',
      width: 250,
      ellipsis: true
    },
    {
      title: '開始時間',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '耗時',
      dataIndex: 'executionDurationMs',
      key: 'duration',
      width: 100,
      render: (ms) => ms ? `${(ms / 1000).toFixed(1)} 秒` : '-'
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 頁面標題 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Button 
            type="primary"
            shape="square"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard')}
            style={{ 
              width: '40px', 
              height: '40px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        </Col>
        <Col flex="auto">
          <Title level={2} style={{ margin: 0 }}>
            排程監控
          </Title>
        </Col>
      </Row>

      {/* 統計卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic title="總執行次數" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="成功" 
              value={stats.success} 
              valueStyle={{ color: '#3f8600' }} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="失敗" 
              value={stats.failed} 
              valueStyle={{ color: '#cf1322' }} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="執行中" 
              value={stats.running} 
              valueStyle={{ color: '#1890ff' }} 
            />
          </Card>
        </Col>
      </Row>

      {/* 篩選器 */}
      <Card style={{ marginBottom: '24px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row gutter={16}>
            <Col span={6}>
              <Text strong>排程類型：</Text>
              <Select 
                value={filters.scheduleType}
                onChange={(value) => setFilters({ ...filters, scheduleType: value })}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <Option value="all">全部</Option>
                <Option value="retry_monitoring">重試監控</Option>
                <Option value="overdue_monitoring">逾期監控</Option>
                <Option value="dataset_sync">數據集同步</Option>
                <Option value="contact_import">聯絡人匯入</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Text strong>狀態：</Text>
              <Select 
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <Option value="all">全部</Option>
                <Option value="Success">成功</Option>
                <Option value="Failed">失敗</Option>
                <Option value="Running">執行中</Option>
              </Select>
            </Col>
            <Col span={8}>
              <Text strong>時間範圍：</Text>
              <RangePicker
                value={filters.dateRange}
                onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
                style={{ width: '100%', marginTop: '8px' }}
                showTime
              />
            </Col>
            <Col span={4}>
              <Button 
                type="primary" 
                icon={<SearchOutlined />}
                onClick={loadExecutions}
                style={{ marginTop: '30px', width: '100%' }}
              >
                查詢
              </Button>
            </Col>
          </Row>
          <Row>
            <Col span={24}>
              <Text strong>關鍵字搜尋：</Text>
              <Input
                placeholder="搜尋訊息內容、錯誤訊息等"
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                style={{ marginTop: '8px' }}
                suffix={<SearchOutlined />}
              />
            </Col>
          </Row>
        </Space>
      </Card>

      {/* 執行記錄表格 */}
      <Card 
        title={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadExecutions}>
              刷新
            </Button>
            <Divider type="vertical" />
            <Text>{executions.length} 筆記錄</Text>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={executions}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 筆記錄`
          }}
          scroll={{ x: 1200 }}
          expandedRowRender={(record) => {
            if (record.errorMessage || record.message) {
              return (
                <div style={{ padding: '16px' }}>
                  {record.message && (
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>訊息：</Text>
                      <Text>{record.message}</Text>
                    </div>
                  )}
                  {record.errorMessage && (
                    <div>
                      <Text strong type="danger">錯誤訊息：</Text>
                      <Text type="danger">{record.errorMessage}</Text>
                    </div>
                  )}
                </div>
              );
            }
            return null;
          }}
        />
      </Card>
    </div>
  );
};

export default SchedulerMonitoringPage;

