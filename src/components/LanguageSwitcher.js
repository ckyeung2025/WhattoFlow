import React from 'react';
import { Select } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher = () => {
  const { currentLanguage, changeLanguage, t } = useLanguage();

  const languageOptions = [
    { value: 'zh-TC', label: t('language.zhTC') },
    { value: 'zh-SC', label: t('language.zhSC') },
    { value: 'en', label: t('language.en') }
  ];

  return (
    <Select
      value={currentLanguage}
      onChange={changeLanguage}
      style={{ width: 120 }}
      options={languageOptions}
      suffixIcon={<GlobalOutlined />}
    />
  );
};

export default LanguageSwitcher; 