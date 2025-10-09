import React, { useState, useEffect } from 'react';
import { 
  Badge, 
  Tooltip, 
  Space, 
  Typography,
  Modal 
} from 'antd';
import { 
  TrophyOutlined, 
  StarOutlined,
  FireOutlined,
  CrownOutlined,
  BranchesOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  MessageOutlined
} from '@ant-design/icons';

const { Text } = Typography;

const AchievementBadge = ({ achievements = [] }) => {
  const [showCelebration, setShowCelebration] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);

  useEffect(() => {
    const latestAchievement = achievements[achievements.length - 1];
    if (latestAchievement && latestAchievement.isNew) {
      setNewAchievement(latestAchievement);
      setShowCelebration(true);
      
      // 3秒後關閉慶祝動畫
      const timer = setTimeout(() => {
        setShowCelebration(false);
        setNewAchievement(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [achievements]);

  const getAchievementIcon = (type) => {
    switch (type) {
      case 'first-workflow':
        return <BranchesOutlined />;
      case 'form-master':
        return <FileTextOutlined />;
      case 'data-wizard':
        return <DatabaseOutlined />;
      case 'whatsapp-expert':
        return <MessageOutlined />;
      case 'tour-complete':
        return <CrownOutlined />;
      default:
        return <StarOutlined />;
    }
  };

  const getAchievementColor = (type) => {
    switch (type) {
      case 'first-workflow':
        return '#52c41a';
      case 'form-master':
        return '#1890ff';
      case 'data-wizard':
        return '#722ed1';
      case 'whatsapp-expert':
        return '#13c2c2';
      case 'tour-complete':
        return '#faad14';
      default:
        return '#7234CF';
    }
  };

  return (
    <>
      <div className="achievement-badge-container">
        <Tooltip 
          title="查看成就" 
          placement="left"
        >
          <Badge 
            count={achievements.length} 
            className="achievement-count-badge"
          >
            <div className="achievement-icon">
              <TrophyOutlined />
            </div>
          </Badge>
        </Tooltip>

        {/* 成就列表 */}
        <div className="achievement-list">
          {achievements.map((achievement, index) => (
            <Tooltip
              key={achievement.id}
              title={
                <div className="achievement-tooltip">
                  <div className="achievement-title">
                    {achievement.title}
                  </div>
                  <div className="achievement-description">
                    {achievement.description}
                  </div>
                  <div className="achievement-points">
                    +{achievement.points} 分
                  </div>
                </div>
              }
              placement="left"
            >
              <div 
                className={`achievement-item ${
                  achievement.isNew ? 'new-achievement' : ''
                }`}
                style={{ 
                  animationDelay: `${index * 0.1}s`,
                  borderColor: getAchievementColor(achievement.type)
                }}
              >
                {getAchievementIcon(achievement.type)}
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* 成就慶祝動畫 */}
      <Modal
        open={showCelebration}
        footer={null}
        closable={false}
        centered
        className="achievement-celebration-modal"
        width={400}
        styles={{
          body: { padding: 0 }
        }}
      >
        {newAchievement && (
          <div className="celebration-content">
            <div className="celebration-animation">
              <div className="confetti-container">
                {[...Array(20)].map((_, i) => (
                  <div 
                    key={i}
                    className="confetti"
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      backgroundColor: getAchievementColor(newAchievement.type)
                    }}
                  />
                ))}
              </div>
              
              <div className="achievement-celebration-icon">
                {getAchievementIcon(newAchievement.type)}
              </div>
            </div>
            
            <div className="celebration-text">
              <Text className="celebration-title">
                恭喜獲得成就！
              </Text>
              <Text className="celebration-achievement">
                {newAchievement.title}
              </Text>
              <Text className="celebration-description">
                {newAchievement.description}
              </Text>
              <Text className="celebration-points">
                +{newAchievement.points} 分
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default AchievementBadge;
