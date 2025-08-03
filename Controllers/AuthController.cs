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
        public AuthController(PurpleRiceDbContext context)
        {
            _context = context;
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
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Account == req.Account && u.PasswordHash == req.Password);

                if (user == null)
                    return Unauthorized(new { success = false, message = "帳號或密碼錯誤" });

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
                    claims: claims,
                    expires: DateTime.Now.AddDays(7),
                    signingCredentials: creds);

                var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

                return Ok(new
                {
                    success = true,
                    message = "登入成功",
                    token = tokenString, // 回傳 token 給前端
                    user_id = user.Id,
                    account = user.Account,
                    name = user.Name,
                    email = user.Email,
                    phone = user.Phone,
                    language = user.Language,
                    timezone = user.Timezone,
                    avatar_url = user.AvatarUrl,
                    company_id = user.CompanyId // 添加 company_id
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Login Error] {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, new { success = false, message = "Server error: " + ex.Message });
            }
        }
    }
} 