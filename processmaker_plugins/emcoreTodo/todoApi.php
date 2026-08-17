<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/classes/class.todoRepository.php';

class EmcoreTodoHttpException extends RuntimeException
{
    public $status;
    public $details;

    public function __construct($status, $message, $details = null)
    {
        parent::__construct($message);
        $this->status = (int)$status;
        $this->details = $details;
    }
}

function emcore_todo_json($data, $status = 200)
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

set_exception_handler(function ($exception) {
    if ($exception instanceof EmcoreTodoHttpException) {
        $payload = ['success' => false, 'error' => $exception->getMessage()];
        if ($exception->details !== null) {
            $payload['details'] = $exception->details;
        }
        emcore_todo_json($payload, $exception->status);
    }

    error_log('EMCORE Todo API error: ' . $exception->getMessage());
    emcore_todo_json(['success' => false, 'error' => 'خطای داخلی سرور'], 500);
});

function emcore_todo_session()
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
}

function emcore_todo_current_user($db)
{
    emcore_todo_session();
    $usrUid = isset($_SESSION['USER_LOGGED']) ? (string)$_SESSION['USER_LOGGED'] : '';
    if (!preg_match('/^[A-Za-z0-9]{32}$/', $usrUid)) {
        throw new EmcoreTodoHttpException(401, 'ورود به سامانه الزامی است');
    }

    $statement = $db->prepare(
        "SELECT USR_UID, USR_USERNAME, USR_FIRSTNAME, USR_LASTNAME
         FROM USERS
         WHERE USR_UID = :usr_uid AND USR_STATUS = 'ACTIVE'
         LIMIT 1"
    );
    $statement->execute([':usr_uid' => $usrUid]);
    $user = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        throw new EmcoreTodoHttpException(401, 'کاربر فعال یافت نشد');
    }

    return $user;
}

function emcore_todo_csrf_token()
{
    emcore_todo_session();
    if (empty($_SESSION['EMCORE_TODO_CSRF_TOKEN'])) {
        $_SESSION['EMCORE_TODO_CSRF_TOKEN'] = bin2hex(random_bytes(32));
    }
    return (string)$_SESSION['EMCORE_TODO_CSRF_TOKEN'];
}

function emcore_todo_require_csrf()
{
    $provided = isset($_SERVER['HTTP_X_CSRF_TOKEN'])
        ? (string)$_SERVER['HTTP_X_CSRF_TOKEN']
        : '';
    if ($provided === '' || !hash_equals(emcore_todo_csrf_token(), $provided)) {
        throw new EmcoreTodoHttpException(403, 'توکن امنیتی نامعتبر است');
    }
}

function emcore_todo_action()
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        throw new EmcoreTodoHttpException(405, 'فقط درخواست POST مجاز است');
    }

    $action = isset($_POST['action']) ? trim((string)$_POST['action']) : '';
    $allowed = ['list', 'create', 'update', 'toggle', 'delete'];
    if (!in_array($action, $allowed, true)) {
        throw new EmcoreTodoHttpException(400, 'عملیات نامعتبر است');
    }

    return $action;
}

function emcore_todo_id()
{
    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false || $id === null) {
        throw new EmcoreTodoHttpException(422, 'شناسه کار نامعتبر است');
    }
    return (int)$id;
}

function emcore_todo_text($name, $required, $maxLength)
{
    $value = isset($_POST[$name]) ? trim((string)$_POST[$name]) : '';
    if ($required && $value === '') {
        throw new EmcoreTodoHttpException(422, 'عنوان کار الزامی است', [$name => 'required']);
    }
    if (mb_strlen($value, 'UTF-8') > $maxLength) {
        throw new EmcoreTodoHttpException(422, 'متن واردشده بیش از حد طولانی است', [$name => 'too_long']);
    }
    return $value === '' ? null : $value;
}

function emcore_todo_priority()
{
    $priority = filter_input(INPUT_POST, 'priority', FILTER_VALIDATE_INT);
    if ($priority === false || $priority === null || $priority < 0 || $priority > 2) {
        throw new EmcoreTodoHttpException(422, 'اولویت نامعتبر است');
    }
    return (int)$priority;
}

function emcore_todo_due_date()
{
    $value = isset($_POST['due_date_fa']) ? trim((string)$_POST['due_date_fa']) : '';
    if ($value === '') {
        return null;
    }

    $value = strtr($value, [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    ]);
    $value = str_replace('-', '/', $value);

    if (!preg_match('/^1[34][0-9]{2}\/(0[1-9]|1[0-2])\/([0-2][0-9]|3[01])$/', $value)) {
        throw new EmcoreTodoHttpException(422, 'تاریخ باید با قالب ۱۴۰۵/۰۵/۲۷ وارد شود');
    }

    return $value;
}

function emcore_todo_completed()
{
    $value = isset($_POST['completed']) ? strtolower(trim((string)$_POST['completed'])) : '';
    if (in_array($value, ['1', 'true', 'on'], true)) {
        return 1;
    }
    if (in_array($value, ['0', 'false', 'off'], true)) {
        return 0;
    }
    throw new EmcoreTodoHttpException(422, 'وضعیت انجام کار نامعتبر است');
}

