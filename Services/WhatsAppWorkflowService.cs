using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace PurpleRice.Services
{
    public class WhatsAppWorkflowService
    {
        private readonly LoggingService _loggingService;
        
        public WhatsAppWorkflowService(Func<string, LoggingService> loggingServiceFactory)
        {
            _loggingService = loggingServiceFactory("WhatsAppService");
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
                await SendWhatsAppTextMessageAsync(company, formattedTo, message);

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
        public async Task SendWhatsAppTemplateMessageAsync(string to, string templateId, WorkflowExecution execution, PurpleRiceDbContext dbContext, Dictionary<string, string> variables = null)
        {
            try
            {
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

                // 獲取公司配置
                var company = await GetCompanyConfigurationAsync(execution, dbContext);
                
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
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"使用內部模板發送 WhatsApp 消息失敗: {ex.Message}", ex);
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
        /// 發送 WhatsApp 文字消息
        /// </summary>
        private async Task SendWhatsAppTextMessageAsync(Company company, string to, string message)
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
            
            _loggingService.LogInformation($"開始發送 WhatsApp 文字消息...");
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
                await SendWhatsAppTextMessageAsync(company, to, content);
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

                var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                
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

                var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                
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

                var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                
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
                
                var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                
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
    }
} 