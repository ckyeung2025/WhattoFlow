/**
 * 動態表單字段列生成器
 * 根據 fieldDisplaySettings 動態生成 Ant Design Table 列定義
 */

import React, { useMemo } from 'react';
import { parseFormFieldValue } from './FormFieldValueParser';

/**
 * 解析 fieldDisplaySettings
 * 支持字符串 JSON 或數組格式
 * @param {string|Array} fieldDisplaySettings - 字段顯示設定
 * @returns {Array} 解析後的字段設定數組
 */
export const parseFieldDisplaySettings = (fieldDisplaySettings) => {
  if (!fieldDisplaySettings) {
    return [];
  }

  if (Array.isArray(fieldDisplaySettings)) {
    return fieldDisplaySettings;
  }

  if (typeof fieldDisplaySettings === 'string') {
    try {
      return JSON.parse(fieldDisplaySettings);
    } catch (error) {
      console.warn('解析 fieldDisplaySettings JSON 失敗:', error);
      return [];
    }
  }

  return [];
};

/**
 * 從記錄列表中提取所有需要顯示的字段
 * @param {Array} records - 數據記錄列表
 * @returns {Array} 所有需要顯示的字段設定（已去重並排序）
 */
export const extractVisibleFields = (records) => {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  const fieldMap = new Map();

  records.forEach(record => {
    const settings = parseFieldDisplaySettings(record.fieldDisplaySettings);
    const visibleFields = settings.filter(f => f.showInList === true);

    visibleFields.forEach(field => {
      const fieldId = field.fieldId;
      if (!fieldMap.has(fieldId)) {
        // 使用第一個遇到的字段設定（包括 displayLabel）
        fieldMap.set(fieldId, {
          fieldId: field.fieldId,
          displayLabel: field.displayLabel || field.originalLabel || fieldId,
          order: field.order || 0,
          fieldType: field.fieldType,
          inputType: field.inputType
        });
      }
    });
  });

  // 轉換為數組並按 order 排序
  return Array.from(fieldMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * 生成動態表單字段列定義
 * @param {Array} records - 數據記錄列表
 * @param {Array} baseColumns - 基礎列定義（可選）
 * @returns {Array} 完整的列定義數組（基礎列 + 動態列）
 */
export const generateDynamicColumns = (records, baseColumns = []) => {
  if (!Array.isArray(records) || records.length === 0) {
    return baseColumns;
  }

  const visibleFields = extractVisibleFields(records);

  if (visibleFields.length === 0) {
    return baseColumns;
  }

  // 生成動態列
  const dynamicColumns = visibleFields.map(field => ({
    title: field.displayLabel,
    key: `dynamic_${field.fieldId}`,
    dataIndex: `dynamic_${field.fieldId}`,
    width: 150,
    render: (_, record) => {
      const fieldValue = parseFormFieldValue(record, field.fieldId);
      return fieldValue || '-';
    },
    sorter: (a, b) => {
      const valueA = parseFormFieldValue(a, field.fieldId) || '';
      const valueB = parseFormFieldValue(b, field.fieldId) || '';
      return valueA.localeCompare(valueB);
    }
  }));

  // 合併基礎列和動態列
  return [...baseColumns, ...dynamicColumns];
};

/**
 * React Hook：生成動態列（帶緩存）
 * @param {Array} records - 數據記錄列表
 * @param {Array} baseColumns - 基礎列定義
 * @returns {Array} 完整的列定義數組
 */
export const useDynamicColumns = (records, baseColumns = []) => {
  return useMemo(() => {
    return generateDynamicColumns(records, baseColumns);
  }, [records, baseColumns]);
};

export default {
  parseFieldDisplaySettings,
  extractVisibleFields,
  generateDynamicColumns,
  useDynamicColumns
};

