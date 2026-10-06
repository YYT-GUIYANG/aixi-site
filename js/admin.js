/* ==========================================================================
   后台
   所有读写都经由云函数 aixiApi（带登录态的 SDK 调用），前端不直连数据库。
   演示模式（config.js 里 ENV_ID 留空）下可以直接进来点一遍界面，数据存在本机浏览器。
   ========================================================================== */

(function () {
  "use strict";

  var CFG = window.AIXI_CONFIG || {};
  var DEMO = !!(window.AixiApi && window.AixiApi.isDemo);

  var loginBox = document.getElementById("loginBox");
  var mainBox = document.getElementById("mainBox");
  var whoAmI = document.getElementById("whoAmI");
  var logoutBtn = document.getElementById("logoutBtn");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function show(el, on) { el.style.display = on ? "" : "none"; }

  function notify(id, msg, ms) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    show(el, true);
    if (ms !== 0) setTimeout(function () { show(el, false); }, ms || 2600);
  }

  /* ====================== 登录 ====================== */
  (function initLogin() {
    if (DEMO) show(document.getElementById("loginDemoNote"), true);

    var btn = document.getElementById("loginBtn");
    btn.addEventListener("click", function () {
      var email = document.getElementById("adEmail").value.trim();
      var pass = document.getElementById("adPass").value;

      if (DEMO) { enterAdmin("演示模式"); return; }

      if (!email || !pass) {
        notify("loginError", "请填写邮箱和密码。", 0);
        return;
      }
      btn.disabled = true;
      btn.textContent = "登录中…";
      window.AixiCloud.adminLogin(email, pass).then(function () {
        enterAdmin(email);
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = "登录";
        notify("loginError", (err && err.message) || "登录失败，请检查邮箱和密码。", 0);
      });
    });

    document.getElementById("adPass").addEventListener("keydown", function (e) {
      if (e.key === "Enter") btn.click();
    });

    /* 初次部署时注册管理员账号。只用一次，之后这个入口就没用了。 */
    document.getElementById("signupLink").addEventListener("click", function (e) {
      e.preventDefault();
      var email = document.getElementById("adEmail").value.trim();
      var pass = document.getElementById("adPass").value;
      if (!email) { notify("loginError", "请先在上面填要注册的邮箱。", 0); return; }
      if (!pass) { notify("loginError", "注册也需要密码：请在密码框里设一个（至少 8 位）。", 0); return; }
      if (DEMO) { notify("loginError", "演示模式不需要注册，直接点登录即可。", 0); return; }

      var link = this;
      link.textContent = "注册中…";
      window.AixiCloud.adminSignUp(email, pass).then(function () {
        link.textContent = "已注册";
        notify("signupOk",
          "已用 " + email + " 注册，验证邮件已发出。请去收信点击链接激活，然后用刚设的密码登录。"
          + "收不到先看垃圾箱；也可以直接在控制台「身份认证 → 用户管理」里新建用户。", 0);
      }).catch(function (err) {
        link.textContent = "用这个邮箱和密码注册";
        notify("loginError", (err && err.message) || "注册失败。可以改用控制台「身份认证 → 用户管理」直接新建用户。", 0);
      });
    });

    logoutBtn.addEventListener("click", function () {
      if (window.AixiCloud) window.AixiCloud.adminLogout();
      location.reload();
    });
  })();

  /* ====================== 改密码 ====================== */
  (function initPassword() {
    var mask = document.getElementById("pwMask");
    var btn = document.getElementById("pwBtn");
    var save = document.getElementById("pwSave");
    var oldEl = document.getElementById("pwOld");
    var newEl = document.getElementById("pwNew");
    var new2El = document.getElementById("pwNew2");

    function close() {
      mask.hidden = true;
      oldEl.value = newEl.value = new2El.value = "";
      show(document.getElementById("pwError"), false);
      show(document.getElementById("pwOk"), false);
    }

    btn.addEventListener("click", function () {
      if (DEMO) { alert("演示模式没有真实账号，改不了密码。"); return; }
      mask.hidden = false;
      oldEl.focus();
    });
    document.getElementById("pwCancel").addEventListener("click", close);
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !mask.hidden) close();
    });

    /* 云开发要求：8 位起，且大写/小写/数字/符号里至少占 3 类。
       在前端先拦一道，是为了让人当场看懂哪儿不合格 ——
       服务端回的是英文的 "Password must include at least 3 character categories"。 */
    function categories(s) {
      var n = 0;
      if (/[a-z]/.test(s)) n++;
      if (/[A-Z]/.test(s)) n++;
      if (/[0-9]/.test(s)) n++;
      if (/[^a-zA-Z0-9]/.test(s)) n++;
      return n;
    }

    save.addEventListener("click", function () {
      var oldPw = oldEl.value, newPw = newEl.value;
      show(document.getElementById("pwOk"), false);

      if (!oldPw || !newPw) { notify("pwError", "请把三个框都填上。", 0); return; }
      if (newPw !== new2El.value) { notify("pwError", "两次输入的新密码不一样。", 0); return; }
      if (newPw.length < 8) { notify("pwError", "新密码太短了，至少 8 位。", 0); return; }
      if (categories(newPw) < 3) {
        notify("pwError", "新密码只用了 " + categories(newPw)
          + " 类字符。大写字母、小写字母、数字、符号里至少要占 3 类。", 0);
        return;
      }
      if (/[^\x20-\x7e]/.test(newPw)) {
        notify("pwError", "新密码里有中文或全角标点，换成半角的英文、数字和符号。", 0);
        return;
      }

      save.disabled = true;
      save.textContent = "保存中…";
      window.AixiCloud.adminChangePassword(oldPw, newPw).then(function () {
        show(document.getElementById("pwError"), false);
        notify("pwOk", "密码已改。下次登录请用新密码。", 0);
        save.textContent = "已保存";
        setTimeout(close, 2200);
        setTimeout(function () { save.disabled = false; save.textContent = "保存"; }, 2400);
      }).catch(function (err) {
        save.disabled = false;
        save.textContent = "保存";
        /* 云开发这条路径回的错误信息很含糊（旧密码错时经常只有一句「改密码失败」），
           所以兜底文案要把最可能的原因说出来，别让人对着一句「失败」干瞪眼。 */
        var m = (err && err.message) || "";
        if (/3 character categories/i.test(m)) {
          m = "新密码至少要占 3 类字符（大写 / 小写 / 数字 / 符号）。";
        } else if (/too short|length/i.test(m)) {
          m = "新密码太短了，至少 8 位。";
        } else {
          m = "改密码没成功，最常见的原因是「当前密码」填错了。"
            + "确认没填错的话，先退出重新登录再试一次。";
        }
        notify("pwError", m, 0);
      });
    });
  })();

  function enterAdmin(who) {
    show(loginBox, false);
    show(mainBox, true);
    show(logoutBtn, true);
    show(document.getElementById("pwBtn"), true);
    whoAmI.textContent = who || "";
    loadList();
    loadConfig();
    loadPosts();
  }

  /* ====================== 标签页 ====================== */
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (x) {
        x.classList.toggle("is-on", x === t);
      });
      Array.prototype.forEach.call(document.querySelectorAll(".panel"), function (p) {
        p.classList.toggle("is-on", p.getAttribute("data-panel") === t.getAttribute("data-tab"));
      });
    });
  });

  /* ====================== 报名名单 ====================== */

  /* 每种表显示哪些列。data.* 是报名者填的字段。 */
  var COLUMNS = {
    recruit: [
      { k: "data.name", t: "姓名" },
      { k: "data.gender", t: "性别" },
      { k: "data.school", t: "学校" },
      { k: "data.college", t: "学院" },
      { k: "data.grade", t: "年级" },
      { k: "data.email", t: "邮箱" },
      { k: "data.phone", t: "手机" },
      { k: "data.wechat", t: "微信" },
      { k: "data.available", t: "可参与" },
      { k: "data.subject", t: "方向" },
      { k: "data.motivation", t: "加入原因", wrap: true },
      { k: "data.experience", t: "相关经历", wrap: true },
      { k: "createdAt", t: "提交时间" }
    ],
    anniversary: [
      { k: "data.name", t: "姓名" },
      { k: "data.joinYear", t: "入队年份" },
      { k: "data.identity", t: "身份" },
      { k: "data.email", t: "邮箱" },
      { k: "data.phone", t: "手机" },
      { k: "data.attend", t: "是否到场" },
      { k: "data.companions", t: "随行" },
      { k: "data.meal", t: "忌口" },
      { k: "data.words", t: "留言", wrap: true },
      { k: "createdAt", t: "提交时间" }
    ],
    reminders: [
      { k: "data.name", t: "称呼" },
      { k: "data.email", t: "邮箱" },
      { k: "formType", t: "来源" },
      { k: "createdAt", t: "提交时间" }
    ]
  };

  /* 状态词表，顺序就是流程的顺序，和报名者在查询页看到的进度条一一对应。
     招新那套要增删环节，得同时改 status.html 里的 STAGES（保持同一套词）。
     周年庆是另一回事：它没有「一面通过」，只关心到不到场。 */
  /* 淘汰分环节记：只有一个笼统的「未通过」的话，就整理不出
     「一面没过的是哪些人」这种名单，而这正是发拒信时要按环节分开发的。
     status.html 的 stageIndex 用 /未通过|落选/ 匹配，所以这些词天然被当成终态，
     不会在报名者那边画出半截进度条。 */
  var STATUS_BY_LIST = {
    recruit: [
      "已收到",
      "初筛通过", "初筛未通过",
      "一面通过", "一面未通过",
      "已交作业", "作业通过", "作业未通过",
      "二面通过", "二面未通过",
      "已录取"
    ],
    anniversary: ["已收到", "已确认到场", "不能到场"],
    reminders: ["已收到"]
  };

  /* 老数据里可能还有笼统的「未通过」。不列进选项的话，
     下拉框会默默显示成第一项，看着像是「已收到」—— 那是在骗人。
     所以渲染时把记录自己的状态并进选项里。 */
  function statusOptions(current) {
    var base = (STATUS_BY_LIST[currentType()] || STATUS_BY_LIST.recruit).slice();
    if (current && base.indexOf(current) < 0) base.push(current);
    return base;
  }

  /* 名单筛选。空 = 全部。 */
  var statusFilter = "";

  var rowsCache = [];
  var sortKey = "createdAt";
  var sortAsc = false;

  function dig(obj, path) {
    return path.split(".").reduce(function (o, k) {
      return (o == null) ? "" : o[k];
    }, obj);
  }

  function currentType() {
    return document.getElementById("listType").value;
  }

  /* 状态筛选条。招新走到后面，「一面通过的是哪些人」「一面没过的是哪些人」
     是天天要看的东西，靠在整张表里翻不现实。
     计数用的是全部已加载的记录，不受搜索词影响 —— 否则一边搜一边看计数会打架。 */
  function renderChips() {
    var box = document.getElementById("statusChips");
    if (!box) return;
    var type = currentType();
    if (type === "reminders") { box.innerHTML = ""; box.style.display = "none"; return; }
    box.style.display = "";

    var count = {};
    rowsCache.forEach(function (r) {
      var s = r.status || "已收到";
      count[s] = (count[s] || 0) + 1;
    });
    // 先按预设顺序排，数据里出现的其他状态（比如老的「未通过」）补在后面
    var order = STATUS_BY_LIST[type] || [];
    var extra = Object.keys(count).filter(function (s) { return order.indexOf(s) < 0; });
    var all = order.concat(extra);

    var html = '<button class="chip' + (statusFilter ? "" : " is-on")
      + '" data-status="">全部 <b>' + rowsCache.length + "</b></button>";
    html += all.map(function (s) {
      var n = count[s] || 0;
      // 一个人都没有的状态不占地方，但当前选中的那个要一直留着，否则点完就消失了
      if (!n && statusFilter !== s) return "";
      return '<button class="chip' + (statusFilter === s ? " is-on" : "")
        + (/未通过|落选/.test(s) ? " is-out" : "")
        + '" data-status="' + esc(s) + '">' + esc(s) + " <b>" + n + "</b></button>";
    }).join("");
    box.innerHTML = html;

    Array.prototype.forEach.call(box.querySelectorAll("[data-status]"), function (b) {
      b.addEventListener("click", function () {
        statusFilter = b.getAttribute("data-status");
        renderTable();
      });
    });
  }

  /** 当前屏幕上这一份名单（搜索 + 状态筛选之后的），导出用的也是它 */
  function visibleRows() {
    var q = document.getElementById("listSearch").value.trim().toLowerCase();
    return rowsCache.filter(function (r) {
      if (statusFilter && (r.status || "已收到") !== statusFilter) return false;
      if (!q) return true;
      return JSON.stringify(r.data || {}).toLowerCase().indexOf(q) >= 0
        || String(r.email || "").toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderTable() {
    var type = currentType();
    var cols = COLUMNS[type];
    var q = document.getElementById("listSearch").value.trim().toLowerCase();

    renderChips();
    var rows = visibleRows();

    rows.sort(function (a, b) {
      var va = String(dig(a, sortKey) || ""), vb = String(dig(b, sortKey) || "");
      return sortAsc ? va.localeCompare(vb, "zh") : vb.localeCompare(va, "zh");
    });

    var thead = '<tr>'
      + (type === "reminders" ? "" : '<th style="width:34px;cursor:default;"><input type="checkbox" id="chkAll" title="全选本页"></th>')
      + cols.map(function (c) {
        return '<th data-sort="' + c.k + '"' + (sortKey === c.k ? ' class="sorted"' : "") + ">"
          + esc(c.t) + "</th>";
      }).join("")
      + (type === "reminders" ? "" : "<th>简历</th><th>批注</th><th>状态</th>")
      + "</tr>";

    var tbody = rows.length
      ? rows.map(function (r) {
        return "<tr>"
          + (type === "reminders" ? ""
            : '<td><input type="checkbox" class="row-chk" value="' + esc(r._id || r.id) + '"></td>')
          + cols.map(function (c) {
            var v = dig(r, c.k);
            if (c.k === "createdAt") v = String(v || "").replace("T", " ").slice(0, 16);
            // 姓名做成入口：点开就是简历 + 批注那一屏，不用再去找别的按钮
            if (c.k === "data.name" && type !== "reminders") {
              return '<td><button class="link-cell" data-open="' + esc(r._id || r.id) + '">'
                + (esc(v) || "（未填姓名）") + "</button></td>";
            }
            return '<td' + (c.wrap ? ' class="wrap"' : "") + ">" + esc(v) + "</td>";
          }).join("")
          + (type === "reminders" ? ""
            : '<td>' + (r.hasResume
              ? '<button class="btn btn-ghost btn-sm" data-resume="' + esc(r.resumeFileId)
              + '" style="color:var(--ink);">下载</button>'
              : '<span style="color:var(--muted-2);">—</span>') + "</td>"
            + '<td><button class="note-count' + (r.noteCount ? "" : " is-zero")
            + '" data-open="' + esc(r._id || r.id)
            + '" style="border:none;cursor:pointer;" title="查看简历与批注">'
            + (r.noteCount || 0) + "</button></td>"
            + '<td><select class="select" data-status-for="' + esc(r._id || r.id)
            + '" style="min-width:120px;padding:6px 8px;font-size:.84rem;">'
            + statusOptions(r.status).map(function (s) {
              return '<option' + (s === r.status ? " selected" : "") + ">" + esc(s) + "</option>";
            }).join("")
            + "</select></td>")
          + "</tr>";
      }).join("")
      : '<tr><td colspan="' + (cols.length + 4)
      + '" style="text-align:center;padding:40px;color:var(--muted);">还没有数据</td></tr>';

    var table = document.getElementById("dataTable");
    table.querySelector("thead").innerHTML = thead;
    table.querySelector("tbody").innerHTML = tbody;

    document.getElementById("listCount").textContent =
      "共 " + rowsCache.length + " 条"
      + ((statusFilter || q) ? "，当前名单 " + rows.length + " 人" : "");

    // 导出按钮上直接写清楚会导出哪一份，避免以为导的是全部
    var exp = document.getElementById("exportBtn");
    if (exp) {
      exp.textContent = (statusFilter || q)
        ? "导出这份名单（" + rows.length + " 人）"
        : "导出 CSV（全部 " + rows.length + " 人）";
    }

    // 排序
    Array.prototype.forEach.call(table.querySelectorAll("th[data-sort]"), function (th) {
      th.addEventListener("click", function () {
        var k = th.getAttribute("data-sort");
        if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = true; }
        renderTable();
      });
    });

    // 勾选与批量
    var chkAll = table.querySelector("#chkAll");
    function rowChks() { return table.querySelectorAll(".row-chk"); }
    function checkedIds() {
      return Array.prototype.filter.call(rowChks(), function (c) { return c.checked; })
        .map(function (c) { return c.value; });
    }
    function refreshBulk() {
      var n = checkedIds().length;
      var bar = document.getElementById("bulkBar");
      bar.style.display = n ? "" : "none";
      document.getElementById("bulkCount").textContent = "已选 " + n + " 人";
    }
    if (chkAll) {
      chkAll.addEventListener("change", function () {
        Array.prototype.forEach.call(rowChks(), function (c) { c.checked = chkAll.checked; });
        refreshBulk();
      });
    }
    Array.prototype.forEach.call(rowChks(), function (c) {
      c.addEventListener("change", refreshBulk);
    });
    refreshBulk();

    // 改状态
    Array.prototype.forEach.call(table.querySelectorAll("[data-status-for]"), function (sel) {
      sel.addEventListener("change", function () {
        var id = sel.getAttribute("data-status-for");
        sel.disabled = true;
        window.AixiApi.admin("admin.setStatus", {
          id: id, status: sel.value, formType: currentType()
        }).then(function () {
          sel.disabled = false;
          var hit = rowsCache.filter(function (r) { return (r._id || r.id) === id; })[0];
          if (hit) hit.status = sel.value;
          // 本地缓存同步一下就够了，不整表重拉，免得把用户的滚动位置和勾选清掉
        }).catch(function (err) {
          sel.disabled = false;
          alert("改状态失败：" + ((err && err.message) || ""));
        });
      });
    });

    // 打开详情（姓名与批注数都是入口）
    Array.prototype.forEach.call(table.querySelectorAll("[data-open]"), function (btn) {
      btn.addEventListener("click", function () {
        openDetail(btn.getAttribute("data-open"));
      });
    });

    // 下载简历：临时链接由云函数用管理端权限换取，有效期 10 分钟
    Array.prototype.forEach.call(table.querySelectorAll("[data-resume]"), function (btn) {
      btn.addEventListener("click", function () {
        var fid = btn.getAttribute("data-resume");
        btn.disabled = true;
        btn.textContent = "取链接…";
        window.AixiApi.admin("admin.resumeUrl", { fileId: fid }).then(function (r) {
          btn.disabled = false;
          btn.textContent = "下载";
          window.open(r.url, "_blank", "noopener");
        }).catch(function (err) {
          btn.disabled = false;
          btn.textContent = "下载";
          alert("换取下载链接失败：" + ((err && err.message) || ""));
        });
      });
    });
  }

  /* ====================== 详情抽屉：简历 + 共享批注 ======================
     领队看简历时要能当场留话，所以简历和批注放在同一屏：
     左边是简历原件，右边是报名字段和所有人的批注。
     批注存在云端、对全体领队可见，署名由服务端按登录 uid 记录，前端改不了。 */

  var dwCur = null;         // 当前打开的那条记录
  var dwAnchor = "";        // 这次要针对哪个字段留言，空 = 整体批注
  var dwMe = null;          // { uid, name, named }，第一次打开时取一次

  /* 值得批注的字段。事实性的信息（姓名、学校、学院、年级、联系方式）不在其列。
     留着 motivation / experience 这些是为了将来把「关于支教」几题加回表单时
     不用再改这儿。简历的批注入口在左边简历栏上，不在这个列表里。 */
  var ANCHORABLE = ["motivation", "experience", "subject", "available", "words"];

  function fmtTime(s) { return String(s || "").replace("T", " ").slice(0, 16); }

  function dwEl(id) { return document.getElementById(id); }

  function openDetail(id) {
    var row = rowsCache.filter(function (r) { return (r._id || r.id) === id; })[0];
    if (!row) return;
    dwCur = row;
    dwAnchor = "";

    var d = row.data || {};
    dwEl("dwName").textContent = d.name || "（未填姓名）";
    dwEl("dwMeta").textContent = [
      d.school || "", d.grade || "", row.status || "", "提交于 " + fmtTime(row.createdAt)
    ].filter(Boolean).join(" · ");

    /* 报名字段。
       只有「需要判断」的内容才挂批注按钮 —— 姓名、学院、手机这些是事实，
       不存在什么看法，每行都挂一个只是噪音。真正会被评价的是简历、
       自述这类东西，所以按钮只出现在它们旁边（简历的按钮在左边那一栏）。 */
    var cols = COLUMNS[currentType()] || COLUMNS.recruit;
    dwEl("dwFields").innerHTML = cols.map(function (c) {
      var v = dig(row, c.k);
      if (c.k === "createdAt") v = fmtTime(v);
      if (!v) return "";
      var key = c.k.replace(/^data\./, "");
      return '<div class="dw-field"><div class="k">' + esc(c.t) + "</div>"
        + '<div class="v">' + esc(v) + "</div>"
        + (ANCHORABLE.indexOf(key) >= 0
          ? '<button class="an" type="button" data-anchor="' + esc(c.t) + '">批注</button>' : "")
        + "</div>";
    }).join("") || '<p style="color:var(--muted);font-size:.88rem;">这条记录没有可显示的字段。</p>';

    Array.prototype.forEach.call(dwEl("dwFields").querySelectorAll("[data-anchor]"), function (b) {
      b.addEventListener("click", function () { setAnchor(b.getAttribute("data-anchor")); });
    });

    setAnchor("");
    dwEl("dwNoteText").value = "";
    dwEl("dwNoteHint").textContent = "";
    dwEl("dwNoteList").innerHTML = '<p style="color:var(--muted);font-size:.86rem;">读取批注…</p>';
    dwEl("dwMask").hidden = false;
    document.body.style.overflow = "hidden";

    seenNoteIds = null;   // 换人了，重新认一遍，不然会把别人的旧批注当成新的
    setLive("");
    renderResume(row);
    ensureMe().then(function () { return loadNotes(); }).then(startPoll);
  }

  function closeDetail() {
    dwEl("dwMask").hidden = true;
    document.body.style.overflow = "";
    dwEl("dwResume").innerHTML = "";   // 停掉 iframe，别让临时链接一直挂着
    dropBlobUrls();
    stopPoll();
    dwCur = null;
  }

  function setAnchor(name) {
    dwAnchor = name || "";
    var bar = dwEl("dwAnchorBar");
    if (dwAnchor) {
      dwEl("dwAnchorName").textContent = dwAnchor;
      bar.style.display = "";
      dwEl("dwNoteText").focus();
    } else {
      bar.style.display = "none";
    }
  }

  /* 预览用的 blob 链接。用完必须 revoke，否则每开一个人就往内存里留一份文件，
     一下午看几十份简历会把浏览器拖垮。 */
  var dwBlobUrls = [];
  function dropBlobUrls() {
    dwBlobUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    dwBlobUrls = [];
  }
  function keepBlob(blob) {
    var u = URL.createObjectURL(blob);
    dwBlobUrls.push(u);
    return u;
  }

  /* Word 解析器按需加载：642KB，只有真的打开一份 .docx 时才值得下这个包。
     放在本地 vendor 里而不是走 CDN —— 简历内容不该经过第三方，
     况且 CDN 挂掉时后台不该跟着废掉。 */
  var mammothLoading = null;
  function loadMammoth() {
    if (window.mammoth) return Promise.resolve(window.mammoth);
    if (mammothLoading) return mammothLoading;
    mammothLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "js/vendor/mammoth.browser.min.js";
      s.onload = function () {
        window.mammoth ? resolve(window.mammoth) : reject(new Error("解析器加载了但没生效"));
      };
      s.onerror = function () { reject(new Error("Word 解析器加载失败")); };
      document.head.appendChild(s);
    });
    return mammothLoading;
  }

  /** 简历预览。
      注意：云存储的临时链接带 Content-Disposition: attachment，
      直接塞进 iframe 会触发下载而不是显示。所以先 fetch 成 blob 再本地生成链接 ——
      blob 链接没有这个响应头，PDF 才会真的渲染出来。
      （云存储的 CORS 是允许本站域名的，已实测。） */
  function renderResume(row) {
    var box = dwEl("dwResume");
    var hint = dwEl("dwResumeHint");
    var openBtn = dwEl("dwResumeOpen");
    dropBlobUrls();
    openBtn.style.display = "none";
    openBtn.onclick = null;

    if (!row.hasResume || !row.resumeFileId) {
      hint.textContent = "简历";
      box.innerHTML = '<div class="dw-empty">这位报名者没有上传简历附件。<br>'
        + "报名通道开着的时候，他可以在「查询进度」页面自己补传。</div>";
      return;
    }

    var ext = (String(row.resumeFileId).split("?")[0].split(".").pop() || "").toLowerCase();
    hint.textContent = "简历 · 取链接中…";
    box.innerHTML = '<div class="dw-empty">正在取简历…</div>';

    var reqId = row._id || row.id;
    function stale() { return !dwCur || (dwCur._id || dwCur.id) !== reqId; }

    window.AixiApi.admin("admin.resumeUrl", { fileId: row.resumeFileId }).then(function (r) {
      if (stale()) return;
      var url = r.url;
      openBtn.style.display = "";
      openBtn.textContent = "下载原件";
      openBtn.onclick = function () { window.open(url, "_blank", "noopener"); };

      // .doc 是老的二进制格式，没有任何纯前端解析器能可靠打开，只能下载
      if (ext === "doc") {
        hint.textContent = "简历 · .doc";
        box.innerHTML = '<div class="dw-empty">.doc 是旧版 Word 的二进制格式，'
          + "没法在网页里预览。<br>点右上角「下载原件」用 Word / WPS 打开。<br><br>"
          + '<span style="font-size:.84rem;">（报名页已经建议大家优先交 PDF 或 .docx）</span></div>';
        return;
      }

      hint.textContent = "简历 · 载入中…";
      return fetch(url).then(function (res) {
        if (!res.ok) throw new Error("下载简历失败（HTTP " + res.status + "）");
        return res.blob();
      }).then(function (blob) {
        if (stale()) return;
        hint.textContent = "简历 · 链接 10 分钟内有效";

        if (ext === "pdf") {
          box.innerHTML = '<iframe title="简历预览"></iframe>';
          box.querySelector("iframe").src = keepBlob(blob);
          return;
        }
        if (["jpg", "jpeg", "png", "gif", "webp"].indexOf(ext) >= 0) {
          box.innerHTML = '<div style="padding:16px;overflow:auto;width:100%;">'
            + '<img alt="简历" src="' + esc(keepBlob(blob)) + '"></div>';
          return;
        }
        if (ext === "docx") {
          box.innerHTML = '<div class="dw-empty">正在解析 Word 文档…</div>';
          return loadMammoth().then(function (mammoth) {
            return blob.arrayBuffer().then(function (buf) {
              return mammoth.convertToHtml({ arrayBuffer: buf });
            });
          }).then(function (out) {
            if (stale()) return;
            renderDocx(box, out);
          });
        }
        box.innerHTML = '<div class="dw-empty">这个格式（.' + esc(ext)
          + "）没法在网页里预览。<br>点右上角「下载原件」查看。</div>";
      });
    }).catch(function (err) {
      if (stale()) return;
      hint.textContent = "简历";
      box.innerHTML = '<div class="dw-empty">简历打不开：' + esc((err && err.message) || "")
        + '<br><br><span style="font-size:.84rem;">可以点右上角「下载原件」，'
        + "下载走的是另一条路，通常还能用。</span></div>";
    });
  }

  /** 把 Word 转出来的 HTML 放进一个完全沙箱化的 iframe。
      这段 HTML 来自报名者上传的文件，等于是外人写的内容 ——
      直接 innerHTML 进后台页面，就是把 XSS 的口子开在了存着所有人手机号、
      而且带着管理员登录态的那一页上。sandbox="" 禁掉脚本、也禁掉同源，
      里面无论有什么都出不来。 */
  function renderDocx(box, out) {
    var css = "body{font:14px/1.9 -apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;"
      + "color:#22243c;padding:26px 30px;margin:0;}"
      + "img{max-width:100%;height:auto;}p{margin:0 0 .8em;}"
      + "table{border-collapse:collapse;max-width:100%;}td,th{border:1px solid #ddd;padding:5px 8px;}";
    var html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
      + "<style>" + css + "</style></head><body>"
      + (out.value || "<p>（这份文档里没有可显示的文字）</p>")
      + "</body></html>";

    box.innerHTML = '<iframe title="简历预览" sandbox=""></iframe>';
    box.querySelector("iframe").setAttribute("srcdoc", html);

    /* mammoth 会把不认识的样式列成 messages。多数无关紧要，
       但「一个字都没转出来」是要说清楚的，否则领队会以为简历是空的。 */
    if (!out.value) {
      var tip = document.createElement("div");
      tip.style.cssText = "padding:10px 14px;font-size:.82rem;color:var(--muted);border-top:1px solid var(--line);";
      tip.textContent = "这份 Word 里没解析出文字，可能内容是图片或文本框。请点「下载原件」查看。";
      box.appendChild(tip);
    }
  }

  /* 署名。批注必须记名字，而云开发只给得到 uid，所以要本人填一次。 */
  function ensureMe() {
    if (dwMe) return Promise.resolve(dwMe);
    return window.AixiApi.admin("admin.whoami", {}).then(function (r) {
      dwMe = r;
      dwEl("dwNameSetup").style.display = r.named ? "none" : "";
      return r;
    }).catch(function () {
      dwMe = { uid: "", name: "领队", named: true };
      return dwMe;
    });
  }

  /* ---- 实时批注 ----
     几个领队同时看同一个人时，要能看见对方刚写的话，否则会重复讨论。
     云开发的数据库实时推送用不了：notes 集合是「仅管理端可读写」，
     网页端根本没有读权限 —— 为了实时去放开权限，等于把所有批注公开，
     这个交换不划算。所以用轮询，但把频率压到能承受的程度：

       · 12 秒一次，且只在抽屉开着的时候
       · 标签页切走就暂停（挂着后台标签页不该一直烧额度）
       · 有人正在改自己的批注时跳过这一轮，免得把编辑框刷没了
       · 抽屉开着 10 分钟没人动，就停下并显示「点此继续」

     账要算清楚：一次轮询约 2 次数据库读，免费额度是每月约 15 万次读。
     一个人开着抽屉看 10 分钟 ≈ 50 次读。十个领队各看 20 份简历 ≈ 1 万次读，
     占免费额度的 7% 左右，招新那两周是扛得住的。
     如果哪年人特别多，把 POLL_MS 调大即可，改一个数就行。 */
  var POLL_MS = 12000;
  var POLL_IDLE_STOP_MS = 10 * 60 * 1000;
  var pollTimer = null;
  var pollActiveAt = 0;
  var seenNoteIds = null;

  function touchPoll() { pollActiveAt = Date.now(); }

  function stopPoll() {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  }

  function startPoll() {
    stopPoll();
    touchPoll();
    pollTimer = setTimeout(pollTick, POLL_MS);
  }

  function pollTick() {
    pollTimer = null;
    if (!dwCur) return;

    if (Date.now() - pollActiveAt > POLL_IDLE_STOP_MS) {
      setLive('自动刷新已暂停 <button type="button" id="dwLiveResume">继续</button>', false, true);
      return;
    }
    // 标签页在后台、或者有人正在编辑批注，这一轮跳过（跳过不花钱）
    if (document.hidden || dwEl("dwNoteList").querySelector("textarea")) {
      pollTimer = setTimeout(pollTick, POLL_MS);
      return;
    }
    loadNotes({ silent: true }).then(function () {
      if (dwCur) pollTimer = setTimeout(pollTick, POLL_MS);
    });
  }

  function setLive(html, isNew, raw) {
    var el = dwEl("dwLive");
    if (!el) return;
    el.innerHTML = html;
    el.className = "live" + (isNew ? " is-new" : "");
    if (raw) {
      var b = el.querySelector("#dwLiveResume");
      if (b) b.addEventListener("click", function () { startPoll(); loadNotes(); });
    }
  }

  function loadNotes(opts) {
    if (!dwCur) return Promise.resolve();
    var silent = !!(opts && opts.silent);
    var id = dwCur._id || dwCur.id;
    return window.AixiApi.admin("admin.listNotes", { recordId: id }).then(function (r) {
      if (!dwCur || (dwCur._id || dwCur.id) !== id) return;   // 期间换人了就别覆盖

      /* 认出这一轮新冒出来的批注，给它们加一下高亮。
         不比对的话，别人写了新东西你完全看不出来 —— 列表默默变长而已。 */
      var rows = r.rows || [];
      var ids = rows.map(function (n) { return n.id; });
      var fresh = seenNoteIds
        ? ids.filter(function (x) { return seenNoteIds.indexOf(x) < 0; })
        : [];
      seenNoteIds = ids;

      var hhmm = new Date().toTimeString().slice(0, 8);
      if (fresh.length && silent) {
        setLive("刚刚新增 " + fresh.length + " 条 · " + hhmm, true);
      } else {
        setLive("自动刷新中 · 最后更新 " + hhmm, false);
      }

      renderNotes(rows, fresh);
      // 列表上的角标同步一下，免得写完批注回到列表还显示 0
      dwCur.noteCount = (r.rows || []).length;
      var badge = document.querySelector('.note-count[data-open="' + id + '"]');
      if (badge) {
        badge.textContent = dwCur.noteCount;
        badge.className = "note-count" + (dwCur.noteCount ? "" : " is-zero");
      }
      dwEl("dwNoteCount").textContent = dwCur.noteCount;
      dwEl("dwNoteCount").className = "note-count" + (dwCur.noteCount ? "" : " is-zero");
    }).catch(function (err) {
      var msg = (err && err.message) || "";
      /* 自动刷新失败（多半是网络抖一下）不要把已经看到的批注清掉换成报错 ——
         那会让人以为批注没了。只在标题旁边小声说一句。 */
      if (silent) { setLive("刷新失败，稍后重试 · " + esc(msg).slice(0, 20), false); return; }
      dwEl("dwNoteList").innerHTML = '<p style="color:var(--err);font-size:.86rem;">读取批注失败：'
        + esc(msg) + "</p>";
    });
  }

  function renderNotes(rows, fresh) {
    var box = dwEl("dwNoteList");
    if (!rows.length) {
      box.innerHTML = '<p style="color:var(--muted-2);font-size:.86rem;">还没有人批注。</p>';
      return;
    }
    fresh = fresh || [];
    box.innerHTML = rows.map(function (n) {
      return '<div class="note' + (n.mine ? " is-mine" : "")
        + (fresh.indexOf(n.id) >= 0 ? " is-new" : "") + '" data-note="' + esc(n.id) + '">'
        + '<div class="hd"><span class="au">' + esc(n.author) + "</span>"
        + "<span>" + esc(fmtTime(n.createdAt)) + (n.updatedAt ? "（改过）" : "") + "</span>"
        + '<span class="sp"></span>'
        + (n.mine ? '<button type="button" data-edit="' + esc(n.id) + '">编辑</button>'
          + '<button type="button" data-del="' + esc(n.id) + '">删除</button>' : "")
        + "</div>"
        + (n.anchor ? '<div class="an-tag">' + esc(n.anchor) + "</div>" : "")
        + '<div class="bd">' + esc(n.text) + "</div></div>";
    }).join("");

    Array.prototype.forEach.call(box.querySelectorAll("[data-del]"), function (b) {
      b.addEventListener("click", function () {
        if (!window.confirm("删除这条批注？其他领队也会看不到。")) return;
        b.disabled = true;
        window.AixiApi.admin("admin.deleteNote", { id: b.getAttribute("data-del") })
          .then(loadNotes)
          .catch(function (e) { b.disabled = false; alert("删除失败：" + ((e && e.message) || "")); });
      });
    });

    Array.prototype.forEach.call(box.querySelectorAll("[data-edit]"), function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-edit");
        var card = box.querySelector('[data-note="' + id + '"]');
        var body = card.querySelector(".bd");
        if (card.querySelector("textarea")) return;
        var old = rows.filter(function (n) { return n.id === id; })[0];
        var ta = document.createElement("textarea");
        ta.className = "input";
        ta.rows = 3;
        ta.maxLength = 1000;
        ta.value = (old && old.text) || body.textContent;
        var bar = document.createElement("div");
        bar.style.cssText = "display:flex;gap:8px;margin-top:8px;";
        bar.innerHTML = '<button class="btn btn-ink btn-sm" type="button">保存</button>'
          + '<button class="btn btn-ghost btn-sm" type="button">取消</button>';
        body.replaceWith(ta);
        ta.after(bar);
        ta.focus();
        bar.children[1].addEventListener("click", loadNotes);
        bar.children[0].addEventListener("click", function () {
          var t = ta.value.trim();
          if (!t) { alert("批注不能为空。要去掉请用删除。"); return; }
          bar.children[0].disabled = true;
          window.AixiApi.admin("admin.updateNote", { id: id, text: t })
            .then(loadNotes)
            .catch(function (e) {
              bar.children[0].disabled = false;
              alert("保存失败：" + ((e && e.message) || ""));
            });
        });
      });
    });
  }

  (function initDetail() {
    var mask = dwEl("dwMask");
    if (!mask) return;

    dwEl("dwClose").addEventListener("click", closeDetail);
    mask.addEventListener("click", function (e) { if (e.target === mask) closeDetail(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !mask.hidden) closeDetail();
    });
    dwEl("dwAnchorClear").addEventListener("click", function () { setAnchor(""); });
    dwEl("dwAnchorResume").addEventListener("click", function () { setAnchor("简历"); });

    /* 只要人在这个抽屉里有动作，就算「还在看」，自动刷新继续跑。
       十分钟一动不动才停 —— 停的是空转，不是有人在用的时候。 */
    ["click", "keydown", "input"].forEach(function (ev) {
      mask.addEventListener(ev, function () {
        touchPoll();
        if (!pollTimer && dwCur) startPoll();
      }, true);
    });
    // 标签页切回来，立刻补一次，不用干等 12 秒
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && dwCur && pollTimer) { touchPoll(); loadNotes({ silent: true }); }
    });

    dwEl("dwNameSave").addEventListener("click", function () {
      var name = dwEl("dwNameInput").value.trim();
      if (!name) { alert("请填写姓名或称呼。"); return; }
      var b = this;
      b.disabled = true;
      window.AixiApi.admin("admin.setMyName", { name: name }).then(function (r) {
        dwMe = { uid: r.uid, name: r.name, named: true };
        dwEl("dwNameSetup").style.display = "none";
        b.disabled = false;
        loadNotes();
      }).catch(function (e) {
        b.disabled = false;
        alert("保存署名失败：" + ((e && e.message) || ""));
      });
    });

    dwEl("dwNoteSave").addEventListener("click", function () {
      if (!dwCur) return;
      var text = dwEl("dwNoteText").value.trim();
      if (!text) { dwEl("dwNoteHint").textContent = "批注内容不能为空。"; return; }
      if (dwMe && !dwMe.named) {
        dwEl("dwNoteHint").textContent = "请先在上面填一次署名。";
        dwEl("dwNameInput").focus();
        return;
      }
      var b = this;
      b.disabled = true;
      dwEl("dwNoteHint").textContent = "发表中…";
      window.AixiApi.admin("admin.addNote", {
        recordId: dwCur._id || dwCur.id,
        formType: currentType(),
        anchor: dwAnchor,
        text: text
      }).then(function () {
        b.disabled = false;
        dwEl("dwNoteText").value = "";
        setAnchor("");
        dwEl("dwNoteHint").textContent = "已发表，其他领队现在能看到。";
        loadNotes();
      }).catch(function (e) {
        b.disabled = false;
        dwEl("dwNoteHint").textContent = "发表失败：" + ((e && e.message) || "");
      });
    });
  })();

  function loadList() {
    var hint = document.getElementById("listHint");
    hint.textContent = "读取中…";
    window.AixiApi.admin("admin.list", { formType: currentType(), limit: 200 })
      .then(function (r) {
        rowsCache = r.rows || [];
        var t = new Date();
        var hhmm = ("0" + t.getHours()).slice(-2) + ":" + ("0" + t.getMinutes()).slice(-2);
        hint.textContent = (DEMO
          ? "演示模式：这些数据只存在本机浏览器里。"
          : "只显示最近 200 条。需要全部数据请用导出，或用 scripts/export_applicants.py。")
          + "　本页数据读取于 " + hhmm + "，是一份快照 —— 若你在控制台或别处改过数据，请点「刷新」。";
        renderTable();
      })
      .catch(function (err) {
        rowsCache = [];
        renderTable();
        hint.textContent = "读取失败：" + ((err && err.message) || "");
      });
  }

  /* 批量改状态。面试完一次要改几十个人，一个个点下拉不现实。
     逐条调用云函数而不是批量接口：条数不多（一次最多一屏），
     而且逐条能准确报出哪一条失败。 */
  (function initBulk() {
    var sel = document.getElementById("bulkStatus");
    /* 批量下拉的选项跟着当前表变，切表时重填 */
    function fillBulkStatus() {
      sel.innerHTML = statusOptions().map(function (s) {
        return "<option>" + esc(s) + "</option>";
      }).join("");
    }
    fillBulkStatus();
    document.getElementById("listType").addEventListener("change", fillBulkStatus);

    document.getElementById("bulkClear").addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".row-chk"), function (c) { c.checked = false; });
      var all = document.getElementById("chkAll");
      if (all) all.checked = false;
      document.getElementById("bulkBar").style.display = "none";
    });

    /* 删除是不可逆的，而且会连简历文件一起删。
       所以要求打字确认，光点一下「确定」太容易手滑 —— 尤其在勾了全选之后。 */
    document.getElementById("bulkDelete").addEventListener("click", function () {
      var btn = this;
      var ids = Array.prototype.filter.call(document.querySelectorAll(".row-chk"),
        function (c) { return c.checked; }).map(function (c) { return c.value; });
      if (!ids.length) return;

      var word = prompt(
        "将删除 " + ids.length + " 条报名记录，连同它们的简历附件，无法撤回。\n"
        + "确认请输入 DELETE：");
      if (word !== "DELETE") {
        if (word !== null) alert("输入不匹配，已取消。");
        return;
      }

      btn.disabled = true;
      btn.textContent = "删除中…";
      window.AixiApi.admin("admin.deleteRecords", {
        ids: ids, formType: currentType()
      }).then(function (r) {
        btn.disabled = false;
        btn.textContent = "删除所选";
        var msg = "已删除 " + r.deleted + " 条记录";
        if (r.files) msg += "，同时删除 " + r.files + " 个简历文件";
        if (r.failures && r.failures.length) {
          msg += "。有 " + r.failures.length + " 条出问题：\n"
            + r.failures.map(function (f) { return f.error; }).join("\n");
        }
        alert(msg);
        loadList();          // 删完立刻重新拉，避免界面还显示已删的记录
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = "删除所选";
        alert("删除失败：" + ((e && e.message) || ""));
      });
    });

    document.getElementById("bulkApply").addEventListener("click", function () {
      var btn = this;
      var ids = Array.prototype.filter.call(document.querySelectorAll(".row-chk"),
        function (c) { return c.checked; }).map(function (c) { return c.value; });
      if (!ids.length) return;
      var status = sel.value;
      if (!confirm("把选中的 " + ids.length + " 人状态改为「" + status + "」？")) return;

      btn.disabled = true;
      var done = 0, failed = [];
      var next = function () {
        if (!ids.length) {
          btn.disabled = false;
          btn.textContent = "应用";
          if (failed.length) {
            alert("改了 " + done + " 人，失败 " + failed.length + " 人。");
          }
          loadList();
          return;
        }
        var id = ids.shift();
        btn.textContent = "处理中 " + (done + failed.length + 1);
        window.AixiApi.admin("admin.setStatus", {
          id: id, status: status, formType: currentType()
        }).then(function () { done++; }).catch(function () { failed.push(id); }).then(next);
      };
      next();
    });
  })();

  document.getElementById("listType").addEventListener("change", function () {
    /* 切表时清掉状态筛选：招新的「一面通过」在周年庆那张表里根本不存在，
       不清的话切过去就是一份空名单，看着像数据丢了。 */
    statusFilter = "";
    loadList();
  });
  document.getElementById("reloadBtn").addEventListener("click", loadList);
  document.getElementById("listSearch").addEventListener("input", renderTable);

  /* ---- 导出 CSV ----
     加 UTF-8 BOM，否则 Excel 打开中文会乱码。 */
  /* 导出的是【当前屏幕上这份名单】，不是整张表。
     筛成「一面通过」再导出，拿到的就是一面通过名单 —— 这是最常用的一步：
     导出来直接就能拿去排面试场次、或者贴进群公告。 */
  /* ---- 上传简历模板 ----
     传完直接写进配置，不要求再点一次「保存设置」。
     「传完了但忘了保存」这种坑谁都会踩一次，而踩了之后现象是
     「我明明传了怎么报名页没有」，很难自己想明白。 */
  (function initTemplateUpload() {
    var btn = document.getElementById("cfgTplUpload");
    var fileEl = document.getElementById("cfgTplFile");
    var state = document.getElementById("cfgTplState");
    if (!btn || !fileEl) return;

    btn.addEventListener("click", function () {
      var f = fileEl.files && fileEl.files[0];
      if (!f) { alert("先选一个文件。"); return; }
      if (f.size > 20 * 1024 * 1024) { alert("模板文件超过 20MB，请压缩后再传。"); return; }
      if (DEMO) { alert("演示模式不会真的上传文件。"); return; }
      if (!window.AixiCloud) { alert("缺少 js/cloud.js，无法上传。"); return; }

      btn.disabled = true;
      state.textContent = "上传中…";
      window.AixiCloud.uploadTemplate(f, function (pct) {
        state.textContent = "上传中… " + pct + "%";
      }).then(function (fileId) {
        // 存 fileID；下载链接由云函数每次临时换取，存储桶不用对外公开
        return window.AixiApi.admin("admin.setConfig", {
          form_file_id: fileId,
          form_file_name: f.name.slice(0, 60),
          form_url: ""            // 传了文件就以文件为准，清掉手填的链接
        });
      }).then(function () {
        btn.disabled = false;
        state.textContent = "当前模板：" + f.name;
        var urlInput = document.getElementById("cfgFormUrl");
        if (urlInput) urlInput.value = "";
        notify("cfgSaved", "模板已上传，报名页的「上传简历」那一栏现在会出现下载按钮。", 5000);
      }).catch(function (e) {
        btn.disabled = false;
        state.textContent = "上传失败：" + ((e && e.message) || "");
      });
    });
  })();

  document.getElementById("exportBtn").addEventListener("click", function () {
    var type = currentType();
    var cols = COLUMNS[type].concat(type === "reminders" ? []
      : [{ k: "status", t: "状态" }, { k: "noteCount", t: "批注条数" }]);
    var rows = visibleRows();

    if (!rows.length) { alert("这份名单是空的，没有可导出的内容。"); return; }

    function cell(v) {
      var s = String(v == null ? "" : v);
      return '"' + s.replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
    }

    var lines = [cols.map(function (c) { return cell(c.t); }).join(",")];
    rows.forEach(function (r) {
      lines.push(cols.map(function (c) {
        var v = dig(r, c.k);
        if (c.k === "createdAt") v = String(v || "").replace("T", " ").slice(0, 16);
        return cell(v);
      }).join(","));
    });

    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    // 文件名带上筛选条件：一次导好几份放在下载文件夹里，光看名字就能分清
    var TYPE_CN = { recruit: "招新", anniversary: "周年庆", reminders: "预约提醒" };
    a.download = "爱西名单_" + (TYPE_CN[type] || type)
      + (statusFilter ? "_" + statusFilter : "")
      + "_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  /* ---- 导出归档包 ----
     里面除了全部字段，还带上每份简历的临时下载链接（10 分钟有效）。
     这样 scripts/export_applicants.py 完全不需要腾讯云 API 密钥就能把简历拉到本地 ——
     学生手里不该拿着云账号的密钥，这是刻意的设计。
     代价是链接会过期，所以导出后请尽快跑脚本。 */
  document.getElementById("archiveBtn").addEventListener("click", function () {
    var btn = this;
    var type = currentType();
    btn.disabled = true;
    btn.textContent = "导出中…";

    window.AixiApi.admin("admin.export", { formType: type }).then(function (r) {
      var rows = r.rows || [];
      var withResume = rows.filter(function (x) { return x.resumeFileId; });

      // 逐个换临时链接。串行是有意的：一次性并发几百个请求容易被限流。
      var i = 0;
      function next() {
        if (i >= withResume.length) return Promise.resolve();
        var row = withResume[i++];
        btn.textContent = "取简历链接 " + i + "/" + withResume.length;
        return window.AixiApi.admin("admin.resumeUrl", { fileId: row.resumeFileId })
          .then(function (u) { row.resumeUrl = u.url; })
          .catch(function (e) { row.resumeUrlError = (e && e.message) || "取链接失败"; })
          .then(next);
      }

      return next().then(function () {
        var pack = {
          exportedAt: new Date().toISOString(),
          formType: type,
          note: "简历链接 10 分钟后失效，请尽快运行 scripts/export_applicants.py",
          count: rows.length,
          resumeCount: withResume.length,
          rows: rows
        };
        var blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "爱西归档_" + type + "_" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        btn.disabled = false;
        btn.textContent = "导出归档包";
        notify("cfgSaved", "已导出 " + rows.length + " 条，其中 " + withResume.length + " 份简历。请尽快跑脚本，链接 10 分钟后失效。", 6000);
      });
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = "导出归档包";
      alert("导出失败：" + ((err && err.message) || ""));
    });
  });

  /* ====================== 开关与文案 ====================== */
  var swRecruit = document.getElementById("swRecruit");
  var swAnni = document.getElementById("swAnniversary");

  function paintSwitch(btn, on) {
    btn.classList.toggle("is-on", !!on);
    btn.setAttribute("aria-checked", on ? "true" : "false");
  }

  function bindSwitch(btn, key) {
    btn.addEventListener("click", function () {
      var next = !btn.classList.contains("is-on");
      paintSwitch(btn, next);
      btn.disabled = true;
      var patch = {};
      patch[key] = next;
      window.AixiApi.admin("admin.setConfig", patch).then(function () {
        btn.disabled = false;
        notify("cfgSaved", next ? "已开放报名。" : "已关闭报名。");
      }).catch(function (err) {
        paintSwitch(btn, !next);          // 失败就回滚，别让界面骗人
        btn.disabled = false;
        notify("cfgError", "保存失败：" + ((err && err.message) || ""), 0);
      });
    });
  }
  bindSwitch(swRecruit, "recruit_open");
  bindSwitch(swAnni, "anniversary_open");

  function loadConfig() {
    window.AixiApi.getPublic().then(function (d) {
      var c = Object.assign({}, CFG.FALLBACK || {}, (d && d.config) || {});
      paintSwitch(swRecruit, c.recruit_open);
      paintSwitch(swAnni, c.anniversary_open);
      document.getElementById("cfgYear").value = c.recruit_year || "";
      document.getElementById("cfgDeadline").value = c.recruit_deadline || "";
      document.getElementById("cfgNote").value = c.recruit_note || "";
      document.getElementById("cfgAnniTitle").value = c.anniversary_title || "";
      document.getElementById("cfgAnniNote").value = c.anniversary_note || "";
      document.getElementById("cfgTplState").textContent = c.form_file_name
        ? "当前模板：" + c.form_file_name
        : (c.form_url ? "当前用的是手填链接" : "还没有模板");
      document.getElementById("cfgIcp").value = c.icp_number || "";
      document.getElementById("cfgMusicUrl").value = c.music_url || "";
      document.getElementById("cfgMusicTitle").value = c.music_title || "";
      document.getElementById("cfgFormUrl").value = c.form_url || "";
      document.getElementById("cfgGroupQr").value = c.group_qr || "";
      document.getElementById("cfgNextNote").value = c.next_note || "";
      document.getElementById("cfgAnniFormUrl").value = c.anni_form_url || "";
      document.getElementById("cfgAnniGroupQr").value = c.anni_group_qr || "";
      document.getElementById("cfgAnniNextNote").value = c.anni_next_note || "";
    }).catch(function () { /* 读不到就保持空，用户可以直接填 */ });
  }

  document.getElementById("cfgSave").addEventListener("click", function () {
    var btn = this;
    btn.disabled = true;
    window.AixiApi.admin("admin.setConfig", {
      recruit_year: document.getElementById("cfgYear").value.trim(),
      recruit_deadline: document.getElementById("cfgDeadline").value.trim(),
      recruit_note: document.getElementById("cfgNote").value.trim(),
      anniversary_title: document.getElementById("cfgAnniTitle").value.trim(),
      anniversary_note: document.getElementById("cfgAnniNote").value.trim(),
      icp_number: document.getElementById("cfgIcp").value.trim(),
      music_url: document.getElementById("cfgMusicUrl").value.trim(),
      music_title: document.getElementById("cfgMusicTitle").value.trim(),
      form_url: document.getElementById("cfgFormUrl").value.trim(),
      group_qr: document.getElementById("cfgGroupQr").value.trim(),
      next_note: document.getElementById("cfgNextNote").value.trim(),
      anni_form_url: document.getElementById("cfgAnniFormUrl").value.trim(),
      anni_group_qr: document.getElementById("cfgAnniGroupQr").value.trim(),
      anni_next_note: document.getElementById("cfgAnniNextNote").value.trim()
    }).then(function () {
      btn.disabled = false;
      notify("cfgSaved", "已保存。");
    }).catch(function (err) {
      btn.disabled = false;
      notify("cfgError", "保存失败：" + ((err && err.message) || ""), 0);
    });
  });

  /* ====================== 公众号动态 ====================== */
  function loadPosts() {
    window.AixiApi.admin("admin.listPosts", {}).then(function (r) {
      var rows = r.rows || [];
      var host = document.getElementById("postList");
      if (!rows.length) {
        host.innerHTML = '<p class="help" style="margin:0;">还没有录入文章。</p>';
        return;
      }
      host.innerHTML = rows.map(function (p) {
        return '<div class="post-row">'
          + '<div style="color:var(--muted);font-size:.86rem;padding-top:11px;">'
          + esc(p.order || 0) + "</div>"
          + '<div style="padding-top:9px;font-size:.92rem;font-weight:bold;color:var(--ink-3);">'
          + esc(p.title) + "</div>"
          + '<div style="padding-top:9px;font-size:.8rem;color:var(--muted);word-break:break-all;">'
          + esc(p.url) + "</div>"
          + '<div style="padding-top:9px;font-size:.84rem;color:var(--muted);">'
          + esc(p.date || "") + "</div>"
          + '<button class="btn btn-ghost btn-sm" data-del-post="' + esc(p._id)
          + '" style="color:var(--err);">删除</button>'
          + "</div>";
      }).join("");

      Array.prototype.forEach.call(host.querySelectorAll("[data-del-post]"), function (b) {
        b.addEventListener("click", function () {
          if (!confirm("确定删除这篇？首页上会立刻消失。")) return;
          b.disabled = true;
          window.AixiApi.admin("admin.deletePost", { id: b.getAttribute("data-del-post") })
            .then(loadPosts)
            .catch(function (err) {
              b.disabled = false;
              notify("postError", "删除失败：" + ((err && err.message) || ""), 0);
            });
        });
      });
    }).catch(function (err) {
      document.getElementById("postList").innerHTML =
        '<p class="help" style="margin:0;">读取失败：' + esc((err && err.message) || "") + "</p>";
    });
  }

  document.getElementById("npAdd").addEventListener("click", function () {
    var btn = this;
    var title = document.getElementById("npTitle").value.trim();
    var url = document.getElementById("npUrl").value.trim();
    if (!title || !/^https?:\/\//i.test(url)) {
      notify("postError", "标题必填，链接必须是 http(s) 开头的完整地址。", 0);
      return;
    }
    btn.disabled = true;
    window.AixiApi.admin("admin.savePost", {
      title: title,
      url: url,
      date: document.getElementById("npDate").value.trim(),
      order: Number(document.getElementById("npOrder").value) || 0
    }).then(function () {
      btn.disabled = false;
      ["npTitle", "npUrl", "npDate", "npOrder"].forEach(function (id) {
        document.getElementById(id).value = "";
      });
      loadPosts();
    }).catch(function (err) {
      btn.disabled = false;
      notify("postError", "添加失败：" + ((err && err.message) || ""), 0);
    });
  });

  /* ====================== 清理 ====================== */
  document.getElementById("purgeBtn").addEventListener("click", function () {
    var btn = this;
    var word = document.getElementById("purgeConfirm").value.trim();
    if (word !== "PURGE") {
      notify("purgeError", "请先在上面的输入框里输入 PURGE 以确认。", 0);
      return;
    }
    if (!confirm("云端的简历文件将被真正删除，无法恢复。确认本地已经有完整备份了吗？")) return;

    btn.disabled = true;
    btn.textContent = "清理中…";
    window.AixiApi.admin("admin.purgeResumes", {
      formType: currentType(), confirm: "PURGE"
    }).then(function (r) {
      btn.disabled = false;
      btn.textContent = "清空云端简历附件";
      document.getElementById("purgeConfirm").value = "";
      notify("purgeOk", "已删除 " + r.deletedFiles + " 个文件，清理了 " + r.clearedRecords + " 条记录的附件标记。", 0);
      loadList();
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = "清空云端简历附件";
      notify("purgeError", "清理失败：" + ((err && err.message) || ""), 0);
    });
  });
})();

