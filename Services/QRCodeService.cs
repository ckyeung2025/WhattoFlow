using System;
using System.IO;
using System.Threading.Tasks;
using ZXing;
using ZXing.Common;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting;

namespace PurpleRice.Services
{
    public interface IQRCodeService
    {
        Task<string> ScanQRCodeAsync(byte[] imageData);
        Task<string> ScanQRCodeAsync(Stream imageStream);
        Task<string> ScanQRCodeAndSaveImageAsync(byte[] imageData, int executionId);
        Task<(string qrCodeValue, string imagePath)> ScanQRCodeAndSaveImageWithResultAsync(byte[] imageData, int executionId);
    }

    public class QRCodeService : IQRCodeService
    {
        private readonly ILogger<QRCodeService> _logger;
        private readonly IWebHostEnvironment _environment;

        public QRCodeService(ILogger<QRCodeService> logger, IWebHostEnvironment environment)
        {
            _logger = logger;
            _environment = environment;
        }

        public async Task<string> ScanQRCodeAsync(byte[] imageData)
        {
            try
            {
                using var stream = new MemoryStream(imageData);
                return await ScanQRCodeAsync(stream);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error scanning QR code from byte array");
                throw;
            }
        }

        public async Task<string> ScanQRCodeAsync(Stream imageStream)
        {
            try
            {
                // 讀取圖片
                var bitmap = new System.Drawing.Bitmap(imageStream);
                
                // 嘗試多種掃描策略
                var strategies = new[]
                {
                    // 策略 1: 標準掃描，支援所有常見 2D 條碼格式
                    new DecodingOptions
                    {
                        TryHarder = true,
                        PureBarcode = false,
                        PossibleFormats = new[] 
                        { 
                            BarcodeFormat.QR_CODE,
                            BarcodeFormat.DATA_MATRIX,  // 香港政府常用
                            BarcodeFormat.PDF_417,
                            BarcodeFormat.AZTEC
                        },
                        CharacterSet = "UTF-8"
                    },
                    
                    // 策略 2: 純條碼模式 - 假設圖片只有條碼沒有其他內容
                    new DecodingOptions
                    {
                        TryHarder = true,
                        PureBarcode = true,
                        PossibleFormats = new[] 
                        { 
                            BarcodeFormat.DATA_MATRIX,  // Data Matrix 優先
                            BarcodeFormat.QR_CODE,
                            BarcodeFormat.PDF_417,
                            BarcodeFormat.AZTEC
                        },
                        CharacterSet = "UTF-8"
                    },
                    
                    // 策略 3: 只掃 Data Matrix（香港政府文件最常用）
                    new DecodingOptions
                    {
                        TryHarder = true,
                        PureBarcode = false,
                        PossibleFormats = new[] 
                        { 
                            BarcodeFormat.DATA_MATRIX
                        },
                        CharacterSet = "UTF-8"
                    }
                };
                
                // 依次嘗試各種策略
                foreach (var options in strategies)
                {
                    try
                    {
                        var reader = new BarcodeReader();
                        reader.Options = options;
                        
                        var result = reader.Decode(bitmap);
                        
                        if (result != null)
                        {
                            _logger.LogInformation("條碼掃描成功 - 格式: {Format}, 內容: {Text}", 
                                result.BarcodeFormat, result.Text);
                            return result.Text;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug(ex, "此策略掃描失敗，嘗試下一個策略");
                        // 繼續嘗試下一個策略
                    }
                }
                
                _logger.LogWarning("使用所有策略後仍未找到條碼");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "掃描條碼時發生錯誤");
                throw;
            }
        }

        public async Task<string> ScanQRCodeAndSaveImageAsync(byte[] imageData, int executionId)
        {
            _logger.LogInformation("Starting QR Code scan and save for execution: {ExecutionId}", executionId);
            
            try
            {
                // 先嘗試掃描 QR Code
                string scannedValue = null;
                using var stream = new MemoryStream(imageData);
                scannedValue = await ScanQRCodeAsync(stream);
                
                _logger.LogInformation("QR Code scan completed for execution: {ExecutionId}, Result: {Result}", 
                    executionId, scannedValue ?? "null");
                
                // 根據掃描結果保存圖片
                string status = scannedValue != null ? "success" : "failure";
                _logger.LogInformation("Saving image with status: {Status} for execution: {ExecutionId}", status, executionId);
                
                string savedImagePath = await SaveQRCodeImageAsync(executionId, imageData, status);
                _logger.LogInformation("QR Code image saved to: {ImagePath}, Status: {Status}", savedImagePath, status);

                return savedImagePath; // 返回保存的圖片路徑而不是掃描結果
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error scanning QR code for execution: {ExecutionId}", executionId);
                
                // 即使發生異常也要保存圖片
                try
                {
                    _logger.LogInformation("Attempting to save error image for execution: {ExecutionId}", executionId);
                    string savedImagePath = await SaveQRCodeImageAsync(executionId, imageData, "error");
                    _logger.LogInformation("QR Code error image saved to: {ImagePath}", savedImagePath);
                    return savedImagePath;
                }
                catch (Exception saveEx)
                {
                    _logger.LogError(saveEx, "Failed to save QR Code error image for execution: {ExecutionId}", executionId);
                    throw;
                }
            }
        }

