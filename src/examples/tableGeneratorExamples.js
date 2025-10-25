/**
 * 表格頁面代碼生成器使用示例
 * 展示如何使用代碼片段庫和生成器創建新的表格頁面
 */

import { quickGenerators } from '../tools/tablePageGenerator.js';
import { existingPageConfigs, createCustomConfig } from '../configs/tableConfigs.js';
import { generateCompletePage, generateWithDefaultConfig } from '../tools/tablePageGenerator.js';

// 示例 1: 使用快速生成器創建簡單的產品管理頁面
export const generateProductPage = () => {
  const productPageCode = quickGenerators.simpleCrud(
    'ProductManagementPage',
    '/api/products',
    [
      { key: 'name', titleKey: 'product.name', width: 200 },
      { key: 'price', titleKey: 'product.price', type: 'number', width: 100 },
      { key: 'category', titleKey: 'product.category', width: 150 },
      { key: 'status', titleKey: 'product.status', type: 'status', width: 100 },
      { key: 'createdAt', titleKey: 'product.createdAt', type: 'date', width: 150 }
    ]
  );
  
  return productPageCode;
};

// 示例 2: 使用快速生成器創建帶搜索的用戶管理頁面
export const generateUserPage = () => {
  const userPageCode = quickGenerators.searchableCrud(
    'UserManagementPage',
    '/api/users',
    [
      { key: 'name', titleKey: 'user.name', width: 150 },
      { key: 'email', titleKey: 'user.email', width: 200 },
      { key: 'role', titleKey: 'user.role', type: 'tag', width: 100 },
      { key: 'status', titleKey: 'user.status', type: 'status', width: 100 },
      { key: 'lastLogin', titleKey: 'user.lastLogin', type: 'date', width: 150 },
      { key: 'createdAt', titleKey: 'user.createdAt', type: 'date', width: 150 }
    ]
  );
  
  return userPageCode;
};

// 示例 3: 使用快速生成器創建帶批量操作的訂單管理頁面
export const generateOrderPage = () => {
  const orderPageCode = quickGenerators.batchCrud(
    'OrderManagementPage',
    '/api/orders',
    [
      { key: 'orderNumber', titleKey: 'order.number', width: 150 },
      { key: 'customerName', titleKey: 'order.customer', width: 150 },
      { key: 'amount', titleKey: 'order.amount', type: 'number', width: 100 },
      { key: 'status', titleKey: 'order.status', type: 'status', width: 100 },
      { key: 'orderDate', titleKey: 'order.date', type: 'date', width: 150 },
      { key: 'createdAt', titleKey: 'order.createdAt', type: 'date', width: 150 }
    ]
  );
  
  return orderPageCode;
};

// 示例 4: 使用快速生成器創建企業級的客戶管理頁面
export const generateCustomerPage = () => {
  const customerPageCode = quickGenerators.enterprise(
    'CustomerManagementPage',
    '/api/customers',
    [
      { key: 'name', titleKey: 'customer.name', width: 150 },
      { key: 'email', titleKey: 'customer.email', width: 200 },
      { key: 'phone', titleKey: 'customer.phone', width: 120 },
      { key: 'company', titleKey: 'customer.company', width: 150 },
      { key: 'status', titleKey: 'customer.status', type: 'status', width: 100 },
      { key: 'priority', titleKey: 'customer.priority', type: 'tag', width: 100 },
      { key: 'lastContact', titleKey: 'customer.lastContact', type: 'date', width: 150 },
      { key: 'createdAt', titleKey: 'customer.createdAt', type: 'date', width: 150 }
    ]
  );
  
  return customerPageCode;
};

// 示例 5: 基於現有頁面配置創建自定義頁面
export const generateCustomTagPage = () => {
  const customConfig = createCustomConfig(
    existingPageConfigs.hashtags,
    {
      pageName: 'CustomTagPage',
      apiEndpoint: '/api/custom-tags',
      columns: [
        ...existingPageConfigs.hashtags.columns,
        { key: 'category', titleKey: 'tag.category', width: 120 },
        { key: 'priority', titleKey: 'tag.priority', type: 'tag', width: 100 }
      ],
      features: {
        ...existingPageConfigs.hashtags.features,
        search: true,
        batchOperations: true
      },
      languageKeys: {
        ...existingPageConfigs.hashtags.languageKeys,
        'tag.category': 'Category',
        'tag.priority': 'Priority',
        'tag.add': 'Add Tag',
        'tag.edit': 'Edit Tag',
        'tag.delete': 'Delete Tag'
      }
    }
  );
  
  const customTagPageCode = generateCompletePage(customConfig);
  return customTagPageCode;
};

