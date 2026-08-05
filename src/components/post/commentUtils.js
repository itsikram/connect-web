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

export function buildReplyMessage(body, replyToName) {
    const trimmed = (body || '').trim();
    if (!trimmed) return '';
    if (!replyToName) return trimmed;
    const mention = `@${String(replyToName).replace(/\s+/g, '')}`;
    if (trimmed.startsWith('@')) return trimmed;
    return `${mention} ${trimmed}`;
}
