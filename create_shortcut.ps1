$ws = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path $PSScriptRoot "FocusGuard.lnk"
$s = $ws.CreateShortcut($shortcutPath)
$targetExe = Join-Path $PSScriptRoot "release-build\win-unpacked\FocusGuard.exe"
if (!(Test-Path $targetExe)) {
    $targetExe = Join-Path $PSScriptRoot "release\win-unpacked\FocusGuard.exe"
}
$s.TargetPath = $targetExe
$s.WorkingDirectory = Split-Path $targetExe -Parent
$s.IconLocation = Join-Path $PSScriptRoot "assets\icon.ico"
$s.Description = "FocusGuard - Local Windows Productivity Blocker"
$s.Save()
Write-Output "Shortcut successfully created at $shortcutPath pointing to $targetExe"
