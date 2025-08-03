using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("it_customer")]
    public class it_customer
    {
        [Key]
        public string customerno { get; set; }
        public string contacttel1 { get; set; }
        public string contacttel2 { get; set; }
        // 其他欄位可依需求擴充
    }
} 