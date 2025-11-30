import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, message, Space, Button, Collapse, Tabs, Badge, DatePicker } from 'antd';
import { 
  MessageOutlined, 
  PhoneOutlined, 
  ProjectOutlined,
  FileTextOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TableOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReportTable from '../components/ReportTable';
import { exportReport } from '../components/ReportExport';
import { useDynamicColumns } from '../components/DynamicFormColumns';
import { PieChart, BarChart, LineChart, HeatmapChart, ScatterChart } from '../components/ReportCharts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const WhatsAppInteractionAnalysis = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    totalActiveNumbers: 0,
    totalMessages: 0,
    totalWorkflowTriggers: 0,
    totalFormSubmissions: 0
  });
  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState({
    topPhoneNumbers: { phones: [], counts: [] },
    messageTypeDistribution: [],
    hourlyHeatmap: { data: [], hours: [], dates: [] },
    interactionVsWorkflow: []
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
      title: t('reports.phoneNumber') || '電話號碼',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      width: 150,
      render: (phone) => {
        if (!phone) return '-';
        return phone;
      }
    },
    {
      title: t('reports.messageCount') || '消息數量',
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: 120,
      sorter: (a, b) => a.messageCount - b.messageCount,
    },
    {
      title: t('reports.workflowTriggers') || '工作流觸發',
      dataIndex: 'workflowTriggers',
      key: 'workflowTriggers',
      width: 120,
      sorter: (a, b) => a.workflowTriggers - b.workflowTriggers,
    },
    {
      title: t('reports.formSubmissions') || '表單提交',
      dataIndex: 'formSubmissions',
      key: 'formSubmissions',
      width: 120,
      sorter: (a, b) => a.formSubmissions - b.formSubmissions,
    },
    {
      title: t('reports.firstMessageTime') || '首次消息時間',
      dataIndex: 'firstMessageTime',
      key: 'firstMessageTime',
      width: 180,
      render: (date) => {
        if (!date) return '-';
        return TimezoneUtils.formatDateTime(date, 'YYYY-MM-DD HH:mm:ss');
      }
    },
    {
      title: t('reports.lastMessageTime') || '最後消息時間',
      dataIndex: 'lastMessageTime',
      key: 'lastMessageTime',
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

      const response = await fetch(`/api/reports/daily/whatsapp-interactions?${params}`, {
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
        totalActiveNumbers: data.totalActiveNumbers || 0,
        totalMessages: data.totalMessages || 0,
        totalWorkflowTriggers: data.topNumbers?.reduce((sum, n) => sum + (n.workflowTriggers || 0), 0) || 0,
        totalFormSubmissions: data.topNumbers?.reduce((sum, n) => sum + (n.formSubmissions || 0), 0) || 0
      });

      // 格式化數據源，按操作類型展開
      const formattedData = (data.topNumbers || []).flatMap((item, index) => {
        const actionDetails = item.actionDetails || [];
        const relatedForms = item.relatedEformInstances || [];
        
        // 如果沒有操作詳情，使用舊的邏輯（向後兼容）
        if (actionDetails.length === 0) {
          if (relatedForms.length === 0) {
            return [{
              key: `phone_${item.phoneNumber}_${index}`,
              id: `phone_${item.phoneNumber}`,
              phoneNumber: item.phoneNumber,
              actionType: 'unknown',
              messageCount: item.messageCount,
              workflowTriggers: item.workflowTriggers,
              formSubmissions: item.formSubmissions,
              firstMessageTime: item.firstMessageTime,
              lastMessageTime: item.lastMessageTime,
              fieldDisplaySettings: null,
              filledHtmlCode: null,
              htmlCode: null
            }];
          } else {
            return relatedForms.map((form, formIndex) => ({
              key: `phone_${item.phoneNumber}_form_${form.id}_${formIndex}`,
              id: form.id,
              phoneNumber: item.phoneNumber,
              actionType: 'fill_eform',
              messageCount: item.messageCount,
              workflowTriggers: item.workflowTriggers,
              formSubmissions: item.formSubmissions,
              firstMessageTime: item.firstMessageTime,
              lastMessageTime: item.lastMessageTime,
              fieldDisplaySettings: form.fieldDisplaySettings,
              filledHtmlCode: form.filledHtmlCode,
              htmlCode: form.htmlCode,
              eFormDefinitionId: form.eFormDefinitionId || form.EFormDefinitionId,
              formName: form.formName,
              formStatus: form.status,
              formCreatedAt: form.createdAt
            }));
          }
        }
        
        // 按操作類型展開，每個操作類型一條記錄
        return actionDetails.map((action, actionIndex) => {
          // 為每個操作類型關聯相關的表單數據
          const relatedForm = relatedForms.find(f => 
            action.workflowExecutionIds && 
            action.workflowExecutionIds.length > 0 &&
            f.id // 這裡需要根據實際情況匹配
          ) || relatedForms[0]; // 如果找不到，使用第一個表單
          
          return {
            key: `phone_${item.phoneNumber}_action_${action.actionType}_${actionIndex}`,
            id: `phone_${item.phoneNumber}_${action.actionType}`,
            phoneNumber: item.phoneNumber,
            actionType: action.actionType,
            actionCount: action.count,
            firstActionTime: action.firstTime,
            lastActionTime: action.lastTime,
            messageCount: item.messageCount,
            workflowTriggers: item.workflowTriggers,
            formSubmissions: item.formSubmissions,
            firstMessageTime: item.firstMessageTime,
            lastMessageTime: item.lastMessageTime,
            fieldDisplaySettings: relatedForm?.fieldDisplaySettings || null,
            filledHtmlCode: relatedForm?.filledHtmlCode || null,
            htmlCode: relatedForm?.htmlCode || null,
            eFormDefinitionId: relatedForm?.eFormDefinitionId || relatedForm?.EFormDefinitionId || null,
            formName: relatedForm?.formName || null,
            formStatus: relatedForm?.status || null,
            formCreatedAt: relatedForm?.createdAt || null
          };
        });
      });

      setDataSource(formattedData);

      // 準備圖表數據
      prepareChartData(data);
    } catch (error) {
      console.error('載入報表數據失敗:', error);
      message.error(t('reports.loadDataFailed') || '載入報表數據失敗');
    } finally {
      setLoading(false);
    }
  };

  // 操作類型標籤映射（提前定義，供 prepareChartData 使用）
  const getActionTypeLabel = (messageType) => {
    if (!messageType) return '未知';
    
    const typeLower = messageType.toLowerCase();
    
    // 映射後端返回的 messageType 到操作類型
    if (typeLower === 'workflow_start' || typeLower === 'start') {
      return t('reports.actionType.startWorkflow') || '啟動流程';
    } else if (typeLower.includes('qrcode') || typeLower.includes('waitforqrcode')) {
      return t('reports.actionType.replyQrcode') || '回覆QR碼';
    } else if (typeLower.includes('waitreply') || typeLower.includes('waitforuserreply') || typeLower === 'wait') {
      return t('reports.actionType.replyMsg') || '回覆消息';
    } else if (typeLower.includes('sendeform') || typeLower === 'sendeform') {
      return t('reports.actionType.receiveEform') || '接收表單';
    } else if (typeLower === 'eform_submission' || typeLower === 'template_submission') {
      return t('reports.actionType.fillEform') || '填寫表單';
    } else if (typeLower === 'text' || typeLower === 'image' || typeLower === 'file' || typeLower === 'audio') {
      // 傳統消息類型，保持原有翻譯
      return typeLower === 'text' ? (t('reports.messageTypeText') || '文本') :
             typeLower === 'image' ? (t('reports.messageTypeImage') || '圖片') :
             typeLower === 'file' ? (t('reports.messageTypeFile') || '文件') :
             typeLower === 'audio' ? (t('reports.messageTypeAudio') || '語音') : messageType;
    } else if (typeLower.includes('template') || typeLower.includes('whatsapp') || typeLower === 'wa') {
      return t('reports.actionType.receiveNotification') || '接收通知';
    } else {
      // 默認返回接收通知（因為大部分系統發送的消息都是通知）
      return t('reports.actionType.receiveNotification') || '接收通知';
    }
  };

  // 準備圖表數據
  const prepareChartData = (data) => {
    const topNumbers = data.topNumbers || [];
    
    // Top 20 活躍電話號碼
    const top20 = topNumbers.slice(0, 20);
    
    // 消息類型分佈（從 hourlyDistribution 或 messageTypeDistribution 獲取）
    const messageTypeData = data.messageTypeDistribution || [
      { type: 'text', count: Math.floor(data.totalMessages * 0.7) },
      { type: 'image', count: Math.floor(data.totalMessages * 0.2) },
      { type: 'file', count: Math.floor(data.totalMessages * 0.08) },
      { type: 'audio', count: Math.floor(data.totalMessages * 0.02) }
    ];

    // 24小時互動時段熱力圖數據
    const hourlyDistribution = data.hourlyDistribution || [];
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    const dates = [dayjs().format('YYYY-MM-DD')];
    const heatmapData = hours.map((hour, hourIndex) => {
      const hourData = hourlyDistribution.find(h => h.hour === hourIndex);
      return [hour, dates[0], hourData?.count || 0];
    });

    // 互動頻率 vs 工作流觸發散點圖
    const scatterData = topNumbers.map(item => [
      item.messageCount || 0,
      item.workflowTriggers || 0,
      item.formSubmissions || 0
    ]);

    setChartData({
      topPhoneNumbers: {
        phones: top20.map(n => n.phoneNumber || ''),
        counts: top20.map(n => n.messageCount || 0)
      },
      messageTypeDistribution: messageTypeData.map(item => ({
        name: getActionTypeLabel(item.type),
        value: item.count || 0
      })),
      hourlyHeatmap: {
        data: heatmapData,
        hours: hours,
        dates: dates
      },
      interactionVsWorkflow: scatterData
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

  // 操作類型標籤映射
  const actionTypeLabels = {
    'start_workflow': t('reports.actionType.startWorkflow') || '啟動流程',
    'reply_qrcode': t('reports.actionType.replyQrcode') || '回覆QR碼',
    'reply_msg': t('reports.actionType.replyMsg') || '回覆消息',
    'receive_notification': t('reports.actionType.receiveNotification') || '接收通知',
    'receive_eform': t('reports.actionType.receiveEform') || '接收表單',
    'fill_eform': t('reports.actionType.fillEform') || '填寫表單',
    'unknown': t('reports.actionType.unknown') || '未知操作'
  };

  // 按操作類型分組，然後在每個操作類型下按電話號碼分組
  const groupedByActionType = useMemo(() => {
    const actionGroups = {};
    
    // 先按操作類型分組
    dataSource.forEach(record => {
      const actionType = record.actionType || 'unknown';
      
      if (!actionGroups[actionType]) {
        actionGroups[actionType] = {
          actionType: actionType,
          actionLabel: actionTypeLabels[actionType] || actionType,
          phoneGroups: {},
          totalRecords: 0
        };
      }
      
      // 在每個操作類型下，按電話號碼分組
      const phoneNumber = record.phoneNumber || '未分類';
      const phoneKey = phoneNumber;
      
      if (!actionGroups[actionType].phoneGroups[phoneKey]) {
        actionGroups[actionType].phoneGroups[phoneKey] = {
          phoneNumber: phoneNumber,
          displayName: phoneNumber,
          records: [],
          formNames: new Set(),
          fieldDisplaySettings: null
        };
      }
      
      actionGroups[actionType].phoneGroups[phoneKey].records.push(record);
      actionGroups[actionType].totalRecords++;
      
      // 收集表單名稱
      if (record.formName) {
        actionGroups[actionType].phoneGroups[phoneKey].formNames.add(record.formName);
      }
      
      // 保存第一個遇到的 fieldDisplaySettings（用於動態列）
      if (!actionGroups[actionType].phoneGroups[phoneKey].fieldDisplaySettings && record.fieldDisplaySettings) {
        actionGroups[actionType].phoneGroups[phoneKey].fieldDisplaySettings = record.fieldDisplaySettings;
      }
    });
    
    // 轉換為數組並排序
    const actionOrder = ['start_workflow', 'receive_notification', 'receive_eform', 'reply_qrcode', 'reply_msg', 'fill_eform', 'unknown'];
    
    return Object.values(actionGroups)
      .map(actionGroup => ({
        ...actionGroup,
        phoneGroups: Object.values(actionGroup.phoneGroups).sort((a, b) => {
          // 先按記錄數排序（多的在前）
          if (a.records.length !== b.records.length) {
            return b.records.length - a.records.length;
          }
          // 再按電話號碼排序
          return a.phoneNumber.localeCompare(b.phoneNumber);
        })
      }))
      .sort((a, b) => {
        const aOrder = actionOrder.indexOf(a.actionType) >= 0 ? actionOrder.indexOf(a.actionType) : 999;
        const bOrder = actionOrder.indexOf(b.actionType) >= 0 ? actionOrder.indexOf(b.actionType) : 999;
        return aOrder - bOrder;
      });
  }, [dataSource]);

  // 獲取完整的列定義（包含動態列）
  const columns = useDynamicColumns(dataSource, baseColumns);

  const handleExport = async (format = 'excel') => {
    try {
      await exportReport(
        format,
        dataSource,
        columns,
        `WhatsApp互動分析_${dateRange[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : ''}_${dateRange[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : ''}`,
        {
          sheetName: 'WhatsApp互動分析',
          title: t('reports.daily.whatsappInteraction') || 'WhatsApp 互動分析',
          statistics: {
            '活躍電話號碼': statistics.totalActiveNumbers,
            '消息總數': statistics.totalMessages,
            '工作流觸發': statistics.totalWorkflowTriggers,
            '表單提交': statistics.totalFormSubmissions
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
            {t('reports.daily.whatsappInteraction') || 'WhatsApp 互動分析'}
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
                title={t('reports.activePhoneNumbers') || '活躍電話號碼'}
                value={statistics.totalActiveNumbers}
                prefix={<PhoneOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.totalMessages') || '消息總數'}
                value={statistics.totalMessages}
                prefix={<MessageOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.totalWorkflowTriggers') || '工作流觸發總數'}
                value={statistics.totalWorkflowTriggers}
                prefix={<ProjectOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title={t('reports.totalFormSubmissions') || '表單提交總數'}
                value={statistics.totalFormSubmissions}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 圖表分析區域 */}
        <Spin spinning={loading}>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* Top 20 活躍電話號碼排名 */}
            <Col xs={24} sm={12} lg={12}>
              <BarChart
                title={t('reports.topActivePhoneNumbers') || 'Top 20 活躍電話號碼排名'}
                xAxisData={chartData.topPhoneNumbers.phones}
                seriesData={[{
                  name: t('reports.messageCount') || '消息數量',
                  data: chartData.topPhoneNumbers.counts
                }]}
                height={350}
                colors={['#7234CF']}
              />
            </Col>
            {/* 消息類型分佈 */}
            <Col xs={24} sm={12} lg={6}>
              <PieChart
                title={t('reports.messageTypeDistribution') || '消息類型分佈'}
                data={chartData.messageTypeDistribution}
                height={350}
                colors={['#1890ff', '#52c41a', '#faad14', '#ff4d4f']}
              />
            </Col>
            {/* 互動頻率 vs 工作流觸發散點圖 */}
            <Col xs={24} sm={12} lg={6}>
              <ScatterChart
                title={t('reports.interactionVsWorkflow') || '互動頻率 vs 工作流觸發'}
                data={chartData.interactionVsWorkflow}
                height={350}
                xAxisName={t('reports.messageCount') || '消息數量'}
                yAxisName={t('reports.workflowTriggers') || '工作流觸發'}
                colors={['#722ed1']}
              />
            </Col>
          </Row>

          {/* 24小時互動時段熱力圖 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24}>
              <HeatmapChart
                title={t('reports.hourlyInteractionHeatmap') || '24小時互動時段熱力圖'}
                data={chartData.hourlyHeatmap.data}
                xAxisData={chartData.hourlyHeatmap.hours}
                yAxisData={chartData.hourlyHeatmap.dates}
                height={300}
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
                    ({dataSource.length} {t('reports.records') || '條記錄'}, {groupedByActionType.length} {t('reports.actionTypes') || '種操作類型'})
                  </span>
                </Space>
              ),
              children: (
                groupedByActionType.length > 0 ? (
                  <Tabs
                    type="card"
                    items={groupedByActionType.map((actionGroup, actionIndex) => ({
                      key: `${actionGroup.actionType}_${actionIndex}`,
                      label: (
                        <Space>
                          <span>{actionGroup.actionLabel}</span>
                          <Badge count={actionGroup.totalRecords} showZero style={{ backgroundColor: '#52c41a' }} />
                        </Space>
                      ),
                      children: actionGroup.phoneGroups.length > 0 ? (
                        <Tabs
                          type="card"
                          size="small"
                          items={actionGroup.phoneGroups.map((phoneGroup, phoneIndex) => ({
                            key: `${actionGroup.actionType}_${phoneGroup.phoneNumber}_${phoneIndex}`,
                            label: (
                              <Space>
                                <span>{phoneGroup.displayName}</span>
                                <Badge count={phoneGroup.records.length} showZero style={{ backgroundColor: '#1890ff' }} />
                              </Space>
                            ),
                            children: (
                              <ReportTable
                                dataSource={phoneGroup.records}
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

export default WhatsAppInteractionAnalysis;
