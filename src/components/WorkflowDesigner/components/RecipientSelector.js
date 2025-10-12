import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, Card, Button, Space, Tag, Checkbox, List, Avatar, Typography, Divider, Spin, Input, Pagination, Tooltip } from 'antd';
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
  compact = false, // 新增：簡潔模式
  workflowDefinitionId, // 新增：工作流定義ID
}) => {
  console.log('🚀 RecipientSelector 組件已渲染');
  console.log('🚀 接收到的 props:', { value, recipientDetails, allowMultiple });
  
  const { t } = useLanguage();
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
  
  // 流程變量狀態
  const [processVariables, setProcessVariables] = useState([]);
  const [selectedProcessVariables, setSelectedProcessVariables] = useState([]);

  // 解析初始值
  useEffect(() => {
    console.log('🔍 ===== 解析初始值 useEffect 觸發 =====');
    console.log('🔍 解析初始值:', value);
    console.log('🔍 詳細選擇信息:', recipientDetails);
    console.log('🔍 當前用戶數據:', users);
    console.log('🔍 當前聯絡人數據:', contacts);
    console.log('🔍 當前廣播群組數據:', broadcastGroups);
    console.log('🔍 當前標籤數據:', hashtags);
    
    // 優先使用詳細的選擇信息
    if (recipientDetails) {
      console.log('📋 使用詳細選擇信息恢復狀態');
      setSelectedUsers(recipientDetails.users || []);
      setSelectedContacts(recipientDetails.contacts || []);
      setSelectedGroups(recipientDetails.groups || []);
      setSelectedHashtags(recipientDetails.hashtags || []);
      setSelectedProcessVariables(recipientDetails.processVariables || []);
      setUseInitiator(recipientDetails.useInitiator || false);
      
      // 如果有群組或標籤選擇，需要載入聯絡人數據
      if ((recipientDetails.groups && recipientDetails.groups.length > 0) || 
          (recipientDetails.hashtags && recipientDetails.hashtags.length > 0)) {
        console.log('🚀 檢測到群組或標籤選擇，載入聯絡人數據');
        loadContactData();
      }
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
              const contact = contacts.find(c => c.whatsAppNumber === phone);
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
            const contact = contacts.find(c => c.whatsAppNumber === value);
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
          setSelectedProcessVariables(parsedValue.processVariables || []);
          setUseInitiator(parsedValue.useInitiator || false);
          
          // 如果有群組或標籤選擇，需要載入聯絡人數據
          if ((parsedValue.groups && parsedValue.groups.length > 0) || 
              (parsedValue.hashtags && parsedValue.hashtags.length > 0)) {
            console.log('🚀 檢測到群組或標籤選擇，載入聯絡人數據');
            loadContactData();
          }
        }
      } catch (error) {
        console.error('解析收件人值失敗:', error);
        // 重置所有選擇
        setSelectedUsers([]);
        setSelectedContacts([]);
        setSelectedGroups([]);
        setSelectedHashtags([]);
        setSelectedProcessVariables([]);
        setUseInitiator(false);
      }
    } else {
      // 沒有值，重置所有選擇
      setSelectedUsers([]);
      setSelectedContacts([]);
      setSelectedGroups([]);
      setSelectedHashtags([]);
      setSelectedProcessVariables([]);
      setUseInitiator(false);
    }
  }, [value, recipientDetails]);

  // 當用戶或聯絡人數據載入完成後，重新解析已選擇的項目
  useEffect(() => {
    console.log('🔄 用戶或聯絡人數據變化，重新解析已選擇項目');
    console.log('🔄 當前選中的用戶:', selectedUsers);
    console.log('🔄 當前選中的聯絡人:', selectedContacts);
    
    // 如果有已選擇的項目但數據不完整，嘗試重新匹配
    if (selectedUsers.length > 0 || selectedContacts.length > 0) {
      // 這裡可以添加重新匹配邏輯，但通常不需要
      // 因為 selectedUsers 和 selectedContacts 已經包含了完整的對象
    }
  }, [users, contacts, broadcastGroups, hashtags]);

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

  // 載入流程變量數據
  useEffect(() => {
    // 在簡潔模式下、processVariables 標籤激活時、或者有選中的流程變量時載入流程變量
    if (compact || activeTab === 'processVariables' || selectedProcessVariables.length > 0) {
      loadProcessVariables();
    }
  }, [activeTab, compact, selectedProcessVariables.length]);


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
    console.log('🚀 ===== loadContactData 函數被調用 =====');
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      console.log('🔑 Token 狀態:', token ? '存在' : '不存在');
      
      if (!token) {
        console.log('🔑 沒有 Token，使用模擬數據');
        // 設置模擬的廣播群組和標籤數據，以便顯示已選擇的項目
        const mockGroups = [
          { id: 1, name: 'VIP 客戶' },
          { id: 2, name: '一般客戶' },
          { id: 3, name: '內部員工' },
          { id: 4, name: '合作夥伴' },
          { id: 5, name: '潛在客戶' },
          { id: 6, name: 'test' }
        ];
        
        const mockHashtags = [
          { id: 1, name: '已成交' },
          { id: 2, name: '企業客戶' },
          { id: 3, name: '投訴客戶' },
          { id: 4, name: '待跟進' },
          { id: 5, name: '活躍用戶' },
          { id: 6, name: '重要客戶' },
          { id: 7, name: '推薦客戶' },
          { id: 8, name: '新客戶' },
          { id: 9, name: 'test' }
        ];
        
        setBroadcastGroups(mockGroups);
        setHashtags(mockHashtags);
        setContacts([]);
        setContactTotalCount(0);
        console.log('✅ 模擬數據設置完成:', { mockGroups, mockHashtags });
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
      // 即使 API 失敗，也設置模擬數據以便顯示已選擇的項目
      const mockGroups = [
        { id: 1, name: 'VIP 客戶' },
        { id: 2, name: '一般客戶' },
        { id: 3, name: '內部員工' },
        { id: 4, name: '合作夥伴' },
        { id: 5, name: '潛在客戶' },
        { id: 6, name: 'test' }
      ];
      
      const mockHashtags = [
        { id: 1, name: '已成交' },
        { id: 2, name: '企業客戶' },
        { id: 3, name: '投訴客戶' },
        { id: 4, name: '待跟進' },
        { id: 5, name: '活躍用戶' },
        { id: 6, name: '重要客戶' },
        { id: 7, name: '推薦客戶' },
        { id: 8, name: '新客戶' },
        { id: 9, name: 'test' }
      ];
      
      setBroadcastGroups(mockGroups);
      setHashtags(mockHashtags);
      setContacts([]);
      setContactTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // 載入流程變量數據
  const loadProcessVariables = async () => {
    console.log('🚀 ===== loadProcessVariables 函數被調用 =====');
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      console.log('🔑 Token 狀態:', token ? '存在' : '不存在');
      
      if (!token) {
        console.log('🔑 沒有 Token，使用模擬數據');
        // 設置模擬的流程變量數據
        const mockProcessVariables = [
          { id: 'sales_phone', name: 'Sales Phone', description: '銷售人員電話號碼', value: '85212345678', dataType: 'PhoneNumber' },
          { id: 'sales_manager_phone', name: 'Sales Manager Phone', description: '銷售主管電話號碼', value: '85287654321', dataType: 'PhoneNumber' },
          { id: 'customer_service_phone', name: 'Customer Service Phone', description: '客服電話號碼', value: '85211223344', dataType: 'PhoneNumber' },
          { id: 'technical_support_phone', name: 'Technical Support Phone', description: '技術支援電話號碼', value: '85255667788', dataType: 'PhoneNumber' },
          { id: 'admin_phone', name: 'Admin Phone', description: '管理員電話號碼', value: '85299887766', dataType: 'PhoneNumber' }
        ];
        
        setProcessVariables(mockProcessVariables);
        console.log('✅ 模擬流程變量數據設置完成:', mockProcessVariables);
        return;
      }
      
      console.log('🚀 開始載入流程變量數據...');
      console.log('🔍 workflowDefinitionId:', workflowDefinitionId, 'type:', typeof workflowDefinitionId);
      
      // 調用 API 載入指定工作流的流程變量定義（使用與流程設計器相同的端點）
      const url = workflowDefinitionId 
        ? `/api/processvariables/definitions?workflowDefinitionId=${parseInt(workflowDefinitionId) || 0}`
        : '/api/processvariables/definitions';
        
      console.log('🔗 API URL:', url);
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ 流程變量響應:', result);
        
        // 處理流程變量定義數據
        const phoneVariables = result.data?.map(pv => ({
          id: pv.id,
          name: pv.displayName || pv.variableName,
          description: pv.description || '',
          value: pv.defaultValue || '',
          dataType: pv.dataType,
          variableName: pv.variableName
        })) || [];
        
        console.log('📞 電話號碼類型的流程變量:', phoneVariables);
        setProcessVariables(phoneVariables);
      } else {
        console.error('載入流程變量失敗:', response.statusText);
        // 使用模擬數據
        const mockProcessVariables = [
          { id: 'sales_phone', name: 'Sales Phone', description: '銷售人員電話號碼', value: '85212345678', dataType: 'PhoneNumber' },
          { id: 'sales_manager_phone', name: 'Sales Manager Phone', description: '銷售主管電話號碼', value: '85287654321', dataType: 'PhoneNumber' }
        ];
        setProcessVariables(mockProcessVariables);
      }
    } catch (error) {
      console.error('❌ 載入流程變量失敗:', error);
      // 使用模擬數據
      const mockProcessVariables = [
        { id: 'sales_phone', name: 'Sales Phone', description: '銷售人員電話號碼', value: '85212345678', dataType: 'PhoneNumber' },
        { id: 'sales_manager_phone', name: 'Sales Manager Phone', description: '銷售主管電話號碼', value: '85287654321', dataType: 'PhoneNumber' }
      ];
      setProcessVariables(mockProcessVariables);
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
    console.log('⚙️ 選中的流程變量:', selectedProcessVariables);
    console.log('🚀 使用流程啟動人:', useInitiator);
    
    // ✅ phoneNumbers 應該只用於向後兼容，用於顯示目的
    // 實際收件人解析應該由後端根據 users, contacts 等詳細信息進行
    const phoneNumbers = [];
    
    // 🆕 只添加選中用戶的電話（僅用於向後兼容和顯示）
    selectedUsers.forEach(user => {
      if (user.phone && !phoneNumbers.includes(user.phone)) {
        phoneNumbers.push(user.phone);
      }
    });
    
    // 🆕 添加選中聯絡人的電話（僅用於向後兼容和顯示）
    selectedContacts.forEach(contact => {
      if (contact.whatsAppNumber && !phoneNumbers.includes(contact.whatsAppNumber)) {
        phoneNumbers.push(contact.whatsAppNumber);
      }
    });

    // 保存詳細的選擇信息
    // ⚠️ 重要：後端應該只處理以下詳細信息，不應該處理 phoneNumbers 陣列
    // phoneNumbers 僅用於向後兼容和前端顯示
    const detailedValue = {
      users: selectedUsers,
      contacts: selectedContacts,
      groups: selectedGroups,
      hashtags: selectedHashtags,
      processVariables: selectedProcessVariables,
      useInitiator: useInitiator,
      phoneNumbers: [] // 🆕 清空 phoneNumbers，避免重複處理
    };
    
    console.log('📤 發送詳細值:', detailedValue);
    console.log('📞 電話號碼列表:', phoneNumbers);
    
    // 發送電話號碼字符串（向後兼容）
    const finalValue = allowMultiple ? phoneNumbers.join(',') : phoneNumbers[0] || '';
    
    // 發送電話號碼字符串和詳細信息
    console.log('📤 調用 onChange:', { finalValue, detailedValue });
    onChange(finalValue, detailedValue);
  };

  // 清除所有選擇
  const handleClearAll = () => {
    setSelectedUsers([]);
    setSelectedContacts([]);
    setSelectedGroups([]);
    setSelectedHashtags([]);
    setSelectedProcessVariables([]);
    setUseInitiator(false);
    
    // 創建空的詳細值對象
    const emptyDetailedValue = {
      users: [],
      contacts: [],
      groups: [],
      hashtags: [],
      processVariables: [],
      useInitiator: false,
      phoneNumbers: []
    };
    
    // 同時傳遞空值和空的詳細值
    onChange('', emptyDetailedValue);
  };

  // 過濾函數
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(userSearchText.toLowerCase()) ||
    user.phone.includes(userSearchText)
  );

  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(contactSearchText.toLowerCase()) ||
    contact.whatsAppNumber?.includes(contactSearchText) ||
    contact.email?.toLowerCase().includes(contactSearchText.toLowerCase())
  );

  // 生成顯示文本和 tooltip
  const generateDisplayInfo = useMemo(() => {
    const totalCount = selectedUsers.length + selectedContacts.length + selectedGroups.length + selectedHashtags.length + selectedProcessVariables.length + (useInitiator ? 1 : 0);
    
    if (totalCount === 0) {
      return { displayText: '', tooltip: '' };
    }
    
    if (totalCount === 1) {
      // 單個選擇，顯示具體信息
      if (selectedUsers.length === 1) {
        return { 
          displayText: `${selectedUsers[0].name} (${selectedUsers[0].phone})`,
          tooltip: `用戶: ${selectedUsers[0].name} (${selectedUsers[0].phone})`
        };
      }
      if (selectedContacts.length === 1) {
        const contact = selectedContacts[0];
        const phoneDisplay = contact.whatsAppNumber ? ` (${contact.whatsAppNumber})` : '';
        return { 
          displayText: `${contact.name}${phoneDisplay}`,
          tooltip: `聯絡人: ${contact.name}${phoneDisplay}`
        };
      }
      if (selectedGroups.length === 1) {
        const group = broadcastGroups.find(g => g.id === selectedGroups[0]);
        return { 
          displayText: `群組: ${group?.name || '未知群組'}`,
          tooltip: `廣播群組: ${group?.name || '未知群組'}`
        };
      }
      if (selectedHashtags.length === 1) {
        const hashtag = hashtags.find(h => h.id === selectedHashtags[0]);
        return { 
          displayText: `標籤: ${hashtag?.name || '未知標籤'}`,
          tooltip: `標籤: ${hashtag?.name || '未知標籤'}`
        };
      }
      if (selectedProcessVariables.length === 1) {
        const pv = processVariables.find(p => p.id === selectedProcessVariables[0]);
        return { 
          displayText: `變量: ${pv?.name || '未知變量'}`,
          tooltip: `流程變量: ${pv?.name || '未知變量'} (${pv?.value || ''})`
        };
      }
      if (useInitiator) {
        return { 
          displayText: '流程啟動人',
          tooltip: '流程啟動人 (執行時自動替換)'
        };
      }
    }
    
    // 多個選擇，顯示具體名稱（但限制長度）
    const summary = [];
    
    // 添加用戶名稱（最多顯示前2個）
    if (selectedUsers.length > 0) {
      const userNames = selectedUsers.slice(0, 2).map(u => u.name);
      if (selectedUsers.length > 2) {
        summary.push(`${userNames.join(', ')} 等${selectedUsers.length}個用戶`);
      } else {
        summary.push(userNames.join(', '));
      }
    }
    
    // 添加聯絡人名稱（最多顯示前2個）
    if (selectedContacts.length > 0) {
      const contactNames = selectedContacts.slice(0, 2).map(c => c.name);
      if (selectedContacts.length > 2) {
        summary.push(`${contactNames.join(', ')} 等${selectedContacts.length}個聯絡人`);
      } else {
        summary.push(contactNames.join(', '));
      }
    }
    
    // 添加群組名稱（最多顯示前2個）
    if (selectedGroups.length > 0) {
      const groupNames = selectedGroups.slice(0, 2).map(id => {
        const group = broadcastGroups.find(g => g.id === id);
        return group?.name || '未知群組';
      });
      if (selectedGroups.length > 2) {
        summary.push(`${groupNames.join(', ')} 等${selectedGroups.length}個群組`);
      } else {
        summary.push(groupNames.join(', '));
      }
    }
    
    // 添加標籤名稱（最多顯示前2個）
    if (selectedHashtags.length > 0) {
      const hashtagNames = selectedHashtags.slice(0, 2).map(id => {
        const hashtag = hashtags.find(h => h.id === id);
        return hashtag?.name || '未知標籤';
      });
      if (selectedHashtags.length > 2) {
        summary.push(`${hashtagNames.join(', ')} 等${selectedHashtags.length}個標籤`);
      } else {
        summary.push(hashtagNames.join(', '));
      }
    }
    
    // 添加流程變量名稱（最多顯示前2個）
    if (selectedProcessVariables.length > 0) {
      const pvNames = selectedProcessVariables.slice(0, 2).map(id => {
        const pv = processVariables.find(p => p.id === id);
        return pv?.name || pv?.variableName || '未知變量';
      });
      if (selectedProcessVariables.length > 2) {
        summary.push(`${pvNames.join(', ')} 等${selectedProcessVariables.length}個變量`);
      } else {
        summary.push(pvNames.join(', '));
      }
    }
    
    if (useInitiator) summary.push('流程啟動人');
    
    let displayText = summary.join(', ');
    
    // 限制顯示長度，超過時添加省略號
    const maxLength = 30; // 最大顯示字符數
    if (displayText.length > maxLength) {
      displayText = displayText.substring(0, maxLength) + '...';
    }
    
    // 生成詳細的 tooltip
    const tooltipDetails = [];
    if (selectedUsers.length > 0) {
      tooltipDetails.push('用戶: ' + selectedUsers.map(u => `${u.name} (${u.phone})`).join(', '));
    }
    if (selectedContacts.length > 0) {
      tooltipDetails.push('聯絡人: ' + selectedContacts.map(c => `${c.name}${c.whatsAppNumber ? ` (${c.whatsAppNumber})` : ''}`).join(', '));
    }
    if (selectedGroups.length > 0) {
      const groupNames = selectedGroups.map(id => {
        const group = broadcastGroups.find(g => g.id === id);
        return group?.name || '未知群組';
      });
      tooltipDetails.push('群組: ' + groupNames.join(', '));
    }
    if (selectedHashtags.length > 0) {
      const hashtagNames = selectedHashtags.map(id => {
        const hashtag = hashtags.find(h => h.id === id);
        return hashtag?.name || '未知標籤';
      });
      tooltipDetails.push('標籤: ' + hashtagNames.join(', '));
    }
    if (selectedProcessVariables.length > 0) {
      const pvNames = selectedProcessVariables.map(id => {
        const pv = processVariables.find(p => p.id === id);
        return `${pv?.name || pv?.variableName || '未知變量'} (${pv?.value || ''})`;
      });
      tooltipDetails.push('流程變量: ' + pvNames.join(', '));
    }
    if (useInitiator) {
      tooltipDetails.push('流程啟動人 (執行時自動替換)');
    }
    
    return {
      displayText: displayText,
      tooltip: tooltipDetails.join('\n')
    };
  }, [selectedUsers, selectedContacts, selectedGroups, selectedHashtags, selectedProcessVariables, useInitiator, broadcastGroups, hashtags, processVariables]);

  // 如果是簡潔模式，只顯示簡潔的選擇信息
  if (compact) {
    const { displayText, tooltip } = generateDisplayInfo;
    
    return (
      <div style={{ width: '100%' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          backgroundColor: displayText ? '#fafafa' : '#fff',
          overflow: 'hidden'
        }}>
          {displayText ? (
            <Tooltip title={tooltip} placement="topLeft">
              <div style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '14px',
                color: '#262626',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0
              }}>
                {displayText}
              </div>
            </Tooltip>
          ) : (
            <div style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '14px',
              color: '#999',
              fontStyle: 'italic',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0
            }}>
              {placeholder}
            </div>
          )}
          <div 
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              color: '#1890ff',
              cursor: 'pointer',
              borderLeft: '1px solid #f0f0f0',
              backgroundColor: '#fafafa',
              flexShrink: 0,
              textShadow: 'none',
              fontWeight: 'normal'
            }}
            onClick={() => {
              // 在簡潔模式下，通過 onChange 回調通知父組件需要打開模態框
              if (onChange) {
                onChange('', null); // 觸發父組件的處理邏輯
              }
            }}
          >
{t('recipientSelector.title')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minWidth: '400px' }}>
      {/* 當前選擇顯示 */}
      {(selectedUsers.length > 0 || selectedContacts.length > 0 || selectedGroups.length > 0 || 
        selectedHashtags.length > 0 || selectedProcessVariables.length > 0 || useInitiator) && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>{t('recipientSelector.selectedRecipients')}</Text>
            <Button type="text" size="small" icon={<ClearOutlined />} onClick={handleClearAll}>
              {t('recipientSelector.clearAll')}
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
                <ContactsOutlined /> {contact.name}{contact.whatsAppNumber ? ` (${contact.whatsAppNumber})` : ''}
              </Tag>
            ))}
            {selectedGroups.map(groupId => {
              const group = broadcastGroups.find(g => g.id === groupId);
              return group ? (
                <Tag key={`group-${groupId}`} color="orange" closable onClose={() => setSelectedGroups(prev => prev.filter(id => id !== groupId))}>
                  {t('recipientSelector.tagLabels.group')}: {group.name}
                </Tag>
              ) : null;
            })}
            {selectedHashtags.map(hashtagId => {
              const hashtag = hashtags.find(h => h.id === hashtagId);
              return hashtag ? (
                <Tag key={`hashtag-${hashtagId}`} color="purple" closable onClose={() => setSelectedHashtags(prev => prev.filter(id => id !== hashtagId))}>
                  {t('recipientSelector.tagLabels.hashtag')}: {hashtag.name}
                </Tag>
              ) : null;
            })}
            {selectedProcessVariables.map(pvId => {
              const pv = processVariables.find(p => p.id === pvId);
              return pv ? (
                <Tag key={`pv-${pvId}`} color="cyan" closable onClose={() => setSelectedProcessVariables(prev => prev.filter(id => id !== pvId))}>
                  {t('recipientSelector.tagLabels.variable')}: {pv.name} ({pv.value})
                </Tag>
              ) : null;
            })}
            {useInitiator && (
              <Tag key="initiator" color="red" closable onClose={() => setUseInitiator(false)}>
                <PlayCircleOutlined /> {t('recipientSelector.tagLabels.initiator')}
              </Tag>
            )}
          </div>
        </Card>
      )}

      {/* 標籤頁 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* Users Tab */}
        <TabPane tab={<><UserOutlined /> {t('recipientSelector.users')}</>} key="users">
          <div style={{ marginBottom: 16 }}>
            <Input
              placeholder={t('recipientSelector.searchUsers')}
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
              locale={{ emptyText: t('recipientSelector.usersTab.noUsersFound') }}
            />
          </Spin>
        </TabPane>

        {/* Contact List Tab */}
        <TabPane tab={<><ContactsOutlined /> {t('recipientSelector.contacts')}</>} key="contacts">
          {/* 廣播群組選擇 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>{t('recipientSelector.contactsTab.broadcastGroups')}:</Text>
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
                  {t('recipientSelector.contactsTab.noGroupsData')}
                </div>
              )}
            </div>
          </div>

          {/* 標籤選擇 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>{t('recipientSelector.contactsTab.hashtags')}:</Text>
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
                  {t('recipientSelector.contactsTab.noHashtagsData')}
                </div>
              )}
            </div>
          </div>

          <Divider />

          {/* 聯絡人列表 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>{t('recipientSelector.contactsTab.contactList')}:</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {t('recipientSelector.contactsTab.totalContacts', { count: contactTotalCount })}
            </Text>
          </div>
          
          {/* 搜尋聯絡人 */}
          <div style={{ marginBottom: 16 }}>
            <Input
              placeholder={t('recipientSelector.searchContacts')}
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
                        {contact.whatsAppNumber && `WhatsApp: ${contact.whatsAppNumber}`}
                        {contact.email && ` | Email: ${contact.email}`}
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
              locale={{ emptyText: t('recipientSelector.contactsTab.noContactsFound') }}
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
                    t('recipientSelector.contactsTab.pageRange', { start: range[0], end: range[1], total })
                  }
                  size="small"
                />
              </div>
            )}
          </Spin>
        </TabPane>

        {/* Process Variables Tab */}
        <TabPane tab={<><ContactsOutlined /> {t('recipientSelector.processVariables')}</>} key="processVariables">
          <div style={{ marginBottom: 16 }}>
            <Text strong>{t('recipientSelector.processVariablesTab.title')}:</Text>
            <div style={{ color: '#666', fontSize: '12px', marginTop: 4 }}>
              {t('recipientSelector.processVariablesTab.description')}
            </div>
          </div>
          
          <Spin spinning={loading}>
            <List
              dataSource={processVariables}
              renderItem={pv => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Checkbox
                      checked={selectedProcessVariables.includes(pv.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (allowMultiple) {
                            setSelectedProcessVariables(prev => [...prev, pv.id]);
                          } else {
                            setSelectedProcessVariables([pv.id]);
                          }
                        } else {
                          setSelectedProcessVariables(prev => prev.filter(id => id !== pv.id));
                        }
                      }}
                      style={{ marginRight: 12 }}
                    />
                    <Avatar icon={<ContactsOutlined />} style={{ marginRight: 12 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{pv.name}</div>
                      <div style={{ color: '#666', fontSize: '12px' }}>
                        {pv.description && `${pv.description} | `}
                        值: {pv.value} | 類型: {pv.dataType}
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
              locale={{ emptyText: t('recipientSelector.processVariablesTab.noVariablesFound') }}
            />
          </Spin>
          
          <div style={{ 
            marginTop: 16,
            padding: '12px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '6px',
            fontSize: '12px',
            color: '#666'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('recipientSelector.processVariablesTab.instructions.title')}：</div>
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              <li>{t('recipientSelector.processVariablesTab.instructions.items.0')}</li>
              <li>{t('recipientSelector.processVariablesTab.instructions.items.1')}</li>
              <li>{t('recipientSelector.processVariablesTab.instructions.items.2')}</li>
              <li>{t('recipientSelector.processVariablesTab.instructions.items.3')}</li>
              <li>{t('recipientSelector.processVariablesTab.instructions.items.4')}</li>
            </ul>
          </div>
        </TabPane>

        {/* Workflow Initiator Tab */}
        <TabPane tab={<><PlayCircleOutlined /> {t('recipientSelector.initiators')}</>} key="initiators">
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Checkbox
                checked={useInitiator}
                onChange={(e) => setUseInitiator(e.target.checked)}
                style={{ marginRight: 12 }}
              />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{t('recipientSelector.initiatorsTab.useInitiator')}</div>
                <div style={{ color: '#666', fontSize: '12px', marginTop: 4 }}>
                  {t('recipientSelector.initiatorsTab.description')}
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
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('recipientSelector.initiatorsTab.instructions.title')}：</div>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                <li>{t('recipientSelector.initiatorsTab.instructions.items.0')}</li>
                <li>{t('recipientSelector.initiatorsTab.instructions.items.1')}</li>
                <li>{t('recipientSelector.initiatorsTab.instructions.items.2')}</li>
              </ul>
            </div>
          </Card>
        </TabPane>
      </Tabs>

      {/* 確認按鈕 */}
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button onClick={handleClearAll}>{t('recipientSelector.clear')}</Button>
          <Button type="primary" onClick={updateRecipientValue}>
            {t('recipientSelector.confirmSelection')}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default RecipientSelector;