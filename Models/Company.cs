using System;
using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Models
{
    public class Company
    {
        [Key]
        public Guid Id { get; set; }
        public string? MasterUserId { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? Phone { get; set; }
        public string? Website { get; set; }
        public string? WA_API_Key { get; set; }
        public string? WA_PhoneNo_ID { get; set; }
        public string? WA_Business_Account_ID { get; set; }
        public string? WA_VerifyToken { get; set; }
        public string? WA_WebhookToken { get; set; }
        public string? LogoUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        // WhatsApp 菜單設置
        /// <summary>
        /// WhatsApp 主要歡迎訊息，顯示在菜單開頭
        /// </summary>
        public string? WA_WelcomeMessage { get; set; }

        /// <summary>
        /// 當沒有啟用的工作流程時顯示的訊息
        /// </summary>
        public string? WA_NoFunctionMessage { get; set; }

        /// <summary>
        /// WhatsApp 列表菜單的標題文字
        /// </summary>
        public string? WA_MenuTitle { get; set; }

        /// <summary>
        /// WhatsApp 列表菜單的底部提示文字
        /// </summary>
        public string? WA_MenuFooter { get; set; }

        /// <summary>
        /// WhatsApp 列表菜單的查看按鈕文字
        /// </summary>
        public string? WA_MenuButton { get; set; }

        /// <summary>
        /// WhatsApp 列表菜單的區段標題
        /// </summary>
        public string? WA_SectionTitle { get; set; }

        /// <summary>
        /// 當工作流程沒有描述時使用的預設選項描述
        /// </summary>
        public string? WA_DefaultOptionDescription { get; set; }

        /// <summary>
        /// 用戶輸入錯誤時的提示訊息
        /// </summary>
        public string? WA_InputErrorMessage { get; set; }

        /// <summary>
        /// 當 WhatsApp 互動式消息失敗時的回退提示
        /// </summary>
        public string? WA_FallbackMessage { get; set; }

        /// <summary>
        /// 系統錯誤時的一般性提示訊息
        /// </summary>
        public string? WA_SystemErrorMessage { get; set; }
    }
} 