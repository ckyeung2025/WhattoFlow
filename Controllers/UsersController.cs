using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/users")]
    public class UsersController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        public UsersController(PurpleRiceDbContext context) { _context = context; }

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _context.Users.ToListAsync());

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            return user == null ? NotFound() : Ok(user);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] User user)
        {
            user.Id = Guid.NewGuid();
            user.CreatedAt = DateTime.UtcNow;
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return Ok(user);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] User user)
        {
            var dbUser = await _context.Users.FindAsync(id);
            if (dbUser == null) return NotFound();
            dbUser.CompanyId = user.CompanyId;
            dbUser.Account = user.Account;
            dbUser.Email = user.Email;
            dbUser.GoogleId = user.GoogleId;
            dbUser.PasswordHash = user.PasswordHash;
            dbUser.IsActive = user.IsActive;
            dbUser.IsOwner = user.IsOwner;
            dbUser.AvatarUrl = user.AvatarUrl;
            dbUser.Timezone = user.Timezone;
            dbUser.Name = user.Name;
            dbUser.Phone = user.Phone;
            dbUser.Language = user.Language;
            dbUser.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(dbUser);
        }

        [HttpPatch("{id}/active")]
        public async Task<IActionResult> UpdateActive(Guid id, [FromBody] bool isActive)
        {
            var dbUser = await _context.Users.FindAsync(id);
            if (dbUser == null) return NotFound();
            dbUser.IsActive = isActive;
            dbUser.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { id = dbUser.Id, is_active = dbUser.IsActive });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var dbUser = await _context.Users.FindAsync(id);
            if (dbUser == null) return NotFound();
            _context.Users.Remove(dbUser);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
} 