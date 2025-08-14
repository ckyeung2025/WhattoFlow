using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using Microsoft.AspNetCore.Hosting;
using System.IO;
using System.Linq;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DeliveryController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly DeliveryService _deliveryService;
        private readonly IWebHostEnvironment _environment;
        private readonly LoggingService _loggingService;

        public DeliveryController(PurpleRiceDbContext context, DeliveryService deliveryService, IWebHostEnvironment environment, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _deliveryService = deliveryService;
            _environment = environment;
            _loggingService = loggingServiceFactory("DeliveryController");
        }

        [HttpGet("unconfirmed")]
        public async Task<IActionResult> GetUnconfirmedDeliveries(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string searchTerm = "",
            [FromQuery] string sortBy = "upload_date",
            [FromQuery] string sortOrder = "desc")
        {
            try
            {
                _loggingService.LogInformation($"獲取未確認送貨單 - 頁面: {page}, 每頁: {pageSize}, 搜索: {searchTerm}");
                
                var result = await _deliveryService.GetUnconfirmedDeliveriesAsync(page, pageSize, searchTerm, sortBy, sortOrder);
                
                _loggingService.LogInformation($"成功獲取 {result.Data.Count} 個未確認送貨單，總計 {result.Total} 個");
                
                return Ok(new
                {
                    Data = result.Data,
                    Total = result.Total,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)Math.Ceiling((double)result.Total / pageSize)
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取未確認送貨單失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("confirmed")]
        public async Task<IActionResult> GetConfirmedDeliveries(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string searchTerm = "",
            [FromQuery] string sortBy = "upload_date",
            [FromQuery] string sortOrder = "desc")
        {
            try
            {
                _loggingService.LogInformation($"獲取已確認送貨單 - 頁面: {page}, 每頁: {pageSize}, 搜索: {searchTerm}");
                
                var result = await _deliveryService.GetConfirmedDeliveriesAsync(page, pageSize, searchTerm, sortBy, sortOrder);
                
                _loggingService.LogInformation($"成功獲取 {result.Data.Count} 個已確認送貨單，總計 {result.Total} 個");
                
                return Ok(new
                {
                    Data = result.Data,
                    Total = result.Total,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)Math.Ceiling((double)result.Total / pageSize)
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取已確認送貨單失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("customer-pending")]
        public async Task<IActionResult> GetCustomerPendingDeliveries(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string searchTerm = "",
            [FromQuery] string sortBy = "upload_date",
            [FromQuery] string sortOrder = "desc")
        {
            try
            {
                var result = await _deliveryService.GetCustomerPendingDeliveriesAsync(page, pageSize, searchTerm, sortBy, sortOrder);
                return Ok(new
                {
                    Data = result.Data,
                    Total = result.Total,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)Math.Ceiling((double)result.Total / pageSize)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("customer-confirmed")]
        public async Task<IActionResult> GetCustomerConfirmedDeliveries(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string searchTerm = "",
            [FromQuery] string sortBy = "upload_date",
            [FromQuery] string sortOrder = "desc")
        {
            try
            {
                var result = await _deliveryService.GetCustomerConfirmedDeliveriesAsync(page, pageSize, searchTerm, sortBy, sortOrder);
                return Ok(new
                {
                    Data = result.Data,
                    Total = result.Total,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)Math.Ceiling((double)result.Total / pageSize)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("confirm/{id}")]
        public async Task<IActionResult> ConfirmDelivery(int id, [FromBody] ConfirmDeliveryRequest request)
        {
            try
            {
                _loggingService.LogInformation($"確認送貨單 - ID: {id}");
                
                var result = await _deliveryService.ConfirmDeliveryAsync(id, request.ApprovedBy, request.Remarks);
                
                if (result)
                {
                    _loggingService.LogInformation($"成功確認送貨單 - ID: {id}");
                    return Ok(new { success = true, message = "送貨單已確認" });
                }
                else
                {
                    _loggingService.LogWarning($"確認送貨單失敗 - ID: {id}");
                    return BadRequest(new { success = false, message = "確認送貨單失敗" });
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"確認送貨單時發生錯誤 - ID: {id}, 錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("reject/{id}")]
        public async Task<IActionResult> RejectDelivery(int id, [FromBody] RejectDeliveryRequest request)
        {
            try
            {
                _loggingService.LogInformation($"拒絕送貨單 - ID: {id}, 原因: {request.Remarks}");
                
                var result = await _deliveryService.RejectDeliveryAsync(id, request.ApprovedBy, request.Remarks);
                
                if (result)
                {
                    _loggingService.LogInformation($"成功拒絕送貨單 - ID: {id}");
                    return Ok(new { success = true, message = "送貨單已拒絕" });
                }
                else
                {
                    _loggingService.LogWarning($"拒絕送貨單失敗 - ID: {id}");
                    return BadRequest(new { success = false, message = "拒絕送貨單失敗" });
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"拒絕送貨單時發生錯誤 - ID: {id}, 錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("statistics")]
        public async Task<IActionResult> GetDeliveryStatistics()
        {
            try
            {
                _loggingService.LogInformation("獲取送貨統計信息");
                
                var statistics = await _deliveryService.GetDeliveryStatisticsAsync();
                
                _loggingService.LogInformation("成功獲取送貨統計信息");
                
                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取送貨統計信息失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("cancel-confirm/{id}")]
        public async Task<IActionResult> CancelConfirmDelivery(int id)
        {
            try
            {
                _loggingService.LogInformation($"取消確認送貨單 - ID: {id}");
                
                var result = await _deliveryService.CancelConfirmAsync(id);
                
                if (result)
                {
                    _loggingService.LogInformation($"成功取消確認送貨單 - ID: {id}");
                    return Ok(new { success = true, message = "送貨單已取消確認" });
                }
                else
                {
                    _loggingService.LogWarning($"取消確認送貨單失敗 - ID: {id}");
                    return BadRequest(new { success = false, message = "取消確認送貨單失敗" });
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"取消確認送貨單時發生錯誤 - ID: {id}, 錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("confirm-multiple")]
        public async Task<IActionResult> BatchConfirmDeliveries([FromBody] ConfirmMultipleDeliveriesRequest request)
        {
            try
            {
                _loggingService.LogInformation($"批量確認送貨單 - 數量: {request.Ids.Count}");
                
                var result = await _deliveryService.ConfirmMultipleDeliveriesAsync(request.Ids, request.ApprovedBy, request.Remarks);
                
                if (result)
                {
                    _loggingService.LogInformation($"成功批量確認 {request.Ids.Count} 個送貨單");
                    return Ok(new { success = true, message = $"成功確認 {request.Ids.Count} 個送貨單" });
                }
                else
                {
                    _loggingService.LogWarning($"批量確認送貨單失敗");
                    return BadRequest(new { success = false, message = "批量確認送貨單失敗" });
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"批量確認送貨單時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("images")]
        public IActionResult GetImageList([FromQuery] string customerNo, [FromQuery] string invoiceNo, [FromQuery] string groupTime)
        {
            if (string.IsNullOrEmpty(customerNo) || string.IsNullOrEmpty(invoiceNo) || string.IsNullOrEmpty(groupTime))
                return BadRequest("customerNo, invoiceNo, groupTime required.");

            var groupName = $"DN_{customerNo}_{invoiceNo}_{groupTime}";
            var folderPath = Path.Combine(_environment.ContentRootPath, "Uploads", "Customer", customerNo, "Original", groupName);

            if (!Directory.Exists(folderPath))
                return Ok(new List<string>());

            var files = Directory.GetFiles(folderPath, "*.jpg")
                .Concat(Directory.GetFiles(folderPath, "*.png"))
                .Select(f => Path.GetFileName(f))
                .OrderBy(f => f)
                .ToList();

            return Ok(new { images = files });
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetDeliveryById(int id)
        {
            try
            {
                var delivery = await _deliveryService.GetDeliveryByIdAsync(id);
                
                if (delivery == null)
                    return NotFound(new { error = "找不到指定的送貨單" });
                
                return Ok(delivery);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    public class ConfirmDeliveryRequest
    {
        public string ApprovedBy { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
    }

    public class ConfirmMultipleDeliveriesRequest
    {
        public List<int> Ids { get; set; } = new List<int>();
        public string ApprovedBy { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
    }

    public class RejectDeliveryRequest
    {
        public string ApprovedBy { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
    }
} 