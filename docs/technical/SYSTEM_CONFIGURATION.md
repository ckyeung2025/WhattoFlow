# 系統配置文檔

## 🎯 **概述**

本文檔詳細描述了 WhattoFlow 系統的配置選項、環境設定、部署要求和性能調優參數。

## ��️ **基礎配置**

### **1. 應用程序配置 (appsettings.json)**
```json
{
  "ConnectionStrings": {
    "PurpleRice": "Server=localhost;Database=PurpleRice;Trusted_Connection=true;TrustServerCertificate=true;",
    "ErpDatabase": "Server=localhost;Database=ERP;Trusted_Connection=true;TrustServerCertificate=true;"
  },
  "JwtSettings": {
    "SecretKey": "YourSuperSecretKey1234567890!@#$%^&*()",
    "Issuer": "WhattoFlow",
    "Audience": "WhattoFlowUsers",
    "ExpirationMinutes": 1440
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

### **2. 數據庫配置**
```sql
-- 主要數據庫連接
Server=localhost;Database=PurpleRice;Trusted_Connection=true;TrustServerCertificate=true;

-- ERP 數據庫連接
Server=localhost;Database=ERP;Trusted_Connection=true;TrustServerCertificate=true;

-- 連接池配置
Max Pool Size=100;Min Pool Size=5;Connection Lifetime=300;
```

## �� **認證配置**

### **1. JWT 設定**
```csharp
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes("YourSuperSecretKey1234567890!@#$%^&*()")
        )
    };
});
```

### **2. 權限策略**
```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CompanyAccess", policy =>
        policy.RequireClaim("company_id"));
        
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole("Admin"));
});
```

## �� **服務註冊配置**

### **1. 核心服務**
```csharp
// 數據庫上下文
builder.Services.AddDbContext<PurpleRiceDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("PurpleRice")));

builder.Services.AddDbContext<ErpDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("ErpDatabase")));

// 業務服務
builder.Services.AddScoped<PdfService>();
builder.Services.AddScoped<DeliveryService>();
builder.Services.AddScoped<DocumentConverterService>();
builder.Services.AddScoped<UserSessionService>();
builder.Services.AddScoped<IMessageValidator, DefaultMessageValidator>();
builder.Services.AddTransient<WhatsAppWorkflowService>();
builder.Services.AddScoped<WorkflowEngine>();

// HTTP 客戶端
builder.Services.AddHttpClient();
```

### **2. 日誌服務工廠**
```csharp
// 註冊 LoggingService 工廠
builder.Services.AddScoped<Func<string, LoggingService>>(serviceProvider => 
    category => new LoggingService(category, serviceProvider.GetRequiredService<ILogger<LoggingService>>()));
```

## 🌐 **WhatsApp 配置**

### **1. Meta Webhook 設定**
```json
{
  "WhatsApp": {
    "AccessToken": "your_access_token_here",
    "PhoneNumberId": "your_phone_number_id",
    "BusinessAccountId": "your_business_account_id",
    "WebhookVerifyToken": "your_webhook_verify_token",
    "ApiVersion": "v18.0"
  },
  "Webhook": {
    "Url": "https://your-domain.com/api/webhook",
    "VerifyToken": "your_webhook_verify_token"
  }
}
```

### **2. Webhook 處理配置**
```csharp
public class MetaWebhookController : ControllerBase
{
    // 記憶體快取配置
    private static readonly Dictionary<string, DateTime> _processedMessages = 
        new Dictionary<string, DateTime>();
    private static readonly TimeSpan _messageExpiry = TimeSpan.FromHours(24);
    
    [HttpPost]
    public async Task<IActionResult> HandleWebhook([FromBody] WebhookRequest request)
    {
        // Webhook 處理邏輯
    }
}
```

## �� **文檔處理配置**

### **1. LibreOffice 路徑配置**
```csharp
public class DocumentConverterService
{
    private readonly string _libreOfficePath;
    
    public DocumentConverterService(ILogger<DocumentConverterService> logger)
    {
        _logger = logger;
        _libreOfficePath = FindLibreOfficePathSync();
    }
    
