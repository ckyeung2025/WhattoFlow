using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using PurpleRice.Services;
using PurpleRice.Services.WebhookServices;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Web;

namespace PurpleRice.Services
{
    public class WorkflowEngine
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
        private readonly LoggingService _loggingService;
        private readonly IConfiguration _configuration;
        private readonly EFormService _eFormService;
        private readonly ISwitchConditionService _switchConditionService;
        private readonly UserSessionService _userSessionService;
        private readonly DataSetQueryService _dataSetQueryService;
        private readonly IVariableReplacementService _variableReplacementService;
        private readonly PurpleRiceDbContext _context;
        private readonly RecipientResolverService _recipientResolverService;
        private readonly IEFormTokenService _eFormTokenService;
        private readonly IEmailService _emailService;
        private readonly WorkflowMessageSendService _messageSendService;

        public WorkflowEngine(IServiceProvider serviceProvider, WhatsAppWorkflowService whatsAppWorkflowService, 
            Func<string, LoggingService> loggingServiceFactory, IConfiguration configuration, EFormService eFormService, ISwitchConditionService switchConditionService, UserSessionService userSessionService, DataSetQueryService dataSetQueryService, IVariableReplacementService variableReplacementService, PurpleRiceDbContext context, RecipientResolverService recipientResolverService, IEFormTokenService eFormTokenService, IEmailService emailService, WorkflowMessageSendService messageSendService)
        {
            _serviceProvider = serviceProvider;
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _loggingService = loggingServiceFactory("WorkflowEngine");
            _configuration = configuration;
            _eFormService = eFormService;
            _switchConditionService = switchConditionService;
            _userSessionService = userSessionService;
            _dataSetQueryService = dataSetQueryService;
            _variableReplacementService = variableReplacementService;
            _context = context;
            _recipientResolverService = recipientResolverService;
            _eFormTokenService = eFormTokenService;
            _emailService = emailService;
            _messageSendService = messageSendService;
        }

        private void WriteLog(string message)
        {
            _loggingService.LogInformation(message);
        }

        // 從 nodeData 讀取 templateHeaderUrl 等字段
        private (string url, string type, string filename) GetTemplateHeaderInfo(WorkflowNodeData nodeData, WorkflowStepExecution stepExec = null, WorkflowExecution execution = null)
        {
            string templateHeaderUrl = null;
            string templateHeaderType = null;
            string templateHeaderFilename = null;
            string templateHeaderImageSource = null;
            
            try
            {
                WriteLog($"🔍 [DEBUG] 開始讀取 templateHeader 信息，nodeData.Json={(nodeData.Json != null ? "有值" : "null")}");
                
                // 方法0: 優先從 nodeData 的直接屬性讀取（如果 WorkflowNodeData 類有這些屬性）
                if (!string.IsNullOrEmpty(nodeData.TemplateHeaderUrl))
                {
                    templateHeaderUrl = nodeData.TemplateHeaderUrl;
                    templateHeaderType = nodeData.TemplateHeaderType;
                    templateHeaderFilename = nodeData.TemplateHeaderFilename;
                    templateHeaderImageSource = nodeData.TemplateHeaderImageSource;
                    WriteLog($"🔍 [DEBUG] 從 nodeData 直接屬性讀取: URL={templateHeaderUrl}, Type={templateHeaderType}, Filename={templateHeaderFilename}, ImageSource={templateHeaderImageSource}");
                }
                
                // 方法1: 如果直接屬性沒有，優先從 stepExec.InputJson 讀取（包含完整的節點數據）
                if (stepExec != null && !string.IsNullOrEmpty(stepExec.InputJson))
                {
                    try
                    {
                        WriteLog($"🔍 [DEBUG] stepExec.InputJson 長度: {stepExec.InputJson.Length} 字符");
                        var inputData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(stepExec.InputJson);
                        if (inputData != null)
                        {
                            WriteLog($"🔍 [DEBUG] stepExec.InputJson 包含的鍵: {string.Join(", ", inputData.Keys)}");
                            
                            if (inputData.TryGetValue("Data", out var dataElement))
                            {
                                WriteLog($"🔍 [DEBUG] 找到 Data 字段，類型: {dataElement.ValueKind}");
                                
                                if (dataElement.ValueKind == JsonValueKind.Object)
                                {
                                    var dataDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(dataElement.GetRawText());
                                    if (dataDict != null)
                                    {
                                        WriteLog($"🔍 [DEBUG] Data 字段包含的鍵: {string.Join(", ", dataDict.Keys.Take(30))}");
                                        
                                        if (dataDict.TryGetValue("templateHeaderUrl", out var urlElement) && urlElement.ValueKind != JsonValueKind.Null)
                                        {
                                            templateHeaderUrl = urlElement.GetString();
                                            WriteLog($"🔍 [DEBUG] 從 stepExec.InputJson.Data 讀取到 templateHeaderUrl: {templateHeaderUrl}");
                                        }
                                        if (dataDict.TryGetValue("templateHeaderType", out var typeElement) && typeElement.ValueKind != JsonValueKind.Null)
                                        {
                                            templateHeaderType = typeElement.GetString();
                                            WriteLog($"🔍 [DEBUG] 從 stepExec.InputJson.Data 讀取到 templateHeaderType: {templateHeaderType}");
                                        }
                                        if (dataDict.TryGetValue("templateHeaderFilename", out var filenameElement) && filenameElement.ValueKind != JsonValueKind.Null)
                                        {
                                            templateHeaderFilename = filenameElement.GetString();
                                            WriteLog($"🔍 [DEBUG] 從 stepExec.InputJson.Data 讀取到 templateHeaderFilename: {templateHeaderFilename}");
                                        }
                                        if (dataDict.TryGetValue("templateHeaderImageSource", out var sourceElement) && sourceElement.ValueKind != JsonValueKind.Null)
                                        {
                                            templateHeaderImageSource = sourceElement.GetString();
                                            WriteLog($"🔍 [DEBUG] 從 stepExec.InputJson.Data 讀取到 templateHeaderImageSource: {templateHeaderImageSource}");
                                        }
                                    }
                                }
                                else if (dataElement.ValueKind == JsonValueKind.String)
                                {
                                    // 如果 Data 是字符串，嘗試再次反序列化
                                    var dataString = dataElement.GetString();
                                    if (!string.IsNullOrEmpty(dataString))
                                    {
                                        var dataDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(dataString);
                                        if (dataDict != null)
                                        {
                                            WriteLog($"🔍 [DEBUG] Data 字符串包含的鍵: {string.Join(", ", dataDict.Keys.Take(30))}");
                                            
                                            if (dataDict.TryGetValue("templateHeaderImageSource", out var sourceElement) && sourceElement.ValueKind != JsonValueKind.Null)
                                            {
                                                templateHeaderImageSource = sourceElement.GetString();
                                                WriteLog($"🔍 [DEBUG] 從 stepExec.InputJson.Data (字符串) 讀取到 templateHeaderImageSource: {templateHeaderImageSource}");
                                            }
                                            if (dataDict.TryGetValue("templateHeaderType", out var typeElement) && typeElement.ValueKind != JsonValueKind.Null)
                                            {
                                                templateHeaderType = typeElement.GetString();
                                                WriteLog($"🔍 [DEBUG] 從 stepExec.InputJson.Data (字符串) 讀取到 templateHeaderType: {templateHeaderType}");
                                            }
                                            if (dataDict.TryGetValue("templateHeaderUrl", out var urlElement) && urlElement.ValueKind != JsonValueKind.Null)
                                            {
                                                templateHeaderUrl = urlElement.GetString();
                                                WriteLog($"🔍 [DEBUG] 從 stepExec.InputJson.Data (字符串) 讀取到 templateHeaderUrl: {templateHeaderUrl}");
                                            }
                                        }
                                    }
                                }
                            }
                            else
                            {
                                WriteLog($"⚠️ stepExec.InputJson 中沒有找到 Data 字段");
                            }
                        }
                    }
                    catch (Exception ex1)
                    {
                        WriteLog($"⚠️ 從 stepExec.InputJson 讀取失敗: {ex1.Message}, StackTrace: {ex1.StackTrace}");
                    }
                }
                
                // 方法2: 嘗試從 nodeData.Json 字段讀取
                if (string.IsNullOrEmpty(templateHeaderUrl) || string.IsNullOrEmpty(templateHeaderFilename) || string.IsNullOrEmpty(templateHeaderImageSource))
                {
                    if (nodeData.Json != null)
                    {
                        var jsonData = JsonSerializer.Deserialize<Dictionary<string, object>>(nodeData.Json);
                        if (jsonData != null)
                        {
                            if (string.IsNullOrEmpty(templateHeaderUrl) && jsonData.TryGetValue("templateHeaderUrl", out var urlObj) && urlObj != null)
                            {
                                templateHeaderUrl = urlObj.ToString();
                                WriteLog($"🔍 [DEBUG] 從 nodeData.Json 讀取到 templateHeaderUrl: {templateHeaderUrl}");
                            }
                            if (string.IsNullOrEmpty(templateHeaderType) && jsonData.TryGetValue("templateHeaderType", out var typeObj) && typeObj != null)
                            {
                                templateHeaderType = typeObj.ToString();
                                WriteLog($"🔍 [DEBUG] 從 nodeData.Json 讀取到 templateHeaderType: {templateHeaderType}");
                            }
                            if (string.IsNullOrEmpty(templateHeaderFilename) && jsonData.TryGetValue("templateHeaderFilename", out var filenameObj) && filenameObj != null)
                            {
                                templateHeaderFilename = filenameObj.ToString();
                                WriteLog($"🔍 [DEBUG] 從 nodeData.Json 讀取到 templateHeaderFilename: {templateHeaderFilename}");
                            }
                            if (string.IsNullOrEmpty(templateHeaderImageSource) && jsonData.TryGetValue("templateHeaderImageSource", out var sourceObj) && sourceObj != null)
                            {
                                templateHeaderImageSource = sourceObj.ToString();
                                WriteLog($"🔍 [DEBUG] 從 nodeData.Json 讀取到 templateHeaderImageSource: {templateHeaderImageSource}");
                            }
                        }
                    }
                }
                
                // 方法3: 如果 Json 中沒有，嘗試將整個 nodeData 序列化為 JSON 然後讀取
                // 因為這些字段可能直接作為 nodeData 的屬性存在
                if (string.IsNullOrEmpty(templateHeaderUrl) || string.IsNullOrEmpty(templateHeaderFilename) || string.IsNullOrEmpty(templateHeaderImageSource))
                {
                    try
                    {
                        WriteLog($"🔍 [DEBUG] Json 中未找到，嘗試序列化整個 nodeData...");
                        var nodeDataJson = JsonSerializer.Serialize(nodeData);
                        WriteLog($"🔍 [DEBUG] nodeData 序列化後長度: {nodeDataJson.Length} 字符");
                        
                        var nodeDataDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(nodeDataJson);
                        
                        if (nodeDataDict != null)
                        {
                            WriteLog($"🔍 [DEBUG] nodeData 包含的鍵: {string.Join(", ", nodeDataDict.Keys.Take(20))}");
                            
                            if (string.IsNullOrEmpty(templateHeaderUrl) && nodeDataDict.TryGetValue("templateHeaderUrl", out var urlElement))
                            {
                                templateHeaderUrl = urlElement.GetString();
                                WriteLog($"🔍 [DEBUG] 從序列化的 nodeData 讀取到 templateHeaderUrl: {templateHeaderUrl}");
                            }
                            if (string.IsNullOrEmpty(templateHeaderType) && nodeDataDict.TryGetValue("templateHeaderType", out var typeElement))
                            {
                                templateHeaderType = typeElement.GetString();
                                WriteLog($"🔍 [DEBUG] 從序列化的 nodeData 讀取到 templateHeaderType: {templateHeaderType}");
                            }
                            if (string.IsNullOrEmpty(templateHeaderFilename) && nodeDataDict.TryGetValue("templateHeaderFilename", out var filenameElement))
                            {
                                templateHeaderFilename = filenameElement.GetString();
                                WriteLog($"🔍 [DEBUG] 從序列化的 nodeData 讀取到 templateHeaderFilename: {templateHeaderFilename}");
                            }
                            if (string.IsNullOrEmpty(templateHeaderImageSource) && nodeDataDict.TryGetValue("templateHeaderImageSource", out var sourceElement))
                            {
                                templateHeaderImageSource = sourceElement.GetString();
                                WriteLog($"🔍 [DEBUG] 從序列化的 nodeData 讀取到 templateHeaderImageSource: {templateHeaderImageSource}");
                            }
                        }
                    }
                    catch (Exception ex2)
                    {
                        WriteLog($"⚠️ 從 nodeData 序列化讀取 templateHeaderUrl 失敗: {ex2.Message}");
                    }
                }
                
                // 如果選擇使用流程實例圖片，且類型為 image，則從流程實例目錄讀取圖片
                if (templateHeaderImageSource == "instance" && 
                    templateHeaderType?.ToLower() == "image" && 
                    (execution != null || (stepExec != null && stepExec.WorkflowExecutionId > 0)))
                {
                    try
                    {
                        int executionId = execution?.Id ?? stepExec.WorkflowExecutionId;
                        WriteLog($"🖼️ 檢測到使用流程實例圖片，執行 ID: {executionId}");
                        
                        // 構建目錄路徑：Uploads\Whatsapp_Images\{executionId}
                        var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Whatsapp_Images", executionId.ToString());
                        
                        if (Directory.Exists(uploadsPath))
                        {
                            WriteLog($"📁 流程實例圖片目錄存在: {uploadsPath}");
                            
                            // 獲取所有圖片文件，排除 qr_scan_success_* 的文件
                            var imageFiles = Directory.GetFiles(uploadsPath, "*.*", SearchOption.TopDirectoryOnly)
                                .Where(f => {
                                    var fileName = Path.GetFileName(f);
                                    var ext = Path.GetExtension(fileName).ToLower();
                                    // 只處理圖片文件
                                    var isImage = ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".bmp" || ext == ".webp";
                                    // 排除 qr_scan_success_* 的文件
                                    var isExcluded = fileName.StartsWith("qr_scan_success_", StringComparison.OrdinalIgnoreCase);
                                    return isImage && !isExcluded;
                                })
                                .OrderBy(f => new FileInfo(f).CreationTime) // 按創建時間排序，最早的在前
                                .ToList();
                            
                            if (imageFiles.Any())
                            {
                                var selectedImage = imageFiles.First(); // 取最早的一張
                                var fileName = Path.GetFileName(selectedImage);
                                
                                // 構建相對 URL：/Uploads/Whatsapp_Images/{executionId}/{fileName}
                                templateHeaderUrl = $"/Uploads/Whatsapp_Images/{executionId}/{fileName}";
                                
                                WriteLog($"✅ 找到流程實例圖片: {templateHeaderUrl} (共 {imageFiles.Count} 張圖片，選擇最早的一張)");
                            }
                            else
                            {
                                WriteLog($"⚠️ 流程實例圖片目錄中沒有找到可用的圖片文件（已排除 qr_scan_success_* 文件）");
                            }
                        }
                        else
                        {
                            WriteLog($"⚠️ 流程實例圖片目錄不存在: {uploadsPath}");
                        }
                    }
                    catch (Exception ex3)
                    {
                        WriteLog($"⚠️ 讀取流程實例圖片失敗: {ex3.Message}");
                    }
                }
                
                // 記錄讀取結果
                if (!string.IsNullOrEmpty(templateHeaderUrl) || !string.IsNullOrEmpty(templateHeaderFilename))
                {
                    WriteLog($"✅ 從節點數據讀取 Header 信息: URL={templateHeaderUrl ?? "null"}, Type={templateHeaderType ?? "null"}, Filename={templateHeaderFilename ?? "null"}, ImageSource={templateHeaderImageSource ?? "null"}");
                }
                else
                {
                    WriteLog($"⚠️ 未從節點數據讀取到 Header 信息");
                }
            }
            catch (Exception ex)
            {
                WriteLog($"⚠️ 讀取 templateHeaderUrl 失敗: {ex.Message}");
            }
            
            return (templateHeaderUrl, templateHeaderType, templateHeaderFilename);
        }

        // 從等待節點繼續執行流程的方法
        public async Task ContinueWorkflowFromWaitReply(WorkflowExecution execution, object inputData, Guid? formInstanceId = null)
        {
            try
            {
                WriteLog($"=== 繼續執行工作流程 ===");
                WriteLog($"執行 ID: {execution.Id}");
                WriteLog($"當前步驟: {execution.CurrentStep}");
                
                // 確保 WorkflowDefinition 已加載
                if (execution.WorkflowDefinition == null)
                {
                    WriteLog($"WorkflowDefinition 未加載，重新加載執行記錄");
                    using var scope = _serviceProvider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                    
                    execution = await db.WorkflowExecutions
                        .Include(e => e.WorkflowDefinition)
                        .FirstOrDefaultAsync(e => e.Id == execution.Id);
                    
                    if (execution?.WorkflowDefinition == null)
                    {
                        WriteLog($"無法加載 WorkflowDefinition，執行 ID: {execution?.Id}");
                        return;
                    }
                }
                
                // 解析流程 JSON
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                
                // 先手動處理 maxRetries 字段（可能為字符串），轉換為整數
                string processedJson = execution.WorkflowDefinition.Json;
                try
                {
                    using var doc = JsonDocument.Parse(execution.WorkflowDefinition.Json);
                    var root = doc.RootElement;
                    
                    if (root.TryGetProperty("nodes", out var nodesElement))
                    {
                        var nodesList = new List<System.Text.Json.Nodes.JsonNode>();
                        foreach (var node in nodesElement.EnumerateArray())
                        {
                            var nodeJson = node.GetRawText();
                            var nodeObj = System.Text.Json.Nodes.JsonNode.Parse(nodeJson);
                            
                            // 遞歸處理 maxRetries 字段
                            ProcessMaxRetriesField(nodeObj);
                            
                            nodesList.Add(nodeObj);
                        }
                        
                        var newRoot = new System.Text.Json.Nodes.JsonObject();
                        newRoot["nodes"] = new System.Text.Json.Nodes.JsonArray(nodesList.ToArray());
                        
                        if (root.TryGetProperty("edges", out var edgesElement))
                        {
                            newRoot["edges"] = System.Text.Json.Nodes.JsonNode.Parse(edgesElement.GetRawText());
                        }
                        
                        processedJson = newRoot.ToJsonString();
                    }
                }
                catch (Exception ex)
                {
                    WriteLog($"處理 maxRetries 字段時發生錯誤，使用原始 JSON: {ex.Message}");
                    // 如果處理失敗，使用原始 JSON
                }
                
                var flowData = JsonSerializer.Deserialize<WorkflowGraph>(processedJson, options);
                if (flowData?.Nodes == null || flowData?.Edges == null) return;

                // 構建鄰接表（有向圖）
                var adjacencyList = BuildAdjacencyList(flowData.Edges);

                // 根據流程狀態決定如何繼續
                if (execution.Status == "WaitingForFormApproval")
                {
                    // ✅ 修復：如果提供了 formInstanceId，直接使用它；否則查找最近提交的表單實例
                    Guid? finalFormInstanceId = formInstanceId;
                    
                    if (!finalFormInstanceId.HasValue)
                    {
                        WriteLog($"未提供 formInstanceId，查找最近提交的表單實例");
                        using var scope = _serviceProvider.CreateScope();
                        var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                        
                        // 查找最近提交的 EFormInstance（狀態可能是 Submitted、Approved 或 Rejected）
                        var recentFormInstance = await db.EFormInstances
                            .Where(f => f.WorkflowExecutionId == execution.Id && 
                                       (f.Status == "Submitted" || f.Status == "Approved" || f.Status == "Rejected") &&
                                       f.UpdatedAt >= DateTime.UtcNow.AddMinutes(-10)) // 最近10分鐘內更新的
                            .OrderByDescending(f => f.UpdatedAt)
                            .FirstOrDefaultAsync();
                        
                        if (recentFormInstance != null)
                        {
                            finalFormInstanceId = recentFormInstance.Id;
                            WriteLog($"找到最近提交的表單實例: {finalFormInstanceId} (狀態: {recentFormInstance.Status})");
                        }
                        else
                        {
                            WriteLog($"警告: 找不到最近提交的表單實例");
                        }
                    }
                    else
                    {
                        WriteLog($"使用提供的 formInstanceId: {finalFormInstanceId}");
                    }
                    
                    await ContinueFromFormApproval(execution, flowData, adjacencyList, finalFormInstanceId);
                }
                else
                {
                    await ContinueFromWaitReply(execution, flowData, adjacencyList);
                }
                
                WriteLog($"=== 繼續執行完成 ===");
            }
            catch (Exception ex)
            {
                WriteLog($"=== 繼續執行工作流程失敗 ===");
                WriteLog($"錯誤: {ex.Message}");
                WriteLog($"堆疊: {ex.StackTrace}");
                
                execution.Status = "Error";
                execution.ErrorMessage = ex.Message;
                await SaveExecution(execution);
            }
        }

        public async Task ExecuteWorkflowAsync(WorkflowExecution execution, string userId = null)
        {
            try
            {
                // 解析流程 JSON
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                
                // 先手動處理 maxRetries 字段（可能為字符串），轉換為整數
                string processedJson = execution.WorkflowDefinition.Json;
                try
                {
                    using var doc = JsonDocument.Parse(execution.WorkflowDefinition.Json);
                    var root = doc.RootElement;
                    
                    if (root.TryGetProperty("nodes", out var nodesElement))
                    {
                        var nodesList = new List<System.Text.Json.Nodes.JsonNode>();
                        foreach (var node in nodesElement.EnumerateArray())
                        {
                            var nodeJson = node.GetRawText();
                            var nodeObj = System.Text.Json.Nodes.JsonNode.Parse(nodeJson);
                            
                            // 遞歸處理 maxRetries 字段
                            ProcessMaxRetriesField(nodeObj);
                            
                            nodesList.Add(nodeObj);
                        }
                        
                        var newRoot = new System.Text.Json.Nodes.JsonObject();
                        newRoot["nodes"] = new System.Text.Json.Nodes.JsonArray(nodesList.ToArray());
                        
                        if (root.TryGetProperty("edges", out var edgesElement))
                        {
                            newRoot["edges"] = System.Text.Json.Nodes.JsonNode.Parse(edgesElement.GetRawText());
                        }
                        
                        processedJson = newRoot.ToJsonString();
                    }
                }
                catch (Exception ex)
                {
                    WriteLog($"處理 maxRetries 字段時發生錯誤，使用原始 JSON: {ex.Message}");
                    // 如果處理失敗，使用原始 JSON
                }
                
                var flowData = JsonSerializer.Deserialize<WorkflowGraph>(processedJson, options);
                if (flowData?.Nodes == null || flowData?.Edges == null) return;

                // 驗證邊緣
                if (!ValidateWorkflowEdges(flowData.Edges, flowData.Nodes))
                {
                    execution.Status = "Error";
                    execution.ErrorMessage = "工作流程邊緣驗證失敗";
                    await SaveExecution(execution);
                    return;
                }

                // 構建鄰接表
                var adjacencyList = BuildAdjacencyList(flowData.Edges);

                // 找到起始節點
                var startNode = flowData.Nodes.FirstOrDefault(n => n.Data?.Type == "start");
                if (startNode == null) return;

                WriteLog($"=== 開始執行工作流程 ===");
                WriteLog($"執行 ID: {execution.Id}");
                WriteLog($"節點數量: {flowData.Nodes.Count}");
                WriteLog($"邊數量: {flowData.Edges.Count}");
                WriteLog($"起始節點: {startNode.Id}");

                // 使用多分支執行引擎
                await ExecuteMultiBranchWorkflow(startNode.Id, flowData.Nodes, adjacencyList, execution, userId, flowData.Edges);
                
                WriteLog($"=== 工作流程執行完成 ===");
            }
            catch (Exception ex)
            {
                WriteLog($"=== 工作流程執行失敗 ===");
                WriteLog($"錯誤: {ex.Message}");
                WriteLog($"堆疊: {ex.StackTrace}");
                
                execution.Status = "Error";
                execution.ErrorMessage = ex.Message;
                await SaveExecution(execution);
            }
        }

        public async Task<WorkflowExecutionResult> ExecuteWorkflow(int executionId, object inputData)
        {
            try
            {
                WriteLog($"=== ExecuteWorkflow 開始 ===");
                WriteLog($"執行 ID: {executionId}");

                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();

                var execution = await db.WorkflowExecutions
                    .Include(e => e.WorkflowDefinition)
                    .FirstOrDefaultAsync(e => e.Id == executionId);

                if (execution == null)
                    throw new Exception($"找不到執行記錄: {executionId}");

                if (inputData != null)
                    execution.InputJson = JsonSerializer.Serialize(inputData);

                await ExecuteWorkflowAsync(execution, null);

                return new WorkflowExecutionResult
                {
                    Status = execution.Status,
                    OutputData = new
                    {
                        executionId = execution.Id,
                        status = execution.Status,
                        completedAt = execution.EndedAt,
                        errorMessage = execution.ErrorMessage
                    }
                };
            }
            catch (Exception ex)
            {
                WriteLog($"ExecuteWorkflow 失敗: {ex.Message}");
                return new WorkflowExecutionResult
                {
                    Status = "Failed",
                    OutputData = new { error = ex.Message, stackTrace = ex.StackTrace }
                };
            }
        }

        // 構建鄰接表
        private Dictionary<string, List<string>> BuildAdjacencyList(List<WorkflowEdge> edges)
        {
            var adjacencyList = new Dictionary<string, List<string>>();
            
            foreach (var edge in edges)
            {
                // 確保 Source 和 Target 不為空
                if (string.IsNullOrEmpty(edge.Source) || string.IsNullOrEmpty(edge.Target))
                {
                    WriteLog($"警告: 邊緣 {edge.Id} 的 Source 或 Target 為空，跳過");
                    continue;
                }
                
                // 防止自連接
                if (edge.Source == edge.Target)
                {
                    WriteLog($"警告: 邊緣 {edge.Id} 是自連接，跳過");
                    continue;
                }
                
                if (!adjacencyList.ContainsKey(edge.Source))
                    adjacencyList[edge.Source] = new List<string>();
                    
                // 防止重複連接
                if (!adjacencyList[edge.Source].Contains(edge.Target))
                {
                    adjacencyList[edge.Source].Add(edge.Target);
                    WriteLog($"添加連接: {edge.Source} -> {edge.Target} (邊緣ID: {edge.Id})");
                }
                else
                {
                    WriteLog($"警告: 重複連接 {edge.Source} -> {edge.Target}，跳過");
                }
            }
            
            return adjacencyList;
        }

        // 驗證工作流程邊緣
        private bool ValidateWorkflowEdges(List<WorkflowEdge> edges, List<WorkflowNode> nodes)
        {
            var nodeIds = nodes.Select(n => n.Id).ToHashSet();
            var issues = new List<string>();
            var validEdges = new List<WorkflowEdge>();
            
            foreach (var edge in edges)
            {
                bool isValid = true;
                
                // 檢查 Source 節點是否存在
                if (!nodeIds.Contains(edge.Source))
                {
                    issues.Add($"邊緣 {edge.Id} 的 Source 節點 {edge.Source} 不存在");
                    isValid = false;
                }
                
                // 檢查 Target 節點是否存在
                if (!nodeIds.Contains(edge.Target))
                {
                    issues.Add($"邊緣 {edge.Id} 的 Target 節點 {edge.Target} 不存在");
                    isValid = false;
                }
                
                // 檢查自連接
                if (edge.Source == edge.Target)
                {
                    issues.Add($"邊緣 {edge.Id} 是自連接");
                    isValid = false;
                }
                
                // 只保留有效的邊緣
                if (isValid)
                {
                    validEdges.Add(edge);
                }
            }
            
            if (issues.Any())
            {
                WriteLog("工作流程邊緣驗證發現問題，自動清理無效邊緣:");
                foreach (var issue in issues)
                {
                    WriteLog($"- {issue}");
                }
                
                // 更新邊緣列表，移除無效邊緣
                edges.Clear();
                edges.AddRange(validEdges);
                
                WriteLog($"已清理無效邊緣，保留 {validEdges.Count} 個有效邊緣");
            }
            
            return true; // 總是返回 true，因為我們已經清理了無效邊緣
        }

