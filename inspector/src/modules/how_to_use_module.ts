import { CLIENT_SCRIPT_URL } from "../constants";
import { createCompositeElement, createElement } from "../dom-utils";

export default function HowToUseModule(
  { tokenId } : { tokenId : string }
) {
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

  const link = createElement("a", { textContent: CLIENT_SCRIPT_URL }) as HTMLLinkElement;
  link.href = CLIENT_SCRIPT_URL;
  const liElt2 = createCompositeElement("li", [
    "Add manually the content of this script to the beginning of the " +
    "first script tag of your page: ",
    link,
    " and manually set the `",
    createElement("span", { className: "emphasized", textContent: "__TOKEN__" }),
    "` constant on top of that script to ",
    createElement("span", { className: "emphasized", textContent: `"${tokenId}"` }),
    ".",
  ]);


  const howToBodyElt = createCompositeElement("div", [
    "To start debugging you can either:",
    createElement("br"),
    createCompositeElement("ul", [
      createElement("br"),
      liElt1,
      createElement("br"),
      liElt2,
    ]),
  ]);

  return {
    body: howToBodyElt,
  };
}
