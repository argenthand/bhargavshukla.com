import type { LayoutServerLoad } from './$types';

// Draft preview (#57): the layout shows the "Preview mode" banner while it's on.
export const load: LayoutServerLoad = ({ locals }) => ({ preview: locals.preview });
