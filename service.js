// TizenBrew service — фоновая логика модуля «Приветствие»
// Запускается в Node.js-контексте TizenBrew (не в webview)

module.exports = {
  onLaunch: function () {
    console.log('[tvgreet] module launched');
  },
  onExit: function () {
    console.log('[tvgreet] module exited');
  }
};
