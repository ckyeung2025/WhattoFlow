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
                // 創建 QR Code 讀取器
                var reader = new BarcodeReader();
                
                // 配置讀取器選項
                var options = new DecodingOptions
                {
                    TryHarder = true,
                    PossibleFormats = new[] { BarcodeFormat.QR_CODE },
                    CharacterSet = "UTF-8"
                };
                reader.Options = options;

                // 讀取圖片
                var bitmap = new System.Drawing.Bitmap(imageStream);
                
                // 掃描 QR Code
                var result = reader.Decode(bitmap);
                
                if (result != null)
                {
                    _logger.LogInformation("QR Code scanned successfully: {Text}", result.Text);
                    return result.Text;
                }
                else
                {
                    _logger.LogWarning("No QR Code found in the image");
                    return null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error scanning QR code from stream");
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
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var guid = Guid.NewGuid().ToString("N")[..8]; // 取前8位
                var fileName = $"qr_scan_{status}_{timestamp}_{guid}.jpg";
                
                var filePath = Path.Combine(uploadsPath, fileName);
                _logger.LogInformation("Target file path: {FilePath}", filePath);

                // 保存圖片文件
                await System.IO.File.WriteAllBytesAsync(filePath, imageData);
                _logger.LogInformation("QR Code image saved successfully: {FilePath}", filePath);
                
                return filePath;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save QR Code image for execution: {ExecutionId}, Status: {Status}", executionId, status);
                throw;
            }
        }
    }
}
