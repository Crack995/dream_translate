'use strict'

let isDebug = true
let dialog, shadow, setting, conf, dialogCSS, languageList, iconBut, iconText, extPath
let dialogConf = {
    width: 500,
    height: 470,
    source: 'en',
    target: 'zh',
    action: 'translate',
}
let dQuery = {action: '', text: '', source: '', target: ''}
loadDialogConf()
loadSetting(function (setting) {
    if (setting.allowSelect === 'on') allowUserSelect()
})
document.addEventListener('DOMContentLoaded', function () {
    debug('loaded content.js')
    init()
})

let msgList = {translate: {}, dictionary: {}, search: {}}
chrome.runtime.onMessage.addListener(function (m) {
    debug(m)
    if (m.action === 'translate') {
        msgList.translate[m.name] = m.result
        translateExec(m.name)
    } else if (m.action === 'translateTTS') {
        translateTTSExec(m)
    } else if (m.action === 'translateLink') {
        translateLinkExec(m)
    } else if (m.action === 'dictionary') {
    } else if (m.action === 'search') {
    } else if (m.action === 'allowSelect') {
        allowUserSelect()
    } else if (m.action === 'loadSetting') {
        loadSetting()
    } else if (m.action === 'contextMenus') {
        if (m.text) {
            queryInit(m.text)
            dialog.show()
        }
    }
})

window.addEventListener("message", function (m) {
    let d = m.data
    if (d.text && typeof d.clientX === 'number' && typeof d.clientY === 'number') onQuery(d.text, d.clientX, d.clientY)
})

function init() {
    chrome.storage.local.get(['conf', 'dialogCSS', 'languageList'], function (r) {
        conf = r.conf
        dialogCSS = r.dialogCSS
        languageList = JSON.parse(r.languageList)
        debug('conf:', r.conf)
        // debug('dialogCSS:', r.dialogCSS)
        // debug('languageList:', JSON.stringify(languageList))
        dialogInit()
    })
}

function dialogInit() {
    // 初始对话框
    let dialogChange = false
    dialog = dmxDialog({
        cssText: dialogCSS,
        width: dialogConf.width,
        height: dialogConf.height,
        minWidth: 500,
        onResize: function (style) {
            const {width, height} = style
            if (width) dialogConf.width = width
            if (height) dialogConf.height = height
            dialogChange = true
        }
    })
    shadow = dialog.shadow // 影子元素
    // 保存窗口大小
    dialog.el.addEventListener('mouseup', function () {
        if (dialogChange) {
            saveDialogConf()
            dialogChange = false
        }
    })

    // 小屏窗口
    if (document.documentElement.scrollWidth < 1024) {
        dialog.el.style.width = document.documentElement.offsetWidth + 'px'
        $('dmx_pin').remove()
        $('dmx_fullscreen').remove()
    }

    // 鼠标事件
    document.addEventListener('mouseup', function (e) {
        let text = window.getSelection().toString().trim()
        onQuery(text, e.clientX, e.clientY)
    })

    // 鼠标图标
    iconBut = $('dmx_mouse_icon')
    iconBut.onclick = function (e) {
        iconBut.style.display = 'none'
        queryInit(iconText)
        dialog.show(setting.position === 'fixed' ? {} : {left: e.clientX + 10, top: e.clientY - 35})
    }
    iconBut.onmousedown = function (e) {
        e.preventDefault()
    }

    // 绑定事件
    let nav = $('dmx_navigate')
    let navEl = nav.querySelectorAll('.dmx-icon')
    let navClean = function () {
        navEl.forEach(el => {
            rmClass(el, 'active')
        })
    }
    navEl.forEach(uEl => {
        uEl.addEventListener('click', function () {
            navClean()
            addClass(this, 'active')

            let action = this.getAttribute('action')
            let arr = {'translate': translateBoxInit, 'dictionary': dictionaryBoxInit, 'search': searchBoxInit}
            if (arr[action]) {
                setDialogConf('action', action)
                arr[action]()
            }
        })
    })
    dialogConf.action && nav.querySelector(`u[action="${dialogConf.action}"]`).click()

    // 设置按钮
    $('dmx_setting').addEventListener('click', function () {
        navClean()
        settingBoxInit()
    })

    // 更多功能
    $('dmx_more').addEventListener('click', function () {
        navClean()
        moreBoxInit()
    })
}

