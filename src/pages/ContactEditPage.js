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
  console.log('🚀 ContactEditPageContent - Component initialized');
  
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useLanguage();
  const isEdit = !!id;
  
  console.log('🔧 ContactEditPageContent - Params:', { id, isEdit });
  
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
    whatsapp_number: '',
    email: '',
    company_name: '',
    department: '',
    position: '',
    hashtags: '',
    broadcast_group_id: '',
    is_active: true
  });

  // 載入選項數據
  const loadOptions = async () => {
    console.log('📋 ContactEditPageContent - Loading options data');
    try {
      const [groupsResponse, hashtagsResponse] = await Promise.all([
        broadcastGroupApi.getGroups(),
        hashtagApi.getHashtags()
      ]);
      console.log('📋 ContactEditPageContent - Groups response:', groupsResponse);
      console.log('📋 ContactEditPageContent - Hashtags response:', hashtagsResponse);
      
      // 確保 groups 是數組
      const groupsData = Array.isArray(groupsResponse) ? groupsResponse : 
                        (groupsResponse?.data && Array.isArray(groupsResponse.data)) ? groupsResponse.data : [];
      
      // 確保 hashtags 是數組
      const hashtagsData = Array.isArray(hashtagsResponse) ? hashtagsResponse : 
                          (hashtagsResponse?.data && Array.isArray(hashtagsResponse.data)) ? hashtagsResponse.data : [];
      
      setGroups(groupsData);
      setHashtags(hashtagsData);
      setAvailableHashtags(hashtagsData);
      
      console.log('📋 ContactEditPageContent - Options loaded successfully');
    } catch (err) {
      console.error('載入選項數據失敗：', err);
      // 設置默認空數組
      setGroups([]);
      setHashtags([]);
      setAvailableHashtags([]);
    }
  };

  // 載入聯絡人數據
  const loadContact = async () => {
    if (!isEdit) return;
    
    setLoading(true);
    try {
      console.log('📥 ContactEditPage - Loading contact with ID:', id);
      const contact = await contactApi.getContact(id);
      console.log('📥 ContactEditPage - Loaded contact data:', contact);
      console.log('📱 ContactEditPage - Loaded whatsapp_number:', contact.whatsapp_number);
      console.log('📱 ContactEditPage - Loaded whatsapp_number type:', typeof contact.whatsapp_number);
      
      setFormData(contact);
      form.setFieldsValue(contact);
      
      // 檢查表單欄位是否正確設置
      const formValues = form.getFieldsValue();
      console.log('📋 ContactEditPage - Form values after setting:', formValues);
      console.log('📱 ContactEditPage - Form whatsapp_number:', formValues.whatsapp_number);
    } catch (err) {
      console.error('ContactEditPage - Load contact error:', err);
      message.error(t('contactList.loadError') + ': ' + (err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 初始載入
  useEffect(() => {
    console.log('🔥 ContactEditPageContent - useEffect triggered');
    console.log('🔥 ContactEditPageContent - useEffect dependencies:', { id, isEdit });
    
    loadOptions();
    if (isEdit) {
      console.log('🔥 ContactEditPageContent - Loading contact for edit mode');
      loadContact();
    } else {
      console.log('🔥 ContactEditPageContent - Creating new contact');
    }
  }, [id]);

  // 表單提交
  const handleSubmit = async (values) => {
    console.log('🚀 ContactEditPage - Form submit started');
    console.log('📋 ContactEditPage - Form values:', values);
    console.log('📋 ContactEditPage - Form values JSON:', JSON.stringify(values, null, 2));
    console.log('🔧 ContactEditPage - IsEdit:', isEdit);
    console.log('🔧 ContactEditPage - ID:', id);
    
    // 特別檢查 WhatsApp 號碼欄位
    console.log('📱 ContactEditPage - whatsapp_number value:', values.whatsapp_number);
    console.log('📱 ContactEditPage - whatsapp_number type:', typeof values.whatsapp_number);
    console.log('📱 ContactEditPage - whatsapp_number length:', values.whatsapp_number?.length);
    console.log('📱 ContactEditPage - whatsapp_number is empty:', !values.whatsapp_number);
    console.log('📱 ContactEditPage - whatsapp_number is null:', values.whatsapp_number === null);
    console.log('📱 ContactEditPage - whatsapp_number is undefined:', values.whatsapp_number === undefined);
    
    // 特別檢查廣播群組欄位
    console.log('📡 ContactEditPage - broadcast_group_id value:', values.broadcast_group_id);
    console.log('📡 ContactEditPage - broadcast_group_id type:', typeof values.broadcast_group_id);
    console.log('📡 ContactEditPage - broadcast_group_id is empty:', !values.broadcast_group_id);
    console.log('📡 ContactEditPage - broadcast_group_id is null:', values.broadcast_group_id === null);
    console.log('📡 ContactEditPage - broadcast_group_id is undefined:', values.broadcast_group_id === undefined);
    
    setSaving(true);
    try {
      if (isEdit) {
        console.log('📤 ContactEditPage - Calling updateContact with ID:', id);
        console.log('📤 ContactEditPage - Update data being sent:', JSON.stringify(values, null, 2));
        const updateResult = await contactApi.updateContact(id, values);
        console.log('✅ ContactEditPage - Update result:', updateResult);
        message.success(t('contactList.updateSuccess'));
      } else {
        console.log('📤 ContactEditPage - Calling createContact');
        console.log('📤 ContactEditPage - Create data being sent:', JSON.stringify(values, null, 2));
        const createResult = await contactApi.createContact(values);
        console.log('✅ ContactEditPage - Create result:', createResult);
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
      
      // 同時更新 Form 值和 formData 狀態
      form.setFieldValue('hashtags', newTags);
      setFormData(prev => ({ ...prev, hashtags: newTags }));
    }
  };

  // 移除標籤
  const handleRemoveHashtag = (hashtag) => {
    const currentValue = form.getFieldValue('hashtags') || '';
    const currentTags = currentValue ? currentValue.split(',').map(t => t.trim()) : [];
    const newTags = currentTags.filter(tag => tag !== hashtag).join(', ');
    
    // 同時更新 Form 值和 formData 狀態
    form.setFieldValue('hashtags', newTags);
    setFormData(prev => ({ ...prev, hashtags: newTags }));
  };

  // 格式化標籤顯示
  const formatHashtags = (hashtags) => {
    if (!hashtags) return [];
    return hashtags.split(',').map(tag => tag.trim()).filter(tag => tag);
  };

  console.log('🎨 ContactEditPageContent - Rendering component');
  console.log('🎨 ContactEditPageContent - Current state:', { loading, saving, isEdit, id });
  console.log('🎨 ContactEditPageContent - Form data:', formData);
  
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
                onFinish={(values) => {
                  console.log('📝 ContactEditPageContent - Form onFinish triggered');
                  console.log('📝 ContactEditPageContent - Form values:', values);
                  console.log('📝 ContactEditPageContent - Form values keys:', Object.keys(values));
                  console.log('📝 ContactEditPageContent - broadcast_group_id in values:', values.broadcast_group_id);
                  console.log('📝 ContactEditPageContent - broadcast_group_id type:', typeof values.broadcast_group_id);
                  handleSubmit(values);
                }}
                onFinishFailed={(errorInfo) => {
                  console.error('❌ ContactEditPageContent - Form validation failed:', errorInfo);
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
                      <Input 
                        placeholder={t('contactList.namePlaceholder')}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, name: e.target.value }));
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="title"
                      label={t('contactList.title')}
                    >
                      <Input 
                        placeholder={t('contactList.titlePlaceholder')}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, title: e.target.value }));
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="occupation"
                      label={t('contactList.occupation')}
                    >
                      <Input 
                        placeholder={t('contactList.occupationPlaceholder')}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, occupation: e.target.value }));
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="position"
                      label={t('contactList.position')}
                    >
                      <Input 
                        placeholder={t('contactList.positionPlaceholder')}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, position: e.target.value }));
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="whatsapp_number"
                      label={t('contactList.whatsappNumber')}
                    >
                      <Input 
                        placeholder={t('contactList.whatsappPlaceholder')}
                        onChange={(e) => {
                          console.log('📱 ContactEditPage - whatsapp_number input changed:', e.target.value);
                          console.log('📱 ContactEditPage - Input event:', e);
                          setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }));
                        }}
                        onBlur={(e) => {
                          console.log('📱 ContactEditPage - whatsapp_number input blurred:', e.target.value);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="email"
                      label={t('contactList.email')}
                    >
                      <Input 
                        placeholder={t('contactList.emailPlaceholder')}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, email: e.target.value }));
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="company_name"
                      label={t('contactList.companyName')}
                    >
                      <Input 
                        placeholder={t('contactList.companyPlaceholder')}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, company_name: e.target.value }));
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="department"
                      label={t('contactList.department')}
                    >
                      <Input 
                        placeholder={t('contactList.departmentPlaceholder')}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, department: e.target.value }));
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="broadcast_group_id"
                  label={t('contactList.broadcastGroup')}
                  rules={[{ required: true, message: t('contactList.broadcastGroupRequired') }]}
                >
                  <Select 
                    placeholder={t('contactList.broadcastGroupPlaceholder')} 
                    allowClear
                    onChange={(value) => {
                      setFormData(prev => ({ ...prev, broadcast_group_id: value }));
                    }}
                  >
                    {Array.isArray(groups) && groups.map(group => (
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
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, hashtags: e.target.value }));
                    }}
                  />
                </Form.Item>

                {/* 標籤顯示 */}
                {(() => {
                  const currentHashtags = form.getFieldValue('hashtags') || '';
                  const tags = formatHashtags(currentHashtags);
                  return tags.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <Text type='secondary'>{t('contactList.currentTags')}</Text>
                      <div style={{ marginTop: '8px' }}>
                        <Space wrap>
                          {tags.map((tag) => (
                            <Tag
                              key={tag}
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
                  );
                })()}

                {/* 隱藏欄位 */}
                <Form.Item name="is_active" hidden>
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
                {Array.isArray(availableHashtags) && availableHashtags.map(hashtag => (
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
                
                {formData.whatsapp_number && (
                  <div style={{ marginBottom: '4px' }}>
                    <Text type="secondary">📱 {formData.whatsapp_number}</Text>
                  </div>
                )}
                
                {formData.email && (
                  <div style={{ marginBottom: '4px' }}>
                    <Text type="secondary">✉️ {formData.email}</Text>
                  </div>
                )}
                
                {formData.company_name && (
                  <div style={{ marginBottom: '4px' }}>
                    <Text type="secondary">🏢 {formData.company_name}</Text>
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
                        {formatHashtags(formData.hashtags).map((tag) => (
                          <Tag key={tag} color="blue">#{tag}</Tag>
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