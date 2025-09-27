import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Button, 
  Badge, 
  Avatar, 
  Space,
  Divider,
  Tooltip,
  Spin
} from 'antd';
import { 
  RocketOutlined, 
  SettingOutlined, 
  FileTextOutlined, 
  MessageOutlined, 
  CheckCircleOutlined, 
  DatabaseOutlined,
  UserOutlined,
  PlayCircleOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  BranchesOutlined,
  ToolOutlined,
  TeamOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

const { Title, Text } = Typography;

// 統一的淺橙色配色
const colorPalette = [
  {
    name: 'unified-light-orange',
    color: '#EDE3DE',
    gradient: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)'
  },
  {
    name: 'unified-light-orange',
    color: '#EDE3DE', 
    gradient: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)'
  },
  {
    name: 'unified-light-orange',
    color: '#EDE3DE',
    gradient: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)'
  },
  {
    name: 'unified-light-orange',
    color: '#EDE3DE',
    gradient: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)'
  },
  {
    name: 'unified-light-orange',
    color: '#EDE3DE',
    gradient: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)'
  }
];

const Dashboard = ({ onMenuSelect }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    publishedWorkflows: 0,
    runningInstances: 0,
    pendingApprovals: 0,
    totalEforms: 0,
    activeEforms: 0,
    inactiveEforms: 0,
    recentEforms: 0,
    recentEformItems: [],
    whatsappTemplates: 0,
    dataSets: 0,
    totalUsers: 0,
    broadcastGroups: 0,
    activeGroups: 0,
    totalMembers: 0,
    hashtags: 0,
    activeHashtags: 0,
    hashtagUsage: 0,
    adminUsers: 0,
    totalCompanies: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 檢查是否已登入
      const token = localStorage.getItem('token');
      if (!token) {
         console.log('❌ 用戶未登入，使用模擬數據');
         setStats({
           publishedWorkflows: 3,
           runningInstances: 2,
           completed: 15,
           failed: 1,
           successRate: 94,
           averageExecutionTime: 5,
           totalEforms: 7,
           activeEforms: 5,
           inactiveEforms: 2,
           recentEforms: 3,
           recentEformItems: [
             { id: 'a4a76e58-6338-4a52-85b3-a4b2c3b7863b', name: '客戶註冊表單' },
             { id: 'e515e3af-a076-4f4d-9a4e-81fff1c67141', name: '訂單確認表單' }
           ],
          pendingApprovals: 3,
          whatsappTemplates: 8,
          whatsappTemplatesByType: {
            'Text': { count: 3 },
            'Interactive': { count: 2 },
            'Media': { count: 2 },
            'Location': { count: 1 },
            'Contact': { count: 0 }
          },
          dataSets: 4,
          totalUsers: 15,
          broadcastGroups: 5,
          activeGroups: 4,
          totalMembers: 120,
          hashtags: 12,
          activeHashtags: 10,
          hashtagUsage: 45,
          adminUsers: 3,
          totalCompanies: 2
        });
        setLoading(false);
        return;
      }

      // 設置認證標頭
      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // 載入各種統計數據 - 只調用存在的 API 端點
      const [
        instancesRes,
        templatesStatsRes,
        recentTemplatesRes,
        recentWorkflowsRes,
        recentDataSetsRes
      ] = await Promise.allSettled([
        axios.get('/api/workflowexecutions/monitor/statistics', { headers: authHeaders }),
        axios.get('/api/whatsapptemplates/statistics', { headers: authHeaders }),
        axios.get('/api/whatsapptemplates?page=1&pageSize=3&sortField=createdAt&sortOrder=desc', { headers: authHeaders }),
        axios.get('/api/workflowdefinitions?page=1&pageSize=3&sortField=createdAt&sortOrder=desc', { headers: authHeaders }),
        axios.get('/api/datasets?page=1&pageSize=3&sortField=createdAt&sortOrder=desc', { headers: authHeaders })
      ]);

      // 調試信息：打印 API 響應
      console.log('API 響應狀態:', {
        instancesRes: instancesRes.status,
        templatesStatsRes: templatesStatsRes.status,
        recentTemplatesRes: recentTemplatesRes.status,
        recentWorkflowsRes: recentWorkflowsRes.status
      });

      console.log('API 響應數據:', {
        instancesRes: instancesRes.status === 'fulfilled' ? instancesRes.value.data : instancesRes.reason,
        templatesStatsRes: templatesStatsRes.status === 'fulfilled' ? templatesStatsRes.value.data : templatesStatsRes.reason,
        recentTemplatesRes: recentTemplatesRes.status === 'fulfilled' ? recentTemplatesRes.value.data : recentTemplatesRes.reason,
        recentWorkflowsRes: recentWorkflowsRes.status === 'fulfilled' ? recentWorkflowsRes.value.data : recentWorkflowsRes.reason
      });

      // 處理工作流程統計數據
      const workflowStats = instancesRes.status === 'fulfilled' ? instancesRes.value.data : {};
      
      // 處理 WhatsApp 模板統計數據
      const templateStats = templatesStatsRes.status === 'fulfilled' ? templatesStatsRes.value.data : {};
      
      // 處理最近模板數據
      let recentWhatsAppItems = [];
      if (recentTemplatesRes.status === 'fulfilled' && recentTemplatesRes.value.data?.data) {
        recentWhatsAppItems = recentTemplatesRes.value.data.data.map(template => ({
          id: template.id,
          name: template.name
        }));
        console.log('最近 WhatsApp 模板:', recentWhatsAppItems);
      } else {
        console.log('獲取最近模板失敗，使用模擬數據');
        recentWhatsAppItems = [
          { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: '歡迎訊息模板' },
          { id: 'b2c3d4e5-f6g7-8901-bcde-f23456789012', name: '訂單確認模板' },
          { id: 'c3d4e5f6-g7h8-9012-cdef-345678901234', name: '付款通知模板' }
        ];
      }
      
      // 處理最近工作流程數據
      let recentWorkflowItems = [];
      if (recentWorkflowsRes.status === 'fulfilled' && recentWorkflowsRes.value.data?.data) {
        recentWorkflowItems = recentWorkflowsRes.value.data.data.map(workflow => ({
          id: workflow.id,
          name: workflow.name
        }));
        console.log('最近工作流程:', recentWorkflowItems);
      } else {
        console.log('獲取最近工作流程失敗，使用模擬數據');
        recentWorkflowItems = [
          { id: 'workflow-001', name: '客戶服務流程' },
          { id: 'workflow-002', name: '訂單處理流程' },
          { id: 'workflow-003', name: '付款確認流程' }
        ];
      }

      // 處理最近數據集數據
      let recentDataSetItems = [];
      if (recentDataSetsRes.status === 'fulfilled' && recentDataSetsRes.value.data?.data) {
        recentDataSetItems = recentDataSetsRes.value.data.data.map(dataset => ({
          id: dataset.id,
          name: dataset.name
        }));
        console.log('最近數據集:', recentDataSetItems);
      } else {
        console.log('獲取最近數據集失敗，使用模擬數據');
        recentDataSetItems = [
          { id: 'dataset-001', name: '客戶資料集' },
          { id: 'dataset-002', name: '產品庫存集' },
          { id: 'dataset-003', name: '銷售記錄集' }
        ];
      }
      
      // 如果 API 調用失敗，使用模擬數據
      if (instancesRes.status === 'rejected' || templatesStatsRes.status === 'rejected') {
         console.log('⚠️ API 調用失敗，使用模擬數據');
         setStats({
           publishedWorkflows: 3,
           runningInstances: 2,
           completed: 15,
           failed: 1,
           successRate: 94,
           averageExecutionTime: 5,
           totalEforms: 7,
           activeEforms: 5,
           inactiveEforms: 2,
           recentEforms: 3,
           recentEformItems: [
             { id: 'a4a76e58-6338-4a52-85b3-a4b2c3b7863b', name: '客戶註冊表單' },
             { id: 'e515e3af-a076-4f4d-9a4e-81fff1c67141', name: '訂單確認表單' }
           ],
          pendingApprovals: 3,
          whatsappTemplates: 8,
          whatsappTemplatesByType: {
            'Text': { count: 3 },
            'Interactive': { count: 2 },
            'Media': { count: 2 },
            'Location': { count: 1 },
            'Contact': { count: 0 }
          },
          dataSets: 4,
          totalUsers: 15,
          broadcastGroups: 5,
          activeGroups: 4,
          totalMembers: 120,
          hashtags: 12,
          activeHashtags: 10,
          hashtagUsage: 45,
          adminUsers: 3,
          totalCompanies: 2
        });
        setLoading(false);
        return;
      }
      
       // 處理表單相關數據（暫時使用模擬數據，等後端 API 完成）
       const eformStats = {
         active: 5,      // 模擬數據
         inactive: 2,    // 模擬數據
         recent: 3,      // 模擬數據
         recentItems: [  // 模擬數據
           { id: 'a4a76e58-6338-4a52-85b3-a4b2c3b7863b', name: '客戶註冊表單' },
           { id: 'e515e3af-a076-4f4d-9a4e-81fff1c67141', name: '訂單確認表單' }
         ]
       };

      setStats({
        // 工作流程相關
        publishedWorkflows: workflowStats.total || 0,
        runningInstances: workflowStats.running || 0,
        completed: workflowStats.completed || 0,
        failed: workflowStats.failed || 0,
        successRate: workflowStats.successRate || 0,
        averageExecutionTime: workflowStats.averageExecutionTime || 0,
        
        // 表單相關（模擬數據）
        totalEforms: eformStats.active + eformStats.inactive,
        activeEforms: eformStats.active,
        inactiveEforms: eformStats.inactive,
        recentEforms: eformStats.recent,
        recentEformItems: eformStats.recentItems,
        pendingApprovals: 3, // 模擬數據
        
        // WhatsApp 模板統計
        whatsappTemplates: templateStats.total || 0,
        whatsappTemplatesByType: templateStats.byType || {},
        recentWhatsAppItems: recentWhatsAppItems,
        
        // 工作流程統計
        recentWorkflowItems: recentWorkflowItems,
        
        // 數據集統計
        dataSets: 4, // 模擬數據
        recentDataSetItems: recentDataSetItems,
        
        // 管理工具統計
        totalUsers: 15, // 模擬數據
        broadcastGroups: 5, // 模擬數據
        activeGroups: 4, // 模擬數據
        totalMembers: 120, // 模擬數據
        hashtags: 12, // 模擬數據
        activeHashtags: 10, // 模擬數據
        hashtagUsage: 45, // 模擬數據
        adminUsers: 3, // 模擬數據
        totalCompanies: 2 // 模擬數據
      });
    } catch (error) {
      console.error('載入儀表板數據失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = (key) => {
    console.log('🧭 handleNavigation 被調用:', {
      key,
      hasOnMenuSelect: !!onMenuSelect,
      onMenuSelectType: typeof onMenuSelect
    });
    
    if (onMenuSelect) {
      console.log('✅ 調用 onMenuSelect 函數');
      onMenuSelect(key);
    } else {
      console.log('❌ onMenuSelect 函數不存在');
    }
  };

  // 新增：處理帶參數的導航函數
  const handleNavigationWithParams = (path, params = {}) => {
    console.log('🧭 handleNavigationWithParams 被調用:', { path, params });
    
    // 構建查詢參數
    const queryString = new URLSearchParams(params).toString();
    const fullPath = queryString ? `${path}?${queryString}` : path;
    
    console.log('🚀 導航到:', fullPath);
    navigate(fullPath);
  };

  const SmartButton = ({ 
    title, 
    description, 
    icon, 
    count, 
    color, 
    gradient, 
    onClick, 
    loading: buttonLoading = false,
    stats = null, // 新增統計數據參數
    recentItems = [], // 最近項目列表
    onRecentClick = null, // 最近項目點擊處理
    menuKey = null // 新增菜單鍵，用於圖標點擊跳轉
  }) => (
    <Card
      hoverable
      className="smart-button"
      style={{
        background: gradient,
        border: 'none',
        borderRadius: '16px',
        height: '240px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}
      onClick={onClick}
    >
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          zIndex: 1,
          pointerEvents: 'none'  // 添加這行，讓這個 div 不阻止點擊事件
        }} 
      />
      
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* 桌面版：圖標、標題描述、計數在同一行 */}
          <div className="smart-button-header">
            <div className="smart-button-left">
              <Avatar 
                size={48} 
                icon={icon} 
                style={{ 
                  backgroundColor: '#E8F5E8',
                  color: '#2E7D32',
                  border: '2px solid #4CAF50',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  marginRight: '12px'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('🎯 SmartButton 圖標被點擊!', {
                    title,
                    menuKey,
                    hasMenuKey: !!menuKey
                  });
                  
                  // 統一使用 handleNavigation 處理所有導航
                  if (menuKey) {
                    console.log('🚀 準備跳轉到:', menuKey);
                    handleNavigation(menuKey);
                  } else {
                    console.log('⚠️ 沒有 menuKey，使用 onClick');
                    onClick();
                  }
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#C8E6C9';
                  e.target.style.color = '#1B5E20';
                  e.target.style.borderColor = '#388E3C';
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#E8F5E8';
                  e.target.style.color = '#2E7D32';
                  e.target.style.borderColor = '#4CAF50';
                  e.target.style.transform = 'scale(1)';
                }}
              />
              <div className="smart-button-text">
                <Title level={4} style={{ color: '#333333', margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  {title}
                </Title>
                <Text style={{ color: 'rgba(0,0,0,0.7)', fontSize: '16px', margin: 0 }}>
                  {description}
                </Text>
              </div>
            </div>
            <div className="smart-button-count">
              <div style={{ 
                fontSize: '28px', 
                fontWeight: 'bold', 
                color: '#333333',
                lineHeight: 1
              }}>
                {count}
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: 'rgba(0,0,0,0.7)',
                marginTop: '2px'
              }}>
                {t('dashboard.totalCount')}
              </div>
            </div>
          </div>
        </div>
        
        {/* 詳細統計信息 */}
        {stats && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px',
            padding: '8px 12px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            backdropFilter: 'blur(5px)'
          }}>
            {Object.entries(stats).map(([key, value], index) => (
              <div key={key} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: '#333333',
                  lineHeight: 1
                }}>
                  {value}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'rgba(0,0,0,0.6)',
                  marginTop: '2px'
                }}>
                  {key}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* 最近項目快捷方式 */}
        {recentItems && recentItems.length > 0 && (
          <div style={{ 
            marginBottom: '8px',
            padding: '6px 8px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ 
              fontSize: '12px', 
              color: 'rgba(0,0,0,0.6)',
              marginBottom: '4px'
            }}>
              {t('dashboard.recentlyAdded')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {recentItems.slice(0, 2).map((item, index) => (
                <div
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRecentClick) onRecentClick(item);
                  }}
                  style={{
                    fontSize: '11px',
                    color: '#2E7D32',
                    backgroundColor: '#E8F5E8',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid #4CAF50',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#C8E6C9';
                    e.target.style.color = '#1B5E20';
                    e.target.style.borderColor = '#388E3C';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#E8F5E8';
                    e.target.style.color = '#2E7D32';
                    e.target.style.borderColor = '#4CAF50';
                  }}
                >
                  {item.name || item.title || `項目 ${index + 1}`}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {buttonLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(0,0,0,0.6)', fontSize: '13px' }}>
              {t('dashboard.loading')}
            </Text>
          </div>
        )}
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '60vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <Spin size="large" />
        <Text>{t('dashboard.loadingDashboard')}</Text>
      </div>
    );
  }

  return (
    <div className="dashboard-container">

      {/* 主要功能區域 - 左右分佈 */}
      <div className="main-sections" style={{ paddingTop: '24px' }}>
        <Row gutter={[24, 32]}>
          {/* Application 應用區域 - 左側 33% */}
          <Col xs={24} lg={8}>
            <div className="section-container left-section">
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <RocketOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                <Title level={2} style={{ margin: 0, fontSize: '24px' }}>{t('dashboard.applicationTitle')}</Title>
              </div>
              <Text style={{ color: 'rgba(0,0,0,0.7)', fontSize: '14px', marginBottom: '16px', display: 'block' }}>
                {t('dashboard.applicationDescription')}
              </Text>
      
      <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <SmartButton
                    title={t('dashboard.publishedApps')}
                    description={t('dashboard.publishedAppsDescription')}
                    icon={<RocketOutlined />}
                    menuKey="publishedApps"
                    count={stats.publishedWorkflows}
                    color={colorPalette[0].color}
                    gradient={colorPalette[0].gradient}
                    onClick={() => handleNavigation('publishedApps')}
                    stats={{
                      [t('dashboard.active')]: stats.publishedWorkflows,
                      [t('dashboard.draft')]: 0,
                      [t('dashboard.disabled')]: 0
                    }}
                  />
        </Col>
                
                <Col xs={24}>
                  <SmartButton
                    title={t('dashboard.pendingTasks')}
                    description={t('dashboard.pendingTasksDescription')}
                    icon={<ClockCircleOutlined />}
                    count={stats.pendingApprovals}
                    color={colorPalette[1].color}
                    gradient={colorPalette[1].gradient}
                    onClick={() => {
                      console.log('🎯 待處理事項按鈕被點擊');
                      navigate('/pending-tasks');
                    }}
                  />
        </Col>
                
                <Col xs={24}>
                  <SmartButton
                    title={t('dashboard.runningApps')}
                    description={t('dashboard.runningAppsDescription')}
                    icon={<SyncOutlined spin />}
                    menuKey="workflowMonitor"
                    count={stats.runningInstances}
                    color={colorPalette[2].color}
                    gradient={colorPalette[2].gradient}
                    onClick={() => handleNavigation('workflowMonitor')}
                    stats={{
                      [t('dashboard.running')]: stats.runningInstances,
                      [t('dashboard.completed')]: stats.completed || 0,
                      [t('dashboard.failed')]: stats.failed || 0
                    }}
                  />
        </Col>
                
      </Row>
            </div>
          </Col>

          {/* Studio 工作室區域 - 右側 67% */}
          <Col xs={24} lg={16}>
            <div className="section-container right-section">
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <img 
                  src="/assets/wtf_robot.gif" 
                  alt="WTF Robot" 
                  style={{
                    width: '48px',
                    height: '48px',
                    objectFit: 'contain'
                  }}
                />
                <Title level={2} style={{ margin: 0, fontSize: '24px' }}>{t('dashboard.studioTitle')}</Title>
              </div>
              <Text style={{ color: 'rgba(0,0,0,0.7)', fontSize: '14px', marginBottom: '16px', display: 'block' }}>
                {t('dashboard.studioDescription')}
              </Text>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={12}>
                  <SmartButton
                    title={t('dashboard.formManagement')}
                    description={t('dashboard.formManagementDescription')}
                    icon={<FileTextOutlined />}
                    menuKey="eformList"
                    count={stats.activeEforms || 0}
                    color={colorPalette[0].color}
                    gradient={colorPalette[0].gradient}
                    onClick={() => handleNavigation('eformList')}
                    stats={{
                      [t('dashboard.enabled')]: stats.activeEforms || 0,
                      [t('dashboard.inactive')]: stats.inactiveEforms || 0,
                      [t('dashboard.recentlyAdded')]: stats.recentEforms || 0
                    }}
                    recentItems={stats.recentEformItems || []}
                     onRecentClick={(item) => {
                       // 跳轉到表單列表頁面並自動打開編輯器
                       handleNavigationWithParams('/eform-list', { edit: item.id });
                     }}
                  />
                </Col>
                
                <Col xs={24} sm={12} lg={12}>
                  <SmartButton
                    title={t('dashboard.messageTemplates')}
                    description={t('dashboard.messageTemplatesDescription')}
                    icon={<MessageOutlined />}
                    menuKey="whatsappTemplates"
                    count={stats.whatsappTemplates}
                    color={colorPalette[1].color}
                    gradient={colorPalette[1].gradient}
                    onClick={() => handleNavigation('whatsappTemplates')}
                    stats={(() => {
                      const byType = stats.whatsappTemplatesByType || {};
                      console.log('WhatsApp 模板按類型數據:', byType);
                      console.log('總模板數:', stats.whatsappTemplates);
                      
                      const types = ['Text', 'Interactive', 'Media', 'Location', 'Contact'];
                      
                      // 如果沒有數據，顯示所有類型為 0
                      if (!byType || Object.keys(byType).length === 0) {
                        console.log('沒有模板類型數據，顯示所有類型為 0');
                        return {
                          'Text': 0,
                          'Interactive': 0,
                          'Media': 0,
                          'Location': 0,
                          'Contact': 0
                        };
                      }
                      
                      // 顯示所有有數據的類型，按數量排序，最多顯示 5 個
                      const allTypes = types
                        .filter(type => byType[type])
                        .sort((a, b) => (byType[b]?.count || 0) - (byType[a]?.count || 0))
                        .slice(0, 5);
                      
                      console.log('找到的模板類型:', allTypes);
                      
                      // 如果沒有找到任何類型，顯示所有類型為 0
                      if (allTypes.length === 0) {
                        console.log('沒有找到模板類型數據，顯示所有類型為 0');
                        return {
                          'Text': 0,
                          'Interactive': 0,
                          'Media': 0,
                          'Location': 0,
                          'Contact': 0
                        };
                      }
                      
                      const result = {};
                      allTypes.forEach((type, index) => {
                        const typeData = byType[type];
                        result[type] = typeData.count;
                      });
                      
                      console.log('最終統計結果:', result);
                      return result;
                    })()}
                    recentItems={stats.recentWhatsAppItems || []}
                    onRecentClick={(item) => {
                      // 跳轉到 WhatsApp 模板列表頁面並自動打開編輯器
                      handleNavigationWithParams('/whatsapp-templates', { edit: item.id });
                    }}
                  />
                </Col>
                
                <Col xs={24} sm={12} lg={12}>
                  <SmartButton
                    title={t('dashboard.workflowDesign')}
                    description={t('dashboard.workflowDesignDescription')}
                    icon={<BranchesOutlined />}
                    menuKey="whatsappWorkflow"
                    count={stats.publishedWorkflows}
                    color={colorPalette[2].color}
                    gradient={colorPalette[2].gradient}
                    onClick={() => handleNavigation('whatsappWorkflow')}
                    stats={{
                      [t('dashboard.published')]: stats.publishedWorkflows,
                      [t('dashboard.draft')]: stats.draftWorkflows || 0,
                      [t('dashboard.test')]: stats.testWorkflows || 0
                    }}
                    recentItems={stats.recentWorkflowItems || []}
                    onRecentClick={(item) => {
                      // 跳轉到工作流程設計頁面並自動載入工作流程
                      handleNavigationWithParams('/whatsapp-workflow', { id: item.id });
                    }}
                  />
                </Col>
                
                <Col xs={24} sm={12} lg={12}>
                  <SmartButton
                    title={t('dashboard.datasetManagement')}
                    description={t('dashboard.datasetManagementDescription')}
                    icon={<DatabaseOutlined />}
                    menuKey="dataSets"
                    count={stats.dataSets}
                    color={colorPalette[3].color}
                    gradient={colorPalette[3].gradient}
                    onClick={() => handleNavigation('dataSets')}
                    stats={{
                      [t('dashboard.totalDatasets')]: stats.dataSets,
                      [t('dashboard.active')]: stats.activeDataSets || 0,
                      [t('dashboard.error')]: stats.errorDataSets || 0
                    }}
                    recentItems={stats.recentDataSetItems || []}
                    onRecentClick={(item) => {
                      // 跳轉到數據集管理頁面並自動打開編輯器
                      handleNavigationWithParams('/data-sets', { edit: item.id });
                    }}
                  />
        </Col>
                
                
      </Row>
            </div>
        </Col>
      </Row>
      </div>

      {/* 管理工具區域 */}
      <div className="main-sections" style={{ paddingTop: '24px' }}>
        <Row gutter={[24, 32]}>
          <Col xs={24}>
            <div className="section-container">
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <SettingOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                <Title level={2} style={{ margin: 0, fontSize: '24px' }}>{t('dashboard.adminToolsTitle')}</Title>
              </div>
              <Text style={{ color: 'rgba(0,0,0,0.7)', fontSize: '14px', marginBottom: '16px', display: 'block' }}>
                {t('dashboard.adminToolsDescription')}
              </Text>
      
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                  <SmartButton
                    title={t('dashboard.contactManagement')}
                    description={t('dashboard.contactManagementDescription')}
                    icon={<UserOutlined />}
                    menuKey="contactList"
                    count={stats.totalUsers || 0}
                    color={colorPalette[0].color}
                    gradient={colorPalette[0].gradient}
                    onClick={() => handleNavigation('contactList')}
                    stats={{
                      [t('dashboard.totalContacts')]: stats.totalUsers || 0,
                      [t('dashboard.active')]: stats.activeUsers || 0,
                      [t('dashboard.inactive')]: stats.inactiveUsers || 0
                    }}
                  />
                </Col>
                
                <Col xs={24} sm={12} lg={6}>
                  <SmartButton
                    title={t('dashboard.broadcastGroups')}
                    description={t('dashboard.broadcastGroupsDescription')}
                    icon={<TeamOutlined />}
                    menuKey="broadcastGroups"
                    count={stats.broadcastGroups || 0}
                    color={colorPalette[1].color}
                    gradient={colorPalette[1].gradient}
                    onClick={() => handleNavigation('broadcastGroups')}
                    stats={{
                      [t('dashboard.totalGroups')]: stats.broadcastGroups || 0,
                      [t('dashboard.active')]: stats.activeGroups || 0,
                      [t('dashboard.members')]: stats.totalMembers || 0
                    }}
                  />
                </Col>
                
                <Col xs={24} sm={12} lg={6}>
                  <SmartButton
                    title={t('dashboard.hashtagManagement')}
                    description={t('dashboard.hashtagManagementDescription')}
                    icon={<ThunderboltOutlined />}
                    menuKey="hashtags"
                    count={stats.hashtags || 0}
                    color={colorPalette[2].color}
                    gradient={colorPalette[2].gradient}
                    onClick={() => handleNavigation('hashtags')}
                    stats={{
                      [t('dashboard.totalHashtags')]: stats.hashtags || 0,
                      [t('dashboard.active')]: stats.activeHashtags || 0,
                      [t('dashboard.usage')]: stats.hashtagUsage || 0
                    }}
                  />
                </Col>
                
                <Col xs={24} sm={12} lg={6}>
                  <SmartButton
                    title={t('dashboard.companyUserManagement')}
                    description={t('dashboard.companyUserManagementDescription')}
                    icon={<SettingOutlined />}
                    menuKey="companyUserAdmin"
                    count={stats.totalUsers || 0}
                    color={colorPalette[3].color}
                    gradient={colorPalette[3].gradient}
                    onClick={() => handleNavigation('companyUserAdmin')}
                    stats={{
                      [t('dashboard.totalUsers')]: stats.totalUsers || 0,
                      [t('dashboard.admins')]: stats.adminUsers || 0,
                      [t('dashboard.companies')]: stats.totalCompanies || 0
                    }}
                  />
                </Col>
              </Row>
            </div>
          </Col>
        </Row>
      </div>

    </div>
  );
};

export default Dashboard; 