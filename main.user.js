// ==UserScript==
// @name         GitHub 中文插件 Gitee
// @namespace    https://github.com/buiawpkgew1/github-chinese
// @description  中文化 GitHub 界面的部分菜单及内容。
// @copyright    2021, buiawpkgew1
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @version      1.9.3-2024-08-22
// @author       沙漠之子
// @license      GPL-3.0
// @match        https://github.com/*
// @match        https://skills.github.com/*
// @match        https://gist.github.com/*
// @match        https://www.githubstatus.com/*
// @require      https://raw.githubusercontent.com/maboloshi/github-chinese/new_json/conf.js?v1.9.2
// @require      https://raw.githubusercontent.com/maboloshi/github-chinese/new_json/locals-zh-CN.js?v1.9.2
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_notification
// @connect      fanyi.iflyrec.com
// @supportURL   https://github.com/buiawpkgew1/github-chinese/issues
// ==/UserScript==

(function (window, document, undefined) {
    'use strict';

    const lang = 'zh'; // 设置默认语言
    let enable_RegExp = GM_getValue("enable_RegExp", 1),
        page = false,
        cachedPage = null,
        characterData = null,
        ignoreMutationSelectors = [],
        ignoreSelectors = [],
        tranSelectors = [],
        regexpRules = [];

    I18N.zh["pubilc"].regexp =  [ // 正则翻译
        /**
         * 匹配时间格式
         *
         * 月 日 或 月 日, 年
         * Mar 19, 2015 – Mar 19, 2016
         * January 26 – March 19
         * March 26
         *
         * 不知道是否稳定, 暂时先试用着. 2016-03-19 20:46:45
         *
         * 更新于 2021-10-04 15:19:18
         * 增加 带介词 on 的格式，on 翻译不体现
         * on Mar 19, 2015
         * on March 26
         *
         * 更新于 2021-10-10 13:44:36
         * on 星期(简写), 月 日 年  // 个人访问令牌 有效期
         * on Tue, Nov 9 2021
         *
         * 2021-10-19 12:04:19 融合更多规则
         *
         * 4 Sep
         * 30 Dec 2020
         *
         * on 4 Sep
         * on 30 Dec 2020
         *
         * 2021-11-22 12:51:57 新增 格式
         *
         * 星期(全称), 月 日, 年 // 仓库-->洞察-->流量 图示标识
         * Sunday, November 14, 2021
         *
         * 更新于 2023-07-04 13:19:21
         * 新增前缀词, 减少二次组织翻译
         *  Updated Jul 4            // 仪表板页面 仓库标签卡
         *  Commits on Jul 4, 2023   // 提交页面、仓库拉取请求页->提交卡
         *  Joined on Jul 4, 2023    // 追星者，关注者页面
         *
         * 更像于 2023-11-11 16:48:02
         * 个人资料页->贡献卡
         * 日期带后缀
         *
         * Tip:
         * 正则中的 ?? 前面的字符 重复0次或1次
         * 正则中的 ?: 非捕获符号(即关闭圆括号的捕获能力) 使用方法 (?: 匹配规则) -->该匹配不会被捕获 为 $数字
         */
        [/(^Updated |^Commits on |^Joined on |on |)(?:(\d{1,2}) |)(?:(Sun(?:day)?|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?), |)(?:(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May(?:)??|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:,? |$))(\d{4}|)(?:(\d{1,2})(?:st.|nd.|rd.|th.)?|)(?:,? (\d{4})|)/g,
            function (all, prefix, date1, week, month, year1, date2, year2) {
                const prefixKey = { "Updated ": "更新于 ", "Commits on ": "提交于 ", "Joined on ": "加入于 ", };
                const weekKey = { "Sun": "周日", "Mon": "周一", "Tue": "周二", "Wed": "周三", "Thu": "周四", "Fri": "周五", "Sat": "周六" };
                const monthKey = { "Jan": "1月", "Feb": "2月", "Mar": "3月", "Apr": "4月", "May": "5月", "Jun": "6月", "Jul": "7月", "Aug": "8月", "Sep": "9月", "Oct": "10月", "Nov": "11月", "Dec": "12月" };
                let date = date1 ? date1 : date2;
                let year = year1 ? year1 : year2;
                return (prefixKey[prefix] ? prefixKey[prefix] : '') + (year ? year + '年' : '') + monthKey[month.substring(0, 3)] + (date ? date + '日' : '') + (week ? ', ' + weekKey[week.substring(0, 3)] : '');
            }
        ],
        /**
         * 相对时间格式处理
         *
         * 更新于 2021-11-21 16:47:14
         * 1. 添加 前缀词
         *    over xxx ago // 里程碑页面 最后更新时间
         *    about xxx ago // 里程碑页面 最后更新时间
         *    almost xxx ago // 里程碑页面 最后更新时间
         *    less than xxx ago // 导出账户数据
         * 2. xxx之内的相对时间格式
         *  in 6 minutes // 拉取请求页面
         *
         * 更新于 2021-11-22 11:54:30
         * 1. 修复 Bug: 意外的扩大了匹配范围(不带前缀与后缀的时间) 干扰了带有相对时间的其他规则
         *  7 months
         */
        [/^just now|^now|^last month|^yesterday|(?:(over|about|almost|in) |)(an?|\d+)(?: |)(second|minute|hour|day|month|year)s?( ago|)/,
            function (all, prefix, count, unit, suffix) {
                const timeKey = { 'now': '现在', 'just now': '刚刚', 'last month': '上个月', 'yesterday': '昨天' };
                const unitKey = { second: '秒', minute: '分钟', hour: '小时', day: '天', month: '个月', year: '年' };
                if (timeKey[all]) return timeKey[all];
                if (count[0] === 'a') count = '1';// a, an 修改为 1
                if (suffix) {
                    return (prefix === 'about' || prefix === 'almost' ? '大约 ' : prefix === 'less than' ? '不到 ' : '') + count + ' ' + unitKey[unit] + (prefix === 'over' ? '多之前' : '之前');
                } else {
                    return count + ' ' + unitKey[unit] + (prefix === 'in' ? '之内' : '之前');
                }
            }
        ],
        /**
         * 匹配时间格式 2
         *
         * in 5m 20s
         */
        [/^(?:(in) |)(?:(\d+)m |)(\d+)s/,
            function (all, prefix, minute, second) {
                all = minute ? minute + '分' + second + '秒' : second + '秒';
                return (prefix ? all + '之内' : all);
            }
        ],

        // 其他翻译
        [/to enable two-factor authentication as an additional security measure. Your activity on GitHub includes you in this requirement. You will need to enable two-factor authentication on your account before ([^ ]+), or be restricted from account actions./, "启用双因素身份验证（2FA）作为额外安全措施。您在 GitHub 上的活动让您接收到此要求。您将需要在 $1 前启用双因素身份验证，否则会被限制账户操作。"],
    ];

    function updateConfig(page) {
        const { characterDataPage, ignoreMutationSelectorPage, ignoreSelectorPage } = I18N.conf; // 获取配置
        if (cachedPage === page) return; // 如果页面类型没有变化，直接返回
        cachedPage = page; // 更新缓存的页面类型

        characterData = characterDataPage.includes(page); // 更新是否处理文本节点
        ignoreMutationSelectors = ignoreMutationSelectorPage['*'].concat(ignoreMutationSelectorPage[page] || []); // 更新忽略的突变元素选择器
        ignoreSelectors = ignoreSelectorPage['*'].concat(ignoreSelectorPage[page] || []); // 更新忽略的元素选择器
        tranSelectors = (I18N[lang][page]?.selector || []).concat(I18N[lang]['public'].selector || []); // 更新通过 CSS 选择器翻译的规则
        regexpRules = (I18N[lang][page].regexp || []).concat(I18N[lang]['public'].regexp || []); // 更新正则翻译规则
    }

    /**
     * 初始化页面
     * @returns {string|boolean} 当前页面的类型
     */
    function initPage() {
        const page = getPage(); // 获取当前页面的类型
        updateConfig(page); // 更新配置
        return page; // 返回页面类型
    }

    /**
     * 监视页面变化，根据变化的节点进行翻译
     */
    function watchUpdate() {
        const MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver; // 检测浏览器是否支持 MutationObserver
        let previousURL = location.href; // 缓存当前页面的 URL

        new MutationObserver(mutations => {
            const currentURL = location.href; // 获取当前页面的 URL
            if (currentURL !== previousURL) { // 如果页面的 URL 发生变化
                previousURL = currentURL; // 更新缓存的 URL
                page = initPage(); // 重新初始化页面
                console.log(`DOM变化触发: 链接变化 page= ${page}`); // 打印日志
            }

            if (page) { // 如果页面类型有效
                const filteredMutations = mutations.flatMap(({ target, addedNodes, type }) => {
                    let nodes = [];
                    if (type === 'childList' && addedNodes.length > 0) { // 如果是节点增加的突变
                        nodes = Array.from(addedNodes); // 将新增节点转换为数组
                    } else if (type === 'attributes' || (characterData && type === 'characterData')) { // 如果是属性或文本节点的突变
                        nodes = [target]; // 仅处理目标节点
                    }

                    return nodes.filter(node => !ignoreMutationSelectors.some(selector => node.parentElement?.closest(selector))); // 筛选忽略的突变节点
                });

                filteredMutations.forEach(node => traverseNode(node)); // 处理每个变化
            }
        }).observe(document.body, { // 监听 document.body 下 DOM 变化
            characterData: true,
            subtree: true,
            childList: true,
            attributeFilter: ['value', 'placeholder', 'aria-label', 'data-confirm'], // 仅观察特定属性变化
        });
    }

    /**
     * 遍历指定的节点，并对节点进行翻译
     * @param {Node} node - 需要遍历的节点
     */
    function traverseNode(node) {
        if (ignoreSelectors.some(selector => node.matches?.(selector))) return; // 跳过忽略的节点

        if (node.nodeType === Node.ELEMENT_NODE) { // 如果是元素节点
            switch (node.tagName) {
                case "RELATIVE-TIME": // 翻译时间元素
                    transTimeElement(node.shadowRoot);
                    return;
                case "INPUT":
                case "TEXTAREA": // 输入框 按钮 文本域
                    if (['button', 'submit', 'reset'].includes(node.type)) {
                        transElement(node.dataset, 'confirm'); // 翻译 浏览器 提示对话框
                        transElement(node, 'value');
                    } else {
                        transElement(node, 'placeholder');
                    }
                    break;
                case "BUTTON":
                    if (/tooltipped/.test(node.className)) transElement(node, 'ariaLabel'); // 翻译 浏览器 提示对话框
                    transElement(node, 'title'); // 翻译 浏览器 提示对话框
                    transElement(node.dataset, 'confirm'); // 翻译 浏览器 提示对话框 ok
                    transElement(node.dataset, 'confirmText'); // 翻译 浏览器 提示对话框 ok
                    transElement(node.dataset, 'confirmCancelText'); // 取消按钮 提醒
                    transElement(node, 'cancelConfirmText'); // 取消按钮 提醒
                    transElement(node.dataset, 'disableWith'); // 按钮等待提示
                    break;
                case "OPTGROUP":
                    transElement(node, 'label'); // 翻译 <optgroup> 的 label 属性
                    break;
                case "A":
                    transElement(node, 'title'); // title 属性
                    break;
                default:
                    if (/tooltipped/.test(node.className)) transElement(node, 'ariaLabel'); // 带提示的元素，类似 tooltip 效果的
            }

            node.childNodes.forEach(child => traverseNode(child)); // 遍历子节点
        } else if (node.nodeType === Node.TEXT_NODE && node.length <= 500) { // 如果是文本节点且长度小于等于 500
            transElement(node, 'data'); // 翻译文本节点
        }
    }

    /**
     * 获取页面的类型
     * @param {URL object} url - 需要分析的 URL
     * @returns {string|boolean} 页面的类型，如果无法确定类型，那么返回 false
     */
    function getPage(url = window.location) {
        const siteMapping = {
            'gist.github.com': 'gist',
            'www.githubstatus.com': 'status',
            'skills.github.com': 'skills'
        };
        const site = siteMapping[url.hostname] || 'github'; // 获取站点类型
        const pathname = url.pathname; // 获取路径名

        const isLogin = document.body.classList.contains("logged-in"); // 是否登录
        const analyticsLocation = document.head.querySelector('meta[name="analytics-location"]')?.content || ''; // 获取 analytics-location

        const isOrganization = /\/<org-login>/.test(analyticsLocation) || /^\/(?:orgs|organizations)/.test(pathname); // 是否是组织页面
        const isRepository = /\/<user-name>\/<repo-name>/.test(analyticsLocation); // 是否是仓库页面
        const isProfile = document.body.classList.contains("page-profile") || analyticsLocation === '/<user-name>'; // 是否是个人资料页面
        const isSession = document.body.classList.contains("session-authentication"); // 是否是会话页面

        const { rePagePathRepo, rePagePathOrg, rePagePath } = I18N.conf; // 获取页面路径的正则表达式
        let t, page = false;

        if (isSession) {
            page = 'session-authentication';
        } else if (site === 'gist' || site === 'status' || site === 'skills') {
            page = site;
        } else if (isProfile) {
            t = url.search.match(/tab=([^&]+)/);
            page = t ? 'page-profile/' + t[1] : pathname.includes('/stars') ? 'page-profile/stars' : 'page-profile';
        } else if (pathname === '/' && site === 'github') {
            page = isLogin ? 'page-dashboard' : 'homepage';
        } else if (isRepository) {
            t = pathname.match(rePagePathRepo);
            page = t ? 'repository/' + t[1] : 'repository';
        } else if (isOrganization) {
            t = pathname.match(rePagePathOrg);
            page = t ? 'orgs/' + (t[1] || t.slice(-1)[0]) : 'orgs';
        } else {
            t = pathname.match(rePagePath);
            page = t ? (t[1] || t.slice(-1)[0]) : false;
        }

        if (!page || !I18N[lang][page]) { // 如果页面类型无效或词库节点不存在
            console.log(`请注意对应 page ${page} 词库节点不存在`);
            page = false;
        }
        return page;
    }

    /**
     * 翻译页面标题
     */
    function transTitle() {
        const text = document.title; // 获取标题文本内容
        let translatedText = I18N[lang]['title']['static'][text] || ''; // 尝试获取静态翻译
        if (!translatedText) { // 如果没有静态翻译
            const res = I18N[lang]['title'].regexp || []; // 获取正则翻译规则
            for (let [a, b] of res) {
                translatedText = text.replace(a, b); // 尝试正则翻译
                if (translatedText !== text) break; // 如果翻译成功，跳出循环
            }
        }
        document.title = translatedText; // 更新页面标题
    }

    /**
     * 翻译时间元素文本内容
     * @param {Element} el - 需要翻译的元素
     */
    function transTimeElement(el) {
        const text = el.childNodes.length > 0 ? el.lastChild.textContent : el.textContent; // 获取文本内容
        const res = I18N[lang]['public']['time-regexp']; // 获取时间正则规则

        for (let [a, b] of res) {
            const translatedText = text.replace(a, b); // 尝试正则翻译
            if (translatedText !== text) { // 如果翻译成功
                el.textContent = translatedText; // 更新文本内容
                break; // 跳出循环
            }
        }
    }

    /**
     * 翻译指定元素的文本内容或属性
     * @param {Element|DOMStringMap} el - 需要翻译的元素或元素的数据集 (node.dataset)
     * @param {string} field - 需要翻译的属性名称或文本内容字段
     */
    function transElement(el, field) {
        const text = el[field]; // 获取需要翻译的文本
        if (!text) return; // 当 text 为空时，退出函数

        const translatedText = transText(text); // 翻译后的文本
        if (translatedText) { // 如果翻译成功
            el[field] = translatedText; // 替换翻译后的内容
        }
    }

    /**
     * 翻译文本内容
     * @param {string} text - 需要翻译的文本内容
     * @returns {string|boolean} 翻译后的文本内容，如果没有找到对应的翻译，那么返回 false
     */
    function transText(text) {
        if (/^[\s0-9]*$/.test(text) || /^[\u4e00-\u9fa5]+$/.test(text) || !/[a-zA-Z,.]/.test(text)) return false; // 判断是否需要跳过翻译

        const trimmedText = text.trim(); // 去除首尾空格
        const cleanedText = trimmedText.replace(/\xa0|[\s]+/g, ' '); // 去除多余空白字符

        const translatedText = fetchTranslatedText(cleanedText); // 尝试获取翻译结果
        if (translatedText && translatedText !== cleanedText) { // 如果找到翻译并且不与清理后的文本相同
            return text.replace(trimmedText, translatedText); // 替换原字符，保留首尾空白部分
        }

        return false;
    }

    /**
     * 从特定页面的词库中获得翻译文本内容
     * @param {string} text - 需要翻译的文本内容
     * @returns {string|boolean} 翻译后的文本内容，如果没有找到对应的翻译，那么返回 false
     */
    function fetchTranslatedText(text) {
        let translatedText = I18N[lang][page]['static'][text] || I18N[lang]['public']['static'][text]; // 尝试获取静态翻译

        if (typeof translatedText === 'string') { // 如果找到静态翻译
            return translatedText;
        }

        if (enable_RegExp) { // 如果启用正则翻译
            for (let [a, b] of regexpRules) {
                translatedText = text.replace(a, b); // 尝试正则翻译
                if (translatedText !== text) { // 如果翻译成功
                    return translatedText;
                }
            }
        }

        return false; // 没有翻译条目
    }

    /**
     * 为指定的元素添加一个翻译按钮，并为该按钮添加点击事件
     * @param {string} selector - CSS选择器，用于选择需要添加翻译按钮的元素
     */
    function transDesc(selector) {
        const element = document.querySelector(selector); // 使用 CSS 选择器选择元素
        if (!element || document.getElementById('translate-me')) return false; // 如果元素不存在 或者 translate-me 元素已存在，那么直接返回

        const buttonHTML = `<div id='translate-me' style='color: rgb(27, 149, 224); font-size: small; cursor: pointer'>翻译</div>`; // 定义翻译按钮的 HTML
        element.insertAdjacentHTML('afterend', buttonHTML); // 在元素后面插入一个翻译按钮
        const button = element.nextSibling; // 获取翻译按钮元素

        button.addEventListener('click', () => { // 为翻译按钮添加点击事件
            const descText = element.textContent.trim(); // 获取元素的文本内容
            if (!descText) return false; // 如果文本内容为空，那么直接返回

            transDescText(descText, translatedText => { // 调用 transDescText 函数进行翻译
                button.style.display = "none"; // 翻译完成后，隐藏翻译按钮
                const translatedHTML = `<span style='font-size: small'>由 <a target='_blank' style='color:rgb(27, 149, 224);' href='https://fanyi.iflyrec.com/text-translate'>讯飞听见</a> 翻译👇</span><br/>${translatedText}`; // 定义翻译结果的 HTML
                element.insertAdjacentHTML('afterend', translatedHTML); // 在元素后面插入翻译结果
            });
        });
    }

    /**
     * 将指定的文本发送到讯飞的翻译服务进行
     * 将指定的文本发送到讯飞的翻译服务进行翻译
     * @param {string} text - 需要翻译的文本
     * @param {function} callback - 翻译完成后的回调函数，该函数接受一个参数，即翻译后的文本
     */
    function transDescText(text, callback) {
        GM_xmlhttpRequest({
            method: "POST", // 请求方法为 POST
            url: "https://fanyi.iflyrec.com/TJHZTranslationService/v2/textAutoTranslation", // 请求的 URL
            headers: {
                'Content-Type': 'application/json', // 请求头部的内容类型
                'Origin': 'https://fanyi.iflyrec.com', // 请求的来源
            },
            data: JSON.stringify({ // 请求的数据
                "from": 2,
                "to": 1,
                "type": 1,
                "contents": [{
                    "text": text // 翻译的内容
                }]
            }),
            responseType: "json", // 响应的数据类型为 JSON
            onload: (res) => {
                try {
                    const { status, response } = res; // 解构响应结果
                    const translatedText = (status === 200) ? response.biz[0].sectionResult[0].dst : "翻译失败"; // 检查状态码并获取翻译结果
                    callback(translatedText); // 执行回调函数，传递翻译结果
                } catch (error) {
                    console.error('翻译失败', error); // 输出错误信息
                    callback("翻译失败"); // 回调翻译失败信息
                }
            },
            onerror: (error) => {
                console.error('网络请求失败', error); // 输出网络错误信息
                callback("网络请求失败"); // 回调网络请求失败信息
            }
        });
    }

    /**
     * 通过 CSS 选择器找到页面上的元素，并将其文本内容替换为预定义的翻译
     */
    function transBySelector() {
        if (tranSelectors.length > 0) {
            // 遍历每个翻译规则
            for (let [selector, translatedText] of tranSelectors) {
                const element = document.querySelector(selector); // 使用选择器找到对应的元素
                if (element) {
                    element.textContent = translatedText; // 将元素文本内容替换为翻译后的文本
                }
            }
        }
    }

    /**
     * 注册菜单命令
     */
    function registerMenuCommand() {
        // 切换正则表达式功能的函数
        const toggleRegExp = () => {
            enable_RegExp = !enable_RegExp; // 切换正则表达式的启用状态
            GM_setValue("enable_RegExp", enable_RegExp); // 更新配置
            GM_notification(`已${enable_RegExp ? '开启' : '关闭'}正则功能`); // 显示通知
            if (enable_RegExp) {
                location.reload(); // 如果开启正则，刷新页面
            }
            GM_unregisterMenuCommand(id); //注销旧的菜单命令
            id = GM_registerMenuCommand(`${enable_RegExp ? '关闭' : '开启'}正则功能`, toggleRegExp); //注册新菜单命令
        };

        let id = GM_registerMenuCommand(`${enable_RegExp ? '关闭' : '开启'}正则功能`, toggleRegExp); // 注册初始菜单命令
    }

    /**
     * 初始化翻译功能
     */
    function init() {
        page = initPage(); // 初始化页面
        console.log(`开始page= ${page}`); // 打印日志

        if (page) traverseNode(document.body); // 如果页面类型有效，遍历整个页面以进行翻译
        watchUpdate(); // 监视页面变化
    }

    // 设置中文环境
    document.documentElement.lang = 'zh-CN';

    // 监测 HTML Lang 值, 设置中文环境
    new MutationObserver(mutations => {
        if (document.documentElement.lang === "en") {
            document.documentElement.lang = 'zh-CN'; // 如果 lang 属性为 en，设置为 zh-CN
        }
    }).observe(document.documentElement, {
        attributeFilter: ['lang'] // 仅观察 lang 属性的变化
    });

    // 监听 Turbo 完成事件
    document.addEventListener('turbo:load', () => {
        if (page) { // 如果页面类型有效
            transTitle(); // 翻译页面标题
            transBySelector(); // 通过选择器翻译文本
            if (page === "repository") { // 如果是仓库页面，翻译仓库简介
                transDesc(".f4.my-3");
            } else if (page === "gist") { // 如果是 Gist 页面，翻译 Gist 简介
                transDesc(".gist-content [itemprop='about']");
            }
        }
    });

    // 初始化菜单
    registerMenuCommand();

    // 在页面初始加载完成时执行
    window.addEventListener('DOMContentLoaded', init);

})(window, document);
