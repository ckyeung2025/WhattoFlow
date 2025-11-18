import React, { useState, useEffect } from 'react';
import { Table, Input, Button, Space, Tag, message, Pagination, Card, Typography, Tooltip, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, ExclamationCircleOutlined, BranchesOutlined, CheckCircleOutlined, StopOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
// import dayjs from 'dayjs'; // 已替換為 TimezoneUtils
import { TimezoneUtils } from '../utils/timezoneUtils';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { useLanguage } from '../contexts/LanguageContext';

const { Title } = Typography;
const { confirm } = Modal;

// 假資料

// ResizableTitle 元件
const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[30, 0]}
      handle={
        <span
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px', cursor: 'col-resize', zIndex: 1, userSelect: 'none' }}
          onClick={e => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ position: 'relative' }} />
    </Resizable>
  );
};

const WorkflowListPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [selectedWorkflows, setSelectedWorkflows] = useState([]);
  const [isBatchDeleteModalVisible, setIsBatchDeleteModalVisible] = useState(false);
  const [isBatchStatusModalVisible, setIsBatchStatusModalVisible] = useState(false);
  const [batchStatusAction, setBatchStatusAction] = useState(''); // 'enable' or 'disable'
  const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8'); // 默認香港時區
  const [batchRelatedRecords, setBatchRelatedRecords] = useState(null);
  const [loadingBatchRelatedRecords, setLoadingBatchRelatedRecords] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  // 表格選擇配置
  const rowSelection = {
    selectedRowKeys: selectedWorkflows,
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedWorkflows(selectedRowKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  };

  // columns 狀態化與寬度調整 - 使用 useMemo 確保時區更新時重新創建
  const baseColumns = React.useMemo(() => [
    { title: t('workflow.name'), dataIndex: 'name', key: 'name', width: 200, ellipsis: true, sorter: true },
    { title: t('workflow.createdBy'), dataIndex: 'createdBy', key: 'createdBy', width: 120, sorter: true },
    { title: t('workflow.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 160, sorter: true, render: (text) => text ? TimezoneUtils.formatDateWithTimezone(text, userTimezoneOffset, 'YYYY-MM-DD HH:mm') : '' },
    { title: t('workflow.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', width: 160, sorter: true, render: (text) => text ? TimezoneUtils.formatDateWithTimezone(text, userTimezoneOffset, 'YYYY-MM-DD HH:mm') : '' },
    { 
      title: t('workflow.status'), 
      dataIndex: 'status', 
      key: 'status', 
      width: 100, 
      sorter: true, 
      render: (text, record) => (
        <Tag 
          color={text === 'Enabled' ? 'green' : 'red'}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => handleToggleStatus(record)}
        >
          {text === 'Enabled' ? t('workflowDesigner.statusEnabled') : t('workflowDesigner.statusDisabled')}
        </Tag>
      )
    },
    {
      title: t('workflow.action'),
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('workflow.design')}>
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={t('workflowList.manualStart')}>
            <Button 
              type="text" 
              icon={<PlayCircleOutlined />} 
              onClick={() => handleManualStart(record)}
            />
          </Tooltip>
          <Tooltip title={t('workflow.copy')}>
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => handleCopy(record)}
            />
          </Tooltip>
          <Tooltip title={t('workflow.delete')}>
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ], [t, userTimezoneOffset]); // 依賴 userTimezoneOffset 和 t
  const [resizableColumns, setResizableColumns] = useState(
    baseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
  );
  
  // 當 baseColumns 改變時，更新 resizableColumns
  useEffect(() => {
    setResizableColumns(baseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 })));
  }, [baseColumns]);
  
  const handleResize = index => (e, { size }) => {
    const nextColumns = [...resizableColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setResizableColumns(nextColumns);
  };
  const mergedColumns = resizableColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handleResize(index),
    }),
  }));
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  // 模擬 API 查詢
  const fetchData = async (page = 1, pageSize = 10, search = '', sortBy, sortOrder) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, pageSize, search });
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workflowdefinitions?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      
      // 確保所有必要的字段都有默認值
      setData(Array.isArray(result.data) ? result.data : []);
      setPagination({ 
        current: result.page || page, 
        pageSize: result.pageSize || pageSize, 
        total: result.total || 0 
      });
    } catch (err) {
      console.error('載入流程失敗:', err);
      message.error('載入流程失敗');
      // 設置默認值
      setData([]);
      setPagination({ current: page, pageSize, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  // 獲取用戶時區信息
  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const parsedUserInfo = JSON.parse(userInfo);
        if (parsedUserInfo.timezone) {
          setUserTimezoneOffset(parsedUserInfo.timezone);
        }
      } catch (error) {
        console.error('解析用戶信息失敗:', error);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = () => {
    fetchData(1, pagination.pageSize, searchText);
  };

  // Table onChange 支援排序
  const handleTableChange = (paginationInfo, filters, sorter) => {
    fetchData(
      paginationInfo.current,
      paginationInfo.pageSize,
      searchText,
      sorter.field,
      sorter.order === 'ascend' ? 'ASC' : sorter.order === 'descend' ? 'DESC' : undefined
    );
  };

  const handleEdit = (record) => {
    // 跳轉到設計器，帶流程 id
    navigate(`/whatsapp-workflow?id=${record.id}`);
  };

  const handleDelete = async (record) => {
    try {
      // 先查詢相關記錄
      const token = localStorage.getItem('token');
      const relatedRecordsRes = await fetch(`/api/workflowdefinitions/${record.id}/related-records`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      let relatedRecords = null;
      if (relatedRecordsRes.ok) {
        relatedRecords = await relatedRecordsRes.json();
      }

      // 計算總記錄數
      const totalRecords = relatedRecords ? (
        relatedRecords.executionCount +
        relatedRecords.stepExecutionCount +
        relatedRecords.messageSendCount +
        relatedRecords.messageRecipientCount +
        relatedRecords.queryResultCount +
        relatedRecords.queryRecordCount +
        relatedRecords.eformInstanceCount +
        relatedRecords.messageValidationCount +
        relatedRecords.chatMsgCount +
        relatedRecords.processVariableValueCount +
        relatedRecords.processVariableDefinitionCount
      ) : 0;

      // 構建確認對話框內容
      const buildContent = () => {
        // 即使沒有相關記錄，也要顯示警告
        if (!relatedRecords || totalRecords === 0) {
          return (
            <div>
              <div style={{ 
                background: '#fff2e8', 
                border: '2px solid #ff7875', 
                borderRadius: '6px', 
                padding: '16px', 
                marginBottom: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '20px', marginRight: '8px' }} />
                  <strong style={{ color: '#ff4d4f', fontSize: '16px' }}>
                    {t('workflowList.warningDeleteTitle')}
                  </strong>
                </div>
                <p style={{ color: '#d4380d', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
                  {t('workflowList.warningDeleteDescription')}
                </p>
              </div>
              
              <div style={{ 
                background: '#ffebe8', 
                borderLeft: '4px solid #ff4d4f', 
                padding: '12px', 
                marginTop: '16px' 
              }}>
                <p style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
                  {t('workflowList.criticalWarning')}
                </p>
              </div>
            </div>
          );
        }

        const recordItems = [];
        if (relatedRecords.executionCount > 0) {
          recordItems.push(
            <li key="executions">{t('workflowList.executionInstances')}: {relatedRecords.executionCount}</li>
          );
        }
        if (relatedRecords.stepExecutionCount > 0) {
          recordItems.push(
            <li key="steps">{t('workflowList.stepExecutions')}: {relatedRecords.stepExecutionCount}</li>
          );
        }
        if (relatedRecords.messageSendCount > 0) {
          recordItems.push(
            <li key="messages">{t('workflowList.messageSends')}: {relatedRecords.messageSendCount}</li>
          );
        }
        if (relatedRecords.messageRecipientCount > 0) {
          recordItems.push(
            <li key="recipients">{t('workflowList.messageRecipients')}: {relatedRecords.messageRecipientCount}</li>
          );
        }
        if (relatedRecords.queryResultCount > 0) {
          recordItems.push(
            <li key="queryResults">{t('workflowList.queryResults')}: {relatedRecords.queryResultCount}</li>
          );
        }
        if (relatedRecords.queryRecordCount > 0) {
          recordItems.push(
            <li key="queryRecords">{t('workflowList.queryRecords')}: {relatedRecords.queryRecordCount}</li>
          );
        }
        if (relatedRecords.eformInstanceCount > 0) {
          recordItems.push(
            <li key="eforms">{t('workflowList.eformInstances')}: {relatedRecords.eformInstanceCount}</li>
          );
        }
        if (relatedRecords.messageValidationCount > 0) {
          recordItems.push(
            <li key="validations">{t('workflowList.messageValidations')}: {relatedRecords.messageValidationCount}</li>
          );
        }
        if (relatedRecords.chatMsgCount > 0) {
          recordItems.push(
            <li key="chats">{t('workflowList.chatMessages')}: {relatedRecords.chatMsgCount}</li>
          );
        }
        if (relatedRecords.processVariableValueCount > 0) {
          recordItems.push(
            <li key="varValues">{t('workflowList.processVariableValues')}: {relatedRecords.processVariableValueCount}</li>
          );
        }
        if (relatedRecords.processVariableDefinitionCount > 0) {
          recordItems.push(
            <li key="varDefs">{t('workflowList.processVariableDefinitions')}: {relatedRecords.processVariableDefinitionCount}</li>
          );
        }

        return (
          <div>
            <div style={{ 
              background: '#fff2e8', 
              border: '2px solid #ff7875', 
              borderRadius: '6px', 
              padding: '16px', 
              marginBottom: '16px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '20px', marginRight: '8px' }} />
                <strong style={{ color: '#ff4d4f', fontSize: '16px' }}>
                  {t('workflowList.warningDeleteTitle')}
                </strong>
              </div>
              <p style={{ color: '#d4380d', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
                {t('workflowList.warningDeleteDescription')}
              </p>
            </div>
            
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{t('workflowList.relatedRecordsWillBeDeleted')}</p>
            <ul style={{ marginTop: '8px', paddingLeft: '20px', marginBottom: '16px' }}>
              {recordItems}
            </ul>
            
            <div style={{ 
              background: '#ffebe8', 
              borderLeft: '4px solid #ff4d4f', 
              padding: '12px', 
              marginTop: '16px' 
            }}>
              <p style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
                {t('workflowList.criticalWarning')}
              </p>
            </div>
          </div>
        );
      };

      confirm({
        title: t('workflowList.deleteWithRelatedRecords'),
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
        content: buildContent(),
        okText: t('workflow.confirmDeleteOk'),
        okType: 'danger',
        cancelText: t('workflow.confirmDeleteCancel'),
        width: 600,
        style: { top: 100 },
        async onOk() {
          try {
            const deleteRes = await fetch(`/api/workflowdefinitions/${record.id}`, { 
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (!deleteRes.ok) {
              const errorData = await deleteRes.json().catch(() => ({}));
              throw new Error(errorData.error || errorData.details || '刪除失敗');
            }

            message.success(t('workflow.deleteSuccess'));
            fetchData(pagination.current, pagination.pageSize, searchText);
          } catch (err) {
            console.error('刪除流程失敗:', err);
            message.error(err.message || t('workflow.deleteFailed'));
          }
        },
      });
    } catch (err) {
      console.error('查詢相關記錄失敗:', err);
      // 如果查詢失敗，仍然顯示基本確認對話框
    confirm({
      title: t('workflow.confirmDeleteTitle'),
      icon: <ExclamationCircleOutlined />,
      content: t('workflow.confirmDeleteContent', { name: record.name }),
      okText: t('workflow.confirmDeleteOk'),
      okType: 'danger',
      cancelText: t('workflow.confirmDeleteCancel'),
      async onOk() {
        try {
          const token = localStorage.getItem('token');
            const deleteRes = await fetch(`/api/workflowdefinitions/${record.id}`, { 
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

            if (!deleteRes.ok) {
              const errorData = await deleteRes.json().catch(() => ({}));
              throw new Error(errorData.error || errorData.details || '刪除失敗');
            }

          message.success(t('workflow.deleteSuccess'));
          fetchData(pagination.current, pagination.pageSize, searchText);
          } catch (err) {
            console.error('刪除流程失敗:', err);
            message.error(err.message || t('workflow.deleteFailed'));
        }
      },
    });
    }
  };

  const handleCopy = async (record) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/workflowdefinitions/${record.id}/copy`, { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      message.success(t('workflow.copySuccess'));
      fetchData(pagination.current, pagination.pageSize, searchText);
    } catch {
      message.error(t('workflow.copyFailed'));
    }
  };

  // 切換流程狀態（啟用/停用）
  const handleToggleStatus = async (record) => {
    const isCurrentlyEnabled = record.status === 'Enabled';
    const actionText = isCurrentlyEnabled ? t('workflowDesigner.statusDisabled') : t('workflowDesigner.statusEnabled');
    
    confirm({
      title: t('workflowList.confirmStatusChange'),
      content: t('workflowList.confirmStatusChangeContent', { 
        name: record.name, 
        action: actionText 
      }),
      okText: actionText, // 動態顯示"停用"或"啟用"
      cancelText: t('workflow.confirmDeleteCancel'),
      okType: isCurrentlyEnabled ? 'danger' : 'primary', // 停用時顯示危險樣式，啟用時顯示主要樣式
      async onOk() {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/workflowdefinitions/batch-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              ids: [record.id],
              isActive: !isCurrentlyEnabled // 如果當前是啟用，則設為停用(false)，反之設為啟用(true)
            }),
          });

          if (response.ok) {
            message.success(`${t('workflowList.successfullyChangedStatus')} ${actionText}`);
            fetchData(pagination.current, pagination.pageSize, searchText);
          } else {
            const errorData = await response.json().catch(() => ({}));
            message.error(errorData.error || t('workflowList.statusChangeFailed'));
          }
        } catch (error) {
          console.error('切換狀態失敗:', error);
          message.error(t('workflowList.statusChangeFailed'));
        }
      },
    });
  };

  // 手動啟動流程
  const handleManualStart = async (record) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workflowdefinitions/${record.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          inputData: {
            message: t('workflowList.manualStartMessage'),
            timestamp: new Date().toISOString(),
            userId: 'manual-user'
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        message.success(`流程 "${record.name}" ${t('workflowList.workflowStarted')}`);
        console.log('流程執行結果:', result);
      } else {
        message.error('啟動流程失敗');
      }
    } catch (error) {
      message.error('啟動流程失敗');
    }
  };

  const handleAdd = () => {
    navigate('/whatsapp-workflow');
  };

  // 打開批量刪除確認對話框
  const handleOpenBatchDeleteModal = async () => {
    if (selectedWorkflows.length === 0) {
      message.warning(t('workflowList.pleaseSelectWorkflows'));
      return;
    }

    // 先查詢相關記錄
    setLoadingBatchRelatedRecords(true);
    try {
      const token = localStorage.getItem('token');
      const relatedRecordsRes = await fetch('/api/workflowdefinitions/batch-related-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ids: selectedWorkflows
        }),
      });

      if (relatedRecordsRes.ok) {
        const relatedRecords = await relatedRecordsRes.json();
        setBatchRelatedRecords(relatedRecords);
      } else {
        setBatchRelatedRecords(null);
      }
    } catch (err) {
      console.error('查詢相關記錄失敗:', err);
      setBatchRelatedRecords(null);
    } finally {
      setLoadingBatchRelatedRecords(false);
      setIsBatchDeleteModalVisible(true);
    }
  };

  // 批量刪除
  const handleBatchDelete = async () => {
    if (selectedWorkflows.length === 0) {
      message.warning(t('workflowList.pleaseSelectWorkflows'));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/workflowdefinitions/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ids: selectedWorkflows
        }),
      });

      if (response.ok) {
        message.success(`${t('workflowList.successfullyDeleted')} ${selectedWorkflows.length} ${t('workflowList.workflows')}`);
        setSelectedWorkflows([]);
        setIsBatchDeleteModalVisible(false);
        setBatchRelatedRecords(null);
        fetchData(pagination.current, pagination.pageSize, searchText);
      } else {
        const errorData = await response.json().catch(() => ({}));
        message.error(errorData.error || errorData.details || t('workflowList.batchDeleteFailed'));
      }
    } catch (error) {
      console.error('批量刪除失敗:', error);
      message.error(t('workflowList.batchDeleteFailed'));
    }
  };

  // 批量啟用/停用
  const handleBatchStatus = async () => {
    if (selectedWorkflows.length === 0) {
      message.warning(t('workflowList.pleaseSelectWorkflowsToOperate'));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/workflowdefinitions/batch-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ids: selectedWorkflows,
          isActive: batchStatusAction === 'enable'
        }),
      });

      if (response.ok) {
        const actionText = batchStatusAction === 'enable' ? t('workflowList.successfullyEnabled') : t('workflowList.successfullyDisabled');
        message.success(`${actionText} ${selectedWorkflows.length} ${t('workflowList.workflows')}`);
        setSelectedWorkflows([]);
        setIsBatchStatusModalVisible(false);
        fetchData(pagination.current, pagination.pageSize, searchText);
      } else {
        message.error(t('workflowList.batchOperationFailed'));
      }
    } catch (error) {
      message.error(t('workflowList.batchOperationFailed'));
    }
  };

  return (
    <div style={{ padding: '8px' }}>
      <Card bodyStyle={{ padding: '12px 12px 8px 12px' }} style={{ boxShadow: 'none', borderRadius: 8, margin: 0 }}>
        {/* 標題和操作按鈕 */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ padding: '0 12px' }}>
              {t('workflowList.add')}
            </Button>
            <Button 
              type="default" 
              icon={<DeleteOutlined />} 
              onClick={handleOpenBatchDeleteModal}
              disabled={selectedWorkflows.length === 0}
              title={t('workflowList.batchDelete')}
            >
              {t('workflowList.batchDelete')} ({selectedWorkflows.length})
            </Button>
            <Button 
              type="default" 
              icon={<CheckCircleOutlined />} 
              onClick={() => {
                setBatchStatusAction('enable');
                setIsBatchStatusModalVisible(true);
              }}
              disabled={selectedWorkflows.length === 0}
              title={t('workflowList.batchEnable')}
            >
              {t('workflowList.batchEnable')} ({selectedWorkflows.length})
            </Button>
            <Button 
              type="default" 
              icon={<StopOutlined />} 
              onClick={() => {
                setBatchStatusAction('disable');
                setIsBatchStatusModalVisible(true);
              }}
              disabled={selectedWorkflows.length === 0}
              title={t('workflowList.batchDisable')}
            >
              {t('workflowList.batchDisable')} ({selectedWorkflows.length})
            </Button>
          </Space>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ margin: 0 }}>
              <BranchesOutlined style={{ marginRight: '8px' }} />
              {t('menu.whatsappWorkflow')}
            </h2>
          </div>
        </div>

        {/* 搜索和篩選 */}
        <Card style={{ marginBottom: '16px' }}>
          <Space wrap>
            <Input.Search
              placeholder={t('workflow.searchPlaceholder')}
              allowClear
              style={{ width: 300 }}
              onSearch={handleSearch}
              onPressEnter={(e) => handleSearch(e.target.value)}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Button
              onClick={() => {
                setSearchText('');
                setPagination(prev => ({ ...prev, current: 1 }));
              }}
            >
              {t('workflowList.clearFilter')}
            </Button>
          </Space>
        </Card>

        <Table
          components={components}
          columns={mergedColumns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          style={{ width: '100%' }}
          onChange={handleTableChange}
          rowSelection={rowSelection}
        />
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Pagination
            current={pagination.current || 1}
            pageSize={pagination.pageSize || 10}
            total={pagination.total || 0}
            showSizeChanger
            pageSizeOptions={['10', '20', '50', '100']}
            showTotal={(total, range) => `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`}
            onChange={(page, pageSize) => fetchData(page, pageSize, searchText)}
            onShowSizeChange={(current, size) => fetchData(1, size, searchText)}
          />
        </div>
      </Card>

      {/* 批量刪除確認對話框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '20px' }} />
            <span>{t('workflowList.deleteWithRelatedRecords')}</span>
          </div>
        }
        open={isBatchDeleteModalVisible}
        onOk={handleBatchDelete}
        onCancel={() => {
          setIsBatchDeleteModalVisible(false);
          setBatchRelatedRecords(null);
        }}
        okText={t('workflowList.confirmDelete')}
        cancelText={t('workflowList.cancel')}
        okType="danger"
        width={650}
        style={{ top: 100 }}
      >
        {loadingBatchRelatedRecords ? (
          <p>{t('workflowList.loadingRelatedRecords')}</p>
        ) : (
          <div>
        <p>{t('workflowList.confirmDeleteSelected')} {selectedWorkflows.length} {t('workflowList.workflows')}？</p>
            
            {batchRelatedRecords && (() => {
              const totalRecords = 
                batchRelatedRecords.executionCount +
                batchRelatedRecords.stepExecutionCount +
                batchRelatedRecords.messageSendCount +
                batchRelatedRecords.messageRecipientCount +
                batchRelatedRecords.queryResultCount +
                batchRelatedRecords.queryRecordCount +
                batchRelatedRecords.eformInstanceCount +
                batchRelatedRecords.messageValidationCount +
                batchRelatedRecords.chatMsgCount +
                batchRelatedRecords.processVariableValueCount +
                batchRelatedRecords.processVariableDefinitionCount;

              if (totalRecords === 0) {
                return <p style={{ marginTop: '12px' }}>{t('workflowList.noRelatedRecords')}</p>;
              }

              const recordItems = [];
              if (batchRelatedRecords.executionCount > 0) {
                recordItems.push(
                  <li key="executions">{t('workflowList.executionInstances')}: {batchRelatedRecords.executionCount}</li>
                );
              }
              if (batchRelatedRecords.stepExecutionCount > 0) {
                recordItems.push(
                  <li key="steps">{t('workflowList.stepExecutions')}: {batchRelatedRecords.stepExecutionCount}</li>
                );
              }
              if (batchRelatedRecords.messageSendCount > 0) {
                recordItems.push(
                  <li key="messages">{t('workflowList.messageSends')}: {batchRelatedRecords.messageSendCount}</li>
                );
              }
              if (batchRelatedRecords.messageRecipientCount > 0) {
                recordItems.push(
                  <li key="recipients">{t('workflowList.messageRecipients')}: {batchRelatedRecords.messageRecipientCount}</li>
                );
              }
              if (batchRelatedRecords.queryResultCount > 0) {
                recordItems.push(
                  <li key="queryResults">{t('workflowList.queryResults')}: {batchRelatedRecords.queryResultCount}</li>
                );
              }
              if (batchRelatedRecords.queryRecordCount > 0) {
                recordItems.push(
                  <li key="queryRecords">{t('workflowList.queryRecords')}: {batchRelatedRecords.queryRecordCount}</li>
                );
              }
              if (batchRelatedRecords.eformInstanceCount > 0) {
                recordItems.push(
                  <li key="eforms">{t('workflowList.eformInstances')}: {batchRelatedRecords.eformInstanceCount}</li>
                );
              }
              if (batchRelatedRecords.messageValidationCount > 0) {
                recordItems.push(
                  <li key="validations">{t('workflowList.messageValidations')}: {batchRelatedRecords.messageValidationCount}</li>
                );
              }
              if (batchRelatedRecords.chatMsgCount > 0) {
                recordItems.push(
                  <li key="chats">{t('workflowList.chatMessages')}: {batchRelatedRecords.chatMsgCount}</li>
                );
              }
              if (batchRelatedRecords.processVariableValueCount > 0) {
                recordItems.push(
                  <li key="varValues">{t('workflowList.processVariableValues')}: {batchRelatedRecords.processVariableValueCount}</li>
                );
              }
              if (batchRelatedRecords.processVariableDefinitionCount > 0) {
                recordItems.push(
                  <li key="varDefs">{t('workflowList.processVariableDefinitions')}: {batchRelatedRecords.processVariableDefinitionCount}</li>
                );
              }

              return (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ 
                    background: '#fff2e8', 
                    border: '2px solid #ff7875', 
                    borderRadius: '6px', 
                    padding: '16px', 
                    marginBottom: '16px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '20px', marginRight: '8px' }} />
                      <strong style={{ color: '#ff4d4f', fontSize: '16px' }}>
                        {t('workflowList.warningDeleteTitle')}
                      </strong>
                    </div>
                    <p style={{ color: '#d4380d', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
                      {t('workflowList.warningDeleteDescription')}
                    </p>
                  </div>
                  
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{t('workflowList.relatedRecordsWillBeDeleted')}</p>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px', marginBottom: '16px' }}>
                    {recordItems}
                  </ul>
                  
                  <div style={{ 
                    background: '#ffebe8', 
                    borderLeft: '4px solid #ff4d4f', 
                    padding: '12px', 
                    marginTop: '16px' 
                  }}>
                    <p style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
                      {t('workflowList.criticalWarning')}
                    </p>
                  </div>
                </div>
              );
            })()}
            
            {!batchRelatedRecords || (
              batchRelatedRecords.executionCount +
              batchRelatedRecords.stepExecutionCount +
              batchRelatedRecords.messageSendCount +
              batchRelatedRecords.messageRecipientCount +
              batchRelatedRecords.queryResultCount +
              batchRelatedRecords.queryRecordCount +
              batchRelatedRecords.eformInstanceCount +
              batchRelatedRecords.messageValidationCount +
              batchRelatedRecords.chatMsgCount +
              batchRelatedRecords.processVariableValueCount +
              batchRelatedRecords.processVariableDefinitionCount
            ) === 0 ? (
              <div style={{ marginTop: '12px' }}>
                <div style={{ 
                  background: '#fff2e8', 
                  border: '2px solid #ff7875', 
                  borderRadius: '6px', 
                  padding: '16px', 
                  marginBottom: '16px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '20px', marginRight: '8px' }} />
                    <strong style={{ color: '#ff4d4f', fontSize: '16px' }}>
                      {t('workflowList.warningDeleteTitle')}
                    </strong>
                  </div>
                  <p style={{ color: '#d4380d', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
                    {t('workflowList.warningDeleteDescription')}
                  </p>
                </div>
                
                <div style={{ 
                  background: '#ffebe8', 
                  borderLeft: '4px solid #ff4d4f', 
                  padding: '12px' 
                }}>
                  <p style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
                    {t('workflowList.criticalWarning')}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/* 批量啟用/停用確認對話框 */}
      <Modal
        title={batchStatusAction === 'enable' ? t('workflowList.confirmBatchEnable') : t('workflowList.confirmBatchDisable')}
        open={isBatchStatusModalVisible}
        onOk={handleBatchStatus}
        onCancel={() => setIsBatchStatusModalVisible(false)}
        okText={batchStatusAction === 'enable' ? t('workflowList.confirmBatchEnable') : t('workflowList.confirmBatchDisable')}
        cancelText={t('workflowList.cancel')}
      >
        <p>{batchStatusAction === 'enable' ? t('workflowList.confirmEnableSelected') : t('workflowList.confirmDisableSelected')} {selectedWorkflows.length} {t('workflowList.workflows')}？</p>
      </Modal>
    </div>
  );
};

export default WorkflowListPage; 