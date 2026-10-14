const { contextBridge, ipcRenderer } = require('electron');
const subscribe = channel => callback => {
 const listener = (_event, state) => callback(state);
 ipcRenderer.on(channel, listener);
 return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('islandDesktop', {
 overlay: process.argv.includes('--island-overlay'),
 configure: settings => ipcRenderer.invoke('island:configure', settings),
 displays: () => ipcRenderer.invoke('island:displays'),
 action: (name, value) => ipcRenderer.invoke('island:action', name, value),
 dock: () => ipcRenderer.invoke('island:dock'),
 requestAutomation: () => ipcRenderer.invoke('island:requestAutomation'),
 checkUpdate: () => ipcRenderer.invoke('island:update'),
 downloadUpdate: url => ipcRenderer.invoke('island:downloadUpdate', url),
 onUpdateProgress: subscribe('island:update-progress'),
 focus: () => ipcRenderer.send('island:focus'),
 send: state => ipcRenderer.send('island:state', state),
 onState: subscribe('island:state'),
 onSystem: subscribe('island:system'),
 appVolume: (name, v) => ipcRenderer.invoke('island:appVolume', name, v),
 clipboard: () => ipcRenderer.invoke('island:clipboard'),
 onClipboard: subscribe('island:clipboard'),
 copy: text => ipcRenderer.invoke('island:copy', text),
});
