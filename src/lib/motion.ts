// Page transitions (#60): a title that appears in a list and as its own page's heading shares one
// view-transition-name, so it moves between the two instead of fading. Names must be unique on a page.
export const titleTransition = (kind: 'post' | 'aside', slug: string) => `${kind}-title-${slug}`;
