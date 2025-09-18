using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PurpleRice.Data;

namespace PurpleRice.Services
{
    /// <summary>
    /// 收件人解析服務
    /// 負責解析 RecipientSelector.js 的選擇結果，並轉換為實際的電話號碼列表
    /// </summary>
    public class RecipientResolverService
    {
        private readonly PurpleRiceDbContext _db;
        private readonly ILogger<RecipientResolverService> _logger;

        public RecipientResolverService(PurpleRiceDbContext db, ILogger<RecipientResolverService> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// 解析收件人選擇結果
        /// </summary>
        /// <param name="recipientValue">收件人值（可能是字符串或JSON）</param>
        /// <param name="recipientDetails">詳細的收件人選擇信息</param>
        /// <param name="workflowExecutionId">工作流程執行ID</param>
        /// <param name="companyId">公司ID</param>
        /// <returns>解析後的收件人列表</returns>
        public async Task<List<ResolvedRecipient>> ResolveRecipientsAsync(
            string recipientValue, 
            string recipientDetails, 
            int workflowExecutionId, 
            Guid companyId)
        {
            _logger.LogInformation("=== 開始解析收件人 ===");
            _logger.LogInformation("WorkflowExecutionId: {WorkflowExecutionId}", workflowExecutionId);
            _logger.LogInformation("CompanyId: {CompanyId}", companyId);
            _logger.LogInformation("recipientValue: {RecipientValue}", recipientValue);
            _logger.LogInformation("recipientDetails: {RecipientDetails}", recipientDetails);

            var resolvedRecipients = new List<ResolvedRecipient>();

            try
            {
                // 優先使用詳細的收件人信息
                if (!string.IsNullOrEmpty(recipientDetails))
                {
                    _logger.LogInformation("使用詳細收件人信息進行解析");
                    _logger.LogInformation("原始 recipientDetails: {RecipientDetails}", recipientDetails);
                    
                    var options = new System.Text.Json.JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };
                    var details = System.Text.Json.JsonSerializer.Deserialize<RecipientDetails>(recipientDetails, options);
                    
                    _logger.LogInformation("反序列化後的 details: Users={UserCount}, Contacts={ContactCount}, Groups={GroupCount}, Hashtags={HashtagCount}, PhoneNumbers={PhoneCount}, UseInitiator={UseInitiator}", 
                        details?.Users?.Count ?? 0, 
                        details?.Contacts?.Count ?? 0, 
                        details?.Groups?.Count ?? 0, 
                        details?.Hashtags?.Count ?? 0, 
                        details?.PhoneNumbers?.Count ?? 0, 
                        details?.UseInitiator ?? false);
                    
                    resolvedRecipients = await ResolveFromDetailsAsync(details, workflowExecutionId, companyId);
                }
                else if (!string.IsNullOrEmpty(recipientValue))
                {
                    _logger.LogInformation("使用字符串格式進行解析");
                    // 回退到解析字符串格式
                    resolvedRecipients = await ResolveFromStringAsync(recipientValue, workflowExecutionId, companyId);
                }
                else
                {
                    _logger.LogWarning("recipientValue 和 recipientDetails 都為空");
                }

                _logger.LogInformation("成功解析 {Count} 個收件人", resolvedRecipients.Count);
                return resolvedRecipients;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "解析收件人失敗");
                throw;
            }
        }

