import React, { useState, useEffect } from 'react';
import { Table, Input, Button, Space, Tag, message, Pagination, Card, Typography, Tooltip, Modal, Popconfirm, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, SortAscendingOutlined, FormOutlined, CheckCircleOutlined, StopOutlined, CopyOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
// import dayjs from 'dayjs'; // 已替換為 TimezoneUtils
import { TimezoneUtils } from '../utils/timezoneUtils';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
// 新增 EFormDesigner 引入
import EFormDesigner from './EFormDesigner';
// 新增 MetaFlowBuilder 引入
import MetaFlowBuilder from './MetaFlowBuilder';
// 移除: import SideMenu from '../components/SideMenu';
import { useLanguage } from '../contexts/LanguageContext';

const { Title } = Typography;
const { confirm } = Modal;
const { TextArea } = Input;

// 複製表單 Modal 組件
const CopyFormModal = ({ copyingForm, onCopy, onCancel, t }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (copyingForm) {
      form.setFieldsValue({
        name: `${copyingForm.name} (複製)`,
        description: copyingForm.description || ''
      });
    }
  }, [copyingForm, form]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      await onCopy(values.name, values.description);
    } catch (error) {
      console.error('表單驗證失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!copyingForm) return null;

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ 
        marginBottom: '20px', 
        padding: '16px', 
        backgroundColor: '#f0f8ff', 
        border: '1px solid #b3d8ff', 
        borderRadius: '6px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <CopyOutlined style={{ color: '#1890ff' }} />
          <strong style={{ color: '#1890ff' }}>📋 {t('eform.copyFormInfo')}</strong>
        </div>
        <div style={{ color: '#666' }}>
          {t('eform.copyFormContent')} <strong>"{copyingForm.name}"</strong> {t('eform.copyFormContent2')}
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="name"
          label={t('eform.newFormName')}
          rules={[
            { required: true, message: t('eform.pleaseEnterFormName') },
            { max: 100, message: t('eform.formNameTooLong') }
          ]}
        >
          <Input 
            placeholder={t('eform.enterNewFormName')}
            maxLength={100}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('eform.newFormDescription')}
        >
          <TextArea 
            placeholder={t('eform.enterNewFormDescription')}
            rows={3}
            maxLength={500}
            showCount
          />
        </Form.Item>

        <div style={{ textAlign: 'right', marginTop: '24px' }}>
          <Space>
            <Button onClick={onCancel}>
              {t('eform.cancel')}
            </Button>
            <Button 
              type="primary" 
              onClick={handleSubmit}
              loading={loading}
              icon={<CopyOutlined />}
            >
              {t('eform.copyForm')}
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

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

const EFormListPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const navigate = useNavigate();
  const location = useLocation();
  const [designerOpen, setDesignerOpen] = useState(false);
  const [metaFlowBuilderOpen, setMetaFlowBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formTypeModalVisible, setFormTypeModalVisible] = useState(false);
  
  // 批量操作和排序相關狀態
  const [selectedForms, setSelectedForms] = useState([]);
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isBatchDeleteModalVisible, setIsBatchDeleteModalVisible] = useState(false);
  const [isBatchStatusModalVisible, setIsBatchStatusModalVisible] = useState(false);
  const [batchStatusAction, setBatchStatusAction] = useState(''); // 'enable' 或 'disable'
  const [isCopyModalVisible, setIsCopyModalVisible] = useState(false);
  const [copyingForm, setCopyingForm] = useState(null);
  const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8'); // 默認香港時區

  const { t } = useLanguage();

  const baseColumns = React.useMemo(() => [
    { title: t('eform.name'), dataIndex: 'name', key: 'name', width: 200, ellipsis: true, sorter: true },
    { title: t('eform.description'), dataIndex: 'description', key: 'description', width: 200, ellipsis: true },
    { title: t('eform.formType'), dataIndex: 'formType', key: 'formType', width: 120, sorter: true, render: v => {
      if (v === 'MetaFlows') return <Tag color="blue">Meta Flows</Tag>;
      return <Tag color="default">HTML</Tag>;
    } },
    { title: t('eform.status'), dataIndex: 'status', key: 'status', width: 100, sorter: true, render: v => {
      if (v === 'A') return <Tag color="green">{t('eform.enabled')}</Tag>;
      if (v === 'I') return <Tag color="orange">{t('eform.disabled')}</Tag>;
      if (v === 'D') return <Tag color="red">{t('eform.deleted')}</Tag>;
      return v;
    } },
    { title: t('eform.createdAt'), dataIndex: 'created_at', key: 'created_at', width: 160, sorter: true, render: (text) => text ? TimezoneUtils.formatDateWithTimezone(text, userTimezoneOffset, 'YYYY-MM-DD HH:mm') : '' },
    { title: t('eform.updatedAt'), dataIndex: 'updated_at', key: 'updated_at', width: 160, sorter: true, render: (text) => text ? TimezoneUtils.formatDateWithTimezone(text, userTimezoneOffset, 'YYYY-MM-DD HH:mm') : '' },
    {
      title: t('eform.action'),
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('eform.edit')}>
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={t('eform.copy')}>
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => handleCopy(record)}
            />
          </Tooltip>
          <Tooltip title={t('eform.delete')}>
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ], [t, userTimezoneOffset]); // 依賴 userTimezoneOffset 和 t
  const [resizableColumns, setResizableColumns] = useState(
    baseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
  );
  
  // 當 baseColumns 改變時，更新 resizableColumns
  useEffect(() => {
    setResizableColumns(baseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 })));
  }, [baseColumns]);
  
  const handleResize = index => (e, { size }) => {
    const nextColumns = [...resizableColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setResizableColumns(nextColumns);
  };
  const mergedColumns = resizableColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handleResize(index),
    }),
  }));
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  const fetchData = async (page = 1, pageSize = 10, search = '') => {
    setLoading(true);
    try {
      // 從用戶信息中獲取 company_id
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      console.log('用戶信息:', userInfo);
      
      let companyId = userInfo.company_id;
      
      // 如果從 userInfo 中獲取不到，嘗試從 JWT token 中解析
      if (!companyId) {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('JWT payload:', payload);
            companyId = payload.company_id || payload.companyId;
          } catch (e) {
            console.error('解析 JWT token 失敗:', e);
          }
        }
      }
      
      console.log('最終使用的 company_id:', companyId);
      
      if (!companyId) {
        console.error('無法獲取用戶的公司ID');
        message.error('無法獲取用戶的公司信息');
        setData([]);
        setPagination({ current: page, pageSize, total: 0 });
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortField: sortField,
        sortOrder: sortOrder
      });
      if (search) {
        params.append('search', search);
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/eforms?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        // 確保 data 是數組
        let filtered = Array.isArray(result.data) ? result.data : [];
        
        // 後端回傳欄位駝峰/底線兼容
        filtered = filtered.map(f => ({
          ...f,
          created_at: f.created_at || f.createdAt,
          updated_at: f.updated_at || f.updatedAt,
          created_user_id: f.created_user_id || f.createdUserId,
          updated_user_id: f.updated_user_id || f.updatedUserId,
        }));
        
        setData(filtered);
        setPagination({ 
          current: result.page || page, 
          pageSize: result.pageSize || pageSize, 
          total: result.total || filtered.length 
        });
      } else {
        console.error('獲取表單列表失敗:', response.statusText);
        message.error('獲取表單列表失敗');
        setData([]);
        setPagination({ current: page, pageSize, total: 0 });
      }
    } catch (error) {
      console.error('獲取表單列表錯誤:', error);
      message.error('獲取表單列表錯誤');
      setData([]);
      setPagination({ current: page, pageSize, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  // 獲取用戶時區信息
  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const parsedUserInfo = JSON.parse(userInfo);
        if (parsedUserInfo.timezone) {
          setUserTimezoneOffset(parsedUserInfo.timezone);
        }
      } catch (error) {
        console.error('解析用戶信息失敗:', error);
      }
    }
  }, []);

  useEffect(() => {
    // 調試：檢查 localStorage 內容
    console.log('=== localStorage 調試信息 ===');
    console.log('userInfo:', localStorage.getItem('userInfo'));
    console.log('token:', localStorage.getItem('token') ? '存在' : '不存在');
    
    if (localStorage.getItem('userInfo')) {
      const userInfo = JSON.parse(localStorage.getItem('userInfo'));
      console.log('解析後的 userInfo:', userInfo);
      console.log('company_id:', userInfo.company_id);
    }
    
    fetchData();
  }, [sortField, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  // 檢查 URL 參數並自動打開編輯器
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const editFormId = urlParams.get('edit');
    
    if (editFormId) {
      console.log('🔍 檢測到編輯表單 ID:', editFormId);
      console.log('🔍 當前數據:', data);
      console.log('🔍 數據中的 ID 類型:', data.map(d => ({ id: d.id, type: typeof d.id })));
      
      // 等待數據載入完成後再打開編輯器
      if (data.length > 0) {
        // 嘗試多種 ID 匹配方式
        let formToEdit = data.find(d => d.id === editFormId);
        
        // 如果直接匹配失敗，嘗試字符串轉換匹配
        if (!formToEdit) {
          formToEdit = data.find(d => String(d.id) === String(editFormId));
        }
        
        // 如果還是找不到，嘗試數字轉換匹配
        if (!formToEdit) {
          const numericId = parseInt(editFormId);
          if (!isNaN(numericId)) {
            formToEdit = data.find(d => parseInt(d.id) === numericId);
          }
        }
        
        if (formToEdit) {
          console.log('✅ 找到要編輯的表單:', formToEdit);
          setEditingId(formToEdit.id); // 使用實際的 ID
          setDesignerOpen(true);
          
          // 清除 URL 參數，避免刷新頁面時重複觸發
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        } else {
          console.warn('⚠️ 未找到要編輯的表單:', editFormId);
          console.warn('⚠️ 可用的表單 ID:', data.map(d => d.id));
          message.warning(`未找到要編輯的表單 (ID: ${editFormId})`);
        }
      }
    }
  }, [data, location.search]);

  const handleSearch = () => {
    fetchData(1, pagination.pageSize, searchText);
  };



  const handleEdit = (record) => {
    setEditingId(record.id);
    const formType = record.formType || 'HTML';
    if (formType === 'MetaFlows') {
      setMetaFlowBuilderOpen(true);
    } else {
      setDesignerOpen(true);
    }
  };

  const handleDelete = (record) => {
    confirm({
      title: t('eform.confirmDeleteTitle'),
      icon: <ExclamationCircleOutlined />,
      content: `${t('eform.confirmDeleteContent')}${record.name}`,
      okText: t('eform.confirmDeleteOk'),
      okType: 'danger',
      cancelText: t('eform.confirmDeleteCancel'),
      async onOk() {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/eforms/${record.id}`, { 
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            message.success(t('eform.deleteSuccess'));
            fetchData(pagination.current, pagination.pageSize, searchText);
          } else {
            message.error(t('eform.deleteFailed'));
          }
        } catch {
          message.error(t('eform.deleteFailed'));
        }
      },
    });
  };

  const handleAdd = () => {
    setFormTypeModalVisible(true);
  };

  const handleFormTypeSelect = (formType) => {
    setFormTypeModalVisible(false);
    setEditingId(null);
    if (formType === 'HTML') {
      setDesignerOpen(true);
    } else if (formType === 'MetaFlows') {
      setMetaFlowBuilderOpen(true);
    }
  };

  const handleCopy = (record) => {
    setCopyingForm(record);
    setIsCopyModalVisible(true);
  };

  // 批量刪除表單
  const handleBatchDelete = async () => {
    if (selectedForms.length === 0) {
      message.warning(t('eform.pleaseSelectForms'));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/eforms/batch-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ formIds: selectedForms }),
      });

      const result = await response.json();

      if (result.success) {
        message.success(`✅ ${t('eform.batchDeleteSuccess')}${result.deletedCount}${t('eform.forms')}`);
        setSelectedForms([]);
        setIsBatchDeleteModalVisible(false);
        fetchData(pagination.current, pagination.pageSize, searchText);
      } else {
        message.error(`❌ ${t('eform.batchDeleteFailed')}: ${result.error || t('eform.unknownError')}`);
      }
    } catch (error) {
      console.error('❌ 批量刪除錯誤:', error);
      message.error(`❌ ${t('eform.batchDeleteFailed')}: ${error.message}`);
    }
  };

  // 批量設定表單狀態
  const handleBatchStatus = async () => {
    if (selectedForms.length === 0) {
      message.warning(t('eform.pleaseSelectForms'));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const newStatus = batchStatusAction === 'enable' ? 'A' : 'I';
      const actionText = batchStatusAction === 'enable' ? t('eform.enable') : t('eform.disable');
      
      const response = await fetch('/api/eforms/batch-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          formIds: selectedForms, 
          status: newStatus 
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success(`✅ ${t('eform.batchStatusSuccess')}${actionText}${result.updatedCount}${t('eform.forms')}`);
        setSelectedForms([]);
        setIsBatchStatusModalVisible(false);
        setBatchStatusAction('');
        fetchData(pagination.current, pagination.pageSize, searchText);
      } else {
        message.error(`❌ ${t('eform.batchStatusFailed')}: ${result.error || t('eform.unknownError')}`);
      }
    } catch (error) {
      console.error(`❌ ${batchStatusAction === 'enable' ? t('eform.enable') : t('eform.disable')}錯誤:`, error);
      message.error(`❌ ${batchStatusAction === 'enable' ? t('eform.enable') : t('eform.disable')}失敗: ${error.message}`);
    }
  };

  // 打開批量狀態設定 Modal
  const openBatchStatusModal = (action) => {
    if (selectedForms.length === 0) {
      message.warning(t('eform.pleaseSelectForms'));
      return;
    }
    setBatchStatusAction(action);
    setIsBatchStatusModalVisible(true);
  };

  // 複製表單
  const handleCopyForm = async (newName, newDescription) => {
    if (!copyingForm) return;

    try {
      const token = localStorage.getItem('token');
      
      // 從用戶信息中獲取 company_id
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      let companyId = userInfo.company_id;
      
      if (!companyId) {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            companyId = payload.company_id || payload.companyId;
          } catch (e) {
            console.error('解析 JWT token 失敗:', e);
          }
        }
      }

      const response = await fetch('/api/eforms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          htmlCode: copyingForm.htmlCode || copyingForm.html,
          status: 'A',
          rStatus: 'A'
        })
      });

      if (response.ok) {
        message.success(`✅ ${t('eform.copySuccess')}`);
        setIsCopyModalVisible(false);
        setCopyingForm(null);
        fetchData(pagination.current, pagination.pageSize, searchText);
      } else {
        const errorText = await response.text();
        throw new Error(`${t('eform.copyFailed')}: ${errorText}`);
      }
    } catch (error) {
      console.error('複製失敗:', error);
      message.error(`❌ ${t('eform.copyFailed')}: ${error.message}`);
    }
  };

  // 處理表格排序
  const handleTableChange = (paginationInfo, filters, sorter) => {
    if (sorter && sorter.field) {
      setSortField(sorter.field);
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    }
    // 延遲一下再重新載入數據，確保狀態更新完成
    setTimeout(() => {
      fetchData(paginationInfo.current, paginationInfo.pageSize, searchText);
    }, 100);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7' }}>
      {/* 只顯示內容，不再渲染 SideMenu */}
      {designerOpen ? (
        <div 
          className="eform-designer-container"
          style={{ 
            height: '100vh', 
            background: '#fff', 
            position: 'absolute', 
            left: 0, 
            top: 0, 
            zIndex: 10,
            marginLeft: '280px', // 為 SideMenu 留出空間
            width: 'calc(100vw - 280px)', // 調整寬度
            transition: 'margin-left 0.3s ease, width 0.3s ease' // 添加過渡效果
          }}
        >
          <EFormDesigner
            initialSchema={editingId ? data.find(d => d.id === editingId) : null}
            onSave={() => { 
              // EFormDesigner 內部已經處理了保存邏輯，這裡只需要更新 UI
              setDesignerOpen(false); 
              fetchData(pagination.current, pagination.pageSize, searchText); 
            }}
            onBack={() => { setDesignerOpen(false); }}
          />
        </div>
      ) : metaFlowBuilderOpen ? (
        <div 
          className="meta-flow-builder-container"
          style={{ 
            height: '100vh', 
            background: '#fff', 
            position: 'absolute', 
            left: 0, 
            top: 0, 
            zIndex: 10,
            marginLeft: '280px', // 為 SideMenu 留出空間
            width: 'calc(100vw - 280px)', // 調整寬度
            transition: 'margin-left 0.3s ease, width 0.3s ease' // 添加過渡效果
          }}
        >
          <MetaFlowBuilder
            initialSchema={editingId ? data.find(d => d.id === editingId) : null}
            onSave={() => { 
              setMetaFlowBuilderOpen(false); 
              fetchData(pagination.current, pagination.pageSize, searchText); 
            }}
            onBack={() => { setMetaFlowBuilderOpen(false); }}
          />
        </div>
      ) : (
        <div style={{ padding: '8px' }}>
          <Card bodyStyle={{ padding: '12px 12px 8px 12px' }} style={{ boxShadow: 'none', borderRadius: 8, margin: 0 }}>
            {/* 標題和操作按鈕 */}
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ padding: '0 12px' }}>
                  {t('eform.add')}
                </Button>
                <Button 
                  type="default" 
                  icon={<CheckCircleOutlined />} 
                  onClick={() => openBatchStatusModal('enable')}
                  disabled={selectedForms.length === 0}
                  title={t('eform.batchEnable')}
                  style={{ color: '#52c41a', borderColor: '#52c41a' }}
                >
                  {t('eform.batchEnable')}({selectedForms.length})
                </Button>
                <Button 
                  type="default" 
                  icon={<StopOutlined />} 
                  onClick={() => openBatchStatusModal('disable')}
                  disabled={selectedForms.length === 0}
                  title={t('eform.batchDisable')}
                  style={{ color: '#faad14', borderColor: '#faad14' }}
                >
                  {t('eform.batchDisable')}({selectedForms.length})
                </Button>
                <Button 
                  type="default" 
                  icon={<DeleteOutlined />} 
                  onClick={() => setIsBatchDeleteModalVisible(true)}
                  disabled={selectedForms.length === 0}
                  title={t('eform.batchDelete')}
                  danger
                >
                  {t('eform.batchDelete')}({selectedForms.length})
                </Button>
                <Button 
                  type="default" 
                  icon={<SortAscendingOutlined />} 
                  onClick={() => {
                    // 觸發重新載入以應用排序
                    fetchData(pagination.current, pagination.pageSize, searchText);
                  }}
                  title={t('eform.refresh')}
                >
                  {t('eform.refresh')}
                </Button>
              </Space>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 style={{ margin: 0 }}>
                  <FormOutlined style={{ marginRight: '8px' }} />
                  {t('menu.eformList')}
                </h2>
              </div>
            </div>

            {/* 搜索和篩選 */}
            <Card style={{ marginBottom: '16px' }}>
              <Space wrap>
                <Input.Search
                  placeholder={t('eform.searchNameDescription')}
                  allowClear
                  style={{ width: 300 }}
                  onSearch={handleSearch}
                  onPressEnter={(e) => handleSearch(e.target.value)}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <Button
                  onClick={() => {
                    setSearchText('');
                    setPagination(prev => ({ ...prev, current: 1 }));
                  }}
                >
                  {t('eform.clearFilter')}
                </Button>
              </Space>
            </Card>

            <Table
              components={components}
              columns={mergedColumns}
              dataSource={data}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
              style={{ width: '100%' }}
              onChange={handleTableChange}
              rowSelection={{
                selectedRowKeys: selectedForms,
                onChange: (selectedRowKeys, selectedRows) => {
                  setSelectedForms(selectedRowKeys);
                },
              }}
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Pagination
                current={pagination.current || 1}
                pageSize={pagination.pageSize || 10}
                total={pagination.total || 0}
                showSizeChanger
                pageSizeOptions={['10', '20', '50', '100']}
                showTotal={(total, range) => `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`}
                onChange={(page, pageSize) => fetchData(page, pageSize, searchText)}
                onShowSizeChange={(current, size) => fetchData(1, size, searchText)}
              />
            </div>
          </Card>
        </div>
      )}

      {/* 批量刪除 Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DeleteOutlined style={{ color: '#ff4d4f' }} />
            {t('eform.batchDeleteForms')}
          </div>
        }
        open={isBatchDeleteModalVisible}
        onCancel={() => setIsBatchDeleteModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsBatchDeleteModalVisible(false)}>
            {t('eform.cancel')}
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            onClick={handleBatchDelete}
            loading={loading}
          >
            {t('eform.confirmDelete')}({selectedForms.length} {t('eform.forms')})
          </Button>,
        ]}
        width={800}
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
              <strong>⚠️ {t('eform.batchDeleteWarning')}</strong>
            </div>
            <div style={{ color: '#666' }}>
              {t('eform.batchDeleteWarningContent')}{selectedForms.length}{t('eform.forms')}{t('eform.cannotBeUndone')}{t('eform.pleaseConfirm')}.
            </div>
          </div>
          
          <Table
            columns={mergedColumns}
            dataSource={Array.isArray(data) ? data.filter(form => selectedForms.includes(form.id)) : []}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ y: 300 }}
          />
        </div>
      </Modal>

      {/* 批量狀態設定 Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {batchStatusAction === 'enable' ? (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ) : (
              <StopOutlined style={{ color: '#faad14' }} />
            )}
            {batchStatusAction === 'enable' ? t('eform.batchEnableForms') : t('eform.batchDisableForms')}
          </div>
        }
        open={isBatchStatusModalVisible}
        onCancel={() => setIsBatchStatusModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsBatchStatusModalVisible(false)}>
            {t('eform.cancel')}
          </Button>,
          <Button
            key="confirm"
            type="primary"
            style={{ 
              backgroundColor: batchStatusAction === 'enable' ? '#52c41a' : '#faad14',
              borderColor: batchStatusAction === 'enable' ? '#52c41a' : '#faad14'
            }}
            onClick={handleBatchStatus}
            loading={loading}
          >
            {t('eform.confirm')}{batchStatusAction === 'enable' ? t('eform.enable') : t('eform.disable')}({selectedForms.length} {t('eform.forms')})
          </Button>,
        ]}
        width={800}
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ 
            marginBottom: '20px', 
            padding: '16px', 
            backgroundColor: batchStatusAction === 'enable' ? '#f6ffed' : '#fffbe6', 
            border: `1px solid ${batchStatusAction === 'enable' ? '#b7eb8f' : '#ffe58f'}`, 
            borderRadius: '6px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {batchStatusAction === 'enable' ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <StopOutlined style={{ color: '#faad14' }} />
              )}
              <strong style={{ color: batchStatusAction === 'enable' ? '#52c41a' : '#faad14' }}>
                {batchStatusAction === 'enable' ? '✅ ' + t('eform.batchEnable') : '⚠️ ' + t('eform.batchDisable')}
              </strong>
            </div>
            <div style={{ color: '#666' }}>
              {t('eform.batchStatusContent')}{selectedForms.length}{t('eform.forms')}{batchStatusAction === 'enable' ? t('eform.enableAfter') : t('eform.disableAfter')}.
            </div>
          </div>
          
          <Table
            columns={mergedColumns}
            dataSource={Array.isArray(data) ? data.filter(form => selectedForms.includes(form.id)) : []}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ y: 300 }}
          />
        </div>
      </Modal>

      {/* 複製表單 Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CopyOutlined style={{ color: '#1890ff' }} />
            {t('eform.copyForm')}
          </div>
        }
        open={isCopyModalVisible}
        onCancel={() => {
          setIsCopyModalVisible(false);
          setCopyingForm(null);
        }}
        footer={null}
        width={600}
      >
        <CopyFormModal 
          copyingForm={copyingForm}
          onCopy={handleCopyForm}
          onCancel={() => {
            setIsCopyModalVisible(false);
            setCopyingForm(null);
          }}
          t={t}
        />
      </Modal>

      {/* 表單類型選擇 Modal */}
      <Modal
        title="選擇表單類型"
        open={formTypeModalVisible}
        onCancel={() => setFormTypeModalVisible(false)}
        footer={null}
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card 
              hoverable 
              onClick={() => handleFormTypeSelect('HTML')}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              <FormOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
              <h3>HTML 表單設計器</h3>
              <p style={{ color: '#666' }}>使用現有的 HTML 表單設計器創建表單</p>
            </Card>
            <Card 
              hoverable 
              onClick={() => handleFormTypeSelect('MetaFlows')}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              <FormOutlined style={{ fontSize: '48px', color: '#722ed1', marginBottom: '16px' }} />
              <h3>Meta Flow Builder</h3>
              <p style={{ color: '#666' }}>創建 WhatsApp Flows 表單（JSON 格式）</p>
            </Card>
          </Space>
        </div>
      </Modal>
      
      {/* 自定義 CSS 來響應 SideMenu 折疊狀態 */}
      <style jsx>{`
        /* 響應 SideMenu 折疊狀態 */
        .ant-layout-sider-collapsed ~ * .eform-designer-container {
          margin-left: 80px !important;
          width: calc(100vw - 80px) !important;
        }
        
        /* MetaFlowBuilder 容器響應側邊欄收合 */
        .ant-layout-sider-collapsed ~ * .meta-flow-builder-container {
          margin-left: 80px !important;
          width: calc(100vw - 80px) !important;
        }
        
        /* 確保在移動設備上正確顯示 */
        @media (max-width: 768px) {
          .eform-designer-container {
            margin-left: 0 !important;
            width: 100vw !important;
          }
          .meta-flow-builder-container {
            left: 0 !important;
            width: 100vw !important;
          }
        }
      `}</style>
    </div>
  );
};

export default EFormListPage; 