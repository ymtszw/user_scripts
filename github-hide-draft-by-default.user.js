// ==UserScript==
// @name         Hide draft PR from my sight by default
// @description  Hide draft PR from my sight by default
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @version      1.20240307.1
// @author       Gada / ymtszw
// @copyright    2024, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/github-hide-draft-by-default.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/github-hide-draft-by-default.user.js

// @noframes     true
// @run-at       document-start
// @match        https://github.com/*
// @grant        none
// ==/UserScript==

function checkUrlAndApplyDefaultFilter(urlLike = window.location) {
  const q = new URLSearchParams(urlLike.search);

  if (!q.has("q")) {
    console.log("Hiding draft PRs...");
    const newUrl = new URL(urlLike);
    newUrl.searchParams.set("q", "is:pr is:open draft:false");
    window.location.assign(newUrl.toString());
  } else {
    console.log("Respect existing query. Skipping.");
  }
}
const filesViewRegex = new RegExp("https://github.com/.+/.+/pulls");

(function () {
  "use strict";
  // GitHubは要所要所でTurbolinksを使っていて、リンククリック時の挙動がclient-side routingでもなければ通常のページ遷移でもないことがある
  // そこでclickイベントを直接監視し、PR listへのリンククリックだったらリダイレクトするようなハンドラを大域追加する
  console.log("Inject click event handler for turbolinks.");
  window.addEventListener("click", (e) => {
    if (e.target?.href?.match(filesViewRegex)) {
      console.log("Apply default filter to PR list. Intercepting...");
      checkUrlAndApplyDefaultFilter(new URL(e.target.href));
    }
  });

  if (window.location.href.match(filesViewRegex)) {
    // PR listのURLを直接開いた場合には即座にオプションをチェックする
    checkUrlAndApplyDefaultFilter();
  }
})();
