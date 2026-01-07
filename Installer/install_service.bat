@echo off
setlocal enabledelayedexpansion

echo ====================================
echo WhatoFlow Windows Service ���b��ʽ
echo ������ǰ�� React ���ã�
echo ====================================
echo.

REM �O��׃��
set SERVICE_NAME=WhatoFlowService
set SERVICE_DISPLAY_NAME=WhatoFlow Web Service
set SERVICE_DESCRIPTION=WhatoFlow ���ó�ʽ����
set INSTALL_DIR=%~dp0..
set PUBLISH_DIR=%INSTALL_DIR%publish
set EXE_NAME=WhatoFlow.exe

REM �z���Ƿ��Թ���T���ވ���
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [�e�`] Ո�Թ���T���ވ��д��_����
    echo ���I�c���˙n�����x����ϵ�y����T���ֈ��С�
    pause
    exit /b 1
)

echo [���E 1/8] �z�� .NET 10.0 Runtime �Ƿ��Ѱ��b...
where dotnet >nul 2>&1
if %errorLevel% neq 0 (
    echo [�e�`] δ�ҵ� .NET CLI��Ո�Ȱ��b .NET 10.0 Runtime �� SDK
    echo ���d�B�Y: https://dotnet.microsoft.com/download/dotnet/10.0
    pause
    exit /b 1
)

dotnet --version | findstr /R "^10\." >nul
if %errorLevel% neq 0 (
    echo [����] �ɜy���� .NET �汾���ܲ��� 10.0
    echo �^�m����...
)
echo [���] .NET Runtime �z��ͨ�^
echo.

echo [���E 2/8] �z�� Node.js �Ƿ��Ѱ��b...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [�e�`] δ�ҵ� Node.js��Ո�Ȱ��b Node.js 18 ����߰汾
    echo ���d�B�Y: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VERSION=%%v
echo [���] Node.js �汾: %NODE_VERSION%
echo.

echo [���E 3/8] ���bǰ����ه�׼�...
cd /d "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%node_modules" (
    echo [����] npm install...
    call npm install
    if %errorLevel% neq 0 (
        echo [�e�`] npm install ʧ��
        pause
        exit /b 1
    )
    echo [���] ǰ����ه���b�ɹ�
) else (
    echo [���^] node_modules �Ѵ��ڣ����^���b
)
echo.

echo [���E 4/8] ����ǰ�� React ���ó�ʽ...
echo [����] npm run build...
cd /d "%INSTALL_DIR%"
call npm run build
if %errorLevel% neq 0 (
    echo [�e�`] ǰ�˽���ʧ��
    pause
    exit /b 1
)
echo [���] ǰ�˽��óɹ�
echo.

echo [���E 5/8] �z������Ƿ��Ѵ���...
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo [�l�F] �����Ѵ��ڣ�����ֹͣ�K�h���f����...
    sc stop %SERVICE_NAME% >nul 2>&1
    timeout /t 3 /nobreak >nul
    sc delete %SERVICE_NAME%
    if %errorLevel% neq 0 (
        echo [�e�`] �o���h���f���գ�Ո�ք�̎��
        pause
        exit /b 1
    )
    echo [���] �f�����фh��
) else (
    echo [���] ���ղ����ڣ��������·���
)
echo.

echo [���E 6/8] �l�ё��ó�ʽ...
if exist "%PUBLISH_DIR%" (
    echo [����] �h���f�İl��Ŀ�...
    rmdir /s /q "%PUBLISH_DIR%"
)

