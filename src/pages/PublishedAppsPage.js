import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Button, 
  Avatar, 
  Space,
  Spin,
  message,
  Tooltip
} from 'antd';
import { 
  RocketOutlined, 
  PlayCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;

// 統一的淺橙色配色 - 與 Dashboard.js 保持一致
const colorPalette = [
  {
    name: 'unified-light-orange',
    color: '#EDE3DE',
    gradient: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)'
  },
  {
    name: 'unified-light-orange',
    color: '#EDE3DE', 
    gradient: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)'
  },
  {
    name: 'unified-light-orange',
    color: '#EDE3DE',
    gradient: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)'
  },
  {
    name: 'unified-light-orange',
    color: '#EDE3DE',
    gradient: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)'
  },
  {
    name: 'unified-light-orange',
    color: '#EDE3DE',
    gradient: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)'
  }
];

const PublishedAppsPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState([]);
  const [manualWorkflows, setManualWorkflows] = useState([]);
  const [autoWorkflows, setAutoWorkflows] = useState([]);
  const [startingWorkflows, setStartingWorkflows] = useState(new Set());

  useEffect(() => {
    loadPublishedApps();
  }, []);

  const loadPublishedApps = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ 用戶未登入，使用模擬數據');
        const mockManualWorkflows = [
          {
            id: 1,
            name: t('publishedApps.mockCustomerService'),
            description: t('publishedApps.mockCustomerServiceDesc'),
            status: 'Active',
            createdAt: '2024-01-15T10:30:00Z',
            createdBy: 'admin',
            executionCount: 25,
            json: JSON.stringify({
              nodes: [
                {
                  id: 'start-1',
                  type: 'start',
                  data: { activationType: 'manual' }
                }
              ]
            })
          },
          {
            id: 2,
            name: t('publishedApps.mockOrderProcess'),
            description: t('publishedApps.mockOrderProcessDesc'),
            status: 'Active',
            createdAt: '2024-01-20T14:15:00Z',
            createdBy: 'manager',
            executionCount: 18,
            json: JSON.stringify({
              nodes: [
                {
                  id: 'start-1',
                  type: 'start',
                  data: { activationType: 'manual' }
                }
              ]
            })
          }
        ];
        
        const mockAutoWorkflows = [
          {
            id: 3,
            name: t('publishedApps.mockPaymentConfirm'),
            description: t('publishedApps.mockPaymentConfirmDesc'),
            status: 'Active',
            createdAt: '2024-01-25T09:45:00Z',
            createdBy: 'admin',
            executionCount: 32,
            json: JSON.stringify({
              nodes: [
                {
                  id: 'start-1',
                  type: 'start',
                  data: { activationType: 'webhook' }
                }
              ]
            })
          },
          {
            id: 4,
            name: t('publishedApps.mockAutoNotification'),
            description: t('publishedApps.mockAutoNotificationDesc'),
            status: 'Active',
            createdAt: '2024-01-30T16:20:00Z',
            createdBy: 'system',
            executionCount: 45,
            json: JSON.stringify({
              nodes: [
                {
                  id: 'start-1',
                  type: 'start',
                  data: { activationType: 'auto' }
                }
              ]
            })
          }
        ];
        
        setManualWorkflows(mockManualWorkflows);
        setAutoWorkflows(mockAutoWorkflows);
        setWorkflows([...mockManualWorkflows, ...mockAutoWorkflows]);
        setLoading(false);
        return;
      }

      // 設置認證標頭
      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // 獲取所有工作流程定義和執行統計
      const [workflowsResponse, executionsResponse] = await Promise.allSettled([
        axios.get('/api/workflowdefinitions?page=1&pageSize=100&sortField=createdAt&sortOrder=desc', { 
          headers: authHeaders 
        }),
        axios.get('/api/workflowexecutions/execution-counts', { 
          headers: authHeaders 
        })
      ]);

      if (workflowsResponse.status === 'fulfilled' && workflowsResponse.value.data?.data) {
        const workflows = workflowsResponse.value.data.data;
        console.log('所有工作流程數據:', workflows);
        
        // 獲取執行統計數據
        let executionStats = {};
        if (executionsResponse.status === 'fulfilled' && executionsResponse.value.data) {
          executionStats = executionsResponse.value.data;
          console.log('執行統計數據:', executionStats);
        } else {
          console.log('獲取執行統計失敗，使用默認值');
        }
        
        // 過濾出狀態為 "Active"、"啟用" 或 "Enabled" 的流程
        const activeWorkflows = workflows.filter(workflow => {
          const isActive = workflow.status === 'Active' || 
                          workflow.status === '啟用' || 
                          workflow.status === 'Enabled';
          return isActive;
        });
        
        console.log('所有啟用的工作流程:', activeWorkflows);
        
        // 分類工作流程：手動觸發 vs 自動觸發
        const manualWorkflowsList = [];
        const autoWorkflowsList = [];
        
        activeWorkflows.forEach(workflow => {
          let triggerType = 'unknown';
          
          // 添加執行次數到工作流程對象
          workflow.executionCount = executionStats[workflow.id] || 0;
          
          if (workflow.json) {
            try {
              const workflowJson = JSON.parse(workflow.json);
              
              if (workflowJson.nodes) {
                // 嘗試多種可能的 start 節點類型
                const startNode = workflowJson.nodes.find(node => 
                  node.type === 'start' || 
                  node.type === 'Start' || 
                  node.type === 'startNode' ||
                  node.type === 'begin' ||
                  node.type === 'input' ||
                  node.id === 'start' ||
                  (node.data && node.data.type === 'start')
                );
                
                if (startNode && startNode.data) {
                  const activationType = startNode.data.activationType || 
                                       startNode.data.triggerType || 
                                       startNode.data.trigger;
                  
                  if (activationType === 'manual' || 
                      activationType === 'Manual' || 
                      activationType === '手動') {
                    triggerType = 'manual';
                  } else if (activationType === 'webhook' || 
                           activationType === 'auto' || 
                           activationType === 'Auto' || 
                           activationType === '自動') {
                    triggerType = 'auto';
                  }
                } else if (workflowJson.nodes.length > 0) {
                  // 檢查第一個節點
                  const firstNode = workflowJson.nodes[0];
                  if (firstNode && firstNode.data) {
                    const activationType = firstNode.data.activationType || 
                                         firstNode.data.triggerType || 
                                         firstNode.data.trigger;
                    
                    if (activationType === 'manual' || 
                        activationType === 'Manual' || 
                        activationType === '手動') {
                      triggerType = 'manual';
                    } else if (activationType === 'webhook' || 
                             activationType === 'auto' || 
                             activationType === 'Auto' || 
                             activationType === '自動') {
                      triggerType = 'auto';
                    }
                  }
                }
              }
            } catch (e) {
              console.log('解析工作流程 JSON 失敗:', e);
            }
          }
          
          console.log(`工作流程 ${workflow.name} 觸發類型:`, triggerType);
          
          // 根據觸發類型分類
          if (triggerType === 'manual') {
            manualWorkflowsList.push(workflow);
          } else if (triggerType === 'auto') {
            autoWorkflowsList.push(workflow);
          } else {
            // 未知觸發類型，默認為手動
            manualWorkflowsList.push(workflow);
          }
        });
        
        console.log('手動觸發的工作流程:', manualWorkflowsList);
        console.log('自動觸發的工作流程:', autoWorkflowsList);
        
        setManualWorkflows(manualWorkflowsList);
        setAutoWorkflows(autoWorkflowsList);
        setWorkflows([...manualWorkflowsList, ...autoWorkflowsList]);
      } else {
        console.log('獲取工作流程失敗，使用模擬數據');
        const mockManualWorkflows = [
          {
            id: 1,
            name: '客戶服務流程',
            description: '處理客戶諮詢和投訴的標準化流程',
            status: 'Active',
            createdAt: '2024-01-15T10:30:00Z',
            createdBy: 'admin',
            executionCount: 25,
            json: JSON.stringify({
              nodes: [
                {
                  id: 'start-1',
                  type: 'start',
                  data: { activationType: 'manual' }
                }
              ]
            })
          },
          {
            id: 2,
            name: t('publishedApps.mockOrderProcess'),
            description: t('publishedApps.mockOrderProcessDesc'),
            status: 'Active',
            createdAt: '2024-01-20T14:15:00Z',
            createdBy: 'manager',
            executionCount: 18,
            json: JSON.stringify({
              nodes: [
                {
                  id: 'start-1',
                  type: 'start',
                  data: { activationType: 'manual' }
                }
              ]
            })
          }
        ];
        
        const mockAutoWorkflows = [
          {
            id: 3,
            name: t('publishedApps.mockPaymentConfirm'),
            description: t('publishedApps.mockPaymentConfirmDesc'),
            status: 'Active',
            createdAt: '2024-01-25T09:45:00Z',
            createdBy: 'admin',
            executionCount: 32,
            json: JSON.stringify({
              nodes: [
                {
                  id: 'start-1',
                  type: 'start',
                  data: { activationType: 'webhook' }
                }
              ]
            })
          }
        ];
        
        setManualWorkflows(mockManualWorkflows);
        setAutoWorkflows(mockAutoWorkflows);
        setWorkflows([...mockManualWorkflows, ...mockAutoWorkflows]);
      }
    } catch (error) {
      console.error('載入已發布應用失敗:', error);
        message.error(t('publishedApps.loadAppsFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 手動啟動工作流程
  const handleStartWorkflow = async (workflow) => {
    try {
      setStartingWorkflows(prev => new Set([...prev, workflow.id]));
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workflowdefinitions/${workflow.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          inputData: {
            message: '手動啟動工作流程',
            timestamp: new Date().toISOString(),
            userId: 'manual-user',
            triggerType: 'manual'
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        message.success(t('publishedApps.startWorkflowSuccess', { name: workflow.name }));
        console.log('工作流程執行結果:', result);
        
        // 重新載入數據以更新執行次數
        await loadPublishedApps();
      } else {
        const errorData = await response.json();
        message.error(errorData.error || t('publishedApps.startWorkflowFailed'));
      }
    } catch (error) {
      console.error('啟動工作流程失敗:', error);
      message.error(t('publishedApps.startWorkflowFailed'));
    } finally {
      setStartingWorkflows(prev => {
        const newSet = new Set(prev);
        newSet.delete(workflow.id);
        return newSet;
      });
    }
  };

  // 移除編輯功能，只保留啟動功能

  const AppCard = ({ workflow, index }) => {
    const isStarting = startingWorkflows.has(workflow.id);
    const colorIndex = index % colorPalette.length;
    const palette = colorPalette[colorIndex];
    
    // 解析觸發方式 - 與 loadPublishedApps 中的邏輯保持一致
    let triggerType = t('publishedApps.unknown');
    let canStart = false;
    
    if (workflow.json) {
      try {
        const workflowJson = JSON.parse(workflow.json);
        
        if (workflowJson.nodes) {
          // 嘗試多種可能的 start 節點類型
          const startNode = workflowJson.nodes.find(node => 
            node.type === 'start' || 
            node.type === 'Start' || 
            node.type === 'startNode' ||
            node.type === 'begin' ||
            node.type === 'input' ||
            node.id === 'start' ||
            (node.data && node.data.type === 'start')
          );
          
          if (startNode && startNode.data) {
            const activationType = startNode.data.activationType || 
                                 startNode.data.triggerType || 
                                 startNode.data.trigger;
            
            if (activationType === 'manual' || 
                activationType === 'Manual' || 
                activationType === '手動') {
              triggerType = t('publishedApps.manual');
              canStart = true;
            } else if (activationType === 'webhook' || 
                      activationType === 'auto' || 
                      activationType === 'Auto' || 
                      activationType === '自動') {
              triggerType = t('publishedApps.auto');
              canStart = false;
            }
          } else if (workflowJson.nodes.length > 0) {
            // 檢查第一個節點
            const firstNode = workflowJson.nodes[0];
            if (firstNode && firstNode.data) {
              const activationType = firstNode.data.activationType || 
                                   firstNode.data.triggerType || 
                                   firstNode.data.trigger;
              
              if (activationType === 'manual' || 
                  activationType === 'Manual' || 
                  activationType === '手動') {
                triggerType = t('publishedApps.manual');
                canStart = true;
              } else if (activationType === 'webhook' || 
                        activationType === 'auto' || 
                        activationType === 'Auto' || 
                        activationType === '自動') {
                triggerType = t('publishedApps.auto');
                canStart = false;
              }
            }
          }
        }
      } catch (e) {
        console.log('解析觸發方式失敗:', e);
      }
    }
    
    // 如果工作流程在手動觸發區域，但觸發類型未知，默認為手動
    if (triggerType === t('publishedApps.unknown') && manualWorkflows.includes(workflow)) {
      triggerType = t('publishedApps.manual');
      canStart = true;
    }
    
    // 如果工作流程在自動觸發區域，但觸發類型未知，默認為自動
    if (triggerType === t('publishedApps.unknown') && autoWorkflows.includes(workflow)) {
      triggerType = t('publishedApps.auto');
      canStart = false;
    }

    return (
      <Card
        hoverable
        className="smart-button"
        style={{
          background: palette.gradient,
          border: 'none',
          borderRadius: '16px',
          height: '200px',
          position: 'relative',
          overflow: 'hidden',
          cursor: canStart ? 'pointer' : 'default',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          opacity: canStart ? 1 : 0.8
        }}
        onClick={() => {
          // 點擊整個卡片啟動工作流程
          if (canStart) {
            handleStartWorkflow(workflow);
          }
        }}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%)',
          backdropFilter: 'blur(5px)',
          zIndex: 1
        }} />
        
        <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 標題區域 - 固定高度 */}
          <div style={{ 
            height: '100px', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <div className="smart-button-header" style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="smart-button-left" style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <Avatar 
                  size={48} 
                  icon={<RocketOutlined />} 
                  style={{ 
                    backgroundColor: '#E8F5E8',
                    color: '#2E7D32',
                    border: '2px solid #4CAF50',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    marginRight: '12px',
                    flexShrink: 0
                  }}
                />
                <div className="smart-button-text" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <Title 
                    level={4} 
                    style={{ 
                      color: '#000000', 
                      margin: 0, 
                      fontSize: '18px', 
                      fontWeight: '600',
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      wordBreak: 'break-word'
                    }}
                    title={workflow.name}
                  >
                    {workflow.name}
                  </Title>
                  <Text 
                    style={{ 
                      color: 'rgba(0,0,0,0.7)', 
                      fontSize: '14px', 
                      margin: '4px 0 0 0',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '1.3'
                    }}
                    title={workflow.description || t('publishedApps.noDescription')}
                  >
                    {workflow.description || t('publishedApps.noDescription')}
                  </Text>
                </div>
              </div>
              <div className="smart-button-count" style={{ flexShrink: 0, marginLeft: '12px', textAlign: 'right' }}>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  color: '#000000',
                  lineHeight: 1
                }}>
                  {workflow.executionCount || 0}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'rgba(0,0,0,0.7)',
                  marginTop: '2px'
                }}>
                  {t('publishedApps.executionCount')}
                </div>
              </div>
            </div>
          </div>
          
          {/* 創建者信息和啟動狀態提示 - 向上移動 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '8px 0',
            marginTop: 'auto',
            minHeight: '50px'
          }}>
            {/* 創建者信息 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'rgba(255,255,255,0.4)',
              borderRadius: '8px',
              backdropFilter: 'blur(5px)',
              flex: 1,
              marginRight: '8px'
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: 'bold', 
                  color: '#000000',
                  lineHeight: 1
                }}>
                  {workflow.createdBy || t('publishedApps.unknown')}
                </div>
                <div style={{ 
                  fontSize: '9px', 
                  color: 'rgba(0,0,0,0.7)',
                  marginTop: '1px'
                }}>
                  {t('publishedApps.creator')}
                </div>
              </div>
            </div>
            
            {/* 啟動狀態提示 */}
            {canStart ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'rgba(255,255,255,0.4)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                flex: 1,
                marginLeft: '8px'
              }}>
                {isStarting ? (
                  <>
                    <SyncOutlined spin style={{ color: '#000000', fontSize: '14px' }} />
                    <Text style={{ color: '#000000', fontSize: '12px', margin: 0 }}>
                      {t('publishedApps.starting')}
                    </Text>
                  </>
                ) : (
                  <>
                    <PlayCircleOutlined style={{ color: '#000000', fontSize: '14px' }} />
                    <Text style={{ color: '#000000', fontSize: '12px', margin: 0 }}>
                      {t('publishedApps.clickToStart')}
                    </Text>
                  </>
                )}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                flex: 1,
                marginLeft: '8px'
              }}>
                <SyncOutlined style={{ color: 'rgba(0,0,0,0.6)', fontSize: '14px' }} />
                <Text style={{ color: 'rgba(0,0,0,0.6)', fontSize: '12px', margin: 0 }}>
                  {t('publishedApps.autoOnly')}
                </Text>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '60vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <Spin size="large" />
        <Text>{t('publishedApps.loading')}</Text>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ padding: '24px' }}>
      {/* 大的白色 Card 包裝所有內容 */}
      <Card
        style={{
          backgroundColor: '#F9F7FC',
          border: '1px solid #F9F7FC',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          minHeight: '600px'
        }}
      >
        {/* 標題區域 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <RocketOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
          <div>
            <Title level={2} style={{ margin: 0, fontSize: '24px', color: '#333333' }}>
              {t('publishedApps.title')}
            </Title>
            <Text style={{ color: 'rgba(0,0,0,0.7)', fontSize: '14px', margin: 0 }}>
              {t('publishedApps.description')}
            </Text>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ 
              fontSize: '32px', 
              fontWeight: 'bold', 
              color: '#1890ff',
              lineHeight: 1
            }}>
              {workflows.length}
            </div>
            <div style={{ 
              fontSize: '14px', 
              color: 'rgba(0,0,0,0.7)',
              marginTop: '4px'
            }}>
              {t('publishedApps.totalApps')}
            </div>
          </div>
        </div>

        {/* 手動觸發工作流程 */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '2px solid #1890ff'
          }}>
            <PlayCircleOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0, fontSize: '18px', color: '#1890ff' }}>
              {t('publishedApps.manualTriggerWorkflows')} ({manualWorkflows.length})
            </Title>
          </div>
          
          {manualWorkflows.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              backgroundColor: '#fafafa',
              borderRadius: '12px',
              border: '1px dashed #d9d9d9'
            }}>
              <ExclamationCircleOutlined style={{ fontSize: '32px', color: '#d9d9d9', marginBottom: '12px' }} />
              <Text style={{ color: '#999' }}>{t('publishedApps.noManualWorkflows')}</Text>
            </div>
          ) : (
            <Row gutter={[24, 24]}>
              {manualWorkflows.map((workflow, index) => (
                <Col xs={24} sm={12} lg={8} key={workflow.id}>
                  <AppCard workflow={workflow} index={index} />
                </Col>
              ))}
            </Row>
          )}
        </div>

        {/* 自動觸發工作流程 */}
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '2px solid #52c41a'
          }}>
            <SyncOutlined style={{ fontSize: '20px', color: '#52c41a' }} />
            <Title level={4} style={{ margin: 0, fontSize: '18px', color: '#52c41a' }}>
              {t('publishedApps.autoTriggerWorkflows')} ({autoWorkflows.length})
            </Title>
          </div>
          
          {autoWorkflows.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              backgroundColor: '#fafafa',
              borderRadius: '12px',
              border: '1px dashed #d9d9d9'
            }}>
              <ExclamationCircleOutlined style={{ fontSize: '32px', color: '#d9d9d9', marginBottom: '12px' }} />
              <Text style={{ color: '#999' }}>{t('publishedApps.noAutoWorkflows')}</Text>
            </div>
          ) : (
            <Row gutter={[24, 24]}>
              {autoWorkflows.map((workflow, index) => (
                <Col xs={24} sm={12} lg={8} key={workflow.id}>
                  <AppCard workflow={workflow} index={index} />
                </Col>
              ))}
            </Row>
          )}
        </div>
      </Card>
    </div>
  );
};

export default PublishedAppsPage;
