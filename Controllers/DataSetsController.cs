using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System.Text.Json;
using System.Text.RegularExpressions;
using PurpleRice.Models.DTOs;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;
using PurpleRice.Services;
using Microsoft.Data.SqlClient;

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

        public DataSetsController(PurpleRiceDbContext context, ILogger<DataSetsController> logger, IWebHostEnvironment environment, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _logger = logger;
            _environment = environment;
            _loggingService = loggingServiceFactory("DataSetsController");
        }

        // GET: api/datasets
        [HttpGet]
        public async Task<ActionResult<object>> GetDataSets(
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            try
            {
                _loggingService.LogInformation($"開始獲取數據集列表，搜索條件: {search}, 頁碼: {page}, 每頁大小: {pageSize}");
                var query = _context.DataSets
                    .Include(d => d.Columns.OrderBy(c => c.SortOrder))
                    .Include(d => d.DataSources)
                    .AsQueryable();

                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(d => d.Name.Contains(search) || d.Description.Contains(search));
                }

                var totalCount = await query.CountAsync();
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
                    CreatedAt = ds.CreatedAt,
                    CreatedBy = ds.CreatedBy,
                    UpdatedAt = ds.UpdatedAt,
                    UpdatedBy = ds.UpdatedBy,
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
                        ExcelFilePath = dataSource.ExcelFilePath,
                        ExcelSheetName = dataSource.ExcelSheetName,
                        ExcelUrl = dataSource.ExcelUrl,
                        GoogleDocsUrl = dataSource.GoogleDocsUrl,
                        GoogleDocsSheetName = dataSource.GoogleDocsSheetName,
                        SqlParameters = dataSource.SqlParameters,
                        AuthenticationConfig = dataSource.AuthenticationConfig,
                        AutoUpdate = dataSource.AutoUpdate,
                        UpdateIntervalMinutes = dataSource.UpdateIntervalMinutes,
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
                var dataSet = await _context.DataSets
                    .Include(ds => ds.Columns.OrderBy(c => c.SortOrder))
                    .Include(ds => ds.DataSources)
                    .FirstOrDefaultAsync(ds => ds.Id == id);

                if (dataSet == null)
                {
                    _loggingService.LogWarning($"數據集不存在，ID: {id}");
                    return NotFound(new { success = false, message = "DataSet 不存在" });
                }

                _loggingService.LogInformation($"成功獲取數據集，ID: {id}");
                return Ok(new { success = true, data = dataSet });
            }
            catch (Exception ex)
            {
                _loggingService.LogError("獲取 DataSet 失敗", ex);
                return StatusCode(500, new { success = false, message = "獲取 DataSet 失敗" });
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
                        ExcelFilePath = request.DataSource.ExcelFilePath,
                        ExcelSheetName = request.DataSource.ExcelSheetName,
                        ExcelUrl = request.DataSource.ExcelUrl,
                        GoogleDocsUrl = request.DataSource.GoogleDocsUrl,
                        GoogleDocsSheetName = request.DataSource.GoogleDocsSheetName,
                        AuthenticationConfig = request.DataSource.AuthenticationConfig,
                        AutoUpdate = request.DataSource.AutoUpdate,
                        UpdateIntervalMinutes = request.DataSource.UpdateIntervalMinutes
                    };
                    
                    _loggingService.LogInformation($"Excel 相關配置 - 文件路徑: {request.DataSource.ExcelFilePath}, 工作表: {request.DataSource.ExcelSheetName}, URL: {request.DataSource.ExcelUrl}");
                    
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
                    CreatedBy = dataSet.CreatedBy,
                    CreatedAt = dataSet.CreatedAt
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
                _loggingService.LogInformation($"請求數據詳細內容: {JsonSerializer.Serialize(request, new JsonSerializerOptions { WriteIndented = true })}");
                
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
                    dataSource.ExcelFilePath = request.DataSource.ExcelFilePath;
                    dataSource.ExcelSheetName = request.DataSource.ExcelSheetName;
                    dataSource.ExcelUrl = request.DataSource.ExcelUrl;
                    dataSource.GoogleDocsUrl = request.DataSource.GoogleDocsUrl;
                    dataSource.GoogleDocsSheetName = request.DataSource.GoogleDocsSheetName;
                    dataSource.AuthenticationConfig = request.DataSource.AuthenticationConfig;
                    dataSource.AutoUpdate = request.DataSource.AutoUpdate;
                    dataSource.UpdateIntervalMinutes = request.DataSource.UpdateIntervalMinutes;
                    
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
        public async Task<IActionResult> SyncDataSet(Guid id)
        {
            try
            {
                _loggingService.LogInformation($"開始同步數據集，ID: {id}");
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
                var syncResult = await SyncDataSetData(dataSet);
                
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
                        // 如果沒有 TOP，在 SELECT 後插入 TOP 1
                        var selectIndex = trimmedQuery.IndexOf("SELECT", StringComparison.OrdinalIgnoreCase);
                        var afterSelect = trimmedQuery.Substring(selectIndex + 6); // "SELECT " 是 6 個字符
                        sampleQuery = trimmedQuery.Substring(0, selectIndex + 6) + "TOP 1 " + afterSelect;
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
                        var columnName = column.Key;
                        var value = column.Value;
                        
                        // 推斷數據類型
                        var dataType = InferDataTypeFromValue(value);
                        
                        columns.Add(new
                        {
                            columnName = columnName,
                            displayName = columnName, // 可以根據需要自定義顯示名稱
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

        public class TestSqlConnectionRequest
        {
            public string ConnectionString { get; set; } = string.Empty;
        }

        public class GenerateColumnsFromSqlRequest
        {
            public string ConnectionString { get; set; } = string.Empty;
            public string SqlQuery { get; set; } = string.Empty;
        }

        private async Task<SyncResult> SyncDataSetData(DataSet dataSet)
        {
            try
            {
                _loggingService.LogInformation($"開始同步數據集數據，數據集ID: {dataSet.Id}");
                var dataSource = dataSet.DataSources.FirstOrDefault();
                if (dataSource == null)
                {
                    _loggingService.LogWarning($"未找到數據源配置，數據集ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "未找到數據源配置" };
                }

                switch (dataSource.SourceType.ToUpper())
                {
                    case "SQL":
                        return await SyncFromSql(dataSet, dataSource);
                    case "EXCEL":
                        return await SyncFromExcel(dataSet, dataSource);
                    case "GOOGLE_DOCS":
                        return await SyncFromGoogleDocs(dataSet, dataSource);
                    default:
                        _loggingService.LogWarning($"不支援的數據源類型，數據集ID: {dataSet.Id}, 數據源類型: {dataSource.SourceType}");
                        return new SyncResult { Success = false, ErrorMessage = "不支援的數據源類型" };
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError("同步數據失敗", ex);
                return new SyncResult { Success = false, ErrorMessage = ex.Message };
            }
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
                    var totalRecords = await ProcessSqlResults(dataSet, result.Data);
                    return new SyncResult { Success = true, TotalRecords = totalRecords };
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
                    
                    _loggingService.LogInformation($"同步Excel路徑構建調試 - 原始路徑: {dataSource.ExcelFilePath}");
                    _loggingService.LogInformation($"同步Excel路徑構建調試 - 相對路徑: {relativePath}");
                    _loggingService.LogInformation($"同步Excel路徑構建調試 - 當前目錄: {Directory.GetCurrentDirectory()}");
                    _loggingService.LogInformation($"同步Excel路徑構建調試 - 最終路徑: {filePath}");
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
                var totalRecords = 0;

                foreach (var row in dataRows)
                {
                    if (await ProcessExcelRow(dataSet, row, headers, workbookPart.SharedStringTablePart))
                    {
                        totalRecords++;
                    }
                }

                _loggingService.LogInformation($"Excel 數據同步完成，共處理 {totalRecords} 條記錄，數據集ID: {dataSet.Id}");

                return new SyncResult { Success = true, TotalRecords = totalRecords };
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

            var columnIndex = 0;
            for (int i = 0; i < headers.Count; i++)
            {
                var header = headers[i];
                if (string.IsNullOrWhiteSpace(header))
                    continue;

                var columnName = header.Trim().Replace(" ", "_").ToLower();
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

                    var columnName = headers[i].Trim().Replace(" ", "_").ToLower();
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
            // 實現 Google Docs 數據同步邏輯
            _loggingService.LogInformation($"開始同步 Google Docs 數據，數據集ID: {dataSet.Id}");
            return new SyncResult { Success = true, TotalRecords = 0 };
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
            var configuration = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
            
            switch (connectionName?.ToLower())
            {
                case "erp_awh":
                    return configuration.GetConnectionString("ErpDbContext");
                case "purple_rice":
                    return configuration.GetConnectionString("PurpleRice");
                default:
                    _loggingService.LogWarning($"未知的預設連接名稱: {connectionName}");
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
                        var columnName = reader.GetName(i);
                        var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        row[columnName] = value;
                    }
                    results.Add(row);
                }
                
                _loggingService.LogInformation($"SQL 查詢執行成功，返回 {results.Count} 行數據");
                return (true, results, null);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"SQL 查詢執行失敗: {ex.Message}", ex);
                return (false, null, ex.Message);
            }
        }

        // 處理 SQL 查詢結果並存儲到數據庫
        private async Task<int> ProcessSqlResults(DataSet dataSet, List<Dictionary<string, object>> sqlResults)
        {
            try
            {
                _loggingService.LogInformation($"開始處理 SQL 查詢結果，數據集ID: {dataSet.Id}，結果行數: {sqlResults.Count}");
                
                // 獲取欄位定義
                var columns = await _context.DataSetColumns
                    .Where(c => c.DataSetId == dataSet.Id)
                    .ToListAsync();
                
                if (!columns.Any())
                {
                    _loggingService.LogWarning($"數據集沒有欄位定義，數據集ID: {dataSet.Id}");
                    return 0;
                }
                
                var totalRecords = 0;
                
                foreach (var row in sqlResults)
                {
                    if (await ProcessSqlRow(dataSet, row, columns))
                    {
                        totalRecords++;
                    }
                }
                
                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"SQL 結果處理完成，成功處理 {totalRecords} 條記錄，數據集ID: {dataSet.Id}");
                
                return totalRecords;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理 SQL 結果失敗: {ex.Message}", ex);
                throw;
            }
        }

        // 處理單行 SQL 結果
        private async Task<bool> ProcessSqlRow(DataSet dataSet, Dictionary<string, object> row, List<DataSetColumn> columns)
        {
            try
            {
                // 創建記錄
                var record = new DataSetRecord
                {
                    Id = Guid.NewGuid(),
                    DataSetId = dataSet.Id,
                    PrimaryKeyValue = row.FirstOrDefault().Value?.ToString() ?? Guid.NewGuid().ToString(),
                    Status = "Active",
                    CreatedAt = DateTime.UtcNow,
                };

                _context.DataSetRecords.Add(record);
                
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

                    // 根據數據類型存儲到對應欄位
                    if (value != null)
                    {
                        switch (column.DataType?.ToLower())
                        {
                            case "int":
                            case "decimal":
                                if (decimal.TryParse(value.ToString(), out var numericValue))
                                {
                                    recordValue.NumericValue = numericValue;
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

                    _context.DataSetRecordValues.Add(recordValue);
                }

                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理 SQL 行數據失敗: {ex.Message}", ex);
                return false;
            }
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
        public string? ExcelFilePath { get; set; }
        public string? ExcelSheetName { get; set; }
        public string? ExcelUrl { get; set; }
        public string? GoogleDocsUrl { get; set; }
        public string? GoogleDocsSheetName { get; set; }
        public string? AuthenticationConfig { get; set; }
        public bool AutoUpdate { get; set; } = false;
        public int? UpdateIntervalMinutes { get; set; }
    }

    public class UpdateDataSetRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Status { get; set; }
        public bool? IsScheduled { get; set; }
        public int? UpdateIntervalMinutes { get; set; }
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

    public class SyncResult
    {
        public bool Success { get; set; }
        public int TotalRecords { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
