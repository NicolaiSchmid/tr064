const parseString = require('xml2js').parseString;
const inspect = require('eyes').inspector({
  maxLength: false,
  hideFunctions: false,
});
const request = require('request');

function Service(device, serviceInfo, callback) {
  this.host = device.meta.host;
  this.port = device.meta.port;
  this.device = device;
  this.meta = serviceInfo;
  this.meta.actionsInfo = [];
  this.readyCallback = callback;
  this.actions = {};
  this.stateVariables = {};
  this.logAttempts = [];
  // console.log("Service: "+this.host);
  _parseSCPD(this);
}
Service.prototype.listActions = function() {};
Service.prototype.listStateVariables = function() {};

const _pushArg = function(argument, inArgs, outArgs) {
  if (argument.direction == 'in') {
    inArgs.push(argument.name);
  } else if (argument.direction == 'out') {
    outArgs.push(argument.name);
  }
};

const _parseActions = function(actionData) {
  if (!Array.isArray(actionData)) {
    return;
  }
  const insA = bind(this, _insertAction);
  actionData.forEach(insA);
  // inspect(actions);
  //
};

var _parseSCPD = function(obj) {
  if (obj.device.meta.urlPart && obj.device.meta.urlPart.length > 0) {
    obj.meta.SCPDURL = `${obj.device.meta.urlPart  }/${  obj.meta.SCPDURL}`;
  }
  const url = `http://${  obj.host  }:${  obj.port  }${obj.meta.SCPDURL}`;
  // console.log(url);
  request(url, (error, response, body) => {
    if (!error && response.statusCode == 200) {
      // console.log(body);
      parseString(
        body,
        {
          explicitArray: false,
        },
        (err, result) => {
          const pA = bind(obj, _parseActions);
          const pV = bind(obj, _parseStateVariables);
          pA(result.scpd.actionList.action);
          pV(result.scpd.serviceStateTable.stateVariable);
          // inspect(obj.stateVariables);
          obj.readyCallback(null, obj);
        },
      );
    } else {
      console.log(url);
    }
  });
};

var _insertAction = function(el) {
  const outArgs = [];
  const inArgs = [];
  if (el.argumentList && Array.isArray(el.argumentList.argument)) {
    el.argumentList.argument.forEach((argument) => {
      _pushArg(argument, inArgs, outArgs);
    });
  } else if (el.argumentList) {
    _pushArg(el.argumentList.argument, inArgs, outArgs);
  }

  this.actions[el.name] = bind(this, function(vars, callback) {
    this._callAction(el.name, inArgs, outArgs, vars, callback);
  });
  this.meta.actionsInfo.push({
    name: el.name,
    inArgs,
    outArgs,
  });
};

Service.prototype._callAction = function(name, inArguments, outArguments, vars, callback) {
  if (typeof vars === 'function') {
    callback = vars;
    vars = [];
  }

  bind(
    this,
    this._sendSOAPActionRequest(
      this.device,
      this.meta.controlURL,
      this.meta.serviceType,
      name,
      inArguments,
      outArguments,
      vars,
      callback,
    ),
  );
};

Service.prototype._subscribeStateVariableChangeEvent = function(sv, callback) {
  inspect(arguments);
};

function bind(scope, fn) {
  return function() {
    return fn.apply(scope, arguments);
  };
}

const _insertStateVariables = function(sv) {
  if (sv.$.sendEvents == 'yes') {
    this.stateVariables[sv.name] = bind(this, function(callback) {
      this._subscribeStateVariableChangeEvent(sv, callback);
    });
  }
};

var _parseStateVariables = function(stateVariableData) {
  const insSV = bind(this, _insertStateVariables);
  if (Array.isArray(stateVariableData)) {
    stateVariableData.forEach(insSV);
  } else if (typeof stateVariableData === 'object') {
    insSV(stateVariableData);
  }
};

