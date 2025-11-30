import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Collapse, DatePicker, Select } from 'antd';
import { 
  ProjectOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TableOutlined,
  RiseOutlined,
  FallOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReportTable from '../components/ReportTable';
import { exportReport } from '../components/ReportExport';
import { PieChart, BarChart, LineChart, GaugeChart } from '../components/ReportCharts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { MonthPicker } = DatePicker;
const { Option } = Select;

const WorkflowPerformanceMonthly = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [statistics, setStatistics] = useState({
    totalExecutions: 0,
    successRate: 0,
    avgDuration: 0,
    topWorkflowsCount: 0,
    previousMonthTotal: 0,
    previousMonthSuccessRate: 0,
    trend: {
      executions: 0, // 本月 vs 上月變化百分比
      successRate: 0  // 本月 vs 上月變化百分比
    }
  });
  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState({
    topWorkflows: { names: [], counts: [] },
    dailyTrend: { dates: [], executions: [], successRates: [] },
    failureReasons: [],
    workflowPerformance: []
  });

  const handleMonthChange = (date) => {
    setSelectedMonth(date);
  };

  // 基礎列定義
  const baseColumns = [
    {
      title: t('reports.workflowName') || '工作流名稱',
      dataIndex: 'workflowName',
      key: 'workflowName',
      width: 200,
    },
    {
      title: t('reports.totalExecutions') || '執行總數',
      dataIndex: 'executionCount',
      key: 'executionCount',
      width: 120,
      sorter: (a, b) => a.executionCount - b.executionCount,
    },
    {
      title: t('reports.successRate') || '成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      width: 120,
      render: (rate) => `${rate.toFixed(1)}%`,
      sorter: (a, b) => a.successRate - b.successRate,
    },
    {
      title: t('reports.failureRate') || '失敗率',
      dataIndex: 'failureRate',
      key: 'failureRate',
      width: 120,
      render: (rate) => `${rate.toFixed(1)}%`,
      sorter: (a, b) => a.failureRate - b.failureRate,
    },
    {
      title: t('reports.avgDuration') || '平均執行時長',
      dataIndex: 'avgDuration',
      key: 'avgDuration',
      width: 150,
      render: (duration) => `${duration.toFixed(1)} 分鐘`,
      sorter: (a, b) => a.avgDuration - b.avgDuration,
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

      const response = await fetch(`/api/reports/monthly/workflow-performance?year=${year}&month=${month}`, {
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
        totalExecutions: data.totalExecutions || 0,
        successRate: data.successRate || 0,
        avgDuration: data.avgDuration || 0,
        topWorkflowsCount: data.topWorkflows?.length || 0,
        previousMonthTotal: data.previousMonthTotal || 0,
        previousMonthSuccessRate: data.previousMonthSuccessRate || 0,
        trend: {
          executions: data.trend?.executions || 0,
          successRate: data.trend?.successRate || 0
        }
      });

      // 準備圖表數據
      prepareChartData(data);

      // 準備表格數據
      const tableData = (data.workflowPerformance || []).map((item, index) => {
        const finishedCount = (item.successCount || 0) + (item.failedCount || 0);
        return {
          key: item.workflowId || index,
          id: item.workflowId,
          workflowName: item.workflowName || '未命名工作流',
          executionCount: item.executionCount || 0,
          successCount: item.successCount || 0,
          failedCount: item.failedCount || 0,
          // 成功率 = 成功 / (成功 + 失敗)，只計算已完成的執行
          successRate: finishedCount > 0 ? (item.successCount / finishedCount) * 100 : 0,
          // 失敗率 = 失敗 / (成功 + 失敗)，只計算已完成的執行
          failureRate: finishedCount > 0 ? (item.failedCount / finishedCount) * 100 : 0,
          avgDuration: item.avgDuration || 0,
        };
      });

      setDataSource(tableData);
    } catch (error) {
      console.error('載入報表數據失敗:', error);
      message.error(t('reports.loadDataFailed') || '載入報表數據失敗');
    } finally {
      setLoading(false);
    }
  };

  // 準備圖表數據
  const prepareChartData = (data) => {
    // Top 工作流排名
    const topWorkflows = (data.topWorkflows || []).slice(0, 20);
    setChartData(prev => ({
      ...prev,
      topWorkflows: {
        names: topWorkflows.map(w => w.workflowName || '未命名工作流'),
        counts: topWorkflows.map(w => w.executionCount || 0)
      },
      dailyTrend: {
        dates: (data.dailyTrend || []).map(d => d.date),
        executions: (data.dailyTrend || []).map(d => d.executionCount || 0),
        successRates: (data.dailyTrend || []).map(d => d.successRate || 0)
      },
      failureReasons: (data.failureReasons || []).map(f => ({
        name: f.reason || '未知原因',
        value: f.count || 0
      })),
      workflowPerformance: data.workflowPerformance || []
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

  // 獲取完整的列定義（包含動態列）- 用於匯出
  const columns = useMemo(() => {
    return baseColumns;
  }, [baseColumns]);

  const handleExport = async (format = 'excel') => {
    try {
      await exportReport(
        format,
        dataSource,
        columns,
        `工作流效能月報_${selectedMonth.format('YYYY-MM')}`,
        {
          sheetName: '工作流效能月報',
          title: t('reports.monthly.workflowPerformance') || '工作流效能月報',
          statistics: {
            '執行總數': statistics.totalExecutions,
            '成功率': `${statistics.successRate.toFixed(1)}%`,
            '平均執行時長': `${statistics.avgDuration.toFixed(1)} 分鐘`,
            'Top 工作流數量': statistics.topWorkflowsCount
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
  const getTrendIcon = (value) => {
    if (value > 0) return <RiseOutlined style={{ color: '#52c41a' }} />;
    if (value < 0) return <FallOutlined style={{ color: '#ff4d4f' }} />;
    return null;
  };

  const getTrendText = (value) => {
    if (value > 0) return `+${value.toFixed(1)}%`;
    if (value < 0) return `${value.toFixed(1)}%`;
    return '0%';
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: 0 }}>
            {t('reports.monthly.workflowPerformance') || '工作流效能月報'}
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

        {/* 統計卡片 */}
        <Spin spinning={loading}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.totalExecutions') || '執行總數'}
                  value={statistics.totalExecutions}
                  prefix={<ProjectOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                  suffix={
                    statistics.trend.executions !== 0 && (
                      <Space size={4}>
                        {getTrendIcon(statistics.trend.executions)}
                        <span style={{ fontSize: '12px' }}>
                          {getTrendText(statistics.trend.executions)}
                        </span>
                      </Space>
                    )
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.successRate') || '成功率'}
                  value={statistics.successRate}
                  precision={1}
                  prefix={<CheckCircleOutlined />}
                  suffix={
                    <Space size={4}>
                      <span>%</span>
                      {statistics.trend.successRate !== 0 && (
                        <>
                          {getTrendIcon(statistics.trend.successRate)}
                          <span style={{ fontSize: '12px' }}>
                            {getTrendText(statistics.trend.successRate)}
                          </span>
                        </>
                      )}
                    </Space>
                  }
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.avgDuration') || '平均執行時長'}
                  value={statistics.avgDuration}
                  precision={1}
                  suffix={t('common.minutes') || '分鐘'}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#7234CF' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.topWorkflows') || 'Top 工作流'}
                  value={statistics.topWorkflowsCount}
                  prefix={<ProjectOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 圖表分析區域 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* 成功率儀表盤 */}
            <Col xs={24} sm={12} lg={6}>
              <GaugeChart
                title={t('reports.successRate') || '成功率'}
                value={statistics.successRate}
                height={300}
                color="#52c41a"
              />
            </Col>
            {/* Top 20 工作流執行排名 */}
            <Col xs={24} sm={12} lg={9}>
              <BarChart
                title={t('reports.topWorkflowsByExecution') || 'Top 20 工作流執行排名'}
                xAxisData={chartData.topWorkflows.names}
                seriesData={[{
                  name: t('reports.executionCount') || '執行數量',
                  data: chartData.topWorkflows.counts
                }]}
                height={300}
                colors={['#7234CF']}
                horizontal={true}
              />
            </Col>
            {/* 失敗原因分佈 */}
            <Col xs={24} sm={12} lg={9}>
              <PieChart
                title={t('reports.failureReasons') || '失敗原因分佈'}
                data={chartData.failureReasons}
                height={300}
                colors={['#ff4d4f', '#ff7875', '#ffa39e', '#ffccc7']}
              />
            </Col>
            {/* 30天執行趨勢 */}
            <Col xs={24} sm={24} lg={24}>
              <LineChart
                title={t('reports.workflowExecutionTrend') || '30天執行趨勢'}
                xAxisData={chartData.dailyTrend.dates}
                seriesData={[
                  {
                    name: t('reports.executionCount') || '執行數量',
                    data: chartData.dailyTrend.executions
                  },
                  {
                    name: t('reports.successRate') || '成功率',
                    data: chartData.dailyTrend.successRates,
                    yAxisIndex: 1
                  }
                ]}
                height={350}
                colors={['#7234CF', '#52c41a']}
                dualYAxis={true}
                yAxisName={[t('reports.executionCount') || '執行數量', t('reports.successRate') || '成功率（%）']}
              />
            </Col>
          </Row>

          {/* 表格明細（第二層） */}
          <Collapse
            items={[{
              key: '1',
              label: (
                <Space>
                  <TableOutlined />
                  <span>{t('reports.detailTable') || '明細表格'}</span>
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

export default WorkflowPerformanceMonthly;
