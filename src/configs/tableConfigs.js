/**
 * 表格頁面配置模板
 * 基於現有成熟頁面的配置模式
 */

/**
 * 基於現有頁面的配置模板
 */
export const existingPageConfigs = {
  // 基於 HashtagsPage.js 的配置
  hashtags: {
    pageName: 'HashtagsPage',
    apiEndpoint: '/api/hashtags',
    columns: [
      { key: 'name', titleKey: 'hashtags.name', width: 200, sortable: true },
      { key: 'color', titleKey: 'hashtags.color', type: 'color', width: 100 },
      { key: 'usageCount', titleKey: 'hashtags.usageCount', width: 120, sortable: true },
      { key: 'createdAt', titleKey: 'hashtags.createdAt', type: 'date', width: 150, sortable: true },
      { key: 'updatedAt', titleKey: 'hashtags.updatedAt', type: 'date', width: 150, sortable: true }
    ],
    features: {
      search: false,
      batchOperations: false,
      resizable: false,
      timezone: true,
      modal: true,
      colorPicker: true
    },
    languageKeys: {
      'hashtags.name': 'Name',
      'hashtags.color': 'Color',
      'hashtags.usageCount': 'Usage Count',
      'hashtags.createdAt': 'Created At',
      'hashtags.updatedAt': 'Updated At',
      'hashtags.add': 'Add Hashtag',
      'hashtags.edit': 'Edit Hashtag',
      'hashtags.delete': 'Delete Hashtag'
    }
  },

  // 基於 ContactListPage.js 的配置 (優化後版本)
  contactList: {
    pageName: 'ContactListPage',
    apiEndpoint: '/api/contactlist',
    columns: [
      { key: 'select', titleKey: 'contactList.select', type: 'checkbox', width: 50 },
      { key: 'name', titleKey: 'contactList.name', width: 200, sortable: true },
      { key: 'contact', titleKey: 'contactList.contactInfo', width: 200, sortable: true },
      { key: 'company', titleKey: 'contactList.company', width: 180, sortable: true },
      { key: 'broadcastGroup', titleKey: 'contactList.group', width: 150, sortable: true },
      { key: 'hashtags', titleKey: 'contactList.tags', width: 200 },
      { key: 'createdAt', titleKey: 'contactList.createdAt', type: 'date', width: 150, sortable: true },
      { key: 'updatedAt', titleKey: 'contactList.updatedAt', type: 'date', width: 150, sortable: true },
      { key: 'actions', titleKey: 'contactList.actions', width: 100 }
    ],
    features: {
      search: true,
      batchOperations: true,
      resizable: true,
      timezone: true,
      modal: true,
      serverSorting: true,  // 新增：服務器端排序
      filters: ['group', 'hashtag'],
      pagination: true
    },
    languageKeys: {
      'contactList.name': 'Name',
      'contactList.contactInfo': 'Contact Info',
      'contactList.company': 'Company',
      'contactList.group': 'Group',
      'contactList.tags': 'Tags',
      'contactList.createdAt': 'Created At',
      'contactList.updatedAt': 'Updated At',
      'contactList.actions': 'Actions',
      'contactList.addContact': 'Add Contact',
      'contactList.edit': 'Edit',
      'contactList.delete': 'Delete'
    }
  },

  // 基於 BroadcastGroupsPage.js 的配置
  broadcastGroups: {
    pageName: 'BroadcastGroupsPage',
    apiEndpoint: '/api/broadcastgroups',
    columns: [
      { key: 'name', titleKey: 'broadcastGroups.name', width: 200, sortable: true },
      { key: 'description', titleKey: 'broadcastGroups.description', width: 250, ellipsis: true },
      { key: 'contactCount', titleKey: 'broadcastGroups.contactCount', width: 120, sortable: true },
      { key: 'createdAt', titleKey: 'broadcastGroups.createdAt', type: 'date', width: 150, sortable: true },
      { key: 'updatedAt', titleKey: 'broadcastGroups.updatedAt', type: 'date', width: 150, sortable: true }
    ],
    features: {
      search: false,
      batchOperations: false,
      resizable: false,
      timezone: true,
      modal: true,
      colorPicker: true
    },
    languageKeys: {
      'broadcastGroups.name': 'Name',
      'broadcastGroups.description': 'Description',
      'broadcastGroups.contactCount': 'Contact Count',
      'broadcastGroups.createdAt': 'Created At',
      'broadcastGroups.updatedAt': 'Updated At',
      'broadcastGroups.add': 'Add Group',
      'broadcastGroups.edit': 'Edit Group',
      'broadcastGroups.delete': 'Delete Group'
    }
  },

  // 基於 ContactListPage.js 的配置
  contactList: {
    pageName: 'ContactListPage',
    apiEndpoint: '/api/contacts',
    columns: [
      { key: 'name', titleKey: 'contactList.name', width: 150, sortable: true },
      { key: 'phone', titleKey: 'contactList.phone', width: 120, sortable: true },
      { key: 'email', titleKey: 'contactList.email', width: 200, ellipsis: true },
      { key: 'hashtags', titleKey: 'contactList.hashtags', type: 'tags', width: 150 },
      { key: 'broadcastGroups', titleKey: 'contactList.broadcastGroups', type: 'tags', width: 150 },
      { key: 'createdAt', titleKey: 'contactList.createdAt', type: 'date', width: 150, sortable: true },
      { key: 'updatedAt', titleKey: 'contactList.updatedAt', type: 'date', width: 150, sortable: true }
    ],
    features: {
      search: true,
      batchOperations: true,
      resizable: false,
      timezone: true,
      modal: true,
      filters: true,
      pagination: true
    },
    languageKeys: {
      'contactList.name': 'Name',
      'contactList.phone': 'Phone',
      'contactList.email': 'Email',
      'contactList.hashtags': 'Hashtags',
      'contactList.broadcastGroups': 'Groups',
      'contactList.createdAt': 'Created At',
      'contactList.updatedAt': 'Updated At',
      'contactList.add': 'Add Contact',
      'contactList.edit': 'Edit Contact',
      'contactList.delete': 'Delete Contact',
      'contactList.batchDelete': 'Batch Delete'
    }
  },

  // 基於 WorkflowListPage.js 的配置
  workflowList: {
    pageName: 'WorkflowListPage',
    apiEndpoint: '/api/workflows',
    columns: [
      { key: 'name', titleKey: 'workflow.name', width: 200, sortable: true, ellipsis: true },
      { key: 'createdBy', titleKey: 'workflow.createdBy', width: 120, sortable: true },
      { key: 'status', titleKey: 'workflow.status', type: 'status', width: 100, sortable: true },
      { key: 'createdAt', titleKey: 'workflow.createdAt', type: 'date', width: 160, sortable: true, format: 'YYYY-MM-DD HH:mm' },
      { key: 'updatedAt', titleKey: 'workflow.updatedAt', type: 'date', width: 160, sortable: true, format: 'YYYY-MM-DD HH:mm' }
    ],
    features: {
      search: true,
      batchOperations: true,
      resizable: true,
      timezone: true,
      modal: false,
      customActions: true
    },
    languageKeys: {
      'workflow.name': 'Name',
      'workflow.createdBy': 'Created By',
      'workflow.status': 'Status',
      'workflow.createdAt': 'Created At',
      'workflow.updatedAt': 'Updated At',
      'workflow.design': 'Design',
      'workflow.copy': 'Copy',
      'workflow.delete': 'Delete',
      'workflow.manualStart': 'Manual Start',
      'workflow.batchEnable': 'Batch Enable',
      'workflow.batchDisable': 'Batch Disable'
    }
  }
};

