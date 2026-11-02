/* 署名 Lucas。禁止商业使用、二次传播、二次修改。使用声明见 NOTICE.txt。 */
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const plainText = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim();
export function selectedUser(c, avatarId, revision = 0) {
    const name = String(c.name1 || 'User');
    const base = avatarId ? c.getThumbnailUrl('persona', avatarId) : '/img/user-default.png';
    return { name, avatar: revision && avatarId ? `${base}&phs_v=${revision}` : base };
}
export function characterEntities(c) {
    return [
        ...(c.characters || []).map((ch, id) => ({
            key: ch.avatar, id, kind: 'character', name: ch.name || '未命名角色',
            avatar: c.getThumbnailUrl('avatar', ch.avatar),
            cover: `/characters/${encodeURIComponent(ch.avatar)}`,
            description: plainText(ch.description || ch.first_mes),
            tags: (c.tagMap?.[ch.avatar] || []).map(id => c.tags?.find(tag => String(tag.id) === String(id))?.name).filter(Boolean),
            nativeFavorite: ch.fav === true || ch.fav === 'true',
        })),
        ...(c.groups || []).map(group => ({
            key: `group:${group.id}`, id: group.id, kind: 'group', name: group.name || '未命名群组',
            avatar: '/img/ai4.png', cover: '/img/ai4.png',
            description: `${group.members?.length || 0} 位角色的群组对话`, tags: ['群组'], nativeFavorite: false,
        })),
    ];
}
export function personFor(record, entities) {
    return entities.find(entity => record.group != null ? entity.kind === 'group' && String(entity.id) === String(record.group) : entity.key === record.avatar);
}
export function filteredEntities(entities, { query = '', category = 'all', favorites = [], sort = 'recent', records = [], timestamp = value => Number(value) || 0 } = {}) {
    const latest = entity => Math.max(0, ...records.filter(record => personFor(record, [entity])).map(record => timestamp(record.last_mes)));
    const q = query.trim().toLowerCase();
    return entities.filter(entity => {
        const matchesQuery = `${entity.name} ${entity.description} ${entity.tags.join(' ')}`.toLowerCase().includes(q);
        const matchesCategory = category === 'all' || category === 'favorites' && (favorites.includes(entity.key) || entity.nativeFavorite) || category === 'character' && entity.kind === 'character' || category === 'group' && entity.kind === 'group' || entity.tags.includes(category);
        return matchesQuery && matchesCategory;
    }).sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : latest(b) - latest(a) || a.name.localeCompare(b.name, 'zh-CN'));
}
export const recordKey = record => JSON.stringify([record.group ?? record.avatar, record.file_name]);
