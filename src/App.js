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
import MyPreferencesModal from './components/MyPreferencesModal';
import CompanyUserAdminPage from './pages/CompanyUserAdminPage';
import CompanyEditPage from './pages/CompanyEditPage';
import WhatsAppTemplateList from './pages/WhatsAppTemplateList';

import EFormListPage from './pages/EFormListPage';
import EFormInstancePage from './pages/EFormInstancePage';
import StudioTest from './pages/StudioTest';
import './App.css';

const { Content } = Layout;

const pathToMenuKey = {
  '/dashboard': 'dashboard',
  '/unsigned': 'unsigned',
  '/customer-signed': 'customerSigned',
  '/whatsapp-workflow': 'whatsappWorkflow',
  '/whatsapp-templates': 'whatsappTemplates',
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
      case 'customerSigned':
        navigate('/customer-signed');
        break;
      case 'whatsappWorkflow':
        navigate('/workflow-list');
        break;
      case 'whatsappTemplates':
        navigate('/whatsapp-templates');
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/unsigned" element={<UnconfirmedPage />} />
            <Route path="/customer-signed" element={<CustomerSignedPage />} />
            <Route path="/whatsapp-workflow" element={<WhatsAppWorkflowPage />} />
            <Route path="/workflow-list" element={<WorkflowListPage />} />
            <Route path="/company-user-admin" element={<CompanyUserAdminPage />} />
            <Route path="/company-edit" element={<CompanyEditPage />} />
            <Route path="/eform-list" element={<EFormListPage />} />
            <Route path="/eform-instance/:id" element={<EFormInstancePage />} />
            <Route path="/whatsapp-templates" element={<WhatsAppTemplateList />} />
            <Route path="/studio-test" element={<StudioTest />} />
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
      case 'customerSigned':
        navigate('/customer-signed');
        break;
      case 'whatsappWorkflow':
        navigate('/workflow-list');
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

  // 刪除這段 useEffect，避免 userInfo.language 變動時自動 changeLanguage
  // useEffect(() => {
  //   if (userInfo && userInfo.language) {
  //     changeLanguage(userInfo.language);
  //   }
  // }, [userInfo && userInfo.language, changeLanguage]);

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
        setIsLoggedIn(true);
        setUserInfo({
          user_id: data.user_id,
          account: data.account,
          name: data.name, // 改為 data.name
          email: data.email,
          phone: data.phone,
          language: data.language,
          timezone: data.timezone,
          avatar_url: data.avatar_url,
          company_id: data.company_id // 添加 company_id
        });
        localStorage.setItem('userInfo', JSON.stringify({
          user_id: data.user_id,
          account: data.account,
          name: data.name, // 改為 data.name
          email: data.email,
          phone: data.phone,
          language: data.language,
          timezone: data.timezone,
          avatar_url: data.avatar_url,
          company_id: data.company_id // 添加 company_id
        }));
        localStorage.setItem('token', data.token); // 新增這行，存下 JWT token
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
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/unsigned" element={<UnconfirmedPage />} />
              <Route path="/customer-signed" element={<CustomerSignedPage />} />
              <Route path="/whatsapp-workflow" element={<WhatsAppWorkflowPage />} />
              <Route path="/workflow-list" element={<WorkflowListPage />} />
              <Route path="/company-user-admin" element={<CompanyUserAdminPage />} />
              <Route path="/company-edit" element={<CompanyEditPage />} />
              <Route path="/eform-list" element={<EFormListPage />} />
              <Route path="/eform-instance/:id" element={<EFormInstancePage />} />
              <Route path="/whatsapp-templates" element={<WhatsAppTemplateList />} />
              <Route path="/studio-test" element={<StudioTest />} />
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
        <img src="/assets/starchy-theme.png" alt="theme" className="theme-img" />
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