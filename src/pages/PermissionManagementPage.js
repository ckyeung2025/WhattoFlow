import React, { useState, useEffect, useMemo } from 'react';
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
import { canAccessPermissionManagement } from '../utils/permissionUtils';

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
            if (!isTenantAdminUser && updatedUserInfo.company_id) {
              setSelectedCompanyId(updatedUserInfo.company_id);
              console.log('Company_Admin 用戶，自動設置公司 ID:', updatedUserInfo.company_id);
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
      
      // 如果是 Company_Admin，只顯示自己的公司
      if (!isTenantAdmin && userCompanyId) {
        const filteredData = data.filter(c => c.id === userCompanyId);
        setCompanies(filteredData);
      } else {
        // Tenant_Admin 可以看到所有公司
        setCompanies(data);
      }
    } catch (error) {
      console.error('載入公司列表失敗:', error);
    }
  };

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
      setAvailableInterfaces(data || []);
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
      const url = `/api/permissions/role/${roleId}${companyId ? `?companyId=${companyId}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      return data.interfaces || [];
    } catch (error) {
      console.error(`載入角色 ${roleId} 權限失敗:`, error);
      return [];
    }
  };

  // 載入所有角色的權限
  const loadAllRolePermissions = async () => {
    const permissions = {};
    for (const role of roles) {
      const companyId = selectedCompanyId;
      const interfaces = await fetchRolePermissions(role.id, companyId);
      if (!permissions[role.id]) {
        permissions[role.id] = {};
      }
      permissions[role.id][companyId || 'default'] = interfaces;
    }
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

  // 當 userInfo 更新後，載入公司列表
  useEffect(() => {
    if (userInfo && (userInfo.roles || userInfo.company_id)) {
      fetchCompanies();
    }
  }, [userInfo, isTenantAdmin, userCompanyId]);

  // 當角色或選中的公司改變時，重新載入權限
  useEffect(() => {
    if (roles.length > 0) {
      try {
        loadAllRolePermissions();
      } catch (error) {
        console.error('載入角色權限錯誤:', error);
        message.error('載入角色權限失敗');
      }
    }
  }, [roles, selectedCompanyId]);

  // 開始編輯
  const handleEdit = (roleId) => {
    const companyKey = selectedCompanyId || 'default';
    const currentPermissions = rolePermissions[roleId]?.[companyKey] || [];
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
      const response = await fetch(`/api/permissions/role/${roleId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          interfaceKeys: editingPermissions
        })
      });

      if (!response.ok) {
        throw new Error('保存失敗');
      }

      message.success('權限保存成功');
      setEditingRoleId(null);
      setEditingPermissions([]);
      await loadAllRolePermissions();
    } catch (error) {
      console.error('保存權限失敗:', error);
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
            <div>
              <Space wrap>
                {availableInterfaces.map(iface => (
                  <Checkbox
                    key={iface.key}
                    checked={editingPermissions.includes(iface.key)}
                    onChange={() => handleToggleInterface(iface.key)}
                  >
                    {iface.label}
                  </Checkbox>
                ))}
              </Space>
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
                <Option value={null}>系統默認</Option>
                {companies.map(company => (
                  <Option key={company.id} value={company.id}>
                    {company.name}
                  </Option>
                ))}
              </Select>
            ) : (
              <Text type="secondary" style={{ fontSize: '14px' }}>
                編輯公司: {companies.find(c => c.id === selectedCompanyId)?.name || '載入中...'}
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

