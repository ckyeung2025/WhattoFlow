/**
 * 表格頁面代碼生成器
 * 基於代碼片段庫自動生成標準化的表格頁面
 */

import { 
  basicImports,
  resizableImports,
  basicState,
  paginatedState,
  batchOperationState,
  resizableState,
  modalState,
  timezoneEffect,
  basicLoadData,
  paginatedLoadData,
  basicColumns,
  resizableColumns,
  tableComponents,
  rowSelection,
  basicTable,
  resizableTable,
  batchOperationTable,
  searchBar,
  actionBar,
  basicCrudFunctions,
  batchOperationFunctions,
  basicModal,
  deleteModal,
  batchModal,
  basicPageStructure,
  paginatedPageStructure,
  batchOperationPageStructure,
  resizablePageStructure
} from './tableSnippets.js';

/**
 * 生成基礎表格頁面
 * @param {Object} config - 配置對象
 * @param {string} config.pageName - 頁面名稱
 * @param {string} config.apiEndpoint - API 端點
 * @param {Array} config.columns - 列配置
 * @param {Object} config.features - 功能配置
 * @param {Object} config.languageKeys - 語言鍵配置
 * @returns {string} 生成的代碼
 */
export const generateBasicTablePage = (config) => {
  const {
    pageName,
    apiEndpoint,
    columns = [],
    features = {
      search: false,
      batchOperations: false,
      resizable: false,
      timezone: true
    },
    languageKeys = {}
  } = config;

  // 根據功能選擇導入
  const imports = features.resizable ? resizableImports : basicImports;
  
  // 根據功能選擇狀態管理
  let stateManagement;
  if (features.resizable) {
    stateManagement = resizableState;
  } else if (features.batchOperations) {
    stateManagement = batchOperationState;
  } else if (features.search) {
    stateManagement = paginatedState;
  } else {
    stateManagement = basicState;
  }

  // 根據功能選擇數據載入函數
  const loadDataFunction = features.search ? paginatedLoadData : basicLoadData;

  // 根據功能選擇列定義
  let columnDefinition;
  if (features.resizable) {
    columnDefinition = resizableColumns;
  } else {
    columnDefinition = basicColumns;
  }

  // 根據功能選擇表格渲染
  let tableRender;
  if (features.resizable && features.batchOperations) {
    tableRender = batchOperationTable;
  } else if (features.resizable) {
    tableRender = resizableTable;
  } else {
    tableRender = basicTable;
  }

  // 生成列定義
  const customColumns = generateCustomColumns(columns, features.timezone);

  // 生成 CRUD 函數
  const crudFunctions = generateCrudFunctions(apiEndpoint, features.batchOperations);

  // 生成模態框
  const modals = generateModals(features.batchOperations);

  // 生成頁面結構
  let pageStructure;
  if (features.resizable) {
    pageStructure = resizablePageStructure;
  } else if (features.batchOperations) {
    pageStructure = batchOperationPageStructure;
  } else if (features.search) {
    pageStructure = paginatedPageStructure;
  } else {
    pageStructure = basicPageStructure;
  }

  return `
${imports}

const ${pageName} = () => {
  const { t } = useLanguage();
  
  // 狀態管理
  ${stateManagement}
  ${modalState}
  
  // Effects
  useEffect(() => {
    loadData();
  }, []);
  
  ${timezoneEffect}
  
  // 數據載入
  ${loadDataFunction.replace('/api/your-endpoint', apiEndpoint)}
  
  // CRUD 操作
  ${crudFunctions}
  
  // 列定義
  ${customColumns}
  
  ${features.resizable ? tableComponents : ''}
  
  ${features.batchOperations ? rowSelection : ''}
  
  return (
    <div style={{ padding: '16px' }}>
      ${features.search ? searchBar : ''}
      
      <Card>
        ${features.batchOperations ? actionBar : `
        <div style={{ marginBottom: '16px' }}>
          <Row gutter={[8, 8]} align="middle">
            <Col>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={handleAdd}
              >
                {t('table.add')}
              </Button>
            </Col>
          </Row>
        </div>
        `}
        
        ${tableRender}
      </Card>
      
      ${modals}
    </div>
  );
};

export default ${pageName};
  `;
};

