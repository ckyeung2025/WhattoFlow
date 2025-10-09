import { useState, useEffect, useCallback } from 'react';

// 成就定義
const ACHIEVEMENTS = {
  'dashboard-explorer': {
    id: 'dashboard-explorer',
    title: '儀表板探索者',
    description: '完成了儀表板功能導覽',
    icon: '🎯',
    points: 100,
    type: 'dashboard-explorer',
    unlockCondition: 'dashboard-completed'
  },
  'template-master': {
    id: 'template-master',
    title: '模版大師',
    description: '掌握了內部模板和 Meta 模板管理',
    icon: '📝',
    points: 150,
    type: 'template-master',
    unlockCondition: 'templates-completed'
  },
  'contact-expert': {
    id: 'contact-expert',
    title: '聯絡人專家',
    description: '學會了聯絡人、群組和標籤的管理',
    icon: '👥',
    points: 175,
    type: 'contact-expert',
    unlockCondition: 'contacts-completed'
  },
  'data-wizard': {
    id: 'data-wizard',
    title: '數據巫師',
    description: '學會了多種數據源的管理',
    icon: '🔮',
    points: 200,
    type: 'data-wizard',
    unlockCondition: 'dataset-completed'
  },
  'form-expert': {
    id: 'form-expert',
    title: '表單專家',
    description: '掌握了 AI 生成和拖拽設計表單',
    icon: '📋',
    points: 250,
    type: 'form-expert',
    unlockCondition: 'forms-completed'
  },
  'workflow-guru': {
    id: 'workflow-guru',
    title: '工作流程大師',
    description: '學會了複雜工作流程的設計',
    icon: '⚡',
    points: 300,
    type: 'workflow-guru',
    unlockCondition: 'workflow-completed'
  },
  'tour-complete': {
    id: 'tour-complete',
    title: '導覽完成者',
    description: '完成了所有導覽步驟',
    icon: '🏆',
    points: 500,
    type: 'tour-complete',
    unlockCondition: 'all-steps-complete'
  }
};

// 導覽步驟定義
const TOUR_STEPS = [
  {
    id: 'dashboard',
    title: '儀表板 - 系統控制中心',
    description: '了解儀表板的核心功能快捷方式和系統狀態概覽',
    target: '.dashboard-container',
    achievements: ['dashboard-explorer']
  },
  {
    id: 'message-templates',
    title: '訊息模版管理',
    description: '學習如何管理內部模板和 Meta 官方模板',
    target: '.whatsapp-templates-page',
    achievements: ['template-master']
  },
  {
    id: 'contact-management',
    title: '聯絡人管理',
    description: '學習如何管理聯絡人、廣播群組和標籤',
    target: '.contact-list-page',
    achievements: ['contact-expert']
  },
  {
    id: 'dataset-management',
    title: '數據集管理',
    description: '學習如何創建和管理多種數據源',
    target: '.dataset-management-page',
    achievements: ['data-wizard']
  },
  {
    id: 'form-management',
    title: '表單管理系統',
    description: '學習如何創建和管理動態表單',
    target: '.eform-list-page',
    achievements: ['form-expert']
  },
  {
    id: 'workflow-design',
    title: '工作流程設計',
    description: '學習如何設計複雜的工作流程',
    target: '.workflow-list-page',
    achievements: ['workflow-guru', 'tour-complete']
  }
];

