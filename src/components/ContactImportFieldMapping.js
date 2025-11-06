import React from 'react';
import { Form, Select, Card } from 'antd';
import { useLanguage } from '../contexts/LanguageContext';

const { Option } = Select;

/**
 * 可復用的聯絡人匯入字段映射組件
 * @param {Object} props
 * @param {Object} props.form - Ant Design Form 實例
 * @param {Array} props.columns - 可用於映射的列（格式：[{ title, dataIndex, key }]）
 * @param {Array} props.groups - 廣播群組列表（可選）
 * @param {Array} props.hashtags - 標籤主檔列表（可選）
 */
const ContactImportFieldMapping = ({ form, columns = [], groups = [], hashtags = [] }) => {
  const { t } = useLanguage();

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      <Form form={form} layout="vertical">
        <Form.Item label={t('contactImport.name')} name="name">
          <Select placeholder={t('contactImport.selectColumn')}>
            {columns.map(col => (
              <Option key={col.dataIndex} value={col.dataIndex}>
                {col.title || col.dataIndex}
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('contactImport.title')} name="title">
          <Select placeholder={t('contactImport.selectColumn')} allowClear>
            {columns.map(col => (
              <Option key={col.dataIndex} value={col.dataIndex}>
                {col.title || col.dataIndex}
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('contactImport.occupation')} name="occupation">
          <Select placeholder={t('contactImport.selectColumn')} allowClear>
            {columns.map(col => (
              <Option key={col.dataIndex} value={col.dataIndex}>
                {col.title || col.dataIndex}
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('contactImport.position')} name="position">
          <Select placeholder={t('contactImport.selectColumn')} allowClear>
            {columns.map(col => (
              <Option key={col.dataIndex} value={col.dataIndex}>
                {col.title || col.dataIndex}
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('contactImport.whatsappNumber')} name="whatsappNumber">
          <Select placeholder={t('contactImport.selectColumn')} allowClear>
            {columns.map(col => (
              <Option key={col.dataIndex} value={col.dataIndex}>
                {col.title || col.dataIndex}
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('contactImport.email')} name="email">
          <Select placeholder={t('contactImport.selectColumn')} allowClear>
            {columns.map(col => (
              <Option key={col.dataIndex} value={col.dataIndex}>
                {col.title || col.dataIndex}
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('contactImport.companyName')} name="companyName">
          <Select placeholder={t('contactImport.selectColumn')} allowClear>
            {columns.map(col => (
              <Option key={col.dataIndex} value={col.dataIndex}>
                {col.title || col.dataIndex}
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('contactImport.department')} name="department">
          <Select placeholder={t('contactImport.selectColumn')} allowClear>
            {columns.map(col => (
              <Option key={col.dataIndex} value={col.dataIndex}>
                {col.title || col.dataIndex}
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('contactImport.hashtags')} name="hashtags">
          <Select 
            placeholder={t('contactImport.selectColumn')} 
            allowClear
            mode="multiple"
            showSearch
            filterOption={(input, option) =>
              (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {Array.isArray(hashtags) && hashtags.length > 0 ? (
              hashtags.map(tag => (
                <Option key={tag.id} value={tag.name}>
                  {tag.name}
                </Option>
              ))
            ) : (
              columns.map(col => (
                <Option key={col.dataIndex} value={col.dataIndex}>
                  {col.title || col.dataIndex}
                </Option>
              ))
            )}
          </Select>
        </Form.Item>
        
        {Array.isArray(groups) && groups.length > 0 && (
          <Form.Item label={t('contactImport.broadcastGroup')} name="broadcastGroupId">
            <Select placeholder={t('contactImport.selectGroup')}>
              {groups.map(group => (
                <Option key={group.id} value={group.id}>
                  {group.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}
      </Form>
    </div>
  );
};

export default ContactImportFieldMapping;

