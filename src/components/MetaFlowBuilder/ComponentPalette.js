import React from 'react';
import { Card, Space, Divider } from 'antd';
import { useLanguage } from '../../contexts/LanguageContext';
import { 
  EditOutlined, 
  FileTextOutlined, 
  SelectOutlined, 
  CheckSquareOutlined, 
  DotChartOutlined,
  PictureOutlined,
  CalendarOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  BranchesOutlined,
  CameraOutlined,
  UploadOutlined,
  QuestionCircleOutlined,
  OrderedListOutlined,
  BlockOutlined,
  PicRightOutlined
} from '@ant-design/icons';

// 根據官方文檔：https://developers.facebook.com/docs/whatsapp/flows/reference/components
// 只包含官方支持的組件類型
// 注意：TextHeading、TextBody、Footer 是 screen 的基礎結構元素，不應作為可選組件
// 它們通過 Screen 屬性編輯器（右側面板）來編輯，而不是從組件庫添加
const COMPONENT_TYPES = [
  // 輸入組件
  { type: 'text_input', labelKey: 'textInput', icon: <EditOutlined />, color: '#fa8c16', categoryKey: 'input' },
  { type: 'date_picker', labelKey: 'datePicker', icon: <CalendarOutlined />, color: '#13c2c2', categoryKey: 'input' },
  { type: 'calendar_picker', labelKey: 'calendarPicker', icon: <CalendarOutlined />, color: '#13c2c2', categoryKey: 'input' },
  // time_picker 已移除 - 不在官方支持的組件列表中
  
  // 選擇組件
  { type: 'select', labelKey: 'select', icon: <SelectOutlined />, color: '#2f54eb', categoryKey: 'select' },
  { type: 'checkbox', labelKey: 'checkbox', icon: <CheckSquareOutlined />, color: '#722ed1', categoryKey: 'select' },
  { type: 'radio', labelKey: 'radio', icon: <DotChartOutlined />, color: '#eb2f96', categoryKey: 'select' },
  { type: 'chips_selector', labelKey: 'chipsSelector', icon: <BlockOutlined />, color: '#a0d911', categoryKey: 'select' },
  
  // button 已移除 - 根據 API 錯誤，Button 類型可能不支持
  
  // 媒體組件
  { type: 'image', labelKey: 'image', icon: <PictureOutlined />, color: '#52c41a', categoryKey: 'media' },
  { type: 'image_carousel', labelKey: 'imageCarousel', icon: <PicRightOutlined />, color: '#52c41a', categoryKey: 'media' },
  // video 已移除 - 不在官方支持的組件列表中
  // document 已移除 - 不在官方支持的組件列表中
  
  // 媒體上傳組件（從 Flow JSON version 4.0 開始支持）
  { type: 'photo_picker', labelKey: 'photoPicker', icon: <CameraOutlined />, color: '#52c41a', categoryKey: 'mediaUpload' },
  { type: 'document_picker', labelKey: 'documentPicker', icon: <UploadOutlined />, color: '#1890ff', categoryKey: 'mediaUpload' },
  
  // 鏈接組件
  { type: 'embedded_link', labelKey: 'embeddedLink', icon: <LinkOutlined />, color: '#13c2c2', categoryKey: 'link' },
  { type: 'opt_in', labelKey: 'optIn', icon: <CheckCircleOutlined />, color: '#f5222d', categoryKey: 'link' },
  
  // 邏輯組件
  { type: 'if', labelKey: 'if', icon: <QuestionCircleOutlined />, color: '#faad14', categoryKey: 'logic' },
  { type: 'switch', labelKey: 'switch', icon: <BranchesOutlined />, color: '#2f54eb', categoryKey: 'logic' },
  
  // 容器組件
  { type: 'navigation_list', labelKey: 'navigationList', icon: <OrderedListOutlined />, color: '#08979c', categoryKey: 'container' },
  
  // 文本顯示組件（只讀，不支持輸入）
  { type: 'rich_text', labelKey: 'richText', icon: <FileTextOutlined />, color: '#722ed1', categoryKey: 'textDisplay' }
];

const ComponentPalette = ({ onAddComponent }) => {
  const { t } = useLanguage();
  const handleDragStart = (e, componentType) => {
    e.dataTransfer.setData('application/metaflow-component', componentType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleClick = (componentType) => {
    if (onAddComponent) {
      onAddComponent(componentType);
    }
  };

  // 按類別分組組件
  const groupedComponents = COMPONENT_TYPES.reduce((acc, comp) => {
    const category = comp.categoryKey || 'other';
    const categoryLabel = t(`metaFlowBuilder.componentPalette.categories.${category}`);
    if (!acc[category]) {
      acc[category] = { label: categoryLabel, components: [] };
    }
    const label = t(`metaFlowBuilder.componentPalette.componentLabels.${comp.labelKey}`);
    acc[category].components.push({ ...comp, label });
    return acc;
  }, {});

  return (
    <div>
      <h4 style={{ marginBottom: '12px' }}>{t('metaFlowBuilder.componentPalette.sectionTitles.componentLibrary')}</h4>
      <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        {Object.entries(groupedComponents).map(([category, { label: categoryLabel, components }]) => (
          <div key={category} style={{ marginBottom: '16px' }}>
            <Divider orientation="left" style={{ margin: '8px 0', fontSize: '12px', color: '#8c8c8c' }}>
              {categoryLabel}
            </Divider>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {components.map(comp => (
                <Card
                  key={comp.type}
                  size="small"
                  hoverable
                  draggable
                  onDragStart={(e) => handleDragStart(e, comp.type)}
                  onClick={() => handleClick(comp.type)}
                  style={{
                    cursor: 'grab',
                    border: `1px solid ${comp.color}`,
                    backgroundColor: 'white'
                  }}
                  bodyStyle={{ padding: '12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: comp.color, fontSize: '18px' }}>{comp.icon}</span>
                    <span style={{ fontWeight: 500 }}>{comp.label}</span>
                  </div>
                </Card>
              ))}
            </Space>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComponentPalette;

