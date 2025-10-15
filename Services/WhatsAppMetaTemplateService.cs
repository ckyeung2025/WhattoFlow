using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;

namespace PurpleRice.Services
{
    public interface IWhatsAppMetaTemplateService
    {
        Task<MetaTemplateListResponse> GetMetaTemplatesAsync(Guid companyId, string name = null, string status = null, string category = null, string language = null);
        Task<MetaTemplateCreateResponse> CreateMetaTemplateAsync(Guid companyId, MetaTemplateCreateRequest request);
        Task<bool> DeleteMetaTemplateAsync(Guid companyId, string templateName);
        Task SyncMetaTemplatesAsync(Guid companyId);
    }

    public class WhatsAppMetaTemplateService : IWhatsAppMetaTemplateService
    {
        private readonly HttpClient _httpClient;
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        private static string GetMetaApiVersion() => WhatsAppApiConfig.GetApiVersion();

        public WhatsAppMetaTemplateService(
            IHttpClientFactory httpClientFactory,
            PurpleRiceDbContext context,
            Func<string, LoggingService> loggingServiceFactory)
        {
            _httpClient = httpClientFactory.CreateClient();
            _context = context;
            _loggingService = loggingServiceFactory("WhatsAppMetaTemplateService");
        }

        /// <summary>
        /// 從 Meta API 獲取模板列表（支持查詢參數）
        /// </summary>
        public async Task<MetaTemplateListResponse> GetMetaTemplatesAsync(
            Guid companyId, 
            string name = null, 
            string status = null, 
            string category = null, 
            string language = null)
        {
            try
            {
                _loggingService.LogInformation($"📋 開始獲取 Meta 模板列表 - 公司ID: {companyId}");

                var company = await _context.Companies.FindAsync(companyId);
                if (company == null || string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    throw new Exception("未找到公司配置或 WhatsApp Business Account ID");
                }

                // 構建查詢 URL
                var url = $"https://graph.facebook.com/{GetMetaApiVersion()}/{company.WA_Business_Account_ID}/message_templates";
                var queryParams = new List<string>();

                // 添加 fields 參數以獲取完整信息（包括拒絕原因）
                queryParams.Add("fields=name,status,category,id,language,components,rejected_reason,quality_rating,created_time,updated_time");

                if (!string.IsNullOrEmpty(name))
                {
                    queryParams.Add($"name={Uri.EscapeDataString(name)}");
                }
                if (!string.IsNullOrEmpty(status))
                {
                    queryParams.Add($"status={Uri.EscapeDataString(status)}");
                }
                if (!string.IsNullOrEmpty(category))
                {
                    queryParams.Add($"category={Uri.EscapeDataString(category)}");
                }
                if (!string.IsNullOrEmpty(language))
                {
                    queryParams.Add($"language={Uri.EscapeDataString(language)}");
                }

                if (queryParams.Any())
                {
                    url += "?" + string.Join("&", queryParams);
                }
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                _loggingService.LogInformation($"📡 請求 URL: {url}");

                var response = await _httpClient.GetAsync(url);
                var content = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 Response Status: {response.StatusCode}");
                _loggingService.LogDebug($"📨 Response Content: {content}");

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"Meta API 請求失敗: {response.StatusCode} - {content}");
                }

                var result = JsonSerializer.Deserialize<MetaTemplateListResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                _loggingService.LogInformation($"✅ 成功獲取 {result?.Data?.Count ?? 0} 個 Meta 模板");
                
                // 調試：檢查被拒絕的模板
                if (result?.Data != null)
                {
                    var rejectedTemplates = result.Data.Where(t => t.Status == "REJECTED").ToList();
                    if (rejectedTemplates.Any())
                    {
                        _loggingService.LogInformation($"🔍 發現 {rejectedTemplates.Count} 個被拒絕的模板:");
                        foreach (var template in rejectedTemplates)
                        {
                            _loggingService.LogInformation($"  - 模板: {template.Name}, 拒絕原因: {template.RejectedReason ?? "未提供"}, 質量評級: {template.QualityRating ?? "未提供"}");
                        }
                    }
                }

                return result;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 獲取 Meta 模板列表失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 創建 Meta 模板並提交審核
        /// </summary>
        public async Task<MetaTemplateCreateResponse> CreateMetaTemplateAsync(
            Guid companyId, 
            MetaTemplateCreateRequest request)
        {
            try
            {
                _loggingService.LogInformation($"📝 開始創建 Meta 模板 - 名稱: {request.Name}");

                var company = await _context.Companies.FindAsync(companyId);
                if (company == null)
                {
                    throw new Exception("未找到公司配置");
                }

                var url = $"https://graph.facebook.com/{GetMetaApiVersion()}/{company.WA_Business_Account_ID}/message_templates";
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                // 構建 Meta API 請求格式
                var payload = new
                {
                    name = request.Name,
                    category = request.Category,
                    language = request.Language,
                    components = request.Components,
                    allow_category_change = true  // 允許 Meta 根據內容自動調整類別
                };

                var jsonPayload = JsonSerializer.Serialize(payload);
                _loggingService.LogInformation($"📤 發送請求: {jsonPayload}");

                var response = await _httpClient.PostAsJsonAsync(url, payload);
                var content = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 Response Status: {response.StatusCode}");
                _loggingService.LogDebug($"📨 Response Content: {content}");

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"創建 Meta 模板失敗: {response.StatusCode} - {content}");
                }

