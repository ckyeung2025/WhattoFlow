using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System.Linq.Expressions;

namespace PurpleRice.Services
{
    public class ContactListService
    {
        private readonly PurpleRiceDbContext _context;
        private readonly ILogger<ContactListService> _logger;

        public ContactListService(PurpleRiceDbContext context, ILogger<ContactListService> logger)
        {
            _context = context;
            _logger = logger;
        }

        #region 聯絡人管理

        /// <summary>
        /// 獲取聯絡人列表
        /// </summary>
        public async Task<(List<ContactList> contacts, int totalCount)> GetContactsAsync(
            Guid companyId, 
            int page = 1, 
            int pageSize = 20, 
            string? search = null, 
            Guid? broadcastGroupId = null, 
            string? hashtagFilter = null)
        {
            var query = _context.ContactLists
                .Where(c => c.CompanyId == companyId && c.IsActive)
                .AsQueryable();

            // 搜尋條件
            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(c => 
                    c.Name.Contains(search) ||
                    c.Email.Contains(search) ||
                    c.WhatsAppNumber.Contains(search) ||
                    c.CompanyName.Contains(search) ||
                    c.Department.Contains(search) ||
                    c.Position.Contains(search));
            }

            // 群組篩選
            if (broadcastGroupId.HasValue)
            {
                query = query.Where(c => c.BroadcastGroupId == broadcastGroupId.Value);
            }

            // 標籤篩選
            if (!string.IsNullOrEmpty(hashtagFilter))
            {
                var hashtags = hashtagFilter.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(h => h.Trim()).ToList();
                
                query = query.Where(c => hashtags.Any(h => c.Hashtags.Contains(h)));
            }

            var totalCount = await query.CountAsync();
            
            var contacts = await query
                .OrderBy(c => c.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (contacts, totalCount);
        }

        /// <summary>
        /// 獲取單一聯絡人
        /// </summary>
        public async Task<ContactList?> GetContactAsync(Guid id, Guid companyId)
        {
            return await _context.ContactLists
                .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId);
        }

        /// <summary>
        /// 創建聯絡人
        /// </summary>
        public async Task<ContactList> CreateContactAsync(ContactList contact, string createdBy)
        {
            _logger.LogInformation("CreateContactAsync called with contact: {ContactData}", System.Text.Json.JsonSerializer.Serialize(contact));
            _logger.LogInformation("CreatedBy parameter: {CreatedBy}", createdBy);
            
            contact.Id = Guid.NewGuid();
            contact.CreatedAt = DateTime.UtcNow;
            contact.CreatedBy = createdBy;
            contact.IsActive = true;

            _logger.LogInformation("Contact before adding to context: {ContactData}", System.Text.Json.JsonSerializer.Serialize(contact));

            _context.ContactLists.Add(contact);
            
            try
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation("聯絡人 {ContactName} 已創建，ID: {ContactId}", contact.Name, contact.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SaveChangesAsync failed: {Message}", ex.Message);
                _logger.LogError(ex, "Inner exception: {InnerException}", ex.InnerException?.Message);
                throw;
            }
            
            return contact;
        }

        /// <summary>
        /// 更新聯絡人
        /// </summary>
        public async Task<ContactList?> UpdateContactAsync(Guid id, ContactList updatedContact, string updatedBy)
        {
            var existingContact = await _context.ContactLists
                .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == updatedContact.CompanyId);

            if (existingContact == null)
                return null;

            // 更新欄位
            existingContact.Name = updatedContact.Name;
            existingContact.Title = updatedContact.Title;
            existingContact.Occupation = updatedContact.Occupation;
            existingContact.WhatsAppNumber = updatedContact.WhatsAppNumber;
            existingContact.Email = updatedContact.Email;
            existingContact.CompanyName = updatedContact.CompanyName;
            existingContact.Department = updatedContact.Department;
            existingContact.Position = updatedContact.Position;
            existingContact.Hashtags = updatedContact.Hashtags;
            existingContact.BroadcastGroupId = updatedContact.BroadcastGroupId;
            existingContact.UpdatedAt = DateTime.UtcNow;
            existingContact.UpdatedBy = updatedBy;
            
            // 確保 CreatedBy 有值（更新時不應該修改，但驗證需要）
            if (string.IsNullOrEmpty(existingContact.CreatedBy))
            {
                existingContact.CreatedBy = updatedBy; // 如果沒有值，使用當前用戶
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("聯絡人 {ContactName} 已更新，ID: {ContactId}", existingContact.Name, existingContact.Id);
            return existingContact;
        }

