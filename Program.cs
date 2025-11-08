using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.IO;
using PurpleRice.Data;
using PurpleRice.Services;
using PurpleRice.Models;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc;
using PurpleRice.Services.ApiProviders;
using PurpleRice.Services.Security;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        // 配置 JSON 屬性名稱策略為 camelCase，以匹配前端 JavaScript 慣例
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        // 自定義模型驗證錯誤響應，以便記錄詳細信息
        options.InvalidModelStateResponseFactory = context =>
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogError("=== 模型驗證失敗 ===");
            logger.LogError("請求路徑: {Path}", context.HttpContext.Request.Path);
            logger.LogError("請求方法: {Method}", context.HttpContext.Request.Method);
            
            foreach (var error in context.ModelState)
            {
                logger.LogError("字段: {Key}, 錯誤: {Errors}", 
                    error.Key, 
                    string.Join(", ", error.Value.Errors.Select(e => e.ErrorMessage)));
            }
            
            // 嘗試讀取請求體
            context.HttpContext.Request.EnableBuffering();
            context.HttpContext.Request.Body.Position = 0;
            using var reader = new StreamReader(context.HttpContext.Request.Body, leaveOpen: true);
            var body = reader.ReadToEndAsync().Result;
            context.HttpContext.Request.Body.Position = 0;
            logger.LogError("請求體: {RequestBody}", body);
            
            return new BadRequestObjectResult(new { 
                success = false, 
                message = "請求數據驗證失敗", 
                errors = context.ModelState 
            });
        };
    });

builder.Services.AddDbContext<PurpleRiceDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("PurpleRice"), sqlOptions =>
    {
        // 禁用 OUTPUT 子句以支援有觸發器的表
        sqlOptions.CommandTimeout(60);
    }));



builder.Services.AddDbContext<ErpDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("ErpDatabase")));
    
    // JWT 驗證設定
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
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("YourSuperSecretKey1234567890!@#$%^&*()")) // 32字元以上
    };
});

builder.Services.AddAuthorization();

// 添加 CORS 配置
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddScoped<PdfService>();
builder.Services.AddScoped<DeliveryService>();
builder.Services.AddScoped<DocumentConverterService>();
builder.Services.AddScoped<UserSessionService>();
builder.Services.AddScoped<IMessageValidator, MessageValidator>();
builder.Services.AddScoped<ContactListService>();
// 註冊 GoogleSheetsService
builder.Services.AddScoped<IGoogleSheetsService>(provider =>
{
    var loggingFactory = provider.GetRequiredService<Func<string, LoggingService>>();
    var apiProviderService = provider.GetRequiredService<IApiProviderService>();
    return new GoogleSheetsService(loggingFactory("GoogleSheetsService"), apiProviderService);
});

// 註冊 LoggingService 工廠
builder.Services.AddScoped<Func<string, LoggingService>>(provider =>
{
    return serviceName =>
    {
        var configuration = provider.GetRequiredService<IConfiguration>();
        var logger = provider.GetRequiredService<ILogger<LoggingService>>();
        return new LoggingService(configuration, logger, serviceName);
    };
});

// 註冊 WorkflowMessageSend 相關服務
builder.Services.AddScoped<WorkflowMessageSendService>();
builder.Services.AddScoped<RecipientResolverService>();

// 註冊 WhatsAppWorkflowService
builder.Services.AddScoped<WhatsAppWorkflowService>();

// 註冊 LoggingService 實例（用於控制器）
builder.Services.AddScoped<LoggingService>(provider =>
{
    var configuration = provider.GetRequiredService<IConfiguration>();
    var logger = provider.GetRequiredService<ILogger<LoggingService>>();
    return new LoggingService(configuration, logger, "WhatsAppController");
});

builder.Services.AddSingleton<IApiKeyProtector, ApiKeyProtector>();
builder.Services.AddScoped<IApiProviderService, ApiProviderService>();
builder.Services.AddScoped<IAiCompletionClient, AiCompletionClient>();

builder.Services.AddScoped<WorkflowEngine>(); // 改為 Scoped 以解決生命週期問題

// 註冊 Webhook 服務
builder.Services.AddScoped<PurpleRice.Services.WebhookServices.WebhookVerificationService>();
builder.Services.AddScoped<PurpleRice.Services.WebhookServices.WebhookMessageProcessingService>();
builder.Services.AddScoped<PurpleRice.Services.WebhookServices.WebhookDuplicateService>();

// 註冊 EForm 服務
builder.Services.AddScoped<EFormService>();

// 註冊 ProcessVariable 服務
builder.Services.AddScoped<IProcessVariableService, ProcessVariableService>();

// 註冊 QR Code 服務
builder.Services.AddScoped<IQRCodeService, QRCodeService>();

// 註冊 WorkflowExecution 服務
builder.Services.AddScoped<IWorkflowExecutionService, WorkflowExecutionService>();

// 註冊 VariableReplacement 服務
builder.Services.AddScoped<IVariableReplacementService, VariableReplacementService>();

