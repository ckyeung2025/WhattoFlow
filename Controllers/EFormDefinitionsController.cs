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
        public async Task<IActionResult> Get(Guid id)
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
                
                if (string.IsNullOrWhiteSpace(form.HtmlCode))
                {
                    _loggingService.LogWarning("表單 HTML 代碼為空");
                    return BadRequest(new { error = "表單 HTML 代碼不能為空" });
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
                existingForm.HtmlCode = form.HtmlCode;
                existingForm.Status = form.Status;
                existingForm.FieldDisplaySettings = form.FieldDisplaySettings; // 新增：更新字段顯示設定
                existingForm.UpdatedAt = DateTime.UtcNow;
                existingForm.UpdatedUserId = userId;    // 新增：設置更新用戶ID
                
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