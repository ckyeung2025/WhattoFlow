using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text.Json;

namespace PurpleRice.Controllers
{
    // DTO 類用於創建請求
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
    }

    // DTO 類用於更新請求
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
    }

    [ApiController]
    [Route("api/[controller]")]
    public class WhatsAppTemplatesController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        
        public WhatsAppTemplatesController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("WhatsAppTemplatesController");
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
            [FromQuery] string sortField = "created_at",
            [FromQuery] string sortOrder = "desc",
            [FromQuery] string search = "")
        {
            try
            {
                _loggingService.LogInformation($"📋 [GetTemplates] 獲取模板列表 - 頁面: {page}, 每頁: {pageSize}, 排序: {sortField} {sortOrder}, 搜索: {search}");

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("❌ [GetTemplates] 無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                // 修復：根據公司ID過濾模板
                var query = _context.WhatsAppTemplates
                    .Where(t => t.CompanyId == companyId.Value && !t.IsDeleted)
                    .AsQueryable();

                // 搜索過濾 - 修復：處理可能為 NULL 的字段
                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(t => 
                        (t.Name != null && t.Name.Contains(search)) || 
                        (t.Category != null && t.Category.Contains(search)) || 
                        (t.TemplateType != null && t.TemplateType.Contains(search)));
                }

                // 排序 - 修復：處理可能為 NULL 的字段
                switch (sortField.ToLower())
                {
                    case "name":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(t => t.Name ?? "") : query.OrderByDescending(t => t.Name ?? "");
                        break;
                    case "category":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(t => t.Category ?? "") : query.OrderByDescending(t => t.Category ?? "");
                        break;
                    case "template_type":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(t => t.TemplateType ?? "") : query.OrderByDescending(t => t.TemplateType ?? "");
                        break;
                    case "status":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(t => t.Status ?? "") : query.OrderByDescending(t => t.Status ?? "");
                        break;
                    case "created_at":
                    default:
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(t => t.CreatedAt) : query.OrderByDescending(t => t.CreatedAt);
                        break;
                }

                var total = await query.CountAsync();
                
                // 修復：先查詢到內存，然後處理 NULL 值
                // 使用 AsEnumerable() 將查詢轉換為內存查詢，避免 EF Core 在數據庫層面處理 NULL 值時出現問題
                var templatesData = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();
                
                // 在內存中處理 NULL 值，確保所有字符串字段都有默認值
                var templates = templatesData.Select(t => new WhatsAppTemplate
                {
                    Id = t.Id,
                    Name = t.Name ?? "",
                    Description = t.Description ?? "",
                    Category = t.Category ?? "General",
                    TemplateType = t.TemplateType ?? "Text",
                    TemplateSource = t.TemplateSource ?? "Internal",
                    Content = t.Content ?? "",
                    Variables = t.Variables ?? "",
                    Status = t.Status ?? "Active",
                    HeaderUrl = t.HeaderUrl ?? "",
                    HeaderType = t.HeaderType ?? "",
                    HeaderFilename = t.HeaderFilename ?? "",
                    Language = t.Language ?? "zh-TW",
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt,
                    CreatedBy = t.CreatedBy ?? "",
                    UpdatedBy = t.UpdatedBy ?? "",
                    CompanyId = t.CompanyId,
                    IsDeleted = t.IsDeleted,
                    Version = t.Version
                }).ToList();

                // 記錄每個模板的詳細信息
                foreach (var template in templates)
                {
                    _loggingService.LogDebug($"📋 [GetTemplates] 模板 {template.Name}: Content={template.Content?.Substring(0, Math.Min(50, template.Content?.Length ?? 0))}..., Variables={template.Variables?.Substring(0, Math.Min(50, template.Variables?.Length ?? 0))}...");
                }

                _loggingService.LogInformation($"✅ [GetTemplates] 成功獲取 {templates.Count} 個模板，總計 {total} 個");

                return Ok(new
                {
                    success = true,           // 添加 success 字段
                    data = templates,         // 模板數據
                    total = total,            // 總數量
                    page = page,              // 當前頁面
                    pageSize = pageSize,      // 每頁大小
                    totalPages = (int)Math.Ceiling((double)total / pageSize)  // 總頁數
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [GetTemplates] 獲取模板列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取模板列表失敗" });
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
                var template = await _context.WhatsAppTemplates.FindAsync(id);
                if (template == null)
                {
                    return NotFound(new { error = "模板不存在" });
                }

                return Ok(template);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [GetTemplate] 獲取模板詳情失敗: {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
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
                // 獲取當前用戶ID和公司ID
                var userIdClaim = User.FindFirst("user_id");
                if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out Guid userId))
                {
                    _loggingService.LogWarning("❌ [CreateTemplate] 無法識別當前用戶");
                    return Unauthorized(new { error = "無法識別當前用戶" });
                }

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("❌ [CreateTemplate] 無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var template = new WhatsAppTemplate
                {
                    Id = Guid.NewGuid(),
                    Name = request.Name,
                    Description = request.Description,
                    Category = request.Category,
                    TemplateType = request.TemplateType,
                    Content = request.Content,
                    Variables = request.Variables,
                    Status = request.Status,
                    Language = request.Language,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedBy = userId.ToString(),
                    UpdatedBy = userId.ToString(),
                    CompanyId = companyId.Value,
                    IsDeleted = false
                };

                _context.WhatsAppTemplates.Add(template);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"✅ [CreateTemplate] 成功創建模板: {template.Name}, 用戶ID: {userId}, 公司ID: {companyId.Value}");

                return Ok(new { 
                    success = true, 
                    data = template,
                    message = "模板創建成功"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [CreateTemplate] 創建模板失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
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
                _loggingService.LogInformation($"📝 [UpdateTemplate] 開始更新模板 ID: {id}");
                _loggingService.LogDebug($"📝 [UpdateTemplate] 請求數據: {JsonSerializer.Serialize(request)}");

                // 獲取當前用戶ID
                var userIdClaim = User.FindFirst("user_id");
                if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out Guid userId))
                {
                    _loggingService.LogWarning("❌ [UpdateTemplate] 無法識別當前用戶");
                    return Unauthorized(new { error = "無法識別當前用戶" });
                }

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("❌ [UpdateTemplate] 無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var template = await _context.WhatsAppTemplates
                    .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == companyId.Value);
            
                if (template == null)
                {
                    _loggingService.LogWarning($"❌ [UpdateTemplate] 模板不存在或無權限訪問: {id}");
                    return NotFound(new { error = "模板不存在或無權限訪問" });
                }

                // 更新模板屬性
                template.Name = request.Name;
                template.Description = request.Description;
                template.Category = request.Category;
                template.TemplateType = request.TemplateType;
                template.Content = request.Content;
                template.Variables = request.Variables;
                template.Status = request.Status;
                template.Language = request.Language;
                template.UpdatedAt = DateTime.UtcNow;
                template.UpdatedBy = userId.ToString();  // 設置更新用戶ID
                
                // 確保 CreatedBy 字段不為空（如果是新創建的模板）
                if (string.IsNullOrEmpty(template.CreatedBy))
                {
                    template.CreatedBy = userId.ToString();
                }

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"📝 [UpdateTemplate] 更新後數據: Name={template.Name}, Category={template.Category}, TemplateType={template.TemplateType}, Status={template.Status}, UpdatedBy={userId}");
                _loggingService.LogInformation($"✅ [UpdateTemplate] 成功更新模板: {template.Name}");

                return Ok(new { 
                    success = true, 
                    data = template,
                    message = "模板更新成功"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [UpdateTemplate] 更新模板失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// 批量刪除模板
        /// </summary>
        [HttpDelete("batch-delete")]
        public async Task<IActionResult> BatchDeleteTemplates([FromQuery] string templateIds)
        {
            try
            {
                // 解析查詢參數中的 templateIds
                var ids = templateIds?.Split(',')
                    .Where(id => !string.IsNullOrEmpty(id))
                    .Select(id => Guid.TryParse(id, out var guid) ? guid : Guid.Empty)
                    .Where(id => id != Guid.Empty)
                    .ToList() ?? new List<Guid>();

                _loggingService.LogInformation($"🗑️ [BatchDeleteTemplates] 批量刪除模板 - 數量: {ids.Count}");

                if (!ids.Any())
                {
                    return BadRequest(new { error = "請提供要刪除的模板 ID 列表" });
                }

                // 獲取當前用戶ID和公司ID
                var userIdClaim = User.FindFirst("user_id");
                if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out Guid userId))
                {
                    _loggingService.LogWarning("❌ [BatchDeleteTemplates] 無法識別當前用戶");
                    return Unauthorized(new { error = "無法識別當前用戶" });
                }

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("❌ [BatchDeleteTemplates] 無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                // 修復：根據公司ID過濾模板
                var templatesToDelete = await _context.WhatsAppTemplates
                    .Where(t => ids.Contains(t.Id) && t.CompanyId == companyId.Value)
                    .ToListAsync();

                if (!templatesToDelete.Any())
                {
                    return NotFound(new { error = "未找到要刪除的模板或無權限訪問" });
                }

                // 軟刪除：設置 IsDeleted 標記和更新信息
                foreach (var template in templatesToDelete)
                {
                    template.IsDeleted = true;
                    template.UpdatedAt = DateTime.UtcNow;
                    template.UpdatedBy = userId.ToString();  // 新增：設置更新用戶ID
                }

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"✅ [BatchDeleteTemplates] 成功刪除 {templatesToDelete.Count} 個模板，用戶ID: {userId}, 公司ID: {companyId.Value}");

                return Ok(new { 
                    success = true, 
                    deletedCount = templatesToDelete.Count,
                    message = $"成功刪除 {templatesToDelete.Count} 個模板"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [BatchDeleteTemplates] 批量刪除失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
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
                // 獲取當前用戶ID和公司ID
                var userIdClaim = User.FindFirst("user_id");
                if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out Guid userId))
                {
                    _loggingService.LogWarning("❌ [DeleteTemplate] 無法識別當前用戶");
                    return Unauthorized(new { error = "無法識別當前用戶" });
                }

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("❌ [DeleteTemplate] 無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                // 修復：根據公司ID查找模板
                var template = await _context.WhatsAppTemplates
                    .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == companyId.Value);
            
                if (template == null)
                {
                    _loggingService.LogWarning($"❌ [DeleteTemplate] 模板不存在或無權限訪問: {id}");
                    return NotFound(new { error = "模板不存在或無權限訪問" });
                }

                // 軟刪除
                template.IsDeleted = true;
                template.UpdatedAt = DateTime.UtcNow;
                template.UpdatedBy = userId.ToString();  // 新增：設置更新用戶ID
                
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"✅ [DeleteTemplate] 成功刪除模板: {template.Name}, 用戶ID: {userId}, 公司ID: {companyId.Value}");

                return Ok(new { success = true, message = "模板刪除成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [DeleteTemplate] 刪除失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
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

                return Ok(categories);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [GetCategories] 獲取分類失敗: {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// 獲取模板統計數據（按類型分組）
        /// </summary>
        [HttpGet("statistics")]
        public async Task<IActionResult> GetTemplateStatistics()
        {
            try
            {
                _loggingService.LogInformation("📊 [GetTemplateStatistics] 開始獲取模板統計數據");

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("❌ [GetTemplateStatistics] 無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                // 按模板類型統計
                var typeStats = await _context.WhatsAppTemplates
                    .Where(t => t.CompanyId == companyId.Value && !t.IsDeleted)
                    .GroupBy(t => t.TemplateType)
                    .Select(g => new
                    {
                        Type = g.Key,
                        Count = g.Count(),
                        ActiveCount = g.Count(t => t.Status == "Active"),
                        InactiveCount = g.Count(t => t.Status == "Inactive"),
                        DraftCount = g.Count(t => t.Status == "Draft")
                    })
                    .OrderBy(s => s.Type)
                    .ToListAsync();

                // 總計統計
                var totalStats = await _context.WhatsAppTemplates
                    .Where(t => t.CompanyId == companyId.Value && !t.IsDeleted)
                    .GroupBy(t => 1)
                    .Select(g => new
                    {
                        Total = g.Count(),
                        Active = g.Count(t => t.Status == "Active"),
                        Inactive = g.Count(t => t.Status == "Inactive"),
                        Draft = g.Count(t => t.Status == "Draft")
                    })
                    .FirstOrDefaultAsync();

                var result = new
                {
                    total = totalStats?.Total ?? 0,
                    active = totalStats?.Active ?? 0,
                    inactive = totalStats?.Inactive ?? 0,
                    draft = totalStats?.Draft ?? 0,
                    byType = typeStats.ToDictionary(
                        s => s.Type,
                        s => new
                        {
                            count = s.Count,
                            active = s.ActiveCount,
                            inactive = s.InactiveCount,
                            draft = s.DraftCount
                        }
                    )
                };

                _loggingService.LogInformation($"✅ [GetTemplateStatistics] 成功獲取統計數據: 總計 {result.total} 個模板");
                _loggingService.LogDebug($"📊 [GetTemplateStatistics] 按類型統計: {JsonSerializer.Serialize(result.byType)}");

                return Ok(result);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [GetTemplateStatistics] 獲取統計數據失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取統計數據失敗" });
            }
        }

        /// <summary>
        /// 測試模板渲染
        /// </summary>
        [HttpPost("{id}/test-render")]
        public async Task<IActionResult> TestRenderTemplate(Guid id, [FromBody] Dictionary<string, string> variables)
        {
            try
            {
                var template = await _context.WhatsAppTemplates.FindAsync(id);
                if (template == null)
                {
                    return NotFound(new { error = "模板不存在" });
                }

                // 這裡實現模板渲染邏輯
                var renderedContent = RenderTemplate(template.Content, variables);

                return Ok(new { 
                    originalContent = template.Content,
                    renderedContent = renderedContent,
                    variables = variables
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [TestRenderTemplate] 測試渲染失敗: {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// 渲染模板內容
        /// </summary>
        private string RenderTemplate(string templateContent, Dictionary<string, string> variables)
        {
            if (string.IsNullOrEmpty(templateContent) || variables == null)
                return templateContent;

            var result = templateContent;
            foreach (var variable in variables)
            {
                result = result.Replace($"{{{{{variable.Key}}}}}", variable.Value ?? "");
            }

            return result;
        }
    }
}