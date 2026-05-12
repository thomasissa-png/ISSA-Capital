/**
 * Configuration bailleur pour la quittance de loyer.
 *
 * Données chargées depuis biens.json (section bailleur).
 * L'état civil étendu (bail-config.yml) n'est nécessaire que pour les baux,
 * pas pour les quittances.
 */

import { chargerBailleurDepuisBiens } from './biens';
import type { BailleurConfig } from './types';

/**
 * Retourne la configuration bailleur pour les quittances.
 *
 * Les données proviennent de biens.json qui est la copie statique
 * de second-cerveau/biens.yml.
 */
export function chargerBailleur(): BailleurConfig {
  return chargerBailleurDepuisBiens();
}
