import React, { useState, useEffect } from 'react';
import { Table, Input, Button, Space, Tag, message, Pagination, Card, Typography, Tooltip, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, ExclamationCircleOutlined, BranchesOutlined, CheckCircleOutlined, StopOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
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

  // columns 狀態化與寬度調整
  const baseColumns = [
    { title: t('workflow.name'), dataIndex: 'name', key: 'name', width: 200, ellipsis: true, sorter: true },
    { title: t('workflow.createdBy'), dataIndex: 'createdBy', key: 'createdBy', width: 120, sorter: true },
    { title: t('workflow.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 160, sorter: true, render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '' },
    { title: t('workflow.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', width: 160, sorter: true, render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '' },
    { title: t('workflow.status'), dataIndex: 'status', key: 'status', width: 80, sorter: true, render: (text) => <Tag color={text === 'Enabled' ? 'green' : 'red'}>{text === 'Enabled' ? t('workflowDesigner.statusEnabled') : t('workflowDesigner.statusDisabled')}</Tag> },
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
  ];
  const [resizableColumns, setResizableColumns] = useState(
    baseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
  );
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

  const handleDelete = (record) => {
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
          await fetch(`/api/workflowdefinitions/${record.id}`, { 
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          message.success(t('workflow.deleteSuccess'));
          fetchData(pagination.current, pagination.pageSize, searchText);
        } catch {
          message.error(t('workflow.deleteFailed'));
        }
      },
    });
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
        fetchData(pagination.current, pagination.pageSize, searchText);
      } else {
        message.error(t('workflowList.batchDeleteFailed'));
      }
    } catch (error) {
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
              onClick={() => setIsBatchDeleteModalVisible(true)}
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
        title={t('workflowList.confirmBatchDelete')}
        open={isBatchDeleteModalVisible}
        onOk={handleBatchDelete}
        onCancel={() => setIsBatchDeleteModalVisible(false)}
        okText={t('workflowList.confirmDelete')}
        cancelText={t('workflowList.cancel')}
        okType="danger"
      >
        <p>{t('workflowList.confirmDeleteSelected')} {selectedWorkflows.length} {t('workflowList.workflows')}？</p>
        <p style={{ color: '#ff4d4f', fontSize: '12px' }}>{t('workflowList.cannotBeUndone')}</p>
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