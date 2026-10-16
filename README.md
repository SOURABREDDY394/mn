<div align="center">

# MN Pass

**Create a Google Wallet pass. Keep it current.**

A focused pass builder and TypeScript API for issuing a digital pass once, then updating its value on the same saved pass.

![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Express-3178C6?logo=typescript&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-7564FF.svg)

</div>

## Preview

<table>
  <tr>
    <td align="center"><strong>Desktop</strong></td>
    <td align="center"><strong>Mobile</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/mn-pass-desktop.png" alt="MN Pass desktop interface with the pass builder and Wallet preview" width="760"></td>
    <td><img src="docs/screenshots/mn-pass-mobile.png" alt="MN Pass responsive mobile interface" width="220"></td>
  </tr>
</table>

*Screenshots show the interface preview. Creating real passes requires Google Wallet issuer credentials.*

## Features

- Create Google Wallet Generic passes with a holder name, custom label, value, unique ID, and QR code.
- Generate a signed **Add to Google Wallet** link for each pass.
- Update a saved pass in place through `POST /passes/{id}`—no replacement pass is needed.
- Read the current pass directly from Google Wallet; pass data is not kept in an in-memory store.
- Preview pass details as you type, see issuer configuration status, and copy a ready-to-use update request.
- Keep wallet logic behind a provider interface so another wallet platform can be added without changing the pass workflow.

The app does not simulate Wallet operations. If credentials are missing or Google rejects a request, the API returns an error instead of a false success. You can run the UI for a visual preview without issuer setup; creating and updating passes requires valid credentials.

## Get started

### 1. Set up Google Wallet

1. Create or select an issuer in the [Google Pay & Wallet Console](https://pay.google.com/business/console) and note its Issuer ID.
2. In Google Cloud, enable the [Google Wallet Objects API](https://developers.google.com/wallet/generic) and create a service account.
3. Grant that service account access to the issuer. For local development, create a JSON key, save it in the project root as `service_account.json` (or change the path in `.env`), and keep it private.
4. If the issuer is in Demo Mode, add the Google account on your Android phone as a test user in the Wallet Console.

### 2. Configure the app

Use Node.js 20 or newer. Copy `.env.example` to `.env` and set:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_WALLET_ISSUER_ID` | Your Wallet issuer ID. |
| `PUBLIC_ORIGIN` | The app's exact origin, such as `https://passes.example.com` (no path). Used to sign Wallet save links. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to your service-account JSON key. |
| `GOOGLE_WALLET_CLASS_ID` | Optional class suffix; `.env.example` uses `mn_balance_pass_v1`. |
| `PORT` | Optional HTTP port; defaults to `3000`. |

Instead of a key file, configure both `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY`. Put secrets only in `.env` locally or your host's secret settings—never in source control or frontend code.

### 3. Install and run

```bash
npm ci
cp .env.example .env
# Add the Wallet settings and credentials to .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env`. Open [http://localhost:3000](http://localhost:3000).

Build and run the production server:

```bash
npm run build
npm start
```

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/passes` | Create a pass and return its ID, signed save link, and QR code. |
| `POST` | `/passes/{id}` | Update the value of an existing pass. `/api/passes/{id}` is also supported. |
| `GET` | `/api/passes/{id}` | Read the latest pass data from Google Wallet. |
| `GET` | `/api/status` | Check whether Wallet credentials are configured. |
| `GET` | `/api/health` | Lightweight server health check. |

Create a pass:

```bash
curl -X POST http://localhost:3000/api/passes \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex Morgan","label":"Balance","value":40}'
```

Use the returned `data.saveUrl` on an eligible Android phone to add the pass. The response also includes `data.id` and `data.qrCodeDataUrl`.

Update the same pass:

```bash
curl -X POST http://localhost:3000/passes/PASS_ID \
  -H "Content-Type: application/json" \
  -d '{"value":55}'
```

You can also change the label: `{"value":55,"label":"Points"}`. A successful response means Google accepted the object update. Wallet syncs it to the phone when the device is online; the refresh may take a short time.

## How it is organized

```text
Browser UI → Express routes → PassController → PassService → IWalletProvider
                                                               └─ GoogleWalletProvider → Wallet API
```

The controller handles HTTP validation and responses; the service owns pass workflows and provider selection; the provider implements wallet-specific operations. Google Wallet is the canonical pass store.

```text
src/
  controllers/       HTTP validation and responses
  core/              Shared pass types
  providers/         Wallet provider contract and integrations
  services/          Pass workflows and provider selection
  public/            Responsive web interface
docs/screenshots/    README screenshots
```

## Deploy

Deploy as a Node.js web service. Use `npm ci` to install, `npm run build` to build, and `npm start` to run. Set the Wallet credentials as host secrets, set `PUBLIC_ORIGIN` to the deployed HTTPS origin, and use `/api/health` as the health-check path if your host supports one.

## License

[MIT](LICENSE)
