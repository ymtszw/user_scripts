// ==UserScript==
// @name         Kindle Bookshelf Scraper
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp
// @version      1.20250212.1
// @description  Load book metadata from your kindle content list.
// @author       Gada / ymtszw
// @copyright    2023, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/kindle-bookshelf-scraper.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/kindle-bookshelf-scraper.user.js

// @noframes     true
// @run-at       context-menu
// @match        https://www.amazon.co.jp/hz/mycd/digital-console/contentlist/booksAll/dateDsc/*
// @grant        GM_notification
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// ==/UserScript==

// Note: Top-level awaitを使用するため、このスクリプトはIIFEでラップされていない。
// Top-level awaitに対応したブラウザでないと動作しない。

// Tampermonkey UIでストレージタブを出現させるため、固定値をセットする。
GM_setValue("STORAGE_INITIALIZED", true);

/**
 * ページをまたいでスクレイピング結果を保持するためのlocalStorageキー
 * @type {string}
 */
const LOCAL_STORAGE_KEY = "___books___";

/**
 * スクレイピングセッション進行中かどうかの状態
 * @type {boolean}
 */
const IN_SESSION = GM_getValue("IN_SESSION", false);

/**
 * DB全体を初期構築したい場合にはコンテンツ一覧のページ数以上の値を設定し、逆にデバッグ時にはこの値を減らす。
 *
 * 基本的には定期的に実施する前提で、少なめの値を設定するとよい。
 * Tampermonkey UIでスクリプトを選択し、ストレージタブから設定できる。
 * @type {number}
 */
const NAVIGATION_LIMIT = GM_getValue("NAVIGATION_LIMIT", 5);

/**
 * スクレイピング結果であるbooks.jsonを保存するGist ID
 * @type {string | null}
 */
let GIST_ID = GM_getValue("GIST_ID", null);
/**
 * `GIST_ID`にbooks.jsonを保存する際に`Authorization`ヘッダに設定する値(Personal Access Token)
 * @type {string}
 */
let AUTHORIZATION = GM_getValue("AUTHORIZATION", "");
if (GIST_ID) {
  log("Results will be put into:", GIST_ID);
} else if (!IN_SESSION) {
  // スクレイピングセッション進行中でない場合、window.prompt()を使って設定情報の初期化を試みる
  GIST_ID = window.prompt(`Register a GitHub Gist ID for storing scraped books.json`);
  if (GIST_ID) {
    GM_setValue("GIST_ID", GIST_ID);
    AUTHORIZATION = window.prompt("Optional: Register an Authorization header value for the Gist request", "");
    GM_setValue("AUTHORIZATION", AUTHORIZATION);
  } else {
    log("GIST_ID is not registered. The end result will be copied to the clipboard.");
  }
}

/**
 * `pageNumber`URLパラメータの値。インクリメントして次のページへの遷移に利用する
 * @type {number}
 */
let page = parseInt(new URLSearchParams(document.location.search).get("pageNumber") || "1");

log("waiting...(1s)");
await sleep(1000);

/**
 * ページ遷移1秒後の`pageNumber`URLパラメータの値。
 *
 * この値が`page`と異なる場合、コンテンツ一覧の最終ページに到達したことを示しているので、スクレイピングを終了する。
 * @type {number}
 */
const page_ = parseInt(new URLSearchParams(document.location.search).get("pageNumber") || "1");
if (page !== page_) {
  log("pageNumber truncated to", page_);
  log("HALT!");
  finishScraping();
  return;
}

// スクレイピングセッション開始前であれば、最新のGistのbooks.jsonを読み込んでlocalStorageを初期化
if (!IN_SESSION && GIST_ID) {
  const saved = await loadSavedResultFromGist();
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saved));
  log(`Loaded ${Object.keys(saved).length} books from Gist`);
  GM_notification({
    title: "Kindle Bookshelf Scraper",
    text: `Loaded ${Object.keys(saved).length} books from Gist`,
    silent: true,
    timeout: 2000,
  });
}

// スクレイピングセッション開始（冪等なsetValue）
GM_setValue("IN_SESSION", true);
log("scraping page", page);
GM_notification({
  title: "Kindle Bookshelf Scraper",
  text: `Scraping page ${page}...`,
  silent: true,
  timeout: 3000,
});

log("waiting...(3s)");
await sleep(3000);

const scraped = booksPerPage();

