import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Tabs, Collapse, Badge, DatePicker } from 'antd';
import { 
  FileTextOutlined, 
  ClockCircleOutlined, 
  ExclamationCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TableOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReportTable from '../components/ReportTable';
import { exportReport } from '../components/ReportExport';
import { useDynamicColumns } from '../components/DynamicFormColumns';
import { PieChart, BarChart, LineChart } from '../components/ReportCharts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const PendingTasksOverview = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    total: 0,
    pending: 0,
    overdue: 0,
    urgent: 0,
    todayNew: 0,
    todayCompleted: 0,
    todayRejected: 0
  });
  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState({
    statusDistribution: [],
    fillTypeDistribution: [],
    priorityDistribution: [],
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
          'Pending': { color: 'orange', text: t('common.pending') || '待處理' },
          'Submitted': { color: 'blue', text: t('common.submitted') || '已提交' },
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
      title: t('common.dueDate') || '到期日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 180,
      render: (date) => {
        if (!date) return '-';
        // 使用時間戳比較，避免時區問題
        let dueDate;
        if (typeof date === 'string') {
          // 如果字符串沒有時區信息，假設它是 UTC 時間
          if (date.includes('T') && !date.includes('Z') && !date.match(/[+-]\d{2}:\d{2}$/)) {
            dueDate = new Date(date + 'Z');
          } else {
            dueDate = new Date(date);
          }
        } else {
          dueDate = new Date(date);
        }
        const now = new Date();
        // 使用時間戳比較，避免時區轉換問題
        const isOverdue = dueDate.getTime() < now.getTime();
        return (
          <span style={{ color: isOverdue ? 'red' : 'inherit' }}>
            {TimezoneUtils.formatDateTime(date, 'YYYY-MM-DD HH:mm:ss')}
            {isOverdue && <ExclamationCircleOutlined style={{ marginLeft: 4, color: 'red' }} />}
          </span>
        );
      }
    },
  ];

  // 載入統計數據
  const loadStatistics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/eforminstances/statistics/pending', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setStatistics({
        ...data,
        todayNew: 0, // TODO: 從 API 獲取今日新增數量
        todayCompleted: 0, // TODO: 從 API 獲取今日完成數量
        todayRejected: 0, // TODO: 從 API 獲取今日拒絕數量
      });
    } catch (error) {
      console.error('載入統計數據失敗:', error);
      message.error(t('reports.loadStatisticsFailed') || '載入統計數據失敗');
    }
  };

  // 載入報表數據
  const loadReportData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: '1',
        pageSize: '1000', // 報表顯示所有數據
      });

      if (dateRange && dateRange.length === 2 && dateRange[0] && dateRange[1]) {
        params.append('createdDateFrom', dayjs(dateRange[0]).toISOString());
        params.append('createdDateTo', dayjs(dateRange[1]).toISOString());
      }

      const response = await fetch(`/api/eforminstances/pending?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // 確保每條記錄都有必要的字段
      const formattedData = (data.data || []).map(record => ({
        ...record,
        id: record.id || record.Id,
        filledHtmlCode: record.filledHtmlCode || record.htmlCode,
        fieldDisplaySettings: record.fieldDisplaySettings,
        htmlCode: record.htmlCode || record.filledHtmlCode,
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
    // 狀態分佈
    const statusCount = {};
    const fillTypeCount = {};
    const priorityCount = {};
    const hourlyCount = {};

    data.forEach(record => {
      // 狀態統計
      const status = record.status || 'Unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;

      // 填寫類型統計
      const fillType = record.fillType || 'Unknown';
      fillTypeCount[fillType] = (fillTypeCount[fillType] || 0) + 1;

      // 優先級統計（如果有）
      const priority = record.priority || 'Normal';
      priorityCount[priority] = (priorityCount[priority] || 0) + 1;

      // 按小時統計（24小時趨勢）- 使用用戶時區
      if (record.createdAt) {
        const hour = TimezoneUtils.formatDateTime(record.createdAt, 'HH:00');
        hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
      }
    });

    // 轉換為圖表格式
    setChartData({
      statusDistribution: Object.entries(statusCount).map(([name, value]) => ({
        name: name === 'Pending' ? (t('common.pending') || '待處理') : 
              name === 'Submitted' ? (t('common.submitted') || '已提交') : name,
        value
      })),
      fillTypeDistribution: Object.entries(fillTypeCount).map(([name, value]) => ({
        name: name === 'AI Fill' ? (t('common.aiFill') || 'AI 填寫') :
              name === 'Data Fill' ? (t('common.dataFill') || '數據填寫') :
              name === 'Manual Fill' ? (t('common.manualFill') || '手動填寫') : name,
        value
      })),
      priorityDistribution: Object.entries(priorityCount).map(([name, value]) => ({
        name,
        value
      })),
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
      loadStatistics();
      loadReportData();
    }
  }, [dateRange]);

  const handleRefresh = () => {
    loadStatistics();
    loadReportData();
  };

  // 按流程定義分組數據
  const groupedByFormDefinition = useMemo(() => {
    const groups = {};
    
    dataSource.forEach(record => {
      // 優先使用 eFormDefinitionId，如果沒有則使用 formName
      const formId = record.eFormDefinitionId || record.EFormDefinitionId || 
                     record.formName || '未分類表單';
      const formName = record.formName || '未命名表單';
      
      // 使用 formId 作為分組鍵（確保同一表單定義的記錄分在同一組）
      const groupKey = typeof formId === 'string' && formId.includes('-') ? formId : 
                      (record.eFormDefinitionId || record.EFormDefinitionId || formName);
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          formId: record.eFormDefinitionId || record.EFormDefinitionId || groupKey,
          formName: formName,
          records: [],
          fieldDisplaySettings: null
        };
      }
      
      groups[groupKey].records.push(record);
      
      // 保存第一個記錄的 fieldDisplaySettings 作為該組的配置
      if (!groups[groupKey].fieldDisplaySettings && record.fieldDisplaySettings) {
        groups[groupKey].fieldDisplaySettings = record.fieldDisplaySettings;
      }
    });
    
    // 按表單名稱排序
    return Object.values(groups).sort((a, b) => a.formName.localeCompare(b.formName));
  }, [dataSource]);

  // 獲取完整的列定義（包含動態列）- 用於匯出
  const columns = useDynamicColumns(dataSource, baseColumns);

  const handleExport = async (format = 'excel') => {
    try {
      await exportReport(
        format,
        dataSource,
        columns,
        `待批事項總覽_${dateRange[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : ''}_${dateRange[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : ''}`,
        {
          sheetName: '待批事項總覽',
          title: t('reports.daily.pendingOverview') || '待批事項總覽',
          statistics: {
            '待處理總數': statistics.total,
            '逾期事項': statistics.overdue,
            '緊急事項': statistics.urgent,
            '今日新增': statistics.todayNew
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
            {t('reports.daily.pendingOverview') || '待批事項總覽'}
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
                title={t('reports.totalPending') || '待處理總數'}
                value={statistics.total}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.overdue') || '逾期事項'}
                value={statistics.overdue}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.urgent') || '緊急事項'}
                value={statistics.urgent}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.todayNew') || '今日新增'}
                value={statistics.todayNew}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 圖表分析區域 */}
        <Spin spinning={loading}>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* 狀態分佈餅圖 */}
            <Col xs={24} sm={12} lg={8}>
              <PieChart
                title={t('reports.statusDistribution') || '狀態分佈'}
                data={chartData.statusDistribution}
                height={300}
                colors={['#1890ff', '#52c41a', '#faad14', '#ff4d4f']}
              />
            </Col>
            {/* 填寫類型分佈餅圖 */}
            <Col xs={24} sm={12} lg={8}>
              <PieChart
                title={t('reports.fillTypeDistribution') || '填寫類型分佈'}
                data={chartData.fillTypeDistribution}
                height={300}
                colors={['#7234CF', '#1890ff', '#52c41a']}
              />
            </Col>
            {/* 24小時趨勢折線圖 */}
            <Col xs={24} sm={24} lg={8}>
              <LineChart
                title={t('reports.hourlyTrend') || '24小時趨勢'}
                xAxisData={chartData.hourlyTrend.dates}
                seriesData={[{
                  name: t('reports.newTasks') || '新增任務',
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

export default PendingTasksOverview;

