$assetsDir = Join-Path $PSScriptRoot "..\apps\mobile-app\assets"
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
Add-Type -AssemblyName System.Drawing
foreach ($name in @("icon.png", "adaptive-icon.png", "splash-icon.png")) {
  $bmp = New-Object System.Drawing.Bitmap 1024, 1024
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(255, 0, 105, 72))
  $g.Dispose()
  $path = Join-Path $assetsDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $path"
}
