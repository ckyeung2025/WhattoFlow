import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Collapse, DatePicker, Tag } from 'antd';
import { 
  ProjectOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TableOutlined,
  WarningOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReportTable from '../components/ReportTable';
import { exportReport } from '../components/ReportExport';
import { PieChart, BarChart, LineChart, ScatterChart } from '../components/ReportCharts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { MonthPicker } = DatePicker;

const BusinessProcessInsights = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [statistics, setStatistics] = useState({
    totalProcessTypes: 0,
    avgEfficiency: 0,
    bottleneckCount: 0,
    optimizationSuggestions: 0
  });
  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState({
    processTypeDistribution: [],
    efficiencyComparison: { names: [], successRates: [], avgDurations: [] },
    usageFrequencyTrend: { dates: [], counts: [] },
    efficiencyVsDuration: []
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
      title: t('reports.executionCount') || '執行次數',
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
      title: t('reports.avgDuration') || '平均執行時長',
      dataIndex: 'avgDuration',
      key: 'avgDuration',
      width: 150,
      render: (duration) => `${duration.toFixed(1)} 分鐘`,
      sorter: (a, b) => a.avgDuration - b.avgDuration,
    },
    {
      title: t('reports.bottleneck') || '瓶頸識別',
      dataIndex: 'isBottleneck',
      key: 'isBottleneck',
      width: 120,
      render: (isBottleneck) => isBottleneck ? (
        <Tag color="red">{t('reports.yes') || '是'}</Tag>
      ) : (
        <Tag color="green">{t('reports.no') || '否'}</Tag>
      )
    },
    {
      title: t('reports.optimization') || '優化建議',
      dataIndex: 'optimization',
      key: 'optimization',
      width: 200,
      render: (optimization) => optimization ? (
        <Tag color="orange">{optimization}</Tag>
      ) : '-'
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

      const response = await fetch(`/api/reports/monthly/business-process-insights?year=${year}&month=${month}`, {
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
        totalProcessTypes: data.totalProcessTypes || 0,
        avgEfficiency: data.avgEfficiency || 0,
        bottleneckCount: data.bottleneckCount || 0,
        optimizationSuggestions: data.optimizationSuggestions || 0
      });

      // 準備圖表數據
      prepareChartData(data);

      // 準備表格數據
      const tableData = (data.processInsights || []).map((item, index) => ({
        key: item.workflowId || index,
        id: item.workflowId,
        workflowName: item.workflowName || '未命名工作流',
        executionCount: item.executionCount || 0,
        successRate: item.successRate || 0,
        avgDuration: item.avgDuration || 0,
        isBottleneck: item.isBottleneck || false,
        optimization: item.optimization || null,
      }));

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
    // 流程類型分佈
    const processTypeDistribution = (data.processTypeDistribution || []).map(p => ({
      name: p.workflowName || '未命名工作流',
      value: p.executionCount || 0
    }));

    // 效率對比
    const efficiencyComparison = data.efficiencyComparison || [];
    setChartData(prev => ({
      ...prev,
      processTypeDistribution,
      efficiencyComparison: {
        names: efficiencyComparison.map(e => e.workflowName || '未命名工作流'),
        successRates: efficiencyComparison.map(e => e.successRate || 0),
        avgDurations: efficiencyComparison.map(e => e.avgDuration || 0)
      },
      usageFrequencyTrend: {
        dates: (data.usageFrequencyTrend || []).map(t => t.date),
        counts: (data.usageFrequencyTrend || []).map(t => t.count || 0)
      },
      efficiencyVsDuration: (data.efficiencyVsDuration || []).map(e => [
        e.avgDuration || 0,
        e.successRate || 0
      ])
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
        `業務流程洞察月報_${selectedMonth.format('YYYY-MM')}`,
        {
          sheetName: '業務流程洞察月報',
          title: t('reports.monthly.businessInsights') || '業務流程洞察月報',
          statistics: {
            '流程類型總數': statistics.totalProcessTypes,
            '平均效率': `${statistics.avgEfficiency.toFixed(1)}%`,
            '瓶頸流程數量': statistics.bottleneckCount,
            '優化建議數量': statistics.optimizationSuggestions
          }
        }
      );
      message.success(t('reports.exportSuccess') || '匯出成功');
    } catch (error) {
      console.error('匯出失敗:', error);
      message.error(t('reports.exportFailed') || `匯出失敗: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: 0 }}>
            {t('reports.monthly.businessInsights') || '業務流程洞察月報'}
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
                  title={t('reports.totalProcessTypes') || '流程類型總數'}
                  value={statistics.totalProcessTypes}
                  prefix={<ProjectOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.avgEfficiency') || '平均效率'}
                  value={statistics.avgEfficiency}
                  precision={1}
                  suffix="%"
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.bottleneckCount') || '瓶頸流程'}
                  value={statistics.bottleneckCount}
                  prefix={<WarningOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.optimizationSuggestions') || '優化建議'}
                  value={statistics.optimizationSuggestions}
                  prefix={<ThunderboltOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 圖表分析區域 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* 流程類型分佈 */}
            <Col xs={24} sm={12} lg={8}>
              <PieChart
                title={t('reports.processTypeDistribution') || '流程類型分佈'}
                data={chartData.processTypeDistribution}
                height={350}
                colors={['#7234CF', '#1890ff', '#52c41a', '#faad14', '#ff4d4f']}
              />
            </Col>
            {/* 效率對比（成功率） */}
            <Col xs={24} sm={12} lg={8}>
              <BarChart
                title={t('reports.efficiencyComparison') || '效率對比 - 成功率'}
                xAxisData={chartData.efficiencyComparison.names}
                seriesData={[{
                  name: t('reports.successRate') || '成功率',
                  data: chartData.efficiencyComparison.successRates
                }]}
                height={350}
                colors={['#52c41a']}
                horizontal={true}
              />
            </Col>
            {/* 效率對比（執行時長） */}
            <Col xs={24} sm={12} lg={8}>
              <BarChart
                title={t('reports.durationComparison') || '效率對比 - 執行時長'}
                xAxisData={chartData.efficiencyComparison.names}
                seriesData={[{
                  name: t('reports.avgDuration') || '平均執行時長（分鐘）',
                  data: chartData.efficiencyComparison.avgDurations
                }]}
                height={350}
                colors={['#1890ff']}
                horizontal={true}
              />
            </Col>
            {/* 使用頻率趨勢 */}
            <Col xs={24} sm={12} lg={12}>
              <LineChart
                title={t('reports.usageFrequencyTrend') || '流程使用頻率趨勢'}
                xAxisData={chartData.usageFrequencyTrend.dates}
                seriesData={[{
                  name: t('reports.executionCount') || '執行數量',
                  data: chartData.usageFrequencyTrend.counts
                }]}
                height={300}
                colors={['#7234CF']}
              />
            </Col>
            {/* 效率 vs 執行時長散點圖 */}
            <Col xs={24} sm={12} lg={12}>
              <ScatterChart
                title={t('reports.efficiencyVsDuration') || '效率 vs 執行時長'}
                data={chartData.efficiencyVsDuration}
                height={300}
                xAxisName={t('reports.avgDuration') || '平均執行時長（分鐘）'}
                yAxisName={t('reports.successRate') || '成功率（%）'}
                colors={['#7234CF']}
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

export default BusinessProcessInsights;
