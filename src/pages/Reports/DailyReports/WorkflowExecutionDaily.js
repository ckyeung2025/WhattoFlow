import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Collapse, Tabs, Badge, DatePicker } from 'antd';
import { 
  ProjectOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TableOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReportTable from '../components/ReportTable';
import { exportReport } from '../components/ReportExport';
import { useDynamicColumns } from '../components/DynamicFormColumns';
import { PieChart, BarChart, LineChart, GaugeChart, StackedBarChart } from '../components/ReportCharts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const WorkflowExecutionDaily = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    waiting: 0,
    successRate: 0,
    failureRate: 0,
    avgDuration: 0
  });
  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState({
    statusDistribution: [],
    workflowExecutionCount: { names: [], counts: [] },
    hourlyTrend: { dates: [], counts: [] },
    durationDistribution: []
  });
  const [dateRange, setDateRange] = useState(null);

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
  };

  const handleQuickSelect = (days) => {
    if (days === 1) {
      // 今天
      setDateRange([dayjs().startOf('day'), dayjs().endOf('day')]);
    } else if (days === 7) {
      // 最近7天
      setDateRange([dayjs().subtract(6, 'days').startOf('day'), dayjs().endOf('day')]);
    }
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
      title: t('reports.status') || '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          'Running': { color: '#1890ff', text: t('reports.running') || '運行中' },
          'Completed': { color: '#52c41a', text: t('reports.completed') || '已完成' },
          'Failed': { color: '#ff4d4f', text: t('reports.failed') || '失敗' },
          'Error': { color: '#ff4d4f', text: t('reports.error') || '錯誤' },
          'Waiting': { color: '#faad14', text: t('reports.waiting') || '等待中' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <span style={{ color: statusInfo.color }}>{statusInfo.text}</span>;
      }
    },
    {
      title: t('reports.startedAt') || '開始時間',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (date) => {
        if (!date) return '-';
        return TimezoneUtils.formatDateTime(date, 'YYYY-MM-DD HH:mm:ss');
      }
    },
    {
      title: t('reports.endedAt') || '結束時間',
      dataIndex: 'endedAt',
      key: 'endedAt',
      width: 180,
      render: (date) => {
        if (!date) return '-';
        return TimezoneUtils.formatDateTime(date, 'YYYY-MM-DD HH:mm:ss');
      }
    },
    {
      title: t('reports.duration') || '執行時長（分鐘）',
      dataIndex: 'duration',
      key: 'duration',
      width: 150,
      render: (duration) => {
        if (!duration) return '-';
        return `${duration} 分鐘`;
      },
      sorter: (a, b) => (a.duration || 0) - (b.duration || 0),
    },
    {
      title: t('reports.currentStep') || '當前步驟',
      dataIndex: 'currentStep',
      key: 'currentStep',
      width: 100,
      render: (step) => step || '-',
    },
    {
      title: t('reports.errorMessage') || '錯誤信息',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      width: 300,
      ellipsis: true,
      render: (msg) => {
        if (!msg) return '-';
        return <span style={{ color: '#ff4d4f' }}>{msg}</span>;
      }
    },
  ];

  // 載入報表數據
  const loadReportData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error(t('reports.loginRequired') || '請先登入');
        window.location.href = '/';
        return;
      }

      const params = new URLSearchParams();

      if (dateRange && dateRange.length === 2 && dateRange[0] && dateRange[1]) {
        params.append('dateFrom', dayjs(dateRange[0]).toISOString());
        params.append('dateTo', dayjs(dateRange[1]).toISOString());
      }

      const response = await fetch(`/api/reports/daily/workflow-execution?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Token 過期或無效
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        message.error(t('reports.loginExpired') || '登入已過期，請重新登入');
        window.location.href = '/';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // 更新統計數據
      setStatistics({
        total: data.statistics?.total || 0,
        running: data.statistics?.running || 0,
        completed: data.statistics?.completed || 0,
        failed: data.statistics?.failed || 0,
        waiting: data.statistics?.waiting || 0,
        successRate: data.statistics?.successRate || 0,
        failureRate: data.statistics?.failureRate || 0,
        avgDuration: data.statistics?.avgDuration || 0
      });

      // 格式化失敗執行數據，為動態列準備
      const formattedData = (data.failedExecutions || []).map((item, index) => {
        const relatedForm = item.relatedEformInstance;
        
        return {
          key: `execution_${item.id}_${index}`,
          id: item.id,
          workflowName: item.workflowName,
          workflowDefinitionId: item.workflowDefinitionId || item.workflowId,
          status: item.status,
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          duration: item.duration,
          currentStep: item.currentStep,
          errorMessage: item.errorMessage,
          // 為動態列準備
          fieldDisplaySettings: relatedForm?.fieldDisplaySettings || null,
          filledHtmlCode: relatedForm?.filledHtmlCode || null,
          htmlCode: relatedForm?.htmlCode || null,
          eFormDefinitionId: relatedForm?.eFormDefinitionId || relatedForm?.EFormDefinitionId,
          formName: relatedForm?.formName
        };
      });

      setDataSource(formattedData);

      // 準備圖表數據
      prepareChartData(formattedData, data);
    } catch (error) {
      console.error('載入報表數據失敗:', error);
      message.error(t('reports.loadDataFailed') || '載入報表數據失敗');
    } finally {
      setLoading(false);
    }
  };

  // 準備圖表數據
  const prepareChartData = (data, apiData) => {
    // 狀態分佈
    const statusCount = {
      'Running': statistics.running,
      'Completed': statistics.completed,
      'Failed': statistics.failed,
      'Waiting': statistics.waiting
    };

    // 按工作流分組統計執行數量
    const workflowCount = {};
    const hourlyCount = {};
    const durationRanges = {
      '0-5分鐘': 0,
      '5-15分鐘': 0,
      '15-30分鐘': 0,
      '30-60分鐘': 0,
      '60分鐘以上': 0
    };

    data.forEach(record => {
      // 工作流執行數量統計
      const workflowName = record.workflowName || '未知工作流';
      workflowCount[workflowName] = (workflowCount[workflowName] || 0) + 1;

      // 按小時統計 - 使用用戶時區
      if (record.startedAt) {
        const hour = TimezoneUtils.formatDateTime(record.startedAt, 'HH:00');
        hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
      }

      // 執行時長分佈
      if (record.duration) {
        if (record.duration <= 5) durationRanges['0-5分鐘']++;
        else if (record.duration <= 15) durationRanges['5-15分鐘']++;
        else if (record.duration <= 30) durationRanges['15-30分鐘']++;
        else if (record.duration <= 60) durationRanges['30-60分鐘']++;
        else durationRanges['60分鐘以上']++;
      }
    });

    // 轉換為圖表格式
    setChartData({
      statusDistribution: Object.entries(statusCount)
        .filter(([_, count]) => count > 0)
        .map(([name, value]) => ({
          name: name === 'Running' ? (t('reports.running') || '運行中') :
                name === 'Completed' ? (t('reports.completed') || '已完成') :
                name === 'Failed' ? (t('reports.failed') || '失敗') :
                name === 'Waiting' ? (t('reports.waiting') || '等待中') : name,
          value
        })),
      workflowExecutionCount: {
        names: Object.entries(workflowCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name]) => name.length > 15 ? name.substring(0, 15) + '...' : name),
        counts: Object.entries(workflowCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([_, count]) => count)
      },
      hourlyTrend: {
        dates: Object.keys(hourlyCount).sort(),
        counts: Object.keys(hourlyCount).sort().map(hour => hourlyCount[hour])
      },
      durationDistribution: Object.entries(durationRanges).map(([name, value]) => ({
        name,
        value
      }))
    });
  };

  // 初始化時設置今天的日期範圍
  useEffect(() => {
    if (!dateRange) {
      setDateRange([dayjs().startOf('day'), dayjs().endOf('day')]);
    }
  }, []);

  useEffect(() => {
    if (dateRange && dateRange.length === 2) {
      loadReportData();
    }
  }, [dateRange]);

  const handleRefresh = () => {
    loadReportData();
  };

  // 按流程定義分組數據（按工作流定義分組）
  const groupedByWorkflowDefinition = useMemo(() => {
    const groups = {};
    
    dataSource.forEach(record => {
      const workflowId = record.workflowDefinitionId || record.workflowId || 
                        record.workflowName || '未分類工作流';
      const workflowName = record.workflowName || '未命名工作流';
      
      if (!groups[workflowId]) {
        groups[workflowId] = {
          workflowId: workflowId,
          workflowName: workflowName,
          records: [],
          fieldDisplaySettings: null
        };
      }
      
      groups[workflowId].records.push(record);
      
      // 保存第一個記錄的 fieldDisplaySettings
      if (!groups[workflowId].fieldDisplaySettings && record.fieldDisplaySettings) {
        groups[workflowId].fieldDisplaySettings = record.fieldDisplaySettings;
      }
    });
    
    return Object.values(groups).sort((a, b) => a.workflowName.localeCompare(b.workflowName));
  }, [dataSource]);

  // 獲取完整的列定義（包含動態列）
  const columns = useDynamicColumns(dataSource, baseColumns);

  const handleExport = async (format = 'excel') => {
    try {
      await exportReport(
        format,
        dataSource,
        columns,
        `工作流執行日報_${dateRange[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : ''}_${dateRange[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : ''}`,
        {
          sheetName: '工作流執行日報',
          title: t('reports.daily.workflowExecution') || '工作流執行日報',
          statistics: {
            '執行總數': statistics.total,
            '成功率': `${statistics.successRate}%`,
            '失敗率': `${statistics.failureRate}%`,
            '平均執行時長': `${statistics.avgDuration} 分鐘`
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
            {t('reports.daily.workflowExecution') || '工作流執行日報'}
          </Title>
          <Space>
            <RangePicker
              placeholder={[t('common.startDate') || '開始日期', t('common.endDate') || '結束日期']}
              value={dateRange}
              onChange={handleDateRangeChange}
              style={{ width: 350 }}
            />
            <Button onClick={() => handleQuickSelect(1)}>
              {t('common.today') || '今天'}
            </Button>
            <Button onClick={() => handleQuickSelect(7)}>
              {t('common.last7Days') || '最近7天'}
            </Button>
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
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.totalExecutions') || '執行總數'}
                value={statistics.total}
                prefix={<ProjectOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.successRate') || '成功率'}
                value={statistics.successRate}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.failureRate') || '失敗率'}
                value={statistics.failureRate}
                suffix="%"
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.avgDuration') || '平均執行時長（分鐘）'}
                value={statistics.avgDuration}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 圖表分析區域 */}
        <Spin spinning={loading}>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* 狀態分佈餅圖 */}
            <Col xs={24} sm={12} lg={6}>
              <PieChart
                title={t('reports.statusDistribution') || '狀態分佈'}
                data={chartData.statusDistribution}
                height={300}
                colors={['#1890ff', '#52c41a', '#ff4d4f', '#faad14']}
              />
            </Col>
            {/* 成功率儀表盤 */}
            <Col xs={24} sm={12} lg={6}>
              <GaugeChart
                title={t('reports.successRate') || '成功率'}
                value={statistics.successRate}
                height={300}
                color="#52c41a"
              />
            </Col>
            {/* Top 10 工作流執行數量 */}
            <Col xs={24} sm={12} lg={6}>
              <BarChart
                title={t('reports.topWorkflows') || 'Top 10 工作流執行數量'}
                xAxisData={chartData.workflowExecutionCount.names}
                seriesData={[{
                  name: t('reports.executionCount') || '執行數量',
                  data: chartData.workflowExecutionCount.counts
                }]}
                height={300}
                colors={['#7234CF']}
              />
            </Col>
            {/* 24小時執行趨勢 */}
            <Col xs={24} sm={12} lg={6}>
              <LineChart
                title={t('reports.hourlyTrend') || '24小時執行趨勢'}
                xAxisData={chartData.hourlyTrend.dates}
                seriesData={[{
                  name: t('reports.executions') || '執行次數',
                  data: chartData.hourlyTrend.counts
                }]}
                height={300}
                colors={['#7234CF']}
              />
            </Col>
          </Row>

          {/* 執行時長分佈 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={24} lg={12}>
              <BarChart
                title={t('reports.durationDistribution') || '執行時長分佈'}
                xAxisData={chartData.durationDistribution.map(d => d.name)}
                seriesData={[{
                  name: t('reports.executionCount') || '執行數量',
                  data: chartData.durationDistribution.map(d => d.value)
                }]}
                height={300}
                colors={['#1890ff']}
              />
            </Col>
          </Row>

          {/* 表格明細（第二層）- 按工作流定義分組 */}
          <Collapse
            items={[{
              key: '1',
              label: (
                <Space>
                  <TableOutlined />
                  <span>{t('reports.detailTable') || '明細表格'}</span>
                  <span style={{ color: '#999', fontSize: '12px' }}>
                    ({dataSource.length} {t('reports.records') || '條記錄'}, {groupedByWorkflowDefinition.length} {t('reports.workflowTypes') || '種工作流類型'})
                  </span>
                </Space>
              ),
              children: (
                groupedByWorkflowDefinition.length > 0 ? (
                  <Tabs
                    type="card"
                    items={groupedByWorkflowDefinition.map((group, index) => ({
                      key: group.workflowId || `group-${index}`,
                      label: (
                        <Space>
                          <span>{group.workflowName}</span>
                          <Badge count={group.records.length} showZero style={{ backgroundColor: '#52c41a' }} />
                        </Space>
                      ),
                      children: (
                        <ReportTable
                          dataSource={group.records}
                          baseColumns={baseColumns}
                          pagination={{
                            pageSize: 20,
                            showSizeChanger: true,
                            showTotal: (total) => t('reports.totalRecords', { total }) || `共 ${total} 條記錄`,
                          }}
                        />
                      )
                    }))}
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

export default WorkflowExecutionDaily;
