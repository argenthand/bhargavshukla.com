// Rules for the shared.image component (#40) that the schema can't express: an image is either
// an upload or a linked photo, and a linked photo needs its credit.

import { errors } from '@strapi/utils';

export type ImageData = {
  file?: unknown;
  url?: string | null;
  alt?: string | null;
  creditName?: string | null;
  source?: string | null;
};

const isSet = (value: unknown) =>
  value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);

/** Problems with one image, or [] when it's fine (or absent: images are always optional). */
export function imageProblems(image: ImageData | null | undefined): string[] {
  if (!image) return [];
  const hasFile = isSet(image.file);
  const hasUrl = isSet(image.url?.trim());
  if (hasFile && hasUrl) return ['Use either an uploaded file or a URL, not both.'];
  if (!hasFile && !hasUrl) return ['Add an uploaded file or a URL, or remove the image.'];
  if (hasUrl) {
    const problems: string[] = [];
    if (!/^https:\/\//.test(image.url!.trim())) problems.push('The URL must start with https://.');
    if (!isSet(image.creditName)) problems.push('A linked photo needs the photographer (credit name).');
    if (!isSet(image.source)) problems.push('A linked photo needs its source (Unsplash, Pexels or other).');
    return problems;
  }
  return [];
}

/** Throws a ValidationError the admin shows on save. */
export function assertImage(field: string, image: ImageData | null | undefined) {
  const problems = imageProblems(image);
  if (problems.length) {
    throw new errors.ValidationError(`${field}: ${problems.join(' ')}`);
  }
}
