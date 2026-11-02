/* 署名 Lucas。禁止商业使用、二次传播、二次修改。使用声明见 NOTICE.txt。 */
import { escapeHTML as esc, plainText, characterEntities, personFor, filteredEntities, recordKey, selectedUser } from './hub-model.js';
import { createWatch } from './watch.js';
import { user_avatar } from '/scripts/personas.js';

const icon = name => `<i class="fa-solid fa-${name}" aria-hidden="true"></i>`;
const mark = '<span class="phs-logo"><span>Porn</span><b>hub</b></span>';
const routes = {
    characters: '#rightNavHolder > .drawer-toggle',
    api: '#sys-settings-button > .drawer-toggle',
    world: '#WI-SP-button > .drawer-toggle',
    persona: '#persona-management-button > .drawer-toggle',
    backgrounds: '#backgrounds-button > .drawer-toggle',
    extensions: '#extensions-settings-button > .drawer-toggle',
    settings: '#user-settings-button > .drawer-toggle',
    generation: '#ai-config-button > .drawer-toggle',
    formatting: '#advanced-formatting-button > .drawer-toggle',
    history: '#option_select_chat',
};
const navigation = [['home','首页'],['library','角色'],['categories','分类'],['recent','聊天记录'],['world','世界书'],['extensions','扩展工具'],['backgrounds','图片']];
const menuItems = [['home','house','首页'],['library','film','全部角色'],['favorites','heart','我的收藏'],['recent','clock-rotate-left','最近聊天'],['characters','address-card','角色管理'],['upload','upload','导入角色'],['world','book','世界书'],['api','plug','API 连接'],['generation','sliders','回复配置'],['formatting','font','提示词与格式'],['persona','user','用户设定'],['backgrounds','image','背景图片'],['extensions','cubes','扩展程序'],['settings','gear','酒馆设置'],['appearance','circle-half-stroke','日夜与外观']];