/**
 * 通用配置模板
 */
export const commonConfigs = {
  // 簡單 CRUD 配置
  simpleCrud: {
    pageName: 'SimplePage',
    apiEndpoint: '/api/simple',
    columns: [
      { key: 'name', titleKey: 'table.name', width: 200, sortable: true },
      { key: 'description', titleKey: 'table.description', width: 250, ellipsis: true },
      { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150, sortable: true },
      { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150, sortable: true }
    ],
    features: {
      search: false,
      batchOperations: false,
      resizable: false,
      timezone: true,
      modal: true
    }
  },

  // 帶搜索的 CRUD 配置
  searchableCrud: {
    pageName: 'SearchablePage',
    apiEndpoint: '/api/searchable',
    columns: [
      { key: 'name', titleKey: 'table.name', width: 200, sortable: true },
      { key: 'description', titleKey: 'table.description', width: 250, ellipsis: true },
      { key: 'status', titleKey: 'table.status', type: 'status', width: 100, sortable: true },
      { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150, sortable: true },
      { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150, sortable: true }
    ],
    features: {
      search: true,
      batchOperations: false,
      resizable: false,
      timezone: true,
      modal: true
    }
  },

  // 帶批量操作的 CRUD 配置
  batchCrud: {
    pageName: 'BatchPage',
    apiEndpoint: '/api/batch',
    columns: [
      { key: 'name', titleKey: 'table.name', width: 200, sortable: true },
      { key: 'description', titleKey: 'table.description', width: 250, ellipsis: true },
      { key: 'status', titleKey: 'table.status', type: 'status', width: 100, sortable: true },
      { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150, sortable: true },
      { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150, sortable: true }
    ],
    features: {
      search: true,
      batchOperations: true,
      resizable: false,
      timezone: true,
      modal: true
    }
  },

  // 企業級配置（包含所有功能）
  enterprise: {
    pageName: 'EnterprisePage',
    apiEndpoint: '/api/enterprise',
    columns: [
      { key: 'name', titleKey: 'table.name', width: 200, sortable: true, ellipsis: true },
      { key: 'description', titleKey: 'table.description', width: 250, ellipsis: true },
      { key: 'status', titleKey: 'table.status', type: 'status', width: 100, sortable: true },
      { key: 'priority', titleKey: 'table.priority', type: 'tag', width: 100, sortable: true },
      { key: 'createdBy', titleKey: 'table.createdBy', width: 120, sortable: true },
      { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150, sortable: true },
      { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150, sortable: true }
    ],
    features: {
      search: true,
      batchOperations: true,
      resizable: true,
      timezone: true,
      modal: true,
      filters: true,
      pagination: true,
      export: true
    }
  }
};

