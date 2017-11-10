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
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var adapt_1 = require("@cycle/run/lib/adapt");
var xstream_1 = require("xstream");
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
function spinGear(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView) {
    var modelCache = new WeakMap();
    return function (gear) {
        var state = modelCache.get(gear);
        if (!state) {
            var actions_1 = gear.intent ? gear.intent(sources) : defaultIntent(sources);
            state = xstream_1.default.fromObservable(gear.model ? gear.model(actions_1) : defaultModel(actions_1))
                .replaceError(function (err) { return xstream_1.default.fromObservable(gear.catch ? gear.catch(err, actions_1) : defaultCatch(err, actions_1)); })
                .remember();
            modelCache.set(gear, state);
        }
        var views = teeth.reduce(function (accum, tooth) {
            return Object.assign(accum, (_a = {},
                _a[tooth] = state.filter(toothFilter(tooth, (gear.teeth || {})[tooth])).map(toothView(tooth, (gear.teeth || {})[tooth])),
                _a));
            var _a;
        }, {});
        return views;
    };
}
function pedal(transmission, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.defaultGear, defaultGear = _c === void 0 ? { intent: function () { return ({}); }, model: function () { return xstream_1.default.of({}); }, teeth: {} } : _c, _d = _b.defaultFilter, defaultFilter = _d === void 0 ? function () { return true; } : _d, _e = _b.sinkMap, sinkMap = _e === void 0 ? new Map() : _e;
    var _f = defaultsAndHelpers(defaultGear, defaultFilter), defaultIntent = _f.defaultIntent, defaultModel = _f.defaultModel, defaultCatch = _f.defaultCatch, teeth = _f.teeth, toothFilter = _f.toothFilter, toothView = _f.toothView, emptyTeeth = _f.emptyTeeth;
    return function (sources) {
        var gear;
        if (transmission instanceof Function) {
            gear = transmission(sources);
        }
        else {
            gear = transmission;
        }
        var spin = xstream_1.default.fromObservable(gear)
            .map(spinGear(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView))
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
function spinGears(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, sourcesWrapper, defaultConnector, connectors) {
    var modelCache = new WeakMap();
    return function (gears) {
        var views = teeth.reduce(function (acc, cur) {
            return (__assign({}, acc, (_a = {}, _a[cur] = [], _a)));
            var _a;
        }, {});
        var _loop_1 = function (gear) {
            var state = modelCache.get(gear);
            if (!state) {
                var wrappedSources = sourcesWrapper(sources, gear);
                var actions_2 = gear.intent ? gear.intent(wrappedSources) : defaultIntent(wrappedSources);
                state = xstream_1.default.fromObservable(gear.model ? gear.model(actions_2) : defaultModel(actions_2))
                    .replaceError(function (err) { return xstream_1.default.fromObservable(gear.catch ? gear.catch(err, actions_2) : defaultCatch(err, actions_2)); })
                    .remember();
                modelCache.set(gear, state);
            }
            var _loop_2 = function (tooth) {
                views[tooth].push(state
                    .filter(toothFilter(tooth, (gear.teeth || {})[tooth]))
                    .map(function (state) { return [toothView(tooth, (gear.teeth || {})[tooth])(state), gear]; }));
            };
            try {
                for (var teeth_2 = __values(teeth), teeth_2_1 = teeth_2.next(); !teeth_2_1.done; teeth_2_1 = teeth_2.next()) {
                    var tooth = teeth_2_1.value;
                    _loop_2(tooth);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (teeth_2_1 && !teeth_2_1.done && (_a = teeth_2.return)) _a.call(teeth_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
            var e_2, _a;
        };
        try {
            for (var gears_1 = __values(gears), gears_1_1 = gears_1.next(); !gears_1_1.done; gears_1_1 = gears_1.next()) {
                var gear = gears_1_1.value;
                _loop_1(gear);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (gears_1_1 && !gears_1_1.done && (_a = gears_1.return)) _a.call(gears_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return teeth.reduce(function (accum, tooth) {
            return (__assign({}, accum, (_a = {}, _a[tooth] = xstream_1.default.merge.apply(xstream_1.default, __spread(views[tooth])).fold(connectors.has(tooth) ? connectors.get(tooth).reduce : defaultConnector.reduce, connectors.has(tooth) ? connectors.get(tooth).init() : defaultConnector.init()), _a)));
            var _a;
        }, {});
        var e_3, _a;
    };
}
var defaultDefaultConnector = {
    reduce: function (acc, _a) {
        var _b = __read(_a, 2), cur = _b[0], gear = _b[1];
        return (__assign({}, acc, (_c = {}, _c[gear.name || '?'] = cur, _c)));
        var _c;
    },
    init: function () { return ({}); }
};
function motor(gearbox, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.defaultGear, defaultGear = _c === void 0 ? { intent: function () { return ({}); }, model: function () { return xstream_1.default.of({}); }, teeth: {} } : _c, _d = _b.defaultFilter, defaultFilter = _d === void 0 ? function () { return true; } : _d, _e = _b.defaultConnector, defaultConnector = _e === void 0 ? defaultDefaultConnector : _e, _f = _b.sourcesWrapper, sourcesWrapper = _f === void 0 ? function (sources) { return sources; } : _f, _g = _b.connectors, connectors = _g === void 0 ? new Map() : _g, _h = _b.sinkMap, sinkMap = _h === void 0 ? new Map() : _h;
    var _j = defaultsAndHelpers(defaultGear, defaultFilter), defaultIntent = _j.defaultIntent, defaultModel = _j.defaultModel, defaultCatch = _j.defaultCatch, teeth = _j.teeth, toothFilter = _j.toothFilter, toothView = _j.toothView, emptyTeeth = _j.emptyTeeth;
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
exports.motor = motor;
