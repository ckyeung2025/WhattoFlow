using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    /// <summary>
    /// 公司權限初始化控制器
    /// 用於為新公司或現有公司初始化權限設置
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CompanyPermissionsController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;

        public CompanyPermissionsController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("CompanyPermissionsController");
        }

        /// <summary>
        /// 為指定公司初始化權限（從系統默認權限複製）
        /// </summary>
        [HttpPost("initialize/{companyId}")]
        public async Task<IActionResult> InitializeCompanyPermissions(Guid companyId)
        {
            try
            {
                // 檢查公司是否存在
                var company = await _context.Companies.FindAsync(companyId);
                if (company == null)
                {
                    return NotFound(new { error = "找不到指定的公司" });
                }

                // 檢查該公司是否已經有權限配置
                var existingPermissions = await _context.RolesInterfaces
                    .Where(ri => ri.CompanyId == companyId)
                    .CountAsync();

                if (existingPermissions > 0)
                {
                    return Ok(new
                    {
                        message = $"公司 {company.Name} 已經有 {existingPermissions} 條權限配置，無需重新初始化",
                        companyId = companyId,
                        existingCount = existingPermissions
                    });
                }

                // 獲取所有系統默認權限（company_id = NULL）
                var systemDefaults = await _context.RolesInterfaces
                    .Where(ri => ri.CompanyId == null && ri.IsActive)
                    .ToListAsync();

                if (!systemDefaults.Any())
                {
                    return BadRequest(new { error = "系統默認權限不存在，請先創建系統默認權限" });
                }

                // 為該公司複製所有系統默認權限
                int addedCount = 0;
                foreach (var systemDefault in systemDefaults)
                {
                    // 檢查是否已存在（防止重複）
                    var exists = await _context.RolesInterfaces
                        .AnyAsync(ri => ri.RoleId == systemDefault.RoleId &&
                                       ri.CompanyId == companyId &&
                                       ri.InterfaceKey == systemDefault.InterfaceKey);

                    if (!exists)
                    {
                        var companyPermission = new RolesInterface
                        {
                            Id = Guid.NewGuid(),
                            RoleId = systemDefault.RoleId,
                            CompanyId = companyId,
                            InterfaceKey = systemDefault.InterfaceKey,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        _context.RolesInterfaces.Add(companyPermission);
                        addedCount++;
                    }
                }

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功為公司 {company.Name} (ID: {companyId}) 初始化 {addedCount} 條權限");

                return Ok(new
                {
                    success = true,
                    message = $"成功為公司 {company.Name} 初始化 {addedCount} 條權限",
                    companyId = companyId,
                    companyName = company.Name,
                    addedCount = addedCount
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"初始化公司權限失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "初始化公司權限失敗" });
            }
        }

        /// <summary>
        /// 為所有公司初始化權限（批量操作）
        /// </summary>
        [HttpPost("initialize-all")]
        public async Task<IActionResult> InitializeAllCompaniesPermissions()
        {
            try
            {
                // 獲取所有公司（Company 模型沒有 IsActive 屬性）
                var companies = await _context.Companies
                    .ToListAsync();

                if (!companies.Any())
                {
                    return Ok(new { message = "沒有需要初始化的公司" });
                }

                // 獲取所有系統默認權限
                var systemDefaults = await _context.RolesInterfaces
                    .Where(ri => ri.CompanyId == null && ri.IsActive)
                    .ToListAsync();

                if (!systemDefaults.Any())
                {
                    return BadRequest(new { error = "系統默認權限不存在，請先創建系統默認權限" });
                }

                int totalAdded = 0;
                var results = new List<object>();

                foreach (var company in companies)
                {
                    int addedCount = 0;

                    foreach (var systemDefault in systemDefaults)
                    {
                        // 檢查是否已存在
                        var exists = await _context.RolesInterfaces
                            .AnyAsync(ri => ri.RoleId == systemDefault.RoleId &&
                                           ri.CompanyId == company.Id &&
                                           ri.InterfaceKey == systemDefault.InterfaceKey);

                        if (!exists)
                        {
                            var companyPermission = new RolesInterface
                            {
                                Id = Guid.NewGuid(),
                                RoleId = systemDefault.RoleId,
                                CompanyId = company.Id,
                                InterfaceKey = systemDefault.InterfaceKey,
                                IsActive = true,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow
                            };

                            _context.RolesInterfaces.Add(companyPermission);
                            addedCount++;
                            totalAdded++;
                        }
                    }

                    results.Add(new
                    {
                        companyId = company.Id,
                        companyName = company.Name,
                        addedCount = addedCount
                    });
                }

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"成功為 {companies.Count} 個公司初始化權限，共添加 {totalAdded} 條權限記錄");

                return Ok(new
                {
                    success = true,
                    message = $"成功為 {companies.Count} 個公司初始化權限",
                    totalCompanies = companies.Count,
                    totalAdded = totalAdded,
                    results = results
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"批量初始化公司權限失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "批量初始化公司權限失敗" });
            }
        }

        /// <summary>
        /// 檢查公司權限初始化狀態
        /// </summary>
        [HttpGet("status")]
        public async Task<IActionResult> GetInitializationStatus()
        {
            try
            {
                var companies = await _context.Companies
                    .Select(c => new
                    {
                        companyId = c.Id,
                        companyName = c.Name,
                        permissionCount = _context.RolesInterfaces
                            .Count(ri => ri.CompanyId == c.Id && ri.IsActive)
                    })
                    .ToListAsync();

                var systemDefaultCount = await _context.RolesInterfaces
                    .CountAsync(ri => ri.CompanyId == null && ri.IsActive);

                var companiesWithoutPermissions = companies
                    .Where(c => c.permissionCount == 0)
                    .Count();

                return Ok(new
                {
                    totalCompanies = companies.Count,
                    companiesWithoutPermissions = companiesWithoutPermissions,
                    systemDefaultPermissionCount = systemDefaultCount,
                    companies = companies
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取初始化狀態失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取初始化狀態失敗" });
            }
        }
    }
}

