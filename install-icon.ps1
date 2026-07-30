[CmdletBinding()]
param(
  [switch]$Open
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$electron = Join-Path $repoRoot 'node_modules\electron\dist\electron.exe'
$iconSource = Join-Path $repoRoot 'icons\persona.ico'

if (-not (Test-Path -LiteralPath $electron)) {
  throw 'Electron is not installed. Run npm install in the Persona repository first.'
}
if (-not (Test-Path -LiteralPath $iconSource)) {
  throw "Persona icon not found: $iconSource"
}

$installDirectory = Join-Path $env:LOCALAPPDATA 'Persona'
$installedIcon = Join-Path $installDirectory 'persona.ico'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Persona.lnk'

New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
Copy-Item -LiteralPath $iconSource -Destination $installedIcon -Force

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $electron
$shortcut.Arguments = '"' + $repoRoot + '" --settings'
$shortcut.WorkingDirectory = $repoRoot
$shortcut.IconLocation = "$installedIcon,0"
$shortcut.Description = 'Open Persona and deploy a character'
$shortcut.Save()

Write-Host "Persona shortcut installed: $shortcutPath"

if ($Open) {
  Start-Process -FilePath $shortcutPath
}
