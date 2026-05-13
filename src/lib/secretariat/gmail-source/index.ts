/**
 * Gmail source — point d'entrée.
 *
 * Re-exports pour usage externe.
 */

export type { EmailMessage, EmailAddress, EmailAttachment } from './types';

export {
  listUnprocessed,
  fetchDetail,
  markProcessed,
  markFailed,
} from './gmail-source';

export {
  resolveLabelId,
  resolveTraiteLabel,
  resolveARevoir,
  invalidateLabelCache,
  getLabelCacheSize,
} from './label-resolver';

export {
  listMessages,
  getMessage,
  modifyLabels,
  listLabels,
  getHeader,
  parseEmailAddress,
  parseEmailAddresses,
  extractBodyPlain,
  extractAttachments,
} from './gmail-client';