/**
 * 生成自定義列定義
 * @param {Array} columns - 列配置
 * @param {boolean} timezone - 是否使用時區
 * @returns {string} 生成的列定義代碼
 */
const generateCustomColumns = (columns, timezone = true) => {
  if (columns.length === 0) {
    return basicColumns;
  }

  const columnDefinitions = columns.map(col => {
    let column = {
      title: `t('${col.titleKey || col.key}')`,
      dataIndex: col.key,
      key: col.key,
      width: col.width || 150
    };

    // 添加排序
    if (col.sortable !== false) {
      if (col.type === 'date') {
        column.sorter = `(a, b) => new Date(a.${col.key}) - new Date(b.${col.key})`;
      } else {
        column.sorter = `(a, b) => a.${col.key}.localeCompare(b.${col.key})`;
      }
      column.sortDirections = "['ascend', 'descend']";
    }

    // 添加渲染函數
    if (col.type === 'date' && timezone) {
      column.render = `(text) => (
        <div style={{ fontSize: '12px', color: '#333' }}>
          {text ? TimezoneUtils.formatDateWithTimezone(text, userTimezoneOffset, '${col.format || 'MM-DD HH:mm'}') : '-'}
        </div>
      )`;
    } else if (col.type === 'tag') {
      column.render = `(text) => <Tag color="${col.color || 'blue'}">{text}</Tag>`;
    } else if (col.type === 'status') {
      column.render = `(text) => <Tag color={text === '${col.activeValue || 'active'}' ? 'green' : 'red'}>{text}</Tag>`;
    } else if (col.type === 'actions') {
      column.render = `(_, record) => (
        <Space size="small">
          <Tooltip title={t('table.edit')}>
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={t('table.delete')}>
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      )`;
    }

    return `  ${JSON.stringify(column, null, 2).replace(/"/g, '').replace(/'/g, '')}`;
  }).join(',\n');

  return `
const columns = [
${columnDefinitions}
];
  `;
};

/**
 * 生成 CRUD 操作函數
 * @param {string} apiEndpoint - API 端點
 * @param {boolean} batchOperations - 是否包含批量操作
 * @returns {string} 生成的 CRUD 函數代碼
 */
const generateCrudFunctions = (apiEndpoint, batchOperations = false) => {
  let functions = basicCrudFunctions.replace(/\/api\/your-endpoint/g, apiEndpoint);
  
  if (batchOperations) {
    functions += '\n' + batchOperationFunctions.replace(/\/api\/your-endpoint/g, apiEndpoint);
  }
  
  return functions;
};

/**
 * 生成模態框
 * @param {boolean} batchOperations - 是否包含批量操作
 * @returns {string} 生成的模態框代碼
 */
const generateModals = (batchOperations = false) => {
  let modals = basicModal + '\n' + deleteModal;
  
  if (batchOperations) {
    modals += '\n' + batchModal;
  }
  
  return modals;
};

/**
 * 生成語言鍵配置
 * @param {Object} languageKeys - 語言鍵配置
 * @returns {string} 生成的語言鍵代碼
 */
export const generateLanguageKeys = (languageKeys) => {
  const defaultKeys = {
    'table.add': 'Add',
    'table.edit': 'Edit',
    'table.delete': 'Delete',
    'table.name': 'Name',
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
  };

  const mergedKeys = { ...defaultKeys, ...languageKeys };
  
  return `
// 語言鍵配置
const languageKeys = ${JSON.stringify(mergedKeys, null, 2)};
  `;
};

/**
 * 生成完整的頁面代碼
 * @param {Object} config - 配置對象
 * @returns {string} 生成的完整代碼
 */
export const generateCompletePage = (config) => {
  const pageCode = generateBasicTablePage(config);
  const languageKeys = generateLanguageKeys(config.languageKeys);
  
  return pageCode + '\n' + languageKeys;
};

/**
 * 預設配置模板
 */
