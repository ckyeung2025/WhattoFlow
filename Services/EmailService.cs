using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Models.Dto.ApiProviders;
using PurpleRice.Services.ApiProviders;

namespace PurpleRice.Services
{
    public interface IEmailService
    {
        Task<bool> SendEmailAsync(
            string providerKey,
            Guid companyId,
            string fromEmail,
            string toEmail,
            string subject,
            string body,
            string replyTo = null,
            PurpleRiceDbContext db = null);
    }

    public class EmailService : IEmailService
    {
        private readonly IApiProviderService _apiProviderService;
        private readonly LoggingService _logger;
        private readonly IHttpClientFactory _httpClientFactory;

        public EmailService(
            IApiProviderService apiProviderService,
            Func<string, LoggingService> loggerFactory,
            IHttpClientFactory httpClientFactory)
        {
            _apiProviderService = apiProviderService;
            _logger = loggerFactory("EmailService");
            _httpClientFactory = httpClientFactory;
        }

        public async Task<bool> SendEmailAsync(
            string providerKey,
            Guid companyId,
            string fromEmail,
            string toEmail,
            string subject,
            string body,
            string replyTo = null,
            PurpleRiceDbContext db = null)
        {
            try
            {
                _logger.LogInformation($"=== 開始發送郵件 ===");
                _logger.LogInformation($"Provider: {providerKey}, From: {fromEmail}, To: {toEmail}, Subject: {subject}");

                // 獲取 API Provider 配置
                var provider = await _apiProviderService.GetRuntimeProviderAsync(companyId, providerKey);
                if (provider == null || !provider.Active)
                {
                    _logger.LogError($"Email provider '{providerKey}' not found or inactive for company {companyId}");
                    return false;
                }

                if (provider.Category != "EmailServer")
                {
                    _logger.LogError($"Provider '{providerKey}' is not an EmailServer provider");
                    return false;
                }

                // 根據 provider 類型調用對應的發送方法
                return providerKey.ToLowerInvariant() switch
                {
                    "microsoft-graph" => await SendMicrosoftGraphEmailAsync(provider, fromEmail, toEmail, subject, body, replyTo),
                    "gmail" => await SendGmailEmailAsync(provider, fromEmail, toEmail, subject, body, replyTo),
                    "sendgrid" => await SendSendGridEmailAsync(provider, fromEmail, toEmail, subject, body, replyTo),
                    "aws-ses" => await SendAwsSesEmailAsync(provider, fromEmail, toEmail, subject, body, replyTo),
                    _ => throw new NotSupportedException($"Email provider '{providerKey}' is not supported")
                };
            }
            catch (Exception ex)
            {
                _logger.LogError($"發送郵件失敗: {ex.Message}", ex);
                return false;
            }
        }

