"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var adapt_1 = require("@cycle/run/lib/adapt");
var xstream_1 = require("xstream");
var flattenConcurrently_1 = require("xstream/extra/flattenConcurrently");
function defaultsAndHelpers(defaultGear, defaultFilter) {
    var defaultCatch = defaultGear.catch || (function (error) { return xstream_1.default.throw(error); });
    var defaultIntent = defaultGear.intent || (function () { return ({}); });
    var defaultModel = defaultGear.model || (function () { return xstream_1.default.of({}); });
    // Fully expand tooth defaults to avoid doing all the tests below every time
    var toothDefaults = {};
    var teeth = Object.keys(defaultGear.teeth || {});
    var emptyTeeth = teeth.reduce(function (accum, cur) {
        return Object.assign(accum, (_a = {}, _a[cur] = xstream_1.default.never(), _a));
        var _a;
    }, {});
    if (defaultGear.teeth) {
        try {
            for (var teeth_1 = __values(teeth), teeth_1_1 = teeth_1.next(); !teeth_1_1.done; teeth_1_1 = teeth_1.next()) {
                var tooth = teeth_1_1.value;
                var defGearTooth = defaultGear.teeth[tooth];
                if (defGearTooth instanceof Function) {
                    toothDefaults[tooth] = { filter: defaultFilter, view: defGearTooth };
                }
                else {
                    toothDefaults[tooth] = { filter: defGearTooth.filter || defaultFilter, view: defGearTooth.view };
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (teeth_1_1 && !teeth_1_1.done && (_a = teeth_1.return)) _a.call(teeth_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    // Filter helper
    var toothFilter = function (name, tooth) {
        if (!tooth || tooth instanceof Function) {
            return toothDefaults[name].filter || defaultFilter;
        }
        else {
            return tooth.filter || toothDefaults[name].filter || defaultFilter;
        }
    };
    // View helper
    var toothView = function (name, tooth) {
        if (!tooth) {
            return toothDefaults[name].view;
        }
        else if (tooth instanceof Function) {
            return tooth;
        }
        else {
            return tooth.view;
        }
    };
    return { defaultIntent: defaultIntent, defaultModel: defaultModel, defaultCatch: defaultCatch, teeth: teeth, toothFilter: toothFilter, toothView: toothView, emptyTeeth: emptyTeeth };
    var e_1, _a;
}
function spinGear(sources, defaultIntent, defaultModel, defaultCatch, sourcesWrapper, teeth, toothFilter, toothView, defaultConnector, connectors) {
    if (defaultConnector === void 0) { defaultConnector = {}; }
    if (connectors === void 0) { connectors = new Map(); }
    var modelCache = new WeakMap();
    return function (gear) {
        var state = modelCache.get(gear);
        if (!state) {
            var wrappedSources = sourcesWrapper(sources, gear);
            var actions_1 = gear.intent ? gear.intent(wrappedSources) : defaultIntent(wrappedSources);
            state = xstream_1.default.fromObservable(gear.model ? gear.model(actions_1) : defaultModel(actions_1))
                .replaceError(function (err) { return xstream_1.default.fromObservable(gear.catch ? gear.catch(err, actions_1) : defaultCatch(err, actions_1)); })
                .remember();
            modelCache.set(gear, state);
        }
        var views = teeth.reduce(function (accum, tooth) {
            var view = state.filter(toothFilter(tooth, (gear.teeth || {})[tooth])).map(toothView(tooth, (gear.teeth || {})[tooth]));
            var isolator = connectors.has(tooth)
                ? connectors.get(tooth).isolate || defaultConnector.isolate
                : defaultConnector.isolate;
            if (isolator) {
                view = xstream_1.default.fromObservable(isolator(sources, view, gear));
            }
            return Object.assign(accum, (_a = {},
                _a[tooth] = view,
                _a));
            var _a;
        }, {});
        return views;
    };
}
function pedal(transmission, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.defaultGear, defaultGear = _c === void 0 ? { intent: function () { return ({}); }, model: function () { return xstream_1.default.of({}); }, teeth: {} } : _c, _d = _b.defaultFilter, defaultFilter = _d === void 0 ? function () { return true; } : _d, _e = _b.sinkMap, sinkMap = _e === void 0 ? new Map() : _e, _f = _b.sourcesWrapper, sourcesWrapper = _f === void 0 ? function (sources) { return sources; } : _f;
    var _g = defaultsAndHelpers(defaultGear, defaultFilter), defaultIntent = _g.defaultIntent, defaultModel = _g.defaultModel, defaultCatch = _g.defaultCatch, teeth = _g.teeth, toothFilter = _g.toothFilter, toothView = _g.toothView, emptyTeeth = _g.emptyTeeth;
    return function (sources) {
        var gear;
        if (transmission instanceof Function) {
            gear = transmission(sources);
        }
        else {
            gear = transmission;
        }
        var spin = xstream_1.default.fromObservable(gear)
            .map(spinGear(sources, defaultIntent, defaultModel, defaultCatch, sourcesWrapper, teeth, toothFilter, toothView))
            .startWith(emptyTeeth)
            .remember();
        var sinks = teeth.reduce(function (accum, tooth) {
            return Object.assign(accum, (_a = {},
                _a[sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth] = adapt_1.adapt(spin.map(function (views) { return views[tooth]; }).flatten()),
                _a));
            var _a;
        }, {});
        return sinks;
    };
}
exports.pedal = pedal;
var defaultReduce = function (acc, _a) {
    var _b = __read(_a, 2), cur = _b[0], gear = _b[1];
    return (__assign({}, acc, (_c = {}, _c[gear.name || '?'] = cur, _c)));
    var _c;
};
function spinGears(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, sourcesWrapper, defaultConnector, connectors) {
    var spinCache = new WeakMap();
    return function (gears) {
        var spins = [];
        try {
            for (var gears_1 = __values(gears), gears_1_1 = gears_1.next(); !gears_1_1.done; gears_1_1 = gears_1.next()) {
                var gear = gears_1_1.value;
                var cached = spinCache.get(gear);
                if (cached) {
                    spins.push(cached);
                }
                else {
                    var spinnning = spinGear(sources, defaultIntent, defaultModel, defaultCatch, sourcesWrapper, teeth, toothFilter, toothView, defaultConnector, connectors);
                    spinCache.set(gear, spinnning);
                    spins.push(spinnning);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (gears_1_1 && !gears_1_1.done && (_a = gears_1.return)) _a.call(gears_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return spins;
        var e_2, _a;
    };
}
function motor(gearbox, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.defaultGear, defaultGear = _c === void 0 ? { intent: function () { return ({}); }, model: function () { return xstream_1.default.of({}); }, teeth: {} } : _c, _d = _b.defaultFilter, defaultFilter = _d === void 0 ? function () { return true; } : _d, _e = _b.defaultConnector, defaultConnector = _e === void 0 ? {} : _e, _f = _b.sourcesWrapper, sourcesWrapper = _f === void 0 ? function (sources) { return sources; } : _f, _g = _b.connectors, connectors = _g === void 0 ? new Map() : _g, _h = _b.sinkMap, sinkMap = _h === void 0 ? new Map() : _h;
    var _j = defaultsAndHelpers(defaultGear, defaultFilter), defaultIntent = _j.defaultIntent, defaultModel = _j.defaultModel, defaultCatch = _j.defaultCatch, teeth = _j.teeth, toothFilter = _j.toothFilter, toothView = _j.toothView;
    return function (sources) {
        var gears;
        if (gearbox instanceof Function) {
            gears = gearbox(sources);
        }
        else {
            gears = gearbox;
        }
        var spin = xstream_1.default.fromObservable(gears)
            .map(spinGears(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, sourcesWrapper, defaultConnector, connectors))
            .startWith([])
            .remember();
        var sinks = teeth.reduce(function (accum, tooth) {
            var view = spin.map(function (spins) { return xstream_1.default.fromArray(spins)
                .map(function (spin) { return spin[tooth]; })
                .compose(flattenConcurrently_1.default); })
                .flatten();
            var connector = connectors.get(tooth) || defaultConnector;
            if (connector.fold) {
                view = view.fold(connector.reduce || defaultReduce, connector.init || {});
            }
            else {
                view = view.map(function (_a) {
                    var _b = __read(_a, 1), cur = _b[0];
                    return cur;
                });
            }
            return __assign({}, accum, (_a = {}, _a[sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth] = adapt_1.adapt(view), _a));
            var _a;
        }, {});
        return sinks;
    };
}
exports.motor = motor;
