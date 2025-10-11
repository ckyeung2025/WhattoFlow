import React, { createContext, useContext, useState, useEffect } from 'react';
import zhTC from '../locales/zh-TC';
import zhSC from '../locales/zh-SC';
import en from '../locales/en';
import onboardingZhTC from '../locales/onboarding-zh-TC';
import onboardingZhSC from '../locales/onboarding-zh-SC';
import onboardingEn from '../locales/onboarding-en';

const locales = {
  'zh-TC': { ...zhTC, ...onboardingZhTC },
  'zh-SC': { ...zhSC, ...onboardingZhSC },
  'en': { ...en, ...onboardingEn }
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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 從 localStorage 讀取語言設定
    const savedLanguage = localStorage.getItem('language') || 'zh-TC';
    console.log('LanguageProvider: 初始化語言為', savedLanguage);
    
    // 確保語言文件存在
    if (locales[savedLanguage]) {
      setCurrentLanguage(savedLanguage);
      setTranslations(locales[savedLanguage]);
    } else {
      console.warn(`Language ${savedLanguage} not found, falling back to zh-TC`);
      setCurrentLanguage('zh-TC');
      setTranslations(locales['zh-TC']);
    }
    
    setIsReady(true);
  }, []);

  const changeLanguage = (language) => {
    console.log('LanguageProvider: 切換語言到', language);
    
    if (locales[language]) {
      setCurrentLanguage(language);
      setTranslations(locales[language]);
      localStorage.setItem('language', language);
    } else {
      console.warn(`Language ${language} not found, keeping current language`);
    }
  };

  const t = (key, params = {}) => {
    // 如果翻譯系統還沒準備好，返回鍵值
    if (!isReady) {
      return key;
    }

    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // 只在開發模式下輸出警告，避免生產環境中的重複警告
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Translation key not found: ${key} at step "${k}"`);
        }
        // 嘗試從其他語言文件中獲取翻譯作為回退
        for (const lang of Object.keys(locales)) {
          if (lang !== currentLanguage) {
            let fallbackValue = locales[lang];
            for (const fallbackKey of keys) {
              if (fallbackValue && typeof fallbackValue === 'object' && fallbackKey in fallbackValue) {
                fallbackValue = fallbackValue[fallbackKey];
              } else {
                fallbackValue = null;
                break;
              }
            }
            if (fallbackValue && typeof fallbackValue === 'string') {
              console.log(`Using fallback translation from ${lang} for key: ${key}`);
              return fallbackValue.replace(/\{(\w+)\}/g, (match, paramName) => {
                return params[paramName] || match;
              });
            }
          }
        }
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

  // 調試信息
  useEffect(() => {
    if (isReady) {
      console.log('LanguageProvider: 當前語言', currentLanguage);
      console.log('LanguageProvider: 可用翻譯鍵', Object.keys(translations));
    }
  }, [currentLanguage, translations, isReady]);

  const value = {
    currentLanguage,
    changeLanguage,
    t,
    availableLanguages: Object.keys(locales),
    isReady
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}; 