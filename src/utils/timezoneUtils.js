import moment from 'moment';

/**
 * 時區工具類
 * 負責處理用戶時區偏移和日期顯示
 */
export class TimezoneUtils {
  /**
   * 解析 GMT 偏移字符串，獲取偏移小時數
   * @param {string} gmtOffsetString - GMT 偏移字符串，如 "UTC+8", "UTC-5", "UTC+5:30"
   * @returns {number} 偏移小時數（小數，如 8, -5, 5.5）
   */
  static parseGMTOffset(gmtOffsetString) {
    if (!gmtOffsetString || typeof gmtOffsetString !== 'string') {
      return 0;
    }

    // 移除 "UTC" 前綴
    const offsetStr = gmtOffsetString.replace('UTC', '');
    
    if (offsetStr === '+0' || offsetStr === '0') {
      return 0;
    }

    // 處理正偏移
    if (offsetStr.startsWith('+')) {
      const offset = offsetStr.substring(1);
      // 處理半小時偏移（如 +5:30）
      if (offset.includes(':')) {
        const [hours, minutes] = offset.split(':');
        return parseInt(hours) + (parseInt(minutes) / 60);
      }
      return parseInt(offset);
    }

    // 處理負偏移
    if (offsetStr.startsWith('-')) {
      const offset = offsetStr.substring(1);
      // 處理半小時偏移（如 -5:30）
      if (offset.includes(':')) {
        const [hours, minutes] = offset.split(':');
        return -(parseInt(hours) + (parseInt(minutes) / 60));
      }
      return -parseInt(offset);
    }

    return 0;
  }

  /**
   * 根據用戶時區偏移調整日期顯示
   * @param {string|Date|moment} date - 原始日期
   * @param {string} userTimezoneOffset - 用戶時區偏移字符串，如 "UTC+8"
   * @param {string} format - 日期格式，默認為 'YYYY-MM-DD HH:mm:ss'
   * @returns {string} 調整後的日期字符串
   */
  static formatDateWithTimezone(date, userTimezoneOffset, format = 'YYYY-MM-DD HH:mm:ss') {
    if (!date) return '-';

    try {
      // 解析用戶時區偏移
      const offsetHours = this.parseGMTOffset(userTimezoneOffset);
      
      // 將日期轉換為 moment 對象
      const momentDate = moment(date);
      
      // 如果日期無效，返回原始值
      if (!momentDate.isValid()) {
        return date.toString();
      }
      
      // 檢查日期是否已經包含時區信息
      // 更精確的時區檢測邏輯
      const isLocalTime = typeof date === 'string' && 
                         date.includes('T') && 
                         !date.includes('Z') && 
                         !date.includes('+') && 
                         !date.includes('-', date.indexOf('T')) && // 只在時間部分檢查 - 字符
                         !date.includes('GMT') && // 排除 GMT 格式
                         !date.includes('UTC'); // 排除 UTC 格式
      
      let adjustedDate;
      if (isLocalTime) {
        // 後端存儲的日期沒有時區信息，假設為 UTC 時間，需要轉換到用戶時區
        // 先將日期解析為 UTC 時間，然後轉換到用戶時區
        adjustedDate = moment.utc(date).utcOffset(offsetHours * 60);
      } else {
        // 如果已經有時區信息，直接應用用戶時區偏移
        adjustedDate = momentDate.utcOffset(offsetHours * 60);
      }
      
      return adjustedDate.format(format);
    } catch (error) {
      console.error('時區轉換錯誤:', error);
      return date.toString();
    }
  }

  /**
   * 獲取當前時間在用戶時區的顯示
   * @param {string} userTimezoneOffset - 用戶時區偏移字符串
   * @param {string} format - 日期格式
   * @returns {string} 當前時間字符串
   */
  static getCurrentTimeInUserTimezone(userTimezoneOffset, format = 'YYYY-MM-DD HH:mm:ss') {
    return this.formatDateWithTimezone(new Date(), userTimezoneOffset, format);
  }

  /**
   * 比較兩個日期（考慮用戶時區）
   * @param {string|Date|moment} date1 - 第一個日期
   * @param {string|Date|moment} date2 - 第二個日期
   * @param {string} userTimezoneOffset - 用戶時區偏移字符串
   * @returns {number} 比較結果：-1 (date1 < date2), 0 (相等), 1 (date1 > date2)
   */
  static compareDatesWithTimezone(date1, date2, userTimezoneOffset) {
    try {
      const offsetHours = this.parseGMTOffset(userTimezoneOffset);
      const offsetMinutes = offsetHours * 60;

      const momentDate1 = moment(date1).utcOffset(offsetMinutes);
      const momentDate2 = moment(date2).utcOffset(offsetMinutes);

      if (momentDate1.isBefore(momentDate2)) return -1;
      if (momentDate1.isAfter(momentDate2)) return 1;
      return 0;
    } catch (error) {
      console.error('日期比較錯誤:', error);
      return 0;
    }
  }

