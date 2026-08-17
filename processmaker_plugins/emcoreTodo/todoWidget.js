(function () {
  'use strict';

  var VERSION = '0.2.1';
  var ROOT_ID = 'emcore-todo-proof';
  var CSS_ID = 'emcore-todo-css';
  var state = {
    tasks: [],
    filter: 'open',
    csrfToken: '',
    loaded: false,
    loading: false,
    saving: false,
    editingId: null
  };

  if (window.top !== window.self || window.__EMCORE_TODO_LOADED__) {
    return;
  }
  window.__EMCORE_TODO_LOADED__ = true;

  function workspaceBase() {
    var match = window.location.pathname.match(/^\/sys[^/]+\/[^/]+\/[^/]+\//);
    return match ? match[0] : '/';
  }

  var API_URL = workspaceBase() + 'emcoreTodo/todoApi';

  function icon(name) {
    var paths = {
      check: '<path d="m6.5 12.2 3.5 3.6 7.7-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
      close: '<path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      edit: '<path d="m5 16.5-.5 3 3-.5L18 8.5 15.5 6 5 16.5Zm8.8-8.8 2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      trash: '<path d="M6.5 8h11l-.7 11h-9.6L6.5 8Zm3-3h5l1 3h-7l1-3ZM5 8h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      refresh: '<path d="M18.5 8.5A7 7 0 1 0 19 15M18.5 4v4.5H14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
      calendar: '<path d="M6 4v3M18 4v3M4.5 9h15M5 6h14a1 1 0 0 1 1 1v12H4V7a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      chevron: '<path d="m8 10 4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      notebook: '<path d="M7 4.5h11v15H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Zm0 0v15M10 9h5M10 13h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + paths[name] + '</svg>';
  }

  function loadStyles() {
    if (document.getElementById(CSS_ID)) {
      return;
    }
    var link = document.createElement('link');
    link.id = CSS_ID;
    link.rel = 'stylesheet';
    link.href = '/plugin/emcoreTodo/todo-widget.css?v=' + VERSION;
    (document.head || document.getElementsByTagName('head')[0]).appendChild(link);
  }

  function encodeForm(data) {
    var parts = [];
    Object.keys(data).forEach(function (key) {
      var value = data[key];
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value === null ? '' : value));
    });
    return parts.join('&');
  }

  function request(action, data, requiresCsrf) {
    var payload = data || {};
    payload.action = action;
    var headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest'
    };
    if (requiresCsrf) {
      headers['X-CSRF-Token'] = state.csrfToken;
    }

    return fetch(API_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: headers,
      body: encodeForm(payload)
    }).then(function (response) {
      return response.text().then(function (text) {
        var json;
        try {
          json = JSON.parse(text);
        } catch (error) {
          throw new Error('پاسخ سرویس قابل خواندن نیست');
        }
        if (!response.ok || !json.success) {
          var message = json && json.error ? json.error : 'ارتباط با سرویس انجام نشد';
          var apiError = new Error(message);
          apiError.status = response.status;
          throw apiError;
        }
        return json;
      });
    });
  }

  function normalizeDigits(value) {
    var from = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';
    var to = '01234567890123456789';
    return String(value || '').replace(/[۰-۹٠-٩]/g, function (digit) {
      return to.charAt(from.indexOf(digit));
    }).replace(/-/g, '/');
  }

  function priorityMeta(value) {
    var priorities = {
      0: { label: 'کم', className: 'is-low' },
      1: { label: 'عادی', className: 'is-normal' },
      2: { label: 'مهم', className: 'is-high' }
    };
    return priorities[value] || priorities[1];
  }

  function mount() {
    if (!document.body || document.getElementById(ROOT_ID)) {
      return;
    }

    loadStyles();

    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'emcore-todo';
    root.setAttribute('dir', 'rtl');
    root.setAttribute('lang', 'fa');
    root.setAttribute('data-version', VERSION);
    root.innerHTML =
      '<section class="emcore-todo__panel" aria-labelledby="emcore-todo-title" aria-hidden="true">' +
        '<header class="emcore-todo__header">' +
          '<div class="emcore-todo__brand">' +
            '<span class="emcore-todo__brand-icon">' + icon('notebook') + '</span>' +
            '<div><span class="emcore-todo__kicker">دفتر شخصی</span><h2 id="emcore-todo-title">کارهای من</h2></div>' +
          '</div>' +
          '<div class="emcore-todo__head-actions">' +
            '<button type="button" class="emcore-todo__icon-button" data-action="refresh" aria-label="تازه‌سازی">' + icon('refresh') + '</button>' +
            '<button type="button" class="emcore-todo__icon-button" data-action="close" aria-label="بستن">' + icon('close') + '</button>' +
          '</div>' +
          '<div class="emcore-todo__header-rule" aria-hidden="true"></div>' +
        '</header>' +
        '<div class="emcore-todo__workspace">' +
          '<form class="emcore-todo__composer" autocomplete="off">' +
            '<div class="emcore-todo__capture">' +
              '<input class="emcore-todo__title-input" name="title" maxlength="255" placeholder="چه کاری باید انجام شود؟" aria-label="عنوان کار" required>' +
              '<button class="emcore-todo__submit" type="submit" aria-label="افزودن کار">' + icon('plus') + '<span>افزودن</span></button>' +
            '</div>' +
            '<button class="emcore-todo__details-toggle" type="button" data-action="details" aria-expanded="false">' +
              '<span>جزئیات و زمان‌بندی</span>' + icon('chevron') +
            '</button>' +
            '<div class="emcore-todo__details" aria-hidden="true">' +
              '<label><span>موعد شمسی</span><div class="emcore-todo__field-icon">' + icon('calendar') + '<input name="due_date_fa" inputmode="numeric" maxlength="10" placeholder="۱۴۰۵/۰۵/۲۷"></div></label>' +
              '<label><span>اولویت</span><select name="priority"><option value="1">عادی</option><option value="2">مهم</option><option value="0">کم</option></select></label>' +
              '<label class="emcore-todo__notes-label"><span>یادداشت</span><textarea name="notes" maxlength="2000" rows="2" placeholder="جزئیات اختیاری…"></textarea></label>' +
            '</div>' +
            '<div class="emcore-todo__edit-bar" hidden><span>در حال ویرایش</span><button type="button" data-action="cancel-edit">انصراف</button></div>' +
          '</form>' +
          '<nav class="emcore-todo__filters" aria-label="فیلتر کارها">' +
            '<button type="button" data-filter="open" class="is-active">باز <span data-count="open">۰</span></button>' +
            '<button type="button" data-filter="all">همه <span data-count="all">۰</span></button>' +
            '<button type="button" data-filter="done">انجام‌شده <span data-count="done">۰</span></button>' +
          '</nav>' +
          '<div class="emcore-todo__list" role="list" aria-live="polite"></div>' +
          '<div class="emcore-todo__status" role="status" aria-live="polite"></div>' +
        '</div>' +
        '<footer class="emcore-todo__footer"><span>فقط برای شما</span><span class="emcore-todo__privacy-dot"></span><span>نسخه ۰٫۲٫۰</span></footer>' +
      '</section>' +
      '<button type="button" class="emcore-todo__trigger" aria-controls="emcore-todo-panel" aria-expanded="false" aria-label="باز کردن کارهای من">' +
        '<span class="emcore-todo__trigger-icon">' + icon('check') + '</span>' +
        '<span class="emcore-todo__trigger-label">کارهای من</span>' +
        '<span class="emcore-todo__trigger-count" data-trigger-count hidden>۰</span>' +
      '</button>' +
      '<div class="emcore-todo__toast" role="status" aria-live="polite"></div>';

    document.body.appendChild(root);

    var panel = root.querySelector('.emcore-todo__panel');
    panel.id = 'emcore-todo-panel';
    var trigger = root.querySelector('.emcore-todo__trigger');
    var form = root.querySelector('.emcore-todo__composer');
    var titleInput = form.elements.title;
    var details = root.querySelector('.emcore-todo__details');
    var detailsToggle = root.querySelector('[data-action="details"]');
    var list = root.querySelector('.emcore-todo__list');
    var status = root.querySelector('.emcore-todo__status');
    var toastTimer = null;

    function toPersianNumber(value) {
      return String(value).replace(/[0-9]/g, function (number) {
        return '۰۱۲۳۴۵۶۷۸۹'.charAt(parseInt(number, 10));
      });
    }

    function showToast(message, kind) {
      var toast = root.querySelector('.emcore-todo__toast');
      toast.textContent = message;
      toast.className = 'emcore-todo__toast is-visible' + (kind === 'error' ? ' is-error' : '');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () {
        toast.className = 'emcore-todo__toast';
      }, 2800);
    }

    function setOpen(open) {
      root.classList.toggle('is-open', open);
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        if (!state.loaded && !state.loading) {
          loadTasks();
        }
        window.setTimeout(function () { titleInput.focus(); }, 220);
      } else {
        trigger.focus();
      }
    }

    function setBusy(busy) {
      state.saving = busy;
      Array.prototype.forEach.call(form.querySelectorAll('input, textarea, select, button'), function (element) {
        element.disabled = busy;
      });
      form.classList.toggle('is-busy', busy);
    }

    function setStatus(message, kind) {
      status.textContent = message || '';
      status.className = 'emcore-todo__status' + (kind ? ' is-' + kind : '');
    }

    function updateCounts() {
      var openCount = state.tasks.filter(function (task) { return !task.is_completed; }).length;
      var doneCount = state.tasks.length - openCount;
      root.querySelector('[data-count="open"]').textContent = toPersianNumber(openCount);
      root.querySelector('[data-count="all"]').textContent = toPersianNumber(state.tasks.length);
      root.querySelector('[data-count="done"]').textContent = toPersianNumber(doneCount);
      var triggerCount = root.querySelector('[data-trigger-count]');
      triggerCount.textContent = toPersianNumber(openCount);
      triggerCount.hidden = openCount === 0;
    }

    function filteredTasks() {
      if (state.filter === 'open') {
        return state.tasks.filter(function (task) { return !task.is_completed; });
      }
      if (state.filter === 'done') {
        return state.tasks.filter(function (task) { return !!task.is_completed; });
      }
      return state.tasks.slice();
    }

    function taskElement(task) {
      var item = document.createElement('article');
      var priority = priorityMeta(task.priority);
      item.className = 'emcore-todo__task' + (task.is_completed ? ' is-completed' : '');
      item.setAttribute('role', 'listitem');
      item.setAttribute('data-id', task.id);

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'emcore-todo__check';
      toggle.setAttribute('data-action', 'toggle');
      toggle.setAttribute('aria-label', task.is_completed ? 'بازگرداندن کار' : 'انجام شد');
      toggle.setAttribute('aria-pressed', task.is_completed ? 'true' : 'false');
      toggle.innerHTML = icon('check');

      var body = document.createElement('div');
      body.className = 'emcore-todo__task-body';
      var title = document.createElement('strong');
      title.textContent = task.title;
      body.appendChild(title);

      if (task.notes) {
        var notes = document.createElement('p');
        notes.textContent = task.notes;
        body.appendChild(notes);
      }

      var meta = document.createElement('div');
      meta.className = 'emcore-todo__meta';
      var priorityBadge = document.createElement('span');
      priorityBadge.className = 'emcore-todo__priority ' + priority.className;
      priorityBadge.textContent = priority.label;
      meta.appendChild(priorityBadge);
      if (task.due_date_fa) {
        var due = document.createElement('span');
        due.className = 'emcore-todo__due';
        due.innerHTML = icon('calendar');
        var dueText = document.createElement('b');
        dueText.textContent = toPersianNumber(task.due_date_fa);
        due.appendChild(dueText);
        meta.appendChild(due);
      }
      body.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'emcore-todo__task-actions';
      actions.innerHTML =
        '<button type="button" data-action="edit" aria-label="ویرایش">' + icon('edit') + '</button>' +
        '<button type="button" data-action="delete" aria-label="حذف">' + icon('trash') + '</button>';

      item.appendChild(toggle);
      item.appendChild(body);
      item.appendChild(actions);
      return item;
    }

    function render() {
      updateCounts();
      list.innerHTML = '';
      var tasks = filteredTasks();

      if (state.loading) {
        for (var index = 0; index < 3; index += 1) {
          var skeleton = document.createElement('div');
          skeleton.className = 'emcore-todo__skeleton';
          skeleton.innerHTML = '<i></i><span></span><b></b>';
          list.appendChild(skeleton);
        }
        return;
      }

      if (!tasks.length) {
        var empty = document.createElement('div');
        empty.className = 'emcore-todo__empty';
        empty.innerHTML = '<span>' + icon(state.filter === 'done' ? 'check' : 'notebook') + '</span>' +
          '<strong>' + (state.filter === 'done' ? 'هنوز کاری تمام نشده' : state.filter === 'all' ? 'دفتر شما خالی است' : 'همه‌چیز روبه‌راه است') + '</strong>' +
          '<p>' + (state.filter === 'open' ? 'کار بعدی را همین بالا یادداشت کنید.' : 'فهرست دیگری را انتخاب کنید.') + '</p>';
        list.appendChild(empty);
        return;
      }

      tasks.forEach(function (task) {
        list.appendChild(taskElement(task));
      });
    }

    function replaceTask(updated) {
      state.tasks = state.tasks.map(function (task) {
        return task.id === updated.id ? updated : task;
      });
    }

    function loadTasks() {
      state.loading = true;
      setStatus('', '');
      render();
      request('list', {}, false).then(function (response) {
        state.tasks = response.data || [];
        state.csrfToken = response.csrf_token || '';
        state.loaded = true;
        state.loading = false;
        render();
      }).catch(function (error) {
        state.loading = false;
        render();
        setStatus(error.message, 'error');
      });
    }

    function resetForm() {
      state.editingId = null;
      form.reset();
      form.elements.priority.value = '1';
      form.querySelector('.emcore-todo__submit span').textContent = 'افزودن';
      form.querySelector('.emcore-todo__edit-bar').hidden = true;
      titleInput.focus();
    }

    function openDetails(open) {
      details.classList.toggle('is-visible', open);
      details.setAttribute('aria-hidden', open ? 'false' : 'true');
      detailsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function editTask(task) {
      state.editingId = task.id;
      form.elements.title.value = task.title || '';
      form.elements.notes.value = task.notes || '';
      form.elements.priority.value = String(task.priority);
      form.elements.due_date_fa.value = task.due_date_fa ? toPersianNumber(task.due_date_fa) : '';
      form.querySelector('.emcore-todo__submit span').textContent = 'ذخیره';
      form.querySelector('.emcore-todo__edit-bar').hidden = false;
      openDetails(true);
      titleInput.focus();
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (state.saving) {
        return;
      }
      if (!state.loaded || !state.csrfToken) {
        showToast('لطفاً تا دریافت فهرست کارها صبر کنید', 'error');
        return;
      }

      var title = titleInput.value.trim();
      if (!title) {
        showToast('عنوان کار را وارد کنید', 'error');
        titleInput.focus();
        return;
      }

      var data = {
        title: title,
        notes: form.elements.notes.value.trim(),
        priority: form.elements.priority.value,
        due_date_fa: normalizeDigits(form.elements.due_date_fa.value)
      };
      var action = state.editingId ? 'update' : 'create';
      if (state.editingId) {
        data.id = state.editingId;
      }

      setBusy(true);
      request(action, data, true).then(function (response) {
        if (action === 'create') {
          state.tasks.unshift(response.data);
          showToast('کار جدید ثبت شد');
        } else {
          replaceTask(response.data);
          showToast('تغییرات ذخیره شد');
        }
        setBusy(false);
        resetForm();
        render();
      }).catch(function (error) {
        setBusy(false);
        showToast(error.message, 'error');
      });
    });

    root.addEventListener('click', function (event) {
      var actionButton = event.target.closest('[data-action]');
      var filterButton = event.target.closest('[data-filter]');

      if (filterButton) {
        state.filter = filterButton.getAttribute('data-filter');
        Array.prototype.forEach.call(root.querySelectorAll('[data-filter]'), function (button) {
          button.classList.toggle('is-active', button === filterButton);
        });
        render();
        return;
      }

      if (!actionButton) {
        if (event.target.closest('.emcore-todo__trigger')) {
          setOpen(trigger.getAttribute('aria-expanded') !== 'true');
        }
        return;
      }

      var action = actionButton.getAttribute('data-action');
      if (action === 'close') {
        setOpen(false);
        return;
      }
      if (action === 'refresh') {
        loadTasks();
        return;
      }
      if (action === 'details') {
        openDetails(detailsToggle.getAttribute('aria-expanded') !== 'true');
        return;
      }
      if (action === 'cancel-edit') {
        resetForm();
        return;
      }

      var taskNode = actionButton.closest('[data-id]');
      if (!taskNode || state.saving) {
        return;
      }
      var id = parseInt(taskNode.getAttribute('data-id'), 10);
      var task = state.tasks.filter(function (candidate) { return candidate.id === id; })[0];
      if (!task) {
        return;
      }

      if (action === 'edit') {
        editTask(task);
        return;
      }
      if (action === 'toggle') {
        actionButton.disabled = true;
        request('toggle', { id: id, completed: task.is_completed ? 0 : 1 }, true).then(function (response) {
          replaceTask(response.data);
          render();
        }).catch(function (error) {
          actionButton.disabled = false;
          showToast(error.message, 'error');
        });
        return;
      }
      if (action === 'delete') {
        if (!window.confirm('این کار حذف شود؟')) {
          return;
        }
        request('delete', { id: id }, true).then(function () {
          state.tasks = state.tasks.filter(function (candidate) { return candidate.id !== id; });
          if (state.editingId === id) {
            resetForm();
          }
          render();
          showToast('کار حذف شد');
        }).catch(function (error) {
          showToast(error.message, 'error');
        });
      }
    });

    document.addEventListener('keydown', function (event) {
      if ((event.key === 'Escape' || event.keyCode === 27) && trigger.getAttribute('aria-expanded') === 'true') {
        if (state.editingId) {
          resetForm();
        } else {
          setOpen(false);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}());
