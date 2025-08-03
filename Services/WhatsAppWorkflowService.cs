using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace PurpleRice.Services
{
        public class WhatsAppWorkflowService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly LoggingService _loggingService;
        
        public WhatsAppWorkflowService(IServiceProvider serviceProvider, Func<string, LoggingService> loggingServiceFactory)
        {
            _serviceProvider = serviceProvider;
            _loggingService = loggingServiceFactory("WhatsAppService");
        }

        /// <summary>
        /// 統一的 WhatsApp 消息發送方法
        /// </summary>
        /// <param name="to">收件人電話號碼</param>
        /// <param name="message">消息內容</param>
        /// <param name="execution">工作流程執行記錄</param>
        /// <returns></returns>
        public async Task SendWhatsAppMessageAsync(string to, string message, WorkflowExecution execution)
        {
            try
            {
                _loggingService.LogInformation($"=== WhatsAppWorkflowService.SendWhatsAppMessageAsync 開始 ===");
                _loggingService.LogInformation($"收件人: {to}");
                _loggingService.LogInformation($"消息內容: {message}");
                _loggingService.LogInformation($"執行 ID: {execution.Id}");

                // 驗證必要參數
                if (string.IsNullOrEmpty(message))
                {
                    _loggingService.LogError($"錯誤：消息內容為空。to: '{to}', execution.Id: {execution.Id}");
                    throw new Exception("消息內容不能為空");
                }

                if (string.IsNullOrEmpty(to))
                {
                    _loggingService.LogError($"錯誤：收件人電話號碼為空。message: '{message}', execution.Id: {execution.Id}");
                    throw new Exception("收件人電話號碼不能為空");
                }

                // 獲取公司配置
                var company = await GetCompanyConfigurationAsync(execution);
                
                // 格式化電話號碼
                var formattedTo = FormatPhoneNumber(to);
                
                _loggingService.LogInformation($"原始電話號碼: {to}");
                _loggingService.LogInformation($"格式化後電話號碼: {formattedTo}");

                // 發送 WhatsApp 消息
                await SendWhatsAppApiRequestAsync(company, formattedTo, message);

                _loggingService.LogInformation($"成功發送 WhatsApp 消息到 {formattedTo}: {message}");
                _loggingService.LogInformation($"=== WhatsAppWorkflowService.SendWhatsAppMessageAsync 完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 WhatsApp 消息失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 發送 WhatsApp 模板消息
        /// </summary>
        /// <param name="to">收件人電話號碼</param>
        /// <param name="templateName">模板名稱</param>
        /// <param name="execution">工作流程執行記錄</param>
        /// <returns></returns>
        public async Task SendWhatsAppTemplateMessageAsync(string to, string templateName, WorkflowExecution execution)
        {
            try
            {
                                 _loggingService.LogInformation($"=== WhatsAppWorkflowService.SendWhatsAppTemplateMessageAsync 開始 ===");
                 _loggingService.LogInformation($"收件人: {to}");
                 _loggingService.LogInformation($"模板名稱: {templateName}");
                 _loggingService.LogInformation($"執行 ID: {execution.Id}");

                // 驗證必要參數
                if (string.IsNullOrEmpty(templateName))
                {
                    throw new Exception("模板名稱不能為空");
                }

                if (string.IsNullOrEmpty(to))
                {
                    throw new Exception("收件人電話號碼不能為空");
                }

                // 獲取公司配置
                var company = await GetCompanyConfigurationAsync(execution);
                
                // 格式化電話號碼
                var formattedTo = FormatPhoneNumber(to);
                
                                 _loggingService.LogInformation($"原始電話號碼: {to}");
                 _loggingService.LogInformation($"格式化後電話號碼: {formattedTo}");

                 // 發送 WhatsApp 模板消息
                 await SendWhatsAppTemplateApiRequestAsync(company, formattedTo, templateName);

                 _loggingService.LogInformation($"成功發送 WhatsApp 模板消息到 {formattedTo}: {templateName}");
                 _loggingService.LogInformation($"=== WhatsAppWorkflowService.SendWhatsAppTemplateMessageAsync 完成 ===");
            }
                         catch (Exception ex)
             {
                 _loggingService.LogError($"發送 WhatsApp 模板消息失敗: {ex.Message}", ex);
                 throw;
             }
        }

        /// <summary>
        /// 獲取公司 WhatsApp 配置
        /// </summary>
        /// <param name="execution">工作流程執行記錄</param>
        /// <returns>公司配置</returns>
        private async Task<Company> GetCompanyConfigurationAsync(WorkflowExecution execution)
        {
            _loggingService.LogInformation($"開始查詢公司配置，執行 ID: {execution.Id}");

            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();

            // 查詢工作流程定義
            var workflowDefinition = await dbContext.WorkflowDefinitions
                .FirstOrDefaultAsync(w => w.Id == execution.WorkflowDefinitionId);

            if (workflowDefinition == null)
            {
                throw new Exception($"找不到工作流程定義，ID: {execution.WorkflowDefinitionId}");
            }

            _loggingService.LogInformation($"找到工作流程定義，Name: {workflowDefinition.Name}");
            _loggingService.LogInformation($"公司 ID: {workflowDefinition.CompanyId}");

            // 查詢公司配置
            var company = await dbContext.Companies
                .FirstOrDefaultAsync(c => c.Id == workflowDefinition.CompanyId);

            if (company == null)
            {
                throw new Exception($"找不到對應的公司記錄，Company ID: {workflowDefinition.CompanyId}");
            }

            _loggingService.LogInformation($"找到公司記錄: {company.Name}");

            // 驗證 WhatsApp 配置
            if (string.IsNullOrEmpty(company.WA_API_Key))
            {
                throw new Exception("該公司未配置 WhatsApp API Key");
            }

            if (string.IsNullOrEmpty(company.WA_PhoneNo_ID))
            {
                throw new Exception("該公司未配置 WhatsApp Phone Number ID");
            }

            _loggingService.LogInformation($"公司 WhatsApp API Key: {company.WA_API_Key}");
            _loggingService.LogInformation($"公司 WhatsApp Phone Number ID: {company.WA_PhoneNo_ID}");

            return company;
        }

        /// <summary>
        /// 格式化電話號碼
        /// </summary>
        /// <param name="phoneNumber">原始電話號碼</param>
        /// <returns>格式化後的電話號碼</returns>
        private string FormatPhoneNumber(string phoneNumber)
        {
            var countryCode = "852"; // 暫時硬編碼香港區號，可以之後從公司設定獲取
            
            // 檢查電話號碼是否已經包含國家代碼
            if (!phoneNumber.StartsWith(countryCode))
            {
                // 移除開頭的 0（如果有的話）
                if (phoneNumber.StartsWith("0"))
                {
                    phoneNumber = phoneNumber.Substring(1);
                }
                // 添加國家代碼
                return countryCode + phoneNumber;
            }
            else
            {
                // 已經包含國家代碼，直接使用
                return phoneNumber;
            }
        }

        /// <summary>
        /// 發送 WhatsApp API 請求
        /// </summary>
        /// <param name="company">公司配置</param>
        /// <param name="to">收件人電話號碼</param>
        /// <param name="message">消息內容</param>
        /// <returns></returns>
        private async Task SendWhatsAppApiRequestAsync(Company company, string to, string message)
        {
            var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
            
            var payload = new
            {
                messaging_product = "whatsapp",
                to = to,
                type = "text",
                text = new { body = message }
            };

                         var jsonPayload = JsonSerializer.Serialize(payload);
             _loggingService.LogInformation($"WhatsApp API URL: {url}");
             _loggingService.LogInformation($"WhatsApp API Payload: {jsonPayload}");

             using var httpClient = new HttpClient();
             httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
             
             var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
             
             _loggingService.LogInformation($"開始發送 WhatsApp 消息...");
             var response = await httpClient.PostAsync(url, content);
             var responseContent = await response.Content.ReadAsStringAsync();
             
             _loggingService.LogInformation($"WhatsApp API Response Status: {response.StatusCode}");
             _loggingService.LogInformation($"WhatsApp API Response Content: {responseContent}");

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"WhatsApp API 請求失敗: {response.StatusCode} - {responseContent}");
            }
        }

        /// <summary>
        /// 發送 WhatsApp 模板 API 請求
        /// </summary>
        /// <param name="company">公司配置</param>
        /// <param name="to">收件人電話號碼</param>
        /// <param name="templateName">模板名稱</param>
        /// <returns></returns>
        private async Task SendWhatsAppTemplateApiRequestAsync(Company company, string to, string templateName)
        {
            var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
            
            var payload = new
            {
                messaging_product = "whatsapp",
                to = to,
                type = "template",
                template = new
                {
                    name = templateName,
                    language = new { code = "zh_HK" } // 改為香港繁體中文
                }
            };

                         var jsonPayload = JsonSerializer.Serialize(payload);
             _loggingService.LogInformation($"WhatsApp Template API URL: {url}");
             _loggingService.LogInformation($"WhatsApp Template API Payload: {jsonPayload}");

             using var httpClient = new HttpClient();
             httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
             
             var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
             
             _loggingService.LogInformation($"開始發送 WhatsApp 模板消息...");
             var response = await httpClient.PostAsync(url, content);
             var responseContent = await response.Content.ReadAsStringAsync();
             
             _loggingService.LogInformation($"WhatsApp Template API Response Status: {response.StatusCode}");
             _loggingService.LogInformation($"WhatsApp Template API Response Content: {responseContent}");

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"WhatsApp Template API 請求失敗: {response.StatusCode} - {responseContent}");
            }
        }
    }
} 