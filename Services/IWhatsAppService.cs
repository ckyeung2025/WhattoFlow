using System.Threading.Tasks;

namespace PurpleRice.Services
{
    public interface IWhatsAppService
    {
        Task<bool> SendMessageAsync(string waId, string message, string messageType = "text");
        // 可擴充更多 WhatsApp 相關方法
    }
} 