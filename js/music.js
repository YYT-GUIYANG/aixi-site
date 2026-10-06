/* ==========================================================================
   背景音乐

   三条不能破的规矩：

   1. 绝不自动出声。一打开网页就放歌，在图书馆或者开会时点进来的人会被吓一跳，
      浏览器本身也会拦（没有用户操作过的页面不允许出声）。所以默认静音，
      由访客自己点开。只有他上次亲手打开过，这次才会接着放。

   2. 后台填了地址才出现。没配歌就完全不渲染按钮 ——
      放一个点了没反应的图标比没有按钮更糟。

   3. 版权是他们要担的。公开网站上放商业歌曲有风险，
      后台那一栏的说明里写清楚了，建议用无版权音乐。

   4. 换页不从头放。多页面网站每翻一页，JS 环境连同 audio 元素都会重建，
      所以要把播放到第几秒记下来，下一页接着放。

   曲子默认取 config.js 里的 MUSIC_URL（社团选定、随站点发布）；
   后台 site_config 里填了 music_url 的话以后台为准 ——
   换首歌不该需要重新部署，明年交接给下一届也是同样的道理。
   ========================================================================== */

(function (global) {
  "use strict";

  var KEY = "aixi_music_on";
  var POS_KEY = "aixi_music_pos";
  var VOLUME = 0.32;          // 背景音乐，压低一点；比说话声小才不喧宾夺主
  var FADE_MS = 500;          // 接上时淡入，接缝不至于「啪」地一下

  var audio = null;
  var btn = null;
  var wantOn = false;
  var pendingGesture = false;
  var resumeAt = 0;           // 这一页要从第几秒接着放
  var lastSaved = 0;

  function saved() {
    try { return global.localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }
  function remember(on) {
    try { global.localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* 隐私模式 */ }
  }

  /* ---- 换页续播 ----
     多页面网站每翻一页，整个 JS 环境连同 audio 元素都会被销毁重建，
     所以「不打断」只能做到「不从头开始」：把播放到第几秒记下来，
     下一页接着那个位置放。翻页的一瞬间仍会有一小段静音（页面在重建），
     要做到完全无缝就得把整站改成单页应用，那是另一回事，不值得为一首背景音乐做。

     位置写得勤一点（1 秒一次）：写得稀了，翻页时就会往回跳好几秒，
     听起来像卡带。 */
  function savePos(t) {
    try { global.localStorage.setItem(POS_KEY, String(t)); } catch (e) { /* 隐私模式 */ }
  }
  function loadPos() {
    try {
      var v = parseFloat(global.localStorage.getItem(POS_KEY) || "0");
      return (isFinite(v) && v > 0) ? v : 0;
    } catch (e) { return 0; }
  }

  /** 淡入到正常音量。直接给满音量的话，接缝处会有一下突兀的起音。 */
  function fadeIn() {
    if (!audio) return;
    var steps = 12, i = 0;
    audio.volume = 0;
    var timer = global.setInterval(function () {
      i++;
      if (!audio || i >= steps) {
        if (audio) audio.volume = VOLUME;
        global.clearInterval(timer);
        return;
      }
      audio.volume = VOLUME * (i / steps);
    }, FADE_MS / steps);
  }

  function paint() {
    if (!btn) return;
    btn.classList.toggle("is-on", wantOn);
    btn.setAttribute("aria-pressed", wantOn ? "true" : "false");
    btn.setAttribute("aria-label", wantOn ? "关闭背景音乐" : "播放背景音乐");
    btn.title = wantOn ? "关闭背景音乐" : "播放背景音乐";
  }

  function seekToResume() {
    if (!audio || !resumeAt) return;
    // 歌快放完了就从头来，不然一进页面就听到最后两秒然后循环
    var d = audio.duration;
    if (isFinite(d) && d > 0 && resumeAt >= d - 1) { resumeAt = 0; return; }
    try { audio.currentTime = resumeAt; } catch (e) { /* 还不能定位就算了 */ }
    resumeAt = 0;
  }

  function play() {
    if (!audio) return;
    if (resumeAt) {
      if (audio.readyState >= 1) seekToResume();       // 已有时长信息，直接定位
      else audio.addEventListener("loadedmetadata", seekToResume, { once: true });
    }
    fadeIn();
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function () {
        /* 浏览器要求先有一次用户操作才能出声。
           这里不报错也不弹提示 —— 挂一个一次性的监听，
           等访客随便点一下页面就接着放。 */
        if (pendingGesture) return;
        pendingGesture = true;
        var kick = function () {
          document.removeEventListener("click", kick);
          document.removeEventListener("keydown", kick);
          pendingGesture = false;
          if (wantOn && audio) audio.play().catch(function () {});
        };
        document.addEventListener("click", kick);
        document.addEventListener("keydown", kick);
      });
    }
  }

  function toggle() {
    wantOn = !wantOn;
    remember(wantOn);
    paint();
    if (wantOn) {
      audio.preload = "auto";
      play();
    } else if (audio) {
      savePos(audio.currentTime);   // 手动暂停也记住，下次接着这里放
      audio.pause();
    }
  }

  function build(src, title) {
    audio = new Audio(src);
    audio.loop = true;
    audio.preload = "none";     // 没点开就一个字节都不下，别替访客付这份流量
    audio.volume = VOLUME;
    resumeAt = loadPos();

    /* 一秒记一次播放位置。timeupdate 本身每秒会触发好几次，
       全都写 localStorage 太浪费，节流到 1 秒。 */
    audio.addEventListener("timeupdate", function () {
      var now = Date.now();
      if (now - lastSaved < 1000) return;
      lastSaved = now;
      savePos(audio.currentTime);
    });
    // 关页面/切走的那一下补记一次，否则最多会丢 1 秒
    ["pagehide", "beforeunload"].forEach(function (ev) {
      global.addEventListener(ev, function () {
        if (audio && !audio.paused) savePos(audio.currentTime);
      });
    });
    // 一首放完了，下一页从头开始，别停在结尾
    audio.addEventListener("ended", function () { savePos(0); });

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "music-btn";
    btn.innerHTML =
      '<span class="mi" aria-hidden="true">'
      + '<i></i><i></i><i></i><i></i>'
      + "</span>"
      + '<span class="mt">' + String(title || "背景音乐").slice(0, 20) + "</span>";
    btn.addEventListener("click", toggle);
    document.body.appendChild(btn);

    // 上次是开着的，这次接着放（真出声还得等浏览器点头，见 play()）
    wantOn = saved();
    paint();
    if (wantOn) {
      audio.preload = "auto";
      play();
    }
  }

  function start() {
    if (btn) return;                       // 只装一次
    var cfg = global.AIXI_CONFIG || {};

    function tryBuild(src, title) {
      src = String(src || "").trim();
      if (!src) return false;
      // 只收 http(s) 外链和站内 audio/ 目录，挡掉 javascript: 之类
      var okLocal = /^audio\//.test(src) && src.indexOf("..") < 0 && src.indexOf(":") < 0;
      if (!/^https?:\/\//i.test(src) && !okLocal) return false;
      build(src, title);
      return true;
    }

    // 先看 config.js 里写死的（本地预览用），再看后台配的
    if (tryBuild(cfg.MUSIC_URL, cfg.MUSIC_TITLE)) return;
    if (!global.AixiApi) return;
    global.AixiApi.getPublic().then(function (data) {
      var c = (data && data.config) || {};
      tryBuild(c.music_url, c.music_title);
    }).catch(function () { /* 读不到就没有音乐，不是错误 */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  global.AixiMusic = {
    toggle: toggle,
    isOn: function () { return wantOn; },
    /** 这一页打算从第几秒接着放（定位完成后归零）。自测用。 */
    resumeTarget: function () { return resumeAt; },
    /** 音频当前播到第几秒。自测用来验证「定位真的落到了媒体元素上」——
        headless 没有声卡，播放时钟不走，但定位是否生效仍然测得出来。 */
    currentTime: function () { return audio ? audio.currentTime : -1; }
  };
})(window);
