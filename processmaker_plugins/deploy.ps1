[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$ProcessMakerEngine = "C:\pmlearning\bpms\workflow\engine"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$pluginSource = $PSScriptRoot
$sourceEntrypoint = Join-Path $pluginSource "emcoreTodo.php"
$sourceDirectory = Join-Path $pluginSource "emcoreTodo"
$pluginsDirectory = Join-Path $ProcessMakerEngine "plugins"
$targetEntrypoint = Join-Path $pluginsDirectory "emcoreTodo.php"
$targetDirectory = Join-Path $pluginsDirectory "emcoreTodo"
$interfaceFunctions = Join-Path $pluginsDirectory "interface\public_html\assets\core\functions.js"
$backupBase = Join-Path $pluginsDirectory ".emcoreTodo-backups"
$stateFile = Join-Path $pluginsDirectory ".emcoreTodo-deployment.json"

$requiredPaths = @(
    $sourceEntrypoint,
    $sourceDirectory,
    (Join-Path $sourceDirectory "public_html\todoWidget.js"),
    $interfaceFunctions
)

foreach ($requiredPath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required path not found: $requiredPath"
    }
}

if (Test-Path -LiteralPath $stateFile) {
    throw "A deployment state already exists at $stateFile. Run rollback.ps1 before deploying again."
}

if (-not $PSCmdlet.ShouldProcess($pluginsDirectory, "Deploy EMCORE Todo 0.1.1 and install the interface loader")) {
    return
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDirectory = Join-Path $backupBase $timestamp
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

$hadEntrypoint = Test-Path -LiteralPath $targetEntrypoint
$hadPluginDirectory = Test-Path -LiteralPath $targetDirectory

if ($hadEntrypoint) {
    Copy-Item -LiteralPath $targetEntrypoint -Destination (Join-Path $backupDirectory "emcoreTodo.php") -Force
}
if ($hadPluginDirectory) {
    Copy-Item -LiteralPath $targetDirectory -Destination (Join-Path $backupDirectory "emcoreTodo") -Recurse -Force
}
Copy-Item -LiteralPath $interfaceFunctions -Destination (Join-Path $backupDirectory "interface-functions.js") -Force

$deploymentState = [ordered]@{
    Version = "0.1.1"
    CreatedAt = (Get-Date).ToString("o")
    BackupDirectory = $backupDirectory
    HadEntrypoint = $hadEntrypoint
    HadPluginDirectory = $hadPluginDirectory
}
$deploymentState | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupDirectory "manifest.json") -Encoding UTF8
$deploymentState | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8

Copy-Item -LiteralPath $sourceEntrypoint -Destination $targetEntrypoint -Force
if (-not (Test-Path -LiteralPath $targetDirectory)) {
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
}
Copy-Item -Path (Join-Path $sourceDirectory "*") -Destination $targetDirectory -Recurse -Force

$loaderBegin = "/* EMCORE_TODO_LOADER_BEGIN */"
$functionsContent = [System.IO.File]::ReadAllText($interfaceFunctions)
if (-not $functionsContent.Contains($loaderBegin)) {
    $loader = @'
/* EMCORE_TODO_LOADER_BEGIN */
(function (document) {
  var id = 'emcore-todo-interface-loader';
  if (window.top !== window.self || document.getElementById(id)) {
    return;
  }
  var script = document.createElement('script');
  script.id = id;
  script.src = '/plugin/emcoreTodo/todoWidget.js?v=0.1.1';
  script.async = true;
  (document.head || document.getElementsByTagName('head')[0]).appendChild(script);
}(document));
/* EMCORE_TODO_LOADER_END */
'@
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::AppendAllText($interfaceFunctions, [Environment]::NewLine + $loader + [Environment]::NewLine, $utf8WithoutBom)
}

Write-Host "EMCORE Todo 0.1.1 deployed successfully." -ForegroundColor Green
Write-Host "Backup: $backupDirectory"
Write-Host "Next: re-enable EMCORE Todo in Plugins Manager, then press Ctrl+F5."
