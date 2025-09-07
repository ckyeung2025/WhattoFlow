import React from 'react';
import { Modal, Select } from 'antd';

// 默認路徑選擇 Modal
const DefaultPathModal = ({
  visible,
  onCancel,
  selectedNode,
  availablePaths = [],
  onSelectPath,
  t
}) => {
  return (
    <Modal
      title={t('workflowDesigner.selectDefaultPath')}
      open={visible}
      onCancel={onCancel}
      width={500}
      footer={null}
      destroyOnClose
    >
      <div style={{ marginBottom: '16px' }}>
        <p style={{ marginBottom: '16px', color: '#666' }}>
          {t('workflowDesigner.defaultPathDescription')}
        </p>
        <Select 
          value={selectedNode?.data?.defaultPath} 
          placeholder={t('workflowDesigner.selectDefaultPath')}
          style={{ width: '100%' }}
          onChange={(value) => {
            onSelectPath(value);
            onCancel();
          }}
        >
          {availablePaths.map(path => (
            <Select.Option key={path.id} value={path.id}>
              {path.label}
            </Select.Option>
          ))}
        </Select>
      </div>
    </Modal>
  );
};

export default DefaultPathModal;
