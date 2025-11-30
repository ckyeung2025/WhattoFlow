import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Collapse, DatePicker } from 'antd';
import { 
  FileTextOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TableOutlined,
  RiseOutlined,
  FallOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReportTable from '../components/ReportTable';
import { exportReport } from '../components/ReportExport';
import { PieChart, BarChart, LineChart, StackedBarChart } from '../components/ReportCharts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { MonthPicker } = DatePicker;

const FormApprovalAnalysisMonthly = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [statistics, setStatistics] = useState({
    totalForms: 0,
    approvalRate: 0,
    rejectionRate: 0,
    avgApprovalTime: 0,
    previousMonthTotal: 0,
    previousMonthApprovalRate: 0,
    trend: {
      totalForms: 0,
      approvalRate: 0
    }
  });
  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState({
    formTypeUsage: { names: [], counts: [] },
    approverWorkload: { names: [], approved: [], rejected: [] },
    dailyTrend: { dates: [], approvals: [], rejections: [] },
    weekdayVsWeekend: { weekday: 0, weekend: 0 }
  });

  const handleMonthChange = (date) => {
    setSelectedMonth(date);
  };

  // 基礎列定義
  const baseColumns = [
    {
      title: t('common.formName') || '表單名稱',
      dataIndex: 'formName',
      key: 'formName',
      width: 200,
    },
    {
      title: t('reports.totalForms') || '表單總數',
      dataIndex: 'totalCount',
      key: 'totalCount',
      width: 120,
      sorter: (a, b) => a.totalCount - b.totalCount,
    },
    {
      title: t('reports.approvalRate') || '通過率',
      dataIndex: 'approvalRate',
      key: 'approvalRate',
      width: 120,
      render: (rate) => `${rate.toFixed(1)}%`,
      sorter: (a, b) => a.approvalRate - b.approvalRate,
    },
    {
      title: t('reports.rejectionRate') || '拒絕率',
      dataIndex: 'rejectionRate',
      key: 'rejectionRate',
      width: 120,
      render: (rate) => `${rate.toFixed(1)}%`,
      sorter: (a, b) => a.rejectionRate - b.rejectionRate,
    },
    {
      title: t('reports.avgApprovalTime') || '平均審批時間',
      dataIndex: 'avgApprovalTime',
      key: 'avgApprovalTime',
      width: 150,
      render: (time) => time ? `${time.toFixed(1)} 小時` : '-',
      sorter: (a, b) => (a.avgApprovalTime || 0) - (b.avgApprovalTime || 0),
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

      const response = await fetch(`/api/reports/monthly/form-approval-analysis?year=${year}&month=${month}`, {
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
        totalForms: data.totalForms || 0,
        approvalRate: data.approvalRate || 0,
        rejectionRate: data.rejectionRate || 0,
        avgApprovalTime: data.avgApprovalTime || 0,
        previousMonthTotal: data.previousMonthTotal || 0,
        previousMonthApprovalRate: data.previousMonthApprovalRate || 0,
        trend: {
          totalForms: data.trend?.totalForms || 0,
          approvalRate: data.trend?.approvalRate || 0
        }
      });

      // 準備圖表數據
      prepareChartData(data);

      // 準備表格數據
      const tableData = (data.formTypePerformance || []).map((item, index) => ({
        key: item.formName || index,
        id: item.formName,
        formName: item.formName || '未命名表單',
        totalCount: item.totalCount || 0,
        approvedCount: item.approvedCount || 0,
        rejectedCount: item.rejectedCount || 0,
        approvalRate: item.totalCount > 0 ? (item.approvedCount / item.totalCount) * 100 : 0,
        rejectionRate: item.totalCount > 0 ? (item.rejectedCount / item.totalCount) * 100 : 0,
        avgApprovalTime: item.avgApprovalTime || null,
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
    // 表單類型使用情況
    const formTypeUsage = (data.formTypeUsage || []).slice(0, 20);
    setChartData(prev => ({
      ...prev,
      formTypeUsage: {
        names: formTypeUsage.map(f => f.formName || '未命名表單'),
        counts: formTypeUsage.map(f => f.count || 0)
      },
      approverWorkload: {
        names: (data.approverWorkload || []).slice(0, 20).map(a => a.approver || '未知'),
        approved: (data.approverWorkload || []).slice(0, 20).map(a => a.approvedCount || 0),
        rejected: (data.approverWorkload || []).slice(0, 20).map(a => a.rejectedCount || 0)
      },
      dailyTrend: {
        dates: (data.dailyTrend || []).map(d => d.date),
        approvals: (data.dailyTrend || []).map(d => d.approvalCount || 0),
        rejections: (data.dailyTrend || []).map(d => d.rejectionCount || 0)
      },
      weekdayVsWeekend: {
        weekday: data.weekdayVsWeekend?.weekday || 0,
        weekend: data.weekdayVsWeekend?.weekend || 0
      }
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
        `表單審批分析月報_${selectedMonth.format('YYYY-MM')}`,
        {
          sheetName: '表單審批分析月報',
          title: t('reports.monthly.formApproval') || '表單審批分析月報',
          statistics: {
            '表單總數': statistics.totalForms,
            '通過率': `${statistics.approvalRate.toFixed(1)}%`,
            '拒絕率': `${statistics.rejectionRate.toFixed(1)}%`,
            '平均審批時間': `${statistics.avgApprovalTime.toFixed(1)} 小時`
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
            {t('reports.monthly.formApproval') || '表單審批分析月報'}
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
                  title={t('reports.totalForms') || '表單總數'}
                  value={statistics.totalForms}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                  suffix={
                    statistics.trend.totalForms !== 0 && (
                      <Space size={4}>
                        {getTrendIcon(statistics.trend.totalForms)}
                        <span style={{ fontSize: '12px' }}>
                          {getTrendText(statistics.trend.totalForms)}
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
                  title={t('reports.approvalRate') || '通過率'}
                  value={statistics.approvalRate}
                  precision={1}
                  prefix={<CheckCircleOutlined />}
                  suffix={
                    <Space size={4}>
                      <span>%</span>
                      {statistics.trend.approvalRate !== 0 && (
                        <>
                          {getTrendIcon(statistics.trend.approvalRate)}
                          <span style={{ fontSize: '12px' }}>
                            {getTrendText(statistics.trend.approvalRate)}
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
                  title={t('reports.rejectionRate') || '拒絕率'}
                  value={statistics.rejectionRate}
                  precision={1}
                  suffix="%"
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.avgApprovalTime') || '平均審批時間'}
                  value={statistics.avgApprovalTime}
                  precision={1}
                  suffix={t('common.hours') || '小時'}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#7234CF' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 圖表分析區域 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* 表單類型使用情況 */}
            <Col xs={24} sm={12} lg={12}>
              <BarChart
                title={t('reports.formTypeUsage') || '表單類型使用情況 (Top 20)'}
                xAxisData={chartData.formTypeUsage.names}
                seriesData={[{
                  name: t('reports.formCount') || '表單數量',
                  data: chartData.formTypeUsage.counts
                }]}
                height={350}
                colors={['#7234CF']}
                horizontal={true}
              />
            </Col>
            {/* 審批人員工作量 */}
            <Col xs={24} sm={12} lg={12}>
              <StackedBarChart
                title={t('reports.approverWorkload') || '審批人員工作量 (Top 20)'}
                xAxisData={chartData.approverWorkload.names}
                seriesData={[
                  {
                    name: t('reports.approved') || '已通過',
                    data: chartData.approverWorkload.approved
                  },
                  {
                    name: t('reports.rejected') || '已拒絕',
                    data: chartData.approverWorkload.rejected
                  }
                ]}
                height={350}
                colors={['#52c41a', '#ff4d4f']}
              />
            </Col>
            {/* 工作日 vs 週末 */}
            <Col xs={24} sm={12} lg={6}>
              <PieChart
                title={t('reports.weekdayVsWeekend') || '工作日 vs 週末'}
                data={[
                  { name: t('reports.weekday') || '工作日', value: chartData.weekdayVsWeekend.weekday },
                  { name: t('reports.weekend') || '週末', value: chartData.weekdayVsWeekend.weekend }
                ]}
                height={300}
                colors={['#1890ff', '#faad14']}
              />
            </Col>
            {/* 30天審批趨勢 */}
            <Col xs={24} sm={12} lg={18}>
              <LineChart
                title={t('reports.approvalTrend') || '30天審批趨勢'}
                xAxisData={chartData.dailyTrend.dates}
                seriesData={[
                  {
                    name: t('reports.approved') || '已通過',
                    data: chartData.dailyTrend.approvals
                  },
                  {
                    name: t('reports.rejected') || '已拒絕',
                    data: chartData.dailyTrend.rejections
                  }
                ]}
                height={300}
                colors={['#52c41a', '#ff4d4f']}
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

export default FormApprovalAnalysisMonthly;