/* ==========================================================================
   发邮件
   收件人一律由云函数按「哪张表 + 哪个状态」自己去数据库取，
   这个界面上不存在「手填一批地址群发」的入口 —— 后台被登进来也变不成群发工具。
   预览由云函数用同一份模板渲染后返回，所以预览和真正发出的内容必然一致。
   ========================================================================== */
(function initMail() {
  var $ = function (id) { return document.getElementById(id); };
  if (!$("mSubject")) return;

  /* 这是独立的 IIFE，上面那个作用域里的 esc 在这里取不到，必须自己有一份。
     所有会进 innerHTML 的值都要经过它 —— 邮箱、姓名、错误信息都是外部输入。 */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* 各表自己的状态词，必须与上面报名名单的 STATUS_BY_LIST 一致。
     周年庆没有「一面通过」这种环节，预约提醒更是只有一个状态，
     混用一套词只会让人在筛选时选到不存在的状态、筛出空结果。 */
  var STATUS_BY_TABLE = {
    recruit: ["已收到", "初筛通过", "一面通过", "已交作业", "作业通过", "二面通过", "已录取", "未通过"],
    anniversary: ["已收到", "已确认到场", "不能到场"],
    remind_recruit: ["已收到"],
    remind_anniversary: ["已收到"]
  };

  /* 预填一份面试通知的骨架。不会写的人照着改比对着空白框强。 */
  function today() {
    var d = new Date();
    return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
  }
  var DEFAULTS = {
    mSubject: "【爱西支教协会】面试通知",
    mTitle: "关于 2027 年度队员招新<br>第一次面试的通知",
    mBody: "你的报名材料我们已经认真看过了。\n\n经过初筛，我们希望和你聊一聊。面试采取车轮面的形式，一对一轮换，由不同的领队从不同角度了解你。不考知识，主要是想听听你为什么想来、能投入多少。\n\n请按下面的时间准时到场。如果时间实在冲突，请尽早回信告诉我们，我们会尽量帮你调整。",
    mSignName: "小西",
    mSignDate: today(),
    mKicker: "2027 年度队员招新 · 面试通知",
    mPreheader: "你的报名材料我们已经看过了，希望和你聊一聊。",
    mInfoTitle: "面试安排如下",
    mInfoRows: "时间｜〔待改：面试时间〕\n地点｜〔待改：面试地点〕\n形式｜车轮面，一对一轮换\n时长｜约 15 分钟",
    mFooter: "本邮件发送给已报名 2027 年度爱西招新的同学，如误收请忽略。"
  };
  Object.keys(DEFAULTS).forEach(function (id) {
    if ($(id) && !$(id).value) $(id).value = DEFAULTS[id];
  });

  function fillStatus() {
    var t = $("mTable").value;
    var list = STATUS_BY_TABLE[t] || [];
    $("mStatus").innerHTML = '<option value="__ALL__">全部状态</option>'
      + list.map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
    $("mCountText").textContent = "";
    $("mSample").textContent = "";
    $("mConfirm").value = "";
  }
  $("mTable").addEventListener("change", fillStatus);
  fillStatus();

  function currentStyle() {
    var el = $("mStyle");
    return el && el.value === "letter" ? "letter" : "notice";
  }

  /** 把界面上的输入收成云函数要的 content 结构 */
  function collectContent() {
    var paras = function (v) {
      return String(v || "").split(/\n\s*\n/).map(function (s) {
        return s.trim().replace(/\n/g, "<br>");
      }).filter(Boolean);
    };
    var rows = String($("mInfoRows").value || "").split("\n").map(function (line) {
      var m = line.split(/[|｜]/);
      return m.length >= 2 ? [m[0].trim(), m.slice(1).join("|").trim()] : null;
    }).filter(Boolean);

    return {
      SUBJECT: $("mSubject").value.trim(),
      PREHEADER: $("mPreheader").value.trim(),
      KICKER: $("mKicker").value.trim(),
      TITLE: $("mTitle").value.trim(),
      HONORIFIC: $("mHonorific").value.trim(),
      PARA_BODY: paras($("mBody").value),
      INFO_TITLE: $("mInfoTitle").value.trim(),
      INFO_ROWS: rows,
      GROUP_LABEL: $("mGroupName").value.trim() ? "工作群" : "",
      GROUP_NAME: $("mGroupName").value.trim(),
      GROUP_NOTE: $("mGroupNote").value.trim(),
      GROUP_EXPIRY: $("mGroupExpiry").value.trim(),
      PARA_CLOSING: paras($("mClosing").value),
      SIGN_NAME: $("mSignName").value.trim(),
      SIGN_DATE: $("mSignDate").value.trim(),
      SIGN_CONTACT: $("mSignContact").value.trim(),
      FOOTER_NOTE: $("mFooter").value.trim(),
      // 信件版专属；通知版会忽略这两项
      SIGN_UNIT: currentStyle() === "letter" ? "爱西支教协会 · 领队组" : "",
      COVER_LINE: currentStyle() === "letter" ? $("mSignDate").value.trim() : ""
    };
  }

  function say(kind, msg) {
    var okBox = $("mOk"), errBox = $("mErr");
    okBox.style.display = errBox.style.display = "none";
    var box = kind === "ok" ? okBox : errBox;
    box.innerHTML = msg;
    box.style.display = "block";
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* ---- 查看收件人：拉全量并渲染成可勾选列表 ---- */
  var candidates = [];

  function pickedIds() {
    return Array.prototype.filter.call(
      $("mPickList").querySelectorAll("input[type=checkbox]"),
      function (c) { return c.checked; }
    ).map(function (c) { return c.value; });
  }

  function refreshPickCount() {
    var n = pickedIds().length;
    $("mPickCount").textContent = "已勾选 " + n + " / " + candidates.length + " 人";
    $("mConfirm").value = "";          // 勾选变了就清掉确认数，逼着重新核对
  }

  function renderPickList() {
    if (!candidates.length) {
      $("mPickWrap").style.display = "none";
      return;
    }
    $("mPickWrap").style.display = "";

    /* 加表头。之前只有「勾选框 + 姓名 + 邮箱」三段，
       报名者姓名如果填的是数字（测试时填过「1」），看起来就像行号，
       分不清哪一列是姓名。 */
    var head = '<div style="display:grid;grid-template-columns:24px 8em 1fr;gap:9px;'
      + 'padding:0 0 8px;border-bottom:1px solid var(--line);'
      + 'font-size:.78rem;color:var(--muted);letter-spacing:1px;">'
      + "<span></span><span>姓名</span><span>邮箱</span></div>";

    $("mPickList").innerHTML = head + candidates.map(function (x) {
      return '<label style="display:grid;grid-template-columns:24px 8em 1fr;gap:9px;'
        + 'align-items:center;padding:6px 0;font-size:.9rem;border-bottom:1px solid var(--line);">'
        + '<input type="checkbox" checked value="' + esc(x.id) + '">'
        + '<span style="color:var(--ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
        + esc(x.name || "（未填）") + "</span>"
        + '<span style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
        + esc(x.email) + "</span>"
        + "</label>";
    }).join("");
    Array.prototype.forEach.call($("mPickList").querySelectorAll("input"), function (c) {
      c.addEventListener("change", refreshPickCount);
    });
    refreshPickCount();
  }

  $("mPickAll").addEventListener("click", function () {
    Array.prototype.forEach.call($("mPickList").querySelectorAll("input"), function (c) { c.checked = true; });
    refreshPickCount();
  });
  $("mPickNone").addEventListener("click", function () {
    Array.prototype.forEach.call($("mPickList").querySelectorAll("input"), function (c) { c.checked = false; });
    refreshPickCount();
  });

  $("mCount").addEventListener("click", function () {
    var b = this;
    b.disabled = true; b.textContent = "查询中…";
    window.AixiApi.admin("admin.mailCandidates", {
      formType: $("mTable").value, status: $("mStatus").value
    }).then(function (r) {
      b.disabled = false; b.textContent = "查看收件人";
      candidates = r.rows || [];
      $("mCountText").textContent = "符合条件 " + r.total + " 人"
        + (r.noName ? "（其中 " + r.noName + " 人没填姓名，称呼会用「各位领队」）" : "");
      $("mSample").textContent = candidates.length ? "" : "没有符合条件的收件人。";
      renderPickList();
    }).catch(function (e) {
      b.disabled = false; b.textContent = "查看收件人";
      say("err", "查询失败：" + esc((e && e.message) || ""));
    });
  });

  /* ---- 预览 ---- */
  $("mPreviewBtn").addEventListener("click", function () {
    var b = this;
    b.disabled = true; b.textContent = "渲染中…";
    window.AixiApi.admin("admin.mailPreview", {
      content: collectContent(), sampleName: "张三", style: currentStyle()
    }).then(function (r) {
      b.disabled = false; b.textContent = "生成预览";
      $("mPvEmpty").style.display = "none";
      var f = $("mPvFrame");
      f.style.display = "block";
      f.srcdoc = r.html;
      $("mPvSubject").textContent = r.subject;
      $("mPvSize").textContent = Math.round(r.htmlBytes / 1024) + " KB"
        + (r.gmailClipRisk ? " ⚠ 偏大，Gmail 可能截断" : "");
    }).catch(function (e) {
      b.disabled = false; b.textContent = "生成预览";
      say("err", "预览失败：" + esc((e && e.message) || ""));
    });
  });

  /* ---- 测试发送 ---- */
  $("mTestBtn").addEventListener("click", function () {
    var b = this;
    var to = $("mTestTo").value.trim();
    if (!to) { say("err", "请先填一个测试邮箱。"); return; }
    b.disabled = true; b.textContent = "发送中…";
    window.AixiApi.admin("admin.mailSend", {
      mode: "test", testTo: to, sampleName: "张三",
      content: collectContent(), style: currentStyle()
    }).then(function (r) {
      b.disabled = false; b.textContent = "发送测试";
      if (r.sent) say("ok", "测试邮件已发到 <strong>" + esc(to) + "</strong>，去收信箱看看（可能在垃圾箱）。");
      else say("err", "发送失败：" + esc((r.failures[0] && r.failures[0].error) || "未知原因"));
      loadLog();
    }).catch(function (e) {
      b.disabled = false; b.textContent = "发送测试";
      say("err", "发送失败：" + esc((e && e.message) || ""));
    });
  });

  /* ---- 正式群发 ---- */
  $("mSendBtn").addEventListener("click", function () {
    var b = this;
    var n = $("mConfirm").value.trim();
    if (!/^\d+$/.test(n)) { say("err", "请先点「查看收件人」，再把人数填进确认框。"); return; }
    var ids = pickedIds();
    if (!ids.length) { say("err", "一个人都没勾选。请先点「查看收件人」并勾上要发的人。"); return; }
    if (Number(n) !== ids.length) {
      say("err", "确认框里填的是 " + n + "，但当前勾选了 " + ids.length + " 人。请填成勾选的人数。");
      return;
    }
    if (!confirm("即将给 " + ids.length + " 个人发送邮件。发出去无法撤回，确认继续？")) return;

    b.disabled = true; b.textContent = "发送中，别关页面…";
    window.AixiApi.admin("admin.mailSend", {
      mode: "real", formType: $("mTable").value, status: $("mStatus").value,
      confirmCount: ids.length, ids: ids,
      content: collectContent(), style: currentStyle()
    }).then(function (r) {
      b.disabled = false; b.textContent = "确认群发";
      var msg = "已发送 <strong>" + r.sent + "</strong> 封";
      if (r.failed) {
        msg += "，失败 " + r.failed + " 封：<br>"
          + r.failures.map(function (f) { return esc(f.email) + " —— " + esc(f.error); }).join("<br>");
        say("err", msg);
      } else {
        say("ok", msg + "，全部成功。");
        $("mConfirm").value = "";
      }
      loadLog();
    }).catch(function (e) {
      b.disabled = false; b.textContent = "确认群发";
      say("err", "发送失败：" + esc((e && e.message) || ""));
    });
  });

  /* ---- 发送记录 ---- */
  function loadLog() {
    window.AixiApi.admin("admin.mailLog", {}).then(function (r) {
      var rows = r.rows || [];
      $("mLog").innerHTML = rows.length ? rows.map(function (d) {
        return '<div class="log-row">'
          + esc(String(d.at || "").replace("T", " ").slice(0, 16))
          + "　" + (d.mode === "test" ? "测试" : "群发")
          + "　<strong style=\"color:var(--ink-3);\">" + esc(d.subject || "") + "</strong>"
          + "　成功 " + (d.sent || 0) + " / " + (d.total || 0)
          + (d.failed ? "　失败 " + d.failed : "")
          + "</div>";
      }).join("") : '<p class="help" style="margin:0;">还没有发送记录。</p>';
    }).catch(function () {
      $("mLog").innerHTML = '<p class="help" style="margin:0;">读取记录失败。</p>';
    });
  }
  loadLog();
})();

/* ==========================================================================
   邮件模板
   文案来自社团实际发过的通知，措辞按「正式严谨」的要求重写：
   去掉表情与口语，保留全部事实、需要对方回复的动作和联系方式。
   【】括起来的是每年要改的（时间、地点、链接、截止日期）——
   刻意留成显眼的括号，发之前漏改一眼就能看出来。
   ========================================================================== */
(function initMailTemplates() {
  var sel = document.getElementById("mTemplate");
  if (!sel) return;

  var SITE = location.origin;   // 部署后就是站点自己的域名

  var T = {
    /* 发给在报名页留过邮箱的人。发完这一封，按隐私声明的承诺要删掉这些邮箱。 */
    notifyOpen: {
      SUBJECT: "【爱西支教协会】2027 年度队员招新报名已开放",
      KICKER: "2027 年度队员招新 · 报名开放",
      TITLE: "招新报名已开放",
      PARA_BODY: "你此前在爱西支教协会官网留下邮箱，希望在招新开放时收到通知。现在报名通道已经开放。\n\n报名需要填写基本信息与一段自述，也可以上传简历附件。提交成功后你会得到一个 8 位凭证码，凭「邮箱 + 凭证码」可以随时回来查询进度、补传材料。\n\n招新详情、选拔流程与常见问题都在报名页上，建议先看一遍再填。",
      INFO_TITLE: "报名信息",
      INFO_ROWS: "报名地址｜" + SITE + "/apply.html\n报名截止｜〔待改：报名截止时间〕\n后续流程｜简历初筛 → 一面 → 线上作业 → 二面\n招生范围｜华南理工大学在校学生",
      PARA_CLOSING: "",
      SIGN_NAME: "小西",
      SIGN_CONTACT: "",
      FOOTER_NOTE: "你收到本邮件，是因为此前在爱西官网留下邮箱预约开放提醒。本封通知发出后，我们会删除该邮箱记录，不会再向你发送其他邮件。"
    },

    interview1: {
      SUBJECT: "【爱西支教协会】2027 年度招新第一轮面试通知",
      KICKER: "2027 年度队员招新 · 第一轮面试",
      TITLE: "第一轮面试通知",
      PARA_BODY: "你已通过 2027 年度爱西支教队招新的简历初筛，现邀请你参加第一轮面试。\n\n面试采取车轮面形式，由多位领队分别面谈。请按下方安排准时到场，并提前 10 分钟签到。\n\n请于〔待改：回复截止时间〕前回复本邮件确认：能参加请回复「姓名 + 可以参加」；不能参加请回复「姓名 + 不能参加 + 原因」。未在截止时间前回复的，视为放弃本次面试。",
      INFO_TITLE: "面试安排",
      INFO_ROWS: "时间｜〔待改：面试时间〕\n地点｜〔待改：面试地点〕\n形式｜车轮面，一对一轮换\n须携带｜纸质报名表一份\n回复截止｜〔待改：回复截止时间〕",
      PARA_CLOSING: "如遇突发情况无法按时到场，请尽早回信说明，我们会视情况安排。",
      SIGN_NAME: "小西",
      SIGN_CONTACT: "",
      FOOTER_NOTE: "本邮件发送给已通过简历初筛的报名者，如误收请忽略。"
    },

    pass1: {
      SUBJECT: "【爱西支教协会】第一轮面试结果与线上作业通知",
      KICKER: "2027 年度队员招新 · 一面结果",
      TITLE: "第一轮面试结果<br>与线上作业通知",
      PARA_BODY: "恭喜你通过 2027 年度爱西支教队招新的第一轮面试。\n\n接下来是线上作业。请从下方链接获取作业内容，完成后在截止时间前提交到指定邮箱。本次作业纳入最终录取的考察范围，请认真对待。\n\n如对作业内容有疑问，可直接回信询问，或在公众号私信小西。",
      INFO_TITLE: "线上作业",
      INFO_ROWS: "作业链接｜〔待改：网盘链接，每年都会换〕\n提取码｜〔待改：提取码〕\n提交邮箱｜ixibu@qq.com\n提交截止｜〔待改：作业提交截止时间〕",
      PARA_CLOSING: "收到本邮件后，请回复「姓名 + 收到」。",
      SIGN_NAME: "小西",
      SIGN_CONTACT: "",
      FOOTER_NOTE: "本邮件发送给通过第一轮面试的报名者，如误收请忽略。"
    },

    /* ===== 周年庆 =====
       原来拆成「邀请」和「当天安排」两封，社团要求合成一封：
       一次把爱西是什么、为什么请你回来、当天怎么走都说清楚。
       口气要正式而真诚 —— 这是一个机构给历届成员的邀请，
       不是群消息，所以不用「叫大家聚一聚」这类腔调。
       刻意不写周年数：2008 年起算，到 2027 年 3 月是第十九年，
       写死数字容易过一年就错，年份统一放在〔待改〕里。 */
    anniversary: {
      SUBJECT: "【爱西支教协会】周年庆邀请",
      KICKER: "爱西支教协会 · 周年庆",
      TITLE: "周年庆邀请",
      PARA_BODY: "〔待改：2027〕年 3 月 15 日，爱西支教协会将举办周年庆。我们诚挚地邀请你回来。\n\n爱西支教协会成立于 2008 年，由华南理工大学三名贵州籍学生发起，2013 年起独立运营支教活动。此后队伍先后走过织金、纳雍、金沙、闽中、松桃、播泉、丹寨，2026 年到了河南。课程也从最初的补课，逐步发展为「主题+」的形式，并在 2022 年增设了兴趣课机制。这些变化不是哪一届单独完成的，是一届接一届做下来的。\n\n你在的那一年所做的事，都留在了这条线上 —— 反复推翻重来的课件、带过的那个班、结营那天没说完的话。爱西没有一间固定的教室，真正被留下来的只有人，和人做过的事。谢谢你当年把时间和心力给了这件事。\n\n这些年整理旧资料时，我们常在课程表、合影和交接文档的末尾看到你们的名字。所以想借这个日子，把大家请回来见一面。\n\n当天的时间、地点与流程见下方。报名时可以填写是否到场、随行人数与饮食忌口，便于我们准备场地和餐食。如果那天你无法到场，也请在表中说明，我们会把当天的照片与记录整理后发给你。",
      INFO_TITLE: "活动信息",
      INFO_ROWS: "时间｜〔待改：2027〕年 3 月 15 日〔待改：具体时段〕\n地点｜〔待改：活动地点〕\n签到｜〔待改：签到处位置与开始时间〕\n当天流程｜〔待改：例如 签到 → 合影 → 分享 → 聚餐〕\n报名截止｜〔待改：报名截止时间〕\n报名地址｜" + SITE + "/apply.html?form=anniversary",
      PARA_CLOSING: "确定到场请在报名表中填写；报名后情况有变，回信告诉我们即可。\n\n爱西一直在，位置也一直留着。期待那天见到你。",
      SIGN_NAME: "小西",
      SIGN_CONTACT: "",
      FOOTER_NOTE: "你收到本邮件，是因为你曾是爱西的一员，或此前留下邮箱希望收到周年庆通知。"
    },

    /* 一面未通过。文案取自社团原文，措辞未改，同样只做三处技术调整：
       去掉开头称呼、去掉写死的收件人姓名、空行分段。建议配「信件版」发送。 */
    reject1: {
      SUBJECT: "【爱西支教协会】关于第一轮面试结果",
      KICKER: "爱西支教协会 · 领队组",
      TITLE: "关于第一轮面试结果",
      GREETING_TAIL: "：",
      PARA_BODY: "感谢你选择爱西，也谢谢你在第一轮面试中付出的认真与热情。经过慎重考虑，我们很遗憾地通知你，未能通过本轮面试。\n\n但请你一定相信，这不是对你能力的否定，更不是对这份热爱的拒绝。每一段旅程都有自己的节奏，或许这一次的擦肩，是为了让你遇见另一片更适合你的天空。\n\n愿你继续保持对支教的热忱，也期待未来某个路口，我们能再次相遇。小西会一直记得你曾认真走来，祝一切顺利！",
      INFO_TITLE: "",
      INFO_ROWS: "",
      PARA_CLOSING: "",
      SIGN_NAME: "小西",
      SIGN_CONTACT: "",
      FOOTER_NOTE: "如对结果有疑问，可直接回复本邮件。",
      _style: "letter"
    },

    /* 二面未通过。文案是社团自己写的，我只做了三处技术性调整：
       ① 去掉开头的称呼（模板会自动生成「某某，你好：」，重复会出现两次）
       ② 去掉收件人姓名（姓名由系统按收件人逐封替换，写死会发错人）
       ③ 空行分段，交给模板渲染成段落
       措辞一个字没改 —— 这种信的分寸只有你们自己拿得准。
       建议配「信件版」发送。 */
    reject2: {
      SUBJECT: "【爱西支教协会】关于第二轮面试结果",
      KICKER: "爱西支教协会 · 领队组",
      TITLE: "关于第二轮面试结果",
      GREETING_TAIL: "：",
      PARA_BODY: "谢谢你一路坚持，走到了爱西支教队的第二轮面试。从第一轮到第二轮，我们看到了你的投入、你的准备，也看到了你心中那份对孩子们真诚的牵挂。这些，都让我们非常感动。\n\n经过两轮面试的慎重讨论与综合考量，我们非常遗憾地通知你，未能最终通过本次爱西支教队的选拔。做出这个决定，我们反复讨论了很久，内心也很不舍。你在整个过程中所展现出的认真态度与真诚心意，我们都真真切切地看在眼里，也记在了心上。\n\n请你一定不要因此怀疑自己。支教路上的每一次筛选，从来不是谁比谁优秀。只是因为团队在当下的组建中，需要寻找的是最适合这趟旅程的人——包括性格的搭配、分工的互补，以及整体节奏的合拍。这些并不完全由能力决定。你已经走得很远、很认真，这份坚持本身就值得被尊重、被感谢。\n\n我们由衷希望，这次经历不会让你对支教失去热情，反而让你更清楚自己身上闪光的那些部分。未来的路还很长，支教的形式也有很多种。我们相信，像你这样用心的人，一定会在属于自己的时间、属于自己的地方，点亮真正需要你的那间教室、那群孩子。\n\n小西会一直记得你认真走过的每一步。愿你继续带着这份热爱往前走，我们期待在未来的某一天，以另一种方式重逢。\n\n祝一切顺利，也祝你在接下来的日子里，遇见属于你的那片天空。",
      INFO_TITLE: "",
      INFO_ROWS: "",
      PARA_CLOSING: "",
      SIGN_NAME: "小西",
      SIGN_CONTACT: "",
      FOOTER_NOTE: "如对结果有疑问，可直接回复本邮件。",
      _style: "letter"
    },

    admitted: {
      SUBJECT: "【爱西支教协会】2027 年度队员录取通知",
      KICKER: "2027 年度队员招新 · 录取通知",
      TITLE: "录取通知",
      PARA_BODY: "恭喜你通过爱西支教队 2027 年度招新的全部选拔环节，正式成为爱西的一员。\n\n后续的破冰、集中培训与备课安排会另行通知，请留意邮箱与公众号消息。备课自春季开始，持续约一个学期，请提前规划好时间。",
      INFO_TITLE: "",
      INFO_ROWS: "",
      PARA_CLOSING: "收到本邮件后，请回复「姓名 + 收到」，我们据此确认最终名单。",
      SIGN_NAME: "小西",
      SIGN_CONTACT: "",
      FOOTER_NOTE: "本邮件发送给 2027 年度爱西支教队录取队员，如误收请忽略。"
    }
  };

  function today() {
    var d = new Date();
    return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
  }

  sel.addEventListener("change", function () {
    var t = T[sel.value];
    if (!t) return;
    if (!confirm("套用「" + sel.options[sel.selectedIndex].text + "」会覆盖当前填写的全部文案，继续？")) {
      sel.value = "";
      return;
    }
    if (t._style) {
      var st = document.getElementById("mStyle");
      if (st) st.value = t._style;
    }
    var map = {
      mSubject: t.SUBJECT, mKicker: t.KICKER, mTitle: t.TITLE,
      mBody: t.PARA_BODY, mInfoTitle: t.INFO_TITLE, mInfoRows: t.INFO_ROWS,
      mClosing: t.PARA_CLOSING, mSignName: t.SIGN_NAME,
      mSignContact: t.SIGN_CONTACT, mFooter: t.FOOTER_NOTE,
      mSignDate: today(),
      mPreheader: String(t.PARA_BODY || "").split("\n")[0].slice(0, 60),
      mHonorific: "", mGroupName: "", mGroupNote: "", mGroupExpiry: ""
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = map[id] == null ? "" : map[id];
    });

    // 套完模板顺手渲染一次，省一步点击
    var pv = document.getElementById("mPreviewBtn");
    if (pv) pv.click();
  });
})();