export function createHub({ context, settings, save, openAppearance, toggleMode }) {
    const $ = selector => document.querySelector(selector);
    const controller = new AbortController();
    const { signal } = controller;
    const disposers = [];
    let active = false, destroyed = false, busy = false, loading = false, failed = false;
    let view = 'home', category = 'all', query = '', sort = 'recent', page = 1, records = [];
    let refreshTimer, personaObserver, personaNameNode, personaAvatar = '', personaRevision = 0;
    const entities = () => characterEntities(context());
    const timestamp = value => {
        const moment = context().timestampToMoment(value);
        return moment?.isValid() ? Number(moment.valueOf()) : 0;
    };
    const dateText = value => {
        const moment = context().timestampToMoment(value);
        return moment?.isValid() ? moment.fromNow() : '尚无聊天';
    };
    const hasChat = () => context().characterId != null || Boolean(context().groupId);
    const favored = person => settings.favorites.includes(person.key) || person.nativeFavorite;
    const button = (action, label, name, cls = '') => `<button type="button" class="${cls}" data-phs-action="${action}" aria-label="${esc(label)}" title="${esc(label)}">${icon(name)}</button>`;

    const root = document.createElement('div');
    root.id = 'phs-shell';
    root.innerHTML = `<div id="phs-header-wrap">
        <div class="phs-network"><div><span class="phs-network-brand">TAVERN NETWORK</span><button data-phs-action="api" type="button">API 连接</button><button data-phs-action="generation" type="button">回复配置</button><button data-phs-action="formatting" type="button">提示词</button><button data-phs-action="extensions" type="button">扩展程序</button></div><button type="button" data-phs-action="appearance">${icon('circle-half-stroke')}<span data-phs-short-status></span></button></div>
        <header id="phs-header"><div class="phs-header-inner">
            ${button('menu','打开主菜单','bars','phs-menu-button')}
            <button class="phs-home-logo" type="button" data-phs-action="home" aria-label="Pornhub 风格酒馆首页">${mark}</button>
            <form id="phs-search" role="search"><input type="search" id="phs-search-input" placeholder="搜索角色、标签和故事" aria-label="搜索角色、标签和故事" autocomplete="off"><button type="submit" aria-label="搜索">${icon('magnifying-glass')}</button></form>
            <div class="phs-account-actions"><button type="button" data-phs-action="upload" class="phs-upload" aria-label="上传角色" title="上传角色">${icon('upload')}<span>上传角色</span></button>${button('recent','最近聊天','envelope')}<button type="button" data-phs-action="account" class="phs-account-button" aria-label="我的账户与工具"><img data-phs-user-avatar alt="" src="/img/user-default.png"><span data-phs-user-name>User</span></button>${button('theme','切换日夜模式','moon','phs-theme-button')}</div>
        </div></header>
        <nav id="phs-navigation" aria-label="主导航"><div>${navigation.map(([action,label]) => `<button type="button" data-phs-action="${action}" ${action==='home'?'aria-current="page"':''}>${label}${['library','categories'].includes(action)?icon('chevron-down'):''}</button>`).join('')}<button type="button" class="phs-favorites-link" data-phs-action="favorites">${icon('heart')} 我的收藏</button></div></nav>
    </div>
    <main id="phs-home" aria-label="角色与聊天首页" tabindex="-1"><div id="phs-discovery"></div></main>
    <main id="phs-watch" aria-label="角色对话详情" tabindex="0" hidden></main>
    <button id="phs-close-native" data-phs-action="close-native" type="button">${icon('xmark')} 关闭酒馆面板</button>
    <dialog id="phs-menu" aria-labelledby="phs-menu-title"><header><strong id="phs-menu-title">${mark}</strong>${button('close-menu','关闭菜单','xmark')}</header><div class="phs-menu-user"><img data-phs-user-avatar alt="" src="/img/user-default.png"><div><strong data-phs-user-name>User</strong><small>当前用户设定</small></div><button type="button" data-phs-action="persona" aria-label="切换用户设定"><i class="fa-solid fa-user-pen" aria-hidden="true"></i></button></div><div class="phs-menu-body">${menuItems.map(([action,name,label])=>`<button type="button" data-phs-action="${action}">${icon(name)}<span>${label}</span>${icon('angle-right')}</button>`).join('')}</div><footer><button type="button" data-phs-action="disable">停用本款美化</button><span>Lucas · 2.1.3</span></footer></dialog>
    <dialog id="phs-upload" aria-labelledby="phs-upload-title"><header><strong id="phs-upload-title">上传到我的角色库</strong>${button('close-upload','关闭上传选择','xmark')}</header><div class="phs-upload-choices"><p>添加你喜欢的角色，在自己的酒馆里开始故事。</p><button type="button" data-phs-action="import-file">${icon('file-arrow-up')}<span><strong>从文件导入角色</strong><small>使用酒馆原生文件导入</small></span>${icon('angle-right')}</button><button type="button" data-phs-action="create-character">${icon('user-plus')}<span><strong>创建新角色</strong><small>打开酒馆原生角色编辑器</small></span>${icon('angle-right')}</button></div></dialog>`;
    document.body.append(root);
    const watch = createWatch({ mount: $('#phs-watch'), context, settings, save, entities, records: () => records, favored,
        onAction: name => action(name), onPerson: (key, record) => openPerson(key, record),
        onCategory: tag => { query=''; category=tag; view='library'; page=1; $('#phs-search-input').value=''; render(); },
    });

    function updatePersona(refreshImage = false) {
        if (destroyed) return;
        if (personaAvatar !== user_avatar) { personaAvatar=user_avatar; personaRevision=0; }
        if (refreshImage) personaRevision=Date.now();
        const user=selectedUser(context(),user_avatar,personaRevision);
        root.querySelectorAll('[data-phs-user-name]').forEach(node=>{node.textContent=user.name;node.title=user.name;});
        root.querySelectorAll('[data-phs-user-avatar]').forEach(node=>{
            if(node.getAttribute('src')!==user.avatar)node.setAttribute('src',user.avatar);
            node.alt=user.name;
        });
        const account=root.querySelector('.phs-account-button');
        account.setAttribute('aria-label',`${user.name} · 我的账户与工具`);
        account.title=`${user.name} · 我的账户与工具`;
    }
    function observePersonaName() {
        const node=document.getElementById('your_name');
        if(!node || node===personaNameNode)return;
        personaObserver?.disconnect();personaNameNode=node;
        personaObserver=new MutationObserver(()=>updatePersona());
        personaObserver.observe(node,{childList:true,characterData:true,subtree:true});
    }
    root.addEventListener('error',event=>{
        const img=event.target;
        if(img instanceof HTMLImageElement && img.hasAttribute('data-phs-user-avatar') && img.getAttribute('src')!=='/img/user-default.png')img.src='/img/user-default.png';
    },{signal,capture:true});
    for(const name of ['PERSONA_CHANGED','PERSONA_RENAMED','PERSONA_UPDATED','PERSONA_CREATED','PERSONA_DELETED']){
        const type=context().eventTypes[name];if(!type)continue;
        const handler=()=>updatePersona(name==='PERSONA_UPDATED');
        context().eventSource.on(type,handler);disposers.push(()=>context().eventSource.removeListener(type,handler));
    }
    observePersonaName();

    function closeDialog(id) { const dialog = $(id); if (dialog?.open) dialog.close(); }
    function closeMenus() { closeDialog('#phs-menu'); closeDialog('#phs-upload'); }
    function openDialog(id) { const dialog = $(id); if (!dialog.open) dialog.showModal(); }
    function closeNative() {
        const history = $('#shadow_select_chat_popup');
        if (history && getComputedStyle(history).display !== 'none') {
            const close = $('#select_chat_cross');
            if (close) window.jQuery ? window.jQuery(close).trigger('click') : close.click();
        }
        document.querySelectorAll('#top-settings-holder > .drawer > .drawer-content.openDrawer').forEach(panel => {
            const toggle = panel.parentElement.querySelector(':scope > .drawer-toggle');
            if (toggle) window.jQuery ? window.jQuery(toggle).trigger('click') : toggle.click();
        });
    }
    function native(action) {
        closeMenus(); closeNative();
        if (action === 'history' && !hasChat()) { window.toastr?.info('先打开一个角色，再查看它的聊天记录。'); return; }
        const target = $(routes[action]);
        if (!target) { window.toastr?.warning('当前酒馆版本没有找到这个入口。'); return; }
        window.jQuery ? window.jQuery(target).trigger('click') : target.click();
    }

    function setView(next) {
        closeMenus(); closeNative();
        if (next === 'chat' && !hasChat()) { setView('recent'); return; }
        view = next; page = 1;
        if (!['library','favorites','categories'].includes(next)) category = 'all';
        if (next === 'favorites') category = 'favorites';
        render();
        if (next !== 'chat') void loadRecent();
    }

    function card(person, record) {
        const recent = record || records.find(item => personFor(item, [person]));
        const description = plainText(recent?.mes || person.description);
        const count = recent ? `${Number(recent.chat_items) || 0} 条消息` : person.kind === 'group' ? '群组' : '角色卡';
        const key = recent && view === 'recent' ? `data-phs-record="${esc(recordKey(recent))}"` : '';
        return `<article class="phs-card"><div class="phs-thumbnail"><button type="button" data-phs-person="${esc(person.key)}" ${key} aria-label="与 ${esc(person.name)} 聊天"><img src="${esc(person.cover)}" alt="${esc(person.name)}" loading="lazy"><span class="phs-play">${icon('play')}</span><span class="phs-card-kind">${person.kind==='group'?'GROUP':'CHARACTER'}</span><span class="phs-duration">${count}</span></button><button type="button" class="phs-save-card" data-phs-favorite="${esc(person.key)}" aria-label="${favored(person)?'取消收藏':'收藏'} ${esc(person.name)}" aria-pressed="${favored(person)}">${icon('heart')}</button></div><button type="button" class="phs-card-title" data-phs-person="${esc(person.key)}" ${key}>${esc(person.name)} ${icon('circle-check')}</button><p class="phs-card-description">${esc(description || '打开角色，开始一段新的故事。')}</p><div class="phs-card-meta"><span>${person.kind==='group'?'群组对话':'本地角色'} ${icon('circle-check')}</span><span>${recent?esc(dateText(recent.last_mes)):'尚未聊天'}</span></div></article>`;
    }

    function renderDiscovery() {
        const all = entities();
        const filtered = filteredEntities(all, { query, category, favorites: settings.favorites, sort, records, timestamp });
        const tags = [...new Set(all.flatMap(person=>person.tags))].slice(0,12);
        const validRecords = records.filter(record => personFor(record, all));
        const visibleRecords = validRecords.filter(record => filtered.some(person=>personFor(record,[person])));
        const title = query ? `搜索结果 · ${query}` : {home:'为你推荐的角色',library:'全部角色',categories:'探索角色分类',favorites:'我的收藏',recent:'最近的聊天'}[view] || '角色库';
        const items = view === 'recent' ? visibleRecords.map(record=>({person:personFor(record,all),record})) : filtered.map(person=>({person}));
        const size = 24, pageCount = Math.ceil(items.length / size);
        page = Math.max(1,Math.min(page,pageCount || 1));
        const recentPerson = personFor(validRecords[0] || {},all);
        const favoriteCount = all.filter(favored).length;
        $('#phs-discovery').innerHTML = `<div class="phs-trending" aria-label="角色分类">${[['all','全部'],['character','角色'],['group','群组'],['favorites','已收藏'],...tags.map(tag=>[tag,tag])].map(([value,label])=>`<button type="button" data-phs-category="${esc(value)}" aria-pressed="${category===value}">${esc(label)}</button>`).join('')}</div>
        <div class="phs-content-layout"><section class="phs-catalog"><div class="phs-section-heading"><h1>${esc(title)}</h1><label class="phs-sort">${icon('arrow-down-wide-short')}<select id="phs-sort" aria-label="角色排序"><option value="recent" ${sort==='recent'?'selected':''}>最近聊天</option><option value="name" ${sort==='name'?'selected':''}>名称排序</option></select></label></div><div class="phs-result-count">${view==='recent'?`${items.length} 段聊天`:`${filtered.length} 个角色和群组`}<span>来自你的本地酒馆</span>${loading?' · 正在读取聊天…':''}</div>
        ${failed?'<div class="phs-inline-error">聊天记录暂时未能读取。<button type="button" data-phs-action="retry">重新读取</button></div>':''}
        ${view==='home' && recentPerson && !query ? `<button type="button" class="phs-resume" data-phs-person="${esc(recentPerson.key)}" data-phs-record="${esc(recordKey(validRecords[0]))}"><img src="${esc(recentPerson.avatar)}" alt=""><span><small>继续上次的故事</small><strong>${esc(recentPerson.name)}</strong></span><span class="phs-resume-time">${esc(dateText(validRecords[0].last_mes))}</span>${icon('play')}</button>`:''}
        <div class="phs-card-grid">${items.slice((page-1)*size,page*size).map(item=>card(item.person,item.record)).join('')}${!items.length?`<div class="phs-empty">${icon(query?'magnifying-glass':'film')}<h2>${query?'没有找到匹配的角色':view==='favorites'?'还没有收藏角色':view==='recent'?'还没有聊天记录':'这里还没有角色'}</h2><p>${query?'试试角色名称或已有标签。':view==='favorites'?'点击角色封面上的爱心，就可以在这里找到它。':'导入自己的角色卡，开始新的故事。'}</p><button type="button" data-phs-action="${query?'clear-search':'upload'}">${query?'清除搜索':'添加角色'}</button></div>`:''}</div>
        ${pageCount>1?`<div class="phs-pagination">${Array.from({length:pageCount},(_,i)=>`<button type="button" data-phs-page="${i+1}" aria-current="${page===i+1?'page':'false'}">${i+1}</button>`).join('')}</div>`:''}
        ${all.length>0 && all.length<4 && !query && view==='home'?'<div class="phs-library-note"><strong>把喜欢的故事放进你的角色库</strong><p>从角色卡文件导入，或创建属于自己的角色。</p><button type="button" data-phs-action="upload">导入角色</button><button type="button" data-phs-action="create-character">创建角色</button></div>':''}
        </section><aside class="phs-channel"><div class="phs-channel-card"><div class="phs-channel-banner">MY CHANNEL</div><div class="phs-channel-content"><div class="phs-profile-icon"><img data-phs-user-avatar alt="" src="/img/user-default.png"></div><h2 data-phs-user-name>User</h2><p>你的角色，你的故事。</p><div class="phs-channel-stats"><button data-phs-action="library" type="button"><strong>${all.length}</strong><span>角色</span></button><button data-phs-action="recent" type="button"><strong>${validRecords.length}</strong><span>聊天</span></button><button data-phs-action="favorites" type="button"><strong>${favoriteCount}</strong><span>收藏</span></button></div><button type="button" class="phs-channel-primary" data-phs-action="persona">编辑我的设定</button></div></div><div class="phs-quick-links"><h3>酒馆工具</h3>${[['api','plug','API 连接'],['world','book','世界书'],['generation','sliders','回复配置'],['extensions','cubes','扩展程序'],['appearance','circle-half-stroke','日夜与外观']].map(([action,name,label])=>`<button data-phs-action="${action}" type="button">${icon(name)}${label}${icon('angle-right')}</button>`).join('')}</div></aside></div>
        <footer class="phs-footer"><span>${mark}<small>本地酒馆独立美化</small></span><div><button type="button" data-phs-action="characters">管理角色</button><button type="button" data-phs-action="settings">酒馆设置</button><button type="button" data-phs-action="appearance">外观设置</button></div><p>所有角色和聊天来自你的本地酒馆。</p></footer>`;
        updatePersona();
    }

    function render() {
        if (destroyed) return;
        observePersonaName();
        if (active) document.body.dataset.phsView = view === 'chat' ? 'chat' : 'home';
        $('#phs-home').hidden = view === 'chat';
        watch.setVisible(active && view === 'chat');
        root.querySelectorAll('#phs-navigation button').forEach(node => {
            if (node.dataset.phsAction === view) node.setAttribute('aria-current','page');
            else node.removeAttribute('aria-current');
        });
        if (view !== 'chat') renderDiscovery();
        else watch.render();
        updatePersona();
    }

    async function loadRecent() {
        if (loading || destroyed) return;
        loading = true; failed = false;
        try {
            const response = await fetch('/api/chats/recent',{method:'POST',headers:context().getRequestHeaders(),body:JSON.stringify({max:200}),signal,cache:'no-cache'});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!destroyed) records = (Array.isArray(data)?data:[]).filter(record=>record.file_name).sort((a,b)=>timestamp(b.last_mes)-timestamp(a.last_mes));
        } catch(error) {
            if (error.name !== 'AbortError') { failed=true; console.warn('[Tavern Hub] 聊天记录读取失败',error.message); }
        } finally { loading=false; if (!destroyed) { if(view!=='chat')renderDiscovery();else watch.render(); } }
    }

    async function openPerson(key, keyRecord) {
        if (busy) return;
        const person = entities().find(item=>item.key===key);
        if (!person) { window.toastr?.warning('这个角色已不在本地角色库中。'); return; }
        const c = context();
        if ($('#curEditTextarea') || $('.edit_textarea') || $('.reasoning_edit_textarea')) { window.toastr?.info('请先完成或取消当前消息编辑。'); return; }
        if (c.streamingProcessor && !c.streamingProcessor.isFinished) { window.toastr?.info('请先等待回复完成，或停止生成。'); return; }
        busy=true; root.setAttribute('aria-busy','true'); closeMenus(); closeNative();
        try {
            const record = keyRecord ? records.find(item=>recordKey(item)===keyRecord) : null;
            if (person.kind==='group') {
                const { openGroupById } = await import('/scripts/group-chats.js');
                await openGroupById(person.id);
                if (record) await context().openGroupChat(person.id,record.file_name.replace(/\.jsonl$/,''));
            } else {
                await c.selectCharacterById(person.id,{switchMenu:false});
                if (record) await context().openCharacterChat(record.file_name.replace(/\.jsonl$/,''));
            }
            const current = context();
            if (person.kind==='group' ? String(current.groupId)!==String(person.id) : String(current.characterId)!==String(person.id)) throw new Error('角色未能切换');
            if (record && String(current.getCurrentChatId())!==record.file_name.replace(/\.jsonl$/,'')) throw new Error('聊天记录未能打开');
            setView('chat');
        } catch(error) { console.warn('[Tavern Hub] 打开聊天失败',error.message); window.toastr?.error('聊天暂时无法打开，请重试。'); }
        finally { busy=false; root.removeAttribute('aria-busy'); }
    }

    async function action(name) {
        if (['home','library','favorites','recent','chat'].includes(name)) { query=''; $('#phs-search-input').value=''; setView(name); return; }
        if (name==='categories') { query=''; category='all'; setView('categories'); return; }
        if (name==='menu' || name==='account') { openDialog('#phs-menu'); return; }
        if (name==='close-menu') { closeDialog('#phs-menu'); return; }
        if (name==='close-upload') { closeDialog('#phs-upload'); return; }
        if (name==='upload') { closeMenus(); openDialog('#phs-upload'); return; }
        if (name==='appearance') { closeMenus(); openAppearance(); return; }
        if (name==='theme') { toggleMode(); return; }
        if (name==='disable') { closeMenus(); settings.enabled=false; save(); return; }
        if (name==='retry') { void loadRecent(); return; }
        if (name==='close-native') { closeNative(); return; }
        if (name==='clear-search') { query=''; category='all'; $('#phs-search-input').value=''; render(); return; }
        if (name==='import-file' || name==='create-character') {
            native('characters');
            const target=$(name==='import-file'?'#character_import_button':'#rm_button_create');
            if (target) window.jQuery ? window.jQuery(target).trigger('click') : target.click();
            return;
        }
        if (routes[name]) native(name);
    }

    root.addEventListener('click', event => {
        const target = event.target.closest('button'); if (!target) return;
        if (target.dataset.phsAction) void action(target.dataset.phsAction);
        if (target.dataset.phsPerson) void openPerson(target.dataset.phsPerson,target.dataset.phsRecord);
        if (target.dataset.phsFavorite) {
            const key=target.dataset.phsFavorite;
            const at=settings.favorites.indexOf(key);
            const person=entities().find(item=>item.key===key);
            if (person?.nativeFavorite && at<0) { window.toastr?.info('这是酒馆原生收藏，可在角色管理里取消。'); return; }
            if (at<0) settings.favorites.push(key); else settings.favorites.splice(at,1);
            save(); renderDiscovery();
        }
        if (target.dataset.phsCategory) { category=target.dataset.phsCategory; page=1; if(view==='chat')view='library'; render(); }
        if (target.dataset.phsPage) { page=Number(target.dataset.phsPage); renderDiscovery(); $('#phs-home').scrollTop=0; }
    },{signal});
    $('#phs-search').addEventListener('submit',event=>{event.preventDefault();query=$('#phs-search-input').value.trim();view='library';page=1;render();},{signal});
    $('#phs-search-input').addEventListener('input',event=>{query=event.target.value;view='library';page=1;render();},{signal});
    root.addEventListener('change',event=>{if(event.target.id==='phs-sort'){sort=event.target.value;page=1;renderDiscovery();}},{signal});
    const resize = () => {
        if (active) document.body.style.setProperty('--phs-header-height',`${$('#phs-header-wrap').offsetHeight}px`);
        watch.sync();
    };
    const observer = new ResizeObserver(resize); observer.observe($('#phs-header-wrap'));
    window.addEventListener('resize',resize,{signal});
    for (const name of ['APP_READY','CHARACTER_EDITED','CHARACTER_DELETED','GROUP_UPDATED','CHAT_CHANGED','USER_MESSAGE_RENDERED','CHARACTER_MESSAGE_RENDERED','GENERATION_ENDED']) {
        const type=context().eventTypes[name]; if(!type)continue;
        const handler=()=>{
            clearTimeout(refreshTimer);
            refreshTimer=setTimeout(()=>{if(!destroyed){render();void loadRecent();}},100);
        };
        context().eventSource.on(type,handler);
        disposers.push(()=>context().eventSource.removeListener(type,handler));
    }
    render(); void loadRecent();
    return {
        root,
        setActive(value) {
            const changed=active!==value; active=value; root.hidden=!active;
            if(active){document.body.classList.add('phs-hub');if(changed)render();resize();}
            else{watch.setVisible(false);document.body.classList.remove('phs-hub');delete document.body.dataset.phsView;document.body.style.removeProperty('--phs-header-height');closeMenus();}
        },
        updateMode(mode, label) {
            root.querySelector('[data-phs-short-status]').textContent=label;
            const toggle=root.querySelector('.phs-theme-button');
            toggle.innerHTML=icon(mode==='dark'?'sun':'moon');
            toggle.setAttribute('aria-label',mode==='dark'?'切换到白天模式':'切换到夜晚模式');
            toggle.title=toggle.getAttribute('aria-label');
        },
        destroy() {
            destroyed=true;controller.abort();clearTimeout(refreshTimer);observer.disconnect();personaObserver?.disconnect();watch.destroy();disposers.forEach(fn=>fn());closeMenus();root.remove();
            document.body.classList.remove('phs-hub');delete document.body.dataset.phsView;document.body.style.removeProperty('--phs-header-height');
        },
    };
}
