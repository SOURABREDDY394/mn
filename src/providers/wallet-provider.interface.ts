import { CreatePassInput, UpdatePassInput, PassCreationResult, PassUpdateResult, PassRecord } from '../core/types.js';

/**
 * Universal Wallet Provider Interface.
 * Allows decoupling pass management business logic from specific vendor SDKs
 * (Google Wallet, Apple Wallet, Samsung Wallet, etc.).
 */
export interface IWalletProvider {
  /**
   * Stable identifier for the wallet provider (for example, 'google').
   */
  readonly name: string;

  /**
   * Verify provider readiness (e.g. credentials, classes, API health)
   */
  initialize(): Promise<void>;

  /**
   * Create a new digital pass object and return signed save links & credentials
   */
  createPass(input: CreatePassInput): Promise<PassCreationResult>;

  /**
   * Push a live update to an existing pass on users' devices
   */
  updatePass(passId: string, input: UpdatePassInput): Promise<PassUpdateResult>;

  /**
   * Retrieve the current pass state
   */
  getPass(passId: string): Promise<PassRecord | null>;
}
