# Runs the whole Worldly suite on this PC: starts the emulator if no device is connected,
# runs API/database + UI tests, rebuilds the Excel tracker with the results and keeps a log.
# Used by the Windows scheduled task (see register-task.ps1), but can be run by hand too.
param(
  [string]$Avd = 'worldly_api28',
  [switch]$DownloadLatestApp
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
New-Item -ItemType Directory -Force -Path "$repo\reports\history" | Out-Null
$log = "$repo\reports\history\run_$stamp.log"
Start-Transcript -Path $log | Out-Null

# Read ANDROID_HOME from .env if it isn't set
if (-not $env:ANDROID_HOME) {
  $line = Get-Content "$repo\.env" | Where-Object { $_ -match '^ANDROID_HOME=' } | Select-Object -First 1
  if ($line) { $env:ANDROID_HOME = $line.Substring(13) }
}
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$emulator = Join-Path $env:ANDROID_HOME 'emulator\emulator.exe'

$devices = & $adb devices | Select-String -Pattern "`tdevice$"
$startedEmulator = $null
if (-not $devices) {
  Write-Host "No device connected: starting emulator $Avd"
  $startedEmulator = Start-Process -FilePath $emulator -ArgumentList "-avd $Avd -no-snapshot-save -no-boot-anim -no-audio" -PassThru
  & $adb wait-for-device
  do { Start-Sleep -Seconds 5; $boot = (& $adb shell getprop sys.boot_completed).Trim() } while ($boot -ne '1')
}

if ($DownloadLatestApp) { npm run app:download }
npm run test:all
$code = $LASTEXITCODE
npm run testcases:excel

if ($startedEmulator) { & $adb emu kill }
Stop-Transcript | Out-Null
exit $code
