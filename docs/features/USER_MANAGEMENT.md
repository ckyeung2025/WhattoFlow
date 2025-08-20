# 用戶管理系統

## 🎯 **功能概述**

WhattoFlow 系統的用戶管理模組提供完整的用戶認證、授權和權限管理功能，支持多租戶架構，每個公司都有獨立的用戶體系和權限控制。

## �� **認證系統**

### **1. JWT Token 認證**
```csharp
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            // 驗證用戶憑證
            var user = await ValidateUserCredentials(request.Username, request.Password);
            if (user == null)
            {
                return Unauthorized(new { success = false, message = "用戶名或密碼錯誤" });
            }
            
            // 生成 JWT Token
            var token = GenerateJwtToken(user);
            
            return Ok(new { 
                success = true, 
                token = token,
                user = new {
                    id = user.Id,
                    username = user.Username,
                    email = user.Email,
                    companyId = user.CompanyId,
                    role = user.Role
                }
            });
        }
        catch (Exception ex)
        {
            _loggingService.LogError(ex, "登錄失敗");
            return BadRequest(new { success = false, message = ex.Message });
        }
    }
}
```

### **2. Token 驗證中間件**
```csharp
public class JwtMiddleware
{
    private readonly RequestDelegate _next;
    private readonly JwtSettings _jwtSettings;
    
    public async Task InvokeAsync(HttpContext context, IUserService userService)
    {
        var token = context.Request.Headers["Authorization"]
            .FirstOrDefault()?.Split(" ").Last();
            
        if (token != null)
        {
            try
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var key = Encoding.ASCII.GetBytes(_jwtSettings.SecretKey);
                
                tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidIssuer = _jwtSettings.Issuer,
                    ValidAudience = _jwtSettings.Audience,
                    ClockSkew = TimeSpan.Zero
                }, out SecurityToken validatedToken);
                
                var jwtToken = (JwtSecurityToken)validatedToken;
                var userId = Guid.Parse(jwtToken.Claims.First(x => x.Type == "id").Value);
                
                // 設置當前用戶上下文
                context.Items["User"] = await userService.GetByIdAsync(userId);
            }
            catch
            {
                // Token 驗證失敗，但不阻止請求繼續
            }
        }
        
        await _next(context);
    }
}
```

## �� **多租戶架構**

### **1. 公司隔離**
```csharp
public class CompanyAuthorizationAttribute : AuthorizeAttribute
{
    public CompanyAuthorizationAttribute()
    {
        Policy = "CompanyAccess";
    }
}

public class CompanyAuthorizationHandler : AuthorizationHandler<CompanyAccessRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, 
        CompanyAccessRequirement requirement)
    {
        var user = context.User;
        var companyId = user.FindFirst("CompanyId")?.Value;
        
        if (string.IsNullOrEmpty(companyId))
        {
            return Task.CompletedTask;
        }
        
        // 檢查用戶是否有權限訪問當前公司
        if (HasCompanyAccess(user, companyId))
        {
            context.Succeed(requirement);
        }
        
        return Task.CompletedTask;
    }
}
```

### **2. 數據隔離**
```csharp
public class CompanyScopedService
{
    private readonly PurpleRiceDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;
    
    public async Task<IEnumerable<T>> GetCompanyDataAsync<T>() where T : class, ICompanyScoped
    {
        var companyId = GetCurrentUserCompanyId();
        return await _context.Set<T>()
            .Where(e => e.CompanyId == companyId)
            .ToListAsync();
    }
    
    private Guid GetCurrentUserCompanyId()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        return Guid.Parse(user?.FindFirst("CompanyId")?.Value ?? Guid.Empty.ToString());
    }
}
```

## 👥 **用戶角色和權限**

### **1. 角色定義**
```csharp
public enum UserRole
{
    SuperAdmin = 1,      // 超級管理員
    CompanyAdmin = 2,    // 公司管理員
    Manager = 3,         // 經理
    User = 4,            // 普通用戶
    Viewer = 5           // 只讀用戶
}

public class RolePermission
{
    public Guid Id { get; set; }
    public string Role { get; set; }
    public string Resource { get; set; }
    public string Action { get; set; }
    public bool IsAllowed { get; set; }
}
```

