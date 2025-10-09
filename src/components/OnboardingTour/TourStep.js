import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Steps, Typography, Space, Tag, Alert, Divider } from 'antd';
import { 
  DashboardOutlined, 
  MessageOutlined, 
  DatabaseOutlined, 
  FileTextOutlined, 
  BranchesOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  ShoppingCartOutlined,
  RobotOutlined,
  UploadOutlined,
  DragOutlined,
  LinkOutlined,
  SettingOutlined,
  ArrowRightOutlined,
  RocketOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { VIDEO_URLS } from './videoConfig';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

const TourStep = ({ step, onNext, onPrev, onComplete }) => {
  const { t } = useLanguage();
  const [currentDemoStep, setCurrentDemoStep] = useState(0);
  const [isPlayingDemo, setIsPlayingDemo] = useState(true);


  // 模擬數據
  const mockData = {
    dashboard: {
      contacts: { total: 1234, new: 56 },
      workflows: { running: 12, completed: 1456 },
      forms: { pending: 8, approved: 234 },
      templates: { internal: 15, meta: 8 }
    },
    templates: {
      internal: [
        { name: t('onboarding.steps.messageTemplates.internalTemplates.welcome'), status: 'active', usage: 156 },
        { name: t('onboarding.steps.messageTemplates.internalTemplates.orderConfirm'), status: 'active', usage: 89 },
        { name: t('onboarding.steps.messageTemplates.internalTemplates.payment'), status: 'active', usage: 67 }
      ],
      meta: [
        { name: t('onboarding.steps.messageTemplates.metaTemplates.welcome_message'), status: 'APPROVED', usage: 234 },
        { name: t('onboarding.steps.messageTemplates.metaTemplates.order_confirmation'), status: 'PENDING', usage: 45 },
        { name: t('onboarding.steps.messageTemplates.metaTemplates.payment_reminder'), status: 'REJECTED', usage: 12 }
      ]
    },
    contacts: {
      list: [
        { name: t('onboarding.steps.contactManagement.sampleContacts.zhang'), phone: '+886-912-345-678', status: 'active' },
        { name: t('onboarding.steps.contactManagement.sampleContacts.li'), phone: '+886-987-654-321', status: 'active' },
        { name: t('onboarding.steps.contactManagement.sampleContacts.wang'), phone: '+886-955-123-456', status: 'inactive' },
        { name: t('onboarding.steps.contactManagement.sampleContacts.chen'), phone: '+886-933-789-012', status: 'active' }
      ],
      groups: [
        { name: t('onboarding.steps.contactManagement.sampleGroups.vip'), memberCount: 25, type: t('onboarding.steps.contactManagement.groupTypes.vip') },
        { name: t('onboarding.steps.contactManagement.sampleGroups.general'), memberCount: 156, type: t('onboarding.steps.contactManagement.groupTypes.general') },
        { name: t('onboarding.steps.contactManagement.sampleGroups.potential'), memberCount: 89, type: t('onboarding.steps.contactManagement.groupTypes.potential') }
      ],
      tags: [
        { name: t('onboarding.steps.contactManagement.sampleTags.highValue'), color: 'gold', count: 45 },
        { name: t('onboarding.steps.contactManagement.sampleTags.newCustomer'), color: 'green', count: 78 },
        { name: t('onboarding.steps.contactManagement.sampleTags.churnRisk'), color: 'red', count: 12 },
        { name: t('onboarding.steps.contactManagement.sampleTags.activeUser'), color: 'blue', count: 234 }
      ],
      stats: {
        total: 1234,
        active: 856,
        groups: 8,
        tags: 12
      }
    },
    datasets: {
      customers: { records: 1234, lastSync: '2024-01-15 10:30' },
      orders: { records: 567, lastSync: '2024-01-15 09:45' },
      products: { records: 89, lastSync: '2024-01-15 08:20' }
    }
  };

  // 自動播放演示 - 持續輪轉
  useEffect(() => {
    if (isPlayingDemo) {
      const timer = setTimeout(() => {
        setCurrentDemoStep(prev => {
          const demoSteps = getDemoSteps(step);
          const nextStep = (prev + 1) % demoSteps.length;
          console.log(`輪轉: 步驟 ${step}, 從 ${prev} 到 ${nextStep}, 總共 ${demoSteps.length} 個步驟`);
          return nextStep;
        });
      }, 3000); // 每3秒切換一次
      return () => clearTimeout(timer);
    }
  }, [isPlayingDemo, currentDemoStep, step]);

  const renderDemoVisual = (stepNumber, currentStep) => {
    const currentVideoUrl = VIDEO_URLS[stepNumber];
    
    if (currentVideoUrl) {
      // 如果有視頻 URL，只顯示視頻播放器
      return (
        <div className="video-player-container">
            <iframe
              src={currentVideoUrl}
              title={t('onboarding.steps.demoVideoTitle', { step: stepNumber + 1 })}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="demo-video"
              style={{ 
                width: '100%', 
                height: '100%', 
                border: 'none',
              borderRadius: '12px'
            }}
          />
        </div>
      );
    } else {
      // 暫時顯示佔位符，等待用戶提供視頻
      return (
        <div className="video-placeholder">
          <div className="placeholder-icon">🎥</div>
          <div className="placeholder-title">{t('onboarding.steps.demoVideo')}</div>
          <div className="placeholder-description">
            {t('onboarding.steps.preparingDemoVideo', { step: stepNumber + 1 })}
          </div>
          <div className="placeholder-note">
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {t('onboarding.steps.videoNote')}
            </Text>
          </div>
        </div>
      );
    }
  };

  const getDemoSteps = (stepNumber) => {
    const demos = {
      0: [
        { title: t('onboarding.steps.dashboard.demoSteps.0.title'), icon: <DashboardOutlined />, description: t('onboarding.steps.dashboard.demoSteps.0.description') },
        { title: t('onboarding.steps.dashboard.demoSteps.1.title'), icon: <PlayCircleOutlined />, description: t('onboarding.steps.dashboard.demoSteps.1.description') },
        { title: t('onboarding.steps.dashboard.demoSteps.2.title'), icon: <SettingOutlined />, description: t('onboarding.steps.dashboard.demoSteps.2.description') }
      ],
      1: [
        { title: t('onboarding.steps.messageTemplates.demoSteps.0.title'), icon: <MessageOutlined />, description: t('onboarding.steps.messageTemplates.demoSteps.0.description') },
        { title: t('onboarding.steps.messageTemplates.demoSteps.1.title'), icon: <FileTextOutlined />, description: t('onboarding.steps.messageTemplates.demoSteps.1.description') },
        { title: t('onboarding.steps.messageTemplates.demoSteps.2.title'), icon: <UserOutlined />, description: t('onboarding.steps.messageTemplates.demoSteps.2.description') },
        { title: t('onboarding.steps.messageTemplates.demoSteps.3.title'), icon: <CheckCircleOutlined />, description: t('onboarding.steps.messageTemplates.demoSteps.3.description') }
      ],
      2: [
        { title: t('onboarding.steps.contactManagement.demoSteps.0.title'), icon: <DatabaseOutlined />, description: t('onboarding.steps.contactManagement.demoSteps.0.description') },
        { title: t('onboarding.steps.contactManagement.demoSteps.1.title'), icon: <SettingOutlined />, description: t('onboarding.steps.contactManagement.demoSteps.1.description') },
        { title: t('onboarding.steps.contactManagement.demoSteps.2.title'), icon: <PlayCircleOutlined />, description: t('onboarding.steps.contactManagement.demoSteps.2.description') },
        { title: t('onboarding.steps.contactManagement.demoSteps.3.title'), icon: <CheckCircleOutlined />, description: t('onboarding.steps.contactManagement.demoSteps.3.description') }
      ],
      3: [
        { title: t('onboarding.steps.datasetManagement.demoSteps.0.title'), icon: <RobotOutlined />, description: t('onboarding.steps.datasetManagement.demoSteps.0.description') },
        { title: t('onboarding.steps.datasetManagement.demoSteps.1.title'), icon: <RobotOutlined />, description: t('onboarding.steps.datasetManagement.demoSteps.1.description') },
        { title: t('onboarding.steps.datasetManagement.demoSteps.2.title'), icon: <DragOutlined />, description: t('onboarding.steps.datasetManagement.demoSteps.2.description') },
        { title: t('onboarding.steps.datasetManagement.demoSteps.3.title'), icon: <PlayCircleOutlined />, description: t('onboarding.steps.datasetManagement.demoSteps.3.description') }
      ],
      4: [
        { title: t('onboarding.steps.formManagement.demoSteps.0.title'), icon: <PlayCircleOutlined />, description: t('onboarding.steps.formManagement.demoSteps.0.description') },
        { title: t('onboarding.steps.formManagement.demoSteps.1.title'), icon: <MessageOutlined />, description: t('onboarding.steps.formManagement.demoSteps.1.description') },
        { title: t('onboarding.steps.formManagement.demoSteps.2.title'), icon: <ClockCircleOutlined />, description: t('onboarding.steps.formManagement.demoSteps.2.description') },
        { title: t('onboarding.steps.formManagement.demoSteps.3.title'), icon: <BranchesOutlined />, description: t('onboarding.steps.formManagement.demoSteps.3.description') }
      ],
      5: [
        { title: t('onboarding.steps.workflowDesign.demoSteps.0.title'), icon: <PlayCircleOutlined />, description: t('onboarding.steps.workflowDesign.demoSteps.0.description') },
        { title: t('onboarding.steps.workflowDesign.demoSteps.1.title'), icon: <MessageOutlined />, description: t('onboarding.steps.workflowDesign.demoSteps.1.description') },
        { title: t('onboarding.steps.workflowDesign.demoSteps.2.title'), icon: <ClockCircleOutlined />, description: t('onboarding.steps.workflowDesign.demoSteps.2.description') },
        { title: t('onboarding.steps.workflowDesign.demoSteps.3.title'), icon: <BranchesOutlined />, description: t('onboarding.steps.workflowDesign.demoSteps.3.description') },
        { title: t('onboarding.steps.workflowDesign.demoSteps.4.title'), icon: <LinkOutlined />, description: t('onboarding.steps.workflowDesign.demoSteps.4.description') },
        { title: t('onboarding.steps.workflowDesign.demoSteps.5.title'), icon: <CheckCircleOutlined />, description: t('onboarding.steps.workflowDesign.demoSteps.5.description') }
      ]
    };
    return demos[stepNumber] || [];
  };

  const renderDashboardStep = () => (
    <div className="step-content">
      <div className="step-header">
        <div className="step-icon">
          <DashboardOutlined />
        </div>
        <div className="step-title-section">
          <Title level={3} className="step-title">{t('onboarding.steps.dashboard.title')}</Title>
          <Text className="step-description">
            {t('onboarding.steps.dashboard.description')}
          </Text>
        </div>
      </div>

      <div className="step-body">
        <Alert
          message={t('onboarding.steps.dashboard.alert.message')}
          description={t('onboarding.steps.dashboard.alert.description')}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card title={t('onboarding.steps.dashboard.cards.modules')} size="small">
              {/* 微縮版 Dashboard 佈局預覽 - 模擬實際佈局 */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px',
                padding: '8px'
              }}>
                {/* 主要功能區域 - 左右分佈 */}
                <div style={{ display: 'flex', gap: '12px', minHeight: '120px' }}>
                  {/* 左側 Application 應用區域 - 30% */}
                  <div style={{ flex: '0 0 30%' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)',
                      borderRadius: '8px',
                      padding: '12px',
                      border: '1px solid #E8E8E8',
                      minHeight: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <RocketOutlined style={{ fontSize: '16px', color: '#7234CF' }} />
                        <Text strong style={{ fontSize: '14px', color: '#333' }}>{t('onboarding.steps.dashboard.miniDashboard.application.title')}</Text>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ 
                          background: 'rgba(255,255,255,0.7)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#7234CF',
                          fontWeight: 'bold'
                        }}>3 {t('onboarding.steps.dashboard.miniDashboard.application.published')}</div>
                        <div style={{ 
                          background: 'rgba(255,255,255,0.7)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#fa8c16'
                        }}>2 {t('onboarding.steps.dashboard.miniDashboard.application.running')}</div>
                        <div style={{ 
                          background: 'rgba(255,255,255,0.7)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#52c41a'
                        }}>15 {t('onboarding.steps.dashboard.miniDashboard.application.completed')}</div>
                      </div>
                    </div>
                  </div>

                  {/* 右側數據分析和 Studio 區域 - 70% */}
                  <div style={{ flex: '0 0 70%', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px' }}>
                    {/* 數據分析區域 */}
                    <div style={{
                      background: 'linear-gradient(135deg, #F9F7FC 0%, #FFF 100%)',
                      borderRadius: '8px',
                      padding: '12px',
                      border: '1px solid #F0E7FF',
                      flex: '1'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <BarChartOutlined style={{ fontSize: '16px', color: '#7234CF' }} />
                        <Text strong style={{ fontSize: '14px', color: '#333' }}>{t('onboarding.steps.dashboard.miniDashboard.dataAnalysis.title')}</Text>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={{ 
                          background: 'rgba(114, 52, 207, 0.1)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#7234CF'
                        }}>📈 {t('onboarding.steps.dashboard.miniDashboard.dataAnalysis.trends')}</div>
                        <div style={{ 
                          background: 'rgba(114, 52, 207, 0.1)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#7234CF'
                        }}>🔥 {t('onboarding.steps.dashboard.miniDashboard.dataAnalysis.popular')}</div>
                        <div style={{ 
                          background: 'rgba(114, 52, 207, 0.1)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#7234CF'
                        }}>📊 {t('onboarding.steps.dashboard.miniDashboard.dataAnalysis.status')}</div>
                      </div>
                    </div>

                    {/* Studio 工作室區域 */}
                    <div style={{
                      background: '#F9F7FC',
                      borderRadius: '8px',
                      padding: '12px',
                      border: '1px solid #F9F7FC',
                      flex: '1'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <img 
                          src="/assets/wtf_robot.gif" 
                          alt="WTF Robot" 
                          style={{ width: '16px', height: '16px', objectFit: 'contain' }}
                        />
                        <Text strong style={{ fontSize: '14px', color: '#333' }}>{t('onboarding.steps.dashboard.miniDashboard.studio.title')}</Text>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <div style={{ 
                          background: 'rgba(255,255,255,0.7)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#7234CF'
                        }}>📝 {t('onboarding.steps.dashboard.miniDashboard.studio.forms')}</div>
                        <div style={{ 
                          background: 'rgba(255,255,255,0.7)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#7234CF'
                        }}>💬 {t('onboarding.steps.dashboard.miniDashboard.studio.templates')}</div>
                        <div style={{ 
                          background: 'rgba(255,255,255,0.7)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#7234CF'
                        }}>🔄 {t('onboarding.steps.dashboard.miniDashboard.studio.workflows')}</div>
                        <div style={{ 
                          background: 'rgba(255,255,255,0.7)', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#7234CF'
                        }}>📦 {t('onboarding.steps.dashboard.miniDashboard.studio.datasets')}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 管理工具區域 - 底部全寬 */}
                <div style={{
                  background: 'linear-gradient(135deg, #F0E7E2 0%, #EADFD9 100%)',
                  borderRadius: '8px',
                  padding: '12px',
                  border: '1px solid #E8E8E8'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <SettingOutlined style={{ fontSize: '16px', color: '#7234CF' }} />
                    <Text strong style={{ fontSize: '14px', color: '#333' }}>{t('onboarding.steps.dashboard.miniDashboard.management.title')}</Text>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.7)', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#7234CF'
                    }}>👥 {t('onboarding.steps.dashboard.miniDashboard.management.contacts')}</div>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.7)', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#7234CF'
                    }}>📢 {t('onboarding.steps.dashboard.miniDashboard.management.groups')}</div>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.7)', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#7234CF'
                    }}>🏷️ {t('onboarding.steps.dashboard.miniDashboard.management.tags')}</div>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.7)', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#7234CF'
                    }}>⚙️ {t('onboarding.steps.dashboard.miniDashboard.management.admin')}</div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

      </div>
    </div>
  );

  const renderTemplateStep = () => (
    <div className="step-content">
      <div className="step-header">
        <div className="step-icon">
          <MessageOutlined />
        </div>
        <div className="step-title-section">
          <Title level={3} className="step-title">{t('onboarding.steps.messageTemplates.title')}</Title>
          <Text className="step-description">
            {t('onboarding.steps.messageTemplates.description')}
          </Text>
        </div>
      </div>

      <div className="step-body">
        <Alert
          message={t('onboarding.steps.messageTemplates.alert.message')}
          description={t('onboarding.steps.messageTemplates.alert.description')}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Card title={t('onboarding.steps.messageTemplates.cards.internal')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {mockData.templates.internal.map((template, index) => (
                  <div key={index} className="template-item">
                    <Text strong>{template.name}</Text>
                    <Tag color="green">{template.status}</Tag>
                    <Text type="secondary">{t('onboarding.steps.messageTemplates.usage', { count: template.usage })}</Text>
                  </div>
                ))}
                <Button type="dashed" block icon={<MessageOutlined />}>
                  {t('onboarding.steps.messageTemplates.actions.addInternal')}
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card title={t('onboarding.steps.messageTemplates.cards.meta')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {mockData.templates.meta.map((template, index) => (
                  <div key={index} className="template-item">
                    <Text strong>{template.name}</Text>
                    <Tag color={
                      template.status === 'APPROVED' ? 'green' :
                      template.status === 'PENDING' ? 'orange' : 'red'
                    }>
                      {template.status}
                    </Tag>
                    <Text type="secondary">{t('onboarding.steps.messageTemplates.usage', { count: template.usage })}</Text>
                  </div>
                ))}
                <Button type="dashed" block icon={<MessageOutlined />}>
                  {t('onboarding.steps.messageTemplates.actions.addMeta')}
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>

      </div>
    </div>
  );

  const renderContactStep = () => (
    <div className="step-content">
      <div className="step-header">
        <div className="step-icon">
          <UserOutlined />
        </div>
        <div className="step-title-section">
          <Title level={3} className="step-title">{t('onboarding.steps.contactManagement.title')}</Title>
          <Text className="step-description">
            {t('onboarding.steps.contactManagement.description')}
          </Text>
        </div>
      </div>

      <div className="step-body">
        <Alert
          message={t('onboarding.steps.contactManagement.alert.message')}
          description={t('onboarding.steps.contactManagement.alert.description')}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card title={t('onboarding.steps.contactManagement.cards.contacts')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {mockData.contacts.list.map((contact, index) => (
                  <div key={index} className="contact-item">
                    <div className="contact-info">
                      <Text strong>{contact.name}</Text>
                      <Text type="secondary">{contact.phone}</Text>
                    </div>
                    <Tag color={contact.status === 'active' ? 'green' : 'orange'}>
                      {contact.status === 'active' ? t('onboarding.steps.contactManagement.status.active') : t('onboarding.steps.contactManagement.status.inactive')}
                    </Tag>
                  </div>
                ))}
                <Button type="dashed" block icon={<UserOutlined />}>
                  {t('onboarding.steps.contactManagement.actions.addContact')}
                </Button>
              </Space>
            </Card>
          </Col>
          
          <Col xs={24} sm={8}>
            <Card title={t('onboarding.steps.contactManagement.cards.groups')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {mockData.contacts.groups.map((group, index) => (
                  <div key={index} className="group-item">
                    <div className="group-info">
                      <Text strong>{group.name}</Text>
                      <Text type="secondary">{group.memberCount} {t('onboarding.steps.contactManagement.members')}</Text>
                    </div>
                    <Tag color="blue">{group.type}</Tag>
                  </div>
                ))}
                <Button type="dashed" block icon={<UserOutlined />}>
                  {t('onboarding.steps.contactManagement.actions.addGroup')}
                </Button>
              </Space>
            </Card>
          </Col>
          
          <Col xs={24} sm={8}>
            <Card title={t('onboarding.steps.contactManagement.cards.tags')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {mockData.contacts.tags.map((tag, index) => (
                  <div key={index} className="tag-item">
                    <Tag color={tag.color}>{tag.name}</Tag>
                    <Text type="secondary">{tag.count} {t('onboarding.steps.contactManagement.contacts')}</Text>
                  </div>
                ))}
                <Button type="dashed" block icon={<UserOutlined />}>
                  {t('onboarding.steps.contactManagement.actions.addTag')}
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );

  const renderDatasetStep = () => (
    <div className="step-content">
      <div className="step-header">
        <div className="step-icon">
          <DatabaseOutlined />
        </div>
        <div className="step-title-section">
          <Title level={3} className="step-title">{t('onboarding.steps.datasetManagement.title')}</Title>
          <Text className="step-description">
            {t('onboarding.steps.datasetManagement.description')}
          </Text>
        </div>
      </div>

      <div className="step-body">
        <Alert
          message={t('onboarding.steps.datasetManagement.alert.message')}
          description={t('onboarding.steps.datasetManagement.alert.description')}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card title={t('onboarding.steps.datasetManagement.cards.sql')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>• {t('onboarding.steps.datasetManagement.features.sql.0')}</Text>
                <Text>• {t('onboarding.steps.datasetManagement.features.sql.1')}</Text>
                <Text>• {t('onboarding.steps.datasetManagement.features.sql.2')}</Text>
                <Text>• {t('onboarding.steps.datasetManagement.features.sql.3')}</Text>
                <Button type="primary" size="small" block>
                  {t('onboarding.steps.datasetManagement.actions.configureSql')}
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card title={t('onboarding.steps.datasetManagement.cards.excel')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>• {t('onboarding.steps.datasetManagement.features.excel.0')}</Text>
                <Text>• {t('onboarding.steps.datasetManagement.features.excel.1')}</Text>
                <Text>• {t('onboarding.steps.datasetManagement.features.excel.2')}</Text>
                <Text>• {t('onboarding.steps.datasetManagement.features.excel.3')}</Text>
                <Button type="primary" size="small" block>
                  {t('onboarding.steps.datasetManagement.actions.uploadExcel')}
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card title={t('onboarding.steps.datasetManagement.cards.googleDocs')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>• {t('onboarding.steps.datasetManagement.features.googleDocs.0')}</Text>
                <Text>• {t('onboarding.steps.datasetManagement.features.googleDocs.1')}</Text>
                <Text>• {t('onboarding.steps.datasetManagement.features.googleDocs.2')}</Text>
                <Text>• {t('onboarding.steps.datasetManagement.features.googleDocs.3')}</Text>
                <Button type="primary" size="small" block>
                  {t('onboarding.steps.datasetManagement.actions.connectGoogleDocs')}
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>

      </div>
    </div>
  );

  const renderFormStep = () => (
    <div className="step-content">
      <div className="step-header">
        <div className="step-icon">
          <FileTextOutlined />
        </div>
        <div className="step-title-section">
          <Title level={3} className="step-title">{t('onboarding.steps.formManagement.title')}</Title>
          <Text className="step-description">
            {t('onboarding.steps.formManagement.description')}
          </Text>
        </div>
      </div>

      <div className="step-body">
        <Alert
          message={t('onboarding.steps.formManagement.alert.message')}
          description={t('onboarding.steps.formManagement.alert.description')}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card title={t('onboarding.steps.formManagement.cards.ai')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>• {t('onboarding.steps.formManagement.features.ai.0')}</Text>
                <Text>• {t('onboarding.steps.formManagement.features.ai.1')}</Text>
                <Text>• {t('onboarding.steps.formManagement.features.ai.2')}</Text>
                <Text>• {t('onboarding.steps.formManagement.features.ai.3')}</Text>
                <Button type="primary" size="small" block icon={<RobotOutlined />}>
                  {t('onboarding.steps.formManagement.actions.generateForm')}
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card title={t('onboarding.steps.formManagement.cards.upload')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>• {t('onboarding.steps.formManagement.features.upload.0')}</Text>
                <Text>• {t('onboarding.steps.formManagement.features.upload.1')}</Text>
                <Text>• {t('onboarding.steps.formManagement.features.upload.2')}</Text>
                <Text>• {t('onboarding.steps.formManagement.features.upload.3')}</Text>
                <Button type="primary" size="small" block icon={<UploadOutlined />}>
                  {t('onboarding.steps.formManagement.actions.uploadFile')}
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card title={t('onboarding.steps.formManagement.cards.design')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>• {t('onboarding.steps.formManagement.features.design.0')}</Text>
                <Text>• {t('onboarding.steps.formManagement.features.design.1')}</Text>
                <Text>• {t('onboarding.steps.formManagement.features.design.2')}</Text>
                <Text>• {t('onboarding.steps.formManagement.features.design.3')}</Text>
                <Button type="primary" size="small" block icon={<DragOutlined />}>
                  {t('onboarding.steps.formManagement.actions.designForm')}
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>

      </div>
    </div>
  );

  const renderWorkflowStep = () => (
    <div className="step-content">
      <div className="step-header">
        <div className="step-icon">
          <BranchesOutlined />
        </div>
        <div className="step-title-section">
          <Title level={3} className="step-title">{t('onboarding.steps.workflowDesign.title')}</Title>
          <Text className="step-description">
            {t('onboarding.steps.workflowDesign.description')}
          </Text>
        </div>
      </div>

      <div className="step-body">
        <Alert
          message={t('onboarding.steps.workflowDesign.alert.message')}
          description={t('onboarding.steps.workflowDesign.alert.description')}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Card title={t('onboarding.steps.workflowDesign.cards.basic')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="node-item">
                  <PlayCircleOutlined style={{ color: '#52c41a' }} />
                  <Text strong>{t('onboarding.steps.workflowDesign.nodes.start.title')}</Text>
                  <Text type="secondary">{t('onboarding.steps.workflowDesign.nodes.start.description')}</Text>
                </div>
                <div className="node-item">
                  <MessageOutlined style={{ color: '#1890ff' }} />
                  <Text strong>{t('onboarding.steps.workflowDesign.nodes.sendMessage.title')}</Text>
                  <Text type="secondary">{t('onboarding.steps.workflowDesign.nodes.sendMessage.description')}</Text>
                </div>
                <div className="node-item">
                  <ClockCircleOutlined style={{ color: '#faad14' }} />
                  <Text strong>{t('onboarding.steps.workflowDesign.nodes.waitReply.title')}</Text>
                  <Text type="secondary">{t('onboarding.steps.workflowDesign.nodes.waitReply.description')}</Text>
                </div>
                <div className="node-item">
                  <CheckCircleOutlined style={{ color: '#722ed1' }} />
                  <Text strong>{t('onboarding.steps.workflowDesign.nodes.end.title')}</Text>
                  <Text type="secondary">{t('onboarding.steps.workflowDesign.nodes.end.description')}</Text>
                </div>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card title={t('onboarding.steps.workflowDesign.cards.advanced')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="node-item">
                  <BranchesOutlined style={{ color: '#eb2f96' }} />
                  <Text strong>{t('onboarding.steps.workflowDesign.nodes.condition.title')}</Text>
                  <Text type="secondary">{t('onboarding.steps.workflowDesign.nodes.condition.description')}</Text>
                </div>
                <div className="node-item">
                  <DatabaseOutlined style={{ color: '#13c2c2' }} />
                  <Text strong>{t('onboarding.steps.workflowDesign.nodes.dataQuery.title')}</Text>
                  <Text type="secondary">{t('onboarding.steps.workflowDesign.nodes.dataQuery.description')}</Text>
                </div>
                <div className="node-item">
                  <FileTextOutlined style={{ color: '#fa8c16' }} />
                  <Text strong>{t('onboarding.steps.workflowDesign.nodes.formProcess.title')}</Text>
                  <Text type="secondary">{t('onboarding.steps.workflowDesign.nodes.formProcess.description')}</Text>
                </div>
                <div className="node-item">
                  <SettingOutlined style={{ color: '#2f54eb' }} />
                  <Text strong>{t('onboarding.steps.workflowDesign.nodes.custom.title')}</Text>
                  <Text type="secondary">{t('onboarding.steps.workflowDesign.nodes.custom.description')}</Text>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        <Alert
          message={t('onboarding.steps.workflowDesign.connection.message')}
          description={t('onboarding.steps.workflowDesign.connection.description')}
          type="success"
          showIcon
          style={{ marginTop: 16 }}
        />
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return renderDashboardStep();
      case 1:
        return renderTemplateStep();
      case 2:
        return renderContactStep();
      case 3:
        return renderDatasetStep();
      case 4:
        return renderFormStep();
      case 5:
        return renderWorkflowStep();
      default:
        return renderDashboardStep();
    }
  };

  return (
    <div className="step-main-content">
      {/* 左側文字說明區域 - 50% */}
      <div className="step-left-panel">
        {renderStepContent()}
      </div>
      
      {/* 右側演示區域 - 50% */}
      <div className="step-right-panel">
        {/* 視頻播放器區域 - 70% 高度 */}
        <div className="video-player-section">
            {renderDemoVisual(step, currentDemoStep)}
          </div>
        
        {/* 輪轉圖標區域 - 30% 高度 */}
        <div className="demo-steps-section">
          <Steps current={currentDemoStep} size="small">
            {getDemoSteps(step).map((demo, index) => (
              <Step 
                key={index}
                title={demo.title}
                icon={demo.icon}
                description={demo.description}
              />
            ))}
          </Steps>
        </div>
      </div>
    </div>
  );
};

export default TourStep;