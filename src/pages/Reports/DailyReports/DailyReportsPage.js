import React, { useState, useMemo } from 'react';
import { Card, Row, Col, Tabs, message } from 'antd';
import { useLanguage } from '../../../contexts/LanguageContext';
import PendingTasksOverview from './PendingTasksOverview';
import WorkflowExecutionDaily from './WorkflowExecutionDaily';
import FormProcessingEfficiency from './FormProcessingEfficiency';
import WorkflowHealthMonitor from './WorkflowHealthMonitor';
import WhatsAppInteractionAnalysis from './WhatsAppInteractionAnalysis';

const { TabPane } = Tabs;

const DailyReportsPage = ({ userInterfaces = [] }) => {
  const { t } = useLanguage();
  const [activeReport, setActiveReport] = useState('pendingOverview');

  // 根據用戶權限過濾可用的報表
  const availableReports = useMemo(() => {
    const reports = [];
    
    if (userInterfaces.includes('reports.daily.pendingOverview')) {
      reports.push({
        key: 'pendingOverview',
        component: PendingTasksOverview,
        label: t('reports.daily.pendingOverview') || '待批事項總覽'
      });
    }
    
    if (userInterfaces.includes('reports.daily.workflowExecution')) {
      reports.push({
        key: 'workflowExecution',
        component: WorkflowExecutionDaily,
        label: t('reports.daily.workflowExecution') || '工作流執行日報'
      });
    }
    
    if (userInterfaces.includes('reports.daily.formEfficiency')) {
      reports.push({
        key: 'formEfficiency',
        component: FormProcessingEfficiency,
        label: t('reports.daily.formEfficiency') || '表單處理效率'
      });
    }
    
    if (userInterfaces.includes('reports.daily.workflowHealth')) {
      reports.push({
        key: 'workflowHealth',
        component: WorkflowHealthMonitor,
        label: t('reports.daily.workflowHealth') || '工作流健康度監控'
      });
    }
    
    if (userInterfaces.includes('reports.daily.whatsappInteraction')) {
      reports.push({
        key: 'whatsappInteraction',
        component: WhatsAppInteractionAnalysis,
        label: t('reports.daily.whatsappInteraction') || 'WhatsApp 互動分析'
      });
    }
    
    return reports;
  }, [userInterfaces, t]);

  // 如果沒有可用報表，設置默認顯示第一個
  React.useEffect(() => {
    if (availableReports.length > 0 && !availableReports.find(r => r.key === activeReport)) {
      setActiveReport(availableReports[0].key);
    }
  }, [availableReports, activeReport]);

  if (availableReports.length === 0) {
    return (
      <Card>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p>{t('reports.noDailyReportsPermission') || '您沒有權限訪問任何每日報表'}</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Tabs
        activeKey={activeReport}
        onChange={setActiveReport}
        type="card"
        size="large"
      >
        {availableReports.map(report => {
          const ReportComponent = report.component;
          return (
            <TabPane tab={report.label} key={report.key}>
              <ReportComponent />
            </TabPane>
          );
        })}
      </Tabs>
    </div>
  );
};

export default DailyReportsPage;

