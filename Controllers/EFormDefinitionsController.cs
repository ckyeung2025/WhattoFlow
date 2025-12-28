using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text.Json;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/eforms")]
    public class EFormDefinitionsController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        private readonly IWhatsAppMetaFlowsService _metaFlowsService;
        
        public EFormDefinitionsController(
            PurpleRiceDbContext context, 
            Func<string, LoggingService> loggingServiceFactory,
            IWhatsAppMetaFlowsService metaFlowsService) 
        { 
            _context = context; 
            _loggingService = loggingServiceFactory("EFormDefinitionsController");
            _metaFlowsService = metaFlowsService;
        }

        // 獲取當前用戶的 CompanyId
        private Guid? GetCurrentUserCompanyId()
        {
            // 首先嘗試從 JWT claims 中獲取 company_id
            var companyIdClaim = User.FindFirst("company_id");
            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out Guid companyId))
            {
                return companyId;
            }

            // 如果 JWT 中沒有，嘗試從 user_id 查詢用戶的 company_id
            var userIdClaim = User.FindFirst("user_id");
            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out Guid userId))
            {
                var user = _context.Users.FirstOrDefault(u => u.Id == userId);
                if (user != null)
                {
                    return user.CompanyId;
                }
            }

            return null;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string sortField = "created_at",
            [FromQuery] string sortOrder = "desc")
        {
            try
            {
                _loggingService.LogInformation($"獲取表單定義列表 - 頁面: {page}, 每頁: {pageSize}, 排序: {sortField} {sortOrder}");

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var query = _context.eFormDefinitions
                    .Where(x => x.CompanyId == companyId.Value)
                    .AsQueryable();

                // 排序
                switch (sortField.ToLower())
                {
                    case "name":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(x => x.Name) : query.OrderByDescending(x => x.Name);
                        break;
                    case "status":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(x => x.Status) : query.OrderByDescending(x => x.Status);
                        break;
                    case "created_at":
                    default:
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(x => x.CreatedAt) : query.OrderByDescending(x => x.CreatedAt);
                        break;
                }

                var total = await query.CountAsync();
                var forms = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                _loggingService.LogInformation($"成功獲取 {forms.Count} 個表單定義，總計 {total} 個");

                return Ok(new
                {
                    data = forms,
                    total = total,
                    page = page,
                    pageSize = pageSize,
                    totalPages = (int)Math.Ceiling((double)total / pageSize)
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取表單定義列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取表單定義列表失敗" });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id, [FromQuery] bool fromApi = false)
        {
            try
            {
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var form = await _context.eFormDefinitions
                    .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == companyId.Value);

                if (form == null)
                {
                    _loggingService.LogWarning($"找不到表單定義，ID: {id}");
                    return NotFound();
                }

                // 如果是 MetaFlows 類型且請求從 API 獲取最新版本
                if (form.FormType == "MetaFlows" && fromApi && !string.IsNullOrEmpty(form.MetaFlowId))
                {
                    try
                    {
                        _loggingService.LogInformation($"從 Meta API 獲取最新 Flow 版本: {form.MetaFlowId}");
                        var metaFlow = await _metaFlowsService.GetFlowAsync(companyId.Value, form.MetaFlowId);
                        
                        // 注意：GetFlowAsync 只返回基本信息（id, name, status, categories），不包含 screens
                        // 因此不應該覆蓋 MetaFlowJson，只更新版本和狀態信息
                        // 保留數據庫中已有的完整 JSON（包含 screens 和 data 模型）
                        if (!string.IsNullOrEmpty(form.MetaFlowJson))
                        {
                            _loggingService.LogInformation($"保留數據庫中的完整 MetaFlowJson（包含 screens），只更新版本和狀態");
                        }
                        else
                        {
                            _loggingService.LogWarning($"數據庫中沒有 MetaFlowJson，但 GetFlowAsync 不返回 screens，無法完整恢復");
                        }
                        
                        // 只更新版本和狀態，不覆蓋 MetaFlowJson
                        form.MetaFlowVersion = metaFlow.Version;
                        form.MetaFlowStatus = metaFlow.Status;
                        form.MetaFlowMetadata = JsonSerializer.Serialize(metaFlow);
                        
                        await _context.SaveChangesAsync();
                        _loggingService.LogInformation($"已更新 Meta Flow 版本和狀態: {form.Name}, Version: {metaFlow.Version}, Status: {metaFlow.Status}");
                    }
                    catch (Exception apiEx)
                    {
                        _loggingService.LogWarning($"從 Meta API 獲取 Flow 失敗，使用本地數據: {apiEx.Message}");
                        // 繼續使用本地數據
                    }
                }

                // 記錄返回給前端的 MetaFlowJson 內容
                if (!string.IsNullOrEmpty(form.MetaFlowJson))
                {
                    _loggingService.LogInformation($"📤 [GET] 返回給前端的 MetaFlowJson 長度: {form.MetaFlowJson.Length} 字符");
                    if (form.MetaFlowJson.Contains("screens"))
                    {
                        _loggingService.LogInformation($"✅ [GET] 返回的 JSON 包含 'screens' 字段");
                        // 檢查是否包含數據模型
                        if (form.MetaFlowJson.Contains("dropdown_select") || form.MetaFlowJson.Contains("__example__"))
                        {
                            _loggingService.LogInformation($"✅ [GET] 返回的 JSON 包含數據模型定義");
                        }
                        else
                        {
                            _loggingService.LogWarning($"⚠️ [GET] 返回的 JSON 不包含數據模型定義！");
                        }
                        // 檢查是否包含默認的 WELCOME_SCREEN
                        if (form.MetaFlowJson.Contains("WELCOME_SCREEN") || form.MetaFlowJson.Contains("Hello World"))
                        {
                            _loggingService.LogWarning($"⚠️ [GET] 返回的 JSON 包含默認的 WELCOME_SCREEN 或 'Hello World'！");
                        }
                    }
                    else
                    {
                        _loggingService.LogError($"❌ [GET] 返回的 JSON 不包含 'screens' 字段！");
                    }
                }
                else
                {
                    _loggingService.LogWarning($"⚠️ [GET] 表單定義中沒有 MetaFlowJson");
                }

                _loggingService.LogInformation($"成功獲取表單定義: {form.Name}");
                return Ok(form);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取表單定義詳情失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取表單定義詳情失敗" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] eFormDefinition form)
        {
            try
            {
                _loggingService.LogInformation($"開始創建表單定義，名稱: {form?.Name}, 描述: {form?.Description}");
                
                // 驗證輸入
                if (form == null)
                {
                    _loggingService.LogWarning("表單定義對象為空");
                    return BadRequest(new { error = "表單定義對象不能為空" });
                }
                
                if (string.IsNullOrWhiteSpace(form.Name))
                {
                    _loggingService.LogWarning("表單名稱為空");
                    return BadRequest(new { error = "表單名稱不能為空" });
                }
                
                // 根據表單類型驗證
                if (string.IsNullOrWhiteSpace(form.FormType))
                {
                    form.FormType = "HTML"; // 默認值
                }

                if (form.FormType == "HTML" && string.IsNullOrWhiteSpace(form.HtmlCode))
                {
                    _loggingService.LogWarning("HTML 表單的 HTML 代碼為空");
                    return BadRequest(new { error = "HTML 表單的 HTML 代碼不能為空" });
                }

                if (form.FormType == "MetaFlows" && string.IsNullOrWhiteSpace(form.MetaFlowJson))
                {
                    _loggingService.LogWarning("MetaFlows 表單的 JSON 為空");
                    return BadRequest(new { error = "MetaFlows 表單的 JSON 不能為空" });
                }

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                // 獲取當前用戶ID
                var userIdClaim = User.FindFirst("user_id");
                if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out Guid userId))
                {
                    _loggingService.LogWarning("無法識別當前用戶");
                    return Unauthorized(new { error = "無法識別當前用戶" });
                }

                _loggingService.LogInformation($"用戶公司 ID: {companyId.Value}, 用戶 ID: {userId}");

                form.Id = Guid.NewGuid();
                form.CompanyId = companyId.Value;
                form.CreatedAt = DateTime.UtcNow;
                form.UpdatedAt = DateTime.UtcNow;
                form.CreatedUserId = userId;        // 新增：設置創建用戶ID
                form.UpdatedUserId = userId;        // 新增：設置更新用戶ID
                form.Status = "A"; // Active
                form.RStatus = "A"; // Active
                
                // 處理字段顯示設定
                if (!string.IsNullOrEmpty(form.FieldDisplaySettings))
                {
                    _loggingService.LogInformation($"保存字段顯示設定: {form.FieldDisplaySettings}");
                }

                // 如果是 MetaFlows 類型，先提交到 Meta API
                if (form.FormType == "MetaFlows")
                {
                    // 檢查是否已經有 MetaFlowId，如果有則更新，否則創建
                    if (!string.IsNullOrEmpty(form.MetaFlowId))
                    {
                        // 已有 MetaFlowId，執行更新操作
                        try
                        {
                            _loggingService.LogInformation($"開始更新 Meta Flow: {form.MetaFlowId}");
                            
                            // 驗證 JSON 格式（但不解析為對象，保持原始格式）
                            if (string.IsNullOrWhiteSpace(form.MetaFlowJson))
                            {
                                _loggingService.LogError("❌ [UPDATE] Meta Flow JSON 為空");
                                return BadRequest(new { error = "Meta Flow JSON 不能為空" });
                            }
                            
                            // 驗證 JSON 格式是否有效
                            try
                            {
                                var jsonDoc = JsonDocument.Parse(form.MetaFlowJson);
                                _loggingService.LogInformation($"✅ [UPDATE] JSON 格式驗證通過");
                            }
                            catch (JsonException jsonEx)
                            {
                                _loggingService.LogError($"❌ [UPDATE] JSON 格式無效: {jsonEx.Message}");
                                return BadRequest(new { error = $"Meta Flow JSON 格式無效: {jsonEx.Message}" });
                            }
                            
                            // 直接使用前端生成的 JSON 字符串調用 Meta API
                            var metaFlowResponse = await _metaFlowsService.UpdateFlowAsync(
                                companyId.Value, 
                                form.MetaFlowId, 
                                form.MetaFlowJson
                            );
                            
                            _loggingService.LogInformation($"📨 [UPDATE] Meta API 響應:");
                            _loggingService.LogInformation($"   - ID: {metaFlowResponse.Id}");
                            _loggingService.LogInformation($"   - Status: {metaFlowResponse.Status}");
                            
                            // 更新 Meta API 返回的元數據
                            form.MetaFlowVersion = metaFlowResponse.Version;
                            form.MetaFlowStatus = metaFlowResponse.Status;
                            
                            // 從 Meta API 獲取基本信息並更新 JSON
                            try
                            {
                                var fullFlowData = await _metaFlowsService.GetFlowAsync(companyId.Value, form.MetaFlowId);
                                
                                // 解析原始 JSON 以便構建完整的響應
                                var originalJson = JsonDocument.Parse(form.MetaFlowJson);
                                var originalScreens = originalJson.RootElement.GetProperty("screens");
                                
                                // 構建完整的響應 JSON（包含 Meta API 返回的信息 + 原始 screens）
                                var completeResponseJson = $"{{\"id\":\"{fullFlowData.Id}\",\"name\":{JsonSerializer.Serialize(fullFlowData.Name ?? originalJson.RootElement.GetProperty("name").GetString() ?? form.Name)},\"categories\":{JsonSerializer.Serialize(fullFlowData.Categories ?? originalJson.RootElement.GetProperty("categories").EnumerateArray().Select(e => e.GetString()).ToList())},\"screens\":{originalScreens.GetRawText()},\"version\":{JsonSerializer.Serialize(fullFlowData.Version ?? originalJson.RootElement.GetProperty("version").GetString())},\"status\":{JsonSerializer.Serialize(fullFlowData.Status ?? metaFlowResponse.Status)},\"created_time\":{(fullFlowData.CreatedTime.HasValue ? JsonSerializer.Serialize(fullFlowData.CreatedTime.Value) : "null")},\"updated_time\":{(fullFlowData.UpdatedTime.HasValue ? JsonSerializer.Serialize(fullFlowData.UpdatedTime.Value) : "null")}}}";
                                
                                // 清理 success: null
                                if (completeResponseJson.Contains("\"success\":null"))
                                {
                                    completeResponseJson = System.Text.RegularExpressions.Regex.Replace(
                                        completeResponseJson, 
                                        @",?\s*""success""\s*:\s*null\s*,?", 
                                        "", 
                                        System.Text.RegularExpressions.RegexOptions.IgnoreCase
                                    );
                                }
                                
                                form.MetaFlowJson = completeResponseJson;
                                form.MetaFlowMetadata = JsonSerializer.Serialize(fullFlowData);
                                
                                _loggingService.LogInformation($"💾 [UPDATE] 保存到數據庫的 MetaFlowJson 長度: {completeResponseJson.Length} 字符");
                                _loggingService.LogInformation($"✅ [UPDATE] Meta Flow 更新成功: ID={fullFlowData.Id}");
                            }
                            catch (Exception getEx)
                            {
                                _loggingService.LogWarning($"⚠️ [UPDATE] 更新後獲取 Flow 基本信息失敗，使用原始 JSON: {getEx.Message}");
                                
                                // 如果獲取失敗，直接使用原始 JSON（只清理 success: null 並更新 id、version、status）
                                var cleanedJson = form.MetaFlowJson;
                                if (cleanedJson.Contains("\"success\":null"))
                                {
                                    cleanedJson = System.Text.RegularExpressions.Regex.Replace(
                                        cleanedJson, 
                                        @",?\s*""success""\s*:\s*null\s*,?", 
                                        "", 
                                        System.Text.RegularExpressions.RegexOptions.IgnoreCase
                                    );
                                }
                                
                                // 更新 JSON 中的 id、version、status
                                try
                                {
                                    var jsonDoc = JsonDocument.Parse(cleanedJson);
                                    var root = jsonDoc.RootElement;
                                    var updatedJson = new System.Text.StringBuilder();
                                    updatedJson.Append("{");
                                    
                                    updatedJson.Append($"\"id\":\"{metaFlowResponse.Id}\",");
                                    if (root.TryGetProperty("name", out var name)) updatedJson.Append($"\"name\":{name.GetRawText()},");
                                    if (root.TryGetProperty("categories", out var categories)) updatedJson.Append($"\"categories\":{categories.GetRawText()},");
                                    if (root.TryGetProperty("version", out var version)) updatedJson.Append($"\"version\":{version.GetRawText()},");
                                    if (root.TryGetProperty("screens", out var screens)) updatedJson.Append($"\"screens\":{screens.GetRawText()},");
                                    updatedJson.Append($"\"status\":\"{metaFlowResponse.Status ?? "DRAFT"}\"");
                                    
                                    updatedJson.Append("}");
                                    cleanedJson = updatedJson.ToString();
                                }
                                catch
                                {
                                    // 如果更新失敗，使用原始 JSON
                                }
                                
                                form.MetaFlowJson = cleanedJson;
                                form.MetaFlowMetadata = JsonSerializer.Serialize(metaFlowResponse);
                                
                                _loggingService.LogInformation($"💾 [UPDATE] 保存到數據庫的 MetaFlowJson (fallback) 長度: {cleanedJson.Length} 字符");
                            }
                        }
                        catch (Exception metaEx)
                        {
                            // 詳細記錄錯誤信息
                            _loggingService.LogError($"❌ [UPDATE] 更新 Meta Flow 失敗: {metaEx.Message}", metaEx);
                            _loggingService.LogError($"❌ [UPDATE] 異常類型: {metaEx.GetType().Name}");
                            _loggingService.LogError($"❌ [UPDATE] 堆疊追蹤: {metaEx.StackTrace}");
                            
                            if (metaEx.InnerException != null)
                            {
                                _loggingService.LogError($"❌ [UPDATE] 內部異常: {metaEx.InnerException.Message}");
                            }
                            
                            // 記錄請求的 JSON 以便調試
                            _loggingService.LogError($"❌ [UPDATE] 失敗的請求 JSON: {form.MetaFlowJson}");
                            
                            // Meta API 失敗時，返回詳細錯誤信息給前端
                            return BadRequest(new { 
                                error = "Meta API 更新失敗",
                                message = metaEx.Message,
                                details = metaEx.ToString(),
                                requestJson = form.MetaFlowJson
                            });
                        }
                    }
                    else
                    {
                        // 沒有 MetaFlowId，執行創建操作
                        try
                        {
                            _loggingService.LogInformation($"開始創建 Meta Flow: {form.Name}");
                            
                            // 記錄前端發送的原始 JSON
                            _loggingService.LogInformation($"📥 [CREATE] 前端發送的原始 MetaFlowJson: {form.MetaFlowJson}");
                            
                            // 驗證 JSON 格式（但不解析為對象，保持原始格式）
                            if (string.IsNullOrWhiteSpace(form.MetaFlowJson))
                            {
                                _loggingService.LogError("❌ [CREATE] Meta Flow JSON 為空");
                                return BadRequest(new { error = "Meta Flow JSON 不能為空" });
                            }
                            
                            // 驗證 JSON 格式是否有效
                            try
                            {
                                var jsonDoc = JsonDocument.Parse(form.MetaFlowJson);
                                _loggingService.LogInformation($"✅ [CREATE] JSON 格式驗證通過");
                                
                                // 檢查必要字段
                                if (jsonDoc.RootElement.TryGetProperty("name", out var nameElement))
                                {
                                    var name = nameElement.GetString();
                                    _loggingService.LogInformation($"   - Name: {name}");
                                }
                                if (jsonDoc.RootElement.TryGetProperty("screens", out var screensElement))
                                {
                                    if (screensElement.ValueKind == JsonValueKind.Array)
                                    {
                                        _loggingService.LogInformation($"   - Screens Count: {screensElement.GetArrayLength()}");
                                    }
                                }
                            }
                            catch (JsonException jsonEx)
                            {
                                _loggingService.LogError($"❌ [CREATE] JSON 格式無效: {jsonEx.Message}");
                                return BadRequest(new { error = $"Meta Flow JSON 格式無效: {jsonEx.Message}" });
                            }
                            
                            // 直接使用前端生成的 JSON 字符串調用 Meta API
                            var metaFlowResponse = await _metaFlowsService.CreateFlowAsync(companyId.Value, form.MetaFlowJson);
                        
                        _loggingService.LogInformation($"📨 [CREATE] Meta API 響應:");
                        _loggingService.LogInformation($"   - ID: {metaFlowResponse.Id}");
                        _loggingService.LogInformation($"   - Status: {metaFlowResponse.Status}");
                        
                        // 保存 Meta API 返回的元數據
                        form.MetaFlowId = metaFlowResponse.Id;
                        form.MetaFlowVersion = metaFlowResponse.Version;
                        form.MetaFlowStatus = metaFlowResponse.Status;
                        
                        // 從 Meta API 獲取基本信息（id, name, status, categories, version）
                        try
                        {
                            var fullFlowData = await _metaFlowsService.GetFlowAsync(companyId.Value, metaFlowResponse.Id);
                            
                            // 解析原始 JSON 以便構建完整的響應
                            var originalJson = JsonDocument.Parse(form.MetaFlowJson);
                            var originalScreens = originalJson.RootElement.GetProperty("screens");
                            
                            // 構建完整的響應 JSON（包含 Meta API 返回的信息 + 原始 screens）
                            var completeResponse = new
                            {
                                id = fullFlowData.Id,
                                name = fullFlowData.Name ?? originalJson.RootElement.GetProperty("name").GetString() ?? form.Name,
                                categories = fullFlowData.Categories ?? originalJson.RootElement.GetProperty("categories").EnumerateArray().Select(e => e.GetString()).ToList(),
                                screens = originalScreens.GetRawText(), // 直接使用原始 JSON 中的 screens
                                version = fullFlowData.Version ?? originalJson.RootElement.GetProperty("version").GetString(),
                                status = fullFlowData.Status ?? metaFlowResponse.Status,
                                created_time = fullFlowData.CreatedTime,
                                updated_time = fullFlowData.UpdatedTime
                            };
                            
                            // 手動構建 JSON 字符串，確保 screens 保持原始格式
                            var completeResponseJson = $"{{\"id\":\"{completeResponse.id}\",\"name\":{JsonSerializer.Serialize(completeResponse.name)},\"categories\":{JsonSerializer.Serialize(completeResponse.categories)},\"screens\":{completeResponse.screens},\"version\":{JsonSerializer.Serialize(completeResponse.version)},\"status\":{JsonSerializer.Serialize(completeResponse.status)},\"created_time\":{(completeResponse.created_time.HasValue ? JsonSerializer.Serialize(completeResponse.created_time.Value) : "null")},\"updated_time\":{(completeResponse.updated_time.HasValue ? JsonSerializer.Serialize(completeResponse.updated_time.Value) : "null")}}}";
                            
                            // 清理 success: null
                            if (completeResponseJson.Contains("\"success\":null"))
                            {
                                completeResponseJson = System.Text.RegularExpressions.Regex.Replace(
                                    completeResponseJson, 
                                    @",?\s*""success""\s*:\s*null\s*,?", 
                                    "", 
                                    System.Text.RegularExpressions.RegexOptions.IgnoreCase
                                );
                            }
                            
                            form.MetaFlowJson = completeResponseJson;
                            form.MetaFlowMetadata = JsonSerializer.Serialize(fullFlowData);
                            
                            _loggingService.LogInformation($"💾 [CREATE] 保存到數據庫的 MetaFlowJson 長度: {completeResponseJson.Length} 字符");
                            _loggingService.LogInformation($"✅ [CREATE] Meta Flow 創建成功: ID={fullFlowData.Id}");
                        }
                        catch (Exception getEx)
                        {
                            _loggingService.LogWarning($"⚠️ [CREATE] 創建後獲取 Flow 基本信息失敗，使用原始 JSON: {getEx.Message}");
                            
                            // 如果獲取失敗，直接使用原始 JSON（只清理 success: null）
                            var cleanedJson = form.MetaFlowJson;
                            if (cleanedJson.Contains("\"success\":null"))
                            {
                                cleanedJson = System.Text.RegularExpressions.Regex.Replace(
                                    cleanedJson, 
                                    @",?\s*""success""\s*:\s*null\s*,?", 
                                    "", 
                                    System.Text.RegularExpressions.RegexOptions.IgnoreCase
                                );
                            }
                            
                            // 更新 JSON 中的 id、version、status
                            try
                            {
                                var jsonDoc = JsonDocument.Parse(cleanedJson);
                                var root = jsonDoc.RootElement;
                                var updatedJson = new System.Text.StringBuilder();
                                updatedJson.Append("{");
                                
                                updatedJson.Append($"\"id\":\"{metaFlowResponse.Id}\",");
                                if (root.TryGetProperty("name", out var name)) updatedJson.Append($"\"name\":{name.GetRawText()},");
                                if (root.TryGetProperty("categories", out var categories)) updatedJson.Append($"\"categories\":{categories.GetRawText()},");
                                if (root.TryGetProperty("version", out var version)) updatedJson.Append($"\"version\":{version.GetRawText()},");
                                if (root.TryGetProperty("screens", out var screens)) updatedJson.Append($"\"screens\":{screens.GetRawText()},");
                                updatedJson.Append($"\"status\":\"{metaFlowResponse.Status ?? "DRAFT"}\"");
                                
                                updatedJson.Append("}");
                                cleanedJson = updatedJson.ToString();
                            }
                            catch
                            {
                                // 如果更新失敗，使用原始 JSON
                            }
                            
                            form.MetaFlowJson = cleanedJson;
                            form.MetaFlowMetadata = JsonSerializer.Serialize(metaFlowResponse);
                            
                            _loggingService.LogInformation($"💾 [CREATE] 保存到數據庫的 MetaFlowJson (fallback) 長度: {cleanedJson.Length} 字符");
                        }
                    }
                    catch (Exception metaEx)
                    {
                        // 詳細記錄錯誤信息
                        _loggingService.LogError($"❌ [CREATE] 創建 Meta Flow 失敗: {metaEx.Message}", metaEx);
                        _loggingService.LogError($"❌ [CREATE] 異常類型: {metaEx.GetType().Name}");
                        _loggingService.LogError($"❌ [CREATE] 堆疊追蹤: {metaEx.StackTrace}");
                        
                        if (metaEx.InnerException != null)
                        {
                            _loggingService.LogError($"❌ [CREATE] 內部異常: {metaEx.InnerException.Message}");
                        }
                        
                        // 記錄請求的 JSON 以便調試
                        _loggingService.LogError($"❌ [CREATE] 失敗的請求 JSON: {form.MetaFlowJson}");
                        
                        // Meta API 失敗時，返回詳細錯誤信息給前端
                        return BadRequest(new { 
                            error = "Meta API 調用失敗",
                            message = metaEx.Message,
                            details = metaEx.ToString(),
                            requestJson = form.MetaFlowJson
                        });
                    }
                    }
                }

                _loggingService.LogInformation($"準備保存表單定義: ID={form.Id}, CompanyId={form.CompanyId}, CreatedUserId={form.CreatedUserId}, Name={form.Name}");

                _context.eFormDefinitions.Add(form);
                
                _loggingService.LogInformation("表單定義已添加到 DbContext，準備保存到數據庫");
                
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功創建表單定義: {form.Name}, ID: {form.Id}");
                return CreatedAtAction(nameof(Get), new { id = form.Id }, form);
            }
            catch (DbUpdateException dbEx)
            {
                _loggingService.LogError($"數據庫更新錯誤: {dbEx.Message}", dbEx);
                _loggingService.LogError($"內部錯誤: {dbEx.InnerException?.Message}");
                return StatusCode(500, new { error = "數據庫保存失敗: " + dbEx.Message });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"創建表單定義失敗: {ex.Message}", ex);
                _loggingService.LogError($"異常類型: {ex.GetType().Name}");
                _loggingService.LogError($"堆疊追蹤: {ex.StackTrace}");
                return StatusCode(500, new { error = "創建表單定義失敗: " + ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] eFormDefinition form)
        {
            try
            {
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                // 獲取當前用戶ID
                var userIdClaim = User.FindFirst("user_id");
                if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out Guid userId))
                {
                    _loggingService.LogWarning("無法識別當前用戶");
                    return Unauthorized(new { error = "無法識別當前用戶" });
                }

                var existingForm = await _context.eFormDefinitions
                    .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == companyId.Value);

                if (existingForm == null)
                {
                    _loggingService.LogWarning($"找不到要更新的表單定義，ID: {id}");
                    return NotFound();
                }

                existingForm.Name = form.Name;
                existingForm.Description = form.Description;
                existingForm.Status = form.Status;
                existingForm.FieldDisplaySettings = form.FieldDisplaySettings;
                existingForm.UpdatedAt = DateTime.UtcNow;
                existingForm.UpdatedUserId = userId;
                
                // 根據表單類型更新對應的字段
                if (existingForm.FormType == "HTML")
                {
                    existingForm.HtmlCode = form.HtmlCode;
                }
                else if (existingForm.FormType == "MetaFlows")
                {
                    // 如果是 MetaFlows 類型，先更新到 Meta API（如果有 MetaFlowId）
                    if (!string.IsNullOrEmpty(existingForm.MetaFlowId) && !string.IsNullOrEmpty(form.MetaFlowJson))
                    {
                        try
                        {
                            _loggingService.LogInformation($"開始更新 Meta Flow: {existingForm.MetaFlowId}");
                            
                            // 驗證 JSON 格式（但不解析為對象，保持原始格式）
                            try
                            {
                                var jsonDoc = JsonDocument.Parse(form.MetaFlowJson);
                                _loggingService.LogInformation($"✅ [UPDATE] JSON 格式驗證通過");
                            }
                            catch (JsonException jsonEx)
                            {
                                _loggingService.LogError($"❌ [UPDATE] JSON 格式無效: {jsonEx.Message}");
                                return BadRequest(new { error = $"Meta Flow JSON 格式無效: {jsonEx.Message}" });
                            }
                            
                            // 直接使用前端生成的 JSON 字符串調用 Meta API
                            var metaFlowResponse = await _metaFlowsService.UpdateFlowAsync(
                                companyId.Value, 
                                existingForm.MetaFlowId, 
                                form.MetaFlowJson
                            );
                            
                            _loggingService.LogInformation($"📨 [UPDATE] Meta API 響應:");
                            _loggingService.LogInformation($"   - ID: {metaFlowResponse.Id}");
                            _loggingService.LogInformation($"   - Status: {metaFlowResponse.Status}");
                            
                            // 更新 Meta API 返回的元數據
                            existingForm.MetaFlowVersion = metaFlowResponse.Version;
                            existingForm.MetaFlowStatus = metaFlowResponse.Status;
                            
                            // 從 Meta API 獲取基本信息並更新 JSON
                            try
                            {
                                var fullFlowData = await _metaFlowsService.GetFlowAsync(companyId.Value, existingForm.MetaFlowId);
                                
                                // 解析原始 JSON 以便構建完整的響應
                                var originalJson = JsonDocument.Parse(form.MetaFlowJson);
                                var originalScreens = originalJson.RootElement.GetProperty("screens");
                                
                                // 構建完整的響應 JSON（包含 Meta API 返回的信息 + 原始 screens）
                                var completeResponseJson = $"{{\"id\":\"{fullFlowData.Id}\",\"name\":{JsonSerializer.Serialize(fullFlowData.Name ?? originalJson.RootElement.GetProperty("name").GetString() ?? form.Name)},\"categories\":{JsonSerializer.Serialize(fullFlowData.Categories ?? originalJson.RootElement.GetProperty("categories").EnumerateArray().Select(e => e.GetString()).ToList())},\"screens\":{originalScreens.GetRawText()},\"version\":{JsonSerializer.Serialize(fullFlowData.Version ?? originalJson.RootElement.GetProperty("version").GetString())},\"status\":{JsonSerializer.Serialize(fullFlowData.Status ?? metaFlowResponse.Status)},\"created_time\":{(fullFlowData.CreatedTime.HasValue ? JsonSerializer.Serialize(fullFlowData.CreatedTime.Value) : "null")},\"updated_time\":{(fullFlowData.UpdatedTime.HasValue ? JsonSerializer.Serialize(fullFlowData.UpdatedTime.Value) : "null")}}}";
                                
                                // 清理 success: null
                                if (completeResponseJson.Contains("\"success\":null"))
                                {
                                    completeResponseJson = System.Text.RegularExpressions.Regex.Replace(
                                        completeResponseJson, 
                                        @",?\s*""success""\s*:\s*null\s*,?", 
                                        "", 
                                        System.Text.RegularExpressions.RegexOptions.IgnoreCase
                                    );
                                }
                                
                                existingForm.MetaFlowJson = completeResponseJson;
                                existingForm.MetaFlowMetadata = JsonSerializer.Serialize(fullFlowData);
                                
                                _loggingService.LogInformation($"💾 [UPDATE] 保存到數據庫的 MetaFlowJson 長度: {completeResponseJson.Length} 字符");
                                _loggingService.LogInformation($"✅ [UPDATE] Meta Flow 更新成功: ID={fullFlowData.Id}");
                            }
                            catch (Exception getEx)
                            {
                                _loggingService.LogWarning($"⚠️ [UPDATE] 更新後獲取 Flow 基本信息失敗，使用原始 JSON: {getEx.Message}");
                                
                                // 如果獲取失敗，直接使用原始 JSON（只清理 success: null 並更新 id、version、status）
                                var cleanedJson = form.MetaFlowJson;
                                if (cleanedJson.Contains("\"success\":null"))
                                {
                                    cleanedJson = System.Text.RegularExpressions.Regex.Replace(
                                        cleanedJson, 
                                        @",?\s*""success""\s*:\s*null\s*,?", 
                                        "", 
                                        System.Text.RegularExpressions.RegexOptions.IgnoreCase
                                    );
                                }
                                
                                // 更新 JSON 中的 id、version、status
                                try
                                {
                                    var jsonDoc = JsonDocument.Parse(cleanedJson);
                                    var root = jsonDoc.RootElement;
                                    var updatedJson = new System.Text.StringBuilder();
                                    updatedJson.Append("{");
                                    
                                    updatedJson.Append($"\"id\":\"{metaFlowResponse.Id}\",");
                                    if (root.TryGetProperty("name", out var name)) updatedJson.Append($"\"name\":{name.GetRawText()},");
                                    if (root.TryGetProperty("categories", out var categories)) updatedJson.Append($"\"categories\":{categories.GetRawText()},");
                                    if (root.TryGetProperty("version", out var version)) updatedJson.Append($"\"version\":{version.GetRawText()},");
                                    if (root.TryGetProperty("screens", out var screens)) updatedJson.Append($"\"screens\":{screens.GetRawText()},");
                                    updatedJson.Append($"\"status\":\"{metaFlowResponse.Status ?? "DRAFT"}\"");
                                    
                                    updatedJson.Append("}");
                                    cleanedJson = updatedJson.ToString();
                                }
                                catch
                                {
                                    // 如果更新失敗，使用原始 JSON
                                }
                                
                                existingForm.MetaFlowJson = cleanedJson;
                                existingForm.MetaFlowMetadata = JsonSerializer.Serialize(metaFlowResponse);
                                
                                _loggingService.LogInformation($"💾 [UPDATE] 保存到數據庫的 MetaFlowJson (fallback) 長度: {cleanedJson.Length} 字符");
                            }
                        }
                        catch (Exception metaEx)
                        {
                            // 詳細記錄錯誤信息
                            _loggingService.LogError($"❌ [UPDATE] 更新 Meta Flow 失敗: {metaEx.Message}", metaEx);
                            _loggingService.LogError($"❌ [UPDATE] 異常類型: {metaEx.GetType().Name}");
                            _loggingService.LogError($"❌ [UPDATE] 堆疊追蹤: {metaEx.StackTrace}");
                            
                            if (metaEx.InnerException != null)
                            {
                                _loggingService.LogError($"❌ [UPDATE] 內部異常: {metaEx.InnerException.Message}");
                            }
                            
                            // 記錄請求的 JSON 以便調試
                            _loggingService.LogError($"❌ [UPDATE] 失敗的請求 JSON: {form.MetaFlowJson}");
                            
                            // Meta API 失敗時，返回詳細錯誤信息給前端
                            return BadRequest(new { 
                                error = "Meta API 更新失敗",
                                message = metaEx.Message,
                                details = metaEx.ToString(),
                                requestJson = form.MetaFlowJson
                            });
                        }
                    }
                    else
                    {
                        // 如果沒有 MetaFlowId，可能是新創建的，直接保存 JSON
                        existingForm.MetaFlowJson = form.MetaFlowJson;
                    }
                }
                
                // 記錄字段顯示設定更新
                if (!string.IsNullOrEmpty(form.FieldDisplaySettings))
                {
                    _loggingService.LogInformation($"更新字段顯示設定: {form.FieldDisplaySettings}");
                }

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功更新表單定義: {existingForm.Name}");
                return Ok(existingForm);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新表單定義失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "更新表單定義失敗" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var form = await _context.eFormDefinitions
                    .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == companyId.Value);

                if (form == null)
                {
                    _loggingService.LogWarning($"找不到要刪除的表單定義，ID: {id}");
                    return NotFound();
                }

                _context.eFormDefinitions.Remove(form);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功刪除表單定義: {form.Name}");
                return NoContent();
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"刪除表單定義失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "刪除表單定義失敗" });
            }
        }

        [HttpDelete("batch-delete")]
        public async Task<IActionResult> BatchDelete([FromBody] EFormBatchDeleteRequest request)
        {
            try
            {
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                if (request?.FormIds == null || !request.FormIds.Any())
                {
                    return BadRequest(new { success = false, error = "沒有提供要刪除的表單ID" });
                }

                var formsToDelete = await _context.eFormDefinitions
                    .Where(f => request.FormIds.Contains(f.Id) && f.CompanyId == companyId.Value)
                    .ToListAsync();

                if (!formsToDelete.Any())
                {
                    return NotFound(new { success = false, error = "未找到要刪除的表單" });
                }

                // 刪除相關文件
                foreach (var form in formsToDelete)
                {
                    try
                    {
                        if (!string.IsNullOrEmpty(form.SourceFilePath))
                        {
                            var filePath = Path.Combine("Uploads", "FormsFiles", form.SourceFilePath);
                            if (System.IO.File.Exists(filePath))
                            {
                                System.IO.File.Delete(filePath);
                                _loggingService.LogInformation($"🗑️ [BatchDelete] 刪除文件: {filePath}");
                            }

                            // 刪除相關的 HTML 和圖片文件
                            var directory = Path.GetDirectoryName(filePath);
                            if (Directory.Exists(directory))
                            {
                                var relatedFiles = Directory.GetFiles(directory, $"{Path.GetFileNameWithoutExtension(filePath)}*");
                                foreach (var relatedFile in relatedFiles)
                                {
                                    System.IO.File.Delete(relatedFile);
                                    _loggingService.LogInformation($"🗑️ [BatchDelete] 刪除相關文件: {relatedFile}");
                                }
                            }
                        }
                    }
                                                catch (Exception ex)
                            {
                                _loggingService.LogWarning($"⚠️ [BatchDelete] 刪除文件時發生錯誤: {ex.Message}");
                            }
                }

                // 從資料庫刪除
                _context.eFormDefinitions.RemoveRange(formsToDelete);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"✅ [BatchDelete] 成功刪除 {formsToDelete.Count} 個表單");

                return Ok(new
                {
                    success = true,
                    deletedCount = formsToDelete.Count,
                    message = $"成功刪除 {formsToDelete.Count} 個表單"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [BatchDelete] 批量刪除失敗: {ex.Message}", ex);
                return StatusCode(500, new { success = false, error = $"批量刪除失敗: {ex.Message}" });
            }
        }

        [HttpPut("batch-status")]
        public async Task<IActionResult> BatchStatus([FromBody] EFormBatchStatusRequest request)
        {
            try
            {
                _loggingService.LogInformation($"🔄 [BatchStatus] 開始批量狀態更新");
                _loggingService.LogInformation($"🔄 [BatchStatus] 表單數量: {request?.FormIds?.Count ?? 0}");
                _loggingService.LogInformation($"🔄 [BatchStatus] 新狀態: {request?.Status}");

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning($"❌ [BatchStatus] 無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                if (request?.FormIds == null || !request.FormIds.Any())
                {
                    _loggingService.LogWarning($"❌ [BatchStatus] 沒有提供表單ID");
                    return BadRequest(new { success = false, error = "沒有提供要更新的表單ID" });
                }

                if (string.IsNullOrEmpty(request.Status) || (request.Status != "A" && request.Status != "I"))
                {
                    _loggingService.LogWarning($"❌ [BatchStatus] 無效的狀態值: {request.Status}");
                    return BadRequest(new { success = false, error = "無效的狀態值，只支持 'A' (啟用) 或 'I' (停用)" });
                }

                var formsToUpdate = await _context.eFormDefinitions
                    .Where(f => request.FormIds.Contains(f.Id) && f.CompanyId == companyId.Value)
                    .ToListAsync();

                if (!formsToUpdate.Any())
                {
                    _loggingService.LogWarning($"❌ [BatchStatus] 未找到要更新的表單");
                    return NotFound(new { success = false, error = "未找到要更新的表單" });
                }

                _loggingService.LogInformation($"🔄 [BatchStatus] 找到 {formsToUpdate.Count} 個表單需要更新");

                // 更新表單狀態
                foreach (var form in formsToUpdate)
                {
                    form.Status = request.Status;
                    form.UpdatedAt = DateTime.UtcNow;
                    _loggingService.LogInformation($"🔄 [BatchStatus] 更新表單: {form.Name} -> {request.Status}");
                }

                await _context.SaveChangesAsync();

                var statusText = request.Status == "A" ? "啟用" : "停用";
                _loggingService.LogInformation($"✅ [BatchStatus] 成功{statusText} {formsToUpdate.Count} 個表單");

                return Ok(new
                {
                    success = true,
                    updatedCount = formsToUpdate.Count,
                    message = $"成功{statusText} {formsToUpdate.Count} 個表單"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [BatchStatus] 批量狀態更新失敗: {ex.Message}", ex);
                return StatusCode(500, new { success = false, error = $"批量狀態更新失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 從 Meta API 獲取最新版本的 Flow
        /// </summary>
        [HttpGet("{id}/meta-flow")]
        public async Task<IActionResult> GetMetaFlowFromApi(Guid id)
        {
            try
            {
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var form = await _context.eFormDefinitions
                    .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == companyId.Value);

                if (form == null)
                {
                    _loggingService.LogWarning($"找不到表單定義，ID: {id}");
                    return NotFound();
                }

                if (form.FormType != "MetaFlows")
                {
                    return BadRequest(new { error = "此表單不是 MetaFlows 類型" });
                }

                if (string.IsNullOrEmpty(form.MetaFlowId))
                {
                    return BadRequest(new { error = "此表單沒有 Meta Flow ID" });
                }

                _loggingService.LogInformation($"從 Meta API 獲取 Flow: {form.MetaFlowId}");
                var metaFlow = await _metaFlowsService.GetFlowAsync(companyId.Value, form.MetaFlowId);
                
                // 注意：GetFlowAsync 只返回基本信息（id, name, status, categories），不包含 screens
                // 因此不應該覆蓋 MetaFlowJson，只更新版本和狀態信息
                // 保留數據庫中已有的完整 JSON（包含 screens 和 data 模型）
                if (!string.IsNullOrEmpty(form.MetaFlowJson))
                {
                    _loggingService.LogInformation($"保留數據庫中的完整 MetaFlowJson（包含 screens），只更新版本和狀態");
                }
                else
                {
                    _loggingService.LogWarning($"數據庫中沒有 MetaFlowJson，但 GetFlowAsync 不返回 screens，無法完整恢復");
                }
                
                // 只更新版本和狀態，不覆蓋 MetaFlowJson
                form.MetaFlowVersion = metaFlow.Version;
                form.MetaFlowStatus = metaFlow.Status;
                form.MetaFlowMetadata = JsonSerializer.Serialize(metaFlow);
                
                await _context.SaveChangesAsync();
                
                _loggingService.LogInformation($"成功從 Meta API 獲取並更新 Flow 版本和狀態: {form.Name}, Version: {metaFlow.Version}, Status: {metaFlow.Status}");
                
                // 返回數據庫中的完整 JSON，而不是只有基本信息的 metaFlow
                if (!string.IsNullOrEmpty(form.MetaFlowJson))
                {
                    try
                    {
                        var fullFlowData = JsonSerializer.Deserialize<MetaFlowResponse>(form.MetaFlowJson, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        if (fullFlowData != null)
                        {
                            // 更新基本信息（從 Meta API 獲取的）
                            fullFlowData.Id = metaFlow.Id;
                            fullFlowData.Name = metaFlow.Name;
                            fullFlowData.Status = metaFlow.Status;
                            fullFlowData.Categories = metaFlow.Categories;
                            fullFlowData.Version = metaFlow.Version;
                            
                            return Ok(fullFlowData);
                        }
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogWarning($"解析數據庫中的 MetaFlowJson 失敗，返回基本信息: {ex.Message}");
                    }
                }
                
                // 如果無法解析數據庫中的 JSON，返回基本信息
                return Ok(metaFlow);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"從 Meta API 獲取 Flow 失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = $"從 Meta API 獲取 Flow 失敗: {ex.Message}" });
            }
        }
    }

    public class EFormBatchDeleteRequest
    {
        public List<Guid> FormIds { get; set; } = new List<Guid>();
    }

    public class EFormBatchStatusRequest
    {
        public List<Guid> FormIds { get; set; } = new List<Guid>();
        public string Status { get; set; } = string.Empty; // "A" for Active, "I" for Inactive
    }
}