import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, Select, Upload, message, 
  Card, Tag, Space, Typography, Drawer, Tooltip, Popconfirm,
  Tabs, Switch, InputNumber, Divider, Alert, Row, Col, Collapse, Radio
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined,
  DatabaseOutlined, FileExcelOutlined, LinkOutlined, EyeOutlined,
  UploadOutlined, DownloadOutlined, SettingOutlined, SearchOutlined,
  FilterOutlined, SortAscendingOutlined, SortDescendingOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;
const { Panel } = Collapse;

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

  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    console.log('DataSetManagementPage: 組件已掛載，開始獲取數據');
    fetchDataSets();
  }, []);

  const fetchDataSets = async (page = 1, pageSize = 10) => {
    console.log(`fetchDataSets: 開始獲取數據，頁面: ${page}, 頁面大小: ${pageSize}`);
    setLoading(true);
    try {
      const response = await fetch(`/api/datasets?page=${page}&pageSize=${pageSize}`);
      const result = await response.json();
      console.log('fetchDataSets: API 響應結果:', result);
      
      if (result.success) {
        console.log('fetchDataSets: 成功獲取數據，數據集數量:', result.data.length);
        console.log('fetchDataSets: 第一個數據集示例:', result.data[0]);
        setDataSets(result.data);
        if (result.pagination) {
          setPagination({
            current: result.pagination.page,
            pageSize: result.pagination.pageSize,
            total: result.pagination.totalCount
          });
        }
      } else {
        console.error('fetchDataSets: API 返回失敗:', result.message);
        message.error('獲取 DataSet 列表失敗: ' + result.message);
      }
    } catch (error) {
      console.error('fetchDataSets: 請求失敗:', error);
      message.error('獲取 DataSet 列表失敗');
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
              sqlParameters: dataSource.sqlParameters,
              autoUpdate: dataSource.autoUpdate,
              updateIntervalMinutes: dataSource.updateIntervalMinutes
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
              sqlParameters: dataSource.sqlParameters,
              autoUpdate: dataSource.autoUpdate,
              updateIntervalMinutes: dataSource.updateIntervalMinutes
            });
          } else {
            // 向後兼容：舊的 databaseConnection 欄位
            dataSourceForm.setFieldsValue({
              sourceType: dataSource.sourceType,
              connectionType: 'preset',
              presetConnection: dataSource.databaseConnection,
              sqlQuery: dataSource.sqlQuery,
              sqlParameters: dataSource.sqlParameters,
              autoUpdate: dataSource.autoUpdate,
              updateIntervalMinutes: dataSource.updateIntervalMinutes
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
            sqlParameters: dataSource.sqlParameters,
            autoUpdate: dataSource.autoUpdate,
            updateIntervalMinutes: dataSource.updateIntervalMinutes
          });
        }
      } else {
        // 非 SQL 數據源或其他情況
        dataSourceForm.setFieldsValue({
          sourceType: dataSource.sourceType,
          databaseConnection: dataSource.databaseConnection,
          sqlQuery: dataSource.sqlQuery,
          excelFilePath: dataSource.excelFilePath,
          excelSheetName: dataSource.excelSheetName,
          googleDocsUrl: dataSource.googleDocsUrl,
          googleDocsSheetName: dataSource.googleDocsSheetName,
          autoUpdate: dataSource.autoUpdate,
          updateIntervalMinutes: dataSource.updateIntervalMinutes
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
        message.success('刪除成功');
        fetchDataSets();
      } else {
        message.error('刪除失敗: ' + result.message);
      }
    } catch (error) {
      console.error('handleDelete: 刪除請求失敗:', error);
      message.error('刪除失敗');
    }
  };

  const handleSync = async (id) => {
    console.log('handleSync: 開始同步 DataSet, ID:', id);
    
    // 顯示同步中的狀態
    const syncButton = document.querySelector(`[data-sync-id="${id}"]`);
    if (syncButton) {
      syncButton.disabled = true;
      syncButton.innerHTML = '<SyncOutlined spin /> 同步中...';
    }
    
    try {
      const response = await fetch(`/api/datasets/${id}/sync`, {
        method: 'POST'
      });
      const result = await response.json();
      console.log('handleSync: 同步結果:', result);
      
      if (result.success) {
        message.success(`同步成功！共處理 ${result.data?.totalRecords || 0} 條記錄`);
        fetchDataSets();
      } else {
        message.error('同步失敗: ' + (result.error || result.message));
      }
    } catch (error) {
      console.error('handleSync: 同步請求失敗:', error);
      message.error('同步失敗: ' + error.message);
    } finally {
      // 恢復按鈕狀態
      if (syncButton) {
        syncButton.disabled = false;
        syncButton.innerHTML = '<SyncOutlined /> 同步數據';
      }
    }
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

  const fetchRecords = async (datasetId, searchParams = {}) => {
    console.log('fetchRecords: 開始獲取記錄，DataSet ID:', datasetId, '搜尋參數:', searchParams);
    setRecordsLoading(true);
    try {
      let url = `/api/datasets/${datasetId}/records`;
      if (Object.keys(searchParams).length > 0) {
        const params = new URLSearchParams(searchParams);
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
        
        setRecords(result.data);
      } else {
        console.error('fetchRecords: 獲取記錄失敗:', result.message);
        message.error('獲取記錄失敗: ' + result.message);
      }
    } catch (error) {
      console.error('fetchRecords: 請求失敗:', error);
      
      // 更詳細的錯誤信息
      if (error.message.includes('HTTP')) {
        message.error(`獲取記錄失敗: ${error.message}`);
      } else if (error.name === 'SyntaxError') {
        message.error('服務器返回了無效的數據格式，請檢查後端日誌');
      } else {
        message.error('獲取記錄失敗: ' + error.message);
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
        message.success(`找到 ${result.totalCount} 條記錄`);
      } else {
        message.error('搜尋失敗: ' + result.message);
      }
    } catch (error) {
      console.error('handleSearch: 搜尋請求失敗:', error);
      message.error('搜尋失敗');
    }
  };

  const handleSubmit = async () => {
    console.log('handleSubmit: 開始提交表單');
    try {
      const values = await form.validateFields();
      const dataSourceValues = await dataSourceForm.validateFields();
      const columnsValues = await columnsForm.validateFields();
      
      console.log('handleSubmit: 表單驗證通過，基本資訊:', values);
      console.log('handleSubmit: 數據源配置:', dataSourceValues);
      console.log('handleSubmit: 欄位定義:', columnsValues);
      
      // 從數據源配置中獲取數據源類型
      const sourceType = dataSourceValues.sourceType;
      
      if (!sourceType) {
        message.error('請選擇數據源類型');
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
        message.success(editingDataSet ? '更新成功' : '創建成功');
        setModalVisible(false);
        fetchDataSets();
      } else {
        message.error('操作失敗: ' + result.message);
      }
    } catch (error) {
      console.error('handleSubmit: 提交失敗:', error);
      message.error('操作失敗');
    }
  };

  const columns = [
    {
      title: '名稱',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.description}</div>
        </div>
      )
    },
    {
      title: '數據源類型',
      dataIndex: 'dataSourceType',
      key: 'dataSourceType',
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
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          'Active': { color: 'success', text: '啟用' },
          'Inactive': { color: 'default', text: '停用' },
          'Error': { color: 'error', text: '錯誤' }
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '記錄數',
      dataIndex: 'totalRecords',
      key: 'totalRecords',
      render: (count) => <Text>{count || 0}</Text>
    },
    {
      title: '最後更新',
      dataIndex: 'lastDataSyncTime',
      key: 'lastDataSyncTime',
      render: (time) => time ? new Date(time).toLocaleString('zh-TW') : '從未同步'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看記錄">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handleViewRecords(record)}
            />
          </Tooltip>
                     <Tooltip title="同步數據">
             <Button 
               type="text" 
               icon={<SyncOutlined />} 
               onClick={() => handleSync(record.id)}
               data-sync-id={record.id}
             />
           </Tooltip>
          <Tooltip title="編輯">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="確定要刪除這個 DataSet 嗎？"
            onConfirm={() => handleDelete(record.id)}
            okText="確定"
            cancelText="取消"
          >
            <Tooltip title="刪除">
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
            return value.booleanValue ? '是' : '否';
          default:
            return value.stringValue || value.textValue || '-';
        }
      },
      sorter: col.isSortable,
      filters: col.isSearchable ? undefined : null
    }));
  };

  const handleTableChange = (paginationInfo) => {
    console.log('handleTableChange: 分頁變更:', paginationInfo);
    fetchDataSets(paginationInfo.current, paginationInfo.pageSize);
  };

  // 新增：處理工作表變更的函數
  const handleSheetChange = async (sheetName) => {
    if (!sheetName) return;
    
    console.log('工作表變更為:', sheetName);
    setSheetLoading(true);
    
    try {
      const filePath = dataSourceForm.getFieldValue('excelFilePath');
      if (!filePath) {
        message.error('請先上傳 Excel 文件');
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
          isPrimaryKey: index === 0, // 假設第一列是主鍵
          isSearchable: true,
          isSortable: true,
          isIndexed: false,
          defaultValue: col.defaultValue,
          sortOrder: col.sortOrder
        }));
        
        columnsForm.setFieldsValue({ columns: columnsData });
        message.success(`已自動生成 ${result.columns.length} 個欄位定義`);
      } else {
        message.error('獲取欄位預覽失敗: ' + result.message);
      }
    } catch (error) {
      console.error('工作表變更處理失敗:', error);
      message.error('處理失敗: ' + error.message);
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
          message.error('請選擇預設連接');
          return;
        }
        message.success(`預設連接配置完成: ${presetConnection}`);
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
          message.error('請輸入伺服器名稱和數據庫名稱');
          return;
        }

        if (authType === 'sql' && (!username || !password)) {
          message.error('請輸入 SQL Server 認證信息');
          return;
        }

        if (!sqlQuery) {
          message.error('請先輸入 SQL 查詢語句');
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
        message.loading('正在測試連接...', 0);

        try {
          const response = await fetch('/api/datasets/test-sql-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionString })
          });
          
          const result = await response.json();
          
          if (result.success) {
            message.destroy();
            message.success('連接測試成功！正在獲取欄位定義...');
            console.log('連接字符串:', connectionString);
            
            // 連接測試成功後，自動獲取欄位定義
            await generateColumnsFromSql(sqlQuery, connectionString);
            
          } else {
            message.destroy();
            message.error(`連接測試失敗: ${result.message}`);
          }
        } catch (error) {
          message.destroy();
          console.error('SQL 連接測試請求失敗:', error);
          message.error('連接測試失敗: ' + error.message);
        }
      }
    } catch (error) {
      console.error('連接測試失敗:', error);
      message.error('請先完成連接配置');
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
          isPrimaryKey: index === 0, // 假設第一列是主鍵
          isSearchable: true,
          isSortable: true,
          isIndexed: false,
          defaultValue: col.defaultValue,
          sortOrder: index
        }));
        
        columnsForm.setFieldsValue({ columns: columnsData });
        message.success(`已自動生成 ${result.columns.length} 個欄位定義`);
        
        // 自動切換到欄位定義標籤
        const tabsElement = document.querySelector('.ant-tabs-tab[data-key="columns"]');
        if (tabsElement) {
          tabsElement.click();
        }
        
      } else {
        console.error('獲取欄位定義失敗:', result.message);
        message.warning('無法自動生成欄位定義: ' + result.message);
      }
    } catch (error) {
      console.error('生成欄位定義失敗:', error);
      message.warning('無法自動生成欄位定義，請手動配置');
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

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={3}>Data Set 管理</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleCreate}
        >
          創建 Data Set
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={dataSets}
          loading={loading}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 條記錄`,
            pageSizeOptions: ['10', '20', '50', '100'],
            showSizeChanger: true,
            showQuickJumper: true
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* 創建/編輯 Modal */}
      <Modal
        title={editingDataSet ? '編輯 Data Set' : '創建 Data Set'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={900}
        okText="保存"
        cancelText="取消"
      >
        <Tabs defaultActiveKey="basic">
          <TabPane tab="基本資訊" key="basic">
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="name"
                    label="名稱"
                    rules={[{ required: true, message: '請輸入名稱' }]}
                  >
                    <Input placeholder="輸入 Data Set 名稱" />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item name="description" label="描述">
                <TextArea rows={3} placeholder="輸入描述" />
              </Form.Item>
              
              <Alert
                message="數據源類型設定"
                description="請在「數據源配置」標籤中選擇數據源類型並進行相應配置。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="isScheduled" label="定時更新">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="updateIntervalMinutes"
                    label="更新間隔（分鐘）"
                    dependencies={['isScheduled']}
                    rules={[
                      {
                        required: form.getFieldValue('isScheduled'),
                        message: '請設定更新間隔'
                      }
                    ]}
                  >
                    <InputNumber 
                      min={1} 
                      max={1440} 
                      placeholder="例如：60（1小時）"
                      disabled={!form.getFieldValue('isScheduled')}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </TabPane>
          
          <TabPane tab="數據源配置" key="dataSource">
            <Form form={dataSourceForm} layout="vertical">
              <Form.Item
                name="sourceType"
                label="數據源類型"
                rules={[{ required: true, message: '請選擇數據源類型' }]}
              >
                <Select 
                  placeholder="選擇數據源類型"
                  onChange={(value) => {
                    console.log('數據源類型變更為:', value);
                  }}
                >
                  <Select.Option value="SQL">SQL 查詢</Select.Option>
                  <Select.Option value="EXCEL">Excel 文件</Select.Option>
                  <Select.Option value="GOOGLE_DOCS">Google Docs</Select.Option>
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
                        <Form.Item name="connectionType" label="連接方式">
                          <Radio.Group defaultValue="preset">
                            <Radio value="preset">使用預設連接</Radio>
                            <Radio value="custom">自定義連接</Radio>
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
                                <Form.Item name="presetConnection" label="預設數據庫連接">
                                  <Select placeholder="選擇數據庫連接">
                                    <Select.Option value="erp_awh">ERP 數據庫</Select.Option>
                                    <Select.Option value="purple_rice">Purple Rice 數據庫</Select.Option>
                                  </Select>
                                </Form.Item>
                              );
                            }
                            
                            if (connectionType === 'custom') {
                              return (
                                <>
                                  <Row gutter={16}>
                                    <Col span={12}>
                                      <Form.Item
                                        name="serverName"
                                        label="伺服器名稱/IP"
                                        rules={[{ required: true, message: '請輸入伺服器名稱或IP' }]}
                                      >
                                        <Input placeholder="例如：192.168.1.100" />
                                      </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                      <Form.Item
                                        name="port"
                                        label="端口號"
                                        initialValue="1433"
                                      >
                                        <Input placeholder="例如：1433" />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                  
                                  <Row gutter={16}>
                                    <Col span={12}>
                                      <Form.Item
                                        name="databaseName"
                                        label="數據庫名稱"
                                        rules={[{ required: true, message: '請輸入數據庫名稱' }]}
                                      >
                                        <Input placeholder="例如：MyDatabase" />
                                      </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                      <Form.Item
                                        name="authenticationType"
                                        label="認證方式"
                                        initialValue="sql"
                                      >
                                        <Select>
                                          <Select.Option value="sql">SQL Server 認證</Select.Option>
                                          <Select.Option value="windows">Windows 認證</Select.Option>
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
                                                label="用戶名"
                                                rules={[{ required: true, message: '請輸入用戶名' }]}
                                              >
                                                <Input placeholder="例如：sa" />
                                              </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                              <Form.Item
                                                name="password"
                                                label="密碼"
                                                rules={[{ required: true, message: '請輸入密碼' }]}
                                              >
                                                <Input.Password placeholder="輸入密碼" />
                                              </Form.Item>
                                            </Col>
                                          </Row>
                                        );
                                      }
                                      
                                      return null;
                                    }}
                                  </Form.Item>
                                  
                                  <Form.Item name="additionalOptions" label="額外連接選項">
                                    <TextArea 
                                      rows={2} 
                                      placeholder="例如：TrustServerCertificate=true;MultipleActiveResultSets=true"
                                    />
                                  </Form.Item>
                                  
                                  <Alert
                                    message="連接測試"
                                    description="配置完成後，可以點擊下方按鈕測試連接是否成功。"
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
                                      測試連接
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
                          label="SQL 查詢語句"
                          rules={[{ required: true, message: '請輸入 SQL 查詢語句' }]}
                        >
                          <TextArea 
                            rows={6} 
                            placeholder="SELECT * FROM table_name WHERE condition"
                          />
                        </Form.Item>
                        
                        <Form.Item name="sqlParameters" label="SQL 參數（JSON 格式）">
                          <TextArea 
                            rows={3} 
                            placeholder='{"param1": "value1", "param2": "value2"}'
                          />
                        </Form.Item>
                      </>
                    );
                  }
                  
                  if (sourceType === 'EXCEL') {
                    return (
                      <>
                        <Form.Item name="excelFilePath" label="Excel 文件路徑">
                          <Input placeholder="例如：/uploads/excel/data.xlsx" />
                        </Form.Item>
                        
                                                 <Form.Item name="excelSheetName" label="工作表名稱">
                           <Select 
                             placeholder="選擇工作表"
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
                        
                        <Form.Item name="excelUrl" label="Excel 文件 URL">
                          <Input placeholder="例如：https://example.com/data.xlsx" />
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
                              message.error('只能上傳 Excel 文件！');
                              return false;
                            }
                            
                            // 檢查文件大小（限制為 10MB）
                            const isLt10M = file.size / 1024 / 1024 < 10;
                            if (!isLt10M) {
                              message.error('文件大小不能超過 10MB！');
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
                                throw new Error('文件上傳失敗');
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
                                    message.warning('無法自動獲取工作表名稱: ' + sheetsResult.message);
                                  }
                                } catch (error) {
                                  console.error('獲取工作表名稱失敗:', error);
                                  message.warning('無法自動獲取工作表名稱，請手動選擇');
                                }
                                
                                message.success(`${file.name} 上傳成功`);
                                onSuccess(uploadResult);
                              } else {
                                throw new Error(uploadResult.message || '上傳失敗');
                              }
                            } catch (error) {
                              console.error('文件上傳錯誤:', error);
                              message.error(`上傳失敗: ${error.message}`);
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
                          <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
                        </Upload>
                        
                                                 <Alert
                           message="Excel 上傳說明"
                           description="上傳成功後，文件路徑會自動填充。保存 DataSet 後，點擊「同步數據」按鈕來將 Excel 數據導入到數據庫中。系統會自動根據 Excel 標題行生成欄位定義。"
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
                          label="Google Docs URL"
                          rules={[{ required: true, message: '請輸入 Google Docs URL' }]}
                        >
                          <Input placeholder="https://docs.google.com/spreadsheets/d/..." />
                        </Form.Item>
                        
                        <Form.Item name="googleDocsSheetName" label="工作表名稱">
                          <Input placeholder="例如：Sheet1" />
                        </Form.Item>
                        
                        <Alert
                          message="Google Docs 整合說明"
                          description="請確保 Google Docs 文件已設定為可公開讀取，或已配置適當的認證信息。"
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      </>
                    );
                  }
                  
                  return null;
                }}
              </Form.Item>
              
              <Divider />
              
              <Form.Item name="autoUpdate" label="自動更新">
                <Switch />
              </Form.Item>
              
              <Form.Item
                name="updateIntervalMinutes"
                label="更新間隔（分鐘）"
                dependencies={['autoUpdate']}
                rules={[
                  {
                    required: dataSourceForm.getFieldValue('autoUpdate'),
                    message: '請設定更新間隔'
                  }
                ]}
              >
                <InputNumber 
                  min={1} 
                  max={1440} 
                  placeholder="例如：60（1小時）"
                  disabled={!dataSourceForm.getFieldValue('autoUpdate')}
                />
              </Form.Item>
            </Form>
          </TabPane>
          
                     <TabPane tab="欄位定義" key="columns">
             <Form form={columnsForm} layout="vertical">
               <Alert
                 message="欄位定義說明"
                 description="對於 Excel 數據源，系統會自動根據 Excel 標題行生成欄位定義。您可以在同步數據後手動調整欄位屬性。"
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
                            刪除
                          </Button>
                        }
                      >
                        <Row gutter={16}>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'columnName']}
                              label="欄位名稱"
                              rules={[{ required: true, message: '請輸入欄位名稱' }]}
                            >
                              <Input placeholder="例如：customer_id" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'displayName']}
                              label="顯示名稱"
                            >
                              <Input placeholder="例如：客戶編號" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'dataType']}
                              label="數據類型"
                              rules={[{ required: true, message: '請選擇數據類型' }]}
                            >
                              <Select placeholder="選擇數據類型">
                                <Select.Option value="string">字串</Select.Option>
                                <Select.Option value="int">整數</Select.Option>
                                <Select.Option value="decimal">小數</Select.Option>
                                <Select.Option value="datetime">日期時間</Select.Option>
                                <Select.Option value="boolean">布林值</Select.Option>
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
                              <Switch checkedChildren="主鍵" unCheckedChildren="普通" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'isSearchable']}
                              valuePropName="checked"
                            >
                              <Switch checkedChildren="可搜尋" unCheckedChildren="不可搜尋" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'isSortable']}
                              valuePropName="checked"
                            >
                              <Switch checkedChildren="可排序" unCheckedChildren="不可排序" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'isIndexed']}
                              valuePropName="checked"
                            >
                              <Switch checkedChildren="建索引" unCheckedChildren="不建索引" />
                            </Form.Item>
                          </Col>
                        </Row>
                        
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'defaultValue']}
                              label="預設值"
                            >
                              <Input placeholder="預設值" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'sortOrder']}
                              label="排序順序"
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
                      添加欄位
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
        title={`${selectedDataSet?.name} - 數據記錄`}
        placement="right"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={1200}
        extra={
          <Space>
            <Button 
              icon={<SearchOutlined />} 
              onClick={() => setSearchDrawerVisible(true)}
            >
              進階搜尋
            </Button>
            <Button 
              icon={<SyncOutlined />} 
              onClick={() => selectedDataSet && fetchRecords(selectedDataSet.id)}
            >
              重新整理
            </Button>
          </Space>
        }
      >
        <Table
          columns={[
            {
              title: 'ID',
              dataIndex: 'id',
              key: 'id',
              width: 80,
              render: (id) => id.substring(0, 8) + '...'
            },
            {
              title: '主鍵值',
              dataIndex: 'primaryKeyValue',
              key: 'primaryKeyValue',
              width: 120
            },
            {
              title: '狀態',
              dataIndex: 'status',
              key: 'status',
              width: 80,
              render: (status) => (
                <Tag color={status === 'Active' ? 'success' : 'default'}>
                  {status || 'N/A'}
                </Tag>
              )
            },
            {
              title: '建立時間',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 150,
              render: (time) => new Date(time).toLocaleString('zh-TW')
            },
            ...renderRecordColumns()
          ]}
          dataSource={records}
          loading={recordsLoading}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 條記錄`
          }}
        />
      </Drawer>

      {/* 進階搜尋 Drawer */}
      <Drawer
        title="進階搜尋"
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
                        刪除
                      </Button>
                    }
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'columnName']}
                          label="欄位名稱"
                          rules={[{ required: true, message: '請選擇欄位' }]}
                        >
                          <Select placeholder="選擇欄位">
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
                          label="操作符"
                          rules={[{ required: true, message: '請選擇操作符' }]}
                        >
                          <Select placeholder="選擇操作符">
                            <Select.Option value="equals">等於</Select.Option>
                            <Select.Option value="contains">包含</Select.Option>
                            <Select.Option value="greater_than">大於</Select.Option>
                            <Select.Option value="less_than">小於</Select.Option>
                            <Select.Option value="date_range">日期範圍</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    
                    <Form.Item
                      {...restField}
                      name={[name, 'value']}
                      label="值"
                      rules={[{ required: true, message: '請輸入值' }]}
                    >
                      <Input placeholder="輸入搜尋值" />
                    </Form.Item>
                  </Card>
                ))}
                
                <Button 
                  type="dashed" 
                  onClick={() => add()} 
                  block 
                  icon={<PlusOutlined />}
                >
                  添加搜尋條件
                </Button>
              </>
            )}
          </Form.List>
          
          <Divider />
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sortBy" label="排序欄位">
                <Select placeholder="選擇排序欄位" allowClear>
                  {selectedDataSet?.columns?.filter(col => col.isSortable).map(col => (
                    <Select.Option key={col.columnName} value={col.columnName}>
                      {col.displayName || col.columnName}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sortOrder" label="排序方向">
                <Select defaultValue="asc">
                  <Select.Option value="asc">升序</Select.Option>
                  <Select.Option value="desc">降序</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              執行搜尋
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default DataSetManagementPage;