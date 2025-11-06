# 安裝後自動配置腳本（通過 MSI CustomAction 執行）
# 此腳本會註冊 Node.js 服務

param(
    [string]$InstallDir = ""
)

# 如果沒有提供路徑，嘗試從環境變數獲取
if ([string]::IsNullOrEmpty($InstallDir)) {
    $InstallDir = $env:INSTALLFOLDER
    if ([string]::IsNullOrEmpty($InstallDir)) {
        Write-Host "[ERROR] InstallDir parameter is required"
        exit 1
    }
}

# 確保路徑以反斜線結尾
if (-not $InstallDir.EndsWith("\")) {
    $InstallDir += "\"
}

$ServiceName = "WhatoFlowNodeService"
$NSSMPath = Join-Path $InstallDir "nssm.exe"
$StartScriptPath = Join-Path $InstallDir "start-node-service.bat"
$LogFile = Join-Path $InstallDir "setup_postinstall.log"

# 寫入日誌
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    try {
        Add-Content -Path $LogFile -Value $logMessage -ErrorAction SilentlyContinue
    } catch {
        # 忽略日誌寫入錯誤
    }
}

Write-Log "Post-installation script started"
Write-Log "Install directory: $InstallDir"

# 等待一下，確保所有檔案都已安裝
Start-Sleep -Seconds 2

# 檢查必要檔案
if (-not (Test-Path $NSSMPath)) {
    Write-Log "ERROR: nssm.exe not found at: $NSSMPath"
    exit 1
}

if (-not (Test-Path $StartScriptPath)) {
    Write-Log "ERROR: start-node-service.bat not found at: $StartScriptPath"
    exit 1
}

Write-Log "Prerequisites check passed"

# 檢查服務是否已存在
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Log "Service already exists, removing old service..."
    try {
        & $NSSMPath stop $ServiceName 2>&1 | Out-Null
        Start-Sleep -Seconds 2
        & $NSSMPath remove $ServiceName confirm 2>&1 | Out-Null
        Start-Sleep -Seconds 1
        Write-Log "Old service removed"
    } catch {
        Write-Log "WARN: Error removing old service, continuing: $_"
    }
}

# 安裝服務
Write-Log "Installing service..."
try {
    $installResult = & $NSSMPath install $ServiceName $StartScriptPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: Service installation failed: $installResult"
        exit 1
    }
    Write-Log "Service installed successfully"
} catch {
    Write-Log "ERROR: Exception during service installation: $_"
    exit 1
}

# 設定服務屬性
Write-Log "Setting service properties..."
try {
    & $NSSMPath set $ServiceName AppDirectory $InstallDir 2>&1 | Out-Null
    & $NSSMPath set $ServiceName DisplayName "WhatoFlow Node.js Service" 2>&1 | Out-Null
    & $NSSMPath set $ServiceName Description "WhatoFlow React Frontend Service" 2>&1 | Out-Null
    & $NSSMPath set $ServiceName Start SERVICE_AUTO_START 2>&1 | Out-Null
    Write-Log "Service properties set"
} catch {
    Write-Log "WARN: Error setting service properties, continuing: $_"
}

# 啟動服務（失敗也不中斷）
Write-Log "Starting service..."
try {
    & $NSSMPath start $ServiceName 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Service started successfully"
    } else {
        Write-Log "WARN: Service start failed, but service is installed"
    }
} catch {
    Write-Log "WARN: Error starting service, but service is installed: $_"
}

Write-Log "Post-installation script completed"
exit 0




