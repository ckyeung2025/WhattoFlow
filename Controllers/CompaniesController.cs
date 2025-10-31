using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/companies")]
    public class CompaniesController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        
        public CompaniesController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("CompaniesController");
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var companies = await _context.Companies.ToListAsync();
                _loggingService.LogInformation($"成功獲取 {companies.Count} 個公司");
                return Ok(companies);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取公司列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取公司列表失敗" });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id)
        {
            try
            {
                var company = await _context.Companies.FindAsync(id);
                if (company == null)
                {
                    _loggingService.LogWarning($"找不到公司，ID: {id}");
                    return NotFound();
                }
                
                _loggingService.LogInformation($"成功獲取公司: {company.Name}");
                return Ok(company);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取公司詳情失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取公司詳情失敗" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Company company)
        {
            try
            {
                company.Id = Guid.NewGuid();
                company.CreatedAt = DateTime.UtcNow;
                _context.Companies.Add(company);
                await _context.SaveChangesAsync();
                
                _loggingService.LogInformation($"成功創建公司: {company.Name}");
                return Ok(company);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"創建公司失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "創建公司失敗" });
            }
        }

        [HttpPost("logo")]
        public async Task<IActionResult> UploadLogo([FromForm] IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    _loggingService.LogWarning("上傳的文件為空");
                    return BadRequest(new { success = false, message = "No file uploaded." });
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
                _loggingService.LogInformation($"成功上傳公司標誌: {fileName}");
                
                return Ok(new { success = true, url });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"上傳公司標誌失敗: {ex.Message}", ex);
                return StatusCode(500, new { success = false, message = "上傳失敗" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] Company company)
        {
            try
            {
                var existingCompany = await _context.Companies.FindAsync(id);
                if (existingCompany == null)
                {
                    _loggingService.LogWarning($"找不到要更新的公司，ID: {id}");
                    return NotFound();
                }

                existingCompany.Name = company.Name;
                existingCompany.Description = company.Description;
                existingCompany.Address = company.Address;
                existingCompany.Phone = company.Phone;
                existingCompany.Email = company.Email;
                existingCompany.Website = company.Website;
                
                // 更新 WhatsApp 相關字段
                existingCompany.WA_API_Key = company.WA_API_Key;
                existingCompany.WA_PhoneNo_ID = company.WA_PhoneNo_ID;
                existingCompany.WA_Business_Account_ID = company.WA_Business_Account_ID;  // 添加這行
                existingCompany.WA_VerifyToken = company.WA_VerifyToken;
                existingCompany.WA_WebhookToken = company.WA_WebhookToken;
                
                // 更新 WhatsApp 菜單設置
                existingCompany.WA_WelcomeMessage = company.WA_WelcomeMessage;
                existingCompany.WA_NoFunctionMessage = company.WA_NoFunctionMessage;
                existingCompany.WA_MenuTitle = company.WA_MenuTitle;
                existingCompany.WA_MenuFooter = company.WA_MenuFooter;
                existingCompany.WA_MenuButton = company.WA_MenuButton;
                existingCompany.WA_SectionTitle = company.WA_SectionTitle;
                existingCompany.WA_DefaultOptionDescription = company.WA_DefaultOptionDescription;
                existingCompany.WA_InputErrorMessage = company.WA_InputErrorMessage;
                existingCompany.WA_FallbackMessage = company.WA_FallbackMessage;
                existingCompany.WA_SystemErrorMessage = company.WA_SystemErrorMessage;
                
                // 更新標誌 URL
                existingCompany.LogoUrl = company.LogoUrl;
                
                existingCompany.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                
                _loggingService.LogInformation($"成功更新公司: {existingCompany.Name}");
                return Ok(existingCompany);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新公司失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "更新公司失敗" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var company = await _context.Companies.FindAsync(id);
                if (company == null)
                {
                    _loggingService.LogWarning($"找不到要刪除的公司，ID: {id}");
                    return NotFound();
                }

                _context.Companies.Remove(company);
                await _context.SaveChangesAsync();
                
                _loggingService.LogInformation($"成功刪除公司: {company.Name}");
                return NoContent();
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"刪除公司失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "刪除公司失敗" });
            }
        }
    }
}
