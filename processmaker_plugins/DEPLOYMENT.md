# EMCORE Todo 0.2.0

EMCORE Todo is a private, self-managed task list for authenticated ProcessMaker
3.8 users. It appears as a floating launcher throughout the custom EMCORE
interface and keeps every task scoped to the current ProcessMaker USR_UID.

## Phase 2 capabilities

- create, edit, complete, reopen, and soft-delete personal tasks;
- optional Persian due date, priority, and notes;
- open/all/completed filters and an outstanding-task badge;
- same-origin ProcessMaker session authentication;
- CSRF protection for every write;
- prepared SQL with ownership enforced in every read and mutation;
- responsive Persian RTL panel with no duplicate inside Dynaform iframes;
- upgrade-safe deployment and reversible interface loader.

“Private” means other normal ProcessMaker users cannot read or mutate another
user's tasks through this module. Database administrators retain normal
database-level access.

## Architecture

~~~text
Authenticated ProcessMaker browser session
        |
        +-- /plugin/emcoreTodo/todoWidget.js
        |
        +-- POST /sys<workspace>/<lang>/<skin>/emcoreTodo/todoApi
                    |
                    +-- session USER_LOGGED
                    +-- CSRF token
                    +-- Propel workflow connection
                    +-- emcore_todo_tasks (always filtered by usr_uid)
~~~

The custom interface renderer does not consume ProcessMaker's HeadPublisher
queue. Deployment therefore maintains one marked loader inside the interface's
shared functions.js; all Todo implementation remains in the separate plugin.

## Upgrade or installation

Open PowerShell as Administrator:

~~~powershell
Set-ExecutionPolicy -Scope Process Bypass
Set-Location "C:\pmlearning\emcore-todo-processmaker"

git fetch origin
git switch agent/private-todo-crud
git pull --ff-only

.\processmaker_plugins\deploy.ps1 -ProcessMakerEngine "C:\pmlearning\bpms\workflow\engine" -WhatIf
.\processmaker_plugins\deploy.ps1 -ProcessMakerEngine "C:\pmlearning\bpms\workflow\engine"
~~~

The deployment script supports an existing 0.1.1 deployment. It creates a new
timestamped backup, preserves the preceding rollback state, copies version
0.2.0, and updates only the marked loader block.

After deployment:

1. Open **Admin > Plugins > Plugins Manager**.
2. Disable and re-enable **EMCORE Todo**.
3. Confirm the plugin version is 0.2.0.
4. Sign in as a regular user and press Ctrl+F5.
5. Open **کارهای من** and create a test task.

Re-enabling runs the idempotent schema installation:

~~~text
emcore_todo_tasks
~~~

## Deployed files

~~~text
processmaker_plugins/emcoreTodo.php
  -> workflow/engine/plugins/emcoreTodo.php

processmaker_plugins/emcoreTodo/
  -> workflow/engine/plugins/emcoreTodo/

marked loader
  -> workflow/engine/plugins/interface/public_html/assets/core/functions.js
~~~

Browser assets:

~~~text
/plugin/emcoreTodo/todoWidget.js?v=0.2.0
/plugin/emcoreTodo/todo-widget.css?v=0.2.0
~~~

Workspace API route:

~~~text
/sys<workspace>/<language>/<skin>/emcoreTodo/todoApi
~~~

## Security contract

- The browser never supplies a user identifier.
- The API derives identity exclusively from the ProcessMaker session.
- Active identity is verified against ProcessMaker USERS.
- Every task query includes usr_uid = :usr_uid.
- Mutating actions require the session CSRF token.
- Task values are bound through prepared statements.
- UI rendering uses textContent for user-authored task text.
- Deletes are soft deletes.
- The plugin stores no ProcessMaker password or password hash.

## Acceptance checks

Test with two different regular users:

1. User A creates a task.
2. User B opens the Todo panel and cannot see User A's task.
3. User B cannot edit, toggle, or delete User A's task by changing an ID.
4. User A can edit, complete, reopen, and delete the task.
5. Refreshing the page preserves the task.
6. Dashboard, My Cases, Open Case, and both themes show one launcher.
7. A Dynaform iframe does not show a second launcher.
8. Narrow browser width shows the compact trigger and usable full-width panel.

## Rollback

Disable **EMCORE Todo**, then run:

~~~powershell
Set-Location "C:\pmlearning\emcore-todo-processmaker"
.\processmaker_plugins\rollback.ps1 -ProcessMakerEngine "C:\pmlearning\bpms\workflow\engine"
~~~

Rollback restores the previous plugin files, previous interface file, and
previous deployment-state pointer. It intentionally preserves
emcore_todo_tasks; code rollback never destroys personal task data.

Timestamped backups remain under:

~~~text
workflow/engine/plugins/.emcoreTodo-backups/
~~~

## Database removal

Dropping emcore_todo_tasks is intentionally not automated. It is destructive
and must only be performed through a separately reviewed database operation
after an explicit data-retention decision.
