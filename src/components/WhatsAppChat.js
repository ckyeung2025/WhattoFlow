import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, 
  Input, 
  Button, 
  Avatar, 
  Typography, 
  Tag, 
  message,
  Spin,
  Empty
} from 'antd';
import { 
  SendOutlined, 
  UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const WhatsAppChat = ({ 
  visible, 
  onClose, 
  instance, 
  onSendMessage 
}) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatInfo, setChatInfo] = useState(null);
  const messagesEndRef = useRef(null);

  // 當對話框打開時，自動載入聊天歷史
  useEffect(() => {
    if (visible && chatInfo?.waId) {
      loadChatHistory();
    }
  }, [visible, chatInfo?.waId]);

  // 解析 InputJson 中的 WhatsApp 信息
  useEffect(() => {
    if (instance && instance.inputJson) {
      try {
        console.log('原始 InputJson:', instance.inputJson);
        const inputData = JSON.parse(instance.inputJson);
        console.log('解析後的 InputData:', inputData);
        
        if (inputData.WaId && inputData.ContactName) {
          setChatInfo({
            waId: inputData.WaId,
            contactName: inputData.ContactName,
            messageId: inputData.MessageId,
            messageText: inputData.MessageText,
            timestamp: inputData.Timestamp,
            source: inputData.Source
          });
          
          // 添加初始消息
          if (inputData.MessageText) {
            const initialMessage = {
              id: Date.now(),
              text: inputData.MessageText,
              sender: 'user',
              timestamp: inputData.Timestamp || new Date().toISOString(),
              isInitial: true
            };
            console.log('設置初始消息:', initialMessage);
            // 使用清理函數確保消息結構正確
            const cleanedMessage = cleanMessages([initialMessage]);
            setMessages(cleanedMessage);
          } else {
            console.warn('MessageText 為空，無法設置初始消息');
          }
        } else {
          console.warn('缺少必要的 WhatsApp 信息:', inputData);
        }
      } catch (error) {
        console.error('解析 InputJson 失敗:', error);
        console.error('原始數據:', instance.inputJson);
        message.error('無法解析流程啟動信息');
      }
    } else {
      console.warn('instance 或 inputJson 為空:', instance);
    }
  }, [instance]);

  // 自動滾動到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 清理和驗證消息數據
  const cleanMessages = (messageList) => {
    console.log('開始清理消息，原始數據:', messageList);
    
    const filtered = messageList
      .filter(msg => {
        const isValid = msg && typeof msg === 'object';
        if (!isValid) {
          console.warn('過濾掉無效消息對象:', msg);
        }
        return isValid;
      })
      .map(msg => {
        const cleaned = {
          id: msg.id || Date.now() + Math.random(),
          text: msg.text || '無消息內容',
          sender: msg.sender || 'unknown',
          timestamp: msg.timestamp || new Date().toISOString(),
          status: msg.status || 'sent',
          isInitial: msg.isInitial || false
        };
        
        console.log('清理單個消息:', { 原始: msg, 清理後: cleaned });
        return cleaned;
      })
      .filter(msg => {
        const hasText = msg.text && msg.text !== '無消息內容';
        if (!hasText) {
          console.warn('過濾掉無文字內容的消息:', msg);
        }
        return hasText;
      });
    
    console.log('清理完成，結果:', filtered);
    return filtered;
  };

  // 載入聊天歷史
  const loadChatHistory = async () => {
    if (!chatInfo?.waId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/whatsapp/chat-history/${chatInfo.waId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('API 返回的原始數據:', data);
        
        // 轉換數據庫格式為前端格式
        const convertedMessages = (data.messages || []).map(dbMsg => ({
          id: dbMsg.Id || dbMsg.id || Date.now() + Math.random(),
          text: dbMsg.MessageText || dbMsg.messageText || dbMsg.text || '',
          sender: (dbMsg.SenderType || dbMsg.senderType) === 'admin' ? 'admin' : 'user',
          timestamp: dbMsg.Timestamp || dbMsg.timestamp || dbMsg.CreatedAt || dbMsg.createdAt || new Date().toISOString(),
          status: dbMsg.Status || dbMsg.status || 'sent',
          isInitial: false
        }));
        
        console.log('轉換後的消息:', convertedMessages);
        
        // 清理和驗證轉換後的消息
        const validMessages = cleanMessages(convertedMessages);
        console.log('清理後的有效消息:', validMessages);
        
        setMessages(prev => [...validMessages, ...prev]);
      }
    } catch (error) {
      console.error('載入聊天歷史失敗:', error);
      message.error('載入聊天記錄失敗');
    } finally {
      setLoading(false);
    }
  };

  // 發送消息
  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatInfo?.waId) return;
    
    const newMessage = {
      id: Date.now(),
      text: inputText.trim(),
      sender: 'admin',
      timestamp: new Date().toISOString(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setSending(true);
    
    try {
      // 發送消息到後端
      const response = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          waId: chatInfo.waId,
          message: newMessage.text,
          workflowInstanceId: instance?.id
        })
      });
      
      if (response.ok) {
        // 更新消息狀態為已發送
        setMessages(prev => 
          prev.map(msg => 
            msg.id === newMessage.id 
              ? { ...msg, status: 'sent' }
              : msg
          )
        );
        
        if (onSendMessage) {
          onSendMessage(newMessage);
        }
        
        message.success('消息已發送');
      } else {
        throw new Error('發送失敗');
      }
    } catch (error) {
      console.error('發送消息失敗:', error);
      // 更新消息狀態為失敗
      setMessages(prev => 
        prev.map(msg => 
          msg.id === newMessage.id 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
      message.error('發送消息失敗');
    } finally {
      setSending(false);
    }
  };

  // 處理按鍵事件
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 快速回覆按鈕
  const quickReplies = [
    '您好！我是客服人員，有什麼可以幫助您的嗎？',
    '請稍等，我正在處理您的請求',
    '您的問題已經記錄，我們會盡快處理',
    '感謝您的耐心等待',
    '還有其他需要幫助的嗎？'
  ];

  const handleQuickReply = (text) => {
    setInputText(text);
    // 自動發送快速回覆
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  // 格式化時間
  const formatTime = (timestamp) => {
    try {
      if (!timestamp) {
        console.warn('時間戳為空:', timestamp);
        return '--:--';
      }
      
      const time = dayjs(timestamp);
      if (!time.isValid()) {
        console.warn('無效的時間戳:', timestamp);
        return '--:--';
      }
      
      return time.format('HH:mm');
    } catch (error) {
      console.error('格式化時間失敗:', error, timestamp);
      return '--:--';
    }
  };

  // 渲染消息氣泡
  const renderMessage = (message) => {
    const isUser = message.sender === 'user';
    const isInitial = message.isInitial;
    
    // 調試信息
    console.log('渲染消息:', message);
    
    // 檢查消息文字是否存在
    if (!message.text) {
      console.warn('消息缺少 text 屬性:', message);
      return null; // 如果沒有文字，不渲染此消息
    }
    
    return (
      <div
        key={`${message.id}-${message.timestamp}`}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: '8px',
          marginTop: isInitial ? '16px' : '8px'
        }}
      >
        <div
          style={{
            maxWidth: '70%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start'
          }}
        >
          {isInitial && (
            <div style={{ 
              textAlign: 'center', 
              marginBottom: '8px',
              fontSize: '12px',
              color: '#666'
            }}>
              <Tag color="blue" size="small">
                流程啟動消息
              </Tag>
            </div>
          )}
          
          <div
            style={{
              background: isUser ? '#dcf8c6' : '#fff',
              borderRadius: '18px',
              padding: '8px 12px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              position: 'relative',
              border: isUser ? 'none' : '1px solid #e8e8e8'
            }}
          >
            <Text style={{ fontSize: '14px', lineHeight: '1.4' }}>
              {message.text || '無消息內容'}
            </Text>
          </div>
          
          <div
            style={{
              fontSize: '11px',
              color: '#999',
              marginTop: '4px',
              marginLeft: isUser ? '0' : '12px',
              marginRight: isUser ? '12px' : '0'
            }}
          >
            {formatTime(message.timestamp)}
            {message.status === 'sending' && (
              <span style={{ marginLeft: '4px' }}>
                <Spin size="small" />
              </span>
            )}
            {message.status === 'failed' && (
              <span style={{ marginLeft: '4px', color: '#ff4d4f' }}>
                發送失敗
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 如果沒有聊天信息，顯示錯誤提示
  if (!chatInfo) {
    return (
      <Modal
        title="WhatsApp 對話"
        open={visible}
        onCancel={onClose}
        footer={null}
        width={400}
        centered
      >
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Empty 
            description="無法獲取用戶信息" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
          <Text type="secondary">
            此流程實例沒有 WhatsApp 啟動信息
          </Text>
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              請檢查流程實例的 InputJson 是否包含正確的 WhatsApp 信息
            </Text>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar 
              size={40} 
              style={{ backgroundColor: '#25d366' }}
              icon={<UserOutlined />}
            />
            <div>
              <div style={{ fontWeight: '600', fontSize: '16px' }}>
                {chatInfo.contactName}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {chatInfo.waId}
              </div>
            </div>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
      centered
      styles={{ body: { padding: 0, height: '600px', display: 'flex', flexDirection: 'column' } }}
    >
      {/* 聊天頭部信息 */}
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid #e8e8e8',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Tag color="green" size="small">WhatsApp</Tag>
          <Tag color="blue" size="small">流程實例 #{instance?.id}</Tag>
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          啟動時間: {dayjs(chatInfo.timestamp).format('YYYY-MM-DD HH:mm:ss')}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          啟動消息: {chatInfo.messageText}
        </div>
        
        {/* 測試按鈕 */}
        <div style={{ marginTop: '8px' }}>
          <Button 
            size="small" 
            onClick={async () => {
              try {
                const response = await fetch('/api/whatsapp/test-config', {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                  }
                });
                const data = await response.json();
                console.log('WhatsApp 配置測試結果:', data);
                message.info(`配置檢查完成，請查看控制台`);
              } catch (error) {
                console.error('測試配置失敗:', error);
                message.error('測試配置失敗');
              }
            }}
            style={{ marginRight: '8px' }}
          >
            測試配置
          </Button>
          <Button 
            size="small" 
            onClick={async () => {
              try {
                const response = await fetch('/api/whatsapp/test-send', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                  },
                  body: JSON.stringify({
                    waId: chatInfo.waId,
                    message: '這是一條測試消息',
                    workflowInstanceId: instance?.id
                  })
                });
                const data = await response.json();
                console.log('測試發送結果:', data);
                if (data.success) {
                  message.success('測試消息發送成功！');
                } else {
                  message.error('測試消息發送失敗');
                }
              } catch (error) {
                console.error('測試發送失敗:', error);
                message.error('測試發送失敗');
              }
            }}
          >
            測試發送
          </Button>
        </div>
      </div>

      {/* 快速回覆按鈕 */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid #e8e8e8',
        backgroundColor: '#fff',
        overflowX: 'auto'
      }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
          💬 快速回覆：
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap' }}>
          {quickReplies.map((reply, index) => (
            <Button
              key={index}
              size="small"
              onClick={() => handleQuickReply(reply)}
              style={{
                whiteSpace: 'nowrap',
                fontSize: '11px',
                height: '28px',
                padding: '0 8px',
                backgroundColor: '#f0f8ff',
                borderColor: '#1890ff',
                color: '#1890ff'
              }}
            >
              {reply.length > 20 ? reply.substring(0, 20) + '...' : reply}
            </Button>
          ))}
        </div>
      </div>

      {/* 消息列表 */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '16px',
        backgroundColor: '#f0f0f0',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23f0f0f0" fill-opacity="0.4"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px', color: '#666' }}>載入聊天記錄...</div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Empty 
              description="暫無聊天記錄" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">點擊上方快速回覆按鈕開始對話</Text>
            </div>
          </div>
        ) : (
          <>
            {messages
              .filter(msg => msg && msg.text) // 過濾掉無效消息
              .map(renderMessage)
              .filter(Boolean) // 過濾掉 null 值
            }
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 輸入區域 */}
      <div style={{ 
        padding: '16px', 
        borderTop: '1px solid #e8e8e8',
        backgroundColor: '#fff'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          alignItems: 'flex-end'
        }}>
          <Input.TextArea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="輸入消息內容，按 Enter 發送..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ 
              borderRadius: '20px',
              resize: 'none'
            }}
          />
          
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            disabled={!inputText.trim() || sending}
            loading={sending}
            style={{
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              padding: 0,
              backgroundColor: '#25d366',
              borderColor: '#25d366'
            }}
          />
        </div>
        
        <div style={{ 
          marginTop: '8px',
          fontSize: '11px',
          color: '#999',
          textAlign: 'center'
        }}>
          Enter 發送消息 | Shift + Enter 換行
        </div>
      </div>
    </Modal>
  );
};

export default WhatsAppChat;
