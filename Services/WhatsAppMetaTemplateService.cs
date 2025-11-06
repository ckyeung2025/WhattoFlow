using System;
using System.Collections.Generic;
using System.IO;
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
        Task<MetaTemplateCreateResponse> CreateMetaTemplateAsync(Guid companyId, MetaTemplateCreateRequest request, Guid? userId = null);
        Task<bool> DeleteMetaTemplateAsync(Guid companyId, string templateName);
        Task SyncMetaTemplatesAsync(Guid companyId);
        Task<string> UploadMediaToMetaAsync(Guid companyId, string mediaUrl, string mediaType);
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
            MetaTemplateCreateRequest request,
            Guid? userId = null)
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

                // 保存 header 相關信息（用於後續保存到數據庫）
                // 注意：每次創建 template 時都應該重置這些變量，避免保留上一次的值
                string savedHeaderUrl = null;
                string savedHeaderType = null;
                string savedHeaderFilename = null;
                
                // 處理 components：如果有 header_url，需要先上傳到 Meta 獲取 handle
                var processedComponents = new List<object>();
                foreach (var component in request.Components)
                {
                    var componentDict = new Dictionary<string, object>();
                    
                    // 複製基本屬性
                    if (component.Type != null) componentDict["type"] = component.Type;
                    if (component.Format != null) componentDict["format"] = component.Format;
                    if (component.Text != null) componentDict["text"] = component.Text;
                    if (component.Buttons != null && component.Buttons.Count > 0)
                    {
                        componentDict["buttons"] = component.Buttons;
                    }
                    
                    // 處理 example
                    if (component.Example != null)
                    {
                        var exampleDict = new Dictionary<string, object>();
                        
                        // 處理 header_url：對於模板創建，必須使用 Resumable Upload 獲取 header_handle
                        // 注意：header_url 只能用於發送消息，不能用於創建模板
                        // 創建模板時必須使用 header_handle（通過 Resumable Upload API 獲取）
                        // 重要：只處理 HEADER 類型的 component，並且每次只處理第一個（避免重複設置）
                        if (component.Type == "HEADER" && !string.IsNullOrEmpty(component.Example.HeaderUrl))
                        {
                            var headerUrl = component.Example.HeaderUrl.Trim();
                            
                            // 確定媒體類型（從 component.Format 獲取，而不是從 URL 推斷）
                            string mediaType = component.Format?.ToUpper() switch
                            {
                                "IMAGE" => "image",
                                "VIDEO" => "video",
                                "DOCUMENT" => "document",
                                _ => "image"
                            };
                            
                            // 驗證文件擴展名是否與媒體類型匹配
                            try
                            {
                                var uri = new Uri(headerUrl);
                                var fileName = uri.Segments.LastOrDefault()?.Split('?').FirstOrDefault();
                                if (!string.IsNullOrEmpty(fileName))
                                {
                                    var fileExtension = System.IO.Path.GetExtension(fileName).ToLowerInvariant();
                                    
                                    // 定義允許的文件擴展名
                                    var validExtensions = mediaType.ToLower() switch
                                    {
                                        "image" => new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp" },
                                        "video" => new[] { ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mkv", ".m4v", ".3gp" },
                                        "document" => new[] { ".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx", ".ppt", ".pptx" },
                                        _ => Array.Empty<string>()
                                    };
                                    
                                    if (validExtensions.Length > 0 && !validExtensions.Contains(fileExtension))
                                    {
                                        _loggingService.LogWarning($"⚠️ 警告：文件擴展名 ({fileExtension}) 與媒體類型 ({mediaType}) 不匹配！URL: {headerUrl}");
                                        _loggingService.LogWarning($"⚠️ 允許的擴展名: {string.Join(", ", validExtensions)}");
                                        _loggingService.LogWarning($"⚠️ 這可能會導致發送消息時 Meta API 返回 'Media upload error'");
                                        throw new Exception($"文件擴展名 ({fileExtension}) 與指定的媒體類型 ({mediaType}) 不匹配。請確保上傳的文件類型與模板定義一致。");
                                    }
                                    else
                                    {
                                        _loggingService.LogInformation($"✅ 文件擴展名 ({fileExtension}) 與媒體類型 ({mediaType}) 匹配");
                                    }
                                }
                            }
                            catch (UriFormatException)
                            {
                                _loggingService.LogWarning($"⚠️ 無法解析 URL: {headerUrl}，跳過文件擴展名驗證");
                            }
                            
                            // 保存原始的 header_url（用於後續保存到數據庫）
                            // 確保 URL 是 HTTPS
                            if (headerUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                            {
                                headerUrl = headerUrl.Replace("http://", "https://", StringComparison.OrdinalIgnoreCase);
                                _loggingService.LogInformation($"🔧 將 HTTP URL 轉換為 HTTPS: {headerUrl}");
                            }
                            
                            // 只在第一次遇到 HEADER component 時設置（避免被後續 component 覆蓋）
                            if (string.IsNullOrEmpty(savedHeaderUrl))
                            {
                                savedHeaderUrl = headerUrl;
                                savedHeaderType = mediaType;
                                _loggingService.LogInformation($"💾 保存 Header 信息 - URL: {headerUrl}, Type: {mediaType}");
                            }
                            else
                            {
                                _loggingService.LogWarning($"⚠️ 檢測到多個 HEADER component，只使用第一個。忽略後續的 HeaderUrl: {headerUrl}");
                            }
                            
                            // 提取文件名（用於 DOCUMENT 類型）
                            if (mediaType == "document" && !string.IsNullOrEmpty(savedHeaderUrl))
                            {
                                // 如果 request 中有 HeaderFilename，優先使用
                                if (!string.IsNullOrEmpty(component.Example.HeaderFilename))
                                {
                                    savedHeaderFilename = component.Example.HeaderFilename;
                                    _loggingService.LogInformation($"💾 使用提供的 HeaderFilename: {savedHeaderFilename}");
                                }
                                else
                                {
                                    // 從 URL 提取文件名
                                    try
                                    {
                                        var uri = new Uri(savedHeaderUrl);
                                        var fileName = uri.Segments.LastOrDefault()?.Split('?').FirstOrDefault();
                                        if (!string.IsNullOrEmpty(fileName))
                                        {
                                            savedHeaderFilename = fileName;
                                            _loggingService.LogInformation($"💾 從 URL 提取文件名: {savedHeaderFilename}");
                                        }
                                    }
                                    catch
                                    {
                                        // 如果解析失敗，使用默認文件名
                                        savedHeaderFilename = "document.pdf";
                                        _loggingService.LogWarning($"⚠️ 無法從 URL 提取文件名，使用默認: {savedHeaderFilename}");
                                    }
                                }
                            }
                            
                            try
                            {
                                // 必須使用 Resumable Upload API 上傳並獲取 header_handle
                                _loggingService.LogInformation($"📤 使用 Resumable Upload 上傳媒體以獲取 header_handle: {headerUrl}");
                                
                                var handle = await UploadMediaToMetaAsync(companyId, headerUrl, mediaType);
                                
                                // Meta API 要求 header_handle 是單層字符串數組格式
                                // 格式：["4:...header_handle..."]
                                exampleDict["header_handle"] = new[] { handle };
                                _loggingService.LogInformation($"✅ 成功獲取 header_handle: {handle} (格式: [\"{handle}\"])");
                            }
                            catch (Exception ex)
                            {
                                _loggingService.LogError($"❌ Resumable Upload 上傳媒體到 Meta 失敗: {ex.Message}", ex);
                                throw new Exception($"無法上傳媒體以獲取 header_handle: {ex.Message}。請確保媒體 URL 可訪問且格式正確。");
                            }
                        }
                        else if (component.Example.HeaderHandle != null && component.Example.HeaderHandle.Count > 0)
                        {
                            // 如果已經有 header_handle，直接使用（已經是單層字符串數組格式）
                            // header_handle 格式：["handle1", "handle2", ...]
                            exampleDict["header_handle"] = component.Example.HeaderHandle.ToArray();
                        }
                        
                        // 處理 header_text
                        if (component.Example.HeaderText != null && component.Example.HeaderText.Count > 0)
                        {
                            exampleDict["header_text"] = component.Example.HeaderText.Select(inner => inner.ToArray()).ToArray();
                        }
                        
                        // 處理 body_text
                        if (component.Example.BodyText != null && component.Example.BodyText.Count > 0)
                        {
                            exampleDict["body_text"] = component.Example.BodyText.Select(inner => inner.ToArray()).ToArray();
                        }
                        
                        if (exampleDict.Count > 0)
                        {
                            componentDict["example"] = exampleDict;
                        }
                    }
                    
                    processedComponents.Add(componentDict);
                }

                // 構建 Meta API 請求格式
                var payload = new
                {
                    name = request.Name,
                    category = request.Category,
                    language = request.Language,
                    components = processedComponents,
                    allow_category_change = true  // 允許 Meta 根據內容自動調整類別
                };

                var jsonPayload = JsonSerializer.Serialize(payload);
                _loggingService.LogInformation($"📤 發送請求: {jsonPayload}");

                var response = await _httpClient.PostAsJsonAsync(url, payload);
                var content = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 Response Status: {response.StatusCode}");
                _loggingService.LogInformation($"📨 Response Content: {content}"); // 改為 LogInformation 以便查看詳細錯誤

                if (!response.IsSuccessStatusCode)
                {
                    // 嘗試解析錯誤信息
                    try
                    {
                        var errorJson = JsonSerializer.Deserialize<JsonElement>(content);
                        if (errorJson.TryGetProperty("error", out var errorObj))
                        {
                            var errorMsg = errorObj.TryGetProperty("message", out var msg) ? msg.GetString() : "未知錯誤";
                            var errorCode = errorObj.TryGetProperty("code", out var code) ? code.GetInt32().ToString() : "未知";
                            var errorSubcode = errorObj.TryGetProperty("error_subcode", out var subcode) ? subcode.GetInt32().ToString() : "";
                            var userMsg = errorObj.TryGetProperty("error_user_msg", out var userMsgObj) ? userMsgObj.GetString() : "";
                            
                            _loggingService.LogError($"❌ Meta API 錯誤詳情 - Code: {errorCode}, Subcode: {errorSubcode}, Message: {errorMsg}, UserMsg: {userMsg}");
                            throw new Exception($"創建 Meta 模板失敗: {errorMsg} (Code: {errorCode}, Subcode: {errorSubcode}){(string.IsNullOrEmpty(userMsg) ? "" : $"\n{userMsg}")}");
                        }
                    }
                    catch
                    {
                        // 如果解析失敗，使用原始錯誤
                    }
                    
                    throw new Exception($"創建 Meta 模板失敗: {response.StatusCode} - {content}");
                }

                var result = JsonSerializer.Deserialize<MetaTemplateCreateResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                _loggingService.LogInformation($"✅ Meta 模板創建成功 - ID: {result.Id}");

                // 保存到數據庫（如果提供了 header_url）
                if (!string.IsNullOrEmpty(savedHeaderUrl))
                {
                    try
                    {
                        _loggingService.LogInformation($"💾 準備保存到數據庫 - Template: {request.Name}, HeaderUrl: {savedHeaderUrl}, HeaderType: {savedHeaderType}, HeaderFilename: {savedHeaderFilename}");
                        
                        // 查找是否已存在記錄
                        var existingTemplate = await _context.WhatsAppTemplates
                            .FirstOrDefaultAsync(t => 
                                t.CompanyId == companyId && 
                                t.Name == request.Name && 
                                t.TemplateSource == "Meta");

                        // 構建 Content JSON（保存完整的 components 結構）
                        var contentJson = JsonSerializer.Serialize(processedComponents);
                        
                        if (existingTemplate != null)
                        {
                            // 更新現有記錄
                            existingTemplate.Status = result.Status ?? "PENDING";
                            existingTemplate.Category = result.Category ?? request.Category;
                            existingTemplate.Content = contentJson;
                            existingTemplate.Language = request.Language;
                            existingTemplate.HeaderUrl = savedHeaderUrl;
                            existingTemplate.HeaderType = savedHeaderType;
                            existingTemplate.HeaderFilename = savedHeaderFilename;
                            existingTemplate.UpdatedAt = DateTime.UtcNow;
                            if (userId.HasValue)
                            {
                                existingTemplate.UpdatedBy = userId.Value.ToString();
                            }
                            
                            _loggingService.LogInformation($"✅ 更新 WhatsAppTemplates 記錄 - Template: {request.Name}, HeaderUrl: {savedHeaderUrl}, HeaderType: {savedHeaderType}");
                        }
                        else
                        {
                            // 創建新記錄
                            var template = new WhatsAppTemplate
                            {
                                Id = Guid.NewGuid(),
                                Name = request.Name,
                                Description = request.Name, // 使用名稱作為描述
                                Category = result.Category ?? request.Category,
                                TemplateType = "Template", // Meta 模板類型
                                TemplateSource = "Meta", // 標記為 Meta 模板
                                Content = contentJson,
                                Status = result.Status ?? "PENDING",
                                Language = request.Language,
                                HeaderUrl = savedHeaderUrl,
                                HeaderType = savedHeaderType,
                                HeaderFilename = savedHeaderFilename,
                                CompanyId = companyId,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow,
                                IsDeleted = false
                            };
                            
                            if (userId.HasValue)
                            {
                                template.CreatedBy = userId.Value.ToString();
                                template.UpdatedBy = userId.Value.ToString();
                            }
                            
                            _context.WhatsAppTemplates.Add(template);
                            _loggingService.LogInformation($"✅ 創建 WhatsAppTemplates 記錄 - Template: {request.Name}, HeaderUrl: {savedHeaderUrl}, HeaderType: {savedHeaderType}");
                        }
                        
                        await _context.SaveChangesAsync();
                        _loggingService.LogInformation($"✅ 成功保存 Meta 模板到數據庫 - Template: {request.Name}");
                    }
                    catch (Exception ex)
                    {
                        // 保存失敗不影響 Meta API 創建結果，只記錄警告
                        _loggingService.LogWarning($"⚠️ 保存 Meta 模板到數據庫失敗: {ex.Message}，但不影響 Meta API 創建結果");
                    }
                }

                // 將保存的信息添加到返回結果中
                result.HeaderUrl = savedHeaderUrl;
                result.HeaderType = savedHeaderType;
                result.HeaderFilename = savedHeaderFilename;

                return result;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 創建 Meta 模板失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 使用 Resumable Upload API 上傳媒體到 Meta 並獲取 header_handle（用於模板中的 header_handle）
        /// 重要：模板媒體必須使用 Resumable Upload API，不能使用 /media 端點
        /// </summary>
        public async Task<string> UploadMediaToMetaAsync(Guid companyId, string mediaUrl, string mediaType)
        {
            try
            {
                _loggingService.LogInformation($"📤 開始使用 Resumable Upload 上傳媒體到 Meta - URL: {mediaUrl}, 類型: {mediaType}");

                var company = await _context.Companies.FindAsync(companyId);
                if (company == null)
                {
                    throw new Exception("未找到公司配置");
                }
                
                // 模板媒體必須使用 Business Account ID (WABA_ID)
                if (string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    throw new Exception("未找到 WhatsApp Business Account ID（模板媒體上傳必須使用 WABA_ID）");
                }

                // 步驟1: 下載媒體文件
                _httpClient.DefaultRequestHeaders.Clear();
                var mediaResponse = await _httpClient.GetAsync(mediaUrl);
                if (!mediaResponse.IsSuccessStatusCode)
                {
                    throw new Exception($"無法下載媒體文件: {mediaResponse.StatusCode}");
                }

                var mediaBytes = await mediaResponse.Content.ReadAsByteArrayAsync();
                var fileName = mediaUrl.Split('/').Last().Split('?').First(); // 獲取文件名
                var fileExtension = Path.GetExtension(fileName).TrimStart('.');
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                // 確定 MIME 類型
                string mimeType;
                switch (mediaType.ToLower())
                {
                    case "image":
                        mimeType = fileExtension.ToLower() switch
                        {
                            "jpg" or "jpeg" => "image/jpeg",
                            "png" => "image/png",
                            "gif" => "image/gif",
                            "webp" => "image/webp",
                            _ => "image/jpeg"
                        };
                        break;
                    case "video":
                        mimeType = fileExtension.ToLower() switch
                        {
                            "mp4" => "video/mp4",
                            "avi" => "video/x-msvideo",
                            "mov" => "video/quicktime",
                            _ => "video/mp4"
                        };
                        break;
                    case "document":
                        mimeType = "application/pdf";
                        break;
                    default:
                        mimeType = "application/octet-stream";
                        break;
                }

                // 步驟2: 創建上傳 Session（Resumable Upload - Step A）
                // 根據 Meta API 文檔，有兩種方式：
                // 1. POST /{WABA_ID}/uploads (如果 WABA_ID 有權限)
                // 2. POST /app/uploads (使用 App ID，需要不同的權限)
                // 先嘗試使用 WABA_ID，如果失敗再嘗試其他方式
                
                string createSessionUrl = null;
                string sessionContent = null;
                HttpResponseMessage sessionResponse = null;
                
                // 嘗試方式 1: 使用 WABA_ID
                if (!string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    createSessionUrl = $"https://graph.facebook.com/{GetMetaApiVersion()}/{company.WA_Business_Account_ID}/uploads";
                    _loggingService.LogInformation($"📤 Step A (方式1): 使用 WABA_ID 創建上傳 Session - URL: {createSessionUrl}");
                    
                    var sessionFormData = new MultipartFormDataContent();
                    sessionFormData.Add(new StringContent(mediaBytes.Length.ToString()), "file_length");
                    sessionFormData.Add(new StringContent(mimeType), "file_type");
                    
                    sessionResponse = await _httpClient.PostAsync(createSessionUrl, sessionFormData);
                    sessionContent = await sessionResponse.Content.ReadAsStringAsync();
                    
                    _loggingService.LogInformation($"📨 Session 創建響應 (方式1): {sessionContent}");
                    
                    // 如果成功，跳出
                    if (sessionResponse.IsSuccessStatusCode)
                    {
                        _loggingService.LogInformation($"✅ 使用 WABA_ID 創建 Session 成功");
                    }
                }
                
                // 如果方式 1 失敗，嘗試方式 2: 使用 /app/uploads
                if (sessionResponse == null || !sessionResponse.IsSuccessStatusCode)
                {
                    _loggingService.LogWarning($"⚠️ 方式1失敗，嘗試方式2: 使用 /app/uploads");
                    
                    // 嘗試從 Access Token 中提取 App ID（如果可能）
                    // 或者使用查詢參數方式
                    createSessionUrl = $"https://graph.facebook.com/{GetMetaApiVersion()}/app/uploads";
                    
                    var sessionFormData2 = new MultipartFormDataContent();
                    sessionFormData2.Add(new StringContent(mediaBytes.Length.ToString()), "file_length");
                    sessionFormData2.Add(new StringContent(mimeType), "file_type");
                    
                    _loggingService.LogInformation($"📤 Step A (方式2): 使用 /app/uploads - URL: {createSessionUrl}, 文件大小: {mediaBytes.Length} bytes, MIME: {mimeType}");
                    
                    sessionResponse = await _httpClient.PostAsync(createSessionUrl, sessionFormData2);
                    sessionContent = await sessionResponse.Content.ReadAsStringAsync();
                    
                    _loggingService.LogInformation($"📨 Session 創建響應 (方式2): {sessionContent}");
                    
                    if (!sessionResponse.IsSuccessStatusCode)
                    {
                        throw new Exception($"創建上傳 Session 失敗（兩種方式都失敗）: {sessionResponse.StatusCode} - {sessionContent}");
                    }
                    
                    _loggingService.LogInformation($"✅ 使用 /app/uploads 創建 Session 成功");
                }

                var sessionResult = JsonSerializer.Deserialize<JsonElement>(sessionContent);
                if (!sessionResult.TryGetProperty("id", out var sessionIdElement))
                {
                    throw new Exception($"Session 響應中未找到 'id' 字段: {sessionContent}");
                }

                var uploadSessionId = sessionIdElement.GetString();
                _loggingService.LogInformation($"✅ 上傳 Session 創建成功，Session ID: {uploadSessionId}");

                // 步驟3: 上傳檔案內容（Resumable Upload - Step B）
                // POST /{UPLOAD_SESSION_ID}
                var uploadFileUrl = $"https://graph.facebook.com/{GetMetaApiVersion()}/{uploadSessionId}";
                
                var fileContent = new ByteArrayContent(mediaBytes);
                fileContent.Headers.ContentType = new MediaTypeHeaderValue(mimeType);
                
                _loggingService.LogInformation($"📤 Step B: 上傳檔案內容 - URL: {uploadFileUrl}");
                
                var uploadResponse = await _httpClient.PostAsync(uploadFileUrl, fileContent);
                var uploadContent = await uploadResponse.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 檔案上傳響應: {uploadContent}");

                if (!uploadResponse.IsSuccessStatusCode)
                {
                    throw new Exception($"檔案上傳失敗: {uploadResponse.StatusCode} - {uploadContent}");
                }

                // 解析上傳響應獲取 header_handle（欄位名為 'h'）
                var uploadResult = JsonSerializer.Deserialize<JsonElement>(uploadContent);
                
                if (uploadResult.TryGetProperty("h", out var handleElement))
                {
                    var headerHandle = handleElement.GetString();
                    _loggingService.LogInformation($"✅ Resumable Upload 成功，Header Handle: {headerHandle}");
                    _loggingService.LogInformation($"📋 Header Handle 將用於模板 header_handle，格式: [\"{headerHandle}\"]");
                    return headerHandle;
                }
                else
                {
                    throw new Exception($"上傳響應中未找到 'h' 字段（header_handle）: {uploadContent}");
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ Resumable Upload 上傳媒體到 Meta 失敗: {ex.Message}", ex);
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
        
        [System.Text.Json.Serialization.JsonPropertyName("header_handle")]
        public List<string>? HeaderHandle { get; set; }  // 用於 IMAGE, VIDEO, DOCUMENT (字符串數組格式)
        
        [System.Text.Json.Serialization.JsonPropertyName("header_url")]
        public string? HeaderUrl { get; set; }  // 用於 IMAGE, VIDEO, DOCUMENT (URL 方式，字符串格式，不是數組)
        
        [System.Text.Json.Serialization.JsonPropertyName("header_filename")]
        public string? HeaderFilename { get; set; }  // 用於 DOCUMENT 類型，文件名
    }

    public class MetaTemplateCreateResponse
    {
        public string Id { get; set; }
        public string Status { get; set; }
        public string Category { get; set; }
        
        // 新增：返回保存的 header 信息（用於前端顯示）
        public string? HeaderUrl { get; set; }
        public string? HeaderType { get; set; }
        public string? HeaderFilename { get; set; }
    }

    #endregion
}

