# EMCORE Todo Phase 1 proof plugin

This disposable proof verifies whether ProcessMaker 3.8.2 publishes a browser
asset registered by an independent plugin into the custom `interface` pages.
It contains no schema, database access, task API, user identifiers, tokens, or
persistent browser storage.

## Files deployed to ProcessMaker

Copy these two repository paths into `workflow/engine/plugins/`:

```text
processmaker_plugins/emcoreTodo.php  -> workflow/engine/plugins/emcoreTodo.php
processmaker_plugins/emcoreTodo/     -> workflow/engine/plugins/emcoreTodo/
```

Do not copy the containing `processmaker_plugins` directory itself.

## Test-instance installation

1. Confirm the ProcessMaker database and `workflow/engine/plugins` backup.
2. Copy the entrypoint and directory to the paths above.
3. In ProcessMaker, open **Admin > Plugins > Plugins Manager**.
4. Enable **EMCORE Todo**. If it was already enabled, disable and enable it so
   ProcessMaker refreshes plugin registration.
5. Hard-refresh the browser (`Ctrl+F5`).

The expected result is a green **کارهای من** bubble at the lower-right of the
outer interface. Clicking it shows a Persian confirmation card stating that no
information is stored.

## Acceptance matrix

Check the following routes in both the `default` and `material` themes where
available:

| Route/page | Expected result |
|---|---|
| Dashboard (`index`) | One bubble in the outer page |
| My cases (`my_cases`) | One bubble in the outer page |
| Custom menu (`menu_open_case`) | One bubble outside `contentIframe` |
| Dynaform inside `contentIframe` | No second bubble inside the frame |
| Browser width below 600px | Compact icon-only bubble |

Also confirm:

- Escape closes the confirmation card.
- The close button returns focus to the bubble.
- Developer Tools > Network loads
  `/plugin/emcoreTodo/todo-widget.css?v=0.1.0` with HTTP 200.
- No requests are made to `/emcore_api/` in this phase.

## If the bubble does not appear

1. Confirm the plugin is enabled.
2. Check the browser console for a JavaScript or Content Security Policy error.
3. Search the rendered page source/network requests for `todoWidget.js`.
4. Confirm the file exists at
   `workflow/engine/plugins/emcoreTodo/todoWidget.js`.
5. Record results for `index`, `my_cases`, and `menu_open_case` separately.

Do not patch the vendor `interface` plugin yet. A missing widget means the
encoded interface renderer did not consume the shared HeadPublisher asset; it
does not justify changing the vendor bundle without reviewing the evidence.

## Rollback

1. Disable **EMCORE Todo** in Plugins Manager.
2. Hard-refresh and verify the bubble is absent.
3. If desired, remove only `workflow/engine/plugins/emcoreTodo.php` and
   `workflow/engine/plugins/emcoreTodo/` after the plugin is disabled.

No database rollback is needed because Phase 1 creates no data.