        // 從表單審批狀態繼續
        private async Task ContinueFromFormApproval(WorkflowExecution execution, WorkflowGraph flowData, Dictionary<string, List<string>> adjacencyList, Guid? formInstanceId = null)
                {
                    WriteLog($"流程狀態為 WaitingForFormApproval，尋找 sendEForm 節點");
                    
                    // ✅ 修復：如果提供了 formInstanceId，通過它找到對應的 sendEForm 節點
                    string sendEFormNodeId = null;
                    
                    if (formInstanceId.HasValue)
                    {
                        WriteLog($"通過 EFormInstance ID {formInstanceId} 查找對應的 sendEForm 節點");
                        using var scope = _serviceProvider.CreateScope();
                        var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                        
                        var formInstance = await db.EFormInstances
                            .FirstOrDefaultAsync(f => f.Id == formInstanceId.Value);
                        
                        if (formInstance != null && formInstance.WorkflowStepExecutionId > 0)
                        {
                            var stepExecution = await db.WorkflowStepExecutions
                                .FirstOrDefaultAsync(s => s.Id == formInstance.WorkflowStepExecutionId);
                            
                            if (stepExecution != null && !string.IsNullOrEmpty(stepExecution.InputJson))
                            {
                                try
                                {
                                    var inputData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(stepExecution.InputJson);
                                    if (inputData.TryGetValue("Id", out var idElement))
                                        sendEFormNodeId = idElement.GetString();
                                    else if (inputData.TryGetValue("NodeId", out var nodeIdElement))
                                        sendEFormNodeId = nodeIdElement.GetString();
                                    
                                    WriteLog($"從步驟執行記錄中找到 sendEForm 節點 ID: {sendEFormNodeId}");
                                }
                                catch (Exception ex)
                                {
                                    WriteLog($"解析步驟執行記錄的 InputJson 時發生錯誤: {ex.Message}");
                                }
                            }
                        }
                    }
                    
                    // 如果沒有通過 formInstanceId 找到節點，使用舊邏輯（查找第一個 sendEForm 節點）
                    if (string.IsNullOrEmpty(sendEFormNodeId))
                    {
                        WriteLog($"未提供 formInstanceId 或無法從中提取節點 ID，使用舊邏輯查找第一個 sendEForm 節點");
                        var sendEFormNode = flowData.Nodes.FirstOrDefault(n => n.Data?.Type == "sendEForm" || n.Data?.Type == "sendeform");
                        if (sendEFormNode == null)
                        {
                            WriteLog($"錯誤: 找不到 sendEForm 節點");
                            return;
                        }
                        sendEFormNodeId = sendEFormNode.Id;
                        WriteLog($"找到第一個 sendEForm 節點: {sendEFormNodeId}");
                    }
                    
                    // 驗證節點是否存在於流程中
                    if (!flowData.Nodes.Any(n => n.Id == sendEFormNodeId))
                    {
                        WriteLog($"錯誤: 節點 {sendEFormNodeId} 不存在於流程中");
                        return;
                    }

            // 重要：檢查是否已經有 sendEForm 步驟執行過
            if (await IsNodeAlreadyExecuted(execution.Id, sendEFormNodeId, "sendEForm"))
            {
                WriteLog($"警告: sendEForm 節點 {sendEFormNodeId} 已經執行過，直接執行後續節點");
            }
            
            // ✅ 修復：只標記對應的 sendEForm 步驟為完成（而不是所有 sendEForm 步驟）
            await MarkSendEFormStepComplete(execution.Id, sendEFormNodeId);

            // 更新流程狀態
            execution.Status = "Running";
            execution.IsWaiting = false;
            execution.WaitingSince = null;
            execution.LastUserActivity = DateTime.UtcNow;
            execution.CurrentStep = (execution.CurrentStep ?? 0) + 1;
            await SaveExecution(execution);

            // 直接執行 sendEForm 節點的後續節點，而不是重新執行 sendEForm 節點本身
            await ExecuteAllNextNodes(sendEFormNodeId, flowData.Nodes.ToDictionary(n => n.Id), adjacencyList, execution, execution.WaitingForUser, flowData.Edges);
        }

        // 從等待回覆狀態繼續
        private async Task ContinueFromWaitReply(WorkflowExecution execution, WorkflowGraph flowData, Dictionary<string, List<string>> adjacencyList)
        {
                    WriteLog($"流程狀態為 {execution.Status}，使用等待用戶回覆邏輯");
                    
                    // ✅ 修復：查找當前正在等待的步驟執行記錄，而不是流程中的第一個等待節點
                    using var scope = _serviceProvider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                    
                    var currentWaitingStep = await db.WorkflowStepExecutions
                        .Where(s => s.WorkflowExecutionId == execution.Id && s.IsWaiting)
                        .OrderByDescending(s => s.Id)
                        .FirstOrDefaultAsync();
                    
                    if (currentWaitingStep == null)
                    {
                        WriteLog($"警告: 找不到當前等待的步驟執行記錄，使用舊邏輯查找第一個等待節點");
                        var waitNode = flowData.Nodes.FirstOrDefault(n => n.Data?.Type == "waitReply" || n.Data?.Type == "waitForUserReply" || n.Data?.Type == "waitForQRCode" || n.Data?.Type == "waitforqrcode" || n.Data?.Type == "sendEForm");
                        if (waitNode == null)
                        {
                            WriteLog($"錯誤: 找不到等待節點");
                            return;
                        }
                        // 先提取節點類型，避免在 LINQ 表達式中使用 null 條件運算符
                        var waitNodeType = waitNode.Data?.Type;
                        currentWaitingStep = await db.WorkflowStepExecutions
                            .FirstOrDefaultAsync(s => s.WorkflowExecutionId == execution.Id && s.StepType == waitNodeType);
                    }
                    
                    // 從 InputJson 中提取節點 ID
                    string waitNodeId = null;
                    if (!string.IsNullOrEmpty(currentWaitingStep.InputJson))
                    {
                        try
                        {
                            var nodeData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(currentWaitingStep.InputJson);
                            // 嘗試從多個可能的字段中提取節點信息
                            foreach (var flowNode in flowData.Nodes)
                            {
                                if (flowNode.Data?.Type == currentWaitingStep.StepType && 
                                    flowNode.Data?.TaskName == currentWaitingStep.TaskName)
                                {
                                    waitNodeId = flowNode.Id;
                                    break;
                                }
                            }
                        }
                        catch
                        {
                            WriteLog($"警告: 無法解析步驟的 InputJson");
                        }
                    }
                    
                    if (waitNodeId == null)
                    {
                        WriteLog($"錯誤: 無法確定等待節點的 ID");
                        return;
                    }
                    
                    WriteLog($"找到當前等待節點: {waitNodeId} (StepType: {currentWaitingStep.StepType}, TaskName: {currentWaitingStep.TaskName})");

            // 標記 waitReply 步驟完成
            await MarkWaitReplyStepComplete(execution.Id);

                    // 找到下一個節點
                    if (adjacencyList.ContainsKey(waitNodeId))
                    {
                        // ✅ 修復：過濾掉不存在的節點，只取第一個有效的節點
                        var nextNodeIds = adjacencyList[waitNodeId];
                        var nodeMap = flowData.Nodes.ToDictionary(n => n.Id);
                        var nextNodeId = nextNodeIds.FirstOrDefault(id => nodeMap.ContainsKey(id));
                        
                        if (nextNodeId != null)
                        {
                            WriteLog($"找到下一個節點: {nextNodeId}");
                            WriteLog($"注意: 等待節點有 {nextNodeIds.Count} 個後續連接，已過濾無效節點");
                            
                            // 更新執行狀態
                            execution.IsWaiting = false;
                            execution.WaitingSince = null;
                            execution.WaitingForUser = null; // ✅ 修復：清除 WaitingForUser，避免影響後續 waitReply 節點
                            execution.LastUserActivity = DateTime.UtcNow;
                            execution.Status = "Running";
                            execution.CurrentStep = (execution.CurrentStep ?? 0) + 1;
                    await SaveExecution(execution);

                            WriteLog($"執行狀態已更新，開始執行下一個節點: {nextNodeId}");
                    await ExecuteMultiBranchWorkflow(nextNodeId, flowData.Nodes, adjacencyList, execution, execution.WaitingForUser, flowData.Edges);
                        }
                        else
                        {
                            WriteLog($"錯誤: 等待節點 {waitNodeId} 沒有有效的後續節點（可能有無效邊連接）");
                        }
                    }
                    else
                    {
                        WriteLog($"錯誤: 等待節點 {waitNodeId} 在鄰接表中找不到");
                    }
                }
                
        // 核心：多分支執行引擎
        private async Task ExecuteMultiBranchWorkflow(string startNodeId, List<WorkflowNode> nodes, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId, List<WorkflowEdge> edges = null)
        {
            WriteLog($"=== 開始多分支執行引擎 ===");
            WriteLog($"起始節點: {startNodeId}");
            
            // 創建節點映射
            var nodeMap = nodes.ToDictionary(n => n.Id);
            
            // 從起始節點開始執行
            await ExecuteNodeWithBranches(startNodeId, nodeMap, adjacencyList, execution, userId, edges);
            
            WriteLog($"=== 多分支執行引擎完成 ===");
        }

        // 執行單個節點並處理其所有分支
        private async Task ExecuteNodeWithBranches(string nodeId, Dictionary<string, WorkflowNode> nodeMap, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId, List<WorkflowEdge> edges = null)
        {
            if (!nodeMap.ContainsKey(nodeId)) return;

            var node = nodeMap[nodeId];
            var nodeData = node.Data;

            WriteLog($"=== 執行節點: {nodeId} ===");
            WriteLog($"節點類型: {nodeData?.Type}");
            WriteLog($"任務名稱: {nodeData?.TaskName}");

            // 重要：檢查是否已經執行過這個節點，防止循環
            if (await IsNodeAlreadyExecuted(execution.Id, nodeId, nodeData?.Type))
            {
                WriteLog($"警告: 節點 {nodeId} ({nodeData?.Type}) 已經執行過，跳過以避免循環");
                return;
            }

            // 創建步驟執行記錄
            var stepExec = await CreateStepExecution(nodeId, nodeData, execution);
            if (stepExec == null) return;

            try
            {
                // 執行節點邏輯
                var shouldContinue = await ExecuteNodeLogic(nodeId, nodeData, stepExec, execution, userId);
                
                if (!shouldContinue)
                {
                    WriteLog($"節點 {nodeId} 設置為等待狀態，暫停執行");
                    return; // 節點設置為等待狀態，暫停執行
                }

                // 標記節點完成
                stepExec.Status = "Completed";
                stepExec.EndedAt = DateTime.UtcNow;
                await SaveStepExecution(stepExec);

                // 根據節點類型選擇執行方式
                if (nodeData?.Type == "switch")
                {
                    await ExecuteSwitchNextNodes(nodeId, nodeMap, adjacencyList, execution, userId, stepExec, edges);
                }
                else
                {
                    // 找到並執行所有後續節點（多分支並行執行）
                    await ExecuteAllNextNodes(nodeId, nodeMap, adjacencyList, execution, userId, edges);
                }
            }
            catch (Exception ex)
            {
                WriteLog($"執行節點 {nodeId} 時發生錯誤: {ex.Message}");
                stepExec.Status = "Failed";
                stepExec.EndedAt = DateTime.UtcNow;
                stepExec.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                await SaveStepExecution(stepExec);
                
                execution.Status = "Error";
                execution.ErrorMessage = ex.Message;
                await SaveExecution(execution);
            }
        }

        // 執行節點邏輯
        private async Task<bool> ExecuteNodeLogic(string nodeId, WorkflowNodeData nodeData, 
            WorkflowStepExecution stepExec, WorkflowExecution execution, string userId)
        {
            switch (nodeData?.Type)
            {
                case "start":
                    WriteLog("處理 Start 節點");
                    return true;

                case "sendWhatsApp":
                    return await ExecuteSendWhatsApp(nodeData, stepExec, execution);

                case "sendWhatsAppTemplate":
                    return await ExecuteSendWhatsAppTemplate(nodeData, stepExec, execution);

                case "waitReply":
                case "waitForUserReply":
                    return await ExecuteWaitReply(nodeData, stepExec, execution, userId);

                case "waitForQRCode":
                case "waitforqrcode":
                    return await ExecuteWaitForQRCode(nodeData, stepExec, execution, userId);

                case "sendEForm":
                case "sendeform":
                    return await ExecuteSendEForm(nodeData, stepExec, execution);

                case "switch":
                    return await ExecuteSwitch(nodeData, stepExec, execution, userId);

                case "end":
                    return await ExecuteEnd(nodeId, stepExec, execution);

                case "dataSetQuery":
                    return await ExecuteDataSetQuery(nodeData, stepExec, execution);

                default:
                    WriteLog($"未處理的節點類型: {nodeData?.Type}");
                    stepExec.Status = "UnknownStepType";
                    return false;
            }
        }

        // 執行所有後續節點（多分支並行執行）
        private async Task ExecuteAllNextNodes(string currentNodeId, Dictionary<string, WorkflowNode> nodeMap, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId, List<WorkflowEdge> edges = null)
        {
            if (!adjacencyList.ContainsKey(currentNodeId))
            {
                WriteLog($"節點 {currentNodeId} 沒有後續節點");
                return;
            }

            var nextNodeIds = adjacencyList[currentNodeId];
            WriteLog($"=== 節點 {currentNodeId} 的後續節點分析 ===");
            WriteLog($"後續節點數量: {nextNodeIds.Count}");
            WriteLog($"後續節點列表: {string.Join(", ", nextNodeIds)}");

            // 詳細檢查每個後續節點
            foreach (var nextNodeId in nextNodeIds)
            {
                if (nodeMap.ContainsKey(nextNodeId))
                {
                    var nextNode = nodeMap[nextNodeId];
                    WriteLog($"後續節點 {nextNodeId}: 類型={nextNode.Data?.Type}, 任務={nextNode.Data?.TaskName}");
                }
                else
                {
                    WriteLog($"警告: 後續節點 {nextNodeId} 不存在於節點映射中");
                }
            }

            // 並行執行所有後續節點
            var tasks = new List<Task>();
            foreach (var nextNodeId in nextNodeIds)
            {
                WriteLog($"創建任務: {nextNodeId}");
                var task = ExecuteNodeWithBranches(nextNodeId, nodeMap, adjacencyList, execution, userId, edges);
                tasks.Add(task);
            }

            WriteLog($"等待 {tasks.Count} 個並行任務完成...");
            await Task.WhenAll(tasks);
            WriteLog($"=== 所有 {tasks.Count} 個分支節點執行完成 ===");
        }

        // 創建步驟執行記錄
        private async Task<WorkflowStepExecution> CreateStepExecution(string nodeId, WorkflowNodeData nodeData, WorkflowExecution execution)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();

            // 檢查 nodeData 是否包含 templateHeaderImageSource
            if (nodeData != null)
            {
                try
                {
                    var nodeDataJson = JsonSerializer.Serialize(nodeData);
                    var nodeDataDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(nodeDataJson);
                    if (nodeDataDict != null && nodeDataDict.TryGetValue("templateHeaderImageSource", out var imageSourceElement))
                    {
                        WriteLog($"🔍 [DEBUG] CreateStepExecution: nodeData 包含 templateHeaderImageSource: {imageSourceElement.GetString()}");
                    }
                    else
                    {
                        WriteLog($"⚠️ [DEBUG] CreateStepExecution: nodeData 不包含 templateHeaderImageSource，可用鍵: {string.Join(", ", nodeDataDict?.Keys.Take(30) ?? new string[0])}");
                    }
                }
                catch (Exception ex)
                {
                    WriteLog($"⚠️ [DEBUG] CreateStepExecution: 檢查 nodeData 失敗: {ex.Message}");
                }
            }
            
            // 創建包含節點 ID 的完整輸入數據
            var inputData = new
            {
                Id = nodeId,  // 添加節點 ID
                NodeId = nodeId,  // 添加節點 ID 的別名
                Type = nodeData?.Type,
                TaskName = nodeData?.TaskName,
                Data = nodeData
            };
            
            // 處理 Validation 配置的欄位名稱轉換
            string validationConfigJson = null;
            if (nodeData?.Validation != null)
            {
                var validation = nodeData.Validation;
                
                // 處理 RetryMessageConfig 的 IsMetaTemplate 邏輯
                var retryMessageConfig = validation.RetryMessageConfig;
                if (retryMessageConfig != null && !string.IsNullOrEmpty(retryMessageConfig.TemplateId))
                {
                    // 判斷是否為 Meta 模板：如果 TemplateId 是純數字，則可能是 Meta 模板
                    retryMessageConfig.IsMetaTemplate = TemplateHelper.IsMetaTemplateId(retryMessageConfig.TemplateId);
                }
                
                // 處理 EscalationConfig 的 IsMetaTemplate 邏輯
                var escalationConfig = validation.EscalationConfig;
                if (escalationConfig != null && !string.IsNullOrEmpty(escalationConfig.TemplateId))
                {
                    // 判斷是否為 Meta 模板：如果 TemplateId 是純數字，則可能是 Meta 模板
                    escalationConfig.IsMetaTemplate = TemplateHelper.IsMetaTemplateId(escalationConfig.TemplateId);
                }
                
                var aiProviderKey = validation.AiProviderKey;

                // ✅ 簡化：如果 aiProviderKey 是 "openai" 或 "xai"，直接使用
                if (string.IsNullOrWhiteSpace(aiProviderKey) && !string.IsNullOrWhiteSpace(validation.ValidatorType))
                {
                    var normalized = validation.ValidatorType.ToLowerInvariant();
                    if (normalized == "openai" || normalized == "xai")
                    {
                        aiProviderKey = normalized;
                    }
                }

                if (string.IsNullOrWhiteSpace(nodeData.AiProviderKey) && !string.IsNullOrWhiteSpace(aiProviderKey))
                {
                    nodeData.AiProviderKey = aiProviderKey;
                }

                validation.AiProviderKey = aiProviderKey;

                // ✅ 簡化：完全依賴 aiIsActive 和 timeIsActive，validatorType 僅用於向後兼容
                var aiIsActive = validation.AiIsActive.HasValue 
                    ? validation.AiIsActive.Value 
                    : (validation.Enabled && !string.IsNullOrWhiteSpace(validation.ValidatorType) && 
                       string.Equals(validation.ValidatorType, "ai", StringComparison.OrdinalIgnoreCase));
                var timeIsActive = validation.TimeIsActive.HasValue
                    ? validation.TimeIsActive.Value
                    : (validation.Enabled && !string.IsNullOrWhiteSpace(validation.ValidatorType) && 
                       string.Equals(validation.ValidatorType, "time", StringComparison.OrdinalIgnoreCase));

                validation.AiIsActive = aiIsActive;
                validation.TimeIsActive = timeIsActive;
                validation.Enabled = aiIsActive || timeIsActive;

                // 創建標準化的 ValidationConfig 對象
                // ✅ 簡化：validatorType 僅用於向後兼容，主要依賴 aiIsActive 和 timeIsActive
                var standardValidationConfig = new ValidationConfig
                {
                    Enabled = validation.Enabled,
                    ValidatorType = validation.ValidatorType, // 保留用於向後兼容
                    AiIsActive = aiIsActive,
                    TimeIsActive = timeIsActive,
                    RetryIntervalDays = validation.RetryIntervalDays,
                    RetryIntervalHours = validation.RetryIntervalHours,
                    RetryIntervalMinutes = validation.RetryIntervalMinutes ?? 
                        (int.TryParse(validation.RetryInterval, out var retryInterval) ? retryInterval : 10), // 預設 10 分鐘
                    RetryLimit = validation.RetryLimitValue ?? 
                        (int.TryParse(validation.RetryLimitFromUI, out var retryLimit) ? retryLimit : 5), // 預設 5 次重試
                    RetryMessageConfig = retryMessageConfig,
                    EscalationConfig = escalationConfig,
                    Prompt = validation.Prompt,
                    RetryMessage = validation.RetryMessage,
                    MaxRetries = validation.MaxRetries ?? 3, // 預設 3 次重試（如果為 null）
                    AiProviderKey = aiProviderKey,
                    AiResultVariable = validation.AiResultVariable
                };
                
                validationConfigJson = JsonSerializer.Serialize(standardValidationConfig);
            }
            
            var stepExec = new WorkflowStepExecution
            {
                WorkflowExecutionId = execution.Id,
                StepIndex = execution.CurrentStep ?? 0,
                StepType = nodeData?.Type,
                TaskName = nodeData?.TaskName, // 保存用戶自定義的任務名稱
                Status = "Running",
                InputJson = JsonSerializer.Serialize(inputData),
                ValidationConfig = validationConfigJson, // 保存標準化的 Validation 配置
                StartedAt = DateTime.UtcNow
            };

            db.WorkflowStepExecutions.Add(stepExec);
            await db.SaveChangesAsync();

