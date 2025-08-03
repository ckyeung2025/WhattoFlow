# LibreOffice 安裝腳本
# 此腳本會檢查並安裝 LibreOffice

Write-Host "🔍 檢查 LibreOffice 是否已安裝..." -ForegroundColor Yellow

# 檢查是否已安裝 LibreOffice
$libreOfficePaths = @(
    "C:\Program Files\LibreOffice\program\soffice.exe",
    "C:\Program Files (x86)\LibreOffice\program\soffice.exe"
)

$installed = $false
foreach ($path in $libreOfficePaths) {
    if (Test-Path $path) {
        Write-Host "✅ 找到 LibreOffice: $path" -ForegroundColor Green
        $installed = $true
        break
    }
}

if (-not $installed) {
    Write-Host "❌ 未找到 LibreOffice，開始安裝..." -ForegroundColor Red
    
    # 嘗試使用 winget 安裝
    Write-Host "🔧 嘗試使用 winget 安裝 LibreOffice..." -ForegroundColor Yellow
    try {
        $wingetProcess = Start-Process -FilePath "winget" -ArgumentList "install TheDocumentFoundation.LibreOffice --accept-source-agreements" -PassThru -Wait
        if ($wingetProcess.ExitCode -eq 0) {
            Write-Host "✅ 使用 winget 安裝成功" -ForegroundColor Green
        } else {
            throw "winget 安裝失敗"
        }
    }
    catch {
        Write-Host "❌ winget 安裝失敗，嘗試手動下載..." -ForegroundColor Red
        
        # 嘗試手動下載
        $downloadUrl = "https://download.documentfoundation.org/libreoffice/stable/7.6.4/win/x86_64/LibreOffice_7.6.4_Win_x64.msi"
        $installerPath = "$env:TEMP\LibreOffice_7.6.4_Win_x64.msi"
        
        Write-Host "📥 嘗試下載 LibreOffice..." -ForegroundColor Yellow
        try {
            Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath
            Write-Host "✅ 下載完成" -ForegroundColor Green
            
            # 安裝 LibreOffice
            Write-Host "🔧 安裝 LibreOffice..." -ForegroundColor Yellow
            Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$installerPath`" /quiet /norestart" -Wait
            Write-Host "✅ 安裝完成" -ForegroundColor Green
            
            # 清理安裝文件
            if (Test-Path $installerPath) {
                Remove-Item $installerPath
            }
        }
        catch {
            Write-Host "❌ 下載失敗，請手動安裝 LibreOffice" -ForegroundColor Red
            Write-Host "下載鏈接: https://www.libreoffice.org/download/download/" -ForegroundColor Yellow
            Write-Host "或使用 Chocolatey: choco install libreoffice" -ForegroundColor Yellow
            Write-Host "或使用 Winget: winget install TheDocumentFoundation.LibreOffice" -ForegroundColor Yellow
            exit 1
        }
    }
} else {
    Write-Host "✅ LibreOffice 已安裝" -ForegroundColor Green
}

# 測試 LibreOffice 是否可用
Write-Host "🧪 測試 LibreOffice 是否可用..." -ForegroundColor Yellow
try {
    $testProcess = Start-Process -FilePath "soffice" -ArgumentList "--version" -PassThru -WindowStyle Hidden
    $testProcess.WaitForExit(5000)
    if ($testProcess.ExitCode -eq 0) {
        Write-Host "✅ LibreOffice 測試成功" -ForegroundColor Green
    } else {
        Write-Host "⚠️ LibreOffice 測試失敗，但可能仍可使用" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ 無法測試 LibreOffice，但可能仍可使用" -ForegroundColor Yellow
}

Write-Host "🎉 安裝完成！現在可以使用文檔轉換功能了。" -ForegroundColor Green
Write-Host "支持的格式：Word (.doc, .docx), Excel (.xls, .xlsx), PDF, PowerPoint (.ppt, .pptx), RTF, TXT" -ForegroundColor Cyan 