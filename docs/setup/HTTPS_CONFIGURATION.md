# HTTPS 配置指南

## 📋 概述

本文檔說明如何在 .NET production 環境中配置 HTTPS 和安裝證書。

## 🔐 證書選項

有三種方式可以配置 HTTPS 證書：

1. **使用證書文件（.pfx）** - 適合從證書頒發機構獲取的證書
2. **使用 Windows 證書存儲** - 適合已安裝在系統中的證書
3. **使用 IIS 作為反向代理** - 適合已配置 IIS 的環境

## 📦 方法一：使用證書文件（.pfx）

### 步驟 1: 獲取證書文件

從您的證書頒發機構（CA）獲取 `.pfx` 格式的證書文件，或使用 PowerShell 生成自簽名證書（僅用於測試）：

```powershell
# 生成自簽名證書（僅用於開發/測試）
$cert = New-SelfSignedCertificate `
    -DnsName "localhost", "yourdomain.com" `
    -CertStoreLocation "cert:\LocalMachine\My" `
    -NotAfter (Get-Date).AddYears(10) `
    -FriendlyName "WhattoFlow HTTPS Certificate" `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")

# 導出為 .pfx 文件（需要設置密碼）
$pwd = ConvertTo-SecureString -String "YourCertificatePassword123!" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "C:\Certificates\whattoflow.pfx" -Password $pwd
```

### 步驟 2: 配置 appsettings.json

將證書文件放在安全的位置（建議：應用程序目錄外的專用證書文件夾），然後更新配置：

```json
{
  "Ports": {
    "DotNet": 64213,
    "DotNetHttps": 64214
  },
  "Kestrel": {
    "EnableHttps": true,
    "Certificates": {
      "Default": {
        "Path": "C:\\Certificates\\whattoflow.pfx",
        "Password": "YourCertificatePassword123!",
        "Store": "",
        "Subject": "",
        "Thumbprint": ""
      }
    }
  }
}
```

### 步驟 3: 設置文件權限

確保應用程序運行帳戶有權限讀取證書文件：

```powershell
# 以管理員身份運行
$certPath = "C:\Certificates\whattoflow.pfx"
$account = "NT AUTHORITY\NETWORK SERVICE"  # 或您的服務帳戶

# 設置文件權限
icacls $certPath /grant "${account}:R"
```

## 🏪 方法二：使用 Windows 證書存儲

### 步驟 1: 安裝證書到證書存儲

#### 選項 A：通過 PowerShell 安裝

```powershell
# 以管理員身份運行 PowerShell

# 導入 .pfx 證書到 LocalMachine\My 存儲
$pfxPath = "C:\Certificates\whattoflow.pfx"
$password = ConvertTo-SecureString -String "YourCertificatePassword123!" -Force -AsPlainText

Import-PfxCertificate `
    -FilePath $pfxPath `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -Password $password `
    -Exportable

# 或者從 .cer 和 .key 文件安裝（需要額外步驟）
```

#### 選項 B：通過證書管理控制台（certlm.msc）

1. 以管理員身份運行 `certlm.msc`
2. 展開 "個人" → "證書"
3. 右鍵 "證書" → "所有任務" → "導入"
4. 選擇您的 `.pfx` 文件
5. 輸入證書密碼
6. 選擇 "將所有證書放入以下存儲" → "個人"

### 步驟 2: 查找證書信息

```powershell
# 查看已安裝的證書
Get-ChildItem -Path "Cert:\LocalMachine\My" | 
    Where-Object { $_.Subject -like "*yourdomain.com*" } | 
    Select-Object Subject, Thumbprint, NotAfter
```

記錄證書的：
- **Subject**（主體名稱，例如：CN=yourdomain.com）
- **Thumbprint**（指紋，例如：A1B2C3D4E5F6...）

### 步驟 3: 設置證書私鑰權限

```powershell
# 查找證書
$thumbprint = "A1B2C3D4E5F6..."  # 替換為您的證書指紋
$cert = Get-ChildItem -Path "Cert:\LocalMachine\My" | Where-Object { $_.Thumbprint -eq $thumbprint }

# 獲取證書的私鑰
$rsaCert = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
$fileName = $rsaCert.Key.UniqueName

# 設置私鑰文件權限
$path = "$env:ALLUSERSPROFILE\Microsoft\Crypto\RSA\MachineKeys\$fileName"
$account = "NT AUTHORITY\NETWORK SERVICE"  # 或您的服務帳戶

icacls $path /grant "${account}:R"
```

### 步驟 4: 配置 appsettings.json

使用證書存儲配置：

```json
{
  "Ports": {
    "DotNet": 64213,
    "DotNetHttps": 64214
  },
  "Kestrel": {
    "EnableHttps": true,
    "Certificates": {
      "Default": {
        "Path": "",
        "Password": "",
        "Store": "My",
        "Subject": "CN=yourdomain.com",
        "Thumbprint": "A1B2C3D4E5F6..."
      }
    }
  }
}
```

**注意**：`Subject` 和 `Thumbprint` 只需填寫其中一個即可，優先使用 `Thumbprint`（更精確）。

## 🌐 方法三：使用 IIS 作為反向代理

如果您使用 IIS 作為反向代理，可以在 IIS 層面配置 HTTPS，應用程序仍然使用 HTTP。

### 步驟 1: 安裝 IIS 和 URL Rewrite 模組

