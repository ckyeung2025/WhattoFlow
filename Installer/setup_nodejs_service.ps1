# Node.js 服務自動安裝腳本（供 MSI CustomAction 使用）
# 使用 PowerShell 更可靠地處理路徑和錯誤

param(
    [string]$InstallDir = ""
)

# 如果沒有提供路徑，嘗試從腳本位置獲取
if ([string]::IsNullOrEmpty($InstallDir)) {
    $InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

# 確保路徑以反斜線結尾
if (-not $InstallDir.EndsWith("\")) {
    $InstallDir += "\"
}

$ServiceName = "WhatoFlowNodeService"
$NSSMPath = Join-Path $InstallDir "nssm.exe"
$StartScriptPath = Join-Path $InstallDir "start-node-service.bat"
$LogFile = Join-Path $InstallDir "setup_nodejs_service.log"

# 寫入日誌
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logMessage -ErrorAction SilentlyContinue
    Write-Host $logMessage
}

Write-Log "開始安裝 Node.js 服務..."
Write-Log "安裝目錄: $InstallDir"
Write-Log "NSSM 路徑: $NSSMPath"
Write-Log "啟動腳本路徑: $StartScriptPath"

# 檢查必要檔案
if (-not (Test-Path $NSSMPath)) {
    $errorMsg = "找不到 nssm.exe: $NSSMPath"
    Write-Log "錯誤: $errorMsg"
    exit 1
}

if (-not (Test-Path $StartScriptPath)) {
    $errorMsg = "找不到 start-node-service.bat: $StartScriptPath"
    Write-Log "錯誤: $errorMsg"
    exit 1
}

Write-Log "必要檔案檢查通過"

# 檢查服務是否已存在，如果存在則先移除
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Log "服務已存在，先移除舊服務..."
    try {
        & $NSSMPath stop $ServiceName 2>&1 | Out-Null
        Start-Sleep -Seconds 2
        & $NSSMPath remove $ServiceName confirm 2>&1 | Out-Null
        Start-Sleep -Seconds 1
        Write-Log "舊服務已移除"
    } catch {
        Write-Log "警告: 移除舊服務時發生錯誤，繼續安裝: $_"
    }
}

# 安裝服務
Write-Log "正在安裝服務..."
try {
    $installResult = & $NSSMPath install $ServiceName $StartScriptPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        $errorMsg = "安裝服務失敗: $installResult"
        Write-Log "錯誤: $errorMsg"
        exit 1
    }
    Write-Log "服務安裝成功"
} catch {
    $errorMsg = "安裝服務時發生異常: $_"
    Write-Log "錯誤: $errorMsg"
    exit 1
}

# 設定服務屬性
Write-Log "正在設定服務屬性..."
try {
    & $NSSMPath set $ServiceName AppDirectory $InstallDir 2>&1 | Out-Null
    & $NSSMPath set $ServiceName DisplayName "WhatoFlow Node.js Service" 2>&1 | Out-Null
    & $NSSMPath set $ServiceName Description "WhatoFlow React 前端開發伺服器服務" 2>&1 | Out-Null
    & $NSSMPath set $ServiceName Start SERVICE_AUTO_START 2>&1 | Out-Null
    Write-Log "服務屬性設定成功"
} catch {
    Write-Log "警告: 設定服務屬性時發生錯誤，但繼續: $_"
}

# 啟動服務（失敗也不中斷安裝）
Write-Log "正在啟動服務..."
try {
    & $NSSMPath start $ServiceName 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Log "服務啟動成功"
    } else {
        Write-Log "警告: 服務啟動失敗，但安裝繼續"
    }
} catch {
    Write-Log "警告: 啟動服務時發生錯誤，但安裝繼續: $_"
}

Write-Log "Node.js 服務安裝完成"
exit 0




