using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System.Linq.Dynamic.Core;

namespace PurpleRice.Services
{
    public class DeliveryService
    {
        private readonly PurpleRiceDbContext _context;

        public DeliveryService(PurpleRiceDbContext context)
        {
            _context = context;
        }

        // 前端排序欄位對應 Entity 欄位
        private string MapSortBy(string sortBy)
        {
            return sortBy switch
            {
                "invoiceNo" => "invoiceno",
                "customerNo" => "customerno",
                "customerName" => "customername",
                "contactTel1" => "contacttel1",
                "contactTel2" => "contacttel2",
                "withinCode" => "within_code",
                "qrCodeText" => "qr_code_text",
                "receiptDate" => "receipt_date",
                "uploadDate" => "upload_date",
                "status" => "status",
                "remarks" => "remarks",
                "approvedBy" => "approved_by",
                "approvedDate" => "approved_date",
                "approvalRemarks" => "approval_remarks",
                "confirmed" => "confirmed",
                "uploadedBy" => "uploaded_by",
                // 排除 originalImagePath、pdfPath
                "originalImagePath" => "upload_date",
                "pdfPath" => "upload_date",
                _ => "upload_date"
            };
        }

        public async Task<(List<UnconfirmedDeliveryDto> Data, int Total)> GetUnconfirmedDeliveriesAsync(
            int page = 1, 
            int pageSize = 10, 
            string searchTerm = "", 
            string sortBy = "upload_date", 
            string sortOrder = "desc")
        {
            var query = _context.DeliveryReceipt
                .Where(d => !d.confirmed && d.uploaded_by == "DeliveryMan")
                .AsQueryable();

            // 搜尋功能
            if (!string.IsNullOrEmpty(searchTerm))
            {
                query = query.Where(d => 
                    d.invoiceno.Contains(searchTerm) ||
                    d.customerno.Contains(searchTerm) ||
                    d.customername.Contains(searchTerm) ||
                    d.within_code.Contains(searchTerm));
            }

            // 排序
            var sortExpression = $"{MapSortBy(sortBy)} {sortOrder}";
            query = query.OrderBy(sortExpression);

            // 分頁
            var total = await query.CountAsync();
            var data = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(d => new UnconfirmedDeliveryDto
                {
                    Id = d.id,
                    WithinCode = d.within_code,
                    InvoiceNo = d.invoiceno,
                    CustomerNo = d.customerno,
                    CustomerName = d.customername,
                    ContactTel1 = d.contacttel1,
                    ContactTel2 = d.contacttel2,
                    OriginalImagePath = d.original_image_path,
                    PdfPath = d.pdf_path,
                    QrCodeText = d.qr_code_text,
                    ReceiptDate = d.receipt_date,
                    UploadDate = d.upload_date,
                    UploadIp = d.upload_ip,
                    Status = d.status,
                    Remarks = d.remarks,
                    ApprovedBy = d.approved_by,
                    ApprovedDate = d.approved_date,
                    ApprovalRemarks = d.approval_remarks,
                    Confirmed = d.confirmed,
                    UploadedBy = d.uploaded_by
                })
                .ToListAsync();

            return (data, total);
        }

        // 1. 客服手動確認（CustomerSignedPage.js）
        public async Task<(List<UnconfirmedDeliveryDto> Data, int Total)> GetConfirmedDeliveriesAsync(
            int page = 1, 
            int pageSize = 10, 
            string searchTerm = "", 
            string sortBy = "upload_date", 
            string sortOrder = "desc")
        {
            var query = _context.DeliveryReceipt
                .Where(d => d.uploaded_by == "DeliveryMan" && d.confirmed)
                .AsQueryable();

            // 搜尋功能
            if (!string.IsNullOrEmpty(searchTerm))
            {
                query = query.Where(d => 
                    d.invoiceno.Contains(searchTerm) ||
                    d.customerno.Contains(searchTerm) ||
                    d.customername.Contains(searchTerm) ||
                    d.within_code.Contains(searchTerm));
            }

            // 排序
            var sortExpression = $"{MapSortBy(sortBy)} {sortOrder}";
            query = query.OrderBy(sortExpression);

            // 分頁
            var total = await query.CountAsync();
            var data = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(d => new UnconfirmedDeliveryDto
                {
                    Id = d.id,
                    WithinCode = d.within_code,
                    InvoiceNo = d.invoiceno,
                    CustomerNo = d.customerno,
                    CustomerName = d.customername,
                    ContactTel1 = d.contacttel1,
                    ContactTel2 = d.contacttel2,
                    OriginalImagePath = d.original_image_path,
                    PdfPath = d.pdf_path,
                    QrCodeText = d.qr_code_text,
                    ReceiptDate = d.receipt_date,
                    UploadDate = d.upload_date,
                    UploadIp = d.upload_ip,
                    Status = d.status,
                    Remarks = d.remarks,
                    ApprovedBy = d.approved_by,
                    ApprovedDate = d.approved_date,
                    ApprovalRemarks = d.approval_remarks,
                    Confirmed = d.confirmed,
                    UploadedBy = d.uploaded_by
                })
                .ToListAsync();

            return (data, total);
        }

