# Registers a Windows scheduled task that runs the Worldly suite twice a day on this PC
# (only while you are signed in, so the emulator window can open).
#   powershell -ExecutionPolicy Bypass -File scripts\windows\register-task.ps1 -Times 07:00,19:00
# Remove it with:  Unregister-ScheduledTask -TaskName 'Worldly Appium suite' -Confirm:$false
param(
  [string[]]$Times = @('07:00', '19:00'),
  [string]$Avd = 'worldly_api28'
)

$script = Join-Path $PSScriptRoot 'run-scheduled.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Avd $Avd -DownloadLatestApp"
$triggers = $Times | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3) -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'Worldly Appium suite' -Action $action -Trigger $triggers -Settings $settings -Description 'Worldly API, database and Android UI tests' -Force
Write-Host "Scheduled at $($Times -join ', '). Logs: reports\history"
