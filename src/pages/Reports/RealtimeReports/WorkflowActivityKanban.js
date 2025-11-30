import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Row, Col, Tag, Badge, Spin, Empty, Tooltip, Typography, Alert, message, Statistic, Space, Select, DatePicker } from 'antd';
import { 
  PlayCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PauseCircleOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  PictureOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TimezoneUtils } from '../../../utils/timezoneUtils';
import ReadOnlyWorkflowView from '../components/ReadOnlyWorkflowView';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// 看板列定義（移除 pending，因為步驟執行不會有這種狀態）
// 注意：label 會在組件中使用翻譯函數動態獲取
const KANBAN_COLUMNS = {
  running: { key: 'running', color: '#1890ff', icon: PlayCircleOutlined },
  waiting: { key: 'waiting', color: '#faad14', icon: PauseCircleOutlined },
  completed: { key: 'completed', color: '#52c41a', icon: CheckCircleOutlined },
  failed: { key: 'failed', color: '#ff4d4f', icon: CloseCircleOutlined }
};

const WorkflowActivityKanban = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true); // 初始狀態設為 true，確保打開頁面時顯示 loading
  const [stepExecutions, setStepExecutions] = useState([]);
  const [workflowDefinitions, setWorkflowDefinitions] = useState([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null); // null 表示 "All"
  // 日期範圍，默認為今天
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('day'),
    dayjs().endOf('day')
  ]);
  const refreshInterval = 5; // 固定 5 秒刷新，確保實時性
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const previousStepExecutionsRef = useRef([]); // 保存上一次的數據用於比較
  const isInitialLoadRef = useRef(true); // 標記是否為首次載入

  // 載入流程定義列表
  const loadWorkflowDefinitions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/workflowdefinitions?page=1&pageSize=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          setWorkflowDefinitions(data.data);
        }
      }
    } catch (error) {
      console.error('載入流程定義失敗:', error);
    }
  };

  // 根據狀態分組步驟執行
  const groupedStepExecutions = useMemo(() => {
    const groups = {
      running: [],
      waiting: [],
      completed: [],
      failed: []
    };

    console.log('[WorkflowActivityKanban] 開始分組步驟執行，總數:', stepExecutions.length);
    
    stepExecutions.forEach(step => {
      const status = (step.status || '').toLowerCase();
      console.log('[WorkflowActivityKanban] 處理步驟執行:', { id: step.id, status: step.status, taskName: step.taskName });
      
      if (status.includes('fail') || status.includes('error')) {
        groups.failed.push(step);
        console.log('[WorkflowActivityKanban] 歸類為失敗');
      } else if (status.includes('complete') || status.includes('success')) {
        groups.completed.push(step);
        console.log('[WorkflowActivityKanban] 歸類為已完成');
      } else if (status.includes('wait') || step.isWaiting) {
        groups.waiting.push(step);
        console.log('[WorkflowActivityKanban] 歸類為等待中');
      } else if (status.includes('run') || status === 'running') {
        groups.running.push(step);
        console.log('[WorkflowActivityKanban] 歸類為運行中');
      } else {
        // 如果狀態不明確，根據其他信息判斷
        // 如果有 endedAt，視為已完成
        if (step.endedAt) {
          groups.completed.push(step);
          console.log('[WorkflowActivityKanban] 根據 endedAt 歸類為已完成');
        } else {
          // 否則視為運行中
          groups.running.push(step);
          console.log('[WorkflowActivityKanban] 狀態不明確，歸類為運行中');
        }
      }
    });

    console.log('[WorkflowActivityKanban] 分組結果:', {
      running: groups.running.length,
      waiting: groups.waiting.length,
      completed: groups.completed.length,
      failed: groups.failed.length
    });

    return groups;
  }, [stepExecutions]);

  // 載入步驟執行數據（增量更新）
  const loadStepExecutions = async (silent = false) => {
    if (!isMountedRef.current) return;

    // 只在首次載入時顯示 loading
    if (!silent && isInitialLoadRef.current) {
      setLoading(true);
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        if (isMountedRef.current) {
          setLoading(false);
          message.error(t('common.unauthorized') || '未授權');
        }
        return;
      }

      // 構建 API URL，添加查詢參數
      const params = new URLSearchParams();
      if (selectedWorkflowId) {
        params.append('workflowDefinitionId', selectedWorkflowId);
      }
      // 添加日期範圍參數
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.append('startDate', dateRange[0].startOf('day').toISOString());
        params.append('endDate', dateRange[1].endOf('day').toISOString());
      }
      const queryString = params.toString();
      const url = `/api/workflowexecutions/steps/monitor${queryString ? '?' + queryString : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        if (isMountedRef.current) {
          setLoading(false);
        }
        window.location.href = '/';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('[WorkflowActivityKanban] API 返回數據:', data);
      
      const stepList = data.data || [];
      
      if (Array.isArray(stepList)) {
        console.log('[WorkflowActivityKanban] 原始數據數量:', stepList.length);
        console.log('[WorkflowActivityKanban] 原始數據樣本:', stepList.slice(0, 3));

        // 比較新舊數據，只在有變化時才更新
        const previousSteps = previousStepExecutionsRef.current;
        
        // 首次載入，直接更新
        if (isInitialLoadRef.current) {
          previousStepExecutionsRef.current = stepList;
          setStepExecutions(stepList);
          isInitialLoadRef.current = false;
          if (isMountedRef.current) {
            setLoading(false);
          }
          return;
        }

        // 創建舊數據的 Map，以 id 為 key
        const previousMap = new Map();
        previousSteps.forEach(s => {
          previousMap.set(s.id, {
            id: s.id,
            status: s.status,
            isWaiting: s.isWaiting,
            startedAt: s.startedAt
          });
        });

        // 檢查是否有變化
        let hasChanges = false;
        
        // 檢查數量變化
        if (previousSteps.length !== stepList.length) {
          hasChanges = true;
        } else {
          // 檢查每個項目的變化
          for (const newItem of stepList) {
            const oldItem = previousMap.get(newItem.id);
            
            // 新項目（不存在於舊數據中）
            if (!oldItem) {
              hasChanges = true;
              break;
            }
            
            // 檢查關鍵字段是否變化
            if (oldItem.status !== newItem.status ||
                oldItem.isWaiting !== newItem.isWaiting) {
              hasChanges = true;
              break;
            }
          }
          
          // 檢查是否有項目被移除
          if (!hasChanges) {
            for (const oldItem of previousSteps) {
              if (!stepList.find(s => s.id === oldItem.id)) {
                hasChanges = true;
                break;
              }
            }
          }
        }

        // 只在有變化時才更新狀態
        if (hasChanges) {
          previousStepExecutionsRef.current = stepList;
          setStepExecutions(stepList);
        }
      } else {
        console.warn('[WorkflowActivityKanban] API 返回數據結構異常:', data);
        if (isInitialLoadRef.current && isMountedRef.current) {
          setStepExecutions([]);
          isInitialLoadRef.current = false;
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('載入步驟執行數據失敗:', error);
      if (isMountedRef.current) {
        setLoading(false);
        if (!silent) {
          message.error(t('reports.loadDataFailed') || '載入數據失敗');
        }
      }
    } finally {
      if (isMountedRef.current && isInitialLoadRef.current) {
        setLoading(false);
      }
    }
  };

  // 載入流程定義列表（只在組件掛載時執行一次）
  useEffect(() => {
    loadWorkflowDefinitions();
  }, []);

  // 當選擇的流程定義或日期範圍改變時，重新載入數據
  useEffect(() => {
    isInitialLoadRef.current = true;
    loadStepExecutions(false);
  }, [selectedWorkflowId, dateRange]);

  // 初始化載入和自動刷新（始終啟用，確保實時性）
  useEffect(() => {
    isMountedRef.current = true;
    
    // 立即載入一次（首次載入，顯示 loading）
    loadStepExecutions(false);
    
    // 設置自動刷新（每 3 秒靜默刷新一次）
    intervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        loadStepExecutions(true); // 靜默刷新，不顯示 loading
      }
    }, refreshInterval * 1000);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [selectedWorkflowId, dateRange]); // 當選擇的流程定義或日期範圍改變時，重新設置定時器

  // 計算執行時間（使用 UTC 時間戳計算，避免時區問題）
  const getExecutionDuration = (startedAt) => {
    if (!startedAt) return '0m';
    try {
      // 解析 startedAt（可能是 UTC 時間字符串）
      // 如果 startedAt 是 ISO 8601 格式（如 "2025-11-30T19:04:14Z"），new Date() 會正確解析
      // 如果 startedAt 沒有時區信息，需要確保它被當作 UTC 時間處理
      let startDate;
      if (typeof startedAt === 'string') {
        // 如果字符串沒有時區信息（沒有 Z 或 +/-），假設它是 UTC 時間
        if (startedAt.includes('T') && !startedAt.includes('Z') && !startedAt.match(/[+-]\d{2}:\d{2}$/)) {
          // 添加 Z 表示 UTC 時間
          startDate = new Date(startedAt + 'Z');
        } else {
          startDate = new Date(startedAt);
        }
      } else {
        startDate = new Date(startedAt);
      }
      
      const now = new Date();
      
      // 使用時間戳（毫秒）計算，避免時區轉換問題
      // getTime() 返回的是 UTC 時間戳（毫秒），不受時區影響
      const startUtc = startDate.getTime();
      const nowUtc = now.getTime();
      const diffMs = nowUtc - startUtc;
      
      if (diffMs < 0) return '0m'; // 如果時間差為負，返回 0m
      
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return '<1m';
      if (diffMins < 60) return `${diffMins}m`;
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    } catch (error) {
      console.error('計算執行時間失敗:', error, startedAt);
      return '0m';
    }
  };

  // 獲取狀態標籤
  const getStatusTag = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('fail') || statusLower.includes('error')) {
      return <Tag color="error" icon={<CloseCircleOutlined />}>{status}</Tag>;
    } else if (statusLower.includes('complete') || statusLower.includes('success')) {
      return <Tag color="success" icon={<CheckCircleOutlined />}>{status}</Tag>;
    } else if (statusLower.includes('wait')) {
      return <Tag color="warning" icon={<PauseCircleOutlined />}>{status}</Tag>;
    } else if (statusLower.includes('run')) {
      return <Tag color="processing" icon={<PlayCircleOutlined />}>{status}</Tag>;
    } else {
      return <Tag icon={<ClockCircleOutlined />}>{status}</Tag>;
    }
  };

  // 從 JSON 中提取消息內容
  const extractMessagesFromJson = (jsonString) => {
    if (!jsonString) return null;
    try {
      const data = JSON.parse(jsonString);
      // 查找常見的消息字段
      const messageFields = ['userMessage', 'message', 'text', 'content', 'messageText', 'body'];
      for (const field of messageFields) {
        if (data[field] && typeof data[field] === 'string' && data[field].trim()) {
          return data[field].trim();
        }
      }
      // 如果沒有找到，嘗試查找嵌套的消息
      if (data.messageData && data.messageData.messageText) {
        return data.messageData.messageText.trim();
      }
      if (data.messageData && data.messageData.text) {
        return data.messageData.text.trim();
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // 渲染步驟執行卡片（添加動畫支持）
  const renderStepCard = (step, index) => {
    const ColumnIcon = KANBAN_COLUMNS[step.column]?.icon || ClockCircleOutlined;
    const duration = getExecutionDuration(step.startedAt);
    const hasError = step.status?.toLowerCase().includes('fail');
    
    // 提取輸入和輸出的消息
    const inputMessage = extractMessagesFromJson(step.inputJson);
    const outputMessage = extractMessagesFromJson(step.outputJson);
    
    // 處理消息驗證記錄（用戶回復）- 只顯示對應到當前步驟的記錄
    // 確保 messageValidations 中的 stepIndex 與當前步驟的 stepIndex 匹配
    const allMessageValidations = step.messageValidations || [];
    const messageValidations = allMessageValidations.filter(v => {
      // 如果消息驗證記錄有 stepIndex 屬性，則必須與當前步驟的 stepIndex 匹配
      // 如果沒有 stepIndex 屬性，則只顯示當前步驟是等待節點的情況
      if (v.stepIndex !== undefined && v.stepIndex !== null) {
        return v.stepIndex === step.stepIndex;
      }
      // 如果沒有 stepIndex，只顯示等待節點（waitReply, waitForQRCode）
      return step.stepType === 'waitReply' || step.stepType === 'waitForQRCode' || step.stepType === 'waitforqrcode';
    });
    const textValidations = messageValidations.filter(v => v.messageType === 'text');
    const imageValidations = messageValidations.filter(v => v.messageType === 'image');

    return (
      <div
        key={step.id}
        className="kanban-card-wrapper"
        style={{
          marginBottom: '12px'
        }}
      >
        <Card
          size="small"
          style={{
            borderLeft: `4px solid ${KANBAN_COLUMNS[step.column]?.color || '#d9d9d9'}`,
            cursor: 'pointer',
            transition: 'all 0.2s',
            ...(hasError && {
              borderColor: '#ff4d4f',
              backgroundColor: '#fff2f0'
            })
          }}
          hoverable
          onClick={() => {
            message.info(`步驟: ${step.taskName || step.stepType || `步驟 #${step.stepIndex}`}`);
          }}
        >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <Text strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
              {step.taskName || step.stepType || `步驟 #${step.stepIndex}`}
            </Text>
            <Text style={{ fontSize: '14px', color: '#1890ff', display: 'block', marginBottom: '4px' }}>
              {step.workflowName}
            </Text>
            {getStatusTag(step.status)}
          </div>
          {hasError && (
            <Tooltip title={t('reports.realtime.executionFailed') || '執行失敗'}>
              <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
            </Tooltip>
          )}
        </div>
        
        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          {step.startedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>{t('reports.realtime.createdAt') || '創建時間:'}</span>
              <Text style={{ fontSize: '11px', color: '#999' }}>
                {TimezoneUtils.formatDateTime(step.startedAt, 'YYYY-MM-DD HH:mm:ss')}
              </Text>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>{t('reports.realtime.executionTime') || '執行時間:'}</span>
            <Text strong style={{ color: '#7234CF' }}>{duration}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>{t('reports.realtime.stepIndex') || '步驟索引:'}</span>
            <Badge count={step.stepIndex + 1} style={{ backgroundColor: '#1890ff' }} />
          </div>
          {step.initiatedBy && (
            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
              {t('reports.realtime.initiatedBy') || '啟動者:'} {step.initiatedBy}
            </div>
          )}
          {step.waitingForUser && (
            <div style={{ fontSize: '11px', color: '#faad14', marginTop: '4px' }}>
              {t('reports.realtime.waitingFor') || '等待:'} {step.waitingForUser}
            </div>
          )}
          {inputMessage && (
            <div style={{ 
              fontSize: '11px', 
              color: '#52c41a', 
              marginTop: '6px',
              padding: '4px 8px',
              backgroundColor: '#f6ffed',
              borderRadius: '4px',
              border: '1px solid #b7eb8f',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '4px'
            }}>
              <ArrowDownOutlined style={{ color: '#52c41a', fontSize: '10px', marginTop: '2px' }} />
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{inputMessage}</span>
            </div>
          )}
          {outputMessage && (
            <div style={{ 
              fontSize: '11px', 
              color: '#1890ff', 
              marginTop: '6px',
              padding: '4px 8px',
              backgroundColor: '#e6f7ff',
              borderRadius: '4px',
              border: '1px solid #91d5ff',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '4px'
            }}>
              <ArrowUpOutlined style={{ color: '#1890ff', fontSize: '10px', marginTop: '2px' }} />
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{outputMessage}</span>
            </div>
          )}
          
          {/* 用戶回復消息 */}
          {messageValidations.length > 0 && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
              <Text strong style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>
                {t('reports.realtime.userReplies') || '用戶回復:'}
              </Text>
              
              {/* 文本消息 */}
              {textValidations.map((validation, idx) => (
                <div 
                  key={validation.id} 
                  style={{ 
                    fontSize: '11px',
                    color: '#262626',
                    marginBottom: idx < textValidations.length - 1 ? '4px' : '0',
                    padding: '4px 8px',
                    backgroundColor: '#f6ffed',
                    borderRadius: '4px',
                    border: '1px solid #b7eb8f'
                  }}
                >
                  {validation.userMessage}
                  {validation.createdAt && (
                    <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                      {TimezoneUtils.formatDateTime(validation.createdAt, 'HH:mm:ss')}
                    </div>
                  )}
                </div>
              ))}
              
              {/* 圖片消息縮略圖 */}
              {imageValidations.length > 0 && (
                <div style={{ marginTop: textValidations.length > 0 ? '8px' : '0' }}>
                  <div style={{ 
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px'
                  }}>
                    {imageValidations.map((validation) => {
                      try {
                        const processedData = validation.processedData ? JSON.parse(validation.processedData) : null;
                        const isQRCodeNode = step.stepType === 'waitForQRCode' || step.stepType === 'waitforqrcode';
                        const qrCodeValue = isQRCodeNode ? validation.userMessage : null;
                        const caption = isQRCodeNode ? (processedData?.caption || '') : (validation.userMessage || '');
                        
                        return (
                          <div
                            key={validation.id}
                            style={{
                              position: 'relative',
                              width: '60px',
                              height: '60px',
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              backgroundColor: '#f5f5f5'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // 可以打開圖片預覽
                              if (validation.mediaUrl) {
                                window.open(validation.mediaUrl, '_blank');
                              }
                            }}
                            title={qrCodeValue ? `QR Code: ${qrCodeValue}${caption ? `\n${caption}` : ''}` : caption}
                          >
                            {validation.mediaUrl ? (
                              <img
                                src={validation.mediaUrl}
                                alt="User reply"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  if (e.target.nextSibling) {
                                    e.target.nextSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div style={{ 
                              display: validation.mediaUrl ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '100%',
                              height: '100%',
                              backgroundColor: '#f0f0f0'
                            }}>
                              <PictureOutlined style={{ fontSize: '20px', color: '#999' }} />
                            </div>
                            {qrCodeValue && (
                              <div style={{
                                position: 'absolute',
                                top: '2px',
                                left: '2px',
                                backgroundColor: 'rgba(82, 196, 26, 0.9)',
                                color: '#fff',
                                fontSize: '8px',
                                padding: '1px 3px',
                                borderRadius: '2px',
                                fontWeight: 'bold'
                              }}>
                                QR
                              </div>
                            )}
                            {validation.isValid === false && (
                              <div style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                backgroundColor: 'rgba(255, 77, 79, 0.9)',
                                color: '#fff',
                                fontSize: '8px',
                                padding: '1px 3px',
                                borderRadius: '2px',
                                fontWeight: 'bold'
                              }}>
                                ✗
                              </div>
                            )}
                          </div>
                        );
                      } catch (e) {
                        return null;
                      }
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
      </div>
    );
  };

  const totalActive = stepExecutions.length;
  const failedCount = groupedStepExecutions.failed.length;

  return (
    <div style={{ padding: '24px', width: '100%', boxSizing: 'border-box' }}>
      {/* 添加動畫樣式 */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .kanban-card-wrapper {
          animation: fadeIn 0.3s ease-in;
        }
      `}</style>
      {/* 標題和過濾器 */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Title level={4} style={{ margin: 0 }}>
              {t('reports.realtime.workflowActivity') || '工作流活動看板'}
            </Title>
          </Col>
          <Col flex="300px">
            <Space style={{ width: '100%' }} size="middle">
              <Text strong style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                {t('reports.realtime.dateRange') || '時間範圍:'}
              </Text>
              <RangePicker
                style={{ flex: 1 }}
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0].startOf('day'), dates[1].endOf('day')]);
                  } else {
                    // 如果清空，恢復為今天
                    setDateRange([dayjs().startOf('day'), dayjs().endOf('day')]);
                  }
                }}
                format="YYYY-MM-DD"
                allowClear={false}
              />
            </Space>
          </Col>
          <Col flex="250px">
            <Space style={{ width: '100%' }} size="middle">
              <Text strong style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                {t('reports.realtime.workflowDefinition') || '流程定義:'}
              </Text>
              <Select
                style={{ flex: 1 }}
                placeholder={t('reports.realtime.selectWorkflow') || '選擇流程定義'}
                value={selectedWorkflowId}
                onChange={(value) => setSelectedWorkflowId(value)}
                allowClear
              >
                <Option value={null}>{t('reports.realtime.allWorkflows') || '全部流程'}</Option>
                {workflowDefinitions.map(wf => (
                  <Option key={wf.id} value={wf.id}>{wf.name}</Option>
                ))}
              </Select>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 統計信息 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('reports.realtime.running') || '運行中'}
              value={groupedStepExecutions.running.length}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('reports.realtime.waiting') || '等待中'}
              value={groupedStepExecutions.waiting.length}
              prefix={<PauseCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('reports.realtime.completed') || '已完成'}
              value={groupedStepExecutions.completed.length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('reports.realtime.failed') || '失敗'}
              value={failedCount}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 失敗警告 */}
      {failedCount > 0 && (
        <Alert
          message={t('reports.realtime.failedAlert', { count: failedCount }) || `有 ${failedCount} 個流程執行失敗，請及時處理`}
          type="error"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* 看板 */}
      {loading && stepExecutions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <Spin size="large" />
        </div>
      ) : totalActive === 0 ? (
        <Empty description={t('reports.realtime.noActiveSteps') || '目前沒有活躍的步驟執行'} />
      ) : (
        <Row gutter={16} style={{ width: '100%', margin: 0 }}>
          {Object.values(KANBAN_COLUMNS).map(column => {
            const columnSteps = groupedStepExecutions[column.key] || [];
            const ColumnIcon = column.icon;
            const columnSpan = 24 / Object.keys(KANBAN_COLUMNS).length;

            return (
              <Col 
                span={columnSpan} 
                key={column.key}
                style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0, // 確保 Col 可以正確縮放
                  paddingLeft: '8px',
                  paddingRight: '8px'
                }}
              >
                <Card
                  title={
                    <Space>
                      <ColumnIcon style={{ color: column.color }} />
                      <span>{t(`reports.realtime.${column.key}`) || column.key}</span>
                      <Badge count={columnSteps.length} style={{ backgroundColor: column.color }} />
                    </Space>
                  }
                  style={{
                    height: 'calc(100vh - 400px)',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1
                  }}
                  bodyStyle={{ 
                    padding: '12px',
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {columnSteps.length === 0 ? (
                    <Empty 
                      description={t('reports.realtime.noItems') || '無項目'} 
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ marginTop: '48px' }}
                    />
                  ) : (
                    <div style={{ flex: 1 }}>
                      {columnSteps.map((step, index) => {
                        // 為每個步驟添加 column 屬性
                        const stepWithColumn = { ...step, column: column.key };
                        return renderStepCard(stepWithColumn, index);
                      })}
                    </div>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
};

export default WorkflowActivityKanban;

