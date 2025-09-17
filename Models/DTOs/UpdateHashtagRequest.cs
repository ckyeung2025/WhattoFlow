using System;
using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Models.DTOs
{
    public class UpdateHashtagRequest
    {
        [Required(ErrorMessage = "標籤名稱為必填欄位")]
        [MaxLength(100)]
        public string Name { get; set; }
        
        [MaxLength(7)]
        public string? Color { get; set; }
        
        [MaxLength(300)]
        public string? Description { get; set; }
    }
}
