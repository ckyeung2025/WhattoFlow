import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Card, Descriptions, Table, Tag, Row, Col, Statistic, Button, Space, Spin, Empty, message, Typography, Tooltip } from 'antd';
import { 
  UserOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  CloseCircleOutlined,
  EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLanguage } from '../contexts/LanguageContext';
import { TimezoneUtils } from '../utils/timezoneUtils';

const { TabPane } = Tabs;
const { Text } = Typography;

// 消息發送狀態模態框組件
const MessageSendStatusModal = ({ visible, onClose, messageSendId, workflowExecutionId, nodeId, userTimezoneOffset }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [allMessageSends, setAllMessageSends] = useState([]);
  const [currentMessageSend, setCurrentMessageSend] = useState(null);
  const [messageSends, setMessageSends] = useState({
    normal: [],
    retry: [],
    escalation: []
  });

  // 載入所有消息發送記錄
  useEffect(() => {
    if (visible && workflowExecutionId) {
      // 每次打開模態框時，清空當前選中的消息發送記錄
      setCurrentMessageSend(null);
      loadAllMessageSends();
    } else if (!visible) {
      // 當模態框關閉時，也清空當前選中的消息發送記錄
      setCurrentMessageSend(null);
    }
  }, [visible, workflowExecutionId]);

  const loadAllMessageSends = async () => {
    try {
      setLoading(true);
      console.log('🔍 載入工作流程執行ID的所有消息發送記錄:', workflowExecutionId);
      console.log('🎯 過濾節點ID:', nodeId);
      
      const response = await fetch(`/api/workflowmessagesend/workflow/${workflowExecutionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📦 API 返回數據:', data);
      
      let allSends = data.data || [];
      
      // 如果有 nodeId，過濾出該節點的消息發送記錄
      if (nodeId) {
        console.log('🔍 過濾前的所有記錄:', allSends.map(s => ({ id: s.id, nodeId: s.nodeId, sendReason: s.sendReason })));
        console.log('🎯 目標節點ID:', nodeId);
        
        // 對於 waitReply 節點，我們需要顯示所有相關記錄（包括重試和升級）
        if (nodeId.includes('escalation')) {
          // 如果是升級節點，找到對應的基礎節點
          const baseNodeId = nodeId.replace('_escalation', '');
          console.log('🔄 升級節點，查找基礎節點:', baseNodeId);
          
          // 首先找到升級記錄，獲取它的 workflowStepExecutionId
          const escalationRecord = allSends.find(send => send.nodeId === nodeId);
          const targetWorkflowStepExecutionId = escalationRecord?.workflowStepExecutionId;
          console.log('🎯 目標 workflowStepExecutionId:', targetWorkflowStepExecutionId);
          
          allSends = allSends.filter(send => {
            // 匹配所有具有相同 workflowStepExecutionId 的記錄
            let matches = send.workflowStepExecutionId === targetWorkflowStepExecutionId ||
                         send.relatedStepExecutionId === targetWorkflowStepExecutionId;
            
            // 也匹配升級節點本身
            if (!matches) {
              matches = send.nodeId === nodeId;
            }
            
            console.log(`📋 記錄 ${send.id}: nodeId=${send.nodeId}, sendReason=${send.sendReason}, workflowStepExecutionId=${send.workflowStepExecutionId}, relatedStepExecutionId=${send.relatedStepExecutionId}, targetWorkflowStepExecutionId=${targetWorkflowStepExecutionId}, matches=${matches}`);
            return matches;
          });
        } else {
          // 普通節點，顯示該節點和相關的升級節點
          allSends = allSends.filter(send => {
            // 首先嘗試通過節點ID匹配
            let matches = send.nodeId === nodeId ||
                         send.nodeId === `${nodeId}_escalation`;
            
            // 如果沒有通過節點ID匹配，再嘗試其他方式
            if (!matches) {
              const isWorkflowStepExecutionId = /^\d+$/.test(nodeId);
              
              if (isWorkflowStepExecutionId) {
                // 如果 nodeId 是 workflow_step_execution_id，匹配所有具有相同 workflow_step_execution_id 的記錄
                matches = send.workflowStepExecutionId === parseInt(nodeId) ||
                         send.relatedStepExecutionId === parseInt(nodeId);
              }
            }
            
            console.log(`📋 記錄 ${send.id}: nodeId=${send.nodeId}, sendReason=${send.sendReason}, workflowStepExecutionId=${send.workflowStepExecutionId}, relatedStepExecutionId=${send.relatedStepExecutionId}, targetNodeId=${nodeId}, matches=${matches}`);
            return matches;
          });
        }
        
        console.log('🎯 過濾後的節點消息發送記錄:', allSends.length);
        console.log('📊 過濾後的記錄詳情:', allSends.map(s => ({ id: s.id, nodeId: s.nodeId, sendReason: s.sendReason })));
      }
      
      setAllMessageSends(allSends);
      
      // 按發送原因分類
      const classified = {
        normal: [],
        retry: [],
        escalation: []
      };

      allSends.forEach(record => {
        console.log(`📂 分類記錄: ${record.id}, sendReason: ${record.sendReason || 'null'}`);
        switch (record.sendReason) {
          case 'normal':
            classified.normal.push(record);
            console.log(`✅ 添加到 normal 分類`);
            break;
          case 'retry':
            classified.retry.push(record);
            console.log(`✅ 添加到 retry 分類`);
            break;
          case 'escalation':
            classified.escalation.push(record);
            console.log(`✅ 添加到 escalation 分類`);
            break;
          default:
            classified.normal.push(record);
            console.log(`✅ 添加到 normal 分類 (default)`);
        }
      });
      
      console.log('📊 最終分類結果:', {
        normal: classified.normal.length,
        retry: classified.retry.length,
        escalation: classified.escalation.length
      });

      // 按時間排序（最新的在前）
      Object.keys(classified).forEach(key => {
        classified[key].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
      });

      setMessageSends(classified);
      console.log('✅ 分類後的消息發送記錄:', classified);
      
    } catch (error) {
      console.error('❌ 載入消息發送記錄失敗:', error);
      message.error(t('workflowMonitor.loadMessageSendRecordsFailed') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getSendReasonTag = (sendReason) => {
    const reasonConfig = {
      normal: { color: 'blue', text: t('workflowMonitor.normalSend') },
      retry: { color: 'orange', text: t('workflowMonitor.retrySend') },
      escalation: { color: 'red', text: t('workflowMonitor.escalationNotification') },
      overdue: { color: 'purple', text: t('workflowMonitor.overdue') }
    };
    
    const config = reasonConfig[sendReason] || reasonConfig.normal;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      Pending: { color: 'default', text: t('workflowMonitor.pending') },
      InProgress: { color: 'processing', text: t('workflowMonitor.inProgress') },
      Completed: { color: 'success', text: t('workflowMonitor.completed') },
      Failed: { color: 'error', text: t('workflowMonitor.failed') },
      PartiallyFailed: { color: 'warning', text: t('workflowMonitor.partiallyFailed') }
    };
    
    const config = statusConfig[status] || statusConfig.Pending;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getRecipientStatusTag = (status) => {
    const statusConfig = {
      Pending: { color: 'default', text: t('workflowMonitor.pending') },
      Sent: { color: 'processing', text: t('workflowMonitor.sent') },
      Delivered: { color: 'success', text: t('workflowMonitor.delivered') },
      Read: { color: 'success', text: t('workflowMonitor.read') },
      Failed: { color: 'error', text: t('workflowMonitor.failed') },
      Retrying: { color: 'warning', text: t('workflowMonitor.retrying') }
    };
    
    const config = statusConfig[status] || statusConfig.Pending;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const calculateStatistics = (records) => {
    const stats = {
      total: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      pending: 0
    };

    records.forEach(record => {
      stats.total += record.totalRecipients || 0;
      stats.sent += record.successCount || 0;
      stats.failed += record.failedCount || 0;
    });

    return stats;
  };

  const renderOverviewTab = (records, type) => {
    const statistics = calculateStatistics(records);
    
    return (
      <div>
        {/* 統計卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title={t('workflowMonitor.totalSendCount')}
                value={statistics.total}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title={t('workflowMonitor.successCount')}
                value={statistics.sent}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title={t('workflowMonitor.failureCount')}
                value={statistics.failed}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 消息發送記錄列表 */}
        <Card title={type === 'normal' ? t('workflowMonitor.normalSendRecords') : type === 'retry' ? t('workflowMonitor.retrySendRecords') : t('workflowMonitor.escalationSendRecords')}>
          {records.length > 0 ? (
            <Table
              dataSource={records}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 1200 }}
              columns={[
                {
                  title: t('workflowMonitor.messageSendId'),
                  dataIndex: 'id',
                  key: 'id',
                  width: 200,
                  ellipsis: true,
                  render: (text, record) => (
                    <Text code style={{ fontSize: '12px' }}>
                      {text.substring(0, 8)}...
                    </Text>
                  )
                },
                {
                  title: t('workflowMonitor.nodeId'),
                  dataIndex: 'nodeId',
                  key: 'nodeId',
                  width: 120,
                  render: (text) => text || '-'
                },
                {
                  title: t('workflowMonitor.sendReason'),
                  dataIndex: 'sendReason',
                  key: 'sendReason',
                  width: 120,
                  render: (sendReason) => getSendReasonTag(sendReason)
                },
                {
                  title: t('workflowMonitor.status'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (status) => getStatusTag(status)
                },
                {
                  title: t('workflowMonitor.totalRecipients'),
                  dataIndex: 'totalRecipients',
                  key: 'totalRecipients',
                  width: 80,
                  align: 'center'
                },
                {
                  title: t('workflowMonitor.successCount'),
                  dataIndex: 'successCount',
                  key: 'successCount',
                  width: 80,
                  align: 'center'
                },
                {
                  title: t('workflowMonitor.failedCount'),
                  dataIndex: 'failedCount',
                  key: 'failedCount',
                  width: 80,
                  align: 'center'
                },
                {
                  title: t('workflowMonitor.creator'),
                  dataIndex: 'createdBy',
                  key: 'createdBy',
                  width: 100,
                  render: (text) => text || '-'
                },
                {
                  title: t('workflowMonitor.startTime'),
                  dataIndex: 'startedAt',
                  key: 'startedAt',
                  width: 120,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.operation'),
                  key: 'actions',
                  width: 100,
                  fixed: 'right',
                  render: (_, record) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleViewDetail(record.id)}
                    >
                      {t('workflowMonitor.viewDetails')}
                    </Button>
                  )
                }
              ]}
            />
          ) : (
            <Empty 
              description={t('workflowMonitor.noMessageSendRecords')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </Card>

        {/* 收件人詳情 */}
        {currentMessageSend && currentMessageSend.recipients && currentMessageSend.recipients.length > 0 && (
          <Card 
            title={`${t('workflowMonitor.recipientDetails')} (${currentMessageSend.recipients.length} ${t('workflowMonitor.person')})`} 
            className="message-send-detail"
            style={{ marginTop: 16 }}
          >
            <Table
              dataSource={currentMessageSend.recipients}
              rowKey="id"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 1200 }}
              size="small"
              columns={[
                {
                  title: t('workflowMonitor.recipient'),
                  key: 'recipient',
                  width: 200,
                  render: (_, record) => (
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                        {record.recipientName || '未命名'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {record.phoneNumber}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999' }}>
                        {record.recipientType}
                      </div>
                    </div>
                  )
                },
                {
                  title: t('workflowMonitor.status'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (status) => getRecipientStatusTag(status)
                },
                {
                  title: t('workflowMonitor.whatsAppMessageId'),
                  dataIndex: 'whatsAppMessageId',
                  key: 'whatsAppMessageId',
                  width: 180,
                  ellipsis: true,
                  render: (text) => (
                    <Text code style={{ fontSize: '11px' }}>
                      {text ? `${text.substring(0, 12)}...` : '-'}
                    </Text>
                  )
                },
                {
                  title: t('workflowMonitor.sendTime'),
                  dataIndex: 'sentAt',
                  key: 'sentAt',
                  width: 120,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.deliveredTime'),
                  dataIndex: 'deliveredAt',
                  key: 'deliveredAt',
                  width: 120,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.readTime'),
                  dataIndex: 'readAt',
                  key: 'readAt',
                  width: 120,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.retryCount'),
                  key: 'retryInfo',
                  width: 100,
                  render: (_, record) => (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: record.retryCount > 0 ? '#fa8c16' : '#52c41a' }}>
                        {record.retryCount || 0}
                      </div>
                      {record.maxRetries && (
                        <div style={{ fontSize: '11px', color: '#999' }}>
                          / {record.maxRetries}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  title: t('workflowMonitor.errorMessage'),
                  dataIndex: 'errorMessage',
                  key: 'errorMessage',
                  width: 150,
                  ellipsis: true,
                  render: (text) => text ? (
                    <Tooltip title={text}>
                      <Text style={{ color: '#ff4d4f', fontSize: '12px' }}>
                        {text.length > 20 ? `${text.substring(0, 20)}...` : text}
                      </Text>
                    </Tooltip>
                  ) : '-'
                },
                {
                  title: t('workflowMonitor.createTime'),
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  width: 120,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'MM-DD HH:mm:ss') : '-'
                }
              ]}
            />
          </Card>
        )}
      </div>
    );
  };

  const handleViewDetail = (messageSendId) => {
    // 找到對應的消息發送記錄並設為當前顯示
    const messageSend = allMessageSends.find(ms => ms.id === messageSendId);
    if (messageSend) {
      setCurrentMessageSend(messageSend);
      // 滾動到詳情區域
      setTimeout(() => {
        const detailElement = document.querySelector('.message-send-detail');
        if (detailElement) {
          detailElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      title={t('workflowMonitor.messageSendStatus')}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={1400}
      style={{ top: 20 }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingMessageSendRecords')}</p>
        </div>
      ) : (
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane 
            tab={
              <span>
                {t('workflowMonitor.normalSend')}
                {messageSends.normal.length > 0 && (
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {messageSends.normal.length}
                  </Tag>
                )}
              </span>
            } 
            key="normal"
          >
            {renderOverviewTab(messageSends.normal, 'normal')}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                {t('workflowMonitor.retrySend')}
                {messageSends.retry.length > 0 && (
                  <Tag color="orange" style={{ marginLeft: 8 }}>
                    {messageSends.retry.length}
                  </Tag>
                )}
              </span>
            } 
            key="retry"
          >
            {renderOverviewTab(messageSends.retry, 'retry')}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                {t('workflowMonitor.escalationNotification')}
                {messageSends.escalation.length > 0 && (
                  <Tag color="red" style={{ marginLeft: 8 }}>
                    {messageSends.escalation.length}
                  </Tag>
                )}
              </span>
            } 
            key="escalation"
          >
            {renderOverviewTab(messageSends.escalation, 'escalation')}
          </TabPane>
        </Tabs>
      )}
    </Modal>
  );
};

export default MessageSendStatusModal;
