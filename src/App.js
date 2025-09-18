import React, { useState, useEffect } from 'react';
import { Layout, message, ConfigProvider } from 'antd';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import SideMenu from './components/SideMenu';
import Dashboard from './pages/Dashboard';
import UnconfirmedPage from './pages/UnconfirmedPage';
import CustomerSignedPage from './pages/CustomerSignedPage';
import WhatsAppWorkflowPage from './pages/WhatsAppWorkflowPage';
import WorkflowListPage from './pages/WorkflowListPage';
import WorkflowMonitorPage from './pages/WorkflowMonitorPage';
import MyPreferencesModal from './components/MyPreferencesModal';
import CompanyUserAdminPage from './pages/CompanyUserAdminPage';
import CompanyEditPage from './pages/CompanyEditPage';
import WhatsAppTemplateList from './pages/WhatsAppTemplateList';

import EFormListPage from './pages/EFormListPage';
import EFormInstancePage from './pages/EFormInstancePage';
import StudioTest from './pages/StudioTest';
import PublishedAppsPage from './pages/PublishedAppsPage';
import PendingTasksPage from './pages/PendingTasksPage';
import './App.css';
import DataSetManagementPage from './pages/DataSetManagementPage';
import ContactListPage from './pages/ContactListPage';
import ContactEditPage from './pages/ContactEditPage';
import ContactImportPage from './pages/ContactImportPage';
import BroadcastGroupsPage from './pages/BroadcastGroupsPage';
import HashtagsPage from './pages/HashtagsPage';

const { Content } = Layout;

const pathToMenuKey = {
  '/dashboard': 'dashboard',
  '/unsigned': 'unsigned',
  '/pending-tasks': 'pendingTasks',
  '/customer-signed': 'customerSigned',
  '/whatsapp-workflow': 'whatsappWorkflow',
  '/workflow-list': 'whatsappWorkflow',
  '/workflow-monitor': 'workflowMonitor',
  '/whatsapp-templates': 'whatsappTemplates',
  '/eform-list': 'eformList',
  '/company-user-admin': 'companyUserAdmin',
  '/data-sets': 'dataSets',
  '/published-apps': 'publishedApps',
  '/contacts': 'contactList',
  '/contacts/new': 'contactList',
  '/contacts/edit/:id': 'contactList',
  '/contacts/import': 'contactList',
  '/broadcast-groups': 'broadcastGroups',
  '/hashtags': 'hashtags',
};

