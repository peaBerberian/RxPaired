import strHtml from "str-html";
import { CLIENT_SCRIPT_URL } from "../constants";

export default function HowToUseModule({
  tokenId,
}: {
  tokenId?: string | undefined;
}) {
  if (tokenId === undefined) {
    console.error("Cannot initialize HowToUseModule: no token");
    return null;
  }
  const noteInspectorBeforeClient = strHtml`<span>
    <span class="emphasized">IMPORTANT</span>:
    You should always first start this inspector page with the wanted token
    <span class="emphasized">BEFORE</span>
    starting the device with that same token. Otherwise, the server will
    refuse the device's connection.
  </span>`;
  const noteSendInstruction = strHtml`<span>
    You can also send JavaScript commands which will be run on the device by
    providing the corresponding code as a string argument to the
    <span class="emphasized">sendInstruction</span>
    function defined globally on this page (open the inspector's JavaScript console
    of the current page to call it).
    Moreover, to get a result in the console, you can use \`return\` as if returning
    from a function:
    <details class="code-details">
      <summary>code examples</summary>
      <pre>${`// example to obtain the device's user-agent in this page's console:
sendInstruction(\`return navigator.userAgent\`)

// You may also log it, in which way you'll see it in the inspector's logs
sendInstruction(\`console.warn("USER-AGENT:", navigator.userAgent)\`)

// Note that by using backticks (\`) to enclose your code, it can span
// multiple lines. This is useful for complex code.`}</pre>
    </details>
  </span>`;

  const moduleLayoutTutorialElt = strHtml`<div>
    ${`You can move the "modules" around through the buttons
       located on their top right (hover it for a description).
       When taking "half-width", they are put in
       from left to right first, then from top to bottom.
       To reset the layout, click on the "clear page config" button on the top
       right of this page.`}
  </div>`;
  if (CLIENT_SCRIPT_URL === "") {
    const howToBodyElt = strHtml`<div>
      ${`To start debugging, you have to add manually the content of the RxPaired's
         Client script to the beginning of the first script tag of your page
         and manually set the`}
      <span class="emphasized">__TOKEN__</span>
      ${"` variable on top of that script to "}
      <span class="emphasized">"${tokenId}"</span>.
      <br>
      <br>
      ${noteInspectorBeforeClient}
      <br>
      <br>
      ${noteSendInstruction}
      <br>
      ${moduleLayoutTutorialElt}
    </div>`;
    return { body: howToBodyElt };
  }

  const liElt1 = strHtml`<li>
    Load in your HTML page the following script before all other running scripts:
    "<span class="emphasized">${CLIENT_SCRIPT_URL}#${tokenId}</span>"
    <br>
    For example, you can just add before the first script tag:
    <span class="emphasized">
      ${`<script src="${CLIENT_SCRIPT_URL.replace(
        /"/g,
        '\\"',
      )}#${tokenId}"></script>`}
    </span>
  </li>`;

  const liElt2 = strHtml`<li>
    Add manually the content of this script to the beginning of the
    first script tag of your page:
    <a href=${CLIENT_SCRIPT_URL}>${CLIENT_SCRIPT_URL}</a>
    and manually set the
    \`<span class="emphasized">__TOKEN__</span>\`
    variable on top of that script to
    <span class="emphasized">"${tokenId}"</span>.
  </li>`;

  const dynamicImportCode1 = `import("${CLIENT_SCRIPT_URL}")
  .then(() => {
    window.__RX_INSPECTOR_RUN__({
      url: "${CLIENT_SCRIPT_URL}#${tokenId}",
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
      url: "${CLIENT_SCRIPT_URL}#${tokenId}",
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

  const howToBodyElt = strHtml`<div>
    To start debugging you can either:
    <br>
    <ul>${[liElt1, liElt2, liElt3]}</ul>
    <br>
    ${noteInspectorBeforeClient}
    <br>
    <br>
    ${noteSendInstruction}
    <br>
    ${moduleLayoutTutorialElt}
  </div>`;

  return { body: howToBodyElt };
}
