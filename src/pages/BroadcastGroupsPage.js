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
  ColorPicker,
  InputNumber,
  Spin,
  Tooltip,
  Pagination
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  TeamOutlined,
  UserOutlined,
  PaletteOutlined
} from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { broadcastGroupApi, contactApi } from '../services/contactApi';
import { useLanguage } from '../contexts/LanguageContext';
import TimezoneUtils from '../utils/timezoneUtils';

const { Title, Text } = Typography;
const { TextArea } = Input;

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

const BroadcastGroupsPage = () => {
  const { t } = useLanguage();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // 用戶時區偏移狀態
  const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8');
  
  // 分頁和排序狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  
  // 列寬狀態
  const [columnWidths, setColumnWidths] = useState({
    name: 200,
    color: 120,
    contactCount: 120,
    createdAt: 150,
    updatedAt: 150,
    actions: 150
  });
  
  // 模態框狀態
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // 表單
  const [form] = Form.useForm();

  // 載入群組列表
  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        page: currentPage,
        pageSize: pageSize,
        search: undefined, // 可以添加搜索功能
        sortField: sortField || undefined,
        sortOrder: sortOrder || undefined
      };
      
      const response = await broadcastGroupApi.getGroups(params);
      
      if (response.data && response.total !== undefined) {
        setGroups(response.data || []);
        setTotalCount(response.total);
      } else {
        // 兼容舊的 API 格式
        setGroups(response || []);
        setTotalCount(response?.length || 0);
      }
    } catch (err) {
      setError(t('broadcastGroups.loadError') + ': ' + (err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 初始載入和數據重新載入
  useEffect(() => {
    loadGroups();
  }, [currentPage, pageSize, sortField, sortOrder]);

  // 獲取用戶時區設置
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (userInfo.timezone) {
      setUserTimezoneOffset(userInfo.timezone);
    }
  }, []);

  // 表格變更處理函數
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
  };

  // 開啟新增/編輯模態框
  const handleOpenModal = (group = null) => {
    setEditingGroup(group);
    form.setFieldsValue({
      name: group?.name || '',
      description: group?.description || '',
      color: group?.color || '#1890ff'
    });
    setShowModal(true);
  };

  // 關閉模態框
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingGroup(null);
    form.resetFields();
  };

  // 表單提交
  const handleSubmit = async (values) => {
    console.log('🚀 BroadcastGroupsPage - Form submit started');
    console.log('📋 BroadcastGroupsPage - Form values:', values);
    console.log('📋 BroadcastGroupsPage - IsEdit:', !!editingGroup);
    console.log('📋 BroadcastGroupsPage - EditingGroup ID:', editingGroup?.id);
    
    setSaving(true);
    try {
      if (editingGroup) {
        console.log('📤 BroadcastGroupsPage - Calling updateGroup with ID:', editingGroup.id);
        await broadcastGroupApi.updateGroup(editingGroup.id, values);
        message.success(t('broadcastGroups.updateSuccess'));
      } else {
        console.log('📤 BroadcastGroupsPage - Calling createGroup');
        await broadcastGroupApi.createGroup(values);
        message.success(t('broadcastGroups.createSuccess'));
      }
      handleCloseModal();
      loadGroups();
    } catch (err) {
      console.error('BroadcastGroupsPage - Submit error:', err);
      console.error('Error response:', err.response?.data);
      
      let errorMessage = err.response?.data || err.message;
      if (err.response?.data?.errors) {
        // 處理驗證錯誤
        console.error('Validation errors:', err.response.data.errors);
        const validationErrors = Object.values(err.response.data.errors).flat();
        console.error('Flattened validation errors:', validationErrors);
        errorMessage = validationErrors.join(', ');
      }
      
      message.error((editingGroup ? t('broadcastGroups.updateError') : t('broadcastGroups.createError')) + ': ' + errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // 開啟刪除確認
  const handleOpenDeleteModal = (group) => {
    setGroupToDelete(group);
    setShowDeleteModal(true);
  };

  // 刪除群組
  const handleDeleteGroup = async () => {
    try {
      await broadcastGroupApi.deleteGroup(groupToDelete.id);
      message.success(t('broadcastGroups.deleteSuccess'));
      setShowDeleteModal(false);
      setGroupToDelete(null);
      loadGroups();
    } catch (err) {
      message.error(t('broadcastGroups.deleteError') + ': ' + (err.response?.data || err.message));
    }
  };

  // 預設顏色選項
  const colorOptions = [
    '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
    '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#8c8c8c'
  ];

  // 表格列定義
  const baseColumns = React.useMemo(() => [
    {
      title: t('broadcastGroups.groupName'),
      dataIndex: 'name',
      key: 'name',
      width: columnWidths.name,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          {record.description && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.description}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: t('broadcastGroups.groupColor'),
      dataIndex: 'color',
      key: 'color',
      width: columnWidths.color,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      render: (color) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div 
            style={{ 
              width: '20px', 
              height: '20px', 
              backgroundColor: color || '#1890ff',
              borderRadius: '4px',
              marginRight: '8px'
            }}
          />
          <Text code style={{ fontSize: '12px' }}>
            {color || '#1890ff'}
          </Text>
        </div>
      ),
    },
    {
      title: t('broadcastGroups.contactCount'),
      dataIndex: 'contactCount',
      key: 'contactCount',
      width: columnWidths.contactCount,
      render: (count) => (
        <Tag icon={<UserOutlined />} color="blue">
          {count || 0}
        </Tag>
      ),
    },
    {
      title: t('broadcastGroups.createdAt'),
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
      title: t('broadcastGroups.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: columnWidths.updatedAt,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      render: (date) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset) : '-'}
        </Text>
      ),
    },
    {
      title: t('broadcastGroups.actions'),
      key: 'actions',
      width: columnWidths.actions,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('broadcastGroups.edit')}>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleOpenModal(record)}
            />
          </Tooltip>
          <Tooltip title={t('broadcastGroups.delete')}>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleOpenDeleteModal(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ], [t, userTimezoneOffset, columnWidths]);

  // 列寬調整處理函數
  const handleResize = (index) => (e, { size }) => {
    const columnKeys = Object.keys(columnWidths);
    const columnKey = columnKeys[index];
    if (columnKey) {
      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: size.width
      }));
    }
  };

  // 可調整大小的列
  const resizableColumns = React.useMemo(() => 
    baseColumns.map((col, index) => ({
      ...col,
      onHeaderCell: column => ({
        width: col.width,
        onResize: handleResize(index),
      }),
    }))
  , [baseColumns]);

  // 表格組件配置
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 頁面標題 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Button 
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
          >
            {t('broadcastGroups.addGroup')}
          </Button>
        </Col>
        <Col>
          <Title level={2} style={{ margin: 0, textAlign: 'right' }}>{t('broadcastGroups.title')}</Title>
          <Text type='secondary' style={{ textAlign: 'right', display: 'block' }}>{t('broadcastGroups.description')}</Text>
        </Col>
      </Row>

      {/* 訊息提示 */}
      {error && (
        <div style={{ marginBottom: '16px' }}>
          <Text type="danger">{error}</Text>
        </div>
      )}

      {/* 群組列表 */}
      <Card>
        <Table
          columns={resizableColumns}
          dataSource={groups}
          rowKey="id"
          loading={loading}
          onChange={handleTableChange}
          components={components}
          pagination={false}
          scroll={{ x: 1200, y: 'calc(100vh - 300px)' }}
          sticky={{ offsetHeader: 0 }}
          locale={{
            emptyText: (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <TeamOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                <div style={{ fontSize: '16px', color: '#999' }}>{t('broadcastGroups.noGroupsFound')}</div>
                <div style={{ fontSize: '14px', color: '#999' }}>{t('broadcastGroups.noGroupsDescription')}</div>
              </div>
            ),
          }}
        />
        <div style={{ marginTop: 16, textAlign: 'left' }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={totalCount}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={['10', '20', '50', '100']}
            showTotal={(total, range) => 
              `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`
            }
            onChange={(page, pageSize) => {
              setCurrentPage(page);
              setPageSize(pageSize);
            }}
            onShowSizeChange={(current, size) => {
              setCurrentPage(1);
              setPageSize(size);
            }}
          />
        </div>
      </Card>

      {/* 新增/編輯群組模態框 */}
      <Modal
        title={editingGroup ? t('broadcastGroups.editGroup') : t('broadcastGroups.addGroup')}
        open={showModal}
        onCancel={handleCloseModal}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onFinishFailed={(errorInfo) => {
            console.error('Form validation failed:', errorInfo);
            message.error(t('broadcastGroups.formValidationFailed'));
          }}
        >
          <Form.Item 
            name="name" 
            label={t('broadcastGroups.groupName')} 
            rules={[{ required: true, message: t('broadcastGroups.nameRequired') }]}
          >
            <Input placeholder={t('broadcastGroups.namePlaceholder')} />
          </Form.Item>

          <Form.Item name="description" label={t('broadcastGroups.groupDescription')}>
            <TextArea
              rows={3}
              placeholder={t('broadcastGroups.descriptionPlaceholder')}
            />
          </Form.Item>

          <Form.Item name="color" label={t('broadcastGroups.groupColor')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <ColorPicker
                onChange={(color) => form.setFieldValue('color', color.toHexString())}
                showText
              />
              <div>
                <div 
                  style={{ 
                    width: '30px', 
                    height: '30px', 
                    backgroundColor: form.getFieldValue('color') || '#1890ff',
                    borderRadius: '4px',
                    border: '1px solid #d9d9d9'
                  }}
                />
              </div>
            </div>
            
            {/* 預設顏色選項 */}
            <div style={{ marginTop: '12px' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                {t('broadcastGroups.quickSelect')}
              </Text>
              <Space wrap>
                {colorOptions.map(color => (
                  <div
                    key={color}
                    style={{ 
                      width: '24px', 
                      height: '24px', 
                      backgroundColor: color,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: (form.getFieldValue('color') || '#1890ff') === color ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      opacity: (form.getFieldValue('color') || '#1890ff') === color ? 1 : 0.7
                    }}
                    onClick={() => form.setFieldValue('color', color)}
                  />
                ))}
              </Space>
            </div>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCloseModal}>
                {t('broadcastGroups.cancel')}
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={saving}
              >
                {editingGroup ? t('broadcastGroups.update') : t('broadcastGroups.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 刪除確認模態框 */}
      <Modal
        title={t('broadcastGroups.confirmDelete')}
        open={showDeleteModal}
        onOk={handleDeleteGroup}
        onCancel={() => setShowDeleteModal(false)}
        okText={t('broadcastGroups.delete')}
        cancelText={t('broadcastGroups.cancel')}
        okButtonProps={{ danger: true }}
      >
        <p>{t('broadcastGroups.confirmDeleteMessage', { name: groupToDelete?.name })}</p>
      </Modal>
    </div>
  );
};

export default BroadcastGroupsPage;