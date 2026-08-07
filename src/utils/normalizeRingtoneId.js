export const normalizeRingtoneId = (ringtoneId) => {
    const id = Number(ringtoneId);
    return Number.isFinite(id) && id > 0 ? id : 1;
};
