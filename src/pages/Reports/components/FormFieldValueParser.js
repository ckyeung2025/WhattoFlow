/**
 * 表單字段值解析器
 * 從 filledHtmlCode 中解析字段值（使用 DOMParser）
 * 參考 PendingTasksPage.js 的 getFieldValue 函數實現
 */

/**
 * 從記錄中解析指定字段的值
 * @param {Object} record - 數據記錄（包含 filledHtmlCode, formData, htmlCode）
 * @param {string} fieldId - 字段 ID
 * @returns {string|null} 字段值，如果找不到則返回 null
 */
export const parseFormFieldValue = (record, fieldId) => {
  if (!record || !fieldId) {
    return null;
  }

  // 優先從 FilledHtmlCode 中解析字段值
  if (record.filledHtmlCode) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(record.filledHtmlCode, 'text/html');
      const element = doc.querySelector(`#${fieldId}`) || doc.querySelector(`[name="${fieldId}"]`);
      
      if (element) {
        // 處理不同類型的輸入元素
        if (element.tagName === 'INPUT') {
          if (element.type === 'checkbox' || element.type === 'radio') {
            return element.checked ? (element.value || '✓') : null;
          }
          return element.value || null;
        } else if (element.tagName === 'SELECT') {
          const selectedOption = element.options[element.selectedIndex];
          return selectedOption ? selectedOption.textContent : null;
        } else if (element.tagName === 'TEXTAREA') {
          return element.textContent || element.value || null;
        }
      }
    } catch (error) {
      console.warn('解析 FilledHtmlCode 字段值失敗:', error);
    }
  }

  // 備用：從表單數據中獲取字段值
  if (record.formData && record.formData[fieldId]) {
    return record.formData[fieldId];
  }

  // 備用：從 htmlCode 中解析（如果 filledHtmlCode 不存在）
  if (record.htmlCode && !record.filledHtmlCode) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(record.htmlCode, 'text/html');
      const element = doc.querySelector(`#${fieldId}`) || doc.querySelector(`[name="${fieldId}"]`);
      
      if (element) {
        if (element.tagName === 'INPUT') {
          if (element.type === 'checkbox' || element.type === 'radio') {
            return element.checked ? (element.value || '✓') : null;
          }
          return element.value || null;
        } else if (element.tagName === 'SELECT') {
          const selectedOption = element.options[element.selectedIndex];
          return selectedOption ? selectedOption.textContent : null;
        } else if (element.tagName === 'TEXTAREA') {
          return element.textContent || element.value || null;
        }
      }
    } catch (error) {
      console.warn('解析 htmlCode 字段值失敗:', error);
    }
  }

  return null;
};

/**
 * 批量解析多個字段的值
 * @param {Object} record - 數據記錄
 * @param {string[]} fieldIds - 字段 ID 數組
 * @returns {Object} 字段值對象，key 為 fieldId，value 為字段值
 */
export const parseMultipleFieldValues = (record, fieldIds) => {
  const result = {};
  if (!record || !Array.isArray(fieldIds)) {
    return result;
  }

  fieldIds.forEach(fieldId => {
    result[fieldId] = parseFormFieldValue(record, fieldId);
  });

  return result;
};

export default parseFormFieldValue;

