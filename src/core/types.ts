export interface CreatePassInput {
  name: string;
  label: string;
  value: string | number;
}

export interface UpdatePassInput {
  value: string | number;
  label?: string;
}

export interface PassRecord {
  id: string;
  name: string;
  label: string;
  value: string | number;
  createdAt: string;
  updatedAt: string;
  saveUrl: string;
  provider: string;
  qrCodeDataUrl?: string;
}

export interface PassCreationResult {
  id: string;
  pass: PassRecord;
  saveUrl: string;
  qrCodeDataUrl: string;
}

export interface PassUpdateResult {
  id: string;
  previousValue: string | number;
  newValue: string | number;
  label: string;
  updatedAt: string;
  status: 'updated_live';
  message: string;
}
