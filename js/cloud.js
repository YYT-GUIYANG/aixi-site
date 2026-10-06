/* ==========================================================================
   CloudBase SDK 的懒加载封装
   只做两件事：上传简历附件、后台管理员登录。

   为什么要懒加载：SDK 有 718KB。首页和报名页读数据都走 api.js 的 fetch
   （几 KB），只有真的要上传文件或登录后台时才需要 SDK。
   云开发按流量计费，让每个访客白下 718KB 等于烧免费额度。
   ========================================================================== */

(function (global) {
  "use strict";

  var CFG = global.AIXI_CONFIG || {};
  var loadTask = null;
  var app = null;
  var anonTask = null;

  var SDK_URLS = [
    "js/vendor/cloudbase.full.js",
    "https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js"
  ];

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("加载失败：" + url)); };
      document.head.appendChild(s);
    });
  }

  function ensureSDK() {
    if (global.cloudbase) return Promise.resolve();
    if (!loadTask) {
      loadTask = (function () {
        var chain = Promise.reject();
        SDK_URLS.forEach(function (url) {
          chain = chain.catch(function () {
            return loadScript(url).then(function () {
              if (!global.cloudbase) throw new Error("脚本已加载但 cloudbase 未定义");
            });
          });
        });
        return chain.catch(function () {
          throw new Error("云开发 SDK 加载失败，请检查网络后重试。");
        });
      })();
    }
    return loadTask;
  }

  function ensureApp() {
    if (!CFG.ENV_ID) {
      return Promise.reject(new Error("尚未配置云开发环境（js/config.js 里的 ENV_ID 为空）"));
    }
    return ensureSDK().then(function () {
      if (!app) {
        // region 跟着环境走。控制台的接入指引示例里也明确传了它，
        // 环境不在默认地域时不传会连错地方，所以宁可显式传。
        var opts = { env: CFG.ENV_ID };
        if (CFG.REGION) opts.region = CFG.REGION;
        app = global.cloudbase.init(opts);
      }
      return app;
    });
  }

  /** 匿名登录：上传附件需要一个身份。
      云存储目录权限设成「仅创建者可读写」，所以别人拿到 fileID 也读不到别人的简历。 */
  function ensureAnon() {
    return ensureApp().then(function (a) {
      var auth = a.auth({ persistence: "local" });
      if (!anonTask) {
        if (typeof auth.signInAnonymously === "function") {
          anonTask = auth.signInAnonymously();
        } else if (typeof auth.anonymousAuthProvider === "function") {
          anonTask = auth.anonymousAuthProvider().signIn();
        } else {
          anonTask = Promise.reject(new Error("当前 SDK 不支持匿名登录"));
        }
      }
      return anonTask.then(function () { return a; });
    });
  }

  /** 生成随机文件名，避免用原始文件名（可能含中文、空格、甚至路径） */
  function randomName(ext) {
    var s = "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    for (var i = 0; i < 16; i++) out += s.charAt(Math.floor(Math.random() * s.length));
    return out + ext;
  }

  global.AixiCloud = {

    isConfigured: function () { return !!CFG.ENV_ID; },

    /**
     * 上传简历附件。
     * @param {File} file
     * @param {string} formType  'recruit' | 'anniversary'，用于分目录
     * @param {function(number)} onProgress  0~100
     * @returns {Promise<string>} fileID
     */
    uploadResume: function (file, formType, onProgress) {
      var dot = file.name.lastIndexOf(".");
      var ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
      var year = new Date().getFullYear();
      var path = "resumes/" + formType + "/" + year + "/" + randomName(ext);

      return ensureAnon().then(function (a) {
        return a.uploadFile({
          cloudPath: path,
          filePath: file,
          onUploadProgress: function (e) {
            if (onProgress && e && e.total) {
              onProgress(Math.round(e.loaded * 100 / e.total));
            }
          }
        });
      }).then(function (res) {
        if (!res || !res.fileID) throw new Error("上传没有返回 fileID");
        return res.fileID;
      });
    },

    /** 后台上传简历模板。用的是管理员自己的登录身份 ——
        模板不是谁的隐私，但存储桶权限是「仅创建者及管理员可读写」，
        所以下载链接仍然要由云函数临时换取（见 getPublic）。 */
    uploadTemplate: function (file, onProgress) {
      var dot = file.name.lastIndexOf(".");
      var ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
      var path = "templates/" + randomName(ext);
      return ensureApp().then(function (a) {
        return a.uploadFile({
          cloudPath: path,
          filePath: file,
          onUploadProgress: function (e) {
            if (onProgress && e && e.total) onProgress(Math.round(e.loaded * 100 / e.total));
          }
        });
      }).then(function (res) {
        if (!res || !res.fileID) throw new Error("上传没有返回 fileID");
        return res.fileID;
      });
    },

    /** 后台管理员登录（邮箱 + 密码），返回可传给云函数的票据 */
    adminLogin: function (email, password) {
      return ensureApp().then(function (a) {
        var auth = a.auth({ persistence: "local" });
        return auth.signIn({ username: email, password: password });
      }).then(function () {
        return app.auth().getAccessToken();
      }).then(function (r) {
        return (r && r.accessToken) || "";
      });
    },

    /**
     * 注册后台账号。只在第一次部署时用一次。
     * 云开发的邮箱注册会先发一封验证邮件，点了链接才能设密码并登录 ——
     * 所以这里成功后要提示去收邮件，别让人以为注册完就能直接登录。
     * 前提：控制台「登录方式」里已开启「邮箱登录」。
     */
    /**
     * 注册后台账号。只在第一次部署时用一次。
     * 密码必须当场提供 —— SDK 不接受空密码（之前传 undefined 会报
     * INVALID_PARAMS: password must be a string）。
     * 注册后云开发会发一封验证邮件，点了链接账号才激活。
     * 前提：控制台「身份认证 → 登录方式」里已开启「邮箱登录」。
     */
    adminSignUp: function (email, password) {
      if (!password || typeof password !== "string") {
        return Promise.reject(new Error("请先填写密码再点注册（至少 8 位，含字母和数字）。"));
      }
      if (password.length < 8) {
        return Promise.reject(new Error("密码太短了，至少 8 位。"));
      }
      return ensureApp().then(function (a) {
        var auth = a.auth();
        if (typeof auth.signUpWithEmailAndPassword !== "function") {
          throw new Error("当前 SDK 不支持邮箱注册，请在云开发控制台「身份认证 → 用户管理」里直接新建用户。");
        }
        return auth.signUpWithEmailAndPassword(email, password);
      });
    },

    /**
     * 本人改密码（要验旧密码）。
     * 账号是领队组统一建的、发的是同一个临时密码，所以必须留一个自助修改的口子 ——
     * 临时密码一旦在群里传开，报名者的手机号和简历就跟着漏。
     * SDK 内部会先用旧密码换 sudo_token 再改，所以旧密码错了这里就会失败，
     * 不存在「随便填个旧密码也能改掉」的情况。
     */
    adminChangePassword: function (oldPassword, newPassword) {
      if (!oldPassword || !newPassword) {
        return Promise.reject(new Error("请把当前密码和新密码都填上。"));
      }
      if (newPassword === oldPassword) {
        return Promise.reject(new Error("新密码和当前密码一样，等于没改。"));
      }
      return ensureApp().then(function (a) {
        var user = a.auth().currentUser;
        if (!user || typeof user.updatePassword !== "function") {
          throw new Error("登录态已经失效，请退出后重新登录再改。");
        }
        /* 注意参数顺序：新密码在前、旧密码在后（SDK 就是这么定的，很容易写反） */
        return user.updatePassword(newPassword, oldPassword);
      });
    },

    adminLogout: function () {
      if (!app) return Promise.resolve();
      return app.auth().signOut().catch(function () { });
    },

    /** 通过 SDK 直接调云函数（后台用；比 HTTP 少配一层，且自带登录态） */
    callFunction: function (name, data) {
      return ensureApp().then(function (a) {
        return a.callFunction({ name: name, data: data });
      }).then(function (r) {
        var out = r && r.result;
        if (!out || out.ok !== true) throw new Error((out && out.error) || "云函数调用失败");
        return out.data;
      });
    }
  };
})(window);