function translateExec(name, isBilingual) {
    let el = $(`${name}_translate_case`)
    if (!el) return
    let r = msgList.translate[name]
    let s = ''
    r && r.data && r.data.forEach(v => {
        if (isBilingual) {
            s += `<p class="source_text">${v.srcText}</p><p>${v.tarText}</p>`
        } else {
            s += `<p>${v.tarText}</p>`
        }
    })
    if (!s) s = '网络错误，请稍后再试'
    el.querySelector('.case_content').innerHTML = s

    let soundHTML = function (lan, lanArr, className) {
        let title = languageList[lan] ? languageList[lan].zhName : ''
        let arr = {
            'zh': '&#xe675;',
            'en': '&#xe6a8;',
            'jp': '&#xe6a0;',
            'th': '&#xe69c;',
            'spa': '&#xe6a5;',
            'ara': '&#xe6a7;',
            'fra': '&#xe676;',
            'kor': '&#xe6a6;',
            'ru': '&#xe69d;',
            'de': '&#xe677;',
            'pt': '&#xe69e;',
            'it': '&#xe6a4;',
            'el': '&#xe6a1;',
            'nl': '&#xe6a3;',
            'pl': '&#xe6a9;'
        }
        let iconStr = arr[lan] || '&#xe67a;'
        let s = title
        if (!lanArr || inArray(lan, lanArr)) {
            s += ` <i class="dmx-icon dmx_ripple ${className}" title="${title}发音">${iconStr}</i>`
        }
        return s
    }
    let onActive = function (el) {
        shadow.querySelectorAll('.dmx_ripple').forEach(rEl => {
            rmClass(rEl, 'active')
        })
        addClass(el, 'active')
    }
    if (r && r.srcLan && r.tarLan) {
        let sourceStr = soundHTML(r.srcLan, r.lanTTS, 'sound_source')
        let targetStr = soundHTML(r.tarLan, r.lanTTS, 'sound_target')
        el.querySelector('.case_language').innerHTML = `${sourceStr} » ${targetStr}`

        let sourceEl = el.querySelector('.sound_source')
        let targetEl = el.querySelector('.sound_target')
        sourceEl && sourceEl.addEventListener('click', () => {
            onActive(sourceEl)
            playSound(name, 'source', r.srcLan, dQuery.text)
        })
        targetEl && targetEl.addEventListener('click', () => {
            onActive(targetEl)
            let s = ''
            r.data && r.data.forEach(v => {
                s += v.tarText
            })
            s && playSound(name, 'target', r.tarLan, s)
        })
    }
}

function translateTTSExec(m) {
    if (m.error) alert(m.error, 'error')
    let el = $(`${m.name}_translate_case`)
    if (!el) return
    let sEl = el.querySelector(`.sound_${m.type}`)
    if (sEl) (m.status === 'start' ? addClass : rmClass)(sEl, 'active')
}

function translateLinkExec(m) {
    let el = $(`${m.name}_translate_case`)
    if (!el) return
    let sEl = el.querySelector(`.case_link`)
    if (sEl) {
        sEl.setAttribute('href', m.link)
        sEl.setAttribute('target', '_blank')
        sEl.setAttribute('referrerPolicy', 'no-referrer')
    }
}

function playSound(name, type, lang, text) {
    sendMessage({action: 'translateTTS', name: name, type: type, lang: lang, text: text}).catch(e => {
        alert('梦想翻译已更新，请刷新页面激活。', 'error')
    })
}

function sendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, function (response) {
            let err = chrome.runtime.lastError
            if (err) {
                reject(err)
            } else {
                resolve(response)
            }
        })
    })
}

