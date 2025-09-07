import React from 'react';
import { Form, Select } from 'antd';

// 流程變量選擇組件
const ProcessVariableSelect = ({ 
  label, 
  name, 
  placeholder, 
  processVariables, 
  allowClear = true,
  ...props 
}) => (
  <Form.Item label={label} name={name} {...props}>
    <Select
      placeholder={placeholder}
      allowClear={allowClear}
    >
      {processVariables.map(pv => (
        <Select.Option key={pv.id} value={pv.variableName}>
          {pv.variableName} ({pv.dataType})
        </Select.Option>
      ))}
    </Select>
  </Form.Item>
);

export default ProcessVariableSelect;
