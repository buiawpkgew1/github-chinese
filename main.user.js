// ==UserScript==
// @name         GitHub 中文插件
// @namespace    https://github.com/buiawpkgew1/github-chinese
// @description  中文化 GitHub 界面的部分菜单及内容。
// @copyright    2021, buiawpkgew1
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @version      1.9.2-2024-08-11
// @author       沙漠之子
// @license      GPL-3.0
// @match        https://github.com/*
// @match        https://skills.github.com/*
// @match        https://gist.github.com/*
// @match        https://www.githubstatus.com/*
// @require      https://gitee.com/awnioow/github-chinese/raw/Fitten/locals.js?v1.9.2
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_notification
// @connect      www.iflyrec.com
// @supportURL   https://github.com/buiawpkgew1/github-chinese/issues
// ==/UserScript==

(function (window, document, undefined) {
    'use strict';

    const lang = 'zh'; // 设置默认语言
    let page;
    let enable_RegExp = GM_getValue("enable_RegExp", 1);

    /**
     * watchUpdate 函数：监视页面变化，根据变化的节点进行翻译
     */
    function watchUpdate() {
        const MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        const getCurrentURL = () => location.href;
        let previousURL = getCurrentURL();

        const observer = new MutationObserver((mutations) => {
            const currentURL = getCurrentURL();

            if (currentURL !== previousURL) {
                previousURL = currentURL;
                page = getPage();
                console.log(`链接变化 page= ${page}`);
                transTitle();

                if (page) {
                    setTimeout(() => {
                        transBySelector();
                        if (page === "repository") transDesc(".f4.my-3");
                        else if (page === "gist") transDesc(".gist-content [itemprop='about']");
                    }, 500);
                }
            }

            if (page) {
                mutations.filter(mutation => mutation.addedNodes.length > 0 || mutation.type === 'attributes' || mutation.type === 'characterData')
                    .forEach(mutation => traverseNode(mutation.target));
            }
        });

        observer.observe(document.body, {
            characterData: true,
            subtree: true,
            childList: true,
            attributeFilter: ['value', 'placeholder', 'aria-label', 'data-confirm']
        });
    }

    /**
     * traverseNode 函数：遍历指定的节点，并对节点进行翻译。
     * @param {Node} node - 需要遍历的节点。
     */
    function traverseNode(node) {
        if (I18N.conf.reIgnoreId.test(node.id) ||
            I18N.conf.reIgnoreClass.test(node.className) ||
            I18N.conf.reIgnoreTag.includes(node.tagName) ||
            (node.getAttribute && I18N.conf.reIgnoreItemprop.test(node.getAttribute("itemprop")))) {
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            if (["RELATIVE-TIME", "TIME-AGO", "TIME", "LOCAL-TIME"].includes(node.tagName)) {
                if (node.shadowRoot) {
                    transTimeElement(node.shadowRoot);
                    watchTimeElement(node.shadowRoot);
                } else {
                    transTimeElement(node);
                }
                return;
            }

            if (["INPUT", "TEXTAREA"].includes(node.tagName)) {
                if (["button", "submit", "reset"].includes(node.type)) {
                    if (node.hasAttribute('data-confirm')) transElement(node, 'data-confirm', true);
                    transElement(node, 'value');
                } else {
                    transElement(node, 'placeholder');
                }
            } else if (node.tagName === 'BUTTON') {
                if (node.hasAttribute('aria-label') && /tooltipped/.test(node.className)) transElement(node, 'aria-label', true);
                if (node.hasAttribute('title')) transElement(node, 'title', true);
                if (node.hasAttribute('data-confirm')) transElement(node, 'data-confirm', true);
                if (node.hasAttribute('data-confirm-text')) transElement(node, 'data-confirm-text', true);
                if (node.hasAttribute('data-confirm-cancel-text')) transElement(node, 'data-confirm-cancel-text', true);
                if (node.hasAttribute('cancel-confirm-text')) transElement(node, 'cancel-confirm-text', true);
                if (node.hasAttribute('data-disable-with')) transElement(node, 'data-disable-with', true);
            } else if (node.tagName === 'OPTGROUP') {
                transElement(node, 'label');
            } else if (/tooltipped/.test(node.className)) {
                transElement(node, 'aria-label', true);
            } else if (node.tagName === 'A') {
                if (node.hasAttribute('title')) transElement(node, 'title', true);
                if (node.hasAttribute('data-hovercard-type')) return;
            }

            node.childNodes.forEach(traverseNode);
        } else if (node.nodeType === Node.TEXT_NODE && node.length <= 500) {
            transElement(node, 'data');
        }
    }

    /**
     * getPage 函数：获取当前页面的类型。
     * @returns {string|boolean} 当前页面的类型，如果无法确定类型，那么返回 false。
     */
    function getPage() {
        const siteMapping = {
            'gist.github.com': 'gist',
            'www.githubstatus.com': 'status',
            'skills.github.com': 'skills'
        };
        const site = siteMapping[location.hostname] || 'github';
        const pathname = location.pathname;
        const isLogin = document.body.classList.contains("logged-in");
        const analyticsLocation = (document.getElementsByName('analytics-location')[0] || {}).content || '';
        const isOrganization = /\/<org-login>/.test(analyticsLocation) || /^\/(?:orgs|organizations)/.test(pathname);
        const isRepository = /\/<user-name>\/<repo-name>/.test(analyticsLocation);

        let page, t = document.body.className.match(I18N.conf.rePageClass);
        if (t) {
            if (t[1] === 'page-profile') {
                let matchResult = location.search.match(/tab=(\w+)/);
                page = matchResult ? 'page-profile/' + matchResult[1] : (pathname.match(/\/(stars)/) ? 'page-profile/stars' : 'page-profile');
            } else {
                page = t[1];
            }
        } else if (site === 'gist') {
            page = 'gist';
        } else if (site === 'status') {
            page = 'status';
        } else if (site === 'skills') {
            page = 'skills';
        } else if (pathname === '/' && site === 'github') {
            page = isLogin ? 'page-dashboard' : 'homepage';
        } else if (isRepository) {
            t = pathname.match(I18N.conf.rePagePathRepo);
            page = t ? 'repository/' + t[1] : 'repository';
        } else if (isOrganization) {
            t = pathname.match(I18N.conf.rePagePathOrg);
            page = t ? 'orgs/' + (t[1] || t.slice(-1)[0]) : 'orgs';
        } else {
            t = pathname.match(I18N.conf.rePagePath);
            page = t ? (t[1] || t.slice(-1)[0]) : false;
        }

        if (!page || !I18N[lang][page]) {
            console.log(`请注意对应 page ${page} 词库节点不存在`);
            page = false;
        }
        return page;
    }

    /**
     * transTitle 函数：翻译页面标题
     */
    function transTitle() {
        let key = document.title;
        let str = I18N[lang]['title']['static'][key] || '';
        if (!str) {
            let res = I18N[lang]['title'].regexp || [];
            for (let [a, b] of res) {
                str = key.replace(a, b);
                if (str !== key) break;
            }
        }
        document.title = str;
    }

    /**
     * transTimeElement 函数：翻译时间元素文本内容。
     * @param {Element} el - 需要翻译的元素。
     */
    function transTimeElement(el) {
        let key = el.childNodes.length > 0 ? el.lastChild.textContent : el.textContent;
        let res = I18N[lang]['public']['time-regexp'];

        for (let [a, b] of res) {
            let str = key.replace(a, b);
            if (str !== key) {
                el.textContent = str;
                break;
            }
        }
    }

    /**
     * watchTimeElement 函数：监视时间元素变化, 触发和调用时间元素翻译
     * @param {Element} el - 需要监视的元素。
     */
    function watchTimeElement(el) {
        const MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        new MutationObserver(mutations => transTimeElement(mutations[0].addedNodes[0])).observe(el, { childList: true });
    }

    /**
     * transElement 函数：翻译指定元素的文本内容或属性。
     * @param {Element} el - 需要翻译的元素。
     * @param {string} field - 需要翻译的文本内容或属性的名称。
     * @param {boolean} isAttr - 是否需要翻译属性。
     */
    function transElement(el, field, isAttr = false) {
        let text = isAttr ? el.getAttribute(field) : el[field];
        let str = translateText(text);
        if (str) {
            if (!isAttr) el[field] = str;
            else el.setAttribute(field, str);
        }
    }

    /**
     * translateText 函数：翻译文本内容。
     * @param {string} text - 需要翻译的文本内容。
     * @returns {string|boolean} 翻译后的文本内容，如果没有找到对应的翻译，那么返回 false。
     */
    function translateText(text) {
        if (!isNaN(text) || !/[a-zA-Z,.]+/.test(text)) return false;
        let _key = text.trim();
        let _key_neat = _key.replace(/\xa0|[\s]+/g, ' ');
        let str = fetchTranslatedText(_key_neat);
        return str && str !== _key_neat ? text.replace(_key, str) : false;
    }

    /**
     * fetchTranslatedText 函数：从特定页面的词库中获得翻译文本内容。
     * @param {string} key - 需要翻译的文本内容。
     * @returns {string|boolean} 翻译后的文本内容，如果没有找到对应的翻译，那么返回 false。
     */
    function fetchTranslatedText(key) {
        let str = I18N[lang][page]['static'][key] || I18N[lang]['public']['static'][key];
        if (typeof str === 'string') return str;
        if (enable_RegExp) {
            let res = (I18N[lang][page].regexp || []).concat(I18N[lang]['public'].regexp || []);
            for (let [a, b] of res) {
                str = key.replace(a, b);
                if (str !== key) return str;
            }
        }
        return false;
    }

    /**
     * transDesc 函数：为指定的元素添加一个翻译按钮，并为该按钮添加点击事件。
     * @param {string} el - CSS选择器，用于选择需要添加翻译按钮的元素。
     */
    function transDesc(el) {
        let element = document.querySelector(el);
        if (!element || document.getElementById('translate-me')) return false;
        element.insertAdjacentHTML('afterend', `<div id='translate-me' style='color: rgb(27, 149, 224); font-size: small; cursor: pointer'>翻译</div>`);
        let button = element.nextSibling;
        button.addEventListener('click', () => {
            const desc = element.textContent.trim();
            if (!desc) return false;
            translateDescText(desc, text => {
                button.style.display = "none";
                element.insertAdjacentHTML('afterend', `<span style='font-size: small'>由 <a target='_blank' style='color:rgb(27, 149, 224);' href='https://www.iflyrec.com/html/translate.html'>讯飞听见</a> 翻译👇</span><br/>${text}`);
            });
        });
    }

    /**
     * translateDescText 函数：将指定的文本发送到讯飞的翻译服务进行翻译。
     * @param {string} text - 需要翻译的文本。
     * @param {function} callback - 翻译完成后的回调函数，该函数接受一个参数，即翻译后的文本。
     */
    function translateDescText(text, callback) {
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://www.iflyrec.com/TranslationService/v1/textTranslation",
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://www.iflyrec.com',
            },
            data: JSON.stringify({
                "from": "2",
                "to": "1",
                "contents": [{
                    "text": text,
                    "frontBlankLine": 0
                }]
            }),
            responseType: "json",
            onload: (res) => {
                try {
                    const { status, response } = res;
                    callback((status === 200) ? response.biz[0].translateResult : "翻译失败");
                } catch (error) {
                    console.error('翻译失败', error);
                    callback("翻译失败");
                }
            },
            onerror: (error) => {
                console.error('网络请求失败', error);
                callback("网络请求失败");
            }
        });
    }

    /**
     * transBySelector 函数：通过 CSS 选择器找到页面上的元素，并将其文本内容替换为预定义的翻译。
     */
    function transBySelector() {
        let res = (I18N[lang][page]?.selector || []).concat(I18N[lang]['public'].selector || []);
        if (res.length > 0) {
            for (let [selector, translation] of res) {
                let element = document.querySelector(selector);
                if (element) element.textContent = translation;
            }
        }
    }

    function registerMenuCommand() {
        const toggleRegExp = () => {
            enable_RegExp = !enable_RegExp;
            GM_setValue("enable_RegExp", enable_RegExp);
            GM_notification(`已${enable_RegExp ? '开启' : '关闭'}正则功能`);
            if (enable_RegExp) location.reload();
            GM_unregisterMenuCommand(id);
            id = GM_registerMenuCommand(`${enable_RegExp ? '关闭' : '开启'}正则功能`, toggleRegExp);
        };

        let id = GM_registerMenuCommand(`${enable_RegExp ? '关闭' : '开启'}正则功能`, toggleRegExp);
    }

    /**
     * init 函数：初始化翻译功能。
     */
    function init() {
        // 获取当前页面的翻译规则
        page = getPage();
        console.log(`开始page= ${page}`);

        // 翻译页面标题
        transTitle();

        if (page) {
            // 立即翻译页面
            traverseNode(document.body);

            setTimeout(() => {
                // 使用 CSS 选择器找到页面上的元素，并将其文本内容替换为预定义的翻译
                transBySelector();
                if (page === "repository") transDesc(".f4.my-3");
                else if (page === "gist") transDesc(".gist-content [itemprop='about']");
            }, 100);
        }
        // 监视页面变化
        watchUpdate();
    }

    // 执行初始化
    registerMenuCommand();
    init();

})(window, document);
