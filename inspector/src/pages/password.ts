import {
  createButton,
  createCompositeElement,
  createElement,
} from "../dom-utils";
import { reGeneratePageUrl } from "../utils";

/**
 * Generate the HTML page asking for the password.
 */
export default function generatePasswordPage(): void {
  const pageTitle = createElement("h1", {
    textContent: "RxPaired-inspector",
    style: { fontFamily: "monospace" },
  });
  const pageInstr = createCompositeElement(
    "div",
    [
      "Enter the password of the linked RxPaired-server " +
        "(leave empty if it has no password):",
    ],
    {
      className: "input-title",
    }
  );
  const pageBody = createCompositeElement("div", [
    pageTitle,
    createCompositeElement("div", [
      pageInstr,
      createPasswordInputElement(),
    ], { className: "page-input-block" }),
  ]);
  document.body.appendChild(pageBody);
}

/**
 * @returns {HTMLElement}
 */
function createPasswordInputElement(): HTMLElement {
  const passwordInputElt = createElement("input");
  passwordInputElt.placeholder = "Enter server password";
  passwordInputElt.onkeyup = function (evt) {
    if (evt.key === "Enter" || evt.keyCode === 13) {
      sendPassword();
    }
  };
  const passwordSendElt = createButton({
    textContent: "Validate password",
    onClick: sendPassword,
    style: { marginLeft: "5px" },
  });
  return createCompositeElement("div", [passwordInputElt, passwordSendElt]);

  function sendPassword() {
    const val = passwordInputElt.value;
    location.href = reGeneratePageUrl(val, undefined);
  }
}
