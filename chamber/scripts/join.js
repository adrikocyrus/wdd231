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