/**
 * 列類型配置
 */
export const columnTypes = {
  text: {
    render: null,
    sortable: true,
    ellipsis: false
  },
  date: {
    render: 'timezone',
    sortable: true,
    ellipsis: false,
    format: 'MM-DD HH:mm'
  },
  status: {
    render: 'tag',
    sortable: true,
    ellipsis: false,
    activeValue: 'active',
    inactiveValue: 'inactive'
  },
  tag: {
    render: 'tag',
    sortable: false,
    ellipsis: false,
    color: 'blue'
  },
  tags: {
    render: 'tags',
    sortable: false,
    ellipsis: true
  },
  color: {
    render: 'color',
    sortable: false,
    ellipsis: false
  },
  number: {
    render: 'number',
    sortable: true,
    ellipsis: false
  },
  actions: {
    render: 'actions',
    sortable: false,
    ellipsis: false,
    width: 120
  }
};

/**
 * 功能配置選項
 */
export const featureOptions = {
  search: {
    description: '添加搜索功能',
    includes: ['searchBar', 'handleSearch']
  },
  batchOperations: {
    description: '添加批量操作功能',
    includes: ['rowSelection', 'batchModal', 'handleBatchDelete']
  },
  resizable: {
    description: '添加可調整大小的列',
    includes: ['ResizableTitle', 'handleResize', 'columnWidths']
  },
  timezone: {
    description: '添加時區處理',
    includes: ['TimezoneUtils', 'userTimezoneOffset', 'timezoneEffect']
  },
  modal: {
    description: '添加模態框',
    includes: ['showModal', 'editingItem', 'form', 'handleSave']
  },
  filters: {
    description: '添加篩選功能',
    includes: ['filters', 'handleFilter']
  },
  pagination: {
    description: '添加分頁功能',
    includes: ['pagination', 'currentPage', 'pageSize', 'totalCount']
  },
  export: {
    description: '添加導出功能',
    includes: ['handleExport', 'exportButton']
  },
  colorPicker: {
    description: '添加顏色選擇器',
    includes: ['ColorPicker', 'colorField']
  },
  customActions: {
    description: '添加自定義操作按鈕',
    includes: ['customActionButtons']
  }
};

/**
 * 語言鍵模板
 */
