/* ==========================================================================
   表单引擎：按 js/schema.js 的定义渲染、校验、提交。
   招新、周年庆、预约提醒三张表共用这一份代码，加一张新表只需在 schema.js 里加一段。

   校验分两层：这里做的是「让人马上看到哪里填错了」，
   真正把关的是云函数那一层 —— 前端校验永远可以被绕过。
   ========================================================================== */

(function (global) {
  "use strict";

  var CFG = global.AIXI_CONFIG || {};
  var MAX_BYTES = (CFG.RESUME_MAX_MB || 20) * 1024 * 1024;
  var ACCEPT = CFG.RESUME_ACCEPT || [".pdf", ".jpg", ".jpeg", ".png"];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function fmtSize(n) {
    return n < 1024 * 1024 ? (n / 1024).toFixed(0) + " KB" : (n / 1024 / 1024).toFixed(1) + " MB";
  }

  /* ---------------- 单个字段的 HTML ---------------- */
  function fieldHtml(f) {
    var id = "f_" + f.key;
    var req = f.required ? '<span class="req" aria-hidden="true">*</span>' : "";
    var help = f.help ? '<p class="help">' + f.help + "</p>" : "";
    var body;

    switch (f.type) {
      case "textarea":
        body = '<textarea class="textarea" id="' + id + '" name="' + f.key + '"'
          + (f.maxlength ? ' maxlength="' + f.maxlength + '"' : "")
          + (f.required ? " required" : "") + "></textarea>";
        break;

      case "select":
        body = '<select class="select" id="' + id + '" name="' + f.key + '"'
          + (f.required ? " required" : "") + ">"
          + '<option value="">请选择</option>'
          + (f.options || []).map(function (o) {
            return '<option value="' + esc(o) + '">' + esc(o) + "</option>";
          }).join("")
          + "</select>";
        break;

      case "radio":
        body = '<div class="radio-row" role="radiogroup" aria-labelledby="' + id + '_l">'
          + (f.options || []).map(function (o, i) {
            return '<label><input type="radio" name="' + f.key + '" value="' + esc(o) + '"'
              + (i === 0 && f.required ? "" : "") + "> " + esc(o) + "</label>";
          }).join("")
          + "</div>";
        break;

      case "file":
        body = '<div class="file-drop" id="' + id + '_drop" tabindex="0" role="button"'
          + ' aria-controls="' + id + '" aria-label="选择要上传的文件">'
          + '<div class="fd-main">点击选择文件，或把文件拖到这里</div>'
          + '<div class="fd-sub">支持 ' + ACCEPT.join("、") + '，不超过 '
          + (CFG.RESUME_MAX_MB || 20) + "MB</div>"
          + "</div>"
          + '<input class="file-pick" type="file" id="' + id + '" name="' + f.key
          + '" accept="' + ACCEPT.join(",") + '">'
          + '<div class="file-chosen" id="' + id + '_chosen">'
          + '<span class="fc-name"></span>'
          + '<button type="button" class="btn btn-ghost btn-sm" data-clear-file>移除</button>'
          + "</div>"
          + '<div class="progress" id="' + id + '_prog"><i></i></div>';
        break;

      case "number":
        body = '<input class="input" type="number" inputmode="numeric" min="0" max="99" id="' + id
          + '" name="' + f.key + '"' + (f.required ? " required" : "") + ">";
        break;

      default:
        var inputType = f.type === "email" ? "email" : (f.type === "tel" ? "tel" : "text");
        var mode = f.type === "tel" ? ' inputmode="numeric"'
          : (f.type === "email" ? ' inputmode="email" autocapitalize="off" spellcheck="false"' : "");
        body = '<input class="input" type="' + inputType + '"' + mode + ' id="' + id
          + '" name="' + f.key + '"'
          + (f.maxlength ? ' maxlength="' + f.maxlength + '"' : "")
          + (f.value ? ' value="' + esc(f.value) + '"' : "")
          + (f.required ? " required" : "") + ">";
    }

    var labelTag = f.type === "radio"
      ? '<span class="label" id="' + id + '_l">' + esc(f.label) + req + "</span>"
      : '<label for="' + id + '">' + esc(f.label) + req + "</label>";

    return '<div class="field" data-key="' + f.key + '" data-type="' + f.type + '">'
      + labelTag + body + help
      + '<p class="err-msg" role="alert"></p></div>';
  }

  /* ---------------- 校验 ---------------- */
  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var RE_PHONE = /^1[3-9]\d{9}$/;

  function validateField(wrap, f) {
    var msg = "";
    var v;

    if (f.type === "radio") {
      v = wrap.querySelector('input[type=radio]:checked');
      if (f.required && !v) msg = "请选择一项";
    } else if (f.type === "file") {
      var input = wrap.querySelector("input[type=file]");
      var file = input && input.files && input.files[0];
      if (f.required && !file) msg = "请选择文件";
      if (file) {
        var name = file.name.toLowerCase();
        var okExt = ACCEPT.some(function (e) { return name.slice(-e.length) === e; });
        if (!okExt) msg = "只支持 " + ACCEPT.join("、") + " 格式";
        else if (file.size > MAX_BYTES) {
          msg = "文件 " + fmtSize(file.size) + "，超过 " + (CFG.RESUME_MAX_MB || 20) + "MB 上限";
        }
      }
    } else {
      var ctrl = wrap.querySelector("input, textarea, select");
      v = ctrl ? String(ctrl.value || "").trim() : "";
      if (f.required && !v) msg = "这一项是必填的";
      else if (v && f.type === "email" && !RE_EMAIL.test(v)) msg = "邮箱格式看起来不对";
      else if (v && f.type === "tel" && !RE_PHONE.test(v)) msg = "请填 11 位手机号";
      else if (v && f.maxlength && v.length > f.maxlength) msg = "最多 " + f.maxlength + " 个字";
    }

    wrap.classList.toggle("has-error", !!msg);
    var box = wrap.querySelector(".err-msg");
    if (box) box.textContent = msg;
    return !msg;
  }

  /* ---------------- 主体 ---------------- */
  /**
   * @param opts.schema     字段定义
   * @param opts.host       挂载容器
   * @param opts.formType   提交类型
   * @param opts.onSuccess  成功回调
   * @param opts.values     初值。修改已有报名时用 —— 复用同一套表单渲染，
   *                        而不是另写一份编辑界面，两份必然会渐渐长歪
   * @param opts.submitFn   自定义提交。给 (data, fileId) 返回 Promise；
   *                        不传则走默认的 AixiApi.submitForm
   * @param opts.hideAgree  修改时不必再勾一次同意条款
   */
  function mount(opts) {
    var schema = opts.schema;
    var host = opts.host;
    var formType = opts.formType;
    var onSuccess = opts.onSuccess;
    var values = opts.values || null;
    var submitFn = opts.submitFn || null;
    var hideAgree = !!opts.hideAgree;

    var allFields = [];
    schema.groups.forEach(function (g) { allFields = allFields.concat(g.fields); });

    var html = '<form class="form-card" novalidate>'
      + (global.AixiApi && global.AixiApi.isDemo
        ? '<div class="notice notice-warn"><strong>演示模式</strong>：'
        + '当前没有连接云开发，下面的表单可以完整填写和校验，但<strong>不会真正提交</strong>，'
        + '数据只存在这台电脑的浏览器里。填好 js/config.js 里的 ENV_ID 和 API_BASE 后即为正式模式。</div>'
        : "")
      + (schema.intro ? '<p class="help" style="margin:0 0 26px;font-size:.95rem;">' + schema.intro + "</p>" : "")
      + schema.groups.map(function (g) {
        return (g.name ? '<h3 style="margin:34px 0 18px;font-size:1.05rem;color:var(--ink);letter-spacing:1px;">'
          + esc(g.name) + "</h3>" : "")
          + g.fields.map(fieldHtml).join("");
      }).join("")
      + (schema.agree && !hideAgree
        ? '<div class="field" data-key="' + schema.agree.key + '" data-type="agree">'
        + '<label style="font-weight:normal;display:flex;gap:9px;align-items:flex-start;line-height:1.7;">'
        + '<input type="checkbox" name="' + schema.agree.key + '" style="margin-top:4px;">'
        + "<span>" + schema.agree.text + "</span></label>"
        + '<p class="err-msg" role="alert"></p></div>'
        : "")
      + '<div class="notice notice-err" id="formError" style="display:none;"></div>'
      + '<button type="submit" class="btn btn-primary" style="width:100%;margin-top:10px;">'
      + esc(schema.submitText || "提交") + "</button>"
      + "</form>";

    host.innerHTML = html;
    var form = host.querySelector("form");

    /* 填初值。radio 要按 value 勾选，其余直接赋值。
       文件字段填不了初值（浏览器不允许），已有附件由调用方在别处提示。 */
    if (values) {
      allFields.forEach(function (f) {
        if (f.type === "file") return;
        var v = values[f.key];
        if (v === undefined || v === null || v === "") return;
        var wrap = form.querySelector('.field[data-key="' + f.key + '"]');
        if (!wrap) return;
        if (f.type === "radio") {
          var r = wrap.querySelector('input[type=radio][value="' + String(v).replace(/"/g, '\\"') + '"]');
          if (r) r.checked = true;
        } else {
          var c = wrap.querySelector("input, textarea, select");
          if (c) c.value = v;
        }
      });
    }
    var errBox = form.querySelector("#formError");
    var submitBtn = form.querySelector('button[type=submit]');

    /* --- 文件选择：点击、键盘、拖拽三种都要能用 --- */
    allFields.filter(function (f) { return f.type === "file"; }).forEach(function (f) {
      var wrap = form.querySelector('.field[data-key="' + f.key + '"]');
      var drop = wrap.querySelector(".file-drop");
      var input = wrap.querySelector("input[type=file]");
      var chosen = wrap.querySelector(".file-chosen");
      var nameEl = chosen.querySelector(".fc-name");

      function show() {
        var file = input.files && input.files[0];
        if (file) {
          nameEl.textContent = file.name + "（" + fmtSize(file.size) + "）";
          chosen.classList.add("is-shown");
        } else {
          chosen.classList.remove("is-shown");
        }
        validateField(wrap, f);
      }

      drop.addEventListener("click", function () { input.click(); });
      drop.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
      });
      input.addEventListener("change", show);
      wrap.querySelector("[data-clear-file]").addEventListener("click", function () {
        input.value = "";
        show();
      });
      ["dragenter", "dragover"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
      });
      drop.addEventListener("drop", function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          input.files = e.dataTransfer.files;
          show();
        }
      });
    });

    /* --- 失焦即校验，不必等到提交 --- */
    allFields.forEach(function (f) {
      var wrap = form.querySelector('.field[data-key="' + f.key + '"]');
      if (!wrap) return;
      Array.prototype.forEach.call(wrap.querySelectorAll("input, textarea, select"), function (c) {
        c.addEventListener("blur", function () { validateField(wrap, f); });
      });
    });

    function collect() {
      var data = {};
      allFields.forEach(function (f) {
        if (f.type === "file") return;
        var wrap = form.querySelector('.field[data-key="' + f.key + '"]');
        if (!wrap) return;
        if (f.type === "radio") {
          var r = wrap.querySelector("input[type=radio]:checked");
          data[f.key] = r ? r.value : "";
        } else {
          var c = wrap.querySelector("input, textarea, select");
          data[f.key] = c ? String(c.value || "").trim() : "";
        }
      });
      return data;
    }

    function setBusy(busy, text) {
      submitBtn.disabled = busy;
      submitBtn.textContent = busy ? (text || "提交中…") : (schema.submitText || "提交");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errBox.style.display = "none";

      var firstBad = null;
      allFields.forEach(function (f) {
        var wrap = form.querySelector('.field[data-key="' + f.key + '"]');
        if (!wrap) return;
        if (!validateField(wrap, f) && !firstBad) firstBad = wrap;
      });

      // 同意条款单独校验（修改时不再要求）
      if (schema.agree && !hideAgree) {
        var aw = form.querySelector('.field[data-type="agree"]');
        var box = aw.querySelector("input[type=checkbox]");
        var ok = !schema.agree.required || box.checked;
        aw.classList.toggle("has-error", !ok);
        aw.querySelector(".err-msg").textContent = ok ? "" : "需要勾选才能提交";
        if (!ok && !firstBad) firstBad = aw;
      }

      if (firstBad) {
        var ctrl = firstBad.querySelector("input, textarea, select");
        if (ctrl) ctrl.focus();
        firstBad.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }

      var data = collect();
      var fileField = allFields.filter(function (f) { return f.type === "file"; })[0];
      var file = null;
      if (fileField) {
        var fi = form.querySelector('.field[data-key="' + fileField.key + '"] input[type=file]');
        file = fi && fi.files && fi.files[0];
      }

      setBusy(true);

      var uploadStep = Promise.resolve("");
      if (file) {
        if (!global.AixiCloud || !global.AixiCloud.isConfigured()) {
          // 演示模式下不假装上传成功，但也不该因此拦住整张表
          data._resumeNote = "演示模式未上传：" + file.name + "（" + fmtSize(file.size) + "）";
        } else {
          var prog = form.querySelector('.field[data-key="' + fileField.key + '"] .progress');
          var bar = prog.querySelector("i");
          prog.classList.add("is-shown");
          setBusy(true, "上传附件 0%…");
          uploadStep = global.AixiCloud.uploadResume(file, formType, function (p) {
            bar.style.width = p + "%";
            setBusy(true, "上传附件 " + p + "%…");
          });
        }
      }

      uploadStep.then(function (fileId) {
        setBusy(true, "提交中…");
        return submitFn
          ? submitFn(data, fileId)
          : global.AixiApi.submitForm(formType, data, fileId);
      }).then(function (res) {
        onSuccess(res, data);
      }).catch(function (err) {
        setBusy(false);
        errBox.textContent = (err && err.message) || "提交失败，请稍后重试。";
        errBox.style.display = "block";
        errBox.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
  }

  global.AixiForms = { mount: mount };
})(window);
