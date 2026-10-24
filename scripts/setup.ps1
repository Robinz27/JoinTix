# JoinTix setup for Windows. Run via setup.cmd (double-click) or:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = "Stop"
$RequiredMajor = 22
Set-Location (Split-Path $PSScriptRoot -Parent)

function Get-NodeMajor {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return 0 }
  return [int]((& node -v).TrimStart("v").Split(".")[0])
}

function Update-SessionPath {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [Environment]::GetEnvironmentVariable("Path", "User")
}

Write-Host "== JoinTix setup ==" -ForegroundColor Cyan

# 1. Node.js
if ((Get-NodeMajor) -lt $RequiredMajor) {
  Write-Host "Node.js $RequiredMajor+ not found."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    $answer = Read-Host "Install Node.js LTS now with winget? (Y/n)"
    if ($answer -eq "" -or $answer -match "^[Yy]") {
      winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
      Update-SessionPath
    }
  }
  if ((Get-NodeMajor) -lt $RequiredMajor) {
    Write-Host "Please install Node.js $RequiredMajor LTS from https://nodejs.org then run setup again." -ForegroundColor Yellow
    exit 1
  }
}
Write-Host "Node.js $(node -v) OK" -ForegroundColor Green

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
Write-Host "Done. Start the app with:  npm run dev" -ForegroundColor Cyan
Write-Host "Then open http://localhost:3000/api/health"
