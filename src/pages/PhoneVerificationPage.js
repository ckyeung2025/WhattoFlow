import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Input, Button, Select, message, Spin, Steps, Typography, Space, Alert } from 'antd';
import { PhoneOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import './PhoneVerificationPage.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const PhoneVerificationPage = () => {
  const { verificationId } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0); // 0=輸入PIN, 1=完成, 2=輸入驗證碼（僅用於正常OTP流程，如果發生）
  const [loading, setLoading] = useState(false);
  const [verificationInfo, setVerificationInfo] = useState(null);
  
  // 表單數據
  const [phoneNumber, setPhoneNumber] = useState('');
  const [codeMethod, setCodeMethod] = useState('SMS');
  const [verificationCode, setVerificationCode] = useState('');
  const [pinCode, setPinCode] = useState('');  // PIN 碼（用於已驗證但未連結的情況）
  const [errorMessage, setErrorMessage] = useState('');
  
  // 計時器
  const [countdown, setCountdown] = useState(0);

  // 初始化：獲取驗證記錄信息
  useEffect(() => {
    const fetchVerificationInfo = async () => {
      try {
        const response = await fetch(`/api/companyphoneverification/${verificationId}`);
        if (response.ok) {
          const data = await response.json();
          setVerificationInfo(data);
          
          // 如果驗證記錄中已經有電話號碼，自動填充
          if (data.phoneNumber) {
            setPhoneNumber(data.phoneNumber);
          }
          
          // 根據狀態設置步驟
          // 簡化流程：階段1、2已手動完成，Company.WA_PhoneNo_ID 已存在
          // 直接跳過「發送驗證碼」和「輸入驗證碼」步驟，進入 PIN 輸入
          // 如果 Company.WA_PhoneNo_ID 存在，表示電話號碼已在 Meta Business Suite 中配置，直接使用 PIN 完成連結
          if (data.phoneNumberId && data.status !== 'Requested') {
            // 如果有 PhoneNumberId 且不是 Requested 狀態，直接進入 PIN 輸入步驟（步驟 0）
            // 因為階段1、2已手動完成，不需要再發送驗證碼
            setCurrentStep(0);  // 步驟 0：輸入 PIN
          } else if (data.status === 'Verified') {
            // 已驗證狀態，也直接進入 PIN 輸入（可能已驗證但未連結）
            setCurrentStep(0);
          } else if (data.status === 'Requested') {
            // 如果已經請求過驗證碼，進入輸入驗證碼步驟（正常 OTP 流程）
            // 這種情況較少見，因為通常階段1、2已手動完成，不會有 Requested 狀態
            setCurrentStep(2);
            // 計算倒計時（如果有的話）
            if (data.codeExpiry) {
              const expiryTime = new Date(data.codeExpiry).getTime();
              const now = Date.now();
              const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));
              setCountdown(remaining);
            }
          } else {
            // Pending 或其他狀態，但如果有 PhoneNumberId，也直接進入 PIN 輸入
            // 否則可能需要先請求驗證碼（但根據流程，階段1、2已手動完成，應該有 PhoneNumberId）
            if (data.phoneNumberId) {
              setCurrentStep(0);  // 有 PhoneNumberId，直接輸入 PIN
            } else {
              // 沒有 PhoneNumberId，這種情況不應該發生（因為階段1、2已手動完成）
              // 但為了兼容，還是進入 PIN 輸入（用戶可以嘗試）
              setCurrentStep(0);
            }
          }
        } else {
          message.error('找不到驗證記錄');
        }
      } catch (error) {
        console.error('獲取驗證信息失敗:', error);
        message.error('載入失敗');
      }
    };
    
    if (verificationId) {
      fetchVerificationInfo();
    }
  }, [verificationId]);

  // 倒計時
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [countdown]);

  // 步驟 1: 客戶輸入電話號碼並請求驗證碼（電話號碼可選，如果驗證記錄中已有）
  const handleRequestCode = async () => {
    // 如果驗證記錄中有電話號碼，使用驗證記錄中的；否則要求客戶輸入
    const phoneToUse = phoneNumber.trim() || (verificationInfo?.phoneNumber || '');
    
    if (!phoneToUse) {
      message.error('請輸入電話號碼');
      return;
    }
    
    // 驗證電話號碼格式（支持國際格式：+85296062000 或 85296062000）
    // 移除空格和特殊字符後驗證
    const cleanedPhone = phoneToUse.replace(/[^\d+]/g, '');
    const phoneRegex = /^\+?[0-9]{8,15}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      message.error('請輸入有效的電話號碼（例如：+85296062000 或 85296062000）');
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      const response = await fetch(`/api/companyphoneverification/request-verification-code/${verificationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          PhoneNumber: phoneToUse.replace(/[^\d+]/g, ''), // 清理後發送，使用 PascalCase（可選，如果驗證記錄中已有則不傳也可以）
          CodeMethod: codeMethod || 'SMS', // 使用 PascalCase
          Language: 'zh_HK' // 使用 PascalCase
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // 檢查是否需要輸入 PIN（已驗證但未連結的情況）
        if (data.RequiresPin && data.Status === 'Verified') {
          // 需要輸入 PIN 完成連結
          message.info(data.Instructions || '請輸入一個 6 位數 PIN 完成連結');
          setCurrentStep(0); // 直接跳到步驟 0：輸入 PIN
          
          // 刷新驗證信息
          const infoResponse = await fetch(`/api/companyphoneverification/${verificationId}`);
          if (infoResponse.ok) {
            const infoData = await infoResponse.json();
            setVerificationInfo(infoData);
          }
        }
        // 檢查是否是已驗證的響應（已經連結）
        else if (data.AlreadyVerified && data.Status === 'Verified') {
          // 電話號碼已經驗證，直接跳到完成步驟
          setCurrentStep(1);
          message.success('電話號碼已經驗證，無需再次驗證');
          
          // 刷新驗證信息
          const infoResponse = await fetch(`/api/companyphoneverification/${verificationId}`);
          if (infoResponse.ok) {
            const infoData = await infoResponse.json();
            setVerificationInfo(infoData);
          }
        } else {
          // 正常流程：驗證碼已發送
          message.success('驗證碼已發送，請檢查您的電話');
          setCurrentStep(2);
          
          // 設置倒計時（10 分鐘 = 600 秒）
          if (data.codeExpiry) {
            const expiryTime = new Date(data.codeExpiry).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));
            setCountdown(remaining);
          } else {
            setCountdown(600); // 默認 10 分鐘
          }
          
          // 刷新驗證信息
          const infoResponse = await fetch(`/api/companyphoneverification/${verificationId}`);
          if (infoResponse.ok) {
            const infoData = await infoResponse.json();
            setVerificationInfo(infoData);
          }
        }
      } else {
        // 詳細的錯誤處理
        let errorMsg = data.error || data.message || data.details || '發送失敗，請重試';
        
        // 檢查是否是電話號碼數量上限錯誤
        if (data.errorType === 'PHONE_NUMBER_LIMIT' || 
            errorMsg.includes('電話號碼數量') || 
            errorMsg.includes('Phone Numbers Count Exceeded')) {
          errorMsg = '已達到此 WhatsApp Business 帳戶允許連結的電話號碼數量上限。請在 Meta Business Suite 中刪除不需要的電話號碼，或聯繫 Meta 申請提高上限。';
        }
        
          console.error('請求驗證碼失敗:', {
            status: response.status,
            statusText: response.statusText,
            data: data,
            requestBody: {
              phoneNumber: phoneToUse.replace(/[^\d+]/g, ''),
              codeMethod: codeMethod,
              language: 'zh_HK'
            }
          });
        setErrorMessage(errorMsg);
        
        // 如果是電話號碼上限錯誤，顯示警告而不是錯誤
        if (data.errorType === 'PHONE_NUMBER_LIMIT') {
          message.warning(errorMsg, 10); // 顯示 10 秒
        } else {
          message.error(errorMsg);
        }
      }
    } catch (error) {
      console.error('請求驗證碼失敗:', error);
      setErrorMessage('發生錯誤，請稍後再試');
      message.error('請求失敗');
    } finally {
      setLoading(false);
    }
  };

  // 步驟 2: 客戶輸入驗證碼
  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      message.error('請輸入 6 位驗證碼');
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      const response = await fetch(`/api/companyphoneverification/verify-code/${verificationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: verificationCode.trim()
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        message.success('驗證成功！電話號碼已註冊');
        setCurrentStep(1);
        
        // 刷新驗證信息
        const infoResponse = await fetch(`/api/companyphoneverification/${verificationId}`);
        if (infoResponse.ok) {
          const infoData = await infoResponse.json();
          setVerificationInfo(infoData);
        }
      } else {
        setErrorMessage(data.error || data.details || '驗證失敗，請檢查驗證碼');
        message.error(data.error || '驗證失敗');
      }
    } catch (error) {
      console.error('驗證失敗:', error);
      setErrorMessage('發生錯誤，請稍後再試');
      message.error('驗證失敗');
    } finally {
      setLoading(false);
    }
  };

  // 步驟 4: 使用 PIN 完成連結（已驗證但未連結的情況）
  const handleRegisterWithPin = async () => {
    if (!pinCode.trim() || pinCode.length !== 6) {
      message.error('請輸入 6 位數 PIN 碼');
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      const response = await fetch(`/api/companyphoneverification/register-with-pin/${verificationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Pin: pinCode
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        message.success(data.Message || '電話號碼已成功連結！');
        setCurrentStep(1); // 跳轉到完成步驟
        
        if (data.Note) {
          message.info(data.Note, 5);
        }
        
        // 刷新驗證信息
        const infoResponse = await fetch(`/api/companyphoneverification/${verificationId}`);
        if (infoResponse.ok) {
          const infoData = await infoResponse.json();
          setVerificationInfo(infoData);
        }
      } else {
        const errorMsg = data.error || data.message || '連結失敗，請重試';
        setErrorMessage(errorMsg);
        message.error(errorMsg);
      }
    } catch (error) {
      console.error('使用 PIN 連結失敗:', error);
      setErrorMessage('發生錯誤，請稍後再試');
      message.error('連結失敗');
    } finally {
      setLoading(false);
    }
  };

  // 重新發送驗證碼
  const handleResendCode = async () => {
    // 如果還有倒計時，不允許重新發送
    if (countdown > 0) {
      message.warning('請等待倒計時結束後再重新發送');
      return;
    }
    
    // 重置 UI 狀態
    setCurrentStep(0);
    setVerificationCode('');
    setErrorMessage('');
    setCountdown(0);
    
    // 刷新驗證信息，確保狀態是最新的
    try {
      const infoResponse = await fetch(`/api/companyphoneverification/${verificationId}`);
      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        setVerificationInfo(infoData);
        // 如果驗證記錄中有電話號碼，自動填充
        if (infoData.phoneNumber && !phoneNumber) {
          setPhoneNumber(infoData.phoneNumber);
        }
      }
    } catch (error) {
      console.error('刷新驗證信息失敗:', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="phone-verification-page">
      <div className="phone-verification-container">
        <Card className="verification-card">
          <div className="verification-header">
            <PhoneOutlined className="verification-icon" />
            <Title level={2}>WhatsApp 電話號碼驗證</Title>
            {verificationInfo?.companyName && (
              <Text type="secondary">公司：{verificationInfo.companyName}</Text>
            )}
          </div>

          <Steps
            current={currentStep}
            items={[
              {
                title: '輸入 PIN',
                description: '請輸入 6 位數 PIN 完成連結'
              },
              {
                title: '驗證完成',
                description: '電話號碼已成功連結'
              }
            ]}
            style={{ marginBottom: 32 }}
          />

          {currentStep === 0 && (
            <div className="verification-step">
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Alert
                  message="階段1、2已完成"
                  description="您的電話號碼已在 Meta Business Suite 中配置完成。請輸入一個 6 位數 PIN 碼完成連結。"
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                
                {verificationInfo?.phoneNumber && (
                  <div style={{ padding: '12px', background: '#f0f7ff', borderRadius: '8px', marginBottom: '16px' }}>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      <PhoneOutlined /> 電話號碼：<Text strong>{verificationInfo.phoneNumber}</Text>
                    </Text>
                  </div>
                )}
                
                <div>
                  <Text strong>請輸入 6 位數 PIN 碼</Text>
                  <Input
                    size="large"
                    maxLength={6}
                    placeholder="000000"
                    value={pinCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setPinCode(value);
                    }}
                    onPressEnter={handleRegisterWithPin}
                    style={{ marginTop: 8, fontSize: 24, textAlign: 'center', letterSpacing: 8 }}
                  />
                  <Text type="secondary" style={{ fontSize: '12px', marginTop: 8, display: 'block' }}>
                    此 PIN 將設定為您的兩步驗證 PIN，請選擇一個容易記住的 6 位數
                  </Text>
                </div>

                {errorMessage && (
                  <div className="error-message">
                    <Text type="danger">{errorMessage}</Text>
                  </div>
                )}

                <Button
                  type="primary"
                  size="large"
                  block
                  onClick={handleRegisterWithPin}
                  loading={loading}
                  disabled={pinCode.length !== 6}
                >
                  完成連結
                </Button>
              </Space>
            </div>
          )}


          {currentStep === 2 && (
            <div className="verification-step">
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <Paragraph>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                    請輸入在 Meta Business Suite 中收到的驗證碼
                  </Paragraph>
                  <Text type="secondary" style={{ fontSize: '14px', marginTop: '8px', display: 'block' }}>
                    如果您還沒有收到驗證碼，請在 Meta Business Suite (business.facebook.com) 中請求驗證碼
                  </Text>
                </div>

                <div>
                  <Text strong>請輸入 6 位驗證碼</Text>
                  <Input
                    size="large"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setVerificationCode(value);
                    }}
                    onPressEnter={handleVerifyCode}
                    style={{ marginTop: 8, fontSize: 24, textAlign: 'center', letterSpacing: 8 }}
                  />
                </div>

                {errorMessage && (
                  <div className="error-message">
                    <Text type="danger">{errorMessage}</Text>
                  </div>
                )}

                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    onClick={handleVerifyCode}
                    loading={loading}
                    disabled={verificationCode.length !== 6}
                  >
                    提交驗證
                  </Button>
                  
                  <Button
                    size="large"
                    block
                    onClick={handleResendCode}
                    disabled={countdown > 0}
                  >
                    重新發送驗證碼
                  </Button>
                </Space>
              </Space>
            </div>
          )}

          {currentStep === 1 && (
            <div className="verification-step verification-success">
              <CheckCircleOutlined className="success-icon" />
              <Title level={3}>驗證成功！</Title>
              <Paragraph>
                您的電話號碼已成功連結到 WhatsApp Business API。
              </Paragraph>
              {verificationInfo?.phoneNumberId && (
                <Text type="secondary">
                  Phone Number ID: {verificationInfo.phoneNumberId}
                </Text>
              )}
            </div>
          )}

        </Card>
      </div>
    </div>
  );
};

export default PhoneVerificationPage;

