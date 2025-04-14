/**
 * Checks if an error is an abort error from user cancellation
 * @param {Error} err - The error to check
 * @returns {boolean} - True if the error is an abort error
 */
function isUserAbortError(err) {
  return err.name === 'AbortError' || err.message === 'Request was aborted.';
}

module.exports = {
  isUserAbortError: isUserAbortError,
};
