// ==UserScript==
// @name         F*NZ* Scraper
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.dmm.co.jp
// @version      1.20250220.3
// @description  Load book metadata from your F*NZ* content list.
// @author       Gada / ymtszw
// @copyright    2025, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/fnz-scraper.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/fnz-scraper.user.js

// @noframes     true
// @run-at       context-menu
// @match        https://www.dmm.co.jp/dc/-/mylibrary/*
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
        log("API_KEY is not registered. The end result will be copied to the clipboard.");
      }
    } else {
      log("INDEX_NAME is not registered. The end result will be copied to the clipboard.");
    }
  } else {
    log("APP_ID is not registered. The end result will be copied to the clipboard.");
  }
}

log("waiting...(1s)");
await sleep(1000);

// スクレイピングセッション開始前であれば、最新のデータをAlgoliaから読み込んでlocalStorageを初期化
let saved = {};
if (!IN_SESSION && APP_ID && INDEX_NAME && API_KEY) {
  saved = await loadSavedResultFromAlgolia();
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

// 目視レビューを挟みつつ、20batchまでスクレイピングを繰り返す
for (let i = 0; i < 20; i++) {
  const hasMore = await scrapeSingleBatch();
  if (!hasMore) {
    break;
  }
}

// スクレイピング結果をAlgoliaにput & クリップボードにコピー
const result = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY));
const resultCount = Object.keys(result).length;
log("scraped books", resultCount);
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
    title: "FNZ Scraper",
    text: "books not updated",
    silent: true,
    timeout: 2000,
  });
}

GM_setValue("IN_SESSION", false);

log("Scraping session ended.");

//
//
// INTERNALS
//
//

async function scrapeSingleBatch() {
  let hasMore = false;
  let alreadyScraped = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");

  for (const [dateIndex, sectionByPurchaseDate] of document.querySelectorAll('[class^="purchasedListArea"] > ul > li:has([class^="purchasedListTitle"])').entries()) {
    const purchaseDateJapanese = sectionByPurchaseDate.querySelector('[class^="purchasedListTitle"]').textContent; // "2025年02月08日"
    const purchaseDateIso = purchaseDateJapanese.replace(/(\d{4})年(\d{2})月(\d{2})日/, "$1-$2-$3");

    for (const [bookIndex, bookLink] of sectionByPurchaseDate.querySelectorAll('a[href^="/dc/-/mylibrary/detail/=/product_id="]').entries()) {
      const currentProductId = bookLink.href.match(/product_id=(\w+)/)[1];
      // Skip if already scraped; 今回の二重ループすべてがスキップされるとhasMoreがfalseのままになるので、全体処理が停止する仕組み
      if (alreadyScraped[currentProductId]) {
        continue;
      }

      bookLink.scrollIntoView();
      bookLink.click();
      await sleep(2750);

      const productDetail = document.querySelector('[class^="productDetail"]');
      const productTypeText = productDetail.querySelector('[class^="productDetailLabel"]').textContent; // "コミック", "コミック・AI", "CG", "CG・AI", "ボイス", etc.
      const productTypeTags = productTypeText.split("・");
      const productTitle = productDetail.querySelector('[class^="productDetailTitle"]').textContent;
      const productStoreUrl = productDetail.querySelector('[class^="productDetailTitle"] a').href.replace(/\?.+$/, ""); // "https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=d_333668/", 末尾クエリパラメータを除去
      const productThumbnailUrl = productDetail.querySelector('[class^="contensImage1Ta9O"] img').src; // "https://doujin-assets.dmm.co.jp/digital/comic/d_333668/d_333668pl-200x150.jpg"
      const productCircleLink = productDetail.querySelector('a[class^="circleName"]');
      const productCircleName = productCircleLink.textContent;
      const productCircleUrl = productCircleLink.href; // "https://www.dmm.co.jp/dc/doujin/-/list/=/article=maker/id=213091/"
      const productCircleId = productCircleUrl.match(/id=(\d+)/)[1];
      const productReleaseDateJapanese = productDetail.querySelector('[class^="infoUpdate"]').textContent; // "配信日：2024年01月13日", "配信日：2024年01月13日アップデート日：2024年01月13日"
      const productReleaseDateIso = productReleaseDateJapanese.replace(/配信日：(\d{4})年(\d{2})月(\d{2})日.*/, "$1-$2-$3");
      const firstFileUrl = document.querySelector('[class^="boxFinder"] ul > li[class^="fileTreeItem"] a')?.href;

      const bookDetail = {
        id: currentProductId,
        objectID: currentProductId,
        purchaseDate: purchaseDateIso,
        title: productTitle,
        typeTags: productTypeTags,
        storeUrl: productStoreUrl,
        thumbnailUrl: productThumbnailUrl,
        circleName: productCircleName,
        circleUrl: productCircleUrl,
        circleId: productCircleId,
        releaseDate: productReleaseDateIso,
        firstFileUrl: firstFileUrl,
      };
      alreadyScraped[currentProductId] = bookDetail;
      log(dateIndex, bookIndex, "Scraped", bookDetail);
      hasMore = true;
    }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(alreadyScraped));
  }
  log("Has more?", hasMore);
  return hasMore;
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
 * Loads current books from Algolia.
 * @returns {Promise<{[id: string]: { id: string, title: string, ... }}>}
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
    title: "FNZ Scraper",
    text: `${Object.keys(result).length} books scraped and copied to the clipboard.\nAlso you may find "${LOCAL_STORAGE_KEY}" entry in localStorage.`,
    silent: true,
    timeout: 2000,
  });
}

function log() {
  console.log("[👹FNZ]", ...arguments);
}
