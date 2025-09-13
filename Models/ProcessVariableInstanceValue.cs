using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Models
{
    /// <summary>
    /// 流程變量實例值（包含定義信息）
    /// </summary>
    public class ProcessVariableInstanceValue
    {
        /// <summary>
        /// 變量名稱
        /// </summary>
        public string VariableName { get; set; } = string.Empty;

        /// <summary>
        /// 顯示名稱
        /// </summary>
        public string? DisplayName { get; set; }

        /// <summary>
        /// 數據類型
        /// </summary>
        public string DataType { get; set; } = string.Empty;

        /// <summary>
        /// 變量描述
        /// </summary>
        public string? Description { get; set; }

        /// <summary>
        /// 是否必需
        /// </summary>
        public bool IsRequired { get; set; }

        /// <summary>
        /// 默認值
        /// </summary>
        public string? DefaultValue { get; set; }

        /// <summary>
        /// 當前實例值
        /// </summary>
        public object? Value { get; set; }

        /// <summary>
        /// 設置時間
        /// </summary>
        public DateTime? SetAt { get; set; }

        /// <summary>
        /// 設置者
        /// </summary>
        public string? SetBy { get; set; }

        /// <summary>
        /// 來源類型
        /// </summary>
        public string? SourceType { get; set; }

        /// <summary>
        /// 來源引用
        /// </summary>
        public string? SourceReference { get; set; }

        /// <summary>
        /// 是否有值
        /// </summary>
        public bool HasValue => Value != null;
    }
}
