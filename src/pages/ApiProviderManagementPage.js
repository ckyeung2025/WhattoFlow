import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, message, Spin, Tabs, Typography, Space, Row, Col } from 'antd';
import { ReloadOutlined, ApiOutlined } from '@ant-design/icons';
import ApiProviderCard from '../components/ApiProviders/ApiProviderCard';
import ApiProviderSettingsModal from '../components/ApiProviders/ApiProviderSettingsModal';
import { useLanguage } from '../contexts/LanguageContext';
import './ApiProviderManagementPage.css';

const { Paragraph, Title, Text } = Typography;

const ApiProviderManagementPage = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState([]);
  const [activeTab, setActiveTab] = useState('AI');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFetching, setModalFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error(t('common.loginRequired'));
        setProviders([]);
        return;
      }

      const response = await fetch('/api/apiproviders/company', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load api providers', error);
      message.error(t('apiProviders.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const groupedProviders = useMemo(() => {
    return providers.reduce((acc, provider) => {
      const key = provider.category || 'Other';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(provider);
      return acc;
    }, {});
  }, [providers]);

  useEffect(() => {
    if (providers.length > 0) {
      const categories = Object.keys(groupedProviders);
      if (!categories.includes(activeTab)) {
        setActiveTab(categories[0]);
      }
    }
  }, [providers, groupedProviders, activeTab]);

  const handleConfigure = async (provider) => {
    setModalOpen(true);
    setModalFetching(true);

    console.log('[ApiProviders] Opening modal for provider', provider.providerKey);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error(t('common.loginRequired'));
        setModalOpen(false);
        return;
      }

      console.log('[ApiProviders] Fetching provider detail', provider.providerKey);

      const response = await fetch(`/api/apiproviders/company/${provider.providerKey}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.warn('[ApiProviders] Detail request failed', response.status);
        throw new Error(`HTTP ${response.status}`);
      }

      const detail = await response.json();
      console.log('[ApiProviders] Detail loaded', detail);
      setSelectedProvider(detail);
    } catch (error) {
      console.error('Failed to load provider detail', error);
      message.error(t('apiProviders.messages.loadDetailFailed'));
      setModalOpen(false);
      setSelectedProvider(null);
    } finally {
      setModalFetching(false);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedProvider(null);
  };

  const handleModalSubmit = async (values) => {
    if (!selectedProvider) {
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error(t('common.loginRequired'));
        return;
      }

      const response = await fetch(`/api/apiproviders/company/${selectedProvider.providerKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          if (payload?.error) {
            errorMessage = payload.error;
          }
        } catch (parseError) {
          // ignore JSON parse error and use default message
        }
        throw new Error(errorMessage);
      }

      const updated = await response.json();
      setProviders(prev => prev.map(item => (item.providerKey === updated.providerKey ? updated : item)));
      message.success(t('apiProviders.messages.saveSuccess'));
      setModalOpen(false);
      setSelectedProvider(null);
    } catch (error) {
      console.error('Failed to save provider', error);
      message.error(error?.message || t('apiProviders.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const tabItems = useMemo(() => {
    const categories = Object.keys(groupedProviders);
    if (categories.length === 0) {
      return [];
    }

    return categories.map(category => ({
      key: category,
      label: t(`apiProviders.category.${category.toLowerCase()}`, category),
      children: (
        <div className="api-provider-grid">
          {groupedProviders[category].map(provider => (
            <ApiProviderCard
              key={provider.providerKey}
              provider={provider}
              onConfigure={handleConfigure}
              t={t}
            />
          ))}
        </div>
      )
    }));
  }, [groupedProviders, t]);

  return (
    <div className="api-provider-page">
      <Row justify="space-between" align="middle" className="api-provider-page__header">
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchProviders} disabled={loading}>
              {t('apiProviders.actions.refresh')}
            </Button>
          </Space>
        </Col>
        <Col>
          <Space align="center" size="large">
            <div className="api-provider-page__icon">
              <ApiOutlined style={{ fontSize: 32, color: '#722ed1' }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <Title level={2} style={{ margin: 0 }}>{t('apiProviders.pageTitle')}</Title>
              <Text type="secondary" className="api-provider-page__description">
                {t('apiProviders.pageDescription')}
              </Text>
            </div>
          </Space>
        </Col>
      </Row>

      {loading ? (
        <Spin />
      ) : tabItems.length > 0 ? (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('apiProviders.empty')}>
          <Button icon={<ReloadOutlined />} onClick={fetchProviders}>
            {t('apiProviders.actions.refresh')}
          </Button>
        </Empty>
      )}

      <ApiProviderSettingsModal
        open={modalOpen}
        provider={selectedProvider}
        fetching={modalFetching}
        onCancel={handleModalClose}
        onSubmit={handleModalSubmit}
        loading={saving}
        t={t}
      />
    </div>
  );
};

export default ApiProviderManagementPage;

