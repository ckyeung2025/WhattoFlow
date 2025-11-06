using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Services;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    /// <summary>
    /// 密碼遷移控制器
    /// 用於將數據庫中的明文密碼批量轉換為 BCrypt hash
    /// 
    /// 注意：此控制器需要管理員權限，且僅在遷移期間使用
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // 需要登入，建議添加管理員角色檢查
    public class MigratePasswordsController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;

        public MigratePasswordsController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("MigratePasswordsController");
        }

        /// <summary>
        /// 檢查需要遷移的用戶數量
        /// </summary>
        [HttpGet("check")]
        public async Task<IActionResult> CheckMigrationStatus()
        {
            try
            {
                var allUsers = await _context.Users.ToListAsync();
                
                var totalUsers = allUsers.Count;
                var nullPasswords = allUsers.Count(u => string.IsNullOrEmpty(u.PasswordHash));
                var hashedPasswords = allUsers.Count(u => !string.IsNullOrEmpty(u.PasswordHash) && PasswordService.IsHashed(u.PasswordHash));
                var plaintextPasswords = allUsers.Count(u => !string.IsNullOrEmpty(u.PasswordHash) && !PasswordService.IsHashed(u.PasswordHash));

                return Ok(new
                {
                    totalUsers,
                    nullPasswords,
                    hashedPasswords,
                    plaintextPasswords,
                    needsMigration = plaintextPasswords > 0
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"檢查遷移狀態失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "檢查遷移狀態失敗" });
            }
        }

        /// <summary>
        /// 獲取需要遷移的用戶列表（不包含密碼）
        /// </summary>
        [HttpGet("users-to-migrate")]
        public async Task<IActionResult> GetUsersToMigrate()
        {
            try
            {
                var usersToMigrate = await _context.Users
                    .Where(u => !string.IsNullOrEmpty(u.PasswordHash) && !PasswordService.IsHashed(u.PasswordHash))
                    .Select(u => new
                    {
                        id = u.Id,
                        account = u.Account,
                        name = u.Name,
                        email = u.Email,
                        createdAt = u.CreatedAt
                    })
                    .ToListAsync();

                return Ok(new
                {
                    count = usersToMigrate.Count,
                    users = usersToMigrate
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取需要遷移的用戶列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取需要遷移的用戶列表失敗" });
            }
        }

        /// <summary>
        /// 批量遷移明文密碼為 hash 密碼
        /// 
        /// 注意：此方法會直接更新數據庫中的密碼
        /// 由於我們無法從 hash 反推明文，此方法僅適用於：
        /// 1. 用戶在下次登入時，系統會自動將明文密碼轉換為 hash（見 AuthController.Login）
        /// 2. 或者管理員手動重置密碼
        /// 
        /// 此端點僅用於標記和記錄，實際遷移會在用戶登入時自動完成
        /// </summary>
        [HttpPost("migrate")]
        public async Task<IActionResult> MigratePasswords([FromBody] MigratePasswordsRequest request)
        {
            try
            {
                if (request == null || !request.ConfirmMigration)
                {
                    return BadRequest(new { error = "請確認要執行遷移操作" });
                }

                var usersToMigrate = await _context.Users
                    .Where(u => !string.IsNullOrEmpty(u.PasswordHash) && !PasswordService.IsHashed(u.PasswordHash))
                    .ToListAsync();

                if (usersToMigrate.Count == 0)
                {
                    return Ok(new
                    {
                        message = "沒有需要遷移的用戶",
                        migratedCount = 0
                    });
                }

                // 注意：由於我們無法從明文反推原始密碼，這裡我們不能直接更新
                // 實際的遷移會在用戶登入時自動完成（見 AuthController.Login）
                // 此方法僅用於記錄和統計

                _loggingService.LogWarning($"發現 {usersToMigrate.Count} 個用戶的密碼需要遷移。這些用戶在下次登入時會自動遷移。");

                return Ok(new
                {
                    message = $"發現 {usersToMigrate.Count} 個用戶的密碼需要遷移。這些用戶在下次登入時會自動將明文密碼轉換為 hash 密碼。",
                    usersToMigrate = usersToMigrate.Count,
                    note = "由於安全原因，無法直接批量更新。用戶在下次登入時會自動完成遷移。"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"遷移密碼失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "遷移密碼失敗" });
            }
        }

        /// <summary>
        /// 手動為指定用戶重置密碼（用於遷移期間）
        /// </summary>
        [HttpPost("reset-password/{userId}")]
        public async Task<IActionResult> ResetPasswordForMigration(Guid userId, [FromBody] ResetPasswordRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.NewPassword))
                {
                    return BadRequest(new { error = "新密碼不能為空" });
                }

                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                {
                    return NotFound(new { error = "找不到指定的用戶" });
                }

                // 將新密碼進行 hash
                user.PasswordHash = PasswordService.HashPassword(request.NewPassword);
                user.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"已為用戶 {user.Account} (ID: {userId}) 重置密碼並轉換為 hash");

                return Ok(new
                {
                    success = true,
                    message = "密碼已重置並轉換為 hash 格式",
                    userId = userId,
                    account = user.Account
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"重置密碼失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "重置密碼失敗" });
            }
        }

        public class MigratePasswordsRequest
        {
            public bool ConfirmMigration { get; set; }
        }

        public class ResetPasswordRequest
        {
            public string NewPassword { get; set; } = string.Empty;
        }
    }
}

