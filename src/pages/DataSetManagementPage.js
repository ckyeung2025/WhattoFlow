import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, Select, Upload, message, 
  Card, Tag, Space, Typography, Drawer, Tooltip, Popconfirm,
  Tabs, Switch, InputNumber, Divider, Alert, Row, Col, Collapse, Radio, Progress
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined,
  DatabaseOutlined, FileExcelOutlined, LinkOutlined, EyeOutlined,
  UploadOutlined, DownloadOutlined, SettingOutlined, SearchOutlined,
  FilterOutlined, SortAscendingOutlined, SortDescendingOutlined
} from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;
const { Panel } = Collapse;

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

const DataSetManagementPage = () => {
  const [dataSets, setDataSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDataSet, setEditingDataSet] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedDataSet, setSelectedDataSet] = useState(null);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [searchDrawerVisible, setSearchDrawerVisible] = useState(false);
  const [form] = Form.useForm();
  const [dataSourceForm] = Form.useForm();
  const [columnsForm] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // 新增：Excel 工作表相關狀態
  const [sheetNames, setSheetNames] = useState([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  // 在組件頂部添加記錄分頁狀態
  const [recordsPagination, setRecordsPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });

  // 表格列寬調整相關狀態
  const [resizableColumns, setResizableColumns] = useState([]);

  // 同步狀態管理
  const [syncingDataSets, setSyncingDataSets] = useState(new Set());
  
  // 定時檢查同步狀態的間隔器
  const [syncStatusInterval, setSyncStatusInterval] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0); // 強制重新渲染

  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    console.log('DataSetManagementPage: 組件已掛載，開始獲取數據');
    fetchDataSets();
    
    // 啟動定時檢查同步狀態
    startGlobalSyncStatusCheck();
    
    // 組件卸載時清理定時器
    return () => {
      if (syncStatusInterval) {
        clearInterval(syncStatusInterval);
      }
    };
  }, []);

  // 處理 URL 參數中的 edit 參數
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId) {
      console.log('DataSetManagementPage: 檢測到 edit 參數:', editId);
      if (dataSets.length > 0) {
        const datasetToEdit = dataSets.find(dataset =>
          dataset.id === editId ||
          dataset.id.toString() === editId ||
          dataset.name === editId
        );
        if (datasetToEdit) {
          console.log('DataSetManagementPage: 找到要編輯的數據集:', datasetToEdit);
          handleEdit(datasetToEdit);
          // 清除 URL 參數
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        } else {
          console.warn('DataSetManagementPage: 未找到要編輯的數據集:', editId);
          message.warning(t('dataSetManagement.datasetNotFound', { id: editId }));
        }
      }
    }
  }, [dataSets]); // 依賴於 dataSets 確保數據已載入

  const fetchDataSets = async (page = 1, pageSize = 10, sortBy = 'createdAt', sortOrder = 'desc') => {
    console.log(`fetchDataSets: 開始獲取數據，頁面: ${page}, 頁面大小: ${pageSize}, 排序: ${sortBy} ${sortOrder}`);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page,
        pageSize: pageSize,
        sortBy: sortBy,
        sortOrder: sortOrder
      });
      
      const url = `/api/datasets?${params}`;
      console.log('fetchDataSets: 請求 URL:', url);
      console.log('fetchDataSets: 請求參數:', Object.fromEntries(params));
      
      const response = await fetch(url);
      const result = await response.json();
      console.log('fetchDataSets: API 響應結果:', result);
      
      if (result.success) {
        console.log('fetchDataSets: 成功獲取數據，數據集數量:', result.data.length);
        console.log('fetchDataSets: 第一個數據集示例:', result.data[0]);
        
        // 調試：檢查同步狀態數據
        if (result.data.length > 0) {
          const firstDataSet = result.data[0];
          console.log('fetchDataSets: 第一個數據集的同步狀態:', {
            syncStatus: firstDataSet.syncStatus,
            totalRecordsToSync: firstDataSet.totalRecordsToSync,
            recordsProcessed: firstDataSet.recordsProcessed,
            recordsInserted: firstDataSet.recordsInserted,
            recordsUpdated: firstDataSet.recordsUpdated,
            recordsDeleted: firstDataSet.recordsDeleted
          });
        }
        
        setDataSets(result.data);
        if (result.pagination) {
          setPagination({
            current: result.pagination.page,
            pageSize: result.pagination.pageSize,
            total: result.pagination.totalCount
          });
        }
        
        // 檢查是否有運行中的數據集，如果有則啟動全局狀態檢查
        const runningDataSets = result.data.filter(ds => ds.syncStatus === 'Running');
        if (runningDataSets.length > 0 && !syncStatusInterval) {
          console.log(`發現 ${runningDataSets.length} 個運行中的數據集，啟動全局狀態檢查`);
          startGlobalSyncStatusCheck();
        }
      } else {
        console.error('fetchDataSets: API 返回失敗:', result.message);
        message.error(t('dataSetManagement.fetchFailed') + ': ' + result.message);
      }
    } catch (error) {
      console.error('fetchDataSets: 請求失敗:', error);
      message.error(t('dataSetManagement.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    console.log('handleCreate: 開始創建新的 DataSet');
    setEditingDataSet(null);
    setModalVisible(true);
    form.resetFields();
    dataSourceForm.resetFields();
    columnsForm.resetFields();
    
    // 設置預設值
    setTimeout(() => {
      dataSourceForm.setFieldsValue({
        sourceType: 'SQL',  // 設置預設的數據源類型
        connectionType: 'preset',
        presetConnection: 'purple_rice'
      });
    }, 100);
  };

  const handleEdit = (record) => {
    console.log('handleEdit: 開始編輯 DataSet:', record);
    setEditingDataSet(record);
    setModalVisible(true);
    
    // 填充表單數據
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      isScheduled: record.isScheduled,
      updateIntervalMinutes: record.updateIntervalMinutes
    });
    
    // 修正：使用 dataSource 而不是 dataSources
    if (record.dataSource) {
      console.log('handleEdit: 填充數據源表單:', record.dataSource);
      const dataSource = record.dataSource;
      
      // 首先設置 sourceType，確保表單正確顯示
      if (dataSource.sourceType) {
        console.log('設置 sourceType:', dataSource.sourceType);
        dataSourceForm.setFieldsValue({
          sourceType: dataSource.sourceType
        });
      }
      
      // 處理 SQL 連接配置
      if (dataSource.sourceType === 'SQL' && dataSource.authenticationConfig) {
        try {
          const authConfig = JSON.parse(dataSource.authenticationConfig);
          if (authConfig.connectionType === 'preset') {
            dataSourceForm.setFieldsValue({
              sourceType: dataSource.sourceType,
              connectionType: 'preset',
              presetConnection: authConfig.presetName,
              sqlQuery: dataSource.sqlQuery,
              sqlParameters: dataSource.sqlParameters
            });
          } else if (authConfig.connectionType === 'custom') {
            dataSourceForm.setFieldsValue({
              sourceType: dataSource.sourceType,
              connectionType: 'custom',
              serverName: authConfig.serverName,
              port: authConfig.port,
              databaseName: authConfig.databaseName,
              authenticationType: authConfig.authenticationType,
              username: authConfig.username,
              password: authConfig.password,
              additionalOptions: authConfig.additionalOptions,
              sqlQuery: dataSource.sqlQuery,
              sqlParameters: dataSource.sqlParameters
            });
          } else {
            // 向後兼容：舊的 databaseConnection 欄位
            dataSourceForm.setFieldsValue({
              sourceType: dataSource.sourceType,
              connectionType: 'preset',
              presetConnection: dataSource.databaseConnection,
              sqlQuery: dataSource.sqlQuery,
              sqlParameters: dataSource.sqlParameters
            });
          }
        } catch (error) {
          console.error('解析認證配置失敗:', error);
          // 向後兼容：使用舊的 databaseConnection 欄位
          dataSourceForm.setFieldsValue({
            sourceType: dataSource.sourceType,
            connectionType: 'preset',
            presetConnection: dataSource.databaseConnection,
            sqlQuery: dataSource.sqlQuery,
            sqlParameters: dataSource.sqlParameters
          });
        }
      } else {
        // 非 SQL 數據源或其他情況
        console.log('設置非 SQL 數據源字段:', {
          sourceType: dataSource.sourceType,
          googleDocsUrl: dataSource.googleDocsUrl,
          googleDocsSheetName: dataSource.googleDocsSheetName
        });
        
        // 設置所有可能的字段，確保表單有完整的數據
        const fieldsToSet = {
          sourceType: dataSource.sourceType,
          databaseConnection: dataSource.databaseConnection,
          sqlQuery: dataSource.sqlQuery,
          excelFilePath: dataSource.excelFilePath,
          excelSheetName: dataSource.excelSheetName,
          googleDocsUrl: dataSource.googleDocsUrl,
          googleDocsSheetName: dataSource.googleDocsSheetName
        };
        
        console.log('設置的字段值:', fieldsToSet);
        dataSourceForm.setFieldsValue(fieldsToSet);
      }
      
      // 確保 sourceType 總是設置，即使在其他情況下
      if (dataSource.sourceType && !dataSource.authenticationConfig) {
        console.log('確保 sourceType 設置:', dataSource.sourceType);
        dataSourceForm.setFieldsValue({
          sourceType: dataSource.sourceType
        });
      }
    } else {
      console.log('handleEdit: 該 DataSet 沒有數據源配置');
    }
    
    if (record.columns) {
      console.log('handleEdit: 填充欄位表單，欄位數量:', record.columns.length);
      const columnsData = record.columns.map((col, index) => ({
        key: index,
        columnName: col.columnName,
        displayName: col.displayName,
        dataType: col.dataType,
        maxLength: col.maxLength,
        isRequired: col.isRequired,
        isPrimaryKey: col.isPrimaryKey,
        isSearchable: col.isSearchable,
        isSortable: col.isSortable,
        isIndexed: col.isIndexed,
        defaultValue: col.defaultValue,
        sortOrder: col.sortOrder
      }));
      columnsForm.setFieldsValue({ columns: columnsData });
    }
  };

  const handleDelete = async (id) => {
    console.log('handleDelete: 開始刪除 DataSet, ID:', id);
    try {
      const response = await fetch(`/api/datasets/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      console.log('handleDelete: 刪除結果:', result);
      
      if (result.success) {
        message.success(t('dataSetManagement.deleteSuccess'));
        fetchDataSets();
      } else {
        message.error(t('dataSetManagement.deleteFailed') + ': ' + result.message);
      }
    } catch (error) {
      console.error('handleDelete: 刪除請求失敗:', error);
      message.error(t('dataSetManagement.deleteFailed'));
    }
  };

  const handleSync = async (id) => {
    console.log('handleSync: 開始同步 DataSet, ID:', id);
    
    // 檢查是否正在同步
    const dataSet = dataSets.find(ds => ds.id === id);
    if (dataSet?.syncStatus === 'Running') {
      message.warning(t('dataSetManagement.syncInProgress'));
      return;
    }
    
    // 設置同步狀態
    setSyncingDataSets(prev => new Set(prev).add(id));
    
    try {
      const response = await fetch(`/api/datasets/${id}/sync`, {
        method: 'POST'
      });
      const result = await response.json();
      console.log('handleSync: 同步結果:', result);
      
      if (result.success) {
        message.success(t('dataSetManagement.syncStarted'));
        // 開始輪詢同步狀態
        startSyncStatusPolling(id);
      } else {
        message.error(t('dataSetManagement.syncFailed') + ': ' + (result.error || result.message));
      }
    } catch (error) {
      console.error('handleSync: 同步請求失敗:', error);
      message.error(t('dataSetManagement.syncFailed') + ': ' + error.message);
    } finally {
      // 清除同步狀態
      setSyncingDataSets(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // 新增：啟動全局同步狀態檢查
  const startGlobalSyncStatusCheck = () => {
    console.log('啟動全局同步狀態檢查');
    
    const interval = setInterval(async () => {
      try {
        // 定期從服務器獲取最新的數據集狀態，確保能檢測到後台服務啟動的同步
        const response = await fetch('/api/datasets');
        const result = await response.json();
        
        if (result.success) {
          const serverDataSets = result.data;
          
          // 檢查服務器上是否有運行中的數據集
          const runningDataSets = serverDataSets.filter(ds => ds.syncStatus === 'Running');
          
          if (runningDataSets.length > 0) {
            console.log(`服務器上發現 ${runningDataSets.length} 個運行中的數據集，開始檢查狀態`);
            
            // 更新本地狀態
            setDataSets(serverDataSets);
            
            // 並行檢查所有運行中數據集的狀態
            runningDataSets.forEach(async (dataSet) => {
              try {
                const statusResponse = await fetch(`/api/datasets/${dataSet.id}/sync-status`);
                const statusResult = await statusResponse.json();
                
                if (statusResult.success) {
                  const syncStatus = statusResult.data;
                  console.log(`數據集 ${dataSet.name} 同步狀態:`, syncStatus);
                  
                  // 更新 DataSet 的同步狀態
                  setDataSets(prev => prev.map(ds => 
                    ds.id === dataSet.id ? { ...ds, ...syncStatus } : ds
                  ));
                  
                  // 強制重新渲染以更新進度條
                  setForceUpdate(prev => prev + 1);
                  
                  // 如果同步完成或失敗，顯示通知
                  if (syncStatus.syncStatus === 'Completed') {
                    message.success(t('dataSetManagement.syncCompleted', {
                      datasetName: dataSet.name,
                      inserted: syncStatus.recordsInserted || 0,
                      updated: syncStatus.recordsUpdated || 0,
                      deleted: syncStatus.recordsDeleted || 0
                    }));
                  } else if (syncStatus.syncStatus === 'Failed') {
                    message.error(`${dataSet.name} ${t('dataSetManagement.syncFailed')}: ${syncStatus.syncErrorMessage || ''}`);
                  }
                }
              } catch (error) {
                console.error(`檢查數據集 ${dataSet.name} 同步狀態失敗:`, error);
              }
            });
          } else {
            // 如果沒有運行中的數據集，也更新本地狀態以保持同步
            setDataSets(serverDataSets);
          }
        }
      } catch (error) {
        console.error('全局同步狀態檢查失敗:', error);
      }
    }, 10000); // 每10秒檢查一次，平衡實時性和性能
    
    setSyncStatusInterval(interval);
  };

  // 新增：輪詢同步狀態
  const startSyncStatusPolling = (id) => {
    console.log(`開始輪詢同步狀態，數據集ID: ${id}`);
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/datasets/${id}/sync-status`);
        const result = await response.json();
        
        if (result.success) {
          const syncStatus = result.data;
          console.log(`輪詢到同步狀態:`, syncStatus);
          
          // 更新 DataSet 的同步狀態
          setDataSets(prev => prev.map(ds => 
            ds.id === id ? { ...ds, ...syncStatus } : ds
          ));
          
          // 強制重新渲染以更新進度條
          setForceUpdate(prev => prev + 1);
          
          // 如果同步完成或失敗，停止輪詢
          if (syncStatus.syncStatus === 'Completed' || syncStatus.syncStatus === 'Failed') {
            console.log(`同步${syncStatus.syncStatus}，停止輪詢`);
            clearInterval(pollInterval);
            
            if (syncStatus.syncStatus === 'Completed') {
              message.success(t('dataSetManagement.syncCompleted', { 
                inserted: syncStatus.recordsInserted || 0,
                updated: syncStatus.recordsUpdated || 0,
                deleted: syncStatus.recordsDeleted || 0
              }));
            } else if (syncStatus.syncStatus === 'Failed') {
              message.error(t('dataSetManagement.syncFailed') + ': ' + (syncStatus.syncErrorMessage || ''));
            }
            
            // 刷新數據集列表
            fetchDataSets();
          }
        } else {
          console.error('輪詢同步狀態失敗:', result.message);
        }
      } catch (error) {
        console.error('輪詢同步狀態失敗:', error);
        clearInterval(pollInterval);
      }
    }, 10000); // 每10秒輪詢一次，手動同步頻率
    
    // 設置超時，30分鐘後停止輪詢
    setTimeout(() => {
      console.log(`輪詢超時，停止輪詢數據集ID: ${id}`);
      clearInterval(pollInterval);
    }, 30 * 60 * 1000);
  };

  const handleViewRecords = async (record) => {
    console.log('handleViewRecords: 開始查看記錄，DataSet:', record);
    
    // 先設置基本的 DataSet 信息
    setSelectedDataSet(record);
    setDrawerVisible(true);
    
    // 獲取記錄數據
    await fetchRecords(record.id);
    
    // 如果 selectedDataSet 沒有欄位定義，但 records 有數據，動態生成欄位定義
    if (records.length > 0) {
      console.log('檢查記錄數據，準備動態生成欄位定義');
      const firstRecord = records[0];
      
      if (firstRecord.Values && firstRecord.Values.length > 0) {
        console.log('從記錄數據動態生成欄位定義');
        const dynamicColumns = generateDynamicColumns(records);
        
        setSelectedDataSet(prev => ({
          ...prev,
          columns: dynamicColumns
        }));
        
        console.log('動態生成的欄位定義:', dynamicColumns);
      } else {
        console.warn('記錄中沒有 Values 數據');
      }
    }
  };

  // 修改 fetchRecords 函數支持分頁
  const fetchRecords = async (datasetId, searchParams = {}) => {
    console.log('fetchRecords: 開始獲取記錄，DataSet ID:', datasetId, '搜尋參數:', searchParams);
    setRecordsLoading(true);
    try {
      let url = `/api/datasets/${datasetId}/records`;
      
      // 構建查詢參數，包括分頁參數
      const params = new URLSearchParams();
      
      // 添加分頁參數
      const page = searchParams.page || recordsPagination.current;
      const pageSize = searchParams.pageSize || recordsPagination.pageSize;
      params.append('page', page);
      params.append('pageSize', pageSize);
      
      // 添加其他搜尋參數
      Object.keys(searchParams).forEach(key => {
        if (key !== 'page' && key !== 'pageSize') {
          params.append(key, searchParams[key]);
        }
      });
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log('fetchRecords: 請求 URL:', url);
      const response = await fetch(url);
      
      // 檢查響應狀態
      if (!response.ok) {
        const errorText = await response.text();
        console.error('fetchRecords: HTTP 錯誤:', response.status, response.statusText);
        console.error('fetchRecords: 錯誤響應內容:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('fetchRecords: 記錄獲取結果:', result);
      
      if (result.success) {
        console.log('fetchRecords: 成功獲取記錄，記錄數量:', result.data.length);
        
        // 更新記錄數據
        setRecords(result.data);
        
        // 更新分頁信息
        if (result.pagination) {
          setRecordsPagination(prev => ({
            ...prev,
            current: result.pagination.page || page,
            pageSize: result.pagination.pageSize || pageSize,
            total: result.pagination.totalCount || result.data.length
          }));
          console.log('fetchRecords: 更新分頁信息:', {
            current: result.pagination.page || page,
            pageSize: result.pagination.pageSize || pageSize,
            total: result.pagination.totalCount || result.data.length
          });
        } else {
          // 如果後台沒有返回分頁信息，使用默認值
          setRecordsPagination(prev => ({
            ...prev,
            current: page,
            pageSize: pageSize,
            total: result.data.length
          }));
        }
        
        // 添加詳細的數據結構日誌
        if (result.data.length > 0) {
          console.log('fetchRecords: 第一條記錄的完整結構:', result.data[0]);
          console.log('fetchRecords: 第一條記錄的所有屬性:', Object.keys(result.data[0]));
          
          // 檢查是否有 Values 屬性
          if (result.data[0].Values) {
            console.log('fetchRecords: 第一條記錄的 Values 數量:', result.data[0].Values.length);
            console.log('fetchRecords: 第一條記錄的 Values 結構:', result.data[0].Values[0]);
          } else {
            console.warn('fetchRecords: 第一條記錄沒有 Values 屬性！');
            console.log('fetchRecords: 第一條記錄的可用屬性:', result.data[0]);
          }
        }
      } else {
        console.error('fetchRecords: 獲取記錄失敗:', result.message);
        message.error(t('dataSetManagement.fetchRecordsFailed') + ': ' + result.message);
      }
    } catch (error) {
      console.error('fetchRecords: 請求失敗:', error);
      
      // 更詳細的錯誤信息
      if (error.message.includes('HTTP')) {
        message.error(`${t('dataSetManagement.fetchRecordsFailed')}: ${error.message}`);
      } else if (error.name === 'SyntaxError') {
        message.error(t('dataSetManagement.serverInvalidData'));
      } else {
        message.error(t('dataSetManagement.fetchRecordsFailed') + ': ' + error.message);
      }
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleSearch = async (values) => {
    if (!selectedDataSet) return;
    
    console.log('handleSearch: 開始執行搜尋，搜尋條件:', values);
    try {
      const response = await fetch(`/api/datasets/${selectedDataSet.id}/records/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      
      const result = await response.json();
      console.log('handleSearch: 搜尋結果:', result);
      
      if (result.success) {
        setRecords(result.data);
        message.success(t('dataSetManagement.foundRecords', { count: result.totalCount }));
      } else {
        message.error(t('dataSetManagement.searchFailed') + ': ' + result.message);
      }
    } catch (error) {
      console.error('handleSearch: 搜尋請求失敗:', error);
      message.error(t('dataSetManagement.searchFailed'));
    }
  };

  const handleSubmit = async () => {
    console.log('handleSubmit: 開始提交表單');
    try {
      const values = await form.validateFields();
      
      // 先檢查 dataSourceForm 的當前值，不進行驗證
      const dataSourceCurrentValues = dataSourceForm.getFieldsValue();
      console.log('handleSubmit: 數據源表單當前值:', dataSourceCurrentValues);
      
      // 如果沒有 sourceType，嘗試從編輯的數據集中獲取
      if (!dataSourceCurrentValues.sourceType && editingDataSet?.dataSource?.sourceType) {
        console.log('handleSubmit: 從編輯數據集中獲取 sourceType:', editingDataSet.dataSource.sourceType);
        dataSourceForm.setFieldsValue({
          sourceType: editingDataSet.dataSource.sourceType
        });
      }
      
      let dataSourceValues;
      let columnsValues;
      
      try {
        dataSourceValues = await dataSourceForm.validateFields();
      } catch (error) {
        console.error('數據源表單驗證失敗:', error);
        console.log('數據源表單當前值:', dataSourceForm.getFieldsValue());
        message.error(t('dataSetManagement.dataSourceFormValidationFailed'));
        return;
      }
      
      try {
        columnsValues = await columnsForm.validateFields();
      } catch (error) {
        console.error('欄位表單驗證失敗:', error);
        message.error(t('dataSetManagement.columnsFormValidationFailed'));
        return;
      }
      
      console.log('handleSubmit: 表單驗證通過，基本資訊:', values);
      console.log('handleSubmit: 數據源配置:', dataSourceValues);
      console.log('handleSubmit: 欄位定義:', columnsValues);
      
      // 從數據源配置中獲取數據源類型
      const sourceType = dataSourceValues.sourceType;
      
      if (!sourceType) {
        message.error(t('dataSetManagement.pleaseSelectDataSourceType'));
        // 自動切換到數據源配置標籤頁
        const dataSourceTab = document.querySelector('.ant-tabs-tab[data-key="dataSource"]');
        if (dataSourceTab) {
          dataSourceTab.click();
        }
        return;
      }
      
      // 處理 SQL 連接配置
      if (sourceType === 'SQL') {
        if (dataSourceValues.connectionType === 'preset') {
          // 預設連接
          dataSourceValues.databaseConnection = dataSourceValues.presetConnection;
          dataSourceValues.authenticationConfig = JSON.stringify({
            connectionType: 'preset',
            presetName: dataSourceValues.presetConnection
          });
        } else if (dataSourceValues.connectionType === 'custom') {
          // 自定義連接
          dataSourceValues.databaseConnection = 'custom';
          dataSourceValues.authenticationConfig = JSON.stringify({
            connectionType: 'custom',
            serverName: dataSourceValues.serverName,
            port: dataSourceValues.port,
            databaseName: dataSourceValues.databaseName,
            authenticationType: dataSourceValues.authenticationType,
            username: dataSourceValues.username,
            password: dataSourceValues.password,
            additionalOptions: dataSourceValues.additionalOptions
          });
        }
      }
      
      const requestData = {
        ...values,
        companyId: JSON.parse(localStorage.getItem('userInfo') || '{}').company_id,
        createdBy: JSON.parse(localStorage.getItem('userInfo') || '{}').name || 'Admin',
        columns: columnsValues.columns || [],
        dataSource: {
          ...dataSourceValues,
          sourceType: sourceType
        },
        dataSourceType: sourceType  // 設置基本資訊中的數據源類型
      };
      
      console.log('handleSubmit: 準備提交的數據:', requestData);
      
      const url = editingDataSet 
        ? `/api/datasets/${editingDataSet.id}` 
        : '/api/datasets';
      
      const method = editingDataSet ? 'PUT' : 'POST';
      
      console.log('handleSubmit: 請求 URL:', url, '方法:', method);
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      const result = await response.json();
      console.log('handleSubmit: 提交結果:', result);
      
      if (result.success) {
        message.success(editingDataSet ? t('dataSetManagement.updateSuccess') : t('dataSetManagement.createSuccess'));
        setModalVisible(false);
        fetchDataSets();
      } else {
        message.error(t('dataSetManagement.operationFailed') + ': ' + result.message);
      }
    } catch (error) {
      console.error('handleSubmit: 提交失敗:', error);
      message.error(t('dataSetManagement.operationFailed'));
    }
  };

  // 基礎表格列定義
  const baseColumns = [
    {
      title: t('dataSetManagement.name'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
      sorter: true,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.description}</div>
        </div>
      )
    },
    {
      title: t('dataSetManagement.dataSourceType'),
      dataIndex: 'dataSourceType',
      key: 'dataSourceType',
      width: 150,
      sorter: true,
      render: (type) => {
        const typeConfig = {
          'SQL': { color: 'blue', icon: <DatabaseOutlined /> },
          'EXCEL': { color: 'green', icon: <FileExcelOutlined /> },
          'GOOGLE_DOCS': { color: 'orange', icon: <LinkOutlined /> }
        };
        const config = typeConfig[type] || { color: 'default', icon: null };
        return (
          <Tag color={config.color}>
            {config.icon} {type}
          </Tag>
        );
      }
    },
    {
      title: t('dataSetManagement.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: true,
      render: (status) => {
        const statusConfig = {
          'Active': { color: 'success', text: t('dataSetManagement.active') },
          'Inactive': { color: 'default', text: t('dataSetManagement.inactive') },
          'Error': { color: 'error', text: t('dataSetManagement.error') }
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: t('dataSetManagement.lastUpdate'),
      dataIndex: 'lastDataSyncTime',
      key: 'lastDataSyncTime',
      width: 180,
      sorter: true,
      render: (time) => time ? new Date(time).toLocaleString('zh-TW') : t('dataSetManagement.neverSynced')
    },
    {
      title: t('dataSetManagement.syncProgress'),
      key: 'syncProgress',
      width: 280,
      render: (_, record) => {
        if (record.syncStatus === 'Running') {
          const totalRecords = record.totalRecordsToSync || 0;
          const processedRecords = record.recordsProcessed || 0;
          const progressPercentage = totalRecords > 0 ? Math.round((processedRecords / totalRecords) * 100) : 0;
          
          // 計算處理速度（每秒處理的記錄數）
          const syncStartedAt = record.syncStartedAt;
          let processingSpeed = 0;
          if (syncStartedAt && processedRecords > 0) {
            const elapsedSeconds = (Date.now() - new Date(syncStartedAt).getTime()) / 1000;
            processingSpeed = elapsedSeconds > 0 ? Math.round(processedRecords / elapsedSeconds) : 0;
          }
          
          // 估算剩餘時間
          let estimatedTimeRemaining = '';
          if (processingSpeed > 0 && totalRecords > processedRecords) {
            const remainingRecords = totalRecords - processedRecords;
            const remainingSeconds = Math.round(remainingRecords / processingSpeed);
            if (remainingSeconds < 60) {
              estimatedTimeRemaining = `${remainingSeconds}秒`;
            } else if (remainingSeconds < 3600) {
              estimatedTimeRemaining = `${Math.round(remainingSeconds / 60)}分鐘`;
            } else {
              estimatedTimeRemaining = `${Math.round(remainingSeconds / 3600)}小時`;
            }
          }
          
          return (
            <div style={{ width: '100%' }}>
              {/* 同步狀態指示器 */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '4px',
                fontSize: '12px',
                color: '#1890ff'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#1890ff',
                  marginRight: '6px',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <span>{t('dataSetManagement.syncing')}</span>
              </div>
              
              {/* 進度條 */}
              <Progress
                percent={progressPercentage}
                size="small"
                status="active"
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
                format={(percent) => `${percent}%`}
                style={{ marginBottom: '4px' }}
                showInfo={true}
                animation={true}
              />
              
              {/* 詳細統計信息 */}
              <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>{t('dataSetManagement.processed')}: {processedRecords.toLocaleString()}</span>
                  <span>{t('dataSetManagement.total')}: {totalRecords.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold' }}>
                  <span style={{ color: '#1890ff' }}>{t('dataSetManagement.totalRecords', { total: (record.totalRecords || 0).toLocaleString() })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: '#52c41a' }}>{t('dataSetManagement.inserted')}: {(record.recordsInserted || 0).toLocaleString()}</span>
                  <span style={{ color: '#1890ff' }}>{t('dataSetManagement.updated')}: {(record.recordsUpdated || 0).toLocaleString()}</span>
                  <span style={{ color: '#ff4d4f' }}>{t('dataSetManagement.deleted')}: {(record.recordsDeleted || 0).toLocaleString()}</span>
                </div>
                {processingSpeed > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#999' }}>
                    <span>{t('dataSetManagement.processingSpeed')}: {processingSpeed.toLocaleString()}/秒</span>
                    {estimatedTimeRemaining && <span>{t('dataSetManagement.remaining')}: {estimatedTimeRemaining}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        } else if (record.syncStatus === 'Completed') {
          return (
            <div>
              <Progress
                percent={100}
                size="small"
                status="success"
                format={() => t('dataSetManagement.completed')}
                style={{ marginBottom: '4px' }}
              />
              <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold' }}>
                  <span style={{ color: '#1890ff' }}>{t('dataSetManagement.totalRecords', { total: (record.totalRecords || 0).toLocaleString() })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: '#52c41a' }}>{t('dataSetManagement.inserted')}: {(record.recordsInserted || 0).toLocaleString()}</span>
                  <span style={{ color: '#1890ff' }}>{t('dataSetManagement.updated')}: {(record.recordsUpdated || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#ff4d4f' }}>{t('dataSetManagement.deleted')}: {(record.recordsDeleted || 0).toLocaleString()}</span>
                  <span style={{ color: '#faad14' }}>{t('dataSetManagement.skipped')}: {(record.recordsSkipped || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        } else if (record.syncStatus === 'Failed') {
          return (
            <div>
              <Progress
                percent={0}
                size="small"
                status="exception"
                format={() => t('dataSetManagement.failed')}
                style={{ marginBottom: '4px' }}
              />
              {record.syncErrorMessage && (
                <Tooltip title={record.syncErrorMessage}>
                  <Text style={{ fontSize: '11px', color: '#ff4d4f', display: 'block', marginTop: '2px' }}>
                    {record.syncErrorMessage.length > 25 
                      ? record.syncErrorMessage.substring(0, 25) + '...' 
                      : record.syncErrorMessage}
                  </Text>
                </Tooltip>
              )}
            </div>
          );
        } else if (record.syncStatus === 'Paused') {
          return (
            <div>
              <Progress
                percent={0}
                size="small"
                status="normal"
                format={() => t('dataSetManagement.paused')}
                style={{ marginBottom: '4px' }}
              />
              <Text style={{ fontSize: '11px', color: '#faad14' }}>
                {t('dataSetManagement.syncPaused')}
              </Text>
            </div>
          );
        }
        return (
          <div>
            <Progress
              percent={0}
              size="small"
              status="normal"
              format={() => t('dataSetManagement.idle')}
              style={{ marginBottom: '4px' }}
            />
            <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold' }}>
                <span style={{ color: '#1890ff' }}>{t('dataSetManagement.totalRecords', { total: (record.totalRecords || 0).toLocaleString() })}</span>
              </div>
              <Text style={{ color: '#999' }}>
                {t('dataSetManagement.readyToSync')}
              </Text>
            </div>
          </div>
        );
      }
    },
    {
      title: t('dataSetManagement.actions'),
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('dataSetManagement.viewRecords')}>
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handleViewRecords(record)}
            />
          </Tooltip>
          <Tooltip title={t('dataSetManagement.syncData')}>
            <Button 
              type="text" 
              icon={<SyncOutlined />} 
              onClick={() => handleSync(record.id)}
              loading={syncingDataSets.has(record.id)}
              disabled={syncingDataSets.has(record.id) || record.syncStatus === 'Running'}
            />
          </Tooltip>
          <Tooltip title={t('dataSetManagement.edit')}>
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t('dataSetManagement.confirmDelete')}
            description={t('dataSetManagement.confirmDeleteDescription', { 
              recordCount: record.totalRecords || 0,
              datasetName: record.name 
            })}
            onConfirm={() => handleDelete(record.id)}
            okText={t('dataSetManagement.confirmDeleteOk')}
            cancelText={t('dataSetManagement.confirmDeleteCancel')}
            okType="danger"
          >
            <Tooltip title={t('dataSetManagement.delete')}>
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 初始化可調整列寬的列配置
  useEffect(() => {
    if (resizableColumns.length === 0) {
      setResizableColumns(
        baseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
      );
    }
  }, [baseColumns, resizableColumns.length]);

  // 合併列配置，添加調整功能
  const mergedColumns = resizableColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handleResize(index),
    }),
  }));

  // 表格組件配置
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  const renderRecordColumns = () => {
    if (!selectedDataSet?.columns) {
      console.log('renderRecordColumns: 沒有欄位定義');
      return [];
    }
    
    console.log('renderRecordColumns: 開始渲染欄位，欄位數量:', selectedDataSet.columns.length);
    console.log('renderRecordColumns: 欄位定義:', selectedDataSet.columns);
    
    return selectedDataSet.columns.map(col => ({
      title: col.displayName || col.columnName,
      dataIndex: col.columnName,
      key: col.columnName,
      width: col.maxLength ? Math.min(col.maxLength * 8, 200) : 120, // 根據最大長度設置寬度
      ellipsis: true, // 啟用省略號
      render: (_, record) => {
        // 添加詳細的日誌來診斷問題
        console.log(`renderRecordColumns: 正在渲染記錄 ${record.id}，欄位 ${col.columnName}`);
        console.log(`renderRecordColumns: 記錄的完整結構:`, record);
        console.log(`renderRecordColumns: 記錄的所有屬性:`, Object.keys(record));
        
        // 嘗試多種可能的屬性名稱
        let values = record.Values || record.values || record.DataSetRecordValues || record.dataSetRecordValues;
        
        if (values) {
          console.log(`renderRecordColumns: 找到 Values 數據，數量:`, values.length);
          console.log(`renderRecordColumns: 第一個 Value 的結構:`, values[0]);
          console.log(`renderRecordColumns: 所有 Values 的 columnName:`, values.map(v => v.columnName));
        } else {
          console.warn(`renderRecordColumns: 記錄中沒有找到 Values 數據`);
          console.log(`renderRecordColumns: 記錄的可用屬性:`, record);
        }
        
        const value = values?.find(v => v.columnName === col.columnName);
        if (!value) {
          console.log(`renderRecordColumns: 欄位 ${col.columnName} 沒有找到值`);
          if (values) {
            console.log(`renderRecordColumns: 可用的 columnName:`, values.map(v => v.columnName));
          }
          return '-';
        }
        
        console.log(`renderRecordColumns: 欄位 ${col.columnName} 找到值:`, value);
        
        // 修正：使用正確的屬性名稱
        switch (col.dataType) {
          case 'datetime':
            return value.dateValue ? new Date(value.dateValue).toLocaleString('zh-TW') : 
                   (value.stringValue || '-');
          case 'decimal':
          case 'int':
            return value.numericValue || value.stringValue || '-';
          case 'boolean':
            return value.booleanValue ? t('dataSetManagement.yes') : t('dataSetManagement.no');
          default:
            return value.stringValue || value.textValue || '-';
        }
      },
      sorter: col.isSortable,
      filters: col.isSearchable ? undefined : null
    }));
  };

  // 表格列寬調整處理
  const handleResize = index => (e, { size }) => {
    const nextColumns = [...resizableColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setResizableColumns(nextColumns);
  };

  const handleTableChange = (paginationInfo, filters, sorter) => {
    console.log('handleTableChange: 表格變化:', { paginationInfo, filters, sorter });
    console.log('handleTableChange: sorter 詳細信息:', {
      field: sorter?.field,
      order: sorter?.order,
      columnKey: sorter?.columnKey,
      column: sorter?.column
    });
    
    // 處理分頁
    if (paginationInfo) {
      console.log('分頁變更:', paginationInfo);
      setPagination(prev => ({ 
        ...prev, 
        current: paginationInfo.current, 
        pageSize: paginationInfo.pageSize 
      }));
    }
    
    // 處理排序
    if (sorter && sorter.field) {
      console.log('排序字段:', sorter.field, '排序順序:', sorter.order);
      // 重新載入數據以應用排序
      fetchDataSets(paginationInfo.current, paginationInfo.pageSize, sorter.field, sorter.order);
    } else if (paginationInfo) {
      // 只有分頁變更時
      console.log('只有分頁變更，使用預設排序');
      fetchDataSets(paginationInfo.current, paginationInfo.pageSize);
    }
  };

  // 新增：載入 Google Sheets 欄位定義
  const loadGoogleSheetsColumns = async () => {
    try {
      // 先嘗試獲取表單值，如果驗證失敗則使用 getFieldValue
      let googleDocsUrl, googleDocsSheetName;
      
      try {
        const values = await dataSourceForm.validateFields(['googleDocsUrl', 'googleDocsSheetName']);
        googleDocsUrl = values.googleDocsUrl;
        googleDocsSheetName = values.googleDocsSheetName;
      } catch (validationError) {
        // 如果驗證失敗，直接獲取字段值
        console.log('表單驗證失敗，直接獲取字段值:', validationError);
        console.log('當前表單的所有值:', dataSourceForm.getFieldsValue());
        googleDocsUrl = dataSourceForm.getFieldValue('googleDocsUrl');
        googleDocsSheetName = dataSourceForm.getFieldValue('googleDocsSheetName');
        console.log('獲取的字段值:', { googleDocsUrl, googleDocsSheetName });
      }
      
      if (!googleDocsUrl) {
        message.error(t('dataSetManagement.googleDocsUrlRequired'));
        return;
      }
      
      console.log('開始載入 Google Sheets 欄位定義，URL:', googleDocsUrl, '工作表:', googleDocsSheetName);
      console.log('當前表單的所有值:', dataSourceForm.getFieldsValue());
      setSheetLoading(true);
      
      // 構建請求參數
      const params = new URLSearchParams();
      params.append('url', googleDocsUrl);
      if (googleDocsSheetName) {
        params.append('sheetName', googleDocsSheetName);
      }
      
      const response = await fetch(`/api/datasets/google-sheets/preview?${params.toString()}`);
      console.log('Google Sheets 欄位預覽 API 響應狀態:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Sheets 欄位預覽 API 錯誤響應:', errorText);
        throw new Error(`API 錯誤: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Google Sheets 欄位預覽結果:', result);
      
      if (result.success) {
        console.log('Google Sheets 欄位預覽結果:', result.columns);
        
        // 自動填充欄位定義表單
        const columnsData = result.columns.map((col, index) => ({
          key: index,
          columnName: col.columnName,
          displayName: col.displayName,
          dataType: col.dataType,
          maxLength: col.maxLength,
          isRequired: col.isRequired,
          // 智能主鍵檢測：id、within_code、主鍵相關欄位
          isPrimaryKey: isPrimaryKeyColumn(col.columnName),
          isSearchable: true,
          isSortable: true,
          isIndexed: false,
          defaultValue: col.defaultValue,
          sortOrder: col.sortOrder
        }));
        
        columnsForm.setFieldsValue({ columns: columnsData });
        message.success(t('dataSetManagement.autoGeneratedColumns', { count: result.columns.length }));
        
        // 自動切換到欄位定義標籤
        const tabsElement = document.querySelector('.ant-tabs-tab[data-key="columns"]');
        if (tabsElement) {
          tabsElement.click();
        }
      } else {
        message.error(t('dataSetManagement.getColumnPreviewFailed') + ': ' + result.message);
      }
    } catch (error) {
      console.error('載入 Google Sheets 欄位定義失敗:', error);
      message.error(t('dataSetManagement.processFailed') + ': ' + error.message);
    } finally {
      setSheetLoading(false);
    }
  };

  // 新增：處理工作表變更的函數
  const handleSheetChange = async (sheetName) => {
    if (!sheetName) return;
    
    console.log('工作表變更為:', sheetName);
    setSheetLoading(true);
    
    try {
      // 先嘗試獲取表單值，如果失敗則使用 getFieldValue
      let filePath;
      
      try {
        const values = await dataSourceForm.validateFields(['excelFilePath']);
        filePath = values.excelFilePath;
      } catch (validationError) {
        // 如果驗證失敗，直接獲取字段值
        console.log('表單驗證失敗，直接獲取字段值:', validationError);
        console.log('當前表單的所有值:', dataSourceForm.getFieldsValue());
        filePath = dataSourceForm.getFieldValue('excelFilePath');
        console.log('獲取的文件路徑:', filePath);
      }
      
      if (!filePath) {
        message.error(t('dataSetManagement.uploadExcelFirst'));
        return;
      }
      
      console.log('開始獲取欄位預覽，文件路徑:', filePath, '工作表:', sheetName);
      
      // 獲取欄位預覽
      const response = await fetch(`/api/datasets-upload/excel/preview?filePath=${encodeURIComponent(filePath)}&sheetName=${encodeURIComponent(sheetName)}`);
      console.log('欄位預覽 API 響應狀態:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('欄位預覽 API 錯誤響應:', errorText);
        throw new Error(`API 錯誤: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('欄位預覽結果:', result);
      
      if (result.success) {
        console.log('欄位預覽結果:', result.columns);
        
        // 自動填充欄位定義表單
        const columnsData = result.columns.map((col, index) => ({
          key: index,
          columnName: col.columnName,
          displayName: col.displayName,
          dataType: col.dataType,
          maxLength: col.maxLength,
          isRequired: col.isRequired,
          // 智能主鍵檢測：id、within_code、主鍵相關欄位
          isPrimaryKey: isPrimaryKeyColumn(col.columnName),
          isSearchable: true,
          isSortable: true,
          isIndexed: false,
          defaultValue: col.defaultValue,
          sortOrder: col.sortOrder
        }));
        
        columnsForm.setFieldsValue({ columns: columnsData });
        message.success(t('dataSetManagement.autoGeneratedColumns', { count: result.columns.length }));
      } else {
        message.error(t('dataSetManagement.getColumnPreviewFailed') + ': ' + result.message);
      }
    } catch (error) {
      console.error('工作表變更處理失敗:', error);
      message.error(t('dataSetManagement.processFailed') + ': ' + error.message);
    } finally {
      setSheetLoading(false);
    }
  };

  const testSqlConnection = async () => {
    try {
      const values = await dataSourceForm.validateFields();
      const connectionType = values.connectionType;

      if (connectionType === 'preset') {
        const presetConnection = values.presetConnection;
        if (!presetConnection) {
          message.error(t('dataSetManagement.presetConnectionRequired'));
          return;
        }

        // 顯示測試中的狀態
        message.loading(t('dataSetManagement.testingConnection'), 0);

        try {
          const response = await fetch('/api/datasets/test-preset-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presetConnection })
          });
          
          const result = await response.json();
          
          if (result.success) {
            message.destroy();
            message.success(t('dataSetManagement.presetConnectionTestSuccess') + `: ${presetConnection}`);
            console.log('預設連接測試成功:', presetConnection);
            
            // 連接測試成功後，自動獲取欄位定義
            const sqlQuery = values.sqlQuery;
            if (sqlQuery) {
              await generateColumnsFromPresetSql(sqlQuery, presetConnection);
            }
            
          } else {
            message.destroy();
            message.error(`${t('dataSetManagement.presetConnectionTestFailed')}: ${result.message}`);
          }
        } catch (error) {
          message.destroy();
          console.error('預設連接測試請求失敗:', error);
          message.error(t('dataSetManagement.presetConnectionTestFailed') + ': ' + error.message);
        }
        return;
      } else if (connectionType === 'custom') {
        const serverName = values.serverName;
        const port = values.port;
        const databaseName = values.databaseName;
        const authType = values.authenticationType;
        const username = values.username;
        const password = values.password;
        const additionalOptions = values.additionalOptions;
        const sqlQuery = values.sqlQuery;

        if (!serverName || !databaseName) {
          message.error(t('dataSetManagement.serverAndDatabaseRequired'));
          return;
        }

        if (authType === 'sql' && (!username || !password)) {
          message.error(t('dataSetManagement.sqlAuthRequired'));
          return;
        }

        if (!sqlQuery) {
          message.error(t('dataSetManagement.sqlQueryRequired'));
          return;
        }

        // 構建連接字符串
        let connectionString = `Server=${serverName}`;
        if (port) {
          connectionString += `,${port}`;
        }
        connectionString += `;Database=${databaseName};`;
        
        if (authType === 'sql') {
          connectionString += `User ID=${username};Password=${password};`;
        } else if (authType === 'windows') {
          connectionString += `Integrated Security=True;`;
        }
        
        // 自動添加 SSL 信任設置，解決憑證驗證問題
        connectionString += `TrustServerCertificate=true;Encrypt=false;`;
        
        if (additionalOptions) {
          connectionString += additionalOptions;
        }

        // 顯示測試中的狀態
        message.loading(t('dataSetManagement.testingConnection'), 0);

        try {
          const response = await fetch('/api/datasets/test-sql-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionString })
          });
          
          const result = await response.json();
          
          if (result.success) {
            message.destroy();
            message.success(t('dataSetManagement.connectionTestSuccess'));
            console.log('連接字符串:', connectionString);
            
            // 連接測試成功後，自動獲取欄位定義
            await generateColumnsFromSql(sqlQuery, connectionString);
            
          } else {
            message.destroy();
            message.error(`${t('dataSetManagement.connectionTestFailed')}: ${result.message}`);
          }
        } catch (error) {
          message.destroy();
          console.error('SQL 連接測試請求失敗:', error);
          message.error(t('dataSetManagement.connectionTestFailed') + ': ' + error.message);
        }
      }
    } catch (error) {
      console.error('連接測試失敗:', error);
      message.error(t('dataSetManagement.completeConnectionConfig'));
    }
  };

  // 新增：根據預設連接的 SQL 查詢生成欄位定義
  const generateColumnsFromPresetSql = async (sqlQuery, presetConnection) => {
    try {
      console.log('開始根據預設連接的 SQL 查詢生成欄位定義');
      
      const response = await fetch('/api/datasets/generate-columns-from-preset-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          presetConnection,
          sqlQuery: sqlQuery
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('成功獲取欄位定義:', result.columns);
        
        // 自動填充欄位定義表單
        const columnsData = result.columns.map((col, index) => ({
          key: index,
          columnName: col.columnName,
          displayName: col.displayName || col.columnName,
          dataType: col.dataType,
          maxLength: col.maxLength,
          isRequired: false,
          // 智能主鍵檢測：id、within_code、主鍵相關欄位
          isPrimaryKey: isPrimaryKeyColumn(col.columnName),
          isSearchable: true,
          isSortable: true,
          isIndexed: false,
          defaultValue: col.defaultValue,
          sortOrder: index
        }));
        
        columnsForm.setFieldsValue({ columns: columnsData });
        message.success(t('dataSetManagement.autoGeneratedColumns', { count: result.columns.length }));
        
        // 自動切換到欄位定義標籤
        const tabsElement = document.querySelector('.ant-tabs-tab[data-key="columns"]');
        if (tabsElement) {
          tabsElement.click();
        }
        
      } else {
        console.error('獲取欄位定義失敗:', result.message);
        message.warning(t('dataSetManagement.cannotAutoGenerateColumns') + ': ' + result.message);
      }
    } catch (error) {
      console.error('生成欄位定義失敗:', error);
      message.warning(t('dataSetManagement.cannotAutoGenerateColumnsManual'));
    }
  };

  // 新增：根據 SQL 查詢生成欄位定義
  const generateColumnsFromSql = async (sqlQuery, connectionString) => {
    try {
      console.log('開始根據 SQL 查詢生成欄位定義');
      
      const response = await fetch('/api/datasets/generate-columns-from-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          connectionString,
          sqlQuery: sqlQuery
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('成功獲取欄位定義:', result.columns);
        
        // 自動填充欄位定義表單
        const columnsData = result.columns.map((col, index) => ({
          key: index,
          columnName: col.columnName,
          displayName: col.displayName || col.columnName,
          dataType: col.dataType,
          maxLength: col.maxLength,
          isRequired: false,
          // 智能主鍵檢測：id、within_code、主鍵相關欄位
          isPrimaryKey: isPrimaryKeyColumn(col.columnName),
          isSearchable: true,
          isSortable: true,
          isIndexed: false,
          defaultValue: col.defaultValue,
          sortOrder: index
        }));
        
        columnsForm.setFieldsValue({ columns: columnsData });
        message.success(t('dataSetManagement.autoGeneratedColumns', { count: result.columns.length }));
        
        // 自動切換到欄位定義標籤
        const tabsElement = document.querySelector('.ant-tabs-tab[data-key="columns"]');
        if (tabsElement) {
          tabsElement.click();
        }
        
      } else {
        console.error('獲取欄位定義失敗:', result.message);
        message.warning(t('dataSetManagement.cannotAutoGenerateColumns') + ': ' + result.message);
      }
    } catch (error) {
      console.error('生成欄位定義失敗:', error);
      message.warning(t('dataSetManagement.cannotAutoGenerateColumnsManual'));
    }
  };

  // 新增：從記錄動態生成欄位定義
  const generateDynamicColumns = (records) => {
    if (!records || records.length === 0) return [];
    
    // 從第一個記錄的 Values 中提取欄位信息
    const firstRecord = records[0];
    if (!firstRecord.Values || firstRecord.Values.length === 0) return [];
    
    console.log('generateDynamicColumns: 第一個記錄的 Values:', firstRecord.Values);
    
    return firstRecord.Values.map((value, index) => ({
      key: index,
      columnName: value.columnName,
      displayName: value.columnName,
      dataType: inferDataTypeFromValue(value),
      maxLength: 255,
      isRequired: false,
      isPrimaryKey: index === 0,
      isSearchable: true,
      isSortable: true,
      isIndexed: false,
      defaultValue: null,
      sortOrder: index
    }));
  };

  // 新增：推斷數據類型
  const inferDataTypeFromValue = (value) => {
    if (value.dateValue) return 'datetime';
    if (value.numericValue !== null && value.numericValue !== undefined) return 'decimal';
    if (value.booleanValue !== null && value.booleanValue !== undefined) return 'boolean';
    return 'string';
  };

  // 新增：智能主鍵檢測函數
  const isPrimaryKeyColumn = (columnName) => {
    if (!columnName) return false;
    
    const lowerName = columnName.toLowerCase();
    
    // 常見主鍵欄位名稱
    const primaryKeyPatterns = [
      'id',                    // 標準 ID 欄位
      'within_code',          // 您的業務主鍵
      'pk_',                  // 以 pk_ 開頭
      '_id',                  // 以 _id 結尾
      'key',                  // 包含 key
      'code',                 // 包含 code
      'no',                   // 包含 no (如 orderno, customerno)
      'number',               // 包含 number
      'ref',                  // 包含 ref
      'seq'                   // 包含 seq
    ];
    
    // 檢查是否匹配主鍵模式
    return primaryKeyPatterns.some(pattern => {
      if (pattern.includes('_')) {
        // 對於包含下劃線的模式，檢查是否包含該模式
        return lowerName.includes(pattern);
      } else {
        // 對於單詞模式，檢查是否完全匹配或包含
        return lowerName === pattern || lowerName.includes(pattern);
      }
    });
  };

  return (
    <div style={{ padding: '24px' }}>
      <style>
        {`
          @keyframes pulse {
            0% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.5;
              transform: scale(1.1);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleCreate}
        >
          {t('dataSetManagement.add')}
        </Button>
        <Title level={3}>
          <DatabaseOutlined style={{ marginRight: '8px' }} />
          {t('dataSetManagement.title')}
        </Title>
      </div>

      <Card>
        <Table
          components={components}
          columns={mergedColumns}
          dataSource={dataSets}
          loading={loading}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => t('dataSetManagement.totalRecords', { total }),
            pageSizeOptions: t('dataSetManagement.pageSizeOptions'),
            showSizeChanger: true,
            showQuickJumper: true
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* 創建/編輯 Modal */}
      <Modal
        title={editingDataSet ? t('dataSetManagement.editDataSetTitle') : t('dataSetManagement.createDataSetTitle')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={900}
        okText={t('dataSetManagement.save')}
        cancelText={t('dataSetManagement.cancel')}
      >
        <Tabs defaultActiveKey="basic">
          <TabPane tab={t('dataSetManagement.basicInfo')} key="basic" forceRender>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="name"
                    label={t('dataSetManagement.nameLabel')}
                    rules={[{ required: true, message: t('dataSetManagement.nameRequired') }]}
                  >
                    <Input placeholder={t('dataSetManagement.namePlaceholder')} />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item name="description" label={t('dataSetManagement.description')}>
                <TextArea rows={3} placeholder={t('dataSetManagement.descriptionPlaceholder')} />
              </Form.Item>
              
              <Alert
                message={t('dataSetManagement.dataSourceTypeInfo')}
                description={t('dataSetManagement.dataSourceTypeDescription')}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="isScheduled" label={t('dataSetManagement.isScheduled')}>
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.isScheduled !== currentValues.isScheduled}>
                    {({ getFieldValue }) => (
                      <Form.Item
                        name="updateIntervalMinutes"
                        label={t('dataSetManagement.updateInterval')}
                        rules={[
                          {
                            required: getFieldValue('isScheduled'),
                            message: t('dataSetManagement.updateIntervalRequired')
                          }
                        ]}
                      >
                        <InputNumber 
                          min={1} 
                          max={1440} 
                          placeholder={t('dataSetManagement.updateIntervalPlaceholder')}
                          disabled={!getFieldValue('isScheduled')}
                        />
                      </Form.Item>
                    )}
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </TabPane>
          
          <TabPane tab={t('dataSetManagement.dataSourceConfig')} key="dataSource" forceRender>
            <Form form={dataSourceForm} layout="vertical">
              <Form.Item
                name="sourceType"
                label={t('dataSetManagement.dataSourceTypeLabel')}
                rules={[{ required: true, message: t('dataSetManagement.dataSourceTypeRequired') }]}
              >
                <Select 
                  placeholder={t('dataSetManagement.dataSourceTypePlaceholder')}
                  onChange={(value) => {
                    console.log('數據源類型變更為:', value);
                  }}
                >
                  <Select.Option value="SQL">{t('dataSetManagement.sqlQuery')}</Select.Option>
                  <Select.Option value="EXCEL">{t('dataSetManagement.excelFile')}</Select.Option>
                  <Select.Option value="GOOGLE_DOCS">{t('dataSetManagement.googleDocsOption')}</Select.Option>
                </Select>
              </Form.Item>
              
              {/* SQL 配置 */}
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => 
                  prevValues.sourceType !== currentValues.sourceType
                }
              >
                {({ getFieldValue }) => {
                  const sourceType = getFieldValue('sourceType');
                  
                  if (sourceType === 'SQL') {
                    return (
                      <>
                        <Form.Item 
                          name="connectionType" 
                          label={t('dataSetManagement.connectionType')}
                          initialValue="preset"
                        >
                          <Radio.Group>
                            <Radio value="preset">{t('dataSetManagement.usePresetConnection')}</Radio>
                            <Radio value="custom">{t('dataSetManagement.customConnection')}</Radio>
                          </Radio.Group>
                        </Form.Item>
                        
                        {/* 預設連接選項 */}
                        <Form.Item
                          noStyle
                          shouldUpdate={(prevValues, currentValues) => 
                            prevValues.connectionType !== currentValues.connectionType
                          }
                        >
                          {({ getFieldValue }) => {
                            const connectionType = getFieldValue('connectionType');
                            
                            if (connectionType === 'preset') {
                              return (
                                <>
                                  <Form.Item 
                                    name="presetConnection" 
                                    label={t('dataSetManagement.presetDatabaseConnection')}
                                    initialValue="purple_rice"
                                  >
                                    <Input 
                                      value={t('dataSetManagement.whatoFlowDatabase')} 
                                      disabled 
                                      style={{ backgroundColor: '#f5f5f5' }}
                                    />
                                  </Form.Item>
                                  
                                  <Alert
                                    message={t('dataSetManagement.presetConnectionTest')}
                                    description={t('dataSetManagement.presetConnectionTestDescription')}
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                  />
                                  
                                  <Form.Item>
                                    <Button 
                                      type="dashed" 
                                      onClick={() => testSqlConnection()}
                                      icon={<DatabaseOutlined />}
                                    >
                                      {t('dataSetManagement.testConnection')}
                                    </Button>
                                  </Form.Item>
                                </>
                              );
                            }
                            
                            if (connectionType === 'custom') {
                              return (
                                <>
                                  <Row gutter={16}>
                                    <Col span={12}>
                                      <Form.Item
                                        name="serverName"
                                        label={t('dataSetManagement.serverName')}
                                        rules={[{ required: true, message: t('dataSetManagement.serverNameRequired') }]}
                                      >
                                        <Input placeholder={t('dataSetManagement.serverNamePlaceholder')} />
                                      </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                      <Form.Item
                                        name="port"
                                        label={t('dataSetManagement.port')}
                                        initialValue="1433"
                                      >
                                        <Input placeholder={t('dataSetManagement.portPlaceholder')} />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                  
                                  <Row gutter={16}>
                                    <Col span={12}>
                                      <Form.Item
                                        name="databaseName"
                                        label={t('dataSetManagement.databaseName')}
                                        rules={[{ required: true, message: t('dataSetManagement.databaseNameRequired') }]}
                                      >
                                        <Input placeholder={t('dataSetManagement.databaseNamePlaceholder')} />
                                      </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                      <Form.Item
                                        name="authenticationType"
                                        label={t('dataSetManagement.authenticationType')}
                                        initialValue="sql"
                                      >
                                        <Select>
                                          <Select.Option value="sql">{t('dataSetManagement.sqlServerAuth')}</Select.Option>
                                          <Select.Option value="windows">{t('dataSetManagement.windowsAuth')}</Select.Option>
                                        </Select>
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                  
                                  <Form.Item
                                    noStyle
                                    shouldUpdate={(prevValues, currentValues) => 
                                      prevValues.authenticationType !== currentValues.authenticationType
                                    }
                                  >
                                    {({ getFieldValue }) => {
                                      const authType = getFieldValue('authenticationType');
                                      
                                      if (authType === 'sql') {
                                        return (
                                          <Row gutter={16}>
                                            <Col span={12}>
                                              <Form.Item
                                                name="username"
                                                label={t('dataSetManagement.username')}
                                                rules={[{ required: true, message: t('dataSetManagement.usernameRequired') }]}
                                              >
                                                <Input placeholder={t('dataSetManagement.usernamePlaceholder')} />
                                              </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                              <Form.Item
                                                name="password"
                                                label={t('dataSetManagement.password')}
                                                rules={[{ required: true, message: t('dataSetManagement.passwordRequired') }]}
                                              >
                                                <Input.Password placeholder={t('dataSetManagement.passwordPlaceholder')} />
                                              </Form.Item>
                                            </Col>
                                          </Row>
                                        );
                                      }
                                      
                                      return null;
                                    }}
                                  </Form.Item>
                                  
                                  <Form.Item name="additionalOptions" label={t('dataSetManagement.additionalOptions')}>
                                    <TextArea 
                                      rows={2} 
                                      placeholder={t('dataSetManagement.additionalOptionsPlaceholder')}
                                    />
                                  </Form.Item>
                                  
                                  <Alert
                                    message={t('dataSetManagement.connectionTest')}
                                    description={t('dataSetManagement.connectionTestDescription')}
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                  />
                                  
                                  <Form.Item>
                                    <Button 
                                      type="dashed" 
                                      onClick={() => testSqlConnection()}
                                      icon={<DatabaseOutlined />}
                                    >
                                      {t('dataSetManagement.testConnection')}
                                    </Button>
                                  </Form.Item>
                                </>
                              );
                            }
                            
                            return null;
                          }}
                        </Form.Item>
                        
                        <Form.Item
                          name="sqlQuery"
                          label={t('dataSetManagement.sqlQuery')}
                          rules={[{ required: true, message: t('dataSetManagement.sqlQueryRequired') }]}
                        >
                          <TextArea 
                            rows={6} 
                            placeholder={t('dataSetManagement.sqlQueryPlaceholder')}
                          />
                        </Form.Item>
                        
                        <Form.Item name="sqlParameters" label={t('dataSetManagement.sqlParameters')}>
                          <TextArea 
                            rows={3} 
                            placeholder={t('dataSetManagement.sqlParametersPlaceholder')}
                          />
                        </Form.Item>
                      </>
                    );
                  }
                  
                  if (sourceType === 'EXCEL') {
                    return (
                      <>
                        <Form.Item name="excelFilePath" label={t('dataSetManagement.excelFilePath')}>
                          <Input placeholder={t('dataSetManagement.excelFilePathPlaceholder')} />
                        </Form.Item>
                        
                                                 <Form.Item name="excelSheetName" label={t('dataSetManagement.excelSheetName')}>
                           <Select 
                             placeholder={t('dataSetManagement.excelSheetNamePlaceholder')}
                             onChange={(value) => handleSheetChange(value)}
                             loading={sheetLoading}
                           >
                             {sheetNames.map(name => (
                               <Select.Option key={name} value={name}>
                                 {name}
                               </Select.Option>
                             ))}
                           </Select>
                         </Form.Item>
                        
                        
                        <Upload
                          name="file"
                          accept=".xlsx,.xls"
                          beforeUpload={(file) => {
                            console.log('準備上傳 Excel 文件:', file);
                            // 檢查文件類型
                            const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                                          file.type === 'application/vnd.ms-excel';
                            if (!isExcel) {
                              message.error(t('dataSetManagement.onlyExcelFiles'));
                              return false;
                            }
                            
                            // 檢查文件大小（限制為 10MB）
                            const isLt10M = file.size / 1024 / 1024 < 10;
                            if (!isLt10M) {
                              message.error(t('dataSetManagement.fileSizeLimit'));
                              return false;
                            }
                            
                            return true;
                          }}
                          customRequest={async ({ file, onSuccess, onError, onProgress }) => {
                            try {
                              console.log('開始上傳 Excel 文件:', file);
                              
                              // 創建 FormData
                              const formData = new FormData();
                              formData.append('file', file);
                              
                              // 上傳文件
                              const uploadResponse = await fetch('/api/datasets-upload/excel', {
                                method: 'POST',
                                body: formData
                              });
                              
                              if (!uploadResponse.ok) {
                                throw new Error(t('dataSetManagement.uploadFailed'));
                              }
                              
                              const uploadResult = await uploadResponse.json();
                              console.log('文件上傳結果:', uploadResult);
                              
                              if (uploadResult.success) {
                                // 自動填充文件路徑
                                const filePath = uploadResult.filePath;
                                dataSourceForm.setFieldsValue({ excelFilePath: filePath });
                                console.log('自動設置 Excel 文件路徑:', filePath);
                                
                                // 自動獲取工作表名稱
                                try {
                                  console.log('開始獲取工作表名稱，文件路徑:', filePath);
                                  const sheetsResponse = await fetch(`/api/datasets-upload/excel/sheets?filePath=${encodeURIComponent(filePath)}`);
                                  console.log('工作表名稱 API 響應狀態:', sheetsResponse.status);
                                  
                                  if (!sheetsResponse.ok) {
                                    const errorText = await sheetsResponse.text();
                                    console.error('工作表名稱 API 錯誤響應:', errorText);
                                    throw new Error(`API 錯誤: ${sheetsResponse.status} ${sheetsResponse.statusText}`);
                                  }
                                  
                                  const sheetsResult = await sheetsResponse.json();
                                  console.log('工作表名稱 API 響應結果:', sheetsResult);
                                  
                                  if (sheetsResult.success) {
                                    setSheetNames(sheetsResult.sheetNames);
                                    console.log('獲取到工作表名稱:', sheetsResult.sheetNames);
                                    
                                    // 如果只有一個工作表，自動選擇
                                    if (sheetsResult.sheetNames.length === 1) {
                                      dataSourceForm.setFieldsValue({ excelSheetName: sheetsResult.sheetNames[0] });
                                      // 自動觸發欄位預覽
                                      handleSheetChange(sheetsResult.sheetNames[0]);
                                    }
                                  } else {
                                    console.error('獲取工作表名稱失敗:', sheetsResult.message);
                                    message.warning(t('dataSetManagement.cannotGetSheetNames') + ': ' + sheetsResult.message);
                                  }
                                } catch (error) {
                                  console.error('獲取工作表名稱失敗:', error);
                                  message.warning(t('dataSetManagement.cannotGetSheetNamesManual'));
                                }
                                
                                message.success(`${file.name} ${t('dataSetManagement.uploadSuccess')}`);
                                onSuccess(uploadResult);
                              } else {
                                throw new Error(uploadResult.message || t('dataSetManagement.uploadFailed'));
                              }
                            } catch (error) {
                              console.error('文件上傳錯誤:', error);
                              message.error(`${t('dataSetManagement.uploadFailed')}: ${error.message}`);
                              onError(error);
                            }
                          }}
                          onChange={(info) => {
                            console.log('Excel 文件上傳狀態變更:', info);
                            if (info.file.status === 'done') {
                              console.log('文件上傳完成');
                            } else if (info.file.status === 'error') {
                              console.error('文件上傳失敗');
                            }
                          }}
                        >
                          <Button icon={<UploadOutlined />}>{t('dataSetManagement.uploadExcelFile')}</Button>
                        </Upload>
                        
                                                 <Alert
                           message={t('dataSetManagement.excelUploadDescription')}
                           description={t('dataSetManagement.excelUploadInfo')}
                           type="info"
                           showIcon
                           style={{ marginTop: 8 }}
                         />
                      </>
                    );
                  }
                  
                  if (sourceType === 'GOOGLE_DOCS') {
                    return (
                      <>
                        <Form.Item
                          name="googleDocsUrl"
                          label={t('dataSetManagement.googleDocsUrl')}
                          rules={[{ required: true, message: t('dataSetManagement.googleDocsUrlRequired') }]}
                        >
                          <Input placeholder={t('dataSetManagement.googleDocsUrlPlaceholder')} />
                        </Form.Item>
                        
                        <Form.Item name="googleDocsSheetName" label={t('dataSetManagement.googleDocsSheetName')}>
                          <Input placeholder={t('dataSetManagement.googleDocsSheetNamePlaceholder')} />
                        </Form.Item>
                        
                        <Alert
                          message={t('dataSetManagement.googleDocsIntegration')}
                          description={t('dataSetManagement.googleDocsIntegrationDescription')}
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                        
                        <Form.Item>
                          <Button 
                            type="dashed" 
                            onClick={() => loadGoogleSheetsColumns()}
                            icon={<DatabaseOutlined />}
                            loading={sheetLoading}
                          >
                            {t('dataSetManagement.loadColumnDefinition')}
                          </Button>
                        </Form.Item>
                      </>
                    );
                  }
                  
                  return null;
                }}
              </Form.Item>
              
            </Form>
          </TabPane>
          
          <TabPane tab={t('dataSetManagement.columnDefinition')} key="columns" forceRender>
             <Form form={columnsForm} layout="vertical">
               <Alert
                 message={t('dataSetManagement.columnDefinitionDescription')}
                 description={t('dataSetManagement.columnDefinitionInfo')}
                 type="info"
                 showIcon
                 style={{ marginBottom: 16 }}
               />
               <Form.List name="columns">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card 
                        key={key} 
                        size="small" 
                        style={{ marginBottom: 16 }}
                        extra={
                          <Button 
                            type="text" 
                            danger 
                            onClick={() => remove(name)}
                          >
                            {t('dataSetManagement.removeColumn')}
                          </Button>
                        }
                      >
                        <Row gutter={16}>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'columnName']}
                              label={t('dataSetManagement.columnName')}
                              rules={[{ required: true, message: t('dataSetManagement.columnNameRequired') }]}
                            >
                              <Input placeholder={t('dataSetManagement.columnNamePlaceholder')} />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'displayName']}
                              label={t('dataSetManagement.displayName')}
                            >
                              <Input placeholder={t('dataSetManagement.displayNamePlaceholder')} />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'dataType']}
                              label={t('dataSetManagement.dataType')}
                              rules={[{ required: true, message: t('dataSetManagement.dataTypeRequired') }]}
                            >
                              <Select placeholder={t('dataSetManagement.dataTypePlaceholder')}>
                                <Select.Option value="string">{t('dataSetManagement.string')}</Select.Option>
                                <Select.Option value="int">{t('dataSetManagement.int')}</Select.Option>
                                <Select.Option value="decimal">{t('dataSetManagement.decimal')}</Select.Option>
                                <Select.Option value="datetime">{t('dataSetManagement.datetime')}</Select.Option>
                                <Select.Option value="boolean">{t('dataSetManagement.boolean')}</Select.Option>
                              </Select>
                            </Form.Item>
                          </Col>
                        </Row>
                        
                        <Row gutter={16}>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'isPrimaryKey']}
                              valuePropName="checked"
                            >
                              <Switch checkedChildren={t('dataSetManagement.isPrimaryKey')} unCheckedChildren={t('dataSetManagement.isPrimaryKeyNormal')} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'isSearchable']}
                              valuePropName="checked"
                            >
                              <Switch checkedChildren={t('dataSetManagement.isSearchable')} unCheckedChildren={t('dataSetManagement.isSearchableNot')} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'isSortable']}
                              valuePropName="checked"
                            >
                              <Switch checkedChildren={t('dataSetManagement.isSortable')} unCheckedChildren={t('dataSetManagement.isSortableNot')} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'isIndexed']}
                              valuePropName="checked"
                            >
                              <Switch checkedChildren={t('dataSetManagement.isIndexed')} unCheckedChildren={t('dataSetManagement.isIndexedNot')} />
                            </Form.Item>
                          </Col>
                        </Row>
                        
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'defaultValue']}
                              label={t('dataSetManagement.defaultValue')}
                            >
                              <Input placeholder={t('dataSetManagement.defaultValuePlaceholder')} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'sortOrder']}
                              label={t('dataSetManagement.sortOrder')}
                            >
                              <InputNumber min={0} placeholder="0" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    
                    <Button 
                      type="dashed" 
                      onClick={() => add()} 
                      block 
                      icon={<PlusOutlined />}
                    >
                      {t('dataSetManagement.addColumn')}
                    </Button>
                  </>
                )}
              </Form.List>
            </Form>
          </TabPane>
        </Tabs>
      </Modal>

      {/* 記錄查看 Drawer */}
      <Drawer
        title={`${selectedDataSet?.name} - ${t('dataSetManagement.dataRecords')}`}
        placement="right"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width="100%"  // 改為全屏寬度
        style={{ maxWidth: '100vw' }}  // 確保最大寬度
        extra={
          <Space>
            <Button 
              icon={<SearchOutlined />} 
              onClick={() => setSearchDrawerVisible(true)}
            >
              {t('dataSetManagement.advancedSearch')}
            </Button>
            <Button 
              icon={<SyncOutlined />} 
              onClick={() => selectedDataSet && fetchRecords(selectedDataSet.id)}
            >
              {t('dataSetManagement.refresh')}
            </Button>
          </Space>
        }
        styles={{
          body: {
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflow: 'hidden'
          }
        }}
      >
        <div style={{ 
          flex: 1, 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column',
          height: '100%'
        }}>
          {/* 表格區域 */}
          <div style={{ 
            flex: 1, 
            overflow: 'auto',
            padding: '16px',
            minHeight: 0  // 確保可以縮小
          }}>
            <Table
              columns={[
                {
                  title: t('dataSetManagement.recordId'),
                  dataIndex: 'id',
                  key: 'id',
                  width: 80,
                  ellipsis: true,
                  render: (id) => id.substring(0, 8) + '...'
                },
                {
                  title: t('dataSetManagement.recordStatus'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 80,
                  ellipsis: true,
                  render: (status) => (
                    <Tag color={status === 'Active' ? 'success' : 'default'}>
                      {status || t('dataSetManagement.nA')}
                    </Tag>
                  )
                },
                {
                  title: t('dataSetManagement.createdAt'),
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  width: 150,
                  ellipsis: true,
                  render: (time) => new Date(time).toLocaleString('zh-TW')
                },
                ...renderRecordColumns()
              ]}
              dataSource={records}
              loading={recordsLoading}
              rowKey="id"
              scroll={{ x: 'max-content', y: 'calc(100vh - 200px)' }}  // 添加垂直滾動
              pagination={false}  // 禁用內建分頁
              size="small"
              components={{
                header: {
                  cell: (props) => (
                    <th 
                      {...props} 
                      style={{ 
                        ...props.style, 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        maxWidth: props.style?.width || 'auto'
                      }} 
                    />
                  )
                }
              }}
            />
          </div>
          
          {/* 固定底部分頁控制 */}
          <div style={{ 
            borderTop: '1px solid #f0f0f0',
            padding: '16px',
            backgroundColor: '#fafafa',
            flexShrink: 0
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ color: '#666', fontSize: '14px' }}>
                {t('dataSetManagement.pageRange', { 
                  start: (recordsPagination.current - 1) * recordsPagination.pageSize + 1,
                  end: Math.min(recordsPagination.current * recordsPagination.pageSize, recordsPagination.total),
                  total: recordsPagination.total 
                })}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>{t('dataSetManagement.recordsPerPage')}</span>
                <Select
                  value={recordsPagination.pageSize}
                  onChange={(size) => {
                    console.log('記錄頁面大小變更:', { current: 1, size });
                    setRecordsPagination(prev => ({ ...prev, current: 1, pageSize: size }));
                    if (selectedDataSet) {
                      fetchRecords(selectedDataSet.id, { page: 1, pageSize: size });
                    }
                  }}
                  style={{ width: 80 }}
                  size="small"
                >
                  <Select.Option value={10}>10</Select.Option>
                  <Select.Option value={20}>20</Select.Option>
                  <Select.Option value={50}>50</Select.Option>
                  <Select.Option value={100}>100</Select.Option>
                </Select>
                
                <Button
                  size="small"
                  disabled={recordsPagination.current <= 1}
                  onClick={() => {
                    const newPage = recordsPagination.current - 1;
                    setRecordsPagination(prev => ({ ...prev, current: newPage }));
                    if (selectedDataSet) {
                      fetchRecords(selectedDataSet.id, { page: newPage, pageSize: recordsPagination.pageSize });
                    }
                  }}
                >
                  {t('dataSetManagement.previousPage')}
                </Button>
                
                <span style={{ fontSize: '14px', minWidth: '60px', textAlign: 'center' }}>
                  {recordsPagination.current} / {Math.ceil(recordsPagination.total / recordsPagination.pageSize)}
                </span>
                
                <Button
                  size="small"
                  disabled={recordsPagination.current >= Math.ceil(recordsPagination.total / recordsPagination.pageSize)}
                  onClick={() => {
                    const newPage = recordsPagination.current + 1;
                    setRecordsPagination(prev => ({ ...prev, current: newPage }));
                    if (selectedDataSet) {
                      fetchRecords(selectedDataSet.id, { page: newPage, pageSize: recordsPagination.pageSize });
                    }
                  }}
                >
                  {t('dataSetManagement.nextPage')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Drawer>

      {/* 進階搜尋 Drawer */}
      <Drawer
        title={t('dataSetManagement.advancedSearchTitle')}
        placement="left"
        open={searchDrawerVisible}
        onClose={() => setSearchDrawerVisible(false)}
        width={500}
      >
        <Form form={searchForm} layout="vertical" onFinish={handleSearch}>
          <Form.List name="conditions">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card 
                    key={key} 
                    size="small" 
                    style={{ marginBottom: 16 }}
                    extra={
                      <Button 
                        type="text" 
                        danger 
                        size="small"
                        onClick={() => remove(name)}
                      >
                        {t('dataSetManagement.removeSearchCondition')}
                      </Button>
                    }
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'columnName']}
                          label={t('dataSetManagement.columnNameLabel')}
                          rules={[{ required: true, message: t('dataSetManagement.columnNameRequired') }]}
                        >
                          <Select placeholder={t('dataSetManagement.columnNamePlaceholder')}>
                            {selectedDataSet?.columns?.map(col => (
                              <Select.Option key={col.columnName} value={col.columnName}>
                                {col.displayName || col.columnName}
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'operator']}
                          label={t('dataSetManagement.operator')}
                          rules={[{ required: true, message: t('dataSetManagement.operatorRequired') }]}
                        >
                          <Select placeholder={t('dataSetManagement.operatorPlaceholder')}>
                            <Select.Option value="equals">{t('dataSetManagement.equals')}</Select.Option>
                            <Select.Option value="contains">{t('dataSetManagement.contains')}</Select.Option>
                            <Select.Option value="greater_than">{t('dataSetManagement.greaterThan')}</Select.Option>
                            <Select.Option value="less_than">{t('dataSetManagement.lessThan')}</Select.Option>
                            <Select.Option value="date_range">{t('dataSetManagement.dateRange')}</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    
                    <Form.Item
                      {...restField}
                      name={[name, 'value']}
                      label={t('dataSetManagement.value')}
                      rules={[{ required: true, message: t('dataSetManagement.valueRequired') }]}
                    >
                      <Input placeholder={t('dataSetManagement.valuePlaceholder')} />
                    </Form.Item>
                  </Card>
                ))}
                
                <Button 
                  type="dashed" 
                  onClick={() => add()} 
                  block 
                  icon={<PlusOutlined />}
                >
                  {t('dataSetManagement.addSearchCondition')}
                </Button>
              </>
            )}
          </Form.List>
          
          <Divider />
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sortBy" label={t('dataSetManagement.sortBy')}>
                <Select placeholder={t('dataSetManagement.sortByPlaceholder')} allowClear>
                  {selectedDataSet?.columns?.filter(col => col.isSortable).map(col => (
                    <Select.Option key={col.columnName} value={col.columnName}>
                      {col.displayName || col.columnName}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sortOrder" label={t('dataSetManagement.sortOrder')}>
                <Select defaultValue="asc">
                  <Select.Option value="asc">{t('dataSetManagement.ascending')}</Select.Option>
                  <Select.Option value="desc">{t('dataSetManagement.descending')}</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {t('dataSetManagement.executeSearch')}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default DataSetManagementPage;