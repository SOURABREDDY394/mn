import { IWalletProvider } from '../providers/wallet-provider.interface.js';
import {
  CreatePassInput,
  UpdatePassInput,
  PassCreationResult,
  PassUpdateResult,
  PassRecord
} from '../core/types.js';

export class PassService {
  private defaultProvider: IWalletProvider;
  private providers: Map<string, IWalletProvider> = new Map();

  constructor(defaultProvider: IWalletProvider) {
    this.defaultProvider = defaultProvider;
    this.registerProvider(defaultProvider);
  }

  public registerProvider(provider: IWalletProvider): void {
    this.providers.set(provider.name, provider);
  }

  public getProvider(name?: string): IWalletProvider {
    if (!name) return this.defaultProvider;
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Wallet provider '${name}' not found. Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    return provider;
  }

  public async initialize(): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.initialize();
    }
  }

  public async createPass(input: CreatePassInput, providerName?: string): Promise<PassCreationResult> {
    if (!input.name || !input.name.trim()) {
      throw new Error('Name is required');
    }
    if (!input.label || !input.label.trim()) {
      throw new Error('Label is required');
    }
    if (input.value === undefined || input.value === null || input.value === '') {
      throw new Error('Value is required');
    }

    const provider = this.getProvider(providerName);
    return await provider.createPass(input);
  }

  public async updatePass(passId: string, input: UpdatePassInput, providerName?: string): Promise<PassUpdateResult> {
    if (!passId || !passId.trim()) {
      throw new Error('Pass ID is required');
    }
    if (input.value === undefined || input.value === null || input.value === '') {
      throw new Error('New value is required');
    }

    const provider = this.getProvider(providerName);
    return await provider.updatePass(passId, input);
  }

  public async getPass(passId: string, providerName?: string): Promise<PassRecord | null> {
    const provider = this.getProvider(providerName);
    return await provider.getPass(passId);
  }
}
