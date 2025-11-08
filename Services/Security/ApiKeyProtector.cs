using System;
using System.Security.Cryptography;
using System.Text;

namespace PurpleRice.Services.Security
{
    public interface IApiKeyProtector
    {
        byte[] Protect(string apiKey);
        string Unprotect(byte[] protectedKey);
    }

    public class ApiKeyProtector : IApiKeyProtector
    {
        public byte[] Protect(string apiKey)
        {
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return null;
            }

            try
            {
                var bytes = Encoding.UTF8.GetBytes(apiKey);
                return ProtectedData.Protect(bytes, null, DataProtectionScope.CurrentUser);
            }
            catch
            {
                return Encoding.UTF8.GetBytes(apiKey);
            }
        }

        public string Unprotect(byte[] protectedKey)
        {
            if (protectedKey == null || protectedKey.Length == 0)
            {
                return string.Empty;
            }

            try
            {
                var bytes = ProtectedData.Unprotect(protectedKey, null, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(bytes);
            }
            catch
            {
                return Encoding.UTF8.GetString(protectedKey);
            }
        }
    }
}