export const useOnboardingTour = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [userProgress, setUserProgress] = useState({
    totalPoints: 0,
    completedActions: [],
    lastActiveDate: null
  });

  const totalSteps = TOUR_STEPS.length;
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  // 從 localStorage 載入用戶進度
  useEffect(() => {
    const savedProgress = localStorage.getItem('whattoflow-onboarding-progress');
    if (savedProgress) {
      try {
        const progressData = JSON.parse(savedProgress);
        setCurrentStep(progressData.currentStep || 0);
        setCompletedSteps(progressData.completedSteps || []);
        setAchievements(progressData.achievements || []);
        setIsTourActive(progressData.isTourActive || false);
        setIsCompleted(progressData.isCompleted || false);
        setUserProgress(progressData.userProgress || userProgress);
      } catch (error) {
        console.error('載入導覽進度失敗:', error);
      }
    }
  }, []);

  // 保存用戶進度到 localStorage
  const saveProgress = useCallback(() => {
    const progressData = {
      currentStep,
      completedSteps,
      achievements,
      isTourActive,
      isCompleted,
      userProgress,
      lastSaved: new Date().toISOString()
    };
    
    localStorage.setItem('whattoflow-onboarding-progress', JSON.stringify(progressData));
  }, [currentStep, completedSteps, achievements, isTourActive, isCompleted, userProgress]);

  // 保存進度
  useEffect(() => {
    saveProgress();
  }, [saveProgress]);

  // 解鎖成就
  const unlockAchievement = useCallback((achievementId) => {
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement) return;

    const existingAchievement = achievements.find(a => a.id === achievementId);
    if (existingAchievement) return;

    const newAchievement = {
      ...achievement,
      unlockedAt: new Date().toISOString(),
      isNew: true
    };

    setAchievements(prev => [...prev, newAchievement]);
    
    // 更新用戶總分
    setUserProgress(prev => ({
      ...prev,
      totalPoints: prev.totalPoints + achievement.points,
      completedActions: [...prev.completedActions, achievementId]
    }));

    // 3秒後標記為非新成就
    setTimeout(() => {
      setAchievements(prev => 
        prev.map(a => 
          a.id === achievementId 
            ? { ...a, isNew: false }
            : a
        )
      );
    }, 3000);
  }, [achievements]);

  // 檢查並解鎖成就
  const checkAchievements = useCallback((action) => {
    Object.values(ACHIEVEMENTS).forEach(achievement => {
      if (achievement.unlockCondition === action) {
        unlockAchievement(achievement.id);
      }
    });
  }, [unlockAchievement]);

  // 下一步
  const nextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      
      // 檢查當前步驟的成就
      const currentStepConfig = TOUR_STEPS[newStep];
      if (currentStepConfig && currentStepConfig.achievements.length > 0) {
        currentStepConfig.achievements.forEach(achievementId => {
          checkAchievements(achievementId);
        });
      }
    }
  }, [currentStep, totalSteps, checkAchievements]);

  // 上一步
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // 完成導覽
  const completeTour = useCallback(() => {
    setIsCompleted(true);
    setIsTourActive(false);
    
    // 解鎖完成成就
    checkAchievements('all-steps-complete');
    
    // 標記所有步驟為完成
    setCompletedSteps(TOUR_STEPS.map(step => step.id));
  }, [checkAchievements]);

  // 跳過導覽
  const skipTour = useCallback(() => {
    setIsTourActive(false);
    setIsCompleted(true);
    
    // 保存跳過狀態
    const progressData = {
      currentStep: 0,
      completedSteps: [],
      achievements: [],
      isTourActive: false,
      isCompleted: true,
      userProgress: {
        ...userProgress,
        skipped: true,
        skippedAt: new Date().toISOString()
      },
      lastSaved: new Date().toISOString()
    };
    
    localStorage.setItem('whattoflow-onboarding-progress', JSON.stringify(progressData));
  }, [userProgress]);

  // 開始導覽
  const startTour = useCallback(() => {
    setIsTourActive(true);
    setIsCompleted(false);
    setCurrentStep(0);
  }, []);

  // 重置導覽
  const resetTour = useCallback(() => {
    setCurrentStep(0);
    setCompletedSteps([]);
    setAchievements([]);
    setIsTourActive(false);
    setIsCompleted(false);
    setUserProgress({
      totalPoints: 0,
      completedActions: [],
      lastActiveDate: new Date().toISOString()
    });
    
    localStorage.removeItem('whattoflow-onboarding-progress');
  }, []);

  // 手動觸發成就（用於測試）
  const triggerAchievement = useCallback((achievementId) => {
    unlockAchievement(achievementId);
  }, [unlockAchievement]);

  // 獲取當前步驟配置
  const getCurrentStepConfig = useCallback(() => {
    return TOUR_STEPS[currentStep] || TOUR_STEPS[0];
  }, [currentStep]);

  // 獲取用戶統計
  const getUserStats = useCallback(() => {
    return {
      totalSteps: totalSteps,
      completedSteps: completedSteps.length,
      totalAchievements: achievements.length,
      totalPoints: userProgress.totalPoints,
      completionRate: totalSteps > 0 ? (completedSteps.length / totalSteps) * 100 : 0,
      isCompleted,
      isTourActive
    };
  }, [totalSteps, completedSteps.length, achievements.length, userProgress.totalPoints, isCompleted, isTourActive]);

  return {
    // 狀態
    currentStep,
    totalSteps,
    progress,
    completedSteps,
    achievements,
    isTourActive,
    isCompleted,
    userProgress,
    
    // 動作
    nextStep,
    prevStep,
    completeTour,
    skipTour,
    startTour,
    resetTour,
    triggerAchievement,
    setCurrentStep,
    
    // 工具
    getCurrentStepConfig,
    getUserStats,
    checkAchievements,
    
    // 常數
    TOUR_STEPS,
    ACHIEVEMENTS
  };
};
