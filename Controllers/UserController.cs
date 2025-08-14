using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PurpleRice.Data;
using PurpleRice.Services;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/users")]
    [Authorize]
    public class UserController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;

        public UserController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("UserController");
        }

        [HttpGet("me")]
        public IActionResult GetMe()
        {
            try
            {
                var userId = User.Claims.FirstOrDefault(c => c.Type == "user_id")?.Value;
                if (userId == null)
                {
                    _loggingService.LogWarning("無法從 JWT 中獲取用戶 ID");
                    return Unauthorized();
                }

                var user = _context.Users.FirstOrDefault(u => u.Id.ToString() == userId);
                if (user == null)
                {
                    _loggingService.LogWarning($"找不到用戶，ID: {userId}");
                    return NotFound();
                }

                _loggingService.LogInformation($"成功獲取當前用戶信息: {user.Name}");
                
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
                _loggingService.LogError($"獲取當前用戶信息失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取用戶信息失敗" });
            }
        }

        [HttpPost("avatar")]
        public async Task<IActionResult> UploadAvatar([FromForm] IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    _loggingService.LogWarning("上傳的頭像文件為空");
                    return BadRequest(new { success = false, message = "No file uploaded." });
                }

                var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "avatars");
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                    _loggingService.LogInformation($"創建頭像上傳目錄: {uploadsFolder}");
                }

                var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);
                var filePath = Path.Combine(uploadsFolder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var url = $"/Uploads/avatars/{fileName}";
                _loggingService.LogInformation($"成功上傳頭像: {fileName}");
                
                return Ok(new { success = true, url });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"上傳頭像失敗: {ex.Message}", ex);
                return StatusCode(500, new { success = false, message = "上傳失敗" });
            }
        }

        [HttpPut("me")]
        public async Task<IActionResult> UpdateMe([FromBody] UpdateUserRequest req)
        {
            var userId = User.Claims.FirstOrDefault(c => c.Type == "user_id")?.Value;
            if (userId == null)
                return Unauthorized();

            var user = _context.Users.FirstOrDefault(u => u.Id.ToString() == userId);
            if (user == null)
                return NotFound();

            user.Name = req.Name;
            user.Email = req.Email;
            user.Phone = req.Phone;
            user.Language = req.Language;
            user.Timezone = req.Timezone;
            user.AvatarUrl = req.AvatarUrl;
            if (!string.IsNullOrEmpty(req.PasswordHash))
                user.PasswordHash = req.PasswordHash;

            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "個人資料已更新" });
        }

        public class UpdateUserRequest
        {
            public string Name { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string Phone { get; set; } = string.Empty;
            public string Language { get; set; } = string.Empty;
            public string Timezone { get; set; } = string.Empty;
            public string? AvatarUrl { get; set; } // 改為 nullable
            public string? PasswordHash { get; set; } // 新增
        }
    }
} 