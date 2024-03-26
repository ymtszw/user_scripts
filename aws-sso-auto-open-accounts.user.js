// ==UserScript==
// @name         Auto-open AWS SSO Account
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazonaws.com
// @version      1.20240326.2
// @description  Auto-open AWS SSO Account
// @author       Gada / ymtszw
// @copyright    2023, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/aws-sso-auto-open-accounts.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/aws-sso-auto-open-accounts.user.js

// @noframes     true
// @run-at       document-idle
// @match        https://*.awsapps.com/start*
// @exclude      https://*.awsapps.com/start/user-consent*
// @grant        none
// ==/UserScript==

function findAndClickAccounts(remaining_attempt) {
  return function (timestamp) {
    if (remaining_attempt > 0) {
      if (document.querySelector('[data-testid="account-list"]')) {
        for (const kid of document.querySelectorAll(
          '[data-testid="account-list"] button[data-testid="account-list-cell"]'
        )) {
          kid.click();
          const name = kid.querySelector("strong").textContent;
          console.log(`Account (${name}) found and clicked!`);
        }
      } else {
        window.requestAnimationFrame(
          findAndClickAccounts(remaining_attempt - 1)
        );
      }
    } else {
      console.log(`Accounts not found`);
    }
  };
}

(function () {
  "use strict";
  window.requestAnimationFrame(findAndClickAccounts(1_000));
})();
