import React, { useState, useEffect } from 'react';
import { Table, Input, Button, Space, Tag, message, Pagination, Card, Typography, Tooltip, Modal, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, SortAscendingOutlined, FormOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
// 新增 EFormDesigner 引入
import EFormDesigner from './EFormDesigner';
// 移除: import SideMenu from '../components/SideMenu';

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

const EFormListPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const navigate = useNavigate();
  const location = useLocation();
  const [designerOpen, setDesignerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // 批量操作和排序相關狀態
  const [selectedForms, setSelectedForms] = useState([]);
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isBatchDeleteModalVisible, setIsBatchDeleteModalVisible] = useState(false);
  const [isBatchStatusModalVisible, setIsBatchStatusModalVisible] = useState(false);
  const [batchStatusAction, setBatchStatusAction] = useState(''); // 'enable' 或 'disable'

  const baseColumns = [
    { title: '名稱', dataIndex: 'name', key: 'name', width: 200, ellipsis: true, sorter: true },
    { title: '描述', dataIndex: 'description', key: 'description', width: 200, ellipsis: true },
    { title: '狀態', dataIndex: 'status', key: 'status', width: 100, sorter: true, render: v => {
      if (v === 'A') return <Tag color="green">啟用</Tag>;
      if (v === 'I') return <Tag color="orange">停用</Tag>;
      if (v === 'D') return <Tag color="red">刪除</Tag>;
      return v;
    } },
    { title: '建立時間', dataIndex: 'created_at', key: 'created_at', width: 160, sorter: true, render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '' },
    { title: '更新時間', dataIndex: 'updated_at', key: 'updated_at', width: 160, sorter: true, render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '' },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="編輯">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="確定要刪除這個表單嗎？"
            description="此操作無法撤銷"
            onConfirm={() => handleDelete(record)}
            okText="確定"
            cancelText="取消"
          >
            <Tooltip title="刪除">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  const [resizableColumns, setResizableColumns] = useState(
    baseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
  );
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

  const handleSearch = () => {
    fetchData(1, pagination.pageSize, searchText);
  };



  const handleEdit = (record) => {
    setEditingId(record.id);
    setDesignerOpen(true);
  };

  const handleDelete = (record) => {
    confirm({
      title: '確定要刪除這個 e-Form 嗎？',
      icon: <ExclamationCircleOutlined />,
      content: `名稱：${record.name}`,
      okText: '刪除',
      okType: 'danger',
      cancelText: '取消',
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
            message.success('刪除成功');
            fetchData(pagination.current, pagination.pageSize, searchText);
          } else {
            message.error('刪除失敗');
          }
        } catch {
          message.error('刪除失敗');
        }
      },
    });
  };

  const handleAdd = () => {
    setEditingId(null);
    setDesignerOpen(true);
  };

  // 批量刪除表單
  const handleBatchDelete = async () => {
    if (selectedForms.length === 0) {
      message.warning('請選擇要刪除的表單');
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
        message.success(`✅ 成功刪除 ${result.deletedCount} 個表單`);
        setSelectedForms([]);
        setIsBatchDeleteModalVisible(false);
        fetchData(pagination.current, pagination.pageSize, searchText);
      } else {
        message.error('❌ 批量刪除失敗: ' + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ 批量刪除錯誤:', error);
      message.error('❌ 批量刪除失敗: ' + error.message);
    }
  };

  // 批量設定表單狀態
  const handleBatchStatus = async () => {
    if (selectedForms.length === 0) {
      message.warning('請選擇要操作的表單');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const newStatus = batchStatusAction === 'enable' ? 'A' : 'I';
      const actionText = batchStatusAction === 'enable' ? '啟用' : '停用';
      
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
        message.success(`✅ 成功${actionText} ${result.updatedCount} 個表單`);
        setSelectedForms([]);
        setIsBatchStatusModalVisible(false);
        setBatchStatusAction('');
        fetchData(pagination.current, pagination.pageSize, searchText);
      } else {
        message.error(`❌ 批量${actionText}失敗: ` + (result.error || '未知錯誤'));
      }
    } catch (error) {
      console.error(`❌ 批量${batchStatusAction === 'enable' ? '啟用' : '停用'}錯誤:`, error);
      message.error(`❌ 批量${batchStatusAction === 'enable' ? '啟用' : '停用'}失敗: ` + error.message);
    }
  };

  // 打開批量狀態設定 Modal
  const openBatchStatusModal = (action) => {
    if (selectedForms.length === 0) {
      message.warning('請選擇要操作的表單');
      return;
    }
    setBatchStatusAction(action);
    setIsBatchStatusModalVisible(true);
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
            onSave={async (schema) => { 
              try {
                console.log('Saving schema:', schema);
                
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
                  message.error('無法獲取用戶的公司信息');
                  return;
                }
                
                const token = localStorage.getItem('token');
                
                if (editingId) {
                  // 更新現有表單
                  const response = await fetch(`/api/eforms/${editingId}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      id: editingId,
                      name: schema.name,
                      description: schema.description || '',
                      htmlCode: schema.html,
                      status: 'A',
                      rStatus: 'A'
                    })
                  });
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`更新失敗: ${errorText}`);
                  }
                  
                  message.success('✅ 表單更新成功');
                } else {
                  // 創建新表單
                  const response = await fetch('/api/eforms', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      name: schema.name,
                      description: schema.description || '',
                      htmlCode: schema.html,
                      status: 'A',
                      rStatus: 'A'
                    })
                  });
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`創建失敗: ${errorText}`);
                  }
                  
                  message.success('✅ 表單創建成功');
                }
                
                setDesignerOpen(false); 
                fetchData(pagination.current, pagination.pageSize, searchText); 
              } catch (error) {
                console.error('保存失敗:', error);
                message.error('❌ 保存失敗: ' + error.message);
              }
            }}
            onBack={() => { setDesignerOpen(false); }}
          />
        </div>
      ) : (
        <div style={{ padding: '8px' }}>
          <Card bodyStyle={{ padding: '12px 12px 8px 12px' }} style={{ boxShadow: 'none', borderRadius: 8, margin: 0 }}>
            {/* 標題和操作按鈕 */}
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ padding: '0 12px' }}>
                  新增
                </Button>
                <Button 
                  type="default" 
                  icon={<CheckCircleOutlined />} 
                  onClick={() => openBatchStatusModal('enable')}
                  disabled={selectedForms.length === 0}
                  title="批量啟用"
                  style={{ color: '#52c41a', borderColor: '#52c41a' }}
                >
                  批量啟用 ({selectedForms.length})
                </Button>
                <Button 
                  type="default" 
                  icon={<StopOutlined />} 
                  onClick={() => openBatchStatusModal('disable')}
                  disabled={selectedForms.length === 0}
                  title="批量停用"
                  style={{ color: '#faad14', borderColor: '#faad14' }}
                >
                  批量停用 ({selectedForms.length})
                </Button>
                <Button 
                  type="default" 
                  icon={<DeleteOutlined />} 
                  onClick={() => setIsBatchDeleteModalVisible(true)}
                  disabled={selectedForms.length === 0}
                  title="批量刪除"
                  danger
                >
                  批量刪除 ({selectedForms.length})
                </Button>
                <Button 
                  type="default" 
                  icon={<SortAscendingOutlined />} 
                  onClick={() => {
                    // 觸發重新載入以應用排序
                    fetchData(pagination.current, pagination.pageSize, searchText);
                  }}
                  title="刷新排序"
                >
                  刷新
                </Button>
              </Space>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 style={{ margin: 0 }}>
                  <FormOutlined style={{ marginRight: '8px' }} />
                  e-Form 管理
                </h2>
              </div>
            </div>

            {/* 搜索和篩選 */}
            <Card style={{ marginBottom: '16px' }}>
              <Space wrap>
                <Input.Search
                  placeholder="搜尋名稱、描述..."
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
                  清除篩選
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
                showQuickJumper
                pageSizeOptions={['10', '20', '50', '100']}
                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 項，共 ${total} 項`}
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
            批量刪除表單
          </div>
        }
        open={isBatchDeleteModalVisible}
        onCancel={() => setIsBatchDeleteModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsBatchDeleteModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            onClick={handleBatchDelete}
            loading={loading}
          >
            確定刪除 ({selectedForms.length} 個)
          </Button>,
        ]}
        width={800}
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
              <strong>⚠️ 批量刪除警告</strong>
            </div>
            <div style={{ color: '#666' }}>
              您即將刪除 {selectedForms.length} 個表單，此操作無法撤銷。請確認要刪除的表單。
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
            批量{batchStatusAction === 'enable' ? '啟用' : '停用'}表單
          </div>
        }
        open={isBatchStatusModalVisible}
        onCancel={() => setIsBatchStatusModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsBatchStatusModalVisible(false)}>
            取消
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
            確定{batchStatusAction === 'enable' ? '啟用' : '停用'} ({selectedForms.length} 個)
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
                {batchStatusAction === 'enable' ? '✅ 批量啟用' : '⚠️ 批量停用'}
              </strong>
            </div>
            <div style={{ color: '#666' }}>
              您即將{batchStatusAction === 'enable' ? '啟用' : '停用'} {selectedForms.length} 個表單。
              {batchStatusAction === 'enable' ? '啟用後表單將可以正常使用。' : '停用後表單將無法使用，但可以重新啟用。'}
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
      
      {/* 自定義 CSS 來響應 SideMenu 折疊狀態 */}
      <style jsx>{`
        /* 響應 SideMenu 折疊狀態 */
        .ant-layout-sider-collapsed ~ * .eform-designer-container {
          margin-left: 80px !important;
          width: calc(100vw - 80px) !important;
        }
        
        /* 確保在移動設備上正確顯示 */
        @media (max-width: 768px) {
          .eform-designer-container {
            margin-left: 0 !important;
            width: 100vw !important;
          }
        }
      `}</style>
    </div>
  );
};

export default EFormListPage; 