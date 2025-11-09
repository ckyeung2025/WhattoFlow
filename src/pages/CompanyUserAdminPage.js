import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Table, Input, Button, Modal, Space, Tag, Pagination, Card, Row, Col, Typography, Tooltip, Tabs, message, Form, Upload, Avatar, Select } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, ReloadOutlined, UploadOutlined, CloseOutlined } from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
// import dayjs from 'dayjs'; // 已替換為 TimezoneUtils
import { TimezoneUtils } from '../utils/timezoneUtils';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import zhTC from '../locales/zh-TC';
import en from '../locales/en';
import MyPreferencesModal from '../components/MyPreferencesModal';
import {
  GMT_OFFSET_OPTIONS,
  getGMTOffsetString,
  getTimezoneValueByGMTOffset,
  normalizeGMTOffsetString,
  formatOffsetToGMT
} from '../configs/timezones';

// 獲取瀏覽器時區的輔助函數
const getBrowserTimezone = () => {
  try {
    // 獲取瀏覽器的 IANA 時區標識符
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (browserTimezone) {
      const gmtOffset = getGMTOffsetString(browserTimezone);
      if (gmtOffset) {
        return gmtOffset;
      }
    }

    // 如果不在列表中，根據偏移值計算偏移字符串
    const now = new Date();
    const offsetMinutes = now.getTimezoneOffset();
    const offsetHours = -offsetMinutes / 60; // getTimezoneOffset() 返回的是相反的符號
    return formatOffsetToGMT(offsetHours);
  } catch (error) {
    console.error('獲取瀏覽器時區失敗:', error);
    return 'UTC+8'; // 默認香港時區
  }
};

const { Title } = Typography;
const { confirm } = Modal;

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

