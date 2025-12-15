import React from 'react';
import { Form, Tag } from 'antd';

/**
 * 流程變量顯示組件
 * 用於顯示可用的流程變量，並支持點擊插入到指定字段
 * 
 * @param {Object} props
 * @param {Array} props.processVariables - 流程變量列表
 * @param {Function} props.form - Ant Design Form 實例
 * @param {Function} props.t - 翻譯函數
 * @param {string|Array} props.targetFieldName - 目標字段名稱（可以是字符串或數組，如 'message' 或 ['emailConfig', 'body']）
 * @param {Function} props.onInsert - 自定義插入處理函數，如果提供則使用此函數，否則使用默認邏輯
 * @param {boolean} props.showLabel - 是否顯示標籤，默認 true
 */
const ProcessVariablesDisplay = ({
  processVariables,
  form,
  t,
  targetFieldName = 'message',
  onInsert = null,
  showLabel = true,
}) => {
  if (!processVariables || processVariables.length === 0) {
    return null;
  }

  const handleVariableClick = (variableName) => {
    if (onInsert) {
      // 使用自定義插入邏輯
      onInsert(variableName);
    } else {
      // 默認插入邏輯
      const currentValue = form.getFieldValue(targetFieldName) || '';
      const newValue = currentValue + `\${${variableName}}`;
      form.setFieldValue(targetFieldName, newValue);
    }
  };

  return (
    <Form.Item label={showLabel ? t('workflowDesigner.availableVariables') : null}>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
        {t('workflowDesigner.variableSyntaxHelp')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {processVariables.map(pv => (
          <Tag 
            key={pv.id} 
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleVariableClick(pv.variableName);
            }}
          >
            {pv.variableName} ({pv.dataType})
          </Tag>
        ))}
      </div>
    </Form.Item>
  );
};

export default ProcessVariablesDisplay;






