# WhatoFlow 安裝程式 - 帶有圖形化目錄選擇介面
# 此 PowerShell 腳本會顯示一個圖形化對話框讓使用者選擇安裝目錄

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 設定預設安裝目錄
$defaultPath = if ([Environment]::Is64BitOperatingSystem) {
    "C:\Program Files\WhatoFlow"
} else {
    "C:\Program Files (x86)\WhatoFlow"
}

# 創建表單
$form = New-Object System.Windows.Forms.Form
$form.Text = "WhatoFlow Installation"
$form.Size = New-Object System.Drawing.Size(600, 200)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true

# 標題
$labelTitle = New-Object System.Windows.Forms.Label
$labelTitle.Text = "Select Installation Directory"
$labelTitle.Location = New-Object System.Drawing.Point(20, 20)
$labelTitle.Size = New-Object System.Drawing.Size(540, 20)
$labelTitle.Font = New-Object System.Drawing.Font("Microsoft Sans Serif", 10, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($labelTitle)

# 路徑輸入框
$textBoxPath = New-Object System.Windows.Forms.TextBox
$textBoxPath.Text = $defaultPath
$textBoxPath.Location = New-Object System.Drawing.Point(20, 50)
$textBoxPath.Size = New-Object System.Drawing.Size(420, 23)
$form.Controls.Add($textBoxPath)

# 瀏覽按鈕
$buttonBrowse = New-Object System.Windows.Forms.Button
$buttonBrowse.Text = "Browse..."
$buttonBrowse.Location = New-Object System.Drawing.Point(450, 48)
$buttonBrowse.Size = New-Object System.Drawing.Size(110, 25)
$buttonBrowse.Add_Click({
    $folderDialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $folderDialog.Description = "Select installation folder"
    $folderDialog.SelectedPath = $textBoxPath.Text
    if ($folderDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $textBoxPath.Text = $folderDialog.SelectedPath
    }
})
$form.Controls.Add($buttonBrowse)

# 安裝按鈕
$buttonInstall = New-Object System.Windows.Forms.Button
$buttonInstall.Text = "Install"
$buttonInstall.Location = New-Object System.Drawing.Point(380, 100)
$buttonInstall.Size = New-Object System.Drawing.Size(85, 30)
$buttonInstall.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($buttonInstall)
$form.AcceptButton = $buttonInstall

# 取消按鈕
$buttonCancel = New-Object System.Windows.Forms.Button
$buttonCancel.Text = "Cancel"
$buttonCancel.Location = New-Object System.Drawing.Point(475, 100)
$buttonCancel.Size = New-Object System.Drawing.Size(85, 30)
$buttonCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($buttonCancel)
$form.CancelButton = $buttonCancel

# 顯示對話框
$result = $form.ShowDialog()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    $installPath = $textBoxPath.Text.Trim()
    
    if ([string]::IsNullOrWhiteSpace($installPath)) {
        $installPath = $defaultPath
    }
    
    # 驗證路徑格式
    if (-not $installPath.EndsWith("\")) {
        $installPath = $installPath + "\WhatoFlow"
    } else {
        $installPath = $installPath + "WhatoFlow"
    }
    
    Write-Host "Selected installation path: $installPath" -ForegroundColor Green
    
    # 查找 MSI 檔案
    $msiFile = Join-Path $PSScriptRoot "WhatoFlow.Setup.msi"
    
    if (-not (Test-Path $msiFile)) {
        [System.Windows.Forms.MessageBox]::Show(
            "Cannot find MSI file: $msiFile`n`nPlease ensure WhatoFlow.Setup.msi is in the same directory as this script.",
            "Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        exit 1
    }
    
    # 執行 MSI 安裝
    Write-Host "Starting installation..." -ForegroundColor Yellow
    
    $process = Start-Process -FilePath "msiexec.exe" `
        -ArgumentList "/i `"$msiFile`" INSTALLFOLDER=`"$installPath`"" `
        -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        [System.Windows.Forms.MessageBox]::Show(
            "Installation completed successfully!`n`nInstallation path: $installPath",
            "Success",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    } else {
        [System.Windows.Forms.MessageBox]::Show(
            "Installation failed with exit code: $($process.ExitCode)",
            "Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        exit 1
    }
} else {
    Write-Host "Installation cancelled." -ForegroundColor Yellow
    exit 0
}




