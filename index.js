/* 署名 Lucas。禁止商业使用、二次传播、二次修改。使用声明见 NOTICE.txt。 */
import { DEFAULTS, MODES, normalize, resolveMode } from './model.js';
import { getContext } from '/scripts/st-context.js';

const KEY = 'ph_frame_skin';
const labels = { time: '按时间', system: '跟随系统', light: '白天', dark: '夜晚' };
let settings, controller, media, timer, hub, panel, dialog, mounted = false, readyHandler;
let bootTimer, panelTimer, panelReadyHandler, bootAttempts = 0, stopped = false, hubLoading = false, generation = 0;
const context = () => { try { return getContext(); } catch { return undefined; } };
const save = () => context()?.saveSettingsDebounced();
const $ = selector => document.querySelector(selector);

function icon(name) { return `<i class="fa-solid fa-${name}" aria-hidden="true"></i>`; }
function brand() { return '<span class="phs-wordmark"><span>Tavern</span><b>hub</b></span>'; }

function apply() {
    if (!mounted) return;
    const active = settings.enabled && Boolean(hub);
    const mode = resolveMode(settings, new Date(), media.matches);
    document.body.classList.toggle('phs-enabled', active);
    document.body.classList.toggle('phs-solid', active && settings.solid);
    if (active) document.body.dataset.phsMode = mode;
    else delete document.body.dataset.phsMode;
    hub?.setActive(active);
    hub?.updateMode(mode, `${labels[settings.mode]} · ${mode === 'dark' ? '夜晚' : '白天'}`);
    for (const select of document.querySelectorAll('[data-phs-select]')) select.value = settings.mode;
    for (const field of document.querySelectorAll('[data-phs-field]')) {
        if (field.type === 'checkbox') { if(document.activeElement !== field)field.checked = settings[field.dataset.phsField]; }
        else if (document.activeElement !== field) field.value = settings[field.dataset.phsField];
    }
    const status = `${labels[settings.mode]} · 当前${mode === 'dark' ? '夜晚' : '白天'}`;
    for (const node of document.querySelectorAll('[data-phs-status]')) node.textContent = status;
    if(settings.enabled && !hub && !hubLoading)void loadHub();
}

function loadStatus(text, failed = false) {
    const node=panel?.querySelector('[data-phs-load-status]');
    if(node){node.textContent=text;node.classList.toggle('phs-load-error',failed);}
}
async function loadHub() {
    if(hub || hubLoading || !mounted || stopped)return;
    hubLoading=true;
    const run=generation;
    loadStatus('正在加载美化界面…');
    try {
        const { createHub }=await import('./hub.js?v=2.1.3');
        if(!mounted || stopped || run!==generation)return;
        hub=createHub({ context, settings, save: () => { save(); apply(); }, openAppearance: () => { apply(); if (!dialog.open) dialog.showModal(); }, toggleMode: () => setMode(resolveMode(settings,new Date(),media.matches)==='dark'?'light':'dark') });
        loadStatus('界面组件已就绪 · Lucas · 2.1.3');
        apply();
    } catch(error) {
        if(run!==generation || !mounted)return;
        document.getElementById('phs-shell')?.remove();
        loadStatus(`界面加载失败，请刷新页面重试。${error.message || ''}`,true);
        console.error('[Tavern Hub] 界面初始化失败，设置入口已保留。',error);
    } finally { if(run===generation)hubLoading=false; }
}

function setMode(mode) {
    if (!MODES.includes(mode)) return;
    settings.mode = mode;
    save(); apply();
}

function settingsContent(suffix) {
    return `<div class="phs-settings-body">
        <div class="phs-settings-intro">${brand()}<span class="phs-version">INDEPENDENT UI / 2.1.3</span></div>
        <p class="phs-description">黑橙界面，专注你的故事。</p>
        <p class="phs-hint">署名 Lucas。禁止商业使用、二次传播、二次修改。</p>
        <label class="phs-check"><input type="checkbox" data-phs-field="enabled"><span>启用独立框架美化</span></label>
        <label class="phs-label" for="phs-mode-${suffix}">日夜模式</label>
        <select id="phs-mode-${suffix}" data-phs-select>${MODES.map(mode => `<option value="${mode}">${labels[mode]}</option>`).join('')}</select>
        <div class="phs-schedule">
            <label for="phs-day-${suffix}">白天开始<input id="phs-day-${suffix}" type="time" data-phs-field="dayStart" required></label>
            <label for="phs-night-${suffix}">夜晚开始<input id="phs-night-${suffix}" type="time" data-phs-field="nightStart" required></label>
        </div>
        <p class="phs-hint">使用电脑的本地时间。手动选择后保持该模式，选择按时间后恢复自动切换。</p>
        <label class="phs-check"><input type="checkbox" data-phs-field="solid"><span>使用纯色背景</span></label>
        <p class="phs-status" data-phs-status role="status" aria-live="polite"></p>
        <p class="phs-hint">独立首页与导航，连接原生酒馆功能。消息正文、角色卡内嵌页面保持原样。请一次启用一款界面美化。</p>
    </div>`;
}

