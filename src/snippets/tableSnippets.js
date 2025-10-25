/**
 * 表格頁面代碼片段庫
 * 基於現有成熟頁面 (HashtagsPage, BroadcastGroupsPage, ContactListPage, WorkflowListPage) 綜合而來
 */

// 基礎導入片段
export const basicImports = `
import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Form, 
  Input, 
  Card, 
  Tag, 
  Modal, 
  message, 
  Space, 
  Typography, 
  Row, 
  Col,
  Spin,
  Tooltip,
  Pagination
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { TimezoneUtils } from '../utils/timezoneUtils';
`;

// 帶 Resizable 的導入片段
export const resizableImports = `
import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Form, 
  Input, 
  Card, 
  Tag, 
  Modal, 
  message, 
  Space, 
  Typography, 
  Row, 
  Col,
  Spin,
  Tooltip,
  Pagination
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { useLanguage } from '../contexts/LanguageContext';
import { TimezoneUtils } from '../utils/timezoneUtils';
`;

// ResizableTitle 組件
export const resizableTitle = `
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
`;

// 基礎狀態管理
export const basicState = `
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [success, setSuccess] = useState(null);
const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8');
`;

// 帶分頁的狀態管理
export const paginatedState = `
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [success, setSuccess] = useState(null);
const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8');
const [currentPage, setCurrentPage] = useState(1);
const [pageSize] = useState(20);
const [totalCount, setTotalCount] = useState(0);
const [searchTerm, setSearchTerm] = useState('');
`;

// 帶批量操作的狀態管理
export const batchOperationState = `
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [success, setSuccess] = useState(null);
const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8');
const [currentPage, setCurrentPage] = useState(1);
const [pageSize] = useState(20);
const [totalCount, setTotalCount] = useState(0);
const [searchTerm, setSearchTerm] = useState('');
const [selectedRows, setSelectedRows] = useState([]);
const [showBatchModal, setShowBatchModal] = useState(false);
`;

// 帶可調整大小的狀態管理
export const resizableState = `
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [success, setSuccess] = useState(null);
const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8');
const [currentPage, setCurrentPage] = useState(1);
const [pageSize] = useState(20);
const [totalCount, setTotalCount] = useState(0);
const [searchTerm, setSearchTerm] = useState('');
const [selectedRows, setSelectedRows] = useState([]);
const [showBatchModal, setShowBatchModal] = useState(false);
const [columnWidths, setColumnWidths] = useState({});
`;

// 模態框狀態
export const modalState = `
const [showModal, setShowModal] = useState(false);
const [editingItem, setEditingItem] = useState(null);
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [itemToDelete, setItemToDelete] = useState(null);
const [saving, setSaving] = useState(false);
const [form] = Form.useForm();
`;

// 時區處理 Effect
export const timezoneEffect = `
// 獲取用戶時區設置
useEffect(() => {
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  if (userInfo.timezone) {
    setUserTimezoneOffset(userInfo.timezone);
  }
}, []);

// 主要數據載入 useEffect (包含排序依賴項)
useEffect(() => {
  // 檢查認證狀態
  const token = localStorage.getItem('token');
  const userInfo = localStorage.getItem('userInfo');
  
  if (token && userInfo) {
    loadData();
  } else {
    setError('請先登入以訪問功能');
  }
}, [currentPage, searchTerm, selectedGroup, selectedHashtag, sortField, sortOrder]);
`;

// 基礎數據載入函數
export const basicLoadData = `
const loadData = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const response = await fetch('/api/your-endpoint', {
      headers: {
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      }
    });
    
    if (!response.ok) {
      throw new Error(\`Failed to load data: \${response.status}\`);
    }
    
    const result = await response.json();
    setData(result.data || []);
  } catch (err) {
    setError(t('common.loadError') + ': ' + (err.response?.data || err.message));
  } finally {
    setLoading(false);
  }
};
`;

// 帶分頁的數據載入函數
export const paginatedLoadData = `
const loadData = async (page = currentPage, size = pageSize, search = searchTerm) => {
  setLoading(true);
  setError(null);
  
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: size.toString()
    });
    
    if (search) {
      params.append('search', search);
    }
    
    const response = await fetch(\`/api/your-endpoint?\${params}\`, {
      headers: {
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      }
    });
    
    if (!response.ok) {
      throw new Error(\`Failed to load data: \${response.status}\`);
    }
    
    const result = await response.json();
    setData(result.data || []);
    setTotalCount(result.totalCount || 0);
    setCurrentPage(page);
  } catch (err) {
    setError(t('common.loadError') + ': ' + (err.response?.data || err.message));
  } finally {
    setLoading(false);
  }
};
`;

