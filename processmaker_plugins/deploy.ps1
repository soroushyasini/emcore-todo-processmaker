[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$ProcessMakerEngine = "C:\pmlearning\bpms\workflow\engine"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$version = "0.3.1"
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
    (Join-Path $sourceDirectory "todoApi.php"),
    (Join-Path $sourceDirectory "classes\class.todoRepository.php"),
    (Join-Path $sourceDirectory "data\schema.sql"),
    (Join-Path $sourceDirectory "public_html\todoWidget.js"),
    $interfaceFunctions
)

foreach ($requiredPath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required path not found: $requiredPath"
    }
}

if (-not $PSCmdlet.ShouldProcess($pluginsDirectory, "Deploy EMCORE Todo $version and update the interface loader")) {
    return
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
$backupDirectory = Join-Path $backupBase $timestamp
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

$hadEntrypoint = Test-Path -LiteralPath $targetEntrypoint
$hadPluginDirectory = Test-Path -LiteralPath $targetDirectory
$hadDeploymentState = Test-Path -LiteralPath $stateFile

if ($hadEntrypoint) {
    Copy-Item -LiteralPath $targetEntrypoint -Destination (Join-Path $backupDirectory "emcoreTodo.php") -Force
}
if ($hadPluginDirectory) {
    Copy-Item -LiteralPath $targetDirectory -Destination (Join-Path $backupDirectory "emcoreTodo") -Recurse -Force
}
if ($hadDeploymentState) {
    Copy-Item -LiteralPath $stateFile -Destination (Join-Path $backupDirectory "previous-deployment-state.json") -Force
}
Copy-Item -LiteralPath $interfaceFunctions -Destination (Join-Path $backupDirectory "interface-functions.js") -Force

$deploymentState = [ordered]@{
    Version = $version
    CreatedAt = (Get-Date).ToString("o")
    BackupDirectory = $backupDirectory
    HadEntrypoint = $hadEntrypoint
    HadPluginDirectory = $hadPluginDirectory
    HadDeploymentState = $hadDeploymentState
}
$deploymentState | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupDirectory "manifest.json") -Encoding UTF8
$deploymentState | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8

Copy-Item -LiteralPath $sourceEntrypoint -Destination $targetEntrypoint -Force
if (-not (Test-Path -LiteralPath $targetDirectory)) {
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
}
Copy-Item -Path (Join-Path $sourceDirectory "*") -Destination $targetDirectory -Recurse -Force

$loaderBegin = "/* EMCORE_TODO_LOADER_BEGIN */"
$loaderEnd = "/* EMCORE_TODO_LOADER_END */"
$loader = @"
/* EMCORE_TODO_LOADER_BEGIN */
(function (document) {
  var id = 'emcore-todo-interface-loader';
  if (window.top !== window.self || document.getElementById(id)) {
    return;
  }
  var script = document.createElement('script');
  script.id = id;
  script.src = '/plugin/emcoreTodo/todoWidget.js?v=$version';
  script.async = true;
  (document.head || document.getElementsByTagName('head')[0]).appendChild(script);
}(document));
/* EMCORE_TODO_LOADER_END */
"@

$functionsContent = [System.IO.File]::ReadAllText($interfaceFunctions)
$loaderStart = $functionsContent.IndexOf($loaderBegin, [System.StringComparison]::Ordinal)
$updatedFunctions = $functionsContent

if ($loaderStart -ge 0) {
    $loaderFinish = $functionsContent.IndexOf($loaderEnd, $loaderStart, [System.StringComparison]::Ordinal)
    if ($loaderFinish -lt 0) {
        throw "The EMCORE Todo loader start marker exists without its end marker. Roll back before retrying."
    }
    $loaderFinish += $loaderEnd.Length
    $updatedFunctions =
        $functionsContent.Substring(0, $loaderStart) +
        $loader +
        $functionsContent.Substring($loaderFinish)
}
else {
    $updatedFunctions = $functionsContent + [Environment]::NewLine + $loader + [Environment]::NewLine
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($interfaceFunctions, $updatedFunctions, $utf8WithoutBom)

Write-Host "EMCORE Todo $version deployed successfully." -ForegroundColor Green
Write-Host "Backup: $backupDirectory"
Write-Host "Next: disable and re-enable EMCORE Todo so ProcessMaker upgrades the Todo schema, then press Ctrl+F5."
