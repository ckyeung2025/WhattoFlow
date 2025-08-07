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
  Spin, 
  Pagination,
  Card,
  Row,
  Col,
  Typography,
  Checkbox,
  Tooltip,
  Tabs,
  Drawer
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined, 
  DownloadOutlined, 
  CheckOutlined,
  PhoneOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SyncOutlined,
  CheckSquareOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';

// 1. 引入必要套件
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

// 根據 QR code 構建原始圖片路徑
const getOriginalImageUrl = (qrCodeText) => {
  if (!qrCodeText) return "";
  // 假設 QR code 就是資料夾名稱
  return `${getFullUrl(window.location.pathname)}/Customer/${qrCodeText}/Original/`;
};

const UnconfirmedPage = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('unconfirmed');
  const [data, setData] = useState([]);
  const [confirmedData, setConfirmedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmedLoading, setConfirmedLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [confirmedPagination, setConfirmedPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [searchText, setSearchText] = useState('');
  const [confirmedSearchText, setConfirmedSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [unconfirmedTotal, setUnconfirmedTotal] = useState(0);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);

  // 獲取未確認資料
  const fetchData = async (page = 1, pageSize = 10, searchTerm = '', sortBy, sortOrder) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/delivery/unconfirmed', {
        params: {
          page,
          pageSize,
          searchTerm,
          sortBy,
          sortOrder
        }
      });

      console.log('API Response:', response.data); // 調試用
      console.log('Data array length:', response.data?.data?.length);
      console.log('First 3 records upload dates:', response.data?.data?.slice(0, 3).map(item => item.uploadDate));
      console.log('Last 3 records upload dates:', response.data?.data?.slice(-3).map(item => item.uploadDate));

      if (response.data) {
        setData(response.data.data || []);
        setPagination({
          current: response.data.page,
          pageSize: response.data.pageSize,
          total: response.data.total
        });
      }
    } catch (error) {
      console.error('獲取資料失敗:', error);
      console.error('錯誤詳情:', error.response?.data);
      message.error(`獲取資料失敗: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 獲取已確認資料
  const fetchConfirmedData = async (page = 1, pageSize = 10, searchTerm = '', sortBy, sortOrder) => {
    setConfirmedLoading(true);
    try {
      const response = await axios.get('/api/delivery/confirmed', {
        params: {
          page,
          pageSize,
          searchTerm,
          sortBy,
          sortOrder
        }
      });

      console.log('Confirmed API Response:', response.data); // 調試用
      console.log('Confirmed data array length:', response.data?.data?.length);
      console.log('First 3 confirmed records upload dates:', response.data?.data?.slice(0, 3).map(item => item.uploadDate));
      console.log('Last 3 confirmed records upload dates:', response.data?.data?.slice(-3).map(item => item.uploadDate));

      if (response.data) {
        setConfirmedData(response.data.data || []);
        setConfirmedPagination({
          current: response.data.page,
          pageSize: response.data.pageSize,
          total: response.data.total
        });
      }
    } catch (error) {
      console.error('獲取已確認資料失敗:', error);
      console.error('錯誤詳情:', error.response?.data);
      message.error(`獲取已確認資料失敗: ${error.response?.data?.error || error.message}`);
    } finally {
      setConfirmedLoading(false);
    }
  };

  const fetchTabTotals = async () => {
    try {
      const unconfirmedRes = await axios.get('/api/delivery/unconfirmed', { params: { page: 1, pageSize: 1 } });
      setUnconfirmedTotal(unconfirmedRes.data.total || 0);
      const confirmedRes = await axios.get('/api/delivery/confirmed', { params: { page: 1, pageSize: 1 } });
      setConfirmedTotal(confirmedRes.data.total || 0);
    } catch (e) {
      setUnconfirmedTotal(0);
      setConfirmedTotal(0);
    }
  };

  useEffect(() => {
    fetchTabTotals();
    if (activeTab === 'unconfirmed') {
      fetchData();
    } else if (activeTab === 'confirmed') {
      fetchConfirmedData();
    }
  }, [activeTab]);

  // 搜尋
  const handleSearch = () => {
    fetchData(1, pagination.pageSize, searchText);
  };

  // 已確認資料搜尋
  const handleConfirmedSearch = () => {
    fetchConfirmedData(1, confirmedPagination.pageSize, confirmedSearchText);
  };

  // 修改 handleTableChange，接收 sorter 並傳給 fetchData
  const handleTableChange = (paginationInfo, filters, sorter) => {
    fetchData(
      paginationInfo.current,
      paginationInfo.pageSize,
      searchText,
      sorter.field,
      sorter.order === 'ascend' ? 'ASC' : sorter.order === 'descend' ? 'DESC' : undefined
    );
  };

  // 已確認資料分頁
  const handleConfirmedTableChange = (paginationInfo, filters, sorter) => {
    const sortBy = sorter?.field || 'uploadDate';
    const sortOrder = sorter?.order === 'ascend' ? 'ASC' : sorter?.order === 'descend' ? 'DESC' : undefined;
    fetchConfirmedData(
      paginationInfo.current,
      paginationInfo.pageSize,
      confirmedSearchText,
      sortBy,
      sortOrder
    );
  };

  // 確認單筆
  const handleConfirm = async (record) => {
    try {
      await axios.post(`/api/delivery/confirm/${record.id}`, {
        approvedBy: 'admin', // 這裡可以從登入用戶資訊取得
        remarks: ''
      });
      message.success(t('unsigned.confirmSuccess'));
      fetchData(pagination.current, pagination.pageSize, searchText);
      // 如果已確認 Tab 是開啟的，也重新載入已確認資料
      if (activeTab === 'confirmed') {
        fetchConfirmedData(confirmedPagination.current, confirmedPagination.pageSize, confirmedSearchText);
      }
      fetchTabTotals();
    } catch (error) {
      console.error('確認失敗:', error);
      message.error(`確認失敗: ${error.response?.data?.error || error.message}`);
    }
  };

  // 批量確認
  const handleBatchConfirm = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('請選擇要確認的記錄');
      return;
    }

    try {
      await axios.post('/api/delivery/confirm-multiple', {
        ids: selectedRowKeys,
        approvedBy: 'admin', // 這裡可以從登入用戶資訊取得
        remarks: ''
      });
      message.success(t('unsigned.confirmSuccess'));
      setSelectedRowKeys([]);
      fetchData(pagination.current, pagination.pageSize, searchText);
      // 如果已確認 Tab 是開啟的，也重新載入已確認資料
      if (activeTab === 'confirmed') {
        fetchConfirmedData(confirmedPagination.current, confirmedPagination.pageSize, confirmedSearchText);
      }
      fetchTabTotals();
    } catch (error) {
      console.error('批量確認失敗:', error);
      message.error(`批量確認失敗: ${error.response?.data?.error || error.message}`);
    }
  };

  // 預覽圖片
  const handlePreviewImage = (imageUrl) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  };

  // 下載 PDF
  const handleDownloadPdf = (pdfPath) => {
    if (pdfPath) {
      window.open(pdfPath, '_blank');
    } else {
      message.warning('PDF 檔案不存在');
    }
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

  // 表格欄位定義
  const columns = [
    // 操作欄位移到第一欄
    {
      title: t('unsigned.action') || '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleConfirm(record)}
            disabled={record.confirmed}
          >
            {t('unsigned.confirm') || '確認'}
          </Button>
        </Space>
      ),
    },
    // 狀態欄位移到第二欄
    {
      title: t('unsigned.status') || '狀態',
      dataIndex: 'confirmed',
      key: 'confirmed',
      sorter: true,
      width: 80,
      render: (confirmed) => (
        <Tag color={confirmed ? 'green' : 'red'}>
          {confirmed ? t('unsigned.confirmed') || '已確認' : t('unsigned.unconfirmed') || '未確認'}
        </Tag>
      ),
    },
    {
      title: t('unsigned.invoiceNo'),
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      sorter: true,
      width: 120,
      ellipsis: true,
    },
    {
      title: t('unsigned.customerNo') || '客戶編號',
      dataIndex: 'customerNo',
      key: 'customerNo',
      sorter: true,
      width: 100,
      ellipsis: true,
    },
    {
      title: t('unsigned.customerName'),
      dataIndex: 'customerName',
      key: 'customerName',
      sorter: true,
      width: 180,
      ellipsis: true,
    },
    {
      title: t('unsigned.customerTel'),
      dataIndex: 'contactTel1',
      key: 'contactTel1',
      sorter: true,
      width: 120,
      render: (text, record) => (
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
    {
      title: t('unsigned.previewImage'),
      dataIndex: 'originalImagePath',
      key: 'originalImagePath',
      width: 80,
      render: (text, record) => (
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
    {
      title: t('unsigned.downloadPdf'),
      dataIndex: 'pdfPath',
      key: 'pdfPath',
      width: 60,
      render: (text, record) => (
        <Tooltip title={t('unsigned.downloadPdf')}>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadPdf(getFullUrl(record.pdfPath))}
          />
        </Tooltip>
      ),
    },
    {
      title: t('unsigned.receiptDate') || '收據日期',
      dataIndex: 'receiptDate',
      key: 'receiptDate',
      sorter: true,
      width: 120,
      ellipsis: true,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: t('unsigned.uploadDate') || '上傳日期',
      dataIndex: 'uploadDate',
      key: 'uploadDate',
      sorter: true,
      width: 160,
      ellipsis: true,
      render: (date) => date ? new Date(date).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-',
    },
    {
      title: t('unsigned.remarks') || '備註',
      dataIndex: 'remarks',
      key: 'remarks',
      sorter: true,
      width: 100,
      ellipsis: true,
      render: (text) => (
        <Text style={{ fontSize: '12px' }}>
          {text ? text.substring(0, 15) + '...' : '-'}
        </Text>
      ),
    },
  ];

  // 3. 在 UnconfirmedPage 組件內部，columns 狀態化
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

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    getCheckboxProps: (record) => ({
      disabled: record.confirmed,
    }),
    // 不設置 type: 'radio'，預設就是多選
  };

  // 1. 新增 handleCancelConfirmConfirmedTab 函數
  const handleCancelConfirmConfirmedTab = async (record) => {
    try {
      await axios.post(`/api/delivery/cancel-confirm/${record.id}`);
      message.success('已取消確認，資料已退回送貨員已送貨');
      fetchConfirmedData(confirmedPagination.current, confirmedPagination.pageSize, confirmedSearchText);
      fetchTabTotals();
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
          onClick={() => handleCancelConfirmConfirmedTab(record)}
        >
          取消確認
        </Button>
      ),
    },
    // 狀態欄位移到第二欄
    {
      title: t('unsigned.status') || '狀態',
      dataIndex: 'confirmed',
      key: 'confirmed',
      sorter: true,
      width: 80,
      render: (confirmed) => (
        <Tag color={confirmed ? 'green' : 'red'}>
          {confirmed ? t('unsigned.confirmed') || '已確認' : t('unsigned.unconfirmed') || '未確認'}
        </Tag>
      ),
    },
    {
      title: t('unsigned.invoiceNo'),
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      sorter: true,
      width: 120,
      ellipsis: true,
    },
    {
      title: t('unsigned.customerNo') || '客戶編號',
      dataIndex: 'customerNo',
      key: 'customerNo',
      sorter: true,
      width: 100,
      ellipsis: true,
    },
    {
      title: t('unsigned.customerName'),
      dataIndex: 'customerName',
      key: 'customerName',
      sorter: true,
      width: 180,
      ellipsis: true,
    },
    {
      title: t('unsigned.customerTel'),
      dataIndex: 'contactTel1',
      key: 'contactTel1',
      sorter: true,
      width: 120,
      render: (text, record) => (
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
    {
      title: t('unsigned.previewImage'),
      dataIndex: 'originalImagePath',
      key: 'originalImagePath',
      width: 80,
      render: (text, record) => (
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
    {
      title: t('unsigned.downloadPdf'),
      dataIndex: 'pdfPath',
      key: 'pdfPath',
      width: 60,
      render: (text, record) => (
        <Tooltip title={t('unsigned.downloadPdf')}>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadPdf(getFullUrl(record.pdfPath))}
          />
        </Tooltip>
      ),
    },
    {
      title: t('unsigned.receiptDate') || '收據日期',
      dataIndex: 'receiptDate',
      key: 'receiptDate',
      sorter: true,
      width: 120,
      ellipsis: true,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: t('unsigned.uploadDate') || '上傳日期',
      dataIndex: 'uploadDate',
      key: 'uploadDate',
      sorter: true,
      width: 160,
      ellipsis: true,
      render: (date) => date ? new Date(date).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-',
    },
    {
      title: t('unsigned.remarks') || '備註',
      dataIndex: 'remarks',
      key: 'remarks',
      sorter: true,
      width: 100,
      ellipsis: true,
      render: (text) => (
        <Text style={{ fontSize: '12px' }}>
          {text ? text.substring(0, 15) + '...' : '-'}
        </Text>
      ),
    },
  ];

  // confirmed tab 專用 resizable columns 狀態
  const [resizableConfirmedColumns, setResizableConfirmedColumns] = useState(
    confirmedColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
  );
  const handleConfirmedResize = index => (e, { size }) => {
    const nextColumns = [...resizableConfirmedColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setResizableConfirmedColumns(nextColumns);
  };
  const confirmedMergedColumns = resizableConfirmedColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handleConfirmedResize(index),
    }),
  }));

  // 3. confirmed tab Table 用 confirmedColumns
  const confirmedTableComponents = {
    header: {
      cell: ResizableTitle,
    },
  };

  return (
    <div style={{ padding: '8px' }}>
      <Card bodyStyle={{ padding: '12px 12px 8px 12px' }} style={{ boxShadow: 'none', borderRadius: 8, margin: 0 }}>
        <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>{t('unsigned.title') || '未簽收送貨單管理'}</Title>
          </Col>
        </Row>

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'unconfirmed',
              label: `${t('menu.unsigned')}(${unconfirmedTotal})`,
              children: (
                <>
                  {/* 搜尋和篩選 */}
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Input
                        placeholder="搜尋發票號、客戶編號、客戶名稱..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onPressEnter={handleSearch}
                        suffix={<SearchOutlined />}
                      />
                    </Col>
                    <Col>
                      <Tooltip title="搜尋">
                        <Button type="primary" icon={<SearchOutlined />} aria-label="搜尋" onClick={handleSearch} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
                      </Tooltip>
                    </Col>
                    <Col>
                      <Tooltip title="重置">
                        <Button icon={<ReloadOutlined />} aria-label="重置" onClick={() => {
                          setSearchText('');
                          fetchData(1, pagination.pageSize, '', '', '');
                        }} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
                      </Tooltip>
                    </Col>
                    <Col>
                      <Tooltip title="刷新">
                        <Button icon={<SyncOutlined />} aria-label="刷新" onClick={() => fetchData(pagination.current, pagination.pageSize, searchText, '', '')} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
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

                  {/* 表格 */}
                  <Table
                    components={components}
                    columns={mergedColumns}
                    dataSource={data}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    rowSelection={rowSelection}
                    onChange={handleTableChange}
                    size="small"
                    style={{ width: '100%' }}
                  />

                  {/* 分頁 */}
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <Pagination
                      current={pagination.current}
                      pageSize={pagination.pageSize}
                      total={pagination.total}
                      showSizeChanger
                      showTotal={(total, range) => `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`}
                      onChange={(page, pageSize) => fetchData(page, pageSize, searchText, '', '')}
                      onShowSizeChange={(current, size) => fetchData(1, size, searchText, '', '')}
                    />
                  </div>
                </>
              )
            },
            {
              key: 'confirmed',
              label: `${t('unsigned.manualReview')}(${confirmedTotal})`,
              children: (
                <>
                  {/* 已確認資料搜尋和篩選 */}
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
                          fetchConfirmedData(1, confirmedPagination.pageSize, '');
                        }} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
                      </Tooltip>
                    </Col>
                    <Col>
                      <Tooltip title="刷新">
                        <Button icon={<SyncOutlined />} aria-label="刷新" onClick={() => fetchConfirmedData(confirmedPagination.current, confirmedPagination.pageSize, confirmedSearchText)} size="middle" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
                      </Tooltip>
                    </Col>
                  </Row>

                  {/* 已確認資料表格 */}
                  <Table
                    components={confirmedTableComponents}
                    columns={confirmedMergedColumns}
                    dataSource={confirmedData}
                    rowKey="id"
                    loading={confirmedLoading}
                    pagination={false}
                    onChange={handleConfirmedTableChange}
                    size="small"
                    style={{ width: '100%' }}
                  />

                  {/* 已確認資料分頁 */}
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <Pagination
                      current={confirmedPagination.current}
                      pageSize={confirmedPagination.pageSize}
                      total={confirmedPagination.total}
                      showSizeChanger
                      showTotal={(total, range) => `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`}
                      onChange={(page, pageSize) => fetchConfirmedData(page, pageSize, confirmedSearchText)}
                      onShowSizeChange={(current, size) => fetchConfirmedData(1, size, confirmedSearchText)}
                    />
                  </div>
                </>
              )
            }
          ]}
        />

        {/* 圖片預覽 Modal */}
        <Modal
          title="圖片預覽"
          open={imageModalVisible}
          onCancel={() => setImageModalVisible(false)}
          footer={null}
          width={800}
        >
          <Image
            src={selectedImage}
            alt="預覽圖片"
            style={{ width: '100%' }}
          />
        </Modal>

        {/* Drawer for gallery */}
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

export default UnconfirmedPage; 