// 服務器端排序狀態管理
export const serverSortingState = `
// 排序狀態
const [sortField, setSortField] = useState('');
const [sortOrder, setSortOrder] = useState('');
`;

// 服務器端排序處理函數
export const serverSortingHandler = `
// 表格排序處理
const handleTableChange = (pagination, filters, sorter) => {
  // 處理排序
  if (sorter && sorter.field) {
    const newSortField = sorter.field;
    const newSortOrder = sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : '';
    
    setSortField(newSortField);
    setSortOrder(newSortOrder);
  } else {
    setSortField('');
    setSortOrder('');
  }
  
  // 處理分頁
  if (pagination.current !== currentPage) {
    setCurrentPage(pagination.current);
  }
};
`;

// 服務器端排序 API 參數
export const serverSortingParams = `
const params = {
  page: currentPage,
  pageSize: pageSize,
  search: searchTerm || undefined,
  sortField: sortField || undefined,
  sortOrder: sortOrder || undefined
};
`;

// 服務器端排序列定義
export const serverSortingColumns = `
const baseColumns = React.useMemo(() => [
  {
    title: t('table.name'),
    dataIndex: 'name',
    key: 'name',
    width: columnWidths.name,
    sorter: true,                    // 服務器端排序標記
    sortDirections: ['ascend', 'descend'],
    render: (text) => text
  },
  {
    title: t('table.createdAt'),
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: columnWidths.createdAt,
    sorter: true,                    // 服務器端排序標記
    sortDirections: ['ascend', 'descend'],
    render: (time) => time ? TimezoneUtils.formatDateWithTimezone(time, userTimezoneOffset) : '-'
  }
], [t, userTimezoneOffset, columnWidths]);
`;

// 基礎列定義模板
export const basicColumns = `
const columns = [
  {
    title: t('table.name'),
    dataIndex: 'name',
    key: 'name',
    width: 200,
    sorter: (a, b) => a.name.localeCompare(b.name),
    sortDirections: ['ascend', 'descend'],
  },
  {
    title: t('table.createdAt'),
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 150,
    sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    sortDirections: ['ascend', 'descend'],
    render: (text) => (
      <div style={{ fontSize: '12px', color: '#333' }}>
        {text ? TimezoneUtils.formatDateWithTimezone(text, userTimezoneOffset, 'MM-DD HH:mm') : '-'}
      </div>
    )
  },
  {
    title: t('table.updatedAt'),
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 150,
    sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
    sortDirections: ['ascend', 'descend'],
    render: (text) => (
      <div style={{ fontSize: '12px', color: '#333' }}>
        {text ? TimezoneUtils.formatDateWithTimezone(text, userTimezoneOffset, 'MM-DD HH:mm') : '-'}
      </div>
    )
  },
  {
    title: t('table.actions'),
    key: 'actions',
    width: 120,
    render: (_, record) => (
      <Space size="small">
        <Tooltip title={t('table.edit')}>
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          />
        </Tooltip>
        <Tooltip title={t('table.delete')}>
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDelete(record)}
          />
        </Tooltip>
      </Space>
    )
  }
];
`;

// 可調整大小的列定義
export const resizableColumns = `
const baseColumns = React.useMemo(() => [
  {
    title: t('table.name'),
    dataIndex: 'name',
    key: 'name',
    width: 200,
    sorter: (a, b) => a.name.localeCompare(b.name),
    sortDirections: ['ascend', 'descend'],
  },
  {
    title: t('table.createdAt'),
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 150,
    sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    sortDirections: ['ascend', 'descend'],
    render: (text) => (
      <div style={{ fontSize: '12px', color: '#333' }}>
        {text ? TimezoneUtils.formatDateWithTimezone(text, userTimezoneOffset, 'MM-DD HH:mm') : '-'}
      </div>
    )
  },
  {
    title: t('table.updatedAt'),
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 150,
    sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
    sortDirections: ['ascend', 'descend'],
    render: (text) => (
      <div style={{ fontSize: '12px', color: '#333' }}>
        {text ? TimezoneUtils.formatDateWithTimezone(text, userTimezoneOffset, 'MM-DD HH:mm') : '-'}
      </div>
    )
  },
  {
    title: t('table.actions'),
    key: 'actions',
    width: 120,
    render: (_, record) => (
      <Space size="small">
        <Tooltip title={t('table.edit')}>
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          />
        </Tooltip>
        <Tooltip title={t('table.delete')}>
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDelete(record)}
          />
        </Tooltip>
      </Space>
    )
  }
], [t, userTimezoneOffset]);

const resizableColumns = React.useMemo(() => 
  baseColumns.map(col => ({ 
    ...col, 
    width: columnWidths[col.key] || col.width || 120 
  }))
, [baseColumns, columnWidths]);

const handleResize = index => (e, { size }) => {
  const column = resizableColumns[index];
  setColumnWidths(prev => ({
    ...prev,
    [column.key]: size.width
  }));
};

const mergedColumns = resizableColumns.map((col, index) => ({
  ...col,
  onHeaderCell: column => ({
    width: col.width,
    onResize: handleResize(index),
  }),
}));
`;