function onQuery(text, clientX, clientY) {
    if (setting.scribble === 'off') return
    if (!text) {
        iconBut.style.display = 'none'
        return
    }
    debug(text)

    // 自动复制功能
    if (setting.autoCopy === 'on') {
        execCopy(text)
        alert('复制成功', 'success')
    }

    if (setting.scribble === 'direct') {
        queryInit(text)
        dialog.show(setting.position === 'fixed' ? {} : {left: clientX + 30, top: clientY - 60})
    } else if (setting.scribble === 'clickIcon') {
        iconText = text
        let x = clientX + 10
        let y = clientY - 45
        x = x + 42 < document.documentElement.clientWidth ? x : clientX - 42
        y = y > 10 ? y : clientY + 10
        iconBut.style.transform = `translate(${x}px, ${y}px)`
        iconBut.style.display = 'flex'
    }
}

function queryInit(text) {
    let nev = $('dmx_navigate')
    let el = nev.querySelector('.active')
    if (!el) {
        nev.querySelector('u').click()
        el = nev.querySelector('.active')
    }
    let action = el.getAttribute('action')

    let source = dialogConf.source
    let target = dialogConf.target
    if (dQuery.action === action && dQuery.text === text && dQuery.source === source && dQuery.target === target) return
    dQuery = {action: action, text: text, source: source, target: target}

    if (action === 'translate') {
        $(`${action}_input`).innerText = text
        translateCaseInit()
    } else if (action === 'dictionary') {
        $(`${action}_input`).value = text
        dictionaryCaseInit()
    } else if (action === 'search') {
        $(`${action}_input`).value = text
        searchCaseInit()
    }
    sendMessage({action: action, text: text, srcLan: source, tarLan: target}).catch(e => {
        alert('梦想翻译已更新，请刷新页面激活。', 'error')
    })
}

function getRangeBound() {
    return window.getSelection().getRangeAt(0).getBoundingClientRect()
}

function translateCaseInit() {
    let el = $('case_list')
    let list = setting.translateList
    if (list.length < 1) {
        el.innerHTML = `<div class="case case_content"><i class="dmx-icon dmx-icon-info"></i> 您未启用任何翻译模块</div>`
        return
    }

    let s = ''
    list.forEach(name => {
        s += `<div class="case" id="${name}_translate_case">
    <div class="case_top fx">
        <div class="case_left case_language"></div>
        <div class="case_right">
            <a class="case_link"><i class="dmx-icon dmx-icon-${name}"></i>${conf.translateList[name]}</a>
        </div>
        <div class="case_right case_copy" title="复制"><i class="dmx-icon dmx-icon-copy"></i></div>
        <div class="case_right case_bilingual dmx-icon">双语</div>
    </div>
    <div class="case_content"><div class="dmx_loading"></div></div>
</div>`
    })
    el.innerHTML = s

    // 绑定事件
    list.forEach(name => {
        let caseEl = $(`${name}_translate_case`)
        let copyEl = caseEl.querySelector('.case_copy')
        let bilingualEl = caseEl.querySelector('.case_bilingual')
        let contentEl = caseEl.querySelector('.case_content')
        copyEl.addEventListener('click', () => {
            execCopy(contentEl.innerText.replace(/\n{2}/g, '\n').trim())
            alert('复制成功', 'success')
        })
        bilingualEl.addEventListener('click', () => {
            if (hasClass(bilingualEl, 'active')) {
                translateExec(name, false)
                rmClass(bilingualEl, 'active')
            } else {
                translateExec(name, true)
                addClass(bilingualEl, 'active')
            }
        })
    })
}

function dictionaryCaseInit() {
    let s = ''
    setting.dictionaryList.forEach(name => {
        s += `<div class="case" id="${name}_dictionary_case">
        <div class="case_top fx">
            <div class="case_right">
                <a class="case_link"><i class="dmx-icon dmx-icon-${name}"></i>${conf.dictionaryList[name]}</a>
            </div>
            <div class="case_right case_copy" title="复制"><i class="dmx-icon dmx-icon-copy"></i></div>
            <div class="case_left">英 [driːm] <i class="dmx-icon dmx_ripple" title="英音">&#xe674;</i></div>
            <div class="case_left">美 [driːm] <i class="dmx-icon dmx_ripple" title="美音">&#xe69f;</i></div>
        </div>
        <div class="case_content"><div class="dmx_loading"></div></div>
    </div>`
    })
    $('case_list').innerHTML = s
}

