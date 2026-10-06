/* ==========================================================================
   ICP 备案号

   备案通过后，工信部要求网站首页底部显示备案号，并链接到 beian.miit.gov.cn。
   这是硬性要求，不是可选项 —— 少了它，年检或者被举报时会被要求整改。

   号码存在后台（site_config.icp_number），拿到号填一下就生效，不用改代码，
   也不用等谁来部署。没填就整块不显示 —— 备案下来之前页面上不该出现一个空壳。
   ========================================================================== */

(function (global) {
  "use strict";

  function render(num) {
    num = String(num || "").trim();
    if (!num) return;
    var slots = document.querySelectorAll("[data-icp]");
    if (!slots.length) return;
    Array.prototype.forEach.call(slots, function (el) {
      var a = document.createElement("a");
      a.href = "https://beian.miit.gov.cn/";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = num;
      a.style.color = "inherit";
      el.textContent = "　|　";
      el.appendChild(a);
    });
  }

  function start() {
    var cfg = global.AIXI_CONFIG || {};
    if (cfg.ICP) { render(cfg.ICP); return; }      // 写死在 config.js 里的优先
    if (!global.AixiApi) return;
    global.AixiApi.getPublic().then(function (data) {
      render(((data && data.config) || {}).icp_number);
    }).catch(function () { /* 读不到就不显示，不是错误 */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window);
