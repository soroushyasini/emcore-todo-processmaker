[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$ProcessMakerEngine = "C:\pmlearning\bpms\workflow\engine"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$pluginsDirectory = Join-Path $ProcessMakerEngine "plugins"
$targetEntrypoint = Join-Path $pluginsDirectory "emcoreTodo.php"
$targetDirectory = Join-Path $pluginsDirectory "emcoreTodo"
$interfaceFunctions = Join-Path $pluginsDirectory "interface\public_html\assets\core\functions.js"
$backupBase = Join-Path $pluginsDirectory ".emcoreTodo-backups"
$stateFile = Join-Path $pluginsDirectory ".emcoreTodo-deployment.json"

if (-not (Test-Path -LiteralPath $stateFile)) {
    throw "No EMCORE Todo deployment state was found at $stateFile."
}

$state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
$backupDirectory = [System.IO.Path]::GetFullPath([string]$state.BackupDirectory)
$allowedBackupRoot = [System.IO.Path]::GetFullPath($backupBase).TrimEnd([char]92) + [System.IO.Path]::DirectorySeparatorChar

if (-not $backupDirectory.StartsWith($allowedBackupRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing rollback because the recorded backup is outside $backupBase."
}

$backupFunctions = Join-Path $backupDirectory "interface-functions.js"
if (-not (Test-Path -LiteralPath $backupFunctions)) {
    throw "Interface backup not found: $backupFunctions"
}

if (-not $PSCmdlet.ShouldProcess($pluginsDirectory, "Rollback EMCORE Todo deployment $($state.Version)")) {
    return
}

Copy-Item -LiteralPath $backupFunctions -Destination $interfaceFunctions -Force

if ([bool]$state.HadEntrypoint) {
    $backupEntrypoint = Join-Path $backupDirectory "emcoreTodo.php"
    if (-not (Test-Path -LiteralPath $backupEntrypoint)) {
        throw "Entrypoint backup not found: $backupEntrypoint"
    }
    Copy-Item -LiteralPath $backupEntrypoint -Destination $targetEntrypoint -Force
}
elseif (Test-Path -LiteralPath $targetEntrypoint) {
    Remove-Item -LiteralPath $targetEntrypoint -Force
}

if (Test-Path -LiteralPath $targetDirectory) {
    Remove-Item -LiteralPath $targetDirectory -Recurse -Force
}
if ([bool]$state.HadPluginDirectory) {
    $backupPluginDirectory = Join-Path $backupDirectory "emcoreTodo"
    if (-not (Test-Path -LiteralPath $backupPluginDirectory)) {
        throw "Plugin directory backup not found: $backupPluginDirectory"
    }
    Copy-Item -LiteralPath $backupPluginDirectory -Destination $targetDirectory -Recurse -Force
}

Remove-Item -LiteralPath $stateFile -Force

Write-Host "EMCORE Todo rollback completed." -ForegroundColor Green
Write-Host "Backup retained for audit: $backupDirectory"
Write-Host "Next: refresh Plugins Manager and press Ctrl+F5."
