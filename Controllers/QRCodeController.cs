using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using PurpleRice.Services;
using System;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class QRCodeController : ControllerBase
    {
        private readonly IQRCodeService _qrCodeService;
        private readonly IWorkflowExecutionService _workflowExecutionService;
        private readonly ILogger<QRCodeController> _logger;

        public QRCodeController(
            IQRCodeService qrCodeService,
            IWorkflowExecutionService workflowExecutionService,
            ILogger<QRCodeController> logger)
        {
            _qrCodeService = qrCodeService;
            _workflowExecutionService = workflowExecutionService;
            _logger = logger;
        }

        [HttpPost("scan")]
        public async Task<IActionResult> ScanQRCode([FromForm] IFormFile image, [FromForm] int executionId)
        {
            byte[] imageData = null; // 在方法開始時聲明變量
            
            try
            {
                if (executionId <= 0)
                {
                    return BadRequest(new { success = false, message = "Valid execution ID is required" });
                }

                if (image == null || image.Length == 0)
                {
                    return BadRequest(new { success = false, message = "No image provided" });
                }

                // 檢查文件類型
                var allowedTypes = new[] { "image/jpeg", "image/jpg", "image/png", "image/gif" };
                if (!allowedTypes.Contains(image.ContentType.ToLower()))
                {
                    return BadRequest(new { success = false, message = "Invalid image type. Only JPEG, PNG, and GIF are supported." });
                }

                // 檢查文件大小 (限制為 5MB)
                if (image.Length > 5 * 1024 * 1024)
                {
                    return BadRequest(new { success = false, message = "Image size too large. Maximum size is 5MB." });
                }

                // 先將圖片轉換為 byte[]
                using var stream = image.OpenReadStream();
                using var memoryStream = new MemoryStream();
                await stream.CopyToAsync(memoryStream);
                imageData = memoryStream.ToArray();
                
                // 使用 ScanQRCodeAndSaveImageWithResultAsync 來掃描並保存圖片
                try
                {
                    var (qrCodeValue, savedImagePath) = await _qrCodeService.ScanQRCodeAndSaveImageWithResultAsync(imageData, executionId);
                    _logger.LogInformation("Image saved: {ImagePath}, QR Code: {QRCode}", savedImagePath, qrCodeValue ?? "null");

                    if (string.IsNullOrEmpty(qrCodeValue))
                    {
                        return Ok(new { success = false, message = "No QR Code found in the image" });
                    }

                    return Ok(new { success = true, data = qrCodeValue });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to scan and save QR Code image");
                    
                    // 即使發生異常也要嘗試保存圖片
                    try
                    {
                        var savedImagePath = await _qrCodeService.ScanQRCodeAndSaveImageAsync(imageData, executionId);
                        _logger.LogInformation("Error image saved: {ImagePath}", savedImagePath);
                    }
                    catch (Exception saveEx)
                    {
                        _logger.LogError(saveEx, "Failed to save error image");
                    }
                    
                    return StatusCode(500, new { success = false, message = "Internal server error" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error scanning QR Code");
                
                // 即使發生異常也要保存圖片
                if (imageData != null && imageData.Length > 0)
                {
                    try
                    {
                        var savedImagePath = await _qrCodeService.ScanQRCodeAndSaveImageAsync(imageData, 0);
                        _logger.LogInformation("Error image saved: {ImagePath}", savedImagePath);
                    }
                    catch (Exception saveEx)
                    {
                        _logger.LogError(saveEx, "Failed to save error image");
                    }
                }
                
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        [HttpPost("process-workflow-input")]
        public async Task<IActionResult> ProcessWorkflowInput([FromForm] WorkflowQRCodeInput input)
        {
            byte[] imageData = null; // 在方法開始時聲明變量
            
            try
            {
                if (input.ExecutionId <= 0)
                {
                    return BadRequest(new { success = false, message = "Invalid execution ID" });
                }

                if (input.NodeId == null)
                {
                    return BadRequest(new { success = false, message = "Node ID is required" });
                }

                if (input.Image != null && input.Image.Length > 0)
                {
                    using var stream = input.Image.OpenReadStream();
                    using var memoryStream = new MemoryStream();
                    await stream.CopyToAsync(memoryStream);
                    imageData = memoryStream.ToArray();
                    
                    // 在掃描之前先保存圖片（無論成功失敗都要保存）
                    try
                    {
                        var savedImagePath = await _qrCodeService.ScanQRCodeAndSaveImageAsync(imageData, input.ExecutionId);
                        _logger.LogInformation("Image saved before scanning: {ImagePath}", savedImagePath);
                    }
                    catch (Exception saveEx)
                    {
                        _logger.LogError(saveEx, "Failed to save image before scanning for execution: {ExecutionId}", input.ExecutionId);
                    }
                }

                var result = await _workflowExecutionService.ProcessQRCodeInputAsync(
                    input.ExecutionId, 
                    input.NodeId, 
                    imageData, 
                    input.QRCodeValue
                );

                if (result)
                {
                    return Ok(new { success = true, message = "QR Code processed successfully" });
                }
                else
                {
                    return BadRequest(new { success = false, message = "Failed to process QR Code input" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing workflow QR Code input");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }
    }

    public class WorkflowQRCodeInput
    {
        public int ExecutionId { get; set; }
        public string NodeId { get; set; }
        public IFormFile Image { get; set; }
        public string QRCodeValue { get; set; }
    }
}
