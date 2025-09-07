import React from 'react';
import { Button, Typography, Space, Dropdown, Menu } from 'antd';
import { 
  SaveOutlined, 
  ArrowLeftOutlined, 
  SettingOutlined, 
  CopyOutlined, 
  SnippetsOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignBottomOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

// 頂部工具欄組件
const Toolbar = ({ 
  onSave, 
  onOpenProcessVariables, 
  onCopyNodes,
  onPasteNodes,
  onAlignNodes,
  selectedNodes,
  t 
}) => {
  const navigate = useNavigate();

  // 對齊選單
  const alignMenu = (
    <Menu
      onClick={({ key }) => onAlignNodes(key)}
      items={[
        {
          key: 'align-left',
          icon: <AlignLeftOutlined />,
          label: t('workflowDesigner.alignLeft'),
        },
        {
          key: 'align-center',
          icon: <AlignCenterOutlined />,
          label: t('workflowDesigner.alignCenter'),
        },
        {
          key: 'align-right',
          icon: <AlignRightOutlined />,
          label: t('workflowDesigner.alignRight'),
        },
        {
          type: 'divider',
        },
        {
          key: 'align-top',
          icon: <VerticalAlignTopOutlined />,
          label: t('workflowDesigner.alignTop'),
        },
        {
          key: 'align-middle',
          icon: <VerticalAlignMiddleOutlined />,
          label: t('workflowDesigner.alignMiddle'),
        },
        {
          key: 'align-bottom',
          icon: <VerticalAlignBottomOutlined />,
          label: t('workflowDesigner.alignBottom'),
        },
      ]}
    />
  );

  return (
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
          onClick={() => navigate('/workflow-list')} 
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
          onClick={onSave}
          style={{
            height: '32px',
            width: '32px',
            padding: '0'
          }}
        />
        <Button
          icon={<SettingOutlined />}
          onClick={onOpenProcessVariables}
          style={{
            height: '32px',
            width: '32px',
            padding: '0'
          }}
          title={t('processVariables.manageProcessVariables')}
        />
        
        {/* 複製貼上按鈕 */}
        <Space.Compact>
          <Button
            icon={<CopyOutlined />}
            onClick={onCopyNodes}
            disabled={!selectedNodes || selectedNodes.length === 0}
            style={{
              height: '32px',
              width: '32px',
              padding: '0'
            }}
            title={t('workflowDesigner.copyNodes')}
          />
          <Button
            icon={<SnippetsOutlined />}
            onClick={onPasteNodes}
            style={{
              height: '32px',
              width: '32px',
              padding: '0'
            }}
            title={t('workflowDesigner.pasteNodes')}
          />
        </Space.Compact>
        
        {/* 對齊按鈕 */}
        <Dropdown 
          overlay={alignMenu} 
          trigger={['click']}
          disabled={!selectedNodes || selectedNodes.length < 2}
        >
          <Button
            icon={<AlignLeftOutlined />}
            style={{
              height: '32px',
              width: '32px',
              padding: '0'
            }}
            title={t('workflowDesigner.alignNodes')}
          />
        </Dropdown>
      </div>
        
      <Title level={4} style={{ margin: 0 }}>{t('workflowDesigner.title')}</Title>
    </div>
  );
};

export default Toolbar;
