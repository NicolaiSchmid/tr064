const inspect = require('eyes').inspector({
  maxLength: false,
  hideFunctions: false,
  styles: {
    all: 'black',
  },
});
const util = require('util');
const tr = require('./lib/TR064');

const showCallback = function(err, result) {
  if (!err) {
    inspect(result);
  }
};

const speedCB = function(err, result) {
  util.print(`${result.NewByteReceiveRate  }  `);
};

const showDevice = function(device) {
  console.log(`=== ${  device.meta.friendlyName  } ===`);
  device.meta.servicesInfo.forEach((serviceType) => {
    const service = device.services[serviceType];
    console.log(`  ---> ${  service.meta.serviceType  } <---`);
    service.meta.actionsInfo.forEach((action) => {
      console.log(`   # ${  action.name  }()`);
      action.inArgs.forEach((arg) => {
        console.log(`     IN : ${  arg}`);
      });
      action.outArgs.forEach((arg) => {
        console.log(`     OUT: ${  arg}`);
      });
    });
  });
};

const tr064 = new tr.TR064();

// tr064.startEventServer(44880);

tr064.initIGDDevice('fritz.box', 49000, (err, device) => {
  if (!err) {
    console.log('Found device! - IGD');
    showDevice(device);

    const wandic = device.services['urn:schemas-upnp-org:service:WANIPConnection:1'];

    wandic.actions.GetExternalIPAddress(showCallback);

    const wan = device.services['urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1'];
    wan.actions.GetCommonLinkProperties(showCallback);
    wan.actions.GetTotalBytesReceived(showCallback);
    wan.actions.GetAddonInfos(showCallback);
    setInterval(wan.actions.GetAddonInfos, 1000, speedCB);
  }
});

/*
Example: Get the url from the first phonebook.
*/
var user = 'user';
var password = 'password';
tr064.initTR064Device('fritz.box', 49000, (err, device) => {
  if (!err) {
    console.log('Found device! - TR-064');
    device.startEncryptedCommunication((err, sslDev) => {
      if (!err) {
        sslDev.login(user, password);
        const wanppp = sslDev.services['urn:dslforum-org:service:X_AVM-DE_OnTel:1'];
        wanppp.actions.GetPhonebook(
          {
            NewPhonebookID: '0',
          },
          (err, ret) => {
            if (err) {
              console.log(err);
              return;
            }
            if (ret.NewPhonebookURL && ret.NewPhonebookURL.length > 0) {
              // GOT URL
              const url = ret.NewPhonebookURL;
              console.log(url);
            }
          },
        );
      } else {
        console.log(err);
      }
    });
  }
});

/*
Example: Turn off/on WLAN on FritzBoxes.
*/
var user = 'user';
var password = 'password';
tr064.initTR064Device('fritz.box', 49000, (err, device) => {
  if (!err) {
    console.log('Found device! - TR-064');
    device.startEncryptedCommunication((err, sslDev) => {
      if (!err) {
        sslDev.login(user, password);
        const wlan24 = sslDev.services['urn:dslforum-org:service:WLANConfiguration:1'];
        const wlan5 = sslDev.services['urn:dslforum-org:service:WLANConfiguration:2'];
        const wlanGuest = sslDev.services['urn:dslforum-org:service:WLANConfiguration:3'];
        //                                                1 for on and 0 for off
        wlan24.actions.SetEnable([{ name: 'NewEnable', value: '1' }], (err, result) => {
          console.log(err);
          console.log(result);
        });
        //                                                1 for on and 0 for off
        wlan5.actions.SetEnable([{ name: 'NewEnable', value: '1' }], (err, result) => {
          console.log(err);
          console.log(result);
        });
        //                                                1 for on and 0 for off
        wlanGuest.actions.SetEnable([{ name: 'NewEnable', value: '1' }], (err, result) => {
          console.log(err);
          console.log(result);
        });
      } else {
        console.log(err);
      }
    });
  }
});
