"use strict";
var adapt_1 = require("@cycle/run/lib/adapt");
var xstream_1 = require("xstream");
function pedal(transmission, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.defaultGear, defaultGear = _c === void 0 ? { intent: function (sources) { return ({}); }, model: function (actions) { return xstream_1.default.of({}); }, teeth: {} } : _c, _d = _b.defaultFilter, defaultFilter = _d === void 0 ? function (model) { return true; } : _d, _e = _b.sinkMap, sinkMap = _e === void 0 ? new Map() : _e;
    var defaultCatch = defaultGear.catch, defaultIntent = defaultGear.intent, defaultModel = defaultGear.model;
    defaultCatch = defaultCatch || (function (error) { return xstream_1.default.throw(error); });
    defaultIntent = defaultIntent || (function (sources) { return ({}); });
    defaultModel = defaultModel || (function (actions) { return xstream_1.default.of({}); });
    // Fully expand tooth defaults to avoid doing all the tests below every time
    var teeth = Object.keys(defaultGear.teeth);
    var toothDefaults = {};
    var emptyTeeth = teeth.reduce(function (accum, cur) {
        return Object.assign(accum, (_a = {}, _a[cur] = xstream_1.default.never(), _a));
        var _a;
    }, {});
    for (var _i = 0, teeth_1 = teeth; _i < teeth_1.length; _i++) {
        var tooth = teeth_1[_i];
        var defGearTooth = defaultGear.teeth[tooth];
        if (defGearTooth instanceof Function) {
            toothDefaults[tooth] = { filter: defaultFilter, view: defGearTooth };
        }
        else {
            toothDefaults[tooth] = { filter: defGearTooth.filter || defaultFilter, view: defGearTooth.view };
        }
    }
    // Filter helper
    var toothFilter = function (name, tooth) {
        if (!tooth || tooth instanceof Function) {
            return toothDefaults[name].filter;
        }
        else {
            return tooth.filter || toothDefaults[name].filter;
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
    return function (sources) {
        var gear;
        if (transmission instanceof Function) {
            gear = transmission(sources);
        }
        else {
            gear = transmission;
        }
        var spin = gear.map(function (gear) {
            var actions = gear.intent ? gear.intent(sources) : defaultIntent(sources);
            var state = (gear.model ? gear.model(actions) : defaultModel(actions))
                .replaceError(function (err) { return gear.catch ? gear.catch(err, actions) : defaultCatch(err, actions); })
                .remember();
            var views = teeth.reduce(function (accum, tooth) {
                return Object.assign(accum, (_a = {},
                    _a[tooth] = state.filter(toothFilter(tooth, gear.teeth[tooth])).map(toothView(tooth, gear.teeth[tooth])),
                    _a));
                var _a;
            }, {});
            return views;
        })
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
