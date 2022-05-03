import { createButton } from "../dom-utils";
import { checkTokenValidity } from "../utils";

/**
 * Generate the HTML page asking for the wanted token.
 * @param {string} password - The password currently used for server
 * interaction.
 */
export default function generateTokenPage(password : string) : void {
  document.body.appendChild(createGenerateTokenButton(password));
  const orElt = document.createElement("p");
  orElt.textContent = "OR";
  document.body.appendChild(orElt);
  document.body.appendChild(createTokenInputElement(password));
}

/**
 * Returns an HTML element corresponding to token generation.
 * @param {string} password - The password currently used for server
 * interaction.
 * @returns {HTMLElement}
 */
function createGenerateTokenButton(password : string) : HTMLButtonElement {
  return createButton({
    className: "btn-generate-token",
    textContent: "Generate Token",
    onClick() {
      const tokenId = generateToken();
      window.location.hash = `#!pass=${password}!token=${tokenId}`;
    },
  });
}

/**
 * @param {string} password - The password currently used for server
 * interaction.
 * @returns {HTMLElement}
 */
function createTokenInputElement(password : string) : HTMLElement {
  const tokenWrapperElt = document.createElement("div");
  const tokenInputElt = document.createElement("input");
  tokenInputElt.placeholder = "Enter the wanted token";
  const tokenSendElt = document.createElement("button");
  tokenSendElt.textContent = "Set token";
  tokenSendElt.onclick = () => {
    const val = tokenInputElt.value;
    checkTokenValidity(val);
    location.hash = "#!pass=" + password + "!token=" + val;
  };
  tokenWrapperElt.appendChild(tokenInputElt);
  tokenWrapperElt.appendChild(tokenSendElt);
  return tokenWrapperElt;
}

/**
 * Generate token used to identify a single log session.
 * @returns {string}
 */
function generateToken() : string {
  return Math.random().toString(36).substring(2, 8); // remove `0.`
}
