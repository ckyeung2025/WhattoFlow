/**
 * Meta Flow 工具函數
 * 用於處理 Meta WhatsApp Flows JSON 的生成、解析和驗證
 * 
 * 重要：所有組件格式必須嚴格按照 Meta 官方文檔：
 * https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson
 * https://developers.facebook.com/docs/whatsapp/flows/reference/components
 */

import { 
  COMPONENT_SPECS,
  getComponentSpec, 
  validateComponent, 
  getComponentsRequiringTerminal,
  getComponentsRequiringDataModel,
  extractDataSourceName,
  generateDataModel
} from './metaFlowComponentSpecs';

/**
 * 生成默認 Screen
 */
export const getDefaultScreen = (id = null) => {
  const screenId = id || `screen_${Date.now()}`;
  return {
    id: screenId,
    title: '新 Screen',
    data: {
      body: {
        type: 'body',
        text: '請輸入內容'
      },
      footer: {
        type: 'footer',
        text: '提交' // Footer 是必填項，設置默認值
      },
      header: {
        type: 'header',
        format: 'TEXT',
        text: '' // header 不能為 null，必須是對象
      },
      actions: []
    }
  };
};

/**
 * 生成默認組件
 */
export const getDefaultComponent = (type, id = null) => {
  const componentId = id || `${type}_${Date.now()}`;
  
  switch (type) {
    // 文本組件
    case 'text_heading':
      return {
        type: 'text_heading',
        text: '標題文本'
      };
    
    case 'text_body':
      return {
        type: 'text_body',
        text: '正文內容'
      };
    
    case 'footer':
      return {
        type: 'footer',
        text: '頁腳文本',
        action: {
          type: 'submit',
          payload: {}
        }
      };
    
    // 輸入組件
    case 'text_input':
      return {
        type: 'text_input',
        id: componentId,
        name: componentId, // 添加 name 用於 Meta JSON（TextInput 使用 name 而不是 id）
        title: '文字輸入',
        data: {
          input_type: 'text',
          // 注意：TextInput 不支持 placeholder
          required: false
        },
        action: {
          type: 'navigate',
          next: ''
        }
      };
    
    case 'rich_text':
      return {
        type: 'rich_text',
        id: componentId,
        title: '富文本顯示',
        data: {
          // RichText 使用 text 數組，支持 Markdown 語法
          text: ['請輸入富文本內容', '支持 *粗體*、_斜體_、~刪除線~ 等 Markdown 語法']
        }
      };
    
    case 'date_picker':
      return {
        type: 'date_picker',
        id: componentId, // 添加 id 以便在 UI 中識別和操作
        name: componentId, // name 用於 Meta JSON
        title: '日期選擇',
        data: {
          required: false
        },
        action: {
          type: 'submit',
          payload: {}
        }
      };
    
    case 'calendar_picker':
      return {
        type: 'calendar_picker',
        id: componentId, // 添加 id 以便在 UI 中識別和操作
        name: componentId, // name 用於 Meta JSON
        title: '日曆選擇',
        data: {
          required: false
        },
        action: {
          type: 'submit',
          payload: {}
        }
      };
    
    case 'time_picker':
      return {
        type: 'time_picker',
        name: componentId,
        title: '時間選擇',
        data: {
          required: false
        },
        action: {
          type: 'submit',
          payload: {}
        }
      };
    
    // 選擇組件
    case 'select':
      // 為每個 Dropdown 組件生成唯一的 data-source 名稱
      const dropdownDataSourceName = `dropdown_${componentId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      return {
        type: 'select',
        id: componentId, // 添加 id 以便在 UI 中識別和操作
        name: componentId, // Dropdown 使用 name 而不是 id（用於 Meta JSON）
        title: '下拉選擇',
        data: {
          data_source: `\${data.${dropdownDataSourceName}}`, // 使用唯一的 data-source 名稱
          required: false
        },
        action: {
          type: 'submit',
          payload: {}
        }
      };
    
    case 'checkbox':
      // 為每個 CheckboxGroup 組件生成唯一的 data-source 名稱
      const checkboxDataSourceName = `checkbox_${componentId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      return {
        type: 'checkbox',
        id: componentId, // 添加 id 以便在 UI 中識別和操作
        name: componentId, // CheckboxGroup 使用 name 而不是 id（用於 Meta JSON）
        title: '複選框組',
        data: {
          data_source: `\${data.${checkboxDataSourceName}}`, // 使用唯一的 data-source 名稱
          required: false
        },
        action: {
          type: 'submit',
          payload: {}
        }
      };
    
    case 'radio':
      // 為每個 RadioButtonsGroup 組件生成唯一的 data-source 名稱
      const radioDataSourceName = `radio_${componentId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      return {
        type: 'radio',
        id: componentId, // 添加 id 以便在 UI 中識別和操作
        name: componentId, // RadioButtonsGroup 使用 name 而不是 id（用於 Meta JSON）
        title: '單選框組',
        data: {
          data_source: `\${data.${radioDataSourceName}}`, // 使用唯一的 data-source 名稱
          required: false
        },
        action: {
          type: 'submit',
          payload: {}
        }
      };
    
    case 'chips_selector':
      return {
        type: 'chips_selector',
        id: componentId,
        name: componentId, // ChipsSelector 使用 name
        title: '小標籤選擇器',
        data: {
          options: [], // 不提供默認值，讓用戶自己添加
          required: false,
          max_selected_items: 2,
          description: ''
        },
        action: {
          type: 'submit',
          payload: {}
        }
      };
    
    // 按鈕組件
    case 'button':
      return {
        type: 'button',
        id: componentId,
        title: '按鈕',
        action: {
          type: 'navigate',
          next: ''
        }
      };
    
    // 媒體組件
    case 'image':
      return {
        type: 'image',
        id: componentId,
        title: '圖片',
        data: {
          url: '', // 編輯器中使用 url，生成 JSON 時轉換為 src
          src: '', // 同時保存 src
          width: 200, // 默認寬度
          height: 200 // 默認高度
        },
        action: {
          type: 'navigate',
          next: ''
        }
      };
    
    case 'video':
      return {
        type: 'video',
        id: componentId,
        title: '視頻',
        data: {
          url: '',
          thumbnail_url: ''
        },
        action: {
          type: 'navigate',
          next: ''
        }
      };
    
    case 'document':
      return {
        type: 'document',
        id: componentId,
        title: '文檔',
        data: {
          url: '',
          filename: 'document.pdf'
        },
        action: {
          type: 'navigate',
          next: ''
        }
      };
    
    // 媒體上傳組件（從 Flow JSON version 4.0 開始支持）
    case 'photo_picker':
      return {
        type: 'photo_picker',
        id: componentId, // 添加 id 以便在 UI 中識別和操作
        name: componentId, // name 用於 Meta JSON
        title: '照片選擇器',
        data: {
          label: '請選擇照片',
          // description 不包含空字符串，只在有值時才添加
          photo_source: 'camera_gallery',
          max_file_size_kb: 25600,
          min_uploaded_photos: 0,
          max_uploaded_photos: 30,
          enabled: true,
          visible: true
          // error-message 不包含空字符串，只在有值時才添加
        },
        action: {
          type: 'submit',
          payload: {}
        }
      };
    
    case 'document_picker':
      return {
        type: 'document_picker',
        id: componentId, // 添加 id 以便在 UI 中識別和操作
        name: componentId, // name 用於 Meta JSON
        title: '文檔選擇器',
        data: {
          label: '請選擇文檔',
          // description 不包含空字符串，只在有值時才添加
          max_file_size_kb: 25600,
          min_uploaded_documents: 0,
          max_uploaded_documents: 30,
          allowed_mime_types: ['application/pdf', 'image/jpeg', 'image/png'],
          enabled: true,
          visible: true
          // error-message 不包含空字符串，只在有值時才添加
        },
        action: {
          type: 'submit',
          payload: {}
        }
      };
    
    // 鏈接組件
    case 'embedded_link':
      return {
        type: 'embedded_link',
        text: '點擊這裡',
        action: {
          type: 'url',
          endpoint: 'https://example.com'
        }
      };
    
    case 'opt_in':
      return {
        type: 'opt_in',
        label: '我同意條款',
        name: 'terms_agreement',
        action: {
          type: 'url',
          endpoint: 'https://example.com/terms'
        }
      };
    
    // 邏輯組件
    case 'if':
      return {
        type: 'if',
        key: '${form.field_name}',
        components: []
      };
    
    case 'switch':
      return {
        type: 'switch',
        key: '${form.field_name}',
        cases: [
          {
            key: 'value1',
            components: []
          }
        ]
      };
    
    // 容器組件
    case 'navigation_list':
      return {
        type: 'navigation_list',
        id: componentId,
        title: '導航列表',
        data: {
          items: [
            { id: 'item_1', title: '項目 1', description: '描述 1' },
            { id: 'item_2', title: '項目 2', description: '描述 2' }
          ]
        },
        action: {
          type: 'navigate',
          next: ''
        }
      };
    
    case 'image_carousel':
      // 根據官方文檔：最少 1 張圖片，最多 3 張圖片
      // 參考：https://developers.facebook.com/docs/whatsapp/flows/reference/components#image_carousel
      return {
        type: 'image_carousel',
        id: componentId,
        title: '圖片輪播',
        data: {
          images: [
            { src: '', 'alt-text': '圖片 1' }
          ],
          'aspect-ratio': '4:3',
          'scale-type': 'contain'
        }
      };
    
    default:
      return {
        type: type,
        id: componentId,
        title: '組件'
      };
  }
};

/**
 * 清理 ID，只保留字母和下劃線
 */
const cleanId = (id) => {
  if (!id) return '';
  return String(id).replace(/[^a-zA-Z_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'component';
};

/**
 * 處理 next 值，轉換為官方格式 { name: string, type: "screen" }
 */
const processNextValue = (next) => {
  if (!next) return null;
  
  if (typeof next === 'string') {
    const cleanedName = cleanId(next) || 'screen';
    return { name: cleanedName, type: 'screen' };
  }
  
  if (typeof next === 'object' && next !== null) {
    const nextName = next.name || '';
    const cleanedName = cleanId(nextName) || 'screen';
    return { 
      name: cleanedName, 
      type: next.type || 'screen' 
    };
  }
  
  return null;
};

/**
 * 處理 on-click-action，根據 action 類型生成正確的格式
 */
const processOnClickAction = (action) => {
  if (!action || !action.action) {
    return { name: 'data_exchange', payload: {} };
  }
  
  const actionType = action.action.type;
  const payload = action.action.payload || {};
  
  switch (actionType) {
    case 'submit':
      return { name: 'data_exchange', payload };
    
    case 'navigate':
      const nextValue = processNextValue(action.action.next);
      if (nextValue && nextValue.name) {
        return {
          name: 'navigate',
          next: nextValue,
          payload
        };
      }
      return { name: 'data_exchange', payload };
    
    case 'url':
      return {
        name: 'open_url',
        url: action.action.endpoint || '',
        payload
      };
    
    default:
      return { name: 'data_exchange', payload };
  }
};

/**
 * 官方組件映射表
 * 根據 Meta 官方文檔定義的組件格式
 * 參考：https://developers.facebook.com/docs/whatsapp/flows/reference/components
 */
const OFFICIAL_COMPONENT_MAP = {
  // 文本組件
  'text_heading': {
    type: 'TextHeading',
    requiredFields: ['text'],
    optionalFields: []
  },
  'text_body': {
    type: 'TextBody',
    requiredFields: ['text'],
    optionalFields: []
  },
  'footer': {
    type: 'Footer',
    requiredFields: ['label', 'on-click-action'],
    optionalFields: []
  },
  
  // 輸入組件
  'text_input': {
    type: 'TextInput',
    requiredFields: ['name', 'label'],
    optionalFields: ['input-type', 'required', 'helper-text', 'pattern']
  },
  'rich_text': {
    type: 'RichText',
    requiredFields: ['text'],
    optionalFields: ['visible']
  },
  'date_picker': {
    type: 'DatePicker',
    requiredFields: ['name', 'label'],
    optionalFields: ['required', 'on-select-action', 'enabled', 'visible', 'description', 'error-message']
  },
  'calendar_picker': {
    type: 'CalendarPicker',
    requiredFields: ['name', 'label'],
    optionalFields: ['required', 'on-select-action', 'enabled', 'visible', 'description', 'error-message']
  },
  
  // 選擇組件
  'select': {
    type: 'Select',
    requiredFields: ['id', 'label', 'options'],
    optionalFields: ['on-click-action']
  },
  'checkbox': {
    type: 'CheckboxGroup',
    requiredFields: ['name', 'label', 'data-source'], // 使用 name 和 data-source 而不是 id 和 options
    optionalFields: ['required', 'on-select-action'] // 使用 on-select-action 而不是 on-click-action
  },
  'radio': {
    type: 'RadioButtonsGroup',
    requiredFields: ['name', 'label', 'data-source'], // 使用 name 和 data-source 而不是 id 和 options
    optionalFields: ['required', 'on-select-action'] // 使用 on-select-action 而不是 on-click-action
  },
  'chips_selector': {
    type: 'ChipsSelector',
    requiredFields: ['name', 'label', 'data-source'], // 使用 name 和 data-source（內聯數組）
    optionalFields: ['required', 'max-selected-items', 'description', 'on-select-action']
  },
  
  // 按鈕組件
  'button': {
    type: 'Button',
    requiredFields: ['id', 'label'],
    optionalFields: ['on-click-action']
  },
  
  // 媒體組件
  'image': {
    type: 'Image',
    requiredFields: ['src'], // 根據官方文檔，Image 使用 src 而不是 url，不支持 id、alt、on-click-action
    optionalFields: ['width', 'height']
  },
  'image_carousel': {
    type: 'ImageCarousel',
    requiredFields: ['images'], // 根據官方文檔，ImageCarousel 不需要 id
    optionalFields: ['aspect-ratio', 'scale-type']
  },
  'video': {
    type: 'Video',
    requiredFields: ['id', 'url'],
    optionalFields: ['thumbnail_url', 'on-click-action']
  },
  'document': {
    type: 'Document',
    requiredFields: ['id', 'url'],
    optionalFields: ['filename', 'on-click-action']
  },
  
  // 媒體上傳組件（從 Flow JSON version 4.0 開始支持）
  'photo_picker': {
    type: 'PhotoPicker',
    requiredFields: ['name', 'label'],
    optionalFields: ['description', 'photo-source', 'max-file-size-kb', 'min-uploaded-photos', 'max-uploaded-photos', 'enabled', 'visible', 'error-message']
  },
  'document_picker': {
    type: 'DocumentPicker',
    requiredFields: ['name', 'label'],
    optionalFields: ['description', 'max-file-size-kb', 'min-uploaded-documents', 'max-uploaded-documents', 'allowed-mime-types', 'enabled', 'visible', 'error-message']
  },
  
  // 鏈接組件
  'embedded_link': {
    type: 'EmbeddedLink',
    requiredFields: ['text', 'on-click-action'],
    optionalFields: []
  },
  'opt_in': {
    type: 'OptIn',
    requiredFields: ['label', 'name', 'on-click-action'],
    optionalFields: []
  },
  
  // 邏輯組件
  'if': {
    type: 'If',
    requiredFields: ['key', 'components'],
    optionalFields: []
  },
  'switch': {
    type: 'Switch',
    requiredFields: ['key', 'cases'],
    optionalFields: []
  },
  
  // 容器組件
  'navigation_list': {
    type: 'NavigationList',
    requiredFields: ['id', 'items'],
    optionalFields: []
  }
};

/**
 * 將編輯器中的 action 轉換為官方組件格式
 * 嚴格按照 Meta 官方文檔格式
 */
const convertActionToComponent = (action) => {
  if (!action || !action.type) return null;
  
  const componentDef = OFFICIAL_COMPONENT_MAP[action.type];
  if (!componentDef) {
    console.warn(`未知的組件類型: ${action.type}`);
    return null;
  }
  
  const cleanedId = cleanId(action.id);
  const cleanedName = cleanId(action.name || action.id);
  
  // 根據組件類型生成對應的 JSON
  switch (action.type) {
    // 文本組件
    case 'text_heading':
      return {
        type: 'TextHeading',
        text: action.text || ''
      };
    
    case 'text_body':
      return {
        type: 'TextBody',
        text: action.text || ''
      };
    
    // 輸入組件（在 Form 內部，使用 name 而不是 id，不使用 on-click-action）
    case 'text_input':
      const textInputName = cleanedName || cleanedId || `text_input_${Date.now()}`;
      const textInputComponent = {
        type: 'TextInput',
        name: textInputName,
        label: action.title || '文字輸入',
        required: action.data?.required || false
      };
      
      // input-type 屬性（注意是連字符，不是下劃線）
      if (action.data?.input_type) {
        textInputComponent['input-type'] = action.data.input_type;
      }
      
      // 可選屬性（注意：TextInput 不支持 placeholder）
      if (action.data?.pattern) {
        textInputComponent.pattern = action.data.pattern;
      }
      if (action.data?.helper_text) {
        textInputComponent['helper-text'] = action.data.helper_text;
      }
      
      return textInputComponent;
    
    case 'rich_text':
      // RichText 使用 text 數組，支持 Markdown 語法
      // 如果 action.data.text 是數組，直接使用；如果是字符串，轉換為數組
      let richTextArray = [];
      if (action.data?.text) {
        if (Array.isArray(action.data.text)) {
          richTextArray = action.data.text;
        } else {
          // 將字符串按換行符分割為數組
          richTextArray = action.data.text.split('\n').filter(line => line.trim() !== '');
        }
      } else {
        // 默認內容
        richTextArray = ['請輸入富文本內容'];
      }
      
      return {
        type: 'RichText',
        text: richTextArray
      };
    
    // 日期選擇組件
    case 'date_picker':
      // 根據官方文檔，DatePicker 使用 name 而不是 id，使用 on-select-action
      const datePickerName = cleanId(action.name || action.id || `date_picker_${Date.now()}`);
      
      // DatePicker 使用 on-select-action，需要處理 action.action
      let datePickerSelectAction = null;
      if (action.action) {
        if (action.action.type === 'submit' || action.action.type === 'navigate') {
          datePickerSelectAction = {
            name: action.action.type === 'submit' ? 'data_exchange' : 'navigate',
            payload: action.action.payload || {}
          };
          if (action.action.type === 'navigate' && action.action.next) {
            const nextValue = processNextValue(action.action.next);
            if (nextValue) {
              datePickerSelectAction.next = {
                name: nextValue,
                type: 'screen'
              };
            }
          }
        } else {
          // 如果 action.action.type 不是 submit 或 navigate，也使用 data_exchange
          // 因為 DatePicker 通常需要 data_exchange 來觸發服務器請求
          datePickerSelectAction = {
            name: 'data_exchange',
            payload: action.action.payload || {}
          };
        }
      } else {
        // 默認使用 data_exchange（根據官方文檔，DatePicker 使用 data_exchange 時需要 data_api_version）
        datePickerSelectAction = {
          name: 'data_exchange',
          payload: {}
        };
      }
      
      const datePickerComponent = {
        type: 'DatePicker',
        name: datePickerName,
        label: action.title || '日期選擇',
        required: action.data?.required || false
      };
      
      // 添加可選屬性
      if (action.data?.enabled !== undefined) {
        datePickerComponent.enabled = action.data.enabled;
      }
      if (action.data?.visible !== undefined) {
        datePickerComponent.visible = action.data.visible;
      }
      if (action.data?.description && action.data.description.trim() !== '') {
        datePickerComponent.description = action.data.description;
      }
      if (action.data?.error_message) {
        if (typeof action.data.error_message === 'object') {
          datePickerComponent['error-message'] = action.data.error_message;
        } else if (typeof action.data.error_message === 'string' && action.data.error_message.trim() !== '') {
          datePickerComponent['error-message'] = { text: action.data.error_message };
        }
      }
      
      datePickerComponent['on-select-action'] = datePickerSelectAction;
      
      return datePickerComponent;
    
    // 選擇組件
    case 'select':
      // 根據官方文檔，Dropdown 使用 data-source 而不是 options
      // Dropdown 使用 name 而不是 id，使用 on-select-action 而不是 on-click-action
      const dropdownName = cleanedName || cleanedId || `dropdown_${Date.now()}`;
      if (!dropdownName || dropdownName.trim() === '') {
        console.warn('Dropdown 組件 name 不能為空，已跳過');
        return null;
      }
      
      // Dropdown 的 on-select-action 應該使用 update_data 或 data_exchange
      // 根據錯誤信息，應該使用 update_data
      const dropdownAction = action.action?.type === 'submit' || action.action?.type === 'navigate'
        ? {
            name: 'update_data', // Dropdown 使用 update_data 而不是 data_exchange
            payload: action.action?.payload || {}
          }
        : {
            name: 'update_data',
            payload: {}
          };
      
      // 確保 name 不為空
      const finalDropdownName = dropdownName && dropdownName.trim() !== '' 
        ? dropdownName 
        : `dropdown_${Date.now()}`;
      
      // Dropdown 必須使用 data-source 來引用動態數據
      // 如果沒有提供 data-source，為每個組件生成唯一的 data-source 名稱
      let dataSource = action.data?.data_source || action.data?.dataSource;
      if (!dataSource || dataSource === '${data.options}') {
        // 為每個組件生成唯一的 data-source 名稱，基於組件的 name 或 id
        const uniqueDataSourceName = `dropdown_${finalDropdownName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        dataSource = `\${data.${uniqueDataSourceName}}`;
      }
      
      return {
        type: 'Dropdown',
        name: finalDropdownName,
        label: action.title || '下拉選擇',
        'data-source': dataSource, // Dropdown 必須使用 data-source，不能使用 options
        required: action.data?.required || false,
        'on-select-action': dropdownAction
      };
    
    case 'checkbox':
      // 根據官方文檔，CheckboxGroup 使用 name 和 data-source 而不是 id 和 options
      // CheckboxGroup 使用 on-select-action 而不是 on-click-action
      const checkboxName = cleanedName || cleanedId || `checkbox_${Date.now()}`;
      if (!checkboxName || checkboxName.trim() === '') {
        console.warn('CheckboxGroup 組件 name 不能為空，已跳過');
        return null;
      }
      
      // CheckboxGroup 的 on-select-action 應該使用 update_data 或 data_exchange
      const checkboxAction = action.action?.type === 'submit' || action.action?.type === 'navigate'
        ? {
            name: 'update_data', // CheckboxGroup 使用 update_data
            payload: action.action?.payload || {}
          }
        : {
            name: 'update_data',
            payload: {}
          };
      
      // 確保 name 不為空
      const finalCheckboxName = checkboxName && checkboxName.trim() !== '' 
        ? checkboxName 
        : `checkbox_${Date.now()}`;
      
      // CheckboxGroup 必須使用 data-source 來引用動態數據
      // 如果沒有提供 data-source，為每個組件生成唯一的 data-source 名稱
      let checkboxDataSource = action.data?.data_source || action.data?.dataSource;
      if (!checkboxDataSource || checkboxDataSource === '${data.options}') {
        // 為每個組件生成唯一的 data-source 名稱，基於組件的 name 或 id
        const uniqueDataSourceName = `checkbox_${finalCheckboxName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        checkboxDataSource = `\${data.${uniqueDataSourceName}}`;
      }
      
      return {
        type: 'CheckboxGroup',
        name: finalCheckboxName,
        label: action.title || '複選框組',
        'data-source': checkboxDataSource, // CheckboxGroup 必須使用 data-source，不能使用 options
        required: action.data?.required || false,
        'on-select-action': checkboxAction // 使用 on-select-action 而不是 on-click-action
      };
    
    case 'radio':
      // 根據官方文檔，RadioButtonsGroup 使用 name 和 data-source 而不是 id 和 options
      // RadioButtonsGroup 使用 on-select-action 而不是 on-click-action
      const radioName = cleanedName || cleanedId || `radio_${Date.now()}`;
      if (!radioName || radioName.trim() === '') {
        console.warn('RadioButtonsGroup 組件 name 不能為空，已跳過');
        return null;
      }
      
      // RadioButtonsGroup 的 on-select-action 應該使用 update_data 或 data_exchange
      const radioAction = action.action?.type === 'submit' || action.action?.type === 'navigate'
        ? {
            name: 'update_data', // RadioButtonsGroup 使用 update_data
            payload: action.action?.payload || {}
          }
        : {
            name: 'update_data',
            payload: {}
          };
      
      // 確保 name 不為空
      const finalRadioName = radioName && radioName.trim() !== '' 
        ? radioName 
        : `radio_${Date.now()}`;
      
      // RadioButtonsGroup 必須使用 data-source 來引用動態數據
      // 如果沒有提供 data-source，為每個組件生成唯一的 data-source 名稱
      let radioDataSource = action.data?.data_source || action.data?.dataSource;
      if (!radioDataSource || radioDataSource === '${data.options}') {
        // 為每個組件生成唯一的 data-source 名稱，基於組件的 name 或 id
        const uniqueDataSourceName = `radio_${finalRadioName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        radioDataSource = `\${data.${uniqueDataSourceName}}`;
      }
      
      return {
        type: 'RadioButtonsGroup',
        name: finalRadioName,
        label: action.title || '單選框組',
        'data-source': radioDataSource, // RadioButtonsGroup 必須使用 data-source，不能使用 options
        required: action.data?.required || false,
        'on-select-action': radioAction // 使用 on-select-action 而不是 on-click-action
      };
    
    // 按鈕組件
    // 注意：根據之前的 API 錯誤，Button 類型可能不支持，暫時移除
    case 'button':
      console.warn('Button 組件在當前 Meta API 版本中可能不支持，已跳過');
      return null;
    
    // 媒體組件
    case 'image':
      // 根據官方文檔，Image 組件使用 src 而不是 url，不支持 id、alt、on-click-action
      // src 應該是純 base64 字符串，不包含 data:image/xxx;base64, 前綴
      let imageSrc = action.data?.src || '';
      
      // 如果 src 是完整 data URL，提取純 base64 字符串
      if (imageSrc.startsWith('data:image/')) {
        imageSrc = imageSrc.includes(',') ? imageSrc.split(',')[1] : '';
      } else if (!imageSrc && action.data?.url) {
        // 如果 src 為空但 url 存在，嘗試從 url 提取
        const url = action.data.url;
        if (url.startsWith('data:image/')) {
          imageSrc = url.includes(',') ? url.split(',')[1] : '';
        } else {
          imageSrc = url; // 如果 url 不是 data URL，直接使用
        }
      }
      
      const imageComponent = {
        type: 'Image',
        src: imageSrc // 純 base64 字符串，符合官方文檔
      };
      
      // 添加可選的 width 和 height
      if (action.data?.width !== undefined && action.data?.width !== null) {
        imageComponent.width = action.data.width;
      }
      if (action.data?.height !== undefined && action.data?.height !== null) {
        imageComponent.height = action.data.height;
      }
      
      return imageComponent;
    
    // 注意：Video 和 Document 不在官方支持的組件列表中，暫時移除
    case 'video':
      console.warn('Video 組件不在官方支持的組件列表中，已跳過');
      return null;
    
    case 'document':
      console.warn('Document 組件不在官方支持的組件列表中，已跳過');
      return null;
    
    // 媒體上傳組件
    case 'photo_picker':
      const photoPickerComponent = {
        type: 'PhotoPicker',
        name: cleanedName,
        label: action.data?.label || action.title || '請選擇照片',
        'photo-source': action.data?.photo_source || 'camera_gallery',
        'max-file-size-kb': action.data?.max_file_size_kb || 25600,
        'min-uploaded-photos': action.data?.min_uploaded_photos ?? 0,
        'max-uploaded-photos': action.data?.max_uploaded_photos || 30,
        enabled: action.data?.enabled !== undefined ? action.data.enabled : true,
        visible: action.data?.visible !== undefined ? action.data.visible : true
      };
      
      // description: 如果提供且非空，才包含該屬性
      if (action.data?.description && action.data.description.trim() !== '') {
        photoPickerComponent.description = action.data.description;
      }
      
      // error-message: 如果提供且是對象格式，才包含該屬性
      if (action.data?.error_message) {
        if (typeof action.data.error_message === 'object') {
          photoPickerComponent['error-message'] = action.data.error_message;
        } else if (typeof action.data.error_message === 'string' && action.data.error_message.trim() !== '') {
          // 如果是字符串，轉換為對象格式
          photoPickerComponent['error-message'] = { text: action.data.error_message };
        }
      }
      
      return photoPickerComponent;
    
    case 'document_picker':
      const documentPickerComponent = {
        type: 'DocumentPicker',
        name: cleanedName,
        label: action.data?.label || action.title || '請選擇文檔',
        'max-file-size-kb': action.data?.max_file_size_kb || 25600,
        'min-uploaded-documents': action.data?.min_uploaded_documents ?? 0,
        'max-uploaded-documents': action.data?.max_uploaded_documents || 30,
        'allowed-mime-types': action.data?.allowed_mime_types || [
          'application/pdf',
          'image/jpeg',
          'image/png'
        ],
        enabled: action.data?.enabled !== undefined ? action.data.enabled : true,
        visible: action.data?.visible !== undefined ? action.data.visible : true
      };
      
      // description: 如果提供且非空，才包含該屬性
      if (action.data?.description && action.data.description.trim() !== '') {
        documentPickerComponent.description = action.data.description;
      }
      
      // error-message: 如果提供且是對象格式，才包含該屬性
      if (action.data?.error_message) {
        if (typeof action.data.error_message === 'object') {
          documentPickerComponent['error-message'] = action.data.error_message;
        } else if (typeof action.data.error_message === 'string' && action.data.error_message.trim() !== '') {
          // 如果是字符串，轉換為對象格式
          documentPickerComponent['error-message'] = { text: action.data.error_message };
        }
      }
      
      return documentPickerComponent;
    
    // 鏈接組件
    case 'embedded_link':
      const embeddedLinkAction = action.action?.type === 'url' 
        ? {
            name: 'open_url',
            url: action.action.endpoint || ''
          }
        : { name: 'open_url', url: '' };
      
      return {
        type: 'EmbeddedLink',
        text: action.text || '',
        'on-click-action': embeddedLinkAction
      };
    
    case 'opt_in':
      const optInAction = action.action?.type === 'url'
        ? {
            name: 'open_url',
            url: action.action.endpoint || ''
          }
        : { name: 'open_url', url: '' };
      
      return {
        type: 'OptIn',
        label: action.label || '',
        name: cleanedName || 'opt_in',
        'on-click-action': optInAction
      };
    
    // 邏輯組件
    case 'if':
      return {
        type: 'If',
        key: action.key || '${form.field_name}',
        components: (action.components || []).map(comp => convertActionToComponent(comp)).filter(Boolean)
      };
    
    case 'switch':
      return {
        type: 'Switch',
        key: action.key || '${form.field_name}',
        cases: (action.cases || []).map(caseItem => ({
          key: caseItem.key || '',
          components: (caseItem.components || []).map(comp => convertActionToComponent(comp)).filter(Boolean)
        }))
      };
    
    // 容器組件
    case 'navigation_list':
      const navListItems = (action.data?.items || []).map(item => ({
        id: item.id || '',
        title: item.title || '',
        description: item.description || '',
        'on-click-action': item['on-click-action'] || null
      }));
      
      return {
        type: 'NavigationList',
        id: cleanedId,
        items: navListItems
      };
    
    case 'chips_selector':
      // ChipsSelector 使用 data-source（內聯數組），不是 options
      // 根據官方文檔，data-source 是一個直接內聯的數組，不是 ${data.xxx} 格式
      const chipsOptions = (action.data?.options || []).map(opt => ({
        id: opt.id || opt.value || '',
        title: opt.title || opt.text || ''
      }));
      
      // ChipsSelector 使用 on-select-action，類似於 CheckboxGroup 和 RadioButtonsGroup
      let chipsSelectAction = null;
      if (action.action) {
        if (action.action.type === 'submit' || action.action.type === 'navigate') {
          chipsSelectAction = {
            name: action.action.type === 'submit' ? 'update_data' : 'navigate',
            payload: action.action.payload || {}
          };
          if (action.action.type === 'navigate' && action.action.next) {
            chipsSelectAction.next = processNextValue(action.action.next);
          }
        } else if (action.action.type === 'url') {
          chipsSelectAction = {
            name: 'open_url',
            url: action.action.endpoint || action.action.url || '',
            payload: action.action.payload || {}
          };
        }
      }
      
      const chipsSelectorComponent = {
        type: 'ChipsSelector',
        name: cleanId(action.name || action.id || `chips_selector_${Date.now()}`),
        label: action.title || '小標籤選擇器',
        'data-source': chipsOptions, // 直接使用內聯數組，不是 ${data.xxx} 格式
        required: action.data?.required || false
      };
      
      // 添加可選字段
      if (action.data?.max_selected_items !== undefined && action.data?.max_selected_items !== null) {
        chipsSelectorComponent['max-selected-items'] = action.data.max_selected_items;
      }
      if (action.data?.description) {
        chipsSelectorComponent.description = action.data.description;
      }
      
      // 添加 on-select-action（如果存在）
      if (chipsSelectAction) {
        chipsSelectorComponent['on-select-action'] = chipsSelectAction;
      }
      
      return chipsSelectorComponent;
    
    case 'image_carousel':
      // 根據官方文檔：ImageCarousel 不需要 id，只需要 images, aspect-ratio, scale-type
      // 參考：https://developers.facebook.com/docs/whatsapp/flows/reference/components#image_carousel
      const carouselImages = (action.data?.images || []).map(img => ({
        src: img.src || '',
        'alt-text': img['alt-text'] || img.alt || ''
      }));
      
      const imageCarouselComponent = {
        type: 'ImageCarousel',
        images: carouselImages
      };
      
      // 添加可選屬性
      if (action.data?.['aspect-ratio']) {
        imageCarouselComponent['aspect-ratio'] = action.data['aspect-ratio'];
      }
      if (action.data?.['scale-type']) {
        imageCarouselComponent['scale-type'] = action.data['scale-type'];
      }
      
      return imageCarouselComponent;
    
    case 'calendar_picker':
      // CalendarPicker 類似 DatePicker，使用 name 而不是 id，使用 on-select-action
      const calendarPickerName = cleanId(action.name || action.id || `calendar_picker_${Date.now()}`);
      
      let calendarSelectAction = null;
      if (action.action) {
        if (action.action.type === 'submit' || action.action.type === 'navigate') {
          calendarSelectAction = {
            name: action.action.type === 'submit' ? 'data_exchange' : 'navigate',
            payload: action.action.payload || {}
          };
          if (action.action.type === 'navigate' && action.action.next) {
            const nextValue = processNextValue(action.action.next);
            if (nextValue) {
              calendarSelectAction.next = {
                name: nextValue,
                type: 'screen'
              };
            }
          }
        } else {
          // 如果 action.action.type 不是 submit 或 navigate，也使用 data_exchange
          // 因為 CalendarPicker 通常需要 data_exchange 來觸發服務器請求
          calendarSelectAction = {
            name: 'data_exchange',
            payload: action.action.payload || {}
          };
        }
      } else {
        // 默認使用 data_exchange（根據官方文檔，CalendarPicker 使用 data_exchange 時需要 data_api_version）
        calendarSelectAction = {
          name: 'data_exchange',
          payload: {}
        };
      }
      
      const calendarPickerComponent = {
        type: 'CalendarPicker',
        name: calendarPickerName,
        label: action.title || '日曆選擇',
        required: action.data?.required || false
      };
      
      if (action.data?.enabled !== undefined) {
        calendarPickerComponent.enabled = action.data.enabled;
      }
      if (action.data?.visible !== undefined) {
        calendarPickerComponent.visible = action.data.visible;
      }
      if (action.data?.description && action.data.description.trim() !== '') {
        calendarPickerComponent.description = action.data.description;
      }
      if (action.data?.error_message) {
        if (typeof action.data.error_message === 'object') {
          calendarPickerComponent['error-message'] = action.data.error_message;
        } else if (typeof action.data.error_message === 'string' && action.data.error_message.trim() !== '') {
          calendarPickerComponent['error-message'] = { text: action.data.error_message };
        }
      }
      
      calendarPickerComponent['on-select-action'] = calendarSelectAction;
      
      return calendarPickerComponent;
    
    default:
      console.warn(`未實現的組件類型: ${action.type}`);
      return null;
  }
};

/**
 * 將編輯器數據轉換為 Meta Flow JSON
 * 嚴格按照官方文檔格式：https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson
 */
export const generateMetaFlowJson = (flowData) => {
  try {
    const { name, categories, screens } = flowData;
    
    if (!name) {
      throw new Error('Flow 必須包含 name');
    }
    
    const screensArray = screens || [];
    const categoriesArray = categories && categories.length > 0 ? categories : ['LEAD_GENERATION'];
    
    // 根據官方 Flow JSON 格式：https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson
    // 先檢查是否有任何屏幕使用 data_exchange action，如果有則需要在頂層添加 data_api_version
    let hasDataExchangeInAnyScreen = false;
    
    const metaFlowJson = {
      version: "7.3",
      // data_api_version 和 routing_model 會在後面根據需要添加
      screens: screensArray.map(screen => {
        const children = [];
        
        // 1. TextHeading (標題) - 從 screen.data.header
        if (screen.data?.header?.text) {
          children.push({
            type: 'TextHeading',
            text: screen.data.header.text
          });
        }
        
        // 2. TextBody (正文) - 必須有，從 screen.data.body
        children.push({
          type: 'TextBody',
          text: screen.data?.body?.text || ''
        });
        
        // 3. 處理所有 actions（組件庫中的組件）
        // 同時收集 Dropdown 和 CheckboxGroup 組件的選項，以便更新到 data 模型的 __example__ 中
        const dynamicOptionsMap = new Map(); // dataSourceName -> options array
        
        if (screen.data?.actions && screen.data.actions.length > 0) {
          screen.data.actions.forEach(action => {
            const component = convertActionToComponent(action);
            if (component) {
              // 調試日誌：檢查 DatePicker 和 CalendarPicker 的轉換結果
              if (action.type === 'date_picker' || action.type === 'calendar_picker') {
                console.log(`🔄 [generateMetaFlowJson] 轉換 ${action.type}:`, {
                  originalAction: action,
                  convertedComponent: component,
                  hasOnSelectAction: !!component['on-select-action'],
                  onSelectActionName: component['on-select-action']?.name
                });
              }
              children.push(component);
              
              // 如果是 Dropdown、CheckboxGroup 或 RadioButtonsGroup 組件，收集選項以便更新 __example__
              if (component.type === 'Dropdown' || component.type === 'CheckboxGroup' || component.type === 'RadioButtonsGroup') {
                const dataSource = component['data-source'] || '${data.options}';
                const dataSourceName = extractDataSourceName(dataSource);
                if (dataSourceName) {
                  // 優先使用 action.data.options（用戶在編輯器中編輯的選項）
                  if (action.data?.options && Array.isArray(action.data.options) && action.data.options.length > 0) {
                    // 將選項轉換為 __example__ 格式：{ id: string, title: string }
                    const exampleOptions = action.data.options.map(opt => ({
                      id: opt.id || opt.value || `option_${Date.now()}_${Math.random()}`,
                      title: opt.title || opt.text || opt.label || ''
                    }));
                    dynamicOptionsMap.set(dataSourceName, exampleOptions);
                  } else if (screen.data?.dataModel?.[dataSourceName]?.__example__ && 
                             Array.isArray(screen.data.dataModel[dataSourceName].__example__) &&
                             screen.data.dataModel[dataSourceName].__example__.length > 0) {
                    // 如果 action.data.options 不存在或為空，但 dataModel 中有 __example__，使用它
                    dynamicOptionsMap.set(dataSourceName, screen.data.dataModel[dataSourceName].__example__);
                  }
                }
              }
            } else {
              console.warn(`跳過不支持的組件類型: ${action.type}`);
            }
          });
        }
        
        // 4. Footer - 必須有，從 screen.data.footer
        // Footer 是必填項，如果為空則使用默認值
        const footerText = screen.data?.footer?.text || '提交';
        children.push({
          type: 'Footer',
          label: footerText,
          'on-click-action': {
            name: 'complete',
            payload: {}
          }
        });
        
        // 構建 screen 對象
        const screenId = cleanId(screen.id) || 'screen';
        
        // 檢查是否有任何組件使用 data_exchange action
        // 根據官方文檔：當使用 data_exchange action 時，必須在屏幕級別添加 data_api_version
        const hasDataExchange = children.some(child => {
          // 檢查 on-click-action 或 on-select-action 是否為 data_exchange
          const onClickAction = child['on-click-action'];
          const onSelectAction = child['on-select-action'];
          const isDataExchange = (onClickAction && onClickAction.name === 'data_exchange') ||
                                 (onSelectAction && onSelectAction.name === 'data_exchange');
          
          // 調試日誌：檢查 DatePicker 和 CalendarPicker
          if (child.type === 'DatePicker' || child.type === 'CalendarPicker') {
            console.log(`🔍 [generateMetaFlowJson] 檢查 ${child.type}:`, {
              type: child.type,
              hasOnClickAction: !!onClickAction,
              onClickActionName: onClickAction?.name,
              hasOnSelectAction: !!onSelectAction,
              onSelectActionName: onSelectAction?.name,
              isDataExchange: isDataExchange,
              fullChild: JSON.stringify(child, null, 2)
            });
          }
          
          return isDataExchange;
        });
        
        console.log(`📊 [generateMetaFlowJson] 檢測結果:`, {
          hasDataExchange: hasDataExchange,
          childrenCount: children.length,
          childrenTypes: children.map(c => c.type)
        });
        
        // 使用規範配置檢查是否需要 terminal screen
        const componentsRequiringTerminal = getComponentsRequiringTerminal();
        const hasTerminalComponent = children.some(child => {
          const spec = getComponentSpec(child.type);
          return spec && spec.requiresTerminal;
        });
        
        // 檢查是否有 Footer 使用 complete action，如果有則需要設置 terminal: true
        const hasCompleteFooter = children.some(child => 
          child.type === 'Footer' && 
          child['on-click-action'] && 
          child['on-click-action'].name === 'complete'
        );
        
        // 使用規範配置檢查是否需要動態數據
        const needsDataModel = children.some(child => {
          const spec = getComponentSpec(child.type);
          if (spec && spec.requiresDataModel && child['data-source']) {
            return true;
          }
          return false;
        });
        
        // 先構建基本 screen 對象（不包含 data，因為 data 需要在 layout 之後）
        // 重要：字段順序必須與 Meta API 要求一致：id, title, layout, terminal, data_api_version, data
        const screenObj = {
          id: screenId,
          title: screen.title || '',
          layout: {
            type: 'SingleColumnLayout',
            children: children
          }
        };
        
        // 如果有 data_exchange action，標記需要在頂層添加 data_api_version
        // 根據官方文檔：https://developers.facebook.com/docs/whatsapp/flows/reference/components#dp
        // 注意：data_api_version 應該在 Flow JSON 的頂層，而不是屏幕級別
        if (hasDataExchange) {
          hasDataExchangeInAnyScreen = true;
          console.log(`✅ [generateMetaFlowJson] 檢測到 data_exchange action 在屏幕 ${screenId}，將在頂層添加 data_api_version`);
        }
        
        // 如果有 complete action 的 Footer 或其他需要 terminal 的組件，設置 terminal: true
        // 注意：根據用戶測試，success 字段不是必需的，所以移除它
        if (hasCompleteFooter || hasTerminalComponent) {
          screenObj.terminal = true;
        }
        
        // 如果需要動態數據，添加 data 模型定義
        // 注意：screen.data 只應包含數據模型定義（如 dropdown_select、checkbox_checkbox 等），
        // 不應包含 body、footer、header、actions 等編輯器內部字段
        // 重要：data 字段必須在 layout 和 terminal 之後，以匹配 Meta API 的格式要求
        if (needsDataModel || screen.data?.dataModel) {
          // 從 dataModel 中過濾掉編輯器內部字段，只保留數據模型定義
          const dataModel = screen.data?.dataModel || {};
          const filteredDataModel = {};
          
          // 只保留數據模型定義（不包含 body、footer、header、actions）
          Object.keys(dataModel).forEach(key => {
            if (key !== 'body' && key !== 'footer' && key !== 'header' && key !== 'actions') {
              filteredDataModel[key] = dataModel[key];
            }
          });
          
          // 在 layout 和 terminal 之後添加 data 字段
          screenObj.data = filteredDataModel;
          
          // 使用規範配置為所有需要數據模型的組件添加數據定義
          children.forEach(child => {
            const spec = getComponentSpec(child.type);
            if (spec && spec.requiresDataModel && child['data-source']) {
              const dataSourceName = extractDataSourceName(child['data-source']);
              if (dataSourceName) {
                // 如果已經存在數據模型，使用現有的；否則創建新的
                if (!screenObj.data[dataSourceName]) {
                  // 使用規範配置中的數據模型模板
                  const dataModel = generateDataModel(dataSourceName, child.type);
                  if (dataModel) {
                    screenObj.data[dataSourceName] = dataModel;
                  }
                }
                
                // 如果有編輯的選項，更新 __example__
                // 如果沒有編輯的選項，但已存在 __example__，保留它
                if (dynamicOptionsMap.has(dataSourceName)) {
                  // 用戶在編輯器中編輯了選項，使用新的選項
                  const exampleOptions = dynamicOptionsMap.get(dataSourceName);
                  if (screenObj.data[dataSourceName]) {
                    screenObj.data[dataSourceName].__example__ = exampleOptions;
                  } else {
                    // 如果數據模型不存在，創建一個
                    screenObj.data[dataSourceName] = {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' }
                        }
                      },
                      __example__: exampleOptions
                    };
                  }
                } else {
                  // 如果沒有編輯的選項，保留已存在的 __example__
                  // 如果數據模型中沒有 __example__，確保至少有一個空數組（避免 Meta API 驗證錯誤）
                  if (screenObj.data[dataSourceName] && !screenObj.data[dataSourceName].__example__) {
                    screenObj.data[dataSourceName].__example__ = [];
                  }
                  // 如果 screenObj.data[dataSourceName].__example__ 已存在（即使是空數組），則保留它（不需要做任何操作）
                }
              }
            }
          });
        }
        
        return screenObj;
      })
    };
    
    // 如果有任何屏幕使用 data_exchange action，在頂層添加 data_api_version 和 routing_model
    // 根據官方文檔和例子：字段順序應該是 version, data_api_version, routing_model, screens
    // 參考：https://developers.facebook.com/docs/whatsapp/flows/reference/components#dp
    if (hasDataExchangeInAnyScreen) {
      // 重新構建 metaFlowJson，確保字段順序正確：version, data_api_version, routing_model, screens
      const orderedMetaFlowJson = {
        version: metaFlowJson.version,
        data_api_version: "3.0",
        routing_model: {},
        screens: metaFlowJson.screens
      };
      console.log(`✅ [generateMetaFlowJson] 已在頂層添加 data_api_version: "3.0" 和 routing_model: {}`);
      return orderedMetaFlowJson;
    }
    
    return metaFlowJson;
  } catch (error) {
    console.error('生成 Meta Flow JSON 失敗:', error);
    throw error;
  }
};

