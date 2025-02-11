// ==UserScript==
// @name         F*NZ* Scraper
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.dmm.co.jp
// @version      1.20250211.1
// @description  Load book metadata from your F*NZ* content list.
// @author       Gada / ymtszw
// @copyright    2025, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/fnz-scraper.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/fnz-scraper.user.js

// @noframes     true
// @run-at       context-menu
// @match        https://www.dmm.co.jp/dc/-/mylibrary/
// @grant        GM_notification
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// ==/UserScript==

GM_setValue("STORAGE_INITIALIZED", true);

/**
 * 過去のスクレイピング結果を保持するためのlocalStorageキー
 * @type {string}
 */
const LOCAL_STORAGE_KEY = "___books___";

/**
 * スクレイピングセッション進行中かどうかの状態
 * @type {boolean}
 */
const IN_SESSION = GM_getValue("IN_SESSION", false);

let APP_ID = GM_getValue("APP_ID", null);
let INDEX_NAME = GM_getValue("INDEX_NAME", null);
let API_KEY = GM_getValue("API_KEY", "");
if (APP_ID && INDEX_NAME && API_KEY) {
  log("Results will be put into Algolia index", APP_ID, INDEX_NAME);
} else if (!IN_SESSION) {
  // スクレイピングセッション進行中でない場合、window.prompt()を使って設定情報の初期化を試みる
  APP_ID = window.prompt(`Register a Algolia App ID`);
  if (APP_ID) {
    GM_setValue("APP_ID", APP_ID);
    INDEX_NAME = window.prompt("Register an Algolia index name");
    if (INDEX_NAME) {
      GM_setValue("INDEX_NAME", INDEX_NAME);
      API_KEY = window.prompt("Register an Algolia API key");
      if (API_KEY) {
        GM_setValue("API_KEY", API_KEY);
        log("Results will be put into Algolia index", APP_ID, INDEX_NAME);
      } else {
        log(
          "API_KEY is not registered. The end result will be copied to the clipboard."
        );
      }
    } else {
      log(
        "INDEX_NAME is not registered. The end result will be copied to the clipboard."
      );
    }
  } else {
    log(
      "APP_ID is not registered. The end result will be copied to the clipboard."
    );
  }
}

log("waiting...(1s)");
await sleep(1000);

// スクレイピングセッション開始前であれば、最新のデータをAlgoliaから読み込んでlocalStorageを初期化
if (!IN_SESSION && APP_ID && INDEX_NAME && API_KEY) {
  const saved = await loadSavedResultFromAlgolia();
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saved));
  log(`Loaded ${Object.keys(saved).length} books from Algolia`);
  GM_notification({
    title: "FNZ Scraper",
    text: `Loaded ${Object.keys(saved).length} books from Algolia`,
    silent: true,
    timeout: 2000,
  });
}

// スクレイピングセッション開始（冪等なsetValue）
GM_setValue("IN_SESSION", true);
log("scraping page");
GM_notification({
  title: "FNZ Scraper",
  text: `Scraping ...`,
  silent: true,
  timeout: 3000,
});

log("waiting...(3s)");
await sleep(3000);

/**
 * `await sleep(1000);`のように使用することで、指定したミリ秒だけ手続き的に待機できる。
 * @param {number} t
 */
function sleep(t) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, t, "OK");
  });
}

/**
 * Loads current books from Algolia.
 * @returns {Promise<{[id: string]: { id: string, title: string, authors: string[], img: string, acquiredDate: string }}>}
 */
async function loadSavedResultFromAlgolia() {
  // TODO
  return {};
}

function saveResultToClipboard(result) {
  GM_setClipboard(JSON.stringify(result, undefined, 2), "text");
  GM_notification({
    title: "FNZ Scraper",
    text: `${
      Object.keys(result).length
    } books scraped and copied to the clipboard.\nAlso you may find "${LOCAL_STORAGE_KEY}" entry in localStorage.`,
    silent: true,
    timeout: 2000,
  });
}

function log() {
  console.log("[👹FNZ]", ...arguments);
}
