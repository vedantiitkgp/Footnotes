const STORAGE_KEY = 'memoir-wallet';   // renamed to reset stale 1500 balance
const STARTING_BALANCE = 0;

export function getCoins() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    localStorage.setItem(STORAGE_KEY, String(STARTING_BALANCE));
    return STARTING_BALANCE;
  }
  return parseInt(raw, 10) || 0;
}

export function earnCoins(amount) {
  const current = getCoins();
  const next = current + amount;
  localStorage.setItem(STORAGE_KEY, String(next));
  return next;
}

export function spendCoins(amount) {
  const current = getCoins();
  if (current < amount) return false;
  localStorage.setItem(STORAGE_KEY, String(current - amount));
  return true;
}
