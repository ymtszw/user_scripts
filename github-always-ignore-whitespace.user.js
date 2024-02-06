// ==UserScript==
// @name         Always ignore whitespace in GitHub Pull Request diffs
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @version      1.20240206.4
// @description  Always ignore whitespace in GitHub Pull Request diffs
// @author       Gada / ymtszw
// @copyright    2023, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/github-always-ignore-whitespace.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/github-always-ignore-whitespace.user.js

// @noframes     true
// @run-at       document-start
// @match        https://github.com/*/*/pull/*/files*
// @grant        none
// ==/UserScript==

function checkUrlAndRedirect(urlLike = window.location) {
  const q = new URLSearchParams(urlLike.search);

  if (!q.has("w")) {
    console.log("Ignoring whitespace...");
    const newUrl = new URL(urlLike);
    newUrl.searchParams.set("w", "1");
    window.location.assign(newUrl.toString());
  } else {
    console.log("Already ignoring whitespace");
  }
}
const filesViewRegex = new RegExp("https://github.com/.+/.+/pull/.+/files");

(function () {
  "use strict";
  checkUrlAndRedirect();

  window.addEventListener("click", (e) => {
    if (e.target?.href?.match(filesViewRegex)) {
      console.log("Navigating to files view. Intercepting...");
      checkUrlAndRedirect(new URL(e.target.href));
    }
  });
})();
