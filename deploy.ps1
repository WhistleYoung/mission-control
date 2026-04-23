# OpenClaw Panel 一键部署脚本 (Windows)
# 使用方法：右键 → 用 PowerShell 运行 → 输入：.\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OpenClaw Panel 一键部署脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检测 Node.js
Write-Host "[1/7] 检测 Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "  未安装 Node.js，正在下载..." -ForegroundColor Red
    $nodeInstaller = "$env:TEMP\nodejs-installer.exe"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile $nodeInstaller -UseBasicParsing
    Start-Process -FilePath $nodeInstaller -ArgumentList "/quiet" -Wait
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue
    Write-Host "  Node.js 安装完成" -ForegroundColor Green
} else {
    Write-Host "  已安装: $nodeVersion" -ForegroundColor Green
}

# 检测 npm
Write-Host "[2/7] 检测 npm..." -ForegroundColor Yellow
$npmVersion = npm --version 2>$null
if (-not $npmVersion) {
    Write-Host "  npm 未找到，请重新安装 Node.js" -ForegroundColor Red
    exit 1
}
Write-Host "  npm: $npmVersion" -ForegroundColor Green

# 克隆项目
Write-Host "[3/7] 克隆项目..." -ForegroundColor Yellow
$projectPath = "$env:USERPROFILE\mission-control"
if (Test-Path $projectPath) {
    Write-Host "  项目已存在，跳过克隆" -ForegroundColor Green
} else {
    git clone https://github.com/WhistleYoung/mission-control.git $projectPath
    if ($LASTEXITCODE -ne 0) { git clone https://gitee.com/whistleyoung/mission-control.git $projectPath }
    Write-Host "  克隆完成" -ForegroundColor Green
}

# 安装依赖
Write-Host "[4/7] 安装依赖..." -ForegroundColor Yellow
Set-Location $projectPath
npm install 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  npm install 失败，尝试安装编译工具..." -ForegroundColor Red
    npm install -g windows-build-tools 2>&1 | Out-Null
    npm install 2>&1 | Out-Null
}
Write-Host "  依赖安装完成" -ForegroundColor Green

# 构建
Write-Host "[5/7] 构建生产版本..." -ForegroundColor Yellow
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  构建失败！" -ForegroundColor Red
    exit 1
}
Write-Host "  构建完成" -ForegroundColor Green

# 创建启动脚本
$startScript = @"
@echo off
cd /d %~dp0
npm start
"@
$startScript | Out-File -FilePath "$projectPath\start.bat" -Encoding ASCII

# 完成
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  部署完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  项目路径: $projectPath" -ForegroundColor White
Write-Host "  启动命令: cd $projectPath; npm start" -ForegroundColor White
Write-Host "  或双击: start.bat" -ForegroundColor White
Write-Host ""
Write-Host "  访问地址: http://localhost:10086" -ForegroundColor White
Write-Host "  账号: admin  密码: admin123" -ForegroundColor White
Write-Host ""
Write-Host "  按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")