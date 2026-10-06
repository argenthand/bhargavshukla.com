// The author's opt-out (#154, #164): their own devices don't count reads or events.

/** Set to anything on the author's own devices so their reads and events don't count. */
export const NO_COUNT_KEY = 'noCount';
/** A form field the contact card adds on the author's devices (`noCount`), so its outcome isn't counted. */
export const NO_COUNT_FIELD = 'no-count';

export function optedOut() {
	try {
		return localStorage.getItem(NO_COUNT_KEY) !== null;
	} catch {
		return false;
	}
}
