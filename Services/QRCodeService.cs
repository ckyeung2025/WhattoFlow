using System;
using System.IO;
using System.Threading.Tasks;
using ZXing;
using ZXing.Common;
using Microsoft.Extensions.Logging;

namespace PurpleRice.Services
{
    public interface IQRCodeService
    {
        Task<string> ScanQRCodeAsync(byte[] imageData);
        Task<string> ScanQRCodeAsync(Stream imageStream);
    }

    public class QRCodeService : IQRCodeService
    {
        private readonly ILogger<QRCodeService> _logger;

        public QRCodeService(ILogger<QRCodeService> logger)
        {
            _logger = logger;
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
    }
}