function emcore_todo_fetch($db, $id, $usrUid)
{
    $statement = $db->prepare(
        "SELECT id, title, notes, priority, due_date_fa, is_completed,
                sort_order, completed_at, created_at, updated_at
         FROM " . EmcoreTodoRepository::TABLE . "
         WHERE id = :id AND usr_uid = :usr_uid AND deleted_at IS NULL
         LIMIT 1"
    );
    $statement->execute([':id' => $id, ':usr_uid' => $usrUid]);
    $task = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$task) {
        throw new EmcoreTodoHttpException(404, 'کار موردنظر یافت نشد');
    }
    $task['id'] = (int)$task['id'];
    $task['priority'] = (int)$task['priority'];
    $task['is_completed'] = (int)$task['is_completed'];
    $task['sort_order'] = (int)$task['sort_order'];
    return $task;
}

$db = EmcoreTodoRepository::connection();
$user = emcore_todo_current_user($db);
$usrUid = $user['USR_UID'];
$action = emcore_todo_action();

if ($action === 'list') {
    $statement = $db->prepare(
        "SELECT id, title, notes, priority, due_date_fa, is_completed,
                sort_order, completed_at, created_at, updated_at
         FROM " . EmcoreTodoRepository::TABLE . "
         WHERE usr_uid = :usr_uid AND deleted_at IS NULL
         ORDER BY is_completed ASC,
                  CASE WHEN due_date_fa IS NULL THEN 1 ELSE 0 END ASC,
                  due_date_fa ASC,
                  priority DESC,
                  sort_order ASC,
                  id DESC
         LIMIT 500"
    );
    $statement->execute([':usr_uid' => $usrUid]);
    $tasks = $statement->fetchAll(PDO::FETCH_ASSOC);
    foreach ($tasks as &$task) {
        $task['id'] = (int)$task['id'];
        $task['priority'] = (int)$task['priority'];
        $task['is_completed'] = (int)$task['is_completed'];
        $task['sort_order'] = (int)$task['sort_order'];
    }
    unset($task);

    emcore_todo_json([
        'success' => true,
        'data' => $tasks,
        'csrf_token' => emcore_todo_csrf_token(),
        'user' => [
            'first_name' => $user['USR_FIRSTNAME'],
            'last_name' => $user['USR_LASTNAME'],
        ],
    ]);
}

emcore_todo_require_csrf();

if ($action === 'create') {
    $title = emcore_todo_text('title', true, 255);
    $notes = emcore_todo_text('notes', false, 2000);
    $priority = emcore_todo_priority();
    $dueDate = emcore_todo_due_date();

    $statement = $db->prepare(
        "INSERT INTO " . EmcoreTodoRepository::TABLE . "
            (usr_uid, title, notes, priority, due_date_fa, is_completed, sort_order)
         VALUES
            (:usr_uid, :title, :notes, :priority, :due_date_fa, 0, 0)"
    );
    $statement->execute([
        ':usr_uid' => $usrUid,
        ':title' => $title,
        ':notes' => $notes,
        ':priority' => $priority,
        ':due_date_fa' => $dueDate,
    ]);
    $id = (int)$db->lastInsertId();
    emcore_todo_json(['success' => true, 'data' => emcore_todo_fetch($db, $id, $usrUid)], 201);
}

if ($action === 'toggle') {
    $id = emcore_todo_id();
    $completed = emcore_todo_completed();
    $statement = $db->prepare(
        "UPDATE " . EmcoreTodoRepository::TABLE . "
         SET is_completed = :completed,
             completed_at = IF(:completed_for_date = 1, NOW(), NULL),
             updated_at = NOW()
         WHERE id = :id AND usr_uid = :usr_uid AND deleted_at IS NULL"
    );
    $statement->execute([
        ':completed' => $completed,
        ':completed_for_date' => $completed,
        ':id' => $id,
        ':usr_uid' => $usrUid,
    ]);
    if ($statement->rowCount() === 0) {
        emcore_todo_fetch($db, $id, $usrUid);
    }
    emcore_todo_json(['success' => true, 'data' => emcore_todo_fetch($db, $id, $usrUid)]);
}

if ($action === 'delete') {
    $id = emcore_todo_id();
    $statement = $db->prepare(
        "UPDATE " . EmcoreTodoRepository::TABLE . "
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = :id AND usr_uid = :usr_uid AND deleted_at IS NULL"
    );
    $statement->execute([':id' => $id, ':usr_uid' => $usrUid]);
    if ($statement->rowCount() === 0) {
        throw new EmcoreTodoHttpException(404, 'کار موردنظر یافت نشد');
    }
    emcore_todo_json(['success' => true]);
}

$id = emcore_todo_id();
$title = emcore_todo_text('title', true, 255);
$notes = emcore_todo_text('notes', false, 2000);
$priority = emcore_todo_priority();
$dueDate = emcore_todo_due_date();

$statement = $db->prepare(
    "UPDATE " . EmcoreTodoRepository::TABLE . "
     SET title = :title,
         notes = :notes,
         priority = :priority,
         due_date_fa = :due_date_fa,
         updated_at = NOW()
     WHERE id = :id AND usr_uid = :usr_uid AND deleted_at IS NULL"
);
$statement->execute([
    ':title' => $title,
    ':notes' => $notes,
    ':priority' => $priority,
    ':due_date_fa' => $dueDate,
    ':id' => $id,
    ':usr_uid' => $usrUid,
]);
if ($statement->rowCount() === 0) {
    emcore_todo_fetch($db, $id, $usrUid);
}
emcore_todo_json(['success' => true, 'data' => emcore_todo_fetch($db, $id, $usrUid)]);
