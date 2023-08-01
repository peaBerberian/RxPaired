import { CLIENT_SCRIPT_URL, SERVER_URL } from "../constants";
import {
  createButton,
  createCompositeElement,
  createElement,
  createLinkElement,
} from "../dom-utils";
import { displayError, isTokenValid, reGeneratePageUrl } from "../utils";

/**
 * Generate the HTML page asking for the wanted token.
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 * @returns {Function} - Perform clean-up if the page is exited.
 */
export default function generateTokenPage(password: string | null): () => void {
  const pageTitle = createCompositeElement(
    "div",
    [
      createLinkElement({
        textContent: "Home",
        href: reGeneratePageUrl(undefined, undefined),
      }),
      " > Token",
    ],
    { className: "header-item page-title" }
  );

  const generateInstrElt = createElement("div", {
    textContent: "Generate a token:",
    className: "input-title",
  });

  const inputInstrElt = createCompositeElement(
    "div",
    [
      createElement("span", { className: "emphasized", textContent: "OR" }),
      createElement("span", {
        textContent: " enter the wanted token:",
      }),
    ],
    {
      className: "input-title",
    }
  );

  const postDebuggingElt = createCompositeElement(
    "div",
    [
      createElement("span", { className: "emphasized", textContent: "OR" }),
      createElement("span", {
        textContent: " import an already-generated log file (Post-Debugger page):",
      }),
    ],
    {
      className: "input-title",
    }
  );

  const currentListTitleElt = createElement("div", {
    textContent: "List of currently active tokens:",
    className: "active-tokens-title",
  });
  const activeTokensListElt = createElement("pre", {
    className: "active-tokens-list",
    textContent: "Loading...",
  });
  const currentListElt = createCompositeElement("div", [
    currentListTitleElt,
    activeTokensListElt,
  ]);

  const pageBody = createCompositeElement("div", [
    createCompositeElement("div", [pageTitle], {
      className: "header",
    }),
    createCompositeElement(
      "div",
      [
        createCompositeElement("div", [
          generateInstrElt,
          createGenerateTokenButton(password),
        ]),
        createElement("br"),
        createCompositeElement("div", [
          inputInstrElt,
          createTokenInputElement(password),
        ]),
        createElement("br"),
        createCompositeElement("div", [
          postDebuggingElt,
          createButton({
            textContent: "Go to Post-Debugger page",
            onClick() {
              window.location.href = reGeneratePageUrl(password, undefined, true);
            },
          }),
        ]),
        createElement("br"),
        currentListElt,
      ],
      { className: "page-input-block" }
    ),
  ]);

  document.body.appendChild(pageBody);

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
      pageBody.appendChild(createNoTokenTutorialElement(password));
      hasAddedNoTokenTutorial = true;
    }
  };
  socket.onclose = function onWebSocketClose() {
    activeTokensListElt.innerHTML = "Error: WebSocket connection closed";
  };

  return () => {
    socket.onclose = null;
    socket.close();
    document.body.removeChild(pageBody);
  };
}

/**
 * Returns an HTML element corresponding to token generation.
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 * @returns {HTMLElement}
 */
function createGenerateTokenButton(password: string | null): HTMLButtonElement {
  return createButton({
    className: "btn-generate-token",
    textContent: "Generate Token",
    onClick() {
      const tokenId = generateToken();
      setToken(password, tokenId);
    },
  });
}

/**
 * @param {string|null} password - The password currently used for server
 * interaction. `null` for no password.
 * @returns {HTMLElement}
 */
function createTokenInputElement(password: string | null): HTMLElement {
  const tokenInputElt = createElement("input");
  tokenInputElt.placeholder = "Enter the wanted token";
  tokenInputElt.onkeyup = function (evt) {
    if (evt.key === "Enter" || evt.keyCode === 13) {
      setToken(password, tokenInputElt.value);
    }
  };
  const tokenSendElt = createButton({
    textContent: "Set token",
    onClick: () => setToken(password, tokenInputElt.value),
  });
  tokenSendElt.style.marginLeft = "5px";
  return createCompositeElement("span", [tokenInputElt, tokenSendElt]);
}

