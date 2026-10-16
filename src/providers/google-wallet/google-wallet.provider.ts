import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { CreatePassInput, PassCreationResult, PassRecord, PassUpdateResult, UpdatePassInput } from '../../core/types.js';
import { IWalletProvider } from '../wallet-provider.interface.js';

const API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

export interface GoogleWalletConfig {
  issuerId: string;
  classId: string;
  clientEmail?: string;
  privateKey?: string;
  keyFilePath?: string;
  origins: string[];
}

export class GoogleWalletProvider implements IWalletProvider {
  public readonly name = 'google';
  private readonly config: GoogleWalletConfig;
  private readonly auth: GoogleAuth | null;
  private classEnsured = false;

  constructor(config?: Partial<GoogleWalletConfig>) {
    const origins = config?.origins ?? (process.env.PUBLIC_ORIGIN ? [process.env.PUBLIC_ORIGIN] : []);
    this.config = {
      issuerId: config?.issuerId ?? process.env.GOOGLE_WALLET_ISSUER_ID ?? '',
      classId: config?.classId ?? process.env.GOOGLE_WALLET_CLASS_ID ?? 'general_pass_class',
      clientEmail: config?.clientEmail ?? process.env.GOOGLE_CLIENT_EMAIL,
      privateKey: config?.privateKey ?? process.env.GOOGLE_PRIVATE_KEY,
      keyFilePath: config?.keyFilePath ?? process.env.GOOGLE_APPLICATION_CREDENTIALS,
      origins: origins.map((origin) => new URL(origin).origin)
    };

    if (this.config.keyFilePath) {
      const credentials = JSON.parse(fs.readFileSync(this.config.keyFilePath, 'utf8'));
      this.config.clientEmail ??= credentials.client_email;
      this.config.privateKey ??= credentials.private_key;
    }
    if (this.config.privateKey) this.config.privateKey = this.config.privateKey.replace(/\\n/g, '\n');

    this.auth = this.isConfigured()
      ? new GoogleAuth({
          credentials: { client_email: this.config.clientEmail, private_key: this.config.privateKey },
          scopes: [SCOPE]
        })
      : null;
  }

  public isConfigured(): boolean {
    return Boolean(this.config.issuerId && this.config.clientEmail && this.config.privateKey);
  }

  public getStatus(): { isConfigured: boolean; issuerId: string; classId: string } {
    return {
      isConfigured: this.isConfigured(),
      issuerId: this.config.issuerId ? `${this.config.issuerId.slice(0, 4)}…` : '',
      classId: this.getFullClassId()
    };
  }

  private getFullClassId(): string {
    return `${this.config.issuerId}.${this.config.classId}`;
  }

  private getFullObjectId(passId: string): string {
    return `${this.config.issuerId}.${passId}`;
  }

  private requireConfiguration(): void {
    if (!this.isConfigured() || !this.auth) {
      throw new Error('Google Wallet is not configured. Set GOOGLE_WALLET_ISSUER_ID, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY before issuing or updating passes.');
    }
  }

  public async initialize(): Promise<void> {
    if (this.isConfigured()) await this.ensureClassExists();
  }

