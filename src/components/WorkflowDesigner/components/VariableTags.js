import React from 'react';
import { Form, Tag } from 'antd';
import { processVariableReferences } from '../utils';

// 變量標籤組件
const VariableTags = ({ processVariables, form, fieldName, onUpdate, t }) => (
  <Form.Item label={t('workflowDesigner.availableVariables')}>
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
            const currentValue = form.getFieldValue(fieldName) || '';
            const newValue = currentValue + `\${${pv.variableName}}`;
            form.setFieldValue(fieldName, newValue);
            onUpdate({ [fieldName]: newValue });
          }}
        >
          {pv.variableName} ({pv.dataType})
        </Tag>
      ))}
    </div>
  </Form.Item>
);

export default VariableTags;