// 表格組件配置
export const tableComponents = `
const components = {
  header: {
    cell: ResizableTitle,
  },
};
`;

// 批量選擇配置
export const rowSelection = `
const rowSelection = {
  selectedRowKeys: selectedRows.map(item => item.id),
  onChange: (selectedRowKeys, selectedRows) => {
    setSelectedRows(selectedRows);
  },
  getCheckboxProps: (record) => ({
    disabled: false,
  }),
};
`;

// 基礎表格渲染
export const basicTable = `
<Table
  columns={columns}
  dataSource={data}
  rowKey="id"
  loading={loading}
  pagination={{
    current: currentPage,
    pageSize: pageSize,
    total: totalCount,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => 
      t('table.pageRange', { start: range[0], end: range[1], total }),
    onChange: (page, size) => {
      setCurrentPage(page);
      loadData(page, size);
    },
    onShowSizeChange: (current, size) => {
      setCurrentPage(1);
      loadData(1, size);
    }
  }}
  scroll={{ x: 800 }}
/>
`;

// 可調整大小的表格渲染
export const resizableTable = `
<Table
  components={components}
  columns={mergedColumns}
  dataSource={data}
  rowKey="id"
  loading={loading}
  pagination={{
    current: currentPage,
    pageSize: pageSize,
    total: totalCount,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => 
      t('table.pageRange', { start: range[0], end: range[1], total }),
    onChange: (page, size) => {
      setCurrentPage(page);
      loadData(page, size);
    },
    onShowSizeChange: (current, size) => {
      setCurrentPage(1);
      loadData(1, size);
    }
  }}
  scroll={{ 
    x: 1200,
    y: 'calc(100vh - 300px)'
  }}
  sticky={{
    offsetHeader: 0
  }}
/>
`;

// 帶批量操作的表格渲染
export const batchOperationTable = `
<Table
  components={components}
  columns={mergedColumns}
  dataSource={data}
  rowKey="id"
  loading={loading}
  rowSelection={rowSelection}
  pagination={{
    current: currentPage,
    pageSize: pageSize,
    total: totalCount,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => 
      t('table.pageRange', { start: range[0], end: range[1], total }),
    onChange: (page, size) => {
      setCurrentPage(page);
      loadData(page, size);
    },
    onShowSizeChange: (current, size) => {
      setCurrentPage(1);
      loadData(1, size);
    }
  }}
  scroll={{ 
    x: 1200,
    y: 'calc(100vh - 300px)'
  }}
  sticky={{
    offsetHeader: 0
  }}
/>
`;

// 搜索欄
export const searchBar = `
<Card style={{ marginBottom: '16px' }}>
  <Row gutter={[8, 8]} align="middle">
    <Col flex="auto">
      <Input.Search
        placeholder={t('table.searchPlaceholder')}
        allowClear
        style={{ width: '100%' }}
        onSearch={handleSearch}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </Col>
    <Col>
      <Button 
        icon={<ReloadOutlined />} 
        onClick={() => loadData()}
        loading={loading}
      >
        {t('table.refresh')}
      </Button>
    </Col>
  </Row>
</Card>
`;

// 操作按鈕欄
export const actionBar = `
<Card style={{ marginBottom: '16px' }}>
  <Row gutter={[8, 8]} align="middle">
    <Col>
      <Button 
        type="primary" 
        icon={<PlusOutlined />} 
        onClick={() => handleAdd()}
      >
        {t('table.add')}
      </Button>
    </Col>
    {selectedRows.length > 0 && (
      <Col>
        <Button 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => handleBatchDelete()}
        >
          {t('table.batchDelete')} ({selectedRows.length})
        </Button>
      </Col>
    )}
  </Row>
</Card>
`;

