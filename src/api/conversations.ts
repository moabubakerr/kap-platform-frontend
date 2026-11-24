import { mock, useApi } from './client';
import { FEEDBACK_QUEUE, MESSAGES, messageById } from '@/mocks/conversations';

// Ask AI admin API (/api/askai/*). Real endpoints noted for the swap.
export const useMessages = () => useApi(['askai', 'messages'], () => mock(MESSAGES)); // GET /admin/messages
export const useMessage = (id?: string) => useApi(['askai', 'message', id], () => mock(messageById(id) ?? null)); // GET /admin/messages/{id} + /provenance
export const useFeedbackQueue = () => useApi(['askai', 'feedback'], () => mock(FEEDBACK_QUEUE)); // GET /admin/feedback?rating_lte=2
