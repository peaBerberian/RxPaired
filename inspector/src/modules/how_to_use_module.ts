import { CLIENT_SCRIPT_URL } from "../constants";
import { createCompositeElement, createElement } from "../dom-utils";

export default function HowToUseModule(
  { tokenId } : { tokenId? : string | undefined }
) {
  if (tokenId === undefined) {
    console.error("Cannot initialize HowToUseModule: no token");
    return null;
  }
  const noteInspectorBeforeClient = [
    createElement("span", { className: "emphasized", textContent: "IMPORTANT" }),
    ": You should always first start the inspector with a given token ",
    createElement("span", { className: "emphasized", textContent: "BEFORE" }),
    " starting the device with that same token. Otherwise, the server might " +
      "decide to not accept the device's connection (as that token was not yet created).",
  ];
  const noteSendInstruction = [
    createElement("span", { className: "emphasized", textContent: "NOTE" }),
    ": You can send JavaScript commands to be executed on the device by passing " +
    "the corresponding code as a string to the ",
    createElement("span", { className: "emphasized", textContent: "sendInstruction" }),
    " function defined globally (open the inspector's JavaScript console of the " +
    "current page to call it).",
    createElement("br"),
    "To get a result in the console, you can use `return` as if returning from a " +
    "Function",
  ];
  if (CLIENT_SCRIPT_URL === "") {
    const howToBodyElt = createCompositeElement("div", [
      "To start debugging, you have to add manually the content of the RxPaired's" +
      " Client script to the beginning of the first script tag of your page " +
      " and manually set the `",
      createElement("span", { className: "emphasized", textContent: "__TOKEN__" }),
      "` variable on top of that script to ",
      createElement("span", { className: "emphasized", textContent: `"${tokenId}"` }),
      ".",
      createElement("br"),
      createElement("br"),
      ...noteInspectorBeforeClient,
      createElement("br"),
      createElement("br"),
      ...noteSendInstruction,
    ]);
    return { body: howToBodyElt };
  }

  const liElt1 = createCompositeElement("li", [
    "Load in your HTML page the following script before all other running scripts: \"",
    createElement("span", {
      textContent: `${CLIENT_SCRIPT_URL}#${tokenId}`,
      className: "emphasized",
    }),
    "\"",
    createElement("br"),
    "For example, you can just add before the first script tag: ",
    createElement("span", {
      textContent: `<script src="${
        CLIENT_SCRIPT_URL.replace(/"/g, "\\\"")
      }#${tokenId}"></script>`,
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
    createElement("span", { className: "emphasized", textContent: "__TOKEN__" }),
    "` variable on top of that script to ",
    createElement("span", { className: "emphasized", textContent: `"${tokenId}"` }),
    ".",
  ]);

  const liElt3 = createCompositeElement("li", [
    "Import dynamically the script in your code by writing something like:",
    createCompositeElement("details", [
      createElement("summary", {
        textContent: "code",
      }),
      createElement("pre", {
        textContent: `import("${CLIENT_SCRIPT_URL}#${tokenId}")
  .then(() => {
    try {
      window.__RX_INSPECTOR_RUN__({
        url: "${CLIENT_SCRIPT_URL}#${tokenId}",
        playerClass: <RX_PLAYER_CLASS>,
      });
      console.info("Inspector initialized with success:", inspectorUrl);
    } catch (error) {
      console.error("Failed to initialize inspector:", error);
    }
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
    ]),
  ]);

  const howToBodyElt = createCompositeElement("div", [
    "To start debugging you can either:",
    createElement("br"),
    createCompositeElement("ul", [
      liElt1,
      liElt2,
      liElt3,
    ]),
    createElement("br"),
    ...noteInspectorBeforeClient,
    createElement("br"),
    createElement("br"),
    ...noteSendInstruction,
  ]);

  return { body: howToBodyElt };
}
