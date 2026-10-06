/* ==========================================================================
   首页行为
   分成两层，界线很清楚：
   - 基础层（菜单、音乐开关、读取开放状态、渲染动态卡片）纯原生，必须能独立工作；
   - 增强层（钉屏转场、横向画卷、错位入场）只在 html.has-anim 时启用。
   原来的首页把这两层混在一起，CDN 上的 GSAP 一挂，菜单按钮和荣誉墙一起废掉。
   ========================================================================== */

(function () {
  "use strict";

  var HAS_ANIM = document.documentElement.classList.contains("has-anim");
  var navbar = document.getElementById("navbar");

  /* ======================================================================
     1. 全屏菜单 —— 只靠 class 切换，不依赖任何动画库
     ====================================================================== */
  (function initMenu() {
    var btn = document.getElementById("menuToggleBtn");
    var overlay = document.getElementById("menuOverlay");
    if (!btn || !overlay) return;

    var ICON_OPEN = '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>';
    var ICON_CLOSE = '<line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>';
    var icon = document.getElementById("hamburger-icon");
    var isOpen = false;

    function setOpen(next) {
      isOpen = next;
      overlay.classList.toggle("is-open", next);
      btn.setAttribute("aria-expanded", next ? "true" : "false");
      btn.setAttribute("aria-label", next ? "关闭菜单" : "打开菜单");
      if (icon) icon.innerHTML = next ? ICON_CLOSE : ICON_OPEN;
      document.body.style.overflow = next ? "hidden" : "";

      if (next && HAS_ANIM && window.gsap) {
        // 纯装饰：链接错位入场。失败也不影响菜单可用
        window.gsap.fromTo(overlay.querySelectorAll(".menu-link"),
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: .55, stagger: .07, ease: "power3.out", clearProps: "all" });
      }
      if (next) {
        var first = overlay.querySelector(".menu-link");
        if (first) first.focus();
      }
    }

    btn.addEventListener("click", function () { setOpen(!isOpen); });

    // 点任何菜单项都关闭（含跳到别的页面的链接）
    overlay.addEventListener("click", function (e) {
      if (e.target.closest(".menu-link, .menu-img-link")) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen) { setOpen(false); btn.focus(); }
    });
  })();

  /* ======================================================================
     2. （背景音乐已挪到 js/music.js）
     原来这里是一套写死 audio/theme.mp3 的开关。改成由后台配地址、
     并且首页和「支教现场」共用一份实现 —— 两份各写各的，
     迟早会出现「首页能放、另一页放不了」这种查半天的问题。
     ====================================================================== */

  /* ======================================================================
     3. 年份自动填充 —— 免得每年手改一次页脚
     ====================================================================== */
  (function fillYear() {
    var y = new Date().getFullYear();
    Array.prototype.forEach.call(document.querySelectorAll("[data-year-now]"), function (el) {
      el.textContent = String(y);
    });
  })();

  /* ======================================================================
     4. 读取开放状态与公众号动态
     ====================================================================== */

  /** 后台录入的内容会进 innerHTML，必须转义。这是外部输入。 */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /** 文章链接只允许 http(s)，挡掉 javascript: 之类的东西 */
  function safeUrl(u) {
    var s = String(u || "").trim();
    return /^https?:\/\//i.test(s) ? s : "";
  }

  /** 封面图除了 http(s)，还允许站内相对路径（images/posts/xxx.jpg）。
      微信图床有防盗链，封面基本都得存到本地，所以必须支持相对路径。
      仍然挡掉 javascript:、data: 和跳出目录的 ../ 写法。 */
  function safeImg(u) {
    var s = String(u || "").trim();
    if (/^https?:\/\//i.test(s)) return s;
    // 站内相对路径：必须在 images/ 下，不能跳出目录，也不能带协议冒号。
    // 这里刻意用黑名单而不是 /^images\/[\w.\-\/]+$/ 那种白名单：
    // \w 不匹配中文，封面文件名叫「2026-夏令营回顾.jpg」时会被误判成不安全而丢掉封面。
    if (/^images\//i.test(s) && s.indexOf("..") < 0 && s.indexOf(":") < 0) return s;
    return "";
  }

  function renderNews(posts) {
    var wrap = document.getElementById("newsCards");
    var empty = document.getElementById("newsEmpty");
    if (!wrap || !empty) return;

    var list = (posts || []).filter(function (p) { return p && safeUrl(p.url); });
    if (!list.length) return;                 // 保持空状态，不假装有内容

    wrap.innerHTML = list.map(function (p) {
      var cover = safeImg(p.cover);
      var coverHtml = cover
        ? '<img class="card-cover" src="' + esc(cover) + '" alt="" loading="lazy">'
        : '<div class="card-cover"></div>';
      return '<a class="card" href="' + esc(safeUrl(p.url)) + '" target="_blank" rel="noopener noreferrer">'
        + coverHtml
        + '<div class="card-body">'
        + (p.date ? '<span class="card-date">' + esc(p.date) + '</span>' : '')
        + '<h3 class="card-title">' + esc(p.title || "未命名") + '</h3>'
        + '<span class="card-more">阅读原文 →</span>'
        + '</div></a>';
    }).join("");

    wrap.hidden = false;
    empty.hidden = true;

    if (HAS_ANIM && window.gsap) {
      window.gsap.from(wrap.querySelectorAll(".card"), {
        y: 24, opacity: 0, duration: .6, stagger: .08, ease: "power2.out",
        scrollTrigger: { trigger: wrap, start: "top 85%" }, clearProps: "all"
      });
    }
  }

  function applyConfig(cfg) {
    var note = document.getElementById("recruitStateNote");
    var banner = document.getElementById("contactBannerNote");
    var year = cfg.recruit_year || "2027";

    Array.prototype.forEach.call(document.querySelectorAll("[data-recruit-year]"), function (el) {
      el.textContent = year;
    });

    if (note) {
      if (cfg.recruit_open) {
        note.textContent = cfg.recruit_deadline
          ? year + " 年度招新报名进行中，截止 " + cfg.recruit_deadline
          : year + " 年度招新报名进行中";
        note.style.color = "#C8F0D8";
      } else {
        note.textContent = cfg.recruit_note || "报名暂未开放";
      }
    }

    if (banner) {
      banner.textContent = cfg.recruit_open
        ? "— 爱西 " + year + " 年度队员招新报名进行中 —"
        : "— 爱西 " + year + " 年度队员招新，每年 3 月开启 —";
    }

    // 周年庆开着的时候，在招新按钮旁边多一个入口
    if (cfg.anniversary_open) {
      var cta = document.querySelector(".recruit-cta");
      if (cta && !cta.querySelector(".anni-btn")) {
        var a = document.createElement("a");
        a.className = "btn btn-white anni-btn";
        a.href = "apply.html?form=anniversary";
        a.textContent = (cfg.anniversary_title || "周年庆") + " 报名";
        cta.insertBefore(a, cta.firstChild.nextSibling);
      }
    }

    if (window.AixiApi && window.AixiApi.isDemo) {
      var n = document.getElementById("recruitStateNote");
      if (n) n.textContent += "（演示模式：未连接云开发）";
    }
  }

  /* 文章卡片的兜底来源：数据库 posts 集合为空（或还没接云开发）时，
     读站内的 data/posts.json。这样在开通云环境之前，把推文填进那个文件就能直接显示。 */
  function loadPostsFallback() {
    return fetch("data/posts.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.posts) || []; })
      .catch(function () { return []; });
  }

  (function loadPublic() {
    var fallback = (window.AIXI_CONFIG && window.AIXI_CONFIG.FALLBACK) || {};

    function finish(cfg, posts) {
      applyConfig(cfg);
      if (posts && posts.length) { renderNews(posts); return; }
      loadPostsFallback().then(renderNews);
    }

    if (!window.AixiApi) { finish(fallback, null); return; }

    window.AixiApi.getPublic().then(function (data) {
      finish(Object.assign({}, fallback, (data && data.config) || {}), data && data.posts);
    }).catch(function (err) {
      // 读不到就用兜底文案，页面不能因为后端不可用而显示成半成品
      finish(fallback, null);
      if (window.console) console.warn("[爱西] 读取站点配置失败，已使用兜底文案：", err && err.message);
    });
  })();

  var story = document.getElementById("story");
  // 手机上横向钉屏画卷很难操作，改成正常纵向阅读；没有动效时同样走静态版
  var STORY_STATIC = !HAS_ANIM || window.innerWidth <= 900;
  if (story && STORY_STATIC) {
    story.classList.add("is-static");
    // 静态版的画卷底色始终是墨蓝；动效版会在钉屏过程中变白，所以只有静态版算深色段
    story.setAttribute("data-nav-dark", "");
  }

  /* ======================================================================
     5. 导航反白
     深色底上要把黑色字标反白。这件事原来写在 GSAP 的 ScrollTrigger 回调里，
     结果 GSAP 一挂，墨蓝底上的字标就是黑的、几乎看不见。
     它跟动画没有关系，只跟「导航栏此刻压在哪个段落上」有关，
     所以改用原生 IntersectionObserver：只观察视口顶部那条 96px 的窄带，
     哪个深色段落进入这条带子就反白。两种模式下都成立。
     ====================================================================== */
  (function initNavContrast() {
    if (!navbar || !("IntersectionObserver" in window)) return;

    var darkSections = document.querySelectorAll("[data-nav-dark]");
    if (!darkSections.length) return;

    var active = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) active.add(e.target); else active.delete(e.target);
      });
      navbar.classList.toggle("light-text", active.size > 0);
    }, {
      // 只保留顶部 96px 这条带（导航栏所在处）作为判定区
      rootMargin: "0px 0px -" + Math.max(0, window.innerHeight - 96) + "px 0px",
      threshold: 0
    });

    Array.prototype.forEach.call(darkSections, function (s) { io.observe(s); });
  })();

  /* ======================================================================
     6. 增强层：以下全部只在 has-anim 时执行
     ====================================================================== */
  if (!HAS_ANIM || !window.gsap || !window.ScrollTrigger) return;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  /* force-light 专门给「背景色是被滚动进度动画出来的」段落用，
     与 IntersectionObserver 设的 light-text 互不干扰 */
  function forceLight(on) {
    if (navbar) navbar.classList.toggle("force-light", on);
  }

  /* --- 首屏：图片缩小让位给理念层 --- */
  gsap.timeline({
    scrollTrigger: {
      trigger: "#hero", start: "top top", end: "+=150%", pin: true, scrub: 1,
      onUpdate: function (self) { forceLight(self.progress > 0.15); }
    }
  })
    .to(".hero-image-frame", { scale: .55, opacity: .3 }, 0)
    .to("#hero", { backgroundColor: "#2B2F4C" }, 0)
    .to(".philosophy-layer", { opacity: 1 }, 0)
    .fromTo(".philosophy-layer", { y: 50 }, { y: 0 }, 0)
    .to(".scroll-hint", { opacity: 0 }, 0);

  /* --- 背景滚动字幕 --- */
  gsap.to(".marquee-text", { xPercent: -50, ease: "none", duration: 20, repeat: -1 });

  /* --- 通用入场：所有 data-anim 元素 --- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-anim]'), function (el) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: .7, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%" }
    });
  });

  /* --- 荣誉墙：整组依次浮现，比逐条各自触发更整齐 --- */
  ScrollTrigger.create({
    trigger: "#awards", start: "top 72%", once: true,
    onEnter: function () {
      gsap.to("#awards .awards-list li", {
        opacity: 1, y: 0, duration: .7, stagger: .08, ease: "power2.out"
      });
    }
  });

  /* --- 历年画卷：横向钉屏（仅桌面） --- */
  if (story && !STORY_STATIC) {
    var wrapper = story.querySelector(".story-wrapper");
    gsap.timeline({
      scrollTrigger: {
        trigger: "#story", start: "top top",
        end: function () { return "+=" + (wrapper.scrollWidth - window.innerWidth); },
        pin: true, scrub: 1, invalidateOnRefresh: true,
        // 画卷底色在钉屏开头很快由墨蓝变白，所以只有开头这一小段需要反白
        onUpdate: function (self) { forceLight(self.progress <= 0.1); }
      }
    })
      .to(wrapper, {
        x: function () { return -(wrapper.scrollWidth - window.innerWidth); },
        ease: "none", duration: 1
      }, 0)
      .to("#story", { backgroundColor: "#FFFFFF", color: "#333333", ease: "none", duration: .15 }, 0);
  }

  /* --- 招新板块 ---
     招新与联系我们两段的导航反白已由 IntersectionObserver 统一处理，
     这里只留纯视觉的入场动画。 */
  gsap.timeline({ scrollTrigger: { trigger: "#recruit-details", start: "top 60%" } })
    .from(".recruit-left", { x: -80, opacity: 0, duration: 1.1, ease: "power3.out" }, 0)
    .from(".recruit-right", { x: 80, opacity: 0, duration: 1.1, ease: "power3.out" }, 0);

  /* 图片是懒加载的，加载完布局会变，必须让 ScrollTrigger 重算钉屏距离，
     否则横向画卷的滚动长度会算短，末尾几屏被吃掉。 */
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
