# ProcessMaker plugin deliverables

This directory mirrors workflow/engine/plugins/ for the standalone EMCORE Todo
module.

- emcoreTodo.php is the ProcessMaker plugin entrypoint.
- emcoreTodo/ contains the API, schema lifecycle, UI, and public assets.
- deploy.ps1 performs installation or upgrade with timestamped backups.
- rollback.ps1 restores the immediately preceding deployment.
- DEPLOYMENT.md is the operational guide.

Version 0.3.1 stores private per-user tasks in emcore_todo_tasks. Rollback
preserves that table and its data.
