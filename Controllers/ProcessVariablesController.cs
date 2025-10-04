using Microsoft.AspNetCore.Mvc;
using PurpleRice.Models;
using PurpleRice.Services;
using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProcessVariablesController : ControllerBase
    {
        private readonly IProcessVariableService _processVariableService;
        private readonly LoggingService _loggingService;

        public ProcessVariablesController(IProcessVariableService processVariableService, Func<string, LoggingService> loggingServiceFactory)
        {
            _processVariableService = processVariableService;
            _loggingService = loggingServiceFactory("ProcessVariablesController");
        }

        #region 流程變量定義管理

        /// <summary>
        /// 獲取工作流的所有變量定義
        /// </summary>
        [HttpGet("definitions")]
        public async Task<IActionResult> GetVariableDefinitions([FromQuery] int workflowDefinitionId)
        {
            try
            {
                var definitions = await _processVariableService.GetVariableDefinitionsAsync(workflowDefinitionId);
                return Ok(new { success = true, data = definitions });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取變量定義失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }


        /// <summary>
        /// 獲取單個變量定義
        /// </summary>
        [HttpGet("definitions/detail/{id}")]
        public async Task<IActionResult> GetVariableDefinition(Guid id)
        {
            try
            {
                var definition = await _processVariableService.GetVariableDefinitionAsync(id);
                if (definition == null)
                {
                    return NotFound(new { success = false, message = "變量定義不存在" });
                }
                return Ok(new { success = true, data = definition });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取變量定義失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 創建變量定義
        /// </summary>
        [HttpPost("definitions")]
        public async Task<IActionResult> CreateVariableDefinition([FromBody] CreateVariableDefinitionRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { success = false, message = "請求數據無效", errors = ModelState });
                }

                var definition = new ProcessVariableDefinition
                {
                    WorkflowDefinitionId = request.WorkflowDefinitionId,
                    VariableName = request.VariableName,
                    DisplayName = request.DisplayName,
                    DataType = request.DataType,
                    Description = request.Description,
                    IsRequired = request.IsRequired,
                    DefaultValue = request.DefaultValue,
                    ValidationRules = request.ValidationRules,
                    JsonSchema = request.JsonSchema,
                    CreatedBy = request.CreatedBy ?? "system"
                };

                var result = await _processVariableService.CreateVariableDefinitionAsync(definition);
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"創建變量定義失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 更新變量定義
        /// </summary>
        [HttpPut("definitions/{id}")]
        public async Task<IActionResult> UpdateVariableDefinition(Guid id, [FromBody] UpdateVariableDefinitionRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { success = false, message = "請求數據無效", errors = ModelState });
                }

                var existing = await _processVariableService.GetVariableDefinitionAsync(id);
                if (existing == null)
                {
                    return NotFound(new { success = false, message = "變量定義不存在" });
                }

                existing.VariableName = request.VariableName;
                existing.DisplayName = request.DisplayName;
                existing.DataType = request.DataType;
                existing.Description = request.Description;
                existing.IsRequired = request.IsRequired;
                existing.DefaultValue = request.DefaultValue;
                existing.ValidationRules = request.ValidationRules;
                existing.JsonSchema = request.JsonSchema;
                existing.UpdatedBy = request.UpdatedBy ?? "system";

                var result = await _processVariableService.UpdateVariableDefinitionAsync(existing);
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新變量定義失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 刪除變量定義
        /// </summary>
        [HttpDelete("definitions/{id}")]
        public async Task<IActionResult> DeleteVariableDefinition(Guid id)
        {
            try
            {
                var result = await _processVariableService.DeleteVariableDefinitionAsync(id);
                if (!result)
                {
                    return NotFound(new { success = false, message = "變量定義不存在" });
                }
                return Ok(new { success = true, message = "刪除成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"刪除變量定義失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion

        #region 流程變量值管理

        /// <summary>
        /// 獲取工作流執行的所有變量值
        /// </summary>
        [HttpGet("values/{workflowExecutionId}")]
        public async Task<IActionResult> GetVariableValues(int workflowExecutionId)
        {
            try
            {
                var values = await _processVariableService.GetVariableValuesAsync(workflowExecutionId);
                return Ok(new { success = true, data = values });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取變量值失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 獲取工作流執行的變量值字典
        /// </summary>
        [HttpGet("values/dictionary/{workflowExecutionId}")]
        public async Task<IActionResult> GetVariableValuesAsDictionary(int workflowExecutionId)
        {
            try
            {
                var values = await _processVariableService.GetVariableValuesAsDictionaryAsync(workflowExecutionId);
                return Ok(new { success = true, data = values });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取變量值字典失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 獲取單個變量值
        /// </summary>
        [HttpGet("values/{workflowExecutionId}/{variableName}")]
        public async Task<IActionResult> GetVariableValue(int workflowExecutionId, string variableName)
        {
            try
            {
                var value = await _processVariableService.GetVariableValueAsync(workflowExecutionId, variableName);
                if (value == null)
                {
                    return NotFound(new { success = false, message = "變量值不存在" });
                }
                return Ok(new { success = true, data = value });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取變量值失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 設置變量值
        /// </summary>
        [HttpPost("values")]
        public async Task<IActionResult> SetVariableValue([FromBody] SetVariableValueRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { success = false, message = "請求數據無效", errors = ModelState });
                }

                var result = await _processVariableService.SetVariableValueAsync(
                    request.WorkflowExecutionId,
                    request.VariableName,
                    request.Value,
                    request.SetBy,
                    request.SourceType,
                    request.SourceReference);

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"設置變量值失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 批量設置變量值
        /// </summary>
        [HttpPost("values/batch")]
        public async Task<IActionResult> SetMultipleVariableValues([FromBody] SetMultipleVariableValuesRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { success = false, message = "請求數據無效", errors = ModelState });
                }

                await _processVariableService.SetMultipleVariableValuesAsync(
                    request.WorkflowExecutionId,
                    request.Values,
                    request.SetBy,
                    request.SourceType);

                return Ok(new { success = true, message = "批量設置成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"批量設置變量值失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 刪除變量值
        /// </summary>
        [HttpDelete("values/{workflowExecutionId}/{variableName}")]
        public async Task<IActionResult> DeleteVariableValue(int workflowExecutionId, string variableName)
        {
            try
            {
                var result = await _processVariableService.DeleteVariableValueAsync(workflowExecutionId, variableName);
                if (!result)
                {
                    return NotFound(new { success = false, message = "變量值不存在" });
                }
                return Ok(new { success = true, message = "刪除成功" });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"刪除變量值失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion

        #region 驗證和轉換

        /// <summary>
        /// 驗證變量值
        /// </summary>
        [HttpPost("validate")]
        public async Task<IActionResult> ValidateVariableValue([FromBody] ValidateVariableValueRequest request)
        {
            try
            {
                var isValid = await _processVariableService.ValidateVariableValueAsync(
                    request.DataType,
                    request.Value,
                    request.ValidationRules);

                return Ok(new { success = true, data = new { isValid } });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"驗證變量值失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 轉換變量值
        /// </summary>
        [HttpPost("convert")]
        public async Task<IActionResult> ConvertVariableValue([FromBody] ConvertVariableValueRequest request)
        {
            try
            {
                var convertedValue = await _processVariableService.ConvertValueAsync(
                    request.DataType,
                    request.Value);

                return Ok(new { success = true, data = new { convertedValue } });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"轉換變量值失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 獲取工作流執行的流程變量實例值（包含定義信息）
        /// </summary>
        [HttpGet("instance-values/{workflowExecutionId}")]
        public async Task<IActionResult> GetProcessVariableInstanceValues(int workflowExecutionId)
        {
            try
            {
                var values = await _processVariableService.GetProcessVariableInstanceValuesAsync(workflowExecutionId);
                return Ok(new { success = true, data = values });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程變量實例值失敗: {ex.Message}", ex);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion
    }

    #region 請求模型

    public class CreateVariableDefinitionRequest
    {
        [Required]
        public int WorkflowDefinitionId { get; set; }

        [Required]
        [MaxLength(100)]
        public string VariableName { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? DisplayName { get; set; }

        [Required]
        [MaxLength(50)]
        public string DataType { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public bool IsRequired { get; set; } = false;

        [MaxLength(500)]
        public string? DefaultValue { get; set; }

        [MaxLength(1000)]
        public string? ValidationRules { get; set; }

        public string? JsonSchema { get; set; }

        public string? CreatedBy { get; set; }
    }

    public class UpdateVariableDefinitionRequest
    {
        [Required]
        [MaxLength(100)]
        public string VariableName { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? DisplayName { get; set; }

        [Required]
        [MaxLength(50)]
        public string DataType { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public bool IsRequired { get; set; } = false;

        [MaxLength(500)]
        public string? DefaultValue { get; set; }

        [MaxLength(1000)]
        public string? ValidationRules { get; set; }

        public string? JsonSchema { get; set; }

        public string? UpdatedBy { get; set; }
    }

    public class SetVariableValueRequest
    {
        [Required]
        public int WorkflowExecutionId { get; set; }

        [Required]
        [MaxLength(100)]
        public string VariableName { get; set; } = string.Empty;

        [Required]
        public object Value { get; set; } = null!;

        [MaxLength(100)]
        public string? SetBy { get; set; }

        [MaxLength(50)]
        public string? SourceType { get; set; }

        [MaxLength(500)]
        public string? SourceReference { get; set; }
    }

    public class SetMultipleVariableValuesRequest
    {
        [Required]
        public int WorkflowExecutionId { get; set; }

        [Required]
        public Dictionary<string, object> Values { get; set; } = new();

        [MaxLength(100)]
        public string? SetBy { get; set; }

        [MaxLength(50)]
        public string? SourceType { get; set; }
    }

    public class ValidateVariableValueRequest
    {
        [Required]
        [MaxLength(50)]
        public string DataType { get; set; } = string.Empty;

        [Required]
        public object Value { get; set; } = null!;

        [MaxLength(1000)]
        public string? ValidationRules { get; set; }
    }

    public class ConvertVariableValueRequest
    {
        [Required]
        [MaxLength(50)]
        public string DataType { get; set; } = string.Empty;

        [Required]
        public object Value { get; set; } = null!;
    }

    #endregion
}
