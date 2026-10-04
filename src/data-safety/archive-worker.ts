import { archiveResultTransfers, processArchiveTask, type ArchiveRequest } from './archive-codec';

self.onmessage = (event: MessageEvent<{ id: number; request: ArchiveRequest }>) => {
  const { id, request } = event.data;
  try {
    const result = processArchiveTask(request);
    self.postMessage({ id, result }, { transfer: archiveResultTransfers(result) });
  } catch (cause) {
    self.postMessage({
      id,
      error: cause instanceof Error ? cause.message : 'The backup archive could not be processed.',
    });
  }
};
