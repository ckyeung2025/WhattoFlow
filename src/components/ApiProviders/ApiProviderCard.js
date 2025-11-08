import React from 'react';
import { Card, Avatar, Tag, Tooltip } from 'antd';
import {
  ApiOutlined,
  LockOutlined,
  UnlockOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';

const assetMap = {
  xai: '/assets/API_Icons/grok-ai-icon.png',
  grok: '/assets/API_Icons/grok-ai-icon.png',
  openai: '/assets/API_Icons/openai.png',
  deepseek: '/assets/API_Icons/icons8-deepseek-480.png',
  copilot: '/assets/API_Icons/vecteezy_copilot-icon-transparent-background_46861635.png',
  gemini: '/assets/API_Icons/google-gemini-icon.png',
  'google-docs': '/assets/icon-google-docs.svg'
};

const ApiProviderCard = ({ provider, onConfigure, t }) => {
  const normalizedIconKey = provider.iconName?.toLowerCase() || provider.providerKey?.toLowerCase();
  const iconSrc = normalizedIconKey ? assetMap[normalizedIconKey] : null;
  const fallbackInitials = provider.displayName
    ? provider.displayName
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AI';

  return (
    <Card
      hoverable
      className="api-provider-card"
      onClick={() => onConfigure(provider)}
    >
      <div className="api-provider-card__header">
        <Avatar
          size={64}
          className="api-provider-card__icon"
          src={iconSrc || undefined}
          alt={provider.displayName}
        >
          {iconSrc ? null : fallbackInitials}
        </Avatar>
        <div className="api-provider-card__title">
          <div className="api-provider-card__name">{provider.displayName}</div>
          <div className="api-provider-card__category">{t(`apiProviders.category.${provider.category.toLowerCase()}`)}</div>
        </div>
      </div>

      <div className="api-provider-card__body">
        <div className="api-provider-card__description" title={provider.description}>
          {provider.description || t('apiProviders.noDescription')}
        </div>

        <div className="api-provider-card__meta">
          <Tooltip title={provider.active ? t('apiProviders.status.activeTip') : t('apiProviders.status.inactiveTip')}>
            <Tag color={provider.active ? 'success' : 'default'} icon={provider.active ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
              {provider.active ? t('apiProviders.status.active') : t('apiProviders.status.inactive')}
            </Tag>
          </Tooltip>

          <Tooltip title={provider.hasApiKey ? t('apiProviders.apiKey.setTip') : t('apiProviders.apiKey.missingTip')}>
            <Tag icon={provider.hasApiKey ? <LockOutlined /> : <UnlockOutlined />} color={provider.hasApiKey ? 'processing' : 'warning'}>
              {provider.hasApiKey ? t('apiProviders.apiKey.set') : t('apiProviders.apiKey.missing')}
            </Tag>
          </Tooltip>
        </div>

        <div className="api-provider-card__footer">
          <span className="api-provider-card__action">{t('apiProviders.configure')}</span>
        </div>
      </div>
    </Card>
  );
};

export default ApiProviderCard;

