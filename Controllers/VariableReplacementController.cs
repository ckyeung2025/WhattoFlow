using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using PurpleRice.Services;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VariableReplacementController : ControllerBase
    {
        private readonly IVariableReplacementService _variableReplacementService;
        private readonly ILogger<VariableReplacementController> _logger;

        public VariableReplacementController(
            IVariableReplacementService variableReplacementService,
            ILogger<VariableReplacementController> logger)
        {
            _variableReplacementService = variableReplacementService;
            _logger = logger;
        }

        [HttpPost("replace")]
        public async Task<IActionResult> ReplaceVariables([FromBody] VariableReplacementRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Text))
                {
                    return BadRequest(new { success = false, message = "Text is required" });
                }

                string result;
                if (request.WorkflowExecutionId.HasValue)
                {
                    result = await _variableReplacementService.ReplaceVariablesAsync(request.Text, request.WorkflowExecutionId.Value);
                }
                else if (request.Variables != null)
                {
                    result = await _variableReplacementService.ReplaceVariablesAsync(request.Text, request.Variables);
                }
                else
                {
                    return BadRequest(new { success = false, message = "Either WorkflowExecutionId or Variables must be provided" });
                }

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error replacing variables");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        [HttpPost("preview")]
        public async Task<IActionResult> PreviewVariables([FromBody] VariablePreviewRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Text))
                {
                    return BadRequest(new { success = false, message = "Text is required" });
                }

                // 使用示例變量進行預覽
                var sampleVariables = new Dictionary<string, object>
                {
                    { "userName", "張三" },
                    { "orderNumber", "ORD-2024-001" },
                    { "amount", 1500.50 },
                    { "isPaid", true },
                    { "orderDate", DateTime.Now }
                };

                var result = await _variableReplacementService.ReplaceVariablesAsync(request.Text, sampleVariables);

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error previewing variables");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }
    }

    public class VariableReplacementRequest
    {
        public string Text { get; set; }
        public int? WorkflowExecutionId { get; set; }
        public Dictionary<string, object> Variables { get; set; }
    }

    public class VariablePreviewRequest
    {
        public string Text { get; set; }
    }
}
