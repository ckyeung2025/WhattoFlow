using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Models
{
    public class SwitchConditionGroup
    {
        [Required]
        public string Id { get; set; } = string.Empty;
        
        [Required]
        public string Relation { get; set; } = "and"; // "and" or "or"
        
        public List<SwitchCondition> Conditions { get; set; } = new List<SwitchCondition>();
        
        [Required]
        public string OutputPath { get; set; } = string.Empty; // 對應邊的 ID
    }
}