// 基礎 CRUD 操作函數
export const basicCrudFunctions = `
// 新增
const handleAdd = () => {
  setEditingItem(null);
  form.resetFields();
  setShowModal(true);
};

// 編輯
const handleEdit = (record) => {
  setEditingItem(record);
  form.setFieldsValue(record);
  setShowModal(true);
};

// 刪除
const handleDelete = (record) => {
  setItemToDelete(record);
  setShowDeleteModal(true);
};

// 確認刪除
const handleConfirmDelete = async () => {
  if (!itemToDelete) return;
  
  setSaving(true);
  try {
    const response = await fetch(\`/api/your-endpoint/\${itemToDelete.id}\`, {
      method: 'DELETE',
      headers: {
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      }
    });
    
    if (!response.ok) {
      throw new Error('Delete failed');
    }
    
    message.success(t('table.deleteSuccess'));
    setShowDeleteModal(false);
    setItemToDelete(null);
    loadData();
  } catch (error) {
    message.error(t('table.deleteError') + ': ' + error.message);
  } finally {
    setSaving(false);
  }
};

// 保存
const handleSave = async () => {
  try {
    const values = await form.validateFields();
    
    setSaving(true);
    const url = editingItem ? \`/api/your-endpoint/\${editingItem.id}\` : '/api/your-endpoint';
    const method = editingItem ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      },
      body: JSON.stringify(values)
    });
    
    if (!response.ok) {
      throw new Error('Save failed');
    }
    
    message.success(editingItem ? t('table.updateSuccess') : t('table.addSuccess'));
    setShowModal(false);
    setEditingItem(null);
    form.resetFields();
    loadData();
  } catch (error) {
    message.error(t('table.saveError') + ': ' + error.message);
  } finally {
    setSaving(false);
  }
};

// 搜索
const handleSearch = (value) => {
  setSearchTerm(value);
  setCurrentPage(1);
  loadData(1, pageSize, value);
};
`;

// 批量操作函數
export const batchOperationFunctions = `
// 批量刪除
const handleBatchDelete = () => {
  setShowBatchModal(true);
};

// 確認批量刪除
const handleConfirmBatchDelete = async () => {
  setSaving(true);
  try {
    const promises = selectedRows.map(item => 
      fetch(\`/api/your-endpoint/\${item.id}\`, {
        method: 'DELETE',
        headers: {
          'Authorization': \`Bearer \${localStorage.getItem('token')}\`
        }
      })
    );
    
    await Promise.all(promises);
    
    message.success(t('table.batchDeleteSuccess', { count: selectedRows.length }));
    setShowBatchModal(false);
    setSelectedRows([]);
    loadData();
  } catch (error) {
    message.error(t('table.batchDeleteError') + ': ' + error.message);
  } finally {
    setSaving(false);
  }
};
`;

// 基礎模態框
export const basicModal = `
<Modal
  title={editingItem ? t('table.edit') : t('table.add')}
  open={showModal}
  onOk={handleSave}
  onCancel={() => {
    setShowModal(false);
    setEditingItem(null);
    form.resetFields();
  }}
  confirmLoading={saving}
  okText={t('common.confirm')}
  cancelText={t('common.cancel')}
>
  <Form form={form} layout="vertical">
    <Form.Item
      name="name"
      label={t('table.name')}
      rules={[{ required: true, message: t('table.nameRequired') }]}
    >
      <Input placeholder={t('table.namePlaceholder')} />
    </Form.Item>
  </Form>
</Modal>
`;

// 刪除確認模態框
export const deleteModal = `
<Modal
  title={t('table.confirmDelete')}
  open={showDeleteModal}
  onOk={handleConfirmDelete}
  onCancel={() => {
    setShowDeleteModal(false);
    setItemToDelete(null);
  }}
  confirmLoading={saving}
  okText={t('common.confirm')}
  cancelText={t('common.cancel')}
  okButtonProps={{ danger: true }}
>
  <p>{t('table.deleteConfirmMessage', { name: itemToDelete?.name })}</p>
</Modal>
`;

// 批量操作模態框
export const batchModal = `
<Modal
  title={t('table.batchDelete')}
  open={showBatchModal}
  onOk={handleConfirmBatchDelete}
  onCancel={() => setShowBatchModal(false)}
  confirmLoading={saving}
  okText={t('common.confirm')}
  cancelText={t('common.cancel')}
  okButtonProps={{ danger: true }}
>
  <p>{t('table.batchDeleteConfirmMessage', { count: selectedRows.length })}</p>
  <ul>
    {selectedRows.map(item => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
</Modal>
`;

