# Node.js 服務自動移除腳本（供 MSI CustomAction 使用）

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
$LogFile = Join-Path $InstallDir "remove_nodejs_service.log"

# 寫入日誌
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logMessage -ErrorAction SilentlyContinue
}

Write-Log "開始移除 Node.js 服務..."

if (-not (Test-Path $NSSMPath)) {
    Write-Log "找不到 nssm.exe，跳過移除步驟"
    exit 0
}

# 停止並移除服務
try {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Log "停止服務..."
        & $NSSMPath stop $ServiceName 2>&1 | Out-Null
        Start-Sleep -Seconds 2
        
        Write-Log "移除服務..."
        & $NSSMPath remove $ServiceName confirm 2>&1 | Out-Null
        Write-Log "服務移除成功"
    } else {
        Write-Log "服務不存在，無需移除"
    }
} catch {
    Write-Log "移除服務時發生錯誤: $_"
    # 即使出錯也返回成功，不中斷卸載
}

exit 0