// 註冊 SwitchCondition 服務
builder.Services.AddScoped<ISwitchConditionService, SwitchConditionService>();
builder.Services.AddScoped<DataSetQueryService>();

// 註冊 WhatsApp Meta Template 服務
builder.Services.AddScoped<IWhatsAppMetaTemplateService, WhatsAppMetaTemplateService>();

// 註冊 EForm Token 服務
builder.Services.AddScoped<IEFormTokenService, EFormTokenService>();

// 註冊 HttpClient 服務
builder.Services.AddHttpClient();

// 註冊工作流程監控定時服務（背景服務）
builder.Services.AddHostedService<WorkflowMonitoringSchedulerService>();

// 啟用 Windows Service 支援
builder.Host.UseWindowsService();

// 如果未啟用 HTTPS，從配置中移除證書配置，避免 Kestrel 自動嘗試加載證書
// 這需要在 ConfigureKestrel 之前執行，因為 Kestrel 會在內部配置加載時讀取證書配置
var enableHttps = builder.Configuration.GetValue<bool>("Kestrel:EnableHttps", false);
if (!enableHttps)
{
    // 通過修改配置來防止 Kestrel 自動加載證書
    // 使用配置源的索引器來設置空值，這會覆蓋配置文件中的值
    if (builder.Configuration is IConfigurationRoot configRoot)
    {
        configRoot["Kestrel:Certificates:Default:Path"] = string.Empty;
        configRoot["Kestrel:Certificates:Default:Password"] = string.Empty;
        configRoot["Kestrel:Certificates:Default:Store"] = string.Empty;
        configRoot["Kestrel:Certificates:Default:Subject"] = string.Empty;
        configRoot["Kestrel:Certificates:Default:Thumbprint"] = string.Empty;
    }
}

// 配置 Kestrel 服務器選項（支持 HTTPS）
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    var dotNetPort = builder.Configuration["Ports:DotNet"] ?? "64213";
    var httpsPort = builder.Configuration["Ports:DotNetHttps"] ?? "64214";
    var enableHttps = builder.Configuration.GetValue<bool>("Kestrel:EnableHttps", false);
    
    // 配置 HTTP 端點 - 監聽所有網絡接口 (0.0.0.0)
    serverOptions.ListenAnyIP(int.Parse(dotNetPort), listenOptions =>
    {
        listenOptions.Protocols = Microsoft.AspNetCore.Server.Kestrel.Core.HttpProtocols.Http1AndHttp2;
    });
    
        // 如果啟用 HTTPS，配置 HTTPS 端點
    if (enableHttps)
    {
        var certificatePath = builder.Configuration["Kestrel:Certificates:Default:Path"];
        var certificatePassword = builder.Configuration["Kestrel:Certificates:Default:Password"];
        var certificateStore = builder.Configuration["Kestrel:Certificates:Default:Store"];
        var certificateSubject = builder.Configuration["Kestrel:Certificates:Default:Subject"];
        var certificateThumbprint = builder.Configuration["Kestrel:Certificates:Default:Thumbprint"];

        // 如果證書路徑是相對路徑，將其解析為基於應用程序目錄的絕對路徑
        if (!string.IsNullOrEmpty(certificatePath) && !Path.IsPathRooted(certificatePath))
        {
            var appBasePath = AppContext.BaseDirectory;
            certificatePath = Path.Combine(appBasePath, certificatePath);
        }

        // 嘗試找到有效的證書
        System.Security.Cryptography.X509Certificates.X509Certificate2? certificate = null;
        string? certificateSource = null;

        // 優先使用證書文件
        if (!string.IsNullOrEmpty(certificatePath))
        {
            if (File.Exists(certificatePath))
            {
                try
                {
                    certificate = new System.Security.Cryptography.X509Certificates.X509Certificate2(
                        certificatePath, 
                        certificatePassword ?? string.Empty);
                    certificateSource = $"文件: {certificatePath}";
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"警告: 無法加載證書文件 {certificatePath}: {ex.Message}");
                }
            }
            else
            {
                Console.WriteLine($"警告: 找不到證書文件: {certificatePath}");
            }
        }

        // 如果證書文件不存在或加載失敗，嘗試使用 Windows 證書存儲
        if (certificate == null && !string.IsNullOrEmpty(certificateStore))
        {
            try
            {
                using var store = new System.Security.Cryptography.X509Certificates.X509Store(certificateStore, System.Security.Cryptography.X509Certificates.StoreLocation.LocalMachine);
                store.Open(System.Security.Cryptography.X509Certificates.OpenFlags.ReadOnly);

                // 優先使用 Thumbprint 查找（更精確）
                if (!string.IsNullOrEmpty(certificateThumbprint))
                {
                    var certificates = store.Certificates.Find(
                        System.Security.Cryptography.X509Certificates.X509FindType.FindByThumbprint,
                        certificateThumbprint,
                        false);

                    if (certificates.Count > 0)
                    {
                        certificate = certificates[0];
                        certificateSource = $"證書存儲: {certificateStore}, Thumbprint: {certificateThumbprint}";
                    }
                }
                // 其次使用 Subject 查找
                else if (!string.IsNullOrEmpty(certificateSubject))
                {
                    var certificates = store.Certificates.Find(
                        System.Security.Cryptography.X509Certificates.X509FindType.FindBySubjectName,
                        certificateSubject,
                        false);

                    if (certificates.Count > 0)
                    {
                        certificate = certificates[0];
                        certificateSource = $"證書存儲: {certificateStore}, Subject: {certificateSubject}";
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"警告: 無法從證書存儲加載證書: {ex.Message}");
            }
        }

        // 如果找到了有效證書，配置 HTTPS 端點 - 監聽所有網絡接口
        if (certificate != null)
        {
            serverOptions.ListenAnyIP(int.Parse(httpsPort), listenOptions =>
            {
                listenOptions.Protocols = Microsoft.AspNetCore.Server.Kestrel.Core.HttpProtocols.Http1AndHttp2;
                listenOptions.UseHttps(certificate);
            });

            Console.WriteLine($"HTTPS 已啟用，監聽端口: {httpsPort}，使用證書: {certificateSource}");
        }
        else
        {
            // 找不到證書，記錄警告但不拋出異常，只啟動 HTTP
            Console.WriteLine($"警告: HTTPS 已啟用但找不到有效證書，將跳過 HTTPS 配置，僅啟動 HTTP 服務。");
            Console.WriteLine($"請檢查證書配置或將 Kestrel:EnableHttps 設置為 false。");
        }
    }
});