// 示例 6: 使用預設配置創建頁面
export const generateDefaultPage = () => {
  const defaultPageCode = generateWithDefaultConfig('enterprise', {
    pageName: 'DefaultEnterprisePage',
    apiEndpoint: '/api/default',
    languageKeys: {
      'table.name': 'Default Name',
      'table.description': 'Default Description',
      'table.status': 'Default Status',
      'table.priority': 'Default Priority',
      'table.createdBy': 'Default Creator',
      'table.createdAt': 'Default Created At',
      'table.updatedAt': 'Default Updated At'
    }
  });
  
  return defaultPageCode;
};

// 示例 7: 創建完全自定義的頁面
export const generateFullyCustomPage = () => {
  const customConfig = {
    pageName: 'FullyCustomPage',
    apiEndpoint: '/api/fully-custom',
    columns: [
      { key: 'id', titleKey: 'custom.id', width: 80, sortable: true },
      { key: 'title', titleKey: 'custom.title', width: 200, sortable: true, ellipsis: true },
      { key: 'description', titleKey: 'custom.description', width: 300, ellipsis: true },
      { key: 'type', titleKey: 'custom.type', type: 'tag', width: 100 },
      { key: 'status', titleKey: 'custom.status', type: 'status', width: 100 },
      { key: 'priority', titleKey: 'custom.priority', type: 'tag', width: 100 },
      { key: 'assignedTo', titleKey: 'custom.assignedTo', width: 120 },
      { key: 'dueDate', titleKey: 'custom.dueDate', type: 'date', width: 150, format: 'YYYY-MM-DD' },
      { key: 'createdAt', titleKey: 'custom.createdAt', type: 'date', width: 150 },
      { key: 'updatedAt', titleKey: 'custom.updatedAt', type: 'date', width: 150 }
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
    },
    languageKeys: {
      'custom.id': 'ID',
      'custom.title': 'Title',
      'custom.description': 'Description',
      'custom.type': 'Type',
      'custom.status': 'Status',
      'custom.priority': 'Priority',
      'custom.assignedTo': 'Assigned To',
      'custom.dueDate': 'Due Date',
      'custom.createdAt': 'Created At',
      'custom.updatedAt': 'Updated At',
      'custom.add': 'Add Item',
      'custom.edit': 'Edit Item',
      'custom.delete': 'Delete Item',
      'custom.batchDelete': 'Batch Delete',
      'custom.searchPlaceholder': 'Search items...',
      'custom.refresh': 'Refresh',
      'custom.export': 'Export',
      'custom.filter': 'Filter',
      'custom.clearFilter': 'Clear Filter'
    }
  };
  
  const fullyCustomPageCode = generateCompletePage(customConfig);
  return fullyCustomPageCode;
};

// 使用示例
console.log('=== 表格頁面代碼生成器使用示例 ===');

console.log('\n1. 產品管理頁面:');
console.log(generateProductPage());

console.log('\n2. 用戶管理頁面:');
console.log(generateUserPage());

console.log('\n3. 訂單管理頁面:');
console.log(generateOrderPage());

console.log('\n4. 客戶管理頁面:');
console.log(generateCustomerPage());

console.log('\n5. 自定義標籤頁面:');
console.log(generateCustomTagPage());

console.log('\n6. 預設企業級頁面:');
console.log(generateDefaultPage());

console.log('\n7. 完全自定義頁面:');
console.log(generateFullyCustomPage());

export default {
  generateProductPage,
  generateUserPage,
  generateOrderPage,
  generateCustomerPage,
  generateCustomTagPage,
  generateDefaultPage,
  generateFullyCustomPage
};
