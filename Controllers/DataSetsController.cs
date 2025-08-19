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
                var dataSet = await _context.DataSets.FindAsync(id);
                if (dataSet == null)
                {
                    _loggingService.LogWarning($"數據集不存在，ID: {id}");
                    return NotFound(new { success = false, message = "DataSet 不存在" });
                }

                dataSet.Name = request.Name ?? dataSet.Name;
                dataSet.Description = request.Description ?? dataSet.Description;
                dataSet.Status = request.Status ?? dataSet.Status;
                dataSet.IsScheduled = request.IsScheduled ?? dataSet.IsScheduled;
                dataSet.UpdateIntervalMinutes = request.UpdateIntervalMinutes ?? dataSet.UpdateIntervalMinutes;
                dataSet.UpdatedBy = request.UpdatedBy;
                dataSet.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"數據集更新成功，ID: {id}");
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
            // 實現 SQL 數據同步邏輯
            // 這裡需要根據實際需求實現具體的同步邏輯
            _loggingService.LogInformation($"開始同步 SQL 數據，數據集ID: {dataSet.Id}");
            return new SyncResult { Success = true, TotalRecords = 0 };
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
                var headers = GetCellValues(headerRow, workbookPart.SharedStringTablePart).ToList();
                
                _loggingService.LogInformation($"Excel 標題行: {string.Join(", ", headers)}");

                // 檢查是否需要創建或更新欄位定義
                await EnsureColumnsExist(dataSet, headers);

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

        private async Task EnsureColumnsExist(DataSet dataSet, List<string> headers)
        {
            _loggingService.LogInformation($"開始確保欄位定義存在，數據集ID: {dataSet.Id}");
            var existingColumns = await _context.DataSetColumns
                .Where(c => c.DataSetId == dataSet.Id)
                .ToListAsync();

            var columnIndex = 0;
            foreach (var header in headers)
            {
                if (string.IsNullOrWhiteSpace(header))
                    continue;

                var columnName = header.Trim().Replace(" ", "_").ToLower();
                var existingColumn = existingColumns.FirstOrDefault(c => c.ColumnName == columnName);

                if (existingColumn == null)
                {
                    // 創建新欄位
                    var newColumn = new DataSetColumn
                    {
                        Id = Guid.NewGuid(),
                        DataSetId = dataSet.Id,
                        ColumnName = columnName,
                        DisplayName = header.Trim(),
                        DataType = "string", // 預設為字串類型
                        MaxLength = 255,
                        IsRequired = false,
                        IsPrimaryKey = columnIndex == 0, // 第一列作為主鍵
                        IsSearchable = true,
                        IsSortable = true,
                        IsIndexed = false,
                        SortOrder = columnIndex
                    };

                    _context.DataSetColumns.Add(newColumn);
                    existingColumns.Add(newColumn);
                    _loggingService.LogInformation($"創建新欄位，數據集ID: {dataSet.Id}, 欄位名稱: {columnName}");
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
                    // CreatedBy 屬性在模型中不存在，移除
                };

                _context.DataSetRecords.Add(record);
                _loggingService.LogInformation($"創建數據集記錄，數據集ID: {dataSet.Id}, 主鍵值: {record.PrimaryKeyValue}");

                // 創建欄位值
                for (int i = 0; i < headers.Count; i++)
                {
                    if (string.IsNullOrWhiteSpace(headers[i]))
                        continue;

                    var columnName = headers[i].Trim().Replace(" ", "_").ToLower();
                    var cellValue = cellValues[i] ?? string.Empty;

                    var recordValue = new DataSetRecordValue
                    {
                        Id = Guid.NewGuid(),
                        RecordId = record.Id,
                        ColumnName = columnName,
                        StringValue = cellValue,
                        // CreatedAt 屬性在模型中不存在，移除
                    };

                    _context.DataSetRecordValues.Add(recordValue);
                    _loggingService.LogInformation($"創建數據集記錄值，數據集ID: {dataSet.Id}, 記錄ID: {record.Id}, 欄位名稱: {columnName}, 值: {cellValue}");
                }

                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"Excel 行數據處理完成，數據集ID: {dataSet.Id}");
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError("處理 Excel 行數據失敗", ex);
                return false;
            }
        }

        private async Task<SyncResult> SyncFromGoogleDocs(DataSet dataSet, DataSetDataSource dataSource)
        {
            // 實現 Google Docs 數據同步邏輯
            _loggingService.LogInformation($"開始同步 Google Docs 數據，數據集ID: {dataSet.Id}");
            return new SyncResult { Success = true, TotalRecords = 0 };
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