/**
 * 將 Meta API 返回的 layout 格式轉換為編輯器使用的 data 格式
 */
const convertLayoutToDataFormat = (screen) => {
  const data = {
    body: { type: 'body', text: '' },
    footer: { type: 'footer', text: '提交' }, // Footer 是必填項，設置默認值
    header: { type: 'header', format: 'TEXT', text: '' }, // header 不能為 null，必須是對象
    actions: []
  };

  if (screen.layout && screen.layout.children) {
    screen.layout.children.forEach(child => {
      switch (child.type) {
        case 'TextHeading':
          // header 必須是對象，不能為 null
          data.header = {
            type: 'header',
            format: 'TEXT',
            text: child.text || ''
          };
          break;
        
        case 'TextBody':
          if (child.text) {
            data.body.text = child.text;
          }
          break;
        
        case 'RichText':
        case 'rich_text':
          // RichText 使用 text 數組，支持 Markdown 語法
          if (child.text) {
            const textArray = Array.isArray(child.text) ? child.text : [child.text];
            data.actions.push({
              type: 'rich_text',
              id: child.id || `rich_text_${Date.now()}`,
              title: '富文本顯示',
              data: {
                text: textArray
              }
            });
          }
          break;
        
        case 'Footer':
          // Footer 是必填項，如果沒有 label 則使用默認值
          data.footer.text = child.label || '提交';
          if (child['on-click-action']) {
            data.footer.action = {
              type: child['on-click-action'].name === 'complete' ? 'submit' : 'navigate',
              payload: child['on-click-action'].payload || {},
              next: child['on-click-action'].next?.name || ''
            };
          }
          break;
        
        case 'Button':
        case 'button':
          data.actions.push({
            type: 'button',
            id: child.id || `button_${Date.now()}`,
            title: child.label || child.text || '按鈕',
            action: child['on-click-action'] ? {
              type: child['on-click-action'].name === 'complete' || child['on-click-action'].name === 'data_exchange' ? 'submit' : 
                    (child['on-click-action'].name === 'navigate' ? 'navigate' : 'url'),
              next: child['on-click-action'].next?.name || '',
              payload: child['on-click-action'].payload || {},
              method: 'GET',
              endpoint: child['on-click-action'].url || ''
            } : {
              type: 'navigate',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            },
            data: null
          });
          break;
        
        case 'Input':
        case 'TextInput':
        case 'text_input':
          // TextInput 在 Form 內部，使用 name 而不是 id，不使用 on-click-action
          data.actions.push({
            type: 'text_input',
            name: child.name || child.id || `text_input_${Date.now()}`,
            title: child.label || '文字輸入',
            data: {
              input_type: child['input-type'] || child.input_type || 'text',
              // 注意：TextInput 不支持 placeholder
              required: child.required || false,
              pattern: child.pattern || '',
              helper_text: child['helper-text'] || child.helper_text || ''
            },
            action: {
              type: 'submit',
              payload: {}
            }
          });
          break;
        
        case 'Dropdown':
        case 'Select':
        case 'select':
          // Dropdown 使用 name 而不是 id，使用 on-select-action 而不是 on-click-action
          // 從 screen.data 的 __example__ 中讀取選項
          const dataSource = child['data-source'] || '${data.options}';
          const dataSourceName = extractDataSourceName(dataSource);
          let dropdownOptions = [];
          
          // 如果 screen.data 中有對應的數據模型，從 __example__ 中讀取選項
          if (dataSourceName && screen.data && screen.data[dataSourceName] && screen.data[dataSourceName].__example__) {
            dropdownOptions = screen.data[dataSourceName].__example__.map(example => ({
              id: example.id || '',
              title: example.title || ''
            }));
          }
          
          data.actions.push({
            type: 'select',
            name: child.name || child.id || `select_${Date.now()}`,
            title: child.label || '下拉選擇',
            action: child['on-select-action'] || child['on-click-action'] ? {
              type: (child['on-select-action'] || child['on-click-action']).name === 'complete' || (child['on-select-action'] || child['on-click-action']).name === 'data_exchange' ? 'submit' : 
                    ((child['on-select-action'] || child['on-click-action']).name === 'navigate' ? 'navigate' : 'url'),
              next: (child['on-select-action'] || child['on-click-action']).next?.name || '',
              payload: (child['on-select-action'] || child['on-click-action']).payload || {},
              method: 'GET',
              endpoint: (child['on-select-action'] || child['on-click-action']).url || ''
            } : {
              type: 'navigate',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            },
            data: {
              data_source: dataSource,
              required: child.required || false,
              options: dropdownOptions // 添加選項，以便在編輯器中顯示
            }
          });
          break;

        case 'DatePicker':
        case 'date_picker':
          // DatePicker 使用 name 而不是 id，使用 on-select-action 而不是 on-click-action
          const datePickerData = {
            required: child.required || false
          };
          
          // 添加可選屬性
          if (child.enabled !== undefined) {
            datePickerData.enabled = child.enabled;
          }
          if (child.visible !== undefined) {
            datePickerData.visible = child.visible;
          }
          if (child.description && child.description.trim() !== '') {
            datePickerData.description = child.description;
          }
          if (child['error-message']) {
            if (typeof child['error-message'] === 'object') {
              datePickerData.error_message = child['error-message'];
            } else if (typeof child['error-message'] === 'string' && child['error-message'].trim() !== '') {
              datePickerData.error_message = { text: child['error-message'] };
            }
          }
          
          data.actions.push({
            type: 'date_picker',
            name: child.name || `date_picker_${Date.now()}`,
            title: child.label || '日期選擇',
            action: child['on-select-action'] ? {
              type: child['on-select-action'].name === 'complete' || child['on-select-action'].name === 'data_exchange' ? 'submit' : 
                    (child['on-select-action'].name === 'navigate' ? 'navigate' : 'url'),
              next: child['on-select-action'].next?.name || '',
              payload: child['on-select-action'].payload || {},
              method: 'GET',
              endpoint: child['on-select-action'].url || ''
            } : {
              type: 'submit',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            },
            data: datePickerData
          });
          break;

        // TextArea 已移除，改用 RichText（只讀顯示）
        // RichText 的處理已在上面添加

        case 'CheckboxGroup':
        case 'checkbox':
          // CheckboxGroup 使用 name 和 data-source 而不是 id 和 options
          // 從 screen.data 的 __example__ 中讀取選項
          const checkboxDataSource = child['data-source'] || '${data.options}';
          const checkboxDataSourceName = extractDataSourceName(checkboxDataSource);
          let checkboxOptions = [];
          
          // 如果 screen.data 中有對應的數據模型，從 __example__ 中讀取選項
          if (checkboxDataSourceName && screen.data && screen.data[checkboxDataSourceName] && screen.data[checkboxDataSourceName].__example__) {
            checkboxOptions = screen.data[checkboxDataSourceName].__example__.map(example => ({
              id: example.id || '',
              title: example.title || ''
            }));
          }
          
          data.actions.push({
            type: 'checkbox',
            name: child.name || child.id || `checkbox_${Date.now()}`,
            title: child.label || '複選框組',
            action: child['on-select-action'] || child['on-click-action'] ? {
              type: (child['on-select-action'] || child['on-click-action']).name === 'complete' || (child['on-select-action'] || child['on-click-action']).name === 'data_exchange' ? 'submit' : 
                    ((child['on-select-action'] || child['on-click-action']).name === 'navigate' ? 'navigate' : 'url'),
              next: (child['on-select-action'] || child['on-click-action']).next?.name || '',
              payload: (child['on-select-action'] || child['on-click-action']).payload || {},
              method: 'GET',
              endpoint: (child['on-select-action'] || child['on-click-action']).url || ''
            } : {
              type: 'navigate',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            },
            data: {
              data_source: checkboxDataSource,
              required: child.required || false,
              options: checkboxOptions // 添加選項，以便在編輯器中顯示
            }
          });
          break;

        case 'RadioButtonsGroup':
        case 'radio':
          // RadioButtonsGroup 使用 name 和 data-source 而不是 id 和 options
          // 從 screen.data 的 __example__ 中讀取選項
          const radioDataSource = child['data-source'] || '${data.options}';
          const radioDataSourceName = extractDataSourceName(radioDataSource);
          let radioOptions = [];
          
          // 如果 screen.data 中有對應的數據模型，從 __example__ 中讀取選項
          if (radioDataSourceName && screen.data && screen.data[radioDataSourceName] && screen.data[radioDataSourceName].__example__) {
            radioOptions = screen.data[radioDataSourceName].__example__.map(example => ({
              id: example.id || '',
              title: example.title || ''
            }));
          }
          
          data.actions.push({
            type: 'radio',
            name: child.name || child.id || `radio_${Date.now()}`,
            title: child.label || '單選框組',
            action: child['on-select-action'] || child['on-click-action'] ? {
              type: (child['on-select-action'] || child['on-click-action']).name === 'complete' || (child['on-select-action'] || child['on-click-action']).name === 'data_exchange' ? 'submit' : 
                    ((child['on-select-action'] || child['on-click-action']).name === 'navigate' ? 'navigate' : 'url'),
              next: (child['on-select-action'] || child['on-click-action']).next?.name || '',
              payload: (child['on-select-action'] || child['on-click-action']).payload || {},
              method: 'GET',
              endpoint: (child['on-select-action'] || child['on-click-action']).url || ''
            } : {
              type: 'navigate',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            },
            data: {
              data_source: radioDataSource,
              required: child.required || false,
              options: radioOptions // 添加選項，以便在編輯器中顯示
            }
          });
          break;

        case 'Image':
        case 'image':
          // 根據官方文檔，Image 組件使用 src 而不是 url，不支持 id、alt、on-click-action
          // src 應該是純 base64 字符串，不包含 data:image/xxx;base64, 前綴
          const imageSrcFromJson = child.src || child.url || '';
          // 如果 src 是純 base64（不包含 data: 前綴），構建完整 data URL 用於預覽
          const imageUrlForPreview = imageSrcFromJson.startsWith('data:image/') 
            ? imageSrcFromJson 
            : (imageSrcFromJson ? `data:image/png;base64,${imageSrcFromJson}` : '');
          
          data.actions.push({
            type: 'image',
            id: `image_${Date.now()}`, // 內部使用 id 用於 UI 識別
            title: '圖片',
            data: {
              url: imageUrlForPreview, // 完整 data URL 用於編輯器預覽
              src: imageSrcFromJson, // 純 base64 字符串（符合官方文檔）
              width: child.width,
              height: child.height
            },
            action: {
              type: 'navigate',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            }
          });
          break;

        case 'Video':
        case 'video':
          data.actions.push({
            type: 'video',
            id: child.id || `video_${Date.now()}`,
            title: '視頻',
            action: child['on-click-action'] ? {
              type: child['on-click-action'].name === 'complete' || child['on-click-action'].name === 'data_exchange' ? 'submit' : 
                    (child['on-click-action'].name === 'navigate' ? 'navigate' : 'url'),
              next: child['on-click-action'].next?.name || '',
              payload: child['on-click-action'].payload || {},
              method: 'GET',
              endpoint: child['on-click-action'].url || ''
            } : {
              type: 'navigate',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            },
            data: {
              url: child.url || '',
              thumbnail_url: child.thumbnail_url || ''
            }
          });
          break;

        case 'Document':
        case 'document':
          data.actions.push({
            type: 'document',
            id: child.id || `document_${Date.now()}`,
            title: child.filename || '文檔',
            action: child['on-click-action'] ? {
              type: child['on-click-action'].name === 'complete' || child['on-click-action'].name === 'data_exchange' ? 'submit' : 
                    (child['on-click-action'].name === 'navigate' ? 'navigate' : 'url'),
              next: child['on-click-action'].next?.name || '',
              payload: child['on-click-action'].payload || {},
              method: 'GET',
              endpoint: child['on-click-action'].url || ''
            } : {
              type: 'navigate',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            },
            data: {
              url: child.url || '',
              filename: child.filename || 'document.pdf'
            }
          });
          break;

        case 'PhotoPicker':
        case 'photo_picker':
          const photoPickerData = {
            label: child.label || '請選擇照片',
            photo_source: child['photo-source'] || 'camera_gallery',
            max_file_size_kb: child['max-file-size-kb'] || 25600,
            min_uploaded_photos: child['min-uploaded-photos'] ?? 0,
            max_uploaded_photos: child['max-uploaded-photos'] || 30,
            enabled: child.enabled !== undefined ? child.enabled : true,
            visible: child.visible !== undefined ? child.visible : true
          };
          
          // description: 只在有值時才包含
          if (child.description && child.description.trim() !== '') {
            photoPickerData.description = child.description;
          }
          
          // error-message: 如果是對象，轉換為內部格式；如果是字符串且非空，轉換為對象
          if (child['error-message']) {
            if (typeof child['error-message'] === 'object') {
              photoPickerData.error_message = child['error-message'];
            } else if (typeof child['error-message'] === 'string' && child['error-message'].trim() !== '') {
              photoPickerData.error_message = { text: child['error-message'] };
            }
          }
          
          data.actions.push({
            type: 'photo_picker',
            name: child.name || `photo_picker_${Date.now()}`,
            title: child.label || '照片選擇器',
            action: {
              type: 'submit',
              payload: {}
            },
            data: photoPickerData
          });
          break;

        case 'DocumentPicker':
        case 'document_picker':
          const documentPickerData = {
            label: child.label || '請選擇文檔',
            max_file_size_kb: child['max-file-size-kb'] || 25600,
            min_uploaded_documents: child['min-uploaded-documents'] ?? 0,
            max_uploaded_documents: child['max-uploaded-documents'] || 30,
            allowed_mime_types: child['allowed-mime-types'] || ['application/pdf', 'image/jpeg', 'image/png'],
            enabled: child.enabled !== undefined ? child.enabled : true,
            visible: child.visible !== undefined ? child.visible : true
          };
          
          // description: 只在有值時才包含
          if (child.description && child.description.trim() !== '') {
            documentPickerData.description = child.description;
          }
          
          // error-message: 如果是對象，轉換為內部格式；如果是字符串且非空，轉換為對象
          if (child['error-message']) {
            if (typeof child['error-message'] === 'object') {
              documentPickerData.error_message = child['error-message'];
            } else if (typeof child['error-message'] === 'string' && child['error-message'].trim() !== '') {
              documentPickerData.error_message = { text: child['error-message'] };
            }
          }
          
          data.actions.push({
            type: 'document_picker',
            name: child.name || `document_picker_${Date.now()}`,
            title: child.label || '文檔選擇器',
            action: {
              type: 'submit',
              payload: {}
            },
            data: documentPickerData
          });
          break;

        case 'EmbeddedLink':
        case 'embedded_link':
          data.actions.push({
            type: 'embedded_link',
            text: child.text || '',
            action: child['on-click-action'] ? {
              type: 'url',
              endpoint: child['on-click-action'].url || '',
              payload: child['on-click-action'].payload || {},
              method: 'GET'
            } : {
              type: 'url',
              endpoint: '',
              payload: {},
              method: 'GET'
            },
            data: null
          });
          break;

        case 'OptIn':
        case 'opt_in':
          data.actions.push({
            type: 'opt_in',
            label: child.label || '',
            name: child.name || 'opt_in',
            action: child['on-click-action'] ? {
              type: 'url',
              endpoint: child['on-click-action'].url || '',
              payload: child['on-click-action'].payload || {},
              method: 'GET'
            } : {
              type: 'url',
              endpoint: '',
              payload: {},
              method: 'GET'
            },
            data: null
          });
          break;

        case 'If':
        case 'if':
          data.actions.push({
            type: 'if',
            key: child.key || '${form.field_name}',
            components: (child.components || []).map(comp => {
              const tempScreen = { layout: { children: [comp] } };
              const converted = convertLayoutToDataFormat(tempScreen);
              return converted.actions[0] || null;
            }).filter(Boolean)
          });
          break;

        case 'Switch':
        case 'switch':
          data.actions.push({
            type: 'switch',
            key: child.key || '${form.field_name}',
            cases: (child.cases || []).map(caseItem => ({
              key: caseItem.key || '',
              components: (caseItem.components || []).map(comp => {
                const tempScreen = { layout: { children: [comp] } };
                const converted = convertLayoutToDataFormat(tempScreen);
                return converted.actions[0] || null;
              }).filter(Boolean)
            }))
          });
          break;

        case 'CalendarPicker':
        case 'calendar_picker':
          const calendarPickerData = {
            required: child.required || false
          };
          
          if (child.enabled !== undefined) {
            calendarPickerData.enabled = child.enabled;
          }
          if (child.visible !== undefined) {
            calendarPickerData.visible = child.visible;
          }
          if (child.description && child.description.trim() !== '') {
            calendarPickerData.description = child.description;
          }
          if (child['error-message']) {
            if (typeof child['error-message'] === 'object') {
              calendarPickerData.error_message = child['error-message'];
            } else if (typeof child['error-message'] === 'string' && child['error-message'].trim() !== '') {
              calendarPickerData.error_message = { text: child['error-message'] };
            }
          }
          
          data.actions.push({
            type: 'calendar_picker',
            name: child.name || `calendar_picker_${Date.now()}`,
            title: child.label || '日曆選擇',
            action: child['on-select-action'] ? {
              type: child['on-select-action'].name === 'complete' || child['on-select-action'].name === 'data_exchange' ? 'submit' : 
                    (child['on-select-action'].name === 'navigate' ? 'navigate' : 'url'),
              next: child['on-select-action'].next?.name || '',
              payload: child['on-select-action'].payload || {},
              method: 'GET',
              endpoint: child['on-select-action'].url || ''
            } : {
              type: 'submit',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            },
            data: calendarPickerData
          });
          break;

        case 'NavigationList':
        case 'navigation_list':
          data.actions.push({
            type: 'navigation_list',
            id: child.id || `navigation_list_${Date.now()}`,
            title: '導航列表',
            data: {
              items: (child.items || []).map(item => ({
                id: item.id || '',
                title: item.title || '',
                description: item.description || '',
                'on-click-action': item['on-click-action'] || null
              }))
            },
            action: {
              type: 'navigate',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            }
          });
          break;

        case 'ChipsSelector':
        case 'chips_selector':
          // ChipsSelector 使用 data-source（內聯數組），不是 options
          const chipsDataSource = child['data-source'] || child.options || [];
          const chipsOptions = Array.isArray(chipsDataSource) 
            ? chipsDataSource.map(opt => ({
                id: opt.id || '',
                title: opt.title || ''
              }))
            : [];
          
          data.actions.push({
            type: 'chips_selector',
            id: child.id || child.name || `chips_selector_${Date.now()}`,
            name: child.name || child.id || `chips_selector_${Date.now()}`,
            title: child.label || '小標籤選擇器',
            data: {
              options: chipsOptions,
              required: child.required || false,
              max_selected_items: child['max-selected-items'] || child['max_selected_items'],
              description: child.description || ''
            },
            action: child['on-select-action'] || child['on-click-action'] ? {
              type: (child['on-select-action'] || child['on-click-action']).name === 'complete' || 
                    (child['on-select-action'] || child['on-click-action']).name === 'data_exchange' ? 'submit' : 
                    ((child['on-select-action'] || child['on-click-action']).name === 'navigate' ? 'navigate' : 'url'),
              next: (child['on-select-action'] || child['on-click-action']).next?.name || '',
              payload: (child['on-select-action'] || child['on-click-action']).payload || {},
              method: 'GET',
              endpoint: (child['on-select-action'] || child['on-click-action']).url || ''
            } : {
              type: 'submit',
              next: '',
              payload: {},
              method: 'GET',
              endpoint: ''
            }
          });
          break;

        case 'ImageCarousel':
        case 'image_carousel':
          // 根據官方文檔：ImageCarousel 不需要 id 和 action
          // 參考：https://developers.facebook.com/docs/whatsapp/flows/reference/components#image_carousel
          data.actions.push({
            type: 'image_carousel',
            id: `image_carousel_${Date.now()}`, // 內部使用 id 用於 UI 識別
            title: '圖片輪播',
            data: {
              images: (child.images || []).map(img => {
                const imgSrc = img.src || '';
                // 如果 src 是純 base64，構建完整 data URL 用於編輯器預覽
                const fullDataUrl = imgSrc.startsWith('data:image/') ? imgSrc : `data:image/png;base64,${imgSrc}`;
                return {
                  src: imgSrc, // 保存純 base64
                  url: fullDataUrl, // 保存完整 data URL 用於預覽
                  'alt-text': img['alt-text'] || img.alt || ''
                };
              }),
              'aspect-ratio': child['aspect-ratio'] || '4:3',
              'scale-type': child['scale-type'] || 'contain'
            }
          });
          break;
      }
    });
  }

  // 將 screen.data 中的數據模型保存到 data.dataModel 中，以便在生成 JSON 時使用
  const result = {
    id: screen.id || `screen_${Date.now()}`,
    title: screen.title || '',
    data: data
  };
  
  // 如果 screen.data 存在，保存數據模型定義
  // 注意：Meta API 返回的 screen.data 可能包含 body、footer、header、actions 等字段（可能為 null），
  // 這些字段不應該保存到 dataModel 中，只保留數據模型定義（如 dropdown_select、checkbox_checkbox 等）
  if (screen.data) {
    const filteredDataModel = {};
    
    // 只保留數據模型定義（不包含 body、footer、header、actions）
    Object.keys(screen.data).forEach(key => {
      if (key !== 'body' && key !== 'footer' && key !== 'header' && key !== 'actions') {
        filteredDataModel[key] = screen.data[key];
      }
    });
    
    // 只有當過濾後的數據模型不為空時，才保存
    if (Object.keys(filteredDataModel).length > 0) {
      result.data.dataModel = filteredDataModel;
    }
  }
  
  return result;
};

