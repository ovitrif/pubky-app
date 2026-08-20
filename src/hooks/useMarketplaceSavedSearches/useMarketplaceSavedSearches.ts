'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { CommerceController } from '@/controllers/commerce/commerce';
import { toast } from '@/molecules/Toaster/use-toast';
import { useAuthStore } from '@/stores/auth/auth.store';
import { useCommerceStore } from '@/stores/commerce/commerce.store';

export function useMarketplaceSavedSearches() {
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const query = useCommerceStore((state) => state.query);
  const categoryId = useCommerceStore((state) => state.categoryId);
  const saleFormat = useCommerceStore((state) => state.saleFormat);
  const setQuery = useCommerceStore((state) => state.setQuery);
  const setCategoryId = useCommerceStore((state) => state.setCategoryId);
  const setSaleFormat = useCommerceStore((state) => state.setSaleFormat);
  const searches = useLiveQuery(
    () => (currentUserPubky ? CommerceController.getSavedSearches() : Promise.resolve([])),
    [currentUserPubky],
  );

  const save = async () => {
    if (!currentUserPubky) return;
    try {
      await CommerceController.commitUpsertSavedSearch({
        name: query.trim() || categoryId || saleFormat,
        query,
        categoryId,
        saleFormat,
      });
      toast({ title: 'Search saved', description: 'This filter set is stored locally for this account.' });
    } catch {
      toast({ variant: 'error', description: 'Could not save this search.' });
    }
  };

  const apply = (search: { query: string; category_id: string | null; sale_format: string }) => {
    setQuery(search.query);
    setCategoryId(search.category_id);
    setSaleFormat(search.sale_format as typeof saleFormat);
  };

  const remove = async (searchId: string) => {
    try {
      await CommerceController.commitDeleteSavedSearch(searchId);
    } catch {
      toast({ variant: 'error', description: 'Could not delete this saved search.' });
    }
  };

  return { searches: searches ?? [], save, apply, remove, canSave: Boolean(currentUserPubky) };
}
