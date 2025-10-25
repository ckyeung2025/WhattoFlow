// 全球標準時區列表
// 基於 https://www.timeanddate.com/time/zones/ 的標準時區
// 格式: { value: IANA時區標識符, label: UTC偏移+位置顯示名稱, offset: UTC偏移 }

export const TIMEZONES = [
  // UTC 基準
  { value: 'UTC', label: 'UTC+0 UTC (Coordinated Universal Time)', offset: 0 },
  
  // 亞洲時區
  { value: 'Asia/Hong_Kong', label: 'UTC+8 Asia/Hong_Kong (Hong Kong)', offset: 8 },
  { value: 'Asia/Taipei', label: 'UTC+8 Asia/Taipei (Taipei)', offset: 8 },
  { value: 'Asia/Shanghai', label: 'UTC+8 Asia/Shanghai (Shanghai)', offset: 8 },
  { value: 'Asia/Singapore', label: 'UTC+8 Asia/Singapore (Singapore)', offset: 8 },
  { value: 'Asia/Kuala_Lumpur', label: 'UTC+8 Asia/Kuala_Lumpur (Kuala Lumpur)', offset: 8 },
  { value: 'Asia/Manila', label: 'UTC+8 Asia/Manila (Manila)', offset: 8 },
  { value: 'Asia/Tokyo', label: 'UTC+9 Asia/Tokyo (Tokyo)', offset: 9 },
  { value: 'Asia/Seoul', label: 'UTC+9 Asia/Seoul (Seoul)', offset: 9 },
  { value: 'Asia/Bangkok', label: 'UTC+7 Asia/Bangkok (Bangkok)', offset: 7 },
  { value: 'Asia/Jakarta', label: 'UTC+7 Asia/Jakarta (Jakarta)', offset: 7 },
  { value: 'Asia/Kolkata', label: 'UTC+5:30 Asia/Kolkata (Mumbai)', offset: 5.5 },
  { value: 'Asia/Colombo', label: 'UTC+5:30 Asia/Colombo (Colombo)', offset: 5.5 },
  { value: 'Asia/Karachi', label: 'UTC+5 Asia/Karachi (Karachi)', offset: 5 },
  { value: 'Asia/Tehran', label: 'UTC+4:30 Asia/Tehran (Tehran)', offset: 4.5 },
  { value: 'Asia/Dubai', label: 'UTC+3 Asia/Dubai (Dubai)', offset: 3 },
  { value: 'Asia/Riyadh', label: 'UTC+3 Asia/Riyadh (Riyadh)', offset: 3 },
  { value: 'Asia/Jerusalem', label: 'UTC+2 Asia/Jerusalem (Jerusalem)', offset: 2 },
  
  // 歐洲時區
  { value: 'Europe/London', label: 'UTC+1 Europe/London (London)', offset: 1 },
  { value: 'Europe/Paris', label: 'UTC+1 Europe/Paris (Paris)', offset: 1 },
  { value: 'Europe/Berlin', label: 'UTC+1 Europe/Berlin (Berlin)', offset: 1 },
  { value: 'Europe/Rome', label: 'UTC+1 Europe/Rome (Rome)', offset: 1 },
  { value: 'Europe/Madrid', label: 'UTC+1 Europe/Madrid (Madrid)', offset: 1 },
  { value: 'Europe/Amsterdam', label: 'UTC+1 Europe/Amsterdam (Amsterdam)', offset: 1 },
  { value: 'Europe/Athens', label: 'UTC+2 Europe/Athens (Athens)', offset: 2 },
  { value: 'Europe/Helsinki', label: 'UTC+2 Europe/Helsinki (Helsinki)', offset: 2 },
  { value: 'Europe/Moscow', label: 'UTC+3 Europe/Moscow (Moscow)', offset: 3 },
  { value: 'Europe/Dublin', label: 'UTC+0 Europe/Dublin (Dublin)', offset: 0 },
  
  // 美洲時區
  { value: 'America/New_York', label: 'UTC-5 America/New_York (New York)', offset: -5 },
  { value: 'America/Chicago', label: 'UTC-6 America/Chicago (Chicago)', offset: -6 },
  { value: 'America/Denver', label: 'UTC-7 America/Denver (Denver)', offset: -7 },
  { value: 'America/Los_Angeles', label: 'UTC-8 America/Los_Angeles (Los Angeles)', offset: -8 },
  { value: 'America/Sao_Paulo', label: 'UTC-3 America/Sao_Paulo (São Paulo)', offset: -3 },
  { value: 'America/Buenos_Aires', label: 'UTC-3 America/Buenos_Aires (Buenos Aires)', offset: -3 },
  { value: 'America/Toronto', label: 'UTC-5 America/Toronto (Toronto)', offset: -5 },
  { value: 'America/Caracas', label: 'UTC-4 America/Caracas (Caracas)', offset: -4 },
  { value: 'America/Vancouver', label: 'UTC-8 America/Vancouver (Vancouver)', offset: -8 },
  
  // 大洋洲時區
  { value: 'Australia/Sydney', label: 'UTC+10 Australia/Sydney (Sydney)', offset: 10 },
  { value: 'Australia/Melbourne', label: 'UTC+10 Australia/Melbourne (Melbourne)', offset: 10 },
  { value: 'Australia/Adelaide', label: 'UTC+9:30 Australia/Adelaide (Adelaide)', offset: 9.5 },
  { value: 'Australia/Perth', label: 'UTC+8 Australia/Perth (Perth)', offset: 8 },
  { value: 'Pacific/Auckland', label: 'UTC+12 Pacific/Auckland (Auckland)', offset: 12 },
  { value: 'Pacific/Fiji', label: 'UTC+12 Pacific/Fiji (Fiji)', offset: 12 },
  
  // 非洲時區
  { value: 'Africa/Lagos', label: 'UTC+1 Africa/Lagos (Lagos)', offset: 1 },
  { value: 'Africa/Cairo', label: 'UTC+2 Africa/Cairo (Cairo)', offset: 2 },
  { value: 'Africa/Johannesburg', label: 'UTC+2 Africa/Johannesburg (Johannesburg)', offset: 2 },
  { value: 'Africa/Nairobi', label: 'UTC+3 Africa/Nairobi (Nairobi)', offset: 3 },
  
  // 其他重要時區
  { value: 'Asia/Dhaka', label: 'UTC+5:30 Asia/Dhaka (Dhaka)', offset: 5.5 },
  { value: 'Asia/Almaty', label: 'UTC+6 Asia/Almaty (Almaty)', offset: 6 },
  { value: 'Pacific/Guam', label: 'UTC+11 Pacific/Guam (Guam)', offset: 11 },
  { value: 'Pacific/Honolulu', label: 'UTC-10 Pacific/Honolulu (Honolulu)', offset: -10 },
  { value: 'America/Anchorage', label: 'UTC-9 America/Anchorage (Anchorage)', offset: -9 },
  { value: 'Asia/Tbilisi', label: 'UTC+4 Asia/Tbilisi (Tbilisi)', offset: 4 },
  { value: 'Asia/Yangon', label: 'UTC+6:30 Asia/Yangon (Yangon)', offset: 6.5 },
  { value: 'Asia/Yakutsk', label: 'UTC+9 Asia/Yakutsk (Yakutsk)', offset: 9 },
  { value: 'Asia/Vladivostok', label: 'UTC+10 Asia/Vladivostok (Vladivostok)', offset: 10 },
  { value: 'Asia/Magadan', label: 'UTC+11 Asia/Magadan (Magadan)', offset: 11 },
  { value: 'Asia/Kamchatka', label: 'UTC+12 Asia/Kamchatka (Kamchatka)', offset: 12 }
];

// 根據 GMT 偏移值分組的時區
export const TIMEZONES_BY_OFFSET = TIMEZONES.reduce((acc, timezone) => {
  const offset = timezone.offset;
  if (!acc[offset]) {
    acc[offset] = [];
  }
  acc[offset].push(timezone);
  return acc;
}, {});

// 獲取時區偏移值的輔助函數
export const getTimezoneOffset = (timezoneValue) => {
  const timezone = TIMEZONES.find(tz => tz.value === timezoneValue);
  return timezone ? timezone.offset : 0;
};

// 獲取時區顯示名稱的輔助函數
export const getTimezoneLabel = (timezoneValue) => {
  const timezone = TIMEZONES.find(tz => tz.value === timezoneValue);
  return timezone ? timezone.label : timezoneValue;
};

// 根據 IANA 時區標識符獲取 GMT 偏移字符串
export const getGMTOffsetString = (timezoneValue) => {
  const timezone = TIMEZONES.find(tz => tz.value === timezoneValue);
  if (!timezone) return 'UTC+0';
  
  const offset = timezone.offset;
  if (offset === 0) return 'UTC+0';
  if (offset > 0) {
    return `UTC+${offset}`;
  } else {
    return `UTC${offset}`;
  }
};
