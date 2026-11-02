/* 署名 Lucas。禁止商业使用、二次传播、二次修改。使用声明见 NOTICE.txt。 */
import { escapeHTML as esc, plainText, recordKey } from './hub-model.js';

const icon = name => `<i class="fa-solid fa-${name}" aria-hidden="true"></i>`;
const geometryProperties = ['--phs-stage-top','--phs-stage-left','--phs-stage-width','--phs-stage-height','--phs-stage-clip-top','--phs-stage-clip-bottom'];

export function createWatch({ mount, context, settings, save, entities, records, favored, onAction, onPerson, onCategory }) {
    const controller = new AbortController();
    const { signal } = controller;
    let visible = false, destroyed = false, frame, progressFrame, signature = '', activeChat = '', theater = false, focus = false;
    const $ = selector => mount.querySelector(selector);
    const currentPerson = () => entities().find(person => context().groupId ? person.kind === 'group' && String(person.id) === String(context().groupId) : person.kind === 'character' && String(person.id) === String(context().characterId));
    const currentRecord = person => records().find(record => (record.group != null ? String(record.group) === String(context().groupId) : record.avatar === person?.key) && record.file_name?.replace(/\.jsonl$/,'') === String(context().getCurrentChatId()));
    const chatKey = person => JSON.stringify([person?.key, context().getCurrentChatId()]);
    const when = value => { const m=context().timestampToMoment(value); return m?.isValid() ? m.fromNow() : '本地对话'; };

    mount.innerHTML = `<div class="phs-watch-page"><div class="phs-watch-breadcrumb"><button type="button" data-phs-watch-action="home">首页</button><span>/</span><button type="button" data-phs-watch-action="library">角色</button><span>/</span><span id="phs-watch-breadcrumb-name"></span></div>
        <div class="phs-watch-layout"><section class="phs-watch-main" aria-label="当前角色对话">
            <div class="phs-player-frame"><div class="phs-player-heading"><span class="phs-live-dot"></span><span>私人对话</span><span id="phs-player-name"></span><button type="button" data-phs-watch-action="generation" aria-label="AI 回复配置" title="AI 回复配置">${icon('sliders')}</button></div>
                <div id="phs-stage-placeholder" aria-hidden="true"></div>
                <div class="phs-reading-track"><input type="range" id="phs-reading-position" min="0" max="100" value="0" aria-label="聊天阅读位置"></div>
                <div class="phs-player-controls"><button type="button" data-phs-watch-action="latest" aria-label="回到最新消息" title="回到最新消息">${icon('angles-down')}</button><span id="phs-player-count"></span><span class="phs-readout" id="phs-reading-percent">0%</span><div class="phs-player-view-controls"><button type="button" data-phs-watch-action="history" aria-label="打开当前角色聊天记录" title="聊天记录">${icon('clock-rotate-left')}</button><button type="button" data-phs-watch-action="theater" aria-label="切换宽屏模式" aria-pressed="false" title="宽屏模式">${icon('desktop')}</button><button type="button" data-phs-watch-action="focus" aria-label="进入专注模式" aria-pressed="false" title="专注模式">${icon('expand')}</button></div></div>
            </div><div id="phs-watch-details"></div>
        </section><aside id="phs-watch-related" aria-label="相关角色与聊天"></aside></div></div>`;
    const stage = $('#phs-stage-placeholder');
    const chat = document.getElementById('chat');

    function updateProgress() {
        progressFrame = undefined;
        if (!visible || destroyed) return;
        const max = Math.max(0, chat.scrollHeight-chat.clientHeight);
        const value = max ? Math.round(Math.min(1,Math.max(0,chat.scrollTop/max))*100) : 100;
        $('#phs-reading-position').value=String(value);
        $('#phs-reading-position').style.setProperty('--phs-read-progress',`${value}%`);
        $('#phs-reading-percent').textContent=`${value}%`;
        $('#phs-player-count').textContent=`${context().chat?.length || 0} 条消息`;
    }
    function scheduleProgress() { if (!progressFrame) progressFrame=requestAnimationFrame(updateProgress); }

    function syncNow() {
        frame=undefined;
        if (!visible || destroyed) return;
        const r=stage.getBoundingClientRect(), viewport=mount.getBoundingClientRect();
        const values={
            '--phs-stage-top':r.top,'--phs-stage-left':r.left,'--phs-stage-width':r.width,'--phs-stage-height':r.height,
            '--phs-stage-clip-top':Math.min(r.height,Math.max(0,viewport.top-r.top)),
            '--phs-stage-clip-bottom':Math.min(r.height,Math.max(0,r.bottom-viewport.bottom)),
        };
        for(const [key,value] of Object.entries(values))document.body.style.setProperty(key,`${value}px`);
        updateProgress();
    }
    function sync() { if (!frame) frame=requestAnimationFrame(syncNow); }
    function setFocus(value) {
        focus=value;document.body.classList.toggle('phs-focus',focus);
        const control=$('[data-phs-watch-action="focus"]');control.setAttribute('aria-pressed',String(focus));
        control.setAttribute('aria-label',focus?'退出专注模式':'进入专注模式');control.title=focus?'退出专注模式':'专注模式';
        control.innerHTML=icon(focus?'compress':'expand');
        if(visible){mount.scrollTop=0;sync();}
    }

    function render(force = false) {
        if (destroyed) return;
        const person=currentPerson(); if(!person)return;
        const changed=activeChat!==chatKey(person);
        if(changed){activeChat=chatKey(person);mount.scrollTop=0;}
        const record=currentRecord(person);
        const count=context().chat?.length || 0;
        const liked=settings.likes.includes(chatKey(person));
        const next=JSON.stringify([person,context().getCurrentChatId(),count,favored(person),liked,records().map(r=>[r.file_name,r.last_mes])]);
        $('#phs-player-name').textContent=person.name;
        $('#phs-watch-breadcrumb-name').textContent=person.name;
        $('#phs-player-count').textContent=`${count} 条消息`;
        if(!force && signature===next){sync();return;}
        signature=next;
        const expanded=!changed && $('.phs-watch-description')?.open;
        const tags=person.tags || [];
        $('#phs-watch-details').innerHTML=`<div class="phs-watch-title-row"><h1 id="phs-chat-title">${esc(person.name)}<span>私人对话</span></h1><span class="phs-watch-local">${icon('lock')} 仅在本地</span></div>
            <div class="phs-watch-meta"><span>${count} 条消息</span><span>${record?esc(when(record.last_mes)):'当前聊天'}</span><span>${person.kind==='group'?'群组对话':'角色对话'}</span></div>
            <div class="phs-watch-actions"><button type="button" data-phs-watch-action="like" aria-pressed="${liked}">${icon('thumbs-up')}<span>${liked?'已点赞':'点赞'}</span></button><button type="button" data-phs-watch-action="favorite" aria-pressed="${favored(person)}">${icon('heart')}<span>${favored(person)?'已收藏':'收藏角色'}</span></button><button type="button" data-phs-watch-action="export">${icon('download')}<span>导出文本</span></button><button type="button" data-phs-watch-action="copy">${icon('share-from-square')}<span>复制信息</span></button><button type="button" data-phs-watch-action="menu">${icon('ellipsis')}<span>更多</span></button></div>
            <section class="phs-watch-channel" aria-label="角色频道"><button type="button" data-phs-watch-action="characters" class="phs-watch-avatar" aria-label="查看 ${esc(person.name)} 的角色资料"><img src="${esc(person.avatar)}" alt="${esc(person.name)}"></button><div><h2>${esc(person.name)} ${icon('circle-check')}</h2><p>${person.kind==='group'?'群组频道':'本地角色频道'}</p></div><button type="button" data-phs-watch-action="characters" class="phs-watch-channel-button">查看角色</button></section>
            <details class="phs-watch-description" ${expanded?'open':''}><summary>角色简介 <span>展开查看</span></summary><p>${esc(person.description || '这个角色还没有填写简介。')}</p>${tags.length?`<div class="phs-watch-tags">${tags.map(tag=>`<button type="button" data-phs-watch-category="${esc(tag)}">${esc(tag)}</button>`).join('')}</div>`:''}</details>
            <div class="phs-watch-bottom-links"><button type="button" data-phs-watch-action="history">${icon('list')} 管理聊天记录</button><button type="button" data-phs-watch-action="world">${icon('book')} 世界书</button><button type="button" data-phs-watch-action="appearance">${icon('circle-half-stroke')} 外观设置</button></div>`;
        const related=entities().filter(item=>item.key!==person.key).sort((a,b)=>b.tags.filter(tag=>tags.includes(tag)).length-a.tags.filter(tag=>tags.includes(tag)).length).slice(0,10);
        const history=records().filter(item=>item.group!=null ? String(item.group)===String(person.id) : item.avatar===person.key).slice(0,5);
        $('#phs-watch-related').innerHTML=`<div class="phs-related-heading"><h2>为你推荐</h2><button type="button" data-phs-watch-action="library">全部角色 ${icon('angle-right')}</button></div>${related.length?related.map(item=>`<button type="button" class="phs-related-card" data-phs-watch-person="${esc(item.key)}"><span class="phs-related-cover"><img src="${esc(item.cover)}" alt="${esc(item.name)}" loading="lazy"><i>${icon('play')}</i></span><span><strong>${esc(item.name)}</strong><small>${esc(item.description.slice(0,65) || '开始一段新的故事')}</small><em>${item.kind==='group'?'群组对话':'本地角色'}</em></span></button>`).join(''):`<div class="phs-related-empty">${icon('film')}<strong>探索更多故事</strong><p>角色库里还没有其他角色。</p><button type="button" data-phs-watch-action="upload">导入角色</button></div>`}
            <div class="phs-related-history"><h3>这个角色的聊天</h3>${history.length?history.map(item=>`<button type="button" data-phs-watch-person="${esc(person.key)}" data-phs-watch-record="${esc(recordKey(item))}"><img src="${esc(person.avatar)}" alt=""><span><strong>${esc(plainText(item.mes).slice(0,50) || '空白对话')}</strong><small>${Number(item.chat_items)||0} 条消息 · ${esc(when(item.last_mes))}</small></span>${item.file_name?.replace(/\.jsonl$/,'')===String(context().getCurrentChatId())?'<em>当前</em>':icon('play')}</button>`).join(''):'<p>暂无已保存的记录</p>'}</div>
            <div class="phs-watch-shortcuts"><h3>对话工具</h3>${[['generation','sliders','回复配置'],['world','book','世界书'],['persona','user','用户设定'],['extensions','cubes','扩展程序']].map(([action,name,label])=>`<button type="button" data-phs-watch-action="${action}">${icon(name)}${label}${icon('angle-right')}</button>`).join('')}</div>`;
        sync();
    }

    async function action(name) {
        const person=currentPerson();
        if(name==='latest'){chat.scrollTo({top:chat.scrollHeight,behavior:'auto'});updateProgress();return;}
        if(name==='theater'){
            theater=!theater;document.body.classList.toggle('phs-theater',theater);
            $('[data-phs-watch-action="theater"]').setAttribute('aria-pressed',String(theater));mount.scrollTop=0;sync();return;
        }
        if(name==='focus'){
            setFocus(!focus);return;
        }
        if(!person)return;
        if(name==='like'){
            const key=chatKey(person),index=settings.likes.indexOf(key);
            if(index<0)settings.likes.push(key);else settings.likes.splice(index,1);
            save();render();return;
        }
        if(name==='favorite'){
            const index=settings.favorites.indexOf(person.key);
            if(person.nativeFavorite && index<0){window.toastr?.info('这是酒馆原生收藏，可在角色管理里取消。');return;}
            if(index<0)settings.favorites.push(person.key);else settings.favorites.splice(index,1);
            save();render();return;
        }
        if(name==='copy'){
            const text=`角色：${person.name}\n聊天：${context().getCurrentChatId() || '当前对话'}\n消息：${context().chat?.length || 0} 条`;
            try{await navigator.clipboard.writeText(text);window.toastr?.success('已复制对话信息。');}
            catch{window.toastr?.info('浏览器没有允许复制，请重试。');}return;
        }
        if(name==='export'){
            const text=(context().chat || []).map(message=>`${message.name || (message.is_user?'用户':person.name)}\n${message.mes || ''}`).join('\n\n');
            const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob);
            const link=document.createElement('a');link.href=url;link.download=`${person.name}-${context().getCurrentChatId() || '对话'}.txt`.replace(/[<>:"/\\|?*]/g,'_');
            link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
        }
        onAction(name);
    }
    mount.addEventListener('click',event=>{
        const button=event.target.closest('button');if(!button)return;
        if(button.dataset.phsWatchAction)void action(button.dataset.phsWatchAction);
        if(button.dataset.phsWatchPerson)onPerson(button.dataset.phsWatchPerson,button.dataset.phsWatchRecord);
        if(button.dataset.phsWatchCategory)onCategory(button.dataset.phsWatchCategory);
    },{signal});
    $('#phs-reading-position').addEventListener('input',event=>{chat.scrollTop=(chat.scrollHeight-chat.clientHeight)*(Number(event.target.value)/100);updateProgress();},{signal});
    chat.addEventListener('scroll',scheduleProgress,{signal,passive:true});
    document.getElementById('sheld').addEventListener('focusin',()=>{
        if(!visible)return;
        const r=stage.getBoundingClientRect(),viewport=mount.getBoundingClientRect();
        if(r.top<viewport.top || r.bottom>viewport.bottom){mount.scrollTop=0;sync();}
    },{signal});
    mount.addEventListener('scroll',sync,{signal,passive:true});
    window.addEventListener('resize',sync,{signal});
    window.visualViewport?.addEventListener('resize',sync,{signal});
    const observer=new ResizeObserver(sync);observer.observe(stage);observer.observe(mount);
    document.addEventListener('keydown',event=>{if(event.key==='Escape' && focus && !document.querySelector('dialog[open]'))void action('focus');},{signal});
    return {
        render,sync,
        setVisible(value){
            if(value===visible)return;visible=value;mount.hidden=!visible;
            if(visible){mount.scrollTop=0;document.body.classList.toggle('phs-theater',theater);render();syncNow();}
            else{setFocus(false);document.body.classList.remove('phs-theater','phs-focus');for(const prop of geometryProperties)document.body.style.removeProperty(prop);}
        },
        destroy(){destroyed=true;controller.abort();observer.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(progressFrame);document.body.classList.remove('phs-theater','phs-focus');for(const prop of geometryProperties)document.body.style.removeProperty(prop);},
    };
}
