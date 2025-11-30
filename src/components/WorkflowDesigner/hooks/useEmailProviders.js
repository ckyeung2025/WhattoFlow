import { useState, useEffect } from 'react';

/**
 * Hook 用於載入 Email Server API Providers
 * @param {boolean} enabled - 是否啟用載入
 * @returns {{ emailProviders: Array, loadingEmailProviders: boolean }}
 */
export const useEmailProviders = (enabled = true) => {
  const [emailProviders, setEmailProviders] = useState([]);
  const [loadingEmailProviders, setLoadingEmailProviders] = useState(false);

  useEffect(() => {
    if (enabled) {
      loadEmailProviders();
    }
  }, [enabled]);

  const loadEmailProviders = async () => {
    try {
      setLoadingEmailProviders(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setEmailProviders([]);
        return;
      }

      const response = await fetch('/api/apiproviders/company?category=EmailServer', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setEmailProviders(data.filter(p => p.active));
      } else {
        setEmailProviders([]);
      }
    } catch (error) {
      console.error('Failed to load email providers', error);
      setEmailProviders([]);
    } finally {
      setLoadingEmailProviders(false);
    }
  };

  return { emailProviders, loadingEmailProviders };
};