function searchCaseInit() {
    let s = ''
    setting.searchList.forEach(name => {
        s += `<div class="case" id="${name}_search_case">
        <div class="case_top fx">
            <div class="case_right">
                <a class="case_link"><i class="dmx-icon dmx-icon-${name}"></i>${conf.searchList[name]}</a>
            </div>
        </div>
        <div class="case_content"><div class="dmx_loading"></div></div>
    </div>`
    })
    $('case_list').innerHTML = s
}

function translateBoxInit() {
    let l = languageList, langList = ''
    for (let k in l) {
        if (l.hasOwnProperty(k)) langList += `<u value="${k}">${l[k].zhName}</u>`
    }
    dialog.contentHTML(`<div class="main main_trans">
    <div class="case" id="translate_input" contenteditable="true"></div>
    <div class="language_box fx">
        <div id="language_source" class="language_button dmx-icon"></div>
        <div id="language_exchange"><i class="dmx-icon dmx-icon-exchange"></i></div>
        <div id="language_target" class="language_button dmx-icon"></div>
        <div id="translate_button">翻 译</div>
        <div id="language_dropdown" class="fx">${langList}</div>
    </div>
</div>
<div id="case_list" class="main"></div>`)

    // 绑定事件
    let sourceEl = $('language_source')
    let targetEl = $('language_target')
    let exchangeEl = $('language_exchange')
    let inputEl = $('translate_input')
    let translateEl = $('translate_button')
    let dropdownEl = $('language_dropdown')
    let dropdownU = dropdownEl.querySelectorAll('u')
    let contentEl = $('dmx_dialog_content')
    let tmpEl
    let onButton = function () {
        let el = this
        if (tmpEl === el && dropdownEl.style.display === 'block') {
            dropdownEl.style.display = 'none'
            rmClass(el, 'active')
        } else {
            tmpEl = el
            addClass(el, 'active')
            let sourceVal = sourceEl.getAttribute('value')
            let targetVal = targetEl.getAttribute('value')
            let isSource = el === sourceEl
            if (isSource) {
                rmClass(targetEl, 'active')
                rmClass(dropdownEl, 'dropdown_target')
            } else {
                rmClass(sourceEl, 'active')
                addClass(dropdownEl, 'dropdown_target')
            }
            dropdownEl.style.display = 'block'
            dropdownU.forEach(uEl => {
                rmClass(uEl, 'active')
                rmClass(uEl, 'disabled')
                let val = uEl.getAttribute('value')
                if (isSource) {
                    if (sourceVal === val) {
                        addClass(uEl, 'active')
                    } else if (targetVal === val) {
                        addClass(uEl, 'disabled')
                    }
                } else {
                    if (targetVal === val) {
                        addClass(uEl, 'active')
                    } else if (sourceVal === val) {
                        addClass(uEl, 'disabled')
                    }
                }
            })
        }
    }
    sourceEl.addEventListener('click', onButton)
    targetEl.addEventListener('click', onButton)
    exchangeEl.addEventListener('click', function () {
        let sourceVal = sourceEl.getAttribute('value')
        let sourceText = sourceEl.innerText
        let targetVal = targetEl.getAttribute('value')
        let targetText = targetEl.innerText
        if (sourceVal === 'auto') return
        sourceEl.setAttribute('value', targetVal)
        sourceEl.innerText = targetText
        targetEl.setAttribute('value', sourceVal)
        targetEl.innerText = sourceText
        setDialogConf('source', targetVal)
        setDialogConf('target', sourceVal)
        rmClass(sourceEl, 'active')
        rmClass(targetEl, 'active')
        dropdownEl.style.display = 'none'
    })
    translateEl.addEventListener('click', function () {
        rmClass(sourceEl, 'active')
        rmClass(targetEl, 'active')
        dropdownEl.style.display = 'none'
        let text = inputEl.innerText.trim()
        text && queryInit(text)
    })
    dropdownU.forEach(uEl => {
        uEl.addEventListener('click', function () {
            let v = this.getAttribute('value')
            let s = this.innerText
            let isSource = !hasClass(dropdownEl, 'dropdown_target')
            let el = isSource ? sourceEl : targetEl
            rmClass(el, 'active')
            el.setAttribute('value', v)
            el.innerText = s
            dropdownEl.style.display = 'none'
            contentEl.scrollTop = 0
            if (isSource) {
                (v === 'auto' ? addClass : rmClass)(exchangeEl, 'disabled')
                setDialogConf('source', v)
            } else {
                setDialogConf('target', v)
            }
        })
    })

    // 初始值
    sourceEl.setAttribute('value', dialogConf.source)
    sourceEl.innerText = l[dialogConf.source]?.zhName
    targetEl.setAttribute('value', dialogConf.target)
    targetEl.innerText = l[dialogConf.target]?.zhName
    if (dialogConf.source === 'auto') addClass(exchangeEl, 'disabled')
}

