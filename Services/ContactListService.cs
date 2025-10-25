using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Models.DTOs;
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
        /// 獲取聯絡人統計數據
        /// </summary>
        public async Task<object> GetStatisticsAsync(Guid companyId)
        {
            try
            {
                _logger.LogInformation($"📊 開始獲取公司 {companyId} 的聯絡人統計數據");

                // 總聯絡人數
                var totalContacts = await _context.ContactLists
                    .Where(c => c.CompanyId == companyId)
                    .CountAsync();

                // 活躍聯絡人數
                var activeContacts = await _context.ContactLists
                    .Where(c => c.CompanyId == companyId && c.IsActive)
                    .CountAsync();

                // 非活躍聯絡人數
                var inactiveContacts = totalContacts - activeContacts;

                var statistics = new
                {
                    total = totalContacts,
                    active = activeContacts,
                    inactive = inactiveContacts
                };

                _logger.LogInformation($"✅ 統計數據: 總計={totalContacts}, 活躍={activeContacts}, 非活躍={inactiveContacts}");
                
                return statistics;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ 獲取統計數據失敗: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 獲取聯絡人列表
        /// </summary>
        public async Task<(List<ContactListResponseDto> contacts, int totalCount)> GetContactsAsync(
            Guid companyId, 
            int page = 1, 
            int pageSize = 20, 
            string? search = null, 
            Guid? broadcastGroupId = null, 
            string? hashtagFilter = null,
            string? sortField = null,
            string? sortOrder = null)
        {
            var query = _context.ContactLists
                .Include(c => c.BroadcastGroup) // 包含群組關聯數據
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

            // 排序邏輯
            if (!string.IsNullOrEmpty(sortField))
            {
                switch (sortField.ToLower())
                {
                    case "name":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(c => c.Name) : query.OrderByDescending(c => c.Name);
                        break;
                    case "email":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(c => c.Email) : query.OrderByDescending(c => c.Email);
                        break;
                    case "whatsappnumber":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(c => c.WhatsAppNumber) : query.OrderByDescending(c => c.WhatsAppNumber);
                        break;
                    case "companyname":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(c => c.CompanyName) : query.OrderByDescending(c => c.CompanyName);
                        break;
                    case "department":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(c => c.Department) : query.OrderByDescending(c => c.Department);
                        break;
                    case "position":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(c => c.Position) : query.OrderByDescending(c => c.Position);
                        break;
                    case "createdat":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(c => c.CreatedAt) : query.OrderByDescending(c => c.CreatedAt);
                        break;
                    case "updatedat":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(c => c.UpdatedAt) : query.OrderByDescending(c => c.UpdatedAt);
                        break;
                    case "contact":
                        // 聯絡人排序 - 按姓名排序
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(c => c.Name) : query.OrderByDescending(c => c.Name);
                        break;
                    default:
                        // 默認按姓名排序
                        query = query.OrderBy(c => c.Name);
                        break;
                }
            }
            else
            {
                // 默認按姓名排序
                query = query.OrderBy(c => c.Name);
            }

            var totalCount = await query.CountAsync();
            
            var contacts = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new ContactListResponseDto
                {
                    Id = c.Id,
                    CompanyId = c.CompanyId,
                    Name = c.Name,
                    Title = c.Title,
                    Occupation = c.Occupation,
                    WhatsAppNumber = c.WhatsAppNumber,
                    Email = c.Email,
                    CompanyName = c.CompanyName,
                    Department = c.Department,
                    Position = c.Position,
                    Hashtags = c.Hashtags,
                    BroadcastGroupId = c.BroadcastGroupId,
                    IsActive = c.IsActive,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    CreatedBy = c.CreatedBy,
                    UpdatedBy = c.UpdatedBy,
                    BroadcastGroup = c.BroadcastGroup != null ? new BroadcastGroupResponseDto
                    {
                        Id = c.BroadcastGroup.Id,
                        Name = c.BroadcastGroup.Name,
                        Description = c.BroadcastGroup.Description,
                        Color = c.BroadcastGroup.Color,
                        IsActive = c.BroadcastGroup.IsActive,
                        CreatedAt = c.BroadcastGroup.CreatedAt,
                        UpdatedAt = c.BroadcastGroup.UpdatedAt,
                        CreatedBy = c.BroadcastGroup.CreatedBy,
                        UpdatedBy = c.BroadcastGroup.UpdatedBy
                    } : null
                })
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
        /// 根據標準化的 WhatsApp 號碼查找聯絡人
        /// </summary>
        public async Task<ContactList?> FindByNormalizedWhatsAppAsync(Guid companyId, string normalizedNumber)
        {
            if (string.IsNullOrEmpty(normalizedNumber))
                return null;

            // 查找所有該公司的活躍聯絡人，並在內存中進行標準化比較
            // 這是因為數據庫中的 WhatsApp 號碼可能有不同格式
            var contacts = await _context.ContactLists
                .Where(c => c.CompanyId == companyId && c.IsActive && !string.IsNullOrEmpty(c.WhatsAppNumber))
                .ToListAsync();

            foreach (var contact in contacts)
            {
                var contactNormalizedNumber = new string(contact.WhatsAppNumber.Where(char.IsDigit).ToArray());
                if (contactNormalizedNumber == normalizedNumber)
                {
                    return contact;
                }
            }

            return null;
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
        /// 獲取廣播群組統計數據
        /// </summary>
        public async Task<object> GetBroadcastGroupsStatisticsAsync(Guid companyId)
        {
            try
            {
                _logger.LogInformation($"📊 開始獲取公司 {companyId} 的廣播群組統計數據");

                // 總群組數
                var totalGroups = await _context.BroadcastGroups
                    .Where(bg => bg.CompanyId == companyId)
                    .CountAsync();

                // 活躍群組數
                var activeGroups = await _context.BroadcastGroups
                    .Where(bg => bg.CompanyId == companyId && bg.IsActive)
                    .CountAsync();

                // 計算每個群組的成員數量並統計總成員數
                var groupsWithMembers = await _context.BroadcastGroups
                    .Where(bg => bg.CompanyId == companyId && bg.IsActive)
                    .Select(bg => new
                    {
                        GroupId = bg.Id,
                        MemberCount = _context.ContactLists
                            .Count(c => c.BroadcastGroupId == bg.Id && c.IsActive)
                    })
                    .ToListAsync();

                var totalMembers = groupsWithMembers.Sum(g => g.MemberCount);

                var statistics = new
                {
                    totalGroups = totalGroups,
                    activeGroups = activeGroups,
                    totalMembers = totalMembers
                };

                _logger.LogInformation($"✅ 統計數據: 總群組={totalGroups}, 活躍群組={activeGroups}, 總成員={totalMembers}");
                
                return statistics;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ 獲取廣播群組統計數據失敗: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 獲取廣播群組列表
        /// </summary>
        public async Task<(List<BroadcastGroup> groups, int totalCount)> GetBroadcastGroupsAsync(
            Guid companyId, 
            int page = 1, 
            int pageSize = 20, 
            string? search = null, 
            string? sortField = null, 
            string? sortOrder = null)
        {
            var query = _context.BroadcastGroups
                .Where(bg => bg.CompanyId == companyId && bg.IsActive)
                .AsQueryable();

            // 搜索功能
            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(bg => bg.Name.Contains(search) || 
                                        (bg.Description != null && bg.Description.Contains(search)));
            }

            // 排序邏輯
            if (!string.IsNullOrEmpty(sortField))
            {
                switch (sortField.ToLower())
                {
                    case "name":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(bg => bg.Name) : query.OrderByDescending(bg => bg.Name);
                        break;
                    case "description":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(bg => bg.Description) : query.OrderByDescending(bg => bg.Description);
                        break;
                    case "color":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(bg => bg.Color) : query.OrderByDescending(bg => bg.Color);
                        break;
                    case "createdat":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(bg => bg.CreatedAt) : query.OrderByDescending(bg => bg.CreatedAt);
                        break;
                    case "updatedat":
                        query = sortOrder?.ToLower() == "asc" ? query.OrderBy(bg => bg.UpdatedAt) : query.OrderByDescending(bg => bg.UpdatedAt);
                        break;
                    default:
                        // 默認按名稱排序
                        query = query.OrderBy(bg => bg.Name);
                        break;
                }
            }
            else
            {
                // 默認按名稱排序
                query = query.OrderBy(bg => bg.Name);
            }

            var totalCount = await query.CountAsync();
            
            var groups = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (groups, totalCount);
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
        /// 獲取標籤統計數據
        /// </summary>
        public async Task<object> GetHashtagsStatisticsAsync(Guid companyId)
        {
            try
            {
                _logger.LogInformation($"📊 開始獲取公司 {companyId} 的標籤統計數據");

                // 總標籤數
                var totalHashtags = await _context.ContactHashtags
                    .Where(h => h.CompanyId == companyId)
                    .CountAsync();

                // 活躍標籤數
                var activeHashtags = await _context.ContactHashtags
                    .Where(h => h.CompanyId == companyId && h.IsActive)
                    .CountAsync();

                // 計算標籤使用次數（聯絡人中包含該標籤的數量）
                var activeContacts = await _context.ContactLists
                    .Where(c => c.CompanyId == companyId && c.IsActive)
                    .ToListAsync();

                // 統計所有標籤在聯絡人中的使用次數
                var hashtagUsageCount = 0;
                foreach (var contact in activeContacts)
                {
                    if (!string.IsNullOrEmpty(contact.Hashtags))
                    {
                        // 假設 Hashtags 是以逗號分隔的字符串
                        var hashtagList = contact.Hashtags.Split(',', StringSplitOptions.RemoveEmptyEntries);
                        hashtagUsageCount += hashtagList.Length;
                    }
                }

                var statistics = new
                {
                    totalHashtags = totalHashtags,
                    activeHashtags = activeHashtags,
                    hashtagUsage = hashtagUsageCount
                };

                _logger.LogInformation($"✅ 統計數據: 總標籤={totalHashtags}, 活躍標籤={activeHashtags}, 標籤使用次數={hashtagUsageCount}");
                
                return statistics;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ 獲取標籤統計數據失敗: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 獲取標籤列表（支持分頁、排序、搜索）
        /// </summary>
        public async Task<(List<ContactHashtag> hashtags, int totalCount)> GetHashtagsAsync(
            Guid companyId, 
            int page = 1, 
            int pageSize = 20, 
            string? search = null, 
            string? sortField = null, 
            string? sortOrder = null)
        {
            var query = _context.ContactHashtags
                .Where(h => h.CompanyId == companyId && h.IsActive);

            // 搜索過濾
            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(h => 
                    h.Name.Contains(search) || 
                    (h.Description != null && h.Description.Contains(search)));
            }

            // 獲取總數
            var totalCount = await query.CountAsync();

            // 排序
            if (!string.IsNullOrEmpty(sortField) && !string.IsNullOrEmpty(sortOrder))
            {
                switch (sortField.ToLower())
                {
                    case "name":
                        query = sortOrder.ToLower() == "desc" 
                            ? query.OrderByDescending(h => h.Name)
                            : query.OrderBy(h => h.Name);
                        break;
                    case "description":
                        query = sortOrder.ToLower() == "desc" 
                            ? query.OrderByDescending(h => h.Description)
                            : query.OrderBy(h => h.Description);
                        break;
                    case "color":
                        query = sortOrder.ToLower() == "desc" 
                            ? query.OrderByDescending(h => h.Color)
                            : query.OrderBy(h => h.Color);
                        break;
                    case "createdat":
                        query = sortOrder.ToLower() == "desc" 
                            ? query.OrderByDescending(h => h.CreatedAt)
                            : query.OrderBy(h => h.CreatedAt);
                        break;
                    case "updatedat":
                        // ContactHashtag 沒有 UpdatedAt 欄位，使用 CreatedAt 代替
                        query = sortOrder.ToLower() == "desc" 
                            ? query.OrderByDescending(h => h.CreatedAt)
                            : query.OrderBy(h => h.CreatedAt);
                        break;
                    default:
                        query = query.OrderBy(h => h.Name);
                        break;
                }
            }
            else
            {
                query = query.OrderBy(h => h.Name);
            }

            // 分頁
            var hashtags = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (hashtags, totalCount);
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

    }
}
