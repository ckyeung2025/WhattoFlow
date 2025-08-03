using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("sys_user")]
    public class SysUser
    {
        [Key]
        public string user_id { get; set; } = string.Empty;
        public string password { get; set; } = string.Empty;
        public string user_name { get; set; } = string.Empty;
        // 其他欄位可依實際需求補上
    }
} 