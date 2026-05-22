# Stop Expo/Metro and API dev servers before running this script.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Removing node_modules and lockfile..."
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
Get-ChildItem -Path apps, packages, services -Directory -Recurse -Filter node_modules -ErrorAction SilentlyContinue |
  ForEach-Object { Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue }
Remove-Item -Recurse -Force apps\mobile-app\.expo -ErrorAction SilentlyContinue

Write-Host "Installing dependencies (react pinned to 19.1.0 via root overrides)..."
npm install --no-audit --no-fund

Write-Host "Verifying single React..."
npm run verify:react

Write-Host "Done. Start mobile with: npm run dev:mobile:clear"
