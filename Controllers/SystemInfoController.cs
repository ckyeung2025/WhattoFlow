using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/system")]
    public class SystemInfoController : ControllerBase
    {
        [HttpGet("version")]
        [AllowAnonymous]
        public ActionResult<SystemVersionResponse> GetVersion()
        {
            var assembly = Assembly.GetExecutingAssembly();
            var informationalVersion = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
            var version = informationalVersion ?? assembly.GetName().Version?.ToString() ?? "dev";
            if (version.Contains('+'))
            {
                version = version.Split('+')[0];
            }

            return Ok(new SystemVersionResponse
            {
                Version = version
            });
        }
    }

    public class SystemVersionResponse
    {
        public string Version { get; set; } = string.Empty;
    }
}

