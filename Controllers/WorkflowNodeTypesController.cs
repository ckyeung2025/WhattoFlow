using Microsoft.AspNetCore.Mvc;
using PurpleRice.Models;
using System.Linq;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowNodeTypesController : ControllerBase
    {
        /// <summary>
        /// 獲取所有支援的節點類型
        /// </summary>
        [HttpGet]
        public IActionResult GetAll()
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

            return Ok(new
            {
                success = true,
                data = nodeTypes,
                total = nodeTypes.Count()
            });
        }

        /// <summary>
        /// 獲取特定節點類型的定義
        /// </summary>
        [HttpGet("{type}")]
        public IActionResult Get(string type)
        {
            var definition = WorkflowNodeTypes.GetDefinition(type);
            if (definition == null)
            {
                return NotFound(new { error = $"不支援的節點類型: {type}" });
            }

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

        /// <summary>
        /// 獲取按類別分組的節點類型
        /// </summary>
        [HttpGet("by-category")]
        public IActionResult GetByCategory()
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

            return Ok(new
            {
                success = true,
                data = categories
            });
        }

        /// <summary>
        /// 檢查節點類型是否支援
        /// </summary>
        [HttpPost("validate")]
        public IActionResult Validate([FromBody] ValidateNodeTypeRequest request)
        {
            var isSupported = WorkflowNodeTypes.IsSupported(request.Type);
            var definition = WorkflowNodeTypes.GetDefinition(request.Type);

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

        /// <summary>
        /// 獲取節點類型的預設數據
        /// </summary>
        [HttpGet("{type}/default-data")]
        public IActionResult GetDefaultData(string type)
        {
            var definition = WorkflowNodeTypes.GetDefinition(type);
            if (definition == null)
            {
                return NotFound(new { error = $"不支援的節點類型: {type}" });
            }

            return Ok(new
            {
                success = true,
                data = definition.DefaultData
            });
        }
    }

    public class ValidateNodeTypeRequest
    {
        public string Type { get; set; }
    }
} 