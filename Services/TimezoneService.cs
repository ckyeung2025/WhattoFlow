using System;
using System.Collections.Generic;
using System.Linq;

namespace PurpleRice.Services
{
    /// <summary>
    /// 時區轉換服務
    /// 負責處理 IANA 時區標識符與 GMT 偏移字符串之間的轉換
    /// </summary>
    public class TimezoneService
    {
        // 時區映射表 - 與前端的 timezones.js 保持一致
        private static readonly Dictionary<string, TimezoneInfo> TimezoneMap = new Dictionary<string, TimezoneInfo>
        {
            // UTC 基準
            { "UTC", new TimezoneInfo { Offset = 0, Label = "UTC+0 UTC (Coordinated Universal Time)" } },
            
            // 亞洲時區
            { "Asia/Hong_Kong", new TimezoneInfo { Offset = 8, Label = "UTC+8 Asia/Hong_Kong (Hong Kong)" } },
            { "Asia/Taipei", new TimezoneInfo { Offset = 8, Label = "UTC+8 Asia/Taipei (Taipei)" } },
            { "Asia/Shanghai", new TimezoneInfo { Offset = 8, Label = "UTC+8 Asia/Shanghai (Shanghai)" } },
            { "Asia/Singapore", new TimezoneInfo { Offset = 8, Label = "UTC+8 Asia/Singapore (Singapore)" } },
            { "Asia/Kuala_Lumpur", new TimezoneInfo { Offset = 8, Label = "UTC+8 Asia/Kuala_Lumpur (Kuala Lumpur)" } },
            { "Asia/Manila", new TimezoneInfo { Offset = 8, Label = "UTC+8 Asia/Manila (Manila)" } },
            { "Asia/Tokyo", new TimezoneInfo { Offset = 9, Label = "UTC+9 Asia/Tokyo (Tokyo)" } },
            { "Asia/Seoul", new TimezoneInfo { Offset = 9, Label = "UTC+9 Asia/Seoul (Seoul)" } },
            { "Asia/Bangkok", new TimezoneInfo { Offset = 7, Label = "UTC+7 Asia/Bangkok (Bangkok)" } },
            { "Asia/Jakarta", new TimezoneInfo { Offset = 7, Label = "UTC+7 Asia/Jakarta (Jakarta)" } },
            { "Asia/Kolkata", new TimezoneInfo { Offset = 5.5, Label = "UTC+5:30 Asia/Kolkata (Mumbai)" } },
            { "Asia/Colombo", new TimezoneInfo { Offset = 5.5, Label = "UTC+5:30 Asia/Colombo (Colombo)" } },
            { "Asia/Karachi", new TimezoneInfo { Offset = 5, Label = "UTC+5 Asia/Karachi (Karachi)" } },
            { "Asia/Tehran", new TimezoneInfo { Offset = 4.5, Label = "UTC+4:30 Asia/Tehran (Tehran)" } },
            { "Asia/Dubai", new TimezoneInfo { Offset = 3, Label = "UTC+3 Asia/Dubai (Dubai)" } },
            { "Asia/Riyadh", new TimezoneInfo { Offset = 3, Label = "UTC+3 Asia/Riyadh (Riyadh)" } },
            { "Asia/Jerusalem", new TimezoneInfo { Offset = 2, Label = "UTC+2 Asia/Jerusalem (Jerusalem)" } },
            
            // 歐洲時區
            { "Europe/London", new TimezoneInfo { Offset = 1, Label = "UTC+1 Europe/London (London)" } },
            { "Europe/Paris", new TimezoneInfo { Offset = 1, Label = "UTC+1 Europe/Paris (Paris)" } },
            { "Europe/Berlin", new TimezoneInfo { Offset = 1, Label = "UTC+1 Europe/Berlin (Berlin)" } },
            { "Europe/Rome", new TimezoneInfo { Offset = 1, Label = "UTC+1 Europe/Rome (Rome)" } },
            { "Europe/Madrid", new TimezoneInfo { Offset = 1, Label = "UTC+1 Europe/Madrid (Madrid)" } },
            { "Europe/Amsterdam", new TimezoneInfo { Offset = 1, Label = "UTC+1 Europe/Amsterdam (Amsterdam)" } },
            { "Europe/Athens", new TimezoneInfo { Offset = 2, Label = "UTC+2 Europe/Athens (Athens)" } },
            { "Europe/Helsinki", new TimezoneInfo { Offset = 2, Label = "UTC+2 Europe/Helsinki (Helsinki)" } },
            { "Europe/Moscow", new TimezoneInfo { Offset = 3, Label = "UTC+3 Europe/Moscow (Moscow)" } },
            { "Europe/Dublin", new TimezoneInfo { Offset = 0, Label = "UTC+0 Europe/Dublin (Dublin)" } },
            
            // 美洲時區
            { "America/New_York", new TimezoneInfo { Offset = -5, Label = "UTC-5 America/New_York (New York)" } },
            { "America/Chicago", new TimezoneInfo { Offset = -6, Label = "UTC-6 America/Chicago (Chicago)" } },
            { "America/Denver", new TimezoneInfo { Offset = -7, Label = "UTC-7 America/Denver (Denver)" } },
            { "America/Los_Angeles", new TimezoneInfo { Offset = -8, Label = "UTC-8 America/Los_Angeles (Los Angeles)" } },
            { "America/Sao_Paulo", new TimezoneInfo { Offset = -3, Label = "UTC-3 America/Sao_Paulo (São Paulo)" } },
            { "America/Buenos_Aires", new TimezoneInfo { Offset = -3, Label = "UTC-3 America/Buenos_Aires (Buenos Aires)" } },
            { "America/Toronto", new TimezoneInfo { Offset = -5, Label = "UTC-5 America/Toronto (Toronto)" } },
            { "America/Caracas", new TimezoneInfo { Offset = -4, Label = "UTC-4 America/Caracas (Caracas)" } },
            { "America/Vancouver", new TimezoneInfo { Offset = -8, Label = "UTC-8 America/Vancouver (Vancouver)" } },
            
            // 大洋洲時區
            { "Australia/Sydney", new TimezoneInfo { Offset = 10, Label = "UTC+10 Australia/Sydney (Sydney)" } },
            { "Australia/Melbourne", new TimezoneInfo { Offset = 10, Label = "UTC+10 Australia/Melbourne (Melbourne)" } },
            { "Australia/Adelaide", new TimezoneInfo { Offset = 9.5, Label = "UTC+9:30 Australia/Adelaide (Adelaide)" } },
            { "Australia/Perth", new TimezoneInfo { Offset = 8, Label = "UTC+8 Australia/Perth (Perth)" } },
            { "Pacific/Auckland", new TimezoneInfo { Offset = 12, Label = "UTC+12 Pacific/Auckland (Auckland)" } },
            { "Pacific/Fiji", new TimezoneInfo { Offset = 12, Label = "UTC+12 Pacific/Fiji (Fiji)" } },
            
            // 非洲時區
            { "Africa/Lagos", new TimezoneInfo { Offset = 1, Label = "UTC+1 Africa/Lagos (Lagos)" } },
            { "Africa/Cairo", new TimezoneInfo { Offset = 2, Label = "UTC+2 Africa/Cairo (Cairo)" } },
            { "Africa/Johannesburg", new TimezoneInfo { Offset = 2, Label = "UTC+2 Africa/Johannesburg (Johannesburg)" } },
            { "Africa/Nairobi", new TimezoneInfo { Offset = 3, Label = "UTC+3 Africa/Nairobi (Nairobi)" } },
            
            // 其他重要時區
            { "Asia/Dhaka", new TimezoneInfo { Offset = 5.5, Label = "UTC+5:30 Asia/Dhaka (Dhaka)" } },
            { "Asia/Almaty", new TimezoneInfo { Offset = 6, Label = "UTC+6 Asia/Almaty (Almaty)" } },
            { "Pacific/Guam", new TimezoneInfo { Offset = 11, Label = "UTC+11 Pacific/Guam (Guam)" } },
            { "Pacific/Honolulu", new TimezoneInfo { Offset = -10, Label = "UTC-10 Pacific/Honolulu (Honolulu)" } },
            { "America/Anchorage", new TimezoneInfo { Offset = -9, Label = "UTC-9 America/Anchorage (Anchorage)" } },
            { "Asia/Tbilisi", new TimezoneInfo { Offset = 4, Label = "UTC+4 Asia/Tbilisi (Tbilisi)" } },
            { "Asia/Yangon", new TimezoneInfo { Offset = 6.5, Label = "UTC+6:30 Asia/Yangon (Yangon)" } },
            { "Asia/Yakutsk", new TimezoneInfo { Offset = 9, Label = "UTC+9 Asia/Yakutsk (Yakutsk)" } },
            { "Asia/Vladivostok", new TimezoneInfo { Offset = 10, Label = "UTC+10 Asia/Vladivostok (Vladivostok)" } },
            { "Asia/Magadan", new TimezoneInfo { Offset = 11, Label = "UTC+11 Asia/Magadan (Magadan)" } },
            { "Asia/Kamchatka", new TimezoneInfo { Offset = 12, Label = "UTC+12 Asia/Kamchatka (Kamchatka)" } }
        };

