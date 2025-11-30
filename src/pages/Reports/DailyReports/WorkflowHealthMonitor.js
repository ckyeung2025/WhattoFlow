import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Collapse, Tabs, Badge, Progress, DatePicker } from 'antd';
import { 
  ProjectOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TableOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReportTable from '../components/ReportTable';
import { exportReport } from '../components/ReportExport';
import { useDynamicColumns } from '../components/DynamicFormColumns';
import { BarChart, LineChart, GaugeChart, ScatterChart } from '../components/ReportCharts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const WorkflowHealthMonitor = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    activeWorkflows: 0,
    inactiveWorkflows: 0,
    overallHealthScore: 0
  });
  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState({
    problemWorkflows: { names: [], scores: [] },
    successRateVsDuration: [],
    healthScoreTrend: { dates: [], scores: [] }
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
          'Active': { color: '#52c41a', text: t('reports.active') || '活躍' },
          'Inactive': { color: '#d9d9d9', text: t('reports.inactive') || '未啟用' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <span style={{ color: statusInfo.color }}>{statusInfo.text}</span>;
      }
    },
    {
      title: t('reports.totalExecutions') || '執行總數',
      dataIndex: 'totalExecutions',
      key: 'totalExecutions',
      width: 120,
      sorter: (a, b) => a.totalExecutions - b.totalExecutions,
    },
    {
      title: t('reports.successCount') || '成功數',
      dataIndex: 'successCount',
      key: 'successCount',
      width: 100,
      sorter: (a, b) => a.successCount - b.successCount,
    },
    {
      title: t('reports.failedCount') || '失敗數',
      dataIndex: 'failedCount',
      key: 'failedCount',
      width: 100,
      sorter: (a, b) => a.failedCount - b.failedCount,
    },
    {
      title: t('reports.successRate') || '成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      width: 120,
      render: (rate) => `${rate}%`,
      sorter: (a, b) => a.successRate - b.successRate,
    },
    {
      title: t('reports.avgDuration') || '平均執行時長（分鐘）',
      dataIndex: 'avgDuration',
      key: 'avgDuration',
      width: 180,
      render: (duration) => `${duration} 分鐘`,
      sorter: (a, b) => a.avgDuration - b.avgDuration,
    },
    {
      title: t('reports.healthScore') || '健康度評分',
      dataIndex: 'healthScore',
      key: 'healthScore',
      width: 150,
      render: (score) => {
        let color = '#52c41a';
        if (score < 50) color = '#ff4d4f';
        else if (score < 70) color = '#faad14';
        return (
          <Progress
            percent={score}
            size="small"
            strokeColor={color}
            format={(percent) => `${percent}分`}
          />
        );
      },
      sorter: (a, b) => a.healthScore - b.healthScore,
    },
    {
      title: t('reports.lastExecutionTime') || '最後執行時間',
      dataIndex: 'lastExecutionTime',
      key: 'lastExecutionTime',
      width: 180,
      render: (date) => {
        if (!date) return '-';
        return TimezoneUtils.formatDateTime(date, 'YYYY-MM-DD HH:mm:ss');
      }
    },
  ];

  // 載入報表數據
  const loadReportData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();

      if (dateRange && dateRange.length === 2 && dateRange[0] && dateRange[1]) {
        params.append('dateFrom', dayjs(dateRange[0]).toISOString());
        params.append('dateTo', dayjs(dateRange[1]).toISOString());
      }

      const response = await fetch(`/api/reports/daily/workflow-health?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // 更新統計數據
      setStatistics({
        activeWorkflows: data.statistics?.activeWorkflows || 0,
        inactiveWorkflows: data.statistics?.inactiveWorkflows || 0,
        overallHealthScore: data.statistics?.overallHealthScore || 0
      });

      // 格式化問題工作流數據，為動態列準備
      const formattedData = (data.problemWorkflows || []).map((item, index) => {
        const relatedForm = item.relatedEformInstance;
        
        return {
          key: `workflow_${item.workflowId}_${index}`,
          id: item.workflowId,
          workflowDefinitionId: item.workflowDefinitionId || item.workflowId,
          workflowName: item.workflowName,
          status: item.status,
          totalExecutions: item.totalExecutions,
          successCount: item.successCount,
          failedCount: item.failedCount,
          successRate: item.successRate,
          avgDuration: item.avgDuration,
          healthScore: item.healthScore,
          lastExecutionTime: item.lastExecutionTime,
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
      prepareChartData(formattedData);
    } catch (error) {
      console.error('載入報表數據失敗:', error);
      message.error(t('reports.loadDataFailed') || '載入報表數據失敗');
    } finally {
      setLoading(false);
    }
  };

  // 準備圖表數據
  const prepareChartData = (data) => {
    // 問題工作流排名（健康度最低的 Top 10）
    const problemWorkflows = data
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, 10);

    // 成功率 vs 執行時長散點圖
    const scatterData = data.map(item => [
      item.avgDuration || 0,
      item.successRate || 0,
      item.totalExecutions || 0
    ]);

    setChartData({
      problemWorkflows: {
        names: problemWorkflows.map(w => w.workflowName.length > 15 ? w.workflowName.substring(0, 15) + '...' : w.workflowName),
        scores: problemWorkflows.map(w => w.healthScore)
      },
      successRateVsDuration: scatterData
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

  // 按流程定義分組數據（按工作流定義分組，如果有關聯表單則按表單定義分組）
  const groupedByDefinition = useMemo(() => {
    const groups = {};
    
    dataSource.forEach(record => {
      // 優先按表單定義分組，如果沒有表單則按工作流定義分組
      const groupKey = record.eFormDefinitionId || record.EFormDefinitionId || 
                      record.workflowDefinitionId || record.workflowId || 
                      record.workflowName || '未分類';
      const groupName = record.formName || record.workflowName || '未命名';
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          name: groupName,
          records: [],
          fieldDisplaySettings: null
        };
      }
      
      groups[groupKey].records.push(record);
      
      if (!groups[groupKey].fieldDisplaySettings && record.fieldDisplaySettings) {
        groups[groupKey].fieldDisplaySettings = record.fieldDisplaySettings;
      }
    });
    
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [dataSource]);

  // 獲取完整的列定義（包含動態列）
  const columns = useDynamicColumns(dataSource, baseColumns);

  const handleExport = async (format = 'excel') => {
    try {
      await exportReport(
        format,
        dataSource,
        columns,
        `工作流健康度監控_${dateRange[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : ''}_${dateRange[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : ''}`,
        {
          sheetName: '工作流健康度監控',
          title: t('reports.daily.workflowHealth') || '工作流健康度監控',
          statistics: {
            '活躍工作流': statistics.activeWorkflows,
            '未啟用工作流': statistics.inactiveWorkflows,
            '總體健康度評分': `${statistics.overallHealthScore} 分`
          }
        }
      );
      message.success(t('reports.exportSuccess') || '匯出成功');
    } catch (error) {
      console.error('匯出失敗:', error);
      message.error(t('reports.exportFailed') || `匯出失敗: ${error.message}`);
    }
  };

  const getHealthScoreColor = (score) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: 0 }}>
            {t('reports.daily.workflowHealth') || '工作流健康度監控'}
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
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title={t('reports.activeWorkflows') || '活躍工作流'}
                value={statistics.activeWorkflows}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title={t('reports.inactiveWorkflows') || '未啟用工作流'}
                value={statistics.inactiveWorkflows}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#d9d9d9' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title={t('reports.overallHealthScore') || '總體健康度評分'}
                value={statistics.overallHealthScore}
                suffix="分"
                prefix={<ProjectOutlined />}
                valueStyle={{ color: getHealthScoreColor(statistics.overallHealthScore) }}
              />
            </Card>
          </Col>
        </Row>

        {/* 圖表分析區域 */}
        <Spin spinning={loading}>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* 總體健康度評分儀表盤 */}
            <Col xs={24} sm={12} lg={6}>
              <GaugeChart
                title={t('reports.overallHealthScore') || '總體健康度評分'}
                value={statistics.overallHealthScore}
                height={300}
                color={getHealthScoreColor(statistics.overallHealthScore)}
              />
            </Col>
            {/* 問題工作流排名（健康度最低的 Top 10） */}
            <Col xs={24} sm={12} lg={9}>
              <BarChart
                title={t('reports.problemWorkflows') || '問題工作流排名（健康度最低 Top 10）'}
                xAxisData={chartData.problemWorkflows.names}
                seriesData={[{
                  name: t('reports.healthScore') || '健康度評分',
                  data: chartData.problemWorkflows.scores
                }]}
                height={300}
                colors={['#ff4d4f']}
              />
            </Col>
            {/* 成功率 vs 執行時長散點圖 */}
            <Col xs={24} sm={12} lg={9}>
              <ScatterChart
                title={t('reports.successRateVsDuration') || '成功率 vs 執行時長'}
                data={chartData.successRateVsDuration}
                height={300}
                xAxisName={t('reports.avgDuration') || '平均執行時長（分鐘）'}
                yAxisName={t('reports.successRate') || '成功率（%）'}
                colors={['#7234CF']}
              />
            </Col>
          </Row>

          {/* 表格明細（第二層）- 按定義分組 */}
          <Collapse
            items={[{
              key: '1',
              label: (
                <Space>
                  <TableOutlined />
                  <span>{t('reports.detailTable') || '明細表格'}</span>
                  <span style={{ color: '#999', fontSize: '12px' }}>
                    ({dataSource.length} {t('reports.records') || '條記錄'}, {groupedByDefinition.length} {t('reports.definitionTypes') || '種定義類型'})
                  </span>
                </Space>
              ),
              children: (
                groupedByDefinition.length > 0 ? (
                  <Tabs
                    type="card"
                    items={groupedByDefinition.map((group, index) => ({
                      key: group.id || `group-${index}`,
                      label: (
                        <Space>
                          <span>{group.name}</span>
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

export default WorkflowHealthMonitor;
