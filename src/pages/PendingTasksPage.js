import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Input, 
  Row, 
  Col, 
  Statistic, 
  Badge,
  Tooltip,
  Modal,
  message,
  Spin,
  Empty,
  Typography,
  Descriptions,
  Alert,
  Select,
  Divider,
  Tabs
} from 'antd';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  RobotOutlined,
  DatabaseOutlined,
  FormOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileZipOutlined,
  FileOutlined,
  DownloadOutlined,
  CloseOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { Search } = Input;
const { Option } = Select;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

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

const PendingTasksPage = () => {
  console.log('🔄 PendingTasksPage component loaded');
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pendingEforms, setPendingEforms] = useState([]);
  const [approvedEforms, setApprovedEforms] = useState([]);
  const [rejectedEforms, setRejectedEforms] = useState([]);
  const [manualPendingEforms, setManualPendingEforms] = useState([]);
  const [manualRespondedEforms, setManualRespondedEforms] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [viewMode, setViewMode] = useState('normal'); // 'normal' or 'manual'
  const [selectedEform, setSelectedEform] = useState(null);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [processingEform, setProcessingEform] = useState(null);
  const [embeddedFormVisible, setEmbeddedFormVisible] = useState(false);
  const [embeddedFormInstance, setEmbeddedFormInstance] = useState(null);
  const [loadingEmbeddedForm, setLoadingEmbeddedForm] = useState(false);
  const [relatedAttachments, setRelatedAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxFile, setLightboxFile] = useState(null);
  const [lightboxFiles, setLightboxFiles] = useState([]);
  const [lightboxCurrentIndex, setLightboxCurrentIndex] = useState(0);
  
  // 批量處理相關狀態
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [batchProcessingModalVisible, setBatchProcessingModalVisible] = useState(false);
  const [batchAction, setBatchAction] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [processingBatch, setProcessingBatch] = useState(false);

  // 調試：監控 embeddedFormInstance 的變化
  useEffect(() => {
    if (embeddedFormInstance) {
      console.log('embeddedFormInstance 已更新:', embeddedFormInstance);
      console.log('userMessage 在狀態中:', embeddedFormInstance.userMessage);
      console.log('approvalNote 在狀態中:', embeddedFormInstance.approvalNote);
    }
  }, [embeddedFormInstance]);
  const [statusChangeModalVisible, setStatusChangeModalVisible] = useState(false);
  const [statusChangeTarget, setStatusChangeTarget] = useState(null);
  const [statusChangeNote, setStatusChangeNote] = useState('');
  const [statistics, setStatistics] = useState({
    total: 0,
    pending: 0,
    overdue: 0,
    urgent: 0
  });
  
  // 各狀態的總計數
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    manualPending: 0,
    manualResponded: 0
  });
  const [fillTypeStatistics, setFillTypeStatistics] = useState({
    aiFillCount: 0,
    dataFillCount: 0,
    manualFillCount: 0
  });
  const [filters, setFilters] = useState({
    searchText: '',
    priority: 'all',
    dateRange: null
  });

  useEffect(() => {
    loadAllTabData();
    loadStatistics();
    loadFillTypeStatistics();
  }, []);

  useEffect(() => {
    loadAllEforms();
  }, [filters]);

  useEffect(() => {
    loadAllEforms();
  }, [activeTab]);

  useEffect(() => {
    // 當視圖模式改變時，重置到第一個 tab 並載入數據
    if (viewMode === 'manual') {
      setActiveTab('pending');
    } else {
      setActiveTab('pending');
    }
    // 切換視圖模式時清除批量選擇
    setSelectedRowKeys([]);
    setSelectedRows([]);
    loadAllEforms();
  }, [viewMode]);

  // 動態計算表格高度
  const getTableScrollHeight = () => {
    // 基礎高度減去固定元素的高度
    let baseHeight = 480;
    
    // 如果有批量操作卡片，額外減去卡片高度
    if (selectedRowKeys.length > 0) {
      baseHeight += 60; // 批量操作卡片大約 60px 高度
    }
    
    return `calc(100vh - ${baseHeight}px)`;
  };

  // 加載所有 tab 的數據（用於初始化時顯示正確的計數）
  const loadAllTabData = async () => {
    try {
      // 並行加載所有 tab 的數據，不設置 loading 狀態
      await Promise.all([
        loadPendingEforms(false),
        loadApprovedEforms(false),
        loadRejectedEforms(false),
        loadManualPendingEforms(false),
        loadManualRespondedEforms(false)
      ]);
    } catch (error) {
      console.error('Failed to load all tab data:', error);
    }
  };

  const loadAllEforms = async () => {
    if (viewMode === 'manual') {
      switch (activeTab) {
        case 'pending':
          await loadManualPendingEforms();
          break;
        case 'responded':
          await loadManualRespondedEforms();
          break;
        default:
          await loadManualPendingEforms();
      }
    } else {
      switch (activeTab) {
        case 'pending':
          await loadPendingEforms();
          break;
        case 'approved':
          await loadApprovedEforms();
          break;
        case 'rejected':
          await loadRejectedEforms();
          break;
        default:
          await loadPendingEforms();
      }
    }
  };

  const loadPendingEforms = async (setLoadingState = true) => {
    if (setLoadingState) setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50'
      });

      if (filters.searchText) {
        params.append('search', filters.searchText);
      }

      if (filters.priority !== 'all') {
        params.append('priority', filters.priority);
      }

      console.log('Loading pending tasks, query parameters:', params.toString());

      const response = await fetch(`/api/eforminstances/pending?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load pending tasks: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded pending tasks:', data);
      
      // Convert data format to match frontend expected structure
      const formattedData = data.data?.map(item => ({
        id: item.id,
        formName: item.formName,
        instanceName: item.instanceName,
        status: item.status,
        fillType: item.fillType,
        priority: item.priority || 'Medium',
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        dueDate: item.dueDate,
        workflowInstanceId: item.workflowInstanceId,
        userMessage: item.userMessage,
        accessToken: item.accessToken,
        formData: {} // Actual form data needs to be obtained through separate API
      })) || [];
      
      // Filter out Manual Fill records - these don't need manual processing
      const filteredData = formattedData.filter(item => item.fillType !== 'Manual');
      
      setPendingEforms(filteredData);
      setStatistics(prev => ({ 
        ...prev, 
        total: data.total || 0,
        pending: filteredData.length
      }));
      
      // 更新計數
      setCounts(prev => ({
        ...prev,
        pending: data.total || 0
      }));
      
    } catch (error) {
      console.error('Failed to load pending tasks:', error);
      message.error(t('pendingTasks.loadPendingTasksFailed') + ': ' + error.message);
      
      // If API fails, use empty array
      setPendingEforms([]);
      setStatistics(prev => ({ 
        ...prev, 
        total: 0,
        pending: 0
      }));
    } finally {
      if (setLoadingState) setLoading(false);
    }
  };

  const loadApprovedEforms = async (setLoadingState = true) => {
    if (setLoadingState) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50'
      });

      if (filters.searchText) {
        params.append('search', filters.searchText);
      }

      console.log('Loading approved forms, query parameters:', params.toString());

      const response = await fetch(`/api/eforminstances/approved?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load approved forms: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded approved forms:', data);
      
      const formattedData = data.data?.map(item => ({
        id: item.id,
        formName: item.formName,
        instanceName: item.instanceName,
        status: item.status,
        fillType: item.fillType,
        priority: item.priority || 'Medium',
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        dueDate: item.dueDate,
        workflowInstanceId: item.workflowInstanceId,
        userMessage: item.userMessage,
        accessToken: item.accessToken, // 添加 accessToken 字段
        formData: {}
      })) || [];
      
      setApprovedEforms(formattedData);
      
      // 更新計數
      setCounts(prev => ({
        ...prev,
        approved: data.total || 0
      }));
      
    } catch (error) {
      console.error('Failed to load approved forms:', error);
      message.error('載入已批准表單失敗: ' + error.message);
      setApprovedEforms([]);
    } finally {
      if (setLoadingState) setLoading(false);
    }
  };

  const loadRejectedEforms = async (setLoadingState = true) => {
    if (setLoadingState) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50'
      });

      if (filters.searchText) {
        params.append('search', filters.searchText);
      }

      console.log('Loading rejected forms, query parameters:', params.toString());

      const response = await fetch(`/api/eforminstances/rejected?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load rejected forms: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded rejected forms:', data);
      
      const formattedData = data.data?.map(item => ({
        id: item.id,
        formName: item.formName,
        instanceName: item.instanceName,
        status: item.status,
        fillType: item.fillType,
        priority: item.priority || 'Medium',
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        dueDate: item.dueDate,
        workflowInstanceId: item.workflowInstanceId,
        userMessage: item.userMessage,
        accessToken: item.accessToken, // 添加 accessToken 字段
        formData: {}
      })) || [];
      
      setRejectedEforms(formattedData);
      
      // 更新計數
      setCounts(prev => ({
        ...prev,
        rejected: data.total || 0
      }));
      
    } catch (error) {
      console.error('Failed to load rejected forms:', error);
      message.error('載入已拒絕表單失敗: ' + error.message);
      setRejectedEforms([]);
    } finally {
      if (setLoadingState) setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      console.log('Loading statistics');
      
      const response = await fetch('/api/eforminstances/statistics/pending', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load statistics: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded statistics:', data);
      
      setStatistics(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
      
      // If API fails, use default values
      setStatistics({
        total: 0,
        pending: 0,
        overdue: 0,
        urgent: 0
      });
    }
  };

  const loadFillTypeStatistics = async () => {
    try {
      console.log('Loading Fill Type statistics');
      
      const response = await fetch('/api/eforminstances/statistics/fillType', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load Fill Type statistics: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded Fill Type statistics:', data);
      
      setFillTypeStatistics(data);
    } catch (error) {
      console.error('Failed to load Fill Type statistics:', error);
      
      // If API fails, use default values
      setFillTypeStatistics({
        aiFillCount: 0,
        dataFillCount: 0,
        manualFillCount: 0
      });
    }
  };

  const loadManualPendingEforms = async (setLoadingState = true) => {
    if (setLoadingState) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50'
      });

      if (filters.searchText) {
        params.append('search', filters.searchText);
      }

      console.log('Loading manual pending forms, query parameters:', params.toString());

      const response = await fetch(`/api/eforminstances/manual/pending?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load manual pending forms: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded manual pending forms:', data);
      
      const formattedData = data.data?.map(item => ({
        id: item.id,
        formName: item.formName,
        instanceName: item.instanceName,
        status: item.status,
        fillType: item.fillType,
        priority: item.priority || 'Medium',
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        dueDate: item.dueDate,
        workflowInstanceId: item.workflowInstanceId,
        userMessage: item.userMessage,
        recipientWhatsAppNo: item.recipientWhatsAppNo,
        recipientName: item.recipientName,
        accessToken: item.accessToken,
        formData: {}
      })) || [];
      
      setManualPendingEforms(formattedData);
      
      // 更新計數
      setCounts(prev => ({
        ...prev,
        manualPending: data.total || 0
      }));
      
    } catch (error) {
      console.error('Failed to load manual pending forms:', error);
      message.error('載入手動填寫待回應表單失敗: ' + error.message);
      setManualPendingEforms([]);
    } finally {
      if (setLoadingState) setLoading(false);
    }
  };

  const loadManualRespondedEforms = async (setLoadingState = true) => {
    if (setLoadingState) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50'
      });

      if (filters.searchText) {
        params.append('search', filters.searchText);
      }

      console.log('Loading manual responded forms, query parameters:', params.toString());

      const response = await fetch(`/api/eforminstances/manual/responded?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load manual responded forms: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded manual responded forms:', data);
      
      const formattedData = data.data?.map(item => ({
        id: item.id,
        formName: item.formName,
        instanceName: item.instanceName,
        status: item.status,
        fillType: item.fillType,
        priority: item.priority || 'Medium',
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        dueDate: item.dueDate,
        workflowInstanceId: item.workflowInstanceId,
        userMessage: item.userMessage,
        recipientWhatsAppNo: item.recipientWhatsAppNo,
        recipientName: item.recipientName,
        accessToken: item.accessToken,
        approvalBy: item.approvalBy,
        approvalAt: item.approvalAt,
        rejectedBy: item.rejectedBy,
        rejectedAt: item.rejectedAt,
        formData: {}
      })) || [];
      
      setManualRespondedEforms(formattedData);
      
      // 更新計數
      setCounts(prev => ({
        ...prev,
        manualResponded: data.total || 0
      }));
      
    } catch (error) {
      console.error('Failed to load manual responded forms:', error);
      message.error('載入手動填寫已收到回應表單失敗: ' + error.message);
      setManualRespondedEforms([]);
    } finally {
      if (setLoadingState) setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, searchText: value }));
  };

  const handlePriorityFilter = (value) => {
    setFilters(prev => ({ ...prev, priority: value }));
  };

  const getCurrentEforms = () => {
    if (viewMode === 'manual') {
      switch (activeTab) {
        case 'pending':
          return manualPendingEforms;
        case 'responded':
          return manualRespondedEforms;
        default:
          return manualPendingEforms;
      }
    } else {
      switch (activeTab) {
        case 'pending':
          return pendingEforms;
        case 'approved':
          return approvedEforms;
        case 'rejected':
          return rejectedEforms;
        default:
          return pendingEforms;
      }
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    // 切換標籤頁時清除批量選擇
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  const handleViewEform = async (eform) => {
    console.log('View form:', eform);
    console.log('eform.workflowInstanceId:', eform.workflowInstanceId);
    setSelectedEform(eform);
    setEmbeddedFormVisible(true);
    await loadEmbeddedFormInstance(eform.id, eform);
  };

  const handleCloseEmbeddedForm = () => {
    console.log('Closing embedded form');
    setEmbeddedFormVisible(false);
    setEmbeddedFormInstance(null);
    setSelectedEform(null);
    setRelatedAttachments([]);
  };

  const renderModalTitle = () => {
    const isActionableForm = embeddedFormInstance && 
                             (embeddedFormInstance.fillType === 'AI' || embeddedFormInstance.fillType === 'Data') &&
                             embeddedFormInstance.status === 'Pending';
    
    const isManualFillForm = embeddedFormInstance && 
                             embeddedFormInstance.fillType === 'Manual';

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span style={{ fontSize: '16px', fontWeight: '600' }}>
          {`Form Instance: ${selectedEform?.formName || ''}`}
        </span>
        <div style={{ display: 'flex', gap: '8px', marginRight: '16px' }}>
          {isActionableForm && (
            <>
              <Button 
                key="approve-header"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  handleCloseEmbeddedForm();
                  handleApprove(selectedEform);
                }}
                style={{ 
                  backgroundColor: '#52c41a',
                  borderColor: '#52c41a',
                  minWidth: '80px',
                  height: '24px'
                }}
                size="small"
              >
                {t('pendingTasks.approve')}
              </Button>
              <Button 
                key="reject-header"
                type="primary"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  handleCloseEmbeddedForm();
                  handleReject(selectedEform);
                }}
                style={{ minWidth: '80px', height: '24px' }}
                size="small"
              >
                {t('pendingTasks.reject')}
              </Button>
            </>
          )}
          {isManualFillForm && (
            <Button 
              key="submitForm-header"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleSubmitForm}
              style={{ 
                backgroundColor: embeddedFormInstance.status === 'Submitted' ? '#52c41a' : '#1890ff',
                borderColor: embeddedFormInstance.status === 'Submitted' ? '#52c41a' : '#1890ff',
                minWidth: '100px',
                height: '24px'
              }}
              size="small"
            >
              {embeddedFormInstance.status === 'Submitted' ? t('pendingTasks.resubmitForm') : t('pendingTasks.submitForm')}
            </Button>
          )}
          <Button 
            key="newTab-header"
            type="default"
            onClick={() => window.open(`/eform-instance/${selectedEform?.id}`, '_blank')}
            style={{ minWidth: '80px', height: '24px' }}
            size="small"
          >
            {t('pendingTasks.openInNewTab')}
          </Button>
        </div>
      </div>
    );
  };

  const loadEmbeddedFormInstance = async (instanceId, eform = null) => {
    setLoadingEmbeddedForm(true);
    try {
      console.log('Loading embedded form instance:', instanceId);
      console.log('selectedEform:', selectedEform);
      console.log('passed eform:', eform);
      
      // 使用傳入的 eform 參數或 selectedEform 狀態
      const currentEform = eform || selectedEform;
      
      // 檢查是否為 Manual Fill 表單，如果是，需要從 eform 中獲取 accessToken
      const isManualFill = currentEform?.fillType === 'Manual';
      const accessToken = currentEform?.accessToken;
      
      console.log('isManualFill:', isManualFill);
      console.log('accessToken from eform:', accessToken);
      console.log('currentEform in loadEmbeddedFormInstance:', currentEform);
      console.log('currentEform.workflowInstanceId:', currentEform?.workflowInstanceId);
      
      // 對於已登入的內部用戶，直接使用標準 API 端點，不需要 accessToken
      let url = `/api/eforminstances/${instanceId}`;
      console.log('Using internal API endpoint for logged-in user:', url);
      
      console.log('Loading embedded form with URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load form instance: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded embedded form instance:', data);
      console.log('API response keys:', Object.keys(data));
      console.log('htmlCode length:', data.htmlCode?.length);
      console.log('filledHtmlCode exists:', !!data.filledHtmlCode);
      console.log('formData exists:', !!data.formData);
      console.log('userMessage:', data.userMessage);
      console.log('approvalNote:', data.approvalNote);
      
      // 檢查 htmlCode 中是否包含填充的數據
      if (data.htmlCode) {
        console.log('htmlCode contains "Starchy Yeung":', data.htmlCode.includes('Starchy Yeung'));
        console.log('htmlCode contains "Morning":', data.htmlCode.includes('Morning'));
        console.log('htmlCode contains "Dryness":', data.htmlCode.includes('Dryness'));
        console.log('htmlCode contains "value=":', data.htmlCode.includes('value='));
        console.log('htmlCode contains "selected":', data.htmlCode.includes('selected'));
      }
      
      setEmbeddedFormInstance(data);
      
      // 載入相關附圖，傳入 eform 參數以確保能獲取到 workflowInstanceId
      await loadRelatedAttachments(instanceId, currentEform);
    } catch (error) {
      console.error('Failed to load embedded form instance:', error);
      message.error('載入表單實例失敗: ' + error.message);
      setEmbeddedFormInstance(null);
    } finally {
      setLoadingEmbeddedForm(false);
    }
  };

  const loadRelatedAttachments = async (instanceId, eform = null) => {
    setLoadingAttachments(true);
    try {
      // 使用傳入的 eform 參數或從當前載入的表單實例中獲取 workflowInstanceId
      const currentEform = eform || selectedEform || embeddedFormInstance;
      let workflowInstanceId = currentEform?.workflowInstanceId;
      
      // 如果 workflowInstanceId 不存在，嘗試從 instanceName 中提取
      if (!workflowInstanceId && currentEform?.instanceName) {
        const match = currentEform.instanceName.match(/_(\d+)_/);
        if (match) {
          workflowInstanceId = match[1];
          console.log('Extracted workflowInstanceId from instanceName:', workflowInstanceId);
        }
      }
      
      console.log('Loading related attachments for eForm instance:', instanceId);
      console.log('Current eform:', currentEform);
      console.log('Workflow instance ID:', workflowInstanceId);
      
      if (!workflowInstanceId) {
        console.log('No workflowInstanceId found for this eForm');
        setRelatedAttachments([]);
        return;
      }
      
      // 使用與 WorkflowMonitorPage.js 相同的 API
      const response = await fetch(`/api/workflowexecutions/${workflowInstanceId}/media-files`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Media files API not exists or no media files for this workflow instance');
          setRelatedAttachments([]);
          return;
        }
        throw new Error(`Failed to load media files: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Loaded media files for workflow instance:', data);
      setRelatedAttachments(data.data || []);
    } catch (error) {
      console.error('Failed to load related attachments:', error);
      setRelatedAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleApprove = (eform) => {
    setSelectedEform(eform);
    setApproveModalVisible(true);
    setApprovalNote('');
  };

  const handleReject = (eform) => {
    setSelectedEform(eform);
    setRejectModalVisible(true);
    setApprovalNote('');
  };

  // 處理狀態切換
  const handleStatusChange = (eform, newStatus) => {
    setStatusChangeTarget({ eform, newStatus });
    setStatusChangeNote(''); // 重置 note
    setStatusChangeModalVisible(true);
  };

  const processApproval = async (action) => {
    if (!selectedEform) return;

    setProcessingEform(selectedEform.id);
    try {
      console.log(`Processing ${action} operation, form ID: ${selectedEform.id}`);
      
      const response = await fetch(`/api/eforminstances/${selectedEform.id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          note: approvalNote,
          approvedBy: localStorage.getItem('username') || 'current_user'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Operation failed' }));
        throw new Error(errorData.error || `${action} operation failed`);
      }

      const result = await response.json();
      console.log(`${action} operation result:`, result);
      
      message.success(result.message || t(`pendingTasks.${action === 'approve' ? 'approveSuccess' : 'rejectSuccess'}`));
      
      // Reload data
      await Promise.all([
        loadAllTabData(),
        loadStatistics(),
        loadFillTypeStatistics()
      ]);
      
      // Close modal
      setApproveModalVisible(false);
      setRejectModalVisible(false);
      setSelectedEform(null);
      setApprovalNote('');
    } catch (error) {
      console.error(`${action} operation failed:`, error);
      message.error(t(`pendingTasks.${action === 'approve' ? 'approveFailed' : 'rejectFailed'}`) + ': ' + error.message);
    } finally {
      setProcessingEform(null);
    }
  };

  // 處理表單提交 - 使用內部 API 提交表單（已登入用戶）
  const handleSubmitForm = async () => {
    try {
      console.log('Submitting form using internal API:', embeddedFormInstance);
      console.log('fillType:', embeddedFormInstance?.fillType);
      console.log('formId:', embeddedFormInstance?.id);

      // 從 DOM 中獲取填寫後的表單內容
      const formContainer = document.querySelector('.form-content-inner');
      if (!formContainer) {
        console.error('找不到表單容器 .form-content-inner');
        message.error('無法獲取表單內容');
        return;
      }

      // 克隆容器以避免修改原始 DOM
      const clonedContainer = formContainer.cloneNode(true);
      
      // 獲取所有表單元素並將用戶輸入的值寫入 value 屬性
      const inputs = clonedContainer.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], input[type="date"], input[type="time"]');
      inputs.forEach(input => {
        if (input.value) {
          input.setAttribute('value', input.value);
        }
      });

      const selects = clonedContainer.querySelectorAll('select');
      selects.forEach(select => {
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
          selectedOption.setAttribute('selected', 'selected');
        }
      });

      const checkboxes = clonedContainer.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
          checkbox.setAttribute('checked', 'checked');
        }
      });

      const radios = clonedContainer.querySelectorAll('input[type="radio"]');
      radios.forEach(radio => {
        if (radio.checked) {
          radio.setAttribute('checked', 'checked');
        }
      });

      const textareas = clonedContainer.querySelectorAll('textarea');
      textareas.forEach(textarea => {
        textarea.setAttribute('value', textarea.value);
        textarea.textContent = textarea.value;
      });

      const filledHtml = clonedContainer.innerHTML;
      console.log('準備提交表單，HTML 長度:', filledHtml.length);
      
      // 使用內部 API 提交表單數據（不需要 token）
      console.log('提交 URL:', `/api/eforminstances/${embeddedFormInstance.id}/submit`);
      const response = await fetch(`/api/eforminstances/${embeddedFormInstance.id}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filledHtmlCode: filledHtml,
          submittedBy: localStorage.getItem('username') || 'internal_user'
        })
      });

      console.log('API 回應狀態:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '提交失敗' }));
        console.error('提交失敗，錯誤數據:', errorData);
        throw new Error(errorData.error || '提交失敗');
      }

      const result = await response.json();
      console.log('表單提交成功，結果:', result);
      
      message.success(result.message || '表單提交成功');
      
      // 重新載入數據
      await Promise.all([
        loadAllTabData(),
        loadStatistics(),
        loadFillTypeStatistics()
      ]);
      
      // 關閉模態框
      handleCloseEmbeddedForm();
      
    } catch (error) {
      console.error('表單提交失敗:', error);
      message.error('表單提交失敗: ' + error.message);
    }
  };

  // 處理狀態切換確認
  const processStatusChange = async () => {
    if (!statusChangeTarget) return;

    const { eform, newStatus } = statusChangeTarget;
    setProcessingEform(eform.id);
    
    try {
      console.log(`Changing status from ${eform.status} to ${newStatus}, form ID: ${eform.id}`);
      console.log(`User note: ${statusChangeNote}`);
      
      const response = await fetch(`/api/eforminstances/${eform.id}/${newStatus === 'Approved' ? 'approve' : 'reject'}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          note: statusChangeNote || `狀態從 ${eform.status} 更改為 ${newStatus}`,
          approvedBy: localStorage.getItem('username') || 'current_user'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Status change failed' }));
        throw new Error(errorData.error || 'Status change failed');
      }

      const result = await response.json();
      console.log('Status change result:', result);
      
      message.success(result.message || `狀態已更改為 ${newStatus}`);
      
      // Reload data
      await Promise.all([
        loadAllTabData(),
        loadStatistics(),
        loadFillTypeStatistics()
      ]);
      
      // Close modal
      setStatusChangeModalVisible(false);
      setStatusChangeTarget(null);
      setStatusChangeNote('');
    } catch (error) {
      console.error('Status change failed:', error);
      message.error('狀態更改失敗: ' + error.message);
    } finally {
      setProcessingEform(null);
    }
  };

  // 全選/取消全選功能
  const handleSelectAll = () => {
    const canSelect = (viewMode === 'normal' && activeTab === 'pending') || 
                     (viewMode === 'normal' && activeTab === 'approved') || 
                     (viewMode === 'normal' && activeTab === 'rejected');
    
    if (!canSelect) return;
    
    // 獲取當前頁面的所有可選擇項目
    let currentPageData = [];
    if (viewMode === 'normal') {
      switch (activeTab) {
        case 'pending':
          currentPageData = pendingEforms;
          break;
        case 'approved':
          currentPageData = approvedEforms;
          break;
        case 'rejected':
          currentPageData = rejectedEforms;
          break;
        default:
          currentPageData = [];
      }
    }
    
    // 檢查是否已經全選
    const allSelected = currentPageData.every(item => selectedRowKeys.includes(item.id));
    
    if (allSelected) {
      // 取消全選：移除當前頁面的所有項目
      const currentPageIds = currentPageData.map(item => item.id);
      setSelectedRowKeys(prev => prev.filter(key => !currentPageIds.includes(key)));
      setSelectedRows(prev => prev.filter(row => !currentPageIds.includes(row.id)));
    } else {
      // 全選：添加當前頁面的所有項目
      const newSelectedKeys = [...new Set([...selectedRowKeys, ...currentPageData.map(item => item.id)])];
      const newSelectedRows = [...new Set([...selectedRows, ...currentPageData])];
      setSelectedRowKeys(newSelectedKeys);
      setSelectedRows(newSelectedRows);
    }
  };

  // 批量處理函數
  const handleBatchAction = (action) => {
    setBatchAction(action);
    setBatchNote('');
    setBatchProcessingModalVisible(true);
  };

  const processBatchAction = async () => {
    if (selectedRows.length === 0) return;

    setProcessingBatch(true);
    try {
      console.log(`Processing batch ${batchAction} for ${selectedRows.length} items`);
      
      const promises = selectedRows.map(async (row) => {
        let endpoint, actionText;
        
        switch (batchAction) {
          case 'approve':
            endpoint = `/api/eforminstances/${row.id}/approve`;
            actionText = '批准';
            break;
          case 'reject':
            endpoint = `/api/eforminstances/${row.id}/reject`;
            actionText = '拒絕';
            break;
          case 'changeToApproved':
            endpoint = `/api/eforminstances/${row.id}/approve`;
            actionText = '改為批准';
            break;
          case 'changeToRejected':
            endpoint = `/api/eforminstances/${row.id}/reject`;
            actionText = '改為拒絕';
            break;
          default:
            throw new Error('Invalid batch action');
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            note: batchNote || `批量${actionText}`,
            approvedBy: localStorage.getItem('username') || 'current_user'
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Operation failed' }));
          throw new Error(`表單 ${row.formName} ${actionText}失敗: ${errorData.error || 'Operation failed'}`);
        }

        return await response.json();
      });

      const results = await Promise.all(promises);
      console.log('Batch operation results:', results);
      
      message.success(
        batchAction === 'approve' || batchAction === 'changeToApproved' ? 
        t('pendingTasks.batchApprovalSuccess', { count: selectedRows.length }) :
        t('pendingTasks.batchRejectionSuccess', { count: selectedRows.length })
      );
      
      // 清除選擇並重新載入數據
      setSelectedRowKeys([]);
      setSelectedRows([]);
      
      await Promise.all([
        loadAllTabData(),
        loadStatistics(),
        loadFillTypeStatistics()
      ]);
      
      // 關閉模態框
      setBatchProcessingModalVisible(false);
      setBatchAction('');
      setBatchNote('');
      
    } catch (error) {
      console.error('Batch operation failed:', error);
      message.error(t('pendingTasks.batchOperationFailed') + ': ' + error.message);
    } finally {
      setProcessingBatch(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'red';
      case 'Medium': return 'orange';
      case 'Low': return 'green';
      default: return 'default';
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'High': return t('pendingTasks.high');
      case 'Medium': return t('pendingTasks.medium');
      case 'Low': return t('pendingTasks.low');
      default: return priority;
    }
  };

  const getFillTypeColor = (fillType) => {
    switch (fillType) {
      case 'Manual': return 'blue';
      case 'AI': return 'green';
      case 'Data': return 'purple';
      default: return 'default';
    }
  };

  const getFillTypeText = (fillType) => {
    switch (fillType) {
      case 'Manual': return t('pendingTasks.manualFill');
      case 'AI': return t('pendingTasks.aiFill');
      case 'Data': return t('pendingTasks.dataFill');
      default: return fillType || '-';
    }
  };

  // 媒體文件相關函數
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'svg':
      case 'tiff':
      case 'ico':
        return <FileImageOutlined style={{ color: '#52c41a' }} />;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'flv':
      case 'webm':
      case 'mkv':
      case 'm4v':
      case '3gp':
        return <VideoCameraOutlined style={{ color: '#1890ff' }} />;
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'aac':
      case 'flac':
      case 'm4a':
      case 'wma':
        return <AudioOutlined style={{ color: '#fa8c16' }} />;
      case 'pdf':
        return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
      case 'doc':
      case 'docx':
        return <FileWordOutlined style={{ color: '#1890ff' }} />;
      case 'xls':
      case 'xlsx':
        return <FileExcelOutlined style={{ color: '#52c41a' }} />;
      case 'ppt':
      case 'pptx':
        return <FilePptOutlined style={{ color: '#fa8c16' }} />;
      case 'txt':
        return <FileTextOutlined style={{ color: '#666' }} />;
      case 'zip':
      case 'rar':
      case '7z':
        return <FileZipOutlined style={{ color: '#722ed1' }} />;
      default:
        return <FileOutlined style={{ color: '#999' }} />;
    }
  };

  const getFileType = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico'];
    const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp'];
    const audioTypes = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'];
    
    if (imageTypes.includes(extension)) return 'image';
    if (videoTypes.includes(extension)) return 'video';
    if (audioTypes.includes(extension)) return 'audio';
    return 'document';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Lightbox 相關函數
  const openLightbox = (file, allFiles = []) => {
    const imageVideoFiles = allFiles.filter(f => {
      const fileType = getFileType(f.fileName);
      return fileType === 'image' || fileType === 'video';
    });
    
    const currentIndex = imageVideoFiles.findIndex(f => f.id === file.id);
    
    setLightboxFiles(imageVideoFiles);
    setLightboxFile(file);
    setLightboxCurrentIndex(currentIndex >= 0 ? currentIndex : 0);
    setLightboxVisible(true);
  };

  const closeLightbox = () => {
    setLightboxVisible(false);
    setLightboxFile(null);
    setLightboxFiles([]);
    setLightboxCurrentIndex(0);
  };

  const goToPrevious = () => {
    if (lightboxFiles.length > 0) {
      const newIndex = lightboxCurrentIndex > 0 ? lightboxCurrentIndex - 1 : lightboxFiles.length - 1;
      setLightboxCurrentIndex(newIndex);
      setLightboxFile(lightboxFiles[newIndex]);
    }
  };

  const goToNext = () => {
    if (lightboxFiles.length > 0) {
      const newIndex = lightboxCurrentIndex < lightboxFiles.length - 1 ? lightboxCurrentIndex + 1 : 0;
      setLightboxCurrentIndex(newIndex);
      setLightboxFile(lightboxFiles[newIndex]);
    }
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getStatusTag = (status, dueDate) => {
    // 根據實際狀態決定顯示
    let color, text, icon;
    
    switch (status) {
      case 'Approved':
        color = 'green';
        text = t('pendingTasks.approved');
        icon = <CheckCircleOutlined />;
        break;
      case 'Rejected':
        color = 'red';
        text = t('pendingTasks.rejected');
        icon = <CloseCircleOutlined />;
        break;
      case 'Submitted':
        color = 'blue';
        text = t('pendingTasks.submitted');
        icon = <FileTextOutlined />;
        break;
      case 'Pending':
      default:
        // 對於 Pending 狀態，檢查是否過期
    const isOverdueStatus = isOverdue(dueDate);
        color = isOverdueStatus ? 'error' : 'warning';
        text = isOverdueStatus ? t('pendingTasks.overdue') : t('pendingTasks.pending');
        icon = <ClockCircleOutlined />;
        break;
    }
    
    return (
      <Tag color={color} icon={icon}>
        {text}
      </Tag>
    );
  };

  // columns 狀態化與寬度調整 - 使用 useMemo 根據 activeTab 動態計算
  const baseColumns = React.useMemo(() => [
    // 批量選擇列
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={(() => {
              const canSelect = (viewMode === 'normal' && activeTab === 'pending') || 
                               (viewMode === 'normal' && activeTab === 'approved') || 
                               (viewMode === 'normal' && activeTab === 'rejected');
              
              if (!canSelect) return false;
              
              // 獲取當前頁面的數據
              let currentPageData = [];
              if (viewMode === 'normal') {
                switch (activeTab) {
                  case 'pending':
                    currentPageData = pendingEforms;
                    break;
                  case 'approved':
                    currentPageData = approvedEforms;
                    break;
                  case 'rejected':
                    currentPageData = rejectedEforms;
                    break;
                  default:
                    currentPageData = [];
                }
              }
              
              // 檢查是否全選（當前頁面所有項目都被選中）
              return currentPageData.length > 0 && currentPageData.every(item => selectedRowKeys.includes(item.id));
            })()}
            onChange={handleSelectAll}
            style={{ cursor: 'pointer' }}
            title={(() => {
              const canSelect = (viewMode === 'normal' && activeTab === 'pending') || 
                               (viewMode === 'normal' && activeTab === 'approved') || 
                               (viewMode === 'normal' && activeTab === 'rejected');
              
              if (!canSelect) return '';
              
              // 獲取當前頁面的數據
              let currentPageData = [];
              if (viewMode === 'normal') {
                switch (activeTab) {
                  case 'pending':
                    currentPageData = pendingEforms;
                    break;
                  case 'approved':
                    currentPageData = approvedEforms;
                    break;
                  case 'rejected':
                    currentPageData = rejectedEforms;
                    break;
                  default:
                    currentPageData = [];
                }
              }
              
              const allSelected = currentPageData.length > 0 && currentPageData.every(item => selectedRowKeys.includes(item.id));
              return allSelected ? t('pendingTasks.deselectAll') : t('pendingTasks.selectAll');
            })()}
          />
          <span>{t('pendingTasks.select')}</span>
          {selectedRowKeys.length > 0 && (
            <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>
              {selectedRowKeys.length}
            </Tag>
          )}
        </div>
      ),
      key: 'selection',
      width: 80,
      fixed: 'left',
      render: (_, record) => {
        // 根據視圖模式和標籤頁決定是否顯示選擇框
        const canSelect = (viewMode === 'normal' && activeTab === 'pending') || 
                         (viewMode === 'normal' && activeTab === 'approved') || 
                         (viewMode === 'normal' && activeTab === 'rejected');
        
        if (!canSelect) return null;
        
        return (
          <input
            type="checkbox"
            checked={selectedRowKeys.includes(record.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedRowKeys(prev => [...prev, record.id]);
                setSelectedRows(prev => [...prev, record]);
              } else {
                setSelectedRowKeys(prev => prev.filter(key => key !== record.id));
                setSelectedRows(prev => prev.filter(row => row.id !== record.id));
              }
            }}
            style={{ cursor: 'pointer' }}
          />
        );
      }
    },
    {
      title: t('pendingTasks.formName'),
      dataIndex: 'formName',
      key: 'formName',
      width: 200,
      sorter: (a, b) => a.formName.localeCompare(b.formName),
      sortDirections: ['ascend', 'descend'],
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.instanceName}
          </Text>
        </div>
      )
    },
    {
      title: t('pendingTasks.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: (a, b) => {
        const getStatusValue = (record) => {
          if (isOverdue(record.dueDate)) return 0; // Overdue first
          return 1; // Pending
        };
        return getStatusValue(a) - getStatusValue(b);
      },
      sortDirections: ['ascend', 'descend'],
      render: (status, record) => getStatusTag(status, record.dueDate)
    },
    {
      title: t('pendingTasks.fillType'),
      dataIndex: 'fillType',
      key: 'fillType',
      width: 100,
      sorter: (a, b) => a.fillType?.localeCompare(b.fillType || ''),
      sortDirections: ['ascend', 'descend'],
      render: (fillType) => (
        <Tag color={getFillTypeColor(fillType)}>
          {getFillTypeText(fillType)}
        </Tag>
      )
    },
    {
      title: t('pendingTasks.priority'),
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      sorter: (a, b) => {
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      },
      sortDirections: ['ascend', 'descend'],
      render: (priority) => (
        <Tag color={getPriorityColor(priority)}>
          {getPriorityText(priority)}
        </Tag>
      )
    },
    {
      title: t('pendingTasks.applicant'),
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
      sorter: (a, b) => a.createdBy.localeCompare(b.createdBy),
      sortDirections: ['ascend', 'descend'],
      render: (text) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      )
    },
    {
      title: t('pendingTasks.applicationTime'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      sortDirections: ['ascend', 'descend'],
      render: (date) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: t('pendingTasks.dueDate'),
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 150,
      sorter: (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
      sortDirections: ['ascend', 'descend'],
      render: (date, record) => {
        const isOverdueStatus = isOverdue(date);
        return (
          <Text type={isOverdueStatus ? 'danger' : 'secondary'}>
            {dayjs(date).format('MM-DD HH:mm')}
          </Text>
        );
      }
    },
    {
      title: t('pendingTasks.action'),
      key: 'action',
      width: 180,
       render: (_, record) => {
         // Manual Fill 模式不顯示任何操作按鈕
         if (viewMode === 'manual') {
           return null;
         }
         // Normal 模式的「待處理表單」顯示「批准」和「拒絕」按鈕
         else if (viewMode === 'normal' && activeTab === 'pending') {
           return (
        <Space size="small">
          <Tooltip title={t('pendingTasks.approveTooltip')}>
            <Button 
              type="primary"
              icon={<CheckCircleOutlined />} 
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click event
                handleApprove(record);
              }}
              style={{ 
                backgroundColor: '#52c41a',
                borderColor: '#52c41a',
                minWidth: '60px',
                height: '32px'
              }}
              size="small"
            >
              {t('pendingTasks.approve')}
            </Button>
          </Tooltip>
          
          <Tooltip title={t('pendingTasks.rejectTooltip')}>
            <Button 
              type="primary"
              danger
              icon={<CloseCircleOutlined />} 
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click event
                handleReject(record);
              }}
              style={{ 
                minWidth: '60px',
                height: '32px'
              }}
              size="small"
            >
              {t('pendingTasks.reject')}
            </Button>
          </Tooltip>
        </Space>
           );
         } else if (activeTab === 'approved') {
           return (
             <Space size="small">
               <Button 
                 type="primary"
                 danger
                 size="small"
                 onClick={(e) => {
                   e.stopPropagation();
                   handleStatusChange(record, 'Rejected');
                 }}
                 style={{ minWidth: '120px' }}
               >
                 {t('pendingTasks.changeToRejected')}
               </Button>
             </Space>
           );
         } else if (activeTab === 'rejected') {
           return (
             <Space size="small">
               <Button 
                 type="primary"
                 size="small"
                 onClick={(e) => {
                   e.stopPropagation();
                   handleStatusChange(record, 'Approved');
                 }}
                 style={{ 
                   backgroundColor: '#52c41a',
                   borderColor: '#52c41a',
                   minWidth: '120px'
                 }}
               >
                 {t('pendingTasks.changeToApproved')}
               </Button>
             </Space>
           );
         } else {
           return (
             <Space size="small">
               <Text type="secondary">
                 {activeTab === 'approved' ? t('pendingTasks.approvedBy') : t('pendingTasks.rejectedBy')}
               </Text>
             </Space>
           );
         }
       }
    }
  ], [activeTab, viewMode, t, selectedRowKeys]);

  const [columnWidths, setColumnWidths] = useState({});

  const resizableColumns = React.useMemo(() => 
    baseColumns.map(col => ({ 
      ...col, 
      width: columnWidths[col.key] || col.width || 120 
    }))
  , [baseColumns, columnWidths]);

  const handleResize = index => (e, { size }) => {
    const column = resizableColumns[index];
    setColumnWidths(prev => ({
      ...prev,
      [column.key]: size.width
    }));
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


  return (
    <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
      <Content style={{ 
        padding: '16px', 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        overflow: 'hidden'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '12px',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0
        }}>
          {/* Smart Buttons */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ 
              display: 'flex', 
              gap: '12px',
              width: '100%',
              marginBottom: '16px'
            }}>
              {/* In-house Form Smart Button */}
              <Card 
                size="small" 
                hoverable
                onClick={() => setViewMode('normal')}
                style={{ 
                  flex: '1',
                  cursor: 'pointer',
                  border: viewMode === 'normal' ? '2px solid #52c41a' : '1px solid #d9d9d9',
                  backgroundColor: viewMode === 'normal' ? '#f6ffed' : '#fff'
                }}
                styles={{ body: { padding: '16px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '100%' }}>
                  {/* 左側：標題和說明 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      marginBottom: '2px',
                      color: '#52c41a'
                    }}>
                      {t('pendingTasks.inhouseForm')}
                    </div>
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#666', 
                      lineHeight: '1.2'
                    }}
                    dangerouslySetInnerHTML={{ __html: t('pendingTasks.inhouseFormDescription') }}
                    />
                  </div>
                  
                  {/* 右側：AI 和 Data 計數 */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <RobotOutlined style={{ fontSize: '20px', color: '#52c41a', marginBottom: '2px' }} />
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
                        {fillTypeStatistics.aiFillCount}
                      </div>
                      <div style={{ fontSize: '10px', color: '#666' }}>AI</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <DatabaseOutlined style={{ fontSize: '20px', color: '#722ed1', marginBottom: '2px' }} />
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#722ed1' }}>
                        {fillTypeStatistics.dataFillCount}
                      </div>
                      <div style={{ fontSize: '10px', color: '#666' }}>Data</div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Public Form Smart Button */}
              <Card 
                size="small" 
                hoverable
                onClick={() => setViewMode('manual')}
                style={{ 
                  flex: '1',
                  cursor: 'pointer',
                  border: viewMode === 'manual' ? '2px solid #1890ff' : '1px solid #d9d9d9',
                  backgroundColor: viewMode === 'manual' ? '#f0f8ff' : '#fff'
                }}
                styles={{ body: { padding: '16px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '100%' }}>
                  {/* 左側：標題和說明 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      marginBottom: '2px',
                      color: '#1890ff'
                    }}>
                      {t('pendingTasks.publicForm')}
                    </div>
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#666', 
                      lineHeight: '1.2'
                    }}
                    dangerouslySetInnerHTML={{ __html: t('pendingTasks.publicFormDescription') }}
                    />
                  </div>
                  
                  {/* 右側：Manual Fill 計數 */}
                  <div style={{ textAlign: 'center' }}>
                    <FormOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '4px' }} />
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
                      {fillTypeStatistics.manualFillCount}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666' }}>Manual</div>
                  </div>
                </div>
              </Card>

              {/* Original Statistics */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '8px',
                flex: '2'
              }}>
                <Card size="small" styles={{ body: { padding: '12px' } }}>
              <Statistic
                title={t('pendingTasks.totalPending')}
                value={statistics.total}
                prefix={<FileTextOutlined />}
                    valueStyle={{ color: '#1890ff', fontSize: '16px' }}
              />
            </Card>
                
                <Card size="small" styles={{ body: { padding: '12px' } }}>
              <Statistic
                title={t('pendingTasks.pendingApproval')}
                value={statistics.pending}
                prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: '#faad14', fontSize: '16px' }}
              />
            </Card>
                
                <Card size="small" styles={{ body: { padding: '12px' } }}>
              <Statistic
                title={t('pendingTasks.overdueItems')}
                value={statistics.overdue}
                prefix={<ExclamationCircleOutlined />}
                    valueStyle={{ color: '#ff4d4f', fontSize: '16px' }}
              />
            </Card>
                
                <Card size="small" styles={{ body: { padding: '12px' } }}>
              <Statistic
                title={t('pendingTasks.urgentItems')}
                value={statistics.urgent}
                prefix={<ExclamationCircleOutlined />}
                    valueStyle={{ color: '#ff4d4f', fontSize: '16px' }}
              />
            </Card>
              </div>
            </div>
          </div>

          {/* Filter and Search */}
          <div style={{ flexShrink: 0 }}>
            <Card size="small" styles={{ body: { padding: '12px' } }}>
            <Row gutter={[8, 8]} align="middle" wrap={false} style={{ flexWrap: 'nowrap' }}>
              <Col flex="auto">
                <Search
                  placeholder={t('pendingTasks.searchPlaceholder')}
                  value={filters.searchText}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                  onSearch={handleSearch}
                  style={{ width: '100%' }}
                />
              </Col>
              
              <Col flex="150px">
                <Select
                  placeholder={t('pendingTasks.priorityPlaceholder')}
                  value={filters.priority}
                  onChange={handlePriorityFilter}
                  style={{ width: '100%' }}
                >
                  <Option value="all">{t('pendingTasks.all')}</Option>
                  <Option value="High">{t('pendingTasks.high')}</Option>
                  <Option value="Medium">{t('pendingTasks.medium')}</Option>
                  <Option value="Low">{t('pendingTasks.low')}</Option>
                </Select>
              </Col>
              
              <Col flex="none">
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={loadPendingEforms}
                  loading={loading}
                >
                  {t('pendingTasks.refresh')}
                </Button>
              </Col>
            </Row>
            </Card>
          </div>

          {/* Batch Operations */}
          {selectedRowKeys.length > 0 && (
            <div style={{ flexShrink: 0 }}>
              <Card size="small" styles={{ body: { padding: '12px' } }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Text strong>{t('pendingTasks.selectedItems', { count: selectedRowKeys.length })}</Text>
                    <Button 
                      size="small" 
                      onClick={() => {
                        setSelectedRowKeys([]);
                        setSelectedRows([]);
                      }}
                    >
                      {t('pendingTasks.clearSelection')}
                    </Button>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {viewMode === 'normal' && activeTab === 'pending' && (
                      <>
                        <Button 
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          onClick={() => handleBatchAction('approve')}
                          style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                        >
                          {t('pendingTasks.batchApprove')}
                        </Button>
                        <Button 
                          type="primary"
                          danger
                          icon={<CloseCircleOutlined />}
                          onClick={() => handleBatchAction('reject')}
                        >
                          {t('pendingTasks.batchReject')}
                        </Button>
                      </>
                    )}
                    
                    {viewMode === 'normal' && activeTab === 'approved' && (
                      <Button 
                        type="primary"
                        danger
                        icon={<CloseCircleOutlined />}
                        onClick={() => handleBatchAction('changeToRejected')}
                      >
                        {t('pendingTasks.batchChangeToRejected')}
                      </Button>
                    )}
                    
                    {viewMode === 'normal' && activeTab === 'rejected' && (
                      <Button 
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleBatchAction('changeToApproved')}
                        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                      >
                        {t('pendingTasks.batchChangeToApproved')}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Forms List with Tabs */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Card 
            size="small"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
              styles={{
                body: {
                  padding: '0px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
                }
              }}
            >
              <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}
                tabBarStyle={{
                  margin: '0px',
                  padding: '12px 12px 0px 12px'
                }}
                items={viewMode === 'manual' ? [
                  {
                    key: 'pending',
                    label: (
              <Space>
                        <Text>{t('pendingTasks.manualPendingForms')}</Text>
                        <Badge count={counts.manualPending} showZero />
              </Space>
                    ),
                    children: (
                      <div style={{ 
                        flex: 1, 
                        minHeight: 0, 
                        overflow: 'hidden',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <Table
                          components={components}
                          columns={mergedColumns}
                          dataSource={manualPendingEforms}
                          rowKey="id"
                          loading={loading}
                          onRow={(record) => ({
                            onClick: (e) => {
                              // 如果點擊的是選擇列（固定左側列），不觸發打開表單
                              if (e.target.closest('td.ant-table-cell-fix-left-last') || 
                                  e.target.closest('th.ant-table-cell-fix-left-last') ||
                                  e.target.closest('td.ant-table-cell-fix-left') ||
                                  e.target.closest('th.ant-table-cell-fix-left')) {
                                return;
                              }
                              handleViewEform(record);
                            },
                            style: { cursor: 'pointer' }
                          })}
                          pagination={{
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => 
                              t('pendingTasks.pageRange', { start: range[0], end: range[1], total }),
                            locale: {
                              items_per_page: t('pendingTasks.itemsPerPage'),
                              jump_to: t('pendingTasks.jumpTo'),
                              jump_to_confirm: t('pendingTasks.confirm'),
                              page: t('pendingTasks.page')
                            }
                          }}
                          scroll={{ 
                            x: 1000,
                            y: getTableScrollHeight()
                          }}
                          sticky={{
                            offsetHeader: 0
                          }}
                          locale={{
                            emptyText: (
                              <Empty 
                                description={t('pendingTasks.noManualPendingForms')} 
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                              />
                            )
                          }}
                        />
            </div>
                    )
                  },
                  {
                    key: 'responded',
                    label: (
                      <Space>
                        <Text>{t('pendingTasks.manualRespondedForms')}</Text>
                        <Badge count={counts.manualResponded} showZero />
                      </Space>
                    ),
                    children: (
                      <div style={{ 
                        flex: 1, 
                        minHeight: 0, 
                        overflow: 'hidden',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <Table
                          components={components}
                          columns={mergedColumns}
                          dataSource={manualRespondedEforms}
                          rowKey="id"
                          loading={loading}
                          onRow={(record) => ({
                            onClick: (e) => {
                              // 如果點擊的是選擇列（固定左側列），不觸發打開表單
                              if (e.target.closest('td.ant-table-cell-fix-left-last') || 
                                  e.target.closest('th.ant-table-cell-fix-left-last') ||
                                  e.target.closest('td.ant-table-cell-fix-left') ||
                                  e.target.closest('th.ant-table-cell-fix-left')) {
                                return;
                              }
                              handleViewEform(record);
                            },
                            style: { cursor: 'pointer' }
                          })}
                          pagination={{
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => 
                              t('pendingTasks.pageRange', { start: range[0], end: range[1], total }),
                            locale: {
                              items_per_page: t('pendingTasks.itemsPerPage'),
                              jump_to: t('pendingTasks.jumpTo'),
                              jump_to_confirm: t('pendingTasks.confirm'),
                              page: t('pendingTasks.page')
                            }
                          }}
                          scroll={{ 
                            x: 1000,
                            y: getTableScrollHeight()
                          }}
                          sticky={{
                            offsetHeader: 0
                          }}
                          locale={{
                            emptyText: (
                              <Empty 
                                description={t('pendingTasks.noManualRespondedForms')} 
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                              />
                            )
                          }}
                        />
                      </div>
                    )
                  }
                ] : [
                  {
                    key: 'pending',
                    label: (
                      <Space>
                        <Text>{t('pendingTasks.pendingForms')}</Text>
                        <Badge count={counts.pending} showZero />
                      </Space>
                    ),
                    children: (
                      <div style={{ 
                        flex: 1, 
                        minHeight: 0, 
                        overflow: 'hidden',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
              <Table
                components={components}
                columns={mergedColumns}
                dataSource={pendingEforms}
                rowKey="id"
                loading={loading}
                onRow={(record) => ({
                  onClick: (e) => {
                    // 如果點擊的是選擇列（固定左側列），不觸發打開表單
                    if (e.target.closest('td.ant-table-cell-fix-left-last') || 
                        e.target.closest('th.ant-table-cell-fix-left-last') ||
                        e.target.closest('td.ant-table-cell-fix-left') ||
                        e.target.closest('th.ant-table-cell-fix-left')) {
                      return;
                    }
                    handleViewEform(record);
                  },
                  style: { cursor: 'pointer' }
                })}
                pagination={{
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => 
                    t('pendingTasks.pageRange', { start: range[0], end: range[1], total }),
                  locale: {
                    items_per_page: t('pendingTasks.itemsPerPage'),
                    jump_to: t('pendingTasks.jumpTo'),
                    jump_to_confirm: t('pendingTasks.confirm'),
                    page: t('pendingTasks.page')
                  }
                }}
                scroll={{ 
                  x: 1000,
                  y: getTableScrollHeight()
                }}
                sticky={{
                  offsetHeader: 0
                }}
                locale={{
                  emptyText: (
                    <Empty 
                      description={t('pendingTasks.noPendingTasks')} 
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )
                }}
              />
            </div>
                    )
                  },
                  {
                    key: 'approved',
                    label: (
                      <Space>
                        <Text>{t('pendingTasks.approvedForms')}</Text>
                        <Badge count={counts.approved} showZero />
                      </Space>
                    ),
                    children: (
                      <div style={{ 
                        flex: 1, 
                        minHeight: 0, 
                        overflow: 'hidden',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <Table
                          components={components}
                          columns={mergedColumns}
                          dataSource={approvedEforms}
                          rowKey="id"
                          loading={loading}
                          onRow={(record) => ({
                            onClick: (e) => {
                              // 如果點擊的是選擇列（固定左側列），不觸發打開表單
                              if (e.target.closest('td.ant-table-cell-fix-left-last') || 
                                  e.target.closest('th.ant-table-cell-fix-left-last') ||
                                  e.target.closest('td.ant-table-cell-fix-left') ||
                                  e.target.closest('th.ant-table-cell-fix-left')) {
                                return;
                              }
                              handleViewEform(record);
                            },
                            style: { cursor: 'pointer' }
                          })}
                          pagination={{
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => 
                              t('pendingTasks.pageRange', { start: range[0], end: range[1], total }),
                            locale: {
                              items_per_page: t('pendingTasks.itemsPerPage'),
                              jump_to: t('pendingTasks.jumpTo'),
                              jump_to_confirm: t('pendingTasks.confirm'),
                              page: t('pendingTasks.page')
                            }
                          }}
                          scroll={{ 
                            x: 1000,
                            y: getTableScrollHeight()
                          }}
                          sticky={{
                            offsetHeader: 0
                          }}
                          locale={{
                            emptyText: (
                              <Empty 
                                description={t('pendingTasks.noApprovedForms')} 
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                              />
                            )
                          }}
                        />
                      </div>
                    )
                  },
                  {
                    key: 'rejected',
                    label: (
                      <Space>
                        <Text>{t('pendingTasks.rejectedForms')}</Text>
                        <Badge count={counts.rejected} showZero />
                      </Space>
                    ),
                    children: (
                      <div style={{ 
                        flex: 1, 
                        minHeight: 0, 
                        overflow: 'hidden',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <Table
                          components={components}
                          columns={mergedColumns}
                          dataSource={rejectedEforms}
                          rowKey="id"
                          loading={loading}
                          onRow={(record) => ({
                            onClick: (e) => {
                              // 如果點擊的是選擇列（固定左側列），不觸發打開表單
                              if (e.target.closest('td.ant-table-cell-fix-left-last') || 
                                  e.target.closest('th.ant-table-cell-fix-left-last') ||
                                  e.target.closest('td.ant-table-cell-fix-left') ||
                                  e.target.closest('th.ant-table-cell-fix-left')) {
                                return;
                              }
                              handleViewEform(record);
                            },
                            style: { cursor: 'pointer' }
                          })}
                          pagination={{
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => 
                              t('pendingTasks.pageRange', { start: range[0], end: range[1], total }),
                            locale: {
                              items_per_page: t('pendingTasks.itemsPerPage'),
                              jump_to: t('pendingTasks.jumpTo'),
                              jump_to_confirm: t('pendingTasks.confirm'),
                              page: t('pendingTasks.page')
                            }
                          }}
                          scroll={{ 
                            x: 1000,
                            y: getTableScrollHeight()
                          }}
                          sticky={{
                            offsetHeader: 0
                          }}
                          locale={{
                            emptyText: (
                              <Empty 
                                description={t('pendingTasks.noRejectedForms')} 
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                              />
                            )
                          }}
                        />
                      </div>
                    )
                  }
                ]}
              />
          </Card>
          </div>
        </div>

        {/* Approval Confirmation Modal */}
        <Modal
          title={t('pendingTasks.approveApplication')}
          open={approveModalVisible}
          onOk={() => processApproval('approve')}
          onCancel={() => setApproveModalVisible(false)}
          confirmLoading={processingEform === selectedEform?.id}
          okText={t('pendingTasks.confirmApprove')}
          cancelText={t('pendingTasks.cancel')}
          okButtonProps={{ 
            type: 'primary',
            style: { backgroundColor: '#52c41a', borderColor: '#52c41a' }
          }}
        >
          <Alert
            message={t('pendingTasks.confirmApproval')}
            description={`${t('pendingTasks.confirmApproval')}「${selectedEform?.formName}」？`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div>
            <Text strong>{t('pendingTasks.applicantLabel')}</Text>
            <Text>{selectedEform?.createdBy}</Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text strong>{t('pendingTasks.applicationTimeLabel')}</Text>
            <Text>{selectedEform?.createdAt ? dayjs(selectedEform.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
          </div>
          <Divider />
          <div>
            <Text strong>{t('pendingTasks.approvalNote')}：</Text>
            <Input.TextArea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder={t('pendingTasks.approvalNotePlaceholder')}
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>
        </Modal>

        {/* Rejection Confirmation Modal */}
        <Modal
          title={t('pendingTasks.rejectApplication')}
          open={rejectModalVisible}
          onOk={() => processApproval('reject')}
          onCancel={() => setRejectModalVisible(false)}
          confirmLoading={processingEform === selectedEform?.id}
          okText={t('pendingTasks.confirmReject')}
          cancelText={t('pendingTasks.cancel')}
          okButtonProps={{ 
            type: 'primary',
            danger: true
          }}
        >
          <Alert
            message={t('pendingTasks.confirmRejection')}
            description={`${t('pendingTasks.confirmRejection')}「${selectedEform?.formName}」？`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div>
            <Text strong>{t('pendingTasks.applicantLabel')}</Text>
            <Text>{selectedEform?.createdBy}</Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text strong>{t('pendingTasks.applicationTimeLabel')}</Text>
            <Text>{selectedEform?.createdAt ? dayjs(selectedEform.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
          </div>
          <Divider />
          <div>
            <Text strong>{t('pendingTasks.rejectionReason')}：</Text>
            <Input.TextArea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder={t('pendingTasks.rejectionReasonPlaceholder')}
              rows={3}
              style={{ marginTop: 8 }}
              required
            />
          </div>
         </Modal>

         {/* Status Change Confirmation Modal */}
         <Modal
           title={t('pendingTasks.statusChangeConfirmation')}
           open={statusChangeModalVisible}
           onOk={processStatusChange}
           onCancel={() => setStatusChangeModalVisible(false)}
           confirmLoading={processingEform === statusChangeTarget?.eform?.id}
           okText={t('pendingTasks.confirmStatusChange')}
           cancelText={t('pendingTasks.cancel')}
           okButtonProps={{ 
             type: 'primary',
             danger: statusChangeTarget?.newStatus === 'Rejected',
             style: statusChangeTarget?.newStatus === 'Approved' ? 
               { backgroundColor: '#52c41a', borderColor: '#52c41a' } : undefined
           }}
         >
           {statusChangeTarget && (
             <>
               <Alert
                 message={t('pendingTasks.statusChangeWarning')}
                 description={
                   <div>
                     <div style={{ marginBottom: 12 }}>
                       <Text strong>{t('pendingTasks.currentStatus')}: </Text>
                       <Tag color={statusChangeTarget.eform.status === 'Approved' ? 'green' : 'red'}>
                         {statusChangeTarget.eform.status === 'Approved' ? t('pendingTasks.approved') : t('pendingTasks.rejected')}
                       </Tag>
                     </div>
                     <div style={{ marginBottom: 12 }}>
                       <Text strong>{t('pendingTasks.decidedBy')}: </Text>
                       <Text>{statusChangeTarget.eform.approvedBy || statusChangeTarget.eform.rejectedBy || '系統'}</Text>
                     </div>
                     <div style={{ marginBottom: 12 }}>
                       <Text strong>{t('pendingTasks.decidedAt')}: </Text>
                       <Text>{statusChangeTarget.eform.approvalAt ? dayjs(statusChangeTarget.eform.approvalAt).format('YYYY-MM-DD HH:mm:ss') : 
                              statusChangeTarget.eform.rejectedAt ? dayjs(statusChangeTarget.eform.rejectedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
                     </div>
                     <div>
                       <Text strong>{t('pendingTasks.changeTo')}: </Text>
                       <Tag color={statusChangeTarget.newStatus === 'Approved' ? 'green' : 'red'}>
                         {statusChangeTarget.newStatus === 'Approved' ? t('pendingTasks.approved') : t('pendingTasks.rejected')}
                       </Tag>
                     </div>
                   </div>
                 }
                 type="warning"
                 showIcon
                 style={{ marginBottom: 16 }}
               />
               <div style={{ marginTop: 16 }}>
                 <Text strong>{t('pendingTasks.confirmStatusChangeQuestion')}</Text>
               </div>
               <div style={{ marginTop: 16 }}>
                 <Text strong>{statusChangeTarget.newStatus === 'Approved' ? '批准備註:' : '拒絕備註:'}</Text>
                 <Input.TextArea
                   value={statusChangeNote}
                   onChange={(e) => setStatusChangeNote(e.target.value)}
                   placeholder={statusChangeTarget.newStatus === 'Approved' ? '請輸入批准原因...' : '請輸入拒絕原因...'}
                   rows={3}
                   style={{ marginTop: 8 }}
                   maxLength={500}
                   showCount
                 />
               </div>
             </>
           )}
         </Modal>

         {/* Batch Processing Confirmation Modal */}
         <Modal
           title={t('pendingTasks.batchOperationConfirmation')}
           open={batchProcessingModalVisible}
           onOk={processBatchAction}
           onCancel={() => setBatchProcessingModalVisible(false)}
           confirmLoading={processingBatch}
           okText={t('pendingTasks.confirmExecute')}
           cancelText={t('pendingTasks.cancel')}
           okButtonProps={{ 
             type: 'primary',
             danger: batchAction === 'reject' || batchAction === 'changeToRejected',
             style: (batchAction === 'approve' || batchAction === 'changeToApproved') ? 
               { backgroundColor: '#52c41a', borderColor: '#52c41a' } : undefined
           }}
         >
           <Alert
             message={t('pendingTasks.batchOperationConfirmation')}
             description={
               <div>
                 <div style={{ marginBottom: 12 }}>
                   <Text strong>{t('pendingTasks.batchOperationType')}: </Text>
                   <Tag color={
                     batchAction === 'approve' || batchAction === 'changeToApproved' ? 'green' :
                     batchAction === 'reject' || batchAction === 'changeToRejected' ? 'red' : 'default'
                   }>
                     {batchAction === 'approve' ? t('pendingTasks.batchApprove') :
                      batchAction === 'reject' ? t('pendingTasks.batchReject') :
                      batchAction === 'changeToApproved' ? t('pendingTasks.batchChangeToApproved') :
                      batchAction === 'changeToRejected' ? t('pendingTasks.batchChangeToRejected') : batchAction}
                   </Tag>
                 </div>
                 <div style={{ marginBottom: 12 }}>
                   <Text strong>{t('pendingTasks.selectedFormsCount')}: </Text>
                   <Text>{selectedRows.length} 個</Text>
                 </div>
                 <div style={{ marginBottom: 12 }}>
                   <Text strong>{t('pendingTasks.formsList')}: </Text>
                   <div style={{ 
                     maxHeight: '120px', 
                     overflow: 'auto', 
                     border: '1px solid #d9d9d9', 
                     borderRadius: '4px',
                     padding: '8px',
                     backgroundColor: '#fafafa',
                     marginTop: '4px'
                   }}>
                     {selectedRows.map((row, index) => (
                       <div key={row.id} style={{ 
                         fontSize: '12px', 
                         marginBottom: '2px',
                         color: '#666'
                       }}>
                         {index + 1}. {row.formName}
                       </div>
                     ))}
                   </div>
                 </div>
                 <div>
                   <Text strong>{t('pendingTasks.confirmBatchOperation')}</Text>
                 </div>
               </div>
             }
             type="warning"
             showIcon
             style={{ marginBottom: 16 }}
           />
           <div style={{ marginTop: 16 }}>
             <Text strong>{t('pendingTasks.operationNote')}:</Text>
             <Input.TextArea
               value={batchNote}
               onChange={(e) => setBatchNote(e.target.value)}
               placeholder={t('pendingTasks.operationNotePlaceholder')}
               rows={3}
               style={{ marginTop: 8 }}
               maxLength={500}
               showCount
             />
           </div>
         </Modal>

         {/* Lightbox Modal */}
        <Modal
          title={lightboxFile ? lightboxFile.fileName : ''}
          open={lightboxVisible}
          onCancel={closeLightbox}
          footer={null}
          width="95%"
          style={{ top: 10 }}
          zIndex={2000}
          styles={{
            body: { 
              padding: 0, 
              height: '80vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000'
            }
          }}
        >
          {lightboxFile && (
            <div style={{ 
              position: 'relative', 
              width: '100%', 
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* 關閉按鈕 */}
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={closeLightbox}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  zIndex: 1000,
                  color: '#fff',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  border: 'none'
                }}
              />
              
              {/* 上一張按鈕 */}
              {lightboxFiles.length > 1 && (
                <Button
                  type="text"
                  icon={<LeftOutlined />}
                  onClick={goToPrevious}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    color: '#fff',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    border: 'none'
                  }}
                />
              )}
              
              {/* 下一張按鈕 */}
              {lightboxFiles.length > 1 && (
                <Button
                  type="text"
                  icon={<RightOutlined />}
                  onClick={goToNext}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    color: '#fff',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    border: 'none'
                  }}
                />
              )}
              
              {/* 圖片/視頻顯示 */}
              {getFileType(lightboxFile.fileName) === 'image' ? (
                <img
                  src={lightboxFile.filePath}
                  alt={lightboxFile.fileName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              ) : getFileType(lightboxFile.fileName) === 'video' ? (
                <video
                  src={lightboxFile.filePath}
                  controls
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                />
              ) : null}
              
              {/* 圖片計數器 */}
              {lightboxFiles.length > 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: 20,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: '#fff',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '14px'
                }}>
                  {lightboxCurrentIndex + 1} / {lightboxFiles.length}
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Embedded Form Instance Modal */}
        <Modal
          title={renderModalTitle()}
          open={embeddedFormVisible}
          onCancel={handleCloseEmbeddedForm}
          footer={[]}
          width="90%"
          style={{ top: 20 }}
          zIndex={1050}
          destroyOnHidden={true}
          maskClosable={false}
          className="embedded-form-modal"
          styles={{
            body: {
              padding: '24px',
              minHeight: '400px'
            }
          }}
        >
          {loadingEmbeddedForm ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>{t('pendingTasks.loadingFormInstance')}</div>
            </div>
          ) : embeddedFormInstance ? (
            <div className="embedded-form-container" style={{
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Form Basic Information - 頂部固定，佔 18% 高度 */}
              <div style={{
                height: '18vh',
                minHeight: '140px',
                flexShrink: 0,
                marginBottom: '16px',
                backgroundColor: '#fff',
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{
                  padding: '8px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  backgroundColor: '#fafafa',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgb(38, 38, 38)'
                }}>
                  Form Basic Information
                </div>
                <div style={{ padding: '8px 16px', height: 'calc(100% - 40px)', overflow: 'hidden' }}>
                  {/* 第一行：基本信息 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Form Name</div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: 'rgb(38, 38, 38)', lineHeight: '1.2' }}>
                        {embeddedFormInstance.formName}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Status</div>
                      <Tag color={
                        embeddedFormInstance.status === 'Pending' ? 'orange' :
                        embeddedFormInstance.status === 'Approved' ? 'green' :
                        embeddedFormInstance.status === 'Rejected' ? 'red' : 'default'
                      } style={{ fontSize: '10px', padding: '1px 4px', lineHeight: '1.2' }}>
                        {embeddedFormInstance.status}
                      </Tag>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Fill Type</div>
                      <Tag color={
                        embeddedFormInstance.fillType === 'Manual' ? 'blue' :
                        embeddedFormInstance.fillType === 'AI' ? 'green' :
                        embeddedFormInstance.fillType === 'Data' ? 'orange' : 'default'
                      } style={{ fontSize: '10px', padding: '1px 4px', lineHeight: '1.2' }}>
                        {embeddedFormInstance.fillType === 'Manual' ? t('pendingTasks.manualFill') :
                         embeddedFormInstance.fillType === 'AI' ? t('pendingTasks.aiFill') :
                         embeddedFormInstance.fillType === 'Data' ? t('pendingTasks.dataFill') :
                         embeddedFormInstance.fillType}
                      </Tag>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Created At</div>
                      <div style={{ fontSize: '10px', color: 'rgb(102, 102, 102)', lineHeight: '1.2' }}>
                        {dayjs(embeddedFormInstance.createdAt).format('MM/DD HH:mm')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Approval By</div>
                      <div style={{ fontSize: '10px', color: 'rgb(102, 102, 102)', lineHeight: '1.2' }}>
                        {embeddedFormInstance.approvalBy || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Instance Name</div>
                      <div style={{ fontSize: '10px', color: 'rgb(102, 102, 102)', lineHeight: '1.2', wordBreak: 'break-all' }}>
                        {embeddedFormInstance.instanceName}
                      </div>
                    </div>
                  </div>
                  
                  {/* 第二行：User Input 和 Approval Note - 總是顯示 */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>User Input</div>
                      <div style={{ 
                        fontSize: '10px',
                        padding: '4px 8px',
                        backgroundColor: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '4px',
                        lineHeight: '1.3',
                        color: 'rgb(38, 38, 38)',
                        minHeight: '20px'
                      }}>
                        {embeddedFormInstance?.userMessage || '-'}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Approval Note</div>
                      <div style={{ 
                        fontSize: '10px',
                        padding: '4px 8px',
                        backgroundColor: '#fff7e6',
                        border: '1px solid #ffd591',
                        borderRadius: '4px',
                        lineHeight: '1.3',
                        color: 'rgb(38, 38, 38)',
                        minHeight: '20px'
                      }}>
                        {embeddedFormInstance?.approvalNote || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 下面分為兩個欄位：Form Content (70%) 和 Received Media (30%) */}
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                gap: '16px',
                minHeight: 0
              }}>
                {/* 左邊：表單內容 (70%) */}
                <div style={{ 
                  flex: '0 0 70%',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: '#fff',
                  border: '1px solid #d9d9d9',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: '#fafafa',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'rgb(38, 38, 38)',
                    flexShrink: 0
                  }}>
                    Form Content
                  </div>
                  <div style={{
                    flex: 1,
                    padding: '16px',
                    overflow: 'auto',
                    backgroundColor: embeddedFormInstance.fillType === 'Manual' ? '#ffffff' : '#fafafa'
                  }}>
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: embeddedFormInstance.htmlCode || ''
                      }}
                    />
                  </div>
                </div>

                {/* 右邊：相關附圖 (30%) */}
                <div style={{ 
                  flex: '0 0 30%',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: '#fff',
                  border: '1px solid #d9d9d9',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: '#fafafa',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'rgb(38, 38, 38)',
                    flexShrink: 0
                  }}>
                    Received Media
                  </div>
                  <div style={{
                    flex: 1,
                    padding: '16px',
                    overflow: 'auto',
                    backgroundColor: '#ffffff'
                  }}>
                      {loadingAttachments ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <Spin size="small" />
                          <div style={{ marginTop: '8px', fontSize: '12px' }}>載入附圖中...</div>
                        </div>
                      ) : relatedAttachments.length > 0 ? (
                        <div>
                          <div style={{ 
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #f0f0f0'
                          }}>
                            <Text strong style={{ fontSize: '14px' }}>
                              總文件數: {relatedAttachments.length}
                            </Text>
                          </div>
                          
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: '12px'
                          }}>
                            {relatedAttachments.map((file) => {
                              const fileType = getFileType(file.fileName);
                              const isImage = fileType === 'image';
                              const isVideo = fileType === 'video';
                              
                              return (
                                <Card
                                  key={file.id}
                                  size="small"
                                  hoverable
                                  style={{ 
                                    border: '1px solid #e8e8e8',
                                    borderRadius: '6px',
                                    overflow: 'hidden'
                                  }}
                                  styles={{ body: { padding: '6px' } }}
                                >
                                  <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    textAlign: 'center'
                                  }}>
                                    {/* 文件預覽 */}
                                    <div 
                                      style={{ 
                                        width: '100%', 
                                        height: '80px',
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: '4px',
                                        marginBottom: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        cursor: (isImage || isVideo) ? 'pointer' : 'default'
                                      }}
                                      onClick={() => {
                                        if (isImage || isVideo) {
                                          openLightbox(file, relatedAttachments);
                                        }
                                      }}
                                    >
                                      {isImage ? (
                                        <img
                                          src={file.filePath}
                                          alt={file.fileName}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '3px'
                                          }}
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : isVideo ? (
                                        <video
                                          src={file.filePath}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '3px'
                                          }}
                                          controls={false}
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : null}
                                      
                                      {/* 備用圖標 */}
                                      <div style={{ 
                                        display: isImage || isVideo ? 'none' : 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '100%',
                                        height: '100%',
                                        backgroundColor: '#f0f0f0'
                                      }}>
                                        {getFileIcon(file.fileName)}
                                      </div>
                                    </div>
                                    
                                    {/* 文件信息 */}
                                    <div style={{ width: '100%' }}>
                                      <Text 
                                        strong 
                                        style={{ 
                                          fontSize: '11px',
                                          display: 'block',
                                          marginBottom: '3px',
                                          wordBreak: 'break-all',
                                          lineHeight: '1.2'
                                        }}
                                        title={file.fileName}
                                      >
                                        {file.fileName.length > 15 ? 
                                          file.fileName.substring(0, 15) + '...' : 
                                          file.fileName
                                        }
                                      </Text>
                                      
                                      <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '10px',
                                        color: '#666',
                                        marginBottom: '4px'
                                      }}>
                                        <span>{formatFileSize(file.fileSize || 0)}</span>
                                        <Tag 
                                          color={isImage ? 'green' : isVideo ? 'blue' : 'default'}
                                          style={{ fontSize: '9px', margin: 0, padding: '0 4px' }}
                                        >
                                          {isImage ? '圖片' : isVideo ? '視頻' : '文件'}
                                        </Tag>
                                      </div>
                                      
                                      {file.createdAt && (
                                        <div style={{ 
                                          fontSize: '9px', 
                                          color: '#999',
                                          marginBottom: '6px'
                                        }}>
                                          {new Date(file.createdAt).toLocaleDateString('zh-TW')}
                                        </div>
                                      )}
                                      
                                      {/* 操作按鈕 */}
                                      <div style={{ 
                                        display: 'flex',
                                        gap: '3px',
                                        justifyContent: 'center'
                                      }}>
                                        <Button 
                                          type="text" 
                                          size="small"
                                          icon={<EyeOutlined />}
                                          onClick={() => {
                                            if (isImage || isVideo) {
                                              openLightbox(file, relatedAttachments);
                                            } else {
                                              window.open(file.filePath, '_blank');
                                            }
                                          }}
                                          style={{ fontSize: '9px', padding: '1px 4px', minWidth: 'auto' }}
                                        />
                                        <Button 
                                          type="text" 
                                          size="small"
                                          icon={<DownloadOutlined />}
                                          onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = file.filePath;
                                            link.download = file.fileName;
                                            link.click();
                                          }}
                                          style={{ fontSize: '9px', padding: '1px 4px', minWidth: 'auto' }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <Empty 
                          description="暫無相關附圖"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          style={{ margin: '20px 0' }}
                        />
                      )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <Empty description={t('pendingTasks.noFormData')} />
            </div>
          )}
        </Modal>
      </Content>
    </Layout>
  );
};

export default PendingTasksPage;