            return stepExec;
        }

        // 保存步驟執行記錄
        private async Task SaveStepExecution(WorkflowStepExecution stepExec)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            var existingStep = await db.WorkflowStepExecutions.FindAsync(stepExec.Id);
            if (existingStep != null)
            {
                existingStep.Status = stepExec.Status;
                existingStep.OutputJson = stepExec.OutputJson;
                existingStep.EndedAt = stepExec.EndedAt;
                existingStep.IsWaiting = stepExec.IsWaiting;
                await db.SaveChangesAsync();
            }
        }

        // 保存執行記錄
        private async Task SaveExecution(WorkflowExecution execution)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            var existingExecution = await db.WorkflowExecutions.FindAsync(execution.Id);
            if (existingExecution != null)
            {
                existingExecution.Status = execution.Status;
                existingExecution.ErrorMessage = execution.ErrorMessage;
                existingExecution.EndedAt = execution.EndedAt;
                existingExecution.IsWaiting = execution.IsWaiting;
                existingExecution.WaitingSince = execution.WaitingSince;
                existingExecution.WaitingForUser = execution.WaitingForUser;
                existingExecution.LastUserActivity = execution.LastUserActivity;
                existingExecution.CurrentStep = execution.CurrentStep;
                await db.SaveChangesAsync();
            }
        }

        // 標記 sendEForm 步驟完成
        private async Task MarkSendEFormStepComplete(int executionId, string nodeId = null)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            IQueryable<WorkflowStepExecution> query = db.WorkflowStepExecutions
                .Where(s => s.WorkflowExecutionId == executionId && s.StepType == "sendEForm" && s.Status == "Waiting");
            
            // ✅ 修復：如果提供了 nodeId，只標記對應的節點
            if (!string.IsNullOrEmpty(nodeId))
            {
                WriteLog($"只標記節點 {nodeId} 的 sendEForm 步驟為完成");
                // 通過 InputJson 查找對應的步驟執行記錄
                var stepExecution = await db.WorkflowStepExecutions
                    .Where(s => s.WorkflowExecutionId == executionId && 
                               s.StepType == "sendEForm" && 
                               s.Status == "Waiting" &&
                               (s.InputJson.Contains($"\"Id\":\"{nodeId}\"") || 
                                s.InputJson.Contains($"\"NodeId\":\"{nodeId}\"")))
                    .FirstOrDefaultAsync();
                
                if (stepExecution != null)
                {
                    stepExecution.Status = "Completed";
                    stepExecution.EndedAt = DateTime.UtcNow;
                    await db.SaveChangesAsync();
                    WriteLog($"已標記 sendEForm 步驟 {stepExecution.Id} (節點 {nodeId}) 為完成");
                    return;
                }
                else
                {
                    WriteLog($"警告: 找不到節點 {nodeId} 對應的等待中的 sendEForm 步驟執行記錄");
                }
            }
            
            var sendEFormStepExecution = await query
                .Where(s => s.WorkflowExecutionId == executionId && s.StepType == "sendEForm")
                .OrderByDescending(s => s.StartedAt)
                .FirstOrDefaultAsync();
            
            if (sendEFormStepExecution != null)
            {
                sendEFormStepExecution.Status = "Completed";
                sendEFormStepExecution.IsWaiting = false;
                sendEFormStepExecution.EndedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
                WriteLog($"sendEForm 步驟已標記為完成");
            }
        }

        // 標記等待步驟完成（支持 waitReply 和 waitForQRCode）
        private async Task MarkWaitReplyStepComplete(int executionId)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            // ✅ 修復：查找所有等待類型的步驟（waitReply, waitForQRCode, waitForUserReply, sendEForm）
            var waitStepExecution = await db.WorkflowStepExecutions
                .Where(s => s.WorkflowExecutionId == executionId && 
                           s.IsWaiting == true &&
                           (s.StepType == "waitReply" || 
                            s.StepType == "waitForQRCode" || 
                            s.StepType == "waitforqrcode" || 
                            s.StepType == "waitForUserReply" ||
                            s.StepType == "sendEForm"))
                .OrderByDescending(s => s.StartedAt)
                .FirstOrDefaultAsync();
            
            if (waitStepExecution != null)
            {
                waitStepExecution.IsWaiting = false;
                waitStepExecution.Status = "Completed";
                waitStepExecution.EndedAt = DateTime.UtcNow;
                waitStepExecution.OutputJson = JsonSerializer.Serialize(new { 
                    message = "User replied, continuing workflow",
                    stepType = waitStepExecution.StepType,
                    timestamp = DateTime.UtcNow,
                    userResponse = "User provided response"
                });
                await db.SaveChangesAsync();
                WriteLog($"✅ 等待節點狀態已更新為 Completed，步驟ID: {waitStepExecution.Id}, 類型: {waitStepExecution.StepType}");
                                 }
                                 else
                                 {
                WriteLog($"警告: 找不到等待步驟執行記錄（executionId: {executionId}）");
            }
        }

        // 執行 sendWhatsApp 節點（合併直接訊息和模板功能）
        private async Task<bool> ExecuteSendWhatsApp(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
            WriteLog($"=== 執行 sendWhatsApp 節點 ===");
            WriteLog($"收件人: {nodeData.To}");
            WriteLog($"訊息模式: {nodeData.MessageMode ?? "direct"}");
            WriteLog($"收件人詳情: {nodeData.RecipientDetails}");
            WriteLog($"🔍 [DEBUG] RecipientDetails 是否為 null: {nodeData.RecipientDetails == null}");
            WriteLog($"🔍 [DEBUG] RecipientDetails 類型: {nodeData.RecipientDetails?.GetType().Name ?? "null"}");
            
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            try
            {
                WriteLog($"🔍 [DEBUG] 開始解析收件人");
                // 使用 RecipientResolverService 解析收件人
                var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                    nodeData.To, 
                    nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, 
                    execution.Id,
                    execution.WorkflowDefinition.CompanyId
                );
                
                WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                
                // 檢查訊息模式：'direct' 直接訊息、'template' 使用模板、'email' 發送郵件
                string messageMode = nodeData.MessageMode ?? "direct"; // 默認為直接訊息模式
                
                if (messageMode == "email")
                {
                    // === Email 模式 ===
                    WriteLog($"📧 使用 Email 模式");
                    
                    var emailConfig = nodeData.EmailConfig;
                    var (successCount, skipCount, failCount, messageSendId) = await SendEmailNotificationsAsync(
                        emailConfig,
                        resolvedRecipients,
                        execution,
                        stepExec,
                        "sendWhatsApp",
                        db
                    );
                    
                    if (messageSendId == Guid.Empty)
                    {
                        // 配置錯誤，返回失敗
                        stepExec.OutputJson = JsonSerializer.Serialize(new { 
                            error = "Email configuration error",
                            success = false
                        });
                        return false;
                    }
                    
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        success = failCount == 0 && skipCount == 0, 
                        message = $"Email sending completed. Success: {successCount}, Skipped: {skipCount}, Failed: {failCount}",
                        recipientCount = resolvedRecipients.Count,
                        successCount = successCount,
                        skipCount = skipCount,
                        failCount = failCount,
                        taskName = nodeData.TaskName,
                        messageSendId = messageSendId
                    });
                    
                    return failCount == 0;
                }
                else if (messageMode == "template")
                {
                    // === 模板模式 ===
                    WriteLog($"📝 使用模板模式");
                    WriteLog($"模板ID: {nodeData.TemplateId}");
                    WriteLog($"模板名稱: {nodeData.TemplateName}");
                    
                    if (string.IsNullOrEmpty(nodeData.TemplateName))
                    {
                        WriteLog($"sendWhatsApp (模板模式) 缺少必要參數: templateName");
                        stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Missing required parameter: templateName" });
                        return false;
                    }
                    
                    WriteLog($"🔍 [DEBUG] 開始處理模板變數替換");
                    // 優先使用新的模板變數配置，如果沒有則使用舊的 variables
                    Dictionary<string, string> processedVariables;
                    
                    if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                    {
                        WriteLog($"🔍 [DEBUG] 使用新的模板變數配置");
                        processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                    }
                    else
                    {
                        WriteLog($"🔍 [DEBUG] 使用舊的模板變數配置");
                        processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                    }
                    
                    // 從 nodeData 讀取 templateHeaderUrl 等字段（優先從 stepExec.InputJson 讀取）
                    var (templateHeaderUrl, templateHeaderType, templateHeaderFilename) = GetTemplateHeaderInfo(nodeData, stepExec, execution);
                    
                    // 發送模板消息給所有解析到的收件人
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                        nodeData.To, // 使用原始收件人值
                        nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, // 使用原始收件人詳細信息
                        nodeData.TemplateId,
                        nodeData.TemplateName,
                        processedVariables,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(), // nodeId
                        "sendWhatsApp", // 統一使用 sendWhatsApp
                        db,
                        nodeData.IsMetaTemplate,  // 傳遞 Meta 模板標記
                        nodeData.TemplateLanguage,  // 傳遞模板語言代碼
                        templateHeaderUrl,  // 傳遞 header URL
                        templateHeaderType,  // 傳遞 header 類型
                        templateHeaderFilename  // 傳遞 header filename
                    );
                    
                    WriteLog($"🔍 [DEBUG] 模板消息發送記錄創建完成，ID: {messageSendId}");
                    WriteLog($"🔍 [DEBUG] 模板消息發送完成，收件人數量: {resolvedRecipients.Count}");
                    
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        success = true, 
                        message = "WhatsApp template messages sent successfully",
                        recipientCount = resolvedRecipients.Count,
                        templateName = nodeData.TemplateName,
                        taskName = nodeData.TaskName,
                        messageSendId = messageSendId
                    });
                    
                    return true;
                }
                else
                {
                    // === 直接訊息模式 ===
                    WriteLog($"💬 使用直接訊息模式");
                    WriteLog($"消息內容: {nodeData.Message}");
                    
                    if (string.IsNullOrEmpty(nodeData.Message))
                    {
                        WriteLog($"sendWhatsApp (直接訊息模式) 缺少必要參數: message");
                        stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Missing required parameter: message" });
                        return false;
                    }
                    
                    WriteLog($"🔍 [DEBUG] 開始處理變數替換");
                    // 替換訊息內容中的變數
                    var processedMessage = await _variableReplacementService.ReplaceVariablesAsync(nodeData.Message, execution.Id);
                    WriteLog($"🔍 [DEBUG] 原始訊息: {nodeData.Message}");
                    WriteLog($"🔍 [DEBUG] 處理後訊息: {processedMessage}");
                    
                    // 發送消息給所有解析到的收件人
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                        nodeData.To, // 使用原始收件人值
                        nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, // 使用原始收件人詳細信息
                        processedMessage,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(), // nodeId
                        "sendWhatsApp",
                        db
                    );
                    
                    WriteLog($"🔍 [DEBUG] 消息發送記錄創建完成，ID: {messageSendId}");
                    WriteLog($"🔍 [DEBUG] 消息發送完成，收件人數量: {resolvedRecipients.Count}");
                    
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        success = true, 
                        message = "WhatsApp messages sent successfully",
                        recipientCount = resolvedRecipients.Count,
                        taskName = nodeData.TaskName,
                        messageSendId = messageSendId
                    });
                    
                    return true;
                }
            }
            catch (Exception ex)
            {
                WriteLog($"發送 WhatsApp 消息失敗: {ex.Message}");
                stepExec.OutputJson = JsonSerializer.Serialize(new { 
                    error = "Failed to send WhatsApp message",
                    message = ex.Message
                });
                return false;
            }
        }

        // 執行 sendWhatsAppTemplate 節點
        private async Task<bool> ExecuteSendWhatsAppTemplate(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
            WriteLog($"=== 執行 sendWhatsAppTemplate 節點 ===");
            WriteLog($"收件人: {nodeData.To}");
            WriteLog($"模板ID: {nodeData.TemplateId}");
            WriteLog($"模板名稱: {nodeData.TemplateName}");
            WriteLog($"收件人詳情: {nodeData.RecipientDetails}");
            
            if (!string.IsNullOrEmpty(nodeData.TemplateName))
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                
                try
                {
                    WriteLog($"🔍 [DEBUG] 開始處理模板變數替換");
                    // 使用共用方法處理模板變數
                    Dictionary<string, string> processedVariables;
                    if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                    {
                        WriteLog($"🔍 [DEBUG] 使用新的模板變數配置");
                        processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                    }
                    else
                    {
                        WriteLog($"🔍 [DEBUG] 使用舊的模板變數配置");
                        processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                    }
                    
                    WriteLog($"🔍 [DEBUG] 開始解析收件人");
                    // 使用 RecipientResolverService 解析收件人
                    var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                        nodeData.To, 
                        nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, 
                        execution.Id,
                        execution.WorkflowDefinition.CompanyId
                    );
                    
                    WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                    
                    // 從 nodeData 讀取 templateHeaderUrl 等字段（優先從 stepExec.InputJson 讀取）
                    var (templateHeaderUrl, templateHeaderType, templateHeaderFilename) = GetTemplateHeaderInfo(nodeData, stepExec);
                    
                    // 發送模板消息給所有解析到的收件人
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                        nodeData.To, // 使用原始收件人值
                        nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, // 使用原始收件人詳細信息
                        nodeData.TemplateId,
                        nodeData.TemplateName,
                        processedVariables,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(), // nodeId
                        "sendWhatsAppTemplate",
                        db,
                        nodeData.IsMetaTemplate,  // 傳遞 Meta 模板標記
                        nodeData.TemplateLanguage,  // 傳遞模板語言代碼
                        templateHeaderUrl,  // 傳遞 header URL
                        templateHeaderType,  // 傳遞 header 類型
                        templateHeaderFilename  // 傳遞 header filename
                    );
                    
                    WriteLog($"🔍 [DEBUG] 模板消息發送記錄創建完成，ID: {messageSendId}");
                    
                    WriteLog($"🔍 [DEBUG] 模板消息發送完成，收件人數量: {resolvedRecipients.Count}");
                    
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        success = true, 
                        message = "WhatsApp template messages sent successfully",
                        recipientCount = resolvedRecipients.Count,
                        templateName = nodeData.TemplateName,
                        messageSendId = messageSendId
                    });
                    
                    return true;
                }
                catch (Exception ex)
                {
                    WriteLog($"發送 WhatsApp 模板消息失敗: {ex.Message}");
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        error = "Failed to send WhatsApp template message",
                        message = ex.Message
                    });
                    return false;
                }
            }
            else
            {
                WriteLog($"sendWhatsAppTemplate 步驟缺少必要參數: templateName={nodeData.TemplateName}, recipientDetails={nodeData.RecipientDetails}");
                stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Missing required parameters" });
                return false;
            }
        }

        // 執行 waitReply 節點
        private async Task<bool> ExecuteWaitReply(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution, string userId)
        {
            WriteLog($"=== 執行 waitReply 節點 ===");
            
            // ✅ 修復：先解析收件人，然後設置正確的 WaitingForUser
            // 不要使用 userId 作為默認值，因為 userId 可能是上一個等待節點的用戶
            string actualWaitingUser = null; // 初始化為 null，必須從收件人解析中獲取
            
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            var company = await db.Companies.FindAsync(execution.WorkflowDefinition.CompanyId);
            if (company != null)
            {
                WriteLog($"🔍 [DEBUG] 開始解析 waitReply 收件人");
                WriteLog($"🔍 [DEBUG] nodeData.SpecifiedUsers: '{nodeData.SpecifiedUsers}'");
                WriteLog($"🔍 [DEBUG] nodeData.ReplyType: '{nodeData.ReplyType}'");
                WriteLog($"🔍 [DEBUG] nodeData.RecipientDetails: {(nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : "null")}");
                
                // 根據 replyType 決定收件人
                string recipientValue;
                string recipientDetailsJson;
                
                // ✅ 修復：只根據 replyType 判斷，不檢查 specifiedUsers 是否為空
                if (nodeData.ReplyType == "initiator")
                {
                    // 使用流程啟動人
                    recipientValue = "${initiator}";
                    recipientDetailsJson = JsonSerializer.Serialize(new 
                    { 
                        users = new List<object>(),
                        contacts = new List<object>(),
                        groups = new List<object>(),
                        hashtags = new List<object>(),
                        processVariables = new List<string>(),
                        useInitiator = true,
                        phoneNumbers = new List<string>()
                    });
                    WriteLog($"🔍 [DEBUG] 使用流程啟動人作為收件人");
                    actualWaitingUser = userId ?? "85296366318"; // 使用流程啟動人
                }
                else
                {
                    // ✅ 使用 recipientDetails（即使 specifiedUsers 為空）
                    recipientValue = nodeData.SpecifiedUsers ?? "";
                    recipientDetailsJson = nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null;
                    WriteLog($"🔍 [DEBUG] 使用 recipientDetails 配置（replyType={nodeData.ReplyType}）");
                    WriteLog($"🔍 [DEBUG] recipientDetailsJson: {recipientDetailsJson}");
                }
                
                // 使用 RecipientResolverService 解析收件人
                var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                    recipientValue,
                    recipientDetailsJson, 
                    execution.Id,
                    execution.WorkflowDefinition.CompanyId
                );
                
                WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                
                // ✅ 修復：如果解析到收件人，使用第一個收件人作為 WaitingForUser
                if (resolvedRecipients.Count > 0)
                {
                    actualWaitingUser = resolvedRecipients.First().PhoneNumber;
                    WriteLog($"🔍 [DEBUG] 設置 WaitingForUser 為解析到的收件人: {actualWaitingUser}");
                }
                else
                {
                    WriteLog($"⚠️ [WARNING] 沒有解析到收件人，使用默認值: {actualWaitingUser}");
                }
            }
            
            // ✅ 修復：確保 actualWaitingUser 不為 null
            if (string.IsNullOrEmpty(actualWaitingUser))
            {
                WriteLog($"❌ [ERROR] actualWaitingUser 為空，無法設置等待狀態");
                throw new InvalidOperationException("waitReply 節點無法確定等待的用戶");
            }
            
            // 設置等待狀態
            execution.Status = "Waiting";
            execution.IsWaiting = true;
            execution.WaitingSince = DateTime.UtcNow;
            execution.WaitingForUser = actualWaitingUser; // ✅ 使用解析到的收件人
            execution.LastUserActivity = DateTime.UtcNow;
            execution.CurrentStep = stepExec.StepIndex;
                        
            stepExec.Status = "Waiting";
            stepExec.IsWaiting = true;
            stepExec.OutputJson = JsonSerializer.Serialize(new { 
                message = "Waiting for user reply",
                waitingSince = DateTime.UtcNow,
                waitingForUser = execution.WaitingForUser
            });
            
            // 保存狀態
            await SaveExecution(execution);
            await SaveStepExecution(stepExec);
            
            // 發送提示消息（支持直接訊息和模板）
            string messageMode = nodeData.MessageMode ?? "direct";
            bool shouldSendMessage = (messageMode == "direct" && !string.IsNullOrEmpty(nodeData.Message)) ||
                                    (messageMode == "template" && !string.IsNullOrEmpty(nodeData.TemplateName));
            
            if (shouldSendMessage && company != null)
            {
                WriteLog($"🔍 [DEBUG] messageMode: {messageMode}");
                
                // 獲取收件人信息（已經在前面解析過了）
                string recipientValue;
                string recipientDetailsJson;
                
                if (nodeData.ReplyType == "initiator")
                {
                    recipientValue = "${initiator}";
                    recipientDetailsJson = JsonSerializer.Serialize(new 
                    { 
                        users = new List<object>(),
                        contacts = new List<object>(),
                        groups = new List<object>(),
                        hashtags = new List<object>(),
                        processVariables = new List<string>(),
                        useInitiator = true,
                        phoneNumbers = new List<string>()
                    });
                }
                else
                {
                    recipientValue = nodeData.SpecifiedUsers ?? "";
                    recipientDetailsJson = nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null;
                }
                
                // 根據訊息模式發送
                if (messageMode == "email")
                {
                    // === Email 模式 ===
                    WriteLog($"📧 waitReply 使用 Email 模式");
                    
                    var emailConfig = nodeData.EmailConfig;
                    if (emailConfig == null || string.IsNullOrEmpty(emailConfig.ProviderKey))
                    {
                        WriteLog($"waitReply (Email 模式) 缺少必要參數: emailConfig.providerKey");
                        // 不阻止流程繼續，只是不發送 email
                    }
                    else if (!string.IsNullOrEmpty(emailConfig.Subject) && !string.IsNullOrEmpty(emailConfig.Body))
                    {
                        // 解析收件人
                        var emailRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                            recipientValue,
                            recipientDetailsJson,
                            execution.Id,
                            execution.WorkflowDefinition.CompanyId
                        );
                        
                        // 使用統一方法發送 email（不創建 WorkflowMessageSend 記錄，不阻止流程）
                        var (successCount, skipCount, failCount, _) = await SendEmailNotificationsAsync(
                            emailConfig,
                            emailRecipients,
                            execution,
                            stepExec,
                            "waitReply",
                            db,
                            null,
                            false // 不創建記錄
                        );
                        
                        WriteLog($"📧 waitReply Email 發送完成，成功: {successCount}, 跳過: {skipCount}, 失敗: {failCount}, 總計: {emailRecipients.Count}");
                    }
                }
                else if (messageMode == "template")
                {
                    WriteLog($"📝 waitReply 使用模板模式");
                    
                    // 使用共用方法處理模板變數
                    Dictionary<string, string> processedVariables;
                    if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                    {
                        WriteLog($"🔍 [DEBUG] waitReply 使用新的模板變數配置");
                        processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                    }
                    else
                    {
                        WriteLog($"🔍 [DEBUG] waitReply 使用舊的模板變數配置");
                        processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                    }
                    
                    // 從 nodeData 讀取 templateHeaderUrl 等字段（優先從 stepExec.InputJson 讀取）
                    var (templateHeaderUrl, templateHeaderType, templateHeaderFilename) = GetTemplateHeaderInfo(nodeData, stepExec);
                    
                    // 發送模板訊息
                    WriteLog($"🔍 [DEBUG] waitReply 模板配置: TemplateName={nodeData.TemplateName}, IsMetaTemplate={nodeData.IsMetaTemplate}, TemplateLanguage={nodeData.TemplateLanguage ?? "null"}");
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                        recipientValue,
                        recipientDetailsJson,
                        nodeData.TemplateId,
                        nodeData.TemplateName,
                        processedVariables,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(),
                        "waitReply",
                        db,
                        nodeData.IsMetaTemplate,  // 傳遞 Meta 模板標記
                        nodeData.TemplateLanguage,  // 傳遞模板語言代碼
                        templateHeaderUrl,  // 傳遞 header URL
                        templateHeaderType,  // 傳遞 header 類型
                        templateHeaderFilename  // 傳遞 header filename
                    );
                    
                    WriteLog($"🔍 [DEBUG] 等待提示模板訊息發送完成，ID: {messageSendId}");
                }
                else
                {
                    WriteLog($"💬 waitReply 使用直接訊息模式");
                    
                    // 發送直接訊息
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                        recipientValue,
                        recipientDetailsJson,
                        nodeData.Message,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(), // nodeId
                        "waitReply",
                        db
                    );
                    
                    WriteLog($"🔍 [DEBUG] 等待提示訊息發送記錄創建完成，ID: {messageSendId}");
                }
            }
            
            WriteLog($"等待節點設置完成，流程暫停等待用戶回覆");
            return false; // 返回 false 表示暫停執行
        }

        // 執行 waitForQRCode 節點
        private async Task<bool> ExecuteWaitForQRCode(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution, string userId)
        {
            WriteLog($"=== 執行 waitForQRCode 節點 ===");
            WriteLog($"QR Code 變量: {nodeData.QrCodeVariable}");
            WriteLog($"提示訊息: {nodeData.Message}");
            WriteLog($"成功訊息: {nodeData.QrCodeSuccessMessage}");
            WriteLog($"錯誤訊息: {nodeData.QrCodeErrorMessage}");
            WriteLog($"超時時間: {nodeData.Timeout} 秒");
            
            // ✅ 修復：先解析收件人，然後設置正確的 WaitingForUser
            // 不要使用 userId 作為默認值，因為 userId 可能是上一個等待節點的用戶
            string actualWaitingUser = null; // 初始化為 null，必須從收件人解析中獲取
            
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            var company = await db.Companies.FindAsync(execution.WorkflowDefinition.CompanyId);
            if (company != null)
            {
                WriteLog($"🔍 [DEBUG] 開始解析 waitForQRCode 收件人");
                WriteLog($"🔍 [DEBUG] nodeData.ReplyType: '{nodeData.ReplyType}'");
                WriteLog($"🔍 [DEBUG] nodeData.RecipientDetails: {(nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : "null")}");
                
                // 根據 replyType 決定收件人
                string recipientValue;
                string recipientDetailsJson;
                
                // ✅ 修復：只根據 replyType 判斷
                if (nodeData.ReplyType == "initiator")
                {
                    // 使用流程啟動人
                    recipientValue = "${initiator}";
                    recipientDetailsJson = JsonSerializer.Serialize(new 
                    { 
                        users = new List<object>(),
                        contacts = new List<object>(),
                        groups = new List<object>(),
                        hashtags = new List<object>(),
                        processVariables = new List<string>(),
                        useInitiator = true,
                        phoneNumbers = new List<string>()
                    });
                    WriteLog($"🔍 [DEBUG] 使用流程啟動人作為收件人");
                    // 對於 initiator，使用 execution.InitiatedBy
                    actualWaitingUser = execution.InitiatedBy;
                }
                else
                {
                    // ✅ 使用 recipientDetails
                    recipientValue = nodeData.SpecifiedUsers ?? "";
                    recipientDetailsJson = nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null;
                    WriteLog($"🔍 [DEBUG] 使用 recipientDetails 配置（replyType={nodeData.ReplyType}）");
                }
                
                // 使用 RecipientResolverService 解析收件人
                var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                    recipientValue,
                    recipientDetailsJson, 
                    execution.Id,
                    execution.WorkflowDefinition.CompanyId
                );
                
                WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                
                // ✅ 修復：如果解析到收件人，使用第一個收件人作為 WaitingForUser
                if (resolvedRecipients.Count > 0)
                {
                    actualWaitingUser = resolvedRecipients.First().PhoneNumber;
                    WriteLog($"🔍 [DEBUG] 設置 WaitingForUser 為解析到的收件人: {actualWaitingUser}");
                }
                else
                {
                    WriteLog($"❌ [ERROR] 沒有解析到收件人，無法設置 WaitingForUser");
                }
            }
            
            // ✅ 修復：確保 actualWaitingUser 不為 null
            if (string.IsNullOrEmpty(actualWaitingUser))
            {
                WriteLog($"❌ [ERROR] actualWaitingUser 為空，無法設置等待狀態");
                throw new InvalidOperationException("waitForQRCode 節點無法確定等待的用戶");
            }
            
            // 設置等待狀態
            execution.Status = "WaitingForQRCode";
            execution.IsWaiting = true;
            execution.WaitingSince = DateTime.UtcNow;
            execution.WaitingForUser = actualWaitingUser; // ✅ 使用解析到的收件人
            execution.LastUserActivity = DateTime.UtcNow;
            execution.CurrentStep = stepExec.StepIndex;
            
            stepExec.Status = "Waiting";
            stepExec.IsWaiting = true;
            stepExec.OutputJson = JsonSerializer.Serialize(new { 
                message = "Waiting for QR Code upload",
                qrCodeVariable = nodeData.QrCodeVariable,
                timeout = nodeData.Timeout,
                waitingSince = DateTime.UtcNow,
                waitingForUser = execution.WaitingForUser
            });
            
            // 保存狀態
            await SaveExecution(execution);
            await SaveStepExecution(stepExec);
            
            // 發送提示消息（支持直接訊息和模板）
            string messageMode = nodeData.MessageMode ?? "direct";
            bool shouldSendMessage = (messageMode == "direct" && !string.IsNullOrEmpty(nodeData.Message)) ||
                                    (messageMode == "template" && !string.IsNullOrEmpty(nodeData.TemplateName));
            
            if (shouldSendMessage && company != null)
            {
                WriteLog($"🔍 [DEBUG] messageMode: {messageMode}");
                
                // 獲取收件人信息（已經在前面解析過了）
                string recipientValue;
                string recipientDetailsJson;
                
                if (nodeData.ReplyType == "initiator")
                {
                    recipientValue = "${initiator}";
                    recipientDetailsJson = JsonSerializer.Serialize(new 
                    { 
                        users = new List<object>(),
                        contacts = new List<object>(),
                        groups = new List<object>(),
                        hashtags = new List<object>(),
                        processVariables = new List<string>(),
                        useInitiator = true,
                        phoneNumbers = new List<string>()
                    });
                }
                else
                {
                    recipientValue = nodeData.SpecifiedUsers ?? "";
                    recipientDetailsJson = nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null;
                }
                
                // 根據訊息模式發送
                if (messageMode == "email")
                {
                    // === Email 模式 ===
                    WriteLog($"📧 waitForQRCode 使用 Email 模式");
                    
                    var emailConfig = nodeData.EmailConfig;
                    if (emailConfig != null && !string.IsNullOrEmpty(emailConfig.ProviderKey) && 
                        !string.IsNullOrEmpty(emailConfig.Subject) && !string.IsNullOrEmpty(emailConfig.Body))
                    {
                        // 解析收件人並發送 email
                        var emailRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                            recipientValue,
                            recipientDetailsJson,
                            execution.Id,
                            execution.WorkflowDefinition.CompanyId
                        );
                        
                        // 使用統一方法發送 email
                        var (successCount, skipCount, failCount, messageSendId) = await SendEmailNotificationsAsync(
                            emailConfig,
                            emailRecipients,
                            execution,
                            stepExec,
                            "waitForQRCode",
                            db
                        );
                        
                        if (messageSendId != Guid.Empty)
                        {
                            WriteLog($"📧 waitForQRCode Email 發送完成 - 成功: {successCount}, 跳過: {skipCount}, 失敗: {failCount}, 總計: {emailRecipients.Count}");
                        }
                    }
                }
                else if (messageMode == "template")
                {
                    WriteLog($"📝 waitForQRCode 使用模板模式");
                    
                    // 使用共用方法處理模板變數
                    Dictionary<string, string> processedVariables;
                    if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                    {
                        WriteLog($"🔍 [DEBUG] waitForQRCode 使用新的模板變數配置");
                        processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                    }
                    else
                    {
                        WriteLog($"🔍 [DEBUG] waitForQRCode 使用舊的模板變數配置");
                        processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                    }
                    
                    // 從 nodeData 讀取 templateHeaderUrl 等字段（優先從 stepExec.InputJson 讀取）
                    var (templateHeaderUrl, templateHeaderType, templateHeaderFilename) = GetTemplateHeaderInfo(nodeData, stepExec);
                    
                    // 發送模板訊息
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                        recipientValue,
                        recipientDetailsJson,
                        nodeData.TemplateId,
                        nodeData.TemplateName,
                        processedVariables,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(),
                        "waitForQRCode",
                        db,
                        nodeData.IsMetaTemplate,  // 傳遞 Meta 模板標記
                        nodeData.TemplateLanguage,  // 傳遞模板語言代碼
                        templateHeaderUrl,  // 傳遞 header URL
                        templateHeaderType,  // 傳遞 header 類型
                        templateHeaderFilename  // 傳遞 header filename
                    );
                    
                    WriteLog($"🔍 [DEBUG] QR Code 等待提示模板訊息發送完成，ID: {messageSendId}");
                }
                else
                {
                    WriteLog($"💬 waitForQRCode 使用直接訊息模式");
                    
                    // 發送 QR Code 等待提示訊息給所有解析到的收件人
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                        recipientValue,
                        recipientDetailsJson,
                        nodeData.Message,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(), // nodeId
                        "waitQRCode",
                        db
                    );
                    
                    WriteLog($"🔍 [DEBUG] QR Code 等待提示訊息發送記錄創建完成，ID: {messageSendId}");
                }
            }
            
            WriteLog($"QR Code 等待節點設置完成，流程暫停等待 QR Code 上傳");
            return false; // 返回 false 表示暫停執行
        }

        // 使用 DataSet Query 結果填充表單
        private async Task<string> FillFormWithDataSetQueryResults(string originalHtml, string queryResult)
        {
            try
            {
                WriteLog($"🔍 [DEBUG] 開始填充表單，查詢結果: {queryResult}");
                
                // 解析查詢結果 JSON - 修正：應該是數組格式
                var resultDataArray = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(queryResult);
                if (resultDataArray == null || resultDataArray.Count == 0)
                {
                    WriteLog($"⚠️ [WARNING] 無法解析 DataSet Query 結果或結果為空: {queryResult}");
                    return originalHtml;
                }

                // 使用第一條記錄來填充表單
                var resultData = resultDataArray.First();
                WriteLog($"🔍 [DEBUG] 使用第一條記錄填充表單，包含 {resultData.Count} 個欄位");
                
                string filledHtml = originalHtml;
                int fieldsProcessed = 0;
                
                // 動態映射策略：
                // 1. 首先嘗試精確匹配（欄位名稱完全相同）
                // 2. 然後嘗試忽略大小寫匹配
                // 3. 最後嘗試模糊匹配（包含關係）
                WriteLog($"🔍 [DEBUG] 開始動態欄位映射，DataSet 欄位數量: {resultData.Count}");
                
                // 從 HTML 中提取所有可用的表單欄位名稱
                var availableFormFields = ExtractFormFieldNames(originalHtml);
                WriteLog($"🔍 [DEBUG] 表單中可用的欄位: {string.Join(", ", availableFormFields)}");
                
                // 遍歷查詢結果，動態匹配表單欄位
                foreach (var kvp in resultData)
                {
                    var sourceFieldName = kvp.Key;
                    var fieldValue = kvp.Value?.ToString() ?? "";
                    
                    // 跳過系統內部欄位
                    if (sourceFieldName.StartsWith("__"))
                    {
                        WriteLog($"🔍 [DEBUG] 跳過系統欄位: {sourceFieldName}");
                        continue;
                    }
                    
                    // 動態查找對應的表單欄位名稱
                    var targetFieldName = FindMatchingFormField(sourceFieldName, availableFormFields);
                    
                    if (!string.IsNullOrEmpty(targetFieldName))
                    {
                        WriteLog($"🔍 [DEBUG] 動態映射成功: {sourceFieldName} -> {targetFieldName} = {fieldValue}");
                        
                        // 處理日期格式轉換
                        var processedValue = fieldValue;
                        if (IsDateField(targetFieldName) && !string.IsNullOrEmpty(fieldValue))
                        {
                            // 檢查 HTML 中是否有 datetime-local 類型的欄位
                            if (originalHtml.Contains($"type=\"datetime-local\"") && originalHtml.Contains($"name=\"{targetFieldName}\""))
                            {
                                processedValue = ConvertToFormDateTime(fieldValue);
                                WriteLog($"🔍 [DEBUG] 日期時間格式轉換: {fieldValue} -> {processedValue}");
                            }
                            else
                            {
                                processedValue = ConvertToFormDate(fieldValue);
                                WriteLog($"🔍 [DEBUG] 日期格式轉換: {fieldValue} -> {processedValue}");
                            }
                        }
                        
                        // 處理不同類型的輸入欄位
                        filledHtml = FillFormField(filledHtml, targetFieldName, processedValue);
                        fieldsProcessed++;
                    }
                    else
                    {
                        WriteLog($"🔍 [DEBUG] 跳過無法映射的欄位: {sourceFieldName} = {fieldValue}");
                    }
                }

                WriteLog($"🔍 [DEBUG] DataSet Query 結果填充完成，處理了 {fieldsProcessed} 個欄位");
                WriteLog($"🔍 [DEBUG] 填充前 HTML 長度: {originalHtml?.Length ?? 0}");
                WriteLog($"🔍 [DEBUG] 填充後 HTML 長度: {filledHtml?.Length ?? 0}");
                WriteLog($"🔍 [DEBUG] HTML 是否發生變化: {filledHtml != originalHtml}");
                
                return filledHtml;
            }
            catch (Exception ex)
            {
                WriteLog($"❌ [ERROR] 填充表單時發生錯誤: {ex.Message}");
                WriteLog($"❌ [ERROR] 錯誤堆疊: {ex.StackTrace}");
                return originalHtml;
            }
        }

        // 從 HTML 中提取所有表單欄位名稱
        private List<string> ExtractFormFieldNames(string html)
        {
            var fieldNames = new List<string>();
            
            try
            {
                // 使用正則表達式提取所有 name 屬性
                var pattern = @"name\s*=\s*[""']([^""']+)[""']";
                var matches = System.Text.RegularExpressions.Regex.Matches(html, pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                
                foreach (System.Text.RegularExpressions.Match match in matches)
                {
                    if (match.Groups.Count > 1)
                    {
                        var fieldName = match.Groups[1].Value.Trim();
                        if (!string.IsNullOrEmpty(fieldName) && !fieldNames.Contains(fieldName))
                        {
                            fieldNames.Add(fieldName);
                        }
                    }
                }
                
                WriteLog($"🔍 [DEBUG] 從 HTML 中提取到 {fieldNames.Count} 個欄位名稱");
            }
            catch (Exception ex)
            {
                WriteLog($"⚠️ [WARNING] 提取表單欄位名稱時發生錯誤: {ex.Message}");
            }
            
            return fieldNames;
        }
        
        // 簡化的欄位匹配 - 直接精確匹配
        private string FindMatchingFormField(string sourceFieldName, List<string> availableFormFields)
        {
            if (string.IsNullOrEmpty(sourceFieldName) || availableFormFields == null || availableFormFields.Count == 0)
                return null;
                
            // 直接精確匹配（忽略大小寫）
            var exactMatch = availableFormFields.FirstOrDefault(f => 
                string.Equals(f, sourceFieldName, StringComparison.OrdinalIgnoreCase));
                
            if (exactMatch != null)
            {
                WriteLog($"🔍 [DEBUG] 精確匹配成功: {sourceFieldName} -> {exactMatch}");
                return exactMatch;
            }
            
            WriteLog($"🔍 [DEBUG] 無法找到匹配欄位: {sourceFieldName}");
            WriteLog($"🔍 [DEBUG] 可用欄位列表: {string.Join(", ", availableFormFields)}");
            return null;
        }
        
        // 計算字符串相似度（簡單的 Jaccard 相似度）
        private double CalculateSimilarity(string str1, string str2)
        {
            if (string.IsNullOrEmpty(str1) || string.IsNullOrEmpty(str2))
                return 0;
                
            var set1 = new HashSet<char>(str1);
            var set2 = new HashSet<char>(str2);
            
            var intersection = set1.Intersect(set2).Count();
            var union = set1.Union(set2).Count();
            
            return union > 0 ? (double)intersection / union : 0;
        }
        
        // 檢查是否為日期欄位
        private bool IsDateField(string fieldName)
        {
            var dateFields = new[] { "orderDate", "orderdate", "invoiceDate", "invoicedate", "invdate", "createDate", "create_date", "checkDate", "check_date" };
            return dateFields.Contains(fieldName, StringComparer.OrdinalIgnoreCase);
        }
        
        // 轉換日期格式
        private string ConvertToFormDate(string dateValue)
        {
            try
            {
                if (DateTime.TryParse(dateValue, out DateTime date))
                {
                    // 轉換為 YYYY-MM-DD 格式（適用於 HTML date 輸入）
                    return date.ToString("yyyy-MM-dd");
                }
            }
            catch (Exception ex)
            {
                WriteLog($"⚠️ [WARNING] 日期格式轉換失敗: {dateValue}, 錯誤: {ex.Message}");
            }
            return dateValue; // 如果轉換失敗，返回原始值
        }
        
        // 轉換日期時間格式
        private string ConvertToFormDateTime(string dateValue)
        {
            try
            {
                if (DateTime.TryParse(dateValue, out DateTime date))
                {
                    // 轉換為 YYYY-MM-DDTHH:mm 格式（適用於 HTML datetime-local 輸入）
                    return date.ToString("yyyy-MM-ddTHH:mm");
                }
            }
            catch (Exception ex)
            {
                WriteLog($"⚠️ [WARNING] 日期時間格式轉換失敗: {dateValue}, 錯誤: {ex.Message}");
            }
            return dateValue; // 如果轉換失敗，返回原始值
        }
        
        // 完整的表單欄位填充方法 - 支持所有基本表單元素
        private string FillFormField(string html, string fieldName, string fieldValue)
        {
            try
            {
                // 轉義特殊字符
                var escapedValue = System.Security.SecurityElement.Escape(fieldValue);
                
                WriteLog($"🔍 [DEBUG] 嘗試填充欄位: {fieldName} = {fieldValue}");
                WriteLog($"🔍 [DEBUG] 轉義後的值: {escapedValue}");
                
                // 檢查 HTML 中是否存在該欄位
                var namePattern = $@"name\s*=\s*[""']?{fieldName}[""']?";
                var nameRegex = new System.Text.RegularExpressions.Regex(namePattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                
                if (!nameRegex.IsMatch(html))
                {
                    WriteLog($"⚠️ [WARNING] HTML 中沒有找到 name=\"{fieldName}\" 的欄位");
                    return html;
                }
                
                WriteLog($"🔍 [DEBUG] 確認 HTML 中存在 name=\"{fieldName}\" 的欄位");
                
                // 定義多種表單元素的處理模式
                var patterns = new (string Element, string Pattern, string Replacement)[]
                {
                    // 1. Input 元素 (text, email, password, number, tel, url, search, hidden 等)
                    ("input", 
                     $@"(<input[^>]*name=""{fieldName}""[^>]*?)(?=\s*>)", 
                     $@"$1 value=""{escapedValue}"""),
                    
                    // 2. Textarea 元素
                    ("textarea", 
                     $@"(<textarea[^>]*name=""{fieldName}""[^>]*?>)(.*?)(</textarea>)", 
                     $@"$1{escapedValue}$3"),
                    
                    // 3. Radio 元素 - 設置選中狀態
                    ("radio", 
                     $@"(<input[^>]*name=""{fieldName}""[^>]*value=""{escapedValue}""[^>]*?)(?=\s*>)", 
                     $@"$1 checked"),
                    
                    // 4. Checkbox 元素 - 設置選中狀態
                    ("checkbox", 
                     $@"(<input[^>]*name=""{fieldName}""[^>]*value=""{escapedValue}""[^>]*?)(?=\s*>)", 
                     $@"$1 checked")
                };
                
                bool fieldProcessed = false;
                
                // 首先嘗試處理 Select 元素（需要特殊邏輯）
                var selectPattern = $@"(<select[^>]*name=""{fieldName}""[^>]*?>)(.*?)(</select>)";
                var selectRegex = new System.Text.RegularExpressions.Regex(selectPattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                
                if (selectRegex.IsMatch(html))
                {
                    WriteLog($"🔍 [DEBUG] 找到 select 元素，欄位: {fieldName}");
                    var beforeReplace = html;
                    html = selectRegex.Replace(html, match =>
                    {
                        var selectContent = match.Groups[2].Value;
                        WriteLog($"🔍 [DEBUG] Select 內容: {selectContent.Substring(0, Math.Min(200, selectContent.Length))}...");
                        // 在 select 內部找到對應的 option 並設置 selected
                        var updatedContent = System.Text.RegularExpressions.Regex.Replace(selectContent, 
                            $@"(<option[^>]*value=""{escapedValue}""[^>]*?)(?=\s*>)", 
                            "$1 selected", 
                            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                        return match.Value.Replace(selectContent, updatedContent);
                    });
                    
                    var afterReplace = html;
                    WriteLog($"🔍 [DEBUG] 成功填充 select 欄位: {fieldName}");
                    WriteLog($"🔍 [DEBUG] 替換前長度: {beforeReplace.Length}, 替換後長度: {afterReplace.Length}");
                    fieldProcessed = true;
                }
                
                // 嘗試其他元素類型
                if (!fieldProcessed)
                {
                    foreach (var (element, pattern, replacement) in patterns)
                    {
                        WriteLog($"🔍 [DEBUG] 嘗試 {element} 模式，正則: {pattern}");
                        var regex = new System.Text.RegularExpressions.Regex(pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                        
                        if (regex.IsMatch(html))
                        {
                            WriteLog($"🔍 [DEBUG] 匹配到 {element} 模式");
                            var beforeReplace = html;
                            html = regex.Replace(html, replacement);
                            var afterReplace = html;
                            
                            WriteLog($"🔍 [DEBUG] 成功填充 {element} 欄位: {fieldName}");
                            WriteLog($"🔍 [DEBUG] 替換前長度: {beforeReplace.Length}, 替換後長度: {afterReplace.Length}");
                            WriteLog($"🔍 [DEBUG] HTML 是否發生變化: {beforeReplace != afterReplace}");
                            
                            // 輸出替換前後的片段進行對比
                            var beforeFragment = GetFieldFragment(beforeReplace, fieldName);
                            var afterFragment = GetFieldFragment(afterReplace, fieldName);
                            WriteLog($"🔍 [DEBUG] 替換前片段: {beforeFragment}");
                            WriteLog($"🔍 [DEBUG] 替換後片段: {afterFragment}");
                            
                            fieldProcessed = true;
                            break; // 找到匹配的元素類型後停止
                        }
                        else
                        {
                            WriteLog($"🔍 [DEBUG] 欄位 {fieldName} 不匹配 {element} 模式");
                        }
                    }
                }
                
                if (!fieldProcessed)
                {
                    WriteLog($"⚠️ [WARNING] 欄位 {fieldName} 沒有找到任何匹配的表單元素");
                    // 輸出該欄位周圍的 HTML 片段進行調試
                    var fieldFragment = GetFieldFragment(html, fieldName);
                    WriteLog($"🔍 [DEBUG] 欄位周圍的 HTML 片段: {fieldFragment}");
                }
                
                return html;
            }
            catch (Exception ex)
            {
                WriteLog($"❌ [ERROR] 填充欄位 {fieldName} 時發生錯誤: {ex.Message}");
                WriteLog($"❌ [ERROR] 錯誤堆疊: {ex.StackTrace}");
                return html;
            }
        }
        
        // 輔助方法：獲取欄位周圍的 HTML 片段
        private string GetFieldFragment(string html, string fieldName)
        {
            try
            {
                var pattern = $@".{{0,100}}name\s*=\s*[""']?{fieldName}[""']?[^>]*>.*?(?=<input|<textarea|<select|$)";
                var regex = new System.Text.RegularExpressions.Regex(pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                var match = regex.Match(html);
                return match.Success ? match.Value.Trim() : "未找到匹配片段";
            }
            catch (Exception ex)
            {
                return $"獲取片段時出錯: {ex.Message}";
            }
        }

        // 執行 sendEForm 節點
        private async Task<bool> ExecuteSendEForm(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
            WriteLog($"=== 執行 sendEForm 節點 ===");
            WriteLog($"🔍 [DEBUG] sendEForm 節點配置:");
            WriteLog($"🔍 [DEBUG] FormName: '{nodeData.FormName}'");
            WriteLog($"🔍 [DEBUG] To: '{nodeData.To}'");
            WriteLog($"🔍 [DEBUG] RecipientDetails: {(nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : "null")}");
            WriteLog($"🔍 [DEBUG] SendEFormMode: '{nodeData.SendEFormMode}'");
            WriteLog($"🔍 [DEBUG] IntegratedDataSetQueryNodeId: '{nodeData.IntegratedDataSetQueryNodeId}'");
                        
                        if (!string.IsNullOrEmpty(nodeData.FormName))
                        {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                            
                            try
                            {
                                // 獲取公司信息
                                var company = await db.Companies.FindAsync(execution.WorkflowDefinition.CompanyId);
                                if (company == null)
                                {
                                    stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Company not found" });
                        return false;
                                }

                                // 查詢表單定義
                                WriteLog($"🔍 [DEBUG] 查詢表單定義: FormId={nodeData.FormId}, FormName={nodeData.FormName}");
                                
                                eFormDefinition eFormDefinition = null;
                                
                                // 優先使用 FormId 查找（推薦方式）
                                if (!string.IsNullOrEmpty(nodeData.FormId))
                                {
                                    WriteLog($"🔍 [DEBUG] 使用 FormId 查找表單定義: {nodeData.FormId}");
                                    eFormDefinition = await db.eFormDefinitions
                                        .FirstOrDefaultAsync(f => f.Id == Guid.Parse(nodeData.FormId) && f.Status == "A");
                                }
                                
                                // 如果 FormId 查找失敗，則使用 FormName 查找（向後兼容）
                                if (eFormDefinition == null && !string.IsNullOrEmpty(nodeData.FormName))
                                {
                                    WriteLog($"🔍 [DEBUG] FormId 查找失敗，使用 FormName 查找: {nodeData.FormName}");
                                    eFormDefinition = await db.eFormDefinitions
                                        .FirstOrDefaultAsync(f => f.Name == nodeData.FormName && f.Status == "A");
                                }

                                if (eFormDefinition == null)
                                {
                                    WriteLog($"❌ [ERROR] 找不到表單定義: FormId={nodeData.FormId}, FormName={nodeData.FormName}");
                                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                                        error = $"Form definition not found", 
                                        formId = nodeData.FormId,
                                        formName = nodeData.FormName
                                    });
                        return false;
                                }
                                
                                WriteLog($"✅ [SUCCESS] 找到表單定義: {eFormDefinition.Id}, 狀態: {eFormDefinition.Status}");
                                WriteLog($"🔍 [DEBUG] 表單類型: {eFormDefinition.FormType}");

                    // 先解析收件人（所有模式都需要）
                    WriteLog($"🔍 [DEBUG] 開始解析收件人");
                    var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                        nodeData.To, 
                        nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, 
                        execution.Id,
                        execution.WorkflowDefinition.CompanyId
                    );
                    
                    WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                    
                    // ✅ 檢查：如果沒有收件人，記錄詳細錯誤並返回失敗
                    if (resolvedRecipients == null || !resolvedRecipients.Any())
                    {
                        WriteLog($"❌ [ERROR] sendEForm 節點未解析到任何收件人！");
                        WriteLog($"❌ [ERROR] To 配置: '{nodeData.To}'");
                        WriteLog($"❌ [ERROR] RecipientDetails: {(nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : "null")}");
                        WriteLog($"❌ [ERROR] ExecutionId: {execution.Id}");
                        
                        stepExec.OutputJson = JsonSerializer.Serialize(new { 
                            error = "No recipients resolved", 
                            to = nodeData.To,
                            recipientDetails = nodeData.RecipientDetails,
                            executionId = execution.Id
                        });
                        stepExec.Status = "Error";
                        await SaveStepExecution(stepExec);
                        return false;
                    }
                    
                    // 記錄每個收件人的詳細信息
                    WriteLog($"🔍 [DEBUG] 收件人詳細信息:");
                    for (int i = 0; i < resolvedRecipients.Count; i++)
                    {
                        var recipient = resolvedRecipients[i];
                        WriteLog($"🔍 [DEBUG]   收件人 {i + 1}: {recipient.PhoneNumber} ({recipient.RecipientName}) - 類型: {recipient.RecipientType}");
                    }

                    // 檢查是否為 MetaFlows 類型
                    if (eFormDefinition.FormType == "MetaFlows")
                    {
                        WriteLog($"🔍 [DEBUG] 檢測到 MetaFlows 類型，使用 Flow 發送模式");
                        
                        // 獲取 Flow ID
                        var flowId = eFormDefinition.MetaFlowId;
                        if (string.IsNullOrEmpty(flowId))
                        {
                            WriteLog($"❌ [ERROR] MetaFlows 表單缺少 MetaFlowId");
                            stepExec.OutputJson = JsonSerializer.Serialize(new { 
                                error = "MetaFlows form missing MetaFlowId", 
                                formId = eFormDefinition.Id
                            });
                            return false;
                        }
                        
                        WriteLog($"🔍 [DEBUG] Flow ID: {flowId}");
                        
                        // flow_message_version 是消息格式版本，不是 Flow JSON 的版本號
                        // 根據官方文檔和測試，應該使用 "3" 作為默認值（消息格式版本）
                        string flowMessageVersion = "3"; // 消息格式版本，固定為 3
                        WriteLog($"🔍 [DEBUG] 使用消息格式版本: {flowMessageVersion}");
                        
                        // 為每個收件人發送 Flow
                        // 從 stepExec.InputJson 中提取 nodeId
                        string nodeId = null;
                        try
                        {
                            var inputData = JsonSerializer.Deserialize<JsonElement>(stepExec.InputJson ?? "{}");
                            if (inputData.TryGetProperty("Id", out var idElement))
                                nodeId = idElement.GetString();
                            else if (inputData.TryGetProperty("NodeId", out var nodeIdElement))
                                nodeId = nodeIdElement.GetString();
                        }
                        catch { }
                        
                        await SendFlowToRecipients(resolvedRecipients, flowId, flowMessageVersion, eFormDefinition, nodeData, execution, stepExec, db, nodeId);
                        
                        // 設置為等待 Flow 回覆狀態
                        execution.Status = "WaitingForFormApproval";
                        stepExec.Status = "Waiting";
                        stepExec.OutputJson = JsonSerializer.Serialize(new { 
                            success = true, 
                            message = "MetaFlows sent successfully, waiting for responses",
                            flowId = flowId,
                            recipientCount = resolvedRecipients.Count,
                            waitingSince = DateTime.UtcNow 
                        });
                        
                        await SaveExecution(execution);
                        await SaveStepExecution(stepExec);
                        
                        WriteLog($"MetaFlows 節點設置為等待 Flow 回覆狀態");
                        return false; // 返回 false 表示暫停執行
                    }
                    
                    var sendEFormMode = nodeData.SendEFormMode ?? "integrateWaitReply"; // 默認為整合等待用戶回覆模式
                    
                    if (sendEFormMode == "manualFill")
                    {
                        // === Manual Fill 模式：為每個收件人創建獨立的表單實例 ===
                        WriteLog($"🔍 [DEBUG] Manual Fill 模式，為每個收件人創建獨立表單");
                        
                        var parentInstanceId = Guid.NewGuid(); // 用於關聯同一批次的表單
                        var instanceIds = new List<Guid>();
                        
                        // 為每個收件人創建獨立的表單實例
                        foreach (var recipient in resolvedRecipients)
                        {
                            // 先創建實例 ID
                            var instanceId = Guid.NewGuid();
                            
                            // 使用實際的實例 ID 生成安全 Token
                            var accessToken = _eFormTokenService.GenerateAccessToken(instanceId, recipient.PhoneNumber);
                            
                            // 創建獨立的表單實例
                            var eFormInstance = new EFormInstance
                            {
                                Id = instanceId,
                                EFormDefinitionId = eFormDefinition.Id,
                                WorkflowExecutionId = execution.Id,
                                WorkflowStepExecutionId = execution.CurrentStep ?? 0,
                                CompanyId = company.Id,
                                InstanceName = $"{nodeData.FormName}_{recipient.RecipientName ?? recipient.PhoneNumber}_{DateTime.UtcNow:yyyyMMddHHmmss}",
                                OriginalHtmlCode = eFormDefinition.HtmlCode,
                                FilledHtmlCode = null,  // Manual Fill 不預填
                                UserMessage = null,
                                Status = "Pending",
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow,
                                
                                // 新增字段
                                FillType = "Manual",
                                RecipientWhatsAppNo = recipient.PhoneNumber,
                                RecipientName = recipient.RecipientName,
                                ParentInstanceId = parentInstanceId,
                                AccessToken = accessToken,
                                TokenExpiresAt = DateTime.UtcNow.AddDays(30)  // 30天有效期
                            };
                            
                            // 生成帶安全 Token 的表單 URL（需要 URL 編碼 Token）
                            var encodedToken = System.Web.HttpUtility.UrlEncode(accessToken);
                            var formUrl = $"/eform-instance/{eFormInstance.Id}?token={encodedToken}";
                            eFormInstance.FormUrl = formUrl;
                            
                            // 保存到數據庫
                            db.EFormInstances.Add(eFormInstance);
                            instanceIds.Add(eFormInstance.Id);
                            
                            WriteLog($"🔍 [DEBUG] 為收件人 {recipient.PhoneNumber} 創建表單實例: {eFormInstance.Id}");
                        }
                        
                        await db.SaveChangesAsync();
                        WriteLog($"🔍 [DEBUG] 已創建 {instanceIds.Count} 個表單實例");
                        
                        // 發送通知給每個收件人（每個人都收到自己的專屬 URL）
                        await SendFormNotificationsToRecipients(resolvedRecipients, instanceIds, nodeData, execution, stepExec, db);
                        
                        // 設置為等待表單審批狀態
                        execution.Status = "WaitingForFormApproval";
                        stepExec.Status = "Waiting";
                        stepExec.OutputJson = JsonSerializer.Serialize(new { 
                            success = true, 
                            message = "Manual Fill forms sent successfully, waiting for submissions",
                            instanceCount = instanceIds.Count,
                            parentInstanceId = parentInstanceId,
                            waitingSince = DateTime.UtcNow 
                        });
                        
                        await SaveExecution(execution);
                        await SaveStepExecution(stepExec);
                        
                        WriteLog($"Manual Fill 表單節點設置為等待表單提交狀態");
                        return false; // 返回 false 表示暫停執行
                    }
                    else
                    {
                        // === AI Fill / Data Fill 模式：單一表單實例 ===
                        string filledHtmlCode = eFormDefinition.HtmlCode;
                        string userMessage = null;
                        
                        switch (sendEFormMode)
                        {
                            case "integrateWaitReply":
                                // 整合等待用戶回覆節點 (AI 自然語言填表)
                                var userMessages = await db.MessageValidations
                                    .Where(m => m.WorkflowExecutionId == execution.Id && m.IsValid)
                                    .OrderBy(m => m.CreatedAt)
                                    .ToListAsync();

                                if (userMessages.Any())
                                {
                                    var latestMessage = userMessages.Last();
                                    userMessage = latestMessage.UserMessage;
                                    
                                    // ✅ 處理圖片消息的情況
                                    // 如果 UserMessage 為空或只包含 "[圖片消息]"，嘗試從 ProcessedData 或 Process Variable 獲取 AI 分析結果
                                    if (string.IsNullOrWhiteSpace(userMessage) || 
                                        userMessage == "[圖片消息]" || 
                                        userMessage.Contains("[圖片消息]") ||
                                        string.Equals(latestMessage.MessageType, "image", StringComparison.OrdinalIgnoreCase))
                                    {
                                        WriteLog($"🔍 [DEBUG] 檢測到圖片消息，UserMessage: '{userMessage}', MessageType: '{latestMessage.MessageType}'");
                                        
                                        // 優先使用 ProcessedData（AI 驗證結果）
                                        if (!string.IsNullOrWhiteSpace(latestMessage.ProcessedData))
                                        {
                                            try
                                            {
                                                // 嘗試解析 ProcessedData（可能是 JSON 字符串）
                                                var processedData = latestMessage.ProcessedData;
                                                WriteLog($"🔍 [DEBUG] 使用 ProcessedData，長度: {processedData.Length}");
                                                
                                                // 如果 ProcessedData 是 JSON，嘗試提取有用的信息
                                                if (processedData.TrimStart().StartsWith("{") || processedData.TrimStart().StartsWith("["))
                                                {
                                                    try
                                                    {
                                                        using var doc = JsonDocument.Parse(processedData);
                                                        // 如果是 JSON，直接使用原始 JSON 字符串
                                                        userMessage = processedData;
                                                        WriteLog($"🔍 [DEBUG] ProcessedData 是 JSON 格式，使用原始 JSON");
                                                    }
                                                    catch
                                                    {
                                                        // 如果不是有效的 JSON，直接使用字符串
                                                        userMessage = processedData;
                                                    }
                                                }
                                                else
                                                {
                                                    userMessage = processedData;
                                                }
                                            }
                                            catch (Exception ex)
                                            {
                                                WriteLog($"⚠️ [WARNING] 解析 ProcessedData 失敗: {ex.Message}");
                                            }
                                        }
                                        
                                        // 如果 ProcessedData 也為空，嘗試從 Process Variable 獲取
                                        if (string.IsNullOrWhiteSpace(userMessage) || userMessage == "[圖片消息]")
                                        {
                                            WriteLog($"🔍 [DEBUG] ProcessedData 為空，嘗試從 Process Variable 獲取");
                                            
                                            // 獲取所有 Process Variables
                                            var processVariables = await GetCurrentProcessVariables(execution.Id);
                                            
                                            // 查找可能包含 AI 分析結果的變量（例如 ReimburseResult）
                                            // 優先查找包含 "Result" 的變量，或使用最新的變量
                                            var aiResultVariable = processVariables
                                                .Where(kv => kv.Key.Contains("Result", StringComparison.OrdinalIgnoreCase) || 
                                                             kv.Key.Contains("AI", StringComparison.OrdinalIgnoreCase))
                                                .OrderByDescending(kv => kv.Key)
                                                .FirstOrDefault();
                                            
                                            if (aiResultVariable.Key != null && aiResultVariable.Value != null)
                                            {
                                                WriteLog($"🔍 [DEBUG] 找到 Process Variable: {aiResultVariable.Key}");
                                                
                                                // 如果是 JSON 對象，轉換為字符串
                                                if (aiResultVariable.Value is JsonElement jsonElement)
                                                {
                                                    userMessage = jsonElement.GetRawText();
                                                }
                                                else if (aiResultVariable.Value is string strValue)
                                                {
                                                    userMessage = strValue;
                                                }
                                                else
                                                {
                                                    userMessage = JsonSerializer.Serialize(aiResultVariable.Value, new JsonSerializerOptions 
                                                    { 
                                                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase 
                                                    });
                                                }
                                                
                                                WriteLog($"🔍 [DEBUG] 從 Process Variable 獲取的值，長度: {userMessage?.Length ?? 0}");
                                            }
                                        }
                                        
                                        // 如果仍然沒有有效的 userMessage，使用默認值
                                        if (string.IsNullOrWhiteSpace(userMessage) || userMessage == "[圖片消息]")
                                        {
                                            WriteLog($"⚠️ [WARNING] 無法獲取有效的用戶消息，使用默認值");
                                            userMessage = "請根據圖片內容填充表單";
                                        }
                                    }
                                    
                                    WriteLog($"🔍 [DEBUG] 最終使用的 userMessage 長度: {userMessage?.Length ?? 0}");
                                    
                                    filledHtmlCode = await _eFormService.FillFormWithAIAsync(
                                        execution.WorkflowDefinition.CompanyId,
                                        nodeData.AiProviderKey,
                                        eFormDefinition.HtmlCode,
                                        userMessage);
                                }
                                WriteLog($"🔍 [DEBUG] 整合等待用戶回覆模式，用戶回覆數量: {userMessages.Count}");
                                break;
                                
                            case "integrateDataSetQuery":
                                // 整合 DataSet Query 節點 (結構化數據填表)
                                if (!string.IsNullOrEmpty(nodeData.IntegratedDataSetQueryNodeId))
                                {
                                    WriteLog($"🔍 [DEBUG] 查找指定的 DataSet Query 節點: {nodeData.IntegratedDataSetQueryNodeId}");
                                    
                                    // 先查看所有 DataSet Query 執行記錄
                                    var allDataSetSteps = await db.WorkflowStepExecutions
                                        .Where(s => s.WorkflowExecutionId == execution.Id && 
                                                   s.StepType == "dataSetQuery")
                                        .OrderByDescending(s => s.StartedAt)
                                        .ToListAsync();
                                    
                                    WriteLog($"🔍 [DEBUG] 找到 {allDataSetSteps.Count} 個 DataSet Query 執行記錄");
                                    
                                    foreach (var step in allDataSetSteps)
                                    {
                                        WriteLog($"🔍 [DEBUG] 檢查步驟 {step.Id}，InputJson 長度: {step.InputJson?.Length ?? 0}");
                                        WriteLog($"🔍 [DEBUG] 步驟 {step.Id} 的 InputJson 內容: {step.InputJson?.Substring(0, Math.Min(200, step.InputJson?.Length ?? 0))}...");
                                            
                                        try
                                        {
                                            var inputJson = JsonSerializer.Deserialize<JsonElement>(step.InputJson);
                                            
                                            string foundId = null;
                                            if (inputJson.TryGetProperty("Id", out var idElement))
                                            {
                                                foundId = idElement.GetString();
                                            }
                                            else if (inputJson.TryGetProperty("NodeId", out var nodeIdElement))
                                            {
                                                foundId = nodeIdElement.GetString();
                                            }
                                            else if (inputJson.TryGetProperty("id", out var idLowerElement))
                                            {
                                                foundId = idLowerElement.GetString();
                                            }
                                            
                                            WriteLog($"🔍 [DEBUG] 步驟 {step.Id} 找到的 ID: '{foundId}', 目標 ID: '{nodeData.IntegratedDataSetQueryNodeId}'");
                                        }
                                        catch (Exception ex)
                                        {
                                            WriteLog($"🔍 [DEBUG] 解析步驟 {step.Id} 的 InputJson 時出錯: {ex.Message}");
                                        }
                                    }
                                    
                                    // 查找指定 DataSet Query 節點的執行記錄
                                    // 使用精確匹配，避免部分字符串匹配
                                    var targetStepExecution = allDataSetSteps
                                        .Where(s => {
                                            try
                                            {
                                                var inputJson = JsonSerializer.Deserialize<JsonElement>(s.InputJson);
                                                
                                                string foundId = null;
                                                if (inputJson.TryGetProperty("Id", out var idElement))
                                                {
                                                    foundId = idElement.GetString();
                                                }
                                                else if (inputJson.TryGetProperty("NodeId", out var nodeIdElement))
                                                {
                                                    foundId = nodeIdElement.GetString();
                                                }
                                                
                                                return foundId == nodeData.IntegratedDataSetQueryNodeId;
                                            }
                                            catch
                                            {
                                                return false;
                                            }
                                        })
                                        .FirstOrDefault();
                                    
                                    // 如果還是找不到，嘗試更精確的查找方式
                                    if (targetStepExecution == null)
                                    {
                                        WriteLog($"🔍 [DEBUG] 使用原始查找方式找不到，嘗試更精確的查找");
                                        
                                        // 使用精確的 ID 匹配
                                        foreach (var step in allDataSetSteps)
                                        {
                                            try
                                            {
                                                var inputJson = JsonSerializer.Deserialize<JsonElement>(step.InputJson);
                                                
                                                string foundId = null;
                                                if (inputJson.TryGetProperty("Id", out var idElement))
                                                {
                                                    foundId = idElement.GetString();
                                                }
                                                else if (inputJson.TryGetProperty("NodeId", out var nodeIdElement))
                                                {
                                                    foundId = nodeIdElement.GetString();
                                                }
                                                else if (inputJson.TryGetProperty("id", out var idLowerElement))
                                                {
                                                    foundId = idLowerElement.GetString();
                                                }
                                                
                                                WriteLog($"🔍 [DEBUG] 精確匹配檢查 - 步驟 {step.Id} 找到的 ID: '{foundId}', 目標 ID: '{nodeData.IntegratedDataSetQueryNodeId}'");
                                                
                                                if (foundId == nodeData.IntegratedDataSetQueryNodeId)
                                                {
                                                    targetStepExecution = step;
                                                    WriteLog($"🔍 [DEBUG] 通過精確匹配找到 DataSet Query 節點: {step.Id}");
                                                    break;
                                                }
                                            }
                                            catch (Exception ex)
                                            {
                                                WriteLog($"🔍 [DEBUG] 解析步驟 {step.Id} 的 InputJson 時出錯: {ex.Message}");
                                            }
                                        }
                                        
                                        if (targetStepExecution == null)
                                        {
                                            WriteLog($"⚠️ [WARNING] 無法找到指定的 DataSet Query 節點執行記錄，不應回退到其他查詢");
                                        }
                                    }

                                    if (targetStepExecution != null)
                                    {
                                        WriteLog($"🔍 [DEBUG] 找到 DataSet Query 節點執行記錄: {targetStepExecution.Id}");
                                        
                                        WriteLog($"🔍 [DEBUG] 查找查詢結果 - WorkflowExecutionId: {execution.Id}, StepExecutionId: {targetStepExecution.Id}");
                                        
                                        var queryResults = await db.WorkflowDataSetQueryResults
                                            .Where(r => r.WorkflowExecutionId == execution.Id && r.StepExecutionId == targetStepExecution.Id)
                                            .OrderByDescending(r => r.ExecutedAt)
                                            .FirstOrDefaultAsync();

                                        WriteLog($"🔍 [DEBUG] 查詢結果記錄: {(queryResults != null ? $"ID={queryResults.Id}, DataSetId={queryResults.DataSetId}, StepExecutionId={queryResults.StepExecutionId}" : "null")}");

                                        if (queryResults != null && !string.IsNullOrEmpty(queryResults.QueryResult))
                                        {
                                            WriteLog($"🔍 [DEBUG] 找到查詢結果，記錄數量: {queryResults.TotalRecords}");
                                            WriteLog($"🔍 [DEBUG] 查詢結果內容: {queryResults.QueryResult}");
                                            
                                            // 解析查詢結果並填充表單
                                            var originalHtmlLength = eFormDefinition.HtmlCode?.Length ?? 0;
                                            filledHtmlCode = await FillFormWithDataSetQueryResults(eFormDefinition.HtmlCode, queryResults.QueryResult);
                                            var filledHtmlLength = filledHtmlCode?.Length ?? 0;
                                            
                                            WriteLog($"🔍 [DEBUG] 表單填充完成 - 原始長度: {originalHtmlLength}, 填充後長度: {filledHtmlLength}");
                                            WriteLog($"🔍 [DEBUG] 填充後 HTML 是否與原始相同: {filledHtmlCode == eFormDefinition.HtmlCode}");
                                            
                                            if (filledHtmlCode == eFormDefinition.HtmlCode)
                                            {
                                                WriteLog($"⚠️ [WARNING] 表單填充可能失敗，HTML 沒有變化");
                                            }
                                        }
                                        else
                                        {
                                            WriteLog($"⚠️ [WARNING] 找不到 DataSet Query 結果，使用空白表單");
                                        }
                                    }
                                    else
                                    {
                                        WriteLog($"⚠️ [WARNING] 找不到指定的 DataSet Query 節點執行記錄 (NodeId: {nodeData.IntegratedDataSetQueryNodeId})，使用空白表單");
                                    }
                                }
                                else
                                {
                                    WriteLog($"⚠️ [WARNING] 未指定 DataSet Query 節點 ID，使用空白表單");
                                }
                                break;
                                
                            default:
                                WriteLog($"⚠️ [WARNING] 未知的表單填充模式: {sendEFormMode}，使用默認模式");
                                break;
                        }

                        // ✅ 調試：記錄收件人信息
                        WriteLog($"🔍 [DEBUG] AI/Data Fill 模式收件人信息:");
                        WriteLog($"🔍 [DEBUG] 收件人數量: {resolvedRecipients.Count}");
                        if (resolvedRecipients.Any())
                        {
                            var firstRecipient = resolvedRecipients.First();
                            WriteLog($"🔍 [DEBUG] 主要收件人: {firstRecipient.PhoneNumber} ({firstRecipient.RecipientName})");
                        }

                        // 創建單一表單實例
                        var eFormInstance = new EFormInstance
                        {
                            Id = Guid.NewGuid(),
                            EFormDefinitionId = eFormDefinition.Id,
                            WorkflowExecutionId = execution.Id,
                            WorkflowStepExecutionId = execution.CurrentStep ?? 0,
                            CompanyId = company.Id,
                            InstanceName = $"{nodeData.FormName}_{execution.Id}_{DateTime.UtcNow:yyyyMMddHHmmss}",
                            OriginalHtmlCode = eFormDefinition.HtmlCode,
                            FilledHtmlCode = filledHtmlCode,
                            UserMessage = userMessage,
                            Status = "Pending",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow,
                            FillType = sendEFormMode == "integrateWaitReply" ? "AI" : "Data",
                            
                            // ✅ 修復：添加收件人信息
                            // 對於單一表單實例，使用第一個收件人的信息作為主要收件人
                            RecipientWhatsAppNo = resolvedRecipients.FirstOrDefault()?.PhoneNumber,
                            RecipientName = resolvedRecipients.FirstOrDefault()?.RecipientName,
                            
                            // 如果需要支持多個收件人，可以考慮添加額外字段來存儲所有收件人信息
                            // 或者為每個收件人創建獨立的表單實例（類似 Manual Fill 模式）
                        };

                        // 生成表單 URL
                        var formUrl = $"/eform-instance/{eFormInstance.Id}";
                        eFormInstance.FormUrl = formUrl;

                        // 保存到數據庫
                        db.EFormInstances.Add(eFormInstance);
                        await db.SaveChangesAsync();
                        
                        // 為 AI Fill / Data Fill 模式發送通知
                        await SendFormNotificationsForSingleInstance(eFormInstance, resolvedRecipients, nodeData, execution, stepExec, db);
                        
                        // 設置為等待表單審批狀態
                        execution.Status = "WaitingForFormApproval";
                        stepExec.Status = "Waiting";
                        stepExec.OutputJson = JsonSerializer.Serialize(new { 
                            success = true, 
                            message = "EForm sent successfully, waiting for approval",
                            formInstanceId = eFormInstance.Id,
                            recipientCount = resolvedRecipients.Count,
                            waitingSince = DateTime.UtcNow 
                        });
                        
                        // 保存狀態
                        await SaveExecution(execution);
                        await SaveStepExecution(stepExec);
                        
                        WriteLog($"eForm 節點設置為等待表單審批狀態");
                        return false; // 返回 false 表示暫停執行
                    }
                }
                catch (Exception ex)
                {
                    WriteLog($"❌ [ERROR] eForm 處理失敗: {ex.Message}");
                    WriteLog($"❌ [ERROR] 錯誤堆疊: {ex.StackTrace}");
                    WriteLog($"❌ [ERROR] 內部異常: {ex.InnerException?.Message}");
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        error = ex.Message,
                        stackTrace = ex.StackTrace,
                        innerException = ex.InnerException?.Message
                    });
                    return false;
                }
            }
            else
            {
                WriteLog($"❌ [ERROR] sendEForm 步驟缺少必要參數:");
                WriteLog($"❌ [ERROR] FormName: '{nodeData.FormName}' (是否為空: {string.IsNullOrEmpty(nodeData.FormName)})");
                WriteLog($"❌ [ERROR] RecipientDetails: {(nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : "null")}");
                stepExec.OutputJson = JsonSerializer.Serialize(new { 
                    error = "Missing required parameters",
                    formName = nodeData.FormName,
                    recipientDetails = nodeData.RecipientDetails
                });
                return false;
            }
        }

        // 處理模板變數（共用方法）
        /// <summary>
        /// 處理模板變數（新版本 - 支持模板變數配置）
        /// </summary>
        private async Task<Dictionary<string, string>> ProcessTemplateVariablesAsync(
            Dictionary<string, string> variables, 
            int executionId)
        {
            var processedVariables = new Dictionary<string, string>();
            
            if (variables != null)
            {
                foreach (var kvp in variables)
                {
                    var processedValue = await _variableReplacementService.ReplaceVariablesAsync(kvp.Value, executionId);
                    processedVariables[kvp.Key] = processedValue;
                    WriteLog($"🔍 [DEBUG] 模板變數 {kvp.Key}: {kvp.Value} -> {processedValue}");
                }
            }
            
            return processedVariables;
        }

        /// <summary>
        /// 處理新的模板變數配置（支持流程變數和數據集欄位）
        /// </summary>
        private async Task<Dictionary<string, string>> ProcessTemplateVariableConfigAsync(
            List<object> templateVariables,
            int executionId,
            PurpleRiceDbContext dbContext)
        {
            var processedVariables = new Dictionary<string, string>();
            
            if (templateVariables != null && templateVariables.Any())
            {
                foreach (var templateVar in templateVariables)
                {
                    try
                    {
                        // 解析模板變數配置
                        var varJson = JsonSerializer.Serialize(templateVar);
                        var varElement = JsonSerializer.Deserialize<JsonElement>(varJson);
                        
                        var parameterName = varElement.GetProperty("parameterName").GetString();
                        var processVariableId = varElement.GetProperty("processVariableId").GetString();
                        
                        if (string.IsNullOrEmpty(parameterName))
                        {
                            WriteLog($"⚠️ [WARNING] 跳過無效的模板變數配置: parameterName 為空");
                            continue;
                        }
                        
                        // 檢查是否為固化變數（以 fixed_ 開頭）
                        bool isFixedVariable = !string.IsNullOrEmpty(processVariableId) && processVariableId.StartsWith("fixed_");
                        string fixedVariableId = isFixedVariable ? processVariableId.Substring(6) : null; // 移除 "fixed_" 前綴
                        
                        string variableValue = "";
                        
                        if (isFixedVariable)
                        {
                            // 固化變數將在節點執行時由具體節點處理（如 sendEForm 節點會添加 formName 和 formUrl）
                            // 這裡先跳過，讓節點自己處理
                            WriteLog($"🔍 [DEBUG] 檢測到固化變數: {fixedVariableId}，將由節點自行處理");
                            continue; // 跳過固化變數，讓節點自己處理
                        }
                        else if (!string.IsNullOrEmpty(processVariableId))
                        {
                            // 處理流程變數
                            if (Guid.TryParse(processVariableId, out var processVarId))
                            {
                                var processVar = await dbContext.ProcessVariableDefinitions
                                    .FirstOrDefaultAsync(pv => pv.Id == processVarId);
                                
                                if (processVar != null)
                                {
                                    variableValue = await _variableReplacementService.ReplaceVariablesAsync(
                                        $"${{{processVar.VariableName}}}", executionId);
                                    WriteLog($"🔍 [DEBUG] 流程變數 {processVar.VariableName}: {variableValue}");
                                }
                                else
                                {
                                    WriteLog($"⚠️ [WARNING] 找不到流程變數 ID: {processVariableId}");
                                }
                            }
                        }
                        
                        // 即使值為空也要添加參數，Meta API 需要知道參數的存在
                        processedVariables[parameterName] = variableValue ?? "";
                        WriteLog($"🔍 [DEBUG] 添加模板參數: {parameterName} = '{variableValue ?? ""}'");
                        
                        // 同時添加 ProcessVariableName 到值的映射，以便在 URL 替換時使用
                        // 例如：如果 parameterName 是 "1"，ProcessVariableName 是 "InvoiceNo"
                        // 則同時添加 "1" -> "5149392" 和 "InvoiceNo" -> "5149392"
                        if (varElement.TryGetProperty("processVariableName", out var processVarNameElement))
                        {
                            var processVarName = processVarNameElement.GetString();
                            if (!string.IsNullOrEmpty(processVarName))
                            {
                                processedVariables[processVarName] = variableValue ?? "";
                                WriteLog($"🔍 [DEBUG] 同時添加 ProcessVariableName 映射: {processVarName} = '{variableValue ?? ""}'");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        WriteLog($"❌ [ERROR] 處理模板變數配置失敗: {ex.Message}");
                    }
                }
            }
            
            return processedVariables;
        }

        // 執行 end 節點
        private async Task<bool> ExecuteEnd(string nodeId, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
                    WriteLog($"=== 到達 End 節點: {nodeId} ===");
            
            stepExec.OutputJson = JsonSerializer.Serialize(new { 
                message = "End node reached",
                nodeId = nodeId,
                completedAt = DateTime.UtcNow
            });
                    
                    // 檢查是否所有分支都已完成
            var completedEndNodes = await CountCompletedEndNodes(execution.Id);
                    
                    WriteLog($"=== End 節點完成檢查 ===");
                    WriteLog($"已完成 End 節點數: {completedEndNodes}");
                    
            // 標記 end 節點本身為完成
            stepExec.Status = "Completed";
            stepExec.EndedAt = DateTime.UtcNow;
            await SaveStepExecution(stepExec);
                    
            // 標記整個流程為完成
            execution.Status = "Completed";
            execution.EndedAt = DateTime.UtcNow;
            await SaveExecution(execution);
            
            // 清理用戶會話中的已完成流程
            await _userSessionService.ClearCompletedWorkflowFromSessionAsync(execution.Id);
            
            WriteLog($"=== 工作流程標記為完成 ===");
            
            return false; // 返回 false 表示暫停執行
        }

        // 執行 Switch 節點
        private async Task<bool> ExecuteSwitch(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution, string userId)
        {
            WriteLog($"=== 執行 Switch 節點 ===");
            WriteLog($"節點數據: {JsonSerializer.Serialize(nodeData)}");

            try
            {
                // 獲取條件群組
                var conditionGroups = GetConditionGroupsFromNodeData(nodeData);
                var defaultPath = GetDefaultPathFromNodeData(nodeData);

                WriteLog($"條件群組數量: {conditionGroups?.Count ?? 0}");
                WriteLog($"默認路徑: {defaultPath}");

                // 評估條件群組 - 支持多個條件同時滿足
                var selectedPaths = new List<string>();
                if (conditionGroups != null && conditionGroups.Any())
                {
                    foreach (var group in conditionGroups)
                    {
                        WriteLog($"評估條件群組: {group.Id}, 關係: {group.Relation}");
                        
                        bool groupResult = await EvaluateConditionGroup(execution.Id, group);
                        if (groupResult)
                        {
                            selectedPaths.Add(group.OutputPath);
                            WriteLog($"條件群組 {group.Id} 滿足，添加路徑: {group.OutputPath}");
                        }
                    }
                }

                // 如果沒有條件滿足，使用默認路徑
                if (!selectedPaths.Any())
                {
                    if (!string.IsNullOrEmpty(defaultPath))
                    {
                        selectedPaths.Add(defaultPath);
                        WriteLog($"沒有條件滿足，使用默認路徑: {defaultPath}");
                    }
                }

                // 記錄執行結果
                stepExec.OutputJson = JsonSerializer.Serialize(new
                {
                    selectedPaths = selectedPaths,
                    selectedPath = selectedPaths.FirstOrDefault(), // 保持向後兼容
                    evaluatedAt = DateTime.UtcNow,
                    conditionGroupsCount = conditionGroups?.Count ?? 0,
                    defaultPathUsed = !selectedPaths.Any() || selectedPaths.Contains(defaultPath)
                });

                WriteLog($"Switch 節點執行完成，選擇路徑數量: {selectedPaths.Count}");
                return true; // 返回 true 表示繼續執行
            }
            catch (Exception ex)
            {
                WriteLog($"執行 Switch 節點時發生錯誤: {ex.Message}");
                stepExec.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                return false;
            }
        }

        // 從節點數據中獲取條件群組
        private List<SwitchConditionGroup> GetConditionGroupsFromNodeData(WorkflowNodeData nodeData)
        {
            try
            {
                if (nodeData.ConditionGroups != null)
                {
                    return nodeData.ConditionGroups;
                }

                // 如果 ConditionGroups 為 null，嘗試從 JSON 中解析
                if (!string.IsNullOrEmpty(nodeData.Json))
                {
                    var jsonData = JsonSerializer.Deserialize<Dictionary<string, object>>(nodeData.Json);
                    if (jsonData.ContainsKey("conditionGroups"))
                    {
                        var conditionGroupsJson = JsonSerializer.Serialize(jsonData["conditionGroups"]);
                        return JsonSerializer.Deserialize<List<SwitchConditionGroup>>(conditionGroupsJson);
                    }
                }

                return new List<SwitchConditionGroup>();
            }
            catch (Exception ex)
            {
                WriteLog($"解析條件群組時發生錯誤: {ex.Message}");
                return new List<SwitchConditionGroup>();
            }
        }

        // 從節點數據中獲取默認路徑
        private string GetDefaultPathFromNodeData(WorkflowNodeData nodeData)
        {
            try
            {
                if (!string.IsNullOrEmpty(nodeData.DefaultPath))
                {
                    return nodeData.DefaultPath;
                }

                // 如果 DefaultPath 為空，嘗試從 JSON 中解析
                if (!string.IsNullOrEmpty(nodeData.Json))
                {
                    var jsonData = JsonSerializer.Deserialize<Dictionary<string, object>>(nodeData.Json);
                    if (jsonData.ContainsKey("defaultPath"))
                    {
                        return jsonData["defaultPath"]?.ToString();
                    }
                }

                return "default";
            }
            catch (Exception ex)
            {
                WriteLog($"解析默認路徑時發生錯誤: {ex.Message}");
                return "default";
            }
        }

        // 評估條件群組
        private async Task<bool> EvaluateConditionGroup(int executionId, SwitchConditionGroup group)
        {
            if (group.Conditions == null || !group.Conditions.Any())
            {
                WriteLog($"條件群組 {group.Id} 沒有條件，返回 false");
                return false;
            }

            WriteLog($"評估條件群組 {group.Id}，條件數量: {group.Conditions.Count}，關係: {group.Relation}");

            if (group.Relation?.ToLower() == "and")
            {
                // AND 關係：所有條件都必須滿足
                foreach (var condition in group.Conditions)
                {
                    bool conditionResult = await _switchConditionService.EvaluateConditionAsync(executionId, condition);
                    WriteLog($"條件 {condition.VariableName} {condition.Operator} {condition.Value}: {conditionResult}");
                    
                    if (!conditionResult)
                    {
                        WriteLog($"條件群組 {group.Id} 的 AND 關係不滿足");
                        return false;
                    }
                }
                WriteLog($"條件群組 {group.Id} 的 AND 關係滿足");
                return true;
            }
            else
            {
                // OR 關係：任一條件滿足即可
                foreach (var condition in group.Conditions)
                {
                    bool conditionResult = await _switchConditionService.EvaluateConditionAsync(executionId, condition);
                    WriteLog($"條件 {condition.VariableName} {condition.Operator} {condition.Value}: {conditionResult}");
                    
                    if (conditionResult)
                    {
                        WriteLog($"條件群組 {group.Id} 的 OR 關係滿足");
                        return true;
                    }
                }
                WriteLog($"條件群組 {group.Id} 的 OR 關係不滿足");
                return false;
            }
        }

        // 計算已完成的 End 節點數量
        private async Task<int> CountCompletedEndNodes(int executionId)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            return await db.WorkflowStepExecutions
                .Where(s => s.WorkflowExecutionId == executionId && 
                           s.StepType == "end" && 
                           s.Status == "Completed")
                .CountAsync();
        }

        // 檢查節點執行次數是否超限（防止死循環）
        private async Task<bool> CheckNodeExecutionLimit(int executionId, string nodeId, string nodeType)
        {
            // 檢查配置是否啟用監控
            var enableMonitoring = _configuration.GetValue<bool>("WorkflowEngine:EnableExecutionLimitMonitoring", true);
            if (!enableMonitoring)
            {
                return false; // 未啟用監控，允許執行
            }
            
            var maxExecutions = _configuration.GetValue<int>("WorkflowEngine:MaxExecutionsPerMinute", 100);
            var timeWindowMinutes = _configuration.GetValue<int>("WorkflowEngine:TimeWindowMinutes", 1);
            
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            // 檢查過去 N 分鐘內該節點的執行次數
            var timeWindow = DateTime.UtcNow.AddMinutes(-timeWindowMinutes);
            
            var executionCount = await db.WorkflowStepExecutions
                .Where(s => s.WorkflowExecutionId == executionId && 
                           s.StepType == nodeType &&
                           s.StartedAt.HasValue &&
                           s.StartedAt.Value > timeWindow)
                .CountAsync();
            
            // 如果超過限制，則判定為死循環
            if (executionCount >= maxExecutions)
            {
                WriteLog($"⚠️ 警告：節點 {nodeId} ({nodeType}) 在 {timeWindowMinutes} 分鐘內執行 {executionCount} 次，超過限制 {maxExecutions}，疑似死循環！");
                
                // 標記流程為 Blocked
                var execution = await db.WorkflowExecutions.FindAsync(executionId);
                if (execution != null)
                {
                    execution.Status = "Blocked";
                    execution.ErrorMessage = $"節點 {nodeType} 執行超過限制（{timeWindowMinutes} 分鐘內 {executionCount} 次），疑似死循環。流程已被自動停止，請檢查流程設計。";
                    execution.EndedAt = DateTime.UtcNow;
                    await db.SaveChangesAsync();
                    
                    WriteLog($"工作流程 {executionId} 已標記為 Blocked");
                }
                
                return true;  // 阻止繼續執行
            }
            
            WriteLog($"節點 {nodeId} ({nodeType}) 執行次數檢查通過：{executionCount}/{maxExecutions}");
            return false;
        }
        
        // 檢查節點是否已經執行過（檢查特定節點 ID，而不是所有同類型的節點）
        private async Task<bool> IsNodeAlreadyExecuted(int executionId, string nodeId, string nodeType)
        {
            // 檢查執行次數限制（防止死循環）
            if (await CheckNodeExecutionLimit(executionId, nodeId, nodeType))
            {
                return true;  // 超過執行次數限制
            }
            
            // ✅ 修復：檢查特定節點 ID 是否已經執行過，而不是所有同類型的節點
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            // 查找是否有相同節點 ID 的步驟執行記錄
            var existingSteps = await db.WorkflowStepExecutions
                .Where(s => s.WorkflowExecutionId == executionId && 
                           s.StepType == nodeType &&
                           !string.IsNullOrEmpty(s.InputJson))
                .ToListAsync();
            
            foreach (var step in existingSteps)
            {
                try
                {
                    var inputData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(step.InputJson);
                    
                    string foundNodeId = null;
                    if (inputData.TryGetValue("Id", out var idElement))
                        foundNodeId = idElement.GetString();
                    else if (inputData.TryGetValue("NodeId", out var nodeIdElement))
                        foundNodeId = nodeIdElement.GetString();
                    
                    // 如果找到相同節點 ID 的步驟，且狀態不是 Failed，則認為已經執行過
                    if (foundNodeId == nodeId && step.Status != "Failed")
                    {
                        WriteLog($"發現重複的節點 {nodeId}: 節點 {nodeId} 已經執行過（步驟 ID: {step.Id}, 狀態: {step.Status}）");
                        return true;
                    }
                }
                catch (Exception ex)
                {
                    WriteLog($"解析步驟 {step.Id} 的 InputJson 時發生錯誤: {ex.Message}");
                    // 繼續檢查下一個步驟
                }
            }
            
            // 其他情況：允許執行（不做重入檢查，允許流程自由循環）
            return false;
        }
        
        // 從邊 ID 中提取目標節點（智能處理正向和反向邊）
        private string ExtractTargetNodeFromEdge(string edgeId, string currentNodeId)
        {
            if (string.IsNullOrEmpty(edgeId))
                return null;
            
            WriteLog($"🔍 解析邊 ID: {edgeId}");
            WriteLog($"🔍 當前節點: {currentNodeId}");
            
            // 邊 ID 格式：
            // xy-edge__{sourceNode}{sourceHandle}-source-{targetNode}{targetHandle}-target
            // 例如：xy-edge__switch_xxxbottom-source-waitReply_xxxtop-target
            // 或反向：xy-edge__waitReply_xxxtop-source-switch_xxxbottom-target
            
            // 分割邊 ID 以提取 source 和 target 節點
            var parts = edgeId.Split(new[] { "-source-", "-target" }, StringSplitOptions.None);
            if (parts.Length < 2)
            {
                WriteLog($"❌ 邊 ID 格式不正確");
                return null;
            }
            
            // 提取前綴後的第一個節點（source 節點）
            var prefix = edgeId.StartsWith("xy-edge__") ? "xy-edge__" : 
                         edgeId.StartsWith("reactflow__edge-") ? "reactflow__edge-" : "";
            
            if (string.IsNullOrEmpty(prefix))
            {
                WriteLog($"❌ 無法識別邊 ID 前綴");
                return null;
            }
            
            var afterPrefix = edgeId.Substring(prefix.Length);
            
            // 查找 source 和 target 的位置
            var sourceMarkerIndex = afterPrefix.IndexOf("-source-");
            if (sourceMarkerIndex < 0)
            {
                WriteLog($"❌ 找不到 -source- 標記");
                return null;
            }
            
            // 提取 source 節點（去除 handle 後綴）
            var sourceWithHandle = afterPrefix.Substring(0, sourceMarkerIndex);
            var sourceNodeId = RemoveHandleSuffix(sourceWithHandle);
            
            // 提取 target 節點（在 -source- 之後，在 -target 之前）
            var afterSource = afterPrefix.Substring(sourceMarkerIndex + 8); // 跳過 "-source-"
            var targetMarkerIndex = afterSource.IndexOf("-target");
            if (targetMarkerIndex < 0)
            {
                WriteLog($"❌ 找不到 -target 標記");
                return null;
            }
            
            var targetWithHandle = afterSource.Substring(0, targetMarkerIndex);
            var targetNodeId = RemoveHandleSuffix(targetWithHandle);
            
            WriteLog($"📍 Source 節點: {sourceNodeId}");
            WriteLog($"📍 Target 節點: {targetNodeId}");
            
            // 判斷當前節點在邊的哪一端，返回另一端的節點
            if (currentNodeId == sourceNodeId)
            {
                WriteLog($"✅ 當前節點在 source 端，目標是: {targetNodeId}");
                return targetNodeId;
            }
            else if (currentNodeId == targetNodeId)
            {
                WriteLog($"✅ 當前節點在 target 端（反向邊），目標是: {sourceNodeId}");
                return sourceNodeId;
            }
            else
            {
                WriteLog($"⚠️ 當前節點 {currentNodeId} 不在邊的任何一端，默認返回 target: {targetNodeId}");
                return targetNodeId;
            }
        }
        
        // 移除 handle 後綴（top, bottom, left, right）
        private string RemoveHandleSuffix(string nodeIdWithHandle)
        {
            var suffixes = new[] { "top", "bottom", "left", "right" };
            foreach (var suffix in suffixes)
            {
                if (nodeIdWithHandle.EndsWith(suffix))
                {
                    return nodeIdWithHandle.Substring(0, nodeIdWithHandle.Length - suffix.Length);
                }
            }
            return nodeIdWithHandle;
        }
        
        // 從路徑中提取目標節點 ID
        private string GetTargetNodeIdFromPath(string path, Dictionary<string, List<string>> adjacencyList)
        {
            // 路徑格式可能是:
            // 1. "reactflow__edge-switch_xxxbottom-source-sendWhatsApp_xxxtop-target"
            // 2. "xy-edge__switch_xxxbottom-source-sendWhatsApp_xxxtop-target"
            // 3. "xy-edge__waitReply_xxxtop-source-switch_xxxbottom-target" (反向邊)
            
            if (string.IsNullOrEmpty(path))
                return null;
            
            WriteLog($"🔍 [DEBUG] 解析路徑: {path}");
                
            // 嘗試多種格式提取節點 ID
            
            // 格式 1: "source-" 和 "top-target" 之間
            var sourceIndex = path.IndexOf("source-");
            var topTargetIndex = path.IndexOf("top-target");
            
            if (sourceIndex >= 0 && topTargetIndex > sourceIndex)
            {
                var nodeId = path.Substring(sourceIndex + 7, topTargetIndex - sourceIndex - 7);
                WriteLog($"✅ 從路徑提取節點 ID (格式1): {nodeId}");
                return nodeId;
            }
            
            // 格式 2: "source-" 和 "bottom-target" 之間
            var bottomTargetIndex = path.IndexOf("bottom-target");
            if (sourceIndex >= 0 && bottomTargetIndex > sourceIndex)
            {
                var nodeId = path.Substring(sourceIndex + 7, bottomTargetIndex - sourceIndex - 7);
                WriteLog($"✅ 從路徑提取節點 ID (格式2): {nodeId}");
                return nodeId;
            }
            
            // 格式 3: "source-" 和 "right-target" 之間
            var rightTargetIndex = path.IndexOf("right-target");
            if (sourceIndex >= 0 && rightTargetIndex > sourceIndex)
            {
                var nodeId = path.Substring(sourceIndex + 7, rightTargetIndex - sourceIndex - 7);
                WriteLog($"✅ 從路徑提取節點 ID (格式3): {nodeId}");
                return nodeId;
            }
            
            // 格式 4: 反向邊 - 從邊 ID 的開頭部分提取（xy-edge__{nodeId}top-source-...）
            if (path.StartsWith("xy-edge__") || path.StartsWith("reactflow__edge-"))
            {
                var prefix = path.StartsWith("xy-edge__") ? "xy-edge__" : "reactflow__edge-";
                var remaining = path.Substring(prefix.Length);
                
                // 查找第一個 "source" 或 "target" 關鍵字之前的部分
                var keywords = new[] { "top-source", "bottom-source", "left-source", "right-source", 
                                      "top-target", "bottom-target", "left-target", "right-target" };
                
                foreach (var keyword in keywords)
                {
                    var keywordIndex = remaining.IndexOf(keyword);
                    if (keywordIndex > 0)
                    {
                        var possibleNodeId = remaining.Substring(0, keywordIndex);
                        WriteLog($"✅ 從路徑提取節點 ID (格式4-反向邊): {possibleNodeId}");
                        return possibleNodeId;
                    }
                }
            }
            
            WriteLog($"❌ 無法從路徑 {path} 提取節點 ID");
            return null;
        }
        
        // 執行 Switch 節點的後續節點（根據條件結果選擇性執行）
        private async Task ExecuteSwitchNextNodes(string currentNodeId, Dictionary<string, WorkflowNode> nodeMap, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId, WorkflowStepExecution stepExec, List<WorkflowEdge> edges = null)
        {
            try
            {
                // 從 stepExec.OutputJson 中獲取 selectedPaths
                var outputData = JsonSerializer.Deserialize<Dictionary<string, object>>(stepExec.OutputJson ?? "{}");
                var selectedPaths = new List<string>();
                
                // 支持新的多路徑格式和向後兼容
                if (outputData?.ContainsKey("selectedPaths") == true)
                {
                    var pathsArray = outputData["selectedPaths"] as JsonElement?;
                    if (pathsArray?.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var path in pathsArray.Value.EnumerateArray())
                        {
                            if (path.ValueKind == JsonValueKind.String)
                            {
                                selectedPaths.Add(path.GetString() ?? "");
                            }
                        }
                    }
                }
                else if (outputData?.ContainsKey("selectedPath") == true)
                {
                    // 向後兼容單一路徑
                    var singlePath = outputData["selectedPath"]?.ToString();
                    if (!string.IsNullOrEmpty(singlePath))
                    {
                        selectedPaths.Add(singlePath);
                    }
                }
                
                WriteLog($"=== Switch 節點後續處理 ===");
                WriteLog($"選擇的路徑數量: {selectedPaths.Count}");
                WriteLog($"選擇的路徑: {string.Join(", ", selectedPaths)}");
                
                if (!selectedPaths.Any())
                {
                    WriteLog("沒有選擇路徑，跳過後續節點執行");
                    return;
                }
                
                // 並行執行所有選中的路徑
                var tasks = new List<Task>();
                foreach (var path in selectedPaths)
                {
                    WriteLog($"🔍 處理選擇的路徑（邊 ID）: {path}");
                    
                    string targetNodeId = null;
                    
                    // ✅ 優先使用邊列表（最準確）
                    if (edges != null && edges.Any())
                    {
                        var edge = edges.FirstOrDefault(e => e.Id == path);
                        if (edge != null)
                        {
                            // 從邊的 source 和 target 屬性判斷目標節點
                            if (edge.Source == currentNodeId)
                            {
                                targetNodeId = edge.Target;
                                WriteLog($"✅ 從邊屬性找到目標節點 (source->target): {targetNodeId}");
                            }
                            else if (edge.Target == currentNodeId)
                            {
                                targetNodeId = edge.Source;
                                WriteLog($"✅ 從邊屬性找到目標節點 (target->source 反向): {targetNodeId}");
                            }
                            else
                            {
                                // 當前節點不在邊的任一端，默認使用 target
                                targetNodeId = edge.Target;
                                WriteLog($"⚠️ 當前節點 {currentNodeId} 不在邊的任何一端，默認使用 target: {targetNodeId}");
                            }
                        }
                        else
                        {
                            WriteLog($"⚠️ 在邊列表中找不到邊 ID: {path}");
                        }
                    }
                    
                    // 如果沒有邊列表或找不到邊，嘗試解析邊 ID
                    if (string.IsNullOrEmpty(targetNodeId))
                    {
                        WriteLog($"嘗試從邊 ID 解析目標節點...");
                        targetNodeId = ExtractTargetNodeFromEdge(path, currentNodeId);
                    }
                    
                    if (string.IsNullOrEmpty(targetNodeId))
                    {
                        WriteLog($"❌ 無法找到目標節點");
                        continue;
                    }
                    
                    WriteLog($"✅ 最終目標節點: {targetNodeId}");
                    
                    // 執行目標節點
                    if (nodeMap.ContainsKey(targetNodeId))
                    {
                        WriteLog($"開始執行目標節點: {targetNodeId}");
                        var task = ExecuteNodeWithBranches(targetNodeId, nodeMap, adjacencyList, execution, userId, edges);
                        tasks.Add(task);
                    }
                    else
                    {
                        WriteLog($"警告: 目標節點 {targetNodeId} 不存在於節點映射中");
                    }
                }
                
                // 等待所有選中的節點完成
                if (tasks.Any())
                {
                    WriteLog($"等待 {tasks.Count} 個選中的節點完成...");
                    await Task.WhenAll(tasks);
                    WriteLog($"所有選中的節點執行完成");
                }
            }
            catch (Exception ex)
            {
                WriteLog($"執行 Switch 後續節點時發生錯誤: {ex.Message}");
            }
        }

    // DataSet 查詢執行方法
    private async Task<bool> ExecuteDataSetQuery(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
    {
        try
        {
            WriteLog($"執行 DataSet 查詢節點: {nodeData?.TaskName}");

            // 獲取節點配置
            var dataSetId = nodeData?.DataSetId;
            var operationType = nodeData?.OperationType ?? "SELECT";
            var queryConditionGroups = nodeData?.QueryConditionGroups ?? new List<object>();
            var operationData = nodeData?.OperationData ?? new Dictionary<string, object>();
            var operationDataFields = nodeData?.OperationDataFields ?? new List<object>(); // 包含 jsonKey 的完整字段信息
            var mappedFields = nodeData?.MappedFields ?? new List<object>();

            // 調試日誌：記錄原始查詢條件
            WriteLog($"原始查詢條件組數量: {queryConditionGroups.Count}");
            foreach (var group in queryConditionGroups)
            {
                WriteLog($"查詢條件組: {JsonSerializer.Serialize(group)}");
            }

            if (string.IsNullOrEmpty(dataSetId))
            {
                WriteLog("DataSet ID 為空，跳過執行");
                stepExec.Status = "Skipped";
                stepExec.OutputJson = JsonSerializer.Serialize(new { message = "DataSet ID 未配置" });
                return true;
            }

            // 獲取當前流程變量值
            var processVariables = await GetCurrentProcessVariables(execution.Id);

            // 構建查詢請求
            var request = new Models.DTOs.DataSetQueryRequest
            {
                DataSetId = Guid.Parse(dataSetId),
                OperationType = operationType,
                ProcessVariableValues = processVariables
            };

            // 轉換查詢條件
            foreach (var groupObj in queryConditionGroups)
            {
                var groupJson = JsonSerializer.Serialize(groupObj);
                WriteLog($"轉換查詢條件組 JSON: {groupJson}");
                
                // 嘗試直接反序列化
                var group = JsonSerializer.Deserialize<Models.DTOs.QueryConditionGroup>(groupJson);
                if (group != null)
                {
                    WriteLog($"成功轉換查詢條件組，條件數量: {group.Conditions.Count}");
                    if (group.Conditions.Count > 0)
                    {
                        WriteLog($"第一個條件: FieldName={group.Conditions[0].FieldName}, Operator={group.Conditions[0].Operator}, Value={group.Conditions[0].Value}");
                    }
                    request.QueryConditionGroups.Add(group);
                }
                else
                {
                    WriteLog("查詢條件組轉換失敗，group 為 null");
                }
            }

            // 轉換欄位映射
            foreach (var mappingObj in mappedFields)
            {
                var mappingJson = JsonSerializer.Serialize(mappingObj);
                WriteLog($"轉換欄位映射 JSON: {mappingJson}");
                
                var mapping = JsonSerializer.Deserialize<Models.DTOs.FieldMapping>(mappingJson);
                if (mapping != null)
                {
                    WriteLog($"成功轉換欄位映射: {mapping.FieldName} → {mapping.VariableName}");
                    request.MappedFields.Add(mapping);
                }
                else
                {
                    WriteLog("欄位映射轉換失敗，mapping 為 null");
                }
            }

            // 轉換操作數據字段（包含 jsonKey 信息）
            if (operationDataFields.Count > 0)
            {
                WriteLog($"讀取 operationDataFields，數量: {operationDataFields.Count}");
                foreach (var fieldObj in operationDataFields)
                {
                    var fieldJson = JsonSerializer.Serialize(fieldObj);
                    WriteLog($"轉換操作數據字段 JSON: {fieldJson}");
                    
                    var field = JsonSerializer.Deserialize<Models.DTOs.OperationDataField>(fieldJson);
                    if (field != null)
                    {
                        WriteLog($"成功轉換操作數據字段: {field.Name} = {field.Value}, JsonKey = {field.JsonKey ?? "null"}");
                        request.OperationDataFields.Add(field);
                    }
                    else
                    {
                        WriteLog("操作數據字段轉換失敗，field 為 null");
                    }
                }
            }
            else
            {
                // 兼容舊格式：從 operationData 字典轉換
                WriteLog("未找到 operationDataFields，嘗試從 operationData 轉換");
                foreach (var kvp in operationData)
                {
                    request.OperationDataFields.Add(new Models.DTOs.OperationDataField
                    {
                        Name = kvp.Key,
                        Value = kvp.Value?.ToString() ?? string.Empty,
                        JsonKey = null
                    });
                }
            }

            // 執行查詢
            var result = await _dataSetQueryService.ExecuteDataSetQueryAsync(
                execution.Id,
                stepExec.Id,
                request
            );

            // 更新步驟執行狀態
            if (result.Success)
            {
                stepExec.Status = "Completed";
                stepExec.OutputJson = JsonSerializer.Serialize(new
                {
                    success = true,
                    message = result.Message,
                    totalCount = result.TotalCount,
                    queryResultId = result.QueryResultId,
                    dataSetName = result.DataSetName
                });
                WriteLog($"DataSet 查詢成功: {result.Message}");
                
                // ✅ 修復：即使查詢返回 0 條記錄，也要繼續執行後續節點
                // 因為這是一個合法的查詢結果，流程應該繼續進行
                WriteLog($"查詢結果: 找到 {result.TotalCount} 條記錄，繼續執行後續節點");
                return true;
            }
            else
            {
                stepExec.Status = "Failed";
                stepExec.OutputJson = JsonSerializer.Serialize(new
                {
                    success = false,
                    message = result.Message
                });
                WriteLog($"DataSet 查詢失敗: {result.Message}");
                
                // ❌ 只有在查詢真正失敗時才返回 false，阻止流程繼續
                return false;
            }
        }
        catch (Exception ex)
        {
            WriteLog($"執行 DataSet 查詢節點時發生錯誤: {ex.Message}");
            stepExec.Status = "Error";
            stepExec.OutputJson = JsonSerializer.Serialize(new
            {
                success = false,
                message = ex.Message
            });
            return false;
        }
    }

    // 獲取當前流程變量值
    private async Task<Dictionary<string, object>> GetCurrentProcessVariables(int workflowExecutionId)
    {
        try
        {
            var variables = await _context.ProcessVariableValues
                .Where(pv => pv.WorkflowExecutionId == workflowExecutionId)
                .ToListAsync();

            var result = new Dictionary<string, object>();
            foreach (var variable in variables)
            {
                result[variable.VariableName] = variable.GetValue();
            }
            return result;
        }
        catch (Exception ex)
        {
            WriteLog($"獲取流程變量失敗: {ex.Message}");
            return new Dictionary<string, object>();
        }
    }

    // 輔助方法：為 Manual Fill 模式發送通知
    private async Task SendFormNotificationsToRecipients(
        List<ResolvedRecipient> resolvedRecipients, 
        List<Guid> instanceIds, 
        WorkflowNodeData nodeData, 
        WorkflowExecution execution, 
        WorkflowStepExecution stepExec, 
        PurpleRiceDbContext db)
    {
        WriteLog($"🔍 [DEBUG] 開始為 {resolvedRecipients?.Count ?? 0} 個收件人發送表單通知");
        
        // ✅ 檢查：如果沒有收件人，記錄錯誤並返回
        if (resolvedRecipients == null || !resolvedRecipients.Any())
        {
            WriteLog($"❌ [ERROR] SendFormNotificationsToRecipients: 沒有收件人可以發送通知！");
            WriteLog($"❌ [ERROR] InstanceIds: {string.Join(", ", instanceIds)}");
            WriteLog($"❌ [ERROR] ExecutionId: {execution.Id}");
            WriteLog($"❌ [ERROR] StepExecutionId: {stepExec.Id}");
            return;
        }
        
        // 獲取所有表單實例
        var instances = await db.EFormInstances
            .Where(i => instanceIds.Contains(i.Id))
            .ToListAsync();
        
        WriteLog($"🔍 [DEBUG] 找到 {instances.Count} 個表單實例");
        
        // 根據訊息模式發送通知
        string messageMode = nodeData.MessageMode ?? "direct";
        WriteLog($"🔍 [DEBUG] sendEForm messageMode: {messageMode}");
        
        Guid messageSendId = Guid.Empty;
        
        if (messageMode == "template")
        {
            WriteLog($"📝 Manual Fill 使用模板模式");
            
            if (!string.IsNullOrEmpty(nodeData.TemplateName))
            {
                // 使用共用方法處理模板變數
                Dictionary<string, string> processedVariables;
                if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                {
                    processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                    
                    // 檢查 templateVariables 中是否配置了固定變數
                    var hasFormUrl = nodeData.TemplateVariables.Any(tv =>
                    {
                        try
                        {
                            var tvJson = JsonSerializer.Serialize(tv);
                            var tvElement = JsonSerializer.Deserialize<JsonElement>(tvJson);
                            if (tvElement.TryGetProperty("processVariableId", out var pvIdProp))
                            {
                                var pvId = pvIdProp.GetString();
                                return !string.IsNullOrEmpty(pvId) && pvId.StartsWith("fixed_") && pvId.Substring(6) == "formUrl";
                            }
                        }
                        catch { }
                        return false;
                    });
                    
                    var hasFormName = nodeData.TemplateVariables.Any(tv =>
                    {
                        try
                        {
                            var tvJson = JsonSerializer.Serialize(tv);
                            var tvElement = JsonSerializer.Deserialize<JsonElement>(tvJson);
                            if (tvElement.TryGetProperty("processVariableId", out var pvIdProp))
                            {
                                var pvId = pvIdProp.GetString();
                                return !string.IsNullOrEmpty(pvId) && pvId.StartsWith("fixed_") && pvId.Substring(6) == "formName";
                            }
                        }
                        catch { }
                        return false;
                    });
                    
                    // 為每個收件人發送個性化的模板消息
                    foreach (var recipient in resolvedRecipients)
                    {
                        var instance = instances.FirstOrDefault(i => i.RecipientWhatsAppNo == recipient.PhoneNumber);
                        if (instance != null)
                        {
                            // 只有配置了固定變數才添加，使用對應的 parameterName 作為鍵
                            if (hasFormUrl)
                            {
                                // 找到 formUrl 對應的 parameterName
                                var formUrlParamName = nodeData.TemplateVariables
                                    .Select(tv =>
                                    {
                                        try
                                        {
                                            var tvJson = JsonSerializer.Serialize(tv);
                                            var tvElement = JsonSerializer.Deserialize<JsonElement>(tvJson);
                                            if (tvElement.TryGetProperty("processVariableId", out var pvIdProp))
                                            {
                                                var pvId = pvIdProp.GetString();
                                                if (!string.IsNullOrEmpty(pvId) && pvId.StartsWith("fixed_") && pvId.Substring(6) == "formUrl")
                                                {
                                                    return tvElement.TryGetProperty("parameterName", out var paramNameProp) 
                                                        ? paramNameProp.GetString() 
                                                        : null;
                                                }
                                            }
                                        }
                                        catch { }
                                        return null;
                                    })
                                    .FirstOrDefault(p => !string.IsNullOrEmpty(p));
                                
                                if (!string.IsNullOrEmpty(formUrlParamName))
                                {
                                    processedVariables[formUrlParamName] = instance.FormUrl;
                                    WriteLog($"🔍 [DEBUG] 為 {recipient.PhoneNumber} 添加固定變數 formUrl 到參數位置 {formUrlParamName}: {instance.FormUrl}");
                                }
                                else
                                {
                                    WriteLog($"⚠️ [WARNING] 找不到 formUrl 對應的 parameterName，使用默認鍵 'formUrl'");
                                    processedVariables["formUrl"] = instance.FormUrl;
                                }
                            }
                            if (hasFormName)
                            {
                                // 找到 formName 對應的 parameterName
                                var formNameParamName = nodeData.TemplateVariables
                                    .Select(tv =>
                                    {
                                        try
                                        {
                                            var tvJson = JsonSerializer.Serialize(tv);
                                            var tvElement = JsonSerializer.Deserialize<JsonElement>(tvJson);
                                            if (tvElement.TryGetProperty("processVariableId", out var pvIdProp))
                                            {
                                                var pvId = pvIdProp.GetString();
                                                if (!string.IsNullOrEmpty(pvId) && pvId.StartsWith("fixed_") && pvId.Substring(6) == "formName")
                                                {
                                                    return tvElement.TryGetProperty("parameterName", out var paramNameProp) 
                                                        ? paramNameProp.GetString() 
                                                        : null;
                                                }
                                            }
                                        }
                                        catch { }
                                        return null;
                                    })
                                    .FirstOrDefault(p => !string.IsNullOrEmpty(p));
                                
                                if (!string.IsNullOrEmpty(formNameParamName))
                                {
                                    processedVariables[formNameParamName] = nodeData.FormName ?? "";
                                    WriteLog($"🔍 [DEBUG] 為 {recipient.PhoneNumber} 添加固定變數 formName 到參數位置 {formNameParamName}: {nodeData.FormName ?? ""}");
                                }
                                else
                                {
                                    WriteLog($"⚠️ [WARNING] 找不到 formName 對應的 parameterName，使用默認鍵 'formName'");
                                    processedVariables["formName"] = nodeData.FormName ?? "";
                                }
                            }
                            // recipientName 暫時保留（如果需要的話）
                            // processedVariables["recipientName"] = recipient.RecipientName ?? recipient.PhoneNumber;
                        
                        // 從 nodeData 讀取 templateHeaderUrl 等字段（優先從 stepExec.InputJson 讀取）
                        var (templateHeaderUrl, templateHeaderType, templateHeaderFilename) = GetTemplateHeaderInfo(nodeData, stepExec);
                        
                        // 發送模板訊息
                        messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                            recipient.PhoneNumber,
                            null, // Manual Fill 不需要複雜的收件人配置
                            nodeData.TemplateId,
                            nodeData.TemplateName,
                            processedVariables,
                            execution,
                            stepExec,
                            stepExec.Id.ToString(),
                            "sendEForm",
                            db,
                            nodeData.IsMetaTemplate,
                            nodeData.TemplateLanguage,
                            templateHeaderUrl,  // 傳遞 header URL
                            templateHeaderType,  // 傳遞 header 類型
                            templateHeaderFilename  // 傳遞 header filename
                        );
                        
                        WriteLog($"🔍 [DEBUG] 為 {recipient.PhoneNumber} 發送表單通知，ID: {messageSendId}");
                    }
                }
                }
                else
                {
                    processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                    
                    // 舊的 variables 模式：無條件添加（向後兼容）
                    // 為每個收件人發送個性化的模板消息
                    foreach (var recipient in resolvedRecipients)
                    {
                        var instance = instances.FirstOrDefault(i => i.RecipientWhatsAppNo == recipient.PhoneNumber);
                        if (instance != null)
                        {
                            // 添加個性化的表單 URL（舊模式：無條件添加）
                            processedVariables["formUrl"] = instance.FormUrl;
                            processedVariables["formName"] = nodeData.FormName ?? "";
                            processedVariables["recipientName"] = recipient.RecipientName ?? recipient.PhoneNumber;
                            
                            // 從 nodeData 讀取 templateHeaderUrl 等字段（優先從 stepExec.InputJson 讀取）
                            var (templateHeaderUrl, templateHeaderType, templateHeaderFilename) = GetTemplateHeaderInfo(nodeData, stepExec);
                            
                            // 發送模板訊息
                            messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                                recipient.PhoneNumber,
                                null, // Manual Fill 不需要複雜的收件人配置
                                nodeData.TemplateId,
                                nodeData.TemplateName,
                                processedVariables,
                                execution,
                                stepExec,
                                stepExec.Id.ToString(),
                                "sendEForm",
                                db,
                                nodeData.IsMetaTemplate,
                                nodeData.TemplateLanguage,
                                templateHeaderUrl,  // 傳遞 header URL
                                templateHeaderType,  // 傳遞 header 類型
                                templateHeaderFilename  // 傳遞 header filename
                            );
                            
                            WriteLog($"🔍 [DEBUG] 為 {recipient.PhoneNumber} 發送表單通知，ID: {messageSendId}");
                        }
                    }
                }
            }
        }
        else
        {
            WriteLog($"💬 Manual Fill 使用直接訊息模式");
            
            // 為每個收件人發送個性化的直接消息
            foreach (var recipient in resolvedRecipients)
            {
                var instance = instances.FirstOrDefault(i => i.RecipientWhatsAppNo == recipient.PhoneNumber);
                if (instance != null)
                {
                    // 構建個性化通知消息
                    string message;
                    if (nodeData.UseCustomMessage && !string.IsNullOrEmpty(nodeData.MessageTemplate))
                    {
                        message = nodeData.MessageTemplate
                            .Replace("{formName}", nodeData.FormName ?? "")
                            .Replace("{formUrl}", instance.FormUrl)
                            .Replace("{recipientName}", recipient.RecipientName ?? recipient.PhoneNumber);
                    }
                    else
                    {
                        message = $"您好 {recipient.RecipientName ?? recipient.PhoneNumber}，您的{nodeData.FormName}已準備就緒，請點擊以下鏈接填寫：\n\n{instance.FormUrl}";
                    }
                    
                    messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                        recipient.PhoneNumber,
                        null,
                        message,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(),
                        "sendEForm",
                        db
                    );
                    
                    WriteLog($"🔍 [DEBUG] 為 {recipient.PhoneNumber} 發送表單通知，ID: {messageSendId}");
                }
            }
        }
        
        WriteLog($"🔍 [DEBUG] Manual Fill 表單通知發送完成");
    }

    // 輔助方法：為單一表單實例發送通知
    /// <summary>
    /// 統一發送 Email 通知的方法
    /// </summary>
    /// <param name="emailConfig">Email 配置</param>
    /// <param name="resolvedRecipients">已解析的收件人列表</param>
    /// <param name="execution">工作流程執行記錄</param>
    /// <param name="stepExec">步驟執行記錄</param>
    /// <param name="nodeType">節點類型（如 "sendWhatsApp", "sendEForm", "waitForQRCode" 等）</param>
    /// <param name="db">數據庫上下文</param>
    /// <param name="additionalBodyReplacements">額外的 body 替換字典（可選，用於替換 {formName}, {formUrl} 等）</param>
    /// <param name="createMessageSendRecord">是否創建 WorkflowMessageSend 記錄（默認 true）</param>
    /// <returns>發送結果（成功數量、跳過數量、失敗數量、消息發送記錄ID）</returns>
    private async Task<(int successCount, int skipCount, int failCount, Guid messageSendId)> SendEmailNotificationsAsync(
        EmailConfig emailConfig,
        List<ResolvedRecipient> resolvedRecipients,
        WorkflowExecution execution,
        WorkflowStepExecution stepExec,
        string nodeType,
        PurpleRiceDbContext db,
        Dictionary<string, string> additionalBodyReplacements = null,
        bool createMessageSendRecord = true)
    {
        // 驗證 email 配置
        if (emailConfig == null || string.IsNullOrEmpty(emailConfig.ProviderKey))
        {
            WriteLog($"❌ [ERROR] {nodeType} (Email 模式) 缺少必要參數: emailConfig.providerKey");
            return (0, 0, 0, Guid.Empty);
        }
        
        if (string.IsNullOrEmpty(emailConfig.Subject))
        {
            WriteLog($"❌ [ERROR] {nodeType} (Email 模式) 缺少必要參數: emailConfig.subject");
            return (0, 0, 0, Guid.Empty);
        }
        
        if (string.IsNullOrEmpty(emailConfig.Body))
        {
            WriteLog($"❌ [ERROR] {nodeType} (Email 模式) 缺少必要參數: emailConfig.body");
            return (0, 0, 0, Guid.Empty);
        }
        
        WriteLog($"🔍 [DEBUG] 開始處理 Email 變數替換");
        // 替換 subject 和 body 中的變數
        var processedSubject = await _variableReplacementService.ReplaceVariablesAsync(emailConfig.Subject, execution.Id);
        var processedBody = await _variableReplacementService.ReplaceVariablesAsync(emailConfig.Body, execution.Id);
        
        // 應用額外的 body 替換（如 {formName}, {formUrl}）
        if (additionalBodyReplacements != null)
        {
            foreach (var replacement in additionalBodyReplacements)
            {
                processedBody = processedBody
                    .Replace($"{{{replacement.Key}}}", replacement.Value)
                    .Replace($"${{{replacement.Key}}}", replacement.Value);
            }
        }
        
        WriteLog($"🔍 [DEBUG] Email Provider: {emailConfig.ProviderKey}");
        WriteLog($"🔍 [DEBUG] Subject: {processedSubject}");
        
        // 獲取發件人 email（從 API provider 設置中獲取）
        using var emailScope = _serviceProvider.CreateScope();
        var emailDb = emailScope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
        var apiProviderService = emailScope.ServiceProvider.GetRequiredService<PurpleRice.Services.ApiProviders.IApiProviderService>();
        
        var emailProvider = await apiProviderService.GetRuntimeProviderAsync(execution.WorkflowDefinition.CompanyId, emailConfig.ProviderKey);
        if (emailProvider == null)
        {
            WriteLog($"❌ [ERROR] Email provider '{emailConfig.ProviderKey}' not found");
            return (0, 0, 0, Guid.Empty);
        }
        
        // 從設置中獲取發件人 email
        var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(emailProvider.SettingsJson ?? "{}");
        var fromEmail = settings?.TryGetValue("fromEmail", out var fromEmailObj) == true 
            ? fromEmailObj?.ToString() 
            : null;
        
        if (string.IsNullOrEmpty(fromEmail))
        {
            WriteLog($"❌ [ERROR] From email not configured in email provider settings");
            return (0, 0, 0, Guid.Empty);
        }
        
        Guid messageSendId = Guid.Empty;
        
        // 創建 WorkflowMessageSend 記錄（如果需要）
        if (createMessageSendRecord)
        {
            messageSendId = await _messageSendService.CreateMessageSendAsync(
                execution.Id,
                stepExec.Id,
                stepExec.Id.ToString(),
                nodeType,
                $"{processedSubject} - {processedBody.Substring(0, Math.Min(100, processedBody.Length))}...",
                null, // templateId
                null, // templateName
                "email",
                execution.WorkflowDefinition.CompanyId,
                "system"
            );
            
            WriteLog($"📧 創建 Email 發送記錄，MessageSendId: {messageSendId}");
            
            // 添加所有收件人到 WorkflowMessageRecipients
            await _messageSendService.AddRecipientsAsync(messageSendId, resolvedRecipients, "system");
        }
        
        // 發送郵件給所有解析到的收件人
        int successCount = 0;
        int skipCount = 0;
        int failCount = 0;
        
        foreach (var recipient in resolvedRecipients)
        {
            // 從收件人中提取 email
            string recipientEmail = null;
            
            // 嘗試從 contact 或 user 中獲取 email
            if (recipient.RecipientType == "User" || recipient.RecipientType == "Contact")
            {
                if (recipient.RecipientType == "User" && !string.IsNullOrEmpty(recipient.RecipientId))
                {
                    if (Guid.TryParse(recipient.RecipientId, out var userId))
                    {
                        var user = await emailDb.Users.FirstOrDefaultAsync(u => u.Id == userId);
                        if (user != null && !string.IsNullOrEmpty(user.Email))
                        {
                            recipientEmail = user.Email;
                        }
                    }
                }
                else if (recipient.RecipientType == "Contact" && !string.IsNullOrEmpty(recipient.RecipientId))
                {
                    if (Guid.TryParse(recipient.RecipientId, out var contactId))
                    {
                        var contact = await emailDb.ContactLists.FirstOrDefaultAsync(c => c.Id == contactId);
                        if (contact != null && !string.IsNullOrEmpty(contact.Email))
                        {
                            recipientEmail = contact.Email;
                        }
                    }
                }
            }
            
            // 如果沒有找到 email，嘗試從 PhoneNumber 判斷是否為 email 格式
            if (string.IsNullOrEmpty(recipientEmail) && !string.IsNullOrEmpty(recipient.PhoneNumber))
            {
                if (recipient.PhoneNumber.Contains("@"))
                {
                    recipientEmail = recipient.PhoneNumber;
                }
            }
            
            // 獲取收件人記錄（如果創建了記錄）
            WorkflowMessageRecipient recipientRecord = null;
            if (createMessageSendRecord)
            {
                recipientRecord = await db.WorkflowMessageRecipients
                    .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.Id == recipient.Id);
            }
            
            if (string.IsNullOrEmpty(recipientEmail))
            {
                WriteLog($"⚠️ [跳過] 無法獲取收件人 email，跳過: {recipient.RecipientName} ({recipient.PhoneNumber})");
                skipCount++;
                
                // 更新收件人狀態為失敗（無 email）
                if (recipientRecord != null)
                {
                    await _messageSendService.UpdateRecipientStatusAsync(
                        recipientRecord.Id,
                        RecipientStatus.Failed,
                        null,
                        "No email address found for recipient"
                    );
                }
                continue;
            }
            
            WriteLog($"🔍 [DEBUG] 發送郵件到: {recipientEmail}");
            
            try
            {
                var emailSent = await _emailService.SendEmailAsync(
                    emailConfig.ProviderKey,
                    execution.WorkflowDefinition.CompanyId,
                    fromEmail,
                    recipientEmail,
                    processedSubject,
                    processedBody,
                    emailConfig.ReplyTo,
                    db
                );
                
                if (emailSent)
                {
                    successCount++;
                    WriteLog($"✅ [成功] 郵件發送成功: {recipientEmail}");
                    
                    // 更新收件人狀態為已發送
                    if (recipientRecord != null)
                    {
                        await _messageSendService.UpdateRecipientStatusAsync(
                            recipientRecord.Id,
                            RecipientStatus.Sent
                        );
                    }
                }
                else
                {
                    failCount++;
                    WriteLog($"❌ [失敗] 郵件發送失敗: {recipientEmail}");
                    
                    // 更新收件人狀態為失敗
                    if (recipientRecord != null)
                    {
                        await _messageSendService.UpdateRecipientStatusAsync(
                            recipientRecord.Id,
                            RecipientStatus.Failed,
                            null,
                            "Email sending failed"
                        );
                    }
                }
            }
            catch (Exception ex)
            {
                failCount++;
                WriteLog($"❌ [失敗] 郵件發送異常: {recipientEmail} - {ex.Message}");
                WriteLog($"❌ [ERROR] 錯誤堆疊: {ex.StackTrace}");
                
                // 更新收件人狀態為失敗
                if (recipientRecord != null)
                {
                    await _messageSendService.UpdateRecipientStatusAsync(
                        recipientRecord.Id,
                        RecipientStatus.Failed,
                        null,
                        $"Email sending error: {ex.Message}"
                    );
                }
            }
        }
        
        // 更新 WorkflowMessageSend 狀態（如果創建了記錄）
        if (createMessageSendRecord)
        {
            var finalStatus = failCount == 0 && skipCount == 0 ? MessageSendStatus.Completed :
                             successCount == 0 ? MessageSendStatus.Failed :
                             MessageSendStatus.PartiallyFailed;
            
            await _messageSendService.UpdateMessageSendStatusAsync(messageSendId, finalStatus);
        }
        
        WriteLog($"📧 Email 發送完成 - 成功: {successCount}, 跳過: {skipCount}, 失敗: {failCount}, 總計: {resolvedRecipients.Count}");
        
        return (successCount, skipCount, failCount, messageSendId);
    }

    private async Task SendFormNotificationsForSingleInstance(
        EFormInstance eFormInstance,
        List<ResolvedRecipient> resolvedRecipients,
        WorkflowNodeData nodeData, 
        WorkflowExecution execution, 
        WorkflowStepExecution stepExec, 
        PurpleRiceDbContext db)
    {
        WriteLog($"🔍 [DEBUG] 為單一表單實例發送通知");
        
        // ✅ 檢查：如果沒有收件人，記錄錯誤並返回
        if (resolvedRecipients == null || !resolvedRecipients.Any())
        {
            WriteLog($"❌ [ERROR] SendFormNotificationsForSingleInstance: 沒有收件人可以發送通知！");
            WriteLog($"❌ [ERROR] 表單實例 ID: {eFormInstance.Id}");
            WriteLog($"❌ [ERROR] ExecutionId: {execution.Id}");
            WriteLog($"❌ [ERROR] StepExecutionId: {stepExec.Id}");
            return;
        }
        
        WriteLog($"🔍 [DEBUG] 準備為 {resolvedRecipients.Count} 個收件人發送通知");
        
        // 根據訊息模式發送通知
        string messageMode = nodeData.MessageMode ?? "direct";
        WriteLog($"🔍 [DEBUG] sendEForm messageMode: {messageMode}");
        
        Guid messageSendId = Guid.Empty;
        
        if (messageMode == "template")
        {
            WriteLog($"📝 sendEForm 使用模板模式");
            
            if (!string.IsNullOrEmpty(nodeData.TemplateName))
            {
                // 使用共用方法處理模板變數
                Dictionary<string, string> processedVariables;
                if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                {
                    processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                    
                    // 檢查 templateVariables 中是否配置了固定變數，只有配置了才添加
                    var hasFormUrl = nodeData.TemplateVariables.Any(tv =>
                    {
                        try
                        {
                            var tvJson = JsonSerializer.Serialize(tv);
                            var tvElement = JsonSerializer.Deserialize<JsonElement>(tvJson);
                            if (tvElement.TryGetProperty("processVariableId", out var pvIdProp))
                            {
                                var pvId = pvIdProp.GetString();
                                return !string.IsNullOrEmpty(pvId) && pvId.StartsWith("fixed_") && pvId.Substring(6) == "formUrl";
                            }
                        }
                        catch { }
                        return false;
                    });
                    
                    var hasFormName = nodeData.TemplateVariables.Any(tv =>
                    {
                        try
                        {
                            var tvJson = JsonSerializer.Serialize(tv);
                            var tvElement = JsonSerializer.Deserialize<JsonElement>(tvJson);
                            if (tvElement.TryGetProperty("processVariableId", out var pvIdProp))
                            {
                                var pvId = pvIdProp.GetString();
                                return !string.IsNullOrEmpty(pvId) && pvId.StartsWith("fixed_") && pvId.Substring(6) == "formName";
                            }
                        }
                        catch { }
                        return false;
                    });
                    
                    // 只有配置了固定變數才添加，使用對應的 parameterName 作為鍵
                    if (hasFormUrl)
                    {
                        // 找到 formUrl 對應的 parameterName
                        var formUrlParamName = nodeData.TemplateVariables
                            .Select(tv =>
                            {
                                try
                                {
                                    var tvJson = JsonSerializer.Serialize(tv);
                                    var tvElement = JsonSerializer.Deserialize<JsonElement>(tvJson);
                                    if (tvElement.TryGetProperty("processVariableId", out var pvIdProp))
                                    {
                                        var pvId = pvIdProp.GetString();
                                        if (!string.IsNullOrEmpty(pvId) && pvId.StartsWith("fixed_") && pvId.Substring(6) == "formUrl")
                                        {
                                            return tvElement.TryGetProperty("parameterName", out var paramNameProp) 
                                                ? paramNameProp.GetString() 
                                                : null;
                                        }
                                    }
                                }
                                catch { }
                                return null;
                            })
                            .FirstOrDefault(p => !string.IsNullOrEmpty(p));
                        
                        if (!string.IsNullOrEmpty(formUrlParamName))
                        {
                            processedVariables[formUrlParamName] = eFormInstance.FormUrl;
                            WriteLog($"🔍 [DEBUG] 添加固定變數 formUrl 到參數位置 {formUrlParamName}: {eFormInstance.FormUrl}");
                        }
                        else
                        {
                            WriteLog($"⚠️ [WARNING] 找不到 formUrl 對應的 parameterName，使用默認鍵 'formUrl'");
                            processedVariables["formUrl"] = eFormInstance.FormUrl;
                        }
                    }
                    if (hasFormName)
                    {
                        // 找到 formName 對應的 parameterName
                        var formNameParamName = nodeData.TemplateVariables
                            .Select(tv =>
                            {
                                try
                                {
                                    var tvJson = JsonSerializer.Serialize(tv);
                                    var tvElement = JsonSerializer.Deserialize<JsonElement>(tvJson);
                                    if (tvElement.TryGetProperty("processVariableId", out var pvIdProp))
                                    {
                                        var pvId = pvIdProp.GetString();
                                        if (!string.IsNullOrEmpty(pvId) && pvId.StartsWith("fixed_") && pvId.Substring(6) == "formName")
                                        {
                                            return tvElement.TryGetProperty("parameterName", out var paramNameProp) 
                                                ? paramNameProp.GetString() 
                                                : null;
                                        }
                                    }
                                }
                                catch { }
                                return null;
                            })
                            .FirstOrDefault(p => !string.IsNullOrEmpty(p));
                        
                        if (!string.IsNullOrEmpty(formNameParamName))
                        {
                            processedVariables[formNameParamName] = nodeData.FormName ?? "";
                            WriteLog($"🔍 [DEBUG] 添加固定變數 formName 到參數位置 {formNameParamName}: {nodeData.FormName ?? ""}");
                        }
                        else
                        {
                            WriteLog($"⚠️ [WARNING] 找不到 formName 對應的 parameterName，使用默認鍵 'formName'");
                            processedVariables["formName"] = nodeData.FormName ?? "";
                        }
                    }
                }
                else
                {
                    processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                    
                    // 舊的 variables 模式：無條件添加（向後兼容）
                    processedVariables["formUrl"] = eFormInstance.FormUrl;
                    processedVariables["formName"] = nodeData.FormName ?? "";
                }
                
                // 從 nodeData 讀取 templateHeaderUrl 等字段（優先從 stepExec.InputJson 讀取）
                var (templateHeaderUrl, templateHeaderType, templateHeaderFilename) = GetTemplateHeaderInfo(nodeData, stepExec);
                
                // 發送模板訊息
                messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                    nodeData.To,
                    nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null,
                    nodeData.TemplateId,
                    nodeData.TemplateName,
                    processedVariables,
                    execution,
                    stepExec,
                    stepExec.Id.ToString(),
                    "sendEForm",
                    db,
                    nodeData.IsMetaTemplate,
                    nodeData.TemplateLanguage,
                    templateHeaderUrl,  // 傳遞 header URL
                    templateHeaderType,  // 傳遞 header 類型
                    templateHeaderFilename  // 傳遞 header filename
                );
                
                WriteLog($"🔍 [DEBUG] EForm 通知模板訊息發送完成，ID: {messageSendId}");
            }
        }
        else if (messageMode == "email")
        {
            // === Email 模式 ===
            WriteLog($"📧 sendEForm 使用 Email 模式");
            
            var emailConfig = nodeData.EmailConfig;
            
            // 準備額外的 body 替換（表單相關變數）
            var additionalReplacements = new Dictionary<string, string>
            {
                { "formName", nodeData.FormName ?? "" },
                { "formUrl", eFormInstance.FormUrl }
            };
            
            // 使用統一方法發送 email
            var (successCount, skipCount, failCount, emailMessageSendId) = await SendEmailNotificationsAsync(
                emailConfig,
                resolvedRecipients,
                execution,
                stepExec,
                "sendEForm",
                db,
                additionalReplacements
            );
            
            messageSendId = emailMessageSendId;
            
            WriteLog($"🔍 [DEBUG] EForm 通知發送完成，收件人數量: {resolvedRecipients.Count}");
        }
        else
        {
            WriteLog($"💬 sendEForm 使用直接訊息模式");
            
            // 構建通知消息
            string message;
            if (nodeData.UseCustomMessage && !string.IsNullOrEmpty(nodeData.MessageTemplate))
            {
                message = nodeData.MessageTemplate
                    .Replace("{formName}", nodeData.FormName ?? "")
                    .Replace("{formUrl}", eFormInstance.FormUrl);
            }
            else
            {
                message = $"您的{nodeData.FormName}已準備就緒，請點擊以下鏈接填寫：\n\n{eFormInstance.FormUrl}";
            }
            
            messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                nodeData.To,
                nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null,
                message,
                execution,
                stepExec,
                stepExec.Id.ToString(),
                "sendEForm",
                db
            );
            
            WriteLog($"🔍 [DEBUG] EForm 通知訊息發送記錄創建完成，ID: {messageSendId}");
        }
        
        WriteLog($"🔍 [DEBUG] EForm 通知發送完成，收件人數量: {resolvedRecipients.Count}");
    }
    
    // 輔助方法：處理 maxRetries 字段（將字符串轉換為整數）
    private static void ProcessMaxRetriesField(System.Text.Json.Nodes.JsonNode node)
    {
        if (node == null) return;
        
        if (node is System.Text.Json.Nodes.JsonObject obj)
        {
            if (obj.TryGetPropertyValue("maxRetries", out var maxRetriesNode))
            {
                if (maxRetriesNode != null && maxRetriesNode.GetValueKind() == JsonValueKind.String)
                {
                    var strValue = maxRetriesNode.GetValue<string>();
                    if (int.TryParse(strValue, out var intValue))
                    {
                        obj["maxRetries"] = intValue;
                    }
                }
            }
            
            // 遞歸處理所有子對象
            foreach (var property in obj)
            {
                if (property.Value != null)
                {
                    ProcessMaxRetriesField(property.Value);
                }
            }
        }
        else if (node is System.Text.Json.Nodes.JsonArray array)
        {
            foreach (var item in array)
            {
                ProcessMaxRetriesField(item);
            }
        }
    }

    // 從 nodeData 中讀取屬性（支持動態屬性）
    private string? GetNodeDataProperty(WorkflowNodeData nodeData, string propertyName)
    {
        try
        {
            // 首先嘗試從 JSON 中讀取（因為前端可能使用動態屬性）
            // nodeData 是從 JSON 反序列化的，可能包含額外的動態屬性
            var jsonString = JsonSerializer.Serialize(nodeData, new JsonSerializerOptions 
            { 
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase // 使用 camelCase 命名策略
            });
            var jsonElement = JsonSerializer.Deserialize<JsonElement>(jsonString);
            
            // 嘗試直接匹配（精確匹配）
            if (jsonElement.TryGetProperty(propertyName, out var propertyValue))
            {
                var strValue = propertyValue.GetString();
                if (!string.IsNullOrEmpty(strValue))
                {
                    WriteLog($"🔍 [DEBUG] GetNodeDataProperty: 找到屬性 '{propertyName}' = '{strValue}'");
                    return strValue;
                }
            }
            
            // 嘗試所有屬性，進行大小寫不敏感的匹配
            foreach (var prop in jsonElement.EnumerateObject())
            {
                if (string.Equals(prop.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                {
                    var strValue = prop.Value.GetString();
                    if (!string.IsNullOrEmpty(strValue))
                    {
                        WriteLog($"🔍 [DEBUG] GetNodeDataProperty: 通過大小寫不敏感匹配找到屬性 '{prop.Name}' = '{strValue}'");
                        return strValue;
                    }
                }
            }
            
            // 如果 JSON 方式失敗，嘗試使用反射獲取屬性
            var property = typeof(WorkflowNodeData).GetProperty(propertyName, 
                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.IgnoreCase);
            if (property != null)
            {
                var value = property.GetValue(nodeData);
                var strValue = value?.ToString();
                if (!string.IsNullOrEmpty(strValue))
                {
                    WriteLog($"🔍 [DEBUG] GetNodeDataProperty: 通過反射找到屬性 '{propertyName}' = '{strValue}'");
                    return strValue;
                }
            }
            
            WriteLog($"🔍 [DEBUG] GetNodeDataProperty: 未找到屬性 '{propertyName}'");
            return null;
        }
        catch (Exception ex)
        {
            WriteLog($"❌ [ERROR] GetNodeDataProperty 異常: {ex.Message}");
            return null;
        }
    }

    // 從工作流定義的原始 JSON 中讀取 Flow 配置（因為動態屬性不會在 WorkflowNodeData 中）
    private string? GetFlowConfigFromWorkflowDefinition(WorkflowExecution execution, string nodeId, string propertyName)
    {
        try
        {
            if (execution?.WorkflowDefinition == null || string.IsNullOrEmpty(execution.WorkflowDefinition.Json))
            {
                WriteLog($"🔍 [DEBUG] GetFlowConfigFromWorkflowDefinition: WorkflowDefinition 或 Json 為空");
                return null;
            }
            
            var flowData = JsonSerializer.Deserialize<JsonElement>(execution.WorkflowDefinition.Json);
            
            // 查找節點
            if (flowData.TryGetProperty("nodes", out var nodesElement))
            {
                foreach (var node in nodesElement.EnumerateArray())
                {
                    if (node.TryGetProperty("id", out var idElement) && idElement.GetString() == nodeId)
                    {
                        // 找到對應的節點，讀取 data 屬性
                        if (node.TryGetProperty("data", out var dataElement))
                        {
                            // 嘗試直接讀取屬性（camelCase）
                            if (dataElement.TryGetProperty(propertyName, out var propertyValue))
                            {
                                var strValue = propertyValue.GetString();
                                if (!string.IsNullOrEmpty(strValue))
                                {
                                    WriteLog($"🔍 [DEBUG] GetFlowConfigFromWorkflowDefinition: 從節點 {nodeId} 的 data 找到屬性 '{propertyName}' = '{strValue}'");
                                    return strValue;
                                }
                            }
                            
                            // 嘗試大小寫不敏感匹配
                            foreach (var prop in dataElement.EnumerateObject())
                            {
                                if (string.Equals(prop.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                                {
                                    var strValue = prop.Value.GetString();
                                    if (!string.IsNullOrEmpty(strValue))
                                    {
                                        WriteLog($"🔍 [DEBUG] GetFlowConfigFromWorkflowDefinition: 通過大小寫不敏感匹配找到屬性 '{prop.Name}' = '{strValue}'");
                                        return strValue;
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }
            
            WriteLog($"🔍 [DEBUG] GetFlowConfigFromWorkflowDefinition: 未找到節點 {nodeId} 或屬性 '{propertyName}'");
            return null;
        }
        catch (Exception ex)
        {
            WriteLog($"❌ [ERROR] GetFlowConfigFromWorkflowDefinition 異常: {ex.Message}");
            return null;
        }
    }

    // 從 stepExec.InputJson 中讀取 Flow 配置（因為動態屬性不會在 WorkflowNodeData 中）
    private string? GetFlowConfigFromInputJson(WorkflowStepExecution stepExec, string propertyName)
    {
        try
        {
            if (string.IsNullOrEmpty(stepExec.InputJson))
            {
                WriteLog($"🔍 [DEBUG] GetFlowConfigFromInputJson: InputJson 為空");
                return null;
            }
            
            // 輸出 InputJson 的完整內容以便調試
            WriteLog($"🔍 [DEBUG] GetFlowConfigFromInputJson: InputJson 內容: {stepExec.InputJson}");
            
            var inputJson = JsonSerializer.Deserialize<JsonElement>(stepExec.InputJson);
            
            // InputJson 的結構通常是: { "Data": { ... } }
            if (inputJson.TryGetProperty("Data", out var dataElement))
            {
                WriteLog($"🔍 [DEBUG] GetFlowConfigFromInputJson: 找到 Data 屬性");
                
                // 輸出 Data 的所有屬性名稱
                var allProps = new List<string>();
                foreach (var prop in dataElement.EnumerateObject())
                {
                    allProps.Add(prop.Name);
                }
                WriteLog($"🔍 [DEBUG] GetFlowConfigFromInputJson: Data 中的所有屬性: {string.Join(", ", allProps)}");
                
                // 嘗試直接讀取屬性（camelCase）
                if (dataElement.TryGetProperty(propertyName, out var propertyValue))
                {
                    var strValue = propertyValue.GetString();
                    if (!string.IsNullOrEmpty(strValue))
                    {
                        WriteLog($"🔍 [DEBUG] GetFlowConfigFromInputJson: 從 InputJson.Data 找到屬性 '{propertyName}' = '{strValue}'");
                        return strValue;
                    }
                }
                
                // 嘗試大小寫不敏感匹配
                foreach (var prop in dataElement.EnumerateObject())
                {
                    if (string.Equals(prop.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                    {
                        var strValue = prop.Value.GetString();
                        if (!string.IsNullOrEmpty(strValue))
                        {
                            WriteLog($"🔍 [DEBUG] GetFlowConfigFromInputJson: 通過大小寫不敏感匹配找到屬性 '{prop.Name}' = '{strValue}'");
                            return strValue;
                        }
                    }
                }
            }
            else
            {
                WriteLog($"🔍 [DEBUG] GetFlowConfigFromInputJson: InputJson 中沒有找到 Data 屬性，嘗試直接讀取");
                
                // 如果沒有 Data 屬性，嘗試直接從根級別讀取
                if (inputJson.TryGetProperty(propertyName, out var directPropertyValue))
                {
                    var strValue = directPropertyValue.GetString();
                    if (!string.IsNullOrEmpty(strValue))
                    {
                        WriteLog($"🔍 [DEBUG] GetFlowConfigFromInputJson: 從 InputJson 根級別找到屬性 '{propertyName}' = '{strValue}'");
                        return strValue;
                    }
                }
            }
            
            WriteLog($"🔍 [DEBUG] GetFlowConfigFromInputJson: 未找到屬性 '{propertyName}'");
            return null;
        }
        catch (Exception ex)
        {
            WriteLog($"❌ [ERROR] GetFlowConfigFromInputJson 異常: {ex.Message}");
            WriteLog($"❌ [ERROR] 堆棧跟踪: {ex.StackTrace}");
            return null;
        }
    }

    // 發送 Flow 給收件人（MetaFlows 模式）
    private async Task SendFlowToRecipients(
        List<ResolvedRecipient> recipients,
        string flowId,
        string flowMessageVersion,
        eFormDefinition eFormDefinition,
        WorkflowNodeData nodeData,
        WorkflowExecution execution,
        WorkflowStepExecution stepExec,
        PurpleRiceDbContext db,
        string nodeId = null)
    {
        WriteLog($"🔍 [DEBUG] 開始為 {recipients.Count} 個收件人發送 Flow");
        WriteLog($"🔍 [DEBUG] Flow ID: {flowId}");
        
        var company = await db.Companies.FindAsync(execution.WorkflowDefinition.CompanyId);
        if (company == null)
        {
            WriteLog($"❌ [ERROR] 找不到公司配置");
            throw new Exception("Company not found");
        }

        if (string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
        {
            WriteLog($"❌ [ERROR] 公司 WhatsApp 配置不完整");
            throw new Exception("WhatsApp configuration incomplete");
        }

        var parentInstanceId = Guid.NewGuid(); // 用於關聯同一批次的表單
        var instanceIds = new List<Guid>();
        
        // ✅ 為 MetaFlows 模式創建 WorkflowMessageSend 記錄
        Guid messageSendId = Guid.Empty;
        try
        {
            var flowMessage = $"MetaFlows: {nodeData.FormName ?? eFormDefinition.Name}";
            messageSendId = await _messageSendService.CreateMessageSendAsync(
                execution.Id,
                stepExec.Id,
                stepExec.Id.ToString(),
                "sendEForm",
                flowMessage,
                null, // templateId
                null, // templateName
                "whatsapp_flow", // messageType
                execution.WorkflowDefinition.CompanyId,
                "system"
            );
            
            WriteLog($"🔍 [DEBUG] MetaFlows 模式創建消息發送記錄，MessageSendId: {messageSendId}");
            
            // 添加所有收件人到 WorkflowMessageRecipients
            await _messageSendService.AddRecipientsAsync(messageSendId, recipients, "system");
        }
        catch (Exception ex)
        {
            WriteLog($"⚠️ [WARNING] 創建 MetaFlows 消息發送記錄失敗: {ex.Message}");
        }

        // 為每個收件人創建 EFormInstance 並發送 Flow
        foreach (var recipient in recipients)
        {
            try
            {
                // 創建 EFormInstance
                var instanceId = Guid.NewGuid();
                var eFormInstance = new EFormInstance
                {
                    Id = instanceId,
                    EFormDefinitionId = eFormDefinition.Id,
                    WorkflowExecutionId = execution.Id,
                    WorkflowStepExecutionId = stepExec.Id,
                    CompanyId = company.Id,
                    InstanceName = $"{nodeData.FormName ?? eFormDefinition.Name}_{recipient.RecipientName ?? recipient.PhoneNumber}_{DateTime.UtcNow:yyyyMMddHHmmss}",
                    OriginalHtmlCode = eFormDefinition.HtmlCode ?? "",
                    FilledHtmlCode = null,
                    UserMessage = null,
                    Status = "Pending",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    FillType = "MetaFlows",
                    RecipientWhatsAppNo = recipient.PhoneNumber,
                    RecipientName = recipient.RecipientName,
                    ParentInstanceId = parentInstanceId
                };

                db.EFormInstances.Add(eFormInstance);
                instanceIds.Add(instanceId);
                
                WriteLog($"🔍 [DEBUG] 為收件人 {recipient.PhoneNumber} 創建表單實例: {instanceId}");

                // 格式化電話號碼
                var formattedTo = FormatPhoneNumberForWhatsApp(recipient.PhoneNumber);
                WriteLog($"🔍 [DEBUG] 格式化電話號碼: {recipient.PhoneNumber} -> {formattedTo}");

                // 從工作流定義的原始 JSON 讀取 Flow 配置（因為動態屬性不會在 WorkflowNodeData 中）
                // 注意：前端使用 camelCase (flowHeader, flowBody, flowCta)
                string? flowHeader = null;
                string? flowBody = null;
                string? flowCta = null;
                
                if (!string.IsNullOrEmpty(nodeId))
                {
                    // 優先從工作流定義的原始 JSON 讀取
                    flowHeader = GetFlowConfigFromWorkflowDefinition(execution, nodeId, "flowHeader") ?? 
                                GetFlowConfigFromWorkflowDefinition(execution, nodeId, "FlowHeader");
                    flowBody = GetFlowConfigFromWorkflowDefinition(execution, nodeId, "flowBody") ?? 
                              GetFlowConfigFromWorkflowDefinition(execution, nodeId, "FlowBody");
                    flowCta = GetFlowConfigFromWorkflowDefinition(execution, nodeId, "flowCta") ?? 
                             GetFlowConfigFromWorkflowDefinition(execution, nodeId, "FlowCta");
                }
                
                // 如果從工作流定義讀取失敗，嘗試從 InputJson 讀取
                flowHeader = flowHeader ?? GetFlowConfigFromInputJson(stepExec, "flowHeader") ?? 
                            GetFlowConfigFromInputJson(stepExec, "FlowHeader") ?? 
                            "請填寫表單";
                flowBody = flowBody ?? GetFlowConfigFromInputJson(stepExec, "flowBody") ?? 
                          GetFlowConfigFromInputJson(stepExec, "FlowBody") ?? 
                          "請點擊下方按鈕開始填寫表單";
                flowCta = flowCta ?? GetFlowConfigFromInputJson(stepExec, "flowCta") ?? 
                         GetFlowConfigFromInputJson(stepExec, "FlowCta") ?? 
                         "填寫表單";
                
                WriteLog($"🔍 [DEBUG] 最終 Flow 配置 - Header: '{flowHeader}', Body: '{flowBody}', CTA: '{flowCta}'");
                
                // 處理流程變量注入（PV 注入）
                flowHeader = await _variableReplacementService.ReplaceVariablesAsync(flowHeader ?? "", execution.Id);
                flowBody = await _variableReplacementService.ReplaceVariablesAsync(flowBody ?? "", execution.Id);
                flowCta = await _variableReplacementService.ReplaceVariablesAsync(flowCta ?? "", execution.Id);
                
                WriteLog($"🔍 [DEBUG] PV 注入後的 Flow 配置 - Header: '{flowHeader}', Body: '{flowBody}', CTA: '{flowCta}'");
                
                // 構建包含識別資訊的 flow_token
                // 格式: WorkflowExecutionId_WorkflowStepExecutionId_EFormInstanceId
                var flowToken = $"{execution.Id}_{stepExec.Id}_{instanceId}";
                WriteLog($"🔍 [DEBUG] 構建 flow_token: {flowToken}");
                
                // ✅ 根據表單定義中的設置決定使用 Flow Template 還是直接發送 Flow
                // 如果表單定義中有 MetaFlowTemplateId，使用 Flow Template；否則使用直接發送
                string messageId;
                
                // 查找表單定義，檢查是否有 Flow Template ID
                // 注意：使用不同的變量名避免與方法參數 eFormDefinition 衝突
                var flowDefinition = await db.eFormDefinitions
                    .FirstOrDefaultAsync(f => f.MetaFlowId == flowId && 
                                             f.CompanyId == execution.WorkflowDefinition.CompanyId);
                
                if (flowDefinition != null && !string.IsNullOrEmpty(flowDefinition.MetaFlowTemplateName))
                {
                    // ✅ 檢查 Template Name 是否為有效的 sanitized 名稱（只包含小寫字母和底線）
                    // 如果包含非英文字符（如中文），說明是舊的錯誤數據，需要重新創建 Template 或使用直接 Flow
                    var templateName = flowDefinition.MetaFlowTemplateName;
                    var isValidTemplateName = System.Text.RegularExpressions.Regex.IsMatch(templateName, @"^[a-z0-9_]+$");
                    
                    if (isValidTemplateName)
                    {
                        // 使用 Flow Template 發送（用戶已選擇保存為 Template）
                        // 注意：發送消息時需要使用 Template Name，而不是 Template ID
                        WriteLog($"📤 [INFO] 使用 Flow Template 發送 Flow 消息 - Template Name: {templateName}");
                        messageId = await SendFlowTemplateMessageAsync(company, formattedTo, templateName, flowToken);
                        WriteLog($"🔍 [DEBUG] Flow Template 消息發送成功，消息 ID: {messageId}");
                    }
                    else
                    {
                        // Template Name 包含非英文字符，說明是舊的錯誤數據
                        WriteLog($"⚠️ [WARN] Template Name 包含非英文字符（可能是舊的錯誤數據），無法使用 Flow Template 發送");
                        WriteLog($"⚠️ [WARN] Template Name: {templateName}，請重新創建 Flow Template 以獲取正確的 Template Name");
                        WriteLog($"📤 [INFO] 使用直接 Flow 消息發送（Template Name 格式錯誤）");
                        messageId = await SendFlowMessageAsync(company, formattedTo, flowId, flowMessageVersion, flowHeader, flowBody, flowCta, flowToken);
                        WriteLog($"🔍 [DEBUG] Flow 消息發送成功，消息 ID: {messageId}");
                    }
                }
                else if (flowDefinition != null && !string.IsNullOrEmpty(flowDefinition.MetaFlowTemplateId))
                {
                    // 向後兼容：如果只有 Template ID 而沒有 Template Name，記錄警告
                    WriteLog($"⚠️ [WARN] 發現 Template ID 但沒有 Template Name，無法使用 Flow Template 發送，將使用直接 Flow 發送");
                    WriteLog($"📤 [INFO] 使用直接 Flow 消息發送（Template Name 缺失）");
                    messageId = await SendFlowMessageAsync(company, formattedTo, flowId, flowMessageVersion, flowHeader, flowBody, flowCta, flowToken);
                    WriteLog($"🔍 [DEBUG] Flow 消息發送成功，消息 ID: {messageId}");
                }
                else
                {
                    // 直接發送 Flow（用戶未選擇保存為 Template，或 Template 尚未創建）
                    WriteLog($"📤 [INFO] 使用直接 Flow 消息發送（未配置 Flow Template）");
                    messageId = await SendFlowMessageAsync(company, formattedTo, flowId, flowMessageVersion, flowHeader, flowBody, flowCta, flowToken);
                    WriteLog($"🔍 [DEBUG] Flow 消息發送成功，消息 ID: {messageId}");
                }

                // 注意：不再單獨發送 "Flow sent" 消息，因為 Flow 消息本身已經發送

                // 保存原始消息 ID 到 EFormInstance（用於後續關聯）
                // 注意：這裡我們暫時將消息 ID 保存到 UserMessage 字段，後續可以新增專門的字段
                // 或者可以通過 WorkflowStepExecution 關聯
                eFormInstance.UserMessage = messageId; // 臨時使用 UserMessage 字段保存消息 ID
                
                // ✅ 更新收件人狀態為已發送
                if (messageSendId != Guid.Empty)
                {
                    try
                    {
                        var recipientRecord = await db.WorkflowMessageRecipients
                            .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && 
                                                     r.PhoneNumber == recipient.PhoneNumber);
                        
                        if (recipientRecord != null)
                        {
                            await _messageSendService.UpdateRecipientStatusAsync(
                                recipientRecord.Id,
                                RecipientStatus.Sent
                            );
                            WriteLog($"🔍 [DEBUG] 已更新收件人 {recipient.PhoneNumber} 狀態為已發送");
                        }
                    }
                    catch (Exception ex)
                    {
                        WriteLog($"⚠️ [WARNING] 更新收件人狀態失敗: {ex.Message}");
                    }
                }
                
                WriteLog($"🔍 [DEBUG] 為收件人 {recipient.PhoneNumber} 發送 Flow 完成");
            }
            catch (Exception ex)
            {
                WriteLog($"❌ [ERROR] 為收件人 {recipient.PhoneNumber} 發送 Flow 失敗: {ex.Message}");
                
                // ✅ 更新收件人狀態為失敗
                if (messageSendId != Guid.Empty)
                {
                    try
                    {
                        var recipientRecord = await db.WorkflowMessageRecipients
                            .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && 
                                                     r.PhoneNumber == recipient.PhoneNumber);
                        
                        if (recipientRecord != null)
                        {
                            await _messageSendService.UpdateRecipientStatusAsync(
                                recipientRecord.Id,
                                RecipientStatus.Failed,
                                null,
                                ex.Message
                            );
                        }
                    }
                    catch (Exception updateEx)
                    {
                        WriteLog($"⚠️ [WARNING] 更新收件人失敗狀態時出錯: {updateEx.Message}");
                    }
                }
                
                // 繼續處理下一個收件人
            }
        }

        await db.SaveChangesAsync();
        
        // ✅ 更新 WorkflowMessageSend 狀態
        if (messageSendId != Guid.Empty)
        {
            try
            {
                var sentCount = await db.WorkflowMessageRecipients
                    .Where(r => r.MessageSendId == messageSendId && r.Status == "Sent")
                    .CountAsync();
                var failedCount = await db.WorkflowMessageRecipients
                    .Where(r => r.MessageSendId == messageSendId && r.Status == "Failed")
                    .CountAsync();
                
                var finalStatus = failedCount == 0 ? MessageSendStatus.Completed :
                                 sentCount == 0 ? MessageSendStatus.Failed :
                                 MessageSendStatus.PartiallyFailed;
                
                await _messageSendService.UpdateMessageSendStatusAsync(messageSendId, finalStatus);
                WriteLog($"🔍 [DEBUG] MetaFlows 消息發送完成 - 已發送: {sentCount}, 失敗: {failedCount}, 總計: {recipients.Count}");
            }
            catch (Exception ex)
            {
                WriteLog($"⚠️ [WARNING] 更新 MetaFlows 消息發送狀態失敗: {ex.Message}");
            }
        }
        
        WriteLog($"🔍 [DEBUG] 已創建 {instanceIds.Count} 個表單實例並發送 Flow");
    }

    // 發送 Flow 消息
    private async Task<string> SendFlowMessageAsync(Company company, string to, string flowId, string flowMessageVersion, string flowHeader, string flowBody, string flowCta, string flowToken = null)
    {
        try
        {
            WriteLog($"🔍 [DEBUG] 開始發送 Flow 消息");
            WriteLog($"🔍 [DEBUG] 收件人: {to}");
            WriteLog($"🔍 [DEBUG] Flow ID: {flowId}");
            WriteLog($"🔍 [DEBUG] Header: {flowHeader}");
            WriteLog($"🔍 [DEBUG] Body: {flowBody}");
            WriteLog($"🔍 [DEBUG] CTA: {flowCta}");
            WriteLog($"🔍 [DEBUG] Flow Token: {flowToken ?? "(將生成隨機 GUID)"}");

            var apiVersion = WhatsAppApiConfig.GetApiVersion();
            var url = $"https://graph.facebook.com/{apiVersion}/{company.WA_PhoneNo_ID}/messages";

            // 如果沒有提供 flowToken，生成隨機 GUID（向後兼容）
            var finalFlowToken = flowToken ?? Guid.NewGuid().ToString();

            // 構建 interactive 對象
            var interactiveObj = new Dictionary<string, object>
            {
                { "type", "flow" },
                { "header", new Dictionary<string, object> { { "type", "text" }, { "text", flowHeader } } },
                { "body", new Dictionary<string, object> { { "text", flowBody } } },
                { "action", new Dictionary<string, object>
                    {
                        { "name", "flow" },
                        { "parameters", new Dictionary<string, object>
                            {
                                { "flow_token", finalFlowToken }, // 使用包含識別資訊的 token
                                { "flow_id", flowId },
                                { "flow_cta", flowCta },
                                { "flow_message_version", flowMessageVersion } // 必需的參數：Flow 版本號
                                // 注意：flow_action_payload 是可選的，如果不需要則不包含
                            }
                        }
                    }
                }
            };

            // Footer 是可選的，如果為空則不包含
            // 注意：根據 API 要求，如果包含 footer，text 長度必須至少為 1
            // 所以我們不包含 footer 字段

            var payload = new Dictionary<string, object>
            {
                { "messaging_product", "whatsapp" },
                { "recipient_type", "individual" },
                { "to", to },
                { "type", "interactive" },
                { "interactive", interactiveObj }
            };

            var jsonPayload = JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });

            WriteLog($"🔍 [DEBUG] WhatsApp Flow API URL: {url}");
            WriteLog($"🔍 [DEBUG] WhatsApp Flow API Payload: {jsonPayload}");

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Authorization = 
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);

            var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync(url, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            WriteLog($"🔍 [DEBUG] WhatsApp Flow API Response Status: {response.StatusCode}");
            WriteLog($"🔍 [DEBUG] WhatsApp Flow API Response Content: {responseContent}");

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"WhatsApp Flow API 請求失敗: {response.StatusCode} - {responseContent}");
            }

            // 解析響應獲取消息 ID
            var responseJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
            string messageId = null;
            if (responseJson.TryGetProperty("messages", out var messages) && messages.GetArrayLength() > 0)
            {
                var firstMessage = messages[0];
                if (firstMessage.TryGetProperty("id", out var idProp))
                {
                    messageId = idProp.GetString();
                }
            }

            WriteLog($"🔍 [DEBUG] Flow 消息發送成功，消息 ID: {messageId}");
            return messageId ?? "unknown";
        }
            catch (Exception ex)
        {
            WriteLog($"❌ [ERROR] 發送 Flow 消息失敗: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// 使用 Flow Template 發送 Flow 消息（用於 24 小時窗口外）
    /// </summary>
    private async Task<string> SendFlowTemplateMessageAsync(Company company, string to, string templateId, string flowToken = null)
    {
        try
        {
            WriteLog($"🔍 [DEBUG] 開始使用 Flow Template 發送消息");
            WriteLog($"🔍 [DEBUG] 收件人: {to}");
            WriteLog($"🔍 [DEBUG] Template ID: {templateId}");
            WriteLog($"🔍 [DEBUG] Flow Token: {flowToken ?? "(將生成隨機 GUID)"}");

            var apiVersion = WhatsAppApiConfig.GetApiVersion();
            var url = $"https://graph.facebook.com/{apiVersion}/{company.WA_PhoneNo_ID}/messages";

            // 如果沒有提供 flowToken，生成隨機 GUID（向後兼容）
            var finalFlowToken = flowToken ?? Guid.NewGuid().ToString();

            // 構建 Flow Template 消息 payload
            // 根據 WhatsApp Business API 文檔，Flow Template 消息使用 template 類型
            // Flow Template 的 components 中需要包含 flow 組件，並傳遞 flow_token
            var payload = new Dictionary<string, object>
            {
                { "messaging_product", "whatsapp" },
                { "recipient_type", "individual" },
                { "to", to },
                { "type", "template" },
                { "template", new Dictionary<string, object>
                    {
                        { "name", templateId },
                        { "language", new Dictionary<string, object>
                            {
                                { "code", "zh_TW" } // 默認使用繁體中文，可以從配置中獲取
                            }
                        },
                        { "components", new[]
                            {
                                new Dictionary<string, object>
                                {
                                    { "type", "button" },
                                    { "sub_type", "flow" },
                                    { "index", "0" },
                                    { "parameters", new[]
                                        {
                                            new Dictionary<string, object>
                                            {
                                                { "type", "action" },
                                                { "action", new Dictionary<string, object>
                                                    {
                                                        { "flow_token", finalFlowToken }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };

            var jsonPayload = JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });

            WriteLog($"🔍 [DEBUG] WhatsApp Flow Template API URL: {url}");
            WriteLog($"🔍 [DEBUG] WhatsApp Flow Template API Payload: {jsonPayload}");

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Authorization = 
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);

            var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync(url, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            WriteLog($"🔍 [DEBUG] WhatsApp Flow Template API Response Status: {response.StatusCode}");
            WriteLog($"🔍 [DEBUG] WhatsApp Flow Template API Response Content: {responseContent}");

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"WhatsApp Flow Template API 請求失敗: {response.StatusCode} - {responseContent}");
            }

            // 解析響應獲取消息 ID
            var responseJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
            string messageId = null;
            if (responseJson.TryGetProperty("messages", out var messages) && messages.GetArrayLength() > 0)
            {
                var firstMessage = messages[0];
                if (firstMessage.TryGetProperty("id", out var idProp))
                {
                    messageId = idProp.GetString();
                }
            }

            WriteLog($"🔍 [DEBUG] Flow Template 消息發送成功，消息 ID: {messageId}");
            return messageId ?? "unknown";
        }
        catch (Exception ex)
        {
            WriteLog($"❌ [ERROR] 發送 Flow Template 消息失敗: {ex.Message}");
            throw;
        }
    }

    // 格式化電話號碼（用於 WhatsApp API）
    private string FormatPhoneNumberForWhatsApp(string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            return phoneNumber;
        }
        
        // 移除所有非數字字符
        var cleanedNumber = new string(phoneNumber.Where(char.IsDigit).ToArray());
        
        // 如果號碼以 0 開頭，移除開頭的 0
        if (cleanedNumber.StartsWith("0"))
        {
            cleanedNumber = cleanedNumber.Substring(1);
        }
        
        // 如果號碼不包含國家代碼，添加默認國家代碼（852 為香港）
        // 注意：這裡應該根據實際情況調整，或者從公司配置獲取
        if (!cleanedNumber.StartsWith("852") && cleanedNumber.Length < 10)
        {
            cleanedNumber = "852" + cleanedNumber;
        }
        
        return cleanedNumber;
    }
} // class WorkflowEngine
} // namespace PurpleRice.Services

namespace PurpleRice.Services
{
    // 圖形結構模型
    public class WorkflowGraph
    {
        public List<WorkflowNode> Nodes { get; set; } = new List<WorkflowNode>();
        public List<WorkflowEdge> Edges { get; set; } = new List<WorkflowEdge>();
    }
    
    public class WorkflowNode
    {
        public string Id { get; set; }
        public string Type { get; set; }
        public WorkflowNodeData Data { get; set; }
        public WorkflowPosition Position { get; set; }
    }
    
    public class WorkflowNodeData
    {
        public string Type { get; set; }
        public string TaskName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("to")]
        public string To { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("message")]
        public string Message { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("messageMode")]
        public string MessageMode { get; set; } // "direct" 或 "template"
        
        [System.Text.Json.Serialization.JsonPropertyName("templateId")]
        public string TemplateId { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("templateName")]
        public string TemplateName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("isMetaTemplate")]
        public bool IsMetaTemplate { get; set; } // 標記是否為 Meta 官方模板
        
        [System.Text.Json.Serialization.JsonPropertyName("templateLanguage")]
        public string TemplateLanguage { get; set; } // Meta 模板的語言代碼（如 zh_TW, zh_HK, en_US）
        
        // Template Header 相關屬性（用於 image/document/video header）
        [System.Text.Json.Serialization.JsonPropertyName("templateHeaderType")]
        public string TemplateHeaderType { get; set; } // "image", "document", "video"
        
        [System.Text.Json.Serialization.JsonPropertyName("templateHeaderUrl")]
        public string TemplateHeaderUrl { get; set; } // Header 媒體的 URL
        
        [System.Text.Json.Serialization.JsonPropertyName("templateHeaderFilename")]
        public string TemplateHeaderFilename { get; set; } // Document header 的文件名
        
        [System.Text.Json.Serialization.JsonPropertyName("templateHeaderImageSource")]
        public string TemplateHeaderImageSource { get; set; } // "url" 或 "instance"（僅用於 image header）
        
        [System.Text.Json.Serialization.JsonPropertyName("variables")]
        public Dictionary<string, string> Variables { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("templateVariables")]
        public List<object> TemplateVariables { get; set; } // 新的模板變數配置
        
        [System.Text.Json.Serialization.JsonPropertyName("replyType")]
        public string ReplyType { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("specifiedUsers")]
        public string SpecifiedUsers { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("recipientDetails")]
        public object RecipientDetails { get; set; }
        
        public WorkflowValidation Validation { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("sql")]
        public string Sql { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("url")]
        public string Url { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("formName")]
        public string FormName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("formId")]
        public string FormId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("aiProviderKey")]
        public string AiProviderKey { get; set; }
        
        // sendEForm 節點相關屬性
        [System.Text.Json.Serialization.JsonPropertyName("messageTemplate")]
        public string MessageTemplate { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("useCustomMessage")]
        public bool UseCustomMessage { get; set; }
        
        // sendEForm 節點運作模式
        [System.Text.Json.Serialization.JsonPropertyName("sendEFormMode")]
        public string SendEFormMode { get; set; } = "integrateWaitReply"; // 默認為整合等待用戶回覆模式
        
        [System.Text.Json.Serialization.JsonPropertyName("integratedDataSetQueryNodeId")]
        public string IntegratedDataSetQueryNodeId { get; set; }
        
        // Switch 節點相關屬性
        [System.Text.Json.Serialization.JsonPropertyName("conditionGroups")]
        public List<SwitchConditionGroup> ConditionGroups { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("defaultPath")]
        public string DefaultPath { get; set; }
        
        // QR Code 節點相關屬性
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeVariable")]
        public string QrCodeVariable { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("timeout")]
        public int? Timeout { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeSuccessMessage")]
        public string QrCodeSuccessMessage { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeSuccessMessageMode")]
        public string QrCodeSuccessMessageMode { get; set; } // "direct" 或 "template"
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeSuccessTemplateId")]
        public string QrCodeSuccessTemplateId { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeSuccessTemplateName")]
        public string QrCodeSuccessTemplateName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeSuccessIsMetaTemplate")]
        public bool QrCodeSuccessIsMetaTemplate { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeSuccessTemplateLanguage")]
        public string QrCodeSuccessTemplateLanguage { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeSuccessTemplateVariables")]
        public List<object> QrCodeSuccessTemplateVariables { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeErrorMessage")]
        public string QrCodeErrorMessage { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeErrorMessageMode")]
        public string QrCodeErrorMessageMode { get; set; } // "direct" 或 "template"
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeErrorTemplateId")]
        public string QrCodeErrorTemplateId { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeErrorTemplateName")]
        public string QrCodeErrorTemplateName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeErrorIsMetaTemplate")]
        public bool QrCodeErrorIsMetaTemplate { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeErrorTemplateLanguage")]
        public string QrCodeErrorTemplateLanguage { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("qrCodeErrorTemplateVariables")]
        public List<object> QrCodeErrorTemplateVariables { get; set; }
        
        // Wait Reply 節點相關屬性（成功訊息）
        [System.Text.Json.Serialization.JsonPropertyName("waitReplySuccessMessage")]
        public string WaitReplySuccessMessage { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplySuccessMessageMode")]
        public string WaitReplySuccessMessageMode { get; set; } // "direct" 或 "template"
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplySuccessTemplateId")]
        public string WaitReplySuccessTemplateId { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplySuccessTemplateName")]
        public string WaitReplySuccessTemplateName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplySuccessIsMetaTemplate")]
        public bool WaitReplySuccessIsMetaTemplate { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplySuccessTemplateLanguage")]
        public string WaitReplySuccessTemplateLanguage { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplySuccessTemplateVariables")]
        public List<object> WaitReplySuccessTemplateVariables { get; set; }
        
        // Wait Reply 節點相關屬性（錯誤訊息）
        [System.Text.Json.Serialization.JsonPropertyName("waitReplyErrorMessage")]
        public string WaitReplyErrorMessage { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplyErrorMessageMode")]
        public string WaitReplyErrorMessageMode { get; set; } // "direct" 或 "template"
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplyErrorTemplateId")]
        public string WaitReplyErrorTemplateId { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplyErrorTemplateName")]
        public string WaitReplyErrorTemplateName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplyErrorIsMetaTemplate")]
        public bool WaitReplyErrorIsMetaTemplate { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplyErrorTemplateLanguage")]
        public string WaitReplyErrorTemplateLanguage { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("waitReplyErrorTemplateVariables")]
        public List<object> WaitReplyErrorTemplateVariables { get; set; }
        
        // e-Form 節點相關屬性
        [System.Text.Json.Serialization.JsonPropertyName("approvalResultVariable")]
        public string ApprovalResultVariable { get; set; }
        
        // 通用 JSON 數據存儲
        [System.Text.Json.Serialization.JsonPropertyName("json")]
        public string Json { get; set; }
        
        // DataSet 查詢節點相關屬性
        [System.Text.Json.Serialization.JsonPropertyName("dataSetId")]
        public string DataSetId { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("operationType")]
        public string OperationType { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("queryConditionGroups")]
        public List<object> QueryConditionGroups { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("operationData")]
        public Dictionary<string, object> OperationData { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("operationDataFields")]
        public List<object> OperationDataFields { get; set; } // 包含 jsonKey 的完整字段信息
        
        [System.Text.Json.Serialization.JsonPropertyName("mappedFields")]
        public List<object> MappedFields { get; set; }
        
        // Email 配置
        [System.Text.Json.Serialization.JsonPropertyName("emailConfig")]
        public EmailConfig EmailConfig { get; set; }
    }
    
    // Email 配置類
    public class EmailConfig
    {
        [System.Text.Json.Serialization.JsonPropertyName("providerKey")]
        public string ProviderKey { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("subject")]
        public string Subject { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("body")]
        public string Body { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("replyTo")]
        public string ReplyTo { get; set; }
    }
    
    public class WorkflowPosition
    {
        public double X { get; set; }
        public double Y { get; set; }
    }
    
    public class WorkflowEdge
    {
        public string Id { get; set; }
        public string Source { get; set; }
        public string Target { get; set; }
        public string Type { get; set; }
        
        // 新增屬性以支持新的 workflow designer
        [System.Text.Json.Serialization.JsonPropertyName("sourceHandle")]
        public string SourceHandle { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("targetHandle")]
        public string TargetHandle { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("markerEnd")]
        public object MarkerEnd { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("data")]
        public Dictionary<string, object> Data { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("style")]
        public Dictionary<string, object> Style { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("animated")]
        public bool? Animated { get; set; }
    }
    
    public class WorkflowValidation
    {
        public bool Enabled { get; set; }
        public string ValidatorType { get; set; }
        public string Prompt { get; set; }
        public string RetryMessage { get; set; }
        
        // MaxRetries 改為可空整數，並添加字符串屬性映射（處理前端可能發送字符串的情況）
        [System.Text.Json.Serialization.JsonPropertyName("maxRetries")]
        public int? MaxRetries { get; set; }
        
        // 字符串形式的 maxRetries（用於處理前端可能發送字符串的情況）
        [System.Text.Json.Serialization.JsonIgnore]
        public string MaxRetriesFromUI { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("aiIsActive")]
        public bool? AiIsActive { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("timeIsActive")]
        public bool? TimeIsActive { get; set; }
        
        // Time Validator 相關屬性
        public int? RetryIntervalDays { get; set; }
        public int? RetryIntervalHours { get; set; }
        public int? RetryIntervalMinutes { get; set; }
        public RetryMessageConfig RetryMessageConfig { get; set; }
        public EscalationConfig EscalationConfig { get; set; }
        
        // JSON 屬性映射（處理 UI 中的欄位名稱）
        [System.Text.Json.Serialization.JsonPropertyName("retryInterval")]
        public string RetryInterval { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("retryLimit")]
        public string RetryLimitFromUI { get; set; }
        
        // 重命名標準屬性以避免衝突
        [System.Text.Json.Serialization.JsonPropertyName("retryLimitValue")]
        public int? RetryLimitValue { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("aiProviderKey")]
        public string AiProviderKey { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("aiResultVariable")]
        public string AiResultVariable { get; set; }
    }
    
    // 工作流程執行結果模型
    public class WorkflowExecutionResult
    {
        public string? Status { get; set; }
        public object? OutputData { get; set; }
    }
    
    // 輔助方法：判斷模板 ID 是否為 Meta 模板
    public static class TemplateHelper
    {
        /// <summary>
        /// 判斷模板 ID 是否為 Meta 模板
        /// </summary>
        /// <param name="templateId">模板 ID</param>
        /// <returns>如果是 Meta 模板返回 true，否則返回 false</returns>
        public static bool IsMetaTemplateId(string templateId)
        {
            if (string.IsNullOrEmpty(templateId))
                return false;

            // Meta 模板 ID 通常是純數字（如 1059722526095407）
            // 內部模板 ID 通常是 GUID 格式
            return long.TryParse(templateId, out _);
        }
    }
} // namespace PurpleRice.Services