### **2. 權限檢查**
```csharp
public class PermissionService
{
    private readonly PurpleRiceDbContext _context;
    
    public async Task<bool> HasPermissionAsync(Guid userId, string resource, string action)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);
            
        if (user == null) return false;
        
        var permission = await _context.RolePermissions
            .FirstOrDefaultAsync(p => 
                p.Role == user.Role.Name && 
                p.Resource == resource && 
                p.Action == action);
                
        return permission?.IsAllowed ?? false;
    }
}
```

## 🖥️ **用戶管理界面**

### **1. 用戶列表組件**
```jsx
const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      message.error('獲取用戶列表失敗');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearch = (value) => {
    setSearchText(value);
    // 實現搜索邏輯
  };
  
  return (
    <div className="user-management">
      <div className="toolbar">
        <Input.Search
          placeholder="搜索用戶..."
          onSearch={handleSearch}
          style={{ width: 300 }}
        />
        <Button type="primary" icon={<PlusOutlined />}>
          新增用戶
        </Button>
      </div>
      
      <Table
        dataSource={users}
        loading={loading}
        columns={getUserColumns()}
        rowKey="id"
      />
    </div>
  );
};
```

### **2. 用戶編輯表單**
```jsx
const UserEditForm = ({ user, onSave, onCancel }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  
  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(values)
      });
      
      if (response.ok) {
        message.success('用戶更新成功');
        onSave();
      }
    } catch (error) {
      message.error('更新失敗');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Form
      form={form}
      initialValues={user}
      onFinish={handleSubmit}
      layout="vertical"
    >
      <Form.Item
        name="username"
        label="用戶名"
        rules={[{ required: true, message: '請輸入用戶名' }]}
      >
        <Input />
      </Form.Item>
      
      <Form.Item
        name="email"
        label="電子郵件"
        rules={[
          { required: true, message: '請輸入電子郵件' },
          { type: 'email', message: '請輸入有效的電子郵件' }
        ]}
      >
        <Input />
      </Form.Item>
      
      <Form.Item
        name="role"
        label="角色"
        rules={[{ required: true, message: '請選擇角色' }]}
      >
        <Select>
          <Select.Option value="CompanyAdmin">公司管理員</Select.Option>
          <Select.Option value="Manager">經理</Select.Option>
          <Select.Option value="User">普通用戶</Select.Option>
          <Select.Option value="Viewer">只讀用戶</Select.Option>
        </Select>
      </Form.Item>
      
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存
          </Button>
          <Button onClick={onCancel}>取消</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
```

## �� **安全特性**

### **1. 密碼策略**
```csharp
public class PasswordPolicy
{
    public int MinLength { get; set; } = 8;
    public bool RequireUppercase { get; set; } = true;
    public bool RequireLowercase { get; set; } = true;
    public bool RequireDigit { get; set; } = true;
    public bool RequireSpecialCharacter { get; set; } = true;
    public int MaxAgeDays { get; set; } = 90;
}

public class PasswordService
{
    public bool ValidatePassword(string password, PasswordPolicy policy)
    {
        if (password.Length < policy.MinLength) return false;
        if (policy.RequireUppercase && !password.Any(char.IsUpper)) return false;
        if (policy.RequireLowercase && !password.Any(char.IsLower)) return false;
        if (policy.RequireDigit && !password.Any(char.IsDigit)) return false;
        if (policy.RequireSpecialCharacter && !password.Any(c => !char.IsLetterOrDigit(c))) return false;
        
        return true;
    }
    
    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }
    
    public bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }
}
```