  /**
   * 檢查日期是否在指定範圍內（考慮用戶時區）
   * @param {string|Date|moment} date - 要檢查的日期
   * @param {string|Date|moment} startDate - 開始日期
   * @param {string|Date|moment} endDate - 結束日期
   * @param {string} userTimezoneOffset - 用戶時區偏移字符串
   * @returns {boolean} 是否在範圍內
   */
  static isDateInRange(date, startDate, endDate, userTimezoneOffset) {
    try {
      const offsetHours = this.parseGMTOffset(userTimezoneOffset);
      const offsetMinutes = offsetHours * 60;

      const momentDate = moment(date).utcOffset(offsetMinutes);
      const momentStart = moment(startDate).utcOffset(offsetMinutes);
      const momentEnd = moment(endDate).utcOffset(offsetMinutes);

      return momentDate.isBetween(momentStart, momentEnd, null, '[]'); // 包含邊界
    } catch (error) {
      console.error('日期範圍檢查錯誤:', error);
      return false;
    }
  }

  /**
   * 獲取瀏覽器檢測到的客戶端時區偏移
   * @returns {string} GMT 偏移字符串，如 "UTC+8", "UTC-5"
   */
  static getBrowserTimezoneOffset() {
    try {
      const now = new Date();
      const offsetMinutes = now.getTimezoneOffset();
      const offsetHours = -offsetMinutes / 60; // getTimezoneOffset() 返回的是相反的符號
      
      if (offsetHours === 0) return 'UTC+0';
      if (offsetHours > 0) {
        return `UTC+${offsetHours}`;
      } else {
        return `UTC${offsetHours}`;
      }
    } catch (error) {
      console.error('獲取瀏覽器時區失敗:', error);
      return 'UTC+8'; // 默認香港時區
    }
  }

  /**
   * 計算兩個日期之間的持續時間（分鐘）
   * @param {string|Date|moment} startDate - 開始日期
   * @param {string|Date|moment} endDate - 結束日期
   * @returns {number} 持續時間（分鐘）
   */
  static calculateDurationInMinutes(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    
    try {
      const start = moment(startDate);
      const end = moment(endDate);
      
      if (!start.isValid() || !end.isValid()) return 0;
      
      return end.diff(start, 'minutes');
    } catch (error) {
      console.error('計算持續時間錯誤:', error);
      return 0;
    }
  }

  /**
   * 計算從開始日期到現在的時間（分鐘）
   * @param {string|Date|moment} startDate - 開始日期
   * @returns {number} 持續時間（分鐘）
   */
  static calculateDuration(startDate, endDate = new Date()) {
    return this.calculateDurationInMinutes(startDate, endDate);
  }
}

/**
 * React Hook：使用用戶時區格式化日期
 * @param {string} userTimezoneOffset - 用戶時區偏移字符串
 * @returns {object} 包含各種日期格式化函數的對象
 */
export const useTimezoneFormatter = (userTimezoneOffset) => {
  return {
    /**
     * 格式化日期
     * @param {string|Date|dayjs} date - 要格式化的日期
     * @param {string} format - 日期格式
     * @returns {string} 格式化後的日期字符串
     */
    formatDate: (date, format = 'YYYY-MM-DD HH:mm:ss') => {
      return TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, format);
    },

    /**
     * 格式化日期（短格式）
     * @param {string|Date|dayjs} date - 要格式化的日期
     * @returns {string} 格式化後的日期字符串
     */
    formatDateShort: (date) => {
      return TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'YYYY-MM-DD');
    },

    /**
     * 格式化日期（時間格式）
     * @param {string|Date|dayjs} date - 要格式化的日期
     * @returns {string} 格式化後的時間字符串
     */
    formatTime: (date) => {
      return TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'HH:mm:ss');
    },

    /**
     * 獲取相對時間
     * @param {string|Date|dayjs} date - 要描述的日期
     * @returns {string} 相對時間描述
     */
    getRelativeTime: (date) => {
      return TimezoneUtils.getRelativeTime(date, userTimezoneOffset);
    },

    /**
     * 獲取當前時間
     * @param {string} format - 日期格式
     * @returns {string} 當前時間字符串
     */
    getCurrentTime: (format = 'YYYY-MM-DD HH:mm:ss') => {
      return TimezoneUtils.getCurrentTimeInUserTimezone(userTimezoneOffset, format);
    }
  };
};

export default TimezoneUtils;
