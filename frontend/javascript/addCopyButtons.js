// addCopyButtons adds copy buttons to all pre tags.
function addCopyButtons() {
  const preTags = document.querySelectorAll('pre');

  preTags.forEach((preTag) => {
    // Skip if this pre tag already has a copy button.
    if (preTag.querySelector('.copy-button')) {
      return;
    }

    // Make the pre tag position relative to position the button correctly.
    preTag.classList.add('code-block');

    // Create a copy button.
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button min-w-24';
    copyButton.textContent = 'Copy Code';

    const codeTextWithoutTrailingNewline = preTag.textContent.replace(/\s+$/, '');

    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(codeTextWithoutTrailingNewline)
        .then(() => {
          // Temporarily change button text and class to indicate success.
          const originalText = copyButton.textContent;
          copyButton.textContent = 'Copied!';
          copyButton.classList.add('copied');

          // Reset button text and remove class after 1 second.
          setTimeout(() => {
            copyButton.textContent = originalText;
            copyButton.classList.remove('copied');
          }, 1000);
        });
    });

    // Add the button to the pre tag.
    preTag.appendChild(copyButton);
  });
}

// Initialize copy buttons only once.
function initCopyButtons() {
  if (window.copyButtonsInitialized) return;

  addCopyButtons();
  window.copyButtonsInitialized = true;
}

// Run the function when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', initCopyButtons);

// Fallback in case the script is loaded after DOMContentLoaded.
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initCopyButtons();
}
