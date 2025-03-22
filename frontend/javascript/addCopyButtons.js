import { trackEvent } from "./lib/events";

// addCopyButtons adds copy buttons to all pre tags.
function addCopyButtons() {
  const preTags = document.querySelectorAll("pre");

  preTags.forEach((preTag) => {
    // Skip if this pre tag already has a copy button.
    if (preTag.querySelector(".copy-button")) {
      return;
    }

    // Make the pre tag position relative to position the button correctly.
    preTag.classList.add("code-block");

    // Create a copy button.
    const copyButton = document.createElement("button");
    copyButton.className = "copy-button h-8";
    copyButton.title = "Copy Code"
    copyButton.innerHTML = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 16 16"
      >
        <path
          fill-rule="evenodd"
          d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1
          1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1
          0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"
        />
      </svg>
    `.trim();

    const codeTextWithoutTrailingNewline = preTag.textContent.replace(
      /\s+$/,
      ""
    );

    copyButton.addEventListener("click", () => {
      navigator.clipboard.writeText(codeTextWithoutTrailingNewline).then(() => {
        // Temporarily change button text and class to indicate success.
        const originalHtml = copyButton.innerHTML;
        copyButton.textContent = "Copied!";
        copyButton.classList.add("copied");

        // Reset button text and remove class after 1 second.
        setTimeout(() => {
          copyButton.innerHTML = originalHtml;
          copyButton.classList.remove("copied");
        }, 1000);
      });

      trackEvent("code_copy", {
        page_url: window.location.href,
        copied_code: codeTextWithoutTrailingNewline,
      });
    });

    const copyButtonDiv = document.createElement("div");
    copyButtonDiv.className = "copy-button-container w-11";
    copyButtonDiv.appendChild(copyButton);
    preTag.parentElement.appendChild(copyButtonDiv);
  });
}

// Initialize copy buttons only once.
function initCopyButtons() {
  if (window.copyButtonsInitialized) return;

  addCopyButtons();
  window.copyButtonsInitialized = true;
}

// Run the function when the DOM is fully loaded.
document.addEventListener("DOMContentLoaded", initCopyButtons);

// Fallback in case the script is loaded after DOMContentLoaded.
if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  initCopyButtons();
}
