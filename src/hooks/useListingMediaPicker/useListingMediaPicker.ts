'use client';

import { type ChangeEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { blake3 } from '@noble/hashes/blake3.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { COMMERCE_LISTING_MAX_IMAGES } from '@/config/commerce';
import { IMAGE_MAX_RAW_SIZE } from '@/config/images';
import { type CommerceListingRecord, commerceMediaSchema } from '@/libs/commerce/marketplace-records';
import { stripImageMetadata } from '@/libs/image/stripImageMetadata';
import { CommerceRecordNormalizer } from '@/pipes/commerce/commerce.normalizer';

export type ListingMediaPickerError =
  | 'invalid-type'
  | 'too-large'
  | 'decode-failed'
  | 'limit-reached'
  | 'missing-caption';

export interface ListingMediaItem {
  id: string;
  file: File;
  previewUrl: string;
  altText: string;
}

export interface PreparedListingMedia {
  record: CommerceListingRecord['media'][number];
  bytes: Uint8Array;
}

export interface UseListingMediaPickerResult {
  file: File | null;
  previewUrl: string | null;
  items: ListingMediaItem[];
  error: ListingMediaPickerError | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  choose: () => void;
  remove: () => void;
  removeAt: (index: number) => void;
  moveUp: (index: number) => void;
  moveDown: (index: number) => void;
  setItemAltText: (id: string, altText: string) => void;
  reset: () => void;
  prepare: (ownerPubky: string, altText: string) => Promise<PreparedListingMedia | null>;
  prepareGallery: (ownerPubky: string, coverAltText?: string) => Promise<PreparedListingMedia[] | null>;
}

export function useListingMediaPicker(
  maxSize = IMAGE_MAX_RAW_SIZE,
  maxItems = COMMERCE_LISTING_MAX_IMAGES,
): UseListingMediaPickerResult {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<ListingMediaItem[]>([]);
  const [items, setItems] = useState<ListingMediaItem[]>([]);
  const [error, setError] = useState<ListingMediaPickerError | null>(null);
  itemsRef.current = items;

  useEffect(
    () => () => {
      for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
    },
    [],
  );

  const revoke = (item: ListingMediaItem) => URL.revokeObjectURL(item.previewUrl);

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = [...(event.target.files ?? [])];
    if (inputRef.current) inputRef.current.value = '';
    if (!selected.length) return;

    setItems((current) => {
      const remaining = maxItems - current.length;
      if (remaining <= 0) {
        setError('limit-reached');
        return current;
      }
      const next: ListingMediaItem[] = [...current];
      let nextError: ListingMediaPickerError | null = null;
      for (const file of selected.slice(0, remaining)) {
        if (!file.type.startsWith('image/')) {
          nextError = 'invalid-type';
          continue;
        }
        if (file.size > maxSize) {
          nextError = 'too-large';
          continue;
        }
        next.push({
          id: crypto.randomUUID().replaceAll('-', ''),
          file,
          previewUrl: URL.createObjectURL(file),
          altText: '',
        });
      }
      if (selected.length > remaining) nextError = 'limit-reached';
      setError(nextError);
      return next;
    });
  };

  const removeAt = (index: number) => {
    setItems((current) => {
      const target = current[index];
      if (target) revoke(target);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
    setError(null);
  };

  const remove = () => removeAt(0);

  const reset = () => {
    setItems((current) => {
      for (const item of current) revoke(item);
      return [];
    });
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setItems((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index - 1, 0, item);
      return next;
    });
  };

  const moveDown = (index: number) => {
    setItems((current) => {
      if (index < 0 || index >= current.length - 1) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + 1, 0, item);
      return next;
    });
  };

  const setItemAltText = (id: string, altText: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, altText } : item)));
  };

  const prepareOne = async (ownerPubky: string, file: File, altText: string): Promise<PreparedListingMedia | null> => {
    try {
      const sanitized = await stripImageMetadata(file);
      const bytes = new Uint8Array(await sanitized.arrayBuffer());
      const image = await createImageBitmap(sanitized);
      const dimensions = { width: image.width, height: image.height };
      image.close();
      const mediaId = crypto.randomUUID().replaceAll('-', '');
      const record = commerceMediaSchema.parse({
        id: mediaId,
        type: 'image',
        url: CommerceRecordNormalizer.mediaUri(ownerPubky, mediaId),
        contentHash: bytesToHex(blake3(bytes)),
        mimeType: sanitized.type,
        byteSize: bytes.byteLength,
        width: dimensions.width,
        height: dimensions.height,
        altText: altText.trim(),
      });
      return { record, bytes };
    } catch {
      setError('decode-failed');
      return null;
    }
  };

  const prepare = async (ownerPubky: string, altText: string): Promise<PreparedListingMedia | null> => {
    const file = items[0]?.file;
    if (!file) return null;
    const prepared = await prepareOne(ownerPubky, file, altText);
    if (prepared) setError(null);
    return prepared;
  };

  const prepareGallery = async (ownerPubky: string, coverAltText = ''): Promise<PreparedListingMedia[] | null> => {
    if (!items.length) return null;
    const prepared: PreparedListingMedia[] = [];
    for (const [index, item] of items.entries()) {
      const altText = item.altText.trim() || (index === 0 ? coverAltText.trim() : '');
      if (!altText) {
        setError('missing-caption');
        return null;
      }
      const next = await prepareOne(ownerPubky, item.file, altText);
      if (!next) return null;
      prepared.push(next);
    }
    setError(null);
    return prepared;
  };

  return {
    file: items[0]?.file ?? null,
    previewUrl: items[0]?.previewUrl ?? null,
    items,
    error,
    inputRef,
    onInputChange,
    choose: () => inputRef.current?.click(),
    remove,
    removeAt,
    moveUp,
    moveDown,
    setItemAltText,
    reset,
    prepare,
    prepareGallery,
  };
}
