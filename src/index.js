import Device from './Device';

const parseString = require('xml2js').parseString;
const request = require('request');
const http = require('http');
const inspect = require('eyes').inspector({
  maxLength: false,
  hideFunctions: false,
});
const URL = require('url');

const TR064_DESC_URL = '/tr64desc.xml';
const IGD_DESC_URL = '/igddesc.xml';
const PMR_DESC_URL = '/pmr/PersonalMessageReceiver.xml';

function TR064() {}
TR064.prototype.discoverDevice = function() {};
TR064.prototype.initTR064Device = function(host, port, callback) {
  this._parseDesc(host, port, TR064_DESC_URL, callback);
};
TR064.prototype.initIGDDevice = function(host, port, callback) {
  this._parseDesc(host, port, IGD_DESC_URL, callback);
};
TR064.prototype.initPMRDevice = function(host, port, callback) {
  this._parseDesc(host, port, PMR_DESC_URL, callback);
};

TR064.prototype.startEventServer = function(port) {
  this.eventServer = http.createServer((req, res) => {
    inspect(req);
    res.writeHead(200);
    res.end();
  });
  this.eventServer.listen(port);
};

TR064.prototype.stopEventServer = function() {
  this.removeAllEvents();
  this.server.close();
};

TR064.prototype.removeAllEvents = function() {};

TR064.prototype._parseDesc = function(host, port, url, callback) {
  const nurl = `http://${  host  }:${  port  }${url}`;
  request(nurl, (error, response, body) => {
    if (!error && response.statusCode == 200) {
      parseString(body, { explicitArray: false }, (err, result) => {
        if (!err) {
          // this.deviceInfo.push(result);
          const devInfo = result.root.device;
          devInfo.host = host;
          devInfo.port = port;
          const path = URL.parse(nurl).pathname;
          devInfo.urlPart = path.substring(0, path.lastIndexOf('/'));
          new Device(devInfo, callback);
        } else {
          console.log(err);
          console.log(result);
          callback(err, null);
        }
      });
    } else {
      console.log(error);
      console.log(body);
      callback(error, null);
    }
  });
};

exports.TR064 = TR064;
