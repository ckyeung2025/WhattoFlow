using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using PurpleRice.Services;
using System.IO;
using Microsoft.EntityFrameworkCore.Storage;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowExecutionsController : ControllerBase
    {
        private readonly PurpleRiceDbContext _db;
        private readonly WorkflowEngine _engine;
        private readonly LoggingService _loggingService;
        
        public WorkflowExecutionsController(PurpleRiceDbContext db, WorkflowEngine engine, Func<string, LoggingService> loggingServiceFactory)
        {
            _db = db;
            _engine = engine;
            _loggingService = loggingServiceFactory("WorkflowExecutionsController");
        }

        // POST: api/workflowexecutions/start
        [HttpPost("start")] // body: { workflowDefinitionId: 1, input: {...} }
        public async Task<IActionResult> Start([FromBody] WorkflowStartRequest req)
        {
            var def = await _db.WorkflowDefinitions.FindAsync(req.WorkflowDefinitionId);
            if (def == null) return NotFound("Workflow definition not found");

            var execution = new WorkflowExecution
            {
                WorkflowDefinitionId = def.Id,
                Status = "Running",
                CurrentStep = 0,
                InputJson = req.Input != null ? JsonSerializer.Serialize(req.Input) : null,
                StartedAt = DateTime.UtcNow // 使用 UTC 時間
            };
            _db.WorkflowExecutions.Add(execution);
            await _db.SaveChangesAsync();

            // 執行流程
            await _engine.ExecuteWorkflowAsync(execution, null);

            return Ok(new { executionId = execution.Id, status = execution.Status });
        }

        // 手動啟動工作流程（從 WorkflowEngineController 合併）
        [HttpPost("workflow/{id}/start")]
        public async Task<IActionResult> StartWorkflow(int id, [FromBody] StartWorkflowRequest request)
        {
            try
            {
                _loggingService.LogInformation($"=== 手動啟動工作流程開始 ===");
                _loggingService.LogInformation($"工作流程 ID: {id}");

                // 查找工作流程定義
                var workflow = await _db.WorkflowDefinitions
                    .FirstOrDefaultAsync(w => w.Id == id);

                if (workflow == null)
                {
                    _loggingService.LogWarning($"找不到工作流程，ID: {id}");
                    return NotFound(new { error = "工作流程不存在" });
                }

                if (workflow.Status != "Active" && workflow.Status != "啟用")
                {
                    _loggingService.LogWarning($"工作流程狀態不正確: {workflow.Status}");
                    return BadRequest(new { error = "工作流程未啟用" });
                }

                // 創建執行記錄
                var execution = new WorkflowExecution
                {
                    WorkflowDefinitionId = workflow.Id,
                    Status = "Running",
                    StartedAt = DateTime.UtcNow, // 使用 UTC 時間
                    InputJson = JsonSerializer.Serialize(request.InputData),
                    CreatedBy = User.FindFirst("user_id")?.Value ?? "manual-user"
                };

                _db.WorkflowExecutions.Add(execution);
                await _db.SaveChangesAsync();

                _loggingService.LogInformation($"執行記錄已創建，ID: {execution.Id}");

                // 調用 WorkflowEngine 執行工作流程
                var result = await _engine.ExecuteWorkflow(execution.Id, request.InputData);

                _loggingService.LogInformation($"工作流程執行完成，狀態: {result.Status}");

                return Ok(new
                {
                    success = true,
                    executionId = execution.Id,
                    status = result.Status,
                    message = "工作流程已啟動並執行完成"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"啟動工作流程失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = $"啟動工作流程失敗: {ex.Message}" });
            }
        }

        // GET: api/workflowexecutions/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var exec = await _db.WorkflowExecutions
                .Include(e => e.StepExecutions)
                .FirstOrDefaultAsync(e => e.Id == id);
            if (exec == null) return NotFound();
            return Ok(exec);
        }

        // POST: api/workflowexecutions/{id}/resume
        //[HttpPost("{id}/resume")]
        //public async Task<IActionResult> Resume(int id, [FromBody] Dictionary<string, object> input)
        //{
        //    var exec = await _db.WorkflowExecutions.Include(e => e.WorkflowDefinition).FirstOrDefaultAsync(e => e.Id == id);
        //    if (exec == null) return NotFound();
        //    if (exec.Status != "Waiting") return BadRequest("Workflow is not waiting");
        //    exec.Status = "Running";
        //    exec.InputJson = input != null ? JsonSerializer.Serialize(input) : null;
        //    await _engine.ExecuteWorkflowAsync(exec, null);
        //    return Ok(new { executionId = exec.Id, status = exec.Status });
        //}

        // GET: api/workflowexecutions/monitor
        [HttpGet("monitor")]
        public async Task<IActionResult> GetMonitorData(
            int page = 1, 
            int pageSize = 20, 
            string status = null, 
            string search = null,
            DateTime? startDate = null,
            DateTime? endDate = null,
            DateTime? startDateFrom = null,
            DateTime? startDateTo = null,
            DateTime? endDateFrom = null,
            DateTime? endDateTo = null,
            string sortBy = "startedAt",
            string sortOrder = "desc")
        {
            try
            {
                Console.WriteLine($"WorkflowExecutionsController: 開始獲取監控數據，排序字段: {sortBy}, 排序順序: {sortOrder}");
                var query = _db.WorkflowExecutions
                    .Include(e => e.WorkflowDefinition)
                    .Include(e => e.StepExecutions)
                    .AsQueryable();

                // 狀態篩選
                // 使用與統計邏輯一致的模糊匹配，以支持包含多種狀態值的篩選
                if (!string.IsNullOrEmpty(status) && status != "all")
                {
                    var statusLower = status.ToLower();
                    if (statusLower == "running")
                    {
                        // running 包含所有運行中的狀態，包括 Running、Waiting、WaitingForQRCode、WaitingForFormApproval 等
                        query = query.Where(e => e.Status != null && 
                            (e.Status.ToLower().Contains("run") || e.Status.ToLower().Contains("wait")));
                    }
                    else if (statusLower == "completed")
                    {
                        // completed 包含所有完成的狀態
                        query = query.Where(e => e.Status != null && e.Status.ToLower().Contains("complete"));
                    }
                    else if (statusLower == "failed")
                    {
                        // failed 包含所有失敗的狀態
                        query = query.Where(e => e.Status != null && e.Status.ToLower().Contains("fail"));
                    }
                    else
                    {
                        // 其他狀態使用精確匹配（如 Paused, Cancelled）
                        query = query.Where(e => e.Status == status);
                    }
                }

                // 搜索篩選
                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(e => 
                        e.WorkflowDefinition.Name.Contains(search) ||
                        e.Id.ToString().Contains(search) ||
                        (e.CreatedBy != null && e.CreatedBy.Contains(search))
                    );
                }

                // 日期範圍篩選
                // 開始日期範圍篩選（基於實例開始時間）
                if (startDateFrom.HasValue)
                {
                    // 將 UTC 時間轉換為本地時間的開始時間（00:00:00）
                    var localStartDate = startDateFrom.Value.ToLocalTime().Date;
                    query = query.Where(e => e.StartedAt >= localStartDate);
                }
                if (startDateTo.HasValue)
                {
                    // 將 UTC 時間轉換為本地時間的結束時間（23:59:59.999）
                    var localEndDate = startDateTo.Value.ToLocalTime().Date.AddDays(1).AddTicks(-1);
                    query = query.Where(e => e.StartedAt <= localEndDate);
                }

                // 結束日期範圍篩選（基於實例結束時間）
                if (endDateFrom.HasValue || endDateTo.HasValue)
                {
                    // 如果設置了結束日期範圍，只顯示已結束的實例（EndedAt 不為 null）
                    query = query.Where(e => e.EndedAt.HasValue);
                    
                    if (endDateFrom.HasValue)
                    {
                        // 將 UTC 時間轉換為本地時間的開始時間（00:00:00）
                        var localEndDateFrom = endDateFrom.Value.ToLocalTime().Date;
                        query = query.Where(e => e.EndedAt >= localEndDateFrom);
                    }
                    if (endDateTo.HasValue)
                    {
                        // 將 UTC 時間轉換為本地時間的結束時間（23:59:59.999）
                        var localEndDateTo = endDateTo.Value.ToLocalTime().Date.AddDays(1).AddTicks(-1);
                        query = query.Where(e => e.EndedAt <= localEndDateTo);
                    }
                }

                // 向後兼容舊的參數名稱
                if (startDate.HasValue)
                {
                    // 將 UTC 時間轉換為本地時間的開始時間（00:00:00）
                    var localStartDate = startDate.Value.ToLocalTime().Date;
                    query = query.Where(e => e.StartedAt >= localStartDate);
                }
                if (endDate.HasValue)
                {
                    // 將 UTC 時間轉換為本地時間的結束時間（23:59:59.999）
                    var localEndDate = endDate.Value.ToLocalTime().Date.AddDays(1).AddTicks(-1);
                    query = query.Where(e => e.StartedAt <= localEndDate);
                }

                // 計算總數
                var total = await query.CountAsync();

                // 動態排序
                Console.WriteLine($"WorkflowExecutionsController: 執行排序，字段: {sortBy}, 順序: {sortOrder}");
                switch (sortBy.ToLower())
                {
                    case "id":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(e => e.Id) : query.OrderByDescending(e => e.Id);
                        Console.WriteLine($"按 ID 排序: {sortOrder}");
                        break;
                    case "workflowname":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(e => e.WorkflowDefinition.Name) : query.OrderByDescending(e => e.WorkflowDefinition.Name);
                        Console.WriteLine($"按工作流程名稱排序: {sortOrder}");
                        break;
                    case "status":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(e => e.Status) : query.OrderByDescending(e => e.Status);
                        Console.WriteLine($"按狀態排序: {sortOrder}");
                        break;
                    case "currentstep":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(e => e.CurrentStep) : query.OrderByDescending(e => e.CurrentStep);
                        Console.WriteLine($"按當前步驟排序: {sortOrder}");
                        break;
                    case "startedat":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(e => e.StartedAt) : query.OrderByDescending(e => e.StartedAt);
                        Console.WriteLine($"按開始時間排序: {sortOrder}");
                        break;
                    case "duration":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(e => e.Duration) : query.OrderByDescending(e => e.Duration);
                        Console.WriteLine($"按執行時間排序: {sortOrder}");
                        break;
                    case "createdby":
                        query = sortOrder.ToLower() == "asc" ? query.OrderBy(e => e.CreatedBy) : query.OrderByDescending(e => e.CreatedBy);
                        Console.WriteLine($"按創建者排序: {sortOrder}");
                        break;
                    default:
                        query = query.OrderByDescending(e => e.StartedAt);
                        Console.WriteLine($"使用預設排序: 按開始時間降序");
                        break;
                }

                // 分頁
                var instances = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new
                    {
                        e.Id,
                        workflowName = e.WorkflowDefinition.Name,
                        e.Status,
                        currentStep = e.CurrentStep,
                        stepCount = e.StepExecutions != null ? e.StepExecutions.Count : 0,
                        e.StartedAt,
                        e.EndedAt,
                        duration = e.EndedAt.HasValue ? 
                            (int?)(e.EndedAt.Value - e.StartedAt).TotalMinutes : null,
                        e.CreatedBy,
                        e.InitiatedBy,
                        e.ErrorMessage,
                        e.InputJson  // 添加 InputJson 字段
                    })
                    .ToListAsync();

                return Ok(new
                {
                    data = instances,
                    total = total,
                    page = page,
                    pageSize = pageSize
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/workflowexecutions/monitor/statistics
        [HttpGet("monitor/statistics")]
        public async Task<IActionResult> GetMonitorStatistics()
        {
            try
            {
                // 檢查數據庫中是否有數據
                var total = await _db.WorkflowExecutions.CountAsync();
                
                if (total == 0)
                {
                    // 如果沒有數據，返回默認值
                    return Ok(new
                    {
                        total = 0,
                        running = 0,
                        completed = 0,
                        failed = 0,
                        waiting = 0,
                        successRate = 0,
                        averageExecutionTime = 0
                    });
                }

                // 獲取所有可能的狀態值
                var allStatuses = await _db.WorkflowExecutions
                    .Select(e => e.Status)
                    .Distinct()
                    .ToListAsync();

                // 動態計算各種狀態的數量
                // running 包含所有運行中的狀態，包括 Waiting、WaitingForQRCode、WaitingForFormApproval 等
                // 因為這些狀態表示流程仍在運行中，只是在等待用戶輸入
                var running = await _db.WorkflowExecutions.CountAsync(e => 
                    e.Status != null && (e.Status.ToLower().Contains("run") || e.Status.ToLower().Contains("wait")));
                var completed = await _db.WorkflowExecutions.CountAsync(e => 
                    e.Status != null && e.Status.ToLower().Contains("complete"));
                var failed = await _db.WorkflowExecutions.CountAsync(e => 
                    e.Status != null && e.Status.ToLower().Contains("fail"));
                // waiting 不再單獨計算，因為已經包含在 running 中
                var waiting = 0;

                var successRate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0;

                // 計算平均執行時間，處理可能的空值
                double averageExecutionTime = 0;
                try
                {
                    var completedExecutions = await _db.WorkflowExecutions
                        .Where(e => e.Status != null && e.Status.ToLower().Contains("complete") && e.EndedAt.HasValue)
                        .Select(e => new { e.StartedAt, e.EndedAt })
                        .ToListAsync();

                    if (completedExecutions.Any())
                    {
                        var totalMinutes = completedExecutions
                            .Select(e => (e.EndedAt.Value - e.StartedAt).TotalMinutes)
                            .Where(minutes => minutes >= 0)
                            .ToList();

                        if (totalMinutes.Any())
                        {
                            averageExecutionTime = Math.Round(totalMinutes.Average(), 1);
                        }
                    }
                }
                catch (Exception ex)
                {
                    // 如果計算平均時間失敗，記錄錯誤但繼續執行
                    _loggingService.LogError($"計算平均執行時間時出錯: {ex.Message}");
                    averageExecutionTime = 0;
                }

                return Ok(new
                {
                    total,
                    running,
                    completed,
                    failed,
                    waiting,
                    successRate,
                    averageExecutionTime,
                    debug = new
                    {
                        allStatuses = allStatuses,
                        message = "統計計算完成"
                    }
                });
            }
            catch (Exception ex)
            {
                // 返回詳細的錯誤信息以便調試
                return BadRequest(new { 
                    error = ex.Message,
                    stackTrace = ex.StackTrace,
                    innerException = ex.InnerException?.Message
                });
            }
        }

        // GET: api/workflowexecutions/{id}/images
        [HttpGet("{id}/images")]
        public async Task<IActionResult> GetExecutionImages(int id)
        {
            try
            {
                // 檢查流程實例是否存在
                var execution = await _db.WorkflowExecutions.FindAsync(id);
                if (execution == null)
                {
                    return NotFound(new { error = "Workflow execution not found" });
                }

                // 根據流程實例 ID 查找對應的圖片目錄
                // 假設圖片存儲在 Uploads/Whatsapp_Images/{executionId}/ 目錄中
                var imagesDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Whatsapp_Images", id.ToString());
                
                if (!Directory.Exists(imagesDirectory))
                {
                    return Ok(new { data = new List<object>() });
                }

                var imageFiles = Directory.GetFiles(imagesDirectory)
                    .Where(file => IsImageFile(file))
                    .Select(file => new
                    {
                        id = Path.GetFileNameWithoutExtension(file),
                        filename = Path.GetFileName(file),
                        url = $"/Uploads/Whatsapp_Images/{id}/{Path.GetFileName(file)}",
                        size = new FileInfo(file).Length,
                        receivedAt = System.IO.File.GetCreationTime(file),
                        status = GetImageStatusFromFilename(Path.GetFileName(file))
                    })
                    .OrderByDescending(img => img.receivedAt)
                    .ToList();

                return Ok(new { data = imageFiles });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程實例圖片時出錯: {ex.Message}");
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/workflowexecutions/{id}/media-files
        [HttpGet("{id}/media-files")]
        public async Task<IActionResult> GetExecutionMediaFiles(int id)
        {
            try
            {
                // 檢查流程實例是否存在
                var execution = await _db.WorkflowExecutions.FindAsync(id);
                if (execution == null)
                {
                    return NotFound(new { error = "Workflow execution not found" });
                }

                var mediaFiles = new List<object>();

                // 檢查多個可能的媒體文件目錄
                var possibleDirectories = new[]
                {
                    Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Whatsapp_Images", id.ToString()),
                    Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Whatsapp_Videos", id.ToString()),
                    Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Whatsapp_Documents", id.ToString()),
                    Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Whatsapp_Audio", id.ToString()),
                    Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Workflow_Media", id.ToString())
                };

                foreach (var directory in possibleDirectories)
                {
                    if (Directory.Exists(directory))
                    {
                        var folderName = Path.GetFileName(Path.GetDirectoryName(directory)) ?? "root";
                        var files = Directory.GetFiles(directory)
                            .Where(file => IsMediaFile(file) && !file.EndsWith(".metadata.json"))
                            .Select(file =>
                            {
                                var fileName = Path.GetFileName(file);
                                var fileBaseName = Path.GetFileNameWithoutExtension(file);
                                var metadataPath = Path.Combine(directory, fileBaseName + ".metadata.json");
                                string? originalFileName = null;
                                string? mimeType = null;
                                
                                // 嘗試讀取元數據文件
                                if (System.IO.File.Exists(metadataPath))
                                {
                                    try
                                    {
                                        var metadataJson = System.IO.File.ReadAllText(metadataPath);
                                        var metadata = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(metadataJson);
                                        if (metadata.TryGetProperty("originalFileName", out var originalFileNameElement))
                                        {
                                            originalFileName = originalFileNameElement.GetString();
                                        }
                                        if (metadata.TryGetProperty("mimeType", out var mimeTypeElement))
                                        {
                                            mimeType = mimeTypeElement.GetString();
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        _loggingService.LogWarning($"讀取元數據文件失敗: {metadataPath}, 錯誤: {ex.Message}");
                                    }
                                }
                                
                                return new
                                {
                                    id = fileBaseName,
                                    fileName = fileName,
                                    originalFileName = originalFileName,
                                    filePath = file.Replace(Directory.GetCurrentDirectory(), "").Replace("\\", "/"),
                                    fileSize = new FileInfo(file).Length,
                                    createdAt = System.IO.File.GetCreationTime(file),
                                    folderPath = folderName,
                                    fileType = GetFileType(file),
                                    mimeType = mimeType
                                };
                            })
                            .OrderByDescending(file => file.createdAt)
                            .ToList();

                        mediaFiles.AddRange(files);
                    }
                }

                return Ok(new { data = mediaFiles });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程實例媒體文件時出錯: {ex.Message}");
                return BadRequest(new { error = ex.Message });
            }
        }

        private bool IsImageFile(string filePath)
        {
            var imageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp" };
            var extension = Path.GetExtension(filePath).ToLowerInvariant();
            return imageExtensions.Contains(extension);
        }

        private bool IsMediaFile(string filePath)
        {
            var mediaExtensions = new[] { 
                // 圖片
                ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".tiff", ".ico",
                // 視頻
                ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mkv", ".m4v", ".3gp",
                // 音頻
                ".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a", ".wma",
                // 文檔
                ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf"
            };
            var extension = Path.GetExtension(filePath).ToLowerInvariant();
            return mediaExtensions.Contains(extension);
        }

        private string GetFileType(string filePath)
        {
            var extension = Path.GetExtension(filePath).ToLowerInvariant();
            
            var imageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".tiff", ".ico" };
            var videoExtensions = new[] { ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mkv", ".m4v", ".3gp" };
            var audioExtensions = new[] { ".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a", ".wma" };
            
            if (imageExtensions.Contains(extension))
                return "image";
            else if (videoExtensions.Contains(extension))
                return "video";
            else if (audioExtensions.Contains(extension))
                return "audio";
            else
                return "document";
        }

        private string GetImageStatusFromFilename(string filename)
        {
            // 根據文件名判斷狀態，例如：20250929221838_1423145165457_187_Failed.jpg
            if (filename.Contains("_Success"))
                return "Success";
            else if (filename.Contains("_Failed"))
                return "Failed";
            else if (filename.Contains("_Processing"))
                return "Processing";
            else
                return "Pending";
        }

        // 從 WorkflowEngineController 合併的統計信息方法
        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics()
        {
            try
            {
                _loggingService.LogInformation("獲取工作流程引擎統計信息");

                var totalWorkflows = await _db.WorkflowDefinitions.CountAsync();
                var activeWorkflows = await _db.WorkflowDefinitions.CountAsync(w => w.Status == "Active" || w.Status == "啟用");
                var totalExecutions = await _db.WorkflowExecutions.CountAsync();
                var runningExecutions = await _db.WorkflowExecutions.CountAsync(e => e.Status == "Running");
                var completedExecutions = await _db.WorkflowExecutions.CountAsync(e => e.Status == "Completed");
                var failedExecutions = await _db.WorkflowExecutions.CountAsync(e => e.Status == "Failed");

                var statistics = new
                {
                    totalWorkflows = totalWorkflows,
                    activeWorkflows = activeWorkflows,
                    totalExecutions = totalExecutions,
                    runningExecutions = runningExecutions,
                    completedExecutions = completedExecutions,
                    failedExecutions = failedExecutions
                };

                _loggingService.LogInformation($"成功獲取統計信息: 工作流程 {totalWorkflows}, 執行記錄 {totalExecutions}");
                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取統計信息失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取統計信息失敗" });
            }
        }

        /// <summary>
        /// 獲取熱門工作流程 Top N
        /// </summary>
        [HttpGet("top-workflows")]
        public async Task<IActionResult> GetTopWorkflows([FromQuery] int limit = 5)
        {
            try
            {
                _loggingService.LogInformation($"📊 獲取 Top {limit} 熱門工作流程");

                var topWorkflows = await _db.WorkflowExecutions
                    .GroupBy(e => new { e.WorkflowDefinitionId, e.WorkflowDefinition.Name })
                    .Select(g => new
                    {
                        workflowId = g.Key.WorkflowDefinitionId,
                        workflowName = g.Key.Name ?? "未命名工作流程",
                        executionCount = g.Count(),
                        successCount = g.Count(e => e.Status != null && e.Status.ToLower().Contains("complete")),
                        failedCount = g.Count(e => e.Status != null && e.Status.ToLower().Contains("fail"))
                    })
                    .OrderByDescending(w => w.executionCount)
                    .Take(limit)
                    .ToListAsync();

                _loggingService.LogInformation($"✅ 成功獲取 {topWorkflows.Count} 個熱門工作流程");
                return Ok(topWorkflows);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 獲取熱門工作流程失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取熱門工作流程失敗" });
            }
        }

        // GET: api/workflowexecutions/{id}/details
        [HttpGet("{id}/details")]
        public async Task<IActionResult> GetInstanceDetails(int id)
        {
            try
            {
                var instance = await _db.WorkflowExecutions
                    .Include(e => e.WorkflowDefinition)
                    .Include(e => e.StepExecutions)
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (instance == null)
                {
                    return NotFound(new { error = "實例不存在" });
                }

                var details = new
                {
                    instance.Id,
                    workflowName = instance.WorkflowDefinition.Name,
                    instance.Status,
                    instance.CurrentStep,
                    instance.StartedAt,
                    instance.EndedAt,
                    duration = instance.EndedAt.HasValue ? 
                        (int?)(instance.EndedAt.Value - instance.StartedAt).TotalMinutes : null,
                    instance.CreatedBy,
                    instance.ErrorMessage,
                    stepExecutions = instance.StepExecutions?.Select(s => new
                    {
                        s.Id,
                        stepIndex = s.StepIndex, // 添加步驟索引，用於匹配 message_validations
                        stepName = s.TaskName ?? s.StepType, // 優先使用 TaskName，否則使用 StepType
                        stepType = s.StepType, // 添加節點類型字段
                        taskName = s.TaskName, // 添加任務名稱字段
                        s.Status,
                        s.StartedAt,
                        endedAt = s.EndedAt,
                        completedAt = s.EndedAt,
                        errorMessage = s.OutputJson,
                        outputJson = s.OutputJson,
                        output = s.OutputJson
                    }).ToList()
                };

                return Ok(details);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // POST: api/workflowexecutions/{id}/pause
        [HttpPost("{id}/pause")]
        public async Task<IActionResult> PauseInstance(int id)
        {
            try
            {
                var instance = await _db.WorkflowExecutions.FindAsync(id);
                if (instance == null)
                {
                    return NotFound(new { error = "實例不存在" });
                }

                instance.Status = "Paused";
                await _db.SaveChangesAsync();

                return Ok(new { message = "實例已暫停" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // POST: api/workflowexecutions/{id}/resume
        [HttpPost("{id}/resume")]
        public async Task<IActionResult> ResumeInstance(int id)
        {
            try
            {
                var instance = await _db.WorkflowExecutions.FindAsync(id);
                if (instance == null)
                {
                    return NotFound(new { error = "實例不存在" });
                }

                instance.Status = "Running";
                await _db.SaveChangesAsync();

                return Ok(new { message = "實例已恢復" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // POST: api/workflowexecutions/{id}/cancel
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelInstance(int id)
        {
            try
            {
                var instance = await _db.WorkflowExecutions.FindAsync(id);
                if (instance == null)
                {
                    return NotFound(new { error = "實例不存在" });
                }

                instance.Status = "Cancelled";
                instance.EndedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                return Ok(new { message = "實例已取消" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // DELETE: api/workflowexecutions/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteInstance(int id)
        {
            _loggingService.LogInformation($"準備刪除工作流程實例 ID: {id}");

            var execution = await _db.WorkflowExecutions
                .Include(e => e.WorkflowDefinition)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (execution == null)
            {
                return NotFound(new { error = "實例不存在" });
            }

            IDbContextTransaction transaction = null;
            try
            {
                transaction = await _db.Database.BeginTransactionAsync();

                var messageSends = await _db.WorkflowMessageSends
                    .Where(ms => ms.WorkflowExecutionId == id)
                    .Include(ms => ms.Recipients)
                    .ToListAsync();

                if (messageSends.Count > 0)
                {
                    foreach (var send in messageSends)
                    {
                        if (send.Recipients != null && send.Recipients.Count > 0)
                        {
                            _db.WorkflowMessageRecipients.RemoveRange(send.Recipients);
                        }
                    }
                    _db.WorkflowMessageSends.RemoveRange(messageSends);
                }

                var stepExecutions = await _db.WorkflowStepExecutions
                    .Where(se => se.WorkflowExecutionId == id)
                    .ToListAsync();
                if (stepExecutions.Count > 0)
                {
                    _db.WorkflowStepExecutions.RemoveRange(stepExecutions);
                }

                var messageValidations = await _db.MessageValidations
                    .Where(mv => mv.WorkflowExecutionId == id)
                    .ToListAsync();
                if (messageValidations.Count > 0)
                {
                    _db.MessageValidations.RemoveRange(messageValidations);
                }

                var processVariableValues = await _db.ProcessVariableValues
                    .Where(pv => pv.WorkflowExecutionId == id)
                    .ToListAsync();
                if (processVariableValues.Count > 0)
                {
                    _db.ProcessVariableValues.RemoveRange(processVariableValues);
                }

                var dataSetResults = await _db.WorkflowDataSetQueryResults
                    .Where(r => r.WorkflowExecutionId == id)
                    .ToListAsync();
                if (dataSetResults.Count > 0)
                {
                    var resultIds = dataSetResults.Select(r => r.Id).ToList();
                    var dataSetRecords = await _db.WorkflowDataSetQueryRecords
                        .Where(r => resultIds.Contains(r.QueryResultId))
                        .ToListAsync();
                    if (dataSetRecords.Count > 0)
                    {
                        _db.WorkflowDataSetQueryRecords.RemoveRange(dataSetRecords);
                    }

                    _db.WorkflowDataSetQueryResults.RemoveRange(dataSetResults);
                }

                var eformInstanceIds = await _db.EFormInstances
                    .Where(e => e.WorkflowExecutionId == id)
                    .Select(e => e.Id)
                    .ToListAsync();

                if (eformInstanceIds.Count > 0)
                {
                    var approvals = await _db.EFormApprovals
                        .Where(a => eformInstanceIds.Contains(a.EFormInstanceId))
                        .ToListAsync();
                    if (approvals.Count > 0)
                    {
                        _db.EFormApprovals.RemoveRange(approvals);
                    }

                    var eformInstances = await _db.EFormInstances
                        .Where(e => eformInstanceIds.Contains(e.Id))
                        .ToListAsync();
                    if (eformInstances.Count > 0)
                    {
                        _db.EFormInstances.RemoveRange(eformInstances);
                    }
                }

                var sessions = await _db.UserSessions
                    .Where(us => us.CurrentWorkflowExecutionId == id)
                    .ToListAsync();
                foreach (var session in sessions)
                {
                    session.CurrentWorkflowExecutionId = null;
                }

                // 嘗試清理 WhatsApp 訊息（表格可能不存在）
                try
                {
                    var whatsappMessages = await _db.WhatsAppMessages
                        .Where(m => m.WorkflowExecutionId == id)
                        .ToListAsync();

                    if (whatsappMessages.Count > 0)
                    {
                        foreach (var message in whatsappMessages)
                        {
                            message.WorkflowExecutionId = null;
                        }
                    }
                }
                catch (SqlException sqlEx) when (sqlEx.Number == 208)
                {
                    _loggingService.LogWarning($"刪除工作流程實例 {id} 時忽略 WhatsApp 訊息清理：{sqlEx.Message}");
                }
                _db.WorkflowExecutions.Remove(execution);

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                _loggingService.LogInformation($"工作流程實例 {id} 刪除完成");
                return Ok(new { message = "實例已刪除" });
            }
            catch (Exception ex)
            {
                if (transaction != null)
                {
                    await transaction.RollbackAsync();
                }
                _loggingService.LogError($"刪除工作流程實例 {id} 失敗: {ex.Message}", ex);
                return BadRequest(new { error = $"刪除實例失敗: {ex.Message}" });
            }
            finally
            {
                if (transaction != null)
                {
                    await transaction.DisposeAsync();
                }
            }
        }

        // POST: api/workflowexecutions/{id}/retry
        [HttpPost("{id}/retry")]
        public async Task<IActionResult> RetryInstance(int id)
        {
            try
            {
                var instance = await _db.WorkflowExecutions.FindAsync(id);
                if (instance == null)
                {
                    return NotFound(new { error = "實例不存在" });
                }

                if (instance.Status != "Failed")
                {
                    return BadRequest(new { error = "只有失敗的實例才能重試" });
                }

                // 創建新的重試實例
                var retryInstance = new WorkflowExecution
                {
                    WorkflowDefinitionId = instance.WorkflowDefinitionId,
                    Status = "Running",
                    StartedAt = DateTime.UtcNow,
                    CreatedBy = instance.CreatedBy,
                    InputJson = instance.InputJson // 使用 InputJson 而不是 Input
                };

                _db.WorkflowExecutions.Add(retryInstance);
                await _db.SaveChangesAsync();

                return Ok(new { message = "重試實例已創建", instanceId = retryInstance.Id });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/workflowexecutions/{id}/eform-instances
        [HttpGet("{id}/eform-instances")]
        public async Task<IActionResult> GetEformInstances(int id)
        {
            try
            {
                _loggingService.LogInformation($"正在查找工作流程實例 ID: {id} 的表單實例");
                
                // 檢查工作流程實例是否存在
                var workflowInstance = await _db.WorkflowExecutions.FindAsync(id);
                if (workflowInstance == null)
                {
                    _loggingService.LogWarning($"工作流程實例 ID: {id} 不存在");
                    return NotFound(new { error = "工作流程實例不存在" });
                }
                
                _loggingService.LogInformation($"找到工作流程實例: {workflowInstance.Id}, 狀態: {workflowInstance.Status}");

                // 查找與此工作流程實例相關的表單實例
                var eformInstances = await _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .Where(e => e.WorkflowExecutionId == id)
                    .Select(e => new
                    {
                        e.Id,
                        formName = e.EFormDefinition != null ? e.EFormDefinition.Name : "未命名表單",
                        e.InstanceName,
                        e.Status,
                        e.CreatedAt,
                        e.UserMessage,
                        e.ApprovalBy,
                        e.ApprovalAt,
                        e.ApprovalNote
                    })
                    .ToListAsync();
                
                _loggingService.LogInformation($"找到 {eformInstances.Count} 個表單實例");

                return Ok(eformInstances);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取表單實例時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤詳情: {ex.StackTrace}");
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/workflowexecutions/step/{stepExecutionId}/data-set-query-result
        [HttpGet("step/{stepExecutionId}/data-set-query-result")]
        public async Task<IActionResult> GetDataSetQueryResult(int stepExecutionId)
        {
            try
            {
                _loggingService.LogInformation($"正在查找步驟執行 ID: {stepExecutionId} 的數據集查詢結果");
                
                // 查找數據集查詢結果
                var queryResult = await _db.WorkflowDataSetQueryResults
                    .Where(r => r.StepExecutionId == stepExecutionId)
                    .OrderByDescending(r => r.ExecutedAt)
                    .FirstOrDefaultAsync();
                
                if (queryResult == null)
                {
                    _loggingService.LogWarning($"步驟執行 ID: {stepExecutionId} 沒有找到數據集查詢結果");
                    return NotFound(new { error = "沒有找到數據集查詢結果" });
                }
                
                _loggingService.LogInformation($"找到數據集查詢結果: StepExecutionId={queryResult.StepExecutionId}, TotalRecords={queryResult.TotalRecords}");

                return Ok(new
                {
                    stepExecutionId = queryResult.StepExecutionId,
                    queryResult = queryResult.QueryResult,
                    queryType = queryResult.OperationType,
                    recordCount = queryResult.TotalRecords,
                    executionTime = queryResult.ExecutedAt,
                    executedAt = queryResult.ExecutedAt
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取數據集查詢結果時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤詳情: {ex.StackTrace}");
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/workflowexecutions/execution-counts
        [HttpGet("execution-counts")]
        public async Task<IActionResult> GetExecutionCounts()
        {
            try
            {
                _loggingService.LogInformation("開始獲取工作流程執行統計數據");

                // 先檢查是否有 WorkflowExecutions 數據
                var totalExecutions = await _db.WorkflowExecutions.CountAsync();
                _loggingService.LogInformation($"數據庫中總共有 {totalExecutions} 個工作流程執行記錄");

                if (totalExecutions == 0)
                {
                    _loggingService.LogInformation("沒有工作流程執行記錄，返回空統計");
                    return Ok(new Dictionary<string, int>());
                }

                // 獲取所有執行記錄的狀態分佈
                var statusCounts = await _db.WorkflowExecutions
                    .GroupBy(we => we.Status)
                    .Select(g => new { Status = g.Key, Count = g.Count() })
                    .ToListAsync();
                
                _loggingService.LogInformation($"執行記錄狀態分佈: {string.Join(", ", statusCounts.Select(s => $"{s.Status}: {s.Count}"))}");

                // 獲取統計數據 - 包含所有狀態的執行記錄
                var statisticsData = await _db.WorkflowExecutions
                    .GroupBy(we => we.WorkflowDefinitionId)
                    .Select(g => new { 
                        WorkflowDefinitionId = g.Key, 
                        ExecutionCount = g.Count(),
                        Statuses = g.Select(x => x.Status).ToList()
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {statisticsData.Count} 個工作流程的執行記錄");

                var statistics = statisticsData.ToDictionary(x => x.WorkflowDefinitionId.ToString(), x => x.ExecutionCount);
                
                // 記錄每個工作流程的詳細信息
                foreach (var item in statisticsData)
                {
                    _loggingService.LogInformation($"工作流程 {item.WorkflowDefinitionId}: 執行次數 {item.ExecutionCount}, 狀態: {string.Join(", ", item.Statuses)}");
                }

                _loggingService.LogInformation($"成功獲取 {statistics.Count} 個工作流程的執行統計數據");

                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取執行統計時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤詳情: {ex.StackTrace}");
                return StatusCode(500, new { error = "獲取執行統計失敗", details = ex.Message });
            }
        }

        // GET: api/workflowexecutions/initiators
        [HttpGet("initiators")]
        public async Task<IActionResult> GetInitiators()
        {
            try
            {
                _loggingService.LogInformation("開始獲取流程啟動人列表");

                // 獲取所有唯一的 InitiatedBy 值，並包含相關信息
                var initiators = await _db.WorkflowExecutions
                    .Where(we => !string.IsNullOrEmpty(we.InitiatedBy))
                    .GroupBy(we => we.InitiatedBy)
                    .Select(g => new
                    {
                        id = g.Key,
                        phone = g.Key,
                        name = g.Key, // 暫時使用電話號碼作為名稱，實際可以根據電話號碼查詢用戶信息
                        initiatedAt = g.Max(we => we.StartedAt),
                        executionCount = g.Count()
                    })
                    .OrderByDescending(x => x.initiatedAt)
                    .ToListAsync();

                _loggingService.LogInformation($"成功獲取 {initiators.Count} 個流程啟動人");

                return Ok(new { data = initiators });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程啟動人時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤詳情: {ex.StackTrace}");
                return StatusCode(500, new { error = "獲取流程啟動人失敗", details = ex.Message });
            }
        }

        // GET: api/workflowexecutions/{id}/message-validations
        [HttpGet("{id}/message-validations")]
        public async Task<IActionResult> GetMessageValidations(int id)
        {
            try
            {
                _loggingService.LogInformation($"開始獲取實例 {id} 的消息驗證記錄");

                var validations = await _db.MessageValidations
                    .Where(mv => mv.WorkflowExecutionId == id)
                    .OrderBy(mv => mv.CreatedAt)
                    .Select(mv => new
                    {
                        id = mv.Id,
                        stepIndex = mv.StepIndex,
                        userWaId = mv.UserWaId,
                        userMessage = mv.UserMessage,
                        messageType = mv.MessageType,
                        mediaId = mv.MediaId,
                        mediaUrl = mv.MediaUrl,
                        isValid = mv.IsValid,
                        errorMessage = mv.ErrorMessage,
                        validatorType = mv.ValidatorType,
                        processedData = mv.ProcessedData,
                        createdAt = mv.CreatedAt
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"成功獲取 {validations.Count} 條消息驗證記錄");

                return Ok(new { data = validations });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取消息驗證記錄時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤詳情: {ex.StackTrace}");
                return StatusCode(500, new { error = "獲取消息驗證記錄失敗", details = ex.Message });
            }
        }

        // GET: api/workflowexecutions/step/{stepExecutionId}/message-send-id
        [HttpGet("step/{stepExecutionId}/message-send-id")]
        public async Task<IActionResult> GetMessageSendIdByStepExecutionId(int stepExecutionId)
        {
            try
            {
                _loggingService.LogInformation($"=== 開始查找消息發送記錄 ===");
                _loggingService.LogInformation($"步驟執行ID: {stepExecutionId}");

                // 先檢查步驟執行記錄是否存在
                var stepExecution = await _db.WorkflowStepExecutions
                    .FirstOrDefaultAsync(se => se.Id == stepExecutionId);
                
                if (stepExecution == null)
                {
                    _loggingService.LogWarning($"找不到步驟執行記錄，ID: {stepExecutionId}");
                    return NotFound(new { error = "找不到步驟執行記錄", stepExecutionId });
                }
                
                _loggingService.LogInformation($"步驟執行記錄: ExecutionId={stepExecution.WorkflowExecutionId}, StepType={stepExecution.StepType}, TaskName={stepExecution.TaskName}");

                // 查詢該步驟的消息發送記錄
                _loggingService.LogInformation($"開始查詢 workflow_message_sends 表...");
                
                var allMessageSends = await _db.WorkflowMessageSends
                    .Where(ms => ms.WorkflowExecutionId == stepExecution.WorkflowExecutionId)
                    .ToListAsync();
                    
                _loggingService.LogInformation($"該 execution 總共有 {allMessageSends.Count} 條消息發送記錄");
                
                var messageSend = allMessageSends
                    .Where(ms => ms.WorkflowStepExecutionId == stepExecutionId)
                    .OrderByDescending(ms => ms.CreatedAt)
                    .FirstOrDefault();

                if (messageSend == null)
                {
                    _loggingService.LogWarning($"找不到 WorkflowStepExecutionId={stepExecutionId} 的消息發送記錄");
                    _loggingService.LogInformation($"該 execution 的所有消息發送記錄：");
                    foreach (var ms in allMessageSends)
                    {
                        _loggingService.LogInformation($"  - Id={ms.Id}, StepExecutionId={ms.WorkflowStepExecutionId}, NodeType={ms.NodeType}, CreatedAt={ms.CreatedAt}");
                    }
                    return NotFound(new { error = "找不到消息發送記錄", stepExecutionId, hint = "該步驟可能沒有發送消息" });
                }

                _loggingService.LogInformation($"✅ 成功找到消息發送ID: {messageSend.Id}");

                return Ok(new { messageSendId = messageSend.Id });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 根據步驟執行ID查找消息發送記錄時發生錯誤: {ex.Message}");
                _loggingService.LogError($"錯誤類型: {ex.GetType().FullName}");
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}");
                
                // 記錄內部異常
                var innerEx = ex.InnerException;
                int level = 1;
                while (innerEx != null)
                {
                    _loggingService.LogError($"InnerException (Level {level}): {innerEx.Message}");
                    _loggingService.LogError($"InnerException Type (Level {level}): {innerEx.GetType().FullName}");
                    innerEx = innerEx.InnerException;
                    level++;
                }
                
                return StatusCode(500, new { error = "查找消息發送記錄失敗", details = ex.Message, type = ex.GetType().Name });
            }
        }

        // GET: api/workflowexecutions/steps/monitor
        [HttpGet("steps/monitor")]
        public async Task<IActionResult> GetStepExecutionsMonitor(
            int? workflowDefinitionId = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            try
            {
                _loggingService.LogInformation($"=== 開始獲取步驟執行記錄（包含已完成和未完成的）===");
                _loggingService.LogInformation($"WorkflowDefinitionId: {workflowDefinitionId?.ToString() ?? "All"}");
                _loggingService.LogInformation($"StartDate: {startDate?.ToString() ?? "All"}");
                _loggingService.LogInformation($"EndDate: {endDate?.ToString() ?? "All"}");

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                // 查詢步驟執行記錄（包含已完成和未完成的，但排除已取消的）
                var query = _db.WorkflowStepExecutions
                    .Include(se => se.WorkflowExecution)
                        .ThenInclude(we => we.WorkflowDefinition)
                    .Where(se => se.WorkflowExecution.WorkflowDefinition.CompanyId == companyId.Value)
                    .Where(se => se.Status != null && 
                                 !se.Status.ToLower().Contains("cancelled") &&
                                 se.Status != "");

                // 如果指定了 workflowDefinitionId，則過濾
                if (workflowDefinitionId.HasValue)
                {
                    query = query.Where(se => se.WorkflowExecution.WorkflowDefinitionId == workflowDefinitionId.Value);
                }

                // 日期範圍過濾（基於 StartedAt）
                if (startDate.HasValue)
                {
                    var localStartDate = startDate.Value.ToLocalTime().Date;
                    query = query.Where(se => se.StartedAt.HasValue && se.StartedAt.Value >= localStartDate);
                }
                if (endDate.HasValue)
                {
                    var localEndDate = endDate.Value.ToLocalTime().Date.AddDays(1).AddTicks(-1);
                    query = query.Where(se => se.StartedAt.HasValue && se.StartedAt.Value <= localEndDate);
                }

                var stepExecutionsData = await query
                    .OrderByDescending(se => se.StartedAt ?? DateTime.UtcNow)
                    .Select(se => new
                    {
                        id = se.Id,
                        workflowExecutionId = se.WorkflowExecutionId,
                        workflowName = se.WorkflowExecution.WorkflowDefinition.Name,
                        workflowDefinitionId = se.WorkflowExecution.WorkflowDefinitionId,
                        stepIndex = se.StepIndex,
                        stepType = se.StepType,
                        taskName = se.TaskName,
                        status = se.Status,
                        startedAt = se.StartedAt,
                        endedAt = se.EndedAt,
                        isWaiting = se.IsWaiting,
                        waitingForUser = se.WaitingForUser,
                        initiatedBy = se.WorkflowExecution.InitiatedBy,
                        executionStatus = se.WorkflowExecution.Status,
                        inputJson = se.InputJson,
                        outputJson = se.OutputJson
                    })
                    .ToListAsync();

                // 獲取所有步驟執行的唯一組合（workflowExecutionId + stepIndex），用於精確匹配消息驗證記錄
                var workflowExecutionIds = stepExecutionsData.Select(se => se.workflowExecutionId).Distinct().ToList();
                var stepIndices = stepExecutionsData.Select(se => se.stepIndex).Distinct().ToList();
                
                // 批量查詢所有相關的消息驗證記錄（必須同時匹配 workflowExecutionId 和 stepIndex）
                // 先查詢所有相關的 workflowExecutionId，然後在內存中過濾 stepIndex
                var allMessageValidations = await _db.MessageValidations
                    .Where(mv => workflowExecutionIds.Contains(mv.WorkflowExecutionId) && stepIndices.Contains(mv.StepIndex))
                    .OrderBy(mv => mv.CreatedAt)
                    .Select(mv => new
                    {
                        workflowExecutionId = mv.WorkflowExecutionId,
                        stepIndex = mv.StepIndex,
                        id = mv.Id,
                        userMessage = mv.UserMessage,
                        messageType = mv.MessageType,
                        mediaUrl = mv.MediaUrl,
                        isValid = mv.IsValid,
                        processedData = mv.ProcessedData,
                        createdAt = mv.CreatedAt
                    })
                    .ToListAsync();
                
                // 進一步過濾：只保留與步驟執行記錄完全匹配的消息驗證記錄
                var stepExecutionKeys = stepExecutionsData
                    .Select(se => $"{se.workflowExecutionId}_{se.stepIndex}")
                    .ToHashSet();
                allMessageValidations = allMessageValidations
                    .Where(mv => stepExecutionKeys.Contains($"{mv.workflowExecutionId}_{mv.stepIndex}"))
                    .ToList();

                // 將消息驗證記錄按步驟分組（使用字符串鍵以便於查找）
                var messageValidationsByStep = allMessageValidations
                    .GroupBy(mv => $"{mv.workflowExecutionId}_{mv.stepIndex}")
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(mv => new
                        {
                            id = mv.id,
                            userMessage = mv.userMessage,
                            messageType = mv.messageType,
                            mediaUrl = mv.mediaUrl,
                            isValid = mv.isValid,
                            processedData = mv.processedData,
                            createdAt = mv.createdAt
                        }).ToList()
                    );

                // 合併步驟執行數據和消息驗證記錄（精確匹配 workflowExecutionId 和 stepIndex）
                var stepExecutions = stepExecutionsData.Select(se =>
                {
                    var key = $"{se.workflowExecutionId}_{se.stepIndex}";
                    object validations;
                    if (messageValidationsByStep.ContainsKey(key))
                    {
                        // 使用 JSON 序列化/反序列化來確保類型一致
                        var validationsJson = JsonSerializer.Serialize(messageValidationsByStep[key]);
                        validations = JsonSerializer.Deserialize<List<object>>(validationsJson) ?? new List<object>();
                    }
                    else
                    {
                        validations = new List<object>();
                    }
                    
                    return new
                    {
                        se.id,
                        se.workflowExecutionId,
                        se.workflowName,
                        se.workflowDefinitionId,
                        se.stepIndex,
                        se.stepType,
                        se.taskName,
                        se.status,
                        se.startedAt,
                        se.endedAt,
                        se.isWaiting,
                        se.waitingForUser,
                        se.initiatedBy,
                        se.executionStatus,
                        se.inputJson,
                        se.outputJson,
                        messageValidations = validations
                    };
                }).ToList();

                _loggingService.LogInformation($"✅ 成功獲取 {stepExecutions.Count} 個步驟執行記錄");

                return Ok(new { data = stepExecutions, total = stepExecutions.Count });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 獲取活躍步驟執行記錄失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取活躍步驟執行記錄失敗", details = ex.Message });
            }
        }

        private Guid? GetCurrentUserCompanyId()
        {
            var companyIdClaim = User.FindFirst("company_id");
            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out Guid companyId))
            {
                return companyId;
            }

            var userIdClaim = User.FindFirst("user_id");
            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out Guid userId))
            {
                var user = _db.Users.FirstOrDefault(u => u.Id == userId);
                if (user != null)
                {
                    return user.CompanyId;
                }
            }

            return null;
        }
    }

    public class WorkflowStartRequest
    {
        public int WorkflowDefinitionId { get; set; }
        public Dictionary<string, object> Input { get; set; }
    }

    // 從 WorkflowEngineController 合併的請求模型
    public class StartWorkflowRequest
    {
        public object InputData { get; set; }
    }
} 