/* ==========================================================================
   报名页调度
   决定当前该显示哪一张表：
     apply.html                  → 招新（开放时是报名表，未开放时是预约提醒）
     apply.html?form=anniversary → 周年庆（同上）
   开关来自数据库 site_config，后台点一下即生效，不需要重新部署。
   ========================================================================== */

(function () {
  "use strict";

  var CFG = window.AIXI_CONFIG || {};
  var SCHEMAS = window.AIXI_SCHEMAS || {};

  var q = new URLSearchParams(location.search);
  var formType = q.get("form") === "anniversary" ? "anniversary" : "recruit";

  var elEyebrow = document.getElementById("pageEyebrow");
  var elTitle = document.getElementById("pageTitle");
  var elState = document.getElementById("pageState");
  var elInfo = document.getElementById("recruitInfo");
  var host = document.getElementById("formHost");

  // 招新详情只跟招新有关，周年庆模式下整块隐藏
  if (formType === "anniversary" && elInfo) elInfo.hidden = true;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------------- 提交成功 ---------------- */
  var siteCfg = {};

  /** 只放行 http(s) 外链和站内 images/ files/ 两个目录，挡掉跳出目录和 javascript: */
  function safeUrl(u) {
    var t = String(u || "").trim();
    if (/^https?:\/\//i.test(t)) return t;
    if (/^(images|files)\//i.test(t) && t.indexOf("..") < 0 && t.indexOf(":") < 0) return t;
    return "";
  }

  /** 简历模板（报名表）的下载入口。
      放在「上传简历」这一栏里，就在上传框上方 —— 要交的东西和拿模板的地方
      挨在一起，人不用先记住「上面有个链接」再滚回来。
      后台没配模板时整块不出现，不留一个点不动的按钮。 */
  function mountFormTemplate(formEl) {
    var anni = formType === "anniversary";
    if (anni || !formEl) return;                 // 周年庆没有报名表这一说
    var u = safeUrl(siteCfg.form_url);
    if (!u) return;

    var wrap = formEl.querySelector('.field[data-key="resume"]');
    var drop = wrap && wrap.querySelector(".file-drop");
    if (!drop) return;

    var box = document.createElement("div");
    box.className = "tpl-row";
    box.innerHTML = '<a class="btn btn-primary btn-sm" href="' + esc(u)
      + '" target="_blank" rel="noopener" download>下载简历模板</a>'
      + '<span class="tpl-tip">先下载模板填好，再上传到下面。'
      + "也可以之后凭邮箱和凭证码回来补传。</span>";
    drop.parentNode.insertBefore(box, drop);
  }

  /** 提交成功后的「下一步」：领报名表、加招新群。
      三项都由后台填，留空的不显示 —— 没配置时这一块整体不出现，
      不会给报名者留一个空框。 */
  function nextStepsHtml() {
    // 招新与周年庆各用自己那一套，否则周年庆报名者会看到招新的报名表链接
    var anni = formType === "anniversary";
    var url = String((anni ? siteCfg.anni_form_url : siteCfg.form_url) || "").trim();
    var qr = String((anni ? siteCfg.anni_group_qr : siteCfg.group_qr) || "").trim();
    var note = String((anni ? siteCfg.anni_next_note : siteCfg.next_note) || "").trim();
    if (!url && !qr && !note) return "";

    var u = safeUrl(url), q = safeUrl(qr);

    var h = '<div style="margin-top:26px;padding:22px;background:var(--paper-2);'
      + 'border-radius:12px;">'
      + '<div style="font-weight:bold;color:var(--ink);margin-bottom:10px;">接下来还有两件事</div>';
    if (note) h += '<p class="help" style="margin:0 0 16px;font-size:.92rem;">' + esc(note) + "</p>";
    if (u) {
      h += '<p style="margin:0 0 14px;"><a class="btn btn-primary btn-sm" href="' + esc(u)
        + '" target="_blank" rel="noopener">'
        + (formType === "anniversary" ? "查看活动详情" : "再下载一次报名表") + "</a></p>";
    }
    if (q) {
      h += '<div style="text-align:center;margin-top:6px;">'
        + '<img src="' + esc(q) + '" alt="招新群二维码" '
        + 'style="width:180px;max-width:60%;height:auto;border-radius:8px;background:#fff;padding:8px;">'
        + '<p class="help" style="margin:10px 0 0;">'
        + (formType === "anniversary" ? "扫码加入活动群" : "扫码加入招新群") + "</p></div>";
    }
    return h + "</div>";
  }

  function showSuccess(res, data) {
    var isRemind = res && res.remind;
    // 预约提醒不给凭证码：查询接口只覆盖招新和周年庆两张表，
    // 给一个查不到东西的码只会让人白试一次。
    var ticket = isRemind ? "" : (res && res.ticket);
    var demo = !!(res && res.demo);

    var html = '<div class="form-card">';

    if (demo) {
      html += '<div class="notice notice-warn"><strong>演示模式</strong>：'
        + '这条记录只写进了本机浏览器，并没有真正提交到云端。</div>';
    }

    html += '<div class="notice notice-ok" style="margin-bottom:26px;"><strong>'
      + (isRemind ? "已记下你的邮箱。" : "提交成功。")
      + "</strong>"
      + (isRemind
        ? " 报名开放的那天，我们会发信到 " + esc(data.email) + "。"
        : " 我们已经收到你的信息，面试通知与结果会发到 " + esc(data.email) + "。")
      + "</div>";

    if (ticket) {
      html += '<div class="ticket-box">'
        + '<div style="font-size:.85rem;color:var(--muted);letter-spacing:2px;">你的凭证码</div>'
        + '<div class="code" id="ticketCode">' + esc(ticket) + "</div>"
        + '<button type="button" class="btn btn-ghost btn-sm" id="copyTicket" '
        + 'style="color:var(--ink);">复制凭证码</button>'
        + '<p class="help" style="margin-top:14px;">'
        + '请<strong>截图或抄下来保存</strong>。凭「邮箱 + 凭证码」可以在查询进度页面看状态、补传简历。'
        + '这个码我们无法帮你找回，但你随时可以用同一个邮箱联系我们。</p>'
        + "</div>";
    }

    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">'
      + (isRemind ? "" : '<a class="btn btn-primary" href="status.html">去查询进度</a>')
      + '<a class="btn ' + (isRemind ? "btn-primary" : "btn-ghost") + '" href="index.html"'
      + (isRemind ? "" : ' style="color:var(--ink);"') + ">回到首页</a>"
      + "</div></div>";

    host.innerHTML = html;
    host.scrollIntoView({ block: "start", behavior: "smooth" });

    var copyBtn = document.getElementById("copyTicket");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var code = document.getElementById("ticketCode").textContent;
        var done = function () {
          copyBtn.textContent = "已复制";
          setTimeout(function () { copyBtn.textContent = "复制凭证码"; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(done, function () { });
        } else {
          // 老浏览器兜底
          var t = document.createElement("textarea");
          t.value = code;
          document.body.appendChild(t);
          t.select();
          try { document.execCommand("copy"); done(); } catch (e) { }
          document.body.removeChild(t);
        }
      });
    }
  }

  /* ---------------- 根据开关决定显示什么 ---------------- */
  function render(cfg) {
    siteCfg = cfg || {};
    var isOpen, title, eyebrow, note, schemaKey, submitType;

    if (formType === "anniversary") {
      isOpen = !!cfg.anniversary_open;
      title = cfg.anniversary_title || "周年庆报名";
      eyebrow = "ANNIVERSARY";
      note = cfg.anniversary_note || CFG.FALLBACK.anniversary_note;
      schemaKey = isOpen ? "anniversary" : "remind";
      submitType = isOpen ? "anniversary" : "remind_anniversary";
    } else {
      isOpen = !!cfg.recruit_open;
      title = (cfg.recruit_year || "2027") + " 年度队员招新报名";
      eyebrow = "RECRUITMENT";
      note = cfg.recruit_note || CFG.FALLBACK.recruit_note;
      schemaKey = isOpen ? "recruit" : "remind";
      submitType = isOpen ? "recruit" : "remind_recruit";
    }

    if (elEyebrow) elEyebrow.textContent = eyebrow;
    if (elTitle) elTitle.textContent = title;
    if (elState) {
      elState.classList.toggle("is-open", isOpen);
      if (isOpen) {
        elState.textContent = cfg.recruit_deadline && formType === "recruit"
          ? "报名开放中 · 截止 " + cfg.recruit_deadline
          : "报名开放中";
      } else {
        elState.textContent = "报名暂未开放";
      }
    }

    var schema = SCHEMAS[schemaKey];
    if (!schema) {
      host.innerHTML = '<div class="notice notice-err">找不到表单定义：' + esc(schemaKey) + "</div>";
      return;
    }

    // 未开放时，在表单上方先把话说清楚，再给预约提醒
    var lead = "";
    if (!isOpen) {
      lead = '<div class="notice notice-info" style="max-width:720px;margin:0 auto 22px;">'
        + "<strong>现在还不能报名。</strong> " + esc(note)
        + "</div>";
    }
    host.innerHTML = lead + '<div id="formInner"></div>';

    window.AixiForms.mount({
      schema: schema,
      host: document.getElementById("formInner"),
      formType: submitType,
      onSuccess: function (res, data) {
        showSuccess(Object.assign({ remind: !isOpen }, res || {}), data);
      }
    });

    // 报名表的下载链接挂在提交按钮下面（预约提醒表不需要）
    if (isOpen) mountFormTemplate(document.querySelector("#formInner form"));
  }

  /* ---------------- 起步 ---------------- */
  var fallback = CFG.FALLBACK || {};
  if (!window.AixiApi) { render(fallback); return; }

  window.AixiApi.getPublic().then(function (data) {
    render(Object.assign({}, fallback, (data && data.config) || {}));
  }).catch(function (err) {
    // 读不到配置时按「未开放」处理：宁可让人预约提醒，也不要开一张可能不该开的表
    render(fallback);
    if (window.console) console.warn("[爱西] 读取开放状态失败，按未开放处理：", err && err.message);
  });
})();
