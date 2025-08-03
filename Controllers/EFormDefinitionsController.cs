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

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/eforms")]
    public class EFormDefinitionsController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        
        public EFormDefinitionsController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory) 
        { 
            _context = context; 
            _loggingService = loggingServiceFactory("EFormDefinitionsController");
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
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var query = _context.eFormDefinitions
                    .Where(f => f.CompanyId == companyId.Value)
                    .AsQueryable();

                // 處理排序
                switch (sortField?.ToLower())
                {
                    case "name":
                        query = sortOrder?.ToLower() == "asc" 
                            ? query.OrderBy(x => x.Name) 
                            : query.OrderByDescending(x => x.Name);
                        break;
                    case "status":
                        query = sortOrder?.ToLower() == "asc" 
                            ? query.OrderBy(x => x.Status) 
                            : query.OrderByDescending(x => x.Status);
                        break;
                    case "created_at":
                    case "createdat":
                        query = sortOrder?.ToLower() == "asc" 
                            ? query.OrderBy(x => x.CreatedAt) 
                            : query.OrderByDescending(x => x.CreatedAt);
                        break;
                    case "updated_at":
                    case "updatedat":
                        query = sortOrder?.ToLower() == "asc" 
                            ? query.OrderBy(x => x.UpdatedAt) 
                            : query.OrderByDescending(x => x.UpdatedAt);
                        break;
                    default:
                        query = query.OrderByDescending(x => x.CreatedAt);
                        break;
                }

                // 計算總數
                var total = await query.CountAsync();

                // 分頁
                var items = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                return Ok(new
                {
                    data = items,
                    total = total,
                    page = page,
                    pageSize = pageSize,
                    sortField = sortField,
                    sortOrder = sortOrder
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"獲取表單列表失敗: {ex.Message}" });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var form = await _context.eFormDefinitions
                .Where(f => f.Id == id && f.CompanyId == companyId.Value)
                .FirstOrDefaultAsync();
            
            return form == null ? NotFound() : Ok(form);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] eFormDefinition form)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            form.Id = Guid.NewGuid();
            form.CompanyId = companyId.Value; // 設置為當前用戶的公司ID
            if (form.CreatedAt == null) form.CreatedAt = DateTime.UtcNow;
            if (form.CreatedUserId == null) form.CreatedUserId = Guid.NewGuid(); // 臨時處理
            if (form.UpdatedUserId == null) form.UpdatedUserId = form.CreatedUserId;
            if (string.IsNullOrEmpty(form.Status)) form.Status = "A";
            if (string.IsNullOrEmpty(form.RStatus)) form.RStatus = "A";
            _context.eFormDefinitions.Add(form);
            await _context.SaveChangesAsync();
            return Ok(form);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] eFormDefinition form)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var dbForm = await _context.eFormDefinitions
                .Where(f => f.Id == id && f.CompanyId == companyId.Value)
                .FirstOrDefaultAsync();
            
            if (dbForm == null) return NotFound();
            
            // 添加 null 檢查
            if (!string.IsNullOrEmpty(form.Name)) dbForm.Name = form.Name;
            if (!string.IsNullOrEmpty(form.Description)) dbForm.Description = form.Description;
            if (!string.IsNullOrEmpty(form.HtmlCode)) dbForm.HtmlCode = form.HtmlCode;
            if (!string.IsNullOrEmpty(form.Status)) dbForm.Status = form.Status;
            if (!string.IsNullOrEmpty(form.RStatus)) dbForm.RStatus = form.RStatus;
            dbForm.UpdatedAt = form.UpdatedAt ?? DateTime.UtcNow;
            if (form.UpdatedUserId.HasValue) dbForm.UpdatedUserId = form.UpdatedUserId;
            
            await _context.SaveChangesAsync();
            return Ok(dbForm);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var dbForm = await _context.eFormDefinitions
                .Where(f => f.Id == id && f.CompanyId == companyId.Value)
                .FirstOrDefaultAsync();
            
            if (dbForm == null) return NotFound();
            _context.eFormDefinitions.Remove(dbForm);
            await _context.SaveChangesAsync();
            return Ok();
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