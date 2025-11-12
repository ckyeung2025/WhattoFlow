using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Linq;
using System.Collections.Generic;
using System.IO;

namespace PurpleRice.Services
{
    public class DocumentConverterService
    {
        private readonly ILogger<DocumentConverterService> _logger;
        private readonly string _libreOfficePath;

        public DocumentConverterService(ILogger<DocumentConverterService> logger)
        {
            _logger = logger;
            _libreOfficePath = FindLibreOfficePathSync();
        }

        /// <summary>
        /// 轉換各種文檔格式到 HTML
        /// </summary>
        /// <param name="filePath">輸入文件路徑</param>
        /// <param name="eFormId">E-Form ID，用於組織文件結構</param>
        /// <returns>HTML 內容</returns>
        public async Task<string> ConvertToHtml(string filePath, string eFormId = null)
        {
            try
            {
                _logger.LogInformation($"開始轉換文檔: {filePath}");

                if (!File.Exists(filePath))
                {
                    throw new FileNotFoundException($"文件不存在: {filePath}");
                }

                // 確定輸出目錄 - 直接使用文件所在目錄，因為文件已經在正確的 e-form ID 目錄中
                var outputDir = Path.GetDirectoryName(filePath);

                var fileName = Path.GetFileNameWithoutExtension(filePath);
                var outputPath = Path.Combine(outputDir, $"{fileName}.html");

                // 清理舊的輸出文件
                if (File.Exists(outputPath))
                {
                    File.Delete(outputPath);
                }

                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = _libreOfficePath,
                        Arguments = $"--headless --convert-to html \"{filePath}\" --outdir \"{outputDir}\"",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true,
                        StandardOutputEncoding = Encoding.UTF8,
                        StandardErrorEncoding = Encoding.UTF8
                    }
                };

                _logger.LogInformation($"執行 LibreOffice 命令: {process.StartInfo.FileName} {process.StartInfo.Arguments}");

                process.Start();

                // 設置超時時間為 5 分鐘
                var timeoutTask = Task.Delay(TimeSpan.FromMinutes(5));
                var processTask = process.WaitForExitAsync();
                
                var completedTask = await Task.WhenAny(processTask, timeoutTask);
                
                if (completedTask == timeoutTask)
                {
                    // 超時，終止進程
                    try
                    {
                        if (!process.HasExited)
                        {
                            process.Kill();
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"終止 LibreOffice 進程時發生錯誤: {ex.Message}");
                    }
                    throw new TimeoutException("LibreOffice 轉換超時，請檢查文件是否過大或格式是否支持");
                }

                var output = await process.StandardOutput.ReadToEndAsync();
                var error = await process.StandardError.ReadToEndAsync();

                _logger.LogInformation($"LibreOffice 轉換完成，退出碼: {process.ExitCode}");
                if (!string.IsNullOrEmpty(output))
                {
                    _logger.LogInformation($"LibreOffice 輸出: {output}");
                }
                if (!string.IsNullOrEmpty(error))
                {
                    _logger.LogWarning($"LibreOffice 錯誤: {error}");
                }

                if (process.ExitCode != 0)
                {
                    throw new Exception($"LibreOffice 轉換失敗，退出碼: {process.ExitCode}, 錯誤: {error}");
                }

                // 等待文件生成
                var retryCount = 0;
                while (!File.Exists(outputPath) && retryCount < 10)
                {
                    await Task.Delay(500);
                    retryCount++;
                }

                if (!File.Exists(outputPath))
                {
                    throw new Exception($"轉換後的文件不存在: {outputPath}");
                }

                var htmlContent = await File.ReadAllTextAsync(outputPath, Encoding.UTF8);
                
                
                // 後處理 HTML
                htmlContent = PostProcessHtml(htmlContent, outputDir);

                _logger.LogInformation($"文檔轉換成功，HTML 長度: {htmlContent.Length} 字符");

