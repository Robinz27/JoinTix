# Starts the JoinTix dev server, running setup first if needed. Used by start.cmd.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

# Pick up Node.js even if it was installed after this window opened.
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Get-Command npm -ErrorAction SilentlyContinue) -or -not (Test-Path "node_modules")) {
  & "$PSScriptRoot\setup.ps1" -NoStart
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Starting JoinTix... open http://localhost:3000 once it is ready. Press Ctrl+C to stop." -ForegroundColor Cyan
npm run dev
