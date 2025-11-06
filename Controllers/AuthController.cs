using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace PurpleRice.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        
        public AuthController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("AuthController");
        }

        public class LoginRequest
        {
            public string Account { get; set; }
            public string Password { get; set; }
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {
            try
            {
                // 先根據帳號查找用戶
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Account == req.Account);

                if (user == null || string.IsNullOrEmpty(user.PasswordHash))
                {
                    _loggingService.LogWarning($"登入失敗：找不到用戶或密碼為空，帳號: {req.Account}");
                    return Unauthorized(new { success = false, message = "帳號或密碼錯誤" });
                }

                // 驗證密碼（支持舊的明文密碼和新的 hash 密碼）
                bool isPasswordValid = PasswordService.VerifyPassword(req.Password, user.PasswordHash);

                if (!isPasswordValid)
                {
                    _loggingService.LogWarning($"登入失敗：密碼錯誤，帳號: {req.Account}");
                    return Unauthorized(new { success = false, message = "帳號或密碼錯誤" });
                }

                // 如果密碼驗證成功，且是舊的明文密碼，則更新為 hash 密碼
                if (!PasswordService.IsHashed(user.PasswordHash))
                {
                    user.PasswordHash = PasswordService.HashPassword(req.Password);
                    user.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    _loggingService.LogInformation($"已將用戶 {user.Account} 的明文密碼更新為 hash 密碼");
                }

                // 產生 JWT token
                var claims = new[]
                {
                    new Claim("user_id", user.Id.ToString()),
                    new Claim("company_id", user.CompanyId.ToString()), // 添加 company_id claim
                    new Claim(ClaimTypes.Name, user.Name ?? "")
                };

                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("YourSuperSecretKey1234567890!@#$%^&*()")); // 32字元以上
                var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

                var token = new JwtSecurityToken(
                    issuer: "PurpleRice",
                    audience: "PurpleRiceUsers",
                    claims: claims,
                    expires: DateTime.Now.AddDays(7),
                    signingCredentials: creds
                );

                var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

                return Ok(new
                {
                    success = true,
                    token = tokenString,
                    user = new
                    {
                        id = user.Id,
                        account = user.Account,
                        name = user.Name,
                        email = user.Email,
                        companyId = user.CompanyId
                    }
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"[Login Error] {ex.Message}", ex);
                return StatusCode(500, new { success = false, message = "登入過程中發生錯誤" });
            }
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetMe()
        {
            try
            {
                var userId = User.Claims.FirstOrDefault(c => c.Type == "user_id")?.Value;
                if (userId == null)
                    return Unauthorized();

                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id.ToString() == userId);
                if (user == null)
                    return NotFound();

                // 獲取用戶的角色
                var userRoles = await _context.UserRoles
                    .Where(ur => ur.UserId == user.Id && ur.IsActive)
                    .Include(ur => ur.Role)
                    .Select(ur => new
                    {
                        name = ur.Role.Name
                    })
                    .ToListAsync();

                return Ok(new
                {
                    user_id = user.Id,
                    account = user.Account,
                    name = user.Name,
                    email = user.Email,
                    phone = user.Phone,
                    language = user.Language,
                    timezone = TimezoneService.GetGMTOffsetString(user.Timezone),
                    avatar_url = user.AvatarUrl,
                    company_id = user.CompanyId,
                    roles = userRoles
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"[GetMe Error] {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取用戶信息時發生錯誤" });
            }
        }

        [HttpPut("me")]
        public async Task<IActionResult> UpdateMe([FromBody] UpdateMeRequest req)
        {
            try
            {
                var userId = User.Claims.FirstOrDefault(c => c.Type == "user_id")?.Value;
                if (userId == null)
                    return Unauthorized();

                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id.ToString() == userId);
                if (user == null)
                    return NotFound();

                // 更新用戶信息
                if (!string.IsNullOrEmpty(req.Name))
                    user.Name = req.Name;
                if (!string.IsNullOrEmpty(req.Email))
                    user.Email = req.Email;
                if (!string.IsNullOrEmpty(req.Phone))
                    user.Phone = req.Phone;
                if (!string.IsNullOrEmpty(req.Language))
                    user.Language = req.Language;
                if (!string.IsNullOrEmpty(req.Timezone))
                    user.Timezone = req.Timezone;
                if (!string.IsNullOrEmpty(req.AvatarUrl))
                    user.AvatarUrl = req.AvatarUrl;
                if (!string.IsNullOrEmpty(req.PasswordHash))
                {
                    // 如果傳入的密碼不是已經 hash 的格式，則進行 hash
                    if (!PasswordService.IsHashed(req.PasswordHash))
                    {
                        user.PasswordHash = PasswordService.HashPassword(req.PasswordHash);
                    }
                    else
                    {
                        // 如果已經是 hash 格式，直接使用（不建議，但為了兼容性保留）
                        user.PasswordHash = req.PasswordHash;
                    }
                }

                user.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"用戶 {user.Name} 更新了個人資料");

                return Ok(new
                {
                    user_id = user.Id,
                    account = user.Account,
                    name = user.Name,
                    email = user.Email,
                    phone = user.Phone,
                    language = user.Language,
                    timezone = user.Timezone,
                    avatar_url = user.AvatarUrl
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"[UpdateMe Error] {ex.Message}", ex);
                return StatusCode(500, new { error = "更新用戶信息時發生錯誤" });
            }
        }
    }

    public class UpdateMeRequest
    {
        public string? Name { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? Language { get; set; }
        public string? Timezone { get; set; }
        public string? AvatarUrl { get; set; }
        public string? PasswordHash { get; set; }
    }
} 