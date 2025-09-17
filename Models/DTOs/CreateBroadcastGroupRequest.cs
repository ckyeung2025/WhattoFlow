using System;
using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Models.DTOs
{
    public class CreateBroadcastGroupRequest
    {
        [Required(ErrorMessage = "群組名稱為必填欄位")]
        [MaxLength(200)]
        public string Name { get; set; }
        
        [MaxLength(500)]
        public string? Description { get; set; }
        
        [MaxLength(7)]
        public string? Color { get; set; }
    }
}
