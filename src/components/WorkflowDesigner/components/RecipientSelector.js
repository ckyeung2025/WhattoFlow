import React, { useState, useEffect } from 'react';
import { Tabs, Card, Button, Space, Tag, Checkbox, List, Avatar, Typography, Divider, Spin, Input, Pagination } from 'antd';
import { 
  UserOutlined, 
  ContactsOutlined, 
  PlayCircleOutlined,
  ClearOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { contactApi, broadcastGroupApi, hashtagApi } from '../../../services/contactApi';
import { useLanguage } from '../../../contexts/LanguageContext';

const { TabPane } = Tabs;
const { Text } = Typography;

// 簡化的收件人選擇器組件
const RecipientSelector = ({ 
  value, 
  onChange, 
  placeholder = '選擇收件人',
  allowMultiple = true,
  recipientDetails, // 新增：詳細的選擇信息
  t 
}) => {
  console.log('🚀 RecipientSelector 組件已渲染');
  
  const { t: translate } = useLanguage();
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);
  
  // 狀態管理
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearchText, setUserSearchText] = useState('');
  
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [broadcastGroups, setBroadcastGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [contactSearchText, setContactSearchText] = useState('');
  
  // 聯絡人分頁狀態
  const [contactCurrentPage, setContactCurrentPage] = useState(1);
  const [contactPageSize] = useState(20);
  const [contactTotalCount, setContactTotalCount] = useState(0);
  
  const [useInitiator, setUseInitiator] = useState(false);

  // 解析初始值
  useEffect(() => {
    console.log('🔍 解析初始值:', value);
    console.log('🔍 詳細選擇信息:', recipientDetails);
    console.log('🔍 當前用戶數據:', users);
    console.log('🔍 當前聯絡人數據:', contacts);
    
    // 優先使用詳細的選擇信息
    if (recipientDetails) {
      console.log('📋 使用詳細選擇信息恢復狀態');
      setSelectedUsers(recipientDetails.users || []);
      setSelectedContacts(recipientDetails.contacts || []);
      setSelectedGroups(recipientDetails.groups || []);
      setSelectedHashtags(recipientDetails.hashtags || []);
      setUseInitiator(recipientDetails.useInitiator || false);
      return;
    }
    
    if (value) {
      try {
        // 如果是字符串且包含逗號，說明是電話號碼列表
        if (typeof value === 'string' && value.includes(',')) {
          console.log('📞 檢測到電話號碼列表格式');
          const phoneNumbers = value.split(',').map(phone => phone.trim());
          console.log('📞 電話號碼列表:', phoneNumbers);
          
          // 嘗試從現有用戶和聯絡人中匹配
          const matchedUsers = [];
          const matchedContacts = [];
          
          phoneNumbers.forEach(phone => {
            // 檢查是否是用戶
            const user = users.find(u => u.phone === phone);
            if (user) {
              matchedUsers.push(user);
            } else {
              // 檢查是否是聯絡人
              const contact = contacts.find(c => c.whatsappNumber === phone);
              if (contact) {
                matchedContacts.push(contact);
              } else {
                // 如果是特殊標記，處理流程啟動人
                if (phone === '${initiator}') {
                  setUseInitiator(true);
                } else {
                  // 創建臨時用戶對象
                  matchedUsers.push({ id: `temp-${phone}`, name: phone, phone: phone });
                }
              }
            }
          });
          
          console.log('👥 匹配的用戶:', matchedUsers);
          console.log('📇 匹配的聯絡人:', matchedContacts);
          
          setSelectedUsers(matchedUsers);
          setSelectedContacts(matchedContacts);
          setSelectedGroups([]);
          setSelectedHashtags([]);
        } else if (typeof value === 'string') {
          // 單個電話號碼
          console.log('📞 檢測到單個電話號碼:', value);
          if (value === '${initiator}') {
            setUseInitiator(true);
            setSelectedUsers([]);
            setSelectedContacts([]);
            setSelectedGroups([]);
            setSelectedHashtags([]);
          } else {
            const user = users.find(u => u.phone === value);
            const contact = contacts.find(c => c.whatsappNumber === value);
            if (user) {
              setSelectedUsers([user]);
            } else if (contact) {
              setSelectedContacts([contact]);
            } else {
              setSelectedUsers([{ id: `temp-${value}`, name: value, phone: value }]);
            }
            setSelectedGroups([]);
            setSelectedHashtags([]);
          }
        } else {
          // JSON 格式
          console.log('📋 檢測到JSON格式');
          const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;
          setSelectedUsers(parsedValue.users || []);
          setSelectedContacts(parsedValue.contacts || []);
          setSelectedGroups(parsedValue.groups || []);
          setSelectedHashtags(parsedValue.hashtags || []);
          setUseInitiator(parsedValue.useInitiator || false);
        }
      } catch (error) {
        console.error('解析收件人值失敗:', error);
        // 重置所有選擇
        setSelectedUsers([]);
        setSelectedContacts([]);
        setSelectedGroups([]);
        setSelectedHashtags([]);
        setUseInitiator(false);
      }
    } else {
      // 沒有值，重置所有選擇
      setSelectedUsers([]);
      setSelectedContacts([]);
      setSelectedGroups([]);
      setSelectedHashtags([]);
      setUseInitiator(false);
    }
  }, [value, recipientDetails, users, contacts]);

  // 載入用戶數據
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

  // 載入聯絡人數據
  useEffect(() => {
    if (activeTab === 'contacts') {
      loadContactData();
    }
  }, [activeTab]);

  // 聯絡人分頁和搜尋變化時重新載入
  useEffect(() => {
    if (activeTab === 'contacts') {
      loadContactData();
    }
  }, [contactCurrentPage, contactSearchText]);

  // 載入用戶數據
  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('🔑 沒有 Token，使用模擬用戶數據');
        const mockUsers = [
          { id: 1, name: '張三', phone: '85212345678', email: 'zhang@example.com' },
          { id: 2, name: '李四', phone: '85287654321', email: 'li@example.com' },
          { id: 3, name: '王五', phone: '85211223344', email: 'wang@example.com' },
        ];
        setUsers(mockUsers);
        return;
      }
      
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const usersData = await response.json();
        const activeUsers = usersData.filter(user => user.phone && user.isActive);
        setUsers(activeUsers);
      } else {
        console.error('載入用戶失敗:', response.statusText);
        const mockUsers = [
          { id: 1, name: '張三', phone: '85212345678', email: 'zhang@example.com' },
          { id: 2, name: '李四', phone: '85287654321', email: 'li@example.com' },
          { id: 3, name: '王五', phone: '85211223344', email: 'wang@example.com' },
        ];
        setUsers(mockUsers);
      }
    } catch (error) {
      console.error('載入用戶失敗:', error);
      const mockUsers = [
        { id: 1, name: '張三', phone: '85212345678', email: 'zhang@example.com' },
        { id: 2, name: '李四', phone: '85287654321', email: 'li@example.com' },
        { id: 3, name: '王五', phone: '85211223344', email: 'wang@example.com' },
      ];
      setUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  };

  // 載入聯絡人數據
  const loadContactData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('🔑 沒有 Token，設置空數據');
        setContacts([]);
        setBroadcastGroups([]);
        setHashtags([]);
        setContactTotalCount(0);
        return;
      }
      
      console.log('🚀 開始載入聯絡人數據...');
      console.log('📄 聯絡人分頁參數:', { page: contactCurrentPage, pageSize: contactPageSize });
      
      // 並行載入數據
      const [groupsRes, hashtagsRes, contactsRes] = await Promise.all([
        broadcastGroupApi.getGroups(),
        hashtagApi.getHashtags(),
        contactApi.getContacts({ 
          page: contactCurrentPage, 
          pageSize: contactPageSize,
          search: contactSearchText || undefined
        })
      ]);
      
      console.log('✅ 廣播群組響應:', groupsRes);
      console.log('✅ 標籤響應:', hashtagsRes);
      console.log('✅ 聯絡人響應:', contactsRes);

      // 廣播群組和標籤直接返回數組，聯絡人返回包裝對象
      const groups = Array.isArray(groupsRes) ? groupsRes : [];
      const hashtags = Array.isArray(hashtagsRes) ? hashtagsRes : [];
      const contacts = contactsRes.contacts || [];
      const totalCount = contactsRes.totalCount || 0;
      
      console.log('📊 處理後的數據:');
      console.log('📊 廣播群組數量:', groups.length);
      console.log('📊 標籤數量:', hashtags.length);
      console.log('📊 聯絡人數量:', contacts.length);
      console.log('📊 聯絡人總數:', totalCount);
      
      setBroadcastGroups(groups);
      setHashtags(hashtags);
      setContacts(contacts);
      setContactTotalCount(totalCount);
      
      console.log('🎉 所有數據載入完成');
    } catch (error) {
      console.error('❌ 載入聯絡人數據失敗:', error);
      setContacts([]);
      setBroadcastGroups([]);
      setHashtags([]);
      setContactTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // 更新收件人值
  const updateRecipientValue = () => {
    console.log('🔄 更新收件人值');
    console.log('👥 選中的用戶:', selectedUsers);
    console.log('📇 選中的聯絡人:', selectedContacts);
    console.log('🏷️ 選中的群組:', selectedGroups);
    console.log('🔖 選中的標籤:', selectedHashtags);
    console.log('🚀 使用流程啟動人:', useInitiator);
    
    const phoneNumbers = [];
    
    // 添加選中的用戶
    selectedUsers.forEach(user => {
      if (user.phone && !phoneNumbers.includes(user.phone)) {
        phoneNumbers.push(user.phone);
      }
    });
    
    // 添加選中的聯絡人
    selectedContacts.forEach(contact => {
      if (contact.whatsappNumber && !phoneNumbers.includes(contact.whatsappNumber)) {
        phoneNumbers.push(contact.whatsappNumber);
      }
    });
    
    // 如果勾選了使用流程啟動人，添加特殊標記
    if (useInitiator) {
      phoneNumbers.push('${initiator}');
    }

    // 保存詳細的選擇信息，而不僅僅是電話號碼
    const detailedValue = {
      users: selectedUsers,
      contacts: selectedContacts,
      groups: selectedGroups,
      hashtags: selectedHashtags,
      useInitiator: useInitiator,
      phoneNumbers: phoneNumbers
    };
    
    console.log('📤 發送詳細值:', detailedValue);
    console.log('📞 電話號碼列表:', phoneNumbers);
    
    // 發送電話號碼字符串（向後兼容）
    const finalValue = allowMultiple ? phoneNumbers.join(',') : phoneNumbers[0] || '';
    
    // 如果父組件支持詳細信息，也發送詳細信息
    if (onChange.length > 1) {
      onChange(finalValue, detailedValue);
    } else {
      onChange(finalValue);
    }
  };

  // 清除所有選擇
  const handleClearAll = () => {
    setSelectedUsers([]);
    setSelectedContacts([]);
    setSelectedGroups([]);
    setSelectedHashtags([]);
    setUseInitiator(false);
    onChange('');
  };

  // 過濾函數
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(userSearchText.toLowerCase()) ||
    user.phone.includes(userSearchText)
  );

  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(contactSearchText.toLowerCase()) ||
    contact.whatsappNumber?.includes(contactSearchText) ||
    contact.email?.toLowerCase().includes(contactSearchText.toLowerCase())
  );

  return (
    <div style={{ width: '100%', minWidth: '400px' }}>
      {/* 當前選擇顯示 */}
      {(selectedUsers.length > 0 || selectedContacts.length > 0 || selectedGroups.length > 0 || 
        selectedHashtags.length > 0 || useInitiator) && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>已選擇的收件人</Text>
            <Button type="text" size="small" icon={<ClearOutlined />} onClick={handleClearAll}>
              清除全部
            </Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {selectedUsers.map(user => (
              <Tag key={`user-${user.id}`} color="blue" closable onClose={() => setSelectedUsers(prev => prev.filter(u => u.id !== user.id))}>
                <UserOutlined /> {user.name} ({user.phone})
              </Tag>
            ))}
            {selectedContacts.map(contact => (
              <Tag key={`contact-${contact.id}`} color="green" closable onClose={() => setSelectedContacts(prev => prev.filter(c => c.id !== contact.id))}>
                <ContactsOutlined /> {contact.name} ({contact.whatsappNumber})
              </Tag>
            ))}
            {selectedGroups.map(groupId => {
              const group = broadcastGroups.find(g => g.id === groupId);
              return group ? (
                <Tag key={`group-${groupId}`} color="orange" closable onClose={() => setSelectedGroups(prev => prev.filter(id => id !== groupId))}>
                  群組: {group.name}
                </Tag>
              ) : null;
            })}
            {selectedHashtags.map(hashtagId => {
              const hashtag = hashtags.find(h => h.id === hashtagId);
              return hashtag ? (
                <Tag key={`hashtag-${hashtagId}`} color="purple" closable onClose={() => setSelectedHashtags(prev => prev.filter(id => id !== hashtagId))}>
                  標籤: {hashtag.name}
                </Tag>
              ) : null;
            })}
            {useInitiator && (
              <Tag key="initiator" color="red" closable onClose={() => setUseInitiator(false)}>
                <PlayCircleOutlined /> 流程啟動人
              </Tag>
            )}
          </div>
        </Card>
      )}

      {/* 標籤頁 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* Users Tab */}
        <TabPane tab={<><UserOutlined /> 用戶</>} key="users">
          <div style={{ marginBottom: 16 }}>
            <Input
              placeholder="搜尋用戶..."
              prefix={<SearchOutlined />}
              value={userSearchText}
              onChange={(e) => setUserSearchText(e.target.value)}
            />
          </div>
          
          <Spin spinning={loading}>
            <List
              dataSource={filteredUsers}
              renderItem={user => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Checkbox
                      checked={selectedUsers.some(u => u.id === user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (allowMultiple) {
                            setSelectedUsers(prev => [...prev, user]);
                          } else {
                            setSelectedUsers([user]);
                          }
                        } else {
                          setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
                        }
                      }}
                      style={{ marginRight: 12 }}
                    />
                    <Avatar icon={<UserOutlined />} style={{ marginRight: 12 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{user.name}</div>
                      <div style={{ color: '#666', fontSize: '12px' }}>{user.phone}</div>
                    </div>
                  </div>
                </List.Item>
              )}
              locale={{ emptyText: '沒有找到用戶' }}
            />
          </Spin>
        </TabPane>

        {/* Contact List Tab */}
        <TabPane tab={<><ContactsOutlined /> 聯絡人</>} key="contacts">
          {/* 廣播群組選擇 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>廣播群組:</Text>
            <div style={{ marginTop: 8 }}>
              {broadcastGroups.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {broadcastGroups.map(group => (
                    <Tag.CheckableTag
                      key={group.id}
                      checked={selectedGroups.includes(group.id)}
                      onChange={(checked) => {
                        if (checked) {
                          if (allowMultiple) {
                            setSelectedGroups(prev => [...prev, group.id]);
                          } else {
                            setSelectedGroups([group.id]);
                          }
                        } else {
                          setSelectedGroups(prev => prev.filter(id => id !== group.id));
                        }
                      }}
                      style={{
                        backgroundColor: selectedGroups.includes(group.id) ? '#1890ff' : '#f0f0f0',
                        color: selectedGroups.includes(group.id) ? '#fff' : '#666',
                        border: '1px solid #d9d9d9',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      {group.name}
                    </Tag.CheckableTag>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#999', 
                  backgroundColor: '#f5f5f5',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  暫無廣播群組數據
                </div>
              )}
            </div>
          </div>

          {/* 標籤選擇 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>標籤:</Text>
            <div style={{ marginTop: 8 }}>
              {hashtags.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {hashtags.map(hashtag => (
                    <Tag.CheckableTag
                      key={hashtag.id}
                      checked={selectedHashtags.includes(hashtag.id)}
                      onChange={(checked) => {
                        if (checked) {
                          if (allowMultiple) {
                            setSelectedHashtags(prev => [...prev, hashtag.id]);
                          } else {
                            setSelectedHashtags([hashtag.id]);
                          }
                        } else {
                          setSelectedHashtags(prev => prev.filter(id => id !== hashtag.id));
                        }
                      }}
                      style={{
                        backgroundColor: selectedHashtags.includes(hashtag.id) ? '#52c41a' : '#f0f0f0',
                        color: selectedHashtags.includes(hashtag.id) ? '#fff' : '#666',
                        border: '1px solid #d9d9d9',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      #{hashtag.name}
                    </Tag.CheckableTag>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#999', 
                  backgroundColor: '#f5f5f5',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  暫無標籤數據
                </div>
              )}
            </div>
          </div>

          <Divider />

          {/* 聯絡人列表 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>聯絡人列表:</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              共 {contactTotalCount} 個聯絡人
            </Text>
          </div>
          
          {/* 搜尋聯絡人 */}
          <div style={{ marginBottom: 16 }}>
            <Input
              placeholder="搜尋聯絡人..."
              prefix={<SearchOutlined />}
              value={contactSearchText}
              onChange={(e) => {
                setContactSearchText(e.target.value);
                setContactCurrentPage(1); // 搜尋時重置到第一頁
              }}
            />
          </div>
          <Spin spinning={loading}>
            <List
              dataSource={contacts}
              renderItem={contact => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Checkbox
                      checked={selectedContacts.some(c => c.id === contact.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (allowMultiple) {
                            setSelectedContacts(prev => [...prev, contact]);
                          } else {
                            setSelectedContacts([contact]);
                          }
                        } else {
                          setSelectedContacts(prev => prev.filter(c => c.id !== contact.id));
                        }
                      }}
                      style={{ marginRight: 12 }}
                    />
                    <Avatar icon={<ContactsOutlined />} style={{ marginRight: 12 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{contact.name}</div>
                      <div style={{ color: '#666', fontSize: '12px' }}>
                        {contact.whatsappNumber && `WhatsApp: ${contact.whatsappNumber}`}
                        {contact.email && ` | Email: ${contact.email}`}
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
              locale={{ emptyText: '沒有找到聯絡人' }}
            />
            
            {/* 分頁組件 */}
            {contactTotalCount > contactPageSize && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Pagination
                  current={contactCurrentPage}
                  pageSize={contactPageSize}
                  total={contactTotalCount}
                  onChange={setContactCurrentPage}
                  showSizeChanger={false}
                  showQuickJumper={true}
                  showTotal={(total, range) => 
                    `第 ${range[0]}-${range[1]} 項，共 ${total} 項`
                  }
                  size="small"
                />
              </div>
            )}
          </Spin>
        </TabPane>

        {/* Workflow Initiator Tab */}
        <TabPane tab={<><PlayCircleOutlined /> 流程啟動人</>} key="initiators">
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Checkbox
                checked={useInitiator}
                onChange={(e) => setUseInitiator(e.target.checked)}
                style={{ marginRight: 12 }}
              />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>使用流程啟動人</div>
                <div style={{ color: '#666', fontSize: '12px', marginTop: 4 }}>
                  勾選後，系統會在流程執行時自動使用啟動該流程實例的用戶作為收件人
                </div>
              </div>
            </div>
            
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f5f5f5', 
              borderRadius: '6px',
              fontSize: '12px',
              color: '#666'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>說明：</div>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                <li>此選項會在流程執行時自動替換為實際的流程啟動人</li>
                <li>適用於需要向啟動流程的用戶發送消息或等待其回覆的場景</li>
                <li>系統會自動從 workflow_executions 表的 InitiatedBy 字段獲取啟動人信息</li>
              </ul>
            </div>
          </Card>
        </TabPane>
      </Tabs>

      {/* 確認按鈕 */}
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button onClick={handleClearAll}>清除</Button>
          <Button type="primary" onClick={updateRecipientValue}>
            確認選擇
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default RecipientSelector;