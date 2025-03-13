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
        height="24"
        width="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 4C16.93 4 17.395 4 17.7765 4.10222C18.8117 4.37962 19.6204 5.18827
          19.8978 6.22354C20 6.60504 20 7.07003 20 8V17.2C20 18.8802 20 19.7202 19.673
          20.362C19.3854 20.9265 18.9265 21.3854 18.362 21.673C17.7202 22 16.8802 22
          15.2 22H8.8C7.11984 22 6.27976 22 5.63803 21.673C5.07354 21.3854 4.6146
          20.9265 4.32698 20.362C4 19.7202 4 18.8802 4 17.2V8C4 7.07003 4 6.60504
          4.10222 6.22354C4.37962 5.18827 5.18827 4.37962 6.22354 4.10222C6.60504 4
          7.07003 4 8 4M9.6 6H14.4C14.9601 6 15.2401 6 15.454 5.89101C15.6422 5.79513
          15.7951 5.64215 15.891 5.45399C16 5.24008 16 4.96005 16 4.4V3.6C16 3.03995
          16 2.75992 15.891 2.54601C15.7951 2.35785 15.6422 2.20487 15.454
          2.10899C15.2401 2 14.9601 2 14.4 2H9.6C9.03995 2 8.75992 2 8.54601
          2.10899C8.35785 2.20487 8.20487 2.35785 8.10899 2.54601C8 2.75992 8 3.03995
          8 3.6V4.4C8 4.96005 8 5.24008 8.10899 5.45399C8.20487 5.64215 8.35785
          5.79513 8.54601 5.89101C8.75992 6 9.03995 6 9.6 6Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
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
