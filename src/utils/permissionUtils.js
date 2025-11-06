/**
 * 權限管理工具函數
 * 處理用戶權限檢查和介面過濾
 */

// 介面層級關係定義
// 注意：phoneVerificationAdmin 不包含在 adminTools 的自動展開中，因為只有 Tenant_Admin 應該有這個權限
const INTERFACE_HIERARCHY = {
  'application': ['publishedApps', 'pendingTasks', 'workflowMonitor'],
  'studio': ['eformList', 'whatsappTemplates', 'whatsappWorkflow', 'dataSets'],
  'adminTools': ['contactList', 'broadcastGroups', 'hashtags', 'companyUserAdmin', 'permissionManagement']
  // phoneVerificationAdmin 需要明確授予，不會從 adminTools 自動展開
};

/**
 * 展開介面權限（有父級權限自動包含子級）
 * @param {string[]} interfaces - 用戶擁有的介面權限列表
 * @returns {string[]} 展開後的介面權限列表
 */
export const expandInterfacesWithChildren = (interfaces) => {
  if (!interfaces || !Array.isArray(interfaces)) {
    return [];
  }

  const expanded = new Set(interfaces);

  // 檢查每個父級介面
  Object.keys(INTERFACE_HIERARCHY).forEach(parent => {
    if (interfaces.includes(parent)) {
      // 如果有父級權限，自動添加所有子級
      INTERFACE_HIERARCHY[parent].forEach(child => {
        expanded.add(child);
      });
    }
  });

  return Array.from(expanded);
};

/**
 * 檢查用戶是否有權限訪問某個介面
 * @param {string[]} userInterfaces - 用戶擁有的介面權限列表
 * @param {string} interfaceKey - 要檢查的介面 key
 * @returns {boolean} 是否有權限
 */
export const hasInterfacePermission = (userInterfaces, interfaceKey) => {
  if (!userInterfaces || !Array.isArray(userInterfaces) || !interfaceKey) {
    return false;
  }

  // 展開權限（包含父子級關係）
  const expandedInterfaces = expandInterfacesWithChildren(userInterfaces);
  
  return expandedInterfaces.includes(interfaceKey);
};

/**
 * 過濾菜單項（根據用戶權限）
 * @param {Array} menuItems - 原始菜單項列表
 * @param {string[]} userInterfaces - 用戶擁有的介面權限列表
 * @param {Object} userInfo - 用戶信息（可選，用於角色檢查）
 * @returns {Array} 過濾後的菜單項列表
 */
export const filterMenuItemsByPermission = (menuItems, userInterfaces, userInfo = null) => {
  if (!menuItems || !Array.isArray(menuItems) || !userInterfaces || !Array.isArray(userInterfaces)) {
    return [];
  }

  // 展開權限（包含父子級關係）
  const expandedInterfaces = expandInterfacesWithChildren(userInterfaces);

  return menuItems
    .map(item => {
      // 如果是分隔線，直接返回
      if (item.type === 'divider') {
        return item;
      }

      // 如果是 logout，直接返回（不需要權限檢查）
      if (item.key === 'logout') {
        return item;
      }

      // 特殊檢查：phoneVerificationAdmin 需要 Tenant_Admin 角色
      if (item.key === 'phoneVerificationAdmin') {
        if (!hasRole(userInfo, 'Tenant_Admin')) {
          return null; // 不是 Tenant_Admin，過濾掉
        }
      }

      // 檢查當前項是否有權限
      if (!expandedInterfaces.includes(item.key)) {
        return null; // 沒有權限，過濾掉
      }

      // 如果有子項，遞歸過濾子項
      if (item.children && Array.isArray(item.children)) {
        const filteredChildren = item.children
          .map(child => {
            // 特殊檢查：phoneVerificationAdmin 需要 Tenant_Admin 角色
            if (child.key === 'phoneVerificationAdmin') {
              if (!hasRole(userInfo, 'Tenant_Admin')) {
                return null; // 不是 Tenant_Admin，過濾掉
              }
            }
            return child;
          })
          .filter(child => {
            if (child === null) return false;
            // 檢查子項是否有權限
            // 注意：如果父項有權限，子項會自動包含在 expandedInterfaces 中
            return expandedInterfaces.includes(child.key);
          });

        // 如果所有子項都被過濾掉，則不顯示父項
        if (filteredChildren.length === 0) {
          return null;
        }

        return {
          ...item,
          children: filteredChildren
        };
      }

      return item;
    })
    .filter(item => item !== null); // 移除被過濾的項
};

/**
 * 獲取用戶的介面權限（從 API）
 * @param {string} userId - 用戶 ID
 * @returns {Promise<string[]>} 用戶的介面權限列表
 */
export const fetchUserInterfaces = async (userId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/permissions/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('獲取用戶權限失敗:', response.status);
      return [];
    }

    const data = await response.json();
    return data.interfaces || [];
  } catch (error) {
    console.error('獲取用戶權限錯誤:', error);
    return [];
  }
};

/**
 * 從 localStorage 獲取用戶信息並提取權限
 * @returns {Promise<string[]>} 用戶的介面權限列表
 */
export const getUserInterfacesFromStorage = async () => {
  try {
    const userInfoStr = localStorage.getItem('userInfo');
    if (!userInfoStr) {
      return [];
    }

    const userInfo = JSON.parse(userInfoStr);
    const userId = userInfo.user_id || userInfo.userId || userInfo.id;

    if (!userId) {
      console.warn('無法從 userInfo 中獲取 userId');
      return [];
    }

    // 從 API 獲取權限
    return await fetchUserInterfaces(userId);
  } catch (error) {
    console.error('從存儲獲取用戶權限錯誤:', error);
    return [];
  }
};

/**
 * 檢查用戶是否有特定角色
 * @param {Object} userInfo - 用戶信息對象
 * @param {string} roleName - 角色名稱（如 'Tenant_Admin', 'Company_Admin' 等）
 * @returns {boolean} 是否有該角色
 */
export const hasRole = (userInfo, roleName) => {
  if (!userInfo || !userInfo.roles || !Array.isArray(userInfo.roles)) {
    return false;
  }

  return userInfo.roles.some(role => {
    if (typeof role === 'string') {
      return role === roleName;
    }
    if (typeof role === 'object' && role.name) {
      return role.name === roleName;
    }
    return false;
  });
};

/**
 * 檢查用戶是否為 Tenant_Admin 或 Company_Admin（用於權限管理頁面）
 * @param {Object} userInfo - 用戶信息對象
 * @returns {boolean} 是否有權限訪問權限管理頁面
 */
export const canAccessPermissionManagement = (userInfo) => {
  return hasRole(userInfo, 'Tenant_Admin') || hasRole(userInfo, 'Company_Admin');
};

/**
 * 檢查用戶是否為 Tenant_Admin（用於電話號碼驗證管理頁面）
 * @param {Object} userInfo - 用戶信息對象
 * @returns {boolean} 是否有權限訪問電話號碼驗證管理頁面
 */
export const canAccessPhoneVerificationAdmin = (userInfo) => {
  return hasRole(userInfo, 'Tenant_Admin');
};

