
/**
 * Generate the HTML page asking for the password.
 */
export default function generatePasswordPage() : void {
  document.body.appendChild(createPasswordInputElement());
}

/**
 * @returns {HTMLElement}
 */
function createPasswordInputElement() : HTMLElement {
  const passwordWrapperElt = document.createElement("div");
  const passwordInputElt = document.createElement("input");
  passwordInputElt.placeholder = "Enter server password";
  const passwordSendElt = document.createElement("button");
  passwordSendElt.textContent = "Set password";
  passwordSendElt.onclick = () => {
    const val = passwordInputElt.value;
    location.hash = "#!pass=" + val;
  };
  passwordWrapperElt.appendChild(passwordInputElt);
  passwordWrapperElt.appendChild(passwordSendElt);
  return passwordWrapperElt;
}

