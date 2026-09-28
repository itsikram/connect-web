/**
 * Offline (local / vs computer) Ludo games saved on this device so they can
 * be resumed later. Online games are saved on the server instead.
 *
 * Entries are kept per account so a shared browser never mixes players' games.
 */
const STORAGE_KEY = "ludo_saved_local_games";
const MAX_SAVES = 10;

const readAll = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
};

const writeAll = (saves) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  } catch (_e) {}
};

const ownerKey = (profileId) => String(profileId || "guest");

export const createLocalSaveId = () =>
  `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const listLocalSaves = (profileId) =>
  readAll()
    .filter((save) => save?.owner === ownerKey(profileId) && Array.isArray(save.players))
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

export const upsertLocalSave = (profileId, save) => {
  if (!save?.id) return;
  const owner = ownerKey(profileId);
  const others = readAll().filter((entry) => entry?.id !== save.id);
  const mine = others.filter((entry) => entry?.owner === owner);
  const notMine = others.filter((entry) => entry?.owner !== owner);
  // Keep the newest saves for this account.
  const keptMine = [{ ...save, owner, savedAt: Date.now() }, ...mine]
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
    .slice(0, MAX_SAVES);
  writeAll([...notMine, ...keptMine]);
};

export const removeLocalSave = (saveId) => {
  if (!saveId) return;
  writeAll(readAll().filter((entry) => entry?.id !== saveId));
};

// Share of all tokens that have reached home, for the saved-game list.
export const getSaveProgress = (save, maxSteps) => {
  const pieces = (save?.players || []).flatMap((p) => p?.pieces || []);
  if (!pieces.length || !maxSteps) return 0;
  const total = pieces.reduce(
    (sum, pc) => sum + Math.min(maxSteps, Math.max(0, Number(pc?.steps) || 0)),
    0,
  );
  return Math.round((total / (pieces.length * maxSteps)) * 100);
};
