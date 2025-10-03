import React, { useState } from 'react';
import { Tabs, Card } from 'antd';
import {
  MessageOutlined, CloudOutlined, DatabaseOutlined
} from '@ant-design/icons';
import MetaTemplatePanel from './MetaTemplatePanel';
import InternalTemplatePanel from './InternalTemplatePanel';
import { useLanguage } from '../contexts/LanguageContext';

const WhatsAppTemplateList = () => {
  const [activeTab, setActiveTab] = useState('internal');
  const { t } = useLanguage();

  const tabItems = [
    {
      key: 'internal',
      label: (
        <span>
          <DatabaseOutlined />
          {t('whatsappTemplate.templateList.internalTemplates')}
        </span>
      ),
      children: <InternalTemplatePanel />
    },
    {
      key: 'meta',
      label: (
        <span>
          <CloudOutlined />
          {t('whatsappTemplate.templateList.metaOfficialTemplates')}
        </span>
      ),
      children: <MetaTemplatePanel />
    }
  ];

  return (
    <div style={{ padding: '8px' }}>
      <Card 
        bodyStyle={{ padding: '12px 12px 8px 12px' }} 
        style={{ boxShadow: 'none', borderRadius: 8, margin: 0 }}
      >
        {/* 標題 */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>
            <MessageOutlined style={{ marginRight: '8px' }} />
            {t('menu.whatsappTemplates')}
          </h2>
          <p style={{ color: '#666', margin: '8px 0 0 0', fontSize: '14px' }}>
            {t('whatsappTemplate.templateList.description')}
          </p>
        </div>

        {/* Tabs 分頁 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          type="card"
          size="large"
        />
      </Card>
    </div>
  );
};

export default WhatsAppTemplateList;