// 基礎頁面結構
export const basicPageStructure = `
const YourPage = () => {
  const { t } = useLanguage();
  
  // 狀態管理
  ${basicState}
  ${modalState}
  
  // Effects
  useEffect(() => {
    loadData();
  }, []);
  
  ${timezoneEffect}
  
  // 數據載入
  ${basicLoadData}
  
  // CRUD 操作
  ${basicCrudFunctions}
  
  // 列定義
  ${basicColumns}
  
  return (
    <div style={{ padding: '16px' }}>
      <Card>
        <div style={{ marginBottom: '16px' }}>
          <Row gutter={[8, 8]} align="middle">
            <Col>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={handleAdd}
              >
                {t('table.add')}
              </Button>
            </Col>
          </Row>
        </div>
        
        ${basicTable}
      </Card>
      
      ${basicModal}
      ${deleteModal}
    </div>
  );
};

export default YourPage;
`;

// 帶分頁的頁面結構
export const paginatedPageStructure = `
const YourPage = () => {
  const { t } = useLanguage();
  
  // 狀態管理
  ${paginatedState}
  ${modalState}
  
  // Effects
  useEffect(() => {
    loadData();
  }, []);
  
  ${timezoneEffect}
  
  // 數據載入
  ${paginatedLoadData}
  
  // CRUD 操作
  ${basicCrudFunctions}
  
  // 列定義
  ${basicColumns}
  
  return (
    <div style={{ padding: '16px' }}>
      ${searchBar}
      
      <Card>
        <div style={{ marginBottom: '16px' }}>
          <Row gutter={[8, 8]} align="middle">
            <Col>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={handleAdd}
              >
                {t('table.add')}
              </Button>
            </Col>
          </Row>
        </div>
        
        ${basicTable}
      </Card>
      
      ${basicModal}
      ${deleteModal}
    </div>
  );
};

export default YourPage;
`;

// 帶批量操作的頁面結構
export const batchOperationPageStructure = `
const YourPage = () => {
  const { t } = useLanguage();
  
  // 狀態管理
  ${batchOperationState}
  ${modalState}
  
  // Effects
  useEffect(() => {
    loadData();
  }, []);
  
  ${timezoneEffect}
  
  // 數據載入
  ${paginatedLoadData}
  
  // CRUD 操作
  ${basicCrudFunctions}
  ${batchOperationFunctions}
  
  // 列定義
  ${basicColumns}
  
  // 批量選擇配置
  ${rowSelection}
  
  return (
    <div style={{ padding: '16px' }}>
      ${searchBar}
      
      <Card>
        ${actionBar}
        
        ${batchOperationTable}
      </Card>
      
      ${basicModal}
      ${deleteModal}
      ${batchModal}
    </div>
  );
};

export default YourPage;
`;

// 帶可調整大小的頁面結構
export const resizablePageStructure = `
const YourPage = () => {
  const { t } = useLanguage();
  
  // 狀態管理
  ${resizableState}
  ${modalState}
  
  // Effects
  useEffect(() => {
    loadData();
  }, []);
  
  ${timezoneEffect}
  
  // 數據載入
  ${paginatedLoadData}
  
  // CRUD 操作
  ${basicCrudFunctions}
  ${batchOperationFunctions}
  
  // 列定義
  ${resizableColumns}
  
  // 表格組件配置
  ${tableComponents}
  
  // 批量選擇配置
  ${rowSelection}
  
  return (
    <div style={{ padding: '16px' }}>
      ${searchBar}
      
      <Card>
        ${actionBar}
        
        ${resizableTable}
      </Card>
      
      ${basicModal}
      ${deleteModal}
      ${batchModal}
    </div>
  );
};

export default YourPage;
`;

// 分頁狀態管理
export const paginationState = `
// 分頁狀態
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(20);
const [totalCount, setTotalCount] = useState(0);
`;

// 分頁處理函數
export const paginationHandler = `
// 表格變更處理函數 (包含分頁和排序)
const handleTableChange = (pagination, filters, sorter) => {
  // 處理排序
  if (sorter && sorter.field) {
    const newSortField = sorter.field;
    const newSortOrder = sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : '';
    
    setSortField(newSortField);
    setSortOrder(newSortOrder);
  } else {
    setSortField('');
    setSortOrder('');
  }
  
  // 處理分頁
  if (pagination.current !== currentPage) {
    setCurrentPage(pagination.current);
  }
  if (pagination.pageSize !== pageSize) {
    setPageSize(pagination.pageSize);
    setCurrentPage(1); // 重置到第一頁
  }
};
`;

