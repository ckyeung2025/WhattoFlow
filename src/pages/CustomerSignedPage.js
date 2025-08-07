import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Input, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  Image, 
  message, 
  Pagination,
  Card,
  Row,
  Col,
  Typography,
  Tooltip,
  Tabs,
  Drawer
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined, 
  DownloadOutlined,
  PhoneOutlined,
  ReloadOutlined,
  SyncOutlined,
  CheckSquareOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import ImageGallery from 'react-image-gallery';
import "react-image-gallery/styles/css/image-gallery.css";

// 2. 定義 ResizableTitle 元件（加上 minConstraints 允許最小寬度 30px）
const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;
  if (!width) {
    return <th {...restProps} />;
  }
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[30, 0]}
      handle={
        <span
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '8px',
            cursor: 'col-resize',
            zIndex: 1,
            userSelect: 'none',
          }}
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

const { Title, Text } = Typography;

const getFullUrl = (path) => {
  if (!path) return "";
  const fixedPath = path.replace(/\\/g, '/');
  if (fixedPath.startsWith("/")) return fixedPath;
  return "/" + fixedPath;
};

const CustomerSignedPage = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingData, setPendingData] = useState([]);
  const [confirmedData, setConfirmedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingPagination, setPendingPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [confirmedPagination, setConfirmedPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [pendingSearchText, setPendingSearchText] = useState('');
  const [confirmedSearchText, setConfirmedSearchText] = useState('');
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [confirmedTotal, setConfirmedTotal] = useState(0);

  // 查詢 uploaded_by = 'Customer' 且 confirmed 狀態
  const fetchPendingData = async (page = 1, pageSize = 10, searchTerm = '', sortBy = 'uploadDate', sortOrder = 'desc') => {
    setLoading(true);
    try {
      const response = await axios.get('/api/delivery/customer-pending', {
        params: { page, pageSize, searchTerm, sortBy, sortOrder }
      });
      if (response.data && response.data.data) {
        setPendingData(response.data.data);
        setPendingPagination({ current: response.data.page, pageSize: response.data.pageSize, total: response.data.total });
      }
    } catch (error) {
      message.error(`獲取資料失敗: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfirmedData = async (page = 1, pageSize = 10, searchTerm = '', sortBy = 'uploadDate', sortOrder = 'desc') => {
    setLoading(true);
    try {
      const response = await axios.get('/api/delivery/customer-confirmed', {
        params: { page, pageSize, searchTerm, sortBy, sortOrder }
      });
      if (response.data && response.data.data) {
        setConfirmedData(response.data.data);
        setConfirmedPagination({ current: response.data.page, pageSize: response.data.pageSize, total: response.data.total });
      }
    } catch (error) {
      message.error(`獲取資料失敗: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchTabTotals = async () => {
    try {
      const pendingRes = await axios.get('/api/delivery/customer-pending', { params: { page: 1, pageSize: 1 } });
      setPendingTotal(pendingRes.data.total || 0);
      const confirmedRes = await axios.get('/api/delivery/customer-confirmed', { params: { page: 1, pageSize: 1 } });
      setConfirmedTotal(confirmedRes.data.total || 0);
    } catch (e) {
      setPendingTotal(0);
      setConfirmedTotal(0);
    }
  };

  // 排序狀態
  const [pendingSort, setPendingSort] = useState({ sortBy: 'uploadDate', sortOrder: 'desc' });
  const [confirmedSort, setConfirmedSort] = useState({ sortBy: 'uploadDate', sortOrder: 'desc' });

  useEffect(() => {
    fetchTabTotals();
    if (activeTab === 'pending') {
      fetchPendingData();
    } else {
      fetchConfirmedData();
    }
  }, [activeTab]);

  const handlePendingSearch = () => {
    fetchPendingData(1, pendingPagination.pageSize, pendingSearchText);
  };
  const handleConfirmedSearch = () => {
    fetchConfirmedData(1, confirmedPagination.pageSize, confirmedSearchText);
  };
  const handlePendingTableChange = (pagination, filters, sorter) => {
    const sortBy = sorter.field || 'uploadDate';
    const sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
    setPendingSort({ sortBy, sortOrder });
    fetchPendingData(pagination.current, pagination.pageSize, pendingSearchText, sortBy, sortOrder);
  };
  const handleConfirmedTableChange = (pagination, filters, sorter) => {
    const sortBy = sorter.field || 'uploadDate';
    const sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
    setConfirmedSort({ sortBy, sortOrder });
    fetchConfirmedData(pagination.current, pagination.pageSize, confirmedSearchText, sortBy, sortOrder);
  };
  const handlePreviewGallery = async (record) => {
    const customerNo = record.customerNo;
    const invoiceNo = record.invoiceNo;
    // receiptDate 需轉為 yyyyMMddHHmm
    const receiptDate = record.receiptDate ? new Date(record.receiptDate) : new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const groupTime = `${receiptDate.getFullYear()}${pad(receiptDate.getMonth()+1)}${pad(receiptDate.getDate())}${pad(receiptDate.getHours())}${pad(receiptDate.getMinutes())}`;
    const groupName = `DN_${customerNo}_${invoiceNo}_${groupTime}`;
    const basePath = `/Uploads/Customer/${customerNo}/Original/${groupName}/`;
    try {
      const res = await axios.get('/api/delivery/images', {
        params: { customerNo, invoiceNo, groupTime }
      });
      const images = (res.data.images || []).map(name => ({
        original: basePath + name,
        thumbnail: basePath + name
      }));
      setGalleryImages(images);
      setGalleryVisible(true);
    } catch (e) {
      setGalleryImages([]);
      setGalleryVisible(true);
    }
  };
  const handleDownloadPdf = (pdfPath) => {
    if (pdfPath) {
      window.open(pdfPath, '_blank');
    } else {
      message.warning('PDF 檔案不存在');
    }
  };

  // 1. 將 columns 的 width 全部改為數字
  const columns = [
    // 操作欄位移到第一欄
    { title: '操作', key: 'action', width: 100, render: (_, record) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleConfirm(record)}
        >
          確認
        </Button>
      ),
    },
    // 狀態欄位移到第二欄
    { title: t('unsigned.status') || '狀態', dataIndex: 'confirmed', key: 'confirmed', sorter: true, width: 80, render: (confirmed) => (
        <Tag color={confirmed ? 'green' : 'red'}>
          {confirmed ? t('unsigned.confirmed') || '已確認' : t('unsigned.unconfirmed') || '未確認'}
        </Tag>
      ),
    },
    { title: t('unsigned.invoiceNo'), dataIndex: 'invoiceNo', key: 'invoiceNo', sorter: true, width: 120, ellipsis: true },
    { title: t('unsigned.customerNo') || '客戶編號', dataIndex: 'customerNo', key: 'customerNo', sorter: true, width: 100, ellipsis: true },
    { title: t('unsigned.customerName'), dataIndex: 'customerName', key: 'customerName', sorter: true, width: 180, ellipsis: true },
    { title: t('unsigned.customerTel'), dataIndex: 'contactTel1', key: 'contactTel1', sorter: true, width: 120, render: (text, record) => (
        <Space direction="vertical" size="small">
          <Text copyable={{ text: record.contactTel1 }}>
            <PhoneOutlined /> {record.contactTel1}
          </Text>
          {record.contactTel2 && (
            <Text copyable={{ text: record.contactTel2 }}>
              <PhoneOutlined /> {record.contactTel2}
            </Text>
          )}
        </Space>
      ),
    },
    // 預覽圖片不加 sorter
    { title: t('unsigned.previewImage'), dataIndex: 'originalImagePath', key: 'originalImagePath', width: 80, render: (text, record) => (
        <Space>
          {record.originalImagePath ? (
            <Tooltip title={t('unsigned.previewImage')}>
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => handlePreviewGallery(record)}
              />
            </Tooltip>
          ) : (
            <Text type="secondary">{t('unsigned.noData') || '無圖片'}</Text>
          )}
        </Space>
      ),
    },
    // 下載 PDF 不加 sorter
    { title: t('unsigned.downloadPdf'), dataIndex: 'pdfPath', key: 'pdfPath', width: 60, render: (text, record) => (
        <Tooltip title={t('unsigned.downloadPdf')}>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadPdf(getFullUrl(record.pdfPath))}
          />
        </Tooltip>
      ),
    },
    { title: t('unsigned.receiptDate') || '收據日期', dataIndex: 'receiptDate', key: 'receiptDate', sorter: true, width: 120, ellipsis: true, render: (date) => date ? new Date(date).toLocaleDateString() : '-' },
    { title: t('unsigned.uploadDate') || '上傳日期', dataIndex: 'uploadDate', key: 'uploadDate', sorter: true, width: 160, ellipsis: true, render: (date) => date ? new Date(date).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-' },
    { title: t('unsigned.remarks') || '備註', dataIndex: 'remarks', key: 'remarks', sorter: true, width: 100, ellipsis: true, render: (text) => (
        <Text style={{ fontSize: '12px' }}>
          {text ? text.substring(0, 15) + '...' : '-'}
        </Text>
      ),
    },
  ];

  // 新增：pending 專用 columns，最後加操作欄
  const pendingColumns = [
    ...columns,
  ];

  // 3. 在 CustomerSignedPage 組件內部，columns 狀態化
  const [resizableColumns, setResizableColumns] = useState(
    columns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
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

  // 1. 新增 handleCancelConfirm 函數
  const handleCancelConfirm = async (record) => {
    try {
      await axios.post(`/api/delivery/cancel-confirm/${record.id}`);
      message.success('已取消確認，資料已退回送貨員已送貨');
      fetchConfirmedData(confirmedPagination.current, confirmedPagination.pageSize, confirmedSearchText, confirmedSort.sortBy, confirmedSort.sortOrder);
      fetchTabTotals(); // Refresh totals
    } catch (error) {
      message.error(`取消確認失敗: ${error.response?.data?.error || error.message}`);
    }
  };

  // 2. 產生 confirmed tab 專用 columns，最後加上操作欄
  const confirmedColumns = [
    // 操作欄位移到第一欄
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="primary"
          danger
          size="small"
          onClick={() => handleCancelConfirm(record)}
        >
          取消確認
        </Button>
      ),
    },
    // 狀態欄位移到第二欄
    { title: t('unsigned.status') || '狀態', dataIndex: 'confirmed', key: 'confirmed', sorter: true, width: 80, render: (confirmed) => (
        <Tag color={confirmed ? 'green' : 'red'}>
          {confirmed ? t('unsigned.confirmed') || '已確認' : t('unsigned.unconfirmed') || '未確認'}
        </Tag>
      ),
    },
    { title: t('unsigned.invoiceNo'), dataIndex: 'invoiceNo', key: 'invoiceNo', sorter: true, width: 120, ellipsis: true },
    { title: t('unsigned.customerNo') || '客戶編號', dataIndex: 'customerNo', key: 'customerNo', sorter: true, width: 100, ellipsis: true },
    { title: t('unsigned.customerName'), dataIndex: 'customerName', key: 'customerName', sorter: true, width: 180, ellipsis: true },
    { title: t('unsigned.customerTel'), dataIndex: 'contactTel1', key: 'contactTel1', sorter: true, width: 120, render: (text, record) => (
        <Space direction="vertical" size="small">
          <Text copyable={{ text: record.contactTel1 }}>
            <PhoneOutlined /> {record.contactTel1}
          </Text>
          {record.contactTel2 && (
            <Text copyable={{ text: record.contactTel2 }}>
              <PhoneOutlined /> {record.contactTel2}
            </Text>
          )}
        </Space>
      ),
    },
    // 預覽圖片不加 sorter
    { title: t('unsigned.previewImage'), dataIndex: 'originalImagePath', key: 'originalImagePath', width: 80, render: (text, record) => (
        <Space>
          {record.originalImagePath ? (
            <Tooltip title={t('unsigned.previewImage')}>
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => handlePreviewGallery(record)}
              />
            </Tooltip>
          ) : (
            <Text type="secondary">{t('unsigned.noData') || '無圖片'}</Text>
          )}
        </Space>
      ),
    },
    // 下載 PDF 不加 sorter
    { title: t('unsigned.downloadPdf'), dataIndex: 'pdfPath', key: 'pdfPath', width: 60, render: (text, record) => (
        <Tooltip title={t('unsigned.downloadPdf')}>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadPdf(getFullUrl(record.pdfPath))}
          />
        </Tooltip>
      ),
    },
    { title: t('unsigned.receiptDate') || '收據日期', dataIndex: 'receiptDate', key: 'receiptDate', sorter: true, width: 120, ellipsis: true, render: (date) => date ? new Date(date).toLocaleDateString() : '-' },
    { title: t('unsigned.uploadDate') || '上傳日期', dataIndex: 'uploadDate', key: 'uploadDate', sorter: true, width: 160, ellipsis: true, render: (date) => date ? new Date(date).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-' },
    { title: t('unsigned.remarks') || '備註', dataIndex: 'remarks', key: 'remarks', sorter: true, width: 100, ellipsis: true, render: (text) => (
        <Text style={{ fontSize: '12px' }}>
          {text ? text.substring(0, 15) + '...' : '-'}
        </Text>
      ),
    },
  ];

  // 3. confirmed tab Table 用 confirmedColumns
  const [resizableConfirmedColumns, setResizableConfirmedColumns] = useState(
    confirmedColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
  );

  const handleConfirmedResize = index => (e, { size }) => {
    const nextColumns = [...resizableConfirmedColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setResizableConfirmedColumns(nextColumns);
  };

  const mergedConfirmedColumns = resizableConfirmedColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handleConfirmedResize(index),
    }),
  }));

  const componentsConfirmed = {
    header: {
      cell: ResizableTitle,
    },
  };

  // pending tab rowSelection 狀態
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  // 單筆確認
  const handleConfirm = async (record) => {
    try {
      await axios.post(`/api/delivery/confirm/${record.id}`, {
        approvedBy: 'admin', // 可改為當前登入者
        remarks: ''
      });
      message.success('已確認');
      fetchPendingData(pendingPagination.current, pendingPagination.pageSize, pendingSearchText, pendingSort.sortBy, pendingSort.sortOrder);
      setSelectedRowKeys(selectedRowKeys.filter(key => key !== record.id));
      fetchTabTotals(); // Refresh totals
    } catch (error) {
      message.error(`確認失敗: ${error.response?.data?.error || error.message}`);
    }
  };

  // 批量確認
  const handleBatchConfirm = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      await axios.post('/api/delivery/batch-confirm', {
        ids: selectedRowKeys,
        approvedBy: 'admin', // 可改為當前登入者
        remarks: ''
      });
      message.success('批量確認成功');
      fetchPendingData(pendingPagination.current, pendingPagination.pageSize, pendingSearchText, pendingSort.sortBy, pendingSort.sortOrder);
      setSelectedRowKeys([]);
      fetchTabTotals(); // Refresh totals
    } catch (error) {
      message.error(`批量確認失敗: ${error.response?.data?.error || error.message}`);
    }
  };

  // pending 專用 columns resizable
  const [resizablePendingColumns, setResizablePendingColumns] = useState(
    pendingColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
  );
  const handlePendingResize = index => (e, { size }) => {
    const nextColumns = [...resizablePendingColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setResizablePendingColumns(nextColumns);
  };
  const pendingMergedColumns = resizablePendingColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handlePendingResize(index),
    }),
  }));

  return (
    <div style={{ padding: '8px' }}>
      <Card bodyStyle={{ padding: '12px 12px 8px 12px' }} style={{ boxShadow: 'none', borderRadius: 8, margin: 0 }}>
        <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>{t('menu.customerSigned') || '客戶已簽收'}</Title>
          </Col>
        </Row>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'pending',
              label: `${t('unsigned.customerSignedPending')}(${pendingTotal})`,
              children: (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Input
                        placeholder="搜尋發票號、客戶編號、客戶名稱..."
                        value={pendingSearchText}
                        onChange={(e) => setPendingSearchText(e.target.value)}
                        onPressEnter={handlePendingSearch}
                        suffix={<SearchOutlined />}
                      />
                    </Col>
                    <Col>
                      <Tooltip title="搜尋">
                        <Button type="primary" icon={<SearchOutlined />} aria-label="搜尋" onClick={handlePendingSearch} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
                      </Tooltip>
                    </Col>
                    <Col>
                      <Tooltip title="重置">
                        <Button icon={<ReloadOutlined />} aria-label="重置" onClick={() => {
                          setPendingSearchText('');
                          fetchPendingData(1, pendingPagination.pageSize, '', pendingSort.sortBy, pendingSort.sortOrder);
                        }} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
                      </Tooltip>
                    </Col>
                    <Col>
                      <Tooltip title="刷新">
                        <Button icon={<SyncOutlined />} aria-label="刷新" onClick={() => fetchPendingData(pendingPagination.current, pendingPagination.pageSize, pendingSearchText, pendingSort.sortBy, pendingSort.sortOrder)} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
                      </Tooltip>
                    </Col>
                    <Col>
                      <Tooltip title="批量確認">
                        <Button
                          type="primary"
                          icon={<CheckSquareOutlined />}
                          aria-label="批量確認"
                          onClick={handleBatchConfirm}
                          disabled={selectedRowKeys.length === 0}
                          size="middle"
                          style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        />
                      </Tooltip>
                    </Col>
                  </Row>
                  <Table
                    components={components}
                    columns={pendingMergedColumns}
                    dataSource={pendingData}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ width: '100%' }}
                    onChange={handlePendingTableChange}
                    sortDirections={['ascend', 'descend']}
                    rowSelection={rowSelection}
                  />
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <Pagination
                      current={pendingPagination.current}
                      pageSize={pendingPagination.pageSize}
                      total={pendingPagination.total}
                      showSizeChanger
                      showTotal={(total, range) => `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`}
                      onChange={(page, pageSize) => fetchPendingData(page, pageSize, pendingSearchText, pendingSort.sortBy, pendingSort.sortOrder)}
                      onShowSizeChange={(current, size) => fetchPendingData(1, size, pendingSearchText, pendingSort.sortBy, pendingSort.sortOrder)}
                    />
                  </div>
                </>
              )
            },
            {
              key: 'confirmed',
              label: `${t('unsigned.customerSignedConfirmed')}(${confirmedTotal})`,
              children: (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Input
                        placeholder="搜尋發票號、客戶編號、客戶名稱..."
                        value={confirmedSearchText}
                        onChange={(e) => setConfirmedSearchText(e.target.value)}
                        onPressEnter={handleConfirmedSearch}
                        suffix={<SearchOutlined />}
                      />
                    </Col>
                    <Col>
                      <Tooltip title="搜尋">
                        <Button type="primary" icon={<SearchOutlined />} aria-label="搜尋" onClick={handleConfirmedSearch} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
                      </Tooltip>
                    </Col>
                    <Col>
                      <Tooltip title="重置">
                        <Button icon={<ReloadOutlined />} aria-label="重置" onClick={() => {
                          setConfirmedSearchText('');
                          fetchConfirmedData(1, confirmedPagination.pageSize, '', confirmedSort.sortBy, confirmedSort.sortOrder);
                        }} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
                      </Tooltip>
                    </Col>
                    <Col>
                      <Tooltip title="刷新">
                        <Button icon={<SyncOutlined />} aria-label="刷新" onClick={() => fetchConfirmedData(confirmedPagination.current, confirmedPagination.pageSize, confirmedSearchText, confirmedSort.sortBy, confirmedSort.sortOrder)} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
                      </Tooltip>
                    </Col>
                  </Row>
                  <Table
                    components={componentsConfirmed}
                    columns={mergedConfirmedColumns}
                    dataSource={confirmedData}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ width: '100%' }}
                    onChange={handleConfirmedTableChange}
                    sortDirections={['ascend', 'descend']}
                    defaultSortOrder={confirmedSort.sortOrder === 'asc' ? 'ascend' : 'descend'}
                  />
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <Pagination
                      current={confirmedPagination.current}
                      pageSize={confirmedPagination.pageSize}
                      total={confirmedPagination.total}
                      showSizeChanger
                      showTotal={(total, range) => `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`}
                      onChange={(page, pageSize) => fetchConfirmedData(page, pageSize, confirmedSearchText, confirmedSort.sortBy, confirmedSort.sortOrder)}
                      onShowSizeChange={(current, size) => fetchConfirmedData(1, size, confirmedSearchText, confirmedSort.sortBy, confirmedSort.sortOrder)}
                    />
                  </div>
                </>
              )
            }
          ]}
        />
        <Drawer
          title="圖片預覽"
          placement="right"
          width={500}
          onClose={() => setGalleryVisible(false)}
          open={galleryVisible}
          mask={false}
        >
          <ImageGallery
            items={galleryImages}
            showPlayButton={false}
            showFullscreenButton={true}
            showThumbnails={true}
            showIndex={true}
          />
        </Drawer>
      </Card>
    </div>
  );
};

export default CustomerSignedPage; 