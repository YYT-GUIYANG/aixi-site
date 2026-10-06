/* ==========================================================================
   爱西官网 · 数据访问层
   所有页面读写业务数据都只经过这里，不直连数据库。

   为什么不让前端直连数据库：
   applications 集合里有报名者的手机号、邮箱和简历。如果把集合权限放成
   「所有用户可读」，任何人用 SDK 三行代码就能把全部报名者信息拉走。
   所以集合权限一律设成「仅管理端可读写」，读写全部经由云函数，
   由云函数决定谁能看什么。这是整套系统里最要紧的一条。

   配置留空时自动进入演示模式：数据存在 localStorage，页面功能可完整走通，
   但会在界面上明确提示「未真正提交」，不会假装成功。
   ========================================================================== */

(function (global) {
  "use strict";

  var CFG = global.AIXI_CONFIG || {};
  var BASE = (CFG.API_BASE || "").replace(/\/+$/, "");

  /* 本机预览时可以用 ?demo=1 强制演示模式（自测脚本靠它）。
     刻意限制成只有 localhost / 127.0.0.1 才认：如果线上也能用这个参数，
     有人分享一个带 ?demo=1 的链接，报名者填完会以为提交成功了，其实什么都没发生。 */
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(global.location.hostname);
  var forceDemo = isLocal && /[?&]demo=1(&|$)/.test(global.location.search);

  var DEMO = !BASE || forceDemo;

  var DEMO_KEY = "aixi_demo_store_v1";

  function readDemoStore() {
    try {
      return JSON.parse(global.localStorage.getItem(DEMO_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function writeDemoStore(store) {
    try {
      global.localStorage.setItem(DEMO_KEY, JSON.stringify(store));
    } catch (e) {
      /* 隐私模式下 localStorage 可能不可用，演示模式失去持久化但不该报错 */
    }
  }

  /* 演示模式下的凭证码：够用就好，不承担安全职责（真实凭证码在云函数里生成） */
  function fakeTicket() {
    var s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    for (var i = 0; i < 8; i++) out += s.charAt(Math.floor(Math.random() * s.length));
    return out;
  }

  function post(action, payload) {
    return global.fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: action, payload: payload || {} })
    }).then(function (res) {
      if (!res.ok) throw new Error("服务器返回 " + res.status);
      return res.json();
    }).then(function (json) {
      // 云函数统一返回 { ok: bool, data?: any, error?: string }
      if (!json || json.ok !== true) {
        throw new Error((json && json.error) || "请求失败");
      }
      return json.data;
    });
  }

  /* ---- 演示模式的各 action 实现 ---- */
  var demoHandlers = {
    getPublic: function () {
      var store = readDemoStore();
      return {
        config: Object.assign({}, CFG.FALLBACK, store.config || {}),
        posts: store.posts || []
      };
    },
    submitForm: function (payload) {
      var store = readDemoStore();
      // 与云函数里的 COLLECTION_OF 保持一致：预约提醒单独一张表
      var key = /^remind_/.test(payload.formType) ? "reminders"
        : payload.formType === "anniversary" ? "anniversary_signups" : "applications";
      store[key] = store[key] || [];
      var email = String((payload.data && payload.data.email) || "").toLowerCase();
      if (email && store[key].some(function (r) { return r.email === email; })) {
        throw new Error("这个邮箱已经提交过了。如需修改，请到「查询进度」页面。");
      }
      var rec = {
        id: "demo_" + Date.now(),
        _id: "demo_" + Date.now(),
        formType: payload.formType,
        email: email,
        ticket: fakeTicket(),
        status: "已收到",
        createdAt: new Date().toISOString(),
        hasResume: false,
        resumeFileId: "",
        data: payload.data
      };
      store[key].push(rec);
      writeDemoStore(store);
      return { ticket: rec.ticket, status: rec.status, demo: true };
    },
    queryStatus: function (payload) {
      var store = readDemoStore();
      var all = (store.applications || []).concat(store.anniversary_signups || []);
      var email = String(payload.email || "").toLowerCase();
      var hit = all.filter(function (r) {
        return r.email === email && r.ticket === String(payload.ticket || "").toUpperCase();
      })[0];
      if (!hit) throw new Error("查不到记录。请确认邮箱和凭证码是否与提交时一致。");
      var cfg = Object.assign({}, CFG.FALLBACK, (store.config || {}));
      return {
        status: hit.status, createdAt: hit.createdAt,
        formTypeRaw: hit.formType === "anniversary" ? "anniversary" : "recruit",
        name: hit.data && hit.data.name,
        data: hit.data || {},
        canEdit: hit.formType === "anniversary" ? !!cfg.anniversary_open : !!cfg.recruit_open,
        hasResume: false, demo: true
      };
    },

    updateSubmission: function (payload) {
      var store = readDemoStore();
      var email = String(payload.email || "").toLowerCase();
      var tk = String(payload.ticket || "").toUpperCase();
      var found = null;
      ["applications", "anniversary_signups"].forEach(function (k) {
        (store[k] || []).forEach(function (r) {
          if (r.email === email && r.ticket === tk) found = r;
        });
      });
      if (!found) throw new Error("查不到记录。请确认邮箱和凭证码与提交时一致。");
      found.data = payload.data;
      found.updatedAt = new Date().toISOString();
      writeDemoStore(store);
      return { updatedAt: found.updatedAt, hasResume: false, replacedResume: false, demo: true };
    },

    /* ---- 后台的演示实现：让后台页面在没接云开发时也能完整点一遍 ---- */
    "admin.list": function (payload) {
      var store = readDemoStore();
      var key = payload.formType === "anniversary" ? "anniversary_signups"
        : payload.formType === "reminders" ? "reminders" : "applications";
      var rows = (store[key] || []).slice().reverse().map(function (r) {
        var id = r._id || r.id;
        return Object.assign({}, r, {
          noteCount: (store.notes || []).filter(function (n) { return n.recordId === id; }).length
        });
      });
      return { total: rows.length, rows: rows, demo: true };
    },
    "admin.setStatus": function (payload) {
      var store = readDemoStore();
      ["applications", "anniversary_signups"].forEach(function (k) {
        (store[k] || []).forEach(function (r) {
          if (r.id === payload.id) { r.status = payload.status; }
        });
      });
      writeDemoStore(store);
      return { id: payload.id, status: payload.status, demo: true };
    },
    "admin.setConfig": function (payload) {
      var store = readDemoStore();
      store.config = Object.assign({}, store.config || {}, payload);
      writeDemoStore(store);
      return store.config;
    },
    "admin.listPosts": function () {
      var store = readDemoStore();
      return { rows: store.posts || [] };
    },
    "admin.savePost": function (payload) {
      var store = readDemoStore();
      store.posts = store.posts || [];
      if (payload.id) {
        store.posts = store.posts.map(function (p) {
          return p._id === payload.id ? Object.assign({}, p, payload, { _id: p._id }) : p;
        });
      } else {
        store.posts.push(Object.assign({}, payload, { _id: "demo_" + Date.now() }));
      }
      store.posts.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      writeDemoStore(store);
      return { id: payload.id || "new" };
    },
    "admin.deletePost": function (payload) {
      var store = readDemoStore();
      store.posts = (store.posts || []).filter(function (p) { return p._id !== payload.id; });
      writeDemoStore(store);
      return { id: payload.id };
    },
    "admin.export": function (payload) {
      return demoHandlers["admin.list"](payload);
    },
    "admin.deleteRecords": function (payload) {
      var store = readDemoStore();
      var key = payload.formType === "anniversary" ? "anniversary_signups"
        : payload.formType === "reminders" ? "reminders" : "applications";
      var ids = payload.ids || [];
      var before = (store[key] || []).length;
      store[key] = (store[key] || []).filter(function (r) {
        return ids.indexOf(r._id || r.id) < 0;
      });
      // 批注跟着记录一起删，和云函数里的行为保持一致
      store.notes = (store.notes || []).filter(function (n) { return ids.indexOf(n.recordId) < 0; });
      writeDemoStore(store);
      return { deleted: before - store[key].length, files: 0, failures: [] };
    },

    /* ---- 批注的演示实现 ----
       署名在演示模式下存在本机；真实环境里由云函数按登录 uid 记录，前端改不了。 */
    "admin.whoami": function () {
      var store = readDemoStore();
      return { uid: "demo-uid", name: store.myName || "领队 demo", named: !!store.myName };
    },
    "admin.setMyName": function (payload) {
      var store = readDemoStore();
      store.myName = String(payload.name || "").slice(0, 20);
      writeDemoStore(store);
      return { uid: "demo-uid", name: store.myName };
    },
    "admin.listNotes": function (payload) {
      var store = readDemoStore();
      var rows = (store.notes || []).filter(function (n) { return n.recordId === payload.recordId; });
      return {
        rows: rows.map(function (n) {
          return {
            id: n.id, anchor: n.anchor || "", text: n.text,
            // 带了 uid 的（自测里模拟「另一个领队」写的）就不算自己的
            author: n.author || store.myName || "领队 demo",
            mine: n.uid ? n.uid === "demo-uid" : true,
            createdAt: n.createdAt, updatedAt: n.updatedAt || ""
          };
        })
      };
    },
    "admin.addNote": function (payload) {
      var store = readDemoStore();
      if (!String(payload.text || "").trim()) throw new Error("批注内容不能为空。");
      store.notes = store.notes || [];
      var n = {
        id: "note_" + Date.now() + "_" + store.notes.length,
        recordId: payload.recordId, formType: payload.formType, uid: "demo-uid",
        anchor: payload.anchor || "", text: String(payload.text).slice(0, 1000),
        createdAt: new Date().toISOString()
      };
      store.notes.push(n);
      writeDemoStore(store);
      return { id: n.id };
    },
    "admin.updateNote": function (payload) {
      var store = readDemoStore();
      if (!String(payload.text || "").trim()) throw new Error("批注内容不能为空。要删除请用删除。");
      (store.notes || []).forEach(function (n) {
        if (n.id === payload.id) {
          n.text = String(payload.text).slice(0, 1000);
          n.updatedAt = new Date().toISOString();
        }
      });
      writeDemoStore(store);
      return { id: payload.id };
    },
    "admin.deleteNote": function (payload) {
      var store = readDemoStore();
      store.notes = (store.notes || []).filter(function (n) { return n.id !== payload.id; });
      writeDemoStore(store);
      return { id: payload.id, deleted: 1 };
    },
    "admin.resumeUrl": function () {
      throw new Error("演示模式没有真实的简历文件：需要先接上云开发。");
    },

    /* 邮件相关的演示实现：界面能完整点一遍，但绝不会真的发信。 */
    "admin.mailCandidates": function (payload) {
      var r = demoHandlers["admin.list"](payload);
      var rows = (r.rows || []).filter(function (x) { return x.email; });
      return {
        total: rows.length,
        sample: rows.slice(0, 30).map(function (x) {
          return { name: (x.data && x.data.name) || "", email: x.email };
        }),
        noName: rows.filter(function (x) { return !(x.data && x.data.name); }).length
      };
    },
    "admin.mailPreview": function () {
      throw new Error("演示模式无法生成预览：邮件由云函数用真实模板渲染，需要先接上云开发。");
    },
    "admin.mailSend": function () {
      throw new Error("演示模式不会发送任何邮件。");
    },
    "admin.mailLog": function () {
      return { rows: [] };
    }
  };

  function call(action, payload) {
    if (!DEMO) return post(action, payload);
    return new Promise(function (resolve, reject) {
      // 留一点延迟，让加载态、按钮禁用这些交互能被真正测出来
      global.setTimeout(function () {
        try {
          var fn = demoHandlers[action];
          if (!fn) throw new Error("演示模式未实现的操作：" + action);
          resolve(fn(payload || {}));
        } catch (e) {
          reject(e);
        }
      }, 420);
    });
  }

  var publicOnce = null;

  global.AixiApi = {
    /* 'cloud' = 已接云开发；'demo' = 配置留空，本地演示 */
    mode: DEMO ? "demo" : "cloud",
    isDemo: DEMO,

    /** 首页与报名页都要的公共数据：两个开关 + 公众号文章卡片。
        同一次访问里会有好几处要用（首页内容、音乐开关…），所以缓住第一次的
        Promise 重复利用 —— 每多打一次云函数就是多一次计费，而这份数据
        在一次访问里不会变。刷新页面自然重来。 */
    getPublic: function () {
      if (!publicOnce) {
        publicOnce = call("getPublic").catch(function (e) {
          publicOnce = null;      // 失败不缓存，否则一次网络抖动就永远拿不到了
          throw e;
        });
      }
      return publicOnce;
    },

    /** 提交报名。formType: 'recruit' | 'anniversary' */
    submitForm: function (formType, data, resumeFileId) {
      return call("submitForm", { formType: formType, data: data, resumeFileId: resumeFileId || "" });
    },

    /** 凭邮箱 + 凭证码查进度 */
    queryStatus: function (email, ticket) {
      return call("queryStatus", { email: email, ticket: ticket });
    },

    /** 凭邮箱 + 凭证码修改已提交的内容。服务端会再验一次凭证，不信前端。 */
    updateSubmission: function (email, ticket, data, resumeFileId) {
      return call("updateSubmission", {
        email: email, ticket: ticket, data: data, resumeFileId: resumeFileId || ""
      });
    },

    /**
     * 后台操作。刻意不走 HTTP，而是走 SDK 的 callFunction：
     * 那条路径自带登录态，云函数里可以直接 getUserInfo() 取 uid 比对管理员白名单。
     * 云函数也会拒绝一切从 HTTP 路径过来的 admin.* 调用，
     * 这样后台就不存在一个「知道 URL 就能打」的公网入口。
     */
    admin: function (action, payload) {
      if (DEMO) {
        var fn = demoHandlers[action];
        if (!fn) return Promise.reject(new Error("演示模式未实现的后台操作：" + action));
        return new Promise(function (resolve, reject) {
          global.setTimeout(function () {
            try { resolve(fn(payload || {})); } catch (e) { reject(e); }
          }, 260);
        });
      }
      if (!global.AixiCloud) {
        return Promise.reject(new Error("缺少 js/cloud.js，后台无法调用云函数。"));
      }
      return global.AixiCloud.callFunction("aixiApi", {
        action: action, payload: payload || {}
      });
    }
  };
})(window);
