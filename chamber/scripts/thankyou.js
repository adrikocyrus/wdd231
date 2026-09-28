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