function dictionaryBoxInit() {
    dialog.contentHTML(`<div id="head">
    <div class="case search_box">
        <input id="dictionary_input" type="text" maxlength="100" autocomplete="off">
        <div id="search_but"><i class="dmx-icon dmx-icon-search"></i></div>
    </div>
</div>
<div id="case_list" class="main"></div>`)
}

function searchBoxInit() {
    dialog.contentHTML(`<div id="head">
    <div class="case search_box">
        <input id="search_input" type="text" maxlength="100" autocomplete="off">
        <div id="search_but"><i class="dmx-icon dmx-icon-search"></i></div>
    </div>
</div>
<div id="case_list" class="main"></div>`)
}

function settingBoxInit() {
    dialog.contentHTML(`<iframe class="dmx_iframe" src="${getURL('html/setting.html')}" importance="high"></iframe>`)
}

function moreBoxInit() {
    dialog.contentHTML(`<iframe class="dmx_iframe" src="${getURL('html/more.html')}" importance="high"></iframe>`)
}

function $(id) {
    return shadow.getElementById(id)
}

// let id = chrome.i18n.getMessage('@@extension_id')
// let id = chrome.runtime.id
function getURL(s) {
    if (!extPath) extPath = chrome.runtime.getURL('')
    return extPath + s
}

function loadSetting(callback) {
    chrome.storage.sync.get(['setting'], function (r) {
        setting = r.setting
        typeof callback === 'function' && callback(setting)
    })
}

function loadDialogConf(callback) {
    chrome.storage.sync.get(['dialogConf'], function (r) {
        dialogConf = Object.assign(dialogConf, r.dialogConf)
        typeof callback === 'function' && callback(dialogConf)
    })
}

function setDialogConf(name, value) {
    dialogConf[name] = value
    saveDialogConf()
}

function saveDialogConf() {
    chrome.storage.sync.set({'dialogConf': dialogConf})
}

function debug(...data) {
    isDebug && console.log('[DMX DEBUG]', ...data)
}

function alert(message, type) {
    type = type || 'info'
    let el = $('dmx_alert')
    if (!el) {
        let d = document.createElement('div')
        d.id = 'dmx_alert'
        shadow.appendChild(d)
        el = $('dmx_alert')
    }
    let icon = {
        info: '<i class="dmx-icon dmx-icon-info"></i>',
        error: '<i class="dmx-icon dmx-icon-close"></i>',
        success: '<i class="dmx-icon dmx-icon-success"></i>',
    }
    let m = document.createElement('div')
    m.className = `dxm_alert_${type}`
    m.innerHTML = (icon[type] || '') + message
    el.appendChild(m)
    setTimeout(() => {
        addClass(m, 'an_top')
    }, 10)
    setTimeout(() => {
        addClass(m, 'an_delete')
        setTimeout(() => {
            el.removeChild(m)
        }, 300)
    }, 2500)
}

