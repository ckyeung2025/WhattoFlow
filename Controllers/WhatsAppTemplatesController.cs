using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System.Text.Json;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WhatsAppTemplatesController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;

        public WhatsAppTemplatesController(PurpleRiceDbContext context)
        {
            _context = context;
        }

        private Guid? GetCurrentUserCompanyId()
        {
            // 嘗試從 JWT Claims 取得 company_id
            var companyIdClaim = User.Claims.FirstOrDefault(c => c.Type == "company_id");
            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out var companyId))
            {
                return companyId;
            }
            
            // 如果找不到 company_id，嘗試從 user_id 查詢用戶的公司 ID
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "user_id");
            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
            {
                var user = _context.Users.FirstOrDefault(u => u.Id == userId);
                if (user != null)
                {
                    return user.CompanyId;
                }
            }
            
            return null;
        }

        /// <summary>
        /// 獲取模板列表（支持分頁、排序、搜索）
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetTemplates(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string sortField = "createdAt",
            [FromQuery] string sortOrder = "desc",
            [FromQuery] string search = "",
            [FromQuery] string category = "",
            [FromQuery] string status = "")
        {
            try
            {
                Console.WriteLine($"📋 [GetTemplates] 獲取模板列表 - 頁面: {page}, 每頁: {pageSize}, 排序: {sortField} {sortOrder}, 搜索: {search}");

                var query = _context.WhatsAppTemplates.AsQueryable();

                // 搜索過濾
                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(t => 
                        t.Name.Contains(search) || 
                        t.Description.Contains(search) || 
                        t.Category.Contains(search));
                }

                // 分類過濾
                if (!string.IsNullOrEmpty(category))
                {
                    query = query.Where(t => t.Category == category);
                }

                // 狀態過濾
                if (!string.IsNullOrEmpty(status))
                {
                    query = query.Where(t => t.Status == status);
                }

                // 應用排序
                query = sortField.ToLower() switch
                {
                    "name" => sortOrder.ToLower() == "asc" ? query.OrderBy(t => t.Name) : query.OrderByDescending(t => t.Name),
                    "category" => sortOrder.ToLower() == "asc" ? query.OrderBy(t => t.Category) : query.OrderByDescending(t => t.Category),
                    "status" => sortOrder.ToLower() == "asc" ? query.OrderBy(t => t.Status) : query.OrderByDescending(t => t.Status),
                    "updatedat" => sortOrder.ToLower() == "asc" ? query.OrderBy(t => t.UpdatedAt) : query.OrderByDescending(t => t.UpdatedAt),
                    _ => sortOrder.ToLower() == "asc" ? query.OrderBy(t => t.CreatedAt) : query.OrderByDescending(t => t.CreatedAt)
                };

                // 計算總數
                var total = await query.CountAsync();

                // 應用分頁
                var templates = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(t => new
                    {
                        t.Id,
                        t.Name,
                        t.Description,
                        t.Category,
                        t.TemplateType,
                        t.Content,
                        t.Variables,
                        t.Status,
                        t.Language,
                        t.CreatedAt,
                        t.UpdatedAt,
                        t.CreatedBy,
                        t.UpdatedBy,
                        t.Version
                    })
                    .ToListAsync();

                Console.WriteLine($"✅ [GetTemplates] 成功獲取 {templates.Count} 個模板，總計 {total} 個");
                
                // 添加調試信息
                foreach (var template in templates)
                {
                    Console.WriteLine($"📋 [GetTemplates] 模板 {template.Name}: Content={template.Content?.Substring(0, Math.Min(50, template.Content?.Length ?? 0))}..., Variables={template.Variables?.Substring(0, Math.Min(50, template.Variables?.Length ?? 0))}...");
                }

                return Ok(new
                {
                    success = true,
                    data = templates,
                    total = total,
                    page = page,
                    pageSize = pageSize,
                    sortField = sortField,
                    sortOrder = sortOrder
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [GetTemplates] 獲取模板列表失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"獲取模板列表失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 獲取單個模板詳情
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetTemplate(Guid id)
        {
            try
            {
                var template = await _context.WhatsAppTemplates
                    .Where(t => t.Id == id)
                    .Select(t => new
                    {
                        t.Id,
                        t.Name,
                        t.Description,
                        t.Category,
                        t.TemplateType,
                        t.Content,
                        t.Variables,
                        t.Status,
                        t.Language,
                        t.CreatedAt,
                        t.UpdatedAt,
                        t.CreatedBy,
                        t.UpdatedBy,
                        t.Version
                    })
                    .FirstOrDefaultAsync();

                if (template == null)
                {
                    return NotFound(new { success = false, error = "模板不存在" });
                }

                return Ok(new { success = true, data = template });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [GetTemplate] 獲取模板詳情失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"獲取模板詳情失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 創建新模板
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateTemplate([FromBody] WhatsAppTemplateCreateRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Name))
                {
                    return BadRequest(new { success = false, error = "模板名稱不能為空" });
                }

                var template = new WhatsAppTemplate
                {
                    Id = Guid.NewGuid(),
                    Name = request.Name,
                    Description = request.Description,
                    Category = request.Category ?? "General",
                    TemplateType = request.TemplateType ?? "Text",
                    Content = request.Content,
                    Variables = request.Variables,
                    Status = request.Status ?? "Active",
                    Language = request.Language ?? "zh-TW",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedBy = request.CreatedBy ?? "System",
                    UpdatedBy = request.UpdatedBy ?? "System",
                    CompanyId = request.CompanyId,
                    Version = 1
                };

                _context.WhatsAppTemplates.Add(template);
                await _context.SaveChangesAsync();

                Console.WriteLine($"✅ [CreateTemplate] 成功創建模板: {template.Name}");

                return Ok(new { 
                    success = true, 
                    data = template.Id,
                    message = "模板創建成功" 
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [CreateTemplate] 創建模板失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"創建模板失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 更新模板
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTemplate(Guid id, [FromBody] WhatsAppTemplateUpdateRequest request)
        {
            try
            {
                Console.WriteLine($"📝 [UpdateTemplate] 開始更新模板 ID: {id}");
                Console.WriteLine($"📝 [UpdateTemplate] 請求數據: {System.Text.Json.JsonSerializer.Serialize(request)}");

                var template = await _context.WhatsAppTemplates.FindAsync(id);
                if (template == null)
                {
                    Console.WriteLine($"❌ [UpdateTemplate] 模板不存在: {id}");
                    return NotFound(new { success = false, error = "模板不存在" });
                }

                // 更新所有字段，即使為空也更新
                template.Name = request.Name;
                template.Description = request.Description;
                template.Category = request.Category;
                template.TemplateType = request.TemplateType;
                template.Content = request.Content;
                template.Variables = request.Variables;
                template.Status = request.Status;
                template.Language = request.Language;
                template.UpdatedAt = DateTime.UtcNow;
                template.UpdatedBy = request.UpdatedBy ?? "System";
                template.Version++;

                Console.WriteLine($"📝 [UpdateTemplate] 更新後數據: Name={template.Name}, Category={template.Category}, TemplateType={template.TemplateType}, Status={template.Status}");

                await _context.SaveChangesAsync();

                Console.WriteLine($"✅ [UpdateTemplate] 成功更新模板: {template.Name}");

                return Ok(new { 
                    success = true, 
                    message = "模板更新成功" 
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [UpdateTemplate] 更新模板失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"更新模板失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 批量刪除模板
        /// </summary>
        [HttpDelete("batch-delete")]
        public async Task<IActionResult> BatchDeleteTemplates([FromBody] WhatsAppTemplateBatchDeleteRequest request)
        {
            try
            {
                Console.WriteLine($"🗑️ [BatchDeleteTemplates] 批量刪除模板 - 數量: {request.TemplateIds?.Count ?? 0}");

                if (request.TemplateIds == null || !request.TemplateIds.Any())
                {
                    return BadRequest(new { success = false, error = "請提供要刪除的模板 ID" });
                }

                var templatesToDelete = await _context.WhatsAppTemplates
                    .Where(t => request.TemplateIds.Contains(t.Id))
                    .ToListAsync();

                if (!templatesToDelete.Any())
                {
                    return NotFound(new { success = false, error = "未找到要刪除的模板" });
                }

                // 軟刪除（標記為已刪除）
                foreach (var template in templatesToDelete)
                {
                    template.IsDeleted = true;
                    template.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();

                Console.WriteLine($"✅ [BatchDeleteTemplates] 成功刪除 {templatesToDelete.Count} 個模板");

                return Ok(new
                {
                    success = true,
                    deletedCount = templatesToDelete.Count,
                    message = $"成功刪除 {templatesToDelete.Count} 個模板"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [BatchDeleteTemplates] 批量刪除失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"批量刪除失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 刪除單個模板
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTemplate(Guid id)
        {
            try
            {
                var template = await _context.WhatsAppTemplates.FindAsync(id);
                if (template == null)
                {
                    return NotFound(new { success = false, error = "模板不存在" });
                }

                // 軟刪除
                template.IsDeleted = true;
                template.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                Console.WriteLine($"✅ [DeleteTemplate] 成功刪除模板: {template.Name}");

                return Ok(new
                {
                    success = true,
                    message = "模板已成功刪除"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [DeleteTemplate] 刪除失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"刪除失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 獲取模板分類列表
        /// </summary>
        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            try
            {
                var categories = await _context.WhatsAppTemplates
                    .Where(t => !t.IsDeleted)
                    .Select(t => t.Category)
                    .Distinct()
                    .OrderBy(c => c)
                    .ToListAsync();

                return Ok(new { success = true, data = categories });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [GetCategories] 獲取分類失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"獲取分類失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 測試模板渲染
        /// </summary>
        [HttpPost("test-render")]
        public async Task<IActionResult> TestRenderTemplate([FromBody] WhatsAppTemplateTestRequest request)
        {
            try
            {
                var template = await _context.WhatsAppTemplates.FindAsync(request.TemplateId);
                if (template == null)
                {
                    return NotFound(new { success = false, error = "模板不存在" });
                }

                // 解析模板內容
                var templateContent = JsonSerializer.Deserialize<JsonElement>(template.Content);
                var variables = !string.IsNullOrEmpty(template.Variables) 
                    ? JsonSerializer.Deserialize<List<WhatsAppTemplateVariable>>(template.Variables) 
                    : new List<WhatsAppTemplateVariable>();

                // 渲染模板
                var renderedContent = RenderTemplate(templateContent, request.Variables);

                return Ok(new { 
                    success = true, 
                    data = new
                    {
                        originalContent = templateContent,
                        renderedContent = renderedContent,
                        variables = variables
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [TestRenderTemplate] 測試渲染失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"測試渲染失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 渲染模板內容
        /// </summary>
        private string RenderTemplate(JsonElement templateContent, Dictionary<string, string> variables)
        {
            var content = templateContent.GetProperty("content").GetString();
            
            if (variables != null)
            {
                foreach (var variable in variables)
                {
                    content = content.Replace($"{{{{{variable.Key}}}}}", variable.Value);
                }
            }

            return content;
        }

        // GET: api/whatsapptemplates/meta-templates
        [HttpGet("meta-templates")]
        public async Task<IActionResult> GetMetaTemplates()
        {
            try
            {
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                // 從公司表獲取 WhatsApp 配置
                var company = await _context.Companies
                    .Where(c => c.Id == companyId.Value)
                    .FirstOrDefaultAsync();

                if (company == null || string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    return BadRequest(new { error = "公司 WhatsApp 配置不完整" });
                }

                // 調用 Meta API 獲取模板列表
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                // 首先檢查 Access Token 是否有效並獲取用戶資訊
                var meUrl = "https://graph.facebook.com/v23.0/me?fields=id,name,whatsapp_business_account";
                var meResponse = await httpClient.GetAsync(meUrl);
                var meContent = await meResponse.Content.ReadAsStringAsync();
                
                if (!meResponse.IsSuccessStatusCode)
                {
                    return BadRequest(new { error = $"Access Token 無效或權限不足: {meResponse.StatusCode} - {meContent}" });
                }
                
                var meData = JsonSerializer.Deserialize<JsonElement>(meContent);
                
                // 檢查是否有 WhatsApp Business Account
                if (!meData.TryGetProperty("whatsapp_business_account", out var wbaProperty))
                {
                    return BadRequest(new { 
                        error = "此 Access Token 沒有關聯的 WhatsApp Business Account",
                        details = "請在 Facebook 開發者後台啟用 WhatsApp Business API 並設置正確的權限",
                        setupSteps = new[] {
                            "1. 登入 developers.facebook.com",
                            "2. 選擇您的應用程式",
                            "3. 在左側選單中找到 'WhatsApp'",
                            "4. 點擊 'Getting Started' 設置 WhatsApp Business API",
                            "5. 添加 whatsapp_business_messaging 權限",
                            "6. 生成新的 Access Token"
                        }
                    });
                }
                
                var whatsappBusinessAccountId = wbaProperty.GetProperty("id").GetString();
                
                // 使用 WhatsApp Business Account ID 獲取模板列表
                var url = $"https://graph.facebook.com/v23.0/{whatsappBusinessAccountId}/message_templates";
                var response = await httpClient.GetAsync(url);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return BadRequest(new { error = $"Meta API 請求失敗: {response.StatusCode} - {responseContent}" });
                }

                // 解析 Meta API 響應
                var metaResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                var templates = new List<object>();

                if (metaResponse.TryGetProperty("data", out var dataArray))
                {
                    foreach (var template in dataArray.EnumerateArray())
                    {
                        var templateObj = new
                        {
                            id = template.TryGetProperty("id", out var idProp) ? idProp.GetString() : "",
                            name = template.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : "",
                            status = template.TryGetProperty("status", out var statusProp) ? statusProp.GetString() : "",
                            category = template.TryGetProperty("category", out var categoryProp) ? categoryProp.GetString() : "",
                            language = template.TryGetProperty("language", out var languageProp) ? languageProp.GetString() : "",
                            components = template.TryGetProperty("components", out var componentsProp) ? componentsProp.ToString() : "[]"
                        };
                        templates.Add(templateObj);
                    }
                }

                return Ok(new { success = true, data = templates });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"獲取 Meta 模板失敗: {ex.Message}" });
            }
        }

        // POST: api/whatsapptemplates/import-from-meta
        [HttpPost("import-from-meta")]
        public async Task<IActionResult> ImportFromMeta([FromBody] ImportMetaTemplateRequest request)
        {
            try
            {
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                // 從公司表獲取 WhatsApp 配置
                var company = await _context.Companies
                    .Where(c => c.Id == companyId.Value)
                    .FirstOrDefaultAsync();

                if (company == null || string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    return BadRequest(new { error = "公司 WhatsApp 配置不完整" });
                }

                // 調用 Meta API 獲取特定模板詳情
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                var url = $"https://graph.facebook.com/v23.0/{request.MetaTemplateId}";
                var response = await httpClient.GetAsync(url);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return BadRequest(new { error = $"Meta API 請求失敗: {response.StatusCode} - {responseContent}" });
                }

                // 解析模板詳情並創建本地模板
                var metaTemplate = JsonSerializer.Deserialize<JsonElement>(responseContent);
                
                var newTemplate = new WhatsAppTemplate
                {
                    Name = request.CustomName ?? metaTemplate.GetProperty("name").GetString(),
                    Description = request.Description ?? $"從 Meta 導入的模板: {metaTemplate.GetProperty("name").GetString()}",
                    Category = request.Category ?? "Imported",
                    TemplateType = "Text", // 默認類型
                    Content = responseContent, // 保存完整的 Meta 模板數據
                    Variables = "[]", // 默認空變數
                    Status = "Active",
                    Language = metaTemplate.GetProperty("language").GetString(),
                    CreatedBy = User.FindFirst("user_id")?.Value ?? "System",
                    UpdatedBy = User.FindFirst("user_id")?.Value ?? "System",
                    CompanyId = companyId.Value,
                    MetaTemplateId = request.MetaTemplateId.ToString() // 保存 Meta 模板 ID
                };

                _context.WhatsAppTemplates.Add(newTemplate);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = newTemplate, message = "模板導入成功" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"導入 Meta 模板失敗: {ex.Message}" });
            }
        }

        // POST: api/whatsapptemplates/create-in-meta
        [HttpPost("create-in-meta")]
        public async Task<IActionResult> CreateInMeta([FromBody] CreateMetaTemplateRequest request)
        {
            try
            {
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                // 從公司表獲取 WhatsApp 配置
                var company = await _context.Companies
                    .Where(c => c.Id == companyId.Value)
                    .FirstOrDefaultAsync();

                if (company == null || string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    return BadRequest(new { error = "公司 WhatsApp 配置不完整" });
                }

                // 構建 Meta API 請求
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                // 首先檢查 Access Token 是否有效並獲取用戶資訊
                var meUrl = "https://graph.facebook.com/v23.0/me?fields=id,name,whatsapp_business_account";
                var meResponse = await httpClient.GetAsync(meUrl);
                var meContent = await meResponse.Content.ReadAsStringAsync();
                
                if (!meResponse.IsSuccessStatusCode)
                {
                    return BadRequest(new { error = $"Access Token 無效或權限不足: {meResponse.StatusCode} - {meContent}" });
                }
                
                var meData = JsonSerializer.Deserialize<JsonElement>(meContent);
                
                // 檢查是否有 WhatsApp Business Account
                if (!meData.TryGetProperty("whatsapp_business_account", out var wbaProperty))
                {
                    return BadRequest(new { 
                        error = "此 Access Token 沒有關聯的 WhatsApp Business Account",
                        details = "請在 Facebook 開發者後台啟用 WhatsApp Business API 並設置正確的權限",
                        setupSteps = new[] {
                            "1. 登入 developers.facebook.com",
                            "2. 選擇您的應用程式",
                            "3. 在左側選單中找到 'WhatsApp'",
                            "4. 點擊 'Getting Started' 設置 WhatsApp Business API",
                            "5. 添加 whatsapp_business_messaging 權限",
                            "6. 生成新的 Access Token"
                        }
                    });
                }
                
                var whatsappBusinessAccountId = wbaProperty.GetProperty("id").GetString();
                
                var url = $"https://graph.facebook.com/v23.0/{whatsappBusinessAccountId}/message_templates";
                var payload = new
                {
                    name = request.Name,
                    category = request.Category,
                    components = new[]
                    {
                        new
                        {
                            type = "BODY",
                            text = request.Content
                        }
                    },
                    language = request.Language
                };
                
                var content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return BadRequest(new { error = $"Meta API 創建失敗: {response.StatusCode} - {responseContent}" });
                }

                // 解析響應獲取 Meta 模板 ID
                var metaResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                var metaTemplateId = metaResponse.GetProperty("id").GetString();

                // 創建本地模板記錄
                var newTemplate = new WhatsAppTemplate
                {
                    Name = request.Name,
                    Description = request.Description,
                    Category = request.Category,
                    TemplateType = "Text",
                    Content = request.Content,
                    Variables = "[]",
                    Status = "Active",
                    Language = request.Language,
                    CreatedBy = User.FindFirst("user_id")?.Value ?? "System",
                    UpdatedBy = User.FindFirst("user_id")?.Value ?? "System",
                    CompanyId = companyId.Value,
                    MetaTemplateId = metaTemplateId
                };

                _context.WhatsAppTemplates.Add(newTemplate);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = newTemplate, message = "Meta 模板創建成功" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"創建 Meta 模板失敗: {ex.Message}" });
            }
        }

        // DELETE: api/whatsapptemplates/{id}/delete-from-meta
        [HttpDelete("{id}/delete-from-meta")]
        public async Task<IActionResult> DeleteFromMeta(Guid id)
        {
            try
            {
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var template = await _context.WhatsAppTemplates
                    .Where(t => t.Id == id && t.CompanyId == companyId.Value)
                    .FirstOrDefaultAsync();

                if (template == null)
                {
                    return NotFound(new { error = "模板不存在" });
                }

                if (string.IsNullOrEmpty(template.MetaTemplateId))
                {
                    return BadRequest(new { error = "此模板沒有對應的 Meta 模板 ID" });
                }

                // 從公司表獲取 WhatsApp 配置
                var company = await _context.Companies
                    .Where(c => c.Id == companyId.Value)
                    .FirstOrDefaultAsync();

                if (company == null || string.IsNullOrEmpty(company.WA_API_Key))
                {
                    return BadRequest(new { error = "公司 WhatsApp 配置不完整" });
                }

                // 調用 Meta API 刪除模板
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                var url = $"https://graph.facebook.com/v19.0/{template.MetaTemplateId}";
                var response = await httpClient.DeleteAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    return BadRequest(new { error = $"Meta API 刪除失敗: {response.StatusCode} - {responseContent}" });
                }

                // 刪除本地模板記錄
                _context.WhatsAppTemplates.Remove(template);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Meta 模板刪除成功" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"刪除 Meta 模板失敗: {ex.Message}" });
            }
        }
    }

    // 請求模型
    public class WhatsAppTemplateCreateRequest
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public string Category { get; set; }
        public string TemplateType { get; set; }
        public string Content { get; set; }
        public string Variables { get; set; }
        public string Status { get; set; }
        public string Language { get; set; }
        public string CreatedBy { get; set; }
        public string UpdatedBy { get; set; }
        public Guid? CompanyId { get; set; }
    }

    public class WhatsAppTemplateUpdateRequest
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public string Category { get; set; }
        public string TemplateType { get; set; }
        public string Content { get; set; }
        public string Variables { get; set; }
        public string Status { get; set; }
        public string Language { get; set; }
        public string UpdatedBy { get; set; }
    }

    public class WhatsAppTemplateBatchDeleteRequest
    {
        public List<Guid> TemplateIds { get; set; } = new List<Guid>();
    }

    public class WhatsAppTemplateTestRequest
    {
        public Guid TemplateId { get; set; }
        public Dictionary<string, string> Variables { get; set; }
    }

    public class WhatsAppTemplateVariable
    {
        public string Name { get; set; }
        public string Type { get; set; }
        public string Description { get; set; }
    }

    public class ImportMetaTemplateRequest
    {
        public Guid MetaTemplateId { get; set; }
        public string CustomName { get; set; }
        public string Description { get; set; }
        public string Category { get; set; }
    }

    public class CreateMetaTemplateRequest
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public string Category { get; set; }
        public string Content { get; set; }
        public string Language { get; set; }
    }
}