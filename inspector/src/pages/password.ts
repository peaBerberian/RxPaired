import { createButton, createCompositeElement, createElement } from "../dom-utils";

/**
 * Generate the HTML page asking for the password.
 */
export default function generatePasswordPage() : void {
  const pageTitle = createElement("h1", {
    textContent: "RxPaired-inspector",
  });
  pageTitle.style.fontFamily = "monospace";
  const pageInstr = createElement("div", {
    textContent: "Enter the password of the linked RxPaired-server",
  });
  pageInstr.style.fontSize = "1.1em";
  pageInstr.style.fontWeight = "bold";
  pageInstr.style.marginBottom = "15px";
  const pageBody = createCompositeElement("div", [
    pageTitle,
    pageInstr,
    createPasswordInputElement(),
  ]);
  pageBody.style.textAlign = "center";
  document.body.appendChild(pageBody);
}

/**
 * @returns {HTMLElement}
 */
function createPasswordInputElement() : HTMLElement {
  const passwordInputElt = createElement("input");
  passwordInputElt.placeholder = "Enter server password";
  passwordInputElt.onkeyup = function(evt) {
    if (evt.key === "Enter" || evt.keyCode === 13) {
      sendPassword();
    }
  };
  const passwordSendElt = createButton({
    textContent: "Set password",
    onClick: sendPassword,
  });
  passwordSendElt.style.marginLeft = "5px";
  return createCompositeElement("div", [ passwordInputElt, passwordSendElt ]);

  function sendPassword() {
    const val = passwordInputElt.value;
    location.hash = "#!pass=" + val;
  }
}

