import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Button, Form, Input, Select, message, Tag, Modal,
  Space, Card, Divider, Row, Col, Tooltip, Popconfirm, Badge, Steps, Radio, Pagination, Upload
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ReloadOutlined, EyeOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  FileTextOutlined, SearchOutlined, BoldOutlined, ItalicOutlined,
  StrikethroughOutlined, CodeOutlined, NumberOutlined, SmileOutlined,
  UploadOutlined, FileImageOutlined, VideoCameraOutlined, FileOutlined, EnvironmentOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import TimezoneUtils from '../utils/timezoneUtils';

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

  // 用戶時區偏移狀態
  const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8');

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
  
  // Header 格式相關狀態
  const [headerFormat, setHeaderFormat] = useState('NONE'); // NONE, TEXT, IMAGE, VIDEO, DOCUMENT
  const [headerFile, setHeaderFile] = useState(null); // 上傳的檔案
  const [headerFileUrl, setHeaderFileUrl] = useState(''); // 檔案 URL（HTTP/HTTPS URL，用於提交）
  const [headerFilePreviewUrl, setHeaderFilePreviewUrl] = useState(''); // 預覽 URL（object URL，僅用於預覽）
  const [headerLocation, setHeaderLocation] = useState({ latitude: '', longitude: '' }); // 地點座標
  
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

  // 全屏預覽狀態
  const [isFullscreenPreviewVisible, setIsFullscreenPreviewVisible] = useState(false);
  const [fullscreenMediaUrl, setFullscreenMediaUrl] = useState('');
  const [fullscreenMediaType, setFullscreenMediaType] = useState(''); // 'image' 或 'video'

  useEffect(() => {
    fetchMetaTemplates();
  }, []);

  // 清理 object URL 的 useEffect
  useEffect(() => {
    return () => {
      if (headerFilePreviewUrl) {
        URL.revokeObjectURL(headerFilePreviewUrl);
      }
    };
  }, [headerFilePreviewUrl]);

  // 獲取用戶時區設置
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (userInfo.timezone) {
      setUserTimezoneOffset(userInfo.timezone);
    }
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
      if (headerFormat !== 'NONE') {
        const headerComponent = {
          type: 'HEADER',
          format: headerFormat
        };
        
        if (headerFormat === 'TEXT' && values.headerText) {
          headerComponent.text = values.headerText;
          // 如果有變數，添加示例
          const headerMatches = values.headerText.match(/\{\{(\d+)\}\}/g);
          if (headerMatches && headerMatches.length > 0) {
            const headerVars = headerMatches.map(match => {
              const index = parseInt(match.replace(/\{\{|\}\}/g, ''));
              return `示例${index}`;
            });
            headerComponent.example = {
              header_text: [headerVars]
            };
          }
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)) {
          // 對於媒體類型，需要上傳檔案到 Meta 並獲得 handle
          // Meta API 不接受 data URL (base64)，必須是 HTTP/HTTPS URL
          if (headerFileUrl) {
            // 檢查是否為 data URL（base64 格式）
            if (headerFileUrl.startsWith('data:')) {
              message.error(t('whatsappTemplate.metaTemplate.dataUrlNotSupported'));
              return;
            }
            
            // 驗證 URL 格式
            try {
              const url = new URL(headerFileUrl);
              if (!['http:', 'https:'].includes(url.protocol)) {
                message.error(t('whatsappTemplate.metaTemplate.urlMustBeHttp'));
                return;
              }
              
              // 檢查是否為 localhost 或本地 IP（Meta API 無法訪問）
              if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || 
                  url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.') ||
                  url.hostname.startsWith('172.')) {
                message.warning(t('whatsappTemplate.metaTemplate.localhostNotAccessible'));
                // 不阻止，但提示用戶
              }
            } catch (e) {
              message.error(t('whatsappTemplate.metaTemplate.invalidUrlFormat'));
              return;
            }
            
            // Meta API 要求 header_url 是字符串格式（不是數組）
            // 格式應該是：header_url: "https://example.com/image.jpg"
            headerComponent.example = {
              header_url: headerFileUrl
            };
            
            // 保存原始 URL 到 localStorage，以便預覽時使用
            const templateName = form.getFieldValue('name');
            if (templateName) {
              localStorage.setItem(`meta_template_media_${templateName}`, headerFileUrl);
            }
          } else if (headerFile) {
            // 用戶選擇了檔案但沒有提供 URL，需要先上傳到服務器
            // 使用專門的 Meta 模板媒體上傳端點，檔案會存儲在 /public 目錄（公開可訪問）
            message.loading(t('whatsappTemplate.metaTemplate.uploadingFile'), 0);
            
            try {
              const formData = new FormData();
              formData.append('file', headerFile);
              
              // 根據格式確定媒體類型
              const mediaType = headerFormat === 'IMAGE' ? 'image' :
                               headerFormat === 'VIDEO' ? 'video' :
                               'document';
              
              // 使用專門的 Meta 模板媒體上傳端點
              const uploadEndpoint = `/api/metatemplatemedia/upload?mediaType=${mediaType}`;
              
              const uploadResponse = await fetch(uploadEndpoint, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`
                },
                body: formData
              });
              
              message.destroy();
              
              if (!uploadResponse.ok) {
                const errorResult = await uploadResponse.json();
                message.error(t('whatsappTemplate.metaTemplate.fileUploadFailed') + ': ' + (errorResult.error || uploadResponse.statusText));
                return;
              }
              
              const uploadResult = await uploadResponse.json();
              
              if (uploadResult.success) {
                // 使用後端返回的 publicUrl（已根據當前 domain 生成）
                // 格式：{scheme}://{host}/public/meta-templates/{fileName}
                const fileUrl = uploadResult.publicUrl;
                setHeaderFileUrl(fileUrl);
                
                // 使用上傳後的 URL（字符串格式）
                headerComponent.example = {
                  header_url: fileUrl
                };
                
                // 保存原始 URL 到 localStorage，以便預覽時使用
                // 注意：只有在創建模板成功後才保存，這裡先保存，成功後會清除
                // 格式：meta_template_media_{templateName}
                const templateName = form.getFieldValue('name');
                if (templateName) {
                  localStorage.setItem(`meta_template_media_${templateName}`, fileUrl);
                }
              } else {
                message.error(t('whatsappTemplate.metaTemplate.fileUploadFailed'));
                return;
              }
            } catch (error) {
              message.destroy();
              console.error('上傳檔案錯誤:', error);
              message.error(t('whatsappTemplate.metaTemplate.fileUploadFailed') + ': ' + error.message);
              return;
            }
          } else {
            message.error(t('whatsappTemplate.metaTemplate.pleaseUploadFileOrUrl'));
            return;
          }
        }
        
        components.push(headerComponent);
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
      
      // 如果後端返回了 header_url，保存到 localStorage 以便發送時自動使用
      if (result.data && result.data.headerUrl) {
        const templateName = values.name;
        localStorage.setItem(`meta_template_media_${templateName}`, result.data.headerUrl);
        
        // 同時保存 header_type 和 header_filename（如果有的話）
        if (result.data.headerType) {
          localStorage.setItem(`meta_template_header_type_${templateName}`, result.data.headerType);
        }
        if (result.data.headerFilename) {
          localStorage.setItem(`meta_template_header_filename_${templateName}`, result.data.headerFilename);
        }
        
        console.log(`💾 已保存 Header URL 到 localStorage: ${result.data.headerUrl}`);
      }
      
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
    
    // 嘗試從 localStorage 獲取保存的媒體 URL（如果有的話）
    // 格式：meta_template_media_{templateName}
    const savedMediaUrl = localStorage.getItem(`meta_template_media_${template.name}`);
    if (savedMediaUrl) {
      // 將保存的 URL 添加到 template 對象中，用於預覽
      const templateWithMedia = { ...template };
      if (templateWithMedia.components) {
        const headerComponent = templateWithMedia.components.find(c => c.type === 'HEADER');
        if (headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format)) {
          if (!headerComponent.example) {
            headerComponent.example = {};
          }
          // 保存原始 URL 供預覽使用
          headerComponent.example._preview_url = savedMediaUrl;
        }
      }
      setPreviewTemplate(templateWithMedia);
    } else {
    setPreviewTemplate(template);
    }
    
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
        pagination={false}
        size="small"
        style={{ width: '100%' }}
        scroll={{ x: 1200, y: 'calc(100vh - 450px)' }}
      />
      <div style={{ marginTop: 16, textAlign: 'left' }}>
        <Pagination
          current={1}
          pageSize={10}
          total={templates.length}
          showSizeChanger
          pageSizeOptions={['10', '20', '50', '100']}
          showTotal={(total, range) => `${t('whatsappTemplate.metaTemplate.pageRange')}${range[0]}-${range[1]}${t('whatsappTemplate.metaTemplate.total')}${total}`}
        />
      </div>

      {/* 創建模板 Modal */}
      <Modal
        title={t('whatsappTemplate.metaTemplate.createTitle')}
        open={isCreateModalVisible}
        onCancel={() => {
          setIsCreateModalVisible(false);
          form.resetFields();
          setBodyVariables([]);
          setButtons([]);
          setHeaderFormat('NONE');
          setHeaderFile(null);
          setHeaderFileUrl('');
          setHeaderLocation({ latitude: '', longitude: '' });
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

          {/* Header 格式選擇 */}
          <Form.Item
            label={t('whatsappTemplate.metaTemplate.headerOptional')}
          >
            <Select
              value={headerFormat}
              onChange={(value) => {
                setHeaderFormat(value);
                  if (value === 'NONE') {
                  form.setFieldsValue({ headerText: '' });
                  // 清理預覽 URL
                  if (headerFilePreviewUrl) {
                    URL.revokeObjectURL(headerFilePreviewUrl);
                  }
                  setHeaderFile(null);
                  setHeaderFilePreviewUrl('');
                  setHeaderFileUrl('');
                  setHeaderLocation({ latitude: '', longitude: '' });
                }
              }}
              style={{ width: '100%', marginBottom: 16 }}
            >
              <Option value="NONE">
                <Space>
                  <span>{t('whatsappTemplate.metaTemplate.headerNone')}</span>
                </Space>
              </Option>
              <Option value="TEXT">
                <Space>
                  <FileTextOutlined />
                  <span>{t('whatsappTemplate.metaTemplate.headerText')}</span>
                </Space>
              </Option>
              <Option value="IMAGE">
                <Space>
                  <FileImageOutlined />
                  <span>{t('whatsappTemplate.metaTemplate.headerImage')}</span>
                </Space>
              </Option>
              <Option value="VIDEO">
                <Space>
                  <VideoCameraOutlined />
                  <span>{t('whatsappTemplate.metaTemplate.headerVideo')}</span>
                </Space>
              </Option>
              <Option value="DOCUMENT">
                <Space>
                  <FileOutlined />
                  <span>{t('whatsappTemplate.metaTemplate.headerDocument')}</span>
                </Space>
              </Option>
            </Select>
          </Form.Item>

          {/* Header 內容 - 根據格式顯示不同輸入 */}
          {headerFormat === 'TEXT' && (
            <Form.Item
              name="headerText"
              label={t('whatsappTemplate.metaTemplate.headerText')}
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
          )}

          {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && (
            <>
              <Form.Item
                label={headerFormat === 'IMAGE' ? t('whatsappTemplate.metaTemplate.headerImage') :
                       headerFormat === 'VIDEO' ? t('whatsappTemplate.metaTemplate.headerVideo') :
                       t('whatsappTemplate.metaTemplate.headerDocument')}
              >
                <Upload.Dragger
                  name="file"
                  accept={headerFormat === 'IMAGE' ? '.jpg,.jpeg,.png,.gif,.bmp,.webp' :
                         headerFormat === 'VIDEO' ? '.mp4,.avi,.mov,.wmv' :
                         '.pdf,.doc,.docx,.txt'}
                  beforeUpload={(file) => {
                    setHeaderFile(file);
                    // 創建 object URL 用於預覽（僅用於顯示，不提交）
                    const previewUrl = URL.createObjectURL(file);
                    setHeaderFilePreviewUrl(previewUrl);
                    return false; // 阻止自動上傳
                  }}
                  onRemove={() => {
                    // 清理 object URL
                    if (headerFilePreviewUrl) {
                      URL.revokeObjectURL(headerFilePreviewUrl);
                    }
                    setHeaderFile(null);
                    setHeaderFilePreviewUrl('');
                    setHeaderFileUrl(''); // 也清除手動輸入的 URL
                  }}
                  maxCount={1}
                >
                  <p className="ant-upload-drag-icon">
                    {headerFormat === 'IMAGE' ? <FileImageOutlined /> :
                     headerFormat === 'VIDEO' ? <VideoCameraOutlined /> :
                     <FileOutlined />}
                  </p>
                  <p className="ant-upload-text">
                    {t('whatsappTemplate.metaTemplate.dragOrClickToUpload')}
                  </p>
                  <p className="ant-upload-hint">
                    {headerFormat === 'IMAGE' ? t('whatsappTemplate.metaTemplate.imageUploadHint') :
                     headerFormat === 'VIDEO' ? t('whatsappTemplate.metaTemplate.videoUploadHint') :
                     t('whatsappTemplate.metaTemplate.documentUploadHint')}
                  </p>
                </Upload.Dragger>
              </Form.Item>

              {/* 預覽：優先顯示上傳的檔案預覽，否則顯示 URL 的圖片 */}
              {headerFormat === 'IMAGE' && (headerFilePreviewUrl || (headerFileUrl && !headerFileUrl.startsWith('data:'))) && (
                <div style={{ marginBottom: 16 }}>
                  <img 
                    src={headerFilePreviewUrl || headerFileUrl} 
                    alt="預覽" 
                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 4 }}
                  />
                </div>
              )}

              <Form.Item
                label={t('whatsappTemplate.metaTemplate.orEnterUrl')}
                help={t('whatsappTemplate.metaTemplate.urlHelp')}
              >
                <Input
                  placeholder={t('whatsappTemplate.metaTemplate.enterFileUrl')}
                  value={headerFileUrl}
                  onChange={(e) => {
                    setHeaderFileUrl(e.target.value);
                    // 如果輸入 URL，不清除檔案，讓用戶可以選擇使用哪個
                  }}
                />
              </Form.Item>
            </>
          )}

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
                  <strong>創建時間：</strong>{TimezoneUtils.formatDateWithTimezone(previewTemplate.created_time, userTimezoneOffset)}
                </p>
              )}
              {previewTemplate.updated_time && (
                <p style={{ fontSize: '12px', color: '#999' }}>
                  <strong>更新時間：</strong>{TimezoneUtils.formatDateWithTimezone(previewTemplate.updated_time, userTimezoneOffset)}
                </p>
              )}
            </Card>

            {/* 圖形化預覽 */}
            <Card title={t('whatsappTemplate.metaTemplate.templateContent')} size="small" style={{ marginBottom: 16 }}>
              <div style={{
                background: 'linear-gradient(to bottom, #e5ddd5 0%, #e5ddd5 50%, #d4edda 50%, #d4edda 100%)',
                padding: '40px 20px',
                borderRadius: 8,
                minHeight: '400px',
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start'
              }}>
                {/* WhatsApp 消息氣泡 */}
                <div style={{
                  maxWidth: '85%',
                  width: '100%',
                  background: '#ffffff',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {/* Header 部分 */}
                  {previewTemplate.components?.find(c => c.type === 'HEADER') && (() => {
                    const headerComponent = previewTemplate.components.find(c => c.type === 'HEADER');
                    const format = headerComponent.format?.toUpperCase();
                    
                    if (format === 'IMAGE') {
                      // 嘗試從多個來源獲取圖片 URL：
                      // 1. 從 _preview_url（我們保存的原始 URL）
                      // 2. 從 header_url（如果有的話）
                      // 3. 從 header_handle（Meta 返回的，無法直接使用）
                      const headerExample = headerComponent.example;
                      const imageUrl = headerExample?._preview_url || 
                                     headerExample?.header_url || 
                                     (headerExample?.header_handle?.[0] && !headerExample.header_handle[0].startsWith('4:') ? headerExample.header_handle[0] : null);
                      
                      // 如果沒有有效的 URL，顯示提示
                      const hasValidUrl = imageUrl && !imageUrl.startsWith('4:') && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
                      
                      return (
                        <div style={{ width: '100%', background: '#f0f0f0' }}>
                          <div style={{
                            width: '100%',
                            aspectRatio: '16/9',
                            background: '#e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#999',
                            fontSize: '12px',
                            position: 'relative',
                            overflow: 'hidden'
                          }}>
                            {hasValidUrl ? (
                              <div 
                                style={{ 
                                  width: '100%', 
                                  height: '100%', 
                                  position: 'relative',
                                  cursor: 'pointer'
                                }}
                                onClick={() => {
                                  setFullscreenMediaUrl(imageUrl);
                                  setFullscreenMediaType('image');
                                  setIsFullscreenPreviewVisible(true);
                                }}
                              >
                                <img 
                                  src={imageUrl} 
                                  alt="Header" 
                                  style={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    objectFit: 'contain',
                                    display: 'block'
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    const errorDiv = document.createElement('div');
                                    errorDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #999; font-size: 12px; flex-direction: column; gap: 8px;';
                                    errorDiv.innerHTML = '<FileImageOutlined style="font-size: 24px;" /><span>圖片無法載入</span><span style="font-size: 10px;">Meta API 限制</span>';
                                    e.target.parentElement.appendChild(errorDiv);
                                  }}
                                />
                                <div style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  background: 'rgba(0,0,0,0.6)',
                                  color: '#fff',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <EyeOutlined /> 點擊全屏
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px' }}>
                                <FileImageOutlined style={{ fontSize: 32, color: '#999' }} />
                                <span style={{ fontSize: '12px' }}>圖片 Header</span>
                                <span style={{ fontSize: '10px', color: '#bbb', textAlign: 'center' }}>
                                  Meta API 僅返回 handle，<br />無法直接預覽圖片
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    } else if (format === 'VIDEO') {
                      // 嘗試獲取影片 URL
                      const headerExample = headerComponent.example;
                      const videoUrl = headerExample?._preview_url || 
                                     headerExample?.header_url || 
                                     (headerExample?.header_handle?.[0] && !headerExample.header_handle[0].startsWith('4:') ? headerExample.header_handle[0] : null);
                      const hasValidUrl = videoUrl && !videoUrl.startsWith('4:') && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'));
                      
                      return (
                        <div style={{
                          width: '100%',
                          aspectRatio: '16/9',
                          background: '#000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '12px',
                          position: 'relative'
                        }}>
                          {hasValidUrl ? (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                position: 'relative',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setFullscreenMediaUrl(videoUrl);
                                setFullscreenMediaType('video');
                                setIsFullscreenPreviewVisible(true);
                              }}
                            >
                              <video 
                                src={videoUrl}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                  display: 'block'
                                }}
                                controls={false}
                                muted
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  const errorDiv = document.createElement('div');
                                  errorDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #fff; font-size: 12px; flex-direction: column; gap: 8px;';
                                  errorDiv.innerHTML = '<VideoCameraOutlined style="font-size: 32px;" /><span>影片無法載入</span><span style="font-size: 10px;">Meta API 限制</span>';
                                  e.target.parentElement.appendChild(errorDiv);
                                }}
                              />
                              <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                background: 'rgba(0,0,0,0.6)',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <EyeOutlined /> 點擊全屏
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                              <VideoCameraOutlined style={{ fontSize: 32 }} />
                              <span>影片 Header</span>
                              <span style={{ fontSize: '10px', color: '#bbb', textAlign: 'center' }}>
                                Meta API 僅返回 handle，<br />無法直接預覽影片
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    } else if (format === 'DOCUMENT') {
                      return (
                        <div style={{
                          width: '100%',
                          padding: '16px',
                          background: '#f0f0f0',
                          borderBottom: '1px solid #e0e0e0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12
                        }}>
                          <FileOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>文件</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>PDF 文件</div>
                          </div>
                        </div>
                      );
                    } else if (format === 'TEXT' && headerComponent.text) {
                      return (
                        <div style={{
                          padding: '12px 16px',
                          background: '#f0f0f0',
                          borderBottom: '1px solid #e0e0e0',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {headerComponent.text.replace(/\{\{(\d+)\}\}/g, (match, num) => `{{${num}}}`)}
                        </div>
                      );
                    } else if (format === 'LOCATION') {
                      return (
                        <div style={{
                          width: '100%',
                          aspectRatio: '16/9',
                          background: '#e8f5e9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#4caf50',
                          fontSize: '12px',
                          borderBottom: '1px solid #e0e0e0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <EnvironmentOutlined style={{ fontSize: 24 }} />
                            <span>位置 Header</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Body 部分 */}
                  {previewTemplate.components?.find(c => c.type === 'BODY') && (() => {
                    const bodyComponent = previewTemplate.components.find(c => c.type === 'BODY');
                    if (!bodyComponent.text) return null;
                    
                    // 處理格式化文字（*粗體*, _斜體_, ~刪除線~, ```代碼```）
                    let formattedText = bodyComponent.text;
                    formattedText = formattedText.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
                    formattedText = formattedText.replace(/_([^_]+)_/g, '<em>$1</em>');
                    formattedText = formattedText.replace(/~([^~]+)~/g, '<del>$1</del>');
                    formattedText = formattedText.replace(/```([^`]+)```/g, '<code style="background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');
                    
                    return (
                      <div style={{
                        padding: '12px 16px',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: '#111b21'
                      }} dangerouslySetInnerHTML={{ __html: formattedText }} />
                    );
                  })()}
                  
                  {/* Footer 部分 */}
                  {previewTemplate.components?.find(c => c.type === 'FOOTER') && (() => {
                    const footerComponent = previewTemplate.components.find(c => c.type === 'FOOTER');
                    if (!footerComponent.text) return null;
                    
                    return (
                      <div style={{
                        padding: '8px 16px',
                        fontSize: '12px',
                        color: '#667781',
                        borderTop: '1px solid #e0e0e0',
                        background: '#f9f9f9'
                      }}>
                        {footerComponent.text}
                      </div>
                    );
                  })()}
                  
                  {/* Buttons 部分 */}
                  {previewTemplate.components?.find(c => c.type === 'BUTTONS') && (() => {
                    const buttonsComponent = previewTemplate.components.find(c => c.type === 'BUTTONS');
                    if (!buttonsComponent.buttons || buttonsComponent.buttons.length === 0) return null;
                    
                    return (
                      <div style={{
                        padding: '8px',
                        borderTop: '1px solid #e0e0e0',
                        background: '#f9f9f9'
                      }}>
                        {buttonsComponent.buttons.map((button, idx) => (
                          <div
                            key={idx}
                            style={{
                              marginBottom: idx < buttonsComponent.buttons.length - 1 ? '8px' : 0,
                              padding: '10px 12px',
                              background: '#ffffff',
                              border: '1px solid #e0e0e0',
                              borderRadius: '4px',
                              fontSize: '13px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#f0f0f0'}
                            onMouseLeave={(e) => e.target.style.background = '#ffffff'}
                          >
                            {button.type === 'QUICK_REPLY' && '💬 '}
                            {button.type === 'URL' && '🔗 '}
                            {button.type === 'PHONE_NUMBER' && '📞 '}
                            {button.text}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  
                  {/* 時間戳 */}
                  <div style={{
                    padding: '4px 16px 8px',
                    fontSize: '11px',
                    color: '#667781',
                    textAlign: 'right'
                  }}>
                    10:40
                  </div>
                </div>
              </div>
            </Card>
            
            {/* 原始數據（可選，用於調試） */}
            <Card title="原始數據" size="small" style={{ display: 'none' }}>
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

      {/* 全屏預覽 Modal */}
      <Modal
        open={isFullscreenPreviewVisible}
        onCancel={() => setIsFullscreenPreviewVisible(false)}
        footer={null}
        width="100%"
        style={{ top: 0, paddingBottom: 0, maxWidth: '100vw' }}
        bodyStyle={{ 
          padding: 0, 
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.95)'
        }}
        closable={true}
        maskClosable={true}
        centered
      >
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '40px'
        }}>
          {fullscreenMediaType === 'image' && (
            <img
              src={fullscreenMediaUrl}
              alt="Fullscreen Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #fff; font-size: 16px; flex-direction: column; gap: 12px;';
                errorDiv.innerHTML = '<div style="font-size: 48px;">📷</div><span>圖片無法載入</span>';
                e.target.parentElement.appendChild(errorDiv);
              }}
            />
          )}
          {fullscreenMediaType === 'video' && (
            <video
              src={fullscreenMediaUrl}
              controls
              autoPlay
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #fff; font-size: 16px; flex-direction: column; gap: 12px;';
                errorDiv.innerHTML = '<div style="font-size: 48px;">🎬</div><span>影片無法載入</span>';
                e.target.parentElement.appendChild(errorDiv);
              }}
            />
          )}
        </div>
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