        /// <summary>
        /// 根據 IANA 時區標識符獲取 GMT 偏移字符串
        /// </summary>
        /// <param name="ianaTimezone">IANA 時區標識符（如 "Asia/Hong_Kong"）</param>
        /// <returns>GMT 偏移字符串（如 "UTC+8"）</returns>
        public static string GetGMTOffsetString(string ianaTimezone)
        {
            if (string.IsNullOrEmpty(ianaTimezone))
                return "UTC+0";

            if (TimezoneMap.TryGetValue(ianaTimezone, out var timezoneInfo))
            {
                var offset = timezoneInfo.Offset;
                if (offset == 0) return "UTC+0";
                if (offset > 0)
                {
                    // 處理半小時偏移
                    if (offset % 1 == 0.5)
                    {
                        return $"UTC+{(int)offset}:30";
                    }
                    return $"UTC+{offset}";
                }
                else
                {
                    // 處理負偏移
                    if (offset % 1 == -0.5)
                    {
                        return $"UTC{(int)offset}:30";
                    }
                    return $"UTC{offset}";
                }
            }

            // 如果找不到對應的時區，返回默認值
            return "UTC+0";
        }

        /// <summary>
        /// 根據 IANA 時區標識符獲取時區信息
        /// </summary>
        /// <param name="ianaTimezone">IANA 時區標識符</param>
        /// <returns>時區信息，如果找不到則返回 UTC+0</returns>
        public static TimezoneInfo GetTimezoneInfo(string ianaTimezone)
        {
            if (string.IsNullOrEmpty(ianaTimezone) || !TimezoneMap.TryGetValue(ianaTimezone, out var timezoneInfo))
            {
                return new TimezoneInfo { Offset = 0, Label = "UTC+0 UTC (Coordinated Universal Time)" };
            }

            return timezoneInfo;
        }

        /// <summary>
        /// 獲取所有可用的時區列表
        /// </summary>
        /// <returns>時區列表</returns>
        public static Dictionary<string, TimezoneInfo> GetAllTimezones()
        {
            return new Dictionary<string, TimezoneInfo>(TimezoneMap);
        }
    }

    /// <summary>
    /// 時區信息類
    /// </summary>
    public class TimezoneInfo
    {
        public double Offset { get; set; }
        public string Label { get; set; } = string.Empty;
    }
}
