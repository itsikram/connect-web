/** Shared helpers for post comments / replies */

export function getProfileDisplayName(profile) {
    if (!profile) return 'Unknown User';
    if (profile.fullName) return profile.fullName;
    if (profile.displayName) return profile.displayName;
    const user = profile.user;
    if (user) {
        const fromParts = [user.firstName, user.surname].filter(Boolean).join(' ').trim();
        if (fromParts) return fromParts;
        if (user.displayName) return user.displayName;
        if (user.fullName) return user.fullName;
    }
    if (profile.username || profile.nickname) return profile.username || profile.nickname;
    return 'Unknown User';
}

/** Split a reply body into optional leading @mention + rest */
export function splitMentionBody(body) {
    if (!body) return { mention: null, rest: '' };
    const text = String(body);
    const mentionMatch = text.match(/^(@[^\s]+)\s([\s\S]*)$/);
    if (!mentionMatch) return { mention: null, rest: text };
    return { mention: mentionMatch[1], rest: mentionMatch[2] };
}

export function buildReplyMessage(body, replyToProfile) {
    const trimmed = (body || '').trim();
    if (!trimmed) return '';
    const replyToName = typeof replyToProfile === 'string'
        ? replyToProfile
        : getProfileDisplayName(replyToProfile);
    const replyToId = typeof replyToProfile === 'object' ? replyToProfile?._id : null;
    if (!replyToName || replyToName === 'Unknown User') return trimmed;
    const mention = replyToId
        ? `@[${String(replyToName).trim()}](${replyToId})`
        : `@${String(replyToName).trim()}`;
    if (trimmed.startsWith('@')) return trimmed;
    return `${mention} ${trimmed}`;
}

export function splitMentionTokens(text) {
    const value = String(text || '');
    const tokenPattern = /@\[([^\]]+)\]\(([a-f\d]{24})\)/gi;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = tokenPattern.exec(value))) {
        if (match.index > lastIndex) parts.push({ text: value.slice(lastIndex, match.index) });
        parts.push({ text: match[1].trim(), profileId: match[2] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < value.length) parts.push({ text: value.slice(lastIndex) });
    return parts.length ? parts : [{ text: value }];
}
