// ==UserScript==
// @name         Auto-open AWS SSO Account
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=awsapps.com
// @version      1.20240206.0
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
      if (document.querySelector("portal-instance-list")) {
        for (const kid of document.querySelectorAll(
          "portal-instance-list .instance-section"
        )) {
          kid.click();
          const name = kid.textContent.trim().split(/\s+/)[0];
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

function findAndClickMenu(remaining_attempt) {
  return function (timestamp) {
    if (remaining_attempt > 0) {
      if (document.querySelector('[title="AWS Account"]')) {
        document.querySelector('[title="AWS Account"]').click();
        console.log(`Menu found and clicked!`);
        window.requestAnimationFrame(
          findAndClickAccounts(remaining_attempt - 1)
        );
      } else {
        window.requestAnimationFrame(findAndClickMenu(remaining_attempt - 1));
      }
    } else {
      console.log(`Menu not found`);
    }
  };
}

(function () {
  "use strict";
  window.requestAnimationFrame(findAndClickMenu(1_000));
})();
