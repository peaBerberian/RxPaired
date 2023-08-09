import strHtml from "str-html";
import { CLIENT_SCRIPT_URL, SERVER_URL } from "../constants";
import { displayError, isTokenValid, reGeneratePageUrl } from "../utils";

/**
 * Generate the HTML page asking for the wanted token.
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 * @returns {Function} - Perform clean-up if the page is exited.
 */
export default function generateTokenPage(password: string | null): () => void {
  const activeTokensListElt = strHtml`<pre class="active-tokens-list">Loading...</pre>`;
  const errorContainerElt = strHtml`<div></div>`;
  const pageBodyElt = strHtml`<div>
    ${errorContainerElt}
    <div class="header">
      <div class="header-item page-title">
        <a href=${reGeneratePageUrl(undefined, undefined)}>${"Home"}</a>
        ${"> Token"}
      </div>
    </div>
    <div class="page-input-block">
      <div>
        <div class="input-title">
          Generate a token:
        </div>
        ${createGenerateTokenButton(password, errorContainerElt)}
      </div>
      <br>
      <div>
        <div class="input-title">
          <span class="emphasized">OR</span>
          <span> enter the wanted token:</span>
        </div>
        ${createTokenInputElement(password, errorContainerElt)}
      </div>
      <br>
      <div>
        <div class="input-title">
          <span class="emphasized">OR</span>
          <span> import an already-generated log file (Post-Debugger page):</span>
        </div>
        ${createPostDebuggingButtonElt(password)}
      </div>
      <br>
      <div>
        <div class="active-tokens-title">
          List of currently active tokens:
        </div>
        ${activeTokensListElt}
      </div>
    </div>
  </div>`;
  document.body.appendChild(pageBodyElt);

  let hasAddedNoTokenTutorial = false;

  // Refresh list of tokens
  const wsUrl =
    password === null
      ? `${SERVER_URL}/!list`
      : `${SERVER_URL}/${password}/!list`;
  const socket = new WebSocket(wsUrl);
  socket.onmessage = function (evt) {
    let data;
    if (Array.isArray(evt.data)) {
      data = evt.data as unknown as ParsedTokenListServerMessage;
    } else if (typeof evt.data === "string") {
      data = JSON.parse(evt.data) as unknown as ParsedTokenListServerMessage;
    } else {
      console.error("Unrecognized list data");
      return;
    }
    onActiveTokenListUpdate(data.tokenList, activeTokensListElt, password);

    if (!hasAddedNoTokenTutorial) {
      pageBodyElt.appendChild(createNoTokenTutorialElement(password));
      hasAddedNoTokenTutorial = true;
    }
  };
  socket.onclose = function onWebSocketClose() {
    activeTokensListElt.innerHTML = "Error: WebSocket connection closed";
  };

  return () => {
    socket.onclose = null;
    socket.close();
    document.body.removeChild(pageBodyElt);
  };
}

/**
 * Returns an HTML element corresponding to token generation.
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 * @param {HTMLElement} errorContainerElt - HTMLElement on which might be
 * displayed errors if the token is invalid.
 * @returns {HTMLElement}
 */
function createGenerateTokenButton(
  password: string | null,
  errorContainerElt: HTMLElement,
): HTMLElement {
  const generateTokenButtonElt = strHtml`<button class="btn-generate-token">
    Generate Token
  </button>`;
  generateTokenButtonElt.onclick = () => {
    const tokenId = generateToken();
    setToken(tokenId, password, errorContainerElt);
  };
  return generateTokenButtonElt;
}

/**
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 * @returns {HTMLElement}
 */
function createPostDebuggingButtonElt(password: string | null): HTMLElement {
  const postDebuggingButtonElt = strHtml`<button>
    Go to Post-Debugger page
  </button>`;
  postDebuggingButtonElt.onclick = () => {
    window.location.href = reGeneratePageUrl(password, undefined, true);
  };
  return postDebuggingButtonElt;
}

/**
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 * @param {HTMLElement} errorContainerElt - HTMLElement on which might be
 * displayed errors if the token is invalid.
 * @returns {HTMLElement}
 */
function createTokenInputElement(
  password: string | null,
  errorContainerElt: HTMLElement,
): HTMLElement {
  const tokenInputElt =
    strHtml`<input placeholder="Enter the wanted token">` as HTMLInputElement;
  tokenInputElt.onkeyup = function (evt) {
    if (evt.key === "Enter" || evt.keyCode === 13) {
      setToken(tokenInputElt.value, password, errorContainerElt);
    }
  };

  const tokenSendElt = strHtml`<button>Set token</button>`;
  tokenSendElt.onclick = () =>
    setToken(tokenInputElt.value, password, errorContainerElt);
  tokenSendElt.style.marginLeft = "5px";

  return strHtml`<span>${[tokenInputElt, tokenSendElt]}</span>`;
}

/**
 * @param {string} tokenValue - The value of the token to set.
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 * @param {HTMLElement} errorContainerElt - HTMLElement on which might be
 * displayed errors if the token is invalid.
 */
function setToken(
  tokenValue: string,
  password: string | null,
  errorContainerElt: HTMLElement,
): void {
  if (!isTokenValid(tokenValue)) {
    const error = new Error(
      "Error: A token must only contain alphanumeric characters",
    );
    displayError(errorContainerElt, error, true);
    return;
  }
  window.location.href = reGeneratePageUrl(password, tokenValue);
}