export const defaultConfigs = {
  // 基礎 CRUD 頁面
  basic: {
    pageName: 'BasicPage',
    apiEndpoint: '/api/basic',
    columns: [
      { key: 'name', titleKey: 'table.name', width: 200 },
      { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 },
      { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150 }
    ],
    features: {
      search: false,
      batchOperations: false,
      resizable: false,
      timezone: true
    }
  },
  
  // 帶搜索的頁面
  searchable: {
    pageName: 'SearchablePage',
    apiEndpoint: '/api/searchable',
    columns: [
      { key: 'name', titleKey: 'table.name', width: 200 },
      { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 },
      { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150 }
    ],
    features: {
      search: true,
      batchOperations: false,
      resizable: false,
      timezone: true
    }
  },
  
  // 帶批量操作的頁面
  batchOperation: {
    pageName: 'BatchOperationPage',
    apiEndpoint: '/api/batch',
    columns: [
      { key: 'name', titleKey: 'table.name', width: 200 },
      { key: 'status', titleKey: 'table.status', type: 'status', width: 100 },
      { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 },
      { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150 }
    ],
    features: {
      search: true,
      batchOperations: true,
      resizable: false,
      timezone: true
    }
  },
  
  // 帶可調整大小的頁面
  resizable: {
    pageName: 'ResizablePage',
    apiEndpoint: '/api/resizable',
    columns: [
      { key: 'name', titleKey: 'table.name', width: 200 },
      { key: 'status', titleKey: 'table.status', type: 'status', width: 100 },
      { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 },
      { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150 }
    ],
    features: {
      search: true,
      batchOperations: true,
      resizable: true,
      timezone: true
    }
  }
};

/**
 * 使用預設配置生成頁面
 * @param {string} configType - 配置類型
 * @param {Object} customConfig - 自定義配置
 * @returns {string} 生成的代碼
 */
export const generateWithDefaultConfig = (configType, customConfig = {}) => {
  const config = { ...defaultConfigs[configType], ...customConfig };
  return generateCompletePage(config);
};

/**
 * 快速生成器 - 最常用的配置
 */
export const quickGenerators = {
  // 生成簡單的 CRUD 頁面
  simpleCrud: (pageName, apiEndpoint, columns = []) => {
    return generateCompletePage({
      pageName,
      apiEndpoint,
      columns: columns.length > 0 ? columns : [
        { key: 'name', titleKey: 'table.name', width: 200 },
        { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 },
        { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150 }
      ],
      features: {
        search: false,
        batchOperations: false,
        resizable: false,
        timezone: true
      }
    });
  },
  
  // 生成帶搜索的頁面
  searchableCrud: (pageName, apiEndpoint, columns = []) => {
    return generateCompletePage({
      pageName,
      apiEndpoint,
      columns: columns.length > 0 ? columns : [
        { key: 'name', titleKey: 'table.name', width: 200 },
        { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 },
        { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150 }
      ],
      features: {
        search: true,
        batchOperations: false,
        resizable: false,
        timezone: true
      }
    });
  },
  
  // 生成帶批量操作的頁面
  batchCrud: (pageName, apiEndpoint, columns = []) => {
    return generateCompletePage({
      pageName,
      apiEndpoint,
      columns: columns.length > 0 ? columns : [
        { key: 'name', titleKey: 'table.name', width: 200 },
        { key: 'status', titleKey: 'table.status', type: 'status', width: 100 },
        { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 },
        { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150 }
      ],
      features: {
        search: true,
        batchOperations: true,
        resizable: false,
        timezone: true
      }
    });
  },
  
  // 生成完整的企業級頁面
  enterprise: (pageName, apiEndpoint, columns = []) => {
    return generateCompletePage({
      pageName,
      apiEndpoint,
      columns: columns.length > 0 ? columns : [
        { key: 'name', titleKey: 'table.name', width: 200 },
        { key: 'status', titleKey: 'table.status', type: 'status', width: 100 },
        { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 },
        { key: 'updatedAt', titleKey: 'table.updatedAt', type: 'date', width: 150 }
      ],
      features: {
        search: true,
        batchOperations: true,
        resizable: true,
        timezone: true
      }
    });
  }
};
