import React, { useState, useMemo } from 'react';
import { Card, Tabs, message } from 'antd';
import { useLanguage } from '../../../contexts/LanguageContext';
import WorkflowPerformanceMonthly from './WorkflowPerformanceMonthly';
import FormApprovalAnalysisMonthly from './FormApprovalAnalysisMonthly';
import BusinessProcessInsights from './BusinessProcessInsights';
import SystemUsageStatistics from './SystemUsageStatistics';
import OperationalPerformanceOverview from './OperationalPerformanceOverview';
import ProcessStepExecutionAnalysis from './ProcessStepExecutionAnalysis';

const { TabPane } = Tabs;

const MonthlyReportsPage = ({ userInterfaces = [] }) => {
  const { t } = useLanguage();
  const [activeReport, setActiveReport] = useState('workflowPerformance');

  // 根據用戶權限過濾可用的報表
  const availableReports = useMemo(() => {
    const reports = [];
    
    if (userInterfaces.includes('reports.monthly.workflowPerformance')) {
      reports.push({
        key: 'workflowPerformance',
        component: WorkflowPerformanceMonthly,
        label: t('reports.monthly.workflowPerformance') || '工作流效能月報'
      });
    }
    
    if (userInterfaces.includes('reports.monthly.formApproval')) {
      reports.push({
        key: 'formApproval',
        component: FormApprovalAnalysisMonthly,
        label: t('reports.monthly.formApproval') || '表單審批分析月報'
      });
    }
    
    if (userInterfaces.includes('reports.monthly.businessInsights')) {
      reports.push({
        key: 'businessInsights',
        component: BusinessProcessInsights,
        label: t('reports.monthly.businessInsights') || '業務流程洞察'
      });
    }
    
    if (userInterfaces.includes('reports.monthly.systemUsage')) {
      reports.push({
        key: 'systemUsage',
        component: SystemUsageStatistics,
        label: t('reports.monthly.systemUsage') || '系統使用統計'
      });
    }
    
    if (userInterfaces.includes('reports.monthly.operationalOverview')) {
      reports.push({
        key: 'operationalOverview',
        component: OperationalPerformanceOverview,
        label: t('reports.monthly.operationalOverview') || '營運效能總覽'
      });
    }
    
    if (userInterfaces.includes('reports.monthly.processStepExecution')) {
      reports.push({
        key: 'processStepExecution',
        component: ProcessStepExecutionAnalysis,
        label: t('reports.monthly.processStepExecution') || '流程步驟執行分析'
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
          <p>{t('reports.noMonthlyReportsPermission') || '您沒有權限訪問任何每月報表'}</p>
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

export default MonthlyReportsPage;

