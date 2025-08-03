using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/companies")]
    public class CompaniesController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        public CompaniesController(PurpleRiceDbContext context) { _context = context; }

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _context.Companies.ToListAsync());

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id)
        {
            var company = await _context.Companies.FindAsync(id);
            return company == null ? NotFound() : Ok(company);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Company company)
        {
            company.Id = Guid.NewGuid();
            company.CreatedAt = DateTime.UtcNow;
            _context.Companies.Add(company);
            await _context.SaveChangesAsync();
            return Ok(company);
        }

        [HttpPost("logo")]
        public async Task<IActionResult> UploadLogo([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { success = false, message = "No file uploaded." });

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "company_logo");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(uploadsFolder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var url = $"/Uploads/company_logo/{fileName}";
            return Ok(new { success = true, url });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] Company company)
        {
            var dbCompany = await _context.Companies.FindAsync(id);
            if (dbCompany == null) return NotFound();
            dbCompany.MasterUserId = company.MasterUserId;
            dbCompany.Name = company.Name;
            dbCompany.Email = company.Email;
            dbCompany.Address = company.Address;
            dbCompany.Phone = company.Phone;
            dbCompany.Website = company.Website;
            dbCompany.WA_API_Key = company.WA_API_Key;
            dbCompany.WA_PhoneNo_ID = company.WA_PhoneNo_ID;
            dbCompany.WA_VerifyToken = company.WA_VerifyToken;
            dbCompany.WA_WebhookToken = company.WA_WebhookToken;
            dbCompany.LogoUrl = company.LogoUrl;
            dbCompany.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(dbCompany);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var dbCompany = await _context.Companies.FindAsync(id);
            if (dbCompany == null) return NotFound();
            _context.Companies.Remove(dbCompany);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}
