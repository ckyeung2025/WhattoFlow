using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using PurpleRice.Models;
using PurpleRice.Services;

namespace PurpleRice.Services.WebhookServices
{
    /// <summary>
    /// Flow 回覆數據到 HTML 轉換器
    /// 將 WhatsApp Flows 回覆數據轉換為 HTML 格式，參考 manual fill 的實現方式
    /// </summary>
    public class FlowResponseToHtmlConverter
    {
        private readonly LoggingService _loggingService;
        private readonly IServiceProvider _serviceProvider;

        public FlowResponseToHtmlConverter(LoggingService loggingService, IServiceProvider serviceProvider)
        {
            _loggingService = loggingService;
            _serviceProvider = serviceProvider;
        }

        /// <summary>
        /// 將 Flow 回覆數據轉換為 HTML 格式
        /// </summary>
        /// <param name="originalHtml">原始 HTML 代碼</param>
        /// <param name="flowResponseData">Flow 回覆數據（已解析的 JSON 對象）</param>
        /// <param name="company">公司信息（用於下載媒體）</param>
        /// <returns>填充後的 HTML 代碼</returns>
        public async Task<string> ConvertToHtmlAsync(
            string originalHtml,
            Dictionary<string, object> flowResponseData,
            Company company)
        {
            try
            {
                _loggingService.LogInformation($"=== 開始轉換 Flow 回覆數據為 HTML ===");
                _loggingService.LogInformation($"原始 HTML 長度: {originalHtml?.Length ?? 0}");
                _loggingService.LogInformation($"Flow 回覆數據字段數: {flowResponseData.Count}");

                string filledHtml;
                
                // 如果原始 HTML 為空（Meta Flows 的情況），直接從 Flow 回覆數據生成 HTML
                if (string.IsNullOrEmpty(originalHtml))
                {
                    _loggingService.LogInformation("原始 HTML 為空，將從 Flow 回覆數據生成新的 HTML");
                    filledHtml = GenerateHtmlFromFlowResponse(flowResponseData);
                }
                else
                {
                    // 如果有原始 HTML，則填充到現有模板中
                    filledHtml = originalHtml;
                }

                // 遍歷所有 Flow 回覆字段
                foreach (var field in flowResponseData)
                {
                    // 跳過 flow_token（不需要填充到 HTML）
                    if (field.Key == "flow_token")
                    {
                        continue;
                    }

                    var fieldName = field.Key;
                    var fieldValue = field.Value;

                    _loggingService.LogInformation($"處理字段: {fieldName} = {fieldValue}");

                    // 根據字段值類型處理
                    if (fieldValue == null)
                    {
                        continue;
                    }

                    // 檢查是否是圖片字段（可能是 base64 或 media ID）
                    if (IsImageField(fieldName, fieldValue))
                    {
                        filledHtml = await FillImageField(filledHtml, fieldName, fieldValue, company);
                    }
                    // 檢查是否是布爾值（checkbox）
                    else if (fieldValue is bool boolValue)
                    {
                        filledHtml = FillCheckboxField(filledHtml, fieldName, boolValue);
                    }
                    // 檢查是否是數字或字符串
                    else
                    {
                        var stringValue = fieldValue.ToString();
                        filledHtml = FillFormField(filledHtml, fieldName, stringValue);
                    }
                }

                _loggingService.LogInformation($"✅ Flow 回覆數據轉換完成");
                _loggingService.LogInformation($"填充後 HTML 長度: {filledHtml.Length}");

                return filledHtml;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"轉換 Flow 回覆數據為 HTML 時發生錯誤: {ex.Message}", ex);
                return originalHtml ?? "";
            }
        }

