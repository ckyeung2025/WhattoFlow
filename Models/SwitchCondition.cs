using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Models
{
    public class SwitchCondition
    {
        public string Id { get; set; } = string.Empty;
        
        [Required]
        public string VariableName { get; set; } = string.Empty;
        
        [Required]
        public string Operator { get; set; } = string.Empty; // equals, notEquals, greaterThan, lessThan, contains, isEmpty
        
        [Required]
        public string Value { get; set; } = string.Empty;
        
        public string Label { get; set; } = string.Empty;
    }
}

