using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using PurpleRice.Models;
using PurpleRice.Models.DTOs;
using PurpleRice.Services;
using System.Security.Claims;
using System.Linq;

namespace PurpleRice.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ContactListController : ControllerBase
    {
        private readonly ContactListService _contactListService;
        private readonly ILogger<ContactListController> _logger;

        public ContactListController(ContactListService contactListService, ILogger<ContactListController> logger)
        {
            _contactListService = contactListService;
            _logger = logger;
        }

        #region 聯絡人管理

        /// <summary>
        /// 獲取聯絡人統計數據
        /// </summary>
        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics()
        {
            try
            {
                _logger.LogInformation("📊 開始獲取聯絡人統計數據");
                
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                {
                    _logger.LogWarning("❌ 無法識別公司資訊");
                    return Unauthorized("無法識別公司資訊");
                }

                var statistics = await _contactListService.GetStatisticsAsync(companyId);
                
                _logger.LogInformation($"✅ 成功獲取統計數據: {System.Text.Json.JsonSerializer.Serialize(statistics)}");
                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ 獲取聯絡人統計數據失敗: {Message}", ex.Message);
                return StatusCode(500, new { error = $"獲取統計數據失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 獲取聯絡人列表
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetContacts(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            [FromQuery] Guid? broadcastGroupId = null,
            [FromQuery] string? hashtagFilter = null,
            [FromQuery] string? sortField = null,
            [FromQuery] string? sortOrder = null)
        {
            try
            {
                // 調試日誌
                _logger.LogInformation("ContactListController.GetContacts called");
                _logger.LogInformation("Authorization header: {AuthHeader}", Request.Headers["Authorization"].FirstOrDefault());
                
                var companyId = GetCurrentCompanyId();
                _logger.LogInformation("CompanyId: {CompanyId}", companyId);
                
                if (companyId == Guid.Empty)
                {
                    _logger.LogWarning("CompanyId is empty, returning Unauthorized");
                    return Unauthorized("無法識別公司資訊");
                }

                var (contacts, totalCount) = await _contactListService.GetContactsAsync(
                    companyId, page, pageSize, search, broadcastGroupId, hashtagFilter, sortField, sortOrder);

                _logger.LogInformation("查詢結果 - 聯絡人數量: {ContactCount}, 總數量: {TotalCount}", 
                    contacts?.Count ?? 0, totalCount);

                var result = new
                {
                    contacts,
                    totalCount,
                    page,
                    pageSize,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                };

                _logger.LogInformation("返回結果: {Result}", System.Text.Json.JsonSerializer.Serialize(result));
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取聯絡人列表失敗: {Message}", ex.Message);
                _logger.LogError(ex, "堆疊追蹤: {StackTrace}", ex.StackTrace);
                return StatusCode(500, $"獲取聯絡人列表失敗: {ex.Message}");
            }
        }

        /// <summary>
        /// 獲取單一聯絡人
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetContact(Guid id)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var contact = await _contactListService.GetContactAsync(id, companyId);
                if (contact == null)
                    return NotFound("聯絡人不存在");

                return Ok(contact);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取聯絡人失敗，ID: {ContactId}", id);
                return StatusCode(500, "獲取聯絡人失敗");
            }
        }

        /// <summary>
        /// 創建聯絡人
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateContact([FromBody] CreateContactRequest request)
        {
            try
            {
                _logger.LogInformation("CreateContact called");
                _logger.LogInformation("Received request data: {RequestData}", System.Text.Json.JsonSerializer.Serialize(request));
                
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                {
                    _logger.LogWarning("CompanyId is empty, returning Unauthorized");
                    return Unauthorized("無法識別公司資訊");
                }

                var createdBy = GetCurrentUserId();
                _logger.LogInformation("CompanyId: {CompanyId}, CreatedBy: {CreatedBy}", companyId, createdBy);
                Console.WriteLine($"🔍 CreateContact - CreatedBy value: '{createdBy}'");
                Console.WriteLine($"🔍 CreateContact - CreatedBy is null: {createdBy == null}");
                Console.WriteLine($"🔍 CreateContact - CreatedBy is empty: {string.IsNullOrEmpty(createdBy)}");
                Console.WriteLine($"🔍 CreateContact - CreatedBy length: {createdBy?.Length ?? -1}");
                
                // 驗證 createdBy 不為空
                if (string.IsNullOrEmpty(createdBy))
                {
                    _logger.LogError("CreatedBy is null or empty, cannot create contact");
                    Console.WriteLine("❌ CreateContact - CreatedBy validation failed!");
                    return BadRequest("無法識別用戶資訊");
                }
                
                // 驗證必填欄位
                if (string.IsNullOrEmpty(request.Name))
                {
                    return BadRequest("姓名為必填欄位");
                }
                
                if (request.BroadcastGroupId == null || request.BroadcastGroupId == Guid.Empty)
                {
                    return BadRequest("廣播群組為必填欄位");
                }
                
                // 創建聯絡人對象
                var contact = new ContactList
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    Name = request.Name?.Trim(),
                    Title = request.Title?.Trim(),
                    Occupation = request.Occupation?.Trim(),
                    WhatsAppNumber = request.WhatsAppNumber?.Trim(),
                    Email = request.Email?.Trim(),
                    CompanyName = request.CompanyName?.Trim(),
                    Department = request.Department?.Trim(),
                    Position = request.Position?.Trim(),
                    Hashtags = request.Hashtags?.Trim(),
                    BroadcastGroupId = request.BroadcastGroupId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = createdBy,
                    UpdatedAt = null,
                    UpdatedBy = null
                };
                
                Console.WriteLine($"🔍 CreateContact - After creating contact:");
                Console.WriteLine($"🔍 CreateContact - contact.CreatedBy: '{contact.CreatedBy}'");
                Console.WriteLine($"🔍 CreateContact - contact.CreatedBy is null: {contact.CreatedBy == null}");
                Console.WriteLine($"🔍 CreateContact - contact.CreatedBy is empty: {string.IsNullOrEmpty(contact.CreatedBy)}");
                Console.WriteLine($"🔍 CreateContact - contact.Name: '{contact.Name}'");
                Console.WriteLine($"🔍 CreateContact - contact.BroadcastGroupId: '{contact.BroadcastGroupId}'");
                
                _logger.LogInformation("Contact created: {ContactData}", System.Text.Json.JsonSerializer.Serialize(contact));

                var createdContact = await _contactListService.CreateContactAsync(contact, createdBy);
                _logger.LogInformation("Contact created successfully with ID: {ContactId}", createdContact.Id);
                
                return CreatedAtAction(nameof(GetContact), new { id = createdContact.Id }, createdContact);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "創建聯絡人失敗: {Message}", ex.Message);
                _logger.LogError(ex, "堆疊追蹤: {StackTrace}", ex.StackTrace);
                return StatusCode(500, $"創建聯絡人失敗: {ex.Message}");
            }
        }

        /// <summary>
        /// 更新聯絡人
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateContact(Guid id, [FromBody] UpdateContactRequest request)
        {
            try
            {
                _logger.LogInformation("UpdateContact called for ID: {ContactId}", id);
                _logger.LogInformation("Received request data: {RequestData}", System.Text.Json.JsonSerializer.Serialize(request));
                _logger.LogInformation("BroadcastGroupId value: {BroadcastGroupId}", request.BroadcastGroupId);
                _logger.LogInformation("BroadcastGroupId is null: {IsNull}", request.BroadcastGroupId == null);
                _logger.LogInformation("BroadcastGroupId is empty: {IsEmpty}", request.BroadcastGroupId == Guid.Empty);
                
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var updatedBy = GetCurrentUserId();
                _logger.LogInformation("CompanyId: {CompanyId}, UpdatedBy: {UpdatedBy}", companyId, updatedBy);
                Console.WriteLine($"🔍 UpdateContact - UpdatedBy value: '{updatedBy}'");
                Console.WriteLine($"🔍 UpdateContact - UpdatedBy is null: {updatedBy == null}");
                Console.WriteLine($"🔍 UpdateContact - UpdatedBy is empty: {string.IsNullOrEmpty(updatedBy)}");
                Console.WriteLine($"🔍 UpdateContact - UpdatedBy length: {updatedBy?.Length ?? -1}");
                
                // 驗證 updatedBy 不為空
                if (string.IsNullOrEmpty(updatedBy))
                {
                    _logger.LogError("UpdatedBy is null or empty, cannot update contact");
                    Console.WriteLine("❌ UpdateContact - UpdatedBy validation failed!");
                    return BadRequest("無法識別用戶資訊");
                }
                
                // 驗證必填欄位
                if (string.IsNullOrEmpty(request.Name))
                {
                    return BadRequest("姓名為必填欄位");
                }
                
                if (request.BroadcastGroupId == null || request.BroadcastGroupId == Guid.Empty)
                {
                    return BadRequest("廣播群組為必填欄位");
                }
                
                // 先獲取現有的聯絡人資料以保留原始創建資訊
                var existingContact = await _contactListService.GetContactAsync(id, companyId);
                if (existingContact == null)
                    return NotFound("聯絡人不存在");
                
                Console.WriteLine($"🔍 UpdateContact - Existing contact CreatedBy: '{existingContact.CreatedBy}'");
                Console.WriteLine($"🔍 UpdateContact - Existing contact CreatedBy is null: {existingContact.CreatedBy == null}");
                Console.WriteLine($"🔍 UpdateContact - Existing contact CreatedBy is empty: {string.IsNullOrEmpty(existingContact.CreatedBy)}");
                
                // 創建更新的聯絡人對象
                var updatedContact = new ContactList
                {
                    Id = id,
                    CompanyId = companyId,
                    Name = request.Name?.Trim(),
                    Title = request.Title?.Trim(),
                    Occupation = request.Occupation?.Trim(),
                    WhatsAppNumber = request.WhatsAppNumber?.Trim(),
                    Email = request.Email?.Trim(),
                    CompanyName = request.CompanyName?.Trim(),
                    Department = request.Department?.Trim(),
                    Position = request.Position?.Trim(),
                    Hashtags = request.Hashtags?.Trim(),
                    BroadcastGroupId = request.BroadcastGroupId,
                    IsActive = request.IsActive,
                    CreatedAt = existingContact.CreatedAt, // 保留原始創建時間
                    CreatedBy = existingContact.CreatedBy, // 保留原始創建者
                    UpdatedAt = DateTime.UtcNow, // 設置更新時間
                    UpdatedBy = updatedBy // 設置更新者
                };
                
                Console.WriteLine($"🔍 UpdateContact - After creating updated contact:");
                Console.WriteLine($"🔍 UpdateContact - updatedContact.CreatedBy: '{updatedContact.CreatedBy}'");
                Console.WriteLine($"🔍 UpdateContact - updatedContact.CreatedBy is null: {updatedContact.CreatedBy == null}");
                Console.WriteLine($"🔍 UpdateContact - updatedContact.CreatedBy is empty: {string.IsNullOrEmpty(updatedContact.CreatedBy)}");
                Console.WriteLine($"🔍 UpdateContact - updatedContact.UpdatedBy: '{updatedContact.UpdatedBy}'");
                
                _logger.LogInformation("Updated contact: {ContactData}", System.Text.Json.JsonSerializer.Serialize(updatedContact));
                
                var result = await _contactListService.UpdateContactAsync(id, updatedContact, updatedBy);
                
                if (result == null)
                    return NotFound("聯絡人不存在");

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "更新聯絡人失敗，ID: {ContactId}", id);
                return StatusCode(500, "更新聯絡人失敗");
            }
        }

        /// <summary>
        /// 刪除聯絡人
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteContact(Guid id)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var deletedBy = GetCurrentUserId();
                var result = await _contactListService.DeleteContactAsync(id, companyId, deletedBy);
                
                if (!result)
                    return NotFound("聯絡人不存在");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "刪除聯絡人失敗，ID: {ContactId}", id);
                return StatusCode(500, "刪除聯絡人失敗");
            }
        }

        /// <summary>
        /// 批量匯入聯絡人
        /// </summary>
        [HttpPost("import")]
        public async Task<IActionResult> ImportContacts([FromBody] List<ContactList> contacts)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var createdBy = GetCurrentUserId();
                var (successCount, failCount, errors) = await _contactListService.ImportContactsAsync(contacts, companyId, createdBy);

                return Ok(new
                {
                    successCount,
                    failCount,
                    errors,
                    message = $"成功匯入 {successCount} 筆，失敗 {failCount} 筆"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "批量匯入聯絡人失敗");
                return StatusCode(500, "批量匯入聯絡人失敗");
            }
        }

        #endregion

        #region 廣播群組管理

        /// <summary>
        /// 獲取廣播群組統計數據
        /// </summary>
        [HttpGet("groups/statistics")]
        public async Task<IActionResult> GetBroadcastGroupsStatistics()
        {
            try
            {
                _logger.LogInformation("📊 開始獲取廣播群組統計數據");
                
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                {
                    _logger.LogWarning("❌ 無法識別公司資訊");
                    return Unauthorized("無法識別公司資訊");
                }

                var statistics = await _contactListService.GetBroadcastGroupsStatisticsAsync(companyId);
                
                _logger.LogInformation($"✅ 成功獲取廣播群組統計數據");
                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ 獲取廣播群組統計數據失敗: {Message}", ex.Message);
                return StatusCode(500, new { error = $"獲取統計數據失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 獲取廣播群組列表
        /// </summary>
        [HttpGet("groups")]
        public async Task<IActionResult> GetBroadcastGroups(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            [FromQuery] string? sortField = null,
            [FromQuery] string? sortOrder = null)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var (groups, totalCount) = await _contactListService.GetBroadcastGroupsAsync(
                    companyId, page, pageSize, search, sortField, sortOrder);
                
                _logger.LogInformation("廣播群組查詢結果 - 數量: {GroupCount}, 總計: {TotalCount}", 
                    groups?.Count ?? 0, totalCount);
                
                return Ok(new
                {
                    data = groups,
                    total = totalCount,
                    page = page,
                    pageSize = pageSize,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取廣播群組列表失敗");
                return StatusCode(500, "獲取廣播群組列表失敗");
            }
        }

        /// <summary>
        /// 獲取單個廣播群組
        /// </summary>
        [HttpGet("groups/{id}")]
        public async Task<IActionResult> GetBroadcastGroup(Guid id)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                // 先獲取所有群組，然後找到指定的群組
                var (allGroups, _) = await _contactListService.GetBroadcastGroupsAsync(companyId);
                var group = allGroups.FirstOrDefault(g => g.Id == id);
                if (group == null)
                    return NotFound("廣播群組不存在");

                return Ok(group);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取廣播群組失敗，ID: {GroupId}", id);
                return StatusCode(500, "獲取廣播群組失敗");
            }
        }

        /// <summary>
        /// 創建廣播群組
        /// </summary>
        [HttpPost("groups")]
        public async Task<IActionResult> CreateBroadcastGroup([FromBody] CreateBroadcastGroupRequest request)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var createdBy = GetCurrentUserId();
                if (string.IsNullOrEmpty(createdBy))
                {
                    _logger.LogWarning("CreateBroadcastGroup - No user ID found, using 'system'");
                    createdBy = "system";
                }

                if (string.IsNullOrEmpty(request.Name))
                    return BadRequest("群組名稱為必填欄位");

                var group = new BroadcastGroup
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    Name = request.Name?.Trim(),
                    Description = request.Description?.Trim(),
                    Color = request.Color?.Trim(),
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = createdBy,
                    UpdatedAt = null,
                    UpdatedBy = null
                };

                var createdGroup = await _contactListService.CreateBroadcastGroupAsync(group, createdBy);
                return CreatedAtAction(nameof(GetBroadcastGroups), createdGroup);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "創建廣播群組失敗");
                return StatusCode(500, "創建廣播群組失敗");
            }
        }

        /// <summary>
        /// 更新廣播群組
        /// </summary>
        [HttpPut("groups/{id}")]
        public async Task<IActionResult> UpdateBroadcastGroup(Guid id, [FromBody] UpdateBroadcastGroupRequest request)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var updatedBy = GetCurrentUserId();
                if (string.IsNullOrEmpty(updatedBy))
                {
                    _logger.LogWarning("UpdateBroadcastGroup - No user ID found, using 'system'");
                    updatedBy = "system";
                }

                if (string.IsNullOrEmpty(request.Name))
                    return BadRequest("群組名稱為必填欄位");

                // 先獲取所有群組，然後找到指定的群組
                var (allGroups, _) = await _contactListService.GetBroadcastGroupsAsync(companyId);
                var existingGroup = allGroups.FirstOrDefault(g => g.Id == id);
                if (existingGroup == null)
                    return NotFound("廣播群組不存在");

                var group = new BroadcastGroup
                {
                    Id = id,
                    CompanyId = companyId,
                    Name = request.Name?.Trim(),
                    Description = request.Description?.Trim(),
                    Color = request.Color?.Trim(),
                    IsActive = existingGroup.IsActive,
                    CreatedAt = existingGroup.CreatedAt,
                    CreatedBy = existingGroup.CreatedBy,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = updatedBy
                };

                var updatedGroup = await _contactListService.UpdateBroadcastGroupAsync(id, group, updatedBy);
                
                if (updatedGroup == null)
                    return NotFound("廣播群組不存在");

                return Ok(updatedGroup);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "更新廣播群組失敗，ID: {GroupId}", id);
                return StatusCode(500, "更新廣播群組失敗");
            }
        }

        /// <summary>
        /// 刪除廣播群組
        /// </summary>
        [HttpDelete("groups/{id}")]
        public async Task<IActionResult> DeleteBroadcastGroup(Guid id)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var deletedBy = GetCurrentUserId();
                var result = await _contactListService.DeleteBroadcastGroupAsync(id, companyId, deletedBy);
                
                if (!result)
                    return NotFound("廣播群組不存在或仍有聯絡人使用此群組");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "刪除廣播群組失敗，ID: {GroupId}", id);
                return StatusCode(500, "刪除廣播群組失敗");
            }
        }

        #endregion

        #region 標籤管理

        /// <summary>
        /// 獲取標籤統計數據
        /// </summary>
        [HttpGet("hashtags/statistics")]
        public async Task<IActionResult> GetHashtagsStatistics()
        {
            try
            {
                _logger.LogInformation("📊 開始獲取標籤統計數據");
                
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                {
                    _logger.LogWarning("❌ 無法識別公司資訊");
                    return Unauthorized("無法識別公司資訊");
                }

                var statistics = await _contactListService.GetHashtagsStatisticsAsync(companyId);
                
                _logger.LogInformation($"✅ 成功獲取標籤統計數據");
                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ 獲取標籤統計數據失敗: {Message}", ex.Message);
                return StatusCode(500, new { error = $"獲取統計數據失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 獲取標籤列表（支持分頁、排序、搜索）
        /// </summary>
        [HttpGet("hashtags")]
        public async Task<IActionResult> GetHashtags(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            [FromQuery] string? sortField = null,
            [FromQuery] string? sortOrder = null)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var (hashtags, totalCount) = await _contactListService.GetHashtagsAsync(companyId, page, pageSize, search, sortField, sortOrder);
                
                _logger.LogInformation("標籤查詢結果 - 數量: {HashtagCount}, 總數: {TotalCount}", hashtags?.Count ?? 0, totalCount);
                
                return Ok(new {
                    data = hashtags,
                    total = totalCount,
                    page = page,
                    pageSize = pageSize,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取標籤列表失敗");
                return StatusCode(500, "獲取標籤列表失敗");
            }
        }

        /// <summary>
        /// 創建標籤
        /// </summary>
        [HttpPost("hashtags")]
        public async Task<IActionResult> CreateHashtag([FromBody] CreateHashtagRequest request)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var createdBy = GetCurrentUserId();
                if (string.IsNullOrEmpty(createdBy))
                {
                    _logger.LogWarning("CreateHashtag - No user ID found, using 'system'");
                    createdBy = "system";
                }

                if (string.IsNullOrEmpty(request.Name))
                    return BadRequest("標籤名稱為必填欄位");

                var hashtag = new ContactHashtag
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    Name = request.Name?.Trim(),
                    Description = request.Description?.Trim(),
                    Color = request.Color?.Trim(),
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = createdBy
                };

                var createdHashtag = await _contactListService.CreateHashtagAsync(hashtag, createdBy);
                return CreatedAtAction(nameof(GetHashtags), createdHashtag);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "創建標籤失敗");
                return StatusCode(500, "創建標籤失敗");
            }
        }

        /// <summary>
        /// 更新標籤
        /// </summary>
        [HttpPut("hashtags/{id}")]
        public async Task<IActionResult> UpdateHashtag(Guid id, [FromBody] UpdateHashtagRequest request)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var updatedBy = GetCurrentUserId();
                if (string.IsNullOrEmpty(updatedBy))
                {
                    _logger.LogWarning("UpdateHashtag - No user ID found, using 'system'");
                    updatedBy = "system";
                }

                if (string.IsNullOrEmpty(request.Name))
                    return BadRequest("標籤名稱為必填欄位");

                // 先獲取所有標籤，然後找到指定的標籤
                var (allHashtags, _) = await _contactListService.GetHashtagsAsync(companyId);
                var existingHashtag = allHashtags.FirstOrDefault(h => h.Id == id);
                if (existingHashtag == null)
                    return NotFound("標籤不存在");

                var hashtag = new ContactHashtag
                {
                    Id = id,
                    CompanyId = companyId,
                    Name = request.Name?.Trim(),
                    Description = request.Description?.Trim(),
                    Color = request.Color?.Trim(),
                    IsActive = existingHashtag.IsActive,
                    CreatedAt = existingHashtag.CreatedAt,
                    CreatedBy = existingHashtag.CreatedBy
                };

                var updatedHashtag = await _contactListService.UpdateHashtagAsync(id, hashtag, updatedBy);
                
                if (updatedHashtag == null)
                    return NotFound("標籤不存在");

                return Ok(updatedHashtag);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "更新標籤失敗，ID: {HashtagId}", id);
                return StatusCode(500, "更新標籤失敗");
            }
        }

        /// <summary>
        /// 刪除標籤
        /// </summary>
        [HttpDelete("hashtags/{id}")]
        public async Task<IActionResult> DeleteHashtag(Guid id)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var deletedBy = GetCurrentUserId();
                var result = await _contactListService.DeleteHashtagAsync(id, companyId, deletedBy);
                
                if (!result)
                    return NotFound("標籤不存在或仍有聯絡人使用此標籤");

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "刪除標籤失敗，ID: {HashtagId}", id);
                return StatusCode(500, "刪除標籤失敗");
            }
        }

        #endregion



        #region 輔助方法

        /// <summary>
        /// 獲取當前用戶的公司ID
        /// </summary>
        private Guid GetCurrentCompanyId()
        {
            Console.WriteLine("🔍 GetCurrentCompanyId - Starting...");
            Console.WriteLine($"🔍 GetCurrentCompanyId - User.Identity.IsAuthenticated: {User.Identity?.IsAuthenticated}");
            Console.WriteLine($"🔍 GetCurrentCompanyId - User.Claims count: {User.Claims.Count()}");
            
            // 列出所有 claims 用於調試
            foreach (var claim in User.Claims)
            {
                Console.WriteLine($"🔍 Claim: {claim.Type} = {claim.Value}");
            }
            
            // 先嘗試小寫的 company_id（JWT token 中使用的）
            var companyIdClaim = User.FindFirst("company_id");
            Console.WriteLine($"🔍 company_id claim: {companyIdClaim?.Value ?? "null"}");
            
            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out var companyId))
            {
                Console.WriteLine($"✅ Found company_id: {companyId}");
                return companyId;
            }
            
            // 如果沒有找到，嘗試大寫的 CompanyId（向後兼容）
            companyIdClaim = User.FindFirst("CompanyId");
            Console.WriteLine($"🔍 CompanyId claim: {companyIdClaim?.Value ?? "null"}");
            
            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out companyId))
            {
                Console.WriteLine($"✅ Found CompanyId: {companyId}");
                return companyId;
            }
            
            Console.WriteLine("❌ No company ID found in claims");
            return Guid.Empty;
        }

        /// <summary>
        /// 獲取當前用戶ID
        /// </summary>
        private string GetCurrentUserId()
        {
            Console.WriteLine("🔍 GetCurrentUserId - Starting...");
            Console.WriteLine($"🔍 GetCurrentUserId - User.Identity.Name: '{User.Identity?.Name}'");
            Console.WriteLine($"🔍 GetCurrentUserId - User.Identity.IsAuthenticated: {User.Identity?.IsAuthenticated}");
            Console.WriteLine($"🔍 GetCurrentUserId - User.Claims count: {User.Claims.Count()}");
            
            // 列出所有 claims
            foreach (var claim in User.Claims)
            {
                Console.WriteLine($"🔍 GetCurrentUserId - Claim: {claim.Type} = {claim.Value}");
            }
            
            // 先嘗試 user_id claim（JWT token 中使用的）
            var userId = User.FindFirst("user_id")?.Value;
            Console.WriteLine($"🔍 GetCurrentUserId - Found user_id: '{userId}'");
            
            if (string.IsNullOrEmpty(userId))
            {
                // 如果沒有找到，嘗試 ClaimTypes.NameIdentifier
                userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                Console.WriteLine($"🔍 GetCurrentUserId - Found NameIdentifier: '{userId}'");
            }
            
            Console.WriteLine($"🔍 GetCurrentUserId - User ID is null: {userId == null}");
            Console.WriteLine($"🔍 GetCurrentUserId - User ID is empty: {string.IsNullOrEmpty(userId)}");
            
            _logger.LogInformation("GetCurrentUserId - Found user ID: {UserId}", userId);
            
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("GetCurrentUserId - No user ID found, using 'system'");
                Console.WriteLine("⚠️ GetCurrentUserId - No user ID found, using 'system'");
                return "system";
            }
            
            Console.WriteLine($"✅ GetCurrentUserId - Returning user ID: '{userId}'");
            return userId;
        }

        #endregion
    }
}
