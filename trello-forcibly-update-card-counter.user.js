// ==UserScript==
// @name         Update card counter in conjunction with my user CSS
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=trello.com
// @version      1.20240301.0
// @description  Update card counter in conjunction with my user CSS. CSS Counter alone may not work properly.
// @author       Gada / ymtszw
// @copyright    2023, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/trello-forcibly-update-card-counter.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/trello-forcibly-update-card-counter.user.js

// @noframes     true
// @run-at       document-idle
// @match        https://trello.com/*
// @grant        none
// ==/UserScript==

function updateCardCounter() {
  const lists = document.querySelectorAll("ol#board > li");
  for (const list of lists) {
    const cards = list.querySelectorAll(`ol[data-testid="list-cards"] > li`);
    const cardCount = cards.length;
    const cardCounter = list.querySelector("div.card-counter");
    if (cardCounter) {
      cardCounter.textContent = cardCount;
    } else {
      const newCardCounter = document.createElement("div");
      newCardCounter.className = "card-counter";
      newCardCounter.textContent = cardCount;
      list.appendChild(newCardCounter);
      console.log(
        `Added card counter to ${list.querySelector("h2").textContent}`
      );
    }
  }
  requestAnimationFrame(updateCardCounter);
}

(function () {
  "use strict";
  requestAnimationFrame(updateCardCounter);
})();
