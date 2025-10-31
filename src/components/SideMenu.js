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
  MessageOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  BranchesOutlined,  // 添加這個圖標
  ClockCircleOutlined,  // 添加時鐘圖標用於待處理事項
  RocketOutlined,  // 添加火箭圖標用於 Published Apps
  AppstoreOutlined,  // 添加應用圖標
  ToolOutlined,  // 添加工具圖標用於 Studio
  SettingOutlined,  // 添加設定圖標用於管理工具
  ContactsOutlined,  // 添加聯絡人圖標
  TeamOutlined,  // 添加群組圖標
  TagsOutlined,  // 添加標籤圖標
  SendOutlined  // 添加發送圖標
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import UserAvatar from './UserAvatar';

const { Sider } = Layout;
const { Text } = Typography;

const SideMenu = ({ userInfo, onLogout, onMenuSelect, selectedKey, onAvatarClick }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState([]);
  const { t } = useLanguage();

  // 處理選單展開/收合 - 手風琴效果
  const handleOpenChange = (keys) => {
    const mainMenus = ['application', 'adminTools', 'studio'];
    
    // 找出最新展開的選單
    const latestOpenKey = keys.find(key => openKeys.indexOf(key) === -1);
    
    if (latestOpenKey && mainMenus.includes(latestOpenKey)) {
      // 如果展開的是主選單，則只保留當前展開的主選單（手風琴效果）
      setOpenKeys([latestOpenKey]);
    } else if (latestOpenKey) {
      // 如果展開的是子選單，保持當前主選單展開狀態
      const currentMainMenu = openKeys.find(key => mainMenus.includes(key));
      if (currentMainMenu) {
        setOpenKeys([currentMainMenu, ...keys.filter(key => !mainMenus.includes(key))]);
      } else {
        setOpenKeys(keys);
      }
    } else {
      // 收合選單
      setOpenKeys(keys);
    }
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: t('menu.dashboard'),
    },
    {
      type: 'divider',
    },
    // Application 應用區域
    {
      key: 'application',
      icon: <AppstoreOutlined />,
      label: t('menu.application'),
      children: [
        {
          key: 'publishedApps',
          icon: <RocketOutlined />,
          label: t('menu.publishedApps'),
          url: '/published-apps',
        },
        {
          key: 'pendingTasks',
          icon: <ClockCircleOutlined />,
          label: t('menu.pendingTasks'),
          url: '/pending-tasks',
        },
        {
          key: 'workflowMonitor',
          icon: <BarChartOutlined />,
          label: t('menu.runningApps'),
          url: '/workflow-monitor',
        }
      ]
    },
    {
      type: 'divider',
    },
    // Studio 工作室區域
    {
      key: 'studio',
      icon: <ToolOutlined />,
      label: t('menu.studio'),
      children: [
        // 表單管理
        {
          key: 'eformList',
          icon: <FileTextOutlined />,
          label: t('menu.eformList'),
          url: '/eform-list',
        },
        // 訊息模版
        {
          key: 'whatsappTemplates',
          icon: <MessageOutlined />,
          label: t('menu.whatsappTemplates'),
          url: '/whatsapp-templates',
        },
        // 工作流程設計
        {
          key: 'whatsappWorkflow',
          icon: <BranchesOutlined />,
          label: t('menu.whatsappWorkflow'),
          url: '/workflow-list',
        },
        // 數據集管理
        {
          key: 'dataSets',
          icon: <DatabaseOutlined />,
          label: t('dataSetManagement.title'),
          url: '/data-sets',
        }
      ]
    },
    {
      type: 'divider',
    },
    // Administrator Tools 管理工具區域
    {
      key: 'adminTools',
      icon: <SettingOutlined />,
      label: t('menu.adminTools'),
      children: [
        // 聯絡人管理
        {
          key: 'contactList',
          icon: <ContactsOutlined />,
          label: t('menu.contactList'),
          url: '/contacts',
        },
        // 廣播群組管理
        {
          key: 'broadcastGroups',
          icon: <TeamOutlined />,
          label: t('menu.broadcastGroups'),
          url: '/broadcast-groups',
        },
        // 標籤管理
        {
          key: 'hashtags',
          icon: <TagsOutlined />,
          label: t('menu.hashtags'),
          url: '/hashtags',
        },
        // 公司/用戶管理
        {
          key: 'companyUserAdmin',
          icon: <UserOutlined />,
          label: t('menu.companyUserAdmin'),
          url: '/company-user-admin',
        },
        // WhatsApp 電話號碼驗證管理
        {
          key: 'phoneVerificationAdmin',
          icon: <MessageOutlined />,
          label: '電話號碼驗證',
          url: '/phone-verification-admin',
        }
      ]
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
      {/* WhatoFlow Logo */}
      <div style={{ 
        padding: collapsed ? '12px 8px' : '16px 16px',
        textAlign: collapsed ? 'center' : 'left',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: 12
      }}>
        <img 
          src="/assets/Whatoflow_logo_W.png" 
          alt="WhatoFlow Logo" 
          style={{
            width: collapsed ? '48px' : '200px',
            height: 'auto',
            objectFit: 'contain',
            transition: 'all 0.3s ease'
          }}
        />
      </div>

      {/* 用戶資訊區域 */}
      <div style={{ 
        padding: collapsed ? '12px 8px' : '16px 16px',
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

      {/* 選單容器 - 添加滾動功能 */}
      <div 
        style={{
          height: 'calc(100vh - 200px)', // 減去 logo 和用戶資訊區域的高度
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: '4px', // 為滾動條留出空間
        }}
        className="custom-scrollbar"
      >
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          items={menuItems}
          onClick={({ key, keyPath }) => {
            console.log('Menu click:', { key, keyPath, collapsed });
            
            if (key === 'logout') {
              onLogout();
            } else if (key === 'application' || key === 'studio' || key === 'adminTools') {
              // 在收合狀態下，點擊父級菜單時展開子菜單
              if (collapsed) {
                console.log('Setting openKeys to:', [key]);
                setOpenKeys([key]);
              }
              return;
            } else {
              // keyPath 數組的最後一個元素才是實際點擊的子菜單 key
              // keyPath 格式: [父菜單key, 子菜單key] 或 [子菜單key]
              const actualKey = key; // 直接使用點擊的 key，因為這已經是子菜單的 key
              console.log('Calling onMenuSelect with:', actualKey);
              onMenuSelect(actualKey);
            }
          }}
          style={{
            border: 'none',
            background: 'transparent',
            height: '100%',
          }}
        />
      </div>

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