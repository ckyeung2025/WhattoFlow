using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using System.Text;
using PurpleRice.Data;
using PurpleRice.Services;
using PurpleRice.Models;
using Microsoft.EntityFrameworkCore.Diagnostics;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddDbContext<PurpleRiceDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("PurpleRice")));



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
builder.Services.AddScoped<PdfService>();
builder.Services.AddScoped<DeliveryService>();
builder.Services.AddScoped<DocumentConverterService>();
builder.Services.AddScoped<UserSessionService>();
builder.Services.AddScoped<IMessageValidator, DefaultMessageValidator>();
builder.Services.AddScoped<ContactListService>();

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

// 註冊 HttpClient 服務
builder.Services.AddHttpClient();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

// 啟用靜態檔案服務
app.UseStaticFiles();


app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Customer")),
    RequestPath = "/Customer"
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "Uploads")),
    RequestPath = "/Uploads"
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "FormsFiles", "Documents")),
    RequestPath = "/Documents",
    ServeUnknownFileTypes = true
});


// 初始化 WhatsApp API 配置
PurpleRice.Services.WhatsAppApiConfig.Initialize(app.Configuration);

app.MapControllers();

app.Run(); 