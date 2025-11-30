import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Collapse, DatePicker, Timeline, Tag } from 'antd';
import { 
  DashboardOutlined, 
  CheckCircleOutlined, 
  FileTextOutlined,
  MessageOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TableOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  FallOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReportTable from '../components/ReportTable';
import { exportReport } from '../components/ReportExport';
import { GaugeChart, BarChart, LineChart } from '../components/ReportCharts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { MonthPicker } = DatePicker;

const OperationalPerformanceOverview = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [statistics, setStatistics] = useState({
    workflowSuccessRate: 0,
    formApprovalEfficiency: 0,
    whatsappResponseRate: 0,
    systemAvailability: 0,
    previousMonth: {
      workflowSuccessRate: 0,
      formApprovalEfficiency: 0,
      whatsappResponseRate: 0,
      systemAvailability: 0
    }
  });
  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState({
    kpiTrend: { dates: [], workflowSuccess: [], formEfficiency: [], whatsappResponse: [], systemAvailability: [] },
    improvementSuggestions: []
  });
  const [anomalyEvents, setAnomalyEvents] = useState([]);

  const handleMonthChange = (date) => {
    setSelectedMonth(date);
  };

  // 基礎列定義
  const baseColumns = [
    {
      title: t('reports.suggestion') || '建議',
      dataIndex: 'suggestion',
      key: 'suggestion',
      width: 300,
    },
    {
      title: t('reports.category') || '類別',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (category) => {
        const colorMap = {
          '工作流': 'blue',
          '表單': 'orange',
          'WhatsApp': 'green',
          '系統': 'purple'
        };
        return <Tag color={colorMap[category] || 'default'}>{category}</Tag>;
      }
    },
    {
      title: t('reports.priority') || '優先級',
      dataIndex: 'priority',
      key: 'priority',
      width: 120,
      render: (priority) => {
        const colorMap = {
          '高': 'red',
          '中': 'orange',
          '低': 'blue'
        };
        return <Tag color={colorMap[priority] || 'default'}>{priority}</Tag>;
      }
    },
    {
      title: t('reports.description') || '描述',
      dataIndex: 'description',
      key: 'description',
      width: 400,
      ellipsis: true,
    },
  ];

  // 載入報表數據
  const loadReportData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error(t('reports.loginRequired') || '請先登入');
        return;
      }

      const year = selectedMonth.year();
      const month = selectedMonth.month() + 1; // dayjs month is 0-based

      const response = await fetch(`/api/reports/monthly/operational-performance-overview?year=${year}&month=${month}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      setStatistics({
        workflowSuccessRate: data.workflowSuccessRate || 0,
        formApprovalEfficiency: data.formApprovalEfficiency || 0,
        whatsappResponseRate: data.whatsappResponseRate || 0,
        systemAvailability: data.systemAvailability || 0,
        previousMonth: {
          workflowSuccessRate: data.previousMonth?.workflowSuccessRate || 0,
          formApprovalEfficiency: data.previousMonth?.formApprovalEfficiency || 0,
          whatsappResponseRate: data.previousMonth?.whatsappResponseRate || 0,
          systemAvailability: data.previousMonth?.systemAvailability || 0
        }
      });

      // 準備圖表數據
      prepareChartData(data);

      // 準備表格數據
      const tableData = (data.improvementSuggestions || []).map((item, index) => ({
        key: index,
        id: index,
        suggestion: item.suggestion || '',
        category: item.category || '系統',
        priority: item.priority || '中',
        description: item.description || '',
      }));

      setDataSource(tableData);

      // 準備異常事件時間線
      const events = (data.anomalyEvents || []).map((event, index) => ({
        key: index,
        time: event.time,
        type: event.type,
        description: event.description,
        severity: event.severity
      }));
      setAnomalyEvents(events);
    } catch (error) {
      console.error('載入報表數據失敗:', error);
      message.error(t('reports.loadDataFailed') || '載入報表數據失敗');
    } finally {
      setLoading(false);
    }
  };

  // 準備圖表數據
  const prepareChartData = (data) => {
    const kpiTrend = data.kpiTrend || [];
    setChartData(prev => ({
      ...prev,
      kpiTrend: {
        dates: kpiTrend.map(t => t.date),
        workflowSuccess: kpiTrend.map(t => t.workflowSuccessRate || 0),
        formEfficiency: kpiTrend.map(t => t.formApprovalEfficiency || 0),
        whatsappResponse: kpiTrend.map(t => t.whatsappResponseRate || 0),
        systemAvailability: kpiTrend.map(t => t.systemAvailability || 0)
      },
      improvementSuggestions: data.improvementSuggestions || []
    }));
  };

  useEffect(() => {
    if (selectedMonth) {
      loadReportData();
    }
  }, [selectedMonth]);

  const handleRefresh = () => {
    loadReportData();
  };

  // 獲取完整的列定義（用於匯出）
  const columns = useMemo(() => {
    return baseColumns;
  }, [baseColumns]);

  const handleExport = async (format = 'excel') => {
    try {
      await exportReport(
        format,
        dataSource,
        columns,
        `營運效能總覽月報_${selectedMonth.format('YYYY-MM')}`,
        {
          sheetName: '營運效能總覽月報',
          title: t('reports.monthly.operationalOverview') || '營運效能總覽月報',
          statistics: {
            '工作流成功率': `${statistics.workflowSuccessRate.toFixed(1)}%`,
            '表單審批效率': `${statistics.formApprovalEfficiency.toFixed(1)}%`,
            'WhatsApp 回應率': `${statistics.whatsappResponseRate.toFixed(1)}%`,
            '系統可用性': `${statistics.systemAvailability.toFixed(1)}%`
          }
        }
      );
      message.success(t('reports.exportSuccess') || '匯出成功');
    } catch (error) {
      console.error('匯出失敗:', error);
      message.error(t('reports.exportFailed') || `匯出失敗: ${error.message}`);
    }
  };

  // 計算趨勢變化
  const getTrendIcon = (current, previous) => {
    if (current > previous) return <RiseOutlined style={{ color: '#52c41a' }} />;
    if (current < previous) return <FallOutlined style={{ color: '#ff4d4f' }} />;
    return null;
  };

  const getTrendText = (current, previous) => {
    if (current > previous) return `+${(current - previous).toFixed(1)}%`;
    if (current < previous) return `${(current - previous).toFixed(1)}%`;
    return '0%';
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: 0 }}>
            {t('reports.monthly.operationalOverview') || '營運效能總覽月報'}
          </Title>
          <Space>
            <MonthPicker
              placeholder={t('common.selectMonth') || '選擇月份'}
              value={selectedMonth}
              onChange={handleMonthChange}
              format="YYYY-MM"
              style={{ width: 200 }}
            />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              {t('common.refresh') || '刷新'}
            </Button>
            <Button.Group>
              <Button icon={<DownloadOutlined />} onClick={() => handleExport('excel')}>
                {t('common.exportExcel') || '匯出 Excel'}
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => handleExport('pdf')}>
                {t('common.exportPdf') || '匯出 PDF'}
              </Button>
            </Button.Group>
          </Space>
        </Space>

        {/* 統計卡片 - KPI 總覽 */}
        <Spin spinning={loading}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.workflowSuccessRate') || '工作流成功率'}
                  value={statistics.workflowSuccessRate}
                  precision={1}
                  suffix="%"
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                  suffix={
                    <Space size={4}>
                      <span>%</span>
                      {statistics.previousMonth.workflowSuccessRate !== statistics.workflowSuccessRate && (
                        <>
                          {getTrendIcon(statistics.workflowSuccessRate, statistics.previousMonth.workflowSuccessRate)}
                          <span style={{ fontSize: '12px' }}>
                            {getTrendText(statistics.workflowSuccessRate, statistics.previousMonth.workflowSuccessRate)}
                          </span>
                        </>
                      )}
                    </Space>
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.formApprovalEfficiency') || '表單審批效率'}
                  value={statistics.formApprovalEfficiency}
                  precision={1}
                  suffix="%"
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                  suffix={
                    <Space size={4}>
                      <span>%</span>
                      {statistics.previousMonth.formApprovalEfficiency !== statistics.formApprovalEfficiency && (
                        <>
                          {getTrendIcon(statistics.formApprovalEfficiency, statistics.previousMonth.formApprovalEfficiency)}
                          <span style={{ fontSize: '12px' }}>
                            {getTrendText(statistics.formApprovalEfficiency, statistics.previousMonth.formApprovalEfficiency)}
                          </span>
                        </>
                      )}
                    </Space>
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.whatsappResponseRate') || 'WhatsApp 回應率'}
                  value={statistics.whatsappResponseRate}
                  precision={1}
                  suffix="%"
                  prefix={<MessageOutlined />}
                  valueStyle={{ color: '#13c2c2' }}
                  suffix={
                    <Space size={4}>
                      <span>%</span>
                      {statistics.previousMonth.whatsappResponseRate !== statistics.whatsappResponseRate && (
                        <>
                          {getTrendIcon(statistics.whatsappResponseRate, statistics.previousMonth.whatsappResponseRate)}
                          <span style={{ fontSize: '12px' }}>
                            {getTrendText(statistics.whatsappResponseRate, statistics.previousMonth.whatsappResponseRate)}
                          </span>
                        </>
                      )}
                    </Space>
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.systemAvailability') || '系統可用性'}
                  value={statistics.systemAvailability}
                  precision={1}
                  suffix="%"
                  prefix={<DashboardOutlined />}
                  valueStyle={{ color: '#7234CF' }}
                  suffix={
                    <Space size={4}>
                      <span>%</span>
                      {statistics.previousMonth.systemAvailability !== statistics.systemAvailability && (
                        <>
                          {getTrendIcon(statistics.systemAvailability, statistics.previousMonth.systemAvailability)}
                          <span style={{ fontSize: '12px' }}>
                            {getTrendText(statistics.systemAvailability, statistics.previousMonth.systemAvailability)}
                          </span>
                        </>
                      )}
                    </Space>
                  }
                />
              </Card>
            </Col>
          </Row>

          {/* 圖表分析區域 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* KPI 儀表盤 */}
            <Col xs={24} sm={12} lg={6}>
              <GaugeChart
                title={t('reports.workflowSuccessRate') || '工作流成功率'}
                value={statistics.workflowSuccessRate}
                height={250}
                color="#52c41a"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <GaugeChart
                title={t('reports.formApprovalEfficiency') || '表單審批效率'}
                value={statistics.formApprovalEfficiency}
                height={250}
                color="#1890ff"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <GaugeChart
                title={t('reports.whatsappResponseRate') || 'WhatsApp 回應率'}
                value={statistics.whatsappResponseRate}
                height={250}
                color="#13c2c2"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <GaugeChart
                title={t('reports.systemAvailability') || '系統可用性'}
                value={statistics.systemAvailability}
                height={250}
                color="#7234CF"
              />
            </Col>
            {/* KPI 趨勢對比 */}
            <Col xs={24} sm={24} lg={24}>
              <LineChart
                title={t('reports.kpiTrend') || 'KPI 趨勢對比（30天）'}
                xAxisData={chartData.kpiTrend.dates}
                seriesData={[
                  {
                    name: t('reports.workflowSuccessRate') || '工作流成功率',
                    data: chartData.kpiTrend.workflowSuccess
                  },
                  {
                    name: t('reports.formApprovalEfficiency') || '表單審批效率',
                    data: chartData.kpiTrend.formEfficiency
                  },
                  {
                    name: t('reports.whatsappResponseRate') || 'WhatsApp 回應率',
                    data: chartData.kpiTrend.whatsappResponse
                  },
                  {
                    name: t('reports.systemAvailability') || '系統可用性',
                    data: chartData.kpiTrend.systemAvailability
                  }
                ]}
                height={350}
                colors={['#52c41a', '#1890ff', '#13c2c2', '#7234CF']}
              />
            </Col>
          </Row>

          {/* 異常事件時間線 */}
          {anomalyEvents.length > 0 && (
            <Card title={
              <Space>
                <WarningOutlined />
                <span>{t('reports.anomalyEvents') || '異常事件總結'}</span>
              </Space>
            } style={{ marginBottom: 24 }}>
              <Timeline
                items={anomalyEvents.map((event, index) => ({
                  key: index,
                  color: event.severity === '高' ? 'red' : event.severity === '中' ? 'orange' : 'blue',
                  children: (
                    <div>
                      <Space>
                        <strong>{TimezoneUtils.formatDateTime(event.time, 'YYYY-MM-DD HH:mm:ss')}</strong>
                        <Tag color={event.severity === '高' ? 'red' : event.severity === '中' ? 'orange' : 'blue'}>
                          {event.severity}
                        </Tag>
                        <Tag>{event.type}</Tag>
                      </Space>
                      <div style={{ marginTop: 8, color: '#666' }}>{event.description}</div>
                    </div>
                  )
                }))}
              />
            </Card>
          )}

          {/* 改進建議表格 */}
          <Collapse
            items={[{
              key: '1',
              label: (
                <Space>
                  <ThunderboltOutlined />
                  <span>{t('reports.improvementSuggestions') || '改進建議'}</span>
                  <span style={{ color: '#999', fontSize: '12px' }}>
                    ({dataSource.length} {t('reports.records') || '條記錄'})
                  </span>
                </Space>
              ),
              children: (
                dataSource.length > 0 ? (
                  <ReportTable
                    dataSource={dataSource}
                    baseColumns={baseColumns}
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 條記錄`,
                    }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    {t('reports.noData') || '暫無數據'}
                  </div>
                )
              )
            }]}
            style={{ marginTop: 16 }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default OperationalPerformanceOverview;
