import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Table, 
  Input, 
  Switch, 
  Button, 
  Space, 
  Typography, 
  message,
  Card,
  Divider,
  Tag,
  Empty
} from 'antd';
import { SettingOutlined, SaveOutlined, EyeOutlined } from '@ant-design/icons';
import { useLanguage } from '../../contexts/LanguageContext';

const { Title, Text } = Typography;

const EFormFieldDisplaySetting = ({ 
  visible, 
  onClose, 
  htmlContent, 
  onSave, 
  initialSettings = [] 
}) => {
  const { t } = useLanguage();
  const [fieldSettings, setFieldSettings] = useState([]);
  const [loading, setLoading] = useState(false);

  // 掃描 DOM 樹提取表單字段
  const scanFormFields = (htmlContent) => {
    if (!htmlContent) return [];
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const fields = [];
    
    // 掃描各種輸入元素
    const inputSelectors = [
      'input[type="text"]',
      'input[type="email"]', 
      'input[type="tel"]',
      'input[type="number"]',
      'input[type="date"]',
      'input[type="time"]',
      'input[type="password"]',
      'textarea',
      'select',
      'input[type="radio"]',
      'input[type="checkbox"]'
    ];
    
    inputSelectors.forEach(selector => {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((element, index) => {
        const fieldId = element.id || element.name || `${selector.replace(/[\[\]]/g, '')}_${index}`;
        const fieldType = element.tagName.toLowerCase();
        const inputType = element.type || '';
        const label = getFieldLabel(element);
        
        // 避免重複
        if (!fields.find(f => f.fieldId === fieldId)) {
          fields.push({
            fieldId,
            fieldType,
            inputType,
            originalLabel: label,
            displayLabel: label,
            showInList: true,
            order: fields.length
          });
        }
      });
    });
    
    return fields;
  };

  // 獲取字段標籤
  const getFieldLabel = (element) => {
    // 嘗試從 label 元素獲取
    const label = element.closest('label')?.textContent?.trim();
    if (label) return label;
    
    // 嘗試從 placeholder 獲取
    if (element.placeholder) return element.placeholder;
    
    // 嘗試從 name 屬性獲取
    if (element.name) return element.name;
    
    // 嘗試從 id 獲取
    if (element.id) return element.id;
    
    return t('eformDesigner.fieldDisplaySetting.messages.unnamedField');
  };

  // 初始化字段設定
  useEffect(() => {
    console.log('🔍 EFormFieldDisplaySetting useEffect 觸發:', { visible, htmlContent: !!htmlContent, initialSettings });
    if (visible && htmlContent) {
      const scannedFields = scanFormFields(htmlContent);
      console.log('🔍 掃描到的字段:', scannedFields);
      
      // 如果有初始設定，合併數據
      if (initialSettings.length > 0) {
        console.log('🔍 合併初始設定:', initialSettings);
        const mergedFields = scannedFields.map(field => {
          const existingSetting = initialSettings.find(s => s.fieldId === field.fieldId);
          return existingSetting ? { ...field, ...existingSetting } : field;
        });
        console.log('🔍 合併後的字段:', mergedFields);
        setFieldSettings(mergedFields);
      } else {
        console.log('🔍 沒有初始設定，使用掃描結果');
        setFieldSettings(scannedFields.map(field => ({
          ...field,
          showInList: false
        })));
      }
    }
  }, [visible, htmlContent, initialSettings]);

  // 保存設定
  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(fieldSettings);
      message.success(t('eformDesigner.fieldDisplaySetting.messages.saveSuccess'));
      onClose();
    } catch (error) {
      message.error(t('eformDesigner.fieldDisplaySetting.messages.saveFailed') + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 表格列定義
  const columns = [
    {
      title: t('eformDesigner.fieldDisplaySetting.tableColumns.fieldType'),
      dataIndex: 'fieldType',
      key: 'fieldType',
      width: 100,
      render: (type, record) => (
        <Tag color={
          type === 'input' ? 'blue' :
          type === 'textarea' ? 'green' :
          type === 'select' ? 'orange' : 'default'
        }>
          {type === 'input' ? `${record.inputType}` : type}
        </Tag>
      )
    },
    {
      title: t('eformDesigner.fieldDisplaySetting.tableColumns.originalLabel'),
      dataIndex: 'originalLabel',
      key: 'originalLabel',
      width: 150,
      ellipsis: true
    },
    {
      title: t('eformDesigner.fieldDisplaySetting.tableColumns.displayLabel'),
      dataIndex: 'displayLabel',
      key: 'displayLabel',
      width: 200,
      render: (text, record, index) => (
        <Input
          value={text}
          onChange={(e) => {
            const newSettings = [...fieldSettings];
            newSettings[index].displayLabel = e.target.value;
            setFieldSettings(newSettings);
          }}
          placeholder={t('eformDesigner.fieldDisplaySetting.placeholders.displayLabel')}
        />
      )
    },
    {
      title: t('eformDesigner.fieldDisplaySetting.tableColumns.showInList'),
      dataIndex: 'showInList',
      key: 'showInList',
      width: 120,
      render: (checked, record, index) => (
        <Switch
          checked={checked}
          onChange={(checked) => {
            const newSettings = [...fieldSettings];
            newSettings[index].showInList = checked;
            setFieldSettings(newSettings);
          }}
        />
      )
    },
    {
      title: t('eformDesigner.fieldDisplaySetting.tableColumns.fieldId'),
      dataIndex: 'fieldId',
      key: 'fieldId',
      width: 150,
      ellipsis: true,
      render: (text) => (
        <Text code style={{ fontSize: '12px' }}>{text}</Text>
      )
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          <span>{t('eformDesigner.fieldDisplaySetting.modalTitle')}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width="90%"
      style={{ top: 20 }}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('eformDesigner.fieldDisplaySetting.buttons.cancel')}
        </Button>,
        <Button 
          key="save" 
          type="primary" 
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSave}
        >
          {t('eformDesigner.fieldDisplaySetting.buttons.confirm')}
        </Button>
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          {t('eformDesigner.fieldDisplaySetting.helperText')}
        </Text>
      </div>
      
      <Table
        columns={columns}
        dataSource={fieldSettings}
        rowKey="fieldId"
        pagination={false}
        size="small"
        scroll={{ y: 400 }}
        locale={{
          emptyText: t('eformDesigner.fieldDisplaySetting.messages.noFieldsFound')
        }}
      />
    </Modal>
  );
};

export default EFormFieldDisplaySetting;
