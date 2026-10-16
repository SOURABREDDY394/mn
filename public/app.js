let currentPass = null;

const byId = (id) => document.getElementById(id);
const apiStatusBadge = byId('apiStatusBadge');
const createPassForm = byId('createPassForm');
const createBtn = byId('createBtn');
const createFeedback = byId('createFeedback');
const nameInput = byId('nameInput');
const labelInput = byId('labelInput');
const valueInput = byId('valueInput');
const previewName = byId('previewName');
const previewLabel = byId('previewLabel');
const previewValue = byId('previewValue');
const previewPassId = byId('previewPassId');
const placeholderNotice = byId('placeholderNotice');
const qrContainer = byId('qrContainer');
const qrImage = byId('qrImage');
const saveBtnContainer = byId('saveBtnContainer');
const googleWalletLink = byId('googleWalletLink');
const updateSection = byId('updateSection');
const updateLabelDisplay = byId('updateLabelDisplay');
const updateValueInput = byId('updateValueInput');
const triggerUpdateBtn = byId('triggerUpdateBtn');
const curlCodeSnippet = byId('curlCodeSnippet');
const copyCurlBtn = byId('copyCurlBtn');
const updateFeedback = byId('updateFeedback');

function setFeedback(element, message, kind) {
  element.textContent = message;
  element.classList.toggle('feedback-error', kind === 'error');
  element.hidden = !message;
}

function updateCurlSnippet(passId, value = 55) {
  curlCodeSnippet.textContent = [
    'curl -X POST ' + window.location.origin + '/passes/' + passId + ' \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"value": ' + value + '}\''
  ].join('\n');
}

async function checkApiStatus() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Status request failed');
    const data = await response.json();
    const text = apiStatusBadge.querySelector('.status-text');
    if (data.googleWallet?.configured) {
      apiStatusBadge.className = 'status-pill status-online';
      text.textContent = 'Wallet connected · ' + data.googleWallet.issuerId;
    } else {
      apiStatusBadge.className = 'status-pill status-warning';
      text.textContent = 'Issuer setup required';
    }
  } catch {
    apiStatusBadge.className = 'status-pill status-warning';
    apiStatusBadge.querySelector('.status-text').textContent = 'API unavailable';
  }
}

nameInput.addEventListener('input', () => {
  previewName.textContent = nameInput.value.trim() || 'Your name';
});

labelInput.addEventListener('input', () => {
  const label = labelInput.value.trim() || 'YOUR VALUE';
  previewLabel.textContent = label.toLocaleUpperCase();
  updateLabelDisplay.textContent = label + ':';
});

valueInput.addEventListener('input', () => {
  previewValue.textContent = valueInput.value || '—';
});

createPassForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!createPassForm.reportValidity()) return;

  createBtn.disabled = true;
  createBtn.querySelector('.button-text').textContent = 'Creating your pass';
  setFeedback(createFeedback, '', '');

  try {
    const response = await fetch('/api/passes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nameInput.value.trim(),
        label: labelInput.value.trim(),
        value: Number(valueInput.value)
      })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Could not create the pass.');

    currentPass = result.data.pass;
    previewName.textContent = currentPass.name;
    previewLabel.textContent = currentPass.label.toLocaleUpperCase();
    previewValue.textContent = currentPass.value;
    previewPassId.textContent = currentPass.id;
    qrImage.src = result.data.qrCodeDataUrl;
    googleWalletLink.href = result.data.saveUrl;
    placeholderNotice.hidden = true;
    qrContainer.hidden = false;
    saveBtnContainer.hidden = false;
    updateSection.hidden = false;
    updateLabelDisplay.textContent = currentPass.label + ':';
    updateValueInput.value = '';
    updateCurlSnippet(currentPass.id);
    setFeedback(updateFeedback, '', '');
    createBtn.querySelector('.button-text').textContent = 'Create another pass';
  } catch (error) {
    setFeedback(createFeedback, error.message || 'Could not create the pass.', 'error');
    createBtn.querySelector('.button-text').textContent = 'Try again';
  } finally {
    createBtn.disabled = false;
  }
});

triggerUpdateBtn.addEventListener('click', async () => {
  if (!currentPass) return;
  const newValue = updateValueInput.value;
  if (newValue === '') {
    setFeedback(updateFeedback, 'Enter the new value to send to Google Wallet.', 'error');
    updateValueInput.focus();
    return;
  }

  triggerUpdateBtn.disabled = true;
  triggerUpdateBtn.querySelector('span').textContent = 'Sending';
  setFeedback(updateFeedback, '', '');

  try {
    const response = await fetch('/passes/' + encodeURIComponent(currentPass.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: Number(newValue) })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'The Wallet update failed.');

    previewValue.textContent = result.data.newValue;
    previewValue.animate([
      { transform: 'scale(.92)', color: '#00d4ff' },
      { transform: 'scale(1.08)', color: '#a4ffe1' },
      { transform: 'scale(1)', color: '#9cecff' }
    ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    currentPass.value = result.data.newValue;
    updateCurlSnippet(currentPass.id, Number(newValue) + 10);
    setFeedback(updateFeedback, 'Google accepted the update. ' + result.data.message, 'success');
  } catch (error) {
    setFeedback(updateFeedback, error.message || 'The Wallet update failed.', 'error');
  } finally {
    triggerUpdateBtn.disabled = false;
    triggerUpdateBtn.querySelector('span').textContent = 'Send update';
  }
});

copyCurlBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(curlCodeSnippet.textContent);
    copyCurlBtn.textContent = 'COPIED';
    window.setTimeout(() => { copyCurlBtn.textContent = 'COPY'; }, 1500);
  } catch {
    copyCurlBtn.textContent = 'SELECT TO COPY';
  }
});

checkApiStatus();
