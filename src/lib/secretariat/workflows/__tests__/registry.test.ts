/**
 * Tests unitaires — workflow registry et listWorkflowCommands.
 *
 * Vérifie :
 * - listWorkflowCommands() retourne toutes les commandes du registry
 * - Chaque commande a un command non vide
 * - Chaque commande a une description non vide
 * - Pas de doublons de command
 * - getAvailableWorkflowTypes() retourne les types attendus
 * - getWorkflow() retourne un workflow valide ou null
 */

import { describe, it, expect } from 'vitest';
import {
  listWorkflowCommands,
  getAvailableWorkflowTypes,
  getWorkflow,
} from '../registry';

describe('listWorkflowCommands', () => {
  it('retourne toutes les commandes du registry avec format { command, description }', () => {
    const commands = listWorkflowCommands();
    expect(commands.length).toBeGreaterThanOrEqual(2);

    for (const cmd of commands) {
      expect(cmd).toHaveProperty('command');
      expect(cmd).toHaveProperty('description');
    }
  });

  it('chaque commande a un command non vide', () => {
    const commands = listWorkflowCommands();

    for (const cmd of commands) {
      expect(typeof cmd.command).toBe('string');
      expect(cmd.command.trim().length).toBeGreaterThan(0);
    }
  });

  it('chaque commande a une description non vide', () => {
    const commands = listWorkflowCommands();

    for (const cmd of commands) {
      expect(typeof cmd.description).toBe('string');
      expect(cmd.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('pas de doublons de command', () => {
    const commands = listWorkflowCommands();
    const names = commands.map((c) => c.command);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('contient les commandes cr, quittance et bail', () => {
    const commands = listWorkflowCommands();
    const names = commands.map((c) => c.command);
    expect(names).toContain('cr');
    expect(names).toContain('quittance');
    expect(names).toContain('bail');
  });

  it('les commandes ne contiennent pas de slash', () => {
    const commands = listWorkflowCommands();

    for (const cmd of commands) {
      expect(cmd.command.startsWith('/')).toBe(false);
    }
  });
});

describe('getAvailableWorkflowTypes', () => {
  it('retourne les types cr, quittance et bail', () => {
    const types = getAvailableWorkflowTypes();
    expect(types).toContain('cr');
    expect(types).toContain('quittance');
    expect(types).toContain('bail');
  });
});

describe('getWorkflow', () => {
  it('retourne un workflow valide pour cr', () => {
    const wf = getWorkflow('cr');
    expect(wf).not.toBeNull();
    expect(wf!.type).toBe('cr');
    expect(wf!.command).toBe('cr');
    expect(wf!.commandDescription.length).toBeGreaterThan(0);
  });

  it('retourne un workflow valide pour quittance', () => {
    const wf = getWorkflow('quittance');
    expect(wf).not.toBeNull();
    expect(wf!.type).toBe('quittance');
    expect(wf!.command).toBe('quittance');
    expect(wf!.commandDescription.length).toBeGreaterThan(0);
  });

  it('retourne un workflow valide pour bail', () => {
    const wf = getWorkflow('bail');
    expect(wf).not.toBeNull();
    expect(wf!.type).toBe('bail');
    expect(wf!.command).toBe('bail');
    expect(wf!.commandDescription.length).toBeGreaterThan(0);
  });

  it('retourne null pour un type inconnu', () => {
    const wf = getWorkflow('inexistant' as 'cr');
    expect(wf).toBeNull();
  });
});