Service.prototype._sendSOAPActionRequest = function(
  device,
  url,
  serviceType,
  action,
  inArguments,
  outArguments,
  vars,
  callback,
) {
  const self = this;
  let head = '';
  if (device._auth.uid) {
    // Content Level Authentication
    if (device._auth.auth) {
      head =
        `${'<s:Header>' +
        '<h:ClientAuth xmlns:h="http://soap-authentication.org/digest/2001/10/"' +
        's:mustUnderstand="1">' +
        '<Nonce>'}${ 
        device._auth.sn 
        }</Nonce>` +
        `<Auth>${ 
        device._auth.auth 
        }</Auth>` +
        `<UserID>${ 
        device._auth.uid 
        }</UserID>` +
        `<Realm>${ 
        device._auth.realm 
        }</Realm>` +
        `</h:ClientAuth>` +
        `</s:Header>`;
    } else {
      // First Auth
      head =
        `${' <s:Header>' +
        '<h:InitChallenge xmlns:h="http://soap-authentication.org/digest/2001/10/"' +
        's:mustUnderstand="1">' +
        '<UserID>'}${ 
        device._auth.uid 
        }</UserID>` +
        `<Realm>${ 
        device._auth.realm 
        }</Realm>` +
        `</h:InitChallenge>` +
        `</s:Header>`;
    }
  }

  let body =
    `${'<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s=" http://schemas.xmlsoap.org/soap/envelope/">'}${ 
    head 
    }<s:Body>` +
    `<u:${ 
    action 
    } xmlns:u="${ 
    serviceType 
    }">`;

  Object.keys(vars).forEach(key => {
    body += `<${  vars[i].name  }>`;
    body += vars[i].value;
    body += `</${  vars[i].name  }>`;
  });

  body = `${body  }</u:${  action  }>` + `</s:Body>` + `</s:Envelope>`;

  let port = 0,
    proto = '',
    agentOptions = null;
  if (device._sslPort) {
    port = device._sslPort;
    proto = 'https://';
    if (device._ca) {
      agentOptions = {
        ca: device._ca,
      };
    } else {
      agentOptions = {
        rejectUnauthorized: false,
      }; // Allow selfsignd Certs
    }
  } else {
    proto = 'http://';
    port = device.meta.port;
  }
  const uri = `${proto + device.meta.host  }:${  port  }${url}`;
  const that = this;
  request(
    {
      method: 'POST',
      uri,
      agentOptions,
      headers: {
        SoapAction: `${serviceType  }#${  action}`,
        'Content-Type': 'text/xml; charset="utf-8"',
      },
      body,
      timeout: 5000,
    },
    (error, response, body) => {
      if (!error && response.statusCode == 200) {
        parseString(
          body,
          {
            explicitArray: false,
          },
          (err, result) => {
            let challange = false;
            let res = {};
            const env = result['s:Envelope'];
            if (env['s:Header']) {
              const header = env['s:Header'];
              if (header['h:Challenge']) {
                const ch = header['h:Challenge'];
                challange = true;
                if (self.logAttempts.length) {
                  for (const i in self.logAttempts) {
                    if (self.logAttempts[i].service == serviceType) {
                      if (self.logAttempts[i].attempts >= 1) {
                        error = new Error('Credentials incorrect');
                      } else {
                        self.logAttempts[i].attempts += 1;
                        device._auth.des = serviceType;
                        device._auth.sn = ch.Nonce;
                        device._auth.realm = ch.Realm;
                        device._auth.auth = device._calcAuthDigest(
                          device._auth.uid,
                          device._auth.pwd,
                          device._auth.realm,
                          device._auth.sn,
                        );
                        device._auth.chCount++;
                        that._sendSOAPActionRequest(
                          device,
                          url,
                          serviceType,
                          action,
                          inArguments,
                          outArguments,
                          vars,
                          callback,
                        );
                        return;
                      }
                    }
                  }
                } else {
                  self.logAttempts.push({ service: serviceType, attempts: 1 });
                  device._auth.sn = ch.Nonce;
                  device._auth.realm = ch.Realm;
                  device._auth.auth = device._calcAuthDigest(
                    device._auth.uid,
                    device._auth.pwd,
                    device._auth.realm,
                    device._auth.sn,
                  );
                  device._auth.chCount++;
                  // Repeat request.
                  that._sendSOAPActionRequest(
                    device,
                    url,
                    serviceType,
                    action,
                    inArguments,
                    outArguments,
                    vars,
                    callback,
                  );
                  return;
                }
              } else if (header['h:NextChallenge']) {
                const nx = header['h:NextChallenge'];
                for (const i in self.logAttempts) {
                  if (self.logAttempts[i].service == serviceType) {
                    self.logAttempts[i].attempts = 0;
                  }
                }
                // device._auth.auth = nx.Nonce;
                device._auth.chCount = 0;
                device._auth.sn = nx.Nonce;
                device._auth.realm = nx.Realm;
                device._auth.auth = device._calcAuthDigest(
                  device._auth.uid,
                  device._auth.pwd,
                  device._auth.realm,
                  device._auth.sn,
                );
              }
            }

            if (env['s:Body']) {
              const body = env['s:Body'];
              if (body[`u:${  action  }Response`]) {
                const responseVars = body[`u:${  action  }Response`];
                if (outArguments) {
                  outArguments.forEach((arg) => {
                    res[arg] = responseVars[arg];
                  });
                }
              } else if (body['s:Fault']) {
                const fault = body['s:Fault'];
                error = new Error(`Device responded with fault ${  error}`);
                res = fault;
              }
            }
            callback(error, res);
          },
        );
      } else {
        const newError = new Error(
          `sendSOAPActionRequest Error! [${ 
            action 
            }] [${ 
            serviceType 
            }]${ 
            response ? ` [${  response.statusCode  }]` : '' 
            }${error ? ` [${  error.code  }]` : ''}`,
        );
        callback(newError, null);
      }
    },
  );
};

Service.prototype.sendSOAPEventSubscribeRequest = function(callback) {
  console.log('Send EventSubscribe...');
  request(
    {
      method: 'SUBSCRIBE',
      uri: `http://${  this.host  }:${  this.port  }${this.meta.eventSubURL}`,
      headers: {
        CALLBACK: '<http://192.168.178.28:44880/>',
        NT: 'upnp:event',
        TIMEOUT: 'Second-infinite',
      },
    },
    (error, response, body) => {
      console.log('END');
      if (response.statusCode == 200) {
        console.log('EventSubscribeRequest OK');
      } else {
        error = new Error(`EventSubscribeRequest Error: ${  response.statusCode}`);
        console.log(`error: ${  response.statusCode}`);
        console.log(body);
      }
    },
  );
};

exports.Service = Service;
