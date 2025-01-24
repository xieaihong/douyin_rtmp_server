@echo off
echo [信息] 开始下载外部资源...

REM 创建资源目录
if not exist "frontend\public\assets" mkdir "frontend\public\assets"
if not exist "frontend\public\assets\lib" mkdir "frontend\public\assets\lib"

REM 下载 ECharts (使用多个备用源)
echo [信息] 正在下载 ECharts...

REM 尝试从 jsDelivr CDN 下载
curl -L --connect-timeout 10 "https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js" -o "frontend\public\assets\lib\echarts.min.js"
if %errorlevel% neq 0 (
    echo [警告] jsDelivr CDN 下载失败，尝试从 UNPKG...
    curl -L --connect-timeout 10 "https://unpkg.com/echarts@5.4.3/dist/echarts.min.js" -o "frontend\public\assets\lib\echarts.min.js"
    if %errorlevel% neq 0 (
        echo [警告] UNPKG 下载失败，尝试从 cdnjs...
        curl -L --connect-timeout 10 "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.3/echarts.min.js" -o "frontend\public\assets\lib\echarts.min.js"
        if %errorlevel% neq 0 (
            echo [错误] 所有下载源均失败！
            echo [提示] 请手动下载 ECharts 并将文件放置在 frontend\public\assets\lib\echarts.min.js
            echo [提示] 下载地址: https://github.com/apache/echarts/releases/download/5.4.3/echarts.min.js
            pause
            exit /b 1
        )
    )
)

REM 检查文件是否成功下载
if not exist "frontend\public\assets\lib\echarts.min.js" (
    echo [错误] ECharts 文件下载失败！
    echo [提示] 请检查网络连接后重试
    pause
    exit /b 1
)

REM 检查文件大小确保下载完整
for %%I in ("frontend\public\assets\lib\echarts.min.js") do set size=%%~zI
if %size% LSS 1000000 (
    echo [错误] ECharts 文件下载不完整！
    echo [提示] 请重新运行脚本或手动下载
    del "frontend\public\assets\lib\echarts.min.js"
    pause
    exit /b 1
)

REM 更新 index.html 中的引用
echo [信息] 正在更新资源引用...
powershell -Command "(Get-Content frontend\index.html) -replace 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js', '/assets/lib/echarts.min.js' | Set-Content frontend\index.html"

echo [信息] 外部资源下载完成！
echo [提示] 如果页面图表无法显示，请刷新浏览器缓存 (Ctrl+F5)
pause 