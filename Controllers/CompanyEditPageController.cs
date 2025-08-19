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
    public class CompanyEditPageController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;

        public CompanyEditPageController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("CompanyEditPageController");
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetCompany(Guid id)
        {
            try
            {
                _loggingService.LogInformation($"獲取公司信息 - ID: {id}");

                var company = await _context.Companies.FindAsync(id);
                if (company == null)
                {
                    _loggingService.LogWarning($"找不到公司，ID: {id}");
                    return NotFound(new { error = "公司不存在" });
                }

                _loggingService.LogInformation($"成功獲取公司信息: {company.Name}");
                return Ok(company);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取公司信息失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取公司信息失敗" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCompany(Guid id, [FromBody] Company company)
        {
            try
            {
                _loggingService.LogInformation($"更新公司信息 - ID: {id}");

                var existingCompany = await _context.Companies.FindAsync(id);
                if (existingCompany == null)
                {
                    _loggingService.LogWarning($"找不到要更新的公司，ID: {id}");
                    return NotFound(new { error = "公司不存在" });
                }

                // 更新公司信息
                existingCompany.Name = company.Name;
                existingCompany.Description = company.Description;
                existingCompany.Address = company.Address;
                existingCompany.Phone = company.Phone;
                existingCompany.Email = company.Email;
                existingCompany.Website = company.Website;
                existingCompany.WA_API_Key = company.WA_API_Key;
                existingCompany.WA_PhoneNo_ID = company.WA_PhoneNo_ID;
                existingCompany.WA_VerifyToken = company.WA_VerifyToken;
                existingCompany.WA_WebhookToken = company.WA_WebhookToken;
                existingCompany.LogoUrl = company.LogoUrl;
                existingCompany.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功更新公司信息: {existingCompany.Name}");
                return Ok(existingCompany);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新公司信息失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "更新公司信息失敗" });
            }
        }

        [HttpPost("{id}/logo")]
        public async Task<IActionResult> UploadLogo(Guid id, [FromForm] IFormFile file)
        {
            try
            {
                _loggingService.LogInformation($"上傳公司標誌 - 公司ID: {id}");

                if (file == null || file.Length == 0)
                {
                    _loggingService.LogWarning("上傳的文件為空");
                    return BadRequest(new { success = false, message = "No file uploaded." });
                }

                var company = await _context.Companies.FindAsync(id);
                if (company == null)
                {
                    _loggingService.LogWarning($"找不到公司，ID: {id}");
                    return NotFound(new { error = "公司不存在" });
                }

                var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "company_logo");
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                    _loggingService.LogInformation($"創建上傳目錄: {uploadsFolder}");
                }

                var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);
                var filePath = Path.Combine(uploadsFolder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var url = $"/Uploads/company_logo/{fileName}";
                company.LogoUrl = url;
                company.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功上傳公司標誌: {fileName}");
                return Ok(new { success = true, url });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"上傳公司標誌失敗: {ex.Message}", ex);
                return StatusCode(500, new { success = false, message = "上傳失敗" });
            }
        }

        [HttpGet("{id}/users")]
        public async Task<IActionResult> GetCompanyUsers(Guid id)
        {
            try
            {
                _loggingService.LogInformation($"獲取公司用戶列表 - 公司ID: {id}");

                var users = await _context.Users
                    .Where(u => u.CompanyId == id)
                    .Select(u => new
                    {
                        u.Id,
                        u.Name,
                        u.Account,
                        u.Email,
                        u.Phone,
                        u.IsActive,
                        u.IsOwner,
                        u.CreatedAt
                    })
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
    }
}
