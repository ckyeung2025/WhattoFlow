using System;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;

namespace PurpleRice.Services
{
    /// <summary>
    /// eForm 服務
    /// 負責處理 eForm 的創建、AI 填充、發送等相關功能
    /// </summary>
    public class EFormService
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;

        public EFormService(
            PurpleRiceDbContext context,
            Func<string, LoggingService> loggingServiceFactory,
            WhatsAppWorkflowService whatsAppWorkflowService,
            IConfiguration configuration)
        {
            _context = context;
            _loggingService = loggingServiceFactory("EFormService");
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _configuration = configuration;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromMinutes(5);
        }

        /// <summary>
        /// 執行 eForm 發送（帶上下文）
        /// </summary>
        /// <returns>創建的表單實例ID</returns>
        public async Task<Guid> ExecuteSendEFormWithContextAsync(JsonElement nodeData, object inputData, WorkflowExecution execution)
        {
            try
            {
                _loggingService.LogInformation($"=== EFormService.ExecuteSendEFormWithContextAsync 開始 ===");
                _loggingService.LogInformation($"執行 ID: {execution.Id}");
                _loggingService.LogInformation($"節點數據: {nodeData}");
                
                // 獲取節點數據
                var formName = nodeData.GetProperty("formName").GetString();
                var formId = nodeData.GetProperty("formId").GetString();
                var to = nodeData.GetProperty("to").GetString();

                _loggingService.LogInformation($"formName: {formName}");
                _loggingService.LogInformation($"formId: {formId}");
                _loggingService.LogInformation($"to: {to}");

                if (string.IsNullOrEmpty(formName) || string.IsNullOrEmpty(to))
                {
                    throw new Exception("表單名稱和收件人電話號碼不能為空");
                }

                // 1. 查詢原始表單定義
                _loggingService.LogInformation($"開始查詢表單定義: {formName}");
                var eFormDefinition = await _context.eFormDefinitions
                    .FirstOrDefaultAsync(f => f.Name == formName && f.Status == "A");

                if (eFormDefinition == null)
                {
                    _loggingService.LogInformation($"找不到表單定義: {formName}，嘗試查詢所有表單...");
                    var allForms = await _context.eFormDefinitions.ToListAsync();
                    _loggingService.LogInformation($"資料庫中的所有表單:");
                    foreach (var form in allForms)
                    {
                        _loggingService.LogInformation($"- ID: {form.Id}, Name: {form.Name}, Status: {form.Status}");
                    }
                    throw new Exception($"找不到表單定義: {formName}");
                }

                _loggingService.LogInformation($"找到表單定義，ID: {eFormDefinition.Id}");

                // 2. 查詢當前流程實例中的用戶回覆記錄
                _loggingService.LogInformation($"開始查詢用戶回覆記錄，執行 ID: {execution.Id}");
                var userMessages = await _context.MessageValidations
                    .Where(m => m.WorkflowExecutionId == execution.Id && m.IsValid)
                    .OrderBy(m => m.CreatedAt)
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {userMessages.Count} 條有效用戶回覆記錄");
                foreach (var msg in userMessages)
                {
                    _loggingService.LogInformation($"- 用戶訊息: {msg.UserMessage}, 時間: {msg.CreatedAt}");
                }

                // 3. 獲取公司ID
                var workflowDefinition = await _context.WorkflowDefinitions
                    .FirstOrDefaultAsync(w => w.Id == execution.WorkflowDefinitionId);

                if (workflowDefinition == null)
                {
                    throw new Exception("找不到工作流程定義");
                }

                var companyId = workflowDefinition.CompanyId;
                _loggingService.LogInformation($"使用公司ID: {companyId}");

                // 4. 創建表單實例記錄
                var eFormInstance = new EFormInstance
                {
                    Id = Guid.NewGuid(),
                    EFormDefinitionId = eFormDefinition.Id,
                    WorkflowExecutionId = execution.Id,
                    WorkflowStepExecutionId = execution.CurrentStep ?? 0,
                    CompanyId = companyId,
                    InstanceName = $"{formName}_{execution.Id}_{DateTime.Now:yyyyMMddHHmmss}",
                    OriginalHtmlCode = eFormDefinition.HtmlCode,
                    Status = "Pending",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // 5. 如果有用戶回覆，使用 AI 填充表單
                if (userMessages.Any())
                {
                    var latestMessage = userMessages.Last();
                    eFormInstance.UserMessage = latestMessage.UserMessage;

                    _loggingService.LogInformation($"用戶消息: {latestMessage.UserMessage}");

                    try
                    {
                        // 調用 AI 填充表單
                        _loggingService.LogInformation("開始使用 AI 填充表單...");
                        var filledHtml = await FillFormWithAIAsync(eFormDefinition.HtmlCode, latestMessage.UserMessage);
                        
                        if (!string.IsNullOrEmpty(filledHtml) && filledHtml != eFormDefinition.HtmlCode)
                        {
                            eFormInstance.FilledHtmlCode = filledHtml;
                            _loggingService.LogInformation("AI 填充完成，表單已更新");
                        }
                        else
                        {
                            _loggingService.LogWarning("AI 填充失敗或返回原始 HTML，使用原始表單");
                            eFormInstance.FilledHtmlCode = eFormDefinition.HtmlCode;
                        }
                    }
                    catch (Exception aiEx)
                    {
                        _loggingService.LogError($"AI 填充失敗: {aiEx.Message}，使用原始表單");
                        eFormInstance.FilledHtmlCode = eFormDefinition.HtmlCode;
                    }
                }
                else
                {
                    // 沒有用戶回覆，使用原始表單
                    eFormInstance.FilledHtmlCode = eFormDefinition.HtmlCode;
                    _loggingService.LogInformation("沒有用戶回覆，使用原始表單");
                }

                // 6. 生成表單 URL
                var formUrl = $"/eform-instance/{eFormInstance.Id}";
                eFormInstance.FormUrl = formUrl;

                // 7. 保存到數據庫
                _loggingService.LogInformation($"準備保存表單實例到資料庫...");
                _context.EFormInstances.Add(eFormInstance);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"表單實例已創建，ID: {eFormInstance.Id}");

                // 8. 發送 WhatsApp 消息（包含表單鏈接）
                await SendEFormWhatsAppMessageAsync(to, formName, formUrl, execution);

                _loggingService.LogInformation($"=== EFormService.ExecuteSendEFormWithContextAsync 完成 ===");
                
                // 返回創建的表單實例ID
                return eFormInstance.Id;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 eForm 失敗: {ex.Message}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                throw;
            }
        }

