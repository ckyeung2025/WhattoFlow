using Microsoft.AspNetCore.Mvc;
using PurpleRice.Models;
using PurpleRice.Services;
using System.Linq;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowNodeTypesController : ControllerBase
    {
        private readonly LoggingService _loggingService;

        public WorkflowNodeTypesController(Func<string, LoggingService> loggingServiceFactory)
        {
            _loggingService = loggingServiceFactory("WorkflowNodeTypesController");
        }

        /// <summary>
        /// 獲取所有支援的節點類型
        /// </summary>
        [HttpGet]
        public IActionResult GetAll()
        {
            try
            {
                var nodeTypes = WorkflowNodeTypes.SupportedTypes.Values.Select(definition => new
                {
                    type = definition.Type,
                    label = definition.Label,
                    category = definition.Category,
                    description = definition.Description,
                    isImplemented = definition.IsImplemented,
                    hasExecution = definition.HasExecution,
                    defaultData = definition.DefaultData
                });

                _loggingService.LogInformation($"成功獲取節點類型列表，共 {nodeTypes.Count()} 個類型");
                return Ok(new
                {
                    success = true,
                    data = nodeTypes,
                    total = nodeTypes.Count()
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取節點類型列表時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取節點類型列表失敗" });
            }
        }

        /// <summary>
        /// 獲取特定節點類型的定義
        /// </summary>
        [HttpGet("{type}")]
        public IActionResult Get(string type)
        {
            try
            {
                var definition = WorkflowNodeTypes.GetDefinition(type);
                if (definition == null)
                {
                    _loggingService.LogWarning($"請求的節點類型不存在: {type}");
                    return NotFound(new { error = $"不支援的節點類型: {type}" });
                }

                _loggingService.LogInformation($"成功獲取節點類型定義: {type}");
                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        type = definition.Type,
                        label = definition.Label,
                        category = definition.Category,
                        description = definition.Description,
                        isImplemented = definition.IsImplemented,
                        hasExecution = definition.HasExecution,
                        defaultData = definition.DefaultData
                    }
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取節點類型定義時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取節點類型定義失敗" });
            }
        }

        /// <summary>
        /// 獲取按類別分組的節點類型
        /// </summary>
        [HttpGet("by-category")]
        public IActionResult GetByCategory()
        {
            try
            {
                var categories = WorkflowNodeTypes.SupportedTypes.Values
                    .GroupBy(d => d.Category)
                    .Select(g => new
                    {
                        category = g.Key,
                        nodeTypes = g.Select(d => new
                        {
                            type = d.Type,
                            label = d.Label,
                            description = d.Description,
                            isImplemented = d.IsImplemented,
                            hasExecution = d.HasExecution
                        })
                    });

                _loggingService.LogInformation($"成功獲取按類別分組的節點類型，共 {categories.Count()} 個類別");
                return Ok(new
                {
                    success = true,
                    data = categories
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取按類別分組的節點類型時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取按類別分組的節點類型失敗" });
            }
        }

        /// <summary>
        /// 檢查節點類型是否支援
        /// </summary>
        [HttpPost("validate")]
        public IActionResult Validate([FromBody] ValidateNodeTypeRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrEmpty(request.Type))
                {
                    _loggingService.LogWarning("驗證節點類型請求無效");
                    return BadRequest(new { error = "請求數據無效" });
                }

                var isSupported = WorkflowNodeTypes.IsSupported(request.Type);
                var definition = WorkflowNodeTypes.GetDefinition(request.Type);

                _loggingService.LogInformation($"驗證節點類型: {request.Type}, 支援: {isSupported}");
                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        type = request.Type,
                        isSupported = isSupported,
                        isImplemented = definition?.IsImplemented ?? false,
                        hasExecution = definition?.HasExecution ?? false,
                        definition = definition != null ? new
                        {
                            label = definition.Label,
                            category = definition.Category,
                            description = definition.Description
                        } : null
                    }
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"驗證節點類型時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = "驗證節點類型失敗" });
            }
        }

        /// <summary>
        /// 獲取節點類型的預設數據
        /// </summary>
        [HttpGet("{type}/default-data")]
        public IActionResult GetDefaultData(string type)
        {
            try
            {
                var definition = WorkflowNodeTypes.GetDefinition(type);
                if (definition == null)
                {
                    _loggingService.LogWarning($"請求的節點類型不存在: {type}");
                    return NotFound(new { error = $"不支援的節點類型: {type}" });
                }

                _loggingService.LogInformation($"成功獲取節點類型預設數據: {type}");
                return Ok(new
                {
                    success = true,
                    data = definition.DefaultData
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取節點類型預設數據時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取節點類型預設數據失敗" });
            }
        }
    }

    public class ValidateNodeTypeRequest
    {
        public string Type { get; set; } = string.Empty;
    }
} 