import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Collapse, DatePicker } from 'antd';
import { 
  UserOutlined, 
  ProjectOutlined, 
  FileTextOutlined,
  DatabaseOutlined,
  MessageOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TableOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReportTable from '../components/ReportTable';
import { exportReport } from '../components/ReportExport';
import { PieChart, BarChart, LineChart, StackedBarChart } from '../components/ReportCharts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { MonthPicker } = DatePicker;

const SystemUsageStatistics = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [statistics, setStatistics] = useState({
    activeUsers: 0,
    totalOperations: 0,
    workflowUsage: 0,
    formUsage: 0,
    datasetUsage: 0,
    whatsappUsage: 0
  });
  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState({
    functionUsageDistribution: [],
    functionUsageTrend: { dates: [], workflows: [], forms: [], datasets: [], whatsapp: [] },
    datasetUsageRanking: { names: [], queryCounts: [], updateCounts: [] },
    userActivity: { names: [], operationCounts: [] }
  });

  const handleMonthChange = (date) => {
    setSelectedMonth(date);
  };

  // 基礎列定義
  const baseColumns = [
    {
      title: t('reports.functionName') || '功能名稱',
      dataIndex: 'functionName',
      key: 'functionName',
      width: 200,
    },
    {
      title: t('reports.usageCount') || '使用次數',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 120,
      sorter: (a, b) => a.usageCount - b.usageCount,
    },
    {
      title: t('reports.activeUsers') || '活躍用戶',
      dataIndex: 'activeUsers',
      key: 'activeUsers',
      width: 120,
      sorter: (a, b) => a.activeUsers - b.activeUsers,
    },
    {
      title: t('reports.growthRate') || '增長率',
      dataIndex: 'growthRate',
      key: 'growthRate',
      width: 120,
      render: (rate) => rate ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}%` : '-',
      sorter: (a, b) => (a.growthRate || 0) - (b.growthRate || 0),
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

      const response = await fetch(`/api/reports/monthly/system-usage-statistics?year=${year}&month=${month}`, {
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
        activeUsers: data.activeUsers || 0,
        totalOperations: data.totalOperations || 0,
        workflowUsage: data.workflowUsage || 0,
        formUsage: data.formUsage || 0,
        datasetUsage: data.datasetUsage || 0,
        whatsappUsage: data.whatsappUsage || 0
      });

      // 準備圖表數據
      prepareChartData(data);

      // 準備表格數據
      const tableData = (data.functionUsage || []).map((item, index) => ({
        key: item.functionName || index,
        id: item.functionName,
        functionName: item.functionName || '未知功能',
        usageCount: item.usageCount || 0,
        activeUsers: item.activeUsers || 0,
        growthRate: item.growthRate || null,
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
    // 功能使用分佈
    const functionUsageDistribution = (data.functionUsageDistribution || []).map(f => ({
      name: f.functionName || '未知功能',
      value: f.usageCount || 0
    }));

    // 功能使用趨勢
    const functionUsageTrend = data.functionUsageTrend || [];
    setChartData(prev => ({
      ...prev,
      functionUsageDistribution,
      functionUsageTrend: {
        dates: functionUsageTrend.map(t => t.date),
        workflows: functionUsageTrend.map(t => t.workflowCount || 0),
        forms: functionUsageTrend.map(t => t.formCount || 0),
        datasets: functionUsageTrend.map(t => t.datasetCount || 0),
        whatsapp: functionUsageTrend.map(t => t.whatsappCount || 0)
      },
      datasetUsageRanking: {
        names: (data.datasetUsageRanking || []).slice(0, 20).map(d => d.datasetName || '未知數據集'),
        queryCounts: (data.datasetUsageRanking || []).slice(0, 20).map(d => d.queryCount || 0),
        updateCounts: (data.datasetUsageRanking || []).slice(0, 20).map(d => d.updateCount || 0)
      },
      userActivity: {
        names: (data.userActivity || []).slice(0, 20).map(u => u.userName || '未知用戶'),
        operationCounts: (data.userActivity || []).slice(0, 20).map(u => u.operationCount || 0)
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
        `系統使用統計月報_${selectedMonth.format('YYYY-MM')}`,
        {
          sheetName: '系統使用統計月報',
          title: t('reports.monthly.systemUsage') || '系統使用統計月報',
          statistics: {
            '活躍用戶': statistics.activeUsers,
            '總操作次數': statistics.totalOperations,
            '工作流使用': statistics.workflowUsage,
            '表單使用': statistics.formUsage,
            '數據集使用': statistics.datasetUsage,
            'WhatsApp 使用': statistics.whatsappUsage
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
            {t('reports.monthly.systemUsage') || '系統使用統計月報'}
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
                  title={t('reports.activeUsers') || '活躍用戶'}
                  value={statistics.activeUsers}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.totalOperations') || '總操作次數'}
                  value={statistics.totalOperations}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#7234CF' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.workflowUsage') || '工作流使用'}
                  value={statistics.workflowUsage}
                  prefix={<ProjectOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.formUsage') || '表單使用'}
                  value={statistics.formUsage}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.datasetUsage') || '數據集使用'}
                  value={statistics.datasetUsage}
                  prefix={<DatabaseOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.whatsappUsage') || 'WhatsApp 使用'}
                  value={statistics.whatsappUsage}
                  prefix={<MessageOutlined />}
                  valueStyle={{ color: '#13c2c2' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 圖表分析區域 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* 功能使用分佈 */}
            <Col xs={24} sm={12} lg={8}>
              <PieChart
                title={t('reports.functionUsageDistribution') || '功能使用分佈'}
                data={chartData.functionUsageDistribution}
                height={350}
                colors={['#7234CF', '#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#13c2c2']}
              />
            </Col>
            {/* 功能使用趨勢 */}
            <Col xs={24} sm={12} lg={16}>
              <StackedBarChart
                title={t('reports.functionUsageTrend') || '功能使用趨勢（30天）'}
                xAxisData={chartData.functionUsageTrend.dates}
                seriesData={[
                  {
                    name: t('reports.workflows') || '工作流',
                    data: chartData.functionUsageTrend.workflows
                  },
                  {
                    name: t('reports.forms') || '表單',
                    data: chartData.functionUsageTrend.forms
                  },
                  {
                    name: t('reports.datasets') || '數據集',
                    data: chartData.functionUsageTrend.datasets
                  },
                  {
                    name: t('reports.whatsapp') || 'WhatsApp',
                    data: chartData.functionUsageTrend.whatsapp
                  }
                ]}
                height={350}
                colors={['#7234CF', '#faad14', '#ff4d4f', '#13c2c2']}
              />
            </Col>
            {/* 數據集使用排名 */}
            <Col xs={24} sm={12} lg={12}>
              <BarChart
                title={t('reports.datasetUsageRanking') || '數據集使用排名 (Top 20)'}
                xAxisData={chartData.datasetUsageRanking.names}
                seriesData={[
                  {
                    name: t('reports.queryCount') || '查詢次數',
                    data: chartData.datasetUsageRanking.queryCounts
                  },
                  {
                    name: t('reports.updateCount') || '更新次數',
                    data: chartData.datasetUsageRanking.updateCounts
                  }
                ]}
                height={350}
                colors={['#1890ff', '#52c41a']}
                horizontal={true}
              />
            </Col>
            {/* 用戶活躍度排名 */}
            <Col xs={24} sm={12} lg={12}>
              <BarChart
                title={t('reports.userActivityRanking') || '用戶活躍度排名 (Top 20)'}
                xAxisData={chartData.userActivity.names}
                seriesData={[{
                  name: t('reports.operationCount') || '操作次數',
                  data: chartData.userActivity.operationCounts
                }]}
                height={350}
                colors={['#7234CF']}
                horizontal={true}
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

export default SystemUsageStatistics;