        private async Task<bool> SendMicrosoftGraphEmailAsync(
            ApiProviderRuntimeDto provider,
            string fromEmail,
            string toEmail,
            string subject,
            string body,
            string replyTo = null)
        {
            try
            {
                // 解析 OAuth 配置
                var authConfig = ParseJson<Dictionary<string, string>>(provider.AuthConfigJson);
                if (authConfig == null || 
                    !authConfig.TryGetValue("tenantId", out var tenantId) ||
                    !authConfig.TryGetValue("clientId", out var clientId) ||
                    !authConfig.TryGetValue("clientSecret", out var clientSecret))
                {
                    _logger.LogError("Microsoft Graph API requires tenantId, clientId, and clientSecret in authConfig");
                    return false;
                }

                // 解析設置
                var settings = ParseJson<Dictionary<string, object>>(provider.SettingsJson);
                var fromEmailAddress = settings?.TryGetValue("fromEmail", out var fromEmailObj) == true 
                    ? fromEmailObj?.ToString() 
                    : fromEmail;

                // 獲取 OAuth 2.0 Access Token
                var accessToken = await GetMicrosoftGraphAccessTokenAsync(tenantId, clientId, clientSecret);
                if (string.IsNullOrWhiteSpace(accessToken))
                {
                    _logger.LogError("Failed to get Microsoft Graph access token");
                    return false;
                }

                // 構建 API URL（替換 {userPrincipalName}）
                var apiUrl = (provider.ApiUrl ?? "https://graph.microsoft.com/v1.0/users/{userPrincipalName}/sendMail")
                    .Replace("{userPrincipalName}", fromEmailAddress);

                // 構建郵件消息
                var emailMessage = new
                {
                    message = new
                    {
                        subject = subject,
                        body = new
                        {
                            contentType = "HTML",
                            content = body
                        },
                        toRecipients = new[]
                        {
                            new
                            {
                                emailAddress = new
                                {
                                    address = toEmail
                                }
                            }
                        },
                        replyTo = !string.IsNullOrWhiteSpace(replyTo) ? new[]
                        {
                            new
                            {
                                emailAddress = new
                                {
                                    address = replyTo
                                }
                            }
                        } : null
                    },
                    saveToSentItems = settings?.TryGetValue("saveToSentItems", out var saveObj) == true 
                        ? (saveObj?.ToString().ToLowerInvariant() == "true")
                        : true
                };

                var json = JsonSerializer.Serialize(emailMessage, new JsonSerializerOptions
                {
                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
                });

                // 發送郵件
                using var httpClient = _httpClientFactory.CreateClient();
                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await httpClient.PostAsync(apiUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Microsoft Graph API 發送郵件失敗: {response.StatusCode} - {responseContent}");
                    return false;
                }

                _logger.LogInformation($"郵件發送成功: {toEmail}");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError($"發送 Microsoft Graph 郵件時發生錯誤: {ex.Message}", ex);
                return false;
            }
        }

        private async Task<bool> SendGmailEmailAsync(
            ApiProviderRuntimeDto provider,
            string fromEmail,
            string toEmail,
            string subject,
            string body,
            string replyTo = null)
        {
            // TODO: 實現 Gmail API 發送
            _logger.LogWarning("Gmail API email sending is not yet implemented");
            return false;
        }

        private async Task<bool> SendSendGridEmailAsync(
            ApiProviderRuntimeDto provider,
            string fromEmail,
            string toEmail,
            string subject,
            string body,
            string replyTo = null)
        {
            // TODO: 實現 SendGrid API 發送
            _logger.LogWarning("SendGrid API email sending is not yet implemented");
            return false;
        }

        private async Task<bool> SendAwsSesEmailAsync(
            ApiProviderRuntimeDto provider,
            string fromEmail,
            string toEmail,
            string subject,
            string body,
            string replyTo = null)
        {
            // TODO: 實現 AWS SES API 發送
            _logger.LogWarning("AWS SES API email sending is not yet implemented");
            return false;
        }

        private async Task<string> GetMicrosoftGraphAccessTokenAsync(string tenantId, string clientId, string clientSecret)
        {
            try
            {
                var tokenUrl = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";
                
                using var httpClient = _httpClientFactory.CreateClient();
                var content = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("client_id", clientId),
                    new KeyValuePair<string, string>("client_secret", clientSecret),
                    new KeyValuePair<string, string>("scope", "https://graph.microsoft.com/.default"),
                    new KeyValuePair<string, string>("grant_type", "client_credentials")
                });

                var response = await httpClient.PostAsync(tokenUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Failed to get access token: {response.StatusCode} - {responseContent}");
                    return null;
                }

                var tokenResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                if (tokenResponse.TryGetProperty("access_token", out var accessTokenElement))
                {
                    return accessTokenElement.GetString();
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting Microsoft Graph access token: {ex.Message}", ex);
                return null;
            }
        }

        private T ParseJson<T>(string json) where T : class
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<T>(json);
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to parse JSON: {ex.Message}");
                return null;
            }
        }
    }
}