        /// <summary>
        /// 從詳細信息解析收件人
        /// </summary>
        private async Task<List<ResolvedRecipient>> ResolveFromDetailsAsync(
            RecipientDetails details, 
            int workflowExecutionId, 
            Guid companyId)
        {
            _logger.LogInformation("=== 開始從詳細信息解析收件人 ===");
            _logger.LogInformation("WorkflowExecutionId: {WorkflowExecutionId}, CompanyId: {CompanyId}", workflowExecutionId, companyId);
            
            var recipients = new List<ResolvedRecipient>();

            // 處理用戶選擇
            if (details.Users != null && details.Users.Any())
            {
                _logger.LogInformation("找到 {UserCount} 個用戶選擇", details.Users.Count);
                foreach (var user in details.Users)
                {
                    _logger.LogInformation("處理用戶: ID={UserId}, Name={UserName}, Phone={UserPhone}", user.Id, user.Name, user.Phone);
                    
                    if (!string.IsNullOrEmpty(user.Phone))
                    {
                        var recipient = new ResolvedRecipient
                        {
                            Id = Guid.NewGuid(),
                            PhoneNumber = user.Phone,
                            RecipientType = "User",
                            RecipientId = user.Id,
                            RecipientName = user.Name,
                            CompanyId = companyId
                        };
                        
                        recipients.Add(recipient);
                        _logger.LogInformation("已添加收件人: {RecipientId}, Phone={PhoneNumber}, Type={RecipientType}", recipient.Id, recipient.PhoneNumber, recipient.RecipientType);
                    }
                    else
                    {
                        _logger.LogWarning("用戶 {UserId} 的電話號碼為空，跳過", user.Id);
                    }
                }
            }
            else
            {
                _logger.LogInformation("沒有找到用戶選擇");
            }

            // 處理聯絡人選擇
            if (details.Contacts != null && details.Contacts.Any())
            {
                foreach (var contact in details.Contacts)
                {
                    recipients.Add(new ResolvedRecipient
                    {
                        PhoneNumber = contact.WhatsAppNumber,
                        RecipientType = "Contact",
                        RecipientId = contact.Id,
                        RecipientName = contact.Name,
                        CompanyId = companyId
                    });
                }
            }

            // 處理廣播群組選擇
            if (details.Groups != null && details.Groups.Any())
            {
                var groupRecipients = await ResolveBroadcastGroupsAsync(details.Groups, companyId);
                recipients.AddRange(groupRecipients);
            }

            // 處理標籤選擇
            if (details.Hashtags != null && details.Hashtags.Any())
            {
                var hashtagRecipients = await ResolveHashtagsAsync(details.Hashtags, companyId);
                recipients.AddRange(hashtagRecipients);
            }

            // 處理流程啟動人
            if (details.UseInitiator)
            {
                var initiatorRecipient = await ResolveInitiatorAsync(workflowExecutionId, companyId);
                if (initiatorRecipient != null)
                {
                    recipients.Add(initiatorRecipient);
                }
            }

            // 處理直接電話號碼列表
            if (details.PhoneNumbers != null && details.PhoneNumbers.Any())
            {
                _logger.LogInformation("找到 {PhoneCount} 個直接電話號碼", details.PhoneNumbers.Count);
                foreach (var phoneNumber in details.PhoneNumbers)
                {
                    if (!string.IsNullOrEmpty(phoneNumber))
                    {
                        // 檢查是否為 ${initiator} 且已經因為 useInitiator 添加了流程啟動人
                        if (phoneNumber == "${initiator}" && details.UseInitiator)
                        {
                            _logger.LogInformation("跳過 ${initiator}，因為已經通過 useInitiator 添加了流程啟動人");
                            continue;
                        }
                        
                        // 如果是 ${initiator} 但沒有通過 useInitiator 添加，則解析它
                        if (phoneNumber == "${initiator}")
                        {
                            var initiatorRecipient = await ResolveInitiatorAsync(workflowExecutionId, companyId);
                            if (initiatorRecipient != null)
                            {
                                recipients.Add(initiatorRecipient);
                                _logger.LogInformation("已添加流程啟動人收件人: {PhoneNumber}", initiatorRecipient.PhoneNumber);
                            }
                        }
                        else
                        {
                            var recipient = new ResolvedRecipient
                            {
                                Id = Guid.NewGuid(),
                                PhoneNumber = phoneNumber,
                                RecipientType = "PhoneNumber",
                                RecipientId = phoneNumber,
                                RecipientName = phoneNumber,
                                CompanyId = companyId
                            };
                            
                            recipients.Add(recipient);
                            _logger.LogInformation("已添加電話號碼收件人: {PhoneNumber}", phoneNumber);
                        }
                    }
                }
            }

            _logger.LogInformation("=== 從詳細信息解析收件人完成，共 {Count} 個收件人 ===", recipients.Count);
            return recipients;
        }

        /// <summary>
        /// 從字符串解析收件人（向後兼容）
        /// </summary>
        private async Task<List<ResolvedRecipient>> ResolveFromStringAsync(
            string recipientValue, 
            int workflowExecutionId, 
            Guid companyId)
        {
            var recipients = new List<ResolvedRecipient>();

            if (recipientValue.Contains(','))
            {
                // 多個電話號碼
                var phoneNumbers = recipientValue.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(p => p.Trim())
                    .ToList();

                foreach (var phone in phoneNumbers)
                {
                    if (phone == "${initiator}")
                    {
                        var initiatorRecipient = await ResolveInitiatorAsync(workflowExecutionId, companyId);
                        if (initiatorRecipient != null)
                        {
                            recipients.Add(initiatorRecipient);
                        }
                    }
                    else
                    {
                        recipients.Add(new ResolvedRecipient
                        {
                            PhoneNumber = phone,
                            RecipientType = "Unknown",
                            RecipientName = phone,
                            CompanyId = companyId
                        });
                    }
                }
            }
            else
            {
                // 單個電話號碼或特殊標記
                if (recipientValue == "${initiator}")
                {
                    var initiatorRecipient = await ResolveInitiatorAsync(workflowExecutionId, companyId);
                    if (initiatorRecipient != null)
                    {
                        recipients.Add(initiatorRecipient);
                    }
                }
                else
                {
                    recipients.Add(new ResolvedRecipient
                    {
                        PhoneNumber = recipientValue,
                        RecipientType = "Unknown",
                        RecipientName = recipientValue,
                        CompanyId = companyId
                    });
                }
            }

            return recipients;
        }

