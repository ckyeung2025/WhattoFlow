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

        public DeliveryController(PurpleRiceDbContext context, DeliveryService deliveryService, IWebHostEnvironment environment)
        {
            _context = context;
            _deliveryService = deliveryService;
            _environment = environment;
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
                var result = await _deliveryService.GetUnconfirmedDeliveriesAsync(page, pageSize, searchTerm, sortBy, sortOrder);
                
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
                var result = await _deliveryService.GetConfirmedDeliveriesAsync(page, pageSize, searchTerm, sortBy, sortOrder);
                
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
                var success = await _deliveryService.ConfirmDeliveryAsync(id, request.ApprovedBy, request.Remarks);
                
                if (success)
                    return Ok(new { message = "確認成功" });
                else
                    return NotFound(new { error = "找不到指定的送貨單" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("confirm-multiple")]
        public async Task<IActionResult> ConfirmMultipleDeliveries([FromBody] ConfirmMultipleDeliveriesRequest request)
        {
            try
            {
                var success = await _deliveryService.ConfirmMultipleDeliveriesAsync(request.Ids, request.ApprovedBy, request.Remarks);
                
                if (success)
                    return Ok(new { message = "批量確認成功" });
                else
                    return NotFound(new { error = "找不到指定的送貨單" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("cancel-confirm/{id}")]
        public async Task<IActionResult> CancelConfirm(int id)
        {
            try
            {
                var success = await _deliveryService.CancelConfirmAsync(id);
                if (success)
                    return Ok(new { message = "已取消確認，資料已退回送貨員已送貨" });
                else
                    return NotFound(new { error = "找不到指定的送貨單" });
            }
            catch (Exception ex)
            {
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
        public string ApprovedBy { get; set; }
        public string Remarks { get; set; }
    }

    public class ConfirmMultipleDeliveriesRequest
    {
        public List<int> Ids { get; set; }
        public string ApprovedBy { get; set; }
        public string Remarks { get; set; }
    }
} 