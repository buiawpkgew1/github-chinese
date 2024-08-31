// ==UserScript==
// @name         GitHub 中文插件 Gitee(Fitten)
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
// @require      https://gitee.com/awnioow/github-chinese/raw/Fitten/locals.js?v1.9.3-2024-08-22
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
    let enable_RegExp = GM_getValue("enable_RegExp", 1),
        page = false,
        cachedPage = null,
        characterData = null,
        ignoreMutationSelectors = [],
        ignoreSelectors = [],
        tranSelectors = [],
        regexpRules = [];

    function updateConfig(page) {
        if (cachedPage === page) return;
        cachedPage = page;

        const { characterDataPage, ignoreMutationSelectorPage, ignoreSelectorPage } = I18N.conf;
        characterData = characterDataPage.includes(page);
        ignoreMutationSelectors = ignoreMutationSelectorPage['*'].concat(ignoreMutationSelectorPage[page] || []);
        ignoreSelectors = ignoreSelectorPage['*'].concat(ignoreSelectorPage[page] || []);
        tranSelectors = (I18N[lang][page]?.selector || []).concat(I18N[lang]['public'].selector || []);
        regexpRules = (I18N[lang][page].regexp || []).concat(I18N[lang]['public'].regexp || []);
    }

    function initPage() {
        const page = getPage();
        updateConfig(page);
        return page;
    }

    function watchUpdate() {
        const MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        let previousURL = location.href;

        new MutationObserver(mutations => {
            const currentURL = location.href;
            if (currentURL !== previousURL) {
                previousURL = currentURL;
                page = initPage();
                console.log(`DOM变化触发: 链接变化 page= ${page}`);
            }

            if (page) {
                const filteredMutations = mutations.flatMap(({ target, addedNodes, type }) => {
                    let nodes = [];
                    if (type === 'childList' && addedNodes.length > 0) {
                        nodes = Array.from(addedNodes);
                    } else if (type === 'attributes' || (characterData && type === 'characterData')) {
                        nodes = [target];
                    }
                    return nodes.filter(node => !ignoreMutationSelectors.some(selector => node.parentElement?.closest(selector)));
                });

                filteredMutations.forEach(node => traverseNode(node));
            }
        }).observe(document.body, {
            characterData: true,
            subtree: true,
            childList: true,
            attributeFilter: ['value', 'placeholder', 'aria-label', 'data-confirm'],
        });
    }

    function traverseNode(node) {
        if (ignoreSelectors.some(selector => node.matches?.(selector))) return;

        if (node.nodeType === Node.ELEMENT_NODE) {
            switch (node.tagName) {
                case "RELATIVE-TIME":
                    transTimeElement(node.shadowRoot);
                    return;
                case "INPUT":
                case "TEXTAREA":
                    if (['button', 'submit', 'reset'].includes(node.type)) {
                        transElement(node.dataset, 'confirm');
                        transElement(node, 'value');
                    } else {
                        transElement(node, 'placeholder');
                    }
                    break;
                case "BUTTON":
                    if (/tooltipped/.test(node.className)) transElement(node, 'ariaLabel');
                    transElement(node, 'title');
                    transElement(node.dataset, 'confirm');
                    transElement(node.dataset, 'confirmText');
                    transElement(node.dataset, 'confirmCancelText');
                    transElement(node, 'cancelConfirmText');
                    transElement(node.dataset, 'disableWith');
                    break;
                case "OPTGROUP":
                    transElement(node, 'label');
                    break;
                case "A":
                    transElement(node, 'title');
                    break;
                default:
                    if (/tooltipped/.test(node.className)) transElement(node, 'ariaLabel');
            }
            node.childNodes.forEach(child => traverseNode(child));
        } else if (node.nodeType === Node.TEXT_NODE && node.length <= 500) {
            transElement(node, 'data');
        }
    }

    function getPage(url = window.location) {
        const siteMapping = {
            'gist.github.com': 'gist',
            'www.githubstatus.com': 'status',
            'skills.github.com': 'skills'
        };
        const site = siteMapping[url.hostname] || 'github';
        const pathname = url.pathname;
        const isLogin = document.body.classList.contains("logged-in");
        const analyticsLocation = document.head.querySelector('meta[name="analytics-location"]')?.content || '';
        const isOrganization = /\/<org-login>/.test(analyticsLocation) || /^\/(?:orgs|organizations)/.test(pathname);
        const isRepository = /\/<user-name>\/<repo-name>/.test(analyticsLocation);
        const isProfile = document.body.classList.contains("page-profile") || analyticsLocation === '/<user-name>';
        const isSession = document.body.classList.contains("session-authentication");
        const { rePagePathRepo, rePagePathOrg, rePagePath } = I18N.conf;
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

        if (!page || !I18N[lang][page]) {
            console.log(`请注意对应 page ${page} 词库节点不存在`);
            page = false;
        }
        return page;
    }

    function transTitle() {
        const text = document.title;
        let translatedText = I18N[lang]['title']['static'][text] || '';
        if (!translatedText) {
            const res = I18N[lang]['title'].regexp || [];
            for (let [a, b] of res) {
                translatedText = text.replace(a, b);
                if (translatedText !== text) break;
            }
        }
        document.title = translatedText;
    }

    function transTimeElement(el) {
        const text = el.childNodes.length > 0 ? el.lastChild.textContent : el.textContent;
        const res = I18N[lang]['public']['time-regexp'];
        for (let [a, b] of res) {
            const translatedText = text.replace(a, b);
            if (translatedText !== text) {
                el.textContent = translatedText;
                break;
            }
        }
    }

    function transElement(el, field) {
        const text = el[field];
        if (!text) return;
        const translatedText = transText(text);
        if (translatedText) el[field] = translatedText;
    }

    function transText(text) {
        if (/^[\s0-9]*$/.test(text) || /^[\u4e00-\u9fa5]+$/.test(text) || !/[a-zA-Z,.]/.test(text)) return false;
        const trimmedText = text.trim();
        const cleanedText = trimmedText.replace(/\xa0|[\s]+/g, ' ');
        const translatedText = fetchTranslatedText(cleanedText);
        if (translatedText && translatedText !== cleanedText) {
            return text.replace(trimmedText, translatedText);
        }
        return false;
    }

    function fetchTranslatedText(text) {
        let translatedText = I18N[lang][page]['static'][text] || I18N[lang]['public']['static'][text];
        if (typeof translatedText === 'string') return translatedText;
        if (enable_RegExp) {
            for (let [a, b] of regexpRules) {
                translatedText = text.replace(a, b);
                if (translatedText !== text) return translatedText;
            }
        }
        return false;
    }

    function transDesc(selector) {
        const element = document.querySelector(selector);
        if (!element || document.getElementById('translate-me')) return;
        const buttonHTML = `<div id='translate-me' style='color: rgb(27, 149, 224); font-size: small; cursor: pointer'>翻译</div>`;
        element.insertAdjacentHTML('afterend', buttonHTML);
        const button = element.nextSibling;
        button.addEventListener('click', () => {
            const descText = element.textContent.trim();
            if (!descText) return;
            transDescText(descText, translatedText => {
                button.style.display = "none";
                const translatedHTML = `<span style='font-size: small'>由 <a target='_blank' style='color:rgb(27, 149, 224);' href='https://fanyi.iflyrec.com/text-translate'>讯飞听见</a> 翻译👇</span><br/>${translatedText}`;
                element.insertAdjacentHTML('afterend', translatedHTML);
            });
        });
    }

    function transDescText(text, callback) {
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://fanyi.iflyrec.com/TJHZTranslationService/v2/textAutoTranslation",
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://fanyi.iflyrec.com',
            },
            data: JSON.stringify({
                "from": 2,
                "to": 1,
                "type": 1,
                "contents": [{
                    "text": text
                }]
            }),
            responseType: "json",
            onload: (res) => {
                try {
                    const { status, response } = res;
                    const translatedText = (status === 200) ? response.biz[0].sectionResult[0].dst : "翻译失败";
                    callback(translatedText);
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

    function transBySelector() {
        if (tranSelectors.length > 0) {
            for (let [selector, translatedText] of tranSelectors) {
                const element = document.querySelector(selector);
                if (element) element.textContent = translatedText;
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

    function init() {
        page = initPage();
        console.log(`开始page= ${page}`);
        if (page) traverseNode(document.body);
        watchUpdate();
    }

    document.documentElement.lang = lang;

    new MutationObserver(mutations => {
        if (document.documentElement.lang === "en") document.documentElement.lang = lang;
    }).observe(document.documentElement, {
        attributeFilter: ['lang']
    });

    document.addEventListener('turbo:load', () => {
        if (page) {
            transTitle();
            transBySelector();
            if (page === "repository") transDesc(".f4.my-3");
            else if (page === "gist") transDesc(".gist-content [itemprop='about']");
        }
    });

    registerMenuCommand();

    window.addEventListener('DOMContentLoaded', init);

})(window, document);
