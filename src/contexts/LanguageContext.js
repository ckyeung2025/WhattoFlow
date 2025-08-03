import React, { createContext, useContext, useState, useEffect } from 'react';
import zhTC from '../locales/zh-TC';
import zhSC from '../locales/zh-SC';
import en from '../locales/en';

const locales = {
  'zh-TC': zhTC,
  'zh-SC': zhSC,
  'en': en
};

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('zh-TC');
  const [translations, setTranslations] = useState(locales['zh-TC']);

  useEffect(() => {
    // 從 localStorage 讀取語言設定
    const savedLanguage = localStorage.getItem('language') || 'zh-TC';
    setCurrentLanguage(savedLanguage);
    setTranslations(locales[savedLanguage]);
  }, []);

  const changeLanguage = (language) => {
    setCurrentLanguage(language);
    setTranslations(locales[language]);
    localStorage.setItem('language', language);
  };

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value === 'string') {
      // 替換參數
      return value.replace(/\{(\w+)\}/g, (match, paramName) => {
        return params[paramName] || match;
      });
    }

    return value;
  };

  const value = {
    currentLanguage,
    changeLanguage,
    t,
    availableLanguages: Object.keys(locales)
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}; 