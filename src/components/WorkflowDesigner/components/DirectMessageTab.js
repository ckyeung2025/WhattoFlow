import React from 'react';
import { Form, Input } from 'antd';
import ProcessVariablesDisplay from './ProcessVariablesDisplay';

const { TextArea } = Input;

/**
 * 直接訊息輸入 Tab 組件
 * 
 * @param {Object} props
 * @param {Function} props.form - Ant Design Form 實例
 * @param {Function} props.t - 翻譯函數
 * @param {Array} props.processVariables - 流程變量列表
 * @param {string|Array} props.fieldName - 字段名稱，默認 'message'，可以是數組如 ['prefix', 'message']
 * @param {string|null} props.label - 標籤文本，null 表示不顯示標籤
 * @param {string} props.placeholder - 佔位符文本
 * @param {number} props.rows - 輸入框行數，默認 3
 * @param {boolean} props.showProcessVariables - 是否顯示流程變量，默認 true
 * @param {Function} props.onChange - 值變更回調函數
 * @param {Function} props.onVariableInsert - 自定義變量插入處理函數
 * @param {React.ReactNode} props.customContent - 自定義內容，如果提供則完全替換默認內容
 * @param {Object} props.extraProps - 額外的 TextArea 屬性
 * @param {string} props.mode - 模式：'form' 或 'modal'，默認 'form'
 * @param {string} props.description - 描述文本（用於 Modal 模式）
 * @param {string} props.tip - 提示文本（用於 Modal 模式）
 * @param {string|number} props.value - 當前值（用於 Modal 模式，不使用 Form.Item）
 */
const DirectMessageTab = ({
  form,
  t,
  processVariables = [],
  fieldName = 'message',
  label = null,
  placeholder = null,
  rows = 3,
  showProcessVariables = true,
  onChange = null,
  onVariableInsert = null,
  customContent = null,
  extraProps = {},
  mode = 'form', // 'form' 或 'modal'
  description = null,
  tip = null,
  value = null,
}) => {
  // 如果提供了自定義內容，直接返回
  if (customContent) {
    return customContent;
  }

  // 處理 placeholder：如果包含點（.），則視為語言鍵並翻譯
  let finalPlaceholder;
  if (placeholder && placeholder.includes('.')) {
    finalPlaceholder = t(placeholder);
  } else {
    finalPlaceholder = placeholder || t('workflowDesigner.messageWithVariablesPlaceholder');
  }

  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  const handleVariableInsert = (variableName) => {
    if (onVariableInsert) {
      onVariableInsert(variableName);
    } else {
      // 默認邏輯
      if (mode === 'modal' && value !== null) {
        // Modal 模式：直接使用 value
        const newValue = value + `\${${variableName}}`;
        if (onChange) {
          onChange(newValue);
        }
      } else {
        // Form 模式：使用 form.getFieldValue
        const currentValue = form.getFieldValue(fieldName) || '';
        const newValue = currentValue + `\${${variableName}}`;
        form.setFieldValue(fieldName, newValue);
        if (onChange) {
          onChange(newValue);
        }
      }
    }
  };

  if (mode === 'modal') {
    // Modal 模式：不使用 Form.Item
    return (
      <div style={{ padding: '16px 0' }}>
        {description && (
          <div style={{ marginBottom: 8, fontSize: 14, color: '#666' }}>
            {description}
          </div>
        )}
        <TextArea
          value={value}
          onChange={handleChange}
          placeholder={finalPlaceholder}
          rows={rows}
          {...extraProps}
        />
        {tip && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            💡 {tip}
          </div>
        )}
        {showProcessVariables && (
          <ProcessVariablesDisplay
            processVariables={processVariables}
            form={form}
            t={t}
            targetFieldName={fieldName}
            onInsert={handleVariableInsert}
            showLabel={true}
          />
        )}
      </div>
    );
  }

  // Form 模式：使用 Form.Item
  return (
    <>
      <Form.Item 
        label={label === null ? null : (label || t('workflow.message'))} 
        name={fieldName}
      >
        <Input.TextArea 
          rows={rows} 
          placeholder={finalPlaceholder}
          onChange={handleChange}
          {...extraProps}
        />
      </Form.Item>
      
      {showProcessVariables && (
        <ProcessVariablesDisplay
          processVariables={processVariables}
          form={form}
          t={t}
          targetFieldName={fieldName}
          onInsert={handleVariableInsert}
        />
      )}
    </>
  );
};

export default DirectMessageTab;

