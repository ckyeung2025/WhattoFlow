import React, { useState, useEffect, useContext } from 'react';
import { Table, Input, Button, Modal, Space, Tag, Pagination, Card, Row, Col, Typography, Tooltip, Tabs, message, Form, Upload, Avatar } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import zhTC from '../locales/zh-TC';
import en from '../locales/en';
import MyPreferencesModal from '../components/MyPreferencesModal';

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

  const { currentLanguage, t } = useLanguage();

  // Companies columns
  const companyBaseColumns = [
    { title: t('companyUserAdmin.companyName'), dataIndex: 'name', key: 'name', width: 120 },
    { title: t('companyUserAdmin.email'), dataIndex: 'email', key: 'email', width: 160 },
    { title: t('companyUserAdmin.address'), dataIndex: 'address', key: 'address', width: 180 },
    { title: t('companyUserAdmin.phone'), dataIndex: 'phone', key: 'phone', width: 100 },
    { title: t('companyUserAdmin.website'), dataIndex: 'website', key: 'website', width: 120 },
    { title: t('companyUserAdmin.createdAt'), dataIndex: 'created_at', key: 'created_at', width: 160, render: tVal => tVal ? dayjs(tVal).format('YYYY-MM-DD HH:mm') : '' },
    { title: t('companyUserAdmin.updatedAt'), dataIndex: 'updated_at', key: 'updated_at', width: 160, render: tVal => tVal ? dayjs(tVal).format('YYYY-MM-DD HH:mm') : '' },
    {
      title: t('companyUserAdmin.action'),
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('companyUserAdmin.edit')}><Button icon={<EditOutlined />} onClick={() => handleEditCompany(record)} size="small">{t('companyUserAdmin.edit')}</Button></Tooltip>
          <Tooltip title={t('companyUserAdmin.delete')}><Button icon={<DeleteOutlined />} danger onClick={() => handleDeleteCompany(record)} size="small">{t('companyUserAdmin.delete')}</Button></Tooltip>
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

  // Users columns
  const userBaseColumns = [
    { title: t('companyUserAdmin.name'), dataIndex: 'name', key: 'name', width: 120 },
    { title: t('companyUserAdmin.account'), dataIndex: 'account', key: 'account', width: 120 },
    { title: t('companyUserAdmin.email'), dataIndex: 'email', key: 'email', width: 160 },
    { title: t('companyUserAdmin.phone'), dataIndex: 'phone', key: 'phone', width: 100 },
    { title: t('companyUserAdmin.isActive'), dataIndex: 'is_active', key: 'is_active', width: 80, render: v => v ? <Tag color="green">{t('companyUserAdmin.active')}</Tag> : <Tag color="red">{t('companyUserAdmin.inactive')}</Tag> },
    { title: t('companyUserAdmin.isOwner'), dataIndex: 'is_owner', key: 'is_owner', width: 80, render: v => v ? <Tag color="blue">{t('companyUserAdmin.owner')}</Tag> : null },
    { title: t('companyUserAdmin.createdAt'), dataIndex: 'created_at', key: 'created_at', width: 160, render: tVal => tVal ? dayjs(tVal).format('YYYY-MM-DD HH:mm') : '' },
    { title: t('companyUserAdmin.updatedAt'), dataIndex: 'updated_at', key: 'updated_at', width: 160, render: tVal => tVal ? dayjs(tVal).format('YYYY-MM-DD HH:mm') : '' },
    { title: t('companyUserAdmin.timezone'), dataIndex: 'timezone', key: 'timezone', width: 100 },
    { title: t('companyUserAdmin.language'), dataIndex: 'language', key: 'language', width: 80 },
    {
      title: t('companyUserAdmin.action'),
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('companyUserAdmin.edit')}><Button icon={<EditOutlined />} onClick={() => handleEditUser(record)} size="small">{t('companyUserAdmin.edit')}</Button></Tooltip>
          <Tooltip title={t('companyUserAdmin.delete')}><Button icon={<DeleteOutlined />} danger onClick={() => handleDeleteUser(record)} size="small">{t('companyUserAdmin.delete')}</Button></Tooltip>
        </Space>
      ),
    },
  ];
  const [userColumns, setUserColumns] = useState(userBaseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 })));
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

  // 1. 取得登入者的 company_id
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const myCompanyId = userInfo.company_id || userInfo.companyId || userInfo.companyID || '';

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
      // 過濾只顯示自己公司
      if (myCompanyId) {
        data = data.filter(c => c.id === myCompanyId);
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
  // 2. 串接用戶 API
  const fetchUsers = async (page = 1, pageSize = 10, search = '') => {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/users`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      const raw = await res.json();
      const data = raw.map(u => ({
        ...u,
        is_active: u.isActive,
        is_owner: u.isOwner,
        created_at: u.createdAt,
        updated_at: u.updatedAt,
      }));
      setUsers(data);
      setUserPagination({ current: 1, pageSize, total: data.length });
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

  useEffect(() => { if (activeTab === 'companies') fetchCompanies(); else fetchUsers(); }, [activeTab]);

  // 編輯/刪除/新增（僅框架）
  const handleEditCompany = (record) => {
    if (record && record.id) {
      navigate(`/company-edit?id=${record.id}`);
    }
  };
  const handleEditUser = (record) => { setEditingUser(record); setUserModalVisible(true); };

  // Modal 表單略（可根據需求擴充）
  const [form] = Form.useForm();

  useEffect(() => {
    if (editingCompany) {
      form.setFieldsValue(editingCompany);
      setLogoUrl(editingCompany.logo_url || '');
    }
  }, [editingCompany, form]);

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
                    showQuickJumper
                    showTotal={(total, range) => `第 ${range[0]}-${range[1]} 項，共 ${total} 項`}
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
                    showQuickJumper
                    showTotal={(total, range) => `第 ${range[0]}-${range[1]} 項，共 ${total} 項`}
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
    </div>
  );
};

export default CompanyUserAdminPage; 