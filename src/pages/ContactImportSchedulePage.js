import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  Button, 
  Table, 
  Space, 
  Typography, 
  Row, 
  Col,
  message, 
  Modal, 
  Input,
  Select,
  InputNumber,
  Switch,
  Tag,
  Popconfirm,
  Tooltip,
  Divider,
  Form,
  Tabs,
  Spin
} from 'antd';
import { 
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { contactImportApi } from '../services/contactImportApi';
import { broadcastGroupApi, hashtagApi } from '../services/contactApi';
import ContactImportFieldMapping from '../components/ContactImportFieldMapping';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ContactImportSchedulePage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  
  // 字段映射相關狀態
  const [previewData, setPreviewData] = useState([]);
  const [previewColumns, setPreviewColumns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [fieldMappingForm] = Form.useForm();
  const previewDataLoadedRef = useRef(false);

  const [formData, setFormData] = useState({
    name: '',
    isScheduled: true,
    scheduleType: 'interval',
    intervalMinutes: 60,
    status: 'Active',
    isActive: true,
    importType: 'excel',
    sourceConfig: {},
    fieldMapping: {}
  });

  useEffect(() => {
    loadSchedules();
    loadGroups();
    loadHashtags();
  }, []);
  
  // 當編輯 modal 打開且 formData 準備好時，自動載入預覽數據
  useEffect(() => {
    if (editModalVisible && editingSchedule && formData.sourceConfig && Object.keys(formData.sourceConfig).length > 0 && !previewDataLoadedRef.current) {
      console.log('📋 useEffect 觸發載入預覽數據:', { formData, editingSchedule });
      previewDataLoadedRef.current = true;
      // 延遲一點確保所有狀態都已設置
      const timer = setTimeout(() => {
        loadPreviewData();
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // 當 modal 關閉時重置標誌
    if (!editModalVisible) {
      previewDataLoadedRef.current = false;
      setPreviewData([]);
      setPreviewColumns([]);
    }
  }, [editModalVisible, editingSchedule?.id, formData.sourceConfig]);
  
  // 載入廣播群組列表
  const loadGroups = async () => {
    try {
      const groupsResponse = await broadcastGroupApi.getGroups();
      const groupsData = Array.isArray(groupsResponse) ? groupsResponse : 
                        (groupsResponse?.data && Array.isArray(groupsResponse.data)) ? groupsResponse.data : [];
      setGroups(groupsData);
    } catch (error) {
      console.error('載入群組列表失敗:', error);
    }
  };

  // 載入標籤主檔列表
  const loadHashtags = async () => {
    try {
      const hashtagsResponse = await hashtagApi.getHashtags();
      const hashtagsData = Array.isArray(hashtagsResponse) ? hashtagsResponse : 
                          (hashtagsResponse?.data && Array.isArray(hashtagsResponse.data)) ? hashtagsResponse.data : [];
      setHashtags(hashtagsData);
    } catch (error) {
      console.error('載入標籤列表失敗:', error);
    }
  };
  
  // 載入數據預覽（用於字段映射）
  const loadPreviewData = async () => {
    if (!editingSchedule || !formData.sourceConfig) {
      console.log('⚠️ 無法載入預覽數據：缺少 sourceConfig', { editingSchedule, formData });
      return;
    }
    
    // 確保 sourceConfig 是對象
    let sourceConfig = formData.sourceConfig;
    if (typeof sourceConfig === 'string') {
      try {
        sourceConfig = JSON.parse(sourceConfig);
      } catch (e) {
        console.error('❌ 解析 sourceConfig 失敗:', e);
        message.warning('無法解析數據源配置');
        return;
      }
    }
    
    // 檢查必要的配置字段
    const importType = editingSchedule.importType || formData.importType;
    if (importType === 'excel' && !sourceConfig.filePath) {
      console.warn('⚠️ Excel 配置缺少 filePath');
      return;
    }
    if (importType === 'google' && !sourceConfig.url && !sourceConfig.spreadsheetId) {
      console.warn('⚠️ Google Sheets 配置缺少 url 或 spreadsheetId');
      return;
    }
    if (importType === 'sql' && !sourceConfig.server && !sourceConfig.query) {
      console.warn('⚠️ SQL 配置缺少必要字段');
      return;
    }
    
    try {
      setLoadingPreview(true);
      console.log('🚀 開始載入預覽數據:', { importType, sourceConfig });
      
      let result;
      
      if (importType === 'excel') {
        result = await contactImportApi.loadFromExcel(sourceConfig);
      } else if (importType === 'google') {
        result = await contactImportApi.loadFromGoogleDocs(sourceConfig);
      } else if (importType === 'sql') {
        result = await contactImportApi.loadFromSql(sourceConfig);
      } else {
        console.warn('⚠️ 未知的匯入類型:', importType);
        return;
      }
      
      console.log('📊 預覽數據載入結果:', result);
      
      if (result && result.success) {
        const data = result.data || [];
        const columns = result.columns || [];
        
        console.log('✅ 成功載入預覽數據:', { 
          dataCount: data.length, 
          columnsCount: columns.length,
          columns: columns 
        });
        
        setPreviewData(data);
        setPreviewColumns(columns.map(col => ({ 
          title: col, 
          dataIndex: col, 
          key: col 
        })));
        
        message.success(`成功載入 ${data.length} 筆預覽數據`);
      } else {
        console.error('❌ 載入失敗:', result);
        message.warning(result?.message || '無法載入數據預覽，但可以手動編輯字段映射');
      }
    } catch (error) {
      console.error('❌ 載入預覽數據失敗:', error);
      console.error('❌ 錯誤詳情:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      message.warning('無法載入數據預覽：' + (error.message || '未知錯誤') + '，但可以手動編輯字段映射');
    } finally {
      setLoadingPreview(false);
    }
  };

  // 載入排程列表
  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await contactImportApi.getSchedules();
      if (response.success) {
        setSchedules(response.schedules || []);
      }
    } catch (error) {
      message.error('載入排程列表失敗：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 刪除排程
  const handleDelete = async (id) => {
    try {
      await contactImportApi.deleteSchedule(id);
      message.success('排程已刪除');
      loadSchedules();
    } catch (error) {
      message.error('刪除排程失敗：' + error.message);
    }
  };

  // 手動執行排程
  const handleExecute = async (schedule) => {
    try {
      message.loading({ content: '正在執行匯入...', key: 'execute', duration: 0 });
      const result = await contactImportApi.executeSchedule(schedule.id);
      message.success({ 
        content: result.message || `匯入完成：成功 ${result.execution?.successCount || 0} 筆，失敗 ${result.execution?.failedCount || 0} 筆`, 
        key: 'execute',
        duration: 5 
      });
      // 重新載入排程列表以更新執行記錄
      loadSchedules();
    } catch (error) {
      console.error('執行排程失敗:', error);
      message.error({ 
        content: '執行匯入失敗：' + (error.message || '未知錯誤'), 
        key: 'execute',
        duration: 5 
      });
    }
  };

  // 更新排程狀態
  const handleToggleActive = async (schedule) => {
    try {
      // 使用 camelCase（後端已配置自動映射到 PascalCase）
      await contactImportApi.updateScheduleStatus(schedule.id, {
        isActive: !schedule.isActive
      });
      message.success(schedule.isActive ? '排程已停用' : '排程已啟用');
      loadSchedules();
    } catch (error) {
      console.error('❌ 更新排程狀態失敗:', error);
      console.error('❌ 錯誤詳情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      const errorMessage = error.response?.data?.message || error.message || '更新排程狀態失敗';
      message.error('更新排程狀態失敗：' + errorMessage);
    }
  };

  // 更新排程
  const handleUpdateSchedule = async () => {
    try {
      // 確保 sourceConfig 和 fieldMapping 是對象，不是字符串
      let sourceConfig = formData.sourceConfig || {};
      let fieldMapping = formData.fieldMapping || {};
      
      // 如果它們是字符串，嘗試解析
      if (typeof sourceConfig === 'string') {
        try {
          sourceConfig = JSON.parse(sourceConfig);
        } catch (e) {
          console.error('解析 sourceConfig 失敗:', e);
          sourceConfig = {};
        }
      }
      
      // 從字段映射表單獲取最新的映射值
      try {
        const mappingValues = fieldMappingForm.getFieldsValue();
        if (mappingValues && Object.keys(mappingValues).length > 0) {
          fieldMapping = mappingValues;
        }
      } catch (e) {
        console.warn('獲取字段映射表單值失敗，使用原有值:', e);
      }
      
      if (typeof fieldMapping === 'string') {
        try {
          fieldMapping = JSON.parse(fieldMapping);
        } catch (e) {
          console.error('解析 fieldMapping 失敗:', e);
          fieldMapping = {};
        }
      }
      
      // 確保 intervalMinutes 是數字
      const intervalMinutes = formData.scheduleType === 'interval' 
        ? (formData.intervalMinutes || 60) 
        : null;
      
      // 使用 camelCase（後端已配置自動映射到 PascalCase）
      const updateData = {
        name: formData.name || '',
        isScheduled: formData.isScheduled !== undefined ? formData.isScheduled : true,
        scheduleType: formData.scheduleType || 'interval',
        intervalMinutes: intervalMinutes,
        scheduleCron: null, // 如果後續需要支持 cron，可以添加
        sourceConfig: sourceConfig,
        fieldMapping: fieldMapping,
        allowUpdateDuplicates: editingSchedule?.allowUpdateDuplicates || false,
        broadcastGroupId: editingSchedule?.broadcastGroupId || null
      };
      
      console.log('📤 發送更新排程數據:', updateData);
      console.log('📤 sourceConfig:', JSON.stringify(sourceConfig, null, 2));
      console.log('📤 fieldMapping:', JSON.stringify(fieldMapping, null, 2));
      
      await contactImportApi.updateSchedule(editingSchedule.id, updateData);
      message.success('排程已更新');
      setEditModalVisible(false);
      loadSchedules();
    } catch (error) {
      console.error('❌ 更新排程失敗:', error);
      console.error('❌ 錯誤詳情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      const errorMessage = error.response?.data?.message || error.message || '更新排程失敗';
      message.error('更新排程失敗：' + errorMessage);
    }
  };

  // 編輯排程
  const handleEdit = async (schedule) => {
    setEditingSchedule(schedule);
    
    // 解析 sourceConfig 和 fieldMapping
    let sourceConfig = {};
    let fieldMapping = {};
    
    console.log('📋 編輯排程:', schedule);
    console.log('📋 sourceConfig:', schedule.sourceConfig);
    console.log('📋 fieldMapping:', schedule.fieldMapping);
    
    try {
      // schedule.sourceConfig 可能是字符串或對象
      if (schedule.sourceConfig) {
        if (typeof schedule.sourceConfig === 'string') {
          sourceConfig = JSON.parse(schedule.sourceConfig);
        } else {
          sourceConfig = schedule.sourceConfig;
        }
        console.log('✅ 解析後的 sourceConfig:', sourceConfig);
      }
      if (schedule.fieldMapping) {
        if (typeof schedule.fieldMapping === 'string') {
          fieldMapping = JSON.parse(schedule.fieldMapping);
        } else {
          fieldMapping = schedule.fieldMapping;
        }
        console.log('✅ 解析後的 fieldMapping:', fieldMapping);
      }
    } catch (e) {
      console.error('❌ 解析配置失敗:', e);
    }
    
    setFormData({
      name: schedule.name,
      isScheduled: schedule.isScheduled,
      scheduleType: schedule.scheduleType || 'interval',
      intervalMinutes: schedule.intervalMinutes || 60,
      status: schedule.status,
      isActive: schedule.isActive,
      importType: schedule.importType,
      sourceConfig: sourceConfig,
      fieldMapping: fieldMapping
    });
    
    // 設置字段映射表單值
    fieldMappingForm.setFieldsValue(fieldMapping);
    
    // 打開編輯 modal（useEffect 會自動載入預覽數據）
    setEditModalVisible(true);
  };

  // 獲取狀態標籤
  const getStatusTag = (status, isActive) => {
    if (!isActive) {
      return <Tag color="default">{t('common.inactive')}</Tag>;
    }
    switch (status) {
      case 'Active':
        return <Tag color="success">{t('common.active')}</Tag>;
      case 'Paused':
        return <Tag color="warning">{t('common.paused')}</Tag>;
      case 'Inactive':
        return <Tag color="default">{t('common.inactive')}</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // 獲取匯入類型標籤
  const getImportTypeTag = (type) => {
    const tags = {
      excel: { color: 'green', text: 'Excel' },
      google: { color: 'blue', text: 'Google Sheets' },
      sql: { color: 'purple', text: 'SQL Database' }
    };
    const tag = tags[type] || { color: 'default', text: type };
    return <Tag color={tag.color}>{tag.text}</Tag>;
  };

  const columns = [
    {
      title: t('contactImport.scheduleName'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true
    },
    {
      title: t('contactImport.importType'),
      dataIndex: 'importType',
      key: 'importType',
      width: 120,
      render: (type) => getImportTypeTag(type)
    },
    {
      title: t('contactImport.executionFrequency'),
      key: 'schedule',
      width: 150,
      render: (record) => {
        if (!record.isScheduled) return '-';
        switch (record.scheduleType) {
          case 'interval':
            return `${t('common.every')} ${record.intervalMinutes} ${t('common.minutes')}`;
          case 'daily':
            return t('contactImport.daily');
          case 'weekly':
            return t('contactImport.weekly');
          default:
            return record.scheduleType;
        }
      }
    },
    {
      title: t('contactImport.lastExecution'),
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: 180,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: t('contactImport.nextExecution'),
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 180,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: t('common.status'),
      key: 'status',
      width: 100,
      render: (record) => getStatusTag(record.status, record.isActive)
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (record) => (
        <Space>
          <Tooltip title={t('contactImport.manualExecute')}>
            <Button 
              type="link" 
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record)}
            />
          </Tooltip>
          <Tooltip title={t('common.edit')}>
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.isActive ? t('common.deactivate') : t('common.activate')}>
            <Button 
              type="link" 
              icon={record.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleToggleActive(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t('contactImport.confirmDeleteSchedule')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Tooltip title={t('common.delete')}>
              <Button 
                type="link" 
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 頁面標題 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Button 
            type="primary"
            shape="square"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/contacts')}
            style={{ 
              width: '40px', 
              height: '40px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px'
            }}
          />
        </Col>
        <Col flex="auto">
          <Title level={2} style={{ margin: 0 }}>
            {t('contactImport.scheduleManagement')}
          </Title>
        </Col>
      </Row>

      {/* 排程列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={schedules}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 筆排程`
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 編輯 Modal */}
      <Modal
        title={t('contactImport.editSchedule')}
        open={editModalVisible}
        onOk={handleUpdateSchedule}
        onCancel={() => {
          setEditModalVisible(false);
          setPreviewData([]);
          setPreviewColumns([]);
          fieldMappingForm.resetFields();
          previewDataLoadedRef.current = false;
        }}
        width={1000}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        styles={{ body: { minHeight: '500px' } }}
      >
        {editingSchedule && (
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: (
                  <span>
                    <SettingOutlined />
                    {t('contactImport.basicSettings')}
                  </span>
                ),
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                      <Text strong>{t('contactImport.scheduleName')}：</Text>
                      <Input 
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t('contactImport.scheduleNamePlaceholder')}
                        style={{ marginTop: '8px' }}
                      />
                    </div>

                    <div>
                      <Text strong>{t('contactImport.executionFrequency')}：</Text>
                      <Select 
                        value={formData.scheduleType}
                        onChange={(value) => setFormData({ ...formData, scheduleType: value })}
                        style={{ width: '100%', marginTop: '8px' }}
                      >
                        <Option value="interval">{t('contactImport.everyXMinutes')}</Option>
                        <Option value="daily">{t('contactImport.daily')}</Option>
                        <Option value="weekly">{t('contactImport.weekly')}</Option>
                      </Select>
                      {formData.scheduleType === 'interval' && (
                        <InputNumber
                          value={formData.intervalMinutes}
                          onChange={(value) => setFormData({ ...formData, intervalMinutes: value })}
                          min={1}
                          max={525600}
                          style={{ width: '100%', marginTop: '8px' }}
                          addonBefore={t('common.every')}
                          addonAfter={t('common.minutes')}
                        />
                      )}
                    </div>

                    <div>
                      <Space>
                        <Text strong>{t('common.status')}：</Text>
                        <Switch 
                          checked={formData.isActive}
                          onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                        />
                        <Text>{formData.isActive ? t('common.active') : t('common.inactive')}</Text>
                      </Space>
                    </div>

                    <Divider style={{ margin: '8px 0' }} />
                    
                    <div>
                      <Text strong>{t('contactImport.importType')}：</Text>
                      <div style={{ marginTop: '8px' }}>
                        {getImportTypeTag(editingSchedule.importType)}
                      </div>
                    </div>

                    {/* Excel 配置 */}
                    {formData.importType === 'excel' && formData.sourceConfig && (
                      <div>
                        <Text strong>{t('contactImport.excelFilePath')}：</Text>
                        <Input 
                          value={formData.sourceConfig.filePath || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            sourceConfig: { ...formData.sourceConfig, filePath: e.target.value }
                          })}
                          placeholder="/Uploads/excel/example.xlsx"
                          style={{ marginTop: '8px' }}
                        />
                        <div style={{ marginTop: '8px' }}>
                          <Text strong>{t('contactImport.sheetName')}：</Text>
                          <Input 
                            value={formData.sourceConfig.sheetName || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              sourceConfig: { ...formData.sourceConfig, sheetName: e.target.value }
                            })}
                            placeholder="Sheet1"
                            style={{ width: '100%', marginTop: '8px' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Google Sheets 配置 */}
                    {formData.importType === 'google' && formData.sourceConfig && (
                      <div>
                        <Text strong>{t('contactImport.googleDocsUrl')}：</Text>
                        <Input 
                          value={formData.sourceConfig.url || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            sourceConfig: { ...formData.sourceConfig, url: e.target.value }
                          })}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          style={{ marginTop: '8px' }}
                        />
                        {formData.sourceConfig.fileType === 'googlesheets' && (
                          <div style={{ marginTop: '8px' }}>
                            <Text strong>{t('contactImport.sheetName')}：</Text>
                            <Input 
                              value={formData.sourceConfig.sheetName || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                sourceConfig: { ...formData.sourceConfig, sheetName: e.target.value }
                              })}
                              placeholder="Sheet1"
                              style={{ width: '100%', marginTop: '8px' }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* SQL 配置 */}
                    {formData.importType === 'sql' && formData.sourceConfig && (
                      <div>
                        <Space direction="vertical" style={{ width: '100%' }} size="small">
                          <div>
                            <Text strong>{t('contactImport.server')}：</Text>
                            <Input 
                              value={formData.sourceConfig.server || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                sourceConfig: { ...formData.sourceConfig, server: e.target.value }
                              })}
                              placeholder="localhost"
                              style={{ width: '100%', marginTop: '8px' }}
                            />
                          </div>
                          <div>
                            <Text strong>{t('contactImport.database')}：</Text>
                            <Input 
                              value={formData.sourceConfig.database || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                sourceConfig: { ...formData.sourceConfig, database: e.target.value }
                              })}
                              placeholder="contacts_db"
                              style={{ width: '100%', marginTop: '8px' }}
                            />
                          </div>
                          <div>
                            <Text strong>{t('contactImport.username')}：</Text>
                            <Input 
                              value={formData.sourceConfig.username || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                sourceConfig: { ...formData.sourceConfig, username: e.target.value }
                              })}
                              placeholder="username"
                              style={{ width: '100%', marginTop: '8px' }}
                            />
                          </div>
                          <div>
                            <Text strong>{t('contactImport.password')}：</Text>
                            <Input.Password 
                              value={formData.sourceConfig.password || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                sourceConfig: { ...formData.sourceConfig, password: e.target.value }
                              })}
                              placeholder="password"
                              style={{ width: '100%', marginTop: '8px' }}
                            />
                          </div>
                          <div>
                            <Text strong>{t('contactImport.tableName')}：</Text>
                            <Input 
                              value={formData.sourceConfig.table || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                sourceConfig: { ...formData.sourceConfig, table: e.target.value }
                              })}
                              placeholder="contacts"
                              style={{ width: '100%', marginTop: '8px' }}
                            />
                          </div>
                          <div>
                            <Text strong>{t('contactImport.customQuery')}：</Text>
                            <TextArea 
                              value={formData.sourceConfig.query || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                sourceConfig: { ...formData.sourceConfig, query: e.target.value }
                              })}
                              placeholder="SELECT * FROM contacts WHERE..."
                              rows={2}
                              style={{ width: '100%', marginTop: '8px' }}
                            />
                          </div>
                        </Space>
                      </div>
                    )}

                    {editingSchedule.lastRunAt && (
                      <div>
                        <Text type="secondary">
                          {t('contactImport.lastExecution')}：{dayjs(editingSchedule.lastRunAt).format('YYYY-MM-DD HH:mm:ss')}
                        </Text>
                      </div>
                    )}
                  </Space>
                )
              },
              {
                key: 'fieldMapping',
                label: (
                  <span>
                    <UnorderedListOutlined />
                    {t('contactImport.fieldMapping')}
                  </span>
                ),
                children: (
                  <Spin spinning={loadingPreview}>
                    <Row gutter={16} style={{ minHeight: '400px' }}>
                      <Col span={12}>
                        <Card 
                          title={t('contactImport.dataPreview')}
                          style={{ height: '450px' }}
                          styles={{ body: { height: '400px', padding: '16px', overflow: 'auto' } }}
                        >
                          {loadingPreview ? (
                            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                              <Spin size="large" />
                              <div style={{ marginTop: '16px', color: '#999' }}>
                                {t('contactImport.loadingPreview')}
                              </div>
                            </div>
                          ) : previewColumns.length > 0 && previewData.length > 0 ? (
                            <Table
                              columns={previewColumns.map(col => ({
                                ...col,
                                ellipsis: true,
                                resizable: true,
                                width: 120,
                                title: (
                                  <div style={{ 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap',
                                    maxWidth: '120px'
                                  }}>
                                    {col.title || col.dataIndex}
                                  </div>
                                )
                              }))}
                              dataSource={previewData}
                              pagination={{ 
                                pageSize: 10,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 筆，共 ${total} 筆`
                              }}
                              size="small"
                              scroll={{ x: 'max-content', y: 350 }}
                              bordered
                              components={{
                                header: {
                                  cell: (props) => (
                                    <th 
                                      {...props} 
                                      style={{ 
                                        ...props.style, 
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        minWidth: '120px',
                                        maxWidth: '200px',
                                        resize: 'horizontal',
                                        cursor: 'col-resize'
                                      }} 
                                    />
                                  )
                                }
                              }}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                              {t('contactImport.noPreviewData')}
                            </div>
                          )}
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card 
                          title={t('contactImport.fieldMapping')}
                          style={{ height: '450px' }}
                          styles={{ body: { height: '400px', padding: '16px' } }}
                        >
                          <ContactImportFieldMapping
                            form={fieldMappingForm}
                            columns={previewColumns}
                            groups={groups}
                            hashtags={hashtags}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </Spin>
                )
              }
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

export default ContactImportSchedulePage;

