<?php

final class EmcoreTodoDatabase
{
    private $connection;
    private $driver;

    public function __construct($connection)
    {
        if (!is_object($connection)) {
            throw new RuntimeException('ProcessMaker workflow connection is unavailable.');
        }

        $this->connection = $connection;

        if (is_callable([$connection, 'prepareStatement'])) {
            $this->driver = 'creole';
            return;
        }

        if (is_callable([$connection, 'prepare'])) {
            $this->driver = 'pdo';
            return;
        }

        throw new RuntimeException(
            'Unsupported ProcessMaker workflow connection: ' . get_class($connection)
        );
    }

    public function selectAll($sql, array $parameters = [])
    {
        if ($this->driver === 'pdo') {
            $statement = $this->connection->prepare($sql);
            $statement->execute($parameters);
            return $statement->fetchAll(PDO::FETCH_ASSOC);
        }

        $statement = $this->prepareCreole($sql, $parameters);
        $resultSet = $statement->executeQuery();
        $rows = [];

        while ($resultSet->next()) {
            $rows[] = $this->normalizeCreoleRow($resultSet->getRow());
        }

        return $rows;
    }

    public function selectOne($sql, array $parameters = [])
    {
        $rows = $this->selectAll($sql, $parameters);
        return isset($rows[0]) ? $rows[0] : null;
    }

    public function execute($sql, array $parameters = [])
    {
        if ($this->driver === 'pdo') {
            $statement = $this->connection->prepare($sql);
            $statement->execute($parameters);
            return (int)$statement->rowCount();
        }

        $statement = $this->prepareCreole($sql, $parameters);
        $affected = $statement->executeUpdate();
        return is_numeric($affected) ? (int)$affected : 0;
    }

    public function insert($sql, array $parameters = [])
    {
        $this->execute($sql, $parameters);

        if ($this->driver === 'pdo' && is_callable([$this->connection, 'lastInsertId'])) {
            return (int)$this->connection->lastInsertId();
        }

        $row = $this->selectOne('SELECT LAST_INSERT_ID() AS id');
        return $row ? (int)$row['id'] : 0;
    }

    private function prepareCreole($sql, array $parameters)
    {
        $normalized = [];
        foreach ($parameters as $name => $value) {
            $normalized[ltrim((string)$name, ':')] = $value;
        }

        $values = [];
        $compiledSql = preg_replace_callback(
            '/(?<!:):([A-Za-z_][A-Za-z0-9_]*)/',
            function ($matches) use ($normalized, &$values) {
                $name = $matches[1];
                if (!array_key_exists($name, $normalized)) {
                    throw new InvalidArgumentException('Missing SQL parameter: ' . $name);
                }
                $values[] = $normalized[$name];
                return '?';
            },
            $sql
        );

        if ($compiledSql === null) {
            throw new RuntimeException('Unable to prepare Todo SQL statement.');
        }

        $statement = $this->connection->prepareStatement($compiledSql);
        foreach ($values as $offset => $value) {
            $position = $offset + 1;
            if ($value === null && is_callable([$statement, 'setNull'])) {
                $statement->setNull($position);
            } elseif (is_int($value) || is_bool($value)) {
                $statement->setInt($position, (int)$value);
            } else {
                $statement->setString($position, $value === null ? '' : (string)$value);
            }
        }

        return $statement;
    }

    private function normalizeCreoleRow($row)
    {
        $normalized = [];
        foreach ((array)$row as $key => $value) {
            if (is_string($key)) {
                $normalized[strtolower($key)] = $value;
            }
        }
        return $normalized;
    }
}

final class EmcoreTodoRepository
{
    const TABLE = 'emcore_todo_tasks';

    public static function connection()
    {
        if (!class_exists('Propel')) {
            throw new RuntimeException('ProcessMaker database layer is unavailable.');
        }

        return new EmcoreTodoDatabase(Propel::getConnection('workflow'));
    }

    public static function ensureSchema()
    {
        self::connection()->execute(self::schemaSql());
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
