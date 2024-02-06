// ==UserScript==
// @name         Always ignore whitespace in GitHub Pull Request diffs
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @version      1.20240206.0
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
  console.log(window.location.search);
})();
