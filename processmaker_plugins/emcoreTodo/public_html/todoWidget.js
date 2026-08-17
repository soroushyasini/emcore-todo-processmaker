(function () {
  'use strict';

  var ROOT_ID = 'emcore-todo-proof';
  var CSS_ID = 'emcore-todo-proof-css';

  // ProcessMaker can render Dynaforms and other content inside iframes. The
  // widget belongs to the persistent outer interface and must appear once.
  if (window.top !== window.self || window.__EMCORE_TODO_PROOF_LOADED__) {
    return;
  }
  window.__EMCORE_TODO_PROOF_LOADED__ = true;

  function loadStyles() {
    if (document.getElementById(CSS_ID)) {
      return;
    }
    var link = document.createElement('link');
    link.id = CSS_ID;
    link.rel = 'stylesheet';
    link.href = '/plugin/emcoreTodo/todo-widget.css?v=0.1.1';
    (document.head || document.getElementsByTagName('head')[0]).appendChild(link);
  }

  function iconCheck() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M6.7 12.4 10.2 16l7.4-8.1" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  function iconClose() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round"/>' +
      '</svg>';
  }

  function mount() {
    if (!document.body || document.getElementById(ROOT_ID)) {
      return;
    }

    loadStyles();

    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'emcore-todo-proof';
    root.setAttribute('dir', 'rtl');
    root.setAttribute('lang', 'fa');
    root.setAttribute('data-proof-version', '0.1.1');

    var panel = document.createElement('section');
    panel.id = ROOT_ID + '-panel';
    panel.className = 'emcore-todo-proof__panel';
    panel.setAttribute('aria-labelledby', ROOT_ID + '-title');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML =
      '<div class="emcore-todo-proof__accent" aria-hidden="true"></div>' +
      '<div class="emcore-todo-proof__head">' +
        '<div>' +
          '<span class="emcore-todo-proof__eyebrow">آزمایش اتصال سراسری</span>' +
          '<h2 id="' + ROOT_ID + '-title">کارهای من</h2>' +
        '</div>' +
        '<button type="button" class="emcore-todo-proof__close" aria-label="بستن">' + iconClose() + '</button>' +
      '</div>' +
      '<div class="emcore-todo-proof__body">' +
        '<span class="emcore-todo-proof__status-icon">' + iconCheck() + '</span>' +
        '<div>' +
          '<strong>اتصال افزونه با موفقیت انجام شد.</strong>' +
          '<p>این نسخه فقط نمایش سراسری را بررسی می‌کند و هنوز هیچ اطلاعاتی ذخیره نمی‌شود.</p>' +
        '</div>' +
      '</div>' +
      '<div class="emcore-todo-proof__foot">مرحله آزمایشی ۰٫۱٫۱</div>';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'emcore-todo-proof__trigger';
    trigger.setAttribute('aria-controls', panel.id);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'باز کردن کارهای من');
    trigger.innerHTML =
      '<span class="emcore-todo-proof__trigger-icon">' + iconCheck() + '</span>' +
      '<span class="emcore-todo-proof__trigger-label">کارهای من</span>' +
      '<span class="emcore-todo-proof__pulse" aria-hidden="true"></span>';

    function setOpen(open) {
      root.className = open ? 'emcore-todo-proof is-open' : 'emcore-todo-proof';
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var close = panel.querySelector('.emcore-todo-proof__close');
        if (close) {
          close.focus();
        }
      } else {
        trigger.focus();
      }
    }

    trigger.addEventListener('click', function () {
      setOpen(trigger.getAttribute('aria-expanded') !== 'true');
    });
    panel.querySelector('.emcore-todo-proof__close').addEventListener('click', function () {
      setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if ((event.key === 'Escape' || event.keyCode === 27) && trigger.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
      }
    });

    root.appendChild(panel);
    root.appendChild(trigger);
    document.body.appendChild(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}());

