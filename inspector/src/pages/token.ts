import { createButton, createCompositeElement, createElement } from "../dom-utils";
import { checkTokenValidity } from "../utils";

/**
 * Generate the HTML page asking for the wanted token.
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 */
export default function generateTokenPage(password : string | null) : void {
  const pageTitle = createElement("h1", {
    textContent: "RxPaired-inspector",
  });
  pageTitle.style.fontFamily = "monospace";
  const generateInstrElt = createElement("div", {
    textContent: "Generate a token",
  });
  generateInstrElt.style.fontSize = "1.1em";
  generateInstrElt.style.fontWeight = "bold";
  generateInstrElt.style.marginBottom = "15px";

  const inputInstrElt = createCompositeElement("div", [
    createElement("span", { className: "emphasized", textContent: "OR" }),
    createElement("span", {
      textContent: " enter the wanted token",
    }),
  ]);
  inputInstrElt.style.fontSize = "1.1em";
  inputInstrElt.style.fontWeight = "bold";
  inputInstrElt.style.marginBottom = "15px";
  inputInstrElt.style.marginTop = "15px";
  const pageBody = createCompositeElement("div", [
    pageTitle,
    generateInstrElt,
    createGenerateTokenButton(password),
    inputInstrElt,
    createTokenInputElement(password),
  ]);
  pageBody.style.textAlign = "center";
  document.body.appendChild(pageBody);
}

/**
 * Returns an HTML element corresponding to token generation.
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 * @returns {HTMLElement}
 */
function createGenerateTokenButton(password : string | null) : HTMLButtonElement {
  return createButton({
    className: "btn-generate-token",
    textContent: "Generate Token",
    onClick() {
      const tokenId = generateToken();
      window.location.hash = `#!pass=${password ?? ""}!token=${tokenId}`;
    },
  });
}

/**
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 * @returns {HTMLElement}
 */
function createTokenInputElement(password : string | null) : HTMLElement {
  const tokenInputElt = createElement("input");
  tokenInputElt.placeholder = "Enter the wanted token";
  tokenInputElt.onkeyup = function(evt) {
    if (evt.key === "Enter" || evt.keyCode === 13) {
      setToken();
    }
  };
  const tokenSendElt = createButton({
    textContent: "Set token",
    onClick: setToken,
  });
  tokenSendElt.style.marginLeft = "5px";
  return createCompositeElement("div", [ tokenInputElt, tokenSendElt ]);

  function setToken() {
    const val = tokenInputElt.value;
    checkTokenValidity(val);
    location.hash = "#!pass=" + (password ?? "") + "!token=" + val;
  }
}

/**
 * Generate token used to identify a single log session.
 * @returns {string}
 */
function generateToken() : string {
  return Math.random().toString(36).substring(2, 8); // remove `0.`
}