// 分頁 API 參數
export const paginationParams = `
const params = {
  page: currentPage,
  pageSize: pageSize,
  search: searchTerm || undefined,
  sortField: sortField || undefined,
  sortOrder: sortOrder || undefined
};
`;

// 分頁組件配置
export const paginationConfig = `
pagination={{
  current: currentPage,
  pageSize: pageSize,
  total: totalCount,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total, range) => 
    t('common.pageRange', { start: range[0], end: range[1], total }),
  pageSizeOptions: ['10', '20', '50', '100'],
}}
`;

// HashtagsPage 特定配置
export const hashtagsConfig = {
  // 列寬配置
  columnWidths: {
    name: 200,
    description: 250,
    usage: 120,
    color: 120,
    createdAt: 150,
    actions: 150
  },
  
  // 列定義模板
  columns: `
const baseColumns = React.useMemo(() => [
  {
    title: t('hashtags.tagName'),
    dataIndex: 'name',
    key: 'name',
    width: columnWidths.name,
    sorter: true,
    sortDirections: ['ascend', 'descend'],
    render: (text, record) => (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Tag color={record.color || '#1890ff'} style={{ marginRight: '8px' }}>
          #{text}
        </Tag>
      </div>
    ),
  },
  {
    title: t('hashtags.description'),
    dataIndex: 'description',
    key: 'description',
    width: columnWidths.description,
    sorter: true,
    sortDirections: ['ascend', 'descend'],
    render: (text) => (
      <Text type="secondary">{text || '無描述'}</Text>
    ),
  },
  {
    title: t('hashtags.usageCount'),
    dataIndex: 'usage',
    key: 'usage',
    width: columnWidths.usage,
    render: (_, record) => (
      <Tag icon={<UserOutlined />} color="blue">
        {hashtagStats[record.id] || 0}
      </Tag>
    ),
  },
  {
    title: t('hashtags.color'),
    dataIndex: 'color',
    key: 'color',
    width: columnWidths.color,
    sorter: true,
    sortDirections: ['ascend', 'descend'],
    render: (color) => (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ 
          width: '20px', 
          height: '20px', 
          backgroundColor: color || '#1890ff',
          borderRadius: '4px',
          marginRight: '8px'
        }} />
        <Text code style={{ fontSize: '12px' }}>
          {color || '#1890ff'}
        </Text>
      </div>
    ),
  },
  {
    title: t('hashtags.createdAt'),
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: columnWidths.createdAt,
    sorter: true,
    sortDirections: ['ascend', 'descend'],
    render: (date) => (
      <Text type="secondary" style={{ fontSize: '12px' }}>
        {date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset) : '-'}
      </Text>
    ),
  },
  {
    title: t('hashtags.actions'),
    key: 'actions',
    width: columnWidths.actions,
    render: (_, record) => (
      <Space>
        <Tooltip title={t('hashtags.edit')}>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          />
        </Tooltip>
        <Tooltip title={t('hashtags.delete')}>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleOpenDeleteModal(record)}
            disabled={hashtagStats[record.id] > 0}
          />
        </Tooltip>
      </Space>
    ),
  },
], [t, userTimezoneOffset, hashtagStats, columnWidths]);
`,
  
  // API 調用模板
  loadData: `
const loadHashtags = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const params = {
      page: currentPage,
      pageSize: pageSize,
      search: searchTerm || undefined,
      sortField: sortField || undefined,
      sortOrder: sortOrder || undefined
    };
    
    const response = await hashtagApi.getHashtags(params);
    
    // 處理新的 API 響應格式
    const hashtagsData = response?.data || response || [];
    setHashtags(hashtagsData);
    setTotalCount(response?.total || hashtagsData.length);
    
    // 載入每個標籤的使用次數
    const stats = {};
    for (const hashtag of hashtagsData) {
      try {
        const contactsResponse = await contactApi.getContacts({
          hashtagFilter: hashtag.name,
          pageSize: 1
        });
        stats[hashtag.id] = contactsResponse.totalCount || 0;
      } catch (err) {
        stats[hashtag.id] = 0;
      }
    }
    setHashtagStats(stats);
  } catch (err) {
    setError(t('hashtags.loadError') + ': ' + (err.response?.data || err.message));
  } finally {
    setLoading(false);
  }
};
`
};