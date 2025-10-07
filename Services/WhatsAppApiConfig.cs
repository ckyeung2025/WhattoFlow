using Microsoft.Extensions.Configuration;

namespace PurpleRice.Services
{
    /// <summary>
    /// WhatsApp API 配置管理
    /// </summary>
    public static class WhatsAppApiConfig
    {
        private static IConfiguration? _configuration;
        private static readonly string DefaultApiVersion = "v21.0";

        /// <summary>
        /// 初始化配置
        /// </summary>
        /// <param name="configuration">配置對象</param>
        public static void Initialize(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        /// <summary>
        /// 獲取 Meta API 版本
        /// </summary>
        /// <returns>API 版本字符串</returns>
        public static string GetApiVersion()
        {
            return _configuration?["WhatsApp:ApiVersion"] ?? DefaultApiVersion;
        }
    }
}
