// ==UserScript==
// @name         Always ignore whitespace in GitHub Pull Request diffs
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @version      1.20240206.1
// @description  Always ignore whitespace in GitHub Pull Request diffs
// @author       Gada / ymtszw
// @copyright    2023, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/github-always-ignore-whitespace.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/github-always-ignore-whitespace.user.js

// @noframes     true
// @run-at       document-idle
// @match        https://github.com/*/*/pull/*/files*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  const q = new URLSearchParams(window.location.search);
  if (!q.has("w")) {
    q.set("w", "1");
    window.location.search = q.toString();
    const newUrl = window.location.href;
    console.log(`Redirecting to ${newUrl}`);
    window.location.assign(newUrl);
  } else {
    console.log("Already ignoring whitespace");
  }
})();