        public async Task<(string qrCodeValue, string imagePath)> ScanQRCodeAndSaveImageWithResultAsync(byte[] imageData, int executionId)
        {
            _logger.LogInformation("Starting QR Code scan and save with result for execution: {ExecutionId}", executionId);
            
            try
            {
                // 先嘗試掃描 QR Code
                string scannedValue = null;
                using var stream = new MemoryStream(imageData);
                scannedValue = await ScanQRCodeAsync(stream);
                
                _logger.LogInformation("QR Code scan completed for execution: {ExecutionId}, Result: {Result}", 
                    executionId, scannedValue ?? "null");
                
                // 根據掃描結果保存圖片
                string status = scannedValue != null ? "success" : "failure";
                _logger.LogInformation("Saving image with status: {Status} for execution: {ExecutionId}", status, executionId);
                
                string savedImagePath = await SaveQRCodeImageAsync(executionId, imageData, status);
                _logger.LogInformation("QR Code image saved to: {ImagePath}, Status: {Status}", savedImagePath, status);

                return (scannedValue, savedImagePath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error scanning QR code for execution: {ExecutionId}", executionId);
                
                // 即使發生異常也要保存圖片
                try
                {
                    _logger.LogInformation("Attempting to save error image for execution: {ExecutionId}", executionId);
                    string savedImagePath = await SaveQRCodeImageAsync(executionId, imageData, "error");
                    _logger.LogInformation("QR Code error image saved to: {ImagePath}", savedImagePath);
                    return (null, savedImagePath);
                }
                catch (Exception saveEx)
                {
                    _logger.LogError(saveEx, "Failed to save QR Code error image for execution: {ExecutionId}", executionId);
                    throw;
                }
            }
        }

        /// <summary>
        /// 保存 QR Code 圖片到指定目錄
        /// </summary>
        /// <param name="executionId">工作流程執行 ID</param>
        /// <param name="imageData">圖片數據</param>
        /// <param name="status">掃描狀態 (success/failure/error)</param>
        /// <returns>保存的圖片路徑</returns>
        private async Task<string> SaveQRCodeImageAsync(int executionId, byte[] imageData, string status)
        {
            _logger.LogInformation("Starting to save QR Code image for execution: {ExecutionId}, Status: {Status}", executionId, status);
            
            try
            {
                // 創建目錄結構：Uploads\Whatsapp_Images\{executionId}
                if (executionId <= 0)
                {
                    throw new ArgumentException("ExecutionId must be greater than 0", nameof(executionId));
                }
                
                string directoryName = executionId.ToString();
                var uploadsPath = Path.Combine(_environment.ContentRootPath, "Uploads", "Whatsapp_Images", directoryName);
                _logger.LogInformation("Target directory: {Directory}", uploadsPath);
                
                if (!Directory.Exists(uploadsPath))
                {
                    Directory.CreateDirectory(uploadsPath);
                    _logger.LogInformation("Created directory for QR Code images: {Directory}", uploadsPath);
                }
                else
                {
                    _logger.LogInformation("Directory already exists: {Directory}", uploadsPath);
                }

                // 生成文件名：使用時間戳和 GUID 確保唯一性
                var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                var guid = Guid.NewGuid().ToString("N")[..8]; // 取前8位
                var fileName = $"qr_scan_{status}_{timestamp}_{guid}.jpg";
                
                var filePath = Path.Combine(uploadsPath, fileName);
                _logger.LogInformation("Target file path: {FilePath}", filePath);

                // 保存圖片文件
                await System.IO.File.WriteAllBytesAsync(filePath, imageData);
                _logger.LogInformation("QR Code image saved successfully: {FilePath}", filePath);
                
                // ✅ 返回相對 URL 路徑而不是絕對路徑，以便前端可以直接使用
                var relativeUrl = $"/Uploads/Whatsapp_Images/{directoryName}/{fileName}";
                _logger.LogInformation("Returning relative URL: {RelativeUrl}", relativeUrl);
                return relativeUrl;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save QR Code image for execution: {ExecutionId}, Status: {Status}", executionId, status);
                throw;
            }
        }
    }
}
