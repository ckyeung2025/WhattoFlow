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
  Tooltip
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  TeamOutlined,
  UserOutlined,
  PaletteOutlined
} from '@ant-design/icons';
import { broadcastGroupApi, contactApi } from '../services/contactApi';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

const BroadcastGroupsPage = () => {
  const { t } = useLanguage();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
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
      const groupsData = await broadcastGroupApi.getGroups();
      setGroups(groupsData || []);
    } catch (err) {
      setError(t('broadcastGroups.loadError') + ': ' + (err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 初始載入
  useEffect(() => {
    loadGroups();
  }, []);

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
  const columns = [
    {
      title: t('broadcastGroups.groupName'),
      dataIndex: 'name',
      key: 'name',
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
      render: (date) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {new Date(date).toLocaleDateString('zh-TW')}
        </Text>
      ),
    },
    {
      title: t('broadcastGroups.actions'),
      key: 'actions',
      width: 150,
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
  ];

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
          columns={columns}
          dataSource={groups}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              t('common.pageRange', { start: range[0], end: range[1], total }),
          }}
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