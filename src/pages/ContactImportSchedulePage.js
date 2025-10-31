import React, { useState, useEffect } from 'react';
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
  Form
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
  CloseCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { contactImportApi } from '../services/contactImportApi';
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
  }, []);

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

  // 更新排程狀態
  const handleToggleActive = async (schedule) => {
    try {
      await contactImportApi.updateScheduleStatus(schedule.id, {
        isActive: !schedule.isActive
      });
      message.success(schedule.isActive ? '排程已停用' : '排程已啟用');
      loadSchedules();
    } catch (error) {
      message.error('更新排程狀態失敗：' + error.message);
    }
  };

  // 更新排程
  const handleUpdateSchedule = async () => {
    try {
      await contactImportApi.updateSchedule(editingSchedule.id, {
        name: formData.name,
        isScheduled: formData.isScheduled,
        scheduleType: formData.scheduleType,
        intervalMinutes: formData.intervalMinutes,
        sourceConfig: formData.sourceConfig,
        fieldMapping: formData.fieldMapping,
        allowUpdateDuplicates: editingSchedule.allowUpdateDuplicates || false,
        broadcastGroupId: editingSchedule.broadcastGroupId
      });
      message.success('排程已更新');
      setEditModalVisible(false);
      loadSchedules();
    } catch (error) {
      message.error('更新排程失敗：' + error.message);
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
        onCancel={() => setEditModalVisible(false)}
        width={700}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        {editingSchedule && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text strong>{t('contactImport.scheduleName')}：</Text>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('contactImport.scheduleNamePlaceholder')}
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
              {getImportTypeTag(editingSchedule.importType)}
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
        )}
      </Modal>
    </div>
  );
};

export default ContactImportSchedulePage;

