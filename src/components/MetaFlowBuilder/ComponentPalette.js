import React from 'react';
import { Card, Space, Divider } from 'antd';
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
  { type: 'text_input', label: '文字輸入', icon: <EditOutlined />, color: '#fa8c16', category: '輸入' },
  { type: 'date_picker', label: '日期選擇', icon: <CalendarOutlined />, color: '#13c2c2', category: '輸入' },
  { type: 'calendar_picker', label: '日曆選擇', icon: <CalendarOutlined />, color: '#13c2c2', category: '輸入' },
  // time_picker 已移除 - 不在官方支持的組件列表中
  
  // 選擇組件
  { type: 'select', label: '下拉選擇', icon: <SelectOutlined />, color: '#2f54eb', category: '選擇' },
  { type: 'checkbox', label: '複選框組', icon: <CheckSquareOutlined />, color: '#722ed1', category: '選擇' },
  { type: 'radio', label: '單選框組', icon: <DotChartOutlined />, color: '#eb2f96', category: '選擇' },
  { type: 'chips_selector', label: '小標籤選擇器', icon: <BlockOutlined />, color: '#a0d911', category: '選擇' },
  
  // button 已移除 - 根據 API 錯誤，Button 類型可能不支持
  
  // 媒體組件
  { type: 'image', label: '圖片', icon: <PictureOutlined />, color: '#52c41a', category: '媒體' },
  { type: 'image_carousel', label: '圖片輪播', icon: <PicRightOutlined />, color: '#52c41a', category: '媒體' },
  // video 已移除 - 不在官方支持的組件列表中
  // document 已移除 - 不在官方支持的組件列表中
  
  // 媒體上傳組件（從 Flow JSON version 4.0 開始支持）
  { type: 'photo_picker', label: '照片選擇器', icon: <CameraOutlined />, color: '#52c41a', category: '媒體上傳' },
  { type: 'document_picker', label: '文檔選擇器', icon: <UploadOutlined />, color: '#1890ff', category: '媒體上傳' },
  
  // 鏈接組件
  { type: 'embedded_link', label: '嵌入式鏈接', icon: <LinkOutlined />, color: '#13c2c2', category: '鏈接' },
  { type: 'opt_in', label: '選擇加入', icon: <CheckCircleOutlined />, color: '#f5222d', category: '鏈接' },
  
  // 邏輯組件
  { type: 'if', label: '條件判斷 (If)', icon: <QuestionCircleOutlined />, color: '#faad14', category: '邏輯' },
  { type: 'switch', label: '條件渲染 (Switch)', icon: <BranchesOutlined />, color: '#2f54eb', category: '邏輯' },
  
  // 容器組件
  { type: 'navigation_list', label: '導航列表', icon: <OrderedListOutlined />, color: '#08979c', category: '容器' },
  
  // 文本顯示組件（只讀，不支持輸入）
  { type: 'rich_text', label: '富文本顯示', icon: <FileTextOutlined />, color: '#722ed1', category: '文本顯示' }
];

const ComponentPalette = ({ onAddComponent }) => {
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
    const category = comp.category || '其他';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(comp);
    return acc;
  }, {});

  return (
    <div>
      <h4 style={{ marginBottom: '12px' }}>組件庫</h4>
      <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        {Object.entries(groupedComponents).map(([category, components]) => (
          <div key={category} style={{ marginBottom: '16px' }}>
            <Divider orientation="left" style={{ margin: '8px 0', fontSize: '12px', color: '#8c8c8c' }}>
              {category}
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

