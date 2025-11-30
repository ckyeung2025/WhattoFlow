import React, { useState, useMemo } from 'react';
import { Card, Tabs } from 'antd';
import { useLanguage } from '../../../contexts/LanguageContext';
import WorkflowActivityKanban from './WorkflowActivityKanban';

const { TabPane } = Tabs;

const RealtimeReportsPage = ({ userInterfaces = [] }) => {
  const { t } = useLanguage();
  const [activeReport, setActiveReport] = useState('workflowActivity');

  // 根據用戶權限過濾可用的報表
  const availableReports = useMemo(() => {
    const reports = [];
    
    if (userInterfaces.includes('reports.realtime.workflowActivity')) {
      reports.push({
        key: 'workflowActivity',
        component: WorkflowActivityKanban,
        label: t('reports.realtime.workflowActivity') || '工作流活動看板'
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
          <p>{t('reports.noRealtimeReportsPermission') || '您沒有權限訪問任何實時報表'}</p>
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

export default RealtimeReportsPage;


