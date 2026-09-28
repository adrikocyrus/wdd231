javascript
// Set the timestamp when the form loads
const timestampField = document.querySelector('#timestamp');
if (timestampField) {
  timestampField.value = new Date().toISOString();
}

// Open modals from the membership card links
document.querySelectorAll('[data-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    const dialog = document.getElementById(button.dataset.modal);
    if (dialog) dialog.showModal();
  });
});

// Close buttons and clicking the backdrop
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.querySelector('.close-modal').addEventListener('click', () => dialog.close());

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});
scripts/thankyou.js
javascript
const params = new URLSearchParams(window.location.search);

const fields = ['firstName', 'lastName', 'email', 'phone', 'organization'];

fields.forEach((name) => {
  const output = document.querySelector(`#out-${name}`);
  if (output) output.textContent = params.get(name) || 'Not provided';
});

const timestamp = params.get('timestamp');
const timeOutput = document.querySelector('#out-timestamp');

if (timeOutput) {
  const date = timestamp ? new Date(timestamp) : null;
  timeOutput.textContent =
    date && !isNaN(date)
      ? date.toLocaleString('en-UG', { dateStyle: 'long', timeStyle: 'short' })
      : 'Not provided';
}