using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PurpleRice.Data;
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

        public UserController(PurpleRiceDbContext context)
        {
            _context = context;
        }

        [HttpGet("me")]
        public IActionResult GetMe()
        {
            var userId = User.Claims.FirstOrDefault(c => c.Type == "user_id")?.Value;
            if (userId == null)
                return Unauthorized();

            var user = _context.Users.FirstOrDefault(u => u.Id.ToString() == userId);
            if (user == null)
                return NotFound();

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

        [HttpPost("avatar")]
        public async Task<IActionResult> UploadAvatar([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { success = false, message = "No file uploaded." });

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "avatars");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(uploadsFolder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var url = $"/Uploads/avatars/{fileName}";
            return Ok(new { success = true, url });
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
            public string Name { get; set; }
            public string Email { get; set; }
            public string Phone { get; set; }
            public string Language { get; set; }
            public string Timezone { get; set; }
            public string? AvatarUrl { get; set; } // 改為 nullable
            public string? PasswordHash { get; set; } // 新增
        }
    }
} 