```powershell
# 安裝 IIS
Install-WindowsFeature -name Web-Server -IncludeManagementTools

# 安裝 URL Rewrite 模組（需要下載安裝）
# 下載地址：https://www.iis.net/downloads/microsoft/url-rewrite
```

### 步驟 2: 在 IIS 中綁定 HTTPS 證書

1. 打開 IIS 管理器（`inetmgr`）
2. 選擇服務器節點 → 雙擊 "服務器證書"
3. 導入或綁定證書
4. 創建或編輯網站 → 綁定 → 添加 HTTPS 綁定 → 選擇證書

### 步驟 3: 配置應用程序仍然使用 HTTP

```json
{
  "Kestrel": {
    "EnableHttps": false
  }
}
```

應用程序繼續在 HTTP 端口上運行，IIS 處理 HTTPS 終止。

## 🔧 配置說明

### appsettings.json 配置項說明

| 配置項 | 說明 | 範例 |
|--------|------|------|
| `Ports:DotNetHttps` | .NET HTTPS 監聽端口 | `64214` |
| `Kestrel:EnableHttps` | 是否啟用 HTTPS | `true` / `false` |
| `Kestrel:Certificates:Default:Path` | 證書文件路徑（.pfx） | `C:\Certificates\whattoflow.pfx` |
| `Kestrel:Certificates:Default:Password` | 證書文件密碼 | `YourPassword123!` |
| `Kestrel:Certificates:Default:Store` | Windows 證書存儲名稱 | `My` |
| `Kestrel:Certificates:Default:Subject` | 證書主體名稱 | `CN=yourdomain.com` |
| `Kestrel:Certificates:Default:Thumbprint` | 證書指紋 | `A1B2C3D4E5F6...` |

### 證書存儲名稱參考

Windows 證書存儲常用名稱：

- `My` - 個人證書（最常用）
- `Root` - 受信任的根證書頒發機構
- `CA` - 中級證書頒發機構
- `TrustedPeople` - 受信任的人員
- `TrustedPublisher` - 受信任的發行者

## 🔥 防火牆配置

啟用 HTTPS 後，需要配置 Windows 防火牆允許 HTTPS 端口：

```powershell
# 以管理員身份運行
$httpsPort = 64214

# 添加入站規則允許 HTTPS 端口
New-NetFirewallRule `
    -DisplayName "WhattoFlow HTTPS" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $httpsPort `
    -Action Allow `
    -Profile Domain,Private,Public
```

或者通過 GUI：
1. 打開 "高級安全 Windows 防火牆"
2. 入站規則 → 新建規則
3. 端口 → TCP → 特定本地端口（輸入 HTTPS 端口）
4. 允許連接 → 所有配置文件 → 命名規則

## ✅ 驗證 HTTPS 配置

### 測試 HTTPS 連接

```powershell
# 測試本地 HTTPS 連接
Invoke-WebRequest -Uri "https://localhost:64214/api/health" -SkipCertificateCheck

# 測試遠程 HTTPS 連接（需要替換為實際域名）
Invoke-WebRequest -Uri "https://yourdomain.com:64214/api/health"
```

### 查看證書信息

```powershell
# 查看應用程序日誌確認 HTTPS 已啟用
# 應該看到："HTTPS 已啟用，監聽端口: 64214"
```

## 🚨 常見問題排查

### 問題 1: 找不到證書

**錯誤訊息**：`找不到證書: Store=My, Subject=...`

**解決方法**：
1. 確認證書已正確安裝到指定的證書存儲
2. 使用 `Get-ChildItem Cert:\LocalMachine\My` 檢查證書是否存在
3. 確認 `Subject` 或 `Thumbprint` 配置正確（注意大小寫）

### 問題 2: 權限不足

**錯誤訊息**：訪問被拒絕

**解決方法**：
1. 確認應用程序運行帳戶有權限讀取證書私鑰
2. 檢查證書文件權限（如果使用文件方式）
3. 檢查 Windows 證書存儲的私鑰文件權限

### 問題 3: 端口被占用

**錯誤訊息**：`Address already in use`

**解決方法**：
```powershell
# 檢查端口占用
netstat -ano | findstr :64214

# 如果被占用，更改 appsettings.json 中的端口號
```

### 問題 4: 證書過期

**解決方法**：
1. 更新證書到證書存儲或文件路徑
2. 重啟應用程序

## 📝 生產環境建議

1. **使用有效證書**：不要使用自簽名證書，從受信任的 CA 獲取證書
2. **保護證書密碼**：將證書密碼放在環境變量或 Azure Key Vault 中，不要硬編碼
3. **使用環境特定配置**：為 production 創建 `appsettings.Production.json`
4. **定期更新證書**：設置提醒，在證書過期前更新
5. **監控證書狀態**：添加健康檢查端點監控證書有效期

## 🔒 安全最佳實踐

1. **最小權限原則**：只給應用程序運行帳戶必要的證書讀取權限
2. **證書文件位置**：將證書文件放在受保護的目錄，設置適當的文件權限
3. **環境變量**：敏感信息（如證書密碼）使用環境變量而非配置文件
4. **日誌記錄**：不要在日誌中記錄證書密碼或私鑰信息
5. **備份**：安全地備份證書和私鑰

## 📚 相關資源

- [ASP.NET Core Kestrel HTTPS 文檔](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/servers/kestrel/endpoints)
- [Windows 證書管理](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.x509certificates.x509store)
- [IIS HTTPS 配置](https://learn.microsoft.com/en-us/iis/manage/configuring-security/how-to-set-up-ssl-on-iis)
