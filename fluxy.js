!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.fluxy=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var Dispatcher = _dereq_('./lib/Dispatcher');
var FluxStore = _dereq_('./lib/Store');
var FluxActions = _dereq_('./lib/Action');
var FluxConstants = _dereq_('./lib/Constants');
var extend = _dereq_('lodash-node/modern/objects/assign');

var stores = [];
var actions = [];

var assignDataToStore = function(initialData, Store) {
  if (Store.name && initialData) {
    var state = initialData[Store.name];
    if (state) {
      Store.replaceState(state);
    }
  }
};

var safeStringify = function (obj) {
  return JSON.stringify(obj).replace(/<\//g, '<\\\\/').replace(/<\!--/g, '<\\\\!--');
};


var Fluxy = function () {
  this._dispatcher = new Dispatcher();
};

Fluxy.createStore = function (proto) {
  var Store = FluxStore.extend(function () {
    FluxStore.call(this);
  }, proto);
  var store = new Store();
  stores.push(store);
  return store;
};

Fluxy.createActions = function (proto) {
  var Action = FluxActions.extend(proto);
  var action = new Action();
  actions.push(action);
  return action;
};

Fluxy.createConstants = function (values) {
  return FluxConstants(values);
};

Fluxy.start = function (initialData) {
  var flux = new Fluxy();
  stores.forEach(function (store) {
    store.mount(flux);
    assignDataToStore(initialData, store);
  });
  actions.forEach(function (action) {
    action.mount(flux);
  });
  return flux;
};

Fluxy.bootstrap = function (key, context) {
  var initialData;
  if (!context && window) {
    context = window;
  }

  if (context && context[key]) {
    initialData = context[key];
  }

  Fluxy.start(initialData);
};

Fluxy.renderStateToString = function (serializer) {
  var state = {};
  serializer = serializer || safeStringify;
  stores.forEach(function (store) {
    if (store.name) {
      state[store.name] = store.toJS(store.state);
    }
  });

  return serializer(state);
};

Fluxy.reset = function () {
  stores = [];
  actions = [];
};


Fluxy.prototype = extend(Fluxy.prototype, {
  //dispatcher delegation
  registerAction: function () {
    return this._dispatcher.registerAction.apply(this._dispatcher, arguments);
  },
  registerDeferedAction: function () {
    return this._dispatcher.registerDeferedAction.apply(this._dispatcher, arguments);
  },
  dispatchAction: function () {
    return this._dispatcher.dispatchAction.apply(this._dispatcher, arguments);
  },
});

module.exports = Fluxy;
module.exports.$ = _dereq_('mori');

},{"./lib/Action":2,"./lib/Constants":3,"./lib/Dispatcher":4,"./lib/Store":5,"lodash-node/modern/objects/assign":57,"mori":64}],2:[function(_dereq_,module,exports){
var extend = _dereq_('lodash-node/modern/objects/assign');
var util = _dereq_('util');
var fnNameFromServiceName = _dereq_('./convertName');

var constructArgs = function (serviceName, args) {
  var arrArgs = Array.prototype.slice.call(args);
  arrArgs.unshift(serviceName);
  return arrArgs;
};

var Action = function () {
 this._configureServiceActions();
};

Action.prototype = extend(Action.prototype, {
  actions: {},
  serviceActions: {},
  mount: function (flux) {
    this.flux = flux;

    this.dispatchAction = flux.dispatchAction.bind(flux);
  },
  _configureServiceActions: function () {
    var self = this;
    Object.keys(this.serviceActions).forEach(function (key) {
      var pair = self.serviceActions[key];
      var serviceName = pair[0].value;
      var actionName = key;
      if (self[actionName]) {
        throw new Error('Cannot assign duplicate function name "' + actionName + '"');
      }

      self[actionName] = function () {
        var args = constructArgs(serviceName, arguments);
        self.dispatchAction.apply(self.flux, args);
        return pair[1].apply(self, Array.prototype.slice.call(arguments))
          .then(function (result) {
            self.dispatchAction(serviceName+'_COMPLETED', result);
          })
          .catch(function (err) {
            self.dispatchAction(serviceName+'_FAILED', err);
          });
      };
    });
  },
});

Action.extend = function (ChildProto) {
  var ChildFn = function () {
    Action.call(this);
  };
  util.inherits(ChildFn, Action);
  ChildFn.prototype = extend(ChildFn.prototype, ChildProto);
  return ChildFn;
};

module.exports = Action;

},{"./convertName":6,"lodash-node/modern/objects/assign":57,"util":68}],3:[function(_dereq_,module,exports){
var Enum = _dereq_('enum');

/**
 * An Enum factory
 * @param {object} constants - a hash of constant values
 *
 * Creates a new Enum for the provided constants. There are three types of constants:
 *  * serviceMessages: automatically have complimented COMPLETED and FAILED messages created
 *  * messages: a string constant, where the value is the same as the key
 *  * values: a string -> constant value lookup
 *
 * serviceMessages and messages should be specified as Array<String>. Values should be a hash.
 *
 */
var ConstantsFactory = function (constants) {
  var enumValues = {};
  if (constants) {
    if (constants.serviceMessages) {
      constants.serviceMessages.forEach(function (key) {
        var messages = [key, key+'_COMPLETED', key+'_FAILED'];
        messages.forEach(function (m) { enumValues[m] = m; });
      });
    }
    if (constants.messages) {
      constants.messages.forEach(function (key) {
        enumValues[key] = key;
      });
    }
    if (constants.values) {
      Object.keys(constants.values).forEach(function (key) {
        enumValues[key] = constants.values[key];
      });
    }
  }
  return new Enum(enumValues);
};

module.exports = ConstantsFactory;

},{"enum":44}],4:[function(_dereq_,module,exports){
/**
 * Copyright 2014 Justin Reidy
 *
 * Dispatcher
 *
 * The Dispatcher is capable of registering callbacks and invoking them.
 * More robust implementations than this would include a way to order the
 * callbacks for dependent Stores, and to guarantee that no two stores
 * created circular dependencies.
 */

var Promise = _dereq_('bluebird');
var extend = _dereq_('lodash-node/modern/objects/assign');

var Dispatcher = function () {
  this._actions = {};
  this._tokens = {};
  this._currentDispatch = undefined;
  this._dispatchQueue = [];

  this._registerActionHandler = function (action, handler) {
    this._actions[action] = this._actions[action] || [];
    return this._actions[action].push(handler);
  };

  this._processQueue = function () {
    this._tokens = {};
    var nextDispatch = this._dispatchQueue.shift();
    if (nextDispatch) {
      this.dispatchAction(nextDispatch.action, nextDispatch.payload);
    }
  };

  this._activatePromise = function (idx, handler, args) {
    var promise = this._tokens[idx];
    if (!promise) {
      promise = handler.apply(null, args);
      this._tokens[idx] = promise;
    }
    return promise;
  };
};

Dispatcher.prototype = extend(Dispatcher.prototype, {
  /**
   * register a callback function to an action
   * @param {string} action The name of the action to register against
   * @param {handler} function A handler function that will be invoked with payload
   */
  registerAction: function (action, handler) {
    handler = Promise.method(handler);
    var idx = this._registerActionHandler(action, handler);
    var actionHandler = function () {
      return this._tokens[idx];
    };
    actionHandler._id = handler;
    return actionHandler;
  },

  /**
   * register an action with explicit dependencies
   * The dependencies are executed serially
   * @param {string} action The name of the action to register against
   * @param {array} actionHandlers Array of handlers that prevede this handler
   * @param {function} handler The action handler fn
   */
  registerDeferedAction: function (action, actionHandlers, handler) {
    var self = this;

    return this.registerAction(action, function (payload) {
      var handlerIndexes = actionHandlers.map(function (func) {
        return self._actions[action].indexOf(func._id);
      });
      return Promise.reduce(handlerIndexes, function (current, idx) {
        return self._activatePromise(idx, self._actions[action][idx], payload);
      }, 0
      ).then(function () {
        return handler(payload);
      });
    });
  },

  /**
   * dispatch a named action with a payload
   * @param  {action} action The name of the action to dispatch
   * @param  {object} payload The data from the action.
   */
  dispatchAction: function(action, payload) {
    var self = this;
    var handlers = this._actions[action];
    if (!handlers || handlers.length < 1) {
      return;
    }

    if (arguments.length > 2) {
      payload = Array.prototype.slice.call(arguments, 1);
    }
    else {
      payload = [payload];
    }

    if (!this._currentDispatch || this._currentDispatch.isResolved()) {
        this._currentDispatch = Promise.map(
            handlers,
            function (handler, idx) {
              return self._activatePromise(idx, handler, payload);
            }
        );
        this._currentDispatch.finally(this._processQueue.bind(this));
    }
    else {
      this._dispatchQueue.push({action: action, payload: payload});
    }
  }
});


module.exports = Dispatcher;

},{"bluebird":9,"lodash-node/modern/objects/assign":57}],5:[function(_dereq_,module,exports){
/** @jsx React.DOM */
var util = _dereq_("util");
var extend = _dereq_('lodash-node/modern/objects/assign');
var convertName = _dereq_('./convertName');
var mori = _dereq_('mori');

var getActionKeyForName = function (actionName) {
  var name = actionName;
  if (name.value) {
    name = name.value;
  }
  name = convertName(name);
  name = name.charAt(0).toUpperCase() + name.substr(1, name.length);
  return 'handle'+name;
};

var toArray = function (val) {
  if (!Array.isArray(val)) {
    val = [val];
  }
  return val;
};

var Store = function () {};

Store.prototype = extend(Store.prototype, {
  _getFlux: function () {
    if (!this.flux) {
      throw new Error("Flux instance not defined. Did you call Flux.start()?");
    }
    else {
      return this.flux;
    }
  },
  _updateState: function (newState) {
    this.state = newState;
    this.states = mori.conj(this.states, newState);
  },
  _resetState: function () {
    this.state = mori.js_to_clj(this.getInitialState());
    this.states = mori.vector(this.state);
  },
  _registerAction: function (actionName, actionKey, handler, waitForHandlers) {
    var registeredAction;
    var flux = this._getFlux();
    if (waitForHandlers) {
      registeredAction = flux.registerDeferedAction(actionName, waitForHandlers, handler.bind(this));
    }
    else {
      registeredAction = flux.registerAction(actionName, handler.bind(this));
    }
    this[actionKey] = registeredAction;
    this._actionMap[actionName] = registeredAction;
  },
  _configureActions: function () {
    var self = this;
    var flux = this._getFlux();
    this._actionMap = {};

    if (this.actions) {
      this.actions.forEach(function (action) {
        if (!action[0]) {
          throw new Error("Action name must be provided");
        }
        if (action.length < 2 || (typeof action[action.length-1] !== "function")) {
          throw new Error("Action handler must be provided");
        }

        var actionName = action[0];
        var actionKey = getActionKeyForName(actionName);

        if (action.length === 2) {
          self._registerAction(actionName, actionKey, action[1]);
        }
        else {
          var opts = action[1];
          var handler = action[2];
          var waitFor = opts.waitFor;
          if (waitFor) {
            if (!Array.isArray(waitFor)) {
              waitFor = [waitFor];
            }
            var waitForHandlers = waitFor.map(function(store) {
              return store._getHandlerFor(actionName);
            });
            self._registerAction(actionName, actionKey, handler, waitForHandlers);
          }
        }
      });
    }
  },

  _getHandlerFor: function (actionName) {
    return this._actionMap[actionName];
  },

  _notify: function(keys, oldState, newState) {
    this.watchers.forEach(function (w) {
      w(keys, oldState, newState);
    });
  },

  addWatch: function (watcher) {
    this.watchers.push(watcher);
  },

  removeWatch: function (watcher) {
    this.watchers = this.watchers.filter(function (w) {
      return w !== watcher;
    });
  },

  mount: function (flux) {
    this.flux = flux;

    this.watchers = [];
    this._resetState();
    this._configureActions();
  },

  toJS: function (val) {
    return mori.clj_to_js(val);
  },

  //state
  getInitialState: function () {
    return {};
  },

  get: function (keys) {
    if (typeof keys === 'string') {
      return mori.get(this.state, keys);
    }
    return mori.get_in(this.state, keys);
  },

  getAsJS: function (keys) {
    return mori.clj_to_js(this.get(keys));
  },

  set: function (keys, value) {
    var newState, oldState;
    var arrKeys = toArray(keys);
    if (typeof value === 'function') {
      oldState = this.state;
      newState = mori.update_in(this.state, arrKeys, value);
    }
    else {
      oldState = this.state;
      newState = mori.assoc_in(this.state, arrKeys, value);
    }
    this._updateState(newState);
    this._notify(keys, oldState, newState);
  },

  setFromJS: function (keys, value) {
    this.set(keys, mori.js_to_clj(value));
  },

  undo: function () {
    var oldState =  this.state;
    if (mori.count(this.states) > 1) {
      this.states = mori.pop(this.states);
      this.state = mori.peek(this.states);
    }
    this._notify('*', oldState, this.state);
  },

  replaceState: function (state) {
    this.state = mori.js_to_clj(state);
    this.states = mori.vector(this.state);
  }
});

Store.extend = function (ChildFn, ChildProto) {
  util.inherits(ChildFn, Store);
  if (ChildProto) {
    ChildFn.prototype = extend(ChildFn.prototype, ChildProto);
  }
  //TODO: iterate over specific FN names
  Object.keys(mori).forEach(function (fnName) {
    ChildFn.prototype['$'+fnName] = mori[fnName];
  });
  return ChildFn;
};


module.exports = Store;

},{"./convertName":6,"lodash-node/modern/objects/assign":57,"mori":64,"util":68}],6:[function(_dereq_,module,exports){
module.exports = function (name) {
  name = name.toLowerCase();
  name = name.replace(/_(\w{1})/g, function (match, letter, word) {
    return letter.toUpperCase();
  });
  return name;
};

},{}],7:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, Promise$_CreatePromiseArray, PromiseArray) {

var SomePromiseArray = _dereq_("./some_promise_array.js")(PromiseArray);
function Promise$_Any(promises, useBound) {
    var ret = Promise$_CreatePromiseArray(
        promises,
        SomePromiseArray,
        useBound === true && promises._isBound()
            ? promises._boundTo
            : void 0
   );
    var promise = ret.promise();
    if (promise.isRejected()) {
        return promise;
    }
    ret.setHowMany(1);
    ret.setUnwrap();
    ret.init();
    return promise;
}

Promise.any = function Promise$Any(promises) {
    return Promise$_Any(promises, false);
};

Promise.prototype.any = function Promise$any() {
    return Promise$_Any(this, true);
};

};

},{"./some_promise_array.js":39}],8:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var schedule = _dereq_("./schedule.js");
var Queue = _dereq_("./queue.js");
var errorObj = _dereq_("./util.js").errorObj;
var tryCatch1 = _dereq_("./util.js").tryCatch1;
var process = _dereq_("./global.js").process;

function Async() {
    this._isTickUsed = false;
    this._length = 0;
    this._lateBuffer = new Queue();
    this._functionBuffer = new Queue(25000 * 3);
    var self = this;
    this.consumeFunctionBuffer = function Async$consumeFunctionBuffer() {
        self._consumeFunctionBuffer();
    };
}

Async.prototype.haveItemsQueued = function Async$haveItemsQueued() {
    return this._length > 0;
};

Async.prototype.invokeLater = function Async$invokeLater(fn, receiver, arg) {
    if (process !== void 0 &&
        process.domain != null &&
        !fn.domain) {
        fn = process.domain.bind(fn);
    }
    this._lateBuffer.push(fn, receiver, arg);
    this._queueTick();
};

Async.prototype.invoke = function Async$invoke(fn, receiver, arg) {
    if (process !== void 0 &&
        process.domain != null &&
        !fn.domain) {
        fn = process.domain.bind(fn);
    }
    var functionBuffer = this._functionBuffer;
    functionBuffer.push(fn, receiver, arg);
    this._length = functionBuffer.length();
    this._queueTick();
};

Async.prototype._consumeFunctionBuffer =
function Async$_consumeFunctionBuffer() {
    var functionBuffer = this._functionBuffer;
    while(functionBuffer.length() > 0) {
        var fn = functionBuffer.shift();
        var receiver = functionBuffer.shift();
        var arg = functionBuffer.shift();
        fn.call(receiver, arg);
    }
    this._reset();
    this._consumeLateBuffer();
};

Async.prototype._consumeLateBuffer = function Async$_consumeLateBuffer() {
    var buffer = this._lateBuffer;
    while(buffer.length() > 0) {
        var fn = buffer.shift();
        var receiver = buffer.shift();
        var arg = buffer.shift();
        var res = tryCatch1(fn, receiver, arg);
        if (res === errorObj) {
            this._queueTick();
            if (fn.domain != null) {
                fn.domain.emit("error", res.e);
            }
            else {
                throw res.e;
            }
        }
    }
};

Async.prototype._queueTick = function Async$_queue() {
    if (!this._isTickUsed) {
        schedule(this.consumeFunctionBuffer);
        this._isTickUsed = true;
    }
};

Async.prototype._reset = function Async$_reset() {
    this._isTickUsed = false;
    this._length = 0;
};

module.exports = new Async();

},{"./global.js":21,"./queue.js":32,"./schedule.js":35,"./util.js":43}],9:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var Promise = _dereq_("./promise.js")();
module.exports = Promise;
},{"./promise.js":25}],10:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
Promise.prototype.call = function Promise$call(propertyName) {
    var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}

    return this._then(function(obj) {
            return obj[propertyName].apply(obj, args);
        },
        void 0,
        void 0,
        void 0,
        void 0
   );
};

function Promise$getter(obj) {
    var prop = typeof this === "string"
        ? this
        : ("" + this);
    return obj[prop];
}
Promise.prototype.get = function Promise$get(propertyName) {
    return this._then(
        Promise$getter,
        void 0,
        void 0,
        propertyName,
        void 0
   );
};
};

},{}],11:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var errors = _dereq_("./errors.js");
var async = _dereq_("./async.js");
var CancellationError = errors.CancellationError;

Promise.prototype._cancel = function Promise$_cancel() {
    if (!this.isCancellable()) return this;
    var parent;
    var promiseToReject = this;
    while ((parent = promiseToReject._cancellationParent) !== void 0 &&
        parent.isCancellable()) {
        promiseToReject = parent;
    }
    var err = new CancellationError();
    promiseToReject._attachExtraTrace(err);
    promiseToReject._rejectUnchecked(err);
};

Promise.prototype.cancel = function Promise$cancel() {
    if (!this.isCancellable()) return this;
    async.invokeLater(this._cancel, this, void 0);
    return this;
};

Promise.prototype.cancellable = function Promise$cancellable() {
    if (this._cancellable()) return this;
    this._setCancellable();
    this._cancellationParent = void 0;
    return this;
};

Promise.prototype.uncancellable = function Promise$uncancellable() {
    var ret = new Promise(INTERNAL);
    ret._setTrace(this);
    ret._follow(this);
    ret._unsetCancellable();
    if (this._isBound()) ret._setBoundTo(this._boundTo);
    return ret;
};

Promise.prototype.fork =
function Promise$fork(didFulfill, didReject, didProgress) {
    var ret = this._then(didFulfill, didReject, didProgress,
                         void 0, void 0);

    ret._setCancellable();
    ret._cancellationParent = void 0;
    return ret;
};
};

},{"./async.js":8,"./errors.js":15}],12:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function() {
var inherits = _dereq_("./util.js").inherits;
var defineProperty = _dereq_("./es5.js").defineProperty;

var rignore = new RegExp(
    "\\b(?:[a-zA-Z0-9.]+\\$_\\w+|" +
    "tryCatch(?:1|2|Apply)|new \\w*PromiseArray|" +
    "\\w*PromiseArray\\.\\w*PromiseArray|" +
    "setTimeout|CatchFilter\\$_\\w+|makeNodePromisified|processImmediate|" +
    "process._tickCallback|nextTick|Async\\$\\w+)\\b"
);

var rtraceline = null;
var formatStack = null;

function formatNonError(obj) {
    var str;
    if (typeof obj === "function") {
        str = "[function " +
            (obj.name || "anonymous") +
            "]";
    }
    else {
        str = obj.toString();
        var ruselessToString = /\[object [a-zA-Z0-9$_]+\]/;
        if (ruselessToString.test(str)) {
            try {
                var newStr = JSON.stringify(obj);
                str = newStr;
            }
            catch(e) {

            }
        }
        if (str.length === 0) {
            str = "(empty array)";
        }
    }
    return ("(<" + snip(str) + ">, no stack trace)");
}

function snip(str) {
    var maxChars = 41;
    if (str.length < maxChars) {
        return str;
    }
    return str.substr(0, maxChars - 3) + "...";
}

function CapturedTrace(ignoreUntil, isTopLevel) {
    this.captureStackTrace(CapturedTrace, isTopLevel);

}
inherits(CapturedTrace, Error);

CapturedTrace.prototype.captureStackTrace =
function CapturedTrace$captureStackTrace(ignoreUntil, isTopLevel) {
    captureStackTrace(this, ignoreUntil, isTopLevel);
};

CapturedTrace.possiblyUnhandledRejection =
function CapturedTrace$PossiblyUnhandledRejection(reason) {
    if (typeof console === "object") {
        var message;
        if (typeof reason === "object" || typeof reason === "function") {
            var stack = reason.stack;
            message = "Possibly unhandled " + formatStack(stack, reason);
        }
        else {
            message = "Possibly unhandled " + String(reason);
        }
        if (typeof console.error === "function" ||
            typeof console.error === "object") {
            console.error(message);
        }
        else if (typeof console.log === "function" ||
            typeof console.log === "object") {
            console.log(message);
        }
    }
};

CapturedTrace.combine = function CapturedTrace$Combine(current, prev) {
    var curLast = current.length - 1;
    for (var i = prev.length - 1; i >= 0; --i) {
        var line = prev[i];
        if (current[curLast] === line) {
            current.pop();
            curLast--;
        }
        else {
            break;
        }
    }

    current.push("From previous event:");
    var lines = current.concat(prev);

    var ret = [];

    for (var i = 0, len = lines.length; i < len; ++i) {

        if ((rignore.test(lines[i]) ||
            (i > 0 && !rtraceline.test(lines[i])) &&
            lines[i] !== "From previous event:")
       ) {
            continue;
        }
        ret.push(lines[i]);
    }
    return ret;
};

CapturedTrace.isSupported = function CapturedTrace$IsSupported() {
    return typeof captureStackTrace === "function";
};

var captureStackTrace = (function stackDetection() {
    if (typeof Error.stackTraceLimit === "number" &&
        typeof Error.captureStackTrace === "function") {
        rtraceline = /^\s*at\s*/;
        formatStack = function(stack, error) {
            if (typeof stack === "string") return stack;

            if (error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);


        };
        var captureStackTrace = Error.captureStackTrace;
        return function CapturedTrace$_captureStackTrace(
            receiver, ignoreUntil) {
            captureStackTrace(receiver, ignoreUntil);
        };
    }
    var err = new Error();

    if (typeof err.stack === "string" &&
        typeof "".startsWith === "function" &&
        (err.stack.startsWith("stackDetection@")) &&
        stackDetection.name === "stackDetection") {

        defineProperty(Error, "stackTraceLimit", {
            writable: true,
            enumerable: false,
            configurable: false,
            value: 25
        });
        rtraceline = /@/;
        var rline = /[@\n]/;

        formatStack = function(stack, error) {
            if (typeof stack === "string") {
                return (error.name + ". " + error.message + "\n" + stack);
            }

            if (error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);
        };

        return function captureStackTrace(o) {
            var stack = new Error().stack;
            var split = stack.split(rline);
            var len = split.length;
            var ret = "";
            for (var i = 0; i < len; i += 2) {
                ret += split[i];
                ret += "@";
                ret += split[i + 1];
                ret += "\n";
            }
            o.stack = ret;
        };
    }
    else {
        formatStack = function(stack, error) {
            if (typeof stack === "string") return stack;

            if ((typeof error === "object" ||
                typeof error === "function") &&
                error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);
        };

        return null;
    }
})();

return CapturedTrace;
};

},{"./es5.js":17,"./util.js":43}],13:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(NEXT_FILTER) {
var util = _dereq_("./util.js");
var errors = _dereq_("./errors.js");
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;
var keys = _dereq_("./es5.js").keys;
var TypeError = errors.TypeError;

function CatchFilter(instances, callback, promise) {
    this._instances = instances;
    this._callback = callback;
    this._promise = promise;
}

function CatchFilter$_safePredicate(predicate, e) {
    var safeObject = {};
    var retfilter = tryCatch1(predicate, safeObject, e);

    if (retfilter === errorObj) return retfilter;

    var safeKeys = keys(safeObject);
    if (safeKeys.length) {
        errorObj.e = new TypeError(
            "Catch filter must inherit from Error "
          + "or be a simple predicate function");
        return errorObj;
    }
    return retfilter;
}

CatchFilter.prototype.doFilter = function CatchFilter$_doFilter(e) {
    var cb = this._callback;
    var promise = this._promise;
    var boundTo = promise._isBound() ? promise._boundTo : void 0;
    for (var i = 0, len = this._instances.length; i < len; ++i) {
        var item = this._instances[i];
        var itemIsErrorType = item === Error ||
            (item != null && item.prototype instanceof Error);

        if (itemIsErrorType && e instanceof item) {
            var ret = tryCatch1(cb, boundTo, e);
            if (ret === errorObj) {
                NEXT_FILTER.e = ret.e;
                return NEXT_FILTER;
            }
            return ret;
        } else if (typeof item === "function" && !itemIsErrorType) {
            var shouldHandle = CatchFilter$_safePredicate(item, e);
            if (shouldHandle === errorObj) {
                var trace = errors.canAttach(errorObj.e)
                    ? errorObj.e
                    : new Error(errorObj.e + "");
                this._promise._attachExtraTrace(trace);
                e = errorObj.e;
                break;
            } else if (shouldHandle) {
                var ret = tryCatch1(cb, boundTo, e);
                if (ret === errorObj) {
                    NEXT_FILTER.e = ret.e;
                    return NEXT_FILTER;
                }
                return ret;
            }
        }
    }
    NEXT_FILTER.e = e;
    return NEXT_FILTER;
};

return CatchFilter;
};

},{"./errors.js":15,"./es5.js":17,"./util.js":43}],14:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var util = _dereq_("./util.js");
var isPrimitive = util.isPrimitive;
var wrapsPrimitiveReceiver = util.wrapsPrimitiveReceiver;

module.exports = function(Promise) {
var returner = function Promise$_returner() {
    return this;
};
var thrower = function Promise$_thrower() {
    throw this;
};

var wrapper = function Promise$_wrapper(value, action) {
    if (action === 1) {
        return function Promise$_thrower() {
            throw value;
        };
    }
    else if (action === 2) {
        return function Promise$_returner() {
            return value;
        };
    }
};


Promise.prototype["return"] =
Promise.prototype.thenReturn =
function Promise$thenReturn(value) {
    if (wrapsPrimitiveReceiver && isPrimitive(value)) {
        return this._then(
            wrapper(value, 2),
            void 0,
            void 0,
            void 0,
            void 0
       );
    }
    return this._then(returner, void 0, void 0, value, void 0);
};

Promise.prototype["throw"] =
Promise.prototype.thenThrow =
function Promise$thenThrow(reason) {
    if (wrapsPrimitiveReceiver && isPrimitive(reason)) {
        return this._then(
            wrapper(reason, 1),
            void 0,
            void 0,
            void 0,
            void 0
       );
    }
    return this._then(thrower, void 0, void 0, reason, void 0);
};
};

},{"./util.js":43}],15:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var global = _dereq_("./global.js");
var Objectfreeze = _dereq_("./es5.js").freeze;
var util = _dereq_("./util.js");
var inherits = util.inherits;
var notEnumerableProp = util.notEnumerableProp;
var Error = global.Error;

function markAsOriginatingFromRejection(e) {
    try {
        notEnumerableProp(e, "isAsync", true);
    }
    catch(ignore) {}
}

function originatesFromRejection(e) {
    if (e == null) return false;
    return ((e instanceof RejectionError) ||
        e["isAsync"] === true);
}

function isError(obj) {
    return obj instanceof Error;
}

function canAttach(obj) {
    return isError(obj);
}

function subError(nameProperty, defaultMessage) {
    function SubError(message) {
        if (!(this instanceof SubError)) return new SubError(message);
        this.message = typeof message === "string" ? message : defaultMessage;
        this.name = nameProperty;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    inherits(SubError, Error);
    return SubError;
}

var TypeError = global.TypeError;
if (typeof TypeError !== "function") {
    TypeError = subError("TypeError", "type error");
}
var RangeError = global.RangeError;
if (typeof RangeError !== "function") {
    RangeError = subError("RangeError", "range error");
}
var CancellationError = subError("CancellationError", "cancellation error");
var TimeoutError = subError("TimeoutError", "timeout error");

function RejectionError(message) {
    this.name = "RejectionError";
    this.message = message;
    this.cause = message;
    this.isAsync = true;

    if (message instanceof Error) {
        this.message = message.message;
        this.stack = message.stack;
    }
    else if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }

}
inherits(RejectionError, Error);

var key = "__BluebirdErrorTypes__";
var errorTypes = global[key];
if (!errorTypes) {
    errorTypes = Objectfreeze({
        CancellationError: CancellationError,
        TimeoutError: TimeoutError,
        RejectionError: RejectionError
    });
    notEnumerableProp(global, key, errorTypes);
}

module.exports = {
    Error: Error,
    TypeError: TypeError,
    RangeError: RangeError,
    CancellationError: errorTypes.CancellationError,
    RejectionError: errorTypes.RejectionError,
    TimeoutError: errorTypes.TimeoutError,
    originatesFromRejection: originatesFromRejection,
    markAsOriginatingFromRejection: markAsOriginatingFromRejection,
    canAttach: canAttach
};

},{"./es5.js":17,"./global.js":21,"./util.js":43}],16:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var TypeError = _dereq_('./errors.js').TypeError;

function apiRejection(msg) {
    var error = new TypeError(msg);
    var ret = Promise.rejected(error);
    var parent = ret._peekContext();
    if (parent != null) {
        parent._attachExtraTrace(error);
    }
    return ret;
}

return apiRejection;
};

},{"./errors.js":15}],17:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
var isES5 = (function(){
    "use strict";
    return this === void 0;
})();

if (isES5) {
    module.exports = {
        freeze: Object.freeze,
        defineProperty: Object.defineProperty,
        keys: Object.keys,
        getPrototypeOf: Object.getPrototypeOf,
        isArray: Array.isArray,
        isES5: isES5
    };
}

else {
    var has = {}.hasOwnProperty;
    var str = {}.toString;
    var proto = {}.constructor.prototype;

    var ObjectKeys = function ObjectKeys(o) {
        var ret = [];
        for (var key in o) {
            if (has.call(o, key)) {
                ret.push(key);
            }
        }
        return ret;
    }

    var ObjectDefineProperty = function ObjectDefineProperty(o, key, desc) {
        o[key] = desc.value;
        return o;
    }

    var ObjectFreeze = function ObjectFreeze(obj) {
        return obj;
    }

    var ObjectGetPrototypeOf = function ObjectGetPrototypeOf(obj) {
        try {
            return Object(obj).constructor.prototype;
        }
        catch (e) {
            return proto;
        }
    }

    var ArrayIsArray = function ArrayIsArray(obj) {
        try {
            return str.call(obj) === "[object Array]";
        }
        catch(e) {
            return false;
        }
    }

    module.exports = {
        isArray: ArrayIsArray,
        keys: ObjectKeys,
        defineProperty: ObjectDefineProperty,
        freeze: ObjectFreeze,
        getPrototypeOf: ObjectGetPrototypeOf,
        isES5: isES5
    };
}

},{}],18:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var isArray = _dereq_("./util.js").isArray;

function Promise$_filter(booleans) {
    var values = this instanceof Promise ? this._settledValue : this;
    var len = values.length;
    var ret = new Array(len);
    var j = 0;

    for (var i = 0; i < len; ++i) {
        if (booleans[i]) ret[j++] = values[i];

    }
    ret.length = j;
    return ret;
}

var ref = {ref: null};
Promise.filter = function Promise$Filter(promises, fn) {
    return Promise.map(promises, fn, ref)
                  ._then(Promise$_filter, void 0, void 0, ref.ref, void 0);
};

Promise.prototype.filter = function Promise$filter(fn) {
    return this.map(fn, ref)
               ._then(Promise$_filter, void 0, void 0, ref.ref, void 0);
};
};

},{"./util.js":43}],19:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, NEXT_FILTER) {
var util = _dereq_("./util.js");
var wrapsPrimitiveReceiver = util.wrapsPrimitiveReceiver;
var isPrimitive = util.isPrimitive;
var thrower = util.thrower;


function returnThis() {
    return this;
}
function throwThis() {
    throw this;
}
function return$(r) {
    return function Promise$_returner() {
        return r;
    };
}
function throw$(r) {
    return function Promise$_thrower() {
        throw r;
    };
}
function promisedFinally(ret, reasonOrValue, isFulfilled) {
    var then;
    if (wrapsPrimitiveReceiver && isPrimitive(reasonOrValue)) {
        then = isFulfilled ? return$(reasonOrValue) : throw$(reasonOrValue);
    }
    else {
        then = isFulfilled ? returnThis : throwThis;
    }
    return ret._then(then, thrower, void 0, reasonOrValue, void 0);
}

function finallyHandler(reasonOrValue) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundTo)
                    : handler();

    if (ret !== void 0) {
        var maybePromise = Promise._cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            return promisedFinally(maybePromise, reasonOrValue,
                                    promise.isFulfilled());
        }
    }

    if (promise.isRejected()) {
        NEXT_FILTER.e = reasonOrValue;
        return NEXT_FILTER;
    }
    else {
        return reasonOrValue;
    }
}

function tapHandler(value) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundTo, value)
                    : handler(value);

    if (ret !== void 0) {
        var maybePromise = Promise._cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            return promisedFinally(maybePromise, value, true);
        }
    }
    return value;
}

Promise.prototype._passThroughHandler =
function Promise$_passThroughHandler(handler, isFinally) {
    if (typeof handler !== "function") return this.then();

    var promiseAndHandler = {
        promise: this,
        handler: handler
    };

    return this._then(
            isFinally ? finallyHandler : tapHandler,
            isFinally ? finallyHandler : void 0, void 0,
            promiseAndHandler, void 0);
};

Promise.prototype.lastly =
Promise.prototype["finally"] = function Promise$finally(handler) {
    return this._passThroughHandler(handler, true);
};

Promise.prototype.tap = function Promise$tap(handler) {
    return this._passThroughHandler(handler, false);
};
};

},{"./util.js":43}],20:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, apiRejection, INTERNAL) {
var PromiseSpawn = _dereq_("./promise_spawn.js")(Promise, INTERNAL);
var errors = _dereq_("./errors.js");
var TypeError = errors.TypeError;
var deprecated = _dereq_("./util.js").deprecated;

Promise.coroutine = function Promise$Coroutine(generatorFunction) {
    if (typeof generatorFunction !== "function") {
        throw new TypeError("generatorFunction must be a function");
    }
    var PromiseSpawn$ = PromiseSpawn;
    return function () {
        var generator = generatorFunction.apply(this, arguments);
        var spawn = new PromiseSpawn$(void 0, void 0);
        spawn._generator = generator;
        spawn._next(void 0);
        return spawn.promise();
    };
};

Promise.coroutine.addYieldHandler = PromiseSpawn.addYieldHandler;

Promise.spawn = function Promise$Spawn(generatorFunction) {
    deprecated("Promise.spawn is deprecated. Use Promise.coroutine instead.");
    if (typeof generatorFunction !== "function") {
        return apiRejection("generatorFunction must be a function");
    }
    var spawn = new PromiseSpawn(generatorFunction, this);
    var ret = spawn.promise();
    spawn._run(Promise.spawn);
    return ret;
};
};

},{"./errors.js":15,"./promise_spawn.js":28,"./util.js":43}],21:[function(_dereq_,module,exports){
(function (global){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
module.exports = (function() {
    if (this !== void 0) return this;
    try {return global;}
    catch(e) {}
    try {return window;}
    catch(e) {}
    try {return self;}
    catch(e) {}
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],22:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray, INTERNAL, apiRejection) {

var all = Promise.all;
var util = _dereq_("./util.js");
var canAttach = _dereq_("./errors.js").canAttach;
var isArray = util.isArray;
var _cast = Promise._cast;

function unpack(values) {
    return Promise$_Map(values, this[0], this[1], this[2]);
}

function Promise$_Map(promises, fn, useBound, ref) {
    if (typeof fn !== "function") {
        return apiRejection("fn must be a function");
    }

    var receiver = void 0;
    if (useBound === true) {
        if (promises._isBound()) {
            receiver = promises._boundTo;
        }
    }
    else if (useBound !== false) {
        receiver = useBound;
    }

    var shouldUnwrapItems = ref !== void 0;
    if (shouldUnwrapItems) ref.ref = promises;

    if (promises instanceof Promise) {
        var pack = [fn, receiver, ref];
        return promises._then(unpack, void 0, void 0, pack, void 0);
    }
    else if (!isArray(promises)) {
        return apiRejection("expecting an array, a promise or a thenable");
    }

    var promise = new Promise(INTERNAL);
    if (receiver !== void 0) promise._setBoundTo(receiver);
    promise._setTrace(void 0);

    var mapping = new Mapping(promise,
                                fn,
                                promises,
                                receiver,
                                shouldUnwrapItems);
    mapping.init();
    return promise;
}

var pending = {};
function Mapping(promise, callback, items, receiver, shouldUnwrapItems) {
    this.shouldUnwrapItems = shouldUnwrapItems;
    this.index = 0;
    this.items = items;
    this.callback = callback;
    this.receiver = receiver;
    this.promise = promise;
    this.result = new Array(items.length);
}
util.inherits(Mapping, PromiseArray);

Mapping.prototype.init = function Mapping$init() {
    var items = this.items;
    var len = items.length;
    var result = this.result;
    var isRejected = false;
    for (var i = 0; i < len; ++i) {
        var maybePromise = _cast(items[i], void 0);
        if (maybePromise instanceof Promise) {
            if (maybePromise.isPending()) {
                result[i] = pending;
                maybePromise._proxyPromiseArray(this, i);
            }
            else if (maybePromise.isFulfilled()) {
                result[i] = maybePromise.value();
            }
            else {
                maybePromise._unsetRejectionIsUnhandled();
                if (!isRejected) {
                    this.reject(maybePromise.reason());
                    isRejected = true;
                }
            }
        }
        else {
            result[i] = maybePromise;
        }
    }
    if (!isRejected) this.iterate();
};

Mapping.prototype.isResolved = function Mapping$isResolved() {
    return this.promise === null;
};

Mapping.prototype._promiseProgressed =
function Mapping$_promiseProgressed(value) {
    if (this.isResolved()) return;
    this.promise._progress(value);
};

Mapping.prototype._promiseFulfilled =
function Mapping$_promiseFulfilled(value, index) {
    if (this.isResolved()) return;
    this.result[index] = value;
    if (this.shouldUnwrapItems) this.items[index] = value;
    if (this.index === index) this.iterate();
};

Mapping.prototype._promiseRejected =
function Mapping$_promiseRejected(reason) {
    this.reject(reason);
};

Mapping.prototype.reject = function Mapping$reject(reason) {
    if (this.isResolved()) return;
    var trace = canAttach(reason) ? reason : new Error(reason + "");
    this.promise._attachExtraTrace(trace);
    this.promise._reject(reason, trace);
};

Mapping.prototype.iterate = function Mapping$iterate() {
    var i = this.index;
    var items = this.items;
    var result = this.result;
    var len = items.length;
    var result = this.result;
    var receiver = this.receiver;
    var callback = this.callback;

    for (; i < len; ++i) {
        var value = result[i];
        if (value === pending) {
            this.index = i;
            return;
        }
        try { result[i] = callback.call(receiver, value, i, len); }
        catch (e) { return this.reject(e); }
    }
    this.promise._follow(all(result));
    this.items = this.result = this.callback = this.promise = null;
};

Promise.prototype.map = function Promise$map(fn, ref) {
    return Promise$_Map(this, fn, true, ref);
};

Promise.map = function Promise$Map(promises, fn, ref) {
    return Promise$_Map(promises, fn, false, ref);
};
};

},{"./errors.js":15,"./util.js":43}],23:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var util = _dereq_("./util.js");
var async = _dereq_("./async.js");
var tryCatch2 = util.tryCatch2;
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;

function thrower(r) {
    throw r;
}

function Promise$_successAdapter(val, receiver) {
    var nodeback = this;
    var ret = val === void 0
        ? tryCatch1(nodeback, receiver, null)
        : tryCatch2(nodeback, receiver, null, val);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}
function Promise$_errorAdapter(reason, receiver) {
    var nodeback = this;
    var ret = tryCatch1(nodeback, receiver, reason);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}

Promise.prototype.nodeify = function Promise$nodeify(nodeback) {
    if (typeof nodeback == "function") {
        this._then(
            Promise$_successAdapter,
            Promise$_errorAdapter,
            void 0,
            nodeback,
            this._isBound() ? this._boundTo : null
        );
    }
    return this;
};
};

},{"./async.js":8,"./util.js":43}],24:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, isPromiseArrayProxy) {
var util = _dereq_("./util.js");
var async = _dereq_("./async.js");
var errors = _dereq_("./errors.js");
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;

Promise.prototype.progressed = function Promise$progressed(handler) {
    return this._then(void 0, void 0, handler, void 0, void 0);
};

Promise.prototype._progress = function Promise$_progress(progressValue) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._progressUnchecked(progressValue);

};

Promise.prototype._progressHandlerAt =
function Promise$_progressHandlerAt(index) {
    if (index === 0) return this._progressHandler0;
    return this[index + 2 - 5];
};

Promise.prototype._doProgressWith =
function Promise$_doProgressWith(progression) {
    var progressValue = progression.value;
    var handler = progression.handler;
    var promise = progression.promise;
    var receiver = progression.receiver;

    this._pushContext();
    var ret = tryCatch1(handler, receiver, progressValue);
    this._popContext();

    if (ret === errorObj) {
        if (ret.e != null &&
            ret.e.name !== "StopProgressPropagation") {
            var trace = errors.canAttach(ret.e)
                ? ret.e : new Error(ret.e + "");
            promise._attachExtraTrace(trace);
            promise._progress(ret.e);
        }
    }
    else if (ret instanceof Promise) {
        ret._then(promise._progress, null, null, promise, void 0);
    }
    else {
        promise._progress(ret);
    }
};


Promise.prototype._progressUnchecked =
function Promise$_progressUnchecked(progressValue) {
    if (!this.isPending()) return;
    var len = this._length();
    var progress = this._progress;
    for (var i = 0; i < len; i += 5) {
        var handler = this._progressHandlerAt(i);
        var promise = this._promiseAt(i);
        if (!(promise instanceof Promise)) {
            var receiver = this._receiverAt(i);
            if (typeof handler === "function") {
                handler.call(receiver, progressValue, promise);
            }
            else if (receiver instanceof Promise && receiver._isProxied()) {
                receiver._progressUnchecked(progressValue);
            }
            else if (isPromiseArrayProxy(receiver, promise)) {
                receiver._promiseProgressed(progressValue, promise);
            }
            continue;
        }

        if (typeof handler === "function") {
            async.invoke(this._doProgressWith, this, {
                handler: handler,
                promise: promise,
                receiver: this._receiverAt(i),
                value: progressValue
            });
        }
        else {
            async.invoke(progress, promise, progressValue);
        }
    }
};
};

},{"./async.js":8,"./errors.js":15,"./util.js":43}],25:[function(_dereq_,module,exports){
(function (process){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function() {
var global = _dereq_("./global.js");
var util = _dereq_("./util.js");
var async = _dereq_("./async.js");
var errors = _dereq_("./errors.js");

var INTERNAL = function(){};
var APPLY = {};
var NEXT_FILTER = {e: null};

var PromiseArray = _dereq_("./promise_array.js")(Promise, INTERNAL);
var CapturedTrace = _dereq_("./captured_trace.js")();
var CatchFilter = _dereq_("./catch_filter.js")(NEXT_FILTER);
var PromiseResolver = _dereq_("./promise_resolver.js");

var isArray = util.isArray;

var errorObj = util.errorObj;
var tryCatch1 = util.tryCatch1;
var tryCatch2 = util.tryCatch2;
var tryCatchApply = util.tryCatchApply;
var RangeError = errors.RangeError;
var TypeError = errors.TypeError;
var CancellationError = errors.CancellationError;
var TimeoutError = errors.TimeoutError;
var RejectionError = errors.RejectionError;
var originatesFromRejection = errors.originatesFromRejection;
var markAsOriginatingFromRejection = errors.markAsOriginatingFromRejection;
var canAttach = errors.canAttach;
var thrower = util.thrower;
var apiRejection = _dereq_("./errors_api_rejection")(Promise);


var makeSelfResolutionError = function Promise$_makeSelfResolutionError() {
    return new TypeError("circular promise resolution chain");
};

function isPromise(obj) {
    if (obj === void 0) return false;
    return obj instanceof Promise;
}

function isPromiseArrayProxy(receiver, promiseSlotValue) {
    if (receiver instanceof PromiseArray) {
        return promiseSlotValue >= 0;
    }
    return false;
}

function Promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("the promise constructor requires a resolver function");
    }
    if (this.constructor !== Promise) {
        throw new TypeError("the promise constructor cannot be invoked directly");
    }
    this._bitField = 0;
    this._fulfillmentHandler0 = void 0;
    this._rejectionHandler0 = void 0;
    this._promise0 = void 0;
    this._receiver0 = void 0;
    this._settledValue = void 0;
    this._boundTo = void 0;
    if (resolver !== INTERNAL) this._resolveFromResolver(resolver);
}

Promise.prototype.bind = function Promise$bind(thisArg) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(this);
    ret._follow(this);
    ret._setBoundTo(thisArg);
    if (this._cancellable()) {
        ret._setCancellable();
        ret._cancellationParent = this;
    }
    return ret;
};

Promise.prototype.toString = function Promise$toString() {
    return "[object Promise]";
};

Promise.prototype.caught = Promise.prototype["catch"] =
function Promise$catch(fn) {
    var len = arguments.length;
    if (len > 1) {
        var catchInstances = new Array(len - 1),
            j = 0, i;
        for (i = 0; i < len - 1; ++i) {
            var item = arguments[i];
            if (typeof item === "function") {
                catchInstances[j++] = item;
            }
            else {
                var catchFilterTypeError =
                    new TypeError(
                        "A catch filter must be an error constructor "
                        + "or a filter function");

                this._attachExtraTrace(catchFilterTypeError);
                async.invoke(this._reject, this, catchFilterTypeError);
                return;
            }
        }
        catchInstances.length = j;
        fn = arguments[i];

        this._resetTrace();
        var catchFilter = new CatchFilter(catchInstances, fn, this);
        return this._then(void 0, catchFilter.doFilter, void 0,
            catchFilter, void 0);
    }
    return this._then(void 0, fn, void 0, void 0, void 0);
};

Promise.prototype.then =
function Promise$then(didFulfill, didReject, didProgress) {
    return this._then(didFulfill, didReject, didProgress,
        void 0, void 0);
};


Promise.prototype.done =
function Promise$done(didFulfill, didReject, didProgress) {
    var promise = this._then(didFulfill, didReject, didProgress,
        void 0, void 0);
    promise._setIsFinal();
};

Promise.prototype.spread = function Promise$spread(didFulfill, didReject) {
    return this._then(didFulfill, didReject, void 0,
        APPLY, void 0);
};

Promise.prototype.isCancellable = function Promise$isCancellable() {
    return !this.isResolved() &&
        this._cancellable();
};

Promise.prototype.toJSON = function Promise$toJSON() {
    var ret = {
        isFulfilled: false,
        isRejected: false,
        fulfillmentValue: void 0,
        rejectionReason: void 0
    };
    if (this.isFulfilled()) {
        ret.fulfillmentValue = this._settledValue;
        ret.isFulfilled = true;
    }
    else if (this.isRejected()) {
        ret.rejectionReason = this._settledValue;
        ret.isRejected = true;
    }
    return ret;
};

Promise.prototype.all = function Promise$all() {
    return Promise$_all(this, true);
};


Promise.is = isPromise;

function Promise$_all(promises, useBound) {
    return Promise$_CreatePromiseArray(
        promises,
        PromiseArray,
        useBound === true && promises._isBound()
            ? promises._boundTo
            : void 0
   ).promise();
}
Promise.all = function Promise$All(promises) {
    return Promise$_all(promises, false);
};

Promise.join = function Promise$Join() {
    var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
    return Promise$_CreatePromiseArray(args, PromiseArray, void 0).promise();
};

Promise.resolve = Promise.fulfilled =
function Promise$Resolve(value) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    if (ret._tryFollow(value)) {
        return ret;
    }
    ret._cleanValues();
    ret._setFulfilled();
    ret._settledValue = value;
    return ret;
};

Promise.reject = Promise.rejected = function Promise$Reject(reason) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    markAsOriginatingFromRejection(reason);
    ret._cleanValues();
    ret._setRejected();
    ret._settledValue = reason;
    if (!canAttach(reason)) {
        var trace = new Error(reason + "");
        ret._setCarriedStackTrace(trace);
    }
    ret._ensurePossibleRejectionHandled();
    return ret;
};

Promise.prototype.error = function Promise$_error(fn) {
    return this.caught(originatesFromRejection, fn);
};

Promise.prototype._resolveFromSyncValue =
function Promise$_resolveFromSyncValue(value) {
    if (value === errorObj) {
        this._cleanValues();
        this._setRejected();
        this._settledValue = value.e;
        this._ensurePossibleRejectionHandled();
    }
    else {
        var maybePromise = Promise._cast(value, void 0);
        if (maybePromise instanceof Promise) {
            this._follow(maybePromise);
        }
        else {
            this._cleanValues();
            this._setFulfilled();
            this._settledValue = value;
        }
    }
};

Promise.method = function Promise$_Method(fn) {
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function");
    }
    return function Promise$_method() {
        var value;
        switch(arguments.length) {
        case 0: value = tryCatch1(fn, this, void 0); break;
        case 1: value = tryCatch1(fn, this, arguments[0]); break;
        case 2: value = tryCatch2(fn, this, arguments[0], arguments[1]); break;
        default:
            var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
            value = tryCatchApply(fn, args, this); break;
        }
        var ret = new Promise(INTERNAL);
        ret._setTrace(void 0);
        ret._resolveFromSyncValue(value);
        return ret;
    };
};

Promise.attempt = Promise["try"] = function Promise$_Try(fn, args, ctx) {
    if (typeof fn !== "function") {
        return apiRejection("fn must be a function");
    }
    var value = isArray(args)
        ? tryCatchApply(fn, args, ctx)
        : tryCatch1(fn, ctx, args);

    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    ret._resolveFromSyncValue(value);
    return ret;
};

Promise.defer = Promise.pending = function Promise$Defer() {
    var promise = new Promise(INTERNAL);
    promise._setTrace(void 0);
    return new PromiseResolver(promise);
};

Promise.bind = function Promise$Bind(thisArg) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    ret._setFulfilled();
    ret._setBoundTo(thisArg);
    return ret;
};

Promise.cast = function Promise$_Cast(obj) {
    var ret = Promise._cast(obj, void 0);
    if (!(ret instanceof Promise)) {
        return Promise.resolve(ret);
    }
    return ret;
};

Promise.onPossiblyUnhandledRejection =
function Promise$OnPossiblyUnhandledRejection(fn) {
        CapturedTrace.possiblyUnhandledRejection = typeof fn === "function"
                                                    ? fn : void 0;
};

var unhandledRejectionHandled;
Promise.onUnhandledRejectionHandled =
function Promise$onUnhandledRejectionHandled(fn) {
    unhandledRejectionHandled = typeof fn === "function" ? fn : void 0;
};

var debugging = false || !!(
    typeof process !== "undefined" &&
    typeof process.execPath === "string" &&
    typeof process.env === "object" &&
    (process.env["BLUEBIRD_DEBUG"] ||
        process.env["NODE_ENV"] === "development")
);


Promise.longStackTraces = function Promise$LongStackTraces() {
    if (async.haveItemsQueued() &&
        debugging === false
   ) {
        throw new Error("cannot enable long stack traces after promises have been created");
    }
    debugging = CapturedTrace.isSupported();
};

Promise.hasLongStackTraces = function Promise$HasLongStackTraces() {
    return debugging && CapturedTrace.isSupported();
};

Promise.prototype._setProxyHandlers =
function Promise$_setProxyHandlers(receiver, promiseSlotValue) {
    var index = this._length();

    if (index >= 524287 - 5) {
        index = 0;
        this._setLength(0);
    }
    if (index === 0) {
        this._promise0 = promiseSlotValue;
        this._receiver0 = receiver;
    }
    else {
        var i = index - 5;
        this[i + 3] = promiseSlotValue;
        this[i + 4] = receiver;
        this[i + 0] =
        this[i + 1] =
        this[i + 2] = void 0;
    }
    this._setLength(index + 5);
};

Promise.prototype._proxyPromiseArray =
function Promise$_proxyPromiseArray(promiseArray, index) {
    this._setProxyHandlers(promiseArray, index);
};

Promise.prototype._proxyPromise = function Promise$_proxyPromise(promise) {
    promise._setProxied();
    this._setProxyHandlers(promise, -1);
};

Promise.prototype._then =
function Promise$_then(
    didFulfill,
    didReject,
    didProgress,
    receiver,
    internalData
) {
    var haveInternalData = internalData !== void 0;
    var ret = haveInternalData ? internalData : new Promise(INTERNAL);

    if (debugging && !haveInternalData) {
        var haveSameContext = this._peekContext() === this._traceParent;
        ret._traceParent = haveSameContext ? this._traceParent : this;
        ret._setTrace(this);
    }

    if (!haveInternalData && this._isBound()) {
        ret._setBoundTo(this._boundTo);
    }

    var callbackIndex =
        this._addCallbacks(didFulfill, didReject, didProgress, ret, receiver);

    if (!haveInternalData && this._cancellable()) {
        ret._setCancellable();
        ret._cancellationParent = this;
    }

    if (this.isResolved()) {
        async.invoke(this._queueSettleAt, this, callbackIndex);
    }

    return ret;
};

Promise.prototype._length = function Promise$_length() {
    return this._bitField & 524287;
};

Promise.prototype._isFollowingOrFulfilledOrRejected =
function Promise$_isFollowingOrFulfilledOrRejected() {
    return (this._bitField & 939524096) > 0;
};

Promise.prototype._isFollowing = function Promise$_isFollowing() {
    return (this._bitField & 536870912) === 536870912;
};

Promise.prototype._setLength = function Promise$_setLength(len) {
    this._bitField = (this._bitField & -524288) |
        (len & 524287);
};

Promise.prototype._setFulfilled = function Promise$_setFulfilled() {
    this._bitField = this._bitField | 268435456;
};

Promise.prototype._setRejected = function Promise$_setRejected() {
    this._bitField = this._bitField | 134217728;
};

Promise.prototype._setFollowing = function Promise$_setFollowing() {
    this._bitField = this._bitField | 536870912;
};

Promise.prototype._setIsFinal = function Promise$_setIsFinal() {
    this._bitField = this._bitField | 33554432;
};

Promise.prototype._isFinal = function Promise$_isFinal() {
    return (this._bitField & 33554432) > 0;
};

Promise.prototype._cancellable = function Promise$_cancellable() {
    return (this._bitField & 67108864) > 0;
};

Promise.prototype._setCancellable = function Promise$_setCancellable() {
    this._bitField = this._bitField | 67108864;
};

Promise.prototype._unsetCancellable = function Promise$_unsetCancellable() {
    this._bitField = this._bitField & (~67108864);
};

Promise.prototype._setRejectionIsUnhandled =
function Promise$_setRejectionIsUnhandled() {
    this._bitField = this._bitField | 2097152;
};

Promise.prototype._unsetRejectionIsUnhandled =
function Promise$_unsetRejectionIsUnhandled() {
    this._bitField = this._bitField & (~2097152);
    if (this._isUnhandledRejectionNotified()) {
        this._unsetUnhandledRejectionIsNotified();
        this._notifyUnhandledRejectionIsHandled();
    }
};

Promise.prototype._isRejectionUnhandled =
function Promise$_isRejectionUnhandled() {
    return (this._bitField & 2097152) > 0;
};

Promise.prototype._setUnhandledRejectionIsNotified =
function Promise$_setUnhandledRejectionIsNotified() {
    this._bitField = this._bitField | 524288;
};

Promise.prototype._unsetUnhandledRejectionIsNotified =
function Promise$_unsetUnhandledRejectionIsNotified() {
    this._bitField = this._bitField & (~524288);
};

Promise.prototype._isUnhandledRejectionNotified =
function Promise$_isUnhandledRejectionNotified() {
    return (this._bitField & 524288) > 0;
};

Promise.prototype._setCarriedStackTrace =
function Promise$_setCarriedStackTrace(capturedTrace) {
    this._bitField = this._bitField | 1048576;
    this._fulfillmentHandler0 = capturedTrace;
};

Promise.prototype._unsetCarriedStackTrace =
function Promise$_unsetCarriedStackTrace() {
    this._bitField = this._bitField & (~1048576);
    this._fulfillmentHandler0 = void 0;
};

Promise.prototype._isCarryingStackTrace =
function Promise$_isCarryingStackTrace() {
    return (this._bitField & 1048576) > 0;
};

Promise.prototype._getCarriedStackTrace =
function Promise$_getCarriedStackTrace() {
    return this._isCarryingStackTrace()
        ? this._fulfillmentHandler0
        : void 0;
};

Promise.prototype._receiverAt = function Promise$_receiverAt(index) {
    var ret;
    if (index === 0) {
        ret = this._receiver0;
    }
    else {
        ret = this[index + 4 - 5];
    }
    if (this._isBound() && ret === void 0) {
        return this._boundTo;
    }
    return ret;
};

Promise.prototype._promiseAt = function Promise$_promiseAt(index) {
    if (index === 0) return this._promise0;
    return this[index + 3 - 5];
};

Promise.prototype._fulfillmentHandlerAt =
function Promise$_fulfillmentHandlerAt(index) {
    if (index === 0) return this._fulfillmentHandler0;
    return this[index + 0 - 5];
};

Promise.prototype._rejectionHandlerAt =
function Promise$_rejectionHandlerAt(index) {
    if (index === 0) return this._rejectionHandler0;
    return this[index + 1 - 5];
};

Promise.prototype._unsetAt = function Promise$_unsetAt(index) {
     if (index === 0) {
        this._rejectionHandler0 =
        this._progressHandler0 =
        this._promise0 =
        this._receiver0 = void 0;
        if (!this._isCarryingStackTrace()) {
            this._fulfillmentHandler0 = void 0;
        }
    }
    else {
        this[index - 5 + 0] =
        this[index - 5 + 1] =
        this[index - 5 + 2] =
        this[index - 5 + 3] =
        this[index - 5 + 4] = void 0;
    }
};

Promise.prototype._resolveFromResolver =
function Promise$_resolveFromResolver(resolver) {
    var promise = this;
    this._setTrace(void 0);
    this._pushContext();

    function Promise$_resolver(val) {
        if (promise._tryFollow(val)) {
            return;
        }
        promise._fulfill(val);
    }
    function Promise$_rejecter(val) {
        var trace = canAttach(val) ? val : new Error(val + "");
        promise._attachExtraTrace(trace);
        markAsOriginatingFromRejection(val);
        promise._reject(val, trace === val ? void 0 : trace);
    }
    var r = tryCatch2(resolver, void 0, Promise$_resolver, Promise$_rejecter);
    this._popContext();

    if (r !== void 0 && r === errorObj) {
        var e = r.e;
        var trace = canAttach(e) ? e : new Error(e + "");
        promise._reject(e, trace);
    }
};

Promise.prototype._addCallbacks = function Promise$_addCallbacks(
    fulfill,
    reject,
    progress,
    promise,
    receiver
) {
    var index = this._length();

    if (index >= 524287 - 5) {
        index = 0;
        this._setLength(0);
    }

    if (index === 0) {
        this._promise0 = promise;
        if (receiver !== void 0) this._receiver0 = receiver;
        if (typeof fulfill === "function" && !this._isCarryingStackTrace())
            this._fulfillmentHandler0 = fulfill;
        if (typeof reject === "function") this._rejectionHandler0 = reject;
        if (typeof progress === "function") this._progressHandler0 = progress;
    }
    else {
        var i = index - 5;
        this[i + 3] = promise;
        this[i + 4] = receiver;
        this[i + 0] = typeof fulfill === "function"
                                            ? fulfill : void 0;
        this[i + 1] = typeof reject === "function"
                                            ? reject : void 0;
        this[i + 2] = typeof progress === "function"
                                            ? progress : void 0;
    }
    this._setLength(index + 5);
    return index;
};



Promise.prototype._setBoundTo = function Promise$_setBoundTo(obj) {
    if (obj !== void 0) {
        this._bitField = this._bitField | 8388608;
        this._boundTo = obj;
    }
    else {
        this._bitField = this._bitField & (~8388608);
    }
};

Promise.prototype._isBound = function Promise$_isBound() {
    return (this._bitField & 8388608) === 8388608;
};

Promise.prototype._spreadSlowCase =
function Promise$_spreadSlowCase(targetFn, promise, values, boundTo) {
    var promiseForAll =
            Promise$_CreatePromiseArray
                (values, PromiseArray, boundTo)
            .promise()
            ._then(function() {
                return targetFn.apply(boundTo, arguments);
            }, void 0, void 0, APPLY, void 0);

    promise._follow(promiseForAll);
};

Promise.prototype._callSpread =
function Promise$_callSpread(handler, promise, value, localDebugging) {
    var boundTo = this._isBound() ? this._boundTo : void 0;
    if (isArray(value)) {
        for (var i = 0, len = value.length; i < len; ++i) {
            if (isPromise(Promise._cast(value[i], void 0))) {
                this._spreadSlowCase(handler, promise, value, boundTo);
                return;
            }
        }
    }
    if (localDebugging) promise._pushContext();
    return tryCatchApply(handler, value, boundTo);
};

Promise.prototype._callHandler =
function Promise$_callHandler(
    handler, receiver, promise, value, localDebugging) {
    var x;
    if (receiver === APPLY && !this.isRejected()) {
        x = this._callSpread(handler, promise, value, localDebugging);
    }
    else {
        if (localDebugging) promise._pushContext();
        x = tryCatch1(handler, receiver, value);
    }
    if (localDebugging) promise._popContext();
    return x;
};

Promise.prototype._settlePromiseFromHandler =
function Promise$_settlePromiseFromHandler(
    handler, receiver, value, promise
) {
    if (!isPromise(promise)) {
        handler.call(receiver, value, promise);
        return;
    }

    var localDebugging = debugging;
    var x = this._callHandler(handler, receiver,
                                promise, value, localDebugging);

    if (promise._isFollowing()) return;

    if (x === errorObj || x === promise || x === NEXT_FILTER) {
        var err = x === promise
                    ? makeSelfResolutionError()
                    : x.e;
        var trace = canAttach(err) ? err : new Error(err + "");
        if (x !== NEXT_FILTER) promise._attachExtraTrace(trace);
        promise._rejectUnchecked(err, trace);
    }
    else {
        var castValue = Promise._cast(x, promise);
        if (isPromise(castValue)) {
            if (castValue.isRejected() &&
                !castValue._isCarryingStackTrace() &&
                !canAttach(castValue._settledValue)) {
                var trace = new Error(castValue._settledValue + "");
                promise._attachExtraTrace(trace);
                castValue._setCarriedStackTrace(trace);
            }
            promise._follow(castValue);
            if (castValue._cancellable()) {
                promise._cancellationParent = castValue;
                promise._setCancellable();
            }
        }
        else {
            promise._fulfillUnchecked(x);
        }
    }
};

Promise.prototype._follow =
function Promise$_follow(promise) {
    this._setFollowing();

    if (promise.isPending()) {
        if (promise._cancellable() ) {
            this._cancellationParent = promise;
            this._setCancellable();
        }
        promise._proxyPromise(this);
    }
    else if (promise.isFulfilled()) {
        this._fulfillUnchecked(promise._settledValue);
    }
    else {
        this._rejectUnchecked(promise._settledValue,
            promise._getCarriedStackTrace());
    }

    if (promise._isRejectionUnhandled()) promise._unsetRejectionIsUnhandled();

    if (debugging &&
        promise._traceParent == null) {
        promise._traceParent = this;
    }
};

Promise.prototype._tryFollow =
function Promise$_tryFollow(value) {
    if (this._isFollowingOrFulfilledOrRejected() ||
        value === this) {
        return false;
    }
    var maybePromise = Promise._cast(value, void 0);
    if (!isPromise(maybePromise)) {
        return false;
    }
    this._follow(maybePromise);
    return true;
};

Promise.prototype._resetTrace = function Promise$_resetTrace() {
    if (debugging) {
        this._trace = new CapturedTrace(this._peekContext() === void 0);
    }
};

Promise.prototype._setTrace = function Promise$_setTrace(parent) {
    if (debugging) {
        var context = this._peekContext();
        this._traceParent = context;
        var isTopLevel = context === void 0;
        if (parent !== void 0 &&
            parent._traceParent === context) {
            this._trace = parent._trace;
        }
        else {
            this._trace = new CapturedTrace(isTopLevel);
        }
    }
    return this;
};

Promise.prototype._attachExtraTrace =
function Promise$_attachExtraTrace(error) {
    if (debugging) {
        var promise = this;
        var stack = error.stack;
        stack = typeof stack === "string"
            ? stack.split("\n") : [];
        var headerLineCount = 1;

        while(promise != null &&
            promise._trace != null) {
            stack = CapturedTrace.combine(
                stack,
                promise._trace.stack.split("\n")
           );
            promise = promise._traceParent;
        }

        var max = Error.stackTraceLimit + headerLineCount;
        var len = stack.length;
        if (len  > max) {
            stack.length = max;
        }
        if (stack.length <= headerLineCount) {
            error.stack = "(No stack trace)";
        }
        else {
            error.stack = stack.join("\n");
        }
    }
};

Promise.prototype._cleanValues = function Promise$_cleanValues() {
    if (this._cancellable()) {
        this._cancellationParent = void 0;
    }
};

Promise.prototype._fulfill = function Promise$_fulfill(value) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._fulfillUnchecked(value);
};

Promise.prototype._reject =
function Promise$_reject(reason, carriedStackTrace) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._rejectUnchecked(reason, carriedStackTrace);
};

Promise.prototype._settlePromiseAt = function Promise$_settlePromiseAt(index) {
    var handler = this.isFulfilled()
        ? this._fulfillmentHandlerAt(index)
        : this._rejectionHandlerAt(index);

    var value = this._settledValue;
    var receiver = this._receiverAt(index);
    var promise = this._promiseAt(index);

    if (typeof handler === "function") {
        this._settlePromiseFromHandler(handler, receiver, value, promise);
    }
    else {
        var done = false;
        var isFulfilled = this.isFulfilled();
        if (receiver !== void 0) {
            if (receiver instanceof Promise &&
                receiver._isProxied()) {
                receiver._unsetProxied();

                if (isFulfilled) receiver._fulfillUnchecked(value);
                else receiver._rejectUnchecked(value,
                    this._getCarriedStackTrace());
                done = true;
            }
            else if (isPromiseArrayProxy(receiver, promise)) {
                if (isFulfilled) receiver._promiseFulfilled(value, promise);
                else receiver._promiseRejected(value, promise);
                done = true;
            }
        }

        if (!done) {
            if (isFulfilled) promise._fulfill(value);
            else promise._reject(value, this._getCarriedStackTrace());
        }
    }

    if (index >= 256) {
        this._queueGC();
    }
};

Promise.prototype._isProxied = function Promise$_isProxied() {
    return (this._bitField & 4194304) === 4194304;
};

Promise.prototype._setProxied = function Promise$_setProxied() {
    this._bitField = this._bitField | 4194304;
};

Promise.prototype._unsetProxied = function Promise$_unsetProxied() {
    this._bitField = this._bitField & (~4194304);
};

Promise.prototype._isGcQueued = function Promise$_isGcQueued() {
    return (this._bitField & -1073741824) === -1073741824;
};

Promise.prototype._setGcQueued = function Promise$_setGcQueued() {
    this._bitField = this._bitField | -1073741824;
};

Promise.prototype._unsetGcQueued = function Promise$_unsetGcQueued() {
    this._bitField = this._bitField & (~-1073741824);
};

Promise.prototype._queueGC = function Promise$_queueGC() {
    if (this._isGcQueued()) return;
    this._setGcQueued();
    async.invokeLater(this._gc, this, void 0);
};

Promise.prototype._gc = function Promise$gc() {
    var len = this._length();
    this._unsetAt(0);
    for (var i = 0; i < len; i++) {
        delete this[i];
    }
    this._setLength(0);
    this._unsetGcQueued();
};

Promise.prototype._queueSettleAt = function Promise$_queueSettleAt(index) {
    if (this._isRejectionUnhandled()) this._unsetRejectionIsUnhandled();
    async.invoke(this._settlePromiseAt, this, index);
};

Promise.prototype._fulfillUnchecked =
function Promise$_fulfillUnchecked(value) {
    if (!this.isPending()) return;
    if (value === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err, void 0);
    }
    this._cleanValues();
    this._setFulfilled();
    this._settledValue = value;
    var len = this._length();

    if (len > 0) {
        async.invoke(this._settlePromises, this, len);
    }
};

Promise.prototype._rejectUncheckedCheckError =
function Promise$_rejectUncheckedCheckError(reason) {
    var trace = canAttach(reason) ? reason : new Error(reason + "");
    this._rejectUnchecked(reason, trace === reason ? void 0 : trace);
};

Promise.prototype._rejectUnchecked =
function Promise$_rejectUnchecked(reason, trace) {
    if (!this.isPending()) return;
    if (reason === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err);
    }
    this._cleanValues();
    this._setRejected();
    this._settledValue = reason;

    if (this._isFinal()) {
        async.invokeLater(thrower, void 0, trace === void 0 ? reason : trace);
        return;
    }
    var len = this._length();

    if (trace !== void 0) this._setCarriedStackTrace(trace);

    if (len > 0) {
        async.invoke(this._rejectPromises, this, null);
    }
    else {
        this._ensurePossibleRejectionHandled();
    }
};

Promise.prototype._rejectPromises = function Promise$_rejectPromises() {
    this._settlePromises();
    this._unsetCarriedStackTrace();
};

Promise.prototype._settlePromises = function Promise$_settlePromises() {
    var len = this._length();
    for (var i = 0; i < len; i+= 5) {
        this._settlePromiseAt(i);
    }
};

Promise.prototype._ensurePossibleRejectionHandled =
function Promise$_ensurePossibleRejectionHandled() {
    this._setRejectionIsUnhandled();
    if (CapturedTrace.possiblyUnhandledRejection !== void 0) {
        async.invokeLater(this._notifyUnhandledRejection, this, void 0);
    }
};

Promise.prototype._notifyUnhandledRejectionIsHandled =
function Promise$_notifyUnhandledRejectionIsHandled() {
    if (typeof unhandledRejectionHandled === "function") {
        async.invokeLater(unhandledRejectionHandled, void 0, this);
    }
};

Promise.prototype._notifyUnhandledRejection =
function Promise$_notifyUnhandledRejection() {
    if (this._isRejectionUnhandled()) {
        var reason = this._settledValue;
        var trace = this._getCarriedStackTrace();

        this._setUnhandledRejectionIsNotified();

        if (trace !== void 0) {
            this._unsetCarriedStackTrace();
            reason = trace;
        }
        if (typeof CapturedTrace.possiblyUnhandledRejection === "function") {
            CapturedTrace.possiblyUnhandledRejection(reason, this);
        }
    }
};

var contextStack = [];
Promise.prototype._peekContext = function Promise$_peekContext() {
    var lastIndex = contextStack.length - 1;
    if (lastIndex >= 0) {
        return contextStack[lastIndex];
    }
    return void 0;

};

Promise.prototype._pushContext = function Promise$_pushContext() {
    if (!debugging) return;
    contextStack.push(this);
};

Promise.prototype._popContext = function Promise$_popContext() {
    if (!debugging) return;
    contextStack.pop();
};

function Promise$_CreatePromiseArray(
    promises, PromiseArrayConstructor, boundTo) {

    var list = null;
    if (isArray(promises)) {
        list = promises;
    }
    else {
        list = Promise._cast(promises, void 0);
        if (list !== promises) {
            list._setBoundTo(boundTo);
        }
        else if (!isPromise(list)) {
            list = null;
        }
    }
    if (list !== null) {
        return new PromiseArrayConstructor(list, boundTo);
    }
    return {
        promise: function() {return apiRejection("expecting an array, a promise or a thenable");}
    };
}

var old = global.Promise;
Promise.noConflict = function() {
    if (global.Promise === Promise) {
        global.Promise = old;
    }
    return Promise;
};

if (!CapturedTrace.isSupported()) {
    Promise.longStackTraces = function(){};
    debugging = false;
}

Promise._makeSelfResolutionError = makeSelfResolutionError;
_dereq_("./finally.js")(Promise, NEXT_FILTER);
_dereq_("./direct_resolve.js")(Promise);
_dereq_("./thenables.js")(Promise, INTERNAL);
_dereq_("./synchronous_inspection.js")(Promise);
Promise.RangeError = RangeError;
Promise.CancellationError = CancellationError;
Promise.TimeoutError = TimeoutError;
Promise.TypeError = TypeError;
Promise.RejectionError = RejectionError;

util.toFastProperties(Promise);
util.toFastProperties(Promise.prototype);
_dereq_('./timers.js')(Promise,INTERNAL);
_dereq_('./any.js')(Promise,Promise$_CreatePromiseArray,PromiseArray);
_dereq_('./race.js')(Promise,INTERNAL);
_dereq_('./call_get.js')(Promise);
_dereq_('./filter.js')(Promise,Promise$_CreatePromiseArray,PromiseArray,apiRejection);
_dereq_('./generators.js')(Promise,apiRejection,INTERNAL);
_dereq_('./map.js')(Promise,PromiseArray,INTERNAL,apiRejection);
_dereq_('./nodeify.js')(Promise);
_dereq_('./promisify.js')(Promise,INTERNAL);
_dereq_('./props.js')(Promise,PromiseArray);
_dereq_('./reduce.js')(Promise,Promise$_CreatePromiseArray,PromiseArray,apiRejection,INTERNAL);
_dereq_('./settle.js')(Promise,Promise$_CreatePromiseArray,PromiseArray);
_dereq_('./some.js')(Promise,Promise$_CreatePromiseArray,PromiseArray,apiRejection);
_dereq_('./progress.js')(Promise,isPromiseArrayProxy);
_dereq_('./cancel.js')(Promise,INTERNAL);

Promise.prototype = Promise.prototype;
return Promise;

};

}).call(this,_dereq_("UPikzY"))
},{"./any.js":7,"./async.js":8,"./call_get.js":10,"./cancel.js":11,"./captured_trace.js":12,"./catch_filter.js":13,"./direct_resolve.js":14,"./errors.js":15,"./errors_api_rejection":16,"./filter.js":18,"./finally.js":19,"./generators.js":20,"./global.js":21,"./map.js":22,"./nodeify.js":23,"./progress.js":24,"./promise_array.js":26,"./promise_resolver.js":27,"./promisify.js":29,"./props.js":31,"./race.js":33,"./reduce.js":34,"./settle.js":36,"./some.js":38,"./synchronous_inspection.js":40,"./thenables.js":41,"./timers.js":42,"./util.js":43,"UPikzY":66}],26:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var canAttach = _dereq_("./errors.js").canAttach;
var util = _dereq_("./util.js");
var async = _dereq_("./async.js");
var hasOwn = {}.hasOwnProperty;
var isArray = util.isArray;

function toResolutionValue(val) {
    switch(val) {
    case -1: return void 0;
    case -2: return [];
    case -3: return {};
    }
}

function PromiseArray(values, boundTo) {
    var promise = this._promise = new Promise(INTERNAL);
    var parent = void 0;
    if (values instanceof Promise) {
        parent = values;
        if (values._cancellable()) {
            promise._setCancellable();
            promise._cancellationParent = values;
        }
        if (values._isBound()) {
            promise._setBoundTo(boundTo);
        }
    }
    promise._setTrace(parent);
    this._values = values;
    this._length = 0;
    this._totalResolved = 0;
    this._init(void 0, -2);
}
PromiseArray.PropertiesPromiseArray = function() {};

PromiseArray.prototype.length = function PromiseArray$length() {
    return this._length;
};

PromiseArray.prototype.promise = function PromiseArray$promise() {
    return this._promise;
};

PromiseArray.prototype._init =
function PromiseArray$_init(_, resolveValueIfEmpty) {
    var values = this._values;
    if (values instanceof Promise) {
        if (values.isFulfilled()) {
            values = values._settledValue;
            if (!isArray(values)) {
                var err = new Promise.TypeError("expecting an array, a promise or a thenable");
                this.__hardReject__(err);
                return;
            }
            this._values = values;
        }
        else if (values.isPending()) {
            values._then(
                this._init,
                this._reject,
                void 0,
                this,
                resolveValueIfEmpty
           );
            return;
        }
        else {
            values._unsetRejectionIsUnhandled();
            this._reject(values._settledValue);
            return;
        }
    }

    if (values.length === 0) {
        this._resolve(toResolutionValue(resolveValueIfEmpty));
        return;
    }
    var len = values.length;
    var newLen = len;
    var newValues;
    if (this instanceof PromiseArray.PropertiesPromiseArray) {
        newValues = this._values;
    }
    else {
        newValues = new Array(len);
    }
    var isDirectScanNeeded = false;
    for (var i = 0; i < len; ++i) {
        var promise = values[i];
        if (promise === void 0 && !hasOwn.call(values, i)) {
            newLen--;
            continue;
        }
        var maybePromise = Promise._cast(promise, void 0);
        if (maybePromise instanceof Promise) {
            if (maybePromise.isPending()) {
                maybePromise._proxyPromiseArray(this, i);
            }
            else {
                maybePromise._unsetRejectionIsUnhandled();
                isDirectScanNeeded = true;
            }
        }
        else {
            isDirectScanNeeded = true;
        }
        newValues[i] = maybePromise;
    }
    if (newLen === 0) {
        if (resolveValueIfEmpty === -2) {
            this._resolve(newValues);
        }
        else {
            this._resolve(toResolutionValue(resolveValueIfEmpty));
        }
        return;
    }
    this._values = newValues;
    this._length = newLen;
    if (isDirectScanNeeded) {
        var scanMethod = newLen === len
            ? this._scanDirectValues
            : this._scanDirectValuesHoled;
        async.invoke(scanMethod, this, len);
    }
};

PromiseArray.prototype._settlePromiseAt =
function PromiseArray$_settlePromiseAt(index) {
    var value = this._values[index];
    if (!(value instanceof Promise)) {
        this._promiseFulfilled(value, index);
    }
    else if (value.isFulfilled()) {
        this._promiseFulfilled(value._settledValue, index);
    }
    else if (value.isRejected()) {
        this._promiseRejected(value._settledValue, index);
    }
};

PromiseArray.prototype._scanDirectValuesHoled =
function PromiseArray$_scanDirectValuesHoled(len) {
    for (var i = 0; i < len; ++i) {
        if (this._isResolved()) {
            break;
        }
        if (hasOwn.call(this._values, i)) {
            this._settlePromiseAt(i);
        }
    }
};

PromiseArray.prototype._scanDirectValues =
function PromiseArray$_scanDirectValues(len) {
    for (var i = 0; i < len; ++i) {
        if (this._isResolved()) {
            break;
        }
        this._settlePromiseAt(i);
    }
};

PromiseArray.prototype._isResolved = function PromiseArray$_isResolved() {
    return this._values === null;
};

PromiseArray.prototype._resolve = function PromiseArray$_resolve(value) {
    this._values = null;
    this._promise._fulfill(value);
};

PromiseArray.prototype.__hardReject__ =
PromiseArray.prototype._reject = function PromiseArray$_reject(reason) {
    this._values = null;
    var trace = canAttach(reason) ? reason : new Error(reason + "");
    this._promise._attachExtraTrace(trace);
    this._promise._reject(reason, trace);
};

PromiseArray.prototype._promiseProgressed =
function PromiseArray$_promiseProgressed(progressValue, index) {
    if (this._isResolved()) return;
    this._promise._progress({
        index: index,
        value: progressValue
    });
};


PromiseArray.prototype._promiseFulfilled =
function PromiseArray$_promiseFulfilled(value, index) {
    if (this._isResolved()) return;
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

PromiseArray.prototype._promiseRejected =
function PromiseArray$_promiseRejected(reason, index) {
    if (this._isResolved()) return;
    this._totalResolved++;
    this._reject(reason);
};

return PromiseArray;
};

},{"./async.js":8,"./errors.js":15,"./util.js":43}],27:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var util = _dereq_("./util.js");
var maybeWrapAsError = util.maybeWrapAsError;
var errors = _dereq_("./errors.js");
var TimeoutError = errors.TimeoutError;
var RejectionError = errors.RejectionError;
var async = _dereq_("./async.js");
var haveGetters = util.haveGetters;
var es5 = _dereq_("./es5.js");

function isUntypedError(obj) {
    return obj instanceof Error &&
        es5.getPrototypeOf(obj) === Error.prototype;
}

function wrapAsRejectionError(obj) {
    var ret;
    if (isUntypedError(obj)) {
        ret = new RejectionError(obj);
    }
    else {
        ret = obj;
    }
    errors.markAsOriginatingFromRejection(ret);
    return ret;
}

function nodebackForPromise(promise) {
    function PromiseResolver$_callback(err, value) {
        if (promise === null) return;

        if (err) {
            var wrapped = wrapAsRejectionError(maybeWrapAsError(err));
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        }
        else {
            if (arguments.length > 2) {
                var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}
                promise._fulfill(args);
            }
            else {
                promise._fulfill(value);
            }
        }

        promise = null;
    }
    return PromiseResolver$_callback;
}


var PromiseResolver;
if (!haveGetters) {
    PromiseResolver = function PromiseResolver(promise) {
        this.promise = promise;
        this.asCallback = nodebackForPromise(promise);
        this.callback = this.asCallback;
    };
}
else {
    PromiseResolver = function PromiseResolver(promise) {
        this.promise = promise;
    };
}
if (haveGetters) {
    var prop = {
        get: function() {
            return nodebackForPromise(this.promise);
        }
    };
    es5.defineProperty(PromiseResolver.prototype, "asCallback", prop);
    es5.defineProperty(PromiseResolver.prototype, "callback", prop);
}

PromiseResolver._nodebackForPromise = nodebackForPromise;

PromiseResolver.prototype.toString = function PromiseResolver$toString() {
    return "[object PromiseResolver]";
};

PromiseResolver.prototype.resolve =
PromiseResolver.prototype.fulfill = function PromiseResolver$resolve(value) {
    var promise = this.promise;
    if ((promise === void 0) || (promise._tryFollow === void 0)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }
    if (promise._tryFollow(value)) {
        return;
    }
    async.invoke(promise._fulfill, promise, value);
};

PromiseResolver.prototype.reject = function PromiseResolver$reject(reason) {
    var promise = this.promise;
    if ((promise === void 0) || (promise._attachExtraTrace === void 0)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }
    errors.markAsOriginatingFromRejection(reason);
    var trace = errors.canAttach(reason) ? reason : new Error(reason + "");
    promise._attachExtraTrace(trace);
    async.invoke(promise._reject, promise, reason);
    if (trace !== reason) {
        async.invoke(this._setCarriedStackTrace, this, trace);
    }
};

PromiseResolver.prototype.progress =
function PromiseResolver$progress(value) {
    async.invoke(this.promise._progress, this.promise, value);
};

PromiseResolver.prototype.cancel = function PromiseResolver$cancel() {
    async.invoke(this.promise.cancel, this.promise, void 0);
};

PromiseResolver.prototype.timeout = function PromiseResolver$timeout() {
    this.reject(new TimeoutError("timeout"));
};

PromiseResolver.prototype.isResolved = function PromiseResolver$isResolved() {
    return this.promise.isResolved();
};

PromiseResolver.prototype.toJSON = function PromiseResolver$toJSON() {
    return this.promise.toJSON();
};

PromiseResolver.prototype._setCarriedStackTrace =
function PromiseResolver$_setCarriedStackTrace(trace) {
    if (this.promise.isRejected()) {
        this.promise._setCarriedStackTrace(trace);
    }
};

module.exports = PromiseResolver;

},{"./async.js":8,"./errors.js":15,"./es5.js":17,"./util.js":43}],28:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var errors = _dereq_("./errors.js");
var TypeError = errors.TypeError;
var util = _dereq_("./util.js");
var isArray = util.isArray;
var errorObj = util.errorObj;
var tryCatch1 = util.tryCatch1;
var yieldHandlers = [];

function promiseFromYieldHandler(value) {
    var _yieldHandlers = yieldHandlers;
    var _errorObj = errorObj;
    var _Promise = Promise;
    var len = _yieldHandlers.length;
    for (var i = 0; i < len; ++i) {
        var result = tryCatch1(_yieldHandlers[i], void 0, value);
        if (result === _errorObj) {
            return _Promise.reject(_errorObj.e);
        }
        var maybePromise = _Promise._cast(result,
            promiseFromYieldHandler, void 0);
        if (maybePromise instanceof _Promise) return maybePromise;
    }
    return null;
}

function PromiseSpawn(generatorFunction, receiver) {
    var promise = this._promise = new Promise(INTERNAL);
    promise._setTrace(void 0);
    this._generatorFunction = generatorFunction;
    this._receiver = receiver;
    this._generator = void 0;
}

PromiseSpawn.prototype.promise = function PromiseSpawn$promise() {
    return this._promise;
};

PromiseSpawn.prototype._run = function PromiseSpawn$_run() {
    this._generator = this._generatorFunction.call(this._receiver);
    this._receiver =
        this._generatorFunction = void 0;
    this._next(void 0);
};

PromiseSpawn.prototype._continue = function PromiseSpawn$_continue(result) {
    if (result === errorObj) {
        this._generator = void 0;
        var trace = errors.canAttach(result.e)
            ? result.e : new Error(result.e + "");
        this._promise._attachExtraTrace(trace);
        this._promise._reject(result.e, trace);
        return;
    }

    var value = result.value;
    if (result.done === true) {
        this._generator = void 0;
        if (!this._promise._tryFollow(value)) {
            this._promise._fulfill(value);
        }
    }
    else {
        var maybePromise = Promise._cast(value, PromiseSpawn$_continue, void 0);
        if (!(maybePromise instanceof Promise)) {
            if (isArray(maybePromise)) {
                maybePromise = Promise.all(maybePromise);
            }
            else {
                maybePromise = promiseFromYieldHandler(maybePromise);
            }
            if (maybePromise === null) {
                this._throw(new TypeError("A value was yielded that could not be treated as a promise"));
                return;
            }
        }
        maybePromise._then(
            this._next,
            this._throw,
            void 0,
            this,
            null
       );
    }
};

PromiseSpawn.prototype._throw = function PromiseSpawn$_throw(reason) {
    if (errors.canAttach(reason))
        this._promise._attachExtraTrace(reason);
    this._continue(
        tryCatch1(this._generator["throw"], this._generator, reason)
   );
};

PromiseSpawn.prototype._next = function PromiseSpawn$_next(value) {
    this._continue(
        tryCatch1(this._generator.next, this._generator, value)
   );
};

PromiseSpawn.addYieldHandler = function PromiseSpawn$AddYieldHandler(fn) {
    if (typeof fn !== "function") throw new TypeError("fn must be a function");
    yieldHandlers.push(fn);
};

return PromiseSpawn;
};

},{"./errors.js":15,"./util.js":43}],29:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var THIS = {};
var util = _dereq_("./util.js");
var es5 = _dereq_("./es5.js");
var nodebackForPromise = _dereq_("./promise_resolver.js")
    ._nodebackForPromise;
var withAppended = util.withAppended;
var maybeWrapAsError = util.maybeWrapAsError;
var canEvaluate = util.canEvaluate;
var deprecated = util.deprecated;
var TypeError = _dereq_("./errors").TypeError;


var rasyncSuffix = new RegExp("Async" + "$");
function isPromisified(fn) {
    return fn.__isPromisified__ === true;
}
function hasPromisified(obj, key) {
    var containsKey = ((key + "Async") in obj);
    return containsKey ? isPromisified(obj[key + "Async"])
                       : false;
}
function checkValid(ret) {
    for (var i = 0; i < ret.length; i += 2) {
        var key = ret[i];
        if (rasyncSuffix.test(key)) {
            var keyWithoutAsyncSuffix = key.replace(rasyncSuffix, "");
            for (var j = 0; j < ret.length; j += 2) {
                if (ret[j] === keyWithoutAsyncSuffix) {
                    throw new TypeError("Cannot promisify an API " +
                        "that has normal methods with Async-suffix");
                }
            }
        }
    }
}
var inheritedMethods = (function() {
    if (es5.isES5) {
        var create = Object.create;
        var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
        return function(cur) {
            var ret = [];
            var visitedKeys = create(null);
            var original = cur;
            while (cur !== null) {
                var keys = es5.keys(cur);
                for (var i = 0, len = keys.length; i < len; ++i) {
                    var key = keys[i];
                    if (visitedKeys[key]) continue;
                    visitedKeys[key] = true;
                    var desc = getOwnPropertyDescriptor(cur, key);

                    if (desc != null &&
                        typeof desc.value === "function" &&
                        !isPromisified(desc.value) &&
                        !hasPromisified(original, key)) {
                        ret.push(key, desc.value);
                    }
                }
                cur = es5.getPrototypeOf(cur);
            }
            checkValid(ret);
            return ret;
        };
    }
    else {
        return function(obj) {
            var ret = [];
            /*jshint forin:false */
            for (var key in obj) {
                var fn = obj[key];
                if (typeof fn === "function" &&
                    !isPromisified(fn) &&
                    !hasPromisified(obj, key)) {
                    ret.push(key, fn);
                }
            }
            checkValid(ret);
            return ret;
        };
    }
})();

function switchCaseArgumentOrder(likelyArgumentCount) {
    var ret = [likelyArgumentCount];
    var min = Math.max(0, likelyArgumentCount - 1 - 5);
    for(var i = likelyArgumentCount - 1; i >= min; --i) {
        if (i === likelyArgumentCount) continue;
        ret.push(i);
    }
    for(var i = likelyArgumentCount + 1; i <= 5; ++i) {
        ret.push(i);
    }
    return ret;
}

function parameterDeclaration(parameterCount) {
    var ret = new Array(parameterCount);
    for(var i = 0; i < ret.length; ++i) {
        ret[i] = "_arg" + i;
    }
    return ret.join(", ");
}

function parameterCount(fn) {
    if (typeof fn.length === "number") {
        return Math.max(Math.min(fn.length, 1023 + 1), 0);
    }
    return 0;
}

var rident = /^[a-z$_][a-z$_0-9]*$/i;
function propertyAccess(id) {
    if (rident.test(id)) {
        return "." + id;
    }
    else return "['" + id.replace(/(['\\])/g, "\\$1") + "']";
}

function makeNodePromisifiedEval(callback, receiver, originalName, fn) {
    var newParameterCount = Math.max(0, parameterCount(fn) - 1);
    var argumentOrder = switchCaseArgumentOrder(newParameterCount);

    var callbackName = (typeof originalName === "string" ?
        originalName + "Async" :
        "promisified");

    function generateCallForArgumentCount(count) {
        var args = new Array(count);
        for (var i = 0, len = args.length; i < len; ++i) {
            args[i] = "arguments[" + i + "]";
        }
        var comma = count > 0 ? "," : "";

        if (typeof callback === "string" &&
            receiver === THIS) {
            return "this" + propertyAccess(callback) + "("+args.join(",") +
                comma +" fn);"+
                "break;";
        }
        return (receiver === void 0
            ? "callback("+args.join(",")+ comma +" fn);"
            : "callback.call("+(receiver === THIS
                ? "this"
                : "receiver")+", "+args.join(",") + comma + " fn);") +
        "break;";
    }

    if (!rident.test(callbackName)) {
        callbackName = "promisified";
    }

    function generateArgumentSwitchCase() {
        var ret = "";
        for(var i = 0; i < argumentOrder.length; ++i) {
            ret += "case " + argumentOrder[i] +":" +
                generateCallForArgumentCount(argumentOrder[i]);
        }
        ret += "default: var args = new Array(len + 1);" +
            "var i = 0;" +
            "for (var i = 0; i < len; ++i) { " +
            "   args[i] = arguments[i];" +
            "}" +
            "args[i] = fn;" +

            (typeof callback === "string"
            ? "this" + propertyAccess(callback) + ".apply("
            : "callback.apply(") +

            (receiver === THIS ? "this" : "receiver") +
            ", args); break;";
        return ret;
    }

    return new Function("Promise", "callback", "receiver",
            "withAppended", "maybeWrapAsError", "nodebackForPromise",
            "INTERNAL",
        "var ret = function " + callbackName +
        "(" + parameterDeclaration(newParameterCount) + ") {\"use strict\";" +
        "var len = arguments.length;" +
        "var promise = new Promise(INTERNAL);"+
        "promise._setTrace(void 0);" +
        "var fn = nodebackForPromise(promise);"+
        "try {" +
        "switch(len) {" +
        generateArgumentSwitchCase() +
        "}" +
        "}" +
        "catch(e){ " +
        "var wrapped = maybeWrapAsError(e);" +
        "promise._attachExtraTrace(wrapped);" +
        "promise._reject(wrapped);" +
        "}" +
        "return promise;" +
        "" +
        "}; ret.__isPromisified__ = true; return ret;"
   )(Promise, callback, receiver, withAppended,
        maybeWrapAsError, nodebackForPromise, INTERNAL);
}

function makeNodePromisifiedClosure(callback, receiver) {
    function promisified() {
        var _receiver = receiver;
        if (receiver === THIS) _receiver = this;
        if (typeof callback === "string") {
            callback = _receiver[callback];
        }
        var promise = new Promise(INTERNAL);
        promise._setTrace(void 0);
        var fn = nodebackForPromise(promise);
        try {
            callback.apply(_receiver, withAppended(arguments, fn));
        }
        catch(e) {
            var wrapped = maybeWrapAsError(e);
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        }
        return promise;
    }
    promisified.__isPromisified__ = true;
    return promisified;
}

var makeNodePromisified = canEvaluate
    ? makeNodePromisifiedEval
    : makeNodePromisifiedClosure;

function _promisify(callback, receiver, isAll) {
    if (isAll) {
        var methods = inheritedMethods(callback);
        for (var i = 0, len = methods.length; i < len; i+= 2) {
            var key = methods[i];
            var fn = methods[i+1];
            var promisifiedKey = key + "Async";
            callback[promisifiedKey] = makeNodePromisified(key, THIS, key, fn);
        }
        util.toFastProperties(callback);
        return callback;
    }
    else {
        return makeNodePromisified(callback, receiver, void 0, callback);
    }
}

Promise.promisify = function Promise$Promisify(fn, receiver) {
    if (typeof fn === "object" && fn !== null) {
        deprecated("Promise.promisify for promisifying entire objects is deprecated. Use Promise.promisifyAll instead.");
        return _promisify(fn, receiver, true);
    }
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function");
    }
    if (isPromisified(fn)) {
        return fn;
    }
    return _promisify(
        fn,
        arguments.length < 2 ? THIS : receiver,
        false);
};

Promise.promisifyAll = function Promise$PromisifyAll(target) {
    if (typeof target !== "function" && typeof target !== "object") {
        throw new TypeError("the target of promisifyAll must be an object or a function");
    }
    return _promisify(target, void 0, true);
};
};


},{"./errors":15,"./es5.js":17,"./promise_resolver.js":27,"./util.js":43}],30:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray) {
var util = _dereq_("./util.js");
var inherits = util.inherits;
var es5 = _dereq_("./es5.js");

function PropertiesPromiseArray(obj, boundTo) {
    var keys = es5.keys(obj);
    var values = new Array(keys.length);
    for (var i = 0, len = values.length; i < len; ++i) {
        values[i] = obj[keys[i]];
    }
    this.constructor$(values, boundTo);
    if (!this._isResolved()) {
        for (var i = 0, len = keys.length; i < len; ++i) {
            values.push(keys[i]);
        }
    }
}
inherits(PropertiesPromiseArray, PromiseArray);

PropertiesPromiseArray.prototype._init =
function PropertiesPromiseArray$_init() {
    this._init$(void 0, -3) ;
};

PropertiesPromiseArray.prototype._promiseFulfilled =
function PropertiesPromiseArray$_promiseFulfilled(value, index) {
    if (this._isResolved()) return;
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        var val = {};
        var keyOffset = this.length();
        for (var i = 0, len = this.length(); i < len; ++i) {
            val[this._values[i + keyOffset]] = this._values[i];
        }
        this._resolve(val);
    }
};

PropertiesPromiseArray.prototype._promiseProgressed =
function PropertiesPromiseArray$_promiseProgressed(value, index) {
    if (this._isResolved()) return;

    this._promise._progress({
        key: this._values[index + this.length()],
        value: value
    });
};

PromiseArray.PropertiesPromiseArray = PropertiesPromiseArray;

return PropertiesPromiseArray;
};

},{"./es5.js":17,"./util.js":43}],31:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray) {
var PropertiesPromiseArray = _dereq_("./properties_promise_array.js")(
    Promise, PromiseArray);
var util = _dereq_("./util.js");
var apiRejection = _dereq_("./errors_api_rejection")(Promise);
var isObject = util.isObject;

function Promise$_Props(promises, useBound) {
    var ret;
    var castValue = Promise._cast(promises, void 0);

    if (!isObject(castValue)) {
        return apiRejection("cannot await properties of a non-object");
    }
    else if (castValue instanceof Promise) {
        ret = castValue._then(Promise.props, void 0, void 0,
                        void 0, void 0);
    }
    else {
        ret = new PropertiesPromiseArray(
            castValue,
            useBound === true && castValue._isBound()
                        ? castValue._boundTo
                        : void 0
       ).promise();
        useBound = false;
    }
    if (useBound === true && castValue._isBound()) {
        ret._setBoundTo(castValue._boundTo);
    }
    return ret;
}

Promise.prototype.props = function Promise$props() {
    return Promise$_Props(this, true);
};

Promise.props = function Promise$Props(promises) {
    return Promise$_Props(promises, false);
};
};

},{"./errors_api_rejection":16,"./properties_promise_array.js":30,"./util.js":43}],32:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
function arrayCopy(src, srcIndex, dst, dstIndex, len) {
    for (var j = 0; j < len; ++j) {
        dst[j + dstIndex] = src[j + srcIndex];
    }
}

function pow2AtLeast(n) {
    n = n >>> 0;
    n = n - 1;
    n = n | (n >> 1);
    n = n | (n >> 2);
    n = n | (n >> 4);
    n = n | (n >> 8);
    n = n | (n >> 16);
    return n + 1;
}

function getCapacity(capacity) {
    if (typeof capacity !== "number") return 16;
    return pow2AtLeast(
        Math.min(
            Math.max(16, capacity), 1073741824)
   );
}

function Queue(capacity) {
    this._capacity = getCapacity(capacity);
    this._length = 0;
    this._front = 0;
    this._makeCapacity();
}

Queue.prototype._willBeOverCapacity =
function Queue$_willBeOverCapacity(size) {
    return this._capacity < size;
};

Queue.prototype._pushOne = function Queue$_pushOne(arg) {
    var length = this.length();
    this._checkCapacity(length + 1);
    var i = (this._front + length) & (this._capacity - 1);
    this[i] = arg;
    this._length = length + 1;
};

Queue.prototype.push = function Queue$push(fn, receiver, arg) {
    var length = this.length() + 3;
    if (this._willBeOverCapacity(length)) {
        this._pushOne(fn);
        this._pushOne(receiver);
        this._pushOne(arg);
        return;
    }
    var j = this._front + length - 3;
    this._checkCapacity(length);
    var wrapMask = this._capacity - 1;
    this[(j + 0) & wrapMask] = fn;
    this[(j + 1) & wrapMask] = receiver;
    this[(j + 2) & wrapMask] = arg;
    this._length = length;
};

Queue.prototype.shift = function Queue$shift() {
    var front = this._front,
        ret = this[front];

    this[front] = void 0;
    this._front = (front + 1) & (this._capacity - 1);
    this._length--;
    return ret;
};

Queue.prototype.length = function Queue$length() {
    return this._length;
};

Queue.prototype._makeCapacity = function Queue$_makeCapacity() {
    var len = this._capacity;
    for (var i = 0; i < len; ++i) {
        this[i] = void 0;
    }
};

Queue.prototype._checkCapacity = function Queue$_checkCapacity(size) {
    if (this._capacity < size) {
        this._resizeTo(this._capacity << 3);
    }
};

Queue.prototype._resizeTo = function Queue$_resizeTo(capacity) {
    var oldFront = this._front;
    var oldCapacity = this._capacity;
    var oldQueue = new Array(oldCapacity);
    var length = this.length();

    arrayCopy(this, 0, oldQueue, 0, oldCapacity);
    this._capacity = capacity;
    this._makeCapacity();
    this._front = 0;
    if (oldFront + length <= oldCapacity) {
        arrayCopy(oldQueue, oldFront, this, 0, length);
    }
    else {        var lengthBeforeWrapping =
            length - ((oldFront + length) & (oldCapacity - 1));

        arrayCopy(oldQueue, oldFront, this, 0, lengthBeforeWrapping);
        arrayCopy(oldQueue, 0, this, lengthBeforeWrapping,
                    length - lengthBeforeWrapping);
    }
};

module.exports = Queue;

},{}],33:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var apiRejection = _dereq_("./errors_api_rejection.js")(Promise);
var isArray = _dereq_("./util.js").isArray;

var raceLater = function Promise$_raceLater(promise) {
    return promise.then(function(array) {
        return Promise$_Race(array, promise);
    });
};

var hasOwn = {}.hasOwnProperty;
function Promise$_Race(promises, parent) {
    var maybePromise = Promise._cast(promises, void 0);

    if (maybePromise instanceof Promise) {
        return raceLater(maybePromise);
    }
    else if (!isArray(promises)) {
        return apiRejection("expecting an array, a promise or a thenable");
    }

    var ret = new Promise(INTERNAL);
    ret._setTrace(parent);
    if (parent !== void 0) {
        if (parent._isBound()) {
            ret._setBoundTo(parent._boundTo);
        }
        if (parent._cancellable()) {
            ret._setCancellable();
            ret._cancellationParent = parent;
        }
    }
    var fulfill = ret._fulfill;
    var reject = ret._reject;
    for (var i = 0, len = promises.length; i < len; ++i) {
        var val = promises[i];

        if (val === void 0 && !(hasOwn.call(promises, i))) {
            continue;
        }

        Promise.cast(val)._then(
            fulfill,
            reject,
            void 0,
            ret,
            null
       );
    }
    return ret;
}

Promise.race = function Promise$Race(promises) {
    return Promise$_Race(promises, void 0);
};

Promise.prototype.race = function Promise$race() {
    return Promise$_Race(this, void 0);
};

};

},{"./errors_api_rejection.js":16,"./util.js":43}],34:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(
    Promise, Promise$_CreatePromiseArray,
    PromiseArray, apiRejection, INTERNAL) {

function Reduction(callback, index, accum, items, receiver) {
    this.promise = new Promise(INTERNAL);
    this.index = index;
    this.length = items.length;
    this.items = items;
    this.callback = callback;
    this.receiver = receiver;
    this.accum = accum;
}

Reduction.prototype.reject = function Reduction$reject(e) {
    this.promise._reject(e);
};

Reduction.prototype.fulfill = function Reduction$fulfill(value, index) {
    this.accum = value;
    this.index = index + 1;
    this.iterate();
};

Reduction.prototype.iterate = function Reduction$iterate() {
    var i = this.index;
    var len = this.length;
    var items = this.items;
    var result = this.accum;
    var receiver = this.receiver;
    var callback = this.callback;

    for (; i < len; ++i) {
        result = callback.call(receiver, result, items[i], i, len);
        result = Promise._cast(result, void 0);

        if (result instanceof Promise) {
            result._then(
                this.fulfill, this.reject, void 0, this, i);
            return;
        }
    }
    this.promise._fulfill(result);
};

function Promise$_reducer(fulfilleds, initialValue) {
    var fn = this;
    var receiver = void 0;
    if (typeof fn !== "function")  {
        receiver = fn.receiver;
        fn = fn.fn;
    }
    var len = fulfilleds.length;
    var accum = void 0;
    var startIndex = 0;

    if (initialValue !== void 0) {
        accum = initialValue;
        startIndex = 0;
    }
    else {
        startIndex = 1;
        if (len > 0) accum = fulfilleds[0];
    }
    var i = startIndex;

    if (i >= len) {
        return accum;
    }

    var reduction = new Reduction(fn, i, accum, fulfilleds, receiver);
    reduction.iterate();
    return reduction.promise;
}

function Promise$_unpackReducer(fulfilleds) {
    var fn = this.fn;
    var initialValue = this.initialValue;
    return Promise$_reducer.call(fn, fulfilleds, initialValue);
}

function Promise$_slowReduce(
    promises, fn, initialValue, useBound) {
    return initialValue._then(function(initialValue) {
        return Promise$_Reduce(
            promises, fn, initialValue, useBound);
    }, void 0, void 0, void 0, void 0);
}

function Promise$_Reduce(promises, fn, initialValue, useBound) {
    if (typeof fn !== "function") {
        return apiRejection("fn must be a function");
    }

    if (useBound === true && promises._isBound()) {
        fn = {
            fn: fn,
            receiver: promises._boundTo
        };
    }

    if (initialValue !== void 0) {
        if (initialValue instanceof Promise) {
            if (initialValue.isFulfilled()) {
                initialValue = initialValue._settledValue;
            }
            else {
                return Promise$_slowReduce(promises,
                    fn, initialValue, useBound);
            }
        }

        return Promise$_CreatePromiseArray(promises, PromiseArray,
            useBound === true && promises._isBound()
                ? promises._boundTo
                : void 0)
            .promise()
            ._then(Promise$_unpackReducer, void 0, void 0, {
                fn: fn,
                initialValue: initialValue
            }, void 0);
    }
    return Promise$_CreatePromiseArray(promises, PromiseArray,
            useBound === true && promises._isBound()
                ? promises._boundTo
                : void 0).promise()
        ._then(Promise$_reducer, void 0, void 0, fn, void 0);
}


Promise.reduce = function Promise$Reduce(promises, fn, initialValue) {
    return Promise$_Reduce(promises, fn, initialValue, false);
};

Promise.prototype.reduce = function Promise$reduce(fn, initialValue) {
    return Promise$_Reduce(this, fn, initialValue, true);
};
};

},{}],35:[function(_dereq_,module,exports){
(function (process){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var global = _dereq_("./global.js");
var schedule;
if (typeof process !== "undefined" && process !== null &&
    typeof process.cwd === "function" &&
    typeof process.nextTick === "function" &&
    typeof process.version === "string") {
    schedule = function Promise$_Scheduler(fn) {
        process.nextTick(fn);
    };
}
else if ((typeof global.MutationObserver === "function" ||
        typeof global.WebkitMutationObserver === "function" ||
        typeof global.WebKitMutationObserver === "function") &&
        typeof document !== "undefined" &&
        typeof document.createElement === "function") {


    schedule = (function(){
        var MutationObserver = global.MutationObserver ||
            global.WebkitMutationObserver ||
            global.WebKitMutationObserver;
        var div = document.createElement("div");
        var queuedFn = void 0;
        var observer = new MutationObserver(
            function Promise$_Scheduler() {
                var fn = queuedFn;
                queuedFn = void 0;
                fn();
            }
       );
        observer.observe(div, {
            attributes: true
        });
        return function Promise$_Scheduler(fn) {
            queuedFn = fn;
            div.setAttribute("class", "foo");
        };

    })();
}
else if (typeof global.postMessage === "function" &&
    typeof global.importScripts !== "function" &&
    typeof global.addEventListener === "function" &&
    typeof global.removeEventListener === "function") {

    var MESSAGE_KEY = "bluebird_message_key_" + Math.random();
    schedule = (function(){
        var queuedFn = void 0;

        function Promise$_Scheduler(e) {
            if (e.source === global &&
                e.data === MESSAGE_KEY) {
                var fn = queuedFn;
                queuedFn = void 0;
                fn();
            }
        }

        global.addEventListener("message", Promise$_Scheduler, false);

        return function Promise$_Scheduler(fn) {
            queuedFn = fn;
            global.postMessage(
                MESSAGE_KEY, "*"
           );
        };

    })();
}
else if (typeof global.MessageChannel === "function") {
    schedule = (function(){
        var queuedFn = void 0;

        var channel = new global.MessageChannel();
        channel.port1.onmessage = function Promise$_Scheduler() {
                var fn = queuedFn;
                queuedFn = void 0;
                fn();
        };

        return function Promise$_Scheduler(fn) {
            queuedFn = fn;
            channel.port2.postMessage(null);
        };
    })();
}
else if (global.setTimeout) {
    schedule = function Promise$_Scheduler(fn) {
        setTimeout(fn, 4);
    };
}
else {
    schedule = function Promise$_Scheduler(fn) {
        fn();
    };
}

module.exports = schedule;

}).call(this,_dereq_("UPikzY"))
},{"./global.js":21,"UPikzY":66}],36:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports =
    function(Promise, Promise$_CreatePromiseArray, PromiseArray) {

var SettledPromiseArray = _dereq_("./settled_promise_array.js")(
    Promise, PromiseArray);

function Promise$_Settle(promises, useBound) {
    return Promise$_CreatePromiseArray(
        promises,
        SettledPromiseArray,
        useBound === true && promises._isBound()
            ? promises._boundTo
            : void 0
   ).promise();
}

Promise.settle = function Promise$Settle(promises) {
    return Promise$_Settle(promises, false);
};

Promise.prototype.settle = function Promise$settle() {
    return Promise$_Settle(this, true);
};
};

},{"./settled_promise_array.js":37}],37:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray) {
var PromiseInspection = Promise.PromiseInspection;
var util = _dereq_("./util.js");
var inherits = util.inherits;
function SettledPromiseArray(values, boundTo) {
    this.constructor$(values, boundTo);
}
inherits(SettledPromiseArray, PromiseArray);

SettledPromiseArray.prototype._promiseResolved =
function SettledPromiseArray$_promiseResolved(index, inspection) {
    this._values[index] = inspection;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

SettledPromiseArray.prototype._promiseFulfilled =
function SettledPromiseArray$_promiseFulfilled(value, index) {
    if (this._isResolved()) return;
    var ret = new PromiseInspection();
    ret._bitField = 268435456;
    ret._settledValue = value;
    this._promiseResolved(index, ret);
};
SettledPromiseArray.prototype._promiseRejected =
function SettledPromiseArray$_promiseRejected(reason, index) {
    if (this._isResolved()) return;
    var ret = new PromiseInspection();
    ret._bitField = 134217728;
    ret._settledValue = reason;
    this._promiseResolved(index, ret);
};

return SettledPromiseArray;
};

},{"./util.js":43}],38:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports =
function(Promise, Promise$_CreatePromiseArray, PromiseArray, apiRejection) {

var SomePromiseArray = _dereq_("./some_promise_array.js")(PromiseArray);
function Promise$_Some(promises, howMany, useBound) {
    if ((howMany | 0) !== howMany || howMany < 0) {
        return apiRejection("expecting a positive integer");
    }
    var ret = Promise$_CreatePromiseArray(
        promises,
        SomePromiseArray,
        useBound === true && promises._isBound()
            ? promises._boundTo
            : void 0
   );
    var promise = ret.promise();
    if (promise.isRejected()) {
        return promise;
    }
    ret.setHowMany(howMany);
    ret.init();
    return promise;
}

Promise.some = function Promise$Some(promises, howMany) {
    return Promise$_Some(promises, howMany, false);
};

Promise.prototype.some = function Promise$some(count) {
    return Promise$_Some(this, count, true);
};

};

},{"./some_promise_array.js":39}],39:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function (PromiseArray) {
var util = _dereq_("./util.js");
var RangeError = _dereq_("./errors.js").RangeError;
var inherits = util.inherits;
var isArray = util.isArray;

function SomePromiseArray(values, boundTo) {
    this.constructor$(values, boundTo);
    this._howMany = 0;
    this._unwrap = false;
    this._initialized = false;
}
inherits(SomePromiseArray, PromiseArray);

SomePromiseArray.prototype._init = function SomePromiseArray$_init() {
    if (!this._initialized) {
        return;
    }
    if (this._howMany === 0) {
        this._resolve([]);
        return;
    }
    this._init$(void 0, -2);
    var isArrayResolved = isArray(this._values);
    this._holes = isArrayResolved ? this._values.length - this.length() : 0;

    if (!this._isResolved() &&
        isArrayResolved &&
        this._howMany > this._canPossiblyFulfill()) {
        var message = "(Promise.some) input array contains less than " +
                        this._howMany  + " promises";
        this._reject(new RangeError(message));
    }
};

SomePromiseArray.prototype.init = function SomePromiseArray$init() {
    this._initialized = true;
    this._init();
};

SomePromiseArray.prototype.setUnwrap = function SomePromiseArray$setUnwrap() {
    this._unwrap = true;
};

SomePromiseArray.prototype.howMany = function SomePromiseArray$howMany() {
    return this._howMany;
};

SomePromiseArray.prototype.setHowMany =
function SomePromiseArray$setHowMany(count) {
    if (this._isResolved()) return;
    this._howMany = count;
};

SomePromiseArray.prototype._promiseFulfilled =
function SomePromiseArray$_promiseFulfilled(value) {
    if (this._isResolved()) return;
    this._addFulfilled(value);
    if (this._fulfilled() === this.howMany()) {
        this._values.length = this.howMany();
        if (this.howMany() === 1 && this._unwrap) {
            this._resolve(this._values[0]);
        }
        else {
            this._resolve(this._values);
        }
    }

};
SomePromiseArray.prototype._promiseRejected =
function SomePromiseArray$_promiseRejected(reason) {
    if (this._isResolved()) return;
    this._addRejected(reason);
    if (this.howMany() > this._canPossiblyFulfill()) {
        if (this._values.length === this.length()) {
            this._reject([]);
        }
        else {
            this._reject(this._values.slice(this.length() + this._holes));
        }
    }
};

SomePromiseArray.prototype._fulfilled = function SomePromiseArray$_fulfilled() {
    return this._totalResolved;
};

SomePromiseArray.prototype._rejected = function SomePromiseArray$_rejected() {
    return this._values.length - this.length() - this._holes;
};

SomePromiseArray.prototype._addRejected =
function SomePromiseArray$_addRejected(reason) {
    this._values.push(reason);
};

SomePromiseArray.prototype._addFulfilled =
function SomePromiseArray$_addFulfilled(value) {
    this._values[this._totalResolved++] = value;
};

SomePromiseArray.prototype._canPossiblyFulfill =
function SomePromiseArray$_canPossiblyFulfill() {
    return this.length() - this._rejected();
};

return SomePromiseArray;
};

},{"./errors.js":15,"./util.js":43}],40:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
function PromiseInspection(promise) {
    if (promise !== void 0) {
        this._bitField = promise._bitField;
        this._settledValue = promise.isResolved()
            ? promise._settledValue
            : void 0;
    }
    else {
        this._bitField = 0;
        this._settledValue = void 0;
    }
}

PromiseInspection.prototype.isFulfilled =
Promise.prototype.isFulfilled = function Promise$isFulfilled() {
    return (this._bitField & 268435456) > 0;
};

PromiseInspection.prototype.isRejected =
Promise.prototype.isRejected = function Promise$isRejected() {
    return (this._bitField & 134217728) > 0;
};

PromiseInspection.prototype.isPending =
Promise.prototype.isPending = function Promise$isPending() {
    return (this._bitField & 402653184) === 0;
};

PromiseInspection.prototype.value =
Promise.prototype.value = function Promise$value() {
    if (!this.isFulfilled()) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise");
    }
    return this._settledValue;
};

PromiseInspection.prototype.error =
Promise.prototype.reason = function Promise$reason() {
    if (!this.isRejected()) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise");
    }
    return this._settledValue;
};

PromiseInspection.prototype.isResolved =
Promise.prototype.isResolved = function Promise$isResolved() {
    return (this._bitField & 402653184) > 0;
};

Promise.prototype.inspect = function Promise$inspect() {
    return new PromiseInspection(this);
};

Promise.PromiseInspection = PromiseInspection;
};

},{}],41:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var util = _dereq_("./util.js");
var canAttach = _dereq_("./errors.js").canAttach;
var errorObj = util.errorObj;
var isObject = util.isObject;

function getThen(obj) {
    try {
        return obj.then;
    }
    catch(e) {
        errorObj.e = e;
        return errorObj;
    }
}

function Promise$_Cast(obj, originalPromise) {
    if (isObject(obj)) {
        if (obj instanceof Promise) {
            return obj;
        }
        else if (isAnyBluebirdPromise(obj)) {
            var ret = new Promise(INTERNAL);
            ret._setTrace(void 0);
            obj._then(
                ret._fulfillUnchecked,
                ret._rejectUncheckedCheckError,
                ret._progressUnchecked,
                ret,
                null
            );
            ret._setFollowing();
            return ret;
        }
        var then = getThen(obj);
        if (then === errorObj) {
            if (originalPromise !== void 0 && canAttach(then.e)) {
                originalPromise._attachExtraTrace(then.e);
            }
            return Promise.reject(then.e);
        }
        else if (typeof then === "function") {
            return Promise$_doThenable(obj, then, originalPromise);
        }
    }
    return obj;
}

var hasProp = {}.hasOwnProperty;
function isAnyBluebirdPromise(obj) {
    return hasProp.call(obj, "_promise0");
}

function Promise$_doThenable(x, then, originalPromise) {
    var resolver = Promise.defer();
    var called = false;
    try {
        then.call(
            x,
            Promise$_resolveFromThenable,
            Promise$_rejectFromThenable,
            Promise$_progressFromThenable
        );
    }
    catch(e) {
        if (!called) {
            called = true;
            var trace = canAttach(e) ? e : new Error(e + "");
            if (originalPromise !== void 0) {
                originalPromise._attachExtraTrace(trace);
            }
            resolver.promise._reject(e, trace);
        }
    }
    return resolver.promise;

    function Promise$_resolveFromThenable(y) {
        if (called) return;
        called = true;

        if (x === y) {
            var e = Promise._makeSelfResolutionError();
            if (originalPromise !== void 0) {
                originalPromise._attachExtraTrace(e);
            }
            resolver.promise._reject(e, void 0);
            return;
        }
        resolver.resolve(y);
    }

    function Promise$_rejectFromThenable(r) {
        if (called) return;
        called = true;
        var trace = canAttach(r) ? r : new Error(r + "");
        if (originalPromise !== void 0) {
            originalPromise._attachExtraTrace(trace);
        }
        resolver.promise._reject(r, trace);
    }

    function Promise$_progressFromThenable(v) {
        if (called) return;
        var promise = resolver.promise;
        if (typeof promise._progress === "function") {
            promise._progress(v);
        }
    }
}

Promise._cast = Promise$_Cast;
};

},{"./errors.js":15,"./util.js":43}],42:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var global = _dereq_("./global.js");
var setTimeout = function(fn, ms) {
    var $_len = arguments.length;var args = new Array($_len - 2); for(var $_i = 2; $_i < $_len; ++$_i) {args[$_i - 2] = arguments[$_i];}
    global.setTimeout(function(){
        fn.apply(void 0, args);
    }, ms);
};

module.exports = function(Promise, INTERNAL) {
var util = _dereq_("./util.js");
var errors = _dereq_("./errors.js");
var apiRejection = _dereq_("./errors_api_rejection")(Promise);
var TimeoutError = Promise.TimeoutError;

var afterTimeout = function Promise$_afterTimeout(promise, message, ms) {
    if (!promise.isPending()) return;
    if (typeof message !== "string") {
        message = "operation timed out after" + " " + ms + " ms"
    }
    var err = new TimeoutError(message);
    errors.markAsOriginatingFromRejection(err);
    promise._attachExtraTrace(err);
    promise._rejectUnchecked(err);
};

var afterDelay = function Promise$_afterDelay(value, promise) {
    promise._fulfill(value);
};

var delay = Promise.delay = function Promise$Delay(value, ms) {
    if (ms === void 0) {
        ms = value;
        value = void 0;
    }
    ms = +ms;
    var maybePromise = Promise._cast(value, void 0);
    var promise = new Promise(INTERNAL);

    if (maybePromise instanceof Promise) {
        if (maybePromise._isBound()) {
            promise._setBoundTo(maybePromise._boundTo);
        }
        if (maybePromise._cancellable()) {
            promise._setCancellable();
            promise._cancellationParent = maybePromise;
        }
        promise._setTrace(maybePromise);
        promise._follow(maybePromise);
        return promise.then(function(value) {
            return Promise.delay(value, ms);
        });
    }
    else {
        promise._setTrace(void 0);
        setTimeout(afterDelay, ms, value, promise);
    }
    return promise;
};

Promise.prototype.delay = function Promise$delay(ms) {
    return delay(this, ms);
};

Promise.prototype.timeout = function Promise$timeout(ms, message) {
    ms = +ms;

    var ret = new Promise(INTERNAL);
    ret._setTrace(this);

    if (this._isBound()) ret._setBoundTo(this._boundTo);
    if (this._cancellable()) {
        ret._setCancellable();
        ret._cancellationParent = this;
    }
    ret._follow(this);
    setTimeout(afterTimeout, ms, ret, message, ms);
    return ret;
};

};

},{"./errors.js":15,"./errors_api_rejection":16,"./global.js":21,"./util.js":43}],43:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var global = _dereq_("./global.js");
var es5 = _dereq_("./es5.js");
var haveGetters = (function(){
    try {
        var o = {};
        es5.defineProperty(o, "f", {
            get: function () {
                return 3;
            }
        });
        return o.f === 3;
    }
    catch (e) {
        return false;
    }

})();

var canEvaluate = (function() {
    if (typeof window !== "undefined" && window !== null &&
        typeof window.document !== "undefined" &&
        typeof navigator !== "undefined" && navigator !== null &&
        typeof navigator.appName === "string" &&
        window === global) {
        return false;
    }
    return true;
})();

function deprecated(msg) {
    if (typeof console !== "undefined" && console !== null &&
        typeof console.warn === "function") {
        console.warn("Bluebird: " + msg);
    }
}

var errorObj = {e: {}};
function tryCatch1(fn, receiver, arg) {
    try {
        return fn.call(receiver, arg);
    }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch2(fn, receiver, arg, arg2) {
    try {
        return fn.call(receiver, arg, arg2);
    }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatchApply(fn, args, receiver) {
    try {
        return fn.apply(receiver, args);
    }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

var inherits = function(Child, Parent) {
    var hasProp = {}.hasOwnProperty;

    function T() {
        this.constructor = Child;
        this.constructor$ = Parent;
        for (var propertyName in Parent.prototype) {
            if (hasProp.call(Parent.prototype, propertyName) &&
                propertyName.charAt(propertyName.length-1) !== "$"
           ) {
                this[propertyName + "$"] = Parent.prototype[propertyName];
            }
        }
    }
    T.prototype = Parent.prototype;
    Child.prototype = new T();
    return Child.prototype;
};

function asString(val) {
    return typeof val === "string" ? val : ("" + val);
}

function isPrimitive(val) {
    return val == null || val === true || val === false ||
        typeof val === "string" || typeof val === "number";

}

function isObject(value) {
    return !isPrimitive(value);
}

function maybeWrapAsError(maybeError) {
    if (!isPrimitive(maybeError)) return maybeError;

    return new Error(asString(maybeError));
}

function withAppended(target, appendee) {
    var len = target.length;
    var ret = new Array(len + 1);
    var i;
    for (i = 0; i < len; ++i) {
        ret[i] = target[i];
    }
    ret[i] = appendee;
    return ret;
}


function notEnumerableProp(obj, name, value) {
    if (isPrimitive(obj)) return obj;
    var descriptor = {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
    };
    es5.defineProperty(obj, name, descriptor);
    return obj;
}


var wrapsPrimitiveReceiver = (function() {
    return this !== "string";
}).call("string");

function thrower(r) {
    throw r;
}


function toFastProperties(obj) {
    /*jshint -W027*/
    function f() {}
    f.prototype = obj;
    return f;
    eval(obj);
}

var ret = {
    thrower: thrower,
    isArray: es5.isArray,
    haveGetters: haveGetters,
    notEnumerableProp: notEnumerableProp,
    isPrimitive: isPrimitive,
    isObject: isObject,
    canEvaluate: canEvaluate,
    deprecated: deprecated,
    errorObj: errorObj,
    tryCatch1: tryCatch1,
    tryCatch2: tryCatch2,
    tryCatchApply: tryCatchApply,
    inherits: inherits,
    withAppended: withAppended,
    asString: asString,
    maybeWrapAsError: maybeWrapAsError,
    wrapsPrimitiveReceiver: wrapsPrimitiveReceiver,
    toFastProperties: toFastProperties
};

module.exports = ret;

},{"./es5.js":17,"./global.js":21}],44:[function(_dereq_,module,exports){
module.exports = _dereq_('./lib/enum');
},{"./lib/enum":45}],45:[function(_dereq_,module,exports){
(function (global){
(function (root, module, global, define) {

  "use strict";

  /**
   * Represents an Item of an Enum.
   * @param {String} key   The Enum key.
   * @param {Number} value The Enum value.
   */
  function EnumItem(key, value) {
    this.key = key;
    this.value = value;
  }

  EnumItem.prototype = {

    /*constructor reference so that, this.constructor===EnumItem//=>true */
    constructor: EnumItem,

    /**
     * Checks if the flagged EnumItem has the passing object.
     * @param  {EnumItem || String || Number} value The object to check with.
     * @return {Boolean}                            The check result.
     */
    has: function(value) {
      if (value instanceof EnumItem || (typeof(value) === 'object' && value.key !== undefined && value.value !== undefined)) {
        return (this.value & value.value) !== 0;
      } else if (typeof(value) === 'string') {
        return this.key.indexOf(value) >= 0;
      } else {
        return (this.value & value) !== 0;
      }
    },

    /**
     * Checks if the EnumItem is the same as the passing object.
     * @param  {EnumItem || String || Number} key The object to check with.
     * @return {Boolean}                          The check result.
     */
    is: function(key) {
      if (key instanceof EnumItem || (typeof(key) === 'object' && key.key !== undefined && key.value !== undefined)) {
        return this.key === key.key;
      } else if (typeof(key) === 'string') {
        return this.key === key;
      } else {
        return this.value === key;
      }
    },

    /**
     * Returns String representation of this EnumItem.
     * @return {String} String representation of this EnumItem.
     */
    toString: function() {
      return this.key;
    },

    /**
     * Returns JSON object representation of this EnumItem.
     * @return {String} JSON object representation of this EnumItem.
     */
    toJSON: function() {
      return this.key;
    },

    /**
     * Returns the value to compare with.
     * @return {String} The value to compare with.
     */
    valueOf: function() {
      return this.key;
    }

  };


  /**
   * Represents an Enum with enum items.
   * @param {Array || Object}  map     This are the enum items.
   * @param {String || Object} options This are options. [optional]
   */
  function Enum(map, options) {

    if (options && typeof(options) === 'string') {
      options = { name: options };
    }

    this._options = options || {};
    this._options.separator = this._options.separator || ' | ';

    this.enums = [];

    if (map.length) {
      var array = map;
      map = {};

      for (var i = 0; i < array.length; i++) {
        map[array[i]] = Math.pow(2, i);
      }
    }

    for (var member in map) {
      if ((this._options.name && member === 'name') || member === '_options' || member === 'get' || member === 'getKey' || member === 'getValue' || member === 'enums' || member === 'isFlaggable') {
        throw new Error('Enum key "' + member + '" is a reserved word!');
      }
      this[member] = new EnumItem(member, map[member]);
      this.enums.push(this[member]);
    }

    if (this._options.name) {
      this.name = this._options.name;
    }

    var self = this;

    function isFlaggable() {
      for (var i = 0, len = self.enums.length; i < len; i++) {
        var e = self.enums[i];

        if (!((e.value !== 0) && !(e.value & (e.value - 1)))) {
          return false;
        }
      }
      return true;
    }

    this.isFlaggable = isFlaggable();
    this.freezeEnums(); //this will make instances of Enum non-extensible
  }

  Enum.prototype = {

    /*constructor reference so that, this.constructor===Enum//=>true */
    constructor: Enum,

    /**
     * Returns the appropriate EnumItem key.
     * @param  {EnumItem || String || Number} key The object to get with.
     * @return {String}                           The get result.
     */
    getKey: function(value) {
      var item = this.get(value);
      if (item) {
        return item.key;
      } else {
        return 'Undefined';
      }
    },

    /**
     * Returns the appropriate EnumItem value.
     * @param  {EnumItem || String || Number} key The object to get with.
     * @return {Number}                           The get result.
     */
    getValue: function(key) {
      var item = this.get(key);
      if (item) {
        return item.value;
      } else {
        return null;
      }
    },

    /**
     * Returns the appropriate EnumItem.
     * @param  {EnumItem || String || Number} key The object to get with.
     * @return {EnumItem}                         The get result.
     */
    get: function(key) {
      if (key === null || key === undefined) return null;

      if (key instanceof EnumItem || (typeof(key) === 'object' && key.key !== undefined && key.value !== undefined)) {
        var foundIndex = this.enums.indexOf(key);
        if (foundIndex >= 0) {
          return key;
        }
        if (!this.isFlaggable || (this.isFlaggable && key.key.indexOf(this._options.separator) < 0)) {
          return null;
        }
        return this.get(key.key);
      } else if (typeof(key) === 'string') {
        if (key.indexOf(this._options.separator) > 0) {
          var parts = key.split(this._options.separator);

          var value = 0;
          for(var i = 0; i < parts.length; i++) {
            var part = parts[i];

            value |= this[part].value;
          }

          return new EnumItem(key, value);
        } else {
          return this[key];
        }
      } else {
        for (var m in this) {
          if (this.hasOwnProperty(m)) {
            if (this[m].value === key) {
              return this[m];
            }
          }
        }

        var result = null;

        if (this.isFlaggable) {
          for (var n in this) {
            if (this.hasOwnProperty(n)) {
              if ((key & this[n].value) !== 0) {
                if (result) {
                  result += this._options.separator;
                } else {
                  result = '';
                }
                result += n;
              }
            }
          }
        }

        return this.get(result || null);
      }
    },

    /**
     * Define freezeEnums() as a property of the prototype.
     * make enumerable items nonconfigurable and deep freeze the properties. Throw Error on property setter.
     */
    freezeEnums: function() {
      function freezer(o) {
        var props = Object.getOwnPropertyNames(o);
        props.forEach( function(p){
          if (!Object.getOwnPropertyDescriptor(o, p).configurable) {
            return;
          }

          Object.defineProperties(o, p, {writable:false, configurable:false});
        })
        return o;
      }

      function getPropertyValue(value) {
        return value;
      }

      function deepFreezeEnums(o) {
        if (typeof o !== 'object' || o === null || Object.isFrozen(o) || Object.isSealed(o) ){
          return;
        }
        for (var key in o) {
          if (o.hasOwnProperty(key)) {
            o.__defineGetter__(key, getPropertyValue.bind(null, o[key]));
            o.__defineSetter__(key, function throwPropertySetError(value){throw TypeError("Cannot redefine property; Enum Type is not extensible.")});
            deepFreezeEnums(o[key]);
          }
        }
        if (Object.freeze) {
          Object.freeze(o);
        } else {
          freezer(o);
        }
      }

      deepFreezeEnums(this);

      return this;
    },
  };


  if (module && module.exports) {
    module.exports = Enum;
  } else if (define) {
    define(function () {
      return Enum;
    });
  } else {
    root.Enum = Enum;
  }

  if (module && module.exports && global) {

    /**
     * Registers the Enum Type globally in node.js.
     * @param  {String} key Global variable. [optional]
     */
    Enum.register = function(key) {
      key = key || 'Enum';
      if (!global[key]) {
        global[key] = Enum;
      }
    };
  }

}(
  this,
  typeof(module) !== 'undefined' ? module : undefined,
  typeof(global) !== 'undefined' ? global : undefined,
  typeof(define) !== 'undefined' ? define : undefined
));

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],46:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var createWrapper = _dereq_('../internals/createWrapper'),
    slice = _dereq_('../internals/slice');

/**
 * Creates a function that, when called, invokes `func` with the `this`
 * binding of `thisArg` and prepends any additional `bind` arguments to those
 * provided to the bound function.
 *
 * @static
 * @memberOf _
 * @category Functions
 * @param {Function} func The function to bind.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {...*} [arg] Arguments to be partially applied.
 * @returns {Function} Returns the new bound function.
 * @example
 *
 * var func = function(greeting) {
 *   return greeting + ' ' + this.name;
 * };
 *
 * func = _.bind(func, { 'name': 'fred' }, 'hi');
 * func();
 * // => 'hi fred'
 */
function bind(func, thisArg) {
  return arguments.length > 2
    ? createWrapper(func, 17, slice(arguments, 2), null, thisArg)
    : createWrapper(func, 1, null, null, thisArg);
}

module.exports = bind;

},{"../internals/createWrapper":51,"../internals/slice":56}],47:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var baseCreate = _dereq_('./baseCreate'),
    isObject = _dereq_('../objects/isObject'),
    setBindData = _dereq_('./setBindData'),
    slice = _dereq_('./slice');

/**
 * Used for `Array` method references.
 *
 * Normally `Array.prototype` would suffice, however, using an array literal
 * avoids issues in Narwhal.
 */
var arrayRef = [];

/** Native method shortcuts */
var push = arrayRef.push;

/**
 * The base implementation of `_.bind` that creates the bound function and
 * sets its meta data.
 *
 * @private
 * @param {Array} bindData The bind data array.
 * @returns {Function} Returns the new bound function.
 */
function baseBind(bindData) {
  var func = bindData[0],
      partialArgs = bindData[2],
      thisArg = bindData[4];

  function bound() {
    // `Function#bind` spec
    // http://es5.github.io/#x15.3.4.5
    if (partialArgs) {
      // avoid `arguments` object deoptimizations by using `slice` instead
      // of `Array.prototype.slice.call` and not assigning `arguments` to a
      // variable as a ternary expression
      var args = slice(partialArgs);
      push.apply(args, arguments);
    }
    // mimic the constructor's `return` behavior
    // http://es5.github.io/#x13.2.2
    if (this instanceof bound) {
      // ensure `new bound` is an instance of `func`
      var thisBinding = baseCreate(func.prototype),
          result = func.apply(thisBinding, args || arguments);
      return isObject(result) ? result : thisBinding;
    }
    return func.apply(thisArg, args || arguments);
  }
  setBindData(bound, bindData);
  return bound;
}

module.exports = baseBind;

},{"../objects/isObject":59,"./baseCreate":48,"./setBindData":54,"./slice":56}],48:[function(_dereq_,module,exports){
(function (global){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var isNative = _dereq_('./isNative'),
    isObject = _dereq_('../objects/isObject'),
    noop = _dereq_('../utilities/noop');

/* Native method shortcuts for methods with the same name as other `lodash` methods */
var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate;

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} prototype The object to inherit from.
 * @returns {Object} Returns the new object.
 */
function baseCreate(prototype, properties) {
  return isObject(prototype) ? nativeCreate(prototype) : {};
}
// fallback for browsers without `Object.create`
if (!nativeCreate) {
  baseCreate = (function() {
    function Object() {}
    return function(prototype) {
      if (isObject(prototype)) {
        Object.prototype = prototype;
        var result = new Object;
        Object.prototype = null;
      }
      return result || global.Object();
    };
  }());
}

module.exports = baseCreate;

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../objects/isObject":59,"../utilities/noop":63,"./isNative":52}],49:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var bind = _dereq_('../functions/bind'),
    identity = _dereq_('../utilities/identity'),
    setBindData = _dereq_('./setBindData'),
    support = _dereq_('../support');

/** Used to detected named functions */
var reFuncName = /^\s*function[ \n\r\t]+\w/;

/** Used to detect functions containing a `this` reference */
var reThis = /\bthis\b/;

/** Native method shortcuts */
var fnToString = Function.prototype.toString;

/**
 * The base implementation of `_.createCallback` without support for creating
 * "_.pluck" or "_.where" style callbacks.
 *
 * @private
 * @param {*} [func=identity] The value to convert to a callback.
 * @param {*} [thisArg] The `this` binding of the created callback.
 * @param {number} [argCount] The number of arguments the callback accepts.
 * @returns {Function} Returns a callback function.
 */
function baseCreateCallback(func, thisArg, argCount) {
  if (typeof func != 'function') {
    return identity;
  }
  // exit early for no `thisArg` or already bound by `Function#bind`
  if (typeof thisArg == 'undefined' || !('prototype' in func)) {
    return func;
  }
  var bindData = func.__bindData__;
  if (typeof bindData == 'undefined') {
    if (support.funcNames) {
      bindData = !func.name;
    }
    bindData = bindData || !support.funcDecomp;
    if (!bindData) {
      var source = fnToString.call(func);
      if (!support.funcNames) {
        bindData = !reFuncName.test(source);
      }
      if (!bindData) {
        // checks if `func` references the `this` keyword and stores the result
        bindData = reThis.test(source);
        setBindData(func, bindData);
      }
    }
  }
  // exit early if there are no `this` references or `func` is bound
  if (bindData === false || (bindData !== true && bindData[1] & 1)) {
    return func;
  }
  switch (argCount) {
    case 1: return function(value) {
      return func.call(thisArg, value);
    };
    case 2: return function(a, b) {
      return func.call(thisArg, a, b);
    };
    case 3: return function(value, index, collection) {
      return func.call(thisArg, value, index, collection);
    };
    case 4: return function(accumulator, value, index, collection) {
      return func.call(thisArg, accumulator, value, index, collection);
    };
  }
  return bind(func, thisArg);
}

module.exports = baseCreateCallback;

},{"../functions/bind":46,"../support":61,"../utilities/identity":62,"./setBindData":54}],50:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var baseCreate = _dereq_('./baseCreate'),
    isObject = _dereq_('../objects/isObject'),
    setBindData = _dereq_('./setBindData'),
    slice = _dereq_('./slice');

/**
 * Used for `Array` method references.
 *
 * Normally `Array.prototype` would suffice, however, using an array literal
 * avoids issues in Narwhal.
 */
var arrayRef = [];

/** Native method shortcuts */
var push = arrayRef.push;

/**
 * The base implementation of `createWrapper` that creates the wrapper and
 * sets its meta data.
 *
 * @private
 * @param {Array} bindData The bind data array.
 * @returns {Function} Returns the new function.
 */
function baseCreateWrapper(bindData) {
  var func = bindData[0],
      bitmask = bindData[1],
      partialArgs = bindData[2],
      partialRightArgs = bindData[3],
      thisArg = bindData[4],
      arity = bindData[5];

  var isBind = bitmask & 1,
      isBindKey = bitmask & 2,
      isCurry = bitmask & 4,
      isCurryBound = bitmask & 8,
      key = func;

  function bound() {
    var thisBinding = isBind ? thisArg : this;
    if (partialArgs) {
      var args = slice(partialArgs);
      push.apply(args, arguments);
    }
    if (partialRightArgs || isCurry) {
      args || (args = slice(arguments));
      if (partialRightArgs) {
        push.apply(args, partialRightArgs);
      }
      if (isCurry && args.length < arity) {
        bitmask |= 16 & ~32;
        return baseCreateWrapper([func, (isCurryBound ? bitmask : bitmask & ~3), args, null, thisArg, arity]);
      }
    }
    args || (args = arguments);
    if (isBindKey) {
      func = thisBinding[key];
    }
    if (this instanceof bound) {
      thisBinding = baseCreate(func.prototype);
      var result = func.apply(thisBinding, args);
      return isObject(result) ? result : thisBinding;
    }
    return func.apply(thisBinding, args);
  }
  setBindData(bound, bindData);
  return bound;
}

module.exports = baseCreateWrapper;

},{"../objects/isObject":59,"./baseCreate":48,"./setBindData":54,"./slice":56}],51:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var baseBind = _dereq_('./baseBind'),
    baseCreateWrapper = _dereq_('./baseCreateWrapper'),
    isFunction = _dereq_('../objects/isFunction'),
    slice = _dereq_('./slice');

/**
 * Used for `Array` method references.
 *
 * Normally `Array.prototype` would suffice, however, using an array literal
 * avoids issues in Narwhal.
 */
var arrayRef = [];

/** Native method shortcuts */
var push = arrayRef.push,
    unshift = arrayRef.unshift;

/**
 * Creates a function that, when called, either curries or invokes `func`
 * with an optional `this` binding and partially applied arguments.
 *
 * @private
 * @param {Function|string} func The function or method name to reference.
 * @param {number} bitmask The bitmask of method flags to compose.
 *  The bitmask may be composed of the following flags:
 *  1 - `_.bind`
 *  2 - `_.bindKey`
 *  4 - `_.curry`
 *  8 - `_.curry` (bound)
 *  16 - `_.partial`
 *  32 - `_.partialRight`
 * @param {Array} [partialArgs] An array of arguments to prepend to those
 *  provided to the new function.
 * @param {Array} [partialRightArgs] An array of arguments to append to those
 *  provided to the new function.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new function.
 */
function createWrapper(func, bitmask, partialArgs, partialRightArgs, thisArg, arity) {
  var isBind = bitmask & 1,
      isBindKey = bitmask & 2,
      isCurry = bitmask & 4,
      isCurryBound = bitmask & 8,
      isPartial = bitmask & 16,
      isPartialRight = bitmask & 32;

  if (!isBindKey && !isFunction(func)) {
    throw new TypeError;
  }
  if (isPartial && !partialArgs.length) {
    bitmask &= ~16;
    isPartial = partialArgs = false;
  }
  if (isPartialRight && !partialRightArgs.length) {
    bitmask &= ~32;
    isPartialRight = partialRightArgs = false;
  }
  var bindData = func && func.__bindData__;
  if (bindData && bindData !== true) {
    // clone `bindData`
    bindData = slice(bindData);
    if (bindData[2]) {
      bindData[2] = slice(bindData[2]);
    }
    if (bindData[3]) {
      bindData[3] = slice(bindData[3]);
    }
    // set `thisBinding` is not previously bound
    if (isBind && !(bindData[1] & 1)) {
      bindData[4] = thisArg;
    }
    // set if previously bound but not currently (subsequent curried functions)
    if (!isBind && bindData[1] & 1) {
      bitmask |= 8;
    }
    // set curried arity if not yet set
    if (isCurry && !(bindData[1] & 4)) {
      bindData[5] = arity;
    }
    // append partial left arguments
    if (isPartial) {
      push.apply(bindData[2] || (bindData[2] = []), partialArgs);
    }
    // append partial right arguments
    if (isPartialRight) {
      unshift.apply(bindData[3] || (bindData[3] = []), partialRightArgs);
    }
    // merge flags
    bindData[1] |= bitmask;
    return createWrapper.apply(null, bindData);
  }
  // fast path for `_.bind`
  var creater = (bitmask == 1 || bitmask === 17) ? baseBind : baseCreateWrapper;
  return creater([func, bitmask, partialArgs, partialRightArgs, thisArg, arity]);
}

module.exports = createWrapper;

},{"../objects/isFunction":58,"./baseBind":47,"./baseCreateWrapper":50,"./slice":56}],52:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */

/** Used for native method references */
var objectProto = Object.prototype;

/** Used to resolve the internal [[Class]] of values */
var toString = objectProto.toString;

/** Used to detect if a method is native */
var reNative = RegExp('^' +
  String(toString)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/toString| for [^\]]+/g, '.*?') + '$'
);

/**
 * Checks if `value` is a native function.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if the `value` is a native function, else `false`.
 */
function isNative(value) {
  return typeof value == 'function' && reNative.test(value);
}

module.exports = isNative;

},{}],53:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */

/** Used to determine if values are of the language type Object */
var objectTypes = {
  'boolean': false,
  'function': true,
  'object': true,
  'number': false,
  'string': false,
  'undefined': false
};

module.exports = objectTypes;

},{}],54:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var isNative = _dereq_('./isNative'),
    noop = _dereq_('../utilities/noop');

/** Used as the property descriptor for `__bindData__` */
var descriptor = {
  'configurable': false,
  'enumerable': false,
  'value': null,
  'writable': false
};

/** Used to set meta data on functions */
var defineProperty = (function() {
  // IE 8 only accepts DOM elements
  try {
    var o = {},
        func = isNative(func = Object.defineProperty) && func,
        result = func(o, o, o) && func;
  } catch(e) { }
  return result;
}());

/**
 * Sets `this` binding data on a given function.
 *
 * @private
 * @param {Function} func The function to set data on.
 * @param {Array} value The data array to set.
 */
var setBindData = !defineProperty ? noop : function(func, value) {
  descriptor.value = value;
  defineProperty(func, '__bindData__', descriptor);
};

module.exports = setBindData;

},{"../utilities/noop":63,"./isNative":52}],55:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var objectTypes = _dereq_('./objectTypes');

/** Used for native method references */
var objectProto = Object.prototype;

/** Native method shortcuts */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A fallback implementation of `Object.keys` which produces an array of the
 * given object's own enumerable property names.
 *
 * @private
 * @type Function
 * @param {Object} object The object to inspect.
 * @returns {Array} Returns an array of property names.
 */
var shimKeys = function(object) {
  var index, iterable = object, result = [];
  if (!iterable) return result;
  if (!(objectTypes[typeof object])) return result;
    for (index in iterable) {
      if (hasOwnProperty.call(iterable, index)) {
        result.push(index);
      }
    }
  return result
};

module.exports = shimKeys;

},{"./objectTypes":53}],56:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */

/**
 * Slices the `collection` from the `start` index up to, but not including,
 * the `end` index.
 *
 * Note: This function is used instead of `Array#slice` to support node lists
 * in IE < 9 and to ensure dense arrays are returned.
 *
 * @private
 * @param {Array|Object|string} collection The collection to slice.
 * @param {number} start The start index.
 * @param {number} end The end index.
 * @returns {Array} Returns the new array.
 */
function slice(array, start, end) {
  start || (start = 0);
  if (typeof end == 'undefined') {
    end = array ? array.length : 0;
  }
  var index = -1,
      length = end - start || 0,
      result = Array(length < 0 ? 0 : length);

  while (++index < length) {
    result[index] = array[start + index];
  }
  return result;
}

module.exports = slice;

},{}],57:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var baseCreateCallback = _dereq_('../internals/baseCreateCallback'),
    keys = _dereq_('./keys'),
    objectTypes = _dereq_('../internals/objectTypes');

/**
 * Assigns own enumerable properties of source object(s) to the destination
 * object. Subsequent sources will overwrite property assignments of previous
 * sources. If a callback is provided it will be executed to produce the
 * assigned values. The callback is bound to `thisArg` and invoked with two
 * arguments; (objectValue, sourceValue).
 *
 * @static
 * @memberOf _
 * @type Function
 * @alias extend
 * @category Objects
 * @param {Object} object The destination object.
 * @param {...Object} [source] The source objects.
 * @param {Function} [callback] The function to customize assigning values.
 * @param {*} [thisArg] The `this` binding of `callback`.
 * @returns {Object} Returns the destination object.
 * @example
 *
 * _.assign({ 'name': 'fred' }, { 'employer': 'slate' });
 * // => { 'name': 'fred', 'employer': 'slate' }
 *
 * var defaults = _.partialRight(_.assign, function(a, b) {
 *   return typeof a == 'undefined' ? b : a;
 * });
 *
 * var object = { 'name': 'barney' };
 * defaults(object, { 'name': 'fred', 'employer': 'slate' });
 * // => { 'name': 'barney', 'employer': 'slate' }
 */
var assign = function(object, source, guard) {
  var index, iterable = object, result = iterable;
  if (!iterable) return result;
  var args = arguments,
      argsIndex = 0,
      argsLength = typeof guard == 'number' ? 2 : args.length;
  if (argsLength > 3 && typeof args[argsLength - 2] == 'function') {
    var callback = baseCreateCallback(args[--argsLength - 1], args[argsLength--], 2);
  } else if (argsLength > 2 && typeof args[argsLength - 1] == 'function') {
    callback = args[--argsLength];
  }
  while (++argsIndex < argsLength) {
    iterable = args[argsIndex];
    if (iterable && objectTypes[typeof iterable]) {
    var ownIndex = -1,
        ownProps = objectTypes[typeof iterable] && keys(iterable),
        length = ownProps ? ownProps.length : 0;

    while (++ownIndex < length) {
      index = ownProps[ownIndex];
      result[index] = callback ? callback(result[index], iterable[index]) : iterable[index];
    }
    }
  }
  return result
};

module.exports = assign;

},{"../internals/baseCreateCallback":49,"../internals/objectTypes":53,"./keys":60}],58:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */

/**
 * Checks if `value` is a function.
 *
 * @static
 * @memberOf _
 * @category Objects
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if the `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 */
function isFunction(value) {
  return typeof value == 'function';
}

module.exports = isFunction;

},{}],59:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var objectTypes = _dereq_('../internals/objectTypes');

/**
 * Checks if `value` is the language type of Object.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Objects
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if the `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // check if the value is the ECMAScript language type of Object
  // http://es5.github.io/#x8
  // and avoid a V8 bug
  // http://code.google.com/p/v8/issues/detail?id=2291
  return !!(value && objectTypes[typeof value]);
}

module.exports = isObject;

},{"../internals/objectTypes":53}],60:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var isNative = _dereq_('../internals/isNative'),
    isObject = _dereq_('./isObject'),
    shimKeys = _dereq_('../internals/shimKeys');

/* Native method shortcuts for methods with the same name as other `lodash` methods */
var nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys;

/**
 * Creates an array composed of the own enumerable property names of an object.
 *
 * @static
 * @memberOf _
 * @category Objects
 * @param {Object} object The object to inspect.
 * @returns {Array} Returns an array of property names.
 * @example
 *
 * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
 * // => ['one', 'two', 'three'] (property order is not guaranteed across environments)
 */
var keys = !nativeKeys ? shimKeys : function(object) {
  if (!isObject(object)) {
    return [];
  }
  return nativeKeys(object);
};

module.exports = keys;

},{"../internals/isNative":52,"../internals/shimKeys":55,"./isObject":59}],61:[function(_dereq_,module,exports){
(function (global){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
var isNative = _dereq_('./internals/isNative');

/** Used to detect functions containing a `this` reference */
var reThis = /\bthis\b/;

/**
 * An object used to flag environments features.
 *
 * @static
 * @memberOf _
 * @type Object
 */
var support = {};

/**
 * Detect if functions can be decompiled by `Function#toString`
 * (all but PS3 and older Opera mobile browsers & avoided in Windows 8 apps).
 *
 * @memberOf _.support
 * @type boolean
 */
support.funcDecomp = !isNative(global.WinRTError) && reThis.test(function() { return this; });

/**
 * Detect if `Function#name` is supported (all but IE).
 *
 * @memberOf _.support
 * @type boolean
 */
support.funcNames = typeof Function.name == 'string';

module.exports = support;

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./internals/isNative":52}],62:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */

/**
 * This method returns the first argument provided to it.
 *
 * @static
 * @memberOf _
 * @category Utilities
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'name': 'fred' };
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = identity;

},{}],63:[function(_dereq_,module,exports){
/**
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modularize modern exports="node" -o ./modern/`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */

/**
 * A no-operation function.
 *
 * @static
 * @memberOf _
 * @category Utilities
 * @example
 *
 * var object = { 'name': 'fred' };
 * _.noop(object) === undefined;
 * // => true
 */
function noop() {
  // no operation performed
}

module.exports = noop;

},{}],64:[function(_dereq_,module,exports){
(function(definition){if(typeof exports==="object"){module.exports=definition();}else if(typeof define==="function"&&define.amd){define(definition);}else{mori=definition();}})(function(){return function(){
var g,aa=this;
function m(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";else if("function"==
b&&"undefined"==typeof a.call)return"object";return b}var ba="closure_uid_"+(1E9*Math.random()>>>0),ca=0;function p(a,b){var c=a.split("."),d=aa;c[0]in d||!d.execScript||d.execScript("var "+c[0]);for(var e;c.length&&(e=c.shift());)c.length||void 0===b?d=d[e]?d[e]:d[e]={}:d[e]=b};function da(a,b){for(var c in a)b.call(void 0,a[c],c,a)};function ea(a,b){null!=a&&this.append.apply(this,arguments)}ea.prototype.Va="";ea.prototype.append=function(a,b,c){this.Va+=a;if(null!=b)for(var d=1;d<arguments.length;d++)this.Va+=arguments[d];return this};ea.prototype.toString=function(){return this.Va};function fa(a,b){a.sort(b||ga)}function ha(a,b){for(var c=0;c<a.length;c++)a[c]={index:c,value:a[c]};var d=b||ga;fa(a,function(a,b){return d(a.value,b.value)||a.index-b.index});for(c=0;c<a.length;c++)a[c]=a[c].value}function ga(a,b){return a>b?1:a<b?-1:0};var ia=null,ja=null;function ka(){return new la(null,5,[ma,!0,oa,!0,pa,!1,qa,!1,ra,ia],null)}function r(a){return null!=a&&!1!==a}function sa(a){return r(a)?!1:!0}function s(a,b){return a[m(null==b?null:b)]?!0:a._?!0:u?!1:null}function ta(a){return null==a?null:a.constructor}function x(a,b){var c=ta(b),c=r(r(c)?c.Db:c)?c.Bb:m(b);return Error(["No protocol method ",a," defined for type ",c,": ",b].join(""))}function ua(a){var b=a.Bb;return r(b)?b:""+A.b(a)}
function va(a){for(var b=a.length,c=Array(b),d=0;;)if(d<b)c[d]=a[d],d+=1;else break;return c}function wa(a){return Array.prototype.slice.call(arguments)}
var xa=function(){function a(a,b){return C.c?C.c(function(a,b){a.push(b);return a},[],b):C.call(null,function(a,b){a.push(b);return a},[],b)}function b(a){return c.a(null,a)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,0,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),ya={},za={};
function Aa(a){if(a?a.L:a)return a.L(a);var b;b=Aa[m(null==a?null:a)];if(!b&&(b=Aa._,!b))throw x("ICounted.-count",a);return b.call(null,a)}function Ba(a){if(a?a.I:a)return a.I(a);var b;b=Ba[m(null==a?null:a)];if(!b&&(b=Ba._,!b))throw x("IEmptyableCollection.-empty",a);return b.call(null,a)}var Ca={};function Da(a,b){if(a?a.G:a)return a.G(a,b);var c;c=Da[m(null==a?null:a)];if(!c&&(c=Da._,!c))throw x("ICollection.-conj",a);return c.call(null,a,b)}
var Ea={},D=function(){function a(a,b,c){if(a?a.aa:a)return a.aa(a,b,c);var h;h=D[m(null==a?null:a)];if(!h&&(h=D._,!h))throw x("IIndexed.-nth",a);return h.call(null,a,b,c)}function b(a,b){if(a?a.J:a)return a.J(a,b);var c;c=D[m(null==a?null:a)];if(!c&&(c=D._,!c))throw x("IIndexed.-nth",a);return c.call(null,a,b)}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),
Fa={};function Ha(a){if(a?a.Q:a)return a.Q(a);var b;b=Ha[m(null==a?null:a)];if(!b&&(b=Ha._,!b))throw x("ISeq.-first",a);return b.call(null,a)}function Ia(a){if(a?a.S:a)return a.S(a);var b;b=Ia[m(null==a?null:a)];if(!b&&(b=Ia._,!b))throw x("ISeq.-rest",a);return b.call(null,a)}
var Ja={},Ka={},La=function(){function a(a,b,c){if(a?a.C:a)return a.C(a,b,c);var h;h=La[m(null==a?null:a)];if(!h&&(h=La._,!h))throw x("ILookup.-lookup",a);return h.call(null,a,b,c)}function b(a,b){if(a?a.u:a)return a.u(a,b);var c;c=La[m(null==a?null:a)];if(!c&&(c=La._,!c))throw x("ILookup.-lookup",a);return c.call(null,a,b)}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=
a;return c}(),Ma={};function Na(a,b){if(a?a.kb:a)return a.kb(a,b);var c;c=Na[m(null==a?null:a)];if(!c&&(c=Na._,!c))throw x("IAssociative.-contains-key?",a);return c.call(null,a,b)}function Oa(a,b,c){if(a?a.ua:a)return a.ua(a,b,c);var d;d=Oa[m(null==a?null:a)];if(!d&&(d=Oa._,!d))throw x("IAssociative.-assoc",a);return d.call(null,a,b,c)}var Pa={};function Qa(a,b){if(a?a.nb:a)return a.nb(a,b);var c;c=Qa[m(null==a?null:a)];if(!c&&(c=Qa._,!c))throw x("IMap.-dissoc",a);return c.call(null,a,b)}var Sa={};
function Ta(a){if(a?a.$a:a)return a.$a(a);var b;b=Ta[m(null==a?null:a)];if(!b&&(b=Ta._,!b))throw x("IMapEntry.-key",a);return b.call(null,a)}function Ua(a){if(a?a.ab:a)return a.ab(a);var b;b=Ua[m(null==a?null:a)];if(!b&&(b=Ua._,!b))throw x("IMapEntry.-val",a);return b.call(null,a)}var Va={};function Wa(a,b){if(a?a.vb:a)return a.vb(a,b);var c;c=Wa[m(null==a?null:a)];if(!c&&(c=Wa._,!c))throw x("ISet.-disjoin",a);return c.call(null,a,b)}
function Xa(a){if(a?a.Ia:a)return a.Ia(a);var b;b=Xa[m(null==a?null:a)];if(!b&&(b=Xa._,!b))throw x("IStack.-peek",a);return b.call(null,a)}function Ya(a){if(a?a.Ja:a)return a.Ja(a);var b;b=Ya[m(null==a?null:a)];if(!b&&(b=Ya._,!b))throw x("IStack.-pop",a);return b.call(null,a)}var Za={};function $a(a,b,c){if(a?a.Pa:a)return a.Pa(a,b,c);var d;d=$a[m(null==a?null:a)];if(!d&&(d=$a._,!d))throw x("IVector.-assoc-n",a);return d.call(null,a,b,c)}
function ab(a){if(a?a.ub:a)return a.ub(a);var b;b=ab[m(null==a?null:a)];if(!b&&(b=ab._,!b))throw x("IDeref.-deref",a);return b.call(null,a)}var bb={};function cb(a){if(a?a.D:a)return a.D(a);var b;b=cb[m(null==a?null:a)];if(!b&&(b=cb._,!b))throw x("IMeta.-meta",a);return b.call(null,a)}var db={};function eb(a,b){if(a?a.F:a)return a.F(a,b);var c;c=eb[m(null==a?null:a)];if(!c&&(c=eb._,!c))throw x("IWithMeta.-with-meta",a);return c.call(null,a,b)}
var fb={},gb=function(){function a(a,b,c){if(a?a.M:a)return a.M(a,b,c);var h;h=gb[m(null==a?null:a)];if(!h&&(h=gb._,!h))throw x("IReduce.-reduce",a);return h.call(null,a,b,c)}function b(a,b){if(a?a.N:a)return a.N(a,b);var c;c=gb[m(null==a?null:a)];if(!c&&(c=gb._,!c))throw x("IReduce.-reduce",a);return c.call(null,a,b)}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}();
function hb(a,b,c){if(a?a.Za:a)return a.Za(a,b,c);var d;d=hb[m(null==a?null:a)];if(!d&&(d=hb._,!d))throw x("IKVReduce.-kv-reduce",a);return d.call(null,a,b,c)}function ib(a,b){if(a?a.v:a)return a.v(a,b);var c;c=ib[m(null==a?null:a)];if(!c&&(c=ib._,!c))throw x("IEquiv.-equiv",a);return c.call(null,a,b)}function jb(a){if(a?a.B:a)return a.B(a);var b;b=jb[m(null==a?null:a)];if(!b&&(b=jb._,!b))throw x("IHash.-hash",a);return b.call(null,a)}var kb={};
function lb(a){if(a?a.H:a)return a.H(a);var b;b=lb[m(null==a?null:a)];if(!b&&(b=lb._,!b))throw x("ISeqable.-seq",a);return b.call(null,a)}var mb={},nb={},ob={};function pb(a){if(a?a.Xa:a)return a.Xa(a);var b;b=pb[m(null==a?null:a)];if(!b&&(b=pb._,!b))throw x("IReversible.-rseq",a);return b.call(null,a)}function qb(a,b){if(a?a.yb:a)return a.yb(a,b);var c;c=qb[m(null==a?null:a)];if(!c&&(c=qb._,!c))throw x("ISorted.-sorted-seq",a);return c.call(null,a,b)}
function rb(a,b,c){if(a?a.zb:a)return a.zb(a,b,c);var d;d=rb[m(null==a?null:a)];if(!d&&(d=rb._,!d))throw x("ISorted.-sorted-seq-from",a);return d.call(null,a,b,c)}function sb(a,b){if(a?a.xb:a)return a.xb(a,b);var c;c=sb[m(null==a?null:a)];if(!c&&(c=sb._,!c))throw x("ISorted.-entry-key",a);return c.call(null,a,b)}function tb(a){if(a?a.wb:a)return a.wb(a);var b;b=tb[m(null==a?null:a)];if(!b&&(b=tb._,!b))throw x("ISorted.-comparator",a);return b.call(null,a)}
function ub(a,b){if(a?a.Sb:a)return a.Sb(0,b);var c;c=ub[m(null==a?null:a)];if(!c&&(c=ub._,!c))throw x("IWriter.-write",a);return c.call(null,a,b)}var vb={};function wb(a,b,c){if(a?a.w:a)return a.w(a,b,c);var d;d=wb[m(null==a?null:a)];if(!d&&(d=wb._,!d))throw x("IPrintWithWriter.-pr-writer",a);return d.call(null,a,b,c)}function xb(a,b,c){if(a?a.Rb:a)return a.Rb(0,b,c);var d;d=xb[m(null==a?null:a)];if(!d&&(d=xb._,!d))throw x("IWatchable.-notify-watches",a);return d.call(null,a,b,c)}
function yb(a){if(a?a.Wa:a)return a.Wa(a);var b;b=yb[m(null==a?null:a)];if(!b&&(b=yb._,!b))throw x("IEditableCollection.-as-transient",a);return b.call(null,a)}function zb(a,b){if(a?a.Ka:a)return a.Ka(a,b);var c;c=zb[m(null==a?null:a)];if(!c&&(c=zb._,!c))throw x("ITransientCollection.-conj!",a);return c.call(null,a,b)}function Ab(a){if(a?a.Oa:a)return a.Oa(a);var b;b=Ab[m(null==a?null:a)];if(!b&&(b=Ab._,!b))throw x("ITransientCollection.-persistent!",a);return b.call(null,a)}
function Bb(a,b,c){if(a?a.cb:a)return a.cb(a,b,c);var d;d=Bb[m(null==a?null:a)];if(!d&&(d=Bb._,!d))throw x("ITransientAssociative.-assoc!",a);return d.call(null,a,b,c)}function Cb(a,b){if(a?a.Ab:a)return a.Ab(a,b);var c;c=Cb[m(null==a?null:a)];if(!c&&(c=Cb._,!c))throw x("ITransientMap.-dissoc!",a);return c.call(null,a,b)}function Db(a,b,c){if(a?a.Pb:a)return a.Pb(0,b,c);var d;d=Db[m(null==a?null:a)];if(!d&&(d=Db._,!d))throw x("ITransientVector.-assoc-n!",a);return d.call(null,a,b,c)}
function Eb(a){if(a?a.Qb:a)return a.Qb();var b;b=Eb[m(null==a?null:a)];if(!b&&(b=Eb._,!b))throw x("ITransientVector.-pop!",a);return b.call(null,a)}function Fb(a,b){if(a?a.Ob:a)return a.Ob(0,b);var c;c=Fb[m(null==a?null:a)];if(!c&&(c=Fb._,!c))throw x("ITransientSet.-disjoin!",a);return c.call(null,a,b)}function Gb(a){if(a?a.Kb:a)return a.Kb();var b;b=Gb[m(null==a?null:a)];if(!b&&(b=Gb._,!b))throw x("IChunk.-drop-first",a);return b.call(null,a)}
function Hb(a){if(a?a.sb:a)return a.sb(a);var b;b=Hb[m(null==a?null:a)];if(!b&&(b=Hb._,!b))throw x("IChunkedSeq.-chunked-first",a);return b.call(null,a)}function Ib(a){if(a?a.tb:a)return a.tb(a);var b;b=Ib[m(null==a?null:a)];if(!b&&(b=Ib._,!b))throw x("IChunkedSeq.-chunked-rest",a);return b.call(null,a)}function Jb(a){if(a?a.rb:a)return a.rb(a);var b;b=Jb[m(null==a?null:a)];if(!b&&(b=Jb._,!b))throw x("IChunkedNext.-chunked-next",a);return b.call(null,a)}
function Kb(a){this.vc=a;this.q=0;this.i=1073741824}Kb.prototype.Sb=function(a,b){return this.vc.append(b)};function Lb(a){var b=new ea;a.w(null,new Kb(b),ka());return""+A.b(b)}var Mb="undefined"!==typeof Math.imul&&0!==(Math.imul.a?Math.imul.a(4294967295,5):Math.imul.call(null,4294967295,5))?function(a,b){return Math.imul(a,b)}:function(a,b){var c=a&65535,d=b&65535;return c*d+((a>>>16&65535)*d+c*(b>>>16&65535)<<16>>>0)|0};function Nb(a){a=Mb(a,3432918353);return Mb(a<<15|a>>>-15,461845907)}
function Ob(a,b){var c=a^b;return Mb(c<<13|c>>>-13,5)+3864292196}function Pb(a,b){var c=a^b,c=Mb(c^c>>>16,2246822507),c=Mb(c^c>>>13,3266489909);return c^c>>>16}var Qb={},Rb=0;function Sb(a){255<Rb&&(Qb={},Rb=0);var b=Qb[a];if("number"!==typeof b){a:if(null!=a)if(b=a.length,0<b){for(var c=0,d=0;;)if(c<b)var e=c+1,d=Mb(31,d)+a.charCodeAt(c),c=e;else{b=d;break a}b=void 0}else b=0;else b=0;Qb[a]=b;Rb+=1}return a=b}
function Tb(a){a&&(a.i&4194304||a.Dc)?a=a.B(null):"number"===typeof a?a=Math.floor(a)%2147483647:!0===a?a=1:!1===a?a=0:"string"===typeof a?(a=Sb(a),0!==a&&(a=Nb(a),a=Ob(0,a),a=Pb(a,4))):a=null==a?0:u?jb(a):null;return a}
function Ub(a){var b;b=a.name;var c;a:{c=1;for(var d=0;;)if(c<b.length){var e=c+2,d=Ob(d,Nb(b.charCodeAt(c-1)|b.charCodeAt(c)<<16));c=e}else{c=d;break a}c=void 0}c=1===(b.length&1)?c^Nb(b.charCodeAt(b.length-1)):c;b=Pb(c,Mb(2,b.length));a=Sb(a.fa);return b^a+2654435769+(b<<6)+(b>>2)}
function Vb(a,b){if(r(Wb.a?Wb.a(a,b):Wb.call(null,a,b)))return 0;var c=sa(a.fa);if(r(c?b.fa:c))return-1;if(r(a.fa)){if(sa(b.fa))return 1;c=Xb.a?Xb.a(a.fa,b.fa):Xb.call(null,a.fa,b.fa);return 0===c?Xb.a?Xb.a(a.name,b.name):Xb.call(null,a.name,b.name):c}return Yb?Xb.a?Xb.a(a.name,b.name):Xb.call(null,a.name,b.name):null}function Zb(a,b,c,d,e){this.fa=a;this.name=b;this.Na=c;this.Ua=d;this.W=e;this.i=2154168321;this.q=4096}g=Zb.prototype;g.w=function(a,b){return ub(b,this.Na)};
g.B=function(){var a=this.Ua;return null!=a?a:this.Ua=a=Ub(this)};g.F=function(a,b){return new Zb(this.fa,this.name,this.Na,this.Ua,b)};g.D=function(){return this.W};g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return La.c(c,this,null);case 3:return La.c(c,this,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return La.c(a,this,null)};
g.a=function(a,b){return La.c(a,this,b)};g.v=function(a,b){return b instanceof Zb?this.Na===b.Na:!1};g.toString=function(){return this.Na};var $b=function(){function a(a,b){var c=null!=a?""+A.b(a)+"/"+A.b(b):b;return new Zb(a,b,c,null,null)}function b(a){return a instanceof Zb?a:c.a(null,a)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}();
function E(a){if(null==a)return null;if(a&&(a.i&8388608||a.hc))return a.H(null);if(a instanceof Array||"string"===typeof a)return 0===a.length?null:new ac(a,0);if(s(kb,a))return lb(a);if(u)throw Error(""+A.b(a)+" is not ISeqable");return null}function F(a){if(null==a)return null;if(a&&(a.i&64||a.bb))return a.Q(null);a=E(a);return null==a?null:Ha(a)}function G(a){return null!=a?a&&(a.i&64||a.bb)?a.S(null):(a=E(a))?Ia(a):H:H}function I(a){return null==a?null:a&&(a.i&128||a.ob)?a.U(null):E(G(a))}
var Wb=function(){function a(a,b){return null==a?null==b:a===b||ib(a,b)}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){for(;;)if(b.a(a,d))if(I(e))a=d,d=F(e),e=I(e);else return b.a(d,F(e));else return!1}a.k=2;a.f=function(a){var b=F(a);a=I(a);var d=F(a);a=G(a);return c(b,d,a)};a.d=c;return a}(),b=function(b,e,f){switch(arguments.length){case 1:return!0;case 2:return a.call(this,b,
e);default:return c.d(b,e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.k=2;b.f=c.f;b.b=function(){return!0};b.a=a;b.d=c.d;return b}();function bc(a,b){var c=Nb(a),c=Ob(0,c);return Pb(c,b)}function cc(a){var b=0,c=1;for(a=E(a);;)if(null!=a)b+=1,c=Mb(31,c)+Tb(F(a))|0,a=I(a);else return bc(c,b)}function dc(a){var b=0,c=0;for(a=E(a);;)if(null!=a)b+=1,c=c+Tb(F(a))|0,a=I(a);else return bc(c,b)}za["null"]=!0;Aa["null"]=function(){return 0};
Date.prototype.v=function(a,b){return b instanceof Date&&this.toString()===b.toString()};ib.number=function(a,b){return a===b};bb["function"]=!0;cb["function"]=function(){return null};ya["function"]=!0;jb._=function(a){return a[ba]||(a[ba]=++ca)};function ec(a){this.l=a;this.q=0;this.i=32768}ec.prototype.ub=function(){return this.l};function fc(a){return a instanceof ec}
var gc=function(){function a(a,b,c,d){for(var l=Aa(a);;)if(d<l){c=b.a?b.a(c,D.a(a,d)):b.call(null,c,D.a(a,d));if(fc(c))return K.b?K.b(c):K.call(null,c);d+=1}else return c}function b(a,b,c){for(var d=Aa(a),l=0;;)if(l<d){c=b.a?b.a(c,D.a(a,l)):b.call(null,c,D.a(a,l));if(fc(c))return K.b?K.b(c):K.call(null,c);l+=1}else return c}function c(a,b){var c=Aa(a);if(0===c)return b.o?b.o():b.call(null);for(var d=D.a(a,0),l=1;;)if(l<c){d=b.a?b.a(d,D.a(a,l)):b.call(null,d,D.a(a,l));if(fc(d))return K.b?K.b(d):K.call(null,
d);l+=1}else return d}var d=null,d=function(d,f,h,k){switch(arguments.length){case 2:return c.call(this,d,f);case 3:return b.call(this,d,f,h);case 4:return a.call(this,d,f,h,k)}throw Error("Invalid arity: "+arguments.length);};d.a=c;d.c=b;d.n=a;return d}(),hc=function(){function a(a,b,c,d){for(var l=a.length;;)if(d<l){c=b.a?b.a(c,a[d]):b.call(null,c,a[d]);if(fc(c))return K.b?K.b(c):K.call(null,c);d+=1}else return c}function b(a,b,c){for(var d=a.length,l=0;;)if(l<d){c=b.a?b.a(c,a[l]):b.call(null,c,
a[l]);if(fc(c))return K.b?K.b(c):K.call(null,c);l+=1}else return c}function c(a,b){var c=a.length;if(0===a.length)return b.o?b.o():b.call(null);for(var d=a[0],l=1;;)if(l<c){d=b.a?b.a(d,a[l]):b.call(null,d,a[l]);if(fc(d))return K.b?K.b(d):K.call(null,d);l+=1}else return d}var d=null,d=function(d,f,h,k){switch(arguments.length){case 2:return c.call(this,d,f);case 3:return b.call(this,d,f,h);case 4:return a.call(this,d,f,h,k)}throw Error("Invalid arity: "+arguments.length);};d.a=c;d.c=b;d.n=a;return d}();
function ic(a){return a?a.i&2||a.Yb?!0:a.i?!1:s(za,a):s(za,a)}function jc(a){return a?a.i&16||a.Lb?!0:a.i?!1:s(Ea,a):s(Ea,a)}function ac(a,b){this.e=a;this.p=b;this.i=166199550;this.q=8192}g=ac.prototype;g.toString=function(){return Lb(this)};g.J=function(a,b){var c=b+this.p;return c<this.e.length?this.e[c]:null};g.aa=function(a,b,c){a=b+this.p;return a<this.e.length?this.e[a]:c};g.U=function(){return this.p+1<this.e.length?new ac(this.e,this.p+1):null};g.L=function(){return this.e.length-this.p};
g.Xa=function(){var a=Aa(this);return 0<a?new kc(this,a-1,null):null};g.B=function(){return cc(this)};g.v=function(a,b){return lc.a?lc.a(this,b):lc.call(null,this,b)};g.I=function(){return H};g.N=function(a,b){return hc.n(this.e,b,this.e[this.p],this.p+1)};g.M=function(a,b,c){return hc.n(this.e,b,c,this.p)};g.Q=function(){return this.e[this.p]};g.S=function(){return this.p+1<this.e.length?new ac(this.e,this.p+1):H};g.H=function(){return this};
g.G=function(a,b){return M.a?M.a(b,this):M.call(null,b,this)};
var mc=function(){function a(a,b){return b<a.length?new ac(a,b):null}function b(a){return c.a(a,0)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),J=function(){function a(a,b){return mc.a(a,b)}function b(a){return mc.a(a,0)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+
arguments.length);};c.b=b;c.a=a;return c}();function kc(a,b,c){this.jb=a;this.p=b;this.j=c;this.i=32374990;this.q=8192}g=kc.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.j};g.U=function(){return 0<this.p?new kc(this.jb,this.p-1,null):null};g.L=function(){return this.p+1};g.B=function(){return cc(this)};g.v=function(a,b){return lc.a?lc.a(this,b):lc.call(null,this,b)};g.I=function(){return N.a?N.a(H,this.j):N.call(null,H,this.j)};
g.N=function(a,b){return nc.a?nc.a(b,this):nc.call(null,b,this)};g.M=function(a,b,c){return nc.c?nc.c(b,c,this):nc.call(null,b,c,this)};g.Q=function(){return D.a(this.jb,this.p)};g.S=function(){return 0<this.p?new kc(this.jb,this.p-1,null):H};g.H=function(){return this};g.F=function(a,b){return new kc(this.jb,this.p,b)};g.G=function(a,b){return M.a?M.a(b,this):M.call(null,b,this)};function oc(a){for(;;){var b=I(a);if(null!=b)a=b;else return F(a)}}ib._=function(a,b){return a===b};
var pc=function(){function a(a,b){return null!=a?Da(a,b):Da(H,b)}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){for(;;)if(r(e))a=b.a(a,d),d=F(e),e=I(e);else return b.a(a,d)}a.k=2;a.f=function(a){var b=F(a);a=I(a);var d=F(a);a=G(a);return c(b,d,a)};a.d=c;return a}(),b=function(b,e,f){switch(arguments.length){case 2:return a.call(this,b,e);default:return c.d(b,e,J(arguments,2))}throw Error("Invalid arity: "+
arguments.length);};b.k=2;b.f=c.f;b.a=a;b.d=c.d;return b}();function qc(a){return null==a?null:Ba(a)}function O(a){if(null!=a)if(a&&(a.i&2||a.Yb))a=a.L(null);else if(a instanceof Array)a=a.length;else if("string"===typeof a)a=a.length;else if(s(za,a))a=Aa(a);else if(u)a:{a=E(a);for(var b=0;;){if(ic(a)){a=b+Aa(a);break a}a=I(a);b+=1}a=void 0}else a=null;else a=0;return a}
var rc=function(){function a(a,b,c){for(;;){if(null==a)return c;if(0===b)return E(a)?F(a):c;if(jc(a))return D.c(a,b,c);if(E(a))a=I(a),b-=1;else return u?c:null}}function b(a,b){for(;;){if(null==a)throw Error("Index out of bounds");if(0===b){if(E(a))return F(a);throw Error("Index out of bounds");}if(jc(a))return D.a(a,b);if(E(a)){var c=I(a),h=b-1;a=c;b=h}else{if(u)throw Error("Index out of bounds");return null}}}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,
c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),P=function(){function a(a,b,c){if("number"!==typeof b)throw Error("index argument to nth must be a number.");if(null==a)return c;if(a&&(a.i&16||a.Lb))return a.aa(null,b,c);if(a instanceof Array||"string"===typeof a)return b<a.length?a[b]:c;if(s(Ea,a))return D.a(a,b);if(a?a.i&64||a.bb||(a.i?0:s(Fa,a)):s(Fa,a))return rc.c(a,b,c);if(u)throw Error("nth not supported on this type "+A.b(ua(ta(a))));return null}function b(a,
b){if("number"!==typeof b)throw Error("index argument to nth must be a number");if(null==a)return a;if(a&&(a.i&16||a.Lb))return a.J(null,b);if(a instanceof Array||"string"===typeof a)return b<a.length?a[b]:null;if(s(Ea,a))return D.a(a,b);if(a?a.i&64||a.bb||(a.i?0:s(Fa,a)):s(Fa,a))return rc.a(a,b);if(u)throw Error("nth not supported on this type "+A.b(ua(ta(a))));return null}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+
arguments.length);};c.a=b;c.c=a;return c}(),Q=function(){function a(a,b,c){return null!=a?a&&(a.i&256||a.Mb)?a.C(null,b,c):a instanceof Array?b<a.length?a[b]:c:"string"===typeof a?b<a.length?a[b]:c:s(Ka,a)?La.c(a,b,c):u?c:null:c}function b(a,b){return null==a?null:a&&(a.i&256||a.Mb)?a.u(null,b):a instanceof Array?b<a.length?a[b]:null:"string"===typeof a?b<a.length?a[b]:null:s(Ka,a)?La.a(a,b):null}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,
c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),R=function(){function a(a,b,c){return null!=a?Oa(a,b,c):sc.a?sc.a([b],[c]):sc.call(null,[b],[c])}var b=null,c=function(){function a(b,d,k,l){var n=null;3<arguments.length&&(n=J(Array.prototype.slice.call(arguments,3),0));return c.call(this,b,d,k,n)}function c(a,d,e,l){for(;;)if(a=b.c(a,d,e),r(l))d=F(l),e=F(I(l)),l=I(I(l));else return a}a.k=3;a.f=function(a){var b=F(a);a=I(a);var d=F(a);a=I(a);var l=F(a);a=G(a);return c(b,
d,l,a)};a.d=c;return a}(),b=function(b,e,f,h){switch(arguments.length){case 3:return a.call(this,b,e,f);default:return c.d(b,e,f,J(arguments,3))}throw Error("Invalid arity: "+arguments.length);};b.k=3;b.f=c.f;b.c=a;b.d=c.d;return b}(),tc=function(){function a(a,b){return null==a?null:Qa(a,b)}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){for(;;){if(null==a)return null;a=b.a(a,d);
if(r(e))d=F(e),e=I(e);else return a}}a.k=2;a.f=function(a){var b=F(a);a=I(a);var d=F(a);a=G(a);return c(b,d,a)};a.d=c;return a}(),b=function(b,e,f){switch(arguments.length){case 1:return b;case 2:return a.call(this,b,e);default:return c.d(b,e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.k=2;b.f=c.f;b.b=function(a){return a};b.a=a;b.d=c.d;return b}();function uc(a){var b="function"==m(a);return b?b:a?r(r(null)?null:a.Xb)?!0:a.Cb?!1:s(ya,a):s(ya,a)}
function vc(a,b){this.h=a;this.j=b;this.q=0;this.i=393217}g=vc.prototype;
g.call=function(){var a=null;return a=function(a,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga,Ra,wc){switch(arguments.length){case 1:var z=a,z=this;return z.h.o?z.h.o():z.h.call(null);case 2:return z=a,z=this,z.h.b?z.h.b(c):z.h.call(null,c);case 3:return z=a,z=this,z.h.a?z.h.a(c,d):z.h.call(null,c,d);case 4:return z=a,z=this,z.h.c?z.h.c(c,d,e):z.h.call(null,c,d,e);case 5:return z=a,z=this,z.h.n?z.h.n(c,d,e,f):z.h.call(null,c,d,e,f);case 6:return z=a,z=this,z.h.s?z.h.s(c,d,e,f,h):z.h.call(null,c,d,e,f,
h);case 7:return z=a,z=this,z.h.X?z.h.X(c,d,e,f,h,k):z.h.call(null,c,d,e,f,h,k);case 8:return z=a,z=this,z.h.ga?z.h.ga(c,d,e,f,h,k,l):z.h.call(null,c,d,e,f,h,k,l);case 9:return z=a,z=this,z.h.Ga?z.h.Ga(c,d,e,f,h,k,l,n):z.h.call(null,c,d,e,f,h,k,l,n);case 10:return z=a,z=this,z.h.Ha?z.h.Ha(c,d,e,f,h,k,l,n,q):z.h.call(null,c,d,e,f,h,k,l,n,q);case 11:return z=a,z=this,z.h.va?z.h.va(c,d,e,f,h,k,l,n,q,t):z.h.call(null,c,d,e,f,h,k,l,n,q,t);case 12:return z=a,z=this,z.h.wa?z.h.wa(c,d,e,f,h,k,l,n,q,t,v):
z.h.call(null,c,d,e,f,h,k,l,n,q,t,v);case 13:return z=a,z=this,z.h.xa?z.h.xa(c,d,e,f,h,k,l,n,q,t,v,w):z.h.call(null,c,d,e,f,h,k,l,n,q,t,v,w);case 14:return z=a,z=this,z.h.ya?z.h.ya(c,d,e,f,h,k,l,n,q,t,v,w,y):z.h.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y);case 15:return z=a,z=this,z.h.za?z.h.za(c,d,e,f,h,k,l,n,q,t,v,w,y,B):z.h.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B);case 16:return z=a,z=this,z.h.Aa?z.h.Aa(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L):z.h.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L);case 17:return z=a,z=this,
z.h.Ba?z.h.Ba(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U):z.h.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U);case 18:return z=a,z=this,z.h.Ca?z.h.Ca(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z):z.h.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z);case 19:return z=a,z=this,z.h.Da?z.h.Da(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na):z.h.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na);case 20:return z=a,z=this,z.h.Ea?z.h.Ea(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga):z.h.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga);case 21:return z=
a,z=this,z.h.Fa?z.h.Fa(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga,Ra):z.h.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga,Ra);case 22:return z=a,z=this,S.bc?S.bc(z.h,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga,Ra,wc):S.call(null,z.h,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga,Ra,wc)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.o=function(){return this.h.o?this.h.o():this.h.call(null)};
g.b=function(a){return this.h.b?this.h.b(a):this.h.call(null,a)};g.a=function(a,b){return this.h.a?this.h.a(a,b):this.h.call(null,a,b)};g.c=function(a,b,c){return this.h.c?this.h.c(a,b,c):this.h.call(null,a,b,c)};g.n=function(a,b,c,d){return this.h.n?this.h.n(a,b,c,d):this.h.call(null,a,b,c,d)};g.s=function(a,b,c,d,e){return this.h.s?this.h.s(a,b,c,d,e):this.h.call(null,a,b,c,d,e)};g.X=function(a,b,c,d,e,f){return this.h.X?this.h.X(a,b,c,d,e,f):this.h.call(null,a,b,c,d,e,f)};
g.ga=function(a,b,c,d,e,f,h){return this.h.ga?this.h.ga(a,b,c,d,e,f,h):this.h.call(null,a,b,c,d,e,f,h)};g.Ga=function(a,b,c,d,e,f,h,k){return this.h.Ga?this.h.Ga(a,b,c,d,e,f,h,k):this.h.call(null,a,b,c,d,e,f,h,k)};g.Ha=function(a,b,c,d,e,f,h,k,l){return this.h.Ha?this.h.Ha(a,b,c,d,e,f,h,k,l):this.h.call(null,a,b,c,d,e,f,h,k,l)};g.va=function(a,b,c,d,e,f,h,k,l,n){return this.h.va?this.h.va(a,b,c,d,e,f,h,k,l,n):this.h.call(null,a,b,c,d,e,f,h,k,l,n)};
g.wa=function(a,b,c,d,e,f,h,k,l,n,q){return this.h.wa?this.h.wa(a,b,c,d,e,f,h,k,l,n,q):this.h.call(null,a,b,c,d,e,f,h,k,l,n,q)};g.xa=function(a,b,c,d,e,f,h,k,l,n,q,t){return this.h.xa?this.h.xa(a,b,c,d,e,f,h,k,l,n,q,t):this.h.call(null,a,b,c,d,e,f,h,k,l,n,q,t)};g.ya=function(a,b,c,d,e,f,h,k,l,n,q,t,v){return this.h.ya?this.h.ya(a,b,c,d,e,f,h,k,l,n,q,t,v):this.h.call(null,a,b,c,d,e,f,h,k,l,n,q,t,v)};
g.za=function(a,b,c,d,e,f,h,k,l,n,q,t,v,w){return this.h.za?this.h.za(a,b,c,d,e,f,h,k,l,n,q,t,v,w):this.h.call(null,a,b,c,d,e,f,h,k,l,n,q,t,v,w)};g.Aa=function(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y){return this.h.Aa?this.h.Aa(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y):this.h.call(null,a,b,c,d,e,f,h,k,l,n,q,t,v,w,y)};g.Ba=function(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B){return this.h.Ba?this.h.Ba(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B):this.h.call(null,a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B)};
g.Ca=function(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L){return this.h.Ca?this.h.Ca(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L):this.h.call(null,a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L)};g.Da=function(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U){return this.h.Da?this.h.Da(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U):this.h.call(null,a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U)};
g.Ea=function(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z){return this.h.Ea?this.h.Ea(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z):this.h.call(null,a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z)};g.Fa=function(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na){return this.h.Fa?this.h.Fa(a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na):this.h.call(null,a,b,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na)};g.Xb=!0;g.F=function(a,b){return new vc(this.h,b)};g.D=function(){return this.j};
function N(a,b){return uc(a)&&!(a?a.i&262144||a.oc||(a.i?0:s(db,a)):s(db,a))?new vc(a,b):null==a?null:eb(a,b)}function xc(a){var b=null!=a;return(b?a?a.i&131072||a.ec||(a.i?0:s(bb,a)):s(bb,a):b)?cb(a):null}function yc(a){return null==a?null:Xa(a)}function zc(a){return null==a?null:Ya(a)}
var Ac=function(){function a(a,b){return null==a?null:Wa(a,b)}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){for(;;){if(null==a)return null;a=b.a(a,d);if(r(e))d=F(e),e=I(e);else return a}}a.k=2;a.f=function(a){var b=F(a);a=I(a);var d=F(a);a=G(a);return c(b,d,a)};a.d=c;return a}(),b=function(b,e,f){switch(arguments.length){case 1:return b;case 2:return a.call(this,b,e);default:return c.d(b,
e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.k=2;b.f=c.f;b.b=function(a){return a};b.a=a;b.d=c.d;return b}();function Bc(a){return null==a||sa(E(a))}function Cc(a){return null==a?!1:a?a.i&8||a.Ac?!0:a.i?!1:s(Ca,a):s(Ca,a)}function Dc(a){return null==a?!1:a?a.i&4096||a.jc?!0:a.i?!1:s(Va,a):s(Va,a)}function Ec(a){return a?a.i&512||a.yc?!0:a.i?!1:s(Ma,a):s(Ma,a)}function Fc(a){return a?a.i&16777216||a.ic?!0:a.i?!1:s(mb,a):s(mb,a)}
function Gc(a){return null==a?!1:a?a.i&1024||a.cc?!0:a.i?!1:s(Pa,a):s(Pa,a)}function Hc(a){return a?a.i&16384||a.Gc?!0:a.i?!1:s(Za,a):s(Za,a)}function Ic(a){return a?a.q&512||a.zc?!0:!1:!1}function Jc(a){var b=[];da(a,function(a){return function(b,e){return a.push(e)}}(b));return b}function Kc(a,b,c,d,e){for(;0!==e;)c[d]=a[b],d+=1,e-=1,b+=1}var Lc={};function Mc(a){return null==a?!1:a?a.i&64||a.bb?!0:a.i?!1:s(Fa,a):s(Fa,a)}function Nc(a){return r(a)?!0:!1}
function Oc(a,b){return Q.c(a,b,Lc)===Lc?!1:!0}function Xb(a,b){if(a===b)return 0;if(null==a)return-1;if(null==b)return 1;if(ta(a)===ta(b))return a&&(a.q&2048||a.lb)?a.mb(null,b):ga(a,b);if(u)throw Error("compare on non-nil objects of different types");return null}
var Pc=function(){function a(a,b,c,h){for(;;){var k=Xb(P.a(a,h),P.a(b,h));if(0===k&&h+1<c)h+=1;else return k}}function b(a,b){var f=O(a),h=O(b);return f<h?-1:f>h?1:u?c.n(a,b,f,0):null}var c=null,c=function(c,e,f,h){switch(arguments.length){case 2:return b.call(this,c,e);case 4:return a.call(this,c,e,f,h)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.n=a;return c}();
function Qc(a){return Wb.a(a,Xb)?Xb:function(b,c){var d=a.a?a.a(b,c):a.call(null,b,c);return"number"===typeof d?d:r(d)?-1:r(a.a?a.a(c,b):a.call(null,c,b))?1:0}}
var Sc=function(){function a(a,b){if(E(b)){var c=Rc.b?Rc.b(b):Rc.call(null,b);ha(c,Qc(a));return E(c)}return H}function b(a){return c.a(Xb,a)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),Tc=function(){function a(a,b,c){return Sc.a(function(c,f){return Qc(b).call(null,a.b?a.b(c):a.call(null,c),a.b?a.b(f):a.call(null,f))},c)}function b(a,b){return c.c(a,Xb,b)}
var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),nc=function(){function a(a,b,c){for(c=E(c);;)if(c){b=a.a?a.a(b,F(c)):a.call(null,b,F(c));if(fc(b))return K.b?K.b(b):K.call(null,b);c=I(c)}else return b}function b(a,b){var c=E(b);return c?C.c?C.c(a,F(c),I(c)):C.call(null,a,F(c),I(c)):a.o?a.o():a.call(null)}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,
c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),C=function(){function a(a,b,c){return c&&(c.i&524288||c.Nb)?c.M(null,a,b):c instanceof Array?hc.c(c,a,b):"string"===typeof c?hc.c(c,a,b):s(fb,c)?gb.c(c,a,b):u?nc.c(a,b,c):null}function b(a,b){return b&&(b.i&524288||b.Nb)?b.N(null,a):b instanceof Array?hc.a(b,a):"string"===typeof b?hc.a(b,a):s(fb,b)?gb.a(b,a):u?nc.a(a,b):null}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,
c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),Uc=function(){var a=null,b=function(){function a(c,f,h){var k=null;2<arguments.length&&(k=J(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,f,k)}function b(a,c,d){for(;;)if(a>c)if(I(d))a=c,c=F(d),d=I(d);else return c>F(d);else return!1}a.k=2;a.f=function(a){var c=F(a);a=I(a);var h=F(a);a=G(a);return b(c,h,a)};a.d=b;return a}(),a=function(a,d,e){switch(arguments.length){case 1:return!0;
case 2:return a>d;default:return b.d(a,d,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};a.k=2;a.f=b.f;a.b=function(){return!0};a.a=function(a,b){return a>b};a.d=b.d;return a}(),Vc=function(){var a=null,b=function(){function a(c,f,h){var k=null;2<arguments.length&&(k=J(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,f,k)}function b(a,c,d){for(;;)if(a>=c)if(I(d))a=c,c=F(d),d=I(d);else return c>=F(d);else return!1}a.k=2;a.f=function(a){var c=F(a);a=I(a);var h=F(a);
a=G(a);return b(c,h,a)};a.d=b;return a}(),a=function(a,d,e){switch(arguments.length){case 1:return!0;case 2:return a>=d;default:return b.d(a,d,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};a.k=2;a.f=b.f;a.b=function(){return!0};a.a=function(a,b){return a>=b};a.d=b.d;return a}();function Wc(a){return a-1}
var Xc=function(){function a(a,b){return a>b?a:b}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){return C.c(b,a>d?a:d,e)}a.k=2;a.f=function(a){var b=F(a);a=I(a);var d=F(a);a=G(a);return c(b,d,a)};a.d=c;return a}(),b=function(b,e,f){switch(arguments.length){case 1:return b;case 2:return a.call(this,b,e);default:return c.d(b,e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);
};b.k=2;b.f=c.f;b.b=function(a){return a};b.a=a;b.d=c.d;return b}();function Yc(a){a=(a-a%2)/2;return 0<=a?Math.floor.b?Math.floor.b(a):Math.floor.call(null,a):Math.ceil.b?Math.ceil.b(a):Math.ceil.call(null,a)}function Zc(a){a-=a>>1&1431655765;a=(a&858993459)+(a>>2&858993459);return 16843009*(a+(a>>4)&252645135)>>24}function $c(a){var b=1;for(a=E(a);;)if(a&&0<b)b-=1,a=I(a);else return a}
var A=function(){function a(a){return null==a?"":a.toString()}var b=null,c=function(){function a(b,d){var k=null;1<arguments.length&&(k=J(Array.prototype.slice.call(arguments,1),0));return c.call(this,b,k)}function c(a,d){for(var e=new ea(b.b(a)),l=d;;)if(r(l))e=e.append(b.b(F(l))),l=I(l);else return e.toString()}a.k=1;a.f=function(a){var b=F(a);a=G(a);return c(b,a)};a.d=c;return a}(),b=function(b,e){switch(arguments.length){case 0:return"";case 1:return a.call(this,b);default:return c.d(b,J(arguments,
1))}throw Error("Invalid arity: "+arguments.length);};b.k=1;b.f=c.f;b.o=function(){return""};b.b=a;b.d=c.d;return b}(),ad=function(){var a=null,a=function(a,c,d){switch(arguments.length){case 2:return a.substring(c);case 3:return a.substring(c,d)}throw Error("Invalid arity: "+arguments.length);};a.a=function(a,c){return a.substring(c)};a.c=function(a,c,d){return a.substring(c,d)};return a}();
function lc(a,b){return Nc(Fc(b)?function(){for(var c=E(a),d=E(b);;){if(null==c)return null==d;if(null==d)return!1;if(Wb.a(F(c),F(d)))c=I(c),d=I(d);else return u?!1:null}}():null)}function bd(a,b,c,d,e){this.j=a;this.first=b;this.ta=c;this.count=d;this.m=e;this.i=65937646;this.q=8192}g=bd.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.j};g.U=function(){return 1===this.count?null:this.ta};g.L=function(){return this.count};g.Ia=function(){return this.first};g.Ja=function(){return Ia(this)};
g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return H};g.N=function(a,b){return nc.a(b,this)};g.M=function(a,b,c){return nc.c(b,c,this)};g.Q=function(){return this.first};g.S=function(){return 1===this.count?H:this.ta};g.H=function(){return this};g.F=function(a,b){return new bd(b,this.first,this.ta,this.count,this.m)};g.G=function(a,b){return new bd(this.j,b,this,this.count+1,null)};
function cd(a){this.j=a;this.i=65937614;this.q=8192}g=cd.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.j};g.U=function(){return null};g.L=function(){return 0};g.Ia=function(){return null};g.Ja=function(){throw Error("Can't pop empty list");};g.B=function(){return 0};g.v=function(a,b){return lc(this,b)};g.I=function(){return this};g.N=function(a,b){return nc.a(b,this)};g.M=function(a,b,c){return nc.c(b,c,this)};g.Q=function(){return null};g.S=function(){return H};
g.H=function(){return null};g.F=function(a,b){return new cd(b)};g.G=function(a,b){return new bd(this.j,b,null,1,null)};var H=new cd(null);function dd(a){return a?a.i&134217728||a.Fc?!0:a.i?!1:s(ob,a):s(ob,a)}function ed(a){return dd(a)?pb(a):C.c(pc,H,a)}
var fd=function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){var b;if(a instanceof ac&&0===a.p)b=a.e;else a:{for(b=[];;)if(null!=a)b.push(a.Q(null)),a=a.U(null);else break a;b=void 0}a=b.length;for(var e=H;;)if(0<a){var f=a-1,e=e.G(null,b[a-1]);a=f}else return e}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}();function gd(a,b,c,d){this.j=a;this.first=b;this.ta=c;this.m=d;this.i=65929452;this.q=8192}
g=gd.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.j};g.U=function(){return null==this.ta?null:E(this.ta)};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(H,this.j)};g.N=function(a,b){return nc.a(b,this)};g.M=function(a,b,c){return nc.c(b,c,this)};g.Q=function(){return this.first};g.S=function(){return null==this.ta?H:this.ta};g.H=function(){return this};
g.F=function(a,b){return new gd(b,this.first,this.ta,this.m)};g.G=function(a,b){return new gd(null,b,this,this.m)};function M(a,b){var c=null==b;return(c?c:b&&(b.i&64||b.bb))?new gd(null,a,b,null):new gd(null,a,E(b),null)}function T(a,b,c,d){this.fa=a;this.name=b;this.sa=c;this.Ua=d;this.i=2153775105;this.q=4096}g=T.prototype;g.w=function(a,b){return ub(b,":"+A.b(this.sa))};g.B=function(){var a=this.Ua;return null!=a?a:this.Ua=a=Ub(this)+2654435769};
g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return Q.a(c,this);case 3:return Q.c(c,this,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return Q.a(a,this)};g.a=function(a,b){return Q.c(a,this,b)};g.v=function(a,b){return b instanceof T?this.sa===b.sa:!1};g.toString=function(){return":"+A.b(this.sa)};
function hd(a,b){return a===b?!0:a instanceof T&&b instanceof T?a.sa===b.sa:!1}
var jd=function(){function a(a,b){return new T(a,b,""+A.b(r(a)?""+A.b(a)+"/":null)+A.b(b),null)}function b(a){if(a instanceof T)return a;if(a instanceof Zb){var b;if(a&&(a.q&4096||a.fc))b=a.fa;else throw Error("Doesn't support namespace: "+A.b(a));return new T(b,id.b?id.b(a):id.call(null,a),a.Na,null)}return"string"===typeof a?(b=a.split("/"),2===b.length?new T(b[0],b[1],a,null):new T(null,b[0],a,null)):null}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,
c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}();function V(a,b,c,d){this.j=a;this.Ya=b;this.r=c;this.m=d;this.q=0;this.i=32374988}g=V.prototype;g.toString=function(){return Lb(this)};function kd(a){null!=a.Ya&&(a.r=a.Ya.o?a.Ya.o():a.Ya.call(null),a.Ya=null);return a.r}g.D=function(){return this.j};g.U=function(){lb(this);return null==this.r?null:I(this.r)};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};
g.I=function(){return N(H,this.j)};g.N=function(a,b){return nc.a(b,this)};g.M=function(a,b,c){return nc.c(b,c,this)};g.Q=function(){lb(this);return null==this.r?null:F(this.r)};g.S=function(){lb(this);return null!=this.r?G(this.r):H};g.H=function(){kd(this);if(null==this.r)return null;for(var a=this.r;;)if(a instanceof V)a=kd(a);else return this.r=a,E(this.r)};g.F=function(a,b){return new V(b,this.Ya,this.r,this.m)};g.G=function(a,b){return M(b,this)};
function ld(a,b){this.qb=a;this.end=b;this.q=0;this.i=2}ld.prototype.L=function(){return this.end};ld.prototype.add=function(a){this.qb[this.end]=a;return this.end+=1};ld.prototype.da=function(){var a=new md(this.qb,0,this.end);this.qb=null;return a};function md(a,b,c){this.e=a;this.O=b;this.end=c;this.q=0;this.i=524306}g=md.prototype;g.N=function(a,b){return hc.n(this.e,b,this.e[this.O],this.O+1)};g.M=function(a,b,c){return hc.n(this.e,b,c,this.O)};
g.Kb=function(){if(this.O===this.end)throw Error("-drop-first of empty chunk");return new md(this.e,this.O+1,this.end)};g.J=function(a,b){return this.e[this.O+b]};g.aa=function(a,b,c){return 0<=b&&b<this.end-this.O?this.e[this.O+b]:c};g.L=function(){return this.end-this.O};
var nd=function(){function a(a,b,c){return new md(a,b,c)}function b(a,b){return new md(a,b,a.length)}function c(a){return new md(a,0,a.length)}var d=null,d=function(d,f,h){switch(arguments.length){case 1:return c.call(this,d);case 2:return b.call(this,d,f);case 3:return a.call(this,d,f,h)}throw Error("Invalid arity: "+arguments.length);};d.b=c;d.a=b;d.c=a;return d}();function od(a,b,c,d){this.da=a;this.oa=b;this.j=c;this.m=d;this.i=31850732;this.q=1536}g=od.prototype;g.toString=function(){return Lb(this)};
g.D=function(){return this.j};g.U=function(){if(1<Aa(this.da))return new od(Gb(this.da),this.oa,this.j,null);var a=lb(this.oa);return null==a?null:a};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(H,this.j)};g.Q=function(){return D.a(this.da,0)};g.S=function(){return 1<Aa(this.da)?new od(Gb(this.da),this.oa,this.j,null):null==this.oa?H:this.oa};g.H=function(){return this};g.sb=function(){return this.da};
g.tb=function(){return null==this.oa?H:this.oa};g.F=function(a,b){return new od(this.da,this.oa,b,this.m)};g.G=function(a,b){return M(b,this)};g.rb=function(){return null==this.oa?null:this.oa};function pd(a,b){return 0===Aa(a)?b:new od(a,b,null,null)}function Rc(a){for(var b=[];;)if(E(a))b.push(F(a)),a=I(a);else return b}function qd(a,b){if(ic(a))return O(a);for(var c=a,d=b,e=0;;)if(0<d&&E(c))c=I(c),d-=1,e+=1;else return e}
var sd=function rd(b){return null==b?null:null==I(b)?E(F(b)):u?M(F(b),rd(I(b))):null},td=function(){function a(a,b){return new V(null,function(){var c=E(a);return c?Ic(c)?pd(Hb(c),d.a(Ib(c),b)):M(F(c),d.a(G(c),b)):b},null,null)}function b(a){return new V(null,function(){return a},null,null)}function c(){return new V(null,function(){return null},null,null)}var d=null,e=function(){function a(c,d,e){var f=null;2<arguments.length&&(f=J(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,
d,f)}function b(a,c,e){return function t(a,b){return new V(null,function(){var c=E(a);return c?Ic(c)?pd(Hb(c),t(Ib(c),b)):M(F(c),t(G(c),b)):r(b)?t(F(b),I(b)):null},null,null)}(d.a(a,c),e)}a.k=2;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=G(a);return b(c,d,a)};a.d=b;return a}(),d=function(d,h,k){switch(arguments.length){case 0:return c.call(this);case 1:return b.call(this,d);case 2:return a.call(this,d,h);default:return e.d(d,h,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};d.k=
2;d.f=e.f;d.o=c;d.b=b;d.a=a;d.d=e.d;return d}(),ud=function(){function a(a,b,c,d){return M(a,M(b,M(c,d)))}function b(a,b,c){return M(a,M(b,c))}var c=null,d=function(){function a(c,d,e,n,q){var t=null;4<arguments.length&&(t=J(Array.prototype.slice.call(arguments,4),0));return b.call(this,c,d,e,n,t)}function b(a,c,d,e,f){return M(a,M(c,M(d,M(e,sd(f)))))}a.k=4;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=I(a);var e=F(a);a=I(a);var q=F(a);a=G(a);return b(c,d,e,q,a)};a.d=b;return a}(),c=function(c,f,
h,k,l){switch(arguments.length){case 1:return E(c);case 2:return M(c,f);case 3:return b.call(this,c,f,h);case 4:return a.call(this,c,f,h,k);default:return d.d(c,f,h,k,J(arguments,4))}throw Error("Invalid arity: "+arguments.length);};c.k=4;c.f=d.f;c.b=function(a){return E(a)};c.a=function(a,b){return M(a,b)};c.c=b;c.n=a;c.d=d.d;return c}();function vd(a){return Ab(a)}
var wd=function(){var a=null,b=function(){function a(c,f,h){var k=null;2<arguments.length&&(k=J(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,f,k)}function b(a,c,d){for(;;)if(a=zb(a,c),r(d))c=F(d),d=I(d);else return a}a.k=2;a.f=function(a){var c=F(a);a=I(a);var h=F(a);a=G(a);return b(c,h,a)};a.d=b;return a}(),a=function(a,d,e){switch(arguments.length){case 2:return zb(a,d);default:return b.d(a,d,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};a.k=2;a.f=b.f;a.a=
function(a,b){return zb(a,b)};a.d=b.d;return a}(),xd=function(){var a=null,b=function(){function a(c,f,h,k){var l=null;3<arguments.length&&(l=J(Array.prototype.slice.call(arguments,3),0));return b.call(this,c,f,h,l)}function b(a,c,d,k){for(;;)if(a=Bb(a,c,d),r(k))c=F(k),d=F(I(k)),k=I(I(k));else return a}a.k=3;a.f=function(a){var c=F(a);a=I(a);var h=F(a);a=I(a);var k=F(a);a=G(a);return b(c,h,k,a)};a.d=b;return a}(),a=function(a,d,e,f){switch(arguments.length){case 3:return Bb(a,d,e);default:return b.d(a,
d,e,J(arguments,3))}throw Error("Invalid arity: "+arguments.length);};a.k=3;a.f=b.f;a.c=function(a,b,e){return Bb(a,b,e)};a.d=b.d;return a}(),yd=function(){var a=null,b=function(){function a(c,f,h){var k=null;2<arguments.length&&(k=J(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,f,k)}function b(a,c,d){for(;;)if(a=Cb(a,c),r(d))c=F(d),d=I(d);else return a}a.k=2;a.f=function(a){var c=F(a);a=I(a);var h=F(a);a=G(a);return b(c,h,a)};a.d=b;return a}(),a=function(a,d,e){switch(arguments.length){case 2:return Cb(a,
d);default:return b.d(a,d,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};a.k=2;a.f=b.f;a.a=function(a,b){return Cb(a,b)};a.d=b.d;return a}(),zd=function(){var a=null,b=function(){function a(c,f,h){var k=null;2<arguments.length&&(k=J(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,f,k)}function b(a,c,d){for(;;)if(a=Fb(a,c),r(d))c=F(d),d=I(d);else return a}a.k=2;a.f=function(a){var c=F(a);a=I(a);var h=F(a);a=G(a);return b(c,h,a)};a.d=b;return a}(),a=function(a,d,
e){switch(arguments.length){case 2:return Fb(a,d);default:return b.d(a,d,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};a.k=2;a.f=b.f;a.a=function(a,b){return Fb(a,b)};a.d=b.d;return a}();
function Ad(a,b,c){var d=E(c);if(0===b)return a.o?a.o():a.call(null);c=Ha(d);var e=Ia(d);if(1===b)return a.b?a.b(c):a.b?a.b(c):a.call(null,c);var d=Ha(e),f=Ia(e);if(2===b)return a.a?a.a(c,d):a.a?a.a(c,d):a.call(null,c,d);var e=Ha(f),h=Ia(f);if(3===b)return a.c?a.c(c,d,e):a.c?a.c(c,d,e):a.call(null,c,d,e);var f=Ha(h),k=Ia(h);if(4===b)return a.n?a.n(c,d,e,f):a.n?a.n(c,d,e,f):a.call(null,c,d,e,f);var h=Ha(k),l=Ia(k);if(5===b)return a.s?a.s(c,d,e,f,h):a.s?a.s(c,d,e,f,h):a.call(null,c,d,e,f,h);var k=Ha(l),
n=Ia(l);if(6===b)return a.X?a.X(c,d,e,f,h,k):a.X?a.X(c,d,e,f,h,k):a.call(null,c,d,e,f,h,k);var l=Ha(n),q=Ia(n);if(7===b)return a.ga?a.ga(c,d,e,f,h,k,l):a.ga?a.ga(c,d,e,f,h,k,l):a.call(null,c,d,e,f,h,k,l);var n=Ha(q),t=Ia(q);if(8===b)return a.Ga?a.Ga(c,d,e,f,h,k,l,n):a.Ga?a.Ga(c,d,e,f,h,k,l,n):a.call(null,c,d,e,f,h,k,l,n);var q=Ha(t),v=Ia(t);if(9===b)return a.Ha?a.Ha(c,d,e,f,h,k,l,n,q):a.Ha?a.Ha(c,d,e,f,h,k,l,n,q):a.call(null,c,d,e,f,h,k,l,n,q);var t=Ha(v),w=Ia(v);if(10===b)return a.va?a.va(c,d,e,
f,h,k,l,n,q,t):a.va?a.va(c,d,e,f,h,k,l,n,q,t):a.call(null,c,d,e,f,h,k,l,n,q,t);var v=Ha(w),y=Ia(w);if(11===b)return a.wa?a.wa(c,d,e,f,h,k,l,n,q,t,v):a.wa?a.wa(c,d,e,f,h,k,l,n,q,t,v):a.call(null,c,d,e,f,h,k,l,n,q,t,v);var w=Ha(y),B=Ia(y);if(12===b)return a.xa?a.xa(c,d,e,f,h,k,l,n,q,t,v,w):a.xa?a.xa(c,d,e,f,h,k,l,n,q,t,v,w):a.call(null,c,d,e,f,h,k,l,n,q,t,v,w);var y=Ha(B),L=Ia(B);if(13===b)return a.ya?a.ya(c,d,e,f,h,k,l,n,q,t,v,w,y):a.ya?a.ya(c,d,e,f,h,k,l,n,q,t,v,w,y):a.call(null,c,d,e,f,h,k,l,n,q,
t,v,w,y);var B=Ha(L),U=Ia(L);if(14===b)return a.za?a.za(c,d,e,f,h,k,l,n,q,t,v,w,y,B):a.za?a.za(c,d,e,f,h,k,l,n,q,t,v,w,y,B):a.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B);var L=Ha(U),Z=Ia(U);if(15===b)return a.Aa?a.Aa(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L):a.Aa?a.Aa(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L):a.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L);var U=Ha(Z),na=Ia(Z);if(16===b)return a.Ba?a.Ba(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U):a.Ba?a.Ba(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U):a.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U);var Z=
Ha(na),Ga=Ia(na);if(17===b)return a.Ca?a.Ca(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z):a.Ca?a.Ca(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z):a.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z);var na=Ha(Ga),Ra=Ia(Ga);if(18===b)return a.Da?a.Da(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na):a.Da?a.Da(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na):a.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na);Ga=Ha(Ra);Ra=Ia(Ra);if(19===b)return a.Ea?a.Ea(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga):a.Ea?a.Ea(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga):a.call(null,
c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga);var wc=Ha(Ra);Ia(Ra);if(20===b)return a.Fa?a.Fa(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga,wc):a.Fa?a.Fa(c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga,wc):a.call(null,c,d,e,f,h,k,l,n,q,t,v,w,y,B,L,U,Z,na,Ga,wc);throw Error("Only up to 20 arguments supported on functions");}
var S=function(){function a(a,b,c,d,e){b=ud.n(b,c,d,e);c=a.k;return a.f?(d=qd(b,c+1),d<=c?Ad(a,d,b):a.f(b)):a.apply(a,Rc(b))}function b(a,b,c,d){b=ud.c(b,c,d);c=a.k;return a.f?(d=qd(b,c+1),d<=c?Ad(a,d,b):a.f(b)):a.apply(a,Rc(b))}function c(a,b,c){b=ud.a(b,c);c=a.k;if(a.f){var d=qd(b,c+1);return d<=c?Ad(a,d,b):a.f(b)}return a.apply(a,Rc(b))}function d(a,b){var c=a.k;if(a.f){var d=qd(b,c+1);return d<=c?Ad(a,d,b):a.f(b)}return a.apply(a,Rc(b))}var e=null,f=function(){function a(c,d,e,f,h,w){var y=null;
5<arguments.length&&(y=J(Array.prototype.slice.call(arguments,5),0));return b.call(this,c,d,e,f,h,y)}function b(a,c,d,e,f,h){c=M(c,M(d,M(e,M(f,sd(h)))));d=a.k;return a.f?(e=qd(c,d+1),e<=d?Ad(a,e,c):a.f(c)):a.apply(a,Rc(c))}a.k=5;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=I(a);var e=F(a);a=I(a);var f=F(a);a=I(a);var h=F(a);a=G(a);return b(c,d,e,f,h,a)};a.d=b;return a}(),e=function(e,k,l,n,q,t){switch(arguments.length){case 2:return d.call(this,e,k);case 3:return c.call(this,e,k,l);case 4:return b.call(this,
e,k,l,n);case 5:return a.call(this,e,k,l,n,q);default:return f.d(e,k,l,n,q,J(arguments,5))}throw Error("Invalid arity: "+arguments.length);};e.k=5;e.f=f.f;e.a=d;e.c=c;e.n=b;e.s=a;e.d=f.d;return e}(),Bd=function(){function a(a,b){return!Wb.a(a,b)}var b=null,c=function(){function a(c,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,d,l)}function b(a,c,d){return sa(S.n(Wb,a,c,d))}a.k=2;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=G(a);return b(c,
d,a)};a.d=b;return a}(),b=function(b,e,f){switch(arguments.length){case 1:return!1;case 2:return a.call(this,b,e);default:return c.d(b,e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.k=2;b.f=c.f;b.b=function(){return!1};b.a=a;b.d=c.d;return b}();function Cd(a){return E(a)?a:null}function Dd(a,b){for(;;){if(null==E(b))return!0;if(r(a.b?a.b(F(b)):a.call(null,F(b)))){var c=a,d=I(b);a=c;b=d}else return u?!1:null}}
function Ed(a,b){for(;;)if(E(b)){var c=a.b?a.b(F(b)):a.call(null,F(b));if(r(c))return c;var c=a,d=I(b);a=c;b=d}else return null}function Fd(a){return a}
function Gd(a){return function(){var b=null,c=function(){function b(a,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return c.call(this,a,d,l)}function c(b,d,e){return sa(S.n(a,b,d,e))}b.k=2;b.f=function(a){var b=F(a);a=I(a);var d=F(a);a=G(a);return c(b,d,a)};b.d=c;return b}(),b=function(b,e,f){switch(arguments.length){case 0:return sa(a.o?a.o():a.call(null));case 1:var h=b;return sa(a.b?a.b(h):a.call(null,h));case 2:var h=b,k=e;return sa(a.a?a.a(h,k):a.call(null,
h,k));default:return c.d(b,e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.k=2;b.f=c.f;return b}()}
var Hd=function(){function a(a,b,c){return function(){var d=null,l=function(){function d(a,b,c,e){var f=null;3<arguments.length&&(f=J(Array.prototype.slice.call(arguments,3),0));return k.call(this,a,b,c,f)}function k(d,l,n,q){return a.b?a.b(b.b?b.b(S.s(c,d,l,n,q)):b.call(null,S.s(c,d,l,n,q))):a.call(null,b.b?b.b(S.s(c,d,l,n,q)):b.call(null,S.s(c,d,l,n,q)))}d.k=3;d.f=function(a){var b=F(a);a=I(a);var c=F(a);a=I(a);var d=F(a);a=G(a);return k(b,c,d,a)};d.d=k;return d}(),d=function(d,k,t,v){switch(arguments.length){case 0:return a.b?
a.b(b.b?b.b(c.o?c.o():c.call(null)):b.call(null,c.o?c.o():c.call(null))):a.call(null,b.b?b.b(c.o?c.o():c.call(null)):b.call(null,c.o?c.o():c.call(null)));case 1:var w=d;return a.b?a.b(b.b?b.b(c.b?c.b(w):c.call(null,w)):b.call(null,c.b?c.b(w):c.call(null,w))):a.call(null,b.b?b.b(c.b?c.b(w):c.call(null,w)):b.call(null,c.b?c.b(w):c.call(null,w)));case 2:var w=d,y=k;return a.b?a.b(b.b?b.b(c.a?c.a(w,y):c.call(null,w,y)):b.call(null,c.a?c.a(w,y):c.call(null,w,y))):a.call(null,b.b?b.b(c.a?c.a(w,y):c.call(null,
w,y)):b.call(null,c.a?c.a(w,y):c.call(null,w,y)));case 3:var w=d,y=k,B=t;return a.b?a.b(b.b?b.b(c.c?c.c(w,y,B):c.call(null,w,y,B)):b.call(null,c.c?c.c(w,y,B):c.call(null,w,y,B))):a.call(null,b.b?b.b(c.c?c.c(w,y,B):c.call(null,w,y,B)):b.call(null,c.c?c.c(w,y,B):c.call(null,w,y,B)));default:return l.d(d,k,t,J(arguments,3))}throw Error("Invalid arity: "+arguments.length);};d.k=3;d.f=l.f;return d}()}function b(a,b){return function(){var c=null,d=function(){function c(a,b,e,f){var h=null;3<arguments.length&&
(h=J(Array.prototype.slice.call(arguments,3),0));return d.call(this,a,b,e,h)}function d(c,h,k,l){return a.b?a.b(S.s(b,c,h,k,l)):a.call(null,S.s(b,c,h,k,l))}c.k=3;c.f=function(a){var b=F(a);a=I(a);var c=F(a);a=I(a);var e=F(a);a=G(a);return d(b,c,e,a)};c.d=d;return c}(),c=function(c,h,q,t){switch(arguments.length){case 0:return a.b?a.b(b.o?b.o():b.call(null)):a.call(null,b.o?b.o():b.call(null));case 1:var v=c;return a.b?a.b(b.b?b.b(v):b.call(null,v)):a.call(null,b.b?b.b(v):b.call(null,v));case 2:var v=
c,w=h;return a.b?a.b(b.a?b.a(v,w):b.call(null,v,w)):a.call(null,b.a?b.a(v,w):b.call(null,v,w));case 3:var v=c,w=h,y=q;return a.b?a.b(b.c?b.c(v,w,y):b.call(null,v,w,y)):a.call(null,b.c?b.c(v,w,y):b.call(null,v,w,y));default:return d.d(c,h,q,J(arguments,3))}throw Error("Invalid arity: "+arguments.length);};c.k=3;c.f=d.f;return c}()}var c=null,d=function(){function a(c,d,e,n){var q=null;3<arguments.length&&(q=J(Array.prototype.slice.call(arguments,3),0));return b.call(this,c,d,e,q)}function b(a,c,d,
e){return function(a){return function(){function b(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return c.call(this,d)}function c(b){b=S.a(F(a),b);for(var d=I(a);;)if(d)b=F(d).call(null,b),d=I(d);else return b}b.k=0;b.f=function(a){a=E(a);return c(a)};b.d=c;return b}()}(ed(ud.n(a,c,d,e)))}a.k=3;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=I(a);var e=F(a);a=G(a);return b(c,d,e,a)};a.d=b;return a}(),c=function(c,f,h,k){switch(arguments.length){case 0:return Fd;
case 1:return c;case 2:return b.call(this,c,f);case 3:return a.call(this,c,f,h);default:return d.d(c,f,h,J(arguments,3))}throw Error("Invalid arity: "+arguments.length);};c.k=3;c.f=d.f;c.o=function(){return Fd};c.b=function(a){return a};c.a=b;c.c=a;c.d=d.d;return c}(),Id=function(){function a(a,b,c,d){return function(){function e(a){var b=null;0<arguments.length&&(b=J(Array.prototype.slice.call(arguments,0),0));return q.call(this,b)}function q(e){return S.s(a,b,c,d,e)}e.k=0;e.f=function(a){a=E(a);
return q(a)};e.d=q;return e}()}function b(a,b,c){return function(){function d(a){var b=null;0<arguments.length&&(b=J(Array.prototype.slice.call(arguments,0),0));return e.call(this,b)}function e(d){return S.n(a,b,c,d)}d.k=0;d.f=function(a){a=E(a);return e(a)};d.d=e;return d}()}function c(a,b){return function(){function c(a){var b=null;0<arguments.length&&(b=J(Array.prototype.slice.call(arguments,0),0));return d.call(this,b)}function d(c){return S.c(a,b,c)}c.k=0;c.f=function(a){a=E(a);return d(a)};
c.d=d;return c}()}var d=null,e=function(){function a(c,d,e,f,t){var v=null;4<arguments.length&&(v=J(Array.prototype.slice.call(arguments,4),0));return b.call(this,c,d,e,f,v)}function b(a,c,d,e,f){return function(){function b(a){var c=null;0<arguments.length&&(c=J(Array.prototype.slice.call(arguments,0),0));return h.call(this,c)}function h(b){return S.s(a,c,d,e,td.a(f,b))}b.k=0;b.f=function(a){a=E(a);return h(a)};b.d=h;return b}()}a.k=4;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=I(a);var e=F(a);
a=I(a);var f=F(a);a=G(a);return b(c,d,e,f,a)};a.d=b;return a}(),d=function(d,h,k,l,n){switch(arguments.length){case 1:return d;case 2:return c.call(this,d,h);case 3:return b.call(this,d,h,k);case 4:return a.call(this,d,h,k,l);default:return e.d(d,h,k,l,J(arguments,4))}throw Error("Invalid arity: "+arguments.length);};d.k=4;d.f=e.f;d.b=function(a){return a};d.a=c;d.c=b;d.n=a;d.d=e.d;return d}(),Jd=function(){function a(a,b,c,d){return function(){var l=null,n=function(){function l(a,b,c,d){var e=null;
3<arguments.length&&(e=J(Array.prototype.slice.call(arguments,3),0));return n.call(this,a,b,c,e)}function n(l,q,t,B){return S.s(a,null==l?b:l,null==q?c:q,null==t?d:t,B)}l.k=3;l.f=function(a){var b=F(a);a=I(a);var c=F(a);a=I(a);var d=F(a);a=G(a);return n(b,c,d,a)};l.d=n;return l}(),l=function(l,t,v,w){switch(arguments.length){case 2:var y=l,B=t;return a.a?a.a(null==y?b:y,null==B?c:B):a.call(null,null==y?b:y,null==B?c:B);case 3:var y=l,B=t,L=v;return a.c?a.c(null==y?b:y,null==B?c:B,null==L?d:L):a.call(null,
null==y?b:y,null==B?c:B,null==L?d:L);default:return n.d(l,t,v,J(arguments,3))}throw Error("Invalid arity: "+arguments.length);};l.k=3;l.f=n.f;return l}()}function b(a,b,c){return function(){var d=null,l=function(){function d(a,b,c,e){var f=null;3<arguments.length&&(f=J(Array.prototype.slice.call(arguments,3),0));return k.call(this,a,b,c,f)}function k(d,l,n,q){return S.s(a,null==d?b:d,null==l?c:l,n,q)}d.k=3;d.f=function(a){var b=F(a);a=I(a);var c=F(a);a=I(a);var d=F(a);a=G(a);return k(b,c,d,a)};d.d=
k;return d}(),d=function(d,k,t,v){switch(arguments.length){case 2:var w=d,y=k;return a.a?a.a(null==w?b:w,null==y?c:y):a.call(null,null==w?b:w,null==y?c:y);case 3:var w=d,y=k,B=t;return a.c?a.c(null==w?b:w,null==y?c:y,B):a.call(null,null==w?b:w,null==y?c:y,B);default:return l.d(d,k,t,J(arguments,3))}throw Error("Invalid arity: "+arguments.length);};d.k=3;d.f=l.f;return d}()}function c(a,b){return function(){var c=null,d=function(){function c(a,b,e,f){var h=null;3<arguments.length&&(h=J(Array.prototype.slice.call(arguments,
3),0));return d.call(this,a,b,e,h)}function d(c,h,k,l){return S.s(a,null==c?b:c,h,k,l)}c.k=3;c.f=function(a){var b=F(a);a=I(a);var c=F(a);a=I(a);var e=F(a);a=G(a);return d(b,c,e,a)};c.d=d;return c}(),c=function(c,h,q,t){switch(arguments.length){case 1:var v=c;return a.b?a.b(null==v?b:v):a.call(null,null==v?b:v);case 2:var v=c,w=h;return a.a?a.a(null==v?b:v,w):a.call(null,null==v?b:v,w);case 3:var v=c,w=h,y=q;return a.c?a.c(null==v?b:v,w,y):a.call(null,null==v?b:v,w,y);default:return d.d(c,h,q,J(arguments,
3))}throw Error("Invalid arity: "+arguments.length);};c.k=3;c.f=d.f;return c}()}var d=null,d=function(d,f,h,k){switch(arguments.length){case 2:return c.call(this,d,f);case 3:return b.call(this,d,f,h);case 4:return a.call(this,d,f,h,k)}throw Error("Invalid arity: "+arguments.length);};d.a=c;d.c=b;d.n=a;return d}(),Kd=function(){function a(a,b,c,e){return new V(null,function(){var n=E(b),q=E(c),t=E(e);return n&&q&&t?M(a.c?a.c(F(n),F(q),F(t)):a.call(null,F(n),F(q),F(t)),d.n(a,G(n),G(q),G(t))):null},
null,null)}function b(a,b,c){return new V(null,function(){var e=E(b),n=E(c);return e&&n?M(a.a?a.a(F(e),F(n)):a.call(null,F(e),F(n)),d.c(a,G(e),G(n))):null},null,null)}function c(a,b){return new V(null,function(){var c=E(b);if(c){if(Ic(c)){for(var e=Hb(c),n=O(e),q=new ld(Array(n),0),t=0;;)if(t<n){var v=a.b?a.b(D.a(e,t)):a.call(null,D.a(e,t));q.add(v);t+=1}else break;return pd(q.da(),d.a(a,Ib(c)))}return M(a.b?a.b(F(c)):a.call(null,F(c)),d.a(a,G(c)))}return null},null,null)}var d=null,e=function(){function a(c,
d,e,f,t){var v=null;4<arguments.length&&(v=J(Array.prototype.slice.call(arguments,4),0));return b.call(this,c,d,e,f,v)}function b(a,c,e,f,h){var v=function y(a){return new V(null,function(){var b=d.a(E,a);return Dd(Fd,b)?M(d.a(F,b),y(d.a(G,b))):null},null,null)};return d.a(function(){return function(b){return S.a(a,b)}}(v),v(pc.d(h,f,J([e,c],0))))}a.k=4;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=I(a);var e=F(a);a=I(a);var f=F(a);a=G(a);return b(c,d,e,f,a)};a.d=b;return a}(),d=function(d,h,k,l,
n){switch(arguments.length){case 2:return c.call(this,d,h);case 3:return b.call(this,d,h,k);case 4:return a.call(this,d,h,k,l);default:return e.d(d,h,k,l,J(arguments,4))}throw Error("Invalid arity: "+arguments.length);};d.k=4;d.f=e.f;d.a=c;d.c=b;d.n=a;d.d=e.d;return d}(),Md=function Ld(b,c){return new V(null,function(){if(0<b){var d=E(c);return d?M(F(d),Ld(b-1,G(d))):null}return null},null,null)};
function Nd(a,b){return new V(null,function(c){return function(){return c(a,b)}}(function(a,b){for(;;){var e=E(b);if(0<a&&e){var f=a-1,e=G(e);a=f;b=e}else return e}}),null,null)}
var Od=function(){function a(a,b){return Md(a,c.b(b))}function b(a){return new V(null,function(){return M(a,c.b(a))},null,null)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),Pd=function(){function a(a,b){return Md(a,c.b(b))}function b(a){return new V(null,function(){return M(a.o?a.o():a.call(null),c.b(a))},null,null)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,
c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),Qd=function(){function a(a,c){return new V(null,function(){var f=E(a),h=E(c);return f&&h?M(F(f),M(F(h),b.a(G(f),G(h)))):null},null,null)}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){return new V(null,function(){var c=Kd.a(E,pc.d(e,d,J([a],0)));return Dd(Fd,c)?td.a(Kd.a(F,
c),S.a(b,Kd.a(G,c))):null},null,null)}a.k=2;a.f=function(a){var b=F(a);a=I(a);var d=F(a);a=G(a);return c(b,d,a)};a.d=c;return a}(),b=function(b,e,f){switch(arguments.length){case 2:return a.call(this,b,e);default:return c.d(b,e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.k=2;b.f=c.f;b.a=a;b.d=c.d;return b}();function Rd(a){return function c(a,e){return new V(null,function(){var f=E(a);return f?M(F(f),c(G(f),e)):E(e)?c(F(e),G(e)):null},null,null)}(null,a)}
var Sd=function(){function a(a,b){return Rd(Kd.a(a,b))}var b=null,c=function(){function a(c,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,d,l)}function b(a,c,d){return Rd(S.n(Kd,a,c,d))}a.k=2;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=G(a);return b(c,d,a)};a.d=b;return a}(),b=function(b,e,f){switch(arguments.length){case 2:return a.call(this,b,e);default:return c.d(b,e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};
b.k=2;b.f=c.f;b.a=a;b.d=c.d;return b}(),Ud=function Td(b,c){return new V(null,function(){var d=E(c);if(d){if(Ic(d)){for(var e=Hb(d),f=O(e),h=new ld(Array(f),0),k=0;;)if(k<f){if(r(b.b?b.b(D.a(e,k)):b.call(null,D.a(e,k)))){var l=D.a(e,k);h.add(l)}k+=1}else break;return pd(h.da(),Td(b,Ib(d)))}e=F(d);d=G(d);return r(b.b?b.b(e):b.call(null,e))?M(e,Td(b,d)):Td(b,d)}return null},null,null)};function Vd(a,b){return Ud(Gd(a),b)}
function Wd(a){var b=Xd;return function d(a){return new V(null,function(){return M(a,r(b.b?b.b(a):b.call(null,a))?Sd.a(d,E.b?E.b(a):E.call(null,a)):null)},null,null)}(a)}function Yd(a,b){return null!=a?a&&(a.q&4||a.Bc)?vd(C.c(zb,yb(a),b)):C.c(Da,a,b):C.c(pc,H,b)}
var Zd=function(){function a(a,b,c,k){return new V(null,function(){var l=E(k);if(l){var n=Md(a,l);return a===O(n)?M(n,d.n(a,b,c,Nd(b,l))):Da(H,Md(a,td.a(n,c)))}return null},null,null)}function b(a,b,c){return new V(null,function(){var k=E(c);if(k){var l=Md(a,k);return a===O(l)?M(l,d.c(a,b,Nd(b,k))):null}return null},null,null)}function c(a,b){return d.c(a,a,b)}var d=null,d=function(d,f,h,k){switch(arguments.length){case 2:return c.call(this,d,f);case 3:return b.call(this,d,f,h);case 4:return a.call(this,
d,f,h,k)}throw Error("Invalid arity: "+arguments.length);};d.a=c;d.c=b;d.n=a;return d}(),$d=function(){function a(a,b,c){var h=Lc;for(b=E(b);;)if(b){var k=a;if(k?k.i&256||k.Mb||(k.i?0:s(Ka,k)):s(Ka,k)){a=Q.c(a,F(b),h);if(h===a)return c;b=I(b)}else return c}else return a}function b(a,b){return c.c(a,b,null)}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),ae=
function(){function a(a,b,c,d,f,t){var v=P.c(b,0,null);return(b=$c(b))?R.c(a,v,e.X(Q.a(a,v),b,c,d,f,t)):R.c(a,v,c.n?c.n(Q.a(a,v),d,f,t):c.call(null,Q.a(a,v),d,f,t))}function b(a,b,c,d,f){var t=P.c(b,0,null);return(b=$c(b))?R.c(a,t,e.s(Q.a(a,t),b,c,d,f)):R.c(a,t,c.c?c.c(Q.a(a,t),d,f):c.call(null,Q.a(a,t),d,f))}function c(a,b,c,d){var f=P.c(b,0,null);return(b=$c(b))?R.c(a,f,e.n(Q.a(a,f),b,c,d)):R.c(a,f,c.a?c.a(Q.a(a,f),d):c.call(null,Q.a(a,f),d))}function d(a,b,c){var d=P.c(b,0,null);return(b=$c(b))?
R.c(a,d,e.c(Q.a(a,d),b,c)):R.c(a,d,c.b?c.b(Q.a(a,d)):c.call(null,Q.a(a,d)))}var e=null,f=function(){function a(c,d,e,f,h,w,y){var B=null;6<arguments.length&&(B=J(Array.prototype.slice.call(arguments,6),0));return b.call(this,c,d,e,f,h,w,B)}function b(a,c,d,f,h,k,y){var B=P.c(c,0,null);return(c=$c(c))?R.c(a,B,S.d(e,Q.a(a,B),c,d,f,J([h,k,y],0))):R.c(a,B,S.d(d,Q.a(a,B),f,h,k,J([y],0)))}a.k=6;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=I(a);var e=F(a);a=I(a);var f=F(a);a=I(a);var h=F(a);a=I(a);var y=
F(a);a=G(a);return b(c,d,e,f,h,y,a)};a.d=b;return a}(),e=function(e,k,l,n,q,t,v){switch(arguments.length){case 3:return d.call(this,e,k,l);case 4:return c.call(this,e,k,l,n);case 5:return b.call(this,e,k,l,n,q);case 6:return a.call(this,e,k,l,n,q,t);default:return f.d(e,k,l,n,q,t,J(arguments,6))}throw Error("Invalid arity: "+arguments.length);};e.k=6;e.f=f.f;e.c=d;e.n=c;e.s=b;e.X=a;e.d=f.d;return e}();function be(a,b){this.t=a;this.e=b}
function ce(a){return new be(a,[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null])}function de(a){return new be(a.t,va(a.e))}function ee(a){a=a.g;return 32>a?0:a-1>>>5<<5}function fe(a,b,c){for(;;){if(0===b)return c;var d=ce(a);d.e[0]=c;c=d;b-=5}}var he=function ge(b,c,d,e){var f=de(d),h=b.g-1>>>c&31;5===c?f.e[h]=e:(d=d.e[h],b=null!=d?ge(b,c-5,d,e):fe(null,c-5,e),f.e[h]=b);return f};
function ie(a,b){throw Error("No item "+A.b(a)+" in vector of length "+A.b(b));}function je(a){var b=a.root;for(a=a.shift;;)if(0<a)a-=5,b=b.e[0];else return b.e}function ke(a,b){if(b>=ee(a))return a.R;for(var c=a.root,d=a.shift;;)if(0<d)var e=d-5,c=c.e[b>>>d&31],d=e;else return c.e}function le(a,b){return 0<=b&&b<a.g?ke(a,b):ie(b,a.g)}
var ne=function me(b,c,d,e,f){var h=de(d);if(0===c)h.e[e&31]=f;else{var k=e>>>c&31;b=me(b,c-5,d.e[k],e,f);h.e[k]=b}return h},pe=function oe(b,c,d){var e=b.g-2>>>c&31;if(5<c){b=oe(b,c-5,d.e[e]);if(null==b&&0===e)return null;d=de(d);d.e[e]=b;return d}return 0===e?null:u?(d=de(d),d.e[e]=null,d):null};function W(a,b,c,d,e,f){this.j=a;this.g=b;this.shift=c;this.root=d;this.R=e;this.m=f;this.i=167668511;this.q=8196}g=W.prototype;g.toString=function(){return Lb(this)};
g.u=function(a,b){return La.c(this,b,null)};g.C=function(a,b,c){return"number"===typeof b?D.c(this,b,c):c};g.Za=function(a,b,c){a=[0,c];for(c=0;;)if(c<this.g){var d=ke(this,c),e=d.length;a:{for(var f=0,h=a[1];;)if(f<e){h=b.c?b.c(h,f+c,d[f]):b.call(null,h,f+c,d[f]);if(fc(h)){d=h;break a}f+=1}else{a[0]=e;d=a[1]=h;break a}d=void 0}if(fc(d))return K.b?K.b(d):K.call(null,d);c+=a[0]}else return a[1]};g.J=function(a,b){return le(this,b)[b&31]};
g.aa=function(a,b,c){return 0<=b&&b<this.g?ke(this,b)[b&31]:c};g.Pa=function(a,b,c){if(0<=b&&b<this.g)return ee(this)<=b?(a=va(this.R),a[b&31]=c,new W(this.j,this.g,this.shift,this.root,a,null)):new W(this.j,this.g,this.shift,ne(this,this.shift,this.root,b,c),this.R,null);if(b===this.g)return Da(this,c);if(u)throw Error("Index "+A.b(b)+" out of bounds  [0,"+A.b(this.g)+"]");return null};g.D=function(){return this.j};g.L=function(){return this.g};g.$a=function(){return D.a(this,0)};
g.ab=function(){return D.a(this,1)};g.Ia=function(){return 0<this.g?D.a(this,this.g-1):null};g.Ja=function(){if(0===this.g)throw Error("Can't pop empty vector");if(1===this.g)return eb(qe,this.j);if(1<this.g-ee(this))return new W(this.j,this.g-1,this.shift,this.root,this.R.slice(0,-1),null);if(u){var a=ke(this,this.g-2),b=pe(this,this.shift,this.root),b=null==b?X:b,c=this.g-1;return 5<this.shift&&null==b.e[1]?new W(this.j,c,this.shift-5,b.e[0],a,null):new W(this.j,c,this.shift,b,a,null)}return null};
g.Xa=function(){return 0<this.g?new kc(this,this.g-1,null):null};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.Wa=function(){return new re(this.g,this.shift,se.b?se.b(this.root):se.call(null,this.root),te.b?te.b(this.R):te.call(null,this.R))};g.I=function(){return N(qe,this.j)};g.N=function(a,b){return gc.a(this,b)};g.M=function(a,b,c){return gc.c(this,b,c)};
g.ua=function(a,b,c){if("number"===typeof b)return $a(this,b,c);throw Error("Vector's key for assoc must be a number.");};g.H=function(){return 0===this.g?null:32>=this.g?new ac(this.R,0):u?ue.n?ue.n(this,je(this),0,0):ue.call(null,this,je(this),0,0):null};g.F=function(a,b){return new W(b,this.g,this.shift,this.root,this.R,this.m)};
g.G=function(a,b){if(32>this.g-ee(this)){for(var c=this.R.length,d=Array(c+1),e=0;;)if(e<c)d[e]=this.R[e],e+=1;else break;d[c]=b;return new W(this.j,this.g+1,this.shift,this.root,d,null)}c=(d=this.g>>>5>1<<this.shift)?this.shift+5:this.shift;d?(d=ce(null),d.e[0]=this.root,e=fe(null,this.shift,new be(null,this.R)),d.e[1]=e):d=he(this,this.shift,this.root,new be(null,this.R));return new W(this.j,this.g+1,c,d,[b],null)};
g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.J(null,c);case 3:return this.aa(null,c,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return this.J(null,a)};g.a=function(a,b){return this.aa(null,a,b)};
var X=new be(null,[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]),qe=new W(null,0,5,X,[],0);function ve(a,b){var c=a.length,d=b?a:va(a);if(32>c)return new W(null,c,5,X,d,null);for(var e=32,f=(new W(null,32,5,X,d.slice(0,32),null)).Wa(null);;)if(e<c)var h=e+1,f=wd.a(f,d[e]),e=h;else return Ab(f)}function we(a){return Ab(C.c(zb,yb(qe),a))}
var xe=function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return a instanceof ac&&0===a.p?ve.a?ve.a(a.e,!0):ve.call(null,a.e,!0):we(a)}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}();function ye(a,b,c,d,e,f){this.P=a;this.ea=b;this.p=c;this.O=d;this.j=e;this.m=f;this.i=32243948;this.q=1536}g=ye.prototype;g.toString=function(){return Lb(this)};
g.U=function(){if(this.O+1<this.ea.length){var a=ue.n?ue.n(this.P,this.ea,this.p,this.O+1):ue.call(null,this.P,this.ea,this.p,this.O+1);return null==a?null:a}return Jb(this)};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(qe,this.j)};g.N=function(a,b){return gc.a(ze.c?ze.c(this.P,this.p+this.O,O(this.P)):ze.call(null,this.P,this.p+this.O,O(this.P)),b)};
g.M=function(a,b,c){return gc.c(ze.c?ze.c(this.P,this.p+this.O,O(this.P)):ze.call(null,this.P,this.p+this.O,O(this.P)),b,c)};g.Q=function(){return this.ea[this.O]};g.S=function(){if(this.O+1<this.ea.length){var a=ue.n?ue.n(this.P,this.ea,this.p,this.O+1):ue.call(null,this.P,this.ea,this.p,this.O+1);return null==a?H:a}return Ib(this)};g.H=function(){return this};g.sb=function(){return nd.a(this.ea,this.O)};
g.tb=function(){var a=this.p+this.ea.length;return a<Aa(this.P)?ue.n?ue.n(this.P,ke(this.P,a),a,0):ue.call(null,this.P,ke(this.P,a),a,0):H};g.F=function(a,b){return ue.s?ue.s(this.P,this.ea,this.p,this.O,b):ue.call(null,this.P,this.ea,this.p,this.O,b)};g.G=function(a,b){return M(b,this)};g.rb=function(){var a=this.p+this.ea.length;return a<Aa(this.P)?ue.n?ue.n(this.P,ke(this.P,a),a,0):ue.call(null,this.P,ke(this.P,a),a,0):null};
var ue=function(){function a(a,b,c,d,l){return new ye(a,b,c,d,l,null)}function b(a,b,c,d){return new ye(a,b,c,d,null,null)}function c(a,b,c){return new ye(a,le(a,b),b,c,null,null)}var d=null,d=function(d,f,h,k,l){switch(arguments.length){case 3:return c.call(this,d,f,h);case 4:return b.call(this,d,f,h,k);case 5:return a.call(this,d,f,h,k,l)}throw Error("Invalid arity: "+arguments.length);};d.c=c;d.n=b;d.s=a;return d}();
function Ae(a,b,c,d,e){this.j=a;this.ca=b;this.start=c;this.end=d;this.m=e;this.i=166617887;this.q=8192}g=Ae.prototype;g.toString=function(){return Lb(this)};g.u=function(a,b){return La.c(this,b,null)};g.C=function(a,b,c){return"number"===typeof b?D.c(this,b,c):c};g.J=function(a,b){return 0>b||this.end<=this.start+b?ie(b,this.end-this.start):D.a(this.ca,this.start+b)};g.aa=function(a,b,c){return 0>b||this.end<=this.start+b?c:D.c(this.ca,this.start+b,c)};
g.Pa=function(a,b,c){var d=this,e=d.start+b;return Be.s?Be.s(d.j,R.c(d.ca,e,c),d.start,function(){var a=d.end,b=e+1;return a>b?a:b}(),null):Be.call(null,d.j,R.c(d.ca,e,c),d.start,function(){var a=d.end,b=e+1;return a>b?a:b}(),null)};g.D=function(){return this.j};g.L=function(){return this.end-this.start};g.Ia=function(){return D.a(this.ca,this.end-1)};
g.Ja=function(){if(this.start===this.end)throw Error("Can't pop empty vector");return Be.s?Be.s(this.j,this.ca,this.start,this.end-1,null):Be.call(null,this.j,this.ca,this.start,this.end-1,null)};g.Xa=function(){return this.start!==this.end?new kc(this,this.end-this.start-1,null):null};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(qe,this.j)};g.N=function(a,b){return gc.a(this,b)};
g.M=function(a,b,c){return gc.c(this,b,c)};g.ua=function(a,b,c){if("number"===typeof b)return $a(this,b,c);throw Error("Subvec's key for assoc must be a number.");};g.H=function(){var a=this;return function(b){return function d(e){return e===a.end?null:M(D.a(a.ca,e),new V(null,function(){return function(){return d(e+1)}}(b),null,null))}}(this)(a.start)};g.F=function(a,b){return Be.s?Be.s(b,this.ca,this.start,this.end,this.m):Be.call(null,b,this.ca,this.start,this.end,this.m)};
g.G=function(a,b){return Be.s?Be.s(this.j,$a(this.ca,this.end,b),this.start,this.end+1,null):Be.call(null,this.j,$a(this.ca,this.end,b),this.start,this.end+1,null)};g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.J(null,c);case 3:return this.aa(null,c,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return this.J(null,a)};
g.a=function(a,b){return this.aa(null,a,b)};function Be(a,b,c,d,e){for(;;)if(b instanceof Ae)c=b.start+c,d=b.start+d,b=b.ca;else{var f=O(b);if(0>c||0>d||c>f||d>f)throw Error("Index out of bounds");return new Ae(a,b,c,d,e)}}
var ze=function(){function a(a,b,c){return Be(null,a,b,c,null)}function b(a,b){return c.c(a,b,O(a))}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}();function Ce(a,b){return a===b.t?b:new be(a,va(b.e))}function se(a){return new be({},va(a.e))}
function te(a){var b=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];Kc(a,0,b,0,a.length);return b}
var Ee=function De(b,c,d,e){d=Ce(b.root.t,d);var f=b.g-1>>>c&31;if(5===c)b=e;else{var h=d.e[f];b=null!=h?De(b,c-5,h,e):fe(b.root.t,c-5,e)}d.e[f]=b;return d},Ge=function Fe(b,c,d){d=Ce(b.root.t,d);var e=b.g-2>>>c&31;if(5<c){b=Fe(b,c-5,d.e[e]);if(null==b&&0===e)return null;d.e[e]=b;return d}return 0===e?null:u?(d.e[e]=null,d):null};function re(a,b,c,d){this.g=a;this.shift=b;this.root=c;this.R=d;this.i=275;this.q=88}g=re.prototype;
g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.u(null,c);case 3:return this.C(null,c,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return this.u(null,a)};g.a=function(a,b){return this.C(null,a,b)};g.u=function(a,b){return La.c(this,b,null)};g.C=function(a,b,c){return"number"===typeof b?D.c(this,b,c):c};
g.J=function(a,b){if(this.root.t)return le(this,b)[b&31];throw Error("nth after persistent!");};g.aa=function(a,b,c){return 0<=b&&b<this.g?D.a(this,b):c};g.L=function(){if(this.root.t)return this.g;throw Error("count after persistent!");};
g.Pb=function(a,b,c){var d=this;if(d.root.t){if(0<=b&&b<d.g)return ee(this)<=b?d.R[b&31]=c:(a=function(){return function f(a,k){var l=Ce(d.root.t,k);if(0===a)l.e[b&31]=c;else{var n=b>>>a&31,q=f(a-5,l.e[n]);l.e[n]=q}return l}}(this).call(null,d.shift,d.root),d.root=a),this;if(b===d.g)return zb(this,c);if(u)throw Error("Index "+A.b(b)+" out of bounds for TransientVector of length"+A.b(d.g));return null}throw Error("assoc! after persistent!");};
g.Qb=function(){if(this.root.t){if(0===this.g)throw Error("Can't pop empty vector");if(1===this.g)return this.g=0,this;if(0<(this.g-1&31))return this.g-=1,this;if(u){var a;a:if(a=this.g-2,a>=ee(this))a=this.R;else{for(var b=this.root,c=b,d=this.shift;;)if(0<d)c=Ce(b.t,c.e[a>>>d&31]),d-=5;else{a=c.e;break a}a=void 0}b=Ge(this,this.shift,this.root);b=null!=b?b:new be(this.root.t,[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,
null,null,null,null,null,null,null,null]);5<this.shift&&null==b.e[1]?(this.root=Ce(this.root.t,b.e[0]),this.shift-=5):this.root=b;this.g-=1;this.R=a;return this}return null}throw Error("pop! after persistent!");};g.cb=function(a,b,c){if("number"===typeof b)return Db(this,b,c);throw Error("TransientVector's key for assoc! must be a number.");};
g.Ka=function(a,b){if(this.root.t){if(32>this.g-ee(this))this.R[this.g&31]=b;else{var c=new be(this.root.t,this.R),d=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];d[0]=b;this.R=d;if(this.g>>>5>1<<this.shift){var d=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],e=this.shift+
5;d[0]=this.root;d[1]=fe(this.root.t,this.shift,c);this.root=new be(this.root.t,d);this.shift=e}else this.root=Ee(this,this.shift,this.root,c)}this.g+=1;return this}throw Error("conj! after persistent!");};g.Oa=function(){if(this.root.t){this.root.t=null;var a=this.g-ee(this),b=Array(a);Kc(this.R,0,b,0,a);return new W(null,this.g,this.shift,this.root,b,null)}throw Error("persistent! called twice");};function He(a,b,c,d){this.j=a;this.ba=b;this.pa=c;this.m=d;this.q=0;this.i=31850572}g=He.prototype;
g.toString=function(){return Lb(this)};g.D=function(){return this.j};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(H,this.j)};g.Q=function(){return F(this.ba)};g.S=function(){var a=I(this.ba);return a?new He(this.j,a,this.pa,null):null==this.pa?Ba(this):new He(this.j,this.pa,null,null)};g.H=function(){return this};g.F=function(a,b){return new He(b,this.ba,this.pa,this.m)};g.G=function(a,b){return M(b,this)};
function Ie(a,b,c,d,e){this.j=a;this.count=b;this.ba=c;this.pa=d;this.m=e;this.i=31858766;this.q=8192}g=Ie.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.j};g.L=function(){return this.count};g.Ia=function(){return F(this.ba)};g.Ja=function(){if(r(this.ba)){var a=I(this.ba);return a?new Ie(this.j,this.count-1,a,this.pa,null):new Ie(this.j,this.count-1,E(this.pa),qe,null)}return this};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};
g.v=function(a,b){return lc(this,b)};g.I=function(){return Je};g.Q=function(){return F(this.ba)};g.S=function(){return G(E(this))};g.H=function(){var a=E(this.pa),b=this.ba;return r(r(b)?b:a)?new He(null,this.ba,E(a),null):null};g.F=function(a,b){return new Ie(b,this.count,this.ba,this.pa,this.m)};g.G=function(a,b){var c;r(this.ba)?(c=this.pa,c=new Ie(this.j,this.count+1,this.ba,pc.a(r(c)?c:qe,b),null)):c=new Ie(this.j,this.count+1,pc.a(this.ba,b),qe,null);return c};var Je=new Ie(null,0,null,qe,0);
function Ke(){this.q=0;this.i=2097152}Ke.prototype.v=function(){return!1};var Le=new Ke;function Me(a,b){return Nc(Gc(b)?O(a)===O(b)?Dd(Fd,Kd.a(function(a){return Wb.a(Q.c(b,F(a),Le),F(I(a)))},a)):null:null)}function Ne(a){this.r=a}Ne.prototype.next=function(){if(null!=this.r){var a=F(this.r);this.r=I(this.r);return{done:!1,value:a}}return{done:!0,value:null}};function Oe(a){return new Ne(E(a))}function Pe(a){this.r=a}
Pe.prototype.next=function(){if(null!=this.r){var a=F(this.r),b=P.c(a,0,null),a=P.c(a,1,null);this.r=I(this.r);return{done:!1,value:[b,a]}}return{done:!0,value:null}};function Qe(a){return new Pe(E(a))}function Re(a){this.r=a}Re.prototype.next=function(){if(null!=this.r){var a=F(this.r);this.r=I(this.r);return{done:!1,value:[a,a]}}return{done:!0,value:null}};function Se(a){return new Re(E(a))}
function Te(a,b){var c=a.e;if(b instanceof T)a:{for(var d=c.length,e=b.sa,f=0;;){if(d<=f){c=-1;break a}var h=c[f];if(h instanceof T&&e===h.sa){c=f;break a}if(u)f+=2;else{c=null;break a}}c=void 0}else if("string"==typeof b||"number"===typeof b)a:{d=c.length;for(e=0;;){if(d<=e){c=-1;break a}if(b===c[e]){c=e;break a}if(u)e+=2;else{c=null;break a}}c=void 0}else if(b instanceof Zb)a:{d=c.length;e=b.Na;for(f=0;;){if(d<=f){c=-1;break a}h=c[f];if(h instanceof Zb&&e===h.Na){c=f;break a}if(u)f+=2;else{c=null;
break a}}c=void 0}else if(null==b)a:{d=c.length;for(e=0;;){if(d<=e){c=-1;break a}if(null==c[e]){c=e;break a}if(u)e+=2;else{c=null;break a}}c=void 0}else if(u)a:{d=c.length;for(e=0;;){if(d<=e){c=-1;break a}if(Wb.a(b,c[e])){c=e;break a}if(u)e+=2;else{c=null;break a}}c=void 0}else c=null;return c}function Ue(a,b,c){this.e=a;this.p=b;this.W=c;this.q=0;this.i=32374990}g=Ue.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.W};
g.U=function(){return this.p<this.e.length-2?new Ue(this.e,this.p+2,this.W):null};g.L=function(){return(this.e.length-this.p)/2};g.B=function(){return cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(H,this.W)};g.N=function(a,b){return nc.a(b,this)};g.M=function(a,b,c){return nc.c(b,c,this)};g.Q=function(){return new W(null,2,5,X,[this.e[this.p],this.e[this.p+1]],null)};g.S=function(){return this.p<this.e.length-2?new Ue(this.e,this.p+2,this.W):H};g.H=function(){return this};
g.F=function(a,b){return new Ue(this.e,this.p,b)};g.G=function(a,b){return M(b,this)};function la(a,b,c,d){this.j=a;this.g=b;this.e=c;this.m=d;this.i=16647951;this.q=8196}g=la.prototype;g.toString=function(){return Lb(this)};g.keys=function(){return Oe(Ve.b?Ve.b(this):Ve.call(null,this))};g.entries=function(){return Qe(E(this))};g.values=function(){return Oe(We.b?We.b(this):We.call(null,this))};g.has=function(a){return Oc(this,a)};g.get=function(a){return this.u(null,a)};
g.forEach=function(a){for(var b=E(this),c=null,d=0,e=0;;)if(e<d){var f=c.J(null,e),h=P.c(f,0,null),f=P.c(f,1,null);a.a?a.a(f,h):a.call(null,f,h);e+=1}else if(b=E(b))Ic(b)?(c=Hb(b),b=Ib(b),h=c,d=O(c),c=h):(c=F(b),h=P.c(c,0,null),f=P.c(c,1,null),a.a?a.a(f,h):a.call(null,f,h),b=I(b),c=null,d=0),e=0;else return null};g.u=function(a,b){return La.c(this,b,null)};g.C=function(a,b,c){a=Te(this,b);return-1===a?c:this.e[a+1]};
g.Za=function(a,b,c){a=this.e.length;for(var d=0;;)if(d<a){c=b.c?b.c(c,this.e[d],this.e[d+1]):b.call(null,c,this.e[d],this.e[d+1]);if(fc(c))return K.b?K.b(c):K.call(null,c);d+=2}else return c};g.D=function(){return this.j};g.L=function(){return this.g};g.B=function(){var a=this.m;return null!=a?a:this.m=a=dc(this)};g.v=function(a,b){return Me(this,b)};g.Wa=function(){return new Xe({},this.e.length,va(this.e))};g.I=function(){return eb(Ye,this.j)};g.N=function(a,b){return nc.a(b,this)};
g.M=function(a,b,c){return nc.c(b,c,this)};g.nb=function(a,b){if(0<=Te(this,b)){var c=this.e.length,d=c-2;if(0===d)return Ba(this);for(var d=Array(d),e=0,f=0;;){if(e>=c)return new la(this.j,this.g-1,d,null);if(Wb.a(b,this.e[e]))e+=2;else if(u)d[f]=this.e[e],d[f+1]=this.e[e+1],f+=2,e+=2;else return null}}else return this};
g.ua=function(a,b,c){a=Te(this,b);if(-1===a){if(this.g<Ze){a=this.e;for(var d=a.length,e=Array(d+2),f=0;;)if(f<d)e[f]=a[f],f+=1;else break;e[d]=b;e[d+1]=c;return new la(this.j,this.g+1,e,null)}return eb(Oa(Yd($e,this),b,c),this.j)}return c===this.e[a+1]?this:u?(b=va(this.e),b[a+1]=c,new la(this.j,this.g,b,null)):null};g.kb=function(a,b){return-1!==Te(this,b)};g.H=function(){var a=this.e;return 0<=a.length-2?new Ue(a,0,null):null};g.F=function(a,b){return new la(b,this.g,this.e,this.m)};
g.G=function(a,b){if(Hc(b))return Oa(this,D.a(b,0),D.a(b,1));for(var c=this,d=E(b);;){if(null==d)return c;var e=F(d);if(Hc(e))c=Oa(c,D.a(e,0),D.a(e,1)),d=I(d);else throw Error("conj on a map takes map entries or seqables of map entries");}};g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.u(null,c);case 3:return this.C(null,c,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};
g.b=function(a){return this.u(null,a)};g.a=function(a,b){return this.C(null,a,b)};var Ye=new la(null,0,[],null),Ze=8;function af(a){for(var b=a.length,c=0,d=yb(Ye);;)if(c<b)var e=c+2,d=Bb(d,a[c],a[c+1]),c=e;else return Ab(d)}function Xe(a,b,c){this.Ra=a;this.ja=b;this.e=c;this.q=56;this.i=258}g=Xe.prototype;
g.Ab=function(a,b){if(r(this.Ra)){var c=Te(this,b);0<=c&&(this.e[c]=this.e[this.ja-2],this.e[c+1]=this.e[this.ja-1],c=this.e,c.pop(),c.pop(),this.ja-=2);return this}throw Error("dissoc! after persistent!");};g.cb=function(a,b,c){if(r(this.Ra)){a=Te(this,b);if(-1===a)return this.ja+2<=2*Ze?(this.ja+=2,this.e.push(b),this.e.push(c),this):xd.c(bf.a?bf.a(this.ja,this.e):bf.call(null,this.ja,this.e),b,c);c!==this.e[a+1]&&(this.e[a+1]=c);return this}throw Error("assoc! after persistent!");};
g.Ka=function(a,b){if(r(this.Ra)){if(b?b.i&2048||b.dc||(b.i?0:s(Sa,b)):s(Sa,b))return Bb(this,cf.b?cf.b(b):cf.call(null,b),df.b?df.b(b):df.call(null,b));for(var c=E(b),d=this;;){var e=F(c);if(r(e))c=I(c),d=Bb(d,cf.b?cf.b(e):cf.call(null,e),df.b?df.b(e):df.call(null,e));else return d}}else throw Error("conj! after persistent!");};g.Oa=function(){if(r(this.Ra))return this.Ra=!1,new la(null,Yc(this.ja),this.e,null);throw Error("persistent! called twice");};g.u=function(a,b){return La.c(this,b,null)};
g.C=function(a,b,c){if(r(this.Ra))return a=Te(this,b),-1===a?c:this.e[a+1];throw Error("lookup after persistent!");};g.L=function(){if(r(this.Ra))return Yc(this.ja);throw Error("count after persistent!");};function bf(a,b){for(var c=yb($e),d=0;;)if(d<a)c=xd.c(c,b[d],b[d+1]),d+=2;else return c}function ef(){this.l=!1}function ff(a,b){return a===b?!0:hd(a,b)?!0:u?Wb.a(a,b):null}
var gf=function(){function a(a,b,c,h,k){a=va(a);a[b]=c;a[h]=k;return a}function b(a,b,c){a=va(a);a[b]=c;return a}var c=null,c=function(c,e,f,h,k){switch(arguments.length){case 3:return b.call(this,c,e,f);case 5:return a.call(this,c,e,f,h,k)}throw Error("Invalid arity: "+arguments.length);};c.c=b;c.s=a;return c}();function hf(a,b){var c=Array(a.length-2);Kc(a,0,c,0,2*b);Kc(a,2*(b+1),c,2*b,c.length-2*b);return c}
var jf=function(){function a(a,b,c,h,k,l){a=a.La(b);a.e[c]=h;a.e[k]=l;return a}function b(a,b,c,h){a=a.La(b);a.e[c]=h;return a}var c=null,c=function(c,e,f,h,k,l){switch(arguments.length){case 4:return b.call(this,c,e,f,h);case 6:return a.call(this,c,e,f,h,k,l)}throw Error("Invalid arity: "+arguments.length);};c.n=b;c.X=a;return c}();
function kf(a,b,c){for(var d=a.length,e=0;;)if(e<d){var f=a[e];null!=f?c=b.c?b.c(c,f,a[e+1]):b.call(null,c,f,a[e+1]):(f=a[e+1],c=null!=f?f.Ta(b,c):c);if(fc(c))return K.b?K.b(c):K.call(null,c);e+=2}else return c}function lf(a,b,c){this.t=a;this.A=b;this.e=c}g=lf.prototype;g.La=function(a){if(a===this.t)return this;var b=Zc(this.A),c=Array(0>b?4:2*(b+1));Kc(this.e,0,c,0,2*b);return new lf(a,this.A,c)};
g.gb=function(a,b,c,d,e){var f=1<<(c>>>b&31);if(0===(this.A&f))return this;var h=Zc(this.A&f-1),k=this.e[2*h],l=this.e[2*h+1];return null==k?(b=l.gb(a,b+5,c,d,e),b===l?this:null!=b?jf.n(this,a,2*h+1,b):this.A===f?null:u?mf(this,a,f,h):null):ff(d,k)?(e[0]=!0,mf(this,a,f,h)):u?this:null};function mf(a,b,c,d){if(a.A===c)return null;a=a.La(b);b=a.e;var e=b.length;a.A^=c;Kc(b,2*(d+1),b,2*d,e-2*(d+1));b[e-2]=null;b[e-1]=null;return a}g.eb=function(){return nf.b?nf.b(this.e):nf.call(null,this.e)};
g.Ta=function(a,b){return kf(this.e,a,b)};g.Ma=function(a,b,c,d){var e=1<<(b>>>a&31);if(0===(this.A&e))return d;var f=Zc(this.A&e-1),e=this.e[2*f],f=this.e[2*f+1];return null==e?f.Ma(a+5,b,c,d):ff(c,e)?f:u?d:null};
g.ia=function(a,b,c,d,e,f){var h=1<<(c>>>b&31),k=Zc(this.A&h-1);if(0===(this.A&h)){var l=Zc(this.A);if(2*l<this.e.length){a=this.La(a);b=a.e;f.l=!0;a:for(c=2*(l-k),f=2*k+(c-1),l=2*(k+1)+(c-1);;){if(0===c)break a;b[l]=b[f];l-=1;c-=1;f-=1}b[2*k]=d;b[2*k+1]=e;a.A|=h;return a}if(16<=l){k=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];k[c>>>b&31]=of.ia(a,b+5,c,d,e,f);for(e=d=0;;)if(32>d)0!==
(this.A>>>d&1)&&(k[d]=null!=this.e[e]?of.ia(a,b+5,Tb(this.e[e]),this.e[e],this.e[e+1],f):this.e[e+1],e+=2),d+=1;else break;return new pf(a,l+1,k)}return u?(b=Array(2*(l+4)),Kc(this.e,0,b,0,2*k),b[2*k]=d,b[2*k+1]=e,Kc(this.e,2*k,b,2*(k+1),2*(l-k)),f.l=!0,a=this.La(a),a.e=b,a.A|=h,a):null}l=this.e[2*k];h=this.e[2*k+1];return null==l?(l=h.ia(a,b+5,c,d,e,f),l===h?this:jf.n(this,a,2*k+1,l)):ff(d,l)?e===h?this:jf.n(this,a,2*k+1,e):u?(f.l=!0,jf.X(this,a,2*k,null,2*k+1,qf.ga?qf.ga(a,b+5,l,h,c,d,e):qf.call(null,
a,b+5,l,h,c,d,e))):null};
g.ha=function(a,b,c,d,e){var f=1<<(b>>>a&31),h=Zc(this.A&f-1);if(0===(this.A&f)){var k=Zc(this.A);if(16<=k){h=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];h[b>>>a&31]=of.ha(a+5,b,c,d,e);for(d=c=0;;)if(32>c)0!==(this.A>>>c&1)&&(h[c]=null!=this.e[d]?of.ha(a+5,Tb(this.e[d]),this.e[d],this.e[d+1],e):this.e[d+1],d+=2),c+=1;else break;return new pf(null,k+1,h)}a=Array(2*(k+1));Kc(this.e,
0,a,0,2*h);a[2*h]=c;a[2*h+1]=d;Kc(this.e,2*h,a,2*(h+1),2*(k-h));e.l=!0;return new lf(null,this.A|f,a)}k=this.e[2*h];f=this.e[2*h+1];return null==k?(k=f.ha(a+5,b,c,d,e),k===f?this:new lf(null,this.A,gf.c(this.e,2*h+1,k))):ff(c,k)?d===f?this:new lf(null,this.A,gf.c(this.e,2*h+1,d)):u?(e.l=!0,new lf(null,this.A,gf.s(this.e,2*h,null,2*h+1,qf.X?qf.X(a+5,k,f,b,c,d):qf.call(null,a+5,k,f,b,c,d)))):null};
g.fb=function(a,b,c){var d=1<<(b>>>a&31);if(0===(this.A&d))return this;var e=Zc(this.A&d-1),f=this.e[2*e],h=this.e[2*e+1];return null==f?(a=h.fb(a+5,b,c),a===h?this:null!=a?new lf(null,this.A,gf.c(this.e,2*e+1,a)):this.A===d?null:u?new lf(null,this.A^d,hf(this.e,e)):null):ff(c,f)?new lf(null,this.A^d,hf(this.e,e)):u?this:null};var of=new lf(null,0,[]);
function rf(a,b,c){var d=a.e;a=2*(a.g-1);for(var e=Array(a),f=0,h=1,k=0;;)if(f<a)f!==c&&null!=d[f]&&(e[h]=d[f],h+=2,k|=1<<f),f+=1;else return new lf(b,k,e)}function pf(a,b,c){this.t=a;this.g=b;this.e=c}g=pf.prototype;g.La=function(a){return a===this.t?this:new pf(a,this.g,va(this.e))};
g.gb=function(a,b,c,d,e){var f=c>>>b&31,h=this.e[f];if(null==h)return this;b=h.gb(a,b+5,c,d,e);if(b===h)return this;if(null==b){if(8>=this.g)return rf(this,a,f);a=jf.n(this,a,f,b);a.g-=1;return a}return u?jf.n(this,a,f,b):null};g.eb=function(){return sf.b?sf.b(this.e):sf.call(null,this.e)};g.Ta=function(a,b){for(var c=this.e.length,d=0,e=b;;)if(d<c){var f=this.e[d];if(null!=f&&(e=f.Ta(a,e),fc(e)))return K.b?K.b(e):K.call(null,e);d+=1}else return e};
g.Ma=function(a,b,c,d){var e=this.e[b>>>a&31];return null!=e?e.Ma(a+5,b,c,d):d};g.ia=function(a,b,c,d,e,f){var h=c>>>b&31,k=this.e[h];if(null==k)return a=jf.n(this,a,h,of.ia(a,b+5,c,d,e,f)),a.g+=1,a;b=k.ia(a,b+5,c,d,e,f);return b===k?this:jf.n(this,a,h,b)};g.ha=function(a,b,c,d,e){var f=b>>>a&31,h=this.e[f];if(null==h)return new pf(null,this.g+1,gf.c(this.e,f,of.ha(a+5,b,c,d,e)));a=h.ha(a+5,b,c,d,e);return a===h?this:new pf(null,this.g,gf.c(this.e,f,a))};
g.fb=function(a,b,c){var d=b>>>a&31,e=this.e[d];return null!=e?(a=e.fb(a+5,b,c),a===e?this:null==a?8>=this.g?rf(this,null,d):new pf(null,this.g-1,gf.c(this.e,d,a)):u?new pf(null,this.g,gf.c(this.e,d,a)):null):this};function tf(a,b,c){b*=2;for(var d=0;;)if(d<b){if(ff(c,a[d]))return d;d+=2}else return-1}function uf(a,b,c,d){this.t=a;this.ra=b;this.g=c;this.e=d}g=uf.prototype;
g.La=function(a){if(a===this.t)return this;var b=Array(2*(this.g+1));Kc(this.e,0,b,0,2*this.g);return new uf(a,this.ra,this.g,b)};g.gb=function(a,b,c,d,e){b=tf(this.e,this.g,d);if(-1===b)return this;e[0]=!0;if(1===this.g)return null;a=this.La(a);e=a.e;e[b]=e[2*this.g-2];e[b+1]=e[2*this.g-1];e[2*this.g-1]=null;e[2*this.g-2]=null;a.g-=1;return a};g.eb=function(){return nf.b?nf.b(this.e):nf.call(null,this.e)};g.Ta=function(a,b){return kf(this.e,a,b)};
g.Ma=function(a,b,c,d){a=tf(this.e,this.g,c);return 0>a?d:ff(c,this.e[a])?this.e[a+1]:u?d:null};
g.ia=function(a,b,c,d,e,f){if(c===this.ra){b=tf(this.e,this.g,d);if(-1===b){if(this.e.length>2*this.g)return a=jf.X(this,a,2*this.g,d,2*this.g+1,e),f.l=!0,a.g+=1,a;c=this.e.length;b=Array(c+2);Kc(this.e,0,b,0,c);b[c]=d;b[c+1]=e;f.l=!0;f=this.g+1;a===this.t?(this.e=b,this.g=f,a=this):a=new uf(this.t,this.ra,f,b);return a}return this.e[b+1]===e?this:jf.n(this,a,b+1,e)}return(new lf(a,1<<(this.ra>>>b&31),[null,this,null,null])).ia(a,b,c,d,e,f)};
g.ha=function(a,b,c,d,e){return b===this.ra?(a=tf(this.e,this.g,c),-1===a?(a=2*this.g,b=Array(a+2),Kc(this.e,0,b,0,a),b[a]=c,b[a+1]=d,e.l=!0,new uf(null,this.ra,this.g+1,b)):Wb.a(this.e[a],d)?this:new uf(null,this.ra,this.g,gf.c(this.e,a+1,d))):(new lf(null,1<<(this.ra>>>a&31),[null,this])).ha(a,b,c,d,e)};g.fb=function(a,b,c){a=tf(this.e,this.g,c);return-1===a?this:1===this.g?null:u?new uf(null,this.ra,this.g-1,hf(this.e,Yc(a))):null};
var qf=function(){function a(a,b,c,h,k,l,n){var q=Tb(c);if(q===k)return new uf(null,q,2,[c,h,l,n]);var t=new ef;return of.ia(a,b,q,c,h,t).ia(a,b,k,l,n,t)}function b(a,b,c,h,k,l){var n=Tb(b);if(n===h)return new uf(null,n,2,[b,c,k,l]);var q=new ef;return of.ha(a,n,b,c,q).ha(a,h,k,l,q)}var c=null,c=function(c,e,f,h,k,l,n){switch(arguments.length){case 6:return b.call(this,c,e,f,h,k,l);case 7:return a.call(this,c,e,f,h,k,l,n)}throw Error("Invalid arity: "+arguments.length);};c.X=b;c.ga=a;return c}();
function vf(a,b,c,d,e){this.j=a;this.ka=b;this.p=c;this.r=d;this.m=e;this.q=0;this.i=32374860}g=vf.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.j};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(H,this.j)};g.N=function(a,b){return nc.a(b,this)};g.M=function(a,b,c){return nc.c(b,c,this)};g.Q=function(){return null==this.r?new W(null,2,5,X,[this.ka[this.p],this.ka[this.p+1]],null):F(this.r)};
g.S=function(){return null==this.r?nf.c?nf.c(this.ka,this.p+2,null):nf.call(null,this.ka,this.p+2,null):nf.c?nf.c(this.ka,this.p,I(this.r)):nf.call(null,this.ka,this.p,I(this.r))};g.H=function(){return this};g.F=function(a,b){return new vf(b,this.ka,this.p,this.r,this.m)};g.G=function(a,b){return M(b,this)};
var nf=function(){function a(a,b,c){if(null==c)for(c=a.length;;)if(b<c){if(null!=a[b])return new vf(null,a,b,null,null);var h=a[b+1];if(r(h)&&(h=h.eb(),r(h)))return new vf(null,a,b+2,h,null);b+=2}else return null;else return new vf(null,a,b,c,null)}function b(a){return c.c(a,0,null)}var c=null,c=function(c,e,f){switch(arguments.length){case 1:return b.call(this,c);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.c=a;return c}();
function wf(a,b,c,d,e){this.j=a;this.ka=b;this.p=c;this.r=d;this.m=e;this.q=0;this.i=32374860}g=wf.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.j};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(H,this.j)};g.N=function(a,b){return nc.a(b,this)};g.M=function(a,b,c){return nc.c(b,c,this)};g.Q=function(){return F(this.r)};
g.S=function(){return sf.n?sf.n(null,this.ka,this.p,I(this.r)):sf.call(null,null,this.ka,this.p,I(this.r))};g.H=function(){return this};g.F=function(a,b){return new wf(b,this.ka,this.p,this.r,this.m)};g.G=function(a,b){return M(b,this)};
var sf=function(){function a(a,b,c,h){if(null==h)for(h=b.length;;)if(c<h){var k=b[c];if(r(k)&&(k=k.eb(),r(k)))return new wf(a,b,c+1,k,null);c+=1}else return null;else return new wf(a,b,c,h,null)}function b(a){return c.n(null,a,0,null)}var c=null,c=function(c,e,f,h){switch(arguments.length){case 1:return b.call(this,c);case 4:return a.call(this,c,e,f,h)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.n=a;return c}();
function xf(a,b,c,d,e,f){this.j=a;this.g=b;this.root=c;this.T=d;this.Y=e;this.m=f;this.i=16123663;this.q=8196}g=xf.prototype;g.toString=function(){return Lb(this)};g.keys=function(){return Oe(Ve.b?Ve.b(this):Ve.call(null,this))};g.entries=function(){return Qe(E(this))};g.values=function(){return Oe(We.b?We.b(this):We.call(null,this))};g.has=function(a){return Oc(this,a)};g.get=function(a){return this.u(null,a)};
g.forEach=function(a){for(var b=E(this),c=null,d=0,e=0;;)if(e<d){var f=c.J(null,e),h=P.c(f,0,null),f=P.c(f,1,null);a.a?a.a(f,h):a.call(null,f,h);e+=1}else if(b=E(b))Ic(b)?(c=Hb(b),b=Ib(b),h=c,d=O(c),c=h):(c=F(b),h=P.c(c,0,null),f=P.c(c,1,null),a.a?a.a(f,h):a.call(null,f,h),b=I(b),c=null,d=0),e=0;else return null};g.u=function(a,b){return La.c(this,b,null)};g.C=function(a,b,c){return null==b?this.T?this.Y:c:null==this.root?c:u?this.root.Ma(0,Tb(b),b,c):null};
g.Za=function(a,b,c){a=this.T?b.c?b.c(c,null,this.Y):b.call(null,c,null,this.Y):c;return fc(a)?K.b?K.b(a):K.call(null,a):null!=this.root?this.root.Ta(b,a):u?a:null};g.D=function(){return this.j};g.L=function(){return this.g};g.B=function(){var a=this.m;return null!=a?a:this.m=a=dc(this)};g.v=function(a,b){return Me(this,b)};g.Wa=function(){return new yf({},this.root,this.g,this.T,this.Y)};g.I=function(){return eb($e,this.j)};
g.nb=function(a,b){if(null==b)return this.T?new xf(this.j,this.g-1,this.root,!1,null,null):this;if(null==this.root)return this;if(u){var c=this.root.fb(0,Tb(b),b);return c===this.root?this:new xf(this.j,this.g-1,c,this.T,this.Y,null)}return null};
g.ua=function(a,b,c){if(null==b)return this.T&&c===this.Y?this:new xf(this.j,this.T?this.g:this.g+1,this.root,!0,c,null);a=new ef;b=(null==this.root?of:this.root).ha(0,Tb(b),b,c,a);return b===this.root?this:new xf(this.j,a.l?this.g+1:this.g,b,this.T,this.Y,null)};g.kb=function(a,b){return null==b?this.T:null==this.root?!1:u?this.root.Ma(0,Tb(b),b,Lc)!==Lc:null};g.H=function(){if(0<this.g){var a=null!=this.root?this.root.eb():null;return this.T?M(new W(null,2,5,X,[null,this.Y],null),a):a}return null};
g.F=function(a,b){return new xf(b,this.g,this.root,this.T,this.Y,this.m)};g.G=function(a,b){if(Hc(b))return Oa(this,D.a(b,0),D.a(b,1));for(var c=this,d=E(b);;){if(null==d)return c;var e=F(d);if(Hc(e))c=Oa(c,D.a(e,0),D.a(e,1)),d=I(d);else throw Error("conj on a map takes map entries or seqables of map entries");}};
g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.u(null,c);case 3:return this.C(null,c,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return this.u(null,a)};g.a=function(a,b){return this.C(null,a,b)};var $e=new xf(null,0,null,!1,null,0);function sc(a,b){for(var c=a.length,d=0,e=yb($e);;)if(d<c)var f=d+1,e=e.cb(null,a[d],b[d]),d=f;else return Ab(e)}
function yf(a,b,c,d,e){this.t=a;this.root=b;this.count=c;this.T=d;this.Y=e;this.q=56;this.i=258}g=yf.prototype;g.Ab=function(a,b){if(this.t)if(null==b)this.T&&(this.T=!1,this.Y=null,this.count-=1);else{if(null!=this.root){var c=new ef,d=this.root.gb(this.t,0,Tb(b),b,c);d!==this.root&&(this.root=d);r(c[0])&&(this.count-=1)}}else throw Error("dissoc! after persistent!");return this};g.cb=function(a,b,c){return zf(this,b,c)};
g.Ka=function(a,b){var c;a:{if(this.t){if(b?b.i&2048||b.dc||(b.i?0:s(Sa,b)):s(Sa,b)){c=zf(this,cf.b?cf.b(b):cf.call(null,b),df.b?df.b(b):df.call(null,b));break a}c=E(b);for(var d=this;;){var e=F(c);if(r(e))c=I(c),d=zf(d,cf.b?cf.b(e):cf.call(null,e),df.b?df.b(e):df.call(null,e));else{c=d;break a}}}else throw Error("conj! after persistent");c=void 0}return c};
g.Oa=function(){var a;if(this.t)this.t=null,a=new xf(null,this.count,this.root,this.T,this.Y,null);else throw Error("persistent! called twice");return a};g.u=function(a,b){return null==b?this.T?this.Y:null:null==this.root?null:this.root.Ma(0,Tb(b),b)};g.C=function(a,b,c){return null==b?this.T?this.Y:c:null==this.root?c:this.root.Ma(0,Tb(b),b,c)};g.L=function(){if(this.t)return this.count;throw Error("count after persistent!");};
function zf(a,b,c){if(a.t){if(null==b)a.Y!==c&&(a.Y=c),a.T||(a.count+=1,a.T=!0);else{var d=new ef;b=(null==a.root?of:a.root).ia(a.t,0,Tb(b),b,c,d);b!==a.root&&(a.root=b);d.l&&(a.count+=1)}return a}throw Error("assoc! after persistent!");}function Af(a,b,c){for(var d=b;;)if(null!=a)b=c?a.left:a.right,d=pc.a(d,a),a=b;else return d}function Bf(a,b,c,d,e){this.j=a;this.stack=b;this.ib=c;this.g=d;this.m=e;this.q=0;this.i=32374862}g=Bf.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.j};
g.L=function(){return 0>this.g?O(I(this))+1:this.g};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(H,this.j)};g.N=function(a,b){return nc.a(b,this)};g.M=function(a,b,c){return nc.c(b,c,this)};g.Q=function(){return yc(this.stack)};g.S=function(){var a=F(this.stack),a=Af(this.ib?a.right:a.left,I(this.stack),this.ib);return null!=a?new Bf(null,a,this.ib,this.g-1,null):H};g.H=function(){return this};
g.F=function(a,b){return new Bf(b,this.stack,this.ib,this.g,this.m)};g.G=function(a,b){return M(b,this)};function Cf(a,b,c){return new Bf(null,Af(a,null,b),b,c,null)}function Df(a,b,c,d){return c instanceof Y?c.left instanceof Y?new Y(c.key,c.l,c.left.qa(),new $(a,b,c.right,d,null),null):c.right instanceof Y?new Y(c.right.key,c.right.l,new $(c.key,c.l,c.left,c.right.left,null),new $(a,b,c.right.right,d,null),null):u?new $(a,b,c,d,null):null:new $(a,b,c,d,null)}
function Ef(a,b,c,d){return d instanceof Y?d.right instanceof Y?new Y(d.key,d.l,new $(a,b,c,d.left,null),d.right.qa(),null):d.left instanceof Y?new Y(d.left.key,d.left.l,new $(a,b,c,d.left.left,null),new $(d.key,d.l,d.left.right,d.right,null),null):u?new $(a,b,c,d,null):null:new $(a,b,c,d,null)}
function Ff(a,b,c,d){if(c instanceof Y)return new Y(a,b,c.qa(),d,null);if(d instanceof $)return Ef(a,b,c,d.hb());if(d instanceof Y&&d.left instanceof $)return new Y(d.left.key,d.left.l,new $(a,b,c,d.left.left,null),Ef(d.key,d.l,d.left.right,d.right.hb()),null);if(u)throw Error("red-black tree invariant violation");return null}
var Hf=function Gf(b,c,d){d=null!=b.left?Gf(b.left,c,d):d;if(fc(d))return K.b?K.b(d):K.call(null,d);d=c.c?c.c(d,b.key,b.l):c.call(null,d,b.key,b.l);if(fc(d))return K.b?K.b(d):K.call(null,d);b=null!=b.right?Gf(b.right,c,d):d;return fc(b)?K.b?K.b(b):K.call(null,b):b};function $(a,b,c,d,e){this.key=a;this.l=b;this.left=c;this.right=d;this.m=e;this.q=0;this.i=32402207}g=$.prototype;g.Hb=function(a){return a.Jb(this)};g.hb=function(){return new Y(this.key,this.l,this.left,this.right,null)};g.qa=function(){return this};
g.Gb=function(a){return a.Ib(this)};g.replace=function(a,b,c,d){return new $(a,b,c,d,null)};g.Ib=function(a){return new $(a.key,a.l,this,a.right,null)};g.Jb=function(a){return new $(a.key,a.l,a.left,this,null)};g.Ta=function(a,b){return Hf(this,a,b)};g.u=function(a,b){return D.c(this,b,null)};g.C=function(a,b,c){return D.c(this,b,c)};g.J=function(a,b){return 0===b?this.key:1===b?this.l:null};g.aa=function(a,b,c){return 0===b?this.key:1===b?this.l:u?c:null};
g.Pa=function(a,b,c){return(new W(null,2,5,X,[this.key,this.l],null)).Pa(null,b,c)};g.D=function(){return null};g.L=function(){return 2};g.$a=function(){return this.key};g.ab=function(){return this.l};g.Ia=function(){return this.l};g.Ja=function(){return new W(null,1,5,X,[this.key],null)};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return qe};g.N=function(a,b){return gc.a(this,b)};g.M=function(a,b,c){return gc.c(this,b,c)};
g.ua=function(a,b,c){return R.c(new W(null,2,5,X,[this.key,this.l],null),b,c)};g.H=function(){return Da(Da(H,this.l),this.key)};g.F=function(a,b){return N(new W(null,2,5,X,[this.key,this.l],null),b)};g.G=function(a,b){return new W(null,3,5,X,[this.key,this.l,b],null)};g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.u(null,c);case 3:return this.C(null,c,d)}throw Error("Invalid arity: "+arguments.length);}}();
g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return this.u(null,a)};g.a=function(a,b){return this.C(null,a,b)};function Y(a,b,c,d,e){this.key=a;this.l=b;this.left=c;this.right=d;this.m=e;this.q=0;this.i=32402207}g=Y.prototype;g.Hb=function(a){return new Y(this.key,this.l,this.left,a,null)};g.hb=function(){throw Error("red-black tree invariant violation");};g.qa=function(){return new $(this.key,this.l,this.left,this.right,null)};
g.Gb=function(a){return new Y(this.key,this.l,a,this.right,null)};g.replace=function(a,b,c,d){return new Y(a,b,c,d,null)};g.Ib=function(a){return this.left instanceof Y?new Y(this.key,this.l,this.left.qa(),new $(a.key,a.l,this.right,a.right,null),null):this.right instanceof Y?new Y(this.right.key,this.right.l,new $(this.key,this.l,this.left,this.right.left,null),new $(a.key,a.l,this.right.right,a.right,null),null):u?new $(a.key,a.l,this,a.right,null):null};
g.Jb=function(a){return this.right instanceof Y?new Y(this.key,this.l,new $(a.key,a.l,a.left,this.left,null),this.right.qa(),null):this.left instanceof Y?new Y(this.left.key,this.left.l,new $(a.key,a.l,a.left,this.left.left,null),new $(this.key,this.l,this.left.right,this.right,null),null):u?new $(a.key,a.l,a.left,this,null):null};g.Ta=function(a,b){return Hf(this,a,b)};g.u=function(a,b){return D.c(this,b,null)};g.C=function(a,b,c){return D.c(this,b,c)};
g.J=function(a,b){return 0===b?this.key:1===b?this.l:null};g.aa=function(a,b,c){return 0===b?this.key:1===b?this.l:u?c:null};g.Pa=function(a,b,c){return(new W(null,2,5,X,[this.key,this.l],null)).Pa(null,b,c)};g.D=function(){return null};g.L=function(){return 2};g.$a=function(){return this.key};g.ab=function(){return this.l};g.Ia=function(){return this.l};g.Ja=function(){return new W(null,1,5,X,[this.key],null)};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};
g.v=function(a,b){return lc(this,b)};g.I=function(){return qe};g.N=function(a,b){return gc.a(this,b)};g.M=function(a,b,c){return gc.c(this,b,c)};g.ua=function(a,b,c){return R.c(new W(null,2,5,X,[this.key,this.l],null),b,c)};g.H=function(){return Da(Da(H,this.l),this.key)};g.F=function(a,b){return N(new W(null,2,5,X,[this.key,this.l],null),b)};g.G=function(a,b){return new W(null,3,5,X,[this.key,this.l,b],null)};
g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.u(null,c);case 3:return this.C(null,c,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return this.u(null,a)};g.a=function(a,b){return this.C(null,a,b)};
var Jf=function If(b,c,d,e,f){if(null==c)return new Y(d,e,null,null,null);var h=b.a?b.a(d,c.key):b.call(null,d,c.key);return 0===h?(f[0]=c,null):0>h?(b=If(b,c.left,d,e,f),null!=b?c.Gb(b):null):u?(b=If(b,c.right,d,e,f),null!=b?c.Hb(b):null):null},Lf=function Kf(b,c){if(null==b)return c;if(null==c)return b;if(b instanceof Y){if(c instanceof Y){var d=Kf(b.right,c.left);return d instanceof Y?new Y(d.key,d.l,new Y(b.key,b.l,b.left,d.left,null),new Y(c.key,c.l,d.right,c.right,null),null):new Y(b.key,b.l,
b.left,new Y(c.key,c.l,d,c.right,null),null)}return new Y(b.key,b.l,b.left,Kf(b.right,c),null)}return c instanceof Y?new Y(c.key,c.l,Kf(b,c.left),c.right,null):u?(d=Kf(b.right,c.left),d instanceof Y?new Y(d.key,d.l,new $(b.key,b.l,b.left,d.left,null),new $(c.key,c.l,d.right,c.right,null),null):Ff(b.key,b.l,b.left,new $(c.key,c.l,d,c.right,null))):null},Nf=function Mf(b,c,d,e){if(null!=c){var f=b.a?b.a(d,c.key):b.call(null,d,c.key);if(0===f)return e[0]=c,Lf(c.left,c.right);if(0>f)return b=Mf(b,c.left,
d,e),null!=b||null!=e[0]?c.left instanceof $?Ff(c.key,c.l,b,c.right):new Y(c.key,c.l,b,c.right,null):null;if(u){b=Mf(b,c.right,d,e);if(null!=b||null!=e[0])if(c.right instanceof $)if(e=c.key,d=c.l,c=c.left,b instanceof Y)c=new Y(e,d,c,b.qa(),null);else if(c instanceof $)c=Df(e,d,c.hb(),b);else if(c instanceof Y&&c.right instanceof $)c=new Y(c.right.key,c.right.l,Df(c.key,c.l,c.left.hb(),c.right.left),new $(e,d,c.right.right,b,null),null);else{if(u)throw Error("red-black tree invariant violation");
c=null}else c=new Y(c.key,c.l,c.left,b,null);else c=null;return c}}return null},Pf=function Of(b,c,d,e){var f=c.key,h=b.a?b.a(d,f):b.call(null,d,f);return 0===h?c.replace(f,e,c.left,c.right):0>h?c.replace(f,c.l,Of(b,c.left,d,e),c.right):u?c.replace(f,c.l,c.left,Of(b,c.right,d,e)):null};function Qf(a,b,c,d,e){this.Z=a;this.ma=b;this.g=c;this.j=d;this.m=e;this.i=418776847;this.q=8192}g=Qf.prototype;g.toString=function(){return Lb(this)};g.keys=function(){return Oe(Ve.b?Ve.b(this):Ve.call(null,this))};
g.entries=function(){return Qe(E(this))};g.values=function(){return Oe(We.b?We.b(this):We.call(null,this))};g.has=function(a){return Oc(this,a)};g.get=function(a){return this.u(null,a)};g.forEach=function(a){for(var b=E(this),c=null,d=0,e=0;;)if(e<d){var f=c.J(null,e),h=P.c(f,0,null),f=P.c(f,1,null);a.a?a.a(f,h):a.call(null,f,h);e+=1}else if(b=E(b))Ic(b)?(c=Hb(b),b=Ib(b),h=c,d=O(c),c=h):(c=F(b),h=P.c(c,0,null),f=P.c(c,1,null),a.a?a.a(f,h):a.call(null,f,h),b=I(b),c=null,d=0),e=0;else return null};
function Rf(a,b){for(var c=a.ma;;)if(null!=c){var d=a.Z.a?a.Z.a(b,c.key):a.Z.call(null,b,c.key);if(0===d)return c;if(0>d)c=c.left;else if(u)c=c.right;else return null}else return null}g.u=function(a,b){return La.c(this,b,null)};g.C=function(a,b,c){a=Rf(this,b);return null!=a?a.l:c};g.Za=function(a,b,c){return null!=this.ma?Hf(this.ma,b,c):c};g.D=function(){return this.j};g.L=function(){return this.g};g.Xa=function(){return 0<this.g?Cf(this.ma,!1,this.g):null};
g.B=function(){var a=this.m;return null!=a?a:this.m=a=dc(this)};g.v=function(a,b){return Me(this,b)};g.I=function(){return N(Sf,this.j)};g.nb=function(a,b){var c=[null],d=Nf(this.Z,this.ma,b,c);return null==d?null==P.a(c,0)?this:new Qf(this.Z,null,0,this.j,null):new Qf(this.Z,d.qa(),this.g-1,this.j,null)};
g.ua=function(a,b,c){a=[null];var d=Jf(this.Z,this.ma,b,c,a);return null==d?(a=P.a(a,0),Wb.a(c,a.l)?this:new Qf(this.Z,Pf(this.Z,this.ma,b,c),this.g,this.j,null)):new Qf(this.Z,d.qa(),this.g+1,this.j,null)};g.kb=function(a,b){return null!=Rf(this,b)};g.H=function(){return 0<this.g?Cf(this.ma,!0,this.g):null};g.F=function(a,b){return new Qf(this.Z,this.ma,this.g,b,this.m)};
g.G=function(a,b){if(Hc(b))return Oa(this,D.a(b,0),D.a(b,1));for(var c=this,d=E(b);;){if(null==d)return c;var e=F(d);if(Hc(e))c=Oa(c,D.a(e,0),D.a(e,1)),d=I(d);else throw Error("conj on a map takes map entries or seqables of map entries");}};g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.u(null,c);case 3:return this.C(null,c,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};
g.b=function(a){return this.u(null,a)};g.a=function(a,b){return this.C(null,a,b)};g.yb=function(a,b){return 0<this.g?Cf(this.ma,b,this.g):null};g.zb=function(a,b,c){if(0<this.g){a=null;for(var d=this.ma;;)if(null!=d){var e=this.Z.a?this.Z.a(b,d.key):this.Z.call(null,b,d.key);if(0===e)return new Bf(null,pc.a(a,d),c,-1,null);if(r(c))0>e?(a=pc.a(a,d),d=d.left):d=d.right;else if(u)0<e?(a=pc.a(a,d),d=d.right):d=d.left;else return null}else return null==a?null:new Bf(null,a,c,-1,null)}else return null};
g.xb=function(a,b){return cf.b?cf.b(b):cf.call(null,b)};g.wb=function(){return this.Z};
var Sf=new Qf(Xb,null,0,null,0),Tf=function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){a=E(a);for(var b=yb($e);;)if(a){var e=I(I(a)),b=xd.c(b,F(a),F(I(a)));a=e}else return Ab(b)}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}(),Uf=function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return new la(null,Yc(O(a)),S.a(wa,
a),null)}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}(),Vf=function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){a=E(a);for(var b=Sf;;)if(a){var e=I(I(a)),b=R.c(b,F(a),F(I(a)));a=e}else return b}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}(),Wf=function(){function a(a,d){var e=null;1<arguments.length&&(e=J(Array.prototype.slice.call(arguments,1),0));return b.call(this,a,e)}function b(a,
b){for(var e=E(b),f=new Qf(Qc(a),null,0,null,0);;)if(e)var h=I(I(e)),f=R.c(f,F(e),F(I(e))),e=h;else return f}a.k=1;a.f=function(a){var d=F(a);a=G(a);return b(d,a)};a.d=b;return a}();function Xf(a,b){this.V=a;this.W=b;this.q=0;this.i=32374988}g=Xf.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.W};g.U=function(){var a=this.V,a=(a?a.i&128||a.ob||(a.i?0:s(Ja,a)):s(Ja,a))?this.V.U(null):I(this.V);return null==a?null:new Xf(a,this.W)};g.B=function(){return cc(this)};
g.v=function(a,b){return lc(this,b)};g.I=function(){return N(H,this.W)};g.N=function(a,b){return nc.a(b,this)};g.M=function(a,b,c){return nc.c(b,c,this)};g.Q=function(){return this.V.Q(null).$a(null)};g.S=function(){var a=this.V,a=(a?a.i&128||a.ob||(a.i?0:s(Ja,a)):s(Ja,a))?this.V.U(null):I(this.V);return null!=a?new Xf(a,this.W):H};g.H=function(){return this};g.F=function(a,b){return new Xf(this.V,b)};g.G=function(a,b){return M(b,this)};function Ve(a){return(a=E(a))?new Xf(a,null):null}
function cf(a){return Ta(a)}function Yf(a,b){this.V=a;this.W=b;this.q=0;this.i=32374988}g=Yf.prototype;g.toString=function(){return Lb(this)};g.D=function(){return this.W};g.U=function(){var a=this.V,a=(a?a.i&128||a.ob||(a.i?0:s(Ja,a)):s(Ja,a))?this.V.U(null):I(this.V);return null==a?null:new Yf(a,this.W)};g.B=function(){return cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(H,this.W)};g.N=function(a,b){return nc.a(b,this)};g.M=function(a,b,c){return nc.c(b,c,this)};g.Q=function(){return this.V.Q(null).ab(null)};
g.S=function(){var a=this.V,a=(a?a.i&128||a.ob||(a.i?0:s(Ja,a)):s(Ja,a))?this.V.U(null):I(this.V);return null!=a?new Yf(a,this.W):H};g.H=function(){return this};g.F=function(a,b){return new Yf(this.V,b)};g.G=function(a,b){return M(b,this)};function We(a){return(a=E(a))?new Yf(a,null):null}function df(a){return Ua(a)}
var Zf=function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return r(Ed(Fd,a))?C.a(function(a,b){return pc.a(r(a)?a:Ye,b)},a):null}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}();function $f(a,b,c){this.j=a;this.Sa=b;this.m=c;this.i=15077647;this.q=8196}g=$f.prototype;g.toString=function(){return Lb(this)};g.keys=function(){return Oe(E(this))};g.entries=function(){return Se(E(this))};g.values=function(){return Oe(E(this))};
g.has=function(a){return Oc(this,a)};g.forEach=function(a){for(var b=E(this),c=null,d=0,e=0;;)if(e<d){var f=c.J(null,e),h=P.c(f,0,null),f=P.c(f,1,null);a.a?a.a(f,h):a.call(null,f,h);e+=1}else if(b=E(b))Ic(b)?(c=Hb(b),b=Ib(b),h=c,d=O(c),c=h):(c=F(b),h=P.c(c,0,null),f=P.c(c,1,null),a.a?a.a(f,h):a.call(null,f,h),b=I(b),c=null,d=0),e=0;else return null};g.u=function(a,b){return La.c(this,b,null)};g.C=function(a,b,c){return Na(this.Sa,b)?b:c};g.D=function(){return this.j};g.L=function(){return Aa(this.Sa)};
g.B=function(){var a=this.m;return null!=a?a:this.m=a=dc(this)};g.v=function(a,b){return Dc(b)&&O(this)===O(b)&&Dd(function(a){return function(b){return Oc(a,b)}}(this),b)};g.Wa=function(){return new ag(yb(this.Sa))};g.I=function(){return N(bg,this.j)};g.vb=function(a,b){return new $f(this.j,Qa(this.Sa,b),null)};g.H=function(){return Ve(this.Sa)};g.F=function(a,b){return new $f(b,this.Sa,this.m)};g.G=function(a,b){return new $f(this.j,R.c(this.Sa,b,null),null)};
g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.u(null,c);case 3:return this.C(null,c,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return this.u(null,a)};g.a=function(a,b){return this.C(null,a,b)};var bg=new $f(null,Ye,0);function ag(a){this.la=a;this.i=259;this.q=136}g=ag.prototype;
g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return La.c(this.la,c,Lc)===Lc?null:c;case 3:return La.c(this.la,c,Lc)===Lc?d:c}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return La.c(this.la,a,Lc)===Lc?null:a};g.a=function(a,b){return La.c(this.la,a,Lc)===Lc?b:a};g.u=function(a,b){return La.c(this,b,null)};g.C=function(a,b,c){return La.c(this.la,b,Lc)===Lc?c:b};
g.L=function(){return O(this.la)};g.Ob=function(a,b){this.la=yd.a(this.la,b);return this};g.Ka=function(a,b){this.la=xd.c(this.la,b,null);return this};g.Oa=function(){return new $f(null,Ab(this.la),null)};function cg(a,b,c){this.j=a;this.na=b;this.m=c;this.i=417730831;this.q=8192}g=cg.prototype;g.toString=function(){return Lb(this)};g.keys=function(){return Oe(E(this))};g.entries=function(){return Se(E(this))};g.values=function(){return Oe(E(this))};g.has=function(a){return Oc(this,a)};
g.forEach=function(a){for(var b=E(this),c=null,d=0,e=0;;)if(e<d){var f=c.J(null,e),h=P.c(f,0,null),f=P.c(f,1,null);a.a?a.a(f,h):a.call(null,f,h);e+=1}else if(b=E(b))Ic(b)?(c=Hb(b),b=Ib(b),h=c,d=O(c),c=h):(c=F(b),h=P.c(c,0,null),f=P.c(c,1,null),a.a?a.a(f,h):a.call(null,f,h),b=I(b),c=null,d=0),e=0;else return null};g.u=function(a,b){return La.c(this,b,null)};g.C=function(a,b,c){a=Rf(this.na,b);return null!=a?a.key:c};g.D=function(){return this.j};g.L=function(){return O(this.na)};
g.Xa=function(){return 0<O(this.na)?Kd.a(cf,pb(this.na)):null};g.B=function(){var a=this.m;return null!=a?a:this.m=a=dc(this)};g.v=function(a,b){return Dc(b)&&O(this)===O(b)&&Dd(function(a){return function(b){return Oc(a,b)}}(this),b)};g.I=function(){return N(dg,this.j)};g.vb=function(a,b){return new cg(this.j,tc.a(this.na,b),null)};g.H=function(){return Ve(this.na)};g.F=function(a,b){return new cg(b,this.na,this.m)};g.G=function(a,b){return new cg(this.j,R.c(this.na,b,null),null)};
g.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.u(null,c);case 3:return this.C(null,c,d)}throw Error("Invalid arity: "+arguments.length);}}();g.apply=function(a,b){return this.call.apply(this,[this].concat(va(b)))};g.b=function(a){return this.u(null,a)};g.a=function(a,b){return this.C(null,a,b)};g.yb=function(a,b){return Kd.a(cf,qb(this.na,b))};g.zb=function(a,b,c){return Kd.a(cf,rb(this.na,b,c))};g.xb=function(a,b){return b};g.wb=function(){return tb(this.na)};
var dg=new cg(null,Sf,0);function eg(a){a=E(a);if(null==a)return bg;if(a instanceof ac&&0===a.p){a=a.e;a:{for(var b=0,c=yb(bg);;)if(b<a.length)var d=b+1,c=c.Ka(null,a[b]),b=d;else{a=c;break a}a=void 0}return a.Oa(null)}if(u)for(d=yb(bg);;)if(null!=a)b=a.U(null),d=d.Ka(null,a.Q(null)),a=b;else return d.Oa(null);else return null}
var fg=function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return C.c(Da,dg,a)}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}(),gg=function(){function a(a,d){var e=null;1<arguments.length&&(e=J(Array.prototype.slice.call(arguments,1),0));return b.call(this,a,e)}function b(a,b){return C.c(Da,new cg(null,Wf(a),0),b)}a.k=1;a.f=function(a){var d=F(a);a=G(a);return b(d,a)};a.d=b;return a}();
function hg(a){for(var b=qe;;)if(I(a))b=pc.a(b,F(a)),a=I(a);else return E(b)}function id(a){if(a&&(a.q&4096||a.fc))return a.name;if("string"===typeof a)return a;throw Error("Doesn't support name: "+A.b(a));}
var ig=function(){function a(a,b,c){return(a.b?a.b(b):a.call(null,b))>(a.b?a.b(c):a.call(null,c))?b:c}var b=null,c=function(){function a(b,d,k,l){var n=null;3<arguments.length&&(n=J(Array.prototype.slice.call(arguments,3),0));return c.call(this,b,d,k,n)}function c(a,d,e,l){return C.c(function(c,d){return b.c(a,c,d)},b.c(a,d,e),l)}a.k=3;a.f=function(a){var b=F(a);a=I(a);var d=F(a);a=I(a);var l=F(a);a=G(a);return c(b,d,l,a)};a.d=c;return a}(),b=function(b,e,f,h){switch(arguments.length){case 2:return e;
case 3:return a.call(this,b,e,f);default:return c.d(b,e,f,J(arguments,3))}throw Error("Invalid arity: "+arguments.length);};b.k=3;b.f=c.f;b.a=function(a,b){return b};b.c=a;b.d=c.d;return b}(),jg=function(){function a(a,b,f){return new V(null,function(){var h=E(f);return h?M(Md(a,h),c.c(a,b,Nd(b,h))):null},null,null)}function b(a,b){return c.c(a,a,b)}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);
};c.a=b;c.c=a;return c}(),lg=function kg(b,c){return new V(null,function(){var d=E(c);return d?r(b.b?b.b(F(d)):b.call(null,F(d)))?M(F(d),kg(b,G(d))):null:null},null,null)};function mg(a,b,c){return function(d){var e=tb(a);return b.a?b.a(e.a?e.a(sb(a,d),c):e.call(null,sb(a,d),c),0):b.call(null,e.a?e.a(sb(a,d),c):e.call(null,sb(a,d),c),0)}}
var ng=function(){function a(a,b,c,h,k){var l=rb(a,c,!0);if(r(l)){var n=P.c(l,0,null);return lg(mg(a,h,k),r(mg(a,b,c).call(null,n))?l:I(l))}return null}function b(a,b,c){var h=mg(a,b,c),k;a:{k=[Uc,Vc];var l=k.length;if(l<=Ze)for(var n=0,q=yb(Ye);;)if(n<l)var t=n+1,q=Bb(q,k[n],null),n=t;else{k=new $f(null,Ab(q),null);break a}else for(n=0,q=yb(bg);;)if(n<l)t=n+1,q=zb(q,k[n]),n=t;else{k=Ab(q);break a}k=void 0}return r(k.call(null,b))?(a=rb(a,c,!0),r(a)?(b=P.c(a,0,null),r(h.b?h.b(b):h.call(null,b))?a:
I(a)):null):lg(h,qb(a,!0))}var c=null,c=function(c,e,f,h,k){switch(arguments.length){case 3:return b.call(this,c,e,f);case 5:return a.call(this,c,e,f,h,k)}throw Error("Invalid arity: "+arguments.length);};c.c=b;c.s=a;return c}();function og(a,b,c,d,e){this.j=a;this.start=b;this.end=c;this.step=d;this.m=e;this.i=32375006;this.q=8192}g=og.prototype;g.toString=function(){return Lb(this)};
g.J=function(a,b){if(b<Aa(this))return this.start+b*this.step;if(this.start>this.end&&0===this.step)return this.start;throw Error("Index out of bounds");};g.aa=function(a,b,c){return b<Aa(this)?this.start+b*this.step:this.start>this.end&&0===this.step?this.start:c};g.D=function(){return this.j};
g.U=function(){return 0<this.step?this.start+this.step<this.end?new og(this.j,this.start+this.step,this.end,this.step,null):null:this.start+this.step>this.end?new og(this.j,this.start+this.step,this.end,this.step,null):null};g.L=function(){return sa(lb(this))?0:Math.ceil((this.end-this.start)/this.step)};g.B=function(){var a=this.m;return null!=a?a:this.m=a=cc(this)};g.v=function(a,b){return lc(this,b)};g.I=function(){return N(H,this.j)};g.N=function(a,b){return gc.a(this,b)};
g.M=function(a,b,c){return gc.c(this,b,c)};g.Q=function(){return null==lb(this)?null:this.start};g.S=function(){return null!=lb(this)?new og(this.j,this.start+this.step,this.end,this.step,null):H};g.H=function(){return 0<this.step?this.start<this.end?this:null:this.start>this.end?this:null};g.F=function(a,b){return new og(b,this.start,this.end,this.step,this.m)};g.G=function(a,b){return M(b,this)};
var pg=function(){function a(a,b,c){return new og(null,a,b,c,null)}function b(a,b){return e.c(a,b,1)}function c(a){return e.c(0,a,1)}function d(){return e.c(0,Number.MAX_VALUE,1)}var e=null,e=function(e,h,k){switch(arguments.length){case 0:return d.call(this);case 1:return c.call(this,e);case 2:return b.call(this,e,h);case 3:return a.call(this,e,h,k)}throw Error("Invalid arity: "+arguments.length);};e.o=d;e.b=c;e.a=b;e.c=a;return e}(),qg=function(){function a(a,b){for(;;)if(E(b)&&0<a){var c=a-1,h=
I(b);a=c;b=h}else return null}function b(a){for(;;)if(E(a))a=I(a);else return null}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),rg=function(){function a(a,b){qg.a(a,b);return b}function b(a){qg.b(a);return a}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);
};c.b=b;c.a=a;return c}();function sg(a,b){if("string"===typeof b){var c=a.exec(b);return Wb.a(F(c),b)?1===O(c)?F(c):we(c):null}throw new TypeError("re-matches must match against a string.");}function tg(a){var b;b=/^(?:\(\?([idmsux]*)\))?(.*)/;if("string"===typeof a)a=b.exec(a),b=null==a?null:1===O(a)?F(a):we(a);else throw new TypeError("re-find must match against a string.");P.c(b,0,null);a=P.c(b,1,null);b=P.c(b,2,null);return new RegExp(b,a)}
function ug(a,b,c,d,e,f,h){var k=ja;try{ja=null==ja?null:ja-1;if(null!=ja&&0>ja)return ub(a,"#");ub(a,c);E(h)&&(b.c?b.c(F(h),a,f):b.call(null,F(h),a,f));for(var l=I(h),n=ra.b(f)-1;;)if(!l||null!=n&&0===n){E(l)&&0===n&&(ub(a,d),ub(a,"..."));break}else{ub(a,d);b.c?b.c(F(l),a,f):b.call(null,F(l),a,f);var q=I(l);c=n-1;l=q;n=c}return ub(a,e)}finally{ja=k}}
var vg=function(){function a(a,d){var e=null;1<arguments.length&&(e=J(Array.prototype.slice.call(arguments,1),0));return b.call(this,a,e)}function b(a,b){for(var e=E(b),f=null,h=0,k=0;;)if(k<h){var l=f.J(null,k);ub(a,l);k+=1}else if(e=E(e))f=e,Ic(f)?(e=Hb(f),h=Ib(f),f=e,l=O(e),e=h,h=l):(l=F(f),ub(a,l),e=I(f),f=null,h=0),k=0;else return null}a.k=1;a.f=function(a){var d=F(a);a=G(a);return b(d,a)};a.d=b;return a}(),wg={'"':'\\"',"\\":"\\\\","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t"};
function xg(a){return'"'+A.b(a.replace(RegExp('[\\\\"\b\f\n\r\t]',"g"),function(a){return wg[a]}))+'"'}
var Ag=function yg(b,c,d){if(null==b)return ub(c,"nil");if(void 0===b)return ub(c,"#\x3cundefined\x3e");if(u){r(function(){var c=Q.a(d,pa);return r(c)?(c=b?b.i&131072||b.ec?!0:b.i?!1:s(bb,b):s(bb,b))?xc(b):c:c}())&&(ub(c,"^"),yg(xc(b),c,d),ub(c," "));if(null==b)return ub(c,"nil");if(b.Db)return b.Tb(b,c,d);if(b&&(b.i&2147483648||b.K))return b.w(null,c,d);if(ta(b)===Boolean||"number"===typeof b)return ub(c,""+A.b(b));if(null!=b&&b.constructor===Object)return ub(c,"#js "),zg.n?zg.n(Kd.a(function(c){return new W(null,
2,5,X,[jd.b(c),b[c]],null)},Jc(b)),yg,c,d):zg.call(null,Kd.a(function(c){return new W(null,2,5,X,[jd.b(c),b[c]],null)},Jc(b)),yg,c,d);if(b instanceof Array)return ug(c,yg,"#js ["," ","]",d,b);if("string"==typeof b)return r(oa.b(d))?ub(c,xg(b)):ub(c,b);if(uc(b))return vg.d(c,J(["#\x3c",""+A.b(b),"\x3e"],0));if(b instanceof Date){var e=function(b,c){for(var d=""+A.b(b);;)if(O(d)<c)d="0"+A.b(d);else return d};return vg.d(c,J(['#inst "',""+A.b(b.getUTCFullYear()),"-",e(b.getUTCMonth()+1,2),"-",e(b.getUTCDate(),
2),"T",e(b.getUTCHours(),2),":",e(b.getUTCMinutes(),2),":",e(b.getUTCSeconds(),2),".",e(b.getUTCMilliseconds(),3),"-",'00:00"'],0))}return b instanceof RegExp?vg.d(c,J(['#"',b.source,'"'],0)):(b?b.i&2147483648||b.K||(b.i?0:s(vb,b)):s(vb,b))?wb(b,c,d):u?vg.d(c,J(["#\x3c",""+A.b(b),"\x3e"],0)):null}return null};
function Bg(a,b){var c=new ea;a:{var d=new Kb(c);Ag(F(a),d,b);for(var e=E(I(a)),f=null,h=0,k=0;;)if(k<h){var l=f.J(null,k);ub(d," ");Ag(l,d,b);k+=1}else if(e=E(e))f=e,Ic(f)?(e=Hb(f),h=Ib(f),f=e,l=O(e),e=h,h=l):(l=F(f),ub(d," "),Ag(l,d,b),e=I(f),f=null,h=0),k=0;else break a}return c}
var Cg=function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){var b=ka();return Bc(a)?"":""+A.b(Bg(a,b))}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}();function zg(a,b,c,d){return ug(c,function(a,c,d){b.c?b.c(Ta(a),c,d):b.call(null,Ta(a),c,d);ub(c," ");return b.c?b.c(Ua(a),c,d):b.call(null,Ua(a),c,d)},"{",", ","}",d,E(a))}ac.prototype.K=!0;
ac.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};V.prototype.K=!0;V.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};Bf.prototype.K=!0;Bf.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};vf.prototype.K=!0;vf.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};$.prototype.K=!0;$.prototype.w=function(a,b,c){return ug(b,Ag,"["," ","]",c,this)};Ue.prototype.K=!0;Ue.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};
cg.prototype.K=!0;cg.prototype.w=function(a,b,c){return ug(b,Ag,"#{"," ","}",c,this)};ye.prototype.K=!0;ye.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};gd.prototype.K=!0;gd.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};kc.prototype.K=!0;kc.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};xf.prototype.K=!0;xf.prototype.w=function(a,b,c){return zg(this,Ag,b,c)};wf.prototype.K=!0;wf.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};
Ae.prototype.K=!0;Ae.prototype.w=function(a,b,c){return ug(b,Ag,"["," ","]",c,this)};Qf.prototype.K=!0;Qf.prototype.w=function(a,b,c){return zg(this,Ag,b,c)};$f.prototype.K=!0;$f.prototype.w=function(a,b,c){return ug(b,Ag,"#{"," ","}",c,this)};od.prototype.K=!0;od.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};Yf.prototype.K=!0;Yf.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};Y.prototype.K=!0;Y.prototype.w=function(a,b,c){return ug(b,Ag,"["," ","]",c,this)};
W.prototype.K=!0;W.prototype.w=function(a,b,c){return ug(b,Ag,"["," ","]",c,this)};He.prototype.K=!0;He.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};cd.prototype.K=!0;cd.prototype.w=function(a,b){return ub(b,"()")};Ie.prototype.K=!0;Ie.prototype.w=function(a,b,c){return ug(b,Ag,"#queue ["," ","]",c,E(this))};la.prototype.K=!0;la.prototype.w=function(a,b,c){return zg(this,Ag,b,c)};og.prototype.K=!0;og.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};
Xf.prototype.K=!0;Xf.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};bd.prototype.K=!0;bd.prototype.w=function(a,b,c){return ug(b,Ag,"("," ",")",c,this)};W.prototype.lb=!0;W.prototype.mb=function(a,b){return Pc.a(this,b)};Ae.prototype.lb=!0;Ae.prototype.mb=function(a,b){return Pc.a(this,b)};T.prototype.lb=!0;T.prototype.mb=function(a,b){return Vb(this,b)};Zb.prototype.lb=!0;Zb.prototype.mb=function(a,b){return Vb(this,b)};
function Dg(a,b){if(a?a.gc:a)return a.gc(a,b);var c;c=Dg[m(null==a?null:a)];if(!c&&(c=Dg._,!c))throw x("IReset.-reset!",a);return c.call(null,a,b)}
var Eg=function(){function a(a,b,c,d,e){if(a?a.nc:a)return a.nc(a,b,c,d,e);var q;q=Eg[m(null==a?null:a)];if(!q&&(q=Eg._,!q))throw x("ISwap.-swap!",a);return q.call(null,a,b,c,d,e)}function b(a,b,c,d){if(a?a.mc:a)return a.mc(a,b,c,d);var e;e=Eg[m(null==a?null:a)];if(!e&&(e=Eg._,!e))throw x("ISwap.-swap!",a);return e.call(null,a,b,c,d)}function c(a,b,c){if(a?a.lc:a)return a.lc(a,b,c);var d;d=Eg[m(null==a?null:a)];if(!d&&(d=Eg._,!d))throw x("ISwap.-swap!",a);return d.call(null,a,b,c)}function d(a,b){if(a?
a.kc:a)return a.kc(a,b);var c;c=Eg[m(null==a?null:a)];if(!c&&(c=Eg._,!c))throw x("ISwap.-swap!",a);return c.call(null,a,b)}var e=null,e=function(e,h,k,l,n){switch(arguments.length){case 2:return d.call(this,e,h);case 3:return c.call(this,e,h,k);case 4:return b.call(this,e,h,k,l);case 5:return a.call(this,e,h,k,l,n)}throw Error("Invalid arity: "+arguments.length);};e.a=d;e.c=c;e.n=b;e.s=a;return e}();function Fg(a,b,c,d){this.state=a;this.j=b;this.wc=c;this.Wb=d;this.i=2153938944;this.q=16386}g=Fg.prototype;
g.B=function(){return this[ba]||(this[ba]=++ca)};g.Rb=function(a,b,c){a=E(this.Wb);for(var d=null,e=0,f=0;;)if(f<e){var h=d.J(null,f),k=P.c(h,0,null),h=P.c(h,1,null);h.n?h.n(k,this,b,c):h.call(null,k,this,b,c);f+=1}else if(a=E(a))Ic(a)?(d=Hb(a),a=Ib(a),k=d,e=O(d),d=k):(d=F(a),k=P.c(d,0,null),h=P.c(d,1,null),h.n?h.n(k,this,b,c):h.call(null,k,this,b,c),a=I(a),d=null,e=0),f=0;else return null};g.w=function(a,b,c){ub(b,"#\x3cAtom: ");Ag(this.state,b,c);return ub(b,"\x3e")};g.D=function(){return this.j};
g.ub=function(){return this.state};g.v=function(a,b){return this===b};
var Hg=function(){function a(a){return new Fg(a,null,null,null)}var b=null,c=function(){function a(c,d){var k=null;1<arguments.length&&(k=J(Array.prototype.slice.call(arguments,1),0));return b.call(this,c,k)}function b(a,c){var d=Mc(c)?S.a(Tf,c):c,e=Q.a(d,Gg),d=Q.a(d,pa);return new Fg(a,d,e,null)}a.k=1;a.f=function(a){var c=F(a);a=G(a);return b(c,a)};a.d=b;return a}(),b=function(b,e){switch(arguments.length){case 1:return a.call(this,b);default:return c.d(b,J(arguments,1))}throw Error("Invalid arity: "+
arguments.length);};b.k=1;b.f=c.f;b.b=a;b.d=c.d;return b}();function Ig(a,b){if(a instanceof Fg){var c=a.wc;if(null!=c&&!r(c.b?c.b(b):c.call(null,b)))throw Error("Assert failed: Validator rejected reference state\n"+A.b(Cg.d(J([fd(new Zb(null,"validate","validate",1439230700,null),new Zb(null,"new-value","new-value",-1567397401,null))],0))));c=a.state;a.state=b;null!=a.Wb&&xb(a,c,b);return b}return Dg(a,b)}function K(a){return ab(a)}
var Jg=function(){function a(a,b,c,d){return a instanceof Fg?Ig(a,b.c?b.c(a.state,c,d):b.call(null,a.state,c,d)):Eg.n(a,b,c,d)}function b(a,b,c){return a instanceof Fg?Ig(a,b.a?b.a(a.state,c):b.call(null,a.state,c)):Eg.c(a,b,c)}function c(a,b){return a instanceof Fg?Ig(a,b.b?b.b(a.state):b.call(null,a.state)):Eg.a(a,b)}var d=null,e=function(){function a(c,d,e,f,t){var v=null;4<arguments.length&&(v=J(Array.prototype.slice.call(arguments,4),0));return b.call(this,c,d,e,f,v)}function b(a,c,d,e,f){return a instanceof
Fg?Ig(a,S.s(c,a.state,d,e,f)):Eg.s(a,c,d,e,f)}a.k=4;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=I(a);var e=F(a);a=I(a);var f=F(a);a=G(a);return b(c,d,e,f,a)};a.d=b;return a}(),d=function(d,h,k,l,n){switch(arguments.length){case 2:return c.call(this,d,h);case 3:return b.call(this,d,h,k);case 4:return a.call(this,d,h,k,l);default:return e.d(d,h,k,l,J(arguments,4))}throw Error("Invalid arity: "+arguments.length);};d.k=4;d.f=e.f;d.a=c;d.c=b;d.n=a;d.d=e.d;return d}(),Kg={};
function Lg(a){if(a?a.ac:a)return a.ac(a);var b;b=Lg[m(null==a?null:a)];if(!b&&(b=Lg._,!b))throw x("IEncodeJS.-clj-\x3ejs",a);return b.call(null,a)}function Mg(a){return(a?r(r(null)?null:a.$b)||(a.Cb?0:s(Kg,a)):s(Kg,a))?Lg(a):"string"===typeof a||"number"===typeof a||a instanceof T||a instanceof Zb?Ng.b?Ng.b(a):Ng.call(null,a):Cg.d(J([a],0))}
var Ng=function Og(b){if(null==b)return null;if(b?r(r(null)?null:b.$b)||(b.Cb?0:s(Kg,b)):s(Kg,b))return Lg(b);if(b instanceof T)return id(b);if(b instanceof Zb)return""+A.b(b);if(Gc(b)){var c={};b=E(b);for(var d=null,e=0,f=0;;)if(f<e){var h=d.J(null,f),k=P.c(h,0,null),h=P.c(h,1,null);c[Mg(k)]=Og(h);f+=1}else if(b=E(b))Ic(b)?(e=Hb(b),b=Ib(b),d=e,e=O(e)):(e=F(b),d=P.c(e,0,null),e=P.c(e,1,null),c[Mg(d)]=Og(e),b=I(b),d=null,e=0),f=0;else break;return c}if(Cc(b)){c=[];b=E(Kd.a(Og,b));d=null;for(f=e=0;;)if(f<
e)k=d.J(null,f),c.push(k),f+=1;else if(b=E(b))d=b,Ic(d)?(b=Hb(d),f=Ib(d),d=b,e=O(b),b=f):(b=F(d),c.push(b),b=I(d),d=null,e=0),f=0;else break;return c}return u?b:null},Pg={};function Qg(a,b){if(a?a.Zb:a)return a.Zb(a,b);var c;c=Qg[m(null==a?null:a)];if(!c&&(c=Qg._,!c))throw x("IEncodeClojure.-js-\x3eclj",a);return c.call(null,a,b)}
var Sg=function(){function a(a){return b.d(a,J([new la(null,1,[Rg,!1],null)],0))}var b=null,c=function(){function a(c,d){var k=null;1<arguments.length&&(k=J(Array.prototype.slice.call(arguments,1),0));return b.call(this,c,k)}function b(a,c){if(a?r(r(null)?null:a.Cc)||(a.Cb?0:s(Pg,a)):s(Pg,a))return Qg(a,S.a(Uf,c));if(E(c)){var d=Mc(c)?S.a(Tf,c):c,e=Q.a(d,Rg);return function(a,b,c,d){return function y(e){return Mc(e)?rg.b(Kd.a(y,e)):Cc(e)?Yd(qc(e),Kd.a(y,e)):e instanceof Array?we(Kd.a(y,e)):ta(e)===
Object?Yd(Ye,function(){return function(a,b,c,d){return function Ra(f){return new V(null,function(a,b,c,d){return function(){for(;;){var a=E(f);if(a){if(Ic(a)){var b=Hb(a),c=O(b),h=new ld(Array(c),0);a:{for(var k=0;;)if(k<c){var l=D.a(b,k),l=new W(null,2,5,X,[d.b?d.b(l):d.call(null,l),y(e[l])],null);h.add(l);k+=1}else{b=!0;break a}b=void 0}return b?pd(h.da(),Ra(Ib(a))):pd(h.da(),null)}h=F(a);return M(new W(null,2,5,X,[d.b?d.b(h):d.call(null,h),y(e[h])],null),Ra(G(a)))}return null}}}(a,b,c,d),null,
null)}}(a,b,c,d)(Jc(e))}()):u?e:null}}(c,d,e,r(e)?jd:A)(a)}return null}a.k=1;a.f=function(a){var c=F(a);a=G(a);return b(c,a)};a.d=b;return a}(),b=function(b,e){switch(arguments.length){case 1:return a.call(this,b);default:return c.d(b,J(arguments,1))}throw Error("Invalid arity: "+arguments.length);};b.k=1;b.f=c.f;b.b=a;b.d=c.d;return b}();function Tg(a){this.pb=a;this.q=0;this.i=2153775104}
Tg.prototype.B=function(){for(var a=Cg.d(J([this],0)),b=0,c=0;c<a.length;++c)b=31*b+a.charCodeAt(c),b%=4294967296;return b};Tg.prototype.w=function(a,b){return ub(b,'#uuid "'+A.b(this.pb)+'"')};Tg.prototype.v=function(a,b){return b instanceof Tg&&this.pb===b.pb};Tg.prototype.toString=function(){return this.pb};var Ug=new T(null,"ppath","ppath"),Vg=new T("zip","branch?","zip/branch?"),Wg=new T(null,"r","r"),Xg=new T("zip","children","zip/children"),pa=new T(null,"meta","meta"),qa=new T(null,"dup","dup"),u=new T(null,"else","else"),Gg=new T(null,"validator","validator"),Yb=new T(null,"default","default"),Yg=new T(null,"sequential","sequential"),ma=new T(null,"flush-on-newline","flush-on-newline"),Zg=new T(null,"l","l"),$g=new T("zip","make-node","zip/make-node"),oa=new T(null,"readably","readably"),ra=new T(null,
"print-length","print-length"),ah=new T(null,"pnodes","pnodes"),bh=new T(null,"changed?","changed?"),ch=new T(null,"tag","tag"),dh=new T(null,"set","set"),eh=new T(null,"end","end"),fh=new T(null,"atom","atom"),Rg=new T(null,"keywordize-keys","keywordize-keys"),gh=new T(null,"map","map"),hh=new T("mori","not-found","mori/not-found"),ih=new T("cljs.core","not-found","cljs.core/not-found");var jh,kh;function lh(a){return a.o?a.o():a.call(null)}function mh(a){return a.o?a.o():a.call(null)}var nh=function(){function a(a,b,c){return Gc(c)?hb(c,a,b):null==c?b:c instanceof Array?hc.c(c,a,b):u?gb.c(c,a,b):null}function b(a,b){return c.c(a,a.o?a.o():a.call(null),b)}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}();
function oh(a,b,c,d){if(a?a.Eb:a)return a.Eb(a,b,c,d);var e;e=oh[m(null==a?null:a)];if(!e&&(e=oh._,!e))throw x("CollFold.coll-fold",a);return e.call(null,a,b,c,d)}
var qh=function ph(b,c){"undefined"===typeof jh&&(jh=function(b,c,f,h){this.$=b;this.Qa=c;this.uc=f;this.sc=h;this.q=0;this.i=917504},jh.Db=!0,jh.Bb="clojure.core.reducers/t6322",jh.Tb=function(b,c){return ub(c,"clojure.core.reducers/t6322")},jh.prototype.N=function(b,c){return gb.c(this,c,c.o?c.o():c.call(null))},jh.prototype.M=function(b,c,f){return gb.c(this.Qa,this.$.b?this.$.b(c):this.$.call(null,c),f)},jh.prototype.D=function(){return this.sc},jh.prototype.F=function(b,c){return new jh(this.$,
this.Qa,this.uc,c)});return new jh(c,b,ph,null)},sh=function rh(b,c){"undefined"===typeof kh&&(kh=function(b,c,f,h){this.$=b;this.Qa=c;this.rc=f;this.tc=h;this.q=0;this.i=917504},kh.Db=!0,kh.Bb="clojure.core.reducers/t6328",kh.Tb=function(b,c){return ub(c,"clojure.core.reducers/t6328")},kh.prototype.Eb=function(b,c,f,h){return oh(this.Qa,c,f,this.$.b?this.$.b(h):this.$.call(null,h))},kh.prototype.N=function(b,c){return gb.c(this.Qa,this.$.b?this.$.b(c):this.$.call(null,c),c.o?c.o():c.call(null))},
kh.prototype.M=function(b,c,f){return gb.c(this.Qa,this.$.b?this.$.b(c):this.$.call(null,c),f)},kh.prototype.D=function(){return this.tc},kh.prototype.F=function(b,c){return new kh(this.$,this.Qa,this.rc,c)});return new kh(c,b,rh,null)},th=function(){function a(a,b){return sh(b,function(b){return function(){var c=null;return c=function(c,e,h){switch(arguments.length){case 0:return b.o?b.o():b.call(null);case 2:return b.a?b.a(c,a.b?a.b(e):a.call(null,e)):b.call(null,c,a.b?a.b(e):a.call(null,e));case 3:return b.a?
b.a(c,a.a?a.a(e,h):a.call(null,e,h)):b.call(null,c,a.a?a.a(e,h):a.call(null,e,h))}throw Error("Invalid arity: "+arguments.length);}}()})}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),uh=function(){function a(a,b){return sh(b,function(b){return function(){var c=null;return c=function(c,e,h){switch(arguments.length){case 0:return b.o?
b.o():b.call(null);case 2:return r(a.b?a.b(e):a.call(null,e))?b.a?b.a(c,e):b.call(null,c,e):c;case 3:return r(a.a?a.a(e,h):a.call(null,e,h))?b.c?b.c(c,e,h):b.call(null,c,e,h):c}throw Error("Invalid arity: "+arguments.length);}}()})}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),vh=function(){function a(a){return sh(a,
function(a){return function(){var b=null;return b=function(b,d){switch(arguments.length){case 0:return a.o?a.o():a.call(null);case 2:return Fc(d)?c.b(d).M(null,a,b):a.a?a.a(b,d):a.call(null,b,d)}throw Error("Invalid arity: "+arguments.length);}}()})}function b(){return function(a){return c.b(a)}}var c=null,c=function(c){switch(arguments.length){case 0:return b.call(this);case 1:return a.call(this,c)}throw Error("Invalid arity: "+arguments.length);};c.o=b;c.b=a;return c}(),wh=function(){function a(a,
b){return uh.a(Gd(a),b)}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),xh=function(){function a(a,b){return qh(b,function(b){return function(){var c=null;return c=function(c,e,h){switch(arguments.length){case 0:return b.o?b.o():b.call(null);case 2:return r(a.b?a.b(e):a.call(null,e))?b.a?b.a(c,e):b.call(null,c,e):
new ec(c);case 3:return r(a.a?a.a(e,h):a.call(null,e,h))?b.c?b.c(c,e,h):b.call(null,c,e,h):new ec(c)}throw Error("Invalid arity: "+arguments.length);}}()})}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),yh=function(){function a(a,b){return qh(b,function(b){return function(a){return function(){var c=null;return c=
function(c,d,e){switch(arguments.length){case 0:return b.o?b.o():b.call(null);case 2:return Jg.a(a,Wc),0>ab(a)?new ec(c):b.a?b.a(c,d):b.call(null,c,d);case 3:return Jg.a(a,Wc),0>ab(a)?new ec(c):b.c?b.c(c,d,e):b.call(null,c,d,e)}throw Error("Invalid arity: "+arguments.length);}}()}(Hg.b(a))})}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);
};c.b=b;c.a=a;return c}(),zh=function(){function a(a,b){return qh(b,function(b){return function(a){return function(){var c=null;return c=function(c,d,e){switch(arguments.length){case 0:return b.o?b.o():b.call(null);case 2:return Jg.a(a,Wc),0>ab(a)?b.a?b.a(c,d):b.call(null,c,d):c;case 3:return Jg.a(a,Wc),0>ab(a)?b.c?b.c(c,d,e):b.call(null,c,d,e):c}throw Error("Invalid arity: "+arguments.length);}}()}(Hg.b(a))})}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,
c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),Bh=function Ah(b,c,d,e){if(Bc(b))return d.o?d.o():d.call(null);if(O(b)<=c)return nh.c(e,d.o?d.o():d.call(null),b);if(u){var f=Yc(O(b)),h=ze.c(b,0,f);b=ze.c(b,f,O(b));return lh(function(b,c,e,f){return function(){var b=f(c),h;h=f(e);return d.a?d.a(b.o?b.o():b.call(null),mh(h)):d.call(null,b.o?b.o():b.call(null),mh(h))}}(f,h,b,function(b,f,h){return function(q){return function(){return function(){return Ah(q,
c,d,e)}}(b,f,h)}}(f,h,b)))}return null};W.prototype.Eb=function(a,b,c,d){return Bh(this,b,c,d)};oh.object=function(a,b,c,d){return nh.c(d,c.o?c.o():c.call(null),a)};oh["null"]=function(a,b,c){return c.o?c.o():c.call(null)};function Ch(a,b){var c=S.c(ig,a,b);return M(c,Vd(function(a){return function(b){return a===b}}(c),b))}
var Dh=function(){function a(a,b){return O(a)<O(b)?C.c(pc,b,a):C.c(pc,a,b)}var b=null,c=function(){function a(c,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,d,l)}function b(a,c,d){a=Ch(O,pc.d(d,c,J([a],0)));return C.c(Yd,F(a),G(a))}a.k=2;a.f=function(a){var c=F(a);a=I(a);var d=F(a);a=G(a);return b(c,d,a)};a.d=b;return a}(),b=function(b,e,f){switch(arguments.length){case 0:return bg;case 1:return b;case 2:return a.call(this,b,e);default:return c.d(b,
e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.k=2;b.f=c.f;b.o=function(){return bg};b.b=function(a){return a};b.a=a;b.d=c.d;return b}(),Eh=function(){function a(a,b){for(;;)if(O(b)<O(a)){var c=a;a=b;b=c}else return C.c(function(a,b){return function(a,c){return Oc(b,c)?a:Ac.a(a,c)}}(a,b),a,a)}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){a=Ch(function(a){return-O(a)},
pc.d(e,d,J([a],0)));return C.c(b,F(a),G(a))}a.k=2;a.f=function(a){var b=F(a);a=I(a);var d=F(a);a=G(a);return c(b,d,a)};a.d=c;return a}(),b=function(b,e,f){switch(arguments.length){case 1:return b;case 2:return a.call(this,b,e);default:return c.d(b,e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.k=2;b.f=c.f;b.b=function(a){return a};b.a=a;b.d=c.d;return b}(),Fh=function(){function a(a,b){return O(a)<O(b)?C.c(function(a,c){return Oc(b,c)?Ac.a(a,c):a},a,a):C.c(Ac,a,b)}var b=null,
c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=J(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){return C.c(b,a,pc.a(e,d))}a.k=2;a.f=function(a){var b=F(a);a=I(a);var d=F(a);a=G(a);return c(b,d,a)};a.d=c;return a}(),b=function(b,e,f){switch(arguments.length){case 1:return b;case 2:return a.call(this,b,e);default:return c.d(b,e,J(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.k=2;b.f=c.f;b.b=function(a){return a};b.a=a;b.d=
c.d;return b}();function Gh(a,b){return Wb.a(a,b)?new W(null,3,5,X,[null,null,a],null):new W(null,3,5,X,[a,b,null],null)}function Hh(a){return E(a)?C.c(function(a,c){var d=P.c(c,0,null),e=P.c(c,1,null);return R.c(a,d,e)},we(Od.a(S.a(Xc,Ve(a)),null)),a):null}
function Ih(a,b,c){var d=Q.a(a,c),e=Q.a(b,c),f=Jh.a?Jh.a(d,e):Jh.call(null,d,e),h=P.c(f,0,null),k=P.c(f,1,null),f=P.c(f,2,null);a=Oc(a,c);b=Oc(b,c);d=a&&b&&(null!=f||null==d&&null==e);return new W(null,3,5,X,[!a||null==h&&d?null:new af([c,h]),!b||null==k&&d?null:new af([c,k]),d?new af([c,f]):null],null)}
var Kh=function(){function a(a,b,c){return C.c(function(a,b){return rg.b(Kd.c(Zf,a,b))},new W(null,3,5,X,[null,null,null],null),Kd.a(Id.c(Ih,a,b),c))}function b(a,b){return c.c(a,b,Dh.a(Ve(a),Ve(b)))}var c=null,c=function(c,e,f){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,f)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}();
function Lh(a,b){return we(Kd.a(Hh,Kh.c(Hc(a)?a:we(a),Hc(b)?b:we(b),pg.b(function(){var c=O(a),d=O(b);return c>d?c:d}()))))}function Mh(a,b){return new W(null,3,5,X,[Cd(Fh.a(a,b)),Cd(Fh.a(b,a)),Cd(Eh.a(a,b))],null)}function Nh(a){if(a?a.qc:a)return a.qc(a);var b;b=Nh[m(null==a?null:a)];if(!b&&(b=Nh._,!b))throw x("EqualityPartition.equality-partition",a);return b.call(null,a)}
function Oh(a,b){if(a?a.pc:a)return a.pc(a,b);var c;c=Oh[m(null==a?null:a)];if(!c&&(c=Oh._,!c))throw x("Diff.diff-similar",a);return c.call(null,a,b)}Nh._=function(a){return(a?a.i&1024||a.cc||(a.i?0:s(Pa,a)):s(Pa,a))?gh:(a?a.i&4096||a.jc||(a.i?0:s(Va,a)):s(Va,a))?dh:(a?a.i&16777216||a.ic||(a.i?0:s(mb,a)):s(mb,a))?Yg:Yb?fh:null};Nh["boolean"]=function(){return fh};Nh["function"]=function(){return fh};Nh.array=function(){return Yg};Nh.number=function(){return fh};Nh.string=function(){return fh};
Nh["null"]=function(){return fh};Oh._=function(a,b){return function(){switch(Nh(a)instanceof T?Nh(a).sa:null){case "map":return Kh;case "sequential":return Lh;case "set":return Mh;case "atom":return Gh;default:throw Error("No matching clause: "+A.b(Nh(a)));}}().call(null,a,b)};Oh["boolean"]=function(a,b){return Gh(a,b)};Oh["function"]=function(a,b){return Gh(a,b)};Oh.array=function(a,b){return Lh(a,b)};Oh.number=function(a,b){return Gh(a,b)};Oh.string=function(a,b){return Gh(a,b)};
Oh["null"]=function(a,b){return Gh(a,b)};function Jh(a,b){return Wb.a(a,b)?new W(null,3,5,X,[null,null,a],null):Wb.a(Nh(a),Nh(b))?Oh(a,b):Gh(a,b)};function Ph(a){if(a?a.Ub:a)return a.Ub();var b;b=Ph[m(null==a?null:a)];if(!b&&(b=Ph._,!b))throw x("PushbackReader.read-char",a);return b.call(null,a)}function Qh(a,b){if(a?a.Vb:a)return a.Vb(0,b);var c;c=Qh[m(null==a?null:a)];if(!c&&(c=Qh._,!c))throw x("PushbackReader.unread",a);return c.call(null,a,b)}function Rh(a,b,c){this.r=a;this.buffer=b;this.Fb=c}Rh.prototype.Ub=function(){return 0===this.buffer.length?(this.Fb+=1,this.r[this.Fb]):this.buffer.pop()};Rh.prototype.Vb=function(a,b){return this.buffer.push(b)};
function Sh(a){var b=!/[^\t\n\r ]/.test(a);return r(b)?b:","===a}var Th=function(){function a(a,d){var e=null;1<arguments.length&&(e=J(Array.prototype.slice.call(arguments,1),0));return b.call(this,0,e)}function b(a,b){throw Error(S.a(A,b));}a.k=1;a.f=function(a){F(a);a=G(a);return b(0,a)};a.d=b;return a}();
function Uh(a,b){for(var c=new ea(b),d=Ph(a);;){var e;if(!(e=null==d||Sh(d))){e=d;var f="#"!==e;e=f?(f="'"!==e)?(f=":"!==e)?Vh.b?Vh.b(e):Vh.call(null,e):f:f:f}if(e)return Qh(a,d),c.toString();c.append(d);d=Ph(a)}}function Wh(a){for(;;){var b=Ph(a);if("\n"===b||"\r"===b||null==b)return a}}var Xh=tg("^([-+]?)(?:(0)|([1-9][0-9]*)|0[xX]([0-9A-Fa-f]+)|0([0-7]+)|([1-9][0-9]?)[rR]([0-9A-Za-z]+))(N)?$"),Yh=tg("^([-+]?[0-9]+)/([0-9]+)$"),Zh=tg("^([-+]?[0-9]+(\\.[0-9]*)?([eE][-+]?[0-9]+)?)(M)?$"),$h=tg("^[:]?([^0-9/].*/)?([^0-9/][^/]*)$");
function ai(a,b){var c=a.exec(b);return null!=c&&c[0]===b?1===c.length?c[0]:c:null}var bi=tg("^[0-9A-Fa-f]{2}$"),ci=tg("^[0-9A-Fa-f]{4}$");function di(a,b,c,d){return r(sg(a,d))?d:Th.d(b,J(["Unexpected unicode escape \\",c,d],0))}function ei(a){return String.fromCharCode(parseInt(a,16))}
function fi(a){var b=Ph(a),c="t"===b?"\t":"r"===b?"\r":"n"===b?"\n":"\\"===b?"\\":'"'===b?'"':"b"===b?"\b":"f"===b?"\f":null;r(c)?a=c:"x"===b?(c=(new ea(Ph(a),Ph(a))).toString(),a=ei(di(bi,a,b,c))):"u"===b?(c=(new ea(Ph(a),Ph(a),Ph(a),Ph(a))).toString(),a=ei(di(ci,a,b,c))):a=/[^0-9]/.test(b)?u?Th.d(a,J(["Unexpected unicode escape \\",b],0)):null:String.fromCharCode(b);return a}
function gi(a,b){for(var c=yb(qe);;){var d;a:{d=Sh;for(var e=b,f=Ph(e);;)if(r(d.b?d.b(f):d.call(null,f)))f=Ph(e);else{d=f;break a}d=void 0}r(d)||Th.d(b,J(["EOF while reading"],0));if(a===d)return Ab(c);e=Vh.b?Vh.b(d):Vh.call(null,d);r(e)?d=e.a?e.a(b,d):e.call(null,b,d):(Qh(b,d),d=hi.n?hi.n(b,!0,null,!0):hi.call(null,b,!0,null));c=d===b?c:wd.a(c,d)}}function ii(a,b){return Th.d(a,J(["Reader for ",b," not implemented yet"],0))}
function ji(a,b){var c=Ph(a),d=ki.b?ki.b(c):ki.call(null,c);if(r(d))return d.a?d.a(a,b):d.call(null,a,b);d=li.a?li.a(a,c):li.call(null,a,c);return r(d)?d:Th.d(a,J(["No dispatch macro for ",c],0))}function mi(a,b){return Th.d(a,J(["Unmached delimiter ",b],0))}function ni(a){return S.a(fd,gi(")",a))}function oi(a){return gi("]",a)}
function pi(a){var b=gi("}",a),c=O(b);if("number"!==typeof c||isNaN(c)||Infinity===c||parseFloat(c)!==parseInt(c,10))throw Error("Argument must be an integer: "+A.b(c));0!==(c&1)&&Th.d(a,J(["Map literal must contain an even number of forms"],0));return S.a(Tf,b)}function qi(a){for(var b=new ea,c=Ph(a);;){if(null==c)return Th.d(a,J(["EOF while reading"],0));if("\\"===c)b.append(fi(a)),c=Ph(a);else{if('"'===c)return b.toString();if(Yb)b.append(c),c=Ph(a);else return null}}}
function ri(a){for(var b=new ea,c=Ph(a);;){if(null==c)return Th.d(a,J(["EOF while reading"],0));if("\\"===c){b.append(c);var d=Ph(a);if(null==d)return Th.d(a,J(["EOF while reading"],0));var e=function(){var a=b;a.append(d);return a}(),f=Ph(a),b=e,c=f}else{if('"'===c)return b.toString();if(u)e=function(){var a=b;a.append(c);return a}(),f=Ph(a),b=e,c=f;else return null}}}
function si(a,b){var c=Uh(a,b);if(r(-1!=c.indexOf("/")))c=$b.a(ad.c(c,0,c.indexOf("/")),ad.c(c,c.indexOf("/")+1,c.length));else var d=$b.b(c),c="nil"===c?null:"true"===c?!0:"false"===c?!1:u?d:null;return c}function ti(a){var b=Uh(a,Ph(a)),c=ai($h,b),b=c[0],d=c[1],c=c[2];return void 0!==d&&":/"===d.substring(d.length-2,d.length)||":"===c[c.length-1]||-1!==b.indexOf("::",1)?Th.d(a,J(["Invalid token: ",b],0)):null!=d&&0<d.length?jd.a(d.substring(0,d.indexOf("/")),c):jd.b(b)}
function ui(a){return function(b){return Da(Da(H,hi.n?hi.n(b,!0,null,!0):hi.call(null,b,!0,null)),a)}}function vi(){return function(a){return Th.d(a,J(["Unreadable form"],0))}}
function wi(a){var b;b=hi.n?hi.n(a,!0,null,!0):hi.call(null,a,!0,null);b=b instanceof Zb?new la(null,1,[ch,b],null):"string"===typeof b?new la(null,1,[ch,b],null):b instanceof T?new af([b,!0]):u?b:null;Gc(b)||Th.d(a,J(["Metadata must be Symbol,Keyword,String or Map"],0));var c=hi.n?hi.n(a,!0,null,!0):hi.call(null,a,!0,null);return(c?c.i&262144||c.oc||(c.i?0:s(db,c)):s(db,c))?N(c,Zf.d(J([xc(c),b],0))):Th.d(a,J(["Metadata can only be applied to IWithMetas"],0))}function xi(a){return eg(gi("}",a))}
function yi(a){return tg(ri(a))}function zi(a){hi.n?hi.n(a,!0,null,!0):hi.call(null,a,!0,null);return a}function Vh(a){return'"'===a?qi:":"===a?ti:";"===a?Wh:"'"===a?ui(new Zb(null,"quote","quote",1377916282,null)):"@"===a?ui(new Zb(null,"deref","deref",1494944732,null)):"^"===a?wi:"`"===a?ii:"~"===a?ii:"("===a?ni:")"===a?mi:"["===a?oi:"]"===a?mi:"{"===a?pi:"}"===a?mi:"\\"===a?Ph:"#"===a?ji:null}function ki(a){return"{"===a?xi:"\x3c"===a?vi():'"'===a?yi:"!"===a?Wh:"_"===a?zi:null}
function hi(a,b,c){for(;;){var d=Ph(a);if(null==d)return r(b)?Th.d(a,J(["EOF while reading"],0)):c;if(!Sh(d))if(";"===d)a=Wh.a?Wh.a(a,d):Wh.call(null,a);else if(u){var e=Vh(d);if(r(e))e=e.a?e.a(a,d):e.call(null,a,d);else{var e=a,f=void 0;!(f=!/[^0-9]/.test(d))&&(f=void 0,f="+"===d||"-"===d)&&(f=Ph(e),Qh(e,f),f=!/[^0-9]/.test(f));if(f)a:{e=a;d=new ea(d);for(f=Ph(e);;){var h;h=null==f;h||(h=(h=Sh(f))?h:Vh.b?Vh.b(f):Vh.call(null,f));if(r(h)){Qh(e,f);f=d=d.toString();h=void 0;if(r(ai(Xh,f)))if(f=ai(Xh,
f),null!=f[2])h=0;else{h=r(f[3])?[f[3],10]:r(f[4])?[f[4],16]:r(f[5])?[f[5],8]:r(f[6])?[f[7],parseInt(f[6],10)]:u?[null,null]:null;var k=h[0];null==k?h=null:(h=parseInt(k,h[1]),h="-"===f[1]?-h:h)}else h=void 0,r(ai(Yh,f))?(f=ai(Yh,f),h=parseInt(f[1],10)/parseInt(f[2],10)):h=r(ai(Zh,f))?parseFloat(f):null;f=h;e=r(f)?f:Th.d(e,J(["Invalid number format [",d,"]"],0));break a}d.append(f);f=Ph(e)}e=void 0}else e=u?si(a,d):null}if(e!==a)return e}else return null}}
function Ai(a){if(Wb.a(3,O(a)))return a;if(3<O(a))return ad.c(a,0,3);if(u)for(a=new ea(a);;)if(3>a.Va.length)a=a.append("0");else return a.toString();else return null}var Bi=function(a,b){return function(c,d){return Q.a(r(d)?b:a,c)}}(new W(null,13,5,X,[null,31,28,31,30,31,30,31,31,30,31,30,31],null),new W(null,13,5,X,[null,31,29,31,30,31,30,31,31,30,31,30,31],null)),Ci=/(\d\d\d\d)(?:-(\d\d)(?:-(\d\d)(?:[T](\d\d)(?::(\d\d)(?::(\d\d)(?:[.](\d+))?)?)?)?)?)?(?:[Z]|([-+])(\d\d):(\d\d))?/;
function Di(a){a=parseInt(a,10);return sa(isNaN(a))?a:null}function Ei(a,b,c,d){a<=b&&b<=c||Th.d(null,J([""+A.b(d)+" Failed:  "+A.b(a)+"\x3c\x3d"+A.b(b)+"\x3c\x3d"+A.b(c)],0));return b}
function Fi(a){var b=sg(Ci,a);P.c(b,0,null);var c=P.c(b,1,null),d=P.c(b,2,null),e=P.c(b,3,null),f=P.c(b,4,null),h=P.c(b,5,null),k=P.c(b,6,null),l=P.c(b,7,null),n=P.c(b,8,null),q=P.c(b,9,null),t=P.c(b,10,null);if(sa(b))return Th.d(null,J(["Unrecognized date/time syntax: "+A.b(a)],0));a=Di(c);var b=function(){var a=Di(d);return r(a)?a:1}(),c=function(){var a=Di(e);return r(a)?a:1}(),v=function(){var a=Di(f);return r(a)?a:0}(),w=function(){var a=Di(h);return r(a)?a:0}(),y=function(){var a=Di(k);return r(a)?
a:0}(),B=function(){var a=Di(Ai(l));return r(a)?a:0}(),n=(Wb.a(n,"-")?-1:1)*(60*function(){var a=Di(q);return r(a)?a:0}()+function(){var a=Di(t);return r(a)?a:0}());return new W(null,8,5,X,[a,Ei(1,b,12,"timestamp month field must be in range 1..12"),Ei(1,c,Bi.a?Bi.a(b,0===(a%4+4)%4&&(0!==(a%100+100)%100||0===(a%400+400)%400)):Bi.call(null,b,0===(a%4+4)%4&&(0!==(a%100+100)%100||0===(a%400+400)%400)),"timestamp day field must be in range 1..last day in month"),Ei(0,v,23,"timestamp hour field must be in range 0..23"),
Ei(0,w,59,"timestamp minute field must be in range 0..59"),Ei(0,y,Wb.a(w,59)?60:59,"timestamp second field must be in range 0..60"),Ei(0,B,999,"timestamp millisecond field must be in range 0..999"),n],null)}
var Gi=Hg.b(new la(null,4,["inst",function(a){var b;if("string"===typeof a)if(b=Fi(a),r(b)){a=P.c(b,0,null);var c=P.c(b,1,null),d=P.c(b,2,null),e=P.c(b,3,null),f=P.c(b,4,null),h=P.c(b,5,null),k=P.c(b,6,null);b=P.c(b,7,null);b=new Date(Date.UTC(a,c-1,d,e,f,h,k)-6E4*b)}else b=Th.d(null,J(["Unrecognized date/time syntax: "+A.b(a)],0));else b=Th.d(null,J(["Instance literal expects a string for its timestamp."],0));return b},"uuid",function(a){return"string"===typeof a?new Tg(a):Th.d(null,J(["UUID literal expects a string as its representation."],
0))},"queue",function(a){return Hc(a)?Yd(Je,a):Th.d(null,J(["Queue literal expects a vector for its elements."],0))},"js",function(a){if(Hc(a)){var b=[];a=E(a);for(var c=null,d=0,e=0;;)if(e<d){var f=c.J(null,e);b.push(f);e+=1}else if(a=E(a))c=a,Ic(c)?(a=Hb(c),e=Ib(c),c=a,d=O(a),a=e):(a=F(c),b.push(a),a=I(c),c=null,d=0),e=0;else break;return b}if(Gc(a)){b={};a=E(a);c=null;for(e=d=0;;)if(e<d){var h=c.J(null,e),f=P.c(h,0,null),h=P.c(h,1,null);b[id(f)]=h;e+=1}else if(a=E(a))Ic(a)?(d=Hb(a),a=Ib(a),c=d,
d=O(d)):(d=F(a),c=P.c(d,0,null),d=P.c(d,1,null),b[id(c)]=d,a=I(a),c=null,d=0),e=0;else break;return b}return u?Th.d(null,J(["JS literal expects a vector or map containing only string or unqualified keyword keys"],0)):null}],null)),Hi=Hg.b(null);
function li(a,b){var c=si(a,b),d=Q.a(ab(Gi),""+A.b(c)),e=ab(Hi);return r(d)?d.b?d.b(hi(a,!0,null)):d.call(null,hi(a,!0,null)):r(e)?e.a?e.a(c,hi(a,!0,null)):e.call(null,c,hi(a,!0,null)):u?Th.d(a,J(["Could not find tag parser for ",""+A.b(c)," in ",Cg.d(J([Ve(ab(Gi))],0))],0)):null};p("mori.apply",S);p("mori.count",O);p("mori.distinct",function(a){return function c(a,e){return new V(null,function(){return function(a,d){for(;;){var e=a,l=P.c(e,0,null);if(e=E(e))if(Oc(d,l))l=G(e),e=d,a=l,d=e;else return M(l,c(G(e),pc.a(d,l)));else return null}}.call(null,a,e)},null,null)}(a,bg)});p("mori.empty",qc);p("mori.first",F);p("mori.rest",G);p("mori.seq",E);p("mori.conj",pc);p("mori.cons",M);
p("mori.find",function(a,b){return null!=a&&Ec(a)&&Oc(a,b)?new W(null,2,5,X,[b,Q.a(a,b)],null):null});p("mori.nth",P);p("mori.last",oc);p("mori.assoc",R);p("mori.dissoc",tc);p("mori.get_in",$d);p("mori.update_in",ae);p("mori.assoc_in",function Ii(b,c,d){var e=P.c(c,0,null);return(c=$c(c))?R.c(b,e,Ii(Q.a(b,e),c,d)):R.c(b,e,d)});p("mori.fnil",Jd);p("mori.disj",Ac);p("mori.pop",zc);p("mori.peek",yc);p("mori.hash",Tb);p("mori.get",Q);p("mori.has_key",Oc);p("mori.is_empty",Bc);p("mori.reverse",ed);
p("mori.take",Md);p("mori.drop",Nd);p("mori.take_nth",function Ji(b,c){return new V(null,function(){var d=E(c);return d?M(F(d),Ji(b,Nd(b,d))):null},null,null)});p("mori.partition",Zd);p("mori.partition_all",jg);p("mori.partition_by",function Ki(b,c){return new V(null,function(){var d=E(c);if(d){var e=F(d),f=b.b?b.b(e):b.call(null,e),e=M(e,lg(function(c,d){return function(c){return Wb.a(d,b.b?b.b(c):b.call(null,c))}}(e,f,d,d),I(d)));return M(e,Ki(b,E(Nd(O(e),d))))}return null},null,null)});
p("mori.iterate",function Li(b,c){return M(c,new V(null,function(){return Li(b,b.b?b.b(c):b.call(null,c))},null,null))});p("mori.into",Yd);p("mori.merge",Zf);p("mori.subvec",ze);p("mori.take_while",lg);p("mori.drop_while",function(a,b){return new V(null,function(c){return function(){return c(a,b)}}(function(a,b){for(;;){var e=E(b),f;f=(f=e)?a.b?a.b(F(e)):a.call(null,F(e)):f;if(r(f))f=a,e=G(e),a=f,b=e;else return e}}),null,null)});
p("mori.group_by",function(a,b){return C.c(function(b,d){var e=a.b?a.b(d):a.call(null,d);return R.c(b,e,pc.a(Q.c(b,e,qe),d))},Ye,b)});p("mori.interpose",function(a,b){return Nd(1,Qd.a(Od.b(a),b))});p("mori.interleave",Qd);p("mori.concat",td);p("mori.conj1",function(a,b){return a.G(null,b)});function Xd(a){return a instanceof Array||Fc(a)}p("mori.flatten",function(a){return Ud(function(a){return!Xd(a)},G(Wd(a)))});p("mori.lazy_seq",function(a){return new V(null,a,null,null)});p("mori.keys",Ve);
p("mori.select_keys",function(a,b){for(var c=Ye,d=E(b);;)if(d)var e=F(d),f=Q.c(a,e,ih),c=Bd.a(f,ih)?R.c(c,e,f):c,d=I(d);else return c});p("mori.vals",We);p("mori.prim_seq",mc);p("mori.map",Kd);p("mori.mapcat",Sd);p("mori.reduce",C);p("mori.reduce_kv",function(a,b,c){return null!=c?hb(c,a,b):b});p("mori.filter",Ud);p("mori.remove",Vd);p("mori.some",Ed);p("mori.every",Dd);p("mori.equals",Wb);p("mori.range",pg);p("mori.repeat",Od);p("mori.repeatedly",Pd);p("mori.sort",Sc);p("mori.sort_by",Tc);
p("mori.into_array",xa);p("mori.subseq",ng);p("mori.rmap",th);p("mori.rfilter",uh);p("mori.rremove",wh);p("mori.rtake",yh);p("mori.rtake_while",xh);p("mori.rdrop",zh);p("mori.rflatten",vh);p("mori.list",fd);p("mori.vector",xe);p("mori.array_map",Uf);p("mori.hash_map",Tf);p("mori.set",eg);p("mori.sorted_set",fg);p("mori.sorted_set_by",gg);p("mori.sorted_map",Vf);p("mori.sorted_map_by",Wf);
p("mori.queue",function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return Yd.a?Yd.a(Je,a):Yd.call(null,Je,a)}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}());p("mori.keyword",jd);p("mori.symbol",$b);p("mori.zipmap",function(a,b){for(var c=yb(Ye),d=E(a),e=E(b);;)if(d&&e)c=xd.c(c,F(d),F(e)),d=I(d),e=I(e);else return Ab(c)});
p("mori.is_list",function(a){return a?a.i&33554432||a.Ec?!0:a.i?!1:s(nb,a):s(nb,a)});p("mori.is_seq",Mc);p("mori.is_vector",Hc);p("mori.is_map",Gc);p("mori.is_set",Dc);p("mori.is_keyword",function(a){return a instanceof T});p("mori.is_symbol",function(a){return a instanceof Zb});p("mori.is_collection",Cc);p("mori.is_sequential",Fc);p("mori.is_associative",Ec);p("mori.is_counted",ic);p("mori.is_indexed",jc);p("mori.is_reduceable",function(a){return a?a.i&524288||a.Nb?!0:a.i?!1:s(fb,a):s(fb,a)});
p("mori.is_seqable",function(a){return a?a.i&8388608||a.hc?!0:a.i?!1:s(kb,a):s(kb,a)});p("mori.is_reversible",dd);p("mori.union",Dh);p("mori.intersection",Eh);p("mori.difference",Fh);p("mori.is_subset",function(a,b){return O(a)<=O(b)&&Dd(function(a){return Oc(b,a)},a)});p("mori.is_superset",function(a,b){return O(a)>=O(b)&&Dd(function(b){return Oc(a,b)},b)});p("mori.partial",Id);p("mori.comp",Hd);
p("mori.pipeline",function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return C.a?C.a(function(a,b){return b.b?b.b(a):b.call(null,a)},a):C.call(null,function(a,b){return b.b?b.b(a):b.call(null,a)},a)}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}());
p("mori.curry",function(){function a(a,d){var e=null;1<arguments.length&&(e=J(Array.prototype.slice.call(arguments,1),0));return b.call(this,a,e)}function b(a,b){return function(e){return S.a(a,M.a?M.a(e,b):M.call(null,e,b))}}a.k=1;a.f=function(a){var d=F(a);a=G(a);return b(d,a)};a.d=b;return a}());
p("mori.juxt",function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return function(){function b(a){var c=null;0<arguments.length&&(c=J(Array.prototype.slice.call(arguments,0),0));return e.call(this,c)}function e(b){return xa.b?xa.b(Kd.a?Kd.a(function(a){return S.a(a,b)},a):Kd.call(null,function(a){return S.a(a,b)},a)):xa.call(null,Kd.a?Kd.a(function(a){return S.a(a,b)},a):Kd.call(null,function(a){return S.a(a,
b)},a))}b.k=0;b.f=function(a){a=E(a);return e(a)};b.d=e;return b}()}a.k=0;a.f=function(a){a=E(a);return b(a)};a.d=b;return a}());
p("mori.knit",function(){function a(a){var d=null;0<arguments.length&&(d=J(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return function(b){return xa.b?xa.b(Kd.c?Kd.c(function(a,b){return a.b?a.b(b):a.call(null,b)},a,b):Kd.call(null,function(a,b){return a.b?a.b(b):a.call(null,b)},a,b)):xa.call(null,Kd.c?Kd.c(function(a,b){return a.b?a.b(b):a.call(null,b)},a,b):Kd.call(null,function(a,b){return a.b?a.b(b):a.call(null,b)},a,b))}}a.k=0;a.f=function(a){a=E(a);return b(a)};
a.d=b;return a}());p("mori.diff",Jh);p("mori.sum",function(a,b){return a+b});p("mori.inc",function(a){return a+1});p("mori.dec",function(a){return a-1});p("mori.is_even",function(a){return 0===(a%2+2)%2});p("mori.is_odd",function(a){return 1===(a%2+2)%2});p("mori.each",function(a,b){for(var c=E(a),d=null,e=0,f=0;;)if(f<e){var h=d.J(null,f);b.b?b.b(h):b.call(null,h);f+=1}else if(c=E(c))d=c,Ic(d)?(c=Hb(d),e=Ib(d),d=c,h=O(c),c=e,e=h):(h=F(d),b.b?b.b(h):b.call(null,h),c=I(d),d=null,e=0),f=0;else return null});
p("mori.identity",Fd);p("mori.constantly",function(a){return function(){function b(b){0<arguments.length&&J(Array.prototype.slice.call(arguments,0),0);return a}b.k=0;b.f=function(b){E(b);return a};b.d=function(){return a};return b}()});p("mori.clj_to_js",Ng);
p("mori.js_to_clj",function(){function a(a,b){return Sg.d(a,J([Rg,b],0))}function b(a){return Sg.b(a)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}());p("mori.parse",function(a){return hi(new Rh(a,[],-1),!1,null)});
p("mori.configure",function(a,b){switch(a){case "print-length":return ia=b;case "print-level":return ja=b;default:throw Error("No matching clause: "+A.b(a));}});
p("mori.proxy",function(a){if("undefined"!==typeof Proxy)return Proxy.create(function(){return{has:function(b){return Oc(a,b)},hasOwn:function(b){return Oc(a,b)},get:function(b,c){var d=Q.c?Q.c(a,c,hh):Q.call(null,a,c,hh);return hd(d,hh)?ic(a)&&"length"===c?O.b?O.b(a):O.call(null,a):null:u?d:null},set:function(){return null},enumerate:function(){return xa.b?xa.b(Ve.b?Ve.b(a):Ve.call(null,a)):xa.call(null,Ve.b?Ve.b(a):Ve.call(null,a))},keys:function(){return Gc(a)?xa.b?xa.b(Ve.b?Ve.b(a):Ve.call(null,
a)):xa.call(null,Ve.b?Ve.b(a):Ve.call(null,a)):Hc(a)?xa.b?xa.b(pg.b?pg.b(O.b?O.b(a):O.call(null,a)):pg.call(null,O.b?O.b(a):O.call(null,a))):xa.call(null,pg.b?pg.b(O.b?O.b(a):O.call(null,a)):pg.call(null,O.b?O.b(a):O.call(null,a))):null}}}());throw Error("ES6 Proxy not supported!");});V.prototype.inspect=function(){return this.toString()};ac.prototype.inspect=function(){return this.toString()};kc.prototype.inspect=function(){return this.toString()};Bf.prototype.inspect=function(){return this.toString()};
vf.prototype.inspect=function(){return this.toString()};wf.prototype.inspect=function(){return this.toString()};bd.prototype.inspect=function(){return this.toString()};gd.prototype.inspect=function(){return this.toString()};cd.prototype.inspect=function(){return this.toString()};W.prototype.inspect=function(){return this.toString()};od.prototype.inspect=function(){return this.toString()};ye.prototype.inspect=function(){return this.toString()};Ae.prototype.inspect=function(){return this.toString()};
$.prototype.inspect=function(){return this.toString()};Y.prototype.inspect=function(){return this.toString()};la.prototype.inspect=function(){return this.toString()};xf.prototype.inspect=function(){return this.toString()};Qf.prototype.inspect=function(){return this.toString()};$f.prototype.inspect=function(){return this.toString()};cg.prototype.inspect=function(){return this.toString()};og.prototype.inspect=function(){return this.toString()};T.prototype.inspect=function(){return this.toString()};
Zb.prototype.inspect=function(){return this.toString()};Ie.prototype.inspect=function(){return this.toString()};He.prototype.inspect=function(){return this.toString()};p("mori._equiv",function(a,b){return a.Hc(b)});p("mori._keys",function(a){return a.keys()});p("mori._values",function(a){return a.values()});p("mori._entries",function(a){return a.entries()});p("mori._has",function(a){return a.has()});p("mori._get",function(a){return a.get()});p("mori._forEach",function(a){return a.forEach()});
p("mori._next",function(a){return a.next()});p("mori.mutable.thaw",function(a){return yb(a)});p("mori.mutable.freeze",vd);p("mori.mutable.conj1",function(a,b){return a.Ka(null,b)});p("mori.mutable.conj",wd);p("mori.mutable.assoc",xd);p("mori.mutable.dissoc",yd);p("mori.mutable.pop",function(a){return Eb(a)});p("mori.mutable.disj",zd);function Mi(a,b,c,d){return N(new W(null,2,5,X,[d,null],null),new la(null,3,[$g,c,Xg,b,Vg,a],null))}function Ni(a){return a.b?a.b(0):a.call(null,0)}function Oi(a){return Vg.b(xc(a)).call(null,Ni(a))}function Pi(a){if(r(Oi(a)))return Xg.b(xc(a)).call(null,Ni(a));throw"called children on a leaf node";}function Qi(a,b,c){return $g.b(xc(a)).call(null,b,c)}
function Ri(a){if(r(Oi(a))){var b=P.c(a,0,null),c=P.c(a,1,null),d=Pi(a),e=P.c(d,0,null),f=$c(d);return r(d)?N(new W(null,2,5,X,[e,new la(null,4,[Zg,qe,ah,r(c)?pc.a(ah.b(c),b):new W(null,1,5,X,[b],null),Ug,c,Wg,f],null)],null),xc(a)):null}return null}
function Si(a){var b=P.c(a,0,null),c=P.c(a,1,null),d=Mc(c)?S.a(Tf,c):c,c=Q.a(d,Zg),e=Q.a(d,Ug),f=Q.a(d,ah),h=Q.a(d,Wg),d=Q.a(d,bh);return r(f)?(f=yc(f),N(r(d)?new W(null,2,5,X,[Qi(a,f,td.a(c,M(b,h))),r(e)?R.c(e,bh,!0):e],null):new W(null,2,5,X,[f,e],null),xc(a))):null}function Ti(a){var b=P.c(a,0,null),c=P.c(a,1,null),c=Mc(c)?S.a(Tf,c):c,d=Q.a(c,Zg),e=Q.a(c,Wg),f=P.c(e,0,null),h=$c(e);return r(r(c)?e:c)?N(new W(null,2,5,X,[f,R.d(c,Zg,pc.a(d,b),J([Wg,h],0))],null),xc(a)):null}
function Ui(a){var b=P.c(a,0,null),c=P.c(a,1,null),c=Mc(c)?S.a(Tf,c):c,d=Q.a(c,Zg),e=Q.a(c,Wg);return r(r(c)?e:c)?N(new W(null,2,5,X,[oc(e),R.d(c,Zg,S.n(pc,d,b,hg(e)),J([Wg,null],0))],null),xc(a)):a}function Vi(a){var b=P.c(a,0,null),c=P.c(a,1,null),c=Mc(c)?S.a(Tf,c):c,d=Q.a(c,Zg),e=Q.a(c,Wg);return r(r(c)?E(d):c)?N(new W(null,2,5,X,[yc(d),R.d(c,Zg,zc(d),J([Wg,M(b,e)],0))],null),xc(a)):null}
function Wi(a,b){P.c(a,0,null);var c=P.c(a,1,null);return N(new W(null,2,5,X,[b,R.c(c,bh,!0)],null),xc(a))}var Xi=function(){function a(a,d,e){var f=null;2<arguments.length&&(f=J(Array.prototype.slice.call(arguments,2),0));return b.call(this,a,d,f)}function b(a,b,e){return Wi(a,S.c(b,Ni(a),e))}a.k=2;a.f=function(a){var d=F(a);a=I(a);var e=F(a);a=G(a);return b(d,e,a)};a.d=b;return a}();p("mori.zip.zipper",Mi);p("mori.zip.seq_zip",function(a){return Mi(Mc,Fd,function(a,c){return N(c,xc(a))},a)});p("mori.zip.vector_zip",function(a){return Mi(Hc,E,function(a,c){return N(we(c),xc(a))},a)});p("mori.zip.node",Ni);p("mori.zip.is_branch",{}.xc);p("mori.zip.children",Pi);p("mori.zip.make_node",Qi);p("mori.zip.path",function(a){return ah.b(a.b?a.b(1):a.call(null,1))});p("mori.zip.lefts",function(a){return E(Zg.b(a.b?a.b(1):a.call(null,1)))});
p("mori.zip.rights",function(a){return Wg.b(a.b?a.b(1):a.call(null,1))});p("mori.zip.down",Ri);p("mori.zip.up",Si);p("mori.zip.root",function(a){for(;;){if(Wb.a(eh,a.b?a.b(1):a.call(null,1)))return Ni(a);var b=Si(a);if(r(b))a=b;else return Ni(a)}});p("mori.zip.right",Ti);p("mori.zip.rightmost",Ui);p("mori.zip.left",Vi);
p("mori.zip.leftmost",function(a){var b=P.c(a,0,null),c=P.c(a,1,null),c=Mc(c)?S.a(Tf,c):c,d=Q.a(c,Zg),e=Q.a(c,Wg);return r(r(c)?E(d):c)?N(new W(null,2,5,X,[F(d),R.d(c,Zg,qe,J([Wg,td.d(G(d),new W(null,1,5,X,[b],null),J([e],0))],0))],null),xc(a)):a});p("mori.zip.insert_left",function(a,b){var c=P.c(a,0,null),d=P.c(a,1,null),d=Mc(d)?S.a(Tf,d):d,e=Q.a(d,Zg);if(null==d)throw"Insert at top";return N(new W(null,2,5,X,[c,R.d(d,Zg,pc.a(e,b),J([bh,!0],0))],null),xc(a))});
p("mori.zip.insert_right",function(a,b){var c=P.c(a,0,null),d=P.c(a,1,null),d=Mc(d)?S.a(Tf,d):d,e=Q.a(d,Wg);if(null==d)throw"Insert at top";return N(new W(null,2,5,X,[c,R.d(d,Wg,M(b,e),J([bh,!0],0))],null),xc(a))});p("mori.zip.replace",Wi);p("mori.zip.edit",Xi);p("mori.zip.insert_child",function(a,b){return Wi(a,Qi(a,Ni(a),M(b,Pi(a))))});p("mori.zip.append_child",function(a,b){return Wi(a,Qi(a,Ni(a),td.a(Pi(a),new W(null,1,5,X,[b],null))))});
p("mori.zip.next",function(a){if(Wb.a(eh,a.b?a.b(1):a.call(null,1)))return a;var b;b=Oi(a);b=r(b)?Ri(a):b;if(r(b))return b;b=Ti(a);if(r(b))return b;for(;;)if(r(Si(a))){b=Ti(Si(a));if(r(b))return b;a=Si(a)}else return new W(null,2,5,X,[Ni(a),eh],null)});p("mori.zip.prev",function(a){var b=Vi(a);if(r(b))for(a=b;;)if(b=Oi(a),b=r(b)?Ri(a):b,r(b))a=Ui(b);else return a;else return Si(a)});p("mori.zip.is_end",function(a){return Wb.a(eh,a.b?a.b(1):a.call(null,1))});
p("mori.zip.remove",function(a){P.c(a,0,null);var b=P.c(a,1,null),b=Mc(b)?S.a(Tf,b):b,c=Q.a(b,Zg),d=Q.a(b,Ug),e=Q.a(b,ah),f=Q.a(b,Wg);if(null==b)throw"Remove at top";if(0<O(c))for(a=N(new W(null,2,5,X,[yc(c),R.d(b,Zg,zc(c),J([bh,!0],0))],null),xc(a));;)if(b=Oi(a),b=r(b)?Ri(a):b,r(b))a=Ui(b);else return a;else return N(new W(null,2,5,X,[Qi(a,yc(e),f),r(d)?R.c(d,bh,!0):d],null),xc(a))});;return this.mori;}.call({});});

},{}],65:[function(_dereq_,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],66:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],67:[function(_dereq_,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],68:[function(_dereq_,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = _dereq_('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = _dereq_('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,_dereq_("UPikzY"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":67,"UPikzY":66,"inherits":65}]},{},[1])
(1)
});