cd /d "%INSTALL_DIR%"
dotnet publish PurpleRice.csproj -c Release -o "%PUBLISH_DIR%" --self-contained false
if %errorLevel% neq 0 (
    echo [�e�`] �l��ʧ��
    pause
    exit /b 1
)
echo [���] ���ó�ʽ�l�ѳɹ�
echo.

REM �}�uǰ�˽��ýY�����l��Ŀ䛵� wwwroot
echo [���E 7/8] �}�uǰ�˽��Ùn�����l��Ŀ�...
if exist "%INSTALL_DIR%build" (
    if exist "%PUBLISH_DIR%\wwwroot" (
        echo [����] �h���f�� wwwroot Ŀ�...
        rmdir /s /q "%PUBLISH_DIR%\wwwroot"
    )
    echo [�}�u] �}�u build Ŀ䛵� wwwroot...
    xcopy /E /I /Y "%INSTALL_DIR%build\*" "%PUBLISH_DIR%\wwwroot\" >nul
    if %errorLevel% equ 0 (
        echo [���] ǰ�˙n���}�u�ɹ�
    ) else (
        echo [����] ǰ�˙n���}�u�r���F���}���^�m����...
    )
) else (
    echo [����] δ�ҵ� build Ŀ䛣�Ո�_�Jǰ�˽����Ƿ�ɹ�
)
echo.

REM ������Ҫ��Ŀ�
echo [���E 8/8] ������Ҫ��Ŀ䛽Y��...
if not exist "%PUBLISH_DIR%\logs" mkdir "%PUBLISH_DIR%\logs"
if not exist "%PUBLISH_DIR%\Uploads" mkdir "%PUBLISH_DIR%\Uploads"
if not exist "%PUBLISH_DIR%\Uploads\Customer" mkdir "%PUBLISH_DIR%\Uploads\Customer"
if not exist "%PUBLISH_DIR%\Uploads\FormsFiles" mkdir "%PUBLISH_DIR%\Uploads\FormsFiles"
if not exist "%PUBLISH_DIR%\Uploads\FormsFiles\Documents" mkdir "%PUBLISH_DIR%\Uploads\FormsFiles\Documents"
if not exist "%PUBLISH_DIR%\Uploads\avatars" mkdir "%PUBLISH_DIR%\Uploads\avatars"
if not exist "%PUBLISH_DIR%\Uploads\company_logo" mkdir "%PUBLISH_DIR%\Uploads\company_logo"
if not exist "%PUBLISH_DIR%\Uploads\excel" mkdir "%PUBLISH_DIR%\Uploads\excel"
if not exist "%PUBLISH_DIR%\Uploads\Whatsapp_Images" mkdir "%PUBLISH_DIR%\Uploads\Whatsapp_Images"
echo [���] Ŀ䛽Y���������
echo.

REM �]�� Windows Service
echo [�]��] �]�� Windows Service...
sc create %SERVICE_NAME% binPath= "%PUBLISH_DIR%\%EXE_NAME%" DisplayName= "%SERVICE_DISPLAY_NAME%" start= auto

if %errorLevel% neq 0 (
    echo [�e�`] �����]��ʧ��
    pause
    exit /b 1
)
echo [���] �����]�Գɹ�
echo.

REM �O����������
sc description %SERVICE_NAME% "%SERVICE_DESCRIPTION%"

REM ���ӷ���
echo [����] ���ӷ���...
sc start %SERVICE_NAME%
if %errorLevel% neq 0 (
    echo [�e�`] ���Ն���ʧ����Ո�z�����I
    echo ������ʹ����������z����ՠ�B��
    echo   sc query %SERVICE_NAME%
    pause
    exit /b 1
)

timeout /t 2 /nobreak >nul
sc query %SERVICE_NAME% | findstr /C:"RUNNING" >nul
if %errorLevel% equ 0 (
    echo [���] ���Ն��ӳɹ���
) else (
    echo [����] ���տ���δ�������ӣ�Ո�z���B
)
echo.

echo ====================================
echo ���b��ɣ�
echo ====================================
echo �������Q: %SERVICE_NAME%
echo ����·��: %PUBLISH_DIR%
echo ���Йn: %EXE_NAME%
echo.
echo �������
echo   ��ԃ��B: sc query %SERVICE_NAME%
echo   ֹͣ����: sc stop %SERVICE_NAME%
echo   ���ӷ���: sc start %SERVICE_NAME%
echo   �h������: sc delete %SERVICE_NAME%
echo.
echo ǰ�˙n��λ��: %PUBLISH_DIR%\wwwroot
echo.
pause