function mount() {
    if (mounted || stopped) return;
    const c = context();
    if (!c || !$('#sheld') || !$('#extensions_settings')) return;
    settings = normalize(c.extensionSettings[KEY] || DEFAULTS);
    c.extensionSettings[KEY] = settings;
    controller = new AbortController();
    const { signal } = controller;
    media = window.matchMedia('(prefers-color-scheme: dark)');
    panel = document.createElement('div');
    panel.id = 'phs-extension-settings';
    panel.innerHTML = `<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>Lucas · P站美化 / Tavern Hub</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"><p class="phs-hint" data-phs-load-status>设置已加载，勾选下方开关即可启用。</p>${settingsContent('extension')}</div></div>`;
    $('#extensions_settings').prepend(panel);
    const movePanelFirst=()=>{const host=$('#extensions_settings');if(host && panel?.isConnected && host.firstElementChild!==panel)host.prepend(panel);};
    panelReadyHandler=movePanelFirst;
    c.eventSource.once(c.eventTypes.APP_READY,panelReadyHandler);
    panelTimer=setTimeout(movePanelFirst,500);
    dialog = document.createElement('dialog');
    dialog.id = 'phs-dialog';
    dialog.setAttribute('aria-labelledby', 'phs-dialog-title');
    dialog.innerHTML = `<div class="phs-dialog-top"><h2 id="phs-dialog-title">外观设置</h2><button type="button" data-phs-close aria-label="关闭外观设置">${icon('xmark')}</button></div>${settingsContent('dialog')}<div class="phs-dialog-footer"><button type="button" data-phs-reset>恢复默认</button><button type="button" data-phs-close class="phs-primary">完成</button></div>`;
    document.body.append(dialog);
    document.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.hasAttribute('data-phs-mode')) setMode(button.dataset.phsMode);
        if (button.hasAttribute('data-phs-open')) { apply(); if (!dialog.open) dialog.showModal(); }
        if (button.hasAttribute('data-phs-close')) dialog.close();
        if (button.hasAttribute('data-phs-reset')) { const {favorites,likes}=settings; Object.assign(settings, DEFAULTS, { favorites,likes }); save(); apply(); }
    }, { signal });
    document.addEventListener('change', event => {
        const field = event.target;
        if (field.hasAttribute('data-phs-select')) setMode(field.value);
        if (field.hasAttribute('data-phs-field')) {
            const key = field.dataset.phsField;
            const value = field.type === 'checkbox' ? field.checked : field.value;
            if ((key === 'dayStart' || key === 'nightStart') && (!field.validity.valid || !value)) { apply(); return; }
            if ((key === 'dayStart' && value === settings.nightStart) || (key === 'nightStart' && value === settings.dayStart)) {
                window.toastr?.info('白天和夜晚的开始时间需要不同。'); apply(); return;
            }
            settings[key] = value; save(); apply();
        }
    }, { signal });
    media.addEventListener('change', apply, { signal });
    document.addEventListener('visibilitychange', apply, { signal });
    window.addEventListener('focus', apply, { signal });
    window.addEventListener('pageshow', apply, { signal });
    timer = window.setInterval(apply, 15000);
    mounted = true;
    clearTimeout(bootTimer);
    apply();
}

export function onDisable() {
    stopped=true;generation++;hubLoading=false;clearTimeout(bootTimer);clearTimeout(panelTimer);
    document.removeEventListener('DOMContentLoaded',boot);
    if(readyHandler){const c=context();c?.eventSource.removeListener(c.eventTypes.APP_READY,readyHandler);readyHandler=undefined;}
    if(panelReadyHandler){const c=context();c?.eventSource.removeListener(c.eventTypes.APP_READY,panelReadyHandler);panelReadyHandler=undefined;}
    if (!mounted) return;
    controller.abort(); clearInterval(timer);
    if (dialog.open) dialog.close();
    hub?.destroy();hub=undefined; panel.remove(); dialog.remove();
    document.body.classList.remove('phs-enabled', 'phs-solid');
    delete document.body.dataset.phsMode;
    mounted = false;
}
export function onEnable() { stopped=false;bootAttempts=0;boot(); }

// Use the host's readiness event; never import or reuse another theme extension.
function boot() {
    if(stopped || mounted)return;
    clearTimeout(bootTimer);
    mount();
    if(!mounted && ++bootAttempts<40)bootTimer=setTimeout(boot,250);
    else if(!mounted)console.error('[Tavern Hub] 未找到酒馆设置容器，请刷新页面重试。');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
boot();
if (!mounted) {
    const c = context();
    if (c?.eventTypes?.APP_READY) {
        readyHandler = () => boot();
        c.eventSource.once(c.eventTypes.APP_READY, readyHandler);
    }
}
