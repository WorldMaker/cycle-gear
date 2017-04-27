import { adapt } from '@cycle/run/lib/adapt';
import xs from 'xstream';
export function pedal(transmission, { defaultGear = { intent: (sources) => ({}), model: (actions) => xs.of({}), teeth: {} }, defaultFilter = (model) => true, sinkMap = new Map() } = {}) {
    let { catch: defaultCatch, intent: defaultIntent, model: defaultModel } = defaultGear;
    defaultCatch = defaultCatch || ((error) => xs.throw(error));
    defaultIntent = defaultIntent || ((sources) => ({}));
    defaultModel = defaultModel || ((actions) => xs.of({}));
    // Fully expand tooth defaults to avoid doing all the tests below every time
    const teeth = Object.keys(defaultGear.teeth);
    const toothDefaults = {};
    const emptyTeeth = teeth.reduce((accum, cur) => Object.assign(accum, { [cur]: xs.never() }), {});
    for (let tooth of teeth) {
        const defGearTooth = defaultGear.teeth[tooth];
        if (defGearTooth instanceof Function) {
            toothDefaults[tooth] = { filter: defaultFilter, view: defGearTooth };
        }
        else {
            toothDefaults[tooth] = { filter: defGearTooth.filter || defaultFilter, view: defGearTooth.view };
        }
    }
    // Filter helper
    const toothFilter = (name, tooth) => {
        if (!tooth || tooth instanceof Function) {
            return toothDefaults[name].filter;
        }
        else {
            return tooth.filter || toothDefaults[name].filter;
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
    return (sources) => {
        let gear;
        if (transmission instanceof Function) {
            gear = transmission(sources);
        }
        else {
            gear = transmission;
        }
        const spin = xs.fromObservable(gear)
            .map(gear => {
            const actions = gear.intent ? gear.intent(sources) : defaultIntent(sources);
            const state = xs.fromObservable(gear.model ? gear.model(actions) : defaultModel(actions))
                .replaceError((err) => xs.fromObservable(gear.catch ? gear.catch(err, actions) : defaultCatch(err, actions)))
                .remember();
            const views = teeth.reduce((accum, tooth) => Object.assign(accum, {
                [tooth]: state.filter(toothFilter(tooth, gear.teeth[tooth])).map(toothView(tooth, gear.teeth[tooth]))
            }), {});
            return views;
        })
            .startWith(emptyTeeth)
            .remember();
        const sinks = teeth.reduce((accum, tooth) => Object.assign(accum, {
            [sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth]: adapt(spin.map((views) => views[tooth]).flatten())
        }), {});
        return sinks;
    };
}
