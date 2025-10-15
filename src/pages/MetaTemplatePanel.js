import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Button, Form, Input, Select, message, Tag, Modal,
  Space, Card, Divider, Row, Col, Tooltip, Popconfirm, Badge, Steps, Radio
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ReloadOutlined, EyeOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  FileTextOutlined, SearchOutlined, BoldOutlined, ItalicOutlined,
  StrikethroughOutlined, CodeOutlined, NumberOutlined, SmileOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

const { Option } = Select;
const { TextArea } = Input;

const MetaTemplatePanel = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [form] = Form.useForm();
  
  const { t } = useLanguage();

  // 查詢條件
  const [searchName, setSearchName] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');

  // 組件數據
  const [headerComponents, setHeaderComponents] = useState([]);
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState([]);
  
  // 變數示例
  const [bodyVariables, setBodyVariables] = useState([]);
  
  // 用于 TextArea 的 ref，以便插入格式化文本
  const bodyTextRef = React.useRef(null);
  const headerTextRef = React.useRef(null);
  const footerTextRef = React.useRef(null);
  
  // 防抖計時器 ref
  const debounceTimerRef = useRef(null);
  
  // 变量插入 Modal
  const [isVariableModalVisible, setIsVariableModalVisible] = useState(false);
  const [currentFieldForVariable, setCurrentFieldForVariable] = useState(null);
  const [currentTextareaRefForVariable, setCurrentTextareaRefForVariable] = useState(null);
  const [variableType, setVariableType] = useState('number'); // 'number' 或 'name'
  const [variableName, setVariableName] = useState('');

  useEffect(() => {
    fetchMetaTemplates();
  }, []);

  // 獲取 Meta 模板列表（支持查詢參數）
  const fetchMetaTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // 構建查詢參數
      const params = new URLSearchParams();
      if (searchName) params.append('name', searchName);
      if (filterStatus) params.append('status', filterStatus);
      if (filterCategory) params.append('category', filterCategory);
      if (filterLanguage) params.append('language', filterLanguage);
      
      const queryString = params.toString();
      const url = queryString 
        ? `/api/whatsappmetatemplates?${queryString}`
        : '/api/whatsappmetatemplates';
      
      console.log('🔍 查詢 URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('📋 獲取模板列表成功，數量:', result.total);
        if (result.data && result.data.length > 0) {
          console.log('📋 第一個模板數據示例:', {
            name: result.data[0].name,
            category: result.data[0].category,
            language: result.data[0].language,
            status: result.data[0].status
          });
        }
        
        setTemplates(result.data || []);
        message.success(t('whatsappTemplate.metaTemplate.totalTemplates').replace('{count}', result.total));
      } else {
        message.error(t('whatsappTemplate.metaTemplate.submitFailed'));
      }
    } catch (error) {
      console.error('獲取 Meta 模板錯誤:', error);
      message.error(`${t('whatsappTemplate.metaTemplate.submitFailed')}：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 處理搜索
  const handleSearch = () => {
    fetchMetaTemplates();
  };

  // 清空篩選條件
  const handleClearFilters = () => {
    setSearchName('');
    setFilterStatus('');
    setFilterCategory('');
    setFilterLanguage('');
  };

  // 當清空篩選條件後，立即刷新
  useEffect(() => {
    if (!searchName && !filterStatus && !filterCategory && !filterLanguage) {
      // 只有在所有條件都為空時才自動刷新（避免首次載入時重複調用）
      const timer = setTimeout(() => {
        if (templates.length === 0) {
          fetchMetaTemplates();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchName, filterStatus, filterCategory, filterLanguage]);

  // 創建 Meta 模板
  const handleCreateTemplate = async (values) => {
    try {
      message.loading(t('whatsappTemplate.metaTemplate.loading'), 0);
      
      const token = localStorage.getItem('token');
      
      // 構建組件結構
      const components = [];
      
      // Header 組件
      if (values.headerText) {
        components.push({
          type: 'HEADER',
          format: values.headerFormat || 'TEXT',
          text: values.headerText
        });
      }
      
      // Body 組件（必須）
      const bodyComponent = {
        type: 'BODY',
        text: values.bodyText
      };
      
      // 如果有變數，添加示例
      if (bodyVariables.length > 0) {
        bodyComponent.example = {
          body_text: [bodyVariables.map(v => v.example || t('whatsappTemplate.metaTemplate.exampleValue').replace('{index}', v.index))]
        };
      }
      
      components.push(bodyComponent);
      
      // Footer 組件
      if (values.footerText) {
        components.push({
          type: 'FOOTER',
          text: values.footerText
        });
      }
      
      // Buttons 組件
      if (buttons.length > 0) {
        const buttonComponents = buttons.map(btn => {
          const button = { 
            type: btn.type, 
            text: btn.text 
          };
          
          // 只有當類型匹配時才添加對應字段
          if (btn.type === 'URL') {
            button.url = btn.url || '';
          } else if (btn.type === 'PHONE_NUMBER') {
            button.phoneNumber = btn.phoneNumber || '';
          }
          
          return button;
        });
        
        components.push({
          type: 'BUTTONS',
          buttons: buttonComponents
        });
      }
      
      const payload = {
        name: values.name,
        category: values.category,
        language: values.language,
        components: components
      };
      
      console.log('📤 發送請求 Payload:', JSON.stringify(payload, null, 2));
      
      const response = await fetch('/api/whatsappmetatemplates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      message.destroy();
      
      // 檢查響應狀態
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorResult = await response.json();
          console.error('❌ 創建 Meta 模板失敗 - 伺服器回應:', errorResult);
          
          // 特別處理模型驗證錯誤
          if (errorResult.errors) {
            console.error('📋 驗證錯誤詳情:', JSON.stringify(errorResult.errors, null, 2));
            const errorMessages = Object.entries(errorResult.errors).map(([field, messages]) => {
              return `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`;
            });
            errorMessage = t('whatsappTemplate.metaTemplate.validationFailed') + ':\n' + errorMessages.join('\n');
          } else {
            errorMessage = errorResult.error || errorResult.message || errorResult.title || errorMessage;
          }
        } catch (e) {
          // 如果無法解析 JSON，使用文本
          const errorText = await response.text();
          console.error('❌ 創建 Meta 模板失敗 - 原始回應:', errorText);
          if (errorText) {
            errorMessage = errorText;
          }
        }
        
        message.error(`${t('whatsappTemplate.metaTemplate.submitFailed')}: ${errorMessage}`);
        return;
      }
      
      const result = await response.json();
      
      console.log('✅ 創建成功 - 伺服器返回:', result);
      
      if (result.success) {
        if (result.data) {
          console.log('📋 Meta 返回的模板數據:', {
            name: result.data.name,
            category: result.data.category,
            status: result.data.status,
            id: result.data.id
          });
        }
        
        message.success(t('whatsappTemplate.metaTemplate.submitSuccess'));
        setIsCreateModalVisible(false);
        form.resetFields();
        setBodyVariables([]);
        setButtons([]);
        fetchMetaTemplates();
      } else {
        console.error('❌ 創建 Meta 模板失敗:', result);
        message.error(result.error || result.message || t('whatsappTemplate.metaTemplate.submitFailed'));
      }
    } catch (error) {
      message.destroy();
      console.error('創建 Meta 模板錯誤:', error);
      message.error(t('whatsappTemplate.metaTemplate.createFailed') + '：' + error.message);
    }
  };

  // 刪除 Meta 模板
  const handleDeleteTemplate = async (templateName) => {
    try {
      message.loading(t('whatsappTemplate.metaTemplate.deleting'), 0);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/whatsappmetatemplates/${encodeURIComponent(templateName)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      message.destroy();
      
      if (result.success) {
        message.success(t('whatsappTemplate.metaTemplate.deleteSuccess'));
        fetchMetaTemplates();
      } else {
        message.error(result.message || t('whatsappTemplate.metaTemplate.deleteFailed'));
      }
    } catch (error) {
      message.destroy();
      console.error('刪除 Meta 模板錯誤:', error);
      message.error(t('whatsappTemplate.metaTemplate.deleteFailed') + '：' + error.message);
    }
  };

  // 預覽模板
  const handlePreviewTemplate = (template) => {
    console.log('🔍 [DEBUG] 預覽模板數據:', {
      name: template.name,
      status: template.status,
      rejected_reason: template.rejected_reason,
      quality_rating: template.quality_rating,
      created_time: template.created_time,
      updated_time: template.updated_time
    });
    setPreviewTemplate(template);
    setIsPreviewModalVisible(true);
  };

  // 解析 Body 文字中的變數
  const parseBodyVariables = useCallback((text) => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (matches) {
      const variables = matches.map(match => {
        const index = parseInt(match.replace(/\{\{|\}\}/g, ''));
        // 保留現有的示例數據，如果沒有則為空
        const existingVariable = bodyVariables.find(v => v.index === index);
        return { index, example: existingVariable?.example || '' };
      });
      setBodyVariables(variables);
    } else {
      setBodyVariables([]);
    }
  }, [bodyVariables]);

  // 防抖函數
  const debounce = useCallback((func, delay) => {
    return (...args) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        func(...args);
      }, delay);
    };
  }, []);

  // 防抖的變數解析函數
  const debouncedParseVariables = useCallback((text) => {
    debounce(() => parseBodyVariables(text), 300)();
  }, [debounce, parseBodyVariables]);

  // 優化的輸入處理函數
  const handleInputChange = useCallback((fieldName, value) => {
    console.log('📝 [handleInputChange] 輸入變化:', { fieldName, valueLength: value?.length, valuePreview: value?.substring(0, 50) + (value?.length > 50 ? '...' : '') });
    
    // 立即更新表單值，但不觸發複雜操作
    form.setFieldsValue({ [fieldName]: value });
    console.log('✅ [handleInputChange] 表單已更新');
    
    // 只有 bodyText 需要解析變數，使用防抖
    if (fieldName === 'bodyText') {
      console.log('🔍 [handleInputChange] 觸發變數解析防抖...');
      debounce(() => parseBodyVariables(value), 300)();
    }
  }, [form, parseBodyVariables, debounce]);

  // 获取输入框元素（支持 Input 和 TextArea）
  const getInputElement = (textareaRef) => {
    // 嘗試多種可能的元素路徑
    let element = null;
    
    if (textareaRef?.current) {
    // TextArea: ref.current.resizableTextArea.textArea
      if (textareaRef.current.resizableTextArea?.textArea) {
        element = textareaRef.current.resizableTextArea.textArea;
      }
    // Input: ref.current.input
      else if (textareaRef.current.input) {
        element = textareaRef.current.input;
      }
      // 直接是 DOM 元素
      else if (textareaRef.current.tagName) {
        element = textareaRef.current;
      }
      // 嘗試其他可能的路徑
      else if (textareaRef.current.resizableTextArea) {
        element = textareaRef.current.resizableTextArea;
      }
    }
    
    return element;
  };

  // 格式化文本函数 - 使用純 React 方式
  const applyFormat = (fieldName, textareaRef, formatType) => {
    console.log('🎨 [applyFormat] 開始格式化:', { fieldName, formatType });
    
    const element = getInputElement(textareaRef);
    if (!element) {
      message.error(t('whatsappTemplate.metaTemplate.cannotGetInputElement'));
      return;
    }

    const start = element.selectionStart;
    const end = element.selectionEnd;
    const currentValue = element.value || '';
    
    // 如果没有选中文字
    if (start === end) {
      message.warning(t('whatsappTemplate.metaTemplate.pleaseSelectTextToFormat'));
      return;
    }

    const selectedText = currentValue.substring(start, end);
    let formattedText = '';

    switch (formatType) {
      case 'bold':
        formattedText = `*${selectedText}*`;
        break;
      case 'italic':
        formattedText = `_${selectedText}_`;
        break;
      case 'strikethrough':
        formattedText = `~${selectedText}~`;
        break;
      case 'code':
        formattedText = `\`\`\`${selectedText}\`\`\``;
        break;
      default:
        formattedText = selectedText;
    }

    const newValue = currentValue.substring(0, start) + formattedText + currentValue.substring(end);
    
    console.log('🔄 [applyFormat] 格式化結果:', {
      selectedText: `"${selectedText}"`,
      formattedText: `"${formattedText}"`,
      newValue: `"${newValue}"`
    });
    
    // 更新表單值並強制重新渲染
    form.setFieldsValue({ [fieldName]: newValue });
    
    // 強制觸發表單重新渲染
    form.validateFields([fieldName]).catch(() => {});
    
    // 如果是 bodyText，重新解析变量
    if (fieldName === 'bodyText') {
      parseBodyVariables(newValue);
    }

    // 使用 setTimeout 來確保在 Form 重新渲染後設置光標
    setTimeout(() => {
      const updatedElement = getInputElement(textareaRef);
      if (updatedElement) {
        updatedElement.focus();
        updatedElement.setSelectionRange(start + formattedText.length, start + formattedText.length);
      }
    }, 100);
    
    console.log('✅ [applyFormat] 格式化完成');
  };

  // 打开变量插入 Modal
  const openVariableModal = (fieldName, textareaRef) => {
    setCurrentFieldForVariable(fieldName);
    setCurrentTextareaRefForVariable(textareaRef);
    setVariableType('number');
    setVariableName('');
    setIsVariableModalVisible(true);
  };

  // 插入变量 - 使用純 React 方式
  const insertVariable = () => {
    const element = getInputElement(currentTextareaRefForVariable);
    
    if (!element || !currentFieldForVariable) {
      message.error(t('whatsappTemplate.metaTemplate.cannotInsertVariable'));
      return;
    }

    const start = element.selectionStart || 0;
    const currentValue = element.value || '';
    
    let variableText = '';
    
    if (variableType === 'number') {
      // 找到下一个变量编号
      const matches = currentValue.match(/\{\{(\d+)\}\}/g);
      let nextIndex = 1;
      if (matches) {
        const indices = matches.map(m => parseInt(m.replace(/\{\{|\}\}/g, '')));
        nextIndex = Math.max(...indices) + 1;
      }
      variableText = `{{${nextIndex}}}`;
    } else {
      // 使用自定义变量名
      if (!variableName.trim()) {
        message.warning(t('whatsappTemplate.metaTemplate.pleaseEnterVariableName'));
        return;
      }
      variableText = `{{${variableName.trim()}}}`;
    }

    const newValue = currentValue.substring(0, start) + variableText + currentValue.substring(start);
    
    console.log('🔧 [insertVariable] 插入變數:', {
      variableText,
      newValue: `"${newValue}"`
    });
    
    // 更新表單值並強制重新渲染
    form.setFieldsValue({ [currentFieldForVariable]: newValue });
    
    // 強制觸發表單重新渲染
    form.validateFields([currentFieldForVariable]).catch(() => {});
    
    // 如果是 bodyText，重新解析变量
    if (currentFieldForVariable === 'bodyText') {
      parseBodyVariables(newValue);
    }

    // 关闭 Modal
    setIsVariableModalVisible(false);
    message.success(`${t('whatsappTemplate.metaTemplate.variableInserted')} ${variableText}`);

    // 設置光標位置
    setTimeout(() => {
      const updatedElement = getInputElement(currentTextareaRefForVariable);
      if (updatedElement) {
        updatedElement.focus();
        updatedElement.setSelectionRange(start + variableText.length, start + variableText.length);
      }
    }, 100);
    
    console.log('✅ [insertVariable] 變數插入完成');
  };

  // 自定義輸入組件 - 不受 Form 控制
  const CustomInput = ({ fieldName, textareaRef, placeholder, maxLength, rows = 1, showFormatButtons = true, showVariableButton = true, onParseVariables }) => {
    const [value, setValue] = useState('');
    const [isUserTyping, setIsUserTyping] = useState(false);
    
    // 只在組件初始化時同步表單值，避免用戶打字時被覆蓋
    useEffect(() => {
      if (!isUserTyping) {
        const currentValue = form.getFieldValue(fieldName) || '';
        setValue(currentValue);
      }
    }, [fieldName]);
    
    const handleChange = (e) => {
      const newValue = e.target.value;
      setIsUserTyping(true);
      setValue(newValue);
      form.setFieldsValue({ [fieldName]: newValue });
      // 不在輸入時立即解析變數，避免觸發重新渲染
    };
    
    // 當輸入框失去焦點時，重置用戶輸入狀態並解析變數
    const handleBlur = () => {
      setIsUserTyping(false);
      if (fieldName === 'bodyText' && onParseVariables) {
        // 使用防抖解析變數，避免頻繁觸發
        onParseVariables(value);
      }
    };
    
    const handleFormat = (formatType) => {
      const element = getInputElement(textareaRef);
      if (!element) return;
      
      const start = element.selectionStart;
      const end = element.selectionEnd;
      const currentValue = value;
      
      if (start === end) {
        message.warning(t('whatsappTemplate.metaTemplate.pleaseSelectTextToFormat'));
        return;
      }
      
      const selectedText = currentValue.substring(start, end);
      let formattedText = '';
      
      switch (formatType) {
        case 'bold':
          formattedText = `*${selectedText}*`;
          break;
        case 'italic':
          formattedText = `_${selectedText}_`;
          break;
        case 'strikethrough':
          formattedText = `~${selectedText}~`;
          break;
        case 'code':
          formattedText = `\`\`\`${selectedText}\`\`\``;
          break;
        default:
          formattedText = selectedText;
      }
      
      const newValue = currentValue.substring(0, start) + formattedText + currentValue.substring(end);
      setValue(newValue);
      form.setFieldsValue({ [fieldName]: newValue });
      
      if (fieldName === 'bodyText') {
        parseBodyVariables(newValue);
      }
      
      // 設置光標位置
    setTimeout(() => {
      element.focus();
        element.setSelectionRange(start + formattedText.length, start + formattedText.length);
      }, 10);
    };
    
    const handleInsertVariable = () => {
      openVariableModal(fieldName, textareaRef);
    };
    
    return (
      <div>
        {/* 格式化工具栏 */}
        <div style={{ 
          marginBottom: 8, 
          padding: '8px 12px', 
          background: '#fafafa', 
          borderRadius: 4,
          border: '1px solid #d9d9d9'
        }}>
          <Space size="small">
            {showFormatButtons && (
              <>
                <Tooltip title={t('whatsappTemplate.metaTemplate.boldTooltip')}>
                  <Button
                    size="small"
                    icon={<BoldOutlined />}
                    onClick={() => handleFormat('bold')}
                  />
                </Tooltip>
                <Tooltip title={t('whatsappTemplate.metaTemplate.italicTooltip')}>
                  <Button
                    size="small"
                    icon={<ItalicOutlined />}
                    onClick={() => handleFormat('italic')}
                  />
                </Tooltip>
                <Tooltip title={t('whatsappTemplate.metaTemplate.strikethroughTooltip')}>
                  <Button
                    size="small"
                    icon={<StrikethroughOutlined />}
                    onClick={() => handleFormat('strikethrough')}
                  />
                </Tooltip>
                <Tooltip title={t('whatsappTemplate.metaTemplate.codeTooltip')}>
                  <Button
                    size="small"
                    icon={<CodeOutlined />}
                    onClick={() => handleFormat('code')}
                  />
                </Tooltip>
              </>
            )}
            
            {showVariableButton && (
              <>
                {showFormatButtons && <Divider type="vertical" />}
                <Tooltip title={t('whatsappTemplate.metaTemplate.insertVariableTooltip')}>
                  <Button
                    size="small"
                    icon={<NumberOutlined />}
                    onClick={handleInsertVariable}
                  >
                    {t('whatsappTemplate.metaTemplate.addVariable')}
                  </Button>
                </Tooltip>
              </>
            )}
            
            <Divider type="vertical" />
            <span style={{ fontSize: '12px', color: '#999' }}>
              {value.length} {t('whatsappTemplate.metaTemplate.characters')}
            </span>
          </Space>
        </div>
        
        {/* 輸入框 */}
        {rows === 1 ? (
          <Input
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            maxLength={maxLength}
          />
        ) : (
          <TextArea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={rows}
          />
        )}
      </div>
    );
  };

  // 格式化工具栏组件（保留用於其他地方）
  const FormatToolbar = ({ fieldName, textareaRef, showVariableButton = true }) => (
    <div style={{ 
      marginBottom: 8, 
      padding: '8px 12px', 
      background: '#fafafa', 
      borderRadius: 4,
      border: '1px solid #d9d9d9'
    }}>
      <Space size="small">
        <Tooltip title={t('whatsappTemplate.metaTemplate.boldTooltip')}>
          <Button
            size="small"
            icon={<BoldOutlined />}
            onClick={() => applyFormat(fieldName, textareaRef, 'bold')}
          />
        </Tooltip>
        <Tooltip title={t('whatsappTemplate.metaTemplate.italicTooltip')}>
          <Button
            size="small"
            icon={<ItalicOutlined />}
            onClick={() => applyFormat(fieldName, textareaRef, 'italic')}
          />
        </Tooltip>
        <Tooltip title={t('whatsappTemplate.metaTemplate.strikethroughTooltip')}>
          <Button
            size="small"
            icon={<StrikethroughOutlined />}
            onClick={() => applyFormat(fieldName, textareaRef, 'strikethrough')}
          />
        </Tooltip>
        <Tooltip title={t('whatsappTemplate.metaTemplate.codeTooltip')}>
          <Button
            size="small"
            icon={<CodeOutlined />}
            onClick={() => applyFormat(fieldName, textareaRef, 'code')}
          />
        </Tooltip>
        
        {showVariableButton && (
          <>
            <Divider type="vertical" />
            <Tooltip title={t('whatsappTemplate.metaTemplate.insertVariableTooltip')}>
              <Button
                size="small"
                icon={<NumberOutlined />}
                onClick={() => openVariableModal(fieldName, textareaRef)}
              >
                {t('whatsappTemplate.metaTemplate.addVariable')}
              </Button>
            </Tooltip>
          </>
        )}
        
        <Divider type="vertical" />
        <span style={{ fontSize: '12px', color: '#999' }}>
          {form.getFieldValue(fieldName)?.length || 0} {t('whatsappTemplate.metaTemplate.characters')}
        </span>
      </Space>
    </div>
  );

  // 添加按鈕
  const addButton = () => {
    if (buttons.length < 3) {
      setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }]);
    } else {
      message.warning(t('whatsappTemplate.metaTemplate.maxButtonsWarning'));
    }
  };

  // 移除按鈕
  const removeButton = (index) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  // 更新按鈕
  const updateButton = (index, field, value) => {
    const newButtons = [...buttons];
    newButtons[index][field] = value;
    setButtons(newButtons);
  };

  // 表格列定義
  const columns = [
    {
      title: t('whatsappTemplate.metaTemplate.templateName'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
      render: (text) => <strong>{text}</strong>
    },
    {
      title: t('whatsappTemplate.metaTemplate.category'),
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category) => {
        const colors = {
          'MARKETING': 'blue',
          'UTILITY': 'green',
          'AUTHENTICATION': 'orange'
        };
        const labels = {
          'MARKETING': t('whatsappTemplate.metaTemplate.marketing'),
          'UTILITY': t('whatsappTemplate.metaTemplate.utility'),
          'AUTHENTICATION': t('whatsappTemplate.metaTemplate.authentication')
        };
        return <Tag color={colors[category]}>{labels[category] || category}</Tag>;
      }
    },
    {
      title: t('whatsappTemplate.metaTemplate.language'),
      dataIndex: 'language',
      key: 'language',
      width: 100,
      render: (lang) => {
        const langMap = {
          'zh_TW': t('whatsappTemplate.metaTemplate.traditionalChinese'),
          'zh_CN': t('whatsappTemplate.metaTemplate.simplifiedChinese'),
          'en_US': t('whatsappTemplate.metaTemplate.english')
        };
        return <Tag>{langMap[lang] || lang}</Tag>;
      }
    },
    {
      title: t('whatsappTemplate.metaTemplate.reviewStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const statusConfig = {
          'APPROVED': { color: 'success', icon: <CheckCircleOutlined />, text: t('whatsappTemplate.metaTemplate.approved') },
          'PENDING': { color: 'processing', icon: <ClockCircleOutlined />, text: t('whatsappTemplate.metaTemplate.pending') },
          'REJECTED': { color: 'error', icon: <CloseCircleOutlined />, text: t('whatsappTemplate.metaTemplate.rejected') },
          'PAUSED': { color: 'warning', icon: <ClockCircleOutlined />, text: t('whatsappTemplate.metaTemplate.paused') }
        };
        const config = statusConfig[status] || { color: 'default', icon: null, text: status };
        return (
          <Badge 
            status={config.color} 
            text={
              <span>
                {config.icon} {config.text}
              </span>
            }
          />
        );
      }
    },
    {
      title: t('whatsappTemplate.metaTemplate.metaId'),
      dataIndex: 'id',
      key: 'id',
      width: 150,
      ellipsis: true,
      render: (text) => <Tooltip title={text}><span style={{ fontSize: '12px', color: '#999' }}>{text?.substring(0, 20)}...</span></Tooltip>
    },
    {
      title: t('whatsappTemplate.metaTemplate.action'),
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('whatsappTemplate.metaTemplate.preview')}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handlePreviewTemplate(record)}
            />
          </Tooltip>
          
          <Popconfirm
            title={t('whatsappTemplate.metaTemplate.deleteConfirmTitle')}
            description={t('whatsappTemplate.metaTemplate.deleteConfirmDescription')}
            onConfirm={() => handleDeleteTemplate(record.name)}
            okText={t('whatsappTemplate.metaTemplate.confirm')}
            cancelText={t('whatsappTemplate.metaTemplate.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Tooltip title={t('whatsappTemplate.metaTemplate.delete')}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 操作按鈕 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setIsCreateModalVisible(true);
            form.resetFields();
            setBodyVariables([]);
            setButtons([]);
          }}
        >
          {t('whatsappTemplate.metaTemplate.createMetaTemplate')}
        </Button>
      </div>

      {/* 搜索和篩選區域 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder={t('whatsappTemplate.metaTemplate.searchPlaceholder')}
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t('whatsappTemplate.metaTemplate.selectStatus')}
              value={filterStatus}
              onChange={setFilterStatus}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="APPROVED">{t('whatsappTemplate.metaTemplate.approved')}</Option>
              <Option value="PENDING">{t('whatsappTemplate.metaTemplate.pending')}</Option>
              <Option value="REJECTED">{t('whatsappTemplate.metaTemplate.rejected')}</Option>
              <Option value="PAUSED">{t('whatsappTemplate.metaTemplate.paused')}</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t('whatsappTemplate.metaTemplate.selectCategory')}
              value={filterCategory}
              onChange={setFilterCategory}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="MARKETING">{t('whatsappTemplate.metaTemplate.marketing')}</Option>
              <Option value="UTILITY">{t('whatsappTemplate.metaTemplate.utility')}</Option>
              <Option value="AUTHENTICATION">{t('whatsappTemplate.metaTemplate.authentication')}</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t('whatsappTemplate.metaTemplate.selectLanguage')}
              value={filterLanguage}
              onChange={setFilterLanguage}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="zh_TW">{t('whatsappTemplate.metaTemplate.traditionalChinese')}</Option>
              <Option value="zh_CN">{t('whatsappTemplate.metaTemplate.simplifiedChinese')}</Option>
              <Option value="en_US">{t('whatsappTemplate.metaTemplate.english')}</Option>
            </Select>
          </Col>
        </Row>
        <Row style={{ marginTop: 12 }}>
          <Col span={24}>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={loading}
              >
                {t('whatsappTemplate.metaTemplate.query')}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  handleClearFilters();
                  setTimeout(() => fetchMetaTemplates(), 100);
                }}
              >
                {t('whatsappTemplate.metaTemplate.refresh')}
              </Button>
              <Button
                onClick={handleClearFilters}
              >
                {t('whatsappTemplate.metaTemplate.clearFilter')}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 提示卡片 */}
      <Card size="small" style={{ marginBottom: 16, background: '#f0f7ff', borderColor: '#91caff' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <FileTextOutlined style={{ fontSize: 18, color: '#1890ff', marginRight: 8 }} />
            <strong>{t('whatsappTemplate.metaTemplate.metaOfficialTemplates')}</strong>
            {t('whatsappTemplate.metaTemplate.metaDescription')}
          </div>
          
          <div style={{ fontSize: '13px', color: '#666', paddingLeft: 26 }}>
            <div style={{ marginBottom: 4 }}>
              📋 <strong>{t('whatsappTemplate.metaTemplate.applicableScenarios')}</strong>{t('whatsappTemplate.metaTemplate.applicableScenariosDesc')}
            </div>
            <div style={{ marginBottom: 4 }}>
              ⏰ <strong>{t('whatsappTemplate.metaTemplate.sessionWindow')}</strong>
              <div style={{ marginLeft: 20, marginTop: 4 }}>
                • <strong style={{ color: '#52c41a' }}>{t('whatsappTemplate.metaTemplate.withinWindowLabel')}</strong>{t('whatsappTemplate.metaTemplate.withinWindow')}
              </div>
              <div style={{ marginLeft: 20, marginTop: 4 }}>
                • <strong style={{ color: '#ff4d4f' }}>{t('whatsappTemplate.metaTemplate.outsideWindowLabel')}</strong>{t('whatsappTemplate.metaTemplate.outsideWindow')}
              </div>
            </div>
            <div style={{ marginTop: 4 }}>
              💡 <strong>{t('whatsappTemplate.metaTemplate.tip')}</strong>{t('whatsappTemplate.metaTemplate.tipDescription')}
            </div>
          </div>
        </Space>
      </Card>

      {/* 模板列表 */}
      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showTotal: (total) => t('whatsappTemplate.metaTemplate.totalTemplates').replace('{count}', total)
        }}
      />

      {/* 創建模板 Modal */}
      <Modal
        title={t('whatsappTemplate.metaTemplate.createTitle')}
        open={isCreateModalVisible}
        onCancel={() => {
          setIsCreateModalVisible(false);
          form.resetFields();
          setBodyVariables([]);
          setButtons([]);
        }}
        width={800}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTemplate}
        >
          <Divider orientation="left">{t('whatsappTemplate.metaTemplate.basicInfo')}</Divider>
          
          <Form.Item
            name="name"
            label={t('whatsappTemplate.metaTemplate.templateName')}
            rules={[
              { required: true, message: t('whatsappTemplate.metaTemplate.nameRequired') },
              { pattern: /^[a-z0-9_]+$/, message: t('whatsappTemplate.metaTemplate.namePattern') }
            ]}
            help={t('whatsappTemplate.metaTemplate.templateNameHelp')}
          >
            <Input placeholder={t('whatsappTemplate.metaTemplate.templateNamePlaceholder')} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label={t('whatsappTemplate.metaTemplate.category')}
                rules={[{ required: true, message: t('whatsappTemplate.metaTemplate.categoryRequired') }]}
              >
                <Select placeholder={t('whatsappTemplate.metaTemplate.categoryPlaceholder')}>
                  <Option value="MARKETING">{t('whatsappTemplate.metaTemplate.marketingFull')}</Option>
                  <Option value="UTILITY">{t('whatsappTemplate.metaTemplate.utilityFull')}</Option>
                  <Option value="AUTHENTICATION">{t('whatsappTemplate.metaTemplate.authenticationFull')}</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="language"
                label={t('whatsappTemplate.metaTemplate.language')}
                rules={[{ required: true, message: t('whatsappTemplate.metaTemplate.languageRequired') }]}
              >
                <Select placeholder={t('whatsappTemplate.metaTemplate.languagePlaceholder')}>
                  <Option value="zh_TW">{t('whatsappTemplate.metaTemplate.traditionalChinese')}</Option>
                  <Option value="zh_CN">{t('whatsappTemplate.metaTemplate.simplifiedChinese')}</Option>
                  <Option value="en_US">{t('whatsappTemplate.metaTemplate.english')}</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 類別說明卡片 */}
          <Card size="small" style={{ marginBottom: 16, background: '#fff7e6', borderColor: '#ffd591' }}>
            <div style={{ fontSize: '13px' }}>
              <strong style={{ color: '#fa8c16' }}>📌 {t('whatsappTemplate.metaTemplate.categoryDescriptionTitle')}</strong>
              
              <div style={{ marginTop: 8, paddingLeft: 0 }}>
                <div style={{ marginBottom: 8 }}>
                  <Tag color="blue">MARKETING（營銷）</Tag>
                  <span style={{ color: '#666' }}>{t('whatsappTemplate.metaTemplate.marketingDescription')}</span>
                </div>
                
                <div style={{ marginBottom: 8 }}>
                  <Tag color="green">UTILITY（實用）</Tag>
                  <span style={{ color: '#666' }}>{t('whatsappTemplate.metaTemplate.utilityDescription')}</span>
                  <div style={{ marginLeft: 0, fontSize: '12px', color: '#ff4d4f', marginTop: 4 }}>
                    ⚠️ {t('whatsappTemplate.metaTemplate.utilityWarning')}
                  </div>
                </div>
                
                <div>
                  <Tag color="orange">AUTHENTICATION（驗證）</Tag>
                  <span style={{ color: '#666' }}>{t('whatsappTemplate.metaTemplate.authenticationDescription')}</span>
                </div>
              </div>
            </div>
          </Card>

          <Divider orientation="left">{t('whatsappTemplate.metaTemplate.contentComponents')}</Divider>
          
          {/* 格式化說明卡片 */}
          <Card size="small" style={{ marginBottom: 16, background: '#fffbe6', borderColor: '#ffe58f' }}>
            <div style={{ fontSize: '12px' }}>
              <strong>{t('whatsappTemplate.metaTemplate.formatHelp')}</strong>
              <div style={{ marginTop: 4, color: '#666' }}>
                {t('whatsappTemplate.metaTemplate.formatExamples')}
                <br />
                • {t('whatsappTemplate.metaTemplate.variableHelp')}
              </div>
            </div>
          </Card>

          <Form.Item
            name="headerText"
            label={t('whatsappTemplate.metaTemplate.headerOptional')}
          >
            <CustomInput
              fieldName="headerText" 
              textareaRef={headerTextRef} 
              placeholder={t('whatsappTemplate.metaTemplate.headerPlaceholder')}
              maxLength={60}
              rows={1}
              showFormatButtons={false}
              showVariableButton={true}
            />
          </Form.Item>

          <Form.Item
            name="bodyText"
            label={t('whatsappTemplate.metaTemplate.bodyContent')}
            rules={[{ required: true, message: t('whatsappTemplate.metaTemplate.bodyRequired') }]}
            help={t('whatsappTemplate.metaTemplate.bodyHelp')}
          >
            <CustomInput
              fieldName="bodyText" 
              textareaRef={bodyTextRef} 
              placeholder={t('whatsappTemplate.metaTemplate.bodyPlaceholder')}
              maxLength={1024}
              rows={6}
              showFormatButtons={true}
              showVariableButton={true}
              onParseVariables={debouncedParseVariables}
            />
          </Form.Item>

          {/* 變數示例 */}
          {bodyVariables.length > 0 && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}><strong>{t('whatsappTemplate.metaTemplate.variableExamples')}</strong></div>
              {bodyVariables.map((variable, index) => (
                <Form.Item
                  key={index}
                  label={t('whatsappTemplate.metaTemplate.variableExampleLabel').replace('{{index}}', variable.index)}
                  style={{ marginBottom: 8 }}
                >
                  <Input
                    placeholder={t('whatsappTemplate.metaTemplate.variableExamplePlaceholder')}
                    value={variable.example}
                    onChange={(e) => {
                      const newVars = [...bodyVariables];
                      newVars[index].example = e.target.value;
                      setBodyVariables(newVars);
                    }}
                  />
                </Form.Item>
              ))}
            </Card>
          )}

          <Form.Item
            name="footerText"
            label={t('whatsappTemplate.metaTemplate.footerOptional')}
          >
            <CustomInput
              fieldName="footerText" 
              textareaRef={footerTextRef} 
              placeholder={t('whatsappTemplate.metaTemplate.footerPlaceholder')}
              maxLength={60}
              rows={1}
              showFormatButtons={false}
              showVariableButton={false}
            />
          </Form.Item>

          <Divider orientation="left">{t('whatsappTemplate.metaTemplate.buttonsOptional')}</Divider>

          {buttons.map((button, index) => (
            <Card key={index} size="small" style={{ marginBottom: 8 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Select
                    value={button.type}
                    onChange={(value) => updateButton(index, 'type', value)}
                    style={{ width: '100%' }}
                  >
                    <Option value="QUICK_REPLY">{t('whatsappTemplate.metaTemplate.quickReply')}</Option>
                    <Option value="URL">{t('whatsappTemplate.metaTemplate.url')}</Option>
                    <Option value="PHONE_NUMBER">{t('whatsappTemplate.metaTemplate.phoneNumber')}</Option>
                  </Select>
                </Col>
                <Col span={8}>
                  <Input
                    placeholder={t('whatsappTemplate.metaTemplate.buttonTextPlaceholder')}
                    value={button.text}
                    onChange={(e) => updateButton(index, 'text', e.target.value)}
                    maxLength={20}
                  />
                </Col>
                {button.type === 'URL' && (
                  <Col span={8}>
                    <Input
                      placeholder={t('whatsappTemplate.metaTemplate.urlPlaceholder')}
                      value={button.url}
                      onChange={(e) => updateButton(index, 'url', e.target.value)}
                    />
                  </Col>
                )}
                {button.type === 'PHONE_NUMBER' && (
                  <Col span={8}>
                    <Input
                      placeholder={t('whatsappTemplate.metaTemplate.phonePlaceholder')}
                      value={button.phoneNumber}
                      onChange={(e) => updateButton(index, 'phoneNumber', e.target.value)}
                    />
                  </Col>
                )}
                <Col span={2}>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeButton(index)}
                  />
                </Col>
              </Row>
            </Card>
          ))}

          <Button
            type="dashed"
            onClick={addButton}
            disabled={buttons.length >= 3}
            icon={<PlusOutlined />}
            style={{ width: '100%', marginBottom: 16 }}
          >
            {t('whatsappTemplate.metaTemplate.buttonCount').replace('{count}', buttons.length)}
          </Button>

          <Divider />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('whatsappTemplate.metaTemplate.submit')}
              </Button>
              <Button onClick={() => {
                setIsCreateModalVisible(false);
                form.resetFields();
                setBodyVariables([]);
                setButtons([]);
              }}>
                {t('whatsappTemplate.metaTemplate.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 預覽 Modal */}
      <Modal
        title={t('whatsappTemplate.metaTemplate.previewTitle')}
        open={isPreviewModalVisible}
        onCancel={() => setIsPreviewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsPreviewModalVisible(false)}>
            {t('whatsappTemplate.metaTemplate.cancel')}
          </Button>
        ]}
        width={700}
      >
        {previewTemplate && (
          <div>
            <Card title={t('whatsappTemplate.metaTemplate.basicInfoTitle')} size="small" style={{ marginBottom: 16 }}>
              <p><strong>{t('whatsappTemplate.metaTemplate.name')}</strong>{previewTemplate.name}</p>
              <p><strong>{t('whatsappTemplate.metaTemplate.category')}</strong><Tag>{previewTemplate.category}</Tag></p>
              <p><strong>{t('whatsappTemplate.metaTemplate.language')}</strong><Tag>{previewTemplate.language}</Tag></p>
              <p><strong>{t('whatsappTemplate.metaTemplate.status')}</strong>
                <Tag color={previewTemplate.status === 'APPROVED' ? 'green' : previewTemplate.status === 'REJECTED' ? 'red' : 'orange'}>
                  {previewTemplate.status}
                </Tag>
              </p>
              
              {/* 顯示拒絕原因 */}
              {previewTemplate.status === 'REJECTED' && (
                <div style={{ marginTop: 12 }}>
                  <p><strong style={{ color: '#ff4d4f' }}>❌ {t('whatsappTemplate.metaTemplate.rejectionReason')}</strong></p>
                  
                  {previewTemplate.rejected_reason ? (
                    <div style={{ 
                      padding: 12, 
                      background: '#fff2f0', 
                      border: '1px solid #ffccc7',
                      borderRadius: 6,
                      color: '#ff4d4f'
                    }}>
                      {previewTemplate.rejected_reason}
                    </div>
                  ) : (
                    <div style={{ 
                      padding: 12, 
                      background: '#fff2f0', 
                      border: '1px solid #ffccc7',
                      borderRadius: 6,
                      color: '#ff4d4f'
                    }}>
                      <div style={{ marginBottom: 8 }}>
                        <strong>{t('whatsappTemplate.metaTemplate.apiNoRejectionReason')}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {t('whatsappTemplate.metaTemplate.apiLimitationNote')}
                      </div>
                    </div>
                  )}
                  
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
                    💡 <strong>{t('whatsappTemplate.metaTemplate.suggestion')}</strong>{t('whatsappTemplate.metaTemplate.suggestionText')}
                    
                    <div style={{ marginTop: 8, padding: 8, background: '#f6f6f6', borderRadius: 4 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{t('whatsappTemplate.metaTemplate.commonRejectionReasons')}</div>
                      <div>• <strong>{t('whatsappTemplate.metaTemplate.floatingParameters')}</strong>{t('whatsappTemplate.metaTemplate.floatingParametersDesc')}</div>
                      <div>• <strong>{t('whatsappTemplate.metaTemplate.marketingContent')}</strong>{t('whatsappTemplate.metaTemplate.marketingContentDesc')}</div>
                      <div>• <strong>{t('whatsappTemplate.metaTemplate.policyViolation')}</strong>{t('whatsappTemplate.metaTemplate.policyViolationDesc')}</div>
                      <div>• <strong>{t('whatsappTemplate.metaTemplate.wrongCategory')}</strong>{t('whatsappTemplate.metaTemplate.wrongCategoryDesc')}</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 顯示質量評級 */}
              {previewTemplate.quality_rating && (
                <p style={{ marginTop: 8 }}>
                  <strong>質量評級：</strong>
                  <Tag color={previewTemplate.quality_rating === 'HIGH' ? 'green' : previewTemplate.quality_rating === 'MEDIUM' ? 'orange' : 'red'}>
                    {previewTemplate.quality_rating}
                  </Tag>
                </p>
              )}
              
              {/* 顯示創建/更新時間 */}
              {previewTemplate.created_time && (
                <p style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
                  <strong>創建時間：</strong>{new Date(previewTemplate.created_time).toLocaleString('zh-TW')}
                </p>
              )}
              {previewTemplate.updated_time && (
                <p style={{ fontSize: '12px', color: '#999' }}>
                  <strong>更新時間：</strong>{new Date(previewTemplate.updated_time).toLocaleString('zh-TW')}
                </p>
              )}
            </Card>

            <Card title={t('whatsappTemplate.metaTemplate.templateContent')} size="small">
              {previewTemplate.components?.map((component, index) => (
                <div key={index} style={{ marginBottom: 12 }}>
                  <strong>{component.type}：</strong>
                  <div style={{ 
                    padding: 8, 
                    background: '#f5f5f5', 
                    borderRadius: 4,
                    marginTop: 4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {component.text || JSON.stringify(component, null, 2)}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </Modal>

      {/* 變數插入 Modal */}
      <Modal
        title={t('whatsappTemplate.metaTemplate.insertVariableTitle')}
        open={isVariableModalVisible}
        onOk={insertVariable}
        onCancel={() => setIsVariableModalVisible(false)}
        okText={t('whatsappTemplate.metaTemplate.insert')}
        cancelText={t('whatsappTemplate.metaTemplate.cancel')}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <strong>{t('whatsappTemplate.metaTemplate.variableType')}：</strong>
          </div>
          <Radio.Group 
            value={variableType} 
            onChange={(e) => setVariableType(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio value="number">
                <div>
                  <div><strong>{t('whatsappTemplate.metaTemplate.numberVariable')}</strong> <Tag>{t('whatsappTemplate.metaTemplate.recommended')}</Tag></div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                    {t('whatsappTemplate.metaTemplate.autoNumberDescription')}<code>{'{{1}}'}</code> <code>{'{{2}}'}</code> <code>{'{{3}}'}</code> ...
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: 2 }}>
                    {t('whatsappTemplate.metaTemplate.metaStandardFormat')}
                  </div>
                </div>
              </Radio>
              <Radio value="name">
                <div>
                  <div><strong>{t('whatsappTemplate.metaTemplate.nameVariable')}</strong></div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                    {t('whatsappTemplate.metaTemplate.customNameDescription')}<code>{'{{customer_name}}'}</code> <code>{'{{order_id}}'}</code>
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: 2 }}>
                    {t('whatsappTemplate.metaTemplate.moreReadable')}
                  </div>
                </div>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        {variableType === 'name' && (
          <div>
            <div style={{ marginBottom: 8 }}>
              <strong>{t('whatsappTemplate.metaTemplate.variableName')}：</strong>
            </div>
            <Input
              placeholder={t('whatsappTemplate.metaTemplate.variableNamePlaceholder')}
              value={variableName}
              onChange={(e) => setVariableName(e.target.value)}
              onPressEnter={insertVariable}
              autoFocus
            />
            <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
              {t('whatsappTemplate.metaTemplate.variableNameHelp')}
            </div>
          </div>
        )}

        {variableType === 'number' && (
          <div style={{ padding: 12, background: '#f0f7ff', borderRadius: 4, marginTop: 12 }}>
            <div style={{ fontSize: '12px', color: '#1890ff' }}>
              💡 {t('whatsappTemplate.metaTemplate.autoNumberHelp')}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MetaTemplatePanel;