// 配置應用程序 URL（向後兼容，但 Kestrel 配置優先）
// 注意：實際的端點配置在 ConfigureKestrel 中完成，這裡只是為了兼容性
var dotNetPort = builder.Configuration["Ports:DotNet"] ?? "64213";
// 改為監聽所有網絡接口 (0.0.0.0)
builder.WebHost.UseUrls($"http://0.0.0.0:{dotNetPort}");

var app = builder.Build();

// 添加請求日誌中間件（僅用於調試）
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api/contactimport/schedule") && 
        (context.Request.Method == "PUT" || context.Request.Method == "POST"))
    {
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogInformation("=== 收到排程請求 ===");
        logger.LogInformation("路徑: {Path}", context.Request.Path);
        logger.LogInformation("方法: {Method}", context.Request.Method);
        logger.LogInformation("Content-Type: {ContentType}", context.Request.ContentType);
        
        // 讀取請求體
        context.Request.EnableBuffering();
        context.Request.Body.Position = 0;
        using var reader = new StreamReader(context.Request.Body, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        context.Request.Body.Position = 0;
        logger.LogInformation("請求體: {RequestBody}", body);
    }
    
    await next();
});

// 確保工作目錄設置為應用程序目錄（Windows Service 模式下很重要）
var appBasePath = AppContext.BaseDirectory;
if (Directory.Exists(appBasePath))
{
    Directory.SetCurrentDirectory(appBasePath);
    Console.WriteLine($"工作目錄已設置為: {Directory.GetCurrentDirectory()}");
}

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

// 啟用靜態檔案服務
app.UseStaticFiles();

// 注意：靜態文件中間件在認證之後，但 /Uploads 目錄應該需要認證
// 為了保護 /Uploads，我們需要創建一個自定義中間件或者使用授權策略
// 目前先確保 /public 是公開的，/Uploads 需要認證（通過 API 端點控制）

// 確保必要的上傳目錄存在（使用應用程序目錄，已在上面設置工作目錄）
var uploadsBaseDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads");
var customerDir = Path.Combine(uploadsBaseDir, "Customer");
var formsFilesDir = Path.Combine(uploadsBaseDir, "FormsFiles");
var documentsDir = Path.Combine(uploadsBaseDir, "FormsFiles", "Documents");

if (!Directory.Exists(uploadsBaseDir)) Directory.CreateDirectory(uploadsBaseDir);
if (!Directory.Exists(customerDir)) Directory.CreateDirectory(customerDir);
if (!Directory.Exists(formsFilesDir)) Directory.CreateDirectory(formsFilesDir);
if (!Directory.Exists(documentsDir)) Directory.CreateDirectory(documentsDir);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(customerDir),
    RequestPath = "/Customer"
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsBaseDir),
    RequestPath = "/Uploads"
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(documentsDir),
    RequestPath = "/Documents",
    ServeUnknownFileTypes = true
});

// 配置 /public 目錄為公開資源（不需要認證）
var publicDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "public");
if (!Directory.Exists(publicDir)) Directory.CreateDirectory(publicDir);
var metaTemplatesPublicDir = Path.Combine(publicDir, "meta-templates");
if (!Directory.Exists(metaTemplatesPublicDir)) Directory.CreateDirectory(metaTemplatesPublicDir);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(publicDir),
    RequestPath = "/public",
    ServeUnknownFileTypes = true
});


// 初始化 WhatsApp API 配置
PurpleRice.Services.WhatsAppApiConfig.Initialize(app.Configuration);

app.MapControllers();

// 支援 React SPA 路由（必須在 MapControllers 之後）
app.MapFallbackToFile("index.html");

app.Run(); 