import { adapt } from '@cycle/run/lib/adapt';
import xs from 'xstream';
function defaultsAndHelpers(defaultGear, defaultFilter) {
    const defaultCatch = defaultGear.catch || ((error) => xs.throw(error));
    const defaultIntent = defaultGear.intent || (() => ({}));
    const defaultModel = defaultGear.model || (() => xs.of({}));
    // Fully expand tooth defaults to avoid doing all the tests below every time
    const toothDefaults = {};
    const teeth = Object.keys(defaultGear.teeth || {});
    const emptyTeeth = teeth.reduce((accum, cur) => Object.assign(accum, { [cur]: xs.never() }), {});
    if (defaultGear.teeth) {
        for (let tooth of teeth) {
            const defGearTooth = defaultGear.teeth[tooth];
            if (defGearTooth instanceof Function) {
                toothDefaults[tooth] = { filter: defaultFilter, view: defGearTooth };
            }
            else {
                toothDefaults[tooth] = { filter: defGearTooth.filter || defaultFilter, view: defGearTooth.view };
            }
        }
    }
    // Filter helper
    const toothFilter = (name, tooth) => {
        if (!tooth || tooth instanceof Function) {
            return toothDefaults[name].filter || defaultFilter;
        }
        else {
            return tooth.filter || toothDefaults[name].filter || defaultFilter;
        }
    };
    // View helper
    const toothView = (name, tooth) => {
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
    return { defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, emptyTeeth };
}
function spinGear(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView) {
    const modelCache = new WeakMap();
    return gear => {
        let state;
        if (modelCache.has(gear)) {
            state = modelCache.get(gear);
        }
        else {
            const actions = gear.intent ? gear.intent(sources) : defaultIntent(sources);
            state = xs.fromObservable(gear.model ? gear.model(actions) : defaultModel(actions))
                .replaceError((err) => xs.fromObservable(gear.catch ? gear.catch(err, actions) : defaultCatch(err, actions)))
                .remember();
            modelCache.set(gear, state);
        }
        const views = teeth.reduce((accum, tooth) => Object.assign(accum, {
            [tooth]: state.filter(toothFilter(tooth, (gear.teeth || {})[tooth])).map(toothView(tooth, (gear.teeth || {})[tooth]))
        }), {});
        return views;
    };
}
export function pedal(transmission, { defaultGear = { intent: () => ({}), model: () => xs.of({}), teeth: {} }, defaultFilter = () => true, sinkMap = new Map() } = {}) {
    const { defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, emptyTeeth } = defaultsAndHelpers(defaultGear, defaultFilter);
    return (sources) => {
        let gear;
        if (transmission instanceof Function) {
            gear = transmission(sources);
        }
        else {
            gear = transmission;
        }
        const spin = xs.fromObservable(gear)
            .map(spinGear(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView))
            .startWith(emptyTeeth)
            .remember();
        const sinks = teeth.reduce((accum, tooth) => Object.assign(accum, {
            [sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth]: adapt(spin.map((views) => views[tooth]).flatten())
        }), {});
        return sinks;
    };
}
function spinGears(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, sourcesWrapper, defaultConnector, connectors) {
    const modelCache = new WeakMap();
    return gears => {
        const views = teeth.reduce((acc, cur) => (Object.assign({}, acc, { [cur]: [] })), {});
        for (let gear of gears) {
            let state;
            if (modelCache.has(gear)) {
                state = modelCache.get(gear);
            }
            else {
                const wrappedSources = sourcesWrapper(sources, gear);
                const actions = gear.intent ? gear.intent(wrappedSources) : defaultIntent(wrappedSources);
                state = xs.fromObservable(gear.model ? gear.model(actions) : defaultModel(actions))
                    .replaceError((err) => xs.fromObservable(gear.catch ? gear.catch(err, actions) : defaultCatch(err, actions)))
                    .remember();
                modelCache.set(gear, state);
            }
            for (let tooth of teeth) {
                views[tooth].push(state
                    .filter(toothFilter(tooth, (gear.teeth || {})[tooth]))
                    .map(state => [toothView(tooth, (gear.teeth || {})[tooth])(state), gear]));
            }
        }
        return teeth.reduce((accum, tooth) => (Object.assign({}, accum, { [tooth]: xs.merge(...views[tooth])
                .fold(connectors.has(tooth) ? connectors.get(tooth).reduce : defaultConnector.reduce, connectors.has(tooth) ? connectors.get(tooth).init() : defaultConnector.init()) })), {});
    };
}
const defaultDefaultConnector = {
    reduce: (acc, [cur, gear]) => (Object.assign({}, acc, { [gear.name || '?']: cur })),
    init: () => ({})
};
export function motor(gearbox, { defaultGear = { intent: () => ({}), model: () => xs.of({}), teeth: {} }, defaultFilter = () => true, defaultConnector = defaultDefaultConnector, sourcesWrapper = (sources) => sources, connectors = new Map(), sinkMap = new Map() } = {}) {
    const { defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, emptyTeeth } = defaultsAndHelpers(defaultGear, defaultFilter);
    return (sources) => {
        let gears;
        if (gearbox instanceof Function) {
            gears = gearbox(sources);
        }
        else {
            gears = gearbox;
        }
        const spin = xs.fromObservable(gears)
            .map(spinGears(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, sourcesWrapper, defaultConnector, connectors))
            .startWith(emptyTeeth)
            .remember();
        const sinks = teeth.reduce((accum, tooth) => Object.assign(accum, {
            [sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth]: adapt(spin.map((views) => views[tooth]).flatten())
        }), {});
        return sinks;
    };
}
