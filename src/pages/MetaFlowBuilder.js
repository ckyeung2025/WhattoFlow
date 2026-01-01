import React, { useState, useEffect } from 'react';
import { Button, Space, message, Typography, Input, Card } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  generateMetaFlowJson, 
  parseMetaFlowJson, 
  validateMetaFlowJson,
  getDefaultScreen,
  getDefaultComponent,
  createMetaFlowRequest,
  createMetaFlowUpdateRequest
} from '../utils/metaFlowUtils';
import ComponentPalette from '../components/MetaFlowBuilder/ComponentPalette';
import ScreenEditor from '../components/MetaFlowBuilder/ScreenEditor';
import ComponentPropertyEditor from '../components/MetaFlowBuilder/ComponentPropertyEditor';

const { Title } = Typography;
const { TextArea } = Input;

// 添加紫色返回按鈕的 hover 樣式
const purpleButtonStyle = `
  .purple-back-button:hover {
    background-color: #8c4dd4 !important;
    border-color: #8c4dd4 !important;
  }
`;

const MetaFlowBuilder = ({ initialSchema, onSave, onBack }) => {
  const { t } = useLanguage();
  
  // 將組件 type 映射到翻譯鍵
  const getComponentLabel = (componentType) => {
    const typeToLabelKey = {
      'text_input': 'textInput',
      'date_picker': 'datePicker',
      'calendar_picker': 'calendarPicker',
      'select': 'select',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'chips_selector': 'chipsSelector',
      'image': 'image',
      'image_carousel': 'imageCarousel',
      'photo_picker': 'photoPicker',
      'document_picker': 'documentPicker',
      'embedded_link': 'embeddedLink',
      'opt_in': 'optIn',
      'if': 'if',
      'switch': 'switch',
      'navigation_list': 'navigationList',
      'rich_text': 'richText'
    };
    const labelKey = typeToLabelKey[componentType];
    if (labelKey) {
      return t(`metaFlowBuilder.componentPalette.componentLabels.${labelKey}`);
    }
    return componentType; // 如果沒有對應的翻譯鍵，返回原始 type
  };
  
  // 檢查 title 是否為默認值（硬編碼的中文）
  const isDefaultTitle = (title, componentType) => {
    const defaultTitles = {
      'text_input': '文字輸入',
      'date_picker': '日期選擇',
      'calendar_picker': '日曆選擇',
      'time_picker': '時間選擇',
      'select': '下拉選擇',
      'checkbox': '複選框組',
      'radio': '單選框組',
      'chips_selector': '小標籤選擇器',
      'image': '圖片',
      'image_carousel': '圖片輪播',
      'photo_picker': '照片選擇器',
      'document_picker': '文檔選擇器',
      'embedded_link': '嵌入式鏈接',
      'opt_in': '選擇加入',
      'if': '條件判斷 (If)',
      'switch': '條件渲染 (Switch)',
      'navigation_list': '導航列表',
      'rich_text': '富文本顯示'
    };
    return title === defaultTitles[componentType];
  };
  
  // 獲取組件顯示標題（如果 title 是默認值，使用翻譯；否則使用用戶自定義的 title）
  const getComponentDisplayTitle = (component) => {
    if (component.title && !isDefaultTitle(component.title, component.type)) {
      // 如果 title 存在且不是默認值，使用用戶自定義的 title
      return component.title;
    }
    // 否則使用翻譯後的標籤
    return getComponentLabel(component.type);
  };
  
  // 獲取 Screen 顯示標題（如果 title 是默認值，使用翻譯；否則使用用戶自定義的 title）
  const getScreenDisplayTitle = (screen) => {
    const defaultScreenTitle = t('metaFlowBuilder.page.defaultScreenTitle');
    if (screen.title && screen.title !== '新 Screen' && screen.title !== defaultScreenTitle) {
      // 如果 title 存在且不是默認值，使用用戶自定義的 title
      return screen.title;
    }
    // 否則使用翻譯後的標籤
    return defaultScreenTitle;
  };
  
  // 基本狀態
  const [flowName, setFlowName] = useState(initialSchema?.name || t('metaFlowBuilder.page.defaultFlowName'));
  const [flowDescription, setFlowDescription] = useState(initialSchema?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Flow 數據狀態
  const [flowData, setFlowData] = useState({
    name: initialSchema?.name || t('metaFlowBuilder.page.defaultFlowName'),
    categories: ['LEAD_GENERATION'],
    screens: initialSchema?.metaFlowJson ? 
      parseMetaFlowJson(initialSchema.metaFlowJson).screens : 
      [getDefaultScreen()]
  });
  
  // 編輯相關狀態
  const [isEditing, setIsEditing] = useState(!!initialSchema?.id);
  const [formId, setFormId] = useState(initialSchema?.id || null);
  const [metaFlowId, setMetaFlowId] = useState(initialSchema?.metaFlowId || null);
  
  // 選中狀態
  const [selectedScreen, setSelectedScreen] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);
  
  // 當 selectedScreen 改變時，同步到 flowData
  useEffect(() => {
    if (selectedScreen) {
      setFlowData(prev => {
        const updatedScreens = prev.screens.map(s => 
          s.id === selectedScreen.id ? selectedScreen : s
        );
        console.log('🔄 同步 selectedScreen 到 flowData:', {
          screenId: selectedScreen.id,
          screenTitle: selectedScreen.title,
          actionsCount: selectedScreen.data?.actions?.length || 0,
          totalScreens: updatedScreens.length
        });
        return {
          ...prev,
          screens: updatedScreens
        };
      });
    }
  }, [selectedScreen]);

  // 當 flowData.screens 更新時，如果沒有選中的 screen，自動選中第一個
  useEffect(() => {
    if (flowData.screens && flowData.screens.length > 0 && !selectedScreen) {
      console.log('🔄 自動選中第一個 Screen（因為沒有選中的 screen）');
      setSelectedScreen(flowData.screens[0]);
    }
  }, [flowData.screens, selectedScreen]);
  
  // JSON 預覽狀態
  const [jsonPreviewVisible, setJsonPreviewVisible] = useState(false);
  
  // 側邊欄收合狀態
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // 監聽側邊欄收合狀態
  useEffect(() => {
    const checkSidebarState = () => {
      const sider = document.querySelector('.ant-layout-sider');
      if (sider) {
        const isCollapsed = sider.classList.contains('ant-layout-sider-collapsed');
        setSidebarCollapsed(isCollapsed);
      }
    };
    
    // 初始檢查
    checkSidebarState();
    
    // 監聽 DOM 變化
    const observer = new MutationObserver(checkSidebarState);
    const sider = document.querySelector('.ant-layout-sider');
    if (sider) {
      observer.observe(sider, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
    
    // 監聽窗口大小變化
    window.addEventListener('resize', checkSidebarState);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkSidebarState);
    };
  }, []);
  
  // 載入表單內容
  useEffect(() => {
    if (initialSchema?.id && initialSchema?.formType === 'MetaFlows') {
      setIsLoading(true);
      
      // 如果 initialSchema 已經包含 metaFlowJson，直接使用
      if (initialSchema.metaFlowJson) {
        try {
          console.log('📥 從 initialSchema 載入 metaFlowJson:', initialSchema.metaFlowJson);
          const parsed = parseMetaFlowJson(initialSchema.metaFlowJson);
          console.log('📥 解析後的數據:', parsed);
          console.log('📥 Screens 數量:', parsed.screens?.length || 0);
          
          // 確保 parsed 包含 name（優先使用表單的 name，如果 JSON 中沒有）
          const parsedWithName = {
            ...parsed,
            name: parsed.name || initialSchema.name || t('metaFlowBuilder.page.defaultFlowName')
          };
          setFlowData(parsedWithName);
          setFlowName(parsedWithName.name);
          setFlowDescription(initialSchema.description || '');
          if (initialSchema.metaFlowId) {
            setMetaFlowId(initialSchema.metaFlowId);
          }
          setIsEditing(true);
          setFormId(initialSchema.id);
          
          // 如果有 screens，自動選中第一個
          if (parsed.screens && parsed.screens.length > 0) {
            console.log('📥 自動選中第一個 Screen:', parsed.screens[0].id);
            setSelectedScreen(parsed.screens[0]);
          }
          
          setIsLoading(false);
          message.success('表單內容載入成功！');
          return;
        } catch (error) {
          console.error('解析 initialSchema 的 metaFlowJson 失敗:', error);
          // 如果解析失敗，繼續從 API 加載
        }
      }
      
      // 否則從 API 加載
      loadFormContent(initialSchema.id);
    } else if (initialSchema?.formType === 'MetaFlows' && initialSchema?.metaFlowJson) {
      // 新表單但有初始 JSON（不應該發生，但處理一下）
      try {
        const parsed = parseMetaFlowJson(initialSchema.metaFlowJson);
        setFlowData(parsed);
        setFlowName(parsed.name || initialSchema.name);
        // 如果有 screens，自動選中第一個
        if (parsed.screens && parsed.screens.length > 0) {
          setSelectedScreen(parsed.screens[0]);
        }
      } catch (error) {
        console.error('解析初始 metaFlowJson 失敗:', error);
      }
    }
  }, [initialSchema?.id, initialSchema?.metaFlowJson]);
  
  // 載入表單內容的函數
  const loadFormContent = async (formId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('請先登入');
        return;
      }

      // 從數據庫獲取（不使用 fromApi，因為我們要使用保存的 JSON，而不是 Meta API 的響應）
      const response = await fetch(`/api/eforms/${formId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const formData = await response.json();
      console.log('📥 載入的表單數據:', formData);
      console.log('📥 metaFlowJson 類型:', typeof formData.metaFlowJson);
      console.log('📥 metaFlowJson 內容:', formData.metaFlowJson);

      // 更新表單內容
      if (formData.metaFlowJson) {
        try {
          const parsed = parseMetaFlowJson(formData.metaFlowJson);
          console.log('📥 解析後的 Flow 數據:', parsed);
          console.log('📥 Screens 數量:', parsed.screens?.length || 0);
          if (parsed.screens && parsed.screens.length > 0) {
            console.log('📥 第一個 Screen:', JSON.stringify(parsed.screens[0], null, 2));
          }
          
          // 確保 parsed 包含 name（優先使用表單的 name，如果 JSON 中沒有）
          const parsedWithName = {
            ...parsed,
            name: parsed.name || formData.name || t('metaFlowBuilder.page.defaultFlowName')
          };
          setFlowData(parsedWithName);
          setFlowName(parsedWithName.name);
          
          // 如果有 screens，選中第一個
          if (parsedWithName.screens && parsedWithName.screens.length > 0) {
            setSelectedScreen(parsedWithName.screens[0]);
          }
        } catch (error) {
          console.error('❌ 解析 Meta Flow JSON 失敗:', error);
          console.error('❌ 錯誤詳情:', error.message);
          console.error('❌ 原始 JSON:', formData.metaFlowJson);
          message.error('解析 Flow JSON 失敗: ' + error.message);
        }
      } else {
        console.warn('⚠️ 表單數據中沒有 metaFlowJson');
      }
      
      if (formData.name) {
        setFlowName(formData.name);
      }
      
      if (formData.description) {
        setFlowDescription(formData.description);
      }
      
      if (formData.metaFlowId) {
        setMetaFlowId(formData.metaFlowId);
      }
      
      setIsEditing(true);
      setFormId(formData.id);

      message.success('表單內容載入成功！');
    } catch (error) {
      console.error('❌ 載入表單內容失敗:', error);
      message.error('載入表單內容失敗: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 保存表單
  const handleSave = async () => {
    try {
      // 確保有 Flow 名稱
      if (!flowName || flowName.trim() === '') {
        message.error(t('metaFlowBuilder.page.messages.flowNameRequired'));
        return;
      }

      // 確保 selectedScreen 的更改已同步到 flowData
      let finalFlowData = { ...flowData };
      if (selectedScreen) {
        finalFlowData = {
          ...flowData,
          screens: flowData.screens.map(s => 
            s.id === selectedScreen.id ? selectedScreen : s
          )
        };
      }

      // 確保 finalFlowData 包含 name（使用 flowName）
      finalFlowData = {
        ...finalFlowData,
        name: flowName || finalFlowData.name || t('metaFlowBuilder.page.defaultFlowName')
      };

      setIsSaving(true);

      // 生成 Meta Flow JSON - 使用最新的數據（已經包含 name）
      // 注意：Meta API 的 JSON body 不應該包含 name 和 categories（它們是 API 參數）
      // 但後端需要這些字段來構建 MetaFlowCreateRequest，所以我們在 JSON 中包含它們
      // 後端會正確處理這些字段
      const metaFlowJson = generateMetaFlowJson(finalFlowData);
      
      // 驗證 Flow 數據
      const validation = validateMetaFlowJson(metaFlowJson);
      if (!validation.valid) {
        setIsSaving(false);
        console.error('❌ Flow JSON 驗證失敗:');
        validation.errors.forEach((error, index) => {
          console.error(`   ${index + 1}. ${error}`);
        });
        message.error({
          content: `Flow 數據驗證失敗:\n${validation.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
          duration: 15, // 顯示 15 秒
          style: { whiteSpace: 'pre-wrap', maxWidth: '600px' }
        });
        return;
      }
      
      console.log('✅ Flow JSON 驗證通過');
      
      // 添加 name 和 categories 到 JSON（後端需要）
      const fullMetaFlowJson = {
        ...metaFlowJson,
        name: flowName || finalFlowData.name || t('metaFlowBuilder.page.defaultFlowName'),
        categories: finalFlowData.categories || ['LEAD_GENERATION']
      };

      console.log('📤 準備保存的 Flow 數據:', finalFlowData);
      console.log('📤 生成的 Meta Flow JSON:', fullMetaFlowJson);
      console.log('📤 Screens 數量:', fullMetaFlowJson.screens?.length || 0);
      if (fullMetaFlowJson.screens && fullMetaFlowJson.screens.length > 0) {
        console.log('📤 第一個 Screen:', JSON.stringify(fullMetaFlowJson.screens[0], null, 2));
      }

      const formData = {
        name: flowName,
        description: flowDescription,
        formType: 'MetaFlows',
        metaFlowJson: JSON.stringify(fullMetaFlowJson),
        status: 'A',
        RStatus: 'A'
      };

      // 如果是編輯模式，添加 updatedAt
      if (isEditing) {
        formData.updatedAt = new Date().toISOString();
      }

      console.log('📤 發送保存請求:', {
        ...formData,
        metaFlowJson: metaFlowJson // 顯示解析後的 JSON，而不是字符串
      });

      const token = localStorage.getItem('token');
      const url = isEditing ? `/api/eforms/${formId}` : '/api/eforms';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      console.log('📥 收到響應:', response.status, response.statusText);

      if (!response.ok) {
        let errorText = '';
        let errorData = null;
        
        try {
          errorText = await response.text();
          // 嘗試解析為 JSON
          try {
            errorData = JSON.parse(errorText);
          } catch {
            // 如果不是 JSON，使用原始文本
            errorData = { error: errorText };
          }
        } catch (e) {
          errorText = '無法讀取錯誤響應';
          errorData = { error: errorText };
        }
        
        // 構建詳細的錯誤消息
        let errorMessage = `HTTP ${response.status}: `;
        if (errorData?.error) {
          errorMessage += errorData.error;
        } else if (errorData?.message) {
          errorMessage += errorData.message;
        } else {
          errorMessage += errorText;
        }
        
        // 如果有詳細信息，添加到消息中
        if (errorData?.details) {
          console.error('❌ 詳細錯誤信息:', errorData.details);
        }
        
        // 如果有請求 JSON，記錄以便調試
        if (errorData?.requestJson) {
          console.error('❌ 失敗的請求 JSON:', errorData.requestJson);
        }
        
        // 顯示詳細錯誤
        message.error({
          content: errorMessage,
          duration: 10, // 顯示 10 秒
          style: { whiteSpace: 'pre-wrap' } // 允許換行
        });
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('📥 解析響應:', result);

      if (result && result.id) {
        setIsEditing(true);
        setFormId(result.id);
        if (result.metaFlowId) {
          setMetaFlowId(result.metaFlowId);
        }
        
        message.success('✅ 表單保存成功！');
        onSave && onSave();
      } else {
        message.error('❌ 保存失敗: 響應格式錯誤');
      }
    } catch (error) {
      console.error('❌ 保存錯誤:', error);
      message.error('❌ 保存失敗: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 添加新 Screen
  const handleAddScreen = () => {
    const newScreen = getDefaultScreen();
    setFlowData(prev => ({
      ...prev,
      screens: [...prev.screens, newScreen]
    }));
    setSelectedScreen(newScreen);
    message.success(t('metaFlowBuilder.page.messages.screenAdded'));
  };

  // 更新 Screen
  const handleUpdateScreen = (updatedScreen) => {
    setSelectedScreen(updatedScreen);
    setFlowData(prev => ({
      ...prev,
      screens: prev.screens.map(s => 
        s.id === updatedScreen.id ? updatedScreen : s
      )
    }));
  };

  // 添加組件到當前 Screen
  const handleAddComponent = (componentType) => {
    if (!selectedScreen) {
      message.warning(t('metaFlowBuilder.page.messages.selectScreenFirst'));
      return;
    }
    // 傳入現有組件列表，以便生成唯一的 name
    const currentActions = selectedScreen.data?.actions || [];
    const newComponent = getDefaultComponent(componentType, null, currentActions);
    const updatedScreen = {
      ...selectedScreen,
      data: {
        ...selectedScreen.data,
        actions: [...currentActions, newComponent]
      }
    };
    handleUpdateScreen(updatedScreen);
    message.success(`已添加 ${componentType} 組件`);
  };

  // 刪除 Screen
  const handleDeleteScreen = (screenId) => {
    setFlowData(prev => ({
      ...prev,
      screens: prev.screens.filter(s => s.id !== screenId)
    }));
    if (selectedScreen?.id === screenId) {
      setSelectedScreen(null);
    }
    message.success('已刪除 Screen');
  };

  // 如果正在載入，顯示載入狀態
  if (isLoading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>載入表單內容中...</div>
        <div style={{ fontSize: '14px', color: '#999' }}>請稍候</div>
      </div>
    );
  }

  // 容器樣式 - 使用 100% 寬度適應父容器（父容器已經處理了側邊欄的 margin）
  const containerStyle = {
    height: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };
  
  return (
    <div style={containerStyle}>
      {/* 樣式 */}
      <style>{purpleButtonStyle}</style>
      
      {/* 頂部工具欄 */}
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid #e8e8e8', 
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            className="purple-back-button"
            style={{ 
              backgroundColor: '#722ed1', 
              borderColor: '#722ed1',
              color: 'white',
              height: '32px',
              width: '32px',
              padding: '0'
            }}
          />
          <Button
            icon={<SaveOutlined />}
            type="primary"
            onClick={handleSave}
            loading={isSaving}
            style={{
              height: '32px',
              width: '32px',
              padding: '0'
            }}
          />
          <Button
            icon={<EyeOutlined />}
            type="default"
            onClick={() => setJsonPreviewVisible(!jsonPreviewVisible)}
            style={{
              height: '32px',
              width: '32px',
              padding: '0'
            }}
            title="JSON 預覽"
          />
        </div>
        
        <Title level={4} style={{ margin: 0 }}>Meta Flow Builder</Title>
      </div>

      {/* 主要內容區域 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左側面板 - Screen 列表和組件庫 */}
        <div style={{ 
          width: '250px', 
          borderRight: '1px solid #e8e8e8',
          backgroundColor: '#fafafa',
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* 表單信息 */}
          <div>
            <h4>{t('metaFlowBuilder.page.formInfo')}</h4>
            <div style={{ marginBottom: '12px' }}>
              <label>{t('metaFlowBuilder.page.flowName')}</label>
              <Input
                value={flowName}
                onChange={(e) => {
                  setFlowName(e.target.value);
                  setFlowData(prev => ({ ...prev, name: e.target.value }));
                }}
                placeholder={t('metaFlowBuilder.page.flowNamePlaceholder')}
                style={{ marginTop: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>{t('metaFlowBuilder.page.description')}</label>
              <TextArea
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
                placeholder={t('metaFlowBuilder.page.descriptionPlaceholder')}
                rows={3}
                style={{ marginTop: '4px' }}
              />
            </div>
          </div>

          {/* Screen 列表 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>{t('metaFlowBuilder.page.screens')}</h4>
              <Button
                icon={<PlusOutlined />}
                size="small"
                onClick={handleAddScreen}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {flowData.screens.map((screen, index) => (
                <Card
                  key={screen.id}
                  size="small"
                  hoverable
                  onClick={() => {
                    // 從 flowData 中獲取最新的 screen 數據
                    const latestScreen = flowData.screens.find(s => s.id === screen.id);
                    setSelectedScreen(latestScreen || screen);
                  }}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: selectedScreen?.id === screen.id ? '#e6f7ff' : 'white',
                    border: selectedScreen?.id === screen.id ? '2px solid #1890ff' : '1px solid #d9d9d9'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{getScreenDisplayTitle(screen) || `Screen ${index + 1}`}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{screen.id}</div>
                    </div>
                    <Button
                      size="small"
                      danger
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteScreen(screen.id);
                      }}
                    >
                      {t('metaFlowBuilder.page.delete')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* 組件庫 */}
          <ComponentPalette onAddComponent={handleAddComponent} />
        </div>

        {/* 中間畫布區域 */}
        <div style={{ 
          flex: 1, 
          position: 'relative',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          overflow: 'auto'
        }}>
          {selectedScreen ? (
            <Card title={t('metaFlowBuilder.page.editScreen', { title: getScreenDisplayTitle(selectedScreen) || selectedScreen.id })}>
              <ScreenEditor
                screen={selectedScreen}
                onUpdate={handleUpdateScreen}
                onComponentSelect={(component) => {
                  setSelectedComponent(component);
                }}
                allScreens={flowData.screens}
              />
            </Card>
          ) : (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              color: '#999'
            }}>
              {t('metaFlowBuilder.page.selectScreenToEdit')}
            </div>
          )}
        </div>

        {/* 右側屬性編輯面板 */}
        {selectedScreen && (
          <div style={{
            width: '340px',
            borderLeft: '1px solid #e8e8e8',
            backgroundColor: 'white',
            overflowY: 'auto',
            padding: '20px'
          }}>
            {selectedComponent ? (
              <>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>{t('metaFlowBuilder.page.componentProperties')}</h3>
                  <Button size="small" onClick={() => setSelectedComponent(null)}>{t('metaFlowBuilder.page.back')}</Button>
                </div>
                <ComponentPropertyEditor
                  component={selectedComponent}
                  onUpdate={(updates) => {
                    // 更新組件
                    const updatedComponent = { ...selectedComponent, ...updates };
                    setSelectedComponent(updatedComponent);
                    
                    // 更新 Screen 中的組件（支持使用 id 或 name 來識別）
                    const componentIdentifier = selectedComponent.id || selectedComponent.name;
                    const updatedActions = selectedScreen.data?.actions?.map(comp =>
                      (comp.id || comp.name) === componentIdentifier ? updatedComponent : comp
                    ) || [];
                    
                    const updatedScreen = {
                      ...selectedScreen,
                      data: {
                        ...selectedScreen.data,
                        actions: updatedActions
                      }
                    };
                    
                    handleUpdateScreen(updatedScreen);
                    message.success(t('metaFlowBuilder.page.messages.componentUpdated'));
                  }}
                  screenId={selectedScreen.id}
                  allScreens={flowData.screens}
                />
              </>
            ) : (
              <>
                <h3>{t('metaFlowBuilder.page.screenProperties')}</h3>
                <div style={{ marginBottom: '16px' }}>
                  <label>{t('metaFlowBuilder.page.screenId')}</label>
                  <Input
                    value={selectedScreen.id}
                    disabled
                    style={{ marginTop: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label>{t('metaFlowBuilder.page.screenTitle')}</label>
                  <Input
                    value={selectedScreen.title && selectedScreen.title !== '新 Screen' ? selectedScreen.title : ''}
                    onChange={(e) => {
                      handleUpdateScreen({
                        ...selectedScreen,
                        title: e.target.value || '新 Screen'
                      });
                    }}
                    placeholder={t('metaFlowBuilder.page.defaultScreenTitle')}
                    style={{ marginTop: '4px' }}
                  />
                </div>
                <div style={{ marginTop: '24px' }}>
                  <h4>{t('metaFlowBuilder.page.componentList')}</h4>
                  {selectedScreen.data?.actions && selectedScreen.data.actions.length > 0 ? (
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      {selectedScreen.data.actions.map((comp, index) => {
                        // 從 flowData 中獲取最新的組件數據
                        const latestScreen = flowData.screens.find(s => s.id === selectedScreen.id);
                        const componentIdentifier = comp.id || comp.name;
                        const latestComponent = latestScreen?.data?.actions?.find(c => 
                          (c.id || c.name) === componentIdentifier
                        ) || comp;
                        return (
                        <Card
                          key={comp.id || comp.name || `comp_${index}`}
                          size="small"
                          hoverable
                          onClick={() => setSelectedComponent(latestComponent)}
                          style={{ 
                            cursor: 'pointer',
                            border: (selectedComponent?.id || selectedComponent?.name) === (comp.id || comp.name) 
                              ? '2px solid #1890ff' 
                              : '1px solid #d9d9d9'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{getComponentDisplayTitle(comp) || t('metaFlowBuilder.page.defaultComponentName', { index: index + 1 })}</div>
                              <div style={{ fontSize: '12px', color: '#666' }}>{comp.type}</div>
                            </div>
                            <Button
                              size="small"
                              danger
                              onClick={(e) => {
                                e.stopPropagation();
                                const componentIdentifier = comp.id || comp.name;
                                const updatedActions = selectedScreen.data.actions.filter(c => 
                                  (c.id || c.name) !== componentIdentifier
                                );
                                handleUpdateScreen({
                                  ...selectedScreen,
                                  data: {
                                    ...selectedScreen.data,
                                    actions: updatedActions
                                  }
                                });
                              }}
                            >
                              {t('metaFlowBuilder.page.delete')}
                            </Button>
                          </div>
                        </Card>
                        );
                      })}
                    </Space>
                  ) : (
                    <p style={{ color: '#999', fontSize: '12px' }}>{t('metaFlowBuilder.page.noComponents')}</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* JSON 預覽面板（底部） */}
      {jsonPreviewVisible && (
        <div style={{
          height: '300px',
          borderTop: '1px solid #e8e8e8',
          backgroundColor: '#fafafa',
          padding: '16px',
          overflow: 'auto'
        }}>
          <h4>JSON 預覽</h4>
          <pre style={{ 
            backgroundColor: 'white', 
            padding: '12px', 
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '12px'
          }}>
            {JSON.stringify(generateMetaFlowJson(flowData, t), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default MetaFlowBuilder;