/**
 * Generate token used to identify a single log session.
 * @returns {string}
 */
function generateToken(): string {
  return Math.random().toString(36).substring(2, 8); // remove `0.`
}

function createNoTokenTutorialElement(password: string | null): HTMLElement {
  const fakeTokenStr = `!notoken${password === null ? "" : "/" + password}`;

  /* eslint-disable max-len */
  const liElt1 = strHtml`<li>
    Load in your HTML page the following script before all other running scripts:
    "<span class="emphasized">${CLIENT_SCRIPT_URL}#${fakeTokenStr}</span>"
    <br>
    For example, you can just add before the first script tag:
    <span class="emphasized">
      ${`<script src="${CLIENT_SCRIPT_URL.replace(
        /"/g,
        '\\"',
      )}#${fakeTokenStr}"></script>`}
    </span>
  </li>`;
  /* eslint-enable max-len */

  const liElt2 = strHtml`<li>
    Add manually the content of this script to the beginning of the
    first script tag of your page:
    <a href=${CLIENT_SCRIPT_URL}>${CLIENT_SCRIPT_URL}</a>
    and manually set the
    \`<span class="emphasized">__TOKEN__</span>\`
    variable on top of that script to
    <span class="emphasized">"${fakeTokenStr}"</span>.
  </li>`;

  const dynamicImportCode1 = `import("${CLIENT_SCRIPT_URL}")
  .then(() => {
    window.__RX_INSPECTOR_RUN__({
      url: "${CLIENT_SCRIPT_URL}#${fakeTokenStr}",
      playerClass: <RX_PLAYER_CLASS>,
    });
    console.info("Inspector initialized with success!");
  })
  .catch((error) =>
    console.error("Failed to dynamically import inspector:", error)
  );`;
  const dynamicImportCode2 = `fetch("${CLIENT_SCRIPT_URL}")
  .then((res) => res.text())
  .then((code) => {
    Function(code)();
    window.__RX_INSPECTOR_RUN__({
      url: "${CLIENT_SCRIPT_URL}#${fakeTokenStr}",
      playerClass: <RX_PLAYER_CLASS>,
    });
    console.info("Inspector initialized with success!");
  })
  .catch((error) =>
    console.error("Failed to dynamically import inspector:", error)
  );`;
  const liElt3 = strHtml`<li>
    Import dynamically the script in your code by writing something like:
    <details class="code-details">
      <summary>code</summary>
      <pre>${dynamicImportCode1}</pre>
      Where <span class="emphasized">${"<RX_PLAYER_CLASS>"}</span>
      is a reference to the RxPlayer's class in your code.
      <br>
      <br>
      Alternatively, if that does not work because dynamic import is not
      supported by your building process or by the device, you may be able
      to rely on dynamic function creation instead:
      <pre>${dynamicImportCode2}</pre>
      Likewise don't forget to replace
      <span class="emphasized">${"<RX_PLAYER_CLASS>"}</span>
      by a reference to the RxPlayer's class in your code.
    </details>
  </li>`;

  const noTokenStr =
    password === null ? "!notoken" : "!notoken/<SERVER_PASSWORD>";
  const res = strHtml`<div class="no-token-tutorial">
    <span class="emphasized">
      If you want to start logging without running the inspector:
    </span>
    <br>
    <span>
      You can now also start debugging on the device without
      having to create a token first, by replacing on the client script
      the token by
    </span>
    <span class="emphasized">${noTokenStr}</span><span>.</span>;
    <br>
    <br>
    <span>
      This can be done in any of the following way:
    </span>
    <ul>${[liElt1, liElt2, liElt3]}</ul>
  </div>`;
  return res;
}

/**
 * Function to call when the WebSocket maintained to update the list of current
 * tokens receives a message.
 * @param {Array.<Object>} activeTokensList
 * @param {HTMLElement} activeTokensListElt - The HTMLElement which will be
 * updated to the list of available tokens regularly.
 * @param {string|null} password - The current server password. `null` if the
 * server has no password.
 */
function onActiveTokenListUpdate(
  activeTokensList: Array<{ date: number; tokenId: string }>,
  activeTokensListElt: HTMLElement,
  password: string | null,
): void {
  if (activeTokensList.length === 0) {
    activeTokensListElt.innerHTML = "No active token";
  } else {
    activeTokensList.sort((a, b) => b.date - a.date);
    const activeTokenDataElt: HTMLElement = activeTokensList.reduce(
      (acc, d) => {
        const date = new Date(d.date);
        const dateStr =
          date.toLocaleDateString() + " @ " + date.toLocaleTimeString();
        const linkElt = strHtml`<a href=${reGeneratePageUrl(
          password,
          d.tokenId,
        )}>`;
        linkElt.appendChild(strHtml`<span>${dateStr}</span>`);
        linkElt.appendChild(document.createTextNode(" - "));
        linkElt.appendChild(strHtml`<span>${d.tokenId}</span>`);
        const listElt = strHtml`<li class="button-input-right">${linkElt}</li>`;
        acc.appendChild(listElt);
        return acc;
      },
      strHtml`<ul class="active-token-list" />`,
    );
    activeTokensListElt.innerHTML = "";
    activeTokensListElt.appendChild(activeTokenDataElt);
  }
}

interface ParsedTokenListServerMessage {
  isNoTokenEnabled: boolean;
  tokenList: Array<{
    date: number;
    tokenId: string;
  }>;
}
