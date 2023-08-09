import strHtml from "str-html";
import modules from "./modules/index";

/**
 * Re-generate the page URL according to the communicated arguments.
 *
 * Format of the hash:
 * #!pass=<SERVER_SIDE_CHECKED_PASSWORD>!token=<TOKEN>
 * The password is mandatory, the token is only set if it has been generated.
 *
 * @param {string|null|undefined} withPassword - Current password inputed.
 * `null` for no password.
 * `undefined` if no password has been inputed for now.
 * @param {string|undefined} withToken - Current token inputed.
 * `undefined` if no token has been inputed for now.
 * @param {boolean} [isPostDebugger] - If the wanted page is the Post-Debugger
 * page. `false` by default.
 * @returns {string}
 */
export function reGeneratePageUrl(
  withPassword: string | null | undefined,
  withToken: string | undefined,
  isPostDebugger: boolean = false,
): string {
  const originalUrl = new URL(document.location.href);
  originalUrl.hash = "";
  let url = originalUrl.toString() + "#";
  if (withPassword !== undefined) {
    url += "!pass=" + (withPassword ?? "");
    if (isPostDebugger) {
      url += "!post";
    } else if (withToken !== undefined) {
      url += "!token=" + withToken;
    }
  }
  return url;
}

/**
 * Parse information that can be gathered from the current URL
 * @returns {Object} urlInfo
 * @returns {boolean} urlInfo.isPostDebugger - If `true` we should be running
 * the "Post-Debugger" page.
 * @returns {string|null|undefined} urlInfo.password - Current password inputed.
 * `null` for no password.
 * `undefined` if no password has been inputed for now.
 * @returns {string|undefined} urlInfo.tokenId - Current token inputed.
 * `undefined` if no token has been inputed for now.
 */
export function parseUrl(): {
  isPostDebugger: boolean;
  password: string | null | undefined;
  tokenId: string | undefined;
} {
  let password;
  let tokenId;
  const initialHashValues = window.location.hash.split("!");
  const isPostDebugger =
    initialHashValues.filter((val) => val.startsWith("post"))[0] !== undefined;
  const passStr = initialHashValues.filter((val) => val.startsWith("pass="))[0];
  if (passStr !== undefined) {
    password = passStr.substring("pass=".length);
    password = password.length === 0 ? null : password;
    const tokenStr = initialHashValues.filter((val) =>
      val.startsWith("token="),
    )[0];
    if (tokenStr !== undefined) {
      tokenId = tokenStr.substring("token=".length);
    }
  }
  return { isPostDebugger, password, tokenId };
}

/**
 * Returns `true` if the given token can be considered valid.
 * Returns `false` otherwise.
 * @param {string} tokenId
 */
export function isTokenValid(tokenId: string): boolean {
  return /^[A-Za-z0-9]+$/.test(tokenId);
}

/**
 * Display error message given on the top of the page.
 * @param {HTMLElement} errorWrapperElt - HTML
 * @param {Error|string} [err] - The Error encountered.
 * @param {boolean|undefined} [fadeOut] - If `true`, the error fades out at 3
 * seconds then disappears after 5 seconds.
 */
export function displayError(
  errorWrapperElt: HTMLElement,
  err?: unknown,
  fadeOut?: boolean,
): void {
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

  const errorDiv = strHtml`<div class="error-msg">
    ${`${new Date().toISOString()}: Error: ${message}`}
  </div>`;
  if (fadeOut === true) {
    setTimeout(() => {
      errorDiv.classList.add("fade-out");
    }, 3000);
    setTimeout(() => {
      if (errorDiv.parentElement === errorWrapperElt) {
        errorWrapperElt.removeChild(errorDiv);
      }
    }, 5000);
  }
  const bodyElements = errorWrapperElt.children;
  if (bodyElements.length > 0) {
    errorWrapperElt.insertBefore(errorDiv, bodyElements[0]);
  } else {
    errorWrapperElt.appendChild(errorDiv);
  }
}

/**
 * Returns the default order in which inspector modules should be displayed,
 * from left-to-right and top-to-bottom.
 *
 * The returned value is an array of the module's id in that order.
 * @returns {Array.<string>}
 */
export function getDefaultModuleOrder(): string[] {
  return modules.map(({ moduleId }) => moduleId);
}
