#define MyAppName "WhatoFlow"
#define MyAppVersion "1.25.118.1"
#define MyAppPublisher "Starchy Solution"
#define MyAppURL "https://www.starchysolution.com/"
#define MyAppExeName "WhatoFlow.exe"

[Setup]
; 應用程式基本信息
AppId={{A1B2C3D4-E5F6-4A3B-8C9D-1E2F3A4B5C6D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=
InfoBeforeFile=
InfoAfterFile=
OutputDir=bin
OutputBaseFilename=WhatoFlow-Setup-{#MyAppVersion}
SetupIconFile=..\public\assets\favicon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\{#MyAppExeName}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Installation Package
VersionInfoCopyright=Copyright (C) 2024 {#MyAppPublisher}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode

[Types]
Name: "full"; Description: "Full installation"
Name: "custom"; Description: "Custom installation"; Flags: iscustom

[Files]
; 打包所有發佈文件
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; 確保排除不需要的文件
Source: "publish\*.pdb"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; 複製服務安裝腳本
Source: "install_services.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall_services.bat"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
; 創建 logs 目錄用於服務日誌
Name: "{app}\logs"; Flags: uninsneveruninstall
; 創建 Uploads 目錄結構（用於文件上傳）
Name: "{app}\Uploads"; Flags: uninsneveruninstall
Name: "{app}\Uploads\Customer"; Flags: uninsneveruninstall
Name: "{app}\Uploads\FormsFiles"; Flags: uninsneveruninstall
Name: "{app}\Uploads\FormsFiles\Documents"; Flags: uninsneveruninstall
; 確保 wwwroot 目錄存在（前端靜態文件）
Name: "{app}\wwwroot"; Flags: uninsneveruninstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; 安裝完成後註冊服務（使用自定義腳本）
; 將配置信息保存到臨時文件，然後傳遞給安裝腳本
Filename: "{app}\install_services.bat"; Parameters: """{code:GetHttpPort}"""; Description: "Install Windows Service"; StatusMsg: "Installing Windows Service..."; Flags: runhidden waituntilterminated; BeforeInstall: UpdateConfigurationFiles

[UninstallRun]
Filename: "{app}\uninstall_services.bat"; StatusMsg: "Uninstalling Windows Services..."; Flags: runhidden waituntilterminated

[Code]
var
  // 自定義安裝頁面
  InstallDirPage: TInputDirWizardPage;  // 注意：CreateInputDirPage 返回的類型是 TInputDirWizardPage
  HttpPortPage: TInputQueryWizardPage;
  HttpsPortPage: TInputQueryWizardPage;
  DatabaseServerPage: TInputQueryWizardPage;
  DatabaseAuthPage: TInputQueryWizardPage;
  
  // 用戶輸入的值
  UserInstallDir: String;
  UserHttpPort: String;
  UserHttpsPort: String;
  UserDbServer: String;
  UserDbName: String;
  UserDbUser: String;
  UserDbPassword: String;

// 初始化安裝精靈
procedure InitializeWizard;
var
  DefaultDir: String;
begin
  // 創建安裝目錄選擇頁面 - 使用 CreateInputDirPage 函數
  InstallDirPage := CreateInputDirPage(wpWelcome,
    '選擇安裝目錄', '請選擇 {#MyAppName} 的安裝位置',
    '請選擇安裝目錄，然後點擊「下一步」繼續。', False, '');
  InstallDirPage.Add('');
  DefaultDir := ExpandConstant('{autopf}\{#MyAppName}');
  InstallDirPage.Values[0] := DefaultDir;
  
  // HTTP 端口配置頁面
  HttpPortPage := CreateInputQueryPage(InstallDirPage.ID,
    '服務端口配置', '配置 WhatoFlow Web 介面和 API 的 HTTP 端口',
    '請輸入 HTTP 端口號（預設: 64213）。' + #13#10 + 
    '注意：前端靜態文件和 API 都在此端口提供。');
  HttpPortPage.Add('HTTP 端口號:', False);
  HttpPortPage.Values[0] := '64213';
  
  // HTTPS 端口配置頁面
  HttpsPortPage := CreateInputQueryPage(HttpPortPage.ID,
    '服務端口配置', '配置 WhatoFlow Web 介面和 API 的 HTTPS 端口',
    '請輸入 HTTPS 端口號（預設: 64214）。' + #13#10 + 
    '注意：HTTPS 端口用於安全連接。');
  HttpsPortPage.Add('HTTPS 端口號:', False);
  HttpsPortPage.Values[0] := '64214';
  
  // 數據庫伺服器配置頁面
  DatabaseServerPage := CreateInputQueryPage(HttpsPortPage.ID,
    '數據庫伺服器配置', '配置 SQL Server 連接信息',
    '請輸入 SQL Server 伺服器地址和數據庫名稱：');
  DatabaseServerPage.Add('伺服器 IP 或域名:', False);
  DatabaseServerPage.Add('數據庫名稱:', False);
  DatabaseServerPage.Values[0] := '127.0.0.1';
  DatabaseServerPage.Values[1] := 'WhatoFlow';
  
  // 數據庫認證配置頁面
  DatabaseAuthPage := CreateInputQueryPage(DatabaseServerPage.ID,
    '數據庫認證配置', '配置 SQL Server 登錄憑據',
    '請輸入 SQL Server 登錄信息：');
  DatabaseAuthPage.Add('用戶名 (例如: sa):', False);
  DatabaseAuthPage.Add('密碼:', True);
  DatabaseAuthPage.Values[0] := 'sa';
  DatabaseAuthPage.Values[1] := 'sql!Q@W3e';
end;

// 處理下一步按鈕點擊
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
  if CurPageID = InstallDirPage.ID then
  begin
    // 驗證安裝目錄
    UserInstallDir := InstallDirPage.Values[0];
    if Length(UserInstallDir) = 0 then
    begin
      MsgBox('請選擇安裝目錄！', mbError, MB_OK);
      Result := False;
    end else begin
      // 設置實際的安裝目錄
      WizardForm.DirEdit.Text := UserInstallDir;
    end;
  end
  else if CurPageID = HttpPortPage.ID then
  begin
    // 驗證 HTTP 端口號
    UserHttpPort := HttpPortPage.Values[0];
    if (StrToIntDef(UserHttpPort, -1) < 1) or (StrToIntDef(UserHttpPort, -1) > 65535) then
    begin
      MsgBox('請輸入有效的 HTTP 端口號（1-65535）！', mbError, MB_OK);
      Result := False;
    end;
  end
  else if CurPageID = HttpsPortPage.ID then
  begin
    // 驗證 HTTPS 端口號
    UserHttpsPort := HttpsPortPage.Values[0];
    if (StrToIntDef(UserHttpsPort, -1) < 1) or (StrToIntDef(UserHttpsPort, -1) > 65535) then
    begin
      MsgBox('請輸入有效的 HTTPS 端口號（1-65535）！', mbError, MB_OK);
      Result := False;
    end;
    // 檢查 HTTP 和 HTTPS 端口不能相同
    if UserHttpPort = UserHttpsPort then
    begin
      MsgBox('HTTP 和 HTTPS 端口不能相同！', mbError, MB_OK);
      Result := False;
    end;
  end
  else if CurPageID = DatabaseServerPage.ID then
  begin
    // 驗證數據庫伺服器信息
    UserDbServer := DatabaseServerPage.Values[0];
    UserDbName := DatabaseServerPage.Values[1];
    if (Length(UserDbServer) = 0) or (Length(UserDbName) = 0) then
    begin
      MsgBox('請輸入完整的數據庫伺服器信息和數據庫名稱！', mbError, MB_OK);
      Result := False;
    end;
  end
  else if CurPageID = DatabaseAuthPage.ID then
  begin
    // 驗證數據庫認證信息
    UserDbUser := DatabaseAuthPage.Values[0];
    UserDbPassword := DatabaseAuthPage.Values[1];
    if (Length(UserDbUser) = 0) or (Length(UserDbPassword) = 0) then
    begin
      MsgBox('請輸入完整的用戶名和密碼！', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

// 確保文件以 UTF-8 編碼保存（用於處理所有文本文件）
procedure SaveFileAsUTF8(FilePath: String; Content: String);
var
  TempPSFile: String;
  TempContentFile: String;
  PSContent: String;
  ResultCode: Integer;
begin
  TempPSFile := ExpandConstant('{tmp}\save_utf8_' + IntToStr(Random(99999)) + '.ps1');
  TempContentFile := ExpandConstant('{tmp}\file_temp_' + IntToStr(Random(99999)) + '.txt');
  
  // 先將內容保存到臨時文件
  SaveStringToFile(TempContentFile, Content, False);
  
  // 創建 PowerShell 腳本：讀取臨時文件並以 UTF-8（無 BOM）保存
  PSContent := '$content = $null' + #13#10 +
               'try { $content = Get-Content -Path ''' + TempContentFile + ''' -Raw -Encoding UTF8 } catch {}' + #13#10 +
               'if (-not $content) { try { $content = Get-Content -Path ''' + TempContentFile + ''' -Raw } catch {} }' + #13#10 +
               'if (-not $content) { $bytes = [System.IO.File]::ReadAllBytes(''' + TempContentFile + '''); $content = [System.Text.Encoding]::UTF8.GetString($bytes) }' + #13#10 +
               '$utf8NoBom = New-Object System.Text.UTF8Encoding $false' + #13#10 +
               '[System.IO.File]::WriteAllText(''' + FilePath + ''', $content, $utf8NoBom)' + #13#10 +
               'Remove-Item -Path ''' + TempContentFile + ''' -Force -ErrorAction SilentlyContinue';
  
  SaveStringToFile(TempPSFile, PSContent, False);
  
  if Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -File "' + TempPSFile + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    DeleteFile(TempPSFile);
    DeleteFile(TempContentFile);
  end
  else
  begin
    Log('警告：PowerShell 保存 UTF-8 失敗，使用預設方法保存（可能不是 UTF-8 編碼）');
    SaveStringToFile(FilePath, Content, False);
    DeleteFile(TempPSFile);
    DeleteFile(TempContentFile);
  end;
end;

// 在安裝前更新配置文件
procedure UpdateConfigurationFiles;
var
  AppSettingsFile: String;
  TempPSFile: String;
  PSContent: String;
  ResultCode: Integer;
  EscapedDbServer: String;
  EscapedDbName: String;
  EscapedDbUser: String;
  EscapedDbPassword: String;
  EscapedHttpPort: String;
  EscapedHttpsPort: String;
  ConnectionString: String;
begin
  AppSettingsFile := ExpandConstant('{app}\appsettings.json');
  
  // 準備參數（轉義特殊字符）
  EscapedDbServer := UserDbServer;
  EscapedDbName := UserDbName;
  EscapedDbUser := UserDbUser;
  EscapedDbPassword := UserDbPassword;
  
  // 轉義 PowerShell 字符串中的特殊字符
  StringChangeEx(EscapedDbServer, '''', '''''', True);
  StringChangeEx(EscapedDbName, '''', '''''', True);
  StringChangeEx(EscapedDbUser, '''', '''''', True);
  StringChangeEx(EscapedDbPassword, '\', '\\', True);
  StringChangeEx(EscapedDbPassword, '''', '''''', True);
  StringChangeEx(EscapedDbPassword, '"', '\"', True);
  
  // 更新端口配置（如果用戶未輸入，使用默認值）
  if Length(UserHttpPort) = 0 then
    UserHttpPort := '64213';
  if Length(UserHttpsPort) = 0 then
    UserHttpsPort := '64214';
  
  EscapedHttpPort := UserHttpPort;
  EscapedHttpsPort := UserHttpsPort;
  
  // 構建 SQL Server 連接字符串
  ConnectionString := 'Server=' + EscapedDbServer + ';Database=' + EscapedDbName + 
                      ';User Id=' + EscapedDbUser + ';Password=' + EscapedDbPassword + 
                      ';TrustServerCertificate=true;';
  
  // 轉義連接字符串中的 PowerShell 特殊字符
  StringChangeEx(ConnectionString, '''', '''''', True);
  
  // 使用 PowerShell 直接讀取、修改和保存文件（確保 UTF-8 編碼）
  TempPSFile := ExpandConstant('{tmp}\update_appsettings_' + IntToStr(Random(99999)) + '.ps1');
  
  // 創建 PowerShell 腳本：讀取 UTF-8 文件，修改內容，保存為 UTF-8
  // 不使用註釋，避免預處理器問題
  PSContent := '$file = ''' + AppSettingsFile + '''' + #13#10 +
               '$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)' + #13#10 +
               '$password = ''' + EscapedDbPassword + '''' + #13#10 +
               '$password = $password -replace ''\\'', ''\\\\''' + #13#10 +
               '$password = $password -replace ''"'', ''\\"''' + #13#10 +
               '$connStr = ''Server=' + EscapedDbServer + ';Database=' + EscapedDbName + ';User Id=' + EscapedDbUser + ';Password='' + $password + '';TrustServerCertificate=true;''' + #13#10 +
               '$oldPattern = ''"PurpleRice":\s*"[^"]*"''' + #13#10 +
               '$newValue = ''"PurpleRice": "'' + $connStr + ''"''' + #13#10 +
               '$content = $content -replace $oldPattern, $newValue' + #13#10 +
               '$content = $content -replace ''"DotNet":\s*\d+'', ''"DotNet": ' + EscapedHttpPort + '''' + #13#10 +
               '$content = $content -replace ''"DotNetHttps":\s*\d+'', ''"DotNetHttps": ' + EscapedHttpsPort + '''' + #13#10 +
               '$content = $content -replace ''"NodeJs":\s*\d+'', ''"NodeJs": ' + EscapedHttpPort + '''' + #13#10 +
               '$utf8NoBom = New-Object System.Text.UTF8Encoding $false' + #13#10 +
               '[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)' + #13#10 +
               'Write-Host "Updated appsettings.json successfully"';
  
  SaveStringToFile(TempPSFile, PSContent, False);
  
  // 執行 PowerShell 腳本
  if Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -File "' + TempPSFile + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    DeleteFile(TempPSFile);
  end
  else
  begin
    Log('警告：PowerShell 更新 appsettings.json 失敗');
    DeleteFile(TempPSFile);
  end;
end;

// 設置安裝目錄
procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = InstallDirPage.ID then
  begin
    // 用戶選擇的目錄已經在 InstallDirPage.Values[0] 中
    // 確保顯示正確
    if Length(InstallDirPage.Values[0]) > 0 then
    begin
      WizardForm.DirEdit.Text := InstallDirPage.Values[0];
    end;
  end;
end;

// 在安裝目錄頁面完成後更新實際安裝路徑
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    // 如果有自定義安裝目錄，使用它
    if Length(UserInstallDir) > 0 then
    begin
      WizardForm.DirEdit.Text := UserInstallDir;
    end;
  end;
end;

// 簡化的版本比較函數（需要在使用前定義）
function CompareVersion(Version1, Version2: String): Integer;
var
  V1Num, V2Num: Integer;
  DotPos: Integer;
begin
  // 簡化版本：只比較主版本號（第一個數字）
  if (Length(Version1) = 0) or (Length(Version2) = 0) then
  begin
    Result := 0;
    Exit;
  end;
  
  // 提取主版本號（第一個數字）
  DotPos := Pos('.', Version1);
  if DotPos > 0 then
    V1Num := StrToIntDef(Copy(Version1, 1, DotPos - 1), 0)
  else
    V1Num := StrToIntDef(Version1, 0);
    
  DotPos := Pos('.', Version2);
  if DotPos > 0 then
    V2Num := StrToIntDef(Copy(Version2, 1, DotPos - 1), 0)
  else
    V2Num := StrToIntDef(Version2, 0);
  
  if V1Num > V2Num then
    Result := 1
  else if V1Num < V2Num then
    Result := -1
  else
    Result := 0;
end;

// 檢查 .NET Runtime 是否已安裝
function IsDotNetRuntimeInstalled: Boolean;
var
  ResultCode: Integer;
  Version: String;
  DotNetPath: String;
begin
  Result := False;
  
  // 方法 1: 檢查註冊表中的 .NET Runtime 版本
  if RegQueryStringValue(HKEY_LOCAL_MACHINE,
    'SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedhost', 'Version', Version) then
  begin
    // 檢查版本是否 >= 8.0.0
    if (CompareVersion(Version, '8.0.0') >= 0) then
    begin
      Log('找到已安裝的 .NET Runtime (註冊表): ' + Version);
      Result := True;
      Exit;
    end;
  end;
  
  // 方法 2: 通過 dotnet.exe 檢查（如果存在）
  DotNetPath := ExpandConstant('{pf}\dotnet\dotnet.exe');
  if FileExists(DotNetPath) then
  begin
    if Exec(DotNetPath, '--version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      if ResultCode = 0 then
      begin
        Log('通過 dotnet.exe 找到 .NET Runtime');
        Result := True;
        Exit;
      end;
    end;
  end;
  
  // 方法 3: 檢查 Program Files 中的 .NET Runtime
  if DirExists(ExpandConstant('{pf}\dotnet\shared\Microsoft.NETCore.App')) then
  begin
    Log('找到 .NET Runtime 安裝目錄');
    // 進一步檢查版本（可以遍歷目錄）
    Result := True;
  end;
end;

// 下載並安裝 ASP.NET Core Runtime（使用 Microsoft 官方 dotnet-install 腳本，自動獲取最新版本）
function DownloadAndInstallDotNetRuntime: Boolean;
var
  DotNetInstallScript: String;
  PowerShellScript: String;
  ResultCode: Integer;
begin
  Result := False;
  
  // 使用 Microsoft 官方的 dotnet-install.ps1 腳本
  // 這個腳本會自動獲取並安裝最新版本的 ASP.NET Core Runtime 8.0.x
  // 官方腳本地址：https://dot.net/v1/dotnet-install.ps1
  DotNetInstallScript := ExpandConstant('{tmp}\dotnet-install.ps1');
  
  try
    Log('開始下載 Microsoft dotnet-install 腳本...');
    
    // 下載 Microsoft 官方的 dotnet-install.ps1 腳本
    PowerShellScript := 
      '[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ' +
      '$ProgressPreference = ''SilentlyContinue''; ' +
      'try { ' +
      '  Invoke-WebRequest -Uri ''https://dot.net/v1/dotnet-install.ps1'' -OutFile ''' + DotNetInstallScript + ''' -UseBasicParsing -ErrorAction Stop; ' +
      '  Write-Host ''Script downloaded successfully''; ' +
      '  exit 0 ' +
      '} catch { ' +
      '  Write-Host ''Download failed: '' + $_.Exception.Message; ' +
      '  exit 1 ' +
      '}';
    
    Log('下載 dotnet-install.ps1 腳本...');
    if not Exec('powershell.exe', '-ExecutionPolicy Bypass -NoProfile -Command "' + PowerShellScript + '"', 
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      Log('無法執行 PowerShell 命令');
      MsgBox('無法下載安裝腳本。' + #13#10 + 
             '請確保 PowerShell 可用，並檢查網絡連接。', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    if ResultCode <> 0 then
    begin
      Log('下載 dotnet-install.ps1 失敗，返回碼: ' + IntToStr(ResultCode));
      if MsgBox('無法下載 Microsoft 安裝腳本。' + #13#10 + #13#10 +
                '是否打開瀏覽器手動下載 ASP.NET Core Runtime？',
                mbConfirmation, MB_YESNO) = IDYES then
      begin
        ShellExec('open', 'https://dotnet.microsoft.com/download/dotnet/8.0', '', '', SW_SHOW, ewNoWait, ResultCode);
      end;
      Result := False;
      Exit;
    end;
    
    // 檢查腳本是否下載成功
    if not FileExists(DotNetInstallScript) then
    begin
      Log('下載的腳本文件不存在: ' + DotNetInstallScript);
      MsgBox('下載的安裝腳本不存在。' + #13#10 +
             '下載路徑: ' + DotNetInstallScript, mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    Log('腳本下載完成，開始安裝 ASP.NET Core Runtime（自動獲取最新 8.0.x 版本）...');
    
    // 顯示安裝提示
    if MsgBox('正在安裝 ASP.NET Core Runtime 8.0（最新版本）...' + #13#10 + #13#10 +
              '將自動下載並安裝最新版本的 ASP.NET Core Runtime 8.0.x。' + #13#10 +
              '這可能需要幾分鐘時間，請稍候。' + #13#10 +
              '安裝過程中可能會顯示進度窗口。',
              mbInformation, MB_OK) = IDOK then
    begin
      // 使用 dotnet-install.ps1 腳本安裝 ASP.NET Core Runtime
      // -Runtime aspnetcore：指定安裝 ASP.NET Core Runtime
      // -Channel 8.0：指定 8.0 通道（會自動獲取該通道的最新版本）
      // -InstallDir：安裝目錄（可選，默認安裝到用戶目錄）
      Log('執行 dotnet-install.ps1 安裝 ASP.NET Core Runtime...');
      
      // PowerShell 腳本執行 dotnet-install.ps1
      PowerShellScript := 
        '& { ' +
        '  $ErrorActionPreference = ''Stop''; ' +
        '  try { ' +
        '    & ''' + DotNetInstallScript + ''' -Runtime aspnetcore -Channel 8.0 -Architecture x64; ' +
        '    if ($LASTEXITCODE -eq 0) { ' +
        '      Write-Host ''Installation completed successfully''; ' +
        '      exit 0 ' +
        '    } else { ' +
        '      Write-Host ''Installation failed with exit code: '' + $LASTEXITCODE; ' +
        '      exit $LASTEXITCODE ' +
        '    } ' +
        '  } catch { ' +
        '    Write-Host ''Installation error: '' + $_.Exception.Message; ' +
        '    exit 1 ' +
        '  } ' +
        '}';
      
      if Exec('powershell.exe', '-ExecutionPolicy Bypass -NoProfile -Command "' + PowerShellScript + '"', 
        '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
      begin
        if ResultCode = 0 then
        begin
          Log('ASP.NET Core Runtime 安裝成功');
          Result := True;
          
          // 等待幾秒讓系統完成註冊
          Sleep(3000);
          
          // 驗證安裝
          if IsDotNetRuntimeInstalled then
          begin
            Log('ASP.NET Core Runtime 安裝驗證成功');
          end
          else
          begin
            Log('警告: ASP.NET Core Runtime 安裝後驗證失敗，但可能仍可使用');
            // 仍然視為成功，因為 dotnet-install 可能安裝到非標準位置
            Result := True;
          end;
        end
        else
        begin
          Log('ASP.NET Core Runtime 安裝失敗，返回碼: ' + IntToStr(ResultCode));
          MsgBox('安裝 ASP.NET Core Runtime 時出現錯誤。' + #13#10 +
                 '返回碼: ' + IntToStr(ResultCode) + #13#10 + #13#10 +
                 '請手動安裝 ASP.NET Core 8.0 Runtime 後再繼續。',
                 mbError, MB_OK);
          Result := False;
        end;
      end
      else
      begin
        Log('無法執行 dotnet-install.ps1 腳本');
        MsgBox('無法執行安裝腳本。' + #13#10 +
               '請檢查是否有管理員權限。', mbError, MB_OK);
        Result := False;
      end;
    end;
    
    // 清理下載的腳本文件
    if FileExists(DotNetInstallScript) then
    begin
      DeleteFile(DotNetInstallScript);
      Log('已清理下載的安裝腳本');
    end;
    
  except
    Log('下載或安裝 ASP.NET Core Runtime 時發生異常: ' + GetExceptionMessage);
    MsgBox('下載或安裝 ASP.NET Core Runtime 時發生錯誤。' + #13#10 +
           '錯誤: ' + GetExceptionMessage + #13#10 + #13#10 +
           '請手動安裝 ASP.NET Core 8.0 Runtime 後再繼續。',
           mbError, MB_OK);
    Result := False;
    
    // 確保清理腳本文件
    if FileExists(DotNetInstallScript) then
    begin
      DeleteFile(DotNetInstallScript);
    end;
  end;
end;

// 檢查 LibreOffice 是否已安裝
function IsLibreOfficeInstalled: Boolean;
var
  LibreOfficePath1, LibreOfficePath2: String;
begin
  Result := False;
  
  // 檢查常見安裝路徑
  LibreOfficePath1 := ExpandConstant('{pf}\LibreOffice\program\soffice.exe');
  LibreOfficePath2 := ExpandConstant('{pf32}\LibreOffice\program\soffice.exe');
  
  if FileExists(LibreOfficePath1) then
  begin
    Log('找到已安裝的 LibreOffice (64-bit): ' + LibreOfficePath1);
    Result := True;
    Exit;
  end;
  
  if FileExists(LibreOfficePath2) then
  begin
    Log('找到已安裝的 LibreOffice (32-bit): ' + LibreOfficePath2);
    Result := True;
    Exit;
  end;
  
  Log('未找到已安裝的 LibreOffice');
end;

// 下載並安裝 LibreOffice
function DownloadAndInstallLibreOffice: Boolean;
var
  DownloadUrl: String;
  DownloadPath: String;
  ResultCode: Integer;
  PowerShellScript: String;
begin
  Result := False;
  
  // LibreOffice 25.8.2 Win x86-64 MSI 下載鏈接
  // 使用官方下載鏈接（可能需要根據實際情況調整）
  DownloadUrl := 'https://download.documentfoundation.org/libreoffice/stable/25.8.2/win/x86_64/LibreOffice_25.8.2_Win_x86-64.msi';
  DownloadPath := ExpandConstant('{tmp}\LibreOffice_25.8.2_Win_x86-64.msi');
  
  try
    Log('開始下載 LibreOffice...');
    Log('下載 URL: ' + DownloadUrl);
    Log('下載路徑: ' + DownloadPath);
    
    // 使用 PowerShell 下載
    PowerShellScript := 
      '[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ' +
      '$ProgressPreference = ''SilentlyContinue''; ' +
      'try { ' +
      '  Invoke-WebRequest -Uri ''' + DownloadUrl + ''' -OutFile ''' + DownloadPath + ''' -UseBasicParsing -ErrorAction Stop; ' +
      '  Write-Host ''Download completed''; ' +
      '  exit 0 ' +
      '} catch { ' +
      '  Write-Host ''Download failed: '' + $_.Exception.Message; ' +
      '  exit 1 ' +
      '}';
    
    Log('使用 PowerShell 下載 LibreOffice...');
    if not Exec('powershell.exe', '-ExecutionPolicy Bypass -NoProfile -Command "' + PowerShellScript + '"', 
      '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
    begin
      Log('無法執行 PowerShell 命令');
      MsgBox('無法啟動下載程序。' + #13#10 + 
             '請確保 PowerShell 可用，並檢查網絡連接。', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    if ResultCode <> 0 then
    begin
      Log('PowerShell 下載失敗，返回碼: ' + IntToStr(ResultCode));
      // 提供手動下載選項
      if MsgBox('自動下載 LibreOffice 失敗。' + #13#10 + #13#10 +
                '是否打開瀏覽器手動下載？' + #13#10 +
                '下載後請運行安裝程序。',
                mbConfirmation, MB_YESNO) = IDYES then
      begin
        ShellExec('open', 'https://www.libreoffice.org/download/download/', '', '', SW_SHOW, ewNoWait, ResultCode);
      end;
      Result := False;
      Exit;
    end;
    
    // 檢查下載的文件是否存在
    if not FileExists(DownloadPath) then
    begin
      Log('下載的文件不存在: ' + DownloadPath);
      MsgBox('下載的 LibreOffice 安裝程序不存在。' + #13#10 +
             '下載路徑: ' + DownloadPath, mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    Log('下載完成，開始安裝 LibreOffice...');
    
    // 顯示安裝提示
    if MsgBox('正在安裝 LibreOffice 25.8.2...' + #13#10 + #13#10 +
              '這可能需要幾分鐘時間，請稍候。' + #13#10 +
              '安裝過程中可能會顯示進度窗口。',
              mbInformation, MB_OK) = IDOK then
    begin
      // 安裝 LibreOffice（靜默安裝）
      Log('執行 LibreOffice 安裝程序...');
      // MSI 安裝參數：/i 安裝，/quiet 靜默，/norestart 不重啟
      if Exec('msiexec.exe', '/i "' + DownloadPath + '" /quiet /norestart', '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
      begin
        if ResultCode = 0 then
        begin
          Log('LibreOffice 安裝成功');
          Result := True;
          
          // 等待幾秒讓系統完成註冊
          Sleep(3000);
          
          // 驗證安裝
          if IsLibreOfficeInstalled then
          begin
            Log('LibreOffice 安裝驗證成功');
          end
          else
          begin
            Log('警告: LibreOffice 安裝後驗證失敗，但可能仍可使用');
          end;
        end
        else if ResultCode = 3010 then
        begin
          // 返回碼 3010 表示需要重啟，但安裝成功
          Log('LibreOffice 安裝成功（需要重啟系統）');
          Result := True;
        end
        else
        begin
          Log('LibreOffice 安裝失敗，返回碼: ' + IntToStr(ResultCode));
          MsgBox('安裝 LibreOffice 時出現錯誤。' + #13#10 +
                 '返回碼: ' + IntToStr(ResultCode) + #13#10 + #13#10 +
                 '您可以稍後手動安裝 LibreOffice。',
                 mbError, MB_OK);
          Result := False;
        end;
      end
      else
      begin
        Log('無法執行 LibreOffice 安裝程序');
        MsgBox('無法執行 LibreOffice 安裝程序。' + #13#10 +
               '請檢查是否有管理員權限。', mbError, MB_OK);
        Result := False;
      end;
    end;
    
    // 清理下載的安裝文件
    if FileExists(DownloadPath) then
    begin
      DeleteFile(DownloadPath);
      Log('已清理下載的安裝文件');
    end;
  except
    Log('下載或安裝 LibreOffice 時發生異常');
    Result := False;
    
    // 確保清理下載文件
    if FileExists(DownloadPath) then
    begin
      DeleteFile(DownloadPath);
    end;
  end;
end;

// 在初始化後設置安裝目錄
function InitializeSetup: Boolean;
var
  ErrorCode: Integer;
begin
  Result := True;
  
  Log('開始檢查 .NET Runtime...');
  
  // 檢查 .NET Runtime 是否已安裝
  if not IsDotNetRuntimeInstalled then
  begin
    Log('.NET Runtime 未安裝，準備下載並安裝');
    
    if MsgBox('檢測到系統未安裝 ASP.NET Core 8.0 Runtime。' + #13#10 + #13#10 +
              '此應用程序需要 ASP.NET Core 8.0 Runtime 才能運行。' + #13#10 + #13#10 +
              '是否現在自動下載並安裝最新版本？' + #13#10 + #13#10 +
              '點擊「是」將自動下載並安裝最新版本的 ASP.NET Core Runtime 8.0.x' + #13#10 +
              '（約 70-80 MB，需要管理員權限和網絡連接）。' + #13#10 +
              '點擊「否」將取消安裝程序，請手動安裝後再運行。',
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      Log('用戶選擇自動安裝 ASP.NET Core Runtime');
      
      if not DownloadAndInstallDotNetRuntime then
      begin
        Log('ASP.NET Core Runtime 安裝失敗');
        if MsgBox('無法自動安裝 ASP.NET Core Runtime。' + #13#10 + #13#10 +
                  '請手動安裝 ASP.NET Core 8.0 Runtime 後再運行安裝程序。' + #13#10 + #13#10 +
                  '是否現在打開下載頁面？',
                  mbConfirmation, MB_YESNO) = IDYES then
        begin
          ShellExec('open', 'https://dotnet.microsoft.com/download/dotnet/8.0', '', '', SW_SHOW, ewNoWait, ErrorCode);
        end;
        Result := False;
        Exit;
      end;
      
      Log('ASP.NET Core Runtime 安裝成功，繼續安裝流程');
      MsgBox('ASP.NET Core Runtime 8.0（最新版本）安裝完成！' + #13#10 +
             '現在將繼續安裝 WhatoFlow。', mbInformation, MB_OK);
    end
    else
    begin
      Log('用戶選擇取消安裝');
      if MsgBox('安裝程序需要 ASP.NET Core 8.0 Runtime。' + #13#10 + #13#10 +
                '是否打開下載頁面手動安裝？',
                mbConfirmation, MB_YESNO) = IDYES then
      begin
        ShellExec('open', 'https://dotnet.microsoft.com/download/dotnet/8.0', '', '', SW_SHOW, ewNoWait, ErrorCode);
      end;
      Result := False;
      Exit;
    end;
  end
  else
  begin
    Log('ASP.NET Core Runtime 已安裝，繼續安裝流程');
  end;
  
  // 檢查 LibreOffice（可選組件，用於文檔轉換功能）
  Log('開始檢查 LibreOffice...');
  if not IsLibreOfficeInstalled then
  begin
    Log('LibreOffice 未安裝，提示用戶是否安裝');
    
    if MsgBox('檢測到系統未安裝 LibreOffice。' + #13#10 + #13#10 +
              'LibreOffice 用於文檔轉換功能（Word、Excel、PDF 等轉換為 HTML）。' + #13#10 + #13#10 +
              '是否現在自動下載並安裝？' + #13#10 + #13#10 +
              '點擊「是」將自動下載並安裝（約 300-400 MB，需要管理員權限和網絡連接）。' + #13#10 +
              '點擊「否」將跳過，您可以稍後手動安裝。',
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      Log('用戶選擇自動安裝 LibreOffice');
      
      if not DownloadAndInstallLibreOffice then
      begin
        Log('LibreOffice 安裝失敗或取消');
        if MsgBox('無法自動安裝 LibreOffice。' + #13#10 + #13#10 +
                  '文檔轉換功能將無法使用，但系統其他功能不受影響。' + #13#10 + #13#10 +
                  '是否現在打開下載頁面手動安裝？',
                  mbConfirmation, MB_YESNO) = IDYES then
        begin
          ShellExec('open', 'https://www.libreoffice.org/download/download/', '', '', SW_SHOW, ewNoWait, ErrorCode);
        end;
        // 不阻止安裝繼續，因為 LibreOffice 是可選的
      end
      else
      begin
        Log('LibreOffice 安裝成功');
        MsgBox('LibreOffice 安裝完成！' + #13#10 +
               '文檔轉換功能現已可用。', mbInformation, MB_OK);
      end;
    end
    else
    begin
      Log('用戶選擇跳過 LibreOffice 安裝');
      // 不阻止安裝繼續
    end;
  end
  else
  begin
    Log('LibreOffice 已安裝，文檔轉換功能可用');
  end;
end;

// 獲取 HTTP 端口（用於服務安裝腳本）
function GetHttpPort(Param: String): String;
begin
  Result := UserHttpPort;
  if Length(Result) = 0 then
    Result := '64213';
end;


