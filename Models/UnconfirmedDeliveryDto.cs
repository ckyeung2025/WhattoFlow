using System;

namespace PurpleRice.Models
{
    public class UnconfirmedDeliveryDto
    {
        public int Id { get; set; }
        public string WithinCode { get; set; }
        public string InvoiceNo { get; set; }
        public string CustomerNo { get; set; }
        public string CustomerName { get; set; }
        public string ContactTel1 { get; set; }
        public string ContactTel2 { get; set; }
        public string OriginalImagePath { get; set; }
        public string PdfPath { get; set; }
        public string QrCodeText { get; set; }
        public DateTime? ReceiptDate { get; set; }
        public DateTime? UploadDate { get; set; }
        public string UploadIp { get; set; }
        public string Status { get; set; }
        public string Remarks { get; set; }
        public string ApprovedBy { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public string ApprovalRemarks { get; set; }
        public bool Confirmed { get; set; }
        public string UploadedBy { get; set; }
    }
} 