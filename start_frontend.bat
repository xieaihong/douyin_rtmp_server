@echo off
echo [信息] 正在启动前端开发服务器 (端口: 8080)...
echo [信息] 当前目录: %~dp0

:: 检查 Node.js 是否安装
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

:: 进入前端目录
cd frontend
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到前端目录
    cd ..
    pause
    exit /b 1
)

:: 检查是否需要安装依赖
if not exist "node_modules" (
    echo [信息] 首次运行，正在安装依赖...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [错误] 依赖安装失败
        cd ..
        pause
        exit /b 1
    )
)

:: 启动开发服务器
echo [信息] 正在启动开发服务器...
echo [信息] 服务器启动后将自动打开浏览器访问 http://localhost:8080
call npm run dev

:: 如果服务器异常退出，保持窗口打开
if %ERRORLEVEL% neq 0 (
    echo [错误] 服务器异常退出，错误代码: %ERRORLEVEL%
    cd ..
    pause
    exit /b 1
)

cd ..
pause 