const CompanyUserAdminPage = () => {
  const navigate = useNavigate();
  // Tabs
  const [activeTab, setActiveTab] = useState('companies');

  // Companies State
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [companyPagination, setCompanyPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');

  // Users State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userPagination, setUserPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userEditModalVisible, setUserEditModalVisible] = useState(false);

  // Roles State
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [userRoles, setUserRoles] = useState({}); // { userId: [roleIds] }
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState(null);
  const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8'); // 默認香港時區

  const { currentLanguage, t } = useLanguage();

  // Companies columns
  const companyBaseColumns = [
    { title: t('companyUserAdmin.companyName'), dataIndex: 'name', key: 'name', width: 120 },
    { title: t('companyUserAdmin.email'), dataIndex: 'email', key: 'email', width: 160 },
    { title: t('companyUserAdmin.address'), dataIndex: 'address', key: 'address', width: 180 },
    { title: t('companyUserAdmin.phone'), dataIndex: 'phone', key: 'phone', width: 100 },
    { title: t('companyUserAdmin.website'), dataIndex: 'website', key: 'website', width: 120 },
    { title: t('companyUserAdmin.createdAt'), dataIndex: 'created_at', key: 'created_at', width: 160, render: tVal => tVal ? TimezoneUtils.formatDateWithTimezone(tVal, userTimezoneOffset, 'YYYY-MM-DD HH:mm') : '' },
    { title: t('companyUserAdmin.updatedAt'), dataIndex: 'updated_at', key: 'updated_at', width: 160, render: tVal => tVal ? TimezoneUtils.formatDateWithTimezone(tVal, userTimezoneOffset, 'YYYY-MM-DD HH:mm') : '' },
    {
      title: t('companyUserAdmin.action'),
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('companyUserAdmin.edit')}><Button icon={<EditOutlined />} onClick={() => handleEditCompany(record)} size="small" /></Tooltip>
          <Tooltip title={t('companyUserAdmin.delete')}><Button icon={<DeleteOutlined />} danger onClick={() => handleDeleteCompany(record)} size="small" /></Tooltip>
        </Space>
      ),
    },
  ];
  const [companyColumns, setCompanyColumns] = useState(companyBaseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 })));
  const handleCompanyResize = index => (e, { size }) => {
    const nextColumns = [...companyColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setCompanyColumns(nextColumns);
  };
  const mergedCompanyColumns = companyColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handleCompanyResize(index),
    }),
  }));
  const companyTableComponents = { header: { cell: ResizableTitle } };

  // Users columns - 使用 useMemo 確保狀態更新時重新創建
  const userBaseColumns = useMemo(() => [
    { title: t('companyUserAdmin.name'), dataIndex: 'name', key: 'name', width: 120 },
    { title: t('companyUserAdmin.account'), dataIndex: 'account', key: 'account', width: 120 },
    { title: t('companyUserAdmin.email'), dataIndex: 'email', key: 'email', width: 160 },
    { title: t('companyUserAdmin.phone'), dataIndex: 'phone', key: 'phone', width: 100 },
    { title: t('companyUserAdmin.isActive'), dataIndex: 'is_active', key: 'is_active', width: 80, render: v => v ? <Tag color="green">{t('companyUserAdmin.active')}</Tag> : <Tag color="red">{t('companyUserAdmin.inactive')}</Tag> },
    { 
      title: t('companyUserAdmin.roles'), 
      dataIndex: 'roles', 
      key: 'roles', 
      width: 200, 
      render: (_, record) => {
        const userRoleIds = userRoles[record.id] || [];
        console.log(`渲染用戶 ${record.name} 的角色，userRoleIds:`, userRoleIds);
        console.log(`當前 roles 數組:`, roles);
        
        const userRoleObjects = roles.filter(role => userRoleIds.includes(role.id));
        console.log(`匹配到的角色對象:`, userRoleObjects);
        console.log(`角色名稱列表:`, userRoleObjects.map(role => role.name));
        
        console.log(`準備渲染 ${userRoleObjects.length} 個角色標籤`);
        
        return (
          <div style={{ maxWidth: 180 }}>
            {userRoleObjects.length > 0 ? (
              <Space wrap>
                {userRoleObjects.map(role => {
                  const displayName = getRoleDisplayName(role.name);
                  const color = getRoleColor(role.name);
                  console.log(`渲染角色標籤: ${role.name} -> ${displayName} (${color})`);
                  return (
                    <Tag 
                      key={role.id} 
                      color={color}
                      closable
                      onClose={(e) => {
                        e.preventDefault();
                        handleRemoveUserRole(record.id, role.id);
                      }}
                    >
                      {displayName}
                    </Tag>
                  );
                })}
              </Space>
            ) : userRoleIds.length > 0 ? (
              <Tag color="orange">載入中...</Tag>
            ) : (
              <Tag color="default">{t('companyUserAdmin.noRoles')}</Tag>
            )}
          </div>
        );
      }
    },
    { title: t('companyUserAdmin.createdAt'), dataIndex: 'created_at', key: 'created_at', width: 160, render: tVal => tVal ? TimezoneUtils.formatDateWithTimezone(tVal, userTimezoneOffset, 'YYYY-MM-DD HH:mm') : '' },
    { title: t('companyUserAdmin.updatedAt'), dataIndex: 'updated_at', key: 'updated_at', width: 160, render: tVal => tVal ? TimezoneUtils.formatDateWithTimezone(tVal, userTimezoneOffset, 'YYYY-MM-DD HH:mm') : '' },
    { title: t('companyUserAdmin.timezone'), dataIndex: 'timezone', key: 'timezone', width: 100 },
    { title: t('companyUserAdmin.language'), dataIndex: 'language', key: 'language', width: 80 },
    {
      title: t('companyUserAdmin.action'),
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('companyUserAdmin.edit')}>
            <Button icon={<EditOutlined />} onClick={() => handleEditUser(record)} size="small" />
          </Tooltip>
          <Tooltip title={t('companyUserAdmin.delete')}>
            <Button icon={<DeleteOutlined />} danger onClick={() => handleDeleteUser(record)} size="small" />
          </Tooltip>
        </Space>
      ),
    },
  ], [userRoles, roles, t, userTimezoneOffset]); // 添加 userTimezoneOffset 依賴
  const [userColumns, setUserColumns] = useState(() => userBaseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 })));
  
  // 獲取用戶時區信息
  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const parsedUserInfo = JSON.parse(userInfo);
        if (parsedUserInfo.timezone) {
          setUserTimezoneOffset(normalizeGMTOffsetString(parsedUserInfo.timezone));
        }
      } catch (error) {
        console.error('解析用戶信息失敗:', error);
      }
    }
  }, []);

  // 當 userBaseColumns 改變時，更新 userColumns
  useEffect(() => {
    setUserColumns(userBaseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 })));
  }, [userBaseColumns]);
  
  const handleUserResize = index => (e, { size }) => {
    const nextColumns = [...userColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setUserColumns(nextColumns);
  };
  const mergedUserColumns = userColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handleUserResize(index),
    }),
  }));
  const userTableComponents = { header: { cell: ResizableTitle } };

  // 多選狀態
  const [selectedUserRowKeys, setSelectedUserRowKeys] = useState([]);
  const rowSelection = {
    selectedRowKeys: selectedUserRowKeys,
    onChange: setSelectedUserRowKeys,
  };

  // 批量設置 is_active
  const handleBatchSetActive = async (active) => {
    const token = localStorage.getItem('token');
    for (const userId of selectedUserRowKeys) {
      await fetch(`/api/users/${userId}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(active)
      });
    }
    message.success('批量設置完成');
    setSelectedUserRowKeys([]);
    fetchUsers();
  };

  // 角色相關輔助函數
  const getRoleColor = (roleName) => {
    const colorMap = {
      'Tenant_Admin': 'red',
      'Company_Admin': 'blue',
      'Designer': 'green',
      'Approver': 'orange'
    };
    return colorMap[roleName] || 'default';
  };

  const getRoleDisplayName = (roleName) => {
    const displayMap = {
      'Tenant_Admin': t('companyUserAdmin.tenantAdmin'),
      'Company_Admin': t('companyUserAdmin.companyAdmin'),
      'Designer': t('companyUserAdmin.designer'),
      'Approver': t('companyUserAdmin.approver')
    };
    return displayMap[roleName] || roleName;
  };

  // 1. 取得登入者的 company_id 和角色信息
  const getUserInfo = () => {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}');
    } catch (e) {
      console.error('解析 userInfo 失敗:', e);
      return {};
    }
  };
  
  const userInfo = getUserInfo();
  const myCompanyId = userInfo.company_id || userInfo.companyId || userInfo.companyID || '';
  const userRolesList = userInfo.roles || [];
  const isTenantAdmin = userRolesList.some(role => role.name === 'Tenant_Admin');

  // 1. 串接公司 API
  const fetchCompanies = async (page = 1, pageSize = 10, search = '') => {
    setCompaniesLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `/api/companies`;
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token }
      });
      let data = await res.json();
      console.log('API data:', data);
      
      // 重新獲取最新的 userInfo（防止首次載入時 userInfo 為空）
      const currentUserInfo = getUserInfo();
      const currentCompanyId = currentUserInfo.company_id || currentUserInfo.companyId || currentUserInfo.companyID || '';
      const currentUserRoles = currentUserInfo.roles || [];
      const currentIsTenantAdmin = currentUserRoles.some(role => (typeof role === 'string' ? role : role.name) === 'Tenant_Admin');
      
      console.log('Current User info:', currentUserInfo);
      console.log('Current My company ID:', currentCompanyId);
      console.log('Current Is Tenant Admin:', currentIsTenantAdmin);
      console.log('Current User roles:', currentUserRoles);
      
      // 如果 userInfo 為空，等待一下再重試（防止首次載入時 userInfo 尚未設置）
      if (!currentUserInfo.user_id && !currentCompanyId) {
        console.log('UserInfo is empty, waiting for userInfo to be loaded...');
        // 等待 100ms 後重新獲取 userInfo
        await new Promise(resolve => setTimeout(resolve, 100));
        const retryUserInfo = getUserInfo();
        const retryCompanyId = retryUserInfo.company_id || retryUserInfo.companyId || retryUserInfo.companyID || '';
        const retryUserRoles = retryUserInfo.roles || [];
        const retryIsTenantAdmin = retryUserRoles.some(role => (typeof role === 'string' ? role : role.name) === 'Tenant_Admin');
        
        if (retryIsTenantAdmin) {
          // Tenant_Admin 可以看到所有公司
          console.log('Retry - Tenant Admin, showing all companies');
        } else if (retryCompanyId) {
          // 非 Tenant_Admin 且有自己的公司，只顯示自己公司
          console.log('Retry - Found company ID:', retryCompanyId);
          data = data.filter(c => c.id === retryCompanyId);
          console.log('Retry - Filtered data:', data);
        } else {
          // 非 Tenant_Admin 且沒有公司，不顯示任何公司
          console.log('Retry - No company ID and not Tenant Admin, showing empty list');
          data = [];
        }
      } else if (currentIsTenantAdmin) {
        // Tenant_Admin 可以看到所有公司
        console.log('Tenant Admin - Showing all companies');
      } else if (currentCompanyId) {
        // 非 Tenant_Admin 且有自己的公司，只顯示自己公司
        console.log('Non-Tenant Admin - Filtering companies to show only:', currentCompanyId);
        data = data.filter(c => c.id === currentCompanyId);
        console.log('Filtered data:', data);
      } else {
        // 非 Tenant_Admin 且沒有公司，不顯示任何公司
        console.log('No company ID and not Tenant Admin - Showing empty list');
        data = [];
      }
      // 將後端駝峰 key 轉成前端底線 key
      data = data.map(c => ({
        ...c,
        logo_url: c.logoUrl,
        created_at: c.createdAt || '',
        updated_at: c.updatedAt || '',
      }));
      setCompanies(data);
      setCompanyPagination({ current: 1, pageSize, total: data.length });
    } catch (e) {
      setCompanies([]);
      setCompanyPagination({ current: 1, pageSize, total: 0 });
    } finally {
      setCompaniesLoading(false);
    }
  };
  // 新增/編輯/刪除公司
  const handleSaveCompany = async (values) => {
    const token = localStorage.getItem('token');
    if (editingCompany) {
      await fetch(`/api/companies/${editingCompany.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(values)
      });
    } else {
      await fetch(`/api/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(values)
      });
    }
    setCompanyModalVisible(false);
    fetchCompanies();
  };
  const handleDeleteCompany = async (record) => {
    confirm({
      title: '確定要刪除這個公司嗎？', icon: <ExclamationCircleOutlined />, onOk: async () => {
        const token = localStorage.getItem('token');
        await fetch(`/api/companies/${record.id}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token }
        });
        message.success('已刪除');
        fetchCompanies();
      }});
  };
  // 2. 串接角色 API
  const fetchRoles = async () => {
    setRolesLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('開始獲取角色數據...');
      const res = await fetch(`/api/roles`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      
      if (!res.ok) {
        console.error(`獲取角色失敗: HTTP ${res.status}`);
        setRoles([]);
        return;
      }
      
      const data = await res.json();
      console.log('獲取到的角色數據:', data);
      setRoles(data);
      console.log('角色數據已設置到狀態中');
    } catch (e) {
      console.error('獲取角色失敗:', e);
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  };

  // 3. 串接用戶角色 API
  const fetchUserRoles = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/roles/user/${userId}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      
      if (!res.ok) {
        console.error(`獲取用戶 ${userId} 角色失敗: HTTP ${res.status}`);
        return [];
      }
      
      const data = await res.json();
      console.log(`用戶 ${userId} 的原始角色數據:`, data);
      
      // 確保 data 是數組，並提取 roleId
      const roleIds = Array.isArray(data) ? data.map(ur => ur.roleId) : [];
      console.log(`用戶 ${userId} 的角色 IDs:`, roleIds);
      
      return roleIds;
    } catch (e) {
      console.error('獲取用戶角色失敗:', e);
      return [];
    }
  };

  // 4. 更新用戶角色
  const handleUpdateUserRoles = async (userId, roleIds) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/roles/user/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ roleIds })
      });
      
      // 更新本地狀態
      setUserRoles(prev => ({
        ...prev,
        [userId]: roleIds
      }));
      
      message.success('角色更新成功');
    } catch (e) {
      console.error('更新用戶角色失敗:', e);
      message.error('角色更新失敗');
    }
  };

  // 5. 移除用戶角色
  const handleRemoveUserRole = async (userId, roleId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/roles/user/${userId}/role/${roleId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      
      // 更新本地狀態
      setUserRoles(prev => ({
        ...prev,
        [userId]: (prev[userId] || []).filter(id => id !== roleId)
      }));
      
      message.success('角色移除成功');
    } catch (e) {
      console.error('移除用戶角色失敗:', e);
      message.error('角色移除失敗');
    }
  };

  // 6. 串接用戶 API
  const fetchUsers = async (page = 1, pageSize = 10, search = '') => {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/users`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      const raw = await res.json();
      let data = raw.map(u => ({
        ...u,
        is_active: u.isActive,
        is_owner: u.isOwner,
        created_at: u.createdAt,
        updated_at: u.updatedAt,
        avatar_url: u.avatarUrl, // 添加頭像字段映射
        timezone: normalizeGMTOffsetString(u.timezone),
      }));
      
      // 根據用戶角色過濾用戶列表
      const currentUserInfo = getUserInfo();
      const currentCompanyId = currentUserInfo.company_id || currentUserInfo.companyId || currentUserInfo.companyID || '';
      const currentUserRoles = currentUserInfo.roles || [];
      const currentIsTenantAdmin = currentUserRoles.some(role => (typeof role === 'string' ? role : role.name) === 'Tenant_Admin');
      
      if (currentIsTenantAdmin) {
        // Tenant_Admin 可以看到所有用戶
        console.log('Tenant Admin - Showing all users');
      } else if (currentCompanyId) {
        // 非 Tenant_Admin 且有自己的公司，只顯示自己公司的用戶
        console.log('Non-Tenant Admin - Filtering users to show only company:', currentCompanyId);
        data = data.filter(u => u.companyId === currentCompanyId);
        console.log('Filtered users:', data.length);
      } else {
        // 非 Tenant_Admin 且沒有公司，不顯示任何用戶
        console.log('No company ID and not Tenant Admin - Showing empty user list');
        data = [];
      }
      
      setUsers(data);
      setUserPagination({ current: 1, pageSize, total: data.length });

      // 獲取每個用戶的角色
      const userRolesData = {};
      for (const user of data) {
        try {
          const roles = await fetchUserRoles(user.id);
          userRolesData[user.id] = roles;
          console.log(`用戶 ${user.name} (${user.id}) 的角色:`, roles);
        } catch (error) {
          console.error(`獲取用戶 ${user.id} 的角色失敗:`, error);
          userRolesData[user.id] = [];
        }
      }
      console.log('所有用戶角色數據:', userRolesData);
      setUserRoles(userRolesData);
      console.log('userRoles 狀態已更新');
      
    } catch (e) {
      setUsers([]);
      setUserPagination({ current: 1, pageSize, total: 0 });
    } finally {
      setUsersLoading(false);
    }
  };
  const handleSaveUser = async (values) => {
    const token = localStorage.getItem('token');
    if (editingUser) {
      await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(values)
      });
    } else {
      await fetch(`/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(values)
      });
    }
    setUserModalVisible(false);
    fetchUsers();
  };
  const handleDeleteUser = async (record) => {
    confirm({
      title: '確定要刪除這個用戶嗎？', icon: <ExclamationCircleOutlined />, onOk: async () => {
        const token = localStorage.getItem('token');
        await fetch(`/api/users/${record.id}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token }
        });
        message.success('已刪除');
        fetchUsers();
      }});
  };

  useEffect(() => { 
    if (activeTab === 'companies') {
      fetchCompanies(); 
    } else {
      // 先載入角色數據，再載入用戶數據
      fetchRoles().then(() => {
        return fetchUsers();
      });
    }
  }, [activeTab]);

  // 編輯/刪除/新增（僅框架）
  const handleEditCompany = (record) => {
    if (record && record.id) {
      navigate(`/company-edit?id=${record.id}`);
    }
  };
  const handleEditUser = (record) => {
    // 如果是新增用戶（record 為 null），創建一個空對象
    const browserTimezone = getBrowserTimezone(); // 獲取瀏覽器時區
    const userData = record || {
      id: null,
      account: '',
      email: '',
      name: '',
      phone: '',
      is_active: true,
      timezone: browserTimezone, // 使用瀏覽器時區作為默認值
      language: currentLanguage,
      companyId: myCompanyId,
      avatar_url: null
    };
    setEditingUser(userData);
    setUploadedAvatarUrl(null); // 重置上傳的頭像狀態
    setUserEditModalVisible(true);
    
    // 立即設置表單值，確保頭像正確顯示
    setTimeout(() => {
      if (record) {
        form.setFieldsValue({
          ...record,
          timezone: normalizeGMTOffsetString(record.timezone),
        });
      } else {
        // 新增模式：設置默認值
        form.setFieldsValue({
          account: '',
          email: '',
          name: '',
          phone: '',
          is_active: true,
          timezone: browserTimezone, // 使用瀏覽器時區作為默認值
          language: currentLanguage,
          password: '',
          confirmPassword: '',
          avatar_url: null
        });
      }
    }, 0);
  };

  // 保存用戶編輯
  const handleSaveUserEdit = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');
      const isNewUser = !editingUser || !editingUser.id;
      
      // 時區轉換處理
      const normalizedTimezone = normalizeGMTOffsetString(
        values.timezone || editingUser?.timezone || getBrowserTimezone()
      );
      const timezoneForSave = getTimezoneValueByGMTOffset(normalizedTimezone);

      // 獲取當前用戶的公司 ID
      const currentUserInfo = getUserInfo();
      const currentCompanyId = currentUserInfo.company_id || currentUserInfo.companyId || currentUserInfo.companyID || '';
      
      // 只發送必要的字段，轉換字段名稱以匹配後端期望的格式
      const requestData = {
        // 基本用戶信息 - 使用正確的字段名稱
        ...(isNewUser ? {} : { id: editingUser.id }),
        companyId: isNewUser ? currentCompanyId : (editingUser.companyId || currentCompanyId),
        account: isNewUser ? values.account : editingUser.account, // 新增時可設置，編輯時不允許修改
        email: values.email,
        googleId: isNewUser ? null : (editingUser.google_id || null), // 確保不是 undefined
        isActive: values.is_active !== undefined ? values.is_active : (isNewUser ? true : editingUser.is_active),
        isOwner: isNewUser ? false : (editingUser.is_owner || false), // 新增用戶默認為 false
        avatarUrl: values.avatar_url || null,
        timezone: timezoneForSave,
        name: values.name || null,
        phone: values.phone || null,
        language: values.language || null,
        // 如果用戶填寫了密碼，則發送密碼（後端會處理哈希）
        // 新增用戶時，密碼是必需的
        ...(values.password && values.password.trim() ? { PasswordHash: values.password } : {}),
      };
      
      console.log(isNewUser ? '發送用戶創建請求:' : '發送用戶更新請求:', requestData);
      
      // 新增用戶時使用 POST，編輯時使用 PUT
      const url = isNewUser ? '/api/users' : `/api/users/${editingUser.id}`;
      const method = isNewUser ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`${isNewUser ? '創建' : '更新'}用戶失敗 - 響應狀態:`, response.status);
        console.error('錯誤詳情:', errorData);
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }
      
      const resultUser = await response.json();
      console.log(`用戶${isNewUser ? '創建' : '更新'}成功:`, resultUser);
      
      message.success(`用戶信息${isNewUser ? '創建' : '更新'}成功`);
      setUserEditModalVisible(false);
      setUploadedAvatarUrl(null); // 重置上傳狀態
      setEditingUser(null); // 清除編輯狀態
      form.resetFields(); // 清除表單緩存
      fetchUsers(); // 重新載入用戶列表
    } catch (error) {
      if (error.errorFields) {
        message.error('請檢查表單輸入');
      } else {
        console.error(`${!editingUser || !editingUser.id ? '創建' : '更新'}用戶信息失敗:`, error);
        message.error(`${!editingUser || !editingUser.id ? '創建' : '更新'}用戶信息失敗: ${error.message}`);
      }
    }
  };

  // Modal 表單略（可根據需求擴充）
  const [form] = Form.useForm();

  useEffect(() => {
    if (editingCompany) {
      form.setFieldsValue(editingCompany);
      setLogoUrl(editingCompany.logo_url || '');
    }
  }, [editingCompany, form]);

  // 當用戶編輯 Modal 打開且 editingUser 改變時，更新表單值
  useEffect(() => {
    if (userEditModalVisible) {
      // 延遲設置表單值，確保 Modal 已完全渲染
      setTimeout(() => {
        if (editingUser && editingUser.id) {
          // 編輯模式：設置現有用戶的值
          form.setFieldsValue({
            ...editingUser,
            timezone: normalizeGMTOffsetString(editingUser.timezone),
          });
        } else {
          // 新增模式：設置默認值，使用瀏覽器時區
          const browserTimezone = getBrowserTimezone();
          form.setFieldsValue({
            account: '',
            email: '',
            name: '',
            phone: '',
            is_active: true,
            timezone: browserTimezone, // 使用瀏覽器時區作為默認值
            language: currentLanguage,
            password: '',
            confirmPassword: '',
            avatar_url: null
          });
        }
      }, 50);
    } else {
      // Modal 關閉時重置表單
      form.resetFields();
    }
  }, [userEditModalVisible, editingUser, form, currentLanguage]);

  return (
    <div style={{ padding: '8px' }}>
      <Card bodyStyle={{ padding: '12px 12px 8px 12px' }} style={{ boxShadow: 'none', borderRadius: 8, margin: 0 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'companies',
            label: 'Companies',
            children: (
              <>
                <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
                  <Col><Button type="primary" icon={<PlusOutlined />} onClick={() => handleEditCompany(null)}>{t('companyUserAdmin.addCompany')}</Button></Col>
                  <Col flex="auto"><Input placeholder="搜尋公司名稱、Email..." value={companySearch} onChange={e => setCompanySearch(e.target.value)} onPressEnter={() => fetchCompanies(1, companyPagination.pageSize, companySearch)} suffix={<SearchOutlined />} /></Col>
                  <Col><Button icon={<ReloadOutlined />} onClick={() => fetchCompanies(companyPagination.current, companyPagination.pageSize, companySearch)} /></Col>
                </Row>
                <Table
                  components={companyTableComponents}
                  columns={mergedCompanyColumns}
                  dataSource={companies}
                  rowKey="id"
                  loading={companiesLoading}
                  pagination={false}
                  size="small"
                  style={{ width: '100%' }}
                  onRow={record => ({ onClick: () => handleEditCompany(record) })}
                />
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <Pagination
                    current={companyPagination.current}
                    pageSize={companyPagination.pageSize}
                    total={companyPagination.total}
                    showSizeChanger
                    showTotal={(total, range) => `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`}
                    onChange={(page, pageSize) => fetchCompanies(page, pageSize, companySearch)}
                    onShowSizeChange={(current, size) => fetchCompanies(1, size, companySearch)}
                  />
                </div>
              </>
            )
          },
          {
            key: 'users',
            label: 'Users',
            children: (
              <>
                <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
                  <Col><Button type="primary" icon={<PlusOutlined />} onClick={() => handleEditUser(null)}>{t('companyUserAdmin.addUser')}</Button></Col>
                  <Col flex="auto"><Input placeholder={t('companyUserAdmin.searchUser')} value={userSearch} onChange={e => setUserSearch(e.target.value)} onPressEnter={() => fetchUsers(1, userPagination.pageSize, userSearch)} suffix={<SearchOutlined />} /></Col>
                  <Col><Button icon={<ReloadOutlined />} onClick={() => fetchUsers(userPagination.current, userPagination.pageSize, userSearch)} /></Col>
                </Row>
                <div style={{ marginBottom: 8 }}>
                  <Button
                    type="primary"
                    disabled={selectedUserRowKeys.length === 0}
                    onClick={() => handleBatchSetActive(true)}
                    style={{ marginRight: 8 }}
                  >{t('companyUserAdmin.batchEnable')}</Button>
                  <Button
                    danger
                    disabled={selectedUserRowKeys.length === 0}
                    onClick={() => handleBatchSetActive(false)}
                  >{t('companyUserAdmin.batchDisable')}</Button>
                </div>
                <Table
                  components={userTableComponents}
                  columns={mergedUserColumns}
                  dataSource={users}
                  rowKey="id"
                  loading={usersLoading}
                  pagination={false}
                  size="small"
                  style={{ width: '100%' }}
                  rowSelection={rowSelection}
                />
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <Pagination
                    current={userPagination.current}
                    pageSize={userPagination.pageSize}
                    total={userPagination.total}
                    showSizeChanger
                    showTotal={(total, range) => `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`}
                    onChange={(page, pageSize) => fetchUsers(page, pageSize, userSearch)}
                    onShowSizeChange={(current, size) => fetchUsers(1, size, userSearch)}
                  />
                </div>
              </>
            )
          }
        ]} />
      </Card>
      {editingCompany && console.log('editingCompany:', editingCompany)}
      {userModalVisible && (
        <MyPreferencesModal
          visible={userModalVisible}
          onClose={() => setUserModalVisible(false)}
          userInfo={editingUser}
          onUserInfoUpdate={fetchUsers}
          showUserAdminFields={true}
        />
      )}
      
      {/* 用戶編輯彈出視窗 */}
      {userEditModalVisible && (
        <Modal
          title={editingUser && editingUser.id ? `${t('companyUserAdmin.editUser')} - ${editingUser.name || editingUser.account}` : t('companyUserAdmin.addUser')}
          open={userEditModalVisible}
           onCancel={() => {
             setUserEditModalVisible(false);
             setUploadedAvatarUrl(null);
             setEditingUser(null); // 清除編輯狀態
             form.resetFields(); // 清除表單緩存
           }}
          footer={[
            <Button key="cancel" onClick={() => {
              setUserEditModalVisible(false);
              setUploadedAvatarUrl(null);
              setEditingUser(null); // 清除編輯狀態
              form.resetFields(); // 清除表單緩存
            }}>
              {t('common.cancel')}
            </Button>,
            <Button key="save" type="primary" onClick={() => handleSaveUserEdit()}>
              {t('common.save')}
            </Button>
          ]}
          width={800}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveUserEdit}
          >
            <Row gutter={[16, 16]}>
              {/* 基本信息 */}
              <Col span={24}>
                <div style={{ marginBottom: 16, fontSize: '16px', fontWeight: 'bold' }}>
                  {t('companyUserAdmin.userInfo')}
                </div>
              </Col>
              
              {/* 頭像上傳 */}
              <Col span={24}>
                <Form.Item label={t('companyUserAdmin.avatar')} name="avatar_url">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
                    <Upload
                      name="file"
                      showUploadList={false}
                      customRequest={async ({ file, onSuccess, onError }) => {
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          const token = localStorage.getItem('token');
                          
                          const response = await fetch('/api/users/avatar', {
                            method: 'POST',
                            headers: {
                              Authorization: 'Bearer ' + token
                            },
                            body: formData
                          });
                          
                          if (response.ok) {
                            const result = await response.json();
                            if (result.success) {
                              form.setFieldsValue({ avatar_url: result.url });
                              setUploadedAvatarUrl(result.url); // 更新狀態觸發重新渲染
                              console.log('頭像上傳成功:', result.url);
                              message.success('頭像上傳成功！');
                              onSuccess(result);
                            } else {
                              onError(new Error(result.message || '上傳失敗'));
                            }
                          } else {
                            onError(new Error('上傳失敗'));
                          }
                        } catch (error) {
                          console.error('頭像上傳錯誤:', error);
                          onError(error);
                        }
                      }}
                      accept="image/*"
                      beforeUpload={(file) => {
                        const isImage = file.type.startsWith('image/');
                        if (!isImage) {
                          message.error('只能上傳圖片文件！');
                          return false;
                        }
                        const isLt2M = file.size / 1024 / 1024 < 2;
                        if (!isLt2M) {
                          message.error('圖片大小不能超過 2MB！');
                          return false;
                        }
                        return true;
                      }}
                    >
                      {(() => {
                        // 優先使用新上傳的頭像，然後是當前編輯用戶的頭像，最後是表單值
                        const currentAvatarUrl = uploadedAvatarUrl || (editingUser && editingUser.avatar_url) || form.getFieldValue('avatar_url');
                        console.log('頭像顯示邏輯:', {
                          uploadedAvatarUrl,
                          editingUserAvatar: editingUser ? editingUser.avatar_url : null,
                          formAvatar: form.getFieldValue('avatar_url'),
                          currentAvatarUrl
                        });
                        return currentAvatarUrl ? (
                          <Avatar src={currentAvatarUrl} size={96} style={{ marginBottom: 8 }} />
                        ) : (
                          <Button icon={<PlusOutlined />}>上傳頭像</Button>
                        );
                      })()}
                    </Upload>
                  </div>
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item label={t('companyUserAdmin.name')} name="name">
                  <Input placeholder="請輸入用戶名稱" />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item 
                  label={t('companyUserAdmin.account')} 
                  name="account"
                  rules={[
                    { required: !editingUser || !editingUser.id, message: '請輸入帳號' },
                    { min: 3, message: '帳號長度至少 3 個字符' }
                  ]}
                >
                  <Input 
                    placeholder="請輸入帳號" 
                    disabled={editingUser && editingUser.id} // 編輯模式下禁用
                  />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item label={t('companyUserAdmin.email')} name="email" rules={[{ required: true, type: 'email', message: '請輸入有效的郵箱地址' }]}>
                  <Input placeholder="請輸入郵箱地址" />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item label={t('companyUserAdmin.phone')} name="phone">
                  <Input placeholder="請輸入手機號碼" />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item 
                  label={t('companyUserAdmin.password')} 
                  name="password"
                  rules={[
                    { required: !editingUser || !editingUser.id, message: '請輸入密碼' }, // 新增用戶時密碼必填
                    { min: 6, message: t('companyUserAdmin.passwordMinLength') }
                  ]}
                >
                  <Input.Password 
                    autoComplete="new-password"
                    placeholder={t('companyUserAdmin.passwordPlaceholder')} 
                  />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item 
                  label={t('companyUserAdmin.confirmPassword')} 
                  name="confirmPassword"
                  dependencies={['password']}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const password = getFieldValue('password');
                        const isNewUser = !editingUser || !editingUser.id;
                        
                        // 新增用戶時，密碼和確認密碼都必須填寫
                        if (isNewUser) {
                          if (!password || !password.trim()) {
                            return Promise.reject(new Error('請輸入密碼'));
                          }
                          if (!value || value.trim() === '') {
                            return Promise.reject(new Error(t('companyUserAdmin.confirmPasswordRequired')));
                          }
                          if (password !== value) {
                            return Promise.reject(new Error(t('companyUserAdmin.passwordMismatch')));
                          }
                          return Promise.resolve();
                        }
                        
                        // 編輯模式：如果密碼為空，確認密碼也可以為空（不修改密碼）
                        if (!password || !password.trim()) {
                          return Promise.resolve();
                        }
                        // 如果密碼有值，確認密碼也必須有值且匹配
                        if (!value || value.trim() === '') {
                          return Promise.reject(new Error(t('companyUserAdmin.confirmPasswordRequired')));
                        }
                        if (password === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error(t('companyUserAdmin.passwordMismatch')));
                      },
                    }),
                  ]}
                >
                  <Input.Password 
                    autoComplete="new-password"
                    placeholder={t('companyUserAdmin.confirmPasswordPlaceholder')} 
                  />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item label={t('companyUserAdmin.timezone')} name="timezone">
                  <Select
                    showSearch
                    placeholder={t('companyUserAdmin.selectTimezone')}
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={GMT_OFFSET_OPTIONS}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item label={t('companyUserAdmin.language')} name="language">
                  <Select placeholder="請選擇語言">
                    <Select.Option value="zh-TC">繁體中文</Select.Option>
                    <Select.Option value="zh-SC">簡體中文</Select.Option>
                    <Select.Option value="en">English</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item label={t('companyUserAdmin.status')} name="is_active">
                  <Select placeholder="請選擇狀態">
                    <Select.Option value={true}>{t('companyUserAdmin.enabled')}</Select.Option>
                    <Select.Option value={false}>{t('companyUserAdmin.disabled')}</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              
              {/* 只讀字段 - 只在編輯模式下顯示 */}
              {editingUser && editingUser.id && (
                <>
                  <Col span={12}>
                    <Form.Item label="Google ID">
                      <Input value={editingUser.google_id || '無'} disabled />
                    </Form.Item>
                  </Col>
                  
                  <Col span={12}>
                    <Form.Item label={
                      <span>
                        {t('companyUserAdmin.isMainAccount')}
                        <Tooltip title={t('companyUserAdmin.mainAccountNote')}>
                          <span style={{ marginLeft: 4, color: '#999', fontSize: '12px', cursor: 'help' }}>ℹ️</span>
                        </Tooltip>
                      </span>
                    }>
                      <Input value={editingUser.is_owner ? t('companyUserAdmin.yes') : t('companyUserAdmin.no')} disabled />
                    </Form.Item>
                  </Col>
                  
                  <Col span={12}>
                    <Form.Item label={t('companyUserAdmin.createdAt')}>
                      <Input value={editingUser.created_at ? TimezoneUtils.formatDateWithTimezone(editingUser.created_at, userTimezoneOffset, 'YYYY-MM-DD HH:mm') : ''} disabled />
                    </Form.Item>
                  </Col>
                  
                  <Col span={12}>
                    <Form.Item label={t('companyUserAdmin.updatedAt')}>
                      <Input value={editingUser.updated_at ? TimezoneUtils.formatDateWithTimezone(editingUser.updated_at, userTimezoneOffset, 'YYYY-MM-DD HH:mm') : ''} disabled />
                    </Form.Item>
                  </Col>
                </>
              )}
              
              {/* 角色管理 - 只在編輯模式下顯示 */}
              {editingUser && editingUser.id && (
                <>
                  <Col span={24}>
                    <div style={{ marginBottom: 16, fontSize: '16px', fontWeight: 'bold', marginTop: 24 }}>
                      {t('companyUserAdmin.roleManagement')}
                    </div>
                  </Col>
                  
                  <Col span={24}>
                    <Form.Item label={t('companyUserAdmin.selectRoles')}>
                      <Select
                        mode="multiple"
                        placeholder={t('companyUserAdmin.selectRoles')}
                        style={{ width: '100%' }}
                        value={userRoles[editingUser.id] || []}
                        onChange={(value) => handleUpdateUserRoles(editingUser.id, value)}
                        options={roles.map(role => ({
                          value: role.id,
                          label: getRoleDisplayName(role.name)
                        }))}
                        loading={rolesLoading}
                      />
                    </Form.Item>
                  </Col>
                  
                  {/* 當前角色顯示 */}
                  <Col span={24}>
                    <Form.Item label={t('companyUserAdmin.currentRoles')}>
                      <div style={{ minHeight: 40, padding: '8px', border: '1px solid #d9d9d9', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                        {userRoles[editingUser.id] && userRoles[editingUser.id].length > 0 ? (
                          <Space wrap>
                            {userRoles[editingUser.id].map(roleId => {
                              const role = roles.find(r => r.id === roleId);
                              return role ? (
                                <Tag 
                                  key={role.id} 
                                  color={getRoleColor(role.name)}
                                  closable
                                  onClose={(e) => {
                                    e.preventDefault();
                                    handleRemoveUserRole(editingUser.id, role.id);
                                  }}
                                >
                                  {getRoleDisplayName(role.name)}
                                </Tag>
                              ) : null;
                            })}
                          </Space>
                        ) : (
                          <span style={{ color: '#999' }}>{t('companyUserAdmin.noRoles')}</span>
                        )}
                      </div>
                    </Form.Item>
                  </Col>
                </>
              )}
            </Row>
          </Form>
        </Modal>
      )}
    </div>
  );
};

export default CompanyUserAdminPage; 