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
  Spin,
  Tooltip
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  TagOutlined,
  UserOutlined,
  PaletteOutlined
} from '@ant-design/icons';
import { hashtagApi, contactApi } from '../services/contactApi';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

const HashtagsPage = () => {
  const { t } = useLanguage();
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 標籤統計
  const [hashtagStats, setHashtagStats] = useState({});
  
  // 模態框狀態
  const [showModal, setShowModal] = useState(false);
  const [editingHashtag, setEditingHashtag] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [hashtagToDelete, setHashtagToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // 表單
  const [form] = Form.useForm();

  // 載入標籤列表
  const loadHashtags = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const hashtagsData = await hashtagApi.getHashtags();
      setHashtags(hashtagsData || []);
      
      // 載入每個標籤的使用次數
      const stats = {};
      for (const hashtag of hashtagsData || []) {
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

  // 初始載入
  useEffect(() => {
    loadHashtags();
  }, []);

  // 搜尋過濾
  const filteredHashtags = hashtags.filter(hashtag =>
    hashtag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (hashtag.description && hashtag.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 開啟新增/編輯模態框
  const handleOpenModal = (hashtag = null) => {
    setEditingHashtag(hashtag);
    form.setFieldsValue({
      name: hashtag?.name || '',
      description: hashtag?.description || '',
      color: hashtag?.color || '#1890ff'
    });
    setShowModal(true);
  };

  // 關閉模態框
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingHashtag(null);
    form.resetFields();
  };

  // 表單提交
  const handleSubmit = async (values) => {
    console.log('🚀 HashtagsPage - Form submit started');
    console.log('📋 HashtagsPage - Form values:', values);
    console.log('📋 HashtagsPage - IsEdit:', !!editingHashtag);
    console.log('📋 HashtagsPage - EditingHashtag ID:', editingHashtag?.id);
    
    setSaving(true);
    try {
      if (editingHashtag) {
        console.log('📤 HashtagsPage - Calling updateHashtag with ID:', editingHashtag.id);
        await hashtagApi.updateHashtag(editingHashtag.id, values);
        message.success(t('hashtags.updateSuccess'));
      } else {
        console.log('📤 HashtagsPage - Calling createHashtag');
        await hashtagApi.createHashtag(values);
        message.success(t('hashtags.createSuccess'));
      }
      handleCloseModal();
      loadHashtags();
    } catch (err) {
      console.error('HashtagsPage - Submit error:', err);
      console.error('Error response:', err.response?.data);
      
      let errorMessage = err.response?.data || err.message;
      if (err.response?.data?.errors) {
        // 處理驗證錯誤
        console.error('Validation errors:', err.response.data.errors);
        const validationErrors = Object.values(err.response.data.errors).flat();
        console.error('Flattened validation errors:', validationErrors);
        errorMessage = validationErrors.join(', ');
      }
      
      message.error((editingHashtag ? t('hashtags.updateError') : t('hashtags.createError')) + ': ' + errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // 開啟刪除確認
  const handleOpenDeleteModal = (hashtag) => {
    setHashtagToDelete(hashtag);
    setShowDeleteModal(true);
  };

  // 刪除標籤
  const handleDeleteHashtag = async () => {
    try {
      await hashtagApi.deleteHashtag(hashtagToDelete.id);
      message.success(t('hashtags.deleteSuccess'));
      setShowDeleteModal(false);
      setHashtagToDelete(null);
      loadHashtags();
    } catch (err) {
      message.error(t('hashtags.deleteError') + ': ' + (err.response?.data || err.message));
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
      title: t('hashtags.tagName'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Tag 
            color={record.color || '#1890ff'}
            style={{ marginRight: '8px' }}
          >
            #{text}
          </Tag>
        </div>
      ),
    },
    {
      title: t('hashtags.description'),
      dataIndex: 'description',
      key: 'description',
      render: (text) => (
        <Text type="secondary">
          {text || '無描述'}
        </Text>
      ),
    },
    {
      title: t('hashtags.usageCount'),
      dataIndex: 'usage',
      key: 'usage',
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
      title: t('hashtags.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {new Date(date).toLocaleDateString('zh-TW')}
        </Text>
      ),
    },
    {
      title: t('hashtags.actions'),
      key: 'actions',
      width: 150,
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
            {t('hashtags.addTag')}
          </Button>
        </Col>
        <Col>
          <Title level={2} style={{ margin: 0, textAlign: 'right' }}>{t('hashtags.title')}</Title>
          <Text type='secondary' style={{ textAlign: 'right', display: 'block' }}>{t('hashtags.description')}</Text>
        </Col>
      </Row>

      {/* 搜尋 */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input
              placeholder={t('hashtags.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              prefix={<TagOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* 標籤列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredHashtags}
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
                <TagOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                <div style={{ fontSize: '16px', color: '#999' }}>{t('hashtags.noTagsFound')}</div>
                <div style={{ fontSize: '14px', color: '#999' }}>
                  {searchTerm ? t('hashtags.adjustSearch') : t('hashtags.addTag')}
                </div>
              </div>
            ),
          }}
        />
      </Card>

      {/* 新增/編輯標籤模態框 */}
      <Modal
        title={editingHashtag ? t('hashtags.editTag') : t('hashtags.addTag')}
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
            message.error(t('hashtags.formValidationFailed'));
          }}
        >
          <Form.Item 
            name="name" 
            label={t('hashtags.tagName')} 
            rules={[{ required: true, message: t('hashtags.nameRequired') }]}
          >
            <Input placeholder={t('hashtags.namePlaceholder')} />
          </Form.Item>

          <Form.Item name="description" label={t('hashtags.description')}>
            <TextArea
              rows={3}
              placeholder={t('hashtags.descriptionPlaceholder')}
            />
          </Form.Item>

          <Form.Item name="color" label={t('hashtags.color')}>
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
                {t('hashtags.quickSelect')}
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
                {t('hashtags.cancel')}
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={saving}
              >
                {editingHashtag ? t('hashtags.update') : t('hashtags.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 刪除確認模態框 */}
      <Modal
        title={t('hashtags.confirmDelete')}
        open={showDeleteModal}
        onOk={handleDeleteHashtag}
        onCancel={() => setShowDeleteModal(false)}
        okText={t('hashtags.delete')}
        cancelText={t('hashtags.cancel')}
        okButtonProps={{ danger: true }}
      >
        <p>{t('hashtags.confirmDeleteMessage', { name: hashtagToDelete?.name })}</p>
        {hashtagStats[hashtagToDelete?.id] > 0 && (
          <div style={{ 
            background: '#fff7e6', 
            border: '1px solid #ffd591', 
            borderRadius: '6px', 
            padding: '12px', 
            marginTop: '12px' 
          }}>
            <Text type="warning">
              {t('hashtags.cannotDeleteMessage', { count: hashtagStats[hashtagToDelete?.id] })}
            </Text>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HashtagsPage;