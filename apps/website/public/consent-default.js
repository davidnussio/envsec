window.dataLayer ||= [];
window.gtag = function gtag() {
  // oxlint-disable-next-line prefer-rest-params -- gtag.js only processes Arguments objects pushed onto dataLayer, not plain arrays
  window.dataLayer.push(arguments);
};
window.gtag("consent", "default", {
  ad_personalization: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  analytics_storage: "denied",
  wait_for_update: 500,
});
