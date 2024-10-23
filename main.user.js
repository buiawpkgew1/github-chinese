// ==UserScript==
// @name         GitHub 中文插件 Gitee
// @namespace    https://github.com/buiawpkgew1/github-chinese
// @description  中文化 GitHub 界面的部分菜单及内容。
// @copyright    2021, buiawpkgew1
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @version      1.9.3-2024-10-18
// @author       沙漠之子
// @license      GPL-3.0
// @match        https://github.com/*
// @match        https://skills.github.com/*
// @match        https://gist.github.com/*
// @match        https://www.githubstatus.com/*
// @require      https://raw.githubusercontent.com/maboloshi/github-chinese/gh-pages/locals.js?v1.9.3-2024-10-18
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

    const lang = 'zh-CN'; // 设置默认语言
    let enable_RegExp = GM_getValue("enable_RegExp", 1), // 获取是否启用正则表达式的配置
        page = false, // 当前页面的类型
        cachedPage = null, // 缓存的页面类型
        characterData = null, // 是否处理文本节点
        ignoreMutationSelectors = [], // 忽略的突变元素选择器
        ignoreSelectors = [], // 忽略的元素选择器
        tranSelectors = [], // 通过 CSS 选择器翻译的规则
        regexpRules = []; // 正则翻译规则

    /**
     * 更新配置
     * @param {string} page - 当前页面的类型
     */
    function updateConfig(page) {
        if (cachedPage !== page && page) {
            cachedPage = page;

            const { characterDataPage, ignoreMutationSelectorPage, ignoreSelectorPage } = I18N.conf;
            characterData = characterDataPage.includes(page);
            // 忽略突变元素选择器
            ignoreMutationSelectors = ignoreMutationSelectorPage['*'].concat(ignoreMutationSelectorPage[page] || []);
            // 忽略元素选择器
            ignoreSelectors = ignoreSelectorPage['*'].concat(ignoreSelectorPage[page] || []);
            // 通过 CSS 选择器翻译的规则
            tranSelectors = (I18N[lang][page]?.selector || []).concat(I18N[lang]['public'].selector || []);
            // 正则词条
            regexpRules = (I18N[lang][page].regexp || []).concat(I18N[lang]['public'].regexp || []);
        }
    }

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
                    if (type === 'childList' && addedNodes.length > 0) {
                        nodes = Array.from(addedNodes); // 将新增节点转换为数组
                    } else if (type === 'attributes' || (characterData && type === 'characterData')) {
                        nodes = [target]; // 否则，仅处理目标节点
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
        // 跳过忽略的节点
        const skipNode = node => ignoreSelectors.some(selector => node.matches?.(selector));
        if (skipNode(node)) return;

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

        } else if (node.nodeType === Node.TEXT_NODE && node.length <= 500) { // 文本节点且长度小于等于 500
            transElement(node, 'data');
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
        const text = document.title; // 获取获取标题文本内容
        let translatedText = I18N[lang]['title']['static'][text] || ''; // 尝试获取静态翻译
        if (!translatedText) { // 如果没有静态翻译
            const res = I18N[lang]['title'].regexp || []; // 获取正则翻译规则
            for (let [a, b] of res) {
                translatedText = text.replace(a, b);
                if (translatedText !== text) break;
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
     * registerMenuCommand 函数：注册菜单。
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
    document.documentElement.lang = lang;

    // 监测 HTML Lang 值, 设置中文环境
    new MutationObserver(mutations => {
        if (document.documentElement.lang === "en") {
            document.documentElement.lang = lang; // 如果 lang 属性为 en，设置为 zh-CN
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