### **2. 登錄安全**
```csharp
public class LoginSecurityService
{
    private readonly IMemoryCache _cache;
    
    public async Task<bool> CheckLoginAttempts(string username, string ipAddress)
    {
        var cacheKey = $"login_attempts_{username}_{ipAddress}";
        var attempts = await _cache.GetOrCreateAsync(cacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15);
            return Task.FromResult(0);
        });
        
        if (attempts >= 5)
        {
            return false; // 超過最大嘗試次數
        }
        
        await _cache.SetAsync(cacheKey, attempts + 1, TimeSpan.FromMinutes(15));
        return true;
    }
    
    public async Task RecordFailedLogin(string username, string ipAddress)
    {
        var cacheKey = $"failed_login_{username}_{ipAddress}";
        var failedLogins = await _cache.GetOrCreateAsync(cacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
            return Task.FromResult(0);
        });
        
        await _cache.SetAsync(cacheKey, failedLogins + 1, TimeSpan.FromHours(1));
    }
}
```

## �� **審計和日誌**

### **1. 用戶活動日誌**
```csharp
public class UserActivityLog
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid CompanyId { get; set; }
    public string Action { get; set; }
    public string Resource { get; set; }
    public string Details { get; set; }
    public string IpAddress { get; set; }
    public string UserAgent { get; set; }
    public DateTime Timestamp { get; set; }
}

public class AuditService
{
    private readonly PurpleRiceDbContext _context;
    
    public async Task LogUserActivityAsync(UserActivityLog log)
    {
        _context.UserActivityLogs.Add(log);
        await _context.SaveChangesAsync();
    }
    
    public async Task<IEnumerable<UserActivityLog>> GetUserActivityAsync(
        Guid userId, DateTime? fromDate = null, DateTime? toDate = null)
    {
        var query = _context.UserActivityLogs.Where(l => l.UserId == userId);
        
        if (fromDate.HasValue)
            query = query.Where(l => l.Timestamp >= fromDate.Value);
            
        if (toDate.HasValue)
            query = query.Where(l => l.Timestamp <= toDate.Value);
            
        return await query.OrderByDescending(l => l.Timestamp).ToListAsync();
    }
}
```

## �� **部署和維護**

### **1. 環境配置**
```json
{
  "UserManagement": {
    "JwtSettings": {
      "SecretKey": "your-secret-key-here",
      "Issuer": "WhattoFlow",
      "Audience": "WhattoFlowUsers",
      "ExpirationMinutes": 1440
    },
    "PasswordPolicy": {
      "MinLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireDigit": true,
      "RequireSpecialCharacter": true,
      "MaxAgeDays": 90
    },
    "Security": {
      "MaxLoginAttempts": 5,
      "LockoutDurationMinutes": 15,
      "SessionTimeoutMinutes": 1440
    }
  }
}
```

### **2. 數據庫遷移**
```sql
-- 創建用戶表
CREATE TABLE Users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    company_id UNIQUEIDENTIFIER NOT NULL,
    username NVARCHAR(50) NOT NULL UNIQUE,
    email NVARCHAR(100) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) NOT NULL DEFAULT 'User',
    status NVARCHAR(20) NOT NULL DEFAULT 'Active',
    last_login_at DATETIME,
    password_changed_at DATETIME DEFAULT GETDATE(),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME,
    created_user_id UNIQUEIDENTIFIER,
    updated_user_id UNIQUEIDENTIFIER
);

-- 創建角色權限表
CREATE TABLE RolePermissions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    role NVARCHAR(20) NOT NULL,
    resource NVARCHAR(50) NOT NULL,
    action NVARCHAR(20) NOT NULL,
    is_allowed BIT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);

-- 創建用戶活動日誌表
CREATE TABLE UserActivityLogs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    company_id UNIQUEIDENTIFIER NOT NULL,
    action NVARCHAR(50) NOT NULL,
    resource NVARCHAR(50),
    details NVARCHAR(MAX),
    ip_address NVARCHAR(45),
    user_agent NVARCHAR(500),
    timestamp DATETIME DEFAULT GETDATE()
);
```

---

**最後更新**: 2025年8月20日
**系統版本**: v2.0
