/**
 * Meta WhatsApp Flows 組件規範配置
 * 根據官方文檔：https://developers.facebook.com/docs/whatsapp/flows/reference/components
 * 
 * 此文件定義了所有官方支持的組件的標準格式、必需屬性、可選屬性和驗證規則
 */

/**
 * 組件規範定義
 * 每個組件包含：
 * - type: 組件類型名稱（PascalCase）
 * - identifierType: 使用 'id' 還是 'name'
 * - requiredFields: 必需屬性數組
 * - optionalFields: 可選屬性數組
 * - actionType: 使用的 action 類型（on-click-action 或 on-select-action）
 * - allowedActions: 允許的 action.name 值
 * - requiresTerminal: 是否需要 terminal screen
 * - requiresDataModel: 是否需要 data 模型（如果使用 data-source）
 * - dataModelTemplate: 數據模型模板（如果需要）
 */
export const COMPONENT_SPECS = {
  // ========== 文本組件 ==========
  TextHeading: {
    type: 'TextHeading',
    identifierType: null, // 不需要 id 或 name
    requiredFields: ['text'],
    optionalFields: ['visible'],
    actionType: null, // 不支持 action
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  TextSubheading: {
    type: 'TextSubheading',
    identifierType: null,
    requiredFields: ['text'],
    optionalFields: ['visible'],
    actionType: null,
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  TextCaption: {
    type: 'TextCaption',
    identifierType: null,
    requiredFields: ['text'],
    optionalFields: ['font-weight', 'strikethrough', 'visible', 'markdown'],
    actionType: null,
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  TextBody: {
    type: 'TextBody',
    identifierType: null,
    requiredFields: ['text'],
    optionalFields: ['font-weight', 'strikethrough', 'visible', 'markdown'],
    actionType: null,
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  RichText: {
    type: 'RichText',
    identifierType: null,
    requiredFields: ['text'],
    optionalFields: ['visible'],
    actionType: null,
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  Footer: {
    type: 'Footer',
    identifierType: null,
    requiredFields: ['label', 'on-click-action'],
    optionalFields: [],
    actionType: 'on-click-action',
    allowedActions: ['complete'], // Footer 只能使用 complete
    requiresTerminal: true, // 使用 complete 的 Footer 需要 terminal screen
    requiresDataModel: false
  },
  
  // ========== 輸入組件 ==========
  TextEntry: {
    type: 'TextEntry',
    identifierType: 'id',
    requiredFields: ['id', 'label'],
    optionalFields: ['input_type', 'placeholder', 'required', 'on-click-action'],
    actionType: 'on-click-action',
    allowedActions: ['data_exchange', 'navigate', 'update_data'],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  TextInput: {
    type: 'TextInput',
    identifierType: 'name', // 使用 name 而不是 id
    requiredFields: ['name', 'label'],
    optionalFields: ['input-type', 'required', 'helper-text', 'pattern'],
    actionType: null, // TextInput 在 Form 內部，不使用 action
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false,
    forbiddenFields: ['placeholder', 'id', 'on-click-action'] // 不允許的屬性
  },
  
  // TextArea 已移除，改用 RichText（只讀顯示，不支持輸入）
  
  // ========== 選擇組件 ==========
  Dropdown: {
    type: 'Dropdown',
    identifierType: 'name', // 使用 name 而不是 id
    requiredFields: ['name', 'label', 'data-source'],
    optionalFields: ['required', 'on-select-action', 'enabled', 'visible', 'description', 'error-message'],
    actionType: 'on-select-action', // 使用 on-select-action 而不是 on-click-action
    allowedActions: ['update_data', 'data_exchange'], // 根據錯誤信息，應該使用 update_data
    requiresTerminal: false,
    requiresDataModel: false, // 現在使用靜態數組，不再需要 data 模型
    dataModelTemplate: (dataSourceName) => ({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' }
        }
      },
      __example__: [
        { id: 'option_1', title: '選項 1' },
        { id: 'option_2', title: '選項 2' }
      ]
    })
  },
  
  CheckboxGroup: {
    type: 'CheckboxGroup',
    identifierType: 'name', // 使用 name 而不是 id
    requiredFields: ['name', 'label', 'data-source'], // 使用 data-source 而不是 options
    optionalFields: ['required', 'on-select-action', 'enabled', 'visible', 'description', 'error-message'],
    actionType: 'on-select-action', // 使用 on-select-action 而不是 on-click-action
    allowedActions: ['update_data', 'data_exchange'], // 根據錯誤信息，應該使用 update_data 或 data_exchange
    requiresTerminal: false,
    requiresDataModel: false, // 現在使用靜態數組，不再需要 data 模型
    dataModelTemplate: (dataSourceName) => ({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' }
        }
      },
      __example__: [
        { id: 'option_1', title: '選項 1' },
        { id: 'option_2', title: '選項 2' }
      ]
    }),
    forbiddenFields: ['id', 'options', 'on-click-action'] // 不允許的屬性
  },
  
  RadioButtonsGroup: {
    type: 'RadioButtonsGroup',
    identifierType: 'name', // 使用 name 而不是 id
    requiredFields: ['name', 'label', 'data-source'], // 使用 data-source 而不是 options
    optionalFields: ['required', 'on-select-action', 'enabled', 'visible', 'description', 'error-message'],
    actionType: 'on-select-action', // 使用 on-select-action 而不是 on-click-action
    allowedActions: ['update_data', 'data_exchange'], // 根據錯誤信息，應該使用 update_data 或 data_exchange
    requiresTerminal: false,
    requiresDataModel: false, // 現在使用靜態數組，不再需要 data 模型
    dataModelTemplate: (dataSourceName) => ({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' }
        }
      },
      __example__: [
        { id: 'option_1', title: '選項 1' },
        { id: 'option_2', title: '選項 2' }
      ]
    }),
    forbiddenFields: ['id', 'options', 'on-click-action'] // 不允許的屬性
  },
  
  // ========== 日期組件 ==========
  DatePicker: {
    type: 'DatePicker',
    identifierType: 'name', // 使用 name 而不是 id
    requiredFields: ['name', 'label'],
    optionalFields: ['required', 'on-select-action', 'enabled', 'visible', 'description', 'error-message'],
    actionType: 'on-select-action', // 使用 on-select-action
    allowedActions: ['update_data', 'data_exchange'],
    requiresTerminal: false,
    requiresDataModel: false,
    forbiddenFields: ['id', 'placeholder', 'on-click-action'] // 不允許的屬性
  },
  
  CalendarPicker: {
    type: 'CalendarPicker',
    identifierType: 'name',
    requiredFields: ['name', 'label'],
    optionalFields: ['required', 'on-select-action', 'enabled', 'visible', 'description', 'error-message'],
    actionType: 'on-select-action',
    allowedActions: ['update_data', 'data_exchange'],
    requiresTerminal: false,
    requiresDataModel: false,
    forbiddenFields: ['id', 'placeholder', 'on-click-action']
  },
  
  // ========== 媒體組件 ==========
  Image: {
    type: 'Image',
    identifierType: null, // 根據官方文檔，Image 不使用 id 或 name
    requiredFields: ['src'], // 使用 src 而不是 url
    optionalFields: ['width', 'height'], // 支持 width 和 height
    actionType: null, // 根據官方文檔，Image 不支持 on-click-action
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false,
    forbiddenFields: ['id', 'url', 'alt', 'on-click-action'] // 不允許的屬性
  },
  
  ImageCarousel: {
    type: 'ImageCarousel',
    identifierType: null, // 根據官方文檔，ImageCarousel 不需要 id 或 name
    requiredFields: ['images'], // 只需要 images 數組
    optionalFields: ['aspect-ratio', 'scale-type'],
    actionType: null, // ImageCarousel 不支持 action
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  // ========== 媒體上傳組件 ==========
  PhotoPicker: {
    type: 'PhotoPicker',
    identifierType: 'name', // 使用 name 而不是 id
    requiredFields: ['name', 'label'],
    optionalFields: [
      'description', 'photo-source', 'max-file-size-kb', 
      'min-uploaded-photos', 'max-uploaded-photos', 
      'enabled', 'visible', 'error-message'
    ],
    actionType: null, // PhotoPicker 不支持 action
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false,
    forbiddenFields: ['id', 'on-click-action', 'on-select-action']
  },
  
  DocumentPicker: {
    type: 'DocumentPicker',
    identifierType: 'name', // 使用 name 而不是 id
    requiredFields: ['name', 'label'],
    optionalFields: [
      'description', 'max-file-size-kb', 
      'min-uploaded-documents', 'max-uploaded-documents', 
      'allowed-mime-types', 'enabled', 'visible', 'error-message'
    ],
    actionType: null, // DocumentPicker 不支持 action
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false,
    forbiddenFields: ['id', 'on-click-action', 'on-select-action']
  },
  
  // ========== 鏈接組件 ==========
  EmbeddedLink: {
    type: 'EmbeddedLink',
    identifierType: null,
    requiredFields: ['text', 'on-click-action'],
    optionalFields: [],
    actionType: 'on-click-action',
    allowedActions: ['open_url'], // EmbeddedLink 只能使用 open_url
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  OptIn: {
    type: 'OptIn',
    identifierType: 'name',
    requiredFields: ['label', 'name', 'on-click-action'],
    optionalFields: [],
    actionType: 'on-click-action',
    allowedActions: ['open_url'], // OptIn 只能使用 open_url
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  // ========== 邏輯組件 ==========
  If: {
    type: 'If',
    identifierType: null,
    requiredFields: ['key', 'components'],
    optionalFields: [],
    actionType: null,
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  Switch: {
    type: 'Switch',
    identifierType: null,
    requiredFields: ['key', 'cases'],
    optionalFields: [],
    actionType: null,
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  // ========== 其他組件 ==========
  Form: {
    type: 'Form',
    identifierType: 'name',
    requiredFields: ['name', 'children'],
    optionalFields: [],
    actionType: null,
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  NavigationList: {
    type: 'NavigationList',
    identifierType: 'id',
    requiredFields: ['id', 'items'],
    optionalFields: [],
    actionType: null,
    allowedActions: [],
    requiresTerminal: false,
    requiresDataModel: false
  },
  
  ChipsSelector: {
    type: 'ChipsSelector',
    identifierType: 'name', // 使用 name 而不是 id（與實際生成一致）
    requiredFields: ['name', 'label', 'data-source'], // 使用 data-source（靜態數組）而不是 options
    optionalFields: ['required', 'max-selected-items', 'description', 'on-select-action'],
    actionType: 'on-select-action', // 使用 on-select-action 而不是 on-click-action
    allowedActions: ['update_data', 'data_exchange', 'navigate'],
    requiresTerminal: false,
    requiresDataModel: false // 使用靜態數組，不需要 data 模型
  }
};

/**
 * 根據組件類型獲取規範
 */
export const getComponentSpec = (componentType) => {
  return COMPONENT_SPECS[componentType] || null;
};

/**
 * 驗證組件是否符合規範
 */
export const validateComponent = (component, spec) => {
  const errors = [];
  
  if (!spec) {
    errors.push(`未知的組件類型: ${component.type}`);
    return { valid: false, errors };
  }
  
  // 驗證必需字段
  spec.requiredFields.forEach(field => {
    if (!(field in component)) {
      errors.push(`缺少必需字段: ${field}`);
    } else if (component[field] === null || component[field] === undefined || component[field] === '') {
      errors.push(`必需字段 ${field} 不能為空`);
    }
  });
  
  // 驗證禁止字段
  if (spec.forbiddenFields) {
    spec.forbiddenFields.forEach(field => {
      if (field in component) {
        errors.push(`不允許使用字段: ${field}`);
      }
    });
  }
  
  // 驗證 identifier (id 或 name)
  if (spec.identifierType === 'id') {
    if (!component.id) {
      errors.push(`缺少必需字段: id`);
    } else if (typeof component.id !== 'string' || component.id.trim() === '') {
      errors.push(`id 必須是非空字符串`);
    } else if (!/^[a-zA-Z_]+$/.test(component.id)) {
      errors.push(`id "${component.id}" 只能包含字母和下劃線`);
    }
  } else if (spec.identifierType === 'name') {
    if (!component.name) {
      errors.push(`缺少必需字段: name`);
    } else if (typeof component.name !== 'string' || component.name.trim() === '') {
      errors.push(`name 必須是非空字符串`);
    } else if (!/^[a-zA-Z_]+$/.test(component.name)) {
      errors.push(`name "${component.name}" 只能包含字母和下劃線`);
    }
  }
  
  // 驗證 action
  if (spec.actionType) {
    const action = component[spec.actionType];
    if (spec.requiredFields.includes(spec.actionType)) {
      if (!action) {
        errors.push(`缺少必需的 ${spec.actionType}`);
      } else if (!action.name) {
        errors.push(`${spec.actionType} 必須包含 name 字段`);
      } else if (!spec.allowedActions.includes(action.name)) {
        errors.push(`${spec.actionType}.name "${action.name}" 無效，允許的值: ${spec.allowedActions.join(', ')}`);
      }
    } else if (action && !spec.allowedActions.includes(action.name)) {
      errors.push(`${spec.actionType}.name "${action.name}" 無效，允許的值: ${spec.allowedActions.join(', ')}`);
    }
  }
  
  // 驗證 data-source（對於 Dropdown 等組件）
  // 支持兩種格式：
  // 1. 靜態數組格式：[{ "id": "...", "title": "..." }]（推薦）
  // 2. 動態引用格式：${data.field_name}（向後兼容）
  if (spec.requiresDataModel && component['data-source']) {
    const dataSource = component['data-source'];
    
    // 如果是數組格式（靜態數據）
    if (Array.isArray(dataSource)) {
      // 驗證數組中的每個元素
      dataSource.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          errors.push(`data-source[${index}]: 必須是對象`);
        } else {
          if (!item.id || typeof item.id !== 'string') {
            errors.push(`data-source[${index}]: 缺少 id 字段或 id 不是字符串`);
          }
          if (!item.title || typeof item.title !== 'string') {
            errors.push(`data-source[${index}]: 缺少 title 字段或 title 不是字符串`);
          }
        }
      });
    } 
    // 如果是字符串格式（動態引用，向後兼容）
    else if (typeof dataSource === 'string') {
      const dataSourceMatch = dataSource.match(/\$\{data\.(\w+)\}/);
      if (!dataSourceMatch) {
        errors.push(`data-source 格式無效，應為數組格式 [{ "id": "...", "title": "..." }] 或 \${data.field_name} 格式`);
      }
    } 
    // 其他格式無效
    else {
      errors.push(`data-source 格式無效，應為數組格式 [{ "id": "...", "title": "..." }] 或字符串格式 \${data.field_name}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * 獲取所有需要 terminal screen 的組件類型
 */
export const getComponentsRequiringTerminal = () => {
  return Object.keys(COMPONENT_SPECS).filter(
    type => COMPONENT_SPECS[type].requiresTerminal
  );
};

/**
 * 獲取所有需要 data 模型的組件類型
 */
export const getComponentsRequiringDataModel = () => {
  return Object.keys(COMPONENT_SPECS).filter(
    type => COMPONENT_SPECS[type].requiresDataModel
  );
};

/**
 * 根據 data-source 提取數據源名稱
 */
export const extractDataSourceName = (dataSource) => {
  if (!dataSource || typeof dataSource !== 'string') {
    return null;
  }
  const match = dataSource.match(/\$\{data\.(\w+)\}/);
  return match ? match[1] : null;
};

/**
 * 生成數據模型模板
 */
export const generateDataModel = (dataSourceName, componentType) => {
  const spec = COMPONENT_SPECS[componentType];
  if (!spec || !spec.dataModelTemplate) {
    return null;
  }
  return spec.dataModelTemplate(dataSourceName);
};

