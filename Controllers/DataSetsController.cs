using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using PurpleRice.Models.DTOs;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;
using PurpleRice.Services;
using Microsoft.Data.SqlClient;
using Google.Apis.Sheets.v4;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DataSetsController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly ILogger<DataSetsController> _logger;
        private readonly IWebHostEnvironment _environment;
        private readonly LoggingService _loggingService;
        private readonly IGoogleSheetsService _googleSheetsService;
        private readonly IServiceProvider _serviceProvider;

        public DataSetsController(PurpleRiceDbContext context, ILogger<DataSetsController> logger, IWebHostEnvironment environment, Func<string, LoggingService> loggingServiceFactory, IGoogleSheetsService googleSheetsService, IServiceProvider serviceProvider)
        {
            _context = context;
            _logger = logger;
            _environment = environment;
            _loggingService = loggingServiceFactory("DataSetsController");
            _googleSheetsService = googleSheetsService;
            _serviceProvider = serviceProvider;
        }

        private Guid GetCurrentCompanyId()
        {
            var companyClaim = User?.FindFirst("company_id")
                ?? User?.FindFirst(ClaimTypes.GroupSid)
                ?? User?.FindFirst(ClaimTypes.PrimaryGroupSid);

            if (companyClaim != null && Guid.TryParse(companyClaim.Value, out var companyId))
            {
                return companyId;
            }

            _loggingService.LogWarning("DataSetsController - 無法從使用者權杖取得公司 ID");
            return Guid.Empty;
        }

        // GET: api/datasets
        [HttpGet]
        public async Task<ActionResult<object>> GetDataSets(
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string sortBy = "createdAt",
            [FromQuery] string sortOrder = "desc")
        {
            try
            {
                _loggingService.LogInformation($"開始獲取數據集列表，搜索條件: {search}, 頁碼: {page}, 每頁大小: {pageSize}, 排序字段: {sortBy}, 排序順序: {sortOrder}");
                var query = _context.DataSets
                    .Include(d => d.Columns.OrderBy(c => c.SortOrder))
                    .Include(d => d.DataSources)
                    .AsQueryable();

                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(d => d.Name.Contains(search) || d.Description.Contains(search));
                }

                var totalCount = await query.CountAsync();
                
                // 動態排序
                _loggingService.LogInformation($"執行排序，字段: {sortBy}, 順序: {sortOrder}");
                switch (sortBy.ToLower())
                {
                    case "name":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(d => d.Name) : query.OrderByDescending(d => d.Name);
                        _loggingService.LogInformation($"按名稱排序: {sortOrder}");
                        break;
                    case "datasourcetype":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(d => d.DataSourceType) : query.OrderByDescending(d => d.DataSourceType);
                        _loggingService.LogInformation($"按數據源類型排序: {sortOrder}");
                        break;
                    case "status":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(d => d.Status) : query.OrderByDescending(d => d.Status);
                        _loggingService.LogInformation($"按狀態排序: {sortOrder}");
                        break;
                    case "totalrecords":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(d => d.TotalRecords) : query.OrderByDescending(d => d.TotalRecords);
                        _loggingService.LogInformation($"按記錄數排序: {sortOrder}");
                        break;
                    case "lastdatasynctime":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(d => d.LastDataSyncTime) : query.OrderByDescending(d => d.LastDataSyncTime);
                        _loggingService.LogInformation($"按最後同步時間排序: {sortOrder}");
                        break;
                    case "createdat":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(d => d.CreatedAt) : query.OrderByDescending(d => d.CreatedAt);
                        _loggingService.LogInformation($"按創建時間排序: {sortOrder}");
                        break;
                    case "updatedat":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(d => d.UpdatedAt) : query.OrderByDescending(d => d.UpdatedAt);
                        _loggingService.LogInformation($"按更新時間排序: {sortOrder}");
                        break;
                    default:
                        query = query.OrderByDescending(d => d.CreatedAt);
                        _loggingService.LogInformation($"使用預設排序: 按創建時間降序");
                        break;
                }
                
                var dataSets = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                // 轉換為 DTO 避免循環引用
                var dataSetDtos = dataSets.Select(ds => new DataSetDto
                {
                    Id = ds.Id,
                    Name = ds.Name,
                    Description = ds.Description,
                    DataSourceType = ds.DataSourceType,
                    CompanyId = ds.CompanyId,
                    Status = ds.Status,
                    IsScheduled = ds.IsScheduled,
                    UpdateIntervalMinutes = ds.UpdateIntervalMinutes,
                    LastUpdateTime = ds.LastUpdateTime,
                    NextUpdateTime = ds.NextUpdateTime,
                    TotalRecords = ds.TotalRecords,
                    LastDataSyncTime = ds.LastDataSyncTime,
                    SyncDirection = ds.SyncDirection ?? "inbound",
                    CreatedAt = ds.CreatedAt,
                    CreatedBy = ds.CreatedBy,
                    UpdatedAt = ds.UpdatedAt,
                    UpdatedBy = ds.UpdatedBy,
                    
                    // 同步狀態管理
                    SyncStatus = ds.SyncStatus,
                    SyncStartedAt = ds.SyncStartedAt,
                    SyncCompletedAt = ds.SyncCompletedAt,
                    SyncErrorMessage = ds.SyncErrorMessage,
                    SyncStartedBy = ds.SyncStartedBy,
                    
                    // 進度追蹤
                    TotalRecordsToSync = ds.TotalRecordsToSync ?? 0,
                    RecordsProcessed = ds.RecordsProcessed ?? 0,
                    RecordsInserted = ds.RecordsInserted ?? 0,
                    RecordsUpdated = ds.RecordsUpdated ?? 0,
                    RecordsDeleted = ds.RecordsDeleted ?? 0,
                    RecordsSkipped = ds.RecordsSkipped ?? 0,
                    
                    // 批次處理設定
                    BatchSize = ds.BatchSize ?? 1000,
                    MaxSyncDurationMinutes = ds.MaxSyncDurationMinutes ?? 60,
                    AllowOverlap = ds.AllowOverlap ?? false,
                    
                    Columns = ds.Columns.Select(c => new DataSetColumnDto
                    {
                        Id = c.Id,
                        DataSetId = c.DataSetId,
                        ColumnName = c.ColumnName,
                        DisplayName = c.DisplayName,
                        DataType = c.DataType,
                        MaxLength = c.MaxLength,
                        IsRequired = c.IsRequired,
                        IsPrimaryKey = c.IsPrimaryKey,
                        IsIndexed = c.IsIndexed,
                        IsSearchable = c.IsSearchable,
                        IsSortable = c.IsSortable,
                        DefaultValue = c.DefaultValue,
                        SortOrder = c.SortOrder
                    }).ToList(),
                    DataSource = ds.DataSources.FirstOrDefault() is var dataSource && dataSource != null ? new DataSetDataSourceDto
                    {
                        Id = dataSource.Id,
                        DataSetId = dataSource.DataSetId,
                        SourceType = dataSource.SourceType,
                        SqlQuery = dataSource.SqlQuery,
                        DatabaseConnection = dataSource.DatabaseConnection,
                        TargetTableName = dataSource.TargetTableName, // 包含目標表名
                        ExcelFilePath = dataSource.ExcelFilePath,
                        ExcelSheetName = dataSource.ExcelSheetName,
                        GoogleDocsUrl = dataSource.GoogleDocsUrl,
                        GoogleDocsSheetName = dataSource.GoogleDocsSheetName,
                        SqlParameters = dataSource.SqlParameters,
                        AuthenticationConfig = dataSource.AuthenticationConfig,
                        LastUpdateTime = dataSource.LastUpdateTime
                    } : null
                }).ToList();

                _loggingService.LogInformation($"成功獲取數據集列表，共 {totalCount} 條數據，分頁結果: 頁碼 {page}, 每頁 {pageSize}, 總頁數 {(int)Math.Ceiling((double)totalCount / pageSize)}");
                return Ok(new
                {
                    success = true,
                    data = dataSetDtos,
                    pagination = new
                    {
                        page,
                        pageSize,
                        totalCount,
                        totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError("Error getting data sets", ex);
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        // GET: api/datasets/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<DataSet>> GetDataSet(Guid id)
        {
            try
            {
                _loggingService.LogInformation($"開始獲取數據集，ID: {id}");
                
                // 先檢查 DataSet 是否存在
                var dataSetExists = await _context.DataSets.AnyAsync(ds => ds.Id == id);
                if (!dataSetExists)
                {
                    _loggingService.LogWarning($"數據集不存在，ID: {id}");
                    return NotFound(new { success = false, message = "DataSet 不存在" });
                }
                
                // 獲取 DataSet 基本信息
                var dataSet = await _context.DataSets
                    .FirstOrDefaultAsync(ds => ds.Id == id);
                
                if (dataSet == null)
                {
                    _loggingService.LogWarning($"數據集獲取失敗，ID: {id}");
                    return NotFound(new { success = false, message = "DataSet 獲取失敗" });
                }
                
                // 分別獲取關聯數據，避免循環引用
                try
                {
                    var columns = await _context.DataSetColumns
                        .Where(c => c.DataSetId == id)
                        .OrderBy(c => c.SortOrder)
                        .Select(c => new DataSetColumn
                        {
                            Id = c.Id,
                            DataSetId = c.DataSetId,
                            ColumnName = c.ColumnName,
                            DisplayName = c.DisplayName,
                            DataType = c.DataType,
                            MaxLength = c.MaxLength,
                            IsRequired = c.IsRequired,
                            IsPrimaryKey = c.IsPrimaryKey,
                            IsSearchable = c.IsSearchable,
                            IsSortable = c.IsSortable,
                            IsIndexed = c.IsIndexed,
                            DefaultValue = c.DefaultValue,
                            SortOrder = c.SortOrder
                            // 不包含 DataSet 導航屬性，避免循環引用
                        })
                        .ToListAsync();
                    dataSet.Columns = columns;
                }
                catch (Exception ex)
                {
                    _loggingService.LogWarning($"獲取 DataSet 欄位失敗，ID: {id}, 錯誤: {ex.Message}");
                    dataSet.Columns = new List<DataSetColumn>();
                }
                
                try
                {
                    var dataSources = await _context.DataSetDataSources
                        .Where(ds => ds.DataSetId == id)
                        .Select(ds => new DataSetDataSource
                        {
                            Id = ds.Id,
                            DataSetId = ds.DataSetId,
                            SourceType = ds.SourceType,
                            DatabaseConnection = ds.DatabaseConnection,
                            SqlQuery = ds.SqlQuery,
                            SqlParameters = ds.SqlParameters,
                            ExcelFilePath = ds.ExcelFilePath,
                            ExcelSheetName = ds.ExcelSheetName,
                            GoogleDocsUrl = ds.GoogleDocsUrl,
                            GoogleDocsSheetName = ds.GoogleDocsSheetName,
                            AuthenticationConfig = ds.AuthenticationConfig,
                            LastUpdateTime = ds.LastUpdateTime
                            // 不包含 DataSet 導航屬性，避免循環引用
                        })
                        .ToListAsync();
                    dataSet.DataSources = dataSources;
                }
                catch (Exception ex)
                {
                    _loggingService.LogWarning($"獲取 DataSet 數據源失敗，ID: {id}, 錯誤: {ex.Message}");
                    dataSet.DataSources = new List<DataSetDataSource>();
                }

                _loggingService.LogInformation($"成功獲取數據集，ID: {id}");
                return Ok(new { success = true, data = dataSet });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取 DataSet 失敗，ID: {id}, 錯誤: {ex.Message}", ex);
                return StatusCode(500, new { success = false, message = $"獲取 DataSet 失敗: {ex.Message}" });
            }
        }

        // POST: api/datasets
        [HttpPost]
        public async Task<ActionResult<DataSet>> CreateDataSet([FromBody] CreateDataSetRequest request)
        {
            try
            {
                _loggingService.LogInformation($"開始創建數據集: {request.Name}, 數據源類型: {request.DataSourceType}");
                
                var dataSet = new DataSet
                {
                    Id = Guid.NewGuid(),
                    Name = request.Name,
                    Description = request.Description,
                    DataSourceType = request.DataSourceType,
                    CompanyId = request.CompanyId,
                    Status = "Active",
                    IsScheduled = request.IsScheduled,
                    UpdateIntervalMinutes = request.UpdateIntervalMinutes,
                    SyncDirection = request.SyncDirection ?? "inbound",
                    CreatedBy = request.CreatedBy,
                    CreatedAt = DateTime.UtcNow
                };

                _context.DataSets.Add(dataSet);

                // 添加欄位定義
                if (request.Columns != null)
                {
                    foreach (var col in request.Columns)
                    {
                        var column = new DataSetColumn
                        {
                            Id = Guid.NewGuid(),
                            DataSetId = dataSet.Id,
                            ColumnName = col.ColumnName,
                            DisplayName = col.DisplayName,
                            DataType = col.DataType,
                            MaxLength = col.MaxLength,
                            IsRequired = col.IsRequired,
                            IsPrimaryKey = col.IsPrimaryKey,
                            IsSearchable = col.IsSearchable,
                            IsSortable = col.IsSortable,
                            IsIndexed = col.IsIndexed,
                            DefaultValue = col.DefaultValue,
                            SortOrder = col.SortOrder
                        };
                        _context.DataSetColumns.Add(column);
                    }
                }

                // 添加數據源配置
                if (request.DataSource != null)
                {
                    _loggingService.LogInformation($"創建數據源配置: {request.DataSource.SourceType}");
                    
                    var dataSource = new DataSetDataSource
                    {
                        Id = Guid.NewGuid(),
                        DataSetId = dataSet.Id,
                        SourceType = request.DataSource.SourceType,
                        DatabaseConnection = request.DataSource.DatabaseConnection,
                        SqlQuery = request.DataSource.SqlQuery,
                        SqlParameters = request.DataSource.SqlParameters,
                        TargetTableName = request.DataSource.TargetTableName, // 設置目標表名
                        ExcelFilePath = request.DataSource.ExcelFilePath,
                        ExcelSheetName = request.DataSource.ExcelSheetName,
                        GoogleDocsUrl = request.DataSource.GoogleDocsUrl,
                        GoogleDocsSheetName = request.DataSource.GoogleDocsSheetName,
                        AuthenticationConfig = request.DataSource.AuthenticationConfig
                    };
                    
                    _loggingService.LogInformation($"Excel 相關配置 - 文件路徑: {request.DataSource.ExcelFilePath}, 工作表: {request.DataSource.ExcelSheetName}");
                    
                    _context.DataSetDataSources.Add(dataSource);
                }
                else
                {
                    _loggingService.LogWarning("請求中沒有包含數據源配置");
                }

                await _context.SaveChangesAsync();

                // 返回 DTO 避免循環引用
                var dataSetDto = new DataSetDto
                {
                    Id = dataSet.Id,
                    Name = dataSet.Name,
                    Description = dataSet.Description,
                    DataSourceType = dataSet.DataSourceType,
                    CompanyId = dataSet.CompanyId,
                    Status = dataSet.Status,
                    IsScheduled = dataSet.IsScheduled,
                    UpdateIntervalMinutes = dataSet.UpdateIntervalMinutes,
                    SyncDirection = dataSet.SyncDirection,
                    CreatedBy = dataSet.CreatedBy,
                    CreatedAt = dataSet.CreatedAt,
                    
                    // 同步狀態管理
                    SyncStatus = dataSet.SyncStatus,
                    SyncStartedAt = dataSet.SyncStartedAt,
                    SyncCompletedAt = dataSet.SyncCompletedAt,
                    SyncErrorMessage = dataSet.SyncErrorMessage,
                    SyncStartedBy = dataSet.SyncStartedBy,
                    
                    // 進度追蹤
                    TotalRecordsToSync = dataSet.TotalRecordsToSync ?? 0,
                    RecordsProcessed = dataSet.RecordsProcessed ?? 0,
                    RecordsInserted = dataSet.RecordsInserted ?? 0,
                    RecordsUpdated = dataSet.RecordsUpdated ?? 0,
                    RecordsDeleted = dataSet.RecordsDeleted ?? 0,
                    RecordsSkipped = dataSet.RecordsSkipped ?? 0,
                    
                    // 批次處理設定
                    BatchSize = dataSet.BatchSize ?? 1000,
                    MaxSyncDurationMinutes = dataSet.MaxSyncDurationMinutes ?? 60,
                    AllowOverlap = dataSet.AllowOverlap ?? false
                };

                return CreatedAtAction(nameof(GetDataSet), new { id = dataSet.Id }, 
                    new { success = true, data = dataSetDto });
            }
            catch (Exception ex)
            {
                _loggingService.LogError("創建 DataSet 失敗", ex);
                return StatusCode(500, new { success = false, message = "創建 DataSet 失敗" });
            }
        }

        // PUT: api/datasets/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDataSet(Guid id, [FromBody] UpdateDataSetRequest request)
        {
            try
            {
                _loggingService.LogInformation($"開始更新數據集，ID: {id}");
                _loggingService.LogDebug($"請求數據詳細內容: {JsonSerializer.Serialize(request, new JsonSerializerOptions { WriteIndented = true })}");
                
                var dataSet = await _context.DataSets
                    .Include(ds => ds.DataSources)  // 包含數據源
                    .Include(ds => ds.Columns)      // 包含欄位定義
                    .FirstOrDefaultAsync(ds => ds.Id == id);
                    
                if (dataSet == null)
                {
                    _loggingService.LogWarning($"數據集不存在，ID: {id}");
                    return NotFound(new { success = false, message = "DataSet 不存在" });
                }

                _loggingService.LogInformation($"更新前的數據集狀態:");
                _loggingService.LogInformation($"  - 名稱: {dataSet.Name}");
                _loggingService.LogInformation($"  - 描述: {dataSet.Description}");
                _loggingService.LogInformation($"  - 狀態: {dataSet.Status}");
                _loggingService.LogInformation($"  - 定時更新: {dataSet.IsScheduled}");
                _loggingService.LogInformation($"  - 更新間隔: {dataSet.UpdateIntervalMinutes} 分鐘");
                _loggingService.LogInformation($"  - 最後更新時間: {dataSet.UpdatedAt}");
                _loggingService.LogInformation($"  - 最後更新者: {dataSet.UpdatedBy}");

                // 記錄數據源狀態
                var dataSource = dataSet.DataSources.FirstOrDefault();
                if (dataSource != null)
                {
                    _loggingService.LogInformation($"更新前的數據源狀態:");
                    _loggingService.LogInformation($"  - 數據源類型: {dataSource.SourceType}");
                    _loggingService.LogInformation($"  - SQL 查詢: {dataSource.SqlQuery}");
                    _loggingService.LogInformation($"  - 數據庫連接: {dataSource.DatabaseConnection}");
                    _loggingService.LogInformation($"  - 認證配置: {dataSource.AuthenticationConfig}");
                }

                // 記錄請求中的更新字段
                _loggingService.LogInformation($"請求中要更新的字段:");
                if (request.Name != null) _loggingService.LogInformation($"  - 名稱: {request.Name}");
                if (request.Description != null) _loggingService.LogInformation($"  - 描述: {request.Description}");
                if (request.Status != null) _loggingService.LogInformation($"  - 狀態: {request.Status}");
                if (request.IsScheduled.HasValue) _loggingService.LogInformation($"  - 定時更新: {request.IsScheduled}");
                if (request.UpdateIntervalMinutes.HasValue) _loggingService.LogInformation($"  - 更新間隔: {request.UpdateIntervalMinutes} 分鐘");
                _loggingService.LogInformation($"  - 更新者: {request.UpdatedBy}");

                // 執行基本字段更新
                var originalName = dataSet.Name;
                var originalDescription = dataSet.Description;
                var originalStatus = dataSet.Status;
                var originalIsScheduled = dataSet.IsScheduled;
                var originalUpdateIntervalMinutes = dataSet.UpdateIntervalMinutes;

                dataSet.Name = request.Name ?? dataSet.Name;
                dataSet.Description = request.Description ?? dataSet.Description;
                dataSet.Status = request.Status ?? dataSet.Status;
                dataSet.IsScheduled = request.IsScheduled ?? dataSet.IsScheduled;
                dataSet.UpdateIntervalMinutes = request.UpdateIntervalMinutes ?? dataSet.UpdateIntervalMinutes;
                if (request.SyncDirection != null)
                {
                    dataSet.SyncDirection = request.SyncDirection;
                }
                dataSet.UpdatedBy = request.UpdatedBy;
                dataSet.UpdatedAt = DateTime.UtcNow;

                // 更新數據源配置
                if (request.DataSource != null && dataSource != null)
                {
                    _loggingService.LogInformation($"開始更新數據源配置:");
                    _loggingService.LogInformation($"  - 原 SQL 查詢: {dataSource.SqlQuery}");
                    _loggingService.LogInformation($"  - 新 SQL 查詢: {request.DataSource.SqlQuery}");
                    _loggingService.LogInformation($"  - 原 AuthenticationConfig: {dataSource.AuthenticationConfig}");
                    _loggingService.LogInformation($"  - 新 AuthenticationConfig: {request.DataSource.AuthenticationConfig}");
                    
                    dataSource.SourceType = request.DataSource.SourceType;
                    dataSource.DatabaseConnection = request.DataSource.DatabaseConnection;
                    dataSource.SqlQuery = request.DataSource.SqlQuery;
                    dataSource.SqlParameters = request.DataSource.SqlParameters;
                    dataSource.TargetTableName = request.DataSource.TargetTableName; // 更新目標表名
                    dataSource.ExcelFilePath = request.DataSource.ExcelFilePath;
                    dataSource.ExcelSheetName = request.DataSource.ExcelSheetName;
                    dataSource.GoogleDocsUrl = request.DataSource.GoogleDocsUrl;
                    dataSource.GoogleDocsSheetName = request.DataSource.GoogleDocsSheetName;
                    dataSource.AuthenticationConfig = request.DataSource.AuthenticationConfig;
                    
                    _loggingService.LogInformation($"數據源配置更新完成");
                    _loggingService.LogInformation($"更新後的 AuthenticationConfig: {dataSource.AuthenticationConfig}");
                }

                // 更新欄位定義
                if (request.Columns != null && request.Columns.Any())
                {
                    _loggingService.LogInformation($"開始更新欄位定義，欄位數量: {request.Columns.Count}");
                    
                    // 刪除現有欄位
                    _context.DataSetColumns.RemoveRange(dataSet.Columns);
                    _loggingService.LogInformation($"已刪除 {dataSet.Columns.Count} 個現有欄位");
                    
                    // 添加新欄位
                    foreach (var colRequest in request.Columns)
                    {
                        var column = new DataSetColumn
                        {
                            Id = Guid.NewGuid(),
                            DataSetId = dataSet.Id,
                            ColumnName = colRequest.ColumnName,
                            DisplayName = colRequest.DisplayName,
                            DataType = colRequest.DataType,
                            MaxLength = colRequest.MaxLength,
                            IsRequired = colRequest.IsRequired,
                            IsPrimaryKey = colRequest.IsPrimaryKey,
                            IsSearchable = colRequest.IsSearchable,
                            IsSortable = colRequest.IsSortable,
                            IsIndexed = colRequest.IsIndexed,
                            DefaultValue = colRequest.DefaultValue,
                            SortOrder = colRequest.SortOrder
                        };
                        _context.DataSetColumns.Add(column);
                    }
                    
                    _loggingService.LogInformation($"已添加 {request.Columns.Count} 個新欄位");
                }

                // 記錄更新後的狀態
                _loggingService.LogInformation($"更新後的數據集狀態:");
                _loggingService.LogInformation($"  - 名稱: {dataSet.Name} (原值: {originalName})");
                _loggingService.LogInformation($"  - 描述: {dataSet.Description} (原值: {originalDescription})");
                _loggingService.LogInformation($"  - 狀態: {dataSet.Status} (原值: {originalStatus})");
                _loggingService.LogInformation($"  - 定時更新: {dataSet.IsScheduled} (原值: {originalIsScheduled})");
                _loggingService.LogInformation($"  - 更新間隔: {dataSet.UpdateIntervalMinutes} 分鐘 (原值: {originalUpdateIntervalMinutes} 分鐘)");
                _loggingService.LogInformation($"  - 最後更新時間: {dataSet.UpdatedAt}");
                _loggingService.LogInformation($"  - 最後更新者: {dataSet.UpdatedBy}");

                // 檢查是否有字段實際發生變化
                var hasChanges = originalName != dataSet.Name ||
                                originalDescription != dataSet.Description ||
                                originalStatus != dataSet.Status ||
                                originalIsScheduled != dataSet.IsScheduled ||
                                originalUpdateIntervalMinutes != dataSet.UpdateIntervalMinutes ||
                                (request.DataSource != null) ||
                                (request.Columns != null && request.Columns.Any());

                if (hasChanges)
                {
                    _loggingService.LogInformation($"檢測到字段變化，準備保存到數據庫");
                }
                else
                {
                    _loggingService.LogInformation($"沒有檢測到字段變化，但會更新時間戳和更新者信息");
                }

                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"數據集更新成功，ID: {id}");
                _loggingService.LogInformation($"數據庫保存完成，變更已持久化");
                
                return Ok(new { success = true, message = "DataSet 更新成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError("更新 DataSet 失敗", ex);
                return StatusCode(500, new { success = false, message = "更新 DataSet 失敗" });
            }
        }

        // DELETE: api/datasets/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDataSet(Guid id)
        {
            try
            {
                _loggingService.LogInformation($"開始刪除數據集，ID: {id}");
                var dataSet = await _context.DataSets.FindAsync(id);
                if (dataSet == null)
                {
                    _loggingService.LogWarning($"數據集不存在，ID: {id}");
                    return NotFound(new { success = false, message = "DataSet 不存在" });
                }

                _context.DataSets.Remove(dataSet);
                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"數據集刪除成功，ID: {id}");
                return Ok(new { success = true, message = "DataSet 刪除成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError("刪除 DataSet 失敗", ex);
                return StatusCode(500, new { success = false, message = "刪除 DataSet 失敗" });
            }
        }

        // POST: api/datasets/{id}/sync
        [HttpPost("{id}/sync")]
        public async Task<IActionResult> SyncDataSet(Guid id, [FromBody] SyncRequest? request = null)
        {
            try
            {
                _loggingService.LogInformation($"開始同步數據集，ID: {id}, 同步方向: {request?.SyncDirection ?? "inbound"}");
                var dataSet = await _context.DataSets
                    .Include(ds => ds.Columns)
                    .Include(ds => ds.DataSources)
                    .FirstOrDefaultAsync(ds => ds.Id == id);

                if (dataSet == null)
                {
                    _loggingService.LogWarning($"數據集不存在，ID: {id}");
                    return NotFound(new { success = false, message = "DataSet 不存在" });
                }

                // 執行數據同步邏輯
                // 優先使用請求中的同步方向，否則使用 DataSet 中保存的設置，最後默認為 inbound
                var syncDirection = request?.SyncDirection ?? dataSet.SyncDirection ?? "inbound";
                var syncResult = await SyncDataSetData(dataSet, syncDirection);
                
                if (syncResult.Success)
                {
                    dataSet.LastDataSyncTime = DateTime.UtcNow;
                    dataSet.TotalRecords = syncResult.TotalRecords;
                    dataSet.Status = "Active";
                    await _context.SaveChangesAsync();
                    _loggingService.LogInformation($"數據集同步成功，ID: {id}, 總記錄數: {syncResult.TotalRecords}");
                    
                    return Ok(new { success = true, message = "數據同步成功", data = syncResult });
                }
                else
                {
                    dataSet.Status = "Error";
                    await _context.SaveChangesAsync();
                    _loggingService.LogWarning($"數據集同步失敗，ID: {id}, 錯誤信息: {syncResult.ErrorMessage}");
                    
                    return BadRequest(new { success = false, message = "數據同步失敗", error = syncResult.ErrorMessage });
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError("同步 DataSet 失敗", ex);
                return StatusCode(500, new { success = false, message = "同步 DataSet 失敗" });
            }
        }

        // GET: api/datasets/{id}/records
        [HttpGet("{id}/records")]
        public async Task<ActionResult<IEnumerable<DataSetRecord>>> GetDataSetRecords(
            Guid id, 
            [FromQuery] int page = 1, 
            [FromQuery] int pageSize = 50,
            [FromQuery] string? searchKey = null,
            [FromQuery] string? searchValue = null,
            [FromQuery] string? sortBy = null,
            [FromQuery] string? sortOrder = "asc")
        {
            try
            {
                _loggingService.LogInformation($"開始獲取數據集記錄，數據集ID: {id}, 頁碼: {page}, 每頁大小: {pageSize}");
                
                // 檢查數據集是否存在
                var dataSet = await _context.DataSets.FindAsync(id);
                if (dataSet == null)
                {
                    _loggingService.LogWarning($"數據集不存在，ID: {id}");
                    return NotFound(new { success = false, message = "數據集不存在" });
                }
                
                var query = _context.DataSetRecords
                    .Include(r => r.Values)
                    .Where(r => r.DataSetId == id)
                    .AsQueryable();

                // 支援主鍵值搜尋
                if (!string.IsNullOrEmpty(searchKey) && !string.IsNullOrEmpty(searchValue))
                {
                    query = query.Where(r => r.PrimaryKeyValue == searchValue);
                }

                // 支援欄位值搜尋
                if (!string.IsNullOrEmpty(searchKey) && !string.IsNullOrEmpty(searchValue))
                {
                    query = query.Where(r => r.Values.Any(v => 
                        v.ColumnName == searchKey && 
                        (v.StringValue == searchValue || v.NumericValue.ToString() == searchValue || 
                         v.DateValue.ToString() == searchValue || v.BooleanValue.ToString() == searchValue)));
                }

                // 支援排序
                if (!string.IsNullOrEmpty(sortBy))
                {
                    if (sortBy == "created_at")
                    {
                        query = sortOrder?.ToLower() == "desc" 
                            ? query.OrderByDescending(r => r.CreatedAt)
                            : query.OrderBy(r => r.CreatedAt);
                    }
                    else if (sortBy == "primary_key_value")
                    {
                        query = sortOrder?.ToLower() == "desc" 
                            ? query.OrderByDescending(r => r.PrimaryKeyValue)
                            : query.OrderBy(r => r.PrimaryKeyValue);
                    }
                    else
                    {
                        // 動態欄位排序
                        query = query.OrderBy(r => r.Values
                            .Where(v => v.ColumnName == sortBy)
                            .Select(v => v.StringValue ?? v.NumericValue.ToString() ?? v.DateValue.ToString() ?? v.BooleanValue.ToString())
                            .FirstOrDefault());
                    }
                }
                else
                {
                    query = query.OrderByDescending(r => r.CreatedAt);
                }

                var totalCount = await query.CountAsync();
                var records = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                // 加強日誌：檢查記錄和 Values 的結構
                _loggingService.LogInformation($"獲取到 {records.Count} 條記錄，開始檢查數據結構");
                
                if (records.Any())
                {
                    var firstRecord = records.First();
                    _loggingService.LogInformation($"第一條記錄 ID: {firstRecord.Id}, 主鍵值: {firstRecord.PrimaryKeyValue}");
                    
                    if (firstRecord.Values != null)
                    {
                        _loggingService.LogInformation($"第一條記錄的 Values 數量: {firstRecord.Values.Count}");
                        
                        // 記錄前幾個 Values 的詳細信息
                        var sampleValues = firstRecord.Values.Take(5).ToList();
                        foreach (var value in sampleValues)
                        {
                            _loggingService.LogInformation($"Value: ColumnName={value.ColumnName}, StringValue={value.StringValue}, NumericValue={value.NumericValue}, DateValue={value.DateValue}, BooleanValue={value.BooleanValue}");
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning("第一條記錄的 Values 為 null");
                    }
                }

                // 創建 DTO 避免循環引用
                var recordDtos = records.Select(r => new
                {
                    r.Id,
                    r.DataSetId,
                    r.PrimaryKeyValue,
                    r.Status,
                    r.CreatedAt,
                    Values = r.Values?.Select(v => new
                    {
                        v.Id,
                        v.RecordId,
                        v.ColumnName,
                        v.StringValue,
                        v.NumericValue,
                        v.DateValue,
                        v.BooleanValue
                    }).ToList()
                }).ToList();

                _loggingService.LogInformation($"成功獲取數據集記錄，數據集ID: {id}, 總記錄數: {totalCount}, 分頁結果: 頁碼 {page}, 每頁 {pageSize}, 總頁數 {(int)Math.Ceiling((double)totalCount / pageSize)}");
                return Ok(new { 
                    success = true, 
                    data = recordDtos,
                    pagination = new {
                        page,
                        pageSize,
                        totalCount,
                        totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取 DataSet 記錄失敗: {ex.Message}", ex);
                return StatusCode(500, new { 
                    success = false, 
                    message = "獲取 DataSet 記錄失敗",
                    error = ex.Message,
                    stackTrace = ex.StackTrace
                });
            }
        }

        // DELETE: api/datasets/{datasetId}/records/{recordId}
        [HttpDelete("{datasetId}/records/{recordId}")]
        public async Task<IActionResult> DeleteDataSetRecord(Guid datasetId, Guid recordId)
        {
            try
            {
                _loggingService.LogInformation($"開始刪除數據集記錄，數據集ID: {datasetId}, 記錄ID: {recordId}");
                
                // 檢查數據集是否存在
                var dataSet = await _context.DataSets.FindAsync(datasetId);
                if (dataSet == null)
                {
                    _loggingService.LogWarning($"數據集不存在，ID: {datasetId}");
                    return NotFound(new { success = false, message = "數據集不存在" });
                }
                
                // 查找記錄
                var record = await _context.DataSetRecords
                    .Include(r => r.Values)
                    .FirstOrDefaultAsync(r => r.Id == recordId && r.DataSetId == datasetId);
                
                if (record == null)
                {
                    _loggingService.LogWarning($"記錄不存在，數據集ID: {datasetId}, 記錄ID: {recordId}");
                    return NotFound(new { success = false, message = "記錄不存在" });
                }
                
                // 刪除記錄值（EF Core 會自動處理，但我們明確刪除以確保）
                if (record.Values != null && record.Values.Any())
                {
                    _context.DataSetRecordValues.RemoveRange(record.Values);
                    _loggingService.LogInformation($"刪除 {record.Values.Count} 個記錄值");
                }
                
                // 刪除記錄
                _context.DataSetRecords.Remove(record);
                await _context.SaveChangesAsync();
                
                _loggingService.LogInformation($"成功刪除數據集記錄，數據集ID: {datasetId}, 記錄ID: {recordId}");
                return Ok(new { success = true, message = "記錄已成功刪除" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"刪除數據集記錄失敗: {ex.Message}", ex);
                return StatusCode(500, new { 
                    success = false, 
                    message = "刪除記錄失敗",
                    error = ex.Message
                });
            }
        }

        // GET: api/datasets/{id}/sync-status
        [HttpGet("{id}/sync-status")]
        public async Task<ActionResult<object>> GetDataSetSyncStatus(Guid id)
        {
            try
            {
                _loggingService.LogInformation($"獲取數據集同步狀態，數據集ID: {id}");
                
                var dataSet = await _context.DataSets.FindAsync(id);
                if (dataSet == null)
                {
                    _loggingService.LogWarning($"數據集不存在，ID: {id}");
                    return NotFound(new { success = false, message = "數據集不存在" });
                }

                var syncStatus = new
                {
                    dataSetId = dataSet.Id,
                    syncStatus = dataSet.SyncStatus,
                    syncStartedAt = dataSet.SyncStartedAt,
                    syncCompletedAt = dataSet.SyncCompletedAt,
                    syncErrorMessage = dataSet.SyncErrorMessage,
                    syncStartedBy = dataSet.SyncStartedBy,
                    totalRecordsToSync = dataSet.TotalRecordsToSync ?? 0,
                    recordsProcessed = dataSet.RecordsProcessed ?? 0,
                    recordsInserted = dataSet.RecordsInserted ?? 0,
                    recordsUpdated = dataSet.RecordsUpdated ?? 0,
                    recordsDeleted = dataSet.RecordsDeleted ?? 0,
                    recordsSkipped = dataSet.RecordsSkipped ?? 0,
                    batchSize = dataSet.BatchSize ?? 1000,
                    maxSyncDurationMinutes = dataSet.MaxSyncDurationMinutes ?? 60,
                    allowOverlap = dataSet.AllowOverlap ?? false,
                    progressPercentage = (dataSet.TotalRecordsToSync ?? 0) > 0 
                        ? Math.Round((double)(dataSet.RecordsProcessed ?? 0) / (dataSet.TotalRecordsToSync ?? 1) * 100, 2)
                        : 0
                };

                _loggingService.LogInformation($"成功獲取數據集同步狀態，數據集ID: {id}, 狀態: {dataSet.SyncStatus}");
                return Ok(new { success = true, data = syncStatus });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取數據集同步狀態失敗: {ex.Message}", ex);
                return StatusCode(500, new { 
                    success = false, 
                    message = "獲取數據集同步狀態失敗",
                    error = ex.Message
                });
            }
        }

        // POST: api/datasets/{id}/records/search
        [HttpPost("{id}/records/search")]
        public async Task<ActionResult<IEnumerable<DataSetRecord>>> SearchDataSetRecords(
            Guid id, 
            [FromBody] SearchRequest request)
        {
            try
            {
                _loggingService.LogInformation($"開始搜尋數據集記錄，數據集ID: {id}, 頁碼: {request.Page}, 每頁大小: {request.PageSize}");
                var query = _context.DataSetRecords
                    .Include(r => r.Values)
                    .Where(r => r.DataSetId == id)
                    .AsQueryable();

                // 構建複雜查詢條件
                if (request.Conditions != null && request.Conditions.Any())
                {
                    foreach (var condition in request.Conditions)
                    {
                        var columnName = condition.ColumnName;
                        var operatorType = condition.Operator;
                        var value = condition.Value;

                        switch (operatorType?.ToLower())
                        {
                            case "equals":
                                query = query.Where(r => r.Values.Any(v => 
                                    v.ColumnName == columnName && 
                                    (v.StringValue == value || v.NumericValue.ToString() == value || 
                                     v.DateValue.ToString() == value || v.BooleanValue.ToString() == value)));
                                break;
                            case "contains":
                                query = query.Where(r => r.Values.Any(v => 
                                    v.ColumnName == columnName && 
                                    (v.StringValue != null && v.StringValue.Contains(value))));
                                break;
                            case "greater_than":
                                query = query.Where(r => r.Values.Any(v => 
                                    v.ColumnName == columnName && 
                                    v.NumericValue > decimal.Parse(value)));
                                break;
                            case "less_than":
                                query = query.Where(r => r.Values.Any(v => 
                                    v.ColumnName == columnName && 
                                    v.NumericValue < decimal.Parse(value)));
                                break;
                            case "date_range":
                                var dates = value.Split(',');
                                if (dates.Length == 2)
                                {
                                    var startDate = DateTime.Parse(dates[0]);
                                    var endDate = DateTime.Parse(dates[1]);
                                    query = query.Where(r => r.Values.Any(v => 
                                        v.ColumnName == columnName && 
                                        v.DateValue >= startDate && v.DateValue <= endDate));
                                }
                                break;
                        }
                    }
                }

                // 排序
                if (!string.IsNullOrEmpty(request.SortBy))
                {
                    var sortColumn = request.SortBy;
                    var sortOrder = request.SortOrder?.ToLower() == "desc";

                    if (sortColumn == "created_at")
                    {
                        query = sortOrder 
                            ? query.OrderByDescending(r => r.CreatedAt)
                            : query.OrderBy(r => r.CreatedAt);
                    }
                    else
                    {
                        // 動態欄位排序
                        query = sortOrder
                            ? query.OrderByDescending(r => r.Values
                                .Where(v => v.ColumnName == sortColumn)
                                .Select(v => v.StringValue ?? v.NumericValue.ToString() ?? v.DateValue.ToString() ?? v.BooleanValue.ToString())
                                .FirstOrDefault())
                            : query.OrderBy(r => r.Values
                                .Where(v => v.ColumnName == sortColumn)
                                .Select(v => v.StringValue ?? v.NumericValue.ToString() ?? v.DateValue.ToString() ?? v.BooleanValue.ToString())
                                .FirstOrDefault());
                    }
                }

                var totalCount = await query.CountAsync();
                var records = await query
                    .Skip((request.Page - 1) * request.PageSize)
                    .Take(request.PageSize)
                    .ToListAsync();

                // 創建 DTO 避免循環引用
                var recordDtos = records.Select(r => new
                {
                    r.Id,
                    r.DataSetId,
                    r.PrimaryKeyValue,
                    r.Status,
                    r.CreatedAt,
                    Values = r.Values?.Select(v => new
                    {
                        v.Id,
                        v.RecordId,
                        v.ColumnName,
                        v.StringValue,
                        v.NumericValue,
                        v.DateValue,
                        v.BooleanValue
                    }).ToList()
                }).ToList();

                _loggingService.LogInformation($"成功搜尋數據集記錄，數據集ID: {id}, 總記錄數: {totalCount}");
                return Ok(new { 
                    success = true, 
                    data = recordDtos,
                    totalCount
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError("搜尋 DataSet 記錄失敗", ex);
                return StatusCode(500, new { success = false, message = "搜尋 DataSet 記錄失敗" });
            }
        }

        // 添加連接測試 API
        [HttpPost("test-sql-connection")]
        public async Task<IActionResult> TestSqlConnection([FromBody] TestSqlConnectionRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.ConnectionString))
                {
                    return BadRequest(new { success = false, message = "連接字符串不能為空" });
                }
                
                // 測試連接
                using var connection = new Microsoft.Data.SqlClient.SqlConnection(request.ConnectionString);
                await connection.OpenAsync();
                
                // 執行簡單查詢測試
                using var command = new Microsoft.Data.SqlClient.SqlCommand("SELECT 1", connection);
                await command.ExecuteScalarAsync();
                
                _loggingService.LogInformation("SQL 連接測試成功");
                return Ok(new { success = true, message = "連接測試成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"SQL 連接測試失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = $"連接測試失敗: {ex.Message}" });
            }
        }

        // 添加預設連接測試 API
        [HttpPost("test-preset-connection")]
        public async Task<IActionResult> TestPresetConnection([FromBody] TestPresetConnectionRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.PresetConnection))
                {
                    return BadRequest(new { success = false, message = "預設連接名稱不能為空" });
                }

                // 獲取預設連接字符串
                var connectionString = GetPresetConnectionString(request.PresetConnection);
                if (string.IsNullOrEmpty(connectionString))
                {
                    return BadRequest(new { success = false, message = $"找不到預設連接 '{request.PresetConnection}'" });
                }
                
                // 測試連接
                using var connection = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
                await connection.OpenAsync();
                
                // 執行簡單查詢測試
                using var command = new Microsoft.Data.SqlClient.SqlCommand("SELECT 1", connection);
                await command.ExecuteScalarAsync();
                
                _loggingService.LogInformation($"預設連接 '{request.PresetConnection}' 測試成功");
                return Ok(new { success = true, message = $"預設連接 '{request.PresetConnection}' 測試成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"預設連接 '{request.PresetConnection}' 測試失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = $"預設連接測試失敗: {ex.Message}" });
            }
        }

        // 新增：根據預設連接的 SQL 查詢生成欄位定義 API
        [HttpPost("generate-columns-from-preset-sql")]
        public async Task<IActionResult> GenerateColumnsFromPresetSql([FromBody] GenerateColumnsFromPresetSqlRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.PresetConnection))
                {
                    return BadRequest(new { success = false, message = "預設連接名稱不能為空" });
                }

                if (string.IsNullOrEmpty(request.SqlQuery))
                {
                    return BadRequest(new { success = false, message = "SQL 查詢語句不能為空" });
                }

                // 獲取預設連接字符串
                var connectionString = GetPresetConnectionString(request.PresetConnection);
                if (string.IsNullOrEmpty(connectionString))
                {
                    return BadRequest(new { success = false, message = $"找不到預設連接 '{request.PresetConnection}'" });
                }

                _loggingService.LogInformation($"開始根據預設連接 '{request.PresetConnection}' 的 SQL 查詢生成欄位定義");
                _loggingService.LogInformation($"SQL 查詢: {request.SqlQuery}");

                // 構建一個簡單的查詢來獲取欄位信息（只取前幾行數據）
                string sampleQuery;
                var trimmedQuery = request.SqlQuery.Trim();
                
                if (trimmedQuery.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
                {
                    // 檢查是否已經包含 TOP 關鍵字
                    var upperQuery = trimmedQuery.ToUpper();
                    if (upperQuery.Contains(" TOP "))
                    {
                        // 如果已經有 TOP，直接使用原查詢
                        sampleQuery = trimmedQuery;
                    }
                    else
                    {
                        // 如果沒有 TOP，用子查詢包裝來限制結果
                        sampleQuery = $"SELECT TOP 1 * FROM ({trimmedQuery}) AS temp";
                    }
                }
                else
                {
                    // 如果不是 SELECT 開頭，用子查詢包裝
                    sampleQuery = $"SELECT TOP 1 * FROM ({trimmedQuery}) AS temp";
                }

                _loggingService.LogInformation($"樣本查詢: {sampleQuery}");

                // 執行查詢獲取欄位信息
                var result = await ExecuteSqlQuery(connectionString, sampleQuery, null);
                
                if (result.Success && result.Data.Any())
                {
                    var columns = new List<object>();
                    var firstRow = result.Data.First();
                    
                    foreach (var kvp in firstRow)
                    {
                        var originalColumnName = kvp.Key;
                        var normalizedColumnName = ColumnNameNormalizer.Normalize(originalColumnName);
                        var value = kvp.Value;
                        
                        columns.Add(new
                        {
                            columnName = normalizedColumnName,
                            displayName = originalColumnName,
                            dataType = InferDataTypeFromValue(value),
                            maxLength = GetMaxLengthFromValue(value),
                            defaultValue = (string)null
                        });
                    }
                    
                    _loggingService.LogInformation($"成功為預設連接 '{request.PresetConnection}' 生成 {columns.Count} 個欄位定義");
                    return Ok(new { success = true, columns = columns });
                }
                else
                {
                    _loggingService.LogWarning($"預設連接 '{request.PresetConnection}' 的查詢沒有返回數據");
                    return Ok(new { success = true, columns = new List<object>(), message = "查詢沒有返回數據" });
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"為預設連接生成欄位定義失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = $"生成欄位定義失敗: {ex.Message}" });
            }
        }

        // 新增：根據 SQL 查詢生成欄位定義 API
        [HttpPost("generate-columns-from-sql")]
        public async Task<IActionResult> GenerateColumnsFromSql([FromBody] GenerateColumnsFromSqlRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.ConnectionString))
                {
                    return BadRequest(new { success = false, message = "連接字符串不能為空" });
                }

                if (string.IsNullOrEmpty(request.SqlQuery))
                {
                    return BadRequest(new { success = false, message = "SQL 查詢語句不能為空" });
                }

                _loggingService.LogInformation($"開始根據 SQL 查詢生成欄位定義");
                _loggingService.LogInformation($"SQL 查詢: {request.SqlQuery}");

                // 構建一個簡單的查詢來獲取欄位信息（只取前幾行數據）
                string sampleQuery;
                var trimmedQuery = request.SqlQuery.Trim();
                
                if (trimmedQuery.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
                {
                    // 檢查是否已經包含 TOP 關鍵字
                    var upperQuery = trimmedQuery.ToUpper();
                    if (upperQuery.Contains(" TOP "))
                    {
                        // 如果已經有 TOP，直接使用原查詢
                        sampleQuery = trimmedQuery;
                    }
                    else
                    {
                        // 如果沒有 TOP，用子查詢包裝來限制結果
                        sampleQuery = $"SELECT TOP 1 * FROM ({trimmedQuery}) AS temp";
                    }
                }
                else
                {
                    // 如果不是 SELECT 開頭，用子查詢包裝
                    sampleQuery = $"SELECT TOP 1 * FROM ({trimmedQuery}) AS temp";
                }

                _loggingService.LogInformation($"樣本查詢: {sampleQuery}");

                // 執行查詢獲取欄位信息
                var result = await ExecuteSqlQuery(request.ConnectionString, sampleQuery, null);
                
                if (result.Success && result.Data.Any())
                {
                    var firstRow = result.Data.First();
                    var columns = new List<object>();

                    foreach (var column in firstRow)
                    {
                        var originalColumnName = column.Key;
                        var normalizedColumnName = ColumnNameNormalizer.Normalize(originalColumnName);
                        var value = column.Value;
                        
                        // 推斷數據類型
                        var dataType = InferDataTypeFromValue(value);
                        
                        columns.Add(new
                        {
                            columnName = normalizedColumnName,
                            displayName = originalColumnName, // 可以根據需要自定義顯示名稱
                            dataType = dataType,
                            maxLength = dataType == "string" ? (int?)255 : (int?)null,
                            defaultValue = (string)null
                        });
                    }

                    _loggingService.LogInformation($"成功生成 {columns.Count} 個欄位定義");
                    return Ok(new { success = true, columns = columns });
                }
                else
                {
                    _loggingService.LogWarning($"查詢執行失敗或沒有返回數據: {result.ErrorMessage}");
                    return BadRequest(new { success = false, message = $"查詢執行失敗: {result.ErrorMessage}" });
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"生成欄位定義失敗: {ex.Message}", ex);
                return StatusCode(500, new { success = false, message = $"生成欄位定義失敗: {ex.Message}" });
            }
        }

        // 新增：從值推斷數據類型
        private string InferDataTypeFromValue(object value)
        {
            if (value == null) return "string";
            
            var valueType = value.GetType();
            
            if (valueType == typeof(int) || valueType == typeof(long) || valueType == typeof(short))
                return "int";
            else if (valueType == typeof(decimal) || valueType == typeof(double) || valueType == typeof(float))
                return "decimal";
            else if (valueType == typeof(DateTime))
                return "datetime";
            else if (valueType == typeof(bool))
                return "boolean";
            else
                return "string";
        }

        private int GetMaxLengthFromValue(object value)
        {
            if (value == null) return 255;
            
            var valueType = value.GetType();
            
            if (valueType == typeof(string))
            {
                var stringValue = value.ToString();
                return Math.Max(stringValue?.Length ?? 0, 255);
            }
            else if (valueType == typeof(int) || valueType == typeof(long) || valueType == typeof(short))
                return 20;
            else if (valueType == typeof(decimal) || valueType == typeof(double) || valueType == typeof(float))
                return 20;
            else if (valueType == typeof(DateTime))
                return 50;
            else if (valueType == typeof(bool))
                return 10;
            else
                return 255;
        }

        public class TestSqlConnectionRequest
        {
            public string ConnectionString { get; set; } = string.Empty;
        }

        public class TestPresetConnectionRequest
        {
            public string PresetConnection { get; set; } = string.Empty;
        }

        public class GenerateColumnsFromSqlRequest
        {
            public string ConnectionString { get; set; } = string.Empty;
            public string SqlQuery { get; set; } = string.Empty;
        }

        public class GenerateColumnsFromPresetSqlRequest
        {
            public string PresetConnection { get; set; } = string.Empty;
            public string SqlQuery { get; set; } = string.Empty;
        }

        private async Task<SyncResult> SyncDataSetData(DataSet dataSet, string syncDirection = "inbound")
        {
            try
            {
                _loggingService.LogInformation($"開始同步數據集數據，數據集ID: {dataSet.Id}, 同步方向: {syncDirection}");
                
                // 檢查是否允許重疊同步
                if (dataSet.SyncStatus == "Running" && !(dataSet.AllowOverlap ?? false))
                {
                    _loggingService.LogWarning($"數據集正在同步中，不允許重疊同步，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "數據集正在同步中，請稍後再試" };
                }
                
                // 檢查同步時間限制
                if (dataSet.SyncStartedAt.HasValue)
                {
                    var elapsedMinutes = (DateTime.UtcNow - dataSet.SyncStartedAt.Value).TotalMinutes;
                    var maxDuration = dataSet.MaxSyncDurationMinutes ?? 60;
                    if (elapsedMinutes > maxDuration)
                    {
                        _loggingService.LogWarning($"同步時間超過限制 ({maxDuration} 分鐘)，數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = $"同步時間超過限制 ({maxDuration} 分鐘)" };
                    }
                }
                
                // 設置同步狀態為運行中
                dataSet.SyncStatus = "Running";
                dataSet.SyncStartedAt = DateTime.UtcNow;
                dataSet.SyncStartedBy = "User"; // 手動同步
                dataSet.SyncErrorMessage = null;
                dataSet.SyncCompletedAt = null;
                
                // 重置進度計數器
                dataSet.TotalRecordsToSync = 0;
                dataSet.RecordsProcessed = 0;
                dataSet.RecordsInserted = 0;
                dataSet.RecordsUpdated = 0;
                dataSet.RecordsDeleted = 0;
                dataSet.RecordsSkipped = 0;
                
                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"已設置同步狀態為運行中，數據集ID: {dataSet.Id}");
                
                var dataSource = dataSet.DataSources.FirstOrDefault();
                if (dataSource == null)
                {
                    _loggingService.LogWarning($"未找到數據源配置，數據集ID: {dataSet.Id}");
                    await SetSyncStatusFailed(dataSet, "未找到數據源配置");
                    return new SyncResult { Success = false, ErrorMessage = "未找到數據源配置" };
                }

                // 異步執行同步過程，讓前端能夠輪詢進度
                var syncDirectionCopy = syncDirection; // 捕獲變量
                _ = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var scopedContext = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                    var scopedLoggingService = scope.ServiceProvider.GetRequiredService<Func<string, LoggingService>>()("DataSetsController");
                    var scopedGoogleSheetsService = scope.ServiceProvider.GetRequiredService<IGoogleSheetsService>();
                    
                    // 重新獲取 DataSet 對象，確保使用 scopedContext
                    var scopedDataSet = await scopedContext.DataSets
                        .Include(ds => ds.DataSources)
                        .Include(ds => ds.Columns)
                        .FirstOrDefaultAsync(ds => ds.Id == dataSet.Id);
                    
                    if (scopedDataSet == null)
                    {
                        scopedLoggingService.LogError($"在異步執行中找不到數據集，ID: {dataSet.Id}");
                        return;
                    }
                    
                    // 在異步執行中也設置同步狀態
                    scopedDataSet.SyncStatus = "Running";
                    scopedDataSet.SyncStartedAt = DateTime.UtcNow;
                    scopedDataSet.SyncStartedBy = dataSet.SyncStartedBy ?? "User";
                    scopedDataSet.SyncErrorMessage = null;
                    scopedDataSet.SyncCompletedAt = null;
                    
                    // 重置進度計數器
                    scopedDataSet.TotalRecordsToSync = 0;
                    scopedDataSet.RecordsProcessed = 0;
                    scopedDataSet.RecordsInserted = 0;
                    scopedDataSet.RecordsUpdated = 0;
                    scopedDataSet.RecordsDeleted = 0;
                    scopedDataSet.RecordsSkipped = 0;
                    
                    await scopedContext.SaveChangesAsync();
                    scopedLoggingService.LogInformation($"異步執行中已設置同步狀態為運行中，數據集ID: {scopedDataSet.Id}");
                    
                    // 創建一個新的 DataSetsController 實例來處理同步
                    var syncController = new DataSetsController(scopedContext, 
                        scope.ServiceProvider.GetRequiredService<ILogger<DataSetsController>>(),
                        scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>(),
                        scope.ServiceProvider.GetRequiredService<Func<string, LoggingService>>(),
                        scopedGoogleSheetsService,
                        scope.ServiceProvider);
                    
                    try
                    {
                        SyncResult result = new SyncResult { Success = false, TotalRecords = 0 };
                        var scopedDataSource = scopedDataSet.DataSources.FirstOrDefault();
                        
                        if (scopedDataSource == null)
                        {
                            scopedLoggingService.LogWarning($"未找到數據源配置，數據集ID: {scopedDataSet.Id}");
                            await syncController.SetSyncStatusFailedWithContext(scopedDataSet, "未找到數據源配置", scopedContext, scopedLoggingService);
                            return;
                        }
                        
                        // 根據同步方向執行不同的邏輯
                        if (syncDirectionCopy == "outbound" || syncDirectionCopy == "bidirectional")
                        {
                            // 出站同步：將內部數據寫回外部數據源
                            if (scopedDataSource.SourceType.ToUpper() == "GOOGLE_DOCS")
                            {
                                result = await syncController.SyncToGoogleDocs(scopedDataSet, scopedDataSource);
                            }
                            else if (scopedDataSource.SourceType.ToUpper() == "EXCEL")
                            {
                                result = await syncController.SyncToLocalExcel(scopedDataSet, scopedDataSource);
                            }
                            else if (scopedDataSource.SourceType.ToUpper() == "SQL")
                            {
                                result = await syncController.SyncToSql(scopedDataSet, scopedDataSource);
                            }
                            else
                            {
                                scopedLoggingService.LogWarning($"出站同步目前僅支持 GOOGLE_DOCS、EXCEL 和 SQL 數據源，數據集ID: {scopedDataSet.Id}, 數據源類型: {scopedDataSource.SourceType}");
                                await syncController.SetSyncStatusFailedWithContext(scopedDataSet, $"出站同步目前僅支持 GOOGLE_DOCS、EXCEL 和 SQL 數據源", scopedContext, scopedLoggingService);
                                return;
                            }
                        }
                        
                        // 如果是雙向同步，先執行出站，再執行入站
                        if (syncDirectionCopy == "bidirectional")
                        {
                            if (result.Success)
                            {
                                if (scopedDataSource.SourceType.ToUpper() == "GOOGLE_DOCS")
                                {
                                    scopedLoggingService.LogInformation($"雙向同步：出站同步完成，開始入站同步，數據集ID: {scopedDataSet.Id}");
                                    var inboundResult = await syncController.SyncFromGoogleDocs(scopedDataSet, scopedDataSource);
                                    // 合併結果
                                    result = new SyncResult
                                    {
                                        Success = inboundResult.Success && result.Success,
                                        TotalRecords = inboundResult.TotalRecords + result.TotalRecords,
                                        ErrorMessage = result.Success ? inboundResult.ErrorMessage : result.ErrorMessage
                                    };
                                }
                                else if (scopedDataSource.SourceType.ToUpper() == "EXCEL")
                                {
                                    scopedLoggingService.LogInformation($"雙向同步：出站同步完成，開始入站同步，數據集ID: {scopedDataSet.Id}");
                                    var inboundResult = await syncController.SyncFromExcel(scopedDataSet, scopedDataSource);
                                    // 合併結果
                                    result = new SyncResult
                                    {
                                        Success = inboundResult.Success && result.Success,
                                        TotalRecords = inboundResult.TotalRecords + result.TotalRecords,
                                        ErrorMessage = result.Success ? inboundResult.ErrorMessage : result.ErrorMessage
                                    };
                                }
                                else if (scopedDataSource.SourceType.ToUpper() == "SQL")
                                {
                                    scopedLoggingService.LogInformation($"雙向同步：出站同步完成，開始入站同步，數據集ID: {scopedDataSet.Id}");
                                    var inboundResult = await syncController.SyncFromSql(scopedDataSet, scopedDataSource);
                                    // 合併結果
                                    result = new SyncResult
                                    {
                                        Success = inboundResult.Success && result.Success,
                                        TotalRecords = inboundResult.TotalRecords + result.TotalRecords,
                                        ErrorMessage = result.Success ? inboundResult.ErrorMessage : result.ErrorMessage
                                    };
                                }
                            }
                        }
                        else if (syncDirectionCopy == "inbound")
                        {
                            // 入站同步：從外部數據源讀取數據
                            switch (scopedDataSource.SourceType.ToUpper())
                            {
                                case "SQL":
                                    result = await syncController.SyncFromSql(scopedDataSet, scopedDataSource);
                                    break;
                                case "EXCEL":
                                    result = await syncController.SyncFromExcel(scopedDataSet, scopedDataSource);
                                    break;
                                case "GOOGLE_DOCS":
                                    result = await syncController.SyncFromGoogleDocs(scopedDataSet, scopedDataSource);
                                    break;
                                default:
                                    scopedLoggingService.LogWarning($"不支援的數據源類型，數據集ID: {scopedDataSet.Id}, 數據源類型: {scopedDataSource.SourceType}");
                                    await syncController.SetSyncStatusFailedWithContext(scopedDataSet, "不支援的數據源類型", scopedContext, scopedLoggingService);
                                    return;
                            }
                        }
                        else
                        {
                            scopedLoggingService.LogWarning($"不支援的同步方向，數據集ID: {scopedDataSet.Id}, 同步方向: {syncDirectionCopy}");
                            await syncController.SetSyncStatusFailedWithContext(scopedDataSet, $"不支援的同步方向: {syncDirectionCopy}", scopedContext, scopedLoggingService);
                            return;
                        }
                        
                        // 設置同步完成狀態
                        if (result.Success)
                        {
                            await syncController.SetSyncStatusCompletedWithContext(scopedDataSet, result.TotalRecords, scopedContext, scopedLoggingService);
                            scopedLoggingService.LogInformation($"異步同步成功，數據集ID: {scopedDataSet.Id}, 總記錄數: {result.TotalRecords}, 同步方向: {syncDirectionCopy}");
                        }
                        else
                        {
                            await syncController.SetSyncStatusFailedWithContext(scopedDataSet, result.ErrorMessage, scopedContext, scopedLoggingService);
                            scopedLoggingService.LogError($"異步同步失敗，數據集ID: {scopedDataSet.Id}, 錯誤: {result.ErrorMessage}, 同步方向: {syncDirectionCopy}");
                        }
                    }
                    catch (Exception ex)
                    {
                        scopedLoggingService.LogError($"異步同步過程發生異常，數據集ID: {scopedDataSet.Id}, 錯誤: {ex.Message}", ex);
                        await syncController.SetSyncStatusFailedWithContext(scopedDataSet, $"同步過程發生異常: {ex.Message}", scopedContext, scopedLoggingService);
                    }
                });

                // 立即返回成功，讓前端開始輪詢
                _loggingService.LogInformation($"已啟動異步同步過程，數據集ID: {dataSet.Id}");
                return new SyncResult { Success = true, TotalRecords = 0 };
            }
            catch (Exception ex)
            {
                _loggingService.LogError("同步數據失敗", ex);
                await SetSyncStatusFailed(dataSet, ex.Message);
                return new SyncResult { Success = false, ErrorMessage = ex.Message };
            }
        }
        
        private async Task SetSyncStatusCompleted(DataSet dataSet, int totalRecords)
        {
            dataSet.SyncStatus = "Completed";
            dataSet.SyncCompletedAt = DateTime.UtcNow;
            dataSet.SyncStartedAt = null; // 清理同步開始時間
            dataSet.SyncErrorMessage = null;
            dataSet.LastDataSyncTime = DateTime.UtcNow;
            dataSet.TotalRecords = totalRecords;
            await _context.SaveChangesAsync();
            _loggingService.LogInformation($"同步完成，數據集ID: {dataSet.Id}, 總記錄數: {totalRecords}");
        }
        
        private async Task SetSyncStatusCompletedWithContext(DataSet dataSet, int totalRecords, PurpleRiceDbContext context, LoggingService loggingService)
        {
            dataSet.SyncStatus = "Completed";
            dataSet.SyncCompletedAt = DateTime.UtcNow;
            dataSet.SyncStartedAt = null; // 清理同步開始時間
            dataSet.SyncErrorMessage = null;
            dataSet.LastDataSyncTime = DateTime.UtcNow;
            dataSet.TotalRecords = totalRecords;
            dataSet.TotalRecordsToSync = totalRecords; // 同時設置 TotalRecordsToSync 以確保前端正確顯示
            await context.SaveChangesAsync();
            loggingService.LogInformation($"同步完成，數據集ID: {dataSet.Id}, 總記錄數: {totalRecords}");
        }
        
        private async Task SetSyncStatusFailed(DataSet dataSet, string errorMessage)
        {
            dataSet.SyncStatus = "Failed";
            dataSet.SyncCompletedAt = DateTime.UtcNow;
            dataSet.SyncStartedAt = null; // 清理同步開始時間
            dataSet.SyncErrorMessage = errorMessage;

            // 重置進度計數器，避免顯示錯誤的統計信息
            dataSet.TotalRecordsToSync = 0;
            dataSet.RecordsProcessed = 0;
            dataSet.RecordsInserted = 0;
            dataSet.RecordsUpdated = 0;
            dataSet.RecordsDeleted = 0;
            dataSet.RecordsSkipped = 0;

            await _context.SaveChangesAsync();
            _loggingService.LogError($"同步失敗，數據集ID: {dataSet.Id}, 錯誤: {errorMessage}");
        }
        
        private async Task SetSyncStatusFailedWithContext(DataSet dataSet, string errorMessage, PurpleRiceDbContext context, LoggingService loggingService)
        {
            dataSet.SyncStatus = "Failed";
            dataSet.SyncCompletedAt = DateTime.UtcNow;
            dataSet.SyncStartedAt = null; // 清理同步開始時間
            dataSet.SyncErrorMessage = errorMessage;

            // 重置進度計數器，避免顯示錯誤的統計信息
            dataSet.TotalRecordsToSync = 0;
            dataSet.RecordsProcessed = 0;
            dataSet.RecordsInserted = 0;
            dataSet.RecordsUpdated = 0;
            dataSet.RecordsDeleted = 0;
            dataSet.RecordsSkipped = 0;

            await context.SaveChangesAsync();
            loggingService.LogError($"同步失敗，數據集ID: {dataSet.Id}, 錯誤: {errorMessage}");
        }

        private async Task<SyncResult> SyncFromSql(DataSet dataSet, DataSetDataSource dataSource)
        {
            try
            {
                _loggingService.LogInformation($"開始同步 SQL 數據，數據集ID: {dataSet.Id}");
                _loggingService.LogInformation($"數據源信息:");
                _loggingService.LogInformation($"  - 數據源類型: {dataSource.SourceType}");
                _loggingService.LogInformation($"  - SQL 查詢: {dataSource.SqlQuery}");
                _loggingService.LogInformation($"  - 數據庫連接: {dataSource.DatabaseConnection}");
                _loggingService.LogInformation($"  - 認證配置: {dataSource.AuthenticationConfig}");
                
                string connectionString;
                
                // 解析連接配置
                if (!string.IsNullOrEmpty(dataSource.AuthenticationConfig))
                {
                    try
                    {
                        _loggingService.LogInformation($"開始解析認證配置 JSON: {dataSource.AuthenticationConfig}");
                        var config = JsonSerializer.Deserialize<SqlConnectionConfig>(dataSource.AuthenticationConfig);
                        
                        _loggingService.LogInformation($"解析後的配置對象:");
                        _loggingService.LogInformation($"  - ConnectionType: {config?.ConnectionType}");
                        _loggingService.LogInformation($"  - PresetName: {config?.PresetName}");
                        _loggingService.LogInformation($"  - ServerName: {config?.ServerName}");
                        _loggingService.LogInformation($"  - DatabaseName: {config?.DatabaseName}");
                        _loggingService.LogInformation($"  - AuthenticationType: {config?.AuthenticationType}");
                        
                        if (config?.ConnectionType == "preset")
                        {
                            // 使用預設連接
                            connectionString = GetPresetConnectionString(config.PresetName);
                            _loggingService.LogInformation($"使用預設連接: {config.PresetName}");
                        }
                        else if (config?.ConnectionType == "custom")
                        {
                            // 構建自定義連接字符串
                            connectionString = BuildCustomConnectionString(config);
                            _loggingService.LogInformation($"使用自定義連接");
                        }
                        else
                        {
                            // 嘗試從其他字段推斷連接類型
                            _loggingService.LogWarning($"ConnectionType 為空或無效: '{config?.ConnectionType}'，嘗試推斷連接類型");
                            
                            if (!string.IsNullOrEmpty(config?.ServerName) && !string.IsNullOrEmpty(config?.DatabaseName))
                            {
                                _loggingService.LogInformation($"從 ServerName 和 DatabaseName 推斷為自定義連接");
                                connectionString = BuildCustomConnectionString(config);
                                _loggingService.LogInformation($"使用推斷的自定義連接");
                            }
                            else if (!string.IsNullOrEmpty(config?.PresetName))
                            {
                                _loggingService.LogInformation($"從 PresetName 推斷為預設連接");
                                connectionString = GetPresetConnectionString(config.PresetName);
                                _loggingService.LogInformation($"使用推斷的預設連接: {config.PresetName}");
                            }
                            else
                            {
                                _loggingService.LogError($"無法推斷連接類型，ConnectionType: '{config?.ConnectionType}'");
                                _loggingService.LogError($"期望的值: 'preset' 或 'custom'");
                                return new SyncResult { Success = false, ErrorMessage = $"無法推斷連接類型，ConnectionType: '{config?.ConnectionType}'" };
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogError($"解析連接配置失敗: {ex.Message}");
                        _loggingService.LogError($"原始認證配置字符串: {dataSource.AuthenticationConfig}");
                        return new SyncResult { Success = false, ErrorMessage = $"連接配置格式錯誤: {ex.Message}" };
                    }
                }
                else
                {
                    // 向後兼容：使用舊的 databaseConnection 欄位
                    _loggingService.LogInformation($"沒有 AuthenticationConfig，使用舊格式 databaseConnection: {dataSource.DatabaseConnection}");
                    connectionString = GetPresetConnectionString(dataSource.DatabaseConnection);
                    _loggingService.LogInformation($"使用舊格式預設連接: {dataSource.DatabaseConnection}");
                }
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    _loggingService.LogError($"無法獲取數據庫連接字符串");
                    return new SyncResult { Success = false, ErrorMessage = "無法獲取數據庫連接字符串" };
                }
                
                _loggingService.LogInformation($"最終使用的連接字符串: {connectionString}");
                
                // 執行 SQL 查詢
                var result = await ExecuteSqlQuery(connectionString, dataSource.SqlQuery, dataSource.SqlParameters);
                
                if (result.Success)
                {
                    // 處理查詢結果並存儲到數據庫
                    var processedRecords = await ProcessSqlResults(dataSet, result.Data);
                    
                    // 返回實際的數據源記錄數，而不是處理的記錄數
                    var actualRecordCount = result.Data.Count;
                    
                    _loggingService.LogInformation($"SQL 數據同步完成，數據源記錄數: {actualRecordCount}，處理記錄數: {processedRecords}，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = true, TotalRecords = actualRecordCount };
                }
                else
                {
                    return new SyncResult { Success = false, ErrorMessage = result.ErrorMessage };
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"SQL 數據同步失敗: {ex.Message}", ex);
                return new SyncResult { Success = false, ErrorMessage = $"SQL 數據同步失敗: {ex.Message}" };
            }
        }

        /// <summary>
        /// 將內部 DataSet 數據同步到 SQL 表（出站同步）
        /// </summary>
        private async Task<SyncResult> SyncToSql(DataSet dataSet, DataSetDataSource dataSource)
        {
            try
            {
                _loggingService.LogInformation($"開始將數據同步到 SQL 表，數據集ID: {dataSet.Id}, 目標表: {dataSource.TargetTableName}");

                // 1. 驗證配置
                if (string.IsNullOrEmpty(dataSource.TargetTableName))
                {
                    _loggingService.LogWarning($"目標表名不能為空，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "目標表名不能為空" };
                }

                // 2. 獲取連接字符串（重用 SyncFromSql 的邏輯）
                string connectionString = GetSqlConnectionStringForSync(dataSource);
                if (string.IsNullOrEmpty(connectionString))
                {
                    return new SyncResult { Success = false, ErrorMessage = "無法獲取數據庫連接字符串" };
                }

                // 3. 獲取欄位定義和主鍵欄位
                var columns = await _context.DataSetColumns
                    .Where(c => c.DataSetId == dataSet.Id)
                    .OrderBy(c => c.SortOrder)
                    .ThenBy(c => c.ColumnName)
                    .ToListAsync();

                if (!columns.Any())
                {
                    _loggingService.LogWarning($"數據集沒有欄位定義，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "數據集沒有欄位定義" };
                }

                var primaryKeyColumns = columns.Where(c => c.IsPrimaryKey).ToList();
                if (!primaryKeyColumns.Any())
                {
                    _loggingService.LogWarning($"數據集沒有主鍵欄位定義，無法進行增量同步，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "數據集必須定義主鍵欄位才能進行出站同步" };
                }

                _loggingService.LogInformation($"找到 {primaryKeyColumns.Count} 個主鍵欄位: {string.Join(", ", primaryKeyColumns.Select(c => c.ColumnName))}");

                // 4. 獲取 DataSet 記錄
                var records = await _context.DataSetRecords
                    .Where(r => r.DataSetId == dataSet.Id && r.Status == "Active")
                    .Include(r => r.Values)
                    .OrderBy(r => r.CreatedAt)
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {records.Count} 條活躍記錄，數據集ID: {dataSet.Id}");

                if (!records.Any())
                {
                    _loggingService.LogInformation($"沒有活躍記錄需要同步，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = true, TotalRecords = 0 };
                }

                // 5. 讀取目標表現有數據，構建主鍵映射
                var existingRecordsMap = await GetExistingSqlRecords(
                    connectionString, 
                    dataSource.TargetTableName, 
                    primaryKeyColumns
                );
                _loggingService.LogInformation($"目標表現有記錄數: {existingRecordsMap.Count}");

                // 7. 分類處理：新增 vs 更新
                var recordsToInsert = new List<DataSetRecord>();
                var recordsToUpdate = new List<(DataSetRecord Record, Dictionary<string, object> ExistingData)>();

                foreach (var record in records)
                {
                    var primaryKey = BuildCompositeKeyFromRecord(record, primaryKeyColumns);
                    
                    if (string.IsNullOrEmpty(primaryKey))
                    {
                        _loggingService.LogWarning($"記錄缺少主鍵值，跳過，記錄ID: {record.Id}");
                        continue;
                    }

                    if (existingRecordsMap.ContainsKey(primaryKey))
                    {
                        recordsToUpdate.Add((record, existingRecordsMap[primaryKey]));
                    }
                    else
                    {
                        recordsToInsert.Add(record);
                    }
                }

                _loggingService.LogInformation($"分類完成 - 新增: {recordsToInsert.Count}, 更新: {recordsToUpdate.Count}");

                // 8. 批量執行 SQL（使用事務）
                using var connection = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
                await connection.OpenAsync();
                using var transaction = connection.BeginTransaction();

                try
                {
                    int insertedCount = 0;
                    int updatedCount = 0;

                    // 批量插入
                    if (recordsToInsert.Any())
                    {
                        insertedCount = await BatchInsertToSql(
                            connection, transaction, dataSource.TargetTableName, 
                            recordsToInsert, columns, primaryKeyColumns
                        );
                    }

                    // 批量更新
                    if (recordsToUpdate.Any())
                    {
                        updatedCount = await BatchUpdateToSql(
                            connection, transaction, dataSource.TargetTableName, 
                            recordsToUpdate, columns, primaryKeyColumns
                        );
                    }

                    transaction.Commit();
                    
                    var totalRecords = insertedCount + updatedCount;
                    _loggingService.LogInformation($"SQL 出站同步完成，數據集ID: {dataSet.Id}，新增: {insertedCount}，更新: {updatedCount}，總計: {totalRecords}");
                    
                    return new SyncResult { Success = true, TotalRecords = totalRecords };
                }
                catch (Exception ex)
                {
                    transaction.Rollback();
                    _loggingService.LogError($"SQL 出站同步失敗: {ex.Message}", ex);
                    return new SyncResult { Success = false, ErrorMessage = $"SQL 出站同步失敗: {ex.Message}" };
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"SQL 出站同步失敗: {ex.Message}", ex);
                return new SyncResult { Success = false, ErrorMessage = $"SQL 出站同步失敗: {ex.Message}" };
            }
        }

        private async Task<SyncResult> SyncFromExcel(DataSet dataSet, DataSetDataSource dataSource)
        {
            try
            {
                _loggingService.LogInformation($"開始同步 Excel 數據，DataSet: {dataSet.Name}, 文件路徑: {dataSource.ExcelFilePath}, 工作表: {dataSource.ExcelSheetName}");

                if (string.IsNullOrEmpty(dataSource.ExcelFilePath))
                {
                    _loggingService.LogWarning($"Excel 文件路徑不能為空，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "Excel 文件路徑不能為空" };
                }

                // 構建完整的文件路徑 - 修復路徑構建邏輯
                var filePath = dataSource.ExcelFilePath;
                if (!Path.IsPathRooted(filePath) || (filePath.StartsWith("/") && !filePath.StartsWith("\\")))
                {
                    // 移除開頭的斜線，然後與 Uploads 路徑組合
                    var relativePath = filePath.TrimStart('/');
                    
                    // 使用當前目錄構建完整路徑
                    filePath = Path.Combine(Directory.GetCurrentDirectory(), relativePath);
                    
                    _loggingService.LogDebug($"同步Excel路徑構建調試 - 原始路徑: {dataSource.ExcelFilePath}");
                    _loggingService.LogDebug($"同步Excel路徑構建調試 - 相對路徑: {relativePath}");
                    _loggingService.LogDebug($"同步Excel路徑構建調試 - 當前目錄: {Directory.GetCurrentDirectory()}");
                    _loggingService.LogDebug($"同步Excel路徑構建調試 - 最終路徑: {filePath}");
                }
                else
                {
                    _loggingService.LogInformation($"使用原始路徑（絕對路徑）: {filePath}");
                }

                _loggingService.LogInformation($"構建的文件路徑: {filePath}");

                if (!System.IO.File.Exists(filePath))
                {
                    _loggingService.LogWarning($"Excel 文件不存在: {filePath}, 數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = $"Excel 文件不存在: {filePath}" };
                }

                _loggingService.LogInformation($"文件存在，開始讀取 Excel 文件: {filePath}");

                // 使用 OpenXML 讀取 Excel 文件
                using var stream = System.IO.File.OpenRead(filePath);
                using var document = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, false);
                
                var workbookPart = document.WorkbookPart;
                if (workbookPart == null)
                {
                    _loggingService.LogWarning($"無法讀取 Excel 工作簿，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "無法讀取 Excel 工作簿" };
                }

                // 獲取工作表
                var sheetName = dataSource.ExcelSheetName ?? "Sheet1";
                var sheet = workbookPart.Workbook.Descendants<DocumentFormat.OpenXml.Spreadsheet.Sheet>()
                    .FirstOrDefault(s => s.Name == sheetName) as DocumentFormat.OpenXml.Spreadsheet.Sheet;

                if (sheet == null)
                {
                    _loggingService.LogWarning($"找不到工作表: {sheetName}, 數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = $"找不到工作表: {sheetName}" };
                }

                var worksheetPart = workbookPart.GetPartById(sheet.Id) as DocumentFormat.OpenXml.Packaging.WorksheetPart;
                if (worksheetPart == null)
                {
                    _loggingService.LogWarning($"無法讀取工作表內容: {sheetName}, 數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "無法讀取工作表內容" };
                }

                var worksheet = worksheetPart.Worksheet;
                var sheetData = worksheet.GetFirstChild<DocumentFormat.OpenXml.Spreadsheet.SheetData>();

                if (sheetData == null)
                {
                    _loggingService.LogWarning($"工作表沒有數據，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "工作表沒有數據" };
                }

                var rows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
                if (!rows.Any())
                {
                    _loggingService.LogWarning($"工作表沒有行數據，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "工作表沒有行數據" };
                }

                // 讀取標題行（第一行）
                var headerRow = rows.First();
                var headerCells = headerRow.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                var headers = GetCellValues(headerRow, workbookPart.SharedStringTablePart).ToList();
                
                _loggingService.LogInformation($"Excel 標題行: {string.Join(", ", headers)}");

                // 檢查是否需要創建或更新欄位定義
                await EnsureColumnsExist(dataSet, headers, headerCells, workbookPart);

                // 讀取數據行（從第二行開始）
                var dataRows = rows.Skip(1).ToList();
                
                // 將 Excel 數據轉換為統一的 Dictionary 格式
                var excelData = new List<Dictionary<string, object>>();
                
                foreach (var (row, rowIndex) in dataRows.Select((row, index) => (row, index)))
                {
                    var cellValues = GetCellValues(row, workbookPart.SharedStringTablePart);
                    
                    // 確保有足夠的單元格值
                    while (cellValues.Count < headers.Count)
                    {
                        cellValues.Add(string.Empty);
                    }

                    // 檢查是否為空行
                    if (cellValues.All(cell => string.IsNullOrWhiteSpace(cell)))
                    {
                        continue;
                    }

                    var rowData = new Dictionary<string, object>();
                    
                    for (int i = 0; i < headers.Count; i++)
                    {
                        var normalizedColumnName = ColumnNameNormalizer.Normalize(headers[i]);
                        rowData[normalizedColumnName] = cellValues[i] ?? string.Empty;
                    }
                    
                    excelData.Add(rowData);
                }

                // 使用通用的增量同步方法
                var processedRecords = await ProcessIncrementalSync(dataSet, excelData, "Excel");
                
                // 返回實際的數據源記錄數，而不是處理的記錄數
                var actualRecordCount = excelData.Count;
                
                _loggingService.LogInformation($"Excel 數據同步完成，數據源記錄數: {actualRecordCount}，處理記錄數: {processedRecords}，數據集ID: {dataSet.Id}");
                return new SyncResult { Success = true, TotalRecords = actualRecordCount };
            }
            catch (Exception ex)
            {
                _loggingService.LogError("Excel 數據同步失敗", ex);
                return new SyncResult { Success = false, ErrorMessage = $"Excel 數據同步失敗: {ex.Message}" };
            }
        }

        private List<string> GetCellValues(DocumentFormat.OpenXml.Spreadsheet.Row row, DocumentFormat.OpenXml.Packaging.SharedStringTablePart? sharedStringTable)
        {
            var values = new List<string>();
            var cells = row.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();

            foreach (var cell in cells)
            {
                var value = GetCellValue(cell, sharedStringTable);
                values.Add(value);
            }

            return values;
        }

        private string GetCellValue(DocumentFormat.OpenXml.Spreadsheet.Cell cell, DocumentFormat.OpenXml.Packaging.SharedStringTablePart? sharedStringTable)
        {
            if (cell.CellValue == null)
                return string.Empty;

            var value = cell.CellValue.InnerText;

            if (cell.DataType != null && cell.DataType.Value == DocumentFormat.OpenXml.Spreadsheet.CellValues.SharedString)
            {
                if (int.TryParse(value, out var index) && sharedStringTable != null)
                {
                    var sharedString = sharedStringTable.SharedStringTable.Elements<DocumentFormat.OpenXml.Spreadsheet.SharedStringItem>().ElementAt(index);
                    value = sharedString.Text?.Text ?? string.Empty;
                }
            }

            return value;
        }

        // 新增：Excel 日期序列號轉換為 SQL 日期
        private DateTime? ConvertExcelDateToSqlDate(string excelValue)
        {
            if (string.IsNullOrWhiteSpace(excelValue))
                return null;

            try
            {
                // 嘗試直接解析為日期（如果已經是標準日期格式）
                if (DateTime.TryParse(excelValue, out var directDate))
                {
                    return directDate;
                }

                // 嘗試解析為數字（Excel 日期序列號）
                if (double.TryParse(excelValue, out var excelDateNumber))
                {
                    // Excel 的日期基準是 1900-01-01，但 Excel 有個錯誤：它認為 1900 年是閏年
                    // 所以從 1900-03-01 開始，需要減去 1 天來修正
                    // 1900-01-01 對應的序列號是 1
                    
                    if (excelDateNumber >= 1 && excelDateNumber <= 2958465) // Excel 支援的日期範圍
                    {
                        var baseDate = new DateTime(1900, 1, 1);
                        var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                        
                        // 如果日期在 1900-03-01 之後，需要減去 1 天來修正 Excel 的閏年錯誤
                        if (calculatedDate >= new DateTime(1900, 3, 1))
                        {
                            calculatedDate = calculatedDate.AddDays(-1);
                        }
                        
                        _loggingService.LogInformation($"Excel 日期轉換成功 - 原始值: {excelValue}, 序列號: {excelDateNumber}, 轉換結果: {calculatedDate}");
                        return calculatedDate;
                    }
                }

                _loggingService.LogWarning($"無法轉換 Excel 日期值: {excelValue}");
                return null;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}, 值: {excelValue}", ex);
                return null;
            }
        }

        // 新增：檢查單元格是否為日期格式（改進版本）
        private bool IsDateCellAdvanced(DocumentFormat.OpenXml.Spreadsheet.Cell cell, DocumentFormat.OpenXml.Packaging.WorkbookPart workbookPart)
        {
            try
            {
                // 檢查單元格是否有樣式
                if (cell.StyleIndex == null)
                    return false;

                var styleIndex = cell.StyleIndex.Value;
                var stylesPart = workbookPart.WorkbookStylesPart;
                
                if (stylesPart?.Stylesheet?.CellFormats == null)
                    return false;

                var cellFormats = stylesPart.Stylesheet.CellFormats;
                if (styleIndex >= cellFormats.Count())
                    return false;

                var cellFormat = cellFormats.ElementAt((int)styleIndex) as DocumentFormat.OpenXml.Spreadsheet.CellFormat;
                if (cellFormat?.NumberFormatId == null)
                    return false;

                var numberFormatId = cellFormat.NumberFormatId.Value;
                
                // Excel 內建日期格式 ID 範圍
                // 這些是 Excel 標準的日期格式 ID
                var dateFormatIds = new[] { 14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58 };
                
                if (Array.IndexOf(dateFormatIds, numberFormatId) >= 0)
                    return true;

                // 檢查自定義日期格式
                var numberFormats = stylesPart.Stylesheet.NumberingFormats;
                if (numberFormats != null)
                {
                    foreach (var nf in numberFormats)
                    {
                        var numberingFormat = nf as DocumentFormat.OpenXml.Spreadsheet.NumberingFormat;
                        if (numberingFormat?.NumberFormatId?.Value == numberFormatId)
                        {
                            var formatCode = numberingFormat.FormatCode?.Value?.ToLower() ?? "";
                            
                            // 檢查是否包含日期時間格式代碼
                            var datePatterns = new[] { "yyyy", "yy", "dd", "mm", "m", "h", "s", "am/pm", "a/p" };
                            if (datePatterns.Any(pattern => formatCode.Contains(pattern)))
                            {
                                return true;
                            }
                        }
                    }
                }
                
                return false;
            }
            catch (Exception ex)
            {
                _loggingService.LogWarning($"檢查日期單元格時發生錯誤: {ex.Message}");
                return false;
            }
        }

        // 新增：獲取單元格的實際值和類型（改進版本）
        private (string value, string dataType) GetCellValueAndType(DocumentFormat.OpenXml.Spreadsheet.Cell cell, DocumentFormat.OpenXml.Packaging.SharedStringTablePart? sharedStringTable, DocumentFormat.OpenXml.Packaging.WorkbookPart? workbookPart = null)
        {
            var cellValue = GetCellValue(cell, sharedStringTable);
            
            // 如果單元格是日期格式，直接返回日期類型
            if (workbookPart != null && IsDateCellAdvanced(cell, workbookPart))
            {
                return (cellValue, "datetime");
            }
            
            // 否則根據值內容推斷類型
            var inferredType = InferDataType(cellValue);
            return (cellValue, inferredType);
        }

        private async Task EnsureColumnsExist(DataSet dataSet, List<string> headers, List<DocumentFormat.OpenXml.Spreadsheet.Cell> headerCells, DocumentFormat.OpenXml.Packaging.WorkbookPart workbookPart)
        {
            _loggingService.LogInformation($"開始確保欄位定義存在，數據集ID: {dataSet.Id}");
            var existingColumns = await _context.DataSetColumns
                .Where(c => c.DataSetId == dataSet.Id)
                .ToListAsync();

            // 不再自動創建 row_number 欄位，讓系統使用 Hash 進行比較

            var columnIndex = 0;
            for (int i = 0; i < headers.Count; i++)
            {
                var header = headers[i];
                if (string.IsNullOrWhiteSpace(header))
                    continue;

                var columnName = ColumnNameNormalizer.Normalize(header);
                var existingColumn = existingColumns.FirstOrDefault(c => c.ColumnName == columnName);

                if (existingColumn == null)
                {
                    // 優先檢查單元格格式，然後根據標題推斷類型
                    string inferredType = "string";
                    
                    // 檢查對應的單元格是否為日期格式
                    if (i < headerCells.Count)
                    {
                        var headerCell = headerCells[i];
                        
                        if (IsDateCellAdvanced(headerCell, workbookPart))
                        {
                            inferredType = "datetime";
                            _loggingService.LogInformation($"檢測到日期格式單元格，欄位: {header}, 類型: {inferredType}");
                        }
                        else
                        {
                            // 使用標題推斷類型
                            inferredType = InferDataTypeFromHeader(header);
                            _loggingService.LogInformation($"使用標題推斷類型，欄位: {header}, 類型: {inferredType}");
                        }
                    }
                    else
                    {
                        // 使用標題推斷類型
                        inferredType = InferDataTypeFromHeader(header);
                        _loggingService.LogInformation($"使用標題推斷類型，欄位: {header}, 類型: {inferredType}");
                    }
                    
                    var newColumn = new DataSetColumn
                    {
                        Id = Guid.NewGuid(),
                        DataSetId = dataSet.Id,
                        ColumnName = columnName,
                        DisplayName = header.Trim(),
                        DataType = inferredType,
                        MaxLength = inferredType == "string" ? 255 : null,
                        IsRequired = false,
                        IsPrimaryKey = columnIndex == 0,
                        IsSearchable = true,
                        IsSortable = true,
                        IsIndexed = false,
                        SortOrder = columnIndex
                    };

                    _context.DataSetColumns.Add(newColumn);
                    existingColumns.Add(newColumn);
                    _loggingService.LogInformation($"創建新欄位，數據集ID: {dataSet.Id}, 欄位名稱: {columnName}, 最終類型: {inferredType}");
                }
                else
                {
                    _loggingService.LogInformation($"欄位已存在，數據集ID: {dataSet.Id}, 欄位名稱: {columnName}");
                }

                columnIndex++;
            }

            await _context.SaveChangesAsync();
            _loggingService.LogInformation($"欄位定義確保完成，數據集ID: {dataSet.Id}");
        }

        private async Task<bool> ProcessExcelRow(DataSet dataSet, DocumentFormat.OpenXml.Spreadsheet.Row row, List<string> headers, DocumentFormat.OpenXml.Packaging.SharedStringTablePart? sharedStringTable)
        {
            try
            {
                _loggingService.LogInformation($"開始處理 Excel 行數據，數據集ID: {dataSet.Id}");
                var cells = row.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                var cellValues = GetCellValues(row, sharedStringTable);
                
                // 確保有足夠的單元格值
                while (cellValues.Count < headers.Count)
                {
                    cellValues.Add(string.Empty);
                }

                // 創建記錄
                var record = new DataSetRecord
                {
                    Id = Guid.NewGuid(),
                    DataSetId = dataSet.Id,
                    PrimaryKeyValue = cellValues.FirstOrDefault() ?? Guid.NewGuid().ToString(),
                    Status = "Active",
                    CreatedAt = DateTime.UtcNow,
                };

                _context.DataSetRecords.Add(record);
                _loggingService.LogInformation($"創建數據集記錄，數據集ID: {dataSet.Id}, 主鍵值: {record.PrimaryKeyValue}");

                // 獲取欄位定義
                var columns = await _context.DataSetColumns
                    .Where(c => c.DataSetId == dataSet.Id)
                    .ToListAsync();

                // 創建欄位值
                for (int i = 0; i < headers.Count; i++)
                {
                    if (string.IsNullOrWhiteSpace(headers[i]))
                        continue;

                    var columnName = ColumnNameNormalizer.Normalize(headers[i]);
                    var cellValue = cellValues[i] ?? string.Empty;
                    
                    // 找到對應的欄位定義
                    var columnDef = columns.FirstOrDefault(c => c.ColumnName == columnName);
                    var dataType = columnDef?.DataType?.ToLower() ?? "string";

                    _loggingService.LogInformation($"處理欄位: {columnName}, 數據類型: {dataType}, 原始值: {cellValue}");

                    var recordValue = new DataSetRecordValue
                    {
                        Id = Guid.NewGuid(),
                        RecordId = record.Id,
                        ColumnName = columnName,
                        // 初始化所有值欄位為 null
                        StringValue = null,
                        NumericValue = null,
                        DateValue = null,
                        BooleanValue = null
                    };

                    // 根據數據類型和值內容，存儲到正確的欄位
                    switch (dataType)
                    {
                        case "int":
                        case "decimal":
                            if (decimal.TryParse(cellValue, out var numericValue))
                            {
                                recordValue.NumericValue = numericValue;
                                _loggingService.LogInformation($"成功解析數值，欄位: {columnName}, 值: {cellValue}, 解析結果: {numericValue}");
                            }
                            else
                            {
                                recordValue.StringValue = cellValue; // 無法解析時存為字串
                                _loggingService.LogWarning($"無法解析數值，欄位: {columnName}, 值: {cellValue}");
                            }
                            break;
                            
                        case "datetime":
                        case "date":
                            // 使用新的 Excel 日期轉換方法
                            var convertedDate = ConvertExcelDateToSqlDate(cellValue);
                            if (convertedDate.HasValue)
                            {
                                recordValue.DateValue = convertedDate.Value;
                                _loggingService.LogInformation($"成功轉換 Excel 日期，欄位: {columnName}, 原始值: {cellValue}, 轉換結果: {convertedDate.Value}");
                            }
                            else
                            {
                                // 如果無法轉換，嘗試標準的 DateTime.Parse
                                if (DateTime.TryParse(cellValue, out var standardDate))
                                {
                                    recordValue.DateValue = standardDate;
                                    _loggingService.LogInformation($"使用標準日期解析成功，欄位: {columnName}, 值: {cellValue}, 解析結果: {standardDate}");
                                }
                                else
                                {
                                    recordValue.StringValue = cellValue; // 無法解析時存為字串
                                    _loggingService.LogWarning($"無法解析日期值，欄位: {columnName}, 值: {cellValue}");
                                }
                            }
                            break;
                            
                        case "boolean":
                        case "bool":
                            if (bool.TryParse(cellValue, out var boolValue))
                            {
                                recordValue.BooleanValue = boolValue;
                            }
                            else if (cellValue.ToLower() == "yes" || cellValue.ToLower() == "1" || cellValue.ToLower() == "true")
                            {
                                recordValue.BooleanValue = true;
                            }
                            else if (cellValue.ToLower() == "no" || cellValue.ToLower() == "0" || cellValue.ToLower() == "false")
                            {
                                recordValue.BooleanValue = false;
                            }
                            else
                            {
                                recordValue.StringValue = cellValue; // 無法解析時存為字串
                            }
                            break;
                            
                        default: // string, text
                            recordValue.StringValue = cellValue;
                            break;
                    }

                    _context.DataSetRecordValues.Add(recordValue);
                    _loggingService.LogInformation($"創建數據集記錄值，數據集ID: {dataSet.Id}, 記錄ID: {record.Id}, 欄位名稱: {columnName}, 數據類型: {dataType}, 值: {cellValue}");
                }

                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"Excel 行數據處理完成，數據集ID: {dataSet.Id}");
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理 Excel 行數據失敗: {ex.Message}", ex);
                return false;
            }
        }

        private async Task<SyncResult> SyncFromGoogleDocs(DataSet dataSet, DataSetDataSource dataSource)
        {
            try
            {
                _loggingService.LogInformation($"開始同步 Google Docs 數據，數據集ID: {dataSet.Id}");
                
                if (string.IsNullOrEmpty(dataSource.GoogleDocsUrl))
                {
                    _loggingService.LogWarning($"Google Docs URL 為空，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "Google Docs URL 不能為空" };
                }

                // 從 URL 中提取表格 ID
                var spreadsheetId = GoogleSheetsService.ExtractSpreadsheetId(dataSource.GoogleDocsUrl);
                if (string.IsNullOrEmpty(spreadsheetId))
                {
                    _loggingService.LogWarning($"無法從 URL 中提取表格 ID: {dataSource.GoogleDocsUrl}, 數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "無效的 Google Sheets URL" };
                }

                _loggingService.LogInformation($"提取的表格 ID: {spreadsheetId}, 數據集ID: {dataSet.Id}");

                // 檢測文件類型
                _loggingService.LogInformation($"開始檢測文件類型，表格ID: {spreadsheetId}, 數據集ID: {dataSet.Id}");
                var fileType = await _googleSheetsService.DetectFileTypeAsync(dataSet.CompanyId, spreadsheetId);
                _loggingService.LogInformation($"檢測到文件類型: {fileType}, 數據集ID: {dataSet.Id}");

                // 獲取工作表名稱：如果用戶沒有指定，自動獲取第一個工作表
                var sheetName = dataSource.GoogleDocsSheetName;
                if (string.IsNullOrWhiteSpace(sheetName))
                {
                    sheetName = await _googleSheetsService.GetFirstSheetNameAsync(dataSet.CompanyId, spreadsheetId);
                    _loggingService.LogInformation($"未指定工作表名稱，自動獲取第一個工作表: {sheetName}, 數據集ID: {dataSet.Id}");
                }
                else
                {
                    _loggingService.LogInformation($"使用指定的工作表名稱: {sheetName}, 數據集ID: {dataSet.Id}");
                }

                List<string> headers;
                List<Dictionary<string, object>> data;

                if (fileType == "excel")
                {
                    // 處理 Excel 文件（上傳到 Google Drive 的 Excel 文件）
                    _loggingService.LogInformation($"開始處理 Excel 文件，表格ID: {spreadsheetId}, 數據集ID: {dataSet.Id}");

                    var apiProviderService = _serviceProvider.GetRequiredService<Services.ApiProviders.IApiProviderService>();
                    var runtime = await apiProviderService.GetRuntimeProviderAsync(dataSet.CompanyId, "google-docs");
                    if (runtime == null || string.IsNullOrWhiteSpace(runtime.ApiKey))
                    {
                        _loggingService.LogWarning($"無法獲取 API Key，無法下載 Excel 文件，數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = "無法獲取 Google API 配置，請檢查 API Provider 設定" };
                    }

                    // 從 Google Drive 下載 Excel 文件
                    var downloadUrl = $"https://drive.google.com/uc?id={spreadsheetId}&export=download";
                    _loggingService.LogInformation($"開始從 Google Drive 下載 Excel 文件，URL: {downloadUrl}, 數據集ID: {dataSet.Id}");

                    using var httpClient = new System.Net.Http.HttpClient();
                    httpClient.Timeout = TimeSpan.FromSeconds(60);
                    
                    var response = await httpClient.GetAsync(downloadUrl);
                    if (!response.IsSuccessStatusCode)
                    {
                        _loggingService.LogWarning($"Google Drive 下載失敗，狀態碼: {response.StatusCode}, 數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = "無法從 Google Drive 下載 Excel 文件，請確保文件是公開的或有適當的權限" };
                    }

                    var fileBytes = await response.Content.ReadAsByteArrayAsync();
                    _loggingService.LogInformation($"Excel 文件下載成功，大小: {fileBytes.Length} bytes, 數據集ID: {dataSet.Id}");

                    // 解析 Excel 文件
                    using var stream = new System.IO.MemoryStream(fileBytes);
                    using var spreadsheetDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, false);
                    
                    var workbookPart = spreadsheetDocument.WorkbookPart;
                    if (workbookPart == null)
                    {
                        _loggingService.LogWarning($"無法讀取 Excel 工作簿，數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = "無法讀取 Excel 工作簿" };
                    }

                    // 查找指定的工作表
                    DocumentFormat.OpenXml.Packaging.WorksheetPart worksheetPart = null;
                    if (!string.IsNullOrEmpty(sheetName) && workbookPart.Workbook?.Sheets != null)
                    {
                        var sheet = workbookPart.Workbook.Sheets.Elements<DocumentFormat.OpenXml.Spreadsheet.Sheet>()
                            .FirstOrDefault(s => s.Name == sheetName);
                        
                        if (sheet != null)
                        {
                            worksheetPart = (DocumentFormat.OpenXml.Packaging.WorksheetPart)workbookPart.GetPartById(sheet.Id);
                        }
                    }
                    
                    if (worksheetPart == null)
                    {
                        worksheetPart = workbookPart.WorksheetParts.FirstOrDefault();
                    }

                    if (worksheetPart == null)
                    {
                        _loggingService.LogWarning($"無法找到工作表: {sheetName}, 數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = $"無法找到工作表: {sheetName}" };
                    }

                    var worksheet = worksheetPart.Worksheet;
                    var sheetData = worksheet.GetFirstChild<DocumentFormat.OpenXml.Spreadsheet.SheetData>();
                    
                    if (sheetData == null)
                    {
                        _loggingService.LogWarning($"Excel 工作表為空，數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = "Excel 工作表為空或無數據" };
                    }

                    var rows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
                    if (rows.Count == 0)
                    {
                        _loggingService.LogWarning($"Excel 工作表沒有數據行，數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = "Excel 工作表沒有數據" };
                    }

                    // 讀取標題行（第一行）
                    var headerRow = rows.First();
                    var headerCells = headerRow.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                    headers = GetCellValues(headerRow, workbookPart.SharedStringTablePart).ToList();
                    
                    if (!headers.Any(h => !string.IsNullOrWhiteSpace(h)))
                    {
                        _loggingService.LogWarning($"Excel 沒有找到有效的標題行，數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = "Excel 沒有找到有效的標題行" };
                    }

                    _loggingService.LogInformation($"Excel 標題行: {string.Join(", ", headers)}, 數據集ID: {dataSet.Id}");

                    // 檢查並創建欄位定義
                    await EnsureColumnsExist(dataSet, headers, headerCells, workbookPart);

                    // 讀取數據行（從第二行開始）
                    var dataRows = rows.Skip(1).ToList();
                    
                    // 將 Excel 數據轉換為統一的 Dictionary 格式
                    data = new List<Dictionary<string, object>>();
                    
                    foreach (var (row, rowIndex) in dataRows.Select((row, index) => (row, index)))
                    {
                        var cellValues = GetCellValues(row, workbookPart.SharedStringTablePart);
                        
                        // 確保有足夠的單元格值
                        while (cellValues.Count < headers.Count)
                        {
                            cellValues.Add(string.Empty);
                        }

                        // 檢查是否為空行
                        if (cellValues.All(cell => string.IsNullOrWhiteSpace(cell)))
                        {
                            continue;
                        }

                        var rowData = new Dictionary<string, object>();
                        
                        for (int i = 0; i < headers.Count; i++)
                        {
                            var normalizedColumnName = ColumnNameNormalizer.Normalize(headers[i]);
                            rowData[normalizedColumnName] = cellValues[i] ?? string.Empty;
                        }
                        
                        data.Add(rowData);
                    }
                }
                else
                {
                    // 處理原生 Google Sheets
                    _loggingService.LogInformation($"開始處理原生 Google Sheets，表格ID: {spreadsheetId}, 數據集ID: {dataSet.Id}");

                    // 測試連接
                    var connectionTest = await _googleSheetsService.TestConnectionAsync(dataSet.CompanyId, spreadsheetId);
                    if (!connectionTest)
                    {
                        _loggingService.LogWarning($"無法連接到 Google Sheets，表格ID: {spreadsheetId}, 數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = "無法連接到 Google Sheets，請檢查 URL 是否正確且表格為公開訪問" };
                    }

                    // 讀取數據
                    var sheetData = await _googleSheetsService.ReadSheetDataAsync(dataSet.CompanyId, spreadsheetId, sheetName);
                    if (!sheetData.Any())
                    {
                        _loggingService.LogWarning($"Google Sheets 沒有數據，表格ID: {spreadsheetId}, 工作表: {sheetName}, 數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = "Google Sheets 沒有數據" };
                    }

                    // 尋找標題行（跳過空行）
                    headers = new List<string>();
                    var headerRowIndex = -1;
                    
                    for (int i = 0; i < sheetData.Count; i++)
                    {
                        var row = sheetData[i];
                        if (row.Any(cell => !string.IsNullOrWhiteSpace(cell)))
                        {
                            headers = row.ToList();
                            headerRowIndex = i;
                            break;
                        }
                    }
                    
                    if (!headers.Any(h => !string.IsNullOrWhiteSpace(h)))
                    {
                        _loggingService.LogWarning($"Google Sheets 沒有找到有效的標題行，表格ID: {spreadsheetId}, 數據集ID: {dataSet.Id}");
                        return new SyncResult { Success = false, ErrorMessage = "Google Sheets 沒有找到有效的標題行" };
                    }

                    _loggingService.LogInformation($"Google Sheets 標題行（第 {headerRowIndex + 1} 行）: {string.Join(", ", headers)}, 數據集ID: {dataSet.Id}");

                    // 測試標準化邏輯
                    foreach (var header in headers)
                    {
                        var normalized = ColumnNameNormalizer.Normalize(header);
                        _loggingService.LogInformation($"標準化測試: '{header}' -> '{normalized}', 數據集ID: {dataSet.Id}");
                    }

                    // 檢查並創建欄位定義
                    await EnsureGoogleSheetsColumnsExist(dataSet, headers);

                    // 處理數據行（從標題行之後開始）
                    var dataRows = sheetData.Skip(headerRowIndex + 1).ToList();
                    _loggingService.LogInformation($"準備處理 {dataRows.Count} 行數據，數據集ID: {dataSet.Id}");
                    
                    // 將 Google Sheets 數據轉換為統一的 Dictionary 格式
                    data = new List<Dictionary<string, object>>();
                    
                    foreach (var (row, rowIndex) in dataRows.Select((row, index) => (row, index)))
                    {
                        // 檢查是否為空行
                        if (row.All(cell => string.IsNullOrWhiteSpace(cell)))
                        {
                            continue;
                        }

                        var rowData = new Dictionary<string, object>();
                        
                        for (int i = 0; i < headers.Count; i++)
                        {
                            var normalizedColumnName = ColumnNameNormalizer.Normalize(headers[i]);
                            var value = i < row.Count ? row[i] : string.Empty;
                            rowData[normalizedColumnName] = value ?? string.Empty;
                        }
                        
                        data.Add(rowData);
                    }
                }

                // 使用通用的增量同步方法
                var sourceType = fileType == "excel" ? "Excel (Google Drive)" : "Google Sheets";
                // 檢查是否為雙向同步的入站階段（通過檢查 DataSet 的 SyncDirection）
                var isBidirectionalInbound = dataSet.SyncDirection == "bidirectional";
                var processedRecords = await ProcessIncrementalSync(dataSet, data, sourceType, skipDeletes: isBidirectionalInbound);
                
                // 返回實際的數據源記錄數，而不是處理的記錄數
                var actualRecordCount = data.Count;
                
                _loggingService.LogInformation($"{sourceType} 數據同步完成，數據源記錄數: {actualRecordCount}，處理記錄數: {processedRecords}，數據集ID: {dataSet.Id}");
                return new SyncResult { Success = true, TotalRecords = actualRecordCount };
            }
            catch (Exception ex)
            {
                _loggingService.LogError("Google Docs 數據同步失敗", ex);
                return new SyncResult { Success = false, ErrorMessage = $"Google Docs 數據同步失敗: {ex.Message}" };
            }
        }

        /// <summary>
        /// 將內部 DataSet 數據同步到 Excel 文件（出站同步）
        /// </summary>
        private async Task<SyncResult> SyncToExcel(DataSet dataSet, DataSetDataSource dataSource)
        {
            try
            {
                _loggingService.LogInformation($"開始將數據同步到 Excel 文件，數據集ID: {dataSet.Id}");
                
                if (string.IsNullOrEmpty(dataSource.GoogleDocsUrl))
                {
                    _loggingService.LogWarning($"Google Docs URL 為空，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "Google Docs URL 不能為空" };
                }

                // 從 URL 中提取表格 ID
                var spreadsheetId = GoogleSheetsService.ExtractSpreadsheetId(dataSource.GoogleDocsUrl);
                if (string.IsNullOrEmpty(spreadsheetId))
                {
                    _loggingService.LogWarning($"無法從 URL 中提取表格 ID: {dataSource.GoogleDocsUrl}, 數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "無效的 Google Sheets URL" };
                }

                _loggingService.LogInformation($"提取的表格 ID: {spreadsheetId}, 數據集ID: {dataSet.Id}");

                // 獲取工作表名稱
                var sheetName = dataSource.GoogleDocsSheetName ?? "Sheet1";
                _loggingService.LogInformation($"使用工作表名稱: {sheetName}, 數據集ID: {dataSet.Id}");

                // 獲取欄位定義（按 sortOrder 排序）
                var columns = await _context.DataSetColumns
                    .Where(c => c.DataSetId == dataSet.Id)
                    .OrderBy(c => c.SortOrder)
                    .ThenBy(c => c.ColumnName)
                    .ToListAsync();

                if (!columns.Any())
                {
                    _loggingService.LogWarning($"數據集沒有欄位定義，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "數據集沒有欄位定義" };
                }

                // 獲取所有記錄
                var records = await _context.DataSetRecords
                    .Where(r => r.DataSetId == dataSet.Id && r.Status == "Active")
                    .Include(r => r.Values)
                    .OrderBy(r => r.CreatedAt)
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {records.Count} 條活躍記錄，數據集ID: {dataSet.Id}");

                if (!records.Any())
                {
                    _loggingService.LogInformation($"沒有活躍記錄需要同步，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = true, TotalRecords = 0 };
                }

                // 下載 Excel 文件
                _loggingService.LogInformation($"開始下載 Excel 文件，文件ID: {spreadsheetId}");
                byte[] fileBytes = null;
                try
                {
                    fileBytes = await _googleSheetsService.DownloadExcelFileAsync(dataSet.CompanyId, spreadsheetId);
                }
                catch (Exception downloadEx)
                {
                    _loggingService.LogWarning($"下載 Excel 文件失敗，可能是因為 fileId 是 Google Sheets 的 ID 而不是 Drive 文件的 ID。錯誤: {downloadEx.Message}");
                    // 如果下載失敗，可能是因為 fileId 是 Google Sheets 的 ID，不是 Drive 文件的 ID
                    // 在這種情況下，回退到使用 Google Sheets API 來更新數據
                    _loggingService.LogInformation($"檢測到文件可能是 Google Sheets，回退到使用 Google Sheets API 來更新數據");
                    // 繼續執行後續的 Google Sheets API 更新邏輯（不返回，繼續執行）
                    // 但我們需要跳過 Excel 同步，直接使用 Google Sheets API
                    // 這裡我們應該返回一個錯誤，讓調用者知道需要使用 Google Sheets API
                    return new SyncResult 
                    { 
                        Success = false, 
                        ErrorMessage = $"無法使用 Excel 同步方法。文件 ID ({spreadsheetId}) 可能是 Google Sheets 的 ID，不是 Google Drive 文件的 ID。請確保文件類型檢測正確，或使用 Google Sheets API 來更新數據。原始錯誤: {downloadEx.Message}" 
                    };
                }
                
                // 如果文件為空或不存在，創建新的 Excel 文件
                if (fileBytes == null || fileBytes.Length == 0)
                {
                    _loggingService.LogInformation($"Excel 文件為空或不存在，創建新的 Excel 文件，文件ID: {spreadsheetId}");
                    
                    using var newStream = new MemoryStream();
                    using (var newDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Create(newStream, DocumentFormat.OpenXml.SpreadsheetDocumentType.Workbook))
                    {
                        var newWorkbookPart = newDocument.AddWorkbookPart();
                        newWorkbookPart.Workbook = new DocumentFormat.OpenXml.Spreadsheet.Workbook();
                        
                        // 添加 SharedStringTablePart
                        var newSharedStringTablePart = newWorkbookPart.AddNewPart<DocumentFormat.OpenXml.Packaging.SharedStringTablePart>();
                        newSharedStringTablePart.SharedStringTable = new DocumentFormat.OpenXml.Spreadsheet.SharedStringTable();
                        
                        // 創建工作表
                        var newWorksheetPart = newWorkbookPart.AddNewPart<DocumentFormat.OpenXml.Packaging.WorksheetPart>();
                        newWorksheetPart.Worksheet = new DocumentFormat.OpenXml.Spreadsheet.Worksheet(new DocumentFormat.OpenXml.Spreadsheet.SheetData());
                        
                        // 添加工作表到工作簿
                        var sheets = newWorkbookPart.Workbook.AppendChild(new DocumentFormat.OpenXml.Spreadsheet.Sheets());
                        var sheet = new DocumentFormat.OpenXml.Spreadsheet.Sheet()
                        {
                            Id = newWorkbookPart.GetIdOfPart(newWorksheetPart),
                            SheetId = 1,
                            Name = sheetName ?? "Sheet1"
                        };
                        sheets.Append(sheet);
                        
                        newWorkbookPart.Workbook.Save();
                    }
                    fileBytes = newStream.ToArray();
                    _loggingService.LogInformation($"創建新的 Excel 文件成功，大小: {fileBytes.Length} bytes");
                }
                else
                {
                    _loggingService.LogInformation($"Excel 文件下載成功，大小: {fileBytes.Length} bytes");
                }

                // 使用 OpenXML 修改 Excel 文件
                using var stream = new MemoryStream();
                stream.Write(fileBytes, 0, fileBytes.Length);
                stream.Position = 0;

                using var spreadsheetDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, true);
                var workbookPart = spreadsheetDocument.WorkbookPart;
                
                if (workbookPart == null)
                {
                    _loggingService.LogWarning($"無法讀取 Excel 工作簿，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "無法讀取 Excel 工作簿" };
                }

                // 確保 SharedStringTablePart 存在
                var sharedStringTablePart = workbookPart.SharedStringTablePart;
                if (sharedStringTablePart == null)
                {
                    sharedStringTablePart = workbookPart.AddNewPart<DocumentFormat.OpenXml.Packaging.SharedStringTablePart>();
                    sharedStringTablePart.SharedStringTable = new DocumentFormat.OpenXml.Spreadsheet.SharedStringTable();
                }

                // 查找或創建工作表
                DocumentFormat.OpenXml.Packaging.WorksheetPart worksheetPart = null;
                if (!string.IsNullOrEmpty(sheetName) && workbookPart.Workbook?.Sheets != null)
                {
                    var sheet = workbookPart.Workbook.Sheets.Elements<DocumentFormat.OpenXml.Spreadsheet.Sheet>()
                        .FirstOrDefault(s => s.Name == sheetName);
                    
                    if (sheet != null)
                    {
                        worksheetPart = (DocumentFormat.OpenXml.Packaging.WorksheetPart)workbookPart.GetPartById(sheet.Id);
                    }
                }
                
                if (worksheetPart == null)
                {
                    worksheetPart = workbookPart.WorksheetParts.FirstOrDefault();
                }

                if (worksheetPart == null)
                {
                    _loggingService.LogWarning($"無法找到工作表: {sheetName}, 數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = $"無法找到工作表: {sheetName}" };
                }

                var worksheet = worksheetPart.Worksheet;
                var sheetData = worksheet.GetFirstChild<DocumentFormat.OpenXml.Spreadsheet.SheetData>();
                
                if (sheetData == null)
                {
                    sheetData = new DocumentFormat.OpenXml.Spreadsheet.SheetData();
                    worksheet.AppendChild(sheetData);
                }

                // 構建主鍵映射（讀取現有數據）
                var primaryKeyColumns = columns.Where(c => c.IsPrimaryKey).ToList();
                var primaryKeyToRowMap = new Dictionary<string, uint>();
                
                if (sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().Any())
                {
                    var existingRows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
                    var existingHeaderRow = existingRows.FirstOrDefault();
                    
                    if (existingHeaderRow != null && primaryKeyColumns.Any())
                    {
                        var headerCells = existingHeaderRow.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                        var headerValues = GetCellValues(existingHeaderRow, workbookPart.SharedStringTablePart);
                        
                        // 找到主鍵欄位在標題行中的位置
                        var primaryKeyIndices = new List<int>();
                        foreach (var pkColumn in primaryKeyColumns)
                        {
                            var normalizedPkName = ColumnNameNormalizer.Normalize(pkColumn.ColumnName);
                            for (int i = 0; i < headerValues.Count; i++)
                            {
                                var normalizedHeader = ColumnNameNormalizer.Normalize(headerValues[i]);
                                if (normalizedHeader == normalizedPkName || headerValues[i] == pkColumn.DisplayName || headerValues[i] == pkColumn.ColumnName)
                                {
                                    primaryKeyIndices.Add(i);
                                    break;
                                }
                            }
                        }
                        
                        // 構建主鍵值到行號的映射（從第2行開始，第1行是標題）
                        // 使用與出站同步相同的格式：columnName:value
                        var dataRows = existingRows.Skip(1).ToList();
                        for (int rowIndex = 0; rowIndex < dataRows.Count; rowIndex++)
                        {
                            var row = dataRows[rowIndex];
                            var cellValues = GetCellValues(row, workbookPart.SharedStringTablePart);
                            
                            if (primaryKeyIndices.Any() && primaryKeyIndices.All(idx => idx < cellValues.Count))
                            {
                                // 使用與 BuildCompositeKey 相同的格式：columnName:value
                                var keyParts = new List<string>();
                                foreach (var pkColumn in primaryKeyColumns.OrderBy(c => c.ColumnName))
                                {
                                    var pkIndex = primaryKeyIndices.FirstOrDefault(idx => 
                                        ColumnNameNormalizer.Normalize(headerValues[idx]) == ColumnNameNormalizer.Normalize(pkColumn.ColumnName) ||
                                        headerValues[idx] == pkColumn.DisplayName ||
                                        headerValues[idx] == pkColumn.ColumnName);
                                    
                                    if (pkIndex >= 0 && pkIndex < cellValues.Count)
                                    {
                                        var value = cellValues[pkIndex]?.Trim() ?? string.Empty;
                                        if (string.IsNullOrEmpty(value))
                                        {
                                            value = "NULL";
                                        }
                                        keyParts.Add($"{pkColumn.ColumnName}:{value}");
                                    }
                                }
                                
                                var compositeKey = string.Join("|", keyParts);
                                if (!string.IsNullOrEmpty(compositeKey))
                                {
                                    primaryKeyToRowMap[compositeKey] = row.RowIndex ?? (uint)(rowIndex + 2);
                                }
                            }
                        }
                        
                        _loggingService.LogInformation($"構建主鍵映射完成，找到 {primaryKeyToRowMap.Count} 個映射關係");
                    }
                }

                // 更新標題行
                var headerRow = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().FirstOrDefault();
                if (headerRow == null)
                {
                    headerRow = new DocumentFormat.OpenXml.Spreadsheet.Row { RowIndex = 1 };
                    sheetData.AppendChild(headerRow);
                }
                else
                {
                    headerRow.RemoveAllChildren<DocumentFormat.OpenXml.Spreadsheet.Cell>();
                }

                // 構建標題行
                uint columnIndex = 1;
                foreach (var column in columns)
                {
                    var cell = new DocumentFormat.OpenXml.Spreadsheet.Cell
                    {
                        CellReference = GetExcelColumnName(columnIndex) + "1",
                        DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.String,
                        CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(column.DisplayName ?? column.ColumnName)
                    };
                    headerRow.AppendChild(cell);
                    columnIndex++;
                }

                // 構建數據行並進行增量同步
                var rowsToAdd = new List<DocumentFormat.OpenXml.Spreadsheet.Row>();
                var rowsToUpdate = new Dictionary<uint, DocumentFormat.OpenXml.Spreadsheet.Row>();
                var processedRowNumbers = new HashSet<uint>();

                uint nextRowIndex = 2; // 從第2行開始（第1行是標題）
                if (sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().Any())
                {
                    var maxRowIndex = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>()
                        .Where(r => r.RowIndex.HasValue)
                        .Select(r => r.RowIndex.Value)
                        .DefaultIfEmpty((uint)1)
                        .Max();
                    nextRowIndex = maxRowIndex + 1;
                }

                foreach (var record in records)
                {
                    // 構建主鍵值（使用與入站同步相同的格式：columnName:value）
                    string primaryKeyValue = string.Empty;
                    if (primaryKeyColumns.Any())
                    {
                        primaryKeyValue = BuildCompositeKeyFromRecord(record, primaryKeyColumns);
                    }
                    else
                    {
                        primaryKeyValue = record.PrimaryKeyValue ?? string.Empty;
                    }

                    // 構建數據行
                    var dataRow = BuildExcelRow(record, columns, workbookPart, sharedStringTablePart, nextRowIndex);

                    // 檢查是否需要更新現有行或添加新行
                    if (!string.IsNullOrEmpty(primaryKeyValue) && primaryKeyToRowMap.ContainsKey(primaryKeyValue))
                    {
                        // 更新現有行
                        var rowIndex = primaryKeyToRowMap[primaryKeyValue];
                        dataRow.RowIndex = rowIndex;
                        rowsToUpdate[rowIndex] = dataRow;
                        processedRowNumbers.Add(rowIndex);
                        _loggingService.LogDebug($"準備更新行 {rowIndex}，主鍵: {primaryKeyValue}");
                    }
                    else
                    {
                        // 添加新行
                        dataRow.RowIndex = nextRowIndex;
                        rowsToAdd.Add(dataRow);
                        nextRowIndex++;
                        _loggingService.LogDebug($"準備添加新行，主鍵: {primaryKeyValue}");
                    }
                }

                // 刪除未處理的現有行（如果需要的話，這裡暫時不刪除，只更新和添加）
                // 應用更新：先刪除舊行，再插入新行
                foreach (var (rowIndex, row) in rowsToUpdate)
                {
                    var existingRow = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>()
                        .FirstOrDefault(r => r.RowIndex == rowIndex);
                    if (existingRow != null)
                    {
                        sheetData.RemoveChild(existingRow);
                    }
                    sheetData.InsertAt(row, (int)rowIndex - 1);
                }

                // 添加新行（按照 RowIndex 順序插入，OpenXML 要求行必須按順序排列）
                var sortedRowsToAdd = rowsToAdd.OrderBy(r => r.RowIndex).ToList();
                foreach (var row in sortedRowsToAdd)
                {
                    // 找到正確的插入位置（在 RowIndex 小於當前行的最後一行之後）
                    var existingRows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
                    var insertPosition = existingRows.Count;
                    
                    for (int i = 0; i < existingRows.Count; i++)
                    {
                        if (existingRows[i].RowIndex.HasValue && existingRows[i].RowIndex.Value > row.RowIndex)
                        {
                            insertPosition = i;
                            break;
                        }
                    }
                    
                    if (insertPosition < existingRows.Count)
                    {
                        sheetData.InsertAt(row, insertPosition);
                    }
                    else
                    {
                        sheetData.AppendChild(row);
                    }
                    
                    _loggingService.LogDebug($"已添加新行到 sheetData，RowIndex: {row.RowIndex}，插入位置: {insertPosition}");
                }

                // 驗證行數和順序
                var totalRowsAfterAdd = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().Count();
                var rowIndices = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>()
                    .Select(r => r.RowIndex?.ToString() ?? "null")
                    .ToList();
                _loggingService.LogInformation($"添加數據行後，sheetData 中共有 {totalRowsAfterAdd} 行（包括標題行），RowIndex 順序: {string.Join(", ", rowIndices)}");

                // 保存工作表
                worksheet.Save();
                workbookPart.Workbook.Save();
                
                // 確保所有更改都已寫入 stream
                spreadsheetDocument.WorkbookPart.Workbook.Save();
                
                // 獲取更新後的文件字節（在 using 塊結束前讀取）
                stream.Position = 0;
                var updatedBytes = stream.ToArray();
                _loggingService.LogInformation($"更新後的 Excel 文件大小: {updatedBytes.Length} bytes");
                
                // 驗證數據行是否正確寫入
                var rowCount = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().Count();
                _loggingService.LogInformation($"驗證：sheetData 中共有 {rowCount} 行，文件大小: {updatedBytes.Length} bytes");

                // 上傳回 Google Drive
                _loggingService.LogInformation($"開始上傳更新後的 Excel 文件，文件ID: {spreadsheetId}");
                await _googleSheetsService.UploadExcelFileAsync(dataSet.CompanyId, spreadsheetId, updatedBytes);
                _loggingService.LogInformation($"成功上傳 Excel 文件");

                var totalRecords = rowsToAdd.Count + rowsToUpdate.Count;
                _loggingService.LogInformation($"Excel 出站同步完成，數據集ID: {dataSet.Id}，新增: {rowsToAdd.Count}，更新: {rowsToUpdate.Count}，總計: {totalRecords}");
                
                return new SyncResult { Success = true, TotalRecords = totalRecords };
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Excel 出站同步失敗: {ex.Message}", ex);
                return new SyncResult { Success = false, ErrorMessage = $"Excel 出站同步失敗: {ex.Message}" };
            }
        }

        /// <summary>
        /// 將內部 DataSet 數據同步到本地 Excel 文件（出站同步）
        /// </summary>
        private async Task<SyncResult> SyncToLocalExcel(DataSet dataSet, DataSetDataSource dataSource)
        {
            try
            {
                _loggingService.LogInformation($"開始將數據同步到本地 Excel 文件，數據集ID: {dataSet.Id}");
                
                if (string.IsNullOrEmpty(dataSource.ExcelFilePath))
                {
                    _loggingService.LogWarning($"Excel 文件路徑為空，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "Excel 文件路徑不能為空" };
                }

                // 構建完整的文件路徑
                var filePath = dataSource.ExcelFilePath;
                if (!Path.IsPathRooted(filePath) || (filePath.StartsWith("/") && !filePath.StartsWith("\\")))
                {
                    var relativePath = filePath.TrimStart('/');
                    filePath = Path.Combine(Directory.GetCurrentDirectory(), relativePath);
                    _loggingService.LogInformation($"構建完整路徑: {filePath}");
                }
                else
                {
                    _loggingService.LogInformation($"使用絕對路徑: {filePath}");
                }

                // 獲取工作表名稱
                var sheetName = dataSource.ExcelSheetName ?? "Sheet1";
                _loggingService.LogInformation($"使用工作表名稱: {sheetName}, 數據集ID: {dataSet.Id}");

                // 獲取欄位定義（按 sortOrder 排序）
                var columns = await _context.DataSetColumns
                    .Where(c => c.DataSetId == dataSet.Id)
                    .OrderBy(c => c.SortOrder)
                    .ThenBy(c => c.ColumnName)
                    .ToListAsync();

                if (!columns.Any())
                {
                    _loggingService.LogWarning($"數據集沒有欄位定義，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "數據集沒有欄位定義" };
                }

                // 獲取所有記錄
                var records = await _context.DataSetRecords
                    .Where(r => r.DataSetId == dataSet.Id && r.Status == "Active")
                    .Include(r => r.Values)
                    .OrderBy(r => r.CreatedAt)
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {records.Count} 條活躍記錄，數據集ID: {dataSet.Id}");

                if (!records.Any())
                {
                    _loggingService.LogInformation($"沒有活躍記錄需要同步，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = true, TotalRecords = 0 };
                }

                // 檢查文件是否存在，如果不存在則創建新文件
                byte[] fileBytes = null;
                if (System.IO.File.Exists(filePath))
                {
                    _loggingService.LogInformation($"讀取現有 Excel 文件: {filePath}");
                    fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
                }
                else
                {
                    _loggingService.LogInformation($"Excel 文件不存在，創建新文件: {filePath}");
                    // 確保目錄存在
                    var directory = Path.GetDirectoryName(filePath);
                    if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                    {
                        Directory.CreateDirectory(directory);
                    }

                    // 創建新的 Excel 文件
                    using var newStream = new MemoryStream();
                    using (var newDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Create(newStream, DocumentFormat.OpenXml.SpreadsheetDocumentType.Workbook))
                    {
                        var newWorkbookPart = newDocument.AddWorkbookPart();
                        newWorkbookPart.Workbook = new DocumentFormat.OpenXml.Spreadsheet.Workbook();
                        
                        // 添加 SharedStringTablePart
                        var newSharedStringTablePart = newWorkbookPart.AddNewPart<DocumentFormat.OpenXml.Packaging.SharedStringTablePart>();
                        newSharedStringTablePart.SharedStringTable = new DocumentFormat.OpenXml.Spreadsheet.SharedStringTable();
                        
                        // 創建工作表
                        var newWorksheetPart = newWorkbookPart.AddNewPart<DocumentFormat.OpenXml.Packaging.WorksheetPart>();
                        newWorksheetPart.Worksheet = new DocumentFormat.OpenXml.Spreadsheet.Worksheet(new DocumentFormat.OpenXml.Spreadsheet.SheetData());
                        
                        // 添加工作表到工作簿
                        var sheets = newWorkbookPart.Workbook.AppendChild(new DocumentFormat.OpenXml.Spreadsheet.Sheets());
                        var sheet = new DocumentFormat.OpenXml.Spreadsheet.Sheet()
                        {
                            Id = newWorkbookPart.GetIdOfPart(newWorksheetPart),
                            SheetId = 1,
                            Name = sheetName
                        };
                        sheets.Append(sheet);
                        
                        newWorkbookPart.Workbook.Save();
                    }
                    fileBytes = newStream.ToArray();
                    _loggingService.LogInformation($"創建新的 Excel 文件成功，大小: {fileBytes.Length} bytes");
                }

                // 使用 OpenXML 修改 Excel 文件
                using var stream = new MemoryStream();
                stream.Write(fileBytes, 0, fileBytes.Length);
                stream.Position = 0;

                using var spreadsheetDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, true);
                var workbookPart = spreadsheetDocument.WorkbookPart;
                
                if (workbookPart == null)
                {
                    _loggingService.LogWarning($"無法讀取 Excel 工作簿，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "無法讀取 Excel 工作簿" };
                }

                // 確保 SharedStringTablePart 存在
                var sharedStringTablePart = workbookPart.SharedStringTablePart;
                if (sharedStringTablePart == null)
                {
                    sharedStringTablePart = workbookPart.AddNewPart<DocumentFormat.OpenXml.Packaging.SharedStringTablePart>();
                    sharedStringTablePart.SharedStringTable = new DocumentFormat.OpenXml.Spreadsheet.SharedStringTable();
                }

                // 查找或創建工作表
                DocumentFormat.OpenXml.Packaging.WorksheetPart worksheetPart = null;
                if (!string.IsNullOrEmpty(sheetName) && workbookPart.Workbook?.Sheets != null)
                {
                    var sheet = workbookPart.Workbook.Sheets.Elements<DocumentFormat.OpenXml.Spreadsheet.Sheet>()
                        .FirstOrDefault(s => s.Name == sheetName);
                    
                    if (sheet != null)
                    {
                        worksheetPart = (DocumentFormat.OpenXml.Packaging.WorksheetPart)workbookPart.GetPartById(sheet.Id);
                    }
                }
                
                if (worksheetPart == null)
                {
                    worksheetPart = workbookPart.WorksheetParts.FirstOrDefault();
                }

                if (worksheetPart == null)
                {
                    _loggingService.LogWarning($"無法找到工作表: {sheetName}, 數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = $"無法找到工作表: {sheetName}" };
                }

                var worksheet = worksheetPart.Worksheet;
                var sheetData = worksheet.GetFirstChild<DocumentFormat.OpenXml.Spreadsheet.SheetData>();
                
                if (sheetData == null)
                {
                    sheetData = new DocumentFormat.OpenXml.Spreadsheet.SheetData();
                    worksheet.AppendChild(sheetData);
                }

                // 構建主鍵映射（讀取現有數據）
                var primaryKeyColumns = columns.Where(c => c.IsPrimaryKey).ToList();
                var primaryKeyToRowMap = new Dictionary<string, uint>();
                
                if (sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().Any())
                {
                    var existingRows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
                    var existingHeaderRow = existingRows.FirstOrDefault();
                    
                    if (existingHeaderRow != null && primaryKeyColumns.Any())
                    {
                        var headerValues = GetCellValues(existingHeaderRow, workbookPart.SharedStringTablePart);
                        
                        // 找到主鍵欄位在標題行中的位置
                        var primaryKeyIndices = new List<int>();
                        foreach (var pkColumn in primaryKeyColumns)
                        {
                            var normalizedPkName = ColumnNameNormalizer.Normalize(pkColumn.ColumnName);
                            for (int i = 0; i < headerValues.Count; i++)
                            {
                                var normalizedHeader = ColumnNameNormalizer.Normalize(headerValues[i]);
                                if (normalizedHeader == normalizedPkName || headerValues[i] == pkColumn.DisplayName || headerValues[i] == pkColumn.ColumnName)
                                {
                                    primaryKeyIndices.Add(i);
                                    break;
                                }
                            }
                        }
                        
                        // 構建主鍵值到行號的映射（從第2行開始，第1行是標題）
                        var dataRows = existingRows.Skip(1).ToList();
                        for (int rowIndex = 0; rowIndex < dataRows.Count; rowIndex++)
                        {
                            var row = dataRows[rowIndex];
                            var cellValues = GetCellValues(row, workbookPart.SharedStringTablePart);
                            
                            if (primaryKeyIndices.Any() && primaryKeyIndices.All(idx => idx < cellValues.Count))
                            {
                                var keyParts = new List<string>();
                                foreach (var pkColumn in primaryKeyColumns.OrderBy(c => c.ColumnName))
                                {
                                    var pkIndex = primaryKeyIndices.FirstOrDefault(idx => 
                                        ColumnNameNormalizer.Normalize(headerValues[idx]) == ColumnNameNormalizer.Normalize(pkColumn.ColumnName) ||
                                        headerValues[idx] == pkColumn.DisplayName ||
                                        headerValues[idx] == pkColumn.ColumnName);
                                    
                                    if (pkIndex >= 0 && pkIndex < cellValues.Count)
                                    {
                                        var value = cellValues[pkIndex]?.Trim() ?? string.Empty;
                                        if (string.IsNullOrEmpty(value))
                                        {
                                            value = "NULL";
                                        }
                                        keyParts.Add($"{pkColumn.ColumnName}:{value}");
                                    }
                                }
                                
                                var compositeKey = string.Join("|", keyParts);
                                if (!string.IsNullOrEmpty(compositeKey))
                                {
                                    primaryKeyToRowMap[compositeKey] = row.RowIndex ?? (uint)(rowIndex + 2);
                                }
                            }
                        }
                        
                        _loggingService.LogInformation($"構建主鍵映射完成，找到 {primaryKeyToRowMap.Count} 個映射關係");
                    }
                }

                // 更新標題行
                var headerRow = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().FirstOrDefault();
                if (headerRow == null)
                {
                    headerRow = new DocumentFormat.OpenXml.Spreadsheet.Row { RowIndex = 1 };
                    sheetData.AppendChild(headerRow);
                }
                else
                {
                    headerRow.RemoveAllChildren<DocumentFormat.OpenXml.Spreadsheet.Cell>();
                }

                // 構建標題行
                uint columnIndex = 1;
                foreach (var column in columns)
                {
                    var cell = new DocumentFormat.OpenXml.Spreadsheet.Cell
                    {
                        CellReference = GetExcelColumnName(columnIndex) + "1",
                        DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.String,
                        CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(column.DisplayName ?? column.ColumnName)
                    };
                    headerRow.AppendChild(cell);
                    columnIndex++;
                }

                // 構建數據行並進行增量同步
                var rowsToAdd = new List<DocumentFormat.OpenXml.Spreadsheet.Row>();
                var rowsToUpdate = new Dictionary<uint, DocumentFormat.OpenXml.Spreadsheet.Row>();
                var processedRowNumbers = new HashSet<uint>();

                uint nextRowIndex = 2; // 從第2行開始（第1行是標題）
                if (sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().Any())
                {
                    var maxRowIndex = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>()
                        .Where(r => r.RowIndex.HasValue)
                        .Select(r => r.RowIndex.Value)
                        .DefaultIfEmpty((uint)1)
                        .Max();
                    nextRowIndex = maxRowIndex + 1;
                }

                foreach (var record in records)
                {
                    // 構建主鍵值（使用與入站同步相同的格式：columnName:value）
                    string primaryKeyValue = string.Empty;
                    if (primaryKeyColumns.Any())
                    {
                        primaryKeyValue = BuildCompositeKeyFromRecord(record, primaryKeyColumns);
                    }
                    else
                    {
                        primaryKeyValue = record.PrimaryKeyValue ?? string.Empty;
                    }

                    // 構建數據行
                    var dataRow = BuildExcelRow(record, columns, workbookPart, sharedStringTablePart, nextRowIndex);

                    // 檢查是否需要更新現有行或添加新行
                    if (!string.IsNullOrEmpty(primaryKeyValue) && primaryKeyToRowMap.ContainsKey(primaryKeyValue))
                    {
                        // 更新現有行
                        var rowIndex = primaryKeyToRowMap[primaryKeyValue];
                        dataRow.RowIndex = rowIndex;
                        rowsToUpdate[rowIndex] = dataRow;
                        processedRowNumbers.Add(rowIndex);
                        _loggingService.LogDebug($"準備更新行 {rowIndex}，主鍵: {primaryKeyValue}");
                    }
                    else
                    {
                        // 添加新行
                        dataRow.RowIndex = nextRowIndex;
                        rowsToAdd.Add(dataRow);
                        nextRowIndex++;
                        _loggingService.LogDebug($"準備添加新行，主鍵: {primaryKeyValue}");
                    }
                }

                // 應用更新：先刪除舊行，再插入新行
                foreach (var (rowIndex, row) in rowsToUpdate)
                {
                    var existingRow = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>()
                        .FirstOrDefault(r => r.RowIndex == rowIndex);
                    if (existingRow != null)
                    {
                        sheetData.RemoveChild(existingRow);
                    }
                    sheetData.InsertAt(row, (int)rowIndex - 1);
                }

                // 添加新行（按照 RowIndex 順序插入）
                var sortedRowsToAdd = rowsToAdd.OrderBy(r => r.RowIndex).ToList();
                foreach (var row in sortedRowsToAdd)
                {
                    var existingRows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
                    var insertPosition = existingRows.Count;
                    
                    for (int i = 0; i < existingRows.Count; i++)
                    {
                        if (existingRows[i].RowIndex.HasValue && existingRows[i].RowIndex.Value > row.RowIndex)
                        {
                            insertPosition = i;
                            break;
                        }
                    }
                    
                    if (insertPosition < existingRows.Count)
                    {
                        sheetData.InsertAt(row, insertPosition);
                    }
                    else
                    {
                        sheetData.AppendChild(row);
                    }
                }

                // 保存工作表
                worksheet.Save();
                workbookPart.Workbook.Save();
                spreadsheetDocument.WorkbookPart.Workbook.Save();

                // 保存到本地文件
                stream.Position = 0;
                var updatedBytes = stream.ToArray();
                await System.IO.File.WriteAllBytesAsync(filePath, updatedBytes);
                _loggingService.LogInformation($"成功保存 Excel 文件到: {filePath}");

                var totalRecords = rowsToAdd.Count + rowsToUpdate.Count;
                _loggingService.LogInformation($"本地 Excel 出站同步完成，數據集ID: {dataSet.Id}，新增: {rowsToAdd.Count}，更新: {rowsToUpdate.Count}，總計: {totalRecords}");
                
                return new SyncResult { Success = true, TotalRecords = totalRecords };
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"本地 Excel 出站同步失敗: {ex.Message}", ex);
                return new SyncResult { Success = false, ErrorMessage = $"本地 Excel 出站同步失敗: {ex.Message}" };
            }
        }

        /// <summary>
        /// 構建 Excel 行
        /// </summary>
        private DocumentFormat.OpenXml.Spreadsheet.Row BuildExcelRow(
            DataSetRecord record, 
            List<DataSetColumn> columns, 
            DocumentFormat.OpenXml.Packaging.WorkbookPart workbookPart,
            DocumentFormat.OpenXml.Packaging.SharedStringTablePart sharedStringTablePart,
            uint rowIndex)
        {
            var row = new DocumentFormat.OpenXml.Spreadsheet.Row { RowIndex = rowIndex };
            uint columnIndex = 1;

            foreach (var column in columns)
            {
                var value = record.Values?.FirstOrDefault(v => v.ColumnName == column.ColumnName);
                var cellValue = GetValueAsString(value, column.DataType) ?? string.Empty;
                
                var cell = new DocumentFormat.OpenXml.Spreadsheet.Cell
                {
                    CellReference = GetExcelColumnName(columnIndex) + rowIndex.ToString()
                };

                // 根據數據類型設置單元格類型和值
                switch (column.DataType?.ToLower())
                {
                    case "int":
                    case "integer":
                        if (int.TryParse(cellValue, out var intValue))
                        {
                            cell.DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.Number;
                            cell.CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(intValue.ToString());
                        }
                        else
                        {
                            cell.DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.String;
                            cell.CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(cellValue);
                        }
                        break;
                        
                    case "decimal":
                        if (decimal.TryParse(cellValue, out var decimalValue))
                        {
                            cell.DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.Number;
                            cell.CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(decimalValue.ToString());
                        }
                        else
                        {
                            cell.DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.String;
                            cell.CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(cellValue);
                        }
                        break;
                        
                    case "datetime":
                    case "date":
                        if (DateTime.TryParse(cellValue, out var dateValue))
                        {
                            // Excel 日期需要轉換為序列號
                            var excelDateNumber = (dateValue - new DateTime(1900, 1, 1)).TotalDays + 2; // +2 因為 Excel 的日期系統從 1900-01-01 開始，但認為 1900 是閏年
                            cell.DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.Number;
                            cell.CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(excelDateNumber.ToString());
                        }
                        else
                        {
                            cell.DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.String;
                            cell.CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(cellValue);
                        }
                        break;
                        
                    case "boolean":
                    case "bool":
                        if (bool.TryParse(cellValue, out var boolValue))
                        {
                            cell.DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.Boolean;
                            cell.CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(boolValue ? "1" : "0");
                        }
                        else
                        {
                            cell.DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.String;
                            cell.CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(cellValue);
                        }
                        break;
                        
                    default: // string, text
                        // 使用 SharedStringTable 來存儲字符串（優化文件大小）
                        var sharedStringIndex = GetOrAddSharedString(sharedStringTablePart, cellValue);
                        cell.DataType = DocumentFormat.OpenXml.Spreadsheet.CellValues.SharedString;
                        cell.CellValue = new DocumentFormat.OpenXml.Spreadsheet.CellValue(sharedStringIndex.ToString());
                        break;
                }
                
                row.AppendChild(cell);
                columnIndex++;
            }

            return row;
        }

        /// <summary>
        /// 獲取或添加共享字符串
        /// </summary>
        private int GetOrAddSharedString(DocumentFormat.OpenXml.Packaging.SharedStringTablePart sharedStringTablePart, string value)
        {
            if (sharedStringTablePart.SharedStringTable == null)
            {
                sharedStringTablePart.SharedStringTable = new DocumentFormat.OpenXml.Spreadsheet.SharedStringTable();
            }

            var sharedStringTable = sharedStringTablePart.SharedStringTable;
            var existingItem = sharedStringTable.Elements<DocumentFormat.OpenXml.Spreadsheet.SharedStringItem>()
                .Select((item, index) => new { item, index })
                .FirstOrDefault(x => x.item.Text?.Text == value);

            if (existingItem != null)
            {
                return existingItem.index;
            }

            var newItem = new DocumentFormat.OpenXml.Spreadsheet.SharedStringItem();
            newItem.Text = new DocumentFormat.OpenXml.Spreadsheet.Text(value);
            sharedStringTable.AppendChild(newItem);
            sharedStringTable.Count = (uint)sharedStringTable.ChildElements.Count;

            return sharedStringTable.ChildElements.Count - 1;
        }

        /// <summary>
        /// 獲取 Excel 列名（1 -> A, 2 -> B, 27 -> AA）
        /// </summary>
        private string GetExcelColumnName(uint columnNumber)
        {
            string columnName = string.Empty;
            uint temp = columnNumber;
            while (temp > 0)
            {
                uint remainder = (temp - 1) % 26;
                columnName = (char)(65 + remainder) + columnName;
                temp = (temp - 1) / 26;
            }
            return columnName;
        }

        /// <summary>
        /// 將內部 DataSet 數據同步到 Google Sheets（出站同步）
        /// </summary>
        private async Task<SyncResult> SyncToGoogleDocs(DataSet dataSet, DataSetDataSource dataSource)
        {
            try
            {
                _loggingService.LogInformation($"開始將數據同步到 Google Sheets，數據集ID: {dataSet.Id}");
                
                if (string.IsNullOrEmpty(dataSource.GoogleDocsUrl))
                {
                    _loggingService.LogWarning($"Google Docs URL 為空，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "Google Docs URL 不能為空" };
                }

                // 從 URL 中提取表格 ID
                var spreadsheetId = GoogleSheetsService.ExtractSpreadsheetId(dataSource.GoogleDocsUrl);
                if (string.IsNullOrEmpty(spreadsheetId))
                {
                    _loggingService.LogWarning($"無法從 URL 中提取表格 ID: {dataSource.GoogleDocsUrl}, 數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "無效的 Google Sheets URL" };
                }

                _loggingService.LogInformation($"提取的表格 ID: {spreadsheetId}, 數據集ID: {dataSet.Id}");

                // 檢測文件類型
                var fileType = await _googleSheetsService.DetectFileTypeAsync(dataSet.CompanyId, spreadsheetId);
                if (fileType == "excel")
                {
                    // 調用 Excel 同步方法
                    _loggingService.LogInformation($"檢測到 Excel 文件類型，使用 Excel 同步方法，數據集ID: {dataSet.Id}");
                    try
                    {
                        return await SyncToExcel(dataSet, dataSource);
                    }
                    catch (Exception excelEx)
                    {
                        // 如果 Excel 同步失敗（可能是因為 fileId 是 Google Sheets 的 ID），回退到使用 Google Sheets API
                        if (excelEx.Message.Contains("Google Sheets 的 ID") || 
                            excelEx.Message.Contains("File not found") || 
                            excelEx.Message.Contains("文件不存在於 Google Drive") ||
                            excelEx.Message.Contains("沒有權限訪問文件"))
                        {
                            _loggingService.LogWarning($"Excel 同步失敗，檢測到文件可能是 Google Sheets 或權限問題，回退到使用 Google Sheets API。錯誤: {excelEx.Message}");
                            _loggingService.LogInformation($"使用 Google Sheets API 來更新數據，數據集ID: {dataSet.Id}");
                            // 重新檢測文件類型，使用 Service Account
                            fileType = "googlesheets"; // 強制使用 Google Sheets API
                            // 繼續執行後續的 Google Sheets API 更新邏輯
                        }
                        else
                        {
                            throw; // 其他錯誤直接拋出
                        }
                    }
                }

                // 獲取工作表名稱：如果用戶沒有指定，自動獲取第一個工作表
                var sheetName = dataSource.GoogleDocsSheetName;
                if (string.IsNullOrWhiteSpace(sheetName))
                {
                    sheetName = await _googleSheetsService.GetFirstSheetNameAsync(dataSet.CompanyId, spreadsheetId);
                    _loggingService.LogInformation($"未指定工作表名稱，自動獲取第一個工作表: {sheetName}, 數據集ID: {dataSet.Id}");
                }
                else
                {
                    _loggingService.LogInformation($"使用指定的工作表名稱: {sheetName}, 數據集ID: {dataSet.Id}");
                }

                // 獲取欄位定義（按 sortOrder 排序）
                var columns = await _context.DataSetColumns
                    .Where(c => c.DataSetId == dataSet.Id)
                    .OrderBy(c => c.SortOrder)
                    .ThenBy(c => c.ColumnName)
                    .ToListAsync();

                if (!columns.Any())
                {
                    _loggingService.LogWarning($"數據集沒有欄位定義，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "數據集沒有欄位定義" };
                }

                // 獲取所有記錄
                var records = await _context.DataSetRecords
                    .Where(r => r.DataSetId == dataSet.Id && r.Status == "Active")
                    .Include(r => r.Values)
                    .OrderBy(r => r.CreatedAt)
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {records.Count} 條活躍記錄，數據集ID: {dataSet.Id}");

                if (!records.Any())
                {
                    _loggingService.LogInformation($"沒有活躍記錄需要同步，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = true, TotalRecords = 0 };
                }

                // 讀取 Google Sheets 現有數據以進行主鍵映射
                var existingSheetData = await _googleSheetsService.ReadSheetDataAsync(dataSet.CompanyId, spreadsheetId, sheetName);
                var primaryKeyColumns = columns.Where(c => c.IsPrimaryKey).ToList();
                
                // 構建主鍵值到行號的映射（行號從2開始，因為第1行是標題）
                var primaryKeyToRowMap = new Dictionary<string, int>();
                if (existingSheetData.Count > 1 && primaryKeyColumns.Any())
                {
                    // 假設第一行是標題行
                    var existingHeaderRow = existingSheetData[0];
                    var dataRows = existingSheetData.Skip(1).ToList();
                    
                    // 找到主鍵欄位在標題行中的位置
                    var primaryKeyIndices = new List<int>();
                    foreach (var pkColumn in primaryKeyColumns)
                    {
                        // 嘗試匹配標準化的欄位名稱
                        var normalizedPkName = ColumnNameNormalizer.Normalize(pkColumn.ColumnName);
                        for (int i = 0; i < existingHeaderRow.Count; i++)
                        {
                            var normalizedHeader = ColumnNameNormalizer.Normalize(existingHeaderRow[i]);
                            if (normalizedHeader == normalizedPkName || existingHeaderRow[i] == pkColumn.DisplayName || existingHeaderRow[i] == pkColumn.ColumnName)
                            {
                                primaryKeyIndices.Add(i);
                                break;
                            }
                        }
                    }
                    
                    // 構建主鍵值到行號的映射
                    for (int rowIndex = 0; rowIndex < dataRows.Count; rowIndex++)
                    {
                        var row = dataRows[rowIndex];
                        if (primaryKeyIndices.Any() && primaryKeyIndices.All(idx => idx < row.Count))
                        {
                            var keyParts = primaryKeyIndices.Select(idx => row[idx]?.ToString() ?? string.Empty).ToList();
                            var compositeKey = string.Join("|", keyParts);
                            if (!string.IsNullOrEmpty(compositeKey))
                            {
                                primaryKeyToRowMap[compositeKey] = rowIndex + 2; // +2 因為第1行是標題，行號從1開始
                            }
                        }
                    }
                    
                    _loggingService.LogInformation($"構建主鍵映射完成，找到 {primaryKeyToRowMap.Count} 個映射關係");
                }

                // 構建標題行
                var headerRow = new List<object>();
                foreach (var column in columns)
                {
                    headerRow.Add(column.DisplayName ?? column.ColumnName);
                }

                // 檢查是否需要更新標題行
                var needsHeaderUpdate = false;
                if (existingSheetData.Count == 0 || existingSheetData[0].Count != headerRow.Count)
                {
                    needsHeaderUpdate = true;
                }
                else
                {
                    var existingHeaders = existingSheetData[0];
                    for (int i = 0; i < Math.Min(headerRow.Count, existingHeaders.Count); i++)
                    {
                        if (headerRow[i].ToString() != existingHeaders[i])
                        {
                            needsHeaderUpdate = true;
                            break;
                        }
                    }
                }

                // 更新標題行（如果需要）
                if (needsHeaderUpdate)
                {
                    _loggingService.LogInformation($"更新 Google Sheets 標題行，數據集ID: {dataSet.Id}");
                    await _googleSheetsService.WriteSheetDataAsync(dataSet.CompanyId, spreadsheetId, sheetName, new List<List<object>> { headerRow }, 1);
                }

                // 構建數據行並進行增量同步
                var rowsToWrite = new List<List<object>>();
                var rowsToUpdate = new Dictionary<int, List<object>>(); // 行號 -> 數據行
                var processedRowNumbers = new HashSet<int>();

                foreach (var record in records)
                {
                    // 構建主鍵值
                    string primaryKeyValue = string.Empty;
                    if (primaryKeyColumns.Any())
                    {
                        var keyParts = new List<string>();
                        foreach (var pkColumn in primaryKeyColumns)
                        {
                            var value = record.Values?.FirstOrDefault(v => v.ColumnName == pkColumn.ColumnName);
                            var valueStr = GetValueAsString(value, pkColumn.DataType)?.Trim() ?? string.Empty;
                            keyParts.Add(valueStr);
                        }
                        primaryKeyValue = string.Join("|", keyParts);
                    }
                    else
                    {
                        primaryKeyValue = record.PrimaryKeyValue ?? string.Empty;
                    }

                    // 構建數據行
                    var dataRow = new List<object>();
                    foreach (var column in columns)
                    {
                        var value = record.Values?.FirstOrDefault(v => v.ColumnName == column.ColumnName);
                        var valueStr = GetValueAsString(value, column.DataType) ?? string.Empty;
                        dataRow.Add(valueStr);
                    }

                    // 檢查是否需要更新現有行或添加新行
                    if (!string.IsNullOrEmpty(primaryKeyValue) && primaryKeyToRowMap.ContainsKey(primaryKeyValue))
                    {
                        // 更新現有行
                        var rowNumber = primaryKeyToRowMap[primaryKeyValue];
                        rowsToUpdate[rowNumber] = dataRow;
                        processedRowNumbers.Add(rowNumber);
                        _loggingService.LogDebug($"準備更新行 {rowNumber}，主鍵: {primaryKeyValue}");
                    }
                    else
                    {
                        // 添加新行
                        rowsToWrite.Add(dataRow);
                        _loggingService.LogDebug($"準備添加新行，主鍵: {primaryKeyValue}");
                    }
                }

                // 批量寫入新行
                if (rowsToWrite.Any())
                {
                    _loggingService.LogInformation($"開始寫入 {rowsToWrite.Count} 行新數據到 Google Sheets");
                    var startRow = existingSheetData.Count > 0 ? existingSheetData.Count + 1 : 2; // 如果沒有數據，從第2行開始（第1行是標題）
                    await _googleSheetsService.WriteSheetDataAsync(dataSet.CompanyId, spreadsheetId, sheetName, rowsToWrite, startRow);
                    _loggingService.LogInformation($"成功寫入 {rowsToWrite.Count} 行新數據");
                }

                // 批量更新現有行
                if (rowsToUpdate.Any())
                {
                    _loggingService.LogInformation($"開始更新 {rowsToUpdate.Count} 行數據到 Google Sheets");
                    
                    // 將行更新轉換為 UpdateSheetDataAsync 需要的格式
                    var updates = new Dictionary<int, Dictionary<int, object>>();
                    foreach (var kvp in rowsToUpdate)
                    {
                        var rowNumber = kvp.Key;
                        var rowData = kvp.Value;
                        var columnUpdates = new Dictionary<int, object>();
                        
                        for (int colIndex = 0; colIndex < rowData.Count; colIndex++)
                        {
                            columnUpdates[colIndex + 1] = rowData[colIndex]; // 列號從1開始
                        }
                        
                        updates[rowNumber] = columnUpdates;
                    }
                    
                    await _googleSheetsService.UpdateSheetDataAsync(dataSet.CompanyId, spreadsheetId, sheetName, updates);
                    _loggingService.LogInformation($"成功更新 {rowsToUpdate.Count} 行數據");
                }

                var totalRecords = rowsToWrite.Count + rowsToUpdate.Count;
                _loggingService.LogInformation($"Google Sheets 出站同步完成，數據集ID: {dataSet.Id}，新增: {rowsToWrite.Count}，更新: {rowsToUpdate.Count}，總計: {totalRecords}");
                
                return new SyncResult { Success = true, TotalRecords = totalRecords };
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Google Sheets 出站同步失敗: {ex.Message}", ex);
                return new SyncResult { Success = false, ErrorMessage = $"Google Sheets 出站同步失敗: {ex.Message}" };
            }
        }

        private async Task EnsureGoogleSheetsColumnsExist(DataSet dataSet, List<string> headers)
        {
            try
            {
                _loggingService.LogInformation($"檢查 Google Sheets 欄位定義，數據集ID: {dataSet.Id}");

                var existingColumns = await _context.DataSetColumns
                    .Where(c => c.DataSetId == dataSet.Id)
                    .ToListAsync();

                var existingColumnNames = existingColumns.Select(c => c.ColumnName).ToHashSet();
                var newColumns = new List<DataSetColumn>();

                // 不再自動創建 row_number 欄位，讓系統使用 Hash 進行比較

                foreach (var header in headers)
                {
                    if (string.IsNullOrWhiteSpace(header))
                        continue;

                    // 使用統一的欄位名稱標準化函數
                    var normalizedColumnName = ColumnNameNormalizer.Normalize(header);
                    
                    // 檢查是否已存在（使用標準化的名稱）
                    if (existingColumnNames.Contains(normalizedColumnName))
                    {
                        _loggingService.LogInformation($"欄位 {normalizedColumnName} 已存在，跳過");
                        continue;
                    }

                    var column = new DataSetColumn
                    {
                        Id = Guid.NewGuid(),
                        DataSetId = dataSet.Id,
                        ColumnName = normalizedColumnName,  // 使用標準化的名稱
                        DisplayName = header.Trim(),        // 顯示名稱使用原始標題
                        DataType = InferDataType(header),
                        MaxLength = InferDataType(header) == "string" ? 255 : (int?)null,
                        IsRequired = false,
                        IsPrimaryKey = IsPrimaryKeyColumn(header),
                        IsSearchable = true,
                        IsSortable = true,
                        IsIndexed = false,
                        DefaultValue = null,
                        SortOrder = existingColumns.Count + newColumns.Count
                    };

                    newColumns.Add(column);
                    existingColumnNames.Add(normalizedColumnName); // 添加到檢查集合中
                }

                if (newColumns.Any())
                {
                    _context.DataSetColumns.AddRange(newColumns);
                await _context.SaveChangesAsync();
                    _loggingService.LogInformation($"Google Sheets 欄位定義更新完成，新增 {newColumns.Count} 個欄位，數據集ID: {dataSet.Id}");
                }
                else
                {
                    _loggingService.LogInformation($"沒有需要新增的欄位，數據集ID: {dataSet.Id}");
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新 Google Sheets 欄位定義失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 預覽 Google Sheets 欄位定義
        /// </summary>
        [HttpGet("google-sheets/preview")]
        public async Task<IActionResult> PreviewGoogleSheetsColumns([FromQuery] string url, [FromQuery] string? sheetName = null)
        {
            try
            {
                _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 開始預覽 Google Sheets 欄位定義，URL: {url}, 工作表: {sheetName ?? "null"}");

                var companyId = GetCurrentCompanyId();
                _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 當前公司ID: {companyId}");
                
                if (companyId == Guid.Empty)
                {
                    _loggingService.LogWarning("[PreviewGoogleSheetsColumns] 無法識別公司資訊，CompanyId 為空");
                    return Unauthorized(new { success = false, message = "無法識別公司資訊" });
                }

                if (string.IsNullOrEmpty(url))
                {
                    _loggingService.LogWarning("[PreviewGoogleSheetsColumns] URL 為空");
                    return BadRequest(new { success = false, message = "請提供 Google Sheets URL" });
                }

                // 從 URL 中提取表格 ID
                _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 開始從 URL 提取表格 ID，URL: {url}");
                var spreadsheetId = GoogleSheetsService.ExtractSpreadsheetId(url);
                if (string.IsNullOrEmpty(spreadsheetId))
                {
                    _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] 無法從 URL 中提取表格 ID: {url}");
                    return BadRequest(new { success = false, message = "無效的 Google Sheets URL" });
                }

                _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 成功提取表格 ID: {spreadsheetId}");

                // 檢測文件類型
                _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 開始檢測文件類型，表格ID: {spreadsheetId}");
                var fileType = await _googleSheetsService.DetectFileTypeAsync(companyId, spreadsheetId);
                _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 檢測到文件類型: {fileType}");

                List<string> headers;

                if (fileType == "excel")
                {
                    // 處理 Excel 文件（上傳到 Google Drive 的 Excel 文件）
                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 開始處理 Excel 文件，表格ID: {spreadsheetId}");

                    var apiProviderService = _serviceProvider.GetRequiredService<Services.ApiProviders.IApiProviderService>();
                    var runtime = await apiProviderService.GetRuntimeProviderAsync(companyId, "google-docs");
                    if (runtime == null || string.IsNullOrWhiteSpace(runtime.ApiKey))
                    {
                        _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] 無法獲取 API Key，無法下載 Excel 文件");
                        return BadRequest(new { success = false, message = "無法獲取 Google API 配置，請檢查 API Provider 設定" });
                    }

                    // 從 Google Drive 下載 Excel 文件
                    var downloadUrl = $"https://drive.google.com/uc?id={spreadsheetId}&export=download";
                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 開始從 Google Drive 下載 Excel 文件，URL: {downloadUrl}");

                    using var httpClient = new System.Net.Http.HttpClient();
                    httpClient.Timeout = TimeSpan.FromSeconds(60);
                    
                    var response = await httpClient.GetAsync(downloadUrl);
                    if (!response.IsSuccessStatusCode)
                    {
                        _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] Google Drive 下載失敗，狀態碼: {response.StatusCode}");
                        return BadRequest(new { success = false, message = "無法從 Google Drive 下載 Excel 文件，請確保文件是公開的或有適當的權限" });
                    }

                    var fileBytes = await response.Content.ReadAsByteArrayAsync();
                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] Excel 文件下載成功，大小: {fileBytes.Length} bytes");

                    // 解析 Excel 文件
                    var targetSheetName = sheetName ?? "Sheet1";
                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 開始解析 Excel 文件，工作表: {targetSheetName}");

                    using var stream = new System.IO.MemoryStream(fileBytes);
                    using var spreadsheetDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, false);
                    
                    var workbookPart = spreadsheetDocument.WorkbookPart;
                    if (workbookPart == null)
                    {
                        _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] 無法讀取 Excel 工作簿");
                        return BadRequest(new { success = false, message = "無法讀取 Excel 工作簿" });
                    }

                    // 查找指定的工作表
                    DocumentFormat.OpenXml.Packaging.WorksheetPart worksheetPart = null;
                    if (!string.IsNullOrEmpty(targetSheetName) && workbookPart.Workbook?.Sheets != null)
                    {
                        var sheet = workbookPart.Workbook.Sheets.Elements<DocumentFormat.OpenXml.Spreadsheet.Sheet>()
                            .FirstOrDefault(s => s.Name == targetSheetName);
                        
                        if (sheet != null)
                        {
                            worksheetPart = (DocumentFormat.OpenXml.Packaging.WorksheetPart)workbookPart.GetPartById(sheet.Id);
                        }
                    }
                    
                    if (worksheetPart == null)
                    {
                        worksheetPart = workbookPart.WorksheetParts.FirstOrDefault();
                    }

                    if (worksheetPart == null)
                    {
                        _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] 無法找到工作表: {targetSheetName}");
                        return BadRequest(new { success = false, message = $"無法找到工作表: {targetSheetName}" });
                    }

                    var worksheet = worksheetPart.Worksheet;
                    var sheetData = worksheet.GetFirstChild<DocumentFormat.OpenXml.Spreadsheet.SheetData>();
                    
                    if (sheetData == null)
                    {
                        _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] Excel 工作表為空");
                        return BadRequest(new { success = false, message = "Excel 工作表為空或無數據" });
                    }

                    var rows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
                    if (rows.Count == 0)
                    {
                        _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] Excel 工作表沒有數據行");
                        return BadRequest(new { success = false, message = "Excel 工作表沒有數據" });
                    }

                    // 讀取標題行（第一行）
                    headers = new List<string>();
                    var headerRow = rows.FirstOrDefault();
                    if (headerRow != null)
                    {
                        var sharedStringTable = workbookPart.SharedStringTablePart;
                        var cells = headerRow.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                        foreach (var cell in cells)
                        {
                            var cellValue = GetCellValue(cell, sharedStringTable);
                            headers.Add(cellValue ?? string.Empty);
                        }
                    }

                    if (!headers.Any(h => !string.IsNullOrWhiteSpace(h)))
                    {
                        _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] Excel 沒有找到有效的標題行");
                        return BadRequest(new { success = false, message = "Excel 沒有找到有效的標題行" });
                    }

                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] Excel 標題行: {string.Join(", ", headers)}");
                }
                else
                {
                    // 處理原生 Google Sheets
                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 開始處理原生 Google Sheets，表格ID: {spreadsheetId}");

                    // 測試連接
                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 開始測試 Google Sheets 連接，公司ID: {companyId}, 表格ID: {spreadsheetId}");
                    var connectionTest = await _googleSheetsService.TestConnectionAsync(companyId, spreadsheetId);
                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 連接測試結果: {connectionTest}");
                    
                    if (!connectionTest)
                    {
                        _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] 無法連接到 Google Sheets，表格ID: {spreadsheetId}，公司ID: {companyId}。請檢查後端日誌以獲取詳細錯誤信息");
                        return BadRequest(new { success = false, message = "無法連接到 Google Sheets，請檢查 URL 是否正確且表格為公開訪問。請查看後端日誌以獲取詳細錯誤信息" });
                    }

                    // 獲取工作表名稱
                    var targetSheetName = sheetName ?? "Sheet1";
                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 使用工作表名稱: {targetSheetName}");

                    // 讀取數據
                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 開始讀取 Google Sheets 數據，表格ID: {spreadsheetId}, 工作表: {targetSheetName}");
                    var sheetData = await _googleSheetsService.ReadSheetDataAsync(companyId, spreadsheetId, targetSheetName);
                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 數據讀取完成，共 {sheetData?.Count ?? 0} 行");
                    
                    if (!sheetData.Any())
                    {
                        _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] Google Sheets 沒有數據，表格ID: {spreadsheetId}, 工作表: {targetSheetName}");
                        return BadRequest(new { success = false, message = "Google Sheets 沒有數據" });
                    }

                    // 尋找標題行（跳過空行）
                    headers = new List<string>();
                    var headerRowIndex = -1;
                    
                    for (int i = 0; i < sheetData.Count; i++)
                    {
                        var row = sheetData[i];
                        if (row.Any(cell => !string.IsNullOrWhiteSpace(cell)))
                        {
                            headers = row.ToList();
                            headerRowIndex = i;
                            break;
                        }
                    }
                    
                    if (!headers.Any(h => !string.IsNullOrWhiteSpace(h)))
                    {
                        _loggingService.LogWarning($"[PreviewGoogleSheetsColumns] Google Sheets 沒有找到有效的標題行，表格ID: {spreadsheetId}");
                        return BadRequest(new { success = false, message = "Google Sheets 沒有找到有效的標題行" });
                    }

                    _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] Google Sheets 標題行（第 {headerRowIndex + 1} 行）: {string.Join(", ", headers)}");
                }

                // 生成欄位定義
                var columns = new List<object>();
                for (int i = 0; i < headers.Count; i++)
                {
                    var header = headers[i];
                    if (string.IsNullOrWhiteSpace(header))
                        continue;

                    columns.Add(new
                    {
                        columnName = ColumnNameNormalizer.Normalize(header),
                        displayName = header.Trim(),
                        dataType = InferDataType(header),
                        maxLength = InferDataType(header) == "string" ? 255 : (int?)null,
                        isRequired = false,
                        isPrimaryKey = IsPrimaryKeyColumn(header),
                        isSearchable = true,
                        isSortable = true,
                        isIndexed = false,
                        defaultValue = (string?)null,
                        sortOrder = i
                    });
                }

                _loggingService.LogInformation($"[PreviewGoogleSheetsColumns] 成功預覽 Google Sheets 欄位定義，共 {columns.Count} 個欄位");

                return Ok(new
                {
                    success = true,
                    columns = columns
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"[PreviewGoogleSheetsColumns] 預覽 Google Sheets 欄位定義失敗，錯誤類型: {ex.GetType().Name}，錯誤訊息: {ex.Message}，內部異常: {ex.InnerException?.Message ?? "null"}，堆棧追蹤: {ex.StackTrace}", ex);
                return StatusCode(500, new { success = false, message = "預覽欄位定義失敗: " + ex.Message });
            }
        }


        private async Task<bool> ProcessGoogleSheetsRow(DataSet dataSet, List<string> row, List<string> headers)
        {
            try
            {
                // 確保行數據與標題數量匹配
                while (row.Count < headers.Count)
                {
                    row.Add(string.Empty);
                }

                // 檢查是否為空行
                if (row.All(cell => string.IsNullOrWhiteSpace(cell)))
                {
                    _loggingService.LogInformation($"跳過空行，數據集ID: {dataSet.Id}");
                    return false;
                }

                _loggingService.LogInformation($"處理行數據: {string.Join(" | ", row)}, 數據集ID: {dataSet.Id}");

                // 創建記錄
                var record = new DataSetRecord
                {
                    Id = Guid.NewGuid(),
                    DataSetId = dataSet.Id,
                    Status = "Active"
                };

                _context.DataSetRecords.Add(record);

                // 創建記錄值
                for (int i = 0; i < headers.Count && i < row.Count; i++)
                {
                    var header = headers[i];
                    var value = row[i] ?? string.Empty;

                    if (string.IsNullOrWhiteSpace(header))
                        continue;

                    // 使用統一的欄位名稱標準化函數
                    var normalizedColumnName = ColumnNameNormalizer.Normalize(header);

                    var column = await _context.DataSetColumns
                        .FirstOrDefaultAsync(c => c.DataSetId == dataSet.Id && c.ColumnName == normalizedColumnName);

                    if (column == null)
                    {
                        _loggingService.LogWarning($"找不到欄位定義，DataSet ID: {dataSet.Id}, 原始標題: {header}, 標準化名稱: {normalizedColumnName}");
                        continue;
                    }

                    var recordValue = new DataSetRecordValue
                    {
                        Id = Guid.NewGuid(),
                        RecordId = record.Id,
                        ColumnName = column.ColumnName,
                        StringValue = column.DataType == "string" ? value : null,
                        NumericValue = column.DataType == "decimal" || column.DataType == "int" ? 
                            (decimal.TryParse(value, out var num) ? num : null) : null,
                        DateValue = column.DataType == "datetime" ? 
                            (DateTime.TryParse(value, out var date) ? date : null) : null,
                        BooleanValue = column.DataType == "boolean" ? 
                            (bool.TryParse(value, out var boolVal) ? boolVal : 
                             value.ToLower() == "yes" || value.ToLower() == "true" || value == "1") : null
                    };

                    _context.DataSetRecordValues.Add(recordValue);
                    _loggingService.LogInformation($"創建記錄值: 欄位={column.ColumnName}, 值={value}, 類型={column.DataType}, 記錄ID={record.Id}");
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理 Google Sheets 行數據失敗: {ex.Message}", ex);
                return false;
            }
        }

        private bool IsPrimaryKeyColumn(string columnName)
        {
            if (string.IsNullOrEmpty(columnName))
                return false;

            var lowerName = columnName.ToLower();

            // 常見主鍵欄位名稱
            var primaryKeyPatterns = new[]
            {
                "id", "within_code", "pk_", "_id", "key", "code", "no", "number", "ref", "seq"
            };

            return primaryKeyPatterns.Any(pattern => lowerName.Contains(pattern));
        }

        private string InferDataType(string value)
        {
            if (decimal.TryParse(value, out _))
                return "decimal";
            if (DateTime.TryParse(value, out _))
                return "datetime";
            if (bool.TryParse(value, out _) || value.ToLower() == "yes" || value.ToLower() == "no")
                return "boolean";
            return "string";
        }

        // 新增：根據標題推斷數據類型（更精確的邏輯）
        private string InferDataTypeFromHeader(string header)
        {
            var lowerHeader = header.ToLower();
            
            // 檢查日期時間類型（更精確的匹配）
            if (lowerHeader.Contains("date") || lowerHeader.Contains("日期") || 
                lowerHeader.Contains("time") || lowerHeader.Contains("時間") ||
                lowerHeader.Contains("created") || lowerHeader.Contains("建立") ||
                lowerHeader.Contains("updated") || lowerHeader.Contains("更新") ||
                lowerHeader.Contains("modified") || lowerHeader.Contains("修改") ||
                lowerHeader.Contains("scheduled") || lowerHeader.Contains("已排程"))
            {
                // 排除包含其他關鍵字的欄位
                if (!lowerHeader.Contains("unit") && !lowerHeader.Contains("數量") && 
                    !lowerHeader.Contains("count") && !lowerHeader.Contains("計數"))
                {
                    return "datetime";
                }
            }
            
            // 檢查數值類型
            if (lowerHeader.Contains("amount") || lowerHeader.Contains("金額") || 
                lowerHeader.Contains("price") || lowerHeader.Contains("價格") ||
                lowerHeader.Contains("cost") || lowerHeader.Contains("成本") ||
                lowerHeader.Contains("revenue") || lowerHeader.Contains("收入") ||
                lowerHeader.Contains("profit") || lowerHeader.Contains("利潤") ||
                lowerHeader.Contains("discount") || lowerHeader.Contains("折扣") ||
                lowerHeader.Contains("rate") || lowerHeader.Contains("比率") ||
                lowerHeader.Contains("percentage") || lowerHeader.Contains("百分比"))
                return "decimal";
            
            // 檢查數量類型
            if (lowerHeader.Contains("quantity") || lowerHeader.Contains("數量") ||
                lowerHeader.Contains("count") || lowerHeader.Contains("計數") ||
                lowerHeader.Contains("number") || lowerHeader.Contains("數字") ||
                lowerHeader.Contains("total") || lowerHeader.Contains("總計") ||
                lowerHeader.Contains("sum") || lowerHeader.Contains("總和"))
                return "decimal";
            
            // 檢查整數類型
            if (lowerHeader.Contains("id") || lowerHeader.Contains("編號") ||
                lowerHeader.Contains("no") || lowerHeader.Contains("號碼") ||
                lowerHeader.Contains("code") || lowerHeader.Contains("代碼") ||
                lowerHeader.Contains("serial") || lowerHeader.Contains("序號") ||
                lowerHeader.Contains("version") || lowerHeader.Contains("版本"))
                return "int";
            
            // 檢查布林類型
            if (lowerHeader.Contains("status") || lowerHeader.Contains("狀態") ||
                lowerHeader.Contains("active") || lowerHeader.Contains("啟用") ||
                lowerHeader.Contains("enabled") || lowerHeader.Contains("啟用") ||
                lowerHeader.Contains("is") || lowerHeader.Contains("是否") ||
                lowerHeader.Contains("has") || lowerHeader.Contains("擁有") ||
                lowerHeader.Contains("flag") || lowerHeader.Contains("標記") ||
                lowerHeader.Contains("check") || lowerHeader.Contains("檢查"))
                return "boolean";
            
            return "string"; // 默認
        }

        // 獲取預設連接字符串
        private string GetPresetConnectionString(string connectionName)
        {
            IConfiguration configuration;
            
            // 嘗試從 HttpContext 獲取配置，如果失敗則從 ServiceProvider 獲取
            try
            {
                configuration = HttpContext?.RequestServices?.GetRequiredService<IConfiguration>();
                if (configuration == null)
                {
                    configuration = _serviceProvider.GetRequiredService<IConfiguration>();
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogWarning($"無法從 HttpContext 獲取配置，嘗試從 ServiceProvider 獲取: {ex.Message}");
                configuration = _serviceProvider.GetRequiredService<IConfiguration>();
            }
            
            _loggingService.LogInformation($"嘗試獲取預設連接字符串，連接名稱: '{connectionName}'");
            
            switch (connectionName?.ToLower())
            {
                case "erp_awh":
                    var erpConnection = configuration.GetConnectionString("ErpDatabase");
                    _loggingService.LogInformation($"ERP 連接字符串: {erpConnection}");
                    return erpConnection;
                case "purple_rice":
                    var purpleRiceConnection = configuration.GetConnectionString("PurpleRice");
                    _loggingService.LogInformation($"PurpleRice 連接字符串: {purpleRiceConnection}");
                    return purpleRiceConnection;
                default:
                    _loggingService.LogWarning($"未知的預設連接名稱: '{connectionName}'");
                    _loggingService.LogWarning($"可用的連接名稱: 'erp_awh', 'purple_rice'");
                    return null;
            }
        }

        // 構建自定義連接字符串
        private string BuildCustomConnectionString(SqlConnectionConfig config)
        {
            var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder
            {
                DataSource = $"{config.ServerName}{(config.GetPortNumber().HasValue ? $",{config.GetPortNumber()}" : "")}",
                InitialCatalog = config.DatabaseName
            };
            
            if (config.AuthenticationType == "sql")
            {
                builder.UserID = config.Username;
                builder.Password = config.Password;
            }
            else
            {
                builder.IntegratedSecurity = true;
            }
            
            // 自動添加 SSL 信任設置，解決憑證驗證問題
            builder.TrustServerCertificate = true;
            builder.Encrypt = false;
            
            if (!string.IsNullOrEmpty(config.AdditionalOptions))
            {
                // 解析額外選項
                var options = config.AdditionalOptions.Split(';', StringSplitOptions.RemoveEmptyEntries);
                foreach (var option in options)
                {
                    var parts = option.Split('=', 2);
                    if (parts.Length == 2)
                    {
                        var key = parts[0].Trim();
                        var value = parts[1].Trim();
                        
                        // 允許用戶覆蓋 SSL 設置
                        if (key.Equals("TrustServerCertificate", StringComparison.OrdinalIgnoreCase) ||
                            key.Equals("Encrypt", StringComparison.OrdinalIgnoreCase))
                        {
                            builder[key] = value;
                        }
                        else
                        {
                            builder[key] = value;
                        }
                    }
                }
            }
            
            return builder.ConnectionString;
        }

        // 獲取 SQL 連接字符串（用於出站同步，重用 SyncFromSql 的邏輯）
        private string GetSqlConnectionStringForSync(DataSetDataSource dataSource)
        {
            string connectionString;
            
            // 解析連接配置（重用 SyncFromSql 的邏輯）
            if (!string.IsNullOrEmpty(dataSource.AuthenticationConfig))
            {
                try
                {
                    _loggingService.LogInformation($"開始解析認證配置 JSON: {dataSource.AuthenticationConfig}");
                    var config = JsonSerializer.Deserialize<SqlConnectionConfig>(dataSource.AuthenticationConfig);
                    
                    if (config?.ConnectionType == "preset")
                    {
                        connectionString = GetPresetConnectionString(config.PresetName);
                        _loggingService.LogInformation($"使用預設連接: {config.PresetName}");
                    }
                    else if (config?.ConnectionType == "custom")
                    {
                        connectionString = BuildCustomConnectionString(config);
                        _loggingService.LogInformation($"使用自定義連接");
                    }
                    else
                    {
                        // 嘗試從其他字段推斷連接類型
                        if (!string.IsNullOrEmpty(config?.ServerName) && !string.IsNullOrEmpty(config?.DatabaseName))
                        {
                            connectionString = BuildCustomConnectionString(config);
                            _loggingService.LogInformation($"使用推斷的自定義連接");
                        }
                        else if (!string.IsNullOrEmpty(config?.PresetName))
                        {
                            connectionString = GetPresetConnectionString(config.PresetName);
                            _loggingService.LogInformation($"使用推斷的預設連接: {config.PresetName}");
                        }
                        else
                        {
                            _loggingService.LogError($"無法推斷連接類型，ConnectionType: '{config?.ConnectionType}'");
                            return null;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"解析連接配置失敗: {ex.Message}");
                    return null;
                }
            }
            else
            {
                // 向後兼容：使用舊的 databaseConnection 欄位
                _loggingService.LogInformation($"沒有 AuthenticationConfig，使用舊格式 databaseConnection: {dataSource.DatabaseConnection}");
                connectionString = GetPresetConnectionString(dataSource.DatabaseConnection);
                _loggingService.LogInformation($"使用舊格式預設連接: {dataSource.DatabaseConnection}");
            }
            
            if (string.IsNullOrEmpty(connectionString))
            {
                _loggingService.LogError($"無法獲取數據庫連接字符串");
                return null;
            }
            
            _loggingService.LogInformation($"最終使用的連接字符串: {connectionString}");
            return connectionString;
        }

        // 執行 SQL 查詢
        private async Task<(bool Success, List<Dictionary<string, object>> Data, string ErrorMessage)> ExecuteSqlQuery(string connectionString, string sqlQuery, string sqlParameters)
        {
            try
            {
                using var connection = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
                await connection.OpenAsync();
                
                using var command = new Microsoft.Data.SqlClient.SqlCommand(sqlQuery, connection);
                
                // 處理 SQL 參數
                if (!string.IsNullOrEmpty(sqlParameters))
                {
                    try
                    {
                        var parameters = JsonSerializer.Deserialize<Dictionary<string, object>>(sqlParameters);
                        foreach (var param in parameters)
                        {
                            command.Parameters.AddWithValue(param.Key, param.Value ?? DBNull.Value);
                        }
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogWarning($"SQL 參數解析失敗: {ex.Message}");
                    }
                }
                
                var results = new List<Dictionary<string, object>>();
                
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var row = new Dictionary<string, object>();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        var originalColumnName = reader.GetName(i);
                        var normalizedColumnName = ColumnNameNormalizer.Normalize(originalColumnName);
                        var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        row[normalizedColumnName] = value;
                    }
                    results.Add(row);
                }
                
                _loggingService.LogInformation($"SQL 查詢執行成功，返回 {results.Count} 行數據");
                
                // 調試：顯示第一行的欄位名稱
                if (results.Any())
                {
                    var firstRow = results.First();
                    _loggingService.LogInformation($"第一行欄位名稱: {string.Join(", ", firstRow.Keys)}");
                    
                    // 檢查特定記錄的數據
                    var targetRecord = results.FirstOrDefault(r => 
                        r.ContainsKey("id") && 
                        r["id"]?.ToString()?.ToUpper() == "434E218F-81FF-4D41-BF5E-2EE4B22C4DCE".ToUpper());
                    
                    if (targetRecord != null)
                    {
                        _loggingService.LogInformation($"找到目標記錄，occupation 值: {targetRecord.GetValueOrDefault("occupation", "NULL")}");
                    }
                    else
                    {
                        _loggingService.LogWarning($"未找到目標記錄 434E218F-81FF-4D41-BF5E-2EE4B22C4DCE");
                        
                        // 顯示前幾個記錄的 ID 和 occupation
                        _loggingService.LogInformation("前幾個記錄的 ID 和 occupation:");
                        foreach (var record in results.Take(3))
                        {
                            var id = record.GetValueOrDefault("id", "NULL");
                            var occupation = record.GetValueOrDefault("occupation", "NULL");
                            _loggingService.LogInformation($"  - ID: {id}, Occupation: {occupation}");
                        }
                    }
                }
                
                return (true, results, null);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"SQL 查詢執行失敗: {ex.Message}", ex);
                return (false, null, ex.Message);
            }
        }

        /// <summary>
        /// 通用的增量同步方法 - 使用 Hash 比較檢測新增、更新、刪除
        /// </summary>
        /// <param name="skipDeletes">如果為 true，跳過刪除操作（用於雙向同步的入站階段）</param>
        private async Task<int> ProcessIncrementalSync(DataSet dataSet, List<Dictionary<string, object>> sourceData, string sourceType, bool skipDeletes = false)
        {
            try
            {
                _loggingService.LogInformation($"開始處理 {sourceType} 查詢結果，數據集ID: {dataSet.Id}，結果行數: {sourceData.Count}");
                
                // 重新獲取 DataSet 對象，確保被 Entity Framework 正確追蹤
                var trackedDataSet = await _context.DataSets.FindAsync(dataSet.Id);
                if (trackedDataSet == null)
                {
                    _loggingService.LogError($"找不到數據集，ID: {dataSet.Id}");
                    return 0;
                }
                
                // 設置總記錄數
                trackedDataSet.TotalRecordsToSync = sourceData.Count;
                await _context.SaveChangesAsync();
                
                // 獲取欄位定義
                var columns = await _context.DataSetColumns
                    .Where(c => c.DataSetId == trackedDataSet.Id)
                    .ToListAsync();
                
                if (!columns.Any())
                {
                    _loggingService.LogWarning($"數據集沒有欄位定義，數據集ID: {trackedDataSet.Id}");
                    return 0;
                }

                // 找到主鍵欄位（支援複合主鍵）
                var primaryKeyColumns = columns.Where(c => c.IsPrimaryKey).ToList();
                
                if (primaryKeyColumns.Any())
                {
                    _loggingService.LogInformation($"找到 {primaryKeyColumns.Count} 個主鍵欄位: {string.Join(", ", primaryKeyColumns.Select(c => c.ColumnName))}");
                    _loggingService.LogInformation($"嚴格按照設置的主鍵欄位來構建主鍵，不進行自動簡化");
                }
                else
                {
                    _loggingService.LogWarning($"數據集沒有主鍵欄位定義，將使用整個記錄的 Hash 進行比較");
                }

                var stats = new SyncStats();

                // 1. 獲取現有記錄的 Hash 映射
                _loggingService.LogInformation("開始獲取現有記錄...");
                var existingRecordsHash = await GetExistingRecordsHash(trackedDataSet.Id, columns, primaryKeyColumns);
                _loggingService.LogInformation($"獲取到 {existingRecordsHash.Count} 條現有記錄");
                
                // 調試：顯示前幾個現有記錄的主鍵和 Hash
                var existingKeys = existingRecordsHash.Keys.Take(3).ToList();
                foreach (var key in existingKeys)
                {
                    var (record, hash) = existingRecordsHash[key];
                    _loggingService.LogInformation($"現有記錄主鍵: {key}, Hash: {hash.Substring(0, Math.Min(16, hash.Length))}...");
                }

                // 2. 計算新記錄的 Hash
                _loggingService.LogInformation("開始計算新記錄 Hash...");
                var newRecordsHash = CalculateNewRecordsHash(sourceData, columns, primaryKeyColumns);
                _loggingService.LogInformation($"計算完成 {newRecordsHash.Count} 條新記錄 Hash");
                
                // 調試：顯示前幾個新記錄的主鍵和 Hash
                var newKeys = newRecordsHash.Keys.Take(3).ToList();
                foreach (var key in newKeys)
                {
                    var (row, hash) = newRecordsHash[key];
                    _loggingService.LogInformation($"新記錄主鍵: {key}, Hash: {hash.Substring(0, Math.Min(16, hash.Length))}...");
                }

                // 3. 分類處理：新增、更新、刪除
                var (newRecords, updateRecords, deleteRecords) = ClassifyRecords(
                    existingRecordsHash, 
                    newRecordsHash, 
                    sourceData, 
                    primaryKeyColumns,
                    skipDeletes
                );

                if (skipDeletes && deleteRecords.Any())
                {
                    _loggingService.LogInformation($"雙向同步入站階段：跳過刪除 {deleteRecords.Count} 條記錄（這些記錄將在下次出站同步時寫入外部數據源）");
                }
                
                _loggingService.LogInformation($"記錄分類完成 - 新增: {newRecords.Count}, 更新: {updateRecords.Count}, 刪除: {deleteRecords.Count}");
                
                // 調試：顯示前幾個需要更新的記錄
                if (updateRecords.Count > 0)
                {
                    _loggingService.LogInformation($"前3個需要更新的記錄:");
                    for (int i = 0; i < Math.Min(3, updateRecords.Count); i++)
                    {
                        var (record, row) = updateRecords[i];
                        var recordId = record.PrimaryKeyValue ?? "Unknown";
                        var existingHash = existingRecordsHash.ContainsKey(recordId) ? existingRecordsHash[recordId].Hash.Substring(0, Math.Min(16, existingRecordsHash[recordId].Hash.Length)) : "N/A";
                        var newHash = newRecordsHash.ContainsKey(recordId) ? newRecordsHash[recordId].Hash.Substring(0, Math.Min(16, newRecordsHash[recordId].Hash.Length)) : "N/A";
                        _loggingService.LogInformation($"更新記錄 {i+1}: ID={recordId}, 現有Hash={existingHash}..., 新Hash={newHash}...");
                    }
                }

                // 4. 批量處理各類記錄
                if (newRecords.Any())
                {
                    stats.NewRecords = await BatchInsertRecords(trackedDataSet, newRecords, columns);
                    trackedDataSet.RecordsInserted = stats.NewRecords;
                    await _context.SaveChangesAsync();
                }

                if (updateRecords.Any())
                {
                    stats.UpdatedRecords = await BatchUpdateRecords(updateRecords, columns);
                    trackedDataSet.RecordsUpdated = stats.UpdatedRecords;
                    await _context.SaveChangesAsync();
                }

                if (deleteRecords.Any())
                {
                    stats.DeletedRecords = await BatchDeleteRecords(deleteRecords);
                    trackedDataSet.RecordsDeleted = stats.DeletedRecords;
                    await _context.SaveChangesAsync();
                }

                // 更新總處理記錄數
                trackedDataSet.RecordsProcessed = stats.NewRecords + stats.UpdatedRecords + stats.DeletedRecords;
                await _context.SaveChangesAsync();
                
                _loggingService.LogInformation($"增量同步完成，數據集ID: {trackedDataSet.Id}，新增: {stats.NewRecords}，更新: {stats.UpdatedRecords}，刪除: {stats.DeletedRecords}");
                
                return stats.NewRecords + stats.UpdatedRecords + stats.DeletedRecords;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理 {sourceType} 結果失敗: {ex.Message}", ex);
                throw;
            }
        }

        // 處理 SQL 查詢結果並存儲到數據庫 - 增量同步版本
        private async Task<int> ProcessSqlResults(DataSet dataSet, List<Dictionary<string, object>> sqlResults)
        {
            return await ProcessIncrementalSync(dataSet, sqlResults, "SQL");
        }

        // 獲取現有記錄的 Hash 映射（支援複合主鍵）
        private async Task<Dictionary<string, (DataSetRecord Record, string Hash)>> GetExistingRecordsHash(
            Guid dataSetId, 
            List<DataSetColumn> columns,
            List<DataSetColumn> primaryKeyColumns)
        {
            const int maxRetries = 3;
            int retryCount = 0;
            
            while (retryCount < maxRetries)
            {
                try
                {
                    var existingRecords = await _context.DataSetRecords
                .Where(r => r.DataSetId == dataSetId)
                .Include(r => r.Values)
                .AsNoTracking() // 提高查詢效能，減少鎖定
                .ToListAsync();

                    var hashDict = new Dictionary<string, (DataSetRecord Record, string Hash)>();
                    
                    if (primaryKeyColumns.Any())
                    {
                        _loggingService.LogInformation($"使用已定義的主鍵欄位: {string.Join(", ", primaryKeyColumns.Select(c => c.ColumnName))}");
                    
                        foreach (var record in existingRecords)
                        {
                            var hash = CalculateRecordHash(record, columns);
                        
                            // 構建複合主鍵
                            var compositeKey = BuildCompositeKeyFromRecord(record, primaryKeyColumns);
                            
                            if (!string.IsNullOrEmpty(compositeKey))
                            {
                                hashDict[compositeKey] = (record, hash);
                            }
                            else
                            {
                                // 如果無法構建複合主鍵，使用原始主鍵值
                                var primaryKey = record.PrimaryKeyValue ?? string.Empty;
                                if (!string.IsNullOrEmpty(primaryKey))
                                {
                                    hashDict[primaryKey] = (record, hash);
                                }
                            }
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning($"數據集沒有主鍵欄位定義，使用整個記錄的 Hash 作為 key");
                        
                        // 如果沒有主鍵，使用整個記錄的 Hash 作為 key
                        foreach (var record in existingRecords)
                        {
                            var hash = CalculateRecordHash(record, columns);
                            
                            // 使用 Hash 作為 key（因為沒有主鍵）
                            hashDict[hash] = (record, hash);
                        }
                    }

                    return hashDict;
                }
                catch (Exception ex) when (ex.Message.Contains("deadlock") || ex.Message.Contains("deadlocked"))
                {
                    retryCount++;
                    _loggingService.LogWarning($"獲取現有記錄時發生死鎖，第 {retryCount} 次重試，數據集ID: {dataSetId}");
                    
                    if (retryCount < maxRetries)
                    {
                        // 等待隨機時間後重試，避免多個進程同時重試
                        var delay = new Random().Next(1000, 3000);
                        await Task.Delay(delay);
                    }
                    else
                    {
                        _loggingService.LogError($"獲取現有記錄失敗，已重試 {maxRetries} 次，數據集ID: {dataSetId}");
                        throw;
                    }
                }
            }
            
            return new Dictionary<string, (DataSetRecord Record, string Hash)>();
        }

        // 計算新記錄的 Hash（支援複合主鍵）
        private Dictionary<string, (Dictionary<string, object> Row, string Hash)> CalculateNewRecordsHash(
            List<Dictionary<string, object>> sqlResults, 
            List<DataSetColumn> columns, 
            List<DataSetColumn> primaryKeyColumns)
        {
            var hashDict = new Dictionary<string, (Dictionary<string, object> Row, string Hash)>();
            var duplicateKeys = new Dictionary<string, int>();
            
            if (primaryKeyColumns.Any())
            {
                // 有主鍵的情況：使用主鍵作為 key
            foreach (var row in sqlResults)
            {
                // 構建複合主鍵
                var compositeKey = BuildCompositeKey(row, primaryKeyColumns);
                    
                if (string.IsNullOrEmpty(compositeKey))
                {
                    _loggingService.LogWarning($"記錄的複合主鍵值為空，跳過處理");
                    continue;
                }
                
                // 處理重複主鍵：使用行索引作為後綴
                var uniqueKey = compositeKey;
                if (hashDict.ContainsKey(compositeKey))
                {
                    if (!duplicateKeys.ContainsKey(compositeKey))
                    {
                        duplicateKeys[compositeKey] = 1;
                        _loggingService.LogWarning($"檢測到重複複合主鍵: '{compositeKey}'，將使用行索引區分");
                    }
                    
                    duplicateKeys[compositeKey]++;
                    uniqueKey = $"{compositeKey}_ROW_{duplicateKeys[compositeKey]}";
                    _loggingService.LogWarning($"重複複合主鍵 '{compositeKey}' 使用唯一標識: '{uniqueKey}'");
                }
                    
                var hash = CalculateRowHash(row, columns);
                hashDict[uniqueKey] = (row, hash);
            }

            if (duplicateKeys.Any())
            {
                _loggingService.LogWarning($"總共發現 {duplicateKeys.Count} 個重複複合主鍵，共影響 {duplicateKeys.Values.Sum()} 條記錄");
                }
            }
            else
            {
                // 沒有主鍵的情況：使用 Hash 作為 key
                _loggingService.LogWarning($"沒有主鍵欄位，使用整個記錄的 Hash 作為 key");
                
                foreach (var row in sqlResults)
                {
                    var hash = CalculateRowHash(row, columns);
                    
                    // 使用 Hash 作為 key（因為沒有主鍵）
                    hashDict[hash] = (row, hash);
                }
            }

            return hashDict;
        }

        // 分類記錄：新增、更新、刪除（支援複合主鍵）
        /// <param name="skipDeletes">如果為 true，跳過刪除操作（用於雙向同步的入站階段）</param>
        private (List<Dictionary<string, object>> NewRecords, 
                 List<(DataSetRecord Record, Dictionary<string, object> Row)> UpdateRecords, 
                 List<DataSetRecord> DeleteRecords) ClassifyRecords(
            Dictionary<string, (DataSetRecord Record, string Hash)> existingRecordsHash,
            Dictionary<string, (Dictionary<string, object> Row, string Hash)> newRecordsHash,
            List<Dictionary<string, object>> sqlResults,
            List<DataSetColumn> primaryKeyColumns,
            bool skipDeletes = false)
        {
            var newRecords = new List<Dictionary<string, object>>();
            var updateRecords = new List<(DataSetRecord Record, Dictionary<string, object> Row)>();
            var deleteRecords = new List<DataSetRecord>();
            var skipRecords = new List<DataSetRecord>(); // 添加跳過記錄列表

            // 找出新增和更新的記錄
            foreach (var kvp in newRecordsHash)
            {
                var primaryKey = kvp.Key;
                var (row, newHash) = kvp.Value;

            // 調試：記錄查找過程
            _loggingService.LogDebug($"查找記錄主鍵: '{primaryKey}'，現有記錄字典中是否包含此主鍵: {existingRecordsHash.ContainsKey(primaryKey)}");

                if (existingRecordsHash.TryGetValue(primaryKey, out var existing))
                {
                    if (existing.Hash != newHash)
                    {
                        // Hash 不同，需要更新
                        updateRecords.Add((existing.Record, row));
                        
                        // 調試：記錄 Hash 不匹配的詳細信息
                        if (updateRecords.Count <= 3) // 只記錄前3個
                        {
                            _loggingService.LogInformation($"Hash不匹配 - 主鍵: {primaryKey}, 現有Hash: {existing.Hash.Substring(0, Math.Min(16, existing.Hash.Length))}..., 新Hash: {newHash.Substring(0, Math.Min(16, newHash.Length))}...");
                        }
                    }
                    else
                    {
                        // Hash 相同，跳過
                        skipRecords.Add(existing.Record);
                        _loggingService.LogDebug($"Hash匹配 - 主鍵: {primaryKey}，跳過更新");
                    }
                }
                else
                {
                    // 主鍵不存在，需要新增
                    newRecords.Add(row);
                }
            }

            // 找出刪除的記錄（如果未設置跳過刪除）
            if (!skipDeletes)
            {
                var existingPrimaryKeys = existingRecordsHash.Keys.ToHashSet();
                var newPrimaryKeys = newRecordsHash.Keys.ToHashSet();
                var deletedPrimaryKeys = existingPrimaryKeys.Except(newPrimaryKeys);

                foreach (var deletedPk in deletedPrimaryKeys)
                {
                    deleteRecords.Add(existingRecordsHash[deletedPk].Record);
                }
            }
            else
            {
                // 雙向同步的入站階段：記錄那些在 dataset 中但不在外部數據源中的記錄
                var existingPrimaryKeys = existingRecordsHash.Keys.ToHashSet();
                var newPrimaryKeys = newRecordsHash.Keys.ToHashSet();
                var deletedPrimaryKeys = existingPrimaryKeys.Except(newPrimaryKeys);
                
                if (deletedPrimaryKeys.Any())
                {
                    _loggingService.LogInformation($"雙向同步入站階段：發現 {deletedPrimaryKeys.Count()} 條記錄在 dataset 中但不在外部數據源中，這些記錄將在下次出站同步時寫入");
                }
            }

            return (newRecords, updateRecords, deleteRecords);
        }

        // 批量插入新記錄
        private async Task<int> BatchInsertRecords(DataSet trackedDataSet, List<Dictionary<string, object>> newRecords, List<DataSetColumn> columns)
        {
            var totalInserted = 0;
            const int batchSize = 100; // 批次大小

            for (int i = 0; i < newRecords.Count; i += batchSize)
            {
                var batch = newRecords.Skip(i).Take(batchSize).ToList();
                _loggingService.LogInformation($"批量插入記錄 {i + 1}-{Math.Min(i + batchSize, newRecords.Count)}/{newRecords.Count}");

                var records = new List<DataSetRecord>();
                var recordValues = new List<DataSetRecordValue>();

                foreach (var row in batch)
                {
                    var record = new DataSetRecord
                    {
                        Id = Guid.NewGuid(),
                        DataSetId = trackedDataSet.Id,
                        PrimaryKeyValue = GetPrimaryKeyValue(row, columns),
                        Status = "Active",
                        CreatedAt = DateTime.UtcNow,
                    };

                    records.Add(record);
                    
                    // 創建欄位值
                    foreach (var column in columns)
                    {
                        var columnName = column.ColumnName;
                        var value = row.ContainsKey(columnName) ? row[columnName] : null;
                        
                        var recordValue = new DataSetRecordValue
                        {
                            Id = Guid.NewGuid(),
                            RecordId = record.Id,
                            ColumnName = columnName,
                            StringValue = null,
                            NumericValue = null,
                            DateValue = null,
                            BooleanValue = null
                        };

                        SetValueByType(recordValue, value, column.DataType);
                        recordValues.Add(recordValue);
                    }
                }

                // 批量插入
                _context.DataSetRecords.AddRange(records);
                _context.DataSetRecordValues.AddRange(recordValues);
                
                await _context.SaveChangesAsync();
                totalInserted += records.Count;
                
                // 更新進度
                trackedDataSet.RecordsProcessed = totalInserted;
                await _context.SaveChangesAsync();
                
                _loggingService.LogInformation($"批量插入完成，本批次: {records.Count}，累計: {totalInserted}");
            }

            return totalInserted;
        }

        // 批量更新記錄
        private async Task<int> BatchUpdateRecords(
            List<(DataSetRecord Record, Dictionary<string, object> Row)> updateRecords, 
            List<DataSetColumn> columns)
        {
            var totalUpdated = 0;
            const int batchSize = 50; // 更新批次較小

            for (int i = 0; i < updateRecords.Count; i += batchSize)
            {
                var batch = updateRecords.Skip(i).Take(batchSize).ToList();
                _loggingService.LogInformation($"批量更新記錄 {i + 1}-{Math.Min(i + batchSize, updateRecords.Count)}/{updateRecords.Count}");

                foreach (var (record, row) in batch)
                {
                    // 檢查記錄是否已經被追蹤
                    DataSetRecord recordToUpdate = record;
                    var trackedEntry = _context.Entry(record);
                    var isTracked = trackedEntry.State != Microsoft.EntityFrameworkCore.EntityState.Detached;
                    
                    if (!isTracked)
                    {
                        // 檢查 Local 緩存中是否有相同 ID 的實體
                        var trackedRecord = _context.DataSetRecords.Local.FirstOrDefault(r => r.Id == record.Id);
                        if (trackedRecord != null)
                        {
                            // 如果已經被追蹤，使用已追蹤的實體
                            recordToUpdate = trackedRecord;
                            _context.Entry(recordToUpdate).State = Microsoft.EntityFrameworkCore.EntityState.Modified;
                        }
                        else
                        {
                            // 如果沒有被追蹤，重新附加記錄到 DbContext 以確保變更追蹤
                            _context.DataSetRecords.Attach(record);
                            _context.Entry(record).State = Microsoft.EntityFrameworkCore.EntityState.Modified;
                            recordToUpdate = record;
                        }
                    }
                    else
                    {
                        // 已經被追蹤，直接設置為 Modified
                        _context.Entry(record).State = Microsoft.EntityFrameworkCore.EntityState.Modified;
                        recordToUpdate = record;
                    }
                    
                    var hasChanges = false;

                    // 更新或新增欄位值
                    foreach (var column in columns)
                    {
                        var columnName = column.ColumnName;
                        var newValue = row.ContainsKey(columnName) ? row[columnName] : null;
                        
                        var existingValue = recordToUpdate.Values?.FirstOrDefault(v => v.ColumnName == columnName);
                        
                        if (existingValue == null)
                        {
                            // 新增欄位值
                            var recordValue = new DataSetRecordValue
                            {
                                Id = Guid.NewGuid(),
                                RecordId = recordToUpdate.Id,
                                ColumnName = columnName,
                                StringValue = null,
                                NumericValue = null,
                                DateValue = null,
                                BooleanValue = null
                            };
                            
                            SetValueByType(recordValue, newValue, column.DataType);
                            _context.DataSetRecordValues.Add(recordValue);
                            // 確保 recordToUpdate.Values 包含新值（如果已加載）
                            if (recordToUpdate.Values != null)
                            {
                                recordToUpdate.Values.Add(recordValue);
                            }
                            hasChanges = true;
                        }
                        else
                        {
                            // 比較並更新值
                            var oldValueStr = GetValueAsString(existingValue);
                            var newValueStr = GetValueAsString(newValue, column.DataType);
                            
                            if (oldValueStr != newValueStr)
                            {
                                // 調試：記錄實際的欄位值變更
                                if (totalUpdated < 3 && (columnName == "ename" || columnName == "cname"))
                                {
                                    _loggingService.LogInformation($"欄位值變更 - 記錄ID: {record.PrimaryKeyValue}, 欄位: {columnName}, 舊值: '{oldValueStr}', 新值: '{newValueStr}'");
                                }
                                
                                ClearValueFields(existingValue);
                                SetValueByType(existingValue, newValue, column.DataType);
                                hasChanges = true;
                            }
                        }
                    }
                    
                    if (hasChanges)
                    {
                        recordToUpdate.UpdatedAt = DateTime.UtcNow;
                        totalUpdated++;
                    }
                }

                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"數據庫保存完成，本批次: {batch.Count}，累計: {totalUpdated}");
                
                _loggingService.LogInformation($"批量更新完成，本批次: {batch.Count}，累計: {totalUpdated}");
            }

            return totalUpdated;
        }

        // 批量刪除記錄
        private async Task<int> BatchDeleteRecords(List<DataSetRecord> deleteRecords)
        {
            var totalDeleted = 0;
            const int batchSize = 100;

            for (int i = 0; i < deleteRecords.Count; i += batchSize)
            {
                var batch = deleteRecords.Skip(i).Take(batchSize).ToList();
                _loggingService.LogInformation($"批量刪除記錄 {i + 1}-{Math.Min(i + batchSize, deleteRecords.Count)}/{deleteRecords.Count}");

                // 使用 ID 重新查詢記錄，避免追蹤衝突
                var recordIds = batch.Select(r => r.Id).ToList();
                var recordsToDelete = await _context.DataSetRecords
                    .Where(r => recordIds.Contains(r.Id))
                    .Include(r => r.Values) // 包含關聯的 Values，確保級聯刪除
                    .ToListAsync();

                _context.DataSetRecords.RemoveRange(recordsToDelete);
                await _context.SaveChangesAsync();
                
                totalDeleted += recordsToDelete.Count;
                
                _loggingService.LogInformation($"批量刪除完成，本批次: {recordsToDelete.Count}，累計: {totalDeleted}");
            }

            return totalDeleted;
        }

        // 計算記錄 Hash
        private string CalculateRecordHash(DataSetRecord record, List<DataSetColumn> columns)
        {
            var values = new List<string>();
            
            
            foreach (var column in columns.OrderBy(c => c.ColumnName))
            {
                var value = record.Values?.FirstOrDefault(v => v.ColumnName == column.ColumnName);
                var formattedValue = GetValueAsString(value, column.DataType);
                values.Add($"{column.ColumnName}:{formattedValue}");
                
                // 針對目標記錄的詳細調試
                
                // 調試特定欄位
                if (column.ColumnName == "ename" || column.ColumnName == "cname")
                {
                    _loggingService.LogDebug($"Hash計算 - 記錄ID: {record.PrimaryKeyValue}, 欄位: {column.ColumnName}, 原始值: {value?.StringValue ?? "NULL"}, 格式化值: {formattedValue}");
                }
            }
            
            var combined = string.Join("|", values);
            var hash = Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(combined)));
            
            
            return hash;
        }

        // 計算行 Hash
        private string CalculateRowHash(Dictionary<string, object> row, List<DataSetColumn> columns)
        {
            var values = new List<string>();
            var recordId = row.ContainsKey("id") ? row["id"]?.ToString() : "Unknown";
            
            foreach (var column in columns.OrderBy(c => c.ColumnName))
            {
                var value = row.ContainsKey(column.ColumnName) ? row[column.ColumnName] : null;
                var formattedValue = GetValueAsString(value, column.DataType);
                values.Add($"{column.ColumnName}:{formattedValue}");
                
                
                // 調試特定欄位
                if (column.ColumnName == "ename" || column.ColumnName == "cname")
                {
                    _loggingService.LogDebug($"新記錄Hash計算 - 記錄ID: {recordId}, 欄位: {column.ColumnName}, 原始值: {value?.ToString() ?? "NULL"}, 格式化值: {formattedValue}");
                }
            }
            
            var combined = string.Join("|", values);
            var hash = Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(combined)));
            
            
            return hash;
        }

        // 構建複合主鍵（從 SQL 行數據）
        private string BuildCompositeKey(Dictionary<string, object> row, List<DataSetColumn> primaryKeyColumns)
        {
            var keyParts = new List<string>();
            
            
            foreach (var pkColumn in primaryKeyColumns.OrderBy(c => c.ColumnName))
            {
                var value = row.ContainsKey(pkColumn.ColumnName) 
                    ? row[pkColumn.ColumnName]?.ToString()?.Trim() 
                    : null;
                    
                if (string.IsNullOrEmpty(value))
                {
                    _loggingService.LogWarning($"主鍵欄位 '{pkColumn.ColumnName}' 的值為空");
                    value = "NULL";
                }
                
                keyParts.Add($"{pkColumn.ColumnName}:{value}");
                
            }
            
            var compositeKey = string.Join("|", keyParts);
            
            
            return compositeKey;
        }

        // 構建複合主鍵（從現有記錄）
        private string BuildCompositeKeyFromRecord(DataSetRecord record, List<DataSetColumn> primaryKeyColumns)
        {
            var keyParts = new List<string>();
            
            
            foreach (var pkColumn in primaryKeyColumns.OrderBy(c => c.ColumnName))
            {
                var value = record.Values?.FirstOrDefault(v => v.ColumnName == pkColumn.ColumnName);
                var valueStr = GetValueAsString(value, pkColumn.DataType)?.Trim();
                
                if (string.IsNullOrEmpty(valueStr))
                {
                    _loggingService.LogWarning($"現有記錄主鍵欄位 '{pkColumn.ColumnName}' 的值為空");
                    valueStr = "NULL";
                }
                
                keyParts.Add($"{pkColumn.ColumnName}:{valueStr}");
                
            }
            
            var compositeKey = string.Join("|", keyParts);
            
            
            return compositeKey;
        }

        // 獲取主鍵值（用於記錄創建）
        private string GetPrimaryKeyValue(Dictionary<string, object> row, List<DataSetColumn> columns)
        {
            var primaryKeyColumns = columns.Where(c => c.IsPrimaryKey).ToList();
            
            if (primaryKeyColumns.Any())
            {
                // 使用複合主鍵
                return BuildCompositeKey(row, primaryKeyColumns);
            }
            
            // 如果沒有主鍵，嘗試使用其他唯一欄位
            var idColumn = columns.FirstOrDefault(c => c.ColumnName.ToLower().Contains("id"));
            if (idColumn != null && row.ContainsKey(idColumn.ColumnName))
            {
                var idValue = row[idColumn.ColumnName]?.ToString()?.Trim();
                if (!string.IsNullOrEmpty(idValue))
                {
                    return idValue;
                }
            }
            
            // 最後使用 GUID
            return Guid.NewGuid().ToString();
        }

        // 值比較方法
        private string GetValueAsString(object value, string dataType = null)
        {
            if (value == null) return string.Empty;
            
            // 如果是 DataSetRecordValue 對象
            if (value is DataSetRecordValue recordValue)
            {
                // 統一使用基於數據類型的格式化邏輯，與新記錄保持一致
                if (!string.IsNullOrEmpty(dataType))
                {
                    switch (dataType.ToLower())
                    {
                        case "int":
                            if (recordValue.NumericValue.HasValue)
                            {
                                return ((int)recordValue.NumericValue.Value).ToString();
                            }
                            break;
                        case "decimal":
                            if (recordValue.NumericValue.HasValue)
                            {
                                return recordValue.NumericValue.Value.ToString("F2");
                            }
                            break;
                        case "datetime":
                        case "date":
                            if (recordValue.DateValue.HasValue)
                            {
                                return recordValue.DateValue.Value.ToString("yyyy-MM-dd HH:mm:ss.fff");
                            }
                            break;
                        case "boolean":
                        case "bool":
                            if (recordValue.BooleanValue.HasValue)
                            {
                                return recordValue.BooleanValue.Value.ToString().ToLower();
                            }
                            break;
                        case "string":
                        case "text":
                            return recordValue.StringValue ?? string.Empty;
                    }
                }
                
                // 如果沒有特定的數據類型處理，優先使用 StringValue，然後是其他值
                // 但對於數值類型，確保使用統一的格式化
                if (recordValue.StringValue != null)
                {
                    return recordValue.StringValue;
                }
                
                if (recordValue.NumericValue.HasValue)
                {
                    // 對於數值，使用與新記錄相同的格式化邏輯
                    if (!string.IsNullOrEmpty(dataType) && dataType.ToLower() == "int")
                    {
                        return ((int)recordValue.NumericValue.Value).ToString();
                    }
                    else if (!string.IsNullOrEmpty(dataType) && dataType.ToLower() == "decimal")
                    {
                        return recordValue.NumericValue.Value.ToString("F2");
                    }
                    else
                    {
                        return recordValue.NumericValue.Value.ToString();
                    }
                }
                
                if (recordValue.DateValue.HasValue)
                {
                    return recordValue.DateValue.Value.ToString("yyyy-MM-dd HH:mm:ss.fff");
                }
                
                if (recordValue.BooleanValue.HasValue)
                {
                    return recordValue.BooleanValue.Value.ToString().ToLower();
                }
                
                return string.Empty;
            }
            
            // 如果是原始值，根據數據類型格式化
            if (!string.IsNullOrEmpty(dataType))
            {
                switch (dataType.ToLower())
                {
                    case "datetime":
                    case "date":
                        if (value is DateTime dateValue)
                        {
                            return dateValue.ToString("yyyy-MM-dd HH:mm:ss.fff");
                        }
                        break;
                    case "decimal":
                        if (decimal.TryParse(value.ToString(), out var decimalValue))
                        {
                            return decimalValue.ToString("F2"); // 保留2位小數
                        }
                        break;
                    case "int":
                        if (int.TryParse(value.ToString(), out var intValue))
                        {
                            return intValue.ToString();
                        }
                        break;
                    case "boolean":
                    case "bool":
                        if (bool.TryParse(value.ToString(), out var boolValue))
                        {
                            return boolValue.ToString().ToLower();
                        }
                        break;
                }
            }
            
            return value.ToString() ?? string.Empty;
        }

        // 值設置方法
        private void SetValueByType(DataSetRecordValue recordValue, object value, string dataType)
        {
            if (value == null) return;
            
            switch (dataType?.ToLower())
            {
                case "int":
                    if (int.TryParse(value.ToString(), out var intValue))
                    {
                        recordValue.NumericValue = intValue;
                    }
                    else
                    {
                        recordValue.StringValue = value.ToString();
                    }
                    break;
                    
                case "decimal":
                    if (decimal.TryParse(value.ToString(), out var decimalValue))
                    {
                        recordValue.NumericValue = decimalValue;
                    }
                    else
                    {
                        recordValue.StringValue = value.ToString();
                    }
                    break;
                    
                case "datetime":
                case "date":
                    if (value is DateTime dateValue)
                    {
                        recordValue.DateValue = dateValue;
                    }
                    else if (DateTime.TryParse(value.ToString(), out var parsedDate))
                    {
                        recordValue.DateValue = parsedDate;
                    }
                    else
                    {
                        recordValue.StringValue = value.ToString();
                    }
                    break;
                    
                case "boolean":
                case "bool":
                    if (value is bool boolValue)
                    {
                        recordValue.BooleanValue = boolValue;
                    }
                    else if (bool.TryParse(value.ToString(), out var parsedBool))
                    {
                        recordValue.BooleanValue = parsedBool;
                    }
                    else
                    {
                        recordValue.StringValue = value.ToString();
                    }
                    break;
                    
                default: // string, text
                    recordValue.StringValue = value.ToString();
                    break;
            }
        }

        private void ClearValueFields(DataSetRecordValue value)
        {
            value.StringValue = null;
            value.NumericValue = null;
            value.DateValue = null;
            value.BooleanValue = null;
        }

        // SQL 連接配置類別
        public class SqlConnectionConfig
        {
            [System.Text.Json.Serialization.JsonPropertyName("connectionType")]
            public string ConnectionType { get; set; } = string.Empty;
            
            [System.Text.Json.Serialization.JsonPropertyName("presetName")]
            public string? PresetName { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("serverName")]
            public string? ServerName { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("port")]
            public string? Port { get; set; }  // 改為字符串類型
            
            [System.Text.Json.Serialization.JsonPropertyName("databaseName")]
            public string? DatabaseName { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("authenticationType")]
            public string? AuthenticationType { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("username")]
            public string? Username { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("password")]
            public string? Password { get; set; }
            
            [System.Text.Json.Serialization.JsonPropertyName("additionalOptions")]
            public string? AdditionalOptions { get; set; }
            
            // 添加一個屬性來獲取解析後的端口號
            public int? GetPortNumber()
            {
                if (int.TryParse(Port, out var portNumber))
                {
                    return portNumber;
                }
                return null;
            }
        }

        // POST: api/datasets/preview
        [HttpPost("preview")]
        public async Task<ActionResult> PreviewDataSetQuery([FromBody] DataSetQueryPreviewRequest request)
        {
            try
            {
                _loggingService.LogInformation($"開始預覽 DataSet 查詢，DataSet ID: {request.DataSetId}");

                // 驗證請求參數
                if (request.DataSetId == Guid.Empty)
                {
                    return BadRequest(new { success = false, message = "DataSet ID 不能為空" });
                }

                // 獲取 DataSet 信息
                var dataSet = await _context.DataSets
                    .Include(ds => ds.DataSources)
                    .Include(ds => ds.Columns)
                    .FirstOrDefaultAsync(ds => ds.Id == request.DataSetId);

                if (dataSet == null)
                {
                    _loggingService.LogWarning($"DataSet 不存在，ID: {request.DataSetId}");
                    return BadRequest(new { success = false, message = "DataSet 不存在" });
                }

                _loggingService.LogInformation($"找到 DataSet: {dataSet.Name}, 數據源數量: {dataSet.DataSources?.Count ?? 0}");

                // ✅ 修復：始終使用內部同步後的表查詢，不查詢外部數據源
                // 這樣可以避免連接外部數據庫的問題，提高查詢速度和穩定性
                _loggingService.LogInformation($"使用內部 DataSet 記錄查詢（data_set_records 和 data_set_record_values）進行預覽");
                
                // ✅ 修復：使用 DataSetQueryService 查詢內部表（與實際執行邏輯一致）
                var queryService = HttpContext.RequestServices.GetRequiredService<Services.DataSetQueryService>();
                
                // 將 whereClause 解析為條件組
                var conditionGroups = ParseWhereClauseToConditionGroups(request.WhereClause, dataSet);
                
                // 記錄解析結果以便調試
                _loggingService.LogInformation($"解析 whereClause '{request.WhereClause}' 為 {conditionGroups.Count} 個條件組，包含 {conditionGroups.Sum(g => g.Conditions.Count)} 個條件");
                
                var queryRequest = new Models.DTOs.DataSetQueryRequest
                {
                    DataSetId = request.DataSetId,
                    OperationType = "SELECT",
                    QueryConditionGroups = conditionGroups,
                    ProcessVariableValues = request.ProcessVariableValues ?? new Dictionary<string, object>()
                };
                
                // ✅ 修復：測試操作時不保存結果（workflowExecutionId=0 表示測試）
                // 直接調用內部查詢方法，跳過保存邏輯
                var result = await queryService.ExecuteDataSetQueryAsync(0, 0, queryRequest, skipSave: true);
                
                if (!result.Success)
                {
                    _loggingService.LogError($"DataSet 查詢預覽失敗: {result.Message}");
                    return StatusCode(500, new { success = false, message = $"查詢預覽失敗: {result.Message}" });
                }
                
                var queryResults = result.Data.Take(request.Limit).ToList();

                _loggingService.LogInformation($"DataSet 查詢預覽成功，返回 {queryResults.Count} 條記錄");

                return Ok(new { 
                    success = true, 
                    data = queryResults,
                    totalCount = queryResults.Count,
                    dataSetName = dataSet.Name
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"DataSet 查詢預覽失敗: {ex.Message}", ex);
                return StatusCode(500, new { success = false, message = $"查詢預覽失敗: {ex.Message}" });
            }
        }

        // 執行數據庫查詢
        private async Task<List<Dictionary<string, object>>> ExecuteDatabaseQuery(DataSetDataSource dataSource, string whereClause, int limit = 10)
        {
            var results = new List<Dictionary<string, object>>();

            try
            {
                // 構建 SQL 查詢
                var baseQuery = dataSource.SqlQuery;
                if (string.IsNullOrEmpty(baseQuery))
                {
                    throw new Exception("數據源沒有配置 SQL 查詢");
                }

                // 添加 WHERE 條件
                var fullQuery = baseQuery;
                if (!string.IsNullOrEmpty(whereClause))
                {
                    // 檢查是否已經有 WHERE 子句
                    if (baseQuery.ToUpper().Contains("WHERE"))
                    {
                        fullQuery += $" AND ({whereClause})";
                    }
                    else
                    {
                        fullQuery += $" WHERE {whereClause}";
                    }
                }

                // 添加 LIMIT - 使用 TOP 語法以兼容更多 SQL Server 版本
                var upperQuery = fullQuery.ToUpper();
                if (upperQuery.Contains(" TOP "))
                {
                    // 如果已經有 TOP，替換現有的 TOP 值
                    var topPattern = @"TOP\s+\d+";
                    fullQuery = System.Text.RegularExpressions.Regex.Replace(fullQuery, topPattern, $"TOP {limit}", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                }
                else
                {
                    // 如果沒有 TOP，在 SELECT 後插入 TOP
                    var selectIndex = fullQuery.IndexOf("SELECT", StringComparison.OrdinalIgnoreCase);
                    if (selectIndex >= 0)
                    {
                        // 找到 SELECT 後的第一個空格位置
                        var afterSelectIndex = selectIndex + 6; // "SELECT" 是 6 個字符
                        while (afterSelectIndex < fullQuery.Length && char.IsWhiteSpace(fullQuery[afterSelectIndex]))
                        {
                            afterSelectIndex++;
                        }
                        
                        // 在 SELECT 後插入 TOP
                        fullQuery = fullQuery.Substring(0, afterSelectIndex) + $"TOP {limit} " + fullQuery.Substring(afterSelectIndex);
                    }
                    else
                    {
                        // 如果找不到 SELECT，用子查詢包裝
                        fullQuery = $"SELECT TOP {limit} * FROM ({fullQuery}) AS temp";
                    }
                }

                _loggingService.LogInformation($"執行數據庫查詢: {fullQuery}");
                _loggingService.LogInformation($"WHERE 條件: {whereClause}");
                _loggingService.LogInformation($"基礎查詢: {baseQuery}");

                // 獲取連接字符串
                string connectionString = null;
                
                if (!string.IsNullOrEmpty(dataSource.AuthenticationConfig))
                {
                    try
                    {
                        var config = JsonSerializer.Deserialize<SqlConnectionConfig>(dataSource.AuthenticationConfig);
                        _loggingService.LogInformation($"解析連接配置成功，ConnectionType: {config?.ConnectionType}");
                        
                        if (config?.ConnectionType == "preset")
                        {
                            connectionString = GetPresetConnectionString(config.PresetName);
                        }
                        else if (config?.ConnectionType == "custom")
                        {
                            connectionString = BuildCustomConnectionString(config);
                        }
                        else
                        {
                            // 嘗試推斷連接類型
                            if (!string.IsNullOrEmpty(config?.ServerName) && !string.IsNullOrEmpty(config?.DatabaseName))
                            {
                                connectionString = BuildCustomConnectionString(config);
                            }
                            else if (!string.IsNullOrEmpty(config?.PresetName))
                            {
                                connectionString = GetPresetConnectionString(config.PresetName);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogError($"解析連接配置失敗: {ex.Message}");
                        throw new Exception($"連接配置格式錯誤: {ex.Message}");
                    }
                }
                else
                {
                    // 向後兼容：使用舊的 databaseConnection 欄位
                    connectionString = GetPresetConnectionString(dataSource.DatabaseConnection);
                }
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    throw new Exception("無法獲取數據庫連接字符串");
                }

                _loggingService.LogInformation($"使用連接字符串: {connectionString}");

                // 執行查詢
                try
                {
                    using (var connection = new SqlConnection(connectionString))
                    {
                        await connection.OpenAsync();
                    using (var command = new SqlCommand(fullQuery, connection))
                    {
                        using (var reader = await command.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                var row = new Dictionary<string, object>();
                                for (int i = 0; i < reader.FieldCount; i++)
                                {
                                    var columnName = reader.GetName(i);
                                    var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                                    row[columnName] = value;
                                }
                                results.Add(row);
                            }
                        }
                    }
                }
                }
                catch (ArgumentException ex) when (ex.Message.Contains("Format of the initialization string"))
                {
                    _loggingService.LogError($"數據庫連接字符串格式錯誤: {ex.Message}", ex);
                    throw new Exception($"數據庫連接字符串格式錯誤，請檢查 DataSet 的數據源配置: {ex.Message}");
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"執行數據庫查詢失敗: {ex.Message}", ex);
                    throw;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行數據庫查詢失敗: {ex.Message}", ex);
                throw;
            }

            return results;
        }

        // 執行 Excel 查詢
        private async Task<List<Dictionary<string, object>>> ExecuteExcelQuery(DataSetDataSource dataSource, string whereClause, int limit = 10)
        {
            var results = new List<Dictionary<string, object>>();

            try
            {
                if (string.IsNullOrEmpty(dataSource.ExcelFilePath))
                {
                    throw new Exception("Excel 文件路徑未配置");
                }

                // 這裡可以實現 Excel 查詢邏輯
                // 由於 Excel 查詢比較複雜，暫時返回模擬數據
                _loggingService.LogWarning("Excel 查詢預覽功能尚未完全實現，返回模擬數據");

                // 模擬 Excel 查詢結果
                var mockData = new List<Dictionary<string, object>>
                {
                    new Dictionary<string, object> { { "id", 1 }, { "name", "Excel數據1" }, { "value", 100.50 } },
                    new Dictionary<string, object> { { "id", 2 }, { "name", "Excel數據2" }, { "value", 200.75 } }
                };

                results = mockData.Take(limit).ToList();
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行 Excel 查詢失敗: {ex.Message}", ex);
                throw;
            }

            return results;
        }
        
        // 將 whereClause (SQL) 解析為條件組（簡化處理）
        private List<Models.DTOs.QueryConditionGroup> ParseWhereClauseToConditionGroups(string whereClause, Models.DataSet dataSet)
        {
            var conditionGroups = new List<Models.DTOs.QueryConditionGroup>();
            
            if (string.IsNullOrEmpty(whereClause))
            {
                return conditionGroups;
            }
            
            try
            {
                // 簡單的 SQL WHERE 子句解析
                // 支持格式：[fieldName] LIKE '%value%', [fieldName] = 'value' 等
                // 處理可能包含括號的情況，如 ([invoiceno] LIKE '%value%')
                // 改進正則表達式以支持更複雜的情況
                var pattern = @"\[(\w+)\]\s+(LIKE|=\s*|!=|>|>=|<|<=)\s*'([^']*)'";
                var matches = System.Text.RegularExpressions.Regex.Matches(whereClause, pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                
                _loggingService.LogInformation($"解析 whereClause: '{whereClause}'，找到 {matches.Count} 個匹配");
                
                var conditions = new List<Models.DTOs.QueryCondition>();
                foreach (System.Text.RegularExpressions.Match match in matches)
                {
                    var fieldName = match.Groups[1].Value;
                    var operatorStr = match.Groups[2].Value.Trim();
                    var value = match.Groups[3].Value;
                    
                    // 轉換 SQL 操作符為條件操作符
                    string operatorType = operatorStr.ToUpper() switch
                    {
                        "LIKE" => "contains",
                        "=" => "equals",
                        "!=" => "notEquals",
                        ">" => "greaterThan",
                        ">=" => "greaterThanOrEqual",
                        "<" => "lessThan",
                        "<=" => "lessThanOrEqual",
                        _ => "equals"
                    };
                    
                    // 處理 LIKE '%value%' 的情況，提取實際值
                    if (operatorType == "contains" && value.StartsWith("%") && value.EndsWith("%"))
                    {
                        value = value.Substring(1, value.Length - 2);
                    }
                    
                    conditions.Add(new Models.DTOs.QueryCondition
                    {
                        Id = $"condition_{Guid.NewGuid()}",
                        FieldName = fieldName,
                        Operator = operatorType,
                        Value = value,
                        Label = $"{fieldName} {operatorType} {value}"
                    });
                }
                
                if (conditions.Any())
                {
                    conditionGroups.Add(new Models.DTOs.QueryConditionGroup
                    {
                        Id = $"group_{Guid.NewGuid()}",
                        Relation = "and",
                        Conditions = conditions
                    });
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogWarning($"解析 whereClause 失敗: {ex.Message}，將使用空條件組");
            }
            
            return conditionGroups;
        }
        
        // 轉換記錄為結果格式（從 DataSetQueryService 複製）
        private List<Dictionary<string, object>> ConvertRecordsToResultFormat(List<Models.DataSetRecord> records)
        {
            var results = new List<Dictionary<string, object>>();
            
            foreach (var record in records)
            {
                var result = new Dictionary<string, object>
                {
                    ["__record_id"] = record.Id,
                    ["__primary_key"] = record.PrimaryKeyValue ?? string.Empty,
                    ["__status"] = record.Status ?? string.Empty,
                    ["__created_at"] = record.CreatedAt,
                    ["__updated_at"] = record.UpdatedAt
                };
                
                // 添加所有欄位值
                foreach (var value in record.Values)
                {
                    object fieldValue = value.StringValue ?? 
                                      (value.NumericValue?.ToString()) ?? 
                                      (value.DateValue?.ToString()) ?? 
                                      (value.BooleanValue?.ToString()) ?? 
                                      value.TextValue ?? 
                                      string.Empty;
                    
                    result[value.ColumnName] = fieldValue;
                }
                
                results.Add(result);
            }
            
            return results;
        }

        // SQL Outbound 同步輔助方法

        /// <summary>
        /// 讀取目標 SQL 表的現有數據，構建主鍵映射
        /// </summary>
    private async Task<Dictionary<string, Dictionary<string, object>>> GetExistingSqlRecords(
        string connectionString, 
        string tableName, 
        List<DataSetColumn> primaryKeyColumns)
        {
            var map = new Dictionary<string, Dictionary<string, object>>();
            
            try
            {
                // 構建 SELECT 查詢（只查詢主鍵欄位和所有欄位）
                var query = $"SELECT * FROM [{tableName}]";
                
                using var connection = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
                await connection.OpenAsync();
                using var command = new Microsoft.Data.SqlClient.SqlCommand(query, connection);
                using var reader = await command.ExecuteReaderAsync();
                
                while (await reader.ReadAsync())
                {
                    var row = new Dictionary<string, object>();
                    var keyParts = new List<string>();
                    
                // 構建主鍵（與 BuildCompositeKeyFromRecord 格式相同）
                foreach (var pkColumn in primaryKeyColumns.OrderBy(c => c.ColumnName))
                {
                    // 直接使用 dataset 欄位名作為 SQL 表欄位名
                    var columnIndex = -1;
                    try
                    {
                        columnIndex = reader.GetOrdinal(pkColumn.ColumnName);
                    }
                    catch
                    {
                        _loggingService.LogWarning($"無法找到主鍵欄位 '{pkColumn.ColumnName}' 在表 '{tableName}' 中");
                        continue;
                    }
                        
                        var value = reader.IsDBNull(columnIndex) ? null : reader.GetValue(columnIndex);
                        var valueStr = value?.ToString()?.Trim() ?? "NULL";
                        keyParts.Add($"{pkColumn.ColumnName}:{valueStr}");
                        row[pkColumn.ColumnName] = value;
                    }
                    
                    // 讀取所有欄位值
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        var columnName = reader.GetName(i);
                        row[columnName] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    }
                    
                    var compositeKey = string.Join("|", keyParts);
                    if (!string.IsNullOrEmpty(compositeKey))
                    {
                        map[compositeKey] = row;
                    }
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"讀取目標表現有數據失敗: {ex.Message}", ex);
                throw;
            }
            
            return map;
        }

        /// <summary>
        /// 批量插入記錄到 SQL 表
        /// </summary>
    private async Task<int> BatchInsertToSql(
        Microsoft.Data.SqlClient.SqlConnection connection, 
        Microsoft.Data.SqlClient.SqlTransaction transaction,
        string tableName,
        List<DataSetRecord> records,
        List<DataSetColumn> columns,
        List<DataSetColumn> primaryKeyColumns)
    {
        int insertedCount = 0;

        // 直接使用 dataset 欄位名作為 SQL 表欄位名
        var sqlColumnNames = columns.Select(c => $"[{c.ColumnName}]").ToList();

            // 小批量使用參數化查詢（< 100 條）
            if (records.Count < 100)
            {
                foreach (var record in records)
                {
                    var values = columns.Select((c, idx) => $"@p{idx}").ToList();
                    var insertSql = $@"
                        INSERT INTO [{tableName}] ({string.Join(", ", sqlColumnNames)})
                        VALUES ({string.Join(", ", values)})";
                    
                    using var command = new Microsoft.Data.SqlClient.SqlCommand(insertSql, connection, transaction);
                    
                    for (int i = 0; i < columns.Count; i++)
                    {
                        var column = columns[i];
                        var value = GetRecordValueForSql(record, column);
                        command.Parameters.AddWithValue($"@p{i}", value ?? DBNull.Value);
                    }
                    
                    await command.ExecuteNonQueryAsync();
                    insertedCount++;
                }
            }
            else
            {
                // 大批量使用參數化查詢（分批處理）
                const int batchSize = 100;
                for (int batchStart = 0; batchStart < records.Count; batchStart += batchSize)
                {
                    var batch = records.Skip(batchStart).Take(batchSize).ToList();
                    
                    foreach (var record in batch)
                    {
                        var values = columns.Select((c, idx) => $"@p{idx}").ToList();
                        var insertSql = $@"
                            INSERT INTO [{tableName}] ({string.Join(", ", sqlColumnNames)})
                            VALUES ({string.Join(", ", values)})";
                        
                        using var command = new Microsoft.Data.SqlClient.SqlCommand(insertSql, connection, transaction);
                        
                        for (int i = 0; i < columns.Count; i++)
                        {
                            var column = columns[i];
                            var value = GetRecordValueForSql(record, column);
                            command.Parameters.AddWithValue($"@p{i}", value ?? DBNull.Value);
                        }
                        
                        await command.ExecuteNonQueryAsync();
                        insertedCount++;
                    }
                    
                    _loggingService.LogInformation($"批量插入進度: {insertedCount}/{records.Count}");
                }
            }

            return insertedCount;
        }

        /// <summary>
        /// 批量更新記錄到 SQL 表（使用 MERGE 語句）
        /// </summary>
    private async Task<int> BatchUpdateToSql(
        Microsoft.Data.SqlClient.SqlConnection connection, 
        Microsoft.Data.SqlClient.SqlTransaction transaction,
        string tableName,
        List<(DataSetRecord Record, Dictionary<string, object> ExistingData)> records,
        List<DataSetColumn> columns,
        List<DataSetColumn> primaryKeyColumns)
    {
        int updatedCount = 0;

        // 直接使用 dataset 欄位名作為 SQL 表欄位名
        var sqlColumnNames = columns.Select(c => $"[{c.ColumnName}]").ToList();

        // 構建更新欄位列表（排除主鍵）
        var updateColumns = columns
            .Where(c => !primaryKeyColumns.Contains(c))
            .Select(c => $"[{c.ColumnName}]")
            .ToList();

        // 構建主鍵欄位列表
        var pkSqlColumns = primaryKeyColumns.Select(c => $"[{c.ColumnName}]").ToList();

            // 使用 MERGE 語句進行更新
            foreach (var (record, existingData) in records)
            {
                // 構建 MERGE 語句
                var sourceColumns = sqlColumnNames.Select((col, idx) => $"@val{idx} AS {col}").ToList();
                var matchConditions = pkSqlColumns.Select((col, idx) => $"target.{col} = @pk{idx}").ToList();
                var updateSet = updateColumns.Select((col, idx) => $"{col} = source.{col}").ToList();
                
                var mergeSql = $@"
                    MERGE [{tableName}] AS target
                    USING (SELECT {string.Join(", ", sourceColumns)}) AS source
                    ON {string.Join(" AND ", matchConditions)}
                    WHEN MATCHED THEN
                        UPDATE SET {string.Join(", ", updateSet)}
                    WHEN NOT MATCHED THEN
                        INSERT ({string.Join(", ", sqlColumnNames)})
                        VALUES ({string.Join(", ", sqlColumnNames.Select(col => $"source.{col}"))});";

                using var command = new Microsoft.Data.SqlClient.SqlCommand(mergeSql, connection, transaction);
                
                // 設置值參數
                for (int i = 0; i < columns.Count; i++)
                {
                    var column = columns[i];
                    var value = GetRecordValueForSql(record, column);
                    command.Parameters.AddWithValue($"@val{i}", value ?? DBNull.Value);
                }
                
                // 設置主鍵參數
                for (int i = 0; i < primaryKeyColumns.Count; i++)
                {
                    var pkColumn = primaryKeyColumns[i];
                    var value = GetRecordValueForSql(record, pkColumn);
                    command.Parameters.AddWithValue($"@pk{i}", value ?? DBNull.Value);
                }
                
                await command.ExecuteNonQueryAsync();
                updatedCount++;
            }

            return updatedCount;
        }

        /// <summary>
        /// 從 DataSetRecord 獲取值並轉換為 SQL 兼容的類型
        /// </summary>
        private object? GetRecordValueForSql(DataSetRecord record, DataSetColumn column)
        {
            var value = record.Values?.FirstOrDefault(v => v.ColumnName == column.ColumnName);
            if (value == null) return null;

            return column.DataType?.ToLower() switch
            {
                "int" => value.NumericValue.HasValue ? (int)value.NumericValue.Value : (object?)null,
                "decimal" => value.NumericValue,
                "datetime" => value.DateValue,
                "boolean" => value.BooleanValue,
                _ => value.StringValue
            };
        }
    }

    // DTO 類別
    public class CreateDataSetRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string DataSourceType { get; set; } = string.Empty;
        public Guid CompanyId { get; set; }
        public bool IsScheduled { get; set; } = false;
        public int? UpdateIntervalMinutes { get; set; }
        public string? SyncDirection { get; set; } = "inbound";
        public string CreatedBy { get; set; } = string.Empty;
        public List<CreateColumnRequest>? Columns { get; set; }
        public CreateDataSourceRequest? DataSource { get; set; }
    }

    public class CreateColumnRequest
    {
        public string ColumnName { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public string DataType { get; set; } = string.Empty;
        public int? MaxLength { get; set; }
        public bool IsRequired { get; set; } = false;
        public bool IsPrimaryKey { get; set; } = false;
        public bool IsSearchable { get; set; } = false;
        public bool IsSortable { get; set; } = false;
        public bool IsIndexed { get; set; } = false;
        public string? DefaultValue { get; set; }
        public int SortOrder { get; set; } = 0;
    }

    public class CreateDataSourceRequest
    {
        public string SourceType { get; set; } = string.Empty;
        public string? DatabaseConnection { get; set; }
        public string? SqlQuery { get; set; }
        public string? SqlParameters { get; set; }
        public string? TargetTableName { get; set; } // SQL 出站同步目標表名
        public string? ExcelFilePath { get; set; }
        public string? ExcelSheetName { get; set; }
        public string? GoogleDocsUrl { get; set; }
        public string? GoogleDocsSheetName { get; set; }
        public string? AuthenticationConfig { get; set; }
    }

    public class UpdateDataSetRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Status { get; set; }
        public bool? IsScheduled { get; set; }
        public int? UpdateIntervalMinutes { get; set; }
        public string? SyncDirection { get; set; }
        public string UpdatedBy { get; set; } = string.Empty;
        
        // 新增：數據源相關字段
        public CreateDataSourceRequest? DataSource { get; set; }
        public List<CreateColumnRequest>? Columns { get; set; }
    }

    public class SearchRequest
    {
        public List<SearchCondition>? Conditions { get; set; }
        public string? SortBy { get; set; }
        public string? SortOrder { get; set; } = "asc";
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }

    public class SearchCondition
    {
        public string ColumnName { get; set; } = string.Empty;
        public string Operator { get; set; } = string.Empty; // equals, contains, greater_than, less_than, date_range
        public string Value { get; set; } = string.Empty;
    }

    public class SyncRequest
    {
        public string SyncDirection { get; set; } = "inbound"; // inbound, outbound, bidirectional
    }

    public class SyncResult
    {
        public bool Success { get; set; }
        public int TotalRecords { get; set; }
        public string? ErrorMessage { get; set; }
    }

    // 同步統計類別
    public class SyncStats
    {
        public int NewRecords { get; set; }
        public int UpdatedRecords { get; set; }
        public int DeletedRecords { get; set; }
        public int UnchangedRecords { get; set; }
    }

    // DataSet 查詢預覽請求模型
    public class DataSetQueryPreviewRequest
    {
        public Guid DataSetId { get; set; }
        public string WhereClause { get; set; } = string.Empty;
        public int Limit { get; set; } = 10;
        public Dictionary<string, object> ProcessVariableValues { get; set; } = new Dictionary<string, object>();
    }
}
