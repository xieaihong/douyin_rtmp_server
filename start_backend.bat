@echo off
echo [信息] 正在启动后端服务器 (端口: 3000)...
echo [信息] 当前目录: %~dp0

:: 检查 Node.js 是否安装
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

:: 检查是否需要安装依赖
if not exist "node_modules" (
    echo [信息] 首次运行，正在安装依赖...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

:: 启动服务器
echo [信息] 正在启动服务器...
call npm run dev

:: 如果服务器异常退出，保持窗口打开
if %ERRORLEVEL% neq 0 (
    echo [错误] 服务器异常退出，错误代码: %ERRORLEVEL%
    pause
    exit /b 1
)

pause 