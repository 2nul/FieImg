const STORAGE_KEY = 'fieimg.lastUpload';
const zone = document.querySelector('#dropzone');
const input = document.querySelector('#file');
const choose = document.querySelector('#choose');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const link = document.querySelector('#link');
const savedUpload = document.querySelector('#savedUpload');
const savedImage = document.querySelector('#savedImage');
const savedName = document.querySelector('#savedName');
const savedLink = document.querySelector('#savedLink');
const mainCopy = document.querySelector('#copy');
const savedCopy = document.querySelector('#savedCopy');

choose.addEventListener('click', (event) => {
  event.preventDefault();
  input.click();
});

input.addEventListener('change', () => send(input.files[0]));
['dragenter', 'dragover'].forEach((eventName) => {
  zone.addEventListener(eventName, (event) => {
    event.preventDefault();
    zone.classList.add('drag');
  });
});
['dragleave', 'drop'].forEach((eventName) => {
  zone.addEventListener(eventName, (event) => {
    event.preventDefault();
    zone.classList.remove('drag');
  });
});
zone.addEventListener('drop', (event) => send(event.dataTransfer.files[0]));

function setStatus(message, tone = 'info') {
  status.textContent = message;
  status.dataset.tone = tone;
}

function persistUpload(upload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(upload));
  renderSavedUpload(upload);
}

function renderSavedUpload(upload) {
  if (!upload || !upload.url) {
    savedUpload.hidden = true;
    return;
  }

  savedUpload.hidden = false;
  savedImage.src = upload.preview || upload.url;
  savedImage.alt = upload.name || 'Uploaded image';
  savedName.textContent = upload.name || 'Untitled image';
  savedLink.value = upload.url;
}

function hydrateSavedUpload() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const upload = JSON.parse(raw);
    renderSavedUpload(upload);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function resizeToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const context = canvas.getContext('2d');
        context.fillStyle = '#0b1220';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, canvas.width, canvas.height);

        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = outputType === 'image/png' ? 0.92 : 0.82;
        resolve(canvas.toDataURL(outputType, quality));
      };
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function copyText(value, button) {
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    const previous = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = previous;
    }, 1600);
  } catch {
    const temp = document.createElement('textarea');
    temp.value = value;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
    const previous = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = previous;
    }, 1600);
  }
}

async function send(file) {
  if (!file) return;

  result.hidden = true;
  setStatus(`Uploading ${file.name}…`, 'info');

  const data = new FormData();
  data.append('file', file);

  try {
    const response = await fetch('/api/upload', { method: 'POST', body: data });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Upload failed.');

    const preview = await resizeToDataUrl(file).catch(() => null);
    const upload = {
      name: file.name,
      url: body.url,
      preview,
      uploadedAt: Date.now(),
    };

    link.textContent = body.url;
    result.hidden = false;
    persistUpload(upload);
    setStatus('Saved locally and ready to share.', 'success');
  } catch (error) {
    setStatus(error.message || 'Something went wrong.', 'error');
  }
}

mainCopy.addEventListener('click', () => copyText(link.textContent, mainCopy));
savedCopy.addEventListener('click', () => copyText(savedLink.value, savedCopy));

hydrateSavedUpload();
