<?php

final class EmcoreTodoRepository
{
    const TABLE = 'emcore_todo_tasks';

    public static function connection()
    {
        if (!class_exists('Propel')) {
            throw new RuntimeException('ProcessMaker database layer is unavailable.');
        }

        $connection = Propel::getConnection('workflow');
        if (!is_object($connection) || !method_exists($connection, 'prepare') || !method_exists($connection, 'exec')) {
            throw new RuntimeException('ProcessMaker workflow connection is unavailable.');
        }

        return $connection;
    }

    public static function ensureSchema()
    {
        self::connection()->exec(self::schemaSql());
    }

    public static function schemaSql()
    {
        return "CREATE TABLE IF NOT EXISTS " . self::TABLE . " (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    }
}
