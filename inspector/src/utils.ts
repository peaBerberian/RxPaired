import { createElement } from "./dom-utils";
import modules from "./modules/index";

/**
 * @param {string} tokenId
 */
export function checkTokenValidity(tokenId : string) : void {
  if (!/^[A-Za-z0-9]+$/.test(tokenId)) {
    const error = new Error(
      "Error: Your token must only contain alphanumeric characters"
    );
    displayError(error);
    throw error;
  }
}

/**
 * Display error message given on the top of the page.
 * @param {Error|string} [err] - The Error encountered.
 */
export function displayError(err? : unknown) : void {
  let message;
  if (err != null) {
    if (typeof err === "string") {
      message = err;
    } else if (typeof (err as Error).message === "string") {
      message = (err as Error).message;
    }
  }
  if (message === undefined) {
    message = "Encountered unknown Error";
  }

  const errorDiv = createElement("div", {
    className: "error-msg",
    textContent: `${new Date().toISOString()}: Error: ${message}`,
  });
  const bodyElements = document.body.children;
  if (bodyElements.length > 0) {
    document.body.insertBefore(errorDiv, bodyElements[0]);
  } else {
    document.body.appendChild(errorDiv);
  }
}

/**
 * @returns {Array.<string>}
 */
export function getDefaultModuleOrder() : string[] {
  return modules.map(({ moduleId }) => moduleId);
}