/**
 * 將 Meta Flow JSON 解析為編輯器數據
 */
export const parseMetaFlowJson = (json) => {
  try {
    let flowData;
    if (typeof json === 'string') {
      flowData = JSON.parse(json);
    } else {
      flowData = json;
    }
    
    if (!flowData || typeof flowData !== 'object') {
      throw new Error('無效的 JSON 格式');
    }
    
    const editorData = {
      name: flowData.name || '',
      categories: flowData.categories || ['LEAD_GENERATION'],
      screens: (flowData.screens || []).map(screen => convertLayoutToDataFormat(screen))
    };
    
    return editorData;
  } catch (error) {
    console.error('解析 Meta Flow JSON 失敗:', error);
    throw error;
  }
};

/**
 * 驗證 Meta Flow JSON 格式
 * 返回 { valid: boolean, errors: string[] }
 */
export const validateMetaFlowJson = (json) => {
  const errors = [];
  
  try {
    let flowData;
    if (typeof json === 'string') {
      try {
        flowData = JSON.parse(json);
      } catch (parseError) {
        errors.push(`JSON 解析失敗: ${parseError.message}`);
        return { valid: false, errors };
      }
    } else {
      flowData = json;
    }
    
    if (!flowData || typeof flowData !== 'object') {
      errors.push('無效的 JSON 格式：必須是對象');
      return { valid: false, errors };
    }
    
    // 檢查 version
    if (!flowData.version) {
      errors.push('缺少必需字段: version');
    } else if (typeof flowData.version !== 'string') {
      errors.push('version 必須是字符串');
    }
    
    // 檢查 screens
    if (!flowData.screens) {
      errors.push('缺少必需字段: screens');
    } else if (!Array.isArray(flowData.screens)) {
      errors.push('screens 必須是數組');
    } else if (flowData.screens.length === 0) {
      errors.push('screens 數組不能為空');
    } else {
      // 驗證每個 screen
      flowData.screens.forEach((screen, index) => {
        if (!screen.id) {
          errors.push(`Screen[${index}]: 缺少 id 字段`);
        } else if (typeof screen.id !== 'string') {
          errors.push(`Screen[${index}]: id 必須是字符串`);
        } else {
          // 驗證 id 格式（只能包含字母和下劃線）
          if (!/^[a-zA-Z_]+$/.test(screen.id)) {
            errors.push(`Screen[${index}]: id "${screen.id}" 只能包含字母和下劃線`);
          }
        }
        
        if (!screen.layout) {
          errors.push(`Screen[${index}]: 缺少 layout 字段`);
        } else {
          if (screen.layout.type !== 'SingleColumnLayout') {
            errors.push(`Screen[${index}]: layout.type 必須是 "SingleColumnLayout"`);
          }
          
          if (!screen.layout.children) {
            errors.push(`Screen[${index}]: layout.children 字段缺失`);
          } else if (!Array.isArray(screen.layout.children)) {
            errors.push(`Screen[${index}]: layout.children 必須是數組`);
          } else {
            // 檢查必須有 TextBody
            const hasTextBody = screen.layout.children.some(child => child.type === 'TextBody');
            if (!hasTextBody) {
              errors.push(`Screen[${index}]: 必須包含至少一個 TextBody 組件`);
            }
            
            // 檢查每個 screen 只能有一個 PhotoPicker 或 DocumentPicker
            const photoPickerCount = screen.layout.children.filter(c => c.type === 'PhotoPicker').length;
            const documentPickerCount = screen.layout.children.filter(c => c.type === 'DocumentPicker').length;
            if (photoPickerCount > 1) {
              errors.push(`Screen[${index}]: 每個 screen 只能有一個 PhotoPicker 組件`);
            }
            if (documentPickerCount > 1) {
              errors.push(`Screen[${index}]: 每個 screen 只能有一個 DocumentPicker 組件`);
            }
            if (photoPickerCount > 0 && documentPickerCount > 0) {
              errors.push(`Screen[${index}]: 不能同時使用 PhotoPicker 和 DocumentPicker 組件`);
            }
            
            // 驗證每個組件
            screen.layout.children.forEach((child, childIndex) => {
              if (!child.type) {
                errors.push(`Screen[${index}], Component[${childIndex}]: 缺少 type 字段`);
              } else {
                // 使用規範配置驗證組件
                const spec = getComponentSpec(child.type);
                if (!spec) {
                  const validTypes = Object.keys(COMPONENT_SPECS).join(', ');
                  errors.push(`Screen[${index}], Component[${childIndex}]: 無效的組件類型 "${child.type}"。支持的類型: ${validTypes}`);
                } else {
                  // 使用規範配置驗證組件
                  const componentValidation = validateComponent(child, spec);
                  if (!componentValidation.valid) {
                    componentValidation.errors.forEach(error => {
                      errors.push(`Screen[${index}], Component[${childIndex}] (${child.type}): ${error}`);
                    });
                  }
                  
                  // 驗證 PhotoPicker 特定屬性
                  if (child.type === 'PhotoPicker') {
                    if (child['min-uploaded-photos'] !== undefined && child['max-uploaded-photos'] !== undefined) {
                      if (child['min-uploaded-photos'] > child['max-uploaded-photos']) {
                        errors.push(`Screen[${index}], Component[${childIndex}] (PhotoPicker): min-uploaded-photos 不能大於 max-uploaded-photos`);
                      }
                    }
                    if (child['photo-source'] && !['camera_gallery', 'camera', 'gallery'].includes(child['photo-source'])) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (PhotoPicker): photo-source 必須是 'camera_gallery', 'camera' 或 'gallery'`);
                    }
                  }
                  
                  // 驗證 DocumentPicker 特定屬性
                  if (child.type === 'DocumentPicker') {
                    if (child['min-uploaded-documents'] !== undefined && child['max-uploaded-documents'] !== undefined) {
                      if (child['min-uploaded-documents'] > child['max-uploaded-documents']) {
                        errors.push(`Screen[${index}], Component[${childIndex}] (DocumentPicker): min-uploaded-documents 不能大於 max-uploaded-documents`);
                      }
                    }
                    // 驗證 description: 如果提供，不能是空字符串
                    if (child.description !== undefined && child.description !== null && child.description.trim() === '') {
                      errors.push(`Screen[${index}], Component[${childIndex}] (DocumentPicker): description 不能是空字符串，如果不提供請移除該屬性`);
                    }
                    // 驗證 error-message: 如果提供，必須是對象且不能是空字符串
                    if (child['error-message'] !== undefined) {
                      if (typeof child['error-message'] === 'string' && child['error-message'].trim() === '') {
                        errors.push(`Screen[${index}], Component[${childIndex}] (DocumentPicker): error-message 不能是空字符串，如果不提供請移除該屬性`);
                      } else if (typeof child['error-message'] !== 'object') {
                        errors.push(`Screen[${index}], Component[${childIndex}] (DocumentPicker): error-message 必須是對象類型`);
                      }
                    }
                  }
                  
                  // 驗證 TextInput 特定屬性
                  if (child.type === 'TextInput') {
                    if (child.id) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (TextInput): 不允許使用 id 屬性，應使用 name`);
                    }
                    if (child.placeholder) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (TextInput): 不允許使用 placeholder 屬性`);
                    }
                    if (child['on-click-action']) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (TextInput): 不允許使用 on-click-action 屬性`);
                    }
                  }
                  
                  // 驗證 DatePicker 和 CalendarPicker 特定屬性
                  if (child.type === 'DatePicker' || child.type === 'CalendarPicker') {
                    if (child.id) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (${child.type}): 不允許使用 id 屬性，應使用 name`);
                    }
                    if (child.placeholder) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (${child.type}): 不允許使用 placeholder 屬性`);
                    }
                    if (child['on-click-action']) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (${child.type}): 不允許使用 on-click-action 屬性，應使用 on-select-action`);
                    }
                  }
                  
                  // 驗證 Dropdown 特定屬性
                  if (child.type === 'Dropdown') {
                    if (child.id) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (Dropdown): 不允許使用 id 屬性，應使用 name`);
                    }
                    if (!child['data-source']) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (Dropdown): 缺少必需的 data-source 屬性`);
                    }
                    if (child.options) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (Dropdown): 不允許使用 options 屬性，應使用 data-source`);
                    }
                    if (child['on-click-action']) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (Dropdown): 不允許使用 on-click-action 屬性，應使用 on-select-action`);
                    }
                    if (child['on-select-action']) {
                      const actionName = child['on-select-action'].name;
                      if (actionName !== 'update_data' && actionName !== 'data_exchange') {
                        errors.push(`Screen[${index}], Component[${childIndex}] (Dropdown): on-select-action.name 應該是 "update_data" 或 "data_exchange"，當前值: "${actionName}"`);
                      }
                    }
                  }
                  
                  // 驗證 CheckboxGroup 特定屬性
                  if (child.type === 'CheckboxGroup') {
                    if (child.id) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (CheckboxGroup): 不允許使用 id 屬性，應使用 name`);
                    }
                    if (!child.name) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (CheckboxGroup): 缺少必需的 name 屬性`);
                    }
                    if (!child['data-source']) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (CheckboxGroup): 缺少必需的 data-source 屬性`);
                    }
                    if (child.options) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (CheckboxGroup): 不允許使用 options 屬性，應使用 data-source`);
                    }
                    if (child['on-click-action']) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (CheckboxGroup): 不允許使用 on-click-action 屬性，應使用 on-select-action`);
                    }
                    if (child['on-select-action']) {
                      const actionName = child['on-select-action'].name;
                      if (actionName !== 'update_data' && actionName !== 'data_exchange') {
                        errors.push(`Screen[${index}], Component[${childIndex}] (CheckboxGroup): on-select-action.name 應該是 "update_data" 或 "data_exchange"，當前值: "${actionName}"`);
                      }
                    }
                  }
                  
                  // 驗證 RadioButtonsGroup 特定屬性
                  if (child.type === 'RadioButtonsGroup') {
                    if (child.id) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (RadioButtonsGroup): 不允許使用 id 屬性，應使用 name`);
                    }
                    if (!child.name) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (RadioButtonsGroup): 缺少必需的 name 屬性`);
                    }
                    if (!child['data-source']) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (RadioButtonsGroup): 缺少必需的 data-source 屬性`);
                    }
                    if (child.options) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (RadioButtonsGroup): 不允許使用 options 屬性，應使用 data-source`);
                    }
                    if (child['on-click-action']) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (RadioButtonsGroup): 不允許使用 on-click-action 屬性，應使用 on-select-action`);
                    }
                    if (child['on-select-action']) {
                      const actionName = child['on-select-action'].name;
                      if (actionName !== 'update_data' && actionName !== 'data_exchange') {
                        errors.push(`Screen[${index}], Component[${childIndex}] (RadioButtonsGroup): on-select-action.name 應該是 "update_data" 或 "data_exchange"，當前值: "${actionName}"`);
                      }
                    }
                  }
                }
                
                // 驗證 Footer 必須有 on-click-action
                if (child.type === 'Footer') {
                  if (!child['on-click-action']) {
                    errors.push(`Screen[${index}], Component[${childIndex}] (Footer): 必須包含 on-click-action`);
                  } else {
                    const action = child['on-click-action'];
                    if (!action.name) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (Footer): on-click-action 必須包含 name`);
                    } else if (action.name !== 'complete') {
                      errors.push(`Screen[${index}], Component[${childIndex}] (Footer): on-click-action.name 必須是 "complete"`);
                    }
                  }
                }
                
                  // 驗證 Image 特定屬性
                  if (child.type === 'Image') {
                    if (child.id) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (Image): 不允許使用 id 屬性`);
                    }
                    if (child.url) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (Image): 不允許使用 url 屬性，應使用 src`);
                    }
                    if (child.alt) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (Image): 不允許使用 alt 屬性`);
                    }
                    if (child['on-click-action']) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (Image): 不允許使用 on-click-action 屬性`);
                    }
                  }
                  
                // 驗證其他組件的 on-click-action（排除 Image）
                if (child['on-click-action'] && child.type !== 'Image') {
                  const action = child['on-click-action'];
                  if (!action.name) {
                    errors.push(`Screen[${index}], Component[${childIndex}] (${child.type}): on-click-action 必須包含 name`);
                  } else {
                    const validActionNames = ['data_exchange', 'navigate', 'open_url', 'complete'];
                    if (!validActionNames.includes(action.name)) {
                      errors.push(`Screen[${index}], Component[${childIndex}] (${child.type}): on-click-action.name "${action.name}" 無效，必須是: ${validActionNames.join(', ')}`);
                    }
                    
                    // 驗證 navigate action 的 next 格式
                    if (action.name === 'navigate') {
                      if (!action.next) {
                        errors.push(`Screen[${index}], Component[${childIndex}] (${child.type}): navigate action 必須包含 next`);
                      } else if (typeof action.next === 'string') {
                        errors.push(`Screen[${index}], Component[${childIndex}] (${child.type}): navigate action 的 next 必須是對象 { name: string, type: "screen" }`);
                      } else if (typeof action.next === 'object') {
                        if (!action.next.name || typeof action.next.name !== 'string') {
                          errors.push(`Screen[${index}], Component[${childIndex}] (${child.type}): navigate action 的 next.name 必須是字符串`);
                        }
                        if (action.next.type !== 'screen') {
                          errors.push(`Screen[${index}], Component[${childIndex}] (${child.type}): navigate action 的 next.type 必須是 "screen"`);
                        }
                      }
                    }
                  }
                }
              }
            });
          }
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  } catch (error) {
    errors.push(`驗證過程發生錯誤: ${error.message}`);
    console.error('驗證 Meta Flow JSON 失敗:', error);
    return { valid: false, errors };
  }
};

/**
 * 創建 Meta Flow 創建請求
 */
export const createMetaFlowRequest = (flowData) => {
  const metaFlowJson = generateMetaFlowJson(flowData);
  
  return {
    name: flowData.name,
    categories: flowData.categories || ['LEAD_GENERATION'],
    ...metaFlowJson
  };
};

/**
 * 創建 Meta Flow 更新請求
 */
export const createMetaFlowUpdateRequest = (flowData) => {
  const metaFlowJson = generateMetaFlowJson(flowData);
  
  return {
    name: flowData.name,
    categories: flowData.categories || ['LEAD_GENERATION'],
    ...metaFlowJson
  };
};
