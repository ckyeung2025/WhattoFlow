import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Input, Space, Modal, message, Popconfirm, 
  Drawer, Form, Select, Card, Tag, Tooltip, Badge,
  Radio, Checkbox, Divider, Row, Col
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, EditOutlined, 
  EyeOutlined, CopyOutlined, MessageOutlined,
  PictureOutlined, VideoCameraOutlined, AudioOutlined, FileOutlined,
  EnvironmentOutlined, UserOutlined, LinkOutlined
} from '@ant-design/icons';

const { Option } = Select;

const WhatsAppTemplateList = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [isBatchDeleteModalVisible, setIsBatchDeleteModalVisible] = useState(false);
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form] = Form.useForm();

  // 新增狀態用於動態表單
  const [templateType, setTemplateType] = useState('Text');
  const [interactiveType, setInteractiveType] = useState('button');
  const [mediaType, setMediaType] = useState('image');
  const [variables, setVariables] = useState([]);
  const [pendingTemplateData, setPendingTemplateData] = useState(null);
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [isMetaTemplatesModalVisible, setIsMetaTemplatesModalVisible] = useState(false);
  const [metaTemplatesLoading, setMetaTemplatesLoading] = useState(false);

  // 獲取 Meta 模板列表
  const fetchMetaTemplates = async () => {
    setMetaTemplatesLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapptemplates/meta-templates', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setMetaTemplates(result.data);
      } else {
        message.error(result.error || '獲取 Meta 模板失敗');
      }
    } catch (error) {
      console.error('獲取 Meta 模板錯誤:', error);
      message.error('獲取 Meta 模板失敗');
    } finally {
      setMetaTemplatesLoading(false);
    }
  };

  // 導入 Meta 模板
  const handleImportMetaTemplate = async (metaTemplate) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapptemplates/import-from-meta', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          metaTemplateId: metaTemplate.id,
          customName: `${metaTemplate.name} (導入)`,
          description: `從 Meta 導入的模板: ${metaTemplate.name}`,
          category: metaTemplate.category || 'Imported'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        message.success('模板導入成功');
        setIsMetaTemplatesModalVisible(false);
        fetchTemplates();
      } else {
        message.error(result.error || '導入失敗');
      }
    } catch (error) {
      console.error('導入 Meta 模板錯誤:', error);
      message.error('導入失敗');
    }
  };

  // 創建 Meta 模板
  const handleCreateMetaTemplate = async (values) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapptemplates/create-in-meta', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          category: values.category,
          content: values.content,
          language: values.language
        })
      });

      const result = await response.json();
      
      if (result.success) {
        message.success('Meta 模板創建成功');
        setIsTemplateModalVisible(false);
        form.resetFields();
        fetchTemplates();
      } else {
        message.error(result.error || '創建失敗');
      }
    } catch (error) {
      console.error('創建 Meta 模板錯誤:', error);
      message.error('創建失敗');
    }
  };

  // 刪除 Meta 模板
  const handleDeleteMetaTemplate = async (templateId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/whatsapptemplates/${templateId}/delete-from-meta`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        message.success('Meta 模板刪除成功');
        fetchTemplates();
      } else {
        message.error(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('刪除 Meta 模板錯誤:', error);
      message.error('刪除失敗');
    }
  };

  // 獲取模板列表
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage,
        pageSize: pageSize,
        sortField: sortField,
        sortOrder: sortOrder,
        search: searchText,
        category: categoryFilter,
        status: statusFilter
      });

      const response = await fetch(`/api/whatsapptemplates?${params}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();

      if (result.success) {
        setTemplates(result.data);
        setTotal(result.total);
      } else {
        message.error('獲取模板列表失敗');
      }
    } catch (error) {
      console.error('獲取模板列表錯誤:', error);
      message.error('獲取模板列表失敗');
    } finally {
      setLoading(false);
    }
  };

  // 獲取分類列表
  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapptemplates/categories', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      if (result.success) {
        setCategories(result.data);
      }
    } catch (error) {
      console.error('獲取分類列表錯誤:', error);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, [currentPage, pageSize, sortField, sortOrder, searchText, categoryFilter, statusFilter]);

  // 表格變化處理
  const handleTableChange = (pagination, filters, sorter) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
    if (sorter.field) {
      setSortField(sorter.field);
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  // 搜索處理
  const handleSearch = (value) => {
    setSearchText(value);
    setCurrentPage(1);
  };

  // 批量刪除
  const handleBatchDelete = async () => {
    if (selectedTemplates.length === 0) {
      message.warning('請選擇要刪除的模板');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapptemplates/batch-delete', {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ templateIds: selectedTemplates })
      });

      const result = await response.json();
      if (result.success) {
        message.success(`成功刪除 ${result.deletedCount} 個模板`);
        setSelectedTemplates([]);
        setIsBatchDeleteModalVisible(false);
        fetchTemplates();
      } else {
        message.error(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('批量刪除錯誤:', error);
      message.error('刪除失敗');
    }
  };

  // 單個刪除
  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/whatsapptemplates/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (result.success) {
        message.success('模板刪除成功');
        fetchTemplates();
      } else {
        message.error(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('刪除錯誤:', error);
      message.error('刪除失敗');
    }
  };

  // 處理模板類型變化
  const handleTemplateTypeChange = (value) => {
    setTemplateType(value);
    form.setFieldsValue({
      content: '',
      variables: ''
    });
    setVariables([]);
  };

  // 添加變數
  const addVariable = () => {
    const newVariable = {
      name: '',
      type: 'string',
      description: '',
      required: false
    };
    setVariables([...variables, newVariable]);
  };

  // 更新變數
  const updateVariable = (index, field, value) => {
    const newVariables = [...variables];
    newVariables[index][field] = value;
    setVariables(newVariables);
  };

  // 刪除變數
  const removeVariable = (index) => {
    const newVariables = variables.filter((_, i) => i !== index);
    setVariables(newVariables);
  };

  // 生成 JSON 內容
  const generateContent = (values) => {
    switch (values.templateType) {
      case 'Text':
        return {
          type: 'text',
          content: values.content
        };
      case 'Media':
        return {
          type: 'media',
          mediaType: mediaType,
          url: values.mediaUrl,
          caption: values.mediaCaption || ''
        };
      case 'Interactive':
        return {
          type: 'interactive',
          interactiveType: interactiveType,
          header: values.header || '',
          body: values.body,
          footer: values.footer || '',
          action: {
            buttons: values.buttons || [],
            sections: values.sections || []
          }
        };
      case 'Location':
        return {
          type: 'location',
          latitude: values.latitude,
          longitude: values.longitude,
          name: values.locationName,
          address: values.locationAddress
        };
      case 'Contact':
        return {
          type: 'contact',
          name: values.contactName,
          phone: values.contactPhone,
          email: values.contactEmail || ''
        };
      default:
        return { type: 'text', content: values.content };
    }
  };

  // 生成變數 JSON
  const generateVariables = () => {
    return variables.map(v => ({
      name: v.name,
      type: v.type,
      description: v.description,
      required: v.required
    }));
  };

  // 修改保存模板函數
  const handleSaveTemplate = async (values) => {
    try {
      const content = generateContent(values);
      const variablesJson = generateVariables();
      
      if (editingTemplate) {
        // 編輯模式 - 使用 WhatsAppTemplateUpdateRequest 結構
        const templateData = {
          name: values.name,
          description: values.description || '',
          category: values.category || 'General',
          templateType: values.templateType || 'Text',
          content: JSON.stringify(content),
          variables: JSON.stringify(variablesJson),
          status: values.status || 'Active',
          language: values.language || 'zh-TW',
          updatedBy: 'System'
        };
        
        console.log('發送更新模板數據:', templateData);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/whatsapptemplates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(templateData)
        });

        const result = await response.json();
        
        if (result.success) {
          message.success('模板更新成功');
          setIsTemplateModalVisible(false);
          setEditingTemplate(null);
          form.resetFields();
          setVariables([]);
          setPendingTemplateData(null);
          fetchTemplates();
        } else {
          message.error(result.message || result.error || '更新失敗');
        }
      } else {
        // 創建模式 - 使用 WhatsAppTemplateCreateRequest 結構
        const templateData = {
          name: values.name,
          description: values.description || '',
          category: values.category || 'General',
          templateType: values.templateType || 'Text',
          content: JSON.stringify(content),
          variables: JSON.stringify(variablesJson),
          status: values.status || 'Active',
          language: values.language || 'zh-TW',
          createdBy: 'System',
          updatedBy: 'System',
          companyId: null
        };
        
        console.log('發送創建模板數據:', templateData);
        
        const token = localStorage.getItem('token');
        const response = await fetch('/api/whatsapptemplates', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(templateData)
        });

        const result = await response.json();
        
        if (result.success) {
          message.success('模板創建成功');
          setIsTemplateModalVisible(false);
          setEditingTemplate(null);
          form.resetFields();
          setVariables([]);
          setPendingTemplateData(null);
          fetchTemplates();
        } else {
          message.error(result.message || result.error || '創建失敗');
        }
      }
    } catch (error) {
      console.error('保存模板錯誤:', error);
      message.error('保存模板失敗');
    }
  };

  // 預覽模板
  const handlePreview = async (template) => {
    setPreviewTemplate(template);
    setIsPreviewModalVisible(true);
  };

  // 處理編輯模板數據設置
  const handleEditTemplate = (template) => {
    console.log('編輯模板原始數據:', template);
    console.log('模板 content 字段:', template.content);
    console.log('模板 variables 字段:', template.variables);
    
    setEditingTemplate(template);
    setTemplateType(template.templateType);
    
    try {
      // 檢查 content 是否存在且不為空
      const content = template.content && template.content !== 'undefined' 
        ? JSON.parse(template.content) 
        : { type: 'text', content: '' };
      
      console.log('解析後的 content:', content);
      
      // 檢查 variables 是否存在且不為空
      const variables = template.variables && template.variables !== 'undefined' && template.variables !== 'null'
        ? JSON.parse(template.variables) 
        : [];
      
      console.log('解析後的 variables:', variables);
      
      setVariables(variables);
      
      // 設置待處理的模板數據
      const pendingData = {
        name: template.name,
        description: template.description,
        category: template.category,
        templateType: template.templateType,
        content: content.content || content.body || '',
        mediaUrl: content.url || '',
        mediaCaption: content.caption || '',
        header: content.header || '',
        body: content.body || content.content || '',
        footer: content.footer || '',
        latitude: content.latitude || '',
        longitude: content.longitude || '',
        locationName: content.name || '',
        locationAddress: content.address || '',
        contactName: content.name || '',
        contactPhone: content.phone || '',
        contactEmail: content.email || '',
        status: template.status,
        language: template.language
      };
      
      console.log('設置的 pendingTemplateData:', pendingData);
      setPendingTemplateData(pendingData);
    } catch (error) {
      console.error('解析模板內容錯誤:', error);
      console.log('模板數據:', template);
      message.error('解析模板內容失敗');
      
      // 設置默認值
      setVariables([]);
      setPendingTemplateData({
        name: template.name,
        description: template.description,
        category: template.category,
        templateType: template.templateType,
        content: '',
        mediaUrl: '',
        mediaCaption: '',
        header: '',
        body: '',
        footer: '',
        latitude: '',
        longitude: '',
        locationName: '',
        locationAddress: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        status: template.status,
        language: template.language
      });
    }
    
    setIsTemplateModalVisible(true);
  };

  // 處理複製模板
  const handleCopyTemplate = (template) => {
    setEditingTemplate({
      ...template,
      id: null,
      name: `${template.name} (複製)`,
      createdAt: null,
      updatedAt: null
    });
    setTemplateType(template.templateType);
    
    try {
      // 檢查 content 是否存在且不為空
      const content = template.content && template.content !== 'undefined' 
        ? JSON.parse(template.content) 
        : { type: 'text', content: '' };
      
      // 檢查 variables 是否存在且不為空
      const variables = template.variables && template.variables !== 'undefined' && template.variables !== 'null'
        ? JSON.parse(template.variables) 
        : [];
      
      setVariables(variables);
      
      // 設置待處理的模板數據
      setPendingTemplateData({
        name: `${template.name} (複製)`,
        description: template.description,
        category: template.category,
        templateType: template.templateType,
        content: content.content || content.body || '',
        mediaUrl: content.url || '',
        mediaCaption: content.caption || '',
        header: content.header || '',
        body: content.body || content.content || '',
        footer: content.footer || '',
        latitude: content.latitude || '',
        longitude: content.longitude || '',
        locationName: content.name || '',
        locationAddress: content.address || '',
        contactName: content.name || '',
        contactPhone: content.phone || '',
        contactEmail: content.email || '',
        status: template.status,
        language: template.language
      });
    } catch (error) {
      console.error('解析模板內容錯誤:', error);
      console.log('模板數據:', template);
      message.error('解析模板內容失敗');
      
      // 設置默認值
      setVariables([]);
      setPendingTemplateData({
        name: `${template.name} (複製)`,
        description: template.description,
        category: template.category,
        templateType: template.templateType,
        content: '',
        mediaUrl: '',
        mediaCaption: '',
        header: '',
        body: '',
        footer: '',
        latitude: '',
        longitude: '',
        locationName: '',
        locationAddress: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        status: template.status,
        language: template.language
      });
    }
    
    setIsTemplateModalVisible(true);
  };

  // 當待處理數據存在時，設置表單值
  useEffect(() => {
    console.log('useEffect 觸發:', { pendingTemplateData, isTemplateModalVisible });
    if (pendingTemplateData && isTemplateModalVisible) {
      console.log('設置表單值:', pendingTemplateData);
      form.setFieldsValue(pendingTemplateData);
      setPendingTemplateData(null);
    }
  }, [pendingTemplateData, isTemplateModalVisible, form]);

  // 表格選擇配置
  const rowSelection = {
    selectedRowKeys: selectedTemplates,
    onChange: (selectedRowKeys) => {
      setSelectedTemplates(selectedRowKeys);
    }
  };

  // 表格列定義
  const columns = [
    {
      title: '模板名稱',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.description}</div>
        </div>
      )
    },
    {
      title: '分類',
      dataIndex: 'category',
      key: 'category',
      sorter: true,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '類型',
      dataIndex: 'templateType',
      key: 'templateType',
      render: (text) => {
        const typeColors = {
          'Text': 'green',
          'Media': 'orange',
          'Interactive': 'purple',
          'Location': 'cyan',
          'Contact': 'geekblue'
        };
        const typeIcons = {
          'Text': <MessageOutlined />,
          'Media': <PictureOutlined />,
          'Interactive': <LinkOutlined />,
          'Location': <EnvironmentOutlined />,
          'Contact': <UserOutlined />
        };
        return (
          <Tag color={typeColors[text] || 'default'} icon={typeIcons[text]}>
            {text}
          </Tag>
        );
      }
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      render: (text) => {
        const statusColors = {
          'Active': 'green',
          'Inactive': 'red',
          'Draft': 'orange'
        };
        return <Badge status={statusColors[text] || 'default'} text={text} />;
      }
    },
    {
      title: '語言',
      dataIndex: 'language',
      key: 'language',
      render: (text) => <Tag>{text}</Tag>
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (text) => <Tag color="geekblue">v{text}</Tag>
    },
    {
      title: '更新時間',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      sorter: true,
      render: (text) => new Date(text).toLocaleString('zh-TW')
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="預覽">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="編輯">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEditTemplate(record)}
            />
          </Tooltip>
          <Tooltip title="複製">
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => handleCopyTemplate(record)}
            />
          </Tooltip>
          {record.metaTemplateId && (
            <Tooltip title="刪除 Meta 模板">
              <Popconfirm
                title="確定要從 Meta 刪除這個模板嗎？"
                onConfirm={() => handleDeleteMetaTemplate(record.id)}
                okText="確定"
                cancelText="取消"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {!record.metaTemplateId && (
            <Popconfirm
              title="確定要刪除這個模板嗎？"
              onConfirm={() => handleDelete(record.id)}
              okText="確定"
              cancelText="取消"
            >
              <Tooltip title="刪除">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  // 渲染動態表單內容
  const renderTemplateForm = () => {
    const currentTemplateType = form.getFieldValue('templateType') || templateType;
    
    switch (currentTemplateType) {
      case 'Text':
        return (
          <Form.Item
            name="content"
            label="訊息內容"
            rules={[{ required: true, message: '請輸入訊息內容' }]}
          >
            <Input.TextArea 
              rows={4} 
              placeholder="請輸入訊息內容，可使用 {{變數名}} 格式插入變數"
            />
          </Form.Item>
        );

      case 'Media':
        return (
          <>
            <Form.Item
              name="mediaType"
              label="媒體類型"
              rules={[{ required: true, message: '請選擇媒體類型' }]}
            >
              <Radio.Group onChange={(e) => setMediaType(e.target.value)} value={mediaType}>
                <Radio.Button value="image"><PictureOutlined /> 圖片</Radio.Button>
                <Radio.Button value="video"><VideoCameraOutlined /> 影片</Radio.Button>
                <Radio.Button value="audio"><AudioOutlined /> 音訊</Radio.Button>
                <Radio.Button value="document"><FileOutlined /> 文件</Radio.Button>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item
              name="mediaUrl"
              label="媒體檔案 URL"
              rules={[{ required: true, message: '請輸入媒體檔案 URL' }]}
            >
              <Input placeholder="請輸入媒體檔案 URL" />
            </Form.Item>
            
            <Form.Item
              name="mediaCaption"
              label="媒體說明"
            >
              <Input.TextArea 
                rows={3} 
                placeholder="請輸入媒體說明（可選）"
              />
            </Form.Item>
          </>
        );

      case 'Interactive':
        return (
          <>
            <Form.Item
              name="interactiveType"
              label="互動類型"
              rules={[{ required: true, message: '請選擇互動類型' }]}
            >
              <Radio.Group onChange={(e) => setInteractiveType(e.target.value)} value={interactiveType}>
                <Radio.Button value="button">按鈕</Radio.Button>
                <Radio.Button value="list">選單</Radio.Button>
                <Radio.Button value="product">商品</Radio.Button>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item
              name="header"
              label="標題"
            >
              <Input placeholder="請輸入標題（可選）" />
            </Form.Item>
            
            <Form.Item
              name="body"
              label="主要內容"
              rules={[{ required: true, message: '請輸入主要內容' }]}
            >
              <Input.TextArea 
                rows={4} 
                placeholder="請輸入主要內容"
              />
            </Form.Item>
            
            <Form.Item
              name="footer"
              label="底部文字"
            >
              <Input placeholder="請輸入底部文字（可選）" />
            </Form.Item>
          </>
        );

      case 'Location':
        return (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="latitude"
                  label="緯度"
                  rules={[{ required: true, message: '請輸入緯度' }]}
                >
                  <Input placeholder="請輸入緯度" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="longitude"
                  label="經度"
                  rules={[{ required: true, message: '請輸入經度' }]}
                >
                  <Input placeholder="請輸入經度" />
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item
              name="locationName"
              label="位置名稱"
              rules={[{ required: true, message: '請輸入位置名稱' }]}
            >
              <Input placeholder="請輸入位置名稱" />
            </Form.Item>
            
            <Form.Item
              name="locationAddress"
              label="地址"
              rules={[{ required: true, message: '請輸入地址' }]}
            >
              <Input.TextArea 
                rows={3} 
                placeholder="請輸入完整地址"
              />
            </Form.Item>
          </>
        );

      case 'Contact':
        return (
          <>
            <Form.Item
              name="contactName"
              label="聯絡人姓名"
              rules={[{ required: true, message: '請輸入聯絡人姓名' }]}
            >
              <Input placeholder="請輸入聯絡人姓名" />
            </Form.Item>
            
            <Form.Item
              name="contactPhone"
              label="聯絡人電話"
              rules={[{ required: true, message: '請輸入聯絡人電話' }]}
            >
              <Input placeholder="請輸入聯絡人電話" />
            </Form.Item>
            
            <Form.Item
              name="contactEmail"
              label="聯絡人 Email"
            >
              <Input placeholder="請輸入聯絡人 Email（可選）" />
            </Form.Item>
          </>
        );

      default:
        return null;
    }
  };

  // 渲染變數設定
  const renderVariablesSection = () => {
    return (
      <>
        <Divider orientation="left">變數設定</Divider>
        
        {variables.map((variable, index) => (
          <Card key={index} size="small" style={{ marginBottom: '8px' }}>
            <Row gutter={16}>
              <Col span={6}>
                <Input
                  placeholder="變數名稱"
                  value={variable.name}
                  onChange={(e) => updateVariable(index, 'name', e.target.value)}
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="類型"
                  value={variable.type}
                  onChange={(value) => updateVariable(index, 'type', value)}
                >
                  <Option value="string">文字</Option>
                  <Option value="number">數字</Option>
                  <Option value="date">日期</Option>
                </Select>
              </Col>
              <Col span={8}>
                <Input
                  placeholder="描述"
                  value={variable.description}
                  onChange={(e) => updateVariable(index, 'description', e.target.value)}
                />
              </Col>
              <Col span={4}>
                <Checkbox
                  checked={variable.required}
                  onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                >
                  必填
                </Checkbox>
              </Col>
              <Col span={2}>
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />}
                  onClick={() => removeVariable(index)}
                />
              </Col>
            </Row>
          </Card>
        ))}
        
        <Button 
          type="dashed" 
          onClick={addVariable}
          icon={<PlusOutlined />}
          style={{ width: '100%' }}
        >
          添加變數
        </Button>
      </>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      
      {/* 標題和操作按鈕 */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingTemplate(null);
              form.resetFields();
              setTemplateType('Text');
              setVariables([]);
              setPendingTemplateData(null);
              setIsTemplateModalVisible(true);
            }}
          >
            新增模板
          </Button>
          <Button
            type="default"
            icon={<MessageOutlined />}
            onClick={() => {
              fetchMetaTemplates();
              setIsMetaTemplatesModalVisible(true);
            }}
          >
            從 Meta 導入
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={selectedTemplates.length === 0}
            onClick={() => setIsBatchDeleteModalVisible(true)}
          >
            批量刪除 ({selectedTemplates.length})
          </Button>
        </Space>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ margin: 0 }}>
            <MessageOutlined style={{ marginRight: '8px' }} />
            WhatsApp 訊息模板管理
          </h2>
        </div>
      </div>

      {/* 搜索和篩選 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索模板名稱、描述或分類"
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
            onPressEnter={(e) => handleSearch(e.target.value)}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="選擇分類"
            allowClear
            style={{ width: 150 }}
            value={categoryFilter}
            onChange={setCategoryFilter}
          >
            {categories.map(category => (
              <Option key={category} value={category}>{category}</Option>
            ))}
          </Select>
          <Select
            placeholder="選擇狀態"
            allowClear
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Option value="Active">啟用</Option>
            <Option value="Inactive">停用</Option>
            <Option value="Draft">草稿</Option>
          </Select>
          <Button
            onClick={() => {
              setSearchText('');
              setCategoryFilter('');
              setStatusFilter('');
              setCurrentPage(1);
            }}
          >
            清除篩選
          </Button>
        </Space>
      </Card>

      {/* 模板列表表格 */}
      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 項，共 ${total} 項`
        }}
        onChange={handleTableChange}
        rowSelection={rowSelection}
        scroll={{ x: 1200 }}
      />

      {/* 批量刪除確認 Modal */}
      <Modal
        title="批量刪除模板"
        open={isBatchDeleteModalVisible}
        onOk={handleBatchDelete}
        onCancel={() => setIsBatchDeleteModalVisible(false)}
        okText="確定刪除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>確定要刪除選中的 {selectedTemplates.length} 個模板嗎？此操作無法撤銷。</p>
      </Modal>

      {/* 模板編輯 Modal */}
      <Drawer
        title={editingTemplate ? '編輯模板' : '新增模板'}
        open={isTemplateModalVisible}
        onClose={() => {
          setIsTemplateModalVisible(false);
          setEditingTemplate(null);
          form.resetFields();
          setVariables([]);
          setPendingTemplateData(null);
        }}
        width={800}
        extra={
          <Space>
            <Button onClick={() => {
              setIsTemplateModalVisible(false);
              setEditingTemplate(null);
              form.resetFields();
              setVariables([]);
              setPendingTemplateData(null);
            }}>
              取消
            </Button>
            <Button type="primary" onClick={() => form.submit()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveTemplate}
        >
          <Form.Item
            name="name"
            label="模板名稱"
            rules={[{ required: true, message: '請輸入模板名稱' }]}
          >
            <Input placeholder="請輸入模板名稱" />
          </Form.Item>

          <Form.Item
            name="description"
            label="模板描述"
          >
            <Input.TextArea rows={3} placeholder="請輸入模板描述" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分類"
            rules={[{ required: true, message: '請選擇分類' }]}
          >
            <Select placeholder="請選擇分類">
              <Option value="Welcome">歡迎</Option>
              <Option value="Order">訂單</Option>
              <Option value="Marketing">行銷</Option>
              <Option value="Support">客服</Option>
              <Option value="General">一般</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="templateType"
            label="模板類型"
            rules={[{ required: true, message: '請選擇模板類型' }]}
          >
            <Select 
              placeholder="請選擇模板類型"
              onChange={handleTemplateTypeChange}
            >
              <Option value="Text">
                <Space><MessageOutlined />文字</Space>
              </Option>
              <Option value="Media">
                <Space><PictureOutlined />媒體</Space>
              </Option>
              <Option value="Interactive">
                <Space><LinkOutlined />互動</Space>
              </Option>
              <Option value="Location">
                <Space><EnvironmentOutlined />位置</Space>
              </Option>
              <Option value="Contact">
                <Space><UserOutlined />聯絡人</Space>
              </Option>
            </Select>
          </Form.Item>

          {/* 動態表單內容 */}
          {renderTemplateForm()}

          {/* 變數設定 */}
          {renderVariablesSection()}

          <Form.Item
            name="status"
            label="狀態"
            rules={[{ required: true, message: '請選擇狀態' }]}
          >
            <Select placeholder="請選擇狀態">
              <Option value="Active">啟用</Option>
              <Option value="Inactive">停用</Option>
              <Option value="Draft">草稿</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="language"
            label="語言"
            rules={[{ required: true, message: '請選擇語言' }]}
          >
            <Select placeholder="請選擇語言">
              <Option value="zh-TW">繁體中文</Option>
              <Option value="zh-CN">簡體中文</Option>
              <Option value="en-US">English</Option>
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Meta 模板列表 Modal */}
      <Modal
        title="從 Meta 導入模板"
        open={isMetaTemplatesModalVisible}
        onCancel={() => setIsMetaTemplatesModalVisible(false)}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: '16px' }}>
          <Button
            type="primary"
            icon={<MessageOutlined />}
            onClick={fetchMetaTemplates}
            loading={metaTemplatesLoading}
          >
            刷新 Meta 模板
          </Button>
        </div>
        
        <Table
          dataSource={metaTemplates}
          rowKey="id"
          loading={metaTemplatesLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true
          }}
          columns={[
            {
              title: '模板名稱',
              dataIndex: 'name',
              key: 'name',
              render: (text, record) => (
                <div>
                  <div style={{ fontWeight: 'bold' }}>{text}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>ID: {record.id}</div>
                </div>
              )
            },
            {
              title: '狀態',
              dataIndex: 'status',
              key: 'status',
              render: (text) => {
                const statusColors = {
                  'APPROVED': 'green',
                  'PENDING': 'orange',
                  'REJECTED': 'red'
                };
                return <Tag color={statusColors[text] || 'default'}>{text}</Tag>;
              }
            },
            {
              title: '分類',
              dataIndex: 'category',
              key: 'category',
              render: (text) => <Tag color="blue">{text}</Tag>
            },
            {
              title: '語言',
              dataIndex: 'language',
              key: 'language',
              render: (text) => <Tag>{text}</Tag>
            },
            {
              title: '操作',
              key: 'action',
              render: (_, record) => (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => handleImportMetaTemplate(record)}
                  disabled={record.status !== 'APPROVED'}
                >
                  導入
                </Button>
              )
            }
          ]}
        />
      </Modal>

      {/* 模板預覽 Modal */}
      <Modal
        title="模板預覽"
        open={isPreviewModalVisible}
        onCancel={() => setIsPreviewModalVisible(false)}
        footer={null}
        width={600}
      >
        {previewTemplate && (
          <div>
            <Card title="基本信息" style={{ marginBottom: '16px' }}>
              <p><strong>名稱：</strong>{previewTemplate.name}</p>
              <p><strong>描述：</strong>{previewTemplate.description}</p>
              <p><strong>分類：</strong><Tag color="blue">{previewTemplate.category}</Tag></p>
              <p><strong>類型：</strong><Tag color="green">{previewTemplate.templateType}</Tag></p>
              <p><strong>狀態：</strong><Badge status="success" text={previewTemplate.status} /></p>
            </Card>
            
            <Card title="模板內容" style={{ marginBottom: '16px' }}>
              <pre style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '12px', 
                borderRadius: '4px',
                fontSize: '12px',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                {previewTemplate.content}
              </pre>
            </Card>
            
            {previewTemplate.variables && (
              <Card title="變數定義">
                <pre style={{ 
                  backgroundColor: '#f5f5f5', 
                  padding: '12px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {previewTemplate.variables}
                </pre>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WhatsAppTemplateList;