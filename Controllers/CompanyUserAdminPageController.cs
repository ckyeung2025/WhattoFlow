using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CompanyUserAdminPageController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;

        public CompanyUserAdminPageController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("CompanyUserAdminPageController");
        }

        /// <summary>
        /// 獲取公司用戶統計數據
        /// </summary>
        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics()
        {
            try
            {
                _loggingService.LogInformation("📊 開始獲取公司用戶統計數據");

                // 獲取當前用戶的公司ID
                var currentCompanyId = GetCurrentCompanyId();
                if (currentCompanyId == Guid.Empty)
                {
                    _loggingService.LogWarning("❌ 無法識別用戶公司");
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                _loggingService.LogInformation($"📊 當前用戶公司ID: {currentCompanyId}");

                // 當前公司的用戶數
                var totalUsers = await _context.Users
                    .Where(u => u.CompanyId == currentCompanyId)
                    .CountAsync();

                // 當前公司數（應該是1）
                var totalCompanies = 1;

                // 當前公司的管理員用戶數（IsOwner = true）
                var adminUsers = await _context.Users
                    .Where(u => u.CompanyId == currentCompanyId && u.IsOwner)
                    .CountAsync();

                // 當前公司的活躍用戶數
                var activeUsers = await _context.Users
                    .Where(u => u.CompanyId == currentCompanyId && u.IsActive)
                    .CountAsync();

                var statistics = new
                {
                    totalUsers = totalUsers,
                    activeUsers = activeUsers,
                    adminUsers = adminUsers,
                    totalCompanies = totalCompanies
                };

                _loggingService.LogInformation($"✅ 統計數據: 總用戶={totalUsers}, 活躍用戶={activeUsers}, 管理員={adminUsers}, 總公司={totalCompanies}");
                
                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 獲取統計數據失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = $"獲取統計數據失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 獲取當前用戶的公司ID
        /// </summary>
        private Guid GetCurrentCompanyId()
        {
            try
            {
                var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "user_id")?.Value;
                if (string.IsNullOrEmpty(userIdClaim))
                {
                    _loggingService.LogWarning("❌ 無法從 JWT token 中獲取用戶ID");
                    return Guid.Empty;
                }

                var userId = Guid.Parse(userIdClaim);
                var user = _context.Users.FirstOrDefault(u => u.Id == userId);
                
                if (user == null)
                {
                    _loggingService.LogWarning($"❌ 找不到用戶，ID: {userId}");
                    return Guid.Empty;
                }

                _loggingService.LogInformation($"✅ 找到用戶: {user.Name}, 公司ID: {user.CompanyId}");
                return user.CompanyId;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 獲取當前用戶公司ID失敗: {ex.Message}", ex);
                return Guid.Empty;
            }
        }

        [HttpGet("company/{companyId}")]
        public async Task<IActionResult> GetCompanyUsers(Guid companyId)
        {
            try
            {
                _loggingService.LogInformation($"獲取公司用戶列表 - 公司ID: {companyId}");

                var users = await _context.Users
                    .Where(u => u.CompanyId == companyId)
                    .Select(u => new
                    {
                        u.Id,
                        u.Name,
                        u.Account,
                        u.Email,
                        u.Phone,
                        u.IsActive,
                        u.IsOwner,
                        u.CreatedAt,
                        u.UpdatedAt
                    })
                    .OrderBy(u => u.CreatedAt)
                    .ToListAsync();

                _loggingService.LogInformation($"成功獲取公司用戶列表，數量: {users.Count}");
                return Ok(users);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取公司用戶列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取公司用戶列表失敗" });
            }
        }

        [HttpPost("company/{companyId}")]
        public async Task<IActionResult> CreateUser(Guid companyId, [FromBody] User user)
        {
            try
            {
                _loggingService.LogInformation($"創建新用戶 - 公司ID: {companyId}, 用戶名: {user.Name}");

                // 檢查用戶名是否已存在
                var existingUser = await _context.Users
                    .FirstOrDefaultAsync(u => u.Account == user.Account && u.CompanyId == companyId);

                if (existingUser != null)
                {
                    _loggingService.LogWarning($"用戶名已存在: {user.Account}");
                    return BadRequest(new { error = "用戶名已存在" });
                }

                user.Id = Guid.NewGuid();
                user.CompanyId = companyId;
                user.CreatedAt = DateTime.UtcNow;
                user.UpdatedAt = DateTime.UtcNow;
                user.IsActive = true;
                user.IsOwner = false;

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功創建用戶: {user.Name}");
                return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"創建用戶失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "創建用戶失敗" });
            }
        }

        [HttpGet("user/{id}")]
        public async Task<IActionResult> GetUser(Guid id)
        {
            try
            {
                _loggingService.LogInformation($"獲取用戶詳情 - ID: {id}");

                var user = await _context.Users.FindAsync(id);
                if (user == null)
                {
                    _loggingService.LogWarning($"找不到用戶，ID: {id}");
                    return NotFound(new { error = "用戶不存在" });
                }

                _loggingService.LogInformation($"成功獲取用戶詳情: {user.Name}");
                return Ok(user);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取用戶詳情失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取用戶詳情失敗" });
            }
        }

        [HttpPut("user/{id}")]
        public async Task<IActionResult> UpdateUser(Guid id, [FromBody] User user)
        {
            try
            {
                _loggingService.LogInformation($"更新用戶信息 - ID: {id}");

                var existingUser = await _context.Users.FindAsync(id);
                if (existingUser == null)
                {
                    _loggingService.LogWarning($"找不到要更新的用戶，ID: {id}");
                    return NotFound(new { error = "用戶不存在" });
                }

                // 更新用戶信息
                existingUser.Name = user.Name;
                existingUser.Email = user.Email;
                existingUser.Phone = user.Phone;
                existingUser.Language = user.Language;
                existingUser.Timezone = user.Timezone;
                existingUser.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功更新用戶信息: {existingUser.Name}");
                return Ok(existingUser);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新用戶信息失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "更新用戶信息失敗" });
            }
        }

        [HttpPatch("user/{id}/status")]
        public async Task<IActionResult> UpdateUserStatus(Guid id, [FromBody] bool isActive)
        {
            try
            {
                _loggingService.LogInformation($"更新用戶狀態 - ID: {id}, 狀態: {(isActive ? "啟用" : "停用")}");

                var user = await _context.Users.FindAsync(id);
                if (user == null)
                {
                    _loggingService.LogWarning($"找不到要更新狀態的用戶，ID: {id}");
                    return NotFound(new { error = "用戶不存在" });
                }

                user.IsActive = isActive;
                user.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功更新用戶 {user.Name} 的狀態為: {(isActive ? "啟用" : "停用")}");
                return Ok(new { success = true, message = $"用戶狀態已更新為 {(isActive ? "啟用" : "停用")}" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新用戶狀態失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "更新用戶狀態失敗" });
            }
        }

        [HttpDelete("user/{id}")]
        public async Task<IActionResult> DeleteUser(Guid id)
        {
            try
            {
                _loggingService.LogInformation($"刪除用戶 - ID: {id}");

                var user = await _context.Users.FindAsync(id);
                if (user == null)
                {
                    _loggingService.LogWarning($"找不到要刪除的用戶，ID: {id}");
                    return NotFound(new { error = "用戶不存在" });
                }

                if (user.IsOwner)
                {
                    _loggingService.LogWarning($"無法刪除公司擁有者: {user.Name}");
                    return BadRequest(new { error = "無法刪除公司擁有者" });
                }

                _context.Users.Remove(user);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功刪除用戶: {user.Name}");
                return NoContent();
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"刪除用戶失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "刪除用戶失敗" });
            }
        }
    }
}
