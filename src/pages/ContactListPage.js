import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Form, 
  Input, 
  Select, 
  Card, 
  Tag, 
  Modal, 
  message, 
  Space, 
  Typography, 
  Row, 
  Col,
  Dropdown,
  Pagination,
  Alert,
  Spin,
  Checkbox,
  Tooltip
} from 'antd';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { 
  PlusOutlined, 
  SearchOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UserOutlined, 
  TagOutlined, 
  FilterOutlined,
  DownloadOutlined,
  UploadOutlined,
  MoreOutlined,
  PhoneOutlined,
  MailOutlined,
  BankOutlined
} from '@ant-design/icons';
import { contactApi, broadcastGroupApi, hashtagApi } from '../services/contactApi';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import TimezoneUtils from '../utils/timezoneUtils';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// ResizableTitle 組件
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

const ContactListPage = () => {
  console.log('🚀 ContactListPage 組件已載入！');
  
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  console.log('✅ useNavigate 成功');
  console.log('✅ useLanguage 成功，t 函數:', typeof t);
  console.log('🔧 組件初始化完成');

  // 用戶時區偏移狀態
  const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8');
  
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // 分頁和搜尋
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedHashtag, setSelectedHashtag] = useState('');
  
  // 排序狀態
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  
  // 列寬度管理
  const [columnWidths, setColumnWidths] = useState({
    select: 50,
    name: 200,
    contact: 200,
    company: 180,
    broadcastGroup: 150,
    hashtags: 200,
    createdAt: 150,
    updatedAt: 150,
    actions: 100
  });
  
  // 群組和標籤選項
  const [groups, setGroups] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  
  // 選中的聯絡人
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);

  // 載入聯絡人列表
  const loadContacts = async () => {
    console.log('=== 開始載入聯絡人列表 ===');
    setLoading(true);
    setError(null);
    
    // 檢查認證狀態
    const token = localStorage.getItem('token');
    console.log('ContactListPage - Token status:', token ? 'Found' : 'Not found');
    if (!token) {
      setError('請先登入以訪問聯絡人管理功能');
      setLoading(false);
      return;
    }
    
    try {
      const params = {
        page: currentPage,
        pageSize: pageSize,
        search: searchTerm || undefined,
        broadcastGroupId: selectedGroup || undefined,
        hashtagFilter: selectedHashtag || undefined,
        sortField: sortField || undefined,
        sortOrder: sortOrder || undefined
      };
      
      console.log('API 請求參數:', params);
      console.log('發送請求到:', '/api/contactlist');
      
      const response = await contactApi.getContacts(params);
      console.log('API 響應:', response);
      
      const contacts = response.contacts || [];
      const totalCount = response.totalCount || 0;
      
      console.log('解析後的聯絡人數量:', contacts.length);
      console.log('總數量:', totalCount);
      console.log('聯絡人數據:', contacts);
      
      // 調試聯絡人數據
      contacts.forEach((contact, index) => {
        console.log(`聯絡人 ${index + 1} (${contact.name}):`, {
          whatsAppNumber: contact.whatsAppNumber,
          email: contact.email,
          companyName: contact.companyName,
          broadcastGroupId: contact.broadcastGroupId,
          broadcastGroup: contact.broadcastGroup,
          hasGroupData: !!contact.broadcastGroup,
          groupName: contact.broadcastGroup?.name,
          groupColor: contact.broadcastGroup?.color
        });
      });
      
      setContacts(contacts);
      setTotalCount(totalCount);
      
      console.log('=== 聯絡人列表載入完成 ===');
    } catch (err) {
      console.error('ContactListPage - Load contacts error:', err);
      console.error('錯誤詳情:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      });
      
      if (err.response?.status === 401) {
        setError('認證失敗，請重新登入');
        // 可以選擇重定向到登入頁面
        // navigate('/login');
      } else {
        setError(t('contactList.loadError') + ': ' + (err.response?.data || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  // 載入群組和標籤
  const loadGroupsAndHashtags = async () => {
    console.log('=== 開始載入群組和標籤 ===');
    
    // 檢查認證狀態
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('ContactListPage - No token found, skipping groups and hashtags load');
      return;
    }
    
    try {
      console.log('發送群組請求到:', '/api/contactlist/groups');
      console.log('發送標籤請求到:', '/api/contactlist/hashtags');
      
      const [groupsResponse, hashtagsResponse] = await Promise.all([
        broadcastGroupApi.getGroups(),
        hashtagApi.getHashtags()
      ]);
      
      console.log('群組 API 響應:', groupsResponse);
      console.log('標籤 API 響應:', hashtagsResponse);
      
      // 處理新的 API 響應格式
      const groups = groupsResponse?.data || groupsResponse || [];
      const hashtags = hashtagsResponse?.data || hashtagsResponse || [];
      
      console.log('解析後的群組數量:', groups.length);
      console.log('解析後的標籤數量:', hashtags.length);
      console.log('群組數據:', groups);
      console.log('標籤數據:', hashtags);
      
      setGroups(groups);
      setHashtags(hashtags);
      
      console.log('=== 群組和標籤載入完成 ===');
    } catch (err) {
      console.error('載入群組和標籤失敗：', err);
      console.error('錯誤詳情:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      });
      
      if (err.response?.status === 401) {
        console.error('認證失敗，無法載入群組和標籤');
      }
    }
  };

  // 初始載入
  useEffect(() => {
    console.log('🔥🔥🔥 useEffect 觸發！🔥🔥🔥');
    console.log('=== ContactListPage 載入檢查 ===');
    console.log('依賴項變化:', { currentPage, searchTerm, selectedGroup, selectedHashtag, sortField, sortOrder });
    console.log('🔥🔥🔥 useEffect 開始執行 🔥🔥🔥');
    
    // 檢查用戶是否已登入
    const token = localStorage.getItem('token');
    const userInfo = localStorage.getItem('userInfo');
    
    console.log('Token 狀態:', token ? 'Found' : 'Not found');
    console.log('UserInfo 狀態:', userInfo ? 'Found' : 'Not found');
    
    if (token) {
      console.log('Token 長度:', token.length);
      console.log('Token 前50字符:', token.substring(0, 50) + '...');
      // 嘗試解析 JWT token 來檢查是否有效
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log('Token payload:', payload);
          console.log('Token exp:', new Date(payload.exp * 1000));
          console.log('Token is expired:', payload.exp * 1000 < Date.now());
          console.log('Token company_id:', payload.company_id);
        } else {
          console.error('Token 格式錯誤，不是有效的 JWT');
        }
      } catch (e) {
        console.error('Token 解析錯誤:', e);
      }
    }
    
    if (userInfo) {
      try {
        const parsedUserInfo = JSON.parse(userInfo);
        console.log('UserInfo 解析成功:', parsedUserInfo);
        console.log('UserInfo company_id:', parsedUserInfo.company_id);
      } catch (e) {
        console.error('UserInfo 解析錯誤:', e);
      }
    }
    
    if (token && userInfo) {
      console.log('✅ 用戶已認證，開始載入數據');
      console.log('📞 調用 loadContacts()');
      loadContacts();
      console.log('🏷️ 調用 loadGroupsAndHashtags()');
      loadGroupsAndHashtags();
    } else {
      console.warn('❌ 用戶未認證，顯示錯誤訊息');
      console.log('Token 存在:', !!token);
      console.log('UserInfo 存在:', !!userInfo);
      setError('請先登入以訪問聯絡人管理功能');
    }
    
    console.log('=== ContactListPage 載入檢查結束 ===');
  }, [currentPage, searchTerm, selectedGroup, selectedHashtag, sortField, sortOrder]);

  // 獲取用戶時區設置
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (userInfo.timezone) {
      setUserTimezoneOffset(userInfo.timezone);
    }
  }, []);

  // 搜尋處理
  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // 重置篩選
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedGroup('');
    setSelectedHashtag('');
    setCurrentPage(1);
  };

  // 刪除聯絡人
  const handleDeleteContact = async (contactId) => {
    try {
      await contactApi.deleteContact(contactId);
      message.success(t('contactList.deleteSuccess'));
      loadContacts();
      setShowDeleteModal(false);
      setContactToDelete(null);
    } catch (err) {
      message.error(t('contactList.deleteError') + ': ' + (err.response?.data || err.message));
    }
  };

  // 批量刪除
  const handleBatchDelete = async () => {
    try {
      await Promise.all(selectedContacts.map(id => contactApi.deleteContact(id)));
      message.success(t('contactList.batchDeleteSuccess', { count: selectedContacts.length }));
      setSelectedContacts([]);
      loadContacts();
    } catch (err) {
      message.error(t('contactList.batchDeleteError') + ': ' + (err.response?.data || err.message));
    }
  };

  // 選擇聯絡人
  const handleSelectContact = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  // 全選/取消全選
  const handleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  // 格式化標籤顯示
  const formatHashtags = (hashtags) => {
    if (!hashtags) return [];
    return hashtags.split(',').map(tag => tag.trim()).filter(tag => tag);
  };

  // 列調整大小處理
  const handleResize = index => (e, { size }) => {
    const column = resizableColumns[index];
    setColumnWidths(prev => ({
      ...prev,
      [column.key]: size.width
    }));
  };

  // 表格排序處理
  const handleTableChange = (pagination, filters, sorter) => {
    // 處理排序
    if (sorter && sorter.field) {
      const newSortField = sorter.field;
      const newSortOrder = sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : '';
      
      setSortField(newSortField);
      setSortOrder(newSortOrder);
    } else {
      setSortField('');
      setSortOrder('');
    }
  };

  // 分頁計算
  const totalPages = Math.ceil(totalCount / pageSize);

  // 表格列定義 - 基礎列
  const baseColumns = React.useMemo(() => [
    {
      title: (
        <Checkbox
          checked={selectedContacts.length === contacts.length && contacts.length > 0}
          onChange={handleSelectAll}
        />
      ),
      dataIndex: 'id',
      key: 'select',
      width: columnWidths.select,
      render: (id) => (
        <Checkbox
          checked={selectedContacts.includes(id)}
          onChange={() => handleSelectContact(id)}
        />
      ),
    },
    {
      title: t('contactList.name'),
      dataIndex: 'name',
      key: 'name',
      width: columnWidths.name,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          {record.title && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.title}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: t('contactList.contactInfo'),
      dataIndex: 'contact',
      key: 'contact',
      width: columnWidths.contact,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      render: (_, record) => (
        <div>
          {record.whatsAppNumber && (
            <div style={{ marginBottom: '4px' }}>
              <PhoneOutlined style={{ color: '#25D366', marginRight: '4px', fontSize: '14px' }} />
              <Text style={{ fontSize: '13px', fontWeight: '500', color: '#25D366' }}>
                {record.whatsAppNumber}
              </Text>
            </div>
          )}
          {record.email && (
            <div>
              <MailOutlined style={{ color: '#1890ff', marginRight: '4px', fontSize: '12px' }} />
              <Text style={{ fontSize: '12px' }}>{record.email}</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('contactList.company'),
      dataIndex: 'company',
      key: 'company',
      width: columnWidths.company,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      render: (_, record) => (
        <div>
          {record.companyName && (
            <div style={{ marginBottom: '4px' }}>
              <BankOutlined style={{ color: '#13c2c2', marginRight: '4px' }} />
              <Text style={{ fontSize: '12px' }}>{record.companyName}</Text>
            </div>
          )}
          {record.department && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.department}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: t('contactList.group'),
      dataIndex: 'broadcastGroup',
      key: 'broadcastGroup',
      width: columnWidths.broadcastGroup,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      render: (group, record) => {
        // 如果沒有群組數據，顯示群組ID作為備用
        if (!group && record.broadcastGroupId) {
          return <Tag color="orange">群組ID: {record.broadcastGroupId}</Tag>;
        }
        return group ? (
          <Tag color={group.color || 'blue'}>{group.name}</Tag>
        ) : '-';
      },
    },
    {
      title: t('contactList.tags'),
      dataIndex: 'hashtags',
      key: 'hashtags',
      width: columnWidths.hashtags,
      render: (hashtags) => (
        <Space wrap>
          {formatHashtags(hashtags).map((tag, index) => (
            <Tag key={index} color="blue">#{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('contactList.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: columnWidths.createdAt,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      render: (time) => time ? TimezoneUtils.formatDateWithTimezone(time, userTimezoneOffset) : '-',
    },
    {
      title: t('contactList.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: columnWidths.updatedAt,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      render: (time) => time ? TimezoneUtils.formatDateWithTimezone(time, userTimezoneOffset) : '-',
    },
    {
      title: t('contactList.actions'),
      key: 'actions',
      width: columnWidths.actions,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('contactList.edit')}>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => navigate(`/contacts/edit/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('contactList.delete')}>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                setContactToDelete(record);
                setShowDeleteModal(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ], [t, userTimezoneOffset, selectedContacts, contacts, navigate, columnWidths]);

  // 可調整大小的列
  const resizableColumns = React.useMemo(() => 
    baseColumns.map((col, index) => ({
      ...col,
      onHeaderCell: column => ({
        width: col.width,
        onResize: handleResize(index),
      }),
    }))
  , [baseColumns]);

  // 表格組件配置
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 頁面標題 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Space>
            <Button 
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/contacts/new')}
            >
              {t('contactList.addContact')}
            </Button>
            <Button 
              icon={<UploadOutlined />}
              onClick={() => navigate('/contacts/import')}
            >
              {t('contactList.import')}
            </Button>
          </Space>
        </Col>
        <Col>
          <Title level={2} style={{ margin: 0, textAlign: 'right' }}>{t('contactList.management')}</Title>
          <Text type="secondary" style={{ textAlign: 'right', display: 'block' }}>{t('contactList.description')}</Text>
        </Col>
      </Row>

      {/* 訊息提示 */}
      {error && (
        <Alert 
          message={t('common.error')} 
          description={error} 
          type="error" 
          closable 
          onClose={() => setError(null)}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 搜尋和篩選 */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Search
              placeholder={t('contactList.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onSearch={handleSearch}
              enterButton
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder={t('contactList.allGroups')}
              value={selectedGroup}
              onChange={setSelectedGroup}
              style={{ width: '100%' }}
              allowClear
            >
              {groups.map(group => (
                <Option key={group.id} value={group.id}>
                  {group.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder={t('contactList.allTags')}
              value={selectedHashtag}
              onChange={setSelectedHashtag}
              style={{ width: '100%' }}
              allowClear
            >
              {hashtags.map(hashtag => (
                <Option key={hashtag.id} value={hashtag.name}>
                  #{hashtag.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Space>
              <Button onClick={handleResetFilters}>
                {t('contactList.reset')}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 批量操作 */}
      {selectedContacts.length > 0 && (
        <Card style={{ marginBottom: '16px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Text>{t('contactList.selectedContacts', { count: selectedContacts.length })}</Text>
            </Col>
            <Col>
              <Button 
                danger
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
              >
                {t('contactList.batchDelete')}
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      {/* 聯絡人列表 */}
      <Card>
        <Table
          components={components}
          columns={resizableColumns}
          dataSource={contacts}
          rowKey="id"
          loading={loading}
          onChange={handleTableChange}
          pagination={false}
          scroll={{ 
            x: 1200,
            y: 'calc(100vh - 400px)'
          }}
          sticky={{
            offsetHeader: 0
          }}
          locale={{
            emptyText: (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <UserOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                <div style={{ fontSize: '16px', color: '#999' }}>{t('contactList.noContactsFound')}</div>
                <div style={{ fontSize: '14px', color: '#999' }}>{t('contactList.noContactsDescription')}</div>
              </div>
            ),
          }}
        />
        <div style={{ marginTop: 16, textAlign: 'left' }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={totalCount}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={['10', '20', '50', '100']}
            showTotal={(total, range) => 
              `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`
            }
            onChange={(page, pageSize) => {
              setCurrentPage(page);
              setPageSize(pageSize);
            }}
            onShowSizeChange={(current, size) => {
              setCurrentPage(1);
              setPageSize(size);
            }}
          />
        </div>
      </Card>

      {/* 刪除確認對話框 */}
      <Modal
        title={t('contactList.confirmDelete')}
        open={showDeleteModal}
        onOk={() => handleDeleteContact(contactToDelete?.id)}
        onCancel={() => setShowDeleteModal(false)}
        okText={t('contactList.delete')}
        cancelText={t('contactList.cancel')}
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <p>{t('contactList.confirmDeleteMessage', { name: contactToDelete?.name })}</p>
      </Modal>
    </div>
  );
};

export default ContactListPage;