        // 2. 已確認（UnconfirmedPage.js）
        public async Task<(List<UnconfirmedDeliveryDto> Data, int Total)> GetCustomerConfirmedDeliveriesAsync(
            int page = 1, 
            int pageSize = 10, 
            string searchTerm = "", 
            string sortBy = "upload_date", 
            string sortOrder = "desc")
        {
            var query = _context.DeliveryReceipt
                .Where(d => d.uploaded_by == "Customer" && d.confirmed)
                .AsQueryable();

            if (!string.IsNullOrEmpty(searchTerm))
            {
                query = query.Where(d =>
                    d.invoiceno.Contains(searchTerm) ||
                    d.customerno.Contains(searchTerm) ||
                    d.customername.Contains(searchTerm) ||
                    d.within_code.Contains(searchTerm));
            }

            var sortExpression = $"{MapSortBy(sortBy)} {sortOrder}";
            query = query.OrderBy(sortExpression);

            var total = await query.CountAsync();
            var data = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(d => new UnconfirmedDeliveryDto
                {
                    Id = d.id,
                    WithinCode = d.within_code,
                    InvoiceNo = d.invoiceno,
                    CustomerNo = d.customerno,
                    CustomerName = d.customername,
                    ContactTel1 = d.contacttel1,
                    ContactTel2 = d.contacttel2,
                    OriginalImagePath = d.original_image_path,
                    PdfPath = d.pdf_path,
                    QrCodeText = d.qr_code_text,
                    ReceiptDate = d.receipt_date,
                    UploadDate = d.upload_date,
                    UploadIp = d.upload_ip,
                    Status = d.status,
                    Remarks = d.remarks,
                    ApprovedBy = d.approved_by,
                    ApprovedDate = d.approved_date,
                    ApprovalRemarks = d.approval_remarks,
                    Confirmed = d.confirmed,
                    UploadedBy = d.uploaded_by
                })
                .ToListAsync();

            return (data, total);
        }

        // 客戶已簽收待確認
        public async Task<(List<UnconfirmedDeliveryDto> Data, int Total)> GetCustomerPendingDeliveriesAsync(
            int page = 1,
            int pageSize = 10,
            string searchTerm = "",
            string sortBy = "upload_date",
            string sortOrder = "desc")
        {
            var query = _context.DeliveryReceipt
                .Where(d => d.uploaded_by == "Customer" && !d.confirmed)
                .AsQueryable();
            if (!string.IsNullOrEmpty(searchTerm))
            {
                query = query.Where(d =>
                    d.invoiceno.Contains(searchTerm) ||
                    d.customerno.Contains(searchTerm) ||
                    d.customername.Contains(searchTerm) ||
                    d.within_code.Contains(searchTerm));
            }
            var sortExpression = $"{MapSortBy(sortBy)} {sortOrder}";
            query = query.OrderBy(sortExpression);
            var total = await query.CountAsync();
            var data = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(d => new UnconfirmedDeliveryDto
                {
                    Id = d.id,
                    WithinCode = d.within_code,
                    InvoiceNo = d.invoiceno,
                    CustomerNo = d.customerno,
                    CustomerName = d.customername,
                    ContactTel1 = d.contacttel1,
                    ContactTel2 = d.contacttel2,
                    OriginalImagePath = d.original_image_path,
                    PdfPath = d.pdf_path,
                    QrCodeText = d.qr_code_text,
                    ReceiptDate = d.receipt_date,
                    UploadDate = d.upload_date,
                    UploadIp = d.upload_ip,
                    Status = d.status,
                    Remarks = d.remarks,
                    ApprovedBy = d.approved_by,
                    ApprovedDate = d.approved_date,
                    ApprovalRemarks = d.approval_remarks,
                    Confirmed = d.confirmed,
                    UploadedBy = d.uploaded_by
                })
                .ToListAsync();
            return (data, total);
        }

        public async Task<bool> ConfirmDeliveryAsync(int id, string approvedBy, string remarks = "")
        {
            var delivery = await _context.DeliveryReceipt.FindAsync(id);
            if (delivery == null)
                return false;

            delivery.confirmed = true;
            delivery.approved_by = approvedBy;
            delivery.approved_date = DateTime.Now;
            delivery.approval_remarks = remarks;
            delivery.status = "已確認";

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ConfirmMultipleDeliveriesAsync(List<int> ids, string approvedBy, string remarks = "")
        {
            var deliveries = await _context.DeliveryReceipt
                .Where(d => ids.Contains(d.id))
                .ToListAsync();

            if (!deliveries.Any())
                return false;

            foreach (var delivery in deliveries)
            {
                delivery.confirmed = true;
                delivery.approved_by = approvedBy;
                delivery.approved_date = DateTime.Now;
                delivery.approval_remarks = remarks;
                delivery.status = "已確認";
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> CancelConfirmAsync(int id)
        {
            var delivery = await _context.DeliveryReceipt.FindAsync(id);
            if (delivery == null)
                return false;

            delivery.confirmed = false;
            delivery.approved_by = null;
            delivery.approved_date = null;
            delivery.approval_remarks = null;
            delivery.status = "PENDING";

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<UnconfirmedDeliveryDto> GetDeliveryByIdAsync(int id)
        {
            var delivery = await _context.DeliveryReceipt
                .Where(d => d.id == id)
                .Select(d => new UnconfirmedDeliveryDto
                {
                    Id = d.id,
                    WithinCode = d.within_code,
                    InvoiceNo = d.invoiceno,
                    CustomerNo = d.customerno,
                    CustomerName = d.customername,
                    ContactTel1 = d.contacttel1,
                    ContactTel2 = d.contacttel2,
                    OriginalImagePath = d.original_image_path,
                    PdfPath = d.pdf_path,
                    QrCodeText = d.qr_code_text,
                    ReceiptDate = d.receipt_date,
                    UploadDate = d.upload_date,
                    UploadIp = d.upload_ip,
                    Status = d.status,
                    Remarks = d.remarks,
                    ApprovedBy = d.approved_by,
                    ApprovedDate = d.approved_date,
                    ApprovalRemarks = d.approval_remarks,
                    Confirmed = d.confirmed,
                    UploadedBy = d.uploaded_by
                })
                .FirstOrDefaultAsync();

            return delivery;
        }
    }
} 