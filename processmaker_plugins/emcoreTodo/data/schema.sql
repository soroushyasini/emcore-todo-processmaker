-- EMCORE Todo 0.2.1
-- The plugin install/enable lifecycle executes this idempotent schema.

CREATE TABLE IF NOT EXISTS emcore_todo_tasks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usr_uid CHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    notes TEXT NULL,
    priority TINYINT UNSIGNED NOT NULL DEFAULT 1,
    due_date_fa CHAR(10) NULL,
    is_completed TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    completed_at DATETIME NULL,
    deleted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_emcore_todo_owner_state (usr_uid, deleted_at, is_completed),
    KEY idx_emcore_todo_owner_due (usr_uid, due_date_fa),
    KEY idx_emcore_todo_owner_sort (usr_uid, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
