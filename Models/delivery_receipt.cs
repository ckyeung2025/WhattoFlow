using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("delivery_receipt")]
    public class delivery_receipt
    {
        [Key]
        public int id { get; set; }
        public string within_code { get; set; }
        public string invoiceno { get; set; }
        public string customerno { get; set; }
        public string customername { get; set; }
        public string contacttel1 { get; set; }
        public string contacttel2 { get; set; }
        public string original_image_path { get; set; }
        public string pdf_path { get; set; }
        public string qr_code_text { get; set; }
        public DateTime? receipt_date { get; set; }
        public DateTime? upload_date { get; set; }
        public string upload_ip { get; set; }
        public string status { get; set; }
        public string remarks { get; set; }
        public string approved_by { get; set; }
        public DateTime? approved_date { get; set; }
        public string approval_remarks { get; set; }
        public bool confirmed { get; set; }
    }
} 