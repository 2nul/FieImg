const zone = document.querySelector('#dropzone');
const input = document.querySelector('#file');
const choose = document.querySelector('#choose');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const link = document.querySelector('#link');

choose.addEventListener('click', (event) => { event.preventDefault(); input.click(); });
input.addEventListener('change', () => send(input.files[0]));
['dragenter','dragover'].forEach((event) => zone.addEventListener(event, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
['dragleave','drop'].forEach((event) => zone.addEventListener(event, (e) => { e.preventDefault(); zone.classList.remove('drag'); }));
zone.addEventListener('drop', (event) => send(event.dataTransfer.files[0]));

async function send(file) {
  if (!file) return;
  result.hidden = true;
  status.textContent = `Uploading ${file.name}…`;
  const data = new FormData(); data.append('file', file);
  try {
    const response = await fetch('/api/upload', { method: 'POST', body: data });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Upload failed.');
    link.textContent = body.url; result.hidden = false; status.textContent = '';
  } catch (error) { status.textContent = error.message || 'Something went wrong.'; }
}
document.querySelector('#copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(link.textContent);
  document.querySelector('#copy').textContent = 'Copied';
  setTimeout(() => document.querySelector('#copy').textContent = 'Copy link', 1600);
});
