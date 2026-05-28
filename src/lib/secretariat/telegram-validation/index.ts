/**
 * Telegram validation — re-exports publics.
 *
 * Point d'entrée unique pour le module de validation email-ingest via Telegram.
 * Utilisé par le pipeline email-ingest (Jalon 4C) et le webhook Telegram.
 */

export {
  buildValidationCard,
  sendValidationCard,
  editMessageText,
  sendSimpleMessage,
  escapeHtml,
  VALIDATION_CALLBACK_PREFIX,
} from './telegram-cards';

export type { PendingValidation, TelegramKeyboard, TelegramButton } from './telegram-cards';

export {
  savePending,
  getPending,
  deletePending,
  purgeExpired,
  listAllPending,
  saveNoMatch,
  getNoMatch,
  deleteNoMatch,
  purgeExpiredNoMatch,
  findNoMatchByCardMessageId,
  updateNoMatchUserContext,
  listActiveNoMatch,
  saveWhatsappNoMatch,
  getWhatsappNoMatch,
  deleteWhatsappNoMatch,
  findWhatsappNoMatchByCardMessageId,
  updateWhatsappNoMatchUserContext,
  listActiveWhatsappNoMatch,
} from './pending-store';

export {
  buildNoMatchCard,
  sendNoMatchCard,
  NOMATCH_CALLBACK_PREFIX,
} from './no-match-card';

export type { NoMatchPending, ContactType } from './no-match-card';

export {
  buildWhatsappNoMatchCard,
  sendWhatsappNoMatchCard,
  parseWhatsappNoMatchCallback,
  WA_NOMATCH_CALLBACK_PREFIX,
} from './whatsapp-no-match-card';

export type {
  WhatsappNoMatchPending,
  WhatsappNoMatchAction,
  ParsedWhatsappNoMatchCallback,
} from './whatsapp-no-match-card';

export { handleTelegramCallback } from './callback-handler';
export type { TelegramCallback } from './callback-handler';
