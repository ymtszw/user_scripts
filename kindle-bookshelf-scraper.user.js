// ==UserScript==
// @name         Kindle Bookshelf Scraper
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp
// @version      1.20250220.1
// @description  Load book metadata from your kindle content list.
// @author       Gada / ymtszw
// @copyright    2023, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/kindle-bookshelf-scraper.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/kindle-bookshelf-scraper.user.js

// @noframes     true
// @run-at       document-idle
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
        log("API_KEY is not registered. The end result will be copied to the clipboard.");
      }
    } else {
      log("INDEX_NAME is not registered. The end result will be copied to the clipboard.");
    }
  } else {
    log("APP_ID is not registered. The end result will be copied to the clipboard.");
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

// スクレイピングセッション開始前であれば、最新のデータをAlgoliaから読み込んでlocalStorageを初期化
if (!IN_SESSION && APP_ID && INDEX_NAME && API_KEY) {
  const saved = await loadSavedResultFromAlgolia();
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saved));
  log(`Loaded ${Object.keys(saved).length} books from Algolia`);
  GM_notification({
    title: "Kindle Bookshelf Scraper",
    text: `Loaded ${Object.keys(saved).length} books from Algolia`,
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
 * @returns {{[id: string]: { id: string, objectID: string, title: string, authors: string[], img: string, acquiredDate: string }}}
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
    const book = { id, objectID: id, title, authors, img, acquiredDate };
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
  const saved = await loadSavedResultFromAlgolia();
  const savedCount = Object.keys(saved).length;
  log("saved books", savedCount);
  if (resultCount !== savedCount) {
    if (APP_ID && INDEX_NAME && API_KEY) {
      // 新しく発見されたbookのみをAlgoliaに追加
      const newBooks = Object.entries(result).filter(([id, book]) => !saved[id]);
      log("new books", newBooks.length);
      const batchAddObjectBody = {
        requests: newBooks.map(([id, book]) => ({
          action: "addObject",
          body: book,
        })),
      };

      const batchAddObjectUrl = `https://${APP_ID}-dsn.algolia.net/1/indexes/${INDEX_NAME}/batch`;
      await fetch(batchAddObjectUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Algolia-API-Key": API_KEY,
          "X-Algolia-Application-Id": APP_ID,
        },
        body: JSON.stringify(batchAddObjectBody),
      });

      log("Successfully added objects to Algolia.");
    }

    saveResultToClipboard(result);
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
 * Loads current books from Algolia.
 * @returns {Promise<{[id: string]: { id: string, title: string ... }}>}
 */
async function loadSavedResultFromAlgolia() {
  let cursor;
  let page = 0;
  const loaded = {};
  const browseApiUrl = `https://${APP_ID}-dsn.algolia.net/1/indexes/${INDEX_NAME}/browse`;

  do {
    const browseReqBody = {
      cursor: cursor,
      page: page,
      hitsPerPage: 1000,
      attributesToRetrieve: ["*"],
    };

    const res = await fetch(browseApiUrl, {
      method: "POST",
      headers: {
        "X-Algolia-API-Key": API_KEY,
        "X-Algolia-Application-Id": APP_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(browseReqBody),
    });

    const data = await res.json();

    for (const hit of data.hits) {
      loaded[hit.objectID] = hit;
    }

    page++;
    // 次のページが未だある場合cursorに具体値が入っている。ない場合は終了する
    cursor = data.cursor;
  } while (cursor);

  return loaded;
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