export const languageKeyTemplates = {
  basic: {
    'table.add': 'Add',
    'table.edit': 'Edit',
    'table.delete': 'Delete',
    'table.name': 'Name',
    'table.description': 'Description',
    'table.status': 'Status',
    'table.createdAt': 'Created At',
    'table.updatedAt': 'Updated At',
    'table.actions': 'Actions',
    'table.searchPlaceholder': 'Search...',
    'table.refresh': 'Refresh',
    'table.batchDelete': 'Batch Delete',
    'table.confirmDelete': 'Confirm Delete',
    'table.deleteConfirmMessage': 'Are you sure you want to delete {name}?',
    'table.batchDeleteConfirmMessage': 'Are you sure you want to delete {count} items?',
    'table.addSuccess': 'Added successfully',
    'table.updateSuccess': 'Updated successfully',
    'table.deleteSuccess': 'Deleted successfully',
    'table.batchDeleteSuccess': 'Batch deleted successfully',
    'table.loadError': 'Failed to load data',
    'table.saveError': 'Failed to save data',
    'table.deleteError': 'Failed to delete data',
    'table.batchDeleteError': 'Failed to batch delete data',
    'table.nameRequired': 'Name is required',
    'table.namePlaceholder': 'Enter name',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel'
  },
  
  status: {
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.enabled': 'Enabled',
    'status.disabled': 'Disabled',
    'status.pending': 'Pending',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected'
  },
  
  priority: {
    'priority.high': 'High',
    'priority.medium': 'Medium',
    'priority.low': 'Low'
  }
};

/**
 * 創建自定義配置
 * @param {Object} baseConfig - 基礎配置
 * @param {Object} customConfig - 自定義配置
 * @returns {Object} 合併後的配置
 */
export const createCustomConfig = (baseConfig, customConfig) => {
  return {
    ...baseConfig,
    ...customConfig,
    columns: customConfig.columns || baseConfig.columns,
    features: { ...baseConfig.features, ...customConfig.features },
    languageKeys: { ...baseConfig.languageKeys, ...customConfig.languageKeys }
  };
};

/**
 * 驗證配置
 * @param {Object} config - 配置對象
 * @returns {Object} 驗證結果
 */
