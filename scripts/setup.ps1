# JoinTix setup for Windows. Run via setup.cmd (double-click) or:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
param([switch]$NoStart)
$ErrorActionPreference = "Stop"
$RequiredMajor = 22
Set-Location (Split-Path $PSScriptRoot -Parent)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Get-NodeMajor {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return 0 }
  return [int]((& node -v).TrimStart("v").Split(".")[0])
}

function Update-SessionPath {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [Environment]::GetEnvironmentVariable("Path", "User")
}

function Install-NodeWithWinget {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { return }
  Write-Host "Installing Node.js LTS with winget..."
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  Update-SessionPath
}

# Fallback when winget is missing or fails: official installer from nodejs.org.
function Install-NodeWithMsi {
  Write-Host "Downloading Node.js $RequiredMajor installer from nodejs.org..."
  $index = Invoke-RestMethod "https://nodejs.org/dist/index.json"
  $version = ($index | Where-Object { $_.version -like "v$RequiredMajor.*" } | Select-Object -First 1).version
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } elseif ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
  $msi = Join-Path $env:TEMP "node-$version-$arch.msi"
  Invoke-WebRequest "https://nodejs.org/dist/$version/node-$version-$arch.msi" -OutFile $msi -UseBasicParsing
  Write-Host "Running installer (accept the Windows admin prompt)..."
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /passive" -Wait
  Update-SessionPath
}

Write-Host "== JoinTix setup ==" -ForegroundColor Cyan

if ($PWD.Path -match "OneDrive") {
  Write-Host "Warning: this folder is inside OneDrive. OneDrive syncing node_modules is very slow" -ForegroundColor Yellow
  Write-Host "and can lock files. Moving the project to e.g. C:\Projects\JoinTix is recommended." -ForegroundColor Yellow
}

# 1. Node.js (npm comes with it)
if ((Get-NodeMajor) -lt $RequiredMajor) {
  Write-Host "Node.js $RequiredMajor+ not found."
  $answer = Read-Host "Install Node.js $RequiredMajor LTS now? (Y/n)"
  if ($answer -eq "" -or $answer -match "^[Yy]") {
    try { Install-NodeWithWinget } catch { Write-Host "winget failed: $_" -ForegroundColor Yellow }
    if ((Get-NodeMajor) -lt $RequiredMajor) { Install-NodeWithMsi }
  }
  if ((Get-NodeMajor) -lt $RequiredMajor) {
    Write-Host "Please install Node.js $RequiredMajor LTS from https://nodejs.org then run setup again." -ForegroundColor Yellow
    exit 1
  }
}
Write-Host "Node.js $(node -v) / npm $(npm -v) OK" -ForegroundColor Green

# 2. Dependencies
Write-Host "Installing dependencies (npm ci)..."
npm ci
if ($LASTEXITCODE -ne 0) { Write-Host "npm ci failed." -ForegroundColor Red; exit 1 }

# 3. .env.local
if (Test-Path ".env.local") {
  Write-Host ".env.local already exists, leaving it as is." -ForegroundColor Green
} else {
  Write-Host "Paste the Neon DATABASE_URL from the project owner (leave blank to skip):"
  $url = Read-Host "DATABASE_URL"
  if ($url) {
    $url = $url.Trim().Trim("'").Trim('"')
    [IO.File]::WriteAllText("$PWD\.env.local", "DATABASE_URL='$url'`n")
    Write-Host "Created .env.local" -ForegroundColor Green
  } else {
    Write-Host "Skipped. Create .env.local yourself before running the app." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Setup done. Next time just double-click start.cmd to run the app." -ForegroundColor Cyan
Write-Host "(If you use a terminal opened before setup, close and reopen it so 'npm' is found.)"

if (-not $NoStart) {
  $answer = Read-Host "Start the app now? (Y/n)"
  if ($answer -eq "" -or $answer -match "^[Yy]") {
    Write-Host "Open http://localhost:3000/api/health once it is ready. Press Ctrl+C to stop."
    npm run dev
  }
}
