using System;
using BCrypt.Net;

namespace PurpleRice.Services
{
    /// <summary>
    /// 密碼處理服務
    /// 負責密碼的 hash 和驗證
    /// </summary>
    public class PasswordService
    {
        /// <summary>
        /// 對密碼進行 hash
        /// </summary>
        /// <param name="password">明文密碼</param>
        /// <returns>Hash 後的密碼</returns>
        public static string HashPassword(string password)
        {
            if (string.IsNullOrEmpty(password))
            {
                throw new ArgumentException("密碼不能為空", nameof(password));
            }

            // 使用 BCrypt 進行 hash，workFactor 設為 12（平衡安全性和性能）
            return BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
        }

        /// <summary>
        /// 驗證密碼是否匹配
        /// </summary>
        /// <param name="password">明文密碼</param>
        /// <param name="hashedPassword">Hash 後的密碼</param>
        /// <returns>如果密碼匹配返回 true，否則返回 false</returns>
        public static bool VerifyPassword(string password, string hashedPassword)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(hashedPassword))
            {
                return false;
            }

            try
            {
                // 如果 hashedPassword 看起來不像 BCrypt hash（不以 $2a$, $2b$, $2x$, $2y$ 開頭），
                // 可能是舊的明文密碼，需要進行兼容性處理
                if (!hashedPassword.StartsWith("$2a$") && 
                    !hashedPassword.StartsWith("$2b$") && 
                    !hashedPassword.StartsWith("$2x$") && 
                    !hashedPassword.StartsWith("$2y$"))
                {
                    // 這是舊的明文密碼，直接比較（用於遷移期間）
                    return password == hashedPassword;
                }

                // 使用 BCrypt 驗證
                return BCrypt.Net.BCrypt.Verify(password, hashedPassword);
            }
            catch
            {
                // 如果驗證過程中出現錯誤（例如格式不正確），返回 false
                return false;
            }
        }

        /// <summary>
        /// 檢查密碼是否已經是 hash 格式
        /// </summary>
        /// <param name="password">密碼字符串</param>
        /// <returns>如果是 hash 格式返回 true，否則返回 false</returns>
        public static bool IsHashed(string password)
        {
            if (string.IsNullOrEmpty(password))
            {
                return false;
            }

            return password.StartsWith("$2a$") || 
                   password.StartsWith("$2b$") || 
                   password.StartsWith("$2x$") || 
                   password.StartsWith("$2y$");
        }
    }
}

