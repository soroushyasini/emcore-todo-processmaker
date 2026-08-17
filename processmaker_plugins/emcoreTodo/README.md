# EMCORE Todo 0.1.1

EMCORE Todo is a separate ProcessMaker 3.8 plugin that proves a private Todo
launcher can be displayed in the custom EMCORE interface. This phase does not
create tables, store tasks, or call an API.

The custom interface does not consume ProcessMaker's shared HeadPublisher
queue. Version 0.1.1 therefore keeps the plugin independent and installs one
small, marked loader in the interface's existing shared functions file.

## Automated deployment

Open PowerShell as Administrator:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
Set-Location "F:\codebase\emcore-todo-processmaker\processmaker_plugins"
.\deploy.ps1 -ProcessMakerEngine "C:\pmlearning\bpms\workflow\engine"
```

The deployment script:

- validates all source and target paths;
- refuses to run while an earlier deployment state is unresolved;
- backs up the previous plugin and interface functions file;
- copies `emcoreTodo.php` and the `emcoreTodo` directory;
- appends an idempotent, marked loader to
  `interface/public_html/assets/core/functions.js`;
- records the backup location in
  `plugins/.emcoreTodo-deployment.json`.

It never edits encoded PHP or ProcessMaker core files.

After it succeeds:

1. Open **Admin > Plugins > Plugins Manager**.
2. Disable and re-enable **EMCORE Todo**.
3. Sign in as a regular user and press `Ctrl+F5`.
4. Confirm the green **کارهای من** launcher appears at the bottom-right.

## Files deployed

```text
processmaker_plugins/emcoreTodo.php
  -> workflow/engine/plugins/emcoreTodo.php

processmaker_plugins/emcoreTodo/
  -> workflow/engine/plugins/emcoreTodo/

marked loader
  -> workflow/engine/plugins/interface/public_html/assets/core/functions.js
```

The browser-facing assets are served from:

```text
/plugin/emcoreTodo/todoWidget.js?v=0.1.1
/plugin/emcoreTodo/todo-widget.css?v=0.1.1
```

## Acceptance checks

Test the following pages in both available themes:

| Page | Expected result |
|---|---|
| Dashboard | One launcher in the outer page |
| My Cases | One launcher in the outer page |
| Open Case | One launcher outside the content iframe |
| Dynaform iframe | No duplicate launcher |
| Browser below 600px | Compact icon-only launcher |

Also verify that Escape closes the panel and that Developer Tools shows HTTP
200 for both browser-facing assets.

## Rollback

Disable **EMCORE Todo** in Plugins Manager first. Then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
Set-Location "F:\codebase\emcore-todo-processmaker\processmaker_plugins"
.\rollback.ps1 -ProcessMakerEngine "C:\pmlearning\bpms\workflow\engine"
```

Rollback restores the exact interface functions file and plugin files captured
by the latest deployment. If the plugin did not exist before deployment, it is
removed. The timestamped backup remains under:

```text
workflow/engine/plugins/.emcoreTodo-backups/
```

No database rollback is required because version 0.1.1 stores no data.

## Manual recovery

If a deployment stops unexpectedly, do not run deployment again. Read
`plugins/.emcoreTodo-deployment.json`, locate its `BackupDirectory`, and run
`rollback.ps1`. The state file is written before plugin or interface files are
changed, so rollback remains available after a partial deployment.
