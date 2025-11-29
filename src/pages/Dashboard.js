import React, { useEffect, useState, useRef } from 'react';
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
import ReactECharts from 'echarts-for-react';
import { getUserInterfacesFromStorage, hasInterfacePermission, expandInterfacesWithChildren } from '../utils/permissionUtils';
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

// 數字顏色編碼系統
const numberColors = {
  positive: '#7234CF',    // WhatoFlow 紫色 - 正面含義（正常、成功、活躍）
  neutral: '#fa8c16',     // 橙色 - 中性含義（運行中、待處理）
  negative: '#ff4d4f',    // 紅色 - 負面含義（失敗、錯誤、非活躍）
  warning: '#faad14',     // 黃色 - 警告含義
  success: '#52c41a'      // 綠色 - 成功含義
};

const Dashboard = ({ onMenuSelect }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [userInterfaces, setUserInterfaces] = useState([]);
  const [loadingUserInterfaces, setLoadingUserInterfaces] = useState(true);
  const [chartData, setChartData] = useState({
    messageTrend: { dates: [], totalSent: [], success: [], failed: [] },
    topWorkflows: [],
    formStatus: { pending: 0, approved: 0, rejected: 0 }
  });
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

  // 使用 ref 追蹤組件是否仍然掛載
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    // 載入用戶權限
    const loadUserInterfaces = async () => {
      setLoadingUserInterfaces(true);
      try {
        // 檢查 userInfo 是否存在且有 userId
        const userInfoStr = localStorage.getItem('userInfo');
        if (!userInfoStr) {
          console.log('Dashboard: userInfo 不存在，等待載入...');
          // 如果 userInfo 不存在，等待一下再重試
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryUserInfoStr = localStorage.getItem('userInfo');
          if (!retryUserInfoStr) {
            console.warn('Dashboard: 重試後仍然沒有 userInfo');
            if (isMountedRef.current) {
              setUserInterfaces([]);
              setLoadingUserInterfaces(false);
            }
            return;
          }
        }
        
        let userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        let userId = userInfo.user_id || userInfo.userId || userInfo.id;
        
        // 如果 userInfo 沒有 roles，可能需要等待登入流程完成
        if (!userInfo.roles || userInfo.roles.length === 0) {
          console.log('Dashboard: userInfo 沒有 roles，等待登入流程完成...');
          // 等待最多 2 秒，每 200ms 檢查一次
          let retries = 0;
          const maxRetries = 10;
          while (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const updatedUserInfoStr = localStorage.getItem('userInfo');
            if (updatedUserInfoStr) {
              const updatedUserInfo = JSON.parse(updatedUserInfoStr);
              if (updatedUserInfo.roles && updatedUserInfo.roles.length > 0) {
                console.log('Dashboard: 檢測到 roles，繼續載入權限');
                userInfo = updatedUserInfo;
                userId = userInfo.user_id || userInfo.userId || userInfo.id;
                break;
              }
            }
            retries++;
          }
        }
        
        // 確保有 userId 才繼續
        if (!userId) {
          console.warn('Dashboard: 無法獲取 userId，無法載入權限');
          if (isMountedRef.current) {
            setUserInterfaces([]);
            setLoadingUserInterfaces(false);
          }
          return;
        }
        
        // 強制從 API 獲取最新權限，不使用緩存
        const interfaces = await getUserInterfacesFromStorage(true);
        if (isMountedRef.current) {
          setUserInterfaces(interfaces);
          console.log('[Dashboard] 從 API 獲取的權限列表:', interfaces);
        }
      } catch (error) {
        console.error('載入用戶權限失敗:', error);
        if (isMountedRef.current) {
          setUserInterfaces([]);
        }
      } finally {
        if (isMountedRef.current) {
          setLoadingUserInterfaces(false);
        }
      }
    };
    
    loadUserInterfaces();
    loadDashboardData();
    
    // 清理函數：組件卸載時設置標誌
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadDashboardData = async () => {
    // 檢查組件是否仍然掛載
    if (!isMountedRef.current) {
      return;
    }
    
    setLoading(true);
    try {
      // 檢查是否已登入
      const token = localStorage.getItem('token');
      if (!token) {
         console.log('❌ 用戶未登入，使用模擬數據');
         // 檢查組件是否仍然掛載
         if (!isMountedRef.current) return;
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
          activeUsers: 12,
          inactiveUsers: 3,
          companyTotalUsers: 8,
          companyActiveUsers: 7,
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
        recentDataSetsRes,
        pendingTasksStatsRes,
        eformDefinitionsRes,
        dataSetsListRes,
        workflowDefinitionsListRes,
        contactsStatsRes,
        broadcastGroupsStatsRes,
        hashtagsStatsRes,
        companyUserStatsRes,
        messageTrendRes,
        topWorkflowsRes,
        formStatusRes
      ] = await Promise.allSettled([
        axios.get('/api/workflowexecutions/monitor/statistics', { headers: authHeaders }),
        axios.get('/api/whatsapptemplates/statistics', { headers: authHeaders }),
        axios.get('/api/whatsapptemplates?page=1&pageSize=3&sortField=createdAt&sortOrder=desc', { headers: authHeaders }),
        axios.get('/api/workflowdefinitions?page=1&pageSize=3&sortField=createdAt&sortOrder=desc', { headers: authHeaders }),
        axios.get('/api/datasets?page=1&pageSize=3&sortField=createdAt&sortOrder=desc', { headers: authHeaders }),
        axios.get('/api/eforminstances/statistics/pending', { headers: authHeaders }),
        axios.get('/api/eforms?page=1&pageSize=1000', { headers: authHeaders }),
        axios.get('/api/datasets?page=1&pageSize=1000', { headers: authHeaders }),
        axios.get('/api/workflowdefinitions?page=1&pageSize=1000', { headers: authHeaders }),
        axios.get('/api/contactlist/statistics', { headers: authHeaders }),
        axios.get('/api/contactlist/groups/statistics', { headers: authHeaders }),
        axios.get('/api/contactlist/hashtags/statistics', { headers: authHeaders }),
        axios.get('/api/companyuseradminpage/statistics', { headers: authHeaders }),
        axios.get('/api/workflowmessagesend/statistics/daily-trend?days=7', { headers: authHeaders }),
        axios.get('/api/workflowexecutions/top-workflows?limit=5', { headers: authHeaders }),
        axios.get('/api/eforminstances/statistics/by-status', { headers: authHeaders })
      ]);

      // 檢查組件是否仍然掛載
      if (!isMountedRef.current) {
        return;
      }

      // 調試信息：打印 API 響應
      console.log('API 響應狀態:', {
        instancesRes: instancesRes.status,
        templatesStatsRes: templatesStatsRes.status,
        recentTemplatesRes: recentTemplatesRes.status,
        recentWorkflowsRes: recentWorkflowsRes.status,
        pendingTasksStatsRes: pendingTasksStatsRes.status,
        eformDefinitionsRes: eformDefinitionsRes.status,
        dataSetsListRes: dataSetsListRes.status,
        workflowDefinitionsListRes: workflowDefinitionsListRes.status,
        contactsStatsRes: contactsStatsRes.status,
        broadcastGroupsStatsRes: broadcastGroupsStatsRes.status,
        hashtagsStatsRes: hashtagsStatsRes.status,
        companyUserStatsRes: companyUserStatsRes.status
      });

      console.log('API 響應數據:', {
        instancesRes: instancesRes.status === 'fulfilled' ? instancesRes.value.data : instancesRes.reason,
        templatesStatsRes: templatesStatsRes.status === 'fulfilled' ? templatesStatsRes.value.data : templatesStatsRes.reason,
        recentTemplatesRes: recentTemplatesRes.status === 'fulfilled' ? recentTemplatesRes.value.data : recentTemplatesRes.reason,
        recentWorkflowsRes: recentWorkflowsRes.status === 'fulfilled' ? recentWorkflowsRes.value.data : recentWorkflowsRes.reason,
        pendingTasksStatsRes: pendingTasksStatsRes.status === 'fulfilled' ? pendingTasksStatsRes.value.data : pendingTasksStatsRes.reason,
        eformDefinitionsRes: eformDefinitionsRes.status === 'fulfilled' ? eformDefinitionsRes.value.data : eformDefinitionsRes.reason,
        dataSetsListRes: dataSetsListRes.status === 'fulfilled' ? dataSetsListRes.value.data : dataSetsListRes.reason
      });

      // 處理工作流程統計數據
      const workflowStats = instancesRes.status === 'fulfilled' ? instancesRes.value.data : {};
      
      // 處理 WhatsApp 模板統計數據
      const templateStats = templatesStatsRes.status === 'fulfilled' ? templatesStatsRes.value.data : {};
      
      // 處理待處理任務統計數據
      const pendingTasksStats = pendingTasksStatsRes.status === 'fulfilled' ? pendingTasksStatsRes.value.data : {};
      console.log('待處理任務統計:', pendingTasksStats);
      
      // 處理工作流程定義統計數據
      const workflowDefinitionsData = workflowDefinitionsListRes.status === 'fulfilled' ? workflowDefinitionsListRes.value.data : {};
      console.log('🔄 工作流程定義 API 響應:', workflowDefinitionsData);
      
      // 調試：輸出所有工作流程的狀態值
      if (workflowDefinitionsData.data && workflowDefinitionsData.data.length > 0) {
        console.log('🔄 第一個工作流程範例:', workflowDefinitionsData.data[0]);
        console.log('🔄 所有工作流程的 status 值:', workflowDefinitionsData.data.map(w => w.status));
      }
      
      // 判斷工作流程是否為自動觸發 - 與 PublishedAppsPage.js 保持一致
      const isAutoTrigger = (workflow) => {
        try {
          if (!workflow.json) return false;
          const workflowJson = typeof workflow.json === 'string' ? JSON.parse(workflow.json) : workflow.json;
          
          if (!workflowJson.nodes) return false;
          
          // 嘗試多種可能的 start 節點類型
          const startNode = workflowJson.nodes.find(node => 
            node.type === 'start' || 
            node.type === 'Start' || 
            node.type === 'startNode' ||
            node.type === 'begin' ||
            node.type === 'input' ||
            node.id === 'start' ||
            (node.data && node.data.type === 'start')
          );
          
          if (startNode && startNode.data) {
            const activationType = startNode.data.activationType || 
                                 startNode.data.triggerType || 
                                 startNode.data.trigger;
            
            // 自動觸發類型
            if (activationType === 'webhook' || 
                activationType === 'auto' || 
                activationType === 'Auto' || 
                activationType === '自動') {
              return true;
            }
            
            // 手動觸發類型
            if (activationType === 'manual' || 
                activationType === 'Manual' || 
                activationType === '手動') {
              return false;
            }
          } else if (workflowJson.nodes.length > 0) {
            // 檢查第一個節點
            const firstNode = workflowJson.nodes[0];
            if (firstNode && firstNode.data) {
              const activationType = firstNode.data.activationType || 
                                   firstNode.data.triggerType || 
                                   firstNode.data.trigger;
              
              if (activationType === 'webhook' || 
                  activationType === 'auto' || 
                  activationType === 'Auto' || 
                  activationType === '自動') {
                return true;
              }
              
              if (activationType === 'manual' || 
                  activationType === 'Manual' || 
                  activationType === '手動') {
                return false;
              }
            }
          }
          
          // 默認為手動觸發
          return false;
        } catch (e) {
          console.error('解析工作流程觸發類型失敗:', e);
          return false;
        }
      };
      
      const enabledWorkflows = workflowDefinitionsData.data?.filter(w => w.status === 'Enabled') || [];
      
      const workflowDefinitionsStats = {
        total: workflowDefinitionsData.total || 0,
        published: enabledWorkflows.length,
        manualTrigger: enabledWorkflows.filter(w => !isAutoTrigger(w)).length,
        autoTrigger: enabledWorkflows.filter(w => isAutoTrigger(w)).length,
        disabled: workflowDefinitionsData.data?.filter(w => w.status === 'Disabled').length || 0
      };
      console.log('🔄 工作流程定義統計:', workflowDefinitionsStats);
      
      // 調試：輸出前幾個工作流程的觸發類型
      if (enabledWorkflows.length > 0) {
        console.log('🔄 工作流程觸發類型判斷:', enabledWorkflows.slice(0, 3).map(w => ({
          name: w.name,
          isAuto: isAutoTrigger(w),
          hasJson: !!w.json
        })));
      }
      
      // 處理表單定義統計數據
      console.log('🔍 eformDefinitionsRes 狀態:', eformDefinitionsRes.status);
      if (eformDefinitionsRes.status === 'rejected') {
        console.error('❌ 表單 API 調用失敗:', eformDefinitionsRes.reason);
      }
      
      const eformDefinitionsData = eformDefinitionsRes.status === 'fulfilled' ? eformDefinitionsRes.value.data : {};
      console.log('📋 表單定義 API 響應:', eformDefinitionsData);
      console.log('📋 表單 data 數組:', eformDefinitionsData.data);
      console.log('📋 表單 total:', eformDefinitionsData.total);
      
      // 檢查第一個表單的 status 值
      if (eformDefinitionsData.data && eformDefinitionsData.data.length > 0) {
        console.log('📋 第一個表單範例:', eformDefinitionsData.data[0]);
        console.log('📋 所有表單的 status 值:', eformDefinitionsData.data.map(f => f.status));
      }
      
      const eformStats = {
        total: eformDefinitionsData.total || 0,
        active: eformDefinitionsData.data?.filter(f => f.status === 'A').length || 0,
        inactive: eformDefinitionsData.data?.filter(f => f.status === 'I').length || 0,
        recentItems: eformDefinitionsData.data?.slice(0, 2).map(f => ({ id: f.id, name: f.name })) || []
      };
      console.log('📊 表單統計:', eformStats);
      
      // 處理數據集統計數據
      const dataSetsData = dataSetsListRes.status === 'fulfilled' ? dataSetsListRes.value.data : {};
      console.log('📦 數據集 API 響應:', dataSetsData);
      
      // 數據集 API 返回格式：{success: true, data: [...], pagination: {totalCount: ...}}
      const dataSetsTotal = dataSetsData.pagination?.totalCount || dataSetsData.data?.length || 0;
      const dataSetsActive = dataSetsData.data?.filter(ds => ds.status === 'Active').length || 0;
      const dataSetsError = dataSetsData.data?.filter(ds => ds.status === 'Error').length || 0;
      console.log('📊 數據集統計:', { total: dataSetsTotal, active: dataSetsActive, error: dataSetsError });
      
      // 處理聯絡人統計數據
      const contactsStats = contactsStatsRes.status === 'fulfilled' ? contactsStatsRes.value.data : {};
      console.log('👥 聯絡人統計:', contactsStats);
      
      // 處理廣播群組統計數據
      const broadcastGroupsStats = broadcastGroupsStatsRes.status === 'fulfilled' ? broadcastGroupsStatsRes.value.data : {};
      console.log('📢 廣播群組統計:', broadcastGroupsStats);
      
      // 處理標籤統計數據
      const hashtagsStats = hashtagsStatsRes.status === 'fulfilled' ? hashtagsStatsRes.value.data : {};
      console.log('🏷️ 標籤統計:', hashtagsStats);
      
      // 處理公司用戶統計數據
      const companyUserStats = companyUserStatsRes.status === 'fulfilled' ? companyUserStatsRes.value.data : {};
      console.log('🏢 公司用戶統計:', companyUserStats);
      
      // 檢查組件是否仍然掛載
      if (!isMountedRef.current) {
        return;
      }

      // 處理圖表數據
      const messageTrend = messageTrendRes.status === 'fulfilled' ? messageTrendRes.value.data : { dates: [], totalSent: [], success: [], failed: [] };
      const topWorkflows = topWorkflowsRes.status === 'fulfilled' ? topWorkflowsRes.value.data : [];
      const formStatus = formStatusRes.status === 'fulfilled' ? formStatusRes.value.data : { pending: 0, approved: 0, rejected: 0 };
      
      // 檢查組件是否仍然掛載
      if (!isMountedRef.current) {
        return;
      }
      
      setChartData({
        messageTrend,
        topWorkflows,
        formStatus
      });
      
      console.log('📊 圖表數據:', { messageTrend, topWorkflows, formStatus });
      
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
         // 檢查組件是否仍然掛載
         if (!isMountedRef.current) return;
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
          activeUsers: 12,
          inactiveUsers: 3,
          companyTotalUsers: 8,
          companyActiveUsers: 7,
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

      // 檢查組件是否仍然掛載
      if (!isMountedRef.current) {
        return;
      }

      setStats({
        // 工作流程定義相關（使用 workflowDefinitionsStats）
        publishedWorkflows: workflowDefinitionsStats.published || 0, // 只顯示 Enabled 的數量
        manualTriggerWorkflows: workflowDefinitionsStats.manualTrigger || 0,
        autoTriggerWorkflows: workflowDefinitionsStats.autoTrigger || 0,
        disabledWorkflows: workflowDefinitionsStats.disabled || 0,
        
        // 工作流程執行相關（使用 workflowStats）
        runningInstances: workflowStats.running || 0,
        completed: workflowStats.completed || 0,
        failed: workflowStats.failed || 0,
        successRate: workflowStats.successRate || 0,
        averageExecutionTime: workflowStats.averageExecutionTime || 0,
        
        // 表單相關（從 API 獲取真實數據）
        totalEforms: eformStats.total,
        activeEforms: eformStats.active,
        inactiveEforms: eformStats.inactive,
        recentEforms: eformStats.recentItems.length,
        recentEformItems: eformStats.recentItems,
        pendingApprovals: pendingTasksStats.pending || 0,
        
        // WhatsApp 模板統計
        whatsappTemplates: templateStats.total || 0,
        whatsappTemplatesByType: templateStats.byType || {},
        recentWhatsAppItems: recentWhatsAppItems,
        
        // 工作流程統計
        recentWorkflowItems: recentWorkflowItems,
        
        // 數據集統計（從 API 獲取真實數據）
        dataSets: dataSetsTotal,
        activeDataSets: dataSetsActive,
        errorDataSets: dataSetsError,
        recentDataSetItems: recentDataSetItems,
        
        // 管理工具統計（從 API 獲取真實數據）
        // Contact Management 使用聯絡人統計（contact_lists 表）
        totalUsers: contactsStats.total || 0,
        activeUsers: contactsStats.active || 0,
        inactiveUsers: contactsStats.inactive || 0,
        // Company/User Management 使用公司用戶統計（users 表）
        companyTotalUsers: companyUserStats.totalUsers || 0,
        companyActiveUsers: companyUserStats.activeUsers || 0,
        broadcastGroups: broadcastGroupsStats.totalGroups || 0,
        activeGroups: broadcastGroupsStats.activeGroups || 0,
        totalMembers: broadcastGroupsStats.totalMembers || 0,
        hashtags: hashtagsStats.totalHashtags || 0,
        activeHashtags: hashtagsStats.activeHashtags || 0,
        hashtagUsage: hashtagsStats.hashtagUsage || 0,
        adminUsers: companyUserStats.adminUsers || 0,
        totalCompanies: companyUserStats.totalCompanies || 0
      });
    } catch (error) {
      console.error('載入儀表板數據失敗:', error);
    } finally {
      // 只有在組件仍然掛載時才更新 loading 狀態
      if (isMountedRef.current) {
        setLoading(false);
      }
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
    menuKey = null, // 新增菜單鍵，用於圖標點擊跳轉
    numberColor = 'positive' // 新增數字顏色類型
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
                color: numberColors[numberColor] || numberColors.positive,
                lineHeight: 1,
                textShadow: '0 1px 2px rgba(0,0,0,0.1)'
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
            {Object.entries(stats).map(([key, value], index) => {
              // 根據統計項目的名稱判斷顏色
              const getStatColor = (statKey, statValue) => {
                const keyLower = statKey.toLowerCase();
                const valueNum = parseInt(statValue) || 0;
                
                // 負面含義的統計項目 - 紅色
                if (keyLower.includes('failed') || keyLower.includes('error') || 
                    keyLower.includes('inactive') || keyLower.includes('disabled') ||
                    keyLower.includes('draft') || keyLower.includes('停用') ||
                    keyLower.includes('錯誤') || keyLower.includes('失敗') ||
                    keyLower.includes('offline') || keyLower.includes('blocked') ||
                    keyLower.includes('suspended') || keyLower.includes('deleted') ||
                    keyLower.includes('cancelled') || keyLower.includes('rejected')) {
                  return numberColors.negative;
                }
                
                // 警告含義的統計項目
                if (keyLower.includes('pending') || keyLower.includes('warning')) {
                  return numberColors.warning;
                }
                
                // 中性含義的統計項目
                if (keyLower.includes('running') || keyLower.includes('processing')) {
                  return numberColors.neutral;
                }
                
                // 正面含義的統計項目
                if (keyLower.includes('active') || keyLower.includes('enabled') ||
                    keyLower.includes('completed') || keyLower.includes('success') ||
                    keyLower.includes('total') || keyLower.includes('published')) {
                  return numberColors.positive;
                }
                
                // 默認為正面顏色
                return numberColors.positive;
              };
              
              const statColor = getStatColor(key, value);
              
              return (
                <div key={key} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    color: statColor,
                    lineHeight: 1,
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
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
              );
            })}
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

  // 展開用戶權限（包含父子級關係）
  const expandedInterfaces = expandInterfacesWithChildren(userInterfaces);
  
  // 檢查是否有權限顯示各個區域
  const hasApplicationPermission = hasInterfacePermission(userInterfaces, 'application') || 
                                   hasInterfacePermission(userInterfaces, 'publishedApps') ||
                                   hasInterfacePermission(userInterfaces, 'pendingTasks') ||
                                   hasInterfacePermission(userInterfaces, 'workflowMonitor');
  
  const hasStudioPermission = hasInterfacePermission(userInterfaces, 'studio') ||
                              hasInterfacePermission(userInterfaces, 'eformList') ||
                              hasInterfacePermission(userInterfaces, 'whatsappTemplates') ||
                              hasInterfacePermission(userInterfaces, 'whatsappWorkflow') ||
                              hasInterfacePermission(userInterfaces, 'dataSets');
  
  const hasAdminToolsPermission = hasInterfacePermission(userInterfaces, 'adminTools') ||
                                  hasInterfacePermission(userInterfaces, 'contactList') ||
                                  hasInterfacePermission(userInterfaces, 'broadcastGroups') ||
                                  hasInterfacePermission(userInterfaces, 'hashtags') ||
                                  hasInterfacePermission(userInterfaces, 'companyUserAdmin') ||
                                  hasInterfacePermission(userInterfaces, 'phoneVerificationAdmin') ||
                                  hasInterfacePermission(userInterfaces, 'permissionManagement');
  
  // 檢查是否有任何權限（用於顯示空狀態）
  const hasAnyPermission = hasApplicationPermission || hasStudioPermission || hasAdminToolsPermission;
  
  // 計算動態佈局：根據權限決定每個區域的寬度
  // 如果兩個區域都有權限，則 Application 佔 8/24，Studio 佔 16/24
  // 如果只有一個區域有權限，則該區域佔滿全寬 24/24
  const applicationColSpan = hasApplicationPermission && hasStudioPermission ? 8 : (hasApplicationPermission ? 24 : 0);
  const studioColSpan = hasStudioPermission && hasApplicationPermission ? 16 : (hasStudioPermission ? 24 : 0);

  // 如果正在載入數據或權限，顯示 loading
  if (loading || loadingUserInterfaces) {
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
        <Text>{loadingUserInterfaces ? '正在載入權限信息...' : t('dashboard.loadingDashboard')}</Text>
      </div>
    );
  }

  // 只有在權限載入完成且確實沒有任何權限時，才顯示提示信息
  if (!loadingUserInterfaces && !hasAnyPermission) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '60vh',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px'
      }}>
        <Title level={3}>無權限訪問</Title>
        <Text type="secondary">您目前沒有任何功能權限，請聯繫管理員分配權限。</Text>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* 數據分析圖表區域 - 所有用戶都能看到 */}
      <div className="main-sections" style={{ paddingTop: '24px' }}>
        <Card
          style={{
            background: 'linear-gradient(135deg, #F9F7FC 0%, #FFF 100%)',
            border: '2px solid #F0E7FF',
            borderRadius: '24px',
            boxShadow: '0 8px 32px rgba(114, 52, 207, 0.12)',
            marginBottom: '24px'
          }}
          bodyStyle={{ padding: '32px' }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: '2px solid #F0E7FF'
          }}>
            <BarChartOutlined style={{ fontSize: '32px', color: '#7234CF' }} />
            <div>
              <Title level={3} style={{ margin: 0, fontSize: '22px', color: '#333', fontWeight: 'bold' }}>
                {t('dashboard.dataAnalysis')}
              </Title>
              <Text style={{ color: 'rgba(0,0,0,0.6)', fontSize: '14px' }}>
                {t('dashboard.dataAnalysisDescription')}
              </Text>
            </div>
          </div>
          
          <Row gutter={[16, 16]}>
            {/* 訊息趨勢圖 */}
            <Col xs={24} sm={12} lg={8}>
              <Card
                size="small"
                style={{
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  height: '280px'
                }}
                bodyStyle={{ padding: '16px', height: '100%' }}
              >
                <ReactECharts
                  option={{
                    title: { 
                      text: t('dashboard.messageTrend'),
                      left: 'center',
                      top: 2,
                      textStyle: { fontSize: 14, fontWeight: 'bold', color: '#333' }
                    },
                    grid: { left: '10%', right: '10%', top: '30%', bottom: '15%', containLabel: false },
                    xAxis: { 
                      type: 'category', 
                      data: chartData.messageTrend.dates.map(d => d.substring(5)),
                      axisLabel: { fontSize: 10, rotate: 45 }
                    },
                    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
                    tooltip: { trigger: 'axis' },
                    series: [{
                      type: 'line',
                      data: chartData.messageTrend.totalSent,
                      smooth: true,
                      lineStyle: { width: 2, color: '#7234CF' },
                      areaStyle: { 
                        color: {
                          type: 'linear',
                          x: 0, y: 0, x2: 0, y2: 1,
                          colorStops: [
                            { offset: 0, color: 'rgba(114, 52, 207, 0.3)' },
                            { offset: 1, color: 'rgba(114, 52, 207, 0.05)' }
                          ]
                        }
                      },
                      itemStyle: { color: '#7234CF' }
                    }]
                  }}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'svg' }}
                />
              </Card>
            </Col>
            
            {/* 熱門流程圖 */}
            <Col xs={24} sm={12} lg={8}>
              <Card
                size="small"
                style={{
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  height: '280px'
                }}
                bodyStyle={{ padding: '16px', height: '100%' }}
              >
                <ReactECharts
                  option={{
                    title: { 
                      text: t('dashboard.hotWorkflows'),
                      left: 'center',
                      top: 2,
                      textStyle: { fontSize: 14, fontWeight: 'bold', color: '#333' }
                    },
                    grid: { left: '15%', right: '10%', top: '30%', bottom: '5%', containLabel: true },
                    xAxis: { type: 'value', axisLabel: { fontSize: 10 } },
                    yAxis: { 
                      type: 'category', 
                      data: chartData.topWorkflows.slice(0, 3).map(w => w.workflowName.length > 10 ? w.workflowName.substring(0, 10) + '...' : w.workflowName).reverse(),
                      axisLabel: { fontSize: 10 }
                    },
                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                    series: [{
                      type: 'bar',
                      data: chartData.topWorkflows.slice(0, 3).map(w => w.executionCount).reverse(),
                      itemStyle: { color: '#7234CF', borderRadius: [0, 4, 4, 0] },
                      label: { show: true, position: 'right', fontSize: 10 }
                    }]
                  }}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'svg' }}
                />
              </Card>
            </Col>
            
            {/* 表單狀態圖 */}
            <Col xs={24} sm={12} lg={8}>
              <Card
                size="small"
                style={{
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  height: '280px'
                }}
                bodyStyle={{ padding: '16px', height: '100%' }}
              >
                <ReactECharts
                  option={{
                    title: { 
                      text: t('dashboard.formStatus'),
                      left: 'center',
                      top: 2,
                      textStyle: { fontSize: 14, fontWeight: 'bold', color: '#333' }
                    },
                    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                    legend: { 
                      orient: 'horizontal', 
                      bottom: 5, 
                      itemGap: 15, 
                      textStyle: { fontSize: 10 } 
                    },
                    series: [{
                      type: 'pie',
                      radius: ['35%', '60%'],
                      center: ['50%', '45%'],
                      data: [
                        { value: chartData.formStatus.pending, name: t('dashboard.pending'), itemStyle: { color: '#faad14' } },
                        { value: chartData.formStatus.approved, name: t('dashboard.approved'), itemStyle: { color: '#52c41a' } },
                        { value: chartData.formStatus.rejected, name: t('dashboard.rejected'), itemStyle: { color: '#ff4d4f' } }
                      ],
                      label: { 
                        fontSize: 12, 
                        formatter: '{c}',
                        position: 'outside',
                        distance: 12,
                        avoidLabelOverlap: true
                      },
                      labelLine: {
                        show: true,
                        length: 12,
                        length2: 8,
                        smooth: true
                      },
                      emphasis: {
                        itemStyle: {
                          shadowBlur: 10,
                          shadowOffsetX: 0,
                          shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                      }
                    }]
                  }}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'svg' }}
                />
              </Card>
            </Col>
          </Row>
        </Card>
      </div>

      {/* 主要功能區域 - 左右分佈 */}
      {(hasApplicationPermission || hasStudioPermission) && (
      <div className="main-sections" style={{ paddingTop: '24px' }}>
        <Row gutter={[24, 32]}>
          {/* Application 應用區域 - 動態寬度 */}
          {hasApplicationPermission && (
          <Col xs={24} lg={applicationColSpan}>
            <div className="section-container left-section">
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <RocketOutlined style={{ fontSize: '32px', color: '#7234CF' }} />
                <Title level={2} style={{ margin: 0, fontSize: '24px' }}>{t('dashboard.applicationTitle')}</Title>
              </div>
              <Text style={{ color: 'rgba(0,0,0,0.7)', fontSize: '14px', marginBottom: '16px', display: 'block' }}>
                {t('dashboard.applicationDescription')}
              </Text>
      
      <Row gutter={[16, 16]}>
                {hasInterfacePermission(userInterfaces, 'publishedApps') && (
                <Col xs={24}>
                  <SmartButton
                    title={t('dashboard.publishedApps')}
                    description={t('dashboard.publishedAppsDescription')}
                    icon={<RocketOutlined />}
                    menuKey="publishedApps"
                    count={stats.publishedWorkflows}
                    color={colorPalette[0].color}
                    gradient={colorPalette[0].gradient}
                    numberColor="positive"
                    onClick={() => handleNavigation('publishedApps')}
                    stats={{
                      ['Manual Trigger']: stats.manualTriggerWorkflows || 0,
                      ['Auto Trigger']: stats.autoTriggerWorkflows || 0
                    }}
                  />
        </Col>
                )}
                
                {hasInterfacePermission(userInterfaces, 'pendingTasks') && (
                <Col xs={24}>
                  <SmartButton
                    title={t('dashboard.pendingTasks')}
                    description={t('dashboard.pendingTasksDescription')}
                    icon={<ClockCircleOutlined />}
                    count={stats.pendingApprovals}
                    color={colorPalette[1].color}
                    gradient={colorPalette[1].gradient}
                    numberColor="warning"
                    onClick={() => {
                      console.log('🎯 待處理事項按鈕被點擊');
                      navigate('/pending-tasks');
                    }}
                  />
        </Col>
                )}
                
                {hasInterfacePermission(userInterfaces, 'workflowMonitor') && (
                <Col xs={24}>
                  <SmartButton
                    title={t('dashboard.runningApps')}
                    description={t('dashboard.runningAppsDescription')}
                    icon={<SyncOutlined spin />}
                    menuKey="workflowMonitor"
                    count={stats.runningInstances}
                    color={colorPalette[2].color}
                    gradient={colorPalette[2].gradient}
                    numberColor="neutral"
                    onClick={() => handleNavigation('workflowMonitor')}
                    stats={{
                      [t('dashboard.running')]: stats.runningInstances,
                      [t('dashboard.completed')]: stats.completed || 0,
                      [t('dashboard.failed')]: stats.failed || 0
                    }}
                  />
        </Col>
                )}
                
      </Row>
            </div>
          </Col>
          )}

          {/* Studio 工作室區域 - 動態寬度 */}
          {hasStudioPermission && (
          <Col xs={24} lg={studioColSpan}>
            {/* Studio 功能區域 - 獨立 Card */}
            <Card
              style={{
                background: '#F9F7FC',
                border: '1px solid #F9F7FC',
                borderRadius: '24px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
              }}
              bodyStyle={{ padding: '32px' }}
            >
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
                {hasInterfacePermission(userInterfaces, 'dataSets') && (
                <Col xs={24} sm={12} lg={12}>
                  <SmartButton
                    title={t('dashboard.datasetManagement')}
                    description={t('dashboard.datasetManagementDescription')}
                    icon={<DatabaseOutlined />}
                    menuKey="dataSets"
                    count={stats.dataSets}
                    color={colorPalette[3].color}
                    gradient={colorPalette[3].gradient}
                    numberColor="positive"
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
                )}
                
        {hasInterfacePermission(userInterfaces, 'eformList') && (
        <Col xs={24} sm={12} lg={12}>
                  <SmartButton
                    title={t('dashboard.formManagement')}
                    description={t('dashboard.formManagementDescription')}
                    icon={<FileTextOutlined />}
                    menuKey="eformList"
                    count={stats.activeEforms || 0}
                    color={colorPalette[0].color}
                    gradient={colorPalette[0].gradient}
                    numberColor="positive"
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
        )}
                
                {hasInterfacePermission(userInterfaces, 'whatsappTemplates') && (
                <Col xs={24} sm={12} lg={12}>
                  <SmartButton
                    title={t('dashboard.messageTemplates')}
                    description={t('dashboard.messageTemplatesDescription')}
                    icon={<MessageOutlined />}
                    menuKey="whatsappTemplates"
                    count={stats.whatsappTemplates}
                    color={colorPalette[1].color}
                    gradient={colorPalette[1].gradient}
                    numberColor="positive"
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
                )}
                
                {hasInterfacePermission(userInterfaces, 'whatsappWorkflow') && (
                <Col xs={24} sm={12} lg={12}>
                  <SmartButton
                    title={t('dashboard.workflowDesign')}
                    description={t('dashboard.workflowDesignDescription')}
                    icon={<BranchesOutlined />}
                    menuKey="whatsappWorkflow"
                    count={stats.publishedWorkflows}
                    color={colorPalette[2].color}
                    gradient={colorPalette[2].gradient}
                    numberColor="positive"
                    onClick={() => handleNavigation('whatsappWorkflow')}
                    stats={{
                      ['Manual Trigger']: stats.manualTriggerWorkflows || 0,
                      ['Auto Trigger']: stats.autoTriggerWorkflows || 0
                    }}
                    recentItems={stats.recentWorkflowItems || []}
                    onRecentClick={(item) => {
                      // 跳轉到工作流程設計頁面並自動載入工作流程
                      handleNavigationWithParams('/whatsapp-workflow', { id: item.id });
                    }}
                  />
                </Col>
                )}
                
                
      </Row>
            </Card>
        </Col>
          )}
      </Row>
      </div>
      )}

      {/* 管理工具區域 */}
      {hasAdminToolsPermission && (
      <div className="main-sections" style={{ paddingTop: '24px' }}>
        <Row gutter={[24, 32]}>
          <Col xs={24}>
            <div className="section-container">
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <SettingOutlined style={{ fontSize: '32px', color: '#7234CF' }} />
                <Title level={2} style={{ margin: 0, fontSize: '24px' }}>{t('dashboard.adminToolsTitle')}</Title>
              </div>
              <Text style={{ color: 'rgba(0,0,0,0.7)', fontSize: '14px', marginBottom: '16px', display: 'block' }}>
                {t('dashboard.adminToolsDescription')}
              </Text>
      
              <Row gutter={[16, 16]}>
                {hasInterfacePermission(userInterfaces, 'contactList') && (
                <Col xs={24} sm={12} lg={8}>
                  <SmartButton
                    title={t('dashboard.contactManagement')}
                    description={t('dashboard.contactManagementDescription')}
                    icon={<UserOutlined />}
                    menuKey="contactList"
                    count={stats.totalUsers || 0}
                    color={colorPalette[0].color}
                    gradient={colorPalette[0].gradient}
                    numberColor="positive"
                    onClick={() => handleNavigation('contactList')}
                    stats={{
                      [t('dashboard.totalContacts')]: stats.totalUsers || 0,
                      [t('dashboard.active')]: stats.activeUsers || 0,
                      [t('dashboard.inactive')]: stats.inactiveUsers || 0
                    }}
                  />
                </Col>
                )}
                
                {hasInterfacePermission(userInterfaces, 'broadcastGroups') && (
                <Col xs={24} sm={12} lg={8}>
                  <SmartButton
                    title={t('dashboard.broadcastGroups')}
                    description={t('dashboard.broadcastGroupsDescription')}
                    icon={<TeamOutlined />}
                    menuKey="broadcastGroups"
                    count={stats.broadcastGroups || 0}
                    color={colorPalette[1].color}
                    gradient={colorPalette[1].gradient}
                    numberColor="positive"
                    onClick={() => handleNavigation('broadcastGroups')}
                    stats={{
                      [t('dashboard.totalGroups')]: stats.broadcastGroups || 0,
                      [t('dashboard.active')]: stats.activeGroups || 0,
                      [t('dashboard.totalMembers')]: stats.totalMembers || 0
                    }}
                  />
                </Col>
                )}
                
                {hasInterfacePermission(userInterfaces, 'hashtags') && (
                <Col xs={24} sm={12} lg={8}>
                  <SmartButton
                    title={t('dashboard.hashtagManagement')}
                    description={t('dashboard.hashtagManagementDescription')}
                    icon={<ThunderboltOutlined />}
                    menuKey="hashtags"
                    count={stats.hashtags || 0}
                    color={colorPalette[2].color}
                    gradient={colorPalette[2].gradient}
                    numberColor="positive"
                    onClick={() => handleNavigation('hashtags')}
                    stats={{
                      [t('dashboard.totalHashtags')]: stats.hashtags || 0,
                      [t('dashboard.active')]: stats.activeHashtags || 0,
                      [t('dashboard.hashtagUsage')]: stats.hashtagUsage || 0
                    }}
                  />
                </Col>
                )}
                
                {hasInterfacePermission(userInterfaces, 'companyUserAdmin') && (
                <Col xs={24} sm={12} lg={8}>
                  <SmartButton
                    title={t('dashboard.companyUserManagement')}
                    description={t('dashboard.companyUserManagementDescription')}
                    icon={<SettingOutlined />}
                    menuKey="companyUserAdmin"
                    count={stats.companyTotalUsers || 0}
                    color={colorPalette[3].color}
                    gradient={colorPalette[3].gradient}
                    numberColor="positive"
                    onClick={() => handleNavigation('companyUserAdmin')}
                    stats={{
                      [t('dashboard.totalUsers')]: stats.companyTotalUsers || 0,
                      [t('dashboard.admins')]: stats.adminUsers || 0,
                      [t('dashboard.totalCompanies')]: stats.totalCompanies || 0
                    }}
                  />
                </Col>
                )}
              </Row>
            </div>
          </Col>
        </Row>
      </div>
      )}

    </div>
  );
};

export default Dashboard; 