        /// <summary>
        /// 使用 AI 填充表單
        /// </summary>
        /// <param name="originalHtml">原始 HTML 表單</param>
        /// <param name="userMessage">用戶輸入消息</param>
        /// <returns>填充後的 HTML 表單</returns>
        public async Task<string> FillFormWithAIAsync(string originalHtml, string userMessage)
        {
            try
            {
                _loggingService.LogInformation($"=== EFormService.FillFormWithAIAsync 開始 ===");
                _loggingService.LogInformation($"開始時間: {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}");
                _loggingService.LogInformation($"原始 HTML 長度: {originalHtml?.Length ?? 0}");
                _loggingService.LogInformation($"用戶消息: {userMessage}");

                // 從配置中獲取 AI 提示詞
                var formAnalysisPrompt = _configuration["XAI:FormAnalysisPrompt"] ?? "";

                // 構建 AI 提示詞
                var prompt = $@"{formAnalysisPrompt}

HTML 表單內容：
{originalHtml}

用戶輸入消息：
{userMessage}

請分析用戶輸入，並將對應的值填充到 HTML 表單的相應欄位中。只返回完整的 HTML 代碼，不要包含任何解釋文字。";

                // 獲取 X.AI 配置
                var apiKey = _configuration["XAI:ApiKey"];
                var model = _configuration["XAI:Model"] ?? "grok-3";
                var temperature = _configuration.GetValue<double>("XAI:Temperature", 0.8);
                var maxTokens = _configuration.GetValue<int>("XAI:MaxTokens", 15000);

                _loggingService.LogDebug($"XAI 配置 - Model: {model}, Temperature: {temperature}, MaxTokens: {maxTokens}");
                _loggingService.LogDebug($"API Key 前10字符: {apiKey?.Substring(0, Math.Min(10, apiKey?.Length ?? 0))}...");

                if (string.IsNullOrEmpty(apiKey))
                {
                    _loggingService.LogWarning("X.AI API Key 未配置，返回原始 HTML");
                    return originalHtml;
                }

                // 構建 AI 請求
                var aiRequest = new
                {
                    messages = new[]
                    {
                        new { role = "user", content = prompt }
                    },
                    model = model,
                    temperature = temperature,
                    max_tokens = maxTokens
                };

                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

                var jsonContent = JsonSerializer.Serialize(aiRequest);
                var content = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");

                _loggingService.LogInformation($"發送 AI 請求...");
                _loggingService.LogDebug($"請求 URL: https://api.x.ai/v1/chat/completions");
                _loggingService.LogDebug($"請求內容長度: {jsonContent.Length}");
                _loggingService.LogDebug($"提示詞長度: {prompt.Length}");
                _loggingService.LogDebug($"HTTP 客戶端超時設置: {_httpClient.Timeout.TotalMinutes} 分鐘");

                var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                
                try
                {
                    var response = await _httpClient.PostAsync("https://api.x.ai/v1/chat/completions", content);
                    stopwatch.Stop();
                    
                    _loggingService.LogInformation($"AI 請求完成，耗時: {stopwatch.ElapsedMilliseconds}ms ({stopwatch.ElapsedMilliseconds / 1000.0:F2}秒)");
                    _loggingService.LogDebug($"響應狀態碼: {response.StatusCode}");
                    
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _loggingService.LogDebug($"響應內容長度: {responseContent.Length}");
                    
                    if (responseContent.Length > 0)
                    {
                        _loggingService.LogDebug($"響應內容前500字符: {responseContent.Substring(0, Math.Min(500, responseContent.Length))}");
                    }

                    if (!response.IsSuccessStatusCode)
                    {
                        _loggingService.LogError($"AI 請求失敗: {response.StatusCode} - {responseContent}");
                        _loggingService.LogWarning("=== FillFormWithAI 失敗 - HTTP 錯誤 ===");
                        return originalHtml;
                    }

                    // 解析 AI 響應
                    try
                    {
                        var aiResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                        var filledHtml = aiResponse.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

                        _loggingService.LogInformation($"AI 填充完成，新 HTML 長度: {filledHtml?.Length ?? 0}");
                        _loggingService.LogInformation("=== FillFormWithAI 成功完成 ===");
                        return filledHtml;
                    }
                    catch (Exception parseEx)
                    {
                        _loggingService.LogError($"解析 AI 響應失敗: {parseEx.Message}");
                        _loggingService.LogWarning("=== FillFormWithAI 失敗 - 響應解析錯誤 ===");
                        return originalHtml;
                    }
                }
                catch (TaskCanceledException timeoutEx)
                {
                    _loggingService.LogError($"AI 請求超時: {timeoutEx.Message}");
                    _loggingService.LogWarning("=== FillFormWithAI 失敗 - 請求超時 ===");
                    return originalHtml;
                }
                catch (HttpRequestException httpEx)
                {
                    _loggingService.LogError($"HTTP 請求錯誤: {httpEx.Message}");
                    _loggingService.LogWarning("=== FillFormWithAI 失敗 - HTTP 請求錯誤 ===");
                    return originalHtml;
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"AI 請求發生未預期錯誤: {ex.Message}");
                    _loggingService.LogWarning("=== FillFormWithAI 失敗 - 未預期錯誤 ===");
                    return originalHtml;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"FillFormWithAIAsync 發生錯誤: {ex.Message}");
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}");
                return originalHtml;
            }
        }

        /// <summary>
        /// 發送 eForm WhatsApp 消息
        /// </summary>
        public async Task SendEFormWhatsAppMessageAsync(string to, string formName, string formUrl, WorkflowExecution execution)
        {
            try
            {
                _loggingService.LogInformation($"=== EFormService.SendEFormWhatsAppMessageAsync 開始 ===");
                _loggingService.LogInformation($"收件人: {to}");
                _loggingService.LogInformation($"表單名稱: {formName}");
                _loggingService.LogInformation($"表單URL: {formUrl}");

                // 獲取公司 WhatsApp 配置
                var workflowDefinition = await _context.WorkflowDefinitions
                    .FirstOrDefaultAsync(w => w.Id == execution.WorkflowDefinitionId);

                if (workflowDefinition == null)
                {
                    throw new Exception("找不到工作流程定義");
                }

                var company = await _context.Companies
                    .FirstOrDefaultAsync(c => c.Id == workflowDefinition.CompanyId);

                if (company == null)
                {
                    throw new Exception("找不到公司配置");
                }

                if (string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    throw new Exception("公司未配置 WhatsApp API");
                }

                // 格式化電話號碼
                var formattedTo = to;
                if (!to.StartsWith("852"))
                {
                    if (to.StartsWith("0"))
                    {
                        to = to.Substring(1);
                    }
                    formattedTo = "852" + to;
                }

                // 構建消息內容
                var message = $"您有一個新的表單需要填寫：\n\n表單名稱：{formName}\n\n請點擊以下鏈接填寫表單：\n{formUrl}\n\n填寫完成後請點擊表單頂部的「批准」或「拒絕」按鈕。";

                // 使用 WhatsAppWorkflowService 發送消息
                await _whatsAppWorkflowService.SendWhatsAppMessageAsync(formattedTo, message, execution, _context);

                _loggingService.LogInformation($"成功發送 eForm WhatsApp 消息到 {formattedTo}");
                _loggingService.LogInformation($"=== EFormService.SendEFormWhatsAppMessageAsync 完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 eForm WhatsApp 消息失敗: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 根據表單名稱查找表單定義
        /// </summary>
        public async Task<eFormDefinition> FindFormDefinitionByNameAsync(string formName)
        {
            return await _context.eFormDefinitions
                .FirstOrDefaultAsync(f => f.Name == formName && f.Status == "A");
        }

        /// <summary>
        /// 創建表單實例
        /// </summary>
        public async Task<EFormInstance> CreateFormInstanceAsync(
            Guid formDefinitionId, 
            int workflowExecutionId, 
            int workflowStepExecutionId, 
            Guid companyId, 
            string formName)
        {
            var eFormInstance = new EFormInstance
            {
                Id = Guid.NewGuid(),
                EFormDefinitionId = formDefinitionId,
                WorkflowExecutionId = workflowExecutionId,
                WorkflowStepExecutionId = workflowStepExecutionId,
                CompanyId = companyId,
                InstanceName = $"{formName}_{workflowExecutionId}_{DateTime.Now:yyyyMMddHHmmss}",
                Status = "Pending",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.EFormInstances.Add(eFormInstance);
            await _context.SaveChangesAsync();

            return eFormInstance;
        }

        /// <summary>
        /// 更新表單實例的 AI 填充內容
        /// </summary>
        public async Task UpdateFormInstanceWithAIFillAsync(Guid formInstanceId, string filledHtml)
        {
            var formInstance = await _context.EFormInstances.FindAsync(formInstanceId);
            if (formInstance != null)
            {
                formInstance.FilledHtmlCode = filledHtml;
                formInstance.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        /// <summary>
        /// 釋放資源
        /// </summary>
        public void Dispose()
        {
            _httpClient?.Dispose();
        }
    }
}