  private async getAccessToken(): Promise<string> {
    this.requireConfiguration();
    const client = await this.auth!.getClient();
    const token = await client.getAccessToken();
    if (!token.token) throw new Error('Google authentication did not return an access token.');
    return token.token;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken();
    const response = await fetch(`${API_BASE}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers
      }
    });
    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`Google Wallet API ${init.method ?? 'GET'} ${response.status}: ${body}`);
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }
    return response;
  }

  private async ensureClassExists(): Promise<void> {
    this.requireConfiguration();
    if (this.classEnsured) return;
    const classId = this.getFullClassId();
    try {
      await this.request(`genericClass/${encodeURIComponent(classId)}`);
    } catch (error) {
      if ((error as Error & { status?: number }).status !== 404) throw error;
      try {
        await this.request('genericClass', {
          method: 'POST',
          body: JSON.stringify({
            id: classId,
            reviewStatus: 'UNDER_REVIEW',
            classTemplateInfo: {
              cardTemplateOverride: {
                cardRowTemplateInfos: [{
                  twoItems: {
                    startItem: {
                      firstValue: { fields: [{ fieldPath: "object.textModulesData['balance_module']" }] }
                    }
                  }
                }]
              }
            }
          })
        });
      } catch (createError) {
        // Another app instance may have created the shared class between GET and POST.
        if ((createError as Error & { status?: number }).status !== 409) throw createError;
      }
    }
    this.classEnsured = true;
  }

  private createSaveUrl(objectId: string): string {
    this.requireConfiguration();
    const token = jwt.sign({
      iss: this.config.clientEmail!,
      aud: 'google',
      typ: 'savetowallet',
      origins: this.config.origins,
      payload: { genericObjects: [{ id: objectId, classId: this.getFullClassId() }] }
    }, this.config.privateKey!, { algorithm: 'RS256' });
    return `https://pay.google.com/gp/v/save/${token}`;
  }

  public async createPass(input: CreatePassInput): Promise<PassCreationResult> {
    this.requireConfiguration();
    await this.ensureClassExists();
    const id = `pass_${randomBytes(12).toString('hex')}`;
    const objectId = this.getFullObjectId(id);
    const now = new Date().toISOString();
    const object = {
      id: objectId,
      classId: this.getFullClassId(),
      state: 'ACTIVE',
      hexBackgroundColor: '#101116',
      cardTitle: { defaultValue: { language: 'en-US', value: input.name } },
      header: { defaultValue: { language: 'en-US', value: `${input.label}: ${input.value}` } },
      subheader: { defaultValue: { language: 'en-US', value: 'Digital pass' } },
      textModulesData: [
        { id: 'balance_module', header: input.label, body: String(input.value) },
        { id: 'holder_name', header: 'Pass holder', body: input.name }
      ],
      barcode: { type: 'QR_CODE', value: id, alternateText: id }
    };

    // Create the canonical object first. The signed save URL references it by ID,
    // so the same object is both installable and immediately patchable via REST.
    await this.request('genericObject', { method: 'POST', body: JSON.stringify(object) });
    const saveUrl = this.createSaveUrl(objectId);
    const qrCodeDataUrl = await QRCode.toDataURL(id, { width: 280, margin: 2 });
    const pass: PassRecord = {
      id, name: input.name, label: input.label, value: input.value,
      createdAt: now, updatedAt: now, saveUrl, provider: 'google', qrCodeDataUrl
    };
    return { id, pass, saveUrl, qrCodeDataUrl };
  }

  public async updatePass(passId: string, input: UpdatePassInput): Promise<PassUpdateResult> {
    this.requireConfiguration();
    const objectId = this.getFullObjectId(passId);
    const existingResponse = await this.request(`genericObject/${encodeURIComponent(objectId)}`);
    const existing = await existingResponse.json() as Record<string, any>;
    const oldModule = (existing.textModulesData ?? []).find((module: any) => module.id === 'balance_module');
    const nameModule = (existing.textModulesData ?? []).find((module: any) => module.id === 'holder_name');
    const label = input.label ?? oldModule?.header ?? 'Balance';
    const previousValue = oldModule?.body ?? '';

    await this.request(`genericObject/${encodeURIComponent(objectId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        header: { defaultValue: { language: 'en-US', value: `${label}: ${input.value}` } },
        textModulesData: [
          { id: 'balance_module', header: label, body: String(input.value) },
          ...(nameModule ? [nameModule] : [])
        ]
      })
    });

    const updatedAt = new Date().toISOString();
    return {
      id: passId, previousValue, newValue: input.value, label, updatedAt,
      status: 'updated_live',
      message: 'Google Wallet accepted the object update. The pass should refresh on the device shortly.'
    };
  }

  public async getPass(passId: string): Promise<PassRecord | null> {
    this.requireConfiguration();
    try {
      const response = await this.request(`genericObject/${encodeURIComponent(this.getFullObjectId(passId))}`);
      const object = await response.json() as Record<string, any>;
      const balance = (object.textModulesData ?? []).find((module: any) => module.id === 'balance_module');
      const name = (object.textModulesData ?? []).find((module: any) => module.id === 'holder_name');
      return {
        id: passId,
        name: name?.body ?? object.cardTitle?.defaultValue?.value ?? '',
        label: balance?.header ?? '',
        value: balance?.body ?? '',
        createdAt: object.createdDateTime ?? '',
        updatedAt: object.updatedDateTime ?? '',
        saveUrl: '',
        provider: 'google'
      };
    } catch (error) {
      if ((error as Error & { status?: number }).status === 404) return null;
      throw error;
    }
  }
}
