// ==UserScript==
// @name         Auto-confirm AWS CLI SSO login
// @namespace    https://ymtszw.cc
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazonaws.com
// @version      1.20240206.0
// @description  Auto-confirm AWS CLI SSO login
// @author       Gada / ymtszw
// @copyright    2023, Gada / ymtszw (https://ymtszw.cc)
// @downloadURL  https://raw.githubusercontent.com/ymtszw/user_scripts/main/aws-sso-auto-confirm-cli-login.user.js
// @updateURL    https://raw.githubusercontent.com/ymtszw/user_scripts/main/aws-sso-auto-confirm-cli-login.user.js

// @noframes     true
// @run-at       document-idle
// @match        https://device.sso.*.amazonaws.com/?user_code=*
// @match        https://*.awsapps.com/start/user-consent/authorize.html?clientId=*
// @grant        none
// ==/UserScript==

function findAndClickConfirmButton(remaining_attempt) {
  return function (timestamp) {
    if (remaining_attempt > 0) {
      if (document.querySelector("button#cli_verification_btn")) {
        document.querySelector("button#cli_verification_btn").click();
        console.log(`Confirm button found and clicked!`);
      } else {
        window.requestAnimationFrame(
          findAndClickConfirmButton(remaining_attempt - 1)
        );
      }
    } else {
      console.log(`Button not found`);
    }
  };
}

function findAndClickAllowButton(remaining_attempt) {
  return function (timestamp) {
    if (remaining_attempt > 0) {
      if (document.querySelector("button#cli_login_button")) {
        document.querySelector("button#cli_login_button").click();
        console.log(`Allow button found and clicked!`);
      } else {
        window.requestAnimationFrame(
          findAndClickAllowButton(remaining_attempt - 1)
        );
      }
    } else {
      console.log(`Allow button not found`);
    }
  };
}

(function () {
  "use strict";
  if (
    window.location.hostname?.startsWith(
      "device.sso.ap-northeast-1.amazonaws.com"
    )
  ) {
    window.requestAnimationFrame(findAndClickConfirmButton(1_000));
  } else if (window.location.hostname?.startsWith("siiibo-sso.awsapps.com")) {
    window.requestAnimationFrame(findAndClickAllowButton(1_000));
  } else {
    console.log("Unexpected hostname");
  }
})();
