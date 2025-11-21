using System;
using System.IO;
using System.Threading.Tasks;
using ZXing;
using ZXing.Common;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;

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
            Bitmap bitmap = null;
            try
            {
                // 讀取圖片
                bitmap = new Bitmap(imageStream);
                
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
                
                // 依次嘗試各種策略，每個都啟用 AutoRotate 和 TryInverted
                foreach (var options in strategies)
                {
                    try
                    {
                        var reader = new BarcodeReader
                        {
                            AutoRotate = true,      // ✅ 添加自動旋轉，處理旋轉的圖片
                            TryInverted = true,     // ✅ 添加嘗試反色，處理反色的 QR code
                            Options = options
                        };
                        
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
                
                // ✅ 如果標準掃描失敗，嘗試多種圖片預處理後再掃描（適用於拍照螢幕、收據等情況）
                _logger.LogInformation("標準掃描失敗，嘗試多種圖片預處理後重新掃描");
                
                // 定義多種預處理方法
                var preprocessingMethods = new Func<Bitmap, Bitmap>[]
                {
                    EnhanceContrastAndBrightness,      // 策略 1: 增強對比度和亮度
                    ConvertToGrayscaleAndEnhance,     // 策略 2: 灰度轉換並增強對比度
                    BinarizeImage,                     // 策略 3: 二值化處理（黑白轉換）
                    EnhanceContrastStrong              // 策略 4: 強對比度增強
                };
                
                foreach (var preprocessMethod in preprocessingMethods)
                {
                    Bitmap enhancedBitmap = null;
                    try
                    {
                        enhancedBitmap = preprocessMethod(bitmap);
                        _logger.LogInformation("嘗試預處理方法: {MethodName}", preprocessMethod.Method.Name);
                        
                        foreach (var options in strategies)
                        {
                            try
                            {
                                var reader = new BarcodeReader
                                {
                                    AutoRotate = true,
                                    TryInverted = true,
                                    Options = options
                                };
                                
                                var result = reader.Decode(enhancedBitmap);
                                
                                if (result != null)
                                {
                                    _logger.LogInformation("圖片預處理後掃描成功 - 方法: {MethodName}, 格式: {Format}, 內容: {Text}", 
                                        preprocessMethod.Method.Name, result.BarcodeFormat, result.Text);
                                    enhancedBitmap.Dispose();
                                    return result.Text;
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogDebug(ex, "預處理方法 {MethodName} 後此策略掃描失敗", preprocessMethod.Method.Name);
                            }
                        }
                        
                        enhancedBitmap?.Dispose();
                    }
                    catch (Exception preprocessEx)
                    {
                        _logger.LogDebug(preprocessEx, "預處理方法 {MethodName} 失敗，嘗試下一個", preprocessMethod.Method.Name);
                        enhancedBitmap?.Dispose();
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
            finally
            {
                bitmap?.Dispose();
            }
        }

        /// <summary>
        /// 預處理方法 1: 增強對比度和亮度，提高拍照螢幕的 QR code 識別率
        /// </summary>
        private Bitmap EnhanceContrastAndBrightness(Bitmap original)
        {
            var enhanced = new Bitmap(original.Width, original.Height);
            
            using (var graphics = Graphics.FromImage(enhanced))
            {
                // 設置高品質渲染
                graphics.CompositingQuality = CompositingQuality.HighQuality;
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                graphics.SmoothingMode = SmoothingMode.HighQuality;
                
                // 創建顏色矩陣來調整對比度和亮度
                // 增強對比度（1.5倍）和稍微增加亮度（0.1）
                var colorMatrix = new ColorMatrix(new float[][]
                {
                    new float[] { 1.5f, 0, 0, 0, 0 },      // Red - 增強對比度
                    new float[] { 0, 1.5f, 0, 0, 0 },      // Green
                    new float[] { 0, 0, 1.5f, 0, 0 },      // Blue
                    new float[] { 0, 0, 0, 1, 0 },         // Alpha
                    new float[] { 0.1f, 0.1f, 0.1f, 0, 1 } // 稍微增加亮度
                });
                
                var imageAttributes = new ImageAttributes();
                imageAttributes.SetColorMatrix(colorMatrix);
                
                var rect = new Rectangle(0, 0, original.Width, original.Height);
                graphics.DrawImage(original, rect, 0, 0, original.Width, original.Height, 
                    GraphicsUnit.Pixel, imageAttributes);
            }
            
            return enhanced;
        }

        /// <summary>
        /// 預處理方法 2: 轉換為灰度並增強對比度，適用於彩色圖片中的 QR code
        /// </summary>
        private Bitmap ConvertToGrayscaleAndEnhance(Bitmap original)
        {
            var enhanced = new Bitmap(original.Width, original.Height);
            
            using (var graphics = Graphics.FromImage(enhanced))
            {
                graphics.CompositingQuality = CompositingQuality.HighQuality;
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                graphics.SmoothingMode = SmoothingMode.HighQuality;
                
                // 先轉換為灰度
                var grayMatrix = new ColorMatrix(new float[][]
                {
                    new float[] { 0.299f, 0.299f, 0.299f, 0, 0 },      // Red 轉灰度
                    new float[] { 0.587f, 0.587f, 0.587f, 0, 0 },      // Green 轉灰度
                    new float[] { 0.114f, 0.114f, 0.114f, 0, 0 },      // Blue 轉灰度
                    new float[] { 0, 0, 0, 1, 0 },                      // Alpha
                    new float[] { 0, 0, 0, 0, 1 }                       // 亮度調整
                });
                
                // 然後增強對比度
                var contrastMatrix = new ColorMatrix(new float[][]
                {
                    new float[] { 2.2f, 0, 0, 0, 0 },      // 增強對比度
                    new float[] { 0, 2.2f, 0, 0, 0 },
                    new float[] { 0, 0, 2.2f, 0, 0 },
                    new float[] { 0, 0, 0, 1, 0 },
                    new float[] { -0.15f, -0.15f, -0.15f, 0, 1 } // 稍微降低亮度以增強對比
                });
                
                // 組合兩個矩陣
                var combinedMatrix = new ColorMatrix(new float[][]
                {
                    new float[] { 0.658f, 0.658f, 0.658f, 0, 0 },     // 灰度轉換後的對比度增強
                    new float[] { 1.291f, 1.291f, 1.291f, 0, 0 },
                    new float[] { 0.251f, 0.251f, 0.251f, 0, 0 },
                    new float[] { 0, 0, 0, 1, 0 },
                    new float[] { -0.15f, -0.15f, -0.15f, 0, 1 }
                });
                
                var imageAttributes = new ImageAttributes();
                imageAttributes.SetColorMatrix(combinedMatrix);
                
                var rect = new Rectangle(0, 0, original.Width, original.Height);
                graphics.DrawImage(original, rect, 0, 0, original.Width, original.Height, 
                    GraphicsUnit.Pixel, imageAttributes);
            }
            
            return enhanced;
        }

        /// <summary>
        /// 預處理方法 3: 二值化處理（黑白轉換），適用於低對比度圖片
        /// </summary>
        private Bitmap BinarizeImage(Bitmap original)
        {
            var binarized = new Bitmap(original.Width, original.Height);
            
            // 使用 LockBits 提高性能
            var rect = new Rectangle(0, 0, original.Width, original.Height);
            var originalData = original.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
            var binarizedData = binarized.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
            
            unsafe
            {
                byte* originalPtr = (byte*)originalData.Scan0;
                byte* binarizedPtr = (byte*)binarizedData.Scan0;
                int stride = originalData.Stride;
                
                // 計算自適應閾值（使用 Otsu 方法簡化版）
                int threshold = CalculateAdaptiveThreshold(original, originalData);
                
                for (int y = 0; y < original.Height; y++)
                {
                    byte* originalRow = originalPtr + (y * stride);
                    byte* binarizedRow = binarizedPtr + (y * stride);
                    
                    for (int x = 0; x < original.Width; x++)
                    {
                        int index = x * 3;
                        
                        // 計算灰度值
                        int gray = (int)(originalRow[index + 2] * 0.299 + 
                                        originalRow[index + 1] * 0.587 + 
                                        originalRow[index] * 0.114);
                        
                        // 二值化
                        byte value = (byte)(gray > threshold ? 255 : 0);
                        
                        // 設置 RGB 值（黑白）
                        binarizedRow[index] = value;     // B
                        binarizedRow[index + 1] = value; // G
                        binarizedRow[index + 2] = value; // R
                    }
                }
            }
            
            original.UnlockBits(originalData);
            binarized.UnlockBits(binarizedData);
            
            return binarized;
        }

        /// <summary>
        /// 計算自適應閾值（簡化版 Otsu 方法）
        /// </summary>
        private int CalculateAdaptiveThreshold(Bitmap bitmap, BitmapData bitmapData)
        {
            int[] histogram = new int[256];
            
            unsafe
            {
                byte* ptr = (byte*)bitmapData.Scan0;
                int stride = bitmapData.Stride;
                
                for (int y = 0; y < bitmap.Height; y++)
                {
                    byte* row = ptr + (y * stride);
                    for (int x = 0; x < bitmap.Width; x++)
                    {
                        int index = x * 3;
                        int gray = (int)(row[index + 2] * 0.299 + 
                                        row[index + 1] * 0.587 + 
                                        row[index] * 0.114);
                        histogram[gray]++;
                    }
                }
            }
            
            // 簡化版：使用中位數作為閾值
            int totalPixels = bitmap.Width * bitmap.Height;
            int sum = 0;
            int threshold = 128; // 默認值
            
            for (int i = 0; i < 256; i++)
            {
                sum += histogram[i];
                if (sum >= totalPixels / 2)
                {
                    threshold = i;
                    break;
                }
            }
            
            return threshold;
        }

        /// <summary>
        /// 預處理方法 4: 強對比度增強，適用於非常模糊的圖片
        /// </summary>
        private Bitmap EnhanceContrastStrong(Bitmap original)
        {
            var enhanced = new Bitmap(original.Width, original.Height);
            
            using (var graphics = Graphics.FromImage(enhanced))
            {
                graphics.CompositingQuality = CompositingQuality.HighQuality;
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                graphics.SmoothingMode = SmoothingMode.HighQuality;
                
                // 強對比度增強（2.5倍）
                var colorMatrix = new ColorMatrix(new float[][]
                {
                    new float[] { 2.5f, 0, 0, 0, 0 },      // Red - 強增強對比度
                    new float[] { 0, 2.5f, 0, 0, 0 },      // Green
                    new float[] { 0, 0, 2.5f, 0, 0 },      // Blue
                    new float[] { 0, 0, 0, 1, 0 },         // Alpha
                    new float[] { -0.3f, -0.3f, -0.3f, 0, 1 } // 降低亮度以增強對比
                });
                
                var imageAttributes = new ImageAttributes();
                imageAttributes.SetColorMatrix(colorMatrix);
                
                var rect = new Rectangle(0, 0, original.Width, original.Height);
                graphics.DrawImage(original, rect, 0, 0, original.Width, original.Height, 
                    GraphicsUnit.Pixel, imageAttributes);
            }
            
            return enhanced;
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
