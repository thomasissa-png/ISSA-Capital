/**
 * Tests unitaires — handler `inbox-edit` (S20.A).
 *
 * Couvre :
 *  - dispatch callback `cb_inbox_edit_{field}_{pendingId}` → set awaitingField
 *    + edit message Telegram avec invite + un seul bouton Annuler
 *  - dispatch texte avec pending awaitingField → parse + patch draft + re-render
 *  - parsing variants FR (14h30 / 14:30 / 14h / 2pm / demain / 22 mai / lundi)
 *  - pending expiré (>7j) → ignoré, ne casse pas le flow
 *  - multi-pending → prend le plus récent
 *  - pending introuvable (mauvais id) → handled=true, reason informative
 *  - chatId mismatch → handled=true, reason="chat-mismatch"
 *  - hasActivePendingEdit → true si awaitingField set, false sinon
 *  - parse KO → ré-affiche l'invite + erreur, ne patch pas
 *  - cleanupInboxPreview → delete idempotent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks Telegram (déclarés AVANT les imports)
// ============================================================

const mocks = vi.hoisted(() => ({
  editMessageTextWithButtons: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../telegram-validation/telegram-cards', () => ({
  editMessageTextWithButtons: mocks.editMessageTextWithButtons,
}));

// ============================================================
// Imports (après mocks)
// ============================================================

import {
  handleInboxEditCallback,
  handleInboxEditText,
  hasActivePendingEdit,
  cleanupInboxPreview,
} from '../inbox-edit';
import {
  savePreview,
  getPreview,
  generatePendingId,
  _resetInboxPreviewStoreForTests,
  _getStoreSizeForTests,
  INBOX_PREVIEW_TTL_MS,
  type InboxPreviewEntry,
} from '../../inbox-preview-store';
import type { ExtractedMessage } from '../../workflows/inbox-message-router';

// ============================================================
// Fixtures
// ============================================================

const CHAT_ID = 123456;
const MESSAGE_ID = 9999;

function makeDraft(overrides: Partial<ExtractedMessage> = {}): ExtractedMessage {
  return {
    titre: 'RDV notaire',
    date: '2026-05-22',
    heure: '14:00',
    lieu: 'Paris',
    description: null,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<InboxPreviewEntry> = {}): InboxPreviewEntry {
  return {
    pendingId: generatePendingId(),
    draft: makeDraft(),
    awaitingField: null,
    chatId: CHAT_ID,
    messageId: MESSAGE_ID,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  _resetInboxPreviewStoreForTests();
  mocks.editMessageTextWithButtons.mockClear();
  mocks.editMessageTextWithButtons.mockResolvedValue(true);
});

// ============================================================
// handleInboxEditCallback
// ============================================================

describe('handleInboxEditCallback', () => {
  it('cb_inbox_edit_heure_{id} → set awaitingField=heure + editMessageText', async () => {
    const entry = makeEntry();
    savePreview(entry);

    const res = await handleInboxEditCallback(
      `cb_inbox_edit_heure_${entry.pendingId}`,
      CHAT_ID,
      MESSAGE_ID,
    );

    expect(res.handled).toBe(true);
    const updated = getPreview(entry.pendingId);
    expect(updated?.awaitingField).toBe('heure');
    expect(mocks.editMessageTextWithButtons).toHaveBeenCalledOnce();

    const [chatIdArg, messageIdArg, newText, buttons] =
      mocks.editMessageTextWithButtons.mock.calls[0]!;
    expect(chatIdArg).toBe(CHAT_ID);
    expect(messageIdArg).toBe(MESSAGE_ID);
    expect(newText).toContain('heure');
    // Un seul bouton Annuler (1 ligne, 1 bouton)
    expect(buttons).toHaveLength(1);
    expect((buttons as unknown[][])[0]!).toHaveLength(1);
  });

  it('cb_inbox_edit_titre_{id} → set awaitingField=titre', async () => {
    const entry = makeEntry();
    savePreview(entry);
    await handleInboxEditCallback(
      `cb_inbox_edit_titre_${entry.pendingId}`,
      CHAT_ID,
      MESSAGE_ID,
    );
    expect(getPreview(entry.pendingId)?.awaitingField).toBe('titre');
  });

  it('cb_inbox_edit_date_{id} → set awaitingField=date', async () => {
    const entry = makeEntry();
    savePreview(entry);
    await handleInboxEditCallback(
      `cb_inbox_edit_date_${entry.pendingId}`,
      CHAT_ID,
      MESSAGE_ID,
    );
    expect(getPreview(entry.pendingId)?.awaitingField).toBe('date');
  });

  it('cb_inbox_edit_lieu_{id} → set awaitingField=lieu', async () => {
    const entry = makeEntry();
    savePreview(entry);
    await handleInboxEditCallback(
      `cb_inbox_edit_lieu_${entry.pendingId}`,
      CHAT_ID,
      MESSAGE_ID,
    );
    expect(getPreview(entry.pendingId)?.awaitingField).toBe('lieu');
  });

  it('callback non préfixé inbox_edit → handled=false', async () => {
    const res = await handleInboxEditCallback(
      'inbox_router:calendar:abc',
      CHAT_ID,
      MESSAGE_ID,
    );
    expect(res.handled).toBe(false);
    expect(mocks.editMessageTextWithButtons).not.toHaveBeenCalled();
  });

  it('pendingId inconnu → handled=true reason=pending-expired-or-unknown', async () => {
    const res = await handleInboxEditCallback(
      'cb_inbox_edit_heure_doesnotexist',
      CHAT_ID,
      MESSAGE_ID,
    );
    expect(res.handled).toBe(true);
    expect(res.reason).toBe('pending-expired-or-unknown');
    expect(mocks.editMessageTextWithButtons).not.toHaveBeenCalled();
  });

  it('chatId mismatch → handled=true reason=chat-mismatch (sécurité)', async () => {
    const entry = makeEntry({ chatId: 999 });
    savePreview(entry);
    const res = await handleInboxEditCallback(
      `cb_inbox_edit_heure_${entry.pendingId}`,
      CHAT_ID,
      MESSAGE_ID,
    );
    expect(res.handled).toBe(true);
    expect(res.reason).toBe('chat-mismatch');
  });

  it('pending expiré (>7j) → handled=true reason=pending-expired (purge auto)', async () => {
    const entry = makeEntry({
      createdAt: Date.now() - INBOX_PREVIEW_TTL_MS - 1_000,
    });
    savePreview(entry);
    const res = await handleInboxEditCallback(
      `cb_inbox_edit_heure_${entry.pendingId}`,
      CHAT_ID,
      MESSAGE_ID,
    );
    expect(res.handled).toBe(true);
    expect(res.reason).toBe('pending-expired-or-unknown');
  });
});

// ============================================================
// hasActivePendingEdit
// ============================================================

describe('hasActivePendingEdit', () => {
  it('false si aucun pending', async () => {
    expect(await hasActivePendingEdit(CHAT_ID)).toBe(false);
  });

  it('false si pending sans awaitingField', async () => {
    savePreview(makeEntry({ awaitingField: null }));
    expect(await hasActivePendingEdit(CHAT_ID)).toBe(false);
  });

  it('true si pending avec awaitingField set', async () => {
    savePreview(makeEntry({ awaitingField: 'heure' }));
    expect(await hasActivePendingEdit(CHAT_ID)).toBe(true);
  });

  it('false pour un autre chatId', async () => {
    savePreview(makeEntry({ awaitingField: 'heure', chatId: 999 }));
    expect(await hasActivePendingEdit(CHAT_ID)).toBe(false);
  });
});

// ============================================================
// handleInboxEditText
// ============================================================

describe('handleInboxEditText', () => {
  it('texte "14h30" avec awaitingField=heure → draft.heure="14:30" + clear + re-render', async () => {
    const entry = makeEntry({ awaitingField: 'heure' });
    savePreview(entry);

    const res = await handleInboxEditText('14h30', CHAT_ID);

    expect(res.handled).toBe(true);
    expect(res.reason).toBeUndefined();
    const updated = getPreview(entry.pendingId);
    expect(updated?.draft.heure).toBe('14:30');
    expect(updated?.awaitingField).toBeNull();
    expect(mocks.editMessageTextWithButtons).toHaveBeenCalledOnce();

    const [, , , buttons] = mocks.editMessageTextWithButtons.mock.calls[0]!;
    // Carte 7 boutons : L1=4 edits, L2=2 destinations, L3=1 Annuler
    expect(buttons).toHaveLength(3);
    expect((buttons as unknown[][])[0]!).toHaveLength(4);
    expect((buttons as unknown[][])[1]!).toHaveLength(2);
    expect((buttons as unknown[][])[2]!).toHaveLength(1);
  });

  it('parsing heure : variants "14h", "14:30", "2pm"', async () => {
    const variants: Array<[string, string]> = [
      ['14h', '14:00'],
      ['14:30', '14:30'],
      ['2pm', '14:00'],
      ['9h05', '09:05'],
    ];
    for (const [raw, expected] of variants) {
      _resetInboxPreviewStoreForTests();
      const entry = makeEntry({ awaitingField: 'heure' });
      savePreview(entry);
      const res = await handleInboxEditText(raw, CHAT_ID);
      expect(res.handled).toBe(true);
      expect(getPreview(entry.pendingId)?.draft.heure).toBe(expected);
    }
  });

  it('parsing date : "demain" → date du lendemain', async () => {
    const entry = makeEntry({ awaitingField: 'date' });
    savePreview(entry);
    const res = await handleInboxEditText('demain', CHAT_ID);
    expect(res.handled).toBe(true);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    expect(getPreview(entry.pendingId)?.draft.date).toBe(`${yyyy}-${mm}-${dd}`);
  });

  it('parsing date : "22 mai" → YYYY-05-22', async () => {
    const entry = makeEntry({ awaitingField: 'date' });
    savePreview(entry);
    await handleInboxEditText('22 mai', CHAT_ID);
    const got = getPreview(entry.pendingId)?.draft.date;
    expect(got).toMatch(/^\d{4}-05-22$/);
  });

  it('parsing date : "lundi" → un YYYY-MM-DD valide', async () => {
    const entry = makeEntry({ awaitingField: 'date' });
    savePreview(entry);
    await handleInboxEditText('lundi', CHAT_ID);
    const got = getPreview(entry.pendingId)?.draft.date;
    expect(got).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('parsing titre → trim + cap 200 chars', async () => {
    const entry = makeEntry({ awaitingField: 'titre' });
    savePreview(entry);
    await handleInboxEditText('  Nouveau titre  ', CHAT_ID);
    expect(getPreview(entry.pendingId)?.draft.titre).toBe('Nouveau titre');
  });

  it('parsing lieu → patch direct', async () => {
    const entry = makeEntry({ awaitingField: 'lieu' });
    savePreview(entry);
    await handleInboxEditText('21 avenue Foch', CHAT_ID);
    expect(getPreview(entry.pendingId)?.draft.lieu).toBe('21 avenue Foch');
  });

  it('parse KO (heure invalide) → garde awaitingField, ré-affiche invite + erreur', async () => {
    const entry = makeEntry({ awaitingField: 'heure' });
    savePreview(entry);
    const res = await handleInboxEditText('pas une heure', CHAT_ID);
    expect(res.handled).toBe(true);
    expect(res.reason).toBe('parse-failed');
    // awaitingField conservé pour permettre nouvelle saisie
    expect(getPreview(entry.pendingId)?.awaitingField).toBe('heure');
    // heure draft inchangée
    expect(getPreview(entry.pendingId)?.draft.heure).toBe('14:00');
    // Edit Telegram appelé avec un seul bouton Annuler
    const [, , newText, buttons] =
      mocks.editMessageTextWithButtons.mock.calls[0]!;
    expect(newText).toMatch(/Tape la heure/);
    expect(buttons).toHaveLength(1);
  });

  it('aucun pending awaitingField → handled=false (le webhook continue)', async () => {
    const res = await handleInboxEditText('14h30', CHAT_ID);
    expect(res.handled).toBe(false);
    expect(mocks.editMessageTextWithButtons).not.toHaveBeenCalled();
  });

  it('pending expiré (>7j) → handled=false (purgé par findLatestAwaitingForChat)', async () => {
    savePreview(
      makeEntry({
        awaitingField: 'heure',
        createdAt: Date.now() - INBOX_PREVIEW_TTL_MS - 1_000,
      }),
    );
    const res = await handleInboxEditText('14h30', CHAT_ID);
    expect(res.handled).toBe(false);
  });

  it('multi-pending : prend le plus récent (createdAt desc)', async () => {
    const older = makeEntry({
      pendingId: 'older',
      awaitingField: 'heure',
      createdAt: Date.now() - 60_000,
    });
    const newer = makeEntry({
      pendingId: 'newer',
      awaitingField: 'heure',
      createdAt: Date.now(),
    });
    savePreview(older);
    savePreview(newer);

    await handleInboxEditText('14h30', CHAT_ID);

    // Le plus récent doit avoir été patché (awaitingField cleared)
    expect(getPreview('newer')?.awaitingField).toBeNull();
    expect(getPreview('newer')?.draft.heure).toBe('14:30');
    // L'ancien reste en attente
    expect(getPreview('older')?.awaitingField).toBe('heure');
  });
});

// ============================================================
// cleanupInboxPreview
// ============================================================

describe('cleanupInboxPreview', () => {
  it('supprime un pending par son id', () => {
    const entry = makeEntry();
    savePreview(entry);
    expect(_getStoreSizeForTests()).toBe(1);
    cleanupInboxPreview(entry.pendingId);
    expect(_getStoreSizeForTests()).toBe(0);
  });

  it('idempotent sur id inconnu', () => {
    expect(() => cleanupInboxPreview('doesnotexist')).not.toThrow();
  });
});