function createTextarea() {
    let t = document.createElement("textarea")
    t.style.position = 'fixed'
    t.style.top = '-200%'
    document.body.appendChild(t)
    return t
}

function execCopy(s) {
    let t = createTextarea()
    t.value = s
    t.select()
    document.execCommand("copy")
    document.body.removeChild(t)
}

function execPaste() {
    let t = createTextarea()
    t.focus()
    document.execCommand("paste")
    let v = t.value
    document.body.removeChild(t)
    return v
}

function allowUserSelect() {
    if (window.dmxAllowUserSelect) return
    let sty = document.createElement('style')
    sty.innerHTML = `* {-webkit-user-select:text!important;-moz-user-select:text!important;user-select:text!important}`
    document.body.appendChild(sty)

    let allow = function () {
        return true
    }
    let onAllow = function (el, event) {
        if (el.getAttribute && el.getAttribute(event)) el.setAttribute(event, allow)
    }
    let onClean = function (e) {
        e.stopPropagation()
        let el = e.target
        while (el) {
            onAllow(el, 'on' + e.type)
            el = el.parentNode
        }
    }
    onAllow(document, 'oncontextmenu')
    onAllow(document, 'onselectstart')
    document.addEventListener('contextmenu', onClean, true)
    document.addEventListener('selectstart', onClean, true)
    window.dmxAllowUserSelect = true
    alert('解除页面限制完成', 'success')
}

function addClass(el, className) {
    className = className.trim()
    let oldClassName = el.className.trim()
    if (!oldClassName.length) {
        el.className = className
    } else if ((' ' + oldClassName + ' ').indexOf(' ' + className + ' ') === -1) {
        el.className += ' ' + className
    }
}

function rmClass(el, className) {
    let newClassName = el.className.replace(new RegExp('(?:^|\\s)' + className + '(?:\\s|$)', 'g'), ' ').trim()
    if (newClassName) {
        el.className = newClassName
    } else {
        el.removeAttribute('class')
    }
}

function hasClass(el, className) {
    if (!el.className) return false
    return (' ' + el.className.trim() + ' ').indexOf(' ' + className.trim() + ' ') > -1
}

function inArray(val, arr) {
    // return arr.indexOf(val) !== -1
    return arr.includes(val)
}

