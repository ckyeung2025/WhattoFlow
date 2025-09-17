import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Upload, 
  Table, 
  Form, 
  Input, 
  Select, 
  Space, 
  Typography, 
  Row, 
  Col,
  message, 
  Modal, 
  Steps, 
  Alert,
  Divider,
  Tag,
  Progress,
  Tooltip,
  Checkbox
} from 'antd';
import { 
  ArrowLeftOutlined, 
  UploadOutlined, 
  FileExcelOutlined,
  DatabaseOutlined,
  GoogleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { broadcastGroupApi, hashtagApi } from '../services/contactApi';
import { contactImportApi } from '../services/contactImportApi';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Step } = Steps;

const ContactImportPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  // 步驟狀態
  const [currentStep, setCurrentStep] = useState(0);
  const [importType, setImportType] = useState('excel');
  
  // 文件上傳
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // 數據預覽
  const [previewData, setPreviewData] = useState([]);
  const [previewColumns, setPreviewColumns] = useState([]);
  
  // 字段映射
  const [fieldMapping, setFieldMapping] = useState({});
  const [mappingForm] = Form.useForm();
  
  // 匯入進度
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('idle'); // idle, importing, success, error
  const [importResults, setImportResults] = useState({ success: 0, failed: 0, errors: [] });
  
  // 選項數據
  const [groups, setGroups] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  
  // SQL 連接配置
  const [sqlConfig, setSqlConfig] = useState({
    server: '',
    database: '',
    username: '',
    password: '',
    table: '',
    query: ''
  });

  // 載入選項數據
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [groupsResponse, hashtagsResponse] = await Promise.all([
          broadcastGroupApi.getGroups(),
          hashtagApi.getHashtags()
        ]);
        setGroups(groupsResponse || []);
        setHashtags(hashtagsResponse || []);
      } catch (err) {
        console.error('載入選項數據失敗：', err);
      }
    };
    loadOptions();
  }, []);

  // 文件上傳處理
  const handleUpload = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    
    try {
      // 使用真實的 API 解析文件
      const parsedData = await contactImportApi.parseExcelFile(file);
      setPreviewData(parsedData.data);
      setPreviewColumns(parsedData.columns);
      
      // 自動映射字段
      const autoMapping = generateAutoMapping(parsedData.columns);
      setFieldMapping(autoMapping);
      mappingForm.setFieldsValue(autoMapping);
      
      setCurrentStep(1);
      onSuccess('ok');
    } catch (error) {
      onError(error);
    } finally {
      setUploading(false);
    }
  };

  // 生成模擬數據
  const generateMockData = (fileName) => {
    const mockData = [
      { name: '張三', title: '經理', whatsapp: '+886912345678', email: 'zhang@example.com', company: 'ABC公司', department: '技術部', tags: 'VIP,重要客戶' },
      { name: '李四', title: '專員', whatsapp: '+886987654321', email: 'li@example.com', company: 'XYZ公司', department: '銷售部', tags: '新客戶' },
      { name: '王五', title: '主任', whatsapp: '+886955555555', email: 'wang@example.com', company: 'DEF公司', department: '財務部', tags: '長期客戶' }
    ];
    
    const columns = [
      { title: '姓名', dataIndex: 'name', key: 'name' },
      { title: '職稱', dataIndex: 'title', key: 'title' },
      { title: 'WhatsApp', dataIndex: 'whatsapp', key: 'whatsapp' },
      { title: '電子郵件', dataIndex: 'email', key: 'email' },
      { title: '公司', dataIndex: 'company', key: 'company' },
      { title: '部門', dataIndex: 'department', key: 'department' },
      { title: '標籤', dataIndex: 'tags', key: 'tags' }
    ];
    
    return { data: mockData, columns };
  };

  // 自動字段映射
  const generateAutoMapping = (columns) => {
    const mapping = {};
    columns.forEach(col => {
      const key = col.dataIndex.toLowerCase();
      if (key.includes('name') || key.includes('姓名')) mapping.name = col.dataIndex;
      else if (key.includes('title') || key.includes('職稱')) mapping.title = col.dataIndex;
      else if (key.includes('whatsapp') || key.includes('電話')) mapping.whatsappNumber = col.dataIndex;
      else if (key.includes('email') || key.includes('郵件')) mapping.email = col.dataIndex;
      else if (key.includes('company') || key.includes('公司')) mapping.companyName = col.dataIndex;
      else if (key.includes('department') || key.includes('部門')) mapping.department = col.dataIndex;
      else if (key.includes('tags') || key.includes('標籤')) mapping.hashtags = col.dataIndex;
    });
    return mapping;
  };

  // 開始匯入
  const handleImport = async () => {
    setImportStatus('importing');
    setImportProgress(0);
    
    try {
      // 準備匯入數據
      const importData = previewData.map((row, index) => {
        const mapping = mappingForm.getFieldsValue();
        return {
          rowNumber: index + 1,
          name: row[mapping.name] || '',
          title: row[mapping.title] || '',
          occupation: row[mapping.occupation] || '',
          whatsAppNumber: row[mapping.whatsappNumber] || '',
          email: row[mapping.email] || '',
          companyName: row[mapping.companyName] || '',
          department: row[mapping.department] || '',
          position: row[mapping.position] || '',
          hashtags: row[mapping.hashtags] || '',
          broadcastGroupId: mapping.broadcastGroupId || ''
        };
      });

      // 使用真實的 API 進行批量創建
      const result = await contactImportApi.batchCreateContacts(importData);
      
      setImportResults({
        success: result.successCount,
        failed: result.failedCount,
        errors: result.results
          .filter(r => !r.success)
          .map(r => `第${r.rowNumber}行：${r.errorMessage}`)
      });
      
      setImportStatus('success');
      setCurrentStep(2);
    } catch (error) {
      setImportStatus('error');
      message.error('匯入失敗：' + error.message);
    }
  };

  // 測試 SQL 連接
  const testSqlConnection = async () => {
    try {
      const result = await contactImportApi.testSqlConnection(sqlConfig);
      if (result.success) {
        message.success('SQL 連接測試成功！');
      } else {
        message.error('SQL 連接測試失敗：' + result.message);
      }
    } catch (error) {
      message.error('SQL 連接測試失敗：' + error.message);
    }
  };

  // 從 SQL 載入數據
  const loadFromSql = async () => {
    try {
      const result = await contactImportApi.loadFromSql(sqlConfig);
      if (result.success) {
        setPreviewData(result.data);
        setPreviewColumns(result.columns.map(col => ({ title: col, dataIndex: col, key: col })));
        
        const autoMapping = generateAutoMapping(result.columns.map(col => ({ dataIndex: col })));
        setFieldMapping(autoMapping);
        mappingForm.setFieldsValue(autoMapping);
        
        setCurrentStep(1);
        message.success('數據載入成功！');
      } else {
        message.error('載入數據失敗：' + result.message);
      }
    } catch (error) {
      message.error('載入數據失敗：' + error.message);
    }
  };

  const steps = [
    {
      title: t('contactImport.selectSource'),
      description: t('contactImport.selectSourceDesc')
    },
    {
      title: t('contactImport.mapFields'),
      description: t('contactImport.mapFieldsDesc')
    },
    {
      title: t('contactImport.importData'),
      description: t('contactImport.importDataDesc')
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
              justifyContent: 'center'
            }}
          />
        </Col>
        <Col>
          <Title level={2} style={{ margin: 0, textAlign: 'right' }}>
            {t('contactImport.title')}
          </Title>
        </Col>
      </Row>

      {/* 步驟指示器 */}
      <Card style={{ marginBottom: '24px' }}>
        <Steps current={currentStep}>
          {steps.map((step, index) => (
            <Step key={index} title={step.title} description={step.description} />
          ))}
        </Steps>
      </Card>

      {/* 步驟 1: 選擇數據源 */}
      {currentStep === 0 && (
        <Row gutter={24}>
          <Col span={8}>
            <Card 
              title={
                <Space>
                  <FileExcelOutlined style={{ color: '#52c41a' }} />
                  {t('contactImport.excelFile')}
                </Space>
              }
              hoverable
              style={{ height: '300px' }}
            >
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Upload
                  accept=".xlsx,.xls,.csv"
                  fileList={fileList}
                  onChange={({ fileList }) => setFileList(fileList)}
                  customRequest={handleUpload}
                  showUploadList={false}
                >
                  <Button 
                    type="primary" 
                    icon={<UploadOutlined />} 
                    loading={uploading}
                    size="large"
                  >
                    {t('contactImport.uploadExcel')}
                  </Button>
                </Upload>
                <div style={{ marginTop: '16px', color: '#666' }}>
                  {t('contactImport.supportedFormats')}
                </div>
              </div>
            </Card>
          </Col>
          
          <Col span={8}>
            <Card 
              title={
                <Space>
                  <GoogleOutlined style={{ color: '#4285f4' }} />
                  {t('contactImport.googleSheets')}
                </Space>
              }
              hoverable
              style={{ height: '300px' }}
            >
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Button 
                  type="primary" 
                  icon={<GoogleOutlined />} 
                  size="large"
                  onClick={() => {
                    setImportType('google');
                    message.info('Google Sheets 整合功能開發中...');
                  }}
                >
                  {t('contactImport.connectGoogle')}
                </Button>
                <div style={{ marginTop: '16px', color: '#666' }}>
                  {t('contactImport.googleSheetsDesc')}
                </div>
              </div>
            </Card>
          </Col>
          
          <Col span={8}>
            <Card 
              title={
                <Space>
                  <DatabaseOutlined style={{ color: '#722ed1' }} />
                  {t('contactImport.sqlDatabase')}
                </Space>
              }
              hoverable
              style={{ height: '300px' }}
            >
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Button 
                  type="primary" 
                  icon={<DatabaseOutlined />} 
                  size="large"
                  onClick={() => setImportType('sql')}
                >
                  {t('contactImport.connectSQL')}
                </Button>
                <div style={{ marginTop: '16px', color: '#666' }}>
                  {t('contactImport.sqlDatabaseDesc')}
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* SQL 連接配置 */}
      {importType === 'sql' && currentStep === 0 && (
        <Card style={{ marginTop: '24px' }}>
          <Title level={4}>{t('contactImport.sqlConfig')}</Title>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label={t('contactImport.server')}>
                <Input 
                  value={sqlConfig.server}
                  onChange={(e) => setSqlConfig({...sqlConfig, server: e.target.value})}
                  placeholder="localhost"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label={t('contactImport.database')}>
                <Input 
                  value={sqlConfig.database}
                  onChange={(e) => setSqlConfig({...sqlConfig, database: e.target.value})}
                  placeholder="contacts_db"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label={t('contactImport.username')}>
                <Input 
                  value={sqlConfig.username}
                  onChange={(e) => setSqlConfig({...sqlConfig, username: e.target.value})}
                  placeholder="username"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label={t('contactImport.password')}>
                <Input.Password 
                  value={sqlConfig.password}
                  onChange={(e) => setSqlConfig({...sqlConfig, password: e.target.value})}
                  placeholder="password"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('contactImport.tableName')}>
                <Input 
                  value={sqlConfig.table}
                  onChange={(e) => setSqlConfig({...sqlConfig, table: e.target.value})}
                  placeholder="contacts"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('contactImport.customQuery')}>
                <TextArea 
                  value={sqlConfig.query}
                  onChange={(e) => setSqlConfig({...sqlConfig, query: e.target.value})}
                  placeholder="SELECT * FROM contacts WHERE..."
                  rows={2}
                />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button onClick={testSqlConnection}>
              {t('contactImport.testConnection')}
            </Button>
            <Button type="primary" onClick={loadFromSql}>
              {t('contactImport.loadData')}
            </Button>
          </Space>
        </Card>
      )}

      {/* 步驟 2: 字段映射 */}
      {currentStep === 1 && (
        <Row gutter={24}>
          <Col span={12}>
            <Card title={t('contactImport.dataPreview')}>
              <Table
                columns={previewColumns}
                dataSource={previewData}
                pagination={false}
                size="small"
                scroll={{ y: 300 }}
              />
            </Card>
          </Col>
          
          <Col span={12}>
            <Card title={t('contactImport.fieldMapping')}>
              <Form form={mappingForm} layout="vertical">
                <Form.Item label={t('contactImport.name')} name="name">
                  <Select placeholder={t('contactImport.selectColumn')}>
                    {previewColumns.map(col => (
                      <Option key={col.dataIndex} value={col.dataIndex}>
                        {col.title}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label={t('contactImport.title')} name="title">
                  <Select placeholder={t('contactImport.selectColumn')} allowClear>
                    {previewColumns.map(col => (
                      <Option key={col.dataIndex} value={col.dataIndex}>
                        {col.title}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label={t('contactImport.whatsappNumber')} name="whatsappNumber">
                  <Select placeholder={t('contactImport.selectColumn')} allowClear>
                    {previewColumns.map(col => (
                      <Option key={col.dataIndex} value={col.dataIndex}>
                        {col.title}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label={t('contactImport.email')} name="email">
                  <Select placeholder={t('contactImport.selectColumn')} allowClear>
                    {previewColumns.map(col => (
                      <Option key={col.dataIndex} value={col.dataIndex}>
                        {col.title}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label={t('contactImport.companyName')} name="companyName">
                  <Select placeholder={t('contactImport.selectColumn')} allowClear>
                    {previewColumns.map(col => (
                      <Option key={col.dataIndex} value={col.dataIndex}>
                        {col.title}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label={t('contactImport.department')} name="department">
                  <Select placeholder={t('contactImport.selectColumn')} allowClear>
                    {previewColumns.map(col => (
                      <Option key={col.dataIndex} value={col.dataIndex}>
                        {col.title}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label={t('contactImport.hashtags')} name="hashtags">
                  <Select placeholder={t('contactImport.selectColumn')} allowClear>
                    {previewColumns.map(col => (
                      <Option key={col.dataIndex} value={col.dataIndex}>
                        {col.title}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label={t('contactImport.broadcastGroup')} name="broadcastGroupId">
                  <Select placeholder={t('contactImport.selectGroup')}>
                    {groups.map(group => (
                      <Option key={group.id} value={group.id}>
                        {group.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Form>
            </Card>
          </Col>
        </Row>
      )}

      {/* 步驟 3: 匯入結果 */}
      {currentStep === 2 && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            {importStatus === 'importing' && (
              <>
                <Progress 
                  type="circle" 
                  percent={importProgress} 
                  status="active"
                  style={{ marginBottom: '24px' }}
                />
                <div>{t('contactImport.importing')}</div>
              </>
            )}
            
            {importStatus === 'success' && (
              <>
                <CheckCircleOutlined style={{ fontSize: '64px', color: '#52c41a', marginBottom: '16px' }} />
                <Title level={3} style={{ color: '#52c41a' }}>
                  {t('contactImport.importSuccess')}
                </Title>
                <Space direction="vertical" size="large">
                  <div>
                    <Text strong>{t('contactImport.successCount', { count: importResults.success })}</Text>
                    <br />
                    <Text type="secondary">{t('contactImport.failedCount', { count: importResults.failed })}</Text>
                  </div>
                  
                  {importResults.errors.length > 0 && (
                    <Alert
                      message={t('contactImport.errors')}
                      description={
                        <ul style={{ textAlign: 'left', margin: 0 }}>
                          {importResults.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      }
                      type="warning"
                      showIcon
                    />
                  )}
                  
                  <Space>
                    <Button onClick={() => navigate('/contacts')}>
                      {t('contactImport.backToList')}
                    </Button>
                    <Button type="primary" onClick={() => {
                      setCurrentStep(0);
                      setImportStatus('idle');
                      setImportProgress(0);
                      setFileList([]);
                      setPreviewData([]);
                    }}>
                      {t('contactImport.importMore')}
                    </Button>
                  </Space>
                </Space>
              </>
            )}
          </div>
        </Card>
      )}

      {/* 操作按鈕 */}
      {currentStep === 1 && (
        <div style={{ textAlign: 'right', marginTop: '24px' }}>
          <Space>
            <Button onClick={() => setCurrentStep(0)}>
              {t('contactImport.previous')}
            </Button>
            <Button 
              type="primary" 
              onClick={handleImport}
              loading={importStatus === 'importing'}
            >
              {t('contactImport.startImport')}
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
};

export default ContactImportPage;
