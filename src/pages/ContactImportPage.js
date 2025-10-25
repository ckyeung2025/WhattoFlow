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

  // WhatsApp 號碼標準化函數
  const normalizeWhatsAppNumber = (number) => {
    if (!number) return '';
    // 移除所有非數字字符（包括 +、空格、連字符等）
    return number.toString().replace(/\D/g, '');
  };
  
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
  const [duplicateContacts, setDuplicateContacts] = useState([]);
  const [showDuplicateConfirmation, setShowDuplicateConfirmation] = useState(false);
  
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

  // Excel 配置
  const [excelConfig, setExcelConfig] = useState({
    filePath: '',
    sheetName: '',
    availableSheets: []
  });

  // Google Docs 配置
  const [googleConfig, setGoogleConfig] = useState({
    url: '',
    sheetName: '',
    spreadsheetId: '',
    availableSheets: [],
    fileType: '' // 新增：文件類型（excel 或 googlesheets）
  });

  // 載入選項數據
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [groupsResponse, hashtagsResponse] = await Promise.all([
          broadcastGroupApi.getGroups(),
          hashtagApi.getHashtags()
        ]);
        
        // 確保 groups 是數組
        const groupsData = Array.isArray(groupsResponse) ? groupsResponse : 
                          (groupsResponse?.data && Array.isArray(groupsResponse.data)) ? groupsResponse.data : [];
        
        // 確保 hashtags 是數組  
        const hashtagsData = Array.isArray(hashtagsResponse) ? hashtagsResponse :
                            (hashtagsResponse?.data && Array.isArray(hashtagsResponse.data)) ? hashtagsResponse.data : [];
        
        console.log('Groups data:', groupsData);
        console.log('Hashtags data:', hashtagsData);
        
        setGroups(groupsData);
        setHashtags(hashtagsData);
      } catch (err) {
        console.error('載入選項數據失敗：', err);
        // 設置默認空數組以防止錯誤
        setGroups([]);
        setHashtags([]);
      }
    };
    loadOptions();
  }, []);

  // 文件上傳處理
  const handleUpload = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    
    try {
      // 上傳文件並獲取工作表列表
      const uploadResult = await contactImportApi.uploadExcelFile(file);
      
      // 設置文件路徑和可用的工作表列表
      setExcelConfig({
        ...excelConfig,
        filePath: uploadResult.filePath,
        availableSheets: uploadResult.sheets || []
      });
      
      message.success('文件上傳成功！請選擇工作表名稱。');
      onSuccess('ok');
    } catch (error) {
      console.error('文件上傳失敗:', error);
      message.error('文件上傳失敗，請重試。');
      onError(error);
    } finally {
      setUploading(false);
    }
  };

  // 從 Excel 載入數據
  const loadFromExcel = async () => {
    try {
      const result = await contactImportApi.loadFromExcel(excelConfig);
      if (result.success) {
        setPreviewData(result.data);
        setPreviewColumns(result.columns.map(col => ({ title: col, dataIndex: col, key: col })));
        
        const autoMapping = generateAutoMapping(result.columns.map(col => ({ dataIndex: col })));
        setFieldMapping(autoMapping);
        mappingForm.setFieldsValue(autoMapping);
        
        setCurrentStep(1);
        message.success('Excel 數據載入成功！');
      } else {
        message.error('載入 Excel 數據失敗：' + result.message);
      }
    } catch (error) {
      message.error('載入 Excel 數據失敗：' + error.message);
    }
  };

  // 處理 Google Sheets URL 上傳
  const handleGoogleSheetsUpload = async () => {
    if (!googleConfig.url) {
      message.error('請先輸入 Google Sheets URL');
      return;
    }

    try {
      const result = await contactImportApi.uploadGoogleSheetsUrl(googleConfig.url);
      if (result.success) {
        setGoogleConfig({
          ...googleConfig,
          spreadsheetId: result.spreadsheetId,
          availableSheets: result.availableSheets || [],
          fileType: result.fileType || '',
          // 如果是 Excel 文件，自動設置默認工作表名稱
          sheetName: result.fileType === 'excel' ? 'Sheet1' : googleConfig.sheetName
        });
        
        if (result.fileType === 'excel') {
          message.success('檢測到 Excel 文件，將使用默認工作表');
        } else {
          message.success(result.message || 'Google Sheets URL 驗證成功！');
        }
      } else {
        message.error('Google Sheets URL 驗證失敗：' + result.message);
      }
    } catch (error) {
      message.error('Google Sheets URL 驗證失敗：' + error.message);
    }
  };

  // 從 Google Docs 載入數據
  const loadFromGoogleDocs = async () => {
    try {
      const result = await contactImportApi.loadFromGoogleDocs(googleConfig);
      if (result.success) {
        setPreviewData(result.data);
        setPreviewColumns(result.columns.map(col => ({ title: col, dataIndex: col, key: col })));
        
        const autoMapping = generateAutoMapping(result.columns.map(col => ({ dataIndex: col })));
        setFieldMapping(autoMapping);
        mappingForm.setFieldsValue(autoMapping);
        
        setCurrentStep(1);
        message.success('Google Docs 數據載入成功！');
      } else {
        message.error('載入 Google Docs 數據失敗：' + result.message);
      }
    } catch (error) {
      message.error('載入 Google Docs 數據失敗：' + error.message);
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
      else if (key.includes('occupation') || key.includes('職業')) mapping.occupation = col.dataIndex;
      else if (key.includes('position') || key.includes('職位')) mapping.position = col.dataIndex;
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

      // 檢查重複的 WhatsApp 號碼
      const duplicateCheckResult = await contactImportApi.checkDuplicateWhatsApp(importData);
      
      if (duplicateCheckResult.hasDuplicates) {
        // 顯示重複確認頁面
        setDuplicateContacts(duplicateCheckResult.duplicates);
        setShowDuplicateConfirmation(true);
        setImportStatus('idle');
        return;
      }

      // 沒有重複，直接進行批量創建
      await performBatchImport(importData, false);
      
    } catch (error) {
      setImportStatus('error');
      message.error('匯入失敗：' + error.message);
    }
  };

  const performBatchImport = async (importData, allowUpdate = false) => {
    try {
      setImportStatus('importing');
      
      // 使用真實的 API 進行批量創建/更新
      const result = await contactImportApi.batchCreateContacts(importData, allowUpdate);
      
      console.log('🔍 批量創建結果:', result);
      
      const importResultsData = {
        success: result.successCount || 0,
        failed: result.failedCount || 0,
        errors: (result.results || [])
          .filter(r => !r.success)
          .map(r => `第${r.rowNumber}行：${r.errorMessage}`)
      };
      
      console.log('🔍 設置的 importResults:', importResultsData);
      setImportResults(importResultsData);
      
      setImportStatus('success');
      setCurrentStep(2);
    } catch (error) {
      setImportStatus('error');
      message.error('匯入失敗：' + error.message);
    }
  };

  const handleDuplicateConfirm = async (action) => {
    setShowDuplicateConfirmation(false);
    
    if (action === 'update') {
      // 用戶確認更新，重新準備數據
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
      
      await performBatchImport(importData, true);
    } else {
      // 用戶取消，返回映射頁面
      setImportStatus('idle');
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
      console.log('發送的 SQL 配置:', sqlConfig);
      const result = await contactImportApi.loadFromSql(sqlConfig);
      if (result.success) {
        console.log('SQL 查詢結果:', result);
        console.log('SQL 列名:', result.columns);
        console.log('SQL 數據樣本:', result.data.slice(0, 2));
        
        setPreviewData(result.data);
        setPreviewColumns(result.columns.map(col => ({ title: col, dataIndex: col, key: col })));
        
        console.log('設置的 previewColumns:', result.columns.map(col => ({ title: col, dataIndex: col, key: col })));
        
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
      {/* 重複確認 Modal */}
      <Modal
        title={t('contactImport.duplicateConfirmation')}
        open={showDuplicateConfirmation}
        onCancel={() => handleDuplicateConfirm('cancel')}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => handleDuplicateConfirm('cancel')}>
            {t('common.cancel')}
          </Button>,
          <Button key="update" type="primary" onClick={() => handleDuplicateConfirm('update')}>
            {t('contactImport.confirmUpdate')}
          </Button>
        ]}
      >
        <Alert
          message={t('contactImport.duplicateWarning')}
          description={t('contactImport.duplicateDescription')}
          type="warning"
          showIcon
          style={{ marginBottom: '16px' }}
        />
        
        <Table
          dataSource={duplicateContacts}
          pagination={false}
          scroll={{ y: 300 }}
          size="small"
          rowKey={(record) => record.rowNumber}
          columns={[
            {
              title: t('contactImport.rowNumber'),
              dataIndex: 'rowNumber',
              width: 80
            },
            {
              title: t('contactImport.newData'),
              children: [
                {
                  title: t('contactImport.name'),
                  dataIndex: ['newData', 'name'],
                  width: 120
                },
                {
                  title: t('contactImport.whatsappNumber'),
                  dataIndex: ['newData', 'whatsAppNumber'],
                  width: 140
                }
              ]
            },
            {
              title: t('contactImport.existingData'),
              children: [
                {
                  title: t('contactImport.name'),
                  dataIndex: ['existingData', 'name'],
                  width: 120
                },
                {
                  title: t('contactImport.whatsappNumber'),
                  dataIndex: ['existingData', 'whatsAppNumber'],
                  width: 140
                }
              ]
            }
          ]}
        />
      </Modal>

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
        <div>
          {/* 數據源類型選擇 */}
          <Card style={{ marginBottom: '24px' }}>
            <Title level={4}>{t('contactImport.selectDataSource')}</Title>
            <Row gutter={16}>
          <Col span={8}>
            <Card 
                  hoverable
                  style={{ 
                    border: importType === 'excel' ? '2px solid #52c41a' : '1px solid #d9d9d9',
                    cursor: 'pointer'
                  }}
                  onClick={() => setImportType('excel')}
                >
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <FileExcelOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      {t('contactImport.excelFile')}
                    </div>
                    <div style={{ color: '#666', marginTop: '8px' }}>
                      {t('contactImport.excelFileDesc')}
                    </div>
                  </div>
                </Card>
              </Col>
              
              <Col span={8}>
                <Card 
                  hoverable
                  style={{ 
                    border: importType === 'google' ? '2px solid #4285f4' : '1px solid #d9d9d9',
                    cursor: 'pointer'
                  }}
                  onClick={() => setImportType('google')}
                >
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <GoogleOutlined style={{ fontSize: '48px', color: '#4285f4', marginBottom: '16px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      {t('contactImport.googleSheets')}
                    </div>
                    <div style={{ color: '#666', marginTop: '8px' }}>
                      {t('contactImport.googleSheetsDesc')}
                    </div>
                  </div>
                </Card>
              </Col>
              
              <Col span={8}>
                <Card 
                  hoverable
                  style={{ 
                    border: importType === 'sql' ? '2px solid #722ed1' : '1px solid #d9d9d9',
                    cursor: 'pointer'
                  }}
                  onClick={() => setImportType('sql')}
                >
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <DatabaseOutlined style={{ fontSize: '48px', color: '#722ed1', marginBottom: '16px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      {t('contactImport.sqlDatabase')}
                    </div>
                    <div style={{ color: '#666', marginTop: '8px' }}>
                      {t('contactImport.sqlDatabaseDesc')}
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>

          {/* Excel 配置面板 */}
          {importType === 'excel' && (
            <Card>
              <Title level={4}>
                <Space>
                  <FileExcelOutlined style={{ color: '#52c41a' }} />
                  {t('contactImport.excelConfig')}
                </Space>
              </Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item 
                    label={
                      <Space>
                        {t('contactImport.dataSourceType')}
                        <span style={{ color: 'red' }}>*</span>
                </Space>
              }
                  >
                    <Select value="EXCEL File" disabled>
                      <Option value="EXCEL File">EXCEL File</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={t('contactImport.excelFilePath')}>
                    <Input 
                      value={excelConfig.filePath}
                      onChange={(e) => setExcelConfig({...excelConfig, filePath: e.target.value})}
                      placeholder="/Uploads/excel/example.xlsx"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={t('contactImport.sheetName')}>
                    <Select 
                      value={excelConfig.sheetName}
                      onChange={(value) => setExcelConfig({...excelConfig, sheetName: value})}
                      placeholder={t('contactImport.selectSheet')}
                      disabled={!excelConfig.filePath || excelConfig.availableSheets.length === 0}
                    >
                      {excelConfig.availableSheets.map(sheet => (
                        <Option key={sheet} value={sheet}>{sheet}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <div style={{ paddingTop: '30px' }}>
                    {/* 空白區域 */}
                  </div>
                </Col>
              </Row>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {excelConfig.filePath ? (
                    <div style={{ color: '#52c41a', display: 'flex', alignItems: 'center' }}>
                      <CheckCircleOutlined style={{ marginRight: '8px' }} />
                      文件已上傳
                    </div>
                  ) : (
                    <div style={{ color: '#666', display: 'flex', alignItems: 'center' }}>
                      <FileExcelOutlined style={{ marginRight: '8px' }} />
                      請先上傳 Excel 文件
                    </div>
                  )}
                <Upload
                  accept=".xlsx,.xls,.csv"
                  fileList={fileList}
                  onChange={({ fileList }) => setFileList(fileList)}
                  customRequest={handleUpload}
                  showUploadList={false}
                >
                  <Button 
                      type="default" 
                    icon={<UploadOutlined />} 
                    loading={uploading}
                  >
                      {t('contactImport.uploadExcelFile')}
                  </Button>
                </Upload>
                </div>
                <Button 
                  type="primary" 
                  onClick={loadFromExcel} 
                  disabled={!excelConfig.filePath || !excelConfig.sheetName}
                >
                  {t('contactImport.nextStep')}
                </Button>
              </div>
            </Card>
          )}

          {/* Google Docs 配置面板 */}
          {importType === 'google' && (
            <Card>
              <Title level={4}>
                <Space>
                  <GoogleOutlined style={{ color: '#4285f4' }} />
                  {t('contactImport.googleDocsConfig')}
                </Space>
              </Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item 
                    label={
                      <Space>
                        {t('contactImport.dataSourceType')}
                        <span style={{ color: 'red' }}>*</span>
                </Space>
              }
                  >
                    <Select value="GOOGLE_DOCS" disabled>
                      <Option value="GOOGLE_DOCS">GOOGLE_DOCS</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item 
                    label={
                      <Space>
                        {t('contactImport.googleDocsUrl')}
                        <span style={{ color: 'red' }}>*</span>
                      </Space>
                    }
                  >
                    <Input 
                      value={googleConfig.url}
                      onChange={(e) => setGoogleConfig({...googleConfig, url: e.target.value})}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                    />
                  </Form.Item>
                </Col>
              </Row>
              {/* 只有在 Google Sheets 原生文件時才顯示工作表選擇 */}
              {googleConfig.fileType === 'googlesheets' && (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label={t('contactImport.sheetName')}>
                      <Select 
                        value={googleConfig.sheetName}
                        onChange={(value) => setGoogleConfig({...googleConfig, sheetName: value})}
                        placeholder={googleConfig.availableSheets.length > 0 ? t('contactImport.selectSheet') : "請先連接 Google Sheets"}
                        disabled={!googleConfig.spreadsheetId}
                        showSearch
                        allowClear
                        notFoundContent={googleConfig.availableSheets.length === 0 ? "請先連接 Google Sheets 獲取工作表列表" : "沒有找到匹配的工作表"}
                      >
                        {googleConfig.availableSheets.map(sheet => (
                          <Option key={sheet} value={sheet}>{sheet}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <div style={{ paddingTop: '30px' }}>
                      {/* 空白區域 */}
                    </div>
                  </Col>
                </Row>
              )}
              
              {/* Excel 文件顯示提示信息 */}
              {googleConfig.fileType === 'excel' && (
                <Row gutter={16}>
                  <Col span={24}>
                    <Alert 
                      message="檢測到 Excel 文件" 
                      description="系統將自動使用默認工作表進行數據導入，無需選擇工作表名稱。" 
                      type="info" 
                      showIcon 
                      style={{ marginBottom: '16px' }}
                    />
                  </Col>
                </Row>
              )}
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {googleConfig.spreadsheetId ? (
                    <div style={{ color: '#52c41a', display: 'flex', alignItems: 'center' }}>
                      <CheckCircleOutlined style={{ marginRight: '8px' }} />
                      URL 已驗證
                    </div>
                  ) : (
                    <div style={{ color: '#666', display: 'flex', alignItems: 'center' }}>
                      <GoogleOutlined style={{ marginRight: '8px' }} />
                      請輸入 Google Sheets URL
                    </div>
                  )}
                <Button 
                    type="default" 
                  icon={<GoogleOutlined />} 
                    onClick={handleGoogleSheetsUpload}
                    disabled={!googleConfig.url}
                >
                  {t('contactImport.connectGoogle')}
                </Button>
                </div>
                <Button 
                  type="primary" 
                  onClick={loadFromGoogleDocs}
                  disabled={!googleConfig.spreadsheetId || (googleConfig.fileType === 'googlesheets' && !googleConfig.sheetName)}
                >
                  {t('contactImport.nextStep')}
                </Button>
              </div>
            </Card>
          )}

          {/* SQL 配置面板 */}
          {importType === 'sql' && (
            <Card>
              <Title level={4}>
                <Space>
                  <DatabaseOutlined style={{ color: '#722ed1' }} />
                  {t('contactImport.sqlConfig')}
                </Space>
              </Title>
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
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Space>
            <Button onClick={testSqlConnection}>
              {t('contactImport.testConnection')}
            </Button>
            <Button type="primary" onClick={loadFromSql}>
                    {t('contactImport.nextStep')}
            </Button>
          </Space>
              </div>
        </Card>
          )}
        </div>
      )}

      {/* 步驟 2: 字段映射 */}
      {currentStep === 1 && (
        <Row gutter={24}>
          <Col span={12}>
            <Card title={t('contactImport.dataPreview')}>
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
                      {col.title}
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
                scroll={{ x: 'max-content', y: 400 }}
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
            </Card>
          </Col>
          
          <Col span={12}>
            <Card 
              title={t('contactImport.fieldMapping')} 
              style={{ height: '500px' }}
              bodyStyle={{ height: '450px', padding: '16px' }}
            >
              <div style={{ height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
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
                
                <Form.Item label={t('contactImport.occupation')} name="occupation">
                  <Select placeholder={t('contactImport.selectColumn')} allowClear>
                    {previewColumns.map(col => (
                      <Option key={col.dataIndex} value={col.dataIndex}>
                        {col.title}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label={t('contactImport.position')} name="position">
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
                    {Array.isArray(groups) && groups.map(group => (
                      <Option key={group.id} value={group.id}>
                        {group.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Form>
              </div>
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
                    {importResults.failed > 0 && (
                      <>
                    <br />
                    <Text type="secondary">{t('contactImport.failedCount', { count: importResults.failed })}</Text>
                      </>
                    )}
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
