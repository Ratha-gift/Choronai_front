/** Last mouse/keyboard/touch time, shared by all tabs (see IdleLogout). */
export const ACTIVITY_KEY = "choronai-last-activity";

/** Called when the user signs in: a fresh start for the idle timer. */
export const markSignedIn = () =>
  localStorage.setItem(ACTIVITY_KEY, String(Date.now()));

export const lastActivity = () =>
  Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now();