function MainLayout({ userInfo, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedMenuKey, setSelectedMenuKey] = useState('dashboard');

  useEffect(() => {
    const key = pathToMenuKey[location.pathname] || 'dashboard';
    setSelectedMenuKey(key);
  }, [location.pathname]);

  const handleMenuSelect = (key) => {
    setSelectedMenuKey(key);
    switch (key) {
      case 'dashboard':
        navigate('/dashboard');
        break;
      case 'unsigned':
        navigate('/unsigned');
        break;
      case 'pendingTasks':
        navigate('/pending-tasks');
        break;
      case 'customerSigned':
        navigate('/customer-signed');
        break;
      case 'whatsappWorkflow':
        navigate('/workflow-list');
        break;
      case 'workflowMonitor':
        navigate('/workflow-monitor');
        break;
      case 'whatsappTemplates':
        navigate('/whatsapp-templates');
        break;
      case 'eformList':
        navigate('/eform-list');
        break;
      case 'companyUserAdmin':
        navigate('/company-user-admin');
        break;
      case 'dataSets':
        navigate('/data-sets');
        break;
      case 'publishedApps':
        navigate('/published-apps');
        break;
      case 'contactList':
        navigate('/contacts');
        break;
      case 'broadcastGroups':
        navigate('/broadcast-groups');
        break;
      case 'hashtags':
        navigate('/hashtags');
        break;
      default:
        navigate('/dashboard');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SideMenu
        userInfo={userInfo}
        onLogout={onLogout}
        onMenuSelect={handleMenuSelect}
        selectedKey={selectedMenuKey}
      />
      <Layout className="main-content-layout">
        <Content className="main-content-panel">
          <Routes>
            <Route path="/dashboard" element={<Dashboard onMenuSelect={handleMenuSelect} />} />
            <Route path="/unsigned" element={<UnconfirmedPage />} />
            <Route path="/customer-signed" element={<CustomerSignedPage />} />
            <Route path="/whatsapp-workflow" element={<WhatsAppWorkflowPage />} />
            <Route path="/workflow-list" element={<WorkflowListPage />} />
            <Route path="/workflow-monitor" element={<WorkflowMonitorPage />} />
            <Route path="/company-user-admin" element={<CompanyUserAdminPage />} />
            <Route path="/company-edit" element={<CompanyEditPage />} />
            <Route path="/eform-list" element={<EFormListPage />} />
            <Route path="/eform-instance/:id" element={<EFormInstancePage />} />
            <Route path="/whatsapp-templates" element={<WhatsAppTemplateList />} />
            <Route path="/studio-test" element={<StudioTest />} />
            <Route path="/data-sets" element={<DataSetManagementPage />} />
            <Route path="/published-apps" element={<PublishedAppsPage />} />
            <Route path="/pending-tasks" element={<PendingTasksPage />} />
            <Route path="/contacts" element={<ContactListPage />} />
            <Route path="/contacts/new" element={<ContactEditPage />} />
            <Route path="/contacts/edit/:id" element={<ContactEditPage />} />
            <Route path="/contacts/import" element={<ContactImportPage />} />
            <Route path="/broadcast-groups" element={<BroadcastGroupsPage />} />
            <Route path="/hashtags" element={<HashtagsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function AppContent() {
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const { t, currentLanguage, changeLanguage } = useLanguage();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);
  const navigate = useNavigate();
  const [selectedMenuKey, setSelectedMenuKey] = useState('dashboard');

  const handleMenuSelect = (key) => {
    setSelectedMenuKey(key);
    switch (key) {
      case 'dashboard':
        navigate('/dashboard');
        break;
      case 'unsigned':
        navigate('/unsigned');
        break;
      case 'pendingTasks':
        navigate('/pending-tasks');
        break;
      case 'customerSigned':
        navigate('/customer-signed');
        break;
      case 'whatsappWorkflow':
        navigate('/workflow-list');
        break;
      case 'workflowMonitor':
        navigate('/workflow-monitor');
        break;
      case 'companyUserAdmin':
        navigate('/company-user-admin');
        break;
      case 'eformList':
        navigate('/eform-list');
        break;
      case 'whatsappTemplates':
        navigate('/whatsapp-templates');
        break;
      case 'dataSets':
        navigate('/data-sets');
        break;
      case 'publishedApps':
        navigate('/published-apps');
        break;
      case 'contactList':
        navigate('/contacts');
        break;
      case 'broadcastGroups':
        navigate('/broadcast-groups');
        break;
      case 'hashtags':
        navigate('/hashtags');
        break;
      default:
        navigate('/dashboard');
    }
  };

  // 初始化時檢查 localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('userInfo');
    if (savedUser) {
      setIsLoggedIn(true);
      setUserInfo(JSON.parse(savedUser));
    }
  }, []);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: values.user_id, password: values.password })
      });
      const data = await response.json();
      if (data.success) {
        message.success(t('login.loginSuccess'));
        
        // 先設置基本的登入狀態
        setIsLoggedIn(true);
        localStorage.setItem('token', data.token);
        
        // 使用 token 調用 /api/auth/me 獲取完整的用戶信息
        try {
          const meResponse = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${data.token}`
            }
          });
          
          if (meResponse.ok) {
            const userData = await meResponse.json();
            const fullUserInfo = {
              user_id: userData.user_id,
              account: userData.account,
              name: userData.name,
              email: userData.email,
              phone: userData.phone,
              language: userData.language,
              timezone: userData.timezone,
              avatar_url: userData.avatar_url,
              company_id: data.user.companyId // 從登入響應中獲取
            };
            
            setUserInfo(fullUserInfo);
            localStorage.setItem('userInfo', JSON.stringify(fullUserInfo));
          } else {
            // 如果 /api/auth/me 失敗，使用登入響應中的基本信息
            const basicUserInfo = {
              user_id: data.user.id,
              account: data.user.account,
              name: data.user.name,
              email: data.user.email,
              phone: '',
              language: 'zh-TC',
              timezone: 'Asia/Hong_Kong',
              avatar_url: '',
              company_id: data.user.companyId
            };
            
            setUserInfo(basicUserInfo);
            localStorage.setItem('userInfo', JSON.stringify(basicUserInfo));
          }
        } catch (meError) {
          // 如果調用 /api/auth/me 失敗，使用登入響應中的基本信息
          const basicUserInfo = {
            user_id: data.user.id,
            account: data.user.account,
            name: data.user.name,
            email: data.user.email,
            phone: '',
            language: 'zh-TC',
            timezone: 'Asia/Hong_Kong',
            avatar_url: '',
            company_id: data.user.companyId
          };
          
          setUserInfo(basicUserInfo);
          localStorage.setItem('userInfo', JSON.stringify(basicUserInfo));
        }
      } else {
        message.error(data.message || t('login.loginFailed'));
      }
    } catch (error) {
      message.error(t('login.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserInfo(null);
    localStorage.removeItem('userInfo');
    message.success(t('login.logoutSuccess'));
  };

  if (isLoggedIn) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <SideMenu
          userInfo={userInfo}
          onLogout={handleLogout}
          onMenuSelect={handleMenuSelect}
          selectedKey={selectedMenuKey}
          onAvatarClick={() => setShowPreferences(true)}
        />
        <Layout className="main-content-layout">
          <Content className="main-content-panel">
            <Routes>
              <Route path="/dashboard" element={<Dashboard onMenuSelect={handleMenuSelect} />} />
              <Route path="/unsigned" element={<UnconfirmedPage />} />
              <Route path="/customer-signed" element={<CustomerSignedPage />} />
              <Route path="/whatsapp-workflow" element={<WhatsAppWorkflowPage />} />
              <Route path="/workflow-list" element={<WorkflowListPage />} />
              <Route path="/workflow-monitor" element={<WorkflowMonitorPage />} />
              <Route path="/company-user-admin" element={<CompanyUserAdminPage />} />
              <Route path="/company-edit" element={<CompanyEditPage />} />
              <Route path="/eform-list" element={<EFormListPage />} />
              <Route path="/eform-instance/:id" element={<EFormInstancePage />} />
              <Route path="/whatsapp-templates" element={<WhatsAppTemplateList />} />
              <Route path="/studio-test" element={<StudioTest />} />
              <Route path="/data-sets" element={<DataSetManagementPage />} />
              <Route path="/published-apps" element={<PublishedAppsPage />} />
              <Route path="/pending-tasks" element={<PendingTasksPage />} />
              <Route path="/contacts" element={<ContactListPage />} />
              <Route path="/contacts/new" element={<ContactEditPage />} />
              <Route path="/contacts/edit/:id" element={<ContactEditPage />} />
              <Route path="/contacts/import" element={<ContactImportPage />} />
              <Route path="/broadcast-groups" element={<BroadcastGroupsPage />} />
              <Route path="/hashtags" element={<HashtagsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Content>
        </Layout>
        <MyPreferencesModal
          visible={showPreferences}
          onClose={() => setShowPreferences(false)}
          userInfo={userInfo}
          onUserInfoUpdate={setUserInfo}
        />
      </Layout>
    );
  }

  return (
    <div className="login-root">
      <div className="login-left">
        <img src="/assets/Whatoflow_logo_W.png" alt="WhatoFlow Logo" className="theme-img" />
      </div>
      <div className="login-right">
        <div className="login-box">
          <img src="/assets/starchy-logo.png" alt="logo" className="logo-img" />
          <h2 className="platform-title">{t('login.platformTitle')}</h2>
          <div className="language-switcher-container" style={{ marginBottom: 16 }}>
            <LanguageSwitcher />
          </div>
          <form className="login-form" onSubmit={e => {
            e.preventDefault();
            onFinish({ user_id: userId, password });
          }}>
            <input
              type="text"
              placeholder={t('login.userId')}
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="login-input"
              autoFocus
            />
            <input
              type="password"
              placeholder={t('login.password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-input"
            />
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? t('common.loading') : t('login.loginButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#7234CF',
        },
      }}
    >
      <LanguageProvider>
        <Router>
          <AppContent />
        </Router>
      </LanguageProvider>
    </ConfigProvider>
  );
}

export default App; 