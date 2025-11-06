using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System.IO;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/users")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        
        public UsersController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("UsersController");
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var users = await _context.Users.ToListAsync();
                _loggingService.LogInformation($"成功獲取 {users.Count} 個用戶");
                return Ok(users);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取用戶列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取用戶列表失敗" });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id)
        {
            try
            {
                var user = await _context.Users.FindAsync(id);
                if (user == null)
                {
                    _loggingService.LogWarning($"找不到用戶，ID: {id}");
                    return NotFound();
                }
                
                _loggingService.LogInformation($"成功獲取用戶: {user.Name}");
                return Ok(user);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取用戶詳情失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取用戶詳情失敗" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] User user)
        {
            try
            {
                user.Id = Guid.NewGuid();
                user.CreatedAt = DateTime.UtcNow;
                user.UpdatedAt = DateTime.UtcNow; // 設置 UpdatedAt，因為數據庫不允許 NULL
                
                // 如果提供了密碼，則進行 hash
                if (!string.IsNullOrEmpty(user.PasswordHash))
                {
                    // 如果傳入的密碼不是已經 hash 的格式，則進行 hash
                    if (!PasswordService.IsHashed(user.PasswordHash))
                    {
                        user.PasswordHash = PasswordService.HashPassword(user.PasswordHash);
                    }
                    // 如果已經是 hash 格式，直接使用（不建議，但為了兼容性保留）
                }
                
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
                
                _loggingService.LogInformation($"成功創建用戶: {user.Name}");
                return Ok(user);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"創建用戶失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "創建用戶失敗" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] User user)
        {
            try
            {
                var existingUser = await _context.Users.FindAsync(id);
                if (existingUser == null)
                {
                    _loggingService.LogWarning($"找不到要更新的用戶，ID: {id}");
                    return NotFound();
                }

                // 只更新允許修改的字段
                existingUser.Email = user.Email;
                existingUser.IsActive = user.IsActive;
                existingUser.AvatarUrl = user.AvatarUrl;
                existingUser.Timezone = user.Timezone;
                existingUser.Name = user.Name;
                existingUser.Phone = user.Phone;
                existingUser.Language = user.Language;
                // 如果提供了密碼，則更新密碼
                if (!string.IsNullOrEmpty(user.PasswordHash))
                {
                    // 如果傳入的密碼不是已經 hash 的格式，則進行 hash
                    if (!PasswordService.IsHashed(user.PasswordHash))
                    {
                        existingUser.PasswordHash = PasswordService.HashPassword(user.PasswordHash);
                    }
                    else
                    {
                        // 如果已經是 hash 格式，直接使用（不建議，但為了兼容性保留）
                        existingUser.PasswordHash = user.PasswordHash;
                    }
                }
                existingUser.UpdatedAt = DateTime.UtcNow;
                
                await _context.SaveChangesAsync();
                
                _loggingService.LogInformation($"成功更新用戶: {existingUser.Name}");
                return Ok(existingUser);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新用戶失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "更新用戶失敗" });
            }
        }

        [HttpPatch("{id}/active")]
        public async Task<IActionResult> UpdateActive(Guid id, [FromBody] bool isActive)
        {
            try
            {
                var user = await _context.Users.FindAsync(id);
                if (user == null)
                {
                    _loggingService.LogWarning($"找不到要更新狀態的用戶，ID: {id}");
                    return NotFound();
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


        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var user = await _context.Users.FindAsync(id);
                if (user == null)
                {
                    _loggingService.LogWarning($"找不到要刪除的用戶，ID: {id}");
                    return NotFound();
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