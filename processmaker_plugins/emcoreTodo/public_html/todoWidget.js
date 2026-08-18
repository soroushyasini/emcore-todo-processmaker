(function () {
  'use strict';

  var VERSION = '0.3.1';
  var ROOT_ID = 'emcore-todo-proof';
  var CSS_ID = 'emcore-todo-css';
  var state = {
    tasks: [],
    filter: 'open',
    csrfToken: '',
    loaded: false,
    loading: false,
    saving: false,
    editingId: null,
    calendarOpen: false,
    calendarYear: null,
    calendarMonth: null,
    timePickerOpen: false,
    timePickerMode: 'hour',
    timeHour: null,
    timeMinute: null
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
      clock: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
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

  function integerDivision(a, b) {
    return ~~(a / b);
  }

  function remainder(a, b) {
    return a - integerDivision(a, b) * b;
  }

  function jalaliCalendar(jalaliYear) {
    var breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    var gregorianYear = jalaliYear + 621;
    var leapJalali = -14;
    var previousBreak = breaks[0];
    var currentBreak;
    var jump = 0;
    var leap;
    var leapGregorian;
    var march;
    var distance;
    var index;

    if (jalaliYear < previousBreak || jalaliYear >= breaks[breaks.length - 1]) {
      throw new Error('سال شمسی خارج از محدوده است');
    }

    for (index = 1; index < breaks.length; index += 1) {
      currentBreak = breaks[index];
      jump = currentBreak - previousBreak;
      if (jalaliYear < currentBreak) {
        break;
      }
      leapJalali += integerDivision(jump, 33) * 8 + integerDivision(remainder(jump, 33), 4);
      previousBreak = currentBreak;
    }

    distance = jalaliYear - previousBreak;
    leapJalali += integerDivision(distance, 33) * 8 + integerDivision(remainder(distance, 33) + 3, 4);
    if (remainder(jump, 33) === 4 && jump - distance === 4) {
      leapJalali += 1;
    }

    leapGregorian = integerDivision(gregorianYear, 4) -
      integerDivision((integerDivision(gregorianYear, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJalali - leapGregorian;

    if (jump - distance < 6) {
      distance = distance - jump + integerDivision(jump + 4, 33) * 33;
    }
    leap = remainder(remainder(distance + 1, 33) - 1, 4);
    if (leap === -1) {
      leap = 4;
    }

    return { leap: leap, gregorianYear: gregorianYear, march: march };
  }

  function gregorianToDayNumber(year, month, day) {
    var number = integerDivision(
      (year + integerDivision(month - 8, 6) + 100100) * 1461,
      4
    ) + integerDivision(153 * remainder(month + 9, 12) + 2, 5) + day - 34840408;
    number -= integerDivision(
      integerDivision(year + 100100 + integerDivision(month - 8, 6), 100) * 3,
      4
    ) - 752;
    return number;
  }

  function dayNumberToGregorian(dayNumber) {
    var value = 4 * dayNumber + 139361631;
    value = value + integerDivision(integerDivision(4 * dayNumber + 183187720, 146097) * 3, 4) * 4 - 3908;
    var calculation = integerDivision(remainder(value, 1461), 4) * 5 + 308;
    var day = integerDivision(remainder(calculation, 153), 5) + 1;
    var month = remainder(integerDivision(calculation, 153), 12) + 1;
    var year = integerDivision(value, 1461) - 100100 + integerDivision(8 - month, 6);
    return { year: year, month: month, day: day };
  }

  function jalaliToDayNumber(year, month, day) {
    var calendar = jalaliCalendar(year);
    return gregorianToDayNumber(calendar.gregorianYear, 3, calendar.march) +
      (month - 1) * 31 - integerDivision(month, 7) * (month - 7) + day - 1;
  }

  function dayNumberToJalali(dayNumber) {
    var gregorian = dayNumberToGregorian(dayNumber);
    var year = gregorian.year - 621;
    var calendar = jalaliCalendar(year);
    var firstFarvardin = gregorianToDayNumber(gregorian.year, 3, calendar.march);
    var offset = dayNumber - firstFarvardin;

    if (offset >= 0) {
      if (offset <= 185) {
        return { year: year, month: 1 + integerDivision(offset, 31), day: remainder(offset, 31) + 1 };
      }
      offset -= 186;
    } else {
      year -= 1;
      offset += 179;
      if (calendar.leap === 1) {
        offset += 1;
      }
    }

    return { year: year, month: 7 + integerDivision(offset, 30), day: remainder(offset, 30) + 1 };
  }

  function gregorianToJalali(year, month, day) {
    return dayNumberToJalali(gregorianToDayNumber(year, month, day));
  }

  function jalaliToGregorian(year, month, day) {
    return dayNumberToGregorian(jalaliToDayNumber(year, month, day));
  }

  function jalaliMonthLength(year, month) {
    if (month <= 6) {
      return 31;
    }
    if (month <= 11) {
      return 30;
    }
    return jalaliCalendar(year).leap === 0 ? 30 : 29;
  }

  function padNumber(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function jalaliDateString(year, month, day) {
    return year + '/' + padNumber(month) + '/' + padNumber(day);
  }

  function parseJalaliDate(value) {
    var match = normalizeDigits(value).match(/^(1[34][0-9]{2})\/(0[1-9]|1[0-2])\/([0-2][0-9]|3[01])$/);
    return match ? { year: parseInt(match[1], 10), month: parseInt(match[2], 10), day: parseInt(match[3], 10) } : null;
  }

  function todayJalali() {
    var now = new Date();
    return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function nextJalaliDay(date) {
    return dayNumberToJalali(jalaliToDayNumber(date.year, date.month, date.day) + 1);
  }

  function databaseTimestampParts(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!match) {
      return null;
    }
    var jalali = gregorianToJalali(parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10));
    return {
      date: jalaliDateString(jalali.year, jalali.month, jalali.day),
      time: match[4] + ':' + match[5]
    };
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
              '<label class="emcore-todo__date-label"><span>موعد شمسی</span>' +
                '<div class="emcore-todo__date-control">' +
                  '<div class="emcore-todo__field-icon">' + icon('calendar') +
                    '<input name="due_date_fa" data-action="calendar" inputmode="none" maxlength="10" placeholder="انتخاب روز" readonly aria-controls="emcore-todo-calendar" aria-expanded="false">' +
                  '</div>' +
                  '<button type="button" class="emcore-todo__date-clear" data-action="clear-date" aria-label="پاک کردن تاریخ" hidden>' + icon('close') + '</button>' +
                  '<div class="emcore-todo__calendar" id="emcore-todo-calendar" role="dialog" aria-label="انتخاب تاریخ شمسی" hidden>' +
                    '<div class="emcore-todo__calendar-head">' +
                      '<button type="button" data-action="calendar-previous" aria-label="ماه قبل">' + icon('chevron') + '</button>' +
                      '<strong data-calendar-title></strong>' +
                      '<button type="button" data-action="calendar-next" aria-label="ماه بعد">' + icon('chevron') + '</button>' +
                    '</div>' +
                    '<div class="emcore-todo__calendar-weekdays" aria-hidden="true"><span>ش</span><span>ی</span><span>د</span><span>س</span><span>چ</span><span>پ</span><span>ج</span></div>' +
                    '<div class="emcore-todo__calendar-days" role="grid"></div>' +
                    '<div class="emcore-todo__calendar-foot"><button type="button" data-action="calendar-today">امروز</button><button type="button" data-action="clear-date">بدون تاریخ</button></div>' +
                  '</div>' +
                '</div>' +
              '</label>' +
              '<label><span>ساعت</span>' +
                '<div class="emcore-todo__time-control">' +
                  '<div class="emcore-todo__field-icon emcore-todo__time-field">' + icon('clock') +
                    '<input name="due_time" data-action="time-picker" type="text" inputmode="none" maxlength="5" readonly aria-controls="emcore-todo-time-picker" aria-expanded="false" aria-label="انتخاب ساعت موعد">' +
                  '</div>' +
                  '<button type="button" class="emcore-todo__date-clear emcore-todo__time-clear" data-action="clear-time" aria-label="پاک کردن ساعت" hidden>' + icon('close') + '</button>' +
                  '<div class="emcore-todo__time-picker" id="emcore-todo-time-picker" role="dialog" aria-label="انتخاب ساعت" hidden>' +
                    '<header class="emcore-todo__time-head">' +
                      '<div class="emcore-todo__time-display" dir="ltr">' +
                        '<button type="button" data-action="time-mode-hour" data-time-hour>--</button><span>:</span><button type="button" data-action="time-mode-minute" data-time-minute>--</button>' +
                      '</div>' +
                      '<div class="emcore-todo__period" aria-label="نیم‌روز">' +
                        '<button type="button" data-action="time-am">ق.ظ</button>' +
                        '<button type="button" data-action="time-pm">ب.ظ</button>' +
                      '</div>' +
                    '</header>' +
                    '<div class="emcore-todo__clock-face" data-clock-face role="group" aria-label="صفحه ساعت">' +
                      '<span class="emcore-todo__clock-hand" data-clock-hand aria-hidden="true"></span>' +
                      '<span class="emcore-todo__clock-pin" aria-hidden="true"></span>' +
                    '</div>' +
                    '<footer class="emcore-todo__time-foot">' +
                      '<button type="button" data-action="time-suggested">یک ساعت بعد</button>' +
                      '<button type="button" data-action="clear-time">بدون ساعت</button>' +
                      '<button type="button" class="emcore-todo__time-confirm" data-action="time-confirm">تأیید</button>' +
                    '</footer>' +
                  '</div>' +
                '</div>' +
              '</label>' +
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
        '<footer class="emcore-todo__footer"><span>فقط برای شما</span><span class="emcore-todo__privacy-dot"></span><span>نسخه ۰٫۳٫۱</span></footer>' +
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
    var dateInput = form.elements.due_date_fa;
    var dueTimeInput = form.elements.due_time;
    var details = root.querySelector('.emcore-todo__details');
    var detailsToggle = root.querySelector('[data-action="details"]');
    var calendar = root.querySelector('.emcore-todo__calendar');
    var calendarDays = root.querySelector('.emcore-todo__calendar-days');
    var calendarTitle = root.querySelector('[data-calendar-title]');
    var dateClear = root.querySelector('.emcore-todo__date-clear');
    var timePicker = root.querySelector('.emcore-todo__time-picker');
    var timeFace = root.querySelector('[data-clock-face]');
    var timeHourDisplay = root.querySelector('[data-time-hour]');
    var timeMinuteDisplay = root.querySelector('[data-time-minute]');
    var timeClear = root.querySelector('.emcore-todo__time-clear');
    var list = root.querySelector('.emcore-todo__list');
    var status = root.querySelector('.emcore-todo__status');
    var toastTimer = null;

    root.appendChild(calendar);
    root.appendChild(timePicker);

    function toPersianNumber(value) {
      return String(value).replace(/[0-9]/g, function (number) {
        return '۰۱۲۳۴۵۶۷۸۹'.charAt(parseInt(number, 10));
      });
    }

    function parseTime(value) {
      var match = normalizeDigits(value).match(/^([01][0-9]|2[0-3]):([0-5][0-9])$/);
      return match ? { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) } : null;
    }

    function timeString(parts) {
      return padNumber(parts.hour) + ':' + padNumber(parts.minute);
    }

    function suggestedTime() {
      var suggestion = new Date(Date.now() + 60 * 60 * 1000);
      var roundedMinute = Math.round(suggestion.getMinutes() / 5) * 5;
      if (roundedMinute === 60) {
        suggestion.setHours(suggestion.getHours() + 1);
        roundedMinute = 0;
      }
      return { hour: suggestion.getHours(), minute: roundedMinute };
    }

    function positionFloating(popup, anchor) {
      var margin = 10;
      var gap = 9;
      var anchorRect = anchor.getBoundingClientRect();
      var popupWidth = popup.offsetWidth;
      var popupHeight = popup.offsetHeight;
      var left = anchorRect.right - popupWidth;
      var belowTop = anchorRect.bottom + gap;
      var aboveTop = anchorRect.top - popupHeight - gap;
      var placeBelow = belowTop + popupHeight <= window.innerHeight - margin || aboveTop < margin;
      var top = placeBelow ? belowTop : aboveTop;

      left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - popupHeight - margin));
      popup.style.left = Math.round(left) + 'px';
      popup.style.top = Math.round(top) + 'px';
      popup.style.setProperty(
        '--emcore-popover-arrow',
        Math.round(Math.max(18, Math.min(anchorRect.left + anchorRect.width / 2 - left, popupWidth - 18))) + 'px'
      );
      popup.setAttribute('data-placement', placeBelow ? 'below' : 'above');
    }

    function renderTimePicker() {
      var existing = timeFace.querySelectorAll('[data-time-value]');
      var selectedValue = state.timePickerMode === 'hour'
        ? (state.timeHour % 12 || 12)
        : state.timeMinute;
      var values = [];
      var index;

      Array.prototype.forEach.call(existing, function (button) {
        button.parentNode.removeChild(button);
      });

      if (state.timePickerMode === 'hour') {
        for (index = 1; index <= 12; index += 1) {
          values.push(index);
        }
      } else {
        for (index = 0; index < 60; index += 5) {
          values.push(index);
        }
      }

      values.forEach(function (value) {
        var angle = (state.timePickerMode === 'hour' ? value * 30 : value * 6) * Math.PI / 180;
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = toPersianNumber(state.timePickerMode === 'minute' ? padNumber(value) : value);
        button.setAttribute('data-time-value', String(value));
        button.setAttribute('aria-label', toPersianNumber(value));
        button.style.left = (50 + Math.sin(angle) * 38) + '%';
        button.style.top = (50 - Math.cos(angle) * 38) + '%';
        if (value === selectedValue) {
          button.className = 'is-selected';
          button.setAttribute('aria-pressed', 'true');
        }
        timeFace.appendChild(button);
      });

      var displayHour = state.timeHour % 12 || 12;
      timeHourDisplay.textContent = toPersianNumber(padNumber(displayHour));
      timeMinuteDisplay.textContent = toPersianNumber(padNumber(state.timeMinute));
      timeHourDisplay.classList.toggle('is-active', state.timePickerMode === 'hour');
      timeMinuteDisplay.classList.toggle('is-active', state.timePickerMode === 'minute');
      root.querySelector('[data-action="time-am"]').classList.toggle('is-active', state.timeHour < 12);
      root.querySelector('[data-action="time-pm"]').classList.toggle('is-active', state.timeHour >= 12);

      var handValue = state.timePickerMode === 'hour' ? (state.timeHour % 12) * 30 : state.timeMinute * 6;
      root.querySelector('[data-clock-hand]').style.transform = 'rotate(' + handValue + 'deg)';
      if (state.timePickerOpen) {
        positionFloating(timePicker, dueTimeInput);
      }
    }

    function setTimePickerOpen(open) {
      state.timePickerOpen = open;
      timePicker.hidden = !open;
      dueTimeInput.setAttribute('aria-expanded', open ? 'true' : 'false');
      root.classList.toggle('is-time-picker-open', open);
      if (!open) {
        return;
      }

      setCalendarOpen(false);
      var liveSuggestion = suggestedTime();
      dueTimeInput.placeholder = toPersianNumber(timeString(liveSuggestion));
      dueTimeInput.title = 'پیشنهاد یک ساعت بعد: ' + toPersianNumber(timeString(liveSuggestion));
      var selected = parseTime(dueTimeInput.value) || liveSuggestion;
      state.timeHour = selected.hour;
      state.timeMinute = selected.minute;
      state.timePickerMode = 'hour';
      renderTimePicker();
    }

    function selectClockValue(value) {
      if (state.timePickerMode === 'hour') {
        var isAfternoon = state.timeHour >= 12;
        state.timeHour = value % 12 + (isAfternoon ? 12 : 0);
        state.timePickerMode = 'minute';
      } else {
        state.timeMinute = value;
      }
      renderTimePicker();
    }

    function setTimePeriod(isAfternoon) {
      state.timeHour = state.timeHour % 12 + (isAfternoon ? 12 : 0);
      renderTimePicker();
    }

    function confirmTime() {
      dueTimeInput.value = toPersianNumber(timeString({ hour: state.timeHour, minute: state.timeMinute }));
      timeClear.hidden = false;
      setTimePickerOpen(false);
    }

    function clearScheduleTime() {
      dueTimeInput.value = '';
      timeClear.hidden = true;
      setTimePickerOpen(false);
    }

    function renderCalendar() {
      var monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
      var selected = parseJalaliDate(dateInput.value);
      var today = todayJalali();
      var firstGregorian = jalaliToGregorian(state.calendarYear, state.calendarMonth, 1);
      var firstWeekday = (new Date(firstGregorian.year, firstGregorian.month - 1, firstGregorian.day).getDay() + 1) % 7;
      var daysInMonth = jalaliMonthLength(state.calendarYear, state.calendarMonth);
      var day;
      var blank;

      calendarTitle.textContent = monthNames[state.calendarMonth - 1] + ' ' + toPersianNumber(state.calendarYear);
      calendarDays.innerHTML = '';

      for (blank = 0; blank < firstWeekday; blank += 1) {
        var spacer = document.createElement('span');
        spacer.className = 'emcore-todo__calendar-blank';
        spacer.setAttribute('aria-hidden', 'true');
        calendarDays.appendChild(spacer);
      }

      for (day = 1; day <= daysInMonth; day += 1) {
        var button = document.createElement('button');
        var dateValue = jalaliDateString(state.calendarYear, state.calendarMonth, day);
        button.type = 'button';
        button.textContent = toPersianNumber(day);
        button.setAttribute('data-calendar-day', dateValue);
        button.setAttribute('role', 'gridcell');
        button.setAttribute('aria-label', toPersianNumber(dateValue));
        if (selected && selected.year === state.calendarYear && selected.month === state.calendarMonth && selected.day === day) {
          button.classList.add('is-selected');
          button.setAttribute('aria-selected', 'true');
        }
        if (today.year === state.calendarYear && today.month === state.calendarMonth && today.day === day) {
          button.classList.add('is-today');
        }
        calendarDays.appendChild(button);
      }
      if (state.calendarOpen) {
        positionFloating(calendar, dateInput);
      }
    }

    function setCalendarOpen(open) {
      if (open) {
        setTimePickerOpen(false);
      }
      state.calendarOpen = open;
      calendar.hidden = !open;
      dateInput.setAttribute('aria-expanded', open ? 'true' : 'false');
      root.classList.toggle('is-calendar-open', open);
      if (!open) {
        return;
      }

      var selected = parseJalaliDate(dateInput.value) || todayJalali();
      state.calendarYear = selected.year;
      state.calendarMonth = selected.month;
      renderCalendar();
    }

    function moveCalendarMonth(direction) {
      state.calendarMonth += direction;
      if (state.calendarMonth < 1) {
        state.calendarMonth = 12;
        state.calendarYear -= 1;
      } else if (state.calendarMonth > 12) {
        state.calendarMonth = 1;
        state.calendarYear += 1;
      }
      renderCalendar();
    }

    function selectCalendarDate(dateValue) {
      var parsed = parseJalaliDate(dateValue);
      if (!parsed || parsed.day > jalaliMonthLength(parsed.year, parsed.month)) {
        showToast('تاریخ انتخاب‌شده معتبر نیست', 'error');
        return;
      }
      dateInput.value = toPersianNumber(jalaliDateString(parsed.year, parsed.month, parsed.day));
      dateClear.hidden = false;
      setCalendarOpen(false);
    }

    function clearScheduleDate() {
      dateInput.value = '';
      dueTimeInput.value = '';
      dateClear.hidden = true;
      timeClear.hidden = true;
      setCalendarOpen(false);
      setTimePickerOpen(false);
    }

    var initialSuggestedTime = suggestedTime();
    dueTimeInput.placeholder = toPersianNumber(timeString(initialSuggestedTime));
    dueTimeInput.title = 'پیشنهاد یک ساعت بعد: ' + toPersianNumber(timeString(initialSuggestedTime));

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
      if (!open) {
        setCalendarOpen(false);
        setTimePickerOpen(false);
      }
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

    function groupedTasks(tasks) {
      var ordered = tasks.slice().sort(function (left, right) {
        var leftDate = left.due_date_fa || '9999/99/99';
        var rightDate = right.due_date_fa || '9999/99/99';
        if (leftDate !== rightDate) {
          return leftDate < rightDate ? -1 : 1;
        }
        if (left.is_completed !== right.is_completed) {
          return left.is_completed - right.is_completed;
        }
        var leftTime = left.due_time || '99:99';
        var rightTime = right.due_time || '99:99';
        if (leftTime !== rightTime) {
          return leftTime < rightTime ? -1 : 1;
        }
        if (left.priority !== right.priority) {
          return right.priority - left.priority;
        }
        return right.id - left.id;
      });
      var groups = [];
      var lookup = {};

      ordered.forEach(function (task) {
        var key = task.due_date_fa || 'unscheduled';
        if (!lookup[key]) {
          lookup[key] = { key: key, tasks: [] };
          groups.push(lookup[key]);
        }
        lookup[key].tasks.push(task);
      });
      return groups;
    }

    function groupPresentation(key) {
      if (key === 'unscheduled') {
        return { label: 'بدون زمان‌بندی', caption: 'کارهای آزاد', className: 'is-unscheduled' };
      }

      var months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
      var weekdays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
      var parsed = parseJalaliDate(key);
      var today = todayJalali();
      var tomorrow = nextJalaliDay(today);
      var todayKey = jalaliDateString(today.year, today.month, today.day);
      var tomorrowKey = jalaliDateString(tomorrow.year, tomorrow.month, tomorrow.day);
      var gregorian = jalaliToGregorian(parsed.year, parsed.month, parsed.day);
      var weekday = weekdays[new Date(gregorian.year, gregorian.month - 1, gregorian.day).getDay()];
      var readable = weekday + '، ' + toPersianNumber(parsed.day) + ' ' + months[parsed.month - 1];
      var label = readable;

      if (key === todayKey) {
        label = 'امروز';
      } else if (key === tomorrowKey) {
        label = 'فردا';
      }

      return {
        label: label,
        caption: key === todayKey || key === tomorrowKey ? readable : toPersianNumber(key),
        className: key < todayKey ? 'is-overdue' : ''
      };
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
        dueText.textContent = toPersianNumber(task.due_date_fa + (task.due_time ? ' • ' + task.due_time : ''));
        due.appendChild(dueText);
        meta.appendChild(due);
      }
      var timestamp = databaseTimestampParts(task.completed_at || task.created_at);
      if (timestamp) {
        var recorded = document.createElement('span');
        recorded.className = 'emcore-todo__timestamp';
        recorded.innerHTML = icon('clock');
        var recordedText = document.createElement('b');
        recordedText.textContent =
          (task.completed_at ? 'انجام ' : 'ثبت ') +
          toPersianNumber(timestamp.date + ' • ' + timestamp.time);
        recorded.appendChild(recordedText);
        meta.appendChild(recorded);
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

      groupedTasks(tasks).forEach(function (group, groupIndex) {
        var presentation = groupPresentation(group.key);
        var section = document.createElement('section');
        var headingId = 'emcore-todo-group-' + groupIndex;
        section.className = 'emcore-todo__group ' + presentation.className;
        section.setAttribute('role', 'group');
        section.setAttribute('aria-labelledby', headingId);
        section.innerHTML =
          '<header class="emcore-todo__group-head">' +
            '<div><strong id="' + headingId + '">' + presentation.label + '</strong><span>' + presentation.caption + '</span></div>' +
            '<b>' + toPersianNumber(group.tasks.length) + ' کار</b>' +
          '</header>';
        var groupBody = document.createElement('div');
        groupBody.className = 'emcore-todo__group-body';
        group.tasks.forEach(function (task) {
          groupBody.appendChild(taskElement(task));
        });
        section.appendChild(groupBody);
        list.appendChild(section);
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
      dateClear.hidden = true;
      timeClear.hidden = true;
      setCalendarOpen(false);
      setTimePickerOpen(false);
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
      form.elements.due_time.value = task.due_time ? toPersianNumber(task.due_time) : '';
      dateClear.hidden = !task.due_date_fa;
      timeClear.hidden = !task.due_time;
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
        due_date_fa: normalizeDigits(form.elements.due_date_fa.value),
        due_time: normalizeDigits(form.elements.due_time.value)
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
      var dayButton = event.target.closest('[data-calendar-day]');
      var timeValueButton = event.target.closest('[data-time-value]');

      if (dayButton) {
        selectCalendarDate(dayButton.getAttribute('data-calendar-day'));
        return;
      }
      if (timeValueButton) {
        selectClockValue(parseInt(timeValueButton.getAttribute('data-time-value'), 10));
        return;
      }

      if (filterButton) {
        setCalendarOpen(false);
        setTimePickerOpen(false);
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
      if (action === 'calendar') {
        setCalendarOpen(!state.calendarOpen);
        return;
      }
      if (action === 'time-picker') {
        setTimePickerOpen(!state.timePickerOpen);
        return;
      }
      if (action === 'time-mode-hour') {
        state.timePickerMode = 'hour';
        renderTimePicker();
        return;
      }
      if (action === 'time-mode-minute') {
        state.timePickerMode = 'minute';
        renderTimePicker();
        return;
      }
      if (action === 'time-am') {
        setTimePeriod(false);
        return;
      }
      if (action === 'time-pm') {
        setTimePeriod(true);
        return;
      }
      if (action === 'time-suggested') {
        var suggested = suggestedTime();
        state.timeHour = suggested.hour;
        state.timeMinute = suggested.minute;
        state.timePickerMode = 'hour';
        renderTimePicker();
        return;
      }
      if (action === 'time-confirm') {
        confirmTime();
        return;
      }
      if (action === 'clear-time') {
        clearScheduleTime();
        return;
      }
      if (action === 'calendar-previous') {
        moveCalendarMonth(-1);
        return;
      }
      if (action === 'calendar-next') {
        moveCalendarMonth(1);
        return;
      }
      if (action === 'calendar-today') {
        var today = todayJalali();
        selectCalendarDate(jalaliDateString(today.year, today.month, today.day));
        return;
      }
      if (action === 'clear-date') {
        clearScheduleDate();
        return;
      }
      if (action === 'close') {
        setOpen(false);
        return;
      }
      if (action === 'refresh') {
        loadTasks();
        return;
      }
      if (action === 'details') {
        var openingDetails = detailsToggle.getAttribute('aria-expanded') !== 'true';
        openDetails(openingDetails);
        if (!openingDetails) {
          setCalendarOpen(false);
          setTimePickerOpen(false);
        }
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

    document.addEventListener('click', function (event) {
      var eventPath = event.composedPath ? event.composedPath() : [];
      var insideCalendar = eventPath.indexOf(calendar) !== -1 ||
        !!event.target.closest('.emcore-todo__date-control');
      var insideTimePicker = eventPath.indexOf(timePicker) !== -1 ||
        !!event.target.closest('.emcore-todo__time-control');

      if (state.calendarOpen &&
          !insideCalendar) {
        setCalendarOpen(false);
      }
      if (state.timePickerOpen &&
          !insideTimePicker) {
        setTimePickerOpen(false);
      }
    });

    window.addEventListener('resize', function () {
      if (state.calendarOpen) {
        positionFloating(calendar, dateInput);
      } else if (state.timePickerOpen) {
        positionFloating(timePicker, dueTimeInput);
      }
    });

    document.addEventListener('keydown', function (event) {
      if ((event.key === 'Escape' || event.keyCode === 27) && trigger.getAttribute('aria-expanded') === 'true') {
        if (state.calendarOpen) {
          setCalendarOpen(false);
          dateInput.focus();
        } else if (state.timePickerOpen) {
          setTimePickerOpen(false);
          dueTimeInput.focus();
        } else if (state.editingId) {
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
