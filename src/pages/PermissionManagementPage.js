import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Table, 
  Button, 
  Card, 
  Tag, 
  Modal, 
  message, 
  Space, 
  Typography, 
  Row, 
  Col,
  Select,
  Checkbox,
  Tooltip,
  Pagination,
  Spin,
  Tabs
} from 'antd';
import { 
  ReloadOutlined, 
  EditOutlined, 
  SaveOutlined,
  CloseOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { useLanguage } from '../contexts/LanguageContext';
import { canAccessPermissionManagement, INTERFACE_HIERARCHY } from '../utils/permissionUtils';

const { Title, Text } = Typography;
const { Option } = Select;

// ResizableTitle 組件
const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[30, 0]}
      handle={
        <span
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px', cursor: 'col-resize', zIndex: 1, userSelect: 'none' }}
          onClick={e => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ position: 'relative' }} />
    </Resizable>
  );
};

const PermissionManagementPage = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [availableInterfaces, setAvailableInterfaces] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({}); // { roleId: { companyId: [interfaceKeys] } }
  const [selectedCompanyId, setSelectedCompanyId] = useState(null); // null 表示系統默認
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editingPermissions, setEditingPermissions] = useState([]);
  const [saving, setSaving] = useState(false);

  // 獲取用戶信息
  const getUserInfo = () => {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}');
    } catch (e) {
      console.error('解析 userInfo 失敗:', e);
      return {};
    }
  };

  const [userInfo, setUserInfoState] = useState(() => getUserInfo());
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);
  const isTenantAdmin = userInfo.roles?.some(role => 
    (typeof role === 'string' ? role : role.name) === 'Tenant_Admin'
  );
  const userCompanyId = userInfo.company_id || userInfo.companyId || userInfo.companyID;

  // 如果 userInfo 沒有 roles，嘗試從 API 重新獲取
  useEffect(() => {
    const fetchUserInfo = async () => {
      const currentUserInfo = getUserInfo();
      if (!currentUserInfo.roles || currentUserInfo.roles.length === 0) {
        setLoadingUserInfo(true);
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            setLoadingUserInfo(false);
            return;
          }
          
          const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.ok) {
            const userData = await response.json();
            const updatedUserInfo = {
              ...currentUserInfo,
              ...userData,
              company_id: userData.company_id || currentUserInfo.company_id || currentUserInfo.companyId || currentUserInfo.companyID,
              roles: userData.roles || []
            };
            setUserInfoState(updatedUserInfo);
            localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
            console.log('已更新 userInfo，包含 roles:', updatedUserInfo);
            
            // 如果用戶是 Company_Admin（不是 Tenant_Admin），自動設置為他們的公司
            const isTenantAdminUser = updatedUserInfo.roles?.some(role => 
              (typeof role === 'string' ? role : role.name) === 'Tenant_Admin'
            );
            console.log(`[PermissionManagement] 檢查用戶角色，isTenantAdminUser: ${isTenantAdminUser}, company_id: ${updatedUserInfo.company_id}`);
            if (!isTenantAdminUser && updatedUserInfo.company_id) {
              console.log(`[PermissionManagement] 設置 selectedCompanyId 為: ${updatedUserInfo.company_id}`);
              setSelectedCompanyId(updatedUserInfo.company_id);
            }
          }
        } catch (error) {
          console.error('獲取用戶信息失敗:', error);
        } finally {
          setLoadingUserInfo(false);
        }
      } else {
        // 如果已經有 userInfo，也要檢查是否需要設置公司 ID
        const isTenantAdminUser = currentUserInfo.roles?.some(role => 
          (typeof role === 'string' ? role : role.name) === 'Tenant_Admin'
        );
        if (!isTenantAdminUser && currentUserInfo.company_id && !selectedCompanyId) {
          setSelectedCompanyId(currentUserInfo.company_id);
          console.log('Company_Admin 用戶，自動設置公司 ID:', currentUserInfo.company_id);
        }
      }
    };
    
    fetchUserInfo();
  }, []); // 只在組件掛載時執行一次

  // 載入角色列表
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('請先登入');
        return;
      }
      const response = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setRoles(data || []);
    } catch (error) {
      console.error('載入角色失敗:', error);
      message.error(`載入角色失敗: ${error.message}`);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  // 載入公司列表
  // Tenant_Admin 可以看到所有公司，Company_Admin 只能看到自己的公司
  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/companies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      let companiesList = [];
      
      // 如果是 Company_Admin，只顯示自己的公司
      if (!isTenantAdmin && userCompanyId) {
        companiesList = data.filter(c => c.id === userCompanyId);
        setCompanies(companiesList);
        // Company_Admin 自動設置為自己的公司
        if (companiesList.length > 0 && !selectedCompanyId) {
          console.log(`[PermissionManagement] Company_Admin 自動設置公司 ID: ${companiesList[0].id}`);
          setSelectedCompanyId(companiesList[0].id);
        }
      } else {
        // Tenant_Admin 可以看到所有公司
        companiesList = data;
        setCompanies(companiesList);
        // Tenant_Admin 如果有公司列表且 selectedCompanyId 為 null，自動選擇第一個公司
        if (companiesList.length > 0 && selectedCompanyId === null) {
          console.log(`[PermissionManagement] Tenant_Admin 自動設置第一個公司 ID: ${companiesList[0].id}`);
          setSelectedCompanyId(companiesList[0].id);
        }
      }
    } catch (error) {
      console.error('[PermissionManagement] 載入公司列表失敗:', error);
    }
  };

  const translateInterfaceLabel = useCallback((key, defaultLabel = '') => {
    if (!key) {
      return typeof defaultLabel === 'string' || typeof defaultLabel === 'number'
        ? String(defaultLabel)
        : '';
    }

    const normalizedKey = String(key).trim();
    const lowerKey = normalizedKey.toLowerCase();
    const safeDefaultLabel = typeof defaultLabel === 'string' || typeof defaultLabel === 'number'
      ? String(defaultLabel)
      : '';
    const keySegments = normalizedKey.split('.');
    const lowerSegments = lowerKey.split('.');

    const candidatePaths = [
      normalizedKey,
      lowerKey,
      `menu.${normalizedKey}`,
      `menu.${lowerKey}`,
      `permissionManagement.${normalizedKey}`,
      `permissionManagement.${lowerKey}`,
      keySegments.length > 1 ? `${keySegments[0]}.${keySegments.slice(1).join('.')}` : null,
      keySegments.length > 1 ? `${keySegments[0]}.${lowerSegments.slice(1).join('.')}` : null,
      keySegments.length > 1 ? `${lowerSegments[0]}.${keySegments.slice(1).join('.')}` : null,
      keySegments.length > 1 ? `${lowerSegments[0]}.${lowerSegments.slice(1).join('.')}` : null,
      keySegments.length > 1 ? `${keySegments[0]}.${keySegments[keySegments.length - 1]}` : null,
      keySegments.length > 1 ? `${keySegments[0]}.${lowerSegments[lowerSegments.length - 1]}` : null,
      keySegments.length > 1 ? `${lowerSegments[0]}.${keySegments[keySegments.length - 1]}` : null,
      keySegments.length > 1 ? `${lowerSegments[0]}.${lowerSegments[lowerSegments.length - 1]}` : null
    ].filter(Boolean);

    const translatePath = (path) => {
      const translated = t(path);
      if (
        translated &&
        translated !== path &&
        (typeof translated === 'string' || typeof translated === 'number')
      ) {
        return translated;
      }
      return null;
    };

    for (const path of candidatePaths) {
      const translated = translatePath(path);
      if (translated) {
        return translated;
      }
    }

    const fallbackTranslate = (path, defaultValue) => translatePath(path) || defaultValue;

    switch (lowerKey) {
      case 'dashboard': return fallbackTranslate('menu.dashboard', 'Dashboard');
      case 'application': return fallbackTranslate('menu.application', 'Application');
      case 'publishedapps': return fallbackTranslate('menu.publishedApps', 'Published Apps');
      case 'pendingtasks': return fallbackTranslate('menu.pendingTasks', 'Pending Tasks');
      case 'workflowmonitor': return fallbackTranslate('menu.workflowMonitor', 'Workflow Monitor');
      case 'workflowmonitor.whatsappchat': return fallbackTranslate('workflowMonitor.whatsappChat', 'WhatsApp Chat');
      case 'workflowmonitor.pause': return fallbackTranslate('workflowMonitor.pause', 'Pause');
      case 'workflowmonitor.resume': return fallbackTranslate('workflowMonitor.resume', 'Resume');
      case 'workflowmonitor.retry': return fallbackTranslate('workflowMonitor.retry', 'Retry');
      case 'workflowmonitor.cancel': return fallbackTranslate('workflowMonitor.cancel', 'Cancel');
      case 'workflowmonitor.delete': return fallbackTranslate('workflowMonitor.delete', 'Delete');
      case 'reports': return fallbackTranslate('menu.reports', 'Reports');
      case 'reports.daily': return fallbackTranslate('menu.dailyReports', 'Daily Reports');
      case 'reports.daily.pendingoverview': return fallbackTranslate('reports.daily.pendingOverview', 'Pending Tasks Overview');
      case 'reports.daily.workflowexecution': return fallbackTranslate('reports.daily.workflowExecution', 'Workflow Execution Daily');
      case 'reports.daily.formefficiency': return fallbackTranslate('reports.daily.formEfficiency', 'Form Processing Efficiency');
      case 'reports.daily.workflowhealth': return fallbackTranslate('reports.daily.workflowHealth', 'Workflow Health Monitor');
      case 'reports.daily.whatsappinteraction': return fallbackTranslate('reports.daily.whatsappInteraction', 'WhatsApp Interaction Analysis');
      case 'reports.monthly': return fallbackTranslate('menu.monthlyReports', 'Monthly Reports');
      case 'reports.monthly.workflowperformance': return fallbackTranslate('reports.monthly.workflowPerformance', 'Workflow Performance Monthly');
      case 'reports.monthly.formapproval': return fallbackTranslate('reports.monthly.formApproval', 'Form Approval Analysis Monthly');
      case 'reports.monthly.businessinsights': return fallbackTranslate('reports.monthly.businessInsights', 'Business Process Insights');
      case 'reports.monthly.systemusage': return fallbackTranslate('reports.monthly.systemUsage', 'System Usage Statistics');
      case 'reports.monthly.operationaloverview': return fallbackTranslate('reports.monthly.operationalOverview', 'Operational Performance Overview');
      case 'reports.monthly.processstepexecution': return fallbackTranslate('reports.monthly.processStepExecution', 'Process Step Execution Analysis');
      case 'reports.realtime': return fallbackTranslate('menu.realtimeReports', 'Realtime Reports');
      case 'reports.realtime.workflowactivity': return fallbackTranslate('reports.realtime.workflowActivity', 'Workflow Activity Kanban');
      case 'admintools': return fallbackTranslate('menu.adminTools', 'Admin Tools');
      case 'contactlist': return fallbackTranslate('menu.contactList', 'Contact Management');
      case 'broadcastgroups': return fallbackTranslate('menu.broadcastGroups', 'Broadcast Group Management');
      case 'hashtags': return fallbackTranslate('menu.hashtags', 'Hashtag Management');
      case 'companyuseradmin': return fallbackTranslate('menu.companyUserAdmin', 'Company/User Management');
      case 'permissionmanagement': return fallbackTranslate('menu.permissionManagement', 'Permission Management');
      case 'apiproviders': return fallbackTranslate('menu.apiProviders', 'API Providers');
      case 'phoneverificationadmin': return fallbackTranslate('menu.phoneVerificationAdmin', 'WhatsApp Phone Verification');
      default:
        return safeDefaultLabel || normalizedKey;
    }
  }, [t]);

  // 載入可用介面列表
  const fetchAvailableInterfaces = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('無法載入介面列表：未登入');
        return;
      }
      const response = await fetch('/api/permissions/interfaces', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      const interfaces = Array.isArray(data) ? [...data] : [];

      const ensureOrUpdateInterface = (list, key) => {
        const translatedLabel = translateInterfaceLabel(key);
        const existing = list.find(item => item.key === key);
        if (existing) {
          existing.label = translatedLabel;
          return existing;
        }

        const newItem = {
          key,
          label: translatedLabel,
          description: ''
        };
        list.push(newItem);
        return newItem;
      };

      const interfaceKeysToEnsure = [
        'dashboard',
        'application',
        'publishedApps',
        'pendingTasks',
        'workflowMonitor',
        'workflowMonitor.whatsappChat',
        'workflowMonitor.pause',
        'workflowMonitor.resume',
        'workflowMonitor.retry',
        'workflowMonitor.cancel',
        'workflowMonitor.delete',
        'studio',
        'eformList',
        'whatsappTemplates',
        'whatsappWorkflow',
        'dataSets',
        'reports',
        'reports.daily',
        'reports.daily.pendingOverview',
        'reports.daily.workflowExecution',
        'reports.daily.formEfficiency',
        'reports.daily.workflowHealth',
        'reports.daily.whatsappInteraction',
        'reports.monthly',
        'reports.monthly.workflowPerformance',
        'reports.monthly.formApproval',
        'reports.monthly.businessInsights',
        'reports.monthly.systemUsage',
        'reports.monthly.operationalOverview',
        'reports.monthly.processStepExecution',
        'reports.realtime',
        'reports.realtime.workflowActivity',
        'adminTools',
        'contactList',
        'broadcastGroups',
        'hashtags',
        'companyUserAdmin',
        'permissionManagement',
        'apiProviders',
        'phoneVerificationAdmin'
      ];

      interfaceKeysToEnsure.forEach(key => ensureOrUpdateInterface(interfaces, key));

      setAvailableInterfaces(interfaces);
    } catch (error) {
      console.error('載入介面列表失敗:', error);
      message.error(`載入介面列表失敗: ${error.message}`);
      setAvailableInterfaces([]);
    }
  };

  // 載入角色的權限
  const fetchRolePermissions = async (roleId, companyId = null) => {
    try {
      const token = localStorage.getItem('token');
      // 確保 companyId 正確傳遞（即使是 null，也要明確傳遞以區分系統默認和公司權限）
      const url = `/api/permissions/role/${roleId}${companyId !== null && companyId !== undefined ? `?companyId=${companyId}` : ''}`;
      console.log(`[PermissionManagement] 查詢角色 ${roleId} 的權限，CompanyId: ${companyId}, URL: ${url}`);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      console.log(`[PermissionManagement] 角色 ${roleId} 的權限查詢結果:`, data);
      return data.interfaces || [];
    } catch (error) {
      console.error(`[PermissionManagement] 載入角色 ${roleId} 權限失敗:`, error);
      return [];
    }
  };

  // 載入所有角色的權限
  const loadAllRolePermissions = async () => {
    console.log(`[PermissionManagement] 開始載入所有角色的權限，selectedCompanyId: ${selectedCompanyId}`);
    const permissions = {};
    for (const role of roles) {
      const companyId = selectedCompanyId;
      console.log(`[PermissionManagement] 載入角色 ${role.id} (${role.name}) 的權限，CompanyId: ${companyId}`);
      const interfaces = await fetchRolePermissions(role.id, companyId);
      console.log(`[PermissionManagement] 角色 ${role.id} 的權限列表:`, interfaces);
      if (!permissions[role.id]) {
        permissions[role.id] = {};
      }
      permissions[role.id][companyId || 'default'] = interfaces;
    }
    console.log(`[PermissionManagement] 所有角色的權限載入完成:`, permissions);
    setRolePermissions(permissions);
  };

  // 初始化載入
  useEffect(() => {
    try {
      fetchRoles();
      fetchAvailableInterfaces();
    } catch (error) {
      console.error('PermissionManagementPage 初始化錯誤:', error);
      message.error('載入權限管理頁面失敗');
    }
  }, []);

  useEffect(() => {
    setAvailableInterfaces(prev => prev.map(iface => ({
      ...iface,
      label: translateInterfaceLabel(iface.key, iface.label)
    })));
  }, [translateInterfaceLabel]);

  // 當 userInfo 更新後，載入公司列表
  useEffect(() => {
    if (userInfo && (userInfo.roles || userInfo.company_id)) {
      fetchCompanies();
    }
  }, [userInfo, isTenantAdmin, userCompanyId]);

  // 當角色或選中的公司改變時，重新載入權限
  useEffect(() => {
    console.log(`[PermissionManagement] useEffect 觸發，roles.length: ${roles.length}, selectedCompanyId: ${selectedCompanyId}`);
    if (roles.length > 0) {
      try {
        loadAllRolePermissions();
      } catch (error) {
        console.error('[PermissionManagement] 載入角色權限錯誤:', error);
        message.error('載入角色權限失敗');
      }
    }
  }, [roles, selectedCompanyId]);

  // 開始編輯
  const handleEdit = (roleId) => {
    const companyKey = selectedCompanyId || 'default';
    console.log(`[PermissionManagement] 開始編輯角色 ${roleId}，selectedCompanyId: ${selectedCompanyId}, companyKey: ${companyKey}`);
    console.log(`[PermissionManagement] rolePermissions:`, rolePermissions);
    console.log(`[PermissionManagement] rolePermissions[${roleId}]:`, rolePermissions[roleId]);
    const currentPermissions = rolePermissions[roleId]?.[companyKey] || [];
    console.log(`[PermissionManagement] 當前權限列表:`, currentPermissions);
    setEditingRoleId(roleId);
    setEditingPermissions([...currentPermissions]);
  };

  // 取消編輯
  const handleCancelEdit = () => {
    setEditingRoleId(null);
    setEditingPermissions([]);
  };

  // 保存權限
  const handleSave = async (roleId) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const requestBody = {
        companyId: selectedCompanyId,
        interfaceKeys: editingPermissions
      };
      console.log(`[PermissionManagement] 保存角色 ${roleId} 的權限:`, requestBody);
      console.log(`[PermissionManagement] selectedCompanyId: ${selectedCompanyId}`);
      console.log(`[PermissionManagement] editingPermissions:`, editingPermissions);
      
      const response = await fetch(`/api/permissions/role/${roleId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PermissionManagement] 保存權限失敗，HTTP ${response.status}:`, errorText);
        throw new Error('保存失敗');
      }

      const result = await response.json();
      console.log(`[PermissionManagement] 保存權限成功:`, result);
      message.success('權限保存成功');
      setEditingRoleId(null);
      setEditingPermissions([]);
      await loadAllRolePermissions();
    } catch (error) {
      console.error('[PermissionManagement] 保存權限失敗:', error);
      message.error('保存權限失敗');
    } finally {
      setSaving(false);
    }
  };

  // 切換介面權限
  const handleToggleInterface = (interfaceKey) => {
    if (editingPermissions.includes(interfaceKey)) {
      setEditingPermissions(editingPermissions.filter(key => key !== interfaceKey));
    } else {
      setEditingPermissions([...editingPermissions, interfaceKey]);
    }
  };

  const interfaceTree = useMemo(() => {
    const interfaceMap = new Map();
    availableInterfaces.forEach(iface => {
      interfaceMap.set(iface.key, iface);
    });

    const visitedGlobal = new Set();

    const buildNode = (key, path = []) => {
      if (path.includes(key)) {
        return null;
      }
      const iface = interfaceMap.get(key) || {
        key,
        label: key,
        description: ''
      };
      const childKeys = INTERFACE_HIERARCHY[key] || [];
      const children = childKeys
        .map(childKey => buildNode(childKey, [...path, key]))
        .filter(Boolean);
      return { iface, children };
    };

    const allChildKeys = new Set();
    Object.values(INTERFACE_HIERARCHY).forEach(childArr => {
      childArr.forEach(key => allChildKeys.add(key));
    });

    const preferredOrder = ['dashboard', 'application', 'studio', 'reports', 'adminTools'];
    const rootKeysSet = new Set();
    availableInterfaces.forEach(iface => {
      if (!allChildKeys.has(iface.key)) {
        rootKeysSet.add(iface.key);
      }
    });

    const orderedRoots = [];
    preferredOrder.forEach(key => {
      if (rootKeysSet.has(key)) {
        const node = buildNode(key);
        if (node) {
          orderedRoots.push(node);
        }
        rootKeysSet.delete(key);
      }
    });

    rootKeysSet.forEach(key => {
      const node = buildNode(key);
      if (node) {
        orderedRoots.push(node);
      }
    });

    return orderedRoots;
  }, [availableInterfaces]);

  const renderInterfaceNode = (node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    return (
      <div key={node.iface.key} style={{ marginTop: level === 0 ? 0 : 8 }}>
        <Checkbox
          checked={editingPermissions.includes(node.iface.key)}
          onChange={() => handleToggleInterface(node.iface.key)}
          style={{
            fontWeight: level === 0 ? 600 : 400,
            marginLeft: level * 20
          }}
        >
          {node.iface.label}
        </Checkbox>
        {hasChildren && (
          <div>
            {node.children.map(child => renderInterfaceNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // 表格列定義
  const columns = [
    {
      title: t('permissionManagement.roleName'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, record) => (
        <Space>
          <SafetyOutlined />
          <span>{text}</span>
          {record.isSystemRole && <Tag color="blue">系統角色</Tag>}
        </Space>
      ),
    },
    {
      title: t('permissionManagement.description'),
      dataIndex: 'description',
      key: 'description',
      width: 300,
    },
    {
      title: t('permissionManagement.interfaces'),
      key: 'interfaces',
      width: 400,
      render: (_, record) => {
        const companyKey = selectedCompanyId || 'default';
        const permissions = rolePermissions[record.id]?.[companyKey] || [];
        
        if (editingRoleId === record.id) {
          // 編輯模式
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {interfaceTree.length > 0 ? (
                interfaceTree.map(node => renderInterfaceNode(node))
              ) : (
                availableInterfaces.map(iface => (
                  <Checkbox
                    key={iface.key}
                    checked={editingPermissions.includes(iface.key)}
                    onChange={() => handleToggleInterface(iface.key)}
                  >
                    {iface.label}
                  </Checkbox>
                ))
              )}
            </div>
          );
        } else {
          // 顯示模式
          if (permissions.length === 0) {
            return <Tag color="default">無權限</Tag>;
          }
          return (
            <Space wrap>
              {permissions.map(key => {
                const iface = availableInterfaces.find(i => i.key === key);
                return (
                  <Tag key={key} color="green">
                    {iface ? iface.label : key}
                  </Tag>
                );
              })}
            </Space>
          );
        }
      },
    },
    {
      title: t('permissionManagement.actions'),
      key: 'actions',
      width: 150,
      render: (_, record) => {
        if (editingRoleId === record.id) {
          return (
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="small"
                loading={saving}
                onClick={() => handleSave(record.id)}
              >
                {t('common.save')}
              </Button>
              <Button
                icon={<CloseOutlined />}
                size="small"
                onClick={handleCancelEdit}
              >
                {t('common.cancel')}
              </Button>
            </Space>
          );
        } else {
          return (
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record.id)}
            >
              {t('common.edit')}
            </Button>
          );
        }
      },
    },
  ];

  // 檢查是否有權限訪問
  // 注意：這裡使用角色檢查作為第一層防護，實際的菜單過濾已經通過介面權限控制
  const hasAccess = canAccessPermissionManagement(userInfo);
  
  // 如果正在加載用戶信息，顯示加載中
  if (loadingUserInfo) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <p style={{ marginTop: '16px' }}>正在載入用戶權限信息...</p>
      </div>
    );
  }
  
  if (!hasAccess) {
    console.warn('用戶無權限訪問權限管理頁面:', {
      userInfo,
      roles: userInfo?.roles,
      hasAccess,
      roleNames: userInfo?.roles?.map(r => typeof r === 'string' ? r : r.name)
    });
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Title level={3}>無權限訪問</Title>
        <p>您沒有權限訪問此頁面。只有 Company_Admin 和 Tenant_Admin 可以訪問。</p>
        <p style={{ marginTop: '16px', color: '#999', fontSize: '12px' }}>
          當前用戶角色: {userInfo?.roles?.length > 0 
            ? userInfo.roles.map(r => typeof r === 'string' ? r : r.name).join(', ') 
            : '無'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 頁面標題 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Space>
            {isTenantAdmin ? (
              <Select
                style={{ width: 200 }}
                placeholder="選擇公司（系統默認）"
                value={selectedCompanyId}
                onChange={setSelectedCompanyId}
                allowClear
              >
                 <Option value={null}>{t('permissionManagement.systemDefault') || 'System Default'}</Option>
                {companies.map(company => (
                  <Option key={company.id} value={company.id}>
                    {company.name}
                  </Option>
                ))}
              </Select>
            ) : (
              <Text type="secondary" style={{ fontSize: '14px' }}>
                 {t('permissionManagement.editingCompany') || 'Editing company'}: {companies.find(c => c.id === selectedCompanyId)?.name || t('common.loading') || 'Loading...'}
              </Text>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => {
              fetchRoles();
              loadAllRolePermissions();
            }}>
              {t('common.refresh')}
            </Button>
          </Space>
        </Col>
        <Col>
          <Title level={2} style={{ margin: 0, textAlign: 'right' }}>
            <SafetyOutlined /> {t('menu.permissionManagement')}
          </Title>
          <Text type="secondary" style={{ textAlign: 'right', display: 'block' }}>
            {t('permissionManagement.pageDescription')}
          </Text>
        </Col>
      </Row>

      <Card bodyStyle={{ padding: '12px 12px 8px 12px' }} style={{ boxShadow: 'none', borderRadius: 8, margin: 0 }}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={roles}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ width: '100%' }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default PermissionManagementPage;

