import React, { useState } from 'react';
import { Layout, Menu, Avatar, Typography, Divider } from 'antd';
import { 
  DashboardOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined, 
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  MessageOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import UserAvatar from './UserAvatar';

const { Sider } = Layout;
const { Text } = Typography;

const SideMenu = ({ userInfo, onLogout, onMenuSelect, selectedKey, onAvatarClick }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useLanguage();

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: t('menu.dashboard'),
    },
    {
      key: 'unsigned',
      icon: <FileTextOutlined />,
      label: t('menu.unsigned'),
    },
    {
      key: 'customerSigned',
      icon: <UserOutlined />,
      label: t('menu.customerSigned'),
    },
    // e-Form 管理移到 Elsa Dashboard 上方
    {
      key: 'eformList',
      icon: <FileTextOutlined />,
      label: 'e-Form 管理',
      url: '/eform-list',
    },
    // WhatsApp 訊息模版
    {
      key: 'whatsappTemplates',
      icon: <MessageOutlined />,
      label: 'WhatsApp 訊息模版',
      url: '/whatsapp-templates',
    },
    // 新增 Elsa Dashboard 選單
    {
      key: 'whatsappWorkflow',
      icon: <CheckCircleOutlined />,
      label: t('menu.whatsappWorkflow'),
      url: '/workflow-list',
    },
    {
      key: 'companyUserAdmin',
      icon: <UserOutlined />,
      label: t('menu.companyUserAdmin'),
      url: '/company-user-admin',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('menu.logout'),
      onClick: onLogout,
    }
  ];

  return (
    <Sider 
      trigger={null} 
      collapsible 
      collapsed={collapsed}
      width={280}
      style={{
        background: '#3d186b',
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.15)',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 1000,
      }}
    >
      {/* 用戶資訊區域 */}
      <div style={{ 
        padding: collapsed ? '16px 8px' : '24px 16px',
        textAlign: collapsed ? 'center' : 'left',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ cursor: 'pointer' }} onClick={onAvatarClick} title="個人偏好">
            <Avatar 
              size={collapsed ? 32 : 40} 
              src={userInfo?.avatar_url ? userInfo.avatar_url : undefined}
              icon={!userInfo?.avatar_url && <UserOutlined />}
              style={{ backgroundColor: '#7234CF' }}
            />
          </div>
          {!collapsed && (
            <div style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: 'white', fontSize: 14, fontWeight: 500, display: 'block' }}>
                {userInfo?.name || 'User'}
              </Text>
            </div>
          )}
        </div>
      </div>

      {/* 選單 */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={collapsed ? [] : ['dashboard']}
        items={menuItems}
        onClick={({ key }) => {
          if (key === 'logout') {
            onLogout();
          } else {
            onMenuSelect(key);
          }
        }}
        style={{
          border: 'none',
          background: 'transparent',
        }}
      />

      {/* 折疊按鈕 */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: collapsed ? 8 : 16,
        right: collapsed ? 8 : 16,
      }}>
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.3s',
            color: 'rgba(255, 255, 255, 0.65)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
          }}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      </div>
    </Sider>
  );
};

export default SideMenu; 