export const validateConfig = (config) => {
  const errors = [];
  const warnings = [];

  // 必需字段檢查
  if (!config.pageName) {
    errors.push('pageName is required');
  }
  if (!config.apiEndpoint) {
    errors.push('apiEndpoint is required');
  }
  if (!config.columns || config.columns.length === 0) {
    errors.push('columns is required and must not be empty');
  }

  // 列配置檢查
  if (config.columns) {
    config.columns.forEach((col, index) => {
      if (!col.key) {
        errors.push(`Column ${index}: key is required`);
      }
      if (!col.titleKey && !col.title) {
        errors.push(`Column ${index}: titleKey or title is required`);
      }
      if (col.type && !columnTypes[col.type]) {
        warnings.push(`Column ${index}: unknown type '${col.type}'`);
      }
    });
  }

  // 功能配置檢查
  if (config.features) {
    Object.keys(config.features).forEach(feature => {
      if (!featureOptions[feature]) {
        warnings.push(`Unknown feature: '${feature}'`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * 獲取推薦配置
 * @param {string} pageType - 頁面類型
 * @param {Object} requirements - 需求
 * @returns {Object} 推薦配置
 */
export const getRecommendedConfig = (pageType, requirements = {}) => {
  const recommendations = {
    'simple-list': commonConfigs.simpleCrud,
    'searchable-list': commonConfigs.searchableCrud,
    'batch-operations': commonConfigs.batchCrud,
    'enterprise': commonConfigs.enterprise,
    'hashtags': existingPageConfigs.hashtags,
    'broadcast-groups': existingPageConfigs.broadcastGroups,
    'contact-list': existingPageConfigs.contactList,
    'workflow-list': existingPageConfigs.workflowList
  };

  const baseConfig = recommendations[pageType] || commonConfigs.simpleCrud;
  
  // 根據需求調整配置
  if (requirements.timezone === false) {
    baseConfig.features.timezone = false;
  }
  if (requirements.resizable === true) {
    baseConfig.features.resizable = true;
  }
  if (requirements.batchOperations === true) {
    baseConfig.features.batchOperations = true;
  }

  return baseConfig;
};

// 基於 BroadcastGroupsPage.js 的配置 (優化後版本)
export const broadcastGroupsConfig = {
  pageName: 'BroadcastGroupsPage',
  apiEndpoint: '/api/contactlist/groups',
  columns: [
    { key: 'name', titleKey: 'broadcastGroups.groupName', width: 200, sortable: true },
    { key: 'color', titleKey: 'broadcastGroups.groupColor', width: 120, sortable: true },
    { key: 'contactCount', titleKey: 'broadcastGroups.contactCount', width: 120 },
    { key: 'createdAt', titleKey: 'broadcastGroups.createdAt', type: 'date', width: 150, sortable: true },
    { key: 'updatedAt', titleKey: 'broadcastGroups.updatedAt', type: 'date', width: 150, sortable: true },
    { key: 'actions', titleKey: 'broadcastGroups.actions', width: 150 }
  ],
  features: {
    search: false,
    batchOperations: false,
    resizable: true,
    timezone: true,
    modal: true,
    serverSorting: true,  // 新增：服務器端排序
    filters: [],
    pagination: true
  },
  languageKeys: {
    'broadcastGroups.groupName': 'Group Name',
    'broadcastGroups.groupColor': 'Group Color',
    'broadcastGroups.contactCount': 'Contact Count',
    'broadcastGroups.createdAt': 'Created At',
    'broadcastGroups.updatedAt': 'Updated At',
    'broadcastGroups.actions': 'Actions',
    'broadcastGroups.addGroup': 'Add Group',
    'broadcastGroups.edit': 'Edit',
    'broadcastGroups.delete': 'Delete'
  }
};

// HashtagsPage 配置
export const hashtagsConfig = {
  name: 'hashtags',
  title: 'Hashtags Management',
  description: 'Manage hashtags for contact categorization',
  
  // 功能選項
  features: {
    resizable: true,
    serverSorting: true,
    pagination: true,
    search: true,
    crud: true,
    batchOperations: false,
    export: false,
    import: false
  },
  
  // 列配置
  columns: [
    {
      key: 'name',
      title: 'hashtags.tagName',
      dataIndex: 'name',
      type: 'tag',
      sortable: true,
      resizable: true,
      width: 200
    },
    {
      key: 'description',
      title: 'hashtags.description',
      dataIndex: 'description',
      type: 'text',
      sortable: true,
      resizable: true,
      width: 250
    },
    {
      key: 'usage',
      title: 'hashtags.usageCount',
      dataIndex: 'usage',
      type: 'number',
      sortable: false,
      resizable: true,
      width: 120
    },
    {
      key: 'color',
      title: 'hashtags.color',
      dataIndex: 'color',
      type: 'color',
      sortable: true,
      resizable: true,
      width: 120
    },
    {
      key: 'createdAt',
      title: 'hashtags.createdAt',
      dataIndex: 'createdAt',
      type: 'datetime',
      sortable: true,
      resizable: true,
      width: 150
    },
    {
      key: 'actions',
      title: 'hashtags.actions',
      type: 'actions',
      sortable: false,
      resizable: true,
      width: 150
    }
  ],
  
  // API 配置
  api: {
    baseUrl: '/api/contactlist/hashtags',
    methods: {
      list: 'GET',
      create: 'POST',
      update: 'PUT',
      delete: 'DELETE'
    },
    params: {
      page: 'page',
      pageSize: 'pageSize',
      search: 'search',
      sortField: 'sortField',
      sortOrder: 'sortOrder'
    }
  },
  
  // 語言鍵模板
  languageKeys: {
    'hashtags.title': 'Hashtags',
    'hashtags.description': 'Manage hashtags for contact categorization',
    'hashtags.tagName': 'Tag Name',
    'hashtags.description': 'Description',
    'hashtags.usageCount': 'Usage Count',
    'hashtags.color': 'Color',
    'hashtags.createdAt': 'Created At',
    'hashtags.actions': 'Actions',
    'hashtags.addTag': 'Add Tag',
    'hashtags.edit': 'Edit',
    'hashtags.delete': 'Delete'
  }
};