function setToken(password: string | null, tokenValue: string): void {
  if (!isTokenValid(tokenValue)) {
    const error = new Error(
      "Error: A token must only contain alphanumeric characters"
    );
    displayError(error);
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
  const liElt1 = createCompositeElement("li", [
    'Load in your HTML page the following script before all other running scripts: "',
    createElement("span", {
      textContent: `${CLIENT_SCRIPT_URL}#${fakeTokenStr}`,
      className: "emphasized",
    }),
    '"',
    createElement("br"),
    "For example, you can just add before the first script tag: ",
    createElement("span", {
      textContent: `<script src="${CLIENT_SCRIPT_URL.replace(
        /"/g,
        '\\"'
      )}#${fakeTokenStr}"></script>`,
      className: "emphasized",
    }),
  ]);

  const link = createElement("a", { textContent: CLIENT_SCRIPT_URL });
  link.href = CLIENT_SCRIPT_URL;
  const liElt2 = createCompositeElement("li", [
    "Add manually the content of this script to the beginning of the " +
      "first script tag of your page: ",
    link,
    " and manually set the `",
    createElement("span", {
      className: "emphasized",
      textContent: "__TOKEN__",
    }),
    "` variable on top of that script to ",
    createElement("span", {
      className: "emphasized",
      textContent: `"${fakeTokenStr}"`,
    }),
    ".",
  ]);

  const liElt3 = createCompositeElement("li", [
    "Import dynamically the script in your code by writing something like:",
    createCompositeElement(
      "details",
      [
        createElement("summary", {
          textContent: "code",
        }),
        createElement("pre", {
          textContent: `import("${CLIENT_SCRIPT_URL}")
  .then(() => {
    window.__RX_INSPECTOR_RUN__({
      url: "${CLIENT_SCRIPT_URL}#${fakeTokenStr}",
      playerClass: <RX_PLAYER_CLASS>,
    });
    console.info("Inspector initialized with success!");
  })
  .catch((error) =>
    console.error("Failed to dynamically import inspector:", error)
  );`,
        }),
        "Where ",
        createElement("span", {
          className: "emphasized",
          textContent: "<RX_PLAYER_CLASS>",
        }),
        " is a reference to the RxPlayer's class in your code",
      ],
      { className: "code-details" }
    ),
  ]);
  return createCompositeElement(
    "div",
    [
      createElement("span", {
        className: "emphasized",
        textContent:
          "If you want to start logging without running the inspector:",
      }),
      createElement("br"),
      createElement("span", {
        textContent:
          " You can now also start debugging on the device without " +
          "having to create a token first, by replacing on the client script " +
          "the token by ",
      }),
      createElement("span", {
        className: "emphasized",
        textContent:
          password === null ? "!notoken" : "!notoken/<SERVER_PASSWORD>",
      }),
      createElement("span", {
        textContent: ".",
      }),
      createElement("br"),
      createElement("br"),
      createElement("span", {
        textContent: "This can be done in any of the following way:",
      }),
      createCompositeElement("ul", [liElt1, liElt2, liElt3]),
    ],
    {
      className: "no-token-tutorial",
    }
  );
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
  password: string | null
): void {
  if (activeTokensList.length === 0) {
    activeTokensListElt.innerHTML = "No active token";
  } else {
    activeTokensList.sort((a, b) => b.date - a.date);
    const activeTokenDataElt: HTMLElement = activeTokensList.reduce(
      (acc, d) => {
        const date = new Date(d.date);

        const link = createLinkElement({
          href: reGeneratePageUrl(password, d.tokenId),
        });
        link.appendChild(
          createElement("span", {
            textContent:
              date.toLocaleDateString() + " @ " + date.toLocaleTimeString(),
          })
        );
        link.appendChild(document.createTextNode(" - "));
        link.appendChild(
          createElement("span", {
            textContent: d.tokenId,
          })
        );
        const listElt = createCompositeElement("li", [link], {
          className: "button-input-right",
        });
        acc.appendChild(listElt);
        return acc;
      },
      createElement("ul", {
        className: "active-token-list",
      })
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