                return htmlContent;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"轉換文檔時發生錯誤: {filePath}");
                throw;
            }
        }

        /// <summary>
        /// 根據 HTML 內容產出純文字
        /// </summary>
        public string ConvertHtmlToPlainText(string html)
        {
            if (string.IsNullOrWhiteSpace(html))
            {
                return string.Empty;
            }

            var normalized = Regex.Replace(html, "<(br|BR|p|P|div|DIV)[^>]*>", "\n", RegexOptions.Compiled);
            normalized = Regex.Replace(normalized, "<[^>]+>", string.Empty, RegexOptions.Compiled);
            normalized = WebUtility.HtmlDecode(normalized);
            normalized = normalized.Replace("\r\n", "\n").Replace('\r', '\n');
            normalized = Regex.Replace(normalized, "[\t ]+", " ", RegexOptions.Compiled);
            normalized = Regex.Replace(normalized, "\n{2,}", "\n", RegexOptions.Compiled);
            return normalized.Trim();
        }

        /// <summary>
        /// 解析文件並輸出結構化內容（純文字、段落、表格等）
        /// </summary>
        public async Task<DocumentParseResult> ParseDocumentAsync(string filePath, string? mimeType = null, string? originalFileName = null)
        {
            var html = await ConvertToHtml(filePath);
            var plainText = ConvertHtmlToPlainText(html);
            var documentType = DetermineDocumentType(mimeType, originalFileName);

            var paragraphs = ExtractParagraphs(html);
            var tables = ExtractTables(html);

            var metadata = new Dictionary<string, object?>
            {
                ["fileName"] = originalFileName ?? Path.GetFileName(filePath),
                ["mimeType"] = mimeType ?? string.Empty,
                ["tableCount"] = tables.Count,
                ["paragraphCount"] = paragraphs.Count
            };

            // Excel / 試算表通常包含多個表格，記錄為 sheet-like 結構
            if (documentType == "excel")
            {
                metadata["sheets"] = tables.Select((table, index) => new {
                    name = $"Sheet{index + 1}",
                    rowCount = table.Rows.Count,
                    columnCount = table.Headers?.Count ?? (table.Rows.FirstOrDefault()?.Count ?? 0)
                }).ToList();
            }

            return new DocumentParseResult
            {
                DocumentType = documentType,
                PlainText = plainText,
                Paragraphs = paragraphs,
                Tables = tables,
                Metadata = metadata
            };
        }

        private string DetermineDocumentType(string? mimeType, string? fileName)
        {
            if (!string.IsNullOrWhiteSpace(mimeType))
            {
                if (mimeType.Contains("spreadsheet", StringComparison.OrdinalIgnoreCase) ||
                    mimeType.Contains("excel", StringComparison.OrdinalIgnoreCase))
                {
                    return "excel";
                }

                if (mimeType.Contains("presentation", StringComparison.OrdinalIgnoreCase) ||
                    mimeType.Contains("powerpoint", StringComparison.OrdinalIgnoreCase))
                {
                    return "presentation";
                }

                if (mimeType.Contains("word", StringComparison.OrdinalIgnoreCase) ||
                    mimeType.Contains("document", StringComparison.OrdinalIgnoreCase))
                {
                    return "word";
                }

                if (mimeType.Contains("pdf", StringComparison.OrdinalIgnoreCase))
                {
                    return "pdf";
                }
            }

            var extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
            return extension switch
            {
                ".xls" or ".xlsx" or ".ods" => "excel",
                ".ppt" or ".pptx" or ".odp" => "presentation",
                ".doc" or ".docx" or ".odt" or ".rtf" => "word",
                ".pdf" => "pdf",
                ".txt" => "text",
                _ => "document"
            };
        }

        private List<string> ExtractParagraphs(string html)
        {
            var paragraphs = new List<string>();
            if (string.IsNullOrWhiteSpace(html))
            {
                return paragraphs;
            }

            var paragraphMatches = Regex.Matches(html, "<p[^>]*>(.*?)</p>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
            foreach (Match match in paragraphMatches)
            {
                var text = WebUtility.HtmlDecode(Regex.Replace(match.Groups[1].Value, "<[^>]+>", string.Empty)).Trim();
                if (!string.IsNullOrWhiteSpace(text))
                {
                    paragraphs.Add(text);
                }
            }

            // 如果沒有 <p>，回退到根據行分割的純文字
            if (paragraphs.Count == 0)
            {
                var plain = ConvertHtmlToPlainText(html);
                paragraphs = plain.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrWhiteSpace(p))
                    .ToList();
            }

            return paragraphs;
        }

        private List<DocumentTable> ExtractTables(string html)
        {
            var tables = new List<DocumentTable>();
            if (string.IsNullOrWhiteSpace(html))
            {
                return tables;
            }

            var tableMatches = Regex.Matches(html, "<table[^>]*>(.*?)</table>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
            foreach (Match tableMatch in tableMatches)
            {
                var tableHtml = tableMatch.Groups[1].Value;
                var headerMatch = Regex.Match(tableHtml, "<thead[^>]*>(.*?)</thead>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
                List<string>? headers = null;
                if (headerMatch.Success)
                {
                    headers = ExtractCells(headerMatch.Groups[1].Value, "th");
                }

                var rowMatches = Regex.Matches(tableHtml, "<tr[^>]*>(.*?)</tr>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
                var rows = new List<List<string>>();
                foreach (Match rowMatch in rowMatches)
                {
                    var rowHtml = rowMatch.Groups[1].Value;
                    var cells = ExtractCells(rowHtml, "td");
                    if (cells.Count == 0 && headers != null)
                    {
                        cells = ExtractCells(rowHtml, "th");
                    }

                    if (cells.Count > 0)
                    {
                        rows.Add(cells);
                    }
                }

                if (headers == null && rows.Count > 0)
                {
                    headers = rows.First();
                    rows = rows.Skip(1).ToList();
                }

                tables.Add(new DocumentTable
                {
                    Headers = headers,
                    Rows = rows
                });
            }

            return tables;
        }

        private List<string> ExtractCells(string rowHtml, string cellTag)
        {
            var pattern = $"<{cellTag}[^>]*>(.*?)</{cellTag}>";
            var matches = Regex.Matches(rowHtml, pattern, RegexOptions.Singleline | RegexOptions.IgnoreCase);
            var cells = new List<string>();
            foreach (Match match in matches)
            {
                var text = WebUtility.HtmlDecode(Regex.Replace(match.Groups[1].Value, "<[^>]+>", string.Empty)).Trim();
                cells.Add(text);
            }
            return cells;
        }

        /// <summary>
        /// 檢測 LibreOffice 安裝路徑（同步版本）
        /// </summary>
        private string FindLibreOfficePathSync()
        {
            var possiblePaths = new List<string>();

            // 優先檢查項目目錄下的 LibreOffice
            var currentDir = Directory.GetCurrentDirectory();
            var localLibreOfficePath = Path.Combine(currentDir, "LibreOffice", "program", "soffice.exe");
            var localLibreOfficeComPath = Path.Combine(currentDir, "LibreOffice", "program", "soffice.com");
            
            possiblePaths.AddRange(new[]
            {
                localLibreOfficePath,
                localLibreOfficeComPath
            });

            // Windows 系統安裝路徑
            var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            
            possiblePaths.AddRange(new[]
            {
                Path.Combine(programFiles, "LibreOffice", "program", "soffice.exe"),
                Path.Combine(programFilesX86, "LibreOffice", "program", "soffice.exe"),
                Path.Combine(programFiles, "LibreOffice", "program", "soffice.com"),
                Path.Combine(programFilesX86, "LibreOffice", "program", "soffice.com"),
                "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
                "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"
            });

            // Linux/macOS 路徑
            possiblePaths.AddRange(new[]
            {
                "/usr/bin/soffice",
                "/usr/local/bin/soffice",
                "/opt/libreoffice/program/soffice"
            });

            foreach (var path in possiblePaths)
            {
                if (File.Exists(path))
                {
                    _logger.LogInformation($"找到 LibreOffice: {path}");
                    return path;
                }
            }

            // 嘗試從 PATH 環境變量中找到
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "where",
                        Arguments = "soffice",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = process.StandardOutput.ReadToEnd();
                process.WaitForExit();

                if (!string.IsNullOrEmpty(output))
                {
                    var firstPath = output.Split('\n').FirstOrDefault()?.Trim();
                    if (!string.IsNullOrEmpty(firstPath) && File.Exists(firstPath))
                    {
                        _logger.LogInformation($"從 PATH 找到 LibreOffice: {firstPath}");
                        return firstPath;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"無法從 PATH 找到 LibreOffice: {ex.Message}");
            }

            throw new Exception("未找到 LibreOffice 安裝。請確保已安裝 LibreOffice 並將其添加到系統 PATH 中。");
        }

        /// <summary>
        /// 檢測 LibreOffice 安裝路徑（異步版本）
        /// </summary>
        private async Task<string> FindLibreOfficePath()
        {
            // 首先嘗試同步版本
            try
            {
                return FindLibreOfficePathSync();
            }
            catch
            {
                                 // 如果同步版本失敗，嘗試異步版本（主要用於 PATH 搜索）
                 var possiblePaths = new List<string>();

                 // 優先檢查項目目錄下的 LibreOffice
                 var currentDir = Directory.GetCurrentDirectory();
                 var localLibreOfficePath = Path.Combine(currentDir, "LibreOffice", "program", "soffice.exe");
                 var localLibreOfficeComPath = Path.Combine(currentDir, "LibreOffice", "program", "soffice.com");
                 
                 possiblePaths.AddRange(new[]
                 {
                     localLibreOfficePath,
                     localLibreOfficeComPath
                 });

                 // Windows 系統安裝路徑
                 var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
                 var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
                 
                 possiblePaths.AddRange(new[]
                 {
                     Path.Combine(programFiles, "LibreOffice", "program", "soffice.exe"),
                     Path.Combine(programFilesX86, "LibreOffice", "program", "soffice.exe"),
                     Path.Combine(programFiles, "LibreOffice", "program", "soffice.com"),
                     Path.Combine(programFilesX86, "LibreOffice", "program", "soffice.com"),
                     "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
                     "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"
                 });

                 // Linux/macOS 路徑
                 possiblePaths.AddRange(new[]
                 {
                     "/usr/bin/soffice",
                     "/usr/local/bin/soffice",
                     "/opt/libreoffice/program/soffice"
                 });

                foreach (var path in possiblePaths)
                {
                    if (File.Exists(path))
                    {
                        _logger.LogInformation($"找到 LibreOffice: {path}");
                        return path;
                    }
                }

                // 嘗試從 PATH 環境變量中找到
                try
                {
                    var process = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = "where",
                            Arguments = "soffice",
                            UseShellExecute = false,
                            RedirectStandardOutput = true,
                            CreateNoWindow = true
                        }
                    };

                    process.Start();
                    var output = process.StandardOutput.ReadToEnd();
                    await process.WaitForExitAsync();

                    if (!string.IsNullOrEmpty(output))
                    {
                        var firstPath = output.Split('\n').FirstOrDefault()?.Trim();
                        if (!string.IsNullOrEmpty(firstPath) && File.Exists(firstPath))
                        {
                            _logger.LogInformation($"從 PATH 找到 LibreOffice: {firstPath}");
                            return firstPath;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"無法從 PATH 找到 LibreOffice: {ex.Message}");
                }

                throw new Exception("未找到 LibreOffice 安裝。請確保已安裝 LibreOffice 並將其添加到系統 PATH 中。");
            }
        }

        /// <summary>
        /// 後處理 HTML 內容
        /// </summary>
        private string PostProcessHtml(string html, string outputDir = null)
        {
            if (string.IsNullOrEmpty(html))
                return html;

            // 移除 LibreOffice 的默認樣式標籤
            html = html.Replace("<html xmlns=\"http://www.w3.org/1999/xhtml\">", "<html>");
            
            // 清理多餘的空白字符
            html = System.Text.RegularExpressions.Regex.Replace(html, @"\s+", " ");
            
            // 確保圖片路徑正確
            html = FixImagePaths(html, outputDir);
            
            // 添加響應式樣式
            html = AddResponsiveStyles(html);

            return html;
        }

        /// <summary>
        /// 修復圖片路徑
        /// </summary>
        private string FixImagePaths(string html, string outputDir = null)
        {
            if (string.IsNullOrEmpty(html))
                return html;


            // 修復圖片路徑，添加正確的目錄前綴
            var imgPattern = @"<img[^>]*src=[""']([^""']*_html_[^""']*\.(?:png|gif|jpg|jpeg))[""'][^>]*>";
            var matches = System.Text.RegularExpressions.Regex.Matches(html, imgPattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            foreach (System.Text.RegularExpressions.Match match in matches)
            {
                var originalSrc = match.Groups[1].Value;
                
                
                // 構建正確的圖片路徑
                string newSrc;
                if (!string.IsNullOrEmpty(outputDir))
                {
                    // 如果有輸出目錄，需要包含 e-form ID 目錄
                    var relativePath = Path.GetFileName(originalSrc);
                    var eFormId = Path.GetFileName(outputDir); // 獲取 e-form ID
                    
                    // 如果 eFormId 已經是 "Documents"，則不需要重複添加
                    if (eFormId == "Documents")
                    {
                        newSrc = $"/Uploads/FormsFiles/Documents/{relativePath}";
                    }
                    else
                    {
                        newSrc = $"/Uploads/FormsFiles/Documents/{eFormId}/{relativePath}";
                    }
                }
                else
                {
                    // 清理原始路徑，移除重複的 Documents 目錄
                    string cleanSrc = originalSrc;
                    
                    // 如果路徑以 Documents/Documents/ 開頭，移除重複的 Documents
                    if (cleanSrc.StartsWith("Documents/Documents/"))
                    {
                        cleanSrc = cleanSrc.Substring("Documents/".Length); // 移除第一個 Documents/
                    }
                    else if (cleanSrc.StartsWith("Documents/"))
                    {
                        // 如果只包含一個 Documents/，保持不變
                        cleanSrc = cleanSrc;
                    }
                    else
                    {
                        // 如果沒有 Documents/，添加它
                        cleanSrc = $"Documents/{cleanSrc}";
                    }
                    
                    // 構建最終的完整路徑
                    newSrc = $"/Uploads/FormsFiles/{cleanSrc}";
                }


                // 替換 HTML 中的圖片路徑
                html = html.Replace($"src=\"{originalSrc}\"", $"src=\"{newSrc}\"");
                html = html.Replace($"src='{originalSrc}'", $"src='{newSrc}'");
            }

            return html;
        }

        /// <summary>
        /// 添加響應式樣式
        /// </summary>
        private string AddResponsiveStyles(string html)
        {
            var responsiveStyles = @"
<style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    table, th, td { border: 1px solid #ddd; }
    th, td { padding: 8px; text-align: left; }
    img { max-width: 100%; height: auto; }
    .page { margin-bottom: 20px; }
    @media print { body { margin: 0; } }
</style>";

            // 在 head 標籤中添加樣式
            if (html.Contains("<head>"))
            {
                html = html.Replace("<head>", "<head>" + responsiveStyles);
            }
            else
            {
                html = html.Replace("<html>", "<html><head>" + responsiveStyles + "</head>");
            }

            return html;
        }

        /// <summary>
        /// 檢查支持的文件格式
        /// </summary>
        public bool IsSupportedFormat(string filePath)
        {
            var extension = Path.GetExtension(filePath).ToLowerInvariant();
            var supportedFormats = new[]
            {
                ".doc", ".docx", ".odt", ".rtf", ".txt",
                ".xls", ".xlsx", ".ods",
                ".ppt", ".pptx", ".odp",
                ".pdf"
            };

            return supportedFormats.Contains(extension);
        }
    }

    public class DocumentParseResult
    {
        public string DocumentType { get; set; } = "document";
        public string PlainText { get; set; } = string.Empty;
        public List<string> Paragraphs { get; set; } = new();
        public List<DocumentTable> Tables { get; set; } = new();
        public IDictionary<string, object?> Metadata { get; set; } = new Dictionary<string, object?>();

        public object ToStructuredObject() => new
        {
            documentType = DocumentType,
            metadata = Metadata,
            text = PlainText,
            paragraphs = Paragraphs,
            tables = Tables.Select(t => new
            {
                headers = t.Headers,
                rows = t.Rows
            }).ToList()
        };

        public string ToJson() => JsonSerializer.Serialize(ToStructuredObject(), new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        });
    }

    public class DocumentTable
    {
        public List<string>? Headers { get; set; }
        public List<List<string>> Rows { get; set; } = new();
    }
} 