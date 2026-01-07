using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;

namespace PurpleRice.Services
{
    public interface IWhatsAppMetaFlowsService
    {
        Task<MetaFlowResponse> CreateFlowAsync(Guid companyId, string flowJsonString);
        Task<MetaFlowResponse> UpdateFlowAsync(Guid companyId, string flowId, string flowJsonString);
        Task<MetaFlowResponse> GetFlowAsync(Guid companyId, string flowId);
        Task<bool> DeleteFlowAsync(Guid companyId, string flowId);
        Task<MetaFlowResponse> PublishFlowAsync(Guid companyId, string flowId);
        Task<FlowTemplateCreateResponse> CreateFlowTemplateAsync(Guid companyId, string flowId, string templateName, string category = "LEAD_GENERATION", string language = "zh_TW", string? firstScreenId = null);
        Task<bool> DeleteFlowTemplateAsync(Guid companyId, string templateId);
    }

    public class WhatsAppMetaFlowsService : IWhatsAppMetaFlowsService
    {
        private readonly HttpClient _httpClient;
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        private static string GetMetaApiVersion() => WhatsAppApiConfig.GetApiVersion();

        public WhatsAppMetaFlowsService(
            IHttpClientFactory httpClientFactory,
            PurpleRiceDbContext context,
            Func<string, LoggingService> loggingServiceFactory)
        {
            _httpClient = httpClientFactory.CreateClient();
            _context = context;
            _loggingService = loggingServiceFactory("WhatsAppMetaFlowsService");
        }

