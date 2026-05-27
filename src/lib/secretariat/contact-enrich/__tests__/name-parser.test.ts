import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallAnthropic = vi.fn();
vi.mock('../../llm/client', () => ({
  callAnthropic: (...args: unknown[]) => mockCallAnthropic(...args),
}));

import { parseNameJson, parseContactName } from '../name-parser';

beforeEach(() => {
  mockCallAnthropic.mockReset();
});

describe('parseNameJson', () => {
  it('parse un JSON brut', () => {
    const r = parseNameJson('{"displayName":"Marc Gernot","firstName":"Marc","lastName":"Gernot","notes":null}');
    expect(r).toEqual({ displayName: 'Marc Gernot', firstName: 'Marc', lastName: 'Gernot' });
  });

  it('parse un bloc markdown et omet les champs vides', () => {
    const r = parseNameJson('```json\n{"displayName":"Marc","firstName":"Marc","lastName":"","notes":"code: OMS"}\n```');
    expect(r?.displayName).toBe('Marc');
    expect(r?.lastName).toBeUndefined();
    expect(r?.notes).toBe('code: OMS');
  });

  it('renvoie null si JSON inexploitable', () => {
    expect(parseNameJson('pas de json')).toBeNull();
    expect(parseNameJson('')).toBeNull();
  });
});

describe('parseContactName (LLM mocké)', () => {
  it('réordonne « NOM, Prénom » → « Prénom Nom »', async () => {
    mockCallAnthropic.mockResolvedValue({
      text: '{"displayName":"Marc Gernot","firstName":"Marc","lastName":"Gernot","notes":null}',
    });
    const r = await parseContactName('GERNOT, Marc', 'marc.gernot@exemple.com');
    expect(r?.displayName).toBe('Marc Gernot');
  });

  it('met un code MAJ (OMS) en notes, pas dans le nom', async () => {
    mockCallAnthropic.mockResolvedValue({
      text: '{"displayName":"Marc","firstName":"Marc","lastName":null,"notes":"code/service: OMS"}',
    });
    const r = await parseContactName('Marc OMS', 'marc@exemple.com', 'Service OMS');
    expect(r?.displayName).toBe('Marc');
    expect(r?.notes).toContain('OMS');
  });

  it('LLM throw → null (fallback appelant)', async () => {
    mockCallAnthropic.mockRejectedValue(new Error('LLM down'));
    expect(await parseContactName('X', 'x@y.com')).toBeNull();
  });
});
