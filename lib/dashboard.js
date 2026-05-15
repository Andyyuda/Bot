const state = {
  qr: null,
  pairingCode: null,
  phoneNumber: null,
  status: 'disconnected',
  botUser: null,
  pendingCommand: null
};

module.exports = {
  isConfigured: true,

  async pushQr(qr) {
    state.qr = qr;
  },

  async pushPairingCode(code, phoneNumber) {
    state.pairingCode = code;
    state.phoneNumber = phoneNumber;
  },

  async pushStatus(status, botUser) {
    state.status = status;
    state.botUser = botUser;
  },

  async setPendingCommand(cmd) {
    state.pendingCommand = cmd;
  },

  async getPendingCommand() {
    const cmd = state.pendingCommand;
    state.pendingCommand = null;
    return cmd;
  },

  getState() {
    return state;
  }
};
