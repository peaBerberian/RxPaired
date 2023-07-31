import { SERVER_URL } from "../constants";
import {
  createButton,
  createCompositeElement,
  createElement,
  createLinkElement,
} from "../dom-utils";
import { checkTokenValidity, reGeneratePageUrl } from "../utils";

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
    {
      className: "header-item page-title",
      style: { fontFamily: "monospace" },
    }
  );

  const generateInstrElt = createElement("span", {
    textContent: "Generate a token:",
    style: {
      fontWeight: "bold",
      marginRight: "8px",
    },
  });

  const inputInstrElt = createCompositeElement(
    "span",
    [
      createElement("span", { className: "emphasized", textContent: "OR" }),
      createElement("span", {
        textContent: " enter the wanted token:",
      }),
    ],
    {
      style: {
        fontWeight: "bold",
        marginRight: "8px",
      },
    }
  );

  const currentListTitleElt = createElement("div", {
    textContent: "List of currently active tokens",
    style: {
      fontSize: "1.1em",
      fontWeight: "bold",
    },
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
        currentListElt,
      ],
      {
        style: {
          margin: "10px",
          border: "1px dotted black",
          padding: "10px",
          position: "absolute",
          width: "auto",
        },
      }
    ),
  ]);

  document.body.appendChild(pageBody);

  // Refresh list of tokens
  const wsUrl =
    password === null
      ? `${SERVER_URL}/!list`
      : `${SERVER_URL}/${password}/!list`;
  const socket = new WebSocket(wsUrl);
  socket.onmessage = function (evt) {
    onListWebSocketMessage(evt, activeTokensListElt, password);
  };
  socket.onclose = function () {
    activeTokensListElt.innerHTML = "Error: WebSocket connection closed";
  };

  return () => {
    socket.close();
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
  checkTokenValidity(tokenValue);
  window.location.href = reGeneratePageUrl(password, tokenValue);
}

/**
 * Generate token used to identify a single log session.
 * @returns {string}
 */
function generateToken(): string {
  return Math.random().toString(36).substring(2, 8); // remove `0.`
}

/**
 * Function to call when the WebSocket maintained to update the list of current
 * tokens receives a message.
 * @param {Object} evt - The message received.
 * @param {HTMLElement} activeTokensListElt - The HTMLElement which will be
 * updated to the list of available tokens regularly.
 * @param {string|null} password - The current server password. `null` if the
 * server has no password.
 */
function onListWebSocketMessage(
  evt: MessageEvent,
  activeTokensListElt: HTMLElement,
  password: string | null
): void {
  let data;
  if (Array.isArray(evt.data)) {
    data = evt.data as unknown as Array<{
      date: number;
      tokenId: string;
    }>;
  } else if (typeof evt.data === "string") {
    data = JSON.parse(evt.data) as unknown as Array<{
      date: number;
      tokenId: string;
    }>;
  } else {
    console.error("Unrecognized list data");
    return;
  }

  if (data.length === 0) {
    activeTokensListElt.innerHTML = "No active token";
  } else {
    data.sort((a, b) => b.date - a.date);
    const activeTokenDataElt: HTMLElement = data.reduce((acc, d) => {
      const date = new Date(d.date);
      const listElt = createCompositeElement(
        "li",
        [
          createElement("span", {
            textContent:
              date.toLocaleDateString() + " @ " + date.toLocaleTimeString(),
          }),
          " ",
          createElement("span", {
            textContent: d.tokenId,
          }),
        ],
        {
          onClick: () => setToken(password, d.tokenId),
          style: {
            cursor: "pointer",
            marginBottom: "5px",
            textDecoration: "underline",
          },
        }
      );
      acc.appendChild(listElt);
      return acc;
    }, createElement("ul", {}));
    activeTokensListElt.innerHTML = "";
    activeTokensListElt.appendChild(activeTokenDataElt);
  }
}
