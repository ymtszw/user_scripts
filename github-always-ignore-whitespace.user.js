// ==UserScript==
// @name         Always ignore whitespace in GitHub Pull Request diffs
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @version      1.20240206.8
// @description  Always ignore whitespace in GitHub Pull Request diffs
// @author       Gada / ymtszw
// @copyright    2023, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/github-always-ignore-whitespace.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/github-always-ignore-whitespace.user.js

// @noframes     true
// @run-at       document-start
// @match        https://github.com/*/*/pull*
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
  // GitHubは要所要所でTurbolinksを使っていて、リンククリック時の挙動がclient-side routingでもなければ通常のページ遷移でもないことがある
  // Files viewへのリンクはその一つなので、popstateやhashchangeイベントで検知できない
  // そこでclickイベントを直接監視し、files viewへのリンククリックだったらリダイレクトするようなハンドラを大域追加する
  console.log("Inject click event handler for turbolinks.");
  window.addEventListener("click", (e) => {
    if (e.target?.href?.match(filesViewRegex)) {
      console.log("Navigating to files view. Intercepting...");
      checkUrlAndRedirect(new URL(e.target.href));
    }
  });

  if (window.location.href.match(filesViewRegex)) {
    // Files viewのURLを直接開いた場合には即座にオプションをチェックする
    checkUrlAndRedirect();
  }
})();
