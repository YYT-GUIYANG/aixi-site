/* ==========================================================================
   报名表字段定义
   要加/删/改问题，只改这个文件，不用碰 forms.js 和 apply.html。

   字段属性：
     key        存进数据库的字段名，只用英文和下划线
     label      显示给报名者的问题
     type       text | email | tel | textarea | select | radio | checkbox | number | file | agree
     required   是否必填
     help       问题下方的灰色说明
     options    select / radio 的选项
     maxlength  文本长度上限（云函数会再校验一遍，前端这层只是提前提示）
     value      默认值

   一条原则：只收真的会用到的信息。多问一个字段，就多一份要保管的个人信息，
   也多一个报名者中途放弃的理由。
   ========================================================================== */

window.AIXI_SCHEMAS = {

  /* ===================== 招新报名 ===================== */
  recruit: {
    title: "队员招新报名",
    subtitle: "RECRUITMENT",
    intro: "填写基本信息并上传简历，带 * 的是必填项。提交后你会拿到一个凭证码，凭「邮箱 + 凭证码」可以随时回来<strong>查看进度、修改内容、替换简历</strong>。提交完成后请按页面下方的提示领取报名表并加入招新群。",
    submitText: "提交报名",
    groups: [
      {
        name: "基本信息",
        fields: [
          { key: "name", label: "姓名", type: "text", required: true, maxlength: 20 },
          {
            key: "gender", label: "性别", type: "radio", required: false,
            options: ["女", "男"],
            help: "只用于支教期间的住宿安排，可以不填。"
          },
          {
            key: "school", label: "学校", type: "text", required: true, maxlength: 40,
            value: "华南理工大学"
          },
          { key: "college", label: "学院", type: "text", required: true, maxlength: 40 },
          { key: "major", label: "专业", type: "text", required: false, maxlength: 40 },
          {
            key: "grade", label: "年级", type: "select", required: true,
            options: ["大一", "大二", "大三", "大四", "研究生", "其他"]
          }
        ]
      },
      {
        name: "联系方式",
        fields: [
          {
            key: "email", label: "邮箱", type: "email", required: true, maxlength: 60,
            help: "面试通知和录取结果都会发到这个邮箱，请填写常用且能收到信的地址。"
          },
          { key: "phone", label: "手机号", type: "tel", required: true, maxlength: 11 },
          { key: "wechat", label: "微信号", type: "text", required: true, maxlength: 40,
            help: "用于拉入面试群，请填微信号而不是昵称。" }
        ]
      },
      {
        name: "简历",
        fields: [
          {
            key: "resume", label: "上传简历", type: "file", required: false,
            help: "选填。支持 PDF、Word（.doc/.docx）、JPG、PNG，单个文件不超过 20MB。推荐 PDF —— 别的机器打开时排版不会跑掉。提交后仍可到「查询进度」页面替换。"
          }
        ]
      }
    ],
    agree: {
      key: "agree",
      required: true,
      text: '我已阅读并同意 <a href="privacy.html" target="_blank" rel="noopener">《爱西支教协会隐私声明》</a>，同意爱西在招新选拔范围内使用我填写的信息。'
    }
  },

  /* ===================== 周年庆报名 ===================== */
  anniversary: {
    title: "周年庆报名",
    subtitle: "ANNIVERSARY",
    intro: "无论你是哪一届的队员，都欢迎回来。填完这张表我们才好安排场地和餐食。",
    submitText: "提交报名",
    groups: [
      {
        name: "你是谁",
        fields: [
          { key: "name", label: "姓名", type: "text", required: true, maxlength: 20 },
          {
            key: "joinYear", label: "入队年份", type: "text", required: true, maxlength: 20,
            help: "填你加入爱西的那一年，例如 2023。"
          },
          {
            key: "identity", label: "身份", type: "select", required: true,
            options: ["历届队员", "现役队员", "历届领队", "老师 / 校友", "其他"]
          }
        ]
      },
      {
        name: "联系方式",
        fields: [
          { key: "email", label: "邮箱", type: "email", required: true, maxlength: 60,
            help: "活动的具体安排会发到这个邮箱。" },
          { key: "phone", label: "手机号", type: "tel", required: true, maxlength: 11 }
        ]
      },
      {
        name: "到场安排",
        fields: [
          {
            key: "attend", label: "能否到场", type: "radio", required: true,
            options: ["能到场", "还不确定", "不能到场，但想收到回顾"]
          },
          {
            key: "companions", label: "随行人数", type: "number", required: false,
            help: "除你本人以外还会来几位？不带人就填 0 或留空。"
          },
          { key: "meal", label: "饮食忌口", type: "text", required: false, maxlength: 60,
            help: "过敏、素食、不吃辣等，都写在这里。" },
          {
            key: "words", label: "想对爱西说的话", type: "textarea", required: false, maxlength: 1000,
            help: "选填。我们会整理出来，放进当天的回顾里。"
          }
        ]
      }
    ],
    agree: {
      key: "agree",
      required: true,
      text: '我已阅读并同意 <a href="privacy.html" target="_blank" rel="noopener">《爱西支教协会隐私声明》</a>。'
    }
  },

  /* ===================== 未开放时的「预约提醒」 ===================== */
  remind: {
    title: "预约开放提醒",
    subtitle: "NOTIFY ME",
    intro: "留一个邮箱，报名开放的那天我们发信告诉你。只用来发这一封通知，不会用作别的用途。",
    submitText: "提醒我",
    groups: [
      {
        name: "",
        fields: [
          { key: "name", label: "怎么称呼你", type: "text", required: false, maxlength: 20 },
          { key: "email", label: "邮箱", type: "email", required: true, maxlength: 60 }
        ]
      }
    ],
    agree: {
      key: "agree",
      required: true,
      text: '我同意爱西保存这个邮箱，用于发送报名开放通知（详见 <a href="privacy.html" target="_blank" rel="noopener">隐私声明</a>）。'
    }
  }
};