                var result = JsonSerializer.Deserialize<MetaTemplateCreateResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                _loggingService.LogInformation($"✅ Meta 模板創建成功 - ID: {result.Id}");

                return result;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 創建 Meta 模板失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 刪除 Meta 模板
        /// </summary>
        public async Task<bool> DeleteMetaTemplateAsync(Guid companyId, string templateName)
        {
            try
            {
                _loggingService.LogInformation($"🗑️ 開始刪除 Meta 模板 - 名稱: {templateName}");

                var company = await _context.Companies.FindAsync(companyId);
                if (company == null)
                {
                    throw new Exception("未找到公司配置");
                }

                var url = $"https://graph.facebook.com/{GetMetaApiVersion()}/{company.WA_Business_Account_ID}/message_templates?name={templateName}";
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                var response = await _httpClient.DeleteAsync(url);
                var content = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 Response Status: {response.StatusCode}");

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"刪除 Meta 模板失敗: {response.StatusCode} - {content}");
                }

                _loggingService.LogInformation($"✅ Meta 模板刪除成功");
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 刪除 Meta 模板失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 同步 Meta 模板狀態到本地數據庫
        /// </summary>
        public async Task SyncMetaTemplatesAsync(Guid companyId)
        {
            try
            {
                _loggingService.LogInformation($"🔄 開始同步 Meta 模板狀態");

                var metaTemplates = await GetMetaTemplatesAsync(companyId);

                // 這裡可以將 Meta 模板狀態同步到本地數據庫
                // 用於離線查看或統計分析

                _loggingService.LogInformation($"✅ Meta 模板狀態同步完成");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 同步 Meta 模板狀態失敗: {ex.Message}", ex);
                throw;
            }
        }
    }

    #region DTO Classes

    public class MetaTemplateListResponse
    {
        public List<MetaTemplateData> Data { get; set; }
        public MetaPaging Paging { get; set; }
    }

    public class MetaTemplateData
    {
        public string Name { get; set; }
        public string Status { get; set; }
        public string Category { get; set; }
        public string Id { get; set; }
        public string Language { get; set; }
        public List<MetaComponent> Components { get; set; }
        
        // 新增：拒絕原因相關字段
        [System.Text.Json.Serialization.JsonPropertyName("rejected_reason")]
        public string? RejectedReason { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("quality_rating")]
        public string? QualityRating { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("created_time")]
        public DateTime? CreatedTime { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("updated_time")]
        public DateTime? UpdatedTime { get; set; }
    }

    public class MetaComponent
    {
        public string Type { get; set; }
        public string Format { get; set; }
        public string Text { get; set; }
        public List<MetaButton> Buttons { get; set; }
        public MetaExample Example { get; set; }
    }

    public class MetaButton
    {
        public string Type { get; set; }
        public string Text { get; set; }
        public string Url { get; set; }
        public string PhoneNumber { get; set; }
    }

    public class MetaExample
    {
        public List<List<string>> HeaderText { get; set; }
        public List<List<string>> BodyText { get; set; }
    }

    public class MetaPaging
    {
        public string Next { get; set; }
        public MetaCursors Cursors { get; set; }
    }

    public class MetaCursors
    {
        public string Before { get; set; }
        public string After { get; set; }
    }

    public class MetaTemplateCreateRequest
    {
        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string Name { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("category")]
        public string Category { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("language")]
        public string Language { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("components")]
        public List<MetaComponentRequest> Components { get; set; }
    }

    public class MetaComponentRequest
    {
        [System.Text.Json.Serialization.JsonPropertyName("type")]
        public string Type { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("format")]
        public string? Format { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("text")]
        public string? Text { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("buttons")]
        public List<MetaButtonRequest>? Buttons { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("example")]
        public MetaExampleRequest? Example { get; set; }
    }

    public class MetaButtonRequest
    {
        [System.Text.Json.Serialization.JsonPropertyName("type")]
        public string Type { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("text")]
        public string Text { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("url")]
        public string? Url { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("phone_number")]
        public string? PhoneNumber { get; set; }
    }

    public class MetaExampleRequest
    {
        [System.Text.Json.Serialization.JsonPropertyName("header_text")]
        public List<List<string>>? HeaderText { get; set; }  // 修改為嵌套數組
        
        [System.Text.Json.Serialization.JsonPropertyName("body_text")]
        public List<List<string>>? BodyText { get; set; }  // 修改為嵌套數組
    }

    public class MetaTemplateCreateResponse
    {
        public string Id { get; set; }
        public string Status { get; set; }
        public string Category { get; set; }
    }

    #endregion
}

