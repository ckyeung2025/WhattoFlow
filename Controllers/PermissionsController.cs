using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/permissions")]
    [Authorize]
    public class PermissionsController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;

        public PermissionsController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("PermissionsController");
        }

        /// <summary>
        /// 獲取所有可用的介面列表
        /// </summary>
        [HttpGet("interfaces")]
        public IActionResult GetAvailableInterfaces()
        {
            try
            {
                // 定義所有可用的介面
                var interfaces = new[]
                {
                    new { key = "dashboard", label = "儀表板", category = "main", isParent = (bool?)false, parent = (string?)null },
                    new { key = "application", label = "應用區域", category = "main", isParent = (bool?)true, parent = (string?)null },
                    new { key = "publishedApps", label = "已發布應用", category = "application", isParent = (bool?)false, parent = "application" },
                    new { key = "pendingTasks", label = "待處理事項", category = "application", isParent = (bool?)false, parent = "application" },
                    new { key = "workflowMonitor", label = "運行中的應用", category = "application", isParent = (bool?)false, parent = "application" },
                    new { key = "studio", label = "工作室", category = "main", isParent = (bool?)true, parent = (string?)null },
                    new { key = "eformList", label = "表單管理", category = "studio", isParent = (bool?)false, parent = "studio" },
                    new { key = "whatsappTemplates", label = "訊息模版", category = "studio", isParent = (bool?)false, parent = "studio" },
                    new { key = "whatsappWorkflow", label = "工作流程設計", category = "studio", isParent = (bool?)false, parent = "studio" },
                    new { key = "dataSets", label = "數據集管理", category = "studio", isParent = (bool?)false, parent = "studio" },
                    new { key = "adminTools", label = "管理工具", category = "main", isParent = (bool?)true, parent = (string?)null },
                    new { key = "contactList", label = "聯絡人管理", category = "adminTools", isParent = (bool?)false, parent = "adminTools" },
                    new { key = "broadcastGroups", label = "廣播群組管理", category = "adminTools", isParent = (bool?)false, parent = "adminTools" },
                    new { key = "hashtags", label = "標籤管理", category = "adminTools", isParent = (bool?)false, parent = "adminTools" },
                    new { key = "companyUserAdmin", label = "公司/用戶管理", category = "adminTools", isParent = (bool?)false, parent = "adminTools" },
                    new { key = "phoneVerificationAdmin", label = "WhatsApp 電話號碼驗證管理", category = "adminTools", isParent = (bool?)false, parent = "adminTools" },
                    new { key = "permissionManagement", label = "權限管理", category = "adminTools", isParent = (bool?)false, parent = "adminTools" },
                    new { key = "apiProviders", label = "API 供應商管理", category = "adminTools", isParent = (bool?)false, parent = "adminTools" }
                };

                _loggingService.LogInformation("成功獲取可用介面列表");
                return Ok(interfaces);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取介面列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取介面列表失敗" });
            }
        }

        /// <summary>
        /// 獲取指定角色的介面權限
        /// </summary>
        [HttpGet("role/{roleId}")]
        public async Task<IActionResult> GetRoleInterfaces(Guid roleId, [FromQuery] Guid? companyId = null)
        {
            try
            {
                _loggingService.LogInformation($"開始查詢角色 {roleId} 的權限，CompanyId: {companyId}");

                List<string> permissions;

                if (companyId.HasValue)
                {
                    // 查詢公司自定義權限
                    var companyPermissions = await _context.RolesInterfaces
                        .Where(ri => ri.RoleId == roleId && ri.CompanyId == companyId && ri.IsActive)
                        .Select(ri => ri.InterfaceKey)
                        .ToListAsync();

                    _loggingService.LogInformation($"角色 {roleId} 在公司 {companyId} 下的權限記錄: {string.Join(", ", companyPermissions)}");

                    // 檢查該公司是否有任何角色的權限記錄
                    var companyHasAnyPermissions = await _context.RolesInterfaces
                        .AnyAsync(ri => ri.CompanyId == companyId);

                    if (companyPermissions.Any())
                    {
                        // 如果該角色在公司下有權限記錄，使用公司自定義權限
                        permissions = companyPermissions;
                        _loggingService.LogInformation($"角色 {roleId} 使用公司自定義權限，共 {permissions.Count} 個");
                    }
                    else if (companyHasAnyPermissions)
                    {
                        // 如果該角色在公司下沒有權限記錄，但公司已經開始管理權限，返回空列表（不回退到系統默認）
                        permissions = new List<string>();
                        _loggingService.LogInformation($"角色 {roleId} 在公司下沒有權限記錄，但公司已開始管理權限，返回空列表");
                    }
                    else
                    {
                        // 如果公司還沒有開始管理權限，才查詢系統默認權限
                        permissions = await _context.RolesInterfaces
                            .Where(ri => ri.RoleId == roleId && ri.CompanyId == null && ri.IsActive)
                            .Select(ri => ri.InterfaceKey)
                            .ToListAsync();
                        
                        _loggingService.LogInformation($"角色 {roleId} 使用系統默認權限，共 {permissions.Count} 個: {string.Join(", ", permissions)}");
                    }
                }
                else
                {
                    // 如果 companyId 為 null，查詢系統默認權限
                    permissions = await _context.RolesInterfaces
                        .Where(ri => ri.RoleId == roleId && ri.CompanyId == null && ri.IsActive)
                        .Select(ri => ri.InterfaceKey)
                        .ToListAsync();
                    
                    _loggingService.LogInformation($"角色 {roleId} 查詢系統默認權限，共 {permissions.Count} 個: {string.Join(", ", permissions)}");
                }

                _loggingService.LogInformation($"成功獲取角色 {roleId} 的介面權限，共 {permissions.Count} 個");
                return Ok(new { roleId, companyId, interfaces = permissions });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取角色介面權限失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取角色介面權限失敗" });
            }
        }

        /// <summary>
        /// 獲取用戶的有效權限（合併所有角色）
        /// </summary>
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserInterfaces(Guid userId)
        {
            try
            {
                // 獲取用戶信息
                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                {
                    return NotFound(new { error = "找不到該用戶" });
                }

                // 獲取用戶的所有角色
                var userRoles = await _context.UserRoles
                    .Where(ur => ur.UserId == userId && ur.IsActive)
                    .Select(ur => ur.RoleId)
                    .ToListAsync();

                if (!userRoles.Any())
                {
                    return Ok(new { userId, interfaces = new List<string>() });
                }

                // 對於每個角色，查詢權限（只返回實際設置的權限）
                var allInterfaces = new HashSet<string>();

                _loggingService.LogInformation($"開始查詢用戶 {userId} (公司ID: {user.CompanyId}) 的權限，角色數量: {userRoles.Count}");

                // 檢查該公司是否有任何角色的權限記錄（如果公司已經開始管理權限，就應該只返回明確設置的權限）
                var companyHasAnyPermissions = await _context.RolesInterfaces
                    .AnyAsync(ri => ri.CompanyId == user.CompanyId);
                
                _loggingService.LogInformation($"公司 {user.CompanyId} 是否有權限記錄: {companyHasAnyPermissions}");

                foreach (var roleId in userRoles)
                {
                    _loggingService.LogInformation($"查詢角色 {roleId} 的權限...");

                    // 優先查詢公司自定義權限（只查詢 IsActive = true 的）
                    var companyPermissions = await _context.RolesInterfaces
                        .Where(ri => ri.RoleId == roleId && ri.CompanyId == user.CompanyId && ri.IsActive)
                        .Select(ri => ri.InterfaceKey)
                        .ToListAsync();

                    _loggingService.LogInformation($"角色 {roleId} 在公司 {user.CompanyId} 下的權限記錄: {string.Join(", ", companyPermissions)}");

                    List<string> rolePermissions;

                    if (companyPermissions.Any())
                    {
                        // 如果該角色在公司下有權限記錄，使用公司自定義權限
                        rolePermissions = companyPermissions;
                        _loggingService.LogInformation($"角色 {roleId} 使用公司自定義權限，共 {rolePermissions.Count} 個: {string.Join(", ", rolePermissions)}");
                    }
                    else if (companyHasAnyPermissions)
                    {
                        // 如果該角色在公司下沒有權限記錄，但公司已經開始管理權限，返回空列表（不回退到系統默認）
                        rolePermissions = new List<string>();
                        _loggingService.LogInformation($"角色 {roleId} 在公司下沒有權限記錄，但公司已開始管理權限，返回空列表");
                    }
                    else
                    {
                        // 如果公司還沒有開始管理權限，才查詢系統默認權限
                        rolePermissions = await _context.RolesInterfaces
                            .Where(ri => ri.RoleId == roleId && ri.CompanyId == null && ri.IsActive)
                            .Select(ri => ri.InterfaceKey)
                            .ToListAsync();
                        
                        _loggingService.LogInformation($"角色 {roleId} 使用系統默認權限，共 {rolePermissions.Count} 個: {string.Join(", ", rolePermissions)}");
                    }

                    // 合併權限（只添加實際在資料庫中設置的權限）
                    foreach (var interfaceKey in rolePermissions)
                    {
                        allInterfaces.Add(interfaceKey);
                    }
                }

                _loggingService.LogInformation($"用戶 {userId} 的角色權限（未展開前）: {string.Join(", ", allInterfaces)}");

                // 處理父子級關係（有父級權限自動包含子級）
                // 注意：只展開實際在資料庫中存在的父級權限
                var expandedInterfaces = ExpandInterfacesWithChildren(allInterfaces.ToList());

                _loggingService.LogInformation($"用戶 {userId} 的角色權限（展開後）: {string.Join(", ", expandedInterfaces)}");
                _loggingService.LogInformation($"成功獲取用戶 {userId} 的介面權限，共 {expandedInterfaces.Count} 個");
                
                return Ok(new { userId, interfaces = expandedInterfaces });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取用戶介面權限失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取用戶介面權限失敗" });
            }
        }

        /// <summary>
        /// 批量設置角色的介面權限
        /// </summary>
        [HttpPost("role/{roleId}")]
        public async Task<IActionResult> SetRoleInterfaces(Guid roleId, [FromBody] SetRoleInterfacesRequest request)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                if (string.IsNullOrEmpty(currentUserId))
                {
                    return Unauthorized(new { error = "無法識別當前用戶" });
                }

                // 檢查角色是否存在
                var role = await _context.Roles.FindAsync(roleId);
                if (role == null)
                {
                    return NotFound(new { error = "找不到該角色" });
                }

                // 如果 companyId 為 null，則設置系統默認權限（僅 Tenant_Admin 可操作）
                // 這裡可以添加權限檢查邏輯

                _loggingService.LogInformation($"開始設置角色 {roleId} 的權限，CompanyId: {request.CompanyId}, 權限數量: {request.InterfaceKeys?.Count ?? 0}");
                if (request.InterfaceKeys != null && request.InterfaceKeys.Any())
                {
                    _loggingService.LogInformation($"要設置的權限: {string.Join(", ", request.InterfaceKeys)}");
                }

                // 刪除現有的權限配置（包括 IsActive = false 的，確保完全清除）
                var existingPermissions = await _context.RolesInterfaces
                    .Where(ri => ri.RoleId == roleId && ri.CompanyId == request.CompanyId)
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {existingPermissions.Count} 個現有權限記錄需要刪除");
                if (existingPermissions.Any())
                {
                    _loggingService.LogInformation($"現有權限記錄: {string.Join(", ", existingPermissions.Select(ri => $"{ri.InterfaceKey}(IsActive={ri.IsActive})"))}");
                }

                _context.RolesInterfaces.RemoveRange(existingPermissions);

                // 添加新的權限配置
                if (request.InterfaceKeys != null && request.InterfaceKeys.Any())
                {
                    foreach (var interfaceKey in request.InterfaceKeys)
                    {
                        var roleInterface = new RolesInterface
                        {
                            Id = Guid.NewGuid(),
                            RoleId = roleId,
                            CompanyId = request.CompanyId,
                            InterfaceKey = interfaceKey,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.RolesInterfaces.Add(roleInterface);
                    }
                    _loggingService.LogInformation($"添加了 {request.InterfaceKeys.Count} 個新權限記錄");
                }
                else
                {
                    _loggingService.LogInformation($"沒有要添加的權限，所有現有權限已刪除");
                }

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功設置角色 {roleId} 的介面權限");
                return Ok(new { success = true, message = "權限設置成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"設置角色介面權限失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "設置角色介面權限失敗" });
            }
        }

        /// <summary>
        /// 添加角色的介面權限
        /// </summary>
        [HttpPut("role/{roleId}/interface")]
        public async Task<IActionResult> AddRoleInterface(Guid roleId, [FromBody] AddRoleInterfaceRequest request)
        {
            try
            {
                // 檢查是否已存在
                var existing = await _context.RolesInterfaces
                    .FirstOrDefaultAsync(ri => ri.RoleId == roleId && 
                                               ri.CompanyId == request.CompanyId && 
                                               ri.InterfaceKey == request.InterfaceKey);

                if (existing != null)
                {
                    // 如果存在但未啟用，則啟用它
                    if (!existing.IsActive)
                    {
                        existing.IsActive = true;
                        existing.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                    }
                    return Ok(new { success = true, message = "權限已存在" });
                }

                // 創建新的權限記錄
                var roleInterface = new RolesInterface
                {
                    Id = Guid.NewGuid(),
                    RoleId = roleId,
                    CompanyId = request.CompanyId,
                    InterfaceKey = request.InterfaceKey,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.RolesInterfaces.Add(roleInterface);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功添加角色 {roleId} 的介面權限 {request.InterfaceKey}");
                return Ok(new { success = true, message = "權限添加成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"添加角色介面權限失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "添加角色介面權限失敗" });
            }
        }

        /// <summary>
        /// 刪除角色的介面權限
        /// </summary>
        [HttpDelete("role/{roleId}/interface/{interfaceKey}")]
        public async Task<IActionResult> RemoveRoleInterface(Guid roleId, string interfaceKey, [FromQuery] Guid? companyId = null)
        {
            try
            {
                var roleInterface = await _context.RolesInterfaces
                    .FirstOrDefaultAsync(ri => ri.RoleId == roleId && 
                                               ri.CompanyId == companyId && 
                                               ri.InterfaceKey == interfaceKey);

                if (roleInterface == null)
                {
                    return NotFound(new { error = "找不到該權限配置" });
                }

                // 軟刪除
                roleInterface.IsActive = false;
                roleInterface.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功刪除角色 {roleId} 的介面權限 {interfaceKey}");
                return Ok(new { success = true, message = "權限刪除成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"刪除角色介面權限失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "刪除角色介面權限失敗" });
            }
        }

        /// <summary>
        /// 處理父子級權限關係（有父級權限自動包含子級）
        /// </summary>
        private List<string> ExpandInterfacesWithChildren(List<string> interfaces)
        {
            var interfaceHierarchy = new Dictionary<string, List<string>>
            {
                { "application", new List<string> { "publishedApps", "pendingTasks", "workflowMonitor" } },
                { "studio", new List<string> { "eformList", "whatsappTemplates", "whatsappWorkflow", "dataSets" } },
                { "adminTools", new List<string> { "contactList", "broadcastGroups", "hashtags", "companyUserAdmin", "phoneVerificationAdmin", "permissionManagement", "apiProviders" } }
            };

            var expanded = new HashSet<string>(interfaces);

            foreach (var parent in interfaceHierarchy.Keys)
            {
                if (interfaces.Contains(parent))
                {
                    // 如果有父級權限，自動添加所有子級
                    foreach (var child in interfaceHierarchy[parent])
                    {
                        expanded.Add(child);
                    }
                }
            }

            return expanded.ToList();
        }

        /// <summary>
        /// 獲取當前用戶ID
        /// </summary>
        private string GetCurrentUserId()
        {
            return User.Claims.FirstOrDefault(c => c.Type == "user_id")?.Value ?? string.Empty;
        }
    }

    /// <summary>
    /// 設置角色介面權限請求模型
    /// </summary>
    public class SetRoleInterfacesRequest
    {
        public Guid? CompanyId { get; set; }
        public List<string> InterfaceKeys { get; set; } = new List<string>();
    }

    /// <summary>
    /// 添加角色介面權限請求模型
    /// </summary>
    public class AddRoleInterfaceRequest
    {
        public Guid? CompanyId { get; set; }
        public string InterfaceKey { get; set; } = string.Empty;
    }
}

