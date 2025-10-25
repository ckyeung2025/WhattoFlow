using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CustomerSignedPageController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;

        public CustomerSignedPageController(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("CustomerSignedPageController");
        }

        [HttpGet("customer/{customerNo}")]
        public async Task<IActionResult> GetCustomerSignedReceipts(string customerNo)
        {
            try
            {
                _loggingService.LogInformation($"獲取客戶簽收單據 - 客戶號: {customerNo}");

                var receipts = await _context.DeliveryReceipt
                    .Where(r => r.customerno == customerNo)
                    .OrderByDescending(r => r.receipt_date)
                    .Select(r => new
                    {
                        r.id,
                        r.invoiceno,
                        r.customerno,
                        r.customername,
                        r.receipt_date,
                        r.upload_date,
                        r.status,
                        r.original_image_path,
                        r.pdf_path
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"成功獲取客戶 {customerNo} 的簽收單據，數量: {receipts.Count}");
                return Ok(receipts);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取客戶簽收單據失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取客戶簽收單據失敗" });
            }
        }

        [HttpGet("receipt/{id}")]
        public async Task<IActionResult> GetReceiptDetail(int id)
        {
            try
            {
                _loggingService.LogInformation($"獲取簽收單據詳情 - ID: {id}");

                var receipt = await _context.DeliveryReceipt
                    .FirstOrDefaultAsync(r => r.id == id);

                if (receipt == null)
                {
                    _loggingService.LogWarning($"找不到簽收單據，ID: {id}");
                    return NotFound(new { error = "簽收單據不存在" });
                }

                _loggingService.LogInformation($"成功獲取簽收單據詳情: 發票號 {receipt.invoiceno}");
                return Ok(receipt);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取簽收單據詳情失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取簽收單據詳情失敗" });
            }
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchReceipts(
            [FromQuery] string customerNo = "",
            [FromQuery] string invoiceNo = "",
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            try
            {
                _loggingService.LogInformation($"搜索簽收單據 - 客戶號: {customerNo}, 發票號: {invoiceNo}, 開始日期: {startDate}, 結束日期: {endDate}");

                var query = _context.DeliveryReceipt.AsQueryable();

                if (!string.IsNullOrEmpty(customerNo))
                {
                    query = query.Where(r => r.customerno.Contains(customerNo));
                }

                if (!string.IsNullOrEmpty(invoiceNo))
                {
                    query = query.Where(r => r.invoiceno.Contains(invoiceNo));
                }

                if (startDate.HasValue)
                {
                    query = query.Where(r => r.receipt_date >= startDate.Value);
                }

                if (endDate.HasValue)
                {
                    query = query.Where(r => r.receipt_date <= endDate.Value);
                }

                var total = await query.CountAsync();
                var receipts = await query
                    .OrderByDescending(r => r.receipt_date)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(r => new
                    {
                        r.id,
                        r.invoiceno,
                        r.customerno,
                        r.customername,
                        r.receipt_date,
                        r.upload_date,
                        r.status
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"搜索完成，找到 {receipts.Count} 個簽收單據，總計 {total} 個");

                return Ok(new
                {
                    data = receipts,
                    total = total,
                    page = page,
                    pageSize = pageSize,
                    totalPages = (int)Math.Ceiling((double)total / pageSize)
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"搜索簽收單據失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "搜索簽收單據失敗" });
            }
        }

        [HttpGet("statistics")]
        public async Task<IActionResult> GetReceiptStatistics()
        {
            try
            {
                _loggingService.LogInformation("獲取簽收單據統計信息");

                var totalReceipts = await _context.DeliveryReceipt.CountAsync();
                var pendingReceipts = await _context.DeliveryReceipt.CountAsync(r => r.status == "PENDING");
                var confirmedReceipts = await _context.DeliveryReceipt.CountAsync(r => r.status == "CONFIRMED");
                var rejectedReceipts = await _context.DeliveryReceipt.CountAsync(r => r.status == "REJECTED");

                var todayReceipts = await _context.DeliveryReceipt
                    .CountAsync(r => r.receipt_date.Date == DateTime.UtcNow.Date);

                var statistics = new
                {
                    total = totalReceipts,
                    pending = pendingReceipts,
                    confirmed = confirmedReceipts,
                    rejected = rejectedReceipts,
                    today = todayReceipts
                };

                _loggingService.LogInformation($"成功獲取統計信息: 總計 {totalReceipts}, 待確認 {pendingReceipts}, 已確認 {confirmedReceipts}, 已拒絕 {rejectedReceipts}, 今日 {todayReceipts}");
                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取統計信息失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取統計信息失敗" });
            }
        }
    }
}
