import React from 'react';
import { Modal } from 'antd';
import RecipientSelector from '../components/RecipientSelector';
import { useLanguage } from '../../../contexts/LanguageContext';

// 收件人選擇模態框
const RecipientModal = ({ 
  visible, 
  onCancel, 
  onSelect, 
  value,
  allowMultiple = true,
  placeholder = '選擇收件人',
  recipientDetails // 新增：詳細的選擇信息
}) => {
  console.log('🚀 RecipientModal 組件已渲染');
  console.log('📋 RecipientModal props:', { visible, allowMultiple, placeholder });
  
  const { t } = useLanguage();

  const handleSelect = (selectedValue, detailedValue) => {
    console.log('📤 RecipientModal - 收到選擇值:', selectedValue);
    console.log('📤 RecipientModal - 收到詳細值:', detailedValue);
    onSelect(selectedValue, detailedValue);
    onCancel();
  };

  return (
    <Modal
      title={t('workflowDesigner.selectRecipients')}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      <RecipientSelector
        value={value}
        onChange={handleSelect}
        placeholder={placeholder}
        allowMultiple={allowMultiple}
        recipientDetails={recipientDetails}
        t={t}
      />
    </Modal>
  );
};

export default RecipientModal;