        /// <summary>
        /// 填充表單字段（文本、數字、日期等）
        /// 參考 WorkflowEngine.FillFormField 方法
        /// </summary>
        private string FillFormField(string html, string fieldName, string fieldValue)
        {
            try
            {
                if (string.IsNullOrEmpty(fieldValue))
                {
                    return html;
                }

                // 轉義特殊字符
                var escapedValue = System.Security.SecurityElement.Escape(fieldValue);

                _loggingService.LogInformation($"🔍 [DEBUG] 嘗試填充欄位: {fieldName} = {fieldValue}");

                // 檢查 HTML 中是否存在該欄位
                var namePattern = $@"name\s*=\s*[""']?{Regex.Escape(fieldName)}[""']?";
                var nameRegex = new Regex(namePattern, RegexOptions.IgnoreCase);

                if (!nameRegex.IsMatch(html))
                {
                    _loggingService.LogWarning($"⚠️ [WARNING] HTML 中沒有找到 name=\"{fieldName}\" 的欄位");
                    return html;
                }

                // 定義多種表單元素的處理模式
                var patterns = new (string Element, string Pattern, string Replacement)[]
                {
                    // 1. Input 元素 (text, email, password, number, tel, url, search, hidden 等)
                    ("input", 
                     $@"(<input[^>]*name=[""']{Regex.Escape(fieldName)}[""'][^>]*?)(?=\s*>)", 
                     $@"$1 value=""{escapedValue}"""),
                    
                    // 2. Textarea 元素
                    ("textarea", 
                     $@"(<textarea[^>]*name=[""']{Regex.Escape(fieldName)}[""'][^>]*?>)(.*?)(</textarea>)", 
                     $@"$1{escapedValue}$3"),
                };

                bool fieldProcessed = false;

                // 首先嘗試處理 Select 元素
                var selectPattern = $@"(<select[^>]*name=[""']{Regex.Escape(fieldName)}[""'][^>]*?>)(.*?)(</select>)";
                var selectRegex = new Regex(selectPattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
                if (selectRegex.IsMatch(html))
                {
                    var match = selectRegex.Match(html);
                    var selectContent = match.Groups[2].Value;
                    var escapedValueForSelect = Regex.Escape(escapedValue);

                    // 查找匹配的 option 並設置 selected
                    var updatedContent = Regex.Replace(
                        selectContent,
                        $@"(<option[^>]*value=[""']{escapedValueForSelect}[""'][^>]*?)(?=\s*>)",
                        "$1 selected",
                        RegexOptions.IgnoreCase);

                    html = selectRegex.Replace(html, match.Groups[1].Value + updatedContent + match.Groups[3].Value);
                    fieldProcessed = true;
                    _loggingService.LogInformation($"✅ 成功填充 select 欄位: {fieldName}");
                }

                // 處理 Radio 元素
                if (!fieldProcessed)
                {
                    var radioPattern = $@"(<input[^>]*name=[""']{Regex.Escape(fieldName)}[""'][^>]*value=[""']{Regex.Escape(escapedValue)}[""'][^>]*?)(?=\s*>)";
                    var radioRegex = new Regex(radioPattern, RegexOptions.IgnoreCase);
                    if (radioRegex.IsMatch(html))
                    {
                        html = radioRegex.Replace(html, "$1 checked");
                        fieldProcessed = true;
                        _loggingService.LogInformation($"✅ 成功填充 radio 欄位: {fieldName}");
                    }
                }

                // 處理其他元素類型
                if (!fieldProcessed)
                {
                    foreach (var (element, pattern, replacement) in patterns)
                    {
                        var regex = new Regex(pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
                        if (regex.IsMatch(html))
                        {
                            html = regex.Replace(html, replacement);
                            fieldProcessed = true;
                            _loggingService.LogInformation($"✅ 成功填充 {element} 欄位: {fieldName}");
                            break;
                        }
                    }
                }

                if (!fieldProcessed)
                {
                    _loggingService.LogWarning($"⚠️ [WARNING] 無法處理欄位: {fieldName}，可能是不支持的類型");
                }

                return html;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"填充欄位 {fieldName} 時發生錯誤: {ex.Message}");
                return html;
            }
        }

        /// <summary>
        /// 填充複選框字段
        /// </summary>
        private string FillCheckboxField(string html, string fieldName, bool isChecked)
        {
            try
            {
                var pattern = $@"(<input[^>]*name=[""']{Regex.Escape(fieldName)}[""'][^>]*?)(?=\s*>)";
                var regex = new Regex(pattern, RegexOptions.IgnoreCase);

                if (regex.IsMatch(html))
                {
                    if (isChecked)
                    {
                        html = regex.Replace(html, "$1 checked");
                        _loggingService.LogInformation($"✅ 成功設置 checkbox 欄位 {fieldName} 為 checked");
                    }
                    else
                    {
                        // 移除 checked 屬性
                        html = regex.Replace(html, "$1");
                        _loggingService.LogInformation($"✅ 成功設置 checkbox 欄位 {fieldName} 為 unchecked");
                    }
                }
                else
                {
                    _loggingService.LogWarning($"⚠️ [WARNING] HTML 中沒有找到 name=\"{fieldName}\" 的 checkbox 欄位");
                }

                return html;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"填充 checkbox 欄位 {fieldName} 時發生錯誤: {ex.Message}");
                return html;
            }
        }