        /// <summary>
        /// 創建 Flow 並提交到 Meta API
        /// 正確流程：
        /// 1. POST /{WABA-ID}/flows (只傳 name, categories) - 創建 Flow 殼
        /// 2. POST /{FLOW-ID}/assets (multipart/form-data 上傳 flow.json)
        /// 3. POST /{FLOW-ID}/publish
        /// 4. GET /{FLOW-ID}/assets 驗證上傳是否成功
        /// </summary>
        public async Task<MetaFlowResponse> CreateFlowAsync(Guid companyId, string flowJsonString)
        {
            try
            {
                _loggingService.LogInformation($"📝 開始創建 Meta Flow");
                _loggingService.LogInformation($"📥 [CREATE] 接收到的原始 JSON 長度: {flowJsonString?.Length ?? 0} 字符");
                
                var company = await _context.Companies.FindAsync(companyId);
                if (company == null || string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    throw new Exception("未找到公司配置或 WhatsApp Business Account ID");
                }

                var url = $"https://graph.facebook.com/{GetMetaApiVersion()}/{company.WA_Business_Account_ID}/flows";
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                _loggingService.LogInformation($"📡 請求 URL: {url}");
                
                // 直接使用前端生成的 JSON，只做必要清理
                var cleanedJson = flowJsonString;
                
                // 清理 success: null 字段（使用正則表達式確保完整移除）
                if (cleanedJson.Contains("\"success\":null"))
                {
                    _loggingService.LogInformation($"🧹 [CREATE] 清理 'success':null 字段");
                    // 使用正則表達式移除 success: null（包括前後的逗號）
                    cleanedJson = System.Text.RegularExpressions.Regex.Replace(
                        cleanedJson, 
                        @",?\s*""success""\s*:\s*null\s*,?", 
                        "", 
                        System.Text.RegularExpressions.RegexOptions.IgnoreCase
                    );
                }
                
                // 解析 JSON 以獲取 name 和 categories（用於 Step 1 創建 Flow 殼）
                string flowName = "New Flow";
                List<string> categories = new List<string> { "LEAD_GENERATION" };
                
                try
                {
                    var jsonDocForParsing = JsonDocument.Parse(cleanedJson);
                    var rootForParsing = jsonDocForParsing.RootElement;
                    
                    // 獲取 name
                    if (rootForParsing.TryGetProperty("name", out var nameElementForParsing))
                    {
                        flowName = nameElementForParsing.GetString() ?? "New Flow";
                    }
                    
                    // 獲取 categories
                    if (rootForParsing.TryGetProperty("categories", out var categoriesElementForParsing))
                    {
                        categories = categoriesElementForParsing.EnumerateArray()
                            .Select(e => e.GetString())
                            .Where(s => !string.IsNullOrEmpty(s))
                            .ToList();
                        if (categories.Count == 0)
                        {
                            categories = new List<string> { "LEAD_GENERATION" };
                        }
                    }
                    
                    _loggingService.LogInformation($"📋 [CREATE] 解析 JSON - Flow 名稱: {flowName}");
                    _loggingService.LogInformation($"📋 [CREATE] 解析 JSON - Categories: {string.Join(", ", categories)}");
                }
                catch (Exception ex)
                {
                    _loggingService.LogWarning($"⚠️ [CREATE] 無法解析 JSON 以獲取 name/categories: {ex.Message}，使用默認值");
                }
                
                // 驗證 JSON 格式
                try
                {
                    var jsonDocForValidation = JsonDocument.Parse(cleanedJson);
                    _loggingService.LogInformation($"✅ [CREATE] JSON 格式驗證通過");
                    
                    // 檢查必要字段
                    var rootForValidation = jsonDocForValidation.RootElement;
                    bool hasVersion = rootForValidation.TryGetProperty("version", out var version);
                    bool hasScreens = rootForValidation.TryGetProperty("screens", out var screens);
                    bool hasName = rootForValidation.TryGetProperty("name", out var name);
                    bool hasCategories = rootForValidation.TryGetProperty("categories", out var categoriesElementForValidation);
                    
                    if (hasVersion)
                        _loggingService.LogInformation($"✅ [CREATE] 包含 'version' 字段: {version.GetString()}");
                    else
                        _loggingService.LogError($"❌ [CREATE] 缺少 'version' 字段！");
                    
                    if (hasScreens)
                    {
                        _loggingService.LogInformation($"✅ [CREATE] 包含 'screens' 字段");
                        if (screens.ValueKind == JsonValueKind.Array)
                        {
                            var screensCount = screens.GetArrayLength();
                            _loggingService.LogInformation($"✅ [CREATE] screens 數組包含 {screensCount} 個 screen");
                            
                            // 檢查第一個 screen 的詳細信息
                            if (screensCount > 0)
                            {
                                var firstScreen = screens[0];
                                if (firstScreen.TryGetProperty("id", out var screenId))
                                    _loggingService.LogInformation($"   - Screen[0].id: {screenId.GetString()}");
                                if (firstScreen.TryGetProperty("title", out var screenTitle))
                                    _loggingService.LogInformation($"   - Screen[0].title: {screenTitle.GetString()}");
                                if (firstScreen.TryGetProperty("data", out var screenData))
                                {
                                    _loggingService.LogInformation($"   - Screen[0].data: {screenData.GetRawText().Length} 字符");
                                    // 檢查 data 中是否包含數據模型
                                    if (screenData.GetRawText().Contains("__example__") || screenData.GetRawText().Contains("checkbox_") || screenData.GetRawText().Contains("dropdown_"))
                                    {
                                        _loggingService.LogInformation($"   - Screen[0].data 包含數據模型定義");
                                    }
                                }
                                if (firstScreen.TryGetProperty("layout", out var screenLayout))
                                {
                                    _loggingService.LogInformation($"   - Screen[0].layout: {screenLayout.GetRawText().Length} 字符");
                                    if (screenLayout.TryGetProperty("children", out var children))
                                    {
                                        _loggingService.LogInformation($"   - Screen[0].layout.children: {children.GetArrayLength()} 個組件");
                                    }
                                }
                            }
                        }
                    }
                    else
                    {
                        _loggingService.LogError($"❌ [CREATE] 缺少 'screens' 字段！");
                    }
                    
                    if (hasName)
                        _loggingService.LogInformation($"✅ [CREATE] 包含 'name' 字段: {name.GetString()}");
                    else
                        _loggingService.LogWarning($"⚠️ [CREATE] 缺少 'name' 字段！Meta API 可能需要此字段");
                    
                    if (hasCategories)
                    {
                        _loggingService.LogInformation($"✅ [CREATE] 包含 'categories' 字段");
                        if (categoriesElementForValidation.ValueKind == JsonValueKind.Array)
                        {
                            var categoriesList = categoriesElementForValidation.EnumerateArray().Select(e => e.GetString()).ToList();
                            _loggingService.LogInformation($"   - Categories: {string.Join(", ", categoriesList)}");
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning($"⚠️ [CREATE] 缺少 'categories' 字段！Meta API 可能需要此字段");
                    }
                    
                    // 如果缺少 name 或 categories，這可能是問題所在
                    if (!hasName || !hasCategories)
                    {
                        _loggingService.LogWarning($"⚠️ [CREATE] JSON 缺少必要的字段！這可能導致 Meta API 使用默認值");
                    }
                }
                catch (JsonException jsonEx)
                {
                    _loggingService.LogError($"❌ [CREATE] JSON 格式驗證失敗: {jsonEx.Message}");
                    throw new Exception($"無效的 JSON 格式: {jsonEx.Message}");
                }
                
                // ========== Step 1: 創建 Flow 殼（只傳 name, categories）==========
                _loggingService.LogInformation($"🔷 [CREATE] Step 1: 創建 Flow 殼（只傳 name, categories）");
                
                _loggingService.LogInformation($"📋 [CREATE] Step 1 - Flow 名稱: {flowName}");
                _loggingService.LogInformation($"📋 [CREATE] Step 1 - Categories: {string.Join(", ", categories)}");
                
                var createFlowPayload = new
                {
                    name = flowName,
                    categories = categories
                };
                
                var createFlowJson = JsonSerializer.Serialize(createFlowPayload);
                _loggingService.LogInformation($"📤 [CREATE] Step 1 請求: {createFlowJson}");
                
                var createFlowContent = new StringContent(createFlowJson, System.Text.Encoding.UTF8, "application/json");
                var createFlowResponse = await _httpClient.PostAsync(url, createFlowContent);
                var createFlowResponseContent = await createFlowResponse.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"📨 [CREATE] Step 1 響應: {createFlowResponse.StatusCode}");
                _loggingService.LogInformation($"📨 [CREATE] Step 1 響應內容: {createFlowResponseContent}");
                
                if (!createFlowResponse.IsSuccessStatusCode)
                {
                    throw new Exception($"創建 Flow 殼失敗: {createFlowResponse.StatusCode} - {createFlowResponseContent}");
                }
                
                var createFlowResult = JsonSerializer.Deserialize<MetaFlowResponse>(createFlowResponseContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                
                if (createFlowResult == null || string.IsNullOrEmpty(createFlowResult.Id))
                {
                    throw new Exception("Meta API 返回的 Flow ID 為空");
                }
                
                var flowId = createFlowResult.Id;
                _loggingService.LogInformation($"✅ [CREATE] Step 1 成功 - Flow ID: {flowId}");
                
                // ========== Step 2: 上傳 Flow JSON 文件 ==========
                _loggingService.LogInformation($"🔷 [CREATE] Step 2: 上傳 Flow JSON 文件");
                var uploadAssetsUrl = $"https://graph.facebook.com/{GetMetaApiVersion()}/{flowId}/assets";
                
                // 從 JSON 中移除 name 和 categories（這些只在 Step 1 中使用）
                // 上傳的 JSON 應該只包含 version 和 screens
                string jsonForUpload = cleanedJson;
                try
                {
                    var jsonDocForUpload = JsonDocument.Parse(cleanedJson);
                    var rootForUpload = jsonDocForUpload.RootElement;
                    
                    var jsonForUploadBuilder = new System.Text.StringBuilder();
                    jsonForUploadBuilder.Append("{");
                    
                    bool hasComma = false;
                    
                    // 1. version
                    if (rootForUpload.TryGetProperty("version", out var versionForUpload))
                    {
                        jsonForUploadBuilder.Append($"\"version\":{versionForUpload.GetRawText()}");
                        hasComma = true;
                    }
                    
                    // 2. data_api_version (如果存在，必須保留)
                    if (rootForUpload.TryGetProperty("data_api_version", out var dataApiVersionForUpload))
                    {
                        if (hasComma) jsonForUploadBuilder.Append(",");
                        jsonForUploadBuilder.Append($"\"data_api_version\":{dataApiVersionForUpload.GetRawText()}");
                        hasComma = true;
                    }
                    
                    // 3. routing_model (如果存在，必須保留)
                    if (rootForUpload.TryGetProperty("routing_model", out var routingModelForUpload))
                    {
                        if (hasComma) jsonForUploadBuilder.Append(",");
                        jsonForUploadBuilder.Append($"\"routing_model\":{routingModelForUpload.GetRawText()}");
                        hasComma = true;
                    }
                    
                    // 4. screens
                    if (rootForUpload.TryGetProperty("screens", out var screensForUpload))
                    {
                        if (hasComma) jsonForUploadBuilder.Append(",");
                        jsonForUploadBuilder.Append($"\"screens\":{screensForUpload.GetRawText()}");
                        hasComma = true;
                    }
                    
                    jsonForUploadBuilder.Append("}");
                    jsonForUpload = jsonForUploadBuilder.ToString();
                    
                    _loggingService.LogInformation($"📋 [CREATE] Step 2 - 已移除 name 和 categories，保留 data_api_version 和 routing_model（如果存在），準備上傳的 JSON 長度: {jsonForUpload.Length} 字符");
                }
                catch (Exception ex)
                {
                    _loggingService.LogWarning($"⚠️ [CREATE] Step 2 - 無法移除 name/categories: {ex.Message}，使用原始 JSON");
                }
                
                // 將 JSON 轉換為字節數組
                var jsonBytes = System.Text.Encoding.UTF8.GetBytes(jsonForUpload);
                
                // 使用 multipart/form-data 上傳
                var formData = new MultipartFormDataContent();
                
                // 添加文件內容
                var fileContent = new ByteArrayContent(jsonBytes);
                fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/json");
                formData.Add(fileContent, "file", "flow.json");
                
                // 添加其他必需字段
                formData.Add(new StringContent("flow.json"), "name");
                formData.Add(new StringContent("FLOW_JSON"), "asset_type");
                
                _loggingService.LogInformation($"📤 [CREATE] Step 2 上傳 JSON 文件 - URL: {uploadAssetsUrl}");
                _loggingService.LogInformation($"📤 [CREATE] Step 2 JSON 文件大小: {jsonBytes.Length} 字節");
                
                var uploadResponse = await _httpClient.PostAsync(uploadAssetsUrl, formData);
                var uploadResponseContent = await uploadResponse.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"📨 [CREATE] Step 2 響應: {uploadResponse.StatusCode}");
                _loggingService.LogInformation($"📨 [CREATE] Step 2 響應內容: {uploadResponseContent}");
                
                if (!uploadResponse.IsSuccessStatusCode)
                {
                    throw new Exception($"上傳 Flow JSON 文件失敗: {uploadResponse.StatusCode} - {uploadResponseContent}");
                }
                
                _loggingService.LogInformation($"✅ [CREATE] Step 2 成功 - Flow JSON 文件已上傳");
                
                // ========== Step 3: 發布 Flow ==========
                _loggingService.LogInformation($"🔷 [CREATE] Step 3: 發布 Flow");
                
                var publishResult = await PublishFlowAsync(companyId, flowId);
                _loggingService.LogInformation($"✅ [CREATE] Step 3 成功 - Flow 已發布");
                
                // ========== Step 4: 驗證上傳是否成功 ==========
                _loggingService.LogInformation($"🔷 [CREATE] Step 4: 驗證 Flow JSON 上傳是否成功");
                
                try
                {
                    var assetsUrl = $"https://graph.facebook.com/{GetMetaApiVersion()}/{flowId}/assets";
                    var assetsResponse = await _httpClient.GetAsync(assetsUrl);
                    var assetsContent = await assetsResponse.Content.ReadAsStringAsync();
                    
                    _loggingService.LogInformation($"📨 [CREATE] Step 4 響應: {assetsResponse.StatusCode}");
                    _loggingService.LogInformation($"📨 [CREATE] Step 4 響應內容: {assetsContent}");
                    
                    if (assetsResponse.IsSuccessStatusCode)
                    {
                        var assetsJson = JsonSerializer.Deserialize<JsonElement>(assetsContent);
                        if (assetsJson.TryGetProperty("data", out var assetsData))
                        {
                            var hasFlowJson = false;
                            foreach (var asset in assetsData.EnumerateArray())
                            {
                                if (asset.TryGetProperty("asset_type", out var assetType) && 
                                    assetType.GetString() == "FLOW_JSON")
                                {
                                    hasFlowJson = true;
                                    _loggingService.LogInformation($"✅ [CREATE] Step 4 驗證成功 - 找到 FLOW_JSON asset");
                                    if (asset.TryGetProperty("download_url", out var downloadUrl))
                                    {
                                        _loggingService.LogInformation($"   - Download URL: {downloadUrl.GetString()}");
                                    }
                                    break;
                                }
                            }
                            
                            if (!hasFlowJson)
                            {
                                _loggingService.LogWarning($"⚠️ [CREATE] Step 4 警告 - 未找到 FLOW_JSON asset");
                            }
                        }
                    }
                }
                catch (Exception verifyEx)
                {
                    _loggingService.LogWarning($"⚠️ [CREATE] Step 4 驗證失敗: {verifyEx.Message}");
                }
                
                // 獲取最終的 Flow 信息
                var finalResult = await GetFlowAsync(companyId, flowId);
                finalResult.Status = publishResult.Status;
                finalResult.Version = publishResult.Version;
                
                _loggingService.LogInformation($"✅ [CREATE] Meta Flow 創建完成 - ID: {finalResult.Id}, Name: {finalResult.Name}, Status: {finalResult.Status}");
                
                return finalResult;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 創建 Meta Flow 失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 更新 Flow
        /// 正確流程：
        /// 1. POST /{FLOW-ID}/assets (multipart/form-data 上傳 flow.json) - 覆蓋現有的 JSON
        /// 2. POST /{FLOW-ID}/publish
        /// 3. GET /{FLOW-ID}/assets 驗證上傳是否成功
        /// </summary>
        public async Task<MetaFlowResponse> UpdateFlowAsync(Guid companyId, string flowId, string flowJsonString)
        {
            try
            {
                _loggingService.LogInformation($"📝 開始更新 Meta Flow - ID: {flowId}");
                _loggingService.LogInformation($"📥 [UPDATE] 接收到的原始 JSON 長度: {flowJsonString?.Length ?? 0} 字符");

                var company = await _context.Companies.FindAsync(companyId);
                if (company == null || string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    throw new Exception("未找到公司配置或 WhatsApp Business Account ID");
                }

                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                // 清理 JSON（移除 success: null）
                var cleanedJson = flowJsonString;
                if (cleanedJson.Contains("\"success\":null"))
                {
                    _loggingService.LogInformation($"🧹 [UPDATE] 清理 'success':null 字段");
                    cleanedJson = System.Text.RegularExpressions.Regex.Replace(
                        cleanedJson, 
                        @",?\s*""success""\s*:\s*null\s*,?", 
                        "", 
                        System.Text.RegularExpressions.RegexOptions.IgnoreCase
                    );
                }
                
                // 驗證 JSON 格式
                try
                {
                    var jsonDoc = JsonDocument.Parse(cleanedJson);
                    _loggingService.LogInformation($"✅ [UPDATE] JSON 格式驗證通過");
                }
                catch (JsonException jsonEx)
                {
                    _loggingService.LogError($"❌ [UPDATE] JSON 格式驗證失敗: {jsonEx.Message}");
                    throw new Exception($"無效的 JSON 格式: {jsonEx.Message}");
                }
                
                // ========== Step 0: 先刪除現有的 FLOW_JSON asset（如果存在）==========
                _loggingService.LogInformation($"🔷 [UPDATE] Step 0: 檢查並刪除現有的 FLOW_JSON asset（如果存在）");
                try
                {
                    var assetsUrl = $"https://graph.facebook.com/{GetMetaApiVersion()}/{flowId}/assets";
                    var assetsResponse = await _httpClient.GetAsync(assetsUrl);
                    var assetsContent = await assetsResponse.Content.ReadAsStringAsync();
                    
                    if (assetsResponse.IsSuccessStatusCode)
                    {
                        var assetsJson = JsonSerializer.Deserialize<JsonElement>(assetsContent);
                        if (assetsJson.TryGetProperty("data", out var assetsData) && assetsData.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var asset in assetsData.EnumerateArray())
                            {
                                if (asset.TryGetProperty("asset_type", out var assetType) && 
                                    assetType.GetString() == "FLOW_JSON" &&
                                    asset.TryGetProperty("id", out var assetId))
                                {
                                    var deleteAssetUrl = $"https://graph.facebook.com/{GetMetaApiVersion()}/{assetId.GetString()}";
                                    _loggingService.LogInformation($"🗑️ [UPDATE] Step 0 - 刪除現有的 FLOW_JSON asset: {assetId.GetString()}");
                                    
                                    var deleteResponse = await _httpClient.DeleteAsync(deleteAssetUrl);
                                    var deleteContent = await deleteResponse.Content.ReadAsStringAsync();
                                    
                                    if (deleteResponse.IsSuccessStatusCode)
                                    {
                                        _loggingService.LogInformation($"✅ [UPDATE] Step 0 - 成功刪除舊的 FLOW_JSON asset");
                                    }
                                    else
                                    {
                                        _loggingService.LogWarning($"⚠️ [UPDATE] Step 0 - 刪除舊 asset 失敗（繼續上傳新文件）: {deleteResponse.StatusCode} - {deleteContent}");
                                    }
                                    break; // 只刪除第一個找到的 FLOW_JSON asset
                                }
                            }
                        }
                    }
                }
                catch (Exception deleteEx)
                {
                    _loggingService.LogWarning($"⚠️ [UPDATE] Step 0 - 刪除舊 asset 時發生錯誤（繼續上傳新文件）: {deleteEx.Message}");
                }
                
                // ========== Step 1: 上傳 Flow JSON 文件（覆蓋現有的）==========
                _loggingService.LogInformation($"🔷 [UPDATE] Step 1: 上傳 Flow JSON 文件（覆蓋現有的）");
                var uploadAssetsUrl = $"https://graph.facebook.com/{GetMetaApiVersion()}/{flowId}/assets";
                
                // 從 JSON 中移除 name 和 categories（這些不應該在上傳的 JSON 中）
                // 上傳的 JSON 應該只包含 version 和 screens
                string jsonForUpload = cleanedJson;
                try
                {
                    var jsonDocForUpload = JsonDocument.Parse(cleanedJson);
                    var rootForUpload = jsonDocForUpload.RootElement;
                    
                    var jsonForUploadBuilder = new System.Text.StringBuilder();
                    jsonForUploadBuilder.Append("{");
                    
                    bool hasComma = false;
                    
                    // 1. version
                    if (rootForUpload.TryGetProperty("version", out var versionForUpload))
                    {
                        jsonForUploadBuilder.Append($"\"version\":{versionForUpload.GetRawText()}");
                        hasComma = true;
                    }
                    
                    // 2. data_api_version (如果存在，必須保留)
                    if (rootForUpload.TryGetProperty("data_api_version", out var dataApiVersionForUpload))
                    {
                        if (hasComma) jsonForUploadBuilder.Append(",");
                        jsonForUploadBuilder.Append($"\"data_api_version\":{dataApiVersionForUpload.GetRawText()}");
                        hasComma = true;
                    }
                    
                    // 3. routing_model (如果存在，必須保留)
                    if (rootForUpload.TryGetProperty("routing_model", out var routingModelForUpload))
                    {
                        if (hasComma) jsonForUploadBuilder.Append(",");
                        jsonForUploadBuilder.Append($"\"routing_model\":{routingModelForUpload.GetRawText()}");
                        hasComma = true;
                    }
                    
                    // 4. screens
                    if (rootForUpload.TryGetProperty("screens", out var screensForUpload))
                    {
                        if (hasComma) jsonForUploadBuilder.Append(",");
                        jsonForUploadBuilder.Append($"\"screens\":{screensForUpload.GetRawText()}");
                        hasComma = true;
                    }
                    
                    jsonForUploadBuilder.Append("}");
                    jsonForUpload = jsonForUploadBuilder.ToString();
                    
                    _loggingService.LogInformation($"📋 [UPDATE] Step 1 - 已移除 name 和 categories，保留 data_api_version 和 routing_model（如果存在），準備上傳的 JSON 長度: {jsonForUpload.Length} 字符");
                }
                catch (Exception ex)
                {
                    _loggingService.LogWarning($"⚠️ [UPDATE] Step 1 - 無法移除 name/categories: {ex.Message}，使用原始 JSON");
                }
                
                // 將 JSON 轉換為字節數組
                var jsonBytes = System.Text.Encoding.UTF8.GetBytes(jsonForUpload);
                
                // 使用 multipart/form-data 上傳
                var formData = new MultipartFormDataContent();
                
                // 添加文件內容
                var fileContent = new ByteArrayContent(jsonBytes);
                fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/json");
                formData.Add(fileContent, "file", "flow.json");
                
                // 添加其他必需字段
                formData.Add(new StringContent("flow.json"), "name");
                formData.Add(new StringContent("FLOW_JSON"), "asset_type");
                
                _loggingService.LogInformation($"📤 [UPDATE] Step 1 上傳 JSON 文件 - URL: {uploadAssetsUrl}");
                _loggingService.LogInformation($"📤 [UPDATE] Step 1 JSON 文件大小: {jsonBytes.Length} 字節");
                _loggingService.LogInformation($"📤 [UPDATE] Step 1 準備上傳的 JSON 內容（前 500 字符）: {jsonForUpload.Substring(0, Math.Min(500, jsonForUpload.Length))}");
                if (jsonForUpload.Contains("data_api_version"))
                {
                    _loggingService.LogInformation($"✅ [UPDATE] Step 1 JSON 包含 data_api_version");
                }
                if (jsonForUpload.Contains("routing_model"))
                {
                    _loggingService.LogInformation($"✅ [UPDATE] Step 1 JSON 包含 routing_model");
                }
                
                var uploadResponse = await _httpClient.PostAsync(uploadAssetsUrl, formData);
                var uploadResponseContent = await uploadResponse.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"📨 [UPDATE] Step 1 響應狀態碼: {uploadResponse.StatusCode}");
                _loggingService.LogInformation($"📨 [UPDATE] Step 1 響應內容: {uploadResponseContent}");
                
                if (!uploadResponse.IsSuccessStatusCode)
                {
                    _loggingService.LogError($"❌ [UPDATE] Step 1 上傳失敗 - 狀態碼: {uploadResponse.StatusCode}");
                    _loggingService.LogError($"❌ [UPDATE] Step 1 上傳失敗 - 響應內容: {uploadResponseContent}");
                    _loggingService.LogError($"❌ [UPDATE] Step 1 上傳失敗 - Flow ID: {flowId}");
                    _loggingService.LogError($"❌ [UPDATE] Step 1 上傳失敗 - 上傳的 JSON 長度: {jsonForUpload.Length} 字符");
                    throw new Exception($"上傳 Flow JSON 文件失敗: {uploadResponse.StatusCode} - {uploadResponseContent}");
                }
                
                // 解析上傳響應，確認是否成功
                try
                {
                    var uploadResponseJson = JsonSerializer.Deserialize<JsonElement>(uploadResponseContent);
                    if (uploadResponseJson.TryGetProperty("success", out var successElement) && successElement.GetBoolean())
                    {
                        _loggingService.LogInformation($"✅ [UPDATE] Step 1 成功 - Flow JSON 文件已上傳到 Meta 平台");
                        _loggingService.LogInformation($"   - Flow ID: {flowId}");
                        _loggingService.LogInformation($"   - 上傳的 JSON 長度: {jsonForUpload.Length} 字符");
                        _loggingService.LogInformation($"   - Meta API 返回 success: true");
                    }
                    else
                    {
                        _loggingService.LogWarning($"⚠️ [UPDATE] Step 1 - Meta API 響應中 success 不是 true");
                        _loggingService.LogWarning($"   - 響應內容: {uploadResponseContent}");
                    }
                }
                catch (Exception parseEx)
                {
                    _loggingService.LogWarning($"⚠️ [UPDATE] Step 1 - 無法解析上傳響應（但狀態碼是成功的）: {parseEx.Message}");
                    _loggingService.LogInformation($"✅ [UPDATE] Step 1 成功 - Flow JSON 文件已上傳到 Meta 平台（狀態碼: {uploadResponse.StatusCode}）");
                    _loggingService.LogInformation($"   - Flow ID: {flowId}");
                    _loggingService.LogInformation($"   - 上傳的 JSON 長度: {jsonForUpload.Length} 字符");
                }
                
                // ========== Step 2: 發布 Flow ==========
                _loggingService.LogInformation($"🔷 [UPDATE] Step 2: 發布 Flow - Flow ID: {flowId}");
                
                var publishResult = await PublishFlowAsync(companyId, flowId);
                _loggingService.LogInformation($"✅ [UPDATE] Step 2 成功 - Flow 已發布");
                _loggingService.LogInformation($"   - 發布後狀態: {publishResult.Status ?? "未知"}");
                _loggingService.LogInformation($"   - 發布後版本: {publishResult.Version ?? "未知"}");
                
                // ========== Step 3: 驗證上傳是否成功 ==========
                _loggingService.LogInformation($"🔷 [UPDATE] Step 3: 驗證 Flow JSON 上傳是否成功");
                
                try
                {
                    var assetsUrl = $"https://graph.facebook.com/{GetMetaApiVersion()}/{flowId}/assets";
                    var assetsResponse = await _httpClient.GetAsync(assetsUrl);
                    var assetsContent = await assetsResponse.Content.ReadAsStringAsync();
                    
                    _loggingService.LogInformation($"📨 [UPDATE] Step 3 響應: {assetsResponse.StatusCode}");
                    _loggingService.LogInformation($"📨 [UPDATE] Step 3 響應內容: {assetsContent}");
                    
                    if (assetsResponse.IsSuccessStatusCode)
                    {
                        var assetsJson = JsonSerializer.Deserialize<JsonElement>(assetsContent);
                        if (assetsJson.TryGetProperty("data", out var assetsData))
                        {
                            var hasFlowJson = false;
                            foreach (var asset in assetsData.EnumerateArray())
                            {
                                if (asset.TryGetProperty("asset_type", out var assetType) && 
                                    assetType.GetString() == "FLOW_JSON")
                                {
                                    hasFlowJson = true;
                                    _loggingService.LogInformation($"✅ [UPDATE] Step 3 驗證成功 - 找到 FLOW_JSON asset");
                                    if (asset.TryGetProperty("download_url", out var downloadUrl))
                                    {
                                        _loggingService.LogInformation($"   - Download URL: {downloadUrl.GetString()}");
                                    }
                                    break;
                                }
                            }
                            
                            if (!hasFlowJson)
                            {
                                _loggingService.LogWarning($"⚠️ [UPDATE] Step 3 警告 - 未找到 FLOW_JSON asset");
                                _loggingService.LogWarning($"   - 這可能意味著上傳失敗，或者需要等待 Meta API 處理");
                                _loggingService.LogWarning($"   - 請檢查 Meta 後台確認 Flow 內容是否已更新");
                            }
                            else
                            {
                                _loggingService.LogInformation($"✅ [UPDATE] Step 3 驗證成功 - 確認 FLOW_JSON asset 已存在於 Meta 平台");
                            }
                        }
                    }
                }
                catch (Exception verifyEx)
                {
                    _loggingService.LogWarning($"⚠️ [UPDATE] Step 3 驗證失敗: {verifyEx.Message}");
                }
                
                // 獲取最終的 Flow 信息
                var finalResult = await GetFlowAsync(companyId, flowId);
                finalResult.Status = publishResult.Status;
                finalResult.Version = publishResult.Version;
                
                _loggingService.LogInformation($"✅ [UPDATE] Meta Flow 更新完成");
                _loggingService.LogInformation($"   - Flow ID: {finalResult.Id}");
                _loggingService.LogInformation($"   - Flow Name: {finalResult.Name}");
                _loggingService.LogInformation($"   - Flow Status: {finalResult.Status}");
                _loggingService.LogInformation($"   - Flow Version: {finalResult.Version}");
                _loggingService.LogInformation($"   - 所有步驟已完成，Flow 已成功更新到 Meta 平台");
                
                return finalResult;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 更新 Meta Flow 失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 從 Meta API 獲取 Flow
        /// </summary>
        public async Task<MetaFlowResponse> GetFlowAsync(Guid companyId, string flowId)
        {
            try
            {
                _loggingService.LogInformation($"📋 開始獲取 Meta Flow - ID: {flowId}");

                var company = await _context.Companies.FindAsync(companyId);
                if (company == null || string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    throw new Exception("未找到公司配置或 WhatsApp Business Account ID");
                }

                // 注意：Meta API 不支持通過 GET 請求獲取 screens、version、created_time、updated_time 字段
                // 只能獲取基本信息：id, name, status, categories
                var url = $"https://graph.facebook.com/{GetMetaApiVersion()}/{flowId}?fields=id,name,status,categories";
                
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
                    try
                    {
                        var errorResponse = JsonSerializer.Deserialize<MetaFlowErrorResponse>(content, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });

                        if (errorResponse?.Error != null)
                        {
                            var error = errorResponse.Error;
                            _loggingService.LogError($"❌ Meta API 錯誤 - Code: {error.Code}, Type: {error.Type}, Message: {error.Message}");
                            throw new Exception($"獲取 Meta Flow 失敗: {error.Message} (Code: {error.Code})");
                        }
                    }
                    catch (JsonException)
                    {
                        // 如果無法解析為錯誤響應，使用原始內容
                    }

                    throw new Exception($"獲取 Meta Flow 失敗: {response.StatusCode} - {content}");
                }

                var result = JsonSerializer.Deserialize<MetaFlowResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (result == null)
                {
                    throw new Exception("Meta API 返回空響應");
                }

                _loggingService.LogInformation($"✅ 成功獲取 Meta Flow - ID: {result.Id}, Name: {result.Name}");
                return result;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 獲取 Meta Flow 失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 刪除 Flow
        /// </summary>
        public async Task<bool> DeleteFlowAsync(Guid companyId, string flowId)
        {
            try
            {
                _loggingService.LogInformation($"🗑️ 開始刪除 Meta Flow - ID: {flowId}");

                var company = await _context.Companies.FindAsync(companyId);
                if (company == null || string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    throw new Exception("未找到公司配置或 WhatsApp Business Account ID");
                }

                var url = $"https://graph.facebook.com/{GetMetaApiVersion()}/{flowId}";
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                _loggingService.LogInformation($"📡 請求 URL: {url}");

                var response = await _httpClient.DeleteAsync(url);
                var content = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 Response Status: {response.StatusCode}");
                _loggingService.LogDebug($"📨 Response Content: {content}");

                if (!response.IsSuccessStatusCode)
                {
                    try
                    {
                        var errorResponse = JsonSerializer.Deserialize<MetaFlowErrorResponse>(content, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });

                        if (errorResponse?.Error != null)
                        {
                            var error = errorResponse.Error;
                            _loggingService.LogError($"❌ Meta API 錯誤 - Code: {error.Code}, Type: {error.Type}, Message: {error.Message}");
                            throw new Exception($"刪除 Meta Flow 失敗: {error.Message} (Code: {error.Code})");
                        }
                    }
                    catch (JsonException)
                    {
                        // 如果無法解析為錯誤響應，使用原始內容
                    }

                    throw new Exception($"刪除 Meta Flow 失敗: {response.StatusCode} - {content}");
                }

                _loggingService.LogInformation($"✅ Meta Flow 刪除成功 - ID: {flowId}");
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 刪除 Meta Flow 失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 發布 Flow
        /// </summary>
        public async Task<MetaFlowResponse> PublishFlowAsync(Guid companyId, string flowId)
        {
            try
            {
                _loggingService.LogInformation($"📢 開始發布 Meta Flow - ID: {flowId}");

                var company = await _context.Companies.FindAsync(companyId);
                if (company == null || string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    throw new Exception("未找到公司配置或 WhatsApp Business Account ID");
                }

                var url = $"https://graph.facebook.com/{GetMetaApiVersion()}/{flowId}/publish";
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                _loggingService.LogInformation($"📡 請求 URL: {url}");
                _loggingService.LogInformation($"📡 發布方法: POST (無請求體)");
                _loggingService.LogInformation($"📡 注意：Meta API 的發布端點通常不需要請求體，只需要 POST 到 /{flowId}/publish");
                _loggingService.LogInformation($"📡 但根據用戶反饋，發布可能只是改變狀態，不會保存 screens 內容");
                _loggingService.LogInformation($"📡 如果發布後內容未更新，可能需要手動在 Meta 後台執行 → 儲存 → 發布");

                // 注意：Meta API 的發布端點通常不需要請求體，只需要 POST 到 /{flow-id}/publish
                // 但根據用戶反饋，發布可能只是改變狀態，不會保存 screens 內容
                // 這裡先嘗試標準的發布方式
                var response = await _httpClient.PostAsync(url, null);
                var content = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 Response Status: {response.StatusCode}");
                _loggingService.LogDebug($"📨 Response Content: {content}");

                if (!response.IsSuccessStatusCode)
                {
                    try
                    {
                        var errorResponse = JsonSerializer.Deserialize<MetaFlowErrorResponse>(content, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });

                        if (errorResponse?.Error != null)
                        {
                            var error = errorResponse.Error;
                            _loggingService.LogError($"❌ Meta API 錯誤 - Code: {error.Code}, Type: {error.Type}, Message: {error.Message}");
                            throw new Exception($"發布 Meta Flow 失敗: {error.Message} (Code: {error.Code})");
                        }
                    }
                    catch (JsonException)
                    {
                        // 如果無法解析為錯誤響應，使用原始內容
                    }

                    throw new Exception($"發布 Meta Flow 失敗: {response.StatusCode} - {content}");
                }

                // 解析發布響應
                MetaFlowResponse? result = null;
                try
                {
                    result = JsonSerializer.Deserialize<MetaFlowResponse>(content, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                }
                catch (JsonException jsonEx)
                {
                    _loggingService.LogWarning($"⚠️ 無法解析發布響應為 MetaFlowResponse: {jsonEx.Message}");
                    _loggingService.LogInformation($"📨 發布響應內容: {content}");
                    
                    // 如果響應是 {"success":true} 格式，也視為成功
                    if (content.Contains("\"success\":true") || content.Contains("\"success\": true"))
                    {
                        _loggingService.LogInformation($"✅ 發布響應包含 success:true，視為發布成功");
                        // 創建一個基本的響應對象
                        result = new MetaFlowResponse
                        {
                            Id = flowId,
                            Success = true,
                            Status = "PUBLISHED"
                        };
                    }
                    else
                    {
                        throw new Exception($"無法解析發布響應: {jsonEx.Message}");
                    }
                }

                if (result == null)
                {
                    throw new Exception("Meta API 返回空響應");
                }

                _loggingService.LogInformation($"✅ Meta Flow 發布成功 - ID: {result.Id}, Status: {result.Status ?? "PUBLISHED"}");
                if (result.ValidationErrors != null && result.ValidationErrors.Count > 0)
                {
                    _loggingService.LogWarning($"⚠️ 發布後驗證錯誤: {JsonSerializer.Serialize(result.ValidationErrors)}");
                }
                
                return result;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 發布 Meta Flow 失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 創建 Flow Template（用於 24 小時窗口外發送 Flow 消息）
        /// 根據 WhatsApp Business API 文檔，Flow Template 是通過 message_templates API 創建的
        /// </summary>
        public async Task<FlowTemplateCreateResponse> CreateFlowTemplateAsync(
            Guid companyId, 
            string flowId, 
            string templateName, 
            string category = "LEAD_GENERATION", 
            string language = "zh_TW",
            string? firstScreenId = null)
        {
            try
            {
                _loggingService.LogInformation($"📝 開始創建 Flow Template - Flow ID: {flowId}, Template Name: {templateName}");

                var company = await _context.Companies.FindAsync(companyId);
                if (company == null || string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    throw new Exception("未找到公司配置或 WhatsApp Business Account ID");
                }

                // ✅ 轉換模板名稱：Meta API 要求模板名稱只能包含小寫英文字母和底線
                // 將所有非小寫英文字母和底線的字符替換為底線，並轉為小寫
                var sanitizedTemplateName = Regex.Replace(
                    templateName ?? "flow_template",
                    @"[^a-z_]", 
                    "_", 
                    RegexOptions.IgnoreCase
                ).ToLowerInvariant();
                
                // 移除連續的底線
                sanitizedTemplateName = Regex.Replace(sanitizedTemplateName, @"_+", "_");
                
                // 移除開頭和結尾的底線
                sanitizedTemplateName = sanitizedTemplateName.Trim('_');
                
                // 確保名稱不為空
                if (string.IsNullOrEmpty(sanitizedTemplateName))
                {
                    sanitizedTemplateName = $"flow_template_{flowId.Substring(Math.Max(0, flowId.Length - 8))}";
                }
                
                // 確保名稱不超過 512 字符（Meta API 限制）
                if (sanitizedTemplateName.Length > 512)
                {
                    sanitizedTemplateName = sanitizedTemplateName.Substring(0, 512);
                }
                
                _loggingService.LogInformation($"📝 原始模板名稱: {templateName}");
                _loggingService.LogInformation($"📝 轉換後模板名稱: {sanitizedTemplateName}");

                // ✅ 從 MetaFlowJson 中提取 Header、Body、Footer 和 firstScreenId
                string? headerText = null;
                string? bodyText = null;
                string? footerText = null;
                
                var eFormDefinition = await _context.eFormDefinitions
                    .FirstOrDefaultAsync(f => f.MetaFlowId == flowId && f.CompanyId == companyId);
                
                if (eFormDefinition != null && !string.IsNullOrEmpty(eFormDefinition.MetaFlowJson))
                {
                    try
                    {
                        var flowJson = JsonSerializer.Deserialize<JsonElement>(eFormDefinition.MetaFlowJson);
                        if (flowJson.TryGetProperty("screens", out var screens) && screens.GetArrayLength() > 0)
                        {
                            var firstScreen = screens[0];
                            
                            // 獲取 Screen ID
                            if (string.IsNullOrEmpty(firstScreenId) && firstScreen.TryGetProperty("id", out var screenIdProp))
                            {
                                firstScreenId = screenIdProp.GetString();
                                _loggingService.LogInformation($"📝 從 MetaFlowJson 獲取第一個 Screen ID: {firstScreenId}");
                            }
                            
                            // 從 layout.children 中提取 Header、Body、Footer
                            if (firstScreen.TryGetProperty("layout", out var layout) && 
                                layout.TryGetProperty("children", out var children))
                            {
                                foreach (var child in children.EnumerateArray())
                                {
                                    if (child.TryGetProperty("type", out var childType))
                                    {
                                        var type = childType.GetString();
                                        
                                        // 提取 Header (TextHeading)
                                        if (type == "TextHeading" && child.TryGetProperty("text", out var headerTextProp))
                                        {
                                            headerText = headerTextProp.GetString();
                                            _loggingService.LogInformation($"📝 從 MetaFlowJson 獲取 Header: {headerText}");
                                        }
                                        
                                        // 提取 Body (TextBody)
                                        if (type == "TextBody" && child.TryGetProperty("text", out var bodyTextProp))
                                        {
                                            bodyText = bodyTextProp.GetString();
                                            _loggingService.LogInformation($"📝 從 MetaFlowJson 獲取 Body: {bodyText}");
                                        }
                                        
                                        // 提取 Footer (Footer)
                                        if (type == "Footer" && child.TryGetProperty("label", out var footerLabelProp))
                                        {
                                            footerText = footerLabelProp.GetString();
                                            _loggingService.LogInformation($"📝 從 MetaFlowJson 獲取 Footer: {footerText}");
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogWarning($"⚠️ 解析 MetaFlowJson 失敗: {ex.Message}");
                    }
                }
                
                // 如果還是沒有，使用默認值
                if (string.IsNullOrEmpty(firstScreenId))
                {
                    firstScreenId = "screen";
                    _loggingService.LogInformation($"📝 使用默認 Screen ID: {firstScreenId}");
                }
                
                // 設置默認值（如果沒有從 Flow 中提取到）
                if (string.IsNullOrEmpty(bodyText))
                {
                    bodyText = "請按下面按鈕填寫資料";
                    _loggingService.LogInformation($"📝 使用默認 Body 文字: {bodyText}");
                }
                
                if (string.IsNullOrEmpty(footerText))
                {
                    footerText = "開啟表單";
                    _loggingService.LogInformation($"📝 使用默認 Footer 文字: {footerText}");
                }

                // ✅ 在創建 Template 之前，先檢查是否存在相同名稱的 Template
                // 如果存在，嘗試刪除它（避免 category 衝突錯誤）
                try
                {
                    var checkUrl = $"https://graph.facebook.com/{GetMetaApiVersion()}/{company.WA_Business_Account_ID}/message_templates?name={Uri.EscapeDataString(sanitizedTemplateName)}&language={language}";
                    
                    _httpClient.DefaultRequestHeaders.Clear();
                    _httpClient.DefaultRequestHeaders.Authorization = 
                        new AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                    
                    _loggingService.LogInformation($"🔍 檢查已存在的 Template - URL: {checkUrl}");
                    var checkResponse = await _httpClient.GetAsync(checkUrl);
                    var checkContent = await checkResponse.Content.ReadAsStringAsync();
                    
                    _loggingService.LogInformation($"🔍 檢查響應狀態: {checkResponse.StatusCode}");
                    _loggingService.LogDebug($"🔍 檢查響應內容: {checkContent}");
                    
                    if (checkResponse.IsSuccessStatusCode)
                    {
                        var checkResult = JsonSerializer.Deserialize<JsonElement>(checkContent);
                        if (checkResult.TryGetProperty("data", out var data))
                        {
                            var dataCount = data.GetArrayLength();
                            _loggingService.LogInformation($"🔍 找到 {dataCount} 個匹配的 Template");
                            
                            if (dataCount > 0)
                            {
                                // 找到相同名稱的 Template，嘗試刪除
                                var existingTemplate = data[0];
                                if (existingTemplate.TryGetProperty("id", out var existingId))
                                {
                                    var existingTemplateId = existingId.GetString();
                                    var existingCategory = existingTemplate.TryGetProperty("category", out var catProp) ? catProp.GetString() : "未知";
                                    _loggingService.LogInformation($"📝 發現已存在的 Template: {existingTemplateId}，Category: {existingCategory}，嘗試刪除");
                                    
                                    var deleteResult = await DeleteFlowTemplateAsync(companyId, existingTemplateId);
                                    if (deleteResult)
                                    {
                                        _loggingService.LogInformation($"✅ 成功刪除已存在的 Template: {existingTemplateId}");
                                    }
                                    else
                                    {
                                        _loggingService.LogWarning($"⚠️ 無法刪除已存在的 Template: {existingTemplateId}（可能已審核通過），將使用新名稱創建");
                                        // 如果無法刪除，添加時間戳確保名稱唯一
                                        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
                                        sanitizedTemplateName = $"{sanitizedTemplateName}_{timestamp}";
                                        _loggingService.LogInformation($"📝 使用新模板名稱: {sanitizedTemplateName}");
                                    }
                                }
                            }
                            else
                            {
                                _loggingService.LogInformation($"🔍 沒有找到已存在的 Template，將創建新的");
                            }
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning($"⚠️ 檢查已存在的 Template 失敗: {checkResponse.StatusCode} - {checkContent}");
                    }
                }
                catch (Exception ex)
                {
                    _loggingService.LogWarning($"⚠️ 檢查已存在的 Template 時發生錯誤: {ex.Message}，繼續創建新 Template");
                }

                var url = $"https://graph.facebook.com/{GetMetaApiVersion()}/{company.WA_Business_Account_ID}/message_templates";
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                // ✅ 映射 category：Flow Template 的 category 必須是 UTILITY, MARKETING, 或 AUTHENTICATION
                // Flow 的 category 可以是 LEAD_GENERATION，但 Template 需要映射
                string templateCategory = category?.ToUpper() switch
                {
                    "LEAD_GENERATION" => "UTILITY", // LEAD_GENERATION 映射到 UTILITY
                    "UTILITY" => "UTILITY",
                    "MARKETING" => "MARKETING",
                    "AUTHENTICATION" => "AUTHENTICATION",
                    _ => "UTILITY" // 默認使用 UTILITY
                };
                
                _loggingService.LogInformation($"📝 Flow Category: {category} -> Template Category: {templateCategory}");

                // ✅ 構建 Flow Template 請求（正確格式）
                // 根據 Meta API 文檔，Flow Template 需要使用 BUTTONS component，並在 buttons 中使用 type: "FLOW"
                var components = new List<object>();
                
                // 添加 HEADER（如果有的話）
                if (!string.IsNullOrEmpty(headerText))
                {
                    components.Add(new
                    {
                        type = "HEADER",
                        format = "TEXT",
                        text = headerText
                    });
                }
                
                // 添加 BODY（必填）
                components.Add(new
                {
                    type = "BODY",
                    text = bodyText
                });
                
                // 添加 FOOTER（如果有的話）
                if (!string.IsNullOrEmpty(footerText))
                {
                    components.Add(new
                    {
                        type = "FOOTER",
                        text = footerText
                    });
                }
                
                // 添加 BUTTONS（必填，包含 FLOW button）
                components.Add(new
                {
                    type = "BUTTONS",
                    buttons = new object[]
                    {
                        new
                        {
                            type = "FLOW",
                            text = footerText ?? "開啟表單", // 使用 Footer 文字作為按鈕文字
                            flow_id = flowId,
                            flow_action = "navigate",
                            navigate_screen = firstScreenId
                        }
                    }
                });
                
                var payload = new
                {
                    name = sanitizedTemplateName,
                    category = templateCategory,
                    language = language,
                    components = components
                };

                var jsonPayload = JsonSerializer.Serialize(payload, new JsonSerializerOptions
                {
                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
                });

                _loggingService.LogInformation($"📤 Flow Template 請求 URL: {url}");
                _loggingService.LogInformation($"📤 Flow Template 請求 Payload: {jsonPayload}");

                var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 Flow Template 響應狀態碼: {response.StatusCode}");
                _loggingService.LogInformation($"📨 Flow Template 響應內容: {responseContent}");

                if (!response.IsSuccessStatusCode)
                {
                    try
                    {
                        var errorResponse = JsonSerializer.Deserialize<MetaFlowErrorResponse>(responseContent, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });

                        if (errorResponse?.Error != null)
                        {
                            var error = errorResponse.Error;
                            _loggingService.LogError($"❌ Meta API 錯誤 - Code: {error.Code}, Type: {error.Type}, Message: {error.Message}");
                            
                            // ✅ 處理 category 衝突錯誤：如果錯誤信息建議使用 MARKETING，自動重試
                            // 檢查 error.Message 或 error_user_msg（如果有的話）
                            var errorMessage = error.Message ?? "";
                            var errorUserMsg = error.ErrorUserMsg ?? "";
                            var fullErrorText = $"{errorMessage} {errorUserMsg}";
                            
                            _loggingService.LogInformation($"🔍 錯誤詳情 - Message: {errorMessage}, ErrorUserMsg: {errorUserMsg}");
                            
                            if (error.Code == 100 && 
                                (fullErrorText.Contains("category") || fullErrorText.Contains("類別")) &&
                                (fullErrorText.Contains("MARKETING") || fullErrorText.Contains("無法變更此訊息範本的類別")))
                            {
                                _loggingService.LogWarning($"⚠️ 檢測到 category 衝突錯誤，嘗試使用 MARKETING category 重新創建");
                                
                                // 使用 MARKETING category 重新創建
                                templateCategory = "MARKETING";
                                payload = new
                                {
                                    name = sanitizedTemplateName,
                                    category = templateCategory,
                                    language = language,
                                    components = components
                                };
                                
                                jsonPayload = JsonSerializer.Serialize(payload, new JsonSerializerOptions
                                {
                                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
                                });
                                
                                _loggingService.LogInformation($"📤 使用 MARKETING category 重新創建 Flow Template");
                                _loggingService.LogInformation($"📤 Flow Template 請求 Payload: {jsonPayload}");
                                
                                content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                                response = await _httpClient.PostAsync(url, content);
                                responseContent = await response.Content.ReadAsStringAsync();
                                
                                _loggingService.LogInformation($"📨 Flow Template 響應狀態碼: {response.StatusCode}");
                                _loggingService.LogInformation($"📨 Flow Template 響應內容: {responseContent}");
                                
                                // 如果重試仍然失敗，檢查是否是語言版本被刪除的錯誤
                                if (!response.IsSuccessStatusCode)
                                {
                                    try
                                    {
                                        var retryErrorResponse = JsonSerializer.Deserialize<MetaFlowErrorResponse>(responseContent, new JsonSerializerOptions
                                        {
                                            PropertyNameCaseInsensitive = true
                                        });
                                        
                                        if (retryErrorResponse?.Error != null)
                                        {
                                            var retryError = retryErrorResponse.Error;
                                            var retryErrorUserMsg = retryError.ErrorUserMsg ?? "";
                                            
                                            // 檢查是否是「語言已被刪除，無法新增」的錯誤
                                            if (retryErrorUserMsg.Contains("無法新增") || retryErrorUserMsg.Contains("語言已被刪除"))
                                            {
                                                _loggingService.LogWarning($"⚠️ 檢測到語言版本被刪除的錯誤，生成新的唯一模板名稱");
                                                
                                                // 生成新的唯一模板名稱（添加時間戳）
                                                var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
                                                sanitizedTemplateName = $"{sanitizedTemplateName}_{timestamp}";
                                                
                                                _loggingService.LogInformation($"📝 使用新模板名稱: {sanitizedTemplateName}");
                                                
                                                // 使用新名稱重新創建
                                                payload = new
                                                {
                                                    name = sanitizedTemplateName,
                                                    category = templateCategory,
                                                    language = language,
                                                    components = components
                                                };
                                                
                                                jsonPayload = JsonSerializer.Serialize(payload, new JsonSerializerOptions
                                                {
                                                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
                                                });
                                                
                                                _loggingService.LogInformation($"📤 使用新模板名稱重新創建 Flow Template");
                                                _loggingService.LogInformation($"📤 Flow Template 請求 Payload: {jsonPayload}");
                                                
                                                content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                                                response = await _httpClient.PostAsync(url, content);
                                                responseContent = await response.Content.ReadAsStringAsync();
                                                
                                                _loggingService.LogInformation($"📨 Flow Template 響應狀態碼: {response.StatusCode}");
                                                _loggingService.LogInformation($"📨 Flow Template 響應內容: {responseContent}");
                                                
                                                // 如果仍然失敗，拋出異常
                                                if (!response.IsSuccessStatusCode)
                                                {
                                                    throw new Exception($"創建 Flow Template 失敗（即使使用新名稱和 MARKETING category）: {retryError.Message} (Code: {retryError.Code})");
                                                }
                                            }
                                            else
                                            {
                                                throw new Exception($"創建 Flow Template 失敗（即使使用 MARKETING category）: {retryError.Message} (Code: {retryError.Code})");
                                            }
                                        }
                                        else
                                        {
                                            throw new Exception($"創建 Flow Template 失敗（即使使用 MARKETING category）: {response.StatusCode} - {responseContent}");
                                        }
                                    }
                                    catch (JsonException)
                                    {
                                        throw new Exception($"創建 Flow Template 失敗（即使使用 MARKETING category）: {response.StatusCode} - {responseContent}");
                                    }
                                }
                            }
                            else
                            {
                                // 其他錯誤，直接拋出異常
                                throw new Exception($"創建 Flow Template 失敗: {error.Message} (Code: {error.Code})");
                            }
                        }
                    }
                    catch (JsonException)
                    {
                        // 如果無法解析為錯誤響應，使用原始內容
                    }
                    
                    // 如果上面的重試邏輯沒有處理，檢查是否仍然失敗
                    if (!response.IsSuccessStatusCode)
                    {
                        throw new Exception($"創建 Flow Template 失敗: {response.StatusCode} - {responseContent}");
                    }
                }

                // 解析響應
                var result = JsonSerializer.Deserialize<JsonElement>(responseContent);
                
                var templateId = result.TryGetProperty("id", out var idProp) 
                    ? idProp.GetString() 
                    : null;
                var status = result.TryGetProperty("status", out var statusProp) 
                    ? statusProp.GetString() 
                    : "PENDING";
                var responseCategory = result.TryGetProperty("category", out var categoryProp) 
                    ? categoryProp.GetString() 
                    : category;

                if (string.IsNullOrEmpty(templateId))
                {
                    throw new Exception("Meta API 返回的 Flow Template ID 為空");
                }

                _loggingService.LogInformation($"✅ Flow Template 創建成功 - Template ID: {templateId}, Template Name: {sanitizedTemplateName}, Status: {status}");

                return new FlowTemplateCreateResponse
                {
                    TemplateId = templateId,
                    TemplateName = sanitizedTemplateName, // ✅ 返回實際使用的 sanitized 名稱，而不是原始名稱
                    Status = status,
                    Category = responseCategory
                };
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 創建 Flow Template 失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 刪除 Flow Template
        /// </summary>
        public async Task<bool> DeleteFlowTemplateAsync(Guid companyId, string templateId)
        {
            try
            {
                _loggingService.LogInformation($"🗑️ 開始刪除 Flow Template - Template ID: {templateId}");

                var company = await _context.Companies.FindAsync(companyId);
                if (company == null || string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    throw new Exception("未找到公司配置或 WhatsApp Business Account ID");
                }

                // Meta API 刪除 Template 的端點：DELETE /{WABA-ID}/message_templates/{template-id}
                var url = $"https://graph.facebook.com/{GetMetaApiVersion()}/{company.WA_Business_Account_ID}/message_templates/{templateId}";
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                _loggingService.LogInformation($"📡 請求 URL: {url}");

                var response = await _httpClient.DeleteAsync(url);
                var content = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 Response Status: {response.StatusCode}");
                _loggingService.LogDebug($"📨 Response Content: {content}");

                if (!response.IsSuccessStatusCode)
                {
                    try
                    {
                        var errorResponse = JsonSerializer.Deserialize<MetaFlowErrorResponse>(content, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });

                        if (errorResponse?.Error != null)
                        {
                            var error = errorResponse.Error;
                            _loggingService.LogError($"❌ Meta API 錯誤 - Code: {error.Code}, Type: {error.Type}, Message: {error.Message}");
                            
                            // 如果 Template 已審核通過，可能無法刪除（這是正常的）
                            if (error.Code == 100 || error.Message.Contains("cannot be deleted") || error.Message.Contains("approved"))
                            {
                                _loggingService.LogWarning($"⚠️ Flow Template 可能已審核通過，無法刪除: {error.Message}");
                                return false; // 返回 false 表示無法刪除，但不拋出異常
                            }
                            
                            throw new Exception($"刪除 Flow Template 失敗: {error.Message} (Code: {error.Code})");
                        }
                    }
                    catch (JsonException)
                    {
                        // 如果無法解析為錯誤響應，使用原始內容
                    }

                    throw new Exception($"刪除 Flow Template 失敗: {response.StatusCode} - {content}");
                }

                _loggingService.LogInformation($"✅ Flow Template 刪除成功 - Template ID: {templateId}");
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 刪除 Flow Template 失敗: {ex.Message}", ex);
                // 如果刪除失敗（例如已審核通過），返回 false 而不是拋出異常
                // 這樣調用方可以繼續創建新的 Template
                return false;
            }
        }
    }

    #region Response Classes

    public class MetaFlowResponse
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Status { get; set; }
        public string Version { get; set; }
        public bool? Success { get; set; }
        public List<string> Categories { get; set; }
        public List<object> ValidationErrors { get; set; }
        public DateTime? CreatedTime { get; set; }
        public DateTime? UpdatedTime { get; set; }
    }

    public class MetaFlowErrorResponse
    {
        public MetaFlowError Error { get; set; }
    }

    public class MetaFlowError
    {
        public string Message { get; set; }
        public string Type { get; set; }
        public int Code { get; set; }
        public int ErrorSubcode { get; set; }
        public string FbtraceId { get; set; }
        [JsonPropertyName("error_user_msg")]
        public string ErrorUserMsg { get; set; }
        [JsonPropertyName("error_user_title")]
        public string ErrorUserTitle { get; set; }
    }

    public class FlowTemplateCreateResponse
    {
        public string TemplateId { get; set; }
        public string TemplateName { get; set; }
        public string Status { get; set; }
        public string Category { get; set; }
    }

    #endregion
}

