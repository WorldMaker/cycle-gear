import { adapt } from '@cycle/run/lib/adapt';
import xs from 'xstream';
import flattenConcurrently from 'xstream/extra/flattenConcurrently';
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
function spinGear(sources, defaultIntent, defaultModel, defaultCatch, sourcesWrapper, teeth, toothFilter, toothView, toothCombineGear = false, defaultConnector = {}, connectors = new Map()) {
    const modelCache = new WeakMap();
    return gear => {
        let state = modelCache.get(gear);
        if (!state) {
            const wrappedSources = sourcesWrapper(sources, gear);
            const actions = gear.intent ? gear.intent(wrappedSources) : defaultIntent(wrappedSources);
            state = xs.fromObservable(gear.model ? gear.model(actions) : defaultModel(actions))
                .replaceError((err) => xs.fromObservable(gear.catch ? gear.catch(err, actions) : defaultCatch(err, actions)))
                .remember();
            modelCache.set(gear, state);
        }
        const views = teeth.reduce((accum, tooth) => {
            let view = state.filter(toothFilter(tooth, (gear.teeth || {})[tooth])).map(toothView(tooth, (gear.teeth || {})[tooth]));
            const isolator = connectors.has(tooth)
                ? connectors.get(tooth).isolate || defaultConnector.isolate
                : defaultConnector.isolate;
            if (isolator) {
                view = xs.fromObservable(isolator(sources, view, gear));
            }
            if (toothCombineGear) {
                view = view.map(v => [v, gear]);
            }
            return Object.assign(accum, {
                [tooth]: view
            });
        }, {});
        return views;
    };
}
export function pedal(transmission, { defaultGear = { intent: () => ({}), model: () => xs.of({}), teeth: {} }, defaultFilter = () => true, sinkMap = new Map(), sourcesWrapper = (sources) => sources } = {}) {
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
            .map(spinGear(sources, defaultIntent, defaultModel, defaultCatch, sourcesWrapper, teeth, toothFilter, toothView))
            .startWith(emptyTeeth)
            .remember();
        const sinks = teeth.reduce((accum, tooth) => Object.assign(accum, {
            [sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth]: adapt(spin.map((views) => views[tooth]).flatten())
        }), {});
        return sinks;
    };
}
const defaultReduce = (acc, [cur, gear]) => (Object.assign({}, acc, { [gear.name || '?']: cur }));
function spinGears(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, cumulative, sourcesWrapper, defaultConnector, connectors) {
    const spinCache = new WeakMap();
    const spinner = spinGear(sources, defaultIntent, defaultModel, defaultCatch, sourcesWrapper, teeth, toothFilter, toothView, true, defaultConnector, connectors);
    return gears => {
        const spins = [];
        for (let gear of gears) {
            const cached = spinCache.get(gear);
            if (!cumulative && cached) {
                spins.push(cached);
            }
            else {
                const spinnning = spinner(gear);
                spinCache.set(gear, spinnning);
                spins.push(spinnning);
            }
        }
        return spins;
    };
}
export function motor(gearbox, { defaultGear = { intent: () => ({}), model: () => xs.of({}), teeth: {} }, defaultFilter = () => true, defaultConnector = {}, cumulative = false, sourcesWrapper = (sources) => sources, connectors = new Map(), sinkMap = new Map() } = {}) {
    const { defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView } = defaultsAndHelpers(defaultGear, defaultFilter);
    return (sources) => {
        let gears;
        if (gearbox instanceof Function) {
            gears = gearbox(sources);
        }
        else {
            gears = gearbox;
        }
        let spin = xs.fromObservable(gears)
            .map(spinGears(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, cumulative, sourcesWrapper, defaultConnector, connectors))
            .startWith([]);
        if (cumulative) {
            spin = spin
                .map(spins => xs.fromArray(spins))
                .compose(flattenConcurrently)
                .remember();
        }
        else {
            spin = spin.remember();
        }
        const sinks = teeth.reduce((accum, tooth) => {
            let view;
            if (cumulative) {
                view = spin
                    .map((gear) => gear[tooth])
                    .filter(toothView => !!toothView)
                    .compose(flattenConcurrently);
            }
            else {
                view = spin.map(spins => xs.fromArray(spins)
                    .map(gear => gear[tooth])
                    .filter(toothView => !!toothView)
                    .compose(flattenConcurrently))
                    .flatten();
            }
            const connector = connectors.get(tooth) || defaultConnector;
            if (connector.fold) {
                view = view.fold(connector.reduce || defaultReduce, connector.init || {});
            }
            else {
                view = view.map(([cur]) => cur);
            }
            return Object.assign({}, accum, { [sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth]: adapt(view) });
        }, {});
        return sinks;
    };
}
