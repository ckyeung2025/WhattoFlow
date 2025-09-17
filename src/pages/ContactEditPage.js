import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  Select, 
  Tag, 
  Space, 
  Typography, 
  Row, 
  Col,
  message,
  Spin,
  Divider,
  App
} from 'antd';
import { 
  SaveOutlined, 
  ArrowLeftOutlined, 
  UserOutlined,
  TagOutlined,
  PlusOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { contactApi, broadcastGroupApi, hashtagApi } from '../services/contactApi';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const ContactEditPageContent = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useLanguage();
  const isEdit = !!id;
  
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();
  
  // 選項數據
  const [groups, setGroups] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [availableHashtags, setAvailableHashtags] = useState([]);
  
  // 表單數據
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    occupation: '',
    whatsappNumber: '',
    email: '',
    companyName: '',
    department: '',
    position: '',
    hashtags: '',
    broadcastGroupId: '',
    isActive: true
  });

  // 載入選項數據
  const loadOptions = async () => {
    try {
      const [groupsResponse, hashtagsResponse] = await Promise.all([
        broadcastGroupApi.getGroups(),
        hashtagApi.getHashtags()
      ]);
      setGroups(groupsResponse || []);
      setHashtags(hashtagsResponse || []);
      setAvailableHashtags(hashtagsResponse || []);
    } catch (err) {
      console.error('載入選項數據失敗：', err);
    }
  };

  // 載入聯絡人數據
  const loadContact = async () => {
    if (!isEdit) return;
    
    setLoading(true);
    try {
      const contact = await contactApi.getContact(id);
      setFormData(contact);
      form.setFieldsValue(contact);
    } catch (err) {
      message.error(t('contactList.loadError') + ': ' + (err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 初始載入
  useEffect(() => {
    loadOptions();
    if (isEdit) {
      loadContact();
    }
  }, [id]);

  // 表單提交
  const handleSubmit = async (values) => {
    console.log('🚀 ContactEditPage - Form submit started');
    console.log('📋 ContactEditPage - Form values:', values);
    console.log('📋 ContactEditPage - Form values JSON:', JSON.stringify(values, null, 2));
    console.log('🔧 ContactEditPage - IsEdit:', isEdit);
    console.log('🔧 ContactEditPage - ID:', id);
    
    setSaving(true);
    try {
      if (isEdit) {
        console.log('📤 ContactEditPage - Calling updateContact with ID:', id);
        await contactApi.updateContact(id, values);
        message.success(t('contactList.updateSuccess'));
      } else {
        console.log('📤 ContactEditPage - Calling createContact');
        await contactApi.createContact(values);
        message.success(t('contactList.createSuccess'));
      }
      navigate('/contacts');
    } catch (err) {
      console.error('ContactEditPage - Submit error:', err);
      console.error('Error response:', err.response?.data);
      
      let errorMessage = err.response?.data || err.message;
      if (err.response?.data?.errors) {
        // 處理驗證錯誤
        console.error('Validation errors:', err.response.data.errors);
        const validationErrors = Object.values(err.response.data.errors).flat();
        console.error('Flattened validation errors:', validationErrors);
        errorMessage = validationErrors.join(', ');
      }
      
      message.error((isEdit ? t('contactList.updateError') : t('contactList.createError')) + ': ' + errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // 添加標籤
  const handleAddHashtag = (hashtag) => {
    const currentValue = form.getFieldValue('hashtags') || '';
    const currentTags = currentValue ? currentValue.split(',').map(t => t.trim()) : [];
    if (!currentTags.includes(hashtag)) {
      const newTags = [...currentTags, hashtag].join(', ');
      form.setFieldValue('hashtags', newTags);
      setFormData(prev => ({ ...prev, hashtags: newTags }));
    }
  };

  // 移除標籤
  const handleRemoveHashtag = (hashtag) => {
    const currentValue = form.getFieldValue('hashtags') || '';
    const currentTags = currentValue ? currentValue.split(',').map(t => t.trim()) : [];
    const newTags = currentTags.filter(tag => tag !== hashtag).join(', ');
    form.setFieldValue('hashtags', newTags);
    setFormData(prev => ({ ...prev, hashtags: newTags }));
  };

  // 格式化標籤顯示
  const formatHashtags = (hashtags) => {
    if (!hashtags) return [];
    return hashtags.split(',').map(tag => tag.trim()).filter(tag => tag);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Spin spinning={loading}>
        {/* 頁面標題 */}
        <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
          <Col>
            <Button 
              type="primary"
              shape="square"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/contacts')}
              style={{ 
                width: '40px', 
                height: '40px',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </Col>
          <Col>
            <Title level={2} style={{ margin: 0, textAlign: 'right' }}>
              {t('contactList.management')}
            </Title>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={16}>
            {/* 聯絡人表單 */}
            <Card>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                onFinishFailed={(errorInfo) => {
                  console.error('Form validation failed:', errorInfo);
                  message.error(t('contactList.formValidationFailed'));
                }}
                initialValues={formData}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="name"
                      label={t('contactList.name')}
                      rules={[{ required: true, message: t('contactList.nameRequired') }]}
                    >
                      <Input placeholder={t('contactList.namePlaceholder')} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="title"
                      label={t('contactList.title')}
                    >
                      <Input placeholder={t('contactList.titlePlaceholder')} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="occupation"
                      label={t('contactList.occupation')}
                    >
                      <Input placeholder={t('contactList.occupationPlaceholder')} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="position"
                      label={t('contactList.position')}
                    >
                      <Input placeholder={t('contactList.positionPlaceholder')} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="whatsappNumber"
                      label={t('contactList.whatsappNumber')}
                    >
                      <Input placeholder={t('contactList.whatsappPlaceholder')} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="email"
                      label={t('contactList.email')}
                    >
                      <Input placeholder={t('contactList.emailPlaceholder')} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="companyName"
                      label={t('contactList.companyName')}
                    >
                      <Input placeholder={t('contactList.companyPlaceholder')} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="department"
                      label={t('contactList.department')}
                    >
                      <Input placeholder={t('contactList.departmentPlaceholder')} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="broadcastGroupId"
                  label={t('contactList.broadcastGroup')}
                  rules={[{ required: true, message: t('contactList.broadcastGroupRequired') }]}
                >
                  <Select placeholder={t('contactList.broadcastGroupPlaceholder')} allowClear>
                    {groups.map(group => (
                      <Option key={group.id} value={group.id}>
                        {group.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="hashtags"
                  label={t('contactList.hashtags')}
                >
                  <Input 
                    placeholder={t('contactList.hashtagsPlaceholder')}
                    value={formData.hashtags}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, hashtags: e.target.value }));
                    }}
                  />
                </Form.Item>

                {/* 標籤顯示 */}
                {formatHashtags(formData.hashtags).length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <Text type='secondary'>{t('contactList.currentTags')}</Text>
                    <div style={{ marginTop: '8px' }}>
                      <Space wrap>
                        {formatHashtags(formData.hashtags).map((tag, index) => (
                          <Tag
                            key={index}
                            closable
                            onClose={() => handleRemoveHashtag(tag)}
                            color="blue"
                          >
                            #{tag}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  </div>
                )}

                {/* 隱藏欄位 */}
                <Form.Item name="isActive" hidden>
                  <Input type="hidden" />
                </Form.Item>

                <Form.Item>
                  <Space>
                    <Button 
                      type="primary" 
                      htmlType="submit"
                      icon={<SaveOutlined />}
                      loading={saving}
                    >
                      {isEdit ? t('contactList.update') : t('contactList.create')}
                    </Button>
                    <Button onClick={() => navigate('/contacts')}>
                      {t('contactList.cancel')}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          </Col>

          <Col span={8}>
            {/* 快速添加標籤 */}
            <Card title={t('contactList.quickAddTags')} size='small'>
              <Space wrap>
                {availableHashtags.map(hashtag => (
                  <Tag
                    key={hashtag.id}
                    color={hashtag.color || 'blue'}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleAddHashtag(hashtag.name)}
                  >
                    #{hashtag.name}
                  </Tag>
                ))}
              </Space>
            </Card>

            {/* 預覽 */}
            <Card title={t('contactList.preview')} size='small' style={{ marginTop: '16px' }}>
              <div>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>{formData.name || t('contactList.name')}</Text>
                  {formData.title && (
                    <Text type="secondary" style={{ marginLeft: '8px' }}>
                      {formData.title}
                    </Text>
                  )}
                </div>
                
                {formData.whatsappNumber && (
                  <div style={{ marginBottom: '4px' }}>
                    <Text type="secondary">📱 {formData.whatsappNumber}</Text>
                  </div>
                )}
                
                {formData.email && (
                  <div style={{ marginBottom: '4px' }}>
                    <Text type="secondary">✉️ {formData.email}</Text>
                  </div>
                )}
                
                {formData.companyName && (
                  <div style={{ marginBottom: '4px' }}>
                    <Text type="secondary">🏢 {formData.companyName}</Text>
                  </div>
                )}
                
                {formData.department && (
                  <div style={{ marginBottom: '4px' }}>
                    <Text type="secondary">🏬 {formData.department}</Text>
                  </div>
                )}
                
                {formatHashtags(formData.hashtags).length > 0 && (
                  <div>
                    <Text type='secondary'>{t('contactList.tagsLabel')}</Text>
                    <div style={{ marginTop: '4px' }}>
                      <Space wrap>
                        {formatHashtags(formData.hashtags).map((tag, index) => (
                          <Tag key={index} color="blue">#{tag}</Tag>
                        ))}
                      </Space>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

const ContactEditPage = () => {
  return (
    <App>
      <ContactEditPageContent />
    </App>
  );
};

export default ContactEditPage;