        /// <summary>
        /// 刪除聯絡人（軟刪除）
        /// </summary>
        public async Task<bool> DeleteContactAsync(Guid id, Guid companyId, string deletedBy)
        {
            var contact = await _context.ContactLists
                .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId);

            if (contact == null)
                return false;

            contact.IsActive = false;
            contact.UpdatedAt = DateTime.UtcNow;
            contact.UpdatedBy = deletedBy;

            await _context.SaveChangesAsync();

            _logger.LogInformation("聯絡人 {ContactName} 已刪除，ID: {ContactId}", contact.Name, contact.Id);
            return true;
        }

        /// <summary>
        /// 批量匯入聯絡人
        /// </summary>
        public async Task<(int successCount, int failCount, List<string> errors)> ImportContactsAsync(
            List<ContactList> contacts, 
            Guid companyId, 
            string createdBy)
        {
            var successCount = 0;
            var failCount = 0;
            var errors = new List<string>();

            foreach (var contact in contacts)
            {
                try
                {
                    contact.CompanyId = companyId;
                    contact.CreatedBy = createdBy;
                    contact.CreatedAt = DateTime.UtcNow;
                    contact.IsActive = true;

                    _context.ContactLists.Add(contact);
                    successCount++;
                }
                catch (Exception ex)
                {
                    failCount++;
                    errors.Add($"聯絡人 {contact.Name} 匯入失敗: {ex.Message}");
                    _logger.LogError(ex, "匯入聯絡人失敗: {ContactName}", contact.Name);
                }
            }

            if (successCount > 0)
            {
                await _context.SaveChangesAsync();
            }

            return (successCount, failCount, errors);
        }

        #endregion

        #region 廣播群組管理

        /// <summary>
        /// 獲取廣播群組列表
        /// </summary>
        public async Task<List<BroadcastGroup>> GetBroadcastGroupsAsync(Guid companyId)
        {
            return await _context.BroadcastGroups
                .Where(bg => bg.CompanyId == companyId && bg.IsActive)
                .OrderBy(bg => bg.Name)
                .ToListAsync();
        }

        /// <summary>
        /// 創建廣播群組
        /// </summary>
        public async Task<BroadcastGroup> CreateBroadcastGroupAsync(BroadcastGroup group, string createdBy)
        {
            group.Id = Guid.NewGuid();
            group.CreatedAt = DateTime.UtcNow;
            group.CreatedBy = createdBy;
            group.IsActive = true;

            _context.BroadcastGroups.Add(group);
            await _context.SaveChangesAsync();

            _logger.LogInformation("廣播群組 {GroupName} 已創建，ID: {GroupId}", group.Name, group.Id);
            return group;
        }

        /// <summary>
        /// 更新廣播群組
        /// </summary>
        public async Task<BroadcastGroup?> UpdateBroadcastGroupAsync(Guid id, BroadcastGroup updatedGroup, string updatedBy)
        {
            var existingGroup = await _context.BroadcastGroups
                .FirstOrDefaultAsync(bg => bg.Id == id);

            if (existingGroup == null)
                return null;

            existingGroup.Name = updatedGroup.Name;
            existingGroup.Description = updatedGroup.Description;
            existingGroup.Color = updatedGroup.Color;
            existingGroup.UpdatedAt = DateTime.UtcNow;
            existingGroup.UpdatedBy = updatedBy;

            await _context.SaveChangesAsync();

            _logger.LogInformation("廣播群組 {GroupName} 已更新，ID: {GroupId}", existingGroup.Name, existingGroup.Id);
            return existingGroup;
        }

        /// <summary>
        /// 刪除廣播群組
        /// </summary>
        public async Task<bool> DeleteBroadcastGroupAsync(Guid id, Guid companyId, string deletedBy)
        {
            var group = await _context.BroadcastGroups
                .FirstOrDefaultAsync(bg => bg.Id == id && bg.CompanyId == companyId);

            if (group == null)
                return false;

            // 檢查是否有聯絡人使用此群組
            var hasContacts = await _context.ContactLists
                .AnyAsync(c => c.BroadcastGroupId == id && c.IsActive);

            if (hasContacts)
            {
                _logger.LogWarning("無法刪除群組 {GroupName}，仍有聯絡人使用此群組", group.Name);
                return false;
            }

            group.IsActive = false;
            group.UpdatedAt = DateTime.UtcNow;
            group.UpdatedBy = deletedBy;

            await _context.SaveChangesAsync();

            _logger.LogInformation("廣播群組 {GroupName} 已刪除，ID: {GroupId}", group.Name, group.Id);
            return true;
        }

        #endregion

        #region 標籤管理

        /// <summary>
        /// 獲取標籤列表
        /// </summary>
        public async Task<List<ContactHashtag>> GetHashtagsAsync(Guid companyId)
        {
            return await _context.ContactHashtags
                .Where(h => h.CompanyId == companyId && h.IsActive)
                .OrderBy(h => h.Name)
                .ToListAsync();
        }

        /// <summary>
        /// 創建標籤
        /// </summary>
        public async Task<ContactHashtag> CreateHashtagAsync(ContactHashtag hashtag, string createdBy)
        {
            hashtag.Id = Guid.NewGuid();
            hashtag.CreatedAt = DateTime.UtcNow;
            hashtag.CreatedBy = createdBy;
            hashtag.IsActive = true;

            _context.ContactHashtags.Add(hashtag);
            await _context.SaveChangesAsync();

            _logger.LogInformation("標籤 {HashtagName} 已創建，ID: {HashtagId}", hashtag.Name, hashtag.Id);
            return hashtag;
        }

        /// <summary>
        /// 更新標籤
        /// </summary>
        public async Task<ContactHashtag?> UpdateHashtagAsync(Guid id, ContactHashtag updatedHashtag, string updatedBy)
        {
            var existingHashtag = await _context.ContactHashtags
                .FirstOrDefaultAsync(h => h.Id == id);

            if (existingHashtag == null)
                return null;

            existingHashtag.Name = updatedHashtag.Name;
            existingHashtag.Color = updatedHashtag.Color;
            existingHashtag.Description = updatedHashtag.Description;

            await _context.SaveChangesAsync();

            _logger.LogInformation("標籤 {HashtagName} 已更新，ID: {HashtagId}", existingHashtag.Name, existingHashtag.Id);
            return existingHashtag;
        }

        /// <summary>
        /// 刪除標籤
        /// </summary>
        public async Task<bool> DeleteHashtagAsync(Guid id, Guid companyId, string deletedBy)
        {
            var hashtag = await _context.ContactHashtags
                .FirstOrDefaultAsync(h => h.Id == id && h.CompanyId == companyId);

            if (hashtag == null)
                return false;

            // 檢查是否有聯絡人使用此標籤
            var hasContacts = await _context.ContactLists
                .AnyAsync(c => c.Hashtags.Contains(hashtag.Name) && c.IsActive);

            if (hasContacts)
            {
                _logger.LogWarning("無法刪除標籤 {HashtagName}，仍有聯絡人使用此標籤", hashtag.Name);
                return false;
            }

            hashtag.IsActive = false;

            await _context.SaveChangesAsync();

            _logger.LogInformation("標籤 {HashtagName} 已刪除，ID: {HashtagId}", hashtag.Name, hashtag.Id);
            return true;
        }

        #endregion

        #region 廣播發送

        /// <summary>
        /// 獲取廣播發送記錄
        /// </summary>
        public async Task<(List<BroadcastSend> sends, int totalCount)> GetBroadcastSendsAsync(
            Guid companyId, 
            int page = 1, 
            int pageSize = 20)
        {
            var query = _context.BroadcastSends
                .Where(bs => bs.CompanyId == companyId)
                .AsQueryable();

            var totalCount = await query.CountAsync();
            
            var sends = await query
                .OrderByDescending(bs => bs.StartedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (sends, totalCount);
        }

        /// <summary>
        /// 獲取廣播發送統計
        /// </summary>
        public async Task<object> GetBroadcastStatsAsync(Guid companyId)
        {
            var stats = await _context.BroadcastSends
                .Where(bs => bs.CompanyId == companyId)
                .GroupBy(bs => bs.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync();

            var totalSends = await _context.BroadcastSends
                .Where(bs => bs.CompanyId == companyId)
                .CountAsync();

            var totalContacts = await _context.BroadcastSends
                .Where(bs => bs.CompanyId == companyId)
                .SumAsync(bs => bs.TotalContacts);

            var totalSent = await _context.BroadcastSends
                .Where(bs => bs.CompanyId == companyId)
                .SumAsync(bs => bs.SentCount);

            return new
            {
                StatusStats = stats,
                TotalSends = totalSends,
                TotalContacts = totalContacts,
                TotalSent = totalSent,
                SuccessRate = totalContacts > 0 ? (double)totalSent / totalContacts * 100 : 0
            };
        }

        #endregion
    }
}
