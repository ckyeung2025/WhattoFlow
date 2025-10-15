import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Space, message, Modal, Input, Tag, Spin, Alert } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

const { TextArea } = Input;

const EFormInstancePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const { t } = useLanguage();

  // 檢查訪問權限（支持 Token 驗證）
  useEffect(() => {
    console.log('EFormInstancePage useEffect 被調用，id:', id);
    
    const initializePage = async () => {
      // 從 URL 參數中獲取 Token
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      
      console.log('URL Token:', urlToken);
      
      // 檢查是否有 URL Token（Manual Fill 模式）
      if (urlToken) {
        validateTokenAndFetchInstance(urlToken);
      } else {
        // 傳統登入模式
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('userInfo');
        
        console.log('Token 存在:', !!token);
        console.log('UserInfo 存在:', !!userInfo);
        
        if (!token) {
          // 保存當前 URL 以便登入後重定向
          // 使用 useParams 獲取的 id 來構建 URL，避免 window.location 被 navigate 改變
          const redirectUrl = `/eform-instance/${id}`;
          console.log('沒有 token，保存重定向 URL:', redirectUrl);
          sessionStorage.setItem('redirectAfterLogin', redirectUrl);
          message.error(t('eformInstance.loginRequired'));
          navigate('/');
          return;
        }

        // 如果有 token 但沒有 userInfo，嘗試重新獲取用戶信息
        if (!userInfo) {
          console.log('Token 存在但 UserInfo 不存在，嘗試重新獲取用戶信息');
          try {
            const meResponse = await fetch('/api/auth/me', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (meResponse.ok) {
              const userData = await meResponse.json();
              const fullUserInfo = {
                user_id: userData.user_id,
                account: userData.account,
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                language: userData.language,
                timezone: userData.timezone,
                avatar_url: userData.avatar_url,
                company_id: userData.company_id
              };
              
              localStorage.setItem('userInfo', JSON.stringify(fullUserInfo));
              console.log('成功重新獲取用戶信息');
            } else {
              // 如果獲取用戶信息失敗，說明 token 無效，需要重新登入
              localStorage.removeItem('token');
              sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
              message.error(t('eformInstance.loginRequired'));
              navigate('/');
              return;
            }
          } catch (error) {
            console.error('重新獲取用戶信息失敗:', error);
            localStorage.removeItem('token');
            sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
            message.error(t('eformInstance.loginRequired'));
            navigate('/');
            return;
          }
        }
        
        fetchInstance();
      }
    };

    initializePage();
    
    // 隱藏側邊欄
    const sider = document.querySelector('.ant-layout-sider');
    if (sider) {
      sider.style.display = 'none';
    }
    
    // 調整主內容區域
    const layout = document.querySelector('.ant-layout');
    if (layout) {
      layout.style.marginLeft = '0';
    }
    
    // 清理函數：離開頁面時恢復側邊欄
    return () => {
      if (sider) {
        sider.style.display = '';
      }
      if (layout) {
        layout.style.marginLeft = '';
      }
    };
  }, [id, navigate, t]);

  // Token 驗證並獲取實例信息
  const validateTokenAndFetchInstance = async (urlToken) => {
    try {
      setLoading(true);
      console.log('validateTokenAndFetchInstance 被調用，token:', urlToken);
      
      // 使用新的匿名端點獲取表單實例信息
      const instanceResponse = await fetch(`/api/eforminstances/${id}/public?token=${encodeURIComponent(urlToken)}`);
      
      if (instanceResponse.status === 401) {
        message.error('無效的訪問令牌或令牌已過期');
        return;
      }
      
      if (instanceResponse.status === 403) {
        message.error('您無權訪問此表單');
        return;
      }
      
      if (!instanceResponse.ok) {
        const errorData = await instanceResponse.json();
        throw new Error(errorData.error || '獲取表單實例失敗');
      }
      
      const instanceData = await instanceResponse.json();
      console.log('獲取到的實例數據:', instanceData);
      
      // 設置實例數據和 Token
      setInstance({
        ...instanceData,
        urlToken: urlToken,
        isManualFill: instanceData.fillType === 'Manual'
      });
      
    } catch (error) {
      console.error('Token 驗證錯誤:', error);
      message.error('訪問失敗: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstance = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      console.log('fetchInstance 被調用，id:', id);
      
      if (!token) {
        message.error(t('eformInstance.loginRequired'));
        navigate('/');
        return;
      }
      
      const response = await fetch(`/api/eforminstances/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('獲取實例響應狀態:', response.status);

      if (response.status === 401) {
        message.error(t('eformInstance.loginExpired'));
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        navigate('/');
        return;
      }

      if (!response.ok) {
        throw new Error(t('eformInstance.fetchFailed'));
      }

      const data = await response.json();
      console.log('獲取到的實例數據:', data);
      setInstance(data);
    } catch (error) {
      console.error('獲取表單實例錯誤:', error);
      message.error(t('eformInstance.fetchFailed') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    console.log('handleApprove 被調用');
    try {
      setApproving(true);
      const token = localStorage.getItem('token');
      
      console.log('Token:', token ? '存在' : '不存在');
      
      if (!token) {
        message.error(t('eformInstance.loginRequired'));
        navigate('/');
        return;
      }
      
      console.log('發送批准請求到:', `/api/eforminstances/${id}/approve`);
      console.log('請求數據:', { approvedBy: 'System', note: approvalNote });
      
      const response = await fetch(`/api/eforminstances/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          approvedBy: 'System',
          note: approvalNote
        })
      });

      console.log('響應狀態:', response.status);
      console.log('響應狀態文本:', response.statusText);

      if (response.status === 401) {
        message.error(t('eformInstance.loginExpired'));
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        navigate('/');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 錯誤響應:', errorText);
        throw new Error(`批准表單失敗: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('批准成功，響應:', result);
      message.success(t('eformInstance.formApproved'));
      
      // 關閉 Modal
      setApprovalModalVisible(false);
      setApprovalNote('');
      
      // 重新獲取實例以更新狀態
      await fetchInstance();
      
      console.log('批准操作完成，界面已更新');
    } catch (error) {
      console.error('批准表單錯誤:', error);
      message.error(t('eformInstance.approveFailed') + ': ' + error.message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    console.log('handleReject 被調用');
    try {
      setRejecting(true);
      const token = localStorage.getItem('token');
      
      console.log('Token:', token ? '存在' : '不存在');
      
      if (!token) {
        message.error(t('eformInstance.loginRequired'));
        navigate('/');
        return;
      }
      
      console.log('發送拒絕請求到:', `/api/eforminstances/${id}/reject`);
      console.log('請求數據:', { approvedBy: 'System', note: rejectNote });
      
      const response = await fetch(`/api/eforminstances/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          approvedBy: 'System',
          note: rejectNote
        })
      });

      console.log('響應狀態:', response.status);
      console.log('響應狀態文本:', response.statusText);

      if (response.status === 401) {
        message.error(t('eformInstance.loginExpired'));
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        navigate('/');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 錯誤響應:', errorText);
        throw new Error(`拒絕表單失敗: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('拒絕成功，響應:', result);
      message.success(t('eformInstance.formRejected'));
      
      // 關閉 Modal
      setRejectModalVisible(false);
      setRejectNote('');
      
      // 重新獲取實例以更新狀態
      await fetchInstance();
      
      console.log('拒絕操作完成，界面已更新');
    } catch (error) {
      console.error('拒絕表單錯誤:', error);
      message.error(t('eformInstance.rejectFailed') + ': ' + error.message);
    } finally {
      setRejecting(false);
    }
  };

  // 提交表單（Manual Fill 模式）
  const handleSubmitForm = async () => {
    try {
      console.log('handleSubmitForm 被調用');
      
      if (!instance?.urlToken) {
        message.error('缺少訪問令牌');
        return;
      }

      // 從 DOM 中獲取填寫後的表單內容
      const formContainer = document.querySelector('.form-content-inner');
      if (!formContainer) {
        console.error('找不到表單容器 .form-content-inner');
        message.error('無法獲取表單內容');
        return;
      }

      // 克隆容器以避免修改原始 DOM
      const clonedContainer = formContainer.cloneNode(true);
      
      // 獲取所有表單元素並將用戶輸入的值寫入 value 屬性
      const inputs = clonedContainer.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], input[type="date"], input[type="time"]');
      inputs.forEach(input => {
        if (input.value) {
          input.setAttribute('value', input.value);
          console.log(`設置 input ${input.name || input.id} value:`, input.value);
        }
      });
      
      // 處理 textarea
      const textareas = clonedContainer.querySelectorAll('textarea');
      textareas.forEach(textarea => {
        if (textarea.value) {
          textarea.textContent = textarea.value;
          console.log(`設置 textarea ${textarea.name || textarea.id} value:`, textarea.value);
        }
      });
      
      // 處理 select
      const selects = clonedContainer.querySelectorAll('select');
      selects.forEach(select => {
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
          // 移除所有 selected 屬性
          Array.from(select.options).forEach(opt => opt.removeAttribute('selected'));
          // 設置當前選中的 option
          selectedOption.setAttribute('selected', 'selected');
          console.log(`設置 select ${select.name || select.id} selected:`, selectedOption.value);
        }
      });
      
      // 處理 checkbox 和 radio
      const checkboxes = clonedContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]');
      checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
          checkbox.setAttribute('checked', 'checked');
          console.log(`設置 ${checkbox.type} ${checkbox.name || checkbox.id} checked`);
        } else {
          checkbox.removeAttribute('checked');
        }
      });
      
      // 獲取處理後的 HTML
      const filledHtmlCode = clonedContainer.innerHTML;
      
      console.log('提交表單，FilledHtmlCode 長度:', filledHtmlCode.length);
      console.log('FilledHtmlCode 前 500 字符:', filledHtmlCode.substring(0, 500));
      
      const response = await fetch(`/api/eforminstances/${id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: instance.urlToken,
          filledHtmlCode: filledHtmlCode
        })
      });

      console.log('提交響應狀態:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        console.error('提交失敗，錯誤:', errorData);
        throw new Error(errorData.error || `提交失敗: ${response.status}`);
      }

      const result = await response.json();
      console.log('提交成功，結果:', result);
      message.success('表單提交成功！');
      
      // 更新實例狀態
      setInstance(prev => ({
        ...prev,
        status: 'Submitted',
        filledHtmlCode: filledHtmlCode
      }));
      
    } catch (error) {
      console.error('提交表單錯誤:', error);
      message.error('提交失敗: ' + error.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'orange';
      case 'Approved': return 'green';
      case 'Rejected': return 'red';
      case 'Submitted': return 'blue';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Pending': return t('eformInstance.pendingApproval');
      case 'Approved': return t('eformInstance.approved');
      case 'Rejected': return t('eformInstance.rejected');
      case 'Submitted': return '已提交';
      default: return status;
    }
  };

  if (loading) {
    console.log('EFormInstancePage 正在載入...');
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        backgroundColor: '#f5f5f5'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!instance) {
    console.log('EFormInstancePage 沒有實例數據');
    return (
      <div style={{ 
        padding: '20px',
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        backgroundColor: '#f5f5f5'
      }}>
        <Alert
          message={t('eformInstance.error')}
          description={t('eformInstance.formInstanceNotFound')}
          type="error"
          showIcon
        />
      </div>
    );
  }

  console.log('EFormInstancePage 渲染，實例狀態:', instance.status);
  console.log('Modal 狀態 - approvalModalVisible:', approvalModalVisible);
  console.log('Modal 狀態 - rejectModalVisible:', rejectModalVisible);

  return (
    <>
      {/* 全屏容器 */}
      <div style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        zIndex: 9999,
        overflow: 'auto'
      }}>
        {/* 頂部審批按鈕 - 固定在頂部 */}
        <div style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 1000, 
          background: '#fff', 
          padding: '24px 32px',
          borderBottom: '1px solid #e8e8e8',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '0',
          width: '100%'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
            maxWidth: '100%'
          }}>
            <div style={{ flex: '1', minWidth: '300px' }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: '28px', 
                fontWeight: '600', 
                color: '#262626',
                lineHeight: '1.2'
              }}>
                {instance.formName}
              </h2>
              <Tag color={getStatusColor(instance.status)} style={{ 
                marginTop: '12px',
                fontSize: '14px',
                padding: '4px 12px'
              }}>
                {getStatusText(instance.status)}
              </Tag>
            </div>
            
            {console.log('當前實例狀態:', instance.status, '是否為 Manual Fill:', instance.isManualFill)}
            {console.log('按鈕條件檢查:', (instance.status === 'Pending') || (instance.isManualFill && instance.status === 'Submitted'))}
            {((instance.status === 'Pending') || (instance.isManualFill && instance.status === 'Submitted')) && (
              <Space className="approval-buttons" size="large" style={{ flexShrink: 0 }}>
                {console.log('進入 Space，isManualFill:', instance.isManualFill)}
                {instance.isManualFill ? (
                  // Manual Fill 模式：顯示提交按鈕
                  <>
                    {console.log('渲染 Manual Fill 提交按鈕')}
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => {
                        console.log('提交按鈕被點擊！');
                        handleSubmitForm();
                      }}
                      style={{ 
                        backgroundColor: instance.status === 'Submitted' ? '#52c41a' : '#1890ff', 
                        borderColor: instance.status === 'Submitted' ? '#52c41a' : '#1890ff',
                        height: '48px',
                        padding: '0 32px',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}
                    >
                      {instance.status === 'Submitted' ? '重新提交' : '提交表單'}
                    </Button>
                  </>
                ) : (
                  // 傳統模式：顯示批准和拒絕按鈕
                  <>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => {
                        console.log('批准按鈕被點擊');
                        setApprovalModalVisible(true);
                      }}
                      style={{ 
                        backgroundColor: '#52c41a', 
                        borderColor: '#52c41a',
                        height: '48px',
                        padding: '0 32px',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}
                    >
                      {t('eformInstance.approve')}
                    </Button>
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => {
                        console.log('拒絕按鈕被點擊');
                        setRejectModalVisible(true);
                      }}
                      style={{
                        height: '48px',
                        padding: '0 32px',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}
                    >
                      {t('eformInstance.reject')}
                    </Button>
                  </>
                )}
              </Space>
            )}
          </div>
        </div>

        {/* 主要內容區域 */}
        <div className="main-content" style={{ 
          padding: '32px',
          minHeight: 'calc(100vh - 120px)',
          width: '100%'
        }}>
          <div className="grid-container" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '32px',
            alignItems: 'start',
            maxWidth: '100%'
          }}>
            {/* 表單信息卡片 */}
            <Card 
              className="form-info-card"
              title={t('eformInstance.formInfo')} 
              style={{ 
                height: 'fit-content',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                borderRadius: '12px',
                border: 'none',
                order: 1
              }}
              headStyle={{
                backgroundColor: '#fafafa',
                borderBottom: '1px solid #e8e8e8',
                fontSize: '18px',
                fontWeight: '600',
                padding: '20px 24px',
                borderRadius: '12px 12px 0 0'
              }}
              bodyStyle={{
                padding: '24px'
              }}
            >
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '20px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px'
                }}>
                  <strong style={{ color: '#595959', fontSize: '14px' }}>{t('eformInstance.instanceName')}</strong>
                  <span style={{ 
                    color: '#262626', 
                    wordBreak: 'break-word',
                    fontSize: '16px',
                    padding: '8px 12px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    border: '1px solid #e8e8e8'
                  }}>
                    {instance.instanceName}
                  </span>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px'
                }}>
                  <strong style={{ color: '#595959', fontSize: '14px' }}>{t('eformInstance.createdAt')}</strong>
                  <span style={{ 
                    color: '#262626',
                    fontSize: '16px',
                    padding: '8px 12px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    border: '1px solid #e8e8e8'
                  }}>
                    {new Date(instance.createdAt).toLocaleString('zh-TW')}
                  </span>
                </div>
                
                {instance.userMessage && (
                  <div style={{ 
                    padding: '16px',
                    backgroundColor: '#f6ffed',
                    border: '1px solid #b7eb8f',
                    borderRadius: '8px'
                  }}>
                    <strong style={{ 
                      color: '#595959', 
                      display: 'block', 
                      marginBottom: '8px',
                      fontSize: '14px'
                    }}>
                      {t('eformInstance.userInput')}
                    </strong>
                    <span style={{ 
                      color: '#262626', 
                      wordBreak: 'break-word',
                      fontSize: '16px',
                      lineHeight: '1.5'
                    }}>
                      {instance.userMessage}
                    </span>
                  </div>
                )}
                
                {instance.approvalBy && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px'
                  }}>
                    <strong style={{ color: '#595959', fontSize: '14px' }}>{t('eformInstance.approver')}</strong>
                    <span style={{ 
                      color: '#262626',
                      fontSize: '16px',
                      padding: '8px 12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      border: '1px solid #e8e8e8'
                    }}>
                      {instance.approvalBy}
                    </span>
                  </div>
                )}
                
                {instance.approvalAt && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px'
                  }}>
                    <strong style={{ color: '#595959', fontSize: '14px' }}>{t('eformInstance.approvalTime')}</strong>
                    <span style={{ 
                      color: '#262626',
                      fontSize: '16px',
                      padding: '8px 12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      border: '1px solid #e8e8e8'
                    }}>
                      {new Date(instance.approvalAt).toLocaleString('zh-TW')}
                    </span>
                  </div>
                )}
                
                {instance.approvalNote && (
                  <div style={{ 
                    padding: '16px',
                    backgroundColor: '#fff7e6',
                    border: '1px solid #ffd591',
                    borderRadius: '8px'
                  }}>
                    <strong style={{ 
                      color: '#595959', 
                      display: 'block', 
                      marginBottom: '8px',
                      fontSize: '14px'
                    }}>
                      {t('eformInstance.approvalNote')}
                    </strong>
                    <span style={{ 
                      color: '#262626', 
                      wordBreak: 'break-word',
                      fontSize: '16px',
                      lineHeight: '1.5'
                    }}>
                      {instance.approvalNote}
                    </span>
                  </div>
                )}
              </div>
            </Card>

                         {/* 表單內容卡片 */}
             <Card 
               className="form-content-card"
               title={t('eformInstance.formContent')} 
               style={{ 
                 height: 'fit-content',
                 boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                 borderRadius: '12px',
                 border: 'none',
                 minHeight: '600px',
                 order: 2,
                 width: '100%',
                 maxWidth: '100%'
               }}
              headStyle={{
                backgroundColor: '#fafafa',
                borderBottom: '1px solid #e8e8e8',
                fontSize: '18px',
                fontWeight: '600',
                padding: '20px 24px',
                borderRadius: '12px 12px 0 0'
              }}
              bodyStyle={{
                padding: '24px',
                height: '100%'
              }}
            >
                             <div 
                 className="form-content-inner"
                 dangerouslySetInnerHTML={{ __html: instance.htmlCode }}
                 style={{ 
                   border: '1px solid #d9d9d9', 
                   borderRadius: '8px', 
                   padding: '32px',
                   backgroundColor: '#fff',
                   minHeight: '500px',
                   overflow: 'auto',
                   fontSize: '16px',
                   lineHeight: '1.6',
                   width: '100%',
                   maxWidth: '100%',
                   boxSizing: 'border-box'
                 }}
               />
            </Card>
          </div>
        </div>

        {/* 批准 Modal */}
        <Modal
          title={t('eformInstance.approveForm')}
          open={approvalModalVisible}
          onCancel={() => {
            console.log('批准 Modal 被取消');
            setApprovalModalVisible(false);
          }}
          footer={[
            <Button key="cancel" onClick={() => {
              console.log('批准 Modal 取消按鈕被點擊');
              setApprovalModalVisible(false);
            }}>
              {t('eformInstance.cancel')}
            </Button>,
            <Button
              key="approve"
              type="primary"
              loading={approving}
              onClick={() => {
                console.log('批准 Modal 確定按鈕被點擊');
                handleApprove();
              }}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              {t('eformInstance.confirmApprove')}
            </Button>,
          ]}
          styles={{
            wrapper: { zIndex: 10000 },
            mask: { zIndex: 9999 }
          }}
        >
          <div>
            <p>{t('eformInstance.confirmApproveForm')}</p>
            <TextArea
              rows={4}
              placeholder={t('eformInstance.approvalNotePlaceholder')}
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
            />
          </div>
        </Modal>

        {/* 拒絕 Modal */}
        <Modal
          title={t('eformInstance.rejectForm')}
          open={rejectModalVisible}
          onCancel={() => {
            console.log('拒絕 Modal 被取消');
            setRejectModalVisible(false);
          }}
          footer={[
            <Button key="cancel" onClick={() => {
              console.log('拒絕 Modal 取消按鈕被點擊');
              setRejectModalVisible(false);
            }}>
              {t('eformInstance.cancel')}
            </Button>,
            <Button
              key="reject"
              danger
              loading={rejecting}
              onClick={() => {
                console.log('拒絕 Modal 確定按鈕被點擊');
                handleReject();
              }}
            >
              {t('eformInstance.confirmReject')}
            </Button>,
          ]}
          styles={{
            wrapper: { zIndex: 10000 },
            mask: { zIndex: 9999 }
          }}
        >
          <div>
            <p>{t('eformInstance.confirmRejectForm')}</p>
            <TextArea
              rows={4}
              placeholder={t('eformInstance.rejectReasonPlaceholder')}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
        </Modal>
      </div>

      {/* 隱藏側邊欄的 CSS */}
      <style>{`
        /* 隱藏側邊欄 */
        .ant-layout-sider {
          display: none !important;
        }
        
        /* 調整主佈局 */
        .ant-layout {
          margin-left: 0 !important;
        }
        
        /* 確保全屏顯示 */
        body {
          overflow: hidden;
        }
        
        /* 響應式設計 */
        @media (max-width: 768px) {
          .ant-layout-sider {
            display: none !important;
          }
          
          .ant-layout {
            margin-left: 0 !important;
          }
          
          /* 手機版佈局調整 */
          .ant-card {
            margin-bottom: 16px !important;
          }
          
          /* 手機版網格佈局 */
          .grid-container {
            display: flex !important;
            flex-direction: column !important;
            gap: 16px !important;
          }
          
          /* 手機版卡片順序 */
          .form-info-card {
            order: 1 !important;
          }
          
          .form-content-card {
            order: 2 !important;
          }
          
          /* 手機版間距調整 */
          .main-content {
            padding: 16px !important;
          }
          
          /* 手機版按鈕調整 */
          .approval-buttons {
            flex-direction: row !important;
            gap: 12px !important;
            width: 100% !important;
          }
          
          .approval-buttons .ant-btn {
            flex: 1 !important;
            height: 44px !important;
            min-width: 0 !important;
          }
          
          /* 手機版表單內容緊湊化 */
          .form-content-card .ant-card-body {
            padding: 8px !important;
          }
          
          /* 手機版表單內容內部調整 */
          .form-content-card .ant-card-body > div {
            padding: 8px !important;
            border: none !important;
            border-radius: 4px !important;
            min-height: auto !important;
          }
          
          /* 手機版表單內容中的卡片調整 */
          .form-content-card .ant-card-body .ant-card {
            margin-bottom: 8px !important;
            border-radius: 4px !important;
          }
          
          .form-content-card .ant-card-body .ant-card .ant-card-body {
            padding: 8px 12px !important;
          }
          
          /* 手機版表單內容中的輸入框調整 */
          .form-content-card .ant-card-body .ant-input,
          .form-content-card .ant-card-body .ant-select-selector {
            border-radius: 4px !important;
            font-size: 14px !important;
          }
          
          /* 手機版表單內容中的標籤調整 */
          .form-content-card .ant-card-body .ant-card-head {
            padding: 0 8px !important;
            min-height: 32px !important;
          }
          
          .form-content-card .ant-card-body .ant-card-head-title {
            font-size: 14px !important;
            padding: 8px 0 !important;
          }
          
          /* 手機版表單內容中的間距調整 */
          .form-content-card .ant-card-body .ant-form-item {
            margin-bottom: 8px !important;
          }
          
          .form-content-card .ant-card-body .ant-form-item-label {
            padding-bottom: 4px !important;
          }
          
          .form-content-card .ant-card-body .ant-form-item-label > label {
            font-size: 13px !important;
            height: auto !important;
            line-height: 1.2 !important;
          }
          
          /* 手機版表單內容中的文字調整 */
          .form-content-card .ant-card-body {
            font-size: 14px !important;
            line-height: 1.4 !important;
          }
          
          /* 手機版表單內容中的邊框調整 */
          .form-content-card .ant-card-body .ant-card {
            border: 1px solid #f0f0f0 !important;
            box-shadow: none !important;
          }
          
          /* 手機版表單內容中的背景調整 */
          .form-content-card .ant-card-body .ant-card-head {
            background-color: #fafafa !important;
            border-bottom: 1px solid #f0f0f0 !important;
          }
          
          /* 手機版表單內容內部容器調整 */
          .form-content-inner {
            padding: 8px !important;
            min-height: auto !important;
            border: none !important;
            border-radius: 4px !important;
          }
          
          /* 手機版表單內容中的所有卡片緊湊化 */
          .form-content-inner .ant-card {
            margin-bottom: 8px !important;
            border-radius: 4px !important;
            border: 1px solid #f0f0f0 !important;
            box-shadow: none !important;
          }
          
          .form-content-inner .ant-card-body {
            padding: 8px 12px !important;
          }
          
          .form-content-inner .ant-card-head {
            padding: 0 8px !important;
            min-height: 32px !important;
            background-color: #fafafa !important;
            border-bottom: 1px solid #f0f0f0 !important;
          }
          
          .form-content-inner .ant-card-head-title {
            font-size: 14px !important;
            padding: 8px 0 !important;
          }
          
          /* 手機版表單內容中的輸入框緊湊化 */
          .form-content-inner .ant-input,
          .form-content-inner .ant-select-selector {
            border-radius: 4px !important;
            font-size: 14px !important;
            height: 32px !important;
          }
          
          /* 手機版表單內容中的表單項目緊湊化 */
          .form-content-inner .ant-form-item {
            margin-bottom: 8px !important;
          }
          
          .form-content-inner .ant-form-item-label {
            padding-bottom: 4px !important;
          }
          
          .form-content-inner .ant-form-item-label > label {
            font-size: 13px !important;
            height: auto !important;
            line-height: 1.2 !important;
          }
          
          /* 手機版表單內容中的文字緊湊化 */
          .form-content-inner {
            font-size: 14px !important;
            line-height: 1.4 !important;
          }
          
          /* 手機版表單內容置中和全寬度 */
          .form-content-card {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .form-content-card .ant-card-body {
            width: 100% !important;
            padding: 8px !important;
            margin: 0 !important;
          }
          
          .form-content-inner {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 8px !important;
            box-sizing: border-box !important;
          }
          
          /* 手機版表單內容中的卡片全寬度 */
          .form-content-inner .ant-card {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 0 8px 0 !important;
            box-sizing: border-box !important;
          }
          
          .form-content-inner .ant-card-body {
            width: 100% !important;
            padding: 8px 12px !important;
            box-sizing: border-box !important;
          }
          
          /* 手機版表單內容中的輸入框全寬度 */
          .form-content-inner .ant-input,
          .form-content-inner .ant-select,
          .form-content-inner .ant-select-selector {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          
          /* 手機版表單內容中的表單項目全寬度 */
          .form-content-inner .ant-form-item {
            width: 100% !important;
            max-width: 100% !important;
            margin-bottom: 8px !important;
          }
          
          .form-content-inner .ant-form-item-control {
            width: 100% !important;
            max-width: 100% !important;
          }
          
          /* 手機版表單內容中的標籤全寬度 */
          .form-content-inner .ant-form-item-label {
            width: 100% !important;
            max-width: 100% !important;
            text-align: left !important;
          }
          
          /* 手機版表單內容中的標籤文字 */
          .form-content-inner .ant-form-item-label > label {
            width: 100% !important;
            text-align: left !important;
            font-size: 13px !important;
            height: auto !important;
            line-height: 1.2 !important;
          }
          
          /* 手機版表單內容中的卡片標題置中 */
          .form-content-inner .ant-card-head {
            text-align: center !important;
            width: 100% !important;
          }
          
          .form-content-inner .ant-card-head-title {
            text-align: center !important;
            width: 100% !important;
            font-size: 14px !important;
            padding: 8px 0 !important;
          }
          
          /* 手機版表單內容中的容器置中 */
          .form-content-inner > * {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }
        }
        
        /* 平板版調整 */
        @media (max-width: 1024px) and (min-width: 769px) {
          .grid-container {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
      `}</style>
    </>
  );
};

export default EFormInstancePage;