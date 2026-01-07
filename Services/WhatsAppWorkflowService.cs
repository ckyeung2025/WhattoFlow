using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using PurpleRice.Models;
using PurpleRice.Services;

namespace PurpleRice.Services
{
    public class WhatsAppWorkflowService
    {
        private readonly LoggingService _loggingService;
        private readonly WorkflowMessageSendService _messageSendService;
        private readonly RecipientResolverService _recipientResolverService;
        private readonly IConfiguration _configuration;
        
        public WhatsAppWorkflowService(
            Func<string, LoggingService> loggingServiceFactory,
            WorkflowMessageSendService messageSendService,
            RecipientResolverService recipientResolverService,
            IConfiguration configuration)
        {
            _loggingService = loggingServiceFactory("WhatsAppService");
            _messageSendService = messageSendService;
            _recipientResolverService = recipientResolverService;
            _configuration = configuration;
        }

        /// <summary>
        /// 獲取 Meta API 版本
        /// </summary>
        /// <returns>API 版本字符串</returns>
        private string GetApiVersion()
        {
            return WhatsAppApiConfig.GetApiVersion();
        }

        /// <summary>
        /// 上傳媒體文件到 Meta 並獲取 media_id（用於發送消息）
        /// </summary>
        /// <param name="company">公司對象</param>
        /// <param name="mediaUrl">媒體文件 URL</param>
        /// <param name="mediaType">媒體類型（image/video/document）</param>
        /// <returns>media_id</returns>
        private async Task<string> UploadMediaAndGetMediaIdAsync(Company company, string mediaUrl, string mediaType)
        {
            try
            {
                _loggingService.LogInformation($"📤 開始上傳媒體到 Meta 獲取 media_id - URL: {mediaUrl}, 類型: {mediaType}");

                if (string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    throw new Exception("未找到 WhatsApp Phone Number ID");
                }

                // 步驟1: 下載媒體文件
                using var downloadClient = new HttpClient();
                var mediaResponse = await downloadClient.GetAsync(mediaUrl);
                if (!mediaResponse.IsSuccessStatusCode)
                {
                    throw new Exception($"無法下載媒體文件: {mediaResponse.StatusCode}");
                }

                var mediaBytes = await mediaResponse.Content.ReadAsByteArrayAsync();
                var fileName = mediaUrl.Split('/').Last().Split('?').First(); // 獲取文件名
                var fileExtension = Path.GetExtension(fileName).TrimStart('.');
                
                _loggingService.LogInformation($"✅ 下載媒體文件成功，大小: {mediaBytes.Length} bytes, 文件名: {fileName}");
                _loggingService.LogInformation($"📤 準備上傳媒體 - Type: {mediaType}, MIME: 將根據類型確定");

                // 步驟2: 確定 MIME 類型
                string mimeType;
                switch (mediaType.ToLower())
                {
                    case "image":
                        mimeType = fileExtension.ToLower() switch
                        {
                            "jpg" or "jpeg" => "image/jpeg",
                            "png" => "image/png",
                            "gif" => "image/gif",
                            "webp" => "image/webp",
                            "bmp" => "image/bmp",
                            _ => "image/jpeg"
                        };
                        break;
                    case "video":
                        mimeType = fileExtension.ToLower() switch
                        {
                            "mp4" => "video/mp4",
                            "avi" => "video/x-msvideo",
                            "mov" => "video/quicktime",
                            "wmv" => "video/x-ms-wmv",
                            "flv" => "video/x-flv",
                            "webm" => "video/webm",
                            "mkv" => "video/x-matroska",
                            "m4v" => "video/x-m4v",
                            "3gp" => "video/3gpp",
                            _ => "video/mp4"
                        };
                        break;
                    case "document":
                        mimeType = fileExtension.ToLower() switch
                        {
                            "pdf" => "application/pdf",
                            "doc" => "application/msword",
                            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            "txt" => "text/plain",
                            "xls" => "application/vnd.ms-excel",
                            "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            "ppt" => "application/vnd.ms-powerpoint",
                            "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                            _ => "application/pdf"
                        };
                        break;
                    default:
                        mimeType = "application/octet-stream";
                        break;
                }

                // 步驟3: 上傳到 Meta API 獲取 media_id
                // POST /{PHONE_NUMBER_ID}/media
                using var uploadClient = new HttpClient();
                uploadClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                var uploadUrl = $"https://graph.facebook.com/{GetApiVersion()}/{company.WA_PhoneNo_ID}/media";
                
                var formData = new MultipartFormDataContent();
                formData.Add(new StringContent("whatsapp"), "messaging_product");
                formData.Add(new StringContent(mediaType.ToLower()), "type");
                
                var fileContent = new ByteArrayContent(mediaBytes);
                fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
                formData.Add(fileContent, "file", fileName);

                _loggingService.LogInformation($"📤 上傳媒體到 Meta - URL: {uploadUrl}");
                _loggingService.LogInformation($"📤 上傳參數: messaging_product=whatsapp, type={mediaType.ToLower()}, file={fileName}, Content-Type={mimeType}");

                var uploadResponse = await uploadClient.PostAsync(uploadUrl, formData);
                var uploadContent = await uploadResponse.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 上傳響應: {uploadContent}");

                if (!uploadResponse.IsSuccessStatusCode)
                {
                    throw new Exception($"上傳媒體失敗: {uploadResponse.StatusCode} - {uploadContent}");
                }

                // 解析響應獲取 media_id
                var uploadResult = JsonSerializer.Deserialize<JsonElement>(uploadContent);
                
                if (uploadResult.TryGetProperty("id", out var mediaIdElement))
                {
                    var mediaId = mediaIdElement.GetString();
                    _loggingService.LogInformation($"✅ 上傳成功，獲取 media_id: {mediaId}");
                    return mediaId;
                }
                else
                {
                    throw new Exception($"上傳響應中未找到 'id' 字段: {uploadContent}");
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 上傳媒體獲取 media_id 失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 統一的 WhatsApp 消息發送方法
        /// </summary>
        /// <param name="to">收件人電話號碼</param>
        /// <param name="message">消息內容</param>
        /// <param name="execution">工作流程執行記錄</param>
        /// <param name="dbContext">資料庫上下文</param>
        /// <returns></returns>
        public async Task SendWhatsAppMessageAsync(string to, string message, WorkflowExecution execution, PurpleRiceDbContext dbContext)
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
                var company = await GetCompanyConfigurationAsync(execution, dbContext);
                
                // 格式化電話號碼
                var formattedTo = FormatPhoneNumber(to);
                
                _loggingService.LogInformation($"原始電話號碼: {to}");
                _loggingService.LogInformation($"格式化後電話號碼: {formattedTo}");

                // 發送 WhatsApp 消息
                var messageId = await SendWhatsAppTextMessageAsync(company, formattedTo, message);

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
        /// 發送 WhatsApp 內部模板消息（完全替換 Meta 模板功能）
        /// </summary>
        /// <param name="to">收件人電話號碼</param>
        /// <param name="templateId">內部模板 ID</param>
        /// <param name="execution">工作流程執行記錄</param>
        /// <param name="dbContext">資料庫上下文</param>
        /// <param name="variables">模板變數（可選）</param>
        /// <returns></returns>
        public async Task<string> SendWhatsAppTemplateMessageAsync(
            string to, 
            string templateId, 
            WorkflowExecution execution, 
            PurpleRiceDbContext dbContext, 
            Dictionary<string, string> variables = null,
            bool isMetaTemplate = false,
            string templateName = null,
            string templateLanguage = null,  // 添加語言代碼參數
            string templateHeaderUrl = null,  // 添加 header URL 參數
            string templateHeaderType = null,  // 添加 header 類型參數
            string templateHeaderFilename = null)  // 添加 header filename 參數
        {
            try
            {
                // 獲取公司配置
                var company = await GetCompanyConfigurationAsync(execution, dbContext);
                
                // 判斷使用內部模板還是 Meta 模板
                if (isMetaTemplate)
                {
                    _loggingService.LogInformation($"=== 使用 Meta 官方模板發送消息 ===");
                    _loggingService.LogInformation($"Meta 模板名稱: {templateName}");
                    _loggingService.LogInformation($"Meta 模板語言: {templateLanguage ?? "未指定（將使用 zh_TW）"}");
                    
                    if (string.IsNullOrEmpty(templateName))
                    {
                        throw new Exception("Meta 模板名稱不能為空");
                    }
                    
                    // 調用 Meta 模板發送方法
                    return await SendMetaTemplateMessageAsync(to, templateName, variables, company, templateLanguage, dbContext, templateHeaderUrl, templateHeaderType, templateHeaderFilename);
                }
                else
                {
                    // === 內部模板發送邏輯 ===
                    _loggingService.LogInformation($"=== 使用內部模板發送 WhatsApp 消息開始 ===");
                    _loggingService.LogInformation($"收件人: {to}");
                    _loggingService.LogInformation($"內部模板 ID: {templateId}");
                    _loggingService.LogInformation($"執行 ID: {execution.Id}");
                    _loggingService.LogInformation($"模板變數: {JsonSerializer.Serialize(variables)}");

                    // 驗證必要參數
                    if (string.IsNullOrEmpty(templateId))
                    {
                        throw new Exception("內部模板 ID 不能為空");
                    }

                    if (execution == null)
                    {
                        throw new Exception("工作流程執行記錄不能為空");
                    }
                    
                    // 格式化電話號碼
                    var formattedTo = FormatPhoneNumber(to);
                    
                    _loggingService.LogInformation($"原始電話號碼: {to}");
                    _loggingService.LogInformation($"格式化後電話號碼: {formattedTo}");

                    // 通過 ID 查詢內部模板
                    var internalTemplate = await dbContext.WhatsAppTemplates
                    .FirstOrDefaultAsync(t => t.Id.ToString() == templateId && t.Status == "Active" && !t.IsDeleted);

                if (internalTemplate == null)
                {
                    // 如果通過 ID 找不到，嘗試通過名稱查找（向後兼容）
                    _loggingService.LogWarning($"通過 ID {templateId} 找不到模板，嘗試通過名稱查找");
                    internalTemplate = await dbContext.WhatsAppTemplates
                        .FirstOrDefaultAsync(t => t.Name == templateId && t.Status == "Active" && !t.IsDeleted);
                    
                    if (internalTemplate == null)
                    {
                        throw new Exception($"找不到內部模板: ID={templateId}，或模板未啟用");
                    }
                }

                _loggingService.LogInformation($"找到內部模板: {internalTemplate.Name}, 類型: {internalTemplate.TemplateType}, ID: {internalTemplate.Id}");

                // 根據模板類型發送不同的消息
                switch (internalTemplate.TemplateType.ToLower())
                {
                    case "text":
                        await SendInternalTextTemplateAsync(company, formattedTo, internalTemplate, variables);
                        break;
                    case "interactive":
                        await SendInternalInteractiveTemplateAsync(company, formattedTo, internalTemplate, variables);
                        break;
                    case "location":
                        await SendInternalLocationTemplateAsync(company, formattedTo, internalTemplate, variables);
                        break;
                    case "media":
                        await SendInternalMediaTemplateAsync(company, formattedTo, internalTemplate, variables);
                        break;
                    case "contact":
                        await SendInternalContactTemplateAsync(company, formattedTo, internalTemplate, variables);
                        break;
                    default:
                        throw new Exception($"不支援的模板類型: {internalTemplate.TemplateType}");
                }

                _loggingService.LogInformation($"成功使用內部模板發送 WhatsApp 消息到 {formattedTo}");
                _loggingService.LogInformation($"=== 使用內部模板發送 WhatsApp 消息完成 ===");
                
                // 返回一個臨時 ID（因為內部模板方法還沒有返回值）
                return $"template_{Guid.NewGuid():N}";
                }
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
        /// <param name="dbContext">資料庫上下文</param>
        /// <returns>公司配置</returns>
        private async Task<Company> GetCompanyConfigurationAsync(WorkflowExecution execution, PurpleRiceDbContext dbContext)
        {
            _loggingService.LogInformation($"開始查詢公司配置，執行 ID: {execution.Id}");

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

            _loggingService.LogInformation($"找到公司記錄: {company.Name} (ID: {company.Id})");

            // 驗證 WhatsApp 配置
            if (string.IsNullOrEmpty(company.WA_API_Key))
            {
                throw new Exception("該公司未配置 WhatsApp API Key");
            }

            if (string.IsNullOrEmpty(company.WA_PhoneNo_ID))
            {
                throw new Exception("該公司未配置 WhatsApp Phone Number ID");
            }

            // 記錄部分 API Key 和 Phone Number ID（用於調試，不記錄完整值）
            var maskedApiKey = company.WA_API_Key.Length > 8 
                ? $"{company.WA_API_Key.Substring(0, 4)}...{company.WA_API_Key.Substring(company.WA_API_Key.Length - 4)}" 
                : "***";
            var maskedPhoneId = company.WA_PhoneNo_ID.Length > 8 
                ? $"{company.WA_PhoneNo_ID.Substring(0, 4)}...{company.WA_PhoneNo_ID.Substring(company.WA_PhoneNo_ID.Length - 4)}" 
                : "***";
            
            _loggingService.LogInformation($"🔑 公司 WhatsApp 配置 - API Key: {maskedApiKey}, Phone Number ID: {maskedPhoneId}, Business Account ID: {company.WA_Business_Account_ID ?? "null"}");
            
            // ⚠️ 重要警告：如果配置了 Business Account ID，但 Phone Number ID 可能屬於不同的 WABA
            // 這會導致發送消息時找不到模板（因為模板屬於 Business Account ID 指定的 WABA）
            if (!string.IsNullOrEmpty(company.WA_Business_Account_ID))
            {
                _loggingService.LogWarning($"⚠️ 重要：請確保 Phone Number ID ({maskedPhoneId}) 屬於 Business Account ID ({company.WA_Business_Account_ID}) 指定的 WABA。如果不匹配，發送消息時可能找不到模板。");
            }

            return company;
        }

        /// <summary>
        /// 格式化電話號碼
        /// </summary>
        /// <param name="phoneNumber">原始電話號碼</param>
        /// <returns>格式化後的電話號碼</returns>
        private string FormatPhoneNumber(string phoneNumber)
        {
            if (string.IsNullOrWhiteSpace(phoneNumber))
            {
                return phoneNumber;
            }
            
            // ✅ 第一步：移除所有非數字字符（+, -, 空格等）
            var cleanedNumber = new string(phoneNumber.Where(char.IsDigit).ToArray());
            _loggingService.LogInformation($"清理後的電話號碼: {cleanedNumber}");
            
            var countryCode = "852"; // 暫時硬編碼香港區號，可以之後從公司設定獲取
            
            // 檢查電話號碼是否已經包含國家代碼
            if (!cleanedNumber.StartsWith(countryCode))
            {
                // 移除開頭的 0（如果有的話）
                if (cleanedNumber.StartsWith("0"))
                {
                    cleanedNumber = cleanedNumber.Substring(1);
                }
                // 添加國家代碼
                return countryCode + cleanedNumber;
            }
            else
            {
                // 已經包含國家代碼，直接使用
                return cleanedNumber;
            }
        }

        /// <summary>
        /// 發送 WhatsApp 文字消息
        /// </summary>
        private async Task<string> SendWhatsAppTextMessageAsync(Company company, string to, string message)
        {
            var url = $"https://graph.facebook.com/{GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";
            
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
            
            _loggingService.LogInformation($"開始發送 WhatsApp 文字消息...");
            var response = await httpClient.PostAsync(url, content);
            var responseContent = await response.Content.ReadAsStringAsync();
            
            _loggingService.LogInformation($"WhatsApp API Response Status: {response.StatusCode}");
            _loggingService.LogInformation($"WhatsApp API Response Content: {responseContent}");

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"WhatsApp API 請求失敗: {response.StatusCode} - {responseContent}");
            }

            // 解析回應以獲取 WhatsApp 訊息 ID
            try
            {
                var responseJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
                if (responseJson.TryGetProperty("messages", out var messages) && 
                    messages.GetArrayLength() > 0)
                {
                    var messageId = messages[0].GetProperty("id").GetString();
                    _loggingService.LogInformation($"WhatsApp 訊息 ID: {messageId}");
                    return messageId;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogWarning($"解析 WhatsApp 回應失敗: {ex.Message}");
            }

            // 如果無法解析訊息 ID，返回一個臨時 ID
            var tempId = $"temp_{Guid.NewGuid():N}";
            _loggingService.LogInformation($"使用臨時訊息 ID: {tempId}");
            return tempId;
        }

        /// <summary>
        /// 發送內部文字模板
        /// </summary>
        private async Task SendInternalTextTemplateAsync(Company company, string to, WhatsAppTemplate template, Dictionary<string, string> variables)
        {
            try
            {
                var templateContent = JsonSerializer.Deserialize<JsonElement>(template.Content);
                var content = templateContent.GetProperty("content").GetString();
                
                // 替換變數
                if (variables != null)
                {
                    foreach (var variable in variables)
                    {
                        content = content.Replace($"{{{{{variable.Key}}}}}", variable.Value ?? "");
                    }
                }

                _loggingService.LogInformation($"渲染後的文字內容: {content}");
                var messageId = await SendWhatsAppTextMessageAsync(company, to, content);
            }
            catch (Exception ex)
            {
                throw new Exception($"處理文字模板失敗: {ex.Message}");
            }
        }

        /// <summary>
        /// 發送內部位置模板
        /// </summary>
        private async Task SendInternalLocationTemplateAsync(Company company, string to, WhatsAppTemplate template, Dictionary<string, string> variables)
        {
            try
            {
                var templateContent = JsonSerializer.Deserialize<JsonElement>(template.Content);
                var latitude = templateContent.GetProperty("latitude").GetString();
                var longitude = templateContent.GetProperty("longitude").GetString();
                var name = templateContent.GetProperty("name").GetString();
                var address = templateContent.GetProperty("address").GetString();

                // 替換變數
                if (variables != null)
                {
                    latitude = ReplaceVariables(latitude, variables);
                    longitude = ReplaceVariables(longitude, variables);
                    name = ReplaceVariables(name, variables);
                    address = ReplaceVariables(address, variables);
                }

                var url = $"https://graph.facebook.com/{GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";
                
                var payload = new
                {
                    messaging_product = "whatsapp",
                    to = to,
                    type = "location",
                    location = new
                    {
                        latitude = latitude,
                        longitude = longitude,
                        name = name,
                        address = address
                    }
                };

                var jsonPayload = JsonSerializer.Serialize(payload);
                _loggingService.LogInformation($"WhatsApp Location API URL: {url}");
                _loggingService.LogInformation($"WhatsApp Location API Payload: {jsonPayload}");

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                
                _loggingService.LogInformation($"開始發送 WhatsApp 位置消息...");
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"WhatsApp Location API Response Status: {response.StatusCode}");
                _loggingService.LogInformation($"WhatsApp Location API Response Content: {responseContent}");

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"WhatsApp Location API 請求失敗: {response.StatusCode} - {responseContent}");
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"處理位置模板失敗: {ex.Message}");
            }
        }

        /// <summary>
        /// 發送內部媒體模板
        /// </summary>
        private async Task SendInternalMediaTemplateAsync(Company company, string to, WhatsAppTemplate template, Dictionary<string, string> variables)
        {
            try
            {
                var templateContent = JsonSerializer.Deserialize<JsonElement>(template.Content);
                var mediaType = templateContent.GetProperty("mediaType").GetString();
                var mediaUrl = templateContent.GetProperty("mediaUrl").GetString();
                var caption = templateContent.GetProperty("caption").GetString();

                // 替換變數
                if (variables != null)
                {
                    mediaUrl = ReplaceVariables(mediaUrl, variables);
                    caption = ReplaceVariables(caption, variables);
                }

                var url = $"https://graph.facebook.com/{GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";
                
                // 根據媒體類型創建不同的 payload
                object payload;
                
                switch (mediaType.ToLower())
                {
                    case "image":
                        payload = new
                        {
                            messaging_product = "whatsapp",
                            to = to,
                            type = "image",
                            image = new
                            {
                                link = mediaUrl,
                                caption = caption
                            }
                        };
                        break;
                        
                    case "video":
                        payload = new
                        {
                            messaging_product = "whatsapp",
                            to = to,
                            type = "video",
                            video = new
                            {
                                link = mediaUrl,
                                caption = caption
                            }
                        };
                        break;
                        
                    case "audio":
                        payload = new
                        {
                            messaging_product = "whatsapp",
                            to = to,
                            type = "audio",
                            audio = new
                            {
                                link = mediaUrl
                            }
                        };
                        break;
                        
                    case "document":
                        payload = new
                        {
                            messaging_product = "whatsapp",
                            to = to,
                            type = "document",
                            document = new
                            {
                                link = mediaUrl,
                                caption = caption
                            }
                        };
                        break;
                        
                    default:
                        throw new Exception($"不支援的媒體類型: {mediaType}");
                }

                var jsonPayload = JsonSerializer.Serialize(payload);
                _loggingService.LogInformation($"WhatsApp Media API URL: {url}");
                _loggingService.LogInformation($"WhatsApp Media API Payload: {jsonPayload}");

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                
                _loggingService.LogInformation($"開始發送 WhatsApp 媒體消息...");
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"WhatsApp Media API Response Status: {response.StatusCode}");
                _loggingService.LogInformation($"WhatsApp Media API Response Content: {responseContent}");

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"WhatsApp Media API 請求失敗: {response.StatusCode} - {responseContent}");
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"處理媒體模板失敗: {ex.Message}");
            }
        }

        /// <summary>
        /// 發送內部聯絡人模板
        /// </summary>
        private async Task SendInternalContactTemplateAsync(Company company, string to, WhatsAppTemplate template, Dictionary<string, string> variables)
        {
            try
            {
                var templateContent = JsonSerializer.Deserialize<JsonElement>(template.Content);
                
                // 使用正確的屬性名稱，與 JSON 結構匹配
                var name = templateContent.GetProperty("name").GetString();
                var phone = templateContent.GetProperty("phone").GetString();
                var email = templateContent.GetProperty("email").GetString();

                // 替換變數
                if (variables != null)
                {
                    name = ReplaceVariables(name, variables);
                    phone = ReplaceVariables(phone, variables);
                    email = ReplaceVariables(email, variables);
                }

                var url = $"https://graph.facebook.com/{GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";
                
                var payload = new
                {
                    messaging_product = "whatsapp",
                    to = to,
                    type = "contacts",
                    contacts = new[]
                    {
                        new
                        {
                            name = new
                            {
                                formatted_name = name,
                                first_name = name.Split(' ').FirstOrDefault() ?? name
                            },
                            phones = new[]
                            {
                                new
                                {
                                    phone = phone,
                                    type = "CELL"
                                }
                            },
                            emails = !string.IsNullOrEmpty(email) ? new[]
                            {
                                new
                                {
                                    email = email,
                                    type = "WORK"
                                }
                            } : null
                        }
                    }
                };

                var jsonPayload = JsonSerializer.Serialize(payload);
                _loggingService.LogInformation($"WhatsApp Contact API URL: {url}");
                _loggingService.LogInformation($"WhatsApp Contact API Payload: {jsonPayload}");

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                
                _loggingService.LogInformation($"開始發送 WhatsApp 聯絡人消息...");
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"WhatsApp Contact API Response Status: {response.StatusCode}");
                _loggingService.LogInformation($"WhatsApp Contact API Response Content: {responseContent}");

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"WhatsApp Contact API 請求失敗: {response.StatusCode} - {responseContent}");
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"處理聯絡人模板失敗: {ex.Message}");
            }
        }

        /// <summary>
        /// 發送 Interactive 類型的 WhatsApp 模板消息
        /// </summary>
        private async Task SendInternalInteractiveTemplateAsync(Company company, string to, WhatsAppTemplate template, Dictionary<string, string> variables)
        {
            try
            {
                _loggingService.LogInformation($"=== 發送 Interactive 模板開始 ===");
                _loggingService.LogInformation($"模板名稱: {template.Name}");
                _loggingService.LogInformation($"模板內容: {template.Content}");
                
                var templateContent = JsonSerializer.Deserialize<JsonElement>(template.Content);
                
                // 獲取 Interactive 類型
                var interactiveType = templateContent.GetProperty("interactiveType").GetString();
                var header = templateContent.TryGetProperty("header", out var headerProp) ? headerProp.GetString() : "";
                var body = templateContent.GetProperty("body").GetString();
                var footer = templateContent.TryGetProperty("footer", out var footerProp) ? footerProp.GetString() : "";
                
                _loggingService.LogInformation($"Interactive 類型: {interactiveType}");
                _loggingService.LogInformation($"Header: {header}");
                _loggingService.LogInformation($"Body: {body}");
                _loggingService.LogInformation($"Footer: {footer}");
                
                // 替換變數
                if (variables != null)
                {
                    header = ReplaceVariables(header, variables);
                    body = ReplaceVariables(body, variables);
                    footer = ReplaceVariables(footer, variables);
                }
                
                var url = $"https://graph.facebook.com/{GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";
                
                // 根據不同的 Interactive 類型構建不同的 payload
                object payload;
                
                switch (interactiveType.ToLower())
                {
                    case "button":
                        payload = BuildButtonPayload(to, header, body, footer, templateContent);
                        break;
                    case "list":
                        payload = BuildListPayload(to, header, body, footer, templateContent);
                        break;
                    case "product":
                        payload = BuildProductPayload(to, header, body, footer, templateContent);
                        break;
                    default:
                        throw new Exception($"不支援的 Interactive 類型: {interactiveType}");
                }
                
                var jsonPayload = JsonSerializer.Serialize(payload);
                _loggingService.LogInformation($"WhatsApp Interactive API URL: {url}");
                _loggingService.LogInformation($"WhatsApp Interactive API Payload: {jsonPayload}");

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                
                _loggingService.LogInformation($"開始發送 WhatsApp Interactive 消息...");
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"WhatsApp Interactive API Response Status: {response.StatusCode}");
                _loggingService.LogInformation($"WhatsApp Interactive API Response Content: {responseContent}");

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"WhatsApp Interactive API 請求失敗: {response.StatusCode} - {responseContent}");
                }
                
                _loggingService.LogInformation($"=== 發送 Interactive 模板完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理 Interactive 模板失敗: {ex.Message}", ex);
                throw new Exception($"處理 Interactive 模板失敗: {ex.Message}");
            }
        }
        
        /// <summary>
        /// 構建 Button 類型的 payload
        /// </summary>
        private object BuildButtonPayload(string to, string header, string body, string footer, JsonElement templateContent)
        {
            var action = templateContent.GetProperty("action");
            var buttons = new List<object>();
            
            if (action.TryGetProperty("buttons", out var buttonsProp) && buttonsProp.GetArrayLength() > 0)
            {
                foreach (var button in buttonsProp.EnumerateArray())
                {
                    // Button 類型只支持 reply 類型的按鈕
                    // WhatsApp Business API 的 Button 類型不支持 url 和 phone_number
                    var buttonType = button.GetProperty("type").GetString();
                    
                    if (buttonType == "reply")
                    {
                        var reply = button.GetProperty("reply");
                        buttons.Add(new
                        {
                            type = "reply",
                            reply = new
                            {
                                id = reply.GetProperty("id").GetString(),
                                title = reply.GetProperty("title").GetString()
                            }
                        });
                    }
                    else
                    {
                        _loggingService.LogWarning($"Button 類型不支援 {buttonType} 按鈕，已跳過");
                    }
                }
            }
            
            // Button 類型不支持 header 和 footer
            return new
            {
                messaging_product = "whatsapp",
                to = to,
                type = "interactive",
                interactive = new
                {
                    type = "button",
                    body = new { text = body },
                    action = new { buttons = buttons.ToArray() }
                }
            };
        }
        
        /// <summary>
        /// 構建 List 類型的 payload
        /// </summary>
        private object BuildListPayload(string to, string header, string body, string footer, JsonElement templateContent)
        {
            var action = templateContent.GetProperty("action");
            var sections = new List<object>();
            
            if (action.TryGetProperty("sections", out var sectionsProp) && sectionsProp.GetArrayLength() > 0)
            {
                foreach (var section in sectionsProp.EnumerateArray())
                {
                    var rows = new List<object>();
                    
                    if (section.TryGetProperty("rows", out var rowsProp) && rowsProp.GetArrayLength() > 0)
                    {
                        foreach (var row in rowsProp.EnumerateArray())
                        {
                            rows.Add(new
                            {
                                id = row.GetProperty("id").GetString(),
                                title = row.GetProperty("title").GetString(),
                                description = row.TryGetProperty("description", out var descProp) ? descProp.GetString() : ""
                            });
                        }
                    }
                    
                    sections.Add(new
                    {
                        title = section.GetProperty("title").GetString(),
                        rows = rows.ToArray()
                    });
                }
            }
            
            return new
            {
                messaging_product = "whatsapp",
                to = to,
                type = "interactive",
                interactive = new
                {
                    type = "list",
                    header = !string.IsNullOrEmpty(header) ? new { type = "text", text = header } : null,
                    body = new { text = body },
                    footer = !string.IsNullOrEmpty(footer) ? new { text = footer } : null,
                    action = new
                    {
                        button = action.TryGetProperty("button", out var buttonProp) ? buttonProp.GetString() : "選擇選項",
                        sections = sections.ToArray()
                    }
                }
            };
        }
        
        /// <summary>
        /// 構建 Product 類型的 payload
        /// </summary>
        private object BuildProductPayload(string to, string header, string body, string footer, JsonElement templateContent)
        {
            var action = templateContent.GetProperty("action");
            
            // Product 類型不支持 header 和 footer
            return new
            {
                messaging_product = "whatsapp",
                to = to,
                type = "interactive",
                interactive = new
                {
                    type = "product",
                    body = new { text = body },
                    action = new
                    {
                        catalog_id = action.GetProperty("catalog_id").GetString(),
                        product_retailer_id = action.GetProperty("product_retailer_id").GetString()
                    }
                }
            };
        }

        /// <summary>
        /// 發送 Meta 官方模板訊息
        /// </summary>
        private async Task<string> SendMetaTemplateMessageAsync(
            string to, 
            string templateName, 
            Dictionary<string, string> variables,
            Company company,
            string languageCode = null,  // 添加語言代碼參數
            PurpleRiceDbContext dbContext = null,  // 添加 dbContext 參數，用於從數據庫讀取 header_url
            string templateHeaderUrl = null,  // 添加 header URL 參數（可能包含變數）
            string templateHeaderType = null,  // 添加 header 類型參數
            string templateHeaderFilename = null)  // 添加 header filename 參數（可能包含變數）
        {
            try
            {
                _loggingService.LogInformation($"=== 發送 Meta 官方模板消息開始 ===");
                _loggingService.LogInformation($"收件人: {to}");
                _loggingService.LogInformation($"Meta 模板名稱: {templateName}");
                _loggingService.LogInformation($"變數: {JsonSerializer.Serialize(variables)}");
                _loggingService.LogInformation($"變數數量: {variables?.Count ?? 0}");
                
                // 檢查每個變數的詳細信息
                if (variables != null)
                {
                    foreach (var kvp in variables)
                    {
                        _loggingService.LogInformation($"變數詳情: Key='{kvp.Key}', Value='{kvp.Value}', IsEmpty={string.IsNullOrEmpty(kvp.Value)}");
                    }
                }
                
                // 格式化電話號碼
                var formattedTo = FormatPhoneNumber(to);
                
                // 構建 Meta API 的 template components
                var components = new List<object>();
                
                // ========== 智能處理 Header Component (IMAGE/VIDEO/DOCUMENT) ==========
                // 先從 Meta API 獲取 template 定義，檢查 header 是否為靜態
                bool hasStaticHeader = false;
                string templateHeaderFormat = null;
                
                try
                {
                    // 獲取 template 定義以檢查 header 類型
                    var templateUrl = $"https://graph.facebook.com/{GetApiVersion()}/{company.WA_Business_Account_ID}/message_templates";
                    var templateQueryUrl = $"{templateUrl}?name={Uri.EscapeDataString(templateName)}&fields=name,components";
                    
                    using var httpClient = new HttpClient();
                    httpClient.DefaultRequestHeaders.Authorization = 
                        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                    
                    var templateResponse = await httpClient.GetAsync(templateQueryUrl);
                    if (templateResponse.IsSuccessStatusCode)
                    {
                        var templateContent = await templateResponse.Content.ReadAsStringAsync();
                        _loggingService.LogInformation($"🔍 Template 定義響應: {templateContent}");
                        var templateJson = JsonSerializer.Deserialize<JsonElement>(templateContent);
                        
                        if (templateJson.TryGetProperty("data", out var dataArray) && dataArray.GetArrayLength() > 0)
                        {
                            var templateData = dataArray[0];
                            if (templateData.TryGetProperty("components", out var componentsArray))
                            {
                                foreach (var component in componentsArray.EnumerateArray())
                                {
                                    if (component.TryGetProperty("type", out var compType) && 
                                        compType.GetString() == "HEADER")
                                    {
                                        // 檢查是否有 format（IMAGE/VIDEO/DOCUMENT）
                                        // 注意：TEXT header 沒有 format 屬性，或 format 為空
                                        if (component.TryGetProperty("format", out var format))
                                        {
                                            var formatValue = format.GetString();
                                            
                                            // 只有在 format 明確存在且不為空時，才設置 templateHeaderFormat
                                            // 避免 TEXT header 或空的 format 被誤判為 IMAGE/VIDEO/DOCUMENT
                                            // 注意：TEXT header 的 format 可能是 null、空字符串，或者根本沒有 format 屬性
                                            if (!string.IsNullOrEmpty(formatValue) && 
                                                formatValue.ToUpper() != "TEXT")
                                            {
                                                templateHeaderFormat = formatValue;
                                                _loggingService.LogInformation($"🔍 檢測到 Template Header Format: {templateHeaderFormat}");
                                                
                                                // 檢查是否有 example（靜態 header）
                                                if (component.TryGetProperty("example", out var example))
                                            {
                                                // 如果 example 中有 header_handle，說明是靜態的
                                                // header_handle 可能是數組格式：["4:..."] 或單個值
                                                if (example.TryGetProperty("header_handle", out var headerHandle))
                                                {
                                                    // 檢查 header_handle 是否有值（可能是數組或字符串）
                                                    bool hasHandleValue = false;
                                                    
                                                    if (headerHandle.ValueKind == JsonValueKind.Array)
                                                    {
                                                        // 數組格式：["4:..."]
                                                        if (headerHandle.GetArrayLength() > 0)
                                                        {
                                                            var firstHandle = headerHandle[0];
                                                            if (firstHandle.ValueKind == JsonValueKind.String && 
                                                                !string.IsNullOrEmpty(firstHandle.GetString()))
                                                            {
                                                                hasHandleValue = true;
                                                                _loggingService.LogInformation($"✅ 檢測到 header_handle 數組: [{firstHandle.GetString()}]");
                                                            }
                                                        }
                                                    }
                                                    else if (headerHandle.ValueKind == JsonValueKind.String)
                                                    {
                                                        // 字符串格式
                                                        if (!string.IsNullOrEmpty(headerHandle.GetString()))
                                                        {
                                                            hasHandleValue = true;
                                                            _loggingService.LogInformation($"✅ 檢測到 header_handle 字符串: {headerHandle.GetString()}");
                                                        }
                                                    }
                                                    
                                                    if (hasHandleValue)
                                                    {
                                                        hasStaticHeader = true;
                                                        _loggingService.LogInformation($"✅ Template 有靜態 Header（已上傳 handle），發送時無需提供 header component");
                                                    }
                                                    else
                                                    {
                                                        _loggingService.LogInformation($"ℹ️ Template Header 的 header_handle 為空，需要動態參數");
                                                    }
                                                }
                                                else
                                                {
                                                    _loggingService.LogInformation($"ℹ️ Template Header 的 example 中無 header_handle，需要動態參數");
                                                }
                                            }
                                            else
                                            {
                                                // 如果沒有 example，但 format 是 IMAGE/VIDEO/DOCUMENT，可能是動態 header
                                                // 但根據 Meta API，如果定義了 format，通常需要 example
                                                _loggingService.LogInformation($"ℹ️ Template Header 無 example，可能是動態 header");
                                            }
                                            }
                                            else if (formatValue?.ToUpper() == "TEXT")
                                            {
                                                // format 明確是 TEXT
                                                _loggingService.LogInformation($"ℹ️ Template Header format 是 TEXT，不需要 header_url");
                                                templateHeaderFormat = null; // 明確設置為 null，避免誤判
                                            }
                                            else
                                            {
                                                // format 為 null 或空，說明是 TEXT header 或沒有 format
                                                _loggingService.LogInformation($"ℹ️ Template Header format 為空或 null，判定為 TEXT header，不需要 header_url");
                                                templateHeaderFormat = null; // 明確設置為 null，避免誤判
                                            }
                                        }
                                        else
                                        {
                                            // 沒有 format 屬性，說明是 TEXT header
                                            _loggingService.LogInformation($"ℹ️ Template Header 無 format 屬性，是 TEXT header，不需要 header_url");
                                            templateHeaderFormat = null; // 明確設置為 null
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _loggingService.LogWarning($"⚠️ 無法獲取 template 定義，將使用變數判斷: {ex.Message}");
                    // 如果獲取失敗，將 templateHeaderFormat 設為 null，避免誤判
                    // 這樣只有當用戶明確提供 header_url 變數時才會處理
                    templateHeaderFormat = null;
                }
                
                // 根據 Meta API 的官方要求：
                // **重要**：即使 template 有靜態 header_handle（創建時上傳的），發送時**仍然必須**提供 header component
                // 這是 Meta API 的特殊行為：header_handle 只用於審核，發送時需要提供 header_url 或 media_id
                // 所以我們需要：
                // - 無論是否有靜態 header，都需要提供 header_url（從變數、數據庫或文件系統獲取）
                // - 如果沒有提供，Meta API 會報錯
                
                // 檢查用戶是否提供了 header_url
                bool userProvidedHeaderUrl = false;
                string headerUrl = null;
                string headerType = null;
                string headerFilename = null;
                
                // 優先使用從節點數據傳入的 templateHeaderUrl（已包含變數占位符）
                if (!string.IsNullOrEmpty(templateHeaderUrl))
                {
                    // 替換 URL 中的流程變數
                    headerUrl = templateHeaderUrl;
                    if (variables != null && variables.Any())
                    {
                        // 先替換數字鍵（如 "1", "2"），然後替換命名鍵（如 "InvoiceNo"）
                        // 因為 URL 中可能同時包含 ${1} 和 ${InvoiceNo} 格式
                        foreach (var kvp in variables)
                        {
                            // 替換 ${Key} 格式
                            headerUrl = headerUrl.Replace($"${{{kvp.Key}}}", kvp.Value ?? "");
                        }
                        
                        // 如果變數字典的鍵是數字（如 "1"），嘗試從 ProcessVariable 名稱映射
                        // 這需要從 WorkflowEngine 傳遞額外的映射信息，但現在先處理常見情況
                        // 例如：如果變數鍵是 "1" 且值對應 InvoiceNo，嘗試替換 ${InvoiceNo}
                        // 注意：這是一個簡化處理，理想情況下應該從 WorkflowEngine 傳遞完整的變數映射
                    }
                    headerType = templateHeaderType?.ToLower();
                    
                    // 優先使用用戶在屬性頁輸入的 templateHeaderFilename
                    if (!string.IsNullOrEmpty(templateHeaderFilename))
                    {
                        headerFilename = templateHeaderFilename;
                        
                        // 如果 headerFilename 包含變數，替換它
                        if (variables != null && variables.Any())
                        {
                            var originalFilename = headerFilename;
                            foreach (var kvp in variables)
                            {
                                headerFilename = headerFilename.Replace($"${{{kvp.Key}}}", kvp.Value ?? "");
                            }
                            _loggingService.LogInformation($"✅ 使用屬性頁輸入的 templateHeaderFilename: {originalFilename} -> {headerFilename} (已替換變數)");
                        }
                        else
                        {
                            _loggingService.LogInformation($"✅ 使用屬性頁輸入的 templateHeaderFilename: {headerFilename} (無變數)");
                        }
                    }
                    else
                    {
                        _loggingService.LogInformation($"ℹ️ 屬性頁未輸入 templateHeaderFilename，將從 URL 或數據庫讀取");
                    }
                    
                    userProvidedHeaderUrl = true;
                    _loggingService.LogInformation($"✅ 使用節點數據中的 templateHeaderUrl: {headerUrl}, Type: {headerType}, Filename: {headerFilename ?? "未提供"}");
                }
                
                // 如果沒有從節點數據獲取，嘗試從變數中獲取 header_url（無論是否有靜態 header）
                if (string.IsNullOrEmpty(headerUrl) && variables != null && variables.Any())
                {
                    // 檢查是否有 header 相關的變數
                    // 支持以下格式：
                    // - "header_url" 或 "headerUrl"：header 的 URL
                    // - "header_type" 或 "headerType"：header 類型（image/video/document）
                    // - "header_filename" 或 "headerFilename"：文件名（僅 DOCUMENT 需要）
                    
                    // 嘗試從變數中獲取 header 信息
                    if (variables.TryGetValue("header_url", out var headerUrlValue) && !string.IsNullOrEmpty(headerUrlValue))
                    {
                        headerUrl = headerUrlValue;
                        userProvidedHeaderUrl = true;
                    }
                    else if (variables.TryGetValue("headerUrl", out headerUrlValue) && !string.IsNullOrEmpty(headerUrlValue))
                    {
                        headerUrl = headerUrlValue;
                        userProvidedHeaderUrl = true;
                    }
                    else if (variables.TryGetValue("header", out headerUrlValue) && !string.IsNullOrEmpty(headerUrlValue))
                    {
                        headerUrl = headerUrlValue;
                        userProvidedHeaderUrl = true;
                    }
                    
                    if (variables.TryGetValue("header_type", out var headerTypeValue))
                    {
                        headerType = headerTypeValue?.ToLower();
                    }
                    else if (variables.TryGetValue("headerType", out headerTypeValue))
                    {
                        headerType = headerTypeValue?.ToLower();
                    }
                    
                    if (variables.TryGetValue("header_filename", out var headerFilenameValue))
                    {
                        headerFilename = headerFilenameValue;
                    }
                    else if (variables.TryGetValue("headerFilename", out headerFilenameValue))
                    {
                        headerFilename = headerFilenameValue;
                    }
                }
                
                // 即使有靜態 header_handle，Meta API 仍然要求提供 header component
                // 所以需要從數據庫或文件系統獲取 header_url
                if (string.IsNullOrEmpty(headerUrl) && !string.IsNullOrEmpty(templateHeaderFormat))
                {
                    // 優先從數據庫讀取
                    if (dbContext != null)
                    {
                        try
                        {
                            _loggingService.LogInformation($"🔍 嘗試從數據庫讀取 template {templateName} (CompanyId: {company.Id}) 的 HeaderUrl...");
                            
                            // 使用 Select 時處理 NULL 值，避免 SqlNullValueException
                            var templateRecord = await dbContext.WhatsAppTemplates
                                .Where(t => 
                                    t.CompanyId == company.Id && 
                                    t.Name == templateName && 
                                    t.TemplateSource == "Meta")
                                .Select(t => new { 
                                    HeaderUrl = t.HeaderUrl ?? string.Empty, 
                                    HeaderType = t.HeaderType ?? string.Empty, 
                                    HeaderFilename = t.HeaderFilename ?? string.Empty
                                })
                                .FirstOrDefaultAsync();
                            
                            if (templateRecord != null)
                            {
                                _loggingService.LogInformation($"🔍 找到數據庫記錄: HeaderUrl={(string.IsNullOrEmpty(templateRecord.HeaderUrl) ? "空" : templateRecord.HeaderUrl)}, HeaderType={(string.IsNullOrEmpty(templateRecord.HeaderType) ? "空" : templateRecord.HeaderType)}, HeaderFilename={(string.IsNullOrEmpty(templateRecord.HeaderFilename) ? "空" : templateRecord.HeaderFilename)}");
                                
                                if (!string.IsNullOrEmpty(templateRecord.HeaderUrl))
                                {
                                    headerUrl = templateRecord.HeaderUrl;
                                    headerType = string.IsNullOrEmpty(templateRecord.HeaderType) ? templateHeaderFormat.ToLower() : templateRecord.HeaderType;
                                    
                                    // 只有在用戶沒有提供 filename 時，才從數據庫讀取
                                    if (string.IsNullOrEmpty(headerFilename) && !string.IsNullOrEmpty(templateRecord.HeaderFilename))
                                    {
                                        headerFilename = templateRecord.HeaderFilename;
                                        _loggingService.LogInformation($"✅ 從數據庫讀取 Header Filename: {headerFilename}");
                                    }
                                    
                                    _loggingService.LogInformation($"✅ 從數據庫讀取 Header URL: {headerUrl}, Type: {headerType}, Filename: {headerFilename ?? "使用用戶輸入或未提供"}");
                                    userProvidedHeaderUrl = false; // 標記為自動獲取
                                }
                                else
                                {
                                    _loggingService.LogWarning($"⚠️ 數據庫記錄存在，但 HeaderUrl 為空。Template 名稱: {templateName}, CompanyId: {company.Id}");
                                }
                            }
                            else
                            {
                                _loggingService.LogWarning($"⚠️ 數據庫中未找到 template 記錄。Template 名稱: {templateName}, CompanyId: {company.Id}, TemplateSource: Meta");
                            }
                        }
                        catch (Exception ex)
                        {
                            _loggingService.LogWarning($"⚠️ 從數據庫讀取 header_url 失敗: {ex.Message}");
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning($"⚠️ dbContext 為 null，無法從數據庫讀取 header_url");
                    }
                    
                    // 如果數據庫中沒有，嘗試從文件系統查找（作為備選方案）
                    if (string.IsNullOrEmpty(headerUrl))
                    {
                        try
                        {
                            // 檢查 public/meta-templates 目錄中的文件
                            // 注意：這只是嘗試，實際的文件名可能包含時間戳和 GUID
                            var webRootPath = System.IO.Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                            var metaTemplatesPath = System.IO.Path.Combine(webRootPath, "public", "meta-templates");
                            
                            if (Directory.Exists(metaTemplatesPath))
                            {
                                // 獲取所有文件
                                var files = Directory.GetFiles(metaTemplatesPath);
                                
                                // 根據 header format 過濾文件類型
                                var extensions = templateHeaderFormat.ToUpper() switch
                                {
                                    "IMAGE" => new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp" },
                                    "VIDEO" => new[] { ".mp4", ".avi", ".mov", ".wmv" },
                                    "DOCUMENT" => new[] { ".pdf", ".doc", ".docx", ".txt" },
                                    _ => new[] { ".jpg", ".jpeg", ".png" }
                                };
                                
                                // 查找匹配的文件（按修改時間排序，取最新的）
                                var matchingFiles = files
                                    .Where(f => extensions.Contains(System.IO.Path.GetExtension(f).ToLowerInvariant()))
                                    .OrderByDescending(f => new FileInfo(f).LastWriteTime)
                                    .ToList();
                                
                                if (matchingFiles.Any())
                                {
                                    // 使用最新的文件（假設是最近創建的）
                                    var latestFile = matchingFiles.First();
                                    var fileName = System.IO.Path.GetFileName(latestFile);
                                    
                                    // 構建完整的 HTTPS URL
                                    // 優先從配置讀取 BaseUrl，如果沒有則使用默認值
                                    var baseUrl = _configuration["AppSettings:BaseUrl"] 
                                        ?? _configuration["BaseUrl"] 
                                        ?? _configuration["ASPNETCORE_URLS"]?.Split(';').FirstOrDefault(u => u.StartsWith("https://"))
                                        ?? "https://yourdomain.com"; // 默認值，需要用戶配置
                                    
                                    // 確保 baseUrl 以 / 結尾時移除，避免重複
                                    baseUrl = baseUrl.TrimEnd('/');
                                    
                                    headerUrl = $"{baseUrl}/public/meta-templates/{fileName}";
                                    headerType = templateHeaderFormat.ToLower();
                                    
                                    _loggingService.LogInformation($"🔍 從文件系統找到匹配的文件: {fileName}");
                                    _loggingService.LogInformation($"📎 構建完整 URL: {headerUrl}");
                                    
                                    // 如果使用默認值，記錄警告
                                    if (baseUrl == "https://yourdomain.com")
                                    {
                                        _loggingService.LogWarning($"⚠️ 請在 appsettings.json 中配置 BaseUrl 或 AppSettings:BaseUrl，當前使用默認值");
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _loggingService.LogWarning($"⚠️ 嘗試從文件系統查找 header URL 失敗: {ex.Message}");
                        }
                    }
                }
                
                // 驗證 header URL 是否為完整的 HTTPS URL（Meta API 要求）
                // 即使有靜態 header，也需要提供 header_url
                if (!string.IsNullOrEmpty(headerUrl) && !string.IsNullOrEmpty(templateHeaderFormat))
                {
                    // 檢查是否為相對路徑（以 / 開頭且不是完整的 URL）
                    bool isRelativePath = headerUrl.StartsWith("/") && !headerUrl.StartsWith("//");
                    
                    // 檢查是否為有效的絕對 URI（必須包含 scheme://）
                    bool isValidAbsoluteUri = Uri.TryCreate(headerUrl, UriKind.Absolute, out var uri) 
                        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
                    
                    // 如果是相對路徑或不是有效的絕對 URI，轉換為完整 URL
                    if (isRelativePath || !isValidAbsoluteUri)
                    {
                        var baseUrl = _configuration["AppSettings:BaseUrl"] 
                            ?? _configuration["BaseUrl"] 
                            ?? _configuration["ASPNETCORE_URLS"]?.Split(';').FirstOrDefault(u => u.StartsWith("https://"))
                            ?? "https://yourdomain.com";
                        
                        baseUrl = baseUrl.TrimEnd('/');
                        headerUrl = $"{baseUrl}{headerUrl}";
                        
                        _loggingService.LogInformation($"🔧 將相對路徑轉換為完整 URL: {headerUrl}");
                    }
                    
                    // 驗證 URL 是否為 HTTPS（僅對有效的 HTTP URL 進行轉換）
                    if (Uri.TryCreate(headerUrl, UriKind.Absolute, out var finalUri) 
                        && finalUri.Scheme == Uri.UriSchemeHttp)
                    {
                        _loggingService.LogWarning($"⚠️ Header URL 是 HTTP，轉換為 HTTPS: {headerUrl}");
                        headerUrl = headerUrl.Replace("http://", "https://", StringComparison.OrdinalIgnoreCase);
                        _loggingService.LogInformation($"🔧 已將 HTTP 轉換為 HTTPS: {headerUrl}");
                    }
                }
                
                // 如果有 header URL 且 template 有 header format，構建 header component
                // 即使有靜態 header_handle，Meta API 仍然要求提供 header component
                if (!string.IsNullOrEmpty(headerUrl) && !string.IsNullOrEmpty(templateHeaderFormat))
                    {
                        // 如果沒有指定類型，從 template 定義中獲取，或默認使用 image
                        if (string.IsNullOrEmpty(headerType))
                        {
                            if (!string.IsNullOrEmpty(templateHeaderFormat))
                            {
                                headerType = templateHeaderFormat.ToLower();
                            }
                            else
                            {
                                headerType = "image";
                            }
                        }
                        
                        object headerParameter = null;
                        
                        // 先上傳媒體到 Meta 獲取 media_id
                        try
                        {
                            _loggingService.LogInformation($"📤 開始上傳媒體獲取 media_id: URL={headerUrl}, Type={headerType}");
                            string mediaId = await UploadMediaAndGetMediaIdAsync(company, headerUrl, headerType);
                            
                            // 處理文件名（優先級：用戶輸入 > URL 提取 > 智能生成 > 默認值）
                            bool isUserProvidedFilename = !string.IsNullOrEmpty(templateHeaderFilename);
                            
                            // 如果用戶沒有在屬性頁輸入 filename，才從 URL 中提取
                            if (string.IsNullOrEmpty(headerFilename) && !isUserProvidedFilename && Uri.TryCreate(headerUrl, UriKind.Absolute, out var uri))
                            {
                                var pathSegments = uri.Segments;
                                if (pathSegments.Length > 0)
                                {
                                    var lastSegment = pathSegments[pathSegments.Length - 1];
                                    // 移除查詢參數
                                    var fileName = lastSegment.Split('?')[0];
                                    if (!string.IsNullOrEmpty(fileName))
                                    {
                                        headerFilename = fileName;
                                        _loggingService.LogInformation($"📝 從 URL 提取文件名: {headerFilename}");
                                    }
                                }
                            }
                            
                            // 只有在用戶沒有提供 filename 或文件名確實有問題時，才進行優化
                            if (!string.IsNullOrEmpty(headerFilename))
                            {
                                // 獲取文件擴展名
                                var fileExtension = Path.GetExtension(headerFilename).ToLower();
                                
                                // 如果文件名太長（超過 100 字符），即使是用戶提供的也要優化
                                // 但如果是用戶提供的且長度合理，直接使用
                                if (headerFilename.Length > 100)
                                {
                                    // 文件名太長，需要優化
                                    string meaningfulName = null;
                                    
                                    // 嘗試從變數中提取有意義的名稱
                                    if (variables != null && variables.Any())
                                    {
                                        if (variables.TryGetValue("InvoiceNo", out var invoiceNo) && !string.IsNullOrEmpty(invoiceNo))
                                        {
                                            meaningfulName = $"Invoice_{invoiceNo}{fileExtension}";
                                        }
                                        else if (variables.TryGetValue("1", out var var1) && !string.IsNullOrEmpty(var1))
                                        {
                                            meaningfulName = $"Document_{var1}{fileExtension}";
                                        }
                                    }
                                    
                                    if (string.IsNullOrEmpty(meaningfulName))
                                    {
                                        meaningfulName = headerType.ToLower() switch
                                        {
                                            "image" => $"image{fileExtension}",
                                            "video" => $"video{fileExtension}",
                                            "document" => $"document{fileExtension}",
                                            _ => $"file{fileExtension}"
                                        };
                                    }
                                    
                                    headerFilename = meaningfulName;
                                    _loggingService.LogInformation($"📝 文件名過長（>100字符），已優化為: {headerFilename}");
                                }
                                // 如果是用戶提供的文件名，即使包含特殊字符也直接使用（用戶可能有意為之）
                                else if (!isUserProvidedFilename && headerFilename.Contains("_") && headerFilename.Contains("-") && headerFilename.Length > 50)
                                {
                                    // 只有非用戶提供的文件名才進行此優化
                                    string meaningfulName = null;
                                    
                                    if (variables != null && variables.Any())
                                    {
                                        if (variables.TryGetValue("InvoiceNo", out var invoiceNo) && !string.IsNullOrEmpty(invoiceNo))
                                        {
                                            meaningfulName = $"Invoice_{invoiceNo}{fileExtension}";
                                        }
                                        else if (variables.TryGetValue("1", out var var1) && !string.IsNullOrEmpty(var1))
                                        {
                                            meaningfulName = $"Document_{var1}{fileExtension}";
                                        }
                                    }
                                    
                                    if (!string.IsNullOrEmpty(meaningfulName))
                                    {
                                        headerFilename = meaningfulName;
                                        _loggingService.LogInformation($"📝 自動提取的文件名包含特殊字符，已優化為: {headerFilename}");
                                    }
                                }
                                
                                // 確保文件名有正確的擴展名（即使是用戶提供的）
                                if (string.IsNullOrEmpty(fileExtension))
                                {
                                    var defaultExt = headerType.ToLower() switch
                                    {
                                        "image" => ".jpg",
                                        "video" => ".mp4",
                                        "document" => ".pdf",
                                        _ => ""
                                    };
                                    if (!string.IsNullOrEmpty(defaultExt) && !headerFilename.EndsWith(defaultExt, StringComparison.OrdinalIgnoreCase))
                                    {
                                        headerFilename = headerFilename + defaultExt;
                                        _loggingService.LogInformation($"📝 添加文件擴展名: {headerFilename}");
                                    }
                                }
                            }
                            
                            // 如果仍然沒有文件名，使用默認值
                            if (string.IsNullOrEmpty(headerFilename))
                            {
                                headerFilename = headerType.ToLower() switch
                                {
                                    "image" => "image.jpg",
                                    "video" => "video.mp4",
                                    "document" => "document.pdf",
                                    _ => "file"
                                };
                                _loggingService.LogInformation($"📝 使用默認文件名: {headerFilename}");
                            }
                            
                            // 使用 media_id 構建參數（而不是 URL）
                            switch (headerType.ToLower())
                            {
                                case "video":
                                    headerParameter = new
                                    {
                                        type = "video",
                                        video = new
                                        {
                                            id = mediaId
                                        }
                                    };
                                    _loggingService.LogInformation($"📹 構建 VIDEO Header: media_id={mediaId}");
                                    break;
                                    
                                case "document":
                                    headerParameter = new
                                    {
                                        type = "document",
                                        document = new
                                        {
                                            id = mediaId,
                                            filename = headerFilename
                                        }
                                    };
                                    _loggingService.LogInformation($"📄 構建 DOCUMENT Header: media_id={mediaId}, Filename={headerFilename}");
                                    break;
                                    
                                case "image":
                                default:
                                    headerParameter = new
                                    {
                                        type = "image",
                                        image = new
                                        {
                                            id = mediaId
                                        }
                                    };
                                    _loggingService.LogInformation($"🖼️ 構建 IMAGE Header: media_id={mediaId}");
                                    break;
                            }
                        }
                        catch (Exception ex)
                        {
                            _loggingService.LogError($"❌ 上傳媒體失敗，將使用 URL 方式: {ex.Message}", ex);
                            
                            // 如果上傳失敗，回退到使用 URL 方式
                            switch (headerType.ToLower())
                            {
                                case "video":
                                    headerParameter = new
                                    {
                                        type = "video",
                                        video = new
                                        {
                                            link = headerUrl
                                        }
                                    };
                                    _loggingService.LogInformation($"📹 構建 VIDEO Header (回退到 URL): URL={headerUrl}");
                                    break;
                                    
                                case "document":
                                    headerParameter = new
                                    {
                                        type = "document",
                                        document = new
                                        {
                                            link = headerUrl,
                                            filename = !string.IsNullOrEmpty(headerFilename) ? headerFilename : "document"
                                        }
                                    };
                                    _loggingService.LogInformation($"📄 構建 DOCUMENT Header (回退到 URL): URL={headerUrl}, Filename={headerFilename ?? "document"}");
                                    break;
                                    
                                case "image":
                                default:
                                    headerParameter = new
                                    {
                                        type = "image",
                                        image = new
                                        {
                                            link = headerUrl
                                        }
                                    };
                                    _loggingService.LogInformation($"🖼️ 構建 IMAGE Header (回退到 URL): URL={headerUrl}");
                                    break;
                            }
                        }
                        
                        if (headerParameter != null)
                        {
                            // Header component 必須放在 body 之前
                            components.Add(new
                            {
                                type = "header",
                                parameters = new[] { headerParameter }
                            });
                            
                            _loggingService.LogInformation($"✅ Header Component 已添加: Type={headerType}");
                        }
                }
                
                // 如果 template 有 header format，但沒有添加 header component（用戶沒有提供 header_url）
                // 這會在後續的 Meta API 調用中觸發錯誤，我們會在錯誤處理中給出明確提示
                if (!string.IsNullOrEmpty(templateHeaderFormat) && !components.Any(c => 
                {
                    try
                    {
                        var component = JsonSerializer.Serialize(c);
                        var compJson = JsonSerializer.Deserialize<JsonElement>(component);
                        return compJson.TryGetProperty("type", out var type) && type.GetString() == "header";
                    }
                    catch { return false; }
                }))
                {
                    _loggingService.LogWarning($"⚠️ Template 定義了 {templateHeaderFormat} Header，但未提供 header_url 參數。Meta API 將在發送時要求提供 header component。");
                }
                // ========== Header Component 處理結束 ==========
                
                // ========== 處理 Body Component Parameters ==========
                if (variables != null && variables.Any())
                {
                    // Meta 模板的變數處理：支持命名參數和數字參數
                    // 關鍵：Meta API 要求參數按照模板中出現的順序發送
                    // 如果模板使用 {{1}}，參數必須按照 1, 2, 3... 的順序發送
                    
                    // 過濾掉 header 相關的變數，只處理 body 參數
                    var bodyVariables = variables
                        .Where(kvp => !kvp.Key.Equals("header_url", StringComparison.OrdinalIgnoreCase) &&
                                     !kvp.Key.Equals("headerUrl", StringComparison.OrdinalIgnoreCase) &&
                                     !kvp.Key.Equals("header", StringComparison.OrdinalIgnoreCase) &&
                                     !kvp.Key.Equals("header_type", StringComparison.OrdinalIgnoreCase) &&
                                     !kvp.Key.Equals("headerType", StringComparison.OrdinalIgnoreCase) &&
                                     !kvp.Key.Equals("header_filename", StringComparison.OrdinalIgnoreCase) &&
                                     !kvp.Key.Equals("headerFilename", StringComparison.OrdinalIgnoreCase))
                        .ToDictionary(kvp => kvp.Key, kvp => kvp.Value);
                    
                    if (bodyVariables.Any())
                    {
                        var parameters = new List<object>();
                    
                        // 檢查是否為數字參數（如 "1", "2", "3"）
                        var numericKeys = bodyVariables.Keys.Where(k => int.TryParse(k, out _)).ToList();
                        
                        if (numericKeys.Any())
                        {
                            // 數字參數：按數字順序排序
                            var sortedKeys = numericKeys.OrderBy(k => int.Parse(k)).ToList();
                            _loggingService.LogInformation($"🔍 [DEBUG] 檢測到數字參數: {string.Join(", ", sortedKeys)}");
                            
                            foreach (var key in sortedKeys)
                            {
                                parameters.Add(new
                                {
                                    type = "text",
                                    text = !string.IsNullOrEmpty(bodyVariables[key]) ? bodyVariables[key] : " "
                                });
                            }
                        }
                        else
                        {
                            // 命名參數：Meta API 不支持命名參數
                            // 建議用戶在 Meta 模板中使用數字參數 {{1}}, {{2}}, {{3}} 等
                            var sortedKeys = bodyVariables.Keys.OrderBy(k => k).ToList();
                            _loggingService.LogInformation($"🔍 [DEBUG] 檢測到命名參數: {string.Join(", ", sortedKeys)}");
                            _loggingService.LogInformation($"🔍 [DEBUG] 注意：Meta API 不支持命名參數，請在 Meta 模板中使用數字參數 {{1}}, {{2}}, {{3}} 等");
                            
                            foreach (var key in sortedKeys)
                            {
                                parameters.Add(new
                                {
                                    type = "text",
                                    text = !string.IsNullOrEmpty(bodyVariables[key]) ? bodyVariables[key] : " "
                                });
                            }
                        }
                    
                        _loggingService.LogInformation($"🔍 [DEBUG] Body 參數處理詳情:");
                        _loggingService.LogInformation($"🔍 [DEBUG] 原始變數鍵值對: {string.Join(", ", bodyVariables.Select(kvp => $"{kvp.Key}={kvp.Value}"))}");
                        _loggingService.LogInformation($"🔍 [DEBUG] 處理後參數順序: {string.Join(", ", parameters.Select((p, i) => $"位置{i+1}={((dynamic)p).text}"))}");
                        
                        if (parameters.Any())
                        {
                            components.Add(new
                            {
                                type = "body",
                                parameters = parameters
                            });
                        }
                        
                        _loggingService.LogInformation($"Meta 模板 Body 參數處理: 原始變數={JsonSerializer.Serialize(bodyVariables)}, 處理後參數={JsonSerializer.Serialize(parameters)}");
                    }
                }
                // ========== Body Component 處理結束 ==========
                
                _loggingService.LogInformation($"📦 最終 Components 結構: {JsonSerializer.Serialize(components)}");
                _loggingService.LogInformation($"📦 Components 數量: {components.Count} (Header: {components.Count(c => ((dynamic)c).type == "header")}, Body: {components.Count(c => ((dynamic)c).type == "body")})");
                
                // 構建 Meta API 請求 - 嘗試使用最新版本 {GetApiVersion()}
                var url = $"https://graph.facebook.com/{GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";
                
                // 準備嘗試的語言代碼列表
                var languageCodesToTry = new List<string>();
                if (!string.IsNullOrEmpty(languageCode))
                {
                    // 先嘗試指定的語言代碼
                    languageCodesToTry.Add(languageCode);
                    // 如果指定的語言失敗，也嘗試其他常見語言代碼（作為備選）
                    var fallbackLanguages = new[] { "zh_TW", "zh_HK", "zh_CN", "en_US" };
                    foreach (var fallback in fallbackLanguages)
                    {
                        if (fallback != languageCode)  // 避免重複
                        {
                            languageCodesToTry.Add(fallback);
                        }
                    }
                    _loggingService.LogInformation($"使用指定的語言代碼: {languageCode}，如果失敗將嘗試: {string.Join(", ", languageCodesToTry.Skip(1))}");
                }
                else
                {
                    // 如果沒有指定語言代碼，嘗試常見的語言代碼（按優先順序）
                    languageCodesToTry.AddRange(new[] { "zh_TW", "zh_HK", "zh_CN", "en_US" });
                    _loggingService.LogWarning($"未指定模板語言代碼，將嘗試以下語言: {string.Join(", ", languageCodesToTry)}");
                }
                
                Exception lastException = null;
                string lastResponseContent = null;
                
                // 嘗試每個語言代碼
                foreach (var langCode in languageCodesToTry)
                {
                    try
                    {
                        _loggingService.LogInformation($"嘗試使用語言代碼: {langCode}");
                        
                        // 根據是否有參數來構建不同的 payload
                        object payload;
                        if (components.Any())
                        {
                            // 有參數時，包含 components
                            payload = new
                            {
                                messaging_product = "whatsapp",
                                to = formattedTo,
                                type = "template",
                                template = new
                                {
                                    name = templateName,
                                    language = new
                                    {
                                        code = langCode
                                    },
                                    components = components.ToArray()
                                }
                            };
                        }
                        else
                        {
                            // 沒有參數時，不包含 components
                            payload = new
                            {
                                messaging_product = "whatsapp",
                                to = formattedTo,
                                type = "template",
                                template = new
                                {
                                    name = templateName,
                                    language = new
                                    {
                                        code = langCode
                                    }
                                }
                            };
                        }
                        
                        var jsonPayload = JsonSerializer.Serialize(payload);
                        
                        // 記錄使用的配置（部分遮罩）
                        var maskedApiKey = company.WA_API_Key.Length > 8 
                            ? $"{company.WA_API_Key.Substring(0, 4)}...{company.WA_API_Key.Substring(company.WA_API_Key.Length - 4)}" 
                            : "***";
                        var maskedPhoneId = company.WA_PhoneNo_ID.Length > 8 
                            ? $"{company.WA_PhoneNo_ID.Substring(0, 4)}...{company.WA_PhoneNo_ID.Substring(company.WA_PhoneNo_ID.Length - 4)}" 
                            : "***";
                        
                        _loggingService.LogInformation($"🔑 發送 Meta 模板使用的配置 - API Key: {maskedApiKey}, Phone Number ID: {maskedPhoneId}, Business Account ID: {company.WA_Business_Account_ID ?? "null"}");
                        _loggingService.LogInformation($"Meta Template API URL: {url}");
                        _loggingService.LogInformation($"Meta Template API Payload: {jsonPayload}");
                        _loggingService.LogInformation($"是否有參數: {components.Any()}, 參數數量: {components.Count}");
                        
                        using var httpClient = new HttpClient();
                        httpClient.DefaultRequestHeaders.Authorization = 
                            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                        
                        var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                        
                        _loggingService.LogInformation($"開始發送 Meta 模板消息...");
                        var response = await httpClient.PostAsync(url, content);
                        var responseContent = await response.Content.ReadAsStringAsync();
                        
                        _loggingService.LogInformation($"Meta API 響應狀態碼: {response.StatusCode}");
                        _loggingService.LogInformation($"Meta API 響應內容: {responseContent}");
                        
                        if (response.IsSuccessStatusCode)
                        {
                            // 成功！解析響應獲取消息 ID
                            var responseJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
                            var whatsappMessageId = responseJson.GetProperty("messages")[0].GetProperty("id").GetString();
                            
                            _loggingService.LogInformation($"✅ Meta 模板消息發送成功，消息 ID: {whatsappMessageId}，使用的語言代碼: {langCode}");
                            
                            return whatsappMessageId;
                        }
                        else
                        {
                            // 檢查是否是語言不匹配錯誤 (132001)
                            var errorJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
                            if (errorJson.TryGetProperty("error", out var errorProp))
                            {
                                var errorCode = errorProp.TryGetProperty("code", out var codeProp) ? codeProp.GetInt32() : 0;
                                
                                if (errorCode == 132001)
                                {
                                    // 這是語言不匹配錯誤，嘗試下一個語言代碼
                                    _loggingService.LogWarning($"模板 {templateName} 在語言 {langCode} 中不存在，嘗試下一個語言代碼");
                                    lastException = new Exception($"Meta API 發送失敗: {response.StatusCode} - {responseContent}");
                                    lastResponseContent = responseContent;
                                    continue; // 嘗試下一個語言代碼
                                }
                                else if (errorCode == 132012)
                                {
                                    // 檢查是否是 header format mismatch 錯誤
                                    if (errorProp.TryGetProperty("error_data", out var errorData) &&
                                        errorData.TryGetProperty("details", out var details))
                                    {
                                        var detailsStr = details.GetString();
                                        if (!string.IsNullOrEmpty(detailsStr) && detailsStr.Contains("header") && detailsStr.Contains("expected"))
                                        {
                                            // 提取期望的 header 類型
                                            string expectedType = null;
                                            if (detailsStr.Contains("expected TEXT"))
                                            {
                                                expectedType = "TEXT";
                                                // 如果 Meta API 說 expected TEXT，說明 template 實際是 TEXT header
                                                // 不應該添加任何 header component（IMAGE/VIDEO/DOCUMENT）
                                                var friendlyError = $"模板 {templateName} 是 TEXT 類型的 Header，不應該提供 header_url 參數。\n" +
                                                                    $"系統誤判為 IMAGE 並添加了 header component，請檢查代碼邏輯。\n" +
                                                                    $"TEXT header 不需要 header component，只需要 body parameters。";
                                                _loggingService.LogError($"❌ {friendlyError}");
                                                throw new Exception(friendlyError);
                                            }
                                            else if (detailsStr.Contains("expected IMAGE"))
                                                expectedType = "IMAGE";
                                            else if (detailsStr.Contains("expected VIDEO"))
                                                expectedType = "VIDEO";
                                            else if (detailsStr.Contains("expected DOCUMENT"))
                                                expectedType = "DOCUMENT";
                                            else
                                            {
                                                // 無法識別，嘗試從錯誤信息中提取
                                                expectedType = "UNKNOWN";
                                            }
                                            
                                            if (expectedType == null)
                                            {
                                                // 無法識別期望的類型，使用默認邏輯
                                                expectedType = "IMAGE";
                                            }
                                            
                                            // 如果 expectedType 是 TEXT，已經在上面處理了，這裡不會執行
                                            // 只有在 expectedType 是 IMAGE/VIDEO/DOCUMENT 時才會執行到這裡
                                            
                                            // 檢查是否提供了 header_url
                                            var hasHeaderUrl = variables != null && (
                                                variables.ContainsKey("header_url") ||
                                                variables.ContainsKey("headerUrl") ||
                                                variables.ContainsKey("header"));
                                            
                                            // 檢查是否錯誤地添加了 header component（當 template 實際是 TEXT 時）
                                            var hasHeaderComponent = components.Any(c =>
                                            {
                                                try
                                                {
                                                    var component = JsonSerializer.Serialize(c);
                                                    var compJson = JsonSerializer.Deserialize<JsonElement>(component);
                                                    return compJson.TryGetProperty("type", out var type) && type.GetString() == "header";
                                                }
                                                catch { return false; }
                                            });
                                            
                                            if (!hasHeaderUrl)
                                            {
                                                // 無論是否有靜態 header，Meta API 都要求提供 header component
                                                // 系統應該已經嘗試從數據庫和文件系統自動獲取，但未找到
                                                var friendlyError = $"模板 {templateName} 定義了 {expectedType} 類型的 Header，但未提供 header_url 參數。\n" +
                                                                    $"系統已嘗試從數據庫和文件系統自動查找，但未找到匹配的 header_url。\n" +
                                                                    $"請在節點配置的變數中添加 header_url 和 header_type 參數。\n" +
                                                                    $"例如：{{\"header_url\": \"https://yourdomain.com/public/meta-templates/xxx.jpg\", \"header_type\": \"{expectedType.ToLower()}\"}}\n" +
                                                                    $"注意：請使用公開可訪問的 URL（不是 localhost）。\n" +
                                                                    $"提示：創建 template 時，系統會自動保存 header_url 到數據庫，下次發送時會自動使用。";
                                                _loggingService.LogError($"❌ {friendlyError}");
                                                throw new Exception(friendlyError);
                                            }
                                            else
                                            {
                                                // 提供了 header_url 但仍然出錯，可能是格式問題
                                                var friendlyError = $"模板 {templateName} 的 Header 格式不匹配。\n" +
                                                                    $"模板期望: {expectedType}\n" +
                                                                    $"請檢查 header_type 參數是否正確（應為: {expectedType.ToLower()}）";
                                                _loggingService.LogError($"❌ {friendlyError}");
                                                throw new Exception(friendlyError);
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // 其他錯誤，直接拋出
                            throw new Exception($"Meta API 發送失敗: {response.StatusCode} - {responseContent}");
                        }
                    }
                    catch (Exception ex) when (ex.Message.Contains("132001") || ex.Message.Contains("does not exist in"))
                    {
                        // 語言不匹配錯誤，嘗試下一個語言代碼
                        _loggingService.LogWarning($"模板 {templateName} 在語言 {langCode} 中不存在: {ex.Message}");
                        lastException = ex;
                        continue;
                    }
                }
                
                // 所有語言代碼都失敗了
                if (lastException != null)
                {
                    _loggingService.LogError($"所有嘗試的語言代碼都失敗了。最後的錯誤: {lastResponseContent ?? lastException.Message}");
                    throw new Exception($"Meta API 發送失敗：模板 {templateName} 在嘗試的語言代碼 ({string.Join(", ", languageCodesToTry)}) 中都不存在。請確認模板的語言版本或在前端配置中指定正確的 templateLanguage。最後的錯誤: {lastResponseContent ?? lastException.Message}");
                }
                
                throw new Exception($"Meta API 發送失敗：無法發送模板 {templateName}");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 Meta 模板消息失敗: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 替換變數
        /// </summary>
        private string ReplaceVariables(string content, Dictionary<string, string> variables)
        {
            if (variables == null || string.IsNullOrEmpty(content))
                return content;

            foreach (var variable in variables)
            {
                content = content.Replace($"{{{{{variable.Key}}}}}", variable.Value ?? "");
            }

            return content;
        }

        /// <summary>
        /// 發送 WhatsApp 消息並記錄發送情況（支持多收件人）
        /// </summary>
        /// <param name="recipientValue">收件人值（字符串格式）</param>
        /// <param name="recipientDetails">收件人詳細信息（JSON格式）</param>
        /// <param name="message">消息內容</param>
        /// <param name="execution">工作流程執行記錄</param>
        /// <param name="stepExecution">工作流程步驟執行記錄</param>
        /// <param name="nodeId">節點ID</param>
        /// <param name="nodeType">節點類型</param>
        /// <param name="dbContext">資料庫上下文</param>
        /// <returns>發送記錄ID</returns>
        public async Task<Guid> SendWhatsAppMessageWithTrackingAsync(
            string recipientValue,
            string recipientDetails,
            string message,
            WorkflowExecution execution,
            WorkflowStepExecution stepExecution,
            string nodeId,
            string nodeType,
            PurpleRiceDbContext dbContext)
        {
            try
            {
                _loggingService.LogInformation($"=== 發送 WhatsApp 消息並記錄開始 ===");
                _loggingService.LogInformation($"執行 ID: {execution.Id}");
                _loggingService.LogInformation($"節點 ID: {nodeId}");
                _loggingService.LogInformation($"節點類型: {nodeType}");
                _loggingService.LogInformation($"收件人值: {recipientValue}");
                _loggingService.LogInformation($"收件人詳細信息: {recipientDetails}");
                _loggingService.LogInformation($"消息內容: {message}");

                // 獲取公司配置
                var company = await GetCompanyConfigurationAsync(execution, dbContext);
                var companyId = company.Id;
                var createdBy = execution.CreatedBy ?? "system";
                _loggingService.LogInformation($"公司 ID: {companyId}, 創建者: {createdBy}");

                // 創建消息發送記錄
                var messageSendId = await _messageSendService.CreateMessageSendAsync(
                    execution.Id,
                    stepExecution.Id, // workflowStepExecutionId
                    nodeId,
                    nodeType,
                    message,
                    null, // templateId
                    null, // templateName
                    "text", // messageType
                    companyId,
                    createdBy);

                _loggingService.LogInformation($"創建消息發送記錄，ID: {messageSendId}");

                // 解析收件人
                var recipients = await _recipientResolverService.ResolveRecipientsAsync(
                    recipientValue,
                    recipientDetails?.ToString(),
                    execution.Id,
                    companyId);

                _loggingService.LogInformation($"解析到 {recipients.Count} 個收件人");
                
                // 詳細記錄每個收件人
                for (int i = 0; i < recipients.Count; i++)
                {
                    var recipient = recipients[i];
                    _loggingService.LogInformation($"收件人 {i + 1}: {recipient.RecipientName} ({recipient.PhoneNumber}) - 類型: {recipient.RecipientType}");
                }

                if (!recipients.Any())
                {
                    _loggingService.LogWarning("沒有找到有效的收件人");
                    await _messageSendService.UpdateMessageSendStatusAsync(
                        messageSendId, 
                        MessageSendStatus.Failed, 
                        "沒有找到有效的收件人");
                    return messageSendId;
                }

                // 添加收件人到發送記錄
                await _messageSendService.AddRecipientsAsync(messageSendId, recipients, createdBy);

                // 更新狀態為進行中
                await _messageSendService.UpdateMessageSendStatusAsync(
                    messageSendId, 
                    MessageSendStatus.InProgress);

                // 批量發送消息
                _loggingService.LogInformation($"開始批量發送消息到 {recipients.Count} 個收件人...");
                var successCount = 0;
                var failedCount = 0;
                var whatsappMessageIds = new Dictionary<Guid, string>();

                foreach (var recipient in recipients)
                {
                    try
                    {
                        _loggingService.LogInformation($"發送消息到 {recipient.PhoneNumber} ({recipient.RecipientName})");

                        // 格式化電話號碼
                        var formattedTo = FormatPhoneNumber(recipient.PhoneNumber);

                        // 發送 WhatsApp 消息
                        var whatsappMessageId = await SendWhatsAppTextMessageAsync(company, formattedTo, message);

                        // 記錄成功（使用實際的 WhatsApp 訊息 ID）
                        whatsappMessageIds[recipient.Id] = whatsappMessageId;
                        successCount++;

                        // 更新收件人狀態為已發送
                        _loggingService.LogInformation($"🔍 [DEBUG] 準備更新收件人狀態: RecipientId={recipient.Id}, Status=Sent, WhatsAppMessageId={whatsappMessageIds[recipient.Id]}");
                        await _messageSendService.UpdateRecipientStatusAsync(
                            recipient.Id, 
                            RecipientStatus.Sent, 
                            whatsappMessageIds[recipient.Id]);
                        _loggingService.LogInformation($"🔍 [DEBUG] 收件人狀態更新完成: RecipientId={recipient.Id}");

                        _loggingService.LogInformation($"成功發送到 {formattedTo}，消息 ID: {whatsappMessageIds[recipient.Id]}");
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogError($"發送到 {recipient.PhoneNumber} 失敗: {ex.Message}", ex);
                        failedCount++;

                        // 更新收件人狀態為失敗
                        _loggingService.LogInformation($"🔍 [DEBUG] 準備更新收件人狀態為失敗: RecipientId={recipient.Id}, ErrorMessage={ex.Message}");
                        await _messageSendService.UpdateRecipientStatusAsync(
                            recipient.Id, 
                            RecipientStatus.Failed, 
                            null, 
                            ex.Message);
                        _loggingService.LogInformation($"🔍 [DEBUG] 收件人失敗狀態更新完成: RecipientId={recipient.Id}");
                    }
                }

                // 更新最終狀態
                var finalStatus = failedCount == 0 ? MessageSendStatus.Completed :
                                 successCount == 0 ? MessageSendStatus.Failed :
                                 MessageSendStatus.PartiallyFailed;

                await _messageSendService.UpdateMessageSendStatusAsync(
                    messageSendId, 
                    finalStatus, 
                    failedCount > 0 ? $"{failedCount} 個收件人發送失敗" : null);

                _loggingService.LogInformation($"發送完成，成功: {successCount}, 失敗: {failedCount}, 狀態: {finalStatus}");
                _loggingService.LogInformation($"消息發送記錄 ID: {messageSendId}");
                _loggingService.LogInformation($"=== 發送 WhatsApp 消息並記錄完成 ===");

                return messageSendId;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 WhatsApp 消息並記錄失敗: {ex.Message}", ex);
                
                // 記錄詳細的內部異常
                var innerEx = ex.InnerException;
                int level = 1;
                while (innerEx != null)
                {
                    _loggingService.LogError($"InnerException (Level {level}): {innerEx.Message}");
                    _loggingService.LogError($"InnerException Type (Level {level}): {innerEx.GetType().FullName}");
                    innerEx = innerEx.InnerException;
                    level++;
                }
                
                throw;
            }
        }

        /// <summary>
        /// 發送 WhatsApp 模板消息並記錄發送情況（支持多收件人）
        /// </summary>
        /// <param name="recipientValue">收件人值（字符串格式）</param>
        /// <param name="recipientDetails">收件人詳細信息（JSON格式）</param>
        /// <param name="templateId">模板ID</param>
        /// <param name="templateName">模板名稱</param>
        /// <param name="variables">模板變數</param>
        /// <param name="execution">工作流程執行記錄</param>
        /// <param name="stepExecution">工作流程步驟執行記錄</param>
        /// <param name="nodeId">節點ID</param>
        /// <param name="nodeType">節點類型</param>
        /// <param name="dbContext">資料庫上下文</param>
        /// <returns>發送記錄ID</returns>
        public async Task<Guid> SendWhatsAppTemplateMessageWithTrackingAsync(
            string recipientValue,
            string recipientDetails,
            string templateId,
            string templateName,
            Dictionary<string, string> variables,
            WorkflowExecution execution,
            WorkflowStepExecution stepExecution,
            string nodeId,
            string nodeType,
            PurpleRiceDbContext dbContext,
            bool isMetaTemplate = false,
            string templateLanguage = null,  // 添加語言代碼參數
            string templateHeaderUrl = null,  // 添加 header URL 參數
            string templateHeaderType = null,  // 添加 header 類型參數
            string templateHeaderFilename = null)  // 添加 header filename 參數
        {
            try
            {
                _loggingService.LogInformation($"=== 發送 WhatsApp 模板消息並記錄開始 ===");
                _loggingService.LogInformation($"執行 ID: {execution.Id}");
                _loggingService.LogInformation($"節點 ID: {nodeId}");
                _loggingService.LogInformation($"節點類型: {nodeType}");
                _loggingService.LogInformation($"模板類型: {(isMetaTemplate ? "Meta 官方模板" : "內部模板")}");
                _loggingService.LogInformation($"模板 ID: {templateId}");
                _loggingService.LogInformation($"模板名稱: {templateName}");
                _loggingService.LogInformation($"模板語言代碼: {templateLanguage ?? "null (將自動嘗試多個語言)"}");

                // 獲取公司配置
                var company = await GetCompanyConfigurationAsync(execution, dbContext);
                var companyId = company.Id;
                var createdBy = execution.CreatedBy ?? "system";

                // 根據模板類型獲取內容
                string messageContent = "";
                
                if (!isMetaTemplate)
                {
                    // 只有內部模板才需要查詢 WhatsAppTemplates 表
                    var templateGuid = Guid.TryParse(templateId, out var guid) ? guid : Guid.Empty;
                    
                    var template = await dbContext.WhatsAppTemplates
                        .FirstOrDefaultAsync(t => t.Id == templateGuid && t.CompanyId == companyId);

                    if (template == null)
                    {
                        throw new Exception($"找不到內部模板 ID: {templateId}");
                    }

                    // 替換模板變數
                    messageContent = ReplaceVariables(template.Content, variables);
                }
                else
                {
                    // Meta 模板不需要從數據庫獲取內容
                    // 使用模板名稱作為消息內容記錄
                    messageContent = $"Meta Template: {templateName}";
                }

                // 創建消息發送記錄
                var messageSendId = await _messageSendService.CreateMessageSendAsync(
                    execution.Id,
                    stepExecution.Id, // workflowStepExecutionId
                    nodeId,
                    nodeType,
                    messageContent,
                    templateId,
                    templateName,
                    "template",
                    companyId,
                    createdBy);

                _loggingService.LogInformation($"創建消息發送記錄，ID: {messageSendId}");

                // 解析收件人
                var recipients = await _recipientResolverService.ResolveRecipientsAsync(
                    recipientValue,
                    recipientDetails?.ToString(),
                    execution.Id,
                    companyId);

                _loggingService.LogInformation($"解析到 {recipients.Count} 個收件人");
                
                // 詳細記錄每個收件人
                for (int i = 0; i < recipients.Count; i++)
                {
                    var recipient = recipients[i];
                    _loggingService.LogInformation($"收件人 {i + 1}: {recipient.RecipientName} ({recipient.PhoneNumber}) - 類型: {recipient.RecipientType}");
                }

                if (!recipients.Any())
                {
                    _loggingService.LogWarning("沒有找到有效的收件人");
                    await _messageSendService.UpdateMessageSendStatusAsync(
                        messageSendId, 
                        MessageSendStatus.Failed, 
                        "沒有找到有效的收件人");
                    return messageSendId;
                }

                // 添加收件人到發送記錄
                await _messageSendService.AddRecipientsAsync(messageSendId, recipients, createdBy);

                // 更新狀態為進行中
                await _messageSendService.UpdateMessageSendStatusAsync(
                    messageSendId, 
                    MessageSendStatus.InProgress);

                // 批量發送消息
                _loggingService.LogInformation($"開始批量發送消息到 {recipients.Count} 個收件人...");
                var successCount = 0;
                var failedCount = 0;
                var whatsappMessageIds = new Dictionary<Guid, string>();

                foreach (var recipient in recipients)
                {
                    try
                    {
                        _loggingService.LogInformation($"發送模板消息到 {recipient.PhoneNumber} ({recipient.RecipientName})");

                        // 格式化電話號碼
                        var formattedTo = FormatPhoneNumber(recipient.PhoneNumber);

                        // 發送 WhatsApp 模板消息（支持內部模板和 Meta 模板）
                        var whatsappMessageId = await SendWhatsAppTemplateMessageAsync(
                            formattedTo, 
                            templateId, 
                            execution, 
                            dbContext, 
                            variables,
                            isMetaTemplate,
                            templateName,
                            templateLanguage,
                            templateHeaderUrl,
                            templateHeaderType,
                            templateHeaderFilename);

                        // 記錄成功（使用實際的 WhatsApp 訊息 ID）
                        whatsappMessageIds[recipient.Id] = whatsappMessageId;
                        successCount++;

                        // 更新收件人狀態為已發送
                        await _messageSendService.UpdateRecipientStatusAsync(
                            recipient.Id, 
                            RecipientStatus.Sent, 
                            whatsappMessageIds[recipient.Id]);

                        _loggingService.LogInformation($"成功發送模板消息到 {formattedTo}，消息 ID: {whatsappMessageIds[recipient.Id]}");
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogError($"發送模板消息到 {recipient.PhoneNumber} 失敗: {ex.Message}", ex);
                        failedCount++;

                        // 更新收件人狀態為失敗
                        await _messageSendService.UpdateRecipientStatusAsync(
                            recipient.Id, 
                            RecipientStatus.Failed, 
                            null, 
                            ex.Message);
                    }
                }

                // 更新最終狀態
                var finalStatus = failedCount == 0 ? MessageSendStatus.Completed :
                                 successCount == 0 ? MessageSendStatus.Failed :
                                 MessageSendStatus.PartiallyFailed;

                await _messageSendService.UpdateMessageSendStatusAsync(
                    messageSendId, 
                    finalStatus, 
                    failedCount > 0 ? $"{failedCount} 個收件人發送失敗" : null);

                _loggingService.LogInformation($"模板消息發送完成，成功: {successCount}, 失敗: {failedCount}, 狀態: {finalStatus}");
                _loggingService.LogInformation($"=== 發送 WhatsApp 模板消息並記錄完成 ===");

                return messageSendId;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 WhatsApp 模板消息並記錄失敗: {ex.Message}", ex);
                throw;
            }
        }
    }
} 