function dmxDialog(options) {
    if (window._MxDialog) return window._MxDialog
    let o = Object.assign({
        width: 500,
        height: 300,
        minWidth: 200,
        minHeight: 200,
        show: false,
        autoHide: true,
        cssText: '',
        contentHTML: '',
        onResize: null,
    }, options || {})

    let d = document.createElement('div')
    d.setAttribute('mx-name', 'dream-translation')
    d.style.all = 'initial'
    document.documentElement.appendChild(d)
    let shadow = d.attachShadow({mode: 'closed'})
    shadow.innerHTML = `<link rel="stylesheet" href="${getURL('css/content.css')}">
<style>${o.cssText}</style>
<div id="dmx_dialog">
    <div id="dmx_dialog_title">
        <div class="dmx_left">
            <div id="dmx_close"><i class="dmx-icon dmx-icon-close"></i></div>
            <div id="dmx_pin" class="dmx-icon"></div>
            <div id="dmx_fullscreen" class="dmx-icon"></div>
            <div id="dmx_back">
                <i class="dmx-icon dmx-icon-left"></i>
                <i class="dmx-icon dmx-icon-right"></i>
            </div>
            <div id="dmx_navigate">
                <u class="dmx-icon active" action="translate">翻译</u>
                <u class="dmx-icon" action="dictionary">词典</u>
                <u class="dmx-icon" action="search">搜索</u>
            </div>
        </div>
        <div class="dmx_right">
            <div id="dmx_setting"><i class="dmx-icon dmx-icon-setting"></i></div>
            <div id="dmx_more"><i class="dmx-icon dmx-icon-more"></i></div>
        </div>
    </div>
    <div id="dmx_dialog_content">${o.contentHTML}</div>
    <div id="dmx_dialog_resize_n"></div>
    <div id="dmx_dialog_resize_e"></div>
    <div id="dmx_dialog_resize_s"></div>
    <div id="dmx_dialog_resize_w"></div>
    <div id="dmx_dialog_resize_nw"></div>
    <div id="dmx_dialog_resize_ne"></div>
    <div id="dmx_dialog_resize_sw"></div>
    <div id="dmx_dialog_resize_se"></div>
</div>
<div id="dmx_mouse_icon"></div>`

    let $ = function (id) {
        return shadow.getElementById(id)
    }
    let el = $('dmx_dialog')
    let clientX, clientY, elX, elY, elW, elH, docW, docH, mid
    let onMousedown = function (e) {
        e.stopPropagation()
        mid = this.id
        clientX = e.clientX
        clientY = e.clientY
        let b = el.getBoundingClientRect()
        elX = b.left || el.offsetLeft
        elY = b.top || el.offsetTop
        elW = b.width || el.offsetWidth
        elH = b.height || el.offsetHeight
        docW = document.documentElement.clientWidth
        docH = document.documentElement.clientHeight
        addClass(document.body, 'dmx_unselectable')
        addClass(el, 'dmx_unselectable')
    }
    let elArr = ['dmx_dialog_title', 'dmx_dialog_resize_n', 'dmx_dialog_resize_e', 'dmx_dialog_resize_s', 'dmx_dialog_resize_w',
        'dmx_dialog_resize_nw', 'dmx_dialog_resize_ne', 'dmx_dialog_resize_sw', 'dmx_dialog_resize_se']
    elArr.forEach(i => {
        $(i).addEventListener('mousedown', onMousedown)
    })

    let _m = function (e) {
        let left = e.clientX - (clientX - elX)
        let top = e.clientY - (clientY - elY)
        let maxLeft = docW - elW
        let maxTop = docH - elH
        left = Math.max(0, Math.min(left, maxLeft))
        top = Math.max(0, Math.min(top, maxTop))
        el.style.left = left + 'px'
        el.style.top = top + 'px'
    }
    let _n = function (e) {
        let top = e.clientY - (clientY - elY)
        let height = elY - top + elH
        if (height > o.minHeight && top >= 0) {
            el.style.top = top + 'px'
            el.style.height = height + 'px'
            typeof o.onResize === 'function' && o.onResize({height: height})
        } else {
            mid = null
        }
    }
    let _e = function (e) {
        let left = e.clientX - (clientX - elX)
        let width = left - elX + elW
        if (width > o.minWidth && e.clientX < docW - (elW - (clientX - elX))) {
            el.style.width = width + 'px'
            typeof o.onResize === 'function' && o.onResize({width: width})
        } else {
            mid = null
        }
    }
    let _s = function (e) {
        let top = e.clientY - (clientY - elY)
        let height = top - elY + elH
        if (height > o.minHeight && e.clientY < docH - (elH - (clientY - elY))) {
            el.style.height = height + 'px'
            typeof o.onResize === 'function' && o.onResize({height: height})
        } else {
            mid = null
        }
    }
    let _w = function (e) {
        let left = e.clientX - (clientX - elX)
        let width = elW - (left - elX)
        if (width > o.minWidth && left >= 0) {
            el.style.left = left + 'px'
            el.style.width = width + 'px'
            typeof o.onResize === 'function' && o.onResize({width: width})
        } else {
            mid = null
        }
    }
    let onMousemove = function (e) {
        if (mid === 'dmx_dialog_title') {
            _m(e)
        } else if (mid === 'dmx_dialog_resize_n') {
            _n(e)
        } else if (mid === 'dmx_dialog_resize_e') {
            _e(e)
        } else if (mid === 'dmx_dialog_resize_s') {
            _s(e)
        } else if (mid === 'dmx_dialog_resize_w') {
            _w(e)
        } else if (mid === 'dmx_dialog_resize_nw') {
            _n(e)
            _w(e)
        } else if (mid === 'dmx_dialog_resize_ne') {
            _n(e)
            _e(e)
        } else if (mid === 'dmx_dialog_resize_sw') {
            _s(e)
            _w(e)
        } else if (mid === 'dmx_dialog_resize_se') {
            _s(e)
            _e(e)
        }
    }
    let onMouseup = function (e) {
        e.stopPropagation()
        mid = null
        rmClass(document.body, 'dmx_unselectable')
        rmClass(el, 'dmx_unselectable')
    }
    document.addEventListener('mousemove', onMousemove)
    document.addEventListener('mouseup', onMouseup)

    // 阻止冒泡
    shadow.querySelectorAll('.dmx-icon').forEach(el => {
        el.addEventListener('mousedown', (e) => {
            e.stopPropagation()
        })
    })
    el.addEventListener('mouseup', onMouseup)

    // 点击 body 隐藏 dialog
    let onMouseupPin = function () {
        D.hide()
    }

    // 全屏显示
    let fullObj
    let fullScreen = function () {
        fullObj = {top: el.style.top, left: el.style.left, width: el.style.width, height: el.style.height}
        el.style.top = '0'
        el.style.left = '0'
        el.style.width = document.documentElement.clientWidth + 'px'
        el.style.height = document.documentElement.clientHeight + 'px'
    }
    let fullScreenExit = function () {
        if (typeof fullObj.top === 'string') el.style.top = fullObj.top
        if (typeof fullObj.left === 'string') el.style.left = fullObj.left
        if (typeof fullObj.width === 'string') el.style.width = fullObj.width
        if (typeof fullObj.height === 'string') el.style.height = fullObj.height
    }

    let D = {}
    D.el = el
    D.shadow = shadow
    D.show = function (o) {
        setTimeout(() => {
            el.style.display = 'block'
            if (!o || typeof o.left !== 'number' || typeof o.top !== 'number') return
            let b = el.getBoundingClientRect()
            el.style.left = Math.max(0, Math.min(o.left, document.documentElement.clientWidth - b.width)) + 'px'
            el.style.top = Math.max(0, Math.min(o.top, document.documentElement.clientHeight - b.height)) + 'px'
        }, 20)
    }
    D.hide = function () {
        el.style.display = 'none'
    }
    D.fullScreen = function () {
        addClass($('dmx_fullscreen'), 'active')
        addClass(document.body, 'dmx_overflow_hidden')
        fullScreen()
    }
    D.fullScreenExit = function () {
        rmClass($('dmx_fullscreen'), 'active')
        rmClass(document.body, 'dmx_overflow_hidden')
        fullScreenExit()
    }
    D.pin = function () {
        addClass($('dmx_pin'), 'active')
        document.removeEventListener('mouseup', onMouseupPin)
    }
    D.pinCancel = function () {
        rmClass($('dmx_pin'), 'active')
        document.addEventListener('mouseup', onMouseupPin)
    }
    D.contentHTML = function (s) {
        $('dmx_dialog_content').innerHTML = s
    }
    D.destroy = function () {
        document.removeEventListener('mousemove', onMousemove)
        document.removeEventListener('mouseup', onMouseup)
        document.removeEventListener('mouseup', onMouseupPin)
        el.remove()
    }
    window._MxDialog = D

    // 设置初始宽高
    el.style.width = Number(o.width) + 'px'
    el.style.height = Number(o.height) + 'px'
    o.show ? D.show() : D.hide()
    o.autoHide ? D.pinCancel() : D.pin()

    // 顶部按钮
    $('dmx_close').onclick = function () {
        D.hide()
        rmClass(document.body, 'dmx_overflow_hidden')
    }
    $('dmx_pin').onclick = function () {
        hasClass(this, 'active') ? D.pinCancel() : D.pin()
    }
    $('dmx_fullscreen').onclick = function () {
        hasClass(this, 'active') ? D.fullScreenExit() : D.fullScreen()
    }

    return D
}