        /// <summary>
        /// 解析廣播群組
        /// </summary>
        private async Task<List<ResolvedRecipient>> ResolveBroadcastGroupsAsync(List<string> groupIds, Guid companyId)
        {
            var recipients = new List<ResolvedRecipient>();

            foreach (var groupId in groupIds)
            {
                var group = await _db.BroadcastGroups
                    .Include(bg => bg.Contacts)
                    .FirstOrDefaultAsync(bg => bg.Id == Guid.Parse(groupId) && bg.CompanyId == companyId);

                if (group != null)
                {
                    foreach (var contact in group.Contacts)
                    {
                        recipients.Add(new ResolvedRecipient
                        {
                            PhoneNumber = contact.WhatsAppNumber,
                            RecipientType = "Group",
                            RecipientId = contact.Id.ToString(),
                            RecipientName = $"{contact.Name} (群組: {group.Name})",
                            CompanyId = companyId
                        });
                    }
                }
            }

            return recipients;
        }

        /// <summary>
        /// 解析標籤
        /// </summary>
        private async Task<List<ResolvedRecipient>> ResolveHashtagsAsync(List<string> hashtagIds, Guid companyId)
        {
            var recipients = new List<ResolvedRecipient>();

            foreach (var hashtagId in hashtagIds)
            {
                var hashtag = await _db.ContactHashtags
                    .FirstOrDefaultAsync(h => h.Id == Guid.Parse(hashtagId) && h.CompanyId == companyId);

                if (hashtag != null)
                {
                    // 查找包含此標籤的聯絡人
                    var contacts = await _db.ContactLists
                        .Where(c => c.CompanyId == companyId && 
                                   c.IsActive && 
                                   c.Hashtags.Contains(hashtag.Name))
                        .ToListAsync();

                    foreach (var contact in contacts)
                    {
                        recipients.Add(new ResolvedRecipient
                        {
                            PhoneNumber = contact.WhatsAppNumber,
                            RecipientType = "Hashtag",
                            RecipientId = contact.Id.ToString(),
                            RecipientName = $"{contact.Name} (標籤: #{hashtag.Name})",
                            CompanyId = companyId
                        });
                    }
                }
            }

            return recipients;
        }

        /// <summary>
        /// 解析流程啟動人
        /// </summary>
        private async Task<ResolvedRecipient> ResolveInitiatorAsync(int workflowExecutionId, Guid companyId)
        {
            var execution = await _db.WorkflowExecutions
                .Include(we => we.WorkflowDefinition)
                .FirstOrDefaultAsync(we => we.Id == workflowExecutionId && 
                                          we.WorkflowDefinition != null && 
                                          we.WorkflowDefinition.CompanyId == companyId);

            if (execution != null && !string.IsNullOrEmpty(execution.InitiatedBy))
            {
                return new ResolvedRecipient
                {
                    PhoneNumber = execution.InitiatedBy,
                    RecipientType = "Initiator",
                    RecipientId = execution.Id.ToString(),
                    RecipientName = $"流程啟動人 ({execution.InitiatedBy})",
                    CompanyId = companyId
                };
            }

            return null;
        }
    }

    /// <summary>
    /// 收件人詳細信息
    /// </summary>
    public class RecipientDetails
    {
        public List<UserInfo> Users { get; set; } = new List<UserInfo>();
        public List<ContactInfo> Contacts { get; set; } = new List<ContactInfo>();
        public List<string> Groups { get; set; } = new List<string>();
        public List<string> Hashtags { get; set; } = new List<string>();
        public bool UseInitiator { get; set; }
        public List<string> PhoneNumbers { get; set; } = new List<string>();
    }

    /// <summary>
    /// 用戶信息
    /// </summary>
    public class UserInfo
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public string Id { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string Name { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("phone")]
        public string Phone { get; set; }
        
        // 添加其他可能需要的屬性
        [System.Text.Json.Serialization.JsonPropertyName("companyId")]
        public string CompanyId { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("account")]
        public string Account { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("email")]
        public string Email { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("isActive")]
        public bool? IsActive { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("isOwner")]
        public bool? IsOwner { get; set; }
    }

    /// <summary>
    /// 聯絡人信息
    /// </summary>
    public class ContactInfo
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string WhatsAppNumber { get; set; }
    }

    /// <summary>
    /// 解析後的收件人
    /// </summary>
    public class ResolvedRecipient
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string PhoneNumber { get; set; }
        public string RecipientType { get; set; }
        public string RecipientId { get; set; }
        public string RecipientName { get; set; }
        public Guid CompanyId { get; set; }
    }
}
