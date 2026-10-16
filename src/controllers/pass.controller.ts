import { Request, Response } from 'express';
import { PassService } from '../services/pass.service.js';
import { GoogleWalletProvider } from '../providers/google-wallet/google-wallet.provider.js';

export class PassController {
  private passService: PassService;
  private googleProvider: GoogleWalletProvider;

  constructor(passService: PassService, googleProvider: GoogleWalletProvider) {
    this.passService = passService;
    this.googleProvider = googleProvider;
  }

  /**
   * POST /api/passes
   * Creates a pass and returns the Google Wallet Save URL + QR Code
   */
  public createPass = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, label, value, provider } = req.body ?? {};

      if (typeof name !== 'string' || !name.trim() || name.length > 120 ||
          typeof label !== 'string' || !label.trim() || label.length > 80 ||
          value === undefined || value === null || value === '' || !Number.isFinite(Number(value))) {
        res.status(400).json({
          success: false,
          error: 'Provide a name (up to 120 characters), label (up to 80 characters), and a finite numeric value.'
        });
        return;
      }

      const result = await this.passService.createPass(
        {
          name: name.trim(),
          label: label.trim(),
          value: Number(value)
        },
        provider
      );

      res.status(201).json({
        success: true,
        message: 'Pass created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error creating pass:', error);
      const status = (error as Error & { status?: number }).status;
      res.status(status === 404 ? 404 : 502).json({
        success: false,
        error: (error as Error).message
      });
    }
  };

  /**
   * POST /passes/:id  (and POST /api/passes/:id)
   * Exact requirement: Updates the number for a pass, e.g. POST /passes/{id} with { "value": 55 }
   */
  public updatePass = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { value, label } = req.body ?? {};

      if (value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ||
          (label !== undefined && (typeof label !== 'string' || !label.trim() || label.length > 80))) {
        res.status(400).json({
          success: false,
          error: 'Missing required field: "value" is mandatory (e.g. { "value": 55 }).'
        });
        return;
      }

      const result = await this.passService.updatePass(id, {
        value: Number(value),
        label: label?.trim()
      });

      res.status(200).json({
        success: true,
        message: 'Pass value updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error updating pass:', error);
      const status = (error as Error & { status?: number }).status;
      res.status(status === 404 ? 404 : 502).json({
        success: false,
        error: (error as Error).message
      });
    }
  };

  /**
   * GET /api/passes/:id
   * Retrieve pass details and current value
   */
  public getPass = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const pass = await this.passService.getPass(id);

      if (!pass) {
        res.status(404).json({
          success: false,
          error: `Pass with ID '${id}' not found.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: pass
      });
    } catch (error) {
      res.status(502).json({
        success: false,
        error: (error as Error).message
      });
    }
  };

  /**
   * GET /api/status
   * Provider status & healthcheck
   */
  public getStatus = async (_req: Request, res: Response): Promise<void> => {
    const googleStatus = this.googleProvider.getStatus();
    res.status(200).json({
      success: true,
      service: 'Google Wallet Pass Issuer API',
      status: googleStatus.isConfigured ? 'configured' : 'needs_configuration',
      mode: 'google_wallet_only',
      googleWallet: {
        configured: googleStatus.isConfigured,
        issuerId: googleStatus.issuerId ? `${googleStatus.issuerId.substring(0, 4)}...` : 'Not Set',
        classId: googleStatus.classId
      },
      endpoints: {
        createPass: 'POST /api/passes',
        updatePass: 'POST /passes/:id',
        getPass: 'GET /api/passes/:id'
      }
    });
  };
}
