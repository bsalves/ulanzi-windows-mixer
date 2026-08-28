export class FakeHost {
  constructor() {
    this.handlers = {};
    this.icons = [];
    this.titles = [];
    this.feedback = [];
    this.feedbackLayouts = [];
    this.savedSettings = {};
    this.inspectorMessages = [];
    this.alerts = [];
    this.logs = [];
    this.toasts = [];
  }

  connect() {}
  on(name, fn) {
    this.handlers[name] = fn;
    return this;
  }
  onConnected(fn) { return this.on("connected", fn); }
  onClose(fn) { return this.on("close", fn); }
  onError(fn) { return this.on("error", fn); }
  onAdd(fn) { return this.on("add", fn); }
  onRun(fn) { return this.on("run", fn); }
  onClear(fn) { return this.on("clear", fn); }
  onSetActive(fn) { return this.on("setActive", fn); }
  onParamFromApp(fn) { return this.on("paramFromApp", fn); }
  onDidReceiveSettings(fn) { return this.on("didReceiveSettings", fn); }
  onDidReceiveGlobalSettings(fn) { return this.on("didReceiveGlobalSettings", fn); }
  onSendToPlugin(fn) { return this.on("sendToPlugin", fn); }
  onDialDown(fn) { return this.on("dialDown", fn); }
  onDialUp(fn) { return this.on("dialUp", fn); }
  onDialRotate(fn) { return this.on("dialRotate", fn); }
  onDialRotateLeft(fn) { return this.on("dialRotateLeft", fn); }
  onDialRotateRight(fn) { return this.on("dialRotateRight", fn); }
  onDialRotateHoldLeft(fn) { return this.on("dialRotateHoldLeft", fn); }
  onDialRotateHoldRight(fn) { return this.on("dialRotateHoldRight", fn); }
  decodeContext(context) {
    const [uuid, key, actionid] = String(context).split("___");
    return { uuid, key, actionid };
  }
  setStateIcon(context, state, text) { this.icons.push({ context, state, text }); }
  setTitle(context, text) { this.titles.push({ context, text }); }
  setFeedbackLayout(context, layout) { this.feedbackLayouts.push({ context, layout }); }
  setFeedback(context, layout) { this.feedback.push({ context, layout }); }
  setSettings(settings, context) { this.savedSettings[context] = settings; }
  getSettings() {}
  getGlobalSettings() {}
  setGlobalSettings() {}
  sendToPropertyInspector(data, context) { this.inspectorMessages.push({ data, context }); }
  sendParamFromPlugin() {}
  showAlert(context) { this.alerts.push(context); }
  toast(msg) { this.toasts.push(msg); }
  logMessage(msg, level) { this.logs.push({ msg, level }); }

  lastIcon(context) {
    return [...this.icons].reverse().find((item) => item.context === context);
  }
}
