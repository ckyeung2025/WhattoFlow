import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Collapse, DatePicker, Select, Tabs, Empty } from 'antd';
import { 
  ProjectOutlined, 
  ClockCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TableOutlined,
  BarChartOutlined,
  HeatMapOutlined,
  EyeOutlined,
  // 節點類型圖標（用於顯示節點圖標，與 WorkflowDesigner 一致）
  PlayCircleOutlined, 
  SendOutlined, 
  CheckCircleOutlined, 
  DatabaseOutlined, 
  ApiOutlined, 
  FormOutlined, 
  StopOutlined 
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReportTable from '../components/ReportTable';
import { exportReport } from '../components/ReportExport';
import { BarChart, HeatmapChart } from '../components/ReportCharts';
import ReadOnlyWorkflowView from '../components/ReadOnlyWorkflowView';
import dayjs from 'dayjs';

const { Title } = Typography;
const { MonthPicker } = DatePicker;
const { Option } = Select;

const ProcessStepExecutionAnalysis = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [selectedWorkflow, setSelectedWorkflow] = useState('all');
  const [statistics, setStatistics] = useState({
    totalSteps: 0,
    avgStepDuration: 0,
    totalWorkflows: 0,
    totalExecutions: 0
  });
  const [dataSource, setDataSource] = useState([]);
  const [workflowDefinitions, setWorkflowDefinitions] = useState([]); // 工作流定義列表（包含 JSON）
  const [chartData, setChartData] = useState({
    stepDurationComparison: { workflows: [], steps: [], seriesData: [] },
    stepExecutionHeatmap: { times: [], workflows: [], values: [] }
  });
  const [workflowList, setWorkflowList] = useState([]);

  // 節點類型定義（用於顯示節點圖標，與 WorkflowDesigner 一致）
  // 來源：src/components/WorkflowDesigner/hooks/useWorkflowState.js (第 44-70 行)
  const nodeTypes = useMemo(() => [
    { type: 'start', label: 'Start', icon: PlayCircleOutlined },
    { type: 'sendWhatsApp', label: 'Send WhatsApp', icon: SendOutlined },
    { type: 'waitReply', label: 'Wait for User Reply', icon: ClockCircleOutlined },
    { type: 'waitForQRCode', label: 'Wait for QR Code', icon: ClockCircleOutlined },
    { type: 'switch', label: 'Switch', icon: CheckCircleOutlined },
    { type: 'dataSetQuery', label: 'DataSet Query/Update', icon: DatabaseOutlined },
    { type: 'callApi', label: 'Trigger External API', icon: ApiOutlined },
    { type: 'sendEForm', label: 'Send eForm', icon: FormOutlined },
    { type: 'end', label: 'End', icon: StopOutlined },
  ], []);

  const handleMonthChange = (date) => {
    setSelectedMonth(date);
  };

  const handleWorkflowChange = (workflowId) => {
    setSelectedWorkflow(workflowId);
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
      title: t('reports.stepName') || '步驟名稱',
      dataIndex: 'stepName',
      key: 'stepName',
      width: 200,
    },
    {
      title: t('reports.stepType') || '步驟類型',
      dataIndex: 'stepType',
      key: 'stepType',
      width: 150,
    },
    {
      title: t('reports.executionCount') || '執行次數',
      dataIndex: 'executionCount',
      key: 'executionCount',
      width: 120,
      sorter: (a, b) => a.executionCount - b.executionCount,
    },
    {
      title: t('reports.avgDuration') || '平均執行時長',
      dataIndex: 'avgDuration',
      key: 'avgDuration',
      width: 150,
      render: (duration) => `${duration.toFixed(2)} 分鐘`,
      sorter: (a, b) => a.avgDuration - b.avgDuration,
    },
    {
      title: t('reports.totalDuration') || '總執行時長',
      dataIndex: 'totalDuration',
      key: 'totalDuration',
      width: 150,
      render: (duration) => `${duration.toFixed(2)} 分鐘`,
      sorter: (a, b) => a.totalDuration - b.totalDuration,
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

      const response = await fetch(`/api/reports/monthly/process-step-execution-analysis?year=${year}&month=${month}${selectedWorkflow !== 'all' ? `&workflowId=${selectedWorkflow}` : ''}`, {
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
        totalSteps: data.totalSteps || 0,
        avgStepDuration: data.avgStepDuration || 0,
        totalWorkflows: data.totalWorkflows || 0,
        totalExecutions: data.totalExecutions || 0
      });

      // 設置工作流列表
      setWorkflowList(data.workflowList || []);

      // 設置工作流定義（包含 JSON）
      setWorkflowDefinitions(data.workflowDefinitions || []);

      // 準備圖表數據
      prepareChartData(data);

      // 準備表格數據
      const tableData = (data.stepExecutionDetails || []).map((item, index) => ({
        key: `${item.workflowId}_${item.stepName}_${index}`,
        id: `${item.workflowId}_${item.stepName}`,
        workflowName: item.workflowName || '未命名工作流',
        stepName: item.stepName || '未知步驟',
        stepType: item.stepType || '-',
        executionCount: item.executionCount || 0,
        avgDuration: item.avgDuration || 0,
        totalDuration: item.totalDuration || 0,
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
    // 步驟完成時間對比
    const stepDurationComparison = data.stepDurationComparison || [];
    const workflows = [...new Set(stepDurationComparison.map(s => s.workflowName))];
    const steps = [...new Set(stepDurationComparison.map(s => s.stepName))];
    
    // 構建分組柱狀圖數據
    const seriesData = workflows.map(workflow => ({
      name: workflow,
      data: steps.map(step => {
        const item = stepDurationComparison.find(s => s.workflowName === workflow && s.stepName === step);
        return item ? item.avgDuration : 0;
      })
    }));

    // 熱力圖數據
    const stepExecutionHeatmap = data.stepExecutionHeatmap || [];
    const heatmapTimes = [...new Set(stepExecutionHeatmap.map(h => h.time))].sort();
    const heatmapWorkflowSteps = [...new Set(stepExecutionHeatmap.map(h => `${h.workflowName}-${h.stepName}`))];
    const heatmapValues = heatmapTimes.map(time => 
      heatmapWorkflowSteps.map(ws => {
        const item = stepExecutionHeatmap.find(h => h.time === time && `${h.workflowName}-${h.stepName}` === ws);
        return item ? item.count : 0;
      })
    );

    setChartData(prev => ({
      ...prev,
      stepDurationComparison: {
        workflows,
        steps,
        seriesData
      },
      stepExecutionHeatmap: {
        times: heatmapTimes,
        workflows: heatmapWorkflowSteps,
        values: heatmapValues
      }
    }));
  };

  useEffect(() => {
    if (selectedMonth) {
      loadReportData();
    }
  }, [selectedMonth, selectedWorkflow]);

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
        `流程步驟執行分析月報_${selectedMonth.format('YYYY-MM')}`,
        {
          sheetName: '流程步驟執行分析月報',
          title: t('reports.monthly.processStepExecution') || '流程步驟執行分析月報',
          statistics: {
            '總步驟數': statistics.totalSteps,
            '平均步驟執行時長': `${statistics.avgStepDuration.toFixed(2)} 分鐘`,
            '工作流總數': statistics.totalWorkflows,
            '執行總數': statistics.totalExecutions
          }
        }
      );
      message.success(t('reports.exportSuccess') || '匯出成功');
    } catch (error) {
      console.error('匯出失敗:', error);
      message.error(t('reports.exportFailed') || `匯出失敗: ${error.message}`);
    }
  };

  // 過濾要顯示的工作流
  const displayedWorkflows = useMemo(() => {
    if (selectedWorkflow === 'all') {
      return workflowDefinitions;
    }
    return workflowDefinitions.filter(wf => wf.workflowId === parseInt(selectedWorkflow));
  }, [workflowDefinitions, selectedWorkflow]);

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: 0 }}>
            {t('reports.monthly.processStepExecution') || '流程步驟執行分析月報'}
          </Title>
          <Space>
            <MonthPicker
              placeholder={t('common.selectMonth') || '選擇月份'}
              value={selectedMonth}
              onChange={handleMonthChange}
              format="YYYY-MM"
              style={{ width: 200 }}
            />
            <Select
              placeholder={t('reports.selectWorkflow') || '選擇工作流'}
              value={selectedWorkflow}
              onChange={handleWorkflowChange}
              style={{ width: 200 }}
              allowClear
            >
              <Option value="all">{t('reports.allWorkflows') || '所有工作流'}</Option>
              {workflowList.map(wf => (
                <Option key={wf.id} value={wf.id}>{wf.name}</Option>
              ))}
            </Select>
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
                  title={t('reports.totalSteps') || '總步驟數'}
                  value={statistics.totalSteps}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.avgStepDuration') || '平均步驟執行時長'}
                  value={statistics.avgStepDuration}
                  precision={2}
                  suffix={t('reports.minutes') || '分鐘'}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#7234CF' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.totalWorkflows') || '工作流總數'}
                  value={statistics.totalWorkflows}
                  prefix={<ProjectOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('reports.totalExecutions') || '執行總數'}
                  value={statistics.totalExecutions}
                  prefix={<ProjectOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 工作流圖形化視圖（第一層） */}
          {displayedWorkflows.length > 0 ? (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {displayedWorkflows.map((wf, index) => (
                <Col 
                  xs={24} 
                  sm={24} 
                  lg={selectedWorkflow === 'all' ? 12 : 24} 
                  key={wf.workflowId || index}
                >
                  <ReadOnlyWorkflowView
                    workflowJson={wf.workflowJson}
                    stepStats={wf.stepStats || {}}
                    height={selectedWorkflow === 'all' ? 500 : 600}
                    workflowName={wf.workflowName || '未命名工作流'}
                    nodeTypes={nodeTypes}
                  />
                </Col>
              ))}
            </Row>
          ) : (
            <Card style={{ marginBottom: 24 }}>
              <Empty 
                description={t('reports.noWorkflowData') || '暫無工作流數據'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          )}

          {/* 圖表分析區域 - 使用 Tabs 切換不同視角 */}
          <Tabs
            defaultActiveKey="stepDuration"
            items={[
              {
                key: 'stepDuration',
                label: (
                  <Space>
                    <BarChartOutlined />
                    <span>{t('reports.stepDurationComparison') || '步驟完成時間對比'}</span>
                  </Space>
                ),
                children: (
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} sm={24} lg={24}>
                      <BarChart
                        title={t('reports.stepDurationComparison') || '每個流程中不同步驟的完成時間對比'}
                        xAxisData={chartData.stepDurationComparison.steps}
                        seriesData={chartData.stepDurationComparison.seriesData || []}
                        height={400}
                        colors={['#7234CF', '#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#13c2c2']}
                      />
                    </Col>
                  </Row>
                )
              },
              {
                key: 'hourlyDistribution',
                label: (
                  <Space>
                    <ClockCircleOutlined />
                    <span>{t('reports.hourlyWorkDistribution') || '時間段工作分佈'}</span>
                  </Space>
                ),
                children: (
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} sm={24} lg={24}>
                      <HeatmapChart
                        title={t('reports.hourlyWorkDistribution') || '時間段工作分佈熱力圖'}
                        xAxisData={chartData.stepExecutionHeatmap.times}
                        yAxisData={chartData.stepExecutionHeatmap.workflows}
                        data={chartData.stepExecutionHeatmap.values}
                        height={500}
                      />
                    </Col>
                  </Row>
                )
              }
            ]}
            style={{ marginBottom: 24 }}
          />

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

export default ProcessStepExecutionAnalysis;