if (Object.keys(scraped).length > 0) {
  const prev = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
  // Note: 保存データの形式を変更した際は、再度全件スクレイピングするためにallKnownを迂回する必要がある
  const allKnown = Object.keys(scraped).every((id) => !!prev[id]);
  if (allKnown || page > NAVIGATION_LIMIT) {
    log("HALT! navigation limit reached");
    finishScraping();
  } else {
    const next = Object.assign(prev, scraped);
    log("total scraped books", Object.keys(next).length);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    const goto = `https://www.amazon.co.jp/hz/mycd/digital-console/contentlist/booksAll/dateDsc/?pageNumber=${++page}`;
    log("waiting...(1s)");
    await sleep(1000);
    log("go to next page", goto);
    window.location.assign(goto);
  }
} else {
  log("no books. HALT!");
}

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
 * 現在のKindleコンテンツ一覧ページをスクレイピングし、ページ内の書籍一覧を辞書Objectで返す。
 * @returns {{[id: string]: { id: string, title: string, authors: string[], img: string, acquiredDate: string }}}
 */
function booksPerPage() {
  let page = {};

  const rows = document.querySelectorAll("#CONTENT_LIST > table > tbody > tr");

  rows.forEach((row) => {
    const img = row.querySelector("td > div > div:nth-child(2) > img").src;
    const metadata = row.querySelector("td > div > div:nth-child(3)");
    const title = metadata.querySelector("div[id^=content-title]").innerText;
    const id = metadata.querySelector("div[id^=content-title]").id.split("-")[2];
    const authors = metadata.querySelector("div[id^=content-author]").innerText.split(", ");
    const acquiredDate = metadata.querySelector("div[id^=content-acquired-date]").lastChild.textContent;
    const book = { id, title, authors, img, acquiredDate };
    page[id] = book;
  });

  return page;
}

async function finishScraping() {
  GM_setValue("IN_SESSION", false);
  const json = window.localStorage.getItem(LOCAL_STORAGE_KEY) || "{}";
  const result = JSON.parse(json);
  const resultCount = Object.keys(result).length;
  log("result books", resultCount);
  const saved = await loadSavedResultFromGist();
  const savedCount = Object.keys(saved).length;
  log("saved books", savedCount);
  if (resultCount !== savedCount) {
    log("books updated");
    if (GIST_ID) {
      await saveResultToGist(result);
      triggerIndexBuild();
    } else {
      saveResultToClipboard(result);
    }
  } else {
    log("books not updated");
    GM_notification({
      title: "Kindle Bookshelf Scraper",
      text: "books not updated",
      silent: true,
      timeout: 2000,
    });
  }
}

/**
 * Loads current books.json from Gist.
 * @returns {Promise<{[id: string]: { id: string, title: string, authors: string[], img: string, acquiredDate: string }}>}
 */
async function loadSavedResultFromGist() {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: AUTHORIZATION,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers,
  });
  const body = await res.json();
  const rawUrl = body.files["books.json"].raw_url;
  const res2 = await fetch(rawUrl);
  return res2.json();
}

async function saveResultToGist(result) {
  const headers = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    Authorization: AUTHORIZATION,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: headers,
    body: JSON.stringify({
      files: {
        "books.json": { content: JSON.stringify(result, undefined, 2) },
      },
    }),
  })
    .catch(handleSaveError)
    .then((res) => {
      if (res.status !== 200) {
        handleSaveError(res);
      } else {
        log(`${Object.keys(result).length} books scraped and saved to "GIST_ID"`);
        GM_notification({
          title: "Kindle Bookshelf Scraper",
          text: `${Object.keys(result).length} books scraped and saved to "GIST_ID".\nClick me to open Gist revisions.\nAlso you may find "${LOCAL_STORAGE_KEY}" entry in localStorage.`,
          silent: true,
          timeout: 3000,
          onclick: () => {
            GM_openInTab(`https://gist.github.com/${GIST_ID}/revisions`, {
              active: true,
            });
          },
        });
      }
    });
}

function handleSaveError(err) {
  log("Save error:", err);
  GM_notification({
    title: "Kindle Bookshelf Scraper",
    text: `Error on saving books.json!\nCheck out console logs.\nYou may find "${LOCAL_STORAGE_KEY}" entry in localStorage.`,
    silent: false,
    timeout: 5000,
    highlight: true,
  });
}

async function triggerIndexBuild() {
  const headers = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    Authorization: AUTHORIZATION,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  await fetch(`https://api.github.com/repos/ymtszw/ymtszw.github.io/dispatches`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({ event_type: "index-kindle-books" }),
  });
}

function saveResultToClipboard(result) {
  GM_setClipboard(JSON.stringify(result, undefined, 2), "text");
  GM_notification({
    title: "Kindle Bookshelf Scraper",
    text: `${Object.keys(result).length} books scraped and copied to the clipboard.\nAlso you may find "${LOCAL_STORAGE_KEY}" entry in localStorage.`,
    silent: true,
    timeout: 2000,
  });
}

function log() {
  console.log("[👹KBS]", ...arguments);
}
