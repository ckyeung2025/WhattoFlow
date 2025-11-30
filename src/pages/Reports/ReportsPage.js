import React, { useState, useEffect } from 'react';
import { Spin, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { getUserInterfacesFromStorage } from '../../utils/permissionUtils';
import DailyReportsPage from './DailyReports/DailyReportsPage';
import MonthlyReportsPage from './MonthlyReports/MonthlyReportsPage';
import RealtimeReportsPage from './RealtimeReports/RealtimeReportsPage';

const ReportsPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [userInterfaces, setUserInterfaces] = useState([]);
  const [loading, setLoading] = useState(true);

  // 載入用戶權限
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const interfaces = await getUserInterfacesFromStorage(true);
        setUserInterfaces(interfaces);
        
        // 檢查用戶是否有任何 Reports 權限
        const hasReportsPermission = interfaces.some(iface => 
          iface.startsWith('reports.')
        );
        
        if (!hasReportsPermission) {
          message.warning(t('reports.noPermission') || '您沒有權限訪問報表功能');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('載入權限失敗:', error);
        message.error(t('reports.loadPermissionFailed') || '載入權限失敗');
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [navigate, t]);

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <p style={{ marginTop: '16px' }}>{t('common.loading') || '載入中...'}</p>
      </div>
    );
  }

  // 根據路由路徑決定顯示哪個頁面
  const path = location.pathname;
  
  if (path === '/reports/daily') {
    // 檢查用戶是否有 Daily Reports 權限
    const hasDailyPermission = userInterfaces.some(iface => 
      iface.startsWith('reports.daily')
    );
    
    if (!hasDailyPermission) {
      message.warning(t('reports.noDailyReportsPermission') || '您沒有權限訪問每日報表');
      navigate('/dashboard');
      return null;
    }
    
    return <DailyReportsPage userInterfaces={userInterfaces} />;
  } else if (path === '/reports/monthly') {
    // 檢查用戶是否有 Monthly Reports 權限
    const hasMonthlyPermission = userInterfaces.some(iface => 
      iface.startsWith('reports.monthly')
    );
    
    if (!hasMonthlyPermission) {
      message.warning(t('reports.noMonthlyReportsPermission') || '您沒有權限訪問每月報表');
      navigate('/dashboard');
      return null;
    }
    
    return <MonthlyReportsPage userInterfaces={userInterfaces} />;
  } else if (path === '/reports/realtime') {
    // 檢查用戶是否有 Realtime Reports 權限
    const hasRealtimePermission = userInterfaces.some(iface => 
      iface.startsWith('reports.realtime')
    );
    
    if (!hasRealtimePermission) {
      message.warning(t('reports.noRealtimeReportsPermission') || '您沒有權限訪問實時報表');
      navigate('/dashboard');
      return null;
    }
    
    return <RealtimeReportsPage userInterfaces={userInterfaces} />;
  }

  // 默認重定向到 daily（如果用戶有權限）
  const hasDailyPermission = userInterfaces.some(iface => 
    iface.startsWith('reports.daily')
  );
  const hasMonthlyPermission = userInterfaces.some(iface => 
    iface.startsWith('reports.monthly')
  );
  const hasRealtimePermission = userInterfaces.some(iface => 
    iface.startsWith('reports.realtime')
  );
  
  if (hasDailyPermission) {
    navigate('/reports/daily', { replace: true });
  } else if (hasMonthlyPermission) {
    navigate('/reports/monthly', { replace: true });
  } else if (hasRealtimePermission) {
    navigate('/reports/realtime', { replace: true });
  } else {
    navigate('/dashboard', { replace: true });
  }
  
  return null;
};

export default ReportsPage;

