import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Button, 
  Progress, 
  Space, 
  Divider,
  Statistic,
  List,
  Avatar,
  Badge,
  Modal,
  message
} from 'antd';
import { 
  RocketOutlined, 
  TrophyOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StarOutlined,
  FireOutlined,
  CrownOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useOnboardingTour } from '../hooks/useOnboardingTour';
import OnboardingTour from '../components/OnboardingTour/OnboardingTour';

const { Title, Text, Paragraph } = Typography;

const OnboardingManagementPage = () => {
  const { t } = useLanguage();
  const [showTour, setShowTour] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  
  const {
    currentStep,
    totalSteps,
    progress,
    achievements,
    isCompleted,
    isTourActive,
    getUserStats,
    startTour,
    resetTour,
    TOUR_STEPS,
    ACHIEVEMENTS
  } = useOnboardingTour();

  const userStats = getUserStats();

  const handleStartTour = () => {
    startTour();
    setShowTour(true);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    message.success(t('onboarding.celebration.congratulations'));
  };

  const handleTourSkip = () => {
    setShowTour(false);
  };

  const handleResetConfirm = () => {
    resetTour();
    setShowResetModal(false);
    message.success('導覽已重置，您可以重新開始');
  };

  const getAchievementIcon = (type) => {
    switch (type) {
      case 'dashboard-explorer':
        return <RocketOutlined />;
      case 'template-master':
        return <StarOutlined />;
      case 'data-wizard':
        return <FireOutlined />;
      case 'form-expert':
        return <CrownOutlined />;
      case 'workflow-guru':
        return <PlayCircleOutlined />;
      case 'tour-complete':
        return <TrophyOutlined />;
      default:
        return <StarOutlined />;
    }
  };

  const getAchievementColor = (type) => {
    switch (type) {
      case 'dashboard-explorer':
        return '#52c41a';
      case 'template-master':
        return '#1890ff';
      case 'data-wizard':
        return '#722ed1';
      case 'form-expert':
        return '#13c2c2';
      case 'workflow-guru':
        return '#fa8c16';
      case 'tour-complete':
        return '#faad14';
      default:
        return '#7234CF';
    }
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* 頁面標題 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>
            <RocketOutlined style={{ marginRight: 8, color: '#7234CF' }} />
            新手導覽管理
          </Title>
          <Paragraph>
            管理您的 WhatoFlow 學習進度和成就
          </Paragraph>
        </div>

        <Row gutter={[24, 24]}>
          {/* 進度概覽 */}
          <Col xs={24} lg={16}>
            <Card title="導覽進度" style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 24 }}>
                <Progress
                  percent={Math.round(progress)}
                  strokeColor={{
                    '0%': '#52c41a',
                    '50%': '#faad14',
                    '100%': '#7234CF'
                  }}
                  strokeWidth={8}
                />
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <Text strong>步驟 {currentStep + 1} / {totalSteps}</Text>
                </div>
              </div>

              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="完成步驟"
                    value={userStats.completedSteps}
                    suffix={`/ ${userStats.totalSteps}`}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="獲得成就"
                    value={userStats.totalAchievements}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="總積分"
                    value={userStats.totalPoints}
                    valueStyle={{ color: '#7234CF' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="完成率"
                    value={Math.round(userStats.completionRate)}
                    suffix="%"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
              </Row>

              <Divider />

              <Space>
                {!isCompleted && !isTourActive && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    onClick={handleStartTour}
                    style={{
                      background: 'linear-gradient(135deg, #7234CF 0%, #8c4dd4 100%)',
                      border: 'none'
                    }}
                  >
                    開始導覽
                  </Button>
                )}
                
                {isTourActive && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    onClick={handleStartTour}
                    style={{
                      background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                      border: 'none'
                    }}
                  >
                    繼續導覽
                  </Button>
                )}

                {isCompleted && (
                  <Button
                    type="default"
                    size="large"
                    icon={<ReloadOutlined />}
                    onClick={() => setShowResetModal(true)}
                  >
                    重新開始
                  </Button>
                )}
              </Space>
            </Card>

            {/* 步驟列表 */}
            <Card title="導覽步驟">
              <List
                dataSource={TOUR_STEPS}
                renderItem={(step, index) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{
                            backgroundColor: index <= currentStep ? '#52c41a' : '#d9d9d9'
                          }}
                          icon={
                            index < currentStep ? (
                              <CheckCircleOutlined />
                            ) : index === currentStep ? (
                              <PlayCircleOutlined />
                            ) : (
                              <ClockCircleOutlined />
                            )
                          }
                        />
                      }
                      title={
                        <Space>
                          <Text strong={index <= currentStep}>
                            {step.title}
                          </Text>
                          {index === currentStep && (
                            <Badge status="processing" text="進行中" />
                          )}
                          {index < currentStep && (
                            <Badge status="success" text="已完成" />
                          )}
                        </Space>
                      }
                      description={step.description}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* 成就面板 */}
          <Col xs={24} lg={8}>
            <Card title="成就系統" style={{ marginBottom: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <TrophyOutlined 
                  style={{ 
                    fontSize: 48, 
                    color: '#faad14',
                    marginBottom: 16
                  }} 
                />
                <div>
                  <Text strong style={{ fontSize: 18 }}>
                    已獲得 {achievements.length} 個成就
                  </Text>
                </div>
                <div>
                  <Text type="secondary">
                    總積分: {userStats.totalPoints}
                  </Text>
                </div>
              </div>

              <List
                dataSource={Object.values(ACHIEVEMENTS)}
                renderItem={(achievement) => {
                  const isUnlocked = achievements.some(a => a.id === achievement.id);
                  return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            style={{
                              backgroundColor: isUnlocked 
                                ? getAchievementColor(achievement.type)
                                : '#d9d9d9'
                            }}
                            icon={getAchievementIcon(achievement.type)}
                          />
                        }
                        title={
                          <Space>
                            <Text 
                              strong={isUnlocked}
                              style={{ 
                                color: isUnlocked ? undefined : '#999'
                              }}
                            >
                              {achievement.title}
                            </Text>
                            {isUnlocked && (
                              <Badge 
                                count={achievement.points} 
                                style={{ 
                                  backgroundColor: '#faad14',
                                  fontSize: 12
                                }}
                              />
                            )}
                          </Space>
                        }
                        description={
                          <Text 
                            type={isUnlocked ? undefined : 'secondary'}
                            style={{ 
                              color: isUnlocked ? undefined : '#999'
                            }}
                          >
                            {achievement.description}
                          </Text>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </Card>

            {/* 快速操作 */}
            <Card title="快速操作">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  block 
                  icon={<PlayCircleOutlined />}
                  onClick={handleStartTour}
                  disabled={isTourActive}
                >
                  {isTourActive ? '導覽進行中' : '開始/繼續導覽'}
                </Button>
                
                <Button 
                  block 
                  icon={<ReloadOutlined />}
                  onClick={() => setShowResetModal(true)}
                >
                  重置導覽進度
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>

      {/* 導覽模態框 */}
      <OnboardingTour
        visible={showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
      />

      {/* 重置確認模態框 */}
      <Modal
        title="重置導覽"
        open={showResetModal}
        onOk={handleResetConfirm}
        onCancel={() => setShowResetModal(false)}
        okText="確認重置"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>您確定要重置導覽進度嗎？這將清除所有已完成的步驟和成就。</p>
        <p style={{ color: '#ff4d4f' }}>
          <strong>注意：此操作無法撤銷！</strong>
        </p>
      </Modal>
    </div>
  );
};

export default OnboardingManagementPage;
