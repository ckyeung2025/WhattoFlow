using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.IO;

namespace PurpleRice.Services
{
    public enum LogLevel
    {
        Debug = 0,
        Information = 1,
        Warning = 2,
        Error = 3,
        Critical = 4
    }

    public class LoggingService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<LoggingService> _logger;
        private readonly string _serviceName;
        private readonly string _logFilePath;
        private readonly bool _enableFileLogging;
        private readonly LogLevel _minLogLevel;

        public LoggingService(IConfiguration configuration, ILogger<LoggingService> logger, string serviceName)
        {
            _configuration = configuration;
            _logger = logger;
            _serviceName = serviceName;

            // 從配置中讀取日誌設置
            var logSection = _configuration.GetSection($"Logging:{serviceName}");
            Console.WriteLine($"讀取配置區段: Logging:{serviceName}");
            Console.WriteLine($"配置區段存在: {logSection.Exists()}");
            
            _enableFileLogging = logSection.GetValue<bool>("EnableFileLogging", true);
            _minLogLevel = Enum.Parse<LogLevel>(logSection.GetValue<string>("LogLevel", "Debug"));
            
            var logPathTemplate = logSection.GetValue<string>("LogFilePath", $"logs/{serviceName.ToLower()}_{{0:yyyyMMdd}}.log");
            
            // 使用應用程序目錄而不是當前目錄（Windows Service 模式下很重要）
            // AppContext.BaseDirectory 在服務模式下會返回應用程序目錄
            var appBasePath = AppContext.BaseDirectory;
            var logDir = Path.Combine(appBasePath, "logs");
            if (!Directory.Exists(logDir))
            {
                Directory.CreateDirectory(logDir);
            }
            _logFilePath = Path.Combine(logDir, $"{serviceName.ToLower()}_{DateTime.Now:yyyyMMdd}.log");
            
                         // 輸出初始化信息
             Console.WriteLine($"LoggingService 初始化完成: {serviceName} -> {_logFilePath}");
        }

        public void LogDebug(string message)
        {
            if (_minLogLevel <= LogLevel.Debug)
            {
                WriteLog("DEBUG", message);
            }
        }

        public void LogInformation(string message)
        {
            if (_minLogLevel <= LogLevel.Information)
            {
                WriteLog("INFO", message);
            }
        }

        public void LogWarning(string message)
        {
            if (_minLogLevel <= LogLevel.Warning)
            {
                WriteLog("WARN", message);
            }
        }

        public void LogError(string message, Exception exception = null)
        {
            if (_minLogLevel <= LogLevel.Error)
            {
                var fullMessage = exception != null ? $"{message}\nException: {exception.Message}\nStackTrace: {exception.StackTrace}" : message;
                WriteLog("ERROR", fullMessage);
            }
        }

        public void LogCritical(string message, Exception exception = null)
        {
            if (_minLogLevel <= LogLevel.Critical)
            {
                var fullMessage = exception != null ? $"{message}\nException: {exception.Message}\nStackTrace: {exception.StackTrace}" : message;
                WriteLog("CRITICAL", fullMessage);
            }
        }

        private void WriteLog(string level, string message)
        {
            var logMessage = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] [{level}] [{_serviceName}] {message}";
            
            // 輸出到控制台
            Console.WriteLine(logMessage);
            
            // 輸出到 .NET 日誌系統
            switch (level)
            {
                case "DEBUG":
                    _logger.LogDebug(message);
                    break;
                case "INFO":
                    _logger.LogInformation(message);
                    break;
                case "WARN":
                    _logger.LogWarning(message);
                    break;
                case "ERROR":
                    _logger.LogError(message);
                    break;
                case "CRITICAL":
                    _logger.LogCritical(message);
                    break;
            }
            
            // 輸出到文件
            if (_enableFileLogging)
            {
                                 try
                 {
                     File.AppendAllText(_logFilePath, logMessage + Environment.NewLine);
                 }
                 catch (Exception ex)
                 {
                     Console.WriteLine($"寫入日誌文件失敗: {ex.Message} -> {_logFilePath}");
                 }
            }
        }
    }
} 