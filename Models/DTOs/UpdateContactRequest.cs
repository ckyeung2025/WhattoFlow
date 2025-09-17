using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Models.DTOs
{
    public class UpdateContactRequest
    {
        [Required(ErrorMessage = "姓名為必填欄位")]
        [MaxLength(200, ErrorMessage = "姓名長度不能超過200個字符")]
        public string Name { get; set; } = string.Empty;
        
        [MaxLength(100, ErrorMessage = "職稱長度不能超過100個字符")]
        public string? Title { get; set; }
        
        [MaxLength(100, ErrorMessage = "職業長度不能超過100個字符")]
        public string? Occupation { get; set; }
        
        [MaxLength(20, ErrorMessage = "WhatsApp號碼長度不能超過20個字符")]
        public string? WhatsAppNumber { get; set; }
        
        [MaxLength(255, ErrorMessage = "電子郵件長度不能超過255個字符")]
        [EmailAddress(ErrorMessage = "請輸入有效的電子郵件格式")]
        public string? Email { get; set; }
        
        [MaxLength(200, ErrorMessage = "公司名稱長度不能超過200個字符")]
        public string? CompanyName { get; set; }
        
        [MaxLength(100, ErrorMessage = "部門長度不能超過100個字符")]
        public string? Department { get; set; }
        
        [MaxLength(100, ErrorMessage = "職位長度不能超過100個字符")]
        public string? Position { get; set; }
        
        [MaxLength(500, ErrorMessage = "標籤長度不能超過500個字符")]
        public string? Hashtags { get; set; }
        
        [Required(ErrorMessage = "廣播群組為必填欄位")]
        public Guid BroadcastGroupId { get; set; }
        
        public bool IsActive { get; set; } = true;
    }
}
