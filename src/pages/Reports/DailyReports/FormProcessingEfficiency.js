import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Collapse, Tabs, Badge, DatePicker } from 'antd';
import { 
  FileTextOutlined, 
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
import { PieChart, BarChart, LineChart, FunnelChart, StackedBarChart } from '../components/ReportCharts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const FormProcessingEfficiency = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    total: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    aiFill: 0,
    dataFill: 0,
    manualFill: 0,
    avgProcessingTime: 0
  });
  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState({
    statusDistribution: [],
    fillTypeDistribution: [],
    processingFlow: [],
    fillTypeProcessingTime: { types: [], times: [] },
    hourlyTrend: { dates: [], counts: [] }
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
      title: t('common.formName') || '表單名稱',
      dataIndex: 'formName',
      key: 'formName',
      width: 200,
    },
    {
      title: t('common.instanceName') || '實例名稱',
      dataIndex: 'instanceName',
      key: 'instanceName',
      width: 200,
    },
    {
      title: t('common.status') || '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          'Submitted': { color: '#1890ff', text: t('common.submitted') || '已提交' },
          'Approved': { color: '#52c41a', text: t('common.approved') || '已審批' },
          'Rejected': { color: '#ff4d4f', text: t('common.rejected') || '已拒絕' },
          'Pending': { color: '#faad14', text: t('common.pending') || '待處理' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <span style={{ color: statusInfo.color }}>{statusInfo.text}</span>;
      }
    },
    {
      title: t('common.fillType') || '填寫類型',
      dataIndex: 'fillType',
      key: 'fillType',
      width: 120,
      render: (fillType) => {
        const typeMap = {
          'AI Fill': t('common.aiFill') || 'AI 填寫',
          'Data Fill': t('common.dataFill') || '數據填寫',
          'Manual Fill': t('common.manualFill') || '手動填寫',
        };
        return typeMap[fillType] || fillType;
      }
    },
    {
      title: t('common.createdAt') || '創建時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => {
        if (!date) return '-';
        return TimezoneUtils.formatDateTime(date, 'YYYY-MM-DD HH:mm:ss');
      }
    },
    {
      title: t('reports.approvedAt') || '審批時間',
      dataIndex: 'approvedAt',
      key: 'approvedAt',
      width: 180,
      render: (date) => {
        if (!date) return '-';
        return TimezoneUtils.formatDateTime(date, 'YYYY-MM-DD HH:mm:ss');
      }
    },
    {
      title: t('reports.approver') || '審批人',
      dataIndex: 'approver',
      key: 'approver',
      width: 120,
      render: (approver) => approver || '-',
    },
    {
      title: t('reports.processingTime') || '處理時長（小時）',
      dataIndex: 'processingTime',
      key: 'processingTime',
      width: 150,
      render: (time) => {
        if (!time) return '-';
        return `${time} 小時`;
      },
      sorter: (a, b) => (a.processingTime || 0) - (b.processingTime || 0),
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

      const response = await fetch(`/api/reports/daily/form-efficiency?${params}`, {
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
        total: data.statistics?.total || 0,
        submitted: data.statistics?.submitted || 0,
        approved: data.statistics?.approved || 0,
        rejected: data.statistics?.rejected || 0,
        pending: data.statistics?.pending || 0,
        aiFill: data.statistics?.aiFill || 0,
        dataFill: data.statistics?.dataFill || 0,
        manualFill: data.statistics?.manualFill || 0,
        avgProcessingTime: data.statistics?.avgProcessingTime || 0
      });

      // 格式化數據，為動態列準備
      const formattedData = (data.efficiencyRanking || []).map((item, index) => ({
        key: `form_${item.id}_${index}`,
        id: item.id,
        eFormDefinitionId: item.eFormDefinitionId || item.EFormDefinitionId,
        formName: item.formName,
        instanceName: item.instanceName,
        status: item.status,
        fillType: item.fillType,
        createdAt: item.createdAt,
        approvedAt: item.approvedAt,
        approver: item.approver,
        processingTime: item.processingTime,
        // 為動態列準備
        fieldDisplaySettings: item.fieldDisplaySettings,
        filledHtmlCode: item.filledHtmlCode,
        htmlCode: item.htmlCode
      }));

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
    const statusCount = {};
    const fillTypeCount = {};
    const fillTypeTimeSum = {};
    const fillTypeTimeCount = {};
    const hourlyCount = {};

    data.forEach(record => {
      // 狀態統計
      const status = record.status || 'Unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;

      // 填寫類型統計
      const fillType = record.fillType || 'Unknown';
      fillTypeCount[fillType] = (fillTypeCount[fillType] || 0) + 1;

      // 按填寫類型統計處理時間
      if (record.processingTime) {
        fillTypeTimeSum[fillType] = (fillTypeTimeSum[fillType] || 0) + record.processingTime;
        fillTypeTimeCount[fillType] = (fillTypeTimeCount[fillType] || 0) + 1;
      }

      // 按小時統計 - 使用用戶時區
      if (record.createdAt) {
        const hour = TimezoneUtils.formatDateTime(record.createdAt, 'HH:00');
        hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
      }
    });

    // 計算平均處理時間
    const fillTypeAvgTime = {};
    Object.keys(fillTypeTimeSum).forEach(type => {
      fillTypeAvgTime[type] = fillTypeTimeSum[type] / fillTypeTimeCount[type];
    });

    setChartData({
      statusDistribution: Object.entries(statusCount).map(([name, value]) => ({
        name: name === 'Submitted' ? (t('common.submitted') || '已提交') :
              name === 'Approved' ? (t('common.approved') || '已審批') :
              name === 'Rejected' ? (t('common.rejected') || '已拒絕') :
              name === 'Pending' ? (t('common.pending') || '待處理') : name,
        value
      })),
      fillTypeDistribution: Object.entries(fillTypeCount).map(([name, value]) => ({
        name: name === 'AI Fill' ? (t('common.aiFill') || 'AI 填寫') :
              name === 'Data Fill' ? (t('common.dataFill') || '數據填寫') :
              name === 'Manual Fill' ? (t('common.manualFill') || '手動填寫') : name,
        value
      })),
      processingFlow: [
        { name: t('common.submitted') || '已提交', value: statistics.submitted },
        { name: t('common.approved') || '已審批', value: statistics.approved },
        { name: t('common.rejected') || '已拒絕', value: statistics.rejected }
      ],
      fillTypeProcessingTime: {
        types: Object.keys(fillTypeAvgTime).map(type => 
          type === 'AI Fill' ? (t('common.aiFill') || 'AI 填寫') :
          type === 'Data Fill' ? (t('common.dataFill') || '數據填寫') :
          type === 'Manual Fill' ? (t('common.manualFill') || '手動填寫') : type
        ),
        times: Object.values(fillTypeAvgTime)
      },
      hourlyTrend: {
        dates: Object.keys(hourlyCount).sort(),
        counts: Object.keys(hourlyCount).sort().map(hour => hourlyCount[hour])
      }
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

  // 按流程定義分組數據
  const groupedByFormDefinition = useMemo(() => {
    const groups = {};
    
    dataSource.forEach(record => {
      const formId = record.eFormDefinitionId || record.EFormDefinitionId || 
                     record.formName || '未分類表單';
      const formName = record.formName || '未命名表單';
      
      if (!groups[formId]) {
        groups[formId] = {
          formId: formId,
          formName: formName,
          records: [],
          fieldDisplaySettings: null
        };
      }
      
      groups[formId].records.push(record);
      
      if (!groups[formId].fieldDisplaySettings && record.fieldDisplaySettings) {
        groups[formId].fieldDisplaySettings = record.fieldDisplaySettings;
      }
    });
    
    return Object.values(groups).sort((a, b) => a.formName.localeCompare(b.formName));
  }, [dataSource]);

  // 獲取完整的列定義（包含動態列）
  const columns = useDynamicColumns(dataSource, baseColumns);

  const handleExport = async (format = 'excel') => {
    try {
      await exportReport(
        format,
        dataSource,
        columns,
        `表單處理效率_${dateRange[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : ''}_${dateRange[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : ''}`,
        {
          sheetName: '表單處理效率',
          title: t('reports.daily.formEfficiency') || '表單處理效率',
          statistics: {
            '表單總數': statistics.total,
            '已審批': statistics.approved,
            '已拒絕': statistics.rejected,
            '平均處理時長': `${statistics.avgProcessingTime} 小時`
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
            {t('reports.daily.formEfficiency') || '表單處理效率'}
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
                title={t('reports.totalForms') || '表單總數'}
                value={statistics.total}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.approved') || '已審批'}
                value={statistics.approved}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.rejected') || '已拒絕'}
                value={statistics.rejected}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.avgProcessingTime') || '平均處理時長（小時）'}
                value={statistics.avgProcessingTime}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 圖表分析區域 */}
        <Spin spinning={loading}>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* 處理流程漏斗圖 */}
            <Col xs={24} sm={12} lg={8}>
              <FunnelChart
                title={t('reports.processingFlow') || '處理流程'}
                data={chartData.processingFlow}
                height={300}
                colors={['#1890ff', '#52c41a', '#ff4d4f']}
              />
            </Col>
            {/* 狀態分佈餅圖 */}
            <Col xs={24} sm={12} lg={8}>
              <PieChart
                title={t('reports.statusDistribution') || '狀態分佈'}
                data={chartData.statusDistribution}
                height={300}
                colors={['#1890ff', '#52c41a', '#ff4d4f', '#faad14']}
              />
            </Col>
            {/* 填寫類型分佈 */}
            <Col xs={24} sm={12} lg={8}>
              <PieChart
                title={t('reports.fillTypeDistribution') || '填寫類型分佈'}
                data={chartData.fillTypeDistribution}
                height={300}
                colors={['#7234CF', '#1890ff', '#52c41a']}
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* 按填寫類型的平均處理時間對比 */}
            <Col xs={24} sm={12} lg={12}>
              <BarChart
                title={t('reports.fillTypeProcessingTime') || '按填寫類型的平均處理時間'}
                xAxisData={chartData.fillTypeProcessingTime.types}
                seriesData={[{
                  name: t('reports.avgProcessingTime') || '平均處理時長（小時）',
                  data: chartData.fillTypeProcessingTime.times
                }]}
                height={300}
                colors={['#722ed1']}
              />
            </Col>
            {/* 24小時提交趨勢 */}
            <Col xs={24} sm={12} lg={12}>
              <LineChart
                title={t('reports.hourlySubmissionTrend') || '24小時提交趨勢'}
                xAxisData={chartData.hourlyTrend.dates}
                seriesData={[{
                  name: t('reports.submissions') || '提交數量',
                  data: chartData.hourlyTrend.counts
                }]}
                height={300}
                colors={['#7234CF']}
              />
            </Col>
          </Row>

          {/* 表格明細（第二層）- 按流程定義分組 */}
          <Collapse
            items={[{
              key: '1',
              label: (
                <Space>
                  <TableOutlined />
                  <span>{t('reports.detailTable') || '明細表格'}</span>
                  <span style={{ color: '#999', fontSize: '12px' }}>
                    ({dataSource.length} {t('reports.records') || '條記錄'}, {groupedByFormDefinition.length} {t('reports.formTypes') || '種表單類型'})
                  </span>
                </Space>
              ),
              children: (
                groupedByFormDefinition.length > 0 ? (
                  <Tabs
                    type="card"
                    items={groupedByFormDefinition.map((group, index) => ({
                      key: group.formId || `group-${index}`,
                      label: (
                        <Space>
                          <span>{group.formName}</span>
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

export default FormProcessingEfficiency;
