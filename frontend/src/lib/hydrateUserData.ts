import { notebookService } from '@/services/notebookService';
import { sharedDataService } from '@/services/sharedDataService';
import { hydrateJellyChatsFromDb } from '@/lib/jellyChatStore';
import { hydrateSectorsFromDb } from '@/utils/sectors';

export async function hydrateUserDataFromDb(): Promise<void> {
  await Promise.all([
    notebookService.hydrateFromDb(),
    sharedDataService.hydrateFromDb(),
    hydrateJellyChatsFromDb(),
    hydrateSectorsFromDb(),
  ]);
}
