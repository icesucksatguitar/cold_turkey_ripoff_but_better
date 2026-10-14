$paths = @(
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:AppData\Microsoft\Windows\Start Menu\Programs",
  "$env:LocalAppData\Programs"
)

$sh = New-Object -ComObject WScript.Shell
$results = [System.Collections.Generic.List[PSCustomObject]]::new()
$seenExe = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

# Ignore uninstallers, helpers, updaters, and system infrastructure
$ignoreKeywords = @('uninstall', 'uninst', 'setup', 'update', 'helper', 'crash', 'report', 'installer', 'diagnostics', 'administrative', 'redistributable', 'runtime', 'language preferences')
$ignoreExes = @(
  'cmd.exe', 'powershell.exe', 'pwsh.exe', 'explorer.exe', 'dwm.exe', 'taskmgr.exe',
  'conhost.exe', 'svchost.exe', 'electron.exe', 'focusguard.exe', 'code.exe', 'regedit.exe',
  'perfmon.exe', 'cleanmgr.exe', 'dfrgui.exe', 'mdsched.exe', 'charmap.exe', 'mstsc.exe',
  'msconfig.exe', 'msinfo32.exe', 'psr.exe', 'osk.exe', 'narrator.exe', 'magnify.exe',
  'voiceaccess.exe', 'livecaptions.exe', 'iscsicpl.exe', 'odbcad32.exe', 'recoverydrive.exe',
  'msiexec.exe', 'oalinst.exe', 'officeclicktorun.exe'
)

# 1. Start Menu Shortcuts
foreach ($folder in $paths) {
  if (Test-Path $folder) {
    $shortcuts = Get-ChildItem -Path $folder -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue
    foreach ($item in $shortcuts) {
      try {
        $target = $sh.CreateShortcut($item.FullName).TargetPath
        if ($target -and $target.EndsWith('.exe', [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $target)) {
          $exeName = [System.IO.Path]::GetFileName($target)
          $lowerExe = $exeName.ToLowerInvariant()
          $lowerName = $item.BaseName.ToLowerInvariant()

          $shouldIgnore = $false
          foreach ($k in $ignoreKeywords) {
            if ($lowerName.Contains($k) -or $lowerExe.Contains($k)) {
              $shouldIgnore = $true
              break
            }
          }
          if ($ignoreExes -contains $lowerExe) {
            $shouldIgnore = $true
          }

          if (-not $shouldIgnore -and -not $seenExe.Contains($lowerExe)) {
            $seenExe.Add($lowerExe) | Out-Null
            $results.Add([PSCustomObject]@{
              name = $item.BaseName
              executableName = $exeName
              path = $target
            })
          }
        }
      } catch {}
    }
  }
}

# 2. Registry Installed Applications (HKLM & HKCU)
$regPaths = @(
  "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

foreach ($rp in $regPaths) {
  try {
    $apps = Get-ItemProperty $rp -ErrorAction SilentlyContinue
    foreach ($app in $apps) {
      $dispName = $app.DisplayName
      if (-not $dispName -or $dispName.Trim() -eq '') { continue }
      if ($app.SystemComponent -eq 1 -or $app.ParentKeyName) { continue }

      # Try to locate executable from DisplayIcon or InstallLocation
      $targetExe = $null
      if ($app.DisplayIcon) {
        $iconPath = $app.DisplayIcon.Split(',')[0].Trim('"')
        if ($iconPath.EndsWith('.exe', [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $iconPath)) {
          $targetExe = $iconPath
        }
      }

      if (-not $targetExe -and $app.InstallLocation -and (Test-Path $app.InstallLocation)) {
        $foundExes = Get-ChildItem -Path $app.InstallLocation -Filter '*.exe' -File -ErrorAction SilentlyContinue |
          Where-Object { -not ($_.Name -match 'unins|setup|update|helper|crash') } |
          Select-Object -First 1
        if ($foundExes) {
          $targetExe = $foundExes.FullName
        }
      }

      if ($targetExe) {
        $exeName = [System.IO.Path]::GetFileName($targetExe)
        $lowerExe = $exeName.ToLowerInvariant()
        $lowerName = $dispName.ToLowerInvariant()

        $shouldIgnore = $false
        if ($lowerExe -match '^unins|^vc_redist|^vcredist|^dotnet|^windowsdesktop|^setup|^install') {
          $shouldIgnore = $true
        }
        foreach ($k in $ignoreKeywords) {
          if ($lowerName.Contains($k) -or $lowerExe.Contains($k)) {
            $shouldIgnore = $true
            break
          }
        }
        if ($ignoreExes -contains $lowerExe) {
          $shouldIgnore = $true
        }

        if (-not $shouldIgnore -and -not $seenExe.Contains($lowerExe)) {
          $seenExe.Add($lowerExe) | Out-Null
          $results.Add([PSCustomObject]@{
            name = $dispName.Trim()
            executableName = $exeName
            path = $targetExe
          })
        }
      }
    }
  } catch {}
}

# 3. Add active running GUI applications with window titles
try {
  $running = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne '' }
  foreach ($proc in $running) {
    try {
      $pPath = $proc.Path
      $exeName = [System.IO.Path]::GetFileName($pPath)
      if ($exeName -and -not $seenExe.Contains($exeName.ToLowerInvariant())) {
        $lowerExe = $exeName.ToLowerInvariant()
        if (-not ($ignoreExes -contains $lowerExe)) {
          $seenExe.Add($lowerExe) | Out-Null
          $friendlyName = if ($proc.Description) { $proc.Description } else { $proc.ProcessName }
          $results.Add([PSCustomObject]@{
            name = $friendlyName
            executableName = $exeName
            path = $pPath
          })
        }
      }
    } catch {}
  }
} catch {}

$results | Sort-Object name | ConvertTo-Json -Compress
