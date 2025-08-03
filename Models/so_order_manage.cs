using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("so_order_manage")]
    public class so_order_manage
    {
        [Key]
        public string id { get; set; }
        public string invoiceno { get; set; }
        // 其他欄位可依需求擴充
    }
} 