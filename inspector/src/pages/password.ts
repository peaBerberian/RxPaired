import strHtml from "str-html";
import { reGeneratePageUrl } from "../utils";

/**
 * Generate the HTML page asking for the password.
 * @returns {Function} - Perform clean-up if the page is exited.
 */
export default function generatePasswordPage(): () => void {
  const pageBody = strHtml`<div>
    <h1 class="header-item page-title">
      RxPaired-inspector
    </h1>
    <div class="page-input-block">
      <div class="input-title">
        ${
          "Enter the password of the linked RxPaired-server " +
          "(leave empty if it has no password):"
        }
      </div>
      ${createPasswordInputElement()}
    </div>
  </div>`;
  document.body.appendChild(pageBody);
  return () => {
    document.body.removeChild(pageBody);
  };
}

/**
 * @returns {HTMLElement}
 */
function createPasswordInputElement(): HTMLElement {
  const passwordInputElt =
    strHtml`<input placeholder="Enter server password">` as HTMLInputElement;
  passwordInputElt.onkeyup = function (evt) {
    if (evt.key === "Enter" || evt.keyCode === 13) {
      sendPassword();
    }
  };
  const passwordSendElt = strHtml`<button class="button-input-right">${"Validate password"}</button>`;
  passwordSendElt.onclick = sendPassword;
  return strHtml`<div>${[passwordInputElt, passwordSendElt]}</div>`;
  function sendPassword() {
    const val = passwordInputElt.value;
    location.href = reGeneratePageUrl(val, undefined);
  }
}
