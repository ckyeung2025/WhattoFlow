using System;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace PurpleRice.Services
{
    public interface IEFormTokenService
    {
        string GenerateAccessToken(Guid instanceId, string recipientWhatsAppNo);
        bool ValidateAccessToken(string token, out Guid instanceId, out string recipientWhatsAppNo);
    }

    public class EFormTokenService : IEFormTokenService
    {
        private readonly IConfiguration _configuration;
        private readonly string _secretKey;

        public EFormTokenService(IConfiguration configuration)
        {
            _configuration = configuration;
            _secretKey = _configuration["EFormTokenSecret"] ?? "DefaultSecretKeyForEFormTokens2024!";
        }

        public string GenerateAccessToken(Guid instanceId, string recipientWhatsAppNo)
        {
            try
            {
                // 創建 Token 內容
                var tokenData = $"{instanceId}:{recipientWhatsAppNo}:{DateTime.UtcNow.Ticks}";
                
                // 使用 HMAC-SHA256 生成簽名
                using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
                var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(tokenData));
                
                // 將簽名和原始數據組合（簽名在前）
                var tokenBytes = new byte[hash.Length + tokenData.Length];
                Buffer.BlockCopy(hash, 0, tokenBytes, 0, hash.Length);
                Buffer.BlockCopy(Encoding.UTF8.GetBytes(tokenData), 0, tokenBytes, hash.Length, tokenData.Length);
                
                // 轉換為 Base64
                return Convert.ToBase64String(tokenBytes);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"生成 Token 失敗: {ex.Message}", ex);
            }
        }

        public bool ValidateAccessToken(string token, out Guid instanceId, out string recipientWhatsAppNo)
        {
            instanceId = Guid.Empty;
            recipientWhatsAppNo = string.Empty;

            try
            {
                if (string.IsNullOrEmpty(token))
                    return false;

                // 添加調試日誌
                System.Diagnostics.Debug.WriteLine($"[DEBUG] 驗證 Token: {token}");
                System.Diagnostics.Debug.WriteLine($"[DEBUG] Secret Key: {_secretKey}");
                Console.WriteLine($"[DEBUG] 驗證 Token: {token}");
                Console.WriteLine($"[DEBUG] Secret Key: {_secretKey}");

                // 解碼 Base64
                var tokenBytes = Convert.FromBase64String(token);
                
                // 提取簽名和數據部分（前32字節是 HMAC-SHA256 簽名）
                var hashLength = 32;
                if (tokenBytes.Length <= hashLength)
                    return false;

                var dataBytes = new byte[tokenBytes.Length - hashLength];
                var hashBytes = new byte[hashLength];
                
                // 前32字節是簽名，後面是數據
                Buffer.BlockCopy(tokenBytes, 0, hashBytes, 0, hashLength);
                Buffer.BlockCopy(tokenBytes, hashLength, dataBytes, 0, dataBytes.Length);

                var tokenData = Encoding.UTF8.GetString(dataBytes);
                
                // 添加調試日誌
                System.Diagnostics.Debug.WriteLine($"[DEBUG] 解析的 Token 數據: {tokenData}");
                System.Diagnostics.Debug.WriteLine($"[DEBUG] Token 數據長度: {tokenData.Length}");
                System.Diagnostics.Debug.WriteLine($"[DEBUG] Hash 長度: {hashBytes.Length}");
                Console.WriteLine($"[DEBUG] 解析的 Token 數據: {tokenData}");
                Console.WriteLine($"[DEBUG] Token 數據長度: {tokenData.Length}");
                Console.WriteLine($"[DEBUG] Hash 長度: {hashBytes.Length}");
                
                // 驗證簽名
                using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
                var expectedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(tokenData));
                
                System.Diagnostics.Debug.WriteLine($"[DEBUG] 預期 Hash: {Convert.ToHexString(expectedHash)}");
                System.Diagnostics.Debug.WriteLine($"[DEBUG] 實際 Hash: {Convert.ToHexString(hashBytes)}");
                Console.WriteLine($"[DEBUG] 預期 Hash: {Convert.ToHexString(expectedHash)}");
                Console.WriteLine($"[DEBUG] 實際 Hash: {Convert.ToHexString(hashBytes)}");
                
                if (!ByteArraysEqual(hashBytes, expectedHash))
                {
                    System.Diagnostics.Debug.WriteLine($"[DEBUG] Hash 驗證失敗");
                    Console.WriteLine($"[DEBUG] Hash 驗證失敗");
                    return false;
                }
                
                System.Diagnostics.Debug.WriteLine($"[DEBUG] Hash 驗證成功");
                Console.WriteLine($"[DEBUG] Hash 驗證成功");

                // 解析 Token 內容
                var parts = tokenData.Split(':');
                if (parts.Length != 3)
                    return false;

                if (!Guid.TryParse(parts[0], out instanceId))
                    return false;

                recipientWhatsAppNo = parts[1];
                
                // 檢查時間戳（可選：防止重放攻擊）
                if (long.TryParse(parts[2], out var ticks))
                {
                    var tokenTime = new DateTime(ticks);
                    var now = DateTime.UtcNow;
                    
                    // Token 有效期 30 天
                    if (now - tokenTime > TimeSpan.FromDays(30))
                        return false;
                }

                return true;
            }
            catch
            {
                return false;
            }
        }

        private static bool ByteArraysEqual(byte[] a, byte[] b)
        {
            if (a.Length != b.Length)
                return false;

            for (int i = 0; i < a.Length; i++)
            {
                if (a[i] != b[i])
                    return false;
            }

            return true;
        }
    }
}
