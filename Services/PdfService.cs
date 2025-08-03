using System.Drawing;
using System.Drawing.Imaging;
using iTextSharp.text;
using iTextSharp.text.pdf;
using System.IO;

namespace PurpleRice.Services
{
    public class PdfService
    {
        private readonly string _basePath;

        public PdfService(IWebHostEnvironment environment)
        {
            _basePath = Path.Combine(environment.ContentRootPath, "Uploads");
        }

        public string ConvertImageToPdf(string imagePath, string customerNo, string invoiceNo, string groupName)
        {
            try
            {
                // 統一 PDF 路徑：Uploads/Customer/{customerNo}/PDF/
                var pdfDir = Path.Combine(_basePath, "Customer", customerNo, "PDF");
                Directory.CreateDirectory(pdfDir);
                var pdfFileName = $"{groupName}.pdf";
                var pdfPath = Path.Combine(pdfDir, pdfFileName);

                // 使用 iTextSharp 轉換圖片為 PDF
                using (var document = new Document(PageSize.A4, 10, 10, 10, 10))
                {
                    using (var writer = PdfWriter.GetInstance(document, new FileStream(pdfPath, FileMode.Create)))
                    {
                        document.Open();
                        using (var image = System.Drawing.Image.FromFile(imagePath))
                        {
                            var pageWidth = document.PageSize.Width - 20;
                            var pageHeight = document.PageSize.Height - 20;
                            var imageWidth = image.Width;
                            var imageHeight = image.Height;
                            var scaleX = pageWidth / imageWidth;
                            var scaleY = pageHeight / imageHeight;
                            var scale = Math.Min(scaleX, scaleY);
                            var scaledWidth = imageWidth * scale;
                            var scaledHeight = imageHeight * scale;
                            var x = (pageWidth - scaledWidth) / 2 + 10;
                            var y = (pageHeight - scaledHeight) / 2 + 10;
                            var iTextImage = iTextSharp.text.Image.GetInstance(imagePath);
                            iTextImage.ScaleToFit(scaledWidth, scaledHeight);
                            iTextImage.SetAbsolutePosition(x, pageHeight - y - scaledHeight);
                            document.Add(iTextImage);
                        }
                        document.Close();
                    }
                }
                return pdfPath;
            }
            catch (Exception ex)
            {
                throw new Exception($"PDF 轉換失敗: {ex.Message}", ex);
            }
        }

        public string GetRelativePath(string fullPath)
        {
            // 返回相對於 Uploads 目錄的路徑
            if (fullPath.StartsWith(_basePath))
            {
                return fullPath.Substring(_basePath.Length).TrimStart('\\', '/');
            }
            return fullPath;
        }
    }
} 