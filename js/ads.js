/**
 * Car Jam Solver — ads stubs (rewarded coins/undo, interstitial between levels).
 * Never blocks puzzle core.
 */
(function (root) {
  'use strict';

  let interstitialReady = true;
  let rewardedReady = true;

  function showInterstitial(cb) {
    // stub: instant "shown"
    setTimeout(function () {
      interstitialReady = true;
      if (cb) cb({ shown: true, stub: true });
    }, 200);
  }

  function showRewarded(reason, cb) {
    setTimeout(function () {
      rewardedReady = true;
      if (cb) cb({ rewarded: true, reason: reason, stub: true });
    }, 300);
  }

  root.CarJamAds = {
    showInterstitial: showInterstitial,
    showRewarded: showRewarded,
    isInterstitialReady: function () { return interstitialReady; },
    isRewardedReady: function () { return rewardedReady; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
