using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System.Security.Claims;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RolesController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;

        public RolesController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("RolesController");
        }

        /// <summary>
        /// 獲取所有角色
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var roles = await _context.Roles
                    .Where(r => r.IsActive)
                    .Select(r => new
                    {
                        r.Id,
                        r.Name,
                        r.Description,
                        r.IsSystemRole,
                        r.IsActive,
                        r.CreatedAt,
                        r.UpdatedAt
                    })
                    .OrderBy(r => r.Name)
                    .ToListAsync();

                _loggingService.LogInformation($"成功獲取 {roles.Count} 個角色");
                return Ok(roles);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取角色列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取角色列表失敗" });
            }
        }

        /// <summary>
        /// 獲取用戶的角色
        /// </summary>
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserRoles(Guid userId)
        {
            try
            {
                var userRoles = await _context.UserRoles
                    .Where(ur => ur.UserId == userId && ur.IsActive)
                    .Include(ur => ur.Role)
                    .Select(ur => new
                    {
                        ur.Id,
                        RoleId = ur.RoleId,
                        RoleName = ur.Role.Name,
                        ur.AssignedAt,
                        ur.AssignedBy
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"成功獲取用戶 {userId} 的 {userRoles.Count} 個角色");
                return Ok(userRoles);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取用戶角色失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取用戶角色失敗" });
            }
        }

        /// <summary>
        /// 更新用戶角色
        /// </summary>
        [HttpPut("user/{userId}")]
        public async Task<IActionResult> UpdateUserRoles(Guid userId, [FromBody] UpdateUserRolesRequest request)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                if (string.IsNullOrEmpty(currentUserId))
                {
                    return Unauthorized(new { error = "無法識別當前用戶" });
                }

                // 先停用該用戶的所有現有角色
                var existingUserRoles = await _context.UserRoles
                    .Where(ur => ur.UserId == userId)
                    .ToListAsync();

                foreach (var userRole in existingUserRoles)
                {
                    userRole.IsActive = false;
                    userRole.UpdatedAt = DateTime.UtcNow;
                }

                // 添加新角色
                if (request.RoleIds != null && request.RoleIds.Any())
                {
                    foreach (var roleId in request.RoleIds)
                    {
                        // 檢查角色是否存在且有效
                        var role = await _context.Roles
                            .FirstOrDefaultAsync(r => r.Id == roleId && r.IsActive);
                        
                        if (role != null)
                        {
                            // 檢查是否已經存在該角色分配（避免重複）
                            var existingRole = existingUserRoles.FirstOrDefault(ur => ur.RoleId == roleId);
                            if (existingRole != null)
                            {
                                // 重新啟用現有角色
                                existingRole.IsActive = true;
                                existingRole.AssignedAt = DateTime.UtcNow;
                                existingRole.AssignedBy = Guid.Parse(currentUserId);
                                existingRole.UpdatedAt = DateTime.UtcNow;
                            }
                            else
                            {
                                // 創建新的角色分配
                                var newUserRole = new UserRole
                                {
                                    Id = Guid.NewGuid(),
                                    UserId = userId,
                                    RoleId = roleId,
                                    AssignedBy = Guid.Parse(currentUserId),
                                    AssignedAt = DateTime.UtcNow,
                                    IsActive = true,
                                    CreatedAt = DateTime.UtcNow,
                                    UpdatedAt = DateTime.UtcNow
                                };
                                _context.UserRoles.Add(newUserRole);
                            }
                        }
                    }
                }

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功更新用戶 {userId} 的角色");
                return Ok(new { success = true, message = "用戶角色更新成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新用戶角色失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "更新用戶角色失敗" });
            }
        }

        /// <summary>
        /// 移除用戶的特定角色
        /// </summary>
        [HttpDelete("user/{userId}/role/{roleId}")]
        public async Task<IActionResult> RemoveUserRole(Guid userId, Guid roleId)
        {
            try
            {
                var userRole = await _context.UserRoles
                    .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == roleId && ur.IsActive);

                if (userRole == null)
                {
                    return NotFound(new { error = "找不到該角色分配" });
                }

                userRole.IsActive = false;
                userRole.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功移除用戶 {userId} 的角色 {roleId}");
                return Ok(new { success = true, message = "角色移除成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"移除用戶角色失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "移除用戶角色失敗" });
            }
        }

        /// <summary>
        /// 獲取當前用戶ID
        /// </summary>
        private string GetCurrentUserId()
        {
            return User.Claims.FirstOrDefault(c => c.Type == "user_id")?.Value ?? string.Empty;
        }
    }

    /// <summary>
    /// 更新用戶角色請求模型
    /// </summary>
    public class UpdateUserRolesRequest
    {
        public List<Guid> RoleIds { get; set; } = new List<Guid>();
    }

}