        /// <summary>
        /// 檢查是否是圖片字段
        /// </summary>
        private bool IsImageField(string fieldName, object fieldValue)
        {
            if (fieldValue == null)
            {
                return false;
            }

            var valueString = fieldValue.ToString();

            // 檢查字段名是否包含圖片相關關鍵字
            var imageKeywords = new[] { "image", "photo", "picture", "img", "photo_media_id", "image_media_id" };
            if (imageKeywords.Any(keyword => fieldName.ToLower().Contains(keyword)))
            {
                return true;
            }

            // 檢查值是否是 base64 圖片格式
            if (valueString.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            // 檢查值是否是 media ID 格式（通常以特定前綴開頭）
            if (valueString.StartsWith("media_", StringComparison.OrdinalIgnoreCase) || 
                valueString.Length > 10 && valueString.All(char.IsDigit))
            {
                // 可能是 media ID，需要進一步驗證
                return true;
            }

            return false;
        }

        /// <summary>
        /// 填充圖片字段
        /// </summary>
        private async Task<string> FillImageField(string html, string fieldName, object fieldValue, Company company)
        {
            try
            {
                var valueString = fieldValue.ToString();
                string base64Image = null;
                string mimeType = "image/png";

                // 如果已經是 base64 格式
                if (valueString.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
                {
                    _loggingService.LogInformation($"圖片字段 {fieldName} 已經是 base64 格式");
                    base64Image = valueString;
                    
                    // 提取 MIME 類型
                    var mimeMatch = Regex.Match(valueString, @"data:image/([^;]+)");
                    if (mimeMatch.Success)
                    {
                        mimeType = $"image/{mimeMatch.Groups[1].Value}";
                    }
                }
                // 如果是 media ID，需要下載
                else
                {
                    _loggingService.LogInformation($"圖片字段 {fieldName} 是 media ID，需要下載: {valueString}");
                    
                    try
                    {
                        var downloadedMedia = await DownloadWhatsAppMediaAsync(company, valueString);
                        if (downloadedMedia != null && downloadedMedia.Content != null && downloadedMedia.Content.Length > 0)
                        {
                            base64Image = Convert.ToBase64String(downloadedMedia.Content);
                            mimeType = downloadedMedia.MimeType ?? "image/png";
                            base64Image = $"data:{mimeType};base64,{base64Image}";
                            _loggingService.LogInformation($"✅ 成功下載並轉換圖片，大小: {downloadedMedia.Content.Length} bytes");
                        }
                        else
                        {
                            _loggingService.LogWarning($"⚠️ 無法下載媒體: {valueString}");
                            return html;
                        }
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogError($"下載媒體失敗: {ex.Message}");
                        return html;
                    }
                }

                if (string.IsNullOrEmpty(base64Image))
                {
                    _loggingService.LogWarning($"⚠️ 圖片數據為空");
                    return html;
                }

                // 在 HTML 中查找圖片字段並替換
                // 方法 1：查找 <img> 標籤
                var imgPattern = $@"(<img[^>]*name=[""']{Regex.Escape(fieldName)}[""'][^>]*?)(?=\s*>)";
                var imgRegex = new Regex(imgPattern, RegexOptions.IgnoreCase);
                if (imgRegex.IsMatch(html))
                {
                    html = imgRegex.Replace(html, $"$1 src=\"{base64Image}\"");
                    _loggingService.LogInformation($"✅ 成功填充 img 標籤: {fieldName}");
                    return html;
                }

                // 方法 2：查找 <input type="image"> 或 <input type="file">
                var inputPattern = $@"(<input[^>]*name=[""']{Regex.Escape(fieldName)}[""'][^>]*?)(?=\s*>)";
                var inputRegex = new Regex(inputPattern, RegexOptions.IgnoreCase);
                if (inputRegex.IsMatch(html))
                {
                    // 在該 input 後面插入 img 標籤
                    html = inputRegex.Replace(html, $"$1><img src=\"{base64Image}\" alt=\"{fieldName}\" style=\"max-width: 100%; height: auto;\" />");
                    _loggingService.LogInformation($"✅ 成功在 input 後插入 img 標籤: {fieldName}");
                    return html;
                }

                // 方法 3：如果找不到對應的字段，在表單末尾添加圖片
                _loggingService.LogWarning($"⚠️ HTML 中沒有找到 name=\"{fieldName}\" 的圖片字段，將在表單末尾添加");
                var imgTag = $"<div><label>{fieldName}:</label><img src=\"{base64Image}\" alt=\"{fieldName}\" style=\"max-width: 100%; height: auto;\" /></div>";
                
                // 在 </form> 或 </body> 之前插入
                if (html.Contains("</form>"))
                {
                    html = html.Replace("</form>", $"{imgTag}</form>");
                }
                else if (html.Contains("</body>"))
                {
                    html = html.Replace("</body>", $"{imgTag}</body>");
                }
                else
                {
                    html += imgTag;
                }

                return html;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"填充圖片欄位 {fieldName} 時發生錯誤: {ex.Message}");
                return html;
            }
        }

        /// <summary>
        /// 下載 WhatsApp 媒體
        /// </summary>
        private async Task<DownloadedMedia> DownloadWhatsAppMediaAsync(Company company, string mediaId)
        {
            try
            {
                _loggingService.LogInformation($"開始下載 WhatsApp 媒體: {mediaId}");

                if (string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    _loggingService.LogError("公司 WhatsApp 配置不完整");
                    return null;
                }

                var apiVersion = WhatsAppApiConfig.GetApiVersion();
                
                // 步驟 1：獲取媒體 URL
                var mediaUrl = $"https://graph.facebook.com/{apiVersion}/{mediaId}";
                
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);

                var response = await httpClient.GetAsync(mediaUrl);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _loggingService.LogError($"獲取媒體 URL 失敗: {response.StatusCode} - {responseContent}");
                    return null;
                }

                var mediaInfo = JsonSerializer.Deserialize<JsonElement>(responseContent);
                if (!mediaInfo.TryGetProperty("url", out var urlProp))
                {
                    _loggingService.LogError("媒體響應中沒有 url 字段");
                    return null;
                }

                var downloadUrl = urlProp.GetString();
                _loggingService.LogInformation($"媒體下載 URL: {downloadUrl}");

                // 步驟 2：下載媒體內容
                var mediaResponse = await httpClient.GetAsync(downloadUrl);
                if (!mediaResponse.IsSuccessStatusCode)
                {
                    _loggingService.LogError($"下載媒體失敗: {mediaResponse.StatusCode}");
                    return null;
                }

                var mediaBytes = await mediaResponse.Content.ReadAsByteArrayAsync();
                var mimeType = mediaResponse.Content.Headers.ContentType?.MediaType ?? "image/png";
                var fileName = mediaResponse.Content.Headers.ContentDisposition?.FileName ?? $"image_{mediaId}.png";

                _loggingService.LogInformation($"✅ 成功下載媒體，大小: {mediaBytes.Length} bytes, MIME: {mimeType}");

                return new DownloadedMedia
                {
                    Content = mediaBytes,
                    MimeType = mimeType,
                    FileName = fileName
                };
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"下載 WhatsApp 媒體失敗: {ex.Message}", ex);
                return null;
            }
        }

        /// <summary>
        /// 從 Flow 回覆數據生成 HTML（當原始 HTML 為空時使用）
        /// </summary>
        private string GenerateHtmlFromFlowResponse(Dictionary<string, object> flowResponseData)
        {
            try
            {
                _loggingService.LogInformation("開始從 Flow 回覆數據生成 HTML");

                var htmlBuilder = new System.Text.StringBuilder();
                htmlBuilder.AppendLine("<!DOCTYPE html>");
                htmlBuilder.AppendLine("<html lang=\"zh-TW\">");
                htmlBuilder.AppendLine("<head>");
                htmlBuilder.AppendLine("    <meta charset=\"UTF-8\">");
                htmlBuilder.AppendLine("    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
                htmlBuilder.AppendLine("    <title>表單回覆</title>");
                htmlBuilder.AppendLine("    <style>");
                htmlBuilder.AppendLine("        body { font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; }");
                htmlBuilder.AppendLine("        .form-container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }");
                htmlBuilder.AppendLine("        .form-field { margin-bottom: 20px; }");
                htmlBuilder.AppendLine("        .form-label { font-weight: bold; color: #333; margin-bottom: 5px; display: block; }");
                htmlBuilder.AppendLine("        .form-value { padding: 10px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; min-height: 20px; }");
                htmlBuilder.AppendLine("        .form-image { max-width: 100%; height: auto; border-radius: 4px; margin-top: 10px; }");
                htmlBuilder.AppendLine("    </style>");
                htmlBuilder.AppendLine("</head>");
                htmlBuilder.AppendLine("<body>");
                htmlBuilder.AppendLine("    <div class=\"form-container\">");
                htmlBuilder.AppendLine("        <h1>表單回覆內容</h1>");

                // 遍歷所有 Flow 回覆字段
                foreach (var field in flowResponseData)
                {
                    // 跳過 flow_token（不需要顯示）
                    if (field.Key == "flow_token")
                    {
                        continue;
                    }

                    var fieldName = field.Key;
                    var fieldValue = field.Value;

                    htmlBuilder.AppendLine("        <div class=\"form-field\">");
                    htmlBuilder.AppendLine($"            <label class=\"form-label\">{System.Security.SecurityElement.Escape(fieldName)}:</label>");

                    // 根據字段值類型處理
                    if (fieldValue == null)
                    {
                        htmlBuilder.AppendLine("            <div class=\"form-value\">（無）</div>");
                    }
                    else if (fieldValue is bool boolValue)
                    {
                        htmlBuilder.AppendLine($"            <div class=\"form-value\">{(boolValue ? "是" : "否")}</div>");
                    }
                    else if (IsImageField(fieldName, fieldValue))
                    {
                        var valueString = fieldValue.ToString();
                        if (valueString.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
                        {
                            htmlBuilder.AppendLine($"            <img src=\"{System.Security.SecurityElement.Escape(valueString)}\" alt=\"{System.Security.SecurityElement.Escape(fieldName)}\" class=\"form-image\" />");
                        }
                        else
                        {
                            htmlBuilder.AppendLine($"            <div class=\"form-value\">圖片 ID: {System.Security.SecurityElement.Escape(valueString)}</div>");
                        }
                    }
                    else
                    {
                        var stringValue = System.Security.SecurityElement.Escape(fieldValue.ToString());
                        htmlBuilder.AppendLine($"            <div class=\"form-value\">{stringValue}</div>");
                    }

                    htmlBuilder.AppendLine("        </div>");
                }

                htmlBuilder.AppendLine("    </div>");
                htmlBuilder.AppendLine("</body>");
                htmlBuilder.AppendLine("</html>");

                var html = htmlBuilder.ToString();
                _loggingService.LogInformation($"✅ 成功生成 HTML，長度: {html.Length} 字符");
                return html;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"從 Flow 回覆數據生成 HTML 時發生錯誤: {ex.Message}", ex);
                // 返回一個基本的 HTML 結構
                return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>表單回覆</title></head><body><h1>表單回覆</h1><p>無法生成表單內容</p></body></html>";
            }
        }

        private class DownloadedMedia
        {
            public byte[] Content { get; set; }
            public string MimeType { get; set; }
            public string FileName { get; set; }
        }
    }
}