    private string FindLibreOfficePathSync()
    {
        // 自動查找 LibreOffice 安裝路徑
        var possiblePaths = new[]
        {
            @"C:\Program Files\LibreOffice\program\soffice.exe",
            @"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            @"/usr/bin/soffice",
            @"/Applications/LibreOffice.app/Contents/MacOS/soffice"
        };
        
        foreach (var path in possiblePaths)
        {
            if (File.Exists(path))
                return path;
        }
        
        throw new FileNotFoundException("找不到 LibreOffice 安裝路徑");
    }
}
```

### **2. 文件上傳配置**
```csharp
public class FormsUploadController : ControllerBase
{
    private readonly string _uploadPath = Path.Combine("Uploads", "FormsFiles");
    
    [HttpPost("document")]
    public async Task<IActionResult> UploadDocument(IFormFile file)
    {
        // 文件大小限制
        if (file.Length > 10 * 1024 * 1024) // 10MB
        {
            return BadRequest("文件大小超過限制");
        }
        
        // 文件類型驗證
        var allowedExtensions = new[] { ".doc", ".docx", ".xls", ".xlsx", ".pdf" };
        var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
        
        if (!allowedExtensions.Contains(fileExtension))
        {
            return BadRequest("不支持的文件類型");
        }
    }
}
```

## 🚀 **工作流引擎配置**

### **1. 引擎參數**
```json
{
  "WorkflowEngine": {
    "MaxConcurrentExecutions": 100,
    "ExecutionTimeout": 300,
    "RetryAttempts": 3,
    "RetryDelay": 5000,
    "EnableLogging": true,
    "LogLevel": "Info",
    "EnableParallelExecution": true,
    "MaxParallelBranches": 10
  }
}
```

### **2. 執行配置**
```csharp
public class WorkflowEngine
{
    private readonly int _maxConcurrentExecutions;
    private readonly int _executionTimeout;
    private readonly int _retryAttempts;
    
    public WorkflowEngine(IConfiguration configuration, ...)
    {
        _maxConcurrentExecutions = configuration.GetValue<int>("WorkflowEngine:MaxConcurrentExecutions", 100);
        _executionTimeout = configuration.GetValue<int>("WorkflowEngine:ExecutionTimeout", 300);
        _retryAttempts = configuration.GetValue<int>("WorkflowEngine:RetryAttempts", 3);
    }
}
```

## �� **日誌配置**

### **1. 日誌級別設定**
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore": "Warning",
      "PurpleRice.Services": "Information",
      "PurpleRice.Controllers": "Information"
    }
  }
}
```

### **2. 自定義日誌服務**
```csharp
public class LoggingService
{
    private readonly string _category;
    private readonly ILogger _logger;
    private readonly string _logFilePath;
    
    public LoggingService(string category, ILogger logger)
    {
        _category = category;
        _logger = logger;
        _logFilePath = Path.Combine("Logs", $"{category}_{DateTime.Now:yyyyMMdd}.log");
    }
    
    public void LogInformation(string message)
    {
        _logger.LogInformation($"[{_category}] {message}");
        WriteToFile("INFO", message);
    }
    
    public void LogError(Exception ex, string message)
    {
        _logger.LogError(ex, $"[{_category}] {message}");
        WriteToFile("ERROR", $"{message}: {ex.Message}");
    }
}
```

## �� **性能調優配置**

### **1. 數據庫優化**
```csharp
// 連接池配置
builder.Services.AddDbContext<PurpleRiceDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("PurpleRice"), 
        sqlOptions => sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(30),
            errorNumbersToAdd: null));
});

// 查詢優化
options.ConfigureWarnings(warnings => warnings.Ignore(
    CoreEventId.NavigationBaseIncludeIgnored));
```

### **2. 緩存配置**
```csharp
// 記憶體緩存
builder.Services.AddMemoryCache();

// 分布式緩存 (Redis)
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = "localhost:6379";
    options.InstanceName = "WhattoFlow_";
});
```

### **3. HTTP 客戶端配置**
```csharp
builder.Services.AddHttpClient("WhatsApp", client =>
{
    client.BaseAddress = new Uri("https://graph.facebook.com/